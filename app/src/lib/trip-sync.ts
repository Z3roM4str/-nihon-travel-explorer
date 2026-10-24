import { parseTravellersDocument, type PlaceInterest, type TravellersDocumentV1 } from "./travellers";
import { parseStoredDraft, type ManualPlanningDraftV8 } from "./planning-draft-v8";

export type SyncRecord = {
  id: string;
  kind: "place" | "roster" | "planner";
  payload: string;
  deleted: boolean;
  updatedAt: number;
  writer: string;
};
export type SyncRecords = Record<string, SyncRecord>;
export type TripState = { travellers: TravellersDocumentV1; draft: ManualPlanningDraftV8 | null };
export const recordKey = (record: Pick<SyncRecord, "kind" | "id">) => `${record.kind}:${record.id}`;
const limits = { place: 2048, roster: 2048, planner: 200000 };
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
export const hasPlan = (draft: ManualPlanningDraftV8 | null): draft is ManualPlanningDraftV8 => !!draft && draft.routeIds.length > 0;

export function parseSyncRecord(value: unknown): SyncRecord {
  const d = value as SyncRecord;
  if (!d || typeof d !== "object" || !exactKeys(d as unknown as Record<string, unknown>, ["id", "kind", "payload", "deleted", "updatedAt", "writer"]) ||
    typeof d.id !== "string" || !d.id || d.id.length > 128 || d.id.includes("/") ||
    !["place", "roster", "planner"].includes(d.kind) ||
    (d.kind !== "place" && (d.id !== d.kind || d.deleted)) ||
    typeof d.payload !== "string" || new TextEncoder().encode(d.payload).length > limits[d.kind] ||
    typeof d.deleted !== "boolean" || !Number.isSafeInteger(d.updatedAt) || d.updatedAt < 0 ||
    typeof d.writer !== "string" || !d.writer || d.writer.length > 128 || (d.deleted && d.payload !== "null")) throw new Error("Invalid sync record");
  const p = JSON.parse(d.payload);
  if (d.kind === "place") {
    if (!/^[A-Za-z0-9-]{1,96}~(0|1|carried)$/.test(d.id)) throw new Error("Invalid place ID");
    if (!d.deleted && (!p || typeof p !== "object" || Array.isArray(p) ||
      typeof p.placeId !== "string" ||
      (d.id.endsWith("~carried")
        ? !exactKeys(p, ["placeId", "carriedOver"]) || p.carriedOver !== true || d.id !== `${p.placeId}~carried`
        : !exactKeys(p, ["placeId", "slot", "stance"]) || ![0, 1].includes(p.slot) || d.id !== `${p.placeId}~${p.slot}` ||
          !["interested", "not-interested"].includes(p.stance)))) throw new Error("Invalid place payload");
  }
  if (d.kind === "roster") {
    const roster = parseTravellersDocument({ version: 1, travellers: p, activeTravellerId: null, interests: [] });
    if (!roster || p.some((t: Record<string, unknown>) => !exactKeys(t, ["id", "label"])) ||
      roster.travellers.some((t) => t.id.length > 128 || t.label.length > 80)) throw new Error("Invalid roster payload");
  }
  if (d.kind === "planner" && (!hasPlan(parseStoredDraft(p)) || !exactKeys(p, ["version", "routeIds", "days", "startDate", "endDate", "visitStartTimes", "accommodations", "accommodationLegs", "interHubSegments", "zoneAccommodationChoices"]) || p.routeIds.length > 600)) throw new Error("Invalid or empty planner payload");
  return d;
}

export function compareRecords(a: SyncRecord, b: SyncRecord): number {
  return a.updatedAt - b.updatedAt || (a.writer > b.writer ? 1 : a.writer < b.writer ? -1 : 0) ||
    (a.payload > b.payload ? 1 : a.payload < b.payload ? -1 : 0) || Number(a.deleted) - Number(b.deleted);
}

/** Absence never means deletion. Only an explicit winning tombstone removes a person's stance. */
export function mergeRecords(local: SyncRecords, remote: readonly SyncRecord[]): SyncRecords {
  const merged = { ...local };
  for (const value of remote) {
    const record = parseSyncRecord(value);
    const key = recordKey(record);
    if (!merged[key] || compareRecords(record, merged[key]) > 0) merged[key] = record;
  }
  return merged;
}

export function projectTrip(state: TripState, writer: string): SyncRecords {
  const records: SyncRecords = {};
  const add = (id: string, kind: SyncRecord["kind"], payload: unknown) => {
    const record = { id, kind, payload: JSON.stringify(payload), deleted: false, updatedAt: 0, writer };
    records[recordKey(record)] = parseSyncRecord(record);
  };
  add("roster", "roster", state.travellers.travellers);
  if (hasPlan(state.draft)) add("planner", "planner", state.draft);
  for (const interest of state.travellers.interests) {
    for (const stance of interest.stances) {
      const slot = state.travellers.travellers.findIndex((t) => t.id === stance.travellerId);
      // A stance whose traveller is no longer on the roster has no shared slot to sync to.
      if (slot !== 0 && slot !== 1) continue;
      add(`${interest.placeId}~${slot}`, "place", { placeId: interest.placeId, slot, stance: stance.stance });
    }
    if (interest.carriedOver) add(`${interest.placeId}~carried`, "place", { placeId: interest.placeId, carriedOver: true });
  }
  return records;
}

export function captureChanges(records: SyncRecords, baseline: SyncRecords | null, current: SyncRecords, writer: string, now: number): SyncRecords {
  if (!baseline) return mergeRecords(records, Object.values(current));
  const next = { ...records };
  const timestamp = Object.values(records).reduce((latest, record) => Math.max(latest, record.updatedAt + 1), now);
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    const before = baseline[key]; const after = current[key];
    if (before?.payload === after?.payload) continue;
    if (after) next[key] = { ...after, updatedAt: timestamp, writer };
    else if (before?.kind === "place") next[key] = { ...before, payload: "null", deleted: true, updatedAt: timestamp, writer };
  }
  return next;
}

export function materializeTrip(local: TripState, records: SyncRecords): TripState {
  const roster = records["roster:roster"];
  const travellers = roster ? JSON.parse(roster.payload) as TravellersDocumentV1["travellers"] : [...local.travellers.travellers];
  const interests = new Map<string, PlaceInterest>();
  for (const record of Object.values(records)) {
    parseSyncRecord(record);
    if (record.kind !== "place" || record.deleted) continue;
    const p = JSON.parse(record.payload);
    const interest: PlaceInterest = interests.get(p.placeId) ?? { placeId: p.placeId, stances: [], carriedOver: false };
    if (p.carriedOver) interest.carriedOver = true;
    else {
      // A temporarily shorter remote roster must not erase a valid slot's preferences.
      if (!travellers[p.slot]) travellers[p.slot] = local.travellers.travellers[p.slot] ?? { id: `trip-slot-${p.slot}`, label: `Persona ${p.slot + 1}` };
      interest.stances.push({ travellerId: travellers[p.slot].id, stance: p.stance });
    }
    interests.set(p.placeId, interest);
  }
  const slot = local.travellers.travellers.findIndex((t) => t.id === local.travellers.activeTravellerId);
  const doc = parseTravellersDocument({ version: 1, travellers, interests: [...interests.values()].map((interest) => ({ ...interest, stances: interest.stances.sort((a, b) => travellers.findIndex((t) => t.id === a.travellerId) - travellers.findIndex((t) => t.id === b.travellerId)) })), activeTravellerId: travellers[slot]?.id ?? travellers[0]?.id ?? null });
  const planner = records["planner:planner"];
  const draft = planner ? parseStoredDraft(JSON.parse(planner.payload)) : local.draft;
  if (!doc || (planner && !hasPlan(draft))) throw new Error("Invalid merged trip");
  return { travellers: doc, draft };
}

/** Only profile IDs need alignment now; place preferences are permanently keyed by slot. */
export function alignProjection(projection: SyncRecords, shared: SyncRecords): SyncRecords {
  const target = shared["roster:roster"]; const source = projection["roster:roster"];
  if (!source || !target) return projection;
  const from = JSON.parse(source.payload) as { id: string; label: string }[];
  const to = JSON.parse(target.payload) as { id: string }[];
  return { ...projection, "roster:roster": { ...source, payload: JSON.stringify(from.map((t, i) => ({ ...t, id: to[i]?.id ?? t.id }))) } };
}

/** Keys `placeId~slot` of every person's opinion in a trip (carried-over places are not opinions). */
export function stanceKeys(state: TripState): Set<string> {
  return new Set(Object.values(projectTrip(state, "count")).filter((r) => r.kind === "place" && !r.id.endsWith("~carried")).map((r) => r.id));
}

const normalLabel = (label: string) => label.trim().toLocaleLowerCase("es-MX");
/** True when this device lists the same two people as the shared roster, but in the opposite order. */
export function rosterCrossed(state: TripState, remoteRoster: SyncRecord | undefined): boolean {
  if (!remoteRoster || remoteRoster.kind !== "roster") return false;
  const local = state.travellers.travellers.map((t) => normalLabel(t.label));
  const remote = (JSON.parse(remoteRoster.payload) as { label: string }[]).map((t) => normalLabel(t.label));
  return local.length === 2 && remote.length === 2 && local[0] !== local[1] && local[0] === remote[1] && local[1] === remote[0];
}

/** True when this device lists exactly the shared roster's names, in the same order. */
export function rosterMatches(state: TripState, remoteRoster: SyncRecord): boolean {
  const local = state.travellers.travellers.map((t) => normalLabel(t.label));
  const remote = (JSON.parse(remoteRoster.payload) as { label: string }[]).map((t) => normalLabel(t.label));
  return local.length === remote.length && local.every((label, i) => label === remote[i]);
}

/** «¿Quién eres en este viaje?»: put the person holding this device in the chosen shared slot. */
export function reorderForSlot(state: TripState, slot: 0 | 1): TripState {
  const list = state.travellers.travellers;
  if (list.length !== 2) return state;
  const active = Math.max(0, list.findIndex((t) => t.id === state.travellers.activeTravellerId));
  if (active === slot) return state;
  return { ...state, travellers: { ...state.travellers, travellers: [list[1], list[0]] } };
}

/** A remote change that would remove many opinions at once is held for confirmation. */
export const MASS_REMOVAL_ABSOLUTE = 10;
export const MASS_REMOVAL_RATIO = 0.3;
export const MASS_REMOVAL_MINIMUM = 3;
export function isMassRemoval(removed: number, current: number): boolean {
  return removed > MASS_REMOVAL_ABSOLUTE || (removed >= MASS_REMOVAL_MINIMUM && removed > current * MASS_REMOVAL_RATIO);
}
