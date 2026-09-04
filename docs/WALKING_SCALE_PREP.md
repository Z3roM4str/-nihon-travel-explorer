# Phase 3B2B-A — Walking Scale-Up Engineering & Snap Threshold Analysis

This is **preparation only**. Nothing in this phase executes the ~308-edge scale-up batch
against a real routing provider: it builds the manifest that batch would use, designs and
seeds the per-place Snap store that batch would read, refactors the pipeline so Snap and
Directions are independent and restart-safe steps, and audits (without changing) the
endpoint-snapping threshold using Phase 3B2A's real 24-edge result. `nearby.json`,
`places.json`, the workbook, GeoJSON, and the UI are all untouched. See
`docs/WALKING_PILOT.md` for Phase 3B2A's own pilot and decision gate (SCALE, carrying the
snap-clean gate forward) — this phase is the engineering work that recommendation implied,
stopping short of the actual batch.

## 1. The scale-up manifest

`scripts/select-walking-scale.py` derives `data/logistics/walking-scale-manifest.json`: every
directed `"A pie"` edge in `data/nearby.json` that is **not** one of Phase 3B2A's 24 pilot
edges. This is a set difference over the live dataset and the committed pilot manifest, never
a hardcoded count — `scaleEdgeCount` in the manifest's own `sourceDatasetContext` is computed
as `walkingRelationCount - pilotEdgeCount` at build time, and both of those numbers come from
reading `data/nearby.json` and `data/logistics/walking-pilot-manifest.json`, respectively.

Real output against the current dataset:

- 403 total `nearby.json` relations, 332 of them `"A pie"`.
- 24 already covered by the Phase 3B2A pilot manifest.
- **308 scale-up edges** — this is where "~308" in earlier conversations comes from; it is
  a derived fact of the current dataset, not a constant anyone chose.

Reproducibility follows the same discipline as the pilot manifest: `sourceDatasetContext`
carries a sha256 `datasetDigest` of `places.json`/`nearby.json` (not a git SHA — see
`docs/LOGISTICS.md`) plus a `pilotManifestDigest` of the exact pilot manifest file the
exclusion was computed against, so a byte-identical re-run is verifiable against both
inputs. `scripts/select-walking-scale.py` refuses to build a manifest if the pilot manifest
itself has a duplicate edge, doesn't have exactly 24 edges, or references an edge that isn't
actually a current `"A pie"` relation — see `ScaleManifestDerivationTests` in
`scripts/test_walking_scale.py`.

**Partition invariant**: pilot ∪ scale must equal every current `"A pie"` relation, with zero
overlap. `scripts/validate-logistics.py`'s `check_pilot_scale_partition()` checks this
directly against the live dataset on every run (see `RealCommittedArtifactsTests` in
`scripts/test_walking_scale.py` for the real-data regression).

## 2. The per-place Snap store

Endpoint snapping is a property of a coordinate, not of a directed edge — Phase 3B2A's own
finding (`docs/WALKING_PILOT.md`) already established this, and the openrouteservice Snap
endpoint accepts many locations in one request. Phase 3B2A's pipeline still queried Snap
once per *edge* (two coordinates), which meant a place appearing in N edges got re-measured
N times. Phase 3B2B-A replaces that with a store keyed by `placeId`:
`data/logistics/walking-snap-places.json` — see `logistics_common.py`'s
`build_snap_place_entry()`/`is_snap_entry_current()`. Each entry carries:

- `coordinates` — the exact `{lat, lng}` sent to the Snap endpoint, so a later dataset edit
  that moves the place is detectable as staleness (`is_snap_entry_current`) instead of
  silently reusing an outdated measurement.
- `snappedDistanceMeters` — a real number, or `null`. **Never coerced to `0`** — a place
  whose snap measurement failed or was never taken has `status: "unknown"`; only a place
  with a real, non-null measurement has `status: "resolved"`. This is the same discipline
  `classify_endpoint_snapping` already enforces at the edge level, applied at the place
  level.
- `radiusMeters`, `provider`, `profile`, `verifiedAt` — self-contained per entry, so each
  record is independently auditable.

**No new network request was made to build the real store in this phase.**
`scripts/seed-walking-snap-store.py` migrates the 35 places Phase 3B2A's real
`--backfill-snapping` run already measured (see `docs/WALKING_PILOT.md`) from
`walking-pilot-results.json`'s edge-keyed `endpointSnapping` into this place-keyed store,
purely offline. It cross-checks that a place appearing in more than one pilot edge always
yields the same measurement — it does, in every one of the real 35 places (e.g. JP-065
appears in three different pilot edges and shows `20.71` in all three) — which is itself a
second, independent confirmation that snapping really is a stable property of the
coordinate, not an artifact of which edge asked about it.

Of the scale manifest's 137 unique places, **34 already have a resolved, current entry**
purely from this migration — zero new Snap requests needed for them when a future phase
actually executes. The remaining 103 would need one batched `--backfill-snap-places` run
(see below).

## 3. Separating Snap from Directions

`scripts/validate-walking-scale.py` is a new, independent pipeline (Phase 3B2A's
`scripts/validate-walking-pilot.py` is untouched in its external behavior — see "Refactor"
below) with four modes, each a separate concern:

- `--backfill-snap-places`: Snap-only. Derives which of the scale manifest's unique places
  still lack a current, resolved Snap entry (`edges_needing_snap_assessment`'s scale-side
  counterpart, `places_needing_snap` — never a hardcoded count), batches them into chunks of
  up to `ORS_SNAP_MAX_LOCATIONS_PER_REQUEST` (5,000 — openrouteservice's own documented
  per-request location cap), and **writes the store after every chunk**. An interruption
  mid-batch loses at most the one in-flight chunk; re-running only re-derives what's still
  missing, never re-fetching an already-resolved place. Never touches Directions or the
  results file.
- `--execute`: Directions-only, one query per pending scale edge, skipping a cached
  `"validated"` edge unless `--refresh` (identical caching discipline to the pilot's
  `--execute`). It does **not** make a Snap request itself — it combines the routed distance
  with whatever the Snap store already has for that edge's two places at read time
  (`combine_snapping_for_edge`), producing the same `endpointSnapping` shape
  (`clean`/`significant`/`unknown`) the pilot already produces. If a place's Snap
  measurement isn't resolved yet, the edge gets `"unknown"` with an explicit reason — never
  a fabricated `"clean"`.
- `--recombine-snapping`: no network at all. Recomputes `endpointSnapping` for every
  currently-`"validated"` scale result from the Snap store's *current* contents. Useful
  after a later `--backfill-snap-places` run resolves places that were still `"unknown"`
  when `--execute` first ran for their edges — lets a result's snap assessment improve
  without ever re-querying Directions for it.
- `--dry-run`: no network — see §5.

A validated scale result's `confidence` is always `"validated-static"` on success, exactly
the schema the pilot already produces. The actual clean-only promotion happens where it
already happens today: `app/src/lib/transfer.ts`'s `getBestTransfer`, reading
`endpointSnapping.assessment`. Nothing about that function needed to change for scale-up —
Phase 3B2B-A added a generic property test
(`app/src/lib/transfer.test.ts`, "the gate holds generically over a synthetic batch of any
size") proving the same rule holds for 200 synthetic edges with every assessment value, not
just the pilot's specific 24.

**Refactor**: the generic openrouteservice HTTP client code (Directions request, Snap
request, retry policy, failure classification, attribution text) that used to live inside
`scripts/validate-walking-pilot.py` moved to `scripts/ors_client.py`; the
`WalkingPilotResult`-shaped builders (`build_success_result`, `build_failure_result`,
`build_endpoint_snapping`) moved to `scripts/walking_result_builder.py`. Both the pilot and
scale-up pipelines import the same functions — nothing about the pilot's external behavior
changed (its full 63-test suite passes unmodified after the move; see
`scripts/test_walking_pilot.py`).

## 4. Threshold audit (no threshold changed)

Phase 3B2A's guard classifies an edge `"significant"` when the **combined** endpoint snap is
both ≥ 10 m and ≥ 50% of the routed distance. This audit examined the full real N=24 sample's
snap distribution to check whether that rule is still reasonable as the gate for a much
larger batch, or whether a second, per-endpoint absolute criterion is needed.

Real distribution across the 24 validated pilot edges (`fromSnapMeters`/`toSnapMeters`, in
meters):

| Statistic | fromSnapMeters | toSnapMeters | combined | per-endpoint max | combined/routed ratio |
|---|---|---|---|---|---|
| min | 0.19 | 0.19 | 4.14 | 2.37 | 1% |
| median | 11.11 | 12.80 | 24.14 | 21.00 | 3% |
| mean | 14.57 | 21.80 | 36.37 | 28.08 | 63%* |
| max | 63.49 | 139.31 | 153.21 | 139.31 | 717%* |
| stdev | 14.18 | 30.27 | 35.57 | 29.29 | 197%* |

*The ratio's mean/max/stdev are dominated by the one genuinely `"significant"` pair
(JP-063↔JP-065, ratio 717% on a 3.2 m route) — excluding it, the other 23 edges' ratios
range 1%–13%.

**The case this audit exists to surface**: JP-184→JP-185, combined snap 153.21 m (13.90 m +
139.31 m), on a 1,314.1 m route. Ratio = 11.66%, well under the 50% threshold, so it stays
`"clean"` — correctly, under the current rule's own logic. But a single endpoint (JP-185)
snapped **139.31 m** — more than a football field — from its recorded coordinate. Nothing in
the current rule looks at a single endpoint's absolute displacement independent of route
length; it only ever looks at the *combined* value relative to the *route's own* length.

**Finding**: N=24 contains exactly one case anywhere near this magnitude (the next-highest
per-endpoint value is 77.96 m, also `"clean"`, also on a long route). That is not enough
evidence to responsibly calibrate a specific second threshold — doing so from one data point
risks either being too strict (flagging ordinary long-route snaps that happen to share the
same order of magnitude) or too loose (a number picked to just barely miss the one known
case). **This audit does not set a new threshold.**

**What changed instead**: `classify_endpoint_snapping()` in `scripts/logistics_common.py`
gained an optional `per_endpoint_absolute_cap_meters` parameter, defaulting to the new named
constant `SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS = None` (disabled). This makes the
threshold an explicit, auditable, configurable seam instead of leaving the open question
unaddressed in code:

- With the default (`None`), every existing Phase 3B2A classification is byte-identical to
  before this phase — confirmed by `ClassifyThresholdAuditSeamTests` in
  `scripts/test_walking_scale.py`, including the JP-184→JP-185 case staying `"clean"`.
- A future phase with a larger, more representative sample can set a real number here
  (verified: `classify_endpoint_snapping(13.9, 139.31, 1314.1, per_endpoint_absolute_cap_meters=100.0)`
  does correctly return `"significant"` once such a cap is actually set) without touching
  the classification function itself again.
- **No Phase 3B2A result was silently reclassified.** `data/logistics/walking-pilot-results.json`
  is byte-for-byte unchanged by this phase.

## 5. Dry-run: what a real scale-up would need

`python3 scripts/validate-walking-scale.py --dry-run` (real output, no network, against the
current dataset):

```
Scale-up edges: 308 (derived: total 'A pie' relations minus the 24 pilot edges)
  already validated: 0
  pending: 308

Unique places referenced: 137
  already snap-resolved (current): 34
  still needing a Snap measurement: 103

Distribution by hub (counted by each edge's fromId hub):
  Kioto: 92
  Okinawa: 34
  Osaka: 66
  Tokio: 116

Distribution by estimated distance bucket:
  <0.5 km: 73
  0.5-1 km: 111
  >=1 km: 124

Request plan (baseline, no failures/retries):
  Snap requests: 1 (batches of up to 5000 locations covering 103 still-unresolved place(s))
  Directions requests: 308 (one per pending edge)
  Directions requests, worst case with the bounded retry policy (1 retry/edge): 616
```

**Quota**: openrouteservice's documented community-plan defaults (verified 2026-09 against
[openrouteservice.org/restrictions](https://openrouteservice.org/restrictions/) and the
[backend FAQ](https://giscience.github.io/openrouteservice/frequently-asked-questions)) are
**2,000 Directions requests/day and 40/minute**; the Snap endpoint's own per-request cap is
documented as **5,000 locations/request**, but its per-minute/per-day rate limit is not
published in either source — this document does not guess one. 308 pending Directions
requests fit comfortably inside the daily quota but must be paced over at least 8 minutes to
respect the per-minute limit; a specific account's actual plan should still be checked on its
own dashboard before any real execution, since limits can differ by plan.

## 6. Validation

New/extended test coverage (all offline, no network):

- `scripts/test_walking_scale.py` (54 tests): scale-manifest derivation (pilot ∪ scale =
  every walking edge, zero overlap, zero duplicates, no non-walking relation ever admitted,
  edge count never hardcoded, deterministic across runs, pilot-manifest sanity checks), the
  Snap-place-store schema (`resolved`/`unknown`, null never coerced to `0`, staleness
  detection), the seeding migration (including its inconsistency check), the dry-run report,
  `--backfill-snap-places` (single/chunked batching, no-op when already current, never calls
  Directions), `--execute` (cache/resume, `--refresh`, never calls Snap itself),
  `--recombine-snapping`, the new `validate-logistics.py` scale/snap-store checks
  (duplicate/overlap/coverage/non-walking-relation/secret-scan), and five regression tests
  against the real committed `walking-scale-manifest.json` and `walking-snap-places.json`.
- `scripts/test_walking_pilot.py` (63 tests, unchanged in count and assertions): confirms
  the `ors_client`/`walking_result_builder` refactor didn't change the pilot pipeline's
  behavior.
- `app/src/lib/transfer.test.ts` (50 tests, +1): the new generic snap-gate property test
  described in §3.

All of the following were run and pass:

```
python3 scripts/test_walking_pilot.py         # 63/63
python3 scripts/test_walking_scale.py         # 54/54
npm test                                       # 104/104 (50 in transfer.test.ts)
npm run lint                                   # clean
npm run build                                  # succeeds
python3 scripts/validate-dataset.py data      # OK, pre-existing warnings only
python3 scripts/validate-geography.py         # OK
python3 scripts/validate-logistics.py data    # OK: 24 pilot + 308 scale manifest edges,
                                               #     0 scale results yet (not executed)
```

`git diff --stat` confirms `data/nearby.json`, `data/places.json`, the source workbook,
GeoJSON, and every UI component are untouched by this phase. A secret scan of the full diff
(base64-ish tokens, `Authorization` headers, `ORS_API_KEY=` literals) found nothing; the
`ORS_API_KEY` used for Phase 3B2A's earlier real queries was never re-entered or re-used in
this phase — see §2, no new network request was made.

## What Phase 3B2B-A deliberately does not do

- **Does not execute the 308-edge scale-up batch.** `data/logistics/walking-scale-results.json`
  does not exist after this phase — `--execute` is implemented and tested against mocks only.
- **Does not run `--backfill-snap-places` for real** for the 103 still-unresolved places —
  the 34 already-known places were migrated offline instead, and the remaining 103 are left
  for whichever phase actually executes the batch.
- **Does not change the endpoint-snapping threshold.** See §4 — the evidence does not
  support setting one yet, and none of Phase 3B2A's 24 results were reclassified.
- **Does not touch `nearby.json`, `places.json`, the workbook, GeoJSON, or any UI
  component.**
- **Does not start transit validation, itinerary generation, or Phase 3C.**
