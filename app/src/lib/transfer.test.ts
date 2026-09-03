import { describe, expect, it } from "vitest";
import nearbyData from "../data/nearby.json";
import placesData from "../data/places.json";
import type { NearbyRelation, Place } from "../types";
import {
  computeLogisticsMetrics,
  logisticsMetricsFromLookup,
  lookupTransfer,
  normalizeTransferMode,
  normalizeTransferRelation,
  toTransferEdge,
} from "./transfer";
import type { TransferEdge } from "./transfer";

const nearbyRelations = nearbyData as NearbyRelation[];
const places = placesData as Place[];

function relation(overrides: Partial<NearbyRelation> = {}): NearbyRelation {
  return {
    "Desde ID": "JP-001",
    "Hacia ID": "JP-002",
    Desde: "A",
    Hacia: "B",
    "Distancia km": 0.5,
    "Min aprox.": 7,
    Modo: "A pie",
    Relación: "Cercano",
    Nota: "Estimación geográfica; validar ruta real",
    ...overrides,
  };
}

describe("toTransferEdge — current nearby relation → TransferEdge", () => {
  it("converts a real nearby.json row", () => {
    const raw = nearbyRelations[0];
    const edge = toTransferEdge(raw);
    expect(edge.fromId).toBe(raw["Desde ID"]);
    expect(edge.toId).toBe(raw["Hacia ID"]);
    expect(edge.distanceKm).toBe(raw["Distancia km"]);
  });

  it("is always confidence: estimated", () => {
    expect(toTransferEdge(relation()).confidence).toBe("estimated");
  });

  it("always has verifiedAt: null", () => {
    expect(toTransferEdge(relation()).verifiedAt).toBeNull();
  });

  it("carries structured, non-decorative provenance", () => {
    expect(toTransferEdge(relation()).source).toEqual({
      kind: "derived-geographic",
      dataset: "nearby",
      method: "haversine-speed-model",
    });
  });

  it("converts 'Min aprox.' to a range without inventing a tolerance", () => {
    const edge = toTransferEdge(relation({ "Min aprox.": 14 }));
    expect(edge.minutes).toEqual({ minMinutes: 14, maxMinutes: 14 });
  });

  it("normalizes every mode present in the current dataset", () => {
    expect(normalizeTransferMode("A pie")).toBe("walk");
    expect(normalizeTransferMode("Transporte local")).toBe("local-transit");
    expect(normalizeTransferMode("Disney Resort Line")).toBe("disney-resort-line");
  });

  it("rejects an unknown mode instead of accepting an arbitrary string", () => {
    expect(() => normalizeTransferMode("Shinkansen")).toThrow();
    expect(() => toTransferEdge(relation({ Modo: "Shinkansen" }))).toThrow();
  });

  it("normalizes every relation kind present in the current dataset", () => {
    expect(normalizeTransferRelation("Mismo cluster")).toBe("same-cluster");
    expect(normalizeTransferRelation("Cercano")).toBe("nearby");
    expect(normalizeTransferRelation("Alternativas/complementos")).toBe("alternative");
  });

  it("rejects an unknown relation kind", () => {
    expect(() => normalizeTransferRelation("Ruta óptima")).toThrow();
  });

  it("keeps the raw mode and relation text alongside the normalized values", () => {
    const edge = toTransferEdge(relation({ Modo: "A pie", Relación: "Mismo cluster" }));
    expect(edge.rawMode).toBe("A pie");
    expect(edge.rawRelation).toBe("Mismo cluster");
  });

  it("never produces validated-static or schedule-aware from a current relation", () => {
    for (const raw of nearbyRelations) {
      const edge = toTransferEdge(raw);
      expect(edge.confidence).not.toBe("validated-static");
      expect(edge.confidence).not.toBe("schedule-aware");
    }
  });
});

describe("all 403 current nearby relations", () => {
  it("all convert to TransferEdge without throwing", () => {
    const edges = nearbyRelations.map(toTransferEdge);
    expect(edges).toHaveLength(nearbyRelations.length);
  });

  it("every resulting edge has valid, non-empty from/to ids matching its source row", () => {
    nearbyRelations.forEach((raw, index) => {
      const edge = toTransferEdge(raw);
      expect(edge.fromId).toBe(raw["Desde ID"]);
      expect(edge.toId).toBe(raw["Hacia ID"]);
      expect(edge.fromId.length).toBeGreaterThan(0);
      expect(edge.toId.length).toBeGreaterThan(0);
      expect(edge, `relation #${index}`).toBeTruthy();
    });
  });

  it("every edge is confidence: estimated with verifiedAt: null", () => {
    for (const raw of nearbyRelations) {
      const edge = toTransferEdge(raw);
      expect(edge.confidence).toBe("estimated");
      expect(edge.verifiedAt).toBeNull();
    }
  });
});

describe("lookupTransfer — directed, non-synthetic", () => {
  it("resolves a relation that really exists", () => {
    const raw = nearbyRelations[0];
    const edge = lookupTransfer(raw["Desde ID"], raw["Hacia ID"]);
    expect(edge).not.toBeNull();
    expect(edge?.distanceKm).toBe(raw["Distancia km"]);
  });

  it("returns null when no edge is recorded, rather than fabricating one", () => {
    expect(lookupTransfer("JP-DOES-NOT-EXIST-1", "JP-DOES-NOT-EXIST-2")).toBeNull();
  });

  it("does not assume A → B implies B → A (directed semantics)", () => {
    // Find a recorded edge whose reverse is not itself recorded, if one exists in the
    // current dataset; the assertion that matters is that lookup never fabricates it.
    const recordedKeys = new Set(
      nearbyRelations.map((r) => `${r["Desde ID"]}>${r["Hacia ID"]}`)
    );
    const oneWay = nearbyRelations.find(
      (r) => !recordedKeys.has(`${r["Hacia ID"]}>${r["Desde ID"]}`)
    );
    if (oneWay) {
      expect(lookupTransfer(oneWay["Hacia ID"], oneWay["Desde ID"])).toBeNull();
    }
    // Directed lookup never falls back to the reverse direction on its own.
    expect(lookupTransfer("JP-999", "JP-998")).toBeNull();
  });

  it("never fabricates an edge from geometry when the dataset has none", () => {
    // Two real, distant places with no recorded nearby relation between them.
    const a = places[0];
    const farAway = places.find(
      (p) => p.hub !== a.hub && lookupTransfer(a.id, p.id) === null && lookupTransfer(p.id, a.id) === null
    );
    expect(farAway).toBeDefined();
    if (farAway) {
      expect(lookupTransfer(a.id, farAway.id)).toBeNull();
      expect(lookupTransfer(farAway.id, a.id)).toBeNull();
    }
  });
});

describe("no aggregation without order (regression)", () => {
  it("this module exposes no function that sums transfers over an unordered Place[]", async () => {
    const moduleExports = (await import("./transfer")) as Record<string, unknown>;
    const forbiddenNames = [
      "sumTransfers",
      "selectionTransferTotal",
      "hubTransferTotal",
      "clusterTransferTotalMinutes",
      "totalTransferMinutes",
    ];
    for (const name of forbiddenNames) {
      expect(moduleExports[name]).toBeUndefined();
    }
  });

  it("TransferEdge only connects exactly two named places — there is no multi-place total type", () => {
    // A TransferEdge is inherently pairwise (fromId/toId); this test documents that an
    // unordered Place[] cannot, by the shape of this module's API, produce a scalar total:
    // computeLogisticsMetrics reports counts and ranges, never a sum of minutes.
    const edge: TransferEdge = toTransferEdge(relation());
    expect(Object.keys(edge)).not.toContain("totalMinutes");
  });
});

describe("computeLogisticsMetrics", () => {
  function place(id: string): Place {
    return { id } as unknown as Place;
  }

  it("reports zero everything for an empty selection", () => {
    const metrics = computeLogisticsMetrics([]);
    expect(metrics).toEqual({
      placeCount: 0,
      possiblePairCount: 0,
      knownPairCount: 0,
      pairCoverage: 0,
      recordedDistanceRange: null,
      maxRecordedDistance: null,
    });
  });

  it("reports zero pairs for a single place", () => {
    const metrics = computeLogisticsMetrics([place("JP-001")]);
    expect(metrics.possiblePairCount).toBe(0);
    expect(metrics.knownPairCount).toBe(0);
    expect(metrics.pairCoverage).toBe(0);
  });

  it("reports full coverage for two places with a recorded edge", () => {
    const raw = nearbyRelations[0];
    const metrics = computeLogisticsMetrics([place(raw["Desde ID"]), place(raw["Hacia ID"])]);
    expect(metrics.possiblePairCount).toBe(1);
    expect(metrics.knownPairCount).toBe(1);
    expect(metrics.pairCoverage).toBe(1);
    expect(metrics.recordedDistanceRange).toEqual({
      minKm: raw["Distancia km"],
      maxKm: raw["Distancia km"],
    });
    expect(metrics.maxRecordedDistance).toBe(raw["Distancia km"]);
  });

  it("reports zero coverage for two places with no recorded edge", () => {
    const a = places[0];
    const farAway = places.find(
      (p) => p.hub !== a.hub && lookupTransfer(a.id, p.id) === null && lookupTransfer(p.id, a.id) === null
    );
    expect(farAway).toBeDefined();
    if (farAway) {
      const metrics = computeLogisticsMetrics([a, farAway]);
      expect(metrics.possiblePairCount).toBe(1);
      expect(metrics.knownPairCount).toBe(0);
      expect(metrics.pairCoverage).toBe(0);
      expect(metrics.recordedDistanceRange).toBeNull();
    }
  });

  it("computes possiblePairCount as n(n-1)/2 for more than two places", () => {
    const metrics = computeLogisticsMetrics([place("a"), place("b"), place("c"), place("d")]);
    expect(metrics.possiblePairCount).toBe(6);
  });
});

describe("nearby.json directed-edge uniqueness", () => {
  it("has no duplicate (Desde ID, Hacia ID) directed edge in the current dataset", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const raw of nearbyRelations) {
      const key = `${raw["Desde ID"]}>${raw["Hacia ID"]}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });
});

describe("computeLogisticsMetrics — order invariance", () => {
  function place(id: string): Place {
    return { id } as unknown as Place;
  }

  it("gives the same result for [A, B] and [B, A] on a real bidirectional pair", () => {
    const raw = nearbyRelations[0];
    // The fixture only proves something if this pair really is recorded both ways.
    expect(lookupTransfer(raw["Hacia ID"], raw["Desde ID"])).not.toBeNull();

    const a = place(raw["Desde ID"]);
    const b = place(raw["Hacia ID"]);
    expect(computeLogisticsMetrics([a, b])).toEqual(computeLogisticsMetrics([b, a]));
  });

  it("never double-counts a pair recorded in both directions", () => {
    const raw = nearbyRelations[0];
    const metrics = computeLogisticsMetrics([place(raw["Desde ID"]), place(raw["Hacia ID"])]);
    expect(metrics.possiblePairCount).toBe(1);
    expect(metrics.knownPairCount).toBe(1);
  });

  it("gives the same result across several orderings of 6 real places", () => {
    const ids = places.slice(0, 6).map((p) => p.id);
    const baseline = computeLogisticsMetrics(ids.map(place));
    const reversed = computeLogisticsMetrics([...ids].reverse().map(place));
    const shuffled = computeLogisticsMetrics(
      [ids[3], ids[0], ids[5], ids[1], ids[4], ids[2]].map(place)
    );
    expect(reversed).toEqual(baseline);
    expect(shuffled).toEqual(baseline);
  });
});

describe("logisticsMetricsFromLookup — injected lookup, divergent directions", () => {
  function fakeEdges(...rows: Array<[string, string, number]>) {
    const byKey = new Map(
      rows.map(([from, to, distanceKm]) => [
        `${from}>${to}`,
        toTransferEdge(relation({ "Desde ID": from, "Hacia ID": to, "Distancia km": distanceKm })),
      ])
    );
    return (fromId: string, toId: string) => byKey.get(`${fromId}>${toId}`) ?? null;
  }

  it("counts a pair once and includes both directions' distances when they diverge", () => {
    const lookup = fakeEdges(["A", "B", 1], ["B", "A", 5]);
    const metrics = logisticsMetricsFromLookup(["A", "B"], lookup);
    expect(metrics.possiblePairCount).toBe(1);
    expect(metrics.knownPairCount).toBe(1);
    expect(metrics.recordedDistanceRange).toEqual({ minKm: 1, maxKm: 5 });
    expect(metrics.maxRecordedDistance).toBe(5);
  });

  it("stays order-invariant even when the two directions diverge", () => {
    const lookup = fakeEdges(["A", "B", 1], ["B", "A", 5]);
    expect(logisticsMetricsFromLookup(["A", "B"], lookup)).toEqual(
      logisticsMetricsFromLookup(["B", "A"], lookup)
    );
  });

  it("uses only the one recorded direction's distance when the reverse is missing", () => {
    const lookup = fakeEdges(["A", "B", 2.5]);
    const metrics = logisticsMetricsFromLookup(["A", "B"], lookup);
    expect(metrics.knownPairCount).toBe(1);
    expect(metrics.recordedDistanceRange).toEqual({ minKm: 2.5, maxKm: 2.5 });
  });

  it("reports no known pair and no distance when neither direction is recorded", () => {
    const metrics = logisticsMetricsFromLookup(["A", "B"], () => null);
    expect(metrics.knownPairCount).toBe(0);
    expect(metrics.recordedDistanceRange).toBeNull();
  });
});
