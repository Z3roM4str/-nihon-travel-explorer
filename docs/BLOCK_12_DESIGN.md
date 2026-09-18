# Block 12 — RC-05: performance / bundle architecture audit

`RC-05` — *"single JS chunk above Vite's 500 kB advisory"* — has sat in the debt table since the
v1 release-candidate audit and was carried, correctly untouched, through Blocks 1–11. This block
treats it as its own subject.

The brief's central constraint governs everything below: **a Vite warning is not an obligation to
split a bundle.** The question is whether the size or shape of Nihon's JavaScript materially hurts
the experience, especially on a phone — and the answer is only worth having if it is measured.

---

## 1. What is actually in the bundle

Measured at `ae2b30a` from the production build.

### Totals, before any change

| | raw | gzip | brotli |
|---|---|---|---|
| `index.js` (one chunk) | **1,530,614 B** | **284,387 B** | **227,624 B** |
| `index.css` | 95,588 B | 19,099 B | 16,596 B |

### Composition — the finding that reframes RC-05

Attributed by rolldown's own `renderedLength` (see `app/scripts/bundle-report.mjs`), which sums to
2,265,815 B pre-minification:

| bucket | bytes | share |
|---|---|---|
| **data (JSON)** | **988,452 B** | **43.3%** |
| React runtime | 485,484 B | 21.3% |
| `src/components` | 283,193 B | 12.4% |
| Leaflet + react-leaflet | 256,180 B | 11.2% |
| `src/lib` | 222,626 B | 9.8% |
| `src` (other) | 46,052 B | 2.0% |

The original RC-05 note guessed *"an ordinary size for React + Leaflet plus the full 214-place
dataset"*. That has the proportions backwards. **React and Leaflet together are 32.5%. The dataset
is 43.3% on its own** — larger than either runtime, and larger than all of Nihon's own code.

### The measurement that decides the block

JSON and code do not compress alike, and RC-05 is stated in raw bytes, which is the misleading unit:

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

`walking-scale-results.json` is the single most alarming number in the raw column and **costs 10 kB
on the wire** — 4%, because it is thousands of near-identical records and gzip is very good at that.

So: **roughly 900 kB of the 1.53 MB "problem" is data that ships as 105 kB.** Of the 284 kB actually
transferred, about 105 kB is data and about 180 kB is code. An audit that had stopped at the raw
number would have sent the next reader after the wrong 253 kB.

---

## 2. The right metric

Vite's advisory fires on **raw minified bytes of one chunk**. That is the wrong unit twice over: it
ignores compression, which every real server applies, and it counts a threshold rather than an
effect. The metrics that describe Nihon's actual cost:

| metric | why it matters here |
|---|---|
| **initial bytes transferred (gzip / brotli)** | what a phone on mobile data actually waits for |
| **initial bytes parsed/evaluated (raw)** | what a mid-range phone's CPU actually chews; raw size matters *here*, after download |
| **number of initial requests** | a second blocking request on a high-latency link costs more than the bytes it saves |
| **deferred bytes, and when they arrive** | a split only helps if the deferred code is genuinely not needed, and does not become a stall later |
| **duplication across chunks** | the standard way splitting quietly makes things worse |
| **cache behaviour across surfaces** | a chunk that changes on every deploy is worse than one that does not |

**Not measured, and not claimed.** This environment has no real device, no throttled network and no
CPU profile. No figure for parse time, time-to-interactive or first paint on an iPhone appears
anywhere in this block, because inventing one would be worse than omitting it. Every number here is
a build or network measurement that can be re-derived by running the script.

---

## 3. Natural boundaries

The audit looked for boundaries in the product, not in the byte count. Nihon's entry is `App.tsx`,
which statically imports every surface. Four are rendered behind a `useState(false)` flag — full
overlays that cannot be on screen at first paint and require a deliberate click.

Exclusive weight, computed from the real module graph (modules reachable from the entry **only**
through that component):

| surface | exclusive bytes | modules | gated by |
|---|---|---|---|
| **`OrderedSequenceBuilder`** (planner) | **246,464 B** | 27 | `sequenceBuilderOpen` |
| **`ZoneComparison`** | **37,758 B** | 8 | `zonesOpen && activeHub` |
| `PlaceDetail` | 24,904 B | 3 | `selectedPlace` |
| `NationalExplorer` | 20,471 B | 5 | **first render** |
| `SelectionAnalysis` | 14,045 B | 1 | `analysisOpen` |
| `TravellerManager` | 9,072 B | 1 | `travellerManagerOpen` |
| `PlaceMap` | 4,357 B | 1 | `activeHub` |

### What the graph ruled out

**Leaflet cannot be deferred.** `INITIAL_VIEW.mode` is `"national"`, so the first thing Nihon renders
is `NationalExplorer` → `NationalMap` → `react-leaflet` → `leaflet`. The map is the first screen.
Deferring 256 kB of it would trade a real first paint for a smaller advisory number — the exact
trade the brief forbids, and the reason `PlaceMap`'s 4 kB is also left alone.

**The big JSON cannot be deferred without a functional refactor.** `walking-scale-results.json` and
`walking-pilot-results.json` (298 kB raw) arrive through `lib/transfer.ts`, which builds its lookup
index at module scope. The shortest path to it from the entry is:

```
main.tsx → App.tsx → usePlannedPlaceIds.ts → planning-draft-v8.ts
        → planning-draft.ts → day-assignment.ts → ordered-sequence.ts → transfer.ts
```

That is the **draft-restoration path**, which runs on mount so the app knows which places are
planned. Breaking it would mean restructuring the planning-draft migration chain — a functional
refactor, forbidden by §7, and one that would risk the saved-plan invariants Blocks 4–6 established
to buy 10 kB of gzip. **Not done, and recorded as the honest reason.**

**`SelectionAnalysis` (14 kB) and `TravellerManager` (9 kB) are too small.** A chunk each would buy a
request and save nothing worth having — the "twenty tiny chunks" the brief rules out.

**`PlaceDetail` (25 kB) was considered and rejected.** It is reached by tapping a place, the most
common interaction in the app, and it would not take the walking data with it (that stays in the
entry via the draft path anyway). A round trip on the core interaction to move 25 kB raw is a bad
trade.

---

## 4. Decision: **A — change, but only at two boundaries**

Both the planner and the zone comparison are deferred with `React.lazy`. Nothing else is touched. No
`manualChunks`, no vendor splitting, no change to `chunkSizeWarningLimit`.

### And a second decision, stated plainly

**The advisory still fires, and was deliberately not silenced.** The entry chunk is still 1.38 MB
raw, because it still contains ~900 kB of data that a first render needs and that compresses to
105 kB. Raising `chunkSizeWarningLimit` would have made the warning disappear without changing a
single byte a user downloads, which is precisely the cosmetic surgery the brief rules out. The
warning stays visible as an honest signal about raw size; this document is the answer to it.

So RC-05 closes as **"diagnosed, materially improved where a real boundary existed, and the residue
explained"** — not as *"warning gone"*.

---

## 5. Before / after

| | before | after | delta |
|---|---|---|---|
| **initial JS, raw** | 1,530,614 B | **1,377,479 B** | **−153,135 B (−10.0%)** |
| **initial JS, gzip** | 284,387 B | **250,628 B** | **−33,759 B (−11.9%)** |
| **initial JS, brotli** | 227,624 B | **201,105 B** | **−26,519 B (−11.7%)** |
| initial requests | 1 JS + 1 CSS | 1 JS + 1 CSS | unchanged |
| chunks total | 1 | 3 | +2 |
| CSS | 95,588 B | 95,588 B | unchanged |

### The two new chunks

| chunk | raw | gzip | brotli | modules | when it loads |
|---|---|---|---|---|---|
| `OrderedSequenceBuilder-*.js` | 136,816 B | 31,917 B | 27,417 B | 27 | idle prefetch after first paint, or on opening the planner |
| `ZoneComparison-*.js` | 19,443 B | 5,872 B | 5,237 B | 8 | same |

### What stayed on the critical path, verified

| in the entry chunk | why |
|---|---|
| `leaflet` + `react-leaflet` (256 kB) | the first screen is the national map |
| `react-dom` (485 kB) | runtime |
| `places.json`, `nearby.json`, `photography-metadata.json`, `zones.json` | needed to render the first list and map |
| `walking-*-results.json` (298 kB) | reached by the draft-restoration path on mount |

### Cost of splitting, measured rather than assumed

- **Duplication: none.** 104 + 27 + 8 = 139 modules, disjoint across the three chunks.
- **Waterfall: none added.** The initial request count is unchanged. The deferred chunks are
  siblings fetched at idle, not a chain: neither imports the other, and neither is a
  `modulepreload` in the document head.
- **Total bytes across all chunks** grew by ~3 kB raw / ~4 kB gzip — chunk boilerplate. That is the
  honest price of the boundary and it is 1.6% of what the entry saved.

### The split does not move the wait onto the user

`prefetchOnDemandSurfaces()` warms both chunks on `requestIdleCallback` after first paint, with a
`setTimeout` fallback for browsers that lack it (Safari shipped it late). Both prefetches swallow
rejection: a failed prefetch must never surface as an error, and `React.lazy` will simply fetch
again on open and report properly then. The effect is cancellable so it cannot outlive the
component.

Without this, splitting would merely move the wait from load to click — a worse trade, since a
slower first paint is shared by everyone while a stalled overlay lands on the one person who asked
for it.

---

## 6. Preserving the experience

The one structural subtlety: **the `Suspense` boundary sits outside the condition, not inside it.**

```tsx
<Suspense fallback={null}>
  {sequenceBuilderOpen && <OrderedSequenceBuilder … />}
</Suspense>
```

The first attempt put it inside, and `ZonePlanSection.test.ts` caught it — a source-shape test
pinning *"keeps the planner mounted only while open, so it reloads what the comparison wrote"*. Its
regex asserts the condition sits directly against the component. The invariant it protects — the
planner unmounts on close, so reopening re-reads the draft — was never actually broken; only the
adjacency its regex assumed.

Following the precedent Block 10 set when it tripped Block 7's anchored audit, **the code was
restructured rather than the gate relaxed.** Moving the boundary outside restores the exact shape,
and is better React anyway: one stable boundary instead of one that mounts and unmounts with its own
content. `ZonePlanSection.test.ts` passes byte-identical.

`fallback={null}` is deliberate: the overlay simply appears, as it always did. A spinner would be new
UI reporting on a wait the prefetch has usually already removed.

**No visual change, no copy change, no layout change.** All ten historical audits pass unmodified.

---

## 7. Guards

Two layers, split by what each can actually prove.

**`app/src/bundle-architecture.test.ts` — 9 tests, architecture only.** No chunk hash, no byte count,
no `dist/` filename: all three are incidental and would fail for reasons nobody wants to read. What
is pinned is the shape that *causes* the split:

- both deferred surfaces are reached only through `import(...)`, never statically;
- **no other module static-imports them** — the quiet failure where one stray import undoes the
  split while every test and the build stay green;
- the first-render surfaces (`NationalExplorer`, `PlaceMap`, `PlaceList`, `PlaceDetail`) are **not**
  lazy, and `INITIAL_VIEW.mode` is still `"national"`, so the map stays critical;
- the prefetch exists, has a non-`requestIdleCallback` fallback, swallows rejection and is
  cancellable;
- the `Suspense` boundary is outside the condition.

**`app/scripts/block12-bundle-architecture-browser-audit.mjs` — 27 checks × 3 viewports = 81.** The
runtime half, which no source scan can reach: a green build will happily emit a chunk that 404s, and
a lazy route that fails does so silently behind `fallback={null}`.

**`app/scripts/bundle-report.mjs`** makes every number in §1 and §5 reproducible — no new dependency,
sizes from rolldown's own accounting, compression from `node:zlib`, raw and compressed always
together.

### The guards were broken on purpose

| broken | caught by |
|---|---|
| a stray `import { ZoneComparison }` in `PlaceDetail.tsx` (entry re-absorbs it) | 1 test |
| `NationalExplorer` made lazy (map off the critical path) | 1 test |
| the idle prefetch deleted (split becomes a click-time wait) | 1 test |
| the `Suspense` boundary moved inside the condition | 2 tests, including the historical `ZonePlanSection` one |

---

## 8. Answers to the closure questions

1. **What really caused RC-05?** The dataset, not the libraries — 43.3% JSON against 32.5% for React
   and Leaflet combined. The original note had it backwards.
2. **A real problem or an advisory?** **Mostly an advisory.** It is stated in raw bytes; ~900 kB of
   the chunk is data that ships as 105 kB gzipped. The real transfer cost was 284 kB, not 1.5 MB.
3. **What does the first render need?** React, Leaflet (the first screen is the national map),
   `places.json`, `nearby.json`, `photography-metadata.json`, `zones.json`, and — through the
   draft-restoration path — `transfer.ts` with its walking data.
4. **What can honestly be deferred?** Two overlay surfaces, 246 kB and 38 kB of exclusive modules.
   Nothing else clears the bar.
5. **Did the initial payload improve?** Yes: **−11.9% gzip, −11.7% brotli, −10.0% raw.**
6. **Waterfalls or artificial chunks?** None. Initial request count unchanged, no duplication, two
   chunks that are both real product surfaces, both prefetched at idle.
7. **Do all surfaces still work?** Yes — 81/81 at three viewports, plus ten historical audits
   unmodified.
8. **Historical gates green?** All of them, byte-identical.
9. **Reproducible before/after?** `node scripts/bundle-report.mjs`.
10. **Can RC-05 close without hiding the problem?** Yes — and specifically **without silencing the
    warning**, which still fires and is now explained rather than muted.

---

## 9. Remaining debt

| | |
|---|---|
| **`RC-05` — resolved, and re-stated** | The advisory still fires on ~900 kB of raw JSON that ships as 105 kB. It is a threshold on the wrong unit. Deliberately not silenced. |
| **The walking dataset is on the critical path** | 298 kB raw / ~12 kB gzip, pulled by the draft-restoration chain. Moving it needs a functional refactor of the planning-draft migration path — out of scope here, and worth ~12 kB, so it should be done for architectural reasons if ever, not for size. |
| No real-device or throttled-network measurement | This environment has none. Every figure in this block is a build or network measurement; no parse-time or TTI number is claimed. |
| `standing-sales-rule` has no re-check interval | Inherited from Block 11. Do not close it by picking a number. |
| Editorial ratings still have no second reader | Inherited from Block 3; only the travellers can close it. |
| Ikebukuro's Narita coach is no longer recorded | Inherited from Block 8. |
| `railLines` / `shinkansen` remain encyclopedia-sourced | Inherited from Block 7. |
| Four zones inline the same Narita source record | Inherited from Block 7. |
| `.icon-button--small` is a 36px control | Pre-existing, allowed since Block 1. |
