import { describe, expect, it } from "vitest";
import { freshTravellersDocument, withStance } from "./travellers";
import { freshDraft } from "./planning-draft-v8";
import { readPortableBackup, serializeVerifiedBackup } from "./portable-backup";
import { captureChanges, materializeTrip, mergeRecords, projectTrip, type SyncRecord, type TripState } from "./trip-sync";

function trip(): TripState {
  let index = 0;
  const travellers = freshTravellersDocument(() => `t-${++index}`);
  return { travellers: withStance(travellers, "JP-001", travellers.travellers[0].id, "interested"), draft: freshDraft(["JP-001"]) };
}
const record = (changes: Partial<SyncRecord> = {}): SyncRecord => ({ id: "JP-001~0", kind: "place", payload: "null", deleted: true, updatedAt: 20, writer: "alice", ...changes });

describe("per-document shared trip merge", () => {
  it("keeps unrelated local IDs and uses the newer record for conflicts", () => {
    const local = { "place:JP-001~0": record(), "place:JP-002~1": record({ id: "JP-002~1" }) };
    const remote = record({ updatedAt: 21, writer: "bob" });
    expect(mergeRecords(local, [remote])).toEqual({ ...local, "place:JP-001~0": remote });
    expect(mergeRecords(local, [record({ updatedAt: 19 })])).toEqual(local);
  });
  it("resolves equal timestamps independently of arrival order", () => {
    const a = record(); const b = record({ writer: "bob" });
    expect(mergeRecords({ "place:JP-001~0": a }, [b])).toEqual(mergeRecords({ "place:JP-001~0": b }, [a]));
  });
  it("records removal as a tombstone and prevents an older saved item from resurrecting", () => {
    const initial = projectTrip(trip(), "alice");
    const empty = trip(); empty.travellers.interests = [];
    const removed = captureChanges(initial, initial, projectTrip(empty, "alice"), "alice", 100);
    expect(removed["place:JP-001~0"]).toMatchObject({ deleted: true, payload: "null", updatedAt: 100 });
    expect(materializeTrip(empty, mergeRecords(removed, Object.values(initial))).travellers.interests).toEqual([]);
    const restored = captureChanges(removed, projectTrip(empty, "alice"), initial, "alice", 101);
    expect(materializeTrip(empty, restored).travellers.interests).toHaveLength(1);
  });
  it("does not erase any local data when the remote collection is empty", () => {
    const state = trip();
    expect(materializeTrip(state, mergeRecords(projectTrip(state, "alice"), []))).toEqual(state);
  });
  it("rejects malformed remote data rather than presenting it as an empty trip", () => {
    const local = projectTrip(trip(), "alice");
    expect(() => mergeRecords(local, [record({ updatedAt: NaN })])).toThrow();
    expect(() => materializeTrip(trip(), { ...local, "planner:planner": record({ id: "planner", kind: "planner", deleted: false, payload: '{"version":999}' }) })).toThrow();
  });
  it("maps first-join local stances to the shared roster slots without inventing preferences", () => {
    const state = trip();
    const shared = trip(); shared.travellers.travellers = [{ id: "shared-a", label: "Ana" }, { id: "shared-b", label: "Luis" }];
    const remote = projectTrip(shared, "bob")["roster:roster"]; remote.updatedAt = 50;
    const aligned = projectTrip(state, "alice");
    const merged = materializeTrip(state, mergeRecords(aligned, [remote]));
    expect(merged.travellers.interests[0].stances).toEqual([{ travellerId: "shared-a", stance: "interested" }]);
    expect(merged.travellers.activeTravellerId).toBe("shared-a");
  });
  it("round-trips a merged trip through the unchanged portable backup format", () => {
    const state = trip(); const merged = materializeTrip(state, projectTrip(state, "alice"));
    const serialized = serializeVerifiedBackup(merged.travellers, merged.draft, "2026-10-11T00:00:00Z");
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) throw new Error("Export rejected");
    const result = readPortableBackup(serialized.text);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Import rejected");
    expect(result.backup.data.travellers).toEqual(state.travellers);
    expect(result.backup.data.planningDraft).toEqual(state.draft);
  });
});
