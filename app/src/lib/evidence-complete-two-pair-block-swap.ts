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
 * Phase 3E-K — Evidence-Complete Two-Pair Block Swap Runtime.
 *
 * The fifth and smallest still-unowned local move:
 *
 * > inside one maximal contiguous same-hub block of one existing day, take exactly four
 * > consecutive **interior** places `[A, B, C, D]`, exchange the two adjacent two-place blocks
 * > while preserving the internal order of each pair (`[A,B] [C,D] → [C,D] [A,B]`), leave every
 * > place outside that window at exactly the same index, and surface the alternative only when the
 * > block's complete recorded directed transfer range for the swapped order sits strictly below the
 * > block's range for the current order.
 *
 * `docs/EVIDENCE_COMPLETE_TWO_PAIR_BLOCK_SWAP_DESIGN.md` is the normative contract; this module
 * implements it rather than re-deciding it.
 *
 * **Why exactly 2+2 inside exactly four places.** All four positions change, so the move is not one
 * Phase 3E-C adjacent swap, not one Phase 3E-E single-place relocation and not one Phase 3E-G
 * two-place transposition. Yet each pair keeps its internal order, so it is also not the Phase 3E-I
 * reversal `A B C D → D C B A`. It is the narrowest genuinely new arrangement of one four-place
 * window, and this module generates that arrangement and no other (§7, §10).
 *
 * Ownership boundaries mirror Phase 3E-C/3E-E/3E-G/3E-I exactly. This module owns legal window
 * enumeration, the pure exact 2+2 transformation, the exact affected temporal window, generation,
 * stale assessment and the explicit Apply wrapper. It owns none of: persistence, React state,
 * transfer parsing, general route optimisation, accommodation logic, inter-hub logic, trip-bounds
 * logic, scheduling or reservation logic.
 *
 * What it never does, by construction:
 *   - relocate a two-place block to an arbitrary destination, swap non-adjacent blocks, swap blocks
 *     of unequal size, swap blocks longer than two, rotate a generic slice, or combine the swap
 *     with another move — this is not generic block relocation and not 2-opt (§11, §34);
 *   - derive a candidate from another candidate, recurse, or search permutations — every candidate
 *     comes independently from the current baseline (§9);
 *   - chain automatically into the Phase 3E-E relocation that the applied order may newly admit:
 *     that second move is regenerated from the new baseline and needs its own explicit Apply (§5);
 *   - rank, score, recommend or pick a winner — confidence stays disclosure (§19);
 *   - repair a missing directed edge from a reverse edge, a chained path, geometry, haversine,
 *     network routing, a sibling relation, synthetic symmetry or a synthetic estimate. Exchanging
 *     the two pairs creates the new directions `L→C` and `D→A` and moves `B` in front of `R`, so
 *     every candidate direction must actually be recorded in its own right (§17).
 */

/**
 * Why no pair-block swap can be generated *at all* — a structural fact about the plan, never a
 * judgement about its quality. Trip bounds are deliberately absent: a day assessed outside the trip
 * window is still a user-authored day and may still hold a provable local alternative (§12).
 */
export type TwoPairBlockSwapGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";

export type TwoPairBlockSwapDay = {
  id: string;
  placeIds: readonly string[];
};

export type EvidenceCompleteTwoPairBlockSwapInput = {
  routeIds: readonly string[];
  days: readonly TwoPairBlockSwapDay[] | null;
  /** Phase 3D-L's persisted manual start times, read only — never written, moved or inferred. */
  visitStartTimes: Readonly<Record<string, string>>;
};

export type EvidenceCompleteTwoPairBlockSwapDependencies = {
  resolvePlace: (placeId: string) => Place | null;
  /** Exact directed lookup only. The production default reads already-recorded evidence. */
  lookupTransfer?: (fromPlaceId: string, toPlaceId: string) => TransferEdge | null;
};

/** Exactly four consecutive places always take part, so a window is fully described by its start. */
export type TwoPairBlockSwapWindow = {
  windowStartIndex: number;
};

/** The number of places one candidate rearranges. Four is the contract, not a tunable (§7). */
export const TWO_PAIR_BLOCK_SWAP_WINDOW_LENGTH = 4;

/** The size of each exchanged block. Two is the contract: 1+3, 3+1 and 2+3 are all refused (§11). */
export const TWO_PAIR_BLOCK_SWAP_PAIR_LENGTH = 2;

/**
 * One proved pair-block swap. Derived and ephemeral: never persisted, never given a stored id,
 * never compared against a sibling candidate.
 */
export type EvidenceCompleteTwoPairBlockSwapAlternative = {
  dayId: string;
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;
  blockStartDayIndex: number;
  blockEndDayIndex: number;

  windowStartDayIndex: number;

  /** `[A, B]` in the current order — the pair that moves *after* the second pair. */
  firstPairPlaceIds: readonly [string, string];
  /** `[C, D]` in the current order — the pair that moves *before* the first pair. */
  secondPairPlaceIds: readonly [string, string];
  /** The window as it reads after the exchange: exactly `[C, D, A, B]`. */
  swappedWindowPlaceIds: readonly [string, string, string, string];
  /** Exactly six: the predecessor, the four moved places, and the successor (§14). */
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

export type EvidenceCompleteTwoPairBlockSwapGeneration =
  | { kind: "unavailable"; reason: TwoPairBlockSwapGenerationUnavailableReason }
  | {
      kind: "available";
      /** Deterministic day → block → windowStartIndex order. Never sorted by advantage. */
      alternatives: EvidenceCompleteTwoPairBlockSwapAlternative[];
    };

/**
 * Every legal four-place interior window of one block, by ascending start index.
 *
 * All four positions must be interior, so `1 <= windowStartIndex <= blockLength - 5` and the
 * block's endpoints can never move. A block therefore needs at least six places to yield one
 * window, and a block of length `n` has exactly `n - 5` of them — linear, never cubic and never
 * factorial. Exactly one transformation exists per window, so the candidate count is `n - 5` too.
 *
 * That figure is the **candidate count** only. It is deliberately not a claim about total
 * evaluation runtime: each candidate rebuilds and compares a length-`n` sequence, so a
 * straightforward evaluation can require `O(n²)` directed lookups (§9). There is no recursion, no
 * permutation search, no arbitrary block-destination search and no candidate-from-candidate
 * expansion.
 */
export function legalTwoPairBlockSwapWindows(blockLength: number): TwoPairBlockSwapWindow[] {
  const windows: TwoPairBlockSwapWindow[] = [];
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
 * Exchanges exactly the two adjacent two-place blocks beginning at `windowStartIndex`, leaving
 * every other index untouched, and returns a fresh array.
 *
 * Implemented as four direct index assignments from a captured `[A, B, C, D]` rather than a splice
 * or a sequence of single-place moves: no place is removed and re-inserted, so nothing outside the
 * window can shift, and one call produces the final order rather than four intermediate ones. An
 * out-of-range or non-integer start is neutralised by returning an unchanged copy, which keeps the
 * helper total.
 *
 * `A` stays before `B` and `C` stays before `D`: only the two blocks exchange positions.
 */
export function swapAdjacentTwoPlaceBlocks<T>(
  values: readonly T[],
  windowStartIndex: number
): T[] {
  const next = [...values];
  if (
    !Number.isInteger(windowStartIndex) ||
    windowStartIndex < 0 ||
    windowStartIndex + TWO_PAIR_BLOCK_SWAP_WINDOW_LENGTH > values.length
  ) {
    return next;
  }
  const first = values[windowStartIndex];
  const second = values[windowStartIndex + 1];
  const third = values[windowStartIndex + 2];
  const fourth = values[windowStartIndex + 3];
  next[windowStartIndex] = third;
  next[windowStartIndex + 1] = fourth;
  next[windowStartIndex + 2] = first;
  next[windowStartIndex + 3] = second;
  return next;
}

/**
 * The exact positions whose immediate transfer context changes: `s - 1` through `s + 4`, always six.
 *
 * `A→B` and `C→D` survive the exchange, but the block's incoming edge becomes `L→C`, the two pairs
 * are bridged by the new `D→A`, and `B` now precedes the successor — so all four moved places plus
 * the predecessor and successor participate in a changed context. Nothing beyond the successor
 * changes, so nothing beyond it is locked (§14).
 */
export function affectedTwoPairBlockSwapPositions(windowStartIndex: number): number[] {
  const positions: number[] = [];
  for (
    let position = windowStartIndex - 1;
    position <= windowStartIndex + TWO_PAIR_BLOCK_SWAP_WINDOW_LENGTH;
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

function pairAt(
  placeIds: readonly string[],
  startIndex: number
): readonly [string, string] {
  return [placeIds[startIndex], placeIds[startIndex + 1]];
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
 * Generates every proved two-pair block swap directly from the current baseline.
 *
 * Structural availability first, then per day, per maximal same-hub block (semantics imported
 * verbatim from Phase 3E-C, never re-derived):
 *   1. the block needs at least six places, or it holds no four-place interior window (§8);
 *   2. the whole baseline block must be complete with a non-null range — an incomplete baseline is
 *      not a usable loser, because unknown is neither zero nor infinity (§16);
 *   3. no place in the exact six-place affected window may carry a manual visit start time (§15);
 *   4. the candidate goes through the existing `sequenceComparisonFromLookup` unchanged, and only
 *      `"b-clearly-faster"` is emitted (§18).
 *
 * Trip bounds never reach this function and never block a candidate (§12).
 */
export function generateEvidenceCompleteTwoPairBlockSwaps(
  input: EvidenceCompleteTwoPairBlockSwapInput,
  dependencies: EvidenceCompleteTwoPairBlockSwapDependencies
): EvidenceCompleteTwoPairBlockSwapGeneration {
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
  const alternatives: EvidenceCompleteTwoPairBlockSwapAlternative[] = [];
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

      for (const { windowStartIndex } of legalTwoPairBlockSwapWindows(block.placeIds.length)) {
        const affectedPlaceIds = affectedTwoPairBlockSwapPositions(windowStartIndex).map(
          (position) => block.placeIds[position]
        );
        if (
          affectedPlaceIds.some((placeId) =>
            hasManualVisitStartTime(input.visitStartTimes, placeId)
          )
        ) {
          continue;
        }

        const candidateBlockPlaceIds = swapAdjacentTwoPlaceBlocks(
          block.placeIds,
          windowStartIndex
        );
        const candidateDayPlaceIds = swapAdjacentTwoPlaceBlocks(
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
          firstPairPlaceIds: pairAt(block.placeIds, windowStartIndex),
          secondPairPlaceIds: pairAt(
            block.placeIds,
            windowStartIndex + TWO_PAIR_BLOCK_SWAP_PAIR_LENGTH
          ),
          swappedWindowPlaceIds: windowQuad(candidateBlockPlaceIds, windowStartIndex),
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

/** Why a previously-generated pair-block swap may no longer be applied (§24). */
export type TwoPairBlockSwapStaleReason =
  | "no-day-assignment"
  | "day-missing"
  | "day-changed"
  | "first-pair-changed"
  | "second-pair-changed"
  | "illegal-window"
  | "block-changed"
  | "hub-changed"
  | "manual-visit-time-added";

export type TwoPairBlockSwapApplicability =
  | { kind: "applicable"; dayId: string; windowStartDayIndex: number }
  | { kind: "stale"; reason: TwoPairBlockSwapStaleReason };

/**
 * Re-verifies a candidate against the world as it is *now*, immediately before mutating.
 *
 * A candidate is a snapshot of a plan that may since have changed, so identity is re-established
 * from scratch rather than trusted: never apply from the start index alone.
 */
export function assessTwoPairBlockSwapApplicability(
  alternative: EvidenceCompleteTwoPairBlockSwapAlternative,
  input: EvidenceCompleteTwoPairBlockSwapInput,
  dependencies: Pick<EvidenceCompleteTwoPairBlockSwapDependencies, "resolvePlace">
): TwoPairBlockSwapApplicability {
  if (input.days === null) return { kind: "stale", reason: "no-day-assignment" };
  const day = input.days.find((candidate) => candidate.id === alternative.dayId);
  if (!day) return { kind: "stale", reason: "day-missing" };
  if (!sameIds(day.placeIds, alternative.baselineDayPlaceIds)) {
    return { kind: "stale", reason: "day-changed" };
  }

  const { windowStartDayIndex, blockStartDayIndex, blockEndDayIndex } = alternative;
  const windowEndDayIndex = windowStartDayIndex + TWO_PAIR_BLOCK_SWAP_WINDOW_LENGTH - 1;
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
  if (!sameIds(pairAt(day.placeIds, windowStartDayIndex), alternative.firstPairPlaceIds)) {
    return { kind: "stale", reason: "first-pair-changed" };
  }
  if (
    !sameIds(
      pairAt(day.placeIds, windowStartDayIndex + TWO_PAIR_BLOCK_SWAP_PAIR_LENGTH),
      alternative.secondPairPlaceIds
    )
  ) {
    return { kind: "stale", reason: "second-pair-changed" };
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
      swapAdjacentTwoPlaceBlocks(day.placeIds, windowStartDayIndex),
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

  const affectedPlaceIds = affectedTwoPairBlockSwapPositions(windowStartDayIndex).map(
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

export type TwoPairBlockSwapApplyResult<Draft> =
  | { kind: "applied"; draft: Draft }
  | { kind: "stale"; reason: TwoPairBlockSwapStaleReason };

/**
 * Applies one pair-block swap, and only after the stale guard agrees.
 *
 * The mutation itself is delegated to the caller's single pure V7 helper, so one explicit user
 * action produces exactly one final draft — never two persisted relocations, never four sequential
 * one-place moves, and never an intermediate persisted order. Nothing the applied order may newly
 * admit is applied here: a second improvement is regenerated from the new baseline and needs its
 * own explicit user action (§5, §23).
 */
export function applyEvidenceCompleteTwoPairBlockSwap<Draft>(
  alternative: EvidenceCompleteTwoPairBlockSwapAlternative,
  input: EvidenceCompleteTwoPairBlockSwapInput,
  dependencies: Pick<EvidenceCompleteTwoPairBlockSwapDependencies, "resolvePlace">,
  swapTwoPairBlocksWithinDay: (dayId: string, windowStartIndex: number) => Draft
): TwoPairBlockSwapApplyResult<Draft> {
  const applicability = assessTwoPairBlockSwapApplicability(alternative, input, dependencies);
  if (applicability.kind === "stale") return applicability;
  return {
    kind: "applied",
    draft: swapTwoPairBlocksWithinDay(applicability.dayId, applicability.windowStartDayIndex),
  };
}
