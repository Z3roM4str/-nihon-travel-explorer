import { describe, expect, it } from "vitest";
import type { TransferEdge } from "./transfer";
import { buildDayAssignment, dayAssignmentFromLookup } from "./day-assignment";

function edge(fromId: string, toId: string, overrides: Partial<TransferEdge> = {}): TransferEdge {
  return {
    fromId,
    toId,
    minutes: { minMinutes: 10, maxMinutes: 10 },
    distanceKm: 1,
    mode: "walk",
    rawMode: "A pie",
    relation: "nearby",
    rawRelation: "Cercano",
    confidence: "estimated",
    source: { kind: "derived-geographic", dataset: "nearby", method: "haversine-speed-model" },
    verifiedAt: null,
    ...overrides,
  };
}

/** Same convention as ordered-sequence.test.ts / sequence-comparison.test.ts: only listed
 * directed pairs resolve; every unlisted pair, including any reverse direction, is `null`. */
function fixtureLookup(directed: Record<string, TransferEdge>) {
  return (fromId: string, toId: string): TransferEdge | null => directed[`${fromId}>${toId}`] ?? null;
}

describe("dayAssignmentFromLookup — structural validity", () => {
  it("is valid for one day containing the full route in order", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B"),
      "B>C": edge("B", "C"),
    });
    const result = dayAssignmentFromLookup(["A", "B", "C"], [["A", "B", "C"]], lookup);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.days).toHaveLength(1);
    expect(result.days[0].placeIds).toEqual(["A", "B", "C"]);
  });

  it("is valid for multiple days partitioning the route", () => {
    const lookup = fixtureLookup({ "A>B": edge("A", "B"), "C>D": edge("C", "D") });
    const result = dayAssignmentFromLookup(["A", "B", "C", "D"], [["A", "B"], ["C", "D"]], lookup);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.days).toHaveLength(2);
  });

  it("preserves each day's explicit order rather than the route's original order", () => {
    const lookup = fixtureLookup({ "B>A": edge("B", "A"), "C>D": edge("C", "D") });
    // Route was [A, B, C, D]; day 1 reorders A/B, day 2 keeps C/D.
    const result = dayAssignmentFromLookup(["A", "B", "C", "D"], [["B", "A"], ["C", "D"]], lookup);
    expect(result.days[0].placeIds).toEqual(["B", "A"]);
    expect(result.days[0].sequence.legs).toEqual([{ fromId: "B", toId: "A", transfer: edge("B", "A") }]);
    expect(result.valid).toBe(true);
  });

  it("is invalid when a route id is missing from every day", () => {
    const result = dayAssignmentFromLookup(["A", "B", "C"], [["A", "B"]], fixtureLookup({}));
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("missing-route-ids");
  });

  it("is invalid when an extra id not in the route appears in a day", () => {
    const result = dayAssignmentFromLookup(["A", "B"], [["A", "B", "Z"]], fixtureLookup({}));
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("extra-ids");
  });

  it("is invalid when an id is duplicated within one day", () => {
    const result = dayAssignmentFromLookup(["A", "B"], [["A", "A", "B"]], fixtureLookup({}));
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("duplicate-in-day");
    expect(result.issues).not.toContain("duplicate-across-days");
  });

  it("is invalid when an id is duplicated across two different days", () => {
    const result = dayAssignmentFromLookup(["A", "B", "C"], [["A", "B"], ["B", "C"]], fixtureLookup({}));
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("duplicate-across-days");
    // B appears exactly once within each of its two days, so this is not also "duplicate-in-day".
    expect(result.issues).not.toContain("duplicate-in-day");
  });

  it("allows an empty day", () => {
    const lookup = fixtureLookup({ "A>B": edge("A", "B") });
    const result = dayAssignmentFromLookup(["A", "B"], [["A", "B"], []], lookup);
    expect(result.valid).toBe(true);
    expect(result.days[1].placeIds).toEqual([]);
    expect(result.days[1].sequence.legs).toEqual([]);
    expect(result.days[1].sequence.summary.complete).toBe(true); // vacuously — no legs to miss
  });

  it("requires at least one day bucket", () => {
    const result = dayAssignmentFromLookup(["A", "B"], [], fixtureLookup({}));
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("no-days");
  });

  it("handles a zero-leg single-place day without treating it as incomplete", () => {
    const result = dayAssignmentFromLookup(["A", "B"], [["A"], ["B"]], fixtureLookup({}));
    expect(result.valid).toBe(true); // A and B each appear exactly once, across two days
    expect(result.days[0].sequence.summary.legCount).toBe(0);
    expect(result.days[0].sequence.summary.complete).toBe(true);
    expect(result.days[1].sequence.summary.legCount).toBe(0);
    expect(result.days[1].sequence.summary.complete).toBe(true);
  });
});

describe("dayAssignmentFromLookup — day-boundary transfer rule", () => {
  it("queries only consecutive pairs inside one day, never the boundary between days", () => {
    const seenPairs: Array<[string, string]> = [];
    const lookup = (fromId: string, toId: string) => {
      seenPairs.push([fromId, toId]);
      return edge(fromId, toId); // every pair "succeeds" if ever asked — the point is what's asked
    };
    dayAssignmentFromLookup(["A", "B", "C", "D"], [["A", "B"], ["C", "D"]], lookup);
    expect(seenPairs).toEqual([
      ["A", "B"],
      ["C", "D"],
    ]);
    // The day-boundary pair (last of day 1 -> first of day 2) must never be queried.
    expect(seenPairs).not.toContainEqual(["B", "C"]);
  });

  it("never queries the day-boundary pair even across three days", () => {
    const seenPairs: Array<[string, string]> = [];
    const lookup = (fromId: string, toId: string) => {
      seenPairs.push([fromId, toId]);
      return edge(fromId, toId);
    };
    dayAssignmentFromLookup(["A", "B", "C", "D", "E", "F"], [["A", "B"], ["C", "D"], ["E", "F"]], lookup);
    expect(seenPairs).toEqual([
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
    ]);
    expect(seenPairs).not.toContainEqual(["B", "C"]);
    expect(seenPairs).not.toContainEqual(["D", "E"]);
  });

  it("directed lookup is preserved: reverse direction is never inferred within a day", () => {
    const lookup = fixtureLookup({ "A>B": edge("A", "B") }); // B->A deliberately absent
    const result = dayAssignmentFromLookup(["A", "B"], [["B", "A"]], lookup);
    expect(result.days[0].sequence.legs).toEqual([{ fromId: "B", toId: "A", transfer: null }]);
    expect(result.days[0].sequence.summary.complete).toBe(false);
  });

  it("never chains across a missing edge within a day — only consecutive pairs are queried", () => {
    const seenPairs: Array<[string, string]> = [];
    const lookup = (fromId: string, toId: string) => {
      seenPairs.push([fromId, toId]);
      if ((fromId === "A" && toId === "B") || (fromId === "B" && toId === "C")) return edge(fromId, toId);
      return edge(fromId, toId); // A->C would also "succeed" if ever asked — it never is.
    };
    dayAssignmentFromLookup(["A", "B", "C"], [["A", "B", "C"]], lookup);
    expect(seenPairs).toEqual([
      ["A", "B"],
      ["B", "C"],
    ]);
    expect(seenPairs).not.toContainEqual(["A", "C"]);
  });

  it("keeps a day incomplete when one same-day leg is missing, without affecting other days", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B"),
      // B -> C deliberately absent, same day.
      "D>E": edge("D", "E"),
    });
    const result = dayAssignmentFromLookup(
      ["A", "B", "C", "D", "E"],
      [["A", "B", "C"], ["D", "E"]],
      lookup
    );
    expect(result.days[0].sequence.summary.complete).toBe(false);
    expect(result.days[0].sequence.summary.knownLegCount).toBe(1);
    expect(result.days[0].sequence.summary.unknownLegCount).toBe(1);
    expect(result.days[1].sequence.summary.complete).toBe(true);
  });

  it("never mislabels a known subtotal as a complete total when a same-day leg is unknown", () => {
    const lookup = fixtureLookup({ "A>B": edge("A", "B", { minutes: { minMinutes: 20, maxMinutes: 20 } }) });
    // B -> C absent: day has a known subtotal (20 min) but is not complete.
    const result = dayAssignmentFromLookup(["A", "B", "C"], [["A", "B", "C"]], lookup);
    const { summary } = result.days[0].sequence;
    expect(summary.transferMinutes).toEqual({ minMinutes: 20, maxMinutes: 20 });
    expect(summary.complete).toBe(false);
  });
});

describe("buildDayAssignment (real dataset)", () => {
  it("keeps a real cross-hub gap placed in the SAME day as an honest incomplete leg", () => {
    // JP-001 (Tokio) and JP-054 (Kioto): no relation exists in either direction.
    const result = buildDayAssignment(["JP-001", "JP-054"], [["JP-001", "JP-054"]]);
    expect(result.valid).toBe(true);
    expect(result.days[0].sequence.legs).toEqual([{ fromId: "JP-001", toId: "JP-054", transfer: null }]);
    expect(result.days[0].sequence.summary.complete).toBe(false);
  });

  it("does not generate or query a transfer for the same cross-hub pair split across two days", () => {
    const seenPairs: Array<[string, string]> = [];
    const spy = (fromId: string, toId: string) => {
      seenPairs.push([fromId, toId]);
      return null;
    };
    // JP-001 alone in day 1, JP-054 alone in day 2 — same two places as above, but no day
    // boundary lookup is ever attempted between them.
    const result = dayAssignmentFromLookup(["JP-001", "JP-054"], [["JP-001"], ["JP-054"]], spy);
    expect(seenPairs).toEqual([]); // zero legs possible: each day has exactly one place
    expect(result.valid).toBe(true);
    expect(result.days[0].sequence.summary.complete).toBe(true); // vacuously — no legs at all
    expect(result.days[1].sequence.summary.complete).toBe(true);
  });

  it("preserves a real validated-static leg exactly as getBestTransfer returns it", () => {
    // JP-001 -> JP-008: real walking-scale result, snap-clean, validated-static, 6 min.
    const result = buildDayAssignment(["JP-001", "JP-008"], [["JP-001", "JP-008"]]);
    const [leg] = result.days[0].sequence.legs;
    expect(leg.transfer?.confidence).toBe("validated-static");
    expect(leg.transfer?.minutes).toEqual({ minMinutes: 6, maxMinutes: 6 });
    expect(result.days[0].sequence.summary.complete).toBe(true);
  });

  it("does not infer the reverse of a real directed-only relation across a day", () => {
    // JP-001 -> JP-005 is recorded; JP-005 -> JP-001 is not recorded in either artifact.
    const forward = buildDayAssignment(["JP-001", "JP-005"], [["JP-001", "JP-005"]]);
    const reverse = buildDayAssignment(["JP-005", "JP-001"], [["JP-005", "JP-001"]]);
    expect(forward.days[0].sequence.legs[0].transfer).not.toBeNull();
    expect(reverse.days[0].sequence.legs[0].transfer).toBeNull();
  });
});
