import { expect, it } from "vitest";
import { fromFirestoreRecord, toFirestoreRecord } from "./firestore-record";
import { freshTravellersDocument, withStance } from "./travellers";
import { freshDraft } from "./planning-draft-v8";
import { projectTrip } from "./trip-sync";

it("round-trips wire payloads while retaining the local journal and backup format", () => {
  let next = 0;
  let travellers = freshTravellersDocument(() => `t-${++next}`);
  travellers = withStance(travellers, "JP-001", "t-1", "interested");
  const records = projectTrip({ travellers, draft: freshDraft(["JP-001"]) }, "anonymous-device");
  for (const record of Object.values(records)) expect(fromFirestoreRecord(toFirestoreRecord(record))).toEqual(record);
  expect(toFirestoreRecord(records["place:JP-001~0"]).payload).toEqual({ placeId: "JP-001", slot: 0, stance: "interested" });
  expect(toFirestoreRecord(records["roster:roster"]).payload).toEqual(travellers.travellers);
  expect(typeof toFirestoreRecord(records["planner:planner"]).payload).toBe("object");
  const deleted = { ...records["place:JP-001~0"], deleted: true, payload: "null", updatedAt: 100 };
  expect(toFirestoreRecord(deleted).payload).toBeNull();
  expect(fromFirestoreRecord(toFirestoreRecord(deleted))).toEqual(deleted);
});
it("can still read legacy string payloads and rejects malformed/oversized remote records", () => {
  const record = { id: "JP-001~0", kind: "place" as const, deleted: true, payload: "null", updatedAt: 1, writer: "device" };
  expect(fromFirestoreRecord({ ...record, payload: null })).toEqual(record);
  expect(() => fromFirestoreRecord({ ...record, payload: "bad json" })).toThrow();
  expect(() => fromFirestoreRecord({ ...record, writer: "x".repeat(129) })).toThrow();
  expect(() => fromFirestoreRecord({ ...record, id: "x".repeat(129) })).toThrow();
  expect(() => fromFirestoreRecord({ ...record, payload: "x".repeat(250001) })).toThrow();
});
