# Nihon v1.0.0 — Release Notes

**Nihon** is an interactive Japan travel explorer and manual trip planner, built from a
verified destination dataset.

- Version: **1.0.0**
- Tag: `v1.0.0`
- Release title: **Nihon v1.0.0**

---

## What v1.0.0 ships

### National explorer

A map of the whole of Japan drawn from official MLIT administrative geometry, browsed through
**region → prefecture → hub → place**. All **47** prefectures are shown; the ones Nihon does not
yet cover stay on the map without pretending to have content.

**214 verified places across 7 hubs** — Tokio (57), Osaka (53), Okinawa (50), Kioto (49),
Sapporo (3), Nagoya (1), Fukuoka (1).

### Discovery

- Filters across hub, category, grade (S/A/B/C/D) and tourism level
- Free-text search over the catalogue
- Place-detail panels with editorial content and operational warnings
- Nearby relations for jumping between related places
- Saved places ("Quiero ir") with an activity-time estimate

### Manual multi-day, multi-hub planner

- An ordered route built from the saved selection
- Day assignment across multiple days
- **Stable day identity** that survives reordering, added days and cross-day moves
- A **persisted planning draft** — the whole plan reloads intact
- Calendar anchoring from Day 1 to a civil date, with trip bounds
- **Manual inter-hub segments** (for example a Shinkansen leg across a hub boundary)
- Whole-trip composition reconciling days, segments and accommodation legs
- Evidence-complete local swap/relocation alternatives

The planner is **manual throughout**. It never reorders a route or assigns a day on the user's
behalf.

### Time, hours and reservations

- Recorded opening hours and **closure composition**
- Manual **visit start-time fit** against recorded intervals, offered only where a recorded
  interval actually supports it
- **8 reservation mechanisms** with trip-derived reservation dates
- Purchase and residence context presented without inventing personal applicability
- A **route-wide official reservation calendar** for the February–March 2027 window

### Photography

**144 of 214 places** carry a locally hosted, licensed photograph — one photograph per place,
all sourced from Wikimedia Commons under a CC0 / CC BY / CC BY-SA allowlist, each rendering its
source, credit and licence links.

Every place outside the registry ships its editorial `imageBrief` fallback, so no place is ever
shown with a missing or borrowed image. **Sixteen** places are permanently excluded as
fail-closed and are not retried without a separate re-entry gate.

Photographs are served from local assets. The application makes **no runtime request to any
photography provider**.

### Platform

- Desktop and mobile. Below the 861 px breakpoint the app is deliberately **map-first**: the
  search-and-filter sidebar lives in a drawer.
- Saved places and the planning draft persist **locally in the browser**. There is no account,
  no server-side storage and no personal data leaves the device.
- The only external host reached at runtime is `tile.openstreetmap.org`, for map tiles,
  attributed in the UI.

---

## Non-goals — what v1.0.0 deliberately does not do

- **No automatic itinerary generation.** Nihon does not build or optimise a route for the user.
- **No live transit routing and no transit provider.** The transit contract ships dormant and is
  imported by no component.
- **No booking execution.** Nihon surfaces reservation mechanisms and dates; it never books.
- **No claim that opening-hours or reservation evidence is live or current.** Every such signal
  is presented against its recorded provenance and nothing more. Hours never overclaim an
  open/closed status.
- **The optional post-v1 photography backlog remains deferred.** Photography was closed for v1
  at Phase 4M at 144/214; no further acquisition is authorised.

---

## Known non-blocking observations

Carried from the Phase 5A release-candidate audit. **None is a release blocker.**

- **Bundle size** — one JS chunk is above Vite's 500 kB advisory: 1,424,842 B raw,
  **259,730 B gzipped**. Code-splitting is a refactor, deliberately out of scope for the release
  gate. Gzipped first load is ordinary for an application of this scope.
- **Leaflet tile alt text** — Leaflet's own tile `<img>` elements carry no `alt`. This is
  third-party decorative DOM; every *product* image is labelled.
- **13 secondary dataset warnings** — pre-existing `validate-dataset.py` cluster-metadata
  warnings, including cluster CL-87's place-count mismatch. The validator exits OK and no user
  journey is affected.
- **JP-149 hub convention** — MIHO Museum is filed under the Osaka hub but sits in Kōka, Shiga.
  This is a pre-existing editorial hub assignment, not a data error.

---

## Provenance

The application is fed by **Nihon — Base Maestra v2**
(`data/source/Nihon-Base-Maestra-v2.xlsx`, updated 2026-09-01), which remains the research source
of truth. Generated JSON is an application build artifact.

The dataset intentionally preserves uncertainty and operational warnings, including
February–March 2027 closures, pending calendars, reservation requirements, seasonal risks and
official source URLs.

## Release verification

v1.0.0 ships the artifact verified by the Phase 5A release-candidate audit
([`docs/RELEASE_CANDIDATE_AUDIT.md`](RELEASE_CANDIDATE_AUDIT.md)) and independently re-verified by
the Phase 5B final release gate ([`docs/FINAL_RELEASE_GATE.md`](FINAL_RELEASE_GATE.md)):
Python **543** · Vitest **2450** across **66** files · lint clean · production build OK · seven
validators green · RC browser audit **50/50 desktop** and **50/50 mobile** · whitespace clean ·
`npm ci` reproducible.
