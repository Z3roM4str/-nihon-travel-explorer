# Phase 4C — Photography Attribution Completeness Corrective

Status: **implemented, exact-head validated, no new photography acquired**

Base: `85e34fe5f4785dab675e07fa1ce6f85e3be06c1b` (`main` after Phase 4B)

Issue: #95

Validated executable/test HEAD:
`cf71d0cbb59b5695f0addf8f6f7de7ccfe86a7a0`

Validation run:
GitHub Actions `34924302760`

Post-validation workflow-removal HEAD:
`a885062e1c961d37c1d476d3e02f0b818e7df18f`

The diff from the validated HEAD to the post-removal HEAD contains exactly one path:
`.github/workflows/phase4c-exact-head.yml`, removed. No executable, data, test or asset byte
changed after validation.

---

## 1. Scope delivered

Phase 4C corrects only the attribution path for the 24 local photographs introduced by Phase 4A.

It does not:

- add a 25th photograph;
- replace any of the 24 photographs;
- change any committed WebP blob;
- add runtime calls to Wikimedia Commons or Creative Commons;
- widen the license allowlist;
- add a legal-status/compliance badge;
- change place ranking, grades, recommendations, itinerary logic or planning state.

The 190 non-pilot places remain on the existing `imageBrief` fallback.

---

## 2. Current-source recheck

Recheck date: **2026-09-14 (America/Mexico_City)**.

All 24 exact Wikimedia Commons source-file pages recorded by Phase 4A were re-opened against current
public Commons content before this corrective was finalized.

The recheck compared:

- exact file identity;
- creator/credit;
- current license family/version;
- current license URI;
- source/title information where explicitly supplied.

No material drift was found that requires removing or replacing one of the 24 existing assets.

The exact Sefa-utaki file `Okinawa Nanjo Sefa-utaki Gusuku site Yuinchi 04.jpg` required following
its current Commons category link because a direct tool open initially failed. Its actual current
file page was then reached and confirms:

- author: Hyppolyte de Saint-Rambert;
- own work;
- CC BY 4.0;
- the normal CC BY 4.0 requirement to give credit, link the license and indicate changes.

Related deletion discussions exist for *other* Sefa-utaki photographs by the same uploader. That is
not normalized into a defect in this exact record: the selected Yuinchi 04 file remains published
under the recorded license and did not present a current deletion banner in this recheck. Future
maintenance remains fail-closed per file.

### 2.1 Separately source-backed attribution titles

Phase 4B explicitly prohibited treating a Commons filename as proof of a licensor-supplied work
title.

The current-source recheck supports a separate source/title string for exactly three existing
records:

| place | license | separately source-backed attribution title |
|---|---|---|
| JP-002 | CC BY 2.0 | `Yoyogi Park and Shinjuku Skyline from Shibuya Sky Observation Deck` |
| JP-077 | CC BY 2.0 | `Katsura Imperial Villa / 桂離宮 X` |
| JP-179 | CC BY 2.0 | `DSC04640` |

No other record receives an `attributionTitle` merely by transforming its
`originalTitle: "File:..."`.

---

## 3. Metadata contract

Both copies of photography metadata remain byte-identical:

- `data/visual/photography-metadata.json`;
- `app/src/data/photography-metadata.json`.

Every existing image already carried `licenseUrl` and `originalTitle`. Phase 4C adds a factual
closed processing value and, for the three records above only, `attributionTitle`.

### 3.1 Processing vocabulary

Exactly two values are accepted:

- `webp-reencoded`;
- `resized-and-webp-reencoded`.

They describe Nihon's local processing, not copyright status.

The value is mechanically consistent with the original dimensions already recorded by Phase 4A:

- **23/24** originals have a longest side greater than 1600 px → `resized-and-webp-reencoded`;
- **1/24**, JP-077 at 1600 × 900 → `webp-reencoded`.

No value named `derivative`, `modified-work`, `compliant`, `cleared`, `safe` or similar is
introduced.

### 3.2 Validator tightening

`scripts/validate-photography.py` now rejects:

- missing/malformed `licenseUrl` for **every supported license**, including CC0;
- empty `attributionTitle` when the optional field is present;
- unknown processing values;
- missing/non-positive/non-integer original dimensions;
- a processing value that contradicts the recorded original dimensions.

The existing license allowlist is unchanged.

---

## 4. Runtime adapter

`PlaceImage` now has optional attribution-only fields:

- `licenseUrl`;
- `sourceFileTitle`;
- `attributionTitle`;
- `processing`.

`app/src/data/place-images.ts` maps:

- metadata `licenseUrl` → runtime `licenseUrl`;
- metadata `originalTitle` → runtime `sourceFileTitle`;
- optional metadata `attributionTitle` → runtime `attributionTitle`;
- metadata `processing` → runtime `processing`.

Embedded `PlaceImage` callers remain source-compatible because all four additions are optional.

---

## 5. Visible attribution

The existing compact `.gallery__credit` line remains the only presentation owner.

For a Phase 4A/4C image it can now render:

1. Wikimedia Commons source name linked to the exact Commons file page;
2. creator credit when recorded;
3. license name linked to the exact recorded `licenseUrl`;
4. Commons source-file title as provenance;
5. separately source-backed attribution title when present;
6. factual local processing disclosure.

Processing copy is deliberately factual:

- `Archivo optimizado por Nihon: convertido a WebP.`
- `Archivo optimizado por Nihon: redimensionado y convertido a WebP.`

It never calls the file legally safe, cleared, compliant or approved.

---

## 6. Image-blob invariant

Comparison from Phase 4B base to the validated Phase 4C HEAD reports **zero changed `.webp`
paths**.

Therefore all 24 committed image blobs are byte-unchanged.

Phase 4C changed attribution metadata and the presentation/validation path only.

---

## 7. Automated validation

Exact executable/test HEAD:
`cf71d0cbb59b5695f0addf8f6f7de7ccfe86a7a0`.

GitHub Actions run `34924302760` passed all steps:

- `python scripts/validate-photography.py` — PASS;
- complete Python discovery suite — **442 tests passed**;
- complete Vitest suite — **65 files / 2433 tests passed**;
- oxlint — **0 warnings / 0 errors**;
- TypeScript + Vite build — PASS;
- Phase 4C Chromium audit — PASS;
- the same Chromium audit a **second consecutive time** — PASS;
- `git diff --check origin/main...HEAD` — PASS.

### 7.1 Browser proof

The real Chromium audit:

- enters the Tokio hub through the national explorer;
- opens SHIBUYA SKY (JP-002);
- confirms the visible Wikimedia Commons source link;
- confirms the visible CC BY 2.0 license link points to the recorded Creative Commons URI;
- confirms Stephen Kelly credit;
- confirms the Commons source-file title;
- confirms the separately source-backed attribution title;
- confirms the resize + WebP disclosure;
- opens the real lightbox;
- confirms focus moves to the close control;
- confirms Tab remains trapped while the modal is open;
- confirms Escape closes the lightbox and restores focus to the zoom control;
- opens non-pilot Nezu Museum;
- confirms the existing `Sin fotografía disponible todavía` fallback;
- confirms no photography attribution line is invented for that fallback;
- reports no console or page errors.

---

## 8. Hostile review

The implementation was reviewed against the failure modes identified in Phase 4B.

| challenge | result |
|---|---|
| filename treated as legal work title | rejected; `sourceFileTitle` and `attributionTitle` stay distinct |
| title invented for every record | rejected; only three source-backed titles recorded |
| textual license without link | closed; `licenseUrl` reaches visible presentation |
| CC0 silently exempted from license URL integrity | closed; validator requires its recorded URL too |
| processing claim overstates what happened | closed vocabulary tied to original dimensions |
| legal derivative-work conclusion | absent |
| attribution fields added but dropped by adapter | tests pin metadata → registry |
| UI displays provenance but not real license link | browser audit pins the actual anchor |
| new image bytes slipped into corrective | zero changed WebP paths |
| runtime network introduced | absent |
| fallback regression | real Nezu Museum browser case passes |
| lightbox accessibility regression | real focus/Tab/Escape path passes |
| license allowlist widened | unchanged |
| related Commons source concern generalized across uploader | rejected; fail closed per exact file |

No corrective production change was required after the exact-head run. The three failed earlier
workflow runs were browser-harness navigation ambiguities only; Python, Vitest, lint and build were
already green in those runs, and the final harness was then validated twice in Chromium.

---

## 9. Successor boundary

Phase 4B authorized photography acquisition only **after** this corrective closes.

The next bounded phase may therefore be:

**Phase 4D — S-Grade Licensed Photography Acquisition Batch**

Maximum scope:

- the 16 currently uncovered S-grade places identified by Phase 4B;
- at most one new photograph per target place;
- the same current Commons/license/manual visual-review policy;
- no silent place substitution when a safe representative image cannot be found;
- no second photographs for already-covered places;
- no runtime remote fetching;
- no license-policy widening.

Phase 4D is **not started by Phase 4C**.
