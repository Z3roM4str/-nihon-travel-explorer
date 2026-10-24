import { describe, expect, it } from "vitest";
import type { TransferEdge } from "./transfer";
import { buildOrderedSequence, orderedSequenceFromLookup } from "./ordered-sequence";

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

/** A tiny fixture graph: only the directed pairs listed here resolve to anything. Anything
 * else — including every reverse direction not listed explicitly — is `null`, exactly like a
 * real directed lookup that was never asked about that pair. */
function fixtureLookup(directed: Record<string, TransferEdge>) {
  return (fromId: string, toId: string): TransferEdge | null => directed[`${fromId}>${toId}`] ?? null;
}

describe("orderedSequenceFromLookup (pure fixtures)", () => {
  it("produces zero legs for an empty sequence", () => {
    const result = orderedSequenceFromLookup([], fixtureLookup({}));
    expect(result.legs).toEqual([]);
    expect(result.summary).toEqual({
      placeCount: 0,
      legCount: 0,
      knownLegCount: 0,
      unknownLegCount: 0,
      transferMinutes: null,
      complete: true,
    });
  });

  it("produces zero legs for a single place", () => {
    const result = orderedSequenceFromLookup(["A"], fixtureLookup({}));
    expect(result.legs).toEqual([]);
    expect(result.summary.placeCount).toBe(1);
    expect(result.summary.legCount).toBe(0);
    expect(result.summary.transferMinutes).toBeNull();
    // Vacuously true: there is no leg to be missing, but there is also no route to sum.
    expect(result.summary.complete).toBe(true);
  });

  it("resolves two places with a known exact directed transfer", () => {
    const ab = edge("A", "B", { minutes: { minMinutes: 8, maxMinutes: 12 } });
    const result = orderedSequenceFromLookup(["A", "B"], fixtureLookup({ "A>B": ab }));
    expect(result.legs).toEqual([{ fromId: "A", toId: "B", transfer: ab }]);
    expect(result.summary).toEqual({
      placeCount: 2,
      legCount: 1,
      knownLegCount: 1,
      unknownLegCount: 0,
      transferMinutes: { minMinutes: 8, maxMinutes: 12 },
      complete: true,
    });
  });

  it("sums every leg when the whole route is known", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 5, maxMinutes: 5 } }),
      "B>C": edge("B", "C", { minutes: { minMinutes: 10, maxMinutes: 15 } }),
      "C>D": edge("C", "D", { minutes: { minMinutes: 3, maxMinutes: 3 } }),
    });
    const result = orderedSequenceFromLookup(["A", "B", "C", "D"], lookup);
    expect(result.summary.legCount).toBe(3);
    expect(result.summary.knownLegCount).toBe(3);
    expect(result.summary.unknownLegCount).toBe(0);
    expect(result.summary.transferMinutes).toEqual({ minMinutes: 18, maxMinutes: 23 });
    expect(result.summary.complete).toBe(true);
  });

  it("keeps a missing middle leg unknown instead of fabricating or skipping it", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 5, maxMinutes: 5 } }),
      // B->C deliberately absent.
      "C>D": edge("C", "D", { minutes: { minMinutes: 7, maxMinutes: 7 } }),
    });
    const result = orderedSequenceFromLookup(["A", "B", "C", "D"], lookup);
    expect(result.legs).toEqual([
      { fromId: "A", toId: "B", transfer: expect.objectContaining({ minutes: { minMinutes: 5, maxMinutes: 5 } }) },
      { fromId: "B", toId: "C", transfer: null },
      { fromId: "C", toId: "D", transfer: expect.objectContaining({ minutes: { minMinutes: 7, maxMinutes: 7 } }) },
    ]);
    expect(result.summary.legCount).toBe(3);
    expect(result.summary.knownLegCount).toBe(2);
    expect(result.summary.unknownLegCount).toBe(1);
    // The known subtotal is still reported...
    expect(result.summary.transferMinutes).toEqual({ minMinutes: 12, maxMinutes: 12 });
    // ...but it must never be presented as the complete route total.
    expect(result.summary.complete).toBe(false);
  });

  it("never infers B→A from a recorded A→B — reversing the order changes the pair looked up", () => {
    const lookup = fixtureLookup({ "A>B": edge("A", "B") });
    const forward = orderedSequenceFromLookup(["A", "B"], lookup);
    const reverse = orderedSequenceFromLookup(["B", "A"], lookup);
    expect(forward.legs[0].transfer).not.toBeNull();
    expect(reverse.legs[0]).toEqual({ fromId: "B", toId: "A", transfer: null });
    expect(reverse.summary.complete).toBe(false);
  });

  it("never chains A→X→B into a direct A→B leg — only consecutive pairs are ever looked up", () => {
    const seenPairs: Array<[string, string]> = [];
    const lookup = (fromId: string, toId: string) => {
      seenPairs.push([fromId, toId]);
      // Only the consecutive pairs resolve; a direct A->C would resolve too if this function
      // were ever asked for it, which is exactly what this test asserts never happens.
      if (fromId === "A" && toId === "B") return edge("A", "B");
      if (fromId === "B" && toId === "C") return edge("B", "C");
      return edge(fromId, toId); // A->C (or any other skip) would "succeed" if ever asked.
    };
    const result = orderedSequenceFromLookup(["A", "B", "C"], lookup);
    expect(seenPairs).toEqual([
      ["A", "B"],
      ["B", "C"],
    ]);
    expect(seenPairs).not.toContainEqual(["A", "C"]);
    expect(result.legs.map((leg) => `${leg.fromId}>${leg.toId}`)).toEqual(["A>B", "B>C"]);
  });

  it("changing the order changes which pairs are looked up, not just their labels", () => {
    const lookup = fixtureLookup({
      "A>B": edge("A", "B", { minutes: { minMinutes: 1, maxMinutes: 1 } }),
      "B>C": edge("B", "C", { minutes: { minMinutes: 2, maxMinutes: 2 } }),
      // C->B and B->A are deliberately absent: reversing must not reuse the forward answers.
    });
    const original = orderedSequenceFromLookup(["A", "B", "C"], lookup);
    const reversed = orderedSequenceFromLookup(["C", "B", "A"], lookup);
    expect(original.summary.knownLegCount).toBe(2);
    expect(reversed.summary.knownLegCount).toBe(0);
    expect(reversed.legs.every((leg) => leg.transfer === null)).toBe(true);
  });
});

describe("buildOrderedSequence (real dataset)", () => {
  it("preserves a validated-static walking leg exactly as getBestTransfer returns it", () => {
    // JP-001 -> JP-008: real walking-scale result, snap-clean, promoted to validated-static.
    const result = buildOrderedSequence(["JP-001", "JP-008"]);
    expect(result.legs).toHaveLength(1);
    const [leg] = result.legs;
    expect(leg.transfer).not.toBeNull();
    expect(leg.transfer?.confidence).toBe("validated-static");
    expect(leg.transfer?.minutes).toEqual({ minMinutes: 6, maxMinutes: 6 });
    expect(result.summary).toEqual({
      placeCount: 2,
      legCount: 1,
      knownLegCount: 1,
      unknownLegCount: 0,
      transferMinutes: { minMinutes: 6, maxMinutes: 6 },
      complete: true,
    });
  });

  it("preserves an estimated leg exactly as getBestTransfer returns it", () => {
    // JP-015 -> JP-029: Transporte local, not covered by any walking artifact, so it stays
    // the honest geographic estimate rather than being promoted.
    const result = buildOrderedSequence(["JP-015", "JP-029"]);
    const [leg] = result.legs;
    expect(leg.transfer?.confidence).toBe("estimated");
    expect(leg.transfer?.mode).toBe("local-transit");
    expect(result.summary.complete).toBe(true);
  });

  it("stays honestly unknown for a real cross-hub pair with no recorded relation, never fabricating one", () => {
    // JP-001 (Tokio) -> JP-054 (Kioto): no nearby.json relation exists in either direction.
    const result = buildOrderedSequence(["JP-001", "JP-054"]);
    expect(result.legs).toEqual([{ fromId: "JP-001", toId: "JP-054", transfer: null }]);
    expect(result.summary).toEqual({
      placeCount: 2,
      legCount: 1,
      knownLegCount: 0,
      unknownLegCount: 1,
      transferMinutes: null,
      complete: false,
    });
  });

  it("keeps a real cross-hub gap in the middle of an otherwise-known route distinct from the known legs around it", () => {
    // JP-001 -> JP-002 (Tokio, validated-static) -> JP-054 (Kioto, no relation) -> JP-055
    // (Kioto, validated-static). The missing leg sits between two real, known legs.
    const result = buildOrderedSequence(["JP-001", "JP-002", "JP-054", "JP-055"]);
    expect(result.summary.legCount).toBe(3);
    expect(result.summary.knownLegCount).toBe(2);
    expect(result.summary.unknownLegCount).toBe(1);
    expect(result.legs[1]).toEqual({ fromId: "JP-002", toId: "JP-054", transfer: null });
    expect(result.legs[0].transfer).not.toBeNull();
    expect(result.legs[2].transfer).not.toBeNull();
    expect(result.summary.complete).toBe(false);
    // The known subtotal (4 + 10 = 14) is still meaningful, but never the route's total.
    expect(result.summary.transferMinutes).toEqual({ minMinutes: 14, maxMinutes: 14 });
  });

  it("does not infer the reverse of a real directed-only relation", () => {
    // JP-001 -> JP-005 is recorded; JP-005 -> JP-001 is not recorded in either artifact.
    const forward = buildOrderedSequence(["JP-001", "JP-005"]);
    const reverse = buildOrderedSequence(["JP-005", "JP-001"]);
    expect(forward.legs[0].transfer).not.toBeNull();
    expect(reverse.legs[0].transfer).toBeNull();
  });
});
