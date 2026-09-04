# Nihon Roadmap

## Foundation — complete

- [x] Confirm repository and source workbook.
- [x] Define product scope and first vertical slice.
- [x] Define application data contract.
- [x] Export normalized JSON from the workbook.
- [x] Add schema validation and data-quality report (`scripts/validate-dataset.py`).

## Tokyo Explorer — complete

- [x] Add map shell.
- [x] Render Tokyo markers from JSON.
- [x] Add category, grade, hidden-gem, tourism-level, and reservation filters.
- [x] Build responsive place-detail drawer.
- [x] Add saved places state.
- [x] Parse and display duration ranges.
- [x] Show activity-time totals for saved places, clearly separated from transport time.
- [x] Add nearby-place suggestions.

## Visual Discovery / Phase 1.5 — complete

- [x] Add image-slot/gallery component using source-aware assets.
- [x] Richer place card and free-text search.

## Phase 2A — data integrity + data-access foundation — complete

- [x] Correct the Okinawa/Kyushu region split, the Naoshima region, and the Tokyo
      Disneyland/DisneySea nearby relation at the source workbook, with CHANGELOG_V2
      traceability.
- [x] Version the workbook as the real source of truth (`data/source/`).
- [x] Replace the non-reproducible exporter with `scripts/export-dataset.py`.
- [x] Introduce the data-access layer (`app/src/data/store.ts`) and remove the Tokyo
      structural assumption from the app.

## Phase 2B — functional multi-hub navigation — complete

- [x] Hub selector driven by `getHubs()`, keyboard-accessible.
- [x] Active hub as application state; filters, list, and map re-derive per hub.
- [x] Saved places resolve globally and open correctly across hubs.
- [x] Nearby navigation and Back work across hubs.
- [x] Map bounds fit the active hub's places dynamically.

## Phase 2C — National Explorer — complete

- [x] National map of Japan, opened as the application's entry view.
- [x] Regions/prefectures as a browsable layer, with coverage derived from the real dataset.
- [x] Japan → region → prefecture → hub navigation, available from the map and from
      equivalent keyboard-accessible controls.
- [x] Real geographic polygons for the 47 prefectures, derived from the official MLIT
      国土数値情報 行政区域データ (N03, 2026) and documented in `docs/GEOGRAPHY.md`.
- [x] Integration with the multi-hub state already built in Phase 2B: entering a hub, saved
      places opened from the national view, and returning to Japan all reuse the same
      navigation primitives.
- [x] Reproducible geographic validation (`scripts/validate-geography.py`) and a
      reproducible build for the derived geometry (`scripts/build-geography.sh`).

Geography and hubs are kept distinct: places are placed on the national map by their real
prefecture, while the button offered for them opens the hub they belong to editorially.

## Phase 3A — Selection Intelligence — complete

- [x] Add duration/time filtering, by planning block rather than by raw minutes, matching on
      range overlap so a place is never hidden from a block its duration can reach.
- [x] Recommended planning-block summaries: per hub and per cluster, always separating
      quantified visit time from day-scale commitments and from places with no estimate.
- [x] Compare selected places by cluster and geography — grouping by hub, by physical
      prefecture and by hub + cluster, with factual concentration and spread readings.
- [x] Planning-block taxonomy derived from `duration` (`app/src/lib/planning-block.ts`) and a
      pure aggregation layer (`app/src/lib/selection.ts`), covered by unit tests.
- [x] Duration and cluster checks in `scripts/validate-dataset.py`, with secondary cluster
      metadata reported as warnings rather than treated as truth.

Selection Intelligence describes the selection; it does not order it. No day assignment, no
sequencing and no transport time is produced, and none of it is persisted — saved place ids
remain the only stored user state.

## Phase 3B1 — Logistics Data Foundation — complete

- [x] Establish a typed logistics domain layer (`app/src/lib/transfer.ts`) over the existing
      `nearby.json` relations: a closed `TransferConfidence`/`TransferMode`/`TransferRelation`
      vocabulary, structured (non-string) provenance, and a `minutes` range rather than a bare
      number — without a second copy of the 403 relations and without touching the dataset.
- [x] Label every current relation honestly: `confidence: "estimated"`, `verifiedAt: null`,
      and provenance identifying the haversine-distance-plus-speed-model method that produced
      it. None of the 403 relations is a routed or schedule-aware transfer, and none is
      promoted to look like one.
- [x] Directed, non-fabricating lookup (`lookupTransfer`) and purely factual coverage/distance
      metrics (`computeLogisticsMetrics`) over a set of places — with no cluster
      compact/extended classification, since Phase 3B's audit never fully specified a
      threshold for one.
- [x] Extend `scripts/validate-dataset.py` with nearby-relation shape checks (resolvable ids,
      no self edge, positive distance/minutes, known `Modo`/`Relación` vocabulary, "Mismo
      cluster" implying matching hub + cluster, and reverse-direction divergence as a
      warning) without hardcoding the relation count as an invariant.
- [x] Document the confidence/provenance contract, the 2026 dataset audit's findings, and the
      3B2 boundary in `docs/LOGISTICS.md`.

This phase formalizes the existing estimates; it does not validate them. Every transfer time in
the application remains a geographic estimate until a later phase actually routes it.

## Phase 3B2A — Walking Validation Pilot — complete

- [x] Extend `TransferProvenance` into a discriminated union (`GeographicProvenance` |
      `RoutingProviderProvenance`) and add `getBestTransfer` (validated-static > estimated >
      null), without touching `toTransferEdge()` or any of the 403 `nearby.json` relations.
- [x] Deterministic, documented 24-edge pilot sample selection
      (`scripts/select-walking-pilot.py`) over the current 332 "A pie" relations.
- [x] Offline-safe pipeline (`scripts/validate-walking-pilot.py --dry-run`/`--execute`,
      `scripts/report-walking-pilot.py`, `scripts/validate-logistics.py`) against
      **api.heigit.org** (not the deprecated api.openrouteservice.org), with a coordinate-order
      regression test, reproducible caching, and a bounded single retry — fully covered by
      network-free unit tests (`scripts/test_walking_pilot.py`).
- [x] **Live pilot execution** — run 2026-09-04: 24/24 edges validated, 0 Directions failures.
      Results in `data/logistics/walking-pilot-results.json`.
- [x] Pilot report (`docs/WALKING_PILOT.md`) with real statistics, top outliers, limitations,
      and a decision-gate recommendation.
- [x] **Corrective review (first pass)**: identified that 2 of the 24 results (JP-063↔JP-065) had
      significant endpoint snapping making their distance not comparable to the original
      coordinates. Fixed the manifest's reproducibility (a dataset content hash, not the git HEAD
      SHA — see `docs/LOGISTICS.md`), the validator's coverage check (exact manifest↔results
      equality), and added an `endpointSnapping`/`snap_warning` guard plus a `--diagnose-snap`
      backfill tool. Recommendation revised from SCALE-with-caveat to ADJUST.
- [x] **Corrective review (second pass)**: replaced the boolean `snap_warning` (which silently
      coerced a null/unmeasured snap distance into `0` meters) with a three-state
      `classify_endpoint_snapping` (`"clean" | "significant" | "unknown"`); made `getBestTransfer`
      only promote to `validated-static` when `endpointSnapping.assessment === "clean"` (an
      absent or unmeasured/significant assessment now correctly falls back to `estimated`); and
      backfilled `endpointSnapping` for all 24 manifest edges via one batched Snap request
      (22 `"clean"`, 2 `"significant"` — the same JP-063↔JP-065 pair — 0 `"unknown"`).
      Recommendation revised from ADJUST to **SCALE** (see `docs/WALKING_PILOT.md`).

This phase validated exactly 24 of the 332 "A pie" relations. It does not validate the
remaining ~308, transit, or anything else. The pilot's own sample is now fully snap-screened;
a future scale-up phase carries forward the snap-clean gate as a hard requirement (see
`docs/WALKING_PILOT.md`'s decision gate) rather than re-deriving it from scratch.

## Phase 3B2B-A — Walking Scale-Up Engineering & Snap Threshold Analysis — preparation only

- [x] Deterministic scale-up manifest (`scripts/select-walking-scale.py` →
      `data/logistics/walking-scale-manifest.json`): every "A pie" edge not in the pilot's 24,
      derived from the live dataset (never hardcoded) — 308 edges over the current dataset.
      Verified: pilot ∪ scale == every current "A pie" relation, zero overlap.
- [x] Per-place Snap store (`data/logistics/walking-snap-places.json`, keyed by `placeId`,
      never by edge): a null measurement is `"unknown"`, never coerced into a `0`-meter
      `"resolved"` entry. Seeded offline from Phase 3B2A's already-measured 35 places
      (`scripts/seed-walking-snap-store.py`) — zero new network requests; 34 of the scale
      manifest's 137 unique places are already resolved this way.
- [x] Pipeline split into independent, restart-safe steps (`scripts/validate-walking-scale.py`):
      Snap backfill, Directions execution, and snap/distance recombination are separate modes
      that can each resume after an interruption without re-doing already-completed work.
      Shared network/result-shape code (`scripts/ors_client.py`,
      `scripts/walking_result_builder.py`) extracted so both the pilot and scale-up pipelines
      use the exact same logic — Phase 3B2A's own pipeline behavior is unchanged (its 63-test
      suite passes unmodified).
- [x] **Corrective review**: three blocking gaps closed before any real batch could run.
      (1) A real sliding-window Directions rate limiter (`ors_client.RateLimiter`) applied to
      every HTTP attempt including retries, with injectable clock/sleep so pacing is tested
      under a fake clock — pacing is proactive, never HTTP-429-driven. (2) True checkpointing:
      the results artifact is rewritten after every completed edge, so an interruption costs at
      most the in-flight edge, and the app-facing copy is published only once the batch covers
      the whole manifest (never a partial dataset). (3) A machine-readable three-state Snap
      status (`resolved` / `no-snap` / `request-error`, never parsed from text) plus a
      Directions preflight that refuses to start a bulk run while any place is
      missing/stale/request-error, and requires an explicit `--allow-unknown-snap` to proceed
      over `no-snap` places. Snap gained the same bounded transient retry, with no invented
      per-minute/day ceiling for an endpoint openrouteservice does not document one for.
- [x] Snap-threshold audit against Phase 3B2A's real 24-edge sample (see
      `docs/WALKING_SCALE_PREP.md`): found one "clean" edge (JP-184→JP-185) with a 139.31 m
      single-endpoint snap that the combined/ratio rule doesn't catch. N=24 is not enough to
      responsibly calibrate a second per-endpoint threshold, so none was set — instead
      `classify_endpoint_snapping()` gained an explicit, disabled-by-default, auditable seam
      (`SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS = None`) for a future phase to set once
      justified. No Phase 3B2A result was reclassified.
- [x] Offline dry-run (`--dry-run`, no network): reports the derived edge/place counts, hub and
      distance distributions, and a Directions/Snap request plan checked against
      openrouteservice's documented community-plan quota (2,000/day, 40/minute Directions;
      5,000 locations/request Snap) — see `docs/WALKING_SCALE_PREP.md` for the full real
      output and sources.

**Phase 3B2B-A did not execute the scale-up batch.** No Directions request was made against
any of the 308 scale edges during preparation, and `data/logistics/walking-scale-results.json`
did not exist at the end of that phase.
`--backfill-snap-places` was exercised only against mocks, never for real, for the 103
still-unresolved places. See `docs/WALKING_SCALE_PREP.md` for what remains before a future
phase could actually run the batch. The subsequent real execution is recorded below.

## Phase 3B2B-B — Walking Scale-Up Execution — complete

- [x] Verify exact preparation base `f4be15901e50cc1a93006783d4cea47e805f882b`,
      dataset/pilot-manifest hashes, reproducible scale manifest, and the 332 = 24 + 308
      walking partition with zero overlap. Restore exact LF checkout bytes locally
      after an authorized pause for Windows CRLF conversion; no dataset/hash changes.
- [x] Real Snap backfill on 2026-09-04: 1 request resolved 103 pending places;
      all 137 scale-required places resolved, no no-snap/error/stale/missing entries.
- [x] Execute all 308 scale edges against `api.heigit.org`, `foot-walking`:
      **303 validated, 5 no-route, 0 request-error/missing**. 312 Directions requests
      total, including 3 bounded retries and one later re-query of a failed edge.
      Stop after persistent HTTP 429 at 40/min; resume only after explicit authorization
      at 20/min (192 requests, no retries, 116 cached terminal results untouched).
- [x] Verify terminal completeness, recombine snapping offline (0 changes), and publish
      the byte-identical app-facing copy using the existing completeness gate.
      All 303 validated scale results are clean; significant/unknown are both zero.
- [x] Record statistics, all five no-route edges, outliers, limitations, and the larger
      Snap-distribution audit in [WALKING_SCALE_EXECUTION.md](WALKING_SCALE_EXECUTION.md).
      No absolute threshold proposed or applied without independent calibration evidence;
      the existing `None` setting and pilot classifications remain unchanged.
- [x] Pass final Python suites (63 + 125), app tests (104), lint, build, dataset,
      geography, and logistics validation. No pipeline, UI, or dataset content changes.

The app-facing artifact is prepared; application behavior still consumes the pilot
artifact only. This phase does not wire scale results into the UI or start Phase 3C.

## Phase 3B2B-C — Walking Scale Integration — complete

- [x] Merge the pilot's 24 and the scale-up's 308 walking results into one directed-key
      index (`buildValidatedWalkingIndex` in `app/src/lib/transfer.ts`), so
      `getBestTransfer` reads both artifacts — together, the current dataset's full 332
      "A pie" edges — through the same lookup and the same unchanged snap-clean gate.
      `toTransferEdge()`, `nearby.json`, and the snapping thresholds are untouched.
- [x] Preserve directed, non-fabricating, single-edge lookup semantics exactly:
      `getBestTransfer(fromId, toId)` still resolves only that exact direction, never
      infers the reverse, never chains edges, and never computes a shortest path or a
      summed time.
- [x] The scale-up's five `"no-route"` results fall back to the recorded `nearby.json`
      estimate — never `0` minutes, never a fabricated distance, never promoted to
      `validated-static` — exactly like a pair neither artifact covers.
- [x] Explicit, fail-loud protection against a duplicate directed key between the pilot
      and scale-up artifacts: `buildValidatedWalkingIndex` throws immediately, naming both
      the edge and both source artifacts, rather than silently letting one overwrite the
      other. Not triggered by this checkout's real data (verified disjoint in Phase
      3B2B-A) — a defensive guard against a future regression.
- [x] Ten new/extended `app/src/lib/transfer.test.ts` cases against real data and pure
      fixtures: a clean pilot edge and a clean scale edge each resolve to
      `validated-static`; a scale no-route edge, a scale-sourced significant/unknown/absent
      snapping result, and an uncovered relation all fall back to `estimated`; a direction
      with no relation returns `null`; the reverse direction is never used automatically;
      and a synthetic pilot/scale duplicate throws explicitly without overwriting.

No ORS request was made, no dataset file changed, no UI was touched, and Phase 3C
(route/day planning, sequencing, itineraries) was not started.

## Phase 3B2D — Walking Exceptions Audit — complete

- [x] Independently investigated, with official evidence, the five large per-endpoint
      Snap displacements (JP-029, JP-185, JP-064, JP-181, JP-069) and the five
      `no-route` results (all touching JP-090), fulfilling the "Later" item this phase
      replaces below. Full case-by-case sourcing and interpretation in
      [WALKING_EXCEPTIONS_AUDIT.md](WALKING_EXCEPTIONS_AUDIT.md).
- [x] Classified each large-displacement case against four hypotheses (visual/interior
      coordinate vs. routing access point; provider/graph connectivity; physically
      restricted access; insufficient evidence) using only official sources (Imperial
      Household Agency, each place's own official site, public tourism authorities) —
      never blogs, forums, or aggregators.
- [x] Determined the five JP-090-linked `no-route` results are best explained as a
      provider/graph connectivity anomaly, not real-world pedestrian inaccessibility —
      documented together as one cluster sharing JP-090, not as five independent cases.
- [x] Evaluated (not assumed) whether the evidence justifies setting
      `SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS`: **no** — the constant remains
      `None`, unchanged, because the cases are explained by place type, not by
      displacement magnitude, and one case (JP-064) could not be evaluated at all.
- [x] Recommended a future display-coordinate-vs-logistics-access-point model over any
      absolute threshold, and proposed (without starting) a small, reversible future
      phase to design an evidenced, provenance-tracked, multi-point-capable
      access-point override — see "Proposed next phase" in the audit document.

This phase made zero ORS requests, zero coordinate/dataset/threshold changes, zero UI
changes, and did not start the proposed next phase or Phase 3C.

## Later (unscheduled)

- [ ] Design (Phase 3B2E, proposed, not started) an access-point override model per
      [WALKING_EXCEPTIONS_AUDIT.md](WALKING_EXCEPTIONS_AUDIT.md)'s recommendation:
      layered on top of (never replacing) the existing display coordinate, evidenced
      and provenance-tracked per override, mode-specific where relevant, supporting
      more than one access point per place, auditable, applied only where evidence
      supports it (not auto-converting every POI), and never silently altering
      historical routing results.
- [ ] Evaluate versioned LF policy and response-header/error telemetry as separate
      reproducibility/observability debt; see `docs/WALKING_SCALE_EXECUTION.md`.
- [ ] Transit/schedule-aware validation pending a provider decision — see `docs/LOGISTICS.md`.
- [ ] Estimate logistical overhead from explicit, ordered sequences of places (never from an
      unordered selection — see "No aggregation without order" in `docs/LOGISTICS.md`).
- [ ] Compare candidate city sequences.
- [ ] Only then generate day-level itinerary candidates.
