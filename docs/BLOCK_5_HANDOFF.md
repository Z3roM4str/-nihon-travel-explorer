# Block 5 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/brave-wozniak-f79ie3` |
| Started from | `9275281795a2c1446de07b1fc9010cdd4e606c27` (Block 4 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. No new branch. |
| Working tree | Clean. |
| Block 5 status | **Closed.** |

## Commits

1. `91c6940` `feat(travellers): two local profiles, and only what is genuinely personal`
2. `docs(block-5): design record, roadmap entry and handoff` — the head commit. It cannot carry its
   own hash; `git log -1 claude/brave-wozniak-f79ie3` is the authority.

## Files

**New**

| File | What it is | Tests |
|---|---|---|
| `app/src/lib/travellers.ts` | The pure domain: roster, stances, parser, mutations, derived shortlist. Imports nothing from the planning draft. | 68 |
| `app/src/lib/traveller-presentation.ts` | The marker, the per-traveller lines and the tally sentence. No arithmetic. | 24 |
| `app/src/useTravellers.ts` | The React integration. Replaces `useSavedPlaces` with the same surface. | — |
| `app/src/components/TravellerBar.tsx` | The layer's entire permanent UI: one header row. | 30 (shared) |
| `app/src/components/TravellerManager.tsx` | The one modal: rename / reset / remove. | ” |
| `app/src/components/TravellerLayer.test.ts` | The wiring contract across six files. | ” |
| `app/scripts/block5-travellers-browser-audit.mjs` | 75-check real-viewport audit against the production build. | — |
| `docs/BLOCK_5_DESIGN.md` | The design record. | — |

**Modified:** `App.tsx` (the hook, the header bar, the manager, the marker resolver, the
heart/shared-list split), `PlaceCard.tsx`, `PlaceList.tsx`, `PlaceDetail.tsx`, `SelectionPanel.tsx`,
`App.css`, `block1-ux.test.ts` (contract updated for the new owner),
`scripts/block3-zones-browser-audit.mjs` (regression fix), `docs/ROADMAP.md`.

**Deleted:** `app/src/useSavedPlaces.ts` — superseded, and keeping it would have left a second
writer of the same concept.

## Architecture chosen

**Shared vs personal was settled before any component was written.**

| | |
|---|---|
| **Shared — one trip** | route, day assignment, dates, visit start times, accommodation anchors, day boundaries, manual legs, inter-hub segments, chosen zones |
| **Personal — one thing** | *does this person want to go here* |

Duplicating anything from the first column would produce two plans rather than one trip. That is
the answer to "what must NOT be duplicated per person", and it is enforced by test in both
directions.

## Data model

```ts
type InterestStance = "interested" | "not-interested";   // absence = no opinion

type PlaceInterest = {
  placeId: string;
  stances: { travellerId: string; stance: InterestStance }[];
  carriedOver: boolean;          // in the list before profiles existed
};

type TravellersDocumentV1 = {          // nihon.travellers.v1
  version: 1;
  travellers: { id: string; label: string }[];   // 1..2, list not a pair
  activeTravellerId: string | null;              // who is holding the device
  interests: PlaceInterest[];
};
```

`shortlistPlaceIds()` derives the shared list — at least one traveller interested, or carried over
and unclaimed — and is the **only** contact point with the shared plan.

**Three states, never two.** Silence ≠ refusal, the same discipline Phase 3D-P applies to
`unselected` vs `no-accommodation`.

**Designed for a possible backend without building one:** `travellers` is a list rather than a
`person1`/`person2` pair, and stances are keyed by traveller id rather than by slot. Raising the
cap, or attaching a remote identity to a traveller later, is a constant and a field — not a
reshaping of every stored record.

## Migration strategy

**`ManualPlanningDraftV8` is NOT migrated.** Nothing in it is personal; a V9 would have added a
version, a migration and a parser rule for no change in meaning. Asserted by test rather than
claimed in prose: `planning-draft-v8.ts` may not mention a traveller, and `usePlanningDraft.ts`
still declares `useState<ManualPlanningDraftV8>`.

**`nihon.savedPlaceIds` → `nihon.travellers.v1`.** The legacy key is read **only when no travellers
document exists**, and is never written or deleted (it becomes inert; deleting it would add a
data-loss path for nothing). Its places arrive `carriedOver: true` with **no stances**, because
attributing them to Persona 1 would invent an opinion about a real person and to both would invent
two. They stay in the shortlist, are reported *sin reclamar*, and the flag clears for good the
moment anybody speaks.

## Invariants (all fail-closed, never repaired)

- 1–2 travellers, unique ids, non-blank labels;
- one stance per traveller per place; one record per place;
- every stance references a traveller in the same document — a dangling stance is **rejected**,
  never dropped and never reattributed;
- `activeTravellerId` resolves to a live traveller or is null;
- a record with no stances and `carriedOver: false` is refused (no setter can produce one);
- staleness against the catalogue is handled in `reconcileTravellers`, not at parse — the same
  parse-then-reconcile split the planning draft uses.

## Deleting / resetting a profile

| action | effect |
|---|---|
| rename | label only; blank rejected, never defaulted |
| reset | clears that person's stances, keeps the person; the other's untouched |
| remove | person + their stances; refused at one traveller; if they were active, the remaining one becomes active |

Nothing is ever reattributed. Places that were in the shortlist only because of that person leave
it, `savedIds` shrinks and the planner prunes through the existing cascade. **The count is on
screen before the press**, repeated in the confirmation, and both steps need a second explicit
press.

## UX implemented

- **One permanent surface**: a two-option segmented control in the header (`aria-pressed`, name in
  text, 44px, gear for the manager).
- **Saving is still one tap** — no person picker on any card, because the reader says who they are
  once.
- **The heart shows YOUR interest** (`activeInterestedIds`), while the map, the saved list and the
  planner keep the shared shortlist (`savedIds`). Without that split a place only the other person
  saved would look hearted while the marker said it was theirs.
- **The marker appears only when it adds something**: nothing for a place with no opinions, and
  nothing for a place you saved that the other has not seen. What remains is "Los dos", "Sólo
  <name>", "<name>: no", "Sin reclamar" — always as text, with a spelled-out description for
  assistive technology.
- **The place detail** carries the full per-person picture, including "no ha dicho nada" as a real
  answer, and the explicit "No me interesa".
- **The saved list** carries plain counts (`4 lugares: 2 que queréis los dos · 1 que quiere sólo
  uno · 1 con desacuerdo.`) — never a percentage.
- **One modal**, opened only by the reader.

### Accessibility

`role="group"` with a label on the bar; `aria-pressed` on each option; every control named with the
person it affects; `role="dialog"` + `aria-modal` + focus trap + Escape on the manager;
`role="alert"` on both confirmations; text never replaced by colour; 44px floor on every new
control, measured by the audit; `prefers-reduced-motion` honoured.

## Gates executed

| check | result |
|---|---|
| Vitest | **2842 passed**, 0 failed, 81 files (baseline 2720 / 78) |
| oxlint | clean |
| `tsc --noEmit -p tsconfig.app.json` | clean |
| `vite build` | OK |
| **Python suites** | **13 of 13 pass** |
| **Validators** | **8 of 8 argument-free validators pass** |
| Block 1 UX audit | **142/142** |
| Block 2 photography audit | **69/69** |
| Block 3 zone audit | **105/105** (after the regression fix) |
| Block 4 zone → planner audit | **261/261** |
| **Block 5 two-traveller audit** | **225/225** (75 per viewport × 3) |
| `git diff --check` | clean |

**Exact numbers.**

- **Tests added: 122 Vitest** — 68 (`travellers.test.ts`), 24 (`traveller-presentation.test.ts`),
  30 (`TravellerLayer.test.ts`) — plus **75 browser checks × 3 viewports = 225**.
  Total Vitest 2720 → 2842 (+122).
- **Python suites: 13**, all passing. `test_photography_rendition.py` needs `Pillow`
  (`pip install -r scripts/requirements.txt`) — an environment gap, not a code failure; installed
  and run for real.
- **Validators: 8**, not 7. Ten `validate-*.py` files exist; eight run argument-free and are the
  gate. `validate-walking-pilot.py` and `validate-walking-scale.py` refuse to run without an
  explicit mode flag and are acquisition pipelines, not gates.

### The gate list a future block must run

```
cd app && npm test && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run build
pip install -r scripts/requirements.txt          # Pillow, for test_photography_rendition.py
for t in scripts/test_*.py; do python3 "$t"; done                 # 13, all must pass
for v in scripts/validate-*.py; do python3 "$v"; done             # 8 argument-free
cd app && node scripts/block1-ux-browser-audit.mjs
          node scripts/block2-photography-browser-audit.mjs
          node scripts/block3-zones-browser-audit.mjs
          node scripts/block4-zone-planner-browser-audit.mjs
          node scripts/block5-travellers-browser-audit.mjs
```

Add `--browser=/opt/pw-browsers/chromium` when the container's Chromium does not match the pinned
Playwright build. Do **not** run `playwright install`.

## Browser audit, per viewport

`block5-travellers-browser-audit.mjs` runs against the production build via `vite preview` at
**390×844 DPR 2**, **820×1180 DPR 2** and **1440×900** — 75 checks each, 225 total, all passing.

It drives the real flow: the roster exists with no setup form → no card carries a marker before
anyone speaks → P1 saves in one tap → the stance is attributed to P1 alone and the place enters the
shared list → **switch to P2**: the marker now names P1, the heart is **not** filled, the shared
list still holds it → P2 saves too: "Los dos", with no number anywhere → P1 saves a second place →
P2 opens it and presses "No me interesa": the refusal is stored as its own stance **alongside** P1's
interest, the place **stays** in the shared list, and the agreed place is untouched → the saved
list summarises in counts naming agreement and disagreement → the planner opens and its draft is
**still V8** with the disputed place in the route and **no traveller dimension at all** → the
manager states the per-person cost before anything is pressed, renames, asks for confirmation,
cancels cleanly, then resets and removes only that person's stances → Escape closes it → keyboard
and accessible-name checks → reload preserves everything → **corrupt storage** falls back to a
fresh roster without a page error → an **orphan stance** is rejected rather than reattributed →
**a pre-Block-5 list** is carried over unclaimed with the legacy key left in place → no page or
console errors → no undeclared storage key.

## Regressions found and fixed

**Block 3's zone audit, 6 of 105 checks.** It emptied the shortlist by removing
`nihon.savedPlaceIds` in order to prove the panel degrades honestly with nothing saved. Block 5
made that the legacy key, so the list survived and the empty state was never reached. The audit now
clears the current owner too; the check's intent is unchanged. This is the regression net working,
as Block 1's tap-target audit did for Block 3's 38px button.

**One defect caught during development, before any commit.** `withStance` cleared `carriedOver`
unconditionally, so clearing a stance nobody had ever set would have dropped a carried-over place
out of the shortlist. Fixed by making a no-op a genuine no-op, and covered by a test.

## Performance

No new dependency. The travellers document is a few hundred bytes. `savedIds` is derived in a
`useMemo` over a list whose length is the number of saved places. The production bundle stays one
JS chunk above Vite's 500 kB advisory — `RC-05`, pre-existing and untouched.

## Decisions taken

1. **Personal data is exactly one thing** — interest in a place. Everything else is the trip's.
2. **No V9.** Documented and tested rather than done for symmetry.
3. **A separate, versioned store**, evolving the shortlist that was already separate.
4. **Carried-over places stay unclaimed** rather than being attributed to anybody.
5. **The heart is per-person; the shortlist is shared** — two derived lists, one stored truth.
6. **The marker is silent by default**, computed from the reader's point of view.
7. **The roster is a list capped at two** in the parser, so the cap can rise without a migration.
8. **Block 4's mutual-exclusion assumption stays unrefactored**, because it still holds.

## Decisions discarded, and why

| discarded | why |
|---|---|
| Per-person route / days / dates | Two plans, not one trip. Makes every downstream question ambiguous. |
| Per-person accommodation or zone | Two adults sleep in the same place; Block 4's model is correct as shared. |
| Bumping the draft to V9 | Nothing in it is personal; a migration for no change in meaning. |
| Attributing legacy saves to Persona 1, or to both | Fabricates one opinion, or two, about real people. |
| Deleting `nihon.savedPlaceIds` after migration | Adds a data-loss path for no benefit; it is already inert. |
| A compatibility score / % agreement | Forbidden by the brief and by the project's own discipline: a count is a fact about the list, a percentage is a judgement about the relationship. |
| Sorting or filtering the catalogue by preferences | Turns browsing into triage and hides places behind an opaque rule. |
| Per-card person picker, or both names on every card | The exact UI the brief rules out; solved by the active-traveller concept. |
| A blocking setup screen | The roster is created with neutral defaults so the first tap has somewhere to land. |
| A third traveller | The trip is for two; the cap is in the parser so it cannot drift. |

## Remaining technical debt

| | |
|---|---|
| `useZonePlanChoice` still relies on the comparison and the planner being mutually exclusive | Re-examined this block and deliberately left alone, per instruction: Block 5 writes a different key and never touches the draft, so the assumption holds. If a future block renders both at once, lift `usePlanningDraft` to `App`. |
| Two travellers share one browser profile | By design (option A). There is no per-person device separation, so anyone with the browser can act as either person. Stated in the manager's copy. |
| `activeTravellerId` is stored in the shared document | It is a device fact, not a trip decision. Harmless today; a real multi-device build would move it to device-local storage. |
| No history of who changed what | Stances are last-write-wins per person, with no audit trail. Fine locally; a sync layer would need one. |
| `RC-05` | Single JS chunk above Vite's advisory. Pre-existing, untouched. |
| Editorial zone ratings still have no second reader | Inherited from Block 3. Now actionable: both travellers exist and could review them. |

---

## ¿BLOQUE 5 CERRADO? **SÍ**

All twelve required cases are covered by tests, and the ones that are observable are also covered
by the browser audit:

| | case | covered |
|---|---|---|
| A | P1 saves a place | unit + browser |
| B | P2 later saves the same place | unit + browser |
| C | both interested | unit + browser |
| D | only one interested | unit + browser |
| E | explicit "not interested" | unit + browser |
| F | a one-person place still reaches the planner | unit + browser |
| G | one day holds places preferred by different people | unit + browser |
| H | a shared accommodation decision changes | Block 4's audit, unchanged and green |
| I | a profile is reset or removed | unit + browser |
| J | an old draft without this layer | unit + browser |
| K | invalid data, orphan references, old schema | unit + browser |
| L | reload preserves all valid state | unit + browser |

---

## Recommendation for Block 6

**Make the shared list answer the question the two of them now actually have.** Block 5 has just
created a new, real state — *we disagree about this place* — and the app currently only reports it
one row at a time. The obvious, bounded next step is a **"dónde no coincidimos" view** inside the
existing saved list: the places with a split, and the places only one person wants, gathered so the
two of them can talk about them and decide. No new storage, no new concepts, no scoring — a filter
and a heading over data that already exists.

**Second choice, equally safe:** upgrade the zone `facts` provenance from encyclopaedia station
articles to operator pages. Bounded, strengthens the one part of the zone layer that claims to be
verifiable, and needs no product decision. This was Block 4's fallback recommendation and it is
still unclaimed.

**Explicitly NOT recommended now:**

- **The backend / two-device layer.** It remains a separate product decision, and nothing in Block
  5 forces it. If it is ever taken, the model is ready: `travellers` is a list, stances are keyed
  by id, and only `activeTravellerId` would want moving to device-local storage.
- **Any scoring, matching or recommendation feature** built on the preference data. The layer was
  deliberately built so one cannot be added without deleting tests that exist to forbid it.
- More photography (both Block 2 STOP criteria still hold), more zones (the 4–7 rule), travel-time
  estimation without a routing-provider decision.
