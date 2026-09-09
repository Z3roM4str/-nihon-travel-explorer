import { describe, expect, it } from "vitest";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  createAccommodationId,
  freshDraft,
  loadReconciledDraft,
  migrateV3ToV4,
  parseStoredDraft,
  reconcileDraft,
  resetRoute,
  withAccommodation,
  withAccommodationLeg,
  withDayAccommodationChoice,
  withDays,
  withNewAccommodation,
  withRoute,
  withStartDate,
  withoutAccommodation,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV4,
} from "./planning-draft-v4";
import type { ManualPlanningDraftV3 } from "./planning-draft";

function memoryStorage(initial: Record<string, string> = {}): DraftStorage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
}

const hotelA = {
  id: "hotel-a",
  label: "Hotel A",
  location: { lat: 35.6812, lng: 139.7671 },
};

const hotelB = {
  id: "hotel-b",
  label: "Hotel B",
  location: { lat: 34.7025, lng: 135.4959 },
};

function draftWithDays(): ManualPlanningDraftV4 {
  return {
    version: 4,
    routeIds: ["A", "B", "C"],
    days: [["A", "B"], ["C"]],
    startDate: "2027-02-19",
    visitStartTimes: { A: "09:00" },
    accommodations: [hotelA, hotelB],
    dayAccommodationBoundaries: [
      {
        start: { kind: "accommodation", accommodationId: "hotel-a" },
        end: { kind: "accommodation", accommodationId: "hotel-a" },
      },
      {
        start: { kind: "accommodation", accommodationId: "hotel-a" },
        end: { kind: "accommodation", accommodationId: "hotel-b" },
      },
    ],
    accommodationLegs: [
      {
        direction: "accommodation-to-place",
        accommodationId: "hotel-a",
        placeId: "A",
        minutes: 20,
        source: { kind: "user-entered" },
      },
      {
        direction: "place-to-accommodation",
        placeId: "B",
        accommodationId: "hotel-a",
        minutes: 25,
        source: { kind: "user-entered" },
      },
      {
        direction: "accommodation-to-place",
        accommodationId: "hotel-a",
        placeId: "C",
        minutes: 30,
        source: { kind: "user-entered" },
      },
      {
        direction: "place-to-accommodation",
        placeId: "C",
        accommodationId: "hotel-b",
        minutes: 35,
        source: { kind: "user-entered" },
      },
    ],
  };
}

describe("Phase 3D-Q V3 → V4 migration", () => {
  it("migrates days:null without inventing accommodation state", () => {
    const v3: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B"],
      days: null,
      startDate: null,
      visitStartTimes: {},
    };
    expect(migrateV3ToV4(v3)).toEqual({
      version: 4,
      routeIds: ["A", "B"],
      days: null,
      startDate: null,
      visitStartTimes: {},
      accommodations: [],
      dayAccommodationBoundaries: null,
      accommodationLegs: [],
    });
  });

  it("creates exact same-length all-unselected scaffolding when V3 already has days", () => {
    const v3: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B"],
      days: [["A"], ["B"]],
      startDate: "2027-02-19",
      visitStartTimes: { A: "09:30" },
    };
    const migrated = migrateV3ToV4(v3);
    expect(migrated.days).toEqual([["A"], ["B"]]);
    expect(migrated.dayAccommodationBoundaries).toEqual([
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
    ]);
    expect(migrated.accommodations).toEqual([]);
    expect(migrated.accommodationLegs).toEqual([]);
    expect(migrated.startDate).toBe("2027-02-19");
    expect(migrated.visitStartTimes).toEqual({ A: "09:30" });
  });

  it("loads a genuine V3 record from the existing storage key through the migration chain", () => {
    const stored = {
      version: 3,
      routeIds: ["B", "A"],
      days: [["B"], ["A"]],
      startDate: null,
      visitStartTimes: {},
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const loaded = loadReconciledDraft(storage, ["A", "B"]);
    expect(loaded.version).toBe(4);
    expect(loaded.routeIds).toEqual(["B", "A"]);
    expect(loaded.dayAccommodationBoundaries).toEqual([
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
    ]);
  });
});

describe("Phase 3D-Q V4 strict parser", () => {
  it("accepts a valid V4 draft exactly", () => {
    expect(parseStoredDraft(draftWithDays())).toEqual(draftWithDays());
  });

  it("requires null boundaries when days are null", () => {
    const draft = freshDraft(["A"]);
    expect(parseStoredDraft({ ...draft, dayAccommodationBoundaries: [] })).toBeNull();
  });

  it("requires an exact same-length boundary vector when days exist", () => {
    const draft = draftWithDays();
    expect(parseStoredDraft({ ...draft, dayAccommodationBoundaries: [draft.dayAccommodationBoundaries![0]] })).toBeNull();
    expect(parseStoredDraft({ ...draft, dayAccommodationBoundaries: null })).toBeNull();
  });

  it("rejects duplicate accommodation ids even when labels/coordinates differ", () => {
    const draft = draftWithDays();
    expect(
      parseStoredDraft({
        ...draft,
        accommodations: [hotelA, { ...hotelB, id: hotelA.id }],
      })
    ).toBeNull();
  });

  it("allows equal labels/coordinates for distinct ids without merging them", () => {
    const draft = draftWithDays();
    const duplicateLooking = { id: "hotel-c", label: hotelA.label, location: { ...hotelA.location } };
    const parsed = parseStoredDraft({ ...draft, accommodations: [...draft.accommodations, duplicateLooking] });
    expect(parsed?.accommodations).toHaveLength(3);
    expect(parsed?.accommodations.map((anchor) => anchor.id)).toEqual(["hotel-a", "hotel-b", "hotel-c"]);
  });

  it("rejects non-finite and out-of-range accommodation coordinates", () => {
    const draft = draftWithDays();
    for (const location of [
      { lat: Number.NaN, lng: 139 },
      { lat: 91, lng: 139 },
      { lat: 35, lng: 181 },
      { lat: Number.POSITIVE_INFINITY, lng: 139 },
    ]) {
      expect(parseStoredDraft({ ...draft, accommodations: [{ ...hotelA, location }, hotelB] })).toBeNull();
    }
  });

  it("rejects boundaries that reference an unknown accommodation", () => {
    const draft = draftWithDays();
    expect(
      parseStoredDraft({
        ...draft,
        dayAccommodationBoundaries: [
          { start: { kind: "accommodation", accommodationId: "missing" }, end: { kind: "unselected" } },
          draft.dayAccommodationBoundaries![1],
        ],
      })
    ).toBeNull();
  });

  it("allows only all-unselected accommodation boundaries on an empty day", () => {
    const draft: ManualPlanningDraftV4 = {
      ...draftWithDays(),
      days: [["A", "B", "C"], []],
      dayAccommodationBoundaries: [
        { start: { kind: "unselected" }, end: { kind: "unselected" } },
        { start: { kind: "unselected" }, end: { kind: "unselected" } },
      ],
    };
    expect(parseStoredDraft(draft)).not.toBeNull();
    expect(
      parseStoredDraft({
        ...draft,
        dayAccommodationBoundaries: [
          draft.dayAccommodationBoundaries![0],
          { start: { kind: "no-accommodation" }, end: { kind: "unselected" } },
        ],
      })
    ).toBeNull();
  });

  it("rejects duplicate exact directed leg keys", () => {
    const draft = draftWithDays();
    const first = draft.accommodationLegs[0];
    expect(parseStoredDraft({ ...draft, accommodationLegs: [...draft.accommodationLegs, { ...first, minutes: 99 }] })).toBeNull();
  });

  it("rejects manual legs for unknown accommodations or places outside the stored route", () => {
    const draft = draftWithDays();
    expect(
      parseStoredDraft({
        ...draft,
        accommodationLegs: [
          {
            direction: "accommodation-to-place",
            accommodationId: "missing",
            placeId: "A",
            minutes: 10,
            source: { kind: "user-entered" },
          },
        ],
      })
    ).toBeNull();
    expect(
      parseStoredDraft({
        ...draft,
        accommodationLegs: [
          {
            direction: "accommodation-to-place",
            accommodationId: "hotel-a",
            placeId: "Z",
            minutes: 10,
            source: { kind: "user-entered" },
          },
        ],
      })
    ).toBeNull();
  });

  it("rejects zero, fractional, negative and unsafe manual minutes", () => {
    const draft = draftWithDays();
    for (const minutes of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseStoredDraft({ ...draft, accommodationLegs: [{ ...draft.accommodationLegs[0], minutes }] })).toBeNull();
    }
  });
});

describe("Phase 3D-Q updates and reconciliation", () => {
  it("pure route reorder preserves exact day matrix, boundaries and endpoint-keyed legs", () => {
    const draft = draftWithDays();
    const next = withRoute(draft, ["C", "B", "A"]);
    expect(next.routeIds).toEqual(["C", "B", "A"]);
    expect(next.days).toEqual(draft.days);
    expect(next.dayAccommodationBoundaries).toEqual(draft.dayAccommodationBoundaries);
    expect(next.accommodationLegs).toEqual(draft.accommodationLegs);
  });

  it("route composition change invalidates days/boundaries and prunes removed-place legs", () => {
    const draft = draftWithDays();
    const next = withRoute(draft, ["A", "C"]);
    expect(next.days).toBeNull();
    expect(next.dayAccommodationBoundaries).toBeNull();
    expect(next.accommodationLegs.some((leg) => leg.placeId === "B")).toBe(false);
    expect(next.accommodationLegs.some((leg) => leg.placeId === "A")).toBe(true);
  });

  it("an identical withDays assignment preserves boundaries", () => {
    const draft = draftWithDays();
    const next = withDays(draft, [["A", "B"], ["C"]]);
    expect(next.dayAccommodationBoundaries).toEqual(draft.dayAccommodationBoundaries);
  });

  it("any non-identical valid withDays assignment resets every ordinal boundary to unselected", () => {
    const draft = draftWithDays();
    const next = withDays(draft, [["A"], ["B", "C"]]);
    expect(next.days).toEqual([["A"], ["B", "C"]]);
    expect(next.dayAccommodationBoundaries).toEqual([
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
    ]);
    expect(next.accommodationLegs).toEqual(draft.accommodationLegs);
  });

  it("invalid day assignment is rejected without resetting a valid boundary vector", () => {
    const draft = draftWithDays();
    expect(withDays(draft, [["A"], ["B"]])).toBe(draft);
  });

  it("deleting one accommodation removes its legs and resets only choices that referenced it", () => {
    const next = withoutAccommodation(draftWithDays(), "hotel-a");
    expect(next.accommodations.map((anchor) => anchor.id)).toEqual(["hotel-b"]);
    expect(next.accommodationLegs.every((leg) => leg.accommodationId !== "hotel-a")).toBe(true);
    expect(next.dayAccommodationBoundaries).toEqual([
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
      { start: { kind: "unselected" }, end: { kind: "accommodation", accommodationId: "hotel-b" } },
    ]);
  });

  it("never accepts a selected accommodation boundary for an empty bucket", () => {
    const draft = withDays(draftWithDays(), [["A", "B", "C"], []]);
    const next = withDayAccommodationChoice(draft, 1, "start", { kind: "accommodation", accommodationId: "hotel-a" });
    expect(next).toBe(draft);
  });

  it("keeps unselected and explicit no-accommodation as distinct persisted choices", () => {
    const draft = draftWithDays();
    const next = withDayAccommodationChoice(draft, 0, "start", { kind: "no-accommodation" });
    expect(next.dayAccommodationBoundaries?.[0].start).toEqual({ kind: "no-accommodation" });
    expect(next.dayAccommodationBoundaries?.[0].end).toEqual({ kind: "accommodation", accommodationId: "hotel-a" });
  });

  it("setting an exact leg replaces it and clearing removes only that exact direction", () => {
    const draft = draftWithDays();
    const replaced = withAccommodationLeg(draft, "accommodation-to-place", "hotel-a", "A", 42);
    const outbound = replaced.accommodationLegs.filter(
      (leg) => leg.direction === "accommodation-to-place" && leg.accommodationId === "hotel-a" && leg.placeId === "A"
    );
    expect(outbound).toHaveLength(1);
    expect(outbound[0].minutes).toBe(42);
    const cleared = withAccommodationLeg(replaced, "accommodation-to-place", "hotel-a", "A", null);
    expect(
      cleared.accommodationLegs.some(
        (leg) => leg.direction === "accommodation-to-place" && leg.accommodationId === "hotel-a" && leg.placeId === "A"
      )
    ).toBe(false);
    expect(
      cleared.accommodationLegs.some(
        (leg) => leg.direction === "place-to-accommodation" && leg.accommodationId === "hotel-a"
      )
    ).toBe(true);
  });

  it("rejects invalid minutes and unknown endpoints at the setter boundary", () => {
    const draft = draftWithDays();
    expect(withAccommodationLeg(draft, "accommodation-to-place", "hotel-a", "A", 0)).toBe(draft);
    expect(withAccommodationLeg(draft, "accommodation-to-place", "missing", "A", 10)).toBe(draft);
    expect(withAccommodationLeg(draft, "accommodation-to-place", "hotel-a", "Z", 10)).toBe(draft);
  });

  it("reconciliation prunes a newly stale place leg without rebinding another endpoint", () => {
    const draft = draftWithDays();
    const next = reconcileDraft(draft, ["A", "C"]);
    expect(next.routeIds).toEqual(["A", "C"]);
    expect(next.accommodationLegs.some((leg) => leg.placeId === "B")).toBe(false);
    expect(next.accommodationLegs.some((leg) => leg.placeId === "A")).toBe(true);
  });

  it("reconciliation resets ordinal boundaries when stale-place pruning changes the day matrix", () => {
    const draft = draftWithDays();
    const next = reconcileDraft(draft, ["A", "C"]);
    expect(next.days).toEqual([["A"], ["C"]]);
    expect(next.dayAccommodationBoundaries).toEqual([
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
    ]);
  });

  it("start-date changes leave accommodation decisions untouched", () => {
    const draft = draftWithDays();
    const next = withStartDate(draft, "2027-03-01");
    expect(next.accommodations).toEqual(draft.accommodations);
    expect(next.dayAccommodationBoundaries).toEqual(draft.dayAccommodationBoundaries);
    expect(next.accommodationLegs).toEqual(draft.accommodationLegs);
  });

  it("resetRoute invalidates day boundaries but preserves anchors and endpoint legs that still resolve", () => {
    const draft = draftWithDays();
    const next = resetRoute(draft, ["A", "C"]);
    expect(next.days).toBeNull();
    expect(next.dayAccommodationBoundaries).toBeNull();
    expect(next.accommodations).toEqual(draft.accommodations);
    expect(next.accommodationLegs.every((leg) => leg.placeId !== "B")).toBe(true);
  });
});

describe("Phase 3D-Q accommodation identity setters", () => {
  it("retries id collisions and returns the first unique non-empty id", () => {
    const attempts = ["hotel-a", "", "hotel-b", "hotel-c"];
    expect(createAccommodationId(["hotel-a", "hotel-b"], () => attempts.shift() ?? "fallback")).toBe("hotel-c");
  });

  it("fails safely when the id factory never produces a unique id", () => {
    expect(createAccommodationId(["hotel-a"], () => "hotel-a", 3)).toBeNull();
  });

  it("adds distinct anchors without label/coordinate heuristics", () => {
    const base = freshDraft(["A"]);
    const one = withAccommodation(base, hotelA);
    const two = withAccommodation(one, { id: "hotel-copy", label: hotelA.label, location: { ...hotelA.location } });
    expect(two.accommodations).toHaveLength(2);
  });

  it("rejects duplicate ids and invalid locations", () => {
    const base = withAccommodation(freshDraft(["A"]), hotelA);
    expect(withAccommodation(base, { ...hotelB, id: "hotel-a" })).toBe(base);
    expect(withAccommodation(base, { ...hotelB, location: { lat: 200, lng: 0 } })).toBe(base);
  });
});

describe("Phase 3D-Q historical migration chain and fail-safe loading", () => {
  it("still loads a pre-calendar V1 record all the way to V4", () => {
    const storage = memoryStorage({
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify({ version: 1, routeIds: ["A", "B"], days: [["A"], ["B"]] }),
    });
    const loaded = loadReconciledDraft(storage, ["A", "B"]);
    expect(loaded.version).toBe(4);
    expect(loaded.routeIds).toEqual(["A", "B"]);
    expect(loaded.startDate).toBeNull();
    expect(loaded.visitStartTimes).toEqual({});
    expect(loaded.accommodations).toEqual([]);
    expect(loaded.accommodationLegs).toEqual([]);
    expect(loaded.dayAccommodationBoundaries).toEqual([
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
      { start: { kind: "unselected" }, end: { kind: "unselected" } },
    ]);
  });

  it("still loads a V2 record with its calendar anchor intact", () => {
    const storage = memoryStorage({
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify({
        version: 2,
        routeIds: ["A"],
        days: null,
        startDate: "2027-02-19",
      }),
    });
    const loaded = loadReconciledDraft(storage, ["A"]);
    expect(loaded.version).toBe(4);
    expect(loaded.startDate).toBe("2027-02-19");
    expect(loaded.dayAccommodationBoundaries).toBeNull();
  });

  it("round-trips a V4 draft through storage unchanged", () => {
    const storage = memoryStorage();
    const draft = draftWithDays();
    writeDraft(storage, draft);
    expect(loadReconciledDraft(storage, ["A", "B", "C"])).toEqual(draft);
  });

  it("falls back to a fresh draft for malformed V4 rather than repairing it", () => {
    for (const corrupt of [
      "{ not json",
      JSON.stringify({ ...draftWithDays(), accommodations: "hotel-a" }),
      JSON.stringify({ ...draftWithDays(), accommodationLegs: {} }),
      JSON.stringify({ ...draftWithDays(), version: 5 }),
    ]) {
      const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: corrupt });
      const loaded = loadReconciledDraft(storage, ["A", "B", "C"]);
      expect(loaded).toEqual(freshDraft(["A", "B", "C"]));
    }
  });

  it("rejects malformed tagged unions instead of coercing them to a known choice", () => {
    const draft = draftWithDays();
    for (const start of [
      { kind: "accommodation" },
      { kind: "accommodation", accommodationId: "" },
      { kind: "maybe" },
      { accommodationId: "hotel-a" },
      null,
      "unselected",
    ]) {
      expect(
        parseStoredDraft({
          ...draft,
          dayAccommodationBoundaries: [{ start, end: { kind: "unselected" } }, draft.dayAccommodationBoundaries![1]],
        })
      ).toBeNull();
    }
  });

  it("rejects structurally corrupt accommodation and leg records", () => {
    const draft = draftWithDays();
    expect(parseStoredDraft({ ...draft, accommodations: [{ id: "x", label: "X" }] })).toBeNull();
    expect(parseStoredDraft({ ...draft, accommodations: [{ ...hotelA, id: "" }] })).toBeNull();
    expect(
      parseStoredDraft({
        ...draft,
        accommodationLegs: [{ ...draft.accommodationLegs[0], direction: "place-to-place" }],
      })
    ).toBeNull();
    expect(
      parseStoredDraft({
        ...draft,
        accommodationLegs: [{ ...draft.accommodationLegs[0], source: { kind: "routed" } }],
      })
    ).toBeNull();
    expect(parseStoredDraft(null)).toBeNull();
    expect(parseStoredDraft([draft])).toBeNull();
  });
});

describe("Phase 3D-Q withDays boundary-reset rule", () => {
  const nonIdenticalAssignments: ReadonlyArray<readonly [string, string[][]]> = [
    ["a place moves to another bucket", [["A"], ["B", "C"]]],
    ["places are reordered inside one bucket", [["B", "A"], ["C"]]],
    ["the bucket order changes", [["C"], ["A", "B"]]],
    ["an empty bucket is appended", [["A", "B"], ["C"], []]],
    ["the split is collapsed into one day", [["A", "B", "C"]]],
  ];

  for (const [description, days] of nonIdenticalAssignments) {
    it(`resets every boundary side when ${description}`, () => {
      const draft = draftWithDays();
      const next = withDays(draft, days);
      expect(next.days).toEqual(days);
      expect(next.dayAccommodationBoundaries).toEqual(
        days.map(() => ({ start: { kind: "unselected" }, end: { kind: "unselected" } }))
      );
      // Endpoint-keyed leg records survive the re-split; they are simply unused until the user
      // explicitly chooses a boundary whose exact directed endpoints match one again.
      expect(next.accommodationLegs).toEqual(draft.accommodationLegs);
    });
  }

  it("an old endpoint leg becomes applicable again only through an explicit new choice", () => {
    const draft = draftWithDays();
    const resplit = withDays(draft, [["A"], ["B", "C"]]);
    expect(resplit.dayAccommodationBoundaries?.[0].start).toEqual({ kind: "unselected" });

    // Day 1 is now just "A" — the same first place the stored hotel-a leg was recorded for. The
    // duration is NOT reapplied by the re-split; only the user re-choosing the boundary does it.
    const rechosen = withDayAccommodationChoice(resplit, 0, "start", {
      kind: "accommodation",
      accommodationId: "hotel-a",
    });
    expect(rechosen.dayAccommodationBoundaries?.[0].start).toEqual({
      kind: "accommodation",
      accommodationId: "hotel-a",
    });
    expect(
      rechosen.accommodationLegs.find(
        (leg) => leg.direction === "accommodation-to-place" && leg.accommodationId === "hotel-a" && leg.placeId === "A"
      )?.minutes
    ).toBe(20);
  });
});

describe("Phase 3D-Q accommodation creation via the injected id factory", () => {
  it("mints an id and stores the trimmed label with the user's own coordinate", () => {
    const next = withNewAccommodation(freshDraft(["A"]), "  Hotel Kioto  ", { lat: 34.9855, lng: 135.7587 }, () => "acc-1");
    expect(next.accommodations).toEqual([
      { id: "acc-1", label: "Hotel Kioto", location: { lat: 34.9855, lng: 135.7587 } },
    ]);
  });

  it("leaves the draft untouched when the label is blank or the coordinate is out of range", () => {
    const base = freshDraft(["A"]);
    expect(withNewAccommodation(base, "   ", { lat: 35, lng: 139 }, () => "acc-1")).toBe(base);
    expect(withNewAccommodation(base, "Hotel", { lat: 95, lng: 139 }, () => "acc-1")).toBe(base);
    expect(withNewAccommodation(base, "Hotel", { lat: Number.NaN, lng: 139 }, () => "acc-1")).toBe(base);
  });

  it("leaves the draft untouched when no unique id can be minted", () => {
    const base = withNewAccommodation(freshDraft(["A"]), "Hotel", { lat: 35, lng: 139 }, () => "acc-1");
    expect(withNewAccommodation(base, "Otro hotel", { lat: 36, lng: 140 }, () => "acc-1")).toBe(base);
  });
});
