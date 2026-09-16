# Nihon — Japan Travel Explorer (app)

React + TypeScript + Vite app for the whole product described in
[`../docs/ROADMAP.md`](../docs/ROADMAP.md): a national explorer over all **214** verified
places in **7** hubs, built from `data/places.json`, with filtering, free-text search, a
place-detail panel, a local "Quiero ir" selection with a visit-time estimate, and a manual
trip planner (ordered route, day assignment, calendar anchoring, trip bounds, manual
inter-hub segments, whole-trip composition, recorded hours, and reservation planning).

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

`src/data/place-images.ts` is the image registry, keyed by place id. It is derived from
`src/data/photography-metadata.json` (a copy of `data/visual/photography-metadata.json`,
following the same root-`data/*.json` copy convention as the rest of `src/data/`).

Photography closed for v1 at Phase 4M: the registry holds **144 of 214** places, one
photograph each, all sourced from Wikimedia Commons under the CC0 / CC BY / CC BY-SA
allowlist. See [`../docs/PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md`](../docs/PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md)
for the closure decision and [`../docs/PHOTOGRAPHY_PILOT.md`](../docs/PHOTOGRAPHY_PILOT.md)
for the original pipeline. Every place outside the registry ships
`imageStatus: "brief-only"`, so the gallery falls back to the editorial `imageBrief`.
Sixteen places are permanently excluded as fail-closed and must not be retried without a
separate re-entry gate.

No further acquisition is authorized for v1. Should a post-v1 gate authorize one, the
pipeline is unchanged: add approved source metadata to
`data/visual/photography-metadata.json` and run `scripts/acquire-photography.py` (see that
script and `docs/PHOTOGRAPHY_PILOT.md` for the full pipeline) — never hand-edit a `url`
into `place-images.ts` directly, and never point at an unlicensed source or reuse a
photograph of a different place.

## Notes

- No **automatic** itinerary generation, booking, routing, or live transit. The planner is
  manual throughout: it never reorders a route or assigns a day on the user's behalf.
- Images are not invented: places without real assets show their `imageBrief` in a
  gallery placeholder until real photos are sourced.
- The activity-time total in the selection panel sums visit-time ranges only; it is
  explicitly labeled as not including transport time.
- Durations counted in days or nights ("Día completo", "1–2 días") are never converted to
  minutes — they describe trip space, not time on site — so they show their editorial text
  and are reported separately as "sin estimación numérica".
