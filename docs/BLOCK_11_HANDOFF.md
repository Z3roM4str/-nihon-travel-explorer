# Block 11 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/sleepy-heisenberg-hn7340` |
| Started from | `109917e86baf6e54a7b72e8833c088efd134ec92` (Block 10 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. |
| Working tree | Clean. |
| Block 11 status | **Closed.** |

## Authority situation

The recommendation in [`docs/BLOCK_10_HANDOFF.md`](BLOCK_10_HANDOFF.md) — *"give `access-points` and
`reservation-mechanisms` provenance a volatility signal."* No other document assigned Block 11 and no
conflict was found.

**Branch note, recorded rather than glossed.** Block 10 closed on `claude/brave-wozniak-f79ie3` at
`109917e8`. This session's designated branch is `claude/sleepy-heisenberg-hn7340`, so Block 11 was
started by fetching `claude/brave-wozniak-f79ie3`, verifying `FETCH_HEAD` was exactly `109917e8`, and
basing this branch on that commit. **The full Block 7–10 history is therefore contained in this
branch**, `claude/brave-wozniak-f79ie3` is left untouched at `109917e8`, and the two are a
fast-forward apart. Nothing was rebased, squashed or discarded.

**Preflight discrepancy, unchanged since Block 6 and again left alone:** local `main` is stale at
`b924f5c`; `origin/main` is `1a11fe8`. `main` was not to be modified and the stale ref is local only.

## Preflight, as actually run

| check | expected | found |
|---|---|---|
| HEAD | `109917e8…` | `109917e8…` after basing on `origin/claude/brave-wozniak-f79ie3` |
| `origin/main` | `1a11fe8c…` | `1a11fe8c…` |
| working tree | clean | clean |
| Vitest | 3081 / 89 files | **3081 / 89** |
| oxlint · `tsc` · `vite build` | clean | clean |
| Python suites · argument-free validators | 13 · 8 | **13** · **8** |
| Blocks 1–10 audits | 142 · 69 · 105 · 261 · 225 · 216 · 129 · 114 · 153 · 81 | **all exact** |

`validate-walking-pilot.py` and `validate-walking-scale.py` "fail" only when run bare: both require a
mode argument. They are not among the 8 argument-free validators, exactly as Block 10 recorded.

## Commits

1. `feat(provenance): say what the other twelve sources claim, and when to look again`
2. `docs(block-11): design record, roadmap entry and handoff` — the head commit. It cannot carry its
   own hash; `git log -1 claude/sleepy-heisenberg-hn7340` is the authority.

## Inventory of the twelve records

`today = 2026-09-18`. Full matrix with URLs and evidence in
[`docs/BLOCK_11_DESIGN.md`](BLOCK_11_DESIGN.md) §1.

| id | system | kind / role | `confidence` | `consultedAt` | age | claim class | policy |
|---|---|---|---|---|---|---|---|
| `AP-JP-029-001` Ōte-mon | access point | `visitor-entrance` | `official-explicit` | 2026-09-05 | 13 d | `built-arrival-point` | none |
| `AP-JP-029-002` Hirakawa-mon | access point | `visitor-entrance` | `official-explicit` | 2026-09-05 | 13 d | `built-arrival-point` | none |
| `AP-JP-029-003` Kitahanebashi-mon | access point | `visitor-entrance` | `official-derived` | 2026-09-05 | 13 d | `built-arrival-point` | none |
| `AP-JP-181-001` ASMUI reception | access point | `reception` | `official-derived` | 2026-09-05 | 13 d | `built-arrival-point` | none |
| `RM-JP-044-001` Ghibli | reservation | `monthly-fixed-release` | `official-explicit` | 2026-09-12 | 6 d | `standing-sales-rule` | **unknown** |
| `RM-JP-203-001` Disney | reservation | `rolling-calendar-month-release` | `official-explicit` | 2026-09-12 | 6 d | `standing-sales-rule` | **unknown** |
| `RM-JP-204-001` DisneySea | reservation | `rolling-calendar-month-release` | `official-explicit` | 2026-09-12 | 6 d | `standing-sales-rule` | **unknown** |
| `RM-JP-077-001` Katsura | reservation | `relative-application-window` | `official-explicit` | 2026-09-12 | 6 d | `standing-sales-rule` | **unknown** |
| `RM-JP-212-001` sumo | reservation | **`fixed-sale-date`** | `official-explicit` | 2026-09-12 | 6 d | **`dated-sale-instance`** | none |
| `RM-JP-097-001` Nintendo | reservation | `monthly-application-window` | `official-derived` | 2026-09-13 | 5 d | `standing-sales-rule` | **unknown** |
| `RM-JP-050-001` PokéPark (outside JP) | reservation | `monthly-application-window` | `official-explicit` | 2026-09-14 | 4 d | `standing-sales-rule` | **unknown** |
| `RM-JP-050-002` PokéPark (in JP) | reservation | `monthly-application-window` | `official-explicit` | 2026-09-15 | 3 d | `standing-sales-rule` | **unknown** |

Structural findings: **one provenance per record** in both systems; no URL carrying two dates (the
two Disney records share the page *and* its date); and **neither schema has an authority tier**,
because both `confidence` enums are `official-*` — every source is the operator or the responsible
public body, so Block 7's `secondary` rung has no members here.

## The semantic problem found

Block 10 predicted the gap was "no `covers`". The audit shows that is **half right, for the wrong
reason**.

`covers` exists because one zone record makes three *separable* claims and one source may back any
subset — without it, an encyclopedia article stands silently behind an airport-link claim it never
spoke to. **Neither of these systems has that shape.** One access point is one arrival point with
one source; one reservation mechanism is one sales rule with one source. There is no subset to pick
out, and a `covers` field would ask each record to restate, in a field that can drift, what the
record already *is* — reintroducing the very failure `covers` prevents, as ceremony.

> **What was missing is not *which* claim a source backs — never ambiguous — but *what kind* of
> claim it is, because the twelve are not all one kind.**

And both schemas already store the distinction: `role` for access points, `mechanism.kind` for
reservations. So the class is **derived**, never stored beside the fact.

The finding that forced the design: **`RM-JP-212-001` is not like its seven siblings.** Seven record
a standing rule relative to the visit date; the sumo record stores an absolute `saleDate: 2027-02-06`
for the absolute window `2027-03-14 … 2027-03-28`. It describes *one sale*, not how sales work, and
expires by its own terms. On 2027-04-01 its check is 201 days old — "fine" under any age model —
while the tournament finished four days earlier. **Age is the wrong instrument for that record.**

## Decision — reservation mechanisms

**No `covers`. A derived claim class. One class deliberately left unautomated.**

| class | members | volatility | horizon |
|---|---|---|---|
| `standing-sales-rule` | 5 kinds, 7 records | **commercial** | **`unknown` — no number adopted** |
| `dated-sale-instance` | `fixed-sale-date`, 1 record | **temporal** | **none** |

## Decision — access points

**No `covers`. A derived claim class. No periodic horizon for anything shipped.**

| class | members | volatility | horizon |
|---|---|---|---|
| `built-arrival-point` | 6 roles, all 4 records | **structural** | **none** |
| `served-transit-stop` | `transit-stop`, **0 records** | **operational** | **365 days** |

`reception` is deliberately structural: a reception desk belongs to a building, and relocating one is
an announced move, not a periodic revision.

## Schema — before and after

| | before | after |
|---|---|---|
| `AccessPointProvenance` | `sourceUrl, sourceEntity, consultedAt, evidence, confidence` | **unchanged** |
| reservation `provenance` | same five fields | **unchanged** |
| `data/logistics/access-points.json` | 4 records | **unchanged, byte for byte** |
| `data/reservation-mechanisms.json` | 8 records | **unchanged, byte for byte** |
| `SourceFreshnessState` | 3 members | **4** — `recheck-interval-unknown` |
| freshness input | `covers: ZoneFactArea[]` | `RecheckHorizon` = `{days} \| {none} \| {unknown}` |

### Why a fourth state

Block 10's `number | null` had two answers: "365" and "no rhythm exists". Block 11 found a third that
`null` cannot carry — *these claims change, and nothing supplies an interval*. Collapsing it into
`null` would make every ticketing policy report `no-periodic-recheck`, telling the reader to relax
about the most volatile claims Nihon holds. Per §11, `no-periodic-recheck` was **reused** for the two
classes it genuinely fits and not renamed; the fourth is its opposite, and a test asserts the two
never produce the same wording.

## Volatility categories and freshness policies

| class | volatility | policy | threshold |
|---|---|---|---|
| `built-arrival-point` | structural | `no-periodic-recheck` | — |
| `served-transit-stop` | operational | periodic | **365 d** |
| `dated-sale-instance` | temporal | `no-periodic-recheck` | — |
| `standing-sales-rule` | commercial | `recheck-interval-unknown` | **none, deliberately** |

### Justification of each

**`served-transit-stop` = 365 days.** What changes: whether a stop is *served*. Why a number exists:
that is a timetable fact and Japanese operators revise timetables annually. Reaching the limit means
the check predates the most recent revision — nothing more. **Not borrowed from `airportLinks`**: the
brief rightly forbids exporting that *value* outside its domain, and this reuses only the constant
`TIMETABLE_CYCLE_DAYS` after re-making the argument here, arriving at the same rhythm because it is
the same rhythm. **No shipped record is a `transit-stop`**; the branch is decided in advance so the
first one cannot silently inherit whichever branch happens to run, and is exercised by constructed
records in tests.

**`built-arrival-point` = none.** Built fabric changes by construction — announced, years long, on no
publication cycle. Block 10's `railLines` argument in the same domain of fact.

**`dated-sale-instance` = none.** The record carries its own absolute dates. Re-reading on a cadence
discovers nothing it does not already state; the calendar ends it, not our neglect. Literally
"nothing periodic governs these claims".

**`standing-sales-rule` = no threshold, and that is the decision.** Block 10 derived 365 from an event
you can point at. Ticketing policy supplies no such event: a museum may change its release day, hour,
lead time or lottery next Tuesday and announce it only by editing the page. No cycle → no number to
derive, and a number derived from nothing would look decided while being invented. Equally **not**
`no-periodic-recheck`, which means *relax*. Recorded as debt.

## Records migrated

**None — and that is structural, not restraint.** The claim class is derived, so there was nothing to
migrate. Zero data files changed; `git diff --name-only 109917e8 -- data/ app/src/data/` is empty.

## `consultedAt` before and after

**Identical for all twelve.** No date was edited, no source re-visited, no fact altered.

| records | before | after |
|---|---|---|
| 4 access points | 2026-09-05 | 2026-09-05 |
| `RM-JP-044/203/204/077/212` | 2026-09-12 | 2026-09-12 |
| `RM-JP-097-001` | 2026-09-13 | 2026-09-13 |
| `RM-JP-050-001` | 2026-09-14 | 2026-09-14 |
| `RM-JP-050-002` | 2026-09-15 | 2026-09-15 |

A test pins this table. Block 10's definition is unchanged: *the civil date on which Nihon opened
that source and confirmed it supported the claim beside it.* **A structural migration is not a new
consultation**, and none happened.

## Visible changes

**None.** Two decisions, both argued:

- **Access-point provenance has no UI surface whatsoever.** `access-points.ts` has exactly one
  non-test importer, `transit.ts`, and that is a type-only import. The provenance is routing
  infrastructure, never rendered. Nothing to reuse, nothing to add.
- **Reservation provenance already renders** `Fuente oficial: … · consultada el …`. Adding a badge
  saying "we don't know how often to re-check this" would put Nihon's own process in front of the
  reader — the chip accumulation §15 forbids. The signal is reused, not multiplied.

**Consequence, stated rather than left to be discovered:** with `unknown` and `none` as the only
reservation horizons and a validator refusing impossible and future dates, **a reservation record can
never reach `needs-recheck`**. No note can fire. That is a real property of the model.

One UI-adjacent line changed: `freshnessAccessibleText` gained the branch the widened union requires
— unreachable from a zone source, and written to be correct rather than to silence the compiler:
*"puede cambiar sin aviso; Nihon no fija cada cuánto volver a comprobarla."*

**No browser audit was added**, per §18: there is no visible change to audit. The ten historical
audits are the evidence.

## Validators

Block 10 called the zone validator "the weak outlier" and fixed it; by this block the outliers were
the other two, which still accepted `2099-01-01`. Both now match, with injectable `today`:

- an impossible date (`2026-02-30`, `2026-13-01`, `2027-02-29`, wrong order, unpadded);
- a missing or empty date;
- **a date in the future** — a check dated tomorrow was never made.

**Age is never an error**, and here that is load-bearing: a standing sales rule has no derivable
interval, so age cannot be made to mean anything. The rule is about the **check's** date and never
about `mechanism.saleDate` — a future sale date is the normal case.

**Rules deliberately not added.** §13's "coverage ausente", "valor desconocido", "coverage que no
corresponde a ningún campo" all presuppose a *stored* coverage field. With coverage derived from an
already-closed enum they are **unrepresentable**, which is stronger than checked. All three are
exercised as negative cases anyway.

### Negative cases — 32 of 32 behaved correctly

Each mutates one field of the real shipped datasets.

| case | access points | reservations |
|---|---|---|
| `consultedAt` one day in the future · far future (2099) | rejected | rejected |
| Feb 30 · month 13 · Feb 29 in a non-leap year | rejected | rejected |
| wrong order · unpadded · empty · field missing | rejected | rejected |
| future date on the **last** record, not the first | rejected | rejected |
| unknown `role` / unknown `mechanism.kind` | rejected | rejected |
| unknown `confidence` | rejected | rejected |
| a stray `covers` key in `provenance` | — | rejected |
| a check **eleven years old** | **accepted** | **accepted** (every record) |
| checked exactly today · Feb 29 in a leap year | **accepted** | **accepted** |
| the shipped dataset, unmutated | **accepted** | **accepted** |
| sumo `saleDate` 2027-02-06 in the future | — | **accepted** |

## Tests added

| file | tests |
|---|---|
| `app/src/lib/provenance-claim-class.test.ts` | **36** |
| **Vitest total** | 3081 → **3117**, 89 → **90 files** |

`app/src/lib/source-freshness.test.ts` was **not modified**: Block 10's 38 tests pass unchanged
against the refactored engine, which is the evidence the refactor preserves behaviour.

Covered: correct coverage (all 12 by name) · exhaustive real categories · tier independence
(asserted on the shipped shape — neither schema *has* a tier) · `confidence` independence in both
directions · editorial independence · determinism, no clock, no storage · the category **with** a
horizon at 364/365/366 · the categories **without**, at 0–4000 days · the unknown category, which
never reports a number and never reports `current` yet still reports its age · broken dates
outranking every horizon · leap-day crossing · **no zone source can ever produce the new state** ·
all 12 `consultedAt` pinned · neither provenance grew a `covers` key.

**Multi-cover:** does not exist in either system, so nothing was invented to test it. The
one-provenance-per-record shape is asserted instead.

### The guards, broken on purpose to prove they fire

| broken | caught by |
|---|---|
| a new `role` with no class | **`tsc` TS2741** `Property 'helipad' is missing` |
| a `mechanism.kind` dropped from the class map | **`tsc` TS2741** `Property '"rolling-day-release"' is missing` |
| `standing-sales-rule` quietly given the stable horizon | **5 tests failed** |
| an invented 180-day threshold for sales rules | **4 tests failed** |

## Baseline vs final

| check | baseline | result |
|---|---|---|
| Vitest | 3081 / 89 files | **3117 passed**, 0 failed, **90 files** |
| oxlint · `tsc` · `vite build` | clean | clean |
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
| Block 11 | — | **no audit; no visible change** |
| `git diff --check` | clean | clean |

All 25 files under `app/scripts/` verified **byte-identical** to `109917e8` by SHA-256.

### The gate list a future block must run

```
cd app && npm ci && npm test && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run build
pip install -r scripts/requirements.txt
for t in scripts/test_*.py; do python3 "$t"; done                 # 13
for v in scripts/validate-*.py; do python3 "$v"; done             # 8 argument-free
cd app && for b in block1-ux block2-photography block3-zones block4-zone-planner \
                   block5-travellers block6-divergence block7-zone-provenance \
                   block8-airport-link block9-editorial-governance block10-source-freshness; do
            node scripts/$b-browser-audit.mjs --browser=/opt/pw-browsers/chromium; done
```

Do **not** run `playwright install`.

## Regressions found

**None.** Block 7's `$`-anchored accessible-name audit — the gate Block 10 tripped — was not touched,
because the new state's wording is reached through the same `sourceLinkLabel` threading Block 10
built and no zone source can produce it. All ten historical audits pass unmodified.

The one thing that *did* fail during development was `tsc`, on the exhaustive switch in
`freshnessAccessibleText`, the moment the union grew a fourth member. **That was the gate working**:
widening the contract is not allowed to leave a state unworded. The fix was to write the wording, not
to add a `default`.

## False positives

**None this block.** The source scans in the new test file were written with `withoutComments`
applied from the start — the helper Block 10 had to introduce after its three scans matched
documentation rather than code.

## Sources currently marked `needs re-check`

**None**, and now for two distinct reasons worth separating:

- the 23 zone facts are 0–1 days old against a 365-day horizon;
- of the twelve, five are governed by no rhythm at all and seven by no *derivable* rhythm — so none
  of them can reach `needs-recheck` on age, today or ever.

The first record that will become due is still `ZN-OSA-SHIN-OSAKA` and its 16 siblings dated
2026-09-17, on **2027-09-18**.

## Remaining technical debt

| | |
|---|---|
| **`standing-sales-rule` has no re-check interval** | **New, and this block's honest outcome.** Seven records. Closing it needs evidence Nihon does not have: an operator that publishes a revision cycle, or an observed history of changes to measure. **Do not close it by picking a number.** |
| `served-transit-stop` is decided but unexercised | No shipped record is a `transit-stop`. Tested with constructed records. |
| The `needs-recheck` UI state is unexercised in a browser | Inherited from Block 10, and now structurally so for reservations: no reservation record can reach it. |
| `unsupported` is not representable | Deliberate, unchanged: a stored flag written by whoever read the page, not a computed one. |
| Editorial ratings still have no second reader | Inherited from Block 3; only the travellers can close it. |
| Ikebukuro's Narita coach is no longer recorded | Inherited from Block 8; unverifiable from this environment. |
| `railLines` / `shinkansen` remain encyclopedia-sourced | Inherited from Block 7; the stable half of the dataset. |
| Four zones inline the same Narita source record | Inherited from Block 7. |
| `.icon-button--small` is a 36px control | Pre-existing, allowed since Block 1. |
| `RC-05` single JS chunk above Vite's advisory | Pre-existing, untouched. |

---

## ¿BLOQUE 11 CERRADO? **SÍ**

All twelve records were audited before anything was designed; each system got an explicit decision
and both were **no `covers`**, with the reason stated rather than assumed; the only new schema is one
state and one horizon type, each justified by a case the old shape could not express; the twelve are
coherent and none was touched; `consultedAt` keeps Block 10's definition exactly and no date looks
freshly verified, because nothing was migrated; freshness extends the existing engine and Block 10's
own tests pass unmodified; a threshold exists only where the domain supplies a rhythm, and the one
category that supplies none is recorded as debt instead of given a number; `confidence` is proven
independent in both directions; nothing derived is stored and no storage key was added; the
validators refuse every impossible and future date while never refusing age; the tests pin the
contract and the guards were broken on purpose to prove they fire; Blocks 1–10 are at baseline and
byte-identical; the tree is clean, the branch is pushed, `main` is untouched, and there is no merge
and no pull request.

---

## Recommendation for Block 12

**Record the outcome of the human review Block 9 unblocked.** It is now the oldest open thread by a
wide margin, it needs no new external research, and it is the only item on the list that cannot be
started unilaterally — which is precisely why it keeps being deferred. Block 9 built the surface; two
travellers have to use it.

**Second choice, if the travellers are unavailable: nothing in provenance.** After Blocks 7–11 the
arc is complete — what a source backs, how close it is, when it was last checked, and whether that
class of claim needs looking at again. Every one of the 35 records now has an explicit, explicable
answer. The next honest move in this area is to *wait for a reason*, not to refine the model further.

**Explicitly NOT recommended now:**

- **Putting a number on `standing-sales-rule`.** There is no evidence for one. An invented interval
  would be strictly worse than the admitted gap, because it would look decided. If someone wants to
  close it, the work is to *gather* evidence — watch a handful of operator pages over months and
  measure — not to choose.
- **Adding `covers` to either schema after all.** The record is the claim in both systems; a
  coverage field would be a second place for the truth to live and drift.
- **Refreshing any `consultedAt`.** Nothing is due until 2027-09-18, and seven records have no
  due date at all.
- **A UI surface for access-point provenance.** It has no UI today for a good reason: it is routing
  infrastructure, not a fact the reader is asked to trust.
- **The backend / two-device layer**, more photography (both Block 2 STOP criteria hold), more zones
  (the 4–7 rule), travel-time estimation without a routing-provider decision.
