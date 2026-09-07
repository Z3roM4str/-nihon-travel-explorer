import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import {
  describeReservationForUi,
  interpretPlaceReservation,
  interpretReservation,
  matchesReservationFilter,
  type ReservationCategory,
} from "./reservation";

const places = placesData as Place[];

describe("interpretReservation — parity with scripts/temporal_data_lib.py's classify_reservation_raw", () => {
  it("'No' classifies not-required / SAFE, consistent with required=false", () => {
    const fact = interpretReservation("No", false);
    expect(fact.category).toBe("not-required");
    expect(fact.tier).toBe("safe");
    expect(fact.raw).toBe("No");
    expect(fact.consistentWithDerivedBoolean).toBe(true);
  });

  it("'Sí' classifies required / SAFE, consistent with required=true", () => {
    const fact = interpretReservation("Sí", true);
    expect(fact.category).toBe("required");
    expect(fact.tier).toBe("safe");
    expect(fact.consistentWithDerivedBoolean).toBe(true);
  });

  it("'Si' (no accent) also classifies required / SAFE — the canonical Python classifier supports it", () => {
    const fact = interpretReservation("Si", true);
    expect(fact.category).toBe("required");
    expect(fact.tier).toBe("safe");
  });

  it("case handling is accepted where the canonical classifier supports it (exact-match, case-insensitive)", () => {
    for (const raw of ["no", "NO", "No", "sí", "SÍ", "si", "SI"]) {
      const fact = interpretReservation(raw, raw.toLowerCase().startsWith("s"));
      expect(fact.category, raw).not.toBe("unrecognized-value");
    }
  });

  it("'Recomendable' classifies recommended-not-required / PARTIAL", () => {
    const fact = interpretReservation("Recomendable", false);
    expect(fact.category).toBe("recommended-not-required");
    expect(fact.tier).toBe("partial");
    expect(fact.consistentWithDerivedBoolean).toBe(true);
  });

  it("'Opcional' classifies optional-not-required / PARTIAL", () => {
    const fact = interpretReservation("Opcional", false);
    expect(fact.category).toBe("optional-not-required");
    expect(fact.tier).toBe("partial");
  });

  it("'No para espectador' classifies not-required-role-specific / PARTIAL", () => {
    const fact = interpretReservation("No para espectador", false);
    expect(fact.category).toBe("not-required-role-specific");
    expect(fact.tier).toBe("partial");
  });

  it("missing/empty raw classifies UNKNOWN, never guessed", () => {
    for (const raw of ["", "   "]) {
      const fact = interpretReservation(raw, false);
      expect(fact.category, JSON.stringify(raw)).toBe("missing");
      expect(fact.tier).toBe("unknown");
    }
  });

  it("an unrecognized raw value classifies UNKNOWN, never promoted to a specific category", () => {
    const fact = interpretReservation("Quizás", false);
    expect(fact.category).toBe("unrecognized-value");
    expect(fact.tier).toBe("unknown");
  });

  it("raw text is preserved verbatim on every fact", () => {
    for (const raw of ["No", "Sí", "Recomendable", "Opcional", "No para espectador", "Quizás", ""]) {
      expect(interpretReservation(raw, false).raw).toBe(raw);
    }
  });

  it("is deterministic across repeated calls", () => {
    const results = new Set(
      Array.from({ length: 5 }, () => JSON.stringify(interpretReservation("Recomendable", false)))
    );
    expect(results.size).toBe(1);
  });
});

describe("derived-boolean consistency checking", () => {
  it("'No' + false -> consistent", () => {
    expect(interpretReservation("No", false).consistentWithDerivedBoolean).toBe(true);
  });

  it("'Sí' + true -> consistent", () => {
    expect(interpretReservation("Sí", true).consistentWithDerivedBoolean).toBe(true);
  });

  it("'Recomendable' + false -> consistent (matches the export pipeline's own rule)", () => {
    expect(interpretReservation("Recomendable", false).consistentWithDerivedBoolean).toBe(true);
  });

  it("'Recomendable' + true -> INCONSISTENT, exposed structurally rather than trusted", () => {
    const fact = interpretReservation("Recomendable", true);
    expect(fact.consistentWithDerivedBoolean).toBe(false);
    // The inconsistency must not silently promote the category to "required" or hide the raw
    // nuance — the category is still exactly what the raw text says.
    expect(fact.category).toBe("recommended-not-required");
  });

  it("'No' + true -> inconsistent", () => {
    expect(interpretReservation("No", true).consistentWithDerivedBoolean).toBe(false);
  });

  it("'Sí' + false -> inconsistent", () => {
    expect(interpretReservation("Sí", false).consistentWithDerivedBoolean).toBe(false);
  });
});

describe("full reservation-category vocabulary parity (table-driven)", () => {
  const REPRESENTATIVE_INPUTS: Record<ReservationCategory, { raw: string; required: boolean }> = {
    missing: { raw: "", required: false },
    "not-required": { raw: "No", required: false },
    required: { raw: "Sí", required: true },
    "recommended-not-required": { raw: "Recomendable", required: false },
    "optional-not-required": { raw: "Opcional", required: false },
    "not-required-role-specific": { raw: "No para espectador", required: false },
    "unrecognized-value": { raw: "Quizás", required: false },
  };

  it.each(Object.entries(REPRESENTATIVE_INPUTS))("category %s classifies as itself, consistently", (category, { raw, required }) => {
    const fact = interpretReservation(raw, required);
    expect(fact.category).toBe(category);
    expect(fact.consistentWithDerivedBoolean).toBe(true);
  });

  it("covers every ReservationCategory exactly once", () => {
    const covered = Object.keys(REPRESENTATIVE_INPUTS).sort();
    const observed = Object.values(REPRESENTATIVE_INPUTS)
      .map(({ raw, required }) => interpretReservation(raw, required).category)
      .sort();
    expect(observed).toEqual(covered);
  });

  /**
   * Reads `scripts/temporal_data_lib.py`'s actual `RESERVATION_RAW_TIER` and
   * `RESERVATION_RAW_EXPECTED_REQUIRED` dicts as text (never imported, never executed — no
   * Python subprocess) and cross-checks both against this module. This is the same technique
   * `temporal-availability.test.ts` uses for `CLOSURES_TIER`, adopted here specifically because
   * Phase 3D-B's own corrective review found a real category-name parity defect that a looser
   * test had missed.
   */
  async function readPythonDict(dictName: string): Promise<Record<string, string>> {
    const source = await readFile(new URL("../../../scripts/temporal_data_lib.py", import.meta.url), "utf8");
    const blockMatch = new RegExp(`${dictName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
    if (!blockMatch) {
      throw new Error(`Could not find a ${dictName} = { ... } block in scripts/temporal_data_lib.py`);
    }
    const entries: Record<string, string> = {};
    const entryRe = /"([a-z0-9-]+)":\s*("[A-Z]+"|True|False)/g;
    let match: RegExpExecArray | null;
    while ((match = entryRe.exec(blockMatch[1])) !== null) {
      entries[match[1]] = match[2].replace(/"/g, "").toLowerCase();
    }
    return entries;
  }

  it("scripts/temporal_data_lib.py's RESERVATION_RAW_TIER has at least the categories this module expects", async () => {
    const pythonTier = await readPythonDict("RESERVATION_RAW_TIER");
    expect(Object.keys(pythonTier).length).toBeGreaterThanOrEqual(7);
  });

  it("every ReservationCategory this module has exists in Python's RESERVATION_RAW_TIER with the same tier", async () => {
    const pythonTier = await readPythonDict("RESERVATION_RAW_TIER");
    for (const [category, { raw, required }] of Object.entries(REPRESENTATIVE_INPUTS)) {
      expect(pythonTier, `Python RESERVATION_RAW_TIER is missing key ${JSON.stringify(category)}`).toHaveProperty(
        category
      );
      const fact = interpretReservation(raw, required);
      expect(fact.tier, `category=${category}`).toBe(pythonTier[category]);
    }
  });

  it("Python's RESERVATION_RAW_TIER has no category this module doesn't know about", async () => {
    const pythonTier = await readPythonDict("RESERVATION_RAW_TIER");
    const tsCategories = new Set(Object.keys(REPRESENTATIVE_INPUTS));
    const unknownToTs = Object.keys(pythonTier).filter((category) => !tsCategories.has(category));
    expect(unknownToTs).toEqual([]);
  });

  it("every ReservationCategory's expected-required mapping matches Python's RESERVATION_RAW_EXPECTED_REQUIRED", async () => {
    const pythonExpected = await readPythonDict("RESERVATION_RAW_EXPECTED_REQUIRED");
    for (const category of Object.keys(REPRESENTATIVE_INPUTS) as ReservationCategory[]) {
      expect(pythonExpected).toHaveProperty(category);
      const expectedBool = pythonExpected[category] === "true";
      // Re-derive this module's own expected mapping by checking a "correct" (consistent) input.
      const { raw } = REPRESENTATIVE_INPUTS[category];
      const fact = interpretReservation(raw, expectedBool);
      expect(fact.consistentWithDerivedBoolean, `category=${category}`).toBe(true);
    }
  });
});

describe("real dataset coverage/invariants (data/places.json via app/src/data/places.json)", () => {
  it("does not throw across all 214 current places", () => {
    expect(() => {
      for (const place of places) interpretPlaceReservation(place);
    }).not.toThrow();
  });

  it("all five current raw reservation values exist in the dataset", () => {
    const rawValues = new Set(places.map((p) => p.reservation.raw));
    for (const expected of ["No", "Sí", "Recomendable", "Opcional", "No para espectador"]) {
      expect(rawValues.has(expected), expected).toBe(true);
    }
  });

  it("there are currently zero raw/boolean inconsistencies", () => {
    const inconsistent = places.filter((p) => !interpretPlaceReservation(p).consistentWithDerivedBoolean);
    expect(inconsistent.map((p) => p.id)).toEqual([]);
  });

  it("'Recomendable' never classifies as plain not-required", () => {
    const recomendable = places.filter((p) => p.reservation.raw === "Recomendable");
    expect(recomendable.length).toBeGreaterThan(0);
    for (const place of recomendable) {
      expect(interpretPlaceReservation(place).category).toBe("recommended-not-required");
    }
  });

  it("'Opcional' never classifies as plain not-required", () => {
    const opcional = places.filter((p) => p.reservation.raw === "Opcional");
    expect(opcional.length).toBeGreaterThan(0);
    for (const place of opcional) {
      expect(interpretPlaceReservation(place).category).toBe("optional-not-required");
    }
  });

  it("'No para espectador' never classifies as plain not-required", () => {
    const roleSpecific = places.filter((p) => p.reservation.raw === "No para espectador");
    expect(roleSpecific.length).toBeGreaterThan(0);
    for (const place of roleSpecific) {
      expect(interpretPlaceReservation(place).category).toBe("not-required-role-specific");
    }
  });

  it("only 'Sí' maps to required in the current dataset", () => {
    const required = places.filter((p) => interpretPlaceReservation(p).category === "required");
    for (const place of required) {
      expect(place.reservation.raw.toLowerCase()).toMatch(/^s[ií]$/);
    }
    // Current audit fact, not a hardcoded product invariant elsewhere in this module.
    expect(required.length).toBe(41);
  });
});

describe("matchesReservationFilter", () => {
  function place(raw: string, required: boolean): Place {
    return { ...places[0], reservation: { ...places[0].reservation, raw, required } };
  }

  it("'all' matches every category, including unrecognized/missing", () => {
    for (const [raw, required] of [
      ["No", false],
      ["Sí", true],
      ["Recomendable", false],
      ["Opcional", false],
      ["No para espectador", false],
      ["Quizás", false],
      ["", false],
    ] as const) {
      expect(matchesReservationFilter(place(raw, required), "all")).toBe(true);
    }
  });

  it("'required' matches only the required category, excludes recommended", () => {
    expect(matchesReservationFilter(place("Sí", true), "required")).toBe(true);
    expect(matchesReservationFilter(place("Recomendable", false), "required")).toBe(false);
    expect(matchesReservationFilter(place("No", false), "required")).toBe(false);
  });

  it("'recommended' matches only recommended-not-required, excludes plain 'No'", () => {
    expect(matchesReservationFilter(place("Recomendable", false), "recommended")).toBe(true);
    expect(matchesReservationFilter(place("No", false), "recommended")).toBe(false);
    expect(matchesReservationFilter(place("Sí", true), "recommended")).toBe(false);
  });

  it("'not-required' matches only plain not-required, excludes recommended/optional/role-specific", () => {
    expect(matchesReservationFilter(place("No", false), "not-required")).toBe(true);
    expect(matchesReservationFilter(place("Recomendable", false), "not-required")).toBe(false);
    expect(matchesReservationFilter(place("Opcional", false), "not-required")).toBe(false);
    expect(matchesReservationFilter(place("No para espectador", false), "not-required")).toBe(false);
  });

  it("'optional' matches only optional-not-required", () => {
    expect(matchesReservationFilter(place("Opcional", false), "optional")).toBe(true);
    expect(matchesReservationFilter(place("No", false), "optional")).toBe(false);
    expect(matchesReservationFilter(place("Recomendable", false), "optional")).toBe(false);
  });

  it("'role-specific' matches only not-required-role-specific", () => {
    expect(matchesReservationFilter(place("No para espectador", false), "role-specific")).toBe(true);
    expect(matchesReservationFilter(place("No", false), "role-specific")).toBe(false);
  });

  it("an unknown/unrecognized raw value is never silently included in a specific filter", () => {
    for (const filter of ["required", "recommended", "not-required", "optional", "role-specific"] as const) {
      expect(matchesReservationFilter(place("Quizás", false), filter), filter).toBe(false);
      expect(matchesReservationFilter(place("", false), filter), filter).toBe(false);
    }
  });

  it("every filter option is mutually exclusive across the real dataset (no double counting)", () => {
    const filters = ["required", "recommended", "not-required", "optional", "role-specific"] as const;
    for (const candidate of places) {
      const matchingFilters = filters.filter((filter) => matchesReservationFilter(candidate, filter));
      expect(matchingFilters.length, candidate.id).toBeLessThanOrEqual(1);
    }
  });
});

describe("describeReservationForUi", () => {
  it("required -> tag 'Requiere reserva', row 'Necesaria · <leadTime>'", () => {
    const display = describeReservationForUi(interpretReservation("Sí", true), "1–2 semanas");
    expect(display.tag).toEqual({ label: "Requiere reserva", className: "tag--alert" });
    expect(display.practicalRow).toBe("Necesaria · 1–2 semanas");
  });

  it("required with no usable leadTime omits the suffix entirely (never 'Necesaria · —')", () => {
    const display = describeReservationForUi(interpretReservation("Sí", true), "—");
    expect(display.practicalRow).toBe("Necesaria");
    expect(display.practicalRow).not.toContain("—");
  });

  it("recommended -> tag 'Reserva recomendable', row 'Recomendable'", () => {
    const display = describeReservationForUi(interpretReservation("Recomendable", false), "Semanas");
    expect(display.tag?.label).toBe("Reserva recomendable");
    expect(display.practicalRow).toBe("Recomendable · Semanas");
  });

  it("optional -> tag 'Reserva opcional', row 'Opcional'", () => {
    const display = describeReservationForUi(interpretReservation("Opcional", false), "—");
    expect(display.tag?.label).toBe("Reserva opcional");
    expect(display.practicalRow).toBe("Opcional");
  });

  it("not-required -> no tag, generic 'No es necesaria' is used only for the plain not-required category", () => {
    const display = describeReservationForUi(interpretReservation("No", false), "—");
    expect(display.tag).toBeNull();
    expect(display.practicalRow).toBe("No es necesaria");
  });

  it("role-specific -> preserves the raw nuance, never rewritten as generic 'No es necesaria'", () => {
    const display = describeReservationForUi(interpretReservation("No para espectador", false), "—");
    expect(display.practicalRow).toBe("No para espectador");
    expect(display.practicalRow).not.toBe("No es necesaria");
  });

  it("missing raw -> conservative fallback, never guessed", () => {
    const display = describeReservationForUi(interpretReservation("", false), "—");
    expect(display.tag).toBeNull();
    expect(display.practicalRow).toBe("Estado de reserva por verificar");
  });

  it("unrecognized raw -> shows the raw text plus a conservative note, never promoted to required/not-required", () => {
    const display = describeReservationForUi(interpretReservation("Quizás", false), "—");
    expect(display.tag).toBeNull();
    expect(display.practicalRow).toBe("Quizás (verificar)");
  });

  it("is deterministic across repeated calls", () => {
    const fact = interpretReservation("Recomendable", false);
    const results = new Set(Array.from({ length: 5 }, () => JSON.stringify(describeReservationForUi(fact, "Semanas"))));
    expect(results.size).toBe(1);
  });
});
