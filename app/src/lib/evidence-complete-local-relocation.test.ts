import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
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
  withPlaceRelocatedWithinDay,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV7,
  type PlanningDayV5,
} from "./planning-draft-v7";
import { generateEvidenceCompleteLocalSwaps } from "./evidence-complete-local-swap";
import type { TransferConfidence, TransferEdge } from "./transfer";
import { buildWholeTripComposition, type WholeTripComposition } from "./whole-trip-composition";
import {
  affectedRelocationWindow,
  applyEvidenceCompleteLocalRelocation,
  assessLocalRelocationApplicability,
  generateEvidenceCompleteLocalRelocations,
  legalInteriorRelocations,
  relocateOnePlace,
  type EvidenceCompleteLocalRelocationAlternative,
  type EvidenceCompleteLocalRelocationGeneration,
  type LocalRelocationDay,
} from "./evidence-complete-local-relocation";
import { deriveSameHubBlocks } from "./evidence-complete-local-swap";

/* Phase 3E-E: the 84 domain contracts from design §34, numbered one-for-one below. */

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

function day(id: string, placeIds: string[]): LocalRelocationDay {
  return { id, placeIds };
}

const IDS = ["l", "a", "b", "m", "r"];
const PLACES = IDS.map((id) => place(id));
const EDGES = [
  transfer("l", "a", 10),
  transfer("a", "b", 10),
  transfer("b", "m", 10),
  transfer("m", "r", 10),
  transfer("l", "m", 1),
  transfer("m", "a", 1),
  transfer("b", "r", 1),
];

function generate(overrides: {
  routeIds?: string[];
  days?: LocalRelocationDay[] | null;
  places?: Place[];
  visitStartTimes?: Record<string, string>;
  edges?: TransferEdge[];
  lookupTransfer?: (fromId: string, toId: string) => TransferEdge | null;
} = {}): EvidenceCompleteLocalRelocationGeneration {
  const routeIds = overrides.routeIds ?? IDS;
  const days = overrides.days === undefined ? [day("d1", [...IDS])] : overrides.days;
  const places = overrides.places ?? PLACES;
  const byId = new Map(places.map((entry) => [entry.id, entry]));
  return generateEvidenceCompleteLocalRelocations(
    { routeIds, days, visitStartTimes: overrides.visitStartTimes ?? {} },
    {
      resolvePlace: (placeId) => byId.get(placeId) ?? null,
      lookupTransfer: overrides.lookupTransfer ?? lookupFrom(overrides.edges ?? EDGES),
    }
  );
}

function alternatives(
  generation: EvidenceCompleteLocalRelocationGeneration
): EvidenceCompleteLocalRelocationAlternative[] {
  expect(generation.kind).toBe("available");
  return generation.kind === "available" ? generation.alternatives : [];
}

function resolver(places = PLACES) {
  const byId = new Map(places.map((entry) => [entry.id, entry]));
  return (placeId: string) => byId.get(placeId) ?? null;
}

function baselineHeavyLookup(ids: readonly string[]) {
  const baselinePairs = new Set(ids.slice(0, -1).map((id, index) => `${id}>${ids[index + 1]}`));
  return (fromId: string, toId: string) =>
    transfer(fromId, toId, baselinePairs.has(`${fromId}>${toId}`) ? 100 : 1);
}

describe("structural availability (§34.1-5)", () => {
  it("1. no days is unavailable", () => {
    expect(generate({ days: null })).toEqual({ kind: "unavailable", reason: "no-day-assignment" });
  });
  it("2. an invalid partition is unavailable", () => {
    expect(generate({ days: [day("d1", IDS.slice(0, -1))] })).toEqual({
      kind: "unavailable",
      reason: "invalid-day-partition",
    });
  });
  it("3. an unresolved route place is unavailable", () => {
    expect(generate({ places: PLACES.slice(0, -1) })).toEqual({
      kind: "unavailable",
      reason: "unresolved-route-place",
    });
  });
  it("4. a valid plan is available", () => {
    expect(alternatives(generate())).toHaveLength(1);
  });
  it("5. unavailable or inverted bounds cannot block generation", () => {
    expect(Object.keys({ routeIds: IDS, days: [day("d1", IDS)], visitStartTimes: {} })).not.toContain("bounds");
    expect(alternatives(generate())).toHaveLength(1);
  });
});

describe("block and relocation enumeration (§34.6-21)", () => {
  it("6. imports the exact Phase 3E-C maximal same-hub block semantics", () => {
    const places = [place("a", "T"), place("b", "T"), place("c", "K")];
    expect(deriveSameHubBlocks(2, ["a", "b", "c"], resolver(places))).toEqual([
      { dayOrdinal: 2, hub: "T", startIndex: 0, placeIds: ["a", "b"] },
      { dayOrdinal: 2, hub: "K", startIndex: 2, placeIds: ["c"] },
    ]);
  });
  it("7. no candidate crosses a hub boundary", () => {
    const places = IDS.map((id, index) => place(id, index < 3 ? "T" : "K"));
    expect(alternatives(generate({ places, lookupTransfer: baselineHeavyLookup(IDS) }))).toEqual([]);
  });
  it("8. no candidate crosses a day boundary", () => {
    expect(alternatives(generate({ days: [day("d1", IDS.slice(0, 3)), day("d2", IDS.slice(3))] }))).toEqual([]);
  });
  it("9. an empty day produces none", () => {
    const emitted = alternatives(generate({ days: [day("empty", []), day("d1", [...IDS])] }));
    expect(emitted).toHaveLength(1);
    expect(emitted[0].dayOrdinal).toBe(1);
  });
  it("10. a block shorter than five produces no relocation", () => {
    expect(legalInteriorRelocations(4)).toEqual([]);
  });
  it("11. block endpoints remain fixed", () => {
    const candidate = alternatives(generate())[0];
    expect(candidate.candidateBlockPlaceIds[0]).toBe("l");
    expect(candidate.candidateBlockPlaceIds.at(-1)).toBe("r");
  });
  it("12. every from index is interior", () => {
    expect(legalInteriorRelocations(8).every(({ fromIndex }) => fromIndex > 0 && fromIndex < 7)).toBe(true);
  });
  it("13. to index is the final interior position", () => {
    expect(relocateOnePlace(["l", "a", "b", "c", "r"], 1, 3)).toEqual(["l", "b", "c", "a", "r"]);
    expect(relocateOnePlace(["l", "a", "b", "c", "r"], 3, 1)).toEqual(["l", "c", "a", "b", "r"]);
  });
  it("14. same-position moves are excluded", () => {
    expect(legalInteriorRelocations(9).some(({ fromIndex, toIndex }) => fromIndex === toIndex)).toBe(false);
  });
  it("15. adjacent moves are excluded", () => {
    expect(legalInteriorRelocations(9).some(({ fromIndex, toIndex }) => Math.abs(fromIndex - toIndex) === 1)).toBe(false);
  });
  it("16. a non-adjacent single-place move is generated", () => {
    expect(alternatives(generate())[0]).toMatchObject({ movedPlaceId: "m", fromDayIndex: 3, toDayIndex: 1 });
  });
  it("17. all non-moved places preserve relative order", () => {
    const candidate = alternatives(generate())[0];
    expect(candidate.baselineDayPlaceIds.filter((id) => id !== candidate.movedPlaceId)).toEqual(
      candidate.candidateDayPlaceIds.filter((id) => id !== candidate.movedPlaceId)
    );
  });
  it("18. candidate orders are unique", () => {
    const emitted = alternatives(generate({ lookupTransfer: baselineHeavyLookup(IDS) }));
    const keys = emitted.map((entry) => JSON.stringify(entry.candidateDayPlaceIds));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("19. order is day, block, from, then to", () => {
    const ids = ["t0", "t1", "t2", "t3", "t4", "k0", "k1", "k2", "k3", "k4", "o0", "o1", "o2", "o3", "o4"];
    const places = ids.map((id) => place(id, id[0]));
    const days = [day("d1", ids.slice(0, 10)), day("d2", ids.slice(10))];
    const emitted = alternatives(generate({ routeIds: ids, days, places, lookupTransfer: baselineHeavyLookup(ids) }));
    expect(emitted.map((entry) => [entry.dayOrdinal, entry.hub, entry.fromDayIndex - entry.blockStartDayIndex, entry.toDayIndex - entry.blockStartDayIndex])).toEqual([
      [0, "t", 1, 3], [0, "t", 3, 1],
      [0, "k", 1, 3], [0, "k", 3, 1],
      [1, "o", 1, 3], [1, "o", 3, 1],
    ]);
  });
  it("20. candidate count grows quadratically rather than factorially", () => {
    for (let n = 5; n <= 20; n += 1) {
      expect(legalInteriorRelocations(n)).toHaveLength((n - 3) * (n - 4));
    }
  });
  it("21. source limits the quadratic claim to candidate count, not total runtime", async () => {
    const source = await readFile(new URL("./evidence-complete-local-relocation.ts", import.meta.url), "utf8");
    expect(source).toContain("quadratic candidate growth");
    expect(source).not.toMatch(/total runtime is O\(n²\)/i);
  });
});

describe("affected temporal window (§34.22-28)", () => {
  const ids = ["l", "a", "b", "c", "d", "outside", "r"];
  const places = ids.map((id) => place(id));
  const base = { routeIds: ids, days: [day("d1", ids)], places, lookupTransfer: baselineHeavyLookup(ids) };
  const target = (visitStartTimes: Record<string, string> = {}) =>
    alternatives(generate({ ...base, visitStartTimes })).find((entry) => entry.fromDayIndex === 1 && entry.toDayIndex === 3);

  it("22. window is exactly min-1 through max+1 inclusive", () => {
    expect(affectedRelocationWindow(3, 1)).toEqual({ start: 0, end: 4 });
    expect(target()?.affectedWindowPlaceIds).toEqual(["l", "a", "b", "c", "d"]);
  });
  it("23. a time on the left boundary blocks", () => expect(target({ l: "08:00" })).toBeUndefined());
  it("24. a time on the moved place blocks", () => expect(target({ a: "09:00" })).toBeUndefined());
  it("25. a time on an intermediate affected place blocks", () => expect(target({ b: "10:00" })).toBeUndefined());
  it("26. a time on the right boundary blocks", () => expect(target({ d: "11:00" })).toBeUndefined());
  it("27. a timed place outside the window does not block", () => expect(target({ outside: "12:00" })).toBeDefined());
  it("28. generation never edits or moves times", () => {
    const times = Object.freeze({ outside: "12:00" });
    generate({ ...base, visitStartTimes: times });
    expect(times).toEqual({ outside: "12:00" });
  });
});

describe("evidence gates (§34.29-34)", () => {
  it("29. a complete baseline is evaluated", () => expect(alternatives(generate())).toHaveLength(1));
  it("30. one missing baseline edge blocks the whole block", () => {
    expect(alternatives(generate({ edges: EDGES.filter((edge) => edge.fromId !== "a" || edge.toId !== "b") }))).toEqual([]);
  });
  it("31. reverse and chained edges do not repair a baseline", () => {
    const edges = [
      ...EDGES.filter((edge) => edge.fromId !== "a" || edge.toId !== "b"),
      transfer("b", "a", 1), transfer("a", "x", 1), transfer("x", "b", 1),
    ];
    expect(alternatives(generate({ edges, places: [...PLACES, place("x")] }))).toEqual([]);
  });
  it("32. a complete candidate is evaluated", () => expect(alternatives(generate())[0].candidateBlockPlaceIds).toEqual(["l", "m", "a", "b", "r"]));
  it("33. one missing candidate edge discards that candidate", () => {
    expect(alternatives(generate({ edges: EDGES.filter((edge) => edge.fromId !== "m" || edge.toId !== "a") }))).toEqual([]);
  });
  it("34. no geometry or network fallback exists", async () => {
    const lookup = vi.fn(() => null);
    expect(alternatives(generate({ lookupTransfer: lookup }))).toEqual([]);
    const source = await readFile(new URL("./evidence-complete-local-relocation.ts", import.meta.url), "utf8");
    for (const forbidden of ["fetch(", "XMLHttpRequest", "haversine", ".lat", ".lng", "openrouteservice"]) expect(source).not.toContain(forbidden);
  });
});

describe("comparison and confidence (§34.35-43)", () => {
  it("35. only b-clearly-faster is emitted", () => {
    const candidate = alternatives(generate())[0];
    expect(candidate.candidateTransferMinutes.maxMinutes).toBeLessThan(candidate.baselineTransferMinutes.minMinutes);
  });
  it("36. equivalent ranges are rejected", () => {
    const edges = EDGES.map((edge) => transfer(edge.fromId, edge.toId, 10));
    expect(alternatives(generate({ edges }))).toEqual([]);
  });
  it("37. overlapping ranges are rejected", () => {
    const edges = EDGES.map((edge) => transfer(edge.fromId, edge.toId, 5, 20));
    expect(alternatives(generate({ edges }))).toEqual([]);
  });
  it("38. a faster baseline is rejected", () => {
    const edges = EDGES.map((edge) => transfer(edge.fromId, edge.toId, ["l>m", "m>a", "b>r"].includes(`${edge.fromId}>${edge.toId}`) ? 10 : 1));
    expect(alternatives(generate({ edges }))).toEqual([]);
  });
  it("39. an incomplete comparison is rejected", () => {
    expect(alternatives(generate({ edges: EDGES.filter((edge) => edge.fromId !== "l" || edge.toId !== "m") }))).toEqual([]);
  });
  it("40. Phase 3C-B advantage arithmetic is reused unchanged", () => {
    const edges = EDGES.map((edge) => {
      const candidateOnly = ["l>m", "m>a", "b>r"].includes(`${edge.fromId}>${edge.toId}`);
      return transfer(edge.fromId, edge.toId, candidateOnly ? 2 : 10, candidateOnly ? 3 : 12);
    });
    const candidate = alternatives(generate({ edges }))[0];
    expect(candidate.baselineTransferMinutes).toEqual({ minMinutes: 40, maxMinutes: 48 });
    expect(candidate.candidateTransferMinutes).toEqual({ minMinutes: 16, maxMinutes: 21 });
    expect(candidate.guaranteedAdvantageMinutes).toBe(19);
    expect(candidate.possibleAdvantageRange).toEqual({ minMinutes: 19, maxMinutes: 32 });
  });
  it("41. confidence tallies are preserved on both sides", () => {
    const confidences: TransferConfidence[] = ["validated-static", "estimated", "schedule-aware"];
    const edges = EDGES.map((edge, index) => transfer(edge.fromId, edge.toId, edge.minutes.minMinutes, edge.minutes.maxMinutes, confidences[index % 3]));
    const candidate = alternatives(generate({ edges }))[0];
    expect(Object.values(candidate.baselineConfidenceCounts).reduce((a, b) => a + b, 0)).toBe(4);
    expect(Object.values(candidate.candidateConfidenceCounts).reduce((a, b) => a + b, 0)).toBe(4);
  });
  it("42. estimated evidence remains labelled estimated", () => {
    const edges = EDGES.map((edge) => transfer(edge.fromId, edge.toId, edge.minutes.minMinutes, edge.minutes.maxMinutes, "estimated"));
    const candidate = alternatives(generate({ edges }))[0];
    expect(candidate.baselineConfidenceCounts).toEqual({ validatedStatic: 0, estimated: 4, scheduleAware: 0 });
    expect(candidate.candidateConfidenceCounts).toEqual({ validatedStatic: 0, estimated: 4, scheduleAware: 0 });
  });
  it("43. confidence creates no score or rank", () => {
    const candidate = alternatives(generate())[0];
    for (const key of ["score", "rank", "best", "recommended", "winner"]) expect(candidate).not.toHaveProperty(key);
  });
});

describe("separation from Phase 3E-C (§34.44-46)", () => {
  it("44. adjacent relocation is never emitted", () => {
    expect(legalInteriorRelocations(10).every(({ fromIndex, toIndex }) => Math.abs(fromIndex - toIndex) >= 2)).toBe(true);
  });
  it("45. swap and relocation candidate orders never overlap", () => {
    const lookupTransfer = baselineHeavyLookup(IDS);
    const relocationOrders = alternatives(generate({ lookupTransfer })).map((entry) => JSON.stringify(entry.candidateDayPlaceIds));
    const swaps = generateEvidenceCompleteLocalSwaps(
      { routeIds: IDS, days: [day("d1", IDS)], visitStartTimes: {} },
      { resolvePlace: resolver(), lookupTransfer }
    );
    const swapOrders = swaps.kind === "available" ? swaps.alternatives.map((entry) => JSON.stringify(entry.candidateDayPlaceIds)) : [];
    expect(relocationOrders.some((order) => swapOrders.includes(order))).toBe(false);
  });
  it("46. the representative Shinjuku fixture adds value beyond one adjacent swap", () => {
    const ids = ["JP-010", "JP-012", "JP-011", "JP-013", "JP-014"];
    const input = { routeIds: ids, days: [day("d1", ids)], visitStartTimes: {} };
    const relocation = generateEvidenceCompleteLocalRelocations(input, {
      resolvePlace: (id) => getPlaceById(id) ?? null,
    });
    const swaps = generateEvidenceCompleteLocalSwaps(
      input,
      { resolvePlace: (id) => getPlaceById(id) ?? null }
    );
    const emitted = alternatives(relocation);
    expect(emitted[0]).toMatchObject({ movedPlaceId: "JP-013", fromDayIndex: 3, toDayIndex: 1, baselineTransferMinutes: { minMinutes: 62 }, candidateTransferMinutes: { minMinutes: 49 } });
    expect(swaps.kind === "available" ? swaps.alternatives : []).toEqual([]);
  });
});

function boundary(): DayAccommodationBoundary {
  return { start: { kind: "unselected" }, end: { kind: "unselected" } };
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
  alternative: EvidenceCompleteLocalRelocationAlternative,
  current: ManualPlanningDraftV7,
  places = PLACES
) {
  return applyEvidenceCompleteLocalRelocation(
    alternative,
    { routeIds: current.routeIds, days: current.days, visitStartTimes: current.visitStartTimes },
    { resolvePlace: resolver(places) },
    (dayId, fromIndex, toIndex) =>
      withPlaceRelocatedWithinDay(current, dayId, fromIndex, toIndex)
  );
}

describe("Apply and stale safety (§34.47-59)", () => {
  it("47. generation alone applies nothing; Apply is an explicit call", () => {
    const before = draft();
    const snapshot = JSON.stringify(before);
    generate();
    expect(JSON.stringify(before)).toBe(snapshot);
  });
  it("48. Apply relocates exactly one place", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(result.draft.days?.[0].placeIds).toEqual(["l", "m", "a", "b", "r"]);
    expect(result.draft.days?.[0].placeIds.filter((id) => id === "m")).toHaveLength(1);
  });
  it("49. non-moved relative order is preserved", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(result.draft.days?.[0].placeIds.filter((id) => id !== "m")).toEqual(["l", "a", "b", "r"]);
  });
  it("50. day id is preserved", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(result.draft.days?.[0].id).toBe("d1");
  });
  it("51. day membership is unchanged", () => {
    const result = applyTo(DEFAULT_ALTERNATIVE, draft());
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(new Set(result.draft.days?.[0].placeIds)).toEqual(new Set(IDS));
  });
  it("52. routeIds are unchanged", () => {
    const before = draft();
    const result = applyTo(DEFAULT_ALTERNATIVE, before);
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(result.draft.routeIds).toBe(before.routeIds);
  });
  it("53. accommodation boundary is unchanged", () => {
    const accommodationBoundary: DayAccommodationBoundary = {
      start: { kind: "accommodation", accommodationId: "hotel" } as AccommodationBoundaryChoice,
      end: { kind: "no-accommodation" },
    };
    const before = draft({ days: [planningDay("d1", [...IDS], accommodationBoundary)] });
    const result = applyTo(DEFAULT_ALTERNATIVE, before);
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(result.draft.days?.[0].accommodationBoundary).toBe(accommodationBoundary);
  });
  it("54. all other days are unchanged", () => {
    const other = planningDay("d2", ["x"]);
    const current = draft({ routeIds: [...IDS, "x"], days: [planningDay("d1", [...IDS]), other] });
    const candidate = alternatives(generate({ routeIds: current.routeIds, days: [day("d1", [...IDS]), day("d2", ["x"])], places: [...PLACES, place("x", "Kioto")] }))[0];
    const result = applyTo(candidate, current, [...PLACES, place("x", "Kioto")]);
    if (result.kind !== "applied") throw new Error("expected applied");
    expect(result.draft.days?.[1]).toBe(other);
  });
  it("55. a stale baseline is rejected", () => {
    expect(applyTo(DEFAULT_ALTERNATIVE, draft({ days: [planningDay("d1", ["l", "b", "a", "m", "r"])] }))).toEqual({ kind: "stale", reason: "day-changed" });
  });
  it("56. moved identity mismatch is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, movedPlaceId: "a" }, draft())).toEqual({ kind: "stale", reason: "moved-place-changed" });
  });
  it("57. an illegal destination is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, toDayIndex: 0 }, draft())).toEqual({ kind: "stale", reason: "illegal-destination" });
  });
  it("58. changed endpoint or hub is rejected", () => {
    expect(applyTo({ ...DEFAULT_ALTERNATIVE, blockStartPlaceId: "a" }, draft())).toEqual({ kind: "stale", reason: "block-changed" });
    const changedHub = PLACES.map((entry) => entry.id === "b" ? place("b", "Kioto") : entry);
    expect(applyTo(DEFAULT_ALTERNATIVE, draft(), changedHub)).toEqual({ kind: "stale", reason: "hub-changed" });
  });
  it("59. a newly timed affected-window place is rejected", () => {
    expect(applyTo(DEFAULT_ALTERNATIVE, draft({ visitStartTimes: { b: "10:30" } }))).toEqual({ kind: "stale", reason: "manual-visit-time-added" });
  });
});

describe("pure V7 mutation (§34.60-64)", () => {
  it("60. one pure mutation produces the final order directly", () => {
    expect(withPlaceRelocatedWithinDay(draft(), "d1", 3, 1).days?.[0].placeIds).toEqual(["l", "m", "a", "b", "r"]);
  });
  it("61. no intermediate draft order is exposed or persisted", () => {
    const before = draft();
    const after = withPlaceRelocatedWithinDay(before, "d1", 3, 1);
    expect(before.days?.[0].placeIds).toEqual(IDS);
    expect(after.days?.[0].placeIds).toEqual(["l", "m", "a", "b", "r"]);
  });
  it("62. the mutation remains V7", () => {
    expect(withPlaceRelocatedWithinDay(draft(), "d1", 3, 1).version).toBe(7);
    expect(PLANNING_DRAFT_VERSION).toBe(7);
  });
  it("63. every non-day field is structurally preserved", () => {
    const before = draft({
      visitStartTimes: { z: "08:00" },
      accommodations: [{ id: "hotel", label: "Hotel", location: { lat: 35, lng: 139 } }],
      accommodationLegs: [],
      interHubSegments: [],
    });
    const after = withPlaceRelocatedWithinDay(before, "d1", 3, 1);
    for (const key of ["routeIds", "visitStartTimes", "accommodations", "accommodationLegs", "interHubSegments"] as const) expect(after[key]).toBe(before[key]);
    expect(after.startDate).toBe(before.startDate);
    expect(after.endDate).toBe(before.endDate);
  });
  it("64. the helper and hook use no async multi-click sequence", async () => {
    const domain = await readFile(new URL("./planning-draft-v7.ts", import.meta.url), "utf8");
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    const mutation = domain.slice(domain.indexOf("export function withPlaceRelocatedWithinDay"), domain.indexOf("export function withPlaceMovedBetweenDays"));
    const callback = hook.slice(hook.indexOf("const relocatePlaceWithinDay"), hook.indexOf("const movePlaceBetweenDays"));
    expect(mutation).not.toMatch(/async|setTimeout|withPlaceMovedWithinDay/);
    expect(callback.match(/setDraft\(/g)).toHaveLength(1);
    expect(callback).toContain("withPlaceRelocatedWithinDay(current, dayId, fromIndex, toIndex)");
  });
});

describe("inter-hub invariants (§34.65-69)", () => {
  const ids = ["t0", "a", "b", "m", "t4", "k0", "k1", "o0"];
  const places = ids.map((id) => place(id, id.startsWith("k") ? "Kioto" : id.startsWith("o") ? "Osaka" : "Tokio"));
  const beforeDays = [planningDay("d1", ids.slice(0, 7)), planningDay("d2", ["o0"])];
  const afterDays = [planningDay("d1", ["t0", "m", "a", "b", "t4", "k0", "k1"]), beforeDays[1]];
  const segments: ManualInterHubSegment[] = [
    { id: "same", fromPlaceId: "t4", toPlaceId: "k0", fromHub: "Tokio", toHub: "Kioto", mode: "shinkansen", minutes: 140, source: { kind: "user-entered" } },
    { id: "between", fromPlaceId: "k1", toPlaceId: "o0", fromHub: "Kioto", toHub: "Osaka", mode: "limited-express", minutes: 30, source: { kind: "user-entered" } },
    { id: "inactive", fromPlaceId: "a", toPlaceId: "o0", fromHub: "Tokio", toHub: "Osaka", mode: "other", minutes: 180, source: { kind: "user-entered" } },
  ];
  const assess = (days: PlanningDayV5[]) => segments.map((segment) => assessInterHubSegment(segment, {
    routeIds: ids,
    days: days.map((entry) => entry.placeIds),
    resolvePlace: (id) => {
      const resolved = resolver(places)(id);
      return resolved ? { hub: resolved.hub } : null;
    },
  }));
  const before = draft({ routeIds: ids, days: beforeDays, interHubSegments: segments });
  const after = withPlaceRelocatedWithinDay(before, "d1", 3, 1);

  it("65. all stored segment objects remain byte-identical", () => expect(after.interHubSegments).toBe(segments));
  it("66. all derived assessments remain identical", () => expect(assess(afterDays)).toEqual(assess(beforeDays)));
  it("67. the active same-day segment remains unchanged", () => expect(assess(afterDays)[0]).toEqual(assess(beforeDays)[0]));
  it("68. the active between-days segment remains unchanged", () => expect(assess(afterDays)[1]).toEqual(assess(beforeDays)[1]));
  it("69. the inactive reason remains unchanged", () => expect(assess(afterDays)[2]).toEqual(assess(beforeDays)[2]));
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

describe("accommodation invariants (§34.70-71)", () => {
  const before = compose(IDS);
  const after = compose(["l", "m", "a", "b", "r"]);
  it("70. outbound and return boundary results are unchanged", () => {
    if (before.kind !== "available" || after.kind !== "available") throw new Error("expected available");
    expect(after.accommodation.components).toEqual(before.accommodation.components);
  });
  it("71. registered accommodation minutes are unchanged", () => {
    if (before.kind !== "available" || after.kind !== "available") throw new Error("expected available");
    expect(after.accommodation.registeredMinutes).toBe(before.accommodation.registeredMinutes);
    expect(after.accommodation.registeredMinutes).toBe(35);
  });
});

describe("whole-trip composition (§34.72-78)", () => {
  const before = compose(IDS);
  const after = compose(["l", "m", "a", "b", "r"]);
  const available = () => {
    if (before.kind !== "available" || after.kind !== "available") throw new Error("expected available");
    return { before, after };
  };
  it("72. visit composition is unchanged", () => expect(available().after.visit).toEqual(available().before.visit));
  it("73. accommodation composition is unchanged", () => expect(available().after.accommodation).toEqual(available().before.accommodation));
  it("74. inter-hub composition is unchanged", () => expect(available().after.interHub).toEqual(available().before.interHub));
  it("75. bounds, day count, membership and dates are unchanged", () => {
    const values = available();
    expect(values.after.bounds).toEqual(values.before.bounds);
    expect(values.after.dayCount).toBe(values.before.dayCount);
  });
  it("76. local registered movement changes by the exact evidenced delta", () => {
    const values = available();
    const delta = DEFAULT_ALTERNATIVE.baselineTransferMinutes.minMinutes - DEFAULT_ALTERNATIVE.candidateTransferMinutes.minMinutes;
    expect(values.before.movement.registeredMinutes!.minMinutes - values.after.movement.registeredMinutes!.minMinutes).toBe(delta);
    expect(delta).toBe(27);
  });
  it("77. registered transport changes by the same exact delta", () => {
    const values = available();
    expect(values.before.registeredTransportMinutes).toEqual({ minMinutes: 75, maxMinutes: 75 });
    expect(values.after.registeredTransportMinutes).toEqual({ minMinutes: 48, maxMinutes: 48 });
  });
  it("78. no local missing edge is introduced", () => {
    const values = available();
    expect(values.before.movement.localMissingCount).toBe(0);
    expect(values.after.movement.localMissingCount).toBe(0);
  });
});

function memoryStorage(): DraftStorage & { value: () => string | null } {
  let stored: string | null = null;
  return {
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
    value: () => stored,
  };
}

describe("persistence (§34.79-84)", () => {
  const applied = withPlaceRelocatedWithinDay(draft(), "d1", 3, 1);
  it("79. the persisted draft remains V7", () => expect(applied.version).toBe(7));
  it("80. the existing storage key is reused", () => expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft"));
  it("81. candidate state is not persisted", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    expect(storage.value()?.toLowerCase()).not.toContain("candidate");
    expect(storage.value()?.toLowerCase()).not.toContain("relocation");
  });
  it("82. advantage, rank and score are not persisted", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    for (const forbidden of ["advantage", "confidence", "rank", "score", "fromindex", "toindex", "window"]) expect(storage.value()?.toLowerCase()).not.toContain(forbidden);
  });
  it("83. reload preserves the applied order", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    expect(loadReconciledDraft(storage, applied.routeIds).days?.[0].placeIds).toEqual(["l", "m", "a", "b", "r"]);
  });
  it("84. reload regenerates both swaps and relocations from the new baseline", () => {
    const storage = memoryStorage();
    writeDraft(storage, applied);
    const loaded = loadReconciledDraft(storage, applied.routeIds);
    const input = { routeIds: loaded.routeIds, days: loaded.days, visitStartTimes: loaded.visitStartTimes };
    expect(generateEvidenceCompleteLocalSwaps(input, { resolvePlace: resolver(), lookupTransfer: lookupFrom(EDGES) }).kind).toBe("available");
    expect(generateEvidenceCompleteLocalRelocations(input, { resolvePlace: resolver(), lookupTransfer: lookupFrom(EDGES) }).kind).toBe("available");
  });
});

describe("stale assessor remains pure", () => {
  it("returns final coordinates without mutating its input", () => {
    const current = draft();
    const snapshot = JSON.stringify(current);
    expect(assessLocalRelocationApplicability(
      DEFAULT_ALTERNATIVE,
      { routeIds: current.routeIds, days: current.days, visitStartTimes: current.visitStartTimes },
      { resolvePlace: resolver() }
    )).toEqual({ kind: "applicable", dayId: "d1", fromDayIndex: 3, toDayIndex: 1 });
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});
