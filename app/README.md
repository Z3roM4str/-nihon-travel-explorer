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
the dataset from the master workbook (`data/source/Nihon-Base-Maestra-v2.xlsx`) —
see `docs/DATA_MODEL.md` for the exact regenerate/validate/copy commands.

## Photography

`src/data/place-images.ts` is the image registry, keyed by place id. As of Phase 4A it is
derived from `src/data/photography-metadata.json` (a copy of
`data/visual/photography-metadata.json`, following the same root-`data/*.json` copy
convention as the rest of `src/data/`) — a **24-place pilot**, not full dataset coverage;
see `docs/PHOTOGRAPHY_PILOT.md`. Every place outside that pilot still ships
`imageStatus: "brief-only"` with no registry entry, so the gallery falls back to the
editorial `imageBrief` exactly as in Phase 1.

To source photography for more places, add approved source metadata to
`data/visual/photography-metadata.json` and run `scripts/acquire-photography.py` (see
that script and `docs/PHOTOGRAPHY_PILOT.md` for the full pipeline) — never hand-edit a
`url` into `place-images.ts` directly, and never point at an unlicensed source or reuse a
photograph of a different place.

## Notes

- No itinerary generation, booking, or routing — out of scope for Phase 1.
- Images are not invented: places without real assets show their `imageBrief` in a
  gallery placeholder until real photos are sourced.
- The activity-time total in the selection panel sums visit-time ranges only; it is
  explicitly labeled as not including transport time (Phase 2).
- Durations counted in days or nights ("Día completo", "1–2 días") are never converted to
  minutes — they describe trip space, not time on site — so they show their editorial text
  and are reported separately as "sin estimación numérica".
