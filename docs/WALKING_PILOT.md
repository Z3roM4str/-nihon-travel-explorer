# Phase 3B2A — Walking Validation Pilot: results

This is the report for the **executed** pilot. For the architecture, the pipeline scripts, the
schema, the coordinate-order/minute-rounding rules, and the attribution requirements, see
"Phase 3B2A — walking-validation pilot" in `docs/LOGISTICS.md`. This document only reports what
the run actually found — it does not repeat the design rationale.

**This is a pilot over 24 edges, not a statement about the dataset's other ~308 "A pie"
relations.** Nothing here should be read as "openrouteservice is accurate" or "multiply every
walking edge's estimate by some factor" — see "Limitations" below.

## Run metadata

- **Date**: 2026-09-04
- **Base commit**: `cec45541d068445edc34762dec93ac3100f62cec` (the SHA Phase 3B2A's branch was
  cut from; the manifest's `sourceDatasetContext.mainSha` records the same value)
- **Provider**: openrouteservice, operated by HeiGIT
- **Host**: `https://api.heigit.org` (not the deprecated `api.openrouteservice.org`)
- **Profile**: `foot-walking`
- **Manifest**: `data/logistics/walking-pilot-manifest.json`, 24 edges, selected by the
  deterministic algorithm documented in `docs/LOGISTICS.md`
- **Results**: `data/logistics/walking-pilot-results.json` (mirrored to
  `app/src/data/logistics/`)
- **`verifiedAt` range**: `2026-09-04T01:30:13Z` to `2026-09-04T01:30:26Z` (24 queries, 13 seconds
  wall-clock — well inside any reasonable rate limit for a 24-request batch)

## Outcome

**24 / 24 queried, 24 validated, 0 `no-route`, 0 `request-error`.** No retry was needed — every
edge succeeded on the first request. This means the pipeline's failure-handling paths
(`no-route` classification, `request-error` classification, the one bounded retry) are verified
by unit tests with mocked responses (`scripts/test_walking_pilot.py`) but were **not exercised
against a real failure** in this run — see "Limitations."

## Pilot findings (N=24)

| Metric | Median | Mean | Min | Max |
|---|---|---|---|---|
| Distance ratio (routed / estimated) | 1.362 | 1.744 | 0.160 | 6.020 |
| Minute ratio (routed / estimated) | 1.143 | 1.113 | 0.000 | 2.200 |

Read directly: **routed walking distance was larger than the haversine estimate for 22 of the 24
edges**, which is the expected direction (a straight line is never longer than a real path).
Two edges (a same-cluster pair validated in both directions) came back *shorter and faster*
than estimated — see below.

### Top 5 by distance ratio (farthest from 1.0)

| From → To | Hub/Cluster | Estimated | Routed | Ratio |
|---|---|---|---|---|
| JP-109 → JP-110 | Osaka/Shinsekai–Tennoji | 0.01 km | 0.060 km | 6.02 |
| JP-110 → JP-109 | Osaka/Shinsekai–Tennoji | 0.01 km | 0.060 km | 6.02 |
| JP-070 → JP-069 | Kioto/Yamashina | 0.36 km | 0.944 km | 2.62 |
| JP-095 → JP-067 | Kioto/Station–South | 0.6 km | 1.135 km | 1.89 |
| JP-084 → JP-065 | Kioto/North Kyoto | 1.79 km | 3.350 km | 1.87 |

### Top 5 by absolute minute difference

| From → To | Hub/Cluster | Estimated | Routed | Abs diff |
|---|---|---|---|---|
| JP-084 → JP-065 | Kioto/North Kyoto | 25 min | 40 min | 15 min |
| JP-070 → JP-069 | Kioto/Yamashina | 5 min | 11 min | 6 min |
| JP-095 → JP-067 | Kioto/Station–South | 8 min | 14 min | 6 min |
| JP-159 → JP-158 | Okinawa/Shuri | 10 min | 14 min | 4 min |
| JP-168 → JP-169 | Okinawa/Central Okinawa | 17 min | 21 min | 4 min |

### The one genuine "shorter than estimated" case

JP-063 ↔ JP-065 (Kioto/Okazaki–Philosopher, validated both directions) is the dataset's
implied-speed floor artifact called out at selection time (`docs/LOGISTICS.md`, category D):
`nearby.json` records 0.02 km / 3 min (its 3-minute floor dominating a near-zero haversine
distance). The real route measured **3.2 meters / ~13 seconds**, rounding to `0` minutes under
this pipeline's rounding rule — not a failure, a legitimately tiny, real walk between two
adjacent points. This is the clearest evidence in the pilot that the haversine-speed-model's
minutes floor, not the distance estimate itself, is the source of its least reliable numbers at
the very-short end.

Full per-edge output (all 24, generated from real data): re-run `python3
scripts/report-walking-pilot.py` — it is deterministic over the committed manifest and results,
so it is not duplicated verbatim here to avoid a second source of truth for the same numbers.

## Successes / failures

- **Successes**: 24 (100% of the sample)
- **`no-route`**: 0
- **`request-error`**: 0

## Limitations

- **N=24.** Every statistic above describes this sample, not the other ~308 "A pie" relations.
  In particular, the sample was built to include distance-bucket and speed-anomaly extremes on
  purpose (see selection algorithm), so it is not a random sample and its ratios should not be
  averaged into a single "correction factor" for anything outside itself.
- **No real failure was observed.** `no-route`, `request-error`, and the bounded-retry path
  remain verified only by mocked unit tests, not by this live run. A larger batch (the eventual
  ~308-edge scale-up) is far more likely to hit at least one genuine failure — a request that
  gets rate-limited, an edge whose points fall outside OSM's routable road network — and this
  pilot provides no evidence about how the real API behaves under those conditions.
- **One provider, one profile, one point in time.** This says nothing about openrouteservice's
  general accuracy, about transit validation, or about any other provider.
- **The floor-artifact finding is a property of `nearby.json`'s existing minutes rule**, not
  something this pilot fixes — `toTransferEdge()` and `data/nearby.json` are untouched by this
  phase, so those 332 "A pie" relations keep exactly the same numbers they had before.

## Decision gate

**Recommendation: SCALE, with one caveat.**

**Justification**: the architecture worked end-to-end against production data with zero
integration defects — correct host (`api.heigit.org`, not the deprecated one), correct
coordinate order (verified both by a dedicated unit test and by the routed distances landing in
the expected range for every edge), correct response parsing, a documented and non-inflating
minutes rule, a structured and auditable provenance/confidence contract that never touched the
original estimated data, reproducible caching (a second `--execute` run would skip all 24 as
already validated), and attribution captured per-result. The 24/24 success rate and the
directionally sensible ratios (routed ≥ estimated in 22/24 cases, as geometry predicts) are real
evidence the pipeline produces trustworthy output, not just that it runs without crashing.

**The caveat**: this run never exercised a real failure. Before scaling to the ~308 remaining "A
pie" edges, a follow-up phase should either (a) deliberately test the failure paths against a
real deniable case (e.g., a coordinate pair known to sit off the routable network) or (b) accept
the residual risk and monitor the first larger batch closely rather than assuming the mocked
failure-handling tests are sufficient evidence on their own.

**Per Phase 3B2A's mandate, this pilot does not scale itself.** No additional edges are
validated by this phase; that decision and its execution belong to a separate, later phase.
