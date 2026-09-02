import { useCallback, useEffect, useMemo, useState } from "react";
import { getNearby, getPlaceById, getPlacesByHub } from "./data/store";
import { FilterPanel } from "./components/FilterPanel";
import { PlaceList } from "./components/PlaceList";
import { PlaceMap } from "./components/PlaceMap";
import { PlaceDetail } from "./components/PlaceDetail";
import { SelectionPanel } from "./components/SelectionPanel";
import { useSavedPlaces } from "./useSavedPlaces";
import { matchesQuery } from "./lib/place";
import type { Filters, Place } from "./types";
import "./App.css";

/** Phase 2A: Tokyo is the active hub, not a structural assumption — hub switching
 * arrives once the national selector ships. */
const ACTIVE_HUB = "Tokio";
const hubPlaces = getPlacesByHub(ACTIVE_HUB);

const CATEGORIES = [...new Set(hubPlaces.map((p) => p.category))].sort((a, b) =>
  a.localeCompare(b, "es")
);
const GRADES = ["S", "A", "B", "C"].filter((g) => hubPlaces.some((p) => p.grade === g));
const HIDDEN_GEM_STATUSES = [
  ...new Set(hubPlaces.map((p) => p.hiddenGemStatus).filter(Boolean)),
] as string[];
const TOURISM_LEVELS = ["Extremo", "Alto", "Medio", "Bajo"].filter((level) =>
  hubPlaces.some((p) => p.tourismLevel === level)
);

const EMPTY_FILTERS: Filters = {
  query: "",
  categories: [],
  grades: [],
  hiddenGemStatuses: [],
  tourismLevels: [],
  reservation: "all",
};

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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** Trail of visited places, so "nearby" jumps can be stepped back through. */
  const [history, setHistory] = useState<string[]>([]);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const { savedIds, isSaved, toggleSaved, removeSaved } = useSavedPlaces();
  const isDesktop = useIsDesktop();

  const selectedId = history.length > 0 ? history[history.length - 1] : null;
  const selectedPlace = selectedId ? getPlaceById(selectedId) ?? null : null;
  const previousPlace =
    history.length > 1 ? getPlaceById(history[history.length - 2]) ?? null : null;

  const filteredPlaces = useMemo(
    () => hubPlaces.filter((place) => matchesFilters(place, filters)),
    [filters]
  );

  const activeFilterCount = countActiveFilters(filters);

  /** Resolved against the global dataset, so a saved place survives navigation to any hub. */
  const savedPlaces = useMemo(
    () => savedIds.map((id) => getPlaceById(id)).filter((place): place is Place => Boolean(place)),
    [savedIds]
  );

  /** Selecting from list, map or selection panel starts a fresh trail. */
  const selectPlace = useCallback((id: string) => {
    setHistory([id]);
    setExplorerOpen(false);
  }, []);

  /** A nearby jump extends the trail so the user can return to where they came from. */
  const pushPlace = useCallback((id: string) => {
    setHistory((trail) => (trail[trail.length - 1] === id ? trail : [...trail, id]));
  }, []);

  const goBack = useCallback(() => setHistory((trail) => trail.slice(0, -1)), []);
  const closeDetail = useCallback(() => setHistory([]), []);
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

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
        categories={CATEGORIES}
        grades={GRADES}
        hiddenGemStatuses={HIDDEN_GEM_STATUSES}
        tourismLevels={TOURISM_LEVELS}
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
          <h1>
            Nihon{" "}
            <span className="app__brand-sub">
              <span className="app__brand-long">Explorador de </span>
              {ACTIVE_HUB}
            </span>
          </h1>
          <p className="app__subtitle">{hubPlaces.length} lugares verificados · Fase 1</p>
        </div>
        <button
          type="button"
          className="button button--primary app__explorer-toggle"
          onClick={() => setExplorerOpen((open) => !open)}
          aria-expanded={explorerOpen}
        >
          <span aria-hidden="true">🔍</span> Buscar y filtrar
          {activeFilterCount > 0 && <span className="app__filter-badge">{activeFilterCount}</span>}
        </button>
      </header>

      <div className="app__body">
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
