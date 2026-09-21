import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Filters, Place } from "../types";
import type { ExploreState } from "./navigation";
import { matchesQuery } from "../lib/place";
import { matchesReservationFilter } from "../lib/reservation";
import { matchesAnyPlanningBlock, availablePlanningBlocks } from "../lib/planning-block";
import { FilterPanel } from "../components/FilterPanel";
import { orderDiscoveryPlaces } from "./discovery-order";
import { PlaceCard } from "./PlaceCard";
import { RouteDialog } from "./RouteDialog";

const LazyPlaceMap = lazy(() => import("../components/PlaceMap").then(module => ({ default: module.PlaceMap })));
const EMPTY_FILTERS: Filters = { query:"", categories:[], grades:[], hiddenGemStatuses:[], tourismLevels:[], reservation:"all", planningBlocks:[] };

export const INITIAL_EXPERIENCE_GROUPS: Record<string, string[]> = {
  "Japón tradicional": ["⛩️ Templos y santuarios", "🏯 Historia y patrimonio", "🍵 Cultura tradicional", "🎭 Cultura tradicional", "🧖 Onsen/bienestar", "🏛️ Arquitectura"],
  "Naturaleza y jardines": ["🌸 Jardines y paisajes", "🌿 Naturaleza", "🥾 Senderismo/aventura", "🌊 Playa/mar/islas", "🐋 Fauna y experiencias estacionales", "🌸 Naturaleza"],
  "Anime y videojuegos": ["🎮 Videojuegos", "👾 Anime/manga", "🤖 Tecnología"],
  "Parques y diversión": ["🎢 Entretenimiento", "🧩 Extraño/peculiar/único", "🚂 Experiencias especiales", "🎨 Arte", "🏛️ Museos", "📷 Fotografía", "🎆 Eventos", "🌌 Cielo nocturno"],
  "Comida y barrios": ["🏙️ Ciudad y barrios", "🍜 Gastronomía", "🍶 Gastronomía", "🛍️ Compras", "🌅 Miradores", "🌃 Nocturno"]
};

type Props = { places: Place[]; hubs: string[]; state: ExploreState; savedIds: string[]; onToggle: (id: string) => void; onState: (state: ExploreState, replace?: boolean) => void; onOpen: (id: string) => void; onRegions: () => void };

function filterPlace(place: Place, filters: Filters, hub: string | null) {
  return (!hub || place.hub === hub) && matchesQuery(place, filters.query) &&
    (!filters.categories.length || filters.categories.includes(place.category)) &&
    (!filters.grades.length || filters.grades.includes(place.grade)) &&
    (!filters.hiddenGemStatuses.length || Boolean(place.hiddenGemStatus && filters.hiddenGemStatuses.includes(place.hiddenGemStatus))) &&
    (!filters.tourismLevels.length || filters.tourismLevels.includes(place.tourismLevel)) &&
    matchesAnyPlanningBlock(place.duration, filters.planningBlocks) && matchesReservationFilter(place, filters.reservation);
}

export function Discovery({ places, hubs, state, savedIds, onToggle, onState, onOpen, onRegions }: Props) {
  const hub = state.hub && hubs.includes(state.hub) ? state.hub : null;
  const filters: Filters = {
    query:state.query,
    categories:state.categories.filter(category => places.some(place => place.category === category)),
    grades:state.grades,
    planningBlocks:state.planningBlocks,
    hiddenGemStatuses:state.hiddenGemStatuses,
    tourismLevels:state.tourismLevels,
    reservation:state.reservation,
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const moreRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const getFilterButton = useCallback(() => filterButtonRef.current, []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const categories = useMemo(() => [...new Set(places.map(p => p.category))].sort((a,b) => a.localeCompare(b,"es")), [places]);
  const scopePlaces = useMemo(() => hub ? places.filter(p => p.hub === hub) : places, [places, hub]);
  const grades = useMemo(() => ["S","A","B","C","D"].filter(g => scopePlaces.some(p=>p.grade===g)), [scopePlaces]);
  const hidden = useMemo(() => [...new Set(scopePlaces.map(p=>p.hiddenGemStatus).filter(Boolean))] as string[], [scopePlaces]);
  const tourism = useMemo(() => ["Extremo","Alto","Medio","Bajo"].filter(v=>scopePlaces.some(p=>p.tourismLevel===v)), [scopePlaces]);
  const activeCount = filters.categories.length + filters.grades.length + filters.hiddenGemStatuses.length + filters.tourismLevels.length + filters.planningBlocks.length + (filters.reservation === "all" ? 0 : 1);
  const results = orderDiscoveryPlaces(places.filter(p => filterPlace(p, filters, hub)), hubs, hub ?? "");
  const shown = Math.max(12, state.page * 12);

  useEffect(() => { const timer = window.setTimeout(() => setAnnouncement(`${results.length} resultados`), 200); return () => clearTimeout(timer); }, [results.length]);

  const updateFilters = (next: Filters) => {
    onState({ ...state, query:next.query, categories:next.categories, grades:next.grades, planningBlocks:next.planningBlocks, hiddenGemStatuses:next.hiddenGemStatuses, tourismLevels:next.tourismLevels, reservation:next.reservation, page:1 }, true);
  };
  const setHub = (next: string) => next === "__regions" ? onRegions() : onState({ ...state, hub: next || null, page: 1 });

  return <>
    <section className="astra-intro"><p className="astra-eyebrow">JAPÓN, A SU MANERA</p><h1>{hub ? `Descubre ${hub}` : "¿Qué te gustaría vivir en Japón?"}</h1><p>Marca lo que te gusta. El viaje lo armamos después.</p></section>
    <section className="astra-controls" aria-label="Buscar lugares">
      <label className="astra-search"><span aria-hidden="true">⌕</span><span className="visually-hidden">Busca un lugar o una experiencia</span><input type="search" value={filters.query} onChange={e => updateFilters({ ...filters, query:e.target.value })} placeholder="Busca un lugar o una experiencia" />{filters.query && <button type="button" aria-label="Borrar búsqueda" onClick={() => updateFilters({ ...filters, query:"" })}>×</button>}</label>
      <div className="astra-quick"><label><span className="visually-hidden">Hub</span><select value={hub ?? ""} onChange={e => setHub(e.target.value)}><option value="">Todo Japón ({places.length})</option>{hubs.map(h => <option key={h} value={h}>{h} ({places.filter(place => place.hub === h).length})</option>)}<option value="__regions">Explorar por región</option></select></label><label><span className="visually-hidden">Experiencias</span><select value={Object.entries(INITIAL_EXPERIENCE_GROUPS).find(([_, cats]) => cats.length === filters.categories.length && cats.every(c => filters.categories.includes(c)))?.[0] || (filters.categories.length === 1 ? filters.categories[0] : "")} onChange={e => {
  const val = e.target.value;
  if (!val) { updateFilters({ ...filters, categories: [] }); }
  else if (INITIAL_EXPERIENCE_GROUPS[val]) { updateFilters({ ...filters, categories: INITIAL_EXPERIENCE_GROUPS[val] }); }
  else { updateFilters({ ...filters, categories: [val] }); }
}}>
  <option value="">Todas las experiencias</option>
  <optgroup label="Categorías principales">
    {Object.keys(INITIAL_EXPERIENCE_GROUPS).map(group => <option key={group} value={group}>{group}</option>)}
  </optgroup>
  <optgroup label="Otras experiencias">
    {categories.map(c => <option key={c} value={c}>{c}</option>)}
  </optgroup>
</select></label><button ref={filterButtonRef} type="button" className="astra-filter-button" onClick={() => setFiltersOpen(true)}>Filtros ({activeCount})</button></div>
    </section>
    <div className="astra-results"><h2>{hub ? `Lugares en ${hub}` : "Lugares para descubrir"}</h2><span aria-hidden="true">{results.length} resultados</span><span className="visually-hidden" role="status" aria-live="polite">{announcement}</span><div className="astra-mode" aria-label="Modo de resultados"><button aria-pressed={state.mode === "lista"} onClick={() => onState({...state,mode:"lista"})}>Lista</button><button aria-pressed={state.mode === "mapa"} onClick={() => onState({...state,mode:"mapa"})}>Mapa</button></div></div>
    {state.mode === "mapa" ? <div className="astra-map"><Suspense fallback={<div className="astra-map__loading" role="status">Cargando mapa…</div>}><LazyPlaceMap places={results} hubPlaces={scopePlaces} activeHub={hub ?? "Todo Japón"} selectedPlace={null} savedIds={savedIds} onSelect={onOpen} panelOffset={0} /></Suspense></div> : results.length ? <div className="astra-grid">{results.slice(0,shown).map(place => <PlaceCard key={place.id} place={place} saved={savedIds.includes(place.id)} onToggle={onToggle} onOpen={onOpen} />)}</div> : <div className="astra-empty"><h2>Ningún lugar coincide</h2><p>Prueba otro término o cambia los filtros.</p></div>}
    {state.mode === "lista" && shown < results.length && <button ref={moreRef} className="astra-more" onClick={() => { const start=shown+1,end=Math.min(shown+12,results.length); onState({...state,page:state.page+1},true); setAnnouncement(`Resultados ${start}–${end} añadidos`); requestAnimationFrame(() => moreRef.current?.focus()); }}>Ver 12 más</button>}
    {filtersOpen && <RouteDialog label="Filtros avanzados" onClose={closeFilters} returnFocus={getFilterButton} overlayClassName="astra-filter-overlay" panelClassName="astra-filter-sheet"><div className="astra-filter-sheet__bar"><strong>Filtros</strong><button aria-label="Cerrar filtros" onClick={closeFilters}>×</button></div><FilterPanel filters={filters} onChange={updateFilters} categories={categories} grades={grades} planningBlocks={availablePlanningBlocks(scopePlaces.map(p=>p.duration))} hiddenGemStatuses={hidden} tourismLevels={tourism} resultCount={results.length} totalCount={scopePlaces.length} activeFilterCount={activeCount} onReset={() => updateFilters({...EMPTY_FILTERS})} announceResults /><button className="astra-filter-done" onClick={closeFilters}>Ver {results.length} resultados</button></RouteDialog>}
  </>;
}
