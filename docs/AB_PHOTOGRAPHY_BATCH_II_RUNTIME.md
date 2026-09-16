# Phase 4L — A+B Licensed Photography Acquisition Batch II

Execution phase. Phase 4L acquires the exact 32-target tranche that Phase 4K pinned in
`data/visual/phase4k-successor-fixture.json` and closed on 2026-09-16 at base
`524531a1d9f41c84bc8ca53bfde5dc4ee5febd6d`. It is not a strategy phase: the target set,
its order, the hub quotas and the 11 MiB soft / 14 MiB hard budget all arrive fixed from
Phase 4K, and the preflight reproduced the fixture byte-for-byte before any photograph was
fetched.

Phase 4L acquires **one first photograph per place**. It changes no grade, no ranking, no
recommendation, no itinerary, no routing and no gallery behaviour, and it acquires no second
image for any already-covered place.

## Outcome

| | |
| --- | --- |
| Attempted | 32 (the whole fixture, in fixture order) |
| Accepted | 31 |
| Failed closed | 1 — JP-140 |
| Grade split accepted | 25 A · 6 B (fixture was 25 A · 7 B; JP-140 is the B that failed) |
| Registry | 113 → 144 records |
| Catalogue coverage | 113/214 (52.8%) → **144/214 (67.3%)** |
| Asset delta | 9,187,992 B = **8.76 MiB** (soft 11 MiB, hard 14 MiB) |
| Asset total | 33,266,400 B → 42,454,392 B (40.49 MiB) across 144 files |
| Licence mix | CC BY-SA 4.0 ×16 · CC BY-SA 3.0 ×4 · CC0 ×3 · CC BY 3.0 ×3 · CC BY 2.5 ×2 · CC BY 4.0 ×1 · CC BY 2.0 ×1 · CC BY-SA 2.0 ×1 |
| Processing | `resized-and-webp-reencoded` ×30 · `webp-reencoded` ×1 (JP-190) |
| Sources | Wikimedia Commons only, 31/31 |

The soft budget was **not** crossed, so no budget investigation was triggered. The mean new
asset is 296,387 B and the largest is 497,816 B.

### Coverage after the batch

| Grade | Before | After |
| --- | --- | --- |
| S | 28/32 (87.5%) | 28/32 (87.5%) |
| A | 77/147 (52.4%) | **102/147 (69.4%)** |
| B | 8/25 (32.0%) | **14/25 (56.0%)** |
| C | 0/6 (0.0%) | 0/6 (0.0%) |
| D | 0/4 (0.0%) | 0/4 (0.0%) |

| Hub | Before | After |
| --- | --- | --- |
| Tokio | 28/57 (49.1%) | 37/57 (64.9%) |
| Osaka | 27/53 (50.9%) | 34/53 (64.2%) |
| Kioto | 27/49 (55.1%) | 34/49 (69.4%) |
| Okinawa | 26/50 (52.0%) | 34/50 (68.0%) |
| Fukuoka | 1/1 | 1/1 |
| Nagoya | 1/1 | 1/1 |
| Sapporo | 3/3 | 3/3 |

The Phase 4K rebalancing goal held. Before the batch the four large hubs spanned 49.1%–55.1%
(6.0 points); after it they span 64.2%–69.4% (5.2 points), so the spread narrowed rather than
widened even with one fail-closed target inside the Osaka quota. Editorial ordering
S > A > B > C > D is preserved at every grade.

## Accepted targets

Listed in fixture order. Every row is a Wikimedia Commons file under the CC0 / CC BY /
CC BY-SA allowlist, re-encoded locally to WebP and served from `app/public/images/places/`.

| # | Place | Grade | Hub | License | Credit | Source dimensions |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | JP-084 Shisen-dō | A | Kioto | CC BY-SA 4.0 | くろふね | 5472×3648 |
| 2 | JP-190 Toriike Ponds | A | Okinawa | CC BY-SA 4.0 | Paipateroma | 1280×960 |
| 3 | JP-149 MIHO Museum | A | Osaka | CC BY-SA 4.0 | 663highland | 5472×3648 |
| 4 | JP-012 Kabukicho | B | Tokio | CC BY-SA 4.0 | Basile Morin | 6521×4347 |
| 5 | JP-062 Eikan-dō | A | Kioto | CC BY-SA 4.0 | Martin Falbisoner | 5816×3877 |
| 6 | JP-176 Kouri Island and bridge | A | Okinawa | CC BY-SA 4.0 | Kugel~commonswiki | 6000×4000 |
| 7 | JP-122 Minoh Falls | A | Osaka | CC BY 2.5 | 663highland | 4800×3200 |
| 8 | JP-213 Tokyo Marathon 2027 | B | Tokio | CC BY-SA 2.0 | nakashi from Chofu, Tokyo, JAPAN | 4608×3456 |
| 9 | JP-087 Hōsen-in | A | Kioto | CC BY-SA 4.0 | Asturio Cantabrio | 6016×4000 |
| 10 | JP-200 Yonaguni Island and underwater monument dive | A | Okinawa | CC0 | Melkov | 4608×3456 |
| 11 | JP-112 Umeda Sky Building | A | Osaka | CC BY-SA 4.0 | Martin Falbisoner | 5558×3568 |
| 12 | JP-053 Edo-Tokyo Museum | A | Tokio | CC BY-SA 3.0 | Wiiii | 2000×1600 |
| 13 | JP-064 Hōnen-in | A | Kioto | CC BY 3.0 | josef knecht | 5236×3491 |
| 14 | JP-158 Tamaudun Royal Mausoleum | A | Okinawa | CC BY 2.5 | 663highland | 4592×3056 |
| 15 | JP-113 Grand Green Osaka | A | Osaka | CC BY-SA 4.0 | 掬茶 | 6000×4000 |
| 16 | JP-007 Ota Memorial Museum of Art | A | Tokio | CC0 | Wmpearl | 4000×3000 |
| 17 | JP-063 Philosopher's Path | B | Kioto | CC BY 4.0 | Gzzz | 5568×3712 |
| 18 | JP-185 Furuzamami Beach | A | Okinawa | CC BY 3.0 | Hashi photo | 3872×2592 |
| 19 | JP-130 Nara Park deer | B | Osaka | CC BY-SA 4.0 | Daniel Lu ( User:dllu ) | 9907×6288 |
| 20 | JP-042 Odaiba Seaside Park + Rainbow Bridge | B | Tokio | CC BY-SA 4.0 | DXR | 7567×5045 |
| 21 | JP-065 Ginkaku-ji | A | Kioto | CC BY-SA 4.0 | Basile Morin | 6720×4480 |
| 22 | JP-172 Cape Manzamo | B | Okinawa | CC BY-SA 3.0 | CEphoto, Uwe Aranas | 5387×3591 |
| 23 | JP-139 Nunobiki Falls and Herb Gardens | A | Osaka | CC BY-SA 4.0 | Daniel Lu ( User:dllu ) | 8736×11648 |
| 24 | JP-051 Mount Takao | A | Tokio | CC0 | Syced | 4080×3072 |
| 25 | JP-067 Tōfuku-ji | A | Kioto | CC BY-SA 4.0 | Zairon | 4569×2749 |
| 26 | JP-169 Zakimi Castle Ruins | A | Okinawa | CC BY-SA 3.0 | Toshihiro Matsui | 5472×3648 |
| 27 | JP-114 Nakanoshima waterfront | A | Osaka | CC BY-SA 4.0 | Mauricio V. Genta | 9000×12000 |
| 28 | JP-020 The Sumida Hokusai Museum | A | Tokio | CC BY 3.0 | Sailko | 5202×3318 |
| 29 | JP-186 Aka Island | A | Okinawa | CC BY-SA 3.0 | TomazVajngerl | 4000×3000 |
| 30 | JP-140 Mount Rokko night view | B | Osaka | — | — | **fail-closed** |
| 31 | JP-052 Mount Mitake and Musashi Mitake Shrine | A | Tokio | CC BY 2.0 | Guilhem Vellut from Annecy, France | 3648×2736 |
| 32 | JP-017 Asakusa Culture Tourist Information Center | A | Tokio | CC BY-SA 4.0 | Kakidai | 1500×2217 |

JP-190 is the only source below the 1600 px pipeline ceiling (1280×960), so the pipeline
correctly declined to upscale it and recorded `webp-reencoded` rather than
`resized-and-webp-reencoded`.

## Failed-closed target

### JP-140 — Mount Rokko night view (B, Osaka)

No defensible candidate existed on Commons. Fail-closed is the outcome; the place keeps its
non-photographic fallback and **no replacement target was drawn**.

- The only genuine Rokko-viewpoint night panorama is 27439×4116 — a 6.7:1 stitched strip that
  cannot serve as a gallery image at any crop that preserves the subject.
- The best remaining night candidate is attributed to *"No machine-readable author provided"*,
  which fails the provenance standard outright, and its own description names Rokko **Island**
  — the artificial island in Kobe harbour — not the Mount Rokko viewpoint. Accepting it would
  have been both an unresolved-provenance failure and a subject-match failure.
- The other night views in the result set are shot from **Mount Maya** and **Kikusuiyama** —
  different mountains with different panoramas.
- Daytime terrace and summit shots exist and are well licensed, but the target's named subject
  *is the night view*. A daytime image would misrepresent the place rather than illustrate it.

Lowering the licence standard, accepting the unattributed file, or substituting a daytime or
neighbouring-mountain image would each have broken a stated policy, so the target failed
closed as designed.

## Carried fail-closed targets

Fifteen IDs from Phases 4D, 4F, 4H and 4J were carried as permanently excluded for this batch
and were **not retried, not researched and not present in any Phase 4L manifest**:

| Phase | IDs |
| --- | --- |
| 4D | JP-033, JP-126, JP-203, JP-204 |
| 4F | JP-050, JP-195 |
| 4H | JP-121, JP-156, JP-095, JP-079, JP-202 |
| 4J | JP-120, JP-211, JP-041, JP-168 |

Both Phase 4L scripts hard-refuse to run if any of the fifteen appears — the discovery script
guards the fixture it reads, and the metadata preparer guards both its acceptance set and that
set's membership in the authorised fixture. The exact-head CI re-asserts all fifteen are absent
from the registry *and* absent from the attempted set. JP-140 joins them as a sixteenth carried
exclusion for any successor phase.

## Selector and execution artifacts

Phase 4L did **not** reuse or mutate `scripts/select-ab-photography-batch.py`. That script is
the historical Phase 4J selector, it carries only 11 fail-closed IDs, and Phase 4K proved that
editing it to 15 breaks 4 of its pinned regressions. It is byte-identical to its Phase 4J
state and its regressions still pass.

Phase 4L instead ships its own execution artifacts, each carrying all 15 IDs independently:

- `scripts/discover-phase4l-commons.py` — read-only Commons discovery, per-target English and
  Japanese queries, no writes to the registry.
- `scripts/prepare-phase4l-photography-metadata.py` — the 31-entry acceptance set, with the
  fail-closed guard and the fixture-membership guard.
- `data/visual/phase4l-acquisition-plan.json` — 32 attempted, 31 accepted, 1 failed closed with
  its reason recorded.

## Preserved invariants

Re-proved in CI at the exact executable head, not merely locally:

- All **113** pre-4L registry records are byte-identical to base `524531a`, compared record by
  record rather than by count.
- All **113** pre-4L image blobs are byte-identical to base, compared by SHA-256 against
  `git show` of the base blob.
- The registry is append-only: the first 113 entries are unchanged and in order, and the 31 new
  entries follow.
- `data/visual/photography-metadata.json` and `app/src/data/photography-metadata.json` are
  byte-identical to each other.
- No duplicate `placeId`, `sourceUrl`, `acquisitionUrl` or `assetPath` across all 144 records.
- Every record: `source` is `Wikimedia Commons`, `sourceUrl` starts
  `https://commons.wikimedia.org/wiki/File:`, `licenseUrl` starts `https://creativecommons.org/`,
  `license` is inside the allowlist, and `acquisitionUrl` carries no query string.
- `data/places.json` is byte-identical to base — every grade, every hub, every field.
- Exactly 144 WebP files exist under `app/public/images/places/JP-*/`.

No pre-4L record or blob was edited to make the new batch pass.

## Test repair

Acquisition broke 18 tests and 1 error in the Python suite. Both failure classes were repaired
generically. **No assertion was weakened, deleted, or had its expected value edited.**

1. **Historical baseline derivation.** `scripts/photography_baseline.py` reconstructs the
   Phase 4E (36-record) and Phase 4G (58-record) baselines by excluding later acquisition
   batches from the current registry. Phase 4L added a fourth batch the registry knew nothing
   about. The fix registers the Phase 4L manifest and adds the Phase 4K (113-record) baseline,
   so each historical fixture still reconstructs from the live registry:

   - `phase4e` reconstructs at **36**, `phase4g` at **58**, `phase4k` at **113** — asserted in CI.

   The manifest-completeness guard changed from *"is this name in the discovery glob"* to
   *"is this file on disk"*, because the Phase 4K fixture is deliberately named outside the
   `*-batch*.json` glob. The guard still fails loudly if a registered manifest goes missing;
   the glob now only catches manifests nobody has registered.

2. **Phase 4K design-gate scope test.** `DesignOnlyScopeTests` compared the design head against
   `HEAD`, which is correct while 4K is the tip and wrong once 4L lands on top. It now compares
   the fixed pair `caccf251` → `524531a` — the actual Phase 4K base and merge — and loads its
   inputs from git at the base rather than from the working tree. All 20 Phase 4K tests pass
   with every expected value unchanged.

## Browser QA

`app/scripts/phase4l-browser-audit.mjs`, run twice at the executable head, passing 8/8 both
times with 0 console errors and 0 page errors:

1. New A-grade target renders — JP-084 Shisen-dō
2. New B-grade target renders — JP-012 Kabukichō
3. Temporal target stays factual — JP-213, alt text asserted **not** to contain `2027`
4. Failed target keeps its fallback — JP-140
5. Historical target still renders — JP-013 Golden Gai
6. Historical fallback intact — JP-050 PokePark KANTO
7. Zero runtime photography fetch — route interception across 407 and 444 external requests,
   none photographic
8. Local images genuinely load — `el.complete && el.naturalWidth > 0` on every asserted image,
   so a broken asset cannot pass as present

All five prior-phase browser regressions pass unchanged at the same head: Phase 4J, 4H, 4F, 4D
and 4C.

## Branded and temporal subjects

JP-213 (Tokyo Marathon 2027) is the batch's only temporal-risk target and was the one requiring
most care. The accepted photograph is `東京マラソン2019`, categorised *Tokyo Marathon 2019*, and its
Spanish alt text describes it as *"durante una edición anterior del maratón"*. It makes no claim
about the 2027 edition, and the browser audit asserts the rendered alt text contains no `2027`.
The first discovery pass for this target returned police motorcycles and an official BMW course
car rather than runners; those were rejected and a second pass found genuine runner packs.

No record in this batch asserts or implies any legal clearance. Attribution states the source,
the author credit and the licence, and nothing further.

## Hostile review

Every accepted record was re-checked against live Commons after acquisition.

- 31/31 Commons file pages resolve.
- Licence, author credit, source dimensions and URLs on every record match the live page.
- No field or shape issues; no duplicate `sourceUrl`, `acquisitionUrl`, `assetPath` or `placeId`
  across all 144 records.
- Subject and location were cross-checked against each file's Commons description and categories.

Visual inspection caught eleven subject traps that metadata alone would have accepted. Each was
rejected and a correct image found, or the target failed closed:

| Target | Trap found | Resolution |
| --- | --- | --- |
| JP-007 | Top hits were **Ryushi** Memorial Museum in Ōta *ward* | Found Ōta Memorial Museum of Art, Harajuku — description reads *"Exterior of Ota Memorial Museum of Art"*, category matches |
| JP-087 | Hits included **Hōsen-in in Sumida, Tokyo** — different temple, same name | Accepted file's description reads 京都市左京区大原の宝泉院, confirming Ōhara, Kyoto |
| JP-067 | Top hits were Tōfukuji **Station** | Found the temple |
| JP-053 | First pass returned museum *collection items*; second returned the **Open Air Architectural Museum** (JP-047's subject, already covered) | Found the Kikutake building itself deeper in the list |
| JP-113 | List included the **Umeda Sky Building** (JP-112's subject) | Separated the two |
| JP-112 | Top hit was a *view from* the building | Found the building |
| JP-017 | First pass were views *from* the centre | Found the Kengo Kuma building |
| JP-186 | Only coral-reef underwater shots | Found Aka Beach and Aka Village |
| JP-052 | First pass were detail shots (water basin, sake barrels) | Found the shrine hall — category *Hōmotsuden, Musashi Mitake Shrine* |
| JP-213 | First pass were police motorcycles and an official car | Found runner packs, prior edition |
| JP-140 | Night views were from **Mount Maya** and **Kikusuiyama** | No correct candidate — failed closed |

One dataset observation, not a Phase 4L defect: JP-149 MIHO Museum is filed under the Osaka hub
while the museum is physically in Kōka, Shiga. This is a pre-existing hub assignment in
`data/places.json` — the same convention that files Kobe subjects under Osaka — and Phase 4L did
not touch `data/places.json`. It is noted for the successor gate, not corrected here.

## Harness corrections

Three self-inflicted issues were found and fixed during execution. None reached the final tree.

- **A success-detection false alarm.** My own progress grep reported *"acquired OK: 0 / 31"*
  after a pipeline run that had in fact succeeded — a `tail -2 | head -1` pattern was picking up
  a blank line. Verified against the filesystem before acting; no re-acquisition was needed.
- **HTTP 429 from Wikimedia on JP-190 and JP-017.** A transient infrastructure rate limit, not a
  sourcing failure. Both targets resolve to original file URLs because their sources sit under
  the 1600 px ceiling. Resolved with extended exponential backoff and both were acquired.
  Recording these as fail-closed would have misattributed a rate limit as a licensing or subject
  failure, so they were not.
- **`processing` mislabelled on JP-190.** Its 1280×960 source was not resized, so
  `resized-and-webp-reencoded` was wrong; corrected to `webp-reencoded`.

## Exact-head validation

Executable/test head: **`7036d86af674f5394a5180014fc12811f486e6c6`**

`.github/workflows/phase4l-exact-head.yml` pinned `actions/checkout` to that SHA so later
documentation and workflow-removal commits could not alter the validated tree.

Run **[35078248227](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/35078248227)** —
conclusion `success`, all 24 steps `success`, none skipped. The log confirms the checkout
resolved to `HEAD is now at 7036d86` and that every gate produced real output:

| Gate | Result |
| --- | --- |
| Phase 4K fixture reproduction | 32 targets, 25 A / 7 B, 13 categories |
| Photography validator | OK |
| Python test suite | Ran 495 tests — OK |
| Historical 4E/4G/4J/4K regressions | Ran 50 tests — OK; baselines reconstruct at 36, 58, 113 |
| Focused photography tests | 3 files, 26 tests passed |
| Full Vitest | 65 files, **2440 tests** passed |
| Lint | clean |
| Build | built in 509ms |
| Phase 4L invariants and asset budget | `OK: 113 prior records/assets preserved; 31 accepted; 1 fail-closed; 144 total` · delta 9,187,992 B (8.76 MiB), no soft-budget notice |
| Phase 4L browser audit ×2 | PASS, PASS |
| Phase 4J / 4H / 4F / 4D / 4C browser regressions | PASS ×5 |
| Whitespace gate | clean |

## Scope boundary

Ten non-asset files changed against base `524531a`, plus 31 new WebP assets:

```
.github/workflows/phase4l-exact-head.yml      (temporary, removed after validation)
app/scripts/phase4l-browser-audit.mjs
app/src/data/photography-metadata.json
app/src/data/place-images.test.ts
data/visual/phase4l-acquisition-plan.json
data/visual/photography-metadata.json
scripts/discover-phase4l-commons.py
scripts/photography_baseline.py
scripts/prepare-phase4l-photography-metadata.py
scripts/test_phase4k_coverage_strategy.py
```

Untouched, verified by diff: `data/places.json`, `data/clusters.json`, `data/nearby.json`,
`data/sources.json`, `data/logistics/`, `data/reservation-mechanisms.json`,
`data/seasonal-alerts.json`, `app/src/components/` and `app/src/lib/`. No ranking,
recommendation, grade, itinerary, planner, routing or gallery change. No second image for any
place. No licence-policy widening. No non-Commons imagery.

## Successor gate requirements

Phase 4L does **not** open the post-4L strategy gate. It records what that gate must decide.

Phase 4K's independent closure found that A+B inverts the editorial grade→coverage ordering at
n = 40 measured from the 113-record base. That finding did not invalidate Phase 4L at n = 32,
and Phase 4L was not redesigned because of it. Measured again from the **post-4L** base, the
risk has moved closer and the successor gate must treat it as a live constraint:

- **Post-batch A coverage: 102/147 = 69.4%.**
- **Post-batch B coverage: 14/25 = 56.0%.** Ordering is preserved, by 13.4 points.
- The remaining A+B eligible universe is **45 places — 35 A and 10 B.** B is nearly exhausted.
- Each further B photograph moves B by **4.0 points**; each further A photograph moves A by
  **0.68 points**. The asymmetry is now six-to-one.

Projected ordering for a further A+B tranche drawn in the eligible ratio:

| Further n | A after | B after | Ordering |
| --- | --- | --- | --- |
| 8 | 73.5% | 64.0% | preserved |
| 16 | 77.6% | 72.0% | preserved |
| 24 | 82.3% | 76.0% | preserved |
| 32 | 86.4% | 84.0% | preserved |
| **40** | 90.5% | **92.0%** | **B overtakes A** |
| 45 (exhaustion) | 93.2% | 96.0% | B overtakes A |

The proportional-draw crossover still sits near n = 40, but the margin is far thinner than it
was at the 113-record base: at n = 32 the gap is now 2.4 points rather than a comfortable
spread. And because only 10 B places remain, a tranche weighted toward B inverts the ordering
almost immediately — **as few as 4 B-only photographs** would put B above A.

The successor gate is therefore required to:

1. Re-evaluate post-batch A coverage and post-batch B coverage from the then-current registry,
   not from these figures.
2. Decide explicitly whether any further A+B acquisition would invert the editorial
   grade→coverage ordering, at the size *and the A:B mix* it proposes — size alone is no longer
   a sufficient test.
3. Re-open the stop-versus-continue question rather than assuming continuation, given that B
   exhaustion (96.0% ceiling) is now reachable within a single tranche.
4. Carry all **16** fail-closed IDs — the 15 inherited plus JP-140.

## Workflow cleanup proof

`.github/workflows/phase4l-exact-head.yml` is temporary scaffolding and is removed after the
validated run. The removal commit and the documentation commit touch only documentation and
that workflow file; the executable and test tree is byte-identical to the validated head
`7036d86af674f5394a5180014fc12811f486e6c6`. The zero-drift proof is recorded in the pull
request.
