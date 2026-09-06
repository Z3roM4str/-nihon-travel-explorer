import { describe, expect, it } from "vitest";
import {
  freshDraft,
  loadReconciledDraft,
  migrateV1ToV2,
  parseStoredDraft,
  reconcileDraft,
  resetRoute,
  withDays,
  withRoute,
  withStartDate,
  writeDraft,
  PLANNING_DRAFT_STORAGE_KEY,
  type DraftStorage,
  type ManualPlanningDraftV1,
  type ManualPlanningDraftV2,
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
    expect(draft).toEqual({ version: 2, routeIds: ["A", "B", "C"], days: null, startDate: null });
  });
});

describe("loadReconciledDraft — restoring a valid stored draft", () => {
  it("restores the stored route order exactly", () => {
    const stored: ManualPlanningDraftV2 = { version: 2, routeIds: ["C", "A", "B"], days: null, startDate: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual(["C", "A", "B"]);
  });

  it("accepts a stored route that is a strict subset of the currently saved ids", () => {
    const stored: ManualPlanningDraftV2 = { version: 2, routeIds: ["B"], days: null, startDate: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual(["B"]);
  });

  it("never auto-adds a newly saved id that was not already part of the stored route", () => {
    const stored: ManualPlanningDraftV2 = { version: 2, routeIds: ["A", "B"], days: null, startDate: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    // "C" was saved to "Quiero ir" after the draft already existed.
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual(["A", "B"]);
    expect(draft.routeIds).not.toContain("C");
  });

  it("keeps an intentionally empty stored route empty — distinct from no draft at all", () => {
    const stored: ManualPlanningDraftV2 = { version: 2, routeIds: [], days: null, startDate: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    // Must stay [], NOT fall back to freshDraft's ["A","B","C"].
    expect(draft.routeIds).toEqual([]);
    expect(draft).not.toEqual(freshDraft(["A", "B", "C"]));
  });

  it("prunes a stale route id no longer present in saved ids", () => {
    const stored: ManualPlanningDraftV2 = { version: 2, routeIds: ["A", "X", "B"], days: null, startDate: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]); // "X" was unsaved
    expect(draft.routeIds).toEqual(["A", "B"]);
  });

  it("restores a stored startDate unchanged", () => {
    const stored: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B"],
      days: null,
      startDate: "2027-02-19",
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
    expect(draft).toEqual({ version: 2, routeIds: ["A", "B", "C"], days: [["A", "B"], ["C"]], startDate: null });
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
    const stored: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B", "C", "D"],
      days: [["A", "B"], ["C", "D"]],
      startDate: null,
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C", "D"]);
    expect(draft.days).toEqual([["A", "B"], ["C", "D"]]);
  });

  it("preserves an empty individual day through restoration", () => {
    const stored: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B"],
      days: [["A", "B"], []],
      startDate: null,
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]);
    expect(draft.days).toEqual([["A", "B"], []]);
  });

  it("prunes a stale id from day buckets consistently with the route", () => {
    const stored: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "X", "B"],
      days: [["A", "X"], ["B"]],
      startDate: null,
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]); // "X" unsaved
    expect(draft.routeIds).toEqual(["A", "B"]);
    expect(draft.days).toEqual([["A"], ["B"]]);
  });

  it("retains the partition when it is still exactly valid after stale pruning", () => {
    const result = reconcileDraft(
      { version: 2, routeIds: ["A", "X", "B"], days: [["A", "X"], ["B"]], startDate: null },
      ["A", "B"]
    );
    expect(result.days).not.toBeNull();
    expect(result.days).toEqual([["A"], ["B"]]);
  });

  it("nulls the day assignment when a route id is missing from every day", () => {
    const result = reconcileDraft(
      { version: 2, routeIds: ["A", "B", "C"], days: [["A", "B"]], startDate: null }, // C never assigned
      ["A", "B", "C"]
    );
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment when a day contains an id outside the route", () => {
    const result = reconcileDraft(
      { version: 2, routeIds: ["A", "B"], days: [["A", "B", "Z"]], startDate: null }, // Z is saved but never routed
      ["A", "B", "Z"]
    );
    expect(result.routeIds).toEqual(["A", "B"]);
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment on a duplicate within one day", () => {
    const result = reconcileDraft(
      { version: 2, routeIds: ["A", "B"], days: [["A", "A", "B"]], startDate: null },
      ["A", "B"]
    );
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment on a duplicate across two days", () => {
    const result = reconcileDraft(
      { version: 2, routeIds: ["A", "B", "C"], days: [["A", "B"], ["B", "C"]], startDate: null },
      ["A", "B", "C"]
    );
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment when zero day buckets are stored", () => {
    const result = reconcileDraft({ version: 2, routeIds: ["A", "B"], days: [], startDate: null }, ["A", "B"]);
    expect(result.days).toBeNull();
  });

  it("preserves startDate through day-reconciliation, even when the day assignment itself is nulled", () => {
    const result = reconcileDraft(
      { version: 2, routeIds: ["A", "B"], days: [], startDate: "2027-02-19" }, // zero buckets -> nulled
      ["A", "B"]
    );
    expect(result.days).toBeNull();
    expect(result.startDate).toBe("2027-02-19");
  });
});

describe("route edit semantics", () => {
  it("invalidates the canonical day assignment when route composition changes", () => {
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
      startDate: null,
    };
    const withNewPlace = withRoute(draft, ["A", "B", "C", "D"]); // composition changed
    expect(withNewPlace.days).toBeNull();

    const withRemovedPlace = withRoute(draft, ["A", "B"]);
    expect(withRemovedPlace.days).toBeNull();
  });

  it("retains the canonical day assignment when only the route order changes", () => {
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
      startDate: null,
    };
    const reordered = withRoute(draft, ["C", "A", "B"]); // same set, different order
    expect(reordered.routeIds).toEqual(["C", "A", "B"]);
    expect(reordered.days).toEqual([["A", "B"], ["C"]]);
  });

  it("a composition change to the route never touches a previously-set startDate", () => {
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
      startDate: "2027-02-19",
    };
    const withNewPlace = withRoute(draft, ["A", "B", "C", "D"]);
    expect(withNewPlace.days).toBeNull(); // days invalidated as before
    expect(withNewPlace.startDate).toBe("2027-02-19"); // date is untouched
  });

  it("a pure reorder never touches a previously-set startDate", () => {
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B", "C"],
      days: null,
      startDate: "2027-02-19",
    };
    const reordered = withRoute(draft, ["C", "A", "B"]);
    expect(reordered.startDate).toBe("2027-02-19");
  });
});

describe("day edit semantics", () => {
  it("accepts a new, structurally valid day assignment", () => {
    const draft: ManualPlanningDraftV2 = { version: 2, routeIds: ["A", "B", "C"], days: null, startDate: null };
    const updated = withDays(draft, [["A"], ["B", "C"]]);
    expect(updated.days).toEqual([["A"], ["B", "C"]]);
  });

  it("rejects an invalid new day assignment, leaving the prior canonical state untouched", () => {
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B", "C"],
      days: [["A"], ["B", "C"]],
      startDate: null,
    };
    const rejected = withDays(draft, [["A", "B"]]); // missing C — invalid partition
    expect(rejected).toEqual(draft); // unchanged, not silently nulled
  });

  it("adding/removing/moving between days (any valid re-partition) never touches startDate", () => {
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
      startDate: "2027-02-19",
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
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A"],
      days: [["A"]],
      startDate: null,
    };
    expect(resetRoute(draft, ["A", "B", "C"])).toEqual(freshDraft(["A", "B", "C"]));
  });

  it("carries a previously-set startDate forward through a route reset", () => {
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A"],
      days: [["A"]],
      startDate: "2027-02-19",
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
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["B", "A"],
      days: [["B"], ["A"], []],
      startDate: null,
    };
    writeDraft(storage, draft);
    const restored = loadReconciledDraft(storage, ["A", "B"]);
    expect(restored).toEqual(draft);
  });

  it("preserves a manual startDate exactly through a write then read", () => {
    const storage = memoryStorage();
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A", "B"],
      days: null,
      startDate: "2027-02-19",
    };
    writeDraft(storage, draft);
    const restored = loadReconciledDraft(storage, ["A", "B"]);
    expect(restored).toEqual(draft);
  });
});

describe("intentionally empty route (unaffected by Phase 3C-E)", () => {
  it("an intentional empty routeIds: [] with a startDate stays empty and keeps the date", () => {
    const stored: ManualPlanningDraftV2 = { version: 2, routeIds: [], days: null, startDate: "2027-02-19" };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual([]);
    expect(draft.startDate).toBe("2027-02-19");
  });
});

describe("empty day buckets remain allowed (unaffected by Phase 3C-E)", () => {
  it("an empty individual day bucket is still a valid partition with a startDate present", () => {
    const draft: ManualPlanningDraftV2 = {
      version: 2,
      routeIds: ["A"],
      days: null,
      startDate: "2027-02-19",
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
