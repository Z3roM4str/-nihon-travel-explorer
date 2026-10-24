import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  LEGACY_V4_DAY_ID_PREFIX,
  PLANNING_DRAFT_STORAGE_KEY,
  PLANNING_DRAFT_VERSION,
  dayMatrixFromPlanningDays,
  freshDraft,
  loadReconciledDraft,
  migrateV5ToV6,
  parseStoredDraft,
  reconcileDraft,
  resetRoute,
  withAccommodationLeg,
  withDayAccommodationChoice,
  withDayMoved,
  withEndDate,
  withInitialDays,
  withNewAccommodation,
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
  type ManualPlanningDraftV6,
  type PlanningDayV5,
} from "./planning-draft-v6";
import type { ManualPlanningDraftV5 } from "./planning-draft-v5";
import type { ManualPlanningDraftV4 } from "./planning-draft-v4";
import type { DayAccommodationBoundary, ManualAccommodationLeg } from "./accommodation-commute";
import { assessTripBounds } from "./trip-bounds";

/**
 * Phase 3D-W — Trip Bounds Runtime: the §15 matrix for the persisted layer.
 *
 * The through-line of nearly every test below is ONE invariant: the trip's civil range and the
 * day-bucket assignment are independent. `endDate` survives every route, reset, reconcile and day
 * mutation; no bounds write touches a day, an id, a boundary, a leg, an anchor, the route or a
 * visit time; and no migration ever invents an end date from the buckets.
 */

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

function draftV6(overrides: Partial<ManualPlanningDraftV6> = {}): ManualPlanningDraftV6 {
  return {
    version: 6,
    routeIds: ["p1", "p2", "p3"],
    days: [day("d1", ["p1", "p2"]), day("d2", ["p3"])],
    startDate: null,
    endDate: null,
    visitStartTimes: {},
    accommodations: [],
    accommodationLegs: [],
    ...overrides,
  };
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

/** A realistic draft: a set range, several buckets, two hotels, real boundary choices and legs. */
function richDraft(overrides: Partial<ManualPlanningDraftV6> = {}): ManualPlanningDraftV6 {
  return draftV6({
    routeIds: ["p1", "p2", "p3", "p4"],
    days: [
      day("d1", ["p1"], boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" })),
      day("d2", ["p2", "p3"], boundary({ kind: "unselected" }, { kind: "accommodation", accommodationId: "hotel-b" })),
      day("d3", ["p4"]),
      day("d4", []),
    ],
    startDate: "2027-02-19",
    endDate: "2027-02-21", // 3 calendar days, 4 buckets → the last one is after the end
    visitStartTimes: { p1: "09:30" },
    accommodations: [hotelA, hotelB],
    accommodationLegs: [legAtoP1, legP2toA],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------------------
// V5 → V6 migration
// ---------------------------------------------------------------------------------------

describe("migrateV5ToV6 — adds exactly one field and invents nothing", () => {
  it("sets endDate to null and bumps the version", () => {
    const migrated = migrateV5ToV6(draftV5());
    expect(migrated.version).toBe(6);
    expect(migrated.endDate).toBeNull();
  });

  it("changes nothing else — every other field is deep-equal to the V5 input", () => {
    const source = draftV5({
      startDate: "2027-02-19",
      visitStartTimes: { p1: "09:30", p3: "14:00" },
      accommodations: [hotelA, hotelB],
      accommodationLegs: [legAtoP1, legP2toA],
    });
    const migrated = migrateV5ToV6(source);
    const { version: _v6, endDate: _end, ...rest } = migrated;
    const { version: _v5, ...sourceRest } = source;
    expect(rest).toEqual(sourceRest);
  });

  it("keeps days: null as days: null", () => {
    const migrated = migrateV5ToV6(draftV5({ days: null, startDate: "2027-02-19" }));
    expect(migrated.days).toBeNull();
    expect(migrated.startDate).toBe("2027-02-19");
    expect(migrated.endDate).toBeNull();
  });

  it("preserves every day id, placeIds order and accommodationBoundary byte-for-byte", () => {
    const days = [
      day("d1", ["p1", "p2"], boundary({ kind: "accommodation", accommodationId: "hotel-a" }, { kind: "no-accommodation" })),
      day("d2", ["p3"], boundary({ kind: "unselected" }, { kind: "accommodation", accommodationId: "hotel-b" })),
    ];
    const migrated = migrateV5ToV6(draftV5({ days, accommodations: [hotelA, hotelB] }));
    expect(migrated.days).toEqual(days);
    expect(migrated.days!.map((entity) => entity.id)).toEqual(["d1", "d2"]);
    expect(migrated.days![0].placeIds).toEqual(["p1", "p2"]);
  });

  it("preserves anchors and manual legs exactly — none created, removed or rebound", () => {
    const migrated = migrateV5ToV6(
      draftV5({ accommodations: [hotelA, hotelB], accommodationLegs: [legAtoP1, legP2toA] })
    );
    expect(migrated.accommodations).toEqual([hotelA, hotelB]);
    expect(migrated.accommodationLegs).toEqual([legAtoP1, legP2toA]);
  });

  it("NEVER derives an end date from days.length, startDate + days.length - 1, or any other source", () => {
    // A five-bucket, start-dated, hotel-laden, visit-timed draft: every forbidden derivation source
    // is present and non-trivial, so a heuristic migration would produce a visible value here.
    const source = draftV5({
      routeIds: ["p1", "p2", "p3", "p4", "p5"],
      days: [day("d1", ["p1"]), day("d2", ["p2"]), day("d3", ["p3"]), day("d4", ["p4"]), day("d5", ["p5"])],
      startDate: "2027-02-19",
      visitStartTimes: { p1: "09:00", p5: "17:00" },
      accommodations: [hotelA, hotelB],
    });
    const migrated = migrateV5ToV6(source);
    expect(migrated.endDate).toBeNull();
    // Each forbidden candidate spelled out, so a future "helpful" migration fails loudly here.
    expect(migrated.endDate).not.toBe("2027-02-23"); // startDate + days.length - 1
    expect(migrated.endDate).not.toBe("2027-02-24"); // startDate + days.length
    expect(migrated.endDate).not.toBe("2027-02-19"); // startDate itself
    expect(migrated.endDate).not.toBe("2027-02-20"); // startDate + accommodations.length - 1
  });

  it("does not read the current date", () => {
    const migrated = migrateV5ToV6(draftV5({ startDate: "2027-02-19" }));
    expect(migrated.endDate).toBeNull();
  });

  it("is idempotent through a persist/re-parse round trip", () => {
    const migrated = migrateV5ToV6(draftV5({ startDate: "2027-02-19", accommodations: [hotelA] }));
    const reparsed = parseStoredDraft(JSON.parse(JSON.stringify(migrated)));
    expect(reparsed).toEqual(migrated);
    const twice = parseStoredDraft(JSON.parse(JSON.stringify(reparsed)));
    expect(twice).toEqual(migrated);
  });
});

describe("full V1 → V6 historical chain", () => {
  it("migrates a V4 draft through V5 to V6 with endDate: null and legacy day ids intact", () => {
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
    const parsed = parseStoredDraft(v4)!;
    expect(parsed.version).toBe(6);
    expect(parsed.endDate).toBeNull();
    expect(parsed.startDate).toBe("2026-03-01");
    expect(parsed.days!.map((entity) => entity.id)).toEqual([
      `${LEGACY_V4_DAY_ID_PREFIX}0`,
      `${LEGACY_V4_DAY_ID_PREFIX}1`,
    ]);
    expect(parsed.days![0].accommodationBoundary.start).toEqual({
      kind: "accommodation",
      accommodationId: "hotel-a",
    });
    expect(parsed.accommodationLegs).toEqual([legAtoP1]);
  });

  it("migrates a V3 draft (no accommodation model at all) to V6 with endDate: null", () => {
    const parsed = parseStoredDraft({
      version: 3,
      routeIds: ["p1", "p2"],
      days: [["p1"], ["p2"]],
      startDate: "2027-02-19",
      visitStartTimes: {},
    })!;
    expect(parsed.version).toBe(6);
    expect(parsed.endDate).toBeNull();
    expect(parsed.accommodations).toEqual([]);
    expect(parsed.days!.length).toBe(2);
  });

  it("migrates a V1 draft (a bare route) to V6 with endDate: null", () => {
    // A V1 draft carries only a route and a day matrix; `days` is a required key even at V1.
    const parsed = parseStoredDraft({ version: 1, routeIds: ["p1", "p2"], days: null })!;
    expect(parsed.version).toBe(6);
    expect(parsed.endDate).toBeNull();
    expect(parsed.startDate).toBeNull();
  });

  it("migrates a V5 draft found in storage and never invents an end from its buckets", () => {
    const stored = draftV5({ startDate: "2027-02-19" });
    const parsed = parseStoredDraft(JSON.parse(JSON.stringify(stored)))!;
    expect(parsed.version).toBe(6);
    expect(parsed.endDate).toBeNull();
    expect(dayMatrixFromPlanningDays(parsed.days)).toEqual([["p1", "p2"], ["p3"]]);
  });

  it("freshDraft is a V6 draft with both bounds null", () => {
    const fresh = freshDraft(["p1", "p2"]);
    expect(fresh.version).toBe(6);
    expect(fresh.startDate).toBeNull();
    expect(fresh.endDate).toBeNull();
    expect(fresh.routeIds).toEqual(["p1", "p2"]);
  });
});

// ---------------------------------------------------------------------------------------
// Strict parser
// ---------------------------------------------------------------------------------------

describe("parseStoredDraft — strict, all-or-nothing endDate", () => {
  function storedV6(endDate: unknown, extra: Record<string, unknown> = {}): unknown {
    return { ...draftV6({ startDate: "2027-02-19" }), endDate, ...extra };
  }

  it("accepts endDate: null", () => {
    expect(parseStoredDraft(storedV6(null))!.endDate).toBeNull();
  });

  it("accepts a valid civil date and stores it verbatim, never normalized", () => {
    expect(parseStoredDraft(storedV6("2027-03-05"))!.endDate).toBe("2027-03-05");
  });

  it("accepts February 29 in a leap year", () => {
    expect(parseStoredDraft(storedV6("2028-02-29"))!.endDate).toBe("2028-02-29");
  });

  it("rejects the WHOLE draft for a malformed shape", () => {
    for (const bad of ["2027/03/05", "05-03-2027", "2027-3-5", "2027-03", "marzo 5", "2027-03-05 "]) {
      expect(parseStoredDraft(storedV6(bad)), bad).toBeNull();
    }
  });

  it("rejects the WHOLE draft for an impossible date", () => {
    for (const bad of ["2027-02-30", "2027-13-01", "2027-02-29", "2027-00-10", "2027-04-31"]) {
      expect(parseStoredDraft(storedV6(bad)), bad).toBeNull();
    }
  });

  it("rejects a datetime or timezone-suffixed string — never truncated to its date part", () => {
    for (const bad of [
      "2027-03-05T00:00:00Z",
      "2027-03-05T12:30:00",
      "2027-03-05T00:00:00+09:00",
      "2027-03-05Z",
    ]) {
      expect(parseStoredDraft(storedV6(bad)), bad).toBeNull();
    }
  });

  it("rejects an empty string", () => {
    expect(parseStoredDraft(storedV6(""))).toBeNull();
  });

  it("rejects any non-string, non-null value", () => {
    for (const bad of [20270305, 0, true, false, {}, [], { date: "2027-03-05" }, ["2027-03-05"]]) {
      expect(parseStoredDraft(storedV6(bad)), JSON.stringify(bad)).toBeNull();
    }
  });

  it("rejects a draft whose endDate key is ABSENT at version 6", () => {
    const { endDate: _omitted, ...withoutKey } = draftV6({ startDate: "2027-02-19" });
    expect(parseStoredDraft(withoutKey)).toBeNull();
    expect(parseStoredDraft({ ...withoutKey, endDate: undefined })).toBeNull();
  });

  it("ACCEPTS an inverted range — the order relation is not a parse invariant", () => {
    const parsed = parseStoredDraft(
      { ...draftV6({ startDate: "2027-03-05" }), endDate: "2027-02-19" }
    )!;
    expect(parsed.startDate).toBe("2027-03-05");
    expect(parsed.endDate).toBe("2027-02-19");
    // …and the derived layer, not the parser, is what reports the problem.
    expect(assessTripBounds(parsed, 0)).toEqual({ kind: "bounds-unavailable", reason: "inverted-range" });
  });

  it("ACCEPTS an endDate with no startDate — persisted and reloaded intact", () => {
    const parsed = parseStoredDraft({ ...draftV6(), endDate: "2027-03-05" })!;
    expect(parsed.startDate).toBeNull();
    expect(parsed.endDate).toBe("2027-03-05");
    expect(assessTripBounds(parsed, 0)).toEqual({ kind: "bounds-unavailable", reason: "no-start-date" });
  });

  it("accepts endDate === startDate (a one-day trip)", () => {
    const parsed = parseStoredDraft(
      { ...draftV6({ startDate: "2027-02-19" }), endDate: "2027-02-19" }
    )!;
    expect(assessTripBounds(parsed, 0)).toMatchObject({ kind: "within-bounds", tripCalendarDays: 1 });
  });

  it("salvages NOTHING when endDate is bad — route, days, anchors and legs all go", () => {
    const rejected = parseStoredDraft({ ...richDraft(), endDate: "2027-02-30" });
    expect(rejected).toBeNull();
  });

  it("still enforces every pre-existing V5 invariant at version 6", () => {
    const cases: [string, unknown][] = [
      ["days not partitioning routeIds", { ...draftV6({ days: [day("d1", ["p1"])] }) }],
      ["duplicate day id", { ...draftV6({ days: [day("dup", ["p1", "p2"]), day("dup", ["p3"])] }) }],
      [
        "empty day with a non-unselected boundary side",
        {
          ...draftV6({
            routeIds: ["p1"],
            days: [day("d1", ["p1"]), day("d2", [], boundary({ kind: "no-accommodation" }, { kind: "unselected" }))],
          }),
        },
      ],
      [
        "boundary naming an unknown anchor",
        {
          ...draftV6({
            days: [
              day("d1", ["p1", "p2"], boundary({ kind: "accommodation", accommodationId: "ghost" }, { kind: "unselected" })),
              day("d2", ["p3"]),
            ],
          }),
        },
      ],
      ["orphan leg (unknown anchor)", { ...draftV6({ accommodationLegs: [legAtoP1] }) }],
      [
        "duplicate directed leg key",
        { ...draftV6({ accommodations: [hotelA], accommodationLegs: [legAtoP1, { ...legAtoP1, minutes: 45 }] }) },
      ],
      ["invalid startDate", { ...draftV6({ startDate: "2027-02-30" }) }],
      ["invalid visit start time", { ...draftV6({ visitStartTimes: { p1: "25:00" } }) }],
      ["empty day id", { ...draftV6({ days: [day("", ["p1", "p2"]), day("d2", ["p3"])] }) }],
    ];
    for (const [label, raw] of cases) {
      expect(parseStoredDraft(raw), label).toBeNull();
    }
  });

  it("rejects a non-object and an unknown version outright", () => {
    for (const bad of [null, undefined, 5, "draft", [], { version: 99, endDate: null }]) {
      expect(parseStoredDraft(bad), JSON.stringify(bad) ?? "undefined").toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------------------
// withEndDate
// ---------------------------------------------------------------------------------------

describe("withEndDate — stores, clears, or rejects; never anything else", () => {
  it("stores a valid civil date exactly as given", () => {
    expect(withEndDate(draftV6(), "2027-03-05").endDate).toBe("2027-03-05");
  });

  it("clears to null", () => {
    expect(withEndDate(draftV6({ endDate: "2027-03-05" }), null).endDate).toBeNull();
  });

  it("returns the draft UNCHANGED (by reference) for an invalid date", () => {
    const draft = draftV6({ endDate: "2027-03-05" });
    for (const bad of ["", "2027-02-30", "2027-13-01", "2027/03/05", "2027-03-05T00:00:00Z", "mañana"]) {
      expect(withEndDate(draft, bad), bad).toBe(draft);
    }
  });

  it("accepts an end date EARLIER than the start date — no cross-field write rule", () => {
    const next = withEndDate(draftV6({ startDate: "2027-03-05" }), "2027-02-19");
    expect(next.endDate).toBe("2027-02-19");
    expect(next.startDate).toBe("2027-03-05");
  });

  it("accepts an end date while startDate is null", () => {
    const next = withEndDate(draftV6({ startDate: null }), "2027-03-05");
    expect(next.endDate).toBe("2027-03-05");
    expect(next.startDate).toBeNull();
  });

  it("never touches startDate, days, ids, placeIds, boundaries, legs, anchors, route or visit times", () => {
    const before = richDraft();
    const snapshot = JSON.parse(JSON.stringify(before));
    for (const value of ["2027-03-05", "2027-02-19", "2020-01-01", null, "2028-02-29", null]) {
      const after = withEndDate(before, value as string | null);
      expect(after.startDate).toBe(snapshot.startDate);
      expect(after.days).toEqual(snapshot.days);
      expect(after.days!.map((entity) => entity.id)).toEqual(snapshot.days.map((entity: PlanningDayV5) => entity.id));
      expect(after.routeIds).toEqual(snapshot.routeIds);
      expect(after.visitStartTimes).toEqual(snapshot.visitStartTimes);
      expect(after.accommodations).toEqual(snapshot.accommodations);
      expect(after.accommodationLegs).toEqual(snapshot.accommodationLegs);
      // …and the input itself was never mutated.
      expect(JSON.parse(JSON.stringify(before))).toEqual(snapshot);
    }
  });

  it("changes nothing but endDate — deep comparison of everything else, across a bounds matrix", () => {
    const before = richDraft();
    for (const value of ["2027-03-05", null, "2020-01-01", "2027-02-19"]) {
      const after = withEndDate(before, value as string | null);
      const { endDate: _a, ...afterRest } = after;
      const { endDate: _b, ...beforeRest } = before;
      expect(afterRest, String(value)).toEqual(beforeRest);
    }
  });

  it("is a no-op when the value is already the stored one", () => {
    const draft = draftV6({ endDate: "2027-03-05" });
    expect(withEndDate(draft, "2027-03-05")).toBe(draft);
    const cleared = draftV6({ endDate: null });
    expect(withEndDate(cleared, null)).toBe(cleared);
  });
});

// ---------------------------------------------------------------------------------------
// withStartDate under V6
// ---------------------------------------------------------------------------------------

describe("withStartDate — Phase 3C-E semantics preserved, endDate carried through", () => {
  it("sets the start date and keeps endDate untouched", () => {
    const next = withStartDate(draftV6({ endDate: "2027-03-05" }), "2027-02-19");
    expect(next.startDate).toBe("2027-02-19");
    expect(next.endDate).toBe("2027-03-05");
  });

  it("CLEARING the start date does not clear, shift or adjust endDate", () => {
    const next = withStartDate(draftV6({ startDate: "2027-02-19", endDate: "2027-03-05" }), null);
    expect(next.startDate).toBeNull();
    expect(next.endDate).toBe("2027-03-05");
  });

  it("moving the start date PAST the end date is allowed and shifts nothing", () => {
    const next = withStartDate(draftV6({ startDate: "2027-02-19", endDate: "2027-03-05" }), "2027-04-01");
    expect(next.startDate).toBe("2027-04-01");
    expect(next.endDate).toBe("2027-03-05");
    expect(assessTripBounds(next, 0).kind).toBe("bounds-unavailable");
  });

  it("rejects an invalid start date and returns the draft unchanged, endDate included", () => {
    const draft = draftV6({ startDate: "2027-02-19", endDate: "2027-03-05" });
    expect(withStartDate(draft, "2027-02-30")).toBe(draft);
  });

  it("never changes days, order, ids, placeIds or boundaries", () => {
    const before = richDraft();
    const snapshot = JSON.parse(JSON.stringify(before.days));
    for (const value of ["2027-01-01", null, "2030-12-31"]) {
      expect(withStartDate(before, value).days).toEqual(snapshot);
    }
  });
});

// ---------------------------------------------------------------------------------------
// Route / reset / reconcile independence
// ---------------------------------------------------------------------------------------

describe("route, reset and reconcile leave both bounds alone", () => {
  const bounded = { startDate: "2027-02-19", endDate: "2027-03-05" };

  it("withRoute with a PURE REORDER retains days and both bounds", () => {
    const before = draftV6({ ...bounded, routeIds: ["p1", "p2", "p3"], days: [day("d1", ["p1", "p2"]), day("d2", ["p3"])] });
    const after = withRoute(before, ["p1", "p2", "p3"]);
    expect(after.days).toEqual(before.days);
    expect(after.startDate).toBe("2027-02-19");
    expect(after.endDate).toBe("2027-03-05");
  });

  it("withRoute with a COMPOSITION CHANGE nulls days but both bounds survive", () => {
    const before = draftV6({ ...bounded });
    const after = withRoute(before, ["p1", "p2"]);
    expect(after.days).toBeNull();
    expect(after.startDate).toBe("2027-02-19");
    expect(after.endDate).toBe("2027-03-05");
  });

  it("resetRoute clears days, keeps anchors, and keeps BOTH bounds", () => {
    const before = richDraft({ ...bounded });
    const after = resetRoute(before, ["p1", "p2", "p3", "p4"]);
    expect(after.days).toBeNull();
    expect(after.accommodations).toEqual([hotelA, hotelB]);
    expect(after.startDate).toBe("2027-02-19");
    expect(after.endDate).toBe("2027-03-05");
  });

  it("reconcileDraft pruning a stale place leaves endDate untouched (partition survives)", () => {
    const before = draftV6({ ...bounded, routeIds: ["p1", "p2", "p3"], days: [day("d1", ["p1", "p2"]), day("d2", ["p3"])] });
    const after = reconcileDraft(before, ["p1", "p2"]);
    expect(after.routeIds).toEqual(["p1", "p2"]);
    expect(after.endDate).toBe("2027-03-05");
    expect(after.startDate).toBe("2027-02-19");
  });

  it("reconcileDraft leaves endDate untouched when EVERY place goes stale", () => {
    const before = draftV6({ ...bounded, routeIds: ["p1", "p2", "p3"], days: [day("d1", ["p1", "p2"]), day("d2", ["p3"])] });
    const after = reconcileDraft(before, []);
    // The historical V5 rule decides the days: pruning every place empties both buckets, and two
    // empty buckets over an empty route still partition it, so the entities survive with their ids.
    expect(after.routeIds).toEqual([]);
    expect(after.days!.map((entity) => entity.id)).toEqual(["d1", "d2"]);
    expect(after.days!.map((entity) => entity.placeIds)).toEqual([[], []]);
    // Whatever the days do, the trip's civil extent is not a property of which places are saved.
    expect(after.endDate).toBe("2027-03-05");
    expect(after.startDate).toBe("2027-02-19");
  });

  it("reconcileDraft leaves endDate untouched when a stale place is pruned from one day only", () => {
    const before = draftV6({
      ...bounded,
      routeIds: ["p1", "p2", "p3"],
      days: [day("d1", ["p1", "p2"]), day("d2", ["p3"])],
    });
    const after = reconcileDraft(before, ["p1", "p3"]);
    expect(after.routeIds).toEqual(["p1", "p3"]);
    expect(after.days!.map((entity) => entity.placeIds)).toEqual([["p1"], ["p3"]]);
    expect(after.endDate).toBe("2027-03-05");
  });

  it("keeps an INVERTED pair intact through route, reset and reconcile", () => {
    const inverted = { startDate: "2027-03-05", endDate: "2027-02-19" };
    expect(withRoute(draftV6(inverted), ["p1", "p2"]).endDate).toBe("2027-02-19");
    expect(resetRoute(draftV6(inverted), ["p1"]).endDate).toBe("2027-02-19");
    expect(reconcileDraft(draftV6(inverted), ["p1", "p2", "p3"]).endDate).toBe("2027-02-19");
  });
});

// ---------------------------------------------------------------------------------------
// Day mutations: empty days, deletion, reordering
// ---------------------------------------------------------------------------------------

describe("day mutations never change the bounds, and the bounds never change the days", () => {
  const bounded = { startDate: "2027-02-19", endDate: "2027-02-21" }; // 3 calendar days

  it("withNewEmptyDay does not extend the range, and the new day may land after the end", () => {
    const before = draftV6({ ...bounded, routeIds: ["p1"], days: [day("d1", ["p1"]), day("d2", []), day("d3", [])] });
    const after = withNewEmptyDay(before, sequentialIds());
    expect(after.days!.length).toBe(4);
    expect(after.startDate).toBe("2027-02-19");
    expect(after.endDate).toBe("2027-02-21");
    expect(assessTripBounds(after, 3).kind).toBe("after-trip-end");
  });

  it("withoutEmptyDay does not shorten the range", () => {
    const before = draftV6({ ...bounded, routeIds: ["p1"], days: [day("d1", ["p1"]), day("d2", [])] });
    const after = withoutEmptyDay(before, "d2");
    expect(after.days!.length).toBe(1);
    expect(after.endDate).toBe("2027-02-21");
  });

  it("an EMPTY day is assessed exactly like a non-empty one at the same ordinal", () => {
    const draft = draftV6({ ...bounded, routeIds: ["p1"], days: [day("d1", ["p1"]), day("d2", []), day("d3", []), day("d4", [])] });
    expect(assessTripBounds(draft, 2).kind).toBe("within-bounds"); // empty, ordinal 2 → in
    expect(assessTripBounds(draft, 3).kind).toBe("after-trip-end"); // empty, ordinal 3 → out
    // The verdict depends on the ordinal alone: the same ordinals for a non-empty layout agree.
    const nonEmpty = draftV6({ ...bounded, routeIds: ["p1", "p2", "p3", "p4"], days: [day("a", ["p1"]), day("b", ["p2"]), day("c", ["p3"]), day("d", ["p4"])] });
    expect(assessTripBounds(nonEmpty, 2).kind).toBe("within-bounds");
    expect(assessTripBounds(nonEmpty, 3).kind).toBe("after-trip-end");
  });

  it("withDayMoved does not change the bounds, and the SAME entity changes verdict by position", () => {
    const before = richDraft({ ...bounded });
    // "d4" sits at ordinal 3 — after the end of a 3-day range.
    expect(assessTripBounds(before, 3).kind).toBe("after-trip-end");
    const moved = withDayMoved(before, "d4", -1);
    expect(moved.endDate).toBe("2027-02-21");
    expect(moved.startDate).toBe("2027-02-19");
    // The very same entity is now at ordinal 2, and is within bounds there.
    expect(moved.days![2].id).toBe("d4");
    expect(assessTripBounds(moved, 2).kind).toBe("within-bounds");
    // …byte-for-byte the same day: id, places and boundary all travelled with it.
    const originalD4 = before.days!.find((entity) => entity.id === "d4")!;
    expect(moved.days![2]).toEqual(originalD4);
    // And the day it swapped with is now out of bounds, also unchanged in every persisted respect.
    expect(moved.days![3]).toEqual(before.days![2]);
  });

  it("moving a day back and forth restores the exact draft, bounds included", () => {
    const before = richDraft({ ...bounded });
    const roundTrip = withDayMoved(withDayMoved(before, "d4", -1), "d4", 1);
    expect(roundTrip).toEqual(before);
  });

  it("withPlaceMovedBetweenDays and withPlaceMovedWithinDay leave the bounds and the ordinals alone", () => {
    const before = richDraft({ ...bounded });
    const kindsBefore = [0, 1, 2, 3].map((ordinal) => assessTripBounds(before, ordinal).kind);

    const between = withPlaceMovedBetweenDays(before, "d2", "d3", 0);
    expect(between.endDate).toBe("2027-02-21");
    expect(between.days!.length).toBe(before.days!.length);
    expect([0, 1, 2, 3].map((ordinal) => assessTripBounds(between, ordinal).kind)).toEqual(kindsBefore);

    const within = withPlaceMovedWithinDay(before, "d2", 0, 1);
    expect(within.endDate).toBe("2027-02-21");
    expect([0, 1, 2, 3].map((ordinal) => assessTripBounds(within, ordinal).kind)).toEqual(kindsBefore);
  });

  it("withInitialDays creates the first assignment without touching either bound", () => {
    const before = draftV6({ ...bounded, days: null });
    const after = withInitialDays(before, [["p1"], ["p2"], ["p3"]], sequentialIds());
    expect(after.days!.length).toBe(3);
    expect(after.startDate).toBe("2027-02-19");
    expect(after.endDate).toBe("2027-02-21");
  });

  it("setting or clearing either bound never changes days.length, order, ids, placeIds or boundaries", () => {
    const base = richDraft();
    const daysSnapshot = JSON.parse(JSON.stringify(base.days));
    const boundsMatrix: [string | null, string | null][] = [
      ["2027-02-19", "2027-03-05"],
      ["2027-02-19", "2027-02-19"],
      ["2027-03-05", "2027-02-19"], // inverted
      [null, "2027-03-05"],
      ["2027-02-19", null],
      [null, null],
    ];
    for (const [startDate, endDate] of boundsMatrix) {
      const applied = withEndDate(withStartDate(base, startDate), endDate);
      const label = `${startDate} → ${endDate}`;
      expect(applied.days, label).toEqual(daysSnapshot);
      expect(applied.days!.map((entity) => entity.id), label).toEqual(["d1", "d2", "d3", "d4"]);
      expect(applied.routeIds, label).toEqual(base.routeIds);
      expect(applied.visitStartTimes, label).toEqual(base.visitStartTimes);
      expect(applied.accommodations, label).toEqual(base.accommodations);
      expect(applied.accommodationLegs, label).toEqual(base.accommodationLegs);
    }
  });
});

// ---------------------------------------------------------------------------------------
// Stable identity & accommodation invariants
// ---------------------------------------------------------------------------------------

describe("stable day identity and accommodation survive every bounds operation", () => {
  it("every day id is identical before and after a bounds change, a clear and an inversion", () => {
    const base = richDraft();
    const ids = base.days!.map((entity) => entity.id);
    for (const value of ["2027-03-05", null, "2020-01-01"]) {
      expect(withEndDate(base, value as string | null).days!.map((entity) => entity.id)).toEqual(ids);
      expect(withStartDate(base, value as string | null).days!.map((entity) => entity.id)).toEqual(ids);
    }
  });

  it("every accommodationBoundary is identical before and after", () => {
    const base = richDraft();
    const boundaries = base.days!.map((entity) => entity.accommodationBoundary);
    expect(withEndDate(base, "2020-01-01").days!.map((entity) => entity.accommodationBoundary)).toEqual(boundaries);
    expect(withEndDate(base, null).days!.map((entity) => entity.accommodationBoundary)).toEqual(boundaries);
  });

  it("no manual leg is created, removed, rebound or reordered by a bounds change", () => {
    const base = richDraft();
    for (const value of ["2027-03-05", null, "2020-01-01"]) {
      expect(withEndDate(base, value as string | null).accommodationLegs).toEqual([legAtoP1, legP2toA]);
    }
  });

  it("no anchor is added, removed or modified by a bounds change", () => {
    const base = richDraft();
    expect(withEndDate(base, "2020-01-01").accommodations).toEqual([hotelA, hotelB]);
    expect(withStartDate(base, null).accommodations).toEqual([hotelA, hotelB]);
  });

  it("a bounds change never selects a hotel for a day, and never converts unselected to no-accommodation", () => {
    const base = richDraft();
    const after = withEndDate(base, "2020-01-01"); // an end date long before every bucket
    expect(after.days![2].accommodationBoundary).toEqual(unselected);
    expect(after.days![3].accommodationBoundary).toEqual(unselected);
  });

  it("accommodation mutations still work normally on a draft with bounds set, leaving them alone", () => {
    const base = richDraft();
    const added = withNewAccommodation(base, "Hotel C", { lat: 35.0, lng: 135.0 }, sequentialIds("acc"));
    expect(added.accommodations.length).toBe(3);
    expect(added.endDate).toBe("2027-02-21");

    const chosen = withDayAccommodationChoice(base, "d3", "start", { kind: "accommodation", accommodationId: "hotel-b" });
    expect(chosen.days![2].accommodationBoundary.start).toEqual({ kind: "accommodation", accommodationId: "hotel-b" });
    expect(chosen.endDate).toBe("2027-02-21");

    const legged = withAccommodationLeg(base, "accommodation-to-place", "hotel-b", "p4", 25);
    expect(legged.accommodationLegs.length).toBe(3);
    expect(legged.endDate).toBe("2027-02-21");

    const removed = withoutAccommodation(base, "hotel-a");
    expect(removed.accommodations).toEqual([hotelB]);
    expect(removed.endDate).toBe("2027-02-21");

    const timed = withVisitStartTime(base, "p2", "10:15");
    expect(timed.visitStartTimes.p2).toBe("10:15");
    expect(timed.endDate).toBe("2027-02-21");
  });

  it("an out-of-bounds day's hotel choice is never cleared, rebound or reinterpreted", () => {
    const base = richDraft({
      days: [
        day("d1", ["p1"]),
        day("d2", ["p2", "p3"]),
        day("d3", ["p4"], boundary({ kind: "accommodation", accommodationId: "hotel-b" }, { kind: "no-accommodation" })),
      ],
      startDate: "2027-02-19",
      endDate: "2027-02-19", // one-day trip: d2 and d3 are both after the end
    });
    expect(assessTripBounds(base, 2).kind).toBe("after-trip-end");
    expect(base.days![2].accommodationBoundary.start).toEqual({ kind: "accommodation", accommodationId: "hotel-b" });
    const after = withEndDate(base, "2027-02-19");
    expect(after.days![2].accommodationBoundary).toEqual(base.days![2].accommodationBoundary);
  });
});

// ---------------------------------------------------------------------------------------
// Persistence / reload
// ---------------------------------------------------------------------------------------

describe("persistence round-trip under the SAME storage key", () => {
  it("uses nihon.manualPlanningDraft and nothing else", () => {
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
    expect(PLANNING_DRAFT_VERSION).toBe(6);
  });

  it("write → load preserves endDate exactly", () => {
    for (const endDate of ["2027-03-05", null, "2028-02-29"]) {
      const storage = memoryStorage();
      const draft = richDraft({ endDate: endDate as string | null });
      writeDraft(storage, draft);
      const loaded = loadReconciledDraft(storage, ["p1", "p2", "p3", "p4"]);
      expect(loaded.endDate, String(endDate)).toBe(endDate);
    }
  });

  it("write → load preserves an INVERTED pair exactly", () => {
    const storage = memoryStorage();
    writeDraft(storage, richDraft({ startDate: "2027-03-05", endDate: "2027-02-19" }));
    const loaded = loadReconciledDraft(storage, ["p1", "p2", "p3", "p4"]);
    expect(loaded.startDate).toBe("2027-03-05");
    expect(loaded.endDate).toBe("2027-02-19");
  });

  it("write → load preserves an END-ONLY draft exactly", () => {
    const storage = memoryStorage();
    writeDraft(storage, richDraft({ startDate: null, endDate: "2027-03-05" }));
    const loaded = loadReconciledDraft(storage, ["p1", "p2", "p3", "p4"]);
    expect(loaded.startDate).toBeNull();
    expect(loaded.endDate).toBe("2027-03-05");
  });

  it("reload preserves day order, ids, boundaries, legs and anchors alongside a set endDate", () => {
    const storage = memoryStorage();
    const draft = richDraft();
    writeDraft(storage, draft);
    const loaded = loadReconciledDraft(storage, ["p1", "p2", "p3", "p4"]);
    expect(loaded).toEqual(draft);
    expect(loaded.days!.map((entity) => entity.id)).toEqual(["d1", "d2", "d3", "d4"]);
    expect(loaded.days!.map((entity) => entity.accommodationBoundary)).toEqual(
      draft.days!.map((entity) => entity.accommodationBoundary)
    );
    expect(loaded.accommodationLegs).toEqual([legAtoP1, legP2toA]);
  });

  it("the serialized payload carries endDate and no second bounds field", () => {
    const storage = memoryStorage();
    writeDraft(storage, richDraft());
    const written = JSON.parse(storage.getItem(PLANNING_DRAFT_STORAGE_KEY)!);
    expect(Object.keys(written).sort()).toEqual([
      "accommodationLegs",
      "accommodations",
      "days",
      "endDate",
      "routeIds",
      "startDate",
      "version",
      "visitStartTimes",
    ]);
    // No persisted count, no persisted assessment, no per-day date or ordinal.
    expect(written).not.toHaveProperty("tripCalendarDays");
    expect(written).not.toHaveProperty("tripLengthDays");
    expect(written).not.toHaveProperty("boundsAssessment");
    for (const entity of written.days) {
      expect(Object.keys(entity).sort()).toEqual(["accommodationBoundary", "id", "placeIds"]);
    }
  });

  it("a corrupt stored endDate discards the whole draft and falls back to a fresh one", () => {
    const corrupt = { ...richDraft(), endDate: "2027-02-30" };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(corrupt) });
    const loaded = loadReconciledDraft(storage, ["p1", "p2"]);
    expect(loaded.days).toBeNull();
    expect(loaded.endDate).toBeNull();
    expect(loaded.routeIds).toEqual(["p1", "p2"]);
  });

  it("a stored V5 value loads as V6 with endDate: null, days and ids intact", () => {
    const storage = memoryStorage({
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(draftV5({ startDate: "2027-02-19" })),
    });
    const loaded = loadReconciledDraft(storage, ["p1", "p2", "p3"]);
    expect(loaded.version).toBe(6);
    expect(loaded.endDate).toBeNull();
    expect(loaded.startDate).toBe("2027-02-19");
    expect(loaded.days!.map((entity) => entity.id)).toEqual(["d1", "d2"]);
  });

  it("survives an unavailable localStorage on write without losing in-memory state", () => {
    const throwing: DraftStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    const draft = richDraft();
    expect(() => writeDraft(throwing, draft)).not.toThrow();
    expect(draft.endDate).toBe("2027-02-21");
  });
});

// ---------------------------------------------------------------------------------------
// Architectural invariants
// ---------------------------------------------------------------------------------------

describe("planning-draft-v6.ts — architectural invariants (source scan)", () => {
  async function readSource(): Promise<string> {
    return readFile(new URL("./planning-draft-v6.ts", import.meta.url), "utf8");
  }

  it("introduces no second storage key", async () => {
    const source = await readSource();
    const stringLiterals = [...source.matchAll(/"([^"]*nihon[^"]*)"/g)].map((match) => match[1]);
    expect(stringLiterals).toEqual([]);
    expect(source).toContain('PLANNING_DRAFT_STORAGE_KEY, type DraftStorage } from "./planning-draft"');
  });

  it("never derives an end date from days, a place, an anchor, a visit time or the clock", async () => {
    const source = await readSource();
    const start = source.indexOf("export function migrateV5ToV6");
    const body = source.slice(start, source.indexOf("export function parseStoredDraft"));
    for (const forbidden of ["days.length", "addCivilDays", "Date.now", "new Date("]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it("adds no persisted field beyond endDate to the draft type", async () => {
    const source = await readSource();
    const start = source.indexOf("export type ManualPlanningDraftV6 = {");
    const body = source.slice(start, source.indexOf("};", start));
    const fields = [...body.matchAll(/^\s{2}(\w+)[?]?:/gm)].map((match) => match[1]);
    expect(fields.sort()).toEqual([
      "accommodationLegs",
      "accommodations",
      "days",
      "endDate",
      "routeIds",
      "startDate",
      "version",
      "visitStartTimes",
    ]);
  });

  it("re-exports PlanningDayV5 unchanged rather than declaring a new day type", async () => {
    const source = await readSource();
    expect(source).not.toMatch(/export type PlanningDayV6/);
    expect(source).toContain("type PlanningDayV5,");
  });
});
