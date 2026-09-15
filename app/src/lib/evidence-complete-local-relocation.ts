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

/** Phase 3E-E — one evidence-complete non-adjacent relocation in a fixed same-hub block. */
export type LocalRelocationGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";

export type LocalRelocationDay = {
  id: string;
  placeIds: readonly string[];
};

export type EvidenceCompleteLocalRelocationInput = {
  routeIds: readonly string[];
  days: readonly LocalRelocationDay[] | null;
  visitStartTimes: Readonly<Record<string, string>>;
};

export type EvidenceCompleteLocalRelocationDependencies = {
  resolvePlace: (placeId: string) => Place | null;
  /** Exact directed lookup only. The production default reads already-recorded evidence. */
  lookupTransfer?: (fromPlaceId: string, toPlaceId: string) => TransferEdge | null;
};

export type LocalRelocationDescriptor = {
  /** Both indices use the final block coordinate system. */
  fromIndex: number;
  toIndex: number;
};

export type EvidenceCompleteLocalRelocationAlternative = {
  dayId: string;
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;
  blockStartDayIndex: number;
  blockEndDayIndex: number;

  movedPlaceId: string;
  fromDayIndex: number;
  toDayIndex: number;

  affectedWindowPlaceIds: readonly string[];

  baselineDayPlaceIds: readonly string[];
  candidateDayPlaceIds: readonly string[];
  baselineBlockPlaceIds: readonly string[];
  candidateBlockPlaceIds: readonly string[];

  baselineTransferMinutes: MinuteRange;
  candidateTransferMinutes: MinuteRange;
  guaranteedAdvantageMinutes: number;
  possibleAdvantageRange: MinuteRange;
  baselineConfidenceCounts: ConfidenceCounts;
  candidateConfidenceCounts: ConfidenceCounts;
};

export type EvidenceCompleteLocalRelocationGeneration =
  | { kind: "unavailable"; reason: LocalRelocationGenerationUnavailableReason }
  | { kind: "available"; alternatives: EvidenceCompleteLocalRelocationAlternative[] };

/**
 * Enumerates baseline-derived moves in from/to order. For a block of length n this returns
 * (n - 3)(n - 4) descriptors: quadratic candidate growth, with no repeated application loop.
 */
export function legalInteriorRelocations(blockLength: number): LocalRelocationDescriptor[] {
  const descriptors: LocalRelocationDescriptor[] = [];
  for (let fromIndex = 1; fromIndex < blockLength - 1; fromIndex += 1) {
    for (let toIndex = 1; toIndex < blockLength - 1; toIndex += 1) {
      if (fromIndex === toIndex || Math.abs(fromIndex - toIndex) === 1) continue;
      descriptors.push({ fromIndex, toIndex });
    }
  }
  return descriptors;
}

/** Removes one item, then inserts it at its final-coordinate index. */
export function relocateOnePlace<T>(
  values: readonly T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= values.length ||
    toIndex >= values.length ||
    fromIndex === toIndex
  ) {
    return [...values];
  }
  const next = [...values];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function affectedRelocationWindow(
  fromIndex: number,
  toIndex: number
): { start: number; end: number } {
  return {
    start: Math.min(fromIndex, toIndex) - 1,
    end: Math.max(fromIndex, toIndex) + 1,
  };
}

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
 * Generates every proved one-place relocation directly from the current baseline.
 *
 * Maximal block semantics are imported from Phase 3E-C. The complete baseline is first checked
 * with `orderedSequenceFromLookup`; each candidate is then compared through the existing
 * `sequenceComparisonFromLookup`, and only `b-clearly-faster` is emitted. Missing evidence is
 * never repaired or inferred. Trip bounds are intentionally absent from the input.
 */
export function generateEvidenceCompleteLocalRelocations(
  input: EvidenceCompleteLocalRelocationInput,
  dependencies: EvidenceCompleteLocalRelocationDependencies
): EvidenceCompleteLocalRelocationGeneration {
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
  const alternatives: EvidenceCompleteLocalRelocationAlternative[] = [];
  const emittedOrders = new Set<string>();

  input.days.forEach((day, dayOrdinal) => {
    const blocks = deriveSameHubBlocks(dayOrdinal, day.placeIds, resolvePlace);
    if (blocks === null) return;

    for (const block of blocks) {
      if (block.placeIds.length < 5) continue;

      const baseline = orderedSequenceFromLookup(block.placeIds, lookupTransfer);
      if (!baseline.summary.complete || baseline.summary.transferMinutes === null) continue;

      for (const { fromIndex, toIndex } of legalInteriorRelocations(block.placeIds.length)) {
        const window = affectedRelocationWindow(fromIndex, toIndex);
        const affectedWindowPlaceIds = block.placeIds.slice(window.start, window.end + 1);
        if (
          affectedWindowPlaceIds.some((placeId) =>
            hasManualVisitStartTime(input.visitStartTimes, placeId)
          )
        ) {
          continue;
        }

        const candidateBlockPlaceIds = relocateOnePlace(block.placeIds, fromIndex, toIndex);
        const candidateDayPlaceIds = relocateOnePlace(
          day.placeIds,
          block.startIndex + fromIndex,
          block.startIndex + toIndex
        );
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
          movedPlaceId: block.placeIds[fromIndex],
          fromDayIndex: block.startIndex + fromIndex,
          toDayIndex: block.startIndex + toIndex,
          affectedWindowPlaceIds,
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

  return { kind: "available", alternatives };
}

export type LocalRelocationStaleReason =
  | "no-day-assignment"
  | "day-missing"
  | "day-changed"
  | "moved-place-changed"
  | "illegal-destination"
  | "block-changed"
  | "hub-changed"
  | "manual-visit-time-added";

export type LocalRelocationApplicability =
  | { kind: "applicable"; dayId: string; fromDayIndex: number; toDayIndex: number }
  | { kind: "stale"; reason: LocalRelocationStaleReason };

/** Revalidates identity, block legality, hub continuity and the exact temporal window. */
export function assessLocalRelocationApplicability(
  alternative: EvidenceCompleteLocalRelocationAlternative,
  input: EvidenceCompleteLocalRelocationInput,
  dependencies: Pick<EvidenceCompleteLocalRelocationDependencies, "resolvePlace">
): LocalRelocationApplicability {
  if (input.days === null) return { kind: "stale", reason: "no-day-assignment" };
  const day = input.days.find((candidate) => candidate.id === alternative.dayId);
  if (!day) return { kind: "stale", reason: "day-missing" };
  if (!sameIds(day.placeIds, alternative.baselineDayPlaceIds)) {
    return { kind: "stale", reason: "day-changed" };
  }

  const { fromDayIndex, toDayIndex, blockStartDayIndex, blockEndDayIndex } = alternative;
  if (
    !Number.isInteger(fromDayIndex) ||
    !Number.isInteger(toDayIndex) ||
    !Number.isInteger(blockStartDayIndex) ||
    !Number.isInteger(blockEndDayIndex) ||
    blockEndDayIndex - blockStartDayIndex + 1 < 5 ||
    fromDayIndex <= blockStartDayIndex ||
    fromDayIndex >= blockEndDayIndex ||
    toDayIndex <= blockStartDayIndex ||
    toDayIndex >= blockEndDayIndex ||
    Math.abs(fromDayIndex - toDayIndex) < 2
  ) {
    return { kind: "stale", reason: "illegal-destination" };
  }
  if (day.placeIds[fromDayIndex] !== alternative.movedPlaceId) {
    return { kind: "stale", reason: "moved-place-changed" };
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
      relocateOnePlace(day.placeIds, fromDayIndex, toDayIndex),
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

  const window = affectedRelocationWindow(fromDayIndex, toDayIndex);
  const affectedWindowPlaceIds = day.placeIds.slice(window.start, window.end + 1);
  if (!sameIds(affectedWindowPlaceIds, alternative.affectedWindowPlaceIds)) {
    return { kind: "stale", reason: "day-changed" };
  }
  if (
    affectedWindowPlaceIds.some((placeId) =>
      hasManualVisitStartTime(input.visitStartTimes, placeId)
    )
  ) {
    return { kind: "stale", reason: "manual-visit-time-added" };
  }

  return { kind: "applicable", dayId: alternative.dayId, fromDayIndex, toDayIndex };
}

export type LocalRelocationApplyResult<Draft> =
  | { kind: "applied"; draft: Draft }
  | { kind: "stale"; reason: LocalRelocationStaleReason };

/** Applies one final-coordinate relocation only after the snapshot passes the stale guard. */
export function applyEvidenceCompleteLocalRelocation<Draft>(
  alternative: EvidenceCompleteLocalRelocationAlternative,
  input: EvidenceCompleteLocalRelocationInput,
  dependencies: Pick<EvidenceCompleteLocalRelocationDependencies, "resolvePlace">,
  relocateWithinDay: (dayId: string, fromIndex: number, toIndex: number) => Draft
): LocalRelocationApplyResult<Draft> {
  const applicability = assessLocalRelocationApplicability(alternative, input, dependencies);
  if (applicability.kind === "stale") return applicability;
  return {
    kind: "applied",
    draft: relocateWithinDay(
      applicability.dayId,
      applicability.fromDayIndex,
      applicability.toDayIndex
    ),
  };
}
