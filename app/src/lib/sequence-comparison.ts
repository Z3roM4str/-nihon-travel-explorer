import type { MinuteRange } from "./duration";
import { getBestTransfer, type TransferConfidence, type TransferEdge } from "./transfer";
import { orderedSequenceFromLookup, type OrderedSequence } from "./ordered-sequence";

/**
 * Phase 3C-B — User-Defined Sequence Comparison.
 *
 * Compares exactly **two user-defined orderings of the same places** — never generates,
 * ranks, or suggests a candidate order itself. Both orderings are built through
 * `orderedSequenceFromLookup`/`buildOrderedSequence` (Phase 3C-A); this module never
 * reimplements transfer lookup, reversal, or chaining semantics — it only reasons about two
 * already-built `OrderedSequence`s.
 *
 * The one rule everything else here serves: **an unknown leg is not zero minutes, and a
 * declared winner must survive its own uncertainty.** A candidate is never declared faster
 * because its *known* subtotal is smaller — only when its full range is strictly below the
 * other candidate's full range, and only when both candidates are fully known.
 */

export type ConfidenceCounts = {
  validatedStatic: number;
  estimated: number;
  scheduleAware: number;
};

export type SequenceCandidate = {
  /** Exactly as supplied by the caller — never reordered, deduped, or validated by this type
   * alone; see `sameSet`/`outcome` on the comparison for that. */
  placeIds: readonly string[];
  sequence: OrderedSequence;
  /** Tally of `sequence.legs[*].transfer?.confidence`, over known legs only. An unknown leg
   * contributes to none of these — it is counted separately as `sequence.summary.unknownLegCount`. */
  confidenceCounts: ConfidenceCounts;
};

/**
 * - `"a-clearly-faster"` / `"b-clearly-faster"` — one candidate's full range sits strictly
 *   below the other's (`winner.maxMinutes < loser.minMinutes`). Only reachable when both
 *   candidates are `complete`.
 * - `"equivalent"` — both candidates' known transfer ranges are exactly identical (including
 *   the trivial case of zero legs, e.g. a 0-1 place "sequence").
 * - `"overlapping"` — both complete, but neither range sits strictly below the other: the data
 *   available cannot support a winner, even though the two are not exactly equal either.
 * - `"incomplete"` — at least one candidate has an unknown leg. A known subtotal may still be
 *   shown for either candidate, but no winner is ever declared.
 * - `"invalid"` — the two candidates do not represent the same set of unique place ids (a
 *   duplicate id, a missing id, or an extra id). Comparing order presupposes the same places;
 *   this is not an ordering question at all. Unreachable through `OrderedSequenceBuilder`'s own
 *   comparison UI, which only ever reorders a shared clone — kept here as a domain-level
 *   invariant for any other caller.
 */
export type SequenceComparisonOutcome =
  | "a-clearly-faster"
  | "b-clearly-faster"
  | "equivalent"
  | "overlapping"
  | "incomplete"
  | "invalid";

export type SequenceComparison = {
  candidateA: SequenceCandidate;
  candidateB: SequenceCandidate;
  /** Whether both candidates are duplicate-free and represent exactly the same set of place
   * ids. `false` forces `outcome: "invalid"` regardless of anything else. */
  sameSet: boolean;
  outcome: SequenceComparisonOutcome;
  /**
   * The conservative, guaranteed advantage in minutes of the winning candidate — always
   * `loser.minMinutes - winner.maxMinutes`, i.e. the gap that holds even in the winner's worst
   * case against the loser's best case. `null` unless `outcome` is `"-clearly-faster"`. Never a
   * midpoint-derived figure.
   */
  guaranteedAdvantageMinutes: number | null;
  /**
   * The full range the true difference could take, from interval subtraction of the two
   * candidates' independent ranges (`[loser.min - winner.max, loser.max - winner.min]`). Its
   * lower bound always equals `guaranteedAdvantageMinutes`. Computed whenever a winner is
   * declared, but this module does not itself decide whether a caller should display it — see
   * `OrderedSequenceBuilder`'s comparison view, which currently shows only the guaranteed figure
   * to keep the result readable at a glance.
   */
  possibleAdvantageRange: MinuteRange | null;
};

function hasDuplicates(ids: readonly string[]): boolean {
  return new Set(ids).size !== ids.length;
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const id of setA) {
    if (!setB.has(id)) return false;
  }
  return true;
}

function tallyConfidence(sequence: OrderedSequence): ConfidenceCounts {
  const counts: ConfidenceCounts = { validatedStatic: 0, estimated: 0, scheduleAware: 0 };
  const byConfidence: Record<TransferConfidence, keyof ConfidenceCounts> = {
    "validated-static": "validatedStatic",
    estimated: "estimated",
    "schedule-aware": "scheduleAware",
  };
  for (const leg of sequence.legs) {
    if (!leg.transfer) continue;
    counts[byConfidence[leg.transfer.confidence]] += 1;
  }
  return counts;
}

function buildCandidate(
  placeIds: readonly string[],
  lookup: (fromId: string, toId: string) => TransferEdge | null
): SequenceCandidate {
  const sequence = orderedSequenceFromLookup(placeIds, lookup);
  return { placeIds, sequence, confidenceCounts: tallyConfidence(sequence) };
}

/** No winner, no advantage — the shared shape every non-comparable outcome returns. */
function inconclusive(
  candidateA: SequenceCandidate,
  candidateB: SequenceCandidate,
  sameSet: boolean,
  outcome: SequenceComparisonOutcome
): SequenceComparison {
  return {
    candidateA,
    candidateB,
    sameSet,
    outcome,
    guaranteedAdvantageMinutes: null,
    possibleAdvantageRange: null,
  };
}

/**
 * Pure core of `compareSequences`, with the directed lookup injected so tests can exercise the
 * comparison rules against fixture data — the same seam `orderedSequenceFromLookup` and
 * `transfer.ts`'s own `bestTransferFromLookups`/`logisticsMetricsFromLookup` already use.
 */
export function sequenceComparisonFromLookup(
  placeIdsA: readonly string[],
  placeIdsB: readonly string[],
  lookup: (fromId: string, toId: string) => TransferEdge | null
): SequenceComparison {
  const candidateA = buildCandidate(placeIdsA, lookup);
  const candidateB = buildCandidate(placeIdsB, lookup);

  const sameSet =
    !hasDuplicates(placeIdsA) && !hasDuplicates(placeIdsB) && sameIdSet(placeIdsA, placeIdsB);
  if (!sameSet) return inconclusive(candidateA, candidateB, sameSet, "invalid");

  const { summary: summaryA } = candidateA.sequence;
  const { summary: summaryB } = candidateB.sequence;

  if (!summaryA.complete || !summaryB.complete) {
    return inconclusive(candidateA, candidateB, sameSet, "incomplete");
  }

  // Same set ⇒ same place count ⇒ same leg count. Zero legs (0 or 1 shared place) means there
  // is nothing to compare — trivially equivalent, not "nothing known yet".
  if (summaryA.legCount === 0) {
    return inconclusive(candidateA, candidateB, sameSet, "equivalent");
  }

  // `complete && legCount > 0` implies a non-null range (see orderedSequenceFromLookup); this
  // check exists so the comparison stays total and honest rather than asserting that.
  if (summaryA.transferMinutes === null || summaryB.transferMinutes === null) {
    return inconclusive(candidateA, candidateB, sameSet, "incomplete");
  }
  const a = summaryA.transferMinutes;
  const b = summaryB.transferMinutes;

  if (a.minMinutes === b.minMinutes && a.maxMinutes === b.maxMinutes) {
    return inconclusive(candidateA, candidateB, sameSet, "equivalent");
  }

  if (a.maxMinutes < b.minMinutes) {
    return {
      candidateA,
      candidateB,
      sameSet,
      outcome: "a-clearly-faster",
      guaranteedAdvantageMinutes: b.minMinutes - a.maxMinutes,
      possibleAdvantageRange: { minMinutes: b.minMinutes - a.maxMinutes, maxMinutes: b.maxMinutes - a.minMinutes },
    };
  }

  if (b.maxMinutes < a.minMinutes) {
    return {
      candidateA,
      candidateB,
      sameSet,
      outcome: "b-clearly-faster",
      guaranteedAdvantageMinutes: a.minMinutes - b.maxMinutes,
      possibleAdvantageRange: { minMinutes: a.minMinutes - b.maxMinutes, maxMinutes: a.maxMinutes - b.minMinutes },
    };
  }

  // Neither range sits strictly below the other, and they are not exactly equal: they overlap.
  return inconclusive(candidateA, candidateB, sameSet, "overlapping");
}

/**
 * The preferred way to compare two user-defined orderings: reads `getBestTransfer` for every
 * consecutive pair in each, exactly as `buildOrderedSequence` does. Never runs routing at call
 * time, never generates a candidate order, never ranks more than the two orderings given.
 */
export function compareSequences(
  placeIdsA: readonly string[],
  placeIdsB: readonly string[]
): SequenceComparison {
  return sequenceComparisonFromLookup(placeIdsA, placeIdsB, getBestTransfer);
}
