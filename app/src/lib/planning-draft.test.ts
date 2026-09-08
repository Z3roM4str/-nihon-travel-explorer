import { describe, expect, it } from "vitest";
import {
  freshDraft,
  loadReconciledDraft,
  migrateV1ToV2,
  migrateV2ToV3,
  parseStoredDraft,
  reconcileDraft,
  resetRoute,
  withDays,
  withRoute,
  withStartDate,
  withVisitStartTime,
  writeDraft,
  PLANNING_DRAFT_STORAGE_KEY,
  type DraftStorage,
  type ManualPlanningDraftV1,
  type ManualPlanningDraftV3,
} from "./planning-draft";

/** An in-memory `DraftStorage` for tests — never touches real `localStorage`. */
function memoryStorage(initial: Record<string, string> = {}): DraftStorage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
}

function throwingStorage(on: "get" | "set"): DraftStorage {
  return {
    getItem: () => {
      if (on === "get") throw new Error("storage read blocked");
      return null;
    },
    setItem: () => {
      if (on === "set") throw new Error("storage write blocked");
    },
  };
}

describe("loadReconciledDraft — no stored draft", () => {
  it("initialises the route from current saved ids when nothing is stored", () => {
    const draft = loadReconciledDraft(memoryStorage(), ["A", "B", "C"]);
    expect(draft).toEqual({ version: 3, routeIds: ["A", "B", "C"], days: null, startDate: null, visitStartTimes: {} });
  });
});

describe("loadReconciledDraft — restoring a valid stored draft", () => {
  it("restores the stored route order exactly", () => {
    const stored: ManualPlanningDraftV3 = { version: 3, routeIds: ["C", "A", "B"], days: null, startDate: null, visitStartTimes: {} };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual(["C", "A", "B"]);
  });

  it("accepts a stored route that is a strict subset of the currently saved ids", () => {
    const stored: ManualPlanningDraftV3 = { version: 3, routeIds: ["B"], days: null, startDate: null, visitStartTimes: {} };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual(["B"]);
  });

  it("never auto-adds a newly saved id that was not already part of the stored route", () => {
    const stored: ManualPlanningDraftV3 = { version: 3, routeIds: ["A", "B"], days: null, startDate: null, visitStartTimes: {} };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    // "C" was saved to "Quiero ir" after the draft already existed.
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual(["A", "B"]);
    expect(draft.routeIds).not.toContain("C");
  });

  it("keeps an intentionally empty stored route empty — distinct from no draft at all", () => {
    const stored: ManualPlanningDraftV3 = { version: 3, routeIds: [], days: null, startDate: null, visitStartTimes: {} };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    // Must stay [], NOT fall back to freshDraft's ["A","B","C"].
    expect(draft.routeIds).toEqual([]);
    expect(draft).not.toEqual(freshDraft(["A", "B", "C"]));
  });

  it("prunes a stale route id no longer present in saved ids", () => {
    const stored: ManualPlanningDraftV3 = { version: 3, routeIds: ["A", "X", "B"], days: null, startDate: null, visitStartTimes: {} };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]); // "X" was unsaved
    expect(draft.routeIds).toEqual(["A", "B"]);
  });

  it("restores a stored startDate unchanged", () => {
    const stored: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B"],
      days: null,
      startDate: "2027-02-19",
      visitStartTimes: {},
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]);
    expect(draft.startDate).toBe("2027-02-19");
  });
});

describe("migration from Phase 3C-D's V1 shape", () => {
  it("migrateV1ToV2 carries routeIds/days through unchanged and never invents a startDate", () => {
    const v1: ManualPlanningDraftV1 = { version: 1, routeIds: ["A", "B"], days: [["A"], ["B"]] };
    const migrated = migrateV1ToV2(v1);
    expect(migrated).toEqual({ version: 2, routeIds: ["A", "B"], days: [["A"], ["B"]], startDate: null });
  });

  it("loads a genuine pre-Phase-3C-E V1 draft (no startDate field at all) and migrates it deterministically", () => {
    const v1Stored = { version: 1, routeIds: ["A", "B", "C"], days: [["A", "B"], ["C"]] };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(v1Stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft).toEqual({
      version: 3,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
      startDate: null,
      visitStartTimes: {},
    });
  });

  it("migrating and reconciling an unchanged dataset twice yields the same result (deterministic)", () => {
    const v1Stored = { version: 1, routeIds: ["A", "B"], days: null };
    const once = parseStoredDraft(v1Stored);
    const again = parseStoredDraft(v1Stored);
    expect(once).toEqual(again);
  });

  it("rejects a V1 draft whose routeIds/days are themselves malformed", () => {
    expect(parseStoredDraft({ version: 1, routeIds: ["A", "A"], days: null })).toBeNull();
  });
});

describe("parseStoredDraft — malformed/unsupported input safely rejected", () => {
  it("rejects a route with duplicate ids — it never survives as the canonical route", () => {
    const result = parseStoredDraft({ version: 2, routeIds: ["A", "A", "B"], days: null, startDate: null });
    expect(result).toBeNull();
  });

  it("falls back safely when the stored JSON is malformed", () => {
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: "{not valid json" });
    const draft = loadReconciledDraft(storage, ["A", "B"]);
    expect(draft).toEqual(freshDraft(["A", "B"]));
  });

  it("falls back safely when the stored value has the wrong shape", () => {
    for (const bad of [
      JSON.stringify(["A", "B"]), // an array, not an object
      JSON.stringify({ routeIds: ["A"] }), // missing version
      JSON.stringify({ version: 2 }), // missing routeIds
      JSON.stringify(null),
      JSON.stringify("A,B"),
    ]) {
      const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: bad });
      expect(loadReconciledDraft(storage, ["A", "B"])).toEqual(freshDraft(["A", "B"]));
    }
  });

  it("falls back safely for an unsupported version, inventing no migration", () => {
    const storage = memoryStorage({
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify({ version: 3, routeIds: ["A"], days: null, startDate: null }),
    });
    expect(loadReconciledDraft(storage, ["A", "B"])).toEqual(freshDraft(["A", "B"]));
  });

  it("rejects non-string route ids as an invalid structure", () => {
    const result = parseStoredDraft({ version: 2, routeIds: ["A", 2, "B"], days: null, startDate: null });
    expect(result).toBeNull();
  });
});

describe("day restoration", () => {
  it("restores a valid day assignment exactly", () => {
    const stored: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B", "C", "D"],
      days: [["A", "B"], ["C", "D"]],
      startDate: null,
      visitStartTimes: {},
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C", "D"]);
    expect(draft.days).toEqual([["A", "B"], ["C", "D"]]);
  });

  it("preserves an empty individual day through restoration", () => {
    const stored: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B"],
      days: [["A", "B"], []],
      startDate: null,
      visitStartTimes: {},
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]);
    expect(draft.days).toEqual([["A", "B"], []]);
  });

  it("prunes a stale id from day buckets consistently with the route", () => {
    const stored: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "X", "B"],
      days: [["A", "X"], ["B"]],
      startDate: null,
      visitStartTimes: {},
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]); // "X" unsaved
    expect(draft.routeIds).toEqual(["A", "B"]);
    expect(draft.days).toEqual([["A"], ["B"]]);
  });

  it("retains the partition when it is still exactly valid after stale pruning", () => {
    const result = reconcileDraft(
      { version: 3, routeIds: ["A", "X", "B"], days: [["A", "X"], ["B"]], startDate: null, visitStartTimes: {} },
      ["A", "B"]
    );
    expect(result.days).not.toBeNull();
    expect(result.days).toEqual([["A"], ["B"]]);
  });

  it("nulls the day assignment when a route id is missing from every day", () => {
    const result = reconcileDraft(
      { version: 3, routeIds: ["A", "B", "C"], days: [["A", "B"]], startDate: null, visitStartTimes: {} }, // C never assigned
      ["A", "B", "C"]
    );
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment when a day contains an id outside the route", () => {
    const result = reconcileDraft(
      { version: 3, routeIds: ["A", "B"], days: [["A", "B", "Z"]], startDate: null, visitStartTimes: {} }, // Z is saved but never routed
      ["A", "B", "Z"]
    );
    expect(result.routeIds).toEqual(["A", "B"]);
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment on a duplicate within one day", () => {
    const result = reconcileDraft(
      { version: 3, routeIds: ["A", "B"], days: [["A", "A", "B"]], startDate: null, visitStartTimes: {} },
      ["A", "B"]
    );
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment on a duplicate across two days", () => {
    const result = reconcileDraft(
      { version: 3, routeIds: ["A", "B", "C"], days: [["A", "B"], ["B", "C"]], startDate: null, visitStartTimes: {} },
      ["A", "B", "C"]
    );
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment when zero day buckets are stored", () => {
    const result = reconcileDraft({ version: 3, routeIds: ["A", "B"], days: [], startDate: null, visitStartTimes: {} }, ["A", "B"]);
    expect(result.days).toBeNull();
  });

  it("preserves startDate through day-reconciliation, even when the day assignment itself is nulled", () => {
    const result = reconcileDraft(
      { version: 3, routeIds: ["A", "B"], days: [], startDate: "2027-02-19", visitStartTimes: {} }, // zero buckets -> nulled
      ["A", "B"]
    );
    expect(result.days).toBeNull();
    expect(result.startDate).toBe("2027-02-19");
  });
});

describe("route edit semantics", () => {
  it("invalidates the canonical day assignment when route composition changes", () => {
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
      startDate: null,
      visitStartTimes: {},
    };
    const withNewPlace = withRoute(draft, ["A", "B", "C", "D"]); // composition changed
    expect(withNewPlace.days).toBeNull();

    const withRemovedPlace = withRoute(draft, ["A", "B"]);
    expect(withRemovedPlace.days).toBeNull();
  });

  it("retains the canonical day assignment when only the route order changes", () => {
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
      startDate: null,
      visitStartTimes: {},
    };
    const reordered = withRoute(draft, ["C", "A", "B"]); // same set, different order
    expect(reordered.routeIds).toEqual(["C", "A", "B"]);
    expect(reordered.days).toEqual([["A", "B"], ["C"]]);
  });

  it("a composition change to the route never touches a previously-set startDate", () => {
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
      startDate: "2027-02-19",
      visitStartTimes: {},
    };
    const withNewPlace = withRoute(draft, ["A", "B", "C", "D"]);
    expect(withNewPlace.days).toBeNull(); // days invalidated as before
    expect(withNewPlace.startDate).toBe("2027-02-19"); // date is untouched
  });

  it("a pure reorder never touches a previously-set startDate", () => {
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B", "C"],
      days: null,
      startDate: "2027-02-19",
      visitStartTimes: {},
    };
    const reordered = withRoute(draft, ["C", "A", "B"]);
    expect(reordered.startDate).toBe("2027-02-19");
  });
});

describe("day edit semantics", () => {
  it("accepts a new, structurally valid day assignment", () => {
    const draft: ManualPlanningDraftV3 = { version: 3, routeIds: ["A", "B", "C"], days: null, startDate: null, visitStartTimes: {} };
    const updated = withDays(draft, [["A"], ["B", "C"]]);
    expect(updated.days).toEqual([["A"], ["B", "C"]]);
  });

  it("rejects an invalid new day assignment, leaving the prior canonical state untouched", () => {
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B", "C"],
      days: [["A"], ["B", "C"]],
      startDate: null,
      visitStartTimes: {},
    };
    const rejected = withDays(draft, [["A", "B"]]); // missing C — invalid partition
    expect(rejected).toEqual(draft); // unchanged, not silently nulled
  });

  it("adding/removing/moving between days (any valid re-partition) never touches startDate", () => {
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
      startDate: "2027-02-19",
      visitStartTimes: {},
    };
    // Adding a day (an empty third bucket).
    const added = withDays(draft, [["A", "B"], ["C"], []]);
    expect(added.startDate).toBe("2027-02-19");
    // Removing a day (merging back to two buckets).
    const removed = withDays(added, [["A", "B"], ["C"]]);
    expect(removed.startDate).toBe("2027-02-19");
    // Moving a place between days.
    const moved = withDays(draft, [["A"], ["B", "C"]]);
    expect(moved.startDate).toBe("2027-02-19");
  });
});

describe("manual calendar anchoring (Phase 3C-E)", () => {
  it("a fresh draft has no calendar anchor", () => {
    expect(freshDraft(["A", "B"]).startDate).toBeNull();
  });

  it("assigns a manual start date", () => {
    const draft = freshDraft(["A", "B"]);
    const updated = withStartDate(draft, "2027-02-19");
    expect(updated.startDate).toBe("2027-02-19");
  });

  it("changes an already-assigned start date", () => {
    const draft = withStartDate(freshDraft(["A", "B"]), "2027-02-19");
    const changed = withStartDate(draft, "2027-03-01");
    expect(changed.startDate).toBe("2027-03-01");
  });

  it("removes an assigned start date", () => {
    const draft = withStartDate(freshDraft(["A", "B"]), "2027-02-19");
    const cleared = withStartDate(draft, null);
    expect(cleared.startDate).toBeNull();
  });

  it("rejects a start date with an invalid shape, leaving the draft unchanged", () => {
    const draft = withStartDate(freshDraft(["A", "B"]), "2027-02-19");
    for (const bad of ["2027/02/19", "19-02-2027", "not-a-date", "2027-02-19T00:00:00Z"]) {
      expect(withStartDate(draft, bad)).toEqual(draft);
    }
  });

  it("rejects an impossible calendar date, leaving the draft unchanged", () => {
    const draft = withStartDate(freshDraft(["A", "B"]), "2027-02-19");
    expect(withStartDate(draft, "2027-02-30")).toEqual(draft);
    expect(withStartDate(draft, "2027-13-01")).toEqual(draft);
  });

  it("accepts a leap-year February 29", () => {
    const updated = withStartDate(freshDraft(["A"]), "2028-02-29");
    expect(updated.startDate).toBe("2028-02-29");
  });

  it("rejects a non-leap-year February 29", () => {
    const draft = freshDraft(["A"]);
    expect(withStartDate(draft, "2027-02-29")).toEqual(draft);
  });

  it("a parsed/stored draft with an invalid startDate shape is rejected as a whole (falls back fresh)", () => {
    for (const badStartDate of [123, "2027-02-30", "not-a-date"]) {
      const storage = memoryStorage({
        [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify({
          version: 2,
          routeIds: ["A"],
          days: null,
          startDate: badStartDate,
        }),
      });
      expect(loadReconciledDraft(storage, ["A"])).toEqual(freshDraft(["A"]));
    }
  });
});

describe("resetRoute (Phase 3C-E: preserves the calendar anchor)", () => {
  it("resets routeIds/days to fresh, exactly like freshDraft, when no startDate is set", () => {
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A"],
      days: [["A"]],
      startDate: null,
      visitStartTimes: {},
    };
    expect(resetRoute(draft, ["A", "B", "C"])).toEqual(freshDraft(["A", "B", "C"]));
  });

  it("carries a previously-set startDate forward through a route reset", () => {
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A"],
      days: [["A"]],
      startDate: "2027-02-19",
      visitStartTimes: {},
    };
    const result = resetRoute(draft, ["A", "B", "C"]);
    expect(result.routeIds).toEqual(["A", "B", "C"]);
    expect(result.days).toBeNull();
    expect(result.startDate).toBe("2027-02-19"); // NOT cleared by a route reset
  });
});

describe("storage failure safety", () => {
  it("does not throw when reading storage raises an exception", () => {
    expect(() => loadReconciledDraft(throwingStorage("get"), ["A"])).not.toThrow();
    expect(loadReconciledDraft(throwingStorage("get"), ["A"])).toEqual(freshDraft(["A"]));
  });

  it("does not throw when writing storage raises an exception", () => {
    const draft = freshDraft(["A", "B"]);
    expect(() => writeDraft(throwingStorage("set"), draft)).not.toThrow();
  });
});

describe("serialize/read round-trip", () => {
  it("preserves the canonical state exactly through a write then read", () => {
    const storage = memoryStorage();
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["B", "A"],
      days: [["B"], ["A"], []],
      startDate: null,
      visitStartTimes: {},
    };
    writeDraft(storage, draft);
    const restored = loadReconciledDraft(storage, ["A", "B"]);
    expect(restored).toEqual(draft);
  });

  it("preserves a manual startDate exactly through a write then read", () => {
    const storage = memoryStorage();
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B"],
      days: null,
      startDate: "2027-02-19",
      visitStartTimes: {},
    };
    writeDraft(storage, draft);
    const restored = loadReconciledDraft(storage, ["A", "B"]);
    expect(restored).toEqual(draft);
  });
});

describe("intentionally empty route (unaffected by Phase 3C-E)", () => {
  it("an intentional empty routeIds: [] with a startDate stays empty and keeps the date", () => {
    const stored: ManualPlanningDraftV3 = { version: 3, routeIds: [], days: null, startDate: "2027-02-19", visitStartTimes: {} };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual([]);
    expect(draft.startDate).toBe("2027-02-19");
  });
});

describe("empty day buckets remain allowed (unaffected by Phase 3C-E)", () => {
  it("an empty individual day bucket is still a valid partition with a startDate present", () => {
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A"],
      days: null,
      startDate: "2027-02-19",
      visitStartTimes: {},
    };
    const updated = withDays(draft, [["A"], []]);
    expect(updated.days).toEqual([["A"], []]);
    expect(updated.startDate).toBe("2027-02-19");
  });
});

describe("separation from nihon.savedPlaceIds (unaffected by Phase 3C-E)", () => {
  it("planning-draft.ts never reads or writes any key other than nihon.manualPlanningDraft", () => {
    const store = new Map<string, string>();
    const storage: DraftStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    };
    writeDraft(storage, withStartDate(freshDraft(["A", "B"]), "2027-02-19"));
    expect([...store.keys()]).toEqual([PLANNING_DRAFT_STORAGE_KEY]);
  });
});

// ---------------------------------------------------------------------------------------------
// Phase 3D-L — ManualPlanningDraftV3: manual visit start times
// ---------------------------------------------------------------------------------------------

/** A stored V2 value (the exact shape Phase 3C-E shipped, with no `visitStartTimes` field at
 * all), for migration tests. Deliberately not typed as `ManualPlanningDraftV3` — the point is
 * that it is a historical shape. */
function storedV2(routeIds: string[], days: string[][] | null, startDate: string | null) {
  return { version: 2, routeIds, days, startDate };
}

describe("Phase 3D-L — migration to V3", () => {
  it("migrates a V2 draft, inventing no time", () => {
    const migrated = migrateV2ToV3({ version: 2, routeIds: ["A", "B"], days: [["A"], ["B"]], startDate: "2027-02-19" });
    expect(migrated).toEqual({
      version: 3,
      routeIds: ["A", "B"],
      days: [["A"], ["B"]],
      startDate: "2027-02-19",
      visitStartTimes: {},
    });
  });

  it("loads a genuine V2 draft from storage and migrates it deterministically", () => {
    const storage = memoryStorage({
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(storedV2(["A", "B"], [["A"], ["B"]], "2027-02-19")),
    });
    expect(loadReconciledDraft(storage, ["A", "B"])).toEqual({
      version: 3,
      routeIds: ["A", "B"],
      days: [["A"], ["B"]],
      startDate: "2027-02-19",
      visitStartTimes: {},
    });
  });

  it("chains V1 → V2 → V3 for a pre-calendar-anchoring draft", () => {
    const v1: ManualPlanningDraftV1 = { version: 1, routeIds: ["A", "B"], days: [["A", "B"]] };
    expect(migrateV2ToV3(migrateV1ToV2(v1))).toEqual({
      version: 3,
      routeIds: ["A", "B"],
      days: [["A", "B"]],
      startDate: null,
      visitStartTimes: {},
    });
    expect(parseStoredDraft({ version: 1, routeIds: ["A", "B"], days: [["A", "B"]] })).toEqual({
      version: 3,
      routeIds: ["A", "B"],
      days: [["A", "B"]],
      startDate: null,
      visitStartTimes: {},
    });
  });

  it("accepts a valid V3 draft unchanged", () => {
    expect(
      parseStoredDraft({
        version: 3,
        routeIds: ["A"],
        days: null,
        startDate: null,
        visitStartTimes: { A: "09:30" },
      })
    ).toEqual({ version: 3, routeIds: ["A"], days: null, startDate: null, visitStartTimes: { A: "09:30" } });
  });

  it("still treats an unsupported version exactly like a missing draft", () => {
    for (const version of [0, 4, 99, "3", null, undefined]) {
      expect(parseStoredDraft({ version, routeIds: ["A"], days: null, startDate: null, visitStartTimes: {} })).toBeNull();
    }
  });
});

describe("Phase 3D-L — V3 shape validation of visitStartTimes", () => {
  function draftWith(visitStartTimes: unknown) {
    return { version: 3, routeIds: ["A", "B"], days: null, startDate: null, visitStartTimes };
  }

  it("accepts an empty map", () => {
    expect(parseStoredDraft(draftWith({}))?.visitStartTimes).toEqual({});
  });

  it("accepts one and several valid times, including both range extremes", () => {
    expect(parseStoredDraft(draftWith({ A: "00:00" }))?.visitStartTimes).toEqual({ A: "00:00" });
    expect(parseStoredDraft(draftWith({ A: "09:00", B: "23:59" }))?.visitStartTimes).toEqual({
      A: "09:00",
      B: "23:59",
    });
  });

  it.each(["9:00", "24:00", "12:60", "09:0", "0900", "09:00:00", " 09:00", "09:00 ", ""])(
    "rejects the WHOLE draft for the malformed clock %p, never dropping just that entry",
    (time) => {
      expect(parseStoredDraft(draftWith({ A: time }))).toBeNull();
    }
  );

  it("rejects the whole draft when one of several entries is malformed", () => {
    expect(parseStoredDraft(draftWith({ A: "09:00", B: "24:00" }))).toBeNull();
  });

  it.each([
    ["a number", { A: 900 }],
    ["null", { A: null }],
    ["an array value", { A: ["09:00"] }],
    ["a nested object", { A: { time: "09:00" } }],
    ["a boolean", { A: true }],
  ])("rejects the whole draft for %s value", (_label, map) => {
    expect(parseStoredDraft(draftWith(map))).toBeNull();
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "09:00"],
    ["a number", 3],
    ["missing", undefined],
  ])("rejects the whole draft when visitStartTimes is %s", (_label, value) => {
    expect(parseStoredDraft(draftWith(value))).toBeNull();
  });

  it("falls back to a fresh draft when stored V3 data is malformed, exactly like every other corruption", () => {
    const storage = memoryStorage({
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(draftWith({ A: "24:00" })),
    });
    expect(loadReconciledDraft(storage, ["A", "B"])).toEqual({
      version: 3,
      routeIds: ["A", "B"],
      days: null,
      startDate: null,
      visitStartTimes: {},
    });
  });
});

describe("Phase 3D-L — reconciliation of visit start times", () => {
  it("prunes the time of a route id that is no longer saved", () => {
    const stored: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "X", "B"],
      days: null,
      startDate: null,
      visitStartTimes: { A: "09:00", X: "10:00", B: "11:00" },
    };
    expect(reconcileDraft(stored, ["A", "B"]).visitStartTimes).toEqual({ A: "09:00", B: "11:00" });
  });

  it("retains the time of a route id that is still saved", () => {
    const stored: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "B"],
      days: [["A"], ["B"]],
      startDate: "2027-02-19",
      visitStartTimes: { A: "09:00" },
    };
    expect(reconcileDraft(stored, ["A", "B"]).visitStartTimes).toEqual({ A: "09:00" });
  });

  it("never invents a time for a newly saved id that was never in the route", () => {
    const stored: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A"],
      days: null,
      startDate: null,
      visitStartTimes: { A: "09:00" },
    };
    expect(reconcileDraft(stored, ["A", "NEW"]).visitStartTimes).toEqual({ A: "09:00" });
  });

  it("prunes a time whose place id was never in the route at all (orphan storage)", () => {
    const stored: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A"],
      days: null,
      startDate: null,
      visitStartTimes: { A: "09:00", GHOST: "10:00" },
    };
    expect(reconcileDraft(stored, ["A"]).visitStartTimes).toEqual({ A: "09:00" });
  });

  it("prunes times consistently whether or not the day assignment survives", () => {
    const stored: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A", "X", "B"],
      days: [["A", "X", "B"], ["A"]], // duplicate across days -> nulled
      startDate: null,
      visitStartTimes: { A: "09:00", X: "10:00" },
    };
    const result = reconcileDraft(stored, ["A", "B"]);
    expect(result.days).toBeNull();
    expect(result.visitStartTimes).toEqual({ A: "09:00" });
  });
});

describe("Phase 3D-L — withVisitStartTime", () => {
  const base: ManualPlanningDraftV3 = {
    version: 3,
    routeIds: ["A", "B"],
    days: [["A"], ["B"]],
    startDate: "2027-02-19",
    visitStartTimes: {},
  };

  it("sets a time for a routed place", () => {
    expect(withVisitStartTime(base, "A", "09:30").visitStartTimes).toEqual({ A: "09:30" });
  });

  it("replaces an existing time", () => {
    const once = withVisitStartTime(base, "A", "09:30");
    expect(withVisitStartTime(once, "A", "14:00").visitStartTimes).toEqual({ A: "14:00" });
  });

  it("clears a time with null, removing the key rather than storing an empty string", () => {
    const once = withVisitStartTime(base, "A", "09:30");
    const cleared = withVisitStartTime(once, "A", null);
    expect(cleared.visitStartTimes).toEqual({});
    expect("A" in cleared.visitStartTimes).toBe(false);
  });

  it.each(["9:00", "24:00", "12:60", "0900", "", "09:00:00", "noon"])(
    "rejects the malformed time %p, leaving the draft unchanged",
    (time) => {
      const once = withVisitStartTime(base, "A", "09:30");
      expect(withVisitStartTime(once, "A", time)).toBe(once);
    }
  );

  it("rejects a place id outside the route, never creating orphan state", () => {
    expect(withVisitStartTime(base, "GHOST", "09:30")).toBe(base);
    expect(withVisitStartTime(base, "GHOST", null)).toBe(base);
  });

  it("touches nothing but the times", () => {
    const updated = withVisitStartTime(base, "A", "09:30");
    expect(updated.routeIds).toEqual(base.routeIds);
    expect(updated.days).toEqual(base.days);
    expect(updated.startDate).toBe(base.startDate);
  });

  it("does not mutate the draft it was given", () => {
    withVisitStartTime(base, "A", "09:30");
    expect(base.visitStartTimes).toEqual({});
  });
});

describe("Phase 3D-L — times across route, day and date edits", () => {
  const timed: ManualPlanningDraftV3 = {
    version: 3,
    routeIds: ["A", "B", "C"],
    days: [["A", "B"], ["C"]],
    startDate: "2027-02-19",
    visitStartTimes: { A: "09:00", C: "14:00" },
  };

  it("retains every time through a pure route reorder", () => {
    expect(withRoute(timed, ["C", "A", "B"]).visitStartTimes).toEqual({ A: "09:00", C: "14:00" });
  });

  it("prunes the time of a place removed from the route", () => {
    expect(withRoute(timed, ["A", "B"]).visitStartTimes).toEqual({ A: "09:00" });
  });

  it("never invents a time for a place added to the route", () => {
    expect(withRoute(timed, ["A", "B", "C", "D"]).visitStartTimes).toEqual({ A: "09:00", C: "14:00" });
  });

  it("retains every time through a day re-split", () => {
    expect(withDays(timed, [["A"], ["B", "C"]]).visitStartTimes).toEqual({ A: "09:00", C: "14:00" });
  });

  it("retains every time when a place moves between day buckets", () => {
    expect(withDays(timed, [["A", "B", "C"], []]).visitStartTimes).toEqual({ A: "09:00", C: "14:00" });
  });

  it("never rewrites a time when the trip start date changes or is cleared", () => {
    expect(withStartDate(timed, "2027-03-01").visitStartTimes).toEqual({ A: "09:00", C: "14:00" });
    expect(withStartDate(timed, null).visitStartTimes).toEqual({ A: "09:00", C: "14:00" });
  });

  it("carries still-saved times through a route reset, and prunes the rest", () => {
    const reset = resetRoute(timed, ["A", "B"]);
    expect(reset.visitStartTimes).toEqual({ A: "09:00" });
    expect(reset.startDate).toBe("2027-02-19");
    expect(reset.days).toBeNull();
  });

  it("survives a write/read round-trip exactly", () => {
    const storage = memoryStorage();
    writeDraft(storage, timed);
    expect(loadReconciledDraft(storage, ["A", "B", "C"])).toEqual(timed);
  });
});

describe("Phase 3D-L — nothing derived is ever persisted", () => {
  it("serialises only the four user-decision fields", () => {
    const storage = memoryStorage();
    const draft: ManualPlanningDraftV3 = {
      version: 3,
      routeIds: ["A"],
      days: [["A"]],
      startDate: "2027-02-19",
      visitStartTimes: { A: "09:00" },
    };
    writeDraft(storage, draft);
    const written = JSON.parse(storage.getItem(PLANNING_DRAFT_STORAGE_KEY)!);
    expect(Object.keys(written).sort()).toEqual(["days", "routeIds", "startDate", "version", "visitStartTimes"]);
  });

  it("stores the typed clock text, never parsed minutes or a comparison result", () => {
    const storage = memoryStorage();
    writeDraft(storage, {
      version: 3,
      routeIds: ["A"],
      days: null,
      startDate: null,
      visitStartTimes: { A: "09:00" },
    });
    const raw = storage.getItem(PLANNING_DRAFT_STORAGE_KEY)!;
    expect(raw).toContain('"09:00"');
    for (const derived of ["540", "remainingMinutes", "fits", "intervalStartMinutes", "duration"]) {
      expect(raw).not.toContain(derived);
    }
  });
});

describe("Phase 3D-L — invariants an independent review probed for", () => {
  const timed: ManualPlanningDraftV3 = {
    version: 3,
    routeIds: ["A", "B"],
    days: null,
    startDate: null,
    visitStartTimes: { A: "09:00" },
  };

  it("never resurrects a pruned time when the place returns to the route", () => {
    const removed = withRoute(timed, ["B"]);
    expect(removed.visitStartTimes).toEqual({});
    expect(withRoute(removed, ["B", "A"]).visitStartTimes).toEqual({});
  });

  it("never resurrects a time that reconciliation already dropped", () => {
    const dropped = reconcileDraft(timed, ["B"]);
    expect(dropped.visitStartTimes).toEqual({});
    expect(reconcileDraft(dropped, ["A", "B"]).visitStartTimes).toEqual({});
  });

  it("keeps a routed place's time while no day split exists yet", () => {
    // `days === null` means the user has not split into days; the time is still their decision and
    // must not be discarded just because it currently has no day card to render on.
    expect(reconcileDraft(timed, ["A", "B"]).visitStartTimes).toEqual({ A: "09:00" });
  });

  it("mutates no input draft in any helper", () => {
    const snapshot = JSON.stringify(timed);
    withVisitStartTime(timed, "A", "10:00");
    withVisitStartTime(timed, "A", null);
    withRoute(timed, ["B"]);
    withDays(timed, [["A", "B"]]);
    withStartDate(timed, "2027-02-19");
    reconcileDraft(timed, ["B"]);
    resetRoute(timed, ["A"]);
    expect(JSON.stringify(timed)).toBe(snapshot);
  });

  it("handles a prototype-shaped key in stored JSON without polluting Object.prototype", () => {
    const raw = JSON.parse(
      '{"version":3,"routeIds":["A"],"days":null,"startDate":null,"visitStartTimes":{"__proto__":"09:00"}}'
    );
    const parsed = parseStoredDraft(raw);
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "A")).toBe(false);
    expect(({} as Record<string, unknown>).A).toBeUndefined();
    if (parsed) expect(Object.keys(parsed.visitStartTimes)).not.toContain("A");
  });

  it("treats an ordinary object-shaped key as an ordinary place id", () => {
    const parsed = parseStoredDraft({
      version: 3,
      routeIds: ["constructor"],
      days: null,
      startDate: null,
      visitStartTimes: { constructor: "09:00" },
    });
    expect(parsed?.visitStartTimes.constructor).toBe("09:00");
    expect(reconcileDraft(parsed!, ["constructor"]).visitStartTimes).toEqual({ constructor: "09:00" });
  });
});
