import type { MinuteRange } from "./duration";
import { getBestTransfer, type TransferEdge } from "./transfer";

/**
 * Phase 3C-A — Ordered Sequence Builder: the first place in this app that aggregates
 * transfer time across more than one edge.
 *
 * `transfer.ts`'s own "No aggregation without order" guard exists because an unordered
 * `Place[]` selection has no sequence, so there is no correct way to sum transfer times
 * across it. This module is exactly the exception that guard anticipates: it takes an
 * **explicit, caller-supplied ordered list of place ids** — never a bare `Place[]`, never an
 * order this module invents — and aggregates only the consecutive pairs that order defines.
 *
 * What this module never does, by design:
 *   - reverse a pair (`B → A` is never inferred from a recorded `A → B`);
 *   - chain across a missing edge (`A → C` is never derived from `A → B` + `B → C`);
 *   - search for, rank, or suggest an order — the order is the caller's, not this module's;
 *   - compute a shortest path or any other route optimisation;
 *   - fall back to geographic/haversine distance when no transfer is recorded;
 *   - make a network request of any kind.
 *
 * A pair with no recorded transfer becomes an honest `transfer: null` leg — the *unknown*
 * outcome `getBestTransfer` already returns for that exact direction — never a fabricated one.
 */

export type OrderedSequenceLeg = {
  fromId: string;
  toId: string;
  /** `getBestTransfer(fromId, toId)`, called in exactly that direction. `null` means the
   * dataset records no transfer for this exact directed pair — an honest unknown, not a
   * bug and not something this module tries to fill in. */
  transfer: TransferEdge | null;
};

export type OrderedSequenceSummary = {
  /** Number of ids the sequence was built from — not `legs.length`, which is one less. */
  placeCount: number;
  legCount: number;
  knownLegCount: number;
  unknownLegCount: number;
  /**
   * Sum of `minutes.minMinutes`/`minutes.maxMinutes` across `knownLegCount` legs only, added
   * minimum-to-minimum and maximum-to-maximum exactly as `summarizeSelection` sums visit
   * time. `null` when zero legs are known. An unknown leg contributes nothing to this sum —
   * never zero minutes, which would silently understate the route.
   */
  transferMinutes: MinuteRange | null;
  /** True only when every leg in the sequence has a known transfer. A caller must never
   * present `transferMinutes` as "the route's transfer total" unless this is true — see
   * `OrderedSequenceLeg` and the module doc above for why a partial sum cannot be extended
   * into a full one by any means available here. */
  complete: boolean;
};

export type OrderedSequence = {
  legs: OrderedSequenceLeg[];
  summary: OrderedSequenceSummary;
};

/**
 * Pure core of `buildOrderedSequence`, with the directed lookup injected so tests can exercise
 * ordering, missing-leg and no-reverse-inference guarantees against fixture data without
 * depending on whatever the real dataset happens to contain — the same seam pattern
 * `bestTransferFromLookups`/`logisticsMetricsFromLookup` already use in `transfer.ts`.
 *
 * `placeIds` is the sequence exactly as the caller ordered it — this function never reorders,
 * dedupes, or otherwise second-guesses it. 0 or 1 ids produce 0 legs, a `null`
 * `transferMinutes`, and a vacuously `true` `complete` (there is no leg to be missing); a
 * caller should not present that as "the route has a known transfer time" when there is no
 * route to have one.
 */
export function orderedSequenceFromLookup(
  placeIds: readonly string[],
  lookup: (fromId: string, toId: string) => TransferEdge | null
): OrderedSequence {
  const legs: OrderedSequenceLeg[] = [];
  for (let index = 0; index + 1 < placeIds.length; index += 1) {
    const fromId = placeIds[index];
    const toId = placeIds[index + 1];
    legs.push({ fromId, toId, transfer: lookup(fromId, toId) });
  }

  let minMinutes = 0;
  let maxMinutes = 0;
  let knownLegCount = 0;
  for (const leg of legs) {
    if (!leg.transfer) continue;
    minMinutes += leg.transfer.minutes.minMinutes;
    maxMinutes += leg.transfer.minutes.maxMinutes;
    knownLegCount += 1;
  }

  return {
    legs,
    summary: {
      placeCount: placeIds.length,
      legCount: legs.length,
      knownLegCount,
      unknownLegCount: legs.length - knownLegCount,
      transferMinutes: knownLegCount > 0 ? { minMinutes, maxMinutes } : null,
      complete: knownLegCount === legs.length,
    },
  };
}

/**
 * The preferred way to build an ordered sequence's logistics: reads `getBestTransfer` for
 * every consecutive pair in `placeIds`, exactly as it is defined — a directed, non-fabricating,
 * non-chaining lookup over precomputed data. Never runs routing at call time.
 */
export function buildOrderedSequence(placeIds: readonly string[]): OrderedSequence {
  return orderedSequenceFromLookup(placeIds, getBestTransfer);
}
