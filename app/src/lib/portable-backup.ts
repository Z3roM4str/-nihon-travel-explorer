import {
  PLANNING_DRAFT_STORAGE_KEY,
  parseStoredDraft,
  reconcileDraft,
  type ManualPlanningDraftV8,
} from "./planning-draft-v8";
import {
  TRAVELLERS_STORAGE_KEY,
  parseTravellersDocument,
  reconcileTravellers,
  shortlistPlaceIds,
  type TravellersDocumentV1,
} from "./travellers";

/**
 * Block 13 — a portable backup of the trip, and what it deliberately is not.
 *
 * ## The capability, stated narrowly
 *
 * A trip prepared on one phone cannot today be moved to another browser. This module is the whole
 * of the answer: **write the travellers' durable decisions to a file they keep, and read that file
 * back in another browser.** No account, no server, no sync, no conflict resolution — and nothing
 * here may ever grow one, because the moment a backup can be fetched it stops being a file the
 * person controls.
 *
 * ## What a backup is, and is not
 *
 * A backup is **the human decisions**, not a photograph of storage. Those are two different things
 * and the difference is the whole design:
 *
 * ```
 * localStorage                                    portable backup
 * ─────────────────────────────────────────       ──────────────────────────
 * nihon.travellers.v1        durable decisions ──▶ data.travellers
 * nihon.manualPlanningDraft  durable decisions ──▶ data.planningDraft
 * nihon.zoneComparison.v1    a scratch pad      ✗  (see below)
 * nihon.onboarding.seen.v1   a device UI flag   ✗
 * nihon.savedPlaceIds        legacy, never written ✗
 * ```
 *
 * Copying every `nihon.*` key would have been shorter and wrong. It would weld the portable format
 * to today's storage layout, so a key added for a future modal's scroll position would start
 * travelling between devices, and a key renamed would break every file ever written.
 *
 * **Three exclusions worth arguing rather than asserting.**
 *
 * * `nihon.zoneComparison.v1` holds which zones are currently side by side per hub. That is a
 *   working set, not a decision — the *decision* it exists to produce ("for this hub we sleep in
 *   this zone") is stored in the planning draft as `zoneAccommodationChoices`, and that **is** in
 *   the backup. Restoring the scratch pad would restore the act of comparing, not its conclusion.
 * * `nihon.onboarding.seen.v1` is a fact about a browser, not about a trip. Restoring it would
 *   suppress the first-run explainer on a device that has never shown it — actively wrong.
 * * `nihon.savedPlaceIds` is the pre-Block-5 shortlist, read only when no travellers document
 *   exists and never written. Its content already lives inside `data.travellers`; exporting it too
 *   would ship a stale second copy of state the file already carries.
 *
 * ## The shortlist is derived, so it is not in the file
 *
 * "Quiero ir" is not stored anywhere. `shortlistPlaceIds()` computes it from the travellers'
 * stances on read, exactly so there is no second list to drift. Writing it into the backup would
 * be exporting a derived value — the one thing this format refuses — and would create the very
 * drift Block 5 designed it out of. A restored file recomputes the shortlist the same way the app
 * always does.
 *
 * ## Two contracts, never one
 *
 * The envelope carries `version: 1`. The documents inside carry their own versions —
 * `travellers.version` and `planningDraft.version` — and those are **not** the envelope's business.
 * A planning draft written at V6 inside a V1 envelope is an ordinary, valid file: the envelope says
 * how to read the wrapper, and `planning-draft-v8.ts` says how to read what is inside it. Merging
 * the two numbers would mean every internal schema change invalidated every file on disk.
 *
 * ## Order of authority on import
 *
 * 1. the envelope is validated here — format, version, shape;
 * 2. the domain payloads are handed, still `unknown`, to **their own** parsers;
 * 3. migration is whatever `parseStoredDraft` already does, never re-implemented here;
 * 4. what survives is reconciled against the live catalogue, and losses are counted, not hidden.
 *
 * Step 1 comes first for a reason: an internal migrator must never be able to rescue a file whose
 * envelope was not valid in the first place.
 *
 * ## Purity
 *
 * Nothing in this module reads a clock, touches `localStorage`, or performs I/O. `exportedAt` is an
 * argument. The only function that writes is {@link applyRestore}, which takes its storage as a
 * parameter and is the single place in the module where anything is persisted.
 */

export const PORTABLE_BACKUP_FORMAT = "nihon-portable-backup";
export const PORTABLE_BACKUP_VERSION = 1 as const;

/** The keys a restore replaces. Exactly the two that hold durable human decisions. */
export const RESTORED_STORAGE_KEYS = [TRAVELLERS_STORAGE_KEY, PLANNING_DRAFT_STORAGE_KEY] as const;

export type NihonPortableBackupV1 = {
  format: typeof PORTABLE_BACKUP_FORMAT;
  version: typeof PORTABLE_BACKUP_VERSION;
  /** ISO 8601 instant. The only field here that is not a decision, and the only one not asserted
   * by the determinism tests. */
  exportedAt: string;
  data: {
    travellers: TravellersDocumentV1;
    /** `null` when the person has no plan yet — a real state, distinct from an empty plan. */
    planningDraft: ManualPlanningDraftV8 | null;
  };
};

/**
 * Why a file cannot be restored at all.
 *
 * Every one of these means **nothing is written**. They are separated rather than collapsed into
 * one "invalid file" because the person is owed a sentence about what they gave us, and because
 * `unsupported-version` in particular is not corruption — it is a file from a future Nihon, and
 * saying so is the difference between "this is broken" and "this app is too old".
 */
export type BackupProblem =
  | { kind: "empty" }
  | { kind: "not-json" }
  | { kind: "not-an-object" }
  | { kind: "wrong-format"; found: string | null }
  | { kind: "unsupported-version"; found: number | null }
  | { kind: "invalid-envelope" }
  | { kind: "invalid-travellers" }
  | { kind: "invalid-planning-draft" };

export type BackupReadResult =
  | { ok: true; backup: NihonPortableBackupV1 }
  | { ok: false; problem: BackupProblem };

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** The exact set of keys a V1 envelope may carry. Strict: an unexpected key rejects the file. */
const ENVELOPE_KEYS = ["format", "version", "exportedAt", "data"] as const;
const DATA_KEYS = ["travellers", "planningDraft"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Own-key list, used to enforce the strict policy.
 *
 * `Object.keys` is deliberate: it returns own enumerable keys including a `"__proto__"` that
 * `JSON.parse` produced as an ordinary own property, so a file carrying one is *seen* here and
 * rejected as an unexpected key rather than quietly ignored. This module never assigns a parsed
 * key into an object (`target[key] = value`), which is the assignment that would otherwise replace
 * a fresh object's prototype.
 */
function hasExactlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

// ── Building and serialising ──────────────────────────────────────────────────────────────────

/**
 * A backup of the two canonical documents, as of `exportedAt`.
 *
 * `exportedAt` is a parameter and not a `new Date()` so the whole module stays pure and every test
 * can state the moment rather than mock the clock. `usePortableBackup.ts` is the one place that
 * reads a real clock.
 */
export function buildPortableBackup(
  travellers: TravellersDocumentV1,
  planningDraft: ManualPlanningDraftV8 | null,
  exportedAt: string
): NihonPortableBackupV1 {
  return {
    format: PORTABLE_BACKUP_FORMAT,
    version: PORTABLE_BACKUP_VERSION,
    exportedAt,
    data: { travellers, planningDraft },
  };
}

/** Pretty-printed on purpose: a backup a person keeps should be one they can open and read. */
export function serializePortableBackup(backup: NihonPortableBackupV1): string {
  return JSON.stringify(backup, null, 2);
}

/** `nihon-backup-YYYY-MM-DD.json`. Recognisable, and never used to decide whether a file is valid. */
export function backupFileName(civilDate: string): string {
  return `nihon-backup-${civilDate}.json`;
}

// ── Reading ───────────────────────────────────────────────────────────────────────────────────

/**
 * Validates the envelope of something that came from outside, and nothing more.
 *
 * The argument is `unknown` and stays `unknown` all the way down: there is no `as` in this
 * function, and the domain payloads leave it still untyped, because deciding whether they are a
 * travellers document or a planning draft is not the envelope's job.
 */
export function parseBackupEnvelope(
  raw: unknown
): { ok: true; exportedAt: string; travellers: unknown; planningDraft: unknown } | { ok: false; problem: BackupProblem } {
  if (!isPlainObject(raw)) return { ok: false, problem: { kind: "not-an-object" } };

  // The discriminant is checked before the version, so a file that was never a Nihon backup is
  // never reported as "a Nihon backup from the future".
  if (raw.format !== PORTABLE_BACKUP_FORMAT) {
    return {
      ok: false,
      problem: { kind: "wrong-format", found: typeof raw.format === "string" ? raw.format : null },
    };
  }
  if (raw.version !== PORTABLE_BACKUP_VERSION) {
    return {
      ok: false,
      problem: {
        kind: "unsupported-version",
        found: typeof raw.version === "number" ? raw.version : null,
      },
    };
  }
  if (!hasExactlyKeys(raw, ENVELOPE_KEYS)) return { ok: false, problem: { kind: "invalid-envelope" } };
  if (typeof raw.exportedAt !== "string" || !ISO_INSTANT.test(raw.exportedAt)) {
    return { ok: false, problem: { kind: "invalid-envelope" } };
  }
  if (!isPlainObject(raw.data) || !hasExactlyKeys(raw.data, DATA_KEYS)) {
    return { ok: false, problem: { kind: "invalid-envelope" } };
  }
  return {
    ok: true,
    exportedAt: raw.exportedAt,
    travellers: raw.data.travellers,
    planningDraft: raw.data.planningDraft,
  };
}

/**
 * The whole read: text in, a validated backup or a reason out. Never writes anything.
 *
 * The delegation is the point. `parseTravellersDocument` and `parseStoredDraft` are the existing
 * authorities on their own documents, including every version migration the draft has accumulated
 * since V1, and this function does not second-guess either. What it adds is the order: the envelope
 * is settled first, so no internal migration can promote a malformed file into a valid one.
 */
export function readPortableBackup(text: string): BackupReadResult {
  if (text.trim().length === 0) return { ok: false, problem: { kind: "empty" } };

  let decoded: unknown;
  try {
    decoded = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, problem: { kind: "not-json" } };
  }

  const envelope = parseBackupEnvelope(decoded);
  if (!envelope.ok) return { ok: false, problem: envelope.problem };

  const travellers = parseTravellersDocument(envelope.travellers);
  if (!travellers) return { ok: false, problem: { kind: "invalid-travellers" } };

  // `null` is a legitimate value — somebody who has marked places but not planned yet — and is
  // distinguished here from "present but unreadable", which is a blocking error.
  let planningDraft: ManualPlanningDraftV8 | null = null;
  if (envelope.planningDraft !== null) {
    planningDraft = parseStoredDraft(envelope.planningDraft);
    if (!planningDraft) return { ok: false, problem: { kind: "invalid-planning-draft" } };
  }

  return {
    ok: true,
    backup: buildPortableBackup(travellers, planningDraft, envelope.exportedAt),
  };
}

// ── Planning a restore ────────────────────────────────────────────────────────────────────────

/**
 * A validated, reconciled restore, ready to be applied — and the losses it would incur.
 *
 * Producing this is the last step that can fail without touching storage. Everything after it is
 * writing.
 */
export type RestorePlan = {
  travellers: TravellersDocumentV1;
  planningDraft: ManualPlanningDraftV8 | null;
  /**
   * Places the file remembers that this build's catalogue no longer has.
   *
   * Counted rather than swallowed. A backup written against an older dataset is not corrupt, but
   * restoring it is not lossless either, and saying "restored" without saying "except these four"
   * would be a lie of exactly the kind this block exists to prevent.
   */
  droppedPlaceIds: string[];
};

/**
 * The human-readable shape of what a restore would do. Units a traveller recognises.
 *
 * Deliberately not a JSON preview: the question a person is answering is "is this the right trip?",
 * and no one answers that by reading a draft schema.
 */
export type RestoreSummary = {
  travellerLabels: string[];
  shortlistCount: number;
  statedPreferenceCount: number;
  routeCount: number;
  dayCount: number;
  startDate: string | null;
  endDate: string | null;
  visitTimeCount: number;
  accommodationCount: number;
  interHubSegmentCount: number;
  zoneChoiceCount: number;
  droppedPlaceCount: number;
};

/**
 * Reconciles a validated backup against the live catalogue.
 *
 * Both reconciliations are the existing ones: `reconcileTravellers` drops interests in places that
 * no longer exist, and `reconcileDraft` prunes the plan against the shortlist that survives. The
 * order matters and is not arbitrary — the draft is reconciled against the *post-reconciliation*
 * shortlist, so a route entry cannot outlive the stance that put it there.
 */
export function planRestore(
  backup: NihonPortableBackupV1,
  knownPlaceIds: readonly string[]
): RestorePlan {
  const known = new Set(knownPlaceIds);
  const droppedPlaceIds = backup.data.travellers.interests
    .map((interest) => interest.placeId)
    .filter((placeId) => !known.has(placeId));

  const travellers = reconcileTravellers(backup.data.travellers, knownPlaceIds);
  const planningDraft = backup.data.planningDraft
    ? reconcileDraft(backup.data.planningDraft, shortlistPlaceIds(travellers))
    : null;

  return { travellers, planningDraft, droppedPlaceIds };
}

export function summarizeRestore(plan: RestorePlan): RestoreSummary {
  const draft = plan.planningDraft;
  return {
    travellerLabels: plan.travellers.travellers.map((traveller) => traveller.label),
    shortlistCount: shortlistPlaceIds(plan.travellers).length,
    // One person saying one thing about one place. Two people who both want somewhere count twice,
    // because two preferences were stated — this is a count of statements, never a score.
    statedPreferenceCount: plan.travellers.interests.reduce(
      (total, interest) => total + interest.stances.length,
      0
    ),
    routeCount: draft ? draft.routeIds.length : 0,
    dayCount: draft && draft.days ? draft.days.length : 0,
    startDate: draft ? draft.startDate : null,
    endDate: draft ? draft.endDate : null,
    visitTimeCount: draft ? Object.keys(draft.visitStartTimes).length : 0,
    accommodationCount: draft ? draft.accommodations.length : 0,
    interHubSegmentCount: draft ? draft.interHubSegments.length : 0,
    zoneChoiceCount: draft ? draft.zoneAccommodationChoices.length : 0,
    droppedPlaceCount: plan.droppedPlaceIds.length,
  };
}

// ── Applying ──────────────────────────────────────────────────────────────────────────────────

export type RestoreStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/**
 * What happened when the plan was applied.
 *
 * `rolledBack` is reported honestly, including when it is `false`: a rollback that itself threw is
 * the one case where storage is left in a state nobody chose, and pretending otherwise would be
 * worse than saying so.
 */
export type RestoreOutcome =
  | { ok: true }
  | { ok: false; failedKey: string; rolledBack: boolean };

/**
 * Writes the plan, restoring the previous values if any write fails.
 *
 * **This is best-effort rollback, not a transaction, and the difference is deliberate.**
 * `localStorage` offers no atomicity: there is no way to make two `setItem` calls succeed or fail
 * together, so this does the next honest thing — read both keys first, write both, and on any
 * throw put the captured values back. What it buys is that a half-restore does not survive: you do
 * not end up with the file's travellers beside the old plan, which would be a trip neither person
 * ever had.
 *
 * What it cannot promise is that the rollback itself succeeds. If storage is failing, restoring the
 * snapshot can fail too, and `rolledBack: false` says exactly that rather than claiming a
 * guarantee the platform does not offer.
 *
 * Replace, never merge: a `null` draft **removes** the stored key rather than leaving the previous
 * plan behind. A restore that silently kept the old itinerary would be the implicit merge §8 rules
 * out, arrived at by omission.
 */
export function applyRestore(storage: RestoreStorage, plan: RestorePlan): RestoreOutcome {
  const previous = new Map<string, string | null>();
  for (const key of RESTORED_STORAGE_KEYS) {
    try {
      previous.set(key, storage.getItem(key));
    } catch {
      previous.set(key, null);
    }
  }

  const writes: { key: string; value: string | null }[] = [
    { key: TRAVELLERS_STORAGE_KEY, value: JSON.stringify(plan.travellers) },
    {
      key: PLANNING_DRAFT_STORAGE_KEY,
      value: plan.planningDraft ? JSON.stringify(plan.planningDraft) : null,
    },
  ];

  // Only what actually landed is undone. If the first write fails, nothing was written and there
  // is nothing to roll back — reporting a failed rollback there would describe a problem that does
  // not exist, and would usually be reporting the same storage refusing the same key twice.
  const written: string[] = [];
  for (const write of writes) {
    try {
      if (write.value === null) storage.removeItem(write.key);
      else storage.setItem(write.key, write.value);
      written.push(write.key);
    } catch {
      let rolledBack = true;
      try {
        for (const key of written) {
          const value = previous.get(key) ?? null;
          if (value === null) storage.removeItem(key);
          else storage.setItem(key, value);
        }
      } catch {
        rolledBack = false;
      }
      return { ok: false, failedKey: write.key, rolledBack };
    }
  }

  return { ok: true };
}
