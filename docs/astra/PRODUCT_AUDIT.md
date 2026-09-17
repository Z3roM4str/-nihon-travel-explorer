# TRACK: ASTRA — Product audit

MODEL ROLE: ASTRA DIRECTOR

Date: 2026-09-17. Repository: `Z3roM4str/-nihon-travel-explorer`.
Base: `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (`main`, independently read through GitHub and cloned).
Branch: `experiment/astra-redesign`. Initial working tree clean. No AGENTS.md found in this checkout. No Claude branch inspected. The other local Nihon checkout was identified but its source was not used.

## Evidence boundaries

This is a **source-backed product audit**, not a completed visual/browser certification. Reviewed App and principal screen orchestration, representative screen implementations, CSS, store, photography registry, persistence hooks and relevant domain/document contracts. Built the actual application and ran its complete Vitest baseline. No invented screenshots, measured tap timing or user research.

Visual review attempted: agent-browser daemon failed; Playwright had no installed Chromium and the official download returned 502/timeouts; the cloud browser rejected the local preview with `ERR_BLOCKED_BY_CLIENT`. Vite preview starts successfully with `--host 127.0.0.1`; binding all interfaces triggers an environment error. Superdesign login timed out and was abandoned. None of these is an application defect. Do not call the new reference visually approved until it has been rendered at the acceptance viewports.

## Reproduced inventory

| Domain | Current evidence | Preservation rule |
|---|---|---|
| Catalogue | 214 unique places; 403 directed nearby records | Preserve IDs, editorial text, coordinates and relations |
| Hubs | Tokio 57; Kioto 49; Osaka 53; Okinawa 50; Sapporo 3; Nagoya 1; Fukuoka 1 | All remain reachable; do not assume hub means physical municipality |
| Recommendation | S 32; A 147; B 25; C 6; D 4 | Translate presentation, never regrade to suit photography |
| Geography | National region/prefecture navigation, local geometry and attribution | Retain as an alternate discovery entry |
| Photography | 144 records, 144 covered places, max 1 image/place; 70 without images | Correct-place local assets, full provenance, fail-closed exclusions |
| Saved | `nihon.savedPlaceIds`, one unowned local list | Do not attribute historical choices to Fernando or Ella without an explicit claim |
| Planner | `usePlanningDraft.ts` imports `planning-draft-v7.ts` | Preserve V1→V7 loading, stable day IDs, user dates/times, accommodation legs and inter-hub segments |
| Temporal | Separate reservation, hours, closures, seasonal confidence and official calendar logic | No stronger claim than the existing interpreter permits |
| Logistics | Directed evidence and confidence classes; missing edges stay missing | Never infer travel time from straight-line distance |

The attached workbook was not substituted for the repository's editorial source. `docs/DATA_MODEL.md` establishes `data/source/Nihon-Base-Maestra-v2.xlsx` → exporter → root/app JSON parity. Some historic descriptions stop at an earlier pilot or schema; current imports and latest authority take precedence for current state.

## Findings

Severity here expresses redesign priority, not a claim that the released app is broken. Source references are relative to repository root.

| ID / priority | Surface and evidence | Assessment | Exact direction |
|---|---|---|---|
| A01 / P1 | `App.tsx`, `NationalExplorer.tsx`: initial mode national; coverage counts, regions and prefectures precede experiences | Excellent geographic honesty; requires users to think in administrative divisions before finding something appealing | Open on photographic discovery; direct hub control and global search. Keep geography in “Explorar por región” |
| A02 / P1 | `PlaceList.tsx`: text-only button; no save callback | Saving requires opening a detail; images do not help users scan the catalogue | Separate photo/title detail link and 48px “Quiero ir” button on every card |
| A03 / P1 | `App.tsx` and CSS: mobile list and filters share a hidden sidebar | The list competes with controls; map dominates the mobile hub entry | List is default; map is a persistent mode switch preserving filters and position |
| A04 / P1 | `FilterPanel.tsx`: raw S/A/B/C/D, duration groups initially open | Powerful taxonomy but unfamiliar vocabulary has high initial salience | Human recommendation labels, three quick controls; full native choices behind “Filtros” |
| A05 / P1 | `PlaceDetail.tsx`: gallery, metadata tags and nonsticky save precede explanatory content | Strong source content; save can disappear while reading; dense facts compete with “why go” | Name, one-sentence explanation, recommendation and short facts; sticky mobile interest action; disclosure for depth |
| A06 / P1 | `SelectionPanel.tsx`: summed hours and planner CTAs; one list | Supports solo selection but cannot express an unreviewed partner, agreement or explicit rejection | “Nuestro viaje” with separate person votes, review status and trip shortlist |
| A07 / P1 | `useSavedPlaces.ts` + V7 reconcile: unsaving can prune a route | A casual change of interest can affect authored planning if coupled directly | Keep legacy planner eligibility separate from votes; explicit plan-removal review only |
| A08 / P2 | `PlaceGallery.tsx`: imageBrief is shown on missing/error assets | Honest fallback, but production/photography instructions leak into user copy | Neutral illustrated field, “Fotografía pendiente”; retain brief as research metadata |
| A09 / P1 | `PlaceGallery.tsx`: full credit outside frame; fullscreen has only image/close | Good local assets, source/license links and load/error states; fullscreen does not expose attribution controls | Maintain accessible current-image credits in gallery and fullscreen, no autoplay |
| A10 / P1 | `PlaceDetail.tsx`: focus close and Escape, no modal trap/restore in component | Source-backed risk of background focus on mobile; not yet browser reproduced | Mobile dialog with inert background; one top overlay closes per Escape, opener focus restored |
| A11 / P2 | `App.css`: 44px token and reduced-motion support; emoji category/icon language | Good foundation; emojis vary across platforms and density changes at a single 861px breakpoint | Unified 20/24px SVG icons, 48px primary targets, explicit mobile/tablet/desktop rules |
| A12 / P1 | `OrderedSequenceBuilder.tsx`: rich route, compare, days, hours, reservations and lodging controls | Valuable functional depth, inappropriate as a mandatory discovery step | Preserve whole module initially; put behind “Planificar” inside Nuestro viaje |
| A13 / P1 | `usePlanningDraft.ts`: real lodging anchors already exist | Zone comparison is new and must not masquerade as a booked hotel | Separate researched area candidates from user-created accommodation anchors |
| A14 / P2 | `PlaceMap.tsx`, `NationalMap.tsx`: selected marker and independent geographic controls | Preserve selection outside current filters and geography coverage honesty | Lazily loaded map; selected marker + compact preview; accessible matching list |
| A15 / P1 | `App.tsx`: local component navigation/history | Nearby backtracking is useful; no shareable place URL or browser-back contract | URL-encoded surface/place; restore origin scroll, mode and filters |
| A16 / P2 | `useSavedPlaces.ts`: storage exceptions silently retain memory state | Graceful survival but user may believe data is durable | Nonblocking “No pudimos guardar en este dispositivo” and retry; never claim sync |

## Preserve in the redesign

Accent-insensitive search, Japanese names, all grades/categories/hubs, quantified and day-scale duration separation, asymmetric nearby edges, truthful confidence, reservation semantics beyond a boolean, Feb–Mar editorial warning/action text, attribution including processing, official links, local photography delivery, geometry attribution, missing-data fallback, route comparison, day editing, stable day identity, accommodation boundaries, inter-hub manual segments, whole-trip completeness and reservation-calendar logic.

## Working hypotheses to verify

An inexperienced user should save a visible place with one tap, identify “Ambos quieren ir” without decoding a legend, and return from detail without losing position. This is an acceptance hypothesis, not measured evidence about the user's spouse. The new visual reference deliberately covers only discovery/card/detail/interest, with live repository data. The rest is specified for Sol.

## Baseline execution

- `npm ci`: passed; lockfile unchanged.
- `npm test`: 2,450 passed, 66 files.
- `npm run build`: passed; JS `index-pf4I7nMN.js`, 1,424,842 bytes; existing large-chunk advisory.
- `python3 scripts/validate-dataset.py data`: passed, 214 places / 403 nearby, 13 pre-existing secondary warnings.
- `python3 scripts/validate-photography.py`: passed.
- Historical release records report 543 Python tests and two 50-check browser journeys. **Not rerun here; not claimed as current passes.**

No production implementation or canonical data changed in this director phase.
