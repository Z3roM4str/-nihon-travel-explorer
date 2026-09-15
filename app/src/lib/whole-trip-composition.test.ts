import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import type { Place } from "../types";
import type {
  AccommodationBoundaryChoice,
  DayAccommodationBoundary,
  ManualAccommodationLeg,
} from "./accommodation-commute";
import type { ManualInterHubSegment } from "./inter-hub-segment";
import { PLANNING_DRAFT_STORAGE_KEY, PLANNING_DRAFT_VERSION } from "./planning-draft-v7";
import { sequenceComparisonFromLookup } from "./sequence-comparison";
import { buildTripBoundsSummary } from "./trip-bounds";
import { normalizeTransferMode, type TransferEdge } from "./transfer";
import {
  buildWholeTripComposition,
  type WholeTripComposition,
  type WholeTripCompositionDay,
  type WholeTripCompositionInput,
} from "./whole-trip-composition";

function place(id: string, hub: string, raw = "60 min", minMinutes?: number, maxMinutes?: number): Place {
  return {
    id,
    hub,
    name: id,
    duration:
      minMinutes === undefined
        ? { raw }
        : { raw, minMinutes, maxMinutes: maxMinutes ?? minMinutes },
  } as unknown as Place;
}

function boundary(
  start: AccommodationBoundaryChoice = { kind: "unselected" },
  end: AccommodationBoundaryChoice = { kind: "unselected" }
): DayAccommodationBoundary {
  return { start, end };
}

function day(placeIds: string[], accommodationBoundary = boundary()): WholeTripCompositionDay {
  return { placeIds, accommodationBoundary };
}

function segment(overrides: Partial<ManualInterHubSegment> = {}): ManualInterHubSegment {
  return {
    id: "segment-a-c",
    fromPlaceId: "a",
    toPlaceId: "c",
    fromHub: "Tokio",
    toHub: "Kioto",
    mode: "shinkansen",
    minutes: 50,
    source: { kind: "user-entered" },
    ...overrides,
  };
}

function transfer(fromId: string, toId: string, minMinutes: number, maxMinutes = minMinutes): TransferEdge {
  return { fromId, toId, minutes: { minMinutes, maxMinutes } } as TransferEdge;
}

const defaultPlaces = [place("a", "Tokio", "30–60 min", 30, 60), place("b", "Tokio", "45 min", 45, 45)];

function compose({
  routeIds = ["a", "b"],
  days = [day(["a", "b"])],
  places = defaultPlaces,
  interHubSegments = [],
  accommodationLegs = [],
  startDate = null,
  endDate = null,
  lookupTransfer = () => null,
}: {
  routeIds?: string[];
  days?: WholeTripCompositionDay[] | null;
  places?: Place[];
  interHubSegments?: ManualInterHubSegment[];
  accommodationLegs?: ManualAccommodationLeg[];
  startDate?: string | null;
  endDate?: string | null;
  lookupTransfer?: (fromId: string, toId: string) => TransferEdge | null;
} = {}): WholeTripComposition {
  const byId = new Map(places.map((entry) => [entry.id, entry]));
  const input: WholeTripCompositionInput = {
    routeIds,
    days,
    interHubSegments,
    accommodationLegs,
    bounds: { startDate, endDate },
  };
  return buildWholeTripComposition(input, {
    resolvePlace: (id) => byId.get(id) ?? null,
    lookupTransfer,
  });
}

function available(options: Parameters<typeof compose>[0] = {}) {
  const result = compose(options);
  if (result.kind !== "available") throw new Error(`Expected available, received ${result.reason}`);
  return result;
}

describe("whole-trip availability", () => {
  it("requires days and never falls back to route order", () => {
    const lookup = vi.fn(() => transfer("a", "b", 10));
    expect(compose({ days: null, lookupTransfer: lookup })).toEqual({
      kind: "unavailable",
      reason: "no-day-assignment",
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects an invalid partition without repairing it", () => {
    expect(compose({ days: [day(["a"])] })).toEqual({
      kind: "unavailable",
      reason: "invalid-day-partition",
    });
  });

  it("rejects an unresolved route place instead of filtering it", () => {
    expect(compose({ places: [defaultPlaces[0]] })).toEqual({
      kind: "unavailable",
      reason: "unresolved-route-place",
    });
  });

  it("composes a valid partition when every route place resolves", () => {
    expect(compose().kind).toBe("available");
  });
});

describe("visit composition delegates to selection taxonomy", () => {
  it("adds quantified range minima and maxima independently", () => {
    const result = available();
    expect(result.visit).toEqual({
      quantifiedMinutes: { minMinutes: 75, maxMinutes: 105 },
      quantifiedPlaceCount: 2,
      nonQuantifiedPlaceCount: 0,
      dayScaleCommitmentCount: 0,
      unclassifiedPlaceCount: 0,
      completeNumericCoverage: true,
    });
  });

  it("keeps day-scale and unclassified durations non-numeric and makes coverage incomplete", () => {
    const places = [
      place("a", "Tokio", "30 min", 30, 30),
      place("b", "Tokio", "Día completo"),
      place("c", "Tokio", ""),
    ];
    const result = available({ routeIds: ["a", "b", "c"], days: [day(["a", "b", "c"])], places });
    expect(result.visit.quantifiedMinutes).toEqual({ minMinutes: 30, maxMinutes: 30 });
    expect(result.visit.quantifiedPlaceCount).toBe(1);
    expect(result.visit.nonQuantifiedPlaceCount).toBe(2);
    expect(result.visit.dayScaleCommitmentCount).toBe(1);
    expect(result.visit.unclassifiedPlaceCount).toBe(1);
    expect(result.visit.completeNumericCoverage).toBe(false);
  });
});

describe("same-day movement classification", () => {
  it("uses one exact directed local edge for a same-hub slot", () => {
    const edge = transfer("a", "b", 10, 15);
    const lookup = vi.fn((fromId: string, toId: string) =>
      fromId === "a" && toId === "b" ? edge : null
    );
    const result = available({ lookupTransfer: lookup });
    expect(result.movement.components).toEqual([
      { kind: "local-transfer", dayOrdinal: 0, fromPlaceId: "a", toPlaceId: "b", transfer: edge },
    ]);
    expect(result.movement.registeredMinutes).toEqual({ minMinutes: 10, maxMinutes: 15 });
    expect(result.movement.localKnownCount).toBe(1);
    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith("a", "b");
  });

  it("does not reuse a reverse edge when the directed slot is missing", () => {
    const lookup = vi.fn((fromId: string, toId: string) =>
      fromId === "b" && toId === "a" ? transfer("b", "a", 8) : null
    );
    const result = available({ lookupTransfer: lookup });
    expect(result.movement.components[0]).toEqual({
      kind: "local-transfer-missing",
      dayOrdinal: 0,
      fromPlaceId: "a",
      toPlaceId: "b",
    });
    expect(result.movement.localMissingCount).toBe(1);
    expect(result.movement.registeredMinutes).toBeNull();
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("counts an active same-day inter-hub segment exactly and never calls local lookup", () => {
    const places = [place("a", "Tokio"), place("c", "Kioto")];
    const lookup = vi.fn(() => transfer("a", "c", 5));
    const result = available({
      routeIds: ["a", "c"],
      days: [day(["a", "c"])],
      places,
      interHubSegments: [segment()],
      lookupTransfer: lookup,
    });
    expect(result.movement.components).toEqual([
      {
        kind: "inter-hub",
        fromDayOrdinal: 0,
        toDayOrdinal: 0,
        fromPlaceId: "a",
        toPlaceId: "c",
        segmentId: "segment-a-c",
        minutes: 50,
        mode: "shinkansen",
        placement: "same-day",
      },
    ]);
    expect(result.movement.registeredMinutes).toEqual({ minMinutes: 50, maxMinutes: 50 });
    expect(result.movement.interHubActiveCount).toBe(1);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("marks missing or inactive cross-hub evidence without adding zero", () => {
    const places = [place("a", "Tokio"), place("x", "Osaka"), place("c", "Kioto")];
    const result = available({
      routeIds: ["a", "x", "c"],
      days: [day(["a", "x", "c"])],
      places,
      interHubSegments: [segment()],
    });
    expect(result.movement.interHubMissingCount).toBe(2);
    expect(result.movement.registeredMinutes).toBeNull();
    expect(result.interHub.activeSegmentIds).toEqual([]);
    expect(result.interHub.inactiveSegmentIds).toEqual(["segment-a-c"]);
  });
});

describe("day boundary classification", () => {
  it("creates no ordinary transfer slot across a same-hub day boundary", () => {
    const lookup = vi.fn(() => transfer("a", "b", 10));
    const result = available({ days: [day(["a"]), day(["b"])], lookupTransfer: lookup });
    expect(result.movement.components).toEqual([]);
    expect(result.movement.modeledAdjacencyCount).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("counts an exact active different-hub consecutive-day segment once", () => {
    const result = available({
      routeIds: ["a", "c"],
      days: [day(["a"]), day(["c"])],
      places: [place("a", "Tokio"), place("c", "Kioto")],
      interHubSegments: [segment()],
    });
    expect(result.movement.components).toHaveLength(1);
    expect(result.movement.components[0]).toMatchObject({
      kind: "inter-hub",
      placement: "between-consecutive-days",
      segmentId: "segment-a-c",
    });
    expect(result.interHub.registeredMinutes).toBe(50);
    expect(result.interHub.activeSegmentIds).toEqual(["segment-a-c"]);
  });

  it("records a missing expected inter-hub boundary", () => {
    const result = available({
      routeIds: ["a", "c"],
      days: [day(["a"]), day(["c"])],
      places: [place("a", "Tokio"), place("c", "Kioto")],
    });
    expect(result.movement.components[0]).toMatchObject({
      kind: "inter-hub-missing",
      placement: "between-consecutive-days",
    });
    expect(result.movement.interHubMissingCount).toBe(1);
    expect(result.interHub.missingExpectedCount).toBe(1);
  });

  it("does not flatten across an empty intervening day", () => {
    const result = available({
      routeIds: ["a", "c"],
      days: [day(["a"]), day([]), day(["c"])],
      places: [place("a", "Tokio"), place("c", "Kioto")],
      interHubSegments: [segment()],
    });
    expect(result.movement.components).toEqual([]);
    expect(result.interHub.activeSegmentIds).toEqual([]);
    expect(result.interHub.inactiveSegmentIds).toEqual(["segment-a-c"]);
  });
});

describe("accommodation composition", () => {
  const hotel = { kind: "accommodation", accommodationId: "hotel" } as const;
  const noAccommodation = { kind: "no-accommodation" } as const;

  it("counts exact outbound and return legs once", () => {
    const accommodationLegs: ManualAccommodationLeg[] = [
      {
        direction: "accommodation-to-place",
        accommodationId: "hotel",
        placeId: "a",
        minutes: 12,
        source: { kind: "user-entered" },
      },
      {
        direction: "place-to-accommodation",
        placeId: "b",
        accommodationId: "hotel",
        minutes: 18,
        source: { kind: "user-entered" },
      },
    ];
    const result = available({ days: [day(["a", "b"], boundary(hotel, hotel))], accommodationLegs });
    expect(result.accommodation.registeredMinutes).toBe(30);
    expect(result.accommodation.manualLegCount).toBe(2);
    expect(result.accommodation.components.map((entry) => entry.result.kind)).toEqual([
      "manual-leg",
      "manual-leg",
    ]);
  });

  it("keeps missing, unselected and explicit no-accommodation distinct", () => {
    const result = available({
      days: [
        day(["a"], boundary(hotel, { kind: "unselected" })),
        day(["b"], boundary(noAccommodation, noAccommodation)),
      ],
    });
    expect(result.accommodation.registeredMinutes).toBeNull();
    expect(result.accommodation.manualLegMissingCount).toBe(1);
    expect(result.accommodation.boundaryUnselectedCount).toBe(1);
    expect(result.accommodation.explicitNoAccommodationCount).toBe(2);
  });

  it("counts both sides of an empty day as not applicable", () => {
    const result = available({
      routeIds: ["a"],
      days: [day(["a"]), day([])],
      places: [place("a", "Tokio")],
    });
    expect(result.accommodation.emptyDayNotApplicableCount).toBe(2);
    expect(result.accommodation.components.slice(-2).map((entry) => entry.result)).toEqual([
      { kind: "not-applicable", side: "start", reason: "empty-day" },
      { kind: "not-applicable", side: "end", reason: "empty-day" },
    ]);
  });

  it("never infers an outbound leg from a reverse-direction record", () => {
    const wrongDirection: ManualAccommodationLeg = {
      direction: "place-to-accommodation",
      placeId: "a",
      accommodationId: "hotel",
      minutes: 9,
      source: { kind: "user-entered" },
    };
    const result = available({
      routeIds: ["a"],
      days: [day(["a"], boundary(hotel, noAccommodation))],
      places: [place("a", "Tokio")],
      accommodationLegs: [wrongDirection],
    });
    expect(result.accommodation.manualLegMissingCount).toBe(1);
    expect(result.accommodation.manualLegCount).toBe(0);
  });
});

describe("registered subtotals and explicit coverage", () => {
  it("adds known local, active inter-hub and exact accommodation minutes without visit minutes", () => {
    const hotel = { kind: "accommodation", accommodationId: "hotel" } as const;
    const accommodationLegs: ManualAccommodationLeg[] = [
      {
        direction: "accommodation-to-place",
        accommodationId: "hotel",
        placeId: "a",
        minutes: 5,
        source: { kind: "user-entered" },
      },
      {
        direction: "place-to-accommodation",
        placeId: "c",
        accommodationId: "hotel",
        minutes: 7,
        source: { kind: "user-entered" },
      },
    ];
    const result = available({
      routeIds: ["a", "b", "c"],
      days: [day(["a", "b", "c"], boundary(hotel, hotel))],
      places: [place("a", "Tokio", "30 min", 30), place("b", "Tokio", "30 min", 30), place("c", "Kioto", "30 min", 30)],
      interHubSegments: [segment({ fromPlaceId: "b", id: "segment-b-c" })],
      accommodationLegs,
      lookupTransfer: (fromId, toId) => (fromId === "a" && toId === "b" ? transfer(fromId, toId, 10, 15) : null),
    });
    expect(result.movement.registeredMinutes).toEqual({ minMinutes: 60, maxMinutes: 65 });
    expect(result.accommodation.registeredMinutes).toBe(12);
    expect(result.registeredTransportMinutes).toEqual({ minMinutes: 72, maxMinutes: 77 });
    expect(result.visit.quantifiedMinutes).toEqual({ minMinutes: 90, maxMinutes: 90 });
  });

  it("returns null rather than synthetic zero when nothing is registered and keeps missing counts", () => {
    const result = available();
    expect(result.movement.registeredMinutes).toBeNull();
    expect(result.accommodation.registeredMinutes).toBeNull();
    expect(result.registeredTransportMinutes).toBeNull();
    expect(result.movement.localMissingCount).toBe(1);
    expect(result.movement.modeledAdjacencyCount).toBe(1);
    expect(result.movement.adjacencyCoverageComplete).toBe(false);
  });

  it("exposes vacuous domain completeness at zero slots for the UI to qualify", () => {
    const result = available({ routeIds: ["a"], days: [day(["a"])], places: [place("a", "Tokio")] });
    expect(result.movement.modeledAdjacencyCount).toBe(0);
    expect(result.movement.adjacencyCoverageComplete).toBe(true);
  });

  it("contains no visit-plus-transport grand-total contract", async () => {
    const source = await readFile(new URL("./whole-trip-composition.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/totalTripMinutes|tripScore|itineraryScore|qualityScore|optimisationScore/);
    expect(source).not.toMatch(/registeredTransportMinutes\s*[^\n]*visit|visit\s*[^\n]*registeredTransportMinutes/);
  });
});

describe("inter-hub identity", () => {
  const places = [place("a", "Tokio"), place("c", "Kioto")];

  it("keeps inactive stored evidence identifiable with no contribution or reassignment", () => {
    const stored = segment();
    const result = available({
      routeIds: ["c", "a"],
      days: [day(["c"]), day(["a"])],
      places,
      interHubSegments: [stored],
    });
    expect(result.interHub.activeSegmentIds).toEqual([]);
    expect(result.interHub.inactiveSegmentIds).toEqual([stored.id]);
    expect(result.interHub.registeredMinutes).toBeNull();
    expect(result.movement.interHubMissingCount).toBe(1);
  });

  it("reorder changes derivation without mutating the stored segment", () => {
    const stored = segment();
    const before = JSON.stringify(stored);
    const active = available({
      routeIds: ["a", "c"],
      days: [day(["a"]), day(["c"])],
      places,
      interHubSegments: [stored],
    });
    const inactive = available({
      routeIds: ["a", "c"],
      days: [day(["c"]), day(["a"])],
      places,
      interHubSegments: [stored],
    });
    expect(active.interHub.registeredMinutes).toBe(50);
    expect(inactive.interHub.registeredMinutes).toBeNull();
    expect(inactive.movement.interHubMissingCount).toBe(1);
    expect(JSON.stringify(stored)).toBe(before);
  });

  it("changing manual minutes updates derived movement only", () => {
    const base = {
      routeIds: ["a", "c"],
      days: [day(["a"]), day(["c"])],
      places,
    };
    const first = available({ ...base, interHubSegments: [segment({ minutes: 50 })] });
    const edited = available({ ...base, interHubSegments: [segment({ minutes: 80 })] });
    expect(first.movement.registeredMinutes).toEqual({ minMinutes: 50, maxMinutes: 50 });
    expect(edited.movement.registeredMinutes).toEqual({ minMinutes: 80, maxMinutes: 80 });
    expect(edited.visit).toEqual(first.visit);
    expect(edited.bounds).toEqual(first.bounds);
  });
});

describe("trip bounds annotate and never filter", () => {
  it("projects the existing summary and includes an after-end day's facts in every subtotal", () => {
    const hotel = { kind: "accommodation", accommodationId: "hotel" } as const;
    const leg: ManualAccommodationLeg = {
      direction: "place-to-accommodation",
      placeId: "d",
      accommodationId: "hotel",
      minutes: 9,
      source: { kind: "user-entered" },
    };
    const result = available({
      routeIds: ["a", "c", "d"],
      days: [day(["a"]), day(["c", "d"], boundary({ kind: "no-accommodation" }, hotel))],
      places: [place("a", "Tokio", "30 min", 30), place("c", "Kioto", "40 min", 40), place("d", "Kioto", "50 min", 50)],
      interHubSegments: [segment()],
      lookupTransfer: (fromId, toId) => (fromId === "c" && toId === "d" ? transfer(fromId, toId, 11) : null),
      accommodationLegs: [leg],
      startDate: "2027-02-19",
      endDate: "2027-02-19",
    });
    expect(result.bounds).toEqual(buildTripBoundsSummary({ startDate: "2027-02-19", endDate: "2027-02-19" }, 2));
    expect(result.bounds).toEqual({
      startDate: "2027-02-19",
      endDate: "2027-02-19",
      tripCalendarDays: 1,
      dayCount: 2,
      daysAfterTripEnd: 1,
      unavailableReason: null,
    });
    expect(result.visit.quantifiedPlaceCount).toBe(3);
    expect(result.movement.registeredMinutes).toEqual({ minMinutes: 61, maxMinutes: 61 });
    expect(result.interHub.registeredMinutes).toBe(50);
    expect(result.accommodation.registeredMinutes).toBe(9);
    expect(result.registeredTransportMinutes).toEqual({ minMinutes: 70, maxMinutes: 70 });
  });

  it.each([
    [null, null, "no-start-date"],
    ["2027-02-19", null, "no-end-date"],
    ["2027-02-21", "2027-02-19", "inverted-range"],
    ["2027-02-30", "2027-03-01", "invalid-date"],
  ] as const)("keeps neutral bounds %s/%s available", (startDate, endDate, unavailableReason) => {
    const result = available({ startDate, endDate });
    expect(result.bounds.unavailableReason).toBe(unavailableReason);
    expect(result.kind).toBe("available");
    expect(result.visit.quantifiedPlaceCount).toBe(2);
  });
});

describe("derived accommodation edits and reload parity", () => {
  it("updates only applicable derived accommodation and transport values", () => {
    const hotel = { kind: "accommodation", accommodationId: "hotel" } as const;
    const makeLeg = (minutes: number): ManualAccommodationLeg => ({
      direction: "accommodation-to-place",
      accommodationId: "hotel",
      placeId: "a",
      minutes,
      source: { kind: "user-entered" },
    });
    const options = {
      routeIds: ["a"],
      days: [day(["a"], boundary(hotel, { kind: "no-accommodation" } as const))],
      places: [place("a", "Tokio", "30 min", 30)],
    };
    const before = available({ ...options, accommodationLegs: [makeLeg(12)] });
    const after = available({ ...options, accommodationLegs: [makeLeg(20)] });
    expect(before.accommodation.registeredMinutes).toBe(12);
    expect(after.accommodation.registeredMinutes).toBe(20);
    expect(after.registeredTransportMinutes).toEqual({ minMinutes: 20, maxMinutes: 20 });
    expect(after.visit).toEqual(before.visit);
    expect(after.movement).toEqual(before.movement);
  });

  it("derives the same result twice from the same reloaded V7 facts", () => {
    const options = { lookupTransfer: () => transfer("a", "b", 14) };
    expect(compose(options)).toEqual(compose(options));
  });
});

describe("persistence and legacy-domain isolation", () => {
  it("keeps V7, the existing key and no persisted composition field", async () => {
    expect(PLANNING_DRAFT_VERSION).toBe(7);
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
    const source = await readFile(new URL("./planning-draft-v7.ts", import.meta.url), "utf8");
    expect(source).not.toContain("version: 8");
    expect(source).not.toContain("wholeTripComposition");
    expect(source).not.toContain("registeredTransportMinutes");
  });

  it("does not alter TransferMode or incomplete comparison semantics", () => {
    expect(normalizeTransferMode("A pie")).toBe("walk");
    expect(() => normalizeTransferMode("Shinkansen")).toThrow();
    expect(sequenceComparisonFromLookup(["a", "b"], ["b", "a"], () => null).outcome).toBe("incomplete");
  });

  it("is imported by none of the domains it consumes", async () => {
    for (const file of [
      "ordered-sequence.ts",
      "sequence-comparison.ts",
      "transfer.ts",
      "day-assignment.ts",
      "accommodation-commute.ts",
      "inter-hub-segment.ts",
      "trip-bounds.ts",
      "selection.ts",
      "planning-draft-v7.ts",
    ]) {
      const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source, file).not.toContain("whole-trip-composition");
    }
  });
});
