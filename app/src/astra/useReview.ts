import { useCallback, useMemo, useState } from "react";
import { bridgeLegacy, claimLegacy, readLegacySaved } from "./review-migration";
import { REVIEW_STORAGE_KEY, parseReviewStore, reconsiderWithYes, removeFromQueue, setActiveReviewer, setDisposition, setPriority, setVote, toggleYes, type Disposition, type Reviewer, type ReviewStore, type TripPriority, type Vote } from "./review";

export function persistReview(storage:Pick<Storage,"setItem">,store:ReviewStore):{ok:true}|{ok:false;error:string}{
  try{storage.setItem(REVIEW_STORAGE_KEY,JSON.stringify(store));return {ok:true};}catch(e){return {ok:false,error:e instanceof Error?e.message:"No se pudo guardar"};}
}

export function useReview(storage:Storage=localStorage){
  const initial=useMemo(()=>{const parsed=parseReviewStore(storage.getItem(REVIEW_STORAGE_KEY));return {parsed,store:bridgeLegacy(parsed.store,readLegacySaved(storage))};},[storage]);
  const [durable,setDurable]=useState<ReviewStore>(initial.store); const [error,setError]=useState<string|null>(initial.parsed.kind==="invalid"||initial.parsed.kind==="newer"?initial.parsed.message:null); const [retry,setRetry]=useState<ReviewStore|null>(null);
  const locked=initial.parsed.kind==="invalid"||initial.parsed.kind==="newer";
  const commit=useCallback((next:ReviewStore)=>{if(locked){setError(initial.parsed.kind==="ok"||initial.parsed.kind==="missing"?null:initial.parsed.message);return false;}const result=persistReview(storage,next);if(result.ok){setDurable(next);setRetry(null);setError(null);return true;}setRetry(next);setError(result.error);return false;},[initial.parsed,locked,storage]);
  const mutate=useCallback((fn:(s:ReviewStore)=>ReviewStore)=>commit(fn(durable)),[commit,durable]);
  return {store:durable,error,pendingRetry:retry!==null,legacyIds:readLegacySaved(storage),commit,retrySave:()=>retry?commit(retry):true,
    chooseReviewer:(r:Reviewer)=>mutate(s=>setActiveReviewer(s,r)),
    vote:(id:string,r:Reviewer,v:Vote)=>mutate(s=>setVote(s,id,r,v)),toggleInterest:(id:string,r:Reviewer)=>mutate(s=>toggleYes(s,id,r)),
    reconsider:(id:string,r:Reviewer)=>mutate(s=>reconsiderWithYes(s,id,r)),
    removeFromQueue:(id:string,authored:boolean)=>mutate(s=>removeFromQueue(s,id,authored)),
    disposition:(id:string,d:Disposition)=>mutate(s=>setDisposition(s,id,d)),priority:(id:string,p:TripPriority)=>mutate(s=>setPriority(s,id,p)),
    claim:(r:Reviewer)=>mutate(s=>claimLegacy(s,readLegacySaved(storage),r))};
}
