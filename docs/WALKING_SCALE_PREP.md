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
- `snappedDistanceMeters` — a real number, or `null`. **Never coerced to `0`.**
- `status` — a **machine-readable** three-state outcome. Nothing branches on the
  human-readable `reason` string:
  - `"resolved"` — a real measurement came back. The only state that may be reused, and
    the only one that can ever feed a `"clean"` edge assessment.
  - `"no-snap"` — the provider answered, and there is no routable point within the radius.
    A definitive answer, not a failure: re-querying changes nothing, so a backfill run
    skips it by default (`--retry-no-snap` opts back in, e.g. after a radius change). It
    is **not** a successful measurement — an edge touching such a place is `"unknown"`.
  - `"request-error"` — the request itself failed (network, timeout, 5xx, 429, auth,
    malformed body). Says nothing about the coordinate, so it is a **re-query candidate by
    default** on the next backfill run.
- `radiusMeters`, `provider`, `profile`, `verifiedAt` — self-contained per entry, so each
  record is independently auditable.

`classify_snap_coverage()` is the single function that answers "what do we actually know
about this place?", returning one of five states: the three above plus `"missing"` (no
entry) and `"stale"` (measured against coordinates the dataset no longer has). Staleness
outranks status — an entry measured at a different point is stale whatever it claims.
Crucially, **a current entry is not automatically a resolved one**: a `"no-snap"` or
`"request-error"` entry can have perfectly current coordinates and still hold no
measurement at all.

`build_snap_place_entry()` refuses to build a contradictory record: `"resolved"` with a
null measurement, or a failed status carrying one, both raise rather than being written.

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
  still need a query (`places_needing_snap` — never a hardcoded count: missing, stale, or
  `"request-error"` by default), batches them into chunks of up to
  `ORS_SNAP_MAX_LOCATIONS_PER_REQUEST` (5,000 — openrouteservice's own documented
  per-request location cap), and **writes the store after every chunk**. An interruption
  mid-batch loses at most the one in-flight chunk; re-running only re-derives what's still
  outstanding, never re-fetching an already-resolved place. A transient failure gets one
  bounded retry (`query_ors_snap_with_retry`) before being recorded as `"request-error"`.
  Deliberately **not** rate-limited: openrouteservice documents Snap's per-request location
  cap but not a per-minute/per-day ceiling, and inventing one would be a made-up number
  dressed as a provider limit — batching is what keeps Snap traffic to a handful of calls.
  Never touches Directions or the results file.
- `--execute`: Directions-only, one query per pending scale edge, skipping a cached
  `"validated"` edge unless `--refresh` (identical caching discipline to the pilot's
  `--execute`). It does **not** make a Snap request itself — it combines the routed distance
  with whatever the Snap store already has for that edge's two places at read time
  (`combine_snapping_for_edge`, branching on the coverage state, never on `reason` text),
  producing the same `endpointSnapping` shape (`clean`/`significant`/`unknown`) the pilot
  already produces. If a place's Snap measurement isn't resolved, the edge gets `"unknown"`
  with an explicit reason — never a fabricated `"clean"`. Three properties make a real bulk
  run safe to start and safe to interrupt — see §3a, §3b, §3c below.
- `--recombine-snapping`: no network at all. Recomputes `endpointSnapping` for every
  currently-`"validated"` scale result from the Snap store's *current* contents. Useful
  after a later `--backfill-snap-places` run resolves places that were still `"unknown"`
  when `--execute` first ran for their edges — lets a result's snap assessment improve
  without ever re-querying Directions for it.
- `--dry-run`: no network — see §5.

### 3a. Real Directions rate limiting (not 429-driven)

`ors_client.RateLimiter` is a sliding-window limiter applied **per HTTP attempt, retries
included**. `query_ors()` acquires it immediately before opening the connection, and the
bounded retry goes back through `query_ors()` — so a retried edge costs two paced slots,
never two unpaced back-to-back calls.

Why proactive pacing rather than reacting to HTTP 429: a 429 means the request was
*already* refused — quota spent on a rejected call, and the provider under no obligation to
keep serving a client that keeps overshooting. Pacing means the documented ceiling is never
crossed in the first place, and the bounded retry stays what it is for (a genuinely
transient failure) instead of doubling as a pacing mechanism.

`clock` and `sleep` are injected, so the whole thing is tested with a fake clock and zero
real waiting (`FakeClock` in `scripts/test_walking_scale.py`): one test drives 200
acquisitions and asserts that **no 60-second window anywhere in the run contains more than
the configured number of attempts**. The rate comes from `--directions-per-minute`
(default: openrouteservice's documented 40/min); `0` disables pacing explicitly.

Phase 3B2A's pilot passes no limiter and is therefore unpaced exactly as before — 24 edges
sit far under any documented ceiling, and its 63-test suite passes unmodified.

### 3b. True checkpointing — and a terminal-vs-retryable result contract

`data/logistics/walking-scale-results.json` is rewritten **after every completed edge**
(`write_checkpoint`), so an interruption — crash, `^C`, quota cut-off — costs at most the
single in-flight edge.

A `WalkingPilotResult`'s `status` splits into two kinds, and a first pass at this pipeline
conflated them — resume logic only skipped `"validated"`, while completeness only checked
key coverage, so a `"request-error"` edge (one whose *request* failed — network, timeout,
5xx, 429, auth, malformed body — saying nothing about whether a route exists) could make
the batch look finished and get published. Fixed by defining the split once, in
`logistics_common.py`, and using it everywhere "done" is decided:

- **Terminal** (`TERMINAL_RESULT_STATUSES`): `"validated"` and `"no-route"`. Both are a
  real, final answer from the provider — re-querying either learns nothing new, so both
  are skipped on resume by default; only `--refresh` forces them to be asked again.
- **Retryable** (everything else — `"request-error"`, or no result at all): the request
  itself failed or was never made. Always a re-query candidate, `--refresh` or not.

`is_batch_complete(results, manifest_keys)` is the one function that answers "is this
batch done?": true only when every manifest edge has a *terminal* result — coverage alone
is not enough. `publish_app_copy()` and `validate-logistics.py`'s `check_scale_results_coverage()`
both call it, so the app copy and the validator's own "is this finished" opinion can never
drift apart. A `"request-error"` is still a **valid checkpoint entry** — atomic replacement
protects it from process interruption during the write, but does not claim immunity from
physical device loss. It never counts toward "finished," and
`check_scale_results_coverage()` reports it as an
explicit warning ("N result(s) are 'request-error' (not terminal)") even when coverage is
already 100%, distinct from "still pending" (coverage incomplete).

Verified end-to-end by `ScaleExecuteCheckpointTests` (crash partway through an all-success
run, confirm the app copy withheld and completed edges never re-queried) and
`ScaleExecuteMixedTerminalCrashResumeTests` (a batch with one `"validated"`, one
`"no-route"`, one `"request-error"`, and one never-reached edge: resume re-queries only the
`"request-error"` edge and the missing one, never touches the two terminal ones, and the
app copy stays withheld until the retried edge resolves to something terminal).

### 3c. Directions preflight

A bulk run is quota-bound, and Directions results for an edge whose places aren't snapped
can only ever come back `"unknown"` — un-promotable. So `--execute` runs `snap_preflight()`
first and **refuses to start** while any place is `missing`, `stale`, or `request-error`,
pointing at `--backfill-snap-places` as the fix.

`"no-snap"` is treated differently, because re-querying genuinely cannot fix it — the
provider has already answered. Proceeding anyway is a legitimate choice, but it must be an
explicit, recorded one: `--allow-unknown-snap`, which prints exactly how many places it is
proceeding over and that their edges stay un-promotable. It is never the silent default,
and it never unblocks a *fixable* state — missing/stale/request-error still stop the run
regardless of that flag.

### 3d. Fail-fast on a global authentication/authorization failure

An HTTP 401 or 403 means the credential itself is bad — every subsequent call with the same
`ORS_API_KEY` fails exactly the same way. Looping through the rest of a 308-edge (or
5,000-location Snap) batch after hitting one would just burn quota and time re-learning
nothing, hundreds of times over.

`RoutingRequestError` now carries this machine-readably: `http_status` (the raw HTTP code)
and `fatal` (`True` exactly when `http_status` is in `ors_client.FATAL_HTTP_STATUS_CODES =
{401, 403}`) are plain attributes, set once in `query_ors`/`query_ors_snap` — no caller
parses `str(exc)` to detect this. Both `--execute` and `--backfill-snap-places` check
`error.fatal` after every failed attempt: on a fatal error they checkpoint that
attempt's result as usual (a real, atomically replaced `"request-error"` entry — or Snap's
`"request-error"` place status), print that this is a global failure and not a per-edge
one, and stop the loop immediately with exit code `2` — never proceeding to the next edge
or chunk. Fixing the key and re-running resumes normally: the fatally-failed
entries are `"request-error"` (retryable), so they're exactly what gets re-queried.

Verified by `ScaleFatalAuthFailureTests`: 401 and 403 are `fatal` (429/5xx are not); a
5-edge `--execute` run stops after the second edge instead of grinding through all five;
a chunked `--backfill-snap-places` run stops after its first chunk instead of repeating the
same failure across the rest; and re-running after the key is fixed only re-queries the
edges/places that were left `"request-error"`.

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
  validated (terminal, cached): 0
  no-route (terminal, cached): 0
  request-error (retryable, not terminal): 0
  missing (never queried): 308
  would be queried by a default --execute run: 308 (request-error + missing)
  would ALSO be re-queried only with --refresh: 0 (validated + no-route)

Unique places referenced: 137
  Snap coverage (machine-readable states, never parsed from text):
    resolved: 34
    no-snap: 0
    request-error: 0
    missing: 103
    stale: 0
  would be (re-)queried by --backfill-snap-places: 103
  Directions preflight: BLOCKED by missing — --execute refuses to start until these are
  resolved (or, for 'no-snap' only, --allow-unknown-snap is passed explicitly).

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

- `scripts/test_walking_scale.py` (123 tests): scale-manifest derivation (pilot ∪ scale =
  every walking edge, zero overlap, zero duplicates, no non-walking relation ever admitted,
  edge count never hardcoded, deterministic across runs, pilot-manifest sanity checks); the
  Snap-place-store schema (three machine-readable states, null never coerced to `0`,
  contradictory records refused, staleness detection, an unrecognised status treated as
  unknown rather than guessed); the seeding migration (including its inconsistency check);
  the dry-run report (now split into validated/no-route/request-error/missing); **the rate
  limiter** (allows up to the limit without sleeping, sleeps exactly until the oldest event
  ages out, never exceeds the rate across a 200-attempt run under a fake clock, retries
  consume slots too, `query_ors` acquires before the HTTP call, default stays unpaced for the
  pilot); **Snap retry** (transient retried once, recovery, non-transient not retried);
  **the terminal/retryable status contract** (`is_batch_complete` true only when every edge
  is terminal, false on any `"request-error"` or missing edge, true for an all-`"no-route"`
  batch); **checkpoint + simulated crash + resume** with a mix of `"validated"`,
  `"no-route"`, and `"request-error"` edges (terminal ones never re-queried, the
  `"request-error"` one always is, the app copy stays withheld until it resolves); **fatal
  auth-failure fail-fast** (401/403 machine-readably `fatal`, 429/5xx are not, `--execute`
  stops after the failing edge instead of grinding through the rest, chunked
  `--backfill-snap-places` stops after its first chunk, both checkpoint safely and resume
  correctly once the key is fixed); **preflight** (blocks on missing/stale/request-error,
  blocks on no-snap until `--allow-unknown-snap`, which never unblocks a fixable state);
  Snap-state policy (request-error retried, resolved reused, stale re-queried, no-snap
  skipped by default and opt-in via `--retry-no-snap`, no-snap/request-error never becoming
  `"clean"`); `--recombine-snapping` including its no-partial-publish rule; the
  `validate-logistics.py` scale/snap-store checks (duplicate/overlap/coverage/non-walking-
  relation/secret-scan/retryable-vs-pending warnings); and five regression tests against the
  real committed `walking-scale-manifest.json` and `walking-snap-places.json`.
- `scripts/test_walking_pilot.py` (63 tests, unchanged in count and assertions): confirms
  the `ors_client`/`walking_result_builder` refactor and the rate-limiter/retry/fatal-error
  parameters didn't change the pilot pipeline's behavior.
- `app/src/lib/transfer.test.ts` (50 tests): unaffected by this fix — it is Python-only.

All of the following were run and pass:

```
python3 scripts/test_walking_pilot.py         # 63/63
python3 scripts/test_walking_scale.py         # 123/123
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
