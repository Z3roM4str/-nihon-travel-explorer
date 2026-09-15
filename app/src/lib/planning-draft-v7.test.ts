import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { UNSELECTED_ACCOMMODATION_BOUNDARY } from "./accommodation-commute";
import { buildDayAssignment } from "./day-assignment";
import { assessInterHubSegment, type ManualInterHubSegment } from "./inter-hub-segment";
import { orderedSequenceFromLookup } from "./ordered-sequence";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  PLANNING_DRAFT_VERSION,
  loadReconciledDraft,
  migrateV6ToV7,
  parseStoredDraft,
  reconcileDraft,
  resetRoute,
  withAccommodation,
  withAccommodationLeg,
  withDayMoved,
  withEndDate,
  withInterHubSegmentDetails,
  withNewEmptyDay,
  withNewInterHubSegment,
  withPlaceMovedBetweenDays,
  withPlaceMovedWithinDay,
  withRoute,
  withStartDate,
  withoutEmptyDay,
  withoutInterHubSegment,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV7,
  type PlanningDayV5,
} from "./planning-draft-v7";
import { sequenceComparisonFromLookup } from "./sequence-comparison";
import { getBestTransfer, normalizeTransferMode } from "./transfer";
import type { ManualPlanningDraftV6 } from "./planning-draft-v6";

function boundary(): PlanningDayV5["accommodationBoundary"] {
  return {
    start: { ...UNSELECTED_ACCOMMODATION_BOUNDARY.start },
    end: { ...UNSELECTED_ACCOMMODATION_BOUNDARY.end },
  };
}

function day(id: string, placeIds: string[]): PlanningDayV5 {
  return { id, placeIds, accommodationBoundary: boundary() };
}

function segment(overrides: Partial<ManualInterHubSegment> = {}): ManualInterHubSegment {
  return {
    id: "seg-1",
    fromPlaceId: "tokyo-a",
    toPlaceId: "kyoto-b",
    fromHub: "Tokio",
    toHub: "Kioto",
    mode: "shinkansen",
    minutes: 140,
    source: { kind: "user-entered" },
    ...overrides,
  };
}

function draftV6(overrides: Partial<ManualPlanningDraftV6> = {}): ManualPlanningDraftV6 {
  return {
    version: 6,
    routeIds: ["tokyo-a", "kyoto-b", "osaka-c"],
    days: null,
    startDate: "2027-02-19",
    endDate: "2027-02-21",
    visitStartTimes: { "tokyo-a": "09:00" },
    accommodations: [],
    accommodationLegs: [],
    ...overrides,
  };
}

function draftV7(overrides: Partial<ManualPlanningDraftV7> = {}): ManualPlanningDraftV7 {
  return {
    ...draftV6(),
    version: 7,
    interHubSegments: [segment()],
    ...overrides,
  };
}

function memoryStorage(initial: Record<string, string> = {}): DraftStorage & { keys: () => string[] } {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    keys: () => [...values.keys()],
  };
}

const hubs = { "tokyo-a": "Tokio", "kyoto-b": "Kioto", "osaka-c": "Osaka" } as const;
function assessment(source: ManualPlanningDraftV7, target = segment()) {
  return assessInterHubSegment(target, {
    routeIds: source.routeIds,
    days: source.days?.map((entity) => entity.placeIds) ?? null,
    resolvePlace: (id) => (id in hubs ? { hub: hubs[id as keyof typeof hubs] } : null),
  });
}

describe("V6 to V7 migration and parser", () => {
  it("adds exactly an empty interHubSegments list", () => {
    const before = draftV6();
    const after = migrateV6ToV7(before);
    expect(after).toEqual({ ...before, version: 7, interHubSegments: [] });
    expect(after.routeIds).toBe(before.routeIds);
    expect(after.days).toBe(before.days);
    expect(after.startDate).toBe(before.startDate);
    expect(after.endDate).toBe(before.endDate);
  });

  it("keeps the historical V1 through V6 chain reaching V7", () => {
    for (const historical of [
      { version: 1, routeIds: ["tokyo-a"], days: [["tokyo-a"]] },
      draftV6({ routeIds: ["tokyo-a"], days: null }),
    ]) {
      const parsed = parseStoredDraft(historical);
      expect(parsed?.version).toBe(7);
      expect(parsed?.interHubSegments).toEqual([]);
      expect(parsed?.routeIds).toEqual(["tokyo-a"]);
    }
  });

  it("parses a valid V7 segment verbatim, even when it is currently non-adjacent", () => {
    const raw = draftV7({ routeIds: ["tokyo-a", "osaka-c", "kyoto-b"] });
    const parsed = parseStoredDraft(raw);
    expect(parsed?.interHubSegments).toEqual([segment()]);
    expect(assessment(parsed!)).toEqual({ kind: "inactive", reason: "not-consecutive-in-route" });
  });

  it.each([
    ["invalid mode", { mode: "walk" }],
    ["zero minutes", { minutes: 0 }],
    ["fractional minutes", { minutes: 1.5 }],
    ["empty id", { id: "" }],
    ["empty anchor", { fromPlaceId: "" }],
    ["empty hub", { toHub: "" }],
    ["same anchor", { toPlaceId: "tokyo-a" }],
    ["same hub", { toHub: "Tokio" }],
  ])("rejects the whole draft for %s", (_label, override) => {
    expect(parseStoredDraft(draftV7({ interHubSegments: [segment(override as Partial<ManualInterHubSegment>)] }))).toBeNull();
  });

  it("rejects duplicate ids and duplicate directional anchor pairs", () => {
    expect(
      parseStoredDraft(
        draftV7({ interHubSegments: [segment(), segment({ toPlaceId: "osaka-c", toHub: "Osaka" })] })
      )
    ).toBeNull();
    expect(
      parseStoredDraft(draftV7({ interHubSegments: [segment(), segment({ id: "seg-2", minutes: 141 })] }))
    ).toBeNull();
  });
});

describe("V7 mutation identity", () => {
  it("route reorder deactivates and reactivates without rewriting the segment", () => {
    const before = draftV7();
    const inactive = withRoute(before, ["kyoto-b", "tokyo-a", "osaka-c"]);
    expect(inactive.interHubSegments).toEqual(before.interHubSegments);
    expect(assessment(inactive)).toEqual({ kind: "inactive", reason: "not-consecutive-in-route" });
    const active = withRoute(inactive, before.routeIds);
    expect(active.interHubSegments).toEqual(before.interHubSegments);
    expect(assessment(active).kind).toBe("active");
  });

  it("place reorder inside a day deactivates and reactivates without rewriting", () => {
    const before = draftV7({ days: [day("d1", ["tokyo-a", "kyoto-b", "osaka-c"])] });
    const inactive = withPlaceMovedWithinDay(before, "d1", 0, 1);
    expect(inactive.interHubSegments).toEqual(before.interHubSegments);
    expect(assessment(inactive)).toEqual({ kind: "inactive", reason: "not-consecutive-in-day" });
    const active = withPlaceMovedWithinDay(inactive, "d1", 1, -1);
    expect(active.interHubSegments).toEqual(before.interHubSegments);
    expect(assessment(active).kind).toBe("active");
  });

  it("moving a place can change same-day to consecutive-day placement without rewriting", () => {
    const before = draftV7({
      days: [day("d1", ["tokyo-a", "kyoto-b"]), day("d2", []), day("d3", ["osaka-c"])],
    });
    expect(assessment(before)).toMatchObject({ kind: "active", placement: "same-day" });
    const after = withPlaceMovedBetweenDays(before, "d1", "d2", 1);
    expect(after.interHubSegments).toEqual(before.interHubSegments);
    expect(assessment(after)).toMatchObject({ kind: "active", placement: "between-consecutive-days" });
  });

  it("day reorder deactivates and reactivates a cross-day pair without rewriting", () => {
    const before = draftV7({
      days: [day("d1", ["tokyo-a"]), day("d2", ["kyoto-b"]), day("d3", ["osaka-c"])],
    });
    const inactive = withDayMoved(before, "d1", 1);
    expect(inactive.interHubSegments).toEqual(before.interHubSegments);
    expect(assessment(inactive).kind).toBe("inactive");
    const active = withDayMoved(inactive, "d1", -1);
    expect(active.interHubSegments).toEqual(before.interHubSegments);
    expect(assessment(active)).toMatchObject({ kind: "active", placement: "between-consecutive-days" });
  });

  it("an intervening empty day breaks the boundary; deleting an unrelated empty day does not", () => {
    const before = draftV7({ days: [day("d1", ["tokyo-a"]), day("d2", ["kyoto-b", "osaka-c"])] });
    const appended = withNewEmptyDay(before, () => "empty-day");
    expect(assessment(appended).kind).toBe("active");
    const intervening = withDayMoved(appended, "empty-day", -1);
    expect(intervening.interHubSegments).toEqual(before.interHubSegments);
    expect(assessment(intervening)).toEqual({ kind: "inactive", reason: "not-boundary-of-consecutive-days" });
    const unrelatedRemoved = withoutEmptyDay(appended, "empty-day");
    expect(unrelatedRemoved.interHubSegments).toEqual(before.interHubSegments);
    expect(assessment(unrelatedRemoved).kind).toBe("active");
  });

  it("prunes only segments whose anchor really leaves the route and never resurrects them", () => {
    const second = segment({
      id: "seg-2",
      fromPlaceId: "kyoto-b",
      toPlaceId: "osaka-c",
      fromHub: "Kioto",
      toHub: "Osaka",
      mode: "limited-express",
    });
    const before = draftV7({ interHubSegments: [segment(), second] });
    const removed = withRoute(before, ["kyoto-b", "osaka-c"]);
    expect(removed.interHubSegments).toEqual([second]);
    const readded = withRoute(removed, ["tokyo-a", "kyoto-b", "osaka-c"]);
    expect(readded.interHubSegments).toEqual([second]);
    expect(reconcileDraft(before, ["kyoto-b", "osaka-c"]).interHubSegments).toEqual([second]);
    expect(resetRoute(before, ["kyoto-b", "osaka-c"]).interHubSegments).toEqual([second]);
  });

  it("bounds and accommodations preserve segments byte-for-byte", () => {
    const before = draftV7();
    expect(withStartDate(before, "2027-02-20").interHubSegments).toBe(before.interHubSegments);
    expect(withEndDate(before, "2027-03-01").interHubSegments).toBe(before.interHubSegments);
    const withHotel = withAccommodation(before, {
      id: "hotel",
      label: "Hotel",
      location: { lat: 35, lng: 135 },
    });
    expect(withHotel.interHubSegments).toBe(before.interHubSegments);
    expect(
      withAccommodationLeg(withHotel, "place-to-accommodation", "hotel", "tokyo-a", 25).interHubSegments
    ).toBe(before.interHubSegments);
  });

  it("create, edit and delete are canonical; edit changes only mode and minutes", () => {
    const empty = draftV7({ interHubSegments: [] });
    const created = withNewInterHubSegment(
      empty,
      {
        fromPlaceId: "tokyo-a",
        toPlaceId: "kyoto-b",
        fromHub: "Tokio",
        toHub: "Kioto",
        mode: "shinkansen",
        minutes: 140,
      },
      () => "opaque-id"
    );
    expect(created.interHubSegments[0].id).toBe("opaque-id");
    const edited = withInterHubSegmentDetails(created, "opaque-id", "domestic-flight", 75);
    expect(edited.interHubSegments[0]).toEqual({
      ...created.interHubSegments[0],
      mode: "domestic-flight",
      minutes: 75,
    });
    expect(withoutInterHubSegment(edited, "opaque-id").interHubSegments).toEqual([]);
  });

  it("does not allow duplicate pair creation or silent anchor editing", () => {
    const before = draftV7();
    expect(
      withNewInterHubSegment(
        before,
        {
          fromPlaceId: "tokyo-a",
          toPlaceId: "kyoto-b",
          fromHub: "Tokio",
          toHub: "Kioto",
          mode: "ferry",
          minutes: 20,
        },
        () => "seg-2"
      )
    ).toBe(before);
    const edited = withInterHubSegmentDetails(before, "seg-1", "other", 200);
    expect(edited.interHubSegments[0].fromPlaceId).toBe("tokyo-a");
    expect(edited.interHubSegments[0].toPlaceId).toBe("kyoto-b");
    expect(edited.interHubSegments[0].fromHub).toBe("Tokio");
    expect(edited.interHubSegments[0].toHub).toBe("Kioto");
  });
});

describe("persistence and domain isolation", () => {
  it("writes and reloads every segment field under the one existing key", () => {
    const storage = memoryStorage();
    const before = draftV7();
    writeDraft(storage, before);
    const loaded = loadReconciledDraft(storage, before.routeIds);
    expect(loaded).toEqual(before);
    expect(storage.keys()).toEqual(["nihon.manualPlanningDraft"]);
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
    expect(PLANNING_DRAFT_VERSION).toBe(7);
  });

  it("does not turn a missing TransferEdge into a known OrderedSequence leg", () => {
    expect(getBestTransfer("JP-DOES-NOT-EXIST-1", "JP-DOES-NOT-EXIST-2")).toBeNull();
    const sequence = orderedSequenceFromLookup(["tokyo-a", "kyoto-b"], () => null);
    expect(sequence.legs).toEqual([{ fromId: "tokyo-a", toId: "kyoto-b", transfer: null }]);
    expect(sequence.summary.complete).toBe(false);
    expect(draftV7().interHubSegments).toHaveLength(1);
  });

  it("does not make an incomplete comparison produce a winner", () => {
    const result = sequenceComparisonFromLookup(
      ["tokyo-a", "kyoto-b", "osaka-c"],
      ["tokyo-a", "osaka-c", "kyoto-b"],
      () => null
    );
    expect(result.outcome).toBe("incomplete");
    expect(result.guaranteedAdvantageMinutes).toBeNull();
  });

  it("does not add inter-hub values to TransferMode or day transfer aggregation", () => {
    expect(normalizeTransferMode("A pie")).toBe("walk");
    expect(() => normalizeTransferMode("Shinkansen")).toThrow();
    const assignment = buildDayAssignment(["tokyo-a", "kyoto-b"], [["tokyo-a"], ["kyoto-b"]]);
    expect(assignment.days.every((bucket) => bucket.sequence.legs.length === 0)).toBe(true);
  });

  it("keeps inter-hub imports out of transfer, ordered sequence, comparison and day assignment", async () => {
    for (const file of [
      "transfer.ts",
      "ordered-sequence.ts",
      "sequence-comparison.ts",
      "day-assignment.ts",
      "accommodation-commute.ts",
      "trip-bounds.ts",
    ]) {
      const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source, file).not.toContain("inter-hub-segment");
      expect(source, file).not.toContain("ManualInterHubSegment");
    }
  });

  it("uses V7 as the hook's only canonical draft and creates no second storage key", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    expect(hook).toContain('from "./lib/planning-draft-v7"');
    expect(hook).toContain("useState<ManualPlanningDraftV7>");
    expect([...hook.matchAll(/nihon\.[A-Za-z]+/g)].map((match) => match[0])).not.toContain("nihon.interHubSegments");
  });
});
