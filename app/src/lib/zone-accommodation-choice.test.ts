import { describe, expect, it } from "vitest";
import {
  findZoneChoiceForAnchor,
  findZoneChoiceForHub,
  hasUniqueZoneChoiceAnchors,
  hasUniqueZoneChoiceHubs,
  parseZoneAccommodationChoice,
  parseZoneAccommodationChoices,
  pruneZoneChoices,
  type ZoneAccommodationChoice,
} from "./zone-accommodation-choice";

function choice(overrides: Partial<ZoneAccommodationChoice> = {}): ZoneAccommodationChoice {
  return { hub: "Tokio", zoneId: "tokio-shinjuku", accommodationId: "acc-1", ...overrides };
}

describe("the zone choice record", () => {
  it("parses a valid record verbatim", () => {
    expect(parseZoneAccommodationChoice(choice())).toEqual(choice());
  });

  it("carries only the decision — no distance, duration, rank or coordinate", () => {
    const parsed = parseZoneAccommodationChoice({
      ...choice(),
      km: 3.2,
      minutes: 25,
      rank: 1,
      lat: 35.69,
    });
    expect(Object.keys(parsed ?? {}).sort()).toEqual(["accommodationId", "hub", "zoneId"]);
  });

  it.each([
    ["a non-object", "tokio-shinjuku"],
    ["null", null],
    ["an array", []],
    ["a missing hub", { zoneId: "z", accommodationId: "a" }],
    ["a blank hub", { hub: "   ", zoneId: "z", accommodationId: "a" }],
    ["a missing zoneId", { hub: "Tokio", accommodationId: "a" }],
    ["a blank zoneId", { hub: "Tokio", zoneId: "", accommodationId: "a" }],
    ["a missing accommodationId", { hub: "Tokio", zoneId: "z" }],
    ["a blank accommodationId", { hub: "Tokio", zoneId: "z", accommodationId: " " }],
    ["a non-string accommodationId", { hub: "Tokio", zoneId: "z", accommodationId: 7 }],
  ])("rejects %s", (_label, value) => {
    expect(parseZoneAccommodationChoice(value)).toBeNull();
  });
});

describe("the stored list", () => {
  it("parses several hubs", () => {
    const list = [choice(), choice({ hub: "Kioto", zoneId: "kioto-gion", accommodationId: "acc-2" })];
    expect(parseZoneAccommodationChoices(list)).toEqual(list);
  });

  it("parses an empty list", () => {
    expect(parseZoneAccommodationChoices([])).toEqual([]);
  });

  it("rejects a non-array", () => {
    expect(parseZoneAccommodationChoices({})).toBeNull();
    expect(parseZoneAccommodationChoices(null)).toBeNull();
    expect(parseZoneAccommodationChoices(undefined)).toBeNull();
  });

  it("rejects the whole list when one entry is malformed — never drops it silently", () => {
    expect(parseZoneAccommodationChoices([choice(), { hub: "Kioto" }])).toBeNull();
  });

  it("rejects two choices for the same hub rather than letting the later one win", () => {
    const duplicated = [choice(), choice({ zoneId: "tokio-ueno", accommodationId: "acc-2" })];
    expect(hasUniqueZoneChoiceHubs(duplicated)).toBe(false);
    expect(parseZoneAccommodationChoices(duplicated)).toBeNull();
  });

  it("rejects two choices seeded onto the same anchor", () => {
    const shared = [choice(), choice({ hub: "Kioto", zoneId: "kioto-gion" })];
    expect(hasUniqueZoneChoiceAnchors(shared)).toBe(false);
    expect(parseZoneAccommodationChoices(shared)).toBeNull();
  });
});

describe("lookups", () => {
  const list = [choice(), choice({ hub: "Kioto", zoneId: "kioto-gion", accommodationId: "acc-2" })];

  it("finds a hub's choice, and only that hub's", () => {
    expect(findZoneChoiceForHub(list, "Kioto")?.zoneId).toBe("kioto-gion");
    expect(findZoneChoiceForHub(list, "Osaka")).toBeNull();
  });

  it("finds which choice seeded an anchor, and only that anchor's", () => {
    expect(findZoneChoiceForAnchor(list, "acc-2")?.hub).toBe("Kioto");
    expect(findZoneChoiceForAnchor(list, "acc-manual")).toBeNull();
  });
});

describe("reconciliation", () => {
  const list = [choice(), choice({ hub: "Kioto", zoneId: "kioto-gion", accommodationId: "acc-2" })];

  it("drops a choice whose anchor is gone, and never rebinds it to a surviving one", () => {
    const pruned = pruneZoneChoices(list, ["acc-2"]);
    expect(pruned).toEqual([choice({ hub: "Kioto", zoneId: "kioto-gion", accommodationId: "acc-2" })]);
  });

  it("keeps every choice whose anchor survives", () => {
    expect(pruneZoneChoices(list, ["acc-1", "acc-2", "acc-3"])).toEqual(list);
  });

  it("drops everything when no anchor survives", () => {
    expect(pruneZoneChoices(list, [])).toEqual([]);
  });
});
