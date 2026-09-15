import type { Place } from "../types";
import { validateDayPartition } from "./day-assignment";
import type { MinuteRange } from "./duration";
import { deriveSameHubBlocks } from "./evidence-complete-local-swap";
import { orderedSequenceFromLookup } from "./ordered-sequence";
import {
  sequenceComparisonFromLookup,
  type ConfidenceCounts,
} from "./sequence-comparison";
import { getBestTransfer, type TransferEdge } from "./transfer";

/**
 * Phase 3E-I — Evidence-Complete Four-Place Interior Reversal Runtime.
 *
 * The fourth and smallest still-unowned local move:
 *
 * > inside one maximal contiguous same-hub block of one existing day, reverse the order of exactly
 * > **four consecutive interior** places, leave every place outside that window at exactly the same
 * > index, and surface the alternative only when the block's complete recorded directed transfer
 * > range for the reversed order sits strictly below the block's range for the current order.
 *
 * `docs/EVIDENCE_COMPLETE_FOUR_PLACE_INTERIOR_REVERSAL_DESIGN.md` is the normative contract; this
 * module implements it rather than re-deciding it.
 *
 * **Why exactly four.** Reversing two consecutive interior places is already one Phase 3E-C
 * adjacent swap. Reversing three (`A B C → C B A`) is already one Phase 3E-G non-adjacent
 * transposition of the first and third. Four is therefore the first genuinely new reversal length,
 * and this module generates that length and no other (§2).
 *
 * Ownership boundaries mirror Phase 3E-C/3E-E/3E-G exactly. This module owns legal window
 * enumeration, the pure four-place reversal, the exact affected temporal window, generation, stale
 * assessment and the explicit Apply wrapper. It owns none of: persistence, UI state, transfer
 * parsing, general route optimisation, accommodation logic, inter-hub logic, trip-bounds logic,
 * scheduling or reservation logic.
 *
 * What it never does, by construction:
 *   - reverse a window of any length other than four, reverse more than one window per candidate,
 *     or combine a reversal with another move — this is not generic slice reversal and not 2-opt
 *     (§2, §32);
 *   - derive a candidate from another candidate, recurse, or search permutations — every candidate
 *     comes independently from the current baseline;
 *   - rank, score, recommend or pick a winner — confidence stays disclosure (§16, §19);
 *   - repair a missing directed edge from a reverse edge, a chained path, geometry, haversine,
 *     network routing, a sibling relation, synthetic symmetry or a synthetic estimate. Reversing
 *     four places reverses several internal directed edges, so every reversed direction must
 *     actually be recorded in its own right (§14).
 */

/**
 * Why no reversal can be generated *at all* — a structural fact about the plan, never a judgement
 * about its quality. Trip bounds are deliberately absent: a day assessed outside the trip window is
 * still a user-authored day and may still hold a provable local alternative (§9).
 */
export type FourPlaceInteriorReversalGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";

export type FourPlaceInteriorReversalDay = {
  id: string;
  placeIds: readonly string[];
};

export type EvidenceCompleteFourPlaceInteriorReversalInput = {
  routeIds: readonly string[];
  days: readonly FourPlaceInteriorReversalDay[] | null;
  /** Phase 3D-L's persisted manual start times, read only — never written, moved or inferred. */
  visitStartTimes: Readonly<Record<string, string>>;
};

export type EvidenceCompleteFourPlaceInteriorReversalDependencies = {
  resolvePlace: (placeId: string) => Place | null;
  /** Exact directed lookup only. The production default reads already-recorded evidence. */
  lookupTransfer?: (fromPlaceId: string, toPlaceId: string) => TransferEdge | null;
};

/** Exactly four consecutive places always take part, so a window is fully described by its start. */
export type FourPlaceInteriorReversalWindow = {
  windowStartIndex: number;
};

/** The number of places one candidate reverses. Four is the contract, not a tunable (§2). */
export const FOUR_PLACE_REVERSAL_WINDOW_LENGTH = 4;

/**
 * One proved reversal. Derived and ephemeral: never persisted, never given a stored id, never
 * compared against a sibling candidate.
 */
export type EvidenceCompleteFourPlaceInteriorReversalAlternative = {
  dayId: string;
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;
  blockStartDayIndex: number;
  blockEndDayIndex: number;

  windowStartDayIndex: number;
  originalWindowPlaceIds: readonly [string, string, string, string];
  reversedWindowPlaceIds: readonly [string, string, string, string];
  /** Exactly six: the predecessor, the four reversed places, and the successor (§11). */
  affectedPlaceIds: readonly string[];

  baselineDayPlaceIds: readonly string[];
  candidateDayPlaceIds: readonly string[];
  baselineBlockPlaceIds: readonly string[];
  candidateBlockPlaceIds: readonly string[];

  baselineTransferMinutes: MinuteRange;
  candidateTransferMinutes: MinuteRange;
  guaranteedAdvantageMinutes: number;
  possibleAdvantageRange: MinuteRange;

  /**
   * The existing Phase 3C-B tallies for both orders. Complete evidence is not validated evidence,
   * so these exist purely so the UI can say which is which. Never a bonus, penalty or rank.
   */
  baselineConfidenceCounts: ConfidenceCounts;
  candidateConfidenceCounts: ConfidenceCounts;
};

export type EvidenceCompleteFourPlaceInteriorReversalGeneration =
  | { kind: "unavailable"; reason: FourPlaceInteriorReversalGenerationUnavailableReason }
  | {
      kind: "available";
      /** Deterministic day → block → windowStartIndex order. Never sorted by advantage. */
      alternatives: EvidenceCompleteFourPlaceInteriorReversalAlternative[];
    };

/**
 * Every legal four-place interior window of one block, by ascending start index.
 *
 * All four positions must be interior, so `1 <= windowStartIndex <= blockLength - 5` and the
 * block's endpoints can never move. A block therefore needs at least six places to yield one
 * window, and a block of length `n` has exactly `n - 5` of them — linear, never factorial.
 *
 * That figure is the **candidate count** only. It is deliberately not a claim about total
 * evaluation runtime: each candidate rebuilds and compares a length-`n` sequence, so a
 * straightforward evaluation can require `O(n²)` directed lookups (§8). There is no recursion, no
 * permutation search and no candidate-from-candidate expansion.
 */
export function legalFourPlaceInteriorReversalWindows(
  blockLength: number
): FourPlaceInteriorReversalWindow[] {
  const windows: FourPlaceInteriorReversalWindow[] = [];
  for (
    let windowStartIndex = 1;
    windowStartIndex <= blockLength - 5;
    windowStartIndex += 1
  ) {
    windows.push({ windowStartIndex });
  }
  return windows;
}

/**
 * Reverses exactly the four contiguous values beginning at `windowStartIndex`, leaving every other
 * index untouched, and returns a fresh array.
 *
 * Implemented as two direct end-for-end exchanges rather than a splice: no place is removed and
 * re-inserted, so nothing outside the window can shift. An out-of-range or non-integer start is
 * neutralised by returning an unchanged copy, which keeps the helper total.
 */
export function reverseFourPlaces<T>(values: readonly T[], windowStartIndex: number): T[] {
  const next = [...values];
  if (
    !Number.isInteger(windowStartIndex) ||
    windowStartIndex < 0 ||
    windowStartIndex + FOUR_PLACE_REVERSAL_WINDOW_LENGTH > values.length
  ) {
    return next;
  }
  const last = windowStartIndex + FOUR_PLACE_REVERSAL_WINDOW_LENGTH - 1;
  [next[windowStartIndex], next[last]] = [next[last], next[windowStartIndex]];
  [next[windowStartIndex + 1], next[last - 1]] = [next[last - 1], next[windowStartIndex + 1]];
  return next;
}

/**
 * The exact positions whose immediate transfer context changes: `s - 1` through `s + 4`, always six.
 *
 * Reversing the window flips both boundary edges and every internal directed adjacency, so all four
 * reversed places plus the predecessor and successor participate. Nothing beyond the successor
 * changes, so nothing beyond it is locked.
 */
export function affectedFourPlaceReversalPositions(windowStartIndex: number): number[] {
  const positions: number[] = [];
  for (
    let position = windowStartIndex - 1;
    position <= windowStartIndex + FOUR_PLACE_REVERSAL_WINDOW_LENGTH;
    position += 1
  ) {
    positions.push(position);
  }
  return positions;
}

/** A manual start time counts as set only when it is a non-empty string. */
function hasManualVisitStartTime(
  visitStartTimes: Readonly<Record<string, string>>,
  placeId: string
): boolean {
  const time = visitStartTimes[placeId];
  return typeof time === "string" && time.trim() !== "";
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((placeId, index) => placeId === b[index]);
}

function orderKey(placeIds: readonly string[]): string {
  return JSON.stringify(placeIds);
}

function windowQuad(
  placeIds: readonly string[],
  startIndex: number
): readonly [string, string, string, string] {
  return [
    placeIds[startIndex],
    placeIds[startIndex + 1],
    placeIds[startIndex + 2],
    placeIds[startIndex + 3],
  ];
}

/**
 * Generates every proved four-place interior reversal directly from the current baseline.
 *
 * Structural availability first, then per day, per maximal same-hub block (semantics imported
 * verbatim from Phase 3E-C, never re-derived):
 *   1. the block needs at least six places, or it holds no four-place interior window (§7);
 *   2. the whole baseline block must be complete with a non-null range — an incomplete baseline is
 *      not a usable loser, because unknown is neither zero nor infinity (§13);
 *   3. no place in the exact six-place affected window may carry a manual visit start time (§12);
 *   4. the candidate goes through the existing `sequenceComparisonFromLookup` unchanged, and only
 *      `"b-clearly-faster"` is emitted (§15).
 *
 * Trip bounds never reach this function and never block a candidate (§9).
 */
export function generateEvidenceCompleteFourPlaceInteriorReversals(
  input: EvidenceCompleteFourPlaceInteriorReversalInput,
  dependencies: EvidenceCompleteFourPlaceInteriorReversalDependencies
): EvidenceCompleteFourPlaceInteriorReversalGeneration {
  if (input.days === null) return { kind: "unavailable", reason: "no-day-assignment" };

  if (!validateDayPartition(input.routeIds, input.days.map((day) => day.placeIds)).valid) {
    return { kind: "unavailable", reason: "invalid-day-partition" };
  }

  const placesById = new Map<string, Place>();
  for (const placeId of input.routeIds) {
    const place = dependencies.resolvePlace(placeId);
    if (!place) return { kind: "unavailable", reason: "unresolved-route-place" };
    placesById.set(placeId, place);
  }
  const resolvePlace = (placeId: string) => placesById.get(placeId) ?? null;
  const lookupTransfer = dependencies.lookupTransfer ?? getBestTransfer;
  const alternatives: EvidenceCompleteFourPlaceInteriorReversalAlternative[] = [];
  const emittedOrders = new Set<string>();

  input.days.forEach((day, dayOrdinal) => {
    const blocks = deriveSameHubBlocks(dayOrdinal, day.placeIds, resolvePlace);
    // Unreachable while the partition is valid and every route id resolved above; refusing here
    // rather than asserting keeps the function total.
    if (blocks === null) return;

    for (const block of blocks) {
      if (block.placeIds.length < 6) continue;

      const baseline = orderedSequenceFromLookup(block.placeIds, lookupTransfer);
      if (!baseline.summary.complete || baseline.summary.transferMinutes === null) continue;

      for (const { windowStartIndex } of legalFourPlaceInteriorReversalWindows(
        block.placeIds.length
      )) {
        const affectedPlaceIds = affectedFourPlaceReversalPositions(windowStartIndex).map(
          (position) => block.placeIds[position]
        );
        if (
          affectedPlaceIds.some((placeId) =>
            hasManualVisitStartTime(input.visitStartTimes, placeId)
          )
        ) {
          continue;
        }

        const candidateBlockPlaceIds = reverseFourPlaces(block.placeIds, windowStartIndex);
        const candidateDayPlaceIds = reverseFourPlaces(
          day.placeIds,
          block.startIndex + windowStartIndex
        );
        // One window maps to one order under unique route-place membership; the guard is defensive
        // against a future schema change, and keeps the first enumerated occurrence.
        const candidateKey = orderKey(candidateDayPlaceIds);
        if (emittedOrders.has(candidateKey)) continue;

        const comparison = sequenceComparisonFromLookup(
          block.placeIds,
          candidateBlockPlaceIds,
          lookupTransfer
        );
        if (comparison.outcome !== "b-clearly-faster") continue;

        const baselineMinutes = comparison.candidateA.sequence.summary.transferMinutes;
        const candidateMinutes = comparison.candidateB.sequence.summary.transferMinutes;
        // `b-clearly-faster` already implies both are complete and non-null; the guard keeps the
        // emitted shape honest instead of asserting it.
        if (
          baselineMinutes === null ||
          candidateMinutes === null ||
          comparison.guaranteedAdvantageMinutes === null ||
          comparison.possibleAdvantageRange === null
        ) {
          continue;
        }

        emittedOrders.add(candidateKey);
        alternatives.push({
          dayId: day.id,
          dayOrdinal,
          hub: block.hub,
          blockStartPlaceId: block.placeIds[0],
          blockEndPlaceId: block.placeIds[block.placeIds.length - 1],
          blockStartDayIndex: block.startIndex,
          blockEndDayIndex: block.startIndex + block.placeIds.length - 1,
          windowStartDayIndex: block.startIndex + windowStartIndex,
          originalWindowPlaceIds: windowQuad(block.placeIds, windowStartIndex),
          reversedWindowPlaceIds: windowQuad(candidateBlockPlaceIds, windowStartIndex),
          affectedPlaceIds,
          baselineDayPlaceIds: [...day.placeIds],
          candidateDayPlaceIds,
          baselineBlockPlaceIds: [...block.placeIds],
          candidateBlockPlaceIds,
          baselineTransferMinutes: baselineMinutes,
          candidateTransferMinutes: candidateMinutes,
          guaranteedAdvantageMinutes: comparison.guaranteedAdvantageMinutes,
          possibleAdvantageRange: comparison.possibleAdvantageRange,
          baselineConfidenceCounts: comparison.candidateA.confidenceCounts,
          candidateConfidenceCounts: comparison.candidateB.confidenceCounts,
        });
      }
    }
  });

  // Emission order is already day → block → windowStartIndex, because that is the order the loops
  // visit. Nothing is re-sorted: sorting by advantage would be the ranking §19 forbids.
  return { kind: "available", alternatives };
}

/** Why a previously-generated reversal may no longer be applied (§22). */
export type FourPlaceInteriorReversalStaleReason =
  | "no-day-assignment"
  | "day-missing"
  | "day-changed"
  | "window-changed"
  | "illegal-window"
  | "block-changed"
  | "hub-changed"
  | "manual-visit-time-added";

export type FourPlaceInteriorReversalApplicability =
  | { kind: "applicable"; dayId: string; windowStartDayIndex: number }
  | { kind: "stale"; reason: FourPlaceInteriorReversalStaleReason };

/**
 * Re-verifies a candidate against the world as it is *now*, immediately before mutating.
 *
 * A candidate is a snapshot of a plan that may since have changed, so identity is re-established
 * from scratch rather than trusted: never apply from the start index alone.
 */
export function assessFourPlaceInteriorReversalApplicability(
  alternative: EvidenceCompleteFourPlaceInteriorReversalAlternative,
  input: EvidenceCompleteFourPlaceInteriorReversalInput,
  dependencies: Pick<EvidenceCompleteFourPlaceInteriorReversalDependencies, "resolvePlace">
): FourPlaceInteriorReversalApplicability {
  if (input.days === null) return { kind: "stale", reason: "no-day-assignment" };
  const day = input.days.find((candidate) => candidate.id === alternative.dayId);
  if (!day) return { kind: "stale", reason: "day-missing" };
  if (!sameIds(day.placeIds, alternative.baselineDayPlaceIds)) {
    return { kind: "stale", reason: "day-changed" };
  }

  const { windowStartDayIndex, blockStartDayIndex, blockEndDayIndex } = alternative;
  const windowEndDayIndex = windowStartDayIndex + FOUR_PLACE_REVERSAL_WINDOW_LENGTH - 1;
  // All four positions must still be strictly interior to a block of at least six places, so
  // neither block endpoint can be drawn into the window.
  if (
    !Number.isInteger(windowStartDayIndex) ||
    !Number.isInteger(blockStartDayIndex) ||
    !Number.isInteger(blockEndDayIndex) ||
    blockEndDayIndex - blockStartDayIndex + 1 < 6 ||
    windowStartDayIndex <= blockStartDayIndex ||
    windowEndDayIndex >= blockEndDayIndex
  ) {
    return { kind: "stale", reason: "illegal-window" };
  }
  if (!sameIds(windowQuad(day.placeIds, windowStartDayIndex), alternative.originalWindowPlaceIds)) {
    return { kind: "stale", reason: "window-changed" };
  }
  if (
    blockStartDayIndex < 0 ||
    blockEndDayIndex >= day.placeIds.length ||
    day.placeIds[blockStartDayIndex] !== alternative.blockStartPlaceId ||
    day.placeIds[blockEndDayIndex] !== alternative.blockEndPlaceId
  ) {
    return { kind: "stale", reason: "block-changed" };
  }
  if (
    !sameIds(
      day.placeIds.slice(blockStartDayIndex, blockEndDayIndex + 1),
      alternative.baselineBlockPlaceIds
    ) ||
    !sameIds(
      reverseFourPlaces(day.placeIds, windowStartDayIndex),
      alternative.candidateDayPlaceIds
    )
  ) {
    return { kind: "stale", reason: "block-changed" };
  }

  for (let index = blockStartDayIndex; index <= blockEndDayIndex; index += 1) {
    const place = dependencies.resolvePlace(day.placeIds[index]);
    if (!place || place.hub !== alternative.hub) {
      return { kind: "stale", reason: "hub-changed" };
    }
  }

  const affectedPlaceIds = affectedFourPlaceReversalPositions(windowStartDayIndex).map(
    (position) => day.placeIds[position]
  );
  if (!sameIds(affectedPlaceIds, alternative.affectedPlaceIds)) {
    return { kind: "stale", reason: "day-changed" };
  }
  if (
    affectedPlaceIds.some((placeId) => hasManualVisitStartTime(input.visitStartTimes, placeId))
  ) {
    return { kind: "stale", reason: "manual-visit-time-added" };
  }

  return { kind: "applicable", dayId: alternative.dayId, windowStartDayIndex };
}

export type FourPlaceInteriorReversalApplyResult<Draft> =
  | { kind: "applied"; draft: Draft }
  | { kind: "stale"; reason: FourPlaceInteriorReversalStaleReason };

/**
 * Applies one reversal, and only after the stale guard agrees.
 *
 * The mutation itself is delegated to the caller's single pure V7 helper, so one explicit user
 * action produces exactly one final draft — never four sequential moves and never an intermediate
 * persisted order.
 */
export function applyEvidenceCompleteFourPlaceInteriorReversal<Draft>(
  alternative: EvidenceCompleteFourPlaceInteriorReversalAlternative,
  input: EvidenceCompleteFourPlaceInteriorReversalInput,
  dependencies: Pick<EvidenceCompleteFourPlaceInteriorReversalDependencies, "resolvePlace">,
  reverseFourWithinDay: (dayId: string, windowStartIndex: number) => Draft
): FourPlaceInteriorReversalApplyResult<Draft> {
  const applicability = assessFourPlaceInteriorReversalApplicability(
    alternative,
    input,
    dependencies
  );
  if (applicability.kind === "stale") return applicability;
  return {
    kind: "applied",
    draft: reverseFourWithinDay(applicability.dayId, applicability.windowStartDayIndex),
  };
}
