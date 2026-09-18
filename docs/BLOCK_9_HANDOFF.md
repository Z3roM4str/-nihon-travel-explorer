# Block 9 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/brave-wozniak-f79ie3` |
| Started from | `143d91299d74652831f38fc1c0beb63386396884` (Block 8 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. No new branch. |
| Working tree | Clean. |
| Block 9 status | **Closed.** |

## Authority situation

The recommendation in `docs/BLOCK_8_HANDOFF.md`, traced to the debt Block 3 recorded. No other
document assigned Block 9.

**An authority conflict was found and resolved from the repository, not by preference.** Block 8's
wording — *"let the two travellers review the editorial zone ratings"* — read as a feature storing a
rating per traveller, contradicts Block 5's rule, which `lib/travellers.ts` states in code: the
chosen zones are shared decisions, and *exactly one thing is personal: does this person want to go
here*. Nothing in Blocks 6, 7 or 8 supersedes it, so Block 5 remains authority and **no per-person
rating was built**.

Block 3's own text is what the debt actually asks for: *"Sixteen zones × ten axes were authored in
one pass … but they have had no second reader."* An authoring-process debt, not a product feature.

**Preflight discrepancy, unchanged since Block 6 and again left alone:** local `main` is stale at
`b924f5c`; `origin/main` is `1a11fe8`. `main` was not to be modified and the stale ref is local only.

## Commits

1. `b593fed` `feat(zones): say who decides an editorial rating, and make it reviewable`
2. `docs(block-9): design record, roadmap entry and handoff` — the head commit. It cannot carry its
   own hash; `git log -1 claude/brave-wozniak-f79ie3` is the authority.

## Final definition of "editorial rating"

> **A zone editorial rating is Nihon's own judgement about a neighbourhood, on a closed 1–5 ordinal
> scale, authored with the dataset and shipped with it.**

Ten axes per zone, grouped *carácter* and *conveniencia*. Two of them — `tourismIntensity` and
`nightlife` — have no good direction. There is no composite, and there must never be one.

## Who controls it

**Nihon, and only Nihon, by shipping different data.** There is no editor, no traveller-facing
write path and no per-person rating. Asserted in the negative by test: no `with…Editorial`
transition exists in the module, no `input`/`select`/`button`/`contenteditable` exists inside the
ratings surface, and the new module touches no storage.

## Final definition of "review"

**To scrutinise, not to edit.** A rating is reviewable when a reader can see who decided it, which
direction its marks run, whether the axis has a good direction at all, and what the zone costs in
return — and can then judge it. Block 3 asked for a *second reader*; this block made the ratings
legible enough for one, and left the judging to the humans.

## Relation to want-to-go

| | editorial rating | want-to-go |
|---|---|---|
| what it says | what the neighbourhood is like | what one person feels about it |
| owner | Nihon | that traveller |
| scope | shared, one per zone | personal, one per person per place |
| editable by a traveller | **no** | yes, it is theirs |
| provenance | none, and forbidden | none; it is not a claim |

They may disagree freely and neither corrects the other. Both directions are proven in the browser:
switching reader changes no rating, and pressing the heart changes the personal document while the
ratings stay byte-identical.

## Model before vs after

**No schema change to the data.** `ZoneEditorial` is the same ten-axis record; `AccommodationZone`
is unchanged.

What changed is that the contract moved from prose into code:

```ts
// new — lib/zone-editorial-presentation.ts
EDITORIAL_OWNER = "Nihon"
ratingAccessibleText(value)   // "3 de 5 · criterio de Nihon"   (was the bare "3 de 5")
axisDirectionHint(high)       // "Más marcas = …"
axisHasNoGoodDirection(key)   // NEUTRAL_AXES, as a predicate
NEUTRAL_AXIS_NOTE             // "ni bueno ni malo"
editorialDisclosure()         // the one sentence saying what a rating is and is not
```

Both editorial surfaces now read those strings from one module. The two defects below arose
precisely because they did not.

## Data changes

**None.** The 160 values were audited in full: every one an integer 1–5, exactly the ten declared
axes in every zone, no composite field, no provenance leak, three written drawbacks per zone.

Internally sound, with no contradiction to correct — and no second reader available in this session.
Rewriting the judgements here would be a **third unreviewed pass by one author**, which is strictly
worse than leaving them and saying so. **The "no second reader" debt therefore stays open**, and
correctly: only the two actual travellers can close it.

## Visible changes

| before | after |
|---|---|
| screen reader: `"3 de 5"` | `"3 de 5 · criterio de Nihon"` |
| full list: no direction on any axis | `Más marcas = <direction>` on all ten |
| full list: neutrality in a muted colour only | `· ni bueno ni malo` in words |
| `Ver las diez valoraciones completas` | …with the `criterio` tag, like every other editorial heading |
| nothing said what a rating is | one sentence inside the disclosure |

> Estas diez valoraciones son el criterio de Nihon, no datos verificables ni la opinión de ninguno
> de los dos: describen cómo es la zona, no si queréis ir. No se pueden editar.

The full ratings stay behind the **closed** `<details>` Block 3 put them behind — its audit asserts
that, and the everyday comparison gains nothing.

## Persistence

**Explicitly none added.** No storage key, no document, no field. Reading a rating writes nothing.
Proven by the audit, which compares the full `nihon.*` key set across the flow, and by test, which
forbids `localStorage` in the new module.

## Tests added

| file | tests |
|---|---|
| `app/src/lib/zone-editorial-governance.test.ts` | 26 |
| `app/src/components/ZoneSources.test.ts` (Block 9 section) | +10 |
| **Vitest total** | **+36** |
| `app/scripts/block9-editorial-governance-browser-audit.mjs` | 51 per viewport × 3 = **153** |

They assert the contract, including its negative half: that no write path exists, that the zone
layer never mentions a stance and the travellers layer never mentions editorial, that ordering reads
no rating, that no composite exists, and that the copy passes no judgement it cannot support.

## Validators added

`scripts/validate-accommodation-zones.py` now also refuses:

- **a composite score**, at zone level or among the axes — `score`, `overall`, `total`, `rating`,
  `average`, `puntuación`, `nota`, `stars` — because axes without a good direction cannot be
  totalled;
- **per-traveller data** anywhere in a zone — `travellerId`, `travellers`, `stance(s)`,
  `perTraveller`, `personal`, `vote(s)`, `myRating`, `userRating`, `interest`.

**Twelve negative cases were run by hand against the real dataset; it rejects all twelve.** Four are
caught by Block 3's pre-existing unknown-axis rule rather than the new lists — the new rules add the
zone-level coverage that rule cannot see, plus a clearer message.

## Baseline vs final

| check | baseline | result |
|---|---|---|
| Vitest | 3000 / 87 files | **3036 passed**, 0 failed, **88 files** |
| oxlint | clean | clean |
| `tsc --noEmit -p tsconfig.app.json` | clean | clean |
| `vite build` | OK | OK |
| Python suites | 13 | **13 of 13 pass** |
| Validators | 8 | **8 of 8 argument-free pass** |
| Block 1 UX audit | 142 | **142/142**, unmodified |
| Block 2 photography audit | 69 | **69/69**, unmodified |
| Block 3 zone audit | 105 | **105/105**, unmodified |
| Block 4 zone → planner audit | 261 | **261/261**, unmodified |
| Block 5 two-traveller audit | 225 | **225/225**, unmodified |
| Block 6 divergence audit | 216 | **216/216**, unmodified |
| Block 7 zone-provenance audit | 129 | **129/129**, unmodified |
| Block 8 airport-link audit | 114 | **114/114**, unmodified |
| **Block 9 editorial-governance audit** | — | **153/153** (51 per viewport × 3) |
| `git diff --check` | clean | clean |

The baseline was measured on this branch at `143d912` **before any edit** and matched the Block 8
handoff exactly.

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
          node scripts/block7-zone-provenance-browser-audit.mjs
          node scripts/block8-airport-link-browser-audit.mjs
          node scripts/block9-editorial-governance-browser-audit.mjs
```

Add `--browser=/opt/pw-browsers/chromium`. Do **not** run `playwright install`.

## Browser audit, per viewport

`block9-editorial-governance-browser-audit.mjs` — 51 checks each at **390×844 DPR 2**,
**820×1180 DPR 2** and **1440×900**, 153 total, all passing.

It compares Shinjuku and Asakusa and checks: the panel tags its three kinds of statement
(*verificables* / *criterio* / *calculado*) → the full ten ratings stay behind a disclosure that
**starts closed** and is itself tagged *criterio*, at the 44px tap floor → the summary is reachable
by tabbing, draws a visible ring, and **the keyboard alone opens it** → the disclosure names Nihon,
says the ratings are not verifiable data, says they describe the zone rather than whether they want
to go, and says outright that they cannot be edited → all ten axes carry a direction hint, and the
two with no good direction say *ni bueno ni malo* **in words** → every ordinal's accessible reading
says *criterio de Nihon* and **none is the bare "N de 5"** → no percentage, score, "x/10", "la
mejor" or instruction to choose → the ratings surface offers **zero** controls → no page overflow,
nothing widens its container, nothing clipped, the summary wraps, and the disclosure animates
nothing → reading the ratings writes no planning decision, nothing personal and no storage key →
**the panel is a modal, so the traveller bar is genuinely unreachable while it is open**; closing it
and switching reader shows **identical** ratings and an identical disclosure → and pressing the
heart changes the personal document and the reader's own interest while the ratings come back
**byte-identical**, still with no way to change one.

## Regressions found

**None.** All eight historical audits pass at their exact baseline counts, and none was modified —
verified by name and by content.

No historical Vitest test needed updating this block.

## False positives of the new audit

**One**, in `block9-editorial-governance-browser-audit.mjs` itself, found and fixed before the
commit. Not a product defect.

- **Focus ring.** The check focused the disclosure summary programmatically and found no ring.
  `:focus-visible` is what draws it and Chromium matches that only for keyboard focus — the same
  trap Block 7 hit. The audit now tabs to the summary (bounded search) and asserts both that
  tabbing reaches it and that the ring is drawn, which is a stronger check than the original.

A second, non-defect discovery reshaped a test rather than the product: **the zone panel is a modal
dialog**, so the traveller bar cannot be clicked while the ratings are on screen. The intended
"switch reader while reading the ratings" check is impossible by construction — which is itself the
separation working — so the audit now closes the panel, switches, and reopens.

## Remaining technical debt

| | |
|---|---|
| **Editorial ratings still have no second reader** | Unchanged, and deliberately. Block 9 made them legible enough to review; only the two actual travellers can close it. A future block could record the outcome of that human review as a data change — with the reviewers named in the commit, not in the schema. |
| Ikebukuro's Narita coach is no longer recorded | Inherited from Block 8; unverifiable from this environment. |
| `railLines` and `shinkansen` remain encyclopedia-sourced | Inherited from Block 7; the operators refuse automated requests. |
| `consultedAt` has no staleness policy | Inherited from Block 7. |
| Four zones inline the same Narita source record | Inherited from Block 7. |
| `tradeoffs` are free text with no per-axis link | Deliberate: they explain the zone, not one axis, and linking them would invent a methodology. |
| `.icon-button--small` is a 36px control in the saved list | Pre-existing and explicitly allowed since Block 1. |
| `useZonePlanChoice` relies on comparison and planner being mutually exclusive | Re-examined again; Block 9 adds no writer and no reader of the draft. |
| `RC-05` | Single JS chunk above Vite's 500 kB advisory. Pre-existing, untouched. |

---

## ¿BLOQUE 9 CERRADO? **SÍ**

An editorial rating is defined; its owner is named and enforced; "review" is defined as scrutiny and
the surfaces now support it; Block 5's personal-data rule is preserved intact and asserted in both
directions; facts, derived, editorial and preference remain separate; no redundant personal scoring
was introduced; no data was changed and the reason is recorded; no persistence was added; tests
prove the contract including its negative half; the validator rejects twelve kinds of invalid state;
all historical gates are green and unmodified; Block 9's audit is green at three viewports; the tree
is clean, the branch is pushed, `main` is untouched, and there is no merge and no pull request.

---

## Recommendation for Block 10

**A staleness policy for `consultedAt`.** Every factual source in the zone layer now carries a
consultation date — Block 7 made that universal and Block 8 added one more — and nothing anywhere
says when a citation has aged. It is the last unclaimed thread in the zone layer's factual half, it
is bounded, and it needs exactly one product decision (the threshold) which a validator rule and a
quiet UI note can then enforce. It also composes well with what Blocks 7–9 established: a fact
carries provenance and can go stale; a rating carries none and cannot.

**Second choice:** record the outcome of the human review Block 9 unblocked. If the two travellers
read the ten axes and disagree with some, a small block can apply those corrections as a data change
with the reviewers named in the commit message — closing a debt open since Block 3 — while keeping
the schema exactly as it is. This needs the humans first, so it cannot be started unilaterally.

**Explicitly NOT recommended now:**

- **Any per-traveller rating, vote, star or "mi nota".** Block 5's rule stands, Block 9 has now
  documented and test-protected it, and the validator rejects the data shapes.
- **A composite or overall zone score.** Two axes have no good direction; the validator now refuses
  one outright.
- **Re-sourcing `railLines`/`shinkansen`, or restoring Ikebukuro's Narita coach, from this
  environment.** The pages refuse automated requests.
- **The backend / two-device layer**, more photography (both Block 2 STOP criteria hold), more zones
  (the 4–7 rule), travel-time estimation without a routing-provider decision.
