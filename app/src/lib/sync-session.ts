import {
  alignProjection, compareRecords, materializeTrip, mergeRecords, projectTrip, recordKey,
  parseSyncRecord, rosterCrossed, rosterMatches, isMassRemoval, stanceKeys, MASS_REMOVAL_ABSOLUTE,
  type SyncRecord, type SyncRecords, type TripState,
} from "./trip-sync";

export type RemovalDecision = { signature: string; decision: "apply" | "keep" };
export type RemovalHistory = { at: number; count: number }[];
export const REMOVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

import { captureImportedChanges, type SyncImport } from "./sync-import";

export type SyncJournal = { version: 1; records: SyncRecords; baseline: SyncRecords | null };
export type SyncLocal = {
  read: () => Promise<TripState>;
  journal: () => SyncJournal;
  saveJournal: (journal: SyncJournal) => void;
  importPolicy?: () => SyncImport | null;
  consumeImport?: (id: string) => void;
  /** Must re-read under the canonical locks and call transform without yielding. */
  apply: (transform: (state: TripState) => TripState) => Promise<void>;
  /** Signature of a mass removal the people on this device explicitly accepted, if any. */
  /** What the people on this device decided about one exact held removal, if anything. */
  removalDecision?: () => RemovalDecision | null;
  decideRemoval?: (decision: RemovalDecision) => void;
  consumeRemoval?: () => void;
  /** Remote removals applied automatically on this device (rolling 24 h counter). */
  removalHistory?: () => RemovalHistory;
  saveRemovalHistory?: (history: RemovalHistory) => void;
  /** True once this device answered «¿Quién eres en este viaje?» for its first join. */
  joinAnswered?: () => boolean;
  /** Answer to «¿Quién eres en este viaje?»: reorder the local profiles so this person sits in that slot. */
  chooseSlot?: (slot: 0 | 1) => Promise<void> | void;
  /** Keep a copy of the local trip before asking about a held remote change. */
  holdBackup?: (signature: string) => void;
};

/** A remote change that is not applied automatically; nothing was published or applied. */
export type SyncHoldReason = "roster-order" | "mass-removal" | "who-are-you";
export class SyncHold extends Error {
  readonly reason: SyncHoldReason;
  readonly removed: number;
  readonly signature: string;
  /** Shared roster names, slot 0 then slot 1 (who-are-you). */
  readonly names: string[];
  constructor(reason: SyncHoldReason, removed = 0, signature = "", names: string[] = []) {
    super(reason); this.reason = reason; this.removed = removed; this.signature = signature; this.names = names;
  }
}

export function removalSignature(keys: readonly string[]): string {
  let hash = 5381;
  for (const char of [...keys].sort().join("|")) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return `${keys.length}-${hash.toString(36)}`;
}
export type SyncRemote = {
  write: (record: SyncRecord) => Promise<SyncRecord>;
};

/** A failed read/write cannot reach local.apply. Server absence is never a deletion. */
export class SyncSession {
  private active = true;
  private busy = false;
  private local: SyncLocal;
  private remote: SyncRemote;
  private writer: string;
  private invalid: (record: unknown) => void;
  constructor(local: SyncLocal, remote: SyncRemote, writer: string, invalid: (record: unknown) => void = () => {}) {
    this.local = local; this.remote = remote; this.writer = writer; this.invalid = invalid;
  }

  stop() { this.active = false; }

  async sync(remoteRecords: readonly SyncRecord[], now = Date.now()): Promise<boolean> {
    if (!this.active || this.busy) return false;
    this.busy = true;
    try {
      const validRemote: SyncRecord[] = [];
      for (const record of remoteRecords) {
        try { validRemote.push(parseSyncRecord(record)); } catch { this.invalid(record); }
      }
      const state = await this.local.read();
      if (!this.active) return false;
      // Slots are positions: a crossed roster would attribute each person's likes to the other.
      const remoteRoster = validRemote.find((record) => record.kind === "roster");
      if (rosterCrossed(state, remoteRoster)) throw new SyncHold("roster-order");
      const journal = this.local.journal();
      // First join with different names: ask who holds this phone instead of silently mapping by position.
      if (!journal.baseline && remoteRoster && !this.local.joinAnswered?.() && !rosterMatches(state, remoteRoster) &&
        state.travellers.travellers.length === 2 && stanceKeys(state).size > 0) {
        throw new SyncHold("who-are-you", 0, "", (JSON.parse(remoteRoster.payload) as { label: string }[]).map((t) => t.label));
      }
      const current = projectTrip(state, this.writer);
      const imported = this.local.importPolicy?.();
      let records = captureImportedChanges(journal.records, journal.baseline, current, this.writer, now, imported);
      // Persist local intentions before starting any request, including removals.
      this.local.saveJournal({ version: 1, records, baseline: current });
      if (imported) this.local.consumeImport?.(imported.id);
      records = mergeRecords(records, validRemote);
      const candidate = materializeTrip(state, records); // Validate the entire candidate before publishing anything.
      const before = stanceKeys(state); const after = stanceKeys(candidate);
      const removed = [...before].filter((key) => !after.has(key));
      let decided = false;
      const history = (this.local.removalHistory?.() ?? []).filter((entry) => entry.at > now - REMOVAL_WINDOW_MS);
      const recent = history.reduce((sum, entry) => sum + entry.count, 0);
      // A burst, or a slow drip that adds up to more than 10 removals in 24 h, is held.
      if (removed.length > 0 && (isMassRemoval(removed.length, before.size) || recent + removed.length > MASS_REMOVAL_ABSOLUTE)) {
        const signature = removalSignature(removed);
        const decision = this.local.removalDecision?.();
        if (decision?.signature !== signature) {
          this.local.holdBackup?.(signature);
          throw new SyncHold("mass-removal", removed.length, signature);
        }
        decided = true;
        if (decision.decision === "keep") {
          // Republish our likes over the remote tombstones: same IDs, newer timestamp (an update, never a create).
          for (const id of removed) {
            const key = `place:${id}`;
            records[key] = { ...current[key], updatedAt: Math.max(now, records[key].updatedAt + 1), writer: this.writer };
          }
          materializeTrip(state, records);
        }
      }
      const server = mergeRecords({}, validRemote);
      for (const record of Object.values(records)) {
        const previous = server[recordKey(record)];
        if (previous && compareRecords(previous, record) >= 0) continue;
        // A tombstone for a document the server never had has nothing to remove (rules deny it).
        if (!previous && record.deleted) continue;
        if (!this.active) return false;
        // New shared documents get a real timestamp; an empty second device must not win
        // a timestamp-zero tie against the first person's already published roster or plan.
        const outgoing = { ...record, updatedAt: record.updatedAt === 0 ? now : record.updatedAt, writer: this.writer };
        records[recordKey(record)] = outgoing;
        const winner = await this.remote.write(outgoing);
        records = mergeRecords(records, [winner]);
      }
      if (!this.active) return false;
      // Edits made while requests were in flight must participate in this merge too.
      await this.local.apply((latest) => {
        if (!this.active) return latest;
        const pendingImport = this.local.importPolicy?.();
        const changed = captureImportedChanges(records, alignProjection(current, records), alignProjection(projectTrip(latest, this.writer), records), this.writer, Date.now(), pendingImport);
        const next = materializeTrip(latest, changed);
        this.local.saveJournal({ version: 1, records: changed, baseline: projectTrip(next, this.writer) });
        if (pendingImport) this.local.consumeImport?.(pendingImport.id);
        return next;
      });
      if (decided) { this.local.consumeRemoval?.(); this.local.saveRemovalHistory?.([]); }
      else if (removed.length > 0) this.local.saveRemovalHistory?.([...history, { at: now, count: removed.length }]);
      return this.active;
    } finally { this.busy = false; }
  }
}
