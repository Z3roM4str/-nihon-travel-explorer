import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { UNSELECTED_ACCOMMODATION_BOUNDARY } from "./accommodation-commute";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  PLANNING_DRAFT_VERSION,
  freshDraft,
  isAccommodationAnchorInUse,
  loadReconciledDraft,
  migrateV7ToV8,
  parseStoredDraft,
  reconcileDraft,
  resetRoute,
  withAccommodationLeg,
  withDayAccommodationChoice,
  withDayMoved,
  withInitialDays,
  withNewAccommodation,
  withNewEmptyDay,
  withPlaceMovedWithinDay,
  withRoute,
  withStartDate,
  withZoneAccommodationChoice,
  withoutAccommodation,
  withoutZoneAccommodationChoice,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV8,
} from "./planning-draft-v8";
import type { ManualPlanningDraftV7 } from "./planning-draft-v7";

function memoryStorage(initial: string | null = null): DraftStorage & { value: string | null } {
  return {
    value: initial,
    getItem() {
      return this.value;
    },
    setItem(_key: string, value: string) {
      this.value = value;
    },
  };
}

function boundary() {
  return {
    start: { ...UNSELECTED_ACCOMMODATION_BOUNDARY.start },
    end: { ...UNSELECTED_ACCOMMODATION_BOUNDARY.end },
  };
}

/** A deterministic id factory, so every assertion below names the anchor it means. */
function ids(...values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? `overflow-${index}`;
}

const SHINJUKU = {
  hub: "Tokio",
  zoneId: "tokio-shinjuku",
  label: "Estación de Shinjuku",
  location: { lat: 35.6896, lng: 139.7006 },
};
const ASAKUSA = {
  hub: "Tokio",
  zoneId: "tokio-asakusa",
  label: "Estación de Asakusa",
  location: { lat: 35.7111, lng: 139.7967 },
};
const GION = {
  hub: "Kioto",
  zoneId: "kioto-gion",
  label: "Gion-Shijō",
  location: { lat: 35.0037, lng: 135.7726 },
};

/** A draft with two days, so boundary choices and manual legs have somewhere to live. */
function plannedDraft(): ManualPlanningDraftV8 {
  const base = freshDraft(["tokyo-a", "tokyo-b", "kyoto-a"]);
  return withInitialDays(base, [["tokyo-a", "tokyo-b"], ["kyoto-a"]], ids("day-1", "day-2"));
}

describe("V8 is V7 plus exactly one field", () => {
  it("declares version 8", () => {
    expect(PLANNING_DRAFT_VERSION).toBe(8);
    expect(freshDraft([]).version).toBe(8);
  });

  it("adds `zoneAccommodationChoices` and nothing else", () => {
    const v7: ManualPlanningDraftV7 = {
      version: 7,
      routeIds: ["a"],
      days: null,
      startDate: "2026-04-01",
      endDate: null,
      visitStartTimes: { a: "09:00" },
      accommodations: [],
      accommodationLegs: [],
      interHubSegments: [],
    };
    const v8 = migrateV7ToV8(v7);
    expect(Object.keys(v8).sort()).toEqual([
      ...Object.keys(v7).sort(),
      "zoneAccommodationChoices",
    ].sort());
    expect(v8.zoneAccommodationChoices).toEqual([]);
  });

  it("migrates a V7 payload without inventing a zone decision for an existing anchor", () => {
    const v7 = withNewAccommodation(freshDraft([]), "Hotel a mano", { lat: 35.6, lng: 139.7 }, ids("acc-manual"));
    const migrated = migrateV7ToV8({ ...v7, version: 7 } as unknown as ManualPlanningDraftV7);
    expect(migrated.accommodations).toHaveLength(1);
    expect(migrated.zoneAccommodationChoices).toEqual([]);
  });

  it("uses the same single storage key — there is no side-car zone store", async () => {
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
    const source = await readFile(new URL("./planning-draft-v8.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/localStorage/);
    expect(source.match(/STORAGE_KEY/g)?.length).toBeGreaterThan(0);
  });
});

describe("choosing a zone seeds exactly one ordinary anchor", () => {
  it("creates the anchor from the zone's own label and coordinate", () => {
    const draft = withZoneAccommodationChoice(freshDraft([]), SHINJUKU, ids("acc-z1"));
    expect(draft.accommodations).toEqual([
      { id: "acc-z1", label: "Estación de Shinjuku", location: { lat: 35.6896, lng: 139.7006 } },
    ]);
    expect(draft.zoneAccommodationChoices).toEqual([
      { hub: "Tokio", zoneId: "tokio-shinjuku", accommodationId: "acc-z1" },
    ]);
  });

  it("creates no boundary, no leg and no duration alongside it", () => {
    const draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1"));
    expect(draft.accommodationLegs).toEqual([]);
    for (const day of draft.days ?? []) {
      expect(day.accommodationBoundary).toEqual(boundary());
    }
  });

  it("keeps one choice per hub and allows a different hub its own", () => {
    let draft = withZoneAccommodationChoice(freshDraft([]), SHINJUKU, ids("acc-z1"));
    draft = withZoneAccommodationChoice(draft, GION, ids("acc-z2"));
    expect(draft.zoneAccommodationChoices.map((choice) => choice.hub)).toEqual(["Tokio", "Kioto"]);
    expect(draft.accommodations).toHaveLength(2);
  });

  it("is idempotent — re-choosing the same zone mints no second anchor", () => {
    const first = withZoneAccommodationChoice(freshDraft([]), SHINJUKU, ids("acc-z1"));
    const again = withZoneAccommodationChoice(first, SHINJUKU, ids("acc-z2"));
    expect(again).toBe(first);
  });

  it.each([
    ["a blank hub", { ...SHINJUKU, hub: "  " }],
    ["a blank zone id", { ...SHINJUKU, zoneId: "" }],
    ["a blank label", { ...SHINJUKU, label: "   " }],
    ["a latitude out of range", { ...SHINJUKU, location: { lat: 91, lng: 139 } }],
    ["a longitude out of range", { ...SHINJUKU, location: { lat: 35, lng: 181 } }],
    ["a non-finite coordinate", { ...SHINJUKU, location: { lat: Number.NaN, lng: 139 } }],
  ])("rejects %s outright, leaving the draft untouched", (_label, input) => {
    const base = freshDraft([]);
    expect(withZoneAccommodationChoice(base, input, ids("acc-z1"))).toBe(base);
  });

  it("fails atomically when no unique anchor id can be minted", () => {
    const base = withZoneAccommodationChoice(freshDraft([]), GION, ids("acc-taken"));
    const blocked = withZoneAccommodationChoice(base, SHINJUKU, () => "acc-taken");
    expect(blocked).toBe(base);
    expect(blocked.zoneAccommodationChoices).toHaveLength(1);
  });
});

describe("changing the zone for a hub", () => {
  it("replaces the choice and cleans up an untouched seeded anchor", () => {
    let draft = withZoneAccommodationChoice(freshDraft([]), SHINJUKU, ids("acc-z1"));
    draft = withZoneAccommodationChoice(draft, ASAKUSA, ids("acc-z2"));

    expect(draft.zoneAccommodationChoices).toEqual([
      { hub: "Tokio", zoneId: "tokio-asakusa", accommodationId: "acc-z2" },
    ]);
    expect(draft.accommodations.map((anchor) => anchor.id)).toEqual(["acc-z2"]);
  });

  it("KEEPS the previous anchor when a day boundary still selects it", () => {
    let draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1"));
    draft = withDayAccommodationChoice(draft, "day-1", "start", {
      kind: "accommodation",
      accommodationId: "acc-z1",
    });
    draft = withZoneAccommodationChoice(draft, ASAKUSA, ids("acc-z2"));

    expect(draft.accommodations.map((anchor) => anchor.id)).toEqual(["acc-z1", "acc-z2"]);
    expect(draft.days?.[0].accommodationBoundary.start).toEqual({
      kind: "accommodation",
      accommodationId: "acc-z1",
    });
    expect(draft.zoneAccommodationChoices).toEqual([
      { hub: "Tokio", zoneId: "tokio-asakusa", accommodationId: "acc-z2" },
    ]);
  });

  it("KEEPS the previous anchor when a manual duration was typed for it", () => {
    let draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1"));
    draft = withAccommodationLeg(draft, "accommodation-to-place", "acc-z1", "tokyo-a", 25);
    draft = withZoneAccommodationChoice(draft, ASAKUSA, ids("acc-z2"));

    expect(draft.accommodations.map((anchor) => anchor.id)).toEqual(["acc-z1", "acc-z2"]);
    expect(draft.accommodationLegs).toEqual([
      {
        direction: "accommodation-to-place",
        accommodationId: "acc-z1",
        placeId: "tokyo-a",
        minutes: 25,
        source: { kind: "user-entered" },
      },
    ]);
  });

  it("never re-points the old anchor at the new zone's coordinate", () => {
    let draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1"));
    draft = withAccommodationLeg(draft, "accommodation-to-place", "acc-z1", "tokyo-a", 25);
    draft = withZoneAccommodationChoice(draft, ASAKUSA, ids("acc-z2"));

    const kept = draft.accommodations.find((anchor) => anchor.id === "acc-z1");
    expect(kept?.label).toBe("Estación de Shinjuku");
    expect(kept?.location).toEqual(SHINJUKU.location);
  });

  it("leaves another hub's choice completely alone", () => {
    let draft = withZoneAccommodationChoice(freshDraft([]), GION, ids("acc-kyoto"));
    draft = withZoneAccommodationChoice(draft, SHINJUKU, ids("acc-z1"));
    draft = withZoneAccommodationChoice(draft, ASAKUSA, ids("acc-z2"));

    expect(draft.zoneAccommodationChoices).toContainEqual({
      hub: "Kioto",
      zoneId: "kioto-gion",
      accommodationId: "acc-kyoto",
    });
    expect(draft.accommodations.map((anchor) => anchor.id)).toEqual(["acc-kyoto", "acc-z2"]);
  });
});

describe("removing the zone choice", () => {
  it("removes an untouched seeded anchor with it", () => {
    const draft = withoutZoneAccommodationChoice(
      withZoneAccommodationChoice(freshDraft([]), SHINJUKU, ids("acc-z1")),
      "Tokio"
    );
    expect(draft.zoneAccommodationChoices).toEqual([]);
    expect(draft.accommodations).toEqual([]);
  });

  it("keeps an anchor that carries user work, and keeps that work intact", () => {
    let draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1"));
    draft = withDayAccommodationChoice(draft, "day-1", "end", {
      kind: "accommodation",
      accommodationId: "acc-z1",
    });
    draft = withAccommodationLeg(draft, "place-to-accommodation", "acc-z1", "tokyo-b", 30);
    draft = withoutZoneAccommodationChoice(draft, "Tokio");

    expect(draft.zoneAccommodationChoices).toEqual([]);
    expect(draft.accommodations.map((anchor) => anchor.id)).toEqual(["acc-z1"]);
    expect(draft.days?.[0].accommodationBoundary.end).toEqual({
      kind: "accommodation",
      accommodationId: "acc-z1",
    });
    expect(draft.accommodationLegs).toHaveLength(1);
  });

  it("is a no-op for a hub with no choice", () => {
    const base = withZoneAccommodationChoice(freshDraft([]), SHINJUKU, ids("acc-z1"));
    expect(withoutZoneAccommodationChoice(base, "Osaka")).toBe(base);
  });
});

describe("deleting the anchor directly", () => {
  it("takes its zone choice with it rather than stranding one", () => {
    const draft = withoutAccommodation(
      withZoneAccommodationChoice(freshDraft([]), SHINJUKU, ids("acc-z1")),
      "acc-z1"
    );
    expect(draft.accommodations).toEqual([]);
    expect(draft.zoneAccommodationChoices).toEqual([]);
  });

  it("keeps the inherited behaviour: legs go, boundaries become unselected, never rebound", () => {
    let draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1"));
    draft = withZoneAccommodationChoice(draft, GION, ids("acc-z2"));
    draft = withDayAccommodationChoice(draft, "day-1", "start", {
      kind: "accommodation",
      accommodationId: "acc-z1",
    });
    draft = withAccommodationLeg(draft, "accommodation-to-place", "acc-z1", "tokyo-a", 25);
    draft = withoutAccommodation(draft, "acc-z1");

    expect(draft.days?.[0].accommodationBoundary.start).toEqual({ kind: "unselected" });
    expect(draft.accommodationLegs).toEqual([]);
    expect(draft.zoneAccommodationChoices).toEqual([
      { hub: "Kioto", zoneId: "kioto-gion", accommodationId: "acc-z2" },
    ]);
  });

  it("is a no-op for an unknown anchor", () => {
    const base = withZoneAccommodationChoice(freshDraft([]), SHINJUKU, ids("acc-z1"));
    expect(withoutAccommodation(base, "acc-nope")).toBe(base);
  });
});

describe("what counts as an anchor being in use", () => {
  it("is false for an anchor nobody has built on", () => {
    const draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1"));
    expect(isAccommodationAnchorInUse(draft, "acc-z1")).toBe(false);
  });

  it("is true once a boundary selects it, on either side", () => {
    const draft = withDayAccommodationChoice(
      withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1")),
      "day-2",
      "end",
      { kind: "accommodation", accommodationId: "acc-z1" }
    );
    expect(isAccommodationAnchorInUse(draft, "acc-z1")).toBe(true);
  });

  it("is true once a manual duration exists for it", () => {
    const draft = withAccommodationLeg(
      withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1")),
      "accommodation-to-place",
      "acc-z1",
      "tokyo-a",
      25
    );
    expect(isAccommodationAnchorInUse(draft, "acc-z1")).toBe(true);
  });

  it("does not confuse one anchor's work for another's", () => {
    let draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1"));
    draft = withZoneAccommodationChoice(draft, GION, ids("acc-z2"));
    draft = withAccommodationLeg(draft, "accommodation-to-place", "acc-z1", "tokyo-a", 25);
    expect(isAccommodationAnchorInUse(draft, "acc-z2")).toBe(false);
  });
});

describe("persistence", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    const draft = withZoneAccommodationChoice(freshDraft(["tokyo-a"]), SHINJUKU, ids("acc-z1"));
    writeDraft(storage, draft);
    expect(loadReconciledDraft(storage, ["tokyo-a"])).toEqual(draft);
  });

  it("survives a reload with the anchor and the choice still joined", () => {
    const storage = memoryStorage();
    writeDraft(storage, withZoneAccommodationChoice(freshDraft([]), SHINJUKU, ids("acc-z1")));
    const reloaded = loadReconciledDraft(storage, []);
    expect(reloaded.zoneAccommodationChoices[0].accommodationId).toBe(
      reloaded.accommodations[0].id
    );
  });

  it("loads a stored V7 payload and migrates it once", () => {
    const storage = memoryStorage(
      JSON.stringify({
        version: 7,
        routeIds: [],
        days: null,
        startDate: null,
        endDate: null,
        visitStartTimes: {},
        accommodations: [],
        accommodationLegs: [],
        interHubSegments: [],
      })
    );
    const loaded = loadReconciledDraft(storage, []);
    expect(loaded.version).toBe(8);
    expect(loaded.zoneAccommodationChoices).toEqual([]);
  });

  it("rejects a choice pointing at an anchor the draft does not contain", () => {
    expect(
      parseStoredDraft({
        version: 8,
        routeIds: [],
        days: null,
        startDate: null,
        endDate: null,
        visitStartTimes: {},
        accommodations: [],
        accommodationLegs: [],
        interHubSegments: [],
        zoneAccommodationChoices: [
          { hub: "Tokio", zoneId: "tokio-shinjuku", accommodationId: "acc-ghost" },
        ],
      })
    ).toBeNull();
  });

  it.each([
    ["a missing field", undefined],
    ["a non-array", {}],
    ["a malformed entry", [{ hub: "Tokio" }]],
    [
      "two choices for one hub",
      [
        { hub: "Tokio", zoneId: "a", accommodationId: "acc-1" },
        { hub: "Tokio", zoneId: "b", accommodationId: "acc-2" },
      ],
    ],
  ])("fails closed on %s", (_label, zoneAccommodationChoices) => {
    expect(
      parseStoredDraft({
        version: 8,
        routeIds: [],
        days: null,
        startDate: null,
        endDate: null,
        visitStartTimes: {},
        accommodations: [
          { id: "acc-1", label: "A", location: { lat: 35, lng: 139 } },
          { id: "acc-2", label: "B", location: { lat: 35, lng: 139 } },
        ],
        accommodationLegs: [],
        interHubSegments: [],
        zoneAccommodationChoices,
      })
    ).toBeNull();
  });

  it("falls back to a fresh draft rather than a repaired one when storage is malformed", () => {
    const storage = memoryStorage('{"version":8,"zoneAccommodationChoices":"nope"}');
    const loaded = loadReconciledDraft(storage, ["tokyo-a"]);
    expect(loaded.version).toBe(8);
    expect(loaded.zoneAccommodationChoices).toEqual([]);
    expect(loaded.routeIds).toEqual(["tokyo-a"]);
  });

  it("falls back on unparseable JSON", () => {
    expect(loadReconciledDraft(memoryStorage("{not json"), []).zoneAccommodationChoices).toEqual([]);
  });
});

describe("the choice survives ordinary planning edits", () => {
  function chosen(): ManualPlanningDraftV8 {
    return withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-z1"));
  }
  const expected = [{ hub: "Tokio", zoneId: "tokio-shinjuku", accommodationId: "acc-z1" }];

  it("survives a day reorder", () => {
    expect(withDayMoved(chosen(), "day-2", -1).zoneAccommodationChoices).toEqual(expected);
  });

  it("survives moving a place inside a day", () => {
    expect(withPlaceMovedWithinDay(chosen(), "day-1", 0, 1).zoneAccommodationChoices).toEqual(expected);
  });

  it("survives adding an empty day", () => {
    expect(withNewEmptyDay(chosen(), ids("day-3")).zoneAccommodationChoices).toEqual(expected);
  });

  it("survives a start-date change", () => {
    expect(withStartDate(chosen(), "2026-04-02").zoneAccommodationChoices).toEqual(expected);
  });

  it("survives a route composition change", () => {
    const next = withRoute(chosen(), ["tokyo-a"]);
    expect(next.zoneAccommodationChoices).toEqual(expected);
    expect(next.accommodations.map((anchor) => anchor.id)).toEqual(["acc-z1"]);
  });

  it("survives removing a place from the saved set", () => {
    const next = reconcileDraft(chosen(), ["tokyo-a"]);
    expect(next.zoneAccommodationChoices).toEqual(expected);
    expect(next.accommodations.map((anchor) => anchor.id)).toEqual(["acc-z1"]);
  });

  it("survives resetting the route, as anchors already do", () => {
    const next = resetRoute(chosen(), ["tokyo-a", "tokyo-b"]);
    expect(next.zoneAccommodationChoices).toEqual(expected);
  });

  it("survives losing every saved place", () => {
    const next = reconcileDraft(chosen(), []);
    expect(next.routeIds).toEqual([]);
    expect(next.zoneAccommodationChoices).toEqual(expected);
  });
});

describe("multi-hub trips", () => {
  it("keeps one zone decision per hub, each with its own anchor", () => {
    let draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-tokyo"));
    draft = withZoneAccommodationChoice(draft, GION, ids("acc-kyoto"));

    expect(draft.zoneAccommodationChoices).toEqual([
      { hub: "Tokio", zoneId: "tokio-shinjuku", accommodationId: "acc-tokyo" },
      { hub: "Kioto", zoneId: "kioto-gion", accommodationId: "acc-kyoto" },
    ]);
  });

  it("removing one hub's zone leaves the other's anchor and choice untouched", () => {
    let draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-tokyo"));
    draft = withZoneAccommodationChoice(draft, GION, ids("acc-kyoto"));
    draft = withoutZoneAccommodationChoice(draft, "Tokio");

    expect(draft.accommodations.map((anchor) => anchor.id)).toEqual(["acc-kyoto"]);
    expect(draft.zoneAccommodationChoices).toEqual([
      { hub: "Kioto", zoneId: "kioto-gion", accommodationId: "acc-kyoto" },
    ]);
  });

  it("does not bind a seeded anchor to its hub — any day may still select it", () => {
    let draft = withZoneAccommodationChoice(plannedDraft(), SHINJUKU, ids("acc-tokyo"));
    draft = withDayAccommodationChoice(draft, "day-2", "start", {
      kind: "accommodation",
      accommodationId: "acc-tokyo",
    });
    expect(draft.days?.[1].accommodationBoundary.start).toEqual({
      kind: "accommodation",
      accommodationId: "acc-tokyo",
    });
  });
});

describe("the module invents nothing", () => {
  it("never mentions routing, duration or a recommendation in its own source", async () => {
    const source = await readFile(new URL("./planning-draft-v8.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/getBestTransfer|lookupTransfer|fetch\(|XMLHttpRequest/);
    expect(source).not.toMatch(/straightLineKm|haversine|geocod/i);
  });

  it("does not import the zone registry into the persistence layer", async () => {
    const source = await readFile(new URL("./planning-draft-v8.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "\.\/accommodation-zone"/);
    const record = await readFile(new URL("./zone-accommodation-choice.ts", import.meta.url), "utf8");
    expect(record).not.toMatch(/from "\.\/accommodation-zone"/);
  });
});
