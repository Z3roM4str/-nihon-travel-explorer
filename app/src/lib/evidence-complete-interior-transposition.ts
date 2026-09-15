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
 * Phase 3E-G — Evidence-Complete Interior Transposition Runtime.
 *
 * The third and smallest still-unowned local move:
 *
 * > inside one maximal contiguous same-hub block of one existing day, exchange exactly two
 * > **non-adjacent interior** places, leave every other place at exactly the same index, and
 * > surface that alternative only when the block's complete recorded directed transfer range for
 * > the transposed order sits strictly below the block's complete recorded range for the current
 * > order.
 *
 * `docs/EVIDENCE_COMPLETE_INTERIOR_TRANSPOSITION_DESIGN.md` is the normative contract; this
 * module implements it rather than re-deciding it.
 *
 * Ownership boundaries mirror Phase 3E-C/3E-E exactly. This module owns legal enumeration, the
 * pure direct transposition, the exact affected temporal set, generation, stale assessment and
 * the explicit Apply wrapper. It owns none of: persistence, UI state, transfer parsing, route
 * optimisation, accommodation logic, inter-hub logic, trip-bounds logic or schedule solving.
 *
 * What it never does, by construction:
 *   - swap more than one pair per candidate, reverse a slice, rotate a slice, or enumerate
 *     permutations — every candidate exchanges exactly two identified places and is derived
 *     independently from the current baseline, never from another candidate (§9);
 *   - emit an adjacent pair — `rightIndex - leftIndex >= 2` always, because adjacent interior
 *     swaps remain Phase 3E-C's territory (§6);
 *   - implement the move as two relocations, repeated adjacent swaps, several setState calls or
 *     several persisted intermediate orders — one pure mutation produces the final order (§8);
 *   - rank, score, recommend or pick a winner — confidence stays disclosure (§18, §20);
 *   - repair a missing directed edge from a reverse edge, a chained path, geometry, haversine,
 *     network routing, a sibling relation or a synthetic estimate (§16).
 */

/**
 * Why no transposition can be generated *at all* — a structural fact about the plan, never a
 * judgement about its quality. Trip bounds are deliberately absent: a day assessed outside the
 * trip window is still a user-authored day and may still hold a provable local alternative (§11).
 */
export type InteriorTranspositionGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";

export type InteriorTranspositionDay = {
  id: string;
  placeIds: readonly string[];
};

export type EvidenceCompleteInteriorTranspositionInput = {
  routeIds: readonly string[];
  days: readonly InteriorTranspositionDay[] | null;
  /** Phase 3D-L's persisted manual start times, read only — never written, moved or inferred. */
  visitStartTimes: Readonly<Record<string, string>>;
};

export type EvidenceCompleteInteriorTranspositionDependencies = {
  resolvePlace: (placeId: string) => Place | null;
  /** Exact directed lookup only. The production default reads already-recorded evidence. */
  lookupTransfer?: (fromPlaceId: string, toPlaceId: string) => TransferEdge | null;
};

/** One legal non-adjacent interior pair, as indices into one block. */
export type InteriorTranspositionDescriptor = {
  leftIndex: number;
  rightIndex: number;
};

/**
 * One proved transposition. Derived and ephemeral: never persisted, never given a stored id,
 * never compared against a sibling candidate.
 */
export type EvidenceCompleteInteriorTranspositionAlternative = {
  dayId: string;
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;
  blockStartDayIndex: number;
  blockEndDayIndex: number;

  leftPlaceId: string;
  rightPlaceId: string;
  leftDayIndex: number;
  rightDayIndex: number;

  /** Exactly the union of both local windows — never the whole span between the pair (§13). */
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

export type EvidenceCompleteInteriorTranspositionGeneration =
  | { kind: "unavailable"; reason: InteriorTranspositionGenerationUnavailableReason }
  | {
      kind: "available";
      /** Deterministic day → block → leftIndex → rightIndex order. Never sorted by advantage. */
      alternatives: EvidenceCompleteInteriorTranspositionAlternative[];
    };

/**
 * Every legal non-adjacent interior pair of one block, in `leftIndex` then `rightIndex` ascending
 * order.
 *
 * Both indices are interior, so `1 <= leftIndex < rightIndex <= blockLength - 2` and the block's
 * endpoints can never move. Adjacent pairs are skipped because they are exactly Phase 3E-C's
 * capability, which leaves `(n - 3)(n - 4) / 2` descriptors for a block of length `n` — a block
 * therefore needs at least five places to yield one.
 *
 * That figure is the **candidate count** only. It is deliberately not a claim about total
 * evaluation runtime: each candidate rebuilds and compares a length-`n` sequence, so a
 * straightforward evaluation can require `O(n³)` directed lookups in the worst case (§10). There
 * is no recursion, no permutation search and no candidate-from-candidate expansion.
 */
export function legalInteriorTranspositions(
  blockLength: number
): InteriorTranspositionDescriptor[] {
  const descriptors: InteriorTranspositionDescriptor[] = [];
  for (let leftIndex = 1; leftIndex <= blockLength - 2; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 2;
      rightIndex <= blockLength - 2;
      rightIndex += 1
    ) {
      descriptors.push({ leftIndex, rightIndex });
    }
  }
  return descriptors;
}

/**
 * Exchanges exactly the two identified positions and leaves every other index untouched.
 *
 * This is one direct transposition, not a remove-and-insert and not two sequential moves: no
 * intervening place shifts, which is precisely what separates it from a Phase 3E-E relocation.
 */
export function transposeTwoPlaces<T>(
  values: readonly T[],
  leftIndex: number,
  rightIndex: number
): T[] {
  if (
    !Number.isInteger(leftIndex) ||
    !Number.isInteger(rightIndex) ||
    leftIndex < 0 ||
    rightIndex < 0 ||
    leftIndex >= values.length ||
    rightIndex >= values.length ||
    leftIndex === rightIndex
  ) {
    return [...values];
  }
  const next = [...values];
  [next[leftIndex], next[rightIndex]] = [next[rightIndex], next[leftIndex]];
  return next;
}

/**
 * The exact positions whose immediate transfer context changes: the unique union of
 * `{i - 1, i, i + 1}` and `{j - 1, j, j + 1}`, ascending.
 *
 * Deliberately *not* the whole span between the pair — an untouched interior place that keeps both
 * of its neighbours keeps its context and must not be locked. When `j === i + 2` the two windows
 * overlap and deduplicate naturally into five positions rather than six.
 */
export function affectedTranspositionPositions(
  leftIndex: number,
  rightIndex: number
): number[] {
  const positions = new Set<number>([
    leftIndex - 1,
    leftIndex,
    leftIndex + 1,
    rightIndex - 1,
    rightIndex,
    rightIndex + 1,
  ]);
  return [...positions].sort((a, b) => a - b);
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

/**
 * Generates every proved non-adjacent interior transposition directly from the current baseline.
 *
 * Structural availability first, then per day, per maximal same-hub block (semantics imported
 * verbatim from Phase 3E-C, never re-derived):
 *   1. the block needs at least five places, or it holds no non-adjacent interior pair (§7);
 *   2. the whole baseline block must be complete with a non-null range — an incomplete baseline is
 *      not a usable loser, because unknown is neither zero nor infinity (§15);
 *   3. no place in the exact affected set may carry a manual visit start time (§14);
 *   4. the candidate goes through the existing `sequenceComparisonFromLookup` unchanged, and only
 *      `"b-clearly-faster"` is emitted (§17).
 *
 * Trip bounds never reach this function and never block a candidate (§11).
 */
export function generateEvidenceCompleteInteriorTranspositions(
  input: EvidenceCompleteInteriorTranspositionInput,
  dependencies: EvidenceCompleteInteriorTranspositionDependencies
): EvidenceCompleteInteriorTranspositionGeneration {
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
  const alternatives: EvidenceCompleteInteriorTranspositionAlternative[] = [];
  const emittedOrders = new Set<string>();

  input.days.forEach((day, dayOrdinal) => {
    const blocks = deriveSameHubBlocks(dayOrdinal, day.placeIds, resolvePlace);
    // Unreachable while the partition is valid and every route id resolved above; refusing here
    // rather than asserting keeps the function total.
    if (blocks === null) return;

    for (const block of blocks) {
      if (block.placeIds.length < 5) continue;

      const baseline = orderedSequenceFromLookup(block.placeIds, lookupTransfer);
      if (!baseline.summary.complete || baseline.summary.transferMinutes === null) continue;

      for (const { leftIndex, rightIndex } of legalInteriorTranspositions(block.placeIds.length)) {
        const affectedPlaceIds = affectedTranspositionPositions(leftIndex, rightIndex).map(
          (position) => block.placeIds[position]
        );
        if (
          affectedPlaceIds.some((placeId) =>
            hasManualVisitStartTime(input.visitStartTimes, placeId)
          )
        ) {
          continue;
        }

        const candidateBlockPlaceIds = transposeTwoPlaces(block.placeIds, leftIndex, rightIndex);
        const candidateDayPlaceIds = transposeTwoPlaces(
          day.placeIds,
          block.startIndex + leftIndex,
          block.startIndex + rightIndex
        );
        // Unique route-place membership already makes one index pair one order; the guard is
        // defensive against a future schema change, and keeps the first enumerated occurrence.
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
          leftPlaceId: block.placeIds[leftIndex],
          rightPlaceId: block.placeIds[rightIndex],
          leftDayIndex: block.startIndex + leftIndex,
          rightDayIndex: block.startIndex + rightIndex,
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

  // Emission order is already day → block → leftIndex → rightIndex, because that is the order the
  // loops visit. Nothing is re-sorted: sorting by advantage would be the ranking §20 forbids.
  return { kind: "available", alternatives };
}

/** Why a previously-generated transposition may no longer be applied (§25). */
export type InteriorTranspositionStaleReason =
  | "no-day-assignment"
  | "day-missing"
  | "day-changed"
  | "left-place-changed"
  | "right-place-changed"
  | "illegal-pair"
  | "block-changed"
  | "hub-changed"
  | "manual-visit-time-added";

export type InteriorTranspositionApplicability =
  | { kind: "applicable"; dayId: string; leftDayIndex: number; rightDayIndex: number }
  | { kind: "stale"; reason: InteriorTranspositionStaleReason };

/**
 * Re-verifies a candidate against the world as it is *now*, immediately before mutating.
 *
 * A candidate is a snapshot of a plan that may since have changed, so identity is re-established
 * from scratch rather than trusted: never apply from stale numeric indices alone.
 */
export function assessInteriorTranspositionApplicability(
  alternative: EvidenceCompleteInteriorTranspositionAlternative,
  input: EvidenceCompleteInteriorTranspositionInput,
  dependencies: Pick<EvidenceCompleteInteriorTranspositionDependencies, "resolvePlace">
): InteriorTranspositionApplicability {
  if (input.days === null) return { kind: "stale", reason: "no-day-assignment" };
  const day = input.days.find((candidate) => candidate.id === alternative.dayId);
  if (!day) return { kind: "stale", reason: "day-missing" };
  if (!sameIds(day.placeIds, alternative.baselineDayPlaceIds)) {
    return { kind: "stale", reason: "day-changed" };
  }

  const { leftDayIndex, rightDayIndex, blockStartDayIndex, blockEndDayIndex } = alternative;
  // Both indices must still be strictly interior to the block, still ordered, and still at least
  // two apart — an adjacent pair belongs to Phase 3E-C and is never applied from here.
  if (
    !Number.isInteger(leftDayIndex) ||
    !Number.isInteger(rightDayIndex) ||
    !Number.isInteger(blockStartDayIndex) ||
    !Number.isInteger(blockEndDayIndex) ||
    blockEndDayIndex - blockStartDayIndex + 1 < 5 ||
    leftDayIndex <= blockStartDayIndex ||
    leftDayIndex >= blockEndDayIndex ||
    rightDayIndex <= blockStartDayIndex ||
    rightDayIndex >= blockEndDayIndex ||
    rightDayIndex - leftDayIndex < 2
  ) {
    return { kind: "stale", reason: "illegal-pair" };
  }
  if (day.placeIds[leftDayIndex] !== alternative.leftPlaceId) {
    return { kind: "stale", reason: "left-place-changed" };
  }
  if (day.placeIds[rightDayIndex] !== alternative.rightPlaceId) {
    return { kind: "stale", reason: "right-place-changed" };
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
      transposeTwoPlaces(day.placeIds, leftDayIndex, rightDayIndex),
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

  const affectedPlaceIds = affectedTranspositionPositions(leftDayIndex, rightDayIndex).map(
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

  return { kind: "applicable", dayId: alternative.dayId, leftDayIndex, rightDayIndex };
}

export type InteriorTranspositionApplyResult<Draft> =
  | { kind: "applied"; draft: Draft }
  | { kind: "stale"; reason: InteriorTranspositionStaleReason };

/**
 * Applies one transposition, and only after the stale guard agrees.
 *
 * The mutation itself is delegated to the caller's single pure V7 helper, so one explicit user
 * action produces exactly one final draft — never two persisted intermediate orders.
 */
export function applyEvidenceCompleteInteriorTransposition<Draft>(
  alternative: EvidenceCompleteInteriorTranspositionAlternative,
  input: EvidenceCompleteInteriorTranspositionInput,
  dependencies: Pick<EvidenceCompleteInteriorTranspositionDependencies, "resolvePlace">,
  transposeWithinDay: (dayId: string, leftIndex: number, rightIndex: number) => Draft
): InteriorTranspositionApplyResult<Draft> {
  const applicability = assessInteriorTranspositionApplicability(alternative, input, dependencies);
  if (applicability.kind === "stale") return applicability;
  return {
    kind: "applied",
    draft: transposeWithinDay(
      applicability.dayId,
      applicability.leftDayIndex,
      applicability.rightDayIndex
    ),
  };
}
