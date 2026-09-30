import { describe, expect, it } from "vitest";
import type { SequenceCandidate, SequenceComparison } from "./sequence-comparison";
import { dayOrderComparisonResultText, movePlaceToPosition } from "./day-order-tool";

function candidate(complete: boolean, transferMinutes: { minMinutes: number; maxMinutes: number } | null): SequenceCandidate {
  return {
    placeIds: ["a", "b"],
    sequence: {
      legs: [],
      summary: {
        placeCount: 2,
        legCount: 1,
        knownLegCount: complete ? 1 : 0,
        unknownLegCount: complete ? 0 : 1,
        transferMinutes,
        complete,
      },
    },
    confidenceCounts: { validatedStatic: complete ? 1 : 0, estimated: 0, scheduleAware: 0 },
  };
}

function comparison(outcome: SequenceComparison["outcome"], complete = true): SequenceComparison {
  return {
    candidateA: candidate(complete, complete ? { minMinutes: 20, maxMinutes: 30 } : null),
    candidateB: candidate(complete, complete ? { minMinutes: 40, maxMinutes: 50 } : null),
    sameSet: outcome !== "invalid",
    outcome,
    guaranteedAdvantageMinutes: outcome === "a-clearly-faster" || outcome === "b-clearly-faster" ? 10 : null,
    possibleAdvantageRange: outcome === "a-clearly-faster" || outcome === "b-clearly-faster"
      ? { minMinutes: 10, maxMinutes: 30 }
      : null,
  };
}

describe("B9.3 comparison wording and proposal reorder helpers", () => {
  it("describes a clearly faster proposal with the supported day-local claim", () => {
    expect(dayOrderComparisonResultText(comparison("b-clearly-faster")).headline)
      .toBe("Entre estos dos órdenes, la propuesta tiene menor tiempo de traslado.");
  });

  it("describes a clearly faster current order without A/B labels", () => {
    expect(dayOrderComparisonResultText(comparison("a-clearly-faster")).headline)
      .toBe("Entre estos dos órdenes, el orden actual tiene menor tiempo de traslado.");
  });

  it("describes equivalent known transfers", () => {
    expect(dayOrderComparisonResultText(comparison("equivalent")).headline)
      .toBe("Los traslados conocidos de ambos órdenes son iguales.");
  });

  it("does not invent a winner for overlapping ranges", () => {
    expect(dayOrderComparisonResultText(comparison("overlapping")).headline)
      .toBe("No hay una diferencia clara con los datos disponibles.");
  });

  it("keeps missing transfers incomplete instead of treating them as zero", () => {
    const result = dayOrderComparisonResultText(comparison("incomplete", false));
    expect(result.headline).toBe("Comparación incompleta: faltan traslados registrados.");
    expect(result.headline).not.toMatch(/menor tiempo/);
  });

  it("fails closed for an invalid same-set comparison", () => {
    expect(dayOrderComparisonResultText(comparison("invalid")).kind).toBe("error");
  });

  it("moves one proposal place directly to a chosen position without mutating the source", () => {
    const source = ["a", "b", "c", "d"];
    expect(movePlaceToPosition(source, 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(source).toEqual(["a", "b", "c", "d"]);
  });
});
