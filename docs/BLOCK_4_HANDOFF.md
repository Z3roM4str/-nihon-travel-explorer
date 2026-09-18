# Block 4 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/brave-wozniak-f79ie3` |
| Started from | `f8f3eb9e752636748d396b11d8447398c853deaa` (Block 3 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. No new branch. |
| Working tree | Clean. |
| Block 4 status | **Closed.** |

## Commits

1. `fa42521` `feat(zones): a chosen zone becomes a real input to the planner`
2. `docs(block-4): design record, roadmap entry and handoff` — the head commit. It cannot carry
   its own hash; `git log -1 claude/brave-wozniak-f79ie3` is the authority.

## Files

**New**

| File | What it is |
|---|---|
| `app/src/lib/zone-accommodation-choice.ts` | The persisted record: shape, parser, uniqueness, pruning. **Registry-free** by design. |
| `app/src/lib/planning-draft-v8.ts` | V8 = V7 + one field, same storage key. The zone-choice operations and the in-use predicate. |
| `app/src/lib/zone-plan-link.ts` | The derivation: which hub a day is in, which anchor each boundary uses, straight-line proximity. Never a minute. |
| `app/src/useZonePlanChoice.ts` | The comparison panel's write access to the one draft. Holds no authoritative state. |
| `app/src/components/ZonePlanSection.tsx` | The planner's zone surface, at two densities (`summary` / `full`). |
| `app/src/lib/zone-accommodation-choice.test.ts` | 23 tests — the record. |
| `app/src/lib/planning-draft-v8.test.ts` | 53 tests — persistence, transitions, reconciliation, multi-hub. |
| `app/src/lib/zone-plan-link.test.ts` | 26 tests — hub agreement, boundary use, derived bands. |
| `app/src/components/ZonePlanSection.test.ts` | 33 tests — the UI/wiring contract across five files. |
| `app/scripts/block4-zone-planner-browser-audit.mjs` | 87-check real-viewport audit against the production build. |
| `docs/BLOCK_4_DESIGN.md` | The design record. |

**Modified:** `app/src/usePlanningDraft.ts` (V8, three new members), `app/src/App.tsx` (mutual
exclusion), `app/src/components/ZoneComparison.tsx` (the CTA, the status banner, the hand-off to
the planner), `app/src/components/OrderedSequenceBuilder.tsx` (the section, the derived memos, the
seeded-anchor marking), `app/src/App.css`, `app/src/components/OrderedSequenceBuilder.test.ts` and
`app/src/lib/planning-draft-v7.test.ts` (the two gate corrections below), `docs/ROADMAP.md`.

## The state model chosen

**A chosen zone is not a new entity.** It is one record saying where an existing
`AccommodationAnchor` came from:

```
ZoneAccommodationChoice ──hub──────────▶ one hub, at most one choice
         │
         ├──zoneId──────────▶ zones.json  (resolved one layer up, never in the draft module)
         └──accommodationId─▶ an AccommodationAnchor IN THE SAME DRAFT
```

The anchor is the single truth about *where*; the choice is the single truth about *why that
anchor exists*. No second copy of the label, no second copy of the coordinate, no second store.

### How the selection is represented

`ManualPlanningDraftV8` adds exactly one field to V7 — `zoneAccommodationChoices` — under the same
`nihon.manualPlanningDraft` key. `migrateV7ToV8` adds `[]` and attributes no existing anchor to a
zone. Every inherited operation runs against a `v7View` that structurally cannot see the new
field; `withoutAccommodation`, `reconcileDraft` and `resetRoute` are the three explicit exceptions,
because they are the only operations that must keep both halves consistent.

### Zone ↔ accommodation anchor

Choosing copies the zone's registry `anchor.label` and `anchor.lat/lng` into
`withNewAccommodation`. The result is an **ordinary anchor**: offered to every day's boundary,
bound to no hub, carrying no priority, and needing the reader's own typed minutes exactly as a
hand-made anchor does. Its id is opaque and says nothing about the zone.

### Behaviour with an existing manual anchor

Nothing happens to it. Both coexist, both appear in every boundary select, and the seeded one is
labelled *"de la zona elegida en {hub}"*. No boundary is ever rebound. If a day is planned from
the hand-made anchor while a zone is chosen, the zone section reports that as a neutral fact — not
a warning, not an error — because the reader has done nothing wrong.

### Behaviour on change and deletion

| case | anchor | manual state |
|---|---|---|
| change zone, old anchor untouched | removed | none existed |
| change zone, old anchor has a boundary or a typed duration | **kept** as an ordinary anchor | fully preserved |
| remove the zone choice | same rule, symmetric | fully preserved |
| delete the seeded anchor directly in the manager | removed | inherited behaviour: its legs go, its boundaries become `unselected`, never another anchor — **and the zone choice goes with it** |

"Carries user work" means exactly two things: a day boundary selects the anchor, or a manual
duration was typed for it. The UI knows which branch will happen before the reader presses, and
says so.

**Re-pointing an old anchor at a new zone's coordinate was rejected outright** — it would silently
reattribute durations typed for a different station.

### Persistence and compatibility with previous data

Same single key. A V1–V7 payload loads through the existing migration chain and is migrated once.
Malformed input still **fails closed**: `parseStoredDraft` returns `null` and the app falls back to
a fresh draft, never a repaired one. Parse rejects — never repairs — two choices for one hub, two
choices on one anchor, a malformed entry, and a choice referencing an anchor the draft does not
contain.

### Multi-hub

One choice per hub, each with its own anchor. A day is attached to a zone only when **every**
resolvable place in it agrees on the hub; a day spanning two hubs is reported with the reason
visible and no zone attached. That is what structurally prevents one hub's zone from presenting
itself as another hub's accommodation. Inter-hub segments, accommodation legs, day reordering and
whole-trip composition are all untouched by the choice.

## UX

**Desktop / tablet / mobile** — one layout, verified at all three viewports rather than assumed.

- CTA on every zone in both the list and the side-by-side: *"Usar esta zona en el plan"*, or
  *"Cambiar a esta zona"* when another is chosen.
- A `role="status"` banner names the chosen zone and the accommodation the planner gained, and
  states that nothing was booked and no time was calculated. It also warns when removing the zone
  will keep the anchor.
- *"Abrir el planificador"* hands the reader straight on; the panel closes and the planner opens.
  No new modal.
- The planner's route view shows a compact summary, so the decision is acknowledged the moment the
  reader arrives. The full per-day detail sits in the day-assignment view, beside the boundaries it
  describes.
- The accommodation manager marks seeded anchors and warns, visibly and in the accessible name,
  that deleting one drops the zone choice too.

### Accessibility

Semantic `<button>` throughout, no clickable `div`/`span`. Every control names its zone or hub, and
the banner's remove control was given a **distinct** accessible name from the per-zone one after
the audit caught them colliding. Live `role="status"` for the choice. Keyboard focusable, focus
styling resolves, Escape still closes the panel. 44px tap floor held — the audit measures it, and
Block 1's regression net is unchanged and still green.

## Gates executed

| check | result |
|---|---|
| Vitest | **2720 passed**, 0 failed, 78 files (baseline was 2583 / 74) |
| oxlint | clean |
| `tsc --noEmit -p tsconfig.app.json` | clean |
| `vite build` | OK |
| **Python suites** | **13 of 13 pass** |
| **Validators** | **8 of 8 argument-free validators pass** |
| Block 1 UX audit | **142/142** |
| Block 2 photography audit | **69/69** |
| Block 3 zone audit | **105/105** |
| **Block 4 zone → planner audit** | **261/261** (87 per viewport × 3) |
| `git diff --check` | clean |

**Exact numbers asked for:**

- **Python suites: 13.** All of `scripts/test_*.py`, all passing.
  `scripts/test_photography_rendition.py` needs `Pillow` (`pip install -r scripts/requirements.txt`)
  — it fails to *import* without it on a fresh container, which is an environment gap, not a code
  failure. Installed and run; it passes 25 tests.
- **Validators: 8, not 7.** `scripts/validate-*.py` contains ten files. Eight run argument-free and
  are the gate: access-points, accommodation-zones, dataset, geography, logistics, photography,
  reservation-mechanisms, walking-access-point-results. The other two —
  `validate-walking-pilot.py` and `validate-walking-scale.py` — are acquisition pipelines that
  **refuse to run without an explicit mode flag** (`--dry-run` / `--execute` / …) and are not
  argument-free gates. Block 3's handoff said "7"; the argument-free count is 8, and that is the
  number a future block should run.
- **Tests: 2720 Vitest** (+137 over the Block 3 baseline of 2583) **plus 261 browser checks** in
  the Block 4 audit.

### The gate list a future block must run

```
cd app && npm test && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run build
pip install -r scripts/requirements.txt          # Pillow, for test_photography_rendition.py
for t in scripts/test_*.py; do python3 "$t"; done                 # 13, all must pass
for v in scripts/validate-*.py; do python3 "$v"; done             # 8 argument-free; the two
                                                                  # walking pipelines need a mode
                                                                  # flag and are not gates
cd app && node scripts/block1-ux-browser-audit.mjs
          node scripts/block2-photography-browser-audit.mjs
          node scripts/block3-zones-browser-audit.mjs
          node scripts/block4-zone-planner-browser-audit.mjs
```

On a container whose Chromium does not match the pinned Playwright build, pass
`--browser=/opt/pw-browsers/chromium` to each audit. Do **not** run `playwright install`.

## Browser audit

`block4-zone-planner-browser-audit.mjs` runs against the **production build via `vite preview`**,
not the dev server, at 390×844 DPR 2, 820×1180 DPR 2 and 1440×900. It drives the real flow end to
end: enter → save four places across two hubs → compare → choose → open the planner → find the
seeded anchor → distribute into two days → move the Kioto places into day 2 → choose the boundary →
observe that the minutes field is still empty and the leg reads *sin registrar* → type 25 → confirm
the inter-hub add button is **disabled** until mode and minutes are supplied → register a segment →
reload → verify everything survived → change the zone → verify the old anchor was kept **because**
a duration was typed for it, and that the duration was neither destroyed nor reattributed → remove
the zone → verify no orphan choice, that the untouched anchor went and the used one stayed, and
that the empty state is back in both planner views.

It also asserts, at every viewport: no horizontal overflow, the 44px tap floor, a labelled region,
no clickable non-button, every button accessibly named, keyboard focusability, no page errors and
no console errors — and that **no minute figure appears anywhere in the zone surface**.

## Performance

No new dependency. V8 adds one array to a payload that is already small. The derivation is two
`useMemo`s over the existing day entities, and its arithmetic is the same great-circle formula
Block 3 already ships. Production bundle stays one JS chunk above Vite's 500 kB advisory —
`RC-05`, pre-existing and untouched; the Block 4 code adds roughly 8 kB of it.

## Two gate corrections, recorded not hidden

1. **`ORS` was unanchored** in the Phase 3D-Q forbidden-claim scan. Case-insensitively it matched
   the "ors" inside ordinary English words such as `anchors`, so the gate fired on prose that said
   nothing about a routing provider. Now `\bORS\b`, with a test proving it still catches
   `"duración según ORS"` and no longer catches `anchors`. The gate's intent is unchanged.
2. **Vocabulary scans now exclude disclaimers before scanning.** Block 4's copy says *"no dice que
   un día sea mejor que otro"* and *"no ha calculado ni un minuto"*. A blunt keyword scan flags the
   very sentences that deny the claim. The disclaimers are now asserted **positively** and then
   removed before the scan, so the assertion means what it says.

Neither weakens a gate; both remove a false positive that would have misled the next contributor.

## Risks and remaining debt

| | |
|---|---|
| Straight-line distance is still a weak proxy in Tokyo | Inherited from Block 3 and unchanged. The bands and the wording mitigate it; only real routing removes it, and that still needs a provider decision the project has repeatedly deferred. |
| The zone section's per-day detail lives in the day-assignment view | The route view gets a summary, which the audit verifies. A reader who never distributes into days sees the summary only — correct, since the per-day claims need days to exist. |
| `useZonePlanChoice` relies on the two surfaces being mutually exclusive | Now structural in `App.tsx` and asserted in tests, but it is a *convention enforced in one place*. If a future block renders both at once, it must lift `usePlanningDraft` to `App` instead. Flagged deliberately. |
| A choice whose zone leaves the registry | Handled honestly (*"zona ya no disponible"*, decision preserved, removable) but untested in production because no zone has ever been removed. Unit-tested. |
| `RC-05` | Single JS chunk above Vite's advisory. Pre-existing, untouched. |
| Editorial ratings still have no second reader | Inherited from Block 3. Unchanged. |

## Decisions deliberately not taken

- **How the two-person layer works.** Block 4 had no authorisation to choose between (A) two local
  profiles in one browser and (B) two real people on two devices, which probably requires a backend
  and sync. It did not choose, and nothing in this block presumes either.
- **No travel time between a zone and anything.** Not estimated, not widened, not converted from
  distance. The manual-entry contract is intact.
- **No automatic boundary assignment.** A zone never picks which day starts or ends at it.
- **No composite score and no "best zone".** Block 3's structural refusal is preserved; nothing in
  Block 4 could be made to rank zones without removing a validator rule and a test.
- **No generic migration framework.** V8 is one field, on the established pattern.

---

## ¿BLOQUE 4 CERRADO? **SÍ**

Against the ten stop criteria:

1. a zone can be chosen explicitly — **yes**, per hub, from two places in the comparison;
2. the choice feeds the planner correctly — **yes**, as an ordinary accommodation anchor;
3. no times or routes are invented — **yes**, no minute is derived anywhere in the block;
4. it works with multiple hubs — **yes**, one choice per hub, and a multi-hub day gets none;
5. changing and removing are safe — **yes**, manual state is never destroyed silently;
6. it persists correctly — **yes**, V8 under the same key, fail-closed on malformed input;
7. planner and whole-trip stay coherent — **yes**, both untouched by the choice and both green;
8. the three viewports pass — **yes**, 261/261;
9. all full gates are green — **yes**, every row in the table above;
10. documentation and handoff complete — **yes**, this file and `BLOCK_4_DESIGN.md`.

---

## Recommendation for Block 5

**Open with the product decision, not with code.** The two-person layer is the one thing Blocks 2,
3 and 4 have each deferred, and it is now the blocking question: Block 1 shaped "❤️ Quiero ir" for
one browser, Block 3 gave two people something substantive to disagree about, and Block 4 has just
made one of those disagreements — *where do we sleep* — a stateful decision with consequences.
Every further feature compounds the cost of answering it late.

The decision is binary and the next block must not start until it is made:

- **(A) Two local profiles in one browser.** No backend, no accounts, no sync. The draft grows a
  profile dimension and the UI gains a switcher. Cheap, shippable, and honest about being a single
  shared device — which may be exactly right for two people planning one trip together on a sofa.
- **(B) Two real people, each on their own device.** This almost certainly requires a backend,
  identity and conflict resolution, and it would be the first time Nihon stores anything outside
  the browser. It is a different project's worth of architecture, and it would reopen decisions
  this repository has kept closed since Phase 3D-P.

**My recommendation: (A), explicitly framed as a local-only feature, and say so in the UI.** It
answers the real use case at a fraction of the cost, and it does not foreclose (B) — a profile
dimension in the draft is exactly what (B) would need to sync later.

**If neither is chosen, the best available Block 5 is smaller and entirely safe:** upgrade the zone
`facts` provenance from encyclopaedia station articles to operator pages. It is bounded, it
strengthens the one part of the zone layer that claims to be verifiable, and it needs no product
decision at all.

**Not recommended:** more photography (both Block 2 STOP criteria still hold), more zones (the 4–7
rule exists to prevent drift), any form of travel-time estimation without a routing-provider
decision, or a composite zone score.
