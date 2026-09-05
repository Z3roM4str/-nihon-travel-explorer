# Phase 3B2H — Targeted Access-Point Walking Revalidation

Phase 3B2H is [`ACCESS_POINT_DESIGN.md`](ACCESS_POINT_DESIGN.md) §19 **Stage 4**: reroute
only the walking edges the Phase 3B2G access points actually affect, and compare the
answers against — never over — the historical place-coordinate results.

It is **generation + evidence + comparison only**. It does not integrate access points
into `getBestTransfer()`, does not change any threshold, and does not regenerate the 332
walking relations.

## Status in this checkout

> **Not executed.** The target set, the candidate expansion, the pipeline, the validator
> and the test suite are complete and committed. **`ORS_API_KEY` is not available in this
> environment**, so — per the phase's own stop condition — the run halted *before any
> real request*. **Zero openrouteservice calls were made: no Snap, no Directions, no
> geocoding, no other provider.** `data/logistics/walking-access-point-results.json`
> therefore does not exist yet.
>
> A results artifact is deliberately **not** committed as an empty or placeholder file: a
> `candidates: []` document would be indistinguishable from "we ran it and the provider
> returned nothing". The committed manifest is the fully-derived, verifiable statement of
> what will be queried; its absence of a results sibling is the unambiguous signal that
> the batch has not run.
>
> **Phase 3B2H is therefore not complete.** It completes when `--backfill-snap` and
> `--execute` run green with a key and the validator passes over the resulting artifact.

## 1. Target set

Derived programmatically by `derive_target_edges()` from the committed walking
manifests and results — a **set intersection**, never a hand-written list and never a
new sample:

> every historical directed `A pie` edge (pilot **or** scale) with `JP-029` or `JP-181`
> at either end.

**6 directed edges. 0 from the pilot artifact, 6 from the scale artifact.** No edge with
both targets exists (JP-029 and JP-181 share no relation). Direction is preserved
throughout: `JP-028 -> JP-029` and `JP-029 -> JP-028` are two separate entries and are
never collapsed into one undirected pair.

Each edge's current historical (place-coordinate) answer, copied verbatim into every
candidate's `lineage`:

| Directed edge | Origin | Status | Distance (m) | Minutes | Snapping | Snap from / to (m) | Verified at |
|---|---|---|---|---|---|---|---|
| `JP-028` -> `JP-029` | scale | validated | 1565.2 | 19 | clean | 2.72 / 198.63 | 2026-09-04T15:43:02Z |
| `JP-029` -> `JP-028` | scale | validated | 1565.2 | 19 | clean | 198.63 / 2.72 | 2026-09-04T15:43:03Z |
| `JP-029` -> `JP-030` | scale | validated | 1816.5 | 22 | clean | 198.63 / 0.82 | 2026-09-04T15:43:03Z |
| `JP-030` -> `JP-029` | scale | validated | 1816.5 | 22 | clean | 0.82 / 198.63 | 2026-09-04T15:43:04Z |
| `JP-181` -> `JP-182` | scale | validated | 211.4 | 3 | clean | 80.69 / 13.74 | 2026-09-04T16:27:42Z |
| `JP-182` -> `JP-181` | scale | validated | 211.4 | 3 | clean | 13.74 / 80.69 | 2026-09-04T16:27:43Z |

Places involved: `JP-028` Jimbocho Book Town, `JP-029` Imperial Palace East Gardens,
`JP-030` Tokyo Station Marunouchi Building, `JP-181` ASMUI Spiritual Hikes, `JP-182`
Cape Hedo.

All six are currently `validated` and all six are `clean`. **Every one of them is
already promotable to `validated-static` by `getBestTransfer()` today** — this phase is
not repairing broken edges, it is asking whether the answer they carry is about the
point a traveller actually walks to.

### Why these edges are worth asking about

`JP-029`'s own display coordinate snaps **198.63 m** to reach the road network — it sits
inside the palace grounds, away from any routable path. That displacement is large in
absolute terms, yet all four of its edges classify `clean`, because the combined
displacement stays under half of a 1.5–1.8 km routed distance. This is precisely the
pattern Phase 3B2B-A's threshold audit flagged on `JP-184->JP-185` and deliberately did
**not** legislate against: `SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS` remains
`None`. Phase 3B2H does not revisit that decision either. It takes the other route
available: route to a **catalogued, officially evidenced gate** instead, and let the
comparison show what the difference actually is.

`JP-181` snaps 80.69 m for the same kind of reason.

## 2. Candidate expansion — 14 routed candidates

Each target edge expands into one candidate **per eligible access point** of its target
place, keeping direction. Eligibility is `status: "active"` **and**
`applicableContexts` containing `external-walk`. The non-target end of every edge keeps
the exact place coordinate the historical result used, so the comparison isolates a
single variable.

### JP-029 — three gates, no default, all three routed (12 candidates)

`JP-029` has **three** officially designated entrance/exit gates and **zero** default
(`selection.defaultForContexts` is empty on all three). Choosing among them by ID, by
catalog position, or by haversine is **forbidden** — see
[`ACCESS_POINT_DESIGN.md`](ACCESS_POINT_DESIGN.md) §12 and §16, and
`logistics_common.eligible_access_points`, which returns *all* eligible points and never
"the first" or "the nearest".

So every one of its four directed edges is routed **three times**, once per gate, and
each candidate is recorded separately:

| Candidate key | Direction | Gate |
|---|---|---|
| `JP-028->JP-029@AP-JP-029-001` | JP-029 is destination | Ōte-mon |
| `JP-028->JP-029@AP-JP-029-002` | JP-029 is destination | Hirakawa-mon |
| `JP-028->JP-029@AP-JP-029-003` | JP-029 is destination | Kitahanebashi-mon |
| `JP-029@AP-JP-029-001->JP-028` | JP-029 is origin | Ōte-mon |
| `JP-029@AP-JP-029-002->JP-028` | JP-029 is origin | Hirakawa-mon |
| `JP-029@AP-JP-029-003->JP-028` | JP-029 is origin | Kitahanebashi-mon |
| `JP-029@AP-JP-029-001->JP-030` | JP-029 is origin | Ōte-mon |
| `JP-029@AP-JP-029-002->JP-030` | JP-029 is origin | Hirakawa-mon |
| `JP-029@AP-JP-029-003->JP-030` | JP-029 is origin | Kitahanebashi-mon |
| `JP-030->JP-029@AP-JP-029-001` | JP-029 is destination | Ōte-mon |
| `JP-030->JP-029@AP-JP-029-002` | JP-029 is destination | Hirakawa-mon |
| `JP-030->JP-029@AP-JP-029-003` | JP-029 is destination | Kitahanebashi-mon |

When `JP-029` is the destination, each gate is routed as *origin endpoint -> gate*; when
it is the origin, as *gate -> destination endpoint*. Direction is never inferred from
the other direction's answer.

**No winner is promoted.** If a later phase needs one answer per edge, it must derive it
from these real routed results and document the criterion; Phase 3B2H stores no default
and changes no `selection` block.

### JP-181 — one external point (2 candidates)

`JP-181` has exactly one valid external access point: **`AP-JP-181-001`**, role
`reception`, context `external-walk`.

| Candidate key | Direction | Access point |
|---|---|---|
| `JP-181@AP-JP-181-001->JP-182` | JP-181 is origin | ASMUI reception |
| `JP-182->JP-181@AP-JP-181-001` | JP-181 is destination | ASMUI reception |

No trailhead is used and no `internal-hike` / `internal-shuttle` endpoint is invented.
Phase 3B2G investigated both and created neither: the operator documents that the hiking
start point and the shuttle stage exist ~20–30 minutes beyond reception, but publishes no
coordinate for either. The validator rejects an internal-only endpoint outright.

## 3. Requests a real run will make

| Request kind | Count | Notes |
|---|---|---|
| Snap | **1 batched request**, 4 locations | Only the 4 access-point coordinates. |
| Directions | **14** | One per candidate, paced at the documented 40/min. |

**Executed in this checkout: 0 Snap, 0 Directions, 0 of anything else.**

Place-coordinate endpoints (`JP-028`, `JP-030`, `JP-182`) are **never re-snapped**:
their measurements already exist and are `resolved` in
`data/logistics/walking-snap-places.json`, and re-querying them would spend quota to
learn nothing and risk drift against the historical results.

No Google Directions, no Mapbox, no geocoding, no other provider — openrouteservice
only, through the existing `scripts/ors_client.py` call path, with the same retry
policy, the same rate limiter and the same `foot-walking` profile.

## 4. Results per edge

Not available: the batch has not run. When it does, every candidate is written to
`data/logistics/walking-access-point-results.json` carrying `fromId`, `toId`,
`fromEndpoint`, `toEndpoint`, `accessPointIds`, the exact `[lng, lat]` query
coordinates, `provider`, `profile`, `status`, `distance`, `minutes`,
`durationSecondsRaw`, `endpointSnapping`, `attribution`, its `lineage`, and its
`comparison`.

## 5. Historical comparison

Each candidate carries a `comparison` block that is a **re-derivable pure function** of
its `lineage` and its own result (`build_comparison`) — the validator recomputes it and
rejects a hand-edited one. It records:

- `historicalStatus` / `newStatus`;
- `historicalDistanceMeters` / `newDistanceMeters`, `distanceDeltaMeters`, `distanceDeltaPercent`;
- `historicalMinutes` / `newMinutes`, `durationDeltaMinutes`, `durationDeltaPercent`,
  and `durationDeltaSeconds` from the raw provider durations;
- both endpoint identities on both sides;
- both snap assessments and both endpoints' snap displacement.

Numeric deltas appear **only** when both sides are `validated`; `comparable: false`
plus a `reason` is recorded otherwise. A percentage against a zero historical value is
`null`, never a fabricated number. A `no-route` or `request-error` never produces a
delta against a value it does not have.

The historical artifacts are read for lineage and never written. Two independent
validator guards enforce that (see §7).

## 6. No-route / errors

None observed — nothing was queried. A `no-route` is a terminal provider answer and is
recorded as such, carrying no `distance`/`minutes`/`confidence`; a `request-error` is
**not** terminal and is retried on the next `--execute`. A gate that turns out to be
unroutable is a real finding about that gate, never a reason to substitute another one.

## 7. Validation

`scripts/validate-walking-access-point-results.py` (offline, no network, writes
nothing) rejects:

| Failure | Check |
|---|---|
| Non-existent access point | orphan `accessPointId` against the catalog |
| Endpoint `placeId` mismatch | endpoint vs. its access point, and vs. the edge |
| Invalid endpoint context | not `external-walk`, or `deprecated` |
| Internal endpoint used externally | `internal-hike` / `internal-shuttle`-only point rejected |
| Duplicate directed candidate key | in the manifest and in the results |
| Missing lineage | required fields, and origin/artifact agreement |
| Malformed coordinates | shape, numeric type (a JSON `true` is not a number), lat/lng range |
| Coordinates not the endpoint's own | query bytes must equal the endpoint identity's coordinate |
| Unknown place | every `placeId` against `places.json` |
| Edge outside the target set | neither end is a revalidation target |
| JP-029 candidate outside its 3 approved gates | used vs. eligible points |
| **A pre-selected gate** | a target edge missing any eligible point's candidate |
| Non-target endpoint promoted | must stay `place-coordinate` |
| Historical mutation | recorded sha256 of both historical results files, **and** those files carrying any access-point annotation |
| Manifest drift | results generated from a different manifest digest |
| Source/app parity | checked *if* an app copy exists; an app copy without a source is an error |

`scripts/test_walking_access_points.py` — **70 offline tests** — covers the target-set
derivation, the candidate expansion, endpoint resolution, the comparison arithmetic, the
snap-store discipline, every failure mode above against a synthetic full results
document, the no-runtime-integration guarantees, and the CLI's refusal to run without a
key.

## 8. Conservative interpretation

Read narrowly, and only once the batch has actually run:

- A candidate's numbers describe **the route to that specific gate**, not "the route to
  JP-029". Three gates give three legitimately different answers; that is the finding,
  not a defect to average away.
- A shorter or longer routed distance is **not** evidence that the historical result was
  wrong. The historical answer is a correct answer to the question it was asked (route
  between the two display coordinates). This phase asks a different question.
- A `clean` snapping verdict on either side means the routed value is comparable to the
  coordinate that was sent — nothing more. It is not a statement about which endpoint is
  the right one for a traveller.
- The right gate is **origin-dependent**. Nothing here can be generalised into a single
  default for `JP-029`, and this phase deliberately stores none.
- `JP-181`'s reception point is the external arrival stage only. A route to it does not
  describe reaching the hike itself, which is a further ~20–30 minutes by an internal
  shuttle with no published coordinate.

## 9. Limits of this phase

Phase 3B2H does **not**:

- integrate access points into `getBestTransfer()` or change `app/src/lib/transfer.ts`
  in any way, or change precedence/fallback, or make the app read the new artifact;
- modify `walking-pilot-results.json`, `walking-scale-results.json`,
  `walking-snap-places.json`, or either walking manifest;
- regenerate the 332 walking relations, or query any edge outside the 6-edge target set;
- change any threshold, snapping classification, retry policy or provider parameter
  (`SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS` is still `None`, and no new threshold
  was introduced);
- modify `places.json`, `nearby.json`, `Place.coordinates`, the workbook, the GeoJSON,
  or the access-point catalog and its evidence;
- promote any candidate to a persistent default;
- do route chaining, shortest-path planning, itineraries, transit, UI, or any Phase 3C
  work.

## 10. Artifacts and commands

| Path | Role |
|---|---|
| `data/logistics/walking-access-point-manifest.json` | Derived target set + candidate expansion + lineage. **Committed.** |
| `data/logistics/walking-access-point-results.json` | Candidate results + comparisons. **Written by `--execute` only; absent here.** |
| `data/logistics/walking-access-point-snap.json` | Snap store keyed by `accessPointId`. Separate from the place store, whose entries are validated against a *place's* dataset coordinate. **Written by `--backfill-snap` only; absent here.** |
| `scripts/revalidate-walking-access-points.py` | The pipeline. |
| `scripts/validate-walking-access-point-results.py` | The validator. |
| `scripts/test_walking_access_points.py` | 70 offline tests. |

None of these is mirrored under `app/src/data/`: the app does not consume them, and an
unread copy would be dead weight the parity check would then have to defend.

```
python3 scripts/revalidate-walking-access-points.py --build-manifest   # offline, deterministic
python3 scripts/revalidate-walking-access-points.py --dry-run          # offline report
ORS_API_KEY=<key> python3 scripts/revalidate-walking-access-points.py --backfill-snap
ORS_API_KEY=<key> python3 scripts/revalidate-walking-access-points.py --execute
python3 scripts/revalidate-walking-access-points.py --recompare        # offline, no re-query
python3 scripts/validate-walking-access-point-results.py data
```

`--execute` refuses to start while any endpoint's snap coverage is missing, stale or
errored, checkpoints after every candidate, skips cached terminal candidates, retries
`request-error` ones, and stops immediately on an HTTP 401/403 rather than repeating a
global auth failure fourteen times.

## Attribution

Routing by openrouteservice (https://openrouteservice.org) / HeiGIT. Map data ©
OpenStreetMap contributors, ODbL. See
[`LOGISTICS.md`](LOGISTICS.md#attribution) for the full terms this project carries.
