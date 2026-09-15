import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { Place } from "../types";
import { getPlaceById } from "../data/store";
import type {
  AccommodationBoundaryChoice,
  DayAccommodationBoundary,
  ManualAccommodationLeg,
} from "./accommodation-commute";
import { assessInterHubSegment, type ManualInterHubSegment } from "./inter-hub-segment";
import {
  loadReconciledDraft,
  PLANNING_DRAFT_STORAGE_KEY,
  PLANNING_DRAFT_VERSION,
  withTwoPairBlocksSwappedWithinDay,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV7,
  type PlanningDayV5,
} from "./planning-draft-v7";
import {
  deriveSameHubBlocks,
  generateEvidenceCompleteLocalSwaps,
} from "./evidence-complete-local-swap";
import {
  generateEvidenceCompleteLocalRelocations,
  relocateOnePlace,
} from "./evidence-complete-local-relocation";
import {
  generateEvidenceCompleteInteriorTranspositions,
  transposeTwoPlaces,
} from "./evidence-complete-interior-transposition";
import {
  generateEvidenceCompleteFourPlaceInteriorReversals,
  reverseFourPlaces,
} from "./evidence-complete-four-place-interior-reversal";
import { orderedSequenceFromLookup } from "./ordered-sequence";
import { sequenceComparisonFromLookup } from "./sequence-comparison";
import { getBestTransfer, type TransferConfidence, type TransferEdge } from "./transfer";
import { buildWholeTripComposition, type WholeTripComposition } from "./whole-trip-composition";
import {
  affectedTwoPairBlockSwapPositions,
  applyEvidenceCompleteTwoPairBlockSwap,
  assessTwoPairBlockSwapApplicability,
  generateEvidenceCompleteTwoPairBlockSwaps,
  legalTwoPairBlockSwapWindows,
  swapAdjacentTwoPlaceBlocks,
  TWO_PAIR_BLOCK_SWAP_PAIR_LENGTH,
  TWO_PAIR_BLOCK_SWAP_WINDOW_LENGTH,
  type EvidenceCompleteTwoPairBlockSwapAlternative,
  type EvidenceCompleteTwoPairBlockSwapGeneration,
  type TwoPairBlockSwapDay,
} from "./evidence-complete-two-pair-block-swap";

/* Phase 3E-K: the domain contracts 1-122 from design §33, numbered one-for-one below.
 *
 * Contract 123 (UI wiring) lives in `components/OrderedSequenceBuilder.two-pair-block-swap.test.ts`
 * and contracts 124-125 are executable-only, proved by `scripts/phase3e-k-browser-audit.mjs`
 * against a real Chromium runtime. */

const MODULE_URL = new URL("./evidence-complete-two-pair-block-swap.ts", import.meta.url);
const moduleSource = () => readFile(MODULE_URL, "utf8");

/** The module's executable code with every comment stripped: a doc comment may *name* what is
 * forbidden, so only the code itself is scanned for a forbidden construct. */
async function moduleCode(): Promise<string> {
  return (await moduleSource()).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function place(id: string, hub = "Okinawa"): Place {
  return {
    id,
    hub,
    name: id.toUpperCase(),
    duration: { raw: "60 min", minMinutes: 60, maxMinutes: 60 },
  } as unknown as Place;
}

function transfer(
  fromId: string,
  toId: string,
  minMinutes: number,
  maxMinutes = minMinutes,
  confidence: TransferConfidence = "validated-static"
): TransferEdge {
  return { fromId, toId, minutes: { minMinutes, maxMinutes }, confidence } as TransferEdge;
}

function lookupFrom(edges: readonly TransferEdge[]) {
  const byPair = new Map(edges.map((edge) => [`${edge.fromId}>${edge.toId}`, edge]));
  return (fromId: string, toId: string) => byPair.get(`${fromId}>${toId}`) ?? null;
}

function day(id: string, placeIds: string[]): TwoPairBlockSwapDay {
  return { id, placeIds };
}

/** `[l, a, b, c, d, r]` — the shortest block with exactly one legal four-place interior window. */
const IDS = ["l", "a", "b", "c", "d", "r"];
const PLACES = IDS.map((id) => place(id));
/** The exact 2+2 exchange of `[a, b]` and `[c, d]`, with both pair-internal orders preserved. */
const SWAPPED = ["l", "c", "d", "a", "b", "r"];
/**
 * Baseline `l→a→b→c→d→r` totals 50. The candidate reuses the preserved `a→b` and `c→d` and adds
 * the three genuinely new directions `l→c`, `d→a` and `b→r`, totalling 23. Every new direction has
 * a recorded reverse twin that must never be allowed to stand in for it.
 */
const EDGES = [
  transfer("l", "a", 10),
  transfer("a", "b", 10),
  transfer("b", "c", 10),
  transfer("c", "d", 10),
  transfer("d", "r", 10),
  transfer("l", "c", 1),
  transfer("d", "a", 1),
  transfer("b", "r", 1),
  transfer("c", "l", 1),
  transfer("a", "d", 1),
  transfer("r", "b", 1),
];

function generate(overrides: {
  routeIds?: string[];
  days?: TwoPairBlockSwapDay[] | null;
  places?: Place[];
  visitStartTimes?: Record<string, string>;
  edges?: TransferEdge[];
  lookupTransfer?: (fromId: string, toId: string) => TransferEdge | null;
} = {}): EvidenceCompleteTwoPairBlockSwapGeneration {
  const routeIds = overrides.routeIds ?? IDS;
  const days = overrides.days === undefined ? [day("d1", [...IDS])] : overrides.days;
  const places = overrides.places ?? PLACES;
  const byId = new Map(places.map((entry) => [entry.id, entry]));
  return generateEvidenceCompleteTwoPairBlockSwaps(
    { routeIds, days, visitStartTimes: overrides.visitStartTimes ?? {} },
    {
      resolvePlace: (placeId) => byId.get(placeId) ?? null,
      lookupTransfer: overrides.lookupTransfer ?? lookupFrom(overrides.edges ?? EDGES),
    }
  );
}

function alternatives(
  generation: EvidenceCompleteTwoPairBlockSwapGeneration
): EvidenceCompleteTwoPairBlockSwapAlternative[] {
  expect(generation.kind).toBe("available");
  return generation.kind === "available" ? generation.alternatives : [];
}

function resolver(places = PLACES) {
  const byId = new Map(places.map((entry) => [entry.id, entry]));
  return (placeId: string) => byId.get(placeId) ?? null;
}

/** Makes every current baseline edge expensive, so every legal candidate is provably faster. */
function baselineHeavyLookup(ids: readonly string[]) {
  const baselinePairs = new Set(ids.slice(0, -1).map((id, index) => `${id}>${ids[index + 1]}`));
  return (fromId: string, toId: string) =>
    transfer(fromId, toId, baselinePairs.has(`${fromId}>${toId}`) ? 100 : 1);
}

/** `[l, a, b, c, d, e, r]` — two legal windows, and a place outside each affected six-place set. */
const IDS7 = ["l", "a", "b", "c", "d", "e", "r"];
const PLACES7 = IDS7.map((id) => place(id));

function generate7(visitStartTimes: Record<string, string> = {}) {
  return generateEvidenceCompleteTwoPairBlockSwaps(
    { routeIds: IDS7, days: [day("d1", [...IDS7])], visitStartTimes },
    { resolvePlace: resolver(PLACES7), lookupTransfer: baselineHeavyLookup(IDS7) }
  );
}

describe("structural availability (§33.1-5)", () => {
  it("1. no days is unavailable", () => {
    expect(generate({ days: null })).toEqual({ kind: "unavailable", reason: "no-day-assignment" });
  });
  it("2. an invalid partition is unavailable", () => {
    expect(generate({ days: [day("d1", ["l", "a", "b"])] })).toEqual({
      kind: "unavailable",
      reason: "invalid-day-partition",
    });
  });
  it("3. an unresolved route place is unavailable", () => {
    expect(generate({ places: PLACES.slice(0, 5) })).toEqual({
      kind: "unavailable",
      reason: "unresolved-route-place",
    });
  });
  it("4. a valid plan is available", () => {
    expect(generate().kind).toBe("available");
  });
  it("5. trip bounds are not an input and cannot block a candidate", async () => {
    expect(await moduleSource()).not.toMatch(/startDate|endDate|tripBounds/);
    expect(alternatives(generate())).toHaveLength(1);
  });
});

describe("same-hub block and enumeration (§33.6-28)", () => {
  it("6. maximal same-hub block semantics are imported from Phase 3E-C, not re-derived", async () => {
    const source = await moduleSource();
    expect(source).toContain('import { deriveSameHubBlocks } from "./evidence-complete-local-swap"');
    expect(source).not.toMatch(/function deriveSameHubBlocks/);
    expect(deriveSameHubBlocks(0, IDS, resolver())).toHaveLength(1);
  });
  it("7. no candidate crosses a hub boundary", () => {
    const places = [...IDS.slice(0, 5).map((id) => place(id)), place("r", "Kioto")];
    expect(alternatives(generate({ places }))).toHaveLength(0);
  });
  it("8. no candidate crosses a day boundary", () => {
    expect(
      alternatives(generate({ days: [day("d1", ["l", "a", "b"]), day("d2", ["c", "d", "r"])] }))
    ).toHaveLength(0);
  });
  it("9. an empty day produces none", () => {
    const generation = generate({ days: [day("d1", []), day("d2", [...IDS])] });
    expect(alternatives(generation).every((entry) => entry.dayId === "d2")).toBe(true);
    expect(alternatives(generation)).toHaveLength(1);
  });
  it("10. a block shorter than six produces no pair-block swap", () => {
    for (const length of [0, 1, 2, 3, 4, 5]) {
      expect(legalTwoPairBlockSwapWindows(length)).toHaveLength(0);
    }
    const ids = ["l", "a", "b", "c", "r"];
    expect(
      alternatives(
        generate({
          routeIds: ids,
          days: [day("d1", ids)],
          places: ids.map((id) => place(id)),
          lookupTransfer: baselineHeavyLookup(ids),
        })
      )
    ).toHaveLength(0);
  });
  it("11. block endpoints remain fixed", () => {
    for (const alternative of alternatives(generate7())) {
      expect(alternative.candidateBlockPlaceIds[0]).toBe(alternative.blockStartPlaceId);
      expect(alternative.candidateBlockPlaceIds.at(-1)).toBe(alternative.blockEndPlaceId);
    }
  });
  it("12. every window start is interior", () => {
    for (const { windowStartIndex } of legalTwoPairBlockSwapWindows(10)) {
      expect(windowStartIndex).toBeGreaterThanOrEqual(1);
    }
  });
  it("13. every window end is interior", () => {
    const blockLength = 10;
    for (const { windowStartIndex } of legalTwoPairBlockSwapWindows(blockLength)) {
      expect(windowStartIndex + TWO_PAIR_BLOCK_SWAP_WINDOW_LENGTH - 1).toBeLessThanOrEqual(
        blockLength - 2
      );
    }
  });
  it("14. exactly four consecutive interior positions are selected", () => {
    for (const alternative of alternatives(generate7())) {
      const window = [...alternative.firstPairPlaceIds, ...alternative.secondPairPlaceIds];
      expect(window).toHaveLength(TWO_PAIR_BLOCK_SWAP_WINDOW_LENGTH);
      expect(window.map((placeId) => alternative.baselineDayPlaceIds.indexOf(placeId))).toEqual([
        alternative.windowStartDayIndex,
        alternative.windowStartDayIndex + 1,
        alternative.windowStartDayIndex + 2,
        alternative.windowStartDayIndex + 3,
      ]);
      expect(alternative.windowStartDayIndex).toBeGreaterThan(alternative.blockStartDayIndex);
      expect(alternative.windowStartDayIndex + 3).toBeLessThan(alternative.blockEndDayIndex);
    }
  });
  it("15. the first block is exactly two places", () => {
    expect(TWO_PAIR_BLOCK_SWAP_PAIR_LENGTH).toBe(2);
    for (const alternative of alternatives(generate7())) {
      expect(alternative.firstPairPlaceIds).toHaveLength(2);
    }
  });
  it("16. the second block is exactly two places", () => {
    for (const alternative of alternatives(generate7())) {
      expect(alternative.secondPairPlaceIds).toHaveLength(2);
    }
  });
  it("17. the two blocks are adjacent", () => {
    for (const alternative of alternatives(generate7())) {
      const baseline = alternative.baselineDayPlaceIds;
      expect(baseline.indexOf(alternative.secondPairPlaceIds[0])).toBe(
        baseline.indexOf(alternative.firstPairPlaceIds[1]) + 1
      );
    }
  });
  it("18. pair-internal order is preserved on both sides", () => {
    for (const alternative of alternatives(generate7())) {
      const candidate = alternative.candidateDayPlaceIds;
      expect(candidate.indexOf(alternative.firstPairPlaceIds[0])).toBe(
        candidate.indexOf(alternative.firstPairPlaceIds[1]) - 1
      );
      expect(candidate.indexOf(alternative.secondPairPlaceIds[0])).toBe(
        candidate.indexOf(alternative.secondPairPlaceIds[1]) - 1
      );
    }
    const alternative = alternatives(generate())[0];
    expect(alternative.firstPairPlaceIds).toEqual(["a", "b"]);
    expect(alternative.secondPairPlaceIds).toEqual(["c", "d"]);
    expect(alternative.swappedWindowPlaceIds).toEqual(["c", "d", "a", "b"]);
  });
  it("19. the first block ends up after the second block", () => {
    for (const alternative of alternatives(generate7())) {
      const candidate = alternative.candidateDayPlaceIds;
      expect(candidate.indexOf(alternative.firstPairPlaceIds[0])).toBe(
        alternative.windowStartDayIndex + TWO_PAIR_BLOCK_SWAP_PAIR_LENGTH
      );
      expect(candidate.indexOf(alternative.firstPairPlaceIds[0])).toBeGreaterThan(
        candidate.indexOf(alternative.secondPairPlaceIds[1])
      );
    }
  });
  it("20. the second block ends up before the first block", () => {
    for (const alternative of alternatives(generate7())) {
      const candidate = alternative.candidateDayPlaceIds;
      expect(candidate.indexOf(alternative.secondPairPlaceIds[0])).toBe(
        alternative.windowStartDayIndex
      );
      expect(candidate.indexOf(alternative.secondPairPlaceIds[0])).toBeLessThan(
        candidate.indexOf(alternative.firstPairPlaceIds[0])
      );
    }
  });
  it("21. every place outside the window stays at the same index", () => {
    for (const alternative of alternatives(generate7())) {
      const { windowStartDayIndex: start } = alternative;
      alternative.baselineDayPlaceIds.forEach((placeId, index) => {
        if (index >= start && index <= start + 3) return;
        expect(alternative.candidateDayPlaceIds[index]).toBe(placeId);
      });
      // All four window positions genuinely change: this is never a two- or three-place move.
      const changed = alternative.baselineDayPlaceIds.filter(
        (placeId, index) => alternative.candidateDayPlaceIds[index] !== placeId
      );
      expect(changed).toHaveLength(4);
    }
  });
  it("22. candidate orders are unique", () => {
    const orders = alternatives(generate7()).map((entry) =>
      JSON.stringify(entry.candidateDayPlaceIds)
    );
    expect(new Set(orders).size).toBe(orders.length);
  });
  it("23. order is day, then block, then window start ascending", () => {
    expect(alternatives(generate7()).map((entry) => entry.windowStartDayIndex)).toEqual([1, 2]);
    const ids = [...IDS7, "m0", "m1", "m2", "m3", "m4", "m5"];
    const places = ids.map((id) => place(id, id.startsWith("m") ? "Kioto" : "Okinawa"));
    const generation = generate({
      routeIds: ids,
      days: [day("d1", ids.slice(0, 7)), day("d2", ids.slice(7))],
      places,
      lookupTransfer: baselineHeavyLookup(ids),
    });
    expect(
      alternatives(generation).map((entry) => `${entry.dayId}:${entry.windowStartDayIndex}`)
    ).toEqual(["d1:1", "d1:2", "d2:1"]);
  });
  it("24. candidate count equals n - 5", () => {
    for (let n = 0; n <= 14; n += 1) {
      expect(legalTwoPairBlockSwapWindows(n)).toHaveLength(Math.max(0, n - 5));
    }
  });
  it("25. the source documents the candidate count as O(n)", async () => {
    const source = await moduleSource();
    expect(source).toContain("`n - 5`");
    expect(source).toContain("candidate count");
  });
  it("26. total evaluation is not misclaimed as O(n)", async () => {
    const source = await moduleSource();
    expect(source).toContain("O(n²)");
    expect(source).not.toMatch(/total runtime is O\(n\)/);
    expect(source).not.toMatch(/total .{0,20}evaluation .{0,20}O\(n\)[^²]/);
  });
  it("27. there is no generic block-destination search", async () => {
    const code = await moduleCode();
    // A window is fully described by its start: there is no destination coordinate to search over.
    expect(code).toContain("export type TwoPairBlockSwapWindow = {");
    const shape = code.slice(
      code.indexOf("export type TwoPairBlockSwapWindow = {"),
      code.indexOf("};", code.indexOf("export type TwoPairBlockSwapWindow = {"))
    );
    expect(shape).toContain("windowStartIndex: number;");
    expect(shape).not.toMatch(/destination|toIndex|targetIndex|blockLength/);
    // The enumerator holds exactly one loop — no nested destination or block-size dimension.
    const enumerator = code.slice(
      code.indexOf("export function legalTwoPairBlockSwapWindows"),
      code.indexOf("export function swapAdjacentTwoPlaceBlocks")
    );
    expect(enumerator.match(/for\s*\(/g)).toHaveLength(1);
    expect(Object.keys(alternatives(generate())[0])).not.toContain("toIndex");
  });
  it("28. there is no recursion or candidate chaining", async () => {
    const code = await moduleCode();
    const generatorStart = code.indexOf("export function generateEvidenceCompleteTwoPairBlockSwaps");
    const body = code.slice(code.indexOf("{", code.indexOf("Generation {", generatorStart)));
    expect(body).not.toContain("generateEvidenceCompleteTwoPairBlockSwaps");
    // Every candidate is built from the current baseline block, never from another candidate.
    expect(code.match(/swapAdjacentTwoPlaceBlocks\(/g)?.length).toBeGreaterThan(0);
    expect(code).not.toMatch(/swapAdjacentTwoPlaceBlocks\(\s*candidate/);
    expect(code).not.toMatch(/\bwhile\s*\(|\bdo\s*\{/);
    // No earlier neighbourhood's mutation is reachable from here, so no move can be composed.
    expect(code).not.toMatch(/relocateOnePlace|transposeTwoPlaces|reverseFourPlaces/);
  });
});

describe("temporal lock (§33.29-41)", () => {
  const target = (visitStartTimes: Record<string, string>) =>
    alternatives(generate({ visitStartTimes }))[0];
  const affected = () => alternatives(generate())[0].affectedPlaceIds;

  it("29. the affected set begins at the window predecessor", () => {
    expect(affectedTwoPairBlockSwapPositions(1)[0]).toBe(0);
    expect(affected()[0]).toBe("l");
  });
  it("30. the affected set contains all four moved places", () => {
    for (const placeId of ["a", "b", "c", "d"]) expect(affected()).toContain(placeId);
  });
  it("31. the affected set ends at the window successor", () => {
    expect(affectedTwoPairBlockSwapPositions(1).at(-1)).toBe(5);
    expect(affected().at(-1)).toBe("r");
  });
  it("32. the exact affected size is six", () => {
    expect(affectedTwoPairBlockSwapPositions(1)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(affectedTwoPairBlockSwapPositions(4)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(affected()).toHaveLength(6);
  });
  it("33. a time on the predecessor blocks", () => expect(target({ l: "08:00" })).toBeUndefined());
  it("34. a time on the first place of the first block blocks", () =>
    expect(target({ a: "09:00" })).toBeUndefined());
  it("35. a time on the second place of the first block blocks", () =>
    expect(target({ b: "10:00" })).toBeUndefined());
  it("36. a time on the first place of the second block blocks", () =>
    expect(target({ c: "11:00" })).toBeUndefined());
  it("37. a time on the second place of the second block blocks", () =>
    expect(target({ d: "12:00" })).toBeUndefined());
  it("38. a time on the successor blocks", () => expect(target({ r: "13:00" })).toBeUndefined());
  it("39. a timed place outside the six-place window does not block", () => {
    // Window 1..4 of the seven-place block leaves `r` (index 6) outside its affected set.
    const kept = alternatives(generate7({ r: "10:00" }));
    expect(kept.some((entry) => entry.windowStartDayIndex === 1)).toBe(true);
    expect(kept.some((entry) => entry.windowStartDayIndex === 2)).toBe(false);
    expect(alternatives(generate7()).length).toBeGreaterThan(kept.length);
  });
  it("40. a timed place elsewhere in the day does not block", () => {
    const ids = [...IDS, "x"];
    const generation = generate({
      routeIds: ids,
      days: [day("d1", ids)],
      places: [...PLACES, place("x", "Kioto")],
      visitStartTimes: { x: "12:00" },
    });
    expect(alternatives(generation)).toHaveLength(1);
  });
  it("41. generation never edits, moves or infers a visit start time", () => {
    const visitStartTimes = { x: "12:00" };
    const ids = [...IDS, "x"];
    generate({
      routeIds: ids,
      days: [day("d1", ids)],
      places: [...PLACES, place("x", "Kioto")],
      visitStartTimes,
    });
    expect(visitStartTimes).toEqual({ x: "12:00" });
  });
});

describe("evidence gates (§33.42-52)", () => {
  const without = (fromId: string, toId: string) =>
    EDGES.filter((edge) => !(edge.fromId === fromId && edge.toId === toId));

  it("42. a complete baseline is required", () => {
    expect(orderedSequenceFromLookup(IDS, lookupFrom(EDGES)).summary.complete).toBe(true);
    expect(alternatives(generate())).toHaveLength(1);
  });
  it("43. one missing baseline edge blocks the whole block", () => {
    expect(alternatives(generate({ edges: without("b", "c") }))).toHaveLength(0);
  });
  it("44. a reverse or chained edge never repairs a baseline", () => {
    const edges = [...without("l", "a"), transfer("a", "l", 1)];
    expect(edges.some((edge) => edge.fromId === "a" && edge.toId === "l")).toBe(true);
    expect(alternatives(generate({ edges }))).toHaveLength(0);
  });
  it("45. a complete candidate is required", () => {
    const alternative = alternatives(generate())[0];
    expect(alternative.candidateBlockPlaceIds).toEqual(SWAPPED);
    expect(orderedSequenceFromLookup(SWAPPED, lookupFrom(EDGES)).summary.complete).toBe(true);
  });
  it("46. a missing L→C discards the candidate", () => {
    // Candidate-only: the baseline never traverses it, so only the candidate gate can catch this.
    expect(orderedSequenceFromLookup(IDS, lookupFrom(without("l", "c"))).summary.complete).toBe(true);
    expect(alternatives(generate({ edges: without("l", "c") }))).toHaveLength(0);
  });
  it("47. a missing preserved C→D discards the candidate", () => {
    // `C→D` survives the exchange, so it is required on both sides; the baseline gate refuses first
    // and the candidate is discarded either way. Neither order may be scored without it.
    expect(orderedSequenceFromLookup(SWAPPED, lookupFrom(without("c", "d"))).summary.complete).toBe(
      false
    );
    expect(alternatives(generate({ edges: without("c", "d") }))).toHaveLength(0);
  });
  it("48. a missing bridge D→A discards the candidate", () => {
    expect(orderedSequenceFromLookup(IDS, lookupFrom(without("d", "a"))).summary.complete).toBe(true);
    expect(alternatives(generate({ edges: without("d", "a") }))).toHaveLength(0);
  });
  it("49. a missing preserved A→B discards the candidate", () => {
    expect(orderedSequenceFromLookup(SWAPPED, lookupFrom(without("a", "b"))).summary.complete).toBe(
      false
    );
    expect(alternatives(generate({ edges: without("a", "b") }))).toHaveLength(0);
  });
  it("50. a missing B→R discards the candidate", () => {
    expect(orderedSequenceFromLookup(IDS, lookupFrom(without("b", "r"))).summary.complete).toBe(true);
    expect(alternatives(generate({ edges: without("b", "r") }))).toHaveLength(0);
  });
  it("51. a recorded reverse twin never synthesizes a candidate direction", () => {
    for (const [fromId, toId] of [
      ["l", "c"],
      ["d", "a"],
      ["b", "r"],
    ]) {
      const edges = without(fromId, toId);
      const lookup = lookupFrom(edges);
      expect(lookup(toId, fromId)).not.toBeNull();
      expect(lookup(fromId, toId)).toBeNull();
      expect(alternatives(generate({ edges }))).toHaveLength(0);
    }
  });
  it("52. no geometry or network fallback exists in the module", async () => {
    const code = await moduleCode();
    for (const forbidden of [
      /haversine/i,
      /\bdistance\b/i,
      /\blat\b/,
      /\blng\b/,
      /\bfetch\s*\(/,
      /\bORS\b/,
      /Math\.(sqrt|sin|cos|atan2|hypot)/,
      /\bgeometry\b/i,
    ]) {
      expect(code).not.toMatch(forbidden);
    }
  });
});

describe("comparison and confidence (§33.53-62)", () => {
  it("53. a b-clearly-faster candidate is emitted", () => {
    const alternative = alternatives(generate())[0];
    expect(alternative.baselineTransferMinutes).toEqual({ minMinutes: 50, maxMinutes: 50 });
    expect(alternative.candidateTransferMinutes).toEqual({ minMinutes: 23, maxMinutes: 23 });
    expect(sequenceComparisonFromLookup(IDS, SWAPPED, lookupFrom(EDGES)).outcome).toBe(
      "b-clearly-faster"
    );
  });
  it("54. an equivalent range is rejected", () => {
    expect(alternatives(generate({ lookupTransfer: () => transfer("x", "y", 10) }))).toHaveLength(0);
  });
  it("55. an overlapping range is rejected", () => {
    const lookup = (fromId: string, toId: string) =>
      fromId === "l" && toId === "c" ? transfer(fromId, toId, 1, 100) : transfer(fromId, toId, 10);
    expect(alternatives(generate({ lookupTransfer: lookup }))).toHaveLength(0);
  });
  it("56. a faster baseline is rejected", () => {
    const baselinePairs = ["l>a", "a>b", "b>c", "c>d", "d>r"];
    const lookup = (fromId: string, toId: string) =>
      transfer(fromId, toId, baselinePairs.includes(`${fromId}>${toId}`) ? 1 : 100);
    expect(alternatives(generate({ lookupTransfer: lookup }))).toHaveLength(0);
  });
  it("57. an incomplete comparison is rejected", () => {
    expect(alternatives(generate({ lookupTransfer: () => null }))).toHaveLength(0);
  });
  it("58. the existing Phase 3C-B advantage arithmetic is reused unchanged", () => {
    const alternative = alternatives(generate())[0];
    const comparison = sequenceComparisonFromLookup(IDS, SWAPPED, lookupFrom(EDGES));
    expect(alternative.guaranteedAdvantageMinutes).toBe(comparison.guaranteedAdvantageMinutes);
    expect(alternative.possibleAdvantageRange).toEqual(comparison.possibleAdvantageRange);
    expect(alternative.guaranteedAdvantageMinutes).toBe(27);
  });
  it("59. the baseline confidence tally is preserved", () => {
    expect(alternatives(generate())[0].baselineConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
  });
  it("60. the candidate confidence tally is preserved", () => {
    expect(alternatives(generate())[0].candidateConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
  });
  it("61. estimated evidence remains visibly estimated", () => {
    const estimated = EDGES.map((edge) =>
      transfer(edge.fromId, edge.toId, edge.minutes.minMinutes, edge.minutes.maxMinutes, "estimated")
    );
    const alternative = alternatives(generate({ edges: estimated }))[0];
    expect(alternative.baselineConfidenceCounts.estimated).toBe(5);
    expect(alternative.candidateConfidenceCounts.estimated).toBe(5);
    expect(alternative.baselineConfidenceCounts.validatedStatic).toBe(0);
  });
  it("62. confidence produces no score, rank or winner field", () => {
    const alternative = alternatives(generate())[0];
    for (const forbidden of ["score", "rank", "best", "recommended", "winner", "grade"]) {
      expect(Object.keys(alternative)).not.toContain(forbidden);
    }
  });
});

const OKINAWA = ["JP-202", "JP-153", "JP-156", "JP-161", "JP-154", "JP-155"];
/** The exact 2+2 exchange this phase owns: `[JP-153, JP-156]` and `[JP-161, JP-154]`. */
const OKINAWA_PAIR_SWAPPED = ["JP-202", "JP-161", "JP-154", "JP-153", "JP-156", "JP-155"];
/** The 74-minute order reached later, by a second explicit Phase 3E-E action. */
const OKINAWA_AFTER_RELOCATION = ["JP-202", "JP-161", "JP-156", "JP-154", "JP-153", "JP-155"];
const realDeps = {
  resolvePlace: (placeId: string) => getPlaceById(placeId) ?? null,
  lookupTransfer: getBestTransfer,
};
const realInput = (placeIds: readonly string[]) => ({
  routeIds: [...placeIds],
  days: [{ id: "d1", placeIds: [...placeIds] }],
  visitStartTimes: {},
});

describe("separation from earlier neighbourhoods (§33.63-80)", () => {
  const okinawa = () =>
    alternatives(generateEvidenceCompleteTwoPairBlockSwaps(realInput(OKINAWA), realDeps))[0];

  it("63. the exact 2+2 swap is never one Phase 3E-C adjacent swap", () => {
    const adjacent = [...IDS];
    [adjacent[1], adjacent[2]] = [adjacent[2], adjacent[1]];
    for (const alternative of alternatives(generate7())) {
      expect(alternative.candidateDayPlaceIds).not.toEqual(adjacent);
      const changed = alternative.baselineDayPlaceIds.filter(
        (placeId, index) => alternative.candidateDayPlaceIds[index] !== placeId
      );
      expect(changed).not.toHaveLength(2);
    }
  });
  it("64. the exact 2+2 swap is never one Phase 3E-E relocation", () => {
    // One relocation leaves the moved place's neighbours in their original relative order and moves
    // exactly one id past the others; the 2+2 swap moves two ids in each direction.
    for (const alternative of alternatives(generate7())) {
      const baseline = alternative.baselineDayPlaceIds;
      const relocations = baseline.flatMap((_place, fromIndex) =>
        baseline.map((_other, toIndex) => relocateOnePlace(baseline, fromIndex, toIndex))
      );
      expect(
        relocations.some(
          (order) => JSON.stringify(order) === JSON.stringify(alternative.candidateDayPlaceIds)
        )
      ).toBe(false);
    }
  });
  it("65. the exact 2+2 swap is never one Phase 3E-G transposition", () => {
    for (const alternative of alternatives(generate7())) {
      const baseline = alternative.baselineDayPlaceIds;
      const transpositions = baseline.flatMap((_place, leftIndex) =>
        baseline.map((_other, rightIndex) => transposeTwoPlaces(baseline, leftIndex, rightIndex))
      );
      expect(
        transpositions.some(
          (order) => JSON.stringify(order) === JSON.stringify(alternative.candidateDayPlaceIds)
        )
      ).toBe(false);
    }
  });
  it("66. the exact 2+2 swap is never one Phase 3E-I four-place reversal", () => {
    expect(reverseFourPlaces(IDS, 1)).toEqual(["l", "d", "c", "b", "a", "r"]);
    expect(swapAdjacentTwoPlaceBlocks(IDS, 1)).toEqual(SWAPPED);
    for (const alternative of alternatives(generate7())) {
      const baseline = alternative.baselineDayPlaceIds;
      const reversals = baseline.map((_place, start) => reverseFourPlaces(baseline, start));
      expect(
        reversals.some(
          (order) => JSON.stringify(order) === JSON.stringify(alternative.candidateDayPlaceIds)
        )
      ).toBe(false);
    }
  });
  it("67-70. candidate orders are defensively deduped against all four earlier groups", async () => {
    const component = await readFile(
      new URL("../components/OrderedSequenceBuilder.tsx", import.meta.url),
      "utf8"
    );
    const start = component.indexOf("const twoPairBlockSwapsByDayId = useMemo(");
    expect(start).toBeGreaterThan(-1);
    const memo = component.slice(start, component.indexOf("}, [", start));
    expect(memo).toContain("localSwapsByDayId.get(alternative.dayId)");
    expect(memo).toContain("localRelocationsByDayId.get(alternative.dayId)");
    expect(memo).toContain("interiorTranspositionsByDayId.get(alternative.dayId)");
    expect(memo).toContain("fourPlaceReversalsByDayId.get(alternative.dayId)");
    expect(memo).toContain("JSON.stringify(shown.candidateDayPlaceIds)");
    expect(memo).not.toMatch(/\.sort\(|guaranteedAdvantageMinutes/);
  });
  it("71. the real Okinawa baseline has no clearly-faster 3E-C candidate", () => {
    const swaps = generateEvidenceCompleteLocalSwaps(realInput(OKINAWA), realDeps);
    expect(swaps.kind === "available" ? swaps.alternatives : []).toHaveLength(0);
  });
  it("72. the same baseline has no clearly-faster 3E-E candidate", () => {
    const relocations = generateEvidenceCompleteLocalRelocations(realInput(OKINAWA), realDeps);
    expect(relocations.kind === "available" ? relocations.alternatives : []).toHaveLength(0);
  });
  it("73. the same baseline has no clearly-faster 3E-G candidate", () => {
    const transpositions = generateEvidenceCompleteInteriorTranspositions(
      realInput(OKINAWA),
      realDeps
    );
    expect(transpositions.kind === "available" ? transpositions.alternatives : []).toHaveLength(0);
  });
  it("74. the same baseline has no clearly-faster 3E-I candidate", () => {
    const reversals = generateEvidenceCompleteFourPlaceInteriorReversals(
      realInput(OKINAWA),
      realDeps
    );
    expect(reversals.kind === "available" ? reversals.alternatives : []).toHaveLength(0);
  });
  it("75. the same baseline has exactly one clearly-faster pair-block swap", () => {
    const generation = alternatives(
      generateEvidenceCompleteTwoPairBlockSwaps(realInput(OKINAWA), realDeps)
    );
    expect(generation).toHaveLength(1);
    expect(okinawa().candidateDayPlaceIds).toEqual(OKINAWA_PAIR_SWAPPED);
    expect(okinawa().hub).toBe("Okinawa");
    expect(okinawa().firstPairPlaceIds).toEqual(["JP-153", "JP-156"]);
    expect(okinawa().secondPairPlaceIds).toEqual(["JP-161", "JP-154"]);
    expect(okinawa().swappedWindowPlaceIds).toEqual(["JP-161", "JP-154", "JP-153", "JP-156"]);
  });
  it("76. the fixture baseline is 92 min", () => {
    expect(okinawa().baselineTransferMinutes).toEqual({ minMinutes: 92, maxMinutes: 92 });
  });
  it("77. the fixture candidate is 81 min", () => {
    expect(okinawa().candidateTransferMinutes).toEqual({ minMinutes: 81, maxMinutes: 81 });
  });
  it("78. the fixture minimum recorded-range gap is 11 min", () => {
    expect(okinawa().guaranteedAdvantageMinutes).toBe(11);
  });
  it("79. the fixture baseline has five validated-static edges", () => {
    expect(okinawa().baselineConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
  });
  it("80. the fixture candidate has five validated-static edges", () => {
    expect(okinawa().candidateConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
  });
});

/**
 * The continuation proof. Two explicit, independently evidenced user actions — never one atomic
 * 92 → 74 optimisation, and never an automatic second Apply.
 */
describe("continuation without automatic chaining (§33.81-90)", () => {
  const regeneratedRelocations = () => {
    const generation = generateEvidenceCompleteLocalRelocations(
      realInput(OKINAWA_PAIR_SWAPPED),
      realDeps
    );
    expect(generation.kind).toBe("available");
    return generation.kind === "available" ? generation.alternatives : [];
  };

  it("81. generation from the original baseline never emits the 74-minute three-position cycle", () => {
    for (const generation of [
      generateEvidenceCompleteTwoPairBlockSwaps(realInput(OKINAWA), realDeps),
      generateEvidenceCompleteLocalSwaps(realInput(OKINAWA), realDeps),
      generateEvidenceCompleteLocalRelocations(realInput(OKINAWA), realDeps),
      generateEvidenceCompleteInteriorTranspositions(realInput(OKINAWA), realDeps),
      generateEvidenceCompleteFourPlaceInteriorReversals(realInput(OKINAWA), realDeps),
    ]) {
      const emitted = generation.kind === "available" ? generation.alternatives : [];
      for (const alternative of emitted) {
        expect(alternative.candidateDayPlaceIds).not.toEqual(OKINAWA_AFTER_RELOCATION);
      }
    }
  });
  it("82. applying only the pair-block candidate yields exactly the 81-minute order", () => {
    const before: ManualPlanningDraftV7 = {
      version: 7,
      routeIds: [...OKINAWA],
      days: [
        {
          id: "d1",
          placeIds: [...OKINAWA],
          accommodationBoundary: {
            start: { kind: "unselected" },
            end: { kind: "unselected" },
          } as DayAccommodationBoundary,
        },
      ],
      startDate: null,
      endDate: null,
      visitStartTimes: {},
      accommodations: [],
      accommodationLegs: [],
      interHubSegments: [],
    };
    const alternative = alternatives(
      generateEvidenceCompleteTwoPairBlockSwaps(realInput(OKINAWA), realDeps)
    )[0];
    const result = applyEvidenceCompleteTwoPairBlockSwap(
      alternative,
      { routeIds: before.routeIds, days: before.days, visitStartTimes: before.visitStartTimes },
      { resolvePlace: (placeId) => getPlaceById(placeId) ?? null },
      (dayId, windowStartIndex) =>
        withTwoPairBlocksSwappedWithinDay(before, dayId, windowStartIndex)
    );
    expect(result.kind).toBe("applied");
    expect(result.kind === "applied" && result.draft.days?.[0].placeIds).toEqual(
      OKINAWA_PAIR_SWAPPED
    );
    expect(
      orderedSequenceFromLookup(OKINAWA_PAIR_SWAPPED, getBestTransfer).summary.transferMinutes
    ).toEqual({ minMinutes: 81, maxMinutes: 81 });
  });
  it("83. regenerating from the 81-minute order surfaces the existing 3E-E relocation", () => {
    expect(regeneratedRelocations()).toHaveLength(1);
  });
  it("84. the regenerated 3E-E candidate has the exact final order", () => {
    expect(regeneratedRelocations()[0].candidateDayPlaceIds).toEqual(OKINAWA_AFTER_RELOCATION);
    expect(regeneratedRelocations()[0].movedPlaceId).toBe("JP-156");
  });
  it("85. the regenerated 3E-E baseline is 81 min", () => {
    expect(regeneratedRelocations()[0].baselineTransferMinutes).toEqual({
      minMinutes: 81,
      maxMinutes: 81,
    });
  });
  it("86. the regenerated 3E-E candidate is 74 min", () => {
    expect(regeneratedRelocations()[0].candidateTransferMinutes).toEqual({
      minMinutes: 74,
      maxMinutes: 74,
    });
  });
  it("87. the regenerated 3E-E gap is 7 min", () => {
    expect(regeneratedRelocations()[0].guaranteedAdvantageMinutes).toBe(7);
  });
  it("88. the regenerated 3E-E comparison remains fully validated-static", () => {
    const relocation = regeneratedRelocations()[0];
    expect(relocation.baselineConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
    expect(relocation.candidateConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
  });
  it("89. the second move is never applied automatically", async () => {
    // Generating from the applied order produces the 3E-E candidate but mutates nothing: the pure
    // generator has no draft to write to, and the module never reaches for another neighbourhood.
    const snapshot = JSON.stringify(OKINAWA_PAIR_SWAPPED);
    regeneratedRelocations();
    expect(JSON.stringify(OKINAWA_PAIR_SWAPPED)).toBe(snapshot);
    const code = await moduleCode();
    expect(code).not.toMatch(
      /generateEvidenceCompleteLocalRelocations|applyEvidenceCompleteLocalRelocation/
    );
    const component = (await readFile(
      new URL("../components/OrderedSequenceBuilder.tsx", import.meta.url),
      "utf8"
    ))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const handlerStart = component.indexOf("function applyTwoPairBlockSwap");
    const handler = component.slice(handlerStart, component.indexOf("\n  }", handlerStart));
    expect(handler).not.toMatch(/applyLocalRelocation|applyLocalSwap|applyInteriorTransposition/);
    expect(component).not.toMatch(/useEffect\([^)]*applyTwoPairBlockSwap/);
  });
  it("90. no candidate and no UI claim combines both moves into one 18-minute step", async () => {
    const combinedDelta =
      orderedSequenceFromLookup(OKINAWA, getBestTransfer).summary.transferMinutes!.minMinutes -
      orderedSequenceFromLookup(OKINAWA_AFTER_RELOCATION, getBestTransfer).summary
        .transferMinutes!.minMinutes;
    expect(combinedDelta).toBe(18);
    const emitted = alternatives(
      generateEvidenceCompleteTwoPairBlockSwaps(realInput(OKINAWA), realDeps)
    );
    for (const alternative of emitted) {
      expect(alternative.guaranteedAdvantageMinutes).not.toBe(combinedDelta);
      expect(alternative.candidateDayPlaceIds).not.toEqual(OKINAWA_AFTER_RELOCATION);
    }
    const component = await readFile(
      new URL("../components/OrderedSequenceBuilder.tsx", import.meta.url),
      "utf8"
    );
    // Every rendered figure comes from one candidate's own comparison; nothing is summed.
    const start = component.indexOf("Intercambios de bloques de dos lugares");
    const group = component.slice(start, component.indexOf("</div>", start));
    expect(group).not.toMatch(/\+|reduce\(|totalAdvantage|18 min/);
  });
});

function boundary(): DayAccommodationBoundary {
  return { start: { kind: "unselected" }, end: { kind: "unselected" } } as DayAccommodationBoundary;
}

function planningDay(id: string, placeIds: string[], accommodationBoundary = boundary()): PlanningDayV5 {
  return { id, placeIds, accommodationBoundary };
}

function draft(overrides: Partial<ManualPlanningDraftV7> = {}): ManualPlanningDraftV7 {
  return {
    version: 7,
    routeIds: [...IDS],
    days: [planningDay("d1", [...IDS])],
    startDate: "2027-02-19",
    endDate: "2027-02-23",
    visitStartTimes: {},
    accommodations: [],
    accommodationLegs: [],
    interHubSegments: [],
    ...overrides,
  };
}

const DEFAULT_ALTERNATIVE = alternatives(generate())[0];

function applyTo(
  alternative: EvidenceCompleteTwoPairBlockSwapAlternative,
  current: ManualPlanningDraftV7,
  places = PLACES
) {
  return applyEvidenceCompleteTwoPairBlockSwap(
    alternative,
    { routeIds: current.routeIds, days: current.days, visitStartTimes: current.visitStartTimes },
    { resolvePlace: resolver(places) },
    (dayId, windowStartIndex) =>
      withTwoPairBlocksSwappedWithinDay(current, dayId, windowStartIndex)
  );
}

describe("Apply and stale safety (§33.91-111)", () => {
  it("91. generation alone mutates nothing", () => {
    const current = draft();
    const snapshot = JSON.stringify(current);
    generate();
    expect(JSON.stringify(current)).toBe(snapshot);
  });
  it("92. Apply requires an explicit call", () => {
    expect(applyTo(DEFAULT_ALTERNATIVE, draft()).kind).toBe("applied");
  });
  it("93. Apply produces the exact 2+2 block swap", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    expect(result.kind === "applied" && result.draft.days?.[0].placeIds).toEqual(SWAPPED);
  });
  it("94. indices outside the window remain unchanged", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    const after = result.draft.days?.[0].placeIds ?? [];
    expect(after[0]).toBe("l");
    expect(after[5]).toBe("r");
  });
  it("95. day id is unchanged", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    expect(result.kind === "applied" && result.draft.days?.[0].id).toBe("d1");
  });
  it("96. day membership is unchanged", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    expect([...(result.draft.days?.[0].placeIds ?? [])].sort()).toEqual([...IDS].sort());
  });
  it("97. routeIds are unchanged", () => {
    const before = draft();
    const result = applyTo(DEFAULT_ALTERNATIVE, before);
    expect(result.kind === "applied" && result.draft.routeIds).toBe(before.routeIds);
  });
  it("98. the accommodation boundary is unchanged", () => {
    const before = draft();
    const result = applyTo(DEFAULT_ALTERNATIVE, before);
    expect(result.kind === "applied" && result.draft.days?.[0].accommodationBoundary).toBe(
      before.days?.[0].accommodationBoundary
    );
  });
  it("99. all other days are unchanged", () => {
    const ids = [...IDS, "k"];
    const before = draft({
      routeIds: ids,
      days: [planningDay("d1", [...IDS]), planningDay("d2", ["k"])],
    });
    const result = applyEvidenceCompleteTwoPairBlockSwap(
      DEFAULT_ALTERNATIVE,
      { routeIds: ids, days: before.days, visitStartTimes: {} },
      { resolvePlace: resolver([...PLACES, place("k", "Kioto")]) },
      (dayId, windowStartIndex) =>
        withTwoPairBlocksSwappedWithinDay(before, dayId, windowStartIndex)
    );
    expect(result.kind === "applied" && result.draft.days?.[1]).toBe(before.days?.[1]);
  });
  it("100. a stale baseline is rejected", () => {
    expect(applyTo(DEFAULT_ALTERNATIVE, draft({ days: [planningDay("d1", SWAPPED)] }))).toEqual({
      kind: "stale",
      reason: "day-changed",
    });
  });
  it("101. a changed first-pair identity is rejected", () => {
    expect(
      applyTo({ ...DEFAULT_ALTERNATIVE, firstPairPlaceIds: ["a", "zz"] }, draft())
    ).toEqual({ kind: "stale", reason: "first-pair-changed" });
  });
  it("102. a changed second-pair identity is rejected", () => {
    expect(
      applyTo({ ...DEFAULT_ALTERNATIVE, secondPairPlaceIds: ["c", "zz"] }, draft())
    ).toEqual({ kind: "stale", reason: "second-pair-changed" });
  });
  it("103. a non-integer window start is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, windowStartDayIndex: 1.5 }, draft())).toEqual({
      kind: "stale",
      reason: "illegal-window",
    });
  });
  it("104. a window touching the block start is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, windowStartDayIndex: 0 }, draft())).toEqual({
      kind: "stale",
      reason: "illegal-window",
    });
  });
  it("105. a window touching the block end is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, windowStartDayIndex: 2 }, draft())).toEqual({
      kind: "stale",
      reason: "illegal-window",
    });
  });
  it("106. a changed block endpoint is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, blockEndPlaceId: "zz" }, draft())).toEqual({
      kind: "stale",
      reason: "block-changed",
    });
  });
  it("107. a changed block hub is rejected", () => {
    const places = [...IDS.slice(0, 5).map((id) => place(id)), place("r", "Kioto")];
    expect(applyTo(DEFAULT_ALTERNATIVE, draft(), places)).toEqual({
      kind: "stale",
      reason: "hub-changed",
    });
  });
  it("108. a mismatched captured candidate order is rejected", () => {
    // `[l, d, c, b, a, r]` is the Phase 3E-I reversal, not this phase's 2+2 exchange.
    expect(
      applyTo(
        { ...DEFAULT_ALTERNATIVE, candidateDayPlaceIds: ["l", "d", "c", "b", "a", "r"] },
        draft()
      )
    ).toEqual({ kind: "stale", reason: "block-changed" });
  });
  it("109. a mismatched captured affected set is rejected", () => {
    expect(
      applyTo({ ...DEFAULT_ALTERNATIVE, affectedPlaceIds: ["l", "a", "b", "c", "d", "zz"] }, draft())
    ).toEqual({ kind: "stale", reason: "day-changed" });
  });
  it("110. a newly timed affected place is rejected", () => {
    expect(applyTo(DEFAULT_ALTERNATIVE, draft({ visitStartTimes: { c: "09:00" } }))).toEqual({
      kind: "stale",
      reason: "manual-visit-time-added",
    });
  });
  it("111. a stale refusal performs no mutation", () => {
    const before = draft({ visitStartTimes: { c: "09:00" } });
    const snapshot = JSON.stringify(before);
    expect(applyTo(DEFAULT_ALTERNATIVE, before).kind).toBe("stale");
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("pure V7 mutation (§33.112-116)", () => {
  it("112. one pure mutation creates the final order", () => {
    expect(withTwoPairBlocksSwappedWithinDay(draft(), "d1", 1).days?.[0].placeIds).toEqual(SWAPPED);
    const before = draft();
    const after = withTwoPairBlocksSwappedWithinDay(before, "d1", 1);
    const changed = (before.days?.[0].placeIds ?? []).filter(
      (placeId, index) => after.days?.[0].placeIds[index] !== placeId
    );
    expect(changed).toHaveLength(4);
  });
  it("113. no intermediate order is exposed or persisted", async () => {
    const before = draft();
    const after = withTwoPairBlocksSwappedWithinDay(before, "d1", 1);
    expect(before.days?.[0].placeIds).toEqual(IDS);
    expect(after.days?.[0].placeIds).toEqual(SWAPPED);
    const domain = await readFile(new URL("./planning-draft-v7.ts", import.meta.url), "utf8");
    const mutation = domain.slice(
      domain.indexOf("export function withTwoPairBlocksSwappedWithinDay"),
      domain.indexOf("export function withPlaceMovedBetweenDays")
    );
    // Not a splice, not a rotation helper, and not any existing one-place mutation called four times.
    expect(mutation).not.toMatch(/splice\(|reverse\(|rotate/);
    expect(mutation).not.toMatch(/withPlaceRelocatedWithinDay|withPlaceMovedWithinDay/);
    expect(mutation).not.toMatch(/withPlacesTransposedWithinDay|withFourPlacesReversedWithinDay/);

    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    const start = hook.indexOf("const swapTwoPairBlocksWithinDay");
    const callback = hook.slice(start, hook.indexOf("\n  }, []);", start) + 9);
    expect(callback.match(/setDraft\(/g)).toHaveLength(1);
    expect(callback).toContain(
      "withTwoPairBlocksSwappedWithinDay(current, dayId, windowStartIndex)"
    );
    expect(callback).not.toMatch(/async|setTimeout/);
  });
  it("114. the draft stays V7 under the same storage key", () => {
    expect(withTwoPairBlocksSwappedWithinDay(draft(), "d1", 1).version).toBe(7);
    expect(PLANNING_DRAFT_VERSION).toBe(7);
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
  });
  it("115. every non-day field is preserved", () => {
    const before = draft({
      visitStartTimes: { z: "08:00" },
      accommodations: [{ id: "hotel", label: "Hotel", location: { lat: 26, lng: 127 } }],
      accommodationLegs: [],
      interHubSegments: [],
    });
    const after = withTwoPairBlocksSwappedWithinDay(before, "d1", 1);
    for (const key of [
      "routeIds",
      "visitStartTimes",
      "accommodations",
      "accommodationLegs",
      "interHubSegments",
    ] as const) {
      expect(after[key]).toBe(before[key]);
    }
    expect(after.startDate).toBe(before.startDate);
    expect(after.endDate).toBe(before.endDate);
  });
  it("116. unaffected day objects are preserved by identity", () => {
    const before = draft({
      routeIds: [...IDS, "k"],
      days: [planningDay("d1", [...IDS]), planningDay("d2", ["k"])],
    });
    expect(withTwoPairBlocksSwappedWithinDay(before, "d1", 1).days?.[1]).toBe(before.days?.[1]);
  });
});

describe("inter-hub invariants (§33.117)", () => {
  const ids = ["t0", "a", "b", "c", "d", "t5", "k0", "k1", "o0"];
  const places = ids.map((id) =>
    place(id, id.startsWith("k") ? "Kioto" : id.startsWith("o") ? "Osaka" : "Tokio")
  );
  const beforeDays = [planningDay("d1", ids.slice(0, 8)), planningDay("d2", ["o0"])];
  const afterDays = [
    planningDay("d1", ["t0", "c", "d", "a", "b", "t5", "k0", "k1"]),
    beforeDays[1],
  ];
  const segments: ManualInterHubSegment[] = [
    { id: "same", fromPlaceId: "t5", toPlaceId: "k0", fromHub: "Tokio", toHub: "Kioto", mode: "shinkansen", minutes: 140, source: { kind: "user-entered" } },
    { id: "between", fromPlaceId: "k1", toPlaceId: "o0", fromHub: "Kioto", toHub: "Osaka", mode: "limited-express", minutes: 30, source: { kind: "user-entered" } },
    { id: "inactive", fromPlaceId: "a", toPlaceId: "o0", fromHub: "Tokio", toHub: "Osaka", mode: "other", minutes: 180, source: { kind: "user-entered" } },
  ];
  const assess = (days: PlanningDayV5[]) =>
    segments.map((segment) =>
      assessInterHubSegment(segment, {
        routeIds: ids,
        days: days.map((entry) => entry.placeIds),
        resolvePlace: (id) => {
          const resolved = resolver(places)(id);
          return resolved ? { hub: resolved.hub } : null;
        },
      })
    );
  const before = draft({ routeIds: ids, days: beforeDays, interHubSegments: segments });
  const after = withTwoPairBlocksSwappedWithinDay(before, "d1", 1);

  it("117. stored segment objects, placement and every assessment are unchanged", () => {
    expect(after.interHubSegments).toBe(segments);
    expect(after.days?.[0].placeIds).toEqual(afterDays[0].placeIds);
    // Active same-day, active between-days and inactive-reason assessments, all pinned.
    expect(assess(afterDays)[0]).toEqual(assess(beforeDays)[0]);
    expect(assess(afterDays)[1]).toEqual(assess(beforeDays)[1]);
    expect(assess(afterDays)[2]).toEqual(assess(beforeDays)[2]);
    expect(assess(afterDays)).toEqual(assess(beforeDays));
  });
});

const HOTEL_LEGS: ManualAccommodationLeg[] = [
  { direction: "accommodation-to-place", accommodationId: "hotel", placeId: "l", minutes: 15, source: { kind: "user-entered" } },
  { direction: "place-to-accommodation", accommodationId: "hotel", placeId: "r", minutes: 20, source: { kind: "user-entered" } },
];
const HOTEL_BOUNDARY: DayAccommodationBoundary = {
  start: { kind: "accommodation", accommodationId: "hotel" } as AccommodationBoundaryChoice,
  end: { kind: "accommodation", accommodationId: "hotel" } as AccommodationBoundaryChoice,
};

function compose(dayPlaceIds: string[]): WholeTripComposition {
  const places = [...PLACES, place("k", "Kioto")];
  return buildWholeTripComposition(
    {
      routeIds: [...IDS, "k"],
      days: [
        { placeIds: dayPlaceIds, accommodationBoundary: HOTEL_BOUNDARY },
        { placeIds: ["k"], accommodationBoundary: boundary() },
      ],
      interHubSegments: [],
      accommodationLegs: HOTEL_LEGS,
      bounds: { startDate: "2027-02-19", endDate: "2027-02-20" },
    },
    { resolvePlace: resolver(places), lookupTransfer: lookupFrom(EDGES) }
  );
}

describe("accommodation and whole-trip invariants (§33.118-120)", () => {
  const before = compose(IDS);
  const after = compose(SWAPPED);
  const available = () => {
    if (before.kind !== "available" || after.kind !== "available") throw new Error("expected available");
    return { before, after };
  };

  it("118. accommodation boundary, legs and registered minutes are unchanged", () => {
    const values = available();
    expect(values.after.accommodation.components).toEqual(values.before.accommodation.components);
    expect(values.after.accommodation.registeredMinutes).toBe(
      values.before.accommodation.registeredMinutes
    );
    expect(values.after.accommodation.registeredMinutes).toBe(35);
    expect(values.after.accommodation).toEqual(values.before.accommodation);
  });
  it("119. visit, accommodation, inter-hub and bounds composition are unchanged", () => {
    const values = available();
    expect(values.after.visit).toEqual(values.before.visit);
    expect(values.after.accommodation).toEqual(values.before.accommodation);
    expect(values.after.interHub).toEqual(values.before.interHub);
    expect(values.after.bounds).toEqual(values.before.bounds);
    expect(values.after.dayCount).toBe(values.before.dayCount);
    expect([...SWAPPED].sort()).toEqual([...IDS].sort());
  });
  it("120. movement and registered transport change by the exact evidenced delta, with no missing edge", () => {
    const values = available();
    const delta =
      DEFAULT_ALTERNATIVE.baselineTransferMinutes.minMinutes -
      DEFAULT_ALTERNATIVE.candidateTransferMinutes.minMinutes;
    expect(delta).toBe(27);
    expect(
      values.before.movement.registeredMinutes!.minMinutes -
        values.after.movement.registeredMinutes!.minMinutes
    ).toBe(delta);
    expect(
      values.before.registeredTransportMinutes!.minMinutes -
        values.after.registeredTransportMinutes!.minMinutes
    ).toBe(delta);
    expect(
      values.before.registeredTransportMinutes!.maxMinutes -
        values.after.registeredTransportMinutes!.maxMinutes
    ).toBe(delta);
    expect(values.before.movement.localMissingCount).toBe(0);
    expect(values.after.movement.localMissingCount).toBe(0);
  });
});

function memoryStorage(): DraftStorage & { value: () => string | null } {
  let stored: string | null = null;
  return {
    getItem: () => stored,
    setItem: (_key, value) => {
      stored = value;
    },
    value: () => stored,
  };
}

describe("persistence (§33.121-122)", () => {
  const applied = withTwoPairBlocksSwappedWithinDay(draft(), "d1", 1);

  it("121. no candidate, window, pair, affected set, evidence, advantage, confidence, rank or score is persisted", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    const persisted = storage.value()?.toLowerCase() ?? "";
    for (const forbidden of [
      "candidate",
      "windowstart",
      "firstpair",
      "secondpair",
      "swappedwindow",
      "blockswap",
      "affected",
      "advantage",
      "evidence",
      "confidence",
      "rank",
      "score",
      "history",
      "optimis",
    ]) {
      expect(persisted).not.toContain(forbidden);
    }
    expect(JSON.parse(persisted === "" ? "{}" : storage.value()!).version).toBe(7);
  });
  it("122. reload preserves the applied 81-minute order and regenerates fresh local alternatives", () => {
    const okinawaApplied: ManualPlanningDraftV7 = {
      version: 7,
      routeIds: [...OKINAWA],
      days: [planningDay("d1", [...OKINAWA_PAIR_SWAPPED])],
      startDate: null,
      endDate: null,
      visitStartTimes: {},
      accommodations: [],
      accommodationLegs: [],
      interHubSegments: [],
    };
    const storage = memoryStorage();
    writeDraft(storage, okinawaApplied);
    const loaded = loadReconciledDraft(storage, okinawaApplied.routeIds);
    expect(loaded.version).toBe(7);
    expect(loaded.days?.[0].placeIds).toEqual(OKINAWA_PAIR_SWAPPED);
    expect(
      orderedSequenceFromLookup(loaded.days![0].placeIds, getBestTransfer).summary.transferMinutes
    ).toEqual({ minMinutes: 81, maxMinutes: 81 });

    const input = {
      routeIds: loaded.routeIds,
      days: loaded.days,
      visitStartTimes: loaded.visitStartTimes,
    };
    for (const generation of [
      generateEvidenceCompleteLocalSwaps(input, realDeps),
      generateEvidenceCompleteLocalRelocations(input, realDeps),
      generateEvidenceCompleteInteriorTranspositions(input, realDeps),
      generateEvidenceCompleteFourPlaceInteriorReversals(input, realDeps),
      generateEvidenceCompleteTwoPairBlockSwaps(input, realDeps),
    ]) {
      expect(generation.kind).toBe("available");
    }
    // The applied order is the new baseline, so this phase's own candidate is no longer proposed …
    const regeneratedSwaps = generateEvidenceCompleteTwoPairBlockSwaps(input, realDeps);
    expect(regeneratedSwaps.kind === "available" ? regeneratedSwaps.alternatives : []).toHaveLength(
      0
    );
    // … while the independently evidenced Phase 3E-E relocation is freshly derived from it.
    const regeneratedRelocations = generateEvidenceCompleteLocalRelocations(input, realDeps);
    const relocations =
      regeneratedRelocations.kind === "available" ? regeneratedRelocations.alternatives : [];
    expect(relocations).toHaveLength(1);
    expect(relocations[0].candidateDayPlaceIds).toEqual(OKINAWA_AFTER_RELOCATION);
  });
});

describe("pure helpers stay pure", () => {
  it("swapAdjacentTwoPlaceBlocks never mutates its input and neutralises an illegal window", () => {
    const values = [...IDS];
    expect(swapAdjacentTwoPlaceBlocks(values, 1)).toEqual(SWAPPED);
    expect(values).toEqual(IDS);
    expect(swapAdjacentTwoPlaceBlocks(values, -1)).toEqual(IDS);
    expect(swapAdjacentTwoPlaceBlocks(values, 1.5)).toEqual(IDS);
    expect(swapAdjacentTwoPlaceBlocks(values, 3)).toEqual(IDS);
    expect(swapAdjacentTwoPlaceBlocks(values, 99)).toEqual(IDS);
    // A seven-place array proves only the four window places move.
    expect(swapAdjacentTwoPlaceBlocks(["p0", "p1", "p2", "p3", "p4", "p5", "p6"], 1)).toEqual([
      "p0",
      "p3",
      "p4",
      "p1",
      "p2",
      "p5",
      "p6",
    ]);
  });
  it("the stale assessor returns coordinates without mutating its input", () => {
    const current = draft();
    const snapshot = JSON.stringify(current);
    expect(
      assessTwoPairBlockSwapApplicability(
        DEFAULT_ALTERNATIVE,
        { routeIds: current.routeIds, days: current.days, visitStartTimes: current.visitStartTimes },
        { resolvePlace: resolver() }
      )
    ).toEqual({ kind: "applicable", dayId: "d1", windowStartDayIndex: 1 });
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});
