import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  EDITORIAL_AXES,
  NEUTRAL_AXES,
  editorialContrasts,
  getZones,
  rankZonesBySavedPlaces,
  type ZoneEditorial,
} from "./accommodation-zone";
import {
  EDITORIAL_OWNER,
  NEUTRAL_AXIS_NOTE,
  axisDirectionHint,
  axisHasNoGoodDirection,
  editorialDisclosure,
  ratingAccessibleText,
} from "./zone-editorial-presentation";

/**
 * Block 9 — the governance contract for zone editorial ratings.
 *
 * ## The two questions this file exists to answer, unambiguously
 *
 * **Who can change a zone's editorial rating?** Only Nihon, by shipping different data. There is
 * no editor, no traveller-facing write path, and no per-person rating.
 *
 * **What is the difference between the rating and a traveller wanting to visit the zone?** The
 * rating says what the neighbourhood is like and belongs to the product; wanting to go is what one
 * person feels and belongs to that person. Block 5 settled that the latter is the *only* personal
 * datum in this app. They may disagree freely and neither corrects the other.
 *
 * Both answers are asserted here rather than left to prose, including the negative half: that no
 * write path and no personal rating exist.
 */

const ZONES = getZones();
const AXIS_KEYS = EDITORIAL_AXES.map((axis) => axis.key);

describe("who owns an editorial rating", () => {
  it("names exactly one owner, and it is not a traveller", () => {
    expect(EDITORIAL_OWNER).toBe("Nihon");
  });

  it("exposes no way to write one — the module is read-only by construction", async () => {
    const source = await readFile(new URL("./accommodation-zone.ts", import.meta.url), "utf8");
    // Every other layer that owns state exports `with…` transitions. This one exports none.
    expect(source).not.toMatch(/export function with[A-Z]\w*Editorial|export function setEditorial/);
    expect(source).not.toMatch(/export function withZoneRating|export function rateZone/);
  });

  it("has no component that edits a rating", async () => {
    const panel = await readFile(new URL("../components/ZoneComparison.tsx", import.meta.url), "utf8");
    const code = panel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/onRate|onEditorial|setRating|onChangeRating|editRating/);
    // No input, slider or select anywhere near the ratings.
    expect(code).not.toMatch(/<input[^>]*type="range"/);
  });

  it("writes no storage key for ratings", async () => {
    for (const name of ["lib/zone-editorial-presentation.ts", "components/ZoneComparison.tsx"]) {
      const code = (await readFile(new URL(`../${name}`, import.meta.url), "utf8"))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, name).not.toMatch(/nihon\.(zoneRating|editorial|rating)/i);
    }
    const presentation = await readFile(
      new URL("./zone-editorial-presentation.ts", import.meta.url),
      "utf8"
    );
    expect(presentation).not.toMatch(/localStorage|setItem|sessionStorage/);
  });
});

describe("a rating is not a fact", () => {
  it("carries no provenance, in any zone", () => {
    for (const zone of ZONES) {
      const editorial = zone.editorial as unknown as Record<string, unknown>;
      for (const key of ["provenance", "sourceUrl", "sources", "tier", "covers", "consultedAt"]) {
        expect(key in editorial, `${zone.id}.${key}`).toBe(false);
      }
    }
  });

  it("lives beside facts in the document but never inside them", () => {
    for (const zone of ZONES) {
      const facts = zone.facts as unknown as Record<string, unknown>;
      for (const key of AXIS_KEYS) {
        expect(key in facts, `${zone.id}.facts.${key}`).toBe(false);
      }
      expect("editorial" in facts).toBe(false);
    }
  });

  it("says on screen that it is criterio rather than a measurement", () => {
    // The bare string "3 de 5" has the exact shape of a measurement. This is the fix.
    expect(ratingAccessibleText(3)).toContain("criterio");
    expect(ratingAccessibleText(3)).toContain(EDITORIAL_OWNER);
    expect(ratingAccessibleText(3)).not.toBe("3 de 5");
  });

  it("states that the ratings are not verifiable data", () => {
    expect(editorialDisclosure()).toMatch(/no datos verificables/i);
  });
});

describe("a rating is not a traveller's preference", () => {
  it("keeps the zone layer ignorant of travellers, stances and interests", async () => {
    const source = (await readFile(new URL("./accommodation-zone.ts", import.meta.url), "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/TravellersDocument|InterestStance|stanceOf|shortlistPlaceIds/);
    expect(source).not.toMatch(/\bstance\b|travellerId/);
  });

  it("keeps the travellers layer ignorant of editorial ratings", async () => {
    for (const name of ["travellers.ts", "interest-divergence.ts"]) {
      const source = (await readFile(new URL(`./${name}`, import.meta.url), "utf8"))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(source, name).not.toMatch(/editorial|ZoneEditorial|EDITORIAL_AXES|tourismIntensity/);
    }
  });

  it("carries no per-traveller field in any zone", () => {
    for (const zone of ZONES) {
      const record = zone as unknown as Record<string, unknown>;
      for (const key of ["travellerId", "travellers", "stances", "perTraveller", "votes", "myRating"]) {
        expect(key in record, `${zone.id}.${key}`).toBe(false);
      }
    }
  });

  it("says on screen that a rating describes the zone, not whether they want to go", () => {
    const text = editorialDisclosure();
    expect(text).toMatch(/describen cómo es la zona/i);
    expect(text).toMatch(/no si queréis ir/i);
    expect(text).toMatch(/no se pueden editar/i);
  });

  it("does not let a preference reach the zone ordering — that is derived distance only", async () => {
    const source = await readFile(new URL("./accommodation-zone.ts", import.meta.url), "utf8");
    const fn = source.slice(source.indexOf("export function rankZonesBySavedPlaces"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).toContain("medianKm");
    expect(body).not.toMatch(/editorial|stance|interest/);
  });

  it("orders zones identically whatever the ratings say", () => {
    // Ordering is a function of geometry alone, so two zones may rank in either order regardless
    // of their judgement — which is what keeps editorial out of the recommendation path.
    const tokyo = ZONES.filter((zone) => zone.hub === "Tokio");
    const ranked = rankZonesBySavedPlaces(tokyo, []);
    expect(ranked).toHaveLength(tokyo.length);
    // With nothing saved every fit is null, so the input order survives: no editorial tiebreak.
    expect(ranked.map((entry) => entry.zone.id)).toEqual(tokyo.map((zone) => zone.id));
  });
});

describe("there is no composite score, and there must not be", () => {
  it("exposes no function returning an overall number for a zone", async () => {
    const source = (await readFile(new URL("./accommodation-zone.ts", import.meta.url), "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/overallScore|zoneScore|totalScore|compositeScore|averageRating/i);
  });

  it("carries no total in the data", () => {
    for (const zone of ZONES) {
      expect(Object.keys(zone.editorial).sort()).toEqual([...AXIS_KEYS].sort());
    }
  });

  it("keeps two axes explicitly without a good direction", () => {
    expect([...NEUTRAL_AXES].sort()).toEqual(["nightlife", "tourismIntensity"]);
    for (const key of NEUTRAL_AXES) {
      expect(axisHasNoGoodDirection(key)).toBe(true);
    }
    expect(axisHasNoGoodDirection("luggageEase")).toBe(false);
  });

  it("names neutrality in words, not only in a colour", () => {
    expect(NEUTRAL_AXIS_NOTE).toBe("ni bueno ni malo");
    expect(NEUTRAL_AXIS_NOTE.length).toBeGreaterThan(0);
  });
});

describe("every rating is reviewable", () => {
  it("gives every axis a stated direction", () => {
    for (const axis of EDITORIAL_AXES) {
      expect(axis.high.trim().length, axis.key).toBeGreaterThan(8);
      expect(axisDirectionHint(axis.high)).toMatch(/^Más marcas = .+/);
    }
  });

  it("covers exactly the axes the data carries, with no orphan either way", () => {
    for (const zone of ZONES) {
      expect(Object.keys(zone.editorial).sort(), zone.id).toEqual([...AXIS_KEYS].sort());
    }
    expect(new Set(AXIS_KEYS).size).toBe(AXIS_KEYS.length);
  });

  it("keeps every value an integer on the closed 1–5 scale", () => {
    for (const zone of ZONES) {
      for (const key of AXIS_KEYS) {
        const value = zone.editorial[key as keyof ZoneEditorial];
        expect({ zone: zone.id, key, ok: Number.isInteger(value) && value >= 1 && value <= 5 }).toEqual({
          zone: zone.id,
          key,
          ok: true,
        });
      }
    }
  });

  it("gives every zone written drawbacks, so a high rating is never the whole story", () => {
    for (const zone of ZONES) {
      expect(zone.tradeoffs.length, zone.id).toBeGreaterThanOrEqual(2);
      for (const tradeoff of zone.tradeoffs) {
        expect(tradeoff.trim().length, zone.id).toBeGreaterThan(15);
      }
    }
  });

  it("surfaces contrasts only where the choice actually costs something", () => {
    const tokyo = ZONES.filter((zone) => zone.hub === "Tokio").slice(0, 2);
    for (const axis of editorialContrasts(tokyo)) {
      expect(axis.spread).toBeGreaterThanOrEqual(2);
      expect(axis.high.length).toBeGreaterThan(0);
    }
    expect(editorialContrasts(tokyo.slice(0, 1))).toEqual([]);
  });
});

describe("the copy passes no judgement it cannot support", () => {
  it("never calls a zone best, recommended or unsuitable", async () => {
    const code = (await readFile(new URL("./zone-editorial-presentation.ts", import.meta.url), "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/la mejor|el mejor|recomendad|deberíais|evitad|ideal para/i);
  });

  it("emits no percentage and no score-shaped figure", () => {
    const strings = [
      editorialDisclosure(),
      NEUTRAL_AXIS_NOTE,
      ...EDITORIAL_AXES.map((axis) => axisDirectionHint(axis.high)),
      ...[1, 2, 3, 4, 5].map(ratingAccessibleText),
    ];
    for (const text of strings) {
      expect(text, text).not.toMatch(/%|\d\s*\/\s*\d|\bscore\b|puntuaci/i);
    }
  });

  it("keeps the disclosure short enough to read on a phone", () => {
    expect(editorialDisclosure().length).toBeLessThan(260);
  });
});
