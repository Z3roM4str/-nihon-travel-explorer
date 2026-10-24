# Phase 3B2H — Targeted Access-Point Walking Revalidation

Phase 3B2H is [`ACCESS_POINT_DESIGN.md`](ACCESS_POINT_DESIGN.md) §19 **Stage 4**: reroute
only the walking edges the Phase 3B2G access points actually affect, and compare the
answers against — never over — the historical place-coordinate results.

It is **generation + evidence + comparison only**. It does not integrate access points
into `getBestTransfer()`, does not change any threshold, and does not regenerate the 332
walking relations.

## Status in this checkout

**Executed and validated.** The batch ran against openrouteservice on 2026-09-05:
**1 batched Snap request** (the 4 access-point coordinates) and **14 Directions requests**
(one per candidate). **14/14 validated, 0 `no-route`, 0 `request-error`**, every candidate
`clean`. No request was made outside the target set, and no other provider was contacted.

`data/logistics/walking-access-point-results.json` and
`data/logistics/walking-access-point-snap.json` are committed. Phase 3B2H is **complete**.

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

`JP-181` snaps 80.69 m for the same kind of reason. §5 reports what the executed routes
actually showed for both.

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

## 3. Requests actually made

| Request kind | Count | Notes |
|---|---|---|
| Snap | **1 batched request**, 4 locations | Only the 4 access-point coordinates. |
| Directions | **14** | One per candidate, `geometry: false`, paced at the documented 40/min. |

**15 outbound HTTP requests in total**, all to `api.heigit.org` — the
`/v2/snap/foot-walking/json` and `/v2/directions/foot-walking/json` endpoints and nothing
else. Every coordinate sent was one of the 7 approved endpoints (4 access points + the 3
place-coordinate counterparts); an audit of the outbound calls confirms **zero coordinates
outside that set** and 14 distinct directed pairs. No Google Directions, no Mapbox, no
geocoding, no other provider.

Place-coordinate endpoints (`JP-028`, `JP-030`, `JP-182`) were **not** re-snapped: their
measurements already existed as `resolved` in `data/logistics/walking-snap-places.json`, which
is byte-identical after this phase.

### Access-point snap measurements

| Access point | Label | Snapped distance | Status |
|---|---|---|---|
| `AP-JP-029-001` | Ōte-mon Gate | **4.58 m** | resolved |
| `AP-JP-029-002` | Hirakawa-mon Gate | **6.20 m** | resolved |
| `AP-JP-029-003` | Kitahanebashi-mon Gate | **0.66 m** | resolved |
| `AP-JP-181-001` | ASMUI reception | **6.37 m** | resolved |

## 4. Results per edge

All 14 candidates returned `validated`. Δ is against that edge's historical
place-coordinate result. Both directions of every edge returned identical distances, as
they did historically.

### JP-029 ↔ JP-028 — historical 1565.2 m / 19 min (snap 2.72 / **198.63**, clean)

| Gate | Snap | Routed | Min | Δ distance | Δ % | Δ min |
|---|---|---|---|---|---|---|
| Ōte-mon | 4.58 m | 1360.5 m | 16 | −204.7 m | −13.08 % | −3 |
| **Hirakawa-mon** | 6.20 m | **779.2 m** | **9** | **−786.0 m** | **−50.22 %** | **−10** |
| Kitahanebashi-mon | 0.66 m | 1203.5 m | 14 | −361.7 m | −23.11 % | −5 |

Spread across gates: **581.3 m**. Identical in both directions (`JP-028 -> JP-029` and
`JP-029 -> JP-028`).

### JP-029 ↔ JP-030 — historical 1816.5 m / 22 min (snap **198.63** / 0.82, clean)

| Gate | Snap | Routed | Min | Δ distance | Δ % | Δ min |
|---|---|---|---|---|---|---|
| **Ōte-mon** | 4.58 m | **1083.3 m** | **13** | **−733.2 m** | **−40.36 %** | **−9** |
| Hirakawa-mon | 6.20 m | 1747.5 m | 21 | −69.0 m | −3.80 % | −1 |
| Kitahanebashi-mon | 0.66 m | 1942.4 m | 23 | +125.9 m | +6.93 % | +1 |

Spread across gates: **859.1 m**. Identical in both directions.

### JP-181 ↔ JP-182 — historical 211.4 m / 3 min (snap 80.69 / 13.74, clean)

| Access point | Snap | Routed | Min | Δ distance | Δ % | Δ min |
|---|---|---|---|---|---|---|
| ASMUI reception | 6.37 m | **2963.3 m** | **36** | **+2751.9 m** | **+1301.75 %** | **+33** |

Identical in both directions.

## 5. What the results mean

### The 198.63 m is explained, and the gates correct it

`JP-029`'s display coordinate sits inside the palace grounds, with no routable path within
~200 m. openrouteservice silently displaced it **198.63 m** to reach the network, and every
historical answer for these four edges was therefore measured from an arbitrary point on some
nearby road — not from any entrance a visitor can actually use.

The three gates snap **0.66–6.20 m**. That is not a coincidence and not tuning: a gate *is*
the point where the grounds meet the street, so it lies on the walking network by
construction. Worst-case endpoint displacement for this place drops from 198.63 m to 6.20 m,
a **96.9 % reduction**; the best gate is within 0.66 m.

So: **yes — using the real gates both explains and corrects the behaviour.** The 198.63 m was
the router compensating for a coordinate that is not reachable on foot, and catalogued access
points remove the need for that compensation entirely.

Two things this finding is *not*:

- **It is not evidence that the snapping threshold is wrong.** Every historical result was
  classified `clean`, and that classification was correct *as the rule is written*: combined
  displacement stayed well under half of a 1.5–1.8 km route. `clean` answers "is this routed
  value comparable to the coordinates we sent?" — never "were those the right coordinates?".
  No threshold could have answered the second question; access points are the mechanism that
  does. `SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS` therefore stays `None`, and this
  phase changed nothing about the classification rules.
- **It is not proof the historical numbers were simply "too short".** Five of the six gate
  routes came out *shorter* than the historical answer (by up to 786 m), and one came out
  longer. The snap point happens to sit further from most of these origins than the gates do.
  The defect is not a consistent bias but that the historical value describes a walk between
  an arbitrary snap point and the other place — a walk no traveller takes.

### The best gate flips with the counterpart — so no default

| Edge | Best gate | Routed | vs. historical |
|---|---|---|---|
| `JP-028` ↔ `JP-029` (Jimbocho, north-west) | **Hirakawa-mon** | 779.2 m | −50.22 % |
| `JP-030` ↔ `JP-029` (Tokyo Station, south-east) | **Ōte-mon** | 1083.3 m | −40.36 % |

The winner changes with the other end of the trip, and the spread between best and worst gate
reaches **859.1 m** — roughly half the historical distance for the same edge. This is the
first *empirical* confirmation of what `ACCESS_POINT_DESIGN.md` §12 and §20 predicted on
evidential grounds alone: the correct gate is origin-dependent, so no single static default
can be right for `JP-029`.

**No default was created.** `selection.defaultForContexts` remains empty on all three gates.
The current specification does not authorise one — §16 requires an explicit `ambiguous`
outcome for a multi-candidate place with no default — and the measurements above now
positively support that rule rather than merely leaving it untested. The per-edge winners
above are recorded as evidence for a future resolver, not as configuration.

### JP-181: a finding about the dataset, not about the access point

Routing to the operator's actual reception costs **2963.3 m / 36 min**, against a historical
**211.4 m / 3 min**. The cause is geometric:

- `JP-181`'s display coordinate is **136.6 m** from `JP-182` (Cape Hedo);
- the evidenced ASMUI reception is **1286.4 m** away from that display coordinate, and
  **1422.8 m** from Cape Hedo in a straight line.

The historical edge was therefore measuring a ~200 m stroll between two coordinates that both
sit essentially *at* Cape Hedo — it never described reaching ASMUI at all. The new figure is
the one that describes the real external arrival. `JP-181`'s own snap displacement also drops
from 80.69 m to 6.37 m.

This points at `JP-181`'s `Place.coordinates` being imprecise for its venue. **This phase does
not touch `places.json`** — that is out of scope here and is flagged for a future phase to
assess against evidence, exactly as Phase 3B2G flagged coordinates it could not source.

Note also what the reception figure still does *not* cover: it is the external arrival stage
only. The hike itself begins a further ~20–30 minutes on by an internal shuttle with no
published coordinate, so no `internal-hike`/`internal-shuttle` endpoint exists to route to.

## 6. No-route / errors

**None.** All 14 candidates returned `validated`; there were zero `no-route` answers, zero
`request-error` failures, zero retries and zero rate-limit responses. Every candidate's
endpoint snapping classified `clean`, and every comparison is `comparable: true`.

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

`scripts/test_walking_access_points.py` — **71 offline tests** — covers the target-set
derivation, the candidate expansion, endpoint resolution, the comparison arithmetic, the
snap-store discipline, every failure mode above against a synthetic full results
document, the no-runtime-integration guarantees, and the CLI's refusal to run without a
key.

## 8. Conservative interpretation

Read narrowly:

- A candidate's numbers describe **the route to that specific gate**, not "the route to
  JP-029". Three gates give three legitimately different answers; that is the finding,
  not a defect to average away.
- A shorter or longer routed distance is **not** evidence that the historical result was
  wrong. The historical answer is a correct answer to the question it was asked (route
  between the two display coordinates). This phase asks a different question. That holds
  for `JP-181`'s +1301 % just as much as for `JP-029`'s −50 %.
- A `clean` snapping verdict on either side means the routed value is comparable to the
  coordinate that was sent — nothing more. It is not a statement about which endpoint is
  the right one for a traveller.
- The right gate is **origin-dependent** — now measured, not just argued: Hirakawa-mon wins
  from Jimbocho, Ōte-mon from Tokyo Station. Nothing here can be generalised into a single
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
| `data/logistics/walking-access-point-results.json` | 14 candidate results + comparisons. **Committed.** |
| `data/logistics/walking-access-point-snap.json` | Snap store keyed by `accessPointId`, 4 resolved entries. Separate from the place store, whose entries are validated against a *place's* dataset coordinate. **Committed.** |
| `scripts/revalidate-walking-access-points.py` | The pipeline. |
| `scripts/validate-walking-access-point-results.py` | The validator. |
| `scripts/test_walking_access_points.py` | 71 offline tests. |

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
