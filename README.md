# Nihon — Japan Travel Explorer

Interactive Japan travel discovery and time-planning application built from a verified destination dataset.

Nihon turns a structured Japan travel research base into a visual explorer: browse places on a map, open photo-ready place profiles, compare nearby options, save favorites, and estimate how much real-world time selected experiences require.

## Current status

**Phase 0 — foundation and dataset contract**

- Product scope and UX behavior documented.
- Excel master base mapped to an application data model.
- JSON export pipeline prepared for the master workbook.
- No itinerary generation yet.

## Planned experience

`Japan map → hub/region → place marker → visual detail panel → save places → time estimate`

The first vertical slice will use Tokyo, then expand to Kyoto, Osaka/Kansai, Okinawa, and the rest of the verified dataset.

## Data source

The application is fed by **Nihon — Base Maestra v2** ([`data/source/Nihon-Base-Maestra-v2.xlsx`](data/source/Nihon-Base-Maestra-v2.xlsx)), updated 2026-09-01. The workbook remains the research source of truth; generated JSON (`data/*.json`, copied into `app/src/data/`) is an application build artifact. See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the exact commands to regenerate it.

The dataset intentionally preserves uncertainty and operational warnings, including February–March 2027 closures, pending calendars, reservation requirements, seasonal risks, and official source URLs.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Data model](docs/DATA_MODEL.md)
- [Roadmap](docs/ROADMAP.md)

## Portfolio framing

This project combines structured research, data normalization, geospatial UX, photo-led discovery, and time-planning logic. It is designed to demonstrate a complete product workflow rather than a static travel landing page.
