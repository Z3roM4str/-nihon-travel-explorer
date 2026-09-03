import { useCallback, useEffect, useMemo, useState } from "react";
import { getHubs, getNearby, getPlaceById, getPlacesByHub } from "./data/store";
import type { NavigationRegion } from "./data/geography";
import { getNationalSummary, getPrefectureByCode } from "./data/geography";
import { FilterPanel } from "./components/FilterPanel";
import { HubSelector } from "./components/HubSelector";
import { NationalExplorer } from "./components/NationalExplorer";
import { PlaceList } from "./components/PlaceList";
import { PlaceMap } from "./components/PlaceMap";
import { PlaceDetail } from "./components/PlaceDetail";
import { SelectionPanel } from "./components/SelectionPanel";
import { useSavedPlaces } from "./useSavedPlaces";
import { matchesQuery } from "./lib/place";
import type { Filters, Place } from "./types";
import "./App.css";

const HUBS = getHubs();
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

const EMPTY_FILTERS: Filters = {
  query: "",
  categories: [],
  grades: [],
  hiddenGemStatuses: [],
  tourismLevels: [],
  reservation: "all",
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
  if (filters.reservation === "required" && !place.reservation.required) return false;
  if (filters.reservation === "not-required" && place.reservation.required) return false;
  return matchesQuery(place, filters.query);
}

function countActiveFilters(filters: Filters): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    filters.categories.length +
    filters.grades.length +
    filters.hiddenGemStatuses.length +
    filters.tourismLevels.length +
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

export default function App() {
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** Trail of visited places (any hub), so "nearby" jumps and cross-hub opens can be
   * stepped back through. */
  const [history, setHistory] = useState<string[]>([]);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const { savedIds, isSaved, toggleSaved, removeSaved } = useSavedPlaces();
  const isDesktop = useIsDesktop();

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
  const grades = useMemo(
    () => ["S", "A", "B", "C"].filter((g) => hubPlaces.some((p) => p.grade === g)),
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

  const selectedId = history.length > 0 ? history[history.length - 1] : null;
  const selectedPlace = selectedId ? getPlaceById(selectedId) ?? null : null;
  const previousId = history.length > 1 ? history[history.length - 2] : null;
  const previousPlace = previousId ? getPlaceById(previousId) ?? null : null;

  const filteredPlaces = useMemo(
    () => hubPlaces.filter((place) => matchesFilters(place, filters)),
    [hubPlaces, filters]
  );

  const activeFilterCount = countActiveFilters(filters);

  /** Resolved against the global dataset, so a saved place survives navigation to any hub. */
  const savedPlaces = useMemo(
    () => savedIds.map((id) => getPlaceById(id)).filter((place): place is Place => Boolean(place)),
    [savedIds]
  );

  /**
   * Single source of truth for "go look at this place": moves into the Hub Explorer on the
   * hub the place belongs to — from another hub or straight from the national map — starts a
   * fresh trail, and closes the mobile filter drawer. Used by the place list, the map and the
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
      setExplorerOpen(false);
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

  const closeDetail = useCallback(() => setHistory([]), []);
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  /** Manually switching hubs resets filters and closes any open detail from the previous
   * hub — the policy is deliberately different from pushPlace/goBack, which preserve both. */
  const switchHub = useCallback(
    (hub: string) => {
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
    setExplorerOpen(false);
  }, []);

  /** Hub Explorer → National Explorer. Saved places are untouched; the trail is dropped so
   * no detail drawer is left floating over the national map. */
  const returnToJapan = useCallback(() => {
    setView(INITIAL_VIEW);
    setFilters(EMPTY_FILTERS);
    setHistory([]);
    setExplorerOpen(false);
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
    if (!explorerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setExplorerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [explorerOpen]);

  const explorer = (
    <>
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        categories={categories}
        grades={grades}
        hiddenGemStatuses={hiddenGemStatuses}
        tourismLevels={tourismLevels}
        resultCount={filteredPlaces.length}
        totalCount={hubPlaces.length}
        activeFilterCount={activeFilterCount}
        onReset={resetFilters}
      />
      <PlaceList
        places={filteredPlaces}
        totalCount={hubPlaces.length}
        selectedId={selectedId}
        savedIds={savedIds}
        onSelect={selectPlace}
        onClearFilters={resetFilters}
        hasActiveFilters={activeFilterCount > 0}
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
        {activeHub && (
          <button
            type="button"
            className="button button--primary app__explorer-toggle"
            onClick={() => setExplorerOpen((open) => !open)}
            aria-expanded={explorerOpen}
          >
            <span aria-hidden="true">🔍</span> Buscar y filtrar
            {activeFilterCount > 0 && <span className="app__filter-badge">{activeFilterCount}</span>}
          </button>
        )}
      </header>

      {activeHub && (
        <>
          <div className="hub-bar">
            <button type="button" className="hub-bar__home" onClick={returnToJapan}>
              <span aria-hidden="true">←</span> Japón
            </button>
            <HubSelector hubs={HUBS} activeHub={activeHub} onSelect={switchHub} />
          </div>

          <div className="app__body" id="app-hub-panel" role="tabpanel" aria-label={`Lugares de ${activeHub}`}>
            <aside
              className={`app__sidebar ${explorerOpen ? "app__sidebar--open" : ""}`}
              aria-label="Explorar lugares"
            >
              <div className="app__sidebar-mobile-bar">
                <strong>Buscar y filtrar</strong>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setExplorerOpen(false)}
                  aria-label="Cerrar búsqueda y filtros"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
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
              {filteredPlaces.length === 0 && (
                <div className="map-empty" role="status">
                  <p>Ningún lugar coincide con los filtros actuales.</p>
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
                  isSaved={isSaved(selectedPlace.id)}
                  onToggleSaved={toggleSaved}
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
        onRemove={removeSaved}
        onSelect={selectPlace}
        open={selectionOpen}
        onToggle={() => setSelectionOpen((open) => !open)}
      />
    </div>
  );
}
