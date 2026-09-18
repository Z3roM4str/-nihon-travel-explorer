import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./astra/AppShell";
import { Discovery } from "./astra/Discovery";
import { EMPTY_EXPLORE_STATE, exploreHref, parseAstraRoute, type ExploreState } from "./astra/navigation";
import { canRemoveSavedPlace, readAuthoredPlanIds } from "./astra/plan-safety";
import { RouteDialog } from "./astra/RouteDialog";
import { getAllPlaces, getHubs, getNearby, getPlaceById } from "./data/store";
import { PlaceDetail } from "./components/PlaceDetail";
import { SelectionAnalysis } from "./components/SelectionAnalysis";
import { useSavedPlaces } from "./useSavedPlaces";
import type { NavigationRegion } from "./data/geography";
import { getPrefectureByCode } from "./data/geography";
import "./App.css";
import "./astra/astra.css";

const LazyNationalExplorer = lazy(() => import("./components/NationalExplorer").then(module => ({ default: module.NationalExplorer })));
const LazyPlanner = lazy(() => import("./components/OrderedSequenceBuilder").then(module => ({ default: module.OrderedSequenceBuilder })));

export default function App() {
  const [route, setRoute] = useState(() => parseAstraRoute(location.hash));
  const [region, setRegion] = useState<NavigationRegion | null>(null);
  const [prefectureCode, setPrefectureCode] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannedRemoval, setPlannedRemoval] = useState<string | null>(null);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [lastExplore, setLastExplore] = useState<ExploreState>(route.surface === "explore" ? route : EMPTY_EXPLORE_STATE);
  const { savedIds, isSaved, toggleSaved, removeSaved } = useSavedPlaces();
  const places = useMemo(() => getAllPlaces(), []);
  const savedPlaces = useMemo(() => savedIds.map(getPlaceById).filter((p): p is NonNullable<typeof p> => Boolean(p)), [savedIds]);
  const plannerIds = new Set([...savedIds, ...readAuthoredPlanIds(localStorage)]);
  const plannerPlaces = [...plannerIds].map(getPlaceById).filter((p): p is NonNullable<typeof p> => Boolean(p));

  useEffect(() => {
    const update = () => { const next=parseAstraRoute(location.hash); if (next.surface === "explore") setLastExplore(next); setRoute(next); };
    addEventListener("hashchange", update); addEventListener("popstate", update);
    if (!location.hash) location.replace("#/explorar");
    return () => { removeEventListener("hashchange", update); removeEventListener("popstate", update); };
  }, []);

  const navigateExplore = useCallback((state: ExploreState, replace=false) => {
    setLastExplore(state); const href=exploreHref(state);
    if (replace) history.replaceState(history.state, "", href); else location.hash=href;
    setRoute(parseAstraRoute(href));
  }, []);
  const openPlace = useCallback((id: string) => {
    setOpener(document.activeElement as HTMLElement);
    const place=getPlaceById(id); if (!place) return;
    history.pushState({ astraOrigin:true, explore:lastExplore }, "", `#/lugar/${id}?hub=${encodeURIComponent(place.hub)}`);
    setRoute(parseAstraRoute(location.hash));
  }, [lastExplore]);
  const closeDetail = useCallback(() => {
    if (history.state?.astraOrigin) history.back();
    else { const href=exploreHref(lastExplore); history.replaceState(null,"",href); setRoute(parseAstraRoute(href)); }
  }, [lastExplore]);
  const safeToggle = useCallback((id: string) => {
    if (isSaved(id) && !canRemoveSavedPlace(id, localStorage)) { setPlannedRemoval(id); return; }
    toggleSaved(id);
  }, [isSaved, toggleSaved]);
  const safeRemove = useCallback((id: string) => {
    if (!canRemoveSavedPlace(id, localStorage)) { setPlannedRemoval(id); return; }
    removeSaved(id);
  }, [removeSaved]);

  const place = route.surface === "place" ? getPlaceById(route.placeId) : undefined;
  const destination = route.surface === "trip" ? "trip" : "explore";
  return <AppShell destination={destination} savedCount={savedIds.length}>
    <div id="astra-content">
      {(route.surface === "explore" || route.surface === "place") && <Discovery places={places} hubs={getHubs()} state={route.surface === "explore" ? route : lastExplore} savedIds={savedIds} onToggle={safeToggle} onState={navigateExplore} onOpen={openPlace} />}
      {route.surface === "regions" && <section className="astra-regions"><a className="astra-back" href={exploreHref(lastExplore)}>← Volver a Explorar</a><Suspense fallback={<div role="status">Cargando regiones…</div>}><LazyNationalExplorer activeRegion={region} selectedCode={prefectureCode} onSelectRegion={setRegion} onSelectPrefecture={(code) => { setPrefectureCode(code); if (code) setRegion(getPrefectureByCode(code)?.region ?? region); }} onEnterHub={(hub) => navigateExplore({...EMPTY_EXPLORE_STATE,hub})} /></Suspense></section>}
      {route.surface === "trip" && <section className="astra-trip"><p className="astra-eyebrow">MIS GUARDADOS</p><h1>Nuestro viaje</h1><p className="astra-trip__note">Esta primera versión conserva una lista local de una sola persona. Las preferencias de pareja se incorporarán en una fase posterior.</p>{savedPlaces.length ? <ul>{savedPlaces.map(p => <li key={p.id}><a href={`#/lugar/${p.id}?hub=${encodeURIComponent(p.hub)}`} onClick={event => { event.preventDefault(); openPlace(p.id); }}>{p.name}</a><button onClick={() => safeRemove(p.id)}>Quitar</button></li>)}</ul> : <div className="astra-empty"><h2>Aún no guardaste lugares</h2><p>Explora Japón y marca “Quiero ir”.</p><a href="#/explorar">Ir a Explorar</a></div>}<div className="astra-trip__actions"><button onClick={() => setAnalysisOpen(true)}>Comparar selección</button><button onClick={() => setPlannerOpen(true)}>Planificar con mis guardados</button></div></section>}
    </div>
    {place && <RouteDialog label={`Detalles de ${place.name}`} onClose={closeDetail} returnFocus={opener}><PlaceDetail place={place} isSaved={isSaved(place.id)} onToggleSaved={safeToggle} onClose={closeDetail} nearby={getNearby(place.id)} onSelectNearby={openPlace} getPlace={getPlaceById} previousPlace={null} onBack={closeDetail} /></RouteDialog>}
    {plannedRemoval && <div className="astra-confirm" role="alertdialog" aria-modal="true" aria-labelledby="planned-title"><div><h2 id="planned-title">Este lugar forma parte de tu ruta</h2><p>Para proteger el plan guardado, quítalo primero desde Planificar. No se cambió tu guardado ni tu ruta.</p><button autoFocus onClick={() => setPlannedRemoval(null)}>Mantener guardado</button><button onClick={() => { setPlannedRemoval(null); setPlannerOpen(true); }}>Ir a Planificar</button></div></div>}
    {analysisOpen && <SelectionAnalysis savedPlaces={savedPlaces} onSelectPlace={(id) => { setAnalysisOpen(false); openPlace(id); }} onClose={() => setAnalysisOpen(false)} />}
    {plannerOpen && <Suspense fallback={<div className="astra-lazy-modal" role="status">Cargando Planificar…</div>}><LazyPlanner savedPlaces={plannerPlaces} onClose={() => setPlannerOpen(false)} /></Suspense>}
  </AppShell>;
}
