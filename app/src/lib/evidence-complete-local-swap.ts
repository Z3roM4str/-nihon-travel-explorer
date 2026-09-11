import type { Place } from "../types";
import { validateDayPartition } from "./day-assignment";
import type { MinuteRange } from "./duration";
import { orderedSequenceFromLookup } from "./ordered-sequence";
import {
  sequenceComparisonFromLookup,
  type ConfidenceCounts,
} from "./sequence-comparison";
import { getBestTransfer, type TransferEdge } from "./transfer";

/**
 * Phase 3E-C — Evidence-Complete Local Swap Runtime.
 *
 * Nihon's first *generated* alternative, deliberately the smallest one that can be proven:
 *
 * > inside one maximal contiguous same-hub block of one existing day, exchange exactly two
 * > adjacent **interior** places, and surface that alternative only when the block's complete
 * > recorded directed transfer range for the swapped order sits strictly below the block's
 * > complete recorded range for the current order.
 *
 * This is a **local alternative generator**, not a route optimiser. Read
 * `docs/EVIDENCE_COMPLETE_LOCAL_SWAP_DESIGN.md` before changing anything here; that document is
 * the normative contract and this module implements it rather than re-deciding it.
 *
 * What this module never does, by construction:
 *   - sort, rank, score or recommend an itinerary, a day, or one generated candidate over
 *     another — every alternative is compared with the current baseline and nothing else;
 *   - explore permutations, nearest-neighbour, TSP, shortest path, hill climbing, beam search,
 *     or any recursive improvement loop — enumeration is linear in swap positions;
 *   - move a place between days, change the day count, change a day's identity, or touch
 *     `routeIds`, dates, hotels, accommodation legs or inter-hub segments;
 *   - apply anything automatically — {@link applyEvidenceCompleteLocalSwap} is only ever reached
 *     through an explicit user action, and re-verifies the world before it mutates;
 *   - repair, reverse, chain, estimate, or geometrically infer a missing transfer edge. An
 *     unknown leg is neither zero nor infinity: it simply removes the block or the candidate
 *     from the provable set.
 *
 * It owns none of: persistence, transfer parsing, transfer lookup semantics, inter-hub
 * assessment, accommodation logic, trip-bounds arithmetic, or UI state. The place resolver and
 * the exact directed transfer lookup are injected seams, the same pattern
 * `whole-trip-composition.ts` and `ordered-sequence.ts` already use.
 */

/**
 * Why no alternative can be generated *at all* — a structural fact about the plan, never a
 * judgement about its quality.
 *
 * There is deliberately no route-only fallback and no repair: an unresolved place is not
 * silently filtered out, and an invalid partition is not corrected. Trip bounds are **not**
 * here — a day assessed after the trip end is still an existing user-authored day and may still
 * have local alternatives; its existing warning stays a separate, untouched signal.
 */
export type LocalSwapGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";

/** One maximal contiguous same-hub run inside one day. Both endpoints are locked. */
export type SameHubBlock = {
  dayOrdinal: number;
  hub: string;
  /** Index into the day's `placeIds` where this block starts. */
  startIndex: number;
  placeIds: readonly string[];
};

/**
 * One proved alternative. Derived and ephemeral: never persisted, never given a stored id, never
 * compared against a sibling alternative.
 *
 * `baselineTransferMinutes`/`candidateTransferMinutes` are the **block's** complete recorded
 * local-transfer ranges, not the whole day's and not the whole trip's. `guaranteedAdvantageMinutes`
 * and `possibleAdvantageRange` come verbatim from `sequence-comparison.ts` — this module does not
 * redefine that arithmetic. The guaranteed figure is the minimum gap between two *recorded*
 * ranges; presentation must never inflate it into a real-world guarantee (see
 * `docs/EVIDENCE_COMPLETE_LOCAL_SWAP_DESIGN.md` §24).
 */
export type EvidenceCompleteLocalSwapAlternative = {
  dayId: string;
  /** 0-based array position of the day, matching `whole-trip-composition.ts`'s convention. */
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;

  /** The two interior places that would exchange positions: `A` and `B` in `L → A → B → R`. */
  leftPlaceId: string;
  rightPlaceId: string;
  /** Index of `A` inside the day's `placeIds`; `B` is always at `leftDayIndex + 1`. */
  leftDayIndex: number;

  /** The day exactly as it is now — the stale guard compares against this, element by element. */
  baselineDayPlaceIds: readonly string[];
  /** The day as it would be after the swap; differs from the baseline in exactly two positions. */
  candidateDayPlaceIds: readonly string[];

  baselineBlockPlaceIds: readonly string[];
  candidateBlockPlaceIds: readonly string[];

  baselineTransferMinutes: MinuteRange;
  candidateTransferMinutes: MinuteRange;

  guaranteedAdvantageMinutes: number;
  possibleAdvantageRange: MinuteRange;

  /**
   * The existing Phase 3C-B tallies for both orders. `complete` evidence is not `validated-static`
   * evidence: a proved alternative may rest on `estimated` or `schedule-aware` edges, and these
   * counts exist so the UI can say so. No confidence value is ever turned into a bonus, a penalty,
   * or a rank.
   */
  baselineConfidenceCounts: ConfidenceCounts;
  candidateConfidenceCounts: ConfidenceCounts;
};

export type EvidenceCompleteLocalSwapGeneration =
  | { kind: "unavailable"; reason: LocalSwapGenerationUnavailableReason }
  | {
      kind: "available";
      /**
       * Every proved alternative, in deterministic day → block → swap-position order. Never
       * sorted by advantage, never truncated, and never carrying a "best"/"recommended"/"rank"
       * marker — see `docs/EVIDENCE_COMPLETE_LOCAL_SWAP_DESIGN.md` §14.
       */
      alternatives: EvidenceCompleteLocalSwapAlternative[];
    };

/** One existing day entity, projected to only what this module is allowed to see. */
export type LocalSwapDay = {
  id: string;
  placeIds: readonly string[];
};

export type EvidenceCompleteLocalSwapInput = {
  routeIds: readonly string[];
  days: readonly LocalSwapDay[] | null;
  /** Phase 3D-L's persisted manual start times, read only — never written, moved or derived from. */
  visitStartTimes: Readonly<Record<string, string>>;
};

export type EvidenceCompleteLocalSwapDependencies = {
  resolvePlace: (placeId: string) => Place | null;
  /** Defaults to the existing exact directed lookup; injectable fixtures never need the dataset. */
  lookupTransfer?: (fromPlaceId: string, toPlaceId: string) => TransferEdge | null;
};

/** A manual start time counts as set only when it is a non-empty string (§9). */
function hasManualVisitStartTime(
  visitStartTimes: Readonly<Record<string, string>>,
  placeId: string
): boolean {
  const time = visitStartTimes[placeId];
  return typeof time === "string" && time.trim() !== "";
}

/**
 * Splits one day into its maximal contiguous same-hub runs.
 *
 * Two runs are never merged across a hub boundary, and this function is only ever called with a
 * single day's ids, so a day boundary cannot be crossed either — the same structural guarantee
 * `day-assignment.ts` relies on. An empty day yields no block.
 *
 * Returns `null` when any place in the day fails to resolve, so the caller can refuse generation
 * rather than silently dropping a place from a block.
 */
export function deriveSameHubBlocks(
  dayOrdinal: number,
  placeIds: readonly string[],
  resolvePlace: (placeId: string) => Place | null
): SameHubBlock[] | null {
  const blocks: SameHubBlock[] = [];
  let runStart = 0;
  let runHub: string | null = null;

  const flush = (endExclusive: number) => {
    if (runHub === null || endExclusive <= runStart) return;
    blocks.push({
      dayOrdinal,
      hub: runHub,
      startIndex: runStart,
      placeIds: placeIds.slice(runStart, endExclusive),
    });
  };

  for (let index = 0; index < placeIds.length; index += 1) {
    const place = resolvePlace(placeIds[index]);
    if (!place) return null;
    if (runHub === null) {
      runHub = place.hub;
      runStart = index;
      continue;
    }
    if (place.hub === runHub) continue;
    flush(index);
    runHub = place.hub;
    runStart = index;
  }
  flush(placeIds.length);

  return blocks;
}

/**
 * The interior adjacent swap positions of one block, as indices into that block.
 *
 * A returned `index` means "swap `block[index]` with `block[index + 1]`"; both are interior, so
 * `index` ranges over `1 … length - 3` and the block's first and last place can never move. A
 * block therefore needs at least four places to have one legal candidate, and a block of length
 * `n` has at most `n - 3` of them — linear, never factorial (§29).
 */
export function legalInteriorAdjacentSwapIndices(blockLength: number): number[] {
  const indices: number[] = [];
  for (let index = 1; index + 2 <= blockLength - 1; index += 1) indices.push(index);
  return indices;
}

function swapped(ids: readonly string[], index: number): string[] {
  const next = [...ids];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}

/**
 * Generates every provably-better one-step local swap in the current plan.
 *
 * Structural availability first (§8), then per day, per maximal same-hub block:
 *   1. the block must have a **complete** current sequence with a non-null range — an
 *      incomplete baseline is not a usable loser, because unknown is not zero (§10);
 *   2. every legal interior adjacent swap is built through the same exact directed lookup and
 *      must itself be complete, or it is discarded (§11);
 *   3. none of `L`, `A`, `B`, `R` may carry a manual visit start time — all three legs in that
 *      window change, and Nihon has no scheduler that could prove the clock anchor survives (§9);
 *   4. the two orders go through `sequenceComparisonFromLookup` unchanged, and only
 *      `"b-clearly-faster"` (candidate max strictly below baseline min) is emitted (§12).
 *
 * Trip bounds never reach this function and never block a candidate (§23).
 */
export function generateEvidenceCompleteLocalSwaps(
  input: EvidenceCompleteLocalSwapInput,
  dependencies: EvidenceCompleteLocalSwapDependencies
): EvidenceCompleteLocalSwapGeneration {
  if (input.days === null) return { kind: "unavailable", reason: "no-day-assignment" };

  const dayMatrix = input.days.map((day) => day.placeIds);
  if (!validateDayPartition(input.routeIds, dayMatrix).valid) {
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

  const alternatives: EvidenceCompleteLocalSwapAlternative[] = [];

  input.days.forEach((day, dayOrdinal) => {
    const blocks = deriveSameHubBlocks(dayOrdinal, day.placeIds, resolvePlace);
    // Unreachable while the partition is valid and every route id resolved above; refusing here
    // rather than asserting keeps the function total.
    if (blocks === null) return;

    for (const block of blocks) {
      if (block.placeIds.length < 4) continue;

      const baseline = orderedSequenceFromLookup(block.placeIds, lookupTransfer);
      if (!baseline.summary.complete || baseline.summary.transferMinutes === null) continue;

      for (const swapIndex of legalInteriorAdjacentSwapIndices(block.placeIds.length)) {
        const leftPlaceId = block.placeIds[swapIndex];
        const rightPlaceId = block.placeIds[swapIndex + 1];
        const windowIds = [
          block.placeIds[swapIndex - 1],
          leftPlaceId,
          rightPlaceId,
          block.placeIds[swapIndex + 2],
        ];
        if (windowIds.some((placeId) => hasManualVisitStartTime(input.visitStartTimes, placeId))) {
          continue;
        }

        const candidateBlockPlaceIds = swapped(block.placeIds, swapIndex);
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

        alternatives.push({
          dayId: day.id,
          dayOrdinal,
          hub: block.hub,
          blockStartPlaceId: block.placeIds[0],
          blockEndPlaceId: block.placeIds[block.placeIds.length - 1],
          leftPlaceId,
          rightPlaceId,
          leftDayIndex: block.startIndex + swapIndex,
          baselineDayPlaceIds: [...day.placeIds],
          candidateDayPlaceIds: swapped(day.placeIds, block.startIndex + swapIndex),
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

  // Emission order is already day → block → swap position, because that is the order the loops
  // above visit. Nothing is re-sorted here: sorting by advantage would be the ranking §14 forbids.
  return { kind: "available", alternatives };
}

/** Why a previously-generated alternative may no longer be applied (§16). */
export type LocalSwapStaleReason =
  | "no-day-assignment"
  | "day-missing"
  | "day-changed"
  | "pair-not-adjacent"
  | "not-interior"
  | "hub-changed"
  | "manual-visit-time-added";

export type LocalSwapApplicability =
  | { kind: "applicable"; dayId: string; leftDayIndex: number }
  | { kind: "stale"; reason: LocalSwapStaleReason };

/**
 * Re-verifies an alternative against the world as it is *now*, immediately before mutating.
 *
 * An alternative is a snapshot of a plan that may since have changed — another day edit, a new
 * manual start time, a place removed from the route. Applying by stale array index alone would
 * silently swap the wrong two places, so identity is re-established from scratch here: the day
 * must still exist, its `placeIds` must still equal the captured baseline exactly, `A` and `B`
 * must still be adjacent at the expected interior positions, all four places of the affected
 * `L → A → B → R` window must still resolve to the block's hub, and none of them may have
 * acquired a manual visit start time.
 */
export function assessLocalSwapApplicability(
  alternative: EvidenceCompleteLocalSwapAlternative,
  input: EvidenceCompleteLocalSwapInput,
  dependencies: Pick<EvidenceCompleteLocalSwapDependencies, "resolvePlace">
): LocalSwapApplicability {
  if (input.days === null) return { kind: "stale", reason: "no-day-assignment" };

  const day = input.days.find((candidate) => candidate.id === alternative.dayId);
  if (!day) return { kind: "stale", reason: "day-missing" };

  const baseline = alternative.baselineDayPlaceIds;
  if (
    day.placeIds.length !== baseline.length ||
    day.placeIds.some((placeId, index) => placeId !== baseline[index])
  ) {
    return { kind: "stale", reason: "day-changed" };
  }

  const index = alternative.leftDayIndex;
  if (day.placeIds[index] !== alternative.leftPlaceId) {
    return { kind: "stale", reason: "pair-not-adjacent" };
  }
  if (day.placeIds[index + 1] !== alternative.rightPlaceId) {
    return { kind: "stale", reason: "pair-not-adjacent" };
  }

  // `L` and `R` must exist for the swapped pair to be interior to a four-place window at all;
  // day endpoints can therefore never move (§5).
  if (index - 1 < 0 || index + 2 > day.placeIds.length - 1) {
    return { kind: "stale", reason: "not-interior" };
  }

  const windowIds = [
    day.placeIds[index - 1],
    day.placeIds[index],
    day.placeIds[index + 1],
    day.placeIds[index + 2],
  ];
  for (const placeId of windowIds) {
    const place = dependencies.resolvePlace(placeId);
    if (!place || place.hub !== alternative.hub) return { kind: "stale", reason: "hub-changed" };
  }
  if (windowIds.some((placeId) => hasManualVisitStartTime(input.visitStartTimes, placeId))) {
    return { kind: "stale", reason: "manual-visit-time-added" };
  }

  return { kind: "applicable", dayId: alternative.dayId, leftDayIndex: index };
}

export type LocalSwapApplyResult<Draft> =
  | { kind: "applied"; draft: Draft }
  | { kind: "stale"; reason: LocalSwapStaleReason };

/**
 * Applies one alternative, and only after {@link assessLocalSwapApplicability} agrees.
 *
 * The mutation itself is delegated to the caller's existing single-day reorder — in the app that
 * is `withPlaceMovedWithinDay`, which already swaps exactly two adjacent ids while preserving the
 * day's id and accommodation boundary, every other day, `routeIds`, the dates, `visitStartTimes`,
 * the accommodations, the manual accommodation legs and every stored inter-hub segment object.
 * This module deliberately does not reimplement that mutation, so there is no second code path
 * that could drift from the persisted V7 contract.
 */
export function applyEvidenceCompleteLocalSwap<Draft>(
  alternative: EvidenceCompleteLocalSwapAlternative,
  input: EvidenceCompleteLocalSwapInput,
  dependencies: Pick<EvidenceCompleteLocalSwapDependencies, "resolvePlace">,
  swapAdjacentWithinDay: (dayId: string, placeIndex: number, direction: 1) => Draft
): LocalSwapApplyResult<Draft> {
  const applicability = assessLocalSwapApplicability(alternative, input, dependencies);
  if (applicability.kind === "stale") return { kind: "stale", reason: applicability.reason };
  return {
    kind: "applied",
    draft: swapAdjacentWithinDay(applicability.dayId, applicability.leftDayIndex, 1),
  };
}
