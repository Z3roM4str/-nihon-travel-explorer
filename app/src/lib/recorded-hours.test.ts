import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import { interpretHoursText, interpretPlaceHours, type HoursCategory } from "./recorded-hours";

const places = placesData as Place[];

/**
 * One representative raw string per `HoursCategory` this module distinguishes, and the
 * `RecordedHoursFact["kind"]` each one must produce. Mirrors the precedent
 * `temporal-availability.test.ts` set for `ClosureCategory`: this table is the single source of
 * truth for the table-driven parity test below AND the source-scanning check against
 * `scripts/temporal_data_lib.py`'s actual `HOURS_TIER` keys, so the two can never silently drift
 * apart. Every raw string here is either a real value from `docs/TEMPORAL_DATA_CONTRACT.md`'s
 * worked examples or one of the adversarial priority examples the Phase 3D-E brief names by name.
 */
const REPRESENTATIVE_HOURS_INPUTS: Record<HoursCategory, { raw: string; kind: string }> = {
  missing: { raw: "", kind: "unknown" },
  "known-24h": { raw: "Espacio público 24 h", kind: "recorded-24h" },
  "known-24h-with-caveat": { raw: "Abierto 24 h; puede cerrar por viento", kind: "conditional" },
  "weather-or-tide-dependent": { raw: "Ferry estacional y meteorológico", kind: "external-dependency" },
  "third-party-operator-dependent": { raw: "Según tienda, aprox. 11:00–20:00", kind: "external-dependency" },
  "seasonal-variable": { raw: "09:00–16:00/17:30 según temporada", kind: "conditional" },
  "solar-relative": { raw: "Amanecer–atardecer; varía por mes", kind: "conditional" },
  "daytime-qualitative": { raw: "Diurno", kind: "conditional" },
  "partial-single-bound": { raw: "Muy temprano–14:00 aprox.", kind: "conditional" },
  "ambiguous-alternative-interval": { raw: "09:00–16:00/16:30", kind: "conditional" },
  "fixed-interval-with-caveat": { raw: "10:00–17:00 aprox.; verificar exposición", kind: "conditional" },
  "fixed-interval-clean": { raw: "09:00–17:00", kind: "recorded-interval" },
  "explicit-unknown-variable": { raw: "Variable por fecha", kind: "unknown" },
  "qualitative-uncategorized": { raw: "Tours en horas fijas", kind: "unknown" },
};

describe("interpretHoursText — SAFE categories", () => {
  it("'09:00–17:00' is a SAFE recorded-interval, with the interval preserved", () => {
    const fact = interpretHoursText("09:00–17:00");
    expect(fact.kind).toBe("recorded-interval");
    expect(fact.tier).toBe("safe");
    expect(fact.category).toBe("fixed-interval-clean");
    if (fact.kind === "recorded-interval") {
      expect(fact.intervalRaw).toBe("09:00–17:00");
    }
    expect(fact.raw).toBe("09:00–17:00");
  });

  it("'Aprox. 09:00–20:00' extracts just the interval token, not the 'Aprox.' prefix", () => {
    const fact = interpretHoursText("Aprox. 09:00–20:00");
    expect(fact.kind).toBe("recorded-interval");
    if (fact.kind === "recorded-interval") {
      expect(fact.intervalRaw).toBe("09:00–20:00");
    }
    expect(fact.raw).toBe("Aprox. 09:00–20:00");
  });

  it("'Espacio público 24 h' is a SAFE recorded-24h fact", () => {
    const fact = interpretHoursText("Espacio público 24 h");
    expect(fact.kind).toBe("recorded-24h");
    expect(fact.tier).toBe("safe");
    expect(fact.category).toBe("known-24h");
    expect(fact).not.toHaveProperty("intervalRaw");
  });
});

describe("interpretHoursText — PARTIAL categories stay conditional", () => {
  const partialCases: Array<[string, HoursCategory]> = [
    ["Abierto 24 h; puede cerrar por viento", "known-24h-with-caveat"],
    ["09:00–16:00/17:30 según temporada", "seasonal-variable"],
    ["10:00–17:00 aprox.; verificar exposición", "fixed-interval-with-caveat"],
    ["Diurno", "daytime-qualitative"],
    ["Amanecer–atardecer; varía por mes", "solar-relative"],
    ["09:00–16:00/16:30", "ambiguous-alternative-interval"],
    ["Muy temprano–14:00 aprox.", "partial-single-bound"],
  ];

  it.each(partialCases)("'%s' classifies as %s, tier partial, kind conditional", (raw, category) => {
    const fact = interpretHoursText(raw);
    expect(fact.kind).toBe("conditional");
    expect(fact.tier).toBe("partial");
    expect(fact.category).toBe(category);
    expect(fact.raw).toBe(raw);
  });

  it("no PARTIAL fact ever carries an intervalRaw field", () => {
    for (const [raw] of partialCases) {
      expect(interpretHoursText(raw)).not.toHaveProperty("intervalRaw");
    }
  });
});

describe("interpretHoursText — OPAQUE categories never expose a parsed interval", () => {
  it("'Ferry estacional y meteorológico' is weather-or-tide-dependent, OPAQUE, no interval", () => {
    const fact = interpretHoursText("Ferry estacional y meteorológico");
    expect(fact.kind).toBe("external-dependency");
    expect(fact.tier).toBe("opaque");
    expect(fact.category).toBe("weather-or-tide-dependent");
    expect(fact).not.toHaveProperty("intervalRaw");
  });

  it("'Según tienda, aprox. 11:00–20:00' is third-party-operator-dependent, NOT a fixed interval", () => {
    const fact = interpretHoursText("Según tienda, aprox. 11:00–20:00");
    expect(fact.kind).toBe("external-dependency");
    expect(fact.tier).toBe("opaque");
    expect(fact.category).toBe("third-party-operator-dependent");
    expect(fact).not.toHaveProperty("intervalRaw");
    // The clock-looking substring is still visible in raw — just never promoted to a structured
    // SAFE fact.
    expect(fact.raw).toContain("11:00–20:00");
  });
});

describe("interpretHoursText — UNKNOWN categories stay unknown, never promoted", () => {
  it("'Variable por fecha' is explicit-unknown-variable, UNKNOWN", () => {
    const fact = interpretHoursText("Variable por fecha");
    expect(fact.kind).toBe("unknown");
    expect(fact.tier).toBe("unknown");
    expect(fact.category).toBe("explicit-unknown-variable");
  });

  it("'Tours en horas fijas' is qualitative-uncategorized, UNKNOWN", () => {
    const fact = interpretHoursText("Tours en horas fijas");
    expect(fact.kind).toBe("unknown");
    expect(fact.tier).toBe("unknown");
    expect(fact.category).toBe("qualitative-uncategorized");
  });

  it("missing/empty text classifies as UNKNOWN, never guessed", () => {
    for (const raw of [null, undefined, "", "   "]) {
      const fact = interpretHoursText(raw);
      expect(fact.kind, String(raw)).toBe("unknown");
      expect(fact.category, String(raw)).toBe("missing");
      expect(fact.tier, String(raw)).toBe("unknown");
    }
  });
});

describe("interpretHoursText — adversarial priority order (load-bearing, not incidental)", () => {
  it("a 24h claim plus a weather caveat is known-24h-with-caveat, NOT plain known-24h", () => {
    const fact = interpretHoursText("Abierto 24 h; puede cerrar por viento");
    expect(fact.category).toBe("known-24h-with-caveat");
    expect(fact.category).not.toBe("known-24h");
    expect(fact.tier).toBe("partial");
  });

  it("a 24h claim plus a variable-commerce caveat is known-24h-with-caveat", () => {
    const fact = interpretHoursText("Estación 24 h; comercios variables");
    expect(fact.category).toBe("known-24h-with-caveat");
    expect(fact.tier).toBe("partial");
  });

  it("third-party dependency outranks a clock-shaped substring in the same string", () => {
    const fact = interpretHoursText("Según tienda, aprox. 11:00–20:00");
    expect(fact.category).toBe("third-party-operator-dependent");
    expect(fact.category).not.toBe("fixed-interval-clean");
  });

  it("weather/tide dependency outranks a seasonal-shaped substring in the same string", () => {
    // "Ferry estacional y meteorológico" contains both "estacional" (seasonal-family wording)
    // and "meteorológico" (weather) — ENV_RE is checked first in classify_hours, so weather wins.
    const fact = interpretHoursText("Ferry estacional y meteorológico");
    expect(fact.category).toBe("weather-or-tide-dependent");
    expect(fact.category).not.toBe("seasonal-variable");
  });

  it("a genuinely unrelated 'estación' (station) does not falsely trigger seasonal-variable", () => {
    // "Estación" (train station) must not be confused with "estacional" (seasonal) — the caveat
    // in 'Estación 24 h; comercios variables' is real, but it comes from VARIABLE_RE (comercios
    // variables), not a false SEASONAL_RE match on "Estación" itself.
    const fact = interpretHoursText("Estación 24 h");
    expect(fact.category).toBe("known-24h");
  });

  it("an alternative-interval slash outranks plain fixed-interval-clean", () => {
    const fact = interpretHoursText("09:00–16:00/16:30");
    expect(fact.category).toBe("ambiguous-alternative-interval");
    expect(fact.category).not.toBe("fixed-interval-clean");
  });

  it("a caveat clause (';'/'verificar'/'variable') outranks plain fixed-interval-clean", () => {
    const fact = interpretHoursText("10:00–17:00 aprox.; verificar exposición");
    expect(fact.category).toBe("fixed-interval-with-caveat");
    expect(fact.category).not.toBe("fixed-interval-clean");
  });

  it("a solar-relative phrase with no clock digits is solar-relative, not qualitative-uncategorized", () => {
    const fact = interpretHoursText("Amanecer–atardecer; varía por mes");
    expect(fact.category).toBe("solar-relative");
  });

  it("a single unmatched clock time is partial-single-bound, not fixed-interval-clean", () => {
    const fact = interpretHoursText("Muy temprano–14:00 aprox.");
    expect(fact.category).toBe("partial-single-bound");
    expect(fact.category).not.toBe("fixed-interval-clean");
  });
});

describe("full hours-category vocabulary parity (table-driven)", () => {
  it.each(Object.entries(REPRESENTATIVE_HOURS_INPUTS))(
    "category %s classifies with the expected kind and category",
    (category, { raw, kind }) => {
      const fact = interpretHoursText(raw);
      expect(fact.kind, `raw=${JSON.stringify(raw)}`).toBe(kind);
      expect(fact.category, `raw=${JSON.stringify(raw)}`).toBe(category);
    }
  );

  it("covers every HoursCategory exactly once — no category missing, none invented", () => {
    const covered = Object.keys(REPRESENTATIVE_HOURS_INPUTS).sort();
    const observed = Object.values(REPRESENTATIVE_HOURS_INPUTS)
      .map(({ raw }) => interpretHoursText(raw).category)
      .sort();
    expect(observed).toEqual(covered);
  });

  it("raw text is preserved verbatim on every fact kind", () => {
    for (const { raw } of Object.values(REPRESENTATIVE_HOURS_INPUTS)) {
      expect(interpretHoursText(raw).raw).toBe(raw);
    }
  });

  it("is deterministic across repeated calls", () => {
    for (const { raw } of Object.values(REPRESENTATIVE_HOURS_INPUTS)) {
      const results = new Set(Array.from({ length: 5 }, () => JSON.stringify(interpretHoursText(raw))));
      expect(results.size, raw).toBe(1);
    }
  });
});

/**
 * Reads `scripts/temporal_data_lib.py`'s actual `HOURS_TIER` dict as text (never imported, never
 * executed — this is a Node test file, not a Python runtime dependency) and parses its
 * `"category": "TIER"` entries. Same subprocess-free auto-detection technique
 * `temporal-availability.test.ts` established for `CLOSURES_TIER`: a future edit that renames,
 * adds, or removes a category on either side of the language boundary without updating the other
 * fails this test immediately.
 */
async function readPythonHoursTier(): Promise<Record<string, string>> {
  const source = await readFile(new URL("../../../scripts/temporal_data_lib.py", import.meta.url), "utf8");
  const blockMatch = /HOURS_TIER\s*=\s*\{([\s\S]*?)\n\}/.exec(source);
  if (!blockMatch) {
    throw new Error("Could not find a HOURS_TIER = { ... } block in scripts/temporal_data_lib.py");
  }
  const entries: Record<string, string> = {};
  const entryRe = /"([a-z0-9-]+)":\s*"([A-Z]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(blockMatch[1])) !== null) {
    entries[match[1]] = match[2].toLowerCase();
  }
  return entries;
}

describe("cross-language parity source-check (no subprocess, text-only)", () => {
  it("scripts/temporal_data_lib.py's HOURS_TIER has at least the categories this module expects", async () => {
    const pythonTier = await readPythonHoursTier();
    expect(Object.keys(pythonTier).length).toBeGreaterThanOrEqual(14);
  });

  it("every HoursCategory this module has exists in the Python HOURS_TIER with the same tier", async () => {
    const pythonTier = await readPythonHoursTier();
    for (const [category, { raw }] of Object.entries(REPRESENTATIVE_HOURS_INPUTS)) {
      expect(pythonTier, `Python HOURS_TIER is missing key ${JSON.stringify(category)}`).toHaveProperty(category);
      const fact = interpretHoursText(raw);
      expect(fact.tier, `category=${category}`).toBe(pythonTier[category]);
    }
  });

  it("the Python HOURS_TIER has no category this module doesn't know about", async () => {
    const pythonTier = await readPythonHoursTier();
    const tsCategories = new Set(Object.keys(REPRESENTATIVE_HOURS_INPUTS));
    const unknownToTs = Object.keys(pythonTier).filter((category) => !tsCategories.has(category));
    expect(unknownToTs).toEqual([]);
  });

  it("also verifies against HOURS_RULES' family ordering: known-24h-family is checked before the caveat-triggering families", async () => {
    // HOURS_RULES exposes ordered (category, predicate) pairs; the load-bearing guarantee this
    // module must preserve is that the 24h-family check (and its internal caveat check) runs
    // before weather/third-party/seasonal are evaluated as *primary* categories — proven above by
    // the adversarial-priority describe block, and cross-checked here only for the family-label
    // ordering itself so a reordering of HOURS_RULES's tuple list would be caught structurally.
    const source = await readFile(new URL("../../../scripts/temporal_data_lib.py", import.meta.url), "utf8");
    const rulesMatch = /HOURS_RULES[^=]*=\s*\[([\s\S]*?)\n\]/.exec(source);
    expect(rulesMatch).not.toBeNull();
    const ruleNames = [...(rulesMatch?.[1].matchAll(/\(\s*"([a-z0-9-]+)"/g) ?? [])].map((m) => m[1]);
    expect(ruleNames[0]).toBe("missing");
    expect(ruleNames.indexOf("known-24h-family")).toBeLessThan(ruleNames.indexOf("weather-or-tide-dependent"));
    expect(ruleNames.indexOf("weather-or-tide-dependent")).toBeLessThan(
      ruleNames.indexOf("third-party-operator-dependent")
    );
    expect(ruleNames.indexOf("third-party-operator-dependent")).toBeLessThan(ruleNames.indexOf("seasonal-variable"));
    expect(ruleNames.indexOf("seasonal-variable")).toBeLessThan(ruleNames.indexOf("solar-relative"));
    expect(ruleNames.indexOf("solar-relative")).toBeLessThan(ruleNames.indexOf("daytime-qualitative"));
    expect(ruleNames.indexOf("daytime-qualitative")).toBeLessThan(ruleNames.indexOf("fixed-interval-family"));
    expect(ruleNames.indexOf("fixed-interval-family")).toBeLessThan(ruleNames.indexOf("partial-single-bound"));
    expect(ruleNames.indexOf("partial-single-bound")).toBeLessThan(ruleNames.indexOf("explicit-unknown-variable"));
    expect(ruleNames.indexOf("explicit-unknown-variable")).toBeLessThan(
      ruleNames.indexOf("qualitative-uncategorized")
    );
  });
});

describe("real dataset coverage/invariants (data/places.json via app/src/data/places.json)", () => {
  it("does not throw across all current places' schedule.hours", () => {
    expect(() => {
      for (const place of places) interpretPlaceHours(place);
    }).not.toThrow();
  });

  it("re-derives the current whole-dataset tier totals: SAFE 80, PARTIAL 50, OPAQUE 19, UNKNOWN 65 of 214", () => {
    let safe = 0;
    let partial = 0;
    let opaque = 0;
    let unknown = 0;
    for (const place of places) {
      const fact = interpretPlaceHours(place);
      if (fact.tier === "safe") safe += 1;
      else if (fact.tier === "partial") partial += 1;
      else if (fact.tier === "opaque") opaque += 1;
      else unknown += 1;
    }
    expect({ safe, partial, opaque, unknown, total: safe + partial + opaque + unknown }).toEqual({
      safe: 80,
      partial: 50,
      opaque: 19,
      unknown: 65,
      total: 214,
    });
  });

  it("no place has a missing schedule.hours in the current dataset", () => {
    const missing = places.filter((p) => interpretPlaceHours(p).category === "missing");
    expect(missing).toHaveLength(0);
  });

  it("every recorded-interval fact's intervalRaw is a substring of its own raw", () => {
    for (const place of places) {
      const fact = interpretPlaceHours(place);
      if (fact.kind === "recorded-interval") {
        expect(fact.raw).toContain(fact.intervalRaw);
      }
    }
  });

  it("no external-dependency or conditional/unknown fact ever carries an intervalRaw field", () => {
    for (const place of places) {
      const fact = interpretPlaceHours(place);
      if (fact.kind !== "recorded-interval") {
        expect(fact).not.toHaveProperty("intervalRaw");
      }
    }
  });

  it("real fixed-interval-clean places exist and produce a real interval token", () => {
    const clean = places.filter((p) => interpretPlaceHours(p).category === "fixed-interval-clean");
    expect(clean.length).toBeGreaterThan(0);
    for (const place of clean) {
      const fact = interpretPlaceHours(place);
      if (fact.kind === "recorded-interval") {
        expect(fact.intervalRaw).toMatch(/\d{1,2}:\d{2}/);
      }
    }
  });

  it("real known-24h-with-caveat places exist and never surface as plain known-24h", () => {
    const caveated = places.filter((p) => interpretPlaceHours(p).category === "known-24h-with-caveat");
    expect(caveated.length).toBeGreaterThan(0);
    for (const place of caveated) {
      expect(interpretPlaceHours(place).kind).toBe("conditional");
    }
  });

  it("real third-party-operator-dependent places exist and never expose a parsed interval", () => {
    const thirdParty = places.filter((p) => interpretPlaceHours(p).category === "third-party-operator-dependent");
    expect(thirdParty.length).toBeGreaterThan(0);
    for (const place of thirdParty) {
      expect(interpretPlaceHours(place)).not.toHaveProperty("intervalRaw");
    }
  });
});
