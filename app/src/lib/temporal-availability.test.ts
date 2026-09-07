import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import { assessWeekdayClosure, interpretClosureText } from "./temporal-availability";

const places = placesData as Place[];

describe("interpretClosureText — parity with scripts/temporal_data_lib.py's classify_closures", () => {
  it("classifies plain 'Sin cierre' as SAFE no-known-closure", () => {
    const fact = interpretClosureText("Sin cierre");
    expect(fact.kind).toBe("no-known-closure");
    expect(fact.tier).toBe("safe");
    expect(fact.raw).toBe("Sin cierre");
  });

  it("classifies plain 'Sin cierre ordinario' as SAFE no-known-closure", () => {
    const fact = interpretClosureText("Sin cierre ordinario");
    expect(fact.kind).toBe("no-known-closure");
    expect(fact.tier).toBe("safe");
  });

  it("'Sin cierre ordinario; clima' is NOT SAFE — a caveat disqualifies it", () => {
    const fact = interpretClosureText("Sin cierre ordinario; clima");
    expect(fact.kind).not.toBe("no-known-closure");
    expect(fact.tier).not.toBe("safe");
    if (fact.kind === "not-evaluable") {
      expect(fact.category).toBe("no-known-closure-with-caveat");
      expect(fact.tier).toBe("partial");
    }
  });

  it("'Lunes; verificar' is a PARTIAL candidate-weekday for Monday", () => {
    const fact = interpretClosureText("Lunes; verificar");
    expect(fact.kind).toBe("candidate-weekday");
    expect(fact.tier).toBe("partial");
    if (fact.kind === "candidate-weekday") {
      expect(fact.weekdays).toEqual(["monday"]);
    }
  });

  it("handles accents and case identically to the unaccented/lowercase form", () => {
    const variants = ["Lunes; verificar", "LUNES; VERIFICAR", "lunes; verificar", "LuNeS; VeRiFiCaR"];
    for (const raw of variants) {
      const fact = interpretClosureText(raw);
      expect(fact.kind, raw).toBe("candidate-weekday");
      if (fact.kind === "candidate-weekday") expect(fact.weekdays).toEqual(["monday"]);
    }
    // A real accented weekday name, exercised with 'miércoles'/'sábado' specifically since those
    // are the two with diacritics in Spanish.
    const wed = interpretClosureText("Miércoles; verificar");
    expect(wed.kind).toBe("candidate-weekday");
    if (wed.kind === "candidate-weekday") expect(wed.weekdays).toEqual(["wednesday"]);
    const sat = interpretClosureText("Sábado; verificar");
    expect(sat.kind).toBe("candidate-weekday");
    if (sat.kind === "candidate-weekday") expect(sat.weekdays).toEqual(["saturday"]);
  });

  it("extracts every other named weekday explicitly", () => {
    const cases: Array<[string, string]> = [
      ["Martes; verificar", "tuesday"],
      ["Jueves; verificar", "thursday"],
      ["Viernes; verificar", "friday"],
      ["Domingo; verificar", "sunday"],
    ];
    for (const [raw, expected] of cases) {
      const fact = interpretClosureText(raw);
      expect(fact.kind, raw).toBe("candidate-weekday");
      if (fact.kind === "candidate-weekday") expect(fact.weekdays).toEqual([expected]);
    }
  });

  it("extracts more than one weekday, in a fixed Sunday-Saturday order regardless of text order", () => {
    const fact = interpretClosureText("Viernes y lunes; verificar");
    expect(fact.kind).toBe("candidate-weekday");
    if (fact.kind === "candidate-weekday") {
      expect(fact.weekdays).toEqual(["monday", "friday"]); // fixed order, not text order
    }
  });

  it("'Muchos domingos' does NOT become a candidate recurring weekday", () => {
    const fact = interpretClosureText("Muchos domingos");
    expect(fact.kind).toBe("not-evaluable");
    if (fact.kind === "not-evaluable") {
      expect(fact.category).toBe("irregular-weekday-pattern");
      expect(fact.tier).toBe("opaque");
    }
  });

  it("'Miércoles/domingo variable' does NOT become a candidate recurring weekday", () => {
    const fact = interpretClosureText("Miércoles/domingo variable");
    expect(fact.kind).toBe("not-evaluable");
    if (fact.kind === "not-evaluable") {
      expect(fact.category).toBe("irregular-weekday-pattern");
    }
  });

  it("weather-dependent closures are not-evaluable, OPAQUE", () => {
    const fact = interpretClosureText("Clima/tifones");
    expect(fact.kind).toBe("not-evaluable");
    if (fact.kind === "not-evaluable") {
      expect(fact.category).toBe("weather-or-tide-dependent");
      expect(fact.tier).toBe("opaque");
    }
  });

  it("third-party-dependent closures are not-evaluable, OPAQUE", () => {
    const fact = interpretClosureText("Según comercio");
    expect(fact.kind).toBe("not-evaluable");
    if (fact.kind === "not-evaluable") {
      expect(fact.category).toBe("third-party-operator-dependent");
      expect(fact.tier).toBe("opaque");
    }
  });

  it("a bare 'Variable' is not-evaluable, UNKNOWN", () => {
    const fact = interpretClosureText("Variable");
    expect(fact.kind).toBe("not-evaluable");
    if (fact.kind === "not-evaluable") {
      expect(fact.category).toBe("explicit-unknown-variable");
      expect(fact.tier).toBe("unknown");
    }
  });

  it("unrecognized prose stays UNKNOWN, never promoted", () => {
    const fact = interpretClosureText("Interiores limitados");
    expect(fact.kind).toBe("not-evaluable");
    if (fact.kind === "not-evaluable") {
      expect(fact.category).toBe("qualitative-uncategorized");
      expect(fact.tier).toBe("unknown");
    }
  });

  it("missing/empty text classifies as UNKNOWN, never guessed", () => {
    for (const raw of [null, undefined, "", "   "]) {
      const fact = interpretClosureText(raw);
      expect(fact.kind, String(raw)).toBe("not-evaluable");
      if (fact.kind === "not-evaluable") {
        expect(fact.category).toBe("missing");
        expect(fact.tier).toBe("unknown");
      }
    }
  });

  it("raw text is preserved verbatim on every fact kind", () => {
    for (const raw of ["Sin cierre", "Lunes; verificar", "Clima/tifones", "Muchos domingos", ""]) {
      expect(interpretClosureText(raw).raw).toBe(raw);
    }
  });

  it("is deterministic across repeated calls", () => {
    const results = new Set(
      Array.from({ length: 5 }, () => JSON.stringify(interpretClosureText("Lunes; verificar")))
    );
    expect(results.size).toBe(1);
  });
});

describe("assessWeekdayClosure", () => {
  it("candidate Monday + a Monday date -> possible match", () => {
    const closure = interpretClosureText("Lunes; verificar");
    const result = assessWeekdayClosure(closure, "2027-02-15"); // confirmed Monday
    expect(result.outcome).toBe("possible-weekday-closure-match");
  });

  it("candidate Monday + a Tuesday date -> no weekday match (never 'open')", () => {
    const closure = interpretClosureText("Lunes; verificar");
    const result = assessWeekdayClosure(closure, "2027-02-16"); // confirmed Tuesday
    expect(result.outcome).toBe("no-weekday-match");
    // Structurally: this outcome carries no "open"/"feasible" field at all.
    expect(result).not.toHaveProperty("open");
    expect(result).not.toHaveProperty("feasible");
    expect(result).not.toHaveProperty("compatible");
  });

  it("an opaque closure + a valid date -> not evaluable, regardless of weekday", () => {
    const closure = interpretClosureText("Según comercio");
    const result = assessWeekdayClosure(closure, "2027-02-15");
    expect(result.outcome).toBe("not-evaluable");
  });

  it("an invalid date -> not assessed, regardless of the closure fact", () => {
    const closure = interpretClosureText("Lunes; verificar");
    expect(assessWeekdayClosure(closure, "2027-02-30").outcome).toBe("not-assessed");
    expect(assessWeekdayClosure(closure, "not-a-date").outcome).toBe("not-assessed");
  });

  it("a null date -> not assessed", () => {
    const closure = interpretClosureText("Lunes; verificar");
    expect(assessWeekdayClosure(closure, null).outcome).toBe("not-assessed");
  });

  it("no-known-closure + a valid date must NOT produce an 'open' boolean", () => {
    const closure = interpretClosureText("Sin cierre ordinario");
    const result = assessWeekdayClosure(closure, "2027-02-15");
    expect(result.outcome).toBe("no-known-closure");
    expect(result).not.toHaveProperty("open");
    // The full result object has no boolean field anywhere that could be read as "is open".
    expect(Object.values(result).some((value) => typeof value === "boolean")).toBe(false);
  });

  it("is deterministic across repeated calls", () => {
    const closure = interpretClosureText("Lunes; verificar");
    const results = new Set(
      Array.from({ length: 5 }, () => JSON.stringify(assessWeekdayClosure(closure, "2027-02-15")))
    );
    expect(results.size).toBe(1);
  });
});

describe("real dataset coverage/invariants (data/places.json via app/src/data/places.json)", () => {
  it("does not throw across all current places' schedule.closures", () => {
    expect(() => {
      for (const place of places) interpretClosureText(place.schedule.closures);
    }).not.toThrow();
  });

  it("does not throw when assessed against a range of dates across all current places", () => {
    const sampleDates = ["2027-02-15", "2027-02-16", "2027-02-30", "not-a-date", null];
    expect(() => {
      for (const place of places) {
        const closure = interpretClosureText(place.schedule.closures);
        for (const date of sampleDates) assessWeekdayClosure(closure, date);
      }
    }).not.toThrow();
  });

  it("the real dataset contains at least one candidate recurring-weekday closure", () => {
    const candidates = places.filter((p) => interpretClosureText(p.schedule.closures).kind === "candidate-weekday");
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("the real 'Lunes; verificar' family classifies as candidate-weekday/PARTIAL", () => {
    const mondayVerificar = places.filter((p) => p.schedule.closures === "Lunes; verificar");
    expect(mondayVerificar.length).toBeGreaterThan(0); // proves the fixture actually exists today
    for (const place of mondayVerificar) {
      const fact = interpretClosureText(place.schedule.closures);
      expect(fact.kind).toBe("candidate-weekday");
      expect(fact.tier).toBe("partial");
      if (fact.kind === "candidate-weekday") expect(fact.weekdays).toEqual(["monday"]);
    }
  });

  it("real irregular weekday patterns remain non-evaluable, never a candidate", () => {
    const irregular = places.filter((p) =>
      ["Muchos domingos", "Muchos domingos/festivos", "Miércoles/domingo variable"].includes(p.schedule.closures)
    );
    expect(irregular.length).toBeGreaterThan(0); // proves these fixtures actually exist today
    for (const place of irregular) {
      const fact = interpretClosureText(place.schedule.closures);
      expect(fact.kind).toBe("not-evaluable");
      expect(fact.tier).not.toBe("safe");
    }
  });

  it("no OPAQUE/UNKNOWN closure category is ever promoted into a definitive weekday conflict", () => {
    // Every place, assessed against every weekday, either surfaces a real candidate-weekday
    // match/no-match, a no-known-closure fact, or "not-evaluable" — never something stronger.
    const allowedOutcomes = new Set([
      "possible-weekday-closure-match",
      "no-weekday-match",
      "no-known-closure",
      "not-evaluable",
      "not-assessed",
    ]);
    const dates = ["2027-02-14", "2027-02-15", "2027-02-16", "2027-02-17", "2027-02-18", "2027-02-19", "2027-02-20"];
    for (const place of places) {
      const closure = interpretClosureText(place.schedule.closures);
      for (const date of dates) {
        const result = assessWeekdayClosure(closure, date);
        expect(allowedOutcomes.has(result.outcome), `${place.id}: ${result.outcome}`).toBe(true);
        if (closure.tier !== "safe" && closure.kind !== "candidate-weekday") {
          // Every OPAQUE/UNKNOWN (non-safe, non-candidate) closure must resolve to
          // "not-evaluable" for every date — never a match, never a no-match, never "no known
          // closure".
          expect(result.outcome).toBe("not-evaluable");
        }
      }
    }
  });
});
