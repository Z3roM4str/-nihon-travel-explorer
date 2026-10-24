import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { Place } from "../types";
import type { AccommodationAnchor, DayAccommodationBoundary } from "./accommodation-commute";
import { getZoneById } from "./accommodation-zone";
import {
  buildZoneDayLinks,
  buildZoneHubLinks,
  resolveZoneChoice,
  type ZoneDayLinkInput,
} from "./zone-plan-link";
import type { ZoneAccommodationChoice } from "./zone-accommodation-choice";

const SHINJUKU_ID = "ZN-TOK-SHINJUKU";
const KYOTO_STATION_ID = "ZN-KYO-STATION";

/** Places built around the real registry coordinates so the bands below are the real bands. */
const PLACES: Record<string, Place> = {
  "tokyo-near": place("tokyo-near", "Shinjuku Gyoen", "Tokio", 35.6852, 139.71),
  "tokyo-far": place("tokyo-far", "Sensō-ji", "Tokio", 35.7148, 139.7967),
  "kyoto-a": place("kyoto-a", "Fushimi Inari", "Kioto", 34.9671, 135.7727),
};

function place(id: string, name: string, hub: string, lat: number, lng: number): Place {
  return { id, name, hub, coordinates: { lat, lng } } as unknown as Place;
}

function resolvePlace(placeId: string): Place | null {
  return PLACES[placeId] ?? null;
}

function boundary(
  start: DayAccommodationBoundary["start"] = { kind: "unselected" },
  end: DayAccommodationBoundary["end"] = { kind: "unselected" }
): DayAccommodationBoundary {
  return { start, end };
}

function day(placeIds: string[], accommodationBoundary = boundary()): ZoneDayLinkInput {
  return { placeIds, accommodationBoundary };
}

const ZONE_ANCHOR: AccommodationAnchor = {
  id: "acc-zone",
  label: "Shinjuku Station",
  location: { lat: 35.690921, lng: 139.700258 },
};
const MANUAL_ANCHOR: AccommodationAnchor = {
  id: "acc-manual",
  label: "Hotel a mano",
  location: { lat: 35.66, lng: 139.75 },
};
const KYOTO_ANCHOR: AccommodationAnchor = {
  id: "acc-kyoto",
  label: "Kyōto Station",
  location: { lat: 34.985849, lng: 135.758767 },
};

const TOKYO_CHOICE: ZoneAccommodationChoice = {
  hub: "Tokio",
  zoneId: SHINJUKU_ID,
  accommodationId: "acc-zone",
};
const KYOTO_CHOICE: ZoneAccommodationChoice = {
  hub: "Kioto",
  zoneId: KYOTO_STATION_ID,
  accommodationId: "acc-kyoto",
};

describe("resolving a stored choice", () => {
  it("returns the live zone and anchor", () => {
    const resolved = resolveZoneChoice(TOKYO_CHOICE, [ZONE_ANCHOR]);
    expect(resolved.zone?.id).toBe(SHINJUKU_ID);
    expect(resolved.anchor?.label).toBe("Shinjuku Station");
  });

  it("reports a zone that is no longer in the catalogue instead of throwing", () => {
    const resolved = resolveZoneChoice({ ...TOKYO_CHOICE, zoneId: "ZN-GONE" }, [ZONE_ANCHOR]);
    expect(resolved.zone).toBeNull();
    expect(resolved.zoneId).toBe("ZN-GONE");
    expect(resolved.anchor?.id).toBe("acc-zone");
  });
});

describe("which hub a day belongs to", () => {
  it("attaches the hub's chosen zone to a single-hub day", () => {
    const [link] = buildZoneDayLinks([day(["tokyo-near", "tokyo-far"])], [TOKYO_CHOICE], [ZONE_ANCHOR], {
      resolvePlace,
    });
    expect(link.hubs).toEqual(["Tokio"]);
    expect(link.singleHub).toBe("Tokio");
    expect(link.chosenZone?.zoneId).toBe(SHINJUKU_ID);
  });

  it("attaches NO zone to a day that spans two hubs", () => {
    const [link] = buildZoneDayLinks([day(["tokyo-near", "kyoto-a"])], [TOKYO_CHOICE], [ZONE_ANCHOR], {
      resolvePlace,
    });
    expect(link.hubs.sort()).toEqual(["Kioto", "Tokio"]);
    expect(link.singleHub).toBeNull();
    expect(link.chosenZone).toBeNull();
    expect(link.proximity).toBeNull();
  });

  it("never shows one hub's zone as the accommodation of another hub's day", () => {
    const [tokyoDay, kyotoDay] = buildZoneDayLinks(
      [day(["tokyo-near"]), day(["kyoto-a"])],
      [TOKYO_CHOICE],
      [ZONE_ANCHOR],
      { resolvePlace }
    );
    expect(tokyoDay.chosenZone?.hub).toBe("Tokio");
    expect(kyotoDay.chosenZone).toBeNull();
  });

  it("gives each hub its own zone on a multi-hub trip", () => {
    const [tokyoDay, kyotoDay] = buildZoneDayLinks(
      [day(["tokyo-near"]), day(["kyoto-a"])],
      [TOKYO_CHOICE, KYOTO_CHOICE],
      [ZONE_ANCHOR, KYOTO_ANCHOR],
      { resolvePlace }
    );
    expect(tokyoDay.chosenZone?.zoneId).toBe(SHINJUKU_ID);
    expect(kyotoDay.chosenZone?.zoneId).toBe(KYOTO_STATION_ID);
  });

  it("reports an empty day without inventing a hub", () => {
    const [link] = buildZoneDayLinks([day([])], [TOKYO_CHOICE], [ZONE_ANCHOR], { resolvePlace });
    expect(link.hubs).toEqual([]);
    expect(link.singleHub).toBeNull();
    expect(link.boundaryUse.start).toEqual({ kind: "empty-day" });
    expect(link.boundaryUse.end).toEqual({ kind: "empty-day" });
    expect(link.proximity).toBeNull();
  });

  it("leaves an unresolvable place out of the hub agreement rather than guessing", () => {
    const [link] = buildZoneDayLinks([day(["tokyo-near", "ghost"])], [TOKYO_CHOICE], [ZONE_ANCHOR], {
      resolvePlace,
    });
    expect(link.hubs).toEqual(["Tokio"]);
    expect(link.proximity?.entries.map((entry) => entry.placeId)).toEqual(["tokyo-near"]);
  });
});

describe("what each boundary side is planned from", () => {
  it("recognises the zone's own anchor", () => {
    const [link] = buildZoneDayLinks(
      [day(["tokyo-near"], boundary({ kind: "accommodation", accommodationId: "acc-zone" }))],
      [TOKYO_CHOICE],
      [ZONE_ANCHOR],
      { resolvePlace }
    );
    expect(link.boundaryUse.start).toEqual({ kind: "zone-anchor", accommodationId: "acc-zone" });
  });

  it("reports a hand-made anchor neutrally, as a fact and not a warning", () => {
    const [link] = buildZoneDayLinks(
      [day(["tokyo-near"], boundary({ kind: "accommodation", accommodationId: "acc-manual" }))],
      [TOKYO_CHOICE],
      [ZONE_ANCHOR, MANUAL_ANCHOR],
      { resolvePlace }
    );
    expect(link.boundaryUse.start).toEqual({
      kind: "other-anchor",
      accommodationId: "acc-manual",
      seededByZoneForHub: null,
    });
  });

  it("says when the other anchor is itself another hub's zone", () => {
    const [link] = buildZoneDayLinks(
      [day(["kyoto-a"], boundary({ kind: "accommodation", accommodationId: "acc-zone" }))],
      [TOKYO_CHOICE, KYOTO_CHOICE],
      [ZONE_ANCHOR, KYOTO_ANCHOR],
      { resolvePlace }
    );
    expect(link.boundaryUse.start).toEqual({
      kind: "other-anchor",
      accommodationId: "acc-zone",
      seededByZoneForHub: "Tokio",
    });
  });

  it("keeps unselected and no-accommodation distinct", () => {
    const [link] = buildZoneDayLinks(
      [day(["tokyo-near"], boundary({ kind: "unselected" }, { kind: "no-accommodation" }))],
      [TOKYO_CHOICE],
      [ZONE_ANCHOR],
      { resolvePlace }
    );
    expect(link.boundaryUse.start).toEqual({ kind: "unselected" });
    expect(link.boundaryUse.end).toEqual({ kind: "no-accommodation" });
  });

  it("treats the two sides independently", () => {
    const [link] = buildZoneDayLinks(
      [
        day(
          ["tokyo-near", "tokyo-far"],
          boundary(
            { kind: "accommodation", accommodationId: "acc-zone" },
            { kind: "accommodation", accommodationId: "acc-manual" }
          )
        ),
      ],
      [TOKYO_CHOICE],
      [ZONE_ANCHOR, MANUAL_ANCHOR],
      { resolvePlace }
    );
    expect(link.boundaryUse.start.kind).toBe("zone-anchor");
    expect(link.boundaryUse.end.kind).toBe("other-anchor");
  });
});

describe("derived proximity", () => {
  it("is straight-line geometry in the catalogue's own bands, never minutes", () => {
    const [link] = buildZoneDayLinks([day(["tokyo-near", "tokyo-far"])], [TOKYO_CHOICE], [ZONE_ANCHOR], {
      resolvePlace,
    });
    const entries = link.proximity?.entries ?? [];
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(Number.isFinite(entry.km)).toBe(true);
      expect(["doorstep", "near", "moderate", "far"]).toContain(entry.band);
      expect(entry).not.toHaveProperty("minutes");
    }
    expect(link.proximity).not.toHaveProperty("minutes");
  });

  it("matches the zone's real anchor — Shinjuku Gyoen is on the doorstep, Sensō-ji is not", () => {
    const [link] = buildZoneDayLinks([day(["tokyo-near", "tokyo-far"])], [TOKYO_CHOICE], [ZONE_ANCHOR], {
      resolvePlace,
    });
    const byId = new Map(link.proximity?.entries.map((entry) => [entry.placeId, entry]));
    expect(byId.get("tokyo-near")?.band).toBe("doorstep");
    expect(byId.get("tokyo-far")?.band).toBe("moderate");
    expect(link.proximity?.byBand).toEqual({ doorstep: 1, near: 0, moderate: 1, far: 0 });
  });

  it("keeps the day's own order rather than re-sorting into a ranking", () => {
    const [link] = buildZoneDayLinks([day(["tokyo-far", "tokyo-near"])], [TOKYO_CHOICE], [ZONE_ANCHOR], {
      resolvePlace,
    });
    expect(link.proximity?.entries.map((entry) => entry.placeId)).toEqual(["tokyo-far", "tokyo-near"]);
  });

  it("reports a median for an even and an odd count", () => {
    const [even] = buildZoneDayLinks([day(["tokyo-near", "tokyo-far"])], [TOKYO_CHOICE], [ZONE_ANCHOR], {
      resolvePlace,
    });
    const [odd] = buildZoneDayLinks([day(["tokyo-near"])], [TOKYO_CHOICE], [ZONE_ANCHOR], {
      resolvePlace,
    });
    const entries = even.proximity?.entries ?? [];
    expect(even.proximity?.medianKm).toBeCloseTo((entries[0].km + entries[1].km) / 2, 6);
    expect(odd.proximity?.medianKm).toBeCloseTo(odd.proximity?.entries[0].km ?? -1, 6);
  });

  it("produces nothing when the zone is gone from the catalogue", () => {
    const [link] = buildZoneDayLinks(
      [day(["tokyo-near"])],
      [{ ...TOKYO_CHOICE, zoneId: "ZN-GONE" }],
      [ZONE_ANCHOR],
      { resolvePlace }
    );
    expect(link.chosenZone?.zone).toBeNull();
    expect(link.proximity).toBeNull();
  });

  it("measures from the zone's registry anchor, not from the seeded accommodation record", () => {
    const movedAnchor: AccommodationAnchor = { ...ZONE_ANCHOR, location: { lat: 0, lng: 0 } };
    const [link] = buildZoneDayLinks([day(["tokyo-near"])], [TOKYO_CHOICE], [movedAnchor], {
      resolvePlace,
    });
    expect(link.proximity?.anchorLabel).toBe(getZoneById(SHINJUKU_ID)?.anchor.label);
    expect(link.proximity?.entries[0].band).toBe("doorstep");
  });
});

describe("the per-hub rollup", () => {
  const days = [
    day(["tokyo-near"], boundary({ kind: "accommodation", accommodationId: "acc-zone" }, { kind: "unselected" })),
    day(
      ["tokyo-far"],
      boundary({ kind: "accommodation", accommodationId: "acc-manual" }, { kind: "no-accommodation" })
    ),
    day(["kyoto-a"]),
  ];

  it("lists only the days whose hub matches the choice", () => {
    const dayLinks = buildZoneDayLinks(days, [TOKYO_CHOICE], [ZONE_ANCHOR, MANUAL_ANCHOR], {
      resolvePlace,
    });
    const [tokyo] = buildZoneHubLinks(dayLinks, [TOKYO_CHOICE], [ZONE_ANCHOR, MANUAL_ANCHOR]);
    expect(tokyo.dayOrdinals).toEqual([0, 1]);
  });

  it("counts each boundary side by what the reader actually chose", () => {
    const dayLinks = buildZoneDayLinks(days, [TOKYO_CHOICE], [ZONE_ANCHOR, MANUAL_ANCHOR], {
      resolvePlace,
    });
    const [tokyo] = buildZoneHubLinks(dayLinks, [TOKYO_CHOICE], [ZONE_ANCHOR, MANUAL_ANCHOR]);
    expect(tokyo.sidesPlannedFromZone).toBe(1);
    expect(tokyo.sidesPlannedFromAnotherAnchor).toBe(1);
    expect(tokyo.sidesUnselected).toBe(1);
    expect(tokyo.sidesNoAccommodation).toBe(1);
  });

  it("reports a zone chosen before any day exists without complaint", () => {
    const [tokyo] = buildZoneHubLinks([], [TOKYO_CHOICE], [ZONE_ANCHOR]);
    expect(tokyo.dayOrdinals).toEqual([]);
    expect(tokyo.sidesPlannedFromZone).toBe(0);
  });

  it("returns nothing at all when no zone is chosen", () => {
    const dayLinks = buildZoneDayLinks(days, [], [], { resolvePlace });
    expect(buildZoneHubLinks(dayLinks, [], [])).toEqual([]);
    for (const link of dayLinks) expect(link.chosenZone).toBeNull();
  });
});

/**
 * These scan the module's CODE, with comments stripped first.
 *
 * The prose deliberately names the things the module refuses to do — "no travel time", "no best
 * zone" — so a regex over the raw file would match the very sentences that promise the opposite of
 * the defect. Stripping comments makes the assertion mean what it says: the behaviour is absent,
 * not merely the vocabulary.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("the module invents no logistics", () => {
  it("never touches the transfer graph or the network", async () => {
    const code = codeOnly(await readFile(new URL("./zone-plan-link.ts", import.meta.url), "utf8"));
    expect(code).not.toMatch(/getBestTransfer|lookupTransfer|fetch\(|XMLHttpRequest|navigator/);
  });

  it("exposes no minutes, score, rank or recommendation in its types", async () => {
    const code = codeOnly(await readFile(new URL("./zone-plan-link.ts", import.meta.url), "utf8"));
    expect(code).not.toMatch(/minutes/i);
    expect(code).not.toMatch(/\bscore\b|\brecommended\b|\bbest\b/i);
  });

  it("strips comments without hiding real code", () => {
    expect(codeOnly("/* best */ const a = 1; // score\nconst best = 2;")).toContain("const best = 2;");
    expect(codeOnly("/* best */ const a = 1;")).not.toContain("best");
  });
});
