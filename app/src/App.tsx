import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./astra/AppShell";
import { Discovery } from "./astra/Discovery";
import { EMPTY_EXPLORE_STATE, exploreHref, parseAstraRoute, type ExploreState } from "./astra/navigation";
import { readAuthoredPlanIds } from "./astra/plan-safety";
import { RouteDialog } from "./astra/RouteDialog";
import { getAllPlaces, getHubs, getNearby, getPlaceById } from "./data/store";
import { resolvePlaceImages } from "./data/place-images";
import { resolveDuration, formatRange } from "./lib/duration";
import { PlaceDetail } from "./components/PlaceDetail";
import { SelectionAnalysis } from "./components/SelectionAnalysis";
import { useReview } from "./astra/useReview";
import { getPlannerEligibility, reviewPresentation, type Reviewer } from "./astra/review";
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
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [pendingInterest, setPendingInterest] = useState<string|null>(null);
  const [identityOpener, setIdentityOpener] = useState<HTMLElement|null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimOpener, setClaimOpener] = useState<HTMLElement|null>(null);
  const [reconsiderId, setReconsiderId] = useState<string|null>(null);
  const [reconsiderOpener, setReconsiderOpener] = useState<HTMLElement|null>(null);
  const [removedVote, setRemovedVote] = useState<{id:string;reviewer:Reviewer}|null>(null);
  const [pendingRemovedVote, setPendingRemovedVote] = useState<{id:string;reviewer:Reviewer}|null>(null);
  const [lastExplore, setLastExplore] = useState<ExploreState>(() => {
    if (route.surface === "explore") return route;
    const saved = history.state?.astraExploreOrigin;
    const parsed = typeof saved === "string" ? parseAstraRoute(saved) : null;
    return parsed?.surface === "explore" ? parsed : EMPTY_EXPLORE_STATE;
  });
  const review=useReview();
  const places = useMemo(() => getAllPlaces(), []);
  const reviewIds=useMemo(()=>Object.values(review.store.places).filter(p=>p.inReviewQueue||p.votes.fernando==="yes"||p.votes.ella==="yes"||p.disposition==="shortlisted").map(p=>p.placeId),[review.store]);
  const activeYesIds=useMemo(()=>review.store.activeReviewer?Object.values(review.store.places).filter(p=>p.votes[review.store.activeReviewer!]==="yes").map(p=>p.placeId):[],[review.store]);
  const statuses=useMemo(()=>Object.fromEntries(Object.values(review.store.places).map(p=>{const x=reviewPresentation(p.votes.fernando,p.votes.ella,p.inReviewQueue);return [p.placeId,{label:p.legacy&&p.votes.fernando==="unreviewed"&&p.votes.ella==="unreviewed"?"Guardado anterior · Sin asignar":x.label,together:x.hearts===2}]})),[review.store]);
  const savedPlaces = useMemo(() => reviewIds.map(getPlaceById).filter((p): p is NonNullable<typeof p> => Boolean(p)), [reviewIds]);
  const hasPlannerContent = getPlannerEligibility(review.legacyIds,review.store).size > 0 || readAuthoredPlanIds(localStorage).size > 0;

  const plannerPlaces = useMemo(() => {
    const plannerIds = new Set([...getPlannerEligibility(review.legacyIds,review.store), ...readAuthoredPlanIds(localStorage)]);
    return [...plannerIds].map(getPlaceById).filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [review.legacyIds, review.store, plannerOpen]);

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
    const reviewer=review.store.activeReviewer;if(!reviewer){setIdentityOpener(document.activeElement as HTMLElement);setPendingInterest(id);return;}
    const current=review.store.places[id]?.votes[reviewer]??"unreviewed";
    if(review.store.places[id]?.disposition==="discarded"&&current!=="yes"){setReconsiderOpener(document.activeElement as HTMLElement);setReconsiderId(id);return;}
    const succeeded=review.toggleInterest(id,reviewer);
    if(current==="yes"){
      if(succeeded)setRemovedVote({id,reviewer});
      else setPendingRemovedVote({id,reviewer});
    }
  }, [review]);
  const retryReview=useCallback(()=>{const succeeded=review.retrySave();if(succeeded&&pendingRemovedVote){setRemovedVote(pendingRemovedVote);setPendingRemovedVote(null);}return succeeded;},[review,pendingRemovedVote]);

  const place = route.surface === "place" ? getPlaceById(route.placeId) : undefined;
  const destination = route.surface === "trip" ? "trip" : "explore";
  const reviewerName=review.store.activeReviewer==="fernando"?"Fernando":review.store.activeReviewer==="ella"?"Ella":undefined;
  return <AppShell destination={destination} savedCount={reviewIds.length} reviewer={review.store.activeReviewer} onReviewer={review.chooseReviewer}>
    <div id="astra-content">
      {(route.surface === "explore" || route.surface === "place") && <Discovery places={places} hubs={getHubs()} state={route.surface === "explore" ? route : lastExplore} savedIds={activeYesIds} statuses={statuses} reviewerName={reviewerName} onToggle={safeToggle} onState={navigateExplore} onOpen={openPlace} onRegions={openRegions} />}
      {route.surface === "explore" && review.error && <PersistenceNotice error={review.error} onRetry={retryReview} />}
      {route.surface === "regions" && <section className="astra-regions"><a className="astra-back" href={exploreHref(lastExplore)}>← Volver a Explorar</a><Suspense fallback={<div role="status">Cargando regiones…</div>}><LazyNationalExplorer activeRegion={region} selectedCode={prefectureCode} onSelectRegion={setRegion} onSelectPrefecture={(code) => { setPrefectureCode(code); if (code) setRegion(getPrefectureByCode(code)?.region ?? region); }} onEnterHub={(hub) => navigateExplore({...EMPTY_EXPLORE_STATE,hub})} /></Suspense></section>}
      {route.surface === "trip" && <section className="astra-trip">
        <p className="astra-eyebrow">INTERESES</p>
        <h1>Nuestro viaje</h1>
        <p className="astra-trip__note">Aquí reunimos lo que nos interesa. Guardar un lugar no lo añade todavía al itinerario.</p>
        <p className="astra-trip__storage">Dos perfiles en este dispositivo. {reviewerName?`Revisando como ${reviewerName}.`:"Elige quién revisa."}</p>

        {review.error && (
          <PersistenceNotice error={review.error} onRetry={retryReview} />
        )}
        {review.legacyIds.length>0&&!review.store.legacyClaim&&review.store.activeReviewer&&<button type="button" onClick={()=>{setClaimOpener(document.activeElement as HTMLElement);setClaimOpen(true);}}>Estos guardados son míos ({review.legacyIds.length})</button>}
        {savedPlaces.length ? (
          <ul>
            {savedPlaces.map(p => {
              const record=review.store.places[p.id];
              const thumbnail = resolvePlaceImages(p.id, p.images)[0];
              const duration = resolveDuration(p.duration);
              return (
                <li key={p.id}>
                  {thumbnail && <img className="astra-trip__thumbnail" src={thumbnail.url} alt="" loading="lazy" />}
                  <div className="astra-trip__place"><a href={`#/lugar/${p.id}?hub=${encodeURIComponent(p.hub)}`} onClick={event => { event.preventDefault(); openPlace(p.id); }}>{p.name}</a><span>{p.hub} · {duration ? formatRange(duration) : p.duration.raw}</span></div>
                  <div className="astra-trip__item-actions">
                    <p>{statuses[p.id]?.together&&<span aria-hidden="true">♥ ♥ </span>}{statuses[p.id]?.label}</p>
                    {review.store.activeReviewer&&<button type="button" onClick={()=>review.vote(p.id,review.store.activeReviewer!,"no")}>Ahora no</button>}
                    {review.store.activeReviewer&&record?.votes[review.store.activeReviewer]!=="unreviewed"&&<button type="button" onClick={()=>review.vote(p.id,review.store.activeReviewer!,"unreviewed")}>Restablecer mi respuesta</button>}
                    {record?.inReviewQueue&&record.votes.fernando==="unreviewed"&&record.votes.ella==="unreviewed"&&!record.legacy&&!readAuthoredPlanIds(localStorage).has(p.id)&&<button type="button" onClick={()=>review.removeFromQueue(p.id,false)}>Quitar de pendientes</button>}
                    <button type="button" onClick={()=>review.disposition(p.id,record?.disposition==="discarded"?"candidate":"discarded")}>{record?.disposition==="discarded"?"Restaurar":"Descartar del viaje"}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="astra-empty"><h2>Su viaje empieza con un lugar</h2><a href="#/explorar">Explorar Japón</a></div>
        )}
        <div className="astra-trip__actions">
          <button onClick={() => setAnalysisOpen(true)}>Comparar selección</button>
          <button className={hasPlannerContent ? "astra-trip__planner-action astra-trip__planner-action--primary" : "astra-trip__planner-action"} onClick={() => setPlannerOpen(true)}>Planificar con mis guardados</button>
        </div>
      </section>}
    </div>
    {place && <RouteDialog label={`Detalles de ${place.name}`} onClose={closeDetail} returnFocus={opener}>{review.error && <PersistenceNotice error={review.error} onRetry={retryReview} />}<PlaceDetail place={place} isSaved={activeYesIds.includes(place.id)} onToggleSaved={safeToggle} onClose={closeDetail} nearby={getNearby(place.id)} onSelectNearby={openPlace} getPlace={getPlaceById} previousPlace={null} onBack={closeDetail} /></RouteDialog>}
    {pendingInterest&&<RouteDialog role="dialog" labelledBy="reviewer-title" onClose={()=>setPendingInterest(null)} returnFocus={identityOpener} overlayClassName="astra-confirm" panelClassName="astra-confirm__panel"><h2 id="reviewer-title">¿De quién son estos gustos?</h2><p>Dos perfiles en este dispositivo</p>{(["fernando","ella"] as Reviewer[]).map(r=><button key={r} onClick={()=>{if(review.commit({...review.store,activeReviewer:r,places:{...review.store.places,[pendingInterest]:{...(review.store.places[pendingInterest]??{placeId:pendingInterest,votes:{fernando:"unreviewed",ella:"unreviewed"},legacy:false}),votes:{...(review.store.places[pendingInterest]?.votes??{fernando:"unreviewed",ella:"unreviewed"}),[r]:"yes"},inReviewQueue:true}}}))setPendingInterest(null);}}>{r==="fernando"?"Fernando":"Ella"}</button>)}<button onClick={()=>setPendingInterest(null)}>Cancelar</button></RouteDialog>}
    {claimOpen&&review.store.activeReviewer&&<RouteDialog role="alertdialog" labelledBy="claim-title" onClose={()=>setClaimOpen(false)} returnFocus={claimOpener} overlayClassName="astra-confirm" panelClassName="astra-confirm__panel"><h2 id="claim-title">¿Asignar estos guardados?</h2><p>Se asignarán {review.legacyIds.length} guardados anteriores exclusivamente a {reviewerName}. La lista anterior se conservará.</p><button onClick={()=>setClaimOpen(false)}>Cancelar</button><button onClick={()=>{review.claim(review.store.activeReviewer!);setClaimOpen(false);}}>Confirmar</button></RouteDialog>}
    {reconsiderId&&review.store.activeReviewer&&<RouteDialog role="alertdialog" labelledBy="reconsider-title" onClose={()=>setReconsiderId(null)} returnFocus={reconsiderOpener} overlayClassName="astra-confirm" panelClassName="astra-confirm__panel"><h2 id="reconsider-title">¿Volver a considerar este lugar?</h2><button onClick={()=>setReconsiderId(null)}>Cancelar</button><button onClick={()=>{if(review.reconsider(reconsiderId,review.store.activeReviewer!))setReconsiderId(null);}}>Confirmar</button></RouteDialog>}
    {removedVote&&<div className="astra-toast" role="status">Interés retirado <button onClick={()=>{review.vote(removedVote.id,removedVote.reviewer,"yes");setRemovedVote(null);}}>Deshacer</button></div>}
    {analysisOpen && <SelectionAnalysis savedPlaces={savedPlaces} onSelectPlace={(id) => { setAnalysisOpen(false); openPlace(id); }} onClose={() => setAnalysisOpen(false)} />}
    {plannerOpen && <Suspense fallback={<div className="astra-lazy-modal" role="status">Cargando Planificar…</div>}><LazyPlanner savedPlaces={plannerPlaces} onClose={() => setPlannerOpen(false)} /></Suspense>}
  </AppShell>;
}
