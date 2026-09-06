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
- [ ] Exact date/time scheduling (assigning a calendar date, a weekday, a clock time, or a
      timezone to a day or a place) — not started. Days are still ordinal only.
- [ ] Opening-hour constraint solving (checking a place's `bestTime`/`schedule.hours`/
      `schedule.closures` against a day's other places or a proposed time) — not started; those
      fields are still opaque editorial strings, never structurally parsed.
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
