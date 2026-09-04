import { describe, expect, it } from "vitest";
import nearbyData from "../data/nearby.json";
import placesData from "../data/places.json";
import walkingPilotResultsData from "../data/logistics/walking-pilot-results.json";
import walkingScaleResultsData from "../data/logistics/walking-scale-results.json";
import type { NearbyRelation, Place } from "../types";
import {
  bestTransferFromLookups,
  buildValidatedWalkingIndex,
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
    // A "clean" default so every existing test that doesn't care about snapping keeps
    // exercising the promotion path; tests that care about the gate override this.
    endpointSnapping: { assessment: "clean", fromSnapMeters: 1.0, toSnapMeters: 1.0, radiusMeters: 350 },
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

  it("getBestTransfer against the real walking-pilot-results.json and walking-scale-results.json: validated-static only for pairs either artifact validated AND found snap-clean, estimated for everything else", () => {
    // Live regression check against whatever this checkout's pilot + scale-up artifacts
    // actually contain — not a fixture. It must never promote a relation neither artifact
    // covers, and a validated pair must only come back validated-static when its endpoint
    // snapping was measured and found "clean" — a "significant" or "unknown" assessment,
    // or no endpointSnapping at all, must fall back to estimated, exactly like an
    // uncovered relation would. This also covers the scale-up's five no-route edges,
    // which carry no distance to promote and so must fall back like an uncovered relation.
    const validatedResults = [
      ...(walkingPilotResultsData as WalkingPilotResult[]),
      ...(walkingScaleResultsData as WalkingPilotResult[]),
    ].filter((r): r is Extract<WalkingPilotResult, { status: "validated" }> => r.status === "validated");
    expect(validatedResults.length).toBeGreaterThan(0); // the live pilot + scale-up have run in this checkout

    const snapCleanPairs = new Set(
      validatedResults
        .filter((r) => r.endpointSnapping?.assessment === "clean")
        .map((r) => `${r.fromId} ${r.toId}`)
    );
    const validatedButNotCleanPairs = new Set(
      validatedResults
        .filter((r) => r.endpointSnapping?.assessment !== "clean")
        .map((r) => `${r.fromId} ${r.toId}`)
    );

    let checkedValidated = 0;
    let checkedEstimated = 0;
    for (const raw of nearbyRelations) {
      const key = `${raw["Desde ID"]} ${raw["Hacia ID"]}`;
      const best = getBestTransfer(raw["Desde ID"], raw["Hacia ID"]);
      if (snapCleanPairs.has(key)) {
        expect(best?.confidence).toBe("validated-static");
        checkedValidated += 1;
      } else {
        expect(best?.confidence).toBe("estimated");
        checkedEstimated += 1;
        if (validatedButNotCleanPairs.has(key)) {
          // Confirms the fallback happened *because* of the snap gate, not by accident
          // (e.g. a missing estimated edge would also read "estimated" via null).
          expect(best).not.toBeNull();
        }
      }
    }
    expect(checkedValidated).toBe(snapCleanPairs.size);
    expect(checkedEstimated).toBe(nearbyRelations.length - snapCleanPairs.size);
  });

  it("getBestTransfer returns null for a pair with no recorded relation at all", () => {
    expect(getBestTransfer("JP-DOES-NOT-EXIST-1", "JP-DOES-NOT-EXIST-2")).toBeNull();
  });
});

describe("bestTransferFromLookups / getBestTransfer — endpoint-snapping gate", () => {
  it("does not promote a validated result whose endpoint snapping is significant", () => {
    const estimated = toTransferEdge(relation({ "Desde ID": "JP-001", "Hacia ID": "JP-008" }));
    const validated = validatedResult({
      endpointSnapping: { assessment: "significant", fromSnapMeters: 9.0, toSnapMeters: 10.4, radiusMeters: 350 },
    });
    const best = bestTransferFromLookups("JP-001", "JP-008", () => estimated, () => validated);
    expect(best?.confidence).toBe("estimated");
    expect(best).toBe(estimated);
  });

  it("does not promote a validated result whose endpoint snapping is unknown", () => {
    const estimated = toTransferEdge(relation({ "Desde ID": "JP-001", "Hacia ID": "JP-008" }));
    const validated = validatedResult({
      endpointSnapping: {
        assessment: "unknown",
        fromSnapMeters: null,
        toSnapMeters: 10.4,
        radiusMeters: 350,
        reason: "Snap query failed: timeout",
      },
    });
    const best = bestTransferFromLookups("JP-001", "JP-008", () => estimated, () => validated);
    expect(best?.confidence).toBe("estimated");
  });

  it("does not promote a validated result with no endpointSnapping recorded at all — absence is never treated as clean", () => {
    const estimated = toTransferEdge(relation({ "Desde ID": "JP-001", "Hacia ID": "JP-008" }));
    const withoutSnapping = validatedResult();
    delete (withoutSnapping as { endpointSnapping?: unknown }).endpointSnapping;
    const best = bestTransferFromLookups("JP-001", "JP-008", () => estimated, () => withoutSnapping);
    expect(best?.confidence).toBe("estimated");
    expect(best).toBe(estimated);
  });

  it("promotes a validated result whose endpoint snapping is explicitly clean", () => {
    const estimated = toTransferEdge(relation({ "Desde ID": "JP-001", "Hacia ID": "JP-008" }));
    const validated = validatedResult({
      endpointSnapping: { assessment: "clean", fromSnapMeters: 1.0, toSnapMeters: 1.0, radiusMeters: 350 },
    });
    const best = bestTransferFromLookups("JP-001", "JP-008", () => estimated, () => validated);
    expect(best?.confidence).toBe("validated-static");
  });

  it("Phase 3B2B-A: the gate holds generically over a synthetic batch of any size, not just the pilot's 24 — only 'clean' ever promotes", () => {
    // This does not depend on any real scale-up data (none has been executed yet —
    // see docs/WALKING_SCALE_PREP.md); it proves the rule itself scales past N=24
    // before a future phase ever produces a real walking-scale-results.json for
    // getBestTransfer to read.
    const assessments = ["clean", "significant", "unknown", undefined] as const;
    let syntheticEdgeIndex = 0;
    for (const assessment of assessments) {
      for (let i = 0; i < 50; i += 1) {
        const fromId = `JP-SCALE-${syntheticEdgeIndex}-A`;
        const toId = `JP-SCALE-${syntheticEdgeIndex}-B`;
        syntheticEdgeIndex += 1;
        const estimated = toTransferEdge(relation({ "Desde ID": fromId, "Hacia ID": toId }));
        const validated = validatedResult({
          fromId,
          toId,
          endpointSnapping:
            assessment === undefined
              ? undefined
              : { assessment, fromSnapMeters: assessment === "unknown" ? null : 1.0, toSnapMeters: 1.0, radiusMeters: 350 },
        });
        if (assessment === undefined) delete (validated as { endpointSnapping?: unknown }).endpointSnapping;
        const best = bestTransferFromLookups(fromId, toId, () => estimated, () => validated);
        expect(best?.confidence).toBe(assessment === "clean" ? "validated-static" : "estimated");
      }
    }
  });
});

describe("getBestTransfer — real JP-063<->JP-065 pilot finding (significant endpoint snapping)", () => {
  // docs/WALKING_PILOT.md: real separation ~22.2 m, routed distance 3.2 m — a textbook
  // significant-snap case. Both directions must fall back to the nearby.json estimate,
  // never be served as validated-static, regardless of what the pilot artifact recorded.
  it("JP-063 -> JP-065 falls back to estimated", () => {
    const best = getBestTransfer("JP-063", "JP-065");
    expect(best?.confidence).toBe("estimated");
  });

  it("JP-065 -> JP-063 falls back to estimated", () => {
    const best = getBestTransfer("JP-065", "JP-063");
    expect(best?.confidence).toBe("estimated");
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

describe("Phase 3B2B-C — walking scale integration (real data)", () => {
  it("resolves a snap-clean pilot edge to validated-static", () => {
    // JP-001 -> JP-008 is one of the pilot's 24 manifest edges, clean-snapped.
    const best = getBestTransfer("JP-001", "JP-008");
    expect(best?.confidence).toBe("validated-static");
    expect(best?.source).toEqual({
      kind: "routing-provider",
      provider: "openrouteservice",
      profile: "foot-walking",
    });
  });

  it("resolves a snap-clean scale-up edge to validated-static", () => {
    // JP-001 -> JP-002 is one of the scale-up's 308 manifest edges, clean-snapped —
    // disjoint from the pilot's manifest, only reachable through the scale artifact.
    const best = getBestTransfer("JP-001", "JP-002");
    expect(best?.confidence).toBe("validated-static");
    expect(best?.source).toEqual({
      kind: "routing-provider",
      provider: "openrouteservice",
      profile: "foot-walking",
    });
  });

  it("falls back to the nearby.json estimate for a real scale-up no-route edge, never 0 minutes or a fabricated distance", () => {
    // JP-089 -> JP-090 is one of the scale-up's five terminal no-route results.
    const best = getBestTransfer("JP-089", "JP-090");
    expect(best).not.toBeNull();
    expect(best?.confidence).toBe("estimated");
    expect(best?.minutes.minMinutes).toBeGreaterThan(0);
  });

  it("does not use the reverse direction automatically for the no-route pair, even though both directions are recorded no-route", () => {
    const forward = getBestTransfer("JP-089", "JP-090");
    const backward = getBestTransfer("JP-090", "JP-089");
    expect(forward?.confidence).toBe("estimated");
    expect(backward?.confidence).toBe("estimated");
    // Each direction resolves independently from nearby.json, not from the other's result.
    expect(forward?.fromId).toBe("JP-089");
    expect(backward?.fromId).toBe("JP-090");
  });
});

describe("Phase 3B2B-C — scale-sourced validated result still honors the snap gate", () => {
  it("a scale-sourced validated result with significant endpoint snapping falls back to estimated", () => {
    const estimated = toTransferEdge(relation({ "Desde ID": "JP-SCALE-SIG-A", "Hacia ID": "JP-SCALE-SIG-B" }));
    const validated = validatedResult({
      fromId: "JP-SCALE-SIG-A",
      toId: "JP-SCALE-SIG-B",
      endpointSnapping: { assessment: "significant", fromSnapMeters: 12, toSnapMeters: 15, radiusMeters: 350 },
    });
    const best = bestTransferFromLookups(
      "JP-SCALE-SIG-A",
      "JP-SCALE-SIG-B",
      () => estimated,
      () => validated
    );
    expect(best?.confidence).toBe("estimated");
    expect(best).toBe(estimated);
  });
});

describe("buildValidatedWalkingIndex — duplicate directed-edge protection between pilot and scale", () => {
  it("merges disjoint pilot and scale-up sources into one index without collision", () => {
    const pilotFixture = [validatedResult({ fromId: "JP-A", toId: "JP-B" })];
    const scaleFixture = [validatedResult({ fromId: "JP-C", toId: "JP-D" })];
    const index = buildValidatedWalkingIndex([
      { label: "pilot", results: pilotFixture },
      { label: "scale", results: scaleFixture },
    ]);
    expect(index.size).toBe(2);
    expect(index.get(`JP-A\u0000JP-B`)?.toId).toBe("JP-B");
    expect(index.get(`JP-C\u0000JP-D`)?.toId).toBe("JP-D");
  });

  it("throws explicitly, and does not silently overwrite, when the same directed edge is validated in both the pilot and the scale-up source", () => {
    const pilotFixture = [validatedResult({ fromId: "JP-DUP", toId: "JP-DUP2", minutes: { minMinutes: 5, maxMinutes: 5 } })];
    const scaleFixture = [validatedResult({ fromId: "JP-DUP", toId: "JP-DUP2", minutes: { minMinutes: 99, maxMinutes: 99 } })];
    let caught: unknown;
    try {
      buildValidatedWalkingIndex([
        { label: "walking-pilot-results.json", results: pilotFixture },
        { label: "walking-scale-results.json", results: scaleFixture },
      ]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("JP-DUP -> JP-DUP2");
    expect((caught as Error).message).toContain("walking-pilot-results.json");
    expect((caught as Error).message).toContain("walking-scale-results.json");
  });

  it("ignores non-validated (no-route / request-error) entries entirely when checking for duplicate keys", () => {
    const noRouteEntry = (): WalkingPilotResult => ({
      fromId: "JP-NR",
      toId: "JP-NR2",
      provider: "openrouteservice",
      profile: "foot-walking",
      status: "no-route",
      verifiedAt: "2026-01-01T00:00:00Z",
      query: { fromCoordinates: [0, 0], toCoordinates: [1, 1] },
    });

    // The same directed pair appears as a terminal no-route answer in both sources —
    // this must never trip the duplicate-validated guard, since neither entry is validated.
    expect(() =>
      buildValidatedWalkingIndex([
        { label: "pilot", results: [noRouteEntry()] },
        { label: "scale", results: [noRouteEntry()] },
      ])
    ).not.toThrow();

    const index = buildValidatedWalkingIndex([
      { label: "pilot", results: [noRouteEntry()] },
      { label: "scale", results: [noRouteEntry()] },
    ]);
    expect(index.size).toBe(0);
  });

  it("the real pilot and scale-up artifacts build without throwing (live regression: no directed-key collision in this checkout)", () => {
    expect(() => getBestTransfer("JP-001", "JP-002")).not.toThrow();
  });
});
