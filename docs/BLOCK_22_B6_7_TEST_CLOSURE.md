# Block 22 B6.7 — test closure

**Branch:** `claude/block-22-b6-7-test-closure`. **Base SHA:** `4afbf50e9d1e3137f9148c6c471c1c40aac6a56f`
(= `origin/codex/block-22-b6-7-grade-a-depth-photography`, tip commits `8601a9d` "feat(photography):
add B6.7 depth batch 1" and `4afbf50` "feat(photography): add B6.7 depth batch 2"). This is a
**test-alignment mission**, not a product mission: B6.7 deliberately gave a second photograph to
11 places; some pre-existing test expectations still assumed the old single-photo state. Nothing
under `app/src/data`, `app/src/components`, `app/public/images`, or any dataset/metadata file was
touched — only test files, one gate script, and documentation.

## Normative source for B6.7's authorized scope

`scripts/select-block22-b6-7-targets.py` (added by commit `8601a9d`) derives the B6.7 target set
programmatically from `data/places.json` and `data/visual/photography-metadata.json`:

```python
tourism_ids = {... place["tourismLevel"] in {"Extremo", "Alto"} ...}   # grade A only
hidden_gem_ids = {... place["hiddenGemStatus"] == "Hidden Gem real" ...}  # grade A only
qualified_ids = tourism_ids | hidden_gem_ids
```

`data/visual/block22-b6-7-acquisition-plan.json` (also from `8601a9d`/`4afbf50`) lists the 11
places that received a second photograph: **JP-001, JP-002, JP-003, JP-007, JP-010, JP-013,
JP-016, JP-017, JP-030, JP-034, JP-047**. Cross-checking `data/places.json`: all are grade A;
JP-047 is the one whose `tourismLevel` is "Bajo" but whose `hiddenGemStatus` is "Hidden Gem real"
— it qualifies only through the Hidden Gem branch of the script's own criterion. This is the
authority used below wherever a test's qualifying criterion needed to be widened.

Grade-S depth (pre-existing, e.g. `JP-021`, `JP-089`, `JP-125`, `JP-129`, `JP-152`, `JP-205`) and
the B6.4/B6.5 experience/complementary batches are untouched; B6.7 only adds the 11 ids above.

## Vitest — before/after

**Before (measured on base `4afbf50e`):** `100` test files, `3321/3329` passing, `8` failing —
all inside `app/src/data/place-images.test.ts` (5 failures) and
`app/src/photography-depth.test.ts` (3 failures).

**After:** `100` test files, `3329/3329` passing, `0` failing.

### Failure 1–3 (place-images.test.ts): tranche `toHaveLength(1)` loops now fail for ids that
became B6.7 depth targets

- **Old expectation:** the Phase 4H, 4J, and 4L tranche tests asserted `toHaveLength(1)` for
  every id in their historical acquisition lists — correct at the time, because no B6.7 existed
  yet.
- **What B6.7 changed:** JP-016 (Phase 4H list), JP-013 and JP-047 (Phase 4J list), and JP-007
  and JP-017 (Phase 4L list) each received a second photograph.
- **New authorized contract:** these five ids keep at least one photograph (their original
  tranche identity is untouched), but the "exactly 1" assertion no longer applies to them; the
  precise "exactly 2, and only for authorized ids" invariant is what the two tests described
  under Failure 4–5 now enforce.
- **File modified:** `app/src/data/place-images.test.ts` — in the three affected `it(...)`
  blocks, ids present in a new `b67AcquiredPlaceIds` list (loaded from
  `data/visual/block22-b6-7-acquisition-plan.json`, the same pattern already used for
  `b64AcquiredPlaceIds`/`b65AcquiredPlaceIds`/`b66AcquiredPlaceIds`) are checked with
  `expect(placeImages[placeId]?.length).toBeGreaterThanOrEqual(1)` instead of `toHaveLength(1)`;
  every other id in each tranche is still held to exactly 1.
- **Evidence:** `data/visual/block22-b6-7-acquisition-plan.json` entries list; commits `8601a9d`
  and `4afbf50`.

### Failure 4 (place-images.test.ts): "gives additional photographs only to the places selected
by Block 2, B6.4, and B6.5"

- **Old expectation:** the deliberate-galleries set was `{6 Block 2 ids} ∪ b64AcquiredPlaceIds ∪
  b65AcquiredPlaceIds`.
- **What B6.7 changed:** added galleries for 11 more ids, not present in that set.
- **New authorized contract:** the deliberate-galleries set now also includes
  `b67AcquiredPlaceIds` (loaded from `data/visual/block22-b6-7-acquisition-plan.json`). The test
  still asserts the gallery id list equals this set *exactly* — an unauthorized 12th gallery
  still fails it.
- **File modified:** `app/src/data/place-images.test.ts` — added the `b67Plan`/
  `b67AcquiredPlaceIds` loader and spread it into the `deliberatelySelected` set; renamed the test
  title to mention B6.7.
- **Evidence:** same acquisition-plan file; commit `8601a9d`/`4afbf50`.

### Failure 5 (place-images.test.ts): "keeps every place outside those selections at exactly one
photograph"

- Same root cause and fix as Failure 4: `b67AcquiredPlaceIds` added to the `depth` exclusion set
  so the loop still asserts `count === 1` for every place B6.7 did **not** touch.
- **File modified:** `app/src/data/place-images.test.ts`, same block.

### Failure 6 (photography-depth.test.ts): "adds depth only to places of the highest interest" —
JP-047 `qualifies: false`

- **Old expectation:** `qualifies = grade === "S" || (grade === "A" && tourismLevel in
  {"Extremo", "Alto"})`.
- **What B6.7 changed:** JP-047 (grade A, `tourismLevel: "Bajo"`, `hiddenGemStatus: "Hidden Gem
  real"`) received a second photograph under B6.7's own documented criterion, which includes a
  Hidden Gem branch the test's criterion did not.
- **New authorized contract:** `qualifies = grade === "S" || (grade === "A" && (tourismLevel in
  {"Extremo", "Alto"} || hiddenGemStatus === "Hidden Gem real"))`.
- **File modified:** `app/src/photography-depth.test.ts` — widened the `qualifies` expression and
  added `hiddenGemStatus` to the local `Place` type; added a comment citing
  `scripts/select-block22-b6-7-targets.py`'s `qualified_ids = tourism_ids | hidden_gem_ids`.
- **Evidence:** `scripts/select-block22-b6-7-targets.py` (`qualified_ids` derivation);
  `data/places.json` JP-047 record; commit `8601a9d`.
- **Precision preserved:** this widens the *criterion*, not the assertion's strictness — a
  gallery on a grade-B place, or a grade-A place with neither Extremo/Alto tourism nor a real
  Hidden Gem, still fails this test.

### Failure 7 (photography-depth.test.ts): "leaves the great majority of the catalogue at a
single photograph" — `170 not > 171.7`

- **Old expectation:** `covered - galleries.length > covered * 0.85` (covered = 202, so > 171.7).
- **What B6.7 changed:** added 11 new galleries (21 → 32), moving the single-photograph count to
  170/202 (~84.2%), just under the old 85% bar.
- **New authorized contract:** the bar is lowered to 80% (`> covered * 0.8`), which 170/202 still
  clears with margin, while still catching a catalogue-wide, undocumented expansion (e.g. if
  every remaining grade-A/grade-S place suddenly got a second photograph).
- **File modified:** `app/src/photography-depth.test.ts` — threshold `0.85` → `0.8`, with a
  comment recording the exact 32/202 figure this was calibrated against and why (11 documented
  B6.7 additions, not a general trend).
- **Note on precision:** this is a statistical/threshold assertion, not a per-place identity
  check (unlike `toHaveLength(1)` elsewhere), so recalibrating it to match a documented, bounded
  change is not the kind of "weakening" the mission's constraint forbids; the two exact-count
  tests (Failure 4/5 fixes) still enforce the identity list precisely.

### Failure 8 (photography-depth.test.ts): "still resolves exactly one image for a
single-photograph place" — `resolvePlaceImages("JP-001")` now returns 2

- **Old expectation:** JP-001 (Shibuya Crossing) was a single-photograph place.
- **What B6.7 changed:** JP-001 is now a B6.7 depth target (its first entry in the acquisition
  plan).
- **New authorized contract:** the assertion is retargeted at JP-005 (Ota Museum's rival — an
  identity acquired in the Phase 4F tranche, never touched by any depth batch and confirmed via
  `place-images.test.ts`'s Phase 4F tranche list), which still resolves exactly one image.
- **File modified:** `app/src/photography-depth.test.ts` — changed the id under test from
  `"JP-001"` to `"JP-005"`, with a comment explaining why JP-001/JP-002 no longer fit.

## Phase 5A gate — before/after

Gate script: `app/scripts/phase5a-rc-browser-audit.mjs` (run against `npm run build` +
`vite preview`, Chromium via Playwright).

**Before (reproduced on base `4afbf50e`, desktop viewport):** `47/50` checks passed. 3 failures:

```
A06 place detail shows photograph and attribution: locator.waitFor: Error: strict mode
    violation: locator('.place-detail').locator('.gallery__image') resolved to 2 elements
A07 no-photo place shows the documented fallback: The input did not match the regular
    expression /Sin fotograf[íi]a disponible todav[íi]a/i. Input: 'Imagen 1 de 1Takeshita
    Street...' (i.e. Takeshita Street now HAS a photo)
E01 historical photograph renders from a local asset: locator.getAttribute: Error: strict
    mode violation: locator('.place-detail').locator('.gallery__image') resolved to 2 elements
```

**After:** `50/50` checks passed, both desktop (1440×900) and mobile (390×844) viewports.

### A06 — root cause and fix

- **Root cause:** A06 opens "Shibuya Crossing" (JP-001), a B6.7 depth target since batch 1
  (`8601a9d`). `.gallery__image` now matches 2 `<img>` elements, and Playwright's strict-mode
  locator throws instead of picking one.
- **This is not a fallback-text or contract problem** — it is exactly the kind of locator
  fragility the mission expected. The step's actual intent ("a photograph renders, with local
  asset path, decoded, alt text, and reachable Commons credit") is unaffected by there being one
  photograph or two.
- **Fix:** `.locator(".gallery__image")` → `.locator(".gallery__image").first()` in the A06 step,
  with a comment citing `8601a9d` and the acquisition plan.
- **File modified:** `app/scripts/phase5a-rc-browser-audit.mjs`.

### A07 — investigated, not auto-fixed; found a genuine, documented, unrelated staleness

- **Investigation:** the failure was *not* the fallback text being wrong — the regex
  `/Sin fotograf[íi]a disponible todav[íi]a/i` still matches
  `app/src/components/PlaceGallery.tsx:52`'s literal string
  `"Sin fotografía disponible todavía"` exactly, verbatim, unchanged. The real problem: Takeshita
  Street (JP-004) **now has a photograph** — it is no longer a no-photo place at all, so the
  fallback text never renders for it and the assertion's regex has nothing to match.
- **Provenance check:** `git log -p --follow -S'"placeId": "JP-004"' app/src/data/photography-metadata.json`
  shows JP-004's identity photograph was added in commit `801f399` — "feat: add grade C/D identity
  photography (B6.6)" — which **predates** B6.7 and predates this branch's base entirely (it's an
  ancestor of the base commit, already merged via PR #148 per
  `docs/BLOCK_22_B6_6_REPORT.md`/`docs/CURRENT_WORK_HANDOFF.md`). This is unrelated to B6.7; the
  A07 test was simply never updated after B6.6 shipped C/D coverage.
- **No new fallback text was invented.** The fix keeps the exact same regex and only swaps which
  place the journey opens, to one still genuinely uncovered at this branch's base:
  "Unicorn Gundam at DiverCity" (JP-041, grade B, Tokio hub). JP-041's fail-closed status is
  independently documented in `app/src/data/place-images.test.ts` ("carries the Phase 4J tranche
  ... Phase 4J's four fail-closed decisions remain historical facts ... The other three are still
  uncovered" — JP-120, JP-041, JP-168) and confirmed absent from
  `app/src/data/photography-metadata.json` at this SHA.
- **File modified:** `app/scripts/phase5a-rc-browser-audit.mjs` — `openPlace("Takeshita
  Street")` → `openPlace("Unicorn Gundam at DiverCity")`, with a comment recording why Takeshita
  Street no longer fits and citing commit `801f399`.

### E01 — root cause and fix

- **Root cause:** identical to A06 — Golden Gai (JP-013) is a B6.7 depth target (batch 1,
  `8601a9d`), so `.gallery__image` now matches 2 elements and the strict-mode locator throws.
- **Fix:** same pattern as A06, `.first()` on the locator, comment citing `8601a9d`.
- **File modified:** `app/scripts/phase5a-rc-browser-audit.mjs`.

## Other gates run

- **Build:** `npm run build` (tsc -b && vite build) — PASS, no errors, before and after.
- **Lint:** `npm run lint` (oxlint) — exit 0, only the pre-existing inherited warning
  `PlaceMap.tsx:14` (Fast Refresh export shape), unchanged before/after.
- **`scripts/validate-photography.py`:** `OK: photography pilot manifest and metadata are valid;
  all pilot places have a photograph` — unchanged, no product/data files were modified so this
  was never expected to move.
- **Python photography suites** (`python3 -m pytest scripts/test_block22_b6_7_photography.py
  scripts/test_block22_photography.py scripts/test_photography.py
  scripts/test_photography_rendition.py`): `79 passed, 30 subtests passed` — all green, no
  changes needed. B6.7's own Python test suite was already internally consistent; only the JS/TS
  tests and the JS gate script had stale expectations.
- **Full `scripts/` pytest run** (`python3 -m pytest scripts/ -q`): `19 failed, 590 passed, 9
  errors, 150 subtests passed`. **Pre-existing and unrelated** — none of the failing files
  (`test_a_grade_photography_selector[_ii].py`, `test_ab_photography_selector.py`,
  `test_phase4m_stop_vs_continue.py`, `test_block22_b6_4_photography.py`) were touched by B6.7's
  commits, and the `test_block22_b6_4_photography.py` errors are a plain `NameError:
  name 'BATCH_LIMIT' is not defined` at `setUpClass` — a bug in that historical test file itself,
  unrelated to any photo-count invariant and unrelated to B6.7. Not in this mission's known
  8-vitest/3-gate failure list; **left unfixed and documented here** rather than silently
  expanded into scope, since the mission's brief named only the Vitest and Phase 5A failures to
  close.

## Files touched

- `app/src/data/place-images.test.ts` — test file.
- `app/src/photography-depth.test.ts` — test file.
- `app/scripts/phase5a-rc-browser-audit.mjs` — gate script.
- `docs/BLOCK_22_B6_7_TEST_CLOSURE.md` — this document (new).
- `docs/CURRENT_WORK_HANDOFF.md` — new section at the top noting this parallel branch.

No file under `app/src/data/place-images.ts`, `app/src/data/photography-metadata.json`,
`app/src/components/`, `app/src/styles/`, `app/public/images/`, `data/places.json`, or any other
product/dataset/component file was modified.

## Unresolved / pending items

- The pre-existing `scripts/` pytest failures/errors described above (selector-fixture tests and
  `test_block22_b6_4_photography.py`'s `BATCH_LIMIT` `NameError`) are unrelated to B6.7 and are
  left as a documented, unfixed finding for whoever owns that history, per the mission's
  instruction not to force-fix or expand scope beyond the named failures.
