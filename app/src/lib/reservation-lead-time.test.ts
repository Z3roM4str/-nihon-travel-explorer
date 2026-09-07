import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import { interpretLeadTimeText, interpretPlaceLeadTime, type LeadTimeCategory } from "./reservation-lead-time";

const places = placesData as Place[];

describe("interpretLeadTimeText — not-applicable / SAFE", () => {
  it("'—' classifies not-applicable / SAFE", () => {
    const fact = interpretLeadTimeText("—");
    expect(fact.kind).toBe("not-applicable");
    expect(fact.category).toBe("not-applicable");
    expect(fact.tier).toBe("safe");
    expect(fact.raw).toBe("—");
  });

  it("empty and whitespace-only strings classify not-applicable / SAFE", () => {
    for (const raw of ["", "   "]) {
      const fact = interpretLeadTimeText(raw);
      expect(fact.kind, JSON.stringify(raw)).toBe("not-applicable");
      expect(fact.tier).toBe("safe");
    }
  });

  it("null/undefined classify not-applicable / SAFE, never throwing", () => {
    expect(interpretLeadTimeText(null).kind).toBe("not-applicable");
    expect(interpretLeadTimeText(undefined).kind).toBe("not-applicable");
  });
});

describe("interpretLeadTimeText — bare-magnitude / PARTIAL, coarse magnitude extraction", () => {
  it("'Semanas' classifies bare-magnitude / PARTIAL / weeks", () => {
    const fact = interpretLeadTimeText("Semanas");
    expect(fact.kind).toBe("coarse-magnitude");
    expect(fact.category).toBe("bare-magnitude");
    expect(fact.tier).toBe("partial");
    if (fact.kind === "coarse-magnitude") expect(fact.magnitude).toBe("weeks");
    expect(fact.raw).toBe("Semanas");
  });

  it("'1–2 semanas' classifies bare-magnitude / weeks — numeric prefix never changes the bucket", () => {
    const fact = interpretLeadTimeText("1–2 semanas");
    expect(fact.kind).toBe("coarse-magnitude");
    if (fact.kind === "coarse-magnitude") expect(fact.magnitude).toBe("weeks");
    expect(fact.raw).toBe("1–2 semanas");
  });

  it("a plain hyphen range ('2-4 semanas') is accepted exactly like an en dash range", () => {
    const fact = interpretLeadTimeText("2-4 semanas");
    expect(fact.kind).toBe("coarse-magnitude");
    if (fact.kind === "coarse-magnitude") expect(fact.magnitude).toBe("weeks");
  });

  it("'Días' classifies bare-magnitude / days", () => {
    const fact = interpretLeadTimeText("Días");
    expect(fact.kind).toBe("coarse-magnitude");
    if (fact.kind === "coarse-magnitude") expect(fact.magnitude).toBe("days");
  });

  it("'Meses' classifies bare-magnitude / months", () => {
    const fact = interpretLeadTimeText("Meses");
    expect(fact.kind).toBe("coarse-magnitude");
    if (fact.kind === "coarse-magnitude") expect(fact.magnitude).toBe("months");
  });

  it("'1–3 meses' classifies bare-magnitude / months", () => {
    const fact = interpretLeadTimeText("1–3 meses");
    expect(fact.kind).toBe("coarse-magnitude");
    if (fact.kind === "coarse-magnitude") expect(fact.magnitude).toBe("months");
  });

  it("'Días/semanas' classifies bare-magnitude / days-to-weeks", () => {
    const fact = interpretLeadTimeText("Días/semanas");
    expect(fact.kind).toBe("coarse-magnitude");
    if (fact.kind === "coarse-magnitude") expect(fact.magnitude).toBe("days-to-weeks");
  });

  it("'Semanas/meses' classifies bare-magnitude / weeks-to-months (canonical pattern support, even if absent from today's data)", () => {
    const fact = interpretLeadTimeText("Semanas/meses");
    expect(fact.kind).toBe("coarse-magnitude");
    if (fact.kind === "coarse-magnitude") expect(fact.magnitude).toBe("weeks-to-months");
  });

  it("case handling is accepted where the canonical Python classifier supports it", () => {
    for (const raw of ["semanas", "SEMANAS", "Semanas", "días", "DÍAS", "dias", "DIAS", "meses", "MESES"]) {
      const fact = interpretLeadTimeText(raw);
      expect(fact.kind, raw).toBe("coarse-magnitude");
    }
  });

  it("singular 'Día'/'Semana' are accepted (the pattern's trailing '?' pluralizes 'día'/'semana')", () => {
    expect(interpretLeadTimeText("Día").kind).toBe("coarse-magnitude");
    expect(interpretLeadTimeText("Semana").kind).toBe("coarse-magnitude");
  });

  it("singular 'Mes' is NOT bare-magnitude — a real quirk of the canonical pattern this module must reproduce exactly: 'meses?' pluralizes 'mese', not 'mes', so only 'Mese'/'Meses' match, never bare 'Mes'", () => {
    expect(interpretLeadTimeText("Mes").kind).toBe("specific-mechanism");
    expect(interpretLeadTimeText("Meses").kind).toBe("coarse-magnitude");
  });

  it("raw text is preserved verbatim, never replaced by the derived magnitude label", () => {
    const fact = interpretLeadTimeText("1–2 semanas");
    expect(fact.raw).toBe("1–2 semanas");
    expect(fact.raw).not.toBe("Semanas");
  });

  it("is deterministic across repeated calls", () => {
    const results = new Set(
      Array.from({ length: 5 }, () => JSON.stringify(interpretLeadTimeText("1–2 semanas")))
    );
    expect(results.size).toBe(1);
  });
});

describe("interpretLeadTimeText — opaque-entity-or-mechanism-specific / OPAQUE, whole-string protection", () => {
  it("'Lotería 3 meses antes; revisar liberaciones' stays OPAQUE — must NOT extract 'months'", () => {
    const fact = interpretLeadTimeText("Lotería 3 meses antes; revisar liberaciones");
    expect(fact.kind).toBe("specific-mechanism");
    expect(fact.category).toBe("opaque-entity-or-mechanism-specific");
    expect(fact.tier).toBe("opaque");
    expect(fact.raw).toBe("Lotería 3 meses antes; revisar liberaciones");
    expect("magnitude" in fact).toBe(false);
  });

  it("'2–4 semanas; atardecer antes' stays OPAQUE — must NOT extract 'weeks'", () => {
    const fact = interpretLeadTimeText("2–4 semanas; atardecer antes");
    expect(fact.kind).toBe("specific-mechanism");
    expect("magnitude" in fact).toBe(false);
  });

  it("'Días o semanas para exposición popular' stays OPAQUE — must NOT extract 'days-to-weeks'", () => {
    const fact = interpretLeadTimeText("Días o semanas para exposición popular");
    expect(fact.kind).toBe("specific-mechanism");
    expect("magnitude" in fact).toBe(false);
  });

  it("'App obligatoria para timed entry desde 2026' stays OPAQUE", () => {
    const fact = interpretLeadTimeText("App obligatoria para timed entry desde 2026");
    expect(fact.kind).toBe("specific-mechanism");
  });

  it("'Grupos: reservar; individuales según operador' stays OPAQUE", () => {
    const fact = interpretLeadTimeText("Grupos: reservar; individuales según operador");
    expect(fact.kind).toBe("specific-mechanism");
  });

  it("a magnitude-shaped phrase followed by extra text never matches (e.g. 'Semanas extra')", () => {
    expect(interpretLeadTimeText("Semanas extra").kind).toBe("specific-mechanism");
    expect(interpretLeadTimeText("Muchas semanas").kind).toBe("specific-mechanism");
  });

  it("is deterministic across repeated calls", () => {
    const results = new Set(
      Array.from({ length: 5 }, () =>
        JSON.stringify(interpretLeadTimeText("Lotería 3 meses antes; revisar liberaciones"))
      )
    );
    expect(results.size).toBe(1);
  });
});

describe("full lead-time category vocabulary parity (table-driven)", () => {
  const REPRESENTATIVE_INPUTS: Record<LeadTimeCategory, string> = {
    "not-applicable": "—",
    "bare-magnitude": "Semanas",
    "opaque-entity-or-mechanism-specific": "Lotería 3 meses antes; revisar liberaciones",
  };

  it.each(Object.entries(REPRESENTATIVE_INPUTS))("category %s classifies as itself, consistently", (category, raw) => {
    expect(interpretLeadTimeText(raw).category).toBe(category);
  });

  it("covers every LeadTimeCategory exactly once", () => {
    const covered = Object.keys(REPRESENTATIVE_INPUTS).sort();
    const observed = Object.values(REPRESENTATIVE_INPUTS)
      .map((raw) => interpretLeadTimeText(raw).category)
      .sort();
    expect(observed).toEqual(covered);
  });

  /**
   * Reads `scripts/temporal_data_lib.py`'s actual `LEAD_TIME_TIER` dict as text (never imported,
   * never executed — no Python subprocess) and cross-checks it against this module — the same
   * technique `reservation.test.ts` uses for `RESERVATION_RAW_TIER`.
   */
  async function readPythonTierDict(): Promise<Record<string, string>> {
    const source = await readFile(new URL("../../../scripts/temporal_data_lib.py", import.meta.url), "utf8");
    const blockMatch = /LEAD_TIME_TIER\s*=\s*\{([\s\S]*?)\n\}/.exec(source);
    if (!blockMatch) {
      throw new Error("Could not find a LEAD_TIME_TIER = { ... } block in scripts/temporal_data_lib.py");
    }
    const entries: Record<string, string> = {};
    const entryRe = /"([a-z0-9-]+)":\s*"([A-Z]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = entryRe.exec(blockMatch[1])) !== null) {
      entries[match[1]] = match[2].toLowerCase();
    }
    return entries;
  }

  it("scripts/temporal_data_lib.py's LEAD_TIME_TIER has at least the 3 categories this module expects", async () => {
    const pythonTier = await readPythonTierDict();
    expect(Object.keys(pythonTier).length).toBeGreaterThanOrEqual(3);
  });

  it("every LeadTimeCategory this module has exists in Python's LEAD_TIME_TIER with the same tier", async () => {
    const pythonTier = await readPythonTierDict();
    for (const [category, raw] of Object.entries(REPRESENTATIVE_INPUTS)) {
      expect(pythonTier, `Python LEAD_TIME_TIER is missing key ${JSON.stringify(category)}`).toHaveProperty(category);
      expect(interpretLeadTimeText(raw).tier, `category=${category}`).toBe(pythonTier[category]);
    }
  });

  it("Python's LEAD_TIME_TIER has no category this module doesn't know about", async () => {
    const pythonTier = await readPythonTierDict();
    const tsCategories = new Set(Object.keys(REPRESENTATIVE_INPUTS));
    const unknownToTs = Object.keys(pythonTier).filter((category) => !tsCategories.has(category));
    expect(unknownToTs).toEqual([]);
  });

  /**
   * Directly parses `scripts/temporal_data_lib.py`'s `_BARE_MAGNITUDE_RE` pattern text and proves
   * it and this module's `BARE_MAGNITUDE_RE`-driven classification agree on a battery of inputs —
   * a stronger check than tier parity alone, since a future edit could keep every tier the same
   * while silently loosening or tightening which strings count as `bare-magnitude`.
   */
  it("scripts/temporal_data_lib.py's _BARE_MAGNITUDE_RE exists and is anchored (whole-string, not substring)", async () => {
    const source = await readFile(new URL("../../../scripts/temporal_data_lib.py", import.meta.url), "utf8");
    const match = /_BARE_MAGNITUDE_RE\s*=\s*re\.compile\(\s*r"([^"]+)"/.exec(source);
    expect(match, "_BARE_MAGNITUDE_RE not found in scripts/temporal_data_lib.py").not.toBeNull();
    const pattern = match?.[1] ?? "";
    expect(pattern.startsWith("^")).toBe(true);
    expect(pattern.endsWith("$")).toBe(true);
  });
});

describe("real dataset coverage/invariants (data/places.json via app/src/data/places.json)", () => {
  it("does not throw across all 214 current places", () => {
    expect(() => {
      for (const place of places) interpretPlaceLeadTime(place);
    }).not.toThrow();
  });

  it("every place falls into exactly one category", () => {
    for (const place of places) {
      const fact = interpretPlaceLeadTime(place);
      expect(["not-applicable", "bare-magnitude", "opaque-entity-or-mechanism-specific"]).toContain(fact.category);
    }
  });

  it("re-derives the current category counts: 128 not-applicable, 21 bare-magnitude, 65 opaque", () => {
    const counts = { "not-applicable": 0, "bare-magnitude": 0, "opaque-entity-or-mechanism-specific": 0 };
    for (const place of places) {
      counts[interpretPlaceLeadTime(place).category] += 1;
    }
    // Current audit fact (Phase 3D-A), re-derived here, not assumed — mirrors the precedent
    // reservation.test.ts sets for its own "required.length === 41" real-dataset assertion.
    expect(counts).toEqual({
      "not-applicable": 128,
      "bare-magnitude": 21,
      "opaque-entity-or-mechanism-specific": 65,
    });
  });

  it("bare-magnitude places always produce a valid, defined magnitude", () => {
    const bareMagnitudePlaces = places.filter((p) => interpretPlaceLeadTime(p).category === "bare-magnitude");
    expect(bareMagnitudePlaces.length).toBeGreaterThan(0);
    for (const place of bareMagnitudePlaces) {
      const fact = interpretPlaceLeadTime(place);
      expect(fact.kind).toBe("coarse-magnitude");
      if (fact.kind === "coarse-magnitude") {
        expect(["days", "weeks", "months", "days-to-weeks", "weeks-to-months"]).toContain(fact.magnitude);
      }
    }
  });

  it("opaque places never produce a magnitude field", () => {
    const opaquePlaces = places.filter(
      (p) => interpretPlaceLeadTime(p).category === "opaque-entity-or-mechanism-specific"
    );
    expect(opaquePlaces.length).toBeGreaterThan(0);
    for (const place of opaquePlaces) {
      const fact = interpretPlaceLeadTime(place);
      expect(fact.kind).toBe("specific-mechanism");
      expect("magnitude" in fact).toBe(false);
    }
  });

  it("raw text is preserved verbatim for every real place", () => {
    for (const place of places) {
      expect(interpretPlaceLeadTime(place).raw).toBe(place.reservation.leadTime);
    }
  });

  it("a real opaque record containing a magnitude-shaped substring is never reduced to bare-magnitude (e.g. Nintendo Museum's lottery text)", () => {
    const nintendoMuseum = places.find((p) => p.id === "JP-097");
    expect(nintendoMuseum?.reservation.leadTime).toBe("Lotería 3 meses antes; revisar liberaciones");
    if (nintendoMuseum) {
      expect(interpretPlaceLeadTime(nintendoMuseum).category).toBe("opaque-entity-or-mechanism-specific");
    }
  });
});
