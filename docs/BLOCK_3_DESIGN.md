# Block 3 — technical debt, and the accommodation-zone decision layer

**Status:** implemented. **Base:** `claude/brave-wozniak-f79ie3` at `6aa5c13` (Block 2 closed).
**Authorities it starts from:** [`BLOCK_2_PHOTOGRAPHY_DESIGN.md`](BLOCK_2_PHOTOGRAPHY_DESIGN.md),
[`BLOCK_1_UX_HIERARCHY_DESIGN.md`](BLOCK_1_UX_HIERARCHY_DESIGN.md) and — decisively for Phase B —
[`ACCOMMODATION_COMMUTE_DESIGN.md`](ACCOMMODATION_COMMUTE_DESIGN.md), the Phase 3D-P gate that
already settled what accommodation may and may not be in this repository.

Block 3 stops making Nihon prettier and starts making it decide things.

---

## Phase A1 — the Commons acquisition defect, fixed generally

Block 2 could not download two verified photographs, diagnosed why, and deliberately shipped no
fix rather than ship an unexercised one. The diagnosis held up.

**The defect, stated generally.** Commons renders a thumbnail only when the requested width is
*strictly smaller* than the file's own width. `iiurlwidth=1600` on a file that is already 1600px
or narrower therefore resolves to the **original** on `upload.wikimedia.org`, and originals are
rate-limited far more aggressively than cached `/thumb/` renditions. Every one of Block 2's 17
successes was wider than 1600px; both of its failures were the only two files at or below it.
Retrying the same URL can never succeed — the request is refused for what it is, not for when it
happened — so the fix belongs in width selection, not in the retry loop.

**`choose_render_width()` is a pure function of the file's own width.** A fallback triggered by
failure would make the acquired bytes depend on the host's mood, and this pipeline's entire
contract is that re-running it reproduces the same asset.

**Which rendition a record gets is decided by the record's own `processing`**, so acquisition
stays a function of committed data:

| `processing` | file ≤ 1600px | meaning |
|---|---|---|
| `webp-reencoded` | fetch the **original** | the asset IS the original resolution |
| `resized-and-webp-reencoded` | fetch the largest standard cached width below it | a reduced rendition |

That keeps the seven pre-existing small-file records exactly reproducible while making every new
one acquirable. `planned_processing_for()` is shared with the preparation script, so a record can
never be prepared declaring an intent that acquisition will refuse.

**Quality loss is never silent.** `acquire_one` recomputes what `processing` must say from what
it actually fetched and refuses to write an asset whose recorded provenance would be untrue. It
also refuses when Commons returns an original after a rendition was requested, and when the
file's dimensions no longer match the record — a file replaced in place is an identity change,
not an acquisition.

**Throttling is respected rather than fought:** a process-wide minimum interval between Wikimedia
requests, `Retry-After` honoured when sent, capped backoff, 503 treated like 429, bounded
attempts. Block 2 exhausted its own API budget by retrying; this cannot.

**The validator was relaxed in exactly one direction.** A file above the max dimension still may
not claim it was not resized — that direction is a lie about the asset. A file at or below it may
legitimately be a reduced rendition and must be free to say so.

**Both deferrals resolved.** `JP-205` and `JP-125` downloaded at 1280px and passed the same gates
Block 2 used, including visual inspection as committed WebP. Registry 161 → 163, galleries 4 → 6.
No other photograph was pursued: Block 2's STOP criterion still holds and this was debt, not
coverage.

### The suites my own baseline never ran

`scripts/test_*.py` is not part of `npm test`, and Block 2's validation ran the six dataset
validators but not these. **Three suites were red and I reported Block 2 as green.** Recorded
here rather than quietly fixed.

- `test_photography.py` — Block 2 made the card derivative part of a valid record and this
  test's synthetic fixture never grew one. Fixed, and given the coverage all three Block 2
  validator rules never had: missing derivative, oversized derivative, orphaned file.
- `test_a_grade_photography_selector{,_ii}.py`, `test_phase4m_stop_vs_continue.py` — historical
  baselines are reconstructed by removing later batches from the live registry. Block 2's
  manifests were named `*-plan.json`, which the discovery glob does not match, so
  `assert_batch_registry_is_complete()` — the guard designed for exactly this — stayed silent.
  Renamed to the established `*-batch.json` convention and registered.
- **Block 2 also introduced something the module was never designed for: a depth batch**, whose
  target place was *already covered*. Removing such a batch by place id would have deleted the
  earlier record too and corrupted every historical baseline. Batches now declare
  `appendedAssetPaths` and are removed by record; older manifests, which only ever covered new
  places, keep the place-id rule.
- `test_phase4m_stop_vs_continue.py`'s asset-evidence tests read the working tree while every
  other test in the file reads the Phase 4M base. They now read the base too — they describe that
  gate's evidence, not the live catalogue.

**All 13 Python suites now pass, and they are named in the Block 3 handoff's gate list so a
future block cannot omit them the way Block 2 did.**

## Phase A2 — `imageStatus` removed

`export-dataset.py` wrote the literal `"brief-only"` for every place, unconditionally. Once
photography existed the field was not merely uninformative but **false**: it claimed "no
photograph" about 157 places that have one. It had already done damage — it is what misled the
Block 1 handoff into telling a future session that `imageStatus` identified the uncovered set.

Audited before deciding: **nothing reads it.** `types.ts` declared it, two documents mentioned it
in prose, and `DATA_MODEL.md` declared a `"brief-only" | "assets-ready" | "verified"` union that
was never implemented. No runtime code, validator, script or test consumed the value.

**Removed rather than re-derived.** Whether a place has a photograph is answered authoritatively
by `photography-metadata.json`. Deriving that back into `places.json` would create a second
source of truth free to drift, and the workbook exporter neither knows nor should know about the
photography pipeline — the workbook owns the place, the registry owns its photography.

Proven surgical: the exporter reproduces the committed dataset byte-identically *before* the
change, and after it `imageStatus` is the **only** field that differs across all 214 places.

`dataset-contract.test.ts` stops it coming back in the field and in spirit: it also fails on any
*other* scalar field with exactly one distinct value across the catalogue, because a column with
one value pretending to be information is the actual defect. Two genuine constants are listed
with justification — `price.currency`, and `updatedAt`, the workbook's revision date, which the
place detail displays.

---

## Phase B — the accommodation-zone decision layer

### The question

> *¿En qué zona me conviene alojarme para este viaje, y qué sacrifico eligiéndola?*

Not "which neighbourhoods exist". The layer is a comparison instrument, and every design choice
below follows from that.

### What a zone is, and is not

Phase 3D-P already ruled that accommodation is a **separate entity**: `Place` is a tourism POI
and must not be overloaded into a lodging record merely because both have coordinates. Block 3
keeps that boundary and makes the validator enforce it — a zone carrying `grade`, `category`,
`duration`, `price`, `reservation` or `placeId` is a hard error.

A zone *references* clusters (`servesClusters`), and those references must resolve against
`clusters.json`. That reuses the catalogue's own canonical geography instead of inventing a
parallel one.

### Three kinds of statement, never mixed

This is the heart of the design and it is structural, not just documented.

| kind | where | what makes it trustworthy | shown as |
|---|---|---|---|
| **Fact** | `facts` | `provenance`: sourceUrl, sourceEntity, consultedAt, evidence | badge *verificables* |
| **Derived** | computed at runtime | canonical coordinates only | badge *calculado* |
| **Editorial** | `editorial`, `tradeoffs` | nothing — it is Nihon's judgement, and says so | badge *criterio* |

The validator refuses a `facts` block without provenance (a fact without a source is a heuristic
wearing a badge) and refuses an `editorial` block *with* provenance (which would imply the
judgement is sourced). The UI renders the three with distinct badges so a reader can tell them
apart without being told.

**Facts** were researched per zone from the station articles that define them: rail lines and
operators, whether Shinkansen stops there and which lines, and named airport services. Some are
genuinely non-obvious and change a decision — Asakusa has through service to *both* airports on
the Toei Asakusa line; Ōsaka Station gained the Haruka to Kansai only in March 2023; Ueno's
Shinkansen goes north, so Kyoto still means going to Tokyo Station first.

**Editorial** is ten axes, integers 1–5, closed vocabulary, validator-enforced: food, nightlife,
quiet, walkability, tourism intensity, luggage ease, first visit, short stay, late arrival, early
departure. Ordinal marks, never a bar chart — a bar implies a measurement.

**Derived** is straight-line distance from the zone's station to the user's saved places. It is
called *línea recta* everywhere and reported in bands (A pie / Cerca / Media distancia / Lejos)
rather than as a number of minutes. **This is the one place it would have been easy to lie.**
The repository has no runtime routing; `lib/transfer.ts` answers place→place for recorded edges
only, and no recorded edge starts at a zone. A minute figure would have been an invention, so
there is none.

### Nothing is declared best

There is no composite score and the library deliberately exposes none. `NEUTRAL_AXES` marks the
axes where higher is not better — tourism intensity and nightlife, which some readers want and
some are fleeing — so nothing colours them as good. Every zone must state **at least two honest
drawbacks**, and the validator checks it.

The single ranking that exists answers exactly one question — proximity to the list *you* saved —
and the screen says so in those words, including that it is straight-line and not travel time.
With nothing saved it invites saving rather than inventing an order.

### The zones

Chosen as **distinct strategies**, not a directory. The validator requires 4–7 per hub so the set
cannot silently grow into a list.

- **Tokio (6)** — Shinjuku (maximum connectivity), Estación de Tokio/Marunouchi (Shinkansen
  underfoot, quiet at night), Ueno (northern Shinkansen + Skyliner, cheaper), Asakusa
  (traditional, both airports direct, far from everything else), Shibuya (nightlife, hard with
  luggage), Ikebukuro (value, no direct airport train).
- **Kioto (5)** — Estación de Kioto (Shinkansen + Haruka, no soul), Shijō–Karasuma (the real
  centre, two lines only), Gion–Higashiyama (sleep inside the postcard, one line, saturated),
  Arashiyama (quiet once the coaches leave, far from everything), Nijō (central without the
  crowds).
- **Osaka (5)** — Umeda/Kita (rail hub, Haruka since 2023), Namba/Minami (food and nightlife,
  Rapi:t to KIX), Shin-Ōsaka (nothing to see, and sometimes that is exactly right),
  Tennōji/Abeno (value with a Haruka stop), Bahía/Universal City (only if the park matters).

### Native, not a mini-app

The entry point is in the hub bar beside the hub tabs — accommodation is a hub-level question —
and appears only for hubs that have zones. The panel reuses Block 1's overlay pattern, tokens,
spacing, badges and tap-target rules. Selection lives in `localStorage` per hub, capped at four,
and comparing a Tokyo zone against a Kyoto one is impossible because it answers nothing.

### Mobile-first as built

The comparison is **one block per zone, not a column-per-zone table**. A table would force the
horizontal scrolling this panel never does. Two columns appear only from 620px, and the ten full
axes stay behind a closed disclosure so the default view shows only the axes where the zones
actually differ.

---

## Verified

| check | result |
|---|---|
| Vitest | **2583 passed**, 0 failed |
| oxlint / `tsc` | clean |
| production build | OK |
| **all 13 Python suites** | **OK** — including the three Block 2 broke |
| **all 7 validators** | OK, including the new `validate-accommodation-zones.py` |
| Block 1 UX audit | **142/142** |
| Block 2 photography audit | **69/69** |
| **Block 3 zone audit** | **105/105** at 390×844 DPR 2, 820×1180 DPR 2, 1440×900 |
| `git diff --check` | clean |

Block 1's audit caught a genuine regression mid-build: the new hub-bar button dropped its label
on phones and shrank to 38px, under the project's 44px token. That is the regression net working.
