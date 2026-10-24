# Block 6 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/brave-wozniak-f79ie3` |
| Started from | `c260c758a6b3adc7266df01e22fe19a1be4f1609` (Block 5 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. No new branch. |
| Working tree | Clean. |
| Block 6 status | **Closed.** |

## What Block 6 turned out to be, and the authority for it

**"Dónde no coincidimos": a derived view over Block 5's state, as a filter inside the saved list.**

The brief required determining which of three situations was real before defining anything.

| | situation | verdict |
|---|---|---|
| A | the roadmap already defines Block 6 | **No.** `docs/ROADMAP.md` closes Block 5 with *"Authorized next step: none decided."* A repository-wide search for "Block 6" / "Bloque 6" matched exactly one line: the recommendation heading in `docs/BLOCK_5_HANDOFF.md`. |
| B | the roadmap leaves Block 6 open and this is the coherent evolution | **Yes — this is the real situation.** The only forward-looking authority is the Block 5 handoff's first recommendation, and it is what this block implements. |
| C | incompatible instructions or a blocking dependency | **No.** No contradiction was found. Every Block 5 invariant is preserved (see below), and the one dependency — reading which places the planner holds — is satisfiable as a pure read. |

Preflight verified independently before anything was defined: branch, HEAD, remote, `main`, a clean
tree, the full historical baseline, and every roadmap and handoff document for Blocks 1–5.

**One preflight discrepancy, recorded not hidden.** The session opened on a different branch
(`claude/eloquent-cerf-ado7au`) at `origin/main`, and the local `main` ref was stale at `b924f5c`.
`origin/main` was verified as `1a11fe8`, matching the brief. `claude/brave-wozniak-f79ie3` was
checked out at exactly `c260c758a6b3adc7266df01e22fe19a1be4f1609`. The stale local `main` was left
alone rather than corrected: `main` was not to be modified, and it is a local ref only.

## Commits

1. `55818f5` `feat(preferences): show where the two of them do not coincide, without deciding anything`
2. `docs(block-6): design record, roadmap entry and handoff` — the head commit. It cannot carry its
   own hash; `git log -1 claude/brave-wozniak-f79ie3` is the authority.

## Files

**New**

| File | What it is | Tests |
|---|---|---|
| `app/src/lib/interest-divergence.ts` | The pure derivation: five groups, four filters, the counts, and the rule for whether a filter row is worth offering. Imports nothing from the planning draft. | 33 |
| `app/src/lib/divergence-presentation.ts` | The copy: chip labels, accessible names, the per-row line, the status line, the empty states. No arithmetic. | 21 |
| `app/src/usePlannedPlaceIds.ts` | The read-only snapshot of which places the planner has put in a day. | — |
| `app/src/components/ShortlistFilterBar.tsx` | The block's entire new UI: one row of chips. | 29 (shared) |
| `app/src/components/DivergenceView.test.ts` | The wiring contract across seven files. | ” |
| `app/scripts/block6-divergence-browser-audit.mjs` | 72-check real-viewport audit against the production build. | — |
| `docs/BLOCK_6_DESIGN.md` | The design record. | — |

**Modified:** `SelectionPanel.tsx` (the filter state, the chip row, the status line, the empty
state, the per-row derived line, the marker stand-down), `App.tsx` (the two reads and the planner
revision), `useTravellers.ts` (`divergenceFor`, so the document stays inside its hook),
`lib/planning-draft-v8.ts` (`dayAssignedPlaceIds` — a read and nothing else),
`lib/planning-draft-v8.test.ts` (+5), `App.css`, `docs/ROADMAP.md`.

**Deleted:** nothing.

## State model

```ts
type DivergenceGroupKind = "agreed" | "only-you" | "only-them" | "differing" | "unclaimed";

type DivergenceEntry = {
  placeId: string;
  group: DivergenceGroupKind;   // from the ACTIVE reader's side
  planned: boolean;             // the planner already holds it — information only
};

type ShortlistFilterKind = "all" | "agreed" | "only-one" | "differing" | "unclaimed";
```

`divergenceEntries(document, plannedPlaceIds)` walks the shortlist in the order it already has. It
introduces no ordering. A place both of them have refused is not in the shortlist and is not in the
view.

## Persistence

**None was added.** No document, no version, no migration, no `localStorage` key. The filter is
React state in `SelectionPanel` and is deliberately not persisted — a filter is what the reader is
looking at right now, not a decision about the trip.

Proved three ways: a test that no Block 6 module names a `nihon.*` key or calls
`localStorage.setItem`; a test that `usePlannedPlaceIds` hands the draft loader a `DraftStorage`
whose setter is a no-op; and a browser check comparing the full `nihon.*` key set before and after
the entire flow.

## UX implemented

- **One row of filter chips inside the saved list** — not a second main surface.
- **The row appears only when it could partition the list.** With everything in one bucket, "Todo"
  and that bucket's chip select the same rows. `shouldOfferFilters` requires two populated buckets,
  with one exception: a filter the reader has already pressed stays offered at zero, so they are
  never stranded in a filtered list with no way back.
- **"Todo" is Block 5's list, unchanged** — short markers and all, no derived line, no status line.
- **One indicator per row, never two.** Inside a filtered view the derived line replaces the short
  marker rather than sitting beside it.
- **A place the planner already holds says so, and nothing happens.**

### Accessibility

`role="group"` with a derived label on the row; `aria-pressed` per chip; the count inside the
accessible name; the visible label is text; pressed is marked by weight, background **and** border;
44px floor on every chip with no allowance; horizontal scroll rather than wrapping or widening the
panel; `prefers-reduced-motion` honoured.

## Copy

| group | line |
|---|---|
| `agreed` | Los dos quieren ir. |
| `only-you` | Sólo tú lo guardaste. <otra> aún no ha opinado. |
| `only-them` | Sólo <otra> lo guardó. Tú aún no has opinado. |
| `differing` | Opiniones distintas: una persona quiere ir y la otra ha dicho que no le interesa. |
| `unclaimed` | Estaba en la lista antes de crear los perfiles. Nadie ha dicho todavía si le interesa. |

Empty state for the one that matters: *"No hay opiniones distintas: nadie ha dicho que no a un
lugar que la otra persona quiere."*

Planner note: *"Ya está en un día del recorrido. Esto no lo cambia."*

Forbidden by test: a percentage, a score, a compatibility figure, a ratio, `conflicto`,
`deberíais`, `mejor opción`, `os conviene`, `ceder`, `votar`, a winner.

## Cases covered

| | case | covered |
|---|---|---|
| A | both interested | unit + browser |
| B | P1 interested / P2 silent | unit + browser |
| C | P2 interested / P1 silent | unit + browser |
| D | P1 interested / P2 refusal | unit + browser |
| E | P2 interested / P1 refusal | unit + browser |
| F | legacy, unclaimed | unit + browser |
| G | one-sided place already in the planner | unit + browser |
| H | no explicit disagreement exists | unit + browser |
| I | a change of stance updates the view immediately | unit + browser |
| J | a profile reset / removal updates the view | unit + browser |
| K | reload preserves Block 5's persisted state exactly | browser |
| L | no additional storage is written | unit + browser |

## Gates executed

| check | baseline | result |
|---|---|---|
| Vitest | 2842 / 81 files | **2930 passed**, 0 failed, **84 files** |
| oxlint | clean | clean |
| `tsc --noEmit -p tsconfig.app.json` | clean | clean |
| `vite build` | OK | OK |
| Python suites | 13 | **13 of 13 pass** |
| Validators | 8 | **8 of 8 argument-free pass** |
| Block 1 UX audit | 142/142 | **142/142**, unmodified |
| Block 2 photography audit | 69/69 | **69/69**, unmodified |
| Block 3 zone audit | 105/105 | **105/105**, unmodified |
| Block 4 zone → planner audit | 261/261 | **261/261**, unmodified |
| Block 5 two-traveller audit | 225/225 | **225/225**, unmodified |
| **Block 6 divergence audit** | — | **216/216** (72 per viewport × 3) |
| `git diff --check` | clean | clean |

**Exact numbers.** Tests added: **88 Vitest** — 33 (`interest-divergence.test.ts`), 21
(`divergence-presentation.test.ts`), 29 (`DivergenceView.test.ts`), 5 (`planning-draft-v8.test.ts`)
— plus **72 browser checks × 3 viewports = 216**. Total Vitest 2842 → 2930.

The baseline above was measured on this branch at `c260c75` **before any edit**, and every figure
matched the Block 5 handoff exactly.

### The gate list a future block must run

```
cd app && npm ci && npm test && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run build
pip install -r scripts/requirements.txt          # Pillow, for test_photography_rendition.py
for t in scripts/test_*.py; do python3 "$t"; done                 # 13, all must pass
for v in scripts/validate-*.py; do python3 "$v"; done             # 8 argument-free
cd app && node scripts/block1-ux-browser-audit.mjs
          node scripts/block2-photography-browser-audit.mjs
          node scripts/block3-zones-browser-audit.mjs
          node scripts/block4-zone-planner-browser-audit.mjs
          node scripts/block5-travellers-browser-audit.mjs
          node scripts/block6-divergence-browser-audit.mjs
```

Add `--browser=/opt/pw-browsers/chromium`. Do **not** run `playwright install`.

## Browser audit, per viewport

`block6-divergence-browser-audit.mjs` runs against the production build via `vite preview` at
**390×844 DPR 2**, **820×1180 DPR 2** and **1440×900** — 72 checks each, 216 total, all passing.

It drives the real flow: an empty list offers no filter row → one agreed place still offers none,
because "Todo" and "Los dos" would select the same rows → a one-sided place brings the row in, with
**no** "Opiniones distintas" chip, because nobody has said no → the default view carries no status
line and no derived line on any row → filtering to "Sólo uno" names the place as yours, says the
other person *aún no ha opinado*, and the short marker stands down so the row carries one indicator
→ **switch to P2**: the same stored state reads as theirs → back to "Todo": still no disagreement
chip and no *desacuerdo* in the tally → P2 presses "No me interesa": the "Opiniones distintas" chip
appears and "Sólo uno" retires, and the place stays in the shared list → P2 changes their mind: the
selected filter stays selected, empties, and shows the explicit empty state rather than a stale row
→ the planner opens, days are assigned, the planner closes → the one-sided place now says it is
already on a day and that this does not change it → the draft is **byte-for-byte** what the planner
left, still V8, with no traveller dimension → pressing filters changes neither the draft nor the
travellers document → a profile reset updates the view → reload preserves both documents exactly
and **adds no storage key** → the list reopens on "Todo" → no horizontal page scroll, the row never
widens its panel, no chip truncates, every chip has a unique accessible name carrying its count,
exactly one is pressed, tab reaches the next chip and draws a visible ring, the keyboard alone
applies a filter, pressed and unpressed differ by more than hue, reduced motion leaves no
transition → the panel never exposes an internal name, a percentage or a judgement → no page or
console errors.

## Regressions found and fixed

**One defect, caught by this block's own audit before the commit.** With every saved place in one
bucket, the chip row rendered "Todo" and one other chip that selected exactly the same rows — two
controls doing the same thing, in a view whose whole premise is that the everyday list stays light.
`shouldOfferFilters` now requires two populated buckets, with the already-pressed filter as the
deliberate exception, and is covered by five tests.

**No regression was found in any historical gate.** All five historical audits pass at their exact
baseline counts, and none was modified.

## False positives of the new gate, and what was done about them

Three, all in `block6-divergence-browser-audit.mjs` itself, all found and fixed before the commit.
None was a product defect and none led to weakening anything.

1. **Tap floor.** The new audit applied a flat 44px floor inside `.selection-panel` and flagged
   `.icon-button--small` at 36px. That control is the saved list's long-standing "Quitar" button
   and 36px is an **explicit allowance in Block 1's canonical audit** (`COMPACT_TAP_ALLOWANCE`)
   since Block 1. Block 6 adds no control there and has no standing to raise the floor under an
   existing one. The new audit now **adopts Block 1's allowance rather than re-deciding it**, and
   holds Block 6's own chips to the full 44px with no allowance at all.
2. **Focus ring.** The audit focused a chip programmatically and found no ring. `:focus-visible` is
   what draws it and Chromium only matches that for keyboard focus. The audit now tabs to the chip,
   as a reader would, and asserts both that tab reaches it and that the ring is drawn.
3. **Reduced motion.** The audit read `transitionDuration` and got `1e-06s`: Chromium's
   reduced-motion emulation clamps every duration, so the duration alone cannot tell an honest
   `transition: none` from an emulated one. The audit now asserts `transitionProperty === "none"`,
   which is what the CSS actually sets.

## Changes made to historical audits

**None.** No file under `app/scripts/block1..block5-*.mjs` was touched. The only historical source
file modified is `lib/planning-draft-v8.ts`, and the change is purely additive: one exported pure
read, `dayAssignedPlaceIds`, with five new tests in the existing suite. No existing assertion was
changed, relaxed or removed anywhere in the repository.

## Block 5 invariants, re-verified

Every one of these still holds, and none was revisited:

- only *"¿quiero ir aquí?"* is personal; route, days, dates, anchors, legs, segments and zones stay
  shared;
- `ManualPlanningDraftV8` is still V8 — no migration, asserted by test and by the audit;
- the shared shortlist is still derived, with no second writer;
- `usePlanningDraft(savedIds)` still receives `string[]`;
- silence and explicit refusal are still distinct — Block 6 exists to make that distinction
  visible;
- disagreement is represented, never resolved automatically;
- zero scoring, zero percentage compatibility, zero opaque ranking;
- legacy places still arrive without attribution, and `nihon.savedPlaceIds` is still never written;
- the heart still shows the active traveller's interest, not the shared shortlist;
- `useZonePlanChoice`'s mutual-exclusion assumption still holds — Block 6 adds a **reader** of the
  draft, never a writer, so the refactor stays unmade.

## Remaining technical debt

| | |
|---|---|
| `usePlannedPlaceIds` refreshes when the planner closes, not continuously | Correct today because the planner is the only live writer while mounted, and the saved list sits behind it. If a future block renders the planner and the saved list side by side, this snapshot would go stale and should be lifted to a shared draft state — the same refactor `useZonePlanChoice` would need, and for the same reason. |
| `useZonePlanChoice` still relies on comparison and planner being mutually exclusive | Re-examined again this block and deliberately left alone. Block 6 adds no writer. |
| `.icon-button--small` remains a 36px control in the saved list | Pre-existing and explicitly allowed since Block 1. Not in Block 6's scope to change, recorded here so it is not rediscovered as new. |
| Two travellers share one browser profile | By design (option A), from Block 5. |
| `activeTravellerId` is stored in the shared document | A device fact; a real multi-device build would move it to device-local storage. |
| No history of who changed what | Stances are last-write-wins per person. |
| `RC-05` | Single JS chunk above Vite's 500 kB advisory. Pre-existing, untouched. |
| Editorial zone ratings still have no second reader | Inherited from Block 3, still actionable now both travellers exist. |

---

## ¿BLOQUE 6 CERRADO? **SÍ**

All twelve required cases (A–L) are covered by tests, and every observable one is also covered by
the browser audit at three viewports against the production build.

---

## Recommendation for Block 7

**Upgrade the zone `facts` provenance from encyclopaedia station articles to operator pages.**

It is the one recommendation that has been unclaimed since Block 4, it is bounded, it needs no
product decision, and it strengthens the single part of the zone layer that claims to be verifiable
— which matters more now that Block 4 lets a zone seed a real accommodation anchor and Block 6 has
made the preference layer feature-complete for a two-person trip.

**Second choice, equally safe:** let the two travellers review the editorial zone ratings. The debt
has been carried since Block 3 and both readers now exist; it would need a small product decision
about whether a rating is shared or personal, which by Block 5's own rule is almost certainly
*shared* — it is a claim about a place, not a preference about one.

**Explicitly NOT recommended now:**

- **The backend / two-device layer.** Still a separate product decision. Nothing in Block 6 forces
  it, and Block 6 deliberately added no state that would have to be synchronised.
- **Any scoring, matching, ranking or recommendation feature** built on the preference data. Block
  6 added a second layer of tests that exist specifically to forbid it.
- **Acting on a disagreement automatically** — proposing a substitution, removing a one-sided
  place, or suggesting who should give way. The whole block is built on preference not being a
  planning decision, and the audit asserts the draft is byte-for-byte untouched.
- More photography (both Block 2 STOP criteria still hold), more zones (the 4–7 rule), travel-time
  estimation without a routing-provider decision.
