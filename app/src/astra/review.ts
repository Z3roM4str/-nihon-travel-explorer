export const REVIEW_STORAGE_KEY = "nihon.astra.review.v1";
export const REVIEW_SCHEMA = "nihon.astra.review";
export const REVIEW_VERSION = 1;

export type Reviewer = "fernando" | "ella";
export type Vote = "unreviewed" | "yes" | "no";
export type Disposition = "candidate" | "shortlisted" | "discarded";
export type TripPriority = "Por decidir" | "Alta" | "Media" | "Baja";

export type ReviewPlace = {
  placeId: string;
  votes: Record<Reviewer, Vote>;
  inReviewQueue: boolean;
  legacy: boolean;
  disposition?: Disposition;
  priority?: TripPriority;
};

export type ReviewStore = {
  schema: typeof REVIEW_SCHEMA;
  version: typeof REVIEW_VERSION;
  activeReviewer?: Reviewer;
  places: Record<string, ReviewPlace>;
  legacyClaim?: { version: 1; reviewer: Reviewer; ids: string[] };
};

export const emptyReviewStore = (): ReviewStore => ({ schema: REVIEW_SCHEMA, version: REVIEW_VERSION, places: {} });
export const emptyReviewPlace = (placeId: string): ReviewPlace => ({
  placeId, votes: { fernando: "unreviewed", ella: "unreviewed" }, inReviewQueue: false, legacy: false
});

const votes = new Set<Vote>(["unreviewed", "yes", "no"]);
const dispositions = new Set<Disposition>(["candidate", "shortlisted", "discarded"]);
const priorities = new Set<TripPriority>(["Por decidir", "Alta", "Media", "Baja"]);

export type ReviewReadResult =
  | { kind: "ok"; store: ReviewStore }
  | { kind: "missing"; store: ReviewStore }
  | { kind: "invalid" | "newer"; store: ReviewStore; message: string };

export function parseReviewStore(raw: string | null): ReviewReadResult {
  if (raw === null) return { kind: "missing", store: emptyReviewStore() };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { kind: "invalid", store: emptyReviewStore(), message: "El estado de gustos está dañado; no se sobrescribirá." }; }
  if (!value || typeof value !== "object") return { kind: "invalid", store: emptyReviewStore(), message: "El estado de gustos no es válido; no se sobrescribirá." };
  const input = value as Record<string, unknown>;
  if (typeof input.version === "number" && input.version > REVIEW_VERSION) return { kind: "newer", store: emptyReviewStore(), message: "Estos gustos fueron creados por una versión más nueva; no se sobrescribirán." };
  if (input.schema !== REVIEW_SCHEMA || input.version !== REVIEW_VERSION || !input.places || typeof input.places !== "object") return { kind: "invalid", store: emptyReviewStore(), message: "El estado de gustos no es compatible; no se sobrescribirá." };
  const store = emptyReviewStore();
  if (input.activeReviewer === "fernando" || input.activeReviewer === "ella") store.activeReviewer = input.activeReviewer;
  for (const [id, candidate] of Object.entries(input.places as Record<string, unknown>)) {
    if (!candidate || typeof candidate !== "object") continue;
    const p = candidate as Record<string, unknown>; const v = p.votes as Record<string, unknown> | undefined;
    if (p.placeId !== id || !v || !votes.has(v.fernando as Vote) || !votes.has(v.ella as Vote)) continue;
    const record: ReviewPlace = { placeId:id, votes:{ fernando:v.fernando as Vote, ella:v.ella as Vote }, inReviewQueue:p.inReviewQueue === true, legacy:p.legacy === true };
    if (dispositions.has(p.disposition as Disposition)) record.disposition=p.disposition as Disposition;
    if (priorities.has(p.priority as TripPriority)) record.priority=p.priority as TripPriority;
    store.places[id]=record;
  }
  const claim=input.legacyClaim as Record<string, unknown> | undefined;
  if (claim?.version === 1 && (claim.reviewer === "fernando" || claim.reviewer === "ella") && Array.isArray(claim.ids)) store.legacyClaim={version:1,reviewer:claim.reviewer,ids:[...new Set(claim.ids.filter((id):id is string=>typeof id === "string"))]};
  return { kind:"ok", store };
}

function updatePlace(store: ReviewStore, id: string, update: (place: ReviewPlace) => ReviewPlace): ReviewStore {
  return { ...store, places:{ ...store.places, [id]:update(store.places[id] ?? emptyReviewPlace(id)) } };
}
export const setActiveReviewer=(s:ReviewStore,r:Reviewer):ReviewStore=>({...s,activeReviewer:r});
export const setVote=(s:ReviewStore,id:string,r:Reviewer,v:Vote):ReviewStore=>updatePlace(s,id,p=>({...p,votes:{...p.votes,[r]:v},inReviewQueue:true}));
export const toggleYes=(s:ReviewStore,id:string,r:Reviewer):ReviewStore=>setVote(s,id,r,(s.places[id]?.votes[r] ?? "unreviewed")==="yes"?"unreviewed":"yes");
export const setDisposition=(s:ReviewStore,id:string,d:Disposition):ReviewStore=>updatePlace(s,id,p=>({...p,disposition:d,inReviewQueue:true}));
export const setPriority=(s:ReviewStore,id:string,p:TripPriority):ReviewStore=>updatePlace(s,id,x=>({...x,priority:p,inReviewQueue:true}));
export function canRemoveFromQueue(p:ReviewPlace, authored:boolean):boolean { return !p.legacy && !authored && p.votes.fernando === "unreviewed" && p.votes.ella === "unreviewed"; }
export const removeFromQueue=(s:ReviewStore,id:string,authored=false):ReviewStore=>{const p=s.places[id];return p&&canRemoveFromQueue(p,authored)?updatePlace(s,id,x=>({...x,inReviewQueue:false})):s;};

export type ReviewBucket="Fernando"|"Ella"|"Ambos"|"Pendientes"|"Gustos diferentes"|"Ninguno"|"Descartados";
export function reviewPresentation(f:Vote,e:Vote,queued=false):{label:string|null;hearts:0|2;buckets:ReviewBucket[]} {
  if(f==="unreviewed"&&e==="unreviewed") return {label:queued?"Por revisar":null,hearts:0,buckets:queued?["Pendientes"]:[]};
  if(f==="yes"&&e==="unreviewed") return {label:"Fernando quiere ir · Falta Ella",hearts:0,buckets:["Fernando","Pendientes"]};
  if(f==="unreviewed"&&e==="yes") return {label:"Ella quiere ir · Falta Fernando",hearts:0,buckets:["Ella","Pendientes"]};
  if(f==="yes"&&e==="yes") return {label:"Ambos quieren ir",hearts:2,buckets:["Ambos"]};
  if(f==="yes"&&e==="no") return {label:"Fernando quiere ir · Ella: ahora no",hearts:0,buckets:["Fernando","Gustos diferentes"]};
  if(f==="no"&&e==="yes") return {label:"Ella quiere ir · Fernando: ahora no",hearts:0,buckets:["Ella","Gustos diferentes"]};
  if(f==="no"&&e==="unreviewed") return {label:"Fernando: ahora no · Falta Ella",hearts:0,buckets:queued?["Pendientes"]:[]};
  if(f==="unreviewed"&&e==="no") return {label:"Ella: ahora no · Falta Fernando",hearts:0,buckets:queued?["Pendientes"]:[]};
  return {label:"Ninguno quiere ir",hearts:0,buckets:["Ninguno"]};
}
export const getPlannerEligibility=(legacyIds:string[],s:ReviewStore)=>new Set([...legacyIds,...Object.values(s.places).filter(p=>p.disposition==="shortlisted").map(p=>p.placeId)]);
