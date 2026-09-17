# Phase 5B — Nihon v1.0.0 Final Release Gate

Status: **gate complete; PR remains Draft pending the independent final closure**

- Exact base: `6b484ffcb72e752bfe15779a411a3410baa8d340` (`main` after Phase 5A / PR #119)
- Issue: #120
- Branch: `release/phase-5b-nihon-v1-final`
- Gate date: **2026-09-17**

Authority consulted in full before any change:
- [`docs/RELEASE_CANDIDATE_AUDIT.md`](RELEASE_CANDIDATE_AUDIT.md) (Phase 5A, RC-READY)
- the Phase 5A [`docs/ROADMAP.md`](ROADMAP.md) entry
- [`docs/PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md`](PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md) (Phase 4M STOP)
- root `README.md` and [`app/README.md`](../app/README.md)

## Release decision

> ## **RELEASE-READY**

No BLOCKER or MAJOR product defect was found. Every required gate is green, the release candidate
reproduces the Phase 5A invariants exactly, only release-only files changed, version metadata is
`1.0.0` and internally consistent, the release notes are prepared, and no tag or release collides.

**No product code was changed by this phase.**

---

## 1. Preflight

| # | Invariant | Required | Observed |
|---|---|---|---|
| 1 | `git fetch origin` | — | done ✓ |
| 2 | `origin/main` | `6b484ff…` | **`6b484ffcb72e752bfe15779a411a3410baa8d340`** ✓ |
| 3 | Branch descends exactly from base | exact | merge-base = base = branch head at start ✓ |
| 4 | Working tree | clean | clean ✓ |
| 5 | PR #119 | merged | merged 2026-09-16T23:57:18Z by `Z3roM4str` ✓ |
| 6 | Issue #118 | closed completed | `closed`, `state_reason: completed` ✓ |
| 7 | Phase 5A decision | RC-READY | `docs/RELEASE_CANDIDATE_AUDIT.md` §RC decision ✓ |
| 8 | Phase 4N | must not exist or be authorized | no branch, no issue, no fixture, no selector ✓ |
| 9 | `v1.0.0` tag / GitHub release | must not exist | **repository has zero tags and zero releases** ✓ |
| 10 | Authority documents | read in full | read ✓ |
| 11 | `app/package.json` version | `0.0.0` | `0.0.0` ✓ |
| 11 | `app/package-lock.json` root version | `0.0.0` | `0.0.0` (both the top-level mirror and `packages[""]`) ✓ |

The branch head was identical to the base at start — **zero commits ahead** — so the gate ran
against the exact Phase 5A release candidate.

The only references to "Phase 4N" anywhere in the tree are the Phase 4M and Phase 5A statements
that no such phase is authorized.

---

## 2. RC invariant reproduction

Independently recomputed at the base, not copied from Phase 5A.

| Invariant | Required | Observed |
|---|---|---|
| Places / unique IDs | 214 / 214 | **214 places, 214 unique IDs** ✓ |
| Photography records | 144 | canonical `imageCount` **144**, **144** records ✓ |
| Local assets on disk | 144 | **144/144** resolve under `app/public` ✓ |
| Canonical/app photography parity | byte parity | **identical SHA-256** `9601de26de4fbade…` ✓ |
| Max photographs per place | 1 | **1** — 144 unique placeIds, no place with >1 ✓ |
| Duplicate `sourceUrl` | none | NONE ✓ |
| Duplicate `acquisitionUrl` | none | NONE ✓ |
| Duplicate `assetPath` | none | NONE ✓ |
| Duplicate `placeId` | none | NONE ✓ |
| Fail-closed IDs uncovered | 16 | **16/16 uncovered**, zero leaked into the registry ✓ |
| D-grade filter present and usable | present | `App.tsx` vocabulary `["S","A","B","C","D"]`; `PlaceMap.tsx` `D: "#6b6257"`; `App.css` `.tag--grade-D`/`.badge--grade-D` ✓ |
| RegionNavigator singular/plural fix | present | both `verificado{… === 1 ? "" : "s"}` occurrences intact ✓ |
| README / app README reflect v1 scope | accurate | accurate; one status line updated for v1.0.0 (§4) ✓ |
| No Phase 4N | absent | absent ✓ |
| No live transit provider activation | dormant | `lib/transit.ts` imported **only by its own test**; its distinctive token appears **0 times in the production bundle** ✓ |
| No automatic itinerary scheduling | absent | no auto-generate/schedule/optimise path in `app/src` ✓ |
| No committed secrets | none | provider-specific scan over all tracked files: **0 hits** ✓ |
| No temporary workflow/release files | none | **no `.github/` tracked at all**; no tracked `dist/`, no `.map`, no `.env` ✓ |

Coverage decomposition: 214 places = 144 covered + 70 uncovered, of which **16 are the carried
fail-closed set** and 54 are simply not-yet-acquired under the Phase 4M STOP.

**No unexplained difference from Phase 5A.** One apparent difference was investigated to closure
and is explained in §5.

---

## 3. Allowed changed-file scope

Exactly four files changed, all within Issue #120 §3:

```
app/package.json          version metadata  0.0.0 → 1.0.0   (§3.1)
app/package-lock.json     root package version 0.0.0 → 1.0.0 (§3.1)
docs/RELEASE_V1.0.0.md    release notes, new                 (§3.2)
docs/FINAL_RELEASE_GATE.md this authority document, new      (§3.2 / §11)
docs/ROADMAP.md           Phase 5B entry                     (§3.2)
README.md                 one status line, v1.0.0 accuracy   (§3.2)
```

**No app runtime source, no dataset, no planner/logistics/reservation/temporal library, no
photography metadata or asset, no validator, no feature flag, no route, no filter, no styling, no
dependency.** The Phase 5A RC harness was reused unchanged — no verification harness was
duplicated or added.

---

## 4. README change, and why it was strictly required

Issue #120 §3.2 allows a README change "only if strictly required to say v1.0.0 accurately".

The root README's status line read **"Release-candidate audit — Nihon v1"**. At the moment the
repository carries version `1.0.0` and a prepared `v1.0.0` release, that line states the product
is still an unreleased candidate. It is the only version-status claim in either README, and it
becomes untrue on this branch. It is updated to name v1.0.0 and nothing else is rewritten.

`app/README.md` makes **no version-status claim** — its 214 places / 7 hubs / 144 photographs /
sixteen fail-closed statements were re-verified above and are all accurate. **It was left
unchanged.**

---

## 5. The one investigated divergence — the reported gzip figure

Phase 5A recorded the bundle as **1,424,842 B raw / 259,730 B gzipped**. This gate's build
reported `gzip: 260.77 kB`, which would be ~1,040 B larger.

This was treated as presumptively blocking and run to ground. It is **not** a divergence in the
artifact:

| Artifact | Phase 5A | Phase 5B | |
|---|---|---|---|
| `index-*.js` raw | 1,424,842 B | **1,424,842 B** | identical |
| `index-*.css` raw | 64,458 B | **64,458 B** | identical |
| `gzip -6` of the JS | 259,730 B | **259,730 B** | identical |

The emitted JS keeps its content hash `index-pf4I7nMN.js` across every build in this gate,
including before and after the version bump. The build output is **byte-for-byte identical** to
Phase 5A's. The differing number is only the Vite reporter's own compression readout of those
same bytes, which is implementation- and Node-version-dependent; standard `gzip -6` reproduces
Phase 5A's recorded 259,730 B exactly.

**Resolved: no artifact divergence. Not a finding.**

---

## 6. Version metadata proof

```diff
 app/package.json
-  "version": "0.0.0",
+  "version": "1.0.0",

 app/package-lock.json
-  "version": "0.0.0",          (top-level mirror)
+  "version": "1.0.0",
-      "version": "0.0.0",      (packages[""] — the root package entry)
+      "version": "1.0.0",
```

Diffstat: `app/package.json` **1 insertion, 1 deletion**; `app/package-lock.json` **2 insertions,
2 deletions**. Nothing else.

**Dependency-drift proof.** Both lockfiles were compared entry by entry:

- package entry key sets **identical**, **173** entries on both sides
- the **only** field-level difference across all 173 entries is `<root>.version: 0.0.0 → 1.0.0`
- non-root entries with a changed `resolved`: **NONE**
- non-root entries with a changed `integrity`: **NONE**
- non-root entries with a changed `version`: **NONE**
- `lockfileVersion` 3 → 3; root `dependencies` and `devDependencies` unchanged

No `npm update` was run. No dependency was added, removed or moved.

**Reproducibility.** `node_modules` was deleted and `npm ci` re-run from the edited lockfile:
exit **0**, and `git diff --numstat app/package-lock.json` still reports exactly `2 2` — `npm ci`
did not rewrite the lockfile. The installed app version reads `1.0.0`.

**Behavioural neutrality.** The production build after the bump emits the same content-hashed
filename and the same byte counts as before it (§5). The version change is inert to the shipped
artifact.

---

## 7. Final gates

All run on the final Phase 5B tree, after the version bump.

| Gate | Baseline (Phase 5A) | Phase 5B | |
|---|---|---|---|
| `npm ci` | reproducible | exit 0, lockfile untouched | ✓ |
| Python suite | **543** | **543 passed**, 149 subtests | ✓ |
| Vitest | **2450** / 66 files | **2450 passed / 66 files** | ✓ |
| Lint (`oxlint`) | clean | clean, exit 0 | ✓ |
| Production build | success | success, exit 0 | ✓ |
| `validate-access-points.py` | OK | OK — source/app parity | ✓ |
| `validate-dataset.py` | OK | OK — 214 places, 403 nearby relations, 0 broken references, 13 secondary warnings | ✓ |
| `validate-geography.py` | OK | OK — 47 prefectures, 47 polygons, 9 regions, 214 places, 15 prefectures, 7 hubs | ✓ |
| `validate-logistics.py` | OK | OK — 24 pilot + 308 scale edges, results present | ✓ |
| `validate-photography.py` | OK | OK | ✓ |
| `validate-reservation-mechanisms.py` | OK | OK — source/app byte parity | ✓ |
| `validate-walking-access-point-results.py` | OK | OK — historical results unchanged | ✓ |
| Whitespace (`git diff --check`) | clean | vs base exit 0; working tree exit 0 | ✓ |
| RC browser audit — desktop 1440×900 | 50/50 | **50/50** | ✓ |
| RC browser audit — mobile 390×844 | 50/50 | **50/50** | ✓ |

**No count decreased. No count increased** — Phase 5B adds no test, and needed none: it changes
no behaviour. **No assertion was weakened, skipped or deleted.**

`scripts/validate-walking-pilot.py` and `scripts/validate-walking-scale.py` are OpenRouteService
acquisition harnesses, not passive validators — they require an explicit mode flag and are the
same seven-validator set Phase 5A recorded. Both were additionally run with `--dry-run` (exit
**0**, "no network requests made") for completeness.

### Browser audit — both viewports, against the production build

Run via `vite preview` on the built artifact, not the dev server. Desktop and mobile each pass
all 50 checks: the five golden journeys (A01–A15, B01–B06, C01–C06, D01–D02, E01–E04),
accessibility (F01–F05), responsive layout (G01–G03), runtime/network integrity (H01–H05) and
persistence (I01–I02).

Representative evidence, unchanged from Phase 5A:

- `A05` grade filter offers every grade present per hub — `Tokio:SABC Osaka:SABCD Kioto:SABCD`
  (the RC-01 fix, still holding: D offered exactly where the data has it)
- `A12` weekday composition proven *derived* by re-anchoring —
  `sáb, 20 feb 2027 → dom, 21 feb 2027 → sáb, 20 feb 2027`
- `A13b` manual Shinkansen inter-hub segment across the Tokio→Kioto boundary
- `C02` route-wide reservation calendar — 3 unique rows, no duplicates
- `E03` carried fail-closed target keeps its fallback
- `G01b` mobile drawer opens, closes and reopens with the full 57-place list

---

## 8. Runtime / network proof

Recorded live during both browser audits.

| Check | Desktop | Mobile |
|---|---|---|
| `E04` photography-provider requests | **0** of 180 external requests | **0** of 108 |
| `H01` transit provider activated | **dormant** | **dormant** |
| `H02` secret-bearing or localhost-service request | **none** | **none** |
| `H03` external hosts reached | `a/b/c.tile.openstreetmap.org` **only** | `a/b/c.tile.openstreetmap.org` **only** |
| `H04` core UI with all external requests stubbed | 57 places render | 57 places render |
| `H05` page errors / console errors | **0 / 0** | **0 / 0** |

Total external requests recorded: **240** desktop, **153** mobile — all OpenStreetMap map tiles,
the single intentional external runtime dependency already documented by Phase 5A and attributed
in the UI.

Statically corroborated: `lib/transit.ts` is imported by no component (only by its own test) and
its distinctive token appears **0 times** in the production bundle.

---

## 9. Release hygiene

| Check | Result |
|---|---|
| Uncommitted / generated drift | working tree clean; `node_modules/` and `dist/` untracked and ignored ✓ |
| Tracked `dist/` or build artifact | **none** ✓ |
| Tracked source maps (`.map`) | **none** ✓ |
| Temporary GitHub Actions workflow | **no `.github/` directory is tracked at all** ✓ |
| `.env` / secret / token / key material | **none tracked** ✓ |
| Committed secrets (provider-specific scan) | GitHub PAT, OpenAI, AWS, Google, Slack, JWT and PEM patterns over every tracked file — **0 hits** ✓ |
| Reproducible build from clean dependencies | `rm -rf node_modules && npm ci` → build OK, byte-identical artifact ✓ |
| Unexpected localhost dependency | none — `H02` ✓ |
| Runtime Wikimedia photography request | none — `E04`, both viewports ✓ |
| Runtime transit-provider request | none — `H01`, both viewports ✓ |
| External map-tile requests | only `tile.openstreetmap.org`, as documented by Phase 5A ✓ |
| Licence obligations | every photograph renders source, credit and licence links; OSM tiles attributed ✓ |

The ORS API key used by the acquisition harnesses is read from the environment and is not present
in any tracked file.

---

## 10. Known deferred non-blockers

Carried unchanged from Phase 5A. **None blocks the release**; none was repaired here, because
Phase 5B may not change product code.

- **RC-05** — one JS chunk above Vite's 500 kB advisory (1,424,842 B raw / 259,730 B gzipped).
  Code-splitting is a refactor.
- **OBS-1** — Leaflet's own tile `<img>` elements carry no `alt`; third-party decorative DOM,
  while every product image is labelled.
- **OBS-2** — 13 pre-existing `validate-dataset.py` secondary-metadata warnings, including
  cluster CL-87's place-count mismatch and its listing of JP-213. The validator exits OK.
- **OBS-3** — `JP-149` MIHO Museum is filed under the Osaka hub but sits in Kōka, Shiga; a
  pre-existing editorial hub assignment first recorded by Phase 4L.

**Unresolved findings: none.** No new finding of any severity was raised by this gate.

---

## 11. Tag / release collision check

| Check | Result |
|---|---|
| Existing git tags in the repository | **none** — `git ls-remote --tags origin` returns empty; the GitHub tag list is empty |
| Existing GitHub releases | **none** — the release list is empty |
| `v1.0.0` tag | **does not exist** ✓ |
| `v1.0.0` release | **does not exist** ✓ |

**No collision.** `v1.0.0` will be the repository's first tag and first release.

---

## 12. Publication plan — prepared, NOT executed

Phase 5B **does not** create or push the tag and **does not** create the GitHub release.

- Semantic version / tag: **`v1.0.0`**
- Release title: **Nihon v1.0.0**
- Target: **the eventual Phase 5B merge commit on `main`** — not the branch head, not the base
- Draft: **no** (non-draft)
- Prerelease: **no** (non-prerelease)
- Release notes source: [`docs/RELEASE_V1.0.0.md`](RELEASE_V1.0.0.md)

Publication occurs **only after** the independent final closure: review → mark Ready → merge →
close Issue #120 → then tag and release.

### Exact post-merge commands

Run only after the Phase 5B PR is merged to `main`. `<merge-commit-sha>` is the Phase 5B merge
commit produced by that merge.

```bash
# 1. Start from the merge commit on main
git checkout main
git pull origin main
git rev-parse HEAD          # must equal <merge-commit-sha>

# 2. Create the annotated tag on the Phase 5B merge commit
git tag -a v1.0.0 <merge-commit-sha> -m "Nihon v1.0.0"

# 3. Push the tag
git push origin v1.0.0

# 4. Create the GitHub release: non-draft, non-prerelease, notes from the prepared file
gh release create v1.0.0 \
  --target <merge-commit-sha> \
  --title "Nihon v1.0.0" \
  --notes-file docs/RELEASE_V1.0.0.md \
  --latest
```

Pre-publication re-check, immediately before step 2:

```bash
git ls-remote --tags origin | grep -c 'refs/tags/v1\.0\.0$'   # must print 0
gh release view v1.0.0 >/dev/null 2>&1 && echo COLLISION || echo "no release"
```

---

## 13. Stop condition

Phase 5B stops here, per Issue #120 §12:

- branch pushed
- Phase 5B PR opened/updated and left **Draft**
- Issue #120 left **open**
- **not** merged · **not** marked Ready
- `v1.0.0` **not** created and **not** pushed
- GitHub Release **not** created
- no post-v1 phase begun

**The next action is the independent final closure: review → Ready → merge → close Issue #120 →
publish `v1.0.0`.**
