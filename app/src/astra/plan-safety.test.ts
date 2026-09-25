import { describe, expect, it } from "vitest";
import { PLANNING_DRAFT_STORAGE_KEY, type ManualPlanningDraftV7 } from "../lib/planning-draft-v7";
import { UNSELECTED_ACCOMMODATION_BOUNDARY } from "../lib/accommodation-commute";
import { canRemoveSavedPlace, readAuthoredPlanIds } from "./plan-safety";

const fixture: ManualPlanningDraftV7 = {
  version: 7,
  routeIds: ["JP-002", "JP-100"],
  days: [{ id: "day-stable", placeIds: ["JP-002", "JP-100"], accommodationBoundary: {
    start: { ...UNSELECTED_ACCOMMODATION_BOUNDARY.start }, end: { ...UNSELECTED_ACCOMMODATION_BOUNDARY.end },
  } }],
  startDate: "2027-02-19", endDate: "2027-02-20",
  visitStartTimes: { "JP-002": "09:30" },
  accommodations: [], accommodationLegs: [], interHubSegments: [],
};

function storage(raw: string | null) {
  return { getItem: (key: string) => key === PLANNING_DRAFT_STORAGE_KEY ? raw : null };
}

describe("plan-safe saved-place removal", () => {
  it("reads planned ids without changing the serialized V7 fixture", () => {
    const raw = JSON.stringify(fixture);
    expect([...readAuthoredPlanIds(storage(raw))]).toEqual(["JP-002", "JP-100"]);
    expect(JSON.stringify(fixture)).toBe(raw);
  });
  it("blocks a planned id and permits an unrelated saved id", () => {
    const store = storage(JSON.stringify(fixture));
    expect(canRemoveSavedPlace("JP-002", store)).toBe(false);
    expect(canRemoveSavedPlace("JP-777", store)).toBe(true);
  });
  it("fails closed for malformed storage", () => {
    expect(canRemoveSavedPlace("JP-002", storage("{bad"))).toBe(false);
  });
});
