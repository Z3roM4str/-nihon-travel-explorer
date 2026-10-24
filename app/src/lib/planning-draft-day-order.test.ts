import { describe, expect, it } from "vitest";
import { UNSELECTED_ACCOMMODATION_BOUNDARY } from "./accommodation-commute";
import {
  freshDraft,
  withAccommodationLeg,
  withDayAccommodationChoice,
  withEndDate,
  withInitialDays,
  withNewInterHubSegment,
  withStartDate,
  withVisitStartTime,
  withZoneAccommodationChoice,
  type ManualPlanningDraftV8,
} from "./planning-draft-v8";

// Baseline order is intentionally not the routeIds order. The mutator must address a stable
// day and replace only that day’s placeIds, without rebuilding or normalising the rest of V8.
function dayOrderDraft(): ManualPlanningDraftV8 {
  let nextId = 0;
  let draft = withInitialDays(
    freshDraft(["tokyo-a", "tokyo-b", "kyoto-a"]),
    [["tokyo-b", "tokyo-a"], ["kyoto-a"]],
    () => `day-${++nextId}`
  );
  draft = withStartDate(draft, "2027-02-22");
  draft = withEndDate(draft, "2027-03-05");
  draft = withZoneAccommodationChoice(
    draft,
    { hub: "Tokio", zoneId: "tokio-shinjuku", label: "Estación de Shinjuku", location: { lat: 35.6896, lng: 139.7006 } },
    () => "acc-shinjuku"
  );
  draft = withDayAccommodationChoice(draft, "day-1", "end", {
    kind: "accommodation",
    accommodationId: "acc-shinjuku",
  });
  draft = withVisitStartTime(draft, "tokyo-a", "09:30");
  draft = withAccommodationLeg(draft, "accommodation-to-place", "acc-shinjuku", "tokyo-b", 25);
  draft = withNewInterHubSegment(draft, {
    fromPlaceId: "tokyo-a",
    toPlaceId: "kyoto-a",
    fromHub: "Tokio",
    toHub: "Kioto",
    mode: "shinkansen",
    minutes: 135,
  }, () => "segment-main");
  return draft;
}

const BASELINE = ["tokyo-b", "tokyo-a"];
const PROPOSAL = ["tokyo-a", "tokyo-b"];

describe("B9.3 — atomic application of a local day proposal", () => {
  it("A. applies a valid order to the addressed day", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const after = withDayPlaceOrderApplied(dayOrderDraft(), "day-1", BASELINE, PROPOSAL);
    expect(after.days?.[0].placeIds).toEqual(PROPOSAL);
  });

  it("B. preserves the stable day id", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    const after = withDayPlaceOrderApplied(before, "day-1", BASELINE, PROPOSAL);
    expect(after.days?.[0].id).toBe(before.days?.[0].id);
  });

  it("C. preserves routeIds by reference and value", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    const after = withDayPlaceOrderApplied(before, "day-1", BASELINE, PROPOSAL);
    expect(after.routeIds).toBe(before.routeIds);
    expect(after.routeIds).toEqual(before.routeIds);
  });

  it("D. preserves the selected day's accommodation boundary object", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    const after = withDayPlaceOrderApplied(before, "day-1", BASELINE, PROPOSAL);
    expect(after.days?.[0].accommodationBoundary).toBe(before.days?.[0].accommodationBoundary);
    expect(after.days?.[0].accommodationBoundary).not.toBe(UNSELECTED_ACCOMMODATION_BOUNDARY);
  });

  it("E. preserves every other draft field and every unaffected day entity", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    const after = withDayPlaceOrderApplied(before, "day-1", BASELINE, PROPOSAL);
    expect(after.days?.[1]).toBe(before.days?.[1]);
    expect(after.days?.[0]).not.toBe(before.days?.[0]);
    for (const key of [
      "version", "routeIds", "startDate", "endDate", "visitStartTimes", "accommodations",
      "accommodationLegs", "interHubSegments", "zoneAccommodationChoices",
    ] as const) {
      expect(after[key]).toBe(before[key]);
    }
    expect(after.days?.[0].accommodationBoundary).toBe(before.days?.[0].accommodationBoundary);
  });

  it("F. rejects a candidate with duplicate ids", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    expect(withDayPlaceOrderApplied(before, "day-1", BASELINE, ["tokyo-b", "tokyo-b"])).toBe(before);
  });

  it("G. rejects a candidate with a missing id", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    expect(withDayPlaceOrderApplied(before, "day-1", BASELINE, ["tokyo-b"])).toBe(before);
  });

  it("H. rejects a candidate with an extra id", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    expect(withDayPlaceOrderApplied(before, "day-1", BASELINE, ["tokyo-b", "tokyo-a", "kyoto-a"])).toBe(before);
  });

  it("I. rejects a stale expected baseline", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    expect(withDayPlaceOrderApplied(before, "day-1", PROPOSAL, BASELINE)).toBe(before);
  });

  it("J. rejects an unknown stable day id", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    expect(withDayPlaceOrderApplied(before, "missing-day", BASELINE, PROPOSAL)).toBe(before);
  });

  it("K. rejects a draft without days", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = freshDraft(["tokyo-a", "tokyo-b"]);
    expect(withDayPlaceOrderApplied(before, "day-1", BASELINE, PROPOSAL)).toBe(before);
  });

  it("L. treats a proposal identical to baseline as a no-op", async () => {
    const { withDayPlaceOrderApplied } = await import("./planning-draft-v8");
    const before = dayOrderDraft();
    expect(withDayPlaceOrderApplied(before, "day-1", BASELINE, BASELINE)).toBe(before);
  });
});
