# Nihon — Japan Travel Explorer

Interactive Japan travel discovery and time-planning application built from a verified destination dataset.

Nihon turns a structured Japan travel research base into a visual explorer: browse places on a map, open photo-ready place profiles, compare nearby options, save favorites, and estimate how much real-world time selected experiences require.

## Current status

**Nihon v1.0.0**

Discovery and manual trip planning are both implemented; photography closed for v1 at Phase 4M.

- The application opens on a map of the whole of Japan, drawn from official MLIT
  administrative geometry, and browses down through region → prefecture → hub → place.
- All **214** verified places across **7** hubs are reachable, with filters, free-text search,
  place details, nearby jumps, saved places, and activity-time estimates.
- **157** places carry a licensed photograph with full attribution; the rest show their
  editorial `imageBrief` fallback. Four places carry a second perspective as a gallery. Every
  photograph also ships a card-sized rendition, which cuts the bytes a phone spends scrolling a
  hub by **72%**. See [the photography closure](docs/PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md)
  and [Block 2](docs/BLOCK_2_PHOTOGRAPHY_DESIGN.md).
- A **manual** planner turns a saved selection into an ordered route: day assignment,
  calendar anchoring from Day 1, stable day identity across reordering, trip bounds, manual
  inter-hub segments, whole-trip composition, and evidence-complete local swap/relocation
  alternatives.
- Recorded opening hours and closure composition, manual visit start-time fit against
  recorded intervals, reservation mechanisms, trip-derived reservation dates, and a route-wide
  official reservation calendar for the February–March 2027 window.
- A phone-first discovery layer over all of it: photo-led place cards that state a plain-language
  level of interest, what the place is, where it is, why it is worth it and how long it takes,
  with a `Lista`/`Mapa` switch, a three-card first-run explainer, and saving confirmed from every
  surface. See [Block 1](docs/BLOCK_1_UX_HIERARCHY_DESIGN.md).
- Saved places and the planning draft persist locally in the browser.
- Still out of scope: automatic itinerary generation, live transit, routing, and booking.
  The planner never reorders a route for the user.

## Experience

`Japan → region → prefecture → hub → photo-led place cards (or map markers) → visual detail panel → save places → time estimate`

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
- [Block 1 — UX, hierarchy and usability](docs/BLOCK_1_UX_HIERARCHY_DESIGN.md)
- [Block 2 — the photographic layer](docs/BLOCK_2_PHOTOGRAPHY_DESIGN.md)

## Portfolio framing

This project combines structured research, data normalization, geospatial UX, photo-led discovery, and time-planning logic. It is designed to demonstrate a complete product workflow rather than a static travel landing page.
