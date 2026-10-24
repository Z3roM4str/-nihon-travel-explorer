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

The independent audit gate in section 9 then found two further defects, neither of them in
production runtime, and re-sealed the tree.

---

## 9. Independent audit gate

An independent hostile review was run against the live PR head
`0e43ad356d51623f28cf192d9f2fe3ad74bd2a9d`.

### 9.1 State of the reported blocker

The handoff recorded run `34924122384` failing at the first Chromium pass. That failure was a
Playwright strict-mode violation: `/Explorar desde Tokio/` matched both the region-hub button and
the prefecture-panel button. It was **already fixed** before this audit began, by the `.first()` and
place-list-row locators, and run `34924302760` at `cf71d0c` had already passed the whole matrix
including both browser passes. The PR body simply still cited the stale failing run.

### 9.2 Correction 1 — the browser audit was environment-dependent

The audit nevertheless failed when re-run here, for an unrelated reason: it asserts zero console
errors, and the pre-existing place map streams OpenStreetMap tiles. Those tile loads fail behind a
TLS-inspecting proxy or with no internet, producing console errors and tripping the assertion. The
audit therefore passed in CI only because the runner had working internet — it would fail for any
contributor running it offline.

Every non-localhost request is now intercepted and answered locally with a 1×1 transparent PNG.
Aborting them was tried first and rejected: `route.abort()` itself logs `net::ERR_FAILED`, so
fulfilling is what keeps the console-error assertion exactly as strict as before instead of quietly
relaxing it.

The interception is also used to **prove** a property the audit previously only assumed: no
intercepted request is a Wikimedia, Wikipedia or Creative Commons host, and the rendered gallery
image is served from the local build. A negative control — temporarily widening the host pattern to
match the tiles — confirmed the assertion fires rather than being dead code.

Diagnosed as harness-only. No Phase 4C attribution assertion was weakened or removed, and no
production file was touched.

### 9.3 Correction 2 — `licenseUrl` was not bound to the license it claims

The validator checked only that `licenseUrl` was a well-formed http(s) URL. A record could therefore
declare `CC BY 4.0` while linking `licenses/by-sa/2.0`, or an unrelated host entirely, and pass every
check. The visible attribution renders that URL as *the* license, so the result would be a legally
wrong public claim — the exact defect class this phase exists to close.

The expected path is now derived from the license name rather than kept in a hand-maintained table,
so a license added to `SUPPORTED_LICENSES` cannot silently skip the agreement check; a test asserts
every supported license resolves to a canonical path. Regression tests cover a mismatched family, a
mismatched version, CC0 pointing at an attribution license and a wrong host, plus the canonical forms
actually in use including the trailing-slash and CC0 deed variants.

No metadata changed: all 24 records were already consistent, and the validator still reports the
catalog valid. Confirmed independently — each license maps to exactly one URL across the catalog.

### 9.4 Re-verified invariants

| invariant | result |
|---|---|
| 24 WebP blobs byte-identical to base | 0 changed paths under `app/public/images/**` |
| photograph count | 24 on base, 24 on head |
| metadata records | 24 → 24; no added, removed or re-pathed `placeId` |
| canonical/app metadata parity | byte-identical |
| runtime Commons/network calls | none; only pre-existing OpenStreetMap tiles, asserted non-photographic |
| source link vs license link | distinct anchors, asserted by the browser audit |
| Commons filename as licensor title | never; rendered as `Archivo de Commons:`, separate from `Título de atribución:` |
| source-backed attribution titles | 3 of 24, all differing from the Commons filename; never derived from it |
| processing copy | factual re-encode/resize statement, cross-checked against real pixel dimensions |
| CC0 invented creator requirement | absent; `LICENSES_NOT_REQUIRING_CREDIT` preserved |
| non-pilot fallback | unchanged; real Nezu Museum case passes |
| lightbox Tab / Escape / focus restoration | unchanged; real focus path passes |

### 9.5 Exact-head validation

Exact validated executable HEAD:

`b19460bdfeddb2aeb6ad8717d07bdf380fff94c4`

Temporary workflow-bearing commit:

`2feaf1b6e0f15bbba6b89c7a77cb58a0033ad00d` — pinned `actions/checkout` to the SHA above with full
history, so the seal binds to that tree rather than to the branch tip.

GitHub Actions run:

`34926995717` — **SUCCESS**, all steps:

- exact-head checkout;
- photography validator;
- Python test suite (445 tests);
- dependency install;
- focused Phase 4C tests;
- full Vitest (2433 tests, 65 files);
- lint;
- build;
- photography blob-integrity gate (0 changed blobs, 24 WebP, metadata parity);
- Chromium install;
- Phase 4C browser audit first pass;
- Phase 4C browser audit second pass;
- whitespace gate.

Temporary workflow removed in:

`2ed958703f057fba6a1d0cb7dee4dc06203d8149`

**Tree-drift proof:** the diff from the validated HEAD to the post-removal head reports **zero
changed files of any kind** — the workflow was added after the validated HEAD and removed again, so
the post-removal tree is byte-identical to the tree that passed validation.

PR #96 remains **Draft**. Not merged.

---

## 10. Successor boundary

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
