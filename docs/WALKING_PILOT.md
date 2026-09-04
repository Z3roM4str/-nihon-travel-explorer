# Phase 3B2A — Walking Validation Pilot: results

This is the report for the **executed** pilot. For the architecture, the pipeline scripts, the
schema, the coordinate-order/minute-rounding rules, and the attribution requirements, see
"Phase 3B2A — walking-validation pilot" in `docs/LOGISTICS.md`. This document only reports what
the run actually found — it does not repeat the design rationale.

**This is a pilot over 24 edges, not a statement about the dataset's other ~308 "A pie"
relations.** Nothing here should be read as "openrouteservice is accurate" or "multiply every
walking edge's estimate by some factor" — see "Limitations" below.

> **Correction (post-review):** an earlier version of this report described the JP-063↔JP-065
> result as "a legitimately tiny, real walk" caused by `nearby.json`'s minutes floor, and
> misstated its `durationSecondsRaw` as "~13 seconds" (the recorded value is 2.3 seconds — that
> number was estimated rather than read from the data, which should not have happened). Review
> correctly identified that the real explanation is **endpoint snapping**: see "The JP-063↔JP-065
> finding, corrected" below. The decision gate changed from SCALE-with-caveat to **ADJUST** as a
> result.

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
  13 seconds wall-clock) **plus** one later, separate Snap-endpoint diagnostic query
  (`2026-09-04`, via `--diagnose-snap JP-063 JP-065`) made during review — see below. No edge's
  Directions result was re-queried during that review.

## Outcome

**24 / 24 queried, 24 validated, 0 `no-route`, 0 `request-error`.** No retry was needed — every
edge succeeded on the first request. This means the pipeline's failure-handling paths
(`no-route` classification, `request-error` classification, the one bounded retry) are verified
by unit tests with mocked responses (`scripts/test_walking_pilot.py`) but were **not exercised
against a real failure** in this run — see "Limitations."

"24 validated" describes the Directions API's own answer to each query, and is unaffected by the
snapping finding below: every edge really did get a routed distance and duration back. What
changed is whether that routed distance can be trusted to describe the original two coordinates
— which, for 2 of the 24, it cannot.

## The JP-063↔JP-065 finding, corrected

JP-063 (Philosopher's Path) and JP-065 (Ginkaku-ji) sit **22.24 m apart** in the dataset's own
coordinates (haversine, computed directly from `places.json`). The pilot's Directions query
returned a routed distance of **3.2 m** and `durationSecondsRaw: 2.3` in both directions — far
*less* than the real separation, which a real walking route (always ≥ the straight-line
haversine distance) cannot legitimately be.

A one-off, minimal diagnostic query to openrouteservice's **Snap endpoint**
(`POST /openrouteservice/v2/snap/foot-walking/json`, both coordinates batched into a single
request, radius 350 m — the API's documented maximum) explains it:

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

Both directions of this one manifest edge (`JP-063→JP-065` and `JP-065→JP-063`) now carry an
`endpointSnapping` field recording exactly this, derived from that single Snap query (the
reverse direction's values are the same two numbers, since snapping is a property of a
coordinate, not of travel direction — no second network call was made). Both are flagged
`"significant": true` by the objective threshold defined in `scripts/logistics_common.py`
(`snap_warning`): combined snap ≥ 10 m **and** ≥ 50% of the routed distance itself.
`scripts/report-walking-pilot.py` excludes both from every aggregate statistic and outlier list
below, listing them separately instead of silently dropping them.

No other manifest edge has been checked for endpoint snapping yet — see "Limitations."

## Pilot findings (N=22, snap-flagged edges excluded)

| Metric | Median | Mean | Min | Max |
|---|---|---|---|---|
| Distance ratio (routed / estimated) | 1.381 | 1.888 | 1.098 | 6.020 |
| Minute ratio (routed / estimated) | 1.155 | 1.215 | 0.333 | 2.200 |

With the two snap-corrupted results excluded, **every one of the remaining 22 edges' routed
distance is ≥ its estimate** (min ratio 1.098) — the direction geometry predicts, with no
exception. Full per-edge output including the two excluded edges: re-run `python3
scripts/report-walking-pilot.py` (deterministic over the committed manifest and results, so not
duplicated verbatim here).

### Top 5 by distance ratio (farthest from 1.0, excluding snap-flagged edges)

| From → To | Hub/Cluster | Estimated | Routed | Ratio |
|---|---|---|---|---|
| JP-109 → JP-110 | Osaka/Shinsekai–Tennoji | 0.01 km | 0.060 km | 6.02 |
| JP-110 → JP-109 | Osaka/Shinsekai–Tennoji | 0.01 km | 0.060 km | 6.02 |
| JP-070 → JP-069 | Kioto/Yamashina | 0.36 km | 0.944 km | 2.62 |
| JP-095 → JP-067 | Kioto/Station–South | 0.6 km | 1.135 km | 1.89 |
| JP-084 → JP-065 | Kioto/North Kyoto | 1.79 km | 3.350 km | 1.87 |

(JP-109↔JP-110's own 6.02 ratio was not flagged by the snap guard — its routed distance is
larger, not smaller, than the haversine estimate, the opposite shape from the JP-063↔JP-065
snapping artifact. It has not been separately diagnosed; see "Limitations.")

### Top 5 by absolute minute difference (excluding snap-flagged edges)

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
- **Snap-flagged (excluded from comparable stats)**: 2 (JP-063→JP-065, JP-065→JP-063 — one
  underlying coordinate pair)

## Limitations

- **N=24 (22 comparable).** Every statistic above describes this sample, not the other ~308 "A
  pie" relations. The sample was built to include distance-bucket and speed-anomaly extremes on
  purpose, so it is not a random sample and its ratios should not be averaged into a single
  "correction factor" for anything outside itself.
- **Endpoint snapping was diagnosed for exactly one flagged coordinate pair, not for all 24.**
  The guard (`endpointSnapping`, `snap_warning`) now captures this automatically for any edge
  queried going forward (see `docs/LOGISTICS.md`), but the other 23 already-collected results
  predate the guard and do not carry it. Their absence of an `endpointSnapping` field is **not**
  a claim that they are snap-clean — it means snapping was never measured for them. In
  particular, JP-109↔JP-110's own 6.02× distance ratio (the sample's largest, in the *opposite*
  direction from the JP-063↔JP-065 artifact) has not been checked against the Snap endpoint and
  could plausibly have a related, if differently-shaped, explanation.
- **No real Directions failure was observed.** `no-route`, `request-error`, and the
  bounded-retry path remain verified only by mocked unit tests, not by this live run.
- **One provider, one profile, one point in time.** This says nothing about openrouteservice's
  general accuracy, about transit validation, or about any other provider.
- **`nearby.json` is untouched.** `toTransferEdge()` and `data/nearby.json` are unaffected by
  this phase or this finding; all 332 "A pie" relations (including JP-063→JP-065 and
  JP-109→JP-110) keep exactly the numbers they had before.

## Decision gate

**Recommendation: ADJUST.**

**Justification**: the pipeline's core integration is sound — correct host, correct coordinate
order, correct response parsing, a documented and non-inflating minutes rule, reproducible
caching, attribution captured per-result, and 24/24 Directions queries succeeded. But this
review surfaced a real, previously unhandled correctness gap: a validated-static result's
distance/minutes are not automatically comparable to the distance between the original
coordinates, and the pipeline had no way to detect or flag when they aren't. That is exactly the
kind of gap a controlled pilot exists to find before a larger batch makes it 10x more likely to
occur unnoticed. The gap is now closed at the schema and tooling level (`endpointSnapping`,
`snap_warning`, exclusion from `report-walking-pilot.py`'s aggregate stats,
`validate-logistics.py`'s consistency check) — but it has only been exercised against one real
case, not proven at scale, and 23 of the 24 existing results were never checked against it.

**What ADJUST means concretely, before any scale-up:**
1. Backfill (or re-derive without new Directions calls) `endpointSnapping` for the remaining 23
   manifest edges, particularly JP-109↔JP-110, so the pilot's own sample is fully screened.
2. Confirm the guard's threshold (10 m absolute AND ≥ 50% of the routed distance) holds up once
   more real snap data exists — it is currently calibrated against a single diagnosed case.
3. Decide, for a future scale-up, whether a snap-flagged edge should be retried with a smaller
   snap radius, reported as `no-route`-like ("not routing-grade"), or simply excluded — this
   phase only detects and reports the condition, it does not yet decide what should happen to
   such an edge's confidence.

**SCALE may be reconsidered once the above is done and the guard has been validated against more
than one real case.** This is not a STOP: nothing here indicates openrouteservice, the host, or
the core pipeline is unsound — the gap is specifically about endpoint-snapping awareness, which
is now instrumented and testable.

**Per Phase 3B2A's mandate, this review does not scale up.** No additional manifest edges were
validated, and no batch beyond this pilot's 24 was touched.
