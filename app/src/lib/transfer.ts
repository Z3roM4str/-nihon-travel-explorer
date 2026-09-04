import nearbyData from "../data/nearby.json";
import walkingPilotResultsData from "../data/logistics/walking-pilot-results.json";
import walkingScaleResultsData from "../data/logistics/walking-scale-results.json";
import type { NearbyRelation, Place } from "../types";

/**
 * Transfer domain layer — Phase 3B1.
 *
 * `nearby.json` records 403 directed relations between places. Every one of them was
 * produced by taking each place's coordinates and a haversine distance, then applying a
 * fixed walking/transit speed model to estimate minutes — a geographic proximity estimate,
 * not a routed, schedule-aware, or otherwise validated transfer. This module gives those
 * relations a domain shape (`TransferEdge`) that a future phase can populate from a real
 * routing provider without changing anything that reads it: the confidence and provenance
 * fields exist precisely so an "estimated" edge can later become "validated-static" or
 * "schedule-aware" in place, while every current edge stays honestly labelled as an
 * estimate.
 *
 * This module does not read or duplicate `nearby.json` into a second dataset — it imports
 * the same file `app/src/data/store.ts` does, and converts on read. There is exactly one
 * source of the 403 relations.
 *
 * Deliberately absent, by design, not oversight:
 *   - No routing, ordering, or itinerary generation.
 *   - No aggregation across more than one edge (see "No aggregation without order" below).
 *   - No synthesis of an edge from geometry when the dataset has none.
 */

/**
 * How much to trust an edge's minutes/distance.
 *   - "estimated": derived from geographic proximity, as every current `nearby.json`
 *     relation is. No schedule, no routed path. `toTransferEdge()` never assigns
 *     anything else — this is the *only* confidence a direct `nearby.json` conversion
 *     can produce.
 *   - "validated-static": a real routed path/time, without live schedule awareness.
 *     Phase 3B2A's walking-validation pilot, and Phase 3B2B-C's scale-up integration,
 *     produce this (see `WalkingPilotResult` and `getBestTransfer` below) only for a
 *     walking manifest edge (pilot or scale-up) whose endpoint snapping was measured and
 *     found clean — never for a relation neither artifact covers, never for one whose
 *     snapping was significant or unmeasured, and never by mutating `toTransferEdge()`.
 *   - "schedule-aware": accounts for an actual timetable (e.g. a transit provider's
 *     departure/arrival lookup). Not produced anywhere yet.
 * `getBestTransfer` is the only function in this module that can return
 * "validated-static", and only by reading a precomputed pilot result — nothing here
 * calls a routing provider at read time.
 */
export type TransferConfidence = "estimated" | "validated-static" | "schedule-aware";

/**
 * Transfer modes that exist in the current 403 `nearby.json` relations, normalized to a
 * closed domain vocabulary. This is not a general transport catalogue — it does not (yet)
 * include Shinkansen, flights, or ferries, because none of those appear in `Modo` today.
 * An unrecognised `Modo` value fails loudly (`normalizeTransferMode` throws) rather than
 * being coerced into an arbitrary string.
 */
export type TransferMode = "walk" | "local-transit" | "disney-resort-line";

const MODE_BY_RAW: Record<string, TransferMode> = {
  "A pie": "walk",
  "Transporte local": "local-transit",
  "Disney Resort Line": "disney-resort-line",
};

/** Throws on any `Modo` value outside the current closed set. See `TransferMode`. */
export function normalizeTransferMode(rawMode: string): TransferMode {
  const mode = MODE_BY_RAW[rawMode];
  if (!mode) {
    throw new Error(`Unknown nearby transfer mode: ${JSON.stringify(rawMode)}`);
  }
  return mode;
}

/**
 * `Relación` values that exist in the current dataset, normalized the same way as mode.
 * This describes how the two places relate editorially (same cluster, nearby, an
 * alternative/complement) — it carries no transfer-quality meaning on its own.
 */
export type TransferRelation = "same-cluster" | "nearby" | "alternative";

const RELATION_BY_RAW: Record<string, TransferRelation> = {
  "Mismo cluster": "same-cluster",
  Cercano: "nearby",
  "Alternativas/complementos": "alternative",
};

/** Throws on any `Relación` value outside the current closed set. */
export function normalizeTransferRelation(rawRelation: string): TransferRelation {
  const relation = RELATION_BY_RAW[rawRelation];
  if (!relation) {
    throw new Error(`Unknown nearby relation kind: ${JSON.stringify(rawRelation)}`);
  }
  return relation;
}

/**
 * Structured provenance — never a decorative string. `kind` is the discriminant: a
 * consumer branches on it to know where an edge came from without parsing any text.
 *
 * `GeographicProvenance` is what every current `nearby.json` edge carries (see
 * `dataset`/`method` below). `RoutingProviderProvenance` (Phase 3B2A) is what a walking
 * edge validated against real routing carries instead. Adding a future provenance kind
 * (a transit provider, an official source) means adding a member to this union, never
 * repurposing an existing one's fields for a different meaning.
 */
export type GeographicProvenance = {
  kind: "derived-geographic";
  dataset: "nearby";
  method: "haversine-speed-model";
};

/**
 * A real routing provider's answer for one directed edge, precomputed offline (see
 * `scripts/validate-walking-pilot.py`) and never queried at runtime — nothing in this
 * module calls a routing API. `profile` is the provider's own travel-mode parameter,
 * kept distinct from our closed `TransferMode` because the two vocabularies serve
 * different purposes (provider request parameter vs. our domain's mode taxonomy).
 */
export type RoutingProviderProvenance = {
  kind: "routing-provider";
  provider: "openrouteservice";
  profile: "foot-walking";
};

export type TransferProvenance = GeographicProvenance | RoutingProviderProvenance;

const NEARBY_PROVENANCE: GeographicProvenance = {
  kind: "derived-geographic",
  dataset: "nearby",
  method: "haversine-speed-model",
};

/**
 * A directed transfer between two places. `minutes` is always a range — never a bare
 * number — so a future routing-grade edge with genuine min/max variance fits the same
 * shape a single-valued estimate uses today. For every edge converted from the current
 * dataset, `minMinutes === maxMinutes`: `nearby.json` records one "Min aprox." value, and
 * no tolerance (±10%, ±20%, or otherwise) is fabricated to turn it into a spread. The
 * uncertainty in that single number is represented by `confidence`, not by invented bounds.
 */
export type TransferEdge = {
  fromId: string;
  toId: string;
  minutes: { minMinutes: number; maxMinutes: number };
  distanceKm: number;
  mode: TransferMode;
  /** The original `Modo` text, kept for auditability alongside the normalized `mode`. */
  rawMode: string;
  relation: TransferRelation;
  /** The original `Relación` text, kept for auditability alongside `relation`. */
  rawRelation: string;
  confidence: TransferConfidence;
  source: TransferProvenance;
  /** ISO timestamp of independent validation, or null — every current edge is null. */
  verifiedAt: string | null;
};

/** Converts one raw `nearby.json` row into its domain shape. Pure; throws on an unknown
 * mode or relation rather than silently accepting an arbitrary string. */
export function toTransferEdge(relation: NearbyRelation): TransferEdge {
  const minutes = relation["Min aprox."];
  return {
    fromId: relation["Desde ID"],
    toId: relation["Hacia ID"],
    minutes: { minMinutes: minutes, maxMinutes: minutes },
    distanceKm: relation["Distancia km"],
    mode: normalizeTransferMode(relation["Modo"]),
    rawMode: relation["Modo"],
    relation: normalizeTransferRelation(relation["Relación"]),
    rawRelation: relation["Relación"],
    confidence: "estimated",
    source: NEARBY_PROVENANCE,
    verifiedAt: null,
  };
}

const nearbyRelations = nearbyData as NearbyRelation[];

function edgeKey(fromId: string, toId: string): string {
  return `${fromId}\u0000${toId}`;
}

const edgesByDirectedKey = new Map<string, TransferEdge>(
  nearbyRelations.map((relation) => [
    edgeKey(relation["Desde ID"], relation["Hacia ID"]),
    toTransferEdge(relation),
  ])
);

/**
 * Looks up the recorded transfer from `fromId` to `toId`, in that direction only.
 *
 * This is a directed dictionary lookup, nothing more:
 *   - It resolves an edge that actually exists in `nearby.json` — never a synthesized one.
 *   - It never reads the reverse direction: `A → B` existing implies nothing about
 *     `B → A`, even though most of today's relations happen to be recorded both ways.
 *   - It never computes distance/time from coordinates when no edge is recorded.
 *   - It never chains, joins, or searches for a shortest path across edges.
 *
 * Returns `null` when there is no recorded edge in that exact direction — a caller that
 * wants "is there any recorded relation between these two places" must check both
 * `lookupTransfer(a, b)` and `lookupTransfer(b, a)` explicitly, as `computeLogisticsMetrics`
 * does below.
 */
export function lookupTransfer(fromId: string, toId: string): TransferEdge | null {
  return edgesByDirectedKey.get(edgeKey(fromId, toId)) ?? null;
}

/**
 * Phase 3B2A — walking-validation pilot; Phase 3B2B-C — scale-up integration.
 *
 * `scripts/validate-walking-pilot.py` queries openrouteservice offline for a small,
 * deterministically chosen sample of "A pie" edges (see `docs/LOGISTICS.md`) and writes
 * `data/logistics/walking-pilot-results.json`; `scripts/validate-walking-scale.py` does the
 * same for the remaining 308 "A pie" edges, writing `data/logistics/walking-scale-results.json`.
 * The app reads both files as-is (each copied to `app/src/data/logistics/` exactly as
 * `nearby.json` is copied from `data/`). Nothing in this module ever calls a routing
 * provider — every result here was computed once, offline, and versioned.
 */

/** Query coordinates actually sent to the provider, kept for audit — `[lng, lat]`,
 * openrouteservice's order, not our `Place`'s `{lat, lng}`. */
export type WalkingPilotQuery = {
  fromCoordinates: [number, number];
  toCoordinates: [number, number];
};

/**
 * How far each endpoint had to move to land on a routable network edge (the
 * openrouteservice Snap endpoint's `snapped_distance`, in meters), and whether that
 * displacement is small enough that `distance`/`minutes` can be treated as directly
 * comparable to the distance between the original, unsnapped coordinates.
 *
 * Why this exists: two points can each snap to the same or a nearby spot on the road
 * graph, making the "routed" distance between them much smaller (or larger) than the
 * real distance between the coordinates a caller actually asked about — silently, with
 * no error from the Directions API. See docs/WALKING_PILOT.md's JP-063<->JP-065 finding
 * (routed 3.2 m between points ~22.2 m apart in reality) for a real example.
 *
 * `assessment` is a closed three-state outcome, mirroring
 * `scripts/logistics_common.py`'s `classify_endpoint_snapping`:
 *   - `"clean"`: both endpoints measured, combined displacement small relative to the
 *     routed distance — the routed value is comparable to the original coordinates.
 *   - `"significant"`: both endpoints measured, combined displacement large enough that
 *     the routed value should NOT be treated as comparable.
 *   - `"unknown"`: at least one endpoint's snap distance was never resolved (not yet
 *     measured, or the Snap query failed/found no point in radius). A `null` snap
 *     distance is NEVER averaged in as `0` meters to produce `"clean"` — an unmeasured
 *     endpoint means comparability was never established, which is a different fact
 *     from "measured and found small displacement". `reason` is only ever present
 *     alongside `"unknown"`.
 *
 * The whole field is optional because it is only captured going forward (see
 * `scripts/validate-walking-pilot.py`'s `--execute`) or via `--backfill-snapping`/a
 * one-off `--diagnose-snap`; a `"validated"` result from before this guard existed may
 * not carry it at all. Absence must be treated exactly like `"unknown"` by every
 * consumer — see `bestTransferFromLookups` below — never like `"clean"`.
 */
export type EndpointSnapping = {
  assessment: "clean" | "significant" | "unknown";
  fromSnapMeters: number | null;
  toSnapMeters: number | null;
  radiusMeters: number;
  reason?: string;
};

/**
 * One walking-validation outcome for one directed edge — the shared schema for both the
 * pilot artifact (`walking-pilot-results.json`) and the scale-up artifact
 * (`walking-scale-results.json`; see `buildValidatedWalkingIndex` below). A discriminated
 * union on `status`: only the `"validated"` member carries
 * `distance`/`minutes`/`confidence`/`source` — a failure can't accidentally be read as
 * "0 minutes" or "estimated" because those fields don't exist on it at the type level,
 * matching the pipeline's rule that a failed lookup is never silently converted into a
 * fabricated result.
 */
export type WalkingPilotResult =
  | {
      fromId: string;
      toId: string;
      provider: "openrouteservice";
      profile: "foot-walking";
      status: "validated";
      distance: { meters: number };
      minutes: { minMinutes: number; maxMinutes: number };
      confidence: "validated-static";
      /** ISO 8601 UTC timestamp of the actual query, never a commit or file date. */
      verifiedAt: string;
      source: RoutingProviderProvenance;
      query: WalkingPilotQuery;
      durationSecondsRaw?: number;
      attribution?: string;
      endpointSnapping?: EndpointSnapping;
    }
  | {
      fromId: string;
      toId: string;
      provider: "openrouteservice";
      profile: "foot-walking";
      status: "no-route" | "request-error";
      verifiedAt: string;
      query: WalkingPilotQuery;
      errorCode?: number;
      errorMessage?: string;
    };

type ValidatedWalkingResult = Extract<WalkingPilotResult, { status: "validated" }>;

/** One walking-artifact source to merge into the combined index: `results` is the raw
 * parsed JSON, `label` identifies the artifact in a duplicate-key error and nothing else
 * (never parsed back). */
export type WalkingResultSource = {
  label: string;
  results: WalkingPilotResult[];
};

/**
 * Merges any number of walking-artifact result arrays (today: the pilot and the scale-up)
 * into one directed-key index of `"validated"` results only — `"no-route"`/`"request-error"`
 * entries are terminal provider answers that carry no distance/minutes to index, so
 * `getBestTransfer` falls back to the `nearby.json` estimate for them exactly as it does
 * for a pair no walking artifact covers at all.
 *
 * The pilot's 24 edges and the scale-up's 308 edges are disjoint by construction (see
 * `docs/LOGISTICS.md`), but this function does not trust that invariant silently: if the
 * same directed edge ever turns up `"validated"` in more than one source, that is a
 * data-integrity bug, and this throws immediately rather than letting whichever source is
 * merged last silently overwrite the other.
 */
export function buildValidatedWalkingIndex(
  sources: readonly WalkingResultSource[]
): Map<string, ValidatedWalkingResult> {
  const index = new Map<string, ValidatedWalkingResult>();
  const labelByKey = new Map<string, string>();

  for (const { label, results } of sources) {
    for (const result of results) {
      if (result.status !== "validated") continue;
      const key = edgeKey(result.fromId, result.toId);
      const existingLabel = labelByKey.get(key);
      if (existingLabel) {
        throw new Error(
          `Duplicate directed walking edge ${result.fromId} -> ${result.toId}: already ` +
            `indexed from "${existingLabel}", also found in "${label}". Walking result ` +
            `artifacts must not overlap.`
        );
      }
      index.set(key, result);
      labelByKey.set(key, label);
    }
  }

  return index;
}

const walkingPilotResults = walkingPilotResultsData as WalkingPilotResult[];
const walkingScaleResults = walkingScaleResultsData as WalkingPilotResult[];

const validatedWalkingResultsByDirectedKey = buildValidatedWalkingIndex([
  { label: "walking-pilot-results.json", results: walkingPilotResults },
  { label: "walking-scale-results.json", results: walkingScaleResults },
]);

/** Directed lookup into the combined pilot + scale-up walking results, mirroring
 * `lookupTransfer`'s discipline: only a recorded `"validated"` result, in that exact
 * direction, or `null`. */
function lookupValidatedWalkingResult(fromId: string, toId: string): ValidatedWalkingResult | null {
  return validatedWalkingResultsByDirectedKey.get(edgeKey(fromId, toId)) ?? null;
}

/**
 * Merges a validated walking result (pilot or scale-up) into the full `TransferEdge`
 * shape. `mode`, `rawMode`, `relation` and `rawRelation` are never re-derived from the
 * provider — they come from `source`, the estimated edge for the same directed pair that
 * the walking manifest entry was built from. Only distance, minutes, confidence,
 * provenance and `verifiedAt` change.
 */
function toValidatedTransferEdge(result: ValidatedWalkingResult, source: TransferEdge): TransferEdge {
  return {
    fromId: result.fromId,
    toId: result.toId,
    minutes: result.minutes,
    distanceKm: result.distance.meters / 1000,
    mode: source.mode,
    rawMode: source.rawMode,
    relation: source.relation,
    rawRelation: source.rawRelation,
    confidence: result.confidence,
    source: result.source,
    verifiedAt: result.verifiedAt,
  };
}

/**
 * A validated result is only promotable to `"validated-static"` when its endpoint
 * snapping was measured and found clean. `assessment === "significant"` means the
 * routed distance/minutes are known NOT to be comparable to the original coordinates;
 * `assessment === "unknown"` means that was never established either way; and a
 * completely absent `endpointSnapping` (a pre-guard result) carries no measurement at
 * all. None of those three cases may promote — only an explicit `"clean"` can. This is
 * deliberately NOT "absence defaults to comparable": an unmeasured endpoint is treated
 * exactly like a measured-and-significant one, never like a measured-and-clean one.
 */
function isSnapClean(result: ValidatedWalkingResult): boolean {
  return result.endpointSnapping?.assessment === "clean";
}

/**
 * Pure core of `getBestTransfer`, with both lookups injected so tests can exercise the
 * preference order (validated-and-snap-clean > estimated > null) against fixture data
 * without depending on whatever `walking-pilot-results.json`/`walking-scale-results.json`
 * happen to contain right now. See `app/src/lib/transfer.test.ts`;
 * `logisticsMetricsFromLookup` uses the same seam pattern.
 */
export function bestTransferFromLookups(
  fromId: string,
  toId: string,
  lookupEstimated: (fromId: string, toId: string) => TransferEdge | null,
  lookupValidated: (fromId: string, toId: string) => ValidatedWalkingResult | null
): TransferEdge | null {
  const validated = lookupValidated(fromId, toId);
  const estimated = lookupEstimated(fromId, toId);
  if (validated && estimated && isSnapClean(validated)) return toValidatedTransferEdge(validated, estimated);
  return estimated;
}

/**
 * The preferred way to read a directed transfer: a validated-static result if the
 * combined walking index (pilot + scale-up) covers this exact directed edge AND its
 * endpoint snapping was measured and found clean (see `isSnapClean`), otherwise the
 * estimated `nearby.json` edge, otherwise `null`. Never fabricates a route, never runs
 * routing at call time — every provider answer this can return was precomputed by
 * `scripts/validate-walking-pilot.py` or `scripts/validate-walking-scale.py` and is read
 * from disk like `nearby.json` is. A `"no-route"` scale/pilot result carries no distance
 * to promote, so this falls back to the estimated edge for it exactly as it would for an
 * edge neither artifact covers.
 */
export function getBestTransfer(fromId: string, toId: string): TransferEdge | null {
  return bestTransferFromLookups(fromId, toId, lookupTransfer, lookupValidatedWalkingResult);
}

/*
 * No aggregation without order — deliberately absent from this module.
 *
 * A `Place[]` selection has no sequence, so there is no correct way to sum transfer times
 * across it: which edge would connect place 3 to place 4 depends entirely on an itinerary
 * order this module is never given. Do NOT add a `sumTransfers(places)`,
 * `selectionTransferTotal`, `hubTransferTotal`, or `clusterTransferTotalMinutes` here — any
 * such function would silently need to invent an order (e.g. array order, or worse, a
 * shortest-path search) to produce a number, and that number would misrepresent the
 * selection as a plan. A future aggregation belongs in a later phase (3C) and must take an
 * explicit sequence of ids/edges as input, never a bare `Place[]`.
 */

/**
 * Purely factual coverage/distance metrics over a set of places — no ordering, no routing,
 * no compactness classification (see 3B1 decision: compact/extended labels are deferred to
 * a later phase with an explicit, documented threshold).
 */
export type LogisticsMetrics = {
  placeCount: number;
  /** Unordered pairs among `placeCount` places: `n * (n - 1) / 2`. */
  possiblePairCount: number;
  /** Unordered pairs with a recorded edge in at least one direction; never double-counted
   * when both directions are recorded. */
  knownPairCount: number;
  /** `knownPairCount / possiblePairCount`; `0` when no pair is possible. */
  pairCoverage: number;
  /**
   * Min/max `distanceKm` across every directed edge actually recorded among the known
   * pairs — not one value per pair. A pair with both `A → B` and `B → A` recorded
   * contributes both distances as independent observations, even when they diverge; this
   * range is never collapsed to a single per-pair distance and never assumes the two
   * directions agree.
   */
  recordedDistanceRange: { minKm: number; maxKm: number } | null;
  /** Same maximum as `recordedDistanceRange.maxKm`, exposed on its own for convenience. */
  maxRecordedDistance: number | null;
};

/**
 * A pair is "known" when `nearby.json` records an edge in either direction between the two
 * places — this only asks whether a relation exists, it never assumes a found `A → B` edge
 * describes the `B → A` trip too, and it never picks, averages, or symmetrizes a direction:
 * both directed lookups are checked independently for every pair, every time.
 *
 * This is a plain function of an unordered id list plus a lookup — nothing here reads array
 * position — so the result cannot depend on the order `ids` (or the `places` a caller passes
 * to `computeLogisticsMetrics`) happen to be listed in. `lookup` is injected so tests can
 * exercise order-invariance and a divergent-direction pair without needing real dataset
 * fixtures; `computeLogisticsMetrics(places)` remains the only public entry point.
 */
export function logisticsMetricsFromLookup(
  ids: string[],
  lookup: (fromId: string, toId: string) => TransferEdge | null
): LogisticsMetrics {
  const placeCount = ids.length;
  const possiblePairCount = placeCount < 2 ? 0 : (placeCount * (placeCount - 1)) / 2;

  let knownPairCount = 0;
  const recordedDistances: number[] = [];

  for (let i = 0; i < placeCount; i += 1) {
    for (let j = i + 1; j < placeCount; j += 1) {
      const forward = lookup(ids[i], ids[j]);
      const backward = lookup(ids[j], ids[i]);

      // Exactly one increment per unordered pair, however many of the two directions exist.
      if (forward || backward) knownPairCount += 1;

      // Every recorded directed edge contributes its own distance observation — a pair with
      // both directions recorded contributes two, even when they diverge; neither is dropped
      // or averaged, and no symmetric edge is synthesized from the pair.
      if (forward) recordedDistances.push(forward.distanceKm);
      if (backward) recordedDistances.push(backward.distanceKm);
    }
  }

  const recordedDistanceRange =
    recordedDistances.length > 0
      ? { minKm: Math.min(...recordedDistances), maxKm: Math.max(...recordedDistances) }
      : null;

  return {
    placeCount,
    possiblePairCount,
    knownPairCount,
    pairCoverage: possiblePairCount > 0 ? knownPairCount / possiblePairCount : 0,
    recordedDistanceRange,
    maxRecordedDistance: recordedDistanceRange?.maxKm ?? null,
  };
}

export function computeLogisticsMetrics(places: Place[]): LogisticsMetrics {
  return logisticsMetricsFromLookup(
    places.map((place) => place.id),
    lookupTransfer
  );
}
