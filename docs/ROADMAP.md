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

## Later (unscheduled)

- [ ] Estimate logistical overhead using validated routing data.
- [ ] Compare candidate city sequences.
- [ ] Only then generate day-level itinerary candidates.
