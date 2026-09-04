# Phase 3B2A — Walking Validation Pilot: results

This is the report for the **executed** pilot. For the architecture, the pipeline scripts, the
schema, the coordinate-order/minute-rounding rules, and the attribution requirements, see
"Phase 3B2A — walking-validation pilot" in `docs/LOGISTICS.md`. This document only reports what
the run actually found — it does not repeat the design rationale.

**This is a pilot over 24 edges, not a statement about the dataset's other ~308 "A pie"
relations.** Nothing here should be read as "openrouteservice is accurate" or "multiply every
walking edge's estimate by some factor" — see "Limitations" below.

> **Correction (post-review, second pass):** the previous version of this report classified
> endpoint snapping with a boolean `significant` flag that treated a *null* (unmeasured) snap
> distance the same as `0` meters, and only 1 of the 24 manifest edges (JP-063↔JP-065) had ever
> actually been measured — the other 23 simply had no `endpointSnapping` field at all, which the
> old report silently read as "not flagged" rather than "unknown." Both problems are fixed: the
> model is now a three-state `assessment` (`"clean" | "significant" | "unknown"`, see
> `docs/LOGISTICS.md`), a null measurement is never averaged in as zero, and every one of the 24
> manifest edges now carries a real, measured assessment via a single backfill Snap request (see
> "Full-pilot snap backfill" below). The decision gate is re-evaluated below against the complete,
> snap-aware picture.

## Run metadata

- **Date**: 2026-09-04
- **Base commit**: `cec45541d068445edc34762dec93ac3100f62cec` (the SHA Phase 3B2A's branch was
  cut from; the manifest's `sourceDatasetContext.datasetDigest` is a content hash of
  `places.json`/`nearby.json`, not a git SHA — see `docs/LOGISTICS.md` for why)
- **Provider**: openrouteservice, operated by HeiGIT
- **Host**: `https://api.heigit.org` (not the deprecated `api.openrouteservice.org`)
- **Profile**: `foot-walking`
- **Manifest**: `data/logistics/walking-pilot-manifest.json`, 24 edges, selected by the
  deterministic algorithm documented in `docs/LOGISTICS.md`
- **Results**: `data/logistics/walking-pilot-results.json` (mirrored to
  `app/src/data/logistics/`)
- **`verifiedAt` range**: `2026-09-04T01:30:13Z` to `2026-09-04T01:30:26Z` (24 Directions queries,
  13 seconds wall-clock), **plus** two later, separate Snap-endpoint diagnostics made during
  review — neither re-queried Directions for any edge:
  1. A single-pair diagnostic (`--diagnose-snap JP-063 JP-065`) during the first corrective pass.
  2. A single, batched backfill request (`--backfill-snapping`) during this second corrective
     pass, covering all 35 unique places referenced by the 24 manifest edges' still-unresolved
     endpoints in one call — not one Snap request per edge, and not a second call for the pair
     already diagnosed in step 1.

## Outcome

**24 / 24 queried, 24 validated, 0 `no-route`, 0 `request-error`.** No retry was needed — every
edge succeeded on the first request. This means the pipeline's failure-handling paths
(`no-route` classification, `request-error` classification, the one bounded retry) are verified
by unit tests with mocked responses (`scripts/test_walking_pilot.py`) but were **not exercised
against a real failure** in this run — see "Limitations."

"24 validated" describes the Directions API's own answer to each query, and is unaffected by the
snapping finding below: every edge really did get a routed distance and duration back. What
changed is whether that routed distance can be trusted to describe the original two coordinates
— which, per the full backfill, it can for 22 of the 24.

## Full-pilot snap backfill

Every one of the 24 manifest edges now carries a resolved `endpointSnapping.assessment`, derived
from **one** Snap-endpoint request (`POST /openrouteservice/v2/snap/foot-walking/json`) covering
the 35 unique places those edges reference — never one request per edge, and never a query
outside the pilot's own 24 edges. The result:

| Assessment | Count |
|---|---|
| `clean` | 22 |
| `significant` | 2 |
| `unknown` | 0 |

Both `significant` edges are the two directions of the single JP-063↔JP-065 coordinate pair
already diagnosed in the first corrective pass (see below) — no other edge crossed the threshold,
and none came back `unknown` (every place resolved to a snap point within the 350 m radius).

## The JP-063↔JP-065 finding

JP-063 (Philosopher's Path) and JP-065 (Ginkaku-ji) sit **22.24 m apart** in the dataset's own
coordinates (haversine, computed directly from `places.json`). The pilot's Directions query
returned a routed distance of **3.2 m** and `durationSecondsRaw: 2.3` in both directions — far
*less* than the real separation, which a real walking route (always ≥ the straight-line
haversine distance) cannot legitimately be.

A one-off, minimal diagnostic query to openrouteservice's **Snap endpoint** (both coordinates
batched into a single request, radius 350 m — the API's documented maximum) explains it:

| Point | Snapped distance from original coordinate |
|---|---|
| JP-063 (Philosopher's Path) | 2.25 m |
| JP-065 (Ginkaku-ji) | 20.71 m |
| **Combined** | **22.96 m** |

The combined snap displacement (22.96 m) accounts for essentially the *entire* real separation
between the two points (22.24 m). In plain terms: openrouteservice snapped both input
coordinates onto the same short stretch of path, and the "3.2 m route" it returned is the
distance between those two **snapped** points on the network — not a walking route between
Philosopher's Path and Ginkaku-ji as they are actually located. This is normal, documented
openrouteservice/GraphHopper behavior (routing only ever happens on the graph, never on raw
input coordinates), not a bug in openrouteservice or in this pipeline — but it means this
edge's `distance`/`minutes` must not be read as "how far/long it takes to walk from JP-063 to
JP-065."

Both directions of this one manifest edge (`JP-063→JP-065` and `JP-065→JP-063`) carry an
`endpointSnapping` field recording exactly this (the reverse direction's values are the same two
numbers, since snapping is a property of a coordinate, not of travel direction). Both are
assessed `"significant"` by the objective threshold defined in `scripts/logistics_common.py`
(`classify_endpoint_snapping`): combined snap ≥ 10 m **and** ≥ 50% of the routed distance itself.
`scripts/report-walking-pilot.py` excludes both from every aggregate statistic and outlier list
below, listing them separately instead of silently dropping them. `getBestTransfer` in
`app/src/lib/transfer.ts` independently enforces the same rule at read time: a `"significant"`
(or `"unknown"`, or unmeasured) assessment can never be served as `validated-static` — see
`app/src/lib/transfer.test.ts`'s tests against this exact pair.

## JP-109↔JP-110: measured and clean, not a snapping artifact

The earlier version of this report flagged JP-109↔JP-110's 6.02× distance ratio (the sample's
largest) as an open question, since it had never been checked against the Snap endpoint. The
backfill resolves it: **1.77 m** and **2.37 m** endpoint snap (combined 4.14 m), against a 60.2 m
routed distance — well under both the 10 m absolute floor and the 50%-of-route ratio, so this
assessment is `"clean"`. The large ratio is therefore a genuine finding about the estimate (a very
short `nearby.json` distance, 0.01 km, undershooting the real routed distance sixfold), not a
routing/snapping artifact, and it correctly remains in the comparable statistics below.

## Pilot findings (N=22, clean endpoint-snapping assessment only)

| Metric | Median | Mean | Min | Max |
|---|---|---|---|---|
| Distance ratio (routed / estimated) | 1.381 | 1.888 | 1.098 | 6.020 |
| Minute ratio (routed / estimated) | 1.155 | 1.215 | 0.333 | 2.200 |

With the two significant-snap edges excluded, **every one of the remaining 22 edges' routed
distance is ≥ its estimate** (min ratio 1.098) — the direction geometry predicts, with no
exception. Full per-edge output including the two excluded edges: re-run `python3
scripts/report-walking-pilot.py` (deterministic over the committed manifest and results, so not
duplicated verbatim here).

### Top 5 by distance ratio (farthest from 1.0, clean assessment only)

| From → To | Hub/Cluster | Estimated | Routed | Ratio |
|---|---|---|---|---|
| JP-109 → JP-110 | Osaka/Shinsekai–Tennoji | 0.01 km | 0.060 km | 6.02 |
| JP-110 → JP-109 | Osaka/Shinsekai–Tennoji | 0.01 km | 0.060 km | 6.02 |
| JP-070 → JP-069 | Kioto/Yamashina | 0.36 km | 0.944 km | 2.62 |
| JP-095 → JP-067 | Kioto/Station–South | 0.6 km | 1.135 km | 1.89 |
| JP-084 → JP-065 | Kioto/North Kyoto | 1.79 km | 3.350 km | 1.87 |

### Top 5 by absolute minute difference (clean assessment only)

| From → To | Hub/Cluster | Estimated | Routed | Abs diff |
|---|---|---|---|---|
| JP-084 → JP-065 | Kioto/North Kyoto | 25 min | 40 min | 15 min |
| JP-070 → JP-069 | Kioto/Yamashina | 5 min | 11 min | 6 min |
| JP-095 → JP-067 | Kioto/Station–South | 8 min | 14 min | 6 min |
| JP-159 → JP-158 | Okinawa/Shuri | 10 min | 14 min | 4 min |
| JP-168 → JP-169 | Okinawa/Central Okinawa | 17 min | 21 min | 4 min |

## Successes / failures

- **Successes**: 24 (100% of the sample returned a routed distance/duration)
- **`no-route`**: 0
- **`request-error`**: 0
- **Snap assessment**: 22 `clean`, 2 `significant` (JP-063→JP-065, JP-065→JP-063 — one underlying
  coordinate pair), 0 `unknown`

## Limitations

- **N=24 (22 comparable).** Every statistic above describes this sample, not the other ~308 "A
  pie" relations. The sample was built to include distance-bucket and speed-anomaly extremes on
  purpose, so it is not a random sample and its ratios should not be averaged into a single
  "correction factor" for anything outside itself.
- **No real Directions failure was observed.** `no-route`, `request-error`, and the
  bounded-retry path remain verified only by mocked unit tests, not by this live run.
- **One provider, one profile, one point in time.** This says nothing about openrouteservice's
  general accuracy, about transit validation, or about any other provider.
- **The snap-significance threshold is still calibrated against a small number of real cases.**
  10 m absolute / 50%-of-route is grounded in the one diagnosed pair from the first corrective
  pass and confirmed consistent by the full-pilot backfill (2 of 24 crossed it, 22 did not,
  0 came back unmeasurable) — a larger batch could still surface a shape this threshold doesn't
  handle well (e.g. a long route with a large but proportionally small snap correctly reads
  `"clean"` by design; the threshold has not been tested against many long-route cases).
- **`nearby.json` is untouched.** `toTransferEdge()` and `data/nearby.json` are unaffected by
  this phase or this finding; all 332 "A pie" relations (including JP-063→JP-065 and
  JP-109→JP-110) keep exactly the numbers they had before.

## Decision gate

**Recommendation: SCALE, with the snap-aware model as a hard requirement for the next batch.**

**Justification**: the pipeline's core integration is sound — correct host, correct coordinate
order, correct response parsing, a documented and non-inflating minutes rule, reproducible
caching, attribution captured per-result, and 24/24 Directions queries succeeded. The first
corrective pass surfaced a real correctness gap (a validated-static result's distance/minutes are
not automatically comparable to the original coordinates) and closed it at the schema level for
one diagnosed case. This second pass closes the two remaining risks that made that first fix
incomplete:

1. **The boolean model itself was unsound** — it coerced a null/unmeasured snap distance into `0`
   meters, which could have silently misclassified a genuinely unmeasured edge as "not
   significant." Replaced with a three-state `assessment` that never does this, at both the
   Python pipeline layer and the TypeScript `getBestTransfer` consumer.
2. **23 of the 24 edges had never actually been checked.** The single backfill Snap request
   (batched, deduplicated, no new Directions calls, no edge outside the 24-edge manifest touched)
   resolved all of them: 22 `clean`, 2 `significant` (both already-known, same coordinate pair),
   0 `unknown`. The pilot's own sample is now fully screened, not partially.

With both gaps closed and the guard validated against the complete 24-edge sample — not just one
case — there is no remaining reason to hold at ADJUST. **SCALE is the correct read of the actual
result, not a forced or default outcome**: 22/24 edges validated cleanly, the one real anomaly
(JP-063↔JP-065) is fully explained and correctly excluded rather than silently miscounted, and
the tooling (`classify_endpoint_snapping`, `getBestTransfer`'s snap-clean gate,
`validate-logistics.py`'s re-derivability check) now makes the same mistake structurally
impossible to reintroduce.

**What SCALE means concretely, carried into the next phase:**
1. Any future batch of edges must go through the same snap-clean gate before being read as
   `validated-static` anywhere in the app — `getBestTransfer` already enforces this per-edge, so
   this is a continuation of existing behavior, not new work.
2. A `"significant"` or `"unknown"` result in a future batch should be triaged the same way this
   pilot's one case was: reported and excluded, never silently treated as comparable. Whether such
   an edge should instead be retried with a smaller snap radius, or reported as a distinct
   "not routing-grade" outcome, remains an open design question for whichever phase does the
   scale-up — this pilot only establishes that the detection and exclusion must exist, not what
   should ultimately happen to a flagged edge's confidence.
3. The 10 m / 50%-of-route threshold should be revisited once a larger, more geographically varied
   batch exists — this pilot's 24 edges confirm the threshold works, not that it is final.

**Per Phase 3B2A's mandate, this review does not itself scale up.** No additional manifest edges
were validated, and no batch beyond this pilot's 24 was touched; SCALE describes the
recommendation for a future phase, not an action taken here.
