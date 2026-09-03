# Nihon — Japan Travel Explorer

Interactive Japan travel discovery and time-planning application built from a verified destination dataset.

Nihon turns a structured Japan travel research base into a visual explorer: browse places on a map, open photo-ready place profiles, compare nearby options, save favorites, and estimate how much real-world time selected experiences require.

## Current status

**Phase 2C — National Explorer**

- Product scope and UX behaviour documented; the workbook is mapped to an application data
  model and exported reproducibly.
- The application opens on a map of the whole of Japan, drawn from official MLIT
  administrative geometry, and browses down to a hub from there.
- Every hub in the dataset is reachable, with filters, place details, nearby jumps, saved
  places, and activity-time estimates.
- No itinerary generation, routing, or booking.

## Experience

`Japan → region → prefecture → hub → place marker → visual detail panel → save places → time estimate`

The national view shows all 47 prefectures and makes clear which of them Nihon actually
covers today; prefectures without verified places stay on the map without pretending to
have content. Selecting a covered prefecture opens the hub its places belong to
editorially, which is not always the hub nearest to it.

## Data source

The application is fed by **Nihon — Base Maestra v2** ([`data/source/Nihon-Base-Maestra-v2.xlsx`](data/source/Nihon-Base-Maestra-v2.xlsx)), updated 2026-09-01. The workbook remains the research source of truth; generated JSON (`data/*.json`, copied into `app/src/data/`) is an application build artifact. See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the exact commands to regenerate it.

The dataset intentionally preserves uncertainty and operational warnings, including February–March 2027 closures, pending calendars, reservation requirements, seasonal risks, and official source URLs.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Data model](docs/DATA_MODEL.md)
- [Geographic layer, source and licence](docs/GEOGRAPHY.md)
- [Roadmap](docs/ROADMAP.md)

## Portfolio framing

This project combines structured research, data normalization, geospatial UX, photo-led discovery, and time-planning logic. It is designed to demonstrate a complete product workflow rather than a static travel landing page.
