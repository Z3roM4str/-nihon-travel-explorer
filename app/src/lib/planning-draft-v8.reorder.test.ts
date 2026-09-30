import { describe, expect, it } from "vitest";
import { freshDraft, withPlaceRelocatedBetweenDays, withPlaceInsertedIntoDay } from "./planning-draft-v8";

describe("B28 atomic stop relocation", () => {
  const draft = () => ({ ...freshDraft(["A", "B", "C", "D", "E"]), days: [
    { id: "day-a", placeIds: ["A", "B", "C"], accommodationBoundary: { start: { kind: "unselected" as const }, end: { kind: "unselected" as const } } },
    { id: "day-b", placeIds: ["D", "E"], accommodationBoundary: { start: { kind: "unselected" as const }, end: { kind: "unselected" as const } } },
  ] });

  it("moves by stable identities to an exact position in one update", () => {
    const before = draft();
    const after = withPlaceRelocatedBetweenDays(before, "day-a", "day-b", "B", 1);
    expect(after.days?.map((day) => day.placeIds)).toEqual([["A", "C"], ["D", "B", "E"]]);
    expect(after.days?.map((day) => day.id)).toEqual(["day-a", "day-b"]);
    expect(after.routeIds).toBe(before.routeIds);
    expect(after.visitStartTimes).toBe(before.visitStartTimes);
    expect(after.accommodationLegs).toBe(before.accommodationLegs);
    expect(after.interHubSegments).toBe(before.interHubSegments);
  });

  it("inserts an unassigned place at an exact position without restoring route state", () => {
    const before = { ...draft(), routeIds: ["A", "B", "C", "D"], days: [
      { ...draft().days[0] }, { ...draft().days[1], placeIds: ["D"] },
    ] };
    const after = withPlaceInsertedIntoDay(before, "E", "day-b", 0);
    expect(after.days?.[1].placeIds).toEqual(["E", "D"]);
    expect(after.routeIds).toEqual(["A", "B", "C", "D", "E"]);
    expect(after.visitStartTimes).toBe(before.visitStartTimes);
  });

  it("resets only an emptied source boundary and keeps all route-scoped evidence", () => {
    const base = draft();
    const boundary = { start: { kind: "no-accommodation" as const }, end: { kind: "no-accommodation" as const } };
    const before = { ...base, days: [
      { ...base.days[0], placeIds: ["A"], accommodationBoundary: boundary },
      { ...base.days[1], placeIds: ["B", "C", "D", "E"], accommodationBoundary: boundary },
    ], visitStartTimes: { A: "09:30" } };
    const after = withPlaceRelocatedBetweenDays(before, "day-a", "day-b", "A", 2);
    expect(after.days?.[0].id).toBe("day-a");
    expect(after.days?.[0].placeIds).toEqual([]);
    expect(after.days?.[0].accommodationBoundary).toEqual({ start: { kind: "unselected" }, end: { kind: "unselected" } });
    expect(after.days?.[1].accommodationBoundary).toBe(boundary);
    expect(after.days?.[1].placeIds).toEqual(["B", "C", "A", "D", "E"]);
    expect(after.visitStartTimes).toBe(before.visitStartTimes);
    expect(after.startDate).toBe(before.startDate);
    expect(after.endDate).toBe(before.endDate);
    expect(after.accommodations).toBe(before.accommodations);
    expect(after.accommodationLegs).toBe(before.accommodationLegs);
    expect(after.interHubSegments).toBe(before.interHubSegments);
    expect(after.zoneAccommodationChoices).toBe(before.zoneAccommodationChoices);
  });

  it("rejects stale identity and invalid slots without changing the draft", () => {
    const before = draft();
    for (const args of [
      ["missing", "day-b", "B", 0], ["day-a", "missing", "B", 0],
      ["day-a", "day-b", "E", 0], ["day-a", "day-b", "B", -1],
      ["day-a", "day-b", "B", 3], ["day-a", "day-b", "B", 0.5],
    ] as [string, string, string, number][]) expect(withPlaceRelocatedBetweenDays(before, ...args)).toBe(before);
    expect(withPlaceInsertedIntoDay(before, "F", "day-b", 3)).toBe(before);
    expect(withPlaceInsertedIntoDay(before, "A", "day-b", 0)).toBe(before);
  });
});
