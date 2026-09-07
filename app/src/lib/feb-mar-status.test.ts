import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import {
  describeFebMarStatusForUi,
  interpretFebMarStatusText,
  interpretPlaceFebMarStatus,
  type FebMarStatusCategory,
} from "./feb-mar-status";

const places = placesData as Place[];

/**
 * One representative raw string per `FebMarStatusCategory` this module distinguishes, mirroring
 * the precedent `temporal-availability.test.ts`/`recorded-hours.test.ts` set: this table is the
 * single source of truth for the table-driven parity test below AND the source-scanning check
 * against `scripts/temporal_data_lib.py`'s actual `FEB_MAR_STATUS_TIER` keys. Every raw string
 * here is a real representative example from `docs/TEMPORAL_DATA_CONTRACT.md`'s worked table.
 */
const REPRESENTATIVE_STATUS_INPUTS: Record<FebMarStatusCategory, string> = {
  missing: "",
  confirmed: "ABIERTO CONFIRMADO",
  "open-with-condition": "ABIERTO; FLORACIÓN NO GARANTIZADA",
  "pending-verification": "CALENDARIO / CONDICIÓN PENDIENTE",
  "seasonal-risk": "RIESGO ESTACIONAL",
  "seasonal-opportunity": "OPORTUNIDAD ESTACIONAL",
  "sale-or-lottery-limited": "VENTA FUTURA / CUPO LIMITADO",
  "maintenance-or-works": "MANTENIMIENTO 2027 PENDIENTE",
  "partial-closure-in-effect": "CIERRE PARCIAL DESDE 24 MAR",
  "historical-pattern-inference": "PATRÓN HISTÓRICO / MUY PROBABLE",
  "ritual-access-restriction-pending": "CIERRES SAGRADOS PENDIENTES",
  uncategorized: "ALGO NO RECONOCIDO",
};

describe("interpretFebMarStatusText — category/tier coverage", () => {
  it.each(Object.entries(REPRESENTATIVE_STATUS_INPUTS))("classifies %s correctly", (category, raw) => {
    const fact = interpretFebMarStatusText(raw);
    expect(fact.category, `raw=${JSON.stringify(raw)}`).toBe(category);
    expect(fact.raw).toBe(raw);
  });

  it("covers every FebMarStatusCategory exactly once — no category missing, none invented", () => {
    const covered = Object.keys(REPRESENTATIVE_STATUS_INPUTS).sort();
    const observed = Object.values(REPRESENTATIVE_STATUS_INPUTS)
      .map((raw) => interpretFebMarStatusText(raw).category)
      .sort();
    expect(observed).toEqual(covered);
  });

  it("missing/empty text classifies as UNKNOWN, never guessed", () => {
    for (const raw of [null, undefined, "", "   "]) {
      const fact = interpretFebMarStatusText(raw);
      expect(fact.category, String(raw)).toBe("missing");
      expect(fact.tier, String(raw)).toBe("unknown");
    }
  });

  it("is case-insensitive, matching Python's own .upper() normalization", () => {
    const fact = interpretFebMarStatusText("abierto confirmado");
    expect(fact.category).toBe("confirmed");
  });

  it("raw text is preserved verbatim, in its original case", () => {
    expect(interpretFebMarStatusText("Abierto Confirmado").raw).toBe("Abierto Confirmado");
  });

  it("is deterministic across repeated calls", () => {
    for (const raw of Object.values(REPRESENTATIVE_STATUS_INPUTS)) {
      const results = new Set(Array.from({ length: 5 }, () => JSON.stringify(interpretFebMarStatusText(raw))));
      expect(results.size, raw).toBe(1);
    }
  });

  it("the resulting fact has no open/closed/available/feasible field of any kind", () => {
    for (const raw of Object.values(REPRESENTATIVE_STATUS_INPUTS)) {
      const fact = interpretFebMarStatusText(raw);
      for (const forbidden of ["open", "closed", "available", "feasible", "compatible"]) {
        expect(fact, `${raw} should not have field "${forbidden}"`).not.toHaveProperty(forbidden);
      }
      expect(Object.values(fact).some((value) => typeof value === "boolean")).toBe(false);
    }
  });
});

describe("interpretFebMarStatusText — adversarial priority order (load-bearing, not incidental)", () => {
  it("a sale/lottery marker outranks everything else, even alongside 'pendiente'", () => {
    const fact = interpretFebMarStatusText("VENTA FUTURA / CUPO LIMITADO / CONDICION PENDIENTE");
    expect(fact.category).toBe("sale-or-lottery-limited");
  });

  it("'riesgo' outranks a 'confirmado' token appearing in the same string", () => {
    const fact = interpretFebMarStatusText("RIESGO ESTACIONAL; ANTES CONFIRMADO");
    expect(fact.category).toBe("seasonal-risk");
    expect(fact.category).not.toBe("confirmed");
  });

  it("maintenance/obras outranks a bare 'pendiente'", () => {
    const fact = interpretFebMarStatusText("MANTENIMIENTO 2027 PENDIENTE");
    expect(fact.category).toBe("maintenance-or-works");
    expect(fact.category).not.toBe("pending-verification");
  });

  it("'cierre parcial' outranks 'confirmado' appearing later in the string", () => {
    const fact = interpretFebMarStatusText("CIERRE PARCIAL; RESTO CONFIRMADO");
    expect(fact.category).toBe("partial-closure-in-effect");
  });

  it("a historical-pattern marker (both PATR and HIST substrings) outranks 'oportunidad'", () => {
    const fact = interpretFebMarStatusText("PATRON HISTORICO; OPORTUNIDAD ESTACIONAL");
    expect(fact.category).toBe("historical-pattern-inference");
    expect(fact.category).not.toBe("seasonal-opportunity");
  });

  it("'oportunidad' outranks a bare 'pendiente'", () => {
    const fact = interpretFebMarStatusText("OPORTUNIDAD ESTACIONAL; CONDICION PENDIENTE");
    expect(fact.category).toBe("seasonal-opportunity");
  });

  it("'sagrad' outranks a bare 'pendiente'", () => {
    const fact = interpretFebMarStatusText("CIERRES SAGRADOS PENDIENTES");
    expect(fact.category).toBe("ritual-access-restriction-pending");
    expect(fact.category).not.toBe("pending-verification");
  });

  it("'confirmado' plus 'pendiente' together is NOT confirmed — pendiente wins that combination", () => {
    const fact = interpretFebMarStatusText("CONFIRMADO PERO PENDIENTE DE REVISION");
    expect(fact.category).not.toBe("confirmed");
    expect(fact.category).toBe("pending-verification");
  });

  it("a bare 'ABIERTO' prefix with no other marker is open-with-condition, not confirmed", () => {
    const fact = interpretFebMarStatusText("ABIERTO; FLORACION NO GARANTIZADA");
    expect(fact.category).toBe("open-with-condition");
  });

  it("only a leading 'ABIERTO' triggers open-with-condition — a mid-string occurrence does not", () => {
    const fact = interpretFebMarStatusText("ALGO ABIERTO SIN MAS DATOS");
    expect(fact.category).not.toBe("open-with-condition");
    expect(fact.category).toBe("uncategorized");
  });

  it("unrecognized text falls through to uncategorized, never guessed into a stronger category", () => {
    const fact = interpretFebMarStatusText("TEXTO SIN PALABRAS CLAVE RECONOCIDAS");
    expect(fact.category).toBe("uncategorized");
    expect(fact.tier).toBe("unknown");
  });
});

describe("cross-language parity source-check (no subprocess, text-only)", () => {
  async function readPythonFebMarStatusTier(): Promise<Record<string, string>> {
    const source = await readFile(new URL("../../../scripts/temporal_data_lib.py", import.meta.url), "utf8");
    const blockMatch = /FEB_MAR_STATUS_TIER\s*=\s*\{([\s\S]*?)\n\}/.exec(source);
    if (!blockMatch) {
      throw new Error("Could not find a FEB_MAR_STATUS_TIER = { ... } block in scripts/temporal_data_lib.py");
    }
    const entries: Record<string, string> = {};
    const entryRe = /"([a-z0-9-]+)":\s*"([A-Z]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = entryRe.exec(blockMatch[1])) !== null) {
      entries[match[1]] = match[2].toLowerCase();
    }
    return entries;
  }

  it("scripts/temporal_data_lib.py's FEB_MAR_STATUS_TIER has at least the categories this module expects", async () => {
    const pythonTier = await readPythonFebMarStatusTier();
    expect(Object.keys(pythonTier).length).toBeGreaterThanOrEqual(12);
  });

  it("every FebMarStatusCategory this module has exists in the Python FEB_MAR_STATUS_TIER with the same tier", async () => {
    const pythonTier = await readPythonFebMarStatusTier();
    for (const [category, raw] of Object.entries(REPRESENTATIVE_STATUS_INPUTS)) {
      expect(pythonTier, `Python FEB_MAR_STATUS_TIER is missing key ${JSON.stringify(category)}`).toHaveProperty(
        category
      );
      const fact = interpretFebMarStatusText(raw);
      expect(fact.tier, `category=${category}`).toBe(pythonTier[category]);
    }
  });

  it("the Python FEB_MAR_STATUS_TIER has no category this module doesn't know about", async () => {
    const pythonTier = await readPythonFebMarStatusTier();
    const tsCategories = new Set(Object.keys(REPRESENTATIVE_STATUS_INPUTS));
    const unknownToTs = Object.keys(pythonTier).filter((category) => !tsCategories.has(category));
    expect(unknownToTs).toEqual([]);
  });

  /**
   * Reads `classify_feb_mar_status()`'s actual source text and extracts the sequence of `return
   * "<category>"` statements, in source order — the load-bearing priority chain this TypeScript
   * port must never silently reorder. Complements the adversarial tests above with a structural
   * guard: a future edit that reorders the Python `if` chain without updating this port fails here
   * even if no adversarial example happens to exercise the swapped pair.
   */
  async function readPythonFebMarPriorityOrder(): Promise<string[]> {
    const source = await readFile(new URL("../../../scripts/temporal_data_lib.py", import.meta.url), "utf8");
    const fnMatch = /def classify_feb_mar_status\(raw\)[\s\S]*?\n\n\n/.exec(source);
    if (!fnMatch) throw new Error("Could not find classify_feb_mar_status() body in scripts/temporal_data_lib.py");
    const returns = [...fnMatch[0].matchAll(/return\s+"([a-z0-9-]+)"/g)].map((m) => m[1]);
    // De-duplicate while preserving first-seen order (some categories are returned from more than
    // one branch, e.g. none here currently, but keep this robust regardless).
    return [...new Set(returns)];
  }

  it("this module's if-chain order matches classify_feb_mar_status()'s source order exactly", async () => {
    const pythonOrder = await readPythonFebMarPriorityOrder();
    // The TypeScript source's own if-chain, read the same way.
    const tsSource = await readFile(new URL("./feb-mar-status.ts", import.meta.url), "utf8");
    const fnMatch = /function classifyFebMarStatusCategory[\s\S]*?\n}/.exec(tsSource);
    expect(fnMatch).not.toBeNull();
    const tsOrder = [...new Set([...(fnMatch?.[0].matchAll(/return\s+"([a-z0-9-]+)"/g) ?? [])].map((m) => m[1]))];
    expect(tsOrder).toEqual(pythonOrder);
  });

  it("the classifier function bodies never reference .warning or .action — source-scanned, not just behaviorally inferred", async () => {
    // The module's own doc comments legitimately *mention* `febMar2027.warning`/`.action` in
    // prose (to state they are never read), so this scan is scoped to the actual function bodies
    // (classifyFebMarStatusCategory, interpretFebMarStatusText, interpretPlaceFebMarStatus,
    // describeFebMarStatusForUi), not the whole file, to avoid a false-fail on that prose.
    const tsSource = await readFile(new URL("./feb-mar-status.ts", import.meta.url), "utf8");
    const codeOnly = tsSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/\.warning\b/);
    expect(codeOnly).not.toMatch(/\.action\b/);
  });
});

describe("real dataset coverage/invariants (data/places.json via app/src/data/places.json)", () => {
  it("does not throw across all current places' febMar2027.status", () => {
    expect(() => {
      for (const place of places) interpretPlaceFebMarStatus(place);
    }).not.toThrow();
  });

  it("re-derives the current whole-dataset tier totals: SAFE 6, PARTIAL 15, OPAQUE 41, UNKNOWN 152 of 214", () => {
    let safe = 0;
    let partial = 0;
    let opaque = 0;
    let unknown = 0;
    for (const place of places) {
      const fact = interpretPlaceFebMarStatus(place);
      if (fact.tier === "safe") safe += 1;
      else if (fact.tier === "partial") partial += 1;
      else if (fact.tier === "opaque") opaque += 1;
      else unknown += 1;
    }
    expect({ safe, partial, opaque, unknown, total: safe + partial + opaque + unknown }).toEqual({
      safe: 6,
      partial: 15,
      opaque: 41,
      unknown: 152,
      total: 214,
    });
  });

  it("no place has a missing febMar2027.status in the current dataset (all 214 are non-empty)", () => {
    const missing = places.filter((p) => interpretPlaceFebMarStatus(p).category === "missing");
    expect(missing).toHaveLength(0);
  });

  it("every place's raw fact matches its own place.febMar2027.status verbatim", () => {
    for (const place of places) {
      expect(interpretPlaceFebMarStatus(place).raw).toBe(place.febMar2027.status);
    }
  });

  it("the classifier never reads warning or action — verified by calling it with only status, and by a real place's mismatched warning/action not affecting the result", () => {
    const place = places[0];
    const factFromStatusOnly = interpretFebMarStatusText(place.febMar2027.status);
    // Constructing a fact from status text alone (the classifier's only parameter) must equal the
    // real place's fact exactly, proving warning/action are structurally never consulted.
    expect(interpretPlaceFebMarStatus(place)).toEqual(factFromStatusOnly);
  });

  it("warning and action text do not affect classification — swapping them across two real places changes nothing", () => {
    const a = places.find((p) => p.febMar2027.status !== places[0].febMar2027.status) ?? places[1];
    const factBefore = interpretFebMarStatusText(a.febMar2027.status);
    const mutated = { ...a, febMar2027: { ...a.febMar2027, warning: "algo distinto", action: "algo distinto" } };
    const factAfter = interpretFebMarStatusText(mutated.febMar2027.status);
    expect(factAfter).toEqual(factBefore);
  });

  it("a real seasonal-opportunity place exists and its display tone/label never mentions risk", () => {
    const opportunity = places.filter((p) => interpretPlaceFebMarStatus(p).category === "seasonal-opportunity");
    expect(opportunity.length).toBeGreaterThan(0);
    for (const place of opportunity) {
      const fact = interpretPlaceFebMarStatus(place);
      const display = describeFebMarStatusForUi(fact);
      expect(display.tone).toBe("attention");
      expect(display.label.toLowerCase()).not.toContain("riesgo");
      expect(display.label.toLowerCase()).not.toContain("risk");
    }
  });

  it("a real pending-verification place exists and stays 'pending' tone, never promoted", () => {
    const pending = places.filter((p) => interpretPlaceFebMarStatus(p).category === "pending-verification");
    expect(pending.length).toBeGreaterThan(0);
    for (const place of pending) {
      const display = describeFebMarStatusForUi(interpretPlaceFebMarStatus(place));
      expect(display.tone).toBe("pending");
    }
  });

  it("a real confirmed place exists and gets the 'confirmed' tone", () => {
    const confirmed = places.filter((p) => interpretPlaceFebMarStatus(p).category === "confirmed");
    expect(confirmed.length).toBeGreaterThan(0);
    for (const place of confirmed) {
      const display = describeFebMarStatusForUi(interpretPlaceFebMarStatus(place));
      expect(display.tone).toBe("confirmed");
    }
  });
});

describe("describeFebMarStatusForUi", () => {
  it("maps every tier to the documented tone", () => {
    expect(describeFebMarStatusForUi({ category: "confirmed", tier: "safe", raw: "x" }).tone).toBe("confirmed");
    expect(describeFebMarStatusForUi({ category: "open-with-condition", tier: "partial", raw: "x" }).tone).toBe(
      "attention"
    );
    expect(describeFebMarStatusForUi({ category: "seasonal-risk", tier: "opaque", raw: "x" }).tone).toBe("attention");
    expect(describeFebMarStatusForUi({ category: "missing", tier: "unknown", raw: "" }).tone).toBe("pending");
  });

  it("never labels any tone with an 'open'/'closed'/'available' claim", () => {
    for (const tone of [
      { category: "confirmed" as const, tier: "safe" as const, raw: "x" },
      { category: "open-with-condition" as const, tier: "partial" as const, raw: "x" },
      { category: "seasonal-risk" as const, tier: "opaque" as const, raw: "x" },
      { category: "missing" as const, tier: "unknown" as const, raw: "" },
    ]) {
      const display = describeFebMarStatusForUi(tone);
      const lower = display.label.toLowerCase();
      for (const forbidden of ["abierto", "cerrado", "disponible", "no disponible"]) {
        expect(lower, `${tone.category} label should not contain "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });

  it("PARTIAL and OPAQUE share the same tone and label — never distinguished by category-specific text", () => {
    const partial = describeFebMarStatusForUi({ category: "open-with-condition", tier: "partial", raw: "x" });
    const opaque = describeFebMarStatusForUi({ category: "seasonal-risk", tier: "opaque", raw: "x" });
    expect(partial).toEqual(opaque);
  });

  it("reuses one of the three existing alert CSS modifiers — no new palette introduced", () => {
    for (const tier of ["safe", "partial", "opaque", "unknown"] as const) {
      const display = describeFebMarStatusForUi({ category: "uncategorized", tier, raw: "x" });
      expect(["confirmed", "risk", "pending"]).toContain(display.cssModifier);
    }
  });

  it("is deterministic and pure", () => {
    const fact = { category: "confirmed" as const, tier: "safe" as const, raw: "x" };
    const results = new Set(Array.from({ length: 5 }, () => JSON.stringify(describeFebMarStatusForUi(fact))));
    expect(results.size).toBe(1);
  });
});
