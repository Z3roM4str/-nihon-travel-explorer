# Phase 4F — A-Grade Licensed Photography Acquisition Batch I

Status: **implemented and exact-head validated; PR remains Draft pending independent closure gate**

Base: `b8d8bf19a3985a4823b571c97795d9564b3dfa41`  
Issue: #102  
PR: #103  
Acquisition/validation date: **2026-09-15 (America/Mexico_City)**

Authority:
- `docs/A_GRADE_PHOTOGRAPHY_SCALE_DESIGN.md`
- `docs/PHOTOGRAPHY_ATTRIBUTION_SCALE_DESIGN.md`
- `docs/PHOTOGRAPHY_ATTRIBUTION_COMPLETENESS_RUNTIME.md`
- `docs/PHOTOGRAPHY_S_GRADE_BATCH_RUNTIME.md`

## Outcome

The Phase 4E selector reproduced exactly the authorized 24-target fixture.

- attempted targets: **24**
- accepted local photographs: **22**
- failed closed: **2**
- coverage: **36 → 58 / 214 = 27.1%**
- new-asset delta: **5,457,240 bytes (5.20 MiB)**
- soft batch budget: **8 MiB**
- hard review threshold: **12 MiB**

The actual batch finished below the soft budget. No quality-floor, source-policy or license-policy relaxation was used to meet the budget.

## Accepted targets

One local WebP photograph was accepted for each of:

`JP-068`, `JP-210`, `JP-155`, `JP-103`, `JP-206`, `JP-009`, `JP-099`,
`JP-108`, `JP-018`, `JP-085`, `JP-164`, `JP-115`, `JP-037`, `JP-093`,
`JP-160`, `JP-141`, `JP-040`, `JP-102`, `JP-174`, `JP-116`, `JP-092`,
and `JP-005`.

All accepted records use Wikimedia Commons source pages and the pre-existing supported license allowlist. Canonical metadata remains the source of truth and the app-facing copy is byte-identical.

The accepted records include CC0, CC BY and CC BY-SA variants already supported by the repository. No NC, ND, fair-use or AI-generated substitute was introduced.

## Failed-closed targets

### JP-050 — PokéPark KANTO

No photograph was accepted in this batch.

The target remained subject to the Phase 4E branded/copyright-sensitive rule: an accepted image had to be a defensible representation of the place while avoiding an unresolved subject-matter/privacy/location problem. The acquisition pass did not establish an acceptable record under that standard, so the place remains on its existing no-photograph fallback.

No substitute target was used.

### JP-195 — Yaeyama stargazing experience

No photograph was accepted in this batch.

The target remained subject to the ordinary subject-match rule: an accepted image had to establish the named experience/location rather than merely provide generic night-sky imagery. The acquisition pass did not establish an acceptable record under that standard, so the place remains on its existing no-photograph fallback.

No substitute target was used.

These are fail-closed acquisition outcomes, not legal-clearance conclusions.

## Temporal subject

JP-206 — Otaru Snow Light Path uses a prior-edition Commons photograph of the recurring event.

The runtime attribution and browser audit do **not** represent that photograph as the 2027 edition and do not infer a 2027 schedule, availability or operating-state proposition from the image.

## Preserved invariants

Validation proved:

- all **36** pre-Phase-4F metadata records are unchanged;
- all pre-existing image paths are unchanged;
- canonical/app photography metadata are byte-identical;
- there are exactly **58** registered images;
- no place has more than one registered photograph;
- the supported license allowlist is unchanged;
- JP-050 and JP-195 retain the no-photograph fallback;
- photography remains local/offline at runtime;
- no Commons, Wikipedia or Creative Commons photography request occurs during rendering;
- no ranking, recommendation, itinerary, grade, routing or planning behavior changed.

## Browser QA

The Phase 4F browser audit covers:

1. ordinary acquired subject — JP-103 Dotonbori;
2. temporal-risk subject — JP-206 Otaru Snow Light Path;
3. both failed-closed fallbacks — JP-050 and JP-195;
4. zero runtime photography-provider fetches.

The first audit harness attempt exposed a navigation assumption: Sapporo is a hub but its prefecture entry is Hokkaido. The harness was corrected without changing runtime/data behavior.

## Exact-head validation

Validated executable/test HEAD:

`3d7bdaf115a65cc8e43ee7b98f5adcb5ab474b55`

GitHub Actions run:

`35024168261` — **SUCCESS**

The run passed:

- exact Phase 4E selector reproduction;
- photography validator;
- Python test suite;
- focused photography tests;
- full Vitest;
- lint;
- build;
- Phase 4F invariants and asset-budget gate;
- Chromium installation;
- Phase 4F browser audit twice;
- Phase 4C browser regression audit;
- whitespace gate.

The temporary exact-head workflow checked out the executable/test SHA above explicitly, so later documentation and workflow-removal commits do not alter the validated executable tree.

## Scope boundary

Phase 4F does **not** authorize:

- second images for already-covered places;
- gallery redesign;
- license-policy widening;
- runtime Commons fetching;
- ranking/recommendation changes;
- itinerary/routing/planning changes;
- replacement targets for JP-050 or JP-195;
- an unbounded continuation through the remaining A-grade catalog.

Any further scale-up requires a separate successor design gate that re-establishes target priority, batch size, asset budget and sourcing constraints.


## Workflow cleanup proof

Temporary workflow cleanup commit:

`19f64e35dc4ffa687c680525f7b0f64f21b8d571`

Comparison from the validated executable/test HEAD
`3d7bdaf115a65cc8e43ee7b98f5adcb5ab474b55` to the post-cleanup tree shows only:

- removal of `.github/workflows/phase4f-acquire.yml`;
- removal of `.github/workflows/phase4f-exact-head.yml`;
- addition of this runtime document;
- the Phase 4F ROADMAP documentation update.

There is **zero drift in executable code, canonical/app data, tests, selector scripts, or image assets** after the successful exact-head validation.
