import { validateDayPartition } from "./day-assignment";

/**
 * Phase 3C-D — Persisted Manual Planning Draft.
 *
 * Persists the CANONICAL MANUAL PLAN — the route order/subset from Phase 3C-A and the day
 * assignment from Phase 3C-C — locally in the browser, under its own storage key, separate
 * from `nihon.savedPlaceIds` ("Quiero ir"). This module stores user *decisions*; it never
 * generates one. Everything derived from the plan — places, durations, transfer edges,
 * transfer results, visit-time summaries, transfer totals, confidence tallies, geographic
 * estimates — is recomputed on read from the current dataset/domain logic, exactly as before;
 * only ids and user-authored structure ever reach storage.
 *
 * Phase 3C-B's comparison candidates (Orden A / Orden B) are deliberately **not** part of this
 * schema and never will be — see `OrderedSequenceBuilder.tsx`'s comparison view, which still
 * derives both candidates fresh from the current route every time it opens and discards them
 * on close, exactly as it did before this phase.
 */

export const PLANNING_DRAFT_VERSION = 1 as const;

export type ManualPlanningDraftV1 = {
  version: 1;
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

/**
 * Validates and narrows an arbitrary parsed JSON value into a `ManualPlanningDraftV1`, or
 * `null` if it is not one — malformed JSON, the wrong shape, an unsupported version, non-string
 * ids, or a route with duplicate ids. No migration is invented for any other version; an
 * unsupported one is treated exactly like a missing draft. A duplicate id in the stored route
 * marks the *entire* stored value as untrustworthy (the same fallback as every other shape
 * problem) rather than silently deduping it — a duplicate-bearing route could not have been
 * produced by this app's own UI, so it is corrupted or foreign data, not a minor defect to fix
 * up quietly.
 *
 * This function only checks *shape*, not whether `days` still partitions `routeIds` — that
 * depends on the current saved ids too (a route id can go stale), so it is `reconcileDraft`'s
 * job, run against the caller's actual current state.
 */
export function parseStoredDraft(raw: unknown): ManualPlanningDraftV1 | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;

  if (value.version !== PLANNING_DRAFT_VERSION) return null;
  if (!isStringArray(value.routeIds) || !hasNoDuplicates(value.routeIds)) return null;

  if (value.days === null) {
    return { version: PLANNING_DRAFT_VERSION, routeIds: value.routeIds, days: null };
  }
  if (!Array.isArray(value.days)) return null;
  const days: string[][] = [];
  for (const day of value.days) {
    if (!isStringArray(day)) return null;
    days.push(day);
  }
  return { version: PLANNING_DRAFT_VERSION, routeIds: value.routeIds, days };
}

/** The draft for a user with no valid stored plan: the route starts as every currently saved
 * place, in its current saved order — exactly Phase 3C-A's original behaviour before this
 * phase — and no day assignment exists yet. */
export function freshDraft(savedIds: readonly string[]): ManualPlanningDraftV1 {
  return { version: PLANNING_DRAFT_VERSION, routeIds: [...savedIds], days: null };
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
  stored: ManualPlanningDraftV1,
  savedIds: readonly string[]
): ManualPlanningDraftV1 {
  const savedSet = new Set(savedIds);
  const routeIds = stored.routeIds.filter((id) => savedSet.has(id));

  if (stored.days === null) {
    return { version: PLANNING_DRAFT_VERSION, routeIds, days: null };
  }

  const staleIds = new Set(stored.routeIds.filter((id) => !savedSet.has(id)));
  const prunedDays = stored.days.map((day) => day.filter((id) => !staleIds.has(id)));
  const { valid } = validateDayPartition(routeIds, prunedDays);
  return { version: PLANNING_DRAFT_VERSION, routeIds, days: valid ? prunedDays : null };
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
): ManualPlanningDraftV1 {
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
export function writeDraft(storage: DraftStorage, draft: ManualPlanningDraftV1): void {
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
  draft: ManualPlanningDraftV1,
  routeIds: readonly string[]
): ManualPlanningDraftV1 {
  const compositionUnchanged = sameIdSet(draft.routeIds, routeIds);
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: [...routeIds],
    days: compositionUnchanged ? draft.days : null,
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
  draft: ManualPlanningDraftV1,
  days: readonly (readonly string[])[]
): ManualPlanningDraftV1 {
  const { valid } = validateDayPartition(draft.routeIds, days);
  if (!valid) return draft;
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: draft.routeIds,
    days: days.map((day) => [...day]),
  };
}
