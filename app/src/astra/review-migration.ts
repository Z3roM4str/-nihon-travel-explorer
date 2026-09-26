import { emptyReviewPlace, type ReviewStore, type Reviewer } from "./review";

export const LEGACY_SAVED_KEY="nihon.savedPlaceIds";
export const LEGACY_PLAN_KEY="nihon.manualPlanningDraft";

export function readLegacySaved(storage: Pick<Storage,"getItem">): string[] {
  try { const parsed=JSON.parse(storage.getItem(LEGACY_SAVED_KEY) ?? "[]"); return Array.isArray(parsed)?[...new Set(parsed.filter((x):x is string=>typeof x === "string"))]:[]; } catch { return []; }
}

export function bridgeLegacy(s:ReviewStore,ids:string[]):ReviewStore {
  if(!ids.length)return s; const places={...s.places};
  for(const id of ids){const p=places[id]??emptyReviewPlace(id);places[id]={...p,legacy:true,inReviewQueue:true};}
  return {...s,places};
}

export function claimLegacy(s:ReviewStore,ids:string[],reviewer:Reviewer):ReviewStore {
  if(s.legacyClaim)return s;
  const places={...s.places};
  for(const id of ids){const p=places[id]??emptyReviewPlace(id);places[id]={...p,legacy:true,inReviewQueue:true,votes:{...p.votes,[reviewer]:"yes"}};}
  return {...s,places,legacyClaim:{version:1,reviewer,ids:[...ids]}};
}
