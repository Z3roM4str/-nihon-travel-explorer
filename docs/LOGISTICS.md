# Logistics data model

Phase 3B1 gives the existing `nearby.json` relations a domain shape (`app/src/lib/transfer.ts`)
without raising their confidence, generating itineraries, or calling any external routing
service. This document explains what that layer is, what it is not, and the boundary with the
phase that follows it.

## Visit time vs. transfer data

These are two different kinds of number that this codebase has always kept apart and that
Phase 3B1 does not change:

- **Visit time** (`duration` on `Place`, aggregated in `app/src/lib/selection.ts`) is how long a
  visitor spends *at* a place.
- **Transfer data** (`nearby.json`, given domain shape by `app/src/lib/transfer.ts`) is about
  moving *between* two places.

Selection Intelligence (Phase 3A) sums visit time across a selection because a selection's
total time-on-site does not depend on order. Transfer time is the opposite: it depends entirely
on which place a visitor goes to next, which a bare selection does not specify. That is why
Phase 3B1 introduces no function that adds transfer minutes across a `Place[]` — see
"No aggregation without order" below.

## Provenance: what `nearby.json` actually is

All 403 relations currently in `nearby.json` were produced the same way: take each place's
coordinates, compute a haversine (great-circle) distance between them, and apply a fixed
speed model to turn that distance into an estimated number of minutes. Every row's `Nota` field
says as much ("Estimación geográfica; validar ruta real" — geographic estimate; validate the
real route). None of it reflects:

- an actual walking or transit route (streets, elevation, station layout, transfers);
- a real timetable or schedule;
- any external routing or mapping API call.

`app/src/lib/transfer.ts` encodes this as structured provenance on every converted edge, as one
member of a discriminated union:

```ts
type GeographicProvenance = {
  kind: "derived-geographic";
  dataset: "nearby";
  method: "haversine-speed-model";
};

type RoutingProviderProvenance = {
  kind: "routing-provider";
  provider: "openrouteservice";
  profile: "foot-walking";
};

type TransferProvenance = GeographicProvenance | RoutingProviderProvenance;
```

This is deliberately not a free-text string. `kind` is the discriminant a consumer branches on
to tell a geometric estimate from a validated result without parsing prose.
`RoutingProviderProvenance` was added in Phase 3B2A (see below) for the walking-validation
pilot; a future transit provider or official source adds another member to this union rather
than repurposing an existing one.

## Confidence taxonomy

```ts
type TransferConfidence = "estimated" | "validated-static" | "schedule-aware";
```

- **`estimated`** — derived from geometry, as above. Every edge converted directly from
  `nearby.json` gets this value; `toTransferEdge` never assigns any other.
- **`validated-static`** — a real routed path and time (e.g. from a walking-routing provider),
  without live schedule awareness. Phase 3B2A's walking-validation pilot is the first thing that
  can produce this value, for the small, explicit sample described below — never for a relation
  the pilot didn't validate.
- **`schedule-aware`** — accounts for an actual timetable (e.g. a transit provider's
  departure/arrival lookup for a specific time). Not produced anywhere yet.

`verifiedAt: string | null` sits alongside confidence: `null` for every `toTransferEdge`-derived
edge, and an ISO 8601 UTC timestamp of the actual routing query for a pilot-validated edge. No
edge is ever silently promoted — `toTransferEdge()` (the `nearby.json` → `TransferEdge`
converter) is untouched by Phase 3B2A and still returns `estimated`/`null` for all 403
relations; a `validated-static` result only ever reaches a caller through `getBestTransfer`,
which reads it from a separate, precomputed artifact (see below).

**False precision is the risk this taxonomy guards against.** Formalizing these relations into
a typed `TransferEdge` must not make them read as more trustworthy than they are; `confidence`
and `verifiedAt` exist specifically so a caller can tell an estimate from a validated result
without inspecting `source` or parsing `Nota`.

## The `TransferEdge` contract

```ts
type TransferEdge = {
  fromId: string;
  toId: string;
  minutes: { minMinutes: number; maxMinutes: number };
  distanceKm: number;
  mode: TransferMode;         // normalized; see below
  rawMode: string;            // original "Modo" text
  relation: TransferRelation; // normalized; see below
  rawRelation: string;        // original "Relación" text
  confidence: TransferConfidence;
  source: TransferProvenance;
  verifiedAt: string | null;
};
```

`minutes` is always a range, never a bare number — the same discipline
`app/src/lib/duration.ts` and `MinuteRange` already use for visit time. For every edge
converted from the current dataset, `minMinutes === maxMinutes`, because `nearby.json` records
one `Min aprox.` value per relation. Phase 3B1 does **not** fabricate a ±10%/±20% tolerance to
turn that single number into a spread — the uncertainty is represented honestly by
`confidence: "estimated"`, not by invented bounds that would look more precise than the data
supports.

### Mode

```ts
type TransferMode = "walk" | "local-transit" | "disney-resort-line";
```

This normalizes only the `Modo` values that exist in the current 403 relations today (`A pie`,
`Transporte local`, `Disney Resort Line`). It is intentionally not a general transport catalogue
— Shinkansen, flights, and ferries are out of scope for 3B1 because none of them appear in
`Modo` yet, and adding them now would be speculative. `normalizeTransferMode` throws on any
other value rather than accepting an arbitrary string, so a future workbook change that
introduces a new mode fails loudly (in tests, in `scripts/validate-dataset.py`, and in
`toTransferEdge`) instead of silently degrading the domain model. `rawMode` is kept on every
edge for auditability regardless.

### Relation kind

```ts
type TransferRelation = "same-cluster" | "nearby" | "alternative";
```

Normalizes the current `Relación` values (`Mismo cluster`, `Cercano`,
`Alternativas/complementos`). This describes how two places relate editorially — it carries no
claim about transfer quality on its own; a `same-cluster` edge is still `confidence:
"estimated"` today.

## Directed lookup

```ts
function lookupTransfer(fromId: string, toId: string): TransferEdge | null;
```

This is a plain directed dictionary lookup:

- It resolves an edge that is actually recorded in `nearby.json` — never a synthesized one.
- It never assumes `A → B` implies `B → A`. Most of today's 403 relations happen to be
  recorded in both directions, but that is a property of the current data, not something the
  lookup relies on or fabricates when it is missing.
- It never computes distance or time from coordinates when no edge is recorded — that would
  reintroduce the exact haversine estimation this module is meant to make explicit and bounded,
  as an unbounded fallback.
- It never chains edges, joins them, or searches for a shortest path.

When there is no recorded edge in the requested direction, it returns `null`. A caller that
wants to know whether *any* relation is recorded between two places, in either direction, must
check both `lookupTransfer(a, b)` and `lookupTransfer(b, a)` explicitly — `computeLogisticsMetrics`
does exactly this to decide whether a pair of places is "known," and only for that purpose; it
never treats a found `A → B` edge as describing the `B → A` trip.

## No aggregation without order

`app/src/lib/transfer.ts` contains no function shaped like `sumTransfers(places: Place[])`. This
is a deliberate omission, not a gap to fill casually in a later phase:

A `Place[]` selection has no sequence. Summing transfer time across it would require inventing
an order — array order, alphabetical order, or a shortest-path search — and presenting that
invented order's total as if it described the selection is misleading: it would look like a
plan when the module was only ever given an unordered set. `app/src/lib/transfer.test.ts`
includes a regression test asserting this module exports nothing named `sumTransfers`,
`selectionTransferTotal`, `hubTransferTotal`, or `clusterTransferTotalMinutes`.

A correct aggregation belongs to a later phase (3C, day/route planning) and must take an
**explicit sequence** of place ids or edges as its input — never a bare, unordered `Place[]`.

## Logistics metrics (factual, no classification)

`computeLogisticsMetrics(places: Place[])` reports only counts and ranges that are true of the
recorded data, with no interpretation layered on top:

- `possiblePairCount` — unordered pairs among the given places (`n(n-1)/2`).
- `knownPairCount` — how many of those **unordered pairs** have a recorded edge in at least
  one direction. A pair recorded both ways (`A → B` and `B → A`) still counts once; this is a
  count of pairs, not of directed edges.
- `pairCoverage` — `knownPairCount / possiblePairCount` (`0` when no pair is possible).
- `recordedDistanceRange` / `maxRecordedDistance` — the min/max `distanceKm` across **every
  directed edge actually recorded** among the known pairs, or `null` when none are known. This
  is a range over recorded edges, not over pairs: a pair with both directions recorded
  contributes both distances as independent observations, even when they diverge, and neither
  is dropped, averaged, or treated as confirming the other. Two directions disagreeing on
  distance is not "corrected" into one number here — see `scripts/validate-dataset.py`'s
  reverse-direction divergence check, which reports (not silently resolves) exactly this case.
  Both metrics are computed per unordered pair regardless of the input array's order, so
  `computeLogisticsMetrics(places)` and `computeLogisticsMetrics([...places].reverse())` always
  agree.

### No compact/extended classification (3B1 decision)

The Phase 3B audit suggested that a cluster's `pairCoverage` and recorded distances could
eventually support labelling it "compact" or "extended." Phase 3B1 deliberately does **not**
implement that: the audit did not establish a fully specified threshold for what counts as
"high coverage" or "low distance," and inventing one now would be an unreviewed heuristic
dressed up as a metric. Phase 3B1 exposes the raw metrics; a later phase can classify them
against an explicit, documented threshold if one is agreed on. Until then, no `compact`,
`extended`, `efficient`, or `inefficient` label exists anywhere in this codebase for a cluster.

## The 2026 dataset audit (documentation only)

The Phase 3B audit that this phase formalizes characterized the current 403 relations as:

- 332 proximity-only relations (geographic estimate, nothing more);
- 67 candidates identified as worth prioritizing for future routing validation;
- 4 Kerama-area relations that the audit flagged as obviously not routing-grade (they connect
  islands that a haversine distance cannot meaningfully route between on foot or by a single
  local transfer).

These numbers describe the audit's findings about **today's** dataset. They are recorded here
as documentation only — no production code (`transfer.ts`, `scripts/validate-dataset.py`, or
anywhere else) hardcodes 332, 67, or 4, because a legitimate future update to the workbook
changing these relations must not fail validation or break the domain layer just because a
count changed.

## Phase 3B2A — walking-validation pilot

Phase 3B1 declined to validate anything; Phase 3B2A is a **controlled pilot** that validates a
small, deterministically chosen sample of "A pie" edges against real walking routing, to prove
the architecture before ever considering the other ~308. It is not batch validation and not a
claim about the dataset as a whole.

### Provider and endpoint

Routing: **openrouteservice**, operated by **HeiGIT** (Heidelberg Institute for Geoinformation
Technology), profile `foot-walking`.

`api.openrouteservice.org` is deprecated in favour of **`api.heigit.org`**
(deprecation announced 2026-04-28, full shutdown scheduled 2026-09-28). This pipeline uses only
the current host:

```
POST https://api.heigit.org/openrouteservice/v2/directions/foot-walking/json
Authorization: <ORS_API_KEY>
Content-Type: application/json
{ "coordinates": [[lng1, lat1], [lng2, lat2]], "geometry": false }
```

`scripts/logistics_common.py` defines `ORS_HOST` once; a regression test
(`scripts/test_walking_pilot.py`) asserts the deprecated host string appears nowhere else in
`scripts/` or `app/src/`, so a stale reference can't creep back in silently.

**Coordinate order.** `Place.coordinates` is `{ lat, lng }`; openrouteservice's `coordinates`
array is `[longitude, latitude]` pairs. `to_ors_coordinates(place)` is the single conversion
point, and `scripts/test_walking_pilot.py` asserts it on real, non-symmetric Tokyo coordinates
(`lat=35.66, lng=139.70`) specifically so a silent lat/lng swap would fail loudly rather than
happening to look plausible.

### Sample selection

`scripts/select-walking-pilot.py` deterministically picks **exactly 24** of the 332 current "A
pie" relations and writes `data/logistics/walking-pilot-manifest.json`. No manual
cherry-picking: every edge is chosen by a documented, code-computed rule (distance-bucket rank,
implied-speed anomaly, or hub/cluster coverage) recorded in the manifest itself as
`selectionMethod`. Re-running the script against an unchanged dataset reproduces the same 24
edges byte-for-byte — the **entire manifest document**, not just the selected ids: the
manifest's `sourceDatasetContext.datasetDigest` is a sha256 content hash of `places.json` and
`nearby.json`, deliberately **not** the git HEAD SHA, so regenerating it on a different commit
that carries byte-identical data still produces a byte-identical manifest (see
`dataset_digest()` in `scripts/logistics_common.py`; a full-manifest determinism test lives in
`scripts/test_walking_pilot.py`). The manifest stores only `fromId`/`toId`/`category`/`reason` —
never copied names, coordinates, or minutes, which are always resolved live from `places.json` /
`nearby.json` so there is exactly one source of that data.

### Pipeline

`scripts/validate-walking-pilot.py --dry-run` resolves every manifest edge against real data,
confirms `Modo == "A pie"`, and prints exactly what would be queried — no network call.
`--execute` requires `ORS_API_KEY` as an environment variable (never a hardcoded value, never
written to a file, JSON, doc, or log) and is a hard no-op without it. It skips any edge that
already has a cached `"validated"` result unless `--refresh` is passed, so a re-run is cheap and
reproducible; a `"no-route"` or `"request-error"` result is retried by default. Exactly one
bounded retry is allowed for a transient failure (HTTP 429/5xx, timeout); a real "no route"
answer from the provider or an auth error is never retried. A failed query is recorded as a
`"no-route"` or `"request-error"` status — never as `0` minutes, `null` without explanation, or
a promoted `estimated` value.

`data/logistics/walking-pilot-results.json` (mirrored to
`app/src/data/logistics/walking-pilot-results.json`, exactly as `nearby.json` is mirrored into
`app/src/data/`) is the versioned artifact. Its schema is documented in
`app/src/lib/transfer.ts`'s `WalkingPilotResult` type: a `"validated"` entry carries
`distance.meters`, `minutes` (seconds rounded half-up to whole minutes — see
`round_half_up_minutes`, no `±10%`/`±15%` tolerance fabricated), `confidence:
"validated-static"`, `verifiedAt` (the real query timestamp, ISO 8601 UTC), structured `source`,
and an optional `endpointSnapping` (see below); any other status carries none of those fields,
by the type's own shape.

`scripts/validate-logistics.py` checks the manifest (exactly 24 edges, valid ids, each existing
in `nearby.json` with `Modo == "A pie"`, unique directed pairs) and, when the results file is
non-empty, the results (**exact coverage** of the manifest's directed edges — a missing or an
extra edge is an error, not just an extra one — no duplicates, valid status, expected
provider/profile, `source.provider`/`source.profile` matching the top-level fields, positive
distance/duration when validated, `validated-static` ⇒ non-null `verifiedAt` and
`routing-provider` provenance, an `endpointSnapping.assessment` that is both one of the three
valid values and re-derivable from the recorded snap distances, and never `"clean"`/`"significant"`
paired with a null snap distance, `estimated` never appearing as a pilot result, and a scan for
anything that looks like a committed secret). It does not hardcode the manifest's edge count as a
magic number anywhere except the one named constant (`PILOT_EDGE_COUNT`) both the selector and
validator import.

#### Endpoint snapping

A routing provider never routes between the exact coordinates it's given — it **snaps** each
input point to the nearest point on the routable network first (openrouteservice's Snap
endpoint reports this as `snapped_distance`, in meters). When both endpoints of an edge snap far
from where they really are — worse, onto the same short stretch of path — the routed distance
between them can end up far smaller (or larger) than the real distance between the original
coordinates, with no error raised. See `docs/WALKING_PILOT.md`'s JP-063↔JP-065 finding: routed
3.2 m between two points that are actually ~22.2 m apart, because a combined ~23 m of endpoint
snapping consumed nearly the entire real separation.

`scripts/logistics_common.py`'s
`classify_endpoint_snapping(fromSnapMeters, toSnapMeters, routedDistanceMeters)` is the objective,
code-computed guard, returning one of three states — never a boolean:
  - `"clean"`: both endpoints measured, combined snap small relative to the routed distance — the
    routed value is comparable to the original coordinates.
  - `"significant"`: both endpoints measured, combined snap ≥ 10 m in absolute terms **and**
    ≥ 50% of the routed distance itself — chosen so an ordinary few-meter snap on a long route is
    never flagged just because a short route with the same absolute snap would be.
  - `"unknown"`: at least one endpoint's snap distance was never resolved (not yet measured, or
    the Snap query failed/found no point in radius). **A `null` measurement is never averaged in
    as `0` meters** to produce `"clean"` — that would be indistinguishable from claiming a
    genuinely unmeasured edge is comparable when nobody checked. `"unknown"` and `"significant"`
    are treated identically by every downstream consumer: neither is comparable, and neither is
    ever promoted to `validated-static`.

`scripts/validate-walking-pilot.py --execute` captures this automatically going forward (one
extra Snap request per freshly-queried edge, batching both coordinates, degrading to `"unknown"`
with a `reason` rather than failing the whole edge if the Snap call itself errors).
`--diagnose-snap FROM_ID TO_ID` retroactively resolves it for one already-existing result with
exactly one Snap request, never re-querying Directions. `--backfill-snapping` does the same for
*every* manifest edge whose result doesn't yet have a resolved `assessment` — it derives the list
of what's missing programmatically from the results file itself (`edges_needing_snap_assessment`,
never a hardcoded count), deduplicates the union of place coordinates those edges need, and makes
exactly **one** batched Snap request regardless of how many edges are missing; a completely
absent `endpointSnapping` field is treated exactly like `"unknown"` by every consumer, so backfill
is a completeness improvement, never a correctness requirement for reading results correctly.
`scripts/report-walking-pilot.py` computes aggregate ratios and outlier lists over `"clean"`
results only, listing `"significant"` and `"unknown"` edges separately (with the reason, for
`"unknown"`) instead of silently dropping or comparably including them, so a future scale-up that
reuses this report's logic cannot average a snap artifact — or an unmeasured edge — into a
"correction factor" for the rest of the dataset. `app/src/lib/transfer.ts`'s `getBestTransfer`
enforces the same rule independently at read time: a validated result only promotes to
`confidence: "validated-static"` when its `endpointSnapping.assessment === "clean"`; a
`"significant"` or `"unknown"` assessment, or a missing `endpointSnapping` altogether, falls back
to the `estimated` `nearby.json` edge — see `app/src/lib/transfer.test.ts`.

`scripts/report-walking-pilot.py` computes, over the validated subset only, per-edge distance
and minute ratios/differences, aggregate statistics (median/mean/min/max), and the top 5
outliers by distance ratio and by absolute minute difference. This is **pilot analysis over
N≈24**, never generalized into a correction factor for the remaining relations.

### Resolving estimated vs. validated

```ts
function getBestTransfer(fromId: string, toId: string): TransferEdge | null;
```

Preference order: a validated-static result for that exact directed edge **whose endpoint
snapping was measured and found `"clean"`**, else the estimated `nearby.json` edge, else `null`.
Since Phase 3B2B-C (see below), "a validated-static result" means one from either the pilot
or the scale-up artifact — both are merged into the same directed-key index and judged by
the same gate. A validated result with `assessment === "significant"` or `"unknown"`, or
with no `endpointSnapping` recorded at all, is never promoted — it falls back to the
estimated edge exactly as if neither artifact had covered that pair (see "Endpoint
snapping" above). Nothing here calls a routing provider at read time — every
`validated-static` answer `getBestTransfer` can return was already computed offline by
`scripts/validate-walking-pilot.py` or `scripts/validate-walking-scale.py` and is read from
disk exactly like an estimated edge is. `toTransferEdge()` and `nearby.json` itself are
untouched: `getBestTransfer` is a read-time resolution layer, not a rewrite of the
estimated source.

### Status in this checkout

The pipeline's non-network logic is fully tested (selection determinism — including the full
manifest document, not just the selected ids — coordinate order, minute rounding, response
parsing, failure classification, caching/refresh, the three-state endpoint-snapping guard, the
snap backfill's edge-selection and single-request batching, and the
validated-and-snap-clean/estimated/null preference order — see `scripts/test_walking_pilot.py`
and `app/src/lib/transfer.test.ts`). **The live pilot has been executed and fully backfilled**: on
2026-09-04, all 24 manifest edges were queried against `api.heigit.org` and all 24 returned
`"validated"` (0 `no-route`, 0 `request-error`); a single batched `--backfill-snapping` request
then resolved `endpointSnapping` for every one of the 24 edges (22 `"clean"`, 2 `"significant"` —
one coordinate pair, both directions — 0 `"unknown"`). `data/logistics/walking-pilot-results.json`
holds the real results, including every edge's `endpointSnapping` field (mirrored to
`app/src/data/logistics/`). Full statistics, per-edge comparisons, top outliers, limitations, and
the decision-gate recommendation (**SCALE**, with the snap-clean gate carried forward as a hard
requirement — see the report) are in `docs/WALKING_PILOT.md`, not duplicated here to avoid a
second source of truth for the same numbers.

To re-run it (idempotent — cached `"validated"` edges are skipped unless `--refresh`):

```
ORS_API_KEY=<your key> python3 scripts/validate-walking-pilot.py --dry-run   # sanity check first
ORS_API_KEY=<your key> python3 scripts/validate-walking-pilot.py --execute
ORS_API_KEY=<your key> python3 scripts/validate-walking-pilot.py --backfill-snapping
python3 scripts/report-walking-pilot.py
python3 scripts/validate-logistics.py data
```

### Attribution

Per openrouteservice's terms of service and the OpenStreetMap Foundation's attribution
guidelines (verified during this phase, subject to change — re-check before any production or
public-facing use): two distinct things are credited, under their own separate licenses. The
routing computation itself is openrouteservice/HeiGIT's, provided under **CC BY 4.0**
("© openrouteservice.org by HeiGIT"). The underlying map data is OpenStreetMap's, available
under the **Open Database License (ODbL)**, requiring "Map data © OpenStreetMap contributors"
and that the ODbL itself be named. Every `"validated"` pilot result's `attribution` string
records both — see `ATTRIBUTION` in `scripts/ors_client.py` (shared with the Phase 3B2B-A
scale-up pipeline; see `docs/WALKING_SCALE_PREP.md`) for the exact wording.
This is why the result is versioned in-repo rather than silently regenerated: the attributed,
licensed output is the artifact, and refreshing it (a workbook update, a provider improvement)
is a deliberate, visible re-run of `--execute --refresh`, not an implicit background sync.

## Phase 3B2B-B — executed walking scale-up

The prepared scale manifest was executed on 2026-09-04 against `api.heigit.org`,
profile `foot-walking`: **303 validated and 5 no-route**, covering all 308 manifest
edges with terminal results. Snap required one real request for 103 new places;
all 137 scale-required places are resolved. Directions used 312 requests across
an interrupted 40/min run and an explicitly authorized 20/min resumption, with
3 bounded retries total. The resumed run skipped all 116 already-terminal edges.

`data/logistics/walking-scale-results.json` and its byte-identical copy under
`app/src/data/logistics/` were published only after `is_batch_complete()` became
true, then recombined offline against the final Snap store. All 303 validated
scale results are clean under the unchanged rule; there are no significant or
unknown scale assessments. No absolute endpoint threshold was set. Real request
accounting, the 429 history, all no-route edges, statistics, outliers, and threshold
evidence are in [WALKING_SCALE_EXECUTION.md](WALKING_SCALE_EXECUTION.md).

The synchronized app-facing JSON is an available artifact, not a claim of new UI
behavior: as of this phase, `getBestTransfer` still imports the pilot results only —
Phase 3B2B-C (below) is what wires the scale-up artifact in, retaining this clean-only
promotion rule. This execution changes neither the estimated nearby source nor existing
application behavior.

## Phase 3B2B-C — Walking Scale Integration

Phase 3B2B-B produced and versioned the scale-up's 308 terminal results
(`data/logistics/walking-scale-results.json`, mirrored to `app/src/data/logistics/`) but
`getBestTransfer` still read only the pilot artifact. Phase 3B2B-C wires the scale-up
artifact into the same read-time resolution layer, alongside the pilot, without changing
what `getBestTransfer`'s contract promises or how any individual edge is judged.

**Together, pilot + scale-up cover the current dataset's full 332 "A pie" edges** — the
pilot's 24 plus the scale-up's 308, disjoint by construction (see "Sample selection" and
Phase 3B2B-A above). No third artifact and no other edge count is implied by this phase.

### Merge design

`app/src/lib/transfer.ts` imports both `walking-pilot-results.json` and
`walking-scale-results.json` — the same way it already imported the pilot file, with no
network access and no mutation of either artifact — and merges their `"validated"` entries
into one directed-key index via `buildValidatedWalkingIndex()`:

```ts
export function buildValidatedWalkingIndex(
  sources: readonly WalkingResultSource[]
): Map<string, ValidatedWalkingResult>;
```

- Only `"validated"` entries are indexed; `"no-route"`/`"request-error"` entries are
  skipped by this function entirely (see "No-route handling" below).
- The lookup stays a single directed dictionary lookup, exactly as before: `getBestTransfer`
  still resolves one exact `(fromId, toId)` pair, still never reads the reverse direction,
  still never chains edges, still never computes a shortest path.
- The snap-clean gate (`isSnapClean` / `endpointSnapping.assessment === "clean"`) is
  untouched and applies identically to a pilot-sourced and a scale-sourced validated
  result — there is no separate pilot-only or scale-only code path, only one merge and one
  gate.
- `toTransferEdge()` and `data/nearby.json` / `app/src/data/nearby.json` are not touched by
  this phase; the merge only changes what `getBestTransfer` can promote to
  `validated-static`, never the estimated source itself.

### No-route handling

The scale-up's five `"no-route"` results (see `WALKING_SCALE_EXECUTION.md`) are real,
terminal provider answers — not omissions — but they carry no `distance`/`minutes` to
index at the type level (see `WalkingPilotResult`'s discriminated union), so
`buildValidatedWalkingIndex` never adds them to the validated index in the first place.
For a directed pair whose only walking-artifact result is `"no-route"`,
`getBestTransfer` therefore falls back to the recorded `nearby.json` estimate exactly as
it would for a pair neither artifact covers at all — never `0` minutes, never a
fabricated distance, and never promoted to `validated-static`.

### Duplicate-key protection

The pilot's 24 edges and the scale-up's 308 edges are disjoint by construction, verified
independently in Phase 3B2B-A. `buildValidatedWalkingIndex` does not trust that silently:
while merging, it tracks which source last wrote each directed key, and if the same
directed edge is ever found `"validated"` in more than one source, it throws immediately
— identifying both edge and both source artifacts in the error — instead of letting
whichever source is merged last silently overwrite the other. This is a defensive,
fail-loud guard against a future data-integrity regression, not a condition this
checkout's real data currently triggers.

### What this phase does not do

- No ORS request of any kind — this phase reads only the already-versioned pilot and
  scale-up JSON artifacts.
- No dataset change — `nearby.json`, `places.json`, both walking result artifacts, and
  the snapping thresholds are all read-only inputs here.
- No summing of transfer minutes across edges, no visit ordering, and no itinerary of any
  kind — `getBestTransfer` remains a single-pair, single-direction lookup; see
  "No aggregation without order" above, which this phase does not revisit.
- No UI change — nothing renders a walking-scale time to a user; this phase only extends
  the domain-layer read path.
- No start of Phase 3C (route/day planning).

## The remaining 3B2/3B2B/3C boundary

Everything below is still explicitly out of scope. Extending `TransferConfidence`,
`TransferProvenance`, or `TransferMode` further is for a later phase to decide, not implied by
3B2A's additions:

- Transit / schedule-aware validation of any kind.
- A full transport-mode catalogue (Shinkansen, flights, ferries) beyond the modes that exist in
  the dataset today.
- Route ordering, city-sequence comparison, or itinerary generation.

### Transit provider research (architectural notes only, still no integration)

For **transit** (schedule-aware) validation, this phase does **not** choose a provider in code.
Commercial providers investigated include Google Routes, NAVITIME, Ekispert, and HERE, but
their standard terms constrain caching/storing responses as static, versioned repository data
without further permission or a different architecture (e.g. calling live rather than
precomputing). That evaluation is deferred to a later phase, alongside the architecture decision
it implies (live lookup vs. a licensed, cacheable batch export).

#### Google Routes: why it is out of scope now, specifically

- Most Routes API response content is subject to caching/storage restrictions that conflict
  with committing its output as static repository data.
- Its transit schedule lookup only supports queries up to 100 days into the future.
- This project's target window (February–March 2027) is currently outside that 100-day
  horizon and will remain so for some time — so even a permitted integration could not yet
  produce a validated result for the dates that matter here.

No Google API key exists anywhere in this repository, and none is created by Phase 3B1.

## What Phase 3B1 does not touch

- `data/nearby.json` / `app/src/data/nearby.json` — unchanged, still 403 rows, still the single
  source `app/src/lib/transfer.ts` reads from (no duplicated copy of the relations).
- The source workbook.
- Any UI component (`SelectionAnalysis.tsx`, `SelectionPanel.tsx`, `PlaceDetail.tsx`,
  `FilterPanel.tsx`, `App.tsx`/`App.css`, and the rest) — the existing nearby-navigation UI reads
  `getNearby()` exactly as it did before this phase.
- Itinerary generation, place ordering, or city-sequence comparison — all still 3C-or-later.

## What Phase 3B2A does not touch

- `data/nearby.json` / `app/src/data/nearby.json` and `data/places.json` /
  `app/src/data/places.json` — unchanged. `toTransferEdge()` still converts every one of the 403
  relations to `confidence: "estimated"`; the pilot's 24 validated-or-not results live in a
  separate artifact (`data/logistics/`), never overwriting or replacing the estimated source.
- The source workbook and GeoJSON.
- Any UI component — no new times are shown to a user yet; this phase only validates data.
- Transit, Shinkansen, ferries, route optimization, itineraries, or any of the ~308 "A pie"
  relations outside this pilot's 24-edge sample.
