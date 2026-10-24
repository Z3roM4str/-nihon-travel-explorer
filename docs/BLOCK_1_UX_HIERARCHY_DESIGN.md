# Block 1 — UX, hierarchy and usability

**Status:** implemented. **Scope:** the discovery surface only.
**Base:** `main` at `1a11fe8` (Nihon v1.0.0).

This is not a rebuild. Every dataset, validator, planner library, photography asset and test
that existed at v1.0.0 still exists, and every piece of information the interface showed is
still reachable. What changed is the order in which the interface says things.

---

## 1. The problem this block addresses

Nihon v1.0.0 was correct and dense. It presented a verified research base faithfully, and it
asked the reader to already know the vocabulary of that base before they could use it.

Three concrete failures, all visible on a phone:

1. **The results were hidden.** On a phone the hub explorer opened on a bare map. The list of
   places lived inside a drawer whose button said "Buscar y filtrar" — a filtering affordance,
   not a browsing one. A reader with no intent to filter had no reason to press it.
2. **A row was not enough to decide anything.** Each place was one line: a grade letter, a
   category, a neighbourhood and a duration. It said what a place was called, never why it
   might matter.
3. **The quality signal was an internal code.** "Grado B" is meaningful to whoever built the
   catalogue. It is meaningless to someone opening the app for the first time on a phone.

The target reader for this block is explicit: someone impatient, on a phone, who wants to know
in seconds what they are looking at and whether they would like to go.

---

## 2. Decisions

### 2.1 The interest ladder is a translation, not a re-ranking

`lib/interest-level.ts` maps the dataset's `grade` onto five plain-language levels:

| grade | level | count in catalogue |
|-------|-------|--------------------|
| `S` | Imprescindible | 32 |
| `A` | Muy recomendable | 147 |
| `B` | Recomendable | 25 |
| `C` | Opcional | 6 |
| `D` | Prescindible | 4 |

It is a pure mapping. No place moves, no threshold is recomputed, and the letter itself stays
on screen in the place detail. `App.test.ts`'s existing RC-01 regression — every catalogue
grade must be offered by the filter and must have a visual treatment — still governs; the
ladder is tested against `places.json` so a new grade fails loudly rather than disappearing.

**Tourism saturation stays a separate axis.** A place can be both imprescindible and
overwhelmingly crowded, and folding "excesivamente turístico" into the interest ladder would
misreport the dataset. `tourismCaution()` surfaces it as its own chip.

**Never colour alone.** Every level carries a text label, a distinct shape glyph (★ ◆ ● ○ –)
and a one-sentence explanation. The colours are secondary, and the map's legend spells all five
out. `.badge--grade-A` moved from `#c2701c` to `#a75d12`: white text on the old amber measured
about 3.0:1, under WCAG AA for the small text these badges carry. The map's marker colour moved
with it, so a pin and its card read as the same level.

### 2.2 The card answers six questions and stops

Each card answers, in this order: **what level of interest**, **what it is**, **where it is**,
**why it is worth it**, **how long it takes**, **what to do about it**. The "why" is the
dataset's own `differentiator`, clamped to two lines — nothing is generated, and the full text
is one tap away in the place detail. Everything deeper (hours, closures, reservation mechanics,
Feb–Mar 2027 status, access, accessibility, nearby, attribution, official links) stays in the
detail panel, unchanged.

**Markup.** The card is an `<article>` with two independent actions. The title's button is
stretched over the whole card through `::after`, so any tap opens the place; the save control
sits above it in the stacking order with its own 44px target. A card-wide `<button>` wrapping
the save button — the obvious shortcut — is invalid HTML and breaks keyboard and screen-reader
behaviour.

**Photography is presentation only in this block.** No asset was acquired, no metadata record
was written, and `place-images.ts` is untouched. The card resolves images through the existing
registry, fixes the aspect ratio (16:9, 3:2 on phones) so a mixed-source list scans as one
grid, lazy-loads with a skeleton, and handles the error state. A place with no licensed
photograph gets an editorial placeholder carrying its own category icon — never a stand-in
photograph of somewhere else.

### 2.3 A phone gets one surface at a time, and it is the list

`Lista | Mapa` replaces the drawer. The list is the default because a bare map answers none of
the questions a first-time reader arrives with. Both panes stay mounted and the hidden one is
hidden in CSS: `PlaceMap`'s existing `InvalidateOnResize` observer recomputes Leaflet on
reveal, where unmounting would force a whole bounds re-fit and a fresh tile fetch on every
switch.

"Filtros" now opens a sheet **over** the list rather than replacing it, so the results stay in
place and the reader does not lose their position.

Tablets fall below the 861px desktop breakpoint and were getting phone cards stretched across
800px. Two columns between 620px and 860px restores the proportions without a third layout
model.

### 2.4 Desktop: the results own the scroll

The sidebar was one scrolling column holding the filter panel above the list, with three filter
groups open by default. Six groups pushed the first card below the fold. It is now two regions:
a pinned search/status/filter block and a results area with its own scroll. The filter groups
collapse behind a disclosure on desktop and stay open on phones, where the reader opened the
sheet on purpose.

### 2.5 Saving is the one repeated action, so it is confirmed

Every surface — card, detail panel, saved list — routes through one wrapper in `App.tsx` that
toggles and then announces. `useSavedPlaces` stays the only writer and its `nihon.savedPlaceIds`
key is unchanged, so existing saved state survives this block untouched. The confirmation is a
`role="status" aria-live="polite"` region that is always mounted (a live region that appears
with its first message is frequently missed) and never takes focus.

The heart is deliberate: ♡ / ♥ is the interaction this is meant to become — "❤️ Quiero ir",
shared between two people — in a later block. Nothing about the current single-profile,
`localStorage`-only behaviour changed, and no backend was introduced.

### 2.6 The explainer is three cards and never a wall

First visit only, keyed on `nihon.onboarding.seen.v1`. It states the whole loop — explore, mark
what you like, compare afterwards — and closes on Escape, on the backdrop, on ×, and on
"Saltar", all through one exit path that marks it seen. The header's "?" reopens it, so
dismissing it is never a one-way door. It promises nothing this block does not ship: no
accounts, no sync, no two-person mode.

### 2.7 Orientation at the entry screen

The national view opened on a map and a region list, neither of which says where to begin — and
in practice a trip to Japan starts at a city someone has already heard of. One line of
orientation and the seven hubs with their place counts now sit at the top of the entry sidebar.
The Japan → región → prefectura → hub path underneath is untouched; this is a shortcut across
it, not a replacement for it.

### 2.8 Empty states say what happened

A failed free-text search names the term back to the reader; an over-filtered list says how
many places are still there. Both always offer the way out. The saved panel's empty state
explains both ways to save. The map's empty state says the hub's places are filtered, not gone.

---

## 3. What was deliberately not done

Out of scope by instruction, and untouched: shared backend, Supabase, cross-device sync, the
two-person Fernando/Ella model, bulk photography acquisition, the accommodation module, and
itinerary optimisation. **No hotel or accommodation origin was introduced anywhere**; travel
times still derive from hubs, zones and access points exactly as before.

Also left alone on purpose: `OrderedSequenceBuilder` and `SelectionAnalysis`. They are planning
surfaces, they are dense for good reasons, and reworking them belongs with the itinerary block
rather than with discovery.

---

## 4. How this was verified

- **Vitest** — 2519 tests over 70 files, up from 2450 over 66. No pre-existing assertion was
  weakened, skipped or deleted.
- **`block1-ux.test.ts`** — the preservation guard. Every practical-information row, the
  Feb–Mar 2027 block, the nearby list, official links, all six filter groups, the saved-places
  storage key, and attribution still rendered with the image rather than behind a disclosure.
- **`scripts/block1-ux-browser-audit.mjs`** — 142 checks at 390×844, 820×1180 and 1440×900
  against the production build via `vite preview`. Horizontal overflow, computed tap-target
  sizes, which pane a phone opens on, the save round trip, and the explainer's dismissal.
- **oxlint** clean, **tsc** clean, **production build** OK, and the six repository validators
  unchanged from their v1.0.0 baseline.

Two defects the audit found and this block fixed: the phone's "Filtros" button and the
Lista/Mapa options sat at 40px and 38px against the project's own 44px token, and filter chips
sat at 30px.
