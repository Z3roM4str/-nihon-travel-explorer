# Nihon Roadmap

## Phase 0 — foundation

- [x] Confirm repository and source workbook.
- [x] Define product scope and first vertical slice.
- [x] Define application data contract.
- [ ] Export normalized JSON from the workbook.
- [ ] Add schema validation and data-quality report.

## Phase 1 — Tokyo explorer

- [ ] Add map shell and hub navigation.
- [ ] Render Tokyo markers from JSON.
- [ ] Add category, grade, hidden-gem, and time filters.
- [ ] Build responsive place-detail drawer.
- [ ] Add image-slot/gallery component using source-aware assets.
- [ ] Add saved places state.

## Phase 2 — time intelligence

- [ ] Parse and display duration ranges.
- [ ] Show activity-time totals for saved places.
- [ ] Add recommended planning-block summaries.
- [ ] Add nearby-cluster suggestions.
- [ ] Clearly separate activity time from transport time.

## Phase 3 — Japan coverage

- [x] Add Kyoto.
- [x] Add Osaka/Kansai and excursions.
- [x] Add Okinawa.
- [x] Add remaining hubs after validating the data pipeline.

All hubs in the dataset (Tokyo, Kyoto, Osaka, Okinawa, Sapporo, Nagoya, Fukuoka) are
reachable through the hub selector; see Phase 2B in the project history.

## Phase 4 — route candidate builder

- [ ] Compare selected places by cluster and geography.
- [ ] Estimate logistical overhead using validated routing data.
- [ ] Compare candidate city sequences.
- [ ] Only then generate day-level itinerary candidates.
