import { getBestTransfer, type TransferEdge } from "./transfer";
import { orderedSequenceFromLookup, type OrderedSequence } from "./ordered-sequence";

/**
 * Phase 3C-C — User-Defined Day Assignment.
 *
 * The user manually divides an explicit, already-ordered route (Phase 3C-A) into ordinal day
 * buckets — "Día 1", "Día 2", … — each with its own explicit place order. This module only
 * *describes* a day assignment the user already made; it never chooses a day for a place,
 * decides how many days are needed, balances or optimises days, or produces a recommended
 * split. There is no day count this module would ever suggest.
 *
 * Each day's logistics are built through `orderedSequenceFromLookup` (Phase 3C-A) over that
 * day's own place ids only — this module never reimplements directed lookup, reversal, or
 * chaining semantics, and never sums or searches across more than one day's places.
 *
 * **The day boundary is load-bearing.** Passing each day's ids to `orderedSequenceFromLookup`
 * separately means a cross-day pair (the last place of day N and the first place of day N+1)
 * is never assembled into a consecutive pair in the first place — there is no code path that
 * could look it up, let alone chain, reverse, or fabricate a value for it. No overnight
 * transfer, no return-to-hotel leg, and no commute between days is ever assumed or queried.
 */

export type DayBucket = {
  /** This day's places, in the user's explicit order — never reordered, deduped, or otherwise
   * second-guessed by this module. May be empty. */
  placeIds: readonly string[];
  /** This day's own ordered sequence, built only from `placeIds` — see the module doc for why
   * that is exactly what makes a day boundary break transfer aggregation. */
  sequence: OrderedSequence;
};

/**
 * Every structural problem this module can detect, independent of the UI that produced the
 * assignment:
 *   - `"no-days"` — zero day buckets. A UI-created plan needs at least one, even if empty.
 *   - `"missing-route-ids"` — some id from `routeIds` does not appear in any day.
 *   - `"extra-ids"` — some id appears in a day that is not part of `routeIds`.
 *   - `"duplicate-in-day"` — the same id appears more than once within one day's own list.
 *   - `"duplicate-across-days"` — the same id appears in more than one distinct day.
 * All applicable issues are reported, not just the first found — a caller checks membership,
 * never position.
 */
export type DayAssignmentIssue =
  | "no-days"
  | "missing-route-ids"
  | "extra-ids"
  | "duplicate-in-day"
  | "duplicate-across-days";

export type DayAssignment = {
  days: DayBucket[];
  /** `true` exactly when `issues` is empty: every route id appears in exactly one day, in
   * exactly one position, with no extras. */
  valid: boolean;
  issues: DayAssignmentIssue[];
};

/**
 * The structural partition check, with **no transfer lookup at all** — pure set/array
 * bookkeeping over ids. This is the single source of truth for "does `days` exactly partition
 * `routeIds`", reused by `dayAssignmentFromLookup` below (transfer-lookup context) and by
 * `app/src/lib/planning-draft.ts` (persistence-reconciliation context, Phase 3C-D), so the two
 * can never silently diverge on what "valid" means.
 */
export function validateDayPartition(
  routeIds: readonly string[],
  days: readonly (readonly string[])[]
): { valid: boolean; issues: DayAssignmentIssue[] } {
  const issues: DayAssignmentIssue[] = [];
  if (days.length === 0) issues.push("no-days");

  let duplicateInDay = false;
  const daySets: Set<string>[] = [];
  for (const placeIds of days) {
    const daySet = new Set(placeIds);
    if (daySet.size !== placeIds.length) duplicateInDay = true;
    daySets.push(daySet);
  }
  if (duplicateInDay) issues.push("duplicate-in-day");

  const dayMembershipCount = new Map<string, number>();
  for (const daySet of daySets) {
    for (const id of daySet) {
      dayMembershipCount.set(id, (dayMembershipCount.get(id) ?? 0) + 1);
    }
  }
  if ([...dayMembershipCount.values()].some((count) => count > 1)) {
    issues.push("duplicate-across-days");
  }

  const routeSet = new Set(routeIds);
  const assignedSet = new Set(days.flat());
  if (routeIds.some((id) => !assignedSet.has(id))) issues.push("missing-route-ids");
  if ([...assignedSet].some((id) => !routeSet.has(id))) issues.push("extra-ids");

  return { valid: issues.length === 0, issues };
}

/**
 * Pure core of `buildDayAssignment`, with the directed lookup injected so tests can prove the
 * day-boundary guarantee (a cross-day pair is never queried) against fixture data — the same
 * seam `orderedSequenceFromLookup`/`sequenceComparisonFromLookup` already use.
 *
 * `routeIds` is the route the days are supposed to partition; `days` is the caller's partition
 * exactly as given — this function never reorders a day's ids, never moves an id to fix an
 * invalid partition, and never invents or drops a day. Each day's `OrderedSequence` is always
 * built, even when the overall assignment is invalid, so a caller can still render what exists;
 * `valid`/`issues` (from `validateDayPartition`) is what says whether that description may be
 * trusted as a true partition of `routeIds`.
 */
export function dayAssignmentFromLookup(
  routeIds: readonly string[],
  days: readonly (readonly string[])[],
  lookup: (fromId: string, toId: string) => TransferEdge | null
): DayAssignment {
  const dayBuckets: DayBucket[] = days.map((placeIds) => ({
    placeIds,
    sequence: orderedSequenceFromLookup(placeIds, lookup),
  }));
  const { valid, issues } = validateDayPartition(routeIds, days);
  return { days: dayBuckets, valid, issues };
}

/**
 * The preferred way to describe a day assignment: reads `getBestTransfer` for every consecutive
 * pair inside each day, exactly as `buildOrderedSequence` does — never across a day boundary.
 * Never runs routing at call time, never assigns a place to a day, never decides a day count.
 */
export function buildDayAssignment(
  routeIds: readonly string[],
  days: readonly (readonly string[])[]
): DayAssignment {
  return dayAssignmentFromLookup(routeIds, days, getBestTransfer);
}
