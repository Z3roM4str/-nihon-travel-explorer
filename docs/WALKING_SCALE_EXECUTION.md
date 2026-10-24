# Phase 3B2B-B — Walking Scale-Up Execution

**Completed on 2026-09-04:** all 308 scale-manifest edges have terminal results:
**303 `validated`, 5 `no-route`, 0 `request-error`, 0 missing**.
All 303 validated results have `endpointSnapping.assessment: "clean"` under the
unchanged approved rule; none are `significant` or `unknown`.

Phase 3B2B-A was engineering/preparation only, with no real scale requests; its
historical report is [WALKING_SCALE_PREP.md](WALKING_SCALE_PREP.md). This document
records the subsequent real execution, including the interrupted first Directions
run and the explicitly authorized resumption. The pilot remains a separate,
unchanged artifact and report: [WALKING_PILOT.md](WALKING_PILOT.md).

## Inputs and offline gate

- Initial HEAD: `f4be15901e50cc1a93006783d4cea47e805f882b`.
- Existing branch: `feat/phase-3b2b-walking-scale-execution`; no replacement branch.
- Working tree initially clean, and clean again after the authorized local LF repair.
- Live dataset: 214 places, 403 nearby relations, 332 walking relations.
- Partition: 24 pilot edges + 308 scale edges = all 332 walking relations; zero overlap.
- Scale scope: 137 unique places. Before Snap, 34 resolved entries were reused from
  the pilot and 103 were missing; no stale, no-snap, or request-error entries.
- No pre-existing scale results or app copy existed before this phase's first run.

Windows `core.autocrlf=true` initially materialized CRLF bytes whose SHA-256 values
did not match the manifest, despite a Git-clean tree. Execution stopped before any
network request. With explicit authorization, repository-local `core.autocrlf=false`
and `core.eol=lf` were set and Git materialized the exact HEAD blobs. Temporary-file
permission inheritance also required repair before the network-enabled process
could read those files; that failed process made zero HTTP requests. Every tracked
file was verified byte-for-byte against HEAD before Snap. No recorded hash or
logical file content was changed, and no EOL policy was committed.

Verified input digests, unchanged from Phase 3B2B-A:

| Input | SHA-256 |
|---|---|
| `data/places.json` | `4184a0fe0f326ebdcd9c8e8003d335265ba3ec0aa926ddd6b977be11e916955c` |
| `data/nearby.json` | `8179246c7eecea8ca960182eaa679ba00026a729d00f56d1a24cd8792d113de9` |
| Pilot manifest | `58c5ee37ba110da68b347e00426a2642b4a52ca6d4f58a39651a19b009611a6f` |

The scale manifest was regenerated in memory and matched the committed document
and its serialized bytes exactly. Snap coordinates matched the current dataset.
The tests, validators, and dry-run passed before real requests; the relevant
Python tests, logistics validator, dry-run, and hash checks were repeated after LF
restoration. Counts were derived from the artifacts, not assumed from this report.

## Provider and actual request accounting

Provider: **openrouteservice / HeiGIT**, exclusively `https://api.heigit.org`,
profile **`foot-walking`**. The credential was supplied only through `ORS_API_KEY`
in the execution process environment. No credential or Authorization value was
written to repository files, execution logs, this report, or the PR.

| Operation | HTTP attempts | Bounded retries included | First request UTC | Last request UTC |
|---|---:|---:|---|---|
| Snap backfill, 103 places | 1 | 0 | 2026-09-04 15:41:10.578 | Same request |
| Directions first run, default 40/min | 120 | 3 | 2026-09-04 15:41:42.012 | 2026-09-04 15:44:06.927 |
| Directions resumed, authorized 20/min | 192 | 0 | 2026-09-04 16:18:38.709 | 2026-09-04 16:27:45.254 |
| **Total** | **313 (1 Snap + 312 Directions)** | **3** | | |

Counts came from a local Python audit observer of `urllib.Request` events, recording
only endpoint category, UTC/monotonic timestamps, and a SHA-256 fingerprint of the
coordinate request body. It did not log headers, credentials, or response bodies,
or change the HTTP client, retry policy, or rate limiter. Request fingerprints were
mapped back to the manifest: all 308 directed request bodies are distinct. The
observer and verification helpers are local audit tooling outside the repository;
the result artifacts below remain the only versioned routing-result source.

The 312 Directions attempts are **308 distinct edges + 3 bounded retries + 1
later re-query of the failed edge**. The later re-query is not counted as another
in-process bounded retry. No terminal edge was re-queried.

Snap's successful process elapsed time was 1.766 seconds. The resumed Directions
process took **547.313 seconds (9 min 7.313 s)**, including pacing and checkpoint
writes. The first run's last request was 145.000 seconds after process start;
its full process duration was not preserved because it was deliberately stopped.
The pause awaiting the user's decision is not operational routing time.

### Interruption, errors, and resumption

The first run left 117 checkpoint entries: 116 validated and one request-error,
`JP-031 → JP-032`, whose HTTP 429 persisted after its single bounded retry.
191 edges had no checkpoint entry. The operator stopped the process on detecting
that result. All 120 attempted requests were accounted for by those 117 entries;
no attempted edge was left without a checkpoint.

Three edges used a bounded retry in that first run:

- `JP-016 → JP-018`: recovered and was checkpointed as validated.
- `JP-031 → JP-032`: remained HTTP 429 after retry; recovered on the later run.
- `JP-033 → JP-036`: recovered and was checkpointed as validated.

The exact transient error types of the two recovered retries were not retained by
the existing client. They must not be described as confirmed 429s. `Retry-After`
and other rate-limit response headers were not preserved by the client or observer;
their values are unavailable, not known to be absent. No capture code was added.

After explicit authorization, the exact checkpoint and 137/137 resolved Snap gate
were reverified, then execution resumed with:

```text
python scripts/validate-walking-scale.py --execute --directions-per-minute 20
```

It queried only the 191 missing edges and the one retryable edge: 187 became
validated and 5 became no-route. There were **zero retries in this resumed run**,
so no transient 429 retry incident occurred. All 116 original terminal result
objects remained identical, including timestamps, and their request bodies were
absent from the resumed request log. Snap was not queried again. No `--refresh`,
`--allow-unknown-snap`, pacing disablement, or further rate reduction was used.

## Terminal results and Snap coverage

| Scale outcome | Count |
|---|---:|
| Manifest edges | 308 |
| Directions validated | 303 |
| Directions no-route | 5 |
| Directions request-error / missing | 0 / 0 |
| Validated snapping clean / significant / unknown | 303 / 0 / 0 |
| Required Snap places | 137 |
| Required places resolved / no-snap / request-error / stale / missing | 137 / 0 / 0 / 0 / 0 |

The entire Snap store contains **138 resolved places**: the 35 original pilot
places plus 103 newly queried places. One pilot-only place is outside the scale
manifest; it is not an extra scale requirement. All original entries were retained.

The five no-route results are preserved, not discarded or substituted with
estimates. Each provider response says a route could not be found between the
submitted points:

| From | To |
|---|---|
| JP-089 — Nijō Castle | JP-090 — Kyoto Imperial Palace |
| JP-090 — Kyoto Imperial Palace | JP-089 — Nijō Castle |
| JP-090 — Kyoto Imperial Palace | JP-092 — Kyoto International Manga Museum |
| JP-090 — Kyoto Imperial Palace | JP-102 — Demachi Masugata Shopping Arcade |
| JP-102 — Demachi Masugata Shopping Arcade | JP-090 — Kyoto Imperial Palace |

JP-090's Snap displacement is just **3.65 m**. Snap availability does not establish
network connectivity between endpoints. These are provider/profile/coordinate
outcomes at execution time, not proof that pedestrians cannot travel between the
real attractions. No additional diagnostic requests or coordinate corrections
were made, and no transport-mode validation was inferred from these responses.

## Comparable statistics and outliers

Statistics use **303 scale results that are both validated and clean**. The five
no-route edges have no comparable routed values and are excluded. No significant
or unknown result is included (both counts are zero in scale). Pilot statistics
remain separate; its two significant results were neither included nor reclassified.

Ratios use the existing `report-walking-pilot.py` comparison functions with the
scale manifest/results: routed meters / (`Distancia km` × 1000), and the stored
half-up-rounded whole routed minutes / `Min aprox.`. Each directed edge contributes
once, including both directions when present. Display rounding is to six decimals;
calculations use full stored precision.

| Routed / estimated ratio | Median | Mean | Min | Max |
|---|---:|---:|---:|---:|
| Distance | 1.355625 | 1.452052 | 1.040000 | 3.557368 |
| Minutes | 1.153846 | 1.227064 | 0.333333 | 3.200000 |

Every clean scale distance exceeds its rounded geographic estimate. That observation
does not establish entrance accuracy or turn these ratios into a correction factor.
Minute ratios also reflect the estimated speed model and whole-minute rounding.

Top five directed distance-ratio outliers (largest deviation from 1):

| Edge | Hub / cluster | Estimated km | Routed km | Ratio |
|---|---|---:|---:|---:|
| JP-135 → JP-136 | Osaka / Himeji | 0.38 | 1.3518 | 3.557368 |
| JP-136 → JP-135 | Osaka / Himeji | 0.38 | 1.3518 | 3.557368 |
| JP-124 → JP-125 | Osaka / Osaka Bay | 1.25 | 3.6693 | 2.935440 |
| JP-125 → JP-124 | Osaka / Osaka Bay | 1.25 | 3.6693 | 2.935440 |
| JP-157 → JP-159 | Okinawa / Shuri | 0.38 | 1.0111 | 2.660789 |

JP-159 → JP-157 ties the fifth row at the same ratio. Himeji Castle ↔ Kōko-en
(JP-135 ↔ JP-136) has 7.50 m / 14.23 m endpoint displacement, 0.38 km estimated
versus 1.3518 km routed, and 5 versus 16 minutes. The high distance ratio remains
in the statistics; it is not removed as an inconvenient outlier.

Top five directed absolute-minute-difference outliers:

| Edge | Estimated min | Routed min | Absolute difference |
|---|---:|---:|---:|
| JP-124 → JP-125 | 18 | 44 | 26 |
| JP-124 → JP-126 | 21 | 47 | 26 |
| JP-125 → JP-124 | 18 | 44 | 26 |
| JP-126 → JP-124 | 21 | 47 | 26 |
| JP-138 → JP-139 | 15 | 27 | 12 |

JP-139 → JP-138 ties the fifth row. The Osaka Bay rows connect Osaka Aquarium
Kaiyukan with Universal Studios Japan / SUPER NINTENDO WORLD. These remain walking
provider results, without substituting another mode or claiming attraction access.

Reproduce the comparisons and full directed outlier output offline:

```text
python scripts/report-walking-pilot.py --manifest data/logistics/walking-scale-manifest.json --results data/logistics/walking-scale-results.json
```

The legacy command still labels its output "Pilot"; the supplied paths determine
the actual population. No new parallel results format or reporting logic was added.

## Endpoint absolute-threshold audit — no change proposed or applied

The approved rule remains combined endpoint displacement ≥ 10 m **and** ≥ 50% of
routed distance. `SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS` remains **`None`**.
`clean` below means passing that rule, not independently verified physical access.

Unique-place statistics avoid counting a shared endpoint repeatedly. Edge statistics
use the 303 validated scale results. Percentiles use linear interpolation at index
`(N - 1) × p` in the sorted values; they are descriptions, not decision thresholds.

| Population / measure | N | Min | Median | Mean | P90 | P95 | P99 | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Required unique-place snap, m | 137 | 0.17 | 10.67 | 17.907 | 37.30 | 57.798 | 123.236 | 198.63 |
| Max endpoint per validated edge, m | 303 | 0.82 | 16.85 | 24.906 | 47.22 | 62.32 | 197.444 | 198.63 |
| Combined endpoints per validated edge, m | 303 | 1.17 | 23.32 | 31.910 | 62.138 | 94.43 | 198.525 | 201.35 |
| Combined snap / routed distance, % | 303 | 0.051 | 2.049 | 3.306 | 6.758 | 10.613 | 17.887 | 44.669 |

Largest distinct place measurements:

| Place | Snap m | Incident clean scale edges |
|---|---:|---:|
| JP-029 — Imperial Palace East Gardens | 198.63 | 4 |
| JP-185 — Furuzamami Beach (pilot reuse) | 139.31 | 1 |
| JP-064 — Hōnen-in | 94.66 | 7 |
| JP-181 — ASMUI Spiritual Hikes | 80.69 | 2 |
| JP-069 — Bishamon-dō (pilot reuse) | 77.96 | 1 |

The high absolute-displacement tail is real and is retained. Compared with the
pilot audit's 139.31 m case, scale adds one larger independent place, JP-029.
Multiple incident edges or reverse directions do not turn it into four independent
measurements. Only two of the 137 required places exceed 100 m.

For sensitivity only, the **100 m example already used by Phase 3B2B-A's seam test**
would change these five scale edges from clean to significant:
`JP-028 → JP-029`, `JP-029 → JP-028`, `JP-029 → JP-030`, `JP-030 → JP-029`,
and `JP-185 → JP-184`. It would also change the historical pilot edge
`JP-184 → JP-185`. This calculation was in memory only: **100 m is not a proposed
cutoff**, and none of those artifacts was reclassified.

The closest case to the existing relative gate is JP-181 ↔ JP-182: 94.43 m combined
displacement on a 211.4 m route, or 44.669%, below the unchanged 50% rule. Both
directions remain clean and included in the statistics, with this limitation made
explicit rather than hidden.

**Finding:** the larger batch measures the distribution, but does not establish
which displaced endpoints are unacceptable attraction entrances or incorrect graph
matches. There is no independently labelled set of acceptable/unacceptable snaps,
verified entrance locations, or agreed absolute access-error tolerance from which
to calibrate a defensible new cutoff. Choosing the P95, a round 100 m, or a gap in
this tail would introduce a new methodological assumption. No absolute threshold
is recommended by this execution audit, so there is no proposed reclassification
requiring approval before completing this phase. Future calibration should review
these specific cases against independent access/entrance evidence first; this is
not a conclusion that a 198.63 m displacement is harmless.

## Artifacts, completeness, and validation

The existing pipeline checkpointed every completed edge. The app copy remained
absent during incomplete checkpoints and was published only after
`is_batch_complete(results, manifest_keys) == True`, including all five terminal
no-route answers. The offline `--recombine-snapping` pass then reported **0 changes**.

| Artifact | SHA-256 |
|---|---|
| `data/logistics/walking-snap-places.json` | `f44a0dd705a3fc297284c0f67f76e1c809d9bae63d80918730257c583701658e` |
| `data/logistics/walking-scale-results.json` | `42315b8fe5921decaeefc9d80e77b847276b8681483cb5066af4c76511cdf4fb` |
| `app/src/data/logistics/walking-scale-results.json` | Same result hash; byte-for-byte parity |

Final checks after recombination:

| Command | Result |
|---|---|
| `python scripts/test_walking_pilot.py` | 63 tests pass |
| `python scripts/test_walking_scale.py` | 125 tests pass |
| `npm test` (in `app/`) | 104 tests pass |
| `npm run lint` (in `app/`) | Pass |
| `npm run build` (in `app/`) | Pass; existing >500 kB chunk warning |
| `python scripts/validate-dataset.py data` | Pass; 13 pre-existing secondary-metadata warnings |
| `python scripts/validate-geography.py` | Pass: 47 prefectures/polygons, 214 places resolved |
| `python scripts/validate-logistics.py data` | Pass: 24 pilot results, 308 scale results |

Python commands used the bundled Python 3.12.14 executable on Windows because
`python3` was unavailable on PATH. The scale suite actually contains 125 tests;
the preparation document's 123 count predates its two atomic-write tests.
Additional read-only checks verified terminal completeness, exact result-key
coverage, byte parity, unchanged original terminal objects, no terminal re-query,
unchanged dataset/pilot-manifest digests, and credential absence from repository
and local audit files. No application or pipeline code/test changes were needed.

## Limits and deferred work

- This is one provider, profile, dataset, and execution date; it does not validate
  accessibility, opening hours, entrances, future graph versions, or transit.
- Reverse directions and shared endpoints are correlated observations. Neither the
  303-edge mean nor the Snap percentiles justify a universal correction factor.
- The five no-route results remain unresolved as real-world access questions;
  they are terminal provider answers, not request failures or invented zero times.
- The app-facing JSON is prepared and synchronized by the existing pipeline.
  `getBestTransfer` still imports the pilot artifact only; wiring scale results
  into application behavior is not part of this execution, and no UI change is
  claimed. Any later consumer must retain the existing clean-only promotion gate.
- A versioned LF policy and richer operational response-header/error telemetry
  remain separate reproducibility/observability debt. Neither was implemented here.
- No nearby/places content, source workbook, GeoJSON, UI, or pilot result changed.
  No threshold changed, no problematic result was deleted, and no itinerary,
  place/city ordering, day estimate, transit, Shinkansen, ferry, flight, or Phase 3C
  work was started. The phase ends with review; no merge is performed.
