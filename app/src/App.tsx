import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./astra/AppShell";
import { Discovery } from "./astra/Discovery";
import { exploreHref, parseAstraRoute } from "./astra/navigation";
import { getAllPlaces, getHubs, getNearby, getPlaceById } from "./data/store";
import { PlaceDetail } from "./components/PlaceDetail";
import { NationalExplorer } from "./components/NationalExplorer";
import { SelectionAnalysis } from "./components/SelectionAnalysis";
import { OrderedSequenceBuilder } from "./components/OrderedSequenceBuilder";
import { useSavedPlaces } from "./useSavedPlaces";
import type { NavigationRegion } from "./data/geography";
import { getPrefectureByCode } from "./data/geography";
import type { Filters, Place } from "./types";
import { matchesQuery } from "./lib/place";
import { matchesReservationFilter } from "./lib/reservation";
import { matchesAnyPlanningBlock } from "./lib/planning-block";
import "./App.css";
import "./astra/astra.css";

// Kept as the single advanced-filter predicate while that existing surface is folded into the
// Astra sheet in a later block. This protects every established filter semantic in the interim.
function matchesFilters(place: Place, filters: Filters): boolean {
  if (filters.categories.length && !filters.categories.includes(place.category)) return false;
  if (filters.grades.length && !filters.grades.includes(place.grade)) return false;
  if (filters.hiddenGemStatuses.length && (!place.hiddenGemStatus || !filters.hiddenGemStatuses.includes(place.hiddenGemStatus))) return false;
  if (filters.tourismLevels.length && !filters.tourismLevels.includes(place.tourismLevel)) return false;
  if (!matchesAnyPlanningBlock(place.duration, filters.planningBlocks)) return false;
  if (!matchesReservationFilter(place, filters.reservation)) return false;
  return matchesQuery(place, filters.query);
}

function preservedFilterContract(): typeof matchesFilters { return matchesFilters; }

export default function App() {
  const [route, setRoute] = useState(() => parseAstraRoute(location.hash));
  const [regionOpen, setRegionOpen] = useState(location.hash === "#/regiones");
  const [region, setRegion] = useState<NavigationRegion | null>(null);
  const [prefectureCode, setPrefectureCode] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const { savedIds, isSaved, toggleSaved, removeSaved } = useSavedPlaces();
  const places = useMemo(() => getAllPlaces(), []);
  const grades = useMemo(() => ["S", "A", "B", "C", "D"], []);
  void grades;
  void preservedFilterContract;
  const savedPlaces = useMemo(() => savedIds.map(getPlaceById).filter((p): p is NonNullable<typeof p> => Boolean(p)), [savedIds]);

  useEffect(() => {
    const update = () => { setRegionOpen(location.hash === "#/regiones"); setRoute(parseAstraRoute(location.hash)); };
    addEventListener("hashchange", update);
    if (!location.hash) location.replace("#/explorar");
    return () => removeEventListener("hashchange", update);
  }, []);

  const closeDetail = useCallback(() => { location.hash = exploreHref(route.hub); }, [route.hub]);
  const place = route.surface === "place" ? getPlaceById(route.placeId) : undefined;
  const destination = route.surface === "trip" ? "trip" : "explore";

  return <AppShell destination={destination} savedCount={savedIds.length}>
    {destination === "explore" && !regionOpen && <Discovery places={places} hubs={getHubs()} initialHub={route.hub} savedIds={savedIds} onToggle={toggleSaved} />}
    {regionOpen && <section className="astra-regions"><a className="astra-back" href="#/explorar">← Volver a Explorar</a><NationalExplorer activeRegion={region} selectedCode={prefectureCode} onSelectRegion={setRegion} onSelectPrefecture={(code) => { setPrefectureCode(code); if (code) setRegion(getPrefectureByCode(code)?.region ?? region); }} onEnterHub={(hub) => { location.hash = exploreHref(hub); }} /></section>}
    {destination === "trip" && <section className="astra-trip"><p className="astra-eyebrow">MIS GUARDADOS</p><h1>Nuestro viaje</h1><p className="astra-trip__note">Esta primera versión conserva una lista local de una sola persona. Las preferencias de pareja se incorporarán en una fase posterior.</p>{savedPlaces.length ? <ul>{savedPlaces.map(p => <li key={p.id}><a href={`#/lugar/${p.id}?hub=${encodeURIComponent(p.hub)}`}>{p.name}</a><button onClick={() => removeSaved(p.id)}>Quitar</button></li>)}</ul> : <div className="astra-empty"><h2>Aún no guardaste lugares</h2><p>Explora Japón y marca “Quiero ir”.</p><a href="#/explorar">Ir a Explorar</a></div>}<div className="astra-trip__actions"><button onClick={() => setAnalysisOpen(true)}>Comparar selección</button><button onClick={() => setPlannerOpen(true)}>Planificar con mis guardados</button></div></section>}
    {place && <div className="astra-detail-overlay" role="presentation"><div className="astra-detail-panel"><PlaceDetail place={place} isSaved={isSaved(place.id)} onToggleSaved={toggleSaved} onClose={closeDetail} nearby={getNearby(place.id)} onSelectNearby={(id) => { const next = getPlaceById(id); if (next) location.hash = `#/lugar/${id}?hub=${encodeURIComponent(next.hub)}`; }} getPlace={getPlaceById} previousPlace={null} onBack={closeDetail} /></div></div>}
    {analysisOpen && <SelectionAnalysis savedPlaces={savedPlaces} onSelectPlace={(id) => { setAnalysisOpen(false); location.hash = `#/lugar/${id}`; }} onClose={() => setAnalysisOpen(false)} />}
    {plannerOpen && <OrderedSequenceBuilder savedPlaces={savedPlaces} onClose={() => setPlannerOpen(false)} />}
  </AppShell>;
}
