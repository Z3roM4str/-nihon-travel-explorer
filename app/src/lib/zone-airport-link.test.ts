import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ZONE_AIRPORT_LINK_MODES,
  getZoneById,
  getZones,
  type ZoneAirportLink,
} from "./accommodation-zone";
import {
  airportLinkConnection,
  airportLinkDescription,
  airportLinkKey,
} from "./zone-airport-presentation";

/**
 * Block 8 — what `directFromZone` means.
 *
 * ## The contract these tests exist to prove
 *
 * > **`directFromZone` is true when the service named in THIS record carries the traveller
 * > between this zone and this airport with no change.**
 *
 * Two consequences, and both are tested rather than asserted in prose:
 *
 * * it is **mode-agnostic** — a coach that runs without a change is direct, exactly as a train is,
 *   and the dataset has said so since Block 3 (Umeda → Itami);
 * * one record holds **one service**, because a single boolean cannot be true of a direct coach
 *   and false of a rail route with a change. A zone offering both has two records.
 *
 * These tests are written to fail if the MEANING drifts, not merely if a value changes. Where a
 * specific record is named it is because that record is the evidence for a rule.
 */

const ZONES = getZones();

function allLinks(): { zoneId: string; link: ZoneAirportLink }[] {
  return ZONES.flatMap((zone) => zone.facts.airportLinks.map((link) => ({ zoneId: zone.id, link })));
}

function linksOf(zoneId: string, airport?: string): ZoneAirportLink[] {
  const zone = getZoneById(zoneId);
  if (!zone) throw new Error(`unknown zone ${zoneId}`);
  return zone.facts.airportLinks.filter((link) => !airport || link.airport.startsWith(airport));
}

const VIA = /\bv[ií]a\b/i;

describe("the meaning of directFromZone", () => {
  it("is a claim about one service, so a route described as going via somewhere is never direct", () => {
    for (const { zoneId, link } of allLinks()) {
      if (VIA.test(link.service)) {
        expect(link.directFromZone, `${zoneId}: ${link.service}`).toBe(false);
      }
    }
  });

  it("is mode-agnostic: a coach without a change is as direct as a train without one", () => {
    const direct = allLinks().filter(({ link }) => link.directFromZone);
    expect(direct.some(({ link }) => link.mode === "bus")).toBe(true);
    expect(direct.some(({ link }) => link.mode === "rail")).toBe(true);
  });

  it("does NOT mean 'direct rail' — Umeda reaches Itami by coach and it is direct", () => {
    const [itami] = linksOf("ZN-OSA-UMEDA", "Itami");
    expect(itami.mode).toBe("bus");
    expect(itami.directFromZone).toBe(true);
    // This single record is what rules out the "direct rail" reading, and has since Block 3.
  });

  it("does not mean 'this airport is reachable without a change' — that is a zone-level question", () => {
    // Shinjuku reaches Haneda directly by coach AND by rail with a change. Both are true of the
    // zone at once, which is exactly why the boolean lives on the service and not on the airport.
    const haneda = linksOf("ZN-TOK-SHINJUKU", "Haneda");
    expect(haneda.length).toBeGreaterThan(1);
    expect(haneda.some((link) => link.directFromZone)).toBe(true);
    expect(haneda.some((link) => !link.directFromZone)).toBe(true);
  });
});

describe("the case that opened this block — Haneda from Shinjuku and Ikebukuro", () => {
  it("records Shinjuku's Haneda coach as direct, naming the stop the airport names", () => {
    const [coach] = linksOf("ZN-TOK-SHINJUKU", "Haneda").filter((link) => link.mode === "bus");
    expect(coach).toBeDefined();
    expect(coach.directFromZone).toBe(true);
    expect(coach.service).toContain("Shinjuku Station West Exit");
  });

  it("records Ikebukuro's Haneda coach as direct, naming the stop the airport names", () => {
    const [coach] = linksOf("ZN-TOK-IKEBUKURO", "Haneda").filter((link) => link.mode === "bus");
    expect(coach).toBeDefined();
    expect(coach.directFromZone).toBe(true);
    expect(coach.service).toContain("Ikebukuro Station West Exit");
  });

  it("keeps the rail route to Haneda as a separate record that still needs a change", () => {
    for (const zoneId of ["ZN-TOK-SHINJUKU", "ZN-TOK-IKEBUKURO"]) {
      const rail = linksOf(zoneId, "Haneda").filter((link) => link.mode === "rail");
      expect(rail, zoneId).toHaveLength(1);
      expect(rail[0].directFromZone, zoneId).toBe(false);
      expect(rail[0].service, zoneId).toMatch(VIA);
    }
  });

  it("no longer packs two services into one record", () => {
    // The defect this block fixed: "Autobús limusina / vía Shinagawa" was one record describing a
    // direct coach AND a rail route with a change, marked false for both.
    for (const { zoneId, link } of allLinks()) {
      const bundlesAVia = /autob[úu]s|limusina/i.test(link.service) && VIA.test(link.service);
      expect(bundlesAVia, `${zoneId}: ${link.service}`).toBe(false);
    }
  });

  it("backs each coach claim with the airport's own page", () => {
    for (const zoneId of ["ZN-TOK-SHINJUKU", "ZN-TOK-IKEBUKURO"]) {
      const zone = getZoneById(zoneId);
      const haneda = (zone?.facts.sources ?? []).find((source) =>
        source.sourceUrl.includes("tokyo-haneda.com")
      );
      expect(haneda, zoneId).toBeDefined();
      expect(haneda?.tier).toBe("operator");
      expect(haneda?.covers).toContain("airportLinks");
    }
  });
});

describe("contrast cases", () => {
  it("a direct rail connection: Kioto Station reaches Kansai by Haruka with no change", () => {
    const [kix] = linksOf("ZN-KYO-STATION", "Kansai");
    expect(kix.mode).toBe("rail");
    expect(kix.directFromZone).toBe(true);
    expect(kix.service).not.toMatch(VIA);
  });

  it("a rail connection with a change: Gion reaches Kansai via Kioto Station", () => {
    const [kix] = linksOf("ZN-KYO-GION", "Kansai");
    expect(kix.mode).toBe("rail");
    expect(kix.directFromZone).toBe(false);
    expect(kix.service).toMatch(VIA);
  });

  it("a case where false is simply correct: the Bay changes twice to reach Kansai", () => {
    const [kix] = linksOf("ZN-OSA-BAY", "Kansai");
    expect(kix.directFromZone).toBe(false);
    expect(kix.service).toContain("Nishikujō");
  });

  it("a through-service counts as direct even though two operators run it", () => {
    // Asakusa: Toei Asakusa trains run through onto Keikyu and Keisei metals. No change of train.
    const links = linksOf("ZN-TOK-ASAKUSA");
    expect(links.every((link) => link.directFromZone)).toBe(true);
    expect(links.every((link) => link.mode === "rail")).toBe(true);
  });
});

describe("the shape the contract needs", () => {
  it("gives every link a known mode", () => {
    for (const { zoneId, link } of allLinks()) {
      expect(ZONE_AIRPORT_LINK_MODES, `${zoneId}: ${link.service}`).toContain(link.mode);
    }
  });

  it("labels every coach service `bus` and nothing else `bus`", () => {
    for (const { zoneId, link } of allLinks()) {
      const namesACoach = /autob[úu]s|limusina/i.test(link.service);
      expect(link.mode === "bus", `${zoneId}: ${link.service}`).toBe(namesACoach);
    }
  });

  it("never repeats the same airport and service within one zone", () => {
    for (const zone of ZONES) {
      const keys = zone.facts.airportLinks.map(airportLinkKey);
      expect(new Set(keys).size, zone.id).toBe(keys.length);
    }
  });

  it("allows two records for one airport, which is how both answers are told", () => {
    const twoRecords = ZONES.filter((zone) => {
      const airports = zone.facts.airportLinks.map((link) => link.airport);
      return new Set(airports).size !== airports.length;
    });
    expect(twoRecords.map((zone) => zone.id).sort()).toEqual([
      "ZN-TOK-IKEBUKURO",
      "ZN-TOK-SHINJUKU",
    ]);
  });
});

describe("the copy says which kind of journey it is", () => {
  const rail: ZoneAirportLink = {
    airport: "Narita (NRT)",
    service: "Narita Express (N'EX)",
    directFromZone: true,
    mode: "rail",
  };
  const coach: ZoneAirportLink = { ...rail, airport: "Haneda (HND)", service: "Autobús limusina", mode: "bus" };

  it("distinguishes a direct train from a direct coach", () => {
    expect(airportLinkConnection(rail)).toBe("tren directo");
    expect(airportLinkConnection(coach)).toBe("autobús directo");
    expect(airportLinkConnection(rail)).not.toBe(airportLinkConnection(coach));
  });

  it("names the change rather than calling it an 'enlace'", () => {
    expect(airportLinkConnection({ ...rail, directFromZone: false })).toBe("tren con transbordo");
    expect(airportLinkConnection({ ...coach, directFromZone: false })).toBe("autobús con transbordo");
  });

  it("never says the bare word 'directo' without saying direct by what", () => {
    for (const { link } of allLinks()) {
      const label = airportLinkConnection(link);
      expect(label, link.service).toMatch(/^(tren|autobús) (directo|con transbordo)$/);
    }
  });

  it("spells out what direct means, because the word can be read two ways", () => {
    expect(airportLinkDescription(rail)).toContain("sin transbordos");
    expect(airportLinkDescription({ ...rail, directFromZone: false })).toContain(
      "requiere al menos un transbordo"
    );
    expect(airportLinkDescription(coach)).toContain("autobús");
  });

  it("carries the airport and the service in the spelled-out sentence", () => {
    for (const { link } of allLinks()) {
      const text = airportLinkDescription(link);
      expect(text).toContain(link.airport);
      expect(text).toContain(link.service);
    }
  });

  it("keys two records for the same airport apart", () => {
    const haneda = linksOf("ZN-TOK-SHINJUKU", "Haneda");
    expect(new Set(haneda.map(airportLinkKey)).size).toBe(haneda.length);
  });

  it("ranks no mode above another", async () => {
    const code = (await readFile(new URL("./zone-airport-presentation.ts", import.meta.url), "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/mejor|peor|recomend|prefer|rápido|cómodo|score|rank/i);
  });

  it("does no arithmetic and invents no duration", async () => {
    const code = await readFile(new URL("./zone-airport-presentation.ts", import.meta.url), "utf8");
    expect(code).not.toMatch(/minuto|\bmin\b|duración|tiempo de viaje/i);
  });
});
