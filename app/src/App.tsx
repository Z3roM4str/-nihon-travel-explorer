import { useMemo, useState } from "react";
import placesData from "./data/places.json";
import nearbyData from "./data/nearby.json";
import { FilterPanel } from "./components/FilterPanel";
import { PlaceMap } from "./components/PlaceMap";
import { PlaceDetail } from "./components/PlaceDetail";
import { SelectionPanel } from "./components/SelectionPanel";
import { useSavedPlaces } from "./useSavedPlaces";
import type { Filters, NearbyRelation, Place } from "./types";
import "./App.css";

const allPlaces = placesData as Place[];
const nearbyRelations = nearbyData as NearbyRelation[];
const TOKYO_PLACES = allPlaces.filter((place) => place.hub === "Tokio");

const CATEGORIES = [...new Set(TOKYO_PLACES.map((p) => p.category))].sort();
const GRADES = ["S", "A", "B", "C"].filter((g) => TOKYO_PLACES.some((p) => p.grade === g));
const HIDDEN_GEM_STATUSES = [...new Set(TOKYO_PLACES.map((p) => p.hiddenGemStatus).filter(Boolean))] as string[];
const TOURISM_LEVELS = ["Extremo", "Alto", "Medio", "Bajo"].filter((l) =>
  TOKYO_PLACES.some((p) => p.tourismLevel === l)
);

const EMPTY_FILTERS: Filters = {
  categories: [],
  grades: [],
  hiddenGemStatuses: [],
  tourismLevels: [],
  reservation: "all",
};

function matchesFilters(place: Place, filters: Filters) {
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
  return true;
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const { savedIds, isSaved, toggleSaved, removeSaved } = useSavedPlaces();

  const filteredPlaces = useMemo(
    () => TOKYO_PLACES.filter((place) => matchesFilters(place, filters)),
    [filters]
  );

  const selectedPlace = useMemo(
    () => TOKYO_PLACES.find((p) => p.id === selectedId) ?? null,
    [selectedId]
  );

  const nearbyForSelected = useMemo(
    () => (selectedPlace ? nearbyRelations.filter((rel) => rel["Desde ID"] === selectedPlace.id) : []),
    [selectedPlace]
  );

  const savedPlaces = useMemo(
    () => savedIds.map((id) => TOKYO_PLACES.find((p) => p.id === id)).filter((p): p is Place => Boolean(p)),
    [savedIds]
  );

  function selectPlace(id: string) {
    setSelectedId(id);
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Nihon — Explorador de Tokio</h1>
        <p className="app__subtitle">Mapa interactivo de lugares verificados en Tokio · Fase 1</p>
        <button
          type="button"
          className="app__filters-toggle"
          onClick={() => setFiltersOpenMobile((v) => !v)}
          aria-expanded={filtersOpenMobile}
        >
          {filtersOpenMobile ? "Ocultar filtros" : "Mostrar filtros"}
        </button>
      </header>

      <div className="app__body">
        <aside className={`app__sidebar ${filtersOpenMobile ? "app__sidebar--open" : ""}`}>
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            categories={CATEGORIES}
            grades={GRADES}
            hiddenGemStatuses={HIDDEN_GEM_STATUSES}
            tourismLevels={TOURISM_LEVELS}
            resultCount={filteredPlaces.length}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />
        </aside>

        <main className="app__map-area">
          <PlaceMap
            places={filteredPlaces}
            selectedId={selectedId}
            savedIds={savedIds}
            onSelect={(place) => selectPlace(place.id)}
          />
        </main>

        {selectedPlace && (
          <div className="app__detail-overlay">
            <PlaceDetail
              place={selectedPlace}
              isSaved={isSaved(selectedPlace.id)}
              onToggleSaved={toggleSaved}
              onClose={() => setSelectedId(null)}
              nearby={nearbyForSelected}
              onSelectNearby={selectPlace}
              allPlaces={TOKYO_PLACES}
            />
          </div>
        )}
      </div>

      <SelectionPanel
        savedPlaces={savedPlaces}
        onRemove={removeSaved}
        onSelect={selectPlace}
        open={selectionOpen}
        onToggle={() => setSelectionOpen((v) => !v)}
      />
    </div>
  );
}
