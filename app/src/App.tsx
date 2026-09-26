import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./astra/AppShell";
import { Discovery } from "./astra/Discovery";
import { EMPTY_EXPLORE_STATE, exploreHref, parseAstraRoute, type ExploreState } from "./astra/navigation";
import { readAuthoredPlanIds } from "./astra/plan-safety";
import { RouteDialog } from "./astra/RouteDialog";
import { getAllPlaces, getHubs, getNearby, getPlaceById } from "./data/store";
import { PlaceDetail } from "./components/PlaceDetail";
import { SelectionAnalysis } from "./components/SelectionAnalysis";
import { useReview } from "./astra/useReview";
import { getPlannerEligibility, reviewPresentation, type Reviewer } from "./astra/review";
import { OurTrip } from "./astra/OurTrip";
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
  const [plannerRevision, setPlannerRevision] = useState(0);
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
  const plannerPlaces = useMemo(() => {
    void plannerRevision; // explicit cache-buster: localStorage can change without a React state update
    const plannerIds = new Set([...getPlannerEligibility(review.legacyIds,review.store), ...readAuthoredPlanIds(localStorage)]);
    return [...plannerIds].map(getPlaceById).filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [review.legacyIds, review.store, plannerRevision]);

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
  const openPlanner=useCallback(()=>{setPlannerRevision(value=>value+1);setPlannerOpen(true);},[]);

  const place = route.surface === "place" ? getPlaceById(route.placeId) : undefined;
  const destination = route.surface === "trip" ? "trip" : "explore";
  const reviewerName=review.store.activeReviewer==="fernando"?"Fernando":review.store.activeReviewer==="ella"?"Ella":undefined;
  return <AppShell destination={destination} savedCount={reviewIds.length} reviewer={review.store.activeReviewer} onReviewer={review.chooseReviewer}>
    <div id="astra-content">
      {(route.surface === "explore" || route.surface === "place") && <Discovery places={places} hubs={getHubs()} state={route.surface === "explore" ? route : lastExplore} savedIds={activeYesIds} statuses={statuses} reviewerName={reviewerName} onToggle={safeToggle} onState={navigateExplore} onOpen={openPlace} onRegions={openRegions} />}
      {route.surface === "explore" && review.error && <PersistenceNotice error={review.error} onRetry={retryReview} />}
      {route.surface === "regions" && <section className="astra-regions"><a className="astra-back" href={exploreHref(lastExplore)}>← Volver a Explorar</a><Suspense fallback={<div role="status">Cargando regiones…</div>}><LazyNationalExplorer activeRegion={region} selectedCode={prefectureCode} onSelectRegion={setRegion} onSelectPrefecture={(code) => { setPrefectureCode(code); if (code) setRegion(getPrefectureByCode(code)?.region ?? region); }} onEnterHub={(hub) => navigateExplore({...EMPTY_EXPLORE_STATE,hub})} /></Suspense></section>}
      {route.surface === "trip" && <><p className="astra-trip__storage">Dos perfiles en este dispositivo. {reviewerName?`Revisando como ${reviewerName}.`:"Elige quién revisa."}</p>{review.error&&<PersistenceNotice error={review.error} onRetry={retryReview}/>} {review.legacyIds.length>0&&!review.store.legacyClaim&&review.store.activeReviewer&&<button type="button" onClick={()=>{setClaimOpener(document.activeElement as HTMLElement);setClaimOpen(true);}}>Estos guardados son míos ({review.legacyIds.length})</button>}<OurTrip places={places} store={review.store} error={review.error} onCommit={review.commit} onRetry={retryReview} onToggleInterest={safeToggle} onResetResponse={(id)=>review.store.activeReviewer?review.vote(id,review.store.activeReviewer,"unreviewed"):false} onRemoveFromQueue={(id)=>review.removeFromQueue(id,readAuthoredPlanIds(localStorage).has(id))} isAuthored={(id)=>readAuthoredPlanIds(localStorage).has(id)} hasAuthoredPlan={()=>readAuthoredPlanIds(localStorage).size>0} onOpen={openPlace} onExplore={()=>{location.hash="#/explorar"}} onAnalysis={()=>setAnalysisOpen(true)} onPlanner={openPlanner}/></>}
    </div>
    {place && <RouteDialog label={`Detalles de ${place.name}`} onClose={closeDetail} returnFocus={opener}>{review.error && <PersistenceNotice error={review.error} onRetry={retryReview} />}<PlaceDetail place={place} isSaved={activeYesIds.includes(place.id)} onToggleSaved={safeToggle} onClose={closeDetail} nearby={getNearby(place.id)} onSelectNearby={openPlace} getPlace={getPlaceById} previousPlace={null} onBack={closeDetail} /></RouteDialog>}
    {pendingInterest&&<RouteDialog role="dialog" labelledBy="reviewer-title" onClose={()=>setPendingInterest(null)} returnFocus={identityOpener} overlayClassName="astra-confirm" panelClassName="astra-confirm__panel"><h2 id="reviewer-title">¿De quién son estos gustos?</h2><p>Dos perfiles en este dispositivo</p>{(["fernando","ella"] as Reviewer[]).map(r=><button key={r} onClick={()=>{if(review.commit({...review.store,activeReviewer:r,places:{...review.store.places,[pendingInterest]:{...(review.store.places[pendingInterest]??{placeId:pendingInterest,votes:{fernando:"unreviewed",ella:"unreviewed"},legacy:false}),votes:{...(review.store.places[pendingInterest]?.votes??{fernando:"unreviewed",ella:"unreviewed"}),[r]:"yes"},inReviewQueue:true}}}))setPendingInterest(null);}}>{r==="fernando"?"Fernando":"Ella"}</button>)}<button onClick={()=>setPendingInterest(null)}>Cancelar</button></RouteDialog>}
    {claimOpen&&review.store.activeReviewer&&<RouteDialog role="alertdialog" labelledBy="claim-title" onClose={()=>setClaimOpen(false)} returnFocus={claimOpener} overlayClassName="astra-confirm" panelClassName="astra-confirm__panel"><h2 id="claim-title">¿Asignar estos guardados?</h2><p>Se asignarán {review.legacyIds.length} guardados anteriores exclusivamente a {reviewerName}. La lista anterior se conservará.</p><button onClick={()=>setClaimOpen(false)}>Cancelar</button><button onClick={()=>{review.claim(review.store.activeReviewer!);setClaimOpen(false);}}>Confirmar</button></RouteDialog>}
    {reconsiderId&&review.store.activeReviewer&&<RouteDialog role="alertdialog" labelledBy="reconsider-title" onClose={()=>setReconsiderId(null)} returnFocus={reconsiderOpener} overlayClassName="astra-confirm" panelClassName="astra-confirm__panel"><h2 id="reconsider-title">¿Volver a considerar este lugar?</h2><button onClick={()=>setReconsiderId(null)}>Cancelar</button><button onClick={()=>{if(review.reconsider(reconsiderId,review.store.activeReviewer!))setReconsiderId(null);}}>Confirmar</button></RouteDialog>}
    {removedVote&&<div className="astra-toast" role="status">Interés retirado <button onClick={()=>{review.vote(removedVote.id,removedVote.reviewer,"yes");setRemovedVote(null);}}>Deshacer</button></div>}
    {analysisOpen && <SelectionAnalysis savedPlaces={plannerPlaces} onSelectPlace={(id) => { setAnalysisOpen(false); openPlace(id); }} onClose={() => setAnalysisOpen(false)} />}
    {plannerOpen && <Suspense fallback={<div className="astra-lazy-modal" role="status">Cargando Planificar…</div>}><LazyPlanner savedPlaces={plannerPlaces} onClose={() => setPlannerOpen(false)} /></Suspense>}
  </AppShell>;
}
