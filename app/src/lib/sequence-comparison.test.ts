import { describe, expect, it } from "vitest";
import type { TransferEdge } from "./transfer";
import { compareSequences, sequenceComparisonFromLookup } from "./sequence-comparison";

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

/** Same convention as ordered-sequence.test.ts: only listed directed pairs resolve; every
 * unlisted pair, including any reverse direction, is `null`. */
function fixtureLookup(directed: Record<string, TransferEdge>) {
  return (fromId: string, toId: string): TransferEdge | null => directed[`${fromId}>${toId}`] ?? null;
}

describe("sequenceComparisonFromLookup — same-set invariant", () => {
  it("treats identical candidate orders as equivalent", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 5, maxMinutes: 8 } }),
      "B>C": edge("B", "C", { minutes: { minMinutes: 3, maxMinutes: 3 } }),
    });
    const result = sequenceComparisonFromLookup(["A", "B", "C"], ["A", "B", "C"], lookup);
    expect(result.sameSet).toBe(true);
    expect(result.outcome).toBe("equivalent");
    expect(result.guaranteedAdvantageMinutes).toBeNull();
  });

  it("accepts the same set of places in a different order", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 5, maxMinutes: 5 } }),
      "B>C": edge("B", "C", { minutes: { minMinutes: 5, maxMinutes: 5 } }),
      "C>B": edge("C", "B", { minutes: { minMinutes: 5, maxMinutes: 5 } }),
      "B>A": edge("B", "A", { minutes: { minMinutes: 5, maxMinutes: 5 } }),
    });
    const result = sequenceComparisonFromLookup(["A", "B", "C"], ["C", "B", "A"], lookup);
    expect(result.sameSet).toBe(true);
    expect(result.outcome).not.toBe("invalid");
  });

  it("rejects mismatching sets as invalid", () => {
    const result = sequenceComparisonFromLookup(["A", "B", "C"], ["A", "B", "D"], fixtureLookup({}));
    expect(result.sameSet).toBe(false);
    expect(result.outcome).toBe("invalid");
    expect(result.guaranteedAdvantageMinutes).toBeNull();
  });

  it("rejects a duplicate id within one candidate as invalid, even if the other side matches by count", () => {
    const result = sequenceComparisonFromLookup(["A", "A", "B"], ["A", "B", "C"], fixtureLookup({}));
    expect(result.sameSet).toBe(false);
    expect(result.outcome).toBe("invalid");
  });

  it("rejects a duplicate id present in both candidates identically — same multiset is still not the same set", () => {
    const result = sequenceComparisonFromLookup(["A", "A", "B"], ["A", "A", "B"], fixtureLookup({}));
    expect(result.outcome).toBe("invalid");
  });
});

describe("sequenceComparisonFromLookup — winner rules", () => {
  it("declares A clearly faster when A's full range sits strictly below B's", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 20, maxMinutes: 25 } }),
      "B>A": edge("B", "A", { minutes: { minMinutes: 30, maxMinutes: 35 } }),
    });
    const result = sequenceComparisonFromLookup(["A", "B"], ["B", "A"], lookup);
    expect(result.outcome).toBe("a-clearly-faster");
    expect(result.guaranteedAdvantageMinutes).toBe(5); // 30 - 25
    expect(result.possibleAdvantageRange).toEqual({ minMinutes: 5, maxMinutes: 15 }); // [30-25, 35-20]
  });

  it("declares B clearly faster when B's full range sits strictly below A's", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 60, maxMinutes: 70 } }),
      "B>A": edge("B", "A", { minutes: { minMinutes: 40, maxMinutes: 45 } }),
    });
    const result = sequenceComparisonFromLookup(["A", "B"], ["B", "A"], lookup);
    expect(result.outcome).toBe("b-clearly-faster");
    expect(result.guaranteedAdvantageMinutes).toBe(15); // 60 - 45
  });

  it("never declares a winner when ranges overlap", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 40, maxMinutes: 60 } }),
      "B>A": edge("B", "A", { minutes: { minMinutes: 50, maxMinutes: 70 } }),
    });
    const result = sequenceComparisonFromLookup(["A", "B"], ["B", "A"], lookup);
    expect(result.outcome).toBe("overlapping");
    expect(result.guaranteedAdvantageMinutes).toBeNull();
  });

  it("declares equivalent when both ranges are exactly equal", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 20, maxMinutes: 25 } }),
      "B>A": edge("B", "A", { minutes: { minMinutes: 20, maxMinutes: 25 } }),
    });
    const result = sequenceComparisonFromLookup(["A", "B"], ["B", "A"], lookup);
    expect(result.outcome).toBe("equivalent");
    expect(result.guaranteedAdvantageMinutes).toBeNull();
  });

  it("produces an exact delta for exact single-value ranges", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 20, maxMinutes: 20 } }),
      "B>A": edge("B", "A", { minutes: { minMinutes: 25, maxMinutes: 25 } }),
    });
    const result = sequenceComparisonFromLookup(["A", "B"], ["B", "A"], lookup);
    expect(result.outcome).toBe("a-clearly-faster");
    expect(result.guaranteedAdvantageMinutes).toBe(5);
    expect(result.possibleAdvantageRange).toEqual({ minMinutes: 5, maxMinutes: 5 });
  });
});

describe("sequenceComparisonFromLookup — unknown legs never fabricate a winner", () => {
  it("is incomplete when candidate A has an unknown leg", () => {
    const lookup = fixtureLookup({
      // A -> B missing.
      "B>A": edge("B", "A", { minutes: { minMinutes: 10, maxMinutes: 10 } }),
    });
    const result = sequenceComparisonFromLookup(["A", "B"], ["B", "A"], lookup);
    expect(result.outcome).toBe("incomplete");
    expect(result.candidateA.sequence.summary.complete).toBe(false);
    expect(result.candidateB.sequence.summary.complete).toBe(true);
  });

  it("is incomplete when candidate B has an unknown leg", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 10, maxMinutes: 10 } }),
      // B -> A missing.
    });
    const result = sequenceComparisonFromLookup(["A", "B"], ["B", "A"], lookup);
    expect(result.outcome).toBe("incomplete");
  });

  it("is incomplete when both candidates have an unknown leg", () => {
    const result = sequenceComparisonFromLookup(["A", "B"], ["B", "A"], fixtureLookup({}));
    expect(result.outcome).toBe("incomplete");
    expect(result.candidateA.sequence.summary.complete).toBe(false);
    expect(result.candidateB.sequence.summary.complete).toBe(false);
  });

  it("never lets a smaller known subtotal with an unknown leg beat a larger fully-known total", () => {
    // Order A (X->Y->Z): X->Y known (40 min), Y->Z unrecorded => incomplete, known subtotal 40.
    // Order B (Z->Y->X): Z->Y known (30 min), Y->X known (25 min) => complete, total 55.
    // A's known subtotal (40) is smaller than B's complete total (55), but A must NOT win.
    const lookup = fixtureLookup({
      "X>Y": edge("X", "Y", { minutes: { minMinutes: 40, maxMinutes: 40 } }),
      // Y -> Z deliberately absent.
      "Z>Y": edge("Z", "Y", { minutes: { minMinutes: 30, maxMinutes: 30 } }),
      "Y>X": edge("Y", "X", { minutes: { minMinutes: 25, maxMinutes: 25 } }),
    });
    const result = sequenceComparisonFromLookup(["X", "Y", "Z"], ["Z", "Y", "X"], lookup);
    expect(result.candidateA.sequence.summary.complete).toBe(false);
    expect(result.candidateA.sequence.summary.transferMinutes).toEqual({ minMinutes: 40, maxMinutes: 40 });
    expect(result.candidateB.sequence.summary.complete).toBe(true);
    expect(result.candidateB.sequence.summary.transferMinutes).toEqual({ minMinutes: 55, maxMinutes: 55 });
    // Despite A's smaller known subtotal, the comparison must refuse to pick a winner.
    expect(result.outcome).toBe("incomplete");
    expect(result.guaranteedAdvantageMinutes).toBeNull();
  });
});

describe("sequenceComparisonFromLookup — directed lookup guarantees", () => {
  it("changing the order changes which exact consecutive pairs are looked up", () => {
    const seenPairs: Array<[string, string]> = [];
    const lookup = (fromId: string, toId: string) => {
      seenPairs.push([fromId, toId]);
      return edge(fromId, toId);
    };
    sequenceComparisonFromLookup(["A", "B", "C"], ["C", "B", "A"], lookup);
    expect(seenPairs).toEqual([
      ["A", "B"],
      ["B", "C"],
      ["C", "B"],
      ["B", "A"],
    ]);
  });

  it("never infers the reverse of a recorded direction for either candidate", () => {
    const lookup = fixtureLookup({ "A>B": edge("A", "B") }); // B->A deliberately absent
    const result = sequenceComparisonFromLookup(["A", "B"], ["B", "A"], lookup);
    expect(result.candidateA.sequence.legs[0].transfer).not.toBeNull();
    expect(result.candidateB.sequence.legs[0].transfer).toBeNull();
  });

  it("never chains across a missing edge in either candidate — only consecutive pairs are ever queried", () => {
    const seenPairs: Array<[string, string]> = [];
    const lookup = (fromId: string, toId: string) => {
      seenPairs.push([fromId, toId]);
      if ((fromId === "A" && toId === "B") || (fromId === "B" && toId === "C")) return edge(fromId, toId);
      if ((fromId === "C" && toId === "B") || (fromId === "B" && toId === "A")) return edge(fromId, toId);
      return edge(fromId, toId); // A->C / C->A would also "succeed" if ever asked — they never are.
    };
    sequenceComparisonFromLookup(["A", "B", "C"], ["C", "B", "A"], lookup);
    expect(seenPairs).not.toContainEqual(["A", "C"]);
    expect(seenPairs).not.toContainEqual(["C", "A"]);
  });
});

describe("compareSequences (real dataset)", () => {
  it("marks a real cross-hub gap as incomplete rather than fabricating or ignoring it", () => {
    // JP-001 (Tokio) <-> JP-054 (Kioto): no relation exists in either direction.
    const result = compareSequences(["JP-001", "JP-054"], ["JP-054", "JP-001"]);
    expect(result.sameSet).toBe(true);
    expect(result.outcome).toBe("incomplete");
    expect(result.candidateA.sequence.summary.knownLegCount).toBe(0);
    expect(result.candidateB.sequence.summary.knownLegCount).toBe(0);
  });

  it("derives validated/estimated counts correctly from real legs", () => {
    // JP-001 <-> JP-008 is validated-static in both directions (each measured independently),
    // so both candidates tally one validated-static leg each — the count reflects the actual
    // leg's confidence, not an assumption that only the "forward" direction could be known.
    const walking = compareSequences(["JP-001", "JP-008"], ["JP-008", "JP-001"]);
    expect(walking.candidateA.confidenceCounts).toEqual({ validatedStatic: 1, estimated: 0, scheduleAware: 0 });
    expect(walking.candidateB.confidenceCounts).toEqual({ validatedStatic: 1, estimated: 0, scheduleAware: 0 });
    expect(walking.outcome).toBe("equivalent"); // same 6-6 range both ways

    // JP-001 -> JP-005 is a real validated-static leg; JP-005 -> JP-001 is not recorded in
    // either artifact, so candidate B's leg is unknown and the comparison is incomplete — but
    // candidate A's tally must still reflect its one real known leg.
    const directedOnly = compareSequences(["JP-001", "JP-005"], ["JP-005", "JP-001"]);
    expect(directedOnly.candidateA.confidenceCounts).toEqual({ validatedStatic: 1, estimated: 0, scheduleAware: 0 });
    expect(directedOnly.candidateB.confidenceCounts).toEqual({ validatedStatic: 0, estimated: 0, scheduleAware: 0 });
    expect(directedOnly.outcome).toBe("incomplete");
  });
});
