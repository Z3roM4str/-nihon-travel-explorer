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
