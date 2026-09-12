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
  withPlacesTransposedWithinDay,
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
import { orderedSequenceFromLookup } from "./ordered-sequence";
import { sequenceComparisonFromLookup } from "./sequence-comparison";
import { getBestTransfer, type TransferConfidence, type TransferEdge } from "./transfer";
import { buildWholeTripComposition, type WholeTripComposition } from "./whole-trip-composition";
import {
  affectedTranspositionPositions,
  applyEvidenceCompleteInteriorTransposition,
  assessInteriorTranspositionApplicability,
  generateEvidenceCompleteInteriorTranspositions,
  legalInteriorTranspositions,
  transposeTwoPlaces,
  type EvidenceCompleteInteriorTranspositionAlternative,
  type EvidenceCompleteInteriorTranspositionGeneration,
  type InteriorTranspositionDay,
} from "./evidence-complete-interior-transposition";

/* Phase 3E-G: the domain contracts 1-104 from design §35, numbered one-for-one below. */

function place(id: string, hub = "Tokio"): Place {
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

function day(id: string, placeIds: string[]): InteriorTranspositionDay {
  return { id, placeIds };
}

/** `[l, a, b, c, r]` — the shortest block with exactly one legal non-adjacent interior pair. */
const IDS = ["l", "a", "b", "c", "r"];
const PLACES = IDS.map((id) => place(id));
/** Baseline `l→a→b→c→r` totals 40; the `(1, 3)` transposition `l→c→b→a→r` totals 4. */
const EDGES = [
  transfer("l", "a", 10),
  transfer("a", "b", 10),
  transfer("b", "c", 10),
  transfer("c", "r", 10),
  transfer("l", "c", 1),
  transfer("c", "b", 1),
  transfer("b", "a", 1),
  transfer("a", "r", 1),
];
const TRANSPOSED = ["l", "c", "b", "a", "r"];

function generate(overrides: {
  routeIds?: string[];
  days?: InteriorTranspositionDay[] | null;
  places?: Place[];
  visitStartTimes?: Record<string, string>;
  edges?: TransferEdge[];
  lookupTransfer?: (fromId: string, toId: string) => TransferEdge | null;
} = {}): EvidenceCompleteInteriorTranspositionGeneration {
  const routeIds = overrides.routeIds ?? IDS;
  const days = overrides.days === undefined ? [day("d1", [...IDS])] : overrides.days;
  const places = overrides.places ?? PLACES;
  const byId = new Map(places.map((entry) => [entry.id, entry]));
  return generateEvidenceCompleteInteriorTranspositions(
    { routeIds, days, visitStartTimes: overrides.visitStartTimes ?? {} },
    {
      resolvePlace: (placeId) => byId.get(placeId) ?? null,
      lookupTransfer: overrides.lookupTransfer ?? lookupFrom(overrides.edges ?? EDGES),
    }
  );
}

function alternatives(
  generation: EvidenceCompleteInteriorTranspositionGeneration
): EvidenceCompleteInteriorTranspositionAlternative[] {
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

/** `[l, a, b, c, d, e, r]` — long enough for an untouched interior place outside the affected set. */
const IDS7 = ["l", "a", "b", "c", "d", "e", "r"];
const PLACES7 = IDS7.map((id) => place(id));

function generate7(visitStartTimes: Record<string, string> = {}) {
  return generateEvidenceCompleteInteriorTranspositions(
    { routeIds: IDS7, days: [day("d1", [...IDS7])], visitStartTimes },
    { resolvePlace: resolver(PLACES7), lookupTransfer: baselineHeavyLookup(IDS7) }
  );
}

describe("structural availability (§35.1-5)", () => {
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
    expect(generate({ places: PLACES.slice(0, 4) })).toEqual({
      kind: "unavailable",
      reason: "unresolved-route-place",
    });
  });
  it("4. a valid plan is available", () => {
    expect(generate().kind).toBe("available");
  });
  it("5. trip bounds are not an input and cannot block a candidate", async () => {
    // The input type carries no bounds at all, so an inverted or missing window cannot reach here.
    const source = await readFile(
      new URL("./evidence-complete-interior-transposition.ts", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/startDate|endDate|tripBounds/);
    expect(alternatives(generate())).toHaveLength(1);
  });
});

describe("block and transposition enumeration (§35.6-23)", () => {
  it("6. maximal same-hub block semantics are imported from Phase 3E-C, not re-derived", async () => {
    const source = await readFile(
      new URL("./evidence-complete-interior-transposition.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain('import { deriveSameHubBlocks } from "./evidence-complete-local-swap"');
    expect(source).not.toMatch(/function deriveSameHubBlocks/);
    expect(deriveSameHubBlocks(0, IDS, resolver())).toHaveLength(1);
  });
  it("7. no candidate crosses a hub boundary", () => {
    const places = [...IDS.slice(0, 4).map((id) => place(id)), place("r", "Kioto")];
    expect(alternatives(generate({ places }))).toHaveLength(0);
  });
  it("8. no candidate crosses a day boundary", () => {
    expect(
      alternatives(generate({ days: [day("d1", ["l", "a", "b"]), day("d2", ["c", "r"])] }))
    ).toHaveLength(0);
  });
  it("9. an empty day produces none", () => {
    const generation = generate({
      days: [day("d1", []), day("d2", [...IDS])],
    });
    expect(alternatives(generation).every((entry) => entry.dayId === "d2")).toBe(true);
  });
  it("10. a block shorter than five produces no transposition", () => {
    for (const length of [0, 1, 2, 3, 4]) {
      expect(legalInteriorTranspositions(length)).toHaveLength(0);
    }
    const ids = ["l", "a", "b", "r"];
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
  it("12. every left index is interior", () => {
    for (const { leftIndex } of legalInteriorTranspositions(7)) {
      expect(leftIndex).toBeGreaterThanOrEqual(1);
      expect(leftIndex).toBeLessThanOrEqual(5);
    }
  });
  it("13. every right index is interior", () => {
    for (const { rightIndex } of legalInteriorTranspositions(7)) {
      expect(rightIndex).toBeGreaterThanOrEqual(1);
      expect(rightIndex).toBeLessThanOrEqual(5);
    }
  });
  it("14. left index is strictly less than right index", () => {
    for (const { leftIndex, rightIndex } of legalInteriorTranspositions(9)) {
      expect(leftIndex).toBeLessThan(rightIndex);
    }
  });
  it("15. a same-position pair is excluded", () => {
    expect(
      legalInteriorTranspositions(9).some(({ leftIndex, rightIndex }) => leftIndex === rightIndex)
    ).toBe(false);
  });
  it("16. an adjacent pair is excluded", () => {
    expect(
      legalInteriorTranspositions(9).some(
        ({ leftIndex, rightIndex }) => rightIndex - leftIndex < 2
      )
    ).toBe(false);
  });
  it("17. a non-adjacent pair is generated", () => {
    expect(legalInteriorTranspositions(5)).toEqual([{ leftIndex: 1, rightIndex: 3 }]);
    expect(alternatives(generate())[0].candidateBlockPlaceIds).toEqual(TRANSPOSED);
  });
  it("18. exactly the two selected places exchange indices", () => {
    const alternative = alternatives(generate())[0];
    expect(alternative.leftPlaceId).toBe("a");
    expect(alternative.rightPlaceId).toBe("c");
    expect(alternative.candidateDayPlaceIds[alternative.leftDayIndex]).toBe("c");
    expect(alternative.candidateDayPlaceIds[alternative.rightDayIndex]).toBe("a");
  });
  it("19. every other place stays at exactly the same index", () => {
    for (const alternative of alternatives(generate7())) {
      const { baselineDayPlaceIds, candidateDayPlaceIds, leftDayIndex, rightDayIndex } = alternative;
      baselineDayPlaceIds.forEach((placeId, index) => {
        if (index === leftDayIndex || index === rightDayIndex) return;
        expect(candidateDayPlaceIds[index]).toBe(placeId);
      });
    }
  });
  it("20. candidate orders are unique", () => {
    const orders = alternatives(generate7()).map((entry) => JSON.stringify(entry.candidateDayPlaceIds));
    expect(new Set(orders).size).toBe(orders.length);
  });
  it("21. order is day, then block, then left index, then right index ascending", () => {
    const pairs = alternatives(generate7()).map((entry) => [
      entry.leftDayIndex,
      entry.rightDayIndex,
    ]);
    expect(pairs).toEqual([
      [1, 3],
      [1, 4],
      [1, 5],
      [2, 4],
      [2, 5],
      [3, 5],
    ]);
  });
  it("22. candidate count equals (n - 3)(n - 4) / 2", () => {
    for (let n = 4; n <= 12; n += 1) {
      expect(legalInteriorTranspositions(n)).toHaveLength(Math.max(0, ((n - 3) * (n - 4)) / 2));
    }
  });
  it("23. the source limits the quadratic claim to candidate count, not total runtime", async () => {
    const source = await readFile(
      new URL("./evidence-complete-interior-transposition.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("candidate count");
    expect(source).toContain("O(n³)");
    expect(source).not.toMatch(/total runtime is O\(n²\)/);
    expect(source).not.toMatch(/\brecursion\b(?!,| and| is| — )/);
  });
});

describe("affected temporal set (§35.24-34)", () => {
  const target = (visitStartTimes: Record<string, string>) =>
    alternatives(generate({ visitStartTimes }))[0];

  it("24. the set is the union of both predecessor/self/successor windows", () => {
    expect(affectedTranspositionPositions(1, 5)).toEqual([0, 1, 2, 4, 5, 6]);
    expect(alternatives(generate7()).find((entry) => entry.leftDayIndex === 1 && entry.rightDayIndex === 5)
      ?.affectedPlaceIds).toEqual(["l", "a", "b", "d", "e", "r"]);
  });
  it("25. a distance-two pair deduplicates the overlapping windows", () => {
    expect(affectedTranspositionPositions(1, 3)).toEqual([0, 1, 2, 3, 4]);
    expect(alternatives(generate())[0].affectedPlaceIds).toEqual(["l", "a", "b", "c", "r"]);
  });
  it("26. a time on the left predecessor blocks", () => expect(target({ l: "08:00" })).toBeUndefined());
  it("27. a time on the left transposed place blocks", () => expect(target({ a: "09:00" })).toBeUndefined());
  it("28. a time on the left successor blocks", () => expect(target({ b: "10:00" })).toBeUndefined());
  it("29. a time on the right predecessor blocks", () => {
    const blocked = alternatives(generate7({ d: "10:00" }));
    expect(blocked.some((entry) => entry.leftDayIndex === 1 && entry.rightDayIndex === 5)).toBe(false);
  });
  it("30. a time on the right transposed place blocks", () => expect(target({ c: "11:00" })).toBeUndefined());
  it("31. a time on the right successor blocks", () => expect(target({ r: "12:00" })).toBeUndefined());
  it("32. a timed untouched interior place outside the affected set does not block", () => {
    // `c` sits at index 3 and keeps both neighbours when `a` and `e` exchange, so it is not locked.
    const kept = alternatives(generate7({ c: "10:00" }));
    expect(kept.some((entry) => entry.leftDayIndex === 1 && entry.rightDayIndex === 5)).toBe(true);
    expect(alternatives(generate7()).length).toBeGreaterThan(kept.length);
  });
  it("33. a timed place elsewhere in the day does not block", () => {
    const ids = [...IDS, "x"];
    const places = [...PLACES, place("x", "Kioto")];
    const generation = generate({
      routeIds: ids,
      days: [day("d1", ids)],
      places,
      visitStartTimes: { x: "12:00" },
    });
    expect(alternatives(generation)).toHaveLength(1);
  });
  it("34. generation never edits, moves or infers a visit start time", () => {
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

describe("evidence gates (§35.35-40)", () => {
  it("35. a complete baseline is required", () => {
    expect(orderedSequenceFromLookup(IDS, lookupFrom(EDGES)).summary.complete).toBe(true);
    expect(alternatives(generate())).toHaveLength(1);
  });
  it("36. one missing baseline edge blocks the whole block", () => {
    expect(
      alternatives(generate({ edges: EDGES.filter((edge) => edge.fromId !== "b" || edge.toId !== "c") }))
    ).toHaveLength(0);
  });
  it("37. a reverse or chained edge never repairs a baseline", () => {
    const withoutForward = EDGES.filter((edge) => !(edge.fromId === "b" && edge.toId === "c"));
    // `c→b` exists and a chain through any other place exists; neither may stand in for `b→c`.
    expect(withoutForward.some((edge) => edge.fromId === "c" && edge.toId === "b")).toBe(true);
    expect(alternatives(generate({ edges: withoutForward }))).toHaveLength(0);
  });
  it("38. a complete candidate is required", () => {
    expect(alternatives(generate())[0].candidateBlockPlaceIds).toEqual(TRANSPOSED);
  });
  it("39. one missing candidate edge discards that candidate", () => {
    expect(
      alternatives(generate({ edges: EDGES.filter((edge) => !(edge.fromId === "c" && edge.toId === "b")) }))
    ).toHaveLength(0);
  });
  it("40. no geometry or network fallback exists in the module", async () => {
    const source = await readFile(
      new URL("./evidence-complete-interior-transposition.ts", import.meta.url),
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
    // The only transfer evidence that may reach a candidate is the exact directed lookup.
    expect(code.match(/lookupTransfer/g)?.length).toBeGreaterThan(0);
    expect(code).not.toMatch(/lookupTransfer\(\s*toId|reverse|chain/i);
  });
});

describe("comparison and confidence (§35.41-50)", () => {
  const equalLookup = () => transfer("x", "y", 10);
  it("41. a b-clearly-faster candidate is emitted", () => {
    const alternative = alternatives(generate())[0];
    expect(alternative.baselineTransferMinutes).toEqual({ minMinutes: 40, maxMinutes: 40 });
    expect(alternative.candidateTransferMinutes).toEqual({ minMinutes: 4, maxMinutes: 4 });
  });
  it("42. an equivalent range is rejected", () => {
    expect(alternatives(generate({ lookupTransfer: equalLookup }))).toHaveLength(0);
  });
  it("43. an overlapping range is rejected", () => {
    const lookup = (fromId: string, toId: string) =>
      fromId === "l" && toId === "c" ? transfer(fromId, toId, 1, 100) : transfer(fromId, toId, 10);
    expect(alternatives(generate({ lookupTransfer: lookup }))).toHaveLength(0);
  });
  it("44. a faster baseline is rejected", () => {
    const lookup = (fromId: string, toId: string) =>
      transfer(fromId, toId, ["l>a", "a>b", "b>c", "c>r"].includes(`${fromId}>${toId}`) ? 1 : 100);
    expect(alternatives(generate({ lookupTransfer: lookup }))).toHaveLength(0);
  });
  it("45. an incomplete comparison is rejected", () => {
    expect(alternatives(generate({ lookupTransfer: () => null }))).toHaveLength(0);
  });
  it("46. the existing Phase 3C-B advantage arithmetic is reused unchanged", () => {
    const alternative = alternatives(generate())[0];
    const comparison = sequenceComparisonFromLookup(IDS, TRANSPOSED, lookupFrom(EDGES));
    expect(alternative.guaranteedAdvantageMinutes).toBe(comparison.guaranteedAdvantageMinutes);
    expect(alternative.possibleAdvantageRange).toEqual(comparison.possibleAdvantageRange);
    expect(alternative.guaranteedAdvantageMinutes).toBe(36);
  });
  it("47. the baseline confidence tally is preserved", () => {
    expect(alternatives(generate())[0].baselineConfidenceCounts).toEqual({
      validatedStatic: 4,
      estimated: 0,
      scheduleAware: 0,
    });
  });
  it("48. the candidate confidence tally is preserved", () => {
    expect(alternatives(generate())[0].candidateConfidenceCounts).toEqual({
      validatedStatic: 4,
      estimated: 0,
      scheduleAware: 0,
    });
  });
  it("49. estimated evidence remains visibly estimated", () => {
    const estimated = EDGES.map((edge) =>
      transfer(edge.fromId, edge.toId, edge.minutes.minMinutes, edge.minutes.maxMinutes, "estimated")
    );
    const alternative = alternatives(generate({ edges: estimated }))[0];
    expect(alternative.baselineConfidenceCounts.estimated).toBe(4);
    expect(alternative.candidateConfidenceCounts.estimated).toBe(4);
    expect(alternative.baselineConfidenceCounts.validatedStatic).toBe(0);
  });
  it("50. confidence produces no score, rank or winner field", () => {
    const alternative = alternatives(generate())[0];
    for (const forbidden of ["score", "rank", "best", "recommended", "winner", "grade"]) {
      expect(Object.keys(alternative)).not.toContain(forbidden);
    }
  });
});

describe("separation from existing local moves (§35.51-57)", () => {
  const REAL = ["JP-028", "JP-026", "JP-022", "JP-027", "JP-025"];
  const realDeps = {
    resolvePlace: (placeId: string) => getPlaceById(placeId) ?? null,
    lookupTransfer: getBestTransfer,
  };
  const realInput = {
    routeIds: REAL,
    days: [{ id: "d1", placeIds: REAL }],
    visitStartTimes: {},
  };

  it("51. an adjacent transposition is never emitted by Phase 3E-G", () => {
    for (const alternative of alternatives(generate7())) {
      expect(alternative.rightDayIndex - alternative.leftDayIndex).toBeGreaterThanOrEqual(2);
    }
  });
  it("52. a candidate order never duplicates Phase 3E-C adjacent-swap output", () => {
    const swaps = generateEvidenceCompleteLocalSwaps(
      { routeIds: IDS7, days: [day("d1", [...IDS7])], visitStartTimes: {} },
      { resolvePlace: resolver(PLACES7), lookupTransfer: baselineHeavyLookup(IDS7) }
    );
    const swapOrders = new Set(
      (swaps.kind === "available" ? swaps.alternatives : []).map((entry) =>
        JSON.stringify(entry.candidateDayPlaceIds)
      )
    );
    expect(swapOrders.size).toBeGreaterThan(0);
    for (const alternative of alternatives(generate7())) {
      expect(swapOrders.has(JSON.stringify(alternative.candidateDayPlaceIds))).toBe(false);
    }
  });
  it("53. a candidate order never duplicates Phase 3E-E relocation output", () => {
    const relocations = generateEvidenceCompleteLocalRelocations(
      { routeIds: IDS7, days: [day("d1", [...IDS7])], visitStartTimes: {} },
      { resolvePlace: resolver(PLACES7), lookupTransfer: baselineHeavyLookup(IDS7) }
    );
    const relocationOrders = new Set(
      (relocations.kind === "available" ? relocations.alternatives : []).map((entry) =>
        JSON.stringify(entry.candidateDayPlaceIds)
      )
    );
    expect(relocationOrders.size).toBeGreaterThan(0);
    for (const alternative of alternatives(generate7())) {
      expect(relocationOrders.has(JSON.stringify(alternative.candidateDayPlaceIds))).toBe(false);
    }
  });
  it("54. the real Tokio fixture is not improved by one adjacent swap", () => {
    const swaps = generateEvidenceCompleteLocalSwaps(realInput, realDeps);
    expect(swaps.kind).toBe("available");
    expect(swaps.kind === "available" ? swaps.alternatives : []).toHaveLength(0);
  });
  it("55. the same fixture is not improved by one single-place relocation", () => {
    const relocations = generateEvidenceCompleteLocalRelocations(realInput, realDeps);
    expect(relocations.kind).toBe("available");
    expect(relocations.kind === "available" ? relocations.alternatives : []).toHaveLength(0);
  });
  it("56. the same fixture is improved by the interior transposition", () => {
    const generated = alternatives(
      generateEvidenceCompleteInteriorTranspositions(realInput, realDeps)
    );
    expect(generated).toHaveLength(1);
    expect(generated[0].candidateDayPlaceIds).toEqual([
      "JP-028",
      "JP-027",
      "JP-022",
      "JP-026",
      "JP-025",
    ]);
    expect(generated[0].baselineTransferMinutes).toEqual({ minMinutes: 68, maxMinutes: 68 });
    expect(generated[0].candidateTransferMinutes).toEqual({ minMinutes: 60, maxMinutes: 60 });
    expect(generated[0].guaranteedAdvantageMinutes).toBe(8);
    expect(generated[0].hub).toBe("Tokio");
  });
  it("57. the real fixture remains fully validated-static on both sides", () => {
    const generated = alternatives(
      generateEvidenceCompleteInteriorTranspositions(realInput, realDeps)
    )[0];
    expect(generated.baselineConfidenceCounts).toEqual({
      validatedStatic: 4,
      estimated: 0,
      scheduleAware: 0,
    });
    expect(generated.candidateConfidenceCounts).toEqual({
      validatedStatic: 4,
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
  alternative: EvidenceCompleteInteriorTranspositionAlternative,
  current: ManualPlanningDraftV7,
  places = PLACES
) {
  return applyEvidenceCompleteInteriorTransposition(
    alternative,
    { routeIds: current.routeIds, days: current.days, visitStartTimes: current.visitStartTimes },
    { resolvePlace: resolver(places) },
    (dayId, leftIndex, rightIndex) =>
      withPlacesTransposedWithinDay(current, dayId, leftIndex, rightIndex)
  );
}

describe("Apply and stale safety (§35.58-76)", () => {
  it("58. generation alone applies nothing", () => {
    const current = draft();
    const snapshot = JSON.stringify(current);
    generate();
    expect(JSON.stringify(current)).toBe(snapshot);
  });
  it("59. Apply requires an explicit call", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    expect(result.kind).toBe("applied");
  });
  it("60. Apply exchanges exactly the two places", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    expect(result.kind === "applied" && result.draft.days?.[0].placeIds).toEqual(TRANSPOSED);
  });
  it("61. every other place remains at the same index", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    const after = result.draft.days?.[0].placeIds ?? [];
    expect(after[0]).toBe("l");
    expect(after[2]).toBe("b");
    expect(after[4]).toBe("r");
  });
  it("62. day id is unchanged", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    expect(result.kind === "applied" && result.draft.days?.[0].id).toBe("d1");
  });
  it("63. day membership is unchanged", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    expect([...(result.draft.days?.[0].placeIds ?? [])].sort()).toEqual([...IDS].sort());
  });
  it("64. routeIds are unchanged", () => {
    const before = draft();
    const result = applyTo(DEFAULT_ALTERNATIVE, before);
    expect(result.kind === "applied" && result.draft.routeIds).toBe(before.routeIds);
  });
  it("65. the accommodation boundary is unchanged", () => {
    const before = draft();
    const result = applyTo(DEFAULT_ALTERNATIVE, before);
    expect(result.kind === "applied" && result.draft.days?.[0].accommodationBoundary).toBe(
      before.days?.[0].accommodationBoundary
    );
  });
  it("66. all other days are unchanged", () => {
    const ids = [...IDS, "k"];
    const before = draft({
      routeIds: ids,
      days: [planningDay("d1", [...IDS]), planningDay("d2", ["k"])],
    });
    const result = applyEvidenceCompleteInteriorTransposition(
      DEFAULT_ALTERNATIVE,
      { routeIds: ids, days: before.days, visitStartTimes: {} },
      { resolvePlace: resolver([...PLACES, place("k", "Kioto")]) },
      (dayId, leftIndex, rightIndex) =>
        withPlacesTransposedWithinDay(before, dayId, leftIndex, rightIndex)
    );
    expect(result.kind === "applied" && result.draft.days?.[1]).toBe(before.days?.[1]);
  });
  it("67. a stale baseline is rejected", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft({ days: [planningDay("d1", ["l", "b", "a", "c", "r"])] }));
    expect(result).toEqual({ kind: "stale", reason: "day-changed" });
  });
  it("68. a left identity mismatch is rejected", () => {
    const result = applyTo({ ...DEFAULT_ALTERNATIVE, leftPlaceId: "b" }, draft());
    expect(result).toEqual({ kind: "stale", reason: "left-place-changed" });
  });
  it("69. a right identity mismatch is rejected", () => {
    const result = applyTo({ ...DEFAULT_ALTERNATIVE, rightPlaceId: "b" }, draft());
    expect(result).toEqual({ kind: "stale", reason: "right-place-changed" });
  });
  it("70. an index targeting a locked block endpoint is rejected", () => {
    for (const override of [{ leftDayIndex: 0 }, { rightDayIndex: 4 }]) {
      expect(applyTo({ ...DEFAULT_ALTERNATIVE, ...override }, draft())).toEqual({
        kind: "stale",
        reason: "illegal-pair",
      });
    }
  });
  it("71. an adjacent index pair is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, rightDayIndex: 2 }, draft())).toEqual({
      kind: "stale",
      reason: "illegal-pair",
    });
  });
  it("72. a changed block endpoint is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, blockEndPlaceId: "zz" }, draft())).toEqual({
      kind: "stale",
      reason: "block-changed",
    });
  });
  it("73. a changed block hub is rejected", () => {
    const places = [...IDS.slice(0, 4).map((id) => place(id)), place("r", "Kioto")];
    expect(applyTo(DEFAULT_ALTERNATIVE, draft(), places)).toEqual({
      kind: "stale",
      reason: "hub-changed",
    });
  });
  it("74. a mismatched captured candidate order is rejected", () => {
    expect(
      applyTo({ ...DEFAULT_ALTERNATIVE, candidateDayPlaceIds: ["l", "b", "c", "a", "r"] }, draft())
    ).toEqual({ kind: "stale", reason: "block-changed" });
  });
  it("75. a newly timed affected place is rejected", () => {
    expect(applyTo(DEFAULT_ALTERNATIVE, draft({ visitStartTimes: { b: "09:00" } }))).toEqual({
      kind: "stale",
      reason: "manual-visit-time-added",
    });
  });
  it("76. a stale refusal performs no mutation", () => {
    const before = draft({ visitStartTimes: { b: "09:00" } });
    const snapshot = JSON.stringify(before);
    expect(applyTo(DEFAULT_ALTERNATIVE, before).kind).toBe("stale");
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("pure V7 mutation (§35.77-82)", () => {
  it("77. one pure mutation produces the final order directly", () => {
    expect(withPlacesTransposedWithinDay(draft(), "d1", 1, 3).days?.[0].placeIds).toEqual(TRANSPOSED);
  });
  it("78. no intermediate order is exposed or persisted", () => {
    const before = draft();
    const after = withPlacesTransposedWithinDay(before, "d1", 1, 3);
    expect(before.days?.[0].placeIds).toEqual(IDS);
    expect(after.days?.[0].placeIds).toEqual(TRANSPOSED);
  });
  it("79. the helper remains V7", () => {
    expect(withPlacesTransposedWithinDay(draft(), "d1", 1, 3).version).toBe(7);
    expect(PLANNING_DRAFT_VERSION).toBe(7);
  });
  it("80. every non-day field is structurally preserved", () => {
    const before = draft({
      visitStartTimes: { z: "08:00" },
      accommodations: [{ id: "hotel", label: "Hotel", location: { lat: 35, lng: 139 } }],
      accommodationLegs: [],
      interHubSegments: [],
    });
    const after = withPlacesTransposedWithinDay(before, "d1", 1, 3);
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
  it("81. unaffected days preserve identity", () => {
    const before = draft({
      routeIds: [...IDS, "k"],
      days: [planningDay("d1", [...IDS]), planningDay("d2", ["k"])],
    });
    const after = withPlacesTransposedWithinDay(before, "d1", 1, 3);
    expect(after.days?.[1]).toBe(before.days?.[1]);
  });
  it("82. the helper and hook use no async multi-click sequence", async () => {
    const domain = await readFile(new URL("./planning-draft-v7.ts", import.meta.url), "utf8");
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    const mutation = domain.slice(
      domain.indexOf("export function withPlacesTransposedWithinDay"),
      domain.indexOf("export function withPlaceMovedBetweenDays")
    );
    const callback = hook.slice(
      hook.indexOf("const transposePlacesWithinDay"),
      hook.indexOf("const movePlaceBetweenDays")
    );
    expect(mutation).not.toMatch(/async|setTimeout|withPlaceRelocatedWithinDay|withPlaceMovedWithinDay/);
    expect(mutation.match(/splice\(/g)).toBeNull();
    expect(callback.match(/setDraft\(/g)).toHaveLength(1);
    expect(callback).toContain("withPlacesTransposedWithinDay(current, dayId, leftIndex, rightIndex)");
  });
});

describe("inter-hub invariants (§35.83-87)", () => {
  const ids = ["t0", "a", "b", "c", "t4", "k0", "k1", "o0"];
  const places = ids.map((id) =>
    place(id, id.startsWith("k") ? "Kioto" : id.startsWith("o") ? "Osaka" : "Tokio")
  );
  const beforeDays = [planningDay("d1", ids.slice(0, 7)), planningDay("d2", ["o0"])];
  const afterDays = [
    planningDay("d1", ["t0", "c", "b", "a", "t4", "k0", "k1"]),
    beforeDays[1],
  ];
  const segments: ManualInterHubSegment[] = [
    { id: "same", fromPlaceId: "t4", toPlaceId: "k0", fromHub: "Tokio", toHub: "Kioto", mode: "shinkansen", minutes: 140, source: { kind: "user-entered" } },
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
  const after = withPlacesTransposedWithinDay(before, "d1", 1, 3);

  it("83. all stored segment objects remain byte-identical", () => {
    expect(after.interHubSegments).toBe(segments);
    expect(after.days?.[0].placeIds).toEqual(afterDays[0].placeIds);
  });
  it("84. all derived assessments remain identical", () => {
    expect(assess(afterDays)).toEqual(assess(beforeDays));
  });
  it("85. the active same-day segment remains unchanged", () => {
    expect(assess(afterDays)[0]).toEqual(assess(beforeDays)[0]);
  });
  it("86. the active between-days segment remains unchanged", () => {
    expect(assess(afterDays)[1]).toEqual(assess(beforeDays)[1]);
  });
  it("87. the inactive reason remains unchanged", () => {
    expect(assess(afterDays)[2]).toEqual(assess(beforeDays)[2]);
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

describe("accommodation invariants (§35.88-89)", () => {
  const before = compose(IDS);
  const after = compose(TRANSPOSED);
  const available = () => {
    if (before.kind !== "available" || after.kind !== "available") throw new Error("expected available");
    return { before, after };
  };
  it("88. the boundary assessment is unchanged", () => {
    const values = available();
    expect(values.after.accommodation.components).toEqual(values.before.accommodation.components);
  });
  it("89. registered accommodation minutes are unchanged", () => {
    const values = available();
    expect(values.after.accommodation.registeredMinutes).toBe(
      values.before.accommodation.registeredMinutes
    );
    expect(values.after.accommodation.registeredMinutes).toBe(35);
  });
});

describe("whole-trip composition (§35.90-97)", () => {
  const before = compose(IDS);
  const after = compose(TRANSPOSED);
  const available = () => {
    if (before.kind !== "available" || after.kind !== "available") throw new Error("expected available");
    return { before, after };
  };
  it("90. visit composition is unchanged", () => {
    expect(available().after.visit).toEqual(available().before.visit);
  });
  it("91. accommodation composition is unchanged", () => {
    expect(available().after.accommodation).toEqual(available().before.accommodation);
  });
  it("92. inter-hub composition is unchanged", () => {
    expect(available().after.interHub).toEqual(available().before.interHub);
  });
  it("93. bounds composition is unchanged", () => {
    expect(available().after.bounds).toEqual(available().before.bounds);
  });
  it("94. day count, membership and dates are unchanged", () => {
    const values = available();
    expect(values.after.dayCount).toBe(values.before.dayCount);
    expect([...TRANSPOSED].sort()).toEqual([...IDS].sort());
  });
  it("95. local registered movement changes by the exact evidenced delta", () => {
    const values = available();
    const delta =
      DEFAULT_ALTERNATIVE.baselineTransferMinutes.minMinutes -
      DEFAULT_ALTERNATIVE.candidateTransferMinutes.minMinutes;
    expect(delta).toBe(36);
    expect(
      values.before.movement.registeredMinutes!.minMinutes -
        values.after.movement.registeredMinutes!.minMinutes
    ).toBe(delta);
  });
  it("96. registered transport changes by the same exact delta", () => {
    const values = available();
    expect(
      values.before.registeredTransportMinutes!.minMinutes -
        values.after.registeredTransportMinutes!.minMinutes
    ).toBe(36);
    expect(
      values.before.registeredTransportMinutes!.maxMinutes -
        values.after.registeredTransportMinutes!.maxMinutes
    ).toBe(36);
  });
  it("97. no local missing edge is introduced", () => {
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

describe("persistence (§35.98-104)", () => {
  const applied = withPlacesTransposedWithinDay(draft(), "d1", 1, 3);
  it("98. the persisted draft remains V7", () => expect(applied.version).toBe(7));
  it("99. the existing storage key is reused", () => {
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
  });
  it("100. candidate state is not persisted", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    for (const forbidden of ["candidate", "transposition", "alternative"]) {
      expect(storage.value()?.toLowerCase()).not.toContain(forbidden);
    }
  });
  it("101. indices and the affected set are not persisted", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    for (const forbidden of ["leftindex", "rightindex", "leftdayindex", "rightdayindex", "affected"]) {
      expect(storage.value()?.toLowerCase()).not.toContain(forbidden);
    }
  });
  it("102. advantage, confidence, rank and score are not persisted", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    for (const forbidden of ["advantage", "confidence", "rank", "score", "history"]) {
      expect(storage.value()?.toLowerCase()).not.toContain(forbidden);
    }
  });
  it("103. reload preserves the applied day order", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    expect(loadReconciledDraft(storage, applied.routeIds).days?.[0].placeIds).toEqual(TRANSPOSED);
  });
  it("104. reload regenerates fresh 3E-C, 3E-E and 3E-G candidates", () => {
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
    const regenerated = generateEvidenceCompleteInteriorTranspositions(input, deps);
    expect(regenerated.kind).toBe("available");
    // The new baseline is the applied order, so the previous candidate is no longer proposed.
    expect(regenerated.kind === "available" ? regenerated.alternatives : []).toHaveLength(0);
  });
});

describe("pure helpers stay pure", () => {
  it("transposeTwoPlaces never mutates its input and refuses an illegal pair", () => {
    const values = [...IDS];
    expect(transposeTwoPlaces(values, 1, 3)).toEqual(TRANSPOSED);
    expect(values).toEqual(IDS);
    expect(transposeTwoPlaces(values, 1, 1)).toEqual(IDS);
    expect(transposeTwoPlaces(values, -1, 3)).toEqual(IDS);
    expect(transposeTwoPlaces(values, 1, 99)).toEqual(IDS);
  });
  it("the stale assessor returns coordinates without mutating its input", () => {
    const current = draft();
    const snapshot = JSON.stringify(current);
    expect(
      assessInteriorTranspositionApplicability(
        DEFAULT_ALTERNATIVE,
        { routeIds: current.routeIds, days: current.days, visitStartTimes: current.visitStartTimes },
        { resolvePlace: resolver() }
      )
    ).toEqual({ kind: "applicable", dayId: "d1", leftDayIndex: 1, rightDayIndex: 3 });
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});
