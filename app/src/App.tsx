import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
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
 * Everything else stays in the entry chunk on purpose. The national map is the *first* thing Nihon
 * renders, so Leaflet is critical path and splitting it would trade a real first paint for a
 * cosmetic number. `SelectionAnalysis` and `TravellerManager` own 14 kB and 9 kB — a chunk each
 * would buy a round trip and save nothing worth having.
 *
 * `prefetchOnDemandSurfaces` below removes the cost this would otherwise have: the two chunks are
 * fetched once the browser is idle after first paint, so by the time a click is possible they are
 * already in the HTTP cache. The split moves bytes off the critical path without moving the wait
 * to the user.
 */
const loadOrderedSequenceBuilder = () =>
  import("./components/OrderedSequenceBuilder").then((m) => ({ default: m.OrderedSequenceBuilder }));
const loadZoneComparison = () =>
  import("./components/ZoneComparison").then((m) => ({ default: m.ZoneComparison }));

const OrderedSequenceBuilder = lazy(loadOrderedSequenceBuilder);
const ZoneComparison = lazy(loadZoneComparison);

const HUBS = getHubs();
/** Hubs where Block 3 modelled accommodation zones; the others offer no comparison. */
const HUBS_WITH_ZONES = new Set(hubsWithZones());
const NATIONAL_SUMMARY = getNationalSummary();

/**
 * The single piece of state that decides what the application is showing.
 *
 * A discriminated union rather than a handful of booleans: "national" carries the region and
 * prefecture currently being browsed, "hub" carries the active hub, and no contradictory
 * combination of the two can exist. The app opens on the national view — the first contact
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

/** Width of the desktop detail panel; used to keep the focused marker out from under it. */
const DETAIL_PANEL_WIDTH = 420;
const DESKTOP_QUERY = "(min-width: 861px)";

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
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** Trail of visited places (any hub), so "nearby" jumps and cross-hub opens can be
   * stepped back through. */
  const [history, setHistory] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Phones show one hub surface at a time; the cards come first. */
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [sequenceBuilderOpen, setSequenceBuilderOpen] = useState(false);
  /**
   * Block 6 — bumped when the planner closes, which is the moment its draft has settled.
   *
   * It is a cache key for a READ, not a copy of anything: see `usePlannedPlaceIds`. Block 4 made
   * "one live writer at a time" structural by keeping the planner and the zone comparison mutually
   * exclusive, and this leans on exactly that rather than adding a subscription.
   */
  const [plannerRevision, setPlannerRevision] = useState(0);
  const [zonesOpen, setZonesOpen] = useState(false);
  /** Shown on the very first visit and reopenable from the header; never blocks the app. */
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasSeenOnboarding());
  const [travellerManagerOpen, setTravellerManagerOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
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

  const filteredPlaces = useMemo(
    () => hubPlaces.filter((place) => matchesFilters(place, filters)),
    [hubPlaces, filters]
  );

  const activeFilterCount = countActiveFilters(filters);

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
   * Single source of truth for "go look at this place": moves into the Hub Explorer on the
   * hub the place belongs to — from another hub or straight from the national map — starts a
   * fresh trail, and closes the mobile filter sheet. Used by the place list, the map and the
   * saved-places panel, any of which can point at a place outside the current view.
   */
  const selectPlace = useCallback(
    (id: string) => {
      const place = getPlaceById(id);
      if (!place) return;
      if (place.hub !== activeHub) {
        setView({ mode: "hub", hub: place.hub });
        setFilters(EMPTY_FILTERS);
      }
      setHistory([id]);
      setFiltersOpen(false);
    },
    [activeHub]
  );

  /** A nearby jump extends the trail so the user can return to where they came from. Filters
   * are left as-is: the destination marker always renders regardless of filter match (see
   * PlaceMap's visiblePlaces), so there is nothing to reconcile. */
  const pushPlace = useCallback(
    (id: string) => {
      const place = getPlaceById(id);
      if (!place) return;
      if (place.hub !== activeHub) setView({ mode: "hub", hub: place.hub });
      setHistory((trail) => (trail[trail.length - 1] === id ? trail : [...trail, id]));
    },
    [activeHub]
  );

  /** Steps back through the trail, restoring whichever hub the previous place belongs to. */
  const goBack = useCallback(() => {
    const next = history.slice(0, -1);
    const nextId = next[next.length - 1];
    const nextPlace = nextId ? getPlaceById(nextId) : undefined;
    if (nextPlace && nextPlace.hub !== activeHub) setView({ mode: "hub", hub: nextPlace.hub });
    setHistory(next);
  }, [history, activeHub]);

  /** The analysis is a lens over the saved places, not a second navigation: opening a place
   * from it goes through the same selectPlace every other surface uses. */
  const closeAnalysis = useCallback(() => setAnalysisOpen(false), []);
  const openFromAnalysis = useCallback(
    (id: string) => {
      selectPlace(id);
      setAnalysisOpen(false);
    },
    [selectPlace]
  );

  const closeDetail = useCallback(() => setHistory([]), []);
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  /**
   * Block 4 — the zone comparison and the planner are mutually exclusive, and that is load-bearing
   * rather than cosmetic.
   *
   * Both surfaces write the SAME planning draft under `nihon.manualPlanningDraft`: the planner
   * through `usePlanningDraft`, which holds it in React state for as long as it is mounted, and the
   * comparison through `useZonePlanChoice`, which read-modify-writes storage directly. Two live
   * writers could overwrite each other's work, so there is never more than one: opening either
   * closes the other. The planner's long-standing "a fresh mount is exactly the builder opening"
   * lifecycle then guarantees it loads whatever the comparison just wrote.
   *
   * It is also simply the right flow. Choosing a zone and then opening the planner is one
   * continuous movement — comparar → elegir → planificar — not two panels fighting for the screen,
   * and it needs no new modal to express.
   */
  const openZones = useCallback(() => {
    setSequenceBuilderOpen(false);
    setZonesOpen(true);
  }, []);

  const openSequenceBuilder = useCallback(() => {
    setZonesOpen(false);
    setSequenceBuilderOpen(true);
  }, []);

  /** Closing the planner is when its day assignment is final, so that is when Block 6's read-only
   * snapshot of it is refreshed. Nothing is written here. */
  const closeSequenceBuilder = useCallback(() => {
    setSequenceBuilderOpen(false);
    setPlannerRevision((revision) => revision + 1);
  }, []);

  /** Manually switching hubs resets filters and closes any open detail from the previous
   * hub — the policy is deliberately different from pushPlace/goBack, which preserve both. */
  const switchHub = useCallback(
    (hub: string) => {
      if (hub === activeHub) return;
      setView({ mode: "hub", hub });
      setZonesOpen(false);
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
    setZonesOpen(false);
    setFilters(EMPTY_FILTERS);
    setHistory([]);
    setFiltersOpen(false);
    setMobilePane("list");
  }, []);

  /** Hub Explorer → National Explorer. Saved places are untouched; the trail is dropped so
   * no detail drawer is left floating over the national map. */
  const returnToJapan = useCallback(() => {
    setView(INITIAL_VIEW);
    setZonesOpen(false);
    setFilters(EMPTY_FILTERS);
    setHistory([]);
    setFiltersOpen(false);
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
    if (!filtersOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  const explorer = (
    <>
      <div
        className={`app__filters ${filtersOpen ? "app__filters--open" : ""}`}
        id="app-filter-sheet"
      >
        <div className="app__filters-bar">
          <strong>Buscar y filtrar</strong>
          <button
            type="button"
            className="icon-button"
            onClick={() => setFiltersOpen(false)}
            aria-label="Cerrar búsqueda y filtros"
            title="Cerrar búsqueda y filtros"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
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
          defaultGroupsOpen={!isDesktop}
        />
      </div>
      <PlaceList
        places={filteredPlaces}
        totalCount={hubPlaces.length}
        selectedId={selectedId}
        savedIds={activeInterestedIds}
        interestMarkerFor={markerFor}
        onSelect={selectPlace}
        onToggleSaved={toggleSavedWithFeedback}
        onClearFilters={resetFilters}
        hasActiveFilters={activeFilterCount > 0}
        query={filters.query}
      />
    </>
  );

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          {activeHub ? (
            <>
              <h1>
                Nihon{" "}
                <span className="app__brand-sub">
                  <span className="app__brand-long">Explorador de </span>
                  {activeHub}
                </span>
              </h1>
              <p className="app__subtitle">{hubPlaces.length} lugares verificados</p>
            </>
          ) : (
            <>
              <h1>
                Nihon{" "}
                <span className="app__brand-sub">
                  <span className="app__brand-long">— </span>Explorador de Japón
                </span>
              </h1>
              <p className="app__subtitle">
                {NATIONAL_SUMMARY.prefectureCount} prefecturas ·{" "}
                {NATIONAL_SUMMARY.coveredPrefectureCount} con lugares verificados ·{" "}
                {NATIONAL_SUMMARY.placeCount} lugares en {NATIONAL_SUMMARY.coveredRegionCount} de{" "}
                {NATIONAL_SUMMARY.regionCount} regiones
              </p>
            </>
          )}
        </div>
        <div className="app__header-actions">
          <TravellerBar
            travellers={travellers}
            activeTravellerId={activeTraveller?.id ?? null}
            onSelect={setActiveTraveller}
            onManage={() => setTravellerManagerOpen(true)}
          />
          <button
            type="button"
            className="app__backup"
            onClick={() => setBackupOpen(true)}
            aria-label="Respaldo del viaje"
            title="Respaldo del viaje"
          >
            <Icon name="descargar" size={20} />
          </button>
          <button
            type="button"
            className="app__help tap-target-min"
            onClick={() => setOnboardingOpen(true)}
            aria-label="Cómo se usa Nihon"
            title="Cómo se usa Nihon"
          >
            <span aria-hidden="true">?</span>
          </button>
        </div>
      </header>

      {activeHub && (
        <>
          <div className="hub-bar">
            <button type="button" className="hub-bar__home" onClick={returnToJapan}>
              <Icon name="atras" size={16} /> Japón
            </button>
            <HubSelector hubs={HUBS} activeHub={activeHub} onSelect={switchHub} />
            {HUBS_WITH_ZONES.has(activeHub) && (
              <button
                type="button"
                className="hub-bar__zones"
                onClick={openZones}
                aria-haspopup="dialog"
              >
                <Icon name="cama" size={20} />
                <span className="hub-bar__zones-label">Dónde dormir</span>
              </button>
            )}
          </div>

          {/* Phone-only orientation bar: which surface am I on, and where are the filters.
              On desktop both surfaces are already visible and this row is hidden in CSS. */}
          <div className="view-bar">
            <div className="view-switch" role="group" aria-label="Cómo ver los lugares">
              <button
                type="button"
                className={`view-switch__option ${mobilePane === "list" ? "view-switch__option--active" : ""}`}
                onClick={() => setMobilePane("list")}
                aria-pressed={mobilePane === "list"}
              >
                <Icon name="lista" size={16} /> Lista
              </button>
              <button
                type="button"
                className={`view-switch__option ${mobilePane === "map" ? "view-switch__option--active" : ""}`}
                onClick={() => setMobilePane("map")}
                aria-pressed={mobilePane === "map"}
              >
                <Icon name="mapa" size={16} /> Mapa
              </button>
            </div>
            <button
              type="button"
              className="view-bar__filters"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="app-filter-sheet"
            >
              <Icon name="filtro" size={16} /> Filtros
              {activeFilterCount > 0 && <span className="app__filter-badge">{activeFilterCount}</span>}
            </button>
          </div>

          <div
            className={`app__body app__body--pane-${mobilePane}`}
            id="app-hub-panel"
            role="tabpanel"
            aria-label={`Lugares de ${activeHub}`}
          >
            <aside className="app__sidebar" aria-label="Explorar lugares">
              {explorer}
            </aside>

            <main className="app__map-area">
              <PlaceMap
                places={filteredPlaces}
                hubPlaces={hubPlaces}
                activeHub={activeHub}
                selectedPlace={selectedPlace}
                savedIds={savedIds}
                onSelect={selectPlace}
                panelOffset={isDesktop && selectedPlace ? DETAIL_PANEL_WIDTH : 0}
              />
              <InterestLegend />
              {filteredPlaces.length === 0 && (
                <div className="map-empty" role="status">
                  <p className="map-empty__title">
                    <Icon name="buscar" size={20} /> Ningún lugar coincide con los filtros
                  </p>
                  <p className="map-empty__hint">
                    Los {hubPlaces.length} lugares de esta zona siguen ahí; solo están filtrados.
                  </p>
                  <button type="button" className="button button--secondary" onClick={resetFilters}>
                    Limpiar búsqueda y filtros
                  </button>
                </div>
              )}
            </main>

            {selectedPlace && (
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
                />
              </div>
            )}
          </div>
        </>
      )}

      {nationalView && (
        <div className="app__body app__body--national">
          <NationalExplorer
            activeRegion={nationalView.region}
            selectedCode={nationalView.prefectureCode}
            onSelectRegion={selectRegion}
            onSelectPrefecture={selectPrefecture}
            onEnterHub={enterHub}
          />
        </div>
      )}

      <SelectionPanel
        savedPlaces={savedPlaces}
        onRemove={removeSavedWithFeedback}
        onSelect={selectPlace}
        open={selectionOpen}
        onToggle={() => setSelectionOpen((open) => !open)}
        onAnalyze={() => setAnalysisOpen(true)}
        onBuildSequence={openSequenceBuilder}
        tally={tally}
        interestMarkerFor={markerFor}
        activeTravellerLabel={activeTraveller?.label ?? null}
        divergence={divergence}
        travellers={travellers}
        activeTravellerId={activeTraveller?.id ?? null}
      />

      {analysisOpen && (
        <SelectionAnalysis
          savedPlaces={savedPlaces}
          onSelectPlace={openFromAnalysis}
          onClose={closeAnalysis}
        />
      )}

      {/* Block 12. The boundary sits OUTSIDE the condition on purpose, for two reasons. It keeps
          the planner mounted only while open — the invariant `ZonePlanSection.test.ts` pins, and
          the reason reopening re-reads what the comparison wrote — and it keeps one stable
          boundary rather than one that mounts and unmounts with its own content. `fallback={null}`
          because the overlay should simply appear, as it always did; a spinner would be new UI
          reporting on a wait the idle prefetch has usually already removed. */}
      <Suspense fallback={null}>
        {sequenceBuilderOpen && (
          <OrderedSequenceBuilder
            savedPlaces={savedPlaces}
            onClose={closeSequenceBuilder}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {zonesOpen && activeHub && (
          <ZoneComparison
            hub={activeHub}
            savedPlaces={savedPlaces}
            onClose={() => setZonesOpen(false)}
            onSelectPlace={(id) => {
              selectPlace(id);
              setZonesOpen(false);
            }}
            onOpenPlanner={openSequenceBuilder}
          />
        )}
      </Suspense>

      {backupOpen && (
          <TripBackup
            importState={importState}
            onExport={exportBackup}
            onChooseFile={prepareImport}
            onConfirm={(preview) => confirmImport(preview.plan)}
            onReset={resetImport}
            onFinishRestore={finishRestore}
            onClose={() => {
              resetImport();
              setBackupOpen(false);
            }}
          />
        )}

      <SaveToast feedback={feedback} />

      {travellerManagerOpen && (
        <TravellerManager
          travellers={travellers}
          activeTravellerId={activeTraveller?.id ?? null}
          placesOnlyWantedBy={placesOnlyWantedBy}
          onRename={renameTraveller}
          onReset={resetTraveller}
          onRemove={removeTraveller}
          onAdd={addTraveller}
          onClose={() => setTravellerManagerOpen(false)}
        />
      )}

      {onboardingOpen && <Onboarding onClose={() => setOnboardingOpen(false)} />}
    </div>
  );
}
