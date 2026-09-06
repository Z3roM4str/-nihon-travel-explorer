import { validateDayPartition } from "./day-assignment";
import { isValidCivilDate } from "./civil-date";

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
 */

export const PLANNING_DRAFT_VERSION = 2 as const;
/** The version this module can migrate *from*. Not exported: nothing outside this module needs
 * to know a prior version ever existed, only that `parseStoredDraft` handles it. */
const V1_VERSION = 1 as const;

/** Phase 3C-D's original shape, kept only as the migration source — every other function in
 * this module operates on {@link ManualPlanningDraftV2}. */
export type ManualPlanningDraftV1 = {
  version: 1;
  routeIds: string[];
  days: string[][] | null;
};

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
 */
export function migrateV1ToV2(draft: ManualPlanningDraftV1): ManualPlanningDraftV2 {
  return { version: PLANNING_DRAFT_VERSION, routeIds: draft.routeIds, days: draft.days, startDate: null };
}

/**
 * Validates and narrows an arbitrary parsed JSON value into a `ManualPlanningDraftV2`, or `null`
 * if it is not one (after migration, if it was a valid V1 value) — malformed JSON, the wrong
 * shape, an unsupported version, non-string ids, a route with duplicate ids, or a `startDate`
 * that is present but not `null` and not a valid civil date. No migration is invented for any
 * version other than the one exact prior version (V1); an unrecognised version is treated
 * exactly like a missing draft. A duplicate id in the stored route, or an invalid `startDate`,
 * marks the *entire* stored value as untrustworthy (the same fallback as every other shape
 * problem) rather than silently repairing it — that data could not have been produced by this
 * app's own UI, so it is corrupted or foreign, not a minor defect to fix up quietly.
 *
 * This function only checks *shape*, not whether `days` still partitions `routeIds` — that
 * depends on the current saved ids too (a route id can go stale), so it is `reconcileDraft`'s
 * job, run against the caller's actual current state.
 */
export function parseStoredDraft(raw: unknown): ManualPlanningDraftV2 | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;

  if (value.version === V1_VERSION) {
    const v1 = parseStoredDraftV1(value);
    return v1 ? migrateV1ToV2(v1) : null;
  }

  if (value.version !== PLANNING_DRAFT_VERSION) return null;
  const routeAndDays = parseRouteAndDays(value);
  if (!routeAndDays) return null;

  if (value.startDate !== null && !(typeof value.startDate === "string" && isValidCivilDate(value.startDate))) {
    return null;
  }
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: routeAndDays.routeIds,
    days: routeAndDays.days,
    startDate: value.startDate,
  };
}

/** The draft for a user with no valid stored plan: the route starts as every currently saved
 * place, in its current saved order — exactly Phase 3C-A's original behaviour before this
 * phase — no day assignment exists yet, and no calendar anchor exists yet. */
export function freshDraft(savedIds: readonly string[]): ManualPlanningDraftV2 {
  return { version: PLANNING_DRAFT_VERSION, routeIds: [...savedIds], days: null, startDate: null };
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
  stored: ManualPlanningDraftV2,
  savedIds: readonly string[]
): ManualPlanningDraftV2 {
  const savedSet = new Set(savedIds);
  const routeIds = stored.routeIds.filter((id) => savedSet.has(id));

  if (stored.days === null) {
    return { version: PLANNING_DRAFT_VERSION, routeIds, days: null, startDate: stored.startDate };
  }

  const staleIds = new Set(stored.routeIds.filter((id) => !savedSet.has(id)));
  const prunedDays = stored.days.map((day) => day.filter((id) => !staleIds.has(id)));
  const { valid } = validateDayPartition(routeIds, prunedDays);
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds,
    days: valid ? prunedDays : null,
    startDate: stored.startDate,
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
): ManualPlanningDraftV2 {
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
export function writeDraft(storage: DraftStorage, draft: ManualPlanningDraftV2): void {
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
 */
export function withRoute(
  draft: ManualPlanningDraftV2,
  routeIds: readonly string[]
): ManualPlanningDraftV2 {
  const compositionUnchanged = sameIdSet(draft.routeIds, routeIds);
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: [...routeIds],
    days: compositionUnchanged ? draft.days : null,
    startDate: draft.startDate,
  };
}

/**
 * Applies a new day assignment to the draft, but only if it structurally partitions the
 * draft's current `routeIds` (`validateDayPartition`, the same rule Phase 3C-C's UI already
 * enforces by construction). An invalid partition is rejected outright — the draft is returned
 * unchanged, so a caller's bug or a corrupted intermediate state can never overwrite a
 * previously-valid canonical day assignment with an invalid one.
 */
export function withDays(
  draft: ManualPlanningDraftV2,
  days: readonly (readonly string[])[]
): ManualPlanningDraftV2 {
  const { valid } = validateDayPartition(draft.routeIds, days);
  if (!valid) return draft;
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: draft.routeIds,
    days: days.map((day) => [...day]),
    startDate: draft.startDate,
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
 */
export function withStartDate(draft: ManualPlanningDraftV2, startDate: string | null): ManualPlanningDraftV2 {
  if (startDate !== null && !isValidCivilDate(startDate)) return draft;
  return { version: PLANNING_DRAFT_VERSION, routeIds: draft.routeIds, days: draft.days, startDate };
}

/**
 * "Restablecer recorrido": the route becomes the current saved ids in their saved order and the
 * day assignment is cleared — exactly {@link freshDraft} — but the calendar anchor is carried
 * forward unchanged. Resetting the *route* is not a decision about *when* the trip starts, so a
 * previously-chosen `startDate` is not an artifact of the old route that a reset should discard;
 * only the user explicitly clearing it (`withStartDate(draft, null)`) does that.
 */
export function resetRoute(draft: ManualPlanningDraftV2, savedIds: readonly string[]): ManualPlanningDraftV2 {
  return { ...freshDraft(savedIds), startDate: draft.startDate };
}
