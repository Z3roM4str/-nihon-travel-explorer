import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getHubs, getNearby, getPlaceById, getPlacesByHub } from "./data/store";
import type { NavigationRegion } from "./data/geography";
import { getNationalSummary, getPrefectureByCode } from "./data/geography";
import { FilterPanel } from "./components/FilterPanel";
import { HubSelector } from "./components/HubSelector";
import { NationalExplorer } from "./components/NationalExplorer";
import { SelectionAnalysis } from "./components/SelectionAnalysis";
import { PlaceList } from "./components/PlaceList";
import { PlaceMap } from "./components/PlaceMap";
import { PlaceDetail } from "./components/PlaceDetail";
import { Icon } from "./icons/Icon";
import { SelectionPanel } from "./components/SelectionPanel";
import { InterestLegend } from "./components/InterestLegend";
import { Onboarding } from "./components/Onboarding";
import { SaveToast } from "./components/SaveToast";
import { Sheet } from "./components/Sheet";
import { PersonToken } from "./components/PersonToken";
import { TabBar, NavRail } from "./components/AppNav";
import { MlitAttribution } from "./components/MlitAttribution";
import type { Destination } from "./lib/destination";
import { destinationLabel } from "./lib/destination";
import { hubsWithZones } from "./lib/accommodation-zone";
import { hasSeenOnboarding } from "./lib/onboarding";
import { useSaveFeedback } from "./useSaveFeedback";
import { useTravellers } from "./useTravellers";
import { usePortableBackup } from "./usePortableBackup";
/**
 * Block 13. Static, and measured rather than assumed.
 *
 * `TripBackup` is 7.4 kB raw / 2.4 kB gzipped — smaller than `SelectionAnalysis` (14 kB) and
 * `TravellerManager` (9 kB), both of which Block 12 examined and deliberately left in the entry
 * chunk because "a chunk each would buy a round trip and save nothing worth having". Splitting
 * this one would mean applying a threshold to every surface except the one this block happens to
 * be adding, which is how a rule becomes an exception. It stays in the entry; the whole feature
 * costs 1.5 kB gzipped on the critical path.
 */
import { TripBackup } from "./components/TripBackup";
import { usePlannedPlaceIds } from "./usePlannedPlaceIds";
import { TravellerBar } from "./components/TravellerBar";
import { TravellerManager } from "./components/TravellerManager";
import { interestMarker } from "./lib/traveller-presentation";
import { matchesQuery } from "./lib/place";
import { availablePlanningBlocks, matchesAnyPlanningBlock } from "./lib/planning-block";
import { matchesReservationFilter } from "./lib/reservation";
import type { Filters, Place } from "./types";
import "./App.css";

/**
 * Block 12 — the planner and the zone comparison load on demand.
 *
 * Both are full-screen overlays behind a `useState(false)` flag: neither can be on screen at first
 * paint, and reaching either takes a deliberate click. They are also, measured rather than guessed,
 * the only two surfaces in this app that own enough exclusive code to be worth a boundary —
 * 246 kB and 38 kB of modules reachable from nowhere else.
 *
 * Bloque 18: los dos dejan de ser overlays (`02 §D2`, gate 11) y pasan a ser el contenido de las
 * dos secciones de «Viaje», pero la razón de la carga diferida no cambia — siguen sin estar en la
 * ruta crítica de la primera pintura, y `prefetchOnDemandSurfaces` sigue calentando ambos chunks
 * en cuanto el navegador está ocioso, así que el primer cambio a «Viaje» ya los encuentra en caché.
 */
const loadOrderedSequenceBuilder = () =>
  import("./components/OrderedSequenceBuilder").then((m) => ({ default: m.OrderedSequenceBuilder }));
const loadZoneComparison = () =>
  import("./components/ZoneComparison").then((m) => ({ default: m.ZoneComparison }));

const OrderedSequenceBuilder = lazy(loadOrderedSequenceBuilder);
const ZoneComparison = lazy(loadZoneComparison);

const HUBS = getHubs();
/** Hubs where Block 3 modelled accommodation zones; the others offer no comparison. */
const HUBS_WITH_ZONES = hubsWithZones();
const NATIONAL_SUMMARY = getNationalSummary();

/**
 * The single piece of state that decides what Explorar is showing.
 *
 * A discriminated union rather than a handful of booleans: "national" carries the region and
 * prefecture currently being browsed, "hub" carries the active hub, and no contradictory
 * combination of the two can exist. Explorar opens on the national view — the first contact
 * is the whole country, not a city.
 */
type ViewState =
  | { mode: "national"; region: NavigationRegion | null; prefectureCode: string | null }
  | { mode: "hub"; hub: string };

const INITIAL_VIEW: ViewState = { mode: "national", region: null, prefectureCode: null };

/**
 * Which of the two hub surfaces a phone is showing. On desktop both are on screen at once and
 * this is inert; on a phone there is only room for one, and the list is the default because a
 * bare map answers none of the questions a first-time reader arrives with.
 */
type MobilePane = "list" | "map";

/** Bloque 18, `05 §7`: qué contenido de «Viaje» está a la vista. Sustituye a los dos booleanos
 * mutuamente excluyentes (`sequenceBuilderOpen`/`zonesOpen`) de la era de overlays — ahora son,
 * literalmente, mutuamente excluyentes por construcción. */
type ViajeSection = "planificar" | "dormir";

const EMPTY_FILTERS: Filters = {
  query: "",
  categories: [],
  grades: [],
  hiddenGemStatuses: [],
  tourismLevels: [],
  reservation: "all",
  planningBlocks: [],
};

const EMPTY_PLACES: Place[] = [];

/** Width of the desktop detail panel; used to keep the focused marker out from under it.
 * Corrección final (punto 5): 480px, `--place-detail-panel-width` en `tokens.css` — `02 §D5`/
 * `05 §5` fijan la ficha de lugar en 480px desde `md`, distinto del panel de `Sheet` (420px,
 * `04 §8`). Antes compartía el token `--panel-width` con `Sheet`, que era el error normativo
 * que esta corrección arregla (ver `docs/BLOCK_18_HANDOFF.md`). */
const DETAIL_PANEL_WIDTH = 480;
/** Bloque 18: alineado con el token `md` de `02 §D5` (840px), no con el 861px heredado —
 * es exactamente donde `NavRail` sustituye a `TabBar` en CSS, así que el lado JS del layout
 * (offset del panel de ficha, apertura por defecto de los grupos de filtros) no puede discrepar. */
const DESKTOP_QUERY = "(min-width: 840px)";

function matchesFilters(place: Place, filters: Filters): boolean {
  if (filters.categories.length > 0 && !filters.categories.includes(place.category)) return false;
  if (filters.grades.length > 0 && !filters.grades.includes(place.grade)) return false;
  if (
    filters.hiddenGemStatuses.length > 0 &&
    (!place.hiddenGemStatus || !filters.hiddenGemStatuses.includes(place.hiddenGemStatus))
  )
    return false;
  if (filters.tourismLevels.length > 0 && !filters.tourismLevels.includes(place.tourismLevel)) return false;
  if (!matchesAnyPlanningBlock(place.duration, filters.planningBlocks)) return false;
  if (!matchesReservationFilter(place, filters.reservation)) return false;
  return matchesQuery(place, filters.query);
}

function countActiveFilters(filters: Filters): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    filters.categories.length +
    filters.grades.length +
    filters.hiddenGemStatuses.length +
    filters.tourismLevels.length +
    filters.planningBlocks.length +
    (filters.reservation === "all" ? 0 : 1)
  );
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/**
 * Block 12 — warm the two on-demand chunks once the browser is idle after first paint.
 *
 * Without this, splitting would simply move the wait from load to click, which is a worse trade:
 * a slower first paint is shared by everyone, but a stalled overlay lands on the one person who
 * asked for it. Idle time after paint is free, and by the time any click is possible the chunks
 * are in the HTTP cache.
 *
 * Deliberately best-effort. `requestIdleCallback` is missing on some browsers (Safari shipped it
 * late), so it falls back to a timeout; a rejected import is swallowed, because a failed prefetch
 * must never surface as an error — `React.lazy` will simply fetch it again on open, and report
 * properly then.
 */
function prefetchOnDemandSurfaces(): () => void {
  let cancelled = false;
  const warm = () => {
    if (cancelled) return;
    void loadOrderedSequenceBuilder().catch(() => {});
    void loadZoneComparison().catch(() => {});
  };
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  if (typeof idle === "function") {
    const handle = idle(warm);
    return () => {
      cancelled = true;
      (globalThis as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
    };
  }
  const timer = setTimeout(warm, 1500);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

export default function App() {
  /** Bloque 18 (DD-001, `02 §D2`) — el destino permanente activo. Cambiar de destino nunca
   * descarta el estado de los demás: cada panel sigue montado (`hidden`), sólo deja de pintarse. */
  const [destination, setDestination] = useState<Destination>("explorar");

  // ---- Explorar ----
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** Trail of visited places (any hub), so "nearby" jumps and cross-hub opens can be
   * stepped back through. */
  const [history, setHistory] = useState<string[]>([]);
  /**
   * Bloque 18, corrección post-cierre (`02 §D2`/`02 §D3`, "Quiero ir └── Lugar · misma ficha
   * que en Explorar"): la ficha ya no vive sólo en Explorar. `ficheOrigin` es qué destino la
   * abrió, y decide dos cosas — en cuál de los cuatro paneles se monta (misma `PlaceDetail`,
   * un único punto de renderizado condicional, nunca los dos a la vez) y si abrirla/navegar
   * dentro de ella puede tocar el `view`/hub de Explorar (sólo cuando `ficheOrigin ===
   * "explorar"`, que es cuando esa lista/mapa comparten pantalla con la ficha de verdad).
   */
  const [ficheOrigin, setFicheOrigin] = useState<Destination | null>(null);
  /**
   * Corrección final (punto 7): el origen por sí solo no basta para nombrar la etiqueta del
   * back cuando Viaje tenga más de una superficie que abra lugares (hoy sólo «Dónde dormir»,
   * mañana quizá «Días»). Metadato explícito, no derivado — se fija junto a `ficheOrigin` en
   * cada llamada a `selectPlace` y se limpia junto a él en `closeDetail`. `null` para Explorar/
   * Quiero ir, que no lo necesitan (su `PlaceDetail` no cambia de comportamiento).
   */
  const [ficheOriginLabel, setFicheOriginLabel] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [citySheetOpen, setCitySheetOpen] = useState(false);
  /** Phones show one hub surface at a time; the cards come first. */
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");

  // ---- Quiero ir ----
  /** Bloque 18: ya no es un panel inferior colapsable de cromo global — es el contenido de la
   * pestaña, así que empieza abierto. El plegado interno de `SelectionPanel` se conserva por si
   * el lector quiere recogerlo, pero ya no es la forma de llegar a él (`02 §D2`). */
  const [selectionOpen, setSelectionOpen] = useState(true);
  /** Bloque 18: sustituye al modal global `analysisOpen` — «en qué coincidís» es ahora una
   * sección que se despliega dentro de la propia pestaña (gate 11, DD-010). */
  const [analysisVisible, setAnalysisVisible] = useState(false);

  // ---- Viaje ----
  const [viajeSection, setViajeSection] = useState<ViajeSection>("planificar");
  /**
   * Bloque 18, corrección post-cierre: el handoff original afirmaba que los cuatro destinos
   * permanecen montados, pero `OrderedSequenceBuilder`/`ZoneComparison` sólo se renderizaban
   * bajo `destination === "viaje" && ...`, así que cambiar de pestaña los desmontaba de verdad
   * (su estado local de React se perdía, no sólo se ocultaba). `viajeVisited` se fija la
   * primera vez que el lector entra en Viaje y no vuelve a `false`: a partir de ahí, el
   * componente de la sección activa (`viajeSection`, sigue siendo uno solo — Bloque 4) queda
   * montado aunque el destino activo cambie; sólo `hidden` en el panel exterior deja de
   * pintarlo. Antes de la primera visita, ninguno de los dos se monta — el chunk bajo demanda
   * del Bloque 12 sigue sin tocarse hasta que hace falta o hasta que `prefetchOnDemandSurfaces`
   * lo calienta en `idle`, lo que ocurra antes.
   */
  const [viajeVisited, setViajeVisited] = useState(false);
  if (destination === "viaje" && !viajeVisited) setViajeVisited(true);
  /**
   * Block 6 — bumped when the planner closes, which is the moment its draft has settled.
   *
   * It is a cache key for a READ, not a copy of anything: see `usePlannedPlaceIds`. Bloque 18
   * bumps it when the reader leaves «Planificar» for «Dónde dormir» instead of when a modal
   * closes — the planner and the zone comparison are still mutually exclusive by construction,
   * only now as two sections of one tab rather than two competing overlays.
   */
  const [plannerRevision, setPlannerRevision] = useState(0);
  /** Which hub's zones «Viaje › Dónde dormir» is showing. `null` until the reader either opens
   * it from a city in Explorar (which sets this explicitly) or lands on it directly. */
  const [viajeZonesHub, setViajeZonesHub] = useState<string | null>(null);

  // ---- Nosotros ----
  /** Shown on the very first visit and reopenable from Nosotros; never blocks the app. */
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasSeenOnboarding());
  const travellerManagerSectionRef = useRef<HTMLDivElement>(null);

  const { importState, exportBackup, prepareImport, confirmImport, resetImport, finishRestore } =
    usePortableBackup();

  // Block 12. Runs once, after mount, and never blocks anything.
  useEffect(() => prefetchOnDemandSurfaces(), []);
  /**
   * Block 5 — `savedIds` is now DERIVED: a place is in the shared shortlist when at least one
   * traveller wants it. Everything downstream (the planner, the map, the saved list) keeps
   * receiving the same `string[]` it always did.
   *
   * `activeInterestedIds` is deliberately a different list: it is what the HEART means — this
   * reader's own answer — so a place only the other person saved never appears to you as already
   * hearted while the marker beside it says it is theirs.
   */
  const {
    travellers,
    activeTraveller,
    savedIds,
    activeInterestedIds,
    isWantedByActive,
    toggleSaved,
    removeSaved,
    setStance,
    activeStance,
    interestSummary,
    tally,
    setActiveTraveller,
    renameTraveller,
    resetTraveller,
    removeTraveller,
    addTraveller,
    placesOnlyWantedBy,
    divergenceFor,
  } = useTravellers();
  const { feedback, announce } = useSaveFeedback();
  const isDesktop = useIsDesktop();

  /** Block 5: the card marker, resolved per place and deliberately null most of the time — see
   * `lib/traveller-presentation.ts` for why silence is the default. */
  const markerFor = useCallback(
    (placeId: string) =>
      interestMarker(interestSummary(placeId), travellers, activeTraveller?.id ?? null),
    [interestSummary, travellers, activeTraveller]
  );

  /** Bloque 18, `04 §1`: `PersonToken` distingue a/b por orden de creación, no por el `id`
   * opaco del viajero. */
  const activeTravellerVariant: "a" | "b" =
    travellers.length > 0 && travellers[0]?.id === activeTraveller?.id ? "a" : "b";

  /** Exactly one of these is non-null; the union above makes the other state unreachable. */
  const activeHub = view.mode === "hub" ? view.hub : null;
  const nationalView = view.mode === "national" ? view : null;
  const hubPlaces = useMemo(
    () => (activeHub ? getPlacesByHub(activeHub) : EMPTY_PLACES),
    [activeHub]
  );

  const categories = useMemo(
    () => [...new Set(hubPlaces.map((p) => p.category))].sort((a, b) => a.localeCompare(b, "es")),
    [hubPlaces]
  );
  /** Editorial order, not alphabetical — and every grade the catalogue actually uses. Omitting
   * one would silently hide its places whenever the user ticks all the grades on offer, with no
   * way to filter to them: `matchesFilters` treats a non-empty `grades` list as exhaustive. */
  const grades = useMemo(
    () => ["S", "A", "B", "C", "D"].filter((g) => hubPlaces.some((p) => p.grade === g)),
    [hubPlaces]
  );
  const hiddenGemStatuses = useMemo(
    () => [...new Set(hubPlaces.map((p) => p.hiddenGemStatus).filter(Boolean))] as string[],
    [hubPlaces]
  );
  const tourismLevels = useMemo(
    () => ["Extremo", "Alto", "Medio", "Bajo"].filter((level) => hubPlaces.some((p) => p.tourismLevel === level)),
    [hubPlaces]
  );
  /** Blocks that would return results in the active hub, in taxonomy order. */
  const planningBlocks = useMemo(
    () => availablePlanningBlocks(hubPlaces.map((p) => p.duration)),
    [hubPlaces]
  );

  const selectedId = history.length > 0 ? history[history.length - 1] : null;
  const selectedPlace = selectedId ? getPlaceById(selectedId) ?? null : null;
  const previousId = history.length > 1 ? history[history.length - 2] : null;
  const previousPlace = previousId ? getPlaceById(previousId) ?? null : null;
  /**
   * Corrección post-cierre: `history`/`selectedPlace` ahora se comparten con Quiero ir (la
   * ficha puede pertenecer a cualquiera de los dos). `PlaceList`/`PlaceMap` sólo viven dentro
   * de Explorar y sólo deben reaccionar a una selección que sea suya — en particular, `PlaceMap`
   * calcula `panTo`/`fitBounds` sobre su contenedor Leaflet, que mide 0×0 mientras Explorar está
   * `hidden` (Quiero ir activo): pasarle un `selectedPlace` que no es el suyo reproduce el mismo
   * choque de `Invalid LatLng` que ya se corrigió una vez para la vista de mapa/lista.
   */
  const explorarSelectedId = ficheOrigin === "explorar" ? selectedId : null;
  const explorarSelectedPlace = ficheOrigin === "explorar" ? selectedPlace : null;

  const filteredPlaces = useMemo(
    () => hubPlaces.filter((place) => matchesFilters(place, filters)),
    [hubPlaces, filters]
  );

  const activeFilterCount = countActiveFilters(filters);

  /**
   * Bloque 18, corrección post-cierre (`04 §11`): "sobre papel es --surface con borde inferior
   * --line que sólo aparece al hacer scroll" — la cabecera llevaba el borde siempre. El scroll
   * real vive en un elemento distinto según el destino (`.app__sidebar`/`.national__sidebar`
   * dentro de Explorar, `.destination-panel--scroll` en las otras tres pestañas); en vez de
   * cablear un listener por superficie, se escucha `scroll` en fase de captura desde `document`
   * — el evento no burbujea, pero sí se puede capturar en un ancestro — filtrando por esas tres
   * clases, y se resincroniza al cambiar de destino/hub para que un cambio de pestaña sin
   * scroll de por medio no arrastre el borde del destino anterior.
   */
  const [headerScrolled, setHeaderScrolled] = useState(false);
  useEffect(() => {
    const OWNER_SELECTOR = ".app__sidebar, .national__sidebar, .destination-panel--scroll";
    function sync() {
      const owner = document.querySelector<HTMLElement>(
        `.destination-panel:not([hidden]) ${OWNER_SELECTOR}`
      );
      setHeaderScrolled(Boolean(owner && owner.scrollTop > 0));
    }
    sync();
    function onScroll(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(OWNER_SELECTOR)) return;
      setHeaderScrolled(target.scrollTop > 0);
    }
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [destination, activeHub]);

  /**
   * The one save entry point every surface goes through — card, detail panel, saved list — so
   * the confirmation is guaranteed to match what actually happened to the stored state rather
   * than what the pressed control assumed. `useSavedPlaces` keeps owning persistence; this only
   * adds the announcement.
   */
  const toggleSavedWithFeedback = useCallback(
    (id: string) => {
      const place = getPlaceById(id);
      // The reader's OWN interest decides the wording: "quitado" must mean they withdrew theirs,
      // not that the place left the shared list — it may well stay, because the other person
      // still wants it.
      const wasWanted = isWantedByActive(id);
      toggleSaved(id);
      if (!place) return;
      announce(
        wasWanted ? `Quitado de Quiero ir: ${place.name}` : `Guardado en Quiero ir: ${place.name}`,
        wasWanted ? "removed" : "saved"
      );
    },
    [announce, isWantedByActive, toggleSaved]
  );

  const removeSavedWithFeedback = useCallback(
    (id: string) => {
      const place = getPlaceById(id);
      removeSaved(id);
      if (place) announce(`Quitado de Quiero ir: ${place.name}`, "removed");
    },
    [announce, removeSaved]
  );

  /**
   * Block 6 — which shortlisted places the planner has already put in a day, and the derived
   * grouping the saved list filters by.
   *
   * Both are READS. `plannedPlaceIds` never writes the draft, `divergence` never writes anything
   * at all, and neither can move, remove or reschedule a place: the flag they carry is shown as
   * information beside a place whose interest is one-sided, and that is the whole of it.
   */
  const plannedPlaceIds = usePlannedPlaceIds(savedIds, plannerRevision);
  const divergence = useMemo(
    () => divergenceFor(plannedPlaceIds),
    [divergenceFor, plannedPlaceIds]
  );

  /** Resolved against the global dataset, so a saved place survives navigation to any hub. */
  const savedPlaces = useMemo(
    () => savedIds.map((id) => getPlaceById(id)).filter((place): place is Place => Boolean(place)),
    [savedIds]
  );

  /**
   * Corrección final (punto 4): puente entre la profundidad de la pila de fichas (`history`,
   * ya existente) y el historial real del navegador — chevron back, gesto back de iOS y
   * `page.goBack()` deben recorrer la misma pila. No se introduce React Router ni se cambia la
   * URL pública (05/02 no la piden): cada entrada llevan sólo un `state` con la profundidad.
   *
   * `navDepthRef` es cuántas entradas de `window.history` hemos empujado nosotros para la ficha
   * abierta ahora mismo; `ignorePopRef` cuenta los `popstate` que vamos a provocar nosotros
   * mismos (`history.back()`/`history.go()` desde una acción explícita de la UI) para no
   * volver a aplicar el mismo cambio de estado una segunda vez cuando el evento llega. Los
   * `Ref` espejo (`historyRef`/`ficheOriginRef`/`activeHubRef`) existen porque el listener de
   * `popstate` se registra una sola vez (`[]`) y necesita leer el valor más reciente sin
   * volver a suscribirse en cada render.
   */
  const navDepthRef = useRef(0);
  const ignorePopRef = useRef(0);
  const historyRef = useRef<string[]>(history);
  const ficheOriginRef = useRef<Destination | null>(ficheOrigin);
  const activeHubRef = useRef<string | null>(activeHub);
  // Sincronizados tras cada commit, nunca durante el render (los refs no deben leerse ni
  // escribirse mientras React está renderizando) — sólo se leen desde manejadores de eventos y
  // desde el listener de `popstate`, que siempre corren después de un render ya confirmado.
  useEffect(() => {
    historyRef.current = history;
    ficheOriginRef.current = ficheOrigin;
    activeHubRef.current = activeHub;
  });

  /** Misma restauración de hub que `goBack` ya hacía, factorizada para que el handler de
   * `popstate` (un back real de navegador/gesto, no un clic en la app) pueda reproducirla. */
  const restoreViewForTrail = useCallback((trail: string[]) => {
    if (ficheOriginRef.current !== "explorar") return;
    const nextId = trail[trail.length - 1];
    const nextPlace = nextId ? getPlaceById(nextId) : undefined;
    if (nextPlace && nextPlace.hub !== activeHubRef.current) {
      setView({ mode: "hub", hub: nextPlace.hub });
    }
  }, []);

  const syncNavPush = useCallback((depth: number) => {
    window.history.pushState({ nihonPlaceDepth: depth }, "");
    navDepthRef.current = depth;
  }, []);
  const syncNavReplace = useCallback((depth: number) => {
    window.history.replaceState({ nihonPlaceDepth: depth }, "");
    navDepthRef.current = depth;
  }, []);

  /** A real browser/gesture back (or forward) — never fired by our own `goBack`/`closeDetail`,
   * which pre-apply the same state change and set `ignorePopRef` so this is a no-op for them. */
  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      if (ignorePopRef.current > 0) {
        ignorePopRef.current -= 1;
        return;
      }
      const state = event.state as { nihonPlaceDepth?: number } | null;
      const targetDepth = Math.max(0, state?.nihonPlaceDepth ?? 0);
      navDepthRef.current = targetDepth;
      if (targetDepth <= 0) {
        setHistory([]);
        setFicheOrigin(null);
        setFicheOriginLabel(null);
        return;
      }
      const next = historyRef.current.slice(0, targetDepth);
      restoreViewForTrail(next);
      setHistory(next);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [restoreViewForTrail]);

  /**
   * Single source of truth for "go look at this place": starts a fresh trail and closes the
   * mobile filter sheet. `origin` is which destination the ficha belongs to, and it is the
   * corrected reading of `02 §D2`/`02 §D3` and the explicit "Quiero ir └── Lugar · misma ficha
   * que en Explorar" line: opening a place is depth WITHIN the destination that opened it, not
   * a navigation to Explorar.
   *
   * Only when `origin === "explorar"` (the default, and every Explorar-internal call site —
   * `PlaceList`, `PlaceMap`, the city sheet's "Dónde dormir" flow) does this also switch the
   * active hub/destination: that is the one case where the ficha shares the screen with a
   * list/map that must stay in sync (a cross-hub "nearby" jump has somewhere else to show).
   * `origin="quiero-ir"` (SelectionPanel/SelectionAnalysis) never touches `view`/`filters`/
   * `destination` — Explorar's own state is a different destination's business.
   *
   * Corrección final (`docs/BLOCK_18_HANDOFF.md §"DESIGN DECISION REQUIRED"`, resuelto): la
   * decisión normativa ya no deja `origin="viaje"` en el valor por defecto. Cualquier enlace a
   * un lugar apila la ficha dentro de la pestaña activa, sin excepciones (`02 §D3`) — Viaje
   * (hoy sólo desde `ZoneComparison`/«Dónde dormir») recibe exactamente el mismo trato que
   * Quiero ir: `origin="viaje"` no toca `view`/`filters`/`destination`, y la única forma de que
   * un lugar abierto desde Viaje llegue a Explorar es la acción explícita y etiquetada «Ver en
   * el mapa» (`viewOnMap`, más abajo), nunca un efecto secundario de abrir la ficha.
   *
   * `originLabel` es el nombre visible de la superficie que abrió la ficha — hoy sólo relevante
   * para Viaje, que puede tener más de una superficie que abra lugares (`ficheOrigin` por sí
   * solo no basta para el back label); Explorar/Quiero ir siguen sin necesitarlo.
   */
  const selectPlace = useCallback(
    (id: string, origin: Destination = "explorar", originLabel: string | null = null) => {
      const place = getPlaceById(id);
      if (!place) return;
      if (origin === "explorar") {
        if (place.hub !== activeHub) {
          setView({ mode: "hub", hub: place.hub });
          setFilters(EMPTY_FILTERS);
        }
        setDestination("explorar");
      }
      setHistory([id]);
      setFiltersOpen(false);
      setFicheOrigin(origin);
      setFicheOriginLabel(originLabel);
      // Corrección final (punto 4): abrir una ficha desde cero empuja una entrada de
      // historial; reemplazar qué lugar se ve mientras una ficha ya está abierta (p. ej. tocar
      // otra tarjeta de la lista sin haber cerrado la anterior) no crece la pila — sigue siendo
      // un único nivel de profundidad.
      if (navDepthRef.current === 0) syncNavPush(1);
      else syncNavReplace(1);
    },
    [activeHub, syncNavPush, syncNavReplace]
  );

  /** A nearby jump extends the trail so the user can return to where they came from. Filters
   * are left as-is: the destination marker always renders regardless of filter match (see
   * PlaceMap's visiblePlaces), so there is nothing to reconcile. Only touches Explorar's own
   * hub/view when the open ficha actually belongs to Explorar — a nearby jump from a ficha
   * opened out of Quiero ir must not silently move Explorar to a different city in the
   * background (`02 §D3`: every destination's state is its own). */
  const pushPlace = useCallback(
    (id: string) => {
      const place = getPlaceById(id);
      if (!place) return;
      if (historyRef.current[historyRef.current.length - 1] === id) return;
      if (ficheOrigin === "explorar" && place.hub !== activeHub) {
        setView({ mode: "hub", hub: place.hub });
      }
      const next = [...historyRef.current, id];
      setHistory(next);
      syncNavPush(next.length);
    },
    [activeHub, ficheOrigin, syncNavPush]
  );

  /** Steps back through the trail, restoring whichever hub the previous place belongs to — but
   * only when the ficha's own destination is Explorar; see `pushPlace`. Also the chevron/UI
   * "back": it moves the real browser history back by one entry (`ignorePopRef` guards against
   * re-applying the same change when the resulting `popstate` lands, corrección final punto 4). */
  const goBack = useCallback(() => {
    const next = historyRef.current.slice(0, -1);
    const nextId = next[next.length - 1];
    const nextPlace = nextId ? getPlaceById(nextId) : undefined;
    if (ficheOrigin === "explorar" && nextPlace && nextPlace.hub !== activeHub) {
      setView({ mode: "hub", hub: nextPlace.hub });
    }
    setHistory(next);
    if (navDepthRef.current > 0) {
      ignorePopRef.current += 1;
      window.history.back();
      navDepthRef.current -= 1;
    }
  }, [activeHub, ficheOrigin]);

  /** The analysis is a lens over the saved places, not a second navigation: opening a place
   * from it goes through the same selectPlace every other surface uses, tagged as belonging to
   * Quiero ir since that is where `SelectionAnalysis` only ever renders (embedded there). */
  const closeAnalysis = useCallback(() => setAnalysisVisible(false), []);
  const openFromAnalysis = useCallback(
    (id: string) => {
      selectPlace(id, "quiero-ir");
    },
    [selectPlace]
  );

  /** Closes the ficha entirely — chevron/`×` at the base of the stack, or a real browser back
   * past the last level. Pops however many entries this stack pushed in one go (`history.go`
   * fires a single `popstate` at its destination, not one per entry, corrección final punto 4),
   * so the browser's own stack never grows out of sync with `history.length`. */
  const closeDetail = useCallback(() => {
    setHistory([]);
    setFicheOrigin(null);
    setFicheOriginLabel(null);
    if (navDepthRef.current > 0) {
      ignorePopRef.current += 1;
      window.history.go(-navDepthRef.current);
      navDepthRef.current = 0;
    }
  }, []);

  /**
   * «Ver en el mapa» (punto 3): la única acción, desde una ficha de Viaje, autorizada a cambiar
   * de contexto. Reutiliza `selectPlace` con `origin="explorar"` en vez de reimplementar su
   * lógica: eso ya hace exactamente lo que pide la decisión — sustituye (no apila) la profundidad
   * de Viaje por una única ficha bajo Explorar (nunca deja una segunda ficha fantasma), mueve
   * `destination` a Explorar y centra/abre el lugar en su mapa (`explorarSelectedPlace`, ya
   * consumido por `PlaceMap`). `ZoneComparison` (o cualquier otra superficie de Viaje) no se
   * toca: sigue montada de fondo, así que al volver manualmente a Viaje su estado sigue intacto.
   */
  const viewOnMap = useCallback(() => {
    if (!selectedPlace) return;
    selectPlace(selectedPlace.id, "explorar");
  }, [selectedPlace, selectPlace]);
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  /**
   * Bloque 18 (`02 §D2`, gate 11) — el planificador y la comparación de zonas dejan de ser
   * overlays globales mutuamente excluyentes y pasan a ser las dos secciones, también
   * mutuamente excluyentes, de la pestaña «Viaje».
   *
   * La invariante del Bloque 4 se conserva exactamente: los dos escriben el mismo borrador bajo
   * `nihon.manualPlanningDraft`, así que sigue sin haber más de un escritor a la vez — ahora
   * porque sólo una sección puede estar activa, no porque cerrar una abra la otra.
   */
  const goToPlanner = useCallback(() => {
    setDestination("viaje");
    setViajeSection("planificar");
  }, []);

  const goToZones = useCallback((hub: string) => {
    setViajeZonesHub(hub);
    setDestination("viaje");
    setViajeSection("dormir");
    setCitySheetOpen(false);
  }, []);

  /** Leaving «Planificar» is when its day assignment is final, so that is when Block 6's
   * read-only snapshot of it is refreshed — same signal as the old `onClose`, triggered by the
   * section switch instead of a modal close. */
  const setViajeSectionTracked = useCallback((section: ViajeSection) => {
    setViajeSection((current) => {
      if (current === "planificar" && section !== "planificar") {
        setPlannerRevision((revision) => revision + 1);
      }
      return section;
    });
  }, []);

  /** Manually switching hubs resets filters and closes any open detail from the previous
   * hub — the policy is deliberately different from pushPlace/goBack, which preserve both. */
  const switchHub = useCallback(
    (hub: string) => {
      setCitySheetOpen(false);
      if (hub === activeHub) return;
      setView({ mode: "hub", hub });
      setFilters(EMPTY_FILTERS);
      setHistory((trail) => {
        const openId = trail[trail.length - 1];
        const openPlace = openId ? getPlaceById(openId) : undefined;
        return openPlace && openPlace.hub !== hub ? [] : trail;
      });
    },
    [activeHub]
  );

  /**
   * National Explorer → Hub Explorer. Reuses the same primitives as a manual hub switch:
   * fresh filters, no leftover detail from a previous visit, and PlaceMap fits the hub's
   * bounds exactly as it does in the flat hub navigation.
   */
  const enterHub = useCallback((hub: string) => {
    setView({ mode: "hub", hub });
    setFilters(EMPTY_FILTERS);
    setHistory([]);
    setFiltersOpen(false);
    setMobilePane("list");
  }, []);

  /** Hub Explorer → National Explorer. Saved places are untouched; the trail is dropped so
   * no detail drawer is left floating over the national map. */
  const returnToJapan = useCallback(() => {
    setView(INITIAL_VIEW);
    setFilters(EMPTY_FILTERS);
    setHistory([]);
    setFiltersOpen(false);
    setCitySheetOpen(false);
    setMobilePane("list");
  }, []);

  const selectRegion = useCallback((region: NavigationRegion | null) => {
    setView((current) =>
      current.mode === "national" ? { mode: "national", region, prefectureCode: null } : current
    );
  }, []);

  /**
   * Selecting a prefecture also moves the view into that prefecture's own region, so the
   * map viewport, the region list and the panel always describe the same place — picking a
   * polygon from a neighbouring region on the map cannot leave the two disagreeing.
   * Clearing the selection keeps the region the user is browsing.
   */
  const selectPrefecture = useCallback((code: string | null) => {
    setView((current) => {
      if (current.mode !== "national") return current;
      if (!code) return { ...current, prefectureCode: null };
      const prefecture = getPrefectureByCode(code);
      if (!prefecture) return current;
      return { mode: "national", region: prefecture.region, prefectureCode: code };
    });
  }, []);

  useEffect(() => {
    if (!filtersOpen && !citySheetOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFiltersOpen(false);
        setCitySheetOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtersOpen, citySheetOpen]);

  const wantToGoCount = savedIds.length;
  const zonesHub =
    viajeZonesHub && HUBS_WITH_ZONES.includes(viajeZonesHub)
      ? viajeZonesHub
      : activeHub && HUBS_WITH_ZONES.includes(activeHub)
        ? activeHub
        : HUBS_WITH_ZONES[0] ?? null;

  const explorerList = (
    <PlaceList
      places={filteredPlaces}
      totalCount={hubPlaces.length}
      selectedId={explorarSelectedId}
      savedIds={activeInterestedIds}
      interestMarkerFor={markerFor}
      onSelect={selectPlace}
      onToggleSaved={toggleSavedWithFeedback}
      onClearFilters={resetFilters}
      hasActiveFilters={activeFilterCount > 0}
      query={filters.query}
    />
  );

  /**
   * Bloque 18, corrección post-cierre: una única construcción de la ficha (mismo componente,
   * misma prop list — cero lógica ni contenido duplicado), colocada en exactamente uno de los
   * paneles de destino según `ficheOrigin` (ahora también `"viaje"`, corrección final). Nunca se
   * renderiza en dos sitios a la vez porque `ficheOrigin` sólo puede valer una cosa.
   *
   * `originLabel`/`onViewOnMap` sólo se pasan cuando la ficha pertenece a Viaje: es la única de
   * las tres pestañas que necesita nombrar su superficie de origen en el back (`ficheOrigin` no
   * distingue entre las superficies de Viaje que puedan abrir lugares) y ofrecer la salida
   * explícita «Ver en el mapa» — Explorar ya está en su propio mapa, y Quiero ir no gana esta
   * acción con esta corrección (no está en la decisión de diseño).
   */
  const placeDetailOverlay = selectedPlace ? (
    <div className="app__detail">
      <PlaceDetail
        place={selectedPlace}
        isSaved={isWantedByActive(selectedPlace.id)}
        travellers={travellers}
        interestSummary={interestSummary(selectedPlace.id)}
        activeStance={activeStance(selectedPlace.id)}
        onSetStance={setStance}
        onToggleSaved={toggleSavedWithFeedback}
        onClose={closeDetail}
        nearby={getNearby(selectedPlace.id)}
        onSelectNearby={pushPlace}
        getPlace={getPlaceById}
        previousPlace={previousPlace}
        onBack={goBack}
        originLabel={ficheOrigin === "viaje" ? ficheOriginLabel : null}
        onViewOnMap={ficheOrigin === "viaje" ? viewOnMap : undefined}
      />
    </div>
  ) : null;

  return (
    <div className="app">
      <NavRail active={destination} onSelect={setDestination} wantToGoCount={wantToGoCount} />

      <div className="app__main">
        <header className={`app__header ${headerScrolled ? "app__header--scrolled" : ""}`}>
          <div className="app__brand">
            {destination === "explorar" && activeHub ? (
              <button
                type="button"
                className="app__title app__title--expand"
                onClick={() => setCitySheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={citySheetOpen}
              >
                <Icon name="atras" size={16} className="app__title-back" aria-hidden="true" />
                <span className="app__title-text">{activeHub}</span>
                <Icon name="abajo" size={16} aria-hidden="true" />
              </button>
            ) : (
              <h1 className="app__title">{destinationLabel(destination)}</h1>
            )}
          </div>
          <div className="app__header-actions">
            {/* DD-007, `02 §D4`: tocar el token lleva a Nosotros › Viajeros, que es la
                primera sección de esa pestaña — sin necesidad de scroll adicional. */}
            <button
              type="button"
              className="app__person-token-button"
              onClick={() => setDestination("nosotros")}
              aria-label={
                activeTraveller
                  ? `Eres ${activeTraveller.label}. Ir a Nosotros y Viajeros`
                  : "Ir a Nosotros y Viajeros"
              }
              title="Ir a Nosotros y Viajeros"
            >
              <PersonToken
                traveller={activeTraveller ?? null}
                variant={activeTravellerVariant}
                size="sm"
                className="app__person-token"
              />
            </button>
          </div>
        </header>

        <div className="app__content">
          {/* ---------------- Explorar ---------------- */}
          <div className="destination-panel" hidden={destination !== "explorar"}>
            {activeHub ? (
              <>
                <div className="explorer-bar">
                  <div className="search-field explorer-bar__search">
                    <span className="search-field__icon" aria-hidden="true">
                      <Icon name="buscar" size={16} />
                    </span>
                    <input
                      type="search"
                      className="search-field__input"
                      placeholder={`Buscar en ${activeHub}`}
                      value={filters.query}
                      onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                      autoComplete="off"
                    />
                    {filters.query && (
                      <button
                        type="button"
                        className="search-field__clear tap-target-min"
                        onClick={() => setFilters({ ...filters, query: "" })}
                        aria-label="Borrar búsqueda"
                        title="Borrar búsqueda"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="explorer-bar__filters"
                    onClick={() => setFiltersOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={filtersOpen}
                  >
                    <Icon name="filtro" size={16} /> Filtros
                    {activeFilterCount > 0 && (
                      <span className="app__filter-badge">{activeFilterCount}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="explorer-bar__pane"
                    onClick={() => setMobilePane((pane) => (pane === "list" ? "map" : "list"))}
                    aria-pressed={mobilePane === "map"}
                  >
                    <Icon name={mobilePane === "list" ? "mapa" : "lista"} size={16} />
                    {mobilePane === "list" ? "Mapa" : "Lista"}
                  </button>
                </div>

                {filtersOpen && (
                  <Sheet title="Búsqueda y filtros" onClose={() => setFiltersOpen(false)}>
                    <FilterPanel
                      filters={filters}
                      onChange={setFilters}
                      categories={categories}
                      grades={grades}
                      planningBlocks={planningBlocks}
                      hiddenGemStatuses={hiddenGemStatuses}
                      tourismLevels={tourismLevels}
                      resultCount={filteredPlaces.length}
                      totalCount={hubPlaces.length}
                      activeFilterCount={activeFilterCount}
                      onReset={resetFilters}
                      defaultGroupsOpen
                      showSearch={false}
                    />
                  </Sheet>
                )}

                {citySheetOpen && (
                  <Sheet title="Elegir ciudad" onClose={() => setCitySheetOpen(false)}>
                    <div className="city-sheet">
                      <button
                        type="button"
                        className="city-sheet__japan"
                        onClick={returnToJapan}
                      >
                        <Icon name="atras" size={16} /> Ver todo Japón
                      </button>
                      <HubSelector hubs={HUBS} activeHub={activeHub} onSelect={switchHub} />
                      {HUBS_WITH_ZONES.includes(activeHub) && (
                        <button
                          type="button"
                          className="city-sheet__zones"
                          onClick={() => goToZones(activeHub)}
                        >
                          <Icon name="cama" size={20} /> Dónde dormir en {activeHub}
                        </button>
                      )}
                    </div>
                  </Sheet>
                )}

                <div
                  className={`app__body app__body--pane-${mobilePane}`}
                  id="app-hub-panel"
                  aria-label={`Lugares de ${activeHub}`}
                >
                  <aside className="app__sidebar" aria-label="Explorar lugares">
                    {explorerList}
                  </aside>

                  <main className="app__map-area">
                    <PlaceMap
                      places={filteredPlaces}
                      hubPlaces={hubPlaces}
                      activeHub={activeHub}
                      selectedPlace={explorarSelectedPlace}
                      savedIds={savedIds}
                      onSelect={selectPlace}
                      panelOffset={isDesktop && explorarSelectedPlace ? DETAIL_PANEL_WIDTH : 0}
                    />
                    <InterestLegend />
                    {filteredPlaces.length === 0 && (
                      <div className="map-empty" role="status">
                        <p className="map-empty__title">
                          <Icon name="buscar" size={20} /> Ningún lugar coincide con los filtros
                        </p>
                        <p className="map-empty__hint">
                          Los {hubPlaces.length} lugares de esta zona siguen ahí; solo están
                          filtrados.
                        </p>
                        <button type="button" className="button button--secondary" onClick={resetFilters}>
                          Limpiar búsqueda y filtros
                        </button>
                      </div>
                    )}
                  </main>

                  {ficheOrigin === "explorar" && placeDetailOverlay}
                </div>
              </>
            ) : (
              nationalView && (
                <div className="app__body app__body--national">
                  <NationalExplorer
                    activeRegion={nationalView.region}
                    selectedCode={nationalView.prefectureCode}
                    onSelectRegion={selectRegion}
                    onSelectPrefecture={selectPrefecture}
                    onEnterHub={enterHub}
                  />
                </div>
              )
            )}
          </div>

          {/*
            ---------------- Quiero ir ----------------
            Bloque 18, corrección post-cierre (`02 §D2`/§D3): la ficha abierta desde aquí ("misma
            ficha que en Explorar") se apila DENTRO de esta pestaña, no navega a Explorar. Por eso
            el contenido que scrollea vive en un `div` interior separado del contenedor de
            destino: la ficha (`ficheOrigin === "quiero-ir"`) se ancla al contenedor exterior, que
            no scrollea, en vez de al interior — si se ancla al que hace scroll, un panel de
            480px en escritorio se desplazaría con la lista en vez de quedarse fijo.
          */}
          <div className="destination-panel" hidden={destination !== "quiero-ir"}>
            <div className="destination-panel--scroll">
              <SelectionPanel
                savedPlaces={savedPlaces}
                onRemove={removeSavedWithFeedback}
                onSelect={(id) => selectPlace(id, "quiero-ir")}
                open={selectionOpen}
                onToggle={() => setSelectionOpen((open) => !open)}
                onAnalyze={() => setAnalysisVisible((open) => !open)}
                onBuildSequence={goToPlanner}
                tally={tally}
                interestMarkerFor={markerFor}
                activeTravellerLabel={activeTraveller?.label ?? null}
                divergence={divergence}
                travellers={travellers}
                activeTravellerId={activeTraveller?.id ?? null}
              />
              {analysisVisible && (
                <SelectionAnalysis
                  savedPlaces={savedPlaces}
                  onSelectPlace={openFromAnalysis}
                  onClose={closeAnalysis}
                  embedded
                />
              )}
            </div>
            {ficheOrigin === "quiero-ir" && placeDetailOverlay}
          </div>

          {/*
            ---------------- Viaje ----------------
            Corrección final (punto 1, DESIGN DECISION REQUIRED resuelto): un lugar abierto
            desde Viaje ("Dónde dormir" → `ZoneComparison`) apila la misma ficha dentro de esta
            pestaña — ya no navega a Explorar. Misma técnica que la corrección de Quiero ir: el
            contenido que scrollea (sub-navegación + secciones) vive en un `div` interior
            separado del `.destination-panel` exterior, para que la ficha (`ficheOrigin ===
            "viaje"`), hermana suya anclada al exterior, no scrollee con «Dónde dormir»/
            «Planificar» ni se desplace en el panel de 480px de escritorio.
          */}
          <div className="destination-panel" hidden={destination !== "viaje"}>
            <div className="destination-panel--scroll">
              <div className="viaje-nav" role="group" aria-label="Secciones de Viaje">
                <button
                  type="button"
                  className={`viaje-nav__item ${viajeSection === "planificar" ? "viaje-nav__item--active" : ""}`}
                  aria-pressed={viajeSection === "planificar"}
                  onClick={() => setViajeSectionTracked("planificar")}
                >
                  <Icon name="explorar" size={16} /> Planificar
                </button>
                <button
                  type="button"
                  className={`viaje-nav__item ${viajeSection === "dormir" ? "viaje-nav__item--active" : ""}`}
                  aria-pressed={viajeSection === "dormir"}
                  onClick={() => setViajeSectionTracked("dormir")}
                  disabled={HUBS_WITH_ZONES.length === 0}
                >
                  <Icon name="cama" size={16} /> Dónde dormir
                </button>
              </div>

              <Suspense fallback={null}>
                {viajeVisited && viajeSection === "planificar" && (
                  <OrderedSequenceBuilder
                    savedPlaces={savedPlaces}
                    onClose={() => setViajeSectionTracked("dormir")}
                    embedded
                  />
                )}
              </Suspense>

              <Suspense fallback={null}>
                {viajeVisited && viajeSection === "dormir" && zonesHub && (
                  <ZoneComparison
                    hub={zonesHub}
                    savedPlaces={savedPlaces}
                    onClose={() => setViajeSectionTracked("planificar")}
                    onSelectPlace={(id) => selectPlace(id, "viaje", "Dónde dormir")}
                    onOpenPlanner={goToPlanner}
                    embedded
                  />
                )}
              </Suspense>
            </div>

            {ficheOrigin === "viaje" && placeDetailOverlay}
          </div>

          {/* ---------------- Nosotros ---------------- */}
          <div className="destination-panel destination-panel--scroll" hidden={destination !== "nosotros"}>
            <section className="nosotros-section" aria-label="Viajeros" ref={travellerManagerSectionRef}>
              <h2 className="nosotros-section__title">Viajeros</h2>
              <TravellerBar
                travellers={travellers}
                activeTravellerId={activeTraveller?.id ?? null}
                onSelect={setActiveTraveller}
                onManage={() =>
                  travellerManagerSectionRef.current?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <TravellerManager
                travellers={travellers}
                activeTravellerId={activeTraveller?.id ?? null}
                placesOnlyWantedBy={placesOnlyWantedBy}
                onRename={renameTraveller}
                onReset={resetTraveller}
                onRemove={removeTraveller}
                onAdd={addTraveller}
                onClose={() => {}}
                embedded
              />
            </section>

            <section className="nosotros-section" aria-label="Copia del viaje">
              <h2 className="nosotros-section__title">Copia del viaje</h2>
              <TripBackup
                importState={importState}
                onExport={exportBackup}
                onChooseFile={prepareImport}
                onConfirm={(preview) => confirmImport(preview.plan)}
                onReset={resetImport}
                onFinishRestore={finishRestore}
                onClose={() => {}}
                embedded
              />
            </section>

            <section className="nosotros-section" aria-label="Cómo funciona Nihon">
              <h2 className="nosotros-section__title">Cómo funciona Nihon</h2>
              <p className="nosotros-section__text">
                Vuelve a ver la explicación de qué es Nihon y cómo marcar lo que os gustaría ver.
              </p>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setOnboardingOpen(true)}
              >
                Ver de nuevo
              </button>
            </section>

            <section className="nosotros-section" aria-label="Fuentes y licencias">
              <h2 className="nosotros-section__title">Fuentes y licencias</h2>
              <MlitAttribution className="nosotros-section__text" />
              <p className="nosotros-section__text">
                {NATIONAL_SUMMARY.placeCount} lugares · {NATIONAL_SUMMARY.coveredPrefectureCount} de{" "}
                {NATIONAL_SUMMARY.prefectureCount} prefecturas con lugares verificados.
              </p>
            </section>
          </div>
        </div>

        <TabBar active={destination} onSelect={setDestination} wantToGoCount={wantToGoCount} />
      </div>

      <SaveToast feedback={feedback} />

      {onboardingOpen && <Onboarding onClose={() => setOnboardingOpen(false)} />}
    </div>
  );
}
