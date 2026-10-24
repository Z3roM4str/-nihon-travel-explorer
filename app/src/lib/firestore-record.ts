import { parseSyncRecord, type SyncRecord } from "./trip-sync";

/** Expose bounded planner route IDs to rules; keep the portable/local representation unchanged. */
export function toFirestoreRecord(record: SyncRecord) {
  const valid = parseSyncRecord(record);
  const decoded = JSON.parse(valid.payload);
  const payload = valid.deleted ? null : valid.kind === "planner" ? { routeIds: decoded.routeIds, data: valid.payload } : decoded;
  return { ...valid, payload };
}

export function fromFirestoreRecord(value: unknown): SyncRecord {
  const data = value as Record<string, unknown>;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid Firestore document");
  let payload: string;
  if (data.kind === "planner") {
    const plan = data.payload as { routeIds?: unknown; data?: unknown };
    if (!plan || typeof plan !== "object" || Object.keys(plan).length !== 2 || typeof plan.data !== "string" ||
      JSON.stringify(JSON.parse(plan.data)?.routeIds) !== JSON.stringify(plan.routeIds)) throw new Error("Invalid planner header");
    payload = plan.data;
  } else payload = JSON.stringify(data.payload);
  return parseSyncRecord({ ...data, payload });
}
