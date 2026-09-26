import { describe, expect, it } from "vitest";
import { canRemoveFromQueue, emptyReviewPlace, emptyReviewStore, getPlannerEligibility, parseReviewStore, reconsiderWithYes, removeFromQueue, reviewPresentation, setDisposition, setPriority, setVote, toggleYes, REVIEW_STORAGE_KEY } from "./review";
import { bridgeLegacy, claimLegacy, LEGACY_PLAN_KEY, LEGACY_SAVED_KEY, readLegacySaved } from "./review-migration";
import { persistReview } from "./useReview";

const cases = [
  ["unreviewed","unreviewed",false,null,[]], ["unreviewed","unreviewed",true,"Por revisar",["Pendientes"]],
  ["yes","unreviewed",false,"Fernando quiere ir · Falta Ella",["Fernando","Pendientes"]],
  ["unreviewed","yes",false,"Ella quiere ir · Falta Fernando",["Ella","Pendientes"]],
  ["yes","yes",false,"Ambos quieren ir",["Ambos"]],
  ["yes","no",false,"Fernando quiere ir · Ella: ahora no",["Fernando","Gustos diferentes"]],
  ["no","yes",false,"Ella quiere ir · Fernando: ahora no",["Ella","Gustos diferentes"]],
  ["no","unreviewed",true,"Fernando: ahora no · Falta Ella",["Pendientes"]],
  ["unreviewed","no",true,"Ella: ahora no · Falta Fernando",["Pendientes"]],
  ["no","no",false,"Ninguno quiere ir",["Ninguno"]]
] as const;
describe("SOL-4 truth table",()=>{it.each(cases)("%s/%s",(f,e,q,label,buckets)=>expect(reviewPresentation(f,e,q)).toMatchObject({label,buckets}));it("only agreement has two hearts",()=>expect(reviewPresentation("yes","yes").hearts).toBe(2));});

describe("independent review mutations",()=>{
 it("mutates Fernando without Ella",()=>{const s=setVote(emptyReviewStore(),"JP-001","fernando","yes");expect(s.places["JP-001"].votes).toEqual({fernando:"yes",ella:"unreviewed"});});
 it("mutates Ella without Fernando",()=>{const s=setVote(emptyReviewStore(),"JP-001","ella","no");expect(s.places["JP-001"].votes).toEqual({fernando:"unreviewed",ella:"no"});});
 it("toggles unreviewed/no to yes and yes to unreviewed",()=>{let s=toggleYes(emptyReviewStore(),"x","fernando");expect(s.places.x.votes.fernando).toBe("yes");s=setVote(s,"x","fernando","no");s=toggleYes(s,"x","fernando");expect(s.places.x.votes.fernando).toBe("yes");s=toggleYes(s,"x","fernando");expect(s.places.x.votes.fernando).toBe("unreviewed");expect(s.places.x.inReviewQueue).toBe(true);});
 it("explicit no is distinct",()=>expect(setVote(emptyReviewStore(),"x","ella","no").places.x.votes.ella).toBe("no"));
 it("undo restores removed interest",()=>{const yes=setVote(emptyReviewStore(),"x","ella","yes");const removed=toggleYes(yes,"x","ella");expect(setVote(removed,"x","ella","yes")).toEqual(yes);});
 it("discard/restore retains votes",()=>{const yes=setVote(emptyReviewStore(),"x","fernando","yes");const discarded=setDisposition(yes,"x","discarded");expect(setDisposition(discarded,"x","candidate").places.x).toMatchObject({votes:yes.places.x.votes,disposition:"candidate"});});
 it("reconsiders atomically with own yes and preserves partner",()=>{const discarded=setDisposition(setVote(emptyReviewStore(),"x","ella","no"),"x","discarded");expect(reconsiderWithYes(discarded,"x","fernando").places.x).toEqual({...discarded.places.x,disposition:"candidate",inReviewQueue:true,votes:{fernando:"yes",ella:"no"}});});
 it("cancel reconsideration is the unchanged discarded store",()=>{const discarded=setDisposition(setVote(emptyReviewStore(),"x","ella","no"),"x","discarded");expect(discarded.places.x).toMatchObject({disposition:"discarded",votes:{fernando:"unreviewed",ella:"no"}});});
 it("priority is independent",()=>{const s=setPriority(setVote(emptyReviewStore(),"x","ella","no"),"x","Alta");expect(s.places.x).toMatchObject({priority:"Alta",votes:{ella:"no"}});});
 it("queue removal is gated",()=>{const plain={...emptyReviewPlace("x"),inReviewQueue:true};expect(canRemoveFromQueue(plain,false)).toBe(true);expect(canRemoveFromQueue({...plain,legacy:true},false)).toBe(false);expect(canRemoveFromQueue(plain,true)).toBe(false);expect(removeFromQueue({...emptyReviewStore(),places:{x:plain}},"x").places.x.inReviewQueue).toBe(false);});
 it("blocks queue removal when either person voted",()=>{const voted=setVote(emptyReviewStore(),"x","fernando","no");expect(removeFromQueue(voted,"x")).toBe(voted);});
 it("reset response preserves partner, queue and disposition",()=>{let s=setVote(emptyReviewStore(),"x","ella","no");s=setVote(s,"x","fernando","yes");s=setDisposition(s,"x","shortlisted");const reset=setVote(s,"x","fernando","unreviewed");expect(reset.places.x).toMatchObject({votes:{fernando:"unreviewed",ella:"no"},inReviewQueue:true,disposition:"shortlisted"});});
});

describe("legacy and planner bridges",()=>{
 it("imports unassigned and claims exactly one reviewer idempotently",()=>{const b=bridgeLegacy(emptyReviewStore(),["a","b"]);expect(b.places.a).toMatchObject({legacy:true,votes:{fernando:"unreviewed",ella:"unreviewed"}});const f=claimLegacy(b,["a","b"],"fernando");expect(f.places.a.votes).toEqual({fernando:"yes",ella:"unreviewed"});expect(claimLegacy(f,["a","b"],"ella")).toEqual(f);});
 it("can claim Ella",()=>expect(claimLegacy(bridgeLegacy(emptyReviewStore(),["a"]),["a"],"ella").places.a.votes.ella).toBe("yes"));
 it("cancel is lossless because bridge has no claim side effect",()=>{const b=bridgeLegacy(emptyReviewStore(),["a"]);expect(b.legacyClaim).toBeUndefined();});
 it("eligibility is exactly legacy union shortlisted",()=>{let s=setDisposition(emptyReviewStore(),"new","shortlisted");s=setVote(s,"liked","fernando","yes");expect([...getPlannerEligibility(["old"],s)].sort()).toEqual(["new","old"]);});
 it("review changes cannot mutate authored plan or legacy keys",()=>{const map=new Map([[LEGACY_SAVED_KEY,'["old"]'],[LEGACY_PLAN_KEY,'{"version":7,"days":[]}']]);const storage={getItem:(k:string)=>map.get(k)??null};const before=[...map];const ids=readLegacySaved(storage);setVote(bridgeLegacy(emptyReviewStore(),ids),"new","fernando","no");expect([...map]).toEqual(before);});
});

describe("defensive persistence parsing",()=>{
 it("malformed is fail closed",()=>expect(parseReviewStore("{").kind).toBe("invalid"));
 it("newer schema is fail closed",()=>expect(parseReviewStore(JSON.stringify({schema:"nihon.astra.review",version:2,places:{}})).kind).toBe("newer"));
 it("partial place fields are ignored",()=>expect(parseReviewStore(JSON.stringify({schema:"nihon.astra.review",version:1,places:{x:{placeId:"x"}}})).store.places).toEqual({}));
 it("round trips reload/tab persistence",()=>{const s=setVote(emptyReviewStore(),"x","fernando","yes");const raw=JSON.stringify(s);expect(parseReviewStore(raw).store).toEqual(s);expect(REVIEW_STORAGE_KEY).toBe("nihon.astra.review.v1");});
 it("reports storage failure without claiming success",()=>{const result=persistReview({setItem(){throw new Error("quota");}},emptyReviewStore());expect(result).toEqual({ok:false,error:"quota"});});
 it("retry can persist the same desired state",()=>{let raw="";const desired=setVote(emptyReviewStore(),"x","ella","yes");expect(persistReview({setItem(_k,v){raw=v;}},desired).ok).toBe(true);expect(parseReviewStore(raw).store).toEqual(desired);});
});
