# Nihon — Tokyo Explorer (Phase 1 MVP)

React + TypeScript + Vite app implementing the Phase 1 vertical slice described in
[`../docs/ROADMAP.md`](../docs/ROADMAP.md): an interactive Tokyo map built from
`data/places.json`, with filtering, a place-detail panel, and a local "Quiero ir"
selection with a visit-time estimate.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Data

`src/data/*.json` are copies of the root `data/*.json` files (the application's
build-time data source, per `docs/DATA_MODEL.md`). Re-copy them after regenerating
the dataset from the master workbook.

## Notes

- No itinerary generation, booking, or routing — out of scope for Phase 1.
- Images are not invented: places without real assets show their `imageBrief` in a
  gallery placeholder until real photos are sourced.
- The activity-time total in the selection panel sums visit-time ranges only; it is
  explicitly labeled as not including transport time (Phase 2).
