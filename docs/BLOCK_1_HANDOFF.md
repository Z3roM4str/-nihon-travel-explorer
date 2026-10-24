# Block 1 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.
Nothing here depends on the conversation that produced it.

## Identity

| | |
|---|---|
| Branch | `claude/brave-wozniak-f79ie3` |
| Base | `main` at `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) |
| Commits | 6, listed below |
| Merged to `main`? | **No.** No pull request was opened. |
| Working tree | Clean at the final commit; nothing untracked, nothing generated left behind. |
| Block 1 status | **Closed.** |

## Commits, oldest first

1. `2b524d9` `feat(ux): add the plain-language interest ladder`
2. `f9fd533` `feat(ux): photo-led place cards and a phone-first hub layout`
3. `69e11f0` `feat(ux): plain-language filters, gallery polish, richer saved list`
4. `dfafe2c` `feat(ux): orient the entry screen and fit cards to tablet widths`
5. `6eb3954` `test(ux): Block 1 structural coverage and a real-viewport audit`
6. `docs(block-1): design record, roadmap entry and handoff` — the head commit. It cannot
   carry its own hash; `git log -1 claude/brave-wozniak-f79ie3` is the authority.

## Files

**New**

| File | What it is |
|---|---|
| `app/src/lib/interest-level.ts` | The grade → plain-language translation. The only place that mapping exists. |
| `app/src/lib/onboarding.ts` | Explainer content and its `localStorage` flag. |
| `app/src/useSaveFeedback.ts` | Transient save-confirmation state. Touches no storage. |
| `app/src/components/PlaceCard.tsx` | The photo-led card. |
| `app/src/components/Onboarding.tsx` | Three-card first-run dialog. |
| `app/src/components/SaveToast.tsx` | The always-mounted live region. |
| `app/src/components/InterestLegend.tsx` | Collapsible map key for the five levels. |
| `app/scripts/block1-ux-browser-audit.mjs` | 142-check real-viewport audit against the production build. |
| `app/src/block1-ux.test.ts` | Preservation guard. |
| `app/src/components/PlaceCard.test.ts`, `app/src/lib/interest-level.test.ts`, `app/src/lib/onboarding.test.ts` | Structural coverage. |
| `docs/BLOCK_1_UX_HIERARCHY_DESIGN.md` | Why each decision was taken. Read this before changing any of it. |

**Modified:** `app/src/App.tsx`, `app/src/App.css` (the bulk of the diff),
`app/src/components/PlaceList.tsx`, `PlaceDetail.tsx`, `PlaceGallery.tsx`, `FilterPanel.tsx`,
`SelectionPanel.tsx`, `NationalExplorer.tsx`, `PlaceMap.tsx` (one colour constant),
`docs/ROADMAP.md`.

**Not touched at all:** every file under `data/`, every script under `scripts/`, every
photography asset under `app/public/images/`, `app/src/data/*` (including
`place-images.ts` and `photography-metadata.json`), and every planner, logistics, reservation
and temporal library under `app/src/lib/` other than the two new files above.
`OrderedSequenceBuilder.tsx` and `SelectionAnalysis.tsx` are byte-identical to v1.0.0.

## What was implemented

A reordering of the discovery surface for a reader who is impatient, on a phone, and deciding
whether they would like to go. The full rationale is in
[`BLOCK_1_UX_HIERARCHY_DESIGN.md`](BLOCK_1_UX_HIERARCHY_DESIGN.md); in one paragraph each:

- **Interest ladder.** `grade` S/A/B/C/D now reads as Imprescindible / Muy recomendable /
  Recomendable / Opcional / Prescindible, as a pure mapping. Tourism saturation stays a separate
  chip. Label + shape glyph + colour, never colour alone.
- **Cards.** One-line rows became photo-led cards answering six questions; everything deeper
  stays in the detail panel. Photography is presentation only — no asset was acquired and the
  pipeline is untouched.
- **Phone.** `Lista | Mapa`, list first, both panes mounted. Filters became a sheet over the list.
- **Tablet.** Two columns between 620px and 860px.
- **Desktop.** The sidebar split into a pinned filter block and a scrolling results area;
  filter groups collapse behind a disclosure.
- **Saving.** One announcing wrapper for all three surfaces, a polite live region, a heart.
  `nihon.savedPlaceIds` unchanged; no backend.
- **Onboarding.** Three cards, four ways out, reopenable from the header's "?".
- **Entry screen.** One orienting line plus seven hub shortcuts above the untouched geographic path.
- **Empty states** for every dead end, each naming what happened and offering the way out.

## Decisions a future session should not casually reverse

1. **The grade letter is the source of truth.** `interest-level.ts` translates; it must never
   re-rank. If the catalogue gains a grade, add it to `INTEREST_LEVELS` *and* to `App.tsx`'s
   vocabulary literal — `App.test.ts`'s RC-01 regression and `interest-level.test.ts` both fail
   otherwise, by design.
2. **Tourism saturation is not a downgrade.** Keep it a separate axis.
3. **No stand-in photography.** A place without a licensed asset gets the editorial placeholder.
4. **Attribution stays rendered with the image**, not behind a disclosure. `block1-ux.test.ts`
   asserts this; it is a licence obligation, not a layout preference.
5. **The card is an `<article>` with a stretched link.** Do not "simplify" it into a card-wide
   `<button>` wrapping the save button — that is invalid HTML.
6. **Both phone panes stay mounted.** Unmounting the map on pane switch forces a bounds re-fit
   and a fresh tile fetch every time.
7. **`useSavedPlaces` is the only writer of saved state.** `useSaveFeedback` must stay
   storage-free.

## Verification, exactly as run

All commands from `app/` unless stated, on the final tree.

| Check | Command | Result |
|---|---|---|
| Unit/structural tests | `npm test` | **2519 passed, 70 files, 0 failed** (baseline at `1a11fe8`: 2450 / 66) |
| Lint | `npm run lint` | clean, no output |
| Types | `npx tsc --noEmit -p tsconfig.app.json` | clean |
| Production build | `npm run build` | OK |
| UX browser audit | `node scripts/block1-ux-browser-audit.mjs --browser=<chromium>` | **142 passed, 0 failed** |
| `validate-dataset.py` | from repo root | OK — 214 places, 403 relations, 0 broken refs, 13 pre-existing secondary-metadata warnings |
| `validate-geography.py` | | OK — 47 prefectures, 214 places, 7 hubs |
| `validate-photography.py` | | OK |
| `validate-logistics.py` | | OK — 24 pilot + 308 scale edges |
| `validate-access-points.py` | | OK |
| `validate-reservation-mechanisms.py` | | OK — source/app byte parity |

No pre-existing assertion was weakened, skipped or deleted. The +69 tests are all new files.
Validator output is identical to the v1.0.0 baseline, including the 13 warnings, which predate
this block.

### Responsive review

`scripts/block1-ux-browser-audit.mjs` runs at **390×844** (iPhone-class), **820×1180**
(iPad-class) and **1440×900**, against the production build via `vite preview`, on a clean
profile per viewport. It measures horizontal overflow (**none at any viewport, in the entry
screen, the hub view and the detail view**), computed tap-target sizes for every rendered
control, which pane a phone actually opens on, the save round trip through the counter and the
toast, the filter sheet, the empty state, the `Lista`/`Mapa` switch, and that the explainer is
dismissed permanently. **Zero page errors, zero console errors** at every viewport.

Screenshots were also reviewed by eye at all three widths during development.

## Problems found and fixed inside this block

1. **Badge contrast.** White on `#c2701c` measured ~3.0:1, under WCAG AA. Changed to `#a75d12`,
   marker colour moved with it.
2. **Tap targets.** The phone's "Filtros" button (40px), the `Lista`/`Mapa` options (38px) and
   the filter chips (30px) sat under the project's own 44px token. All raised; the audit now
   enforces a floor with each compact exception listed explicitly rather than by lowering the bar.
3. **Desktop hierarchy.** Six expanded filter groups pushed the first card below the fold.

## Known debt and risks

| | |
|---|---|
| `RC-05` | The single JS chunk is still above Vite's 500 kB advisory. Pre-existing, unchanged by this block, and unaffected by it — the new modules are small. |
| `OBS-1` / `OBS-2` / `OBS-3` | Pre-existing observations from Phase 5A, all unchanged: Leaflet's unlabelled tile `<img>`s, the 13 dataset warnings, and the `JP-149` Osaka/Shiga hub convention. |
| `App.css` size | Now ~2,900 lines in one file. It was already the pattern; this block did not split it, but a future block reasonably could. Purely mechanical if done carefully — the audit and `block1-ux.test.ts` would catch a bad split. |
| Testing technique | Component coverage remains source-scanning, per the repository's standing decision not to add a DOM harness. The browser audit is what covers real behaviour. A future block that adds jsdom could convert these, but that is a dependency decision, not a Block 1 one. |
| Photography coverage | Unchanged at **144 of 214** places. The other 70 show the editorial placeholder, which now looks deliberate rather than broken — but it is still a gap, and it is Block 2's subject. |

## Assumptions made

1. `grade` is an ordered quality ladder with `S` highest. This matches every existing use in the
   codebase (marker colour ordering, the editorial filter order in `App.tsx`).
2. The five levels the brief described map one-to-one onto the five grades the catalogue uses.
   The counts made this unambiguous: S 32, A 147, B 25, C 6, D 4.
3. `differentiator` is the right field for the card's one-line "why". It is the dataset's own
   one-sentence argument for the place; `description` is the factual fallback.
4. The reader's language is Spanish throughout, as in the existing UI.

## Deliberately left out

Shared backend, Supabase, cross-device sync, the two-person model, bulk photography acquisition,
the accommodation module, itinerary optimisation — all out of scope by instruction. **No hotel
or accommodation origin was introduced anywhere.** `OrderedSequenceBuilder` and
`SelectionAnalysis` were left untouched on purpose: they are dense for good reasons and belong
with the itinerary block.

## Recommendation for Block 2

Block 2 is photography coverage and carousels, and Block 1 was built to receive it:

1. **The component work is already done.** `PlaceGallery` carries a working carousel — swipe,
   arrows, dots with real hit areas, a visible `n / total` counter, keyboard navigation, a focus
   trap in the lightbox, and per-image attribution. Adding a second and third asset to a place's
   metadata record lights all of it up with no component change. `PlaceCard` takes
   `resolvePlaceImages(...)[0]`, so a multi-image place gets its first photograph on the card
   for free; if the card should itself become a carousel, that is a new decision, not a fix.
2. **Start from the existing pipeline, not a new one.** `scripts/acquire-photography.py`,
   `data/visual/photography-metadata.json` and `scripts/validate-photography.py` are the
   established route, and `docs/PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md` records why coverage
   stopped at 144 for v1. Read that first: it names which places were deferred and why.
3. **The 70 uncovered places are now visible as a set.** Filter to them by looking for the
   editorial placeholder; `imageStatus: "brief-only"` in `places.json` identifies them exactly.
   Prioritising by interest level is now trivial and probably right — an Imprescindible without
   a photograph costs more than a Prescindible without one.
4. **Keep the rules Block 1 encoded.** Registry-only resolution, no stand-in photography,
   attribution rendered with the image, and no runtime request to any photography provider —
   Phase 5A's audit proves that last one and Block 2 must not break it.
5. **Re-run `scripts/block1-ux-browser-audit.mjs` after Block 2.** It is not photography-specific;
   it is the standing UX regression net for the discovery surface, and a carousel that breaks
   card layout or tap targets will fail it.
