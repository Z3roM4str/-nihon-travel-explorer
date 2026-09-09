import { describe, expect, it } from "vitest";
import {
  LEGACY_V4_DAY_ID_PREFIX,
  PLANNING_DRAFT_STORAGE_KEY,
  createDayId,
  dayMatrixFromPlanningDays,
  freshDraft,
  loadReconciledDraft,
  migrateV4ToV5,
  parseStoredDraft,
  reconcileDraft,
  resetRoute,
  withAccommodation,
  withAccommodationLeg,
  withDayAccommodationChoice,
  withDays,
  withInitialDays,
  withNewEmptyDay,
  withPlaceMovedBetweenDays,
  withPlaceMovedWithinDay,
  withRoute,
  withStartDate,
  withVisitStartTime,
  withoutAccommodation,
  withoutEmptyDay,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV5,
  type PlanningDayV5,
} from "./planning-draft-v5";
import type { ManualPlanningDraftV4 } from "./planning-draft-v4";
import { validateDayPartition, buildDayAssignment } from "./day-assignment";
import { addCivilDays } from "./civil-date";
import { buildDayWeekdaySignal } from "./day-weekday-signal";
import {
  deriveAccommodationBoundaryLeg,
  type DayAccommodationBoundary,
  type ManualAccommodationLeg,
} from "./accommodation-commute";

function memoryStorage(initial: Record<string, string> = {}): DraftStorage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
}

const hotelA = { id: "hotel-a", label: "Hotel A", location: { lat: 35.6812, lng: 139.7671 } };
const hotelB = { id: "hotel-b", label: "Hotel B", location: { lat: 34.6937, lng: 135.5023 } };

const unselected: DayAccommodationBoundary = {
  start: { kind: "unselected" },
  end: { kind: "unselected" },
};

function boundary(
  start: DayAccommodationBoundary["start"],
  end: DayAccommodationBoundary["end"]
): DayAccommodationBoundary {
  return { start, end };
}

function day(id: string, placeIds: string[], accommodationBoundary = unselected): PlanningDayV5 {
  return { id, placeIds, accommodationBoundary };
}

function draftV5(overrides: Partial<ManualPlanningDraftV5> = {}): ManualPlanningDraftV5 {
  return {
    version: 5,
    routeIds: ["p1", "p2", "p3"],
    days: [day("d1", ["p1", "p2"]), day("d2", ["p3"])],
    startDate: null,
    visitStartTimes: {},
    accommodations: [],
    accommodationLegs: [],
    ...overrides,
  };
}

/** A deterministic id factory, as the design requires tests to inject rather than depending on
 * browser randomness. */
function sequentialIds(prefix = "new"): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}-${next}`;
  };
}

const legAtoP1: ManualAccommodationLeg = {
  direction: "accommodation-to-place",
  accommodationId: "hotel-a",
  placeId: "p1",
  minutes: 20,
  source: { kind: "user-entered" },
};

const legP2toA: ManualAccommodationLeg = {
  direction: "place-to-accommodation",
  placeId: "p2",
  accommodationId: "hotel-a",
  minutes: 30,
  source: { kind: "user-entered" },
};

// ---------------------------------------------------------------------------------------
// V4 → V5 migration
// ---------------------------------------------------------------------------------------

describe("migrateV4ToV5 — deterministic, decision-preserving, position used exactly once", () => {
  const v4: ManualPlanningDraftV4 = {
    version: 4,
    routeIds: ["p1", "p2", "p3"],
    days: [["p1", "p2"], ["p3"]],
    startDate: "2026-03-01",
    visitStartTimes: { p1: "09:30" },
    accommodations: [hotelA, hotelB],
    dayAccommodationBoundaries: [
      boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" }),
      boundary({ kind: "unselected" }, { kind: "accommodation", accommodationId: "hotel-b" }),
    ],
    accommodationLegs: [legAtoP1],
  };

  it("migrates a valid V4 to a deterministic V5", () => {
    const migrated = migrateV4ToV5(v4);
    expect(migrated.version).toBe(5);
    expect(migrated.days).toEqual([
      {
        id: `${LEGACY_V4_DAY_ID_PREFIX}0`,
        placeIds: ["p1", "p2"],
        accommodationBoundary: v4.dayAccommodationBoundaries![0],
      },
      {
        id: `${LEGACY_V4_DAY_ID_PREFIX}1`,
        placeIds: ["p3"],
        accommodationBoundary: v4.dayAccommodationBoundaries![1],
      },
    ]);
  });

  it("copies placeIds exactly, in order, without touching the route or the times", () => {
    const migrated = migrateV4ToV5(v4);
    expect(dayMatrixFromPlanningDays(migrated.days)).toEqual([["p1", "p2"], ["p3"]]);
    expect(migrated.routeIds).toEqual(["p1", "p2", "p3"]);
    expect(migrated.startDate).toBe("2026-03-01");
    expect(migrated.visitStartTimes).toEqual({ p1: "09:30" });
    expect(migrated.accommodations).toEqual([hotelA, hotelB]);
    expect(migrated.accommodationLegs).toEqual([legAtoP1]);
  });

  it("preserves every boundary exactly — no side is coerced, defaulted or inferred", () => {
    const migrated = migrateV4ToV5(v4);
    expect(migrated.days![0].accommodationBoundary).toEqual(
      boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" })
    );
    expect(migrated.days![1].accommodationBoundary).toEqual(
      boundary({ kind: "unselected" }, { kind: "accommodation", accommodationId: "hotel-b" })
    );
  });

  it("gives the same ids every time the same V4 shape is migrated", () => {
    expect(migrateV4ToV5(v4).days!.map((d) => d.id)).toEqual(migrateV4ToV5(v4).days!.map((d) => d.id));
  });

  it("gives the same ids every time the same stored V4 payload is re-parsed", () => {
    const raw = JSON.parse(JSON.stringify(v4));
    const first = parseStoredDraft(raw)!;
    const second = parseStoredDraft(raw)!;
    expect(first.days!.map((d) => d.id)).toEqual(second.days!.map((d) => d.id));
    expect(first).toEqual(second);
  });

  it("mints ids that are unique within the migrated draft", () => {
    const many: ManualPlanningDraftV4 = {
      ...v4,
      routeIds: ["p1", "p2", "p3"],
      days: [["p1"], [], ["p2"], [], ["p3"]],
      dayAccommodationBoundaries: [unselected, unselected, unselected, unselected, unselected],
      accommodationLegs: [],
    };
    const ids = migrateV4ToV5(many).days!.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps days: null as days: null", () => {
    const nullDays: ManualPlanningDraftV4 = {
      ...v4,
      days: null,
      dayAccommodationBoundaries: null,
      accommodationLegs: [],
    };
    expect(migrateV4ToV5(nullDays).days).toBeNull();
  });

  it("migrates an empty V4 day into an empty V5 day with an all-unselected boundary", () => {
    const withEmpty: ManualPlanningDraftV4 = {
      ...v4,
      days: [["p1", "p2"], [], ["p3"]],
      dayAccommodationBoundaries: [
        boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" }),
        unselected,
        unselected,
      ],
      accommodationLegs: [],
    };
    const migrated = migrateV4ToV5(withEmpty);
    expect(migrated.days![1]).toEqual({
      id: `${LEGACY_V4_DAY_ID_PREFIX}1`,
      placeIds: [],
      accommodationBoundary: unselected,
    });
  });

  it("never recomputes an id from position once V5 exists", () => {
    const migrated = migrateV4ToV5(v4);
    // Delete the first day, so every surviving day's ORDINAL position shifts by one.
    const emptied = withPlaceMovedBetweenDays(
      withPlaceMovedBetweenDays(migrated, migrated.days![0].id, migrated.days![1].id, 0),
      migrated.days![0].id,
      migrated.days![1].id,
      0
    );
    const shifted = withoutEmptyDay(emptied, `${LEGACY_V4_DAY_ID_PREFIX}0`);
    expect(shifted.days!.map((d) => d.id)).toEqual([`${LEGACY_V4_DAY_ID_PREFIX}1`]);
    // The surviving day is now at ordinal 0 but keeps the id minted for its historical position 1.
    expect(shifted.days![0].id).not.toBe(`${LEGACY_V4_DAY_ID_PREFIX}0`);
  });

  it("does not invent or modify an accommodation selection", () => {
    const migrated = migrateV4ToV5({
      ...v4,
      dayAccommodationBoundaries: [unselected, unselected],
      accommodationLegs: [],
    });
    expect(migrated.days!.every((d) => d.accommodationBoundary).valueOf()).toBe(true);
    expect(migrated.days!.map((d) => d.accommodationBoundary)).toEqual([unselected, unselected]);
    expect(migrated.accommodations).toEqual([hotelA, hotelB]);
  });

  it("migrates a V1/V2/V3 value through the historical chain to V5", () => {
    const v3 = { version: 3, routeIds: ["p1"], days: [["p1"]], startDate: null, visitStartTimes: {} };
    const migrated = parseStoredDraft(v3)!;
    expect(migrated.version).toBe(5);
    expect(migrated.days).toEqual([day(`${LEGACY_V4_DAY_ID_PREFIX}0`, ["p1"])]);
    expect(migrated.accommodations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------
// V5 parser
// ---------------------------------------------------------------------------------------

describe("parseStoredDraft — strict, all-or-nothing V5", () => {
  const valid = {
    version: 5,
    routeIds: ["p1", "p2", "p3"],
    days: [
      {
        id: "d1",
        placeIds: ["p1", "p2"],
        accommodationBoundary: boundary(
          { kind: "accommodation", accommodationId: "hotel-a" },
          { kind: "no-accommodation" }
        ),
      },
      { id: "d2", placeIds: ["p3"], accommodationBoundary: unselected },
    ],
    startDate: "2026-03-01",
    visitStartTimes: { p2: "10:00" },
    accommodations: [hotelA],
    accommodationLegs: [legAtoP1],
  };

  it("accepts a valid canonical V5 draft unchanged", () => {
    const parsed = parseStoredDraft(valid);
    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe(5);
    expect(parsed!.days).toEqual(valid.days);
    expect(parsed!.routeIds).toEqual(["p1", "p2", "p3"]);
    expect(parsed!.accommodationLegs).toEqual([legAtoP1]);
  });

  it("accepts a valid V5 draft with days: null", () => {
    const parsed = parseStoredDraft({ ...valid, days: null, visitStartTimes: {}, accommodationLegs: [] });
    expect(parsed!.days).toBeNull();
  });

  it("rejects a duplicate day id outright — it is corruption, not a merge instruction", () => {
    expect(
      parseStoredDraft({
        ...valid,
        days: [
          { id: "same", placeIds: ["p1", "p2"], accommodationBoundary: unselected },
          { id: "same", placeIds: ["p3"], accommodationBoundary: unselected },
        ],
        accommodationLegs: [],
      })
    ).toBeNull();
  });

  it("rejects an empty day id", () => {
    expect(
      parseStoredDraft({
        ...valid,
        days: [
          { id: "", placeIds: ["p1", "p2"], accommodationBoundary: unselected },
          { id: "d2", placeIds: ["p3"], accommodationBoundary: unselected },
        ],
        accommodationLegs: [],
      })
    ).toBeNull();
  });

  it.each([
    ["a missing id", { placeIds: ["p1", "p2", "p3"], accommodationBoundary: unselected }],
    ["a non-string id", { id: 7, placeIds: ["p1", "p2", "p3"], accommodationBoundary: unselected }],
    ["a missing placeIds", { id: "d1", accommodationBoundary: unselected }],
    ["a non-array placeIds", { id: "d1", placeIds: "p1", accommodationBoundary: unselected }],
    ["a non-string place id", { id: "d1", placeIds: ["p1", 2, "p3"], accommodationBoundary: unselected }],
    ["a missing boundary", { id: "d1", placeIds: ["p1", "p2", "p3"] }],
    ["a malformed boundary side", { id: "d1", placeIds: ["p1", "p2", "p3"], accommodationBoundary: { start: { kind: "nope" }, end: { kind: "unselected" } } }],
    ["an accommodation choice with no id", { id: "d1", placeIds: ["p1", "p2", "p3"], accommodationBoundary: { start: { kind: "accommodation" }, end: { kind: "unselected" } } }],
    ["a non-object day", "d1"],
    ["a null day", null],
    ["an array day", ["p1"]],
  ])("rejects a malformed day object: %s", (_label, malformed) => {
    expect(parseStoredDraft({ ...valid, days: [malformed], accommodationLegs: [] })).toBeNull();
  });

  it("rejects a non-array, non-null days", () => {
    expect(parseStoredDraft({ ...valid, days: "nope", accommodationLegs: [] })).toBeNull();
    expect(parseStoredDraft({ ...valid, days: 3, accommodationLegs: [] })).toBeNull();
  });

  it.each([
    ["a place missing from every day", [{ id: "d1", placeIds: ["p1"], accommodationBoundary: unselected }]],
    ["a place outside the route", [{ id: "d1", placeIds: ["p1", "p2", "p3", "ghost"], accommodationBoundary: unselected }]],
    ["a place duplicated inside one day", [{ id: "d1", placeIds: ["p1", "p1", "p2", "p3"], accommodationBoundary: unselected }]],
    [
      "a place duplicated across two days",
      [
        { id: "d1", placeIds: ["p1", "p2", "p3"], accommodationBoundary: unselected },
        { id: "d2", placeIds: ["p1"], accommodationBoundary: unselected },
      ],
    ],
    ["zero day buckets", []],
  ])("rejects a projected matrix that fails validateDayPartition: %s", (_label, days) => {
    expect(parseStoredDraft({ ...valid, days, accommodationLegs: [] })).toBeNull();
  });

  it("rejects a selected boundary on an empty day, on either side", () => {
    const base = { ...valid, routeIds: ["p1"], visitStartTimes: {}, accommodationLegs: [] };
    for (const bad of [
      boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "unselected" }),
      boundary({ kind: "unselected" }, { kind: "accommodation", accommodationId: "hotel-a" }),
      boundary({ kind: "no-accommodation" }, { kind: "unselected" }),
      boundary({ kind: "unselected" }, { kind: "no-accommodation" }),
    ]) {
      expect(
        parseStoredDraft({
          ...base,
          days: [
            { id: "d1", placeIds: ["p1"], accommodationBoundary: unselected },
            { id: "d2", placeIds: [], accommodationBoundary: bad },
          ],
        })
      ).toBeNull();
    }
  });

  it("accepts an empty day whose boundary is fully unselected", () => {
    const parsed = parseStoredDraft({
      ...valid,
      routeIds: ["p1"],
      visitStartTimes: {},
      accommodationLegs: [],
      days: [
        { id: "d1", placeIds: ["p1"], accommodationBoundary: unselected },
        { id: "d2", placeIds: [], accommodationBoundary: unselected },
      ],
    });
    expect(parsed!.days![1]).toEqual(day("d2", []));
  });

  it("rejects a boundary naming an unknown accommodation", () => {
    expect(
      parseStoredDraft({
        ...valid,
        accommodations: [hotelA],
        accommodationLegs: [],
        days: [
          {
            id: "d1",
            placeIds: ["p1", "p2"],
            accommodationBoundary: boundary({ kind: "accommodation", accommodationId: "ghost" }, { kind: "unselected" }),
          },
          { id: "d2", placeIds: ["p3"], accommodationBoundary: unselected },
        ],
      })
    ).toBeNull();
  });

  it("rejects duplicate accommodation ids", () => {
    expect(parseStoredDraft({ ...valid, accommodations: [hotelA, hotelA], accommodationLegs: [] })).toBeNull();
  });

  it.each([
    ["an unknown direction", { ...legAtoP1, direction: "sideways" }],
    ["an unknown accommodation", { ...legAtoP1, accommodationId: "ghost" }],
    ["a place outside the route", { ...legAtoP1, placeId: "ghost" }],
    ["zero minutes", { ...legAtoP1, minutes: 0 }],
    ["negative minutes", { ...legAtoP1, minutes: -5 }],
    ["fractional minutes", { ...legAtoP1, minutes: 12.5 }],
    ["NaN minutes", { ...legAtoP1, minutes: Number.NaN }],
    ["a non-user-entered source", { ...legAtoP1, source: { kind: "derived" } }],
    ["a non-object leg", "leg"],
  ])("rejects a malformed manual leg: %s", (_label, leg) => {
    expect(parseStoredDraft({ ...valid, accommodationLegs: [leg] })).toBeNull();
  });

  it("rejects two legs sharing one exact directed key", () => {
    expect(parseStoredDraft({ ...valid, accommodationLegs: [legAtoP1, { ...legAtoP1, minutes: 45 }] })).toBeNull();
  });

  it("accepts two legs that differ only by direction", () => {
    const parsed = parseStoredDraft({
      ...valid,
      accommodationLegs: [
        legAtoP1,
        { direction: "place-to-accommodation", placeId: "p1", accommodationId: "hotel-a", minutes: 25, source: { kind: "user-entered" } },
      ],
    });
    expect(parsed!.accommodationLegs).toHaveLength(2);
  });

  it.each([
    ["a duplicate route id", { routeIds: ["p1", "p1", "p2", "p3"] }],
    ["a non-string route id", { routeIds: ["p1", 2, "p3"] }],
    ["an invalid startDate", { startDate: "2026-13-45" }],
    ["a malformed visit start time", { visitStartTimes: { p1: "9:00" } }],
    ["a non-object visitStartTimes", { visitStartTimes: [] }],
  ])("rejects an inherited V1–V4 invariant violation: %s", (_label, override) => {
    expect(parseStoredDraft({ ...valid, ...override })).toBeNull();
  });

  it("rejects a non-object payload", () => {
    for (const bad of [null, "x", 5, [], undefined]) expect(parseStoredDraft(bad)).toBeNull();
  });

  it("never repairs — a rejected draft yields null, never a partially salvaged one", () => {
    const corrupted = {
      ...valid,
      days: [
        { id: "same", placeIds: ["p1", "p2"], accommodationBoundary: unselected },
        { id: "same", placeIds: ["p3"], accommodationBoundary: unselected },
      ],
      accommodationLegs: [],
    };
    expect(parseStoredDraft(corrupted)).toBeNull();
  });

  it("round-trips through storage byte-identically", () => {
    const storage = memoryStorage();
    const original = parseStoredDraft(valid)!;
    writeDraft(storage, original);
    const raw = storage.getItem(PLANNING_DRAFT_STORAGE_KEY)!;
    expect(parseStoredDraft(JSON.parse(raw))).toEqual(original);
    // Persisted under the SAME existing key — no second store for day ids.
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
  });

  it("round-trips day ids and boundaries through loadReconciledDraft", () => {
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(valid) });
    const loaded = loadReconciledDraft(storage, ["p1", "p2", "p3"]);
    expect(loaded.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(loaded.days![0].accommodationBoundary).toEqual(valid.days[0].accommodationBoundary);
  });

  it("falls back to a fresh draft for an unreadable or corrupt stored value", () => {
    expect(loadReconciledDraft(memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: "{not json" }), ["p1"]).days).toBeNull();
    expect(freshDraft(["p1", "p2"]).days).toBeNull();
    expect(freshDraft(["p1", "p2"]).routeIds).toEqual(["p1", "p2"]);
  });
});

// ---------------------------------------------------------------------------------------
// Projection towards DayAssignment
// ---------------------------------------------------------------------------------------

describe("dayMatrixFromPlanningDays — the identity/ordinal boundary", () => {
  it("projects V5 days deterministically to string[][]", () => {
    const days = [day("d1", ["p1", "p2"]), day("d2", ["p3"])];
    expect(dayMatrixFromPlanningDays(days)).toEqual([["p1", "p2"], ["p3"]]);
    expect(dayMatrixFromPlanningDays(days)).toEqual(dayMatrixFromPlanningDays(days));
  });

  it("preserves day order and each day's place order exactly", () => {
    const days = [day("z", ["p3", "p1"]), day("a", []), day("m", ["p2"])];
    expect(dayMatrixFromPlanningDays(days)).toEqual([["p3", "p1"], [], ["p2"]]);
  });

  it("projects null to null", () => {
    expect(dayMatrixFromPlanningDays(null)).toBeNull();
  });

  it("copies rather than aliasing — mutating the projection cannot reach the entities", () => {
    const days = [day("d1", ["p1"])];
    const matrix = dayMatrixFromPlanningDays(days)!;
    matrix[0].push("p2");
    expect(days[0].placeIds).toEqual(["p1"]);
  });

  it("exposes no day id to validateDayPartition — it sees only the projected matrix", () => {
    const days = [day("d1", ["p1", "p2"]), day("d2", ["p3"])];
    const matrix = dayMatrixFromPlanningDays(days)!;
    expect(JSON.stringify(matrix)).not.toContain("d1");
    expect(JSON.stringify(matrix)).not.toContain("d2");
    expect(validateDayPartition(["p1", "p2", "p3"], matrix)).toEqual({ valid: true, issues: [] });
  });

  it("changing ONLY a day id cannot modify the DayAssignment", () => {
    const before = [day("d1", ["p1", "p2"]), day("d2", ["p3"])];
    const after = [day("totally-different", ["p1", "p2"]), day("also-different", ["p3"])];
    const routeIds = ["p1", "p2", "p3"];
    expect(dayMatrixFromPlanningDays(after)).toEqual(dayMatrixFromPlanningDays(before));
    expect(buildDayAssignment(routeIds, dayMatrixFromPlanningDays(after)!)).toEqual(
      buildDayAssignment(routeIds, dayMatrixFromPlanningDays(before)!)
    );
  });

  it("changing ONLY a day id cannot modify the derived civil date or weekday", () => {
    const before = draftV5({ startDate: "2026-03-01" });
    const after = { ...before, days: [day("x", ["p1", "p2"]), day("y", ["p3"])] };
    for (let index = 0; index < before.days!.length; index += 1) {
      expect(addCivilDays(after.startDate!, index)).toBe(addCivilDays(before.startDate!, index));
    }
    // A weekday signal is built from places plus the ORDINAL date, never from an id.
    expect(buildDayWeekdaySignal([], addCivilDays(after.startDate!, 1))).toEqual(
      buildDayWeekdaySignal([], addCivilDays(before.startDate!, 1))
    );
  });

  it("changing ONLY a day id cannot modify a reservation or intra-day transfer result", () => {
    const routeIds = ["p1", "p2", "p3"];
    const before = buildDayAssignment(routeIds, dayMatrixFromPlanningDays([day("d1", ["p1", "p2"]), day("d2", ["p3"])])!);
    const after = buildDayAssignment(routeIds, dayMatrixFromPlanningDays([day("q1", ["p1", "p2"]), day("q2", ["p3"])])!);
    expect(after.days.map((bucket) => bucket.sequence)).toEqual(before.days.map((bucket) => bucket.sequence));
    expect(after.valid).toBe(before.valid);
    expect(after.issues).toEqual(before.issues);
  });

  it("changing ONLY a day id cannot change the derived accommodation boundary result", () => {
    const legs = [legAtoP1];
    const choice: DayAccommodationBoundary["start"] = { kind: "accommodation", accommodationId: "hotel-a" };
    expect(deriveAccommodationBoundaryLeg(["p1", "p2"], choice, "start", legs)).toEqual(
      deriveAccommodationBoundaryLeg(["p1", "p2"], choice, "start", legs)
    );
  });
});

// ---------------------------------------------------------------------------------------
// Identity-aware mutations
// ---------------------------------------------------------------------------------------

describe("withPlaceMovedWithinDay — reorder inside one day", () => {
  const selected = boundary(
    { kind: "accommodation", accommodationId: "hotel-a" },
    { kind: "accommodation", accommodationId: "hotel-a" }
  );
  const base = draftV5({
    days: [day("d1", ["p1", "p2"], selected), day("d2", ["p3"])],
    accommodations: [hotelA],
    accommodationLegs: [legAtoP1, legP2toA],
  });

  it("preserves the day id and the accommodation boundary, changing only placeIds", () => {
    const next = withPlaceMovedWithinDay(base, "d1", 0, 1);
    expect(next.days![0].id).toBe("d1");
    expect(next.days![0].placeIds).toEqual(["p2", "p1"]);
    expect(next.days![0].accommodationBoundary).toEqual(selected);
    expect(next.days![1]).toEqual(base.days![1]);
  });

  it("preserves the stored manual legs byte-for-byte", () => {
    const next = withPlaceMovedWithinDay(base, "d1", 0, 1);
    expect(next.accommodationLegs).toEqual([legAtoP1, legP2toA]);
  });

  it("recomputes first/last derived results from the new order and never rebinds an old leg", () => {
    const next = withPlaceMovedWithinDay(base, "d1", 0, 1);
    // Start endpoint is now p2; the only accommodation-to-place leg on record is for p1.
    const outbound = deriveAccommodationBoundaryLeg(
      next.days![0].placeIds,
      next.days![0].accommodationBoundary.start,
      "start",
      next.accommodationLegs
    );
    expect(outbound).toEqual({ kind: "manual-leg-missing", side: "start", accommodationId: "hotel-a", placeId: "p2" });
    // End endpoint is now p1; the only place-to-accommodation leg on record is for p2.
    const returnLeg = deriveAccommodationBoundaryLeg(
      next.days![0].placeIds,
      next.days![0].accommodationBoundary.end,
      "end",
      next.accommodationLegs
    );
    expect(returnLeg).toEqual({ kind: "manual-leg-missing", side: "end", accommodationId: "hotel-a", placeId: "p1" });
    // The old legs are still persisted, simply unused — never reused as the new endpoint's value.
    expect(next.accommodationLegs).toEqual([legAtoP1, legP2toA]);
  });

  it("keeps the exact leg when the endpoint did not actually change", () => {
    const threeDay = draftV5({
      days: [day("d1", ["p1", "p2", "p3"], selected)],
      accommodations: [hotelA],
      accommodationLegs: [legAtoP1],
    });
    const next = withPlaceMovedWithinDay(threeDay, "d1", 1, 1);
    expect(next.days![0].placeIds).toEqual(["p1", "p3", "p2"]);
    expect(
      deriveAccommodationBoundaryLeg(next.days![0].placeIds, selected.start, "start", next.accommodationLegs)
    ).toEqual({ kind: "manual-leg", side: "start", minutes: 20, accommodationId: "hotel-a", placeId: "p1" });
  });

  it("rejects an unknown day id, an out-of-range index, and a move off either end", () => {
    expect(withPlaceMovedWithinDay(base, "ghost", 0, 1)).toBe(base);
    expect(withPlaceMovedWithinDay(base, "d1", 5, 1)).toBe(base);
    expect(withPlaceMovedWithinDay(base, "d1", -1, 1)).toBe(base);
    expect(withPlaceMovedWithinDay(base, "d1", 0, -1)).toBe(base);
    expect(withPlaceMovedWithinDay(base, "d1", 1, 1)).toBe(base);
    expect(withPlaceMovedWithinDay({ ...base, days: null }, "d1", 0, 1).days).toBeNull();
  });

  it("leaves the projected partition valid", () => {
    const next = withPlaceMovedWithinDay(base, "d1", 0, 1);
    expect(validateDayPartition(next.routeIds, dayMatrixFromPlanningDays(next.days)!).valid).toBe(true);
  });
});

describe("withPlaceMovedBetweenDays — move one place from Day A to Day B", () => {
  const startA = boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" });
  const startB = boundary({ kind: "unselected" }, { kind: "accommodation", accommodationId: "hotel-b" });
  const base = draftV5({
    days: [day("d1", ["p1", "p2"], startA), day("d2", ["p3"], startB)],
    accommodations: [hotelA, hotelB],
    accommodationLegs: [legAtoP1, legP2toA],
  });

  it("preserves both day ids", () => {
    const next = withPlaceMovedBetweenDays(base, "d1", "d2", 1);
    expect(next.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("preserves both boundaries while both days remain non-empty", () => {
    const next = withPlaceMovedBetweenDays(base, "d1", "d2", 1);
    expect(next.days![0].placeIds).toEqual(["p1"]);
    expect(next.days![1].placeIds).toEqual(["p3", "p2"]);
    expect(next.days![0].accommodationBoundary).toEqual(startA);
    expect(next.days![1].accommodationBoundary).toEqual(startB);
  });

  it("preserves the exact stored manual legs", () => {
    expect(withPlaceMovedBetweenDays(base, "d1", "d2", 1).accommodationLegs).toEqual([legAtoP1, legP2toA]);
  });

  it("produces manual-leg-missing for a new endpoint with no exact leg, never a reused duration", () => {
    const next = withPlaceMovedBetweenDays(base, "d1", "d2", 1);
    // Day 2's end endpoint is now p2; its chosen anchor is hotel-b, and the only p2 leg on record
    // points at hotel-a. Neither the anchor nor the direction may be substituted.
    expect(
      deriveAccommodationBoundaryLeg(
        next.days![1].placeIds,
        next.days![1].accommodationBoundary.end,
        "end",
        next.accommodationLegs
      )
    ).toEqual({ kind: "manual-leg-missing", side: "end", accommodationId: "hotel-b", placeId: "p2" });
  });

  it("resolves the exact leg when one exists for the new endpoint", () => {
    const withExact = { ...base, accommodationLegs: [legAtoP1, legP2toA] };
    const next = withPlaceMovedBetweenDays(withExact, "d2", "d1", 0);
    // Day 1 is now [p1, p2, p3]; its start endpoint p1 still has its exact hotel-a leg.
    expect(
      deriveAccommodationBoundaryLeg(
        next.days![0].placeIds,
        next.days![0].accommodationBoundary.start,
        "start",
        next.accommodationLegs
      )
    ).toEqual({ kind: "manual-leg", side: "start", minutes: 20, accommodationId: "hotel-a", placeId: "p1" });
  });

  it("keeps an emptied day as a bucket with its id and resets BOTH boundary sides to unselected", () => {
    const single = draftV5({
      routeIds: ["p1", "p2"],
      days: [day("d1", ["p1"], boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" })), day("d2", ["p2"])],
      accommodations: [hotelA],
      accommodationLegs: [legAtoP1],
    });
    const next = withPlaceMovedBetweenDays(single, "d1", "d2", 0);
    expect(next.days![0]).toEqual(day("d1", []));
    expect(next.days![0].accommodationBoundary.start).toEqual({ kind: "unselected" });
    expect(next.days![0].accommodationBoundary.end).toEqual({ kind: "unselected" });
    // Not converted into an explicit no-accommodation statement.
    expect(next.days![0].accommodationBoundary.start.kind).not.toBe("no-accommodation");
    // And its manual legs are NOT deleted just because the day emptied.
    expect(next.accommodationLegs).toEqual([legAtoP1]);
  });

  it("does not resurrect the old boundary when the emptied day is repopulated", () => {
    const single = draftV5({
      routeIds: ["p1", "p2"],
      days: [day("d1", ["p1"], boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" })), day("d2", ["p2"])],
      accommodations: [hotelA],
      accommodationLegs: [],
    });
    const emptied = withPlaceMovedBetweenDays(single, "d1", "d2", 0);
    expect(emptied.days![1].placeIds).toEqual(["p2", "p1"]);
    // Move that very same place back into the day it came from.
    const repopulated = withPlaceMovedBetweenDays(emptied, "d2", "d1", 1);
    expect(repopulated.days![0].id).toBe("d1");
    expect(repopulated.days![0].placeIds).toEqual(["p1"]);
    expect(repopulated.days![0].accommodationBoundary).toEqual(unselected);
  });

  it("stores no hidden state to restore an emptied day's choice", () => {
    const single = draftV5({
      routeIds: ["p1", "p2"],
      days: [day("d1", ["p1"], boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "unselected" })), day("d2", ["p2"])],
      accommodations: [hotelA],
      accommodationLegs: [],
    });
    const emptied = withPlaceMovedBetweenDays(single, "d1", "d2", 0);
    expect(JSON.stringify(emptied.days![0])).not.toContain("hotel-a");
  });

  it("rejects an unknown day id, the same day on both sides, and an out-of-range index", () => {
    expect(withPlaceMovedBetweenDays(base, "ghost", "d2", 0)).toBe(base);
    expect(withPlaceMovedBetweenDays(base, "d1", "ghost", 0)).toBe(base);
    expect(withPlaceMovedBetweenDays(base, "d1", "d1", 0)).toBe(base);
    expect(withPlaceMovedBetweenDays(base, "d1", "d2", 9)).toBe(base);
    expect(withPlaceMovedBetweenDays(base, "d1", "d2", -1)).toBe(base);
  });

  it("leaves the projected partition valid", () => {
    const next = withPlaceMovedBetweenDays(base, "d1", "d2", 1);
    expect(validateDayPartition(next.routeIds, dayMatrixFromPlanningDays(next.days)!).valid).toBe(true);
  });
});

describe("withNewEmptyDay / withoutEmptyDay", () => {
  it("adds one day with a fresh unique opaque id, empty places and unselected boundaries", () => {
    const base = draftV5();
    const next = withNewEmptyDay(base, sequentialIds());
    expect(next.days).toHaveLength(3);
    expect(next.days![2]).toEqual(day("new-1", []));
    expect(new Set(next.days!.map((d) => d.id)).size).toBe(3);
    // No date is stored inside the day entity.
    expect(Object.keys(next.days![2])).toEqual(["id", "placeIds", "accommodationBoundary"]);
  });

  it("leaves every existing day's id, places and boundary untouched — only the new day is unselected", () => {
    const selected = boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" });
    const base = draftV5({ days: [day("d1", ["p1", "p2"], selected), day("d2", ["p3"])], accommodations: [hotelA] });
    const next = withNewEmptyDay(base, sequentialIds());
    expect(next.days!.slice(0, 2)).toEqual(base.days);
    expect(next.days![2].accommodationBoundary).toEqual(unselected);
  });

  it("never derives the new id from the date, index, placeIds, accommodation or content", () => {
    const base = draftV5({ startDate: "2026-03-01", accommodations: [hotelA] });
    const id = withNewEmptyDay(base, () => "opaque-token").days![2].id;
    expect(id).toBe("opaque-token");
    for (const forbidden of ["2026-03-01", "p1", "p2", "p3", "hotel-a", "2"]) {
      expect(id).not.toContain(forbidden);
    }
  });

  it("fails safely rather than overwriting when no unique id can be minted", () => {
    const base = draftV5();
    expect(withNewEmptyDay(base, () => "d1")).toBe(base);
    expect(withNewEmptyDay(base, () => "")).toBe(base);
    expect(withNewEmptyDay({ ...base, days: null }, sequentialIds()).days).toBeNull();
  });

  it("deletes only the named empty day", () => {
    const base = draftV5({
      routeIds: ["p1", "p2", "p3"],
      days: [day("d1", ["p1", "p2"]), day("gone", []), day("d2", ["p3"])],
      startDate: "2026-03-01",
      visitStartTimes: { p1: "09:00" },
      accommodations: [hotelA],
      accommodationLegs: [legAtoP1],
    });
    const next = withoutEmptyDay(base, "gone");
    expect(next.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(next.accommodations).toEqual([hotelA]);
    expect(next.accommodationLegs).toEqual([legAtoP1]);
    expect(next.startDate).toBe("2026-03-01");
    expect(next.visitStartTimes).toEqual({ p1: "09:00" });
    expect(next.routeIds).toEqual(["p1", "p2", "p3"]);
  });

  it("refuses to delete a non-empty day, an unknown day, or the last remaining day", () => {
    const base = draftV5();
    expect(withoutEmptyDay(base, "d1")).toBe(base);
    expect(withoutEmptyDay(base, "ghost")).toBe(base);
    const only = draftV5({ routeIds: [], days: [day("solo", [])] });
    expect(withoutEmptyDay(only, "solo")).toBe(only);
  });
});

describe("withDayAccommodationChoice — addressed by stable id", () => {
  const base = draftV5({ accommodations: [hotelA, hotelB] });

  it("records one side of one identified day without touching the other side or another day", () => {
    const next = withDayAccommodationChoice(base, "d1", "start", { kind: "accommodation", accommodationId: "hotel-a" });
    expect(next.days![0].accommodationBoundary).toEqual(
      boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "unselected" })
    );
    expect(next.days![1]).toEqual(base.days![1]);
    expect(next.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("rejects an unknown day id, an unknown anchor, and an empty day", () => {
    expect(withDayAccommodationChoice(base, "ghost", "start", { kind: "no-accommodation" })).toBe(base);
    expect(withDayAccommodationChoice(base, "d1", "start", { kind: "accommodation", accommodationId: "ghost" })).toBe(base);
    const withEmpty = draftV5({ routeIds: ["p1"], days: [day("d1", ["p1"]), day("empty", [])], accommodations: [hotelA] });
    expect(withDayAccommodationChoice(withEmpty, "empty", "start", { kind: "accommodation", accommodationId: "hotel-a" })).toBe(withEmpty);
    expect(withDayAccommodationChoice(withEmpty, "empty", "end", { kind: "no-accommodation" })).toBe(withEmpty);
  });

  it("keeps unselected, no-accommodation and accommodation as three distinct states", () => {
    const a = withDayAccommodationChoice(base, "d1", "start", { kind: "no-accommodation" });
    expect(a.days![0].accommodationBoundary.start).toEqual({ kind: "no-accommodation" });
    const b = withDayAccommodationChoice(a, "d1", "start", { kind: "unselected" });
    expect(b.days![0].accommodationBoundary.start).toEqual({ kind: "unselected" });
  });
});

describe("withoutAccommodation — anchor deletion under stable identity", () => {
  it("resets only the choices naming the deleted anchor, preserving every day id", () => {
    const base = draftV5({
      days: [
        day("d1", ["p1", "p2"], boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "accommodation", accommodationId: "hotel-b" })),
        day("d2", ["p3"], boundary({ kind: "no-accommodation" }, { kind: "accommodation", accommodationId: "hotel-a" })),
      ],
      accommodations: [hotelA, hotelB],
      accommodationLegs: [legAtoP1],
    });
    const next = withoutAccommodation(base, "hotel-a");
    expect(next.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(next.days![0].accommodationBoundary).toEqual(
      boundary({ kind: "unselected" }, { kind: "accommodation", accommodationId: "hotel-b" })
    );
    expect(next.days![1].accommodationBoundary).toEqual(boundary({ kind: "no-accommodation" }, { kind: "unselected" }));
    expect(next.accommodationLegs).toEqual([]);
    expect(next.accommodations).toEqual([hotelB]);
  });
});

// ---------------------------------------------------------------------------------------
// Legacy / bulk setter
// ---------------------------------------------------------------------------------------

describe("withDays — the compatibility bulk setter fails closed", () => {
  const selectedA = boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" });
  const base = draftV5({
    days: [day("d1", ["p1", "p2"], selectedA), day("d2", ["p3"])],
    accommodations: [hotelA],
    accommodationLegs: [legAtoP1],
  });

  it("preserves the exact ids and boundaries for an element-for-element identical matrix", () => {
    const next = withDays(base, [["p1", "p2"], ["p3"]]);
    expect(next.days).toEqual(base.days);
    expect(next.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(next.days![0].accommodationBoundary).toEqual(selectedA);
    expect(next).toEqual(base);
  });

  it.each([
    ["a reorder inside one day", [["p2", "p1"], ["p3"]]],
    ["a place moved between days", [["p1"], ["p2", "p3"]]],
    ["an inserted empty day", [[], ["p1", "p2"], ["p3"]]],
    ["an appended empty day", [["p1", "p2"], ["p3"], []]],
    ["a removed day", [["p1", "p2", "p3"]]],
    ["a whole re-split", [["p1"], ["p2"], ["p3"]]],
    ["an invalid partition", [["p1"]]],
  ])("returns the draft unchanged for a non-identical matrix: %s", (_label, matrix) => {
    const next = withDays(base, matrix);
    expect(next).toBe(base);
    expect(next.days).toEqual(base.days);
  });

  it("never regenerates an id", () => {
    const next = withDays(base, [["p1"], ["p2", "p3"]]);
    expect(next.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("never carries an id forward by index into a differently-shaped matrix", () => {
    const next = withDays(base, [[], ["p1", "p2"], ["p3"]]);
    // If index carry-forward had happened, d1 would now hold [] and d2 would hold [p1, p2].
    expect(next.days).toEqual(base.days);
    expect(next.days![0].placeIds).toEqual(["p1", "p2"]);
  });

  it("never similarity-matches an old bucket to a new one", () => {
    // A near-identical matrix (one place moved) is exactly the case a similarity matcher would
    // "recognise". It is rejected outright instead.
    const next = withDays(base, [["p1", "p2", "p3"], []]);
    expect(next).toBe(base);
    expect(next.days![1].placeIds).toEqual(["p3"]);
  });

  it("never partially applies, and never touches anything but days", () => {
    const next = withDays(base, [["p1"], ["p2"], ["p3"]]);
    expect(next.routeIds).toEqual(base.routeIds);
    expect(next.accommodations).toEqual(base.accommodations);
    expect(next.accommodationLegs).toEqual(base.accommodationLegs);
    expect(next.startDate).toBe(base.startDate);
    expect(next.visitStartTimes).toEqual(base.visitStartTimes);
  });

  it("rejects any matrix when there is no day assignment yet", () => {
    const noDays = draftV5({ days: null });
    expect(withDays(noDays, [["p1", "p2", "p3"]])).toBe(noDays);
  });
});

describe("withInitialDays — the first split only", () => {
  it("mints one fresh unique id per bucket when no assignment exists", () => {
    const next = withInitialDays(draftV5({ days: null }), [["p1", "p2", "p3"]], sequentialIds());
    expect(next.days).toEqual([day("new-1", ["p1", "p2", "p3"])]);
  });

  it("refuses to touch a draft that already has day entities", () => {
    const base = draftV5();
    expect(withInitialDays(base, [["p1"], ["p2"], ["p3"]], sequentialIds())).toBe(base);
  });

  it("rejects a matrix that does not partition routeIds", () => {
    const base = draftV5({ days: null });
    expect(withInitialDays(base, [["p1"]], sequentialIds())).toBe(base);
    expect(withInitialDays(base, [], sequentialIds())).toBe(base);
  });

  it("fails whole rather than half-applying when an id cannot be minted", () => {
    const base = draftV5({ days: null });
    expect(withInitialDays(base, [["p1"], ["p2", "p3"]], () => "")).toBe(base);
  });
});

describe("createDayId — collision-safe injected factory", () => {
  it("returns the first non-empty unused id", () => {
    expect(createDayId(["a"], sequentialIds())).toBe("new-1");
  });

  it("retries past a collision within the bounded attempt count", () => {
    const ids = ["taken", "taken", "free"];
    let index = 0;
    expect(createDayId(["taken"], () => ids[index++])).toBe("free");
  });

  it("gives up safely after the bounded retries rather than reusing an id", () => {
    expect(createDayId(["taken"], () => "taken")).toBeNull();
    expect(createDayId([], () => "")).toBeNull();
    let calls = 0;
    createDayId(["taken"], () => { calls += 1; return "taken"; }, 3);
    expect(calls).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------
// Route reconciliation, start date, reset
// ---------------------------------------------------------------------------------------

describe("withRoute / resetRoute / reconcileDraft — composition rules stay conservative", () => {
  const selectedA = boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" });
  const base = draftV5({
    days: [day("d1", ["p1", "p2"], selectedA), day("d2", ["p3"])],
    startDate: "2026-03-01",
    accommodations: [hotelA],
    accommodationLegs: [legAtoP1],
  });

  it("invalidates days to null when route composition changes", () => {
    const next = withRoute(base, ["p1", "p2"]);
    expect(next.days).toBeNull();
    expect(next.accommodations).toEqual([hotelA]);
    expect(next.startDate).toBe("2026-03-01");
    expect(next.accommodationLegs).toEqual([legAtoP1]);
  });

  it("prunes manual legs only for places that left the route", () => {
    const withBoth = { ...base, accommodationLegs: [legAtoP1, legP2toA] };
    const next = withRoute(withBoth, ["p1", "p3"]);
    expect(next.days).toBeNull();
    expect(next.accommodationLegs).toEqual([legAtoP1]);
  });

  it("does not try to reuse or re-match old days after an invalidation", () => {
    const invalidated = withRoute(base, ["p1", "p2"]);
    const resplit = withInitialDays(invalidated, [["p1", "p2"]], sequentialIds());
    expect(resplit.days!.map((d) => d.id)).toEqual(["new-1"]);
    expect(resplit.days![0].accommodationBoundary).toEqual(unselected);
  });

  it("preserves every id and boundary on a pure reorder of the same id set", () => {
    const next = withRoute(base, ["p3", "p1", "p2"]);
    expect(next.days).toEqual(base.days);
    expect(next.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(next.days![0].accommodationBoundary).toEqual(selectedA);
  });

  it("clears the day assignment entirely on resetRoute — no day id survives", () => {
    const next = resetRoute(base, ["p1", "p2", "p3"]);
    expect(next.days).toBeNull();
    expect(next.accommodations).toEqual([hotelA]);
    expect(next.startDate).toBe("2026-03-01");
  });

  it("keeps surviving day entities across a reconciliation prune, emptying rather than deleting", () => {
    const next = reconcileDraft(base, ["p1", "p3"]);
    expect(next.routeIds).toEqual(["p1", "p3"]);
    expect(next.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(next.days![0].placeIds).toEqual(["p1"]);
    expect(next.days![0].accommodationBoundary).toEqual(selectedA);
  });

  it("resets an emptied day's boundary during reconciliation, keeping its id", () => {
    const single = draftV5({
      routeIds: ["p1", "p2"],
      days: [day("d1", ["p1"], selectedA), day("d2", ["p2"])],
      accommodations: [hotelA],
      accommodationLegs: [legAtoP1],
    });
    const next = reconcileDraft(single, ["p2"]);
    expect(next.days![0]).toEqual(day("d1", []));
    expect(next.accommodationLegs).toEqual([]);
  });

  it("nulls days when the pruned partition no longer validates", () => {
    const next = reconcileDraft({ ...base, days: null }, ["p1", "p2", "p3"]);
    expect(next.days).toBeNull();
  });
});

describe("withStartDate / withVisitStartTime — orthogonal to identity", () => {
  const selectedA = boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" });
  const base = draftV5({
    days: [day("d1", ["p1", "p2"], selectedA), day("d2", ["p3"])],
    startDate: "2026-03-01",
    accommodations: [hotelA],
  });

  it("changing the start date preserves every id, place order and boundary", () => {
    const next = withStartDate(base, "2026-04-15");
    expect(next.startDate).toBe("2026-04-15");
    expect(next.days).toEqual(base.days);
    expect(next.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("clearing the start date preserves every id and boundary", () => {
    const next = withStartDate(base, null);
    expect(next.startDate).toBeNull();
    expect(next.days).toEqual(base.days);
  });

  it("stores no date inside a day entity — the date stays derived from ordinal position", () => {
    for (const entity of base.days!) {
      expect(Object.keys(entity)).toEqual(["id", "placeIds", "accommodationBoundary"]);
      expect(JSON.stringify(entity)).not.toContain("2026-03-01");
    }
    expect(addCivilDays(base.startDate!, 1)).toBe("2026-03-02");
  });

  it("reorder/insert/delete changes derived ordinal dates without changing any day id", () => {
    const withNew = withNewEmptyDay(base, sequentialIds());
    expect(withNew.days!.slice(0, 2).map((d) => d.id)).toEqual(["d1", "d2"]);
    // The new day is ordinal 2, so its derived date is startDate + 2 — computed from position only.
    expect(addCivilDays(withNew.startDate!, 2)).toBe("2026-03-03");
    const deleted = withoutEmptyDay(withNew, "new-1");
    expect(deleted.days!.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("setting a visit start time preserves every day id and boundary", () => {
    const next = withVisitStartTime(base, "p1", "09:15");
    expect(next.visitStartTimes).toEqual({ p1: "09:15" });
    expect(next.days).toEqual(base.days);
  });
});

describe("withAccommodationLeg — day identity is never part of a leg key", () => {
  const base = draftV5({ accommodations: [hotelA] });

  it("stores an exact directed tuple with no day id in it", () => {
    const next = withAccommodationLeg(base, "accommodation-to-place", "hotel-a", "p1", 20);
    expect(next.accommodationLegs).toEqual([legAtoP1]);
    expect(JSON.stringify(next.accommodationLegs)).not.toContain("d1");
    expect(JSON.stringify(next.accommodationLegs)).not.toContain("dayId");
  });

  it("never writes the reverse direction or another endpoint", () => {
    const next = withAccommodationLeg(base, "accommodation-to-place", "hotel-a", "p1", 20);
    expect(next.accommodationLegs).toHaveLength(1);
    expect(
      deriveAccommodationBoundaryLeg(["p1"], { kind: "accommodation", accommodationId: "hotel-a" }, "end", next.accommodationLegs)
    ).toEqual({ kind: "manual-leg-missing", side: "end", accommodationId: "hotel-a", placeId: "p1" });
  });

  it("rejects invalid minutes, an unknown anchor and an out-of-route place", () => {
    expect(withAccommodationLeg(base, "accommodation-to-place", "hotel-a", "p1", 0)).toBe(base);
    expect(withAccommodationLeg(base, "accommodation-to-place", "hotel-a", "p1", 12.5)).toBe(base);
    expect(withAccommodationLeg(base, "accommodation-to-place", "ghost", "p1", 20)).toBe(base);
    expect(withAccommodationLeg(base, "accommodation-to-place", "hotel-a", "ghost", 20)).toBe(base);
  });
});

describe("withAccommodation — anchors stay independent of days", () => {
  it("adds an anchor without touching any day entity", () => {
    const base = draftV5();
    const next = withAccommodation(base, hotelA);
    expect(next.accommodations).toEqual([hotelA]);
    expect(next.days).toEqual(base.days);
  });

  it("rejects a blank label, a duplicate id and an out-of-range coordinate", () => {
    const base = draftV5({ accommodations: [hotelA] });
    expect(withAccommodation(base, { ...hotelA, id: "hotel-c", label: "   " })).toBe(base);
    expect(withAccommodation(base, hotelA)).toBe(base);
    expect(withAccommodation(base, { ...hotelA, id: "hotel-c", location: { lat: 999, lng: 0 } })).toBe(base);
  });
});
