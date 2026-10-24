import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ZONE_FACT_AREAS,
  ZONE_SOURCE_TIERS,
  bestSourceForFactArea,
  distinctZoneSources,
  getZones,
  sourcesForFactArea,
  zoneSources,
  type ZoneFactArea,
  type ZoneProvenance,
} from "./accommodation-zone";
import {
  sourceLinkLabel,
  sourceName,
  tierLabel,
} from "./zone-provenance-presentation";

/**
 * Block 7 — the contract for zone-fact provenance.
 *
 * The dataset rule lives in `scripts/validate-accommodation-zones.py`, which refuses a source that
 * covers nothing, a fact area that nothing covers, and an encyclopedia claiming to be an operator.
 * These tests hold the same contract from the app's side, plus the two things only the app can
 * see: that the helpers pick a source without inventing one, and that the copy names it.
 */

const ZONES = getZones();

function allSources(): ZoneProvenance[] {
  return ZONES.flatMap((zone) => zoneSources(zone));
}

describe("every checkable claim has a source that says it covers it", () => {
  it("covers all three fact areas in every zone", () => {
    for (const zone of ZONES) {
      for (const area of ZONE_FACT_AREAS) {
        expect(sourcesForFactArea(zone, area).length, `${zone.id}/${area}`).toBeGreaterThan(0);
      }
    }
  });

  it("never lets `covers` be empty or name something unknown", () => {
    for (const source of allSources()) {
      expect(source.covers.length, source.sourceUrl).toBeGreaterThan(0);
      for (const area of source.covers) {
        expect(ZONE_FACT_AREAS, source.sourceUrl).toContain(area);
      }
      expect(new Set(source.covers).size).toBe(source.covers.length);
    }
  });

  it("gives every source a known tier", () => {
    for (const source of allSources()) {
      expect(ZONE_SOURCE_TIERS, source.sourceUrl).toContain(source.tier);
    }
  });

  it("keeps every source https, dated and evidenced", () => {
    for (const source of allSources()) {
      expect(source.sourceUrl.startsWith("https://"), source.sourceUrl).toBe(true);
      expect(source.consultedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.evidence.trim().length, source.sourceUrl).toBeGreaterThan(20);
      expect(source.sourceEntity.trim().length).toBeGreaterThan(0);
    }
  });

  it("never cites the same page twice within one zone", () => {
    for (const zone of ZONES) {
      const urls = zoneSources(zone).map((source) => source.sourceUrl);
      expect(new Set(urls).size, zone.id).toBe(urls.length);
    }
  });
});

describe("an encyclopedia is never dressed as an operator", () => {
  it("marks every encyclopedia source `secondary`", () => {
    for (const source of allSources()) {
      if (/wikipedia\.org|wikivoyage\.org|britannica\.com/.test(source.sourceUrl)) {
        expect(source.tier, source.sourceUrl).toBe("secondary");
      }
    }
  });

  it("only calls a source an operator when it is not an encyclopedia", () => {
    for (const source of allSources()) {
      if (source.tier === "operator") {
        expect(source.sourceUrl, source.sourceUrl).not.toMatch(/wikipedia|wikivoyage|britannica/);
      }
    }
  });
});

describe("Block 7 actually raised the authority of the airport links", () => {
  /*
   * Block 7 put an operator behind four Narita links and one Kansai link. Block 8 added Haneda's
   * own express-bus page behind the two coach links it split out, so Ikebukuro joined the list —
   * a widening of the same rule, not a loosening of it. The list stays hard-coded on purpose: it
   * is what stops a zone acquiring an "operator" source nobody decided to give it.
   */
  const UPGRADED = [
    "ZN-TOK-SHINJUKU",
    "ZN-TOK-MARUNOUCHI",
    "ZN-TOK-SHIBUYA",
    "ZN-TOK-UENO",
    "ZN-TOK-IKEBUKURO",
    "ZN-OSA-NAMBA",
  ];

  it("puts an operator behind the airport links of exactly the migrated zones", () => {
    for (const zone of ZONES) {
      const best = bestSourceForFactArea(zone, "airportLinks");
      expect(best, zone.id).not.toBeNull();
      const expected = UPGRADED.includes(zone.id) ? "operator" : "secondary";
      expect(best?.tier, zone.id).toBe(expected);
    }
  });

  it("leaves the station-level source in place rather than dropping it", () => {
    for (const zone of ZONES) {
      expect(zone.facts.provenance.sourceUrl).toContain("wikipedia.org");
      expect(zone.facts.provenance.covers).toContain("railLines");
      expect(zone.facts.provenance.covers).toContain("shinkansen");
    }
  });

  it("relieves the encyclopedia of the airport links only where an operator covers them all", () => {
    for (const zone of ZONES) {
      const carriesAirports = zone.facts.provenance.covers.includes("airportLinks");
      // Namba's single airport link is fully carried by Nankai's own page; every other zone has at
      // least one link no reachable operator page states, so the station article still stands
      // behind it. Recorded here so the asymmetry cannot be mistaken for an oversight.
      expect(carriesAirports, zone.id).toBe(zone.id !== "ZN-OSA-NAMBA");
    }
  });

  it("does not claim an operator for rail lines or Shinkansen, which were not re-sourced", () => {
    for (const zone of ZONES) {
      expect(bestSourceForFactArea(zone, "railLines")?.tier, zone.id).toBe("secondary");
      expect(bestSourceForFactArea(zone, "shinkansen")?.tier, zone.id).toBe("secondary");
    }
  });

  it("cites the airport or the service operator, not a travel blog", () => {
    const hosts = new Set<string>();
    for (const zone of ZONES) {
      for (const source of zone.facts.sources ?? []) {
        hosts.add(new URL(source.sourceUrl).host);
      }
    }
    // Two airports and one railway. Exact, so a fourth host cannot appear unnoticed.
    expect([...hosts].sort()).toEqual([
      "tokyo-haneda.com",
      "www.nankai.co.jp",
      "www.narita-airport.jp",
    ]);
  });

  it("gives every extra source the operator tier, since that is why it was added", () => {
    for (const zone of ZONES) {
      for (const source of zone.facts.sources ?? []) {
        expect(source.tier, source.sourceUrl).toBe("operator");
        expect(source.covers, source.sourceUrl).toEqual(["airportLinks"]);
      }
    }
  });
});

describe("the helpers pick a source and never invent one", () => {
  it("returns the station source first, then the extras in declaration order", () => {
    for (const zone of ZONES) {
      expect(zoneSources(zone)[0]).toBe(zone.facts.provenance);
      expect(zoneSources(zone).length).toBe(1 + (zone.facts.sources?.length ?? 0));
    }
  });

  it("prefers the better tier, and breaks ties by declaration order", () => {
    const secondary: ZoneProvenance = {
      sourceUrl: "https://en.wikipedia.org/wiki/A",
      sourceEntity: "Wikipedia, a",
      consultedAt: "2026-09-17",
      evidence: "x".repeat(40),
      tier: "secondary",
      covers: ["airportLinks"],
    };
    const first: ZoneProvenance = { ...secondary, sourceUrl: "https://a.example", sourceEntity: "A", tier: "operator" };
    const second: ZoneProvenance = { ...first, sourceUrl: "https://b.example", sourceEntity: "B" };
    const zone = {
      ...ZONES[0],
      facts: { ...ZONES[0].facts, provenance: secondary, sources: [first, second] },
    };
    expect(bestSourceForFactArea(zone, "airportLinks")?.sourceUrl).toBe("https://a.example");
  });

  it("returns null for an area nothing covers rather than guessing", () => {
    const zone = {
      ...ZONES[0],
      facts: {
        ...ZONES[0].facts,
        provenance: { ...ZONES[0].facts.provenance, covers: ["railLines"] as ZoneFactArea[] },
        sources: undefined,
      },
    };
    expect(bestSourceForFactArea(zone, "airportLinks")).toBeNull();
    expect(sourcesForFactArea(zone, "airportLinks")).toEqual([]);
  });

  it("collapses repeated pages for display, keeping the first", () => {
    const base = ZONES[0].facts.provenance;
    const zone = {
      ...ZONES[0],
      facts: { ...ZONES[0].facts, sources: [{ ...base, evidence: "y".repeat(40) }] },
    };
    expect(distinctZoneSources(zone)).toHaveLength(1);
    expect(distinctZoneSources(zone)[0]).toBe(base);
  });

  it("treats a zone with no extra sources exactly as Block 3 left it", () => {
    const kyoto = ZONES.find((zone) => zone.id === "ZN-KYO-GION");
    expect(kyoto?.facts.sources).toBeUndefined();
    expect(zoneSources(kyoto!)).toEqual([kyoto!.facts.provenance]);
  });
});

describe("the copy names the source and says how close it is", () => {
  it("shortens an auditor's entity string to a readable name", () => {
    expect(
      sourceName({
        sourceUrl: "https://x",
        sourceEntity: "Narita International Airport — acceso ferroviario (operador del aeropuerto)",
        consultedAt: "2026-09-18",
        evidence: "e",
        tier: "operator",
        covers: ["airportLinks"],
      })
    ).toBe("Narita International Airport");
  });

  it("handles the Block 3 comma form too", () => {
    expect(
      sourceName({
        sourceUrl: "https://x",
        sourceEntity: "Wikipedia, station article (railway lines and operators)",
        consultedAt: "2026-09-17",
        evidence: "e",
        tier: "secondary",
        covers: ["railLines"],
      })
    ).toBe("Wikipedia");
  });

  it("produces a non-empty name for every real source", () => {
    for (const source of allSources()) {
      expect(sourceName(source).length, source.sourceEntity).toBeGreaterThan(0);
      expect(sourceName(source)).not.toContain("—");
    }
  });

  it("gives every tier a word, and never a number or a rating", () => {
    for (const tier of ZONE_SOURCE_TIERS) {
      const label = tierLabel(tier);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/\d|%|mejor|peor|fiable|bueno|malo/i);
    }
  });

  it("names the zone and the date in the accessible label", () => {
    const zone = ZONES[0];
    const label = sourceLinkLabel(zone.facts.provenance, zone.name);
    expect(label).toContain(zone.name);
    expect(label).toContain(zone.facts.provenance.consultedAt);
    expect(label).toContain(tierLabel(zone.facts.provenance.tier));
  });

  it("gives every source link on a hub's panel a distinct accessible name", () => {
    for (const hub of ["Tokio", "Kioto", "Osaka"]) {
      const labels = ZONES.filter((zone) => zone.hub === hub).flatMap((zone) =>
        distinctZoneSources(zone).map((source) => sourceLinkLabel(source, zone.name))
      );
      expect(new Set(labels).size, hub).toBe(labels.length);
    }
  });
});

describe("provenance never leaks into judgement", () => {
  it("keeps tier, covers and sources out of every editorial block", () => {
    for (const zone of ZONES) {
      const editorial = zone.editorial as unknown as Record<string, unknown>;
      for (const key of ["tier", "covers", "sources", "provenance", "sourceUrl"]) {
        expect(key in editorial, `${zone.id}.${key}`).toBe(false);
      }
    }
  });

  it("does not let a tier reach the editorial presentation at all", async () => {
    const source = await readFile(new URL("./accommodation-zone.ts", import.meta.url), "utf8");
    const editorialRegion = source.slice(source.indexOf("export type ZoneEditorial"));
    const block = editorialRegion.slice(0, editorialRegion.indexOf("};"));
    expect(block).not.toMatch(/tier|covers|source/i);
  });

  it("never turns a tier into a score anywhere in the layer", async () => {
    for (const name of ["accommodation-zone.ts", "zone-provenance-presentation.ts"]) {
      const code = (await readFile(new URL(`./${name}`, import.meta.url), "utf8"))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, name).not.toMatch(/tierScore|sourceScore|authorityScore|trustScore/i);
    }
  });
});
