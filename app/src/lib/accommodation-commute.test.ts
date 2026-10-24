import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { OrderedSequenceSummary } from "./ordered-sequence";
import {
  buildDayLogisticsWithAccommodation,
  deriveAccommodationBoundaryLeg,
  findManualAccommodationLeg,
  hasUniqueAccommodationIds,
  hasUniqueManualAccommodationLegKeys,
  isValidAccommodationLocation,
  isValidManualAccommodationMinutes,
  manualAccommodationLegKey,
  withManualAccommodationLeg,
  type AccommodationAnchor,
  type ManualAccommodationLeg,
} from "./accommodation-commute";

const emptySummary: OrderedSequenceSummary = {
  placeCount: 1,
  legCount: 0,
  knownLegCount: 0,
  unknownLegCount: 0,
  transferMinutes: null,
  complete: true,
};

function outbound(accommodationId: string, placeId: string, minutes: number): ManualAccommodationLeg {
  return {
    direction: "accommodation-to-place",
    accommodationId,
    placeId,
    minutes,
    source: { kind: "user-entered" },
  };
}

function returnLeg(accommodationId: string, placeId: string, minutes: number): ManualAccommodationLeg {
  return {
    direction: "place-to-accommodation",
    placeId,
    accommodationId,
    minutes,
    source: { kind: "user-entered" },
  };
}

describe("accommodation identity/location", () => {
  it("accepts only finite coordinates in geographic range", () => {
    expect(isValidAccommodationLocation({ lat: 35.6812, lng: 139.7671 })).toBe(true);
    expect(isValidAccommodationLocation({ lat: -90, lng: 180 })).toBe(true);
    for (const location of [
      { lat: 91, lng: 0 },
      { lat: -91, lng: 0 },
      { lat: 0, lng: 181 },
      { lat: 0, lng: -181 },
      { lat: Number.NaN, lng: 0 },
      { lat: 0, lng: Number.POSITIVE_INFINITY },
    ]) {
      expect(isValidAccommodationLocation(location)).toBe(false);
    }
  });

  it("requires accommodation ids to be unique but does not merge equal labels/coordinates", () => {
    const first: AccommodationAnchor = { id: "hotel-a", label: "Hotel Tokio", location: { lat: 35, lng: 139 } };
    const second: AccommodationAnchor = { id: "hotel-b", label: "Hotel Tokio", location: { lat: 35, lng: 139 } };
    expect(hasUniqueAccommodationIds([first, second])).toBe(true);
    expect(hasUniqueAccommodationIds([first, { ...second, id: "hotel-a" }])).toBe(false);
  });
});

describe("manual accommodation legs", () => {
  it("accepts only positive safe-integer minutes", () => {
    expect(isValidManualAccommodationMinutes(25)).toBe(true);
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(isValidManualAccommodationMinutes(value)).toBe(false);
    }
  });

  it("keeps direction load-bearing; outbound never supplies the reverse leg", () => {
    const legs = [outbound("A", "X", 25)];
    expect(findManualAccommodationLeg(legs, "accommodation-to-place", "A", "X")?.minutes).toBe(25);
    expect(findManualAccommodationLeg(legs, "place-to-accommodation", "A", "X")).toBeNull();
  });

  it("never reuses another accommodation or another place", () => {
    const legs = [outbound("A", "X", 25)];
    expect(findManualAccommodationLeg(legs, "accommodation-to-place", "B", "X")).toBeNull();
    expect(findManualAccommodationLeg(legs, "accommodation-to-place", "A", "Y")).toBeNull();
  });

  it("detects duplicate exact directed keys independently of array order", () => {
    expect(hasUniqueManualAccommodationLegKeys([outbound("A", "X", 10), outbound("A", "X", 20)])).toBe(false);
    expect(hasUniqueManualAccommodationLegKeys([outbound("A", "X", 10), returnLeg("A", "X", 10)])).toBe(true);
  });

  it("setting an exact leg replaces that record instead of appending a duplicate", () => {
    const initial = [outbound("A", "X", 10), outbound("B", "X", 30)];
    const next = withManualAccommodationLeg(initial, "accommodation-to-place", "A", "X", 20);
    expect(next).toHaveLength(2);
    expect(findManualAccommodationLeg(next, "accommodation-to-place", "A", "X")?.minutes).toBe(20);
    expect(findManualAccommodationLeg(next, "accommodation-to-place", "B", "X")?.minutes).toBe(30);
  });

  it("clears only the requested exact key and rejects invalid replacement minutes", () => {
    const initial = [outbound("A", "X", 10), returnLeg("A", "X", 12)];
    const unchanged = withManualAccommodationLeg(initial, "accommodation-to-place", "A", "X", 1.5);
    expect(unchanged).toEqual(initial);
    const cleared = withManualAccommodationLeg(initial, "accommodation-to-place", "A", "X", null);
    expect(cleared).toEqual([returnLeg("A", "X", 12)]);
  });
});

describe("day boundary derivation", () => {
  it("distinguishes unselected from explicit no-accommodation", () => {
    expect(deriveAccommodationBoundaryLeg(["X"], { kind: "unselected" }, "start", [])).toEqual({
      kind: "boundary-unselected",
      side: "start",
    });
    expect(deriveAccommodationBoundaryLeg(["X"], { kind: "no-accommodation" }, "start", [])).toEqual({
      kind: "not-applicable",
      side: "start",
      reason: "explicit-no-accommodation",
    });
  });

  it("uses exactly the current first place for outbound and last place for return", () => {
    const legs = [outbound("A", "X", 20), returnLeg("A", "Z", 30), outbound("A", "Y", 99)];
    expect(deriveAccommodationBoundaryLeg(["X", "Y", "Z"], { kind: "accommodation", accommodationId: "A" }, "start", legs)).toMatchObject({
      kind: "manual-leg",
      placeId: "X",
      minutes: 20,
    });
    expect(deriveAccommodationBoundaryLeg(["X", "Y", "Z"], { kind: "accommodation", accommodationId: "A" }, "end", legs)).toMatchObject({
      kind: "manual-leg",
      placeId: "Z",
      minutes: 30,
    });
  });

  it("changing an endpoint leaves the formerly matching leg unused", () => {
    const legs = [outbound("A", "X", 20), returnLeg("A", "Z", 30)];
    expect(deriveAccommodationBoundaryLeg(["Y", "Z"], { kind: "accommodation", accommodationId: "A" }, "start", legs)).toMatchObject({
      kind: "manual-leg-missing",
      placeId: "Y",
    });
    expect(deriveAccommodationBoundaryLeg(["X", "Y"], { kind: "accommodation", accommodationId: "A" }, "end", legs)).toMatchObject({
      kind: "manual-leg-missing",
      placeId: "Y",
    });
  });

  it("empty days are not applicable regardless of a stale selected boundary", () => {
    expect(deriveAccommodationBoundaryLeg([], { kind: "accommodation", accommodationId: "A" }, "start", [outbound("A", "X", 20)])).toEqual({
      kind: "not-applicable",
      side: "start",
      reason: "empty-day",
    });
  });
});

describe("day aggregation", () => {
  it("a one-place day with both manual legs can be complete door-to-door", () => {
    const result = buildDayLogisticsWithAccommodation(
      ["X"],
      emptySummary,
      {
        start: { kind: "accommodation", accommodationId: "A" },
        end: { kind: "accommodation", accommodationId: "A" },
      },
      [outbound("A", "X", 20), returnLeg("A", "X", 30)]
    );
    expect(result.registeredTransferMinutes).toEqual({ minMinutes: 50, maxMinutes: 50 });
    expect(result.completeDoorToDoor).toBe(true);
  });

  it("incomplete intra-day data forbids a complete total even with both manual legs", () => {
    const intraDay: OrderedSequenceSummary = {
      placeCount: 2,
      legCount: 1,
      knownLegCount: 0,
      unknownLegCount: 1,
      transferMinutes: null,
      complete: false,
    };
    const result = buildDayLogisticsWithAccommodation(
      ["X", "Y"],
      intraDay,
      {
        start: { kind: "accommodation", accommodationId: "A" },
        end: { kind: "accommodation", accommodationId: "A" },
      },
      [outbound("A", "X", 20), returnLeg("A", "Y", 30)]
    );
    expect(result.registeredTransferMinutes).toEqual({ minMinutes: 50, maxMinutes: 50 });
    expect(result.completeDoorToDoor).toBe(false);
  });

  it("missing or explicit-no-accommodation sides never contribute a synthetic zero", () => {
    const result = buildDayLogisticsWithAccommodation(
      ["X"],
      emptySummary,
      { start: { kind: "accommodation", accommodationId: "A" }, end: { kind: "no-accommodation" } },
      []
    );
    expect(result.registeredTransferMinutes).toBeNull();
    expect(result.completeDoorToDoor).toBe(false);
  });

  it("empty days produce no combined transfer total", () => {
    const result = buildDayLogisticsWithAccommodation(
      [],
      { ...emptySummary, placeCount: 0 },
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
      []
    );
    expect(result.registeredTransferMinutes).toBeNull();
    expect(result.completeDoorToDoor).toBe(false);
  });
});

describe("independent sides and cross-day silence", () => {
  it("evaluates a hotel-change day with different start and end accommodations", () => {
    const legs = [outbound("A", "X", 20), returnLeg("B", "Z", 40)];
    const result = buildDayLogisticsWithAccommodation(
      ["X", "Y", "Z"],
      { placeCount: 3, legCount: 2, knownLegCount: 2, unknownLegCount: 0, transferMinutes: { minMinutes: 15, maxMinutes: 25 }, complete: true },
      {
        start: { kind: "accommodation", accommodationId: "A" },
        end: { kind: "accommodation", accommodationId: "B" },
      },
      legs
    );
    expect(result.outbound).toMatchObject({ kind: "manual-leg", accommodationId: "A", placeId: "X", minutes: 20 });
    expect(result.returnLeg).toMatchObject({ kind: "manual-leg", accommodationId: "B", placeId: "Z", minutes: 40 });
    // Both bounds move by the same exact integer: a manual leg is never widened into a ± range.
    expect(result.registeredTransferMinutes).toEqual({ minMinutes: 75, maxMinutes: 85 });
    expect(result.completeDoorToDoor).toBe(true);
  });

  it("never infers a Hotel A → Hotel B leg from adjacent day boundaries", () => {
    // Day N ends at Hotel A, day N+1 starts at Hotel B. Nothing in this module can be asked
    // about A → B: the only lookups it performs are accommodation↔place, per side, per day.
    const legs = [returnLeg("A", "Z", 30), outbound("B", "P", 15)];
    const dayN = deriveAccommodationBoundaryLeg(["X", "Z"], { kind: "accommodation", accommodationId: "A" }, "end", legs);
    const dayNext = deriveAccommodationBoundaryLeg(["P", "Q"], { kind: "accommodation", accommodationId: "B" }, "start", legs);
    expect(dayN).toMatchObject({ kind: "manual-leg", placeId: "Z", minutes: 30 });
    expect(dayNext).toMatchObject({ kind: "manual-leg", placeId: "P", minutes: 15 });
    // No result kind exists that could carry an accommodation-to-accommodation pair at all.
    expect(findManualAccommodationLeg(legs, "accommodation-to-place", "A", "B")).toBeNull();
    expect(findManualAccommodationLeg(legs, "place-to-accommodation", "B", "A")).toBeNull();
  });

  it("an unselected side keeps any combined total incomplete", () => {
    const result = buildDayLogisticsWithAccommodation(
      ["X"],
      emptySummary,
      { start: { kind: "accommodation", accommodationId: "A" }, end: { kind: "unselected" } },
      [outbound("A", "X", 20)]
    );
    expect(result.returnLeg).toEqual({ kind: "boundary-unselected", side: "end" });
    expect(result.registeredTransferMinutes).toEqual({ minMinutes: 20, maxMinutes: 20 });
    expect(result.completeDoorToDoor).toBe(false);
  });

  it("a missing selected leg keeps any combined total incomplete without contributing zero", () => {
    const result = buildDayLogisticsWithAccommodation(
      ["X"],
      emptySummary,
      {
        start: { kind: "accommodation", accommodationId: "A" },
        end: { kind: "accommodation", accommodationId: "A" },
      },
      [outbound("A", "X", 20)]
    );
    expect(result.returnLeg).toMatchObject({ kind: "manual-leg-missing", placeId: "X" });
    expect(result.registeredTransferMinutes).toEqual({ minMinutes: 20, maxMinutes: 20 });
    expect(result.completeDoorToDoor).toBe(false);
  });

  it("explicit no-accommodation on both sides never becomes a complete door-to-door total", () => {
    const result = buildDayLogisticsWithAccommodation(
      ["X", "Y"],
      { placeCount: 2, legCount: 1, knownLegCount: 1, unknownLegCount: 0, transferMinutes: { minMinutes: 12, maxMinutes: 12 }, complete: true },
      { start: { kind: "no-accommodation" }, end: { kind: "no-accommodation" } },
      [outbound("A", "X", 20), returnLeg("A", "Y", 30)]
    );
    // The exact legs exist, but neither side asked for one: no lookup happens and neither the
    // subtotal nor the completeness claim changes.
    expect(result.registeredTransferMinutes).toEqual({ minMinutes: 12, maxMinutes: 12 });
    expect(result.completeDoorToDoor).toBe(false);
  });

  it("unknown intra-day legs contribute nothing while manual legs still count", () => {
    const result = buildDayLogisticsWithAccommodation(
      ["X", "Y"],
      { placeCount: 2, legCount: 1, knownLegCount: 0, unknownLegCount: 1, transferMinutes: null, complete: false },
      {
        start: { kind: "accommodation", accommodationId: "A" },
        end: { kind: "accommodation", accommodationId: "A" },
      },
      [outbound("A", "X", 20), returnLeg("A", "Y", 30)]
    );
    expect(result.registeredTransferMinutes).toEqual({ minMinutes: 50, maxMinutes: 50 });
    expect(result.completeDoorToDoor).toBe(false);
  });
});

describe("no geometry, no provider, no reverse inference", () => {
  it("two anchors at identical coordinates still need their own exact recorded leg", () => {
    const legs = [outbound("A", "X", 20)];
    // Same pin, different anchor: nothing is transferred between them.
    expect(deriveAccommodationBoundaryLeg(["X"], { kind: "accommodation", accommodationId: "B" }, "start", legs)).toMatchObject({
      kind: "manual-leg-missing",
      accommodationId: "B",
      placeId: "X",
    });
  });

  it("the module never reads coordinates, a transfer lookup, or the network", async () => {
    const source = await readFile(new URL("./accommodation-commute.ts", import.meta.url), "utf8");
    // No accommodation id ever reaches the place-to-place transfer contract.
    expect(source).not.toContain("getBestTransfer");
    expect(source).not.toContain("lookupTransfer");
    expect(source).not.toContain("./transfer");
    // No geometry-derived minutes.
    expect(source).not.toMatch(/haversine|Math\.(sqrt|atan2|cos|sin)|toRadians/i);
    // No runtime provider of any kind.
    expect(source).not.toMatch(/\bfetch\b|XMLHttpRequest|openrouteservice|googleapis|booking\.com/i);
    // Coordinates are never read for arithmetic: `location` is declared in the anchor type and
    // never dereferenced anywhere else in the module.
    const locationReads = source.match(/\.location\b/g) ?? [];
    expect(locationReads).toHaveLength(0);
    // No unknown component is ever defaulted to zero minutes anywhere in the aggregation.
    expect(source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")).not.toMatch(/\?\?\s*0\b/);
  });

  it("keys distinct endpoint triples that would collide under naive concatenation", () => {
    const a = manualAccommodationLegKey({ direction: "accommodation-to-place", accommodationId: "ab", placeId: "c" });
    const b = manualAccommodationLegKey({ direction: "accommodation-to-place", accommodationId: "a", placeId: "bc" });
    expect(a).not.toBe(b);
  });
});
