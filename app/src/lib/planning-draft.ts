import { validateDayPartition } from "./day-assignment";
import { isValidCivilDate } from "./civil-date";
import { VISIT_START_TIME_PATTERN } from "./recorded-interval-fit";

/**
 * Phase 3C-D — Persisted Manual Planning Draft, extended by Phase 3C-E — Manual Calendar
 * Anchoring.
 *
 * Persists the CANONICAL MANUAL PLAN — the route order/subset from Phase 3C-A, the day
 * assignment from Phase 3C-C, and (since Phase 3C-E) an optional manual calendar anchor for
 * "Día 1" — locally in the browser, under its own storage key, separate from
 * `nihon.savedPlaceIds` ("Quiero ir"). This module stores user *decisions*; it never generates
 * one. Everything derived from the plan — places, durations, transfer edges, transfer results,
 * visit-time summaries, transfer totals, confidence tallies, geographic estimates, weekday
 * names — is recomputed on read from the current dataset/domain logic (or, for the calendar
 * anchor, from `civil-date.ts`), exactly as before; only ids and user-authored structure ever
 * reach storage.
 *
 * Phase 3C-B's comparison candidates (Orden A / Orden B) are deliberately **not** part of this
 * schema and never will be — see `OrderedSequenceBuilder.tsx`'s comparison view, which still
 * derives both candidates fresh from the current route every time it opens and discards them
 * on close, exactly as it did before this phase.
 *
 * **Phase 3D-L adds one more user decision, and only a decision.** `visitStartTimes` stores the
 * `HH:mm` clock times the user typed by hand for individual places. Nothing derived from them ever
 * reaches storage — not parsed minutes, not the recorded interval, not the resolved duration, not
 * the `RecordedIntervalDurationFit` result, not the derived visit date, not any formatted
 * sentence. All of that is recomputed on read by `recorded-interval-fit.ts`, exactly like every
 * other derived value this module has always excluded.
 */

export const PLANNING_DRAFT_VERSION = 3 as const;
/** The versions this module can migrate *from*. Not exported: nothing outside this module needs
 * to know a prior version ever existed, only that `parseStoredDraft` handles it. */
const V1_VERSION = 1 as const;
const V2_VERSION = 2 as const;

/** Phase 3C-D's original shape, kept only as a migration source — every other function in
 * this module operates on {@link ManualPlanningDraftV3}. Retained deliberately after Phase 3D-L
 * introduced V3: a draft stored before Phase 3C-E must stay loadable, so the V1 → V2 → V3 chain
 * keeps every historical shape reachable. */
export type ManualPlanningDraftV1 = {
  version: 1;
  routeIds: string[];
  days: string[][] | null;
};

/** Phase 3C-E's shape, kept as the second migration source for the same reason V1 is kept. */
export type ManualPlanningDraftV2 = {
  version: 2;
  /** Ordered subset of currently saved place ids, user-authored. May be empty — an empty route
   * is a valid, intentional state, not the absence of a draft. */
  routeIds: string[];
  /**
   * The canonical manual day assignment, or `null` when none exists yet (never split into
   * days) or has been invalidated (see `withRoute` below). When present, every array is an
   * ordinal day bucket in the user's explicit order; an individual bucket may be empty, but
   * `days` itself is never `[]` — see `validateDayPartition`'s `"no-days"` rule, reused here so
   * persistence can never disagree with the Phase 3C-C UI about what counts as a valid split.
   */
  days: string[][] | null;
  /**
   * Phase 3C-E: the manually chosen civil date (`YYYY-MM-DD`, see `civil-date.ts`) anchoring
   * "Día 1", or `null` when the user has not chosen one. "Día N" (for the Nth day bucket,
   * 1-indexed) is `startDate` offset by `N - 1` calendar days — computed on render
   * (`civil-date.ts#addCivilDays`), never stored per day. No weekday name, month name, or
   * `Date` object is ever persisted; only this one plain string.
   *
   * Deliberately independent of `routeIds`/`days`: a route composition change, a day-bucket
   * edit, or `resetRoute` never touches this field — only the user explicitly setting or
   * clearing it does (see `withStartDate`/`resetRoute` below). The calendar anchor is a
   * decision about *when* the trip starts, not about which places go where, so invalidating one
   * has no bearing on the other.
   */
  startDate: string | null;
};

/**
 * The current schema. Written out in full rather than as
 * `Omit<ManualPlanningDraftV2, "version"> & { ... }`: an intersection type does not reliably
 * report a MISSING required property on an object literal, so the shorthand let a V3 value be
 * constructed with no `visitStartTimes` at all and still typecheck. Spelling every field out
 * means the compiler catches that everywhere, including in tests.
 */
export type ManualPlanningDraftV3 = {
  version: 3;
  /** Ordered subset of currently saved place ids, user-authored. May be empty — an empty route
   * is a valid, intentional state, not the absence of a draft. */
  routeIds: string[];
  /** The canonical manual day assignment, or `null` — see {@link ManualPlanningDraftV2.days}. */
  days: string[][] | null;
  /** Phase 3C-E's manual civil-date anchor for "Día 1" — see
   * {@link ManualPlanningDraftV2.startDate}. */
  startDate: string | null;
  /**
   * Phase 3D-L: the manual visit start times, `placeId -> "HH:mm"`, or `{}` when the user has
   * chosen none. Local civil clock times exactly as typed — never a `Date`, an epoch value, an
   * ISO instant, a UTC conversion, or minutes-since-midnight; the numeric form is derived on read
   * by `recorded-interval-fit.ts` and never stored.
   *
   * `{}` and "no times chosen" are the same state and have exactly one spelling: this field is
   * never `null`, so no consumer has to handle two ways of saying nothing.
   *
   * **Only a user decision is stored here**, never a result. The comparison against a recorded
   * interval — whether the recorded duration fits, only its minimum fits, or it exceeds — is
   * recomputed on every render from the current dataset and current planning state, exactly like
   * every other derived value this schema has always excluded.
   *
   * Unlike `startDate`, this field is **tied to route place ids**: a time is a decision about a
   * *place*, so it is pruned when that place leaves the route (see `reconcileDraft`/`withRoute`),
   * whereas the calendar anchor is a decision about the *trip* and survives route changes. A pure
   * reorder, a day re-split, and a `startDate` change all leave every time untouched — none of
   * them changes which place the user made a decision about.
   */
  visitStartTimes: Record<string, string>;
};

/** Minimal storage interface `planning-draft.ts` depends on, so tests can exercise read/write
 * exceptions without touching real browser `localStorage`. `usePlanningDraft.ts` supplies the
 * real `localStorage` at runtime. */
export type DraftStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export const PLANNING_DRAFT_STORAGE_KEY = "nihon.manualPlanningDraft";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasNoDuplicates(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

/** Shape-validates the `routeIds`/`days` fields common to every version, returning them (still
 * needing a `version`/`startDate` wrapper) or `null` on any structural problem. Shared by the
 * V1 and V2 parsers below so the two can never quietly diverge on what counts as a well-formed
 * route or day list. */
function parseRouteAndDays(value: Record<string, unknown>): { routeIds: string[]; days: string[][] | null } | null {
  if (!isStringArray(value.routeIds) || !hasNoDuplicates(value.routeIds)) return null;

  if (value.days === null) {
    return { routeIds: value.routeIds, days: null };
  }
  if (!Array.isArray(value.days)) return null;
  const days: string[][] = [];
  for (const day of value.days) {
    if (!isStringArray(day)) return null;
    days.push(day);
  }
  return { routeIds: value.routeIds, days };
}

/**
 * Shape-validates a stored `visitStartTimes` map, returning it or `null` on ANY structural
 * problem: a non-object (including `null`, an array, or a primitive), a non-string value, or a
 * value that is not an exact `HH:mm` local clock time per
 * `recorded-interval-fit.ts#VISIT_START_TIME_PATTERN` — the same pattern the evaluator uses, so
 * persistence and arithmetic can never disagree about what a well-formed manual time is.
 *
 * A single malformed entry rejects the WHOLE map, which in turn rejects the whole stored draft
 * (see `parseStoredDraft`). That is the module's existing all-or-nothing corruption policy —
 * identical to a duplicate route id or an invalid `startDate` — and it is deliberately NOT a
 * quiet per-entry repair: `"9:00"`, `"24:00"`, `"12:60"`, a number, `null`, an array, or a nested
 * object could not have been produced by this app's own UI, so the value is foreign or corrupted,
 * not a minor defect to fix up silently.
 *
 * Keys are accepted as-is: `Object.keys` yields only strings, and whether a key is still a live
 * route id is a *reconciliation* question (against the caller's current saved ids), not a shape
 * question — exactly the same split `days` already has.
 */
function parseVisitStartTimes(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  const parsed: Record<string, string> = {};
  for (const [placeId, time] of entries) {
    if (typeof time !== "string" || !VISIT_START_TIME_PATTERN.test(time)) return null;
    parsed[placeId] = time;
  }
  return parsed;
}

/** Keeps only the times whose place id is still in `routeIds`. A time is a decision about a
 * place, so it dies with that place — never retained as orphan state, never re-added, and never
 * used to infer anything about another place. */
function pruneVisitStartTimes(
  visitStartTimes: Readonly<Record<string, string>>,
  routeIds: readonly string[]
): Record<string, string> {
  const live = new Set(routeIds);
  const pruned: Record<string, string> = {};
  for (const [placeId, time] of Object.entries(visitStartTimes)) {
    if (live.has(placeId)) pruned[placeId] = time;
  }
  return pruned;
}

/** Parses Phase 3C-D's original (pre-calendar-anchoring) shape. Only ever called from
 * `parseStoredDraft` below, for migration — nothing else in this module reads a V1 value. */
function parseStoredDraftV1(value: Record<string, unknown>): ManualPlanningDraftV1 | null {
  const routeAndDays = parseRouteAndDays(value);
  if (!routeAndDays) return null;
  return { version: V1_VERSION, routeIds: routeAndDays.routeIds, days: routeAndDays.days };
}

/**
 * Migrates a shape-valid V1 draft to V2. The only possible new field, `startDate`, is always
 * `null` — a V1 draft predates calendar anchoring entirely, so there is no user decision to
 * carry forward and none is invented. `routeIds`/`days` pass through completely unchanged;
 * this is a pure addition, never a reinterpretation of the existing fields.
 *
 * Kept targeting V2 rather than jumping straight to V3 after Phase 3D-L: each migration step
 * stays a small, separately testable statement about exactly one schema change, and
 * `parseStoredDraft` composes them (V1 → V2 → V3).
 */
export function migrateV1ToV2(draft: ManualPlanningDraftV1): ManualPlanningDraftV2 {
  return { version: V2_VERSION, routeIds: draft.routeIds, days: draft.days, startDate: null };
}

/**
 * Migrates a shape-valid V2 draft to V3. The only new field, `visitStartTimes`, is always `{}` —
 * a V2 draft predates manual visit start times entirely, so there is no user decision to carry
 * forward and none is invented (no `09:00`, no opening time, no time inferred from `bestTime` or
 * anything else). `routeIds`/`days`/`startDate` pass through completely unchanged: a pure
 * addition, exactly like `migrateV1ToV2`, never a reinterpretation of an existing field.
 */
export function migrateV2ToV3(draft: ManualPlanningDraftV2): ManualPlanningDraftV3 {
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: draft.routeIds,
    days: draft.days,
    startDate: draft.startDate,
    visitStartTimes: {},
  };
}

/** Shape-validates the `startDate` field shared by V2 and V3: absent-as-`null`, or a real civil
 * date. Returns `undefined` (rather than `null`, a legitimate value) when the field is invalid. */
function parseStoredStartDate(value: Record<string, unknown>): string | null | undefined {
  if (value.startDate === null) return null;
  if (typeof value.startDate === "string" && isValidCivilDate(value.startDate)) return value.startDate;
  return undefined;
}

/** Parses Phase 3C-E's shape (V2). Only ever called from `parseStoredDraft` below, for
 * migration — nothing else in this module reads a V2 value. */
function parseStoredDraftV2(value: Record<string, unknown>): ManualPlanningDraftV2 | null {
  const routeAndDays = parseRouteAndDays(value);
  if (!routeAndDays) return null;
  const startDate = parseStoredStartDate(value);
  if (startDate === undefined) return null;
  return { version: V2_VERSION, routeIds: routeAndDays.routeIds, days: routeAndDays.days, startDate };
}

/**
 * Validates and narrows an arbitrary parsed JSON value into a `ManualPlanningDraftV3`, or `null`
 * if it is not one (after migration, if it was a valid V1 or V2 value) — malformed JSON, the wrong
 * shape, an unsupported version, non-string ids, a route with duplicate ids, a `startDate` that is
 * present but not `null` and not a valid civil date, or a `visitStartTimes` map that is not a plain
 * object of `HH:mm` strings. Migration is invented for no version other than the two exact prior
 * versions (V1, V2), chained V1 → V2 → V3; an unrecognised version is treated exactly like a
 * missing draft. A duplicate id in the stored route, an invalid `startDate`, or a single malformed
 * visit start time marks the *entire* stored value as untrustworthy (the same fallback as every
 * other shape problem) rather than silently repairing it — that data could not have been produced
 * by this app's own UI, so it is corrupted or foreign, not a minor defect to fix up quietly.
 *
 * This function only checks *shape*, not whether `days` still partitions `routeIds`, nor whether a
 * `visitStartTimes` key is still a live route id — both depend on the current saved ids too (a
 * route id can go stale), so they are `reconcileDraft`'s job, run against the caller's actual
 * current state.
 */
export function parseStoredDraft(raw: unknown): ManualPlanningDraftV3 | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;

  if (value.version === V1_VERSION) {
    const v1 = parseStoredDraftV1(value);
    return v1 ? migrateV2ToV3(migrateV1ToV2(v1)) : null;
  }

  if (value.version === V2_VERSION) {
    const v2 = parseStoredDraftV2(value);
    return v2 ? migrateV2ToV3(v2) : null;
  }

  if (value.version !== PLANNING_DRAFT_VERSION) return null;
  const routeAndDays = parseRouteAndDays(value);
  if (!routeAndDays) return null;

  const startDate = parseStoredStartDate(value);
  if (startDate === undefined) return null;

  const visitStartTimes = parseVisitStartTimes(value.visitStartTimes);
  if (visitStartTimes === null) return null;

  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: routeAndDays.routeIds,
    days: routeAndDays.days,
    startDate,
    visitStartTimes,
  };
}

/** The draft for a user with no valid stored plan: the route starts as every currently saved
 * place, in its current saved order — exactly Phase 3C-A's original behaviour before this
 * phase — no day assignment exists yet, no calendar anchor exists yet, and no visit start time
 * exists yet. */
export function freshDraft(savedIds: readonly string[]): ManualPlanningDraftV3 {
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: [...savedIds],
    days: null,
    startDate: null,
    visitStartTimes: {},
  };
}

/**
 * Reconciles an already shape-valid stored draft against the *current* saved ids. A stored
 * route id no longer in `savedIds` is pruned from the route and from every day bucket that
 * referenced it — never re-added, never replaced, never used to infer another place. A newly
 * saved id that was never part of the stored route is **not** added here or anywhere else; it
 * stays outside the route until the user explicitly adds it (Phase 3C-A's existing "Guardados
 * fuera del recorrido" flow already does exactly that with whatever `routeIds` this returns).
 *
 * Day-bucket pruning removes *only* ids that fell out of the route because they went stale
 * (present in `stored.routeIds`, absent from `savedIds`) — never an id that simply never
 * belonged to the route in the first place. That second case is a structural "extra-ids"
 * problem, not staleness, and must be caught by validation below rather than quietly erased:
 * silently dropping it here would make a corrupted day assignment look valid by accident.
 *
 * After pruning, `days` is re-validated with `validateDayPartition` against the pruned route:
 * if it still exactly partitions the surviving ids, it is retained as-is (same day count, same
 * empty days, same per-day order); otherwise it becomes `null` rather than being patched —
 * nothing here ever appends a place to a day, invents a new day, or guesses where a place
 * belongs.
 */
export function reconcileDraft(
  stored: ManualPlanningDraftV3,
  savedIds: readonly string[]
): ManualPlanningDraftV3 {
  const savedSet = new Set(savedIds);
  const routeIds = stored.routeIds.filter((id) => savedSet.has(id));
  // Phase 3D-L: a manual visit start time is a decision about a place, so it is pruned by exactly
  // the same staleness rule as the route itself — never left behind as orphan state for a place
  // that is no longer in the plan, and never re-added if that place comes back.
  const visitStartTimes = pruneVisitStartTimes(stored.visitStartTimes, routeIds);

  if (stored.days === null) {
    return { version: PLANNING_DRAFT_VERSION, routeIds, days: null, startDate: stored.startDate, visitStartTimes };
  }

  const staleIds = new Set(stored.routeIds.filter((id) => !savedSet.has(id)));
  const prunedDays = stored.days.map((day) => day.filter((id) => !staleIds.has(id)));
  const { valid } = validateDayPartition(routeIds, prunedDays);
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds,
    days: valid ? prunedDays : null,
    startDate: stored.startDate,
    visitStartTimes,
  };
}

/**
 * Reads and shape-validates the stored draft, then reconciles it against `savedIds`. Returns a
 * fresh draft (see `freshDraft`) whenever there is no valid stored draft to reconcile — a
 * missing value, malformed JSON, a read exception, or a value `parseStoredDraft` rejects.
 *
 * The "no valid stored plan" and "valid stored plan whose route is empty" cases are
 * deliberately distinguished: only the former falls back to `freshDraft`. A stored
 * `routeIds: []` is a real, shape-valid draft — reconciling it still yields `[]`, and it must
 * never be reinterpreted as "nothing was stored" just because it happens to be empty.
 */
export function loadReconciledDraft(
  storage: DraftStorage,
  savedIds: readonly string[]
): ManualPlanningDraftV3 {
  let raw: string | null;
  try {
    raw = storage.getItem(PLANNING_DRAFT_STORAGE_KEY);
  } catch {
    return freshDraft(savedIds);
  }
  if (!raw) return freshDraft(savedIds);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return freshDraft(savedIds);
  }

  const stored = parseStoredDraft(parsed);
  if (!stored) return freshDraft(savedIds);
  return reconcileDraft(stored, savedIds);
}

/** Writes a draft to storage, swallowing any exception (quota exceeded, storage disabled,
 * private-browsing restrictions) exactly like `useSavedPlaces` already does for
 * `nihon.savedPlaceIds` — the app keeps working from the in-memory draft either way. */
export function writeDraft(storage: DraftStorage, draft: ManualPlanningDraftV3): void {
  try {
    storage.setItem(PLANNING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — the draft stays in-memory only for this session */
  }
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/**
 * Applies a new route to the draft. If the exact *set* of ids is unchanged (only the order
 * differs — a plain reorder, or a no-op), the existing canonical day assignment is retained
 * exactly as it already validly partitioned that same set. If the set changed at all (a place
 * added to or removed from the route), the day assignment is invalidated (`days: null`) —
 * this module never invents which day a newly-added place belongs to, or repairs a day that no
 * longer accounts for a removed one; the user re-splits explicitly if they still want one.
 *
 * Phase 3D-L: manual visit start times survive a pure reorder untouched — the decision is attached
 * to a place, not to a position. On a composition change they are pruned to the new route, so a
 * removed place takes its time with it; a newly added place never receives one.
 */
export function withRoute(
  draft: ManualPlanningDraftV3,
  routeIds: readonly string[]
): ManualPlanningDraftV3 {
  const compositionUnchanged = sameIdSet(draft.routeIds, routeIds);
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: [...routeIds],
    days: compositionUnchanged ? draft.days : null,
    startDate: draft.startDate,
    visitStartTimes: compositionUnchanged
      ? draft.visitStartTimes
      : pruneVisitStartTimes(draft.visitStartTimes, routeIds),
  };
}

/**
 * Applies a new day assignment to the draft, but only if it structurally partitions the
 * draft's current `routeIds` (`validateDayPartition`, the same rule Phase 3C-C's UI already
 * enforces by construction). An invalid partition is rejected outright — the draft is returned
 * unchanged, so a caller's bug or a corrupted intermediate state can never overwrite a
 * previously-valid canonical day assignment with an invalid one.
 *
 * Phase 3D-L: re-splitting days, or moving a place between buckets, never invents, alters, or
 * discards a manual visit start time. The partition invariant guarantees the place is still in
 * exactly one bucket, and the user's decision about that place has not changed — only the day it
 * is evaluated against has, and that is recomputed on read.
 */
export function withDays(
  draft: ManualPlanningDraftV3,
  days: readonly (readonly string[])[]
): ManualPlanningDraftV3 {
  const { valid } = validateDayPartition(draft.routeIds, days);
  if (!valid) return draft;
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: draft.routeIds,
    days: days.map((day) => [...day]),
    startDate: draft.startDate,
    visitStartTimes: draft.visitStartTimes,
  };
}

/**
 * Phase 3C-E: sets, changes, or clears the manual calendar anchor. `startDate` must be `null`
 * (explicitly clearing it) or a valid civil date (`civil-date.ts#isValidCivilDate`) — an invalid
 * string is rejected outright, exactly like `withDays` rejects an invalid partition: the draft
 * is returned unchanged rather than silently coerced to `null` or to some other guessed value.
 *
 * Deliberately independent of `routeIds`/`days` — see the field doc on
 * {@link ManualPlanningDraftV2.startDate}.
 *
 * Phase 3D-L: changing or clearing the trip's start date never rewrites a manual visit start time.
 * The two are different decisions — which calendar day the trip begins on, versus what time of day
 * the user plans to arrive at one place — and only the recomputed comparison changes.
 */
export function withStartDate(draft: ManualPlanningDraftV3, startDate: string | null): ManualPlanningDraftV3 {
  if (startDate !== null && !isValidCivilDate(startDate)) return draft;
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: draft.routeIds,
    days: draft.days,
    startDate,
    visitStartTimes: draft.visitStartTimes,
  };
}

/**
 * Phase 3D-L: sets, replaces, or clears ONE place's manual visit start time.
 *
 * `time` must be `null` (explicitly clearing it) or an exact `HH:mm` local clock time — the same
 * `VISIT_START_TIME_PATTERN` stored drafts are validated against. Anything else is rejected
 * outright and the draft is returned unchanged, exactly like `withStartDate` rejects an invalid
 * date and `withDays` rejects an invalid partition: never coerced, never rounded, never guessed.
 *
 * A `placeId` that is not in the draft's current `routeIds` is rejected the same way, so this
 * function can never create orphan state that `reconcileDraft` would then have to clean up.
 *
 * This is the ONLY way a visit start time enters the draft, and the value stored is exactly what
 * the user typed. No default is ever supplied — not `09:00`, not the recorded opening time, not the
 * current clock, and nothing derived from `bestTime`, route order, transfers, or another place.
 */
export function withVisitStartTime(
  draft: ManualPlanningDraftV3,
  placeId: string,
  time: string | null
): ManualPlanningDraftV3 {
  if (!draft.routeIds.includes(placeId)) return draft;
  if (time !== null && !VISIT_START_TIME_PATTERN.test(time)) return draft;

  const visitStartTimes = { ...draft.visitStartTimes };
  if (time === null) {
    if (!(placeId in visitStartTimes)) return draft;
    delete visitStartTimes[placeId];
  } else {
    if (visitStartTimes[placeId] === time) return draft;
    visitStartTimes[placeId] = time;
  }

  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: draft.routeIds,
    days: draft.days,
    startDate: draft.startDate,
    visitStartTimes,
  };
}

/**
 * "Restablecer recorrido": the route becomes the current saved ids in their saved order and the
 * day assignment is cleared — exactly {@link freshDraft} — but the calendar anchor is carried
 * forward unchanged. Resetting the *route* is not a decision about *when* the trip starts, so a
 * previously-chosen `startDate` is not an artifact of the old route that a reset should discard;
 * only the user explicitly clearing it (`withStartDate(draft, null)`) does that.
 *
 * Phase 3D-L: manual visit start times are carried forward for places that are still saved, and
 * pruned for those that are not — the same place-scoped staleness rule `reconcileDraft` applies.
 * A reset rebuilds *which places are in the route*, so a time for a place that is no longer saved
 * has nothing left to refer to; a time for a place still in the rebuilt route is a decision the
 * user made and never asked to discard.
 */
export function resetRoute(draft: ManualPlanningDraftV3, savedIds: readonly string[]): ManualPlanningDraftV3 {
  return {
    ...freshDraft(savedIds),
    startDate: draft.startDate,
    visitStartTimes: pruneVisitStartTimes(draft.visitStartTimes, savedIds),
  };
}
