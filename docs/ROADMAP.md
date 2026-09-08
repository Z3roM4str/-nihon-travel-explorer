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

## Phase 3B2E — Access-Point Override Design — complete

- [x] Define the separate, provenance-tracked, multi-access-point contract in
      [ACCESS_POINT_DESIGN.md](ACCESS_POINT_DESIGN.md), preserving the display coordinate on
      `Place` and separating access contexts from `TransferMode`.
- [x] Specify stable identity, explicit-coordinate ordering, default/ambiguity rules,
      historical-result compatibility, and a staged migration without changing runtime data.

Phase 3B2E decided the model only. It created no artifact, coordinates, routing behavior, ORS
requests, or UI.

## Phase 3B2F — Access-Point Data Foundation — complete

- [x] Add the empty authoritative `data/logistics/access-points.json` catalog and its
      parity-validated app-facing copy. The exact current catalog is `[]`: zero real coordinates.
- [x] Add logistics-specific TypeScript roles, contexts, confidence, provenance, and access-point
      types plus non-selecting ID/place/context read primitives.
- [x] Add a dedicated offline validator and synthetic fixture suite for identity, references,
      coordinates, provenance, vocabularies, defaults, duplicates, secrets, and app/source parity.
- [x] Document Stage 1 and preserve every existing product behavior and historical routing result.

Phase 3B2F is Stage 1 only. Access points are not connected to `getBestTransfer`; no routing
requests, routing-result regeneration, UI, or Phase 3C work occurred. The next proposed phase —
**Phase 3B2G — Evidenced Access-Point Population** — would research and add only officially
verifiable real coordinates with provenance, still without routing integration. It is not started.

## Phase 3B2G — Evidenced Access-Point Population — complete

- [x] Populate `data/logistics/access-points.json` (and its byte-identical app copy) for the
      first time with **4 real access points across 2 place IDs**: three officially designated
      East Gardens entrance/exit gates for **JP-029** (`AP-JP-029-001` Ōte-mon,
      `AP-JP-029-002` Hirakawa-mon, `AP-JP-029-003` Kitahanebashi-mon) and the external
      arrival/reception point for **JP-181** (`AP-JP-181-001`).
- [x] Create **no default for any point**: `selection.defaultForContexts` is empty on all four.
      Three official gates do not make one of them the answer; JP-029 is deliberately the
      multi-candidate, no-default case the design's selection rules describe.
- [x] Investigate and deliberately create **no record** for **JP-185** (the official Furuzamami
      bus stop exists in the village's own timetables, but no official source publishes its
      coordinate), for **JP-064** and **JP-069** (evidence still insufficient), and for **JP-090**
      (`no-route` is provider behaviour, not physical provenance). For JP-181, the trailhead and
      the internal shuttle stage were investigated and not created — no verifiable coordinate.
- [x] Record the complete research trail in [ACCESS_POINT_EVIDENCE.md](ACCESS_POINT_EVIDENCE.md):
      sources consulted per case, how each coordinate was obtained, candidate sources evaluated
      and rejected, ambiguities, and why each absent record is absent.
- [x] Extend the offline and app suites with real-catalog coverage without relaxing a single
      validation rule.

Access points are **not** used by routing. `getBestTransfer()`, `Place.coordinates`, the
workbook, `nearby.json`, the GeoJSON, and the historical walking pilot/scale results are all
unchanged, and there was no UI work, no Phase 3C work, and zero openrouteservice, Snap,
Directions, or automated-geocoding calls. The next proposed phase, **not started**, is
**Phase 3B2H — Targeted Access-Point Walking Revalidation**.

## Phase 3B2H — Targeted Access-Point Walking Revalidation — complete

- [x] Derive the target set programmatically from the committed walking manifests/results:
      **6 directed edges** (all from the scale artifact, none from the pilot) — the historical
      `A pie` relations with **JP-029** or **JP-181** at either end. Direction preserved; no
      edge invented and no edge outside the set ever queried.
- [x] Expand it into **14 routed candidates**: 12 for JP-029 (its four directed edges × all
      **three** approved gates, because it has no default and choosing by ID, array position or
      haversine is forbidden) and 2 for JP-181 (its single external reception point
      `AP-JP-181-001` — no trailhead, no invented `internal-hike`/`internal-shuttle` endpoint).
      The non-target end of every edge stays on its place coordinate.
- [x] Ship `scripts/revalidate-walking-access-points.py` (manifest / dry-run / snap-backfill /
      execute / recompare), the versioned manifest
      `data/logistics/walking-access-point-manifest.json` carrying each candidate's historical
      lineage, `scripts/validate-walking-access-point-results.py`, and
      `scripts/test_walking_access_points.py` (**71 offline tests**).
- [x] **Execute the batch** against openrouteservice: **1 batched Snap request** (4 access-point
      coordinates) + **14 Directions requests** = 15 outbound calls, none outside the target set
      and none to any other provider. **14/14 `validated`, 0 `no-route`, 0 `request-error`, all
      `clean`.** The three place-coordinate endpoints were not re-snapped.
- [x] Validate the artifacts and record the per-edge historical comparison in
      `data/logistics/walking-access-point-results.json`.

**Findings.** JP-029's display coordinate snaps **198.63 m** (it sits inside the palace grounds);
its three gates snap **0.66–6.20 m**, cutting worst-case displacement by **96.9 %** — real gates
explain and correct that behaviour. Routed distance moves −50.22 % to +6.93 % by gate, and the
best gate **flips with the counterpart** (Hirakawa-mon from Jimbocho, Ōte-mon from Tokyo Station;
spread up to 859.1 m), empirically confirming that no static default is correct — **none was
created**. JP-181 via its evidenced reception is 2963.3 m / 36 min vs a historical 211.4 m /
3 min, because its display coordinate sits 136.6 m from Cape Hedo but 1286.4 m from the actual
reception; that `places.json` precision question is **recorded, not acted on**, here.

`getBestTransfer()`, `app/src/lib/transfer.ts`, precedence/fallback, `Place.coordinates`, the
workbook, `nearby.json`, the GeoJSON, the access-point catalog and evidence, the historical
walking pilot/scale results, both walking manifests and the snap-places store are all
unchanged; no threshold moved (`SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS` is still
`None`); no candidate became a persistent default; nothing is mirrored under `app/src/data/`;
and there was no UI and no Phase 3C work. See
[ACCESS_POINT_WALKING_REVALIDATION.md](ACCESS_POINT_WALKING_REVALIDATION.md).

## Phase 3B2I — Walking Transfer UI Integration — complete

- [x] Closed the gap Phase 3B3C's design work identified: `PlaceDetail.tsx` rendered
      `nearby.json`'s raw `Distancia km`/`Min aprox.` directly, so none of the 325 snap-clean
      `validated-static` walking results (Phase 3B2A pilot + 3B2B-C scale-up) were ever shown to a
      user, even though `getBestTransfer()` already computed the better answer for every one of
      them. `PlaceDetail` now resolves each existing directed `nearby` relation through
      `getBestTransfer(place.id, target.id)` — same direction the relation already records, no
      reverse lookup — and renders whatever it returns.
- [x] New presentation-only module `app/src/lib/transfer-display.ts` (7 tests) maps a
      `TransferEdge` to display text without touching confidence, provenance, direction or
      fallback semantics, all of which stay owned by `getBestTransfer()`: `estimated` keeps its
      `~` approximation marker and the label **"Estimación geográfica"**; `validated-static` drops
      the `~` and labels a walked route **"Ruta a pie validada"** (a non-walk mode, not produced by
      any data today, labels as **"Ruta validada"** rather than hard-coding "a pie"); the
      unreachable-today `schedule-aware` case is still handled and labeled **"Horario en vivo"**,
      kept visually and lexically distinct from the static labels so a future live result could
      never be mistaken for one of them. A footnote below the list states plainly, in every case,
      that a validated route is static routing data and never a live timetable.
- [x] **Reviewed against the checked-out dataset rather than assumed**: the "325" figure was
      independently recomputed from `data/logistics/walking-pilot-results.json` +
      `walking-scale-results.json` (`status: "validated"` and `endpointSnapping.assessment:
      "clean"`) and confirmed exact; `nearby.json`'s 403 relations were confirmed to contain zero
      duplicate directed pairs, so no relation can silently share another's resolved transfer.
- [x] **Architecture decision, made against evidence rather than by default**: `PlaceDetail`
      imports `getBestTransfer()` directly rather than receiving it as an injected resolver prop
      from `App.tsx`. The one existing injected-resolver prop, `getPlace`, exists because `App.tsx`
      is the layer that reconciles which of several place collections a nearby target id lives in
      — a real single-source-of-truth concern. `getBestTransfer()` has no such ambiguity: one
      module, one precomputed lookup, exactly like the half-dozen other pure `lib`/`data` functions
      (`resolveDuration`, `alertSeverity`, `formatPrice`, …) `PlaceDetail` already imports directly.
      Injecting it as a prop would diverge from that dominant convention for no behavioral or
      testing benefit — this repository has no component-level test harness (no `jsdom`, no
      Testing Library) for a stubbed prop to serve.
- [x] **One real defect found and fixed in review**: the quality/confidence label reused the
      `.nearby-item__relation` CSS class already used for the unrelated relation-type text (e.g.
      "Cercano"), which would make the two impossible to restyle independently later and reads as
      if confidence were a kind of relation. Given its own class
      (`.nearby-item__quality`, with `--validated`/`--live` modifiers using the app's existing
      `--color-ok`/`--color-info` tokens) so a validated route is visually distinguishable from an
      estimate, not only distinguishable by reading its label text.
- [x] `getBestTransfer()`, `app/src/lib/transfer.ts`, the walking pilot/scale/access-point result
      artifacts, the Phase 3B3D transit skeleton and its activation gate, the dataset, the access
      point catalog, `scripts/`, `package.json` and the lockfile are all unchanged. No live
      provider request, no client transport, no React hook, no ordering/aggregation/itinerary
      (Phase 3C) work.

## Transit Access-Point Evidence Audit — complete (evidence only, activation still OFF)

Deliberately not numbered `3B3E`: that identifier stays reserved for the client transport / live
transit React hook. This is evidence work in the Phase 3B2G lineage, and it is what the former
"Access-point evidence for `external-local-transit`" backlog item asked for.

- [x] **Settled the semantics first, because the repository contradicted itself.**
      `ACCESS_POINT_DESIGN.md` §§9/13/18/20 and both consumers (`getAccessPointsForContext`,
      `resolveTransitEndpoint`, neither of which reads `role`) define `applicableContexts` as
      **endpoint eligibility**; Phase 3B2G's prose had withheld the context on the different
      reading that it marks a point as *being a transit stop*. Resolved in favour of the
      contract: `role` says what a point physically **is**, `applicableContexts` says which
      routing question it is a legitimate **endpoint** for. Recorded in
      [TRANSIT_ACCESS_POINT_EVIDENCE.md](TRANSIT_ACCESS_POINT_EVIDENCE.md) §1, with a pointer
      added to `ACCESS_POINT_EVIDENCE.md` rather than a rewrite of its history.
- [x] **Recomputed the candidate universe from the checkout** (never carried over): 403 relations,
      332 walking, 71 non-walking, 69 `Transporte local`, 2 `Disney Resort Line`, **78 unique
      places** (Kioto 27, Tokio 21, Okinawa 20, Osaka 10).
- [x] **Triaged on a measured, repo-internal signal** — each place's worst recorded
      `endpointSnapping` displacement, i.e. how far its display coordinate sits from a routable
      way. Most useful negative result of the audit: the two worst coordinates in the dataset
      (**JP-029 198.63 m**, **JP-185 139.31 m**) are the two cases the project had already
      identified, and **no third case emerges from the measurements**.
- [x] **One change, and only one: JP-029's three gates gained `external-local-transit`** — the
      context goes from **0 to 3 members**. The Imperial Household Agency documents each gate as
      the arrival point of a named subway approach (Otemachi C13a ≈5 min, Nijubashimae ≈10 min and
      JR Tokyo ≈15 min for Ōte-mon; Takebashi 1a ≈5 min for the other two), and JP-029 has a real
      `Transporte local` relation. **No default** — Phase 3B2H measured the best gate flipping
      with the counterpart — so the resolver now answers `ambiguous` instead of querying a point
      inside the palace grounds.
- [x] **Everything else: no record, deliberately.** `JP-181` upheld as `external-walk` only (its
      documented access is by car and it has zero non-walking relations); `JP-185` re-checked —
      the village bus page still names the 古座間味ビーチ stop but publishes no coordinate;
      **Disney** (JP-203/JP-204) rejected on two independent grounds — illustrated maps are not a
      coordinate source, and `TransferMode` separates `disney-resort-line` from `local-transit`
      while `AccessContext` has no matching member, so tagging it would be schema expansion by
      anticipation; ferry ports (JP-184/JP-186/JP-197) real as a concept but no published
      coordinate; `JP-064`/`JP-069`/`JP-089` unchanged under the existing rulings that a large
      snap and a `no-route` are not provenance.
- [x] **No coordinate was invented, no default created, no new record added**, and 45 of the 78
      candidates carry no empirical red flag at all — `use-place-coordinate` is their correct,
      deliberate answer. A nearby station was never treated as a reason to catalogue a point.
- [x] Added the missing regression coverage for the behaviour that actually changed (172 tests,
      from 169), mutation-checked; the validator needed no change and its parity check was
      verified to fire on induced drift.

**Provider activation remains OFF** and still `REQUIRES VENDOR CONFIRMATION` (Phase 3B3B §7.2).
This audit made **zero requests to Ekispert, NAVITIME or openrouteservice and zero geocoding/routing
API calls of any kind** — its sources are official web pages read directly — and created zero
accounts, keys and secrets. It changed no `places.json`, `nearby.json`, workbook, walking
pilot/scale artifact, walking access-point result, threshold or `getBestTransfer()`; built no UI,
no hook and no client; and started no Phase 3C work.

## Phase 3B3A — Transit & Schedule-Aware Logistics Provider Decision / Coverage Audit — research complete, BLOCKED

- [x] Derive the non-walking gap programmatically from the current dataset (never carried
      forward from a prior phase's report): of 403 directed `nearby.json` relations, **332 are
      walking** (325 already `validated-static`, 7 still `estimated` — the already-investigated
      `JP-063↔JP-065` pair and the `JP-090` `no-route` cluster, both Phase 3B2D's closed
      findings, not this phase's problem) and **71 are non-walking** (`Transporte local` 69,
      `Disney Resort Line` 2) — **100 % of the non-walking relations are still pure
      haversine-distance estimates**, untouched by any validation work to date. All 403
      relations, with no exception, are intra-hub; the dataset has **zero** inter-hub relations
      (no Tokyo↔Kyoto, no mainland↔Okinawa) — inter-city transport is not a gap in today's data,
      it is an unmodeled relation category.
- [x] Define provider requirements from that gap plus the hub set (urban rail/JR/metro/bus
      confirmed necessary; Shinkansen/ferry/flight are forward-looking, not required by today's
      403 relations; national coverage including Okinawa, since Okinawa carries 23 of the 71
      non-walking relations — 32 %).
- [x] Evaluate Google Routes (re-confirmed live: still a 100-day transit horizon, still a
      caching/storage-restrictive policy — excluded, same conclusion as Phase 3B1's original
      research), HERE Public Transit (Japan routing access is sales-gated, not self-serve —
      excluded), NAVITIME API (capable, but its realistic paid tier is disproportionate for a
      personal project and its caching terms were not reviewed), Ekispert API (best cost fit —
      a real non-subscription pay-as-you-go tier — and the broadest Japan-specific mode
      coverage, but its terms-of-use PDF governing response caching/storage was not opened this
      session, and Okinawa/Yui-Rail coverage was not confirmed), and open-data alternatives
      (ODPT, GTFS aggregators — open licensing, but neither is a routing engine; adopting either
      means building a trip planner ourselves).
- [x] Specify the `static-validated`/`schedule-aware` boundary a future artifact must respect: a
      schedule-aware result is bound to a specific service date and must never be treated as
      evergreen just because the route exists.
- [x] Specify (without implementing) how a future transit layer resolves an endpoint through the
      existing access-point model via the already-reserved, still-unused `"external-local-transit"`
      context — no access point changed, no default created, `JP-181` not touched.
- [x] Full research, requirements, comparative matrix, provenance strategy, and decision
      rationale in [TRANSIT_PROVIDER_DECISION.md](TRANSIT_PROVIDER_DECISION.md).

**Decision: BLOCKED.** Not for lack of a plausible candidate — Ekispert is a credible primary
and NAVITIME a credible secondary — but because choosing either now would decide an
architecture-defining question (can a response be cached/versioned as static repository data,
the way every other artifact in `data/logistics/` is, or must it be queried live) without having
read the one document that actually answers it: each candidate's terms of use. Google's case is
the cautionary example: its documented policy is caching-hostile and would force a different
architecture than this project has used since Phase 3B2A. Proceeding on an unread assumption
would repeat that mistake. A named next phase (proposed, not started) reads those terms and
confirms Okinawa/Kyoto/Osaka coverage before any PROCEED decision is made.

This phase made **zero requests to any transit provider and zero new ORS requests**; changed no
threshold, no access point, no `getBestTransfer()` behavior, no dataset file, and no UI; and did
not start ordered-sequence logistics, city-sequence comparison, day-level itinerary generation,
or any other Phase 3C work.

## Phase 3B3B — Provider Terms & Coverage Confirmation — complete, PROCEED WITH HYBRID DESIGN (provider activation pending)

- [x] Read the actual Ekispert Standard Plan terms of use (「駅すぱあと API スタンダードプラン」
      利用規約, latest revision **2025-12-15**, confirmed current), extracted directly from the
      official PDF with `pdftotext` and read article-by-article — not summarized from a
      secondary source. **Article 27** prohibits: using output data for AI development/feature
      expansion/training (§6); secondary use or resale of output data (§7, unqualified by data
      category); retaining/reusing railway-timetable-derived output — must be re-fetched every
      time (§8); and developing a competing service — explicitly naming route-search/transfer
      guide services, public-transport-data services, **AI models/analysis tools handling
      public-transport data**, and public-transport consulting — without Val Laboratory's prior
      written consent (§10).
- [x] Read NAVITIME's direct-contract and RapidAPI terms (Article 5 §§2/5/6) with somewhat less
      certainty (automated extraction, not manually verified line-by-line like the Ekispert
      PDF): a blanket "no caching except what the application form/contract authorizes,"
      **broader** than Ekispert's since it isn't limited to any data category and explicitly
      names output lat/lng as one example. No explicit AI clause found (a documentation gap,
      not a confirmed absence).
- [x] Confirmed, via two independent sources — Ekispert's own live demo and Okinawa Prefecture's
      official Ekispert-powered bus portal (`watta-bus.com`, fetched directly) — that Ekispert's
      engine **names by operator**: Yui Rail (ゆいレール), Naha Bus, Okinawa Bus, Ryukyu Bus
      Kotsu, and Toyo Bus. Kyoto/Osaka private rail remains only **PARTIAL** (general "nationwide
      private rail" claims, no operator-by-name confirmation). NAVITIME's Okinawa coverage is
      **NOT CONFIRMED for the API** (only its separate consumer map product was found to list
      Yui Rail — not the same fact as API/contract access).
- [x] Applied the terms to six concrete AI/storage scenarios (write integration code without
      real data; share real output with an AI coding assistant; train a model on output;
      live display-and-discard; commit output to this public GitHub repo; an AI tool consuming
      the data directly) and classified each PERMITTED / PROHIBITED / SUBJECT TO AUTHORIZATION /
      REQUIRES VENDOR CONFIRMATION for both providers — see
      `docs/TRANSIT_TERMS_COVERAGE_CONFIRMATION.md` §1.3/§2.1.
- [x] Confirmed **neither provider's terms permit this project's historical walking pattern**
      (committing real routing output as versioned JSON in `data/logistics/`) for a **public**
      repository — a structurally different rule than openrouteservice's attribution-based
      terms, not a variation of it.
- [x] Reconfirmed current pricing (Ekispert pay-as-you-go ¥5,500/5,000 requests unchanged;
      NAVITIME $200–300/month unchanged) with an explicitly-caveated, unverified illustrative
      MXN order of magnitude.
- [x] **Reconciled Article 27(9)/(10)** (competing-service restriction, incl. "AI models/analysis
      tools handling public-transport data") against Ekispert's own official MCP Server / "for
      AI" program (`docs.ekispert.com/v1/for-ai/mcp-server/`, its pricing page, and Val
      Laboratory's release announcement — all read directly this session) and its observed
      real-world licensing pattern (the Okinawa bus portal is itself a route-search/transfer-
      guide service built on the API, not treated as a violation). Distinguished three separate
      questions the original pass had conflated: using an LLM as a query interface to Ekispert
      (supported by Val Laboratory's own MCP Server, conditioned on configuring the AI agent
      opt-out of training); using output to train/extend a model (still flatly prohibited,
      Article 27(6), unaffected by MCP's existence); and building a standalone AI analysis/
      recommendation *product* around public-transport data (Article 27(10)③'s actual named
      target, gated on prior written consent).

**Decision — two parts, not one.** **7.1 Architecture: PROCEED WITH HYBRID DESIGN.**
Static/versioned: integration code, schema, synthetic fixtures, and this project's own derived
comparison statistics — never real provider output. Live, never persisted: any real Ekispert
route/station/timetable/fare result, queried at request time and discarded after rendering to
the requesting user. **Recommended provider: Ekispert** (best cost fit, confirmed Okinawa
coverage, most thoroughly read terms). **Secondary: NAVITIME** (same live-only shape, weaker
cost fit, unconfirmed Okinawa coverage). **7.2 Provider activation: REQUIRES VENDOR
CONFIRMATION.** A narrowly-scoped live-display feature (show the requesting user a real route,
nothing more) is *likely* within Ekispert's ordinary licensed use on the public evidence
gathered — but this project's own longer-term ambition (helping order places/cities, generating
planning recommendations from logistics data) risks Article 27(10)③'s gated
competing-service category, and this phase did not determine where Nihon's actual eventual
product lands on that spectrum, nor sought Val Laboratory's consent. **Actually connecting real
Ekispert queries to this application — for its full intended trajectory — is not yet cleared,
distinct from the architecture recommendation above being sound.** A specific vendor question is
drafted (not sent) in `docs/TRANSIT_TERMS_COVERAGE_CONFIRMATION.md` §7.3. Open, non-blocking
questions (private-only caching of non-timetable categories; Kyoto/Osaka private-rail
operator-level confirmation; the remaining 8 of NAVITIME's 9 prohibited-use examples) are
recorded, not resolved, in the same document's §7–8.

This phase made **zero authenticated requests to any transit provider, zero ORS requests, zero
accounts created, zero API keys introduced**; changed no code, no dataset, no access point, and
no UI; and did not start Phase 3B3C (proposed: live integration *design* against synthetic
fixtures only, still not implementation, and still not provider activation) or any Phase 3C
work.

## Phase 3B3C — Live Transit Integration Design — complete (design only, activation still OFF)

- [x] Design, against the **verified current system** rather than an assumed one, how a live
      schedule-aware transit layer could be added later. Four facts checked directly in this
      checkout shape every decision: **there is no backend at all** (static Vite/React SPA, four-line
      `vite.config.ts`, runtime deps only `leaflet`/`react`/`react-dom`/`react-leaflet`, no
      deployment platform chosen, zero runtime `fetch` — all data are build-time JSON imports);
      **`app/src/lib/transfer.ts` has no consumers** (imported only by its own test — the UI renders
      raw `nearby.json` via `store.getNearby()` in `PlaceDetail.tsx`, so the 325 `validated-static`
      walking results are not shown to any user today); the seams `"schedule-aware"`,
      `"external-local-transit"` and `TransferProvenance` exist but are empty; and a regression test
      already guards against unordered aggregation.
- [x] Establish why an Ekispert credential **cannot** live in the frontend — Vite inlines `VITE_*`
      into the shipped bundle, and Article 26 §1 deems every action taken with the key the
      contractor's own — and design the required flow: browser → **Nihon-controlled server
      boundary** (holds the key, validates, rate-limits, normalizes, discards the raw response) →
      provider → normalized ephemeral result → browser.
- [x] **Backend contract decided; hosting provider deferred** — deployment-neutral
      `POST /api/transit/route`, because the repository has chosen no deployment platform at all;
      serverless / edge / small API service compared as alternatives without picking one.
- [x] Close the design decisions: request contract (our own `RoutingEndpoint` ids, tagged
      depart/arrive union, explicit `serviceDate` + IANA zone); provider adapter with a closed
      outcome union and error **categories** (never provider text), with `synthetic` a first-class
      member; minimal normalized result (no fares, no station ids, no geometry); refined
      `TransitProviderProvenance` (mandatory `serviceDate`, literal `ephemeral: true`);
      access-point flow reusing `"external-local-transit"` and **never** silently collapsing
      JP-029-style ambiguity; fallbacks that never relabel an estimate as schedule-aware;
      non-persistence guardrails (no client storage, no artifacts, no server cache, no payload
      logs — operational metadata only); security boundary; cost control **without** caching
      prohibited output (explicit user action, cancellation, in-flight dedup only); and a
      synthetic-only testing strategy with obviously-fictional fixtures.
- [x] **Async strategy resolved with evidence:** `getBestTransfer()` stays **sync/static** — it
      reads two build-time JSON imports through a `Map` and does no I/O, so a `Promise` signature
      would be a false statement about it; a **separate async boundary** serves live transit, and
      arbitration between them belongs in a React hook that knows user intent, not in the data
      layer. Existing callers broken: none.
- [x] Full design in [LIVE_TRANSIT_INTEGRATION_DESIGN.md](LIVE_TRANSIT_INTEGRATION_DESIGN.md).

**Provider activation remains OFF** and still `REQUIRES VENDOR CONFIRMATION` (Phase 3B3B §7.2).
The architecture is deliberately buildable and testable end-to-end against the `synthetic`
provider while OFF, so no provider relationship is needed to make progress. This phase made
**zero requests to Ekispert, NAVITIME or openrouteservice, created zero accounts, introduced zero
API keys, and used zero real provider payloads**; changed no `app/src/`, `scripts/`, `data/`,
deployment config, `package.json` or lockfile; built no backend and no UI; and started no
Phase 3C work (no sequencing, no optimization, no itinerary generation).

## Phase 3B3D — Synthetic Transit Skeleton — complete (synthetic provider only, activation still OFF)

- [x] Implement the Phase 3B3C design in code against the **`synthetic` provider only**: a
      provider-neutral contract in `app/src/lib/transit.ts` (`RoutingEndpoint`, tagged
      `depart-after | arrive-by` request with explicit `serviceDate` + IANA zone,
      `NormalizedTransitResult`, closed `TransitLookupOutcome`, sanitized `ProviderErrorCategory`,
      `TransitProviderProvenance` with mandatory `serviceDate` and literal `ephemeral: true`), and
      a deployment-neutral route handler in `app/server/transit.ts` for the future
      `POST /api/transit/route`.
- [x] **Activation gate held OFF in code**: `REAL_TRANSIT_PROVIDER_ACTIVATION = "off"` as a
      literal, and an `ekispert`/`navitime` adapter is rejected **before** its lookup function can
      run — asserted by test. No account, key, secret, SDK, request or captured payload exists on
      this branch, for Ekispert, NAVITIME or openrouteservice.
- [x] **Runtime request validation fails closed**: unknown or provider-specific fields are
      rejected, instants require an explicit UTC offset, service dates must be real calendar days,
      time zones must resolve, and identifiers and the correlation id are length-bounded and
      character-restricted (an unsafe correlation id is never echoed back).
- [x] **Server-only code moved out of the browser type graph.** `app/src/server/` fell under
      `tsconfig.app.json`'s `include: ["src"]`, which compiles with `DOM`, so browser globals
      type-checked cleanly inside the one module that must never persist anything. It now lives in
      `app/server/` under its own `tsconfig.server.json` (no `DOM`), and the residual
      `localStorage` gap — `@types/node`'s web-globals shim, pulled in transitively by vitest — is
      closed by an explicit source-scanning test rather than overclaimed in a comment.
- [x] **Review of the initial draft found and fixed real defects**, each now covered by a test: a
      failing `npm run build`; synthetic provenance claiming `schedule-aware-live`; a second
      spelling of `validated-static`; an unsound `no-catalogued-endpoint` inference at a boundary
      that never ran access-point resolution; cancellation reported as a provider network failure;
      and `unauthorized` answered with `401`. Full record in
      [LIVE_TRANSIT_SYNTHETIC_SKELETON.md](LIVE_TRANSIT_SYNTHETIC_SKELETON.md).
- [x] **`TransitProviderProvenance` deliberately stays out of `transfer.ts`'s canonical
      `TransferProvenance` union.** That union describes the provenance *of a `TransferEdge`*, and
      nothing converts a transit result into one; widening it now would force every `TransferEdge`
      consumer to handle a variant that cannot occur there.
- [x] **`getBestTransfer()` untouched** — still sync, static, directed and non-fabricating;
      `app/src/lib/transfer.ts` and its 61 tests are byte-identical to `main`.

**Provider activation remains OFF** and still `REQUIRES VENDOR CONFIRMATION` (Phase 3B3B §7.2).
This phase made **zero requests to Ekispert, NAVITIME or openrouteservice, created zero accounts,
introduced zero API keys or secrets, and used zero real provider payloads**; changed no dataset,
no access point, no `scripts/`, no deployment config, no `package.json` and no lockfile; added no
UI wiring, no React hook and no automatic runtime request; persisted nothing; and started no
Phase 3C work (no sequencing, no aggregation, no itinerary generation).

## Phase 3C-A — Ordered Sequence Builder — complete

**Product decision, stated here because it changes what "later" means for the rest of this
document:** live-transit integration is **not currently planned** for this product's scope.
Phase 3B3E (the client transport / live-transit React hook) is **deferred, not blocked** —
Ekispert/NAVITIME activation is not being pursued now, no provider account or key is being
sought, and the existing synthetic transit architecture (`app/src/lib/transit.ts`,
`app/server/transit.ts`) stays in the repository, dormant, as historical/future-ready work. It is
not deleted, and the activation gate stays `"off"`. This phase instead builds directly on the two
data layers that already exist and need no provider: validated-static walking results and honest
geographic estimates.

- [x] First real consumer of an **explicit, ordered** sequence of places — the case
      `transfer.ts`'s own "No aggregation without order" guard (§3B1) reserved for a later phase
      that takes "an explicit sequence of ids/edges as input, never a bare `Place[]`". New pure
      module `app/src/lib/ordered-sequence.ts`: for each consecutive pair in a caller-supplied
      list of place ids, calls `getBestTransfer(fromId, toId)` in exactly that direction — never
      the reverse, never a search across other pairs, never a shortest path, never a haversine
      fallback, never a network request. A pair with no recorded transfer becomes an honest
      `transfer: null` leg.
- [x] **Known vs. complete kept structurally distinct.** `OrderedSequenceSummary` carries
      `knownLegCount`/`unknownLegCount` alongside a `transferMinutes` subtotal over the known legs
      only, and a `complete` flag that is only ever `true` when every leg in the sequence is
      known. The UI is written so a partial sum is always labelled "traslados conocidos", never
      "traslados totales" — that wording only appears when `complete` is true.
- [x] **UX entry point**: "Construir recorrido" alongside (not replacing) "Analizar selección" in
      `SelectionPanel`, visible once **2** places are saved (analysis needs 3, since a 2-place
      group has nothing to group; a 2-place *route* already has one leg to describe). Opens
      `OrderedSequenceBuilder`, a modal reusing the same dialog/backdrop/focus-trap chrome
      `SelectionAnalysis` already established.
- [x] **The route draft is not "Quiero ir".** It is component-local state, initialized from the
      saved places' current order when the builder opens, holding only a reordered/reduced subset
      of the same ids. Removing a place from the route does not unsave it; a removed place can be
      added back. No new `localStorage` key, no change to the existing saved-ids format — the
      draft is never persisted.
- [x] **Reordering is keyboard-accessible, no drag-and-drop.** Every route item has explicit
      "move up" / "move down" / "remove" buttons with place-specific `aria-label`s
      (e.g. "Mover Meiji Jingu hacia arriba"), disabled rather than omitted at the first/last
      position. No pointer-only interaction; no new npm dependency was added for reordering.
- [x] **Each leg displayed honestly, reusing the existing vocabulary.** `describeTransferForUi`
      still owns the confidence label (`"Ruta a pie validada"` / `"Ruta validada"` /
      `"Estimación geográfica"` / `"Horario en vivo"`); a new `transferModeIcon` derives a glyph
      from the edge's real, closed `TransferMode` rather than a guess. A leg with no recorded
      transfer reads plainly "Sin traslado registrado" — including for an intentional cross-hub
      jump (e.g. Tokio → Kioto), which has no fabricated Shinkansen estimate.
- [x] **Visit time and transfer time stay separate.** The activity-time total reuses
      `summarizeSelection()` unchanged, so day-scale commitments ("Día completo") stay excluded
      from the minute sum exactly as Phase 3A established — never converted to invented minutes,
      never folded into the transfer total.
- [x] **No optimisation of any kind.** No auto-sort, no nearest-neighbour, no shortest path, no
      suggested or candidate sequence, no comparison between sequences, no day assignment, no
      disabled placeholder button for any of those. The order is entirely the user's.

This phase made **zero requests to Ekispert, NAVITIME, Google Maps, or openrouteservice**, created
zero accounts and introduced zero API keys or secrets; changed no `places.json`, `nearby.json`,
access-point catalog, walking pilot/scale/access-point artifact, threshold, `package.json` or
lockfile; and did not touch `getBestTransfer()`'s semantics. `app/src/lib/ordered-sequence.ts` is
the only place in the app that sums transfer time across more than one edge, and it only ever does
so over an order the user supplied. No Phase 3C-B work (comparing candidate sequences, day-level
itinerary generation) was started.

## Phase 3C-B — User-Defined Sequence Comparison — complete

Compares exactly **two user-defined orderings of the same places** — both defined by the user,
never generated, permuted, or ranked by the app. "Candidate generation" (enumerating orderings,
auto-sort, nearest-neighbour, TSP, shortest path, an "optimise" button, a recommended itinerary)
remains explicitly out of scope, with no disabled placeholder control added for any of it.

- [x] New pure module `app/src/lib/sequence-comparison.ts`. `compareSequences(placeIdsA,
      placeIdsB)` builds each side through `orderedSequenceFromLookup`/`buildOrderedSequence`
      (Phase 3C-A) — it never reimplements directed-lookup, reversal, or chaining semantics, only
      reasons about two already-built `OrderedSequence`s. The **same-set invariant** is checked
      first and independently of ordering: both candidates must be duplicate-free and represent
      exactly the same set of place ids, or the comparison is `"invalid"` — comparing order
      presupposes the same places, and a composition difference is not an ordering question.
- [x] **Incomplete routes never produce a winner.** If either candidate has any unknown leg, the
      outcome is `"incomplete"` regardless of the two known subtotals — a candidate with 40 known
      minutes and one unrecorded leg is never declared faster than one with 55 known minutes and
      full coverage. Unknown is not zero, and a known subtotal is shown without ever being
      compared as if it were the whole route.
- [x] **Range overlap never produces a false winner.** For two complete candidates, A is
      `"a-clearly-faster"` only when `A.maxMinutes < B.minMinutes` (and symmetrically for B) —
      never from comparing minima or midpoints. Equal ranges are `"equivalent"`; anything else
      that isn't a strict one-sided win is `"overlapping"`, reported as "no hay una diferencia
      clara con los datos disponibles" rather than a guessed winner.
- [x] **A declared advantage is always conservative.** `guaranteedAdvantageMinutes` is
      `loser.minMinutes − winner.maxMinutes` — the gap that survives the winner's worst case
      against the loser's best case — never a midpoint-derived figure. A same-precision
      possible-difference range is computed alongside it (interval subtraction of the two
      independent ranges) but is not surfaced in this UI, to keep the result readable at a glance.
- [x] **Confidence stays visible, not scored.** Each candidate reports its known/unknown leg
      counts plus a tally of `validated-static`/`estimated`/`schedule-aware` legs (reusing
      `TransferConfidence` unchanged) — no new confidence vocabulary, no invented numerical score.
      A route built entirely from estimates does not read as equally certain as one built from
      validated routes.
- [x] **Every conclusion is scoped to these two candidates.** Result wording always reads "entre
      estos dos órdenes…", never "la mejor ruta" or any claim of global optimality — no ordering
      outside A and B was ever evaluated.
- [x] **UX**: "Comparar otro orden" inside the existing `OrderedSequenceBuilder`, once the route
      has 2+ places. Opens as a **nested view in the same dialog** (one focus trap, one
      Escape-closes-everything behaviour) rather than a modal over a modal. Candidate A starts as
      a clone of the current route draft, Candidate B as a clone of Candidate A; both are
      independently reorderable (move up/down, disabled at the ends, place- and candidate-
      specific `aria-label`s like "Mover Meiji Jingu hacia arriba en orden B") through the same
      accessible mechanism Phase 3C-A already established — no drag-and-drop dependency added.
      Composition is fixed once the comparison opens: neither candidate can add or remove a
      place there, only reorder — that keeps the same-set invariant true by construction through
      this UI, though the domain function still checks it for any other caller. "Volver al
      recorrido" returns to the plain builder without touching "Quiero ir" or the route draft;
      nothing here is persisted.
- [x] **Visit time is not duplicated.** Both candidates hold the same places, so activity time is
      identical between them; the view states this once rather than repeating a visit-time total
      under both candidates, and never merges it into the transfer comparison.
- [x] **Cross-hub gaps behave exactly as Phase 3C-A defined them**: a pair with no recorded
      relation stays an honest unknown leg (making that candidate incomplete), never a fabricated
      Shinkansen/flight/ferry estimate and never treated as an infinite cost.

This phase made **zero requests to Ekispert, NAVITIME, Google Maps, or openrouteservice**, created
zero accounts and introduced zero API keys or secrets, and added zero new npm dependencies;
changed no `places.json`, `nearby.json`, access-point catalog, walking artifact, threshold,
`package.json` or lockfile; and did not touch `getBestTransfer()`'s or `ordered-sequence.ts`'s
semantics. No automatic candidate generation, no permutation enumeration, no global optimisation,
and no Phase 3C-C work (day assignment, itinerary generation) was started.

## Phase 3C-C — User-Defined Day Assignment — complete

The user manually divides the current route into ordinal day buckets — **Día 1, Día 2, …** —
choosing the day count, which places belong to each day, and their order inside each day. Nihon
only describes the resulting split; it never chooses a day for a place, decides how many days
are needed, distributes or balances places, or produces a recommended split.

- [x] New pure module `app/src/lib/day-assignment.ts`. `buildDayAssignment(routeIds, days)`
      builds each day's logistics through Phase 3C-A's own `orderedSequenceFromLookup` — it never
      reimplements directed lookup, reversal, or chaining semantics, and never sums or searches
      across more than one day.
- [x] **The day boundary breaks transfer aggregation, structurally, not by a special case.**
      Each day's ids are passed to `orderedSequenceFromLookup` on their own, so the pair between
      the last place of day *N* and the first place of day *N+1* is never assembled into a
      consecutive pair in the first place — there is no code path that could look it up. No
      overnight transfer, no hotel, and no inter-day commute is ever assumed or queried; proven
      with an injected lookup spy across two- and three-day splits.
- [x] **Partition validity is enforced independently of the UI**: every route id must appear in
      exactly one day, in exactly one position — `"no-days"`, `"missing-route-ids"`,
      `"extra-ids"`, `"duplicate-in-day"`, and `"duplicate-across-days"` are each detected and
      reported (not just the first found). An empty day is explicitly allowed; at least one day
      bucket is required.
- [x] **Inside a day, Phase 3C-A's guarantees hold exactly**: directed lookup only, no reverse
      inference, no chaining, no haversine fallback, no fabricated Shinkansen/flight/ferry. A
      missing same-day leg keeps that day's sequence incomplete, and its known subtotal is never
      mislabeled as a complete total — the same `complete`/`transferMinutes` distinction Phase
      3C-A defined, reused unchanged.
- [x] **No fake "day total".** Visit time (`summarizeSelection()`, unchanged — day-scale
      commitments such as "Día completo" are never converted to minutes) and transfer time
      (known subtotal vs. complete total, unknown-leg count, day-scale commitment count) stay
      separate, factual quantities per day — never merged into one number, and no capacity
      judgement ("bien equilibrado", "no cabe", "óptimo") is ever rendered; none has been defined.
- [x] **UX**: "Distribuir por días" alongside "Comparar otro orden" in the builder view, visible
      at 2+ route places. Opens as a **nested view in the same dialog** — one focus trap, one
      Escape-closes-everything behaviour — starting with a single day holding the exact current
      route order (not a recommendation: simply the route before any day boundary exists).
      Per-place duration is shown next to each name, reusing `resolveDuration`/`formatRange`
      exactly as `SelectionPanel` already does — no second duration parser, and a day-scale
      editorial value (e.g. "Día completo") renders verbatim rather than being converted.
- [x] **Day controls**: add an empty day; remove a day only while it is empty (disabled
      otherwise, and while only one day remains); move a place to the adjacent day (appended to
      the end of that day's order, never silently reordering what was already there) with
      day-specific `aria-label`s ("Mover … al día anterior/siguiente"), disabled at the first/last
      day. **No drag-and-drop.** The existing `ReorderableList` (Phase 3C-B) was extended, not
      duplicated, with optional adjacent-group controls — the builder's and comparison's reorder
      mechanics, remove-from-route, and candidate-specific `aria-label`s are unchanged.
- [x] **Ordinal days only.** No calendar date, weekday, timezone, or opening-hour solver — "Día
      1/2/3" are labels, not scheduled dates. `place.bestTime`/`schedule.hours`/`schedule.closures`
      are not structurally parsed in this phase.
- [x] **Nothing persisted.** The day draft is component-local state, discarded on close exactly
      like the route and comparison drafts; no new `localStorage` key, no change to
      `useSavedPlaces`, no backend.

This phase made **zero requests to Ekispert, NAVITIME, Google Maps, or openrouteservice**, created
zero accounts and introduced zero API keys or secrets, and added zero new npm dependencies;
changed no `places.json`, `nearby.json`, access-point catalog, walking artifact, threshold,
`package.json` or lockfile; and did not touch `getBestTransfer()`'s, `ordered-sequence.ts`'s, or
`sequence-comparison.ts`'s semantics. No automatic day distribution, no candidate generation, no
permutation enumeration, no shortest path, no scoring function, no exact clock scheduling — and
no Phase 3C-D work was started.

## Phase 3C-D — Persisted Manual Planning Draft — complete

Until this phase, Phase 3C-A's route order and Phase 3C-C's day assignment were purely
component-local state that disappeared the moment the builder closed (see those sections
above). This phase persists that **canonical manual plan** — the route and the day
assignment, and only those — locally in the browser, under a new, separate storage key. It
stores user *decisions*; it does not generate any.

- [x] **New versioned storage key, `nihon.manualPlanningDraft`**, entirely separate from
      `nihon.savedPlaceIds` ("Quiero ir"), which is untouched and remains exclusively the saved-
      place set. Schema: `{ version: 1, routeIds: string[], days: string[][] | null }`. Only ids
      and user-authored structure are ever persisted — no `Place` objects, names, durations,
      transfer edges/results, visit-time summaries, transfer totals, confidence tallies, or any
      other value recomputable from the current dataset/domain logic.
- [x] **Phase 3C-B's comparison candidates are deliberately excluded from this schema and always
      will be.** "Orden A"/"Orden B" remain plain, ephemeral component state — cloned fresh from
      the current route each time the comparison view opens, discarded on close, exactly as
      before this phase.
- [x] **Restore semantics distinguish "no valid stored plan" from "a valid stored plan whose
      route happens to be empty".** No stored draft (or a malformed one) initialises the route
      from the current saved ids, preserving Phase 3C-A's original first-run behaviour. A stored
      `routeIds: []` is an intentional empty route and stays empty after reload — it is never
      reinterpreted as "nothing was stored."
- [x] **Reconciliation, not silent repair.** A stored route id no longer present in "Quiero ir"
      is pruned from the route and from any day bucket that referenced it — never re-added,
      replaced, or used to infer another place. A place newly saved to "Quiero ir" after a
      planning draft already exists is **not** auto-added to the route or assigned to a day; it
      stays under the existing "Guardados fuera del recorrido" flow until the user explicitly
      adds it.
- [x] **Route-edit vs. day-edit semantics.** Changing only the route's *order* (the exact set of
      ids unchanged) retains the existing canonical day assignment untouched. Changing the
      route's *composition* (a place added or removed) invalidates it (`days: null`) — this
      phase never invents which day a new place belongs to, or repairs a day that no longer
      accounts for a removed one.
- [x] **One shared partition validator, reused, not duplicated.** `day-assignment.ts`'s issue
      taxonomy (`no-days`, `missing-route-ids`, `extra-ids`, `duplicate-in-day`,
      `duplicate-across-days`) was extracted into a transfer-lookup-free `validateDayPartition`,
      which both `dayAssignmentFromLookup` (transfer-lookup context) and the new
      `app/src/lib/planning-draft.ts` (persistence-reconciliation context) call — one source of
      truth for what counts as a valid day split, proven by regression tests that the extraction
      changed nothing about the taxonomy, the transfer semantics, or the day-boundary guarantee.
- [x] **Storage failures never reach the UI.** No stored value, malformed JSON, the wrong object
      shape, an unsupported version, non-string ids, duplicate stored route ids, and a
      `localStorage` read/write exception are all handled by falling back to an in-memory
      default — no invented migration for an unrecognised version, no thrown error.
- [x] **UX**: a factual, low-key disclosure ("Este recorrido se guarda automáticamente en este
      navegador…") in the builder view — no toast per reorder, no new modal, no implied cloud or
      account sync. An optional **"Restablecer recorrido"** control resets the route to the
      current saved ids in their saved order and clears the day assignment, without touching
      "Quiero ir" itself.
- [x] Accessibility/mobile unchanged: still one dialog, one focus trap, Escape closes
      everything, the same keyboard reorder controls and `aria-label`s. No `<select>` was
      introduced, so the existing focusable-element selector needed no change. No drag-and-drop,
      no new npm dependency.

This phase made **zero requests to Ekispert, NAVITIME, Google Maps, or openrouteservice**,
created zero accounts and introduced zero API keys or secrets, and added zero new npm
dependencies; changed no `places.json`, `nearby.json`, access-point catalog, walking artifact,
threshold, `package.json`, or lockfile; and did not touch `getBestTransfer()`'s,
`ordered-sequence.ts`'s, or `sequence-comparison.ts`'s semantics. No automatic route generation,
ordering, day count, or day assignment; no balancing; no itinerary generation or
recommendation; no optimisation, TSP, nearest-neighbour, or shortest path; no scoring; no
calendar dates, weekdays, clock scheduling, or opening-hours solving — not even as a disabled
placeholder. No Phase 3C-E work was started.

## Phase 3C-E — Manual Calendar Anchoring — complete

Phase 3C-D's persisted plan stored the day assignment as purely ordinal buckets — "Día 1",
"Día 2", … — with no relationship to a real calendar. This phase lets the user manually anchor
"Día 1" to a real civil date; every later day is derived by calendar offset, exactly like the
ordinal numbering already was. It stores one more user *decision*; it still never decides one.

- [x] **Schema bumped to a versioned V2**, `{ version: 2, routeIds: string[], days: string[][] |
      null, startDate: string | null }`. `startDate` is a plain `YYYY-MM-DD` string or `null` —
      never a serialized `Date`, never a derived weekday, never a month name. A V1 draft (Phase
      3C-D's original shape, no `startDate` field) is migrated deterministically
      (`migrateV1ToV2`): `routeIds`/`days` pass through unchanged and `startDate` is always
      `null` — no date is ever invented for a plan that never had one.
- [x] **One start date, offset per day, not per-day dates.** The user picks a single civil date
      for "Día 1"; "Día N" is that date plus `N − 1` calendar days, computed on every render
      (`app/src/lib/civil-date.ts#addCivilDays`) and never stored per bucket. This was chosen
      over an independent date per day bucket because it cannot represent an internally
      inconsistent calendar (gaps, duplicates, an out-of-order day) and needs no reconciliation
      of its own when a day is added, removed, or reordered — the trade-off is that all days are
      necessarily consecutive; the user cannot anchor "Día 2" to a non-consecutive date.
- [x] **The calendar anchor is independent of the route and the day assignment.** Adding,
      removing, or reordering a day; moving a place between days; a pure route reorder; a route
      composition change that invalidates the day assignment (`days: null`); and "Restablecer
      recorrido" all leave `startDate` untouched — resetting *what* the plan contains is not a
      decision about *when* it starts. Only the user explicitly setting or clearing the date
      (`withStartDate`) changes it.
- [x] **Deterministic, conservative validation.** `civil-date.ts#isValidCivilDate` checks both
      shape (`YYYY-MM-DD`) and calendar reality (rejects `2027-02-30`, `2027-13-01`, and
      `2027-02-29` in a non-leap year; accepts `2028-02-29`) via a round-trip through
      `Date.UTC`/`getUTC*`. An invalid `startDate` is rejected outright by `withStartDate` (the
      draft is returned unchanged) and, in stored data, invalidates the *entire* stored draft
      (falls back to a fresh one) — the same "corrupted data taints the whole record" policy
      Phase 3C-D already applies to a duplicate route id.
- [x] **No timezone off-by-one.** Every date computation reads/writes calendar components via
      `Date.UTC(...)`/`getUTC*` and passes `timeZone: "UTC"` to `Intl.DateTimeFormat` — a civil
      date picked by the user renders as that same date regardless of the browser's local
      timezone. Verified both by unit tests that flip `process.env.TZ` across UTC−12/UTC+14/
      `America/Los_Angeles` and by manual visual QA of the real UI under Playwright browser
      contexts pinned to those same timezones.
- [x] **UI**: a single native `<input type="date">` inside the existing "Distribuir por días"
      view (no new modal, no dialog-over-dialog), labelled "Fecha de inicio (Día 1)", plus a
      "Quitar fecha" control to clear it. Each day card shows its derived date (e.g. "vie, 19 feb
      2027") under its "Día N" heading — the weekday/month abbreviation comes from
      `Intl.DateTimeFormat("es", …)`, never a hand-maintained Spanish weekday table. An
      unobtrusive disclaimer states the date is the user's own choice.

This phase made **zero reads of `place.bestTime`, `schedule.hours`, or `schedule.closures`**, no
check of whether anything is open on the chosen date, no opening-hours solver, no slot/hour
scheduling, no automatic route/day generation, ordering, balancing, or recommendation, no
optimisation, TSP, nearest-neighbour, shortest path, or scoring, and no live provider
integration (no Ekispert, NAVITIME, Google Maps, or openrouteservice requests) — not even as a
disabled placeholder. Zero new npm dependencies; no dataset, workbook, `nearby.json`, logistics/
access-point/walking artifact, `package.json`, or lockfile changes. No Phase 3C-F (or any later
phase) work was started.

## Phase 3D-A — Temporal Data Audit & Normalization Contract — complete

Phase 3C-E gave every manually assigned day a real civil date. This phase starts a new
product/domain family — temporal *feasibility* — but is deliberately audit-and-contract only: it
determines which parts of the existing dataset are safe enough to support a future "what can
Nihon safely say about this day's places" answer. It is **not** Phase 3C-F, and it does not
answer that question itself.

- [x] Programmatically audited all 214 places' `schedule.hours`, `schedule.closures`, `bestTime`,
      `reservation.required`/`leadTime`/`raw`, and `febMar2027.status`/`warning`/`action` with a
      new deterministic, offline, zero-network script (`scripts/audit-temporal-data.py`, pure
      classification rules in `scripts/temporal_data_lib.py`) — every count in
      [`docs/TEMPORAL_DATA_CONTRACT.md`](TEMPORAL_DATA_CONTRACT.md), including every distinct-
      raw-value count and raw-value frequency, is emitted by the script's generic
      `raw_value_stats()` helper and reproducible by re-running it, never hand-transcribed or
      hardcoded.
- [x] Derived the pattern-family taxonomy **from the data**, not from a predetermined list:
      13 `schedule.hours` families and 10 `schedule.closures` families, each tagged SAFE / PARTIAL
      / OPAQUE / UNKNOWN. Coverage: hours SAFE 80/214, PARTIAL 50/214, OPAQUE 19/214, UNKNOWN
      65/214; closures SAFE 61/214, PARTIAL 31/214, OPAQUE 83/214, UNKNOWN 39/214. A real
      recurring-weekday closure example exists (30/214, always carrying an uncertainty marker in
      this checkout, e.g. `"Lunes; verificar"` — classified PARTIAL, never SAFE) and is kept
      structurally distinct from the irregular `"Muchos domingos"` pattern, which is never treated
      as a safe recurring rule. A "24 h" token is likewise never promoted to SAFE merely by being
      present: `known-24h-with-caveat` (4/214, e.g. `"Abierto 24 h; puede cerrar por viento"`)
      keeps a 24h claim paired with a weather/operator/seasonal/other material caveat PARTIAL,
      never SAFE, distinct from the 15/214 genuinely unqualified `known-24h` places.
- [x] **`reservation.required` audited independently, not merely read off the raw text**:
      verified a real `bool` for all 214 places, with exact True=41/214, False=173/214 counts,
      and mechanically cross-checked against `reservation.raw`'s own classification via
      `classify_reservation_consistency()` — **0/214 inconsistent pairs found today**, checked
      per place and named explicitly (never assumed) had any existed. That mechanical check is
      what turns the finding below from a plausible guess into a proven one.
- [x] **Two real findings, recorded rather than silently fixed**: `reservation.required` collapses
      39/214 places (18 %) whose raw text is `"Recomendable"`/`"Opcional"`/`"No para espectador"`
      into the same `false` a plain `"No"` gets, losing a real nuance the raw string still
      preserves; and `data/seasonal-alerts.json` (33 entries, keyed by free-text `"Lugar / tema"`,
      not by place id) is a structurally separate collection from the 214 per-place `febMar2027`
      objects, confirmed by grep to have **zero consumers anywhere in `app/src/`**.
- [x] **`bestTime` audited and bounded, never conflated with availability**: all 214 values (a
      closed 10-item vocabulary — `Mañana`, `Tarde`, `Noche`, `Atardecer`, …) classify as one
      opaque `editorial-recommendation` category; `classify_best_time()` branches on presence only,
      never on content, so a value that happens to look time-shaped can never leak into the hours
      domain. `schedule.hours` is not overridden by `bestTime` anywhere.
- [x] **`febMar2027` kept on its own axis, never merged into weekly hours/closures**: `status`
      alone drives its classification (`classify_feb_mar_status()` takes exactly one argument, a
      regression test pins this down). `warning`/`action` are formally included in the audit
      contract as their own classified field — `classify_editorial_prose()`, presence-only,
      structurally identical to `classify_best_time()` — rather than merely counted on the side:
      all 214/214 places classify `editorial-prose`/OPAQUE for both, with 34 distinct warnings and
      34 distinct actions over 214 places (backed by the same `raw_value_stats()` helper, not a
      one-off computation). The dominant `pending-verification` bucket (152/214, e.g.
      `"CALENDARIO / CONDICIÓN PENDIENTE"`) is tiered UNKNOWN, not a weaker OPAQUE — "the calendar
      isn't published yet" is not a closure signal of any kind.
- [x] **Malformed nested field types fail loudly, never silently stringify into ordinary text**:
      `load_places()` now type-checks every nested temporal leaf against the canonical `Place`
      contract (`app/src/types.ts`) — `schedule.hours`/`closures`, `reservation.leadTime`/`raw`,
      and `febMar2027.status`/`warning`/`action` must be `str`; `reservation.required` must be a
      real `bool`, rejecting a look-alike string like `"false"` or an int like `1`/`0` even though
      `bool` is a Python `int` subclass. `_norm()` (used by every classifier) independently raises
      `TypeError` on anything that isn't `str`/`None`, as a second guard for any direct caller.
      Regression tests cover `schedule.hours = 123`, `reservation.required = "false"`, and
      `febMar2027.warning = []` each failing with a specific message rather than becoming an
      ordinary-looking UNKNOWN/OPAQUE classification.
- [x] **Normalization contract** in [`docs/TEMPORAL_DATA_CONTRACT.md`](TEMPORAL_DATA_CONTRACT.md):
      raw editorial text stays authoritative and is never dropped; SAFE facts are parseable without
      guessing; PARTIAL facts expose only their safely-extractable part and carry the rest forward
      as text; OPAQUE data (weather, tides, an unnamed operator, a festival calendar) stays
      editorial indefinitely, not "until parsed better"; UNKNOWN is never coerced to any other
      tier — enforced by a regression test, not just documented intent.
- [x] **A future domain model sketched, not implemented** — following Phase 3B2E's own precedent
      of deciding a model without shipping code. No new TypeScript type, file, or export was added
      to `app/src/`; the sketch in the contract doc is scoped tightly to what the audit actually
      justifies (no `open`/`closed` boolean anywhere in it — even a SAFE fact only supports "this
      is what the editor recorded," never "open right now") and explicitly excludes `bestTime` and
      `febMar2027` from it.
- [x] **82 offline tests** (`scripts/test_temporal_data_audit.py`): per-category classification
      invariants, priority ordering (e.g. weather-dependence outranks a generic third-party
      mention, a caveat outranks a bare "24 h"), malformed-input handling (missing file, non-array
      JSON, invalid JSON, a place missing a required nested field, and — since the corrective
      review below — every malformed nested leaf type — each fails with a specific message rather
      than guessing a default), a generic `raw_value_stats()` helper's own unit tests
      (determinism, tie-breaking, `None` handling), real-dataset coverage-existence checks that
      assert an example currently exists without hardcoding a fragile count, CLI-level determinism
      (two subprocess runs produce byte-identical stdout), and that the CLI never modifies
      `data/places.json`.
- [x] **Corrective review**: a second pass found and fixed four audit-contract defects before this
      phase's PR was reviewed. (1) `reservation.required` and `febMar2027.warning`/`.action` were
      claimed as "audited" without the script actually checking or reporting them — now each has
      its own classification and, for `reservation.required`, an independent boolean audit plus a
      mechanical cross-check against `reservation.raw` (0/214 inconsistent, proven not assumed).
      (2) `load_places()` type-checked only presence, not type, for every nested temporal leaf — a
      `schedule.hours: 123` or `reservation.required: "false"` would have passed through to a
      classifier and silently become an ordinary-looking UNKNOWN/OPAQUE answer; both now fail
      loudly with the actual offending type named. (3) The contract document cited several
      distinct-raw-value and frequency numbers the script itself never emitted (bestTime
      frequencies, leadTime/status/warning/action distinct counts) — closed with a generic,
      reusable `raw_value_stats()` helper wired into every audited field, so the "every number is
      reproducible by rerunning the script" claim is now literally true rather than aspirational.
      (4) `classify_hours()` checked "24 h" before any weather/operator/seasonal/variable caveat,
      so a real dataset value — `"Abierto 24 h; puede cerrar por viento"` — was misclassified
      SAFE; fixed with a new `known-24h-with-caveat` PARTIAL family, checked before the corrected
      priority could hide the same class of defect in a still-uncaught shape, and the resulting
      real coverage-number changes (hours SAFE 84→80, PARTIAL 46→50) were propagated everywhere
      they appeared rather than left stale to minimize the diff.

**No opening-hours solver, no date-feasibility check, no "this day works" UI, and no clock-time,
timezone, or per-place scheduling of any kind exist after this phase.** Phase 3C-E's manual civil-
date anchoring is unchanged and still reads none of `bestTime`/`schedule.hours`/
`schedule.closures`; `PlaceDetail.tsx` and `OrderedSequenceBuilder.tsx` are unmodified. This phase
made **zero requests to any official source, provider, or API**, changed no `places.json`
(canonical or `app/src/data/` copy), no `seasonal-alerts.json`, no workbook, no logistics/access-
point/walking artifact, `package.json`, or lockfile, and added no npm dependency. No Phase 3D-B (or
any later phase) work was started.

## Phase 3D-B — Weekday Closure Signals — complete

The first RUNTIME consumer of Phase 3D-A's audit contract. Deliberately narrow: it answers only
"does the weekday of a civil date the user already assigned to a day bucket match a candidate
recurring-weekday closure recorded in `place.schedule.closures`" — never "is the place open,"
"can I visit at 14:00," "is the whole day feasible," or "what is the best day." It is not an
opening-hours solver, and none of Phase 3D-A's other audited fields (`schedule.hours`, `bestTime`,
`febMar2027`) are read for feasibility here.

- [x] **`getCivilWeekday(iso): CivilWeekday | null`** added to `app/src/lib/civil-date.ts` — the
      smallest possible extension, reading calendar components via `Date.UTC(...)`/`getUTCDay()`
      exclusively (timezone-invariant, like every other function in that module), returning
      `null` for an invalid civil date rather than guessing. The module still knows dates and
      weekdays only — no `Place`, no closure text, no business rule was added to it.
- [x] **`app/src/lib/temporal-availability.ts`** — a new, small, pure domain module: `ClosureFact`
      (`"no-known-closure"` SAFE / `"candidate-weekday"` PARTIAL with extracted `CivilWeekday[]` /
      `"not-evaluable"` for everything else) derived on read from `place.schedule.closures`, never
      persisted and never a new field on `Place`. `interpretClosureText()` is a direct TypeScript
      port of **only** `scripts/temporal_data_lib.py`'s `classify_closures()` — same category
      names, same priority order, same SAFE/PARTIAL/OPAQUE/UNKNOWN tier per category — not a
      port of the hours/bestTime/reservation/febMar2027 taxonomies, which stay exactly as
      unparsed at runtime as Phase 3D-A left them. `assessWeekdayClosure()` combines one
      `ClosureFact` with one civil-date string into a closed
      `"possible-weekday-closure-match" | "no-weekday-match" | "no-known-closure" |
      "not-evaluable" | "not-assessed"` outcome — `"no-weekday-match"` is never "open," never
      "compatible," only "this one recorded candidate didn't match this one date."
- [x] **Parity with the Phase 3D-A contract, proven not assumed**: `"Sin cierre"`/`"Sin cierre
      ordinario"` classify SAFE; `"Sin cierre ordinario; clima"` does **not** (a caveat
      disqualifies it, exactly as the audit found); `"Lunes; verificar"` and every other
      single/multi-named-weekday pattern the audit already found PARTIAL becomes a candidate;
      `"Muchos domingos"` and `"Miércoles/domingo variable"` — the audit's own
      `irregular-weekday-pattern` OPAQUE family — never become a candidate; every
      weather/tide/third-party/scheduled-unspecified/genuinely-unrecognized family from the audit
      stays `"not-evaluable"`. A real-dataset test asserts no OPAQUE/UNKNOWN closure category is
      ever promoted into a definitive weekday conflict, across all 214 current places and a full
      reference week of dates.
- [x] **UI: the day-assignment view only.** `OrderedSequenceBuilder.tsx`'s existing "Distribuir
      por días" day cards gained a `WeekdayClosureNotice` section, rendered only when a day
      already has a derived date (Phase 3C-E's `startDate` + day offset) and at least one place —
      no warning was added to the national map, ordinary place cards, sequence comparison, or the
      unordered selection analysis. A match reads "N posible(s) coincidencia(s) con cierre
      semanal" (amber, non-alarmist — the same warm palette `.alert--pending` already uses, never
      the stronger red risk treatment) and names each matched place with its raw closure text
      verbatim; zero matches reads only "Sin coincidencias de cierre semanal detectadas" — never a
      "day is valid" claim; places that could not be evaluated are counted and disclosed
      separately. A standing disclaimer states plainly that the check does not verify opening
      hours, holidays, temporary closures, weather, reservations, or live status. Manually
      verified end-to-end in a real browser (`npm run dev` + Playwright): a Monday start date
      correctly surfaced both saved places whose recorded closure is `"Lunes; verificar"`; a
      Tuesday date correctly showed the neutral no-match line for the same places; clearing the
      date removed the section entirely.
- [x] **No automation of any kind.** Nothing here moves a place to another day, recommends a
      different day, scores days, auto-distributes, auto-orders, or offers a "fix this day"/"best
      day" control. The user's manual route/day/date decisions remain exactly as canonical as
      Phase 3C left them.
- [x] **Nothing persisted.** No `ManualPlanningDraftV3`, no new `localStorage` key — the signal is
      recomputed on every render from the day's already-derived date and each place's existing raw
      `schedule.closures` text. A source-scanning regression test asserts neither new module
      references `localStorage`/`sessionStorage`/`indexedDB` at all, the same technique Phase
      3B3D's `transit.test.ts` already established for exactly this kind of guarantee.
- [x] **76 new tests**: 9 new `getCivilWeekday` cases in `civil-date.test.ts` (known Monday/Sunday,
      every weekday across one reference week, a leap date, a century leap year, month/year
      boundaries, invalid input, timezone invariance across UTC−12/UTC/UTC+14-equivalent zones);
      44 in `temporal-availability.test.ts` (parity cases above, accent/case handling,
      multi-weekday extraction in fixed order, all five `assessWeekdayClosure` outcomes including
      the explicit "no boolean field anywhere that could be read as open" check, real-dataset
      throw/coverage/non-promotion invariants, a full-vocabulary table-driven parity check, and a
      subprocess-free source-check against `scripts/temporal_data_lib.py`'s actual `CLOSURES_TIER`
      — see "Corrective review" below); 13 in `day-weekday-signal.test.ts` (no-date/invalid-date →
      unassessed, a match/no-match/empty-day case each, not-evaluable counted and individually
      identifiable, moving a place to a different day and changing the start date each recomputing
      from the new date, determinism, an outcome-vocabulary regression check, and the persistence
      source-scan above); 10 in the new `OrderedSequenceBuilder.test.ts` (source-scanning
      integration coverage — see "Corrective review" below).
- [x] Updated `docs/DATA_MODEL.md` (new "Weekday closure signals" section, pointer-only — no
      `Place` field changed) and `docs/TEMPORAL_DATA_CONTRACT.md` (records this runtime consumer
      and its exact boundary, without reopening the audit numbers themselves).
- [x] **Corrective review**: a second pass found and fixed two defects before human review. (1) A
      real category-name parity defect: `interpretClosureText()`'s TypeScript category was named
      `no-known-closure-with-caveat` while the canonical Python audit
      (`scripts/temporal_data_lib.py`'s `CLOSURES_TIER`) names the same family
      `no-ordinary-closure-with-caveat` — the existing parity test had encoded the same wrong name,
      so it didn't actually protect the parity claim it existed to enforce. Fixed with the exact
      canonical name (tier/behavior unchanged: still PARTIAL, still `not-evaluable`, still never
      SAFE), and hardened with a table-driven test covering the complete 11-category
      `schedule.closures` vocabulary plus a lightweight, subprocess-free source-check that parses
      `CLOSURES_TIER` directly out of the Python file's text and fails if either language's
      category set or tier values ever drift from the other — verified to actually catch the
      original defect by deliberately reintroducing it and confirming the new tests fail. (2)
      Added `OrderedSequenceBuilder.test.ts`, a source-scanning structural test (the same technique
      `server/transit.test.ts` already established) proving the component still imports and calls
      `buildDayWeekdaySignal(places, dayDate)`, still renders `<WeekdayClosureNotice
      signal={weekdaySignal} />`, contains the exact conservative match/no-match/disclaimer wording
      scoped to that function's own source region (never the whole file, to avoid false positives
      against this module's own "does not read X" doc comments), never contains "está
      cerrado"/"día válido"/"día compatible"/"mejor día," and introduces no second
      `role="dialog"` — verified to actually catch a real regression by deliberately removing the
      render call and confirming the test fails. Both fixes verified by deliberately reverting them
      and confirming the new tests catch the reversion, not merely by inspection.

This phase made **zero requests to any official source, provider, or API**, changed no
`places.json` (canonical or `app/src/data/` copy), no `seasonal-alerts.json`, no workbook, no
logistics/access-point/walking artifact, `package.json`, or lockfile, and added no npm dependency.
It reads no `schedule.hours`, no `bestTime`, and no `febMar2027` field for feasibility, assigns no
clock time or timezone to anything, and does not touch the planning-draft schema. No Phase 3D-C
(or any later phase) work was started.

## Phase 3D-C — Reservation Semantics — complete

Fixes a real correctness gap Phase 3D-A proved mechanically, not a hypothetical one:
`place.reservation.required` is a lossy derived boolean (`scripts/export-dataset.py`'s
`required = raw.lower() == "sí"`), so 39/214 places whose `reservation.raw` is
`"Recomendable"`/`"Opcional"`/`"No para espectador"` collapse into the same `false` a plain
`"No"` gets. `reservation.raw` already preserves the real nuance; this phase is what makes
runtime UI/filter logic respect it. It does **not** normalize lead time into booking deadlines —
that remains a distinct, later, unscheduled phase (see "Later" below).

- [x] **`app/src/lib/reservation.ts`** — a new, small, pure domain module: `ReservationFact`
      (`category` / `tier` / `raw` / `required` / `consistentWithDerivedBoolean`) derived on read
      from `reservation.raw` + `reservation.required`, never persisted and never a new field on
      `Place`. `reservation.required` itself is untouched and stays exported — it remains
      internally consistent with the exporter, and removing it would be unnecessary schema churn
      this phase doesn't need; what changes is that no UI/filter code decides "requires
      reservation" from that boolean alone anymore.
- [x] **Exact parity with the Phase 3D-A contract**: `classifyReservationCategory()` is a direct
      TypeScript port of `scripts/temporal_data_lib.py`'s `classify_reservation_raw()` — same 7
      category names (`missing`, `not-required`, `required`, `recommended-not-required`,
      `optional-not-required`, `not-required-role-specific`, `unrecognized-value`), same
      SAFE/PARTIAL/UNKNOWN tier per category, same expected-boolean mapping
      (`RESERVATION_RAW_EXPECTED_REQUIRED`). Protected the same way Phase 3D-B's own corrective
      review established for `schedule.closures`: a table-driven test covering the complete
      7-category vocabulary, plus a subprocess-free source-check that parses
      `RESERVATION_RAW_TIER`/`RESERVATION_RAW_EXPECTED_REQUIRED` directly out of the Python file's
      text — verified to actually catch a deliberately reintroduced category-name drift.
- [x] **Boolean consistency cross-checked, never assumed.** `consistentWithDerivedBoolean` compares
      `required` against what the export pipeline's own rule expects for that raw category — on
      the current dataset this is `true` for all 214 places (Phase 3D-A's own finding,
      re-mechanically-proven here by a real-dataset test), never hardcoded as an invariant that
      would silently pass if it stopped holding. An inconsistent record (none exist today) would
      surface structurally on the fact itself, never be silently trusted or hidden, and this phase
      does not mutate the dataset to "fix" one if it appeared.
- [x] **`PlaceDetail.tsx` no longer reads `place.reservation.required` at all.** Both the tag and
      the "Reserva" practical-info row are driven by `describeReservationForUi()`: `required` →
      tag "Requiere reserva" / row "Necesaria · &lt;leadTime&gt;"; `recommended-not-required` →
      tag "Reserva recomendable" (new, softer green tone, never the same visual urgency as
      "required") / row "Recomendable · &lt;leadTime&gt;"; `optional-not-required` → tag "Reserva
      opcional" (new, neutral blue tone) / row "Opcional · &lt;leadTime&gt;"; `not-required` → no
      tag, row "No es necesaria"; `not-required-role-specific` → no tag, row shows the raw text
      verbatim ("No para espectador") rather than being rewritten as the generic not-required
      wording; `missing`/`unrecognized-value` → no tag, conservative fallback text, never guessed
      into a specific state. `leadTime` is shown as **raw text only** — a `"—"`/empty value omits
      the suffix entirely rather than rendering "Necesaria · —"; no magnitude bucketing, no
      deadline math, no comparison against any date.
- [x] **The false Requiere/Sin-reserva binary is gone from the filter.** `Filters.reservation` is
      now the closed union `"all" | "required" | "recommended" | "not-required" | "optional" |
      "role-specific"` (`ReservationFilterValue`, defined in `lib/reservation.ts` and imported into
      `types.ts` — the same cross-module pattern `PlanningBlock` already established). `App.tsx`'s
      `matchesFilters` calls the one shared predicate, `matchesReservationFilter()`, instead of
      reading the boolean inline; `FilterPanel.tsx`'s "Reserva" group now offers all six options
      (Todas / Requiere reserva / Reserva recomendable / No requiere reserva / Reserva opcional /
      Depende del rol) as a static list — matching this filter's own existing convention (unlike
      category/grade/tourism-level, it was never dynamically computed from the active hub's
      places, so this phase didn't invent a new dynamic-filter architecture to add the three new
      options). "Recomendable" no longer falls under "Sin reserva": each of the five real
      categories is mutually exclusive under the new filter, verified across all 214 current
      places.
- [x] **No date/time intelligence of any kind.** No booking deadlines, no days-until-booking
      calculation, no reference to today's date, no clock time or timezone, no availability, no
      lottery/release-date interpretation, no official booking-site scraping or API, no reminders.
      This phase fixes semantics, not timing.
- [x] **No automation.** Nothing here reserves anything, opens a booking flow, recommends or moves
      a place between days, reorders the trip, scores reservation difficulty, or sends a
      notification.
- [x] **64 new tests**: 53 in `lib/reservation.test.ts` (classification parity, the source-check
      above, derived-boolean consistency including a deliberately inconsistent synthetic case,
      real-dataset invariants — all 214 places classify without throwing, all five real raw values
      exist, 0/214 inconsistencies today, `Recomendable`/`Opcional`/`No para espectador` never
      classify as plain `not-required`, only `"Sí"` maps to `required` — filter-predicate
      mutual-exclusivity across the real dataset, and `describeReservationForUi` display-text
      cases including the no-lead-time-suffix guard); 5 in the new `PlaceDetail.test.ts`
      (source-scanning: imports and calls the domain function, renders its tag/row output, and no
      longer contains the old boolean-gated patterns — verified to actually catch a deliberately
      reintroduced old pattern); 3 in the new `FilterPanel.test.ts` (all six filter values/labels
      present, the old "Sin reserva" label gone); 3 in the new `App.test.ts` (imports and calls
      `matchesReservationFilter`, no longer reads the boolean inline — verified to actually catch
      a deliberately reintroduced old predicate).
- [x] **Manual QA in a real browser** (`npm run dev` + Playwright), one representative place per
      raw category: Shibuya Crossing (`"No"`) → no tag, "No es necesaria"; SHIBUYA SKY (`"Sí"`) →
      "Requiere reserva" tag, "Necesaria · 2–4 semanas; atardecer antes"; Nezu Museum
      (`"Recomendable"`) → "Reserva recomendable" tag, "Recomendable · Días o semanas para
      exposición popular"; Tokyo Marathon 2027 (`"No para espectador"`) → no tag, row shows "No
      para espectador" verbatim; Yanagawa canal cruise (`"Opcional"`) → "Reserva opcional" tag,
      "Opcional · Grupos: reservar; individuales según operador". The "Reserva" filter group
      confirmed rendering all six options.

This phase touched no `schedule.hours`, no `bestTime`, no `febMar2027` field, and did not start
lead-time normalization, booking-deadline calculation, live availability, or any date/time
intelligence. `data/places.json`, `app/src/data/places.json`, the workbook, and every
logistics/access-point/walking/temporal artifact are byte-identical to `main`; no dependency was
added; the planning-draft schema and `localStorage` keys are unchanged. No Phase 3D-D (or any
later phase) work was started.

## Phase 3D-D — Reservation Lead-Time Signals — complete

Turns the already-audited `reservation.leadTime` free text into a conservative runtime planning
signal, given a place the user already selected. It does **not** implement booking deadlines: it
never answers "when exactly must I book," "am I already too late," "book by \<date\>," "when do
tickets go on sale," or "is there availability."

- [x] **`app/src/lib/reservation-lead-time.ts`** — a new, small, pure domain module, deliberately
      separate from `lib/reservation.ts` (which keeps owning reservation-*necessity* semantics —
      required/recommended/optional/role-specific — from Phase 3D-C). `classifyLeadTimeCategory()`
      is a direct TypeScript port of `scripts/temporal_data_lib.py`'s `classify_lead_time()`: the
      same 3 category names (`not-applicable`, `bare-magnitude`,
      `opaque-entity-or-mechanism-specific`), the same SAFE/PARTIAL/OPAQUE tier per category, and
      an exact port of `_BARE_MAGNITUDE_RE` — an anchored (`^...$`) whole-string pattern, never a
      substring search. Protected by the same subprocess-free source-check technique
      `reservation.test.ts` established for `RESERVATION_RAW_TIER`, applied here to
      `LEAD_TIME_TIER`, plus a direct assertion that the Python pattern text is itself anchored.
- [x] **The whole-string opacity rule is load-bearing and explicitly tested.** A string is
      `bare-magnitude` only when the ENTIRE normalized string matches the canonical pattern — a
      magnitude-shaped substring inside a longer sentence never qualifies. Proven against the
      exact adversarial examples the phase brief named: `"Lotería 3 meses antes; revisar
      liberaciones"`, `"2–4 semanas; atardecer antes"`, `"Días o semanas para exposición
      popular"`, `"App obligatoria para timed entry desde 2026"`, and `"Grupos: reservar;
      individuales según operador"` all stay `opaque-entity-or-mechanism-specific` and never
      produce a `magnitude` field, despite each containing a magnitude-shaped token.
- [x] **Coarse magnitude extraction, canonical-pattern-only.** For a bare-magnitude string only,
      `deriveMagnitude()` buckets it into `days` / `weeks` / `months` / `days-to-weeks` /
      `weeks-to-months` — a closed, discriminated-union field (`ReservationLeadTimeFact`) that
      cannot exist on an opaque or not-applicable fact. No numeric range (`minDays`/`maxDays`) is
      ever derived; `"1–2 semanas"` stays `magnitude: "weeks"` with `raw: "1–2 semanas"` preserved
      verbatim — the precise editorial range lives in `raw` only, never turned into arithmetic.
      A real quirk of the canonical Python pattern is reproduced exactly, not "fixed": `"Meses"`
      (plural) is bare-magnitude, but bare singular `"Mes"` is not (the pattern's `meses?`
      pluralizes `"mese"`, not `"mes"`) — covered by its own regression test naming this
      explicitly, since silently "fixing" it would break parity with the audited Python ceiling.
- [x] **`app/src/lib/reservation-planning.ts`** — a small pure aggregation,
      `buildReservationPreparationSummary(places)`, composing `lib/reservation.ts`'s
      `ReservationFact` and this phase's `ReservationLeadTimeFact` per place without merging or
      overriding either axis. A `not-applicable` lead time omits the place from the summary
      entirely (no lead-time signal to show); `bare-magnitude` and
      `opaque-entity-or-mechanism-specific` are both included. Preserves the caller's exact route
      order — never resorted by magnitude, reservation category, or any derived urgency; no
      scoring, no prioritization.
- [x] **UI**: `OrderedSequenceBuilder.tsx`'s existing "Construir recorrido" view gained one new,
      route-wide, read-only section — "Reservas por preparar" — built from the current canonical
      route (`routePlaces`), rendered in the main builder view rather than inside a day card so it
      is useful before the route is even split into days. It reads no `startDate`, no derived day
      date, and performs no date arithmetic. A summary line
      ("`N` con anticipación registrada · `M` con mecanismo específico para revisar") is followed
      by one entry per applicable place naming its reservation category (Phase 3D-C's existing
      vocabulary), its coarse magnitude or "Mecanismo específico; revisar", and the original raw
      `reservation.leadTime` text verbatim — the only detailed information Nihon may safely show
      for an opaque record. A standing disclaimer states plainly that the section describes a
      recorded fact only and computes no booking deadline and no calendar comparison.
- [x] **No fake urgency UI.** No traffic-light coloring by urgency, no countdown, no priority
      score, no ranking, no progress-toward-a-deadline bar. The one visual distinction (a warmer
      tone on "Mecanismo específico; revisar") mirrors Phase 3D-B's own precedent of using the
      existing warm "pending" palette for a conservative planning signal, not an alarm.
- [x] **Real-dataset counts re-derived, not copied from documentation**: 128/214 places
      `not-applicable` (SAFE), 21/214 `bare-magnitude` (PARTIAL), 65/214
      `opaque-entity-or-mechanism-specific` (OPAQUE) — matching Phase 3D-A's original audit
      exactly, independently reproduced here by both a Python audit re-run and new TypeScript
      tests against `data/places.json`. Route-level aggregation over the full dataset yields
      21 + 65 = 86 preparation items, omitting exactly the 128 not-applicable places.
- [x] **62 new tests**: 38 in `lib/reservation-lead-time.test.ts` (category/tier parity including
      the Python source-check, magnitude extraction for every bucket, the five adversarial
      whole-string opacity cases, the `"Mes"`/`"Meses"` quirk, determinism, and real-dataset
      invariants — all 214 places classify without throwing, exact category counts, every
      bare-magnitude place has a valid magnitude, every opaque place has none, raw text preserved
      verbatim for all 214); 16 in `lib/reservation-planning.test.ts` (omission/inclusion rules,
      mixed-list counts, order preservation and reordering, removal, no deduplication invented, no
      sorting, and full-dataset aggregation totals); 8 new source-scanning integration tests added
      to `components/OrderedSequenceBuilder.test.ts` (10 pre-existing Phase 3D-B tests untouched,
      18 total in that file now), scoped to the new section's own function body (never a
      whole-file scan), asserting the wiring, both signal kinds render, raw evidence always
      renders, and no `startDate`/day-date/booking-deadline wording ever appears in that section.
- [x] **Manual QA in a real browser** (`npm run dev` + Playwright) against three real places
      chosen programmatically to represent each category: Shibuya Crossing (`JP-001`, `"—"`,
      not-applicable) correctly produces no preparation item; Yabiji coral reef (`JP-191`,
      `"Semanas"`, bare-magnitude) shows "Anticipación registrada: semanas" and `Dato: «Semanas»`;
      Nintendo Museum (`JP-097`, `"Lotería 3 meses antes; revisar liberaciones"`, opaque) shows
      "Mecanismo específico; revisar" and the raw text verbatim. Reordering the route (moving
      Nintendo Museum to the top) changed the section's display order to match while leaving both
      facts' content unchanged — confirming order is route-derived, not resorted.
- [x] **No date/time intelligence of any kind.** No booking deadlines, no days-remaining
      calculation, no reference to today's date, `Date.now()`, or the user's timezone, no
      `startDate`/day-date arithmetic, no lottery/release-date interpretation, no availability
      claim, no automation (nothing books, opens a reservation flow, reorders the route, or sends
      a reminder).
- [x] **Corrective review**: three real defects found and fixed, none touching the dataset or
      widening scope. (1) The original regex-parity test only proved
      `scripts/temporal_data_lib.py`'s `_BARE_MAGNITUDE_RE` pattern text starts with `^` and ends
      with `$` — true, but it could not have caught a Python-side change to the accepted language
      itself (dropping `"Días/semanas"` support, adding a new form, changing numeric-range syntax)
      as long as the anchors stayed. `reservation-lead-time.test.ts` now extracts the actual
      pattern text and constructs a real `RegExp` from it (valid directly — the pattern uses only
      character classes, alternation, and `?`/anchors), then cross-checks that regex's verdict
      against `interpretLeadTimeText()` over a 20-entry accept/reject corpus, bidirectionally, so
      *any* future divergence in accepted language fails a test, not just an anchoring drift. (2)
      `buildReservationPreparationSummary()` had no defined behavior for a duplicate `place.id` in
      its input, and its own test asserted the opposite of the aggregation contract's "no place is
      duplicated" invariant (two items from one duplicated place, framed as intentional). Fixed to
      fail loud: a repeated id now throws immediately, naming the exact duplicate — since the
      canonical route is supposed to be duplicate-free already, silently keeping or dropping a
      copy would have hidden an upstream regression instead of surfacing it. A valid,
      duplicate-free route's behavior is unaffected. (3) The "N con anticipación registrada"
      summary phrase incorrectly appended a pluralizing "s" onto "registrada" when the count
      exceeded one — "anticipación" itself never pluralizes, so the adjective agreeing with it
      must not either; fixed to a single invariant phrase for every count, with a source-scanning
      regression test guarding the literal string. Test counts after this pass: 42 in
      `lib/reservation-lead-time.test.ts` (was 38), 18 in `lib/reservation-planning.test.ts` (was
      16), 19 in `components/OrderedSequenceBuilder.test.ts` (was 18) — **505 tests passing**
      overall (was 498), `npm run lint`/`npm run build`/`python3
      scripts/test_temporal_data_audit.py` all still clean. No dataset, `package.json`, lockfile,
      planning-draft schema, or `localStorage` key changed; no Phase 3D-E work started.

`data/places.json`, `app/src/data/places.json`, the workbook, `seasonal-alerts.json`, every
logistics/access-point/walking/transit artifact, `package.json`, the lockfile, the
`ManualPlanningDraftV2` schema, `nihon.manualPlanningDraft`'s stored shape, `nihon.savedPlaceIds`,
and the Filters union are all unchanged; no dependency was added, no new `localStorage` key was
introduced, and `PlaceDetail.tsx` was not touched (Phase 3D-C's existing raw-text-only leadTime
display there is untouched and still the only per-place surface — this phase's new signal lives
in the route-wide planning surface only, not duplicated per place). No Phase 3D-E (or any later
phase) work was started.

## Phase 3D-E — Recorded Hours Signals — complete

Turns the already-audited `schedule.hours` free text into a conservative runtime planning signal,
given a place the user already selected. It does **not** implement an opening-hours feasibility
solver: it never answers "will this place be open when I arrive," "can I visit this on Day 2," "go
here at 14:00," "this closes before your visit ends," "this day works," or "move this place to
Tuesday." Its narrower question: given a place the user already selected, what kind of
recorded-hours information can Nihon safely state from the existing static `schedule.hours` field?

- [x] **`app/src/lib/recorded-hours.ts`** — a new, small, pure domain module, deliberately separate
      from `lib/temporal-availability.ts` (which owns `schedule.closures` semantics from Phase
      3D-B). `classifyHoursCategory()` is a direct TypeScript port of
      `scripts/temporal_data_lib.py`'s `classify_hours()`: the same 14 category names, the same
      SAFE/PARTIAL/OPAQUE/UNKNOWN tier per category (`HOURS_TIER`), and — critically — the same
      fixed priority order of checks (`HOURS_RULES`). Classifies against `normalizeText(raw)` (NFD
      accent stripping + lowercasing), the same technique `temporal-availability.ts` and
      `reservation.ts` already established, rather than porting Python's `s[eé]g[uú]n`-style
      accented character classes verbatim. This is an equivalence over the canonical dataset and
      its expected Spanish variants — generic NFD stripping is technically a broader accept set
      than an explicit accented character class, not a formal proof the two regex engines accept
      identical languages — proven by classification-outcome parity tests, not a character-class
      comparison.
- [x] **Priority order is preserved exactly, proven with the adversarial examples that motivate
      it.** `"Abierto 24 h; puede cerrar por viento"` and `"Estación 24 h; comercios variables"`
      both classify `known-24h-with-caveat` (PARTIAL), never plain `known-24h` (SAFE) — a 24h
      baseline plus an unresolved weather/variability caveat is not a SAFE fact just because "24 h"
      appears first. `"Según tienda, aprox. 11:00–20:00"` classifies
      `third-party-operator-dependent` (OPAQUE), never `fixed-interval-clean`, even though it
      contains a clock-shaped substring — the third-party check runs before the fixed-interval
      check in both languages. `"Ferry estacional y meteorológico"` classifies
      `weather-or-tide-dependent`, not `seasonal-variable`, despite containing "estacional" —
      weather/tide is checked first. A genuinely unrelated `"Estación 24 h"` (train station) does
      **not** false-positive into a seasonal caveat, since "estación" and "estacional" are
      different substrings. All proven with dedicated adversarial-priority tests in
      `recorded-hours.test.ts`, not just asserted in prose.
- [x] **`RecordedHoursFact`** — a closed, kind-tagged union (`"recorded-24h"`,
      `"recorded-interval"`, `"conditional"`, `"external-dependency"`, `"unknown"`) so a consumer
      cannot accidentally confuse a SAFE recorded fact with a PARTIAL/OPAQUE/UNKNOWN one. Only
      `"recorded-interval"` (the `fixed-interval-clean` category) ever carries an `intervalRaw`
      field — the matched clock-interval token (e.g. `"09:00–20:00"`) preserved as a raw string,
      never minutes-since-midnight, a `Date`, or any other arithmetic-ready form. Every other kind
      that might contain a clock-looking substring (`"conditional"`, `"external-dependency"`) never
      exposes one — proven by dedicated safe-interval-extraction tests, including the exact
      adversarial cases the phase brief named (`"Según tienda, aprox. 11:00–20:00"`,
      `"10:00–17:00 aprox.; verificar exposición"`, `"09:00–16:00/17:30 según temporada"` all
      produce no `intervalRaw`). `raw` is carried on every variant, verbatim, per the Phase 3D-A
      contract's rule 1.
- [x] **`app/src/lib/hours-planning.ts`** — a small pure aggregation,
      `buildRecordedHoursSummary(places)`, over the current canonical route. Unlike
      `reservation-planning.ts`, **no place is ever omitted**: every route place has hours
      information relevant to planning, even when the honest signal is "variable," "depends on an
      outside operator," or "unknown" — so `items` always has exactly one entry per input place.
      Preserves the caller's exact route order — never resorted by opening time, closing time,
      tier, category, "urgency," duration, or reservation state; no scoring, no optimization. A
      duplicate `place.id` in the input throws immediately, naming the exact duplicate — the same
      fail-loud convention `reservation-planning.ts` established, protecting against a silently
      hidden upstream route-invariant regression rather than repairing it.
- [x] **UI**: `OrderedSequenceBuilder.tsx`'s "Construir recorrido" view gained one more route-wide,
      read-only section — "Horarios registrados" — rendered next to "Reservas por preparar" for the
      same reason: the signal is useful before the route is split into days, and it reads no
      `startDate`, no derived day date, no `place.schedule.closures`, no `place.bestTime`, and no
      `place.febMar2027`. A summary line (`"N claros · M con condiciones · K con dependencia
      externa · J por revisar"`) is followed by one entry per route place naming its recorded-hours
      signal and the original raw `schedule.hours` text verbatim. **`"con dependencia externa"` is
      deliberately neutral over BOTH OPAQUE categories `externalDependencyCount` combines
      (`weather-or-tide-dependent` and `third-party-operator-dependent`) — a corrective fix caught
      the original wording, "N depende de un tercero," being semantically false for a
      weather/tide-dependent place (no third party is involved at all); the neutral phrase is
      correct for either, while each place's own per-item label stays category-specific
      ("Horario depende de clima o marea; revisar" vs. "Horario depende de un operador externo;
      revisar").** Wording is deliberately narrow throughout: `"Horario registrado: 09:00–17:00"`
      states a recorded fact, never that the place is open at those hours on any date; every
      PARTIAL/OPAQUE/UNKNOWN phrase ends in "revisar," a call to double-check, never "closed,"
      "incompatible," or "bad." A standing disclaimer states
      plainly that the section describes only what is recorded, never whether a place opens or
      closes on the user's date, and does not check holidays or closures.
- [x] **`bestTime`, `schedule.closures`, and `febMar2027` all stay out of this domain and this
      section**, exactly as Phase 3D-A's contract requires: no composition of an hours fact with a
      closure fact, a `febMar2027` status, or a `bestTime` recommendation into a stronger claim like
      "open," "available," "compatible," or "this day works." Protected by source-scanning
      regression tests on both the domain module and the UI section.
- [x] **Real-dataset counts re-derived, not copied from documentation**: SAFE 80/214, PARTIAL
      50/214, OPAQUE 19/214, UNKNOWN 65/214 — matching Phase 3D-A's original audit exactly,
      independently reproduced here by both a Python audit re-run
      (`python3 scripts/audit-temporal-data.py data`) and new TypeScript tests against
      `data/places.json` (via `app/src/data/places.json`, still byte-identical). Route-level
      aggregation over the full dataset yields exactly 214 summary items — every place included,
      none omitted — with the same 80/50/19/65 split by tier.
- [x] **No opening-hours feasibility vocabulary anywhere.** Neither the domain module nor the UI
      section contains an outcome named `open`, `closed`, `available`, `unavailable`, `feasible`,
      `infeasible`, `compatible`, `incompatible`, `fits`, `does-not-fit`, `valid-day`,
      `invalid-day`, or `best-time` — protected by source-scanning regression tests against the
      forbidden vocabulary, on both the domain module and the rendered UI section.
- [x] **No automation.** Nothing assigns visit times, moves places between days, reorders the
      route, suggests an optimized order, recommends a different date, removes a place, ranks
      places, computes a route score, generates an itinerary, books anything, or creates reminders.
- [x] **86 new tests relative to the 505-test Phase 3D-D baseline**: 54 in
      `lib/recorded-hours.test.ts` (SAFE/PARTIAL/OPAQUE/UNKNOWN category coverage, the exact
      adversarial priority-order examples above, safe-interval-extraction isolation, the Python
      `HOURS_TIER`/`HOURS_RULES` source-check parity tests, determinism, and real-dataset
      invariants — all 214 places classify without throwing, exact tier totals, `intervalRaw`
      always a substring of `raw`, never present outside `"recorded-interval"`); 19 in
      `lib/hours-planning.test.ts` (per-tier counts, order preservation and reordering,
      duplicate-id fail-loud behavior naming the exact id, no omission by tier, no sorting, full
      real-dataset aggregation totals: 214 items, 80/50/19/65); 13 new source-scanning integration
      tests added to `components/OrderedSequenceBuilder.test.ts` (19 pre-existing Phase
      3D-B/3D-D tests unchanged, 32 total in that file now), scoped to the new section's own
      function body, asserting the wiring, every tier's wording renders distinctly, raw evidence
      always renders, no `startDate`/day-date/`Date.now` read, no `schedule.closures`/`bestTime`/
      `febMar2027` read, and no open/closed/feasibility vocabulary anywhere in the section
      (including the corrective-review "un tercero" wording regression — see that entry below).
      **591 tests passing overall** (was 505), `npm run lint`/`npm run build`/
      `python3 scripts/test_temporal_data_audit.py` all still clean.
- [x] **Manual QA in a real browser** (`npm run dev` + Playwright) against five real places chosen
      programmatically to represent each category: Takeshita Street (`JP-004`,
      `"Tiendas aprox. 10:00–20:00"`, `fixed-interval-clean`) correctly shows
      "Horario registrado: 10:00–20:00" with the "Tiendas aprox." prefix stripped; Shibuya Crossing
      (`JP-001`, `"Espacio público 24 h"`, `known-24h`) shows "Acceso registrado: 24 h" distinctly
      from the interval wording; Tokyo Station Marunouchi Building (`JP-030`,
      `"Estación 24 h; comercios variables"`, `known-24h-with-caveat`) shows
      "Acceso 24 h registrado con condiciones; revisar," never plain "24 h"; Omoide Yokocho
      (`JP-014`, `"Según local, tarde–noche"`, `third-party-operator-dependent`) shows
      "Horario depende de un operador externo; revisar" with no parsed interval; SHIBUYA SKY
      (`JP-002`, `"Variable por fecha"`, `explicit-unknown-variable`) shows
      "Horario variable; revisar dato original." The summary line read "2 claros · 1 con
      condiciones · 1 con dependencia externa · 1 por revisar," matching the five places' tiers
      exactly. Reordering the route (moving SHIBUYA SKY to the top via its own reorder button)
      changed the section's display order to match while every place's rendered signal text stayed
      byte-identical — confirming order is route-derived, never resorted by tier. The section
      rendered correctly with no calendar/start date set at all, confirming it works before day
      assignment and without any date.
- [x] **No date/time intelligence of any kind.** No clock time, timezone, visit start time, arrival
      or departure time, per-place time slot, morning/afternoon assignment, visit-duration-fit
      calculation, opening/closing arithmetic, overnight interval or day-rollover handling, or
      schedule-collision detection. No date comparison: nothing here reads `startDate`, a derived
      day date, `addCivilDays()`, or `getCivilWeekday()`.
- [x] **Corrective review**: one real defect found and fixed, not touching the dataset or widening
      scope. `buildRecordedHoursSummary()`'s `externalDependencyCount` intentionally combines both
      OPAQUE categories (`weather-or-tide-dependent` and `third-party-operator-dependent` — that
      aggregation itself is correct and unchanged), but `HoursPlanningSection`'s route-summary line
      rendered that combined count as `"N depende(n) de un tercero"` — semantically false for a
      route containing only a weather/tide-dependent place, since no third party is involved at
      all. Fixed by changing only the summary phrase to the neutral `"N con dependencia externa"`,
      correct for either OPAQUE category; the per-item labels were already, and remain,
      category-specific (`"Horario depende de clima o marea; revisar"` vs. `"Horario depende de un
      operador externo; revisar"`) and were never part of the defect. A new aggregation-level test
      in `lib/hours-planning.test.ts` pins down that a weather-only route and a third-party-only
      route both produce the same `externalDependencyCount` shape that made the old wording wrong,
      and the existing source-scanning wording test in `components/OrderedSequenceBuilder.test.ts`
      now additionally asserts the section never contains the literal string `"un tercero"`. A
      focused browser QA re-verification against one weather-or-tide-dependent place (Tomogashima,
      `JP-146`, `"Ferry estacional y meteorológico"`) and one third-party-operator-dependent place
      (Omoide Yokocho, `JP-014`, `"Según local, tarde–noche"`) together confirmed the route-summary
      line now reads truthfully for both — see the manual-QA bullet above, updated to match. Test
      counts after this pass: 19 in `lib/hours-planning.test.ts` (was 18), 32 in
      `components/OrderedSequenceBuilder.test.ts` (was 31) — **591 tests passing** overall (was
      589), `npm run lint`/`npm run build`/`python3 scripts/test_temporal_data_audit.py` all still
      clean. No dataset, `package.json`, lockfile, planning-draft schema, or `localStorage` key
      changed; no Phase 3D-F work was started.

`data/places.json`, `app/src/data/places.json`, the workbook, `seasonal-alerts.json`, every
logistics/access-point/walking/transit artifact, `package.json`, the lockfile, the
`ManualPlanningDraftV2` schema, `nihon.manualPlanningDraft`'s stored shape, `nihon.savedPlaceIds`,
and the Filters union are all unchanged; no dependency was added, no new `localStorage` key was
introduced, and `PlaceDetail.tsx` was not touched (its existing raw-text-only `schedule.hours`
display there is untouched and still the only per-place surface — this phase's new signal lives in
the route-wide planning surface only, not duplicated per place). No Phase 3D-F (or any later phase)
work was started.

## Phase 3D-F — Feb–Mar 2027 Status Signals — complete

Turns the already-audited `febMar2027.status` field into a conservative runtime confidence/review
signal, and replaces `PlaceDetail.tsx`'s old, independently-regexing `alertSeverity()` with it. This
is a semantics/correctness phase: the existing per-place February–March 2027 card is corrected and
formalized, not redesigned. It does **not** solve opening hours, does not combine status with
`schedule.hours`/`schedule.closures`/`bestTime`, does not infer that a particular day works, does
not determine that a place is actually open or closed, and performs no live verification.

- [x] **`app/src/lib/feb-mar-status.ts`** — a new, small, pure domain module.
      `classifyFebMarStatusCategory()` is a direct TypeScript port of
      `scripts/temporal_data_lib.py`'s `classify_feb_mar_status()`: the same 12 category names, the
      same `FEB_MAR_STATUS_TIER` tier-per-category mapping, and the same fixed priority order of
      checks. Unlike `recorded-hours.ts`/`temporal-availability.ts`, this port needs no
      `normalizeText` accent-stripping step at all — the Python classifier itself upper-cases the
      whole string and does plain ASCII substring checks (`"RIESGO"`, `"CONFIRMADO"`,
      `"PENDIENTE"`, ...), so `.trim().toUpperCase()` + `.includes()` is an exact match, not an
      approximation.
- [x] **Priority order preserved exactly**, proven both by adversarial examples and a structural
      check: a source-scanning test extracts the literal sequence of `return "<category>"`
      statements from both `classify_feb_mar_status()`'s and `classifyFebMarStatusCategory()`'s
      source text and asserts they are identical in order — so a future edit that reorders either
      side's `if`-chain fails immediately, not just when an adversarial example happens to exercise
      the swapped pair. Adversarial cases covered: a sale/lottery marker outranks a `"PENDIENTE"`
      token in the same string; `"RIESGO"` outranks a `"CONFIRMADO"` token appearing later;
      `"MANTENIMIENTO"`/`"CIERRE PARCIAL"` each outrank a bare `"PENDIENTE"`; a historical-pattern
      marker (both `"PATR"` and `"HIST"` present) outranks `"OPORTUNIDAD"`; `"CONFIRMADO"` plus
      `"PENDIENTE"` together is **not** `confirmed` — `pending-verification` wins that combination,
      exactly as `docs/TEMPORAL_DATA_CONTRACT.md` describes; a bare `"ABIERTO"` prefix with no other
      marker is `open-with-condition`, never `confirmed`; a mid-string (non-leading) `"ABIERTO"`
      does not trigger `open-with-condition` at all (`text.startsWith`, not `text.includes`).
- [x] **`FebMarStatusFact`** — `{ category, tier, raw }`, no more and no less. `raw` is preserved
      verbatim. **No `open`/`closed`/`available`/`feasible` field exists anywhere in this type or
      in `FebMarStatusDisplay`** — proven by a dedicated test asserting no boolean field exists on
      any produced fact, for every representative category.
- [x] **Never reads `febMar2027.warning` or `febMar2027.action`.** `classifyFebMarStatusCategory()`
      takes a single `raw: string` parameter — structurally incapable of consulting either field —
      and a source-scanning test additionally confirms neither `.warning` nor `.action` appears
      anywhere in the module's actual code (comments legitimately mention both, to document that
      they are never read; the scan strips comments first so it cannot false-pass on that
      distinction going the other way, nor false-fail on the prose). A behavioral test mutates a
      real place's `warning`/`action` to unrelated text and confirms the classification is
      byte-identical. Reads no `schedule.hours`, `schedule.closures`, `bestTime`, `reservation.*`,
      `startDate`, derived day date, or current date/time either; no network requests; no `Date`
      arithmetic; no timezone logic.
- [x] **`describeFebMarStatusForUi(fact)`** — the display adapter `PlaceDetail.tsx`'s existing card
      needs, following the same precedent `lib/reservation.ts`'s `describeReservationForUi` already
      set (classification and its display adapter in one small module, rather than a second
      `*-display.ts` file, since the display surface is one card in one component). Derives a
      three-value `tone` (`"confirmed"` | `"attention"` | `"pending"`) from `tier` alone — never
      from `category` directly, so no single category can drift from its tier's meaning:
      **`safe` → `confirmed`, `partial` → `attention`, `opaque` → `attention`, `unknown` →
      `pending`.** The label is deliberately generic per tone, never per category — `"Requiere
      atención"` for `attention`, the same neutral phrasing (never the word "riesgo"/"risk") the
      card's old severity label already used, so a `seasonal-opportunity` status (OPAQUE, tone
      `attention`) is never described as a risk. `cssModifier` (`"confirmed"` | `"risk"` |
      `"pending"`) is an **adapter reusing the card's three pre-existing `.alert--<modifier>` CSS
      classes** — no new palette introduced, no unrelated CSS churn — the same "reuse an existing
      class as an implementation detail" technique `lib/reservation.ts`'s `tag.className` already
      established.
- [x] **`PlaceDetail.tsx`** now computes
      `describeFebMarStatusForUi(interpretPlaceFebMarStatus(place))` once and renders the card's
      icon/label/CSS modifier from that structured output — replacing the old
      `alertSeverity(place.febMar2027.status)` regex heuristic (`/riesgo|cerrad|cierre|cupo|loteria|
      venta futura/`) entirely. The card's visible content is otherwise untouched: `status`,
      `warning`, and `action` still render exactly as before, verbatim, as human-facing editorial
      prose — neither is parsed or used as rule-engine input anywhere in this phase. The component
      was not otherwise redesigned.
- [x] **Legacy `alertSeverity`/`severityLabel`/`AlertSeverity` audited and removed, not left as a
      second competing classifier.** A repo-wide grep confirmed `PlaceDetail.tsx` was their only
      consumer — no other component or module referenced any of the three — so all three were
      deleted cleanly from `lib/place.ts` rather than kept dormant or deprecated in place.
- [x] **No route-wide UI section added.** Repository evidence (this phase's own per-place scope, and
      the fact that `febMar2027` is a trip-window-confidence axis, not a route-composable fact — see
      `docs/TEMPORAL_DATA_CONTRACT.md` §5) did not justify one; the primary purpose here is
      correcting and formalizing the semantics of the existing per-place card. Whether trip-window
      confidence needs a separate route-wide planning surface is left for a future, separately
      decided phase.
- [x] **`data/seasonal-alerts.json` untouched, no join invented.** That 33-entry collection is keyed
      by `Hub` + free-text `"Lugar / tema"`, not by place id, and remains exactly as
      `docs/TEMPORAL_DATA_CONTRACT.md` §5 already documented it: exported, versioned, and unread by
      the application. This phase does not read it, join it, or change that.
- [x] **Real-dataset counts re-derived, not copied from documentation**: SAFE 6/214, PARTIAL 15/214,
      OPAQUE 41/214, UNKNOWN 152/214 — matching Phase 3D-A's original audit exactly, independently
      reproduced by new TypeScript tests against `data/places.json` (via `app/src/data/places.json`,
      still byte-identical) and confirmed against a fresh `python3
      scripts/audit-temporal-data.py data` run. All 214 places classify without throwing.
- [x] **55 new tests**: 48 in `lib/feb-mar-status.test.ts` (category/tier table-driven coverage,
      the adversarial priority-order examples above, the structural Python-source priority-order
      check, the Python `FEB_MAR_STATUS_TIER` source-check parity test, the warning/action
      non-consultation tests, determinism, real-dataset invariants — all 214 places classify
      without throwing, exact 6/15/41/152 tier totals, every fact's raw text matches
      `place.febMar2027.status` verbatim, a real `seasonal-opportunity` place's display never
      mentions "riesgo"/"risk", a real `pending-verification` place stays `pending` tone, a real
      `confirmed` place gets `confirmed` tone, and `describeFebMarStatusForUi`'s own tone/label/
      CSS-modifier mapping); 7 new source-scanning integration tests added to
      `components/PlaceDetail.test.ts` (5 pre-existing Phase 3D-C tests unchanged, 12 total in that
      file now), scoped to this component's own Feb–Mar-status expression/card markup, asserting
      the wiring, the old `alertSeverity`/`severityLabel`/`AlertSeverity` imports are gone, the card
      still renders raw `status`/`warning`/`action` verbatim, the display computation reads none of
      `schedule.hours`/`schedule.closures`/`bestTime`/`reservation`, and the card's own markup
      contains no open/closed/available/feasible vocabulary. **646 tests passing overall** (was
      591), `npm run lint`/`npm run build`/`python3 scripts/test_temporal_data_audit.py` all still
      clean.
- [x] **Manual QA in a real browser** (`npm run dev` + Playwright) against five real places chosen
      programmatically to represent `confirmed`, `open-with-condition`, `pending-verification`, an
      OPAQUE attention case, and `seasonal-opportunity`. The existing card rendered the raw
      `status`/`warning`/`action` text exactly as before in every case; the visual tone/label came
      from the new structured `describeFebMarStatusForUi` output rather than the old regex; the
      `seasonal-opportunity` place's card read "Requiere atención" — never "Riesgo" or any
      risk-implying word; the `pending-verification` place read "Por confirmar," honestly, never
      promoted to "Confirmado"; no card anywhere stated or implied that the place would actually be
      open on a specific date.
- [x] **No date/time intelligence of any kind.** No clock time, timezone, current-date read, `Date`
      arithmetic, `startDate`/day-date comparison, holiday handling, live verification against an
      official source, date recommendation, or automatic rescheduling.
- [x] **No automation.** Nothing assigns visit times, moves places between days, reorders the route,
      computes booking deadlines, checks holidays, calls an official website or API, or performs
      live verification.

`data/places.json`, `app/src/data/places.json`, the workbook, `seasonal-alerts.json`, every
logistics/access-point/walking/transit artifact, `package.json`, the lockfile, the
`ManualPlanningDraftV2` schema, `nihon.manualPlanningDraft`'s stored shape, `nihon.savedPlaceIds`,
route ordering/day assignment, and the Filters union are all unchanged; no dependency was added, no
new `localStorage` key was introduced, and `OrderedSequenceBuilder.tsx` was not touched (no
route-wide UI section was added this phase — see above). No opening-hours or availability solver of
any kind was implemented. No Phase 3D-G (or any later phase) work was started.

## Phase 3D-G — Reservation Deadline Design Gate — complete

Design/audit only — no runtime code, UI, or dataset changed. Decides whether, and how narrowly, a
safe booking-deadline feature could be built on top of Phase 3D-D's `ReservationLeadTimeFact`
without fabricating precision. Full contract, real-data audit, and rationale:
[`docs/RESERVATION_DEADLINE_DESIGN.md`](RESERVATION_DEADLINE_DESIGN.md).

- [x] **Re-derived the real `reservation.leadTime` inventory** (214 places, 66 distinct raw
      values; 128 `not-applicable` / 21 `bare-magnitude` / 65 `opaque-entity-or-mechanism-specific`
      — matching `docs/TEMPORAL_DATA_CONTRACT.md` exactly, independently reproduced, not copied)
      and partitioned the 21 `bare-magnitude` records into **four** computability classes: **A**
      (explicit numeric day/week range) 5 places, **B** (unit only, no quantity) 5 places, **C**
      (mixed unit, no quantity) 10 places, **D** (numeric month range) 1 place — `5+5+10+1 = 21`.
      **Class E is not a fifth `bare-magnitude` class**: it is the separate 65-place
      `opaque-entity-or-mechanism-specific` bucket, which never reaches `bare-magnitude` at all.
      Whole-dataset accounting is six-way: A 5 + B 5 + C 10 + D 1 + E 65 + `not-applicable` 128
      = 214.
- [x] **Executive decision: only Class A (5/214 places) can safely support a deterministic date
      window** — everything else must stay a non-computable, manual-review signal, permanently for
      B/C/E and pending further evidence for D (a single record does not justify building
      calendar-month clamping machinery).
- [x] **Visit-date source contract**: a range derivation requires BOTH an unambiguous day
      assignment (`DayAssignment.valid === true`, from `day-assignment.ts`) AND a valid `startDate`
      — `visitDate = addCivilDays(startDate, dayIndex)`, reusing the arithmetic expression
      `OrderedSequenceBuilder.tsx` already uses for the weekday-closure signal. The
      `valid === true` prerequisite is a **new rule introduced by this design**, not inherited:
      the existing UI computes and renders per-day dates even while showing its invalid-assignment
      warning, so the helper is reused but the validity guard is not. `startDate` alone is
      explicitly rejected as a proxy visit date for an unassigned place.
- [x] **Numeric/month/OPAQUE semantics decided**: the unit conversion 1 week = 7 days is exact,
      but the underlying editorial guidance ("1–2 semanas") stays approximate — converting the
      unit exactly does not turn coarse guidance into day-level booking policy, which is why the
      terminology discipline is load-bearing. Months are refused for a first implementation rather
      than approximated. An OPAQUE record's numeric-looking substring (e.g. a lottery's "3 meses
      antes") is never re-scanned once Phase 3D-D has classified it opaque: classification first,
      numeric parsing second, and only for the eligible `coarse-magnitude` category.
- [x] **Neutral calendar-edge naming, replacing false booking semantics**: the two derived edges
      are `farAdvanceDate`/`nearAdvanceDate` — named for distance from the visit date, never
      `earliestDate`/`latestDate`. `farAdvanceDate` is **not** "the earliest date booking is
      allowed" (booking earlier may be possible and preferable) and `nearAdvanceDate` is **not** a
      guaranteed last booking date; neither edge implies inventory availability.
- [x] **`febMar2027` cross-axis contract — orthogonal, composed only at presentation**: Feb–Mar
      operating-calendar confidence is a separate axis from lead-time computability and is **not**
      an input to the parser or a prerequisite for computability — a Class A lead time stays
      computable when the Feb–Mar status is pending. Where both are shown, the derived range must
      be subordinate to the pending-status warning, must say the calendar/conditions still need
      reconfirmation, and must never read as evidence the visit itself is confirmed. Documented
      with the three currently-affected Class A places (`JP-019`, `JP-034`, `JP-095` — 3 of 5).
- [x] **Reservation-level eligibility, not a digit parser**: a numerically clean `leadTime` must
      not override reservation-level semantics indicating a specific mechanism or an
      uninterpretable record. Gates on the existing `interpretPlaceReservation` categories
      (`tier`/`consistentWithDerivedBoolean`), reusing the existing interpreter rather than adding
      a competing one, and explicitly never on literal `reservation.raw` values.
- [x] **Current-date/urgency explicitly deferred**: a first implementation should compute a window
      relative to a visit date only, never "today" — no "book now"/"deadline passed"/"days
      remaining" claims, consistent with every prior Phase 3D module never calling `Date.now()`.
- [x] **Illustrative future domain model, UI placement (extend "Reservas por preparar" and the day
      view, not a new surface), failure/unknown-state table, a separate presentation-state table,
      and a full test strategy** — all documented, none implemented.
- [x] **Two states recorded as explicit non-problems**: "assignment outside trip bounds" is not
      representable (the planning draft has no trip end date, and none is being added), and a
      dataset lead-time edit cannot strand a stale derived range (the range is derived on read and
      never persisted).
- [x] **Recommends, but does not schedule, a narrow future Phase 3D-H** (Class A only, no months,
      no urgency) as the smallest safe next step.

No `data/places.json`, `app/src/data/places.json`, workbook, `seasonal-alerts.json`, `package.json`,
lockfile, test, or runtime source file was changed by this phase — see
`docs/RESERVATION_DEADLINE_DESIGN.md` for the full contract. No Phase 3D-H (or any later phase)
work was started.

## Phase 3D-H — Explicit Lead-Time Window (Class A only) — complete

Implements the design gate `docs/RESERVATION_DEADLINE_DESIGN.md` (Phase 3D-G), narrowly: only the
Class A evidence class (an explicit numeric range over a single, non-mixed day/week unit) may ever
produce a derived advance-notice window. Every other evidence class stays exactly the non-computable
signal Phase 3D-D/the design gate already decided — no new arithmetic, no fabricated precision.

- [x] **New pure domain module, `app/src/lib/reservation-deadline.ts`.** Reuses
      `reservation-lead-time.ts`'s `interpretLeadTimeText` as the sole classifier — never
      reimplements or loosens it — and adds a second, narrower numeric-extraction pass gated
      strictly behind the `coarse-magnitude` category. Safety order matches the design gate exactly:
      `not-applicable` and `specific-mechanism` return immediately, before any numeric parsing; a
      `specific-mechanism` record's `raw` text is never re-scanned for digits, proven both by
      adversarial unit tests (`"Lotería 3 meses antes; revisar liberaciones"` stays
      `not-computable`/`specific-mechanism`) and a structural test.
- [x] **`ReservationDeadlineSignal`** — a closed union: `not-applicable`; `not-computable` with an
      explicit `reason` (`specific-mechanism` / `unit-without-quantity` / `unusable-numeric-range` /
      `mixed-unit-without-quantity` / `month-range-not-supported`); or `explicit-lead-window`
      (`minLeadDays`, `maxLeadDays`, `raw`) for Class A only. A mixed unit (`"Días/semanas"`) is
      always `mixed-unit-without-quantity` regardless of whether a quantity is present — which unit
      a count would apply to is inherently ambiguous — and a month unit is always
      `month-range-not-supported`, matching the design gate's explicit refusal to add
      `addCivilMonths` or any fixed-day month approximation for a single real record. Week-to-day
      conversion is exactly `1 week = 7 days`. **Corrective pass (independent audit finding
      MINOR-2):** a numeric range that matched the explicit-range shape but cannot become an
      ordered positive pair of safe-integer day bounds — reversed (`"4–2 semanas"`), zero/
      non-positive (`"0–2 semanas"`, `"2–0 semanas"`), or beyond `Number.MAX_SAFE_INTEGER` either
      before or after the ×7 week conversion — now classifies as its own `unusable-numeric-range`
      reason, never `unit-without-quantity` (that reason would falsely say no quantity was
      recorded about text that plainly contains one). None of these shapes occur in the real
      dataset; a degenerate but positive equal range (`"2–2 semanas"`) still classifies as a
      computable `explicit-lead-window`, since it is one exact recorded quantity, not a
      contradiction. The implementation is unit-general by design (tested with synthetic `"X–Y
      días"` fixtures), even though the real dataset's 5 Class A places are all `"semanas"` today.
- [x] **Reservation-level eligibility (§10.4), not a digit parser.** A numerically clean `leadTime`
      never overrides reservation-level semantics: `isReservationEligibleForDeadlineWindow` gates on
      `interpretPlaceReservation`'s existing `tier !== "unknown"` and
      `consistentWithDerivedBoolean === true`, reusing the existing interpreter rather than adding a
      second reservation parser and never matching on literal `reservation.raw` strings. Pinned by
      synthetic fixtures (an unknown-tier record, an internally-inconsistent record, and a clean
      record), never on the dataset's current `"Sí"`/`"Recomendable"` values.
- [x] **Visit-date contract (§5), deliberately stricter than the existing per-day date.**
      `deriveVisitDateForPlace(dayAssignment, startDate, placeId)` requires
      `DayAssignment.valid === true` — not just a valid `startDate` — before returning a visit date,
      unlike `OrderedSequenceBuilder.tsx`'s pre-existing `dayDate` (line ~1058), which is computed
      unconditionally regardless of assignment validity. An invalid assignment yields `null` for
      every place, never a partial reading. Pinned by tests covering every `DayAssignmentIssue`
      shape, a missing/invalid `startDate`, Día 1 vs. Día N, an empty day bucket ahead of a place's
      day, and a place absent from every bucket.
- [x] **`ReservationDateWindow`** — `no-visit-date` / `no-window` (carrying the underlying signal) /
      `derived-window` (`visitDate`, `farAdvanceDate`, `nearAdvanceDate`, `signal`).
      `farAdvanceDate`/`nearAdvanceDate` are named for distance from the visit date, never
      `earliestDate`/`latestDate`/`opensAt`/`closesAt` — matching the design gate's naming
      discipline exactly. Date arithmetic reuses `civil-date.ts#addCivilDays`; a `null` result
      (an already-invalid `visitDate`) falls back to `no-visit-date` rather than a guessed date.
      **Corrective pass (independent audit finding MINOR-1):** for an extreme (but already
      safe-integer-bounded) `minLeadDays`/`maxLeadDays`, `addCivilDays` can overflow JS `Date`'s
      representable range and return a syntactically string-shaped but semantically invalid result
      (containing `NaN` components) instead of `null` — the consumer boundary now also requires
      `isValidCivilDate(...)` on both derived dates before returning `derived-window`, so a
      malformed date string can never reach a caller labeled `derived-window`; this does not touch
      `civil-date.ts` itself. Tested across a month boundary, a year boundary, a leap-year
      February, an oversized-range date-overflow case, plus a real-dataset invariant that every
      Class A place's `farAdvanceDate <= nearAdvanceDate < visitDate`.
- [x] **`febMar2027` orthogonality (§6.2), structural, not just a convention.**
      `reservation-deadline.ts` never imports `feb-mar-status.ts`, never reads `place.febMar2027` in
      any form, and never accepts a Feb–Mar status argument — proven by a comment-stripped
      source-scan and a behavioral test: two synthetic places with identical reservation data but
      different `febMar2027.status` produce byte-identical `ReservationDateWindow` results. A real
      Feb–Mar-pending Class A place (`JP-019`) still yields `derived-window` with real values — the
      domain computation is never suppressed by pending calendar status (Rule 3).
- [x] **UI: `OrderedSequenceBuilder.tsx`'s existing day view, next to `WeekdayClosureNotice` —
      no new surface, `PlaceDetail.tsx` untouched.** A new `ReservationDeadlineNotice` renders one
      entry per place in a day bucket that has both a valid visit date and an eligible Class A
      signal; every other place (no visit date yet, or a non-Class-A/opaque record) is simply absent
      — the existing "Reservas por preparar" section already shows its coarse signal and is
      unchanged. **Corrective pass (independent audit finding MAJOR-1) — full non-`confirmed`
      Feb–Mar composition, not pending-only.** `describeFebMarStatusForUi`'s existing three-value
      `tone` is derived once per place and reused as-is — never a second classifier, never
      category-specific wording — and BOTH non-`confirmed` tones now render their own status
      callout FIRST, above the derived range, in both markup order and visual treatment, per the
      design gate's §12.1 row 3 ("some other caveat... compose the same way"): `tone === "pending"`
      (tier `unknown`) keeps the existing reconfirmation callout (warm "pending" palette, same as
      `.alert--pending`); `tone === "attention"` (tiers `partial`/`opaque` — e.g. seasonal risk,
      maintenance, a sale/lottery caveat) now renders a neutral caveat callout using
      `describeFebMarStatusForUi(...).label` (e.g. "Requiere atención") rather than inventing
      category-specific copy, reusing the same risk-soft palette the presentation adapter itself
      already maps that tone to (`.alert--risk`'s `cssModifier: "risk"`); `tone === "confirmed"`
      renders no extra callout. Neither callout implies closed/unavailable/dangerous/impossible/
      confirmed/deadline. Either callout is visually heavier (bold) than the plain-text range
      beneath it, so the range never reads as evidence the calendar is confirmed. The recorded raw
      `leadTime` text is always shown alongside the derived range, exactly like the existing
      reservation/hours sections. No real Class A place is currently `attention`-toned; the
      composition was verified with a synthetic fixture (both automated and manual QA), never by
      editing the real dataset.
- [x] **Conservative wording, no forbidden deadline/availability/urgency vocabulary.** "Ventana de
      anticipación registrada," never "fecha límite," "reserva antes de," "último día para
      reservar," "disponible desde," "se abre la reserva," "fecha de apertura," or "garantizado" —
      checked by a dedicated forbidden-phrase test scoped to the new component's own source.
- [x] **No current-date/urgency axis.** No `Date.now()`, no `daysRemaining`/`isLate`/`isUrgent`
      field anywhere in the new module or component, no "book now"/"deadline passed"/countdown/
      urgency-badge/reminder logic — checked structurally, mirroring `feb-mar-status.test.ts`'s own
      precedent for "no boolean field" checks.
- [x] **No month arithmetic.** No `addCivilMonths`, no fixed-30-day approximation, no calendar-month
      clamping — Class D (`"1–3 meses"`, 1 place) stays `month-range-not-supported`, unchanged from
      the design gate's decision.
- [x] **No persistence, schema, or dataset change.** `ManualPlanningDraftV2`, `nihon.
      manualPlanningDraft`'s stored shape, `nihon.savedPlaceIds`, `data/places.json`,
      `app/src/data/places.json`, the workbook, `seasonal-alerts.json`, `package.json`, and the
      lockfile are all unchanged. `ReservationDeadlineSignal`/`ReservationDateWindow`/derived visit
      dates are recomputed on every read, never written to storage — no new `localStorage` key.
- [x] **81 tests in this phase's two files**: 69 in `lib/reservation-deadline.test.ts` (the
      original 58 — evidence-class coverage for A–E including synthetic days-unit fixtures, the
      real-dataset partition re-derived and pinned as a regression — `5/5/10/1/65/128 = 214`,
      matching Phase 3D-G's audit exactly — reservation-level eligibility fixtures,
      date-application boundary tests, the visit-date contract's every branch, structural "no
      availability boolean" checks, and cross-axis orthogonality checks — plus 11 corrective tests
      for `unusable-numeric-range` and the date-overflow guard, covering a reversed range, a zero
      lower/upper bound, a zero-length range, an unsafe raw integer, bounds unsafe only after the
      ×7 conversion, a synthetic oversized signal proving `deriveReservationDateWindow` can never
      surface `NaN`, defense-in-depth over the extractor's own output, and a regression pinning the
      three real Class A values and the adversarial classification-order examples unchanged); 48 in
      `components/OrderedSequenceBuilder.test.ts` (32 pre-existing Phase 3D-B/D/E tests unchanged,
      12 original Phase 3D-H source-scanning tests, plus 4 net new/updated corrective tests proving
      the `attention` callout's markup precedence, its reuse of `describeFebMarStatusForUi(...)
      .label`, its avoidance of closed/unavailable/dangerous/confirmed/deadline language, that the
      tone/label is derived exactly once per place with no category-specific branching, and that a
      `confirmed` tone renders neither callout). **731 tests passing overall** (was 716 before this
      corrective pass, 646 before the original Phase 3D-H implementation), across 25 test files —
      `npm run lint`, `npx tsc -b`, and `npm run build` all clean; `git diff --check` clean.
- [x] **Manual QA in a real browser** (`npm run dev` + Playwright), seeding a saved route and
      manual planning draft directly via `localStorage` for determinism: Case 1 (a confirmed Class A
      place, `teamLab Borderless`/`JP-033`) showed a plain derived range with no callout; Case 2 (a
      Feb–Mar-pending Class A place, `Tokyo Skytree`/`JP-019`) showed the reconfirmation callout
      first, then the same range, never replaced or hidden; Case 3 (an opaque record, `Nintendo
      Museum`/`JP-097`, the real lottery-text place) showed no guessed range anywhere, only the
      existing "Mecanismo específico; revisar" signal with its raw text verbatim; Case 4 (start date
      cleared) showed no range at all while the rest of the day-planning UI stayed fully functional.
      **Corrective pass:** Case 5 (an `attention`-toned Class A place) was verified using a
      temporary, uncommitted local edit to `app/src/data/places.json` only for the QA session
      (`Mori Art Museum + Tokyo City View`/`JP-034`'s `febMar2027.status` set to a synthetic
      seasonal-risk value) — the attention callout rendered first, bold, in the risk-soft palette,
      the range still rendered in full beneath it, the raw `leadTime` text stayed visible, and
      nothing implied confirmed operation; the fixture was reverted byte-for-byte before committing
      (confirmed via `git status`/`git diff`, both clean on that file) — no dataset edit is part of
      this phase's committed change. Verified at both desktop (1280px) and narrow/mobile (390px)
      widths with no layout breakage, including with the attention callout present.

No `data/places.json`, `app/src/data/places.json`, workbook, `seasonal-alerts.json`, `package.json`,
lockfile, `ManualPlanningDraftV2` schema, or `nihon.manualPlanningDraft`/`nihon.savedPlaceIds` stored
shape was changed by this phase. `PlaceDetail.tsx` was not touched. No current-date/urgency logic,
no month-range arithmetic, and no availability/bookable claim of any kind was implemented. No Phase
3D-H design-document edit was needed — no contradiction in `docs/RESERVATION_DEADLINE_DESIGN.md`
surfaced during implementation. No Phase 3D-I (or any later phase) work was started.

### Corrective pass (independent adversarial audit)

An independent audit of the original implementation (`36ecc3d`) found one MAJOR and three MINOR
findings, all addressed in a follow-up commit on the same PR/branch, without touching classification
order, reservation-level eligibility, the visit-date contract, cross-axis orthogonality, or any of
the other findings the audit verified as correct:

- **MAJOR — Feb–Mar composition covered only `tone === "pending"`**, leaving the `attention` tone
  (56/214 places today, tiers `partial`/`opaque`) to render a derived range with no caveat at all,
  contradicting the design gate's §12.1 row 3. Fixed by deriving `describeFebMarStatusForUi`'s tone
  once per place and branching presentation on all three tones (`confirmed`/`attention`/`pending`).
- **MINOR — `addCivilDays` overflow could leak a malformed (`NaN`-containing) date as a
  `derived-window`.** Fixed by requiring `isValidCivilDate(...)` on both derived dates before
  returning `derived-window`, falling back to `no-visit-date` otherwise.
- **MINOR — a malformed numeric range (reversed, zero, or unsafe-integer) was mislabeled
  `unit-without-quantity`**, which is false when a quantity was plainly recorded. Fixed by adding a
  dedicated `unusable-numeric-range` reason, used only when a quantity was matched but could not
  become a usable ordered positive pair of safe-integer bounds.
- **MINOR — the malformed/unsafe-bounds branch had zero test coverage**, which is how the
  mislabeling above went unnoticed. Fixed by the 11 corrective tests described above.

No Phase 3D-G design-document edit was made or needed. No Phase 3D-I (or any later phase) work was
started by this corrective pass.

## Phase 3D-I — Opening-Hours & Closure Composition Design Gate — complete

**Design/audit only — zero runtime code, zero UI, zero dataset changes, zero schema/persistence
changes.** Decides whether, and exactly how, the already-audited `RecordedHoursFact` (Phase 3D-E)
and `ClosureFact` (Phase 3D-B) could ever be composed into a single per-day, per-place presentation
without ever asserting that a place is open, closed, compatible, available, or that a day "works" —
see `docs/OPENING_HOURS_CLOSURE_COMPOSITION_DESIGN.md` for the full contract. The word
"feasibility" is deliberately avoided throughout: this gate does not decide whether a place can
actually be visited.

- [x] **Executive decision: composition is safe, strictly confidence-preserving, never
      confidence-increasing.** A closed, four-class vocabulary (`jointly-presentable` /
      `present-with-caveat` / `keep-separate` / `not-composable`) derived by taking the **weaker**
      of the two facts' tiers (`safe`/`partial`/`opaque`/`unknown`, worst-tier-wins) — nothing
      composed here is ever a stronger claim than either input alone supports. The four tiers
      themselves are unchanged Phase 3D-A/3D-B/3D-E vocabulary; the worst-tier-wins ordering (in
      particular, ranking UNKNOWN weaker than OPAQUE for this purpose) is this gate's own new
      policy decision for composition, not something an earlier contract already declared.
      `keep-separate` and `not-composable` currently prescribe identical presentation behavior (no
      composed statement, existing sections unchanged) — they are kept as separate names for
      analytical/debugging clarity (an OPAQUE vs. an UNKNOWN axis are different reasons composition
      failed), not because a future implementation must treat them differently in the UI.
- [x] **Real-dataset cross-tab, re-derived against the live TypeScript classifiers** (not a
      Python approximation, not assumed): the full 4×4 `RecordedHoursFact.tier` ×
      `ClosureFact.tier` matrix over all 214 places sums to exactly 214 and its row/column totals
      match `docs/TEMPORAL_DATA_CONTRACT.md`'s independently-audited single-axis totals exactly.
      Composition-class populations: `jointly-presentable` 31, `present-with-caveat` 43,
      `keep-separate` 56, `not-composable` 84 — 74/214 places (35%) fall into one of the two
      composable classes, a real, non-trivial population.
- [x] **Load-bearing finding: `ClosureFact`'s `not-evaluable` kind is not a single tier.** One real
      record (`JP-019`, `"Sin cierre ordinario; clima"`, category
      `no-ordinary-closure-with-caveat`) has `kind: "not-evaluable"` but `tier: "partial"` — a
      future implementation must dispatch composition on `.tier`, never on `.kind`, or it would
      silently misclassify this record as opaque/unknown-equivalent.
- [x] **Provenance/confidence rule (load-bearing):** a SAFE fact on one axis must never dilute or
      launder a PARTIAL/OPAQUE caveat on the other. Pinned with two real records (`JP-030`, `JP-041`
      — both `known-24h-with-caveat` hours paired with SAFE `no-known-closure`) as the worked
      example of the risk: composing "24h + no known closure" naively could read as "generally
      accessible," which the recorded caveat ("comercios variables"/"shows variables") directly
      contradicts.
- [x] **Date prerequisite adopts Phase 3D-H's stricter visit-date contract** (`dayAssignment.valid
      === true`, not just a valid `startDate`, per-place day-bucket membership, and an
      `isValidCivilDate` guard on the derived date) over Phase 3D-B's looser existing `dayDate`
      contract — for the same reason Phase 3D-H gave for its own stricter guard: a composed
      statement is a stronger combined claim than either signal alone. No trip end date is
      invented; `ManualPlanningDraftV2` still has none.
- [x] **Duration-fit evaluated and explicitly refused for now.** 65 places have a SAFE recorded
      interval; 62 of those are numerically evaluable (both `duration.minMinutes`/`maxMinutes`
      populated) — **0 of those 62** show the recorded visit duration exceeding the recorded
      interval's span. The remaining 3 (`JP-121`, `JP-147`, `JP-211`) carry only a qualitative
      duration ("Medio día"/"Medio día–día completo"/"Día completo") and are not numerically
      evaluable at all — named explicitly rather than folded into the "0" result, since a full-day
      duration against a ~7.5–8h interval is exactly the shape most likely to produce a real
      mismatch if it could ever be checked. Building and testing interval-span-vs-duration
      arithmetic to serve zero *confirmed* real records would repeat the exact
      disproportionate-engineering pattern Phase 3D-G's own Class D decision (1 real record)
      already established a precedent for refusing, and inventing a numeric mapping for "Día
      completo" would itself fabricate a precision the recorded text never claims. This is a
      data-triggered revisit condition, not a scheduled one, and is not part of this gate's
      approved composition scope.
- [x] **Language contract**: permitted vocabulary stays exactly in the register already
      established by Phase 3D-B/3D-D/3D-H ("horario registrado," "posible coincidencia de cierre
      semanal," "información no evaluable," "conviene revisar"); forbidden vocabulary includes
      "abierto," "cerrado," "puedes ir," "este día funciona," "compatible," "disponible,"
      "garantizado," and "horario confirmado para tu visita," regardless of composition class.
- [x] **Explicit non-goals**, restated in full in the design document: no opening-hours solver, no
      `Date.now()`/current-time axis, no holiday/special-calendar handling, no live/temporary
      closure verification, no availability/capacity claim, no composition with reservation
      deadlines (Phase 3D-G/H stays fully separate), no composition with `bestTime` or
      `febMar2027` (both remain excluded per their own already-decided boundaries), no external
      API calls, and no runtime/UI/dataset/schema change of any kind in this phase.
- [x] **Illustrative domain-model sketch only** (`HoursClosureComposition`, `CompositionClass`) —
      no `.ts` file created, no `open`/`closed`/`feasible` boolean anywhere in the sketch, matching
      `docs/TEMPORAL_DATA_CONTRACT.md`'s own prior sketch precedent.
- [x] **Future UI surface, future test strategy, and future browser QA cases are documented as
      recommendations for a future implementing phase**, not executed or implemented here — there
      is no new runtime surface to test yet.

**This phase recommends, but does NOT schedule or approve, a future Phase 3D-J** implementing
exactly the `jointly-presentable`/`present-with-caveat` composition this gate decided is safe.
Phase 3D-J is not started, not scheduled, and not approved by this entry — only proposed, per this
codebase's own precedent (Phase 3D-G recommended but did not schedule Phase 3D-H).

**Known pre-existing documentation gap, not addressed by this phase:** `docs/DATA_MODEL.md` does
not currently mention Phase 3D-G or Phase 3D-H at all. This predates Phase 3D-I, is unrelated to
the hours/closures composition question this gate decides, and this phase does not fix it — recorded
here, and in the design document itself, so the gap is not lost.

No `data/places.json`, `app/src/data/places.json`, workbook, `seasonal-alerts.json`, `package.json`,
lockfile, any `.ts`/`.tsx`/`.css` file, or `docs/RESERVATION_DEADLINE_DESIGN.md` was changed by this
phase. No Phase 3D-J (or any later phase) work was started.

## Phase 3D-J — Hours / Closure Composition Implementation — complete

- [x] Added the pure, non-persisted `app/src/lib/hours-closure-composition.ts` domain consumer over
      the existing `RecordedHoursFact`, `ClosureFact`, and `WeekdayClosureAssessment` contracts.
      Its closed `CompositionClass` vocabulary is `jointly-presentable`, `present-with-caveat`,
      `keep-separate`, and `not-composable`; selection is total, deterministic, commutative, and
      strictly worst-tier-wins over `safe=0 < partial=1 < opaque=2 < unknown=3` (3 is weakest, so
      UNKNOWN remains weaker than OPAQUE). Classification dispatches exclusively through each
      fact's `.tier`, never `.kind`; the real JP-019 `not-evaluable`/PARTIAL closure is pinned as a
      load-bearing regression.
- [x] Enforced the full visit-date prerequisite before any per-place composition: globally valid
      `dayAssignment`, present and valid civil `startDate`, exactly one containing day bucket,
      successful `addCivilDays`, and a valid derived civil date. Every failed guard produces
      `no-visit-date`, with no partial fallback; moving a place recomputes against its new bucket
      date from current inputs, with no retained composed state.
- [x] Preserved both original classified facts (including complete raw hours/closure text and
      provenance) plus the existing weekday assessment. The new domain contains no availability/
      feasibility booleans, current-time read, API call, persistence, schema field, or duration-fit
      logic. No prior classifier and no source dataset was changed.
- [x] Integrated `HoursClosureCompositionNotice` as an additional signal inside each existing day
      card, alongside `WeekdayClosureNotice` and `ReservationDeadlineNotice`. Only
      `jointly-presentable` and `present-with-caveat` render; `keep-separate` and `not-composable`
      leave the existing surfaces unchanged. PARTIAL evidence keeps its full raw text and receives
      a review callout plus a per-fact warm treatment at least as prominent as the SAFE peer.
- [x] Added 32 focused domain tests: the complete 16/16 tier matrix and symmetry, no-promotion,
      determinism, JP-019 `.tier` dispatch, raw/provenance retention, malformed inputs, all date
      guards including overflow, move/recompute behavior, structural safety scans, and the live
      214-place dataset regression. Added 5 component wiring checks (53 total in
      `OrderedSequenceBuilder.test.ts`) for visibility/omission classes, complete caveat evidence,
      coexistence with both earlier temporal notices, single-dialog containment, and forbidden
      decision language. Full app result: **768 tests passing across 26 files**.
- [x] Re-derived the dataset invariants unchanged: hours×closures rows SAFE `31/18/19/12`, PARTIAL
      `15/10/20/5`, OPAQUE `0/0/17/2`, UNKNOWN `15/3/27/20`; hours marginals `80/50/19/65`;
      closure marginals `61/31/83/39`; composition classes `31/43/56/84`; total `214`.
- [x] Manual browser QA covered JP-017 (`jointly-presentable`), JP-030's load-bearing
      PARTIAL-hours presentation, Ghibli Museum/JP-044 (SAFE hours + PARTIAL closure), an OPAQUE
      place, an UNKNOWN place, missing `startDate`, and moving JP-044 from Monday to Tuesday (the
      visit date and existing weekday-match context both recomputed, with no stale notice). The UI
      cannot create an invalid partition through its normal controls, so the global invalidation
      branch is covered at the pure boundary with a synthetic invalid assignment. The same route
      was visually checked at an exact 390×844 viewport: no clipping, overflow, caveat dilution,
      or confusing merged copy; browser console produced no warnings/errors.
- [x] Final validation: focused tests 85/85; full app tests 768/768; Python suite 370/370; temporal
      audit 82/82; lint, TypeScript build, production build, dataset validation (214 places/403
      nearby relations/0 broken references, with the same 13 editorial warnings), geography
      validation (47 prefectures/47 polygons/9 regions/214 places), logistics validation (24 pilot
      and 308 scale edges/results), and `git diff --check` all clean.

No merge was performed by Phase 3D-J. No later phase was started.

## Later (unscheduled)

- [ ] Evaluate versioned LF policy and response-header/error telemetry as separate
      reproducibility/observability debt; see `docs/WALKING_SCALE_EXECUTION.md`.
- [ ] Phase 3B3E — client transport / React hook for live transit: **deferred by product
      decision, not blocked and not currently planned** (see the Phase 3C-A product-decision
      note above). This is no longer "waiting on" anything — no vendor answer is being sought,
      no account or key is being pursued. The synthetic transit architecture
      (`app/src/lib/transit.ts`, `app/server/transit.ts`) stays in the repository, dormant, in
      case a future scope decision revisits live transit; it is not deleted and the activation
      gate stays `"off"`. Current logistics strategy instead: validated-static walking via
      `getBestTransfer()`, honestly-labelled estimates for everything else, and an explicit "sin
      traslado registrado" for what neither covers — never fabricated. A user may still use
      Google Maps or another consumer app manually during the actual trip; that is outside this
      application. See `docs/LIVE_TRANSIT_SYNTHETIC_SKELETON.md`.
- [ ] Ekispert/NAVITIME provider activation: **not being pursued for the current scope** (see
      above). If revisited later, before any real account, API key, or live query is introduced,
      either get Val Laboratory's written answer to the drafted question in
      `docs/TRANSIT_TERMS_COVERAGE_CONFIRMATION.md` §7.3 (does Article 27(10)'s
      prior-written-consent requirement apply to Nihon's intended use, including its
      planning-recommendation direction), or deliberately scope the feature to only the narrow,
      lower-risk live-display case (§1.6) and accept that boundary.
- [ ] Clock-time / timezone / per-place scheduling — not started. Phase 3C-E can manually anchor
      Día 1 to a civil date and derive consecutive calendar dates/weekday labels for the
      remaining day buckets, but it does not assign clock times, timezones, arrival/departure
      times, or dates/times to individual places — see the opening-hour item just below for the
      related, still-untouched `schedule.hours`/`schedule.closures`/`bestTime` boundary.
- [ ] Opening-hour constraint solving — still **not started**, and this item's wording is updated
      here again specifically because it would otherwise now be false. Phase 3D-A audited and
      classified `schedule.hours`/`schedule.closures`/`bestTime`/`reservation`/`febMar2027` offline
      (see [`docs/TEMPORAL_DATA_CONTRACT.md`](TEMPORAL_DATA_CONTRACT.md)). Phase 3D-B added the
      first narrow **runtime** interpretation, on `schedule.closures`'s candidate-recurring-weekday
      family, surfaced as a conservative date/weekday match warning in the day-assignment view (see
      the Phase 3D-B entry above). **DONE (Phase 3D-E)**: `schedule.hours` itself now has a runtime
      classification too — `app/src/lib/recorded-hours.ts` turns the raw text into one of five
      conservative signal kinds (a SAFE recorded 24h/interval fact, a PARTIAL conditional fact, an
      OPAQUE external-dependency fact, or an UNKNOWN fact), with exact Phase 3D-A category/tier/
      priority-order parity, and a route-wide "Horarios registrados" summary in
      `OrderedSequenceBuilder.tsx` (see the Phase 3D-E entry above). **Still not done, and not
      implied by either of those runtime additions**: any actual open/closed judgment about a place
      (neither phase ever asserts one — Phase 3D-B only says "this recorded weekday candidate
      matches/doesn't match this date," and Phase 3D-E only says "this is the kind of hours
      information recorded for this place"); any composition of an hours fact with a closure fact,
      a `febMar2027` status, or a `bestTime` recommendation into a stronger claim; clock-time,
      timezone, or per-place visit-time scheduling of any kind; a visit-duration-fit calculation
      against a recorded interval; holiday handling; temporary or live closure/hours verification
      against an official source; a date recommendation; or automatic rescheduling. A full
      opening-hours feasibility solver remains a distinct, unscheduled, separately-decided future
      phase — not an incremental extension of either Phase 3D-B's or Phase 3D-E's conservative
      signal.
- [ ] Reservation booking-deadline intelligence — this item's wording is updated here specifically
      because it would otherwise now be false. **DONE (Phase 3D-D)**: a runtime classification of
      `reservation.leadTime` into a coarse days/weeks/months magnitude (`bare-magnitude`) or an
      honest "specific mechanism, needs review" flag (`opaque-entity-or-mechanism-specific`), with
      exact Phase 3D-A parity, and a route-wide "Reservas por preparar" preparation summary in
      `OrderedSequenceBuilder.tsx` (see the Phase 3D-D entry above). **STILL NOT DONE, and not
      implied by that**: converting a magnitude into a specific day count or a numeric range
      (`minDays`/`maxDays`); knowing today's date; computing a booking-by date; comparing lead time
      against the user's Phase 3C-E `startDate` or any day bucket's derived date; interpreting a
      lottery/release/timed-entry mechanism beyond flagging it for manual review; claiming
      availability; and any reminder or automation. A full booking-deadline solver remains a
      distinct, separately-scoped, unstarted future phase — not an incremental extension of Phase
      3D-D's coarse signal.
- [ ] Hotel-origin/return modelling (an assumed commute leg between a day's last place and the
      next day's first, or to/from an accommodation) — not started, and not assumed anywhere
      transfer times are computed today.
- [ ] Automatic candidate generation, automatic day distribution, and itinerary
      recommendation/optimisation (auto-sort, nearest-neighbour, TSP, shortest path, a day-quality
      scoring function, a "best order"/"best split" claim) — not started. Phase 3C-A defined one
      user-given order, Phase 3C-B compared exactly two of them, and Phase 3C-C let the user split
      one into ordinal days; none of the three chose an order, a day count, or a place-to-day
      assignment on the user's behalf, and any future automation here is a distinct,
      separately-scoped decision — not an incremental extension to make without one.
