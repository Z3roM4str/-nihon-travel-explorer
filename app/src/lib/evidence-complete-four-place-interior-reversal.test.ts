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
  withFourPlacesReversedWithinDay,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV7,
  type PlanningDayV5,
} from "./planning-draft-v7";
import {
  deriveSameHubBlocks,
  generateEvidenceCompleteLocalSwaps,
} from "./evidence-complete-local-swap";
import { generateEvidenceCompleteLocalRelocations } from "./evidence-complete-local-relocation";
import {
  generateEvidenceCompleteInteriorTranspositions,
  transposeTwoPlaces,
} from "./evidence-complete-interior-transposition";
import { orderedSequenceFromLookup } from "./ordered-sequence";
import { sequenceComparisonFromLookup } from "./sequence-comparison";
import { getBestTransfer, type TransferConfidence, type TransferEdge } from "./transfer";
import { buildWholeTripComposition, type WholeTripComposition } from "./whole-trip-composition";
import {
  affectedFourPlaceReversalPositions,
  applyEvidenceCompleteFourPlaceInteriorReversal,
  assessFourPlaceInteriorReversalApplicability,
  FOUR_PLACE_REVERSAL_WINDOW_LENGTH,
  generateEvidenceCompleteFourPlaceInteriorReversals,
  legalFourPlaceInteriorReversalWindows,
  reverseFourPlaces,
  type EvidenceCompleteFourPlaceInteriorReversalAlternative,
  type EvidenceCompleteFourPlaceInteriorReversalGeneration,
  type FourPlaceInteriorReversalDay,
} from "./evidence-complete-four-place-interior-reversal";

/* Phase 3E-I: the domain contracts 1-121 from design §31, numbered one-for-one below. */

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

function day(id: string, placeIds: string[]): FourPlaceInteriorReversalDay {
  return { id, placeIds };
}

/** `[l, a, b, c, d, r]` — the shortest block with exactly one legal four-place interior window. */
const IDS = ["l", "a", "b", "c", "d", "r"];
const PLACES = IDS.map((id) => place(id));
/** Baseline `l→a→b→c→d→r` totals 50; the reversal `l→d→c→b→a→r` totals 5. */
const EDGES = [
  transfer("l", "a", 10),
  transfer("a", "b", 10),
  transfer("b", "c", 10),
  transfer("c", "d", 10),
  transfer("d", "r", 10),
  transfer("l", "d", 1),
  transfer("d", "c", 1),
  transfer("c", "b", 1),
  transfer("b", "a", 1),
  transfer("a", "r", 1),
];
const REVERSED = ["l", "d", "c", "b", "a", "r"];

function generate(overrides: {
  routeIds?: string[];
  days?: FourPlaceInteriorReversalDay[] | null;
  places?: Place[];
  visitStartTimes?: Record<string, string>;
  edges?: TransferEdge[];
  lookupTransfer?: (fromId: string, toId: string) => TransferEdge | null;
} = {}): EvidenceCompleteFourPlaceInteriorReversalGeneration {
  const routeIds = overrides.routeIds ?? IDS;
  const days = overrides.days === undefined ? [day("d1", [...IDS])] : overrides.days;
  const places = overrides.places ?? PLACES;
  const byId = new Map(places.map((entry) => [entry.id, entry]));
  return generateEvidenceCompleteFourPlaceInteriorReversals(
    { routeIds, days, visitStartTimes: overrides.visitStartTimes ?? {} },
    {
      resolvePlace: (placeId) => byId.get(placeId) ?? null,
      lookupTransfer: overrides.lookupTransfer ?? lookupFrom(overrides.edges ?? EDGES),
    }
  );
}

function alternatives(
  generation: EvidenceCompleteFourPlaceInteriorReversalGeneration
): EvidenceCompleteFourPlaceInteriorReversalAlternative[] {
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
  return generateEvidenceCompleteFourPlaceInteriorReversals(
    { routeIds: IDS7, days: [day("d1", [...IDS7])], visitStartTimes },
    { resolvePlace: resolver(PLACES7), lookupTransfer: baselineHeavyLookup(IDS7) }
  );
}

describe("structural availability (§31.1-5)", () => {
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
    const source = await readFile(
      new URL("./evidence-complete-four-place-interior-reversal.ts", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/startDate|endDate|tripBounds/);
    expect(alternatives(generate())).toHaveLength(1);
  });
});

describe("same-hub block and enumeration (§31.6-25)", () => {
  it("6. maximal same-hub block semantics are imported from Phase 3E-C, not re-derived", async () => {
    const source = await readFile(
      new URL("./evidence-complete-four-place-interior-reversal.ts", import.meta.url),
      "utf8"
    );
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
  });
  it("10. a block shorter than six produces no reversal", () => {
    for (const length of [0, 1, 2, 3, 4, 5]) {
      expect(legalFourPlaceInteriorReversalWindows(length)).toHaveLength(0);
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
    for (const { windowStartIndex } of legalFourPlaceInteriorReversalWindows(10)) {
      expect(windowStartIndex).toBeGreaterThanOrEqual(1);
    }
  });
  it("13. every window end is interior", () => {
    const blockLength = 10;
    for (const { windowStartIndex } of legalFourPlaceInteriorReversalWindows(blockLength)) {
      expect(windowStartIndex + FOUR_PLACE_REVERSAL_WINDOW_LENGTH - 1).toBeLessThanOrEqual(
        blockLength - 2
      );
    }
  });
  it("14. exactly four consecutive positions are selected", () => {
    for (const alternative of alternatives(generate7())) {
      const positions = alternative.originalWindowPlaceIds.map((placeId) =>
        alternative.baselineDayPlaceIds.indexOf(placeId)
      );
      expect(positions).toHaveLength(4);
      expect(positions).toEqual([
        alternative.windowStartDayIndex,
        alternative.windowStartDayIndex + 1,
        alternative.windowStartDayIndex + 2,
        alternative.windowStartDayIndex + 3,
      ]);
    }
  });
  it("15. a window of two is never generated — that remains Phase 3E-C", () => {
    for (const alternative of alternatives(generate7())) {
      expect(alternative.originalWindowPlaceIds).toHaveLength(4);
      const changed = alternative.baselineDayPlaceIds.filter(
        (placeId, index) => alternative.candidateDayPlaceIds[index] !== placeId
      );
      expect(changed).toHaveLength(4);
    }
  });
  it("16. a window of three is never generated — that remains Phase 3E-G", () => {
    for (const alternative of alternatives(generate7())) {
      const changed = alternative.baselineDayPlaceIds.filter(
        (placeId, index) => alternative.candidateDayPlaceIds[index] !== placeId
      );
      expect(changed).not.toHaveLength(3);
      expect(changed).not.toHaveLength(2);
    }
  });
  it("17. a window longer than four is never generated", () => {
    expect(FOUR_PLACE_REVERSAL_WINDOW_LENGTH).toBe(4);
    const values = ["p0", "p1", "p2", "p3", "p4", "p5", "p6"];
    // Position 5 is untouched by a window starting at 1: only four places ever move.
    expect(reverseFourPlaces(values, 1)).toEqual(["p0", "p4", "p3", "p2", "p1", "p5", "p6"]);
  });
  it("18. exactly the four selected ids reverse", () => {
    const alternative = alternatives(generate())[0];
    expect(alternative.originalWindowPlaceIds).toEqual(["a", "b", "c", "d"]);
    expect(alternative.reversedWindowPlaceIds).toEqual(["d", "c", "b", "a"]);
    expect(alternative.candidateBlockPlaceIds).toEqual(REVERSED);
  });
  it("19. every id outside the window stays at the same index", () => {
    for (const alternative of alternatives(generate7())) {
      const { windowStartDayIndex: start } = alternative;
      alternative.baselineDayPlaceIds.forEach((placeId, index) => {
        if (index >= start && index <= start + 3) return;
        expect(alternative.candidateDayPlaceIds[index]).toBe(placeId);
      });
    }
  });
  it("20. candidate orders are unique", () => {
    const orders = alternatives(generate7()).map((entry) =>
      JSON.stringify(entry.candidateDayPlaceIds)
    );
    expect(new Set(orders).size).toBe(orders.length);
  });
  it("21. order is day, then block, then window start ascending", () => {
    expect(alternatives(generate7()).map((entry) => entry.windowStartDayIndex)).toEqual([1, 2]);
  });
  it("22. candidate count equals n - 5", () => {
    for (let n = 0; n <= 14; n += 1) {
      expect(legalFourPlaceInteriorReversalWindows(n)).toHaveLength(Math.max(0, n - 5));
    }
  });
  it("23. the source documents the candidate count as O(n)", async () => {
    const source = await readFile(
      new URL("./evidence-complete-four-place-interior-reversal.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("`n - 5`");
    expect(source).toContain("candidate count");
  });
  it("24. total evaluation is not misclaimed as O(n)", async () => {
    const source = await readFile(
      new URL("./evidence-complete-four-place-interior-reversal.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("O(n²)");
    expect(source).not.toMatch(/total runtime is O\(n\)/);
    expect(source).not.toMatch(/total .{0,20}evaluation .{0,20}O\(n\)[^²]/);
  });
  it("25. there is no recursion or candidate chaining", async () => {
    const source = await readFile(
      new URL("./evidence-complete-four-place-interior-reversal.ts", import.meta.url),
      "utf8"
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    // The generator's own body never calls itself, so no candidate can seed another pass.
    const generatorStart = code.indexOf("export function generateEvidenceCompleteFourPlaceInteriorReversals");
    const body = code.slice(code.indexOf("{", code.indexOf("Generation {", generatorStart)));
    expect(body).not.toContain("generateEvidenceCompleteFourPlaceInteriorReversals");
    // Every candidate is built from the current baseline block, never from another candidate.
    expect(code.match(/reverseFourPlaces\(/g)?.length).toBeGreaterThan(0);
    expect(code).not.toMatch(/reverseFourPlaces\(\s*candidate/);
    expect(code).not.toMatch(/\bwhile\s*\(|\bdo\s*\{/);
  });
});

describe("temporal lock (§31.26-38)", () => {
  const target = (visitStartTimes: Record<string, string>) =>
    alternatives(generate({ visitStartTimes }))[0];
  const affected = () => alternatives(generate())[0].affectedPlaceIds;

  it("26. the affected set begins at the window predecessor", () => {
    expect(affectedFourPlaceReversalPositions(1)[0]).toBe(0);
    expect(affected()[0]).toBe("l");
  });
  it("27. the affected set contains all four reversed places", () => {
    for (const placeId of ["a", "b", "c", "d"]) expect(affected()).toContain(placeId);
  });
  it("28. the affected set ends at the window successor", () => {
    expect(affectedFourPlaceReversalPositions(1).at(-1)).toBe(5);
    expect(affected().at(-1)).toBe("r");
  });
  it("29. the exact affected size is six", () => {
    expect(affectedFourPlaceReversalPositions(1)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(affectedFourPlaceReversalPositions(4)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(affected()).toHaveLength(6);
  });
  it("30. a time on the predecessor blocks", () => expect(target({ l: "08:00" })).toBeUndefined());
  it("31. a time on the first reversed place blocks", () => expect(target({ a: "09:00" })).toBeUndefined());
  it("32. a time on the second reversed place blocks", () => expect(target({ b: "10:00" })).toBeUndefined());
  it("33. a time on the third reversed place blocks", () => expect(target({ c: "11:00" })).toBeUndefined());
  it("34. a time on the fourth reversed place blocks", () => expect(target({ d: "12:00" })).toBeUndefined());
  it("35. a time on the successor blocks", () => expect(target({ r: "13:00" })).toBeUndefined());
  it("36. a timed place outside the six-place window does not block", () => {
    // Window 1..4 of the seven-place block leaves `r` (index 6) outside its affected set.
    const kept = alternatives(generate7({ r: "10:00" }));
    expect(kept.some((entry) => entry.windowStartDayIndex === 1)).toBe(true);
    expect(kept.some((entry) => entry.windowStartDayIndex === 2)).toBe(false);
    expect(alternatives(generate7()).length).toBeGreaterThan(kept.length);
  });
  it("37. a timed place elsewhere in the day does not block", () => {
    const ids = [...IDS, "x"];
    const generation = generate({
      routeIds: ids,
      days: [day("d1", ids)],
      places: [...PLACES, place("x", "Kioto")],
      visitStartTimes: { x: "12:00" },
    });
    expect(alternatives(generation)).toHaveLength(1);
  });
  it("38. generation never edits, moves or infers a visit start time", () => {
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

describe("evidence gates (§31.39-46)", () => {
  it("39. a complete baseline is required", () => {
    expect(orderedSequenceFromLookup(IDS, lookupFrom(EDGES)).summary.complete).toBe(true);
    expect(alternatives(generate())).toHaveLength(1);
  });
  it("40. one missing baseline edge blocks the whole block", () => {
    expect(
      alternatives(
        generate({ edges: EDGES.filter((edge) => !(edge.fromId === "b" && edge.toId === "c")) })
      )
    ).toHaveLength(0);
  });
  it("41. a reverse or chained edge never repairs a baseline", () => {
    const withoutForward = EDGES.filter((edge) => !(edge.fromId === "c" && edge.toId === "d"));
    expect(withoutForward.some((edge) => edge.fromId === "d" && edge.toId === "c")).toBe(true);
    expect(alternatives(generate({ edges: withoutForward }))).toHaveLength(0);
  });
  it("42. a complete candidate is required", () => {
    expect(alternatives(generate())[0].candidateBlockPlaceIds).toEqual(REVERSED);
  });
  it("43. one missing candidate edge discards that candidate", () => {
    expect(
      alternatives(
        generate({ edges: EDGES.filter((edge) => !(edge.fromId === "l" && edge.toId === "d")) })
      )
    ).toHaveLength(0);
  });
  it("44. no geometry or network fallback exists in the module", async () => {
    const source = await readFile(
      new URL("./evidence-complete-four-place-interior-reversal.ts", import.meta.url),
      "utf8"
    );
    // Scan the executable code only: the doc comment is allowed to *name* what is forbidden.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
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
  it("45. every reversed internal direction must itself be recorded", () => {
    // The reversal flips `c→d` into `d→c`, `b→c` into `c→b` and `a→b` into `b→a`. Dropping any one
    // reversed direction must discard the candidate, even though its forward twin still exists.
    for (const [fromId, toId] of [["d", "c"], ["c", "b"], ["b", "a"]]) {
      const edges = EDGES.filter((edge) => !(edge.fromId === fromId && edge.toId === toId));
      expect(edges.some((edge) => edge.fromId === toId && edge.toId === fromId)).toBe(true);
      expect(alternatives(generate({ edges }))).toHaveLength(0);
    }
  });
  it("46. no synthetic symmetry is applied", () => {
    const edges = EDGES.filter((edge) => !(edge.fromId === "d" && edge.toId === "c"));
    const lookup = lookupFrom(edges);
    expect(lookup("c", "d")).not.toBeNull();
    expect(lookup("d", "c")).toBeNull();
    expect(alternatives(generate({ edges }))).toHaveLength(0);
  });
});

describe("comparison and confidence (§31.47-56)", () => {
  it("47. a b-clearly-faster candidate is emitted", () => {
    const alternative = alternatives(generate())[0];
    expect(alternative.baselineTransferMinutes).toEqual({ minMinutes: 50, maxMinutes: 50 });
    expect(alternative.candidateTransferMinutes).toEqual({ minMinutes: 5, maxMinutes: 5 });
  });
  it("48. an equivalent range is rejected", () => {
    expect(alternatives(generate({ lookupTransfer: () => transfer("x", "y", 10) }))).toHaveLength(0);
  });
  it("49. an overlapping range is rejected", () => {
    const lookup = (fromId: string, toId: string) =>
      fromId === "l" && toId === "d" ? transfer(fromId, toId, 1, 100) : transfer(fromId, toId, 10);
    expect(alternatives(generate({ lookupTransfer: lookup }))).toHaveLength(0);
  });
  it("50. a faster baseline is rejected", () => {
    const baselinePairs = ["l>a", "a>b", "b>c", "c>d", "d>r"];
    const lookup = (fromId: string, toId: string) =>
      transfer(fromId, toId, baselinePairs.includes(`${fromId}>${toId}`) ? 1 : 100);
    expect(alternatives(generate({ lookupTransfer: lookup }))).toHaveLength(0);
  });
  it("51. an incomplete comparison is rejected", () => {
    expect(alternatives(generate({ lookupTransfer: () => null }))).toHaveLength(0);
  });
  it("52. the existing Phase 3C-B advantage arithmetic is reused unchanged", () => {
    const alternative = alternatives(generate())[0];
    const comparison = sequenceComparisonFromLookup(IDS, REVERSED, lookupFrom(EDGES));
    expect(alternative.guaranteedAdvantageMinutes).toBe(comparison.guaranteedAdvantageMinutes);
    expect(alternative.possibleAdvantageRange).toEqual(comparison.possibleAdvantageRange);
    expect(alternative.guaranteedAdvantageMinutes).toBe(45);
  });
  it("53. the baseline confidence tally is preserved", () => {
    expect(alternatives(generate())[0].baselineConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
  });
  it("54. the candidate confidence tally is preserved", () => {
    expect(alternatives(generate())[0].candidateConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
  });
  it("55. estimated evidence remains visibly estimated", () => {
    const estimated = EDGES.map((edge) =>
      transfer(edge.fromId, edge.toId, edge.minutes.minMinutes, edge.minutes.maxMinutes, "estimated")
    );
    const alternative = alternatives(generate({ edges: estimated }))[0];
    expect(alternative.baselineConfidenceCounts.estimated).toBe(5);
    expect(alternative.candidateConfidenceCounts.estimated).toBe(5);
    expect(alternative.baselineConfidenceCounts.validatedStatic).toBe(0);
  });
  it("56. confidence produces no score, rank or winner field", () => {
    const alternative = alternatives(generate())[0];
    for (const forbidden of ["score", "rank", "best", "recommended", "winner", "grade"]) {
      expect(Object.keys(alternative)).not.toContain(forbidden);
    }
  });
});

describe("separation from earlier neighbourhoods (§31.57-73)", () => {
  const OKINAWA = ["JP-202", "JP-153", "JP-155", "JP-156", "JP-161", "JP-154"];
  const OKINAWA_REVERSED = ["JP-202", "JP-161", "JP-156", "JP-155", "JP-153", "JP-154"];
  const realDeps = {
    resolvePlace: (placeId: string) => getPlaceById(placeId) ?? null,
    lookupTransfer: getBestTransfer,
  };
  const realInput = {
    routeIds: OKINAWA,
    days: [{ id: "d1", placeIds: OKINAWA }],
    visitStartTimes: {},
  };
  const okinawa = () =>
    alternatives(generateEvidenceCompleteFourPlaceInteriorReversals(realInput, realDeps))[0];

  it("57. a two-place reversal is exactly one Phase 3E-C adjacent swap, never emitted here", () => {
    const twoPlaceReversal = ["l", "b", "a", "c", "d", "r"];
    const adjacentSwap = [...IDS];
    [adjacentSwap[1], adjacentSwap[2]] = [adjacentSwap[2], adjacentSwap[1]];
    expect(adjacentSwap).toEqual(twoPlaceReversal);
    for (const alternative of alternatives(generate7())) {
      expect(alternative.candidateDayPlaceIds).not.toEqual(twoPlaceReversal);
    }
  });
  it("58. a three-place reversal is exactly one Phase 3E-G transposition, never emitted here", () => {
    // `A B C → C B A` is the transposition of the first and third places.
    expect(transposeTwoPlaces(IDS, 1, 3)).toEqual(["l", "c", "b", "a", "d", "r"]);
    for (const alternative of alternatives(generate7())) {
      const changed = alternative.baselineDayPlaceIds.filter(
        (placeId, index) => alternative.candidateDayPlaceIds[index] !== placeId
      );
      expect(changed).toHaveLength(4);
    }
  });
  it("59-61. the four-place reversal is distinct from 3E-C, 3E-E and 3E-G output", () => {
    const input = { routeIds: IDS7, days: [day("d1", [...IDS7])], visitStartTimes: {} };
    const deps = { resolvePlace: resolver(PLACES7), lookupTransfer: baselineHeavyLookup(IDS7) };
    const earlier = [
      generateEvidenceCompleteLocalSwaps(input, deps),
      generateEvidenceCompleteLocalRelocations(input, deps),
      generateEvidenceCompleteInteriorTranspositions(input, deps),
    ];
    const earlierOrders = new Set<string>();
    for (const generation of earlier) {
      expect(generation.kind).toBe("available");
      if (generation.kind !== "available") continue;
      expect(generation.alternatives.length).toBeGreaterThan(0);
      for (const entry of generation.alternatives) {
        earlierOrders.add(JSON.stringify(entry.candidateDayPlaceIds));
      }
    }
    for (const alternative of alternatives(generate7())) {
      expect(earlierOrders.has(JSON.stringify(alternative.candidateDayPlaceIds))).toBe(false);
    }
  });
  it("62-64. candidate orders are defensively deduped against all three earlier groups", async () => {
    const component = await readFile(
      new URL("../components/OrderedSequenceBuilder.tsx", import.meta.url),
      "utf8"
    );
    const start = component.indexOf("const fourPlaceReversalsByDayId = useMemo(");
    const memo = component.slice(start, component.indexOf("}, [", start));
    expect(memo).toContain("localSwapsByDayId.get(alternative.dayId)");
    expect(memo).toContain("localRelocationsByDayId.get(alternative.dayId)");
    expect(memo).toContain("interiorTranspositionsByDayId.get(alternative.dayId)");
    expect(memo).toContain("JSON.stringify(shown.candidateDayPlaceIds)");
    expect(memo).not.toMatch(/\.sort\(|guaranteedAdvantageMinutes/);
  });
  it("65. the real Okinawa baseline has no clearly-faster 3E-C candidate", () => {
    const swaps = generateEvidenceCompleteLocalSwaps(realInput, realDeps);
    expect(swaps.kind === "available" ? swaps.alternatives : []).toHaveLength(0);
  });
  it("66. the same baseline has no clearly-faster 3E-E candidate", () => {
    const relocations = generateEvidenceCompleteLocalRelocations(realInput, realDeps);
    expect(relocations.kind === "available" ? relocations.alternatives : []).toHaveLength(0);
  });
  it("67. the same baseline has no clearly-faster 3E-G candidate", () => {
    const transpositions = generateEvidenceCompleteInteriorTranspositions(realInput, realDeps);
    expect(transpositions.kind === "available" ? transpositions.alternatives : []).toHaveLength(0);
  });
  it("68. the same baseline has a clearly-faster four-place reversal", () => {
    expect(okinawa().candidateDayPlaceIds).toEqual(OKINAWA_REVERSED);
    expect(okinawa().hub).toBe("Okinawa");
    expect(okinawa().originalWindowPlaceIds).toEqual(["JP-153", "JP-155", "JP-156", "JP-161"]);
    expect(okinawa().reversedWindowPlaceIds).toEqual(["JP-161", "JP-156", "JP-155", "JP-153"]);
  });
  it("69. the fixture baseline is 91 min", () => {
    expect(okinawa().baselineTransferMinutes).toEqual({ minMinutes: 91, maxMinutes: 91 });
  });
  it("70. the fixture candidate is 72 min", () => {
    expect(okinawa().candidateTransferMinutes).toEqual({ minMinutes: 72, maxMinutes: 72 });
  });
  it("71. the fixture minimum recorded-range gap is 19 min", () => {
    expect(okinawa().guaranteedAdvantageMinutes).toBe(19);
  });
  it("72. the fixture baseline has five validated-static edges", () => {
    expect(okinawa().baselineConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
  });
  it("73. the fixture candidate has five validated-static edges", () => {
    expect(okinawa().candidateConfidenceCounts).toEqual({
      validatedStatic: 5,
      estimated: 0,
      scheduleAware: 0,
    });
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
  alternative: EvidenceCompleteFourPlaceInteriorReversalAlternative,
  current: ManualPlanningDraftV7,
  places = PLACES
) {
  return applyEvidenceCompleteFourPlaceInteriorReversal(
    alternative,
    { routeIds: current.routeIds, days: current.days, visitStartTimes: current.visitStartTimes },
    { resolvePlace: resolver(places) },
    (dayId, windowStartIndex) =>
      withFourPlacesReversedWithinDay(current, dayId, windowStartIndex)
  );
}

describe("Apply and stale safety (§31.74-93)", () => {
  it("74. generation alone mutates nothing", () => {
    const current = draft();
    const snapshot = JSON.stringify(current);
    generate();
    expect(JSON.stringify(current)).toBe(snapshot);
  });
  it("75. Apply requires an explicit call", () => {
    expect(applyTo(DEFAULT_ALTERNATIVE, draft()).kind).toBe("applied");
  });
  it("76. Apply produces the exact four-place reversal", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    expect(result.kind === "applied" && result.draft.days?.[0].placeIds).toEqual(REVERSED);
  });
  it("77. indices outside the window remain unchanged", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    const after = result.draft.days?.[0].placeIds ?? [];
    expect(after[0]).toBe("l");
    expect(after[5]).toBe("r");
  });
  it("78. day id is unchanged", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    expect(result.kind === "applied" && result.draft.days?.[0].id).toBe("d1");
  });
  it("79. day membership is unchanged", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    expect([...(result.draft.days?.[0].placeIds ?? [])].sort()).toEqual([...IDS].sort());
  });
  it("80. routeIds are unchanged", () => {
    const before = draft();
    const result = applyTo(DEFAULT_ALTERNATIVE, before);
    expect(result.kind === "applied" && result.draft.routeIds).toBe(before.routeIds);
  });
  it("81. the accommodation boundary is unchanged", () => {
    const before = draft();
    const result = applyTo(DEFAULT_ALTERNATIVE, before);
    expect(result.kind === "applied" && result.draft.days?.[0].accommodationBoundary).toBe(
      before.days?.[0].accommodationBoundary
    );
  });
  it("82. all other days are unchanged", () => {
    const ids = [...IDS, "k"];
    const before = draft({
      routeIds: ids,
      days: [planningDay("d1", [...IDS]), planningDay("d2", ["k"])],
    });
    const result = applyEvidenceCompleteFourPlaceInteriorReversal(
      DEFAULT_ALTERNATIVE,
      { routeIds: ids, days: before.days, visitStartTimes: {} },
      { resolvePlace: resolver([...PLACES, place("k", "Kioto")]) },
      (dayId, windowStartIndex) =>
        withFourPlacesReversedWithinDay(before, dayId, windowStartIndex)
    );
    expect(result.kind === "applied" && result.draft.days?.[1]).toBe(before.days?.[1]);
  });
  it("83. a stale baseline is rejected", () => {
    expect(applyTo(DEFAULT_ALTERNATIVE, draft({ days: [planningDay("d1", REVERSED)] }))).toEqual({
      kind: "stale",
      reason: "day-changed",
    });
  });
  it("84. a changed window identity is rejected", () => {
    expect(
      applyTo({ ...DEFAULT_ALTERNATIVE, originalWindowPlaceIds: ["a", "b", "c", "zz"] }, draft())
    ).toEqual({ kind: "stale", reason: "window-changed" });
  });
  it("85. a non-integer window start is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, windowStartDayIndex: 1.5 }, draft())).toEqual({
      kind: "stale",
      reason: "illegal-window",
    });
  });
  it("86. a window touching the block start is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, windowStartDayIndex: 0 }, draft())).toEqual({
      kind: "stale",
      reason: "illegal-window",
    });
  });
  it("87. a window touching the block end is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, windowStartDayIndex: 2 }, draft())).toEqual({
      kind: "stale",
      reason: "illegal-window",
    });
  });
  it("88. a changed block endpoint is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, blockEndPlaceId: "zz" }, draft())).toEqual({
      kind: "stale",
      reason: "block-changed",
    });
  });
  it("89. a changed block hub is rejected", () => {
    const places = [...IDS.slice(0, 5).map((id) => place(id)), place("r", "Kioto")];
    expect(applyTo(DEFAULT_ALTERNATIVE, draft(), places)).toEqual({
      kind: "stale",
      reason: "hub-changed",
    });
  });
  it("90. a mismatched captured candidate order is rejected", () => {
    expect(
      applyTo({ ...DEFAULT_ALTERNATIVE, candidateDayPlaceIds: ["l", "c", "d", "b", "a", "r"] }, draft())
    ).toEqual({ kind: "stale", reason: "block-changed" });
  });
  it("91. a mismatched captured affected set is rejected", () => {
    expect(
      applyTo({ ...DEFAULT_ALTERNATIVE, affectedPlaceIds: ["l", "a", "b", "c", "d", "zz"] }, draft())
    ).toEqual({ kind: "stale", reason: "day-changed" });
  });
  it("92. a newly timed affected place is rejected", () => {
    expect(applyTo(DEFAULT_ALTERNATIVE, draft({ visitStartTimes: { c: "09:00" } }))).toEqual({
      kind: "stale",
      reason: "manual-visit-time-added",
    });
  });
  it("93. a stale refusal performs no mutation", () => {
    const before = draft({ visitStartTimes: { c: "09:00" } });
    const snapshot = JSON.stringify(before);
    expect(applyTo(DEFAULT_ALTERNATIVE, before).kind).toBe("stale");
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("pure V7 mutation (§31.94-101)", () => {
  it("94. one pure mutation creates the final order", () => {
    expect(withFourPlacesReversedWithinDay(draft(), "d1", 1).days?.[0].placeIds).toEqual(REVERSED);
  });
  it("95. exactly four ids reverse", () => {
    const before = draft();
    const after = withFourPlacesReversedWithinDay(before, "d1", 1);
    const changed = (before.days?.[0].placeIds ?? []).filter(
      (placeId, index) => after.days?.[0].placeIds[index] !== placeId
    );
    expect(changed).toHaveLength(4);
  });
  it("96. no splice-based relocation semantics are used", async () => {
    const domain = await readFile(new URL("./planning-draft-v7.ts", import.meta.url), "utf8");
    const mutation = domain.slice(
      domain.indexOf("export function withFourPlacesReversedWithinDay"),
      domain.indexOf("export function withPlaceMovedBetweenDays")
    );
    expect(mutation).not.toMatch(/splice\(|reverse\(/);
    expect(mutation).not.toMatch(/withPlaceRelocatedWithinDay|withPlaceMovedWithinDay/);
  });
  it("97. the hook performs exactly one draft write", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    const start = hook.indexOf("const reverseFourPlacesWithinDay");
    const callback = hook.slice(start, hook.indexOf("\n  }, []);", start) + 9);
    expect(callback.match(/setDraft\(/g)).toHaveLength(1);
    expect(callback).toContain("withFourPlacesReversedWithinDay(current, dayId, windowStartIndex)");
    expect(callback).not.toMatch(/async|setTimeout/);
  });
  it("98. no intermediate order is exposed or persisted", () => {
    const before = draft();
    const after = withFourPlacesReversedWithinDay(before, "d1", 1);
    expect(before.days?.[0].placeIds).toEqual(IDS);
    expect(after.days?.[0].placeIds).toEqual(REVERSED);
  });
  it("99. the draft stays V7", () => {
    expect(withFourPlacesReversedWithinDay(draft(), "d1", 1).version).toBe(7);
    expect(PLANNING_DRAFT_VERSION).toBe(7);
  });
  it("100. every non-day field is preserved", () => {
    const before = draft({
      visitStartTimes: { z: "08:00" },
      accommodations: [{ id: "hotel", label: "Hotel", location: { lat: 26, lng: 127 } }],
      accommodationLegs: [],
      interHubSegments: [],
    });
    const after = withFourPlacesReversedWithinDay(before, "d1", 1);
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
  it("101. unaffected day objects are preserved by identity", () => {
    const before = draft({
      routeIds: [...IDS, "k"],
      days: [planningDay("d1", [...IDS]), planningDay("d2", ["k"])],
    });
    expect(withFourPlacesReversedWithinDay(before, "d1", 1).days?.[1]).toBe(before.days?.[1]);
  });
});

describe("inter-hub invariants (§31.102-105)", () => {
  const ids = ["t0", "a", "b", "c", "d", "t5", "k0", "k1", "o0"];
  const places = ids.map((id) =>
    place(id, id.startsWith("k") ? "Kioto" : id.startsWith("o") ? "Osaka" : "Tokio")
  );
  const beforeDays = [planningDay("d1", ids.slice(0, 8)), planningDay("d2", ["o0"])];
  const afterDays = [
    planningDay("d1", ["t0", "d", "c", "b", "a", "t5", "k0", "k1"]),
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
  const after = withFourPlacesReversedWithinDay(before, "d1", 1);

  it("102. stored segment objects remain byte-identical", () => {
    expect(after.interHubSegments).toBe(segments);
    expect(after.days?.[0].placeIds).toEqual(afterDays[0].placeIds);
  });
  it("103. the active same-day assessment is unchanged", () => {
    expect(assess(afterDays)[0]).toEqual(assess(beforeDays)[0]);
  });
  it("104. the active between-days assessment is unchanged", () => {
    expect(assess(afterDays)[1]).toEqual(assess(beforeDays)[1]);
  });
  it("105. the inactive reason is unchanged", () => {
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

describe("accommodation and whole-trip invariants (§31.106-115)", () => {
  const before = compose(IDS);
  const after = compose(REVERSED);
  const available = () => {
    if (before.kind !== "available" || after.kind !== "available") throw new Error("expected available");
    return { before, after };
  };

  it("106. the accommodation boundary assessment is unchanged", () => {
    expect(available().after.accommodation.components).toEqual(
      available().before.accommodation.components
    );
  });
  it("107. registered accommodation minutes are unchanged", () => {
    const values = available();
    expect(values.after.accommodation.registeredMinutes).toBe(
      values.before.accommodation.registeredMinutes
    );
    expect(values.after.accommodation.registeredMinutes).toBe(35);
  });
  it("108. visit composition is unchanged", () => {
    expect(available().after.visit).toEqual(available().before.visit);
  });
  it("109. accommodation composition is unchanged", () => {
    expect(available().after.accommodation).toEqual(available().before.accommodation);
  });
  it("110. inter-hub composition is unchanged", () => {
    expect(available().after.interHub).toEqual(available().before.interHub);
  });
  it("111. bounds composition is unchanged", () => {
    expect(available().after.bounds).toEqual(available().before.bounds);
  });
  it("112. day count, membership and dates are unchanged", () => {
    const values = available();
    expect(values.after.dayCount).toBe(values.before.dayCount);
    expect([...REVERSED].sort()).toEqual([...IDS].sort());
  });
  it("113. local registered movement changes by the exact evidenced delta", () => {
    const values = available();
    const delta =
      DEFAULT_ALTERNATIVE.baselineTransferMinutes.minMinutes -
      DEFAULT_ALTERNATIVE.candidateTransferMinutes.minMinutes;
    expect(delta).toBe(45);
    expect(
      values.before.movement.registeredMinutes!.minMinutes -
        values.after.movement.registeredMinutes!.minMinutes
    ).toBe(delta);
  });
  it("114. registered transport changes by the same delta", () => {
    const values = available();
    expect(
      values.before.registeredTransportMinutes!.minMinutes -
        values.after.registeredTransportMinutes!.minMinutes
    ).toBe(45);
    expect(
      values.before.registeredTransportMinutes!.maxMinutes -
        values.after.registeredTransportMinutes!.maxMinutes
    ).toBe(45);
  });
  it("115. no local missing edge is introduced", () => {
    const values = available();
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

describe("persistence (§31.116-121)", () => {
  const applied = withFourPlacesReversedWithinDay(draft(), "d1", 1);
  it("116. the persisted draft remains V7", () => expect(applied.version).toBe(7));
  it("117. the existing storage key is reused", () => {
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
  });
  it("118. candidate, start index, window and affected set are not persisted", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    for (const forbidden of [
      "candidate",
      "reversal",
      "windowstart",
      "originalwindow",
      "reversedwindow",
      "affected",
    ]) {
      expect(storage.value()?.toLowerCase()).not.toContain(forbidden);
    }
  });
  it("119. advantage, confidence, rank and score are not persisted", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    for (const forbidden of ["advantage", "confidence", "rank", "score", "history"]) {
      expect(storage.value()?.toLowerCase()).not.toContain(forbidden);
    }
  });
  it("120. reload preserves the applied order", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    expect(loadReconciledDraft(storage, applied.routeIds).days?.[0].placeIds).toEqual(REVERSED);
  });
  it("121. reload regenerates all four local-alternative groups", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    const loaded = loadReconciledDraft(storage, applied.routeIds);
    const input = {
      routeIds: loaded.routeIds,
      days: loaded.days,
      visitStartTimes: loaded.visitStartTimes,
    };
    const deps = { resolvePlace: resolver(), lookupTransfer: lookupFrom(EDGES) };
    expect(generateEvidenceCompleteLocalSwaps(input, deps).kind).toBe("available");
    expect(generateEvidenceCompleteLocalRelocations(input, deps).kind).toBe("available");
    expect(generateEvidenceCompleteInteriorTranspositions(input, deps).kind).toBe("available");
    const regenerated = generateEvidenceCompleteFourPlaceInteriorReversals(input, deps);
    expect(regenerated.kind).toBe("available");
    // The applied order is the new baseline, so its own candidate is no longer proposed.
    expect(regenerated.kind === "available" ? regenerated.alternatives : []).toHaveLength(0);
  });
});

describe("pure helpers stay pure", () => {
  it("reverseFourPlaces never mutates its input and neutralises an illegal window", () => {
    const values = [...IDS];
    expect(reverseFourPlaces(values, 1)).toEqual(REVERSED);
    expect(values).toEqual(IDS);
    expect(reverseFourPlaces(values, -1)).toEqual(IDS);
    expect(reverseFourPlaces(values, 1.5)).toEqual(IDS);
    expect(reverseFourPlaces(values, 3)).toEqual(IDS);
    expect(reverseFourPlaces(values, 99)).toEqual(IDS);
  });
  it("the stale assessor returns coordinates without mutating its input", () => {
    const current = draft();
    const snapshot = JSON.stringify(current);
    expect(
      assessFourPlaceInteriorReversalApplicability(
        DEFAULT_ALTERNATIVE,
        { routeIds: current.routeIds, days: current.days, visitStartTimes: current.visitStartTimes },
        { resolvePlace: resolver() }
      )
    ).toEqual({ kind: "applicable", dayId: "d1", windowStartDayIndex: 1 });
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});
