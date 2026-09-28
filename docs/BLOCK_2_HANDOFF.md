# Block 2 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Branch | `claude/brave-wozniak-f79ie3` |
| Started from | `ac54969445dc5da8871c109551a3186d1b20d687` (Block 1 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) |
| Merged to `main`? | **No.** No pull request was opened. |
| Working tree | Clean. |
| Block 2 status | **Closed**, with two verified assets deferred (§ Deferred). |

## Commits

1. `30c85a6` `perf(photography): serve card-sized renditions to the photo-led list`
2. `db4a9fc` `feat(photography): prominence-first coverage tranche, +13 places`
3. `facae31` `feat(photography): depth on four grade S places, and a carousel that data can reach`
4. `docs(block-2): design record, roadmap entry and handoff` — the head commit.

## Files

**New scripts**

| File | What it does |
|---|---|
| `scripts/build-photography-derivatives.py` | Renders one deterministic 800px rendition per registered photograph. Network-free. `--check` fails on drift. |
| `scripts/discover-block2-commons.py` | Candidate discovery with licence filtering and a great-circle distance from the file's Commons GPS to the place's own coordinates. |
| `scripts/prepare-block2-photography-metadata.py` | Builds registry records from the Commons API, so no cross-checked field is typed by hand. |
| `app/scripts/block2-photography-browser-audit.mjs` | 69-check audit of the photographic layer against the production build. |

**New tests:** `app/src/photography-derivatives.test.ts` (13), `app/src/photography-depth.test.ts` (12).

**New data:** `data/visual/block2-coverage-batch.json`, `data/visual/block2-depth-batch.json`.

**New docs:** `docs/BLOCK_2_PHOTOGRAPHY_DESIGN.md` (the authority — read it before changing any
of this), this handoff.

**Modified:** `scripts/validate-photography.py` (two new rules), `app/src/data/place-images.ts`
(`cardImageUrl`), `PlaceCard.tsx`, `PlaceGallery.tsx`, `SelectionPanel.tsx`,
`app/src/data/place-images.test.ts`, `data/visual/photography-metadata.json` +
`app/src/data/photography-metadata.json` (registry), `docs/ROADMAP.md`.

**Assets:** +17 originals, +161 derivatives.

**Untouched:** the entire application UI of Block 1 beyond the three image call sites; every
planner, logistics, reservation and temporal library; `data/places.json`; every other validator.

## Metrics, before and after

| | before | after |
|---|---:|---:|
| places | 214 | 214 |
| **covered** | 144 (67.3%) | **157 (73.4%)** |
| uncovered | 70 | 57 |
| **registry records** | 144 | **161** |
| **places with a gallery** | **0** | **4** |
| max photographs per place | 1 | 2 |
| S / A / B coverage | 87.5 / 69.4 / 56.0 | **87.5 / 76.2 / 68.0** |
| A−B margin | +13.4 pts | **+8.2 pts** |
| ordering S≥A≥B≥C≥D | holds | **holds** |
| large-hub spread | 5.2 pts | **3.8 pts** (new minimum) |
| `Extremo` prominence | 52.3% | **63.6%** |
| `Alto` prominence | 80.4% | **87.5%** |
| fail-closed ids | 16 | **17** |
| **originals on disk** | 144 = 40.49 MiB | **161 = 45.23 MiB** |
| **derivatives on disk** | 0 | **161 = 12.34 MiB** |
| total photography bytes | 40.49 MiB | **57.57 MiB** |
| **phone bytes to scroll one hub** | **9.51 MiB** | **2.63 MiB (−72%)** |

The last row is the one that reaches the user. The two rows above it do not: nobody downloads
the repository.

## Verification, exactly as run

| Check | Command | Result |
|---|---|---|
| Tests | `npm test` | **2547 passed, 73 files, 0 failed** (from 2532/71) |
| Lint | `npm run lint` | clean |
| Types | `npx tsc --noEmit -p tsconfig.app.json` | clean |
| Build | `npm run build` | OK |
| Block 1 regression | `node scripts/block1-ux-browser-audit.mjs` | **142/142** |
| Block 2 photography | `node scripts/block2-photography-browser-audit.mjs` | **69/69** at 390×844 DPR 2, 820×1180 DPR 2, 1440×900 |
| Derivative determinism | `python3 scripts/build-photography-derivatives.py --check` | OK, 0 drift |
| `validate-photography.py` | | OK |
| `validate-dataset.py` | | OK (13 pre-existing warnings) |
| `validate-geography.py` / `-logistics` / `-access-points` / `-reservation-mechanisms` | | all OK |
| Whitespace | `git diff --check` | clean |

The Block 2 audit explicitly covers what the brief asked: carousels, single images, places with
no image, aspect ratios, CLS, load failures, attribution, the lightbox, navigation, cards,
detail, list, map, and the saved list. **No new console or page error at any viewport.**

## Problems found

1. **The Block 1 handoff was wrong about `imageStatus`.** It said uncovered places carry
   `imageStatus: "brief-only"`. `scripts/export-dataset.py` writes that literal for **all 214**
   places unconditionally; nothing in the app reads it. The registry is the sole source of truth.
   Corrected in the design document. No figure moved.
2. **Block 1 left a performance defect.** The photo-led list loaded 1600px heroes into ~370px
   card slots — 9.51 MiB to scroll one hub. Fixed by the derivative tier.
3. **The validator never looked at the asset tree.** An orphaned blob from a renamed record
   would have shipped unnoticed. It now checks, and both new rules were proven against a planted
   fault.
4. **`acquire-photography.py` cannot fetch a file at or below 1600px** in this environment — see
   § Deferred. A real limitation, diagnosed, fix proposed, deliberately not implemented blind.
5. **Two candidates passed licence, title and coordinates and were wrong on sight** (Sanzen-in
   foliage with no temple; Hikone blossom with no castle), and a "Blue Cave" search returned a
   cave in **Montenegro**. Visual inspection is not optional.

## Deferred — not fail-closed

`JP-205` Sapporo Snow Festival and `JP-125` Universal Studios Japan each have a **verified,
visually inspected, licence-checked** second photograph that could not be downloaded:
`upload.wikimedia.org` returned 429 persistently across a seven-minute backoff, while the same
places' existing assets re-downloaded fine in the same runs.

Cause: the pipeline requests `iiurlwidth=1600`; a file at or below 1600px has no thumbnail to
render, so Commons returns the **original**, and original fetches are what the host throttles.
All 17 successful acquisitions were wider than 1600px and were served cached `/thumb/`
renditions.

Proposed fix, for a future session to implement **and verify**: when the resolved URL is the
original and the fetch is refused, retry at the largest standard cached width below the
original. This stays inside the existing contract — `PHOTOGRAPHY_MAX_DIMENSION` is a maximum and
the script already never upscales.

Their verified entries are committed in `data/visual/block2-depth-batch.json`. Re-running
`prepare-block2-photography-metadata.py` on that plan plus `acquire-photography.py` completes
them; then update the gallery pins in `place-images.test.ts` and the two counts beside them.

## Decisions a future session should not casually reverse

1. **Phase 4M's ordering invariant stays.** Block 1's photo-led list strengthened the case, not
   weakened it. Dropping it needs its own gate, as Phase 4M §12 Objection 3 says.
2. **A is at 76.2% against a permanent ceiling of 87.1%.** 16 of the 26 lifetime A slots remain.
   Spend them on named places, not on percentage.
3. **The derivative name is derived, not declared.** Three places mirror one string rule. Do not
   "improve" this into a registry field.
4. **The lightbox loads the original.** That is the one place full resolution matters.
5. **Depth is bounded by a criterion, not a budget.** Two of its four rejections were places
   where photography of the experience is legally prohibited.
6. **Fail-closed and deferred are different words.** Do not merge them.

## Assumptions

1. `tourismLevel` is a fair prominence proxy — Phase 4M's own choice, read-only, feeding no
   ranking.
2. 800px covers every card surface at DPR 2; DPR 3 phones upscale 1.39× on a 16:9 thumbnail,
   judged imperceptible at that size and cheaper than a ~20 MiB extra tier.
3. Commons categories, GPS and descriptions are adequate identification evidence **when
   combined with looking at the image**. None was trusted alone.

## Out of scope, untouched

Shared backend, Supabase, sync, the two-person model, the accommodation module, itinerary
optimisation. No hotel or accommodation origin exists anywhere. No place was re-ranked because
of a photograph, and no interest level was reduced for lacking one.

## Recommendation for Block 3

**Not photography.** Both stop criteria in the design document are met, and the named product
motive is exhausted: five of Phase 4M's six reachable prominence gaps are now covered and the
sixth is fail-closed. Continuing would buy percentage, which is the trap Phase 4M §9 identified.

Two small items first, each under an hour:

1. **Land the two deferred galleries** once the thumbnail fallback is implemented and verified.
2. **Fix `imageStatus`** — either make `export-dataset.py` emit a real value or drop the field
   from `types.ts`. A field that says the same thing for all 214 rows is a trap, as it already
   proved.

Then the real candidate: **the two-person layer that Blocks 1 and 2 were built to receive.**
Block 1 shaped the save interaction for "❤️ Quiero ir" and deliberately stopped short of
collaboration; the brief's original sequence puts comparing two people's choices next, and it is
the first thing that changes what Nihon *does* rather than how it looks. It needs a real
decision from the user first — whether two profiles live in one browser, or whether this is the
point where a backend becomes unavoidable — so it should open with that question, not with code.

The alternative, if a backend decision is not wanted yet, is the **accommodation-zone
comparison**, which is self-contained, needs no sync, and is explicitly listed as a later block.


---

## Nota de merge-readiness (2026-09-26)

El check «a full hub scroll stays well under the pre-Block-2 cost» (`< 5 MiB`) falla en tablet y
escritorio (5,31 / 5,77 MiB) en la rama de PR #152. Diagnóstico y opciones:
`docs/DDR-MERGE-1_PRESUPUESTO_FOTOGRAFIA_HUB.md` (abierta). El recorrido del hub en sí cuesta 3,20 MiB;
el exceso lo pone la portada de Explorar, cargada antes del clic en el hub.
