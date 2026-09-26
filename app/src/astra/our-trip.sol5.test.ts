import {describe,expect,it} from "vitest";
import type {Place} from "../types";
import {emptyReviewPlace,emptyReviewStore,setDisposition,setPriority,setVote} from "./review";
import {applyDispositionBatch,groupedTripIds,isRelevant,matchesTripFilter,restoreDispositions,snapshotDispositions,sortTripPlaces,stableReviewQueue,tripCounts} from "./our-trip";
const place=(id:string,grade="B",name=id,hub="Tokio")=>({id,grade,name,hub} as Place);
const records=()=>{let s=emptyReviewStore();s=setVote(s,"JP-001","fernando","yes");s=setVote(s,"JP-001","ella","yes");s=setVote(s,"JP-002","fernando","yes");s=setVote(s,"JP-003","fernando","no");s=setVote(s,"JP-003","ella","no");s=setVote(s,"JP-004","fernando","yes");s=setVote(s,"JP-004","ella","no");return s;};
describe("SOL-5 Our Trip derivations",()=>{
 it("defines Todos as relevant and excludes discarded",()=>{let s=records();expect(isRelevant(s.places["JP-002"])).toBe(true);s=setDisposition(s,"JP-002","discarded");expect(matchesTripFilter(s.places["JP-002"],"Todos")).toBe(false);expect(matchesTripFilter(s.places["JP-002"],"Descartados")).toBe(true)});
 it("derives overlapping Ambos, Fernando and pending counts without summing",()=>{const s=records();expect(tripCounts(s)).toEqual({both:1,pending:1});expect(matchesTripFilter(s.places["JP-001"],"Ambos")).toBe(true);expect(matchesTripFilter(s.places["JP-001"],"Fernando")).toBe(true)});
 it("keeps no/no and differing tastes accessible",()=>{const s=records();expect(matchesTripFilter(s.places["JP-003"],"Ninguno")).toBe(true);expect(matchesTripFilter(s.places["JP-004"],"Gustos diferentes")).toBe(true)});
 it("filters each reviewer and pending",()=>{const s=records();expect(matchesTripFilter(s.places["JP-002"],"Fernando")).toBe(true);expect(matchesTripFilter(s.places["JP-002"],"Pendientes")).toBe(true);expect(matchesTripFilter(s.places["JP-002"],"Ella")).toBe(false)});
 it("groups every relevant id exactly once",()=>{const s=records(),ids=groupedTripIds([place("JP-004"),place("JP-002"),place("JP-001")],s).flatMap(g=>g.ids);expect(ids).toEqual(["JP-001","JP-002","JP-004"]);expect(new Set(ids).size).toBe(ids.length)});
 it("sorts recommendation then canonical ID",()=>{const s=records();expect(sortTripPlaces([place("JP-002","B"),place("JP-001","S"),place("JP-004","B")],s).map(p=>p.id)).toEqual(["JP-001","JP-002","JP-004"])});
 it("sorts unknown priority last",()=>{let s=records();s=setPriority(s,"JP-002","Alta");expect(sortTripPlaces([place("JP-001"),place("JP-002")],s,"priority").map(p=>p.id)).toEqual(["JP-002","JP-001"])});
 it("takes a stable queue snapshot",()=>{const s=records();const q=stableReviewQueue(s);expect(q).toEqual(["JP-002"]);const changed=setVote(s,"JP-005","fernando","yes");expect(q).toEqual(["JP-002"]);expect(stableReviewQueue(changed)).toEqual(["JP-002","JP-005"])});
 it("batch changes only dispositions and exact undo restores absence",()=>{const s=records(),before=snapshotDispositions(s,["JP-001","JP-002"]),next=applyDispositionBatch(s,["JP-001","JP-002"],"shortlisted");expect(next.places["JP-001"].votes).toEqual(s.places["JP-001"].votes);expect(next.places["JP-002"].disposition).toBe("shortlisted");expect(restoreDispositions(next,before)).toEqual(s)});
 it("supports an explicitly queued empty record",()=>{const r={...emptyReviewPlace("JP-009"),inReviewQueue:true};expect(matchesTripFilter(r,"Todos")).toBe(true);expect(matchesTripFilter(r,"Pendientes")).toBe(true)});
});
