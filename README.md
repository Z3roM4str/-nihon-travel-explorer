# Nihon — Japan Travel Explorer

Interactive Japan travel discovery and time-planning application built from a verified destination dataset.

Nihon turns a structured Japan travel research base into a visual explorer: browse places on a map, open photo-ready place profiles, compare nearby options, save favorites, and estimate how much real-world time selected experiences require.

## Current status

**Nihon v1.1.0** — release candidate. The previously published release is
[v1.0.0](https://github.com/Z3roM4str/-nihon-travel-explorer/releases/tag/v1.0.0) (2026-09-17);
v1.1.0 adds two travellers, accommodation zones, provenance and freshness, and a portable backup,
all backward compatible. See [the v1.1.0 release notes](docs/RELEASE_V1.1.0.md).

Discovery and manual trip planning are both implemented; photography closed for v1 at Phase 4M.

- The application opens on a map of the whole of Japan, drawn from official MLIT
  administrative geometry, and browses down through region → prefecture → hub → place.
- All **214** verified places across **7** hubs are reachable, with filters, free-text search,
  place details, nearby jumps, saved places, and activity-time estimates.
- **157** of the 214 places carry a licensed photograph with full attribution, **163** images in
  all; the rest show their editorial `imageBrief` fallback. Six places carry a second perspective
  as a gallery. Every
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
- An accommodation-zone comparison for Tokio, Kioto and Osaka: 16 zones as distinct lodging
  strategies, comparing sourced transport facts, Nihon's own editorial judgement, and how far each
  zone sits from the places you saved — with facts, computed values and opinion labelled
  separately, and no zone ever called the best. See [Block 3](docs/BLOCK_3_DESIGN.md).
- **Two travellers, one trip.** Each person marks what *they* want to see; the shared "Quiero ir"
  list is derived from both, coincidences and divergences are reported as such, and a preference
  never becomes a plan on its own. The itinerary stays one shared document — the two of them have
  one trip. See [Block 5](docs/BLOCK_5_DESIGN.md).
- **Everything persists locally in the browser**, and nothing leaves it. A portable backup writes
  the travellers' durable decisions to a JSON file they keep, and reads it back in another browser
  — replacing, never merging, and never uploading. No account, no server, no sync. See
  [Block 13](docs/BLOCK_13_DESIGN.md).
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
- [Block 3 — debt, and the accommodation-zone decision layer](docs/BLOCK_3_DESIGN.md)
- [Block 4 — zone-seeded accommodation](docs/BLOCK_4_DESIGN.md)
- [Block 5 — two travellers, and what is genuinely personal](docs/BLOCK_5_DESIGN.md)
- [Block 6 — divergence between the two travellers](docs/BLOCK_6_DESIGN.md)
- [Block 7 — what each source actually supports](docs/BLOCK_7_DESIGN.md)
- [Block 8 — airport links and their operators](docs/BLOCK_8_DESIGN.md)
- [Block 9 — editorial governance](docs/BLOCK_9_DESIGN.md)
- [Block 10 — `consultedAt`, and when a check has aged](docs/BLOCK_10_DESIGN.md)
- [Block 11 — semantic coverage of provenance](docs/BLOCK_11_DESIGN.md)
- [Block 12 — bundle architecture](docs/BLOCK_12_DESIGN.md)
- [Block 13 — portable backup and restoration](docs/BLOCK_13_DESIGN.md)
- [Block 14 — release readiness](docs/BLOCK_14_RELEASE_READINESS.md)

## Portfolio framing

This project combines structured research, data normalization, geospatial UX, photo-led discovery, and time-planning logic. It is designed to demonstrate a complete product workflow rather than a static travel landing page.
