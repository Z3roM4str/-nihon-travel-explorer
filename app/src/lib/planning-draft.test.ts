import { describe, expect, it } from "vitest";
import {
  freshDraft,
  loadReconciledDraft,
  parseStoredDraft,
  reconcileDraft,
  withDays,
  withRoute,
  writeDraft,
  PLANNING_DRAFT_STORAGE_KEY,
  type DraftStorage,
  type ManualPlanningDraftV1,
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
    expect(draft).toEqual({ version: 1, routeIds: ["A", "B", "C"], days: null });
  });
});

describe("loadReconciledDraft — restoring a valid stored draft", () => {
  it("restores the stored route order exactly", () => {
    const stored: ManualPlanningDraftV1 = { version: 1, routeIds: ["C", "A", "B"], days: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual(["C", "A", "B"]);
  });

  it("accepts a stored route that is a strict subset of the currently saved ids", () => {
    const stored: ManualPlanningDraftV1 = { version: 1, routeIds: ["B"], days: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual(["B"]);
  });

  it("never auto-adds a newly saved id that was not already part of the stored route", () => {
    const stored: ManualPlanningDraftV1 = { version: 1, routeIds: ["A", "B"], days: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    // "C" was saved to "Quiero ir" after the draft already existed.
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    expect(draft.routeIds).toEqual(["A", "B"]);
    expect(draft.routeIds).not.toContain("C");
  });

  it("keeps an intentionally empty stored route empty — distinct from no draft at all", () => {
    const stored: ManualPlanningDraftV1 = { version: 1, routeIds: [], days: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C"]);
    // Must stay [], NOT fall back to freshDraft's ["A","B","C"].
    expect(draft.routeIds).toEqual([]);
    expect(draft).not.toEqual(freshDraft(["A", "B", "C"]));
  });

  it("prunes a stale route id no longer present in saved ids", () => {
    const stored: ManualPlanningDraftV1 = { version: 1, routeIds: ["A", "X", "B"], days: null };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]); // "X" was unsaved
    expect(draft.routeIds).toEqual(["A", "B"]);
  });
});

describe("parseStoredDraft — malformed/unsupported input safely rejected", () => {
  it("rejects a route with duplicate ids — it never survives as the canonical route", () => {
    const result = parseStoredDraft({ version: 1, routeIds: ["A", "A", "B"], days: null });
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
      JSON.stringify({ version: 1 }), // missing routeIds
      JSON.stringify(null),
      JSON.stringify("A,B"),
    ]) {
      const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: bad });
      expect(loadReconciledDraft(storage, ["A", "B"])).toEqual(freshDraft(["A", "B"]));
    }
  });

  it("falls back safely for an unsupported version, inventing no migration", () => {
    const storage = memoryStorage({
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify({ version: 2, routeIds: ["A"], days: null }),
    });
    expect(loadReconciledDraft(storage, ["A", "B"])).toEqual(freshDraft(["A", "B"]));
  });

  it("rejects non-string route ids as an invalid structure", () => {
    const result = parseStoredDraft({ version: 1, routeIds: ["A", 2, "B"], days: null });
    expect(result).toBeNull();
  });
});

describe("day restoration", () => {
  it("restores a valid day assignment exactly", () => {
    const stored: ManualPlanningDraftV1 = {
      version: 1,
      routeIds: ["A", "B", "C", "D"],
      days: [["A", "B"], ["C", "D"]],
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B", "C", "D"]);
    expect(draft.days).toEqual([["A", "B"], ["C", "D"]]);
  });

  it("preserves an empty individual day through restoration", () => {
    const stored: ManualPlanningDraftV1 = {
      version: 1,
      routeIds: ["A", "B"],
      days: [["A", "B"], []],
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]);
    expect(draft.days).toEqual([["A", "B"], []]);
  });

  it("prunes a stale id from day buckets consistently with the route", () => {
    const stored: ManualPlanningDraftV1 = {
      version: 1,
      routeIds: ["A", "X", "B"],
      days: [["A", "X"], ["B"]],
    };
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(stored) });
    const draft = loadReconciledDraft(storage, ["A", "B"]); // "X" unsaved
    expect(draft.routeIds).toEqual(["A", "B"]);
    expect(draft.days).toEqual([["A"], ["B"]]);
  });

  it("retains the partition when it is still exactly valid after stale pruning", () => {
    const result = reconcileDraft(
      { version: 1, routeIds: ["A", "X", "B"], days: [["A", "X"], ["B"]] },
      ["A", "B"]
    );
    expect(result.days).not.toBeNull();
    expect(result.days).toEqual([["A"], ["B"]]);
  });

  it("nulls the day assignment when a route id is missing from every day", () => {
    const result = reconcileDraft(
      { version: 1, routeIds: ["A", "B", "C"], days: [["A", "B"]] }, // C never assigned
      ["A", "B", "C"]
    );
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment when a day contains an id outside the route", () => {
    const result = reconcileDraft(
      { version: 1, routeIds: ["A", "B"], days: [["A", "B", "Z"]] }, // Z is saved but never routed
      ["A", "B", "Z"]
    );
    expect(result.routeIds).toEqual(["A", "B"]);
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment on a duplicate within one day", () => {
    const result = reconcileDraft(
      { version: 1, routeIds: ["A", "B"], days: [["A", "A", "B"]] },
      ["A", "B"]
    );
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment on a duplicate across two days", () => {
    const result = reconcileDraft(
      { version: 1, routeIds: ["A", "B", "C"], days: [["A", "B"], ["B", "C"]] },
      ["A", "B", "C"]
    );
    expect(result.days).toBeNull();
  });

  it("nulls the day assignment when zero day buckets are stored", () => {
    const result = reconcileDraft({ version: 1, routeIds: ["A", "B"], days: [] }, ["A", "B"]);
    expect(result.days).toBeNull();
  });
});

describe("route edit semantics", () => {
  it("invalidates the canonical day assignment when route composition changes", () => {
    const draft: ManualPlanningDraftV1 = {
      version: 1,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
    };
    const withNewPlace = withRoute(draft, ["A", "B", "C", "D"]); // composition changed
    expect(withNewPlace.days).toBeNull();

    const withRemovedPlace = withRoute(draft, ["A", "B"]);
    expect(withRemovedPlace.days).toBeNull();
  });

  it("retains the canonical day assignment when only the route order changes", () => {
    const draft: ManualPlanningDraftV1 = {
      version: 1,
      routeIds: ["A", "B", "C"],
      days: [["A", "B"], ["C"]],
    };
    const reordered = withRoute(draft, ["C", "A", "B"]); // same set, different order
    expect(reordered.routeIds).toEqual(["C", "A", "B"]);
    expect(reordered.days).toEqual([["A", "B"], ["C"]]);
  });
});

describe("day edit semantics", () => {
  it("accepts a new, structurally valid day assignment", () => {
    const draft: ManualPlanningDraftV1 = { version: 1, routeIds: ["A", "B", "C"], days: null };
    const updated = withDays(draft, [["A"], ["B", "C"]]);
    expect(updated.days).toEqual([["A"], ["B", "C"]]);
  });

  it("rejects an invalid new day assignment, leaving the prior canonical state untouched", () => {
    const draft: ManualPlanningDraftV1 = {
      version: 1,
      routeIds: ["A", "B", "C"],
      days: [["A"], ["B", "C"]],
    };
    const rejected = withDays(draft, [["A", "B"]]); // missing C — invalid partition
    expect(rejected).toEqual(draft); // unchanged, not silently nulled
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
    const draft: ManualPlanningDraftV1 = {
      version: 1,
      routeIds: ["B", "A"],
      days: [["B"], ["A"], []],
    };
    writeDraft(storage, draft);
    const restored = loadReconciledDraft(storage, ["A", "B"]);
    expect(restored).toEqual(draft);
  });
});
