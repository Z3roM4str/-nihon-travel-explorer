import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  RECHECK_HORIZON_DAYS,
  TIMETABLE_CYCLE_DAYS,
  freshnessFor,
  horizonForCovers,
  needsRecheck,
  sourcesNeedingRecheck,
} from "./source-freshness";
import { ZONE_FACT_AREAS, getZones, type ZoneProvenance } from "./accommodation-zone";
import { addCivilDays } from "./civil-date";
import { todayCivilDate } from "./today";
import {
  consultedOnText,
  freshnessAccessibleText,
  recheckNote,
} from "./zone-provenance-presentation";

/**
 * Block 10 — the freshness contract.
 *
 * These tests fix the MEANING of `consultedAt` and of ageing, not today's dates. Every one passes
 * `today` explicitly: nothing here reads a clock, so none of it can start failing in March.
 */

function source(consultedAt: string, covers = ZONE_FACT_AREAS): ZoneProvenance {
  return {
    sourceUrl: "https://example.test/a",
    sourceEntity: "Example",
    consultedAt,
    evidence: "e".repeat(40),
    tier: "operator",
    covers: [...covers],
  };
}

/** Strips comments, so a vocabulary scan asserts on what the module DOES rather than on what its
 * documentation promises — the doc comment names the very things this file refuses to do. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** A date exactly `days` before `to`, so a boundary is stated rather than counted by hand. */
function daysBefore(to: string, days: number): string {
  const result = addCivilDays(to, -days);
  if (result === null) throw new Error(`bad date ${to}`);
  return result;
}

describe("the horizon comes from what a source covers", () => {
  it("gives airport links one timetable-revision cycle", () => {
    expect(RECHECK_HORIZON_DAYS.airportLinks).toBe(TIMETABLE_CYCLE_DAYS);
    expect(TIMETABLE_CYCLE_DAYS).toBe(365);
  });

  it("gives infrastructure no periodic horizon at all", () => {
    expect(RECHECK_HORIZON_DAYS.railLines).toBeNull();
    expect(RECHECK_HORIZON_DAYS.shinkansen).toBeNull();
  });

  it("covers every fact area, so a new one cannot inherit a default silently", () => {
    for (const area of ZONE_FACT_AREAS) {
      expect(Object.hasOwn(RECHECK_HORIZON_DAYS, area), area).toBe(true);
    }
    expect(Object.keys(RECHECK_HORIZON_DAYS).sort()).toEqual([...ZONE_FACT_AREAS].sort());
  });

  it("takes the strictest horizon when a source covers several areas", () => {
    expect(horizonForCovers(["railLines", "shinkansen", "airportLinks"])).toBe(TIMETABLE_CYCLE_DAYS);
    expect(horizonForCovers(["airportLinks"])).toBe(TIMETABLE_CYCLE_DAYS);
  });

  it("returns no horizon when nothing it covers has one", () => {
    expect(horizonForCovers(["railLines", "shinkansen"])).toBeNull();
    expect(horizonForCovers(["railLines"])).toBeNull();
    expect(horizonForCovers([])).toBeNull();
  });
});

describe("the boundary, stated exactly", () => {
  const today = "2027-06-15";

  it("is current the day before the horizon", () => {
    const result = freshnessFor(source(daysBefore(today, TIMETABLE_CYCLE_DAYS - 1)), today);
    expect(result.state).toBe("current");
    expect(result.ageDays).toBe(TIMETABLE_CYCLE_DAYS - 1);
  });

  it("is STILL current on the horizon itself — a cycle is over only once it is over", () => {
    const result = freshnessFor(source(daysBefore(today, TIMETABLE_CYCLE_DAYS)), today);
    expect(result.state).toBe("current");
    expect(result.ageDays).toBe(TIMETABLE_CYCLE_DAYS);
  });

  it("needs a re-check the day after the horizon", () => {
    const result = freshnessFor(source(daysBefore(today, TIMETABLE_CYCLE_DAYS + 1)), today);
    expect(result.state).toBe("needs-recheck");
    expect(result.ageDays).toBe(TIMETABLE_CYCLE_DAYS + 1);
  });

  it("is current when checked today", () => {
    expect(freshnessFor(source(today), today)).toEqual({
      state: "current",
      ageDays: 0,
      horizonDays: TIMETABLE_CYCLE_DAYS,
    });
  });

  it("reports the horizon that governed the verdict", () => {
    expect(freshnessFor(source("2027-01-01"), today).horizonDays).toBe(TIMETABLE_CYCLE_DAYS);
    expect(freshnessFor(source("2027-01-01", ["railLines"]), today).horizonDays).toBeNull();
  });
});

describe("calendar arithmetic, across the awkward edges", () => {
  it("counts across a leap day correctly", () => {
    // 2028 is a leap year: 2028-02-29 exists, so this span is 366 days.
    expect(freshnessFor(source("2027-06-15"), "2028-06-15").ageDays).toBe(366);
    expect(freshnessFor(source("2027-06-15"), "2028-06-15").state).toBe("needs-recheck");
  });

  it("counts across a non-leap year as 365 days, which is exactly current", () => {
    expect(freshnessFor(source("2025-06-15"), "2026-06-15").ageDays).toBe(365);
    expect(freshnessFor(source("2025-06-15"), "2026-06-15").state).toBe("current");
  });

  it("handles a check made on a leap day", () => {
    expect(freshnessFor(source("2028-02-29"), "2028-03-01").ageDays).toBe(1);
    expect(freshnessFor(source("2028-02-29"), "2028-03-01").state).toBe("current");
  });

  it("crosses a month boundary", () => {
    expect(freshnessFor(source("2026-01-31"), "2026-02-01").ageDays).toBe(1);
  });

  it("crosses a year boundary", () => {
    expect(freshnessFor(source("2026-12-31"), "2027-01-01").ageDays).toBe(1);
  });

  it("is deterministic — the same pair always gives the same answer", () => {
    const a = freshnessFor(source("2026-03-14"), "2027-09-30");
    const b = freshnessFor(source("2026-03-14"), "2027-09-30");
    expect(a).toEqual(b);
  });

  it("depends only on `today`, never on the machine's clock", () => {
    const old = source("2020-01-01");
    expect(freshnessFor(old, "2020-06-01").state).toBe("current");
    expect(freshnessFor(old, "2030-06-01").state).toBe("needs-recheck");
  });
});

describe("unusable dates are never reported as current", () => {
  const today = "2026-09-18";

  it("treats a future check as needing one, because it was never made", () => {
    const result = freshnessFor(source("2099-01-01"), today);
    expect(result.state).toBe("needs-recheck");
    expect(result.ageDays).toBeNull();
  });

  it("treats tomorrow the same way", () => {
    expect(freshnessFor(source("2026-09-19"), today).state).toBe("needs-recheck");
  });

  it("treats an impossible date the same way", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "2027-02-29", "", "18-09-2026", "2026-9-18"]) {
      const result = freshnessFor(source(bad), today);
      expect(result.state, bad).toBe("needs-recheck");
      expect(result.ageDays, bad).toBeNull();
    }
  });

  it("refuses to answer from an unusable `today`", () => {
    expect(freshnessFor(source("2026-01-01"), "not-a-date").state).toBe("needs-recheck");
  });
});

describe("age is not falsehood, and freshness is not authority", () => {
  it("names three states, and `unsupported` is not one of them", () => {
    const states = new Set(
      ["2026-09-18", "2000-01-01", "2026-09-18"].map(
        (d, i) => freshnessFor(source(d, i === 2 ? ["railLines"] : ZONE_FACT_AREAS), "2026-09-18").state
      )
    );
    expect(states).toEqual(new Set(["current", "needs-recheck", "no-periodic-recheck"]));
  });

  it("never claims a source stopped supporting its claim", async () => {
    const code = withoutComments(await readFile(new URL("./source-freshness.ts", import.meta.url), "utf8"));
    expect(code).not.toMatch(/"unsupported"|"invalid"|"expired"|"wrong"|"false"/);
  });

  it("says outright that a re-check is not a correction", () => {
    expect(freshnessAccessibleText("needs-recheck")).toContain("no significa que el dato sea incorrecto");
    expect(recheckNote(source("2000-01-01"), "2026-09-18")).toBe("conviene volver a comprobarla");
  });

  it("uses no alarming vocabulary anywhere in the copy", () => {
    const strings = [
      freshnessAccessibleText("current"),
      freshnessAccessibleText("no-periodic-recheck"),
      recheckNote(source("2000-01-01"), "2026-09-18") ?? "",
      consultedOnText(source("2026-09-18")),
    ];
    for (const text of strings) {
      expect(text, text).not.toMatch(/caducad|obsolet|inv[áa]lid|incorrect|error|falso|no fiable/i);
    }
  });

  it("uses the word 'incorrecto' in exactly one place: to deny it", () => {
    const denial = freshnessAccessibleText("needs-recheck");
    expect(denial).toContain("no significa que el dato sea incorrecto");
    expect(denial).not.toMatch(/caducad|obsolet|inv[áa]lid|error|falso|no fiable/i);
  });

  it("leaves the tier completely alone — authority and freshness are independent", async () => {
    // An old operator source stays an operator source; a fresh encyclopedia stays secondary.
    const stale = { ...source("2000-01-01"), tier: "operator" as const };
    const fresh = { ...source("2026-09-18"), tier: "secondary" as const };
    expect(freshnessFor(stale, "2026-09-18").state).toBe("needs-recheck");
    expect(stale.tier).toBe("operator");
    expect(freshnessFor(fresh, "2026-09-18").state).toBe("current");
    expect(fresh.tier).toBe("secondary");
    // And the module cannot even see a tier: it never reads the field.
    const code = withoutComments(await readFile(new URL("./source-freshness.ts", import.meta.url), "utf8"));
    expect(code).not.toMatch(/\btier\b/);
  });

  it("has nothing to do with editorial ratings", async () => {
    const code = withoutComments(await readFile(new URL("./source-freshness.ts", import.meta.url), "utf8"));
    expect(code).not.toMatch(/editorial|ZoneEditorial|criterio|rating/i);
  });
});

describe("nothing is stored and nothing is scheduled", () => {
  it("writes no storage and reads no clock", async () => {
    const code = withoutComments(await readFile(new URL("./source-freshness.ts", import.meta.url), "utf8"));
    expect(code).not.toMatch(/localStorage|sessionStorage|setItem|nihon\./);
    expect(code).not.toMatch(/new Date\(|Date\.now\(/);
  });

  it("derives the re-check queue rather than holding one", () => {
    const sources = [source("2000-01-01"), source("2026-09-18"), source("2000-01-01", ["railLines"])];
    const due = sourcesNeedingRecheck(sources, "2026-09-18");
    expect(due).toHaveLength(1);
    expect(due[0].consultedAt).toBe("2000-01-01");
    expect(due[0].covers).toEqual([...ZONE_FACT_AREAS]);
  });

  it("returns an empty queue when everything is current", () => {
    expect(sourcesNeedingRecheck([source("2026-09-18")], "2026-09-18")).toEqual([]);
  });

  it("agrees with `needsRecheck` for every source", () => {
    const today = "2027-01-01";
    const sources = [source("2020-01-01"), source("2027-01-01"), source("2020-01-01", ["shinkansen"])];
    expect(sourcesNeedingRecheck(sources, today)).toEqual(sources.filter((s) => needsRecheck(s, today)));
  });
});

describe("the shipped dataset, as of its own newest check", () => {
  // Anchored to a fixed date so this can never start failing with the calendar; the live verdict
  // for a reader is computed from their own `today` in the component.
  const ANCHOR = "2026-09-18";

  it("has every source under its horizon at the anchor date", () => {
    for (const zone of getZones()) {
      for (const src of [zone.facts.provenance, ...(zone.facts.sources ?? [])]) {
        expect(freshnessFor(src, ANCHOR).state, `${zone.id} ${src.sourceUrl}`).not.toBe(
          "needs-recheck"
        );
      }
    }
  });

  it("contains at least one source with no periodic horizon, which is why the model is per-area", () => {
    const withoutHorizon = getZones().flatMap((zone) =>
      [zone.facts.provenance, ...(zone.facts.sources ?? [])].filter(
        (src) => freshnessFor(src, ANCHOR).state === "no-periodic-recheck"
      )
    );
    // Namba's station article: Block 8 moved its airport link to Nankai's own page, leaving it
    // backing infrastructure alone. A real record, not a hypothetical.
    expect(withoutHorizon.length).toBeGreaterThan(0);
    expect(withoutHorizon.every((src) => !src.covers.includes("airportLinks"))).toBe(true);
  });

  it("would flag every airport-link source a day past the cycle", () => {
    const future = addCivilDays(ANCHOR, TIMETABLE_CYCLE_DAYS + 1);
    expect(future).not.toBeNull();
    const due = getZones().flatMap((zone) =>
      sourcesNeedingRecheck([zone.facts.provenance, ...(zone.facts.sources ?? [])], future!)
    );
    expect(due.length).toBeGreaterThan(0);
    expect(due.every((src) => src.covers.includes("airportLinks"))).toBe(true);
  });
});

describe("todayCivilDate is the only clock, and it is honest", () => {
  it("formats a given instant as its LOCAL calendar date", () => {
    expect(todayCivilDate(new Date(2026, 8, 18, 23, 59))).toBe("2026-09-18");
    expect(todayCivilDate(new Date(2027, 0, 1, 0, 1))).toBe("2027-01-01");
  });

  it("pads month and day", () => {
    expect(todayCivilDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("returns a date the freshness function accepts", () => {
    expect(freshnessFor(source("2026-01-01"), todayCivilDate(new Date(2026, 5, 1))).ageDays).toBe(151);
  });
});
