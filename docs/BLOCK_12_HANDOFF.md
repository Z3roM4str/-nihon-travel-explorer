# Block 12 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/sleepy-heisenberg-hn7340` |
| Started from | `ae2b30a6129a48445db9d80ec38f41ed6e634d85` (Block 11 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. No new branch. |
| Working tree | Clean. |
| Block 12 status | **Closed.** |

## Authority situation

`RC-05`, recorded in [`docs/RELEASE_CANDIDATE_AUDIT.md`](RELEASE_CANDIDATE_AUDIT.md) §RC-05 and
carried untouched in the debt table of Blocks 1–11 on the explicit grounds that code-splitting is a
refactor and must not be mixed with functional work. No other document assigned Block 12 and no
conflict was found.

**Preflight discrepancy, unchanged since Block 6 and again left alone:** local `main` is stale at
`b924f5c`; `origin/main` is `1a11fe8`. `main` was not to be modified and the stale ref is local only.

## Preflight, as actually run

| check | expected | found |
|---|---|---|
| branch | `claude/sleepy-heisenberg-hn7340` | same |
| local HEAD | `ae2b30a…` | `ae2b30a…` |
| `origin/claude/sleepy-heisenberg-hn7340` | `ae2b30a…` | `ae2b30a…` |
| `origin/main` | `1a11fe8…` | `1a11fe8…` |
| working tree | clean | clean |
| Vitest | 3117 / 90 files | **3117 / 90** |
| oxlint · `tsc` · build | clean (RC-05 advisory expected) | as expected |
| Python suites · argument-free validators | 13 · 8 | **13** · **8** |

## Initial state

One JS chunk, and one CSS file:

| | raw | gzip | brotli |
|---|---|---|---|
| `index.js` | **1,530,614 B** | **284,387 B** | **227,624 B** |
| `index.css` | 95,588 B | 19,099 B | 16,596 B |

## Bundle audit

Reproducible: `cd app && node scripts/bundle-report.mjs`. Sizes come from rolldown's own
`renderedLength` via a throwaway plugin; compression from `node:zlib`. **No dependency was added** —
installing a bundle analyser to measure a bundle would have been its own small joke.

### Composition (pre-minification, 2,265,815 B attributed)

| bucket | bytes | share |
|---|---|---|
| **data (JSON)** | **988,452 B** | **43.3%** |
| React runtime | 485,484 B | 21.3% |
| `src/components` | 283,193 B | 12.4% |
| Leaflet + react-leaflet | 256,180 B | 11.2% |
| `src/lib` | 222,626 B | 9.8% |
| `src` (other) | 46,052 B | 2.0% |

**The original RC-05 diagnosis was backwards.** It read *"an ordinary size for React + Leaflet plus
the full 214-place dataset"*. React and Leaflet together are 32.5%; the dataset alone is 43.3% —
bigger than either runtime and bigger than all of Nihon's own code.

### The measurement that decides the block

| payload | minified | gzip | ratio |
|---|---|---|---|
| `places.json` | 374,805 B | 55,221 B | 14.7% |
| **`logistics/walking-scale-results.json`** | **253,091 B** | **10,113 B** | **4.0%** |
| `photography-metadata.json` | 120,124 B | 21,970 B | 18.3% |
| `nearby.json` | 93,543 B | 7,262 B | 7.8% |
| `accommodation/zones.json` | 27,817 B | 6,573 B | 23.6% |
| `logistics/walking-pilot-results.json` | 20,475 B | 1,562 B | 7.6% |
| `reservation-mechanisms.json` | 8,835 B | 2,415 B | 27.3% |
| **total** | **898,690 B** | **105,116 B** | **11.7%** |

RC-05 is stated in raw bytes, which is the misleading unit. ~900 kB of the 1.53 MB chunk ships as
105 kB. Of the 284 kB actually transferred, ~105 kB is data and ~180 kB is code.

### Exclusive weight per surface (real module graph)

| surface | exclusive | modules | gated by |
|---|---|---|---|
| **`OrderedSequenceBuilder`** | **246,464 B** | 27 | `sequenceBuilderOpen` (default `false`) |
| **`ZoneComparison`** | **37,758 B** | 8 | `zonesOpen && activeHub` |
| `PlaceDetail` | 24,904 B | 3 | `selectedPlace` |
| `NationalExplorer` | 20,471 B | 5 | **first render** |
| `SelectionAnalysis` | 14,045 B | 1 | `analysisOpen` |
| `TravellerManager` | 9,072 B | 1 | `travellerManagerOpen` |
| `PlaceMap` | 4,357 B | 1 | `activeHub` |

## Decision taken

**A — change, at exactly two boundaries.** `React.lazy` for the planner and the zone comparison.
No `manualChunks`, no vendor splitting, no change to `chunkSizeWarningLimit`.

**And a second decision: the advisory was deliberately not silenced.** The entry is still 1.38 MB
raw because it still holds the data a first render needs. Raising the threshold would have made the
warning vanish without changing one byte a user downloads. RC-05 closes as **diagnosed and
materially improved, with the residue explained** — not as *"warning gone"*.

## Alternatives rejected, with reasons

| rejected | why |
|---|---|
| **Deferring Leaflet (256 kB)** | `INITIAL_VIEW.mode` is `"national"`, so the first screen *is* the map (`NationalExplorer` → `NationalMap` → `leaflet`). Would trade a real first paint for a cosmetic number. Now test-protected. |
| **Deferring the walking datasets (298 kB raw)** | Reached by `usePlannedPlaceIds` → `planning-draft-v8` → `planning-draft` → `day-assignment` → `ordered-sequence` → `transfer.ts`, which indexes at module scope. That is the draft-restoration path, on mount. Breaking it is a functional refactor (forbidden here) risking the Block 4–6 saved-plan invariants, to buy **~12 kB gzip**. |
| **Deferring `PlaceDetail` (25 kB)** | Reached by tapping a place — the core interaction. A round trip there to move 25 kB raw is a bad trade, and it would not take the walking data with it anyway. |
| **Deferring `SelectionAnalysis` / `TravellerManager`** | 14 kB and 9 kB. A chunk each buys a request and saves nothing — the "twenty tiny chunks" antipattern. |
| **`manualChunks` vendor splitting** | Would split React/Leaflet off the critical path they are on. Arbitrary, and against the brief. |
| **Raising `chunkSizeWarningLimit`** | Cosmetic. Changes no byte anyone downloads. |

## Before / after

| | before | after | delta |
|---|---|---|---|
| **initial JS, raw** | 1,530,614 B | **1,377,479 B** | **−153,135 B (−10.0%)** |
| **initial JS, gzip** | 284,387 B | **250,628 B** | **−33,759 B (−11.9%)** |
| **initial JS, brotli** | 227,624 B | **201,105 B** | **−26,519 B (−11.7%)** |
| initial requests | 1 JS + 1 CSS | 1 JS + 1 CSS | unchanged |
| chunks | 1 | 3 | +2 |
| CSS | 95,588 B | 95,588 B | unchanged |

### The two new chunks

| chunk | raw | gzip | brotli | modules |
|---|---|---|---|---|
| `OrderedSequenceBuilder-*.js` | 136,816 B | 31,917 B | 27,417 B | 27 |
| `ZoneComparison-*.js` | 19,443 B | 5,872 B | 5,237 B | 8 |

Both load at idle after first paint, or on opening their surface.

### Cost, measured

- **Duplication: none.** 104 + 27 + 8 = 139 modules, disjoint.
- **Waterfall: none added.** Initial request count unchanged; neither chunk imports the other;
  neither is a `modulepreload` in the head.
- **Total across all chunks** grew ~3 kB raw / ~4 kB gzip — chunk boilerplate, 1.6% of what the
  entry saved.

## Impact

−11.9% of the JavaScript a first load transfers, and −10.0% of what it must parse and evaluate. The
deferred 153 kB raw is the planner, the single largest component in the app, which a person reaches
only by deliberately opening it.

**No real-device measurement is claimed.** This environment has no throttled network and no CPU
profile, so no parse-time, first-paint or TTI figure appears anywhere in this block. Every number is
a build or network measurement, re-derivable with `node scripts/bundle-report.mjs`.

## Files changed

| file | change |
|---|---|
| `app/src/App.tsx` | two `React.lazy` boundaries, two `Suspense` wrappers, `prefetchOnDemandSurfaces` |
| `app/src/bundle-architecture.test.ts` | **new** — 9 architectural guards |
| `app/scripts/bundle-report.mjs` | **new** — reproducible composition/size report |
| `app/scripts/block12-bundle-architecture-browser-audit.mjs` | **new** — 27 checks × 3 viewports |
| `docs/BLOCK_12_DESIGN.md`, `docs/BLOCK_12_HANDOFF.md`, `docs/ROADMAP.md` | **new / updated** |

**No data file changed. No `vite.config.ts` change. No visual or copy change.** All 25 pre-existing
files under `app/scripts/` are byte-identical to `ae2b30a` by SHA-256.

## Tests added

| file | tests |
|---|---|
| `app/src/bundle-architecture.test.ts` | **9** |
| **Vitest total** | 3117 → **3126**, 90 → **91 files** |

They assert **architecture, never bundler output** — no chunk hash, no byte count, no `dist/`
filename, all of which are incidental and would fail for reasons nobody wants to read. Pinned: both
deferred surfaces reachable only via `import(...)`; **no other module static-imports them** (the
quiet failure that undoes a split while the build stays green); the first-render surfaces are not
lazy and `INITIAL_VIEW.mode` is still `"national"`; the prefetch exists, has a fallback, swallows
rejection and is cancellable; the `Suspense` boundary is outside the condition.

### Guards broken on purpose, to prove they fire

| broken | caught by |
|---|---|
| a stray `import { ZoneComparison }` in `PlaceDetail.tsx` | 1 test |
| `NationalExplorer` made lazy | 1 test |
| the idle prefetch deleted | 1 test |
| the `Suspense` boundary moved inside the condition | 2 tests, incl. the historical `ZonePlanSection` one |

## Browser audit

**Required, and run.** §9's reason applies exactly: runtime loading changed, and a green build will
happily emit a chunk that 404s while a failing lazy route hides behind `fallback={null}`.

`app/scripts/block12-bundle-architecture-browser-audit.mjs` — **27 checks × 3 viewports = 81, all
passing** at 390×844 DPR 2, 820×1180 DPR 2 and 1440×900, against the production build via
`vite preview`.

It proves: clean cold load, no `pageerror`, no console error, **every JS request returns 200 (no
chunk 404s)**, the first screen still renders the national map without waiting on a second chunk,
both deferred surfaces really open and render, close/reopen works without re-suspending, no
horizontal overflow, and a repeat load behaves identically. From the network rather than the build
it also pins that **more than one JS file is served** (a config that collapsed back to one chunk
would be caught) and that **neither deferred chunk is a `modulepreload`** in the document head.

## Regressions found

**One, caught by the historical net and fixed without weakening it.**

Putting `<Suspense>` *inside* the conditional broke `ZonePlanSection.test.ts` —
*"keeps the planner mounted only while open, so it reloads what the comparison wrote"* — whose regex
pins the condition sitting directly against the component. The invariant it protects (the planner
unmounts on close, so reopening re-reads the draft) was **never actually broken**; only the adjacency
its regex assumed.

Following the precedent Block 10 set when it tripped Block 7's anchored audit, the **code was
restructured rather than the gate relaxed**: the boundary moved outside the condition. The test
passes byte-identical, and the result is better React — one stable boundary instead of one that
mounts and unmounts with its own content.

## False positives

**One, in my own analysis, caught before it reached a decision.** The first composition pass
attributed bundle bytes by walking the sourcemap's VLQ mappings. It reported `SelectionAnalysis.tsx`
at 281 kB against a 13 kB source, and split `react-dom` across two files — span-based attribution is
not reliable on a minified single-line bundle. It was discarded in favour of rolldown's own
`renderedLength`, which is the bundler's authoritative accounting. **No decision in this block rests
on the discarded numbers**, and the committed `bundle-report.mjs` uses only the reliable method.

## Baseline vs final

| check | baseline | result |
|---|---|---|
| Vitest | 3117 / 90 files | **3126 passed**, 0 failed, **91 files** |
| oxlint · `tsc` | clean | clean |
| `vite build` | RC-05 advisory | **RC-05 advisory, intentionally unchanged** |
| Python suites | 13 | **13 of 13** |
| Argument-free validators | 8 | **8 of 8** |
| Block 1 | 142 | **142**, unmodified |
| Block 2 | 69 | **69**, unmodified |
| Block 3 | 105 | **105**, unmodified |
| Block 4 | 261 | **261**, unmodified |
| Block 5 | 225 | **225**, unmodified |
| Block 6 | 216 | **216**, unmodified |
| Block 7 | 129 | **129**, unmodified |
| Block 8 | 114 | **114**, unmodified |
| Block 9 | 153 | **153**, unmodified |
| Block 10 | 81 | **81**, unmodified |
| Block 11 | no audit (no visible change) | still none |
| **Block 12** | — | **81/81** (27 × 3) |
| `git diff --check` | clean | clean |

### The gate list a future block must run

```
cd app && npm ci && npm test && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run build
pip install -r scripts/requirements.txt
for t in scripts/test_*.py; do python3 "$t"; done                 # 13
for v in scripts/validate-*.py; do python3 "$v"; done             # 8 argument-free
cd app && for b in block1-ux block2-photography block3-zones block4-zone-planner \
                   block5-travellers block6-divergence block7-zone-provenance \
                   block8-airport-link block9-editorial-governance block10-source-freshness \
                   block12-bundle-architecture; do
            node scripts/$b-browser-audit.mjs --browser=/opt/pw-browsers/chromium; done
node scripts/bundle-report.mjs        # composition and sizes, raw + gzip + brotli
```

Do **not** run `playwright install`.

## Remaining technical debt

| | |
|---|---|
| **`RC-05` — resolved, and re-stated** | The advisory still fires on ~900 kB of raw JSON that ships as 105 kB. It is a threshold on the wrong unit. **Deliberately not silenced.** |
| **The walking dataset is on the critical path** | 298 kB raw / ~12 kB gzip via the draft-restoration chain. Moving it needs a functional refactor of the planning-draft migration path. Worth ~12 kB — do it for architecture if ever, not for size. |
| No real-device or throttled-network measurement | This environment has none. No parse-time or TTI figure is claimed anywhere. |
| `standing-sales-rule` has no re-check interval | Inherited from Block 11. **Do not close it by picking a number.** |
| The `needs-recheck` UI state is unexercised in a browser | Inherited from Blocks 10–11. |
| `unsupported` is not representable | Deliberate, unchanged. |
| Editorial ratings still have no second reader | Inherited from Block 3; only the travellers can close it. |
| Ikebukuro's Narita coach is no longer recorded | Inherited from Block 8; unverifiable from this environment. |
| `railLines` / `shinkansen` remain encyclopedia-sourced | Inherited from Block 7. |
| Four zones inline the same Narita source record | Inherited from Block 7. |
| `.icon-button--small` is a 36px control | Pre-existing, allowed since Block 1. |

---

## ¿BLOQUE 12 CERRADO? **SÍ**

RC-05's real cause was measured and turned out to invert the original diagnosis — the dataset, not
the libraries; the audit came before any design; the metric was corrected from raw bytes to what a
phone actually transfers and evaluates, and the headline 253 kB file was shown to cost 10 kB; the
first-render set was established from the module graph rather than assumed, and Leaflet and the
walking data were **kept** on the critical path with their reasons recorded; two real product
boundaries were deferred and nothing else, with zero duplication, no added request and no waterfall;
the initial payload fell 11.9% gzipped and the split was prevented from becoming a click-time wait;
the advisory was **not** silenced, so nothing is hidden; the one historical gate that tripped was
satisfied by moving the code, not the gate; the guards assert architecture rather than output and
were broken on purpose to prove they fire; no real-device number is claimed anywhere; Blocks 1–10
are at baseline and byte-identical and Block 12's own audit is green at three viewports; the tree is
clean, the branch is pushed, `main` is untouched, and there is no merge and no pull request.

---

## Recommendation for Block 13

**Record the outcome of the human review Block 9 unblocked.** Unchanged from Block 11's
recommendation, and now by a wider margin the oldest open thread. It needs no external research and
no new code; it needs the two travellers, which is exactly why it keeps being deferred and why no
session can close it unilaterally.

**Second choice: nothing in performance.** Block 12 took the only two honest boundaries this
architecture offers. The next real gain would be the walking dataset, and it is worth ~12 kB gzip —
below the threshold at which touching the planning-draft migration chain could be justified. Any
further bundle work should be triggered by a measured problem on a real device, not by a threshold.

**Explicitly NOT recommended now:**

- **Splitting anything else.** Every remaining candidate is either on the critical path or under
  25 kB. More chunks would be the antipattern this block spent its audit avoiding.
- **Raising `chunkSizeWarningLimit`** to make the advisory disappear. It would change nothing a user
  downloads, and it would throw away the honest signal.
- **Moving the walking datasets** without an architectural reason, and certainly not by loosening the
  draft-restoration invariants Blocks 4–6 built.
- **Real-device performance claims** from this environment. It cannot make them.
- **The backend / two-device layer**, more photography (both Block 2 STOP criteria hold), more zones
  (the 4–7 rule), travel-time estimation without a routing-provider decision.
