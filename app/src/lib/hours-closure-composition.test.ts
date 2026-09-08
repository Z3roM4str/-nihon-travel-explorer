import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import { buildDayAssignment, type DayAssignment } from "./day-assignment";
import {
  buildDayHoursClosureCompositions,
  classifyHoursClosureComposition,
  composeRecordedHoursAndClosure,
  deriveHoursClosureVisitDate,
  derivePlaceHoursClosureComposition,
  type CompositionClass,
} from "./hours-closure-composition";
import { interpretHoursText, interpretPlaceHours, type HoursTier } from "./recorded-hours";
import { interpretClosureText, type TemporalTier } from "./temporal-availability";

const places = placesData as Place[];
const tiers: Array<HoursTier & TemporalTier> = ["safe", "partial", "opaque", "unknown"];

const expectedMatrix: Record<HoursTier, Record<TemporalTier, CompositionClass>> = {
  safe: {
    safe: "jointly-presentable",
    partial: "present-with-caveat",
    opaque: "keep-separate",
    unknown: "not-composable",
  },
  partial: {
    safe: "present-with-caveat",
    partial: "present-with-caveat",
    opaque: "keep-separate",
    unknown: "not-composable",
  },
  opaque: {
    safe: "keep-separate",
    partial: "keep-separate",
    opaque: "keep-separate",
    unknown: "not-composable",
  },
  unknown: {
    safe: "not-composable",
    partial: "not-composable",
    opaque: "not-composable",
    unknown: "not-composable",
  },
};

function realPlace(id: string): Place {
  const place = places.find((candidate) => candidate.id === id);
  if (!place) throw new Error(`Missing test place ${id}`);
  return place;
}

describe("Phase 3D-J composition matrix", () => {
  it.each(tiers.flatMap((hoursTier) => tiers.map((closureTier) => [hoursTier, closureTier] as const)))(
    "%s hours × %s closures produces the approved class",
    (hoursTier, closureTier) => {
      expect(classifyHoursClosureComposition(hoursTier, closureTier)).toBe(expectedMatrix[hoursTier][closureTier]);
    }
  );

  it("is symmetric for class selection across all 16 tier pairs", () => {
    for (const left of tiers) {
      for (const right of tiers) {
        expect(classifyHoursClosureComposition(left, right)).toBe(classifyHoursClosureComposition(right, left));
      }
    }
  });

  it("never promotes an OPAQUE or UNKNOWN axis into either presentable class", () => {
    for (const left of tiers) {
      for (const right of tiers) {
        if (left !== "opaque" && left !== "unknown" && right !== "opaque" && right !== "unknown") continue;
        expect(["keep-separate", "not-composable"]).toContain(classifyHoursClosureComposition(left, right));
      }
    }
  });

  it("is deterministic for identical inputs", () => {
    const results = new Set(
      Array.from({ length: 5 }, () => classifyHoursClosureComposition("partial", "safe"))
    );
    expect(results).toEqual(new Set(["present-with-caveat"]));
  });
});

describe("classified-fact composition", () => {
  it("dispatches by .tier, not .kind — JP-019's not-evaluable closure remains PARTIAL", () => {
    const jp019 = realPlace("JP-019");
    const closure = interpretClosureText(jp019.schedule.closures);
    expect(closure.kind).toBe("not-evaluable");
    expect(closure.tier).toBe("partial");

    const withSafeHours = composeRecordedHoursAndClosure(interpretHoursText("09:00–17:00"), closure, "2027-02-15");
    expect(withSafeHours.compositionClass).toBe("present-with-caveat");
    expect(withSafeHours.closure).toBe(closure);

    const actual = composeRecordedHoursAndClosure(interpretPlaceHours(jp019), closure, "2027-02-15");
    expect(actual.compositionClass).toBe("not-composable");
  });

  it("preserves both complete raw facts and existing weekday assessment", () => {
    const hours = interpretHoursText("Estación 24 h; comercios variables");
    const closure = interpretClosureText("Lunes; verificar");
    const result = composeRecordedHoursAndClosure(hours, closure, "2027-02-15");
    expect(result.hours).toBe(hours);
    expect(result.closure).toBe(closure);
    expect(result.hours.raw).toBe("Estación 24 h; comercios variables");
    expect(result.closure.raw).toBe("Lunes; verificar");
    expect(result.weekdayAssessment.outcome).toBe("possible-weekday-closure-match");
  });

  it("keeps malformed/missing evidence exactly as conservative as the existing classifiers", () => {
    const result = composeRecordedHoursAndClosure(interpretHoursText(undefined), interpretClosureText("  "), "2027-02-15");
    expect(result.hours).toEqual(interpretHoursText(undefined));
    expect(result.closure).toEqual(interpretClosureText("  "));
    expect(result.hours.tier).toBe("unknown");
    expect(result.closure.tier).toBe("unknown");
    expect(result.compositionClass).toBe("not-composable");
  });
});

describe("strict visit-date prerequisite", () => {
  const sample = realPlace("JP-017");
  const validAssignment = buildDayAssignment([sample.id], [[sample.id]]);

  it("no day split produces no composed signal", () => {
    const assignment = buildDayAssignment([sample.id], []);
    expect(derivePlaceHoursClosureComposition(sample, assignment, "2027-02-15").signal.kind).toBe("no-visit-date");
  });

  it("a globally invalid partition suppresses composition", () => {
    const assignment = buildDayAssignment([sample.id, "JP-019"], [[sample.id]]);
    expect(assignment.valid).toBe(false);
    expect(derivePlaceHoursClosureComposition(sample, assignment, "2027-02-15").signal.kind).toBe("no-visit-date");
  });

  it("missing and invalid anchors suppress composition", () => {
    expect(deriveHoursClosureVisitDate(validAssignment, null, sample.id)).toBeNull();
    expect(deriveHoursClosureVisitDate(validAssignment, undefined, sample.id)).toBeNull();
    expect(deriveHoursClosureVisitDate(validAssignment, "2027-02-30", sample.id)).toBeNull();
  });

  it("a place assigned zero or multiple times suppresses composition even if input claims validity", () => {
    const sequence = validAssignment.days[0].sequence;
    const absent: DayAssignment = { valid: true, issues: [], days: [{ placeIds: [], sequence }] };
    const duplicated: DayAssignment = {
      valid: true,
      issues: [],
      days: [
        { placeIds: [sample.id], sequence },
        { placeIds: [sample.id], sequence },
      ],
    };
    expect(deriveHoursClosureVisitDate(absent, "2027-02-15", sample.id)).toBeNull();
    expect(deriveHoursClosureVisitDate(duplicated, "2027-02-15", sample.id)).toBeNull();
  });

  it("civil-date overflow is rejected after addCivilDays", () => {
    const dayTwo = buildDayAssignment([sample.id], [[], [sample.id]]);
    expect(dayTwo.valid).toBe(true);
    expect(deriveHoursClosureVisitDate(dayTwo, "9999-12-31", sample.id)).toBeNull();
  });

  it("a valid partition, anchor, membership, addition, and result produce composition", () => {
    const result = derivePlaceHoursClosureComposition(sample, validAssignment, "2027-02-15");
    expect(result.signal.kind).toBe("composed");
    if (result.signal.kind === "composed") {
      expect(result.signal.visitDate).toBe("2027-02-15");
      expect(result.signal.compositionClass).toBe("jointly-presentable");
    }
  });

  it("moving a place recomputes from the new day date with no retained state", () => {
    const monday = buildDayAssignment([sample.id], [[sample.id], []]);
    const tuesday = buildDayAssignment([sample.id], [[], [sample.id]]);
    const before = buildDayHoursClosureCompositions([sample], monday, "2027-02-15")[0];
    const after = buildDayHoursClosureCompositions([sample], tuesday, "2027-02-15")[0];
    expect(before.signal.kind).toBe("composed");
    expect(after.signal.kind).toBe("composed");
    if (before.signal.kind === "composed" && after.signal.kind === "composed") {
      expect(before.signal.visitDate).toBe("2027-02-15");
      expect(after.signal.visitDate).toBe("2027-02-16");
      expect(after).not.toEqual(before);
    }
  });
});

describe("real dataset regression", () => {
  it("re-derives the approved 4×4 cross-tab and composition totals from all 214 real places", () => {
    const crossTab = Object.fromEntries(tiers.map((hoursTier) => [hoursTier, Object.fromEntries(tiers.map((closureTier) => [closureTier, 0]))])) as Record<HoursTier, Record<TemporalTier, number>>;
    const classes: Record<CompositionClass, number> = {
      "jointly-presentable": 0,
      "present-with-caveat": 0,
      "keep-separate": 0,
      "not-composable": 0,
    };

    for (const place of places) {
      const hours = interpretPlaceHours(place);
      const closure = interpretClosureText(place.schedule.closures);
      crossTab[hours.tier][closure.tier] += 1;
      classes[classifyHoursClosureComposition(hours.tier, closure.tier)] += 1;
    }

    expect(places).toHaveLength(214);
    expect(crossTab).toEqual({
      safe: { safe: 31, partial: 18, opaque: 19, unknown: 12 },
      partial: { safe: 15, partial: 10, opaque: 20, unknown: 5 },
      opaque: { safe: 0, partial: 0, opaque: 17, unknown: 2 },
      unknown: { safe: 15, partial: 3, opaque: 27, unknown: 20 },
    });
    expect(classes).toEqual({
      "jointly-presentable": 31,
      "present-with-caveat": 43,
      "keep-separate": 56,
      "not-composable": 84,
    });
  });

  it("retains the approved row and column marginals", () => {
    const hoursCounts = Object.fromEntries(tiers.map((tier) => [tier, 0])) as Record<HoursTier, number>;
    const closureCounts = Object.fromEntries(tiers.map((tier) => [tier, 0])) as Record<TemporalTier, number>;
    for (const place of places) {
      hoursCounts[interpretPlaceHours(place).tier] += 1;
      closureCounts[interpretClosureText(place.schedule.closures).tier] += 1;
    }
    expect(hoursCounts).toEqual({ safe: 80, partial: 50, opaque: 19, unknown: 65 });
    expect(closureCounts).toEqual({ safe: 61, partial: 31, opaque: 83, unknown: 39 });
  });
});

describe("structural safety boundary", () => {
  it("defines no availability/feasibility fields, clock reads, persistence, API calls, or duration fitting", async () => {
    const source = await readFile(new URL("./hours-closure-composition.ts", import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "");
    for (const forbiddenProperty of ["open", "closed", "available", "feasible", "compatible", "works"]) {
      expect(code).not.toMatch(new RegExp(`\\b${forbiddenProperty}\\s*[?:]:`, "iu"));
    }
    for (const forbidden of ["Date.now", "localStorage", "sessionStorage", "indexedDB", "fetch(", "duration"]){
      expect(code).not.toContain(forbidden);
    }
  });
});
