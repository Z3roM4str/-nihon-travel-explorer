import type { Place } from "../types";
import { emptyReviewPlace, reviewPresentation, setDisposition, type Disposition, type ReviewPlace, type ReviewStore } from "./review";

export type TripFilter = "Todos"|"Ambos"|"Fernando"|"Ella"|"Pendientes"|"Descartados"|"Ninguno"|"Gustos diferentes";
export type TripSort = "recommendation"|"priority"|"name"|"hub";
const gradeRank:Record<string,number>={S:0,A:1,B:2,C:3,D:4};
const priorityRank:Record<string,number>={Alta:0,Media:1,Baja:2,"Por decidir":3};

export function isRelevant(record:ReviewPlace){return record.disposition!=="discarded"&&(record.votes.fernando==="yes"||record.votes.ella==="yes"||record.inReviewQueue||record.legacy||record.disposition==="shortlisted");}
export function matchesTripFilter(record:ReviewPlace,filter:TripFilter){
  const buckets=reviewPresentation(record.votes.fernando,record.votes.ella,record.inReviewQueue).buckets;
  if(filter==="Todos")return isRelevant(record);
  if(filter==="Descartados")return record.disposition==="discarded";
  if(record.disposition==="discarded")return false;
  if(filter==="Fernando")return record.votes.fernando==="yes";
  if(filter==="Ella")return record.votes.ella==="yes";
  return buckets.includes(filter);
}
export function tripCounts(store:ReviewStore){const records=Object.values(store.places);return {both:records.filter(r=>r.disposition!=="discarded"&&r.votes.fernando==="yes"&&r.votes.ella==="yes").length,pending:records.filter(r=>r.disposition!=="discarded"&&reviewPresentation(r.votes.fernando,r.votes.ella,r.inReviewQueue).buckets.includes("Pendientes")).length};}
export function sortTripPlaces(places:Place[],store:ReviewStore,sort:TripSort="recommendation"){
  return [...places].sort((a,b)=>{let n=0;if(sort==="recommendation")n=(gradeRank[a.grade]??99)-(gradeRank[b.grade]??99);if(sort==="priority")n=(priorityRank[store.places[a.id]?.priority??""]??99)-(priorityRank[store.places[b.id]?.priority??""]??99);if(sort==="name")n=a.name.localeCompare(b.name,"es");if(sort==="hub")n=a.hub.localeCompare(b.hub,"es");return n||a.id.localeCompare(b.id);});
}
export function groupedTripIds(places:Place[],store:ReviewStore,sort:TripSort="recommendation"){
  const sorted=sortTripPlaces(places.filter(p=>isRelevant(store.places[p.id]??emptyReviewPlace(p.id))),store,sort);const used=new Set<string>();
  const take=(test:(r:ReviewPlace)=>boolean)=>sorted.filter(p=>!used.has(p.id)&&test(store.places[p.id]??emptyReviewPlace(p.id))).map(p=>(used.add(p.id),p.id));
  return [{label:"Ambos",ids:take(r=>r.votes.fernando==="yes"&&r.votes.ella==="yes")},{label:"Por comparar",ids:take(r=>reviewPresentation(r.votes.fernando,r.votes.ella,r.inReviewQueue).buckets.includes("Pendientes"))},{label:"Otros intereses",ids:take(()=>true)}];
}
export function stableReviewQueue(store:ReviewStore){return Object.values(store.places).filter(r=>r.disposition!=="discarded"&&reviewPresentation(r.votes.fernando,r.votes.ella,r.inReviewQueue).buckets.includes("Pendientes")).map(r=>r.placeId).sort();}
export function applyDispositionBatch(store:ReviewStore,ids:string[],disposition:Disposition){return ids.reduce((next,id)=>setDisposition(next,id,disposition),store);}
export type DispositionSnapshot=Record<string,Disposition|undefined>;
export function snapshotDispositions(store:ReviewStore,ids:string[]):DispositionSnapshot{return Object.fromEntries(ids.map(id=>[id,store.places[id]?.disposition]));}
export function restoreDispositions(store:ReviewStore,snapshot:DispositionSnapshot):ReviewStore{const places={...store.places};for(const [id,disposition] of Object.entries(snapshot)){const current=places[id]??emptyReviewPlace(id);const next={...current};if(disposition)next.disposition=disposition;else delete next.disposition;places[id]=next;}return {...store,places};}
