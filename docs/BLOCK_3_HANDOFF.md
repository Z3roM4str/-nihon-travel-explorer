# Block 3 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Branch | `claude/brave-wozniak-f79ie3` |
| Started from | `6aa5c1302f0b9e4c6585b9825e77fae48eef3702` (Block 2 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) |
| Merged to `main`? | **No.** No pull request. |
| Working tree | Clean. |
| Block 3 status | **Closed.** |

## Commits

1. `a5f5cf4` `fix(photography): make Commons acquisition work for small files, and resolve both deferrals`
2. `77a0ec0` `refactor(dataset): remove imageStatus, which said the same false thing 214 times`
3. `b79a327` `feat(zones): accommodation-zone comparison for Tokio, Kioto and Osaka`
4. `docs(block-3): design record, roadmap entry and handoff` — the head commit. It cannot carry
   its own hash; `git log -1 claude/brave-wozniak-f79ie3` is the authority.

## Files

**New**

| File | What it is |
|---|---|
| `data/accommodation/zones.json` | The canonical zone registry. Mirrored byte-for-byte to `app/src/data/accommodation/zones.json`. |
| `scripts/validate-accommodation-zones.py` | Enforces the fact/editorial separation, the place-field boundary, cluster resolution, the 4–7 per hub rule and source/app parity. |
| `app/src/lib/accommodation-zone.ts` | Domain: registry access, straight-line geometry, proximity bands, saved-places fit, ranking, contrasts. Exposes no composite score by design. |
| `app/src/useZoneComparison.ts` | Per-hub comparison selection in `localStorage`, capped at 4. |
| `app/src/components/ZoneComparison.tsx` | The comparison surface. |
| `app/scripts/block3-zones-browser-audit.mjs` | 105-check real-viewport audit. |
| `app/src/lib/accommodation-zone.test.ts` | 30 domain tests. |
| `app/src/dataset-contract.test.ts` | Keeps `imageStatus` gone, and catches any other single-valued field. |
| `scripts/test_photography_rendition.py` | 25 offline tests for the rendition contract. |
| `data/visual/block3-deferred-batch.json` | The two Block 2 deferrals, now acquired. |

**Modified:** `scripts/acquire-photography.py` (the rendition rule, throttling, provenance
checks), `scripts/prepare-block2-photography-metadata.py`, `scripts/validate-photography.py`,
`scripts/photography_baseline.py` (depth-batch awareness), `scripts/export-dataset.py`,
`scripts/test_photography.py`, `scripts/test_phase4m_stop_vs_continue.py`,
`scripts/test_walking_access_points.py`, `app/src/App.tsx`, `app/src/App.css`,
`app/src/types.ts`, `app/src/data/place-images.ts`, `app/src/data/place-images.test.ts`,
`data/places.json` + `app/src/data/places.json`, the photography registry, `docs/DATA_MODEL.md`,
`docs/ROADMAP.md`, `app/README.md`.

**Renamed:** `data/visual/block2-{coverage,depth}-plan.json` → `…-batch.json`, to match the
convention the baseline module's completeness guard actually discovers.

## Architecture chosen

**A zone is a separate canonical entity**, not a `Place` and not a cluster — the boundary
`docs/ACCOMMODATION_COMMUTE_DESIGN.md` (Phase 3D-P) already set, now validator-enforced. Zones
reference clusters by id and those references must resolve.

**Three kinds of statement are separated in the data and labelled on screen:**

| kind | stored in | trust comes from | badge |
|---|---|---|---|
| Fact | `facts` | `provenance` (sourceUrl, sourceEntity, consultedAt, evidence) | *verificables* |
| Derived | computed at runtime | canonical coordinates only | *calculado* |
| Editorial | `editorial`, `tradeoffs` | nothing; it is Nihon's judgement and says so | *criterio* |

The validator refuses `facts` without provenance and `editorial` **with** it.

## Zones included

**Tokio (6)** Shinjuku · Estación de Tokio/Marunouchi · Ueno · Asakusa · Shibuya · Ikebukuro
**Kioto (5)** Estación de Kioto · Shijō–Karasuma · Gion–Higashiyama · Arashiyama · Nijō
**Osaka (5)** Umeda/Kita · Namba/Minami · Shin-Ōsaka · Tennōji/Abeno · Bahía/Universal City

Chosen as distinct *strategies* (maximum connectivity, Shinkansen-underfoot, nightlife,
traditional-and-quiet, value, park-adjacent), not as a neighbourhood directory.

## Comparison criteria

**Objective (fact, sourced):** rail lines and operators at the zone's anchor station; whether
Shinkansen stops there and which lines, or the nearest station that has it; named airport
services and whether they are direct from the zone.

**Objective (derived, computed):** straight-line distance from the zone's station to each saved
place in the same hub — median, band distribution, and the nearest three.

**Heuristic (editorial, 1–5):** food, nightlife, quiet, walkability, tourism intensity, luggage
ease, first visit, short stay, late arrival, early departure. Plus at least two written
drawbacks per zone.

## New data and provenance

Every `facts` block cites the station article that defines it (`sourceUrl`, `sourceEntity`,
`consultedAt: 2026-09-17`, plus an `evidence` sentence quoting what was read). Facts were
researched per zone, not assumed. Non-obvious ones that change a decision: Asakusa has through
service to **both** airports on the Toei Asakusa line; Ōsaka Station gained the Haruka to Kansai
only in March 2023; Ueno's Shinkansen goes **north**, so Kyoto still means Tokyo Station first.

**What is objective:** everything under `facts`, and the straight-line distances.
**What is heuristic:** everything under `editorial` and `tradeoffs`, and the choice of which 16
zones to model at all.

## What was deliberately not built

No hotels, no prices, no booking, no scraping, no backend, no accounts, no auth, no
collaboration, no cross-device sync, no generative AI in the app. No travel-time estimate between
a zone and a place — the repository has no runtime routing and no recorded transfer edge starts
at a zone, so a minute figure would have been invented. No composite score and no "best zone".
No zones for Okinawa, Sapporo, Nagoya or Fukuoka: they have 1–3 places each and offer no real
accommodation choice.

## QA results

| check | result |
|---|---|
| Vitest | **2583 passed**, 0 failed (from 2547) |
| oxlint / `tsc` / build | clean · clean · OK |
| **All 13 Python suites** | **OK** (three were red at Block 2's head) |
| **All 7 validators** | OK, including the new zone validator |
| Block 1 UX audit | **142/142** |
| Block 2 photography audit | **69/69** |
| **Block 3 zone audit** | **105/105** |
| `git diff --check` | clean |

**The gate list every future block must run** — Block 2's omission of the middle row is what let
three suites rot:

```
cd app && npm test && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run build
for t in scripts/test_*.py; do python3 "$t"; done
for v in scripts/validate-*.py; do python3 "$v"; done
cd app && node scripts/block1-ux-browser-audit.mjs
          node scripts/block2-photography-browser-audit.mjs
          node scripts/block3-zones-browser-audit.mjs
```

### Responsive audit

`block3-zones-browser-audit.mjs` runs at **390×844 DPR 2**, **820×1180 DPR 2** and **1440×900**
against the production build, and covers: the panel opening as a dialog; 4–7 zones per hub;
selection, the two-minimum and the four-maximum cap and its release; comparison rendering one
block per zone; the map; all three provenance badges; source links; drawbacks; the contrast
section; the neutral-axis marking; the ten full axes staying behind a closed disclosure; tap
targets; **zero horizontal overflow on both the page and the panel**; Escape stepping back then
closing; selection surviving a reload; the honest empty state with nothing saved; a hub without
zones hiding the control; the saved-places system intact underneath; and zero page or console
errors.

## Performance

No new dependency. The zone registry is ~40 KB of JSON, loaded with the existing data bundle.
The comparison map reuses the Leaflet instance already bundled for the place map — no second
mapping library. Production bundle is unchanged in shape (one JS chunk, still above Vite's
500 kB advisory: `RC-05`, pre-existing and untouched). Asset footprint grew only by the two
resolved photographs and their derivatives (~0.25 MiB).

## Problems found

1. **Three Python suites were red at Block 2's head, and Block 2 reported green.** My baseline
   never ran `scripts/test_*.py`. Fixed, and the gate list above now names them.
2. **The batch-completeness guard could not see Block 2's manifests** because they were named
   `*-plan.json`. Renamed and registered.
3. **The baseline module had no concept of a depth batch.** Removing one by place id would have
   deleted the earlier record for the same place and corrupted every historical baseline. Now
   removed by `appendedAssetPaths`.
4. **`imageStatus` was actively false** and had already misled a handoff.
5. **The new hub-bar button shrank to 38px on phones**, under the 44px token — caught by Block
   1's audit mid-build, fixed.

## Risks and remaining debt

| | |
|---|---|
| Editorial ratings are one person's judgement | Sixteen zones × ten axes were authored in one pass. They are labelled *criterio* everywhere and each zone carries written drawbacks, but they have had no second reader. A future block could usefully have the two actual travellers review them. |
| Facts are sourced to encyclopaedia station articles | Accurate and checkable, but not operator-official. `provenance.sourceEntity` says exactly what was read. Upgrading to operator pages is a clear, bounded improvement. |
| Straight-line distance is a weak proxy in Tokyo | The rail network, not the crow, decides travel time. Bands and the wording mitigate it; only real routing would remove it, and that needs a provider decision the project has repeatedly deferred. |
| `RC-05` | Single JS chunk above Vite's advisory. Pre-existing, untouched. |
| Seven small-file photography records still depend on the host serving originals | They stay reproducible only while `upload.wikimedia.org` allows it. A closed legacy set, asserted at exactly 7 so it cannot grow. |
| Zone → planner is not connected | Choosing a zone does not create an accommodation anchor in `OrderedSequenceBuilder`. Deliberate — see below. |

## Assumptions

1. The three modelled hubs are where accommodation choice is real. Okinawa, Sapporo, Nagoya and
   Fukuoka have 1–3 places each.
2. `clusters.json` is a fair proxy for "what a zone serves"; zones reference cluster ids rather
   than re-deriving geography.
3. Straight-line distance to *saved* places is the most decision-relevant objective signal
   available without a routing provider.
4. Ordinal 1–5 is honest enough to compare and too coarse to over-trust. Decimals were rejected
   for implying precision the data lacks.

## Recommendation for Block 4

**Connect the zone decision to the planner — the obvious next step, and small.**
`lib/accommodation-commute.ts` already implements Phase 3D-Q's manual accommodation legs, and
`OrderedSequenceBuilder` already lets the user create an anchor by typing a label and
coordinates. A chosen zone should be able to seed that anchor: its station label and
coordinates are exactly the two fields the anchor needs. That closes the loop from "where should
we sleep" to "what does that do to our days" without a backend, without hotels, and without
inventing a single travel time — the user still enters the leg duration, exactly as the
accommodation gate requires.

**Then, and only with a decision from the user first: the two-person layer.** Block 1 shaped the
save interaction for "❤️ Quiero ir" and stopped short of collaboration; Block 3 has now given
both people something substantive to disagree about. It still needs the same product decision
Block 2's handoff named and that has not been answered: **two profiles in one browser, or is this
where a backend becomes unavoidable?** That block should open with the question, not with code.

**Not recommended:** more photography (both Block 2 STOP criteria still hold), more zones
(the hubs that matter are covered, and the 4–7 rule exists to prevent drift), or a composite
"best zone" score (the layer is deliberately built so one cannot be added without removing a
validator rule).
