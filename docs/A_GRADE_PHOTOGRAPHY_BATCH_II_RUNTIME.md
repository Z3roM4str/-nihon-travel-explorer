# Phase 4H — A-Grade Licensed Photography Acquisition Batch II

Status: **complete — exact-head validated and independently closure-reviewed**

Base: `589d64a87d1963622fdf64c07be31460f145f79c`  
Issue: #106  
PR: #107  
Acquisition/validation date: **2026-09-15 / 2026-09-16 (America/Mexico_City)**

Authority:
- `docs/PHOTOGRAPHY_SCALE_UP_II_DESIGN.md`
- `docs/A_GRADE_PHOTOGRAPHY_BATCH_I_RUNTIME.md`
- `docs/PHOTOGRAPHY_ATTRIBUTION_SCALE_DESIGN.md`
- `docs/PHOTOGRAPHY_ATTRIBUTION_COMPLETENESS_RUNTIME.md`
- `docs/PHOTOGRAPHY_S_GRADE_BATCH_RUNTIME.md`
- Phase 4G ROADMAP successor contract

## Outcome

The Phase 4G selector reproduced exactly the authorized 32-target fixture
(`trancheSize` 32, `eligibleCount` 115, `distinctCategoryCount` 19, hub quotas
Kioto 8 / Okinawa 8 / Osaka 7 / Sapporo 1 / Tokio 8).

- attempted targets: **32**
- accepted local photographs: **27**
- failed closed: **5**
- coverage: **58 → 85 / 214 = 39.7%**
- new-asset delta: **7,438,738 bytes (7.09 MiB)**
- soft batch budget: **10 MiB**
- hard review threshold: **14 MiB**

The batch finished **below even the soft budget**. No quality-floor, source-policy or
license-policy relaxation was used to meet the budget. There is no replacement queue:
each of the 32 targets was attempted independently and every failure remains uncovered.

## Accepted targets

One local WebP photograph was accepted for each of:

`JP-101`, `JP-207`, `JP-028`, `JP-070`, `JP-161`, `JP-111`, `JP-008`,
`JP-090`, `JP-180`, `JP-151`, `JP-046`, `JP-159`, `JP-128`, `JP-016`,
`JP-127`, `JP-208`, `JP-098`, `JP-167`, `JP-146`, `JP-026`, `JP-061`,
`JP-182`, `JP-118`, `JP-049`, `JP-058`, `JP-181`, and `JP-015`.

All accepted records use Wikimedia Commons source pages and the pre-existing supported
license allowlist (CC0, CC BY and CC BY-SA variants). No NC, ND, fair-use or
AI-generated substitute was introduced. Canonical metadata remains the source of truth
and the app-facing copy is byte-identical.

## Failed-closed targets

### JP-121 — Expo '70 Park + Tower of the Sun

Commons flags Tower of the Sun as a modern artistic work with Japan freedom-of-panorama
concerns; discovery yielded only incidental or poor subject-match views, so no defensible
target image was accepted.

Evidence: `https://commons.wikimedia.org/wiki/Category:Tower_of_the_Sun`

### JP-156 — Sakaemachi Arcade nightlife

The exact Sakaemachi Market photographs found are marked Public domain, which is outside
the Phase 4H CC0 / CC BY / CC BY-SA allowlist. The policy was **not** widened to admit
them, and no allowed-license alternative was established.

### JP-095 — teamLab Biovortex Kyoto

Two Commons discovery passes found no defensible candidate under the existing
source/license/subject rules.

### JP-079 — Kyoto Rakusai Bamboo Park

Refined Commons searches returned archival/public-domain documents rather than a
defensible photograph of the park; no allowed-license subject match was established.

### JP-202 — Whale watching in the Kerama waters

Discovery did not establish a representative still photograph of the experience; the only
allowed media hit was an underwater WebM, which does not satisfy the first-photo
requirement.

These are fail-closed acquisition outcomes, not legal-clearance conclusions. No substitute
target was used for any of them.

## Carried fail-closed targets

The six previously carried fail-closed IDs — `JP-033`, `JP-126`, `JP-203`, `JP-204`,
`JP-050`, `JP-195` — were excluded from the eligible universe and did not re-enter. They
may re-enter only through a future design gate with materially new sourcing evidence.

## Temporal subjects

- **JP-207 — Lake Shikotsu Ice Festival** uses a prior-edition (2015) Commons photograph
  of the recurring event.
- **JP-208 — Kawazu Cherry Blossom Festival** uses a prior-edition (February 2019)
  photograph; the Commons description and `Kawazu River` / `Kawazu, Shizuoka` categories
  confirm the location is Kawazu itself rather than the wider Izu Peninsula.

Shipped alt copy describes both as "una edición" / "una edición anterior". The runtime
attribution and browser audit do **not** represent either photograph as the 2027 edition
and do not infer a 2027 schedule, availability, operating state or wildlife guarantee
from photography.

## Branded and sensitive subjects

Accepted branded-adjacent targets use exterior, entrance, facade or signage frames, as the
Phase 4H contract requires:

- **JP-008 — Shibuya PARCO + Nintendo TOKYO**: store entrance frame; no Commons
  restriction flag.
- **JP-026 — Retro game hunt**: Super Potato facade/signage in Akihabara.
- **JP-049 — Ikebukuro anime district**: Animate Ikebukuro building. The Commons file
  carries a `trademarked` non-copyright restriction together with Commons' own
  `De minimis` and `With trademark` categories — the incidental advertising artwork is
  not the dominant subject, and the file's CC BY 2.0 license is unaffected. Shipped alt
  copy describes the building and district, not the characters.

Targets whose defensible framing could not be established were failed closed rather than
accepted under a widened rule.

## Preserved invariants

Validation proved:

- all **58** pre-Phase-4H metadata records are unchanged;
- all **58** pre-Phase-4H image blobs are byte-identical by SHA to the exact base;
- canonical/app photography metadata are byte-identical;
- there are exactly **85** registered images and exactly **85** WebP assets;
- no place has more than one registered photograph;
- no duplicate `placeId`, and no duplicate Commons source or acquisition URL anywhere in
  the catalog;
- the supported license allowlist is unchanged;
- the five failed-closed places retain the no-photograph fallback;
- photography remains local/offline at runtime;
- no Commons, Wikipedia or Creative Commons photography request occurs during rendering;
- no ranking, recommendation, itinerary, grade, routing or planning behavior changed, and
  no gallery redesign occurred.

## Browser QA

The Phase 4H browser audit covers:

1. ordinary acquired subject — JP-028 Jimbocho Book Town;
2. branded/sensitive subject — JP-008 Shibuya PARCO + Nintendo TOKYO;
3. temporal-risk subject — JP-207 Lake Shikotsu Ice Festival, prior-edition imagery with
   no 2027 inference;
4. failed-closed fallback — JP-121 Tower of the Sun;
5. zero runtime photography-provider fetches.

It ran twice in the validating run, alongside the Phase 4F and Phase 4C browser
regression audits. Console and page errors were zero in every pass.

## Corrective pass

The first exact-head attempt (run `35040843847`, executable/test HEAD
`0de09f332a7eb776b36b1d4645b15bfae2a38f4c`) failed at the Python test suite with five
assertions in `scripts/test_a_grade_photography_selector.py`.

The failure was a **stale historical test fixture, not a Phase 4H production defect**. The
Phase 4E/4F fixture rebuilt its 36-record baseline by subtracting only the pinned Phase 4F
target IDs from the live catalog. That held while the catalog was 58 records, but Phase 4H
appends 27 accepted records, so the reconstruction yielded 63 and the helper's guard
tripped:

```
AssertionError: Phase 4E baseline reconstruction expected 36 records, found 63
```

The baseline is now derived twice, and both derivations must agree:

1. *semantically* — drop every place ID claimed by a post-Phase-4E batch manifest,
   discovered from the checked-in manifests rather than hard-coded, so later batches are
   removed automatically;
2. *positionally* — take the leading 36 records, which the append-only canonical registry
   guarantees is the Phase 4E era.

A later batch that appends records without checking in a matching manifest, or that breaks
append-only ordering, makes the two derivations diverge and fails loudly instead of
silently replaying a different catalog. Record *content* is still read live from the
canonical registry, so attribution corrections to those 36 records flow through rather
than rotting in a frozen copy.

The expected 36-record count and every downstream assertion are unchanged. No assertion was
weakened, the count was not changed to 63, and Phase 4E was not made to select from the
current catalog. The property was verified against a simulated future batch: the fixture
still reproduces with a 93-record catalog when a manifest is present, and fails loudly when
one is absent.

No image, metadata or asset was modified by the corrective pass.

## Exact-head validation

Validated executable/test HEAD:

`cda32ceb61372fc7f0599b59ce28261b4b196a4e`

GitHub Actions run:

`35047755114` — **SUCCESS**

The run passed all twenty steps, with none skipped:

- exact Phase 4G selector reproduction (`selector fixture reproduced`);
- photography validator;
- full Python test suite (**462 tests**);
- `npm ci`;
- focused photography tests (3 files);
- full Vitest (**65 files**);
- lint;
- build;
- Phase 4H invariants and asset-budget gate, printing
  `Phase 4H asset delta: 7438738 bytes (7.09 MiB)` and
  `OK: 58 prior records/assets preserved; 27 accepted; 5 fail-closed; 85 total`;
- Chromium installation;
- Phase 4H browser audit twice;
- Phase 4F browser regression audit;
- Phase 4C browser regression audit;
- whitespace gate.

The temporary exact-head workflow checked out the executable/test SHA above explicitly, so
later documentation and workflow-removal commits do not alter the validated executable
tree.

## Hostile review

An independent hostile review was run after the green exact-head validation. It re-queried
the live Wikimedia Commons API for all 27 accepted files and found **no real defects**:

- all 27 Commons source pages resolve; none is missing or deleted;
- recorded `license` matches the live Commons `LicenseShortName` for all 27;
- recorded `originalWidth`/`originalHeight` match live Commons dimensions for all 27;
- every `licenseUrl` matches its license name;
- every `credit` is drawn verbatim from the Commons `Artist` field — including JP-046 and
  JP-026, whose trailing Flickr link and camera note are present in the source field
  itself, so the records over-attribute rather than under-attribute;
- `originalTitle`, `sourceUrl` and `acquisitionUrl` filenames agree once percent-encoding
  is decoded, for all 27;
- no duplicate Commons source across the whole 85-record catalog;
- subject match confirmed for all 27 against Commons descriptions and categories;
- branded/sensitive and temporal handling as described above;
- the five Phase 4H and six carried fail-closed IDs are absent from the catalog;
- the 58 prior records and blobs are unchanged; canonical/app parity holds;
- asset delta reproduces at exactly 7,438,738 bytes;
- no second image, no runtime external photography fetch, no ranking, recommendation,
  itinerary, routing or grade drift, and no gallery redesign.

Two observations were recorded as **non-defects**: the dataset assigns JP-208 (Kawazu,
Shizuoka) and JP-151 (Ine, Kyoto Prefecture) to the Tokio and Osaka hubs respectively.
Those hub assignments are pre-existing `data/places.json` facts carried by the pinned Phase
4G fixture; `data/places.json` is unchanged in Phase 4H and correcting them would be
out-of-scope grade/ranking drift.

No corrective change was required by the hostile review.

## Scope boundary

Phase 4H does **not** authorize:

- second images for already-covered places;
- gallery redesign;
- license-policy widening;
- runtime Commons fetching;
- ranking/recommendation changes;
- itinerary/routing/planning changes;
- replacement targets for the five failed-closed IDs;
- re-entry of the six carried fail-closed IDs;
- an unbounded continuation through the remaining A-grade catalog.

Any further scale-up requires a separate successor design gate that re-establishes target
priority, batch size, asset budget and sourcing constraints.

## Workflow cleanup proof

Temporary workflow cleanup commit:

`9c67df8` — removes all four temporary Phase 4H workflows:

- `.github/workflows/phase4h-selector-preflight.yml`
- `.github/workflows/phase4h-commons-discovery.yml`
- `.github/workflows/phase4h-acquire.yml`
- `.github/workflows/phase4h-exact-head.yml`

The Phase 4H base `589d64a87d1963622fdf64c07be31460f145f79c` carried no workflows at all
(Phase 4F and Phase 4G had already removed their own temporary workflows), so this removal
restores the base state exactly. No non-Phase-4H workflow existed or was touched.

Comparison from the validated executable/test HEAD
`cda32ceb61372fc7f0599b59ce28261b4b196a4e` to the post-cleanup tree shows only:

```
D  .github/workflows/phase4h-acquire.yml
D  .github/workflows/phase4h-commons-discovery.yml
D  .github/workflows/phase4h-exact-head.yml
D  .github/workflows/phase4h-selector-preflight.yml
A  docs/A_GRADE_PHOTOGRAPHY_BATCH_II_RUNTIME.md
M  docs/ROADMAP.md
```

That is, only documentation and the removal of temporary workflows.

There is **zero drift in executable code, canonical/app photography metadata, selector
scripts, tests, or image assets** after the successful exact-head validation. Measured
drift from the validated HEAD is 0 files across `scripts/`, `app/src/`, `app/scripts/`,
`data/` and `app/public/images/`.
