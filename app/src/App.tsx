import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./astra/AppShell";
import { Discovery } from "./astra/Discovery";
import { EMPTY_EXPLORE_STATE, exploreHref, parseAstraRoute, type ExploreState } from "./astra/navigation";
import { canRemoveSavedPlace, readAuthoredPlanIds } from "./astra/plan-safety";
import { RouteDialog } from "./astra/RouteDialog";
import { getAllPlaces, getHubs, getNearby, getPlaceById } from "./data/store";
import { resolvePlaceImages } from "./data/place-images";
import { resolveDuration, formatRange } from "./lib/duration";
import { PlaceDetail } from "./components/PlaceDetail";
import { SelectionAnalysis } from "./components/SelectionAnalysis";
import { useSavedPlaces } from "./useSavedPlaces";
import type { NavigationRegion } from "./data/geography";
import { getPrefectureByCode } from "./data/geography";
import "./App.css";
import "./astra/astra.css";

const LazyNationalExplorer = lazy(() => import("./components/NationalExplorer").then(module => ({ default: module.NationalExplorer })));
const LazyPlanner = lazy(() => import("./components/OrderedSequenceBuilder").then(module => ({ default: module.OrderedSequenceBuilder })));

function PersistenceNotice({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return <div role="alert" className="astra-persistence-notice"><div>
    <strong>No se pudieron guardar los cambios en este dispositivo.</strong>
    <p>Tus cambios siguen disponibles en esta sesión. Intenta guardarlos de nuevo.</p>
    {error && <p className="astra-persistence-notice__detail">Detalle: {error}</p>}
  </div><button type="button" onClick={onRetry}>Reintentar guardar</button></div>;
}

export default function App() {
  const [route, setRoute] = useState(() => parseAstraRoute(location.hash));
  const [region, setRegion] = useState<NavigationRegion | null>(null);
  const [prefectureCode, setPrefectureCode] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannedRemoval, setPlannedRemoval] = useState<string | null>(null);
  const [removalOpener, setRemovalOpener] = useState<HTMLElement | null>(null);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [lastExplore, setLastExplore] = useState<ExploreState>(() => {
    if (route.surface === "explore") return route;
    const saved = history.state?.astraExploreOrigin;
    const parsed = typeof saved === "string" ? parseAstraRoute(saved) : null;
    return parsed?.surface === "explore" ? parsed : EMPTY_EXPLORE_STATE;
  });
  const { savedIds, isSaved, toggleSaved, removeSaved, getInterestsForMember, getCoincidences, toggleMemberInterest, syncState, saveError, retrySave } = useSavedPlaces();
  const [tripTab, setTripTab] = useState<"todos" | "fernando" | "lorena" | "coincidencias">("todos");
  const places = useMemo(() => getAllPlaces(), []);

  const fernandoIds = useMemo(() => getInterestsForMember("fernando"), [getInterestsForMember]);
  const lorenaIds = useMemo(() => getInterestsForMember("lorena"), [getInterestsForMember]);
  const coincidenceIds = useMemo(() => getCoincidences(), [getCoincidences]);
  const todosIds = useMemo(() => Array.from(new Set([...savedIds, ...fernandoIds, ...lorenaIds])), [savedIds, fernandoIds, lorenaIds]);

  const savedPlaces = useMemo(() => todosIds.map(getPlaceById).filter((p): p is NonNullable<typeof p> => Boolean(p)), [todosIds]);

  const activeTripPlaces = useMemo(() => {
    let ids: string[] = [];
    if (tripTab === "todos") ids = todosIds;
    else if (tripTab === "fernando") ids = fernandoIds;
    else if (tripTab === "lorena") ids = lorenaIds;
    else if (tripTab === "coincidencias") ids = coincidenceIds;
    return ids.map(getPlaceById).filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [tripTab, todosIds, fernandoIds, lorenaIds, coincidenceIds]);

  const hasPlannerContent = todosIds.length > 0 || readAuthoredPlanIds(localStorage).size > 0;

  const plannerPlaces = useMemo(() => {
    const plannerIds = new Set([...todosIds, ...readAuthoredPlanIds(localStorage)]);
    return [...plannerIds].map(getPlaceById).filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [todosIds, plannerOpen]);

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
    if (route.surface !== "place") setOpener(document.activeElement as HTMLElement);
    const place=getPlaceById(id); if (!place) return;
    history.pushState({ astraOrigin:true, explore:lastExplore }, "", `#/lugar/${id}?hub=${encodeURIComponent(place.hub)}`);
    setRoute(parseAstraRoute(location.hash));
  }, [lastExplore, route.surface]);
  const openRegions = useCallback(() => {
    const origin = exploreHref(lastExplore);
    history.pushState({ astraExploreOrigin:origin }, "", "#/regiones");
    setRoute(parseAstraRoute(location.hash));
  }, [lastExplore]);
  const closeDetail = useCallback(() => {
    if (history.state?.astraOrigin) history.back();
    else { const href=exploreHref(lastExplore); history.replaceState(null,"",href); setRoute(parseAstraRoute(href)); }
  }, [lastExplore]);
  const safeToggle = useCallback((id: string) => {
    if (isSaved(id) && !canRemoveSavedPlace(id, localStorage)) { setRemovalOpener(document.activeElement as HTMLElement); setPlannedRemoval(id); return; }
    toggleSaved(id);
  }, [isSaved, toggleSaved]);
  const safeRemove = useCallback((id: string) => {
    if (!canRemoveSavedPlace(id, localStorage)) { setRemovalOpener(document.activeElement as HTMLElement); setPlannedRemoval(id); return; }
    removeSaved(id);
  }, [removeSaved]);

  const place = route.surface === "place" ? getPlaceById(route.placeId) : undefined;
  const destination = route.surface === "trip" ? "trip" : "explore";
  return <AppShell destination={destination} savedCount={todosIds.length}>
    <div id="astra-content">
      {(route.surface === "explore" || route.surface === "place") && <Discovery places={places} hubs={getHubs()} state={route.surface === "explore" ? route : lastExplore} savedIds={savedIds} onToggle={safeToggle} onState={navigateExplore} onOpen={openPlace} onRegions={openRegions} />}
      {route.surface === "explore" && syncState === "error" && <PersistenceNotice error={saveError} onRetry={retrySave} />}
      {route.surface === "regions" && <section className="astra-regions"><a className="astra-back" href={exploreHref(lastExplore)}>← Volver a Explorar</a><Suspense fallback={<div role="status">Cargando regiones…</div>}><LazyNationalExplorer activeRegion={region} selectedCode={prefectureCode} onSelectRegion={setRegion} onSelectPrefecture={(code) => { setPrefectureCode(code); if (code) setRegion(getPrefectureByCode(code)?.region ?? region); }} onEnterHub={(hub) => navigateExplore({...EMPTY_EXPLORE_STATE,hub})} /></Suspense></section>}
      {route.surface === "trip" && <section className="astra-trip">
        <p className="astra-eyebrow">MIS GUARDADOS</p>
        <h1>Nuestro viaje</h1>
        <p className="astra-trip__note">Aquí reunimos lo que nos interesa. Guardar un lugar no lo añade todavía al itinerario.</p>
        <p className="astra-trip__storage">{syncState === "error" ? "Los cambios de esta sesión aún no se guardaron en el dispositivo." : "Guardados en este dispositivo."}</p>

        {syncState === "error" && (
          <PersistenceNotice error={saveError} onRetry={retrySave} />
        )}

        <div className="astra-trip__tabs">
          <button type="button" aria-pressed={tripTab === "todos"} onClick={() => setTripTab("todos")}>Todos ({todosIds.length})</button>
          <button type="button" aria-pressed={tripTab === "fernando"} onClick={() => setTripTab("fernando")}>Fernando ({fernandoIds.length})</button>
          <button type="button" aria-pressed={tripTab === "lorena"} onClick={() => setTripTab("lorena")}>Lorena ({lorenaIds.length})</button>
          <button type="button" aria-pressed={tripTab === "coincidencias"} onClick={() => setTripTab("coincidencias")}>Coincidencias ({coincidenceIds.length})</button>
        </div>

        {activeTripPlaces.length ? (
          <ul>
            {activeTripPlaces.map(p => {
              const isFernando = fernandoIds.includes(p.id);
              const isLorena = lorenaIds.includes(p.id);
              const isLegacySaved = savedIds.includes(p.id);
              const thumbnail = resolvePlaceImages(p.id, p.images)[0];
              const duration = resolveDuration(p.duration);
              return (
                <li key={p.id}>
                  {thumbnail && <img className="astra-trip__thumbnail" src={thumbnail.url} alt="" loading="lazy" />}
                  <div className="astra-trip__place"><a href={`#/lugar/${p.id}?hub=${encodeURIComponent(p.hub)}`} onClick={event => { event.preventDefault(); openPlace(p.id); }}>{p.name}</a><span>{p.hub} · {duration ? formatRange(duration) : p.duration.raw}</span></div>
                  <div className="astra-trip__item-actions">
                    <button
                      type="button"
                      aria-pressed={isFernando}
                      onClick={() => toggleMemberInterest("fernando", p.id)}
                    >
                      {isFernando ? "★ Fernando" : "☆ Fernando"}
                    </button>
                    <button
                      type="button"
                      aria-pressed={isLorena}
                      onClick={() => toggleMemberInterest("lorena", p.id)}
                    >
                      {isLorena ? "★ Lorena" : "☆ Lorena"}
                    </button>
                    {isLegacySaved && (
                      <button
                        type="button"
                        onClick={() => safeRemove(p.id)}
                      >
                        Quitar de guardados generales
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="astra-empty">{tripTab === "coincidencias" ? <><h2>Todavía no han marcado el mismo lugar</h2><p>Sus elecciones individuales siguen guardadas.</p></> : <><h2>Empiecen por un lugar que les emocione</h2><a href="#/explorar">Explorar lugares</a></>}</div>
        )}

        {savedIds.length > 0 && <p className="astra-trip__help">Los intereses de Fernando y Lorena se mantienen al quitar un lugar de guardados generales.</p>}
        <div className="astra-trip__actions">
          <button onClick={() => setAnalysisOpen(true)}>Comparar selección</button>
          <button className={hasPlannerContent ? "astra-trip__planner-action astra-trip__planner-action--primary" : "astra-trip__planner-action"} onClick={() => setPlannerOpen(true)}>Planificar con mis guardados</button>
        </div>
      </section>}
    </div>
    {place && <RouteDialog label={`Detalles de ${place.name}`} onClose={closeDetail} returnFocus={opener}>{syncState === "error" && <PersistenceNotice error={saveError} onRetry={retrySave} />}<PlaceDetail place={place} isSaved={isSaved(place.id)} onToggleSaved={safeToggle} onClose={closeDetail} nearby={getNearby(place.id)} onSelectNearby={openPlace} getPlace={getPlaceById} previousPlace={null} onBack={closeDetail} /></RouteDialog>}
    {plannedRemoval && <RouteDialog role="alertdialog" labelledBy="planned-title" onClose={() => setPlannedRemoval(null)} returnFocus={removalOpener} overlayClassName="astra-confirm" panelClassName="astra-confirm__panel"><h2 id="planned-title">Este lugar forma parte de tu ruta</h2><p>Para proteger el plan guardado, quítalo primero desde Planificar. No se cambió tu guardado ni tu ruta.</p><button onClick={() => setPlannedRemoval(null)}>Mantener guardado</button><button onClick={() => { setPlannedRemoval(null); setPlannerOpen(true); }}>Ir a Planificar</button></RouteDialog>}
    {analysisOpen && <SelectionAnalysis savedPlaces={savedPlaces} onSelectPlace={(id) => { setAnalysisOpen(false); openPlace(id); }} onClose={() => setAnalysisOpen(false)} />}
    {plannerOpen && <Suspense fallback={<div className="astra-lazy-modal" role="status">Cargando Planificar…</div>}><LazyPlanner savedPlaces={plannerPlaces} onClose={() => setPlannerOpen(false)} /></Suspense>}
  </AppShell>;
}
