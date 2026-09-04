import { describe, expect, it } from "vitest";
import nearbyData from "../data/nearby.json";
import placesData from "../data/places.json";
import walkingPilotResultsData from "../data/logistics/walking-pilot-results.json";
import type { NearbyRelation, Place } from "../types";
import {
  bestTransferFromLookups,
  computeLogisticsMetrics,
  getBestTransfer,
  logisticsMetricsFromLookup,
  lookupTransfer,
  normalizeTransferMode,
  normalizeTransferRelation,
  toTransferEdge,
} from "./transfer";
import type { TransferEdge, WalkingPilotResult } from "./transfer";

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

function validatedResult(overrides: Partial<Extract<WalkingPilotResult, { status: "validated" }>> = {}) {
  return {
    fromId: "JP-001",
    toId: "JP-008",
    provider: "openrouteservice",
    profile: "foot-walking",
    status: "validated",
    distance: { meters: 320 },
    minutes: { minMinutes: 4, maxMinutes: 4 },
    confidence: "validated-static",
    verifiedAt: "2026-09-04T12:00:00Z",
    source: { kind: "routing-provider", provider: "openrouteservice", profile: "foot-walking" },
    query: { fromCoordinates: [139.7005, 35.6595], toCoordinates: [139.6988, 35.662] },
    ...overrides,
  } as Extract<WalkingPilotResult, { status: "validated" }>;
}

describe("bestTransferFromLookups / getBestTransfer — Phase 3B2A", () => {
  it("prefers a validated-static result over the estimated edge for the same directed pair", () => {
    const estimated = toTransferEdge(relation({ "Desde ID": "JP-001", "Hacia ID": "JP-008" }));
    const validated = validatedResult();
    const best = bestTransferFromLookups(
      "JP-001",
      "JP-008",
      () => estimated,
      () => validated
    );
    expect(best?.confidence).toBe("validated-static");
    expect(best?.distanceKm).toBe(0.32);
    expect(best?.minutes).toEqual({ minMinutes: 4, maxMinutes: 4 });
    expect(best?.source).toEqual({
      kind: "routing-provider",
      provider: "openrouteservice",
      profile: "foot-walking",
    });
    expect(best?.verifiedAt).toBe("2026-09-04T12:00:00Z");
  });

  it("carries mode/relation over from the estimated edge, never fabricating them", () => {
    const estimated = toTransferEdge(
      relation({ "Desde ID": "JP-001", "Hacia ID": "JP-008", Modo: "A pie", Relación: "Mismo cluster" })
    );
    const best = bestTransferFromLookups("JP-001", "JP-008", () => estimated, () => validatedResult());
    expect(best?.mode).toBe("walk");
    expect(best?.rawMode).toBe("A pie");
    expect(best?.relation).toBe("same-cluster");
    expect(best?.rawRelation).toBe("Mismo cluster");
  });

  it("falls back to the estimated edge when no validated result exists", () => {
    const estimated = toTransferEdge(relation());
    const best = bestTransferFromLookups(
      "JP-001",
      "JP-002",
      () => estimated,
      () => null
    );
    expect(best).toBe(estimated);
    expect(best?.confidence).toBe("estimated");
  });

  it("returns null when neither a validated result nor an estimated edge exists", () => {
    const best = bestTransferFromLookups("JP-X", "JP-Y", () => null, () => null);
    expect(best).toBeNull();
  });

  it("does not promote an orphaned validated result with no matching estimated edge", () => {
    // Defensive case: a validated result should only ever exist for a pair the pilot
    // manifest drew from an existing nearby.json edge, but the resolution rule itself
    // must not silently fabricate mode/relation if that invariant were ever violated.
    const best = bestTransferFromLookups(
      "JP-001",
      "JP-008",
      () => null,
      () => validatedResult()
    );
    expect(best).toBeNull();
  });

  it("is directed: a validated A->B result does not apply to a B->A lookup", () => {
    const estimatedReverse = toTransferEdge(
      relation({ "Desde ID": "JP-008", "Hacia ID": "JP-001", Modo: "A pie" })
    );
    const best = bestTransferFromLookups(
      "JP-008",
      "JP-001",
      () => estimatedReverse,
      (fromId, toId) => (fromId === "JP-001" && toId === "JP-008" ? validatedResult() : null)
    );
    expect(best?.confidence).toBe("estimated");
  });

  it("getBestTransfer against the real walking-pilot-results.json: validated-static only for pilot-covered pairs, estimated for every other current relation", () => {
    // Live regression check against whatever this checkout's pilot artifact actually
    // contains — not a fixture. It must never promote a relation the pilot didn't cover,
    // and every relation it did cover must come back validated-static, not estimated.
    const validatedPairs = new Set(
      (walkingPilotResultsData as WalkingPilotResult[])
        .filter((r) => r.status === "validated")
        .map((r) => `${r.fromId} ${r.toId}`)
    );
    expect(validatedPairs.size).toBeGreaterThan(0); // the live pilot has run in this checkout

    let checkedValidated = 0;
    let checkedEstimated = 0;
    for (const raw of nearbyRelations) {
      const key = `${raw["Desde ID"]} ${raw["Hacia ID"]}`;
      const best = getBestTransfer(raw["Desde ID"], raw["Hacia ID"]);
      if (validatedPairs.has(key)) {
        expect(best?.confidence).toBe("validated-static");
        checkedValidated += 1;
      } else {
        expect(best?.confidence).toBe("estimated");
        checkedEstimated += 1;
      }
    }
    expect(checkedValidated).toBe(validatedPairs.size);
    expect(checkedEstimated).toBe(nearbyRelations.length - validatedPairs.size);
  });

  it("getBestTransfer returns null for a pair with no recorded relation at all", () => {
    expect(getBestTransfer("JP-DOES-NOT-EXIST-1", "JP-DOES-NOT-EXIST-2")).toBeNull();
  });
});

describe("TransferProvenance discriminated union", () => {
  it("distinguishes derived-geographic from routing-provider by kind alone, no string parsing", () => {
    const geoEdge = toTransferEdge(relation());
    expect(geoEdge.source.kind).toBe("derived-geographic");

    const estimated = toTransferEdge(relation({ "Desde ID": "JP-001", "Hacia ID": "JP-008" }));
    const best = bestTransferFromLookups("JP-001", "JP-008", () => estimated, () => validatedResult());
    expect(best?.source.kind).toBe("routing-provider");
    if (best && best.source.kind === "routing-provider") {
      expect(best.source.provider).toBe("openrouteservice");
      expect(best.source.profile).toBe("foot-walking");
    }
  });

  it("every current nearby-derived edge is still derived-geographic, never routing-provider", () => {
    for (const raw of nearbyRelations) {
      expect(toTransferEdge(raw).source.kind).toBe("derived-geographic");
    }
  });
});
