# Block 8 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/brave-wozniak-f79ie3` |
| Started from | `f09047aaf6b324ddb85f59eb5b1205e5d7bc4a6b` (Block 7 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. No new branch. |
| Working tree | Clean. |
| Block 8 status | **Closed.** |

## Authority situation

The recommendation left in `docs/BLOCK_7_HANDOFF.md`. The roadmap assigned Block 8 to nothing else
and no document contradicted it. No authority conflict was found.

**Preflight discrepancy, unchanged since Block 6 and again left alone:** the local `main` ref is
stale at `b924f5c`. `origin/main` is `1a11fe8`, matching the brief. `main` was not to be modified
and the stale ref is local only.

## Commits

1. `0c6f09c` `feat(zones): say what "directo" means, and give each service its own answer`
2. `docs(block-8): design record, roadmap entry and handoff` — the head commit. It cannot carry its
   own hash; `git log -1 claude/brave-wozniak-f79ie3` is the authority.

## The FINAL definition of `directFromZone`

> **`directFromZone` is true when the service named in this record carries the traveller between
> this zone and this airport with no change.**

- It is a claim about **one service**, not about the airport. "Can I reach Haneda without
  changing?" is a zone-level question that may have more than one answer, and this field is not it.
- It is **mode-agnostic**. A coach that runs with no change is direct exactly as a train is.
- Therefore **one record holds one service**. A zone offering both a direct coach and a rail route
  with a change carries two records.

## How it was determined — the semantic audit

`directFromZone` feeds exactly two things: a CSS emphasis class and one word of copy. No filter, no
calculation, no ranking and no sort reads it, so its meaning had to be recovered from the records.

| interpretation | verdict |
|---|---|
| **A.** any direct service exists between airport and zone | **No.** Cannot explain why three records are `false`. |
| **B.** direct *rail* exists | **No — refuted by one record.** `ZN-OSA-UMEDA → Itami (ITM)` is `"Autobús limusina"`, marked `true` since Block 3. |
| **C.** the service named in *this* record needs no change | **Yes — 23 of 23.** |
| **D.** something else demonstrable in the data | Nothing else fits. |

Mechanical check: `directFromZone === !service.matches(/\bvía\b/)` held for **all 23 records**, with
no exception in either direction.

### The case matrix the brief asked for

| case | before | after | why |
|---|---|---|---|
| Haneda ↔ Shinjuku | one record, `false` | coach `true` + rail `false` | the record bundled both |
| Haneda ↔ Ikebukuro | one record, `false` | coach `true` + rail `false` | the record bundled both |
| Narita ↔ Shinjuku | N'EX, `true` | unchanged | one direct service, correct |
| Narita ↔ Ueno | Skyliner, `true` | unchanged | one direct service, correct |
| Kansai ↔ Namba | Rapi:t, `true` | unchanged | one direct service, correct |
| Kansai ↔ Gion (rail with a change) | `Vía Estación de Kioto`, `false` | unchanged | `false` is correct |
| Kansai ↔ Osaka Bay (two changes) | `Vía Nishikujō y Ōsaka Station`, `false` | unchanged | `false` is correct |
| Haneda/Narita ↔ Asakusa (through-service) | `true` | unchanged | no change of train, so direct |
| Itami ↔ Umeda (coach) | `Autobús limusina`, `true` | unchanged | the record that defines the contract |

## Model before vs after

```ts
// before
type ZoneAirportLink = { airport: string; service: string; directFromZone: boolean };

// after
type ZoneAirportLinkMode = "rail" | "bus";
type ZoneAirportLink = {
  airport: string; service: string; directFromZone: boolean;
  mode: ZoneAirportLinkMode;      // NEW, required
};
```

`directFromZone` **stays a boolean**: the question it asks — does this service need a change — is
genuinely binary, and nothing in the dataset needs a third answer.

`mode` was added only after clearing the bar this block set itself — **two real cases the old model
could not represent**:

1. `ZN-OSA-UMEDA → Itami` is a direct **coach** rendered with the identical word as a direct
   **train**. Both are direct; they are not the same journey.
2. Splitting a bundled record requires saying which half is the coach. Free text is readable but
   not checkable.

## Records audited and modified

**23 airport links audited across all 16 zones; 25 after the split.** Every record not listed below
is unchanged except for gaining its `mode`.

| zone | before | after |
|---|---|---|
| `ZN-TOK-SHINJUKU` | `Autobús limusina / vía Shinagawa` · false | `Autobús limusina a Shinjuku Station West Exit` · **true** · bus<br>`Vía Shinagawa (Keikyū)` · false · rail |
| `ZN-TOK-IKEBUKURO` | `Autobús limusina / vía Shinagawa` · false | `Autobús limusina a Ikebukuro Station West Exit` · **true** · bus<br>`Vía Shinagawa (Keikyū)` · false · rail |
| `ZN-TOK-IKEBUKURO` | `Autobús limusina / vía Nippori (Skyliner)` · false | `Vía Nippori (Skyliner)` · false · rail — **coach dropped** |

Mode assignment: 3 records `bus` (the two new Haneda coaches and Umeda → Itami), 22 `rail`.

## Evidence used

One new source, on the two zones whose coach claim it supports:

**`https://tokyo-haneda.com/en/access/bus/`** — Haneda Airport's own express-bus page, tier
`operator`, `covers: ["airportLinks"]`, consulted **2026-09-18**. It names **"Shinjuku Station West
Exit"** (≈35 min, Airport Transport Service and Tokyu Bus) and **"Ikebukuro Station West Exit"**
(≈55 min, Airport Transport Service and Kokusai Kogyo Bus).

Block 7's sources were reused unchanged where they already support a claim. Nothing else was
re-sourced — this block is not a second provenance migration.

## Data that stayed the same, and why

| what | why |
|---|---|
| All 20 other airport links' `directFromZone` | Each names one service and the boolean is correct for it under the contract. |
| Every `railLines` and `shinkansen` record | Out of scope, and their operators remain unreachable from here (Block 7). |
| Ikebukuro's Narita coach | **Unverifiable.** Five Narita bus URLs return `403`; the limousine operator's own site is a JavaScript app with no destinations in its HTML. Dropped rather than claimed. |
| Every zone rating, ranking and tradeoff | Out of scope. |
| Provenance for all other zones | Out of scope. |

## Copy changes

| before | after |
|---|---|
| `directo` | `tren directo` · `autobús directo` |
| `con enlace` | `tren con transbordo` · `autobús con transbordo` |

Plus a visually-hidden sentence per link: `"<airport>: <service>. En <tren|autobús>, sin
transbordos."` or `"… requiere al menos un transbordo."`

The green emphasis still keys off `directFromZone` and never off `mode`: directness is a fact, and a
direct coach is emphasised exactly like a direct train.

## Tests added

| file | tests |
|---|---|
| `app/src/lib/zone-airport-link.test.ts` | 25 |
| `app/src/components/ZoneSources.test.ts` (Block 8 section) | +5 |
| `app/src/lib/zone-provenance.test.ts` (new source-tier test) | +1 |
| **Vitest total** | **+31** |
| `app/scripts/block8-airport-link-browser-audit.mjs` | 38 per viewport × 3 = **114** |

The domain tests prove the **meaning**, not the current values: that a `vía` route is never direct,
that a coach can be direct, that Umeda → Itami is what rules out the "direct rail" reading, that a
zone may hold two answers for one airport, and that no record bundles a coach with a `vía` route.

## Validators added

`scripts/validate-accommodation-zones.py` now refuses:

- a missing or unknown `mode` (closed vocabulary `rail` | `bus`);
- a service naming a coach but recorded as `rail`, or `mode: "bus"` naming no coach;
- a service **routed via another point while claiming to be direct** — a real contradiction;
- the same **airport and service** twice in one zone.

The converse of the `vía` rule is deliberately not enforced: a rail service can be named anything,
so the absence of a word proves nothing.

**Ten negative cases were run by hand against the real dataset, including reintroducing the old
compound record marked direct. It rejects all ten.**

## Baseline vs final

| check | baseline | result |
|---|---|---|
| Vitest | 2969 / 86 files | **3000 passed**, 0 failed, **87 files** |
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
| Block 6 divergence audit | 216/216 | **216/216**, unmodified |
| Block 7 zone-provenance audit | 129/129 | **129/129**, unmodified |
| **Block 8 airport-link audit** | — | **114/114** (38 per viewport × 3) |
| `git diff --check` | clean | clean |

The baseline was measured on this branch at `f09047a` **before any edit** and matched the Block 7
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
```

Add `--browser=/opt/pw-browsers/chromium`. Do **not** run `playwright install`.

## Browser audit, per viewport

`block8-airport-link-browser-audit.mjs` runs against the production build via `vite preview` at
**390×844 DPR 2**, **820×1180 DPR 2** and **1440×900** — 38 checks each, 114 total, all passing.

It compares **Shinjuku and Ikebukuro** — the zones the block was opened by — and checks: no airport
fact says the bare word "directo" or the vague "con enlace" → every one names the mode *and* whether
a change is needed → a direct train, a direct coach and a route with a change are each described as
such → **train and coach are never rendered as the same thing** → a zone reached by a direct coach
*and* a rail change shows **both**, one direct and one not → each fact carries a spelled-out
sentence saying outright that direct means no change, naming the real service → no copy calls one
mode better, and no travel time is invented → the emphasis marks directness, so a direct coach is
emphasised exactly like a direct train → no page overflow, the fact row never widens its column,
nothing is clipped, ellipsised or overlapping → no control is nested inside a fact and the fact row
is not itself a control → Block 7's source links still have unique accessible names, still open in
a new tab with `rel=noreferrer`, still take focus, still let tab move on, and still write neither a
planning decision nor a storage key → and **Kioto**, a hub with no coach recorded, shows a direct
train and a train with a change and mentions no coach at all.

## Regressions found

**None.** All seven historical audits pass at their exact baseline counts and none was modified.

**Two Block 7 Vitest tests failed and were investigated as regressions first, as the brief
requires.** Both were snapshots of Block 7's exact scope, and Block 8 legitimately widens it:
adding Haneda's page as an operator source means Ikebukuro now also has an operator behind its
airport links, and `tokyo-haneda.com` joins the cited-host list. Neither test was weakened — both
still pin their set exactly — and a **new** test was added requiring every extra source to be tier
`operator` covering `airportLinks`, so the widening cannot happen unnoticed again.

## False positives of the new audit

Two, both in `block8-airport-link-browser-audit.mjs` itself, found and fixed before the commit.
Neither was a product defect.

1. **Zone selection by card text.** Playwright's `hasText` is a substring match over the whole
   element, and several Kioto zone summaries contain the words "la estación de Kioto" — so
   selecting a card by name silently matched the wrong zone, leaving "Comparar" disabled. The audit
   now filters on the card's own `<h3>` with an anchored regex, and asserts the expected number of
   zones is actually selected before continuing.
2. **A zone named by its short name.** The Kioto zone is `Gion–Higashiyama`, not `Gion`; the
   anchored regex correctly refused to match. Fixed by using the real name.

## Remaining technical debt

| | |
|---|---|
| Ikebukuro's Narita coach is no longer recorded | It very likely exists; this environment cannot verify it. A session with different network egress could restore it in one line, with Narita's own bus page as the source. |
| `mode` has no `monorail` value | Correct for the current dataset — no record names the Tokyo Monorail as its own service. Adding a value the data does not carry would be speculation. |
| `railLines` and `shinkansen` are still encyclopedia-sourced | Inherited from Block 7; the operators remain unreachable. |
| `service` is free text | Human-readable and now partly machine-checkable through `mode` and the `vía` rule, but a service name is still prose. Further structure is not justified by the current dataset. |
| `consultedAt` has no staleness policy | Inherited from Block 7. |
| Four zones inline the same Narita source record | Inherited from Block 7. |
| `.icon-button--small` is a 36px control in the saved list | Pre-existing and explicitly allowed since Block 1. |
| `useZonePlanChoice` relies on comparison and planner being mutually exclusive | Re-examined again; Block 8 adds no writer and no reader of the draft. |
| `RC-05` | Single JS chunk above Vite's 500 kB advisory. Pre-existing, untouched. |
| Editorial zone ratings still have no second reader | Inherited from Block 3. |

---

## ¿BLOQUE 8 CERRADO? **SÍ**

`directFromZone` has an explicit, tested definition; the model represents it; all 23 records were
audited; the three that contradicted it were corrected; the copy no longer admits two readings; the
one claim that could not be verified was dropped rather than invented; the validator rejects ten
kinds of invalid state; Blocks 1–7 are green and unmodified; Block 8's audit is green at three
viewports; the tree is clean, the branch is pushed, `main` is untouched, and there is no merge and
no pull request.

---

## Recommendation for Block 9

**Let the two travellers review the editorial zone ratings.** It is the oldest open thread in the
project — carried since Block 3, named as actionable in the Block 5, 6 and 7 handoffs — and it is
now genuinely unblocked: Block 5 gave the app two readers, Block 6 gave it a vocabulary for
agreement and difference, and Blocks 7 and 8 finished hardening the *factual* half of the zone
layer, which is exactly the half a rating must not be confused with.

The one product decision it needs is small and the repository almost answers it already: by Block
5's own rule — *only "do I want to go here" is personal, everything else belongs to the trip* — a
zone rating is a claim about a place, not a preference about one, and is therefore **shared**. A
block that confirms that reading, lets both travellers see who set a rating, and keeps editorial
firmly out of `facts` would be small, well-precedented and would close a thread five blocks old.

**Second choice:** a staleness policy for `consultedAt`. Every source now carries a date and
nothing ever warns that one is old. A validator rule plus a quiet UI note is bounded and needs only
a threshold decision.

**Explicitly NOT recommended now:**

- **Re-sourcing `railLines` and `shinkansen`, or restoring Ikebukuro's Narita coach, from this
  environment.** The pages refuse automated requests; the only way to "finish" it here would be to
  cite what nobody read.
- **Adding transfer counts, durations or a mode hierarchy to airport links.** The dataset records
  none of them, and tests now forbid the vocabulary that would smuggle one in.
- **The backend / two-device layer**, more photography (both Block 2 STOP criteria hold), more
  zones (the 4–7 rule), travel-time estimation without a routing-provider decision.
