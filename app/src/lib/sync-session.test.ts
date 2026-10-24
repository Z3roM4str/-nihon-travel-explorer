import { importNeedsConfirmation } from "./sync-import";
import { describe, expect, it, vi } from "vitest";
import { freshTravellersDocument, withStance } from "./travellers";
import { freshDraft } from "./planning-draft-v8";
import { REMOVAL_WINDOW_MS, SyncSession, type RemovalDecision, type RemovalHistory, type SyncJournal } from "./sync-session";
import { compareRecords, projectTrip, reorderForSlot, type SyncRecord, type TripState } from "./trip-sync";

function fixture() {
  let index = 0;
  const travellers = freshTravellersDocument(() => `t-${++index}`);
  let state: TripState = { travellers: withStance(travellers, "JP-001", travellers.travellers[0].id, "interested"), draft: freshDraft(["JP-001"]) };
  let journal: SyncJournal = { version: 1, records: {}, baseline: null };
  const apply = vi.fn(async (transform: (state: TripState) => TripState) => { state = transform(state); });
  const local = { read: async () => state, journal: () => journal, saveJournal: (next: SyncJournal) => { journal = next; }, apply };
  return { local, state: () => state, journal: () => journal, change: (next: TripState) => { state = next; } };
}

describe("sync failure boundaries", () => {
  it.each(["unavailable", "permission-denied", "unauthenticated", "resource-exhausted"])("retains the entire local trip on %s", async (code) => {
    const f = fixture(); const before = structuredClone(f.state());
    const session = new SyncSession(f.local, { write: async () => { throw new Error(code); } }, "alice");
    await expect(session.sync([])).rejects.toThrow(code);
    expect(f.state()).toEqual(before); expect(f.local.apply).not.toHaveBeenCalled();
    expect(f.journal().records["place:JP-001~0"]).toBeDefined();
  });
  it("uploads a nonempty local trip to an empty remote without wiping it", async () => {
    const f = fixture(); const before = structuredClone(f.state()); const write = vi.fn(async (record: SyncRecord) => record);
    await new SyncSession(f.local, { write }, "alice").sync([]);
    expect(f.state()).toEqual(before); expect(write).toHaveBeenCalledTimes(3);
  });
  it("never applies remote data after the session has stopped", async () => {
    const f = fixture(); const before = structuredClone(f.state());
    let release!: (record: SyncRecord) => void;
    const session = new SyncSession(f.local, { write: (record) => new Promise((resolve) => { release = () => resolve(record); }) }, "alice");
    const running = session.sync([]);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    session.stop(); release({} as SyncRecord); await running;
    expect(f.state()).toEqual(before); expect(f.local.apply).not.toHaveBeenCalled();
  });
  it("retries persistent pending tombstones after a reload", async () => {
    const f = fixture(); const initial = projectTrip(f.state(), "alice");
    f.local.saveJournal({ version: 1, records: initial, baseline: initial });
    const empty = structuredClone(f.state()); empty.travellers.interests = []; f.change(empty);
    await expect(new SyncSession(f.local, { write: async () => { throw new Error("offline"); } }, "alice").sync(Object.values(initial), 100)).rejects.toThrow();
    expect(f.journal().records["place:JP-001~0"].deleted).toBe(true);
    const write = vi.fn(async (record: SyncRecord) => record);
    await new SyncSession(f.local, { write }, "alice").sync(Object.values(initial), 101);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ id: "JP-001~0", deleted: true, updatedAt: 100 }));
    expect(f.state().travellers.interests).toEqual([]);
  });
  it("keeps a local edit made while a remote request was in flight", async () => {
    const f = fixture(); let once = false;
    await new SyncSession(f.local, { write: async (record) => {
      if (!once) { once = true; const changed = structuredClone(f.state()); changed.travellers = withStance(changed.travellers, "JP-002", "t-2", "interested"); f.change(changed); }
      return record;
    } }, "alice").sync([]);
    expect(f.state().travellers.interests.map((i) => i.placeId)).toEqual(["JP-001", "JP-002"]);
    expect(f.journal().records["place:JP-002~1"].updatedAt).toBeGreaterThan(0);
  });
  it("preserves first-join edits made with the device's original traveller IDs", async () => {
    const f = fixture();
    const roster = projectTrip(f.state(), "bob")["roster:roster"];
    roster.payload = JSON.stringify([{ id: "shared-a", label: "Ana" }, { id: "shared-b", label: "Luis" }]);
    roster.updatedAt = 100;
    let once = false;
    // Different names on first join: this device already answered «¿Quién eres en este viaje?».
    await new SyncSession({ ...f.local, joinAnswered: () => true }, { write: async (record) => {
      if (!once) {
        once = true;
        const changed = structuredClone(f.state());
        changed.travellers = withStance(changed.travellers, "JP-002", "t-2", "interested");
        f.change(changed);
      }
      return record;
    } }, "alice").sync([roster]);
    expect(f.state().travellers.interests.find((i) => i.placeId === "JP-002")?.stances)
      .toEqual([{ travellerId: "shared-b", stance: "interested" }]);
  });
  it("does not publish or apply when the local journal cannot be saved", async () => {
    const f = fixture(); const write = vi.fn(async (record: SyncRecord) => record);
    const before = structuredClone(f.state());
    f.local.saveJournal = () => { throw new Error("storage full"); };
    await expect(new SyncSession(f.local, { write }, "alice").sync([])).rejects.toThrow("storage full");
    expect(write).not.toHaveBeenCalled(); expect(f.state()).toEqual(before);
  });
  it("never treats an unreadable local trip as a blank trip", async () => {
    const f = fixture(); const write = vi.fn(async (record: SyncRecord) => record);
    f.local.read = async () => { throw new Error("protected"); };
    await expect(new SyncSession(f.local, { write }, "alice").sync([])).rejects.toThrow("protected");
    expect(write).not.toHaveBeenCalled(); expect(f.local.apply).not.toHaveBeenCalled();
  });

  it("an empty second device adopts the first person's published planner and roster", async () => {
    const first = fixture(); const server: SyncRecord[] = [];
    await new SyncSession(first.local, { write: async (record) => { server.push(record); return record; } }, "alice").sync([], 100);
    expect(server.every((record) => record.updatedAt === 100)).toBe(true);
    const second = fixture();
    const empty = structuredClone(second.state());
    empty.travellers.interests = []; empty.draft = null;
    second.change(empty);
    const write = vi.fn(async (record: SyncRecord) => record);
    await new SyncSession(second.local, { write }, "z-last-uid").sync(server, 200);
    expect(second.state()).toEqual(first.state());
    expect(write).not.toHaveBeenCalled();
  });

});

function server() {
  const records = new Map<string, SyncRecord>();
  return { records, write: async (record: SyncRecord) => {
    const key = `${record.kind}:${record.id}`;
    const previous = records.get(key);
    if (previous && compareRecords(previous, record) >= 0) return previous;
    records.set(key, record); return record;
  } };
}
it("keeps both people's likes when they mark the same place before syncing", async () => {
  const a = fixture(); const b = fixture(); const remote = server();
  for (const f of [a, b]) { const state = structuredClone(f.state()); state.travellers.interests = []; f.change(state); }
  await new SyncSession(a.local, remote, "a").sync([], 10);
  await new SyncSession(b.local, remote, "b").sync([...remote.records.values()], 11);
  for (const [f, id] of [[a, "t-1"], [b, "t-2"]] as const) {
    const state = structuredClone(f.state()); state.travellers = withStance(state.travellers, "JP-001", id, "interested"); f.change(state);
  }
  await new SyncSession(a.local, remote, "a").sync([...remote.records.values()], 100);
  await new SyncSession(b.local, remote, "b").sync([...remote.records.values()], 101);
  await new SyncSession(a.local, remote, "a").sync([...remote.records.values()], 102);
  for (const f of [a, b]) expect(f.state().travellers.interests[0].stances.map((s) => s.travellerId)).toEqual(["t-1", "t-2"]);
  const changed = structuredClone(a.state()); changed.travellers = withStance(changed.travellers, "JP-001", "t-1", null); a.change(changed);
  await new SyncSession(a.local, remote, "a").sync([...remote.records.values()], 103);
  expect(remote.records.get("place:JP-001~0")?.deleted).toBe(true);
  expect(remote.records.get("place:JP-001~1")?.deleted).toBe(false);
});
it("first join keeps the joining device's likes on places the other already rated", async () => {
  const a = fixture(); const b = fixture(); const remote = server();
  const state = structuredClone(b.state()); state.travellers.interests = [];
  state.travellers = withStance(state.travellers, "JP-001", "t-2", "interested"); b.change(state);
  await new SyncSession(a.local, remote, "a").sync([], 100);
  await new SyncSession(b.local, remote, "b").sync([...remote.records.values()], 200);
  expect(b.state().travellers.interests[0].stances).toHaveLength(2);
});
it("a device without a plan that connects first never erases the other person's plan", async () => {
  for (const draft of [null, freshDraft([])]) {
    const a = fixture(); const b = fixture(); const remote = server();
    b.change({ ...b.state(), draft });
    await new SyncSession(b.local, remote, "b").sync([], 100);
    expect(remote.records.has("planner:planner")).toBe(false);
    const before = structuredClone(a.state().draft);
    await new SyncSession(a.local, remote, "a").sync([...remote.records.values()], 200);
    expect(a.state().draft).toEqual(before);
    expect(JSON.parse(remote.records.get("planner:planner")!.payload).routeIds).toEqual(["JP-001"]);
  }
});
it("rejects a remote planner record with payload null without touching the local plan", async () => {
  const f = fixture(); const before = structuredClone(f.state().draft); const invalid = vi.fn();
  await new SyncSession(f.local, server(), "a", invalid).sync([
    { id: "planner", kind: "planner", payload: "null", deleted: false, updatedAt: 500, writer: "bad" },
  ], 100);
  expect(invalid).toHaveBeenCalledOnce(); expect(f.state().draft).toEqual(before);
});
it("restoring a backup while synced asks before tombstoning the shared trip", async () => {
  expect(importNeedsConfirmation(true, false)).toBe(true);
  expect(importNeedsConfirmation(true, true)).toBe(false);
  for (const confirmed of [false, true]) {
    const f = fixture(); const remote = server();
    await new SyncSession(f.local, remote, "a").sync([], 100);
    const before = structuredClone(f.state()); const after = structuredClone(before); after.travellers.interests = [];
    f.change(after);
    const policy = { id: "import", confirmed, before, after };
    await new SyncSession({ ...f.local, importPolicy: () => policy }, remote, "a").sync([...remote.records.values()], 200);
    expect(remote.records.get("place:JP-001~0")?.deleted).toBe(confirmed);
  }
});
it("a new anonymous uid on the same device does not drop local likes or pending tombstones", async () => {
  const f = fixture(); const initial = projectTrip(f.state(), "old-uid");
  f.local.saveJournal({ version: 1, records: initial, baseline: initial });
  const changed = structuredClone(f.state()); changed.travellers.interests = [];
  changed.travellers = withStance(changed.travellers, "JP-002", "t-2", "interested"); f.change(changed);
  await expect(new SyncSession(f.local, { write: async () => { throw Error("offline"); } }, "old-uid").sync(Object.values(initial), 100)).rejects.toThrow();
  const write = vi.fn(async (record: SyncRecord) => record);
  await new SyncSession(f.local, { write }, "new-uid").sync(Object.values(initial), 101);
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ id: "JP-001~0", deleted: true, writer: "new-uid" }));
  expect(f.state().travellers.interests.map((i) => i.placeId)).toEqual(["JP-002"]);
});

const withRoster = (state: TripState, travellers: { id: string; label: string }[]): TripState =>
  ({ ...state, travellers: { ...state.travellers, travellers, activeTravellerId: travellers[0].id } });
it("crossed rosters (Ana/Luis vs Luis/Ana) are held instead of swapping each person's likes", async () => {
  const remote = server();
  const a = fixture(); const b = fixture();
  a.change(withRoster(a.state(), [{ id: "t-1", label: "Ana" }, { id: "t-2", label: "Luis" }]));
  // B lists Luis first; Luis likes JP-001 on B, Ana likes JP-001 on A.
  const bState = withRoster(b.state(), [{ id: "t-1", label: "Luis" }, { id: "t-2", label: "Ana" }]);
  b.change(bState);
  await new SyncSession(a.local, remote, "a").sync([], 10);
  const write = vi.fn(remote.write);
  const before = structuredClone(b.state());
  await expect(new SyncSession(b.local, { write }, "b").sync([...remote.records.values()], 20)).rejects.toMatchObject({ reason: "roster-order" });
  expect(write).not.toHaveBeenCalled(); expect(b.state()).toEqual(before);
  // Without the guard Luis's like would land on slot 0 (Ana) and collide with hers.
  expect(projectTrip(before, "b")["place:JP-001~0"]).toBeDefined();
  // Once B uses the same order, both likes survive with the right person.
  b.change(withRoster(b.state(), [{ id: "t-2", label: "Ana" }, { id: "t-1", label: "Luis" }]));
  await new SyncSession(b.local, remote, "b").sync([...remote.records.values()], 30);
  await new SyncSession(a.local, remote, "a").sync([...remote.records.values()], 40);
  expect(JSON.parse(remote.records.get("place:JP-001~0")!.payload).slot).toBe(0);
  expect(JSON.parse(remote.records.get("place:JP-001~1")!.payload).slot).toBe(1);
  expect(a.state().travellers.interests[0].stances.map((s) => s.travellerId)).toEqual(["t-1", "t-2"]);
});

function likes(count: number) {
  const f = fixture(); let state = structuredClone(f.state()); state.travellers.interests = [];
  for (let i = 1; i <= count; i++) state.travellers = withStance(state.travellers, `JP-${String(i).padStart(3, "0")}`, "t-1", "interested");
  f.change(state);
  return f;
}
const tombstones = (ids: string[], updatedAt = 50): SyncRecord[] =>
  ids.map((id) => ({ id: `${id}~0`, kind: "place", payload: "null", deleted: true, updatedAt, writer: "attacker" }));
const ids = (n: number) => Array.from({ length: n }, (_, i) => `JP-${String(i + 1).padStart(3, "0")}`);
it("holds a remote change that removes many likes at once, keeps a backup, and applies it only after confirmation", async () => {
  const f = likes(12); const remote = server();
  await new SyncSession(f.local, remote, "a").sync([], 10);
  const attack = [...remote.records.values()].filter((r) => r.kind !== "place").concat(tombstones(ids(12)));
  const before = structuredClone(f.state());
  let decision: RemovalDecision | null = null; const holdBackup = vi.fn(); const consumeRemoval = vi.fn(() => { decision = null; });
  const local = { ...f.local, holdBackup, removalDecision: () => decision, consumeRemoval };
  const write = vi.fn(remote.write);
  const held = await new SyncSession(local, { write }, "a").sync(attack, 60).catch((error) => error);
  expect(held).toMatchObject({ reason: "mass-removal", removed: 12 });
  expect(holdBackup).toHaveBeenCalledWith(held.signature);
  expect(f.state()).toEqual(before); expect(write).not.toHaveBeenCalled();
  decision = { signature: held.signature, decision: "apply" };
  await new SyncSession(local, { write }, "a").sync(attack, 70);
  expect(f.state().travellers.interests).toEqual([]); expect(consumeRemoval).toHaveBeenCalledOnce();
});
it.each([
  [12, 1, false], [12, 3, false], [10, 4, true], [40, 11, true], [2, 2, false],
])("with %i likes, a remote removal of %i is held: %s (>10 or >30%%, at least 3)", async (total, removed, heldExpected) => {
  const f = likes(total); const remote = server();
  await new SyncSession(f.local, remote, "a").sync([], 10);
  const incoming = [...remote.records.values()].filter((r) => r.kind !== "place").concat(tombstones(ids(removed)));
  const outcome = await new SyncSession(f.local, remote, "a").sync(incoming, 60).then(() => "applied", (error) => error.reason);
  expect(outcome).toBe(heldExpected ? "mass-removal" : "applied");
  expect(f.state().travellers.interests).toHaveLength(heldExpected ? total : total - removed);
});
it("never publishes a tombstone for a like the server never had (rules deny creating tombstones)", async () => {
  const f = fixture(); const liked = structuredClone(f.state());
  liked.travellers = withStance(liked.travellers, "JP-002", "t-2", "interested");
  const baseline = projectTrip(liked, "a");
  f.local.saveJournal({ version: 1, records: baseline, baseline });
  const write = vi.fn(async (record: SyncRecord) => record);
  await new SyncSession(f.local, { write }, "a").sync([], 100);
  expect(write).not.toHaveBeenCalledWith(expect.objectContaining({ id: "JP-002~1" }));
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ id: "JP-001~0", deleted: false }));
});

it("rejecting a held mass removal republishes the local likes and resumes sync", async () => {
  const f = likes(12); const remote = server();
  await new SyncSession(f.local, remote, "a").sync([], 10);
  // Someone tombstones all 12 likes on the server (update of existing docs, as the rules allow).
  for (const record of tombstones(ids(12))) await remote.write(record);
  let decision: RemovalDecision | null = null; const consumeRemoval = vi.fn(() => { decision = null; });
  const local = { ...f.local, holdBackup: vi.fn(), removalDecision: () => decision, consumeRemoval };
  const before = structuredClone(f.state());
  const held = await new SyncSession(local, remote, "a").sync([...remote.records.values()], 60).catch((error) => error);
  expect(held).toMatchObject({ reason: "mass-removal", removed: 12 });
  decision = { signature: held.signature, decision: "keep" };
  const write = vi.fn(remote.write);
  await new SyncSession(local, { write }, "a").sync([...remote.records.values()], 70);
  expect(f.state()).toEqual(before); expect(consumeRemoval).toHaveBeenCalledOnce();
  // Every like is live again on the server, written over the tombstone (same ID, newer timestamp).
  for (const id of ids(12)) {
    const record = remote.records.get(`place:${id}~0`)!;
    expect(record.deleted).toBe(false); expect(record.updatedAt).toBeGreaterThan(50);
  }
  expect(write).toHaveBeenCalledTimes(12);
  // Sync is resumed: a normal later change flows without another hold.
  const later = structuredClone(f.state()); later.travellers = withStance(later.travellers, "JP-099", "t-2", "interested"); f.change(later);
  await new SyncSession(local, remote, "a").sync([...remote.records.values()], 80);
  expect(remote.records.get("place:JP-099~1")?.deleted).toBe(false);
});

it("first join with different names asks «¿Quién eres en este viaje?» and maps the person to the chosen slot", async () => {
  const remote = server();
  const a = fixture();
  a.change(withRoster(a.state(), [{ id: "t-1", label: "Ana" }, { id: "t-2", label: "Luis" }]));
  await new SyncSession(a.local, remote, "a").sync([], 10);
  // Claude's case: B calls the two people "Luisito"/"Anita"; Luisito holds the phone and says «no me interesa» to JP-001.
  const b = fixture(); let state = withRoster(b.state(), [{ id: "b-1", label: "Luisito" }, { id: "b-2", label: "Anita" }]);
  state.travellers.interests = [];
  state.travellers = withStance(state.travellers, "JP-001", "b-1", "not-interested");
  b.change(state);
  let answered = false;
  const local = { ...b.local, joinAnswered: () => answered };
  const write = vi.fn(remote.write);
  const held = await new SyncSession(local, { write }, "b").sync([...remote.records.values()], 20).catch((error) => error);
  expect(held).toMatchObject({ reason: "who-are-you", names: ["Ana", "Luis"] });
  expect(write).not.toHaveBeenCalled();
  // Without asking, Luisito (local slot 0) would have taken Ana's profile and lost his opinion on JP-001.
  b.change(reorderForSlot(b.state(), 1)); answered = true;
  await new SyncSession(local, remote, "b").sync([...remote.records.values()], 30);
  expect(JSON.parse(remote.records.get("place:JP-001~0")!.payload).stance).toBe("interested");
  expect(JSON.parse(remote.records.get("place:JP-001~1")!.payload).stance).toBe("not-interested");
  const doc = b.state().travellers;
  expect(doc.travellers.map((t) => t.label)).toEqual(["Ana", "Luis"]);
  expect(doc.activeTravellerId).toBe("t-2");
  expect(doc.interests[0].stances).toEqual(expect.arrayContaining([{ travellerId: "t-1", stance: "interested" }, { travellerId: "t-2", stance: "not-interested" }]));
});

it("matching names on first join never ask who holds the phone", async () => {
  const remote = server(); const a = fixture(); const b = fixture();
  await new SyncSession(a.local, remote, "a").sync([], 10);
  await expect(new SyncSession(b.local, remote, "b").sync([...remote.records.values()], 20)).resolves.toBe(true);
});

it("a slow drip of remote removals is held once it passes 10 in 24 hours", async () => {
  const f = likes(40); const remote = server();
  await new SyncSession(f.local, remote, "a").sync([], 10);
  let history: RemovalHistory = [];
  const local = { ...f.local, holdBackup: vi.fn(), removalHistory: () => history, saveRemovalHistory: (next: RemovalHistory) => { history = next; } };
  const base = 1_000_000;
  let outcome = "";
  for (let round = 0; round < 6; round++) {
    const batch = ids(40).slice(round * 2, round * 2 + 2);
    for (const record of tombstones(batch, base + round * 1000)) await remote.write(record);
    outcome = await new SyncSession(local, remote, "a").sync([...remote.records.values()], base + round * 1000 + 1).then(() => "applied", (error) => error.reason);
    if (outcome !== "applied") break;
  }
  expect(outcome).toBe("mass-removal");
  expect(f.state().travellers.interests).toHaveLength(30);
  // Outside the 24 h window the counter starts again.
  history = history.map((entry) => ({ ...entry, at: entry.at - REMOVAL_WINDOW_MS }));
  await expect(new SyncSession(local, remote, "a").sync([...remote.records.values()], base + 7000)).resolves.toBe(true);
});
