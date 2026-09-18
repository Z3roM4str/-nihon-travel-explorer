# Block 10 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/brave-wozniak-f79ie3` |
| Started from | `ff69e7039f46ebd5e8aacbea4bfd012d041465d4` (Block 9 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. No new branch. |
| Working tree | Clean. |
| Block 10 status | **Closed.** |

## Authority situation

The recommendation in `docs/BLOCK_9_HANDOFF.md`. No other document assigned Block 10 and no
conflict was found.

**Preflight discrepancy, unchanged since Block 6 and again left alone:** local `main` is stale at
`b924f5c`; `origin/main` is `1a11fe8`. `main` was not to be modified and the stale ref is local only.

## Commits

1. `160833f` `feat(provenance): say what consultedAt means, and when a check has aged`
2. `docs(block-10): design record, roadmap entry and handoff` — the head commit. It cannot carry its
   own hash; `git log -1 claude/brave-wozniak-f79ie3` is the authority.

## Final definition of `consultedAt`

> **The civil date on which Nihon opened that source and confirmed it supported the claim beside
> it.**

Not the source's publication date, not the page's last-modified date, not the date the row entered
the repository. Blocks 7 and 8 wrote each date on the day they actually read the page, and each
record's `evidence` string quotes what it said that day — the date and the evidence are one act,
which is what makes this the only reading the history supports.

## Inventory found

| system | records | dates | age at 2026-09-18 |
|---|---|---|---|
| zone facts (`data/accommodation/zones.json`) | 23 | 2026-09-17 (×17), 2026-09-18 (×6) | 0–1 d |
| reservation mechanisms (`data/reservation-mechanisms.json`) | 8 | 2026-09-12 … 2026-09-15 | 3–6 d |
| access points (`data/logistics/access-points.json`) | 4 | 2026-09-05 | 13 d |
| **total** | **35** | 7 distinct dates | **0–13 d** |

- Missing dates: **none**. Future dates: **none**. 30 distinct source URLs, **none** appearing with
  two different dates.
- Zone `covers` distribution: 16 records cover `railLines,shinkansen,airportLinks`; 6 cover
  `airportLinks` only; **1 covers `railLines,shinkansen` only** (`ZN-OSA-NAMBA`, after Block 8).
- Zone tiers: 16 `secondary`, 7 `operator`. Reservation/access-point provenance carries
  `confidence`, not `tier`, and has no `covers` field at all.

**Nothing in the repository is stale by any reading.** This block therefore writes a policy that
does not fire today, and says so rather than manufacturing a problem.

## Freshness model chosen: **B — per `covers`**

| fact area | horizon | justification |
|---|---|---|
| `airportLinks` | **365 days** | Services, not infrastructure: which train or coach runs and where it stops. Japanese operators revise timetables on an annual cycle; **365 is one cycle, derived, not chosen for roundness**. The dataset already carries the scar of one such change — Umeda's Haruka platforms, recorded *"desde 2023"*. A check older than a full cycle has provably not seen the current timetable. |
| `railLines` | **none** | Infrastructure. Changes when a line opens or closes — an announced event years in the making, not a scheduled revision. |
| `shinkansen` | **none** | Same, more so: new Shinkansen stations are decade-scale projects. |

A source covering several areas takes the **strictest** horizon: it is due as soon as any claim it
carries is due.

**Why not A or C.** Model A would put a fictitious annual deadline on "does the Yamanote line serve
Shinjuku" — a calendar cannot tell you a line opened, and its expiring tells you nothing. Model C
would ignore the one real rhythm the domain does supply. And the "no horizon" branch is **not
hypothetical**: `ZN-OSA-NAMBA`'s station article backs infrastructure alone, so both branches are
exercised by the shipped data.

## The three states, exactly

| state | meaning | derived from |
|---|---|---|
| `current` | checked within the horizon its claims deserve | `ageDays <= horizonDays` |
| `needs-recheck` | still valid, and due for a look | `ageDays > horizonDays`, or an unusable/future date |
| `no-periodic-recheck` | nothing periodic governs these claims | no covered area has a horizon |

**`unsupported` is deliberately NOT a state here.** A source stops supporting a claim when somebody
reads it and finds it no longer does — evidence, not arithmetic. No function in this block can
produce it, and it is not in the schema because no source is in it. When one is, it will be a
*stored* flag written by whoever read the page.

Boundary: **inclusive**. Checked exactly `horizonDays` ago → still `current`; one day later →
`needs-recheck`. A cycle is over only once it is over.

## What is stored vs derived

| | |
|---|---|
| **Stored** | `consultedAt` only — unchanged, one string per provenance record, exactly as Blocks 7–8 left it. |
| **Derived** | the state, the age in days, the governing horizon, the re-check queue, the note, and the accessible wording. All computed on read from `(consultedAt, covers, today)`. |
| **Added storage** | **None.** No key, no document, no field. Asserted by the audit's full `nihon.*` key comparison and by a test forbidding `localStorage` in the module. |

## Schema changes

**None.** `ZoneProvenance` is untouched. Block 10 adds only derived functions and copy.

## Data changes

**None.** No date was edited, no source re-visited, no fact altered. Per §15 of the brief, and
nothing is due anyway.

## Visible changes

**Today: none rendered.** A muted note — *"conviene volver a comprobarla"* — appears beside a source
past its horizon, and no source is. The everyday line is exactly what Block 7 left: name and tier,
no date, no badge.

The note is **never red**: an unrepeated check has not been contradicted, and colouring it as a
fault would say something the data does not support.

The **accessible name** now says what the date means:

| state | wording |
|---|---|
| `current` | comprobada recientemente |
| `no-periodic-recheck` | no necesita comprobaciones periódicas |
| `needs-recheck` | conviene volver a comprobarla; no significa que el dato sea incorrecto |

It is threaded **through** `sourceLinkLabel` rather than appended, so the consultation date stays
last — see *Regressions* below.

## Validators

`scripts/validate-accommodation-zones.py` checked only the **shape** `\d{4}-\d{2}-\d{2}` until this
block, so `2026-02-30`, `2026-13-01` and `2099-01-01` all passed. The other two validators already
used a real `valid_date`; the zone one was the weak outlier and now matches them.

It now refuses, on the primary record **and** on every extra source:

- an impossible date (`2026-02-30`, `2026-13-01`, `2027-02-29`, wrong order, unpadded);
- a missing or empty date;
- **a date in the future** — a check dated tomorrow was never made.

**Age is never an error.** `today` is injectable so the rule is testable without a clock.

### Negative cases, run by hand against the real dataset

| case | result |
|---|---|
| Feb 30 / month 13 / Feb 29 in a non-leap year | rejected |
| `18-09-2026` (wrong order) · `2026-9-18` (unpadded) | rejected |
| empty date · missing field | rejected |
| `2099-01-01` · `2026-09-19` (one day ahead) | rejected |
| future date on an **extra** source · impossible date on an **extra** source | rejected |
| a check six years old · **every** check eleven years old | **accepted**, correctly |
| Feb 29 in a leap year · today exactly | **accepted**, correctly |

## Tests added

| file | tests |
|---|---|
| `app/src/lib/source-freshness.test.ts` | 38 |
| `app/src/components/ZoneSources.test.ts` (Block 10 section) | +7 |
| **Vitest total** | **+45** |
| `app/scripts/block10-source-freshness-browser-audit.mjs` | 27 per viewport × 3 = **81** |

### Temporal boundary coverage

- the day **before** the horizon → `current`;
- the horizon **exactly** → `current` (inclusive);
- the day **after** → `needs-recheck`;
- checked today → `current`, age 0;
- **across a leap day**: 2027-06-15 → 2028-06-15 is 366 days → `needs-recheck`;
- **across a non-leap year**: 2025-06-15 → 2026-06-15 is 365 → still `current`;
- a check made **on** a leap day (2028-02-29);
- month boundary (Jan 31 → Feb 1) and year boundary (Dec 31 → Jan 1);
- future dates (far and one-day), impossible dates, an unusable `today`;
- determinism: same pair → same answer; the verdict changes only with `today`;
- tier independence, editorial independence, no clock, no storage;
- the shipped dataset anchored to a fixed date, so no test can start failing with the calendar.

## Baseline vs final

| check | baseline | result |
|---|---|---|
| Vitest | 3036 / 88 files | **3081 passed**, 0 failed, **89 files** |
| oxlint · `tsc` · `vite build` | clean | clean |
| Python suites | 13 | **13 of 13** |
| Validators | 8 | **8 of 8** |
| Block 1 | 142 | **142**, unmodified |
| Block 2 | 69 | **69**, unmodified |
| Block 3 | 105 | **105**, unmodified |
| Block 4 | 261 | **261**, unmodified |
| Block 5 | 225 | **225**, unmodified |
| Block 6 | 216 | **216**, unmodified |
| Block 7 | 129 | **129**, unmodified |
| Block 8 | 114 | **114**, unmodified |
| Block 9 | 153 | **153**, unmodified |
| **Block 10** | — | **81/81** (27 per viewport × 3) |
| `git diff --check` | clean | clean |

All nine historical audit scripts verified **byte-identical** to `ff69e70` by SHA-256.

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

## Browser audit, per viewport

`block10-source-freshness-browser-audit.mjs` — 27 checks each at **390×844 DPR 2**, **820×1180
DPR 2** and **1440×900**, 81 total, all passing.

Its central job is the **negative**: that a freshness policy exists without putting one alarm on
screen. It compares Namba (whose station article backs infrastructure alone) with Umeda, and
checks: **no source carries a re-check note**, because every check is recent → the visible line is
exactly Block 7's name-and-tier, with **no raw date** pushed into it → no alarming word anywhere on
the card → every link's accessible name still carries the consultation date, **now says what that
date means**, and is still unique → a source backing infrastructure alone says *no necesita
comprobaciones periódicas* while one backing airport links says *comprobada recientemente* → the
tier is still stated in words, an old encyclopedia is still `secondary` and a fresh airport still
`operator`, and **no freshness wording leaked into the tier** → the editorial ratings say nothing
about freshness, because they carry no source at all → no overflow, nothing widens its column,
nothing clipped, focus and `rel=noreferrer` intact → opening a source and toggling the ratings
writes no planning decision and no storage key → and Tokio reads the same way.

**Deliberate limitation, recorded:** the *positive* side — that the note appears, on exactly the
right day — is proven at its boundaries in `source-freshness.test.ts`, where `today` is injectable.
Shipping a deliberately stale record to exercise a view would be corrupting the dataset to test a
colour.

## Regressions found

**One real regression, caught by the historical net and fixed without weakening it.**

Appending the freshness clause to the source link's accessible name broke Block 7's audit, whose
regex `/fuente de .+, consultada el \d{4}-\d{2}-\d{2}$/` is **`$`-anchored on the date**. The
intent ("the accessible name says which zone it belongs to") was intact; only the anchor broke.

Rather than relax a historical gate, the copy was **reordered**: `freshnessText` is threaded through
`sourceLinkLabel` and inserted *before* the zone, so the date stays last. Block 7's audit passes
byte-identical, and the anchor keeps doing its job — guaranteeing the date is never buried
mid-string by a later addition.

**A second catch, by a different gate.** The first attempt put `todayCivilDate` in `civil-date.ts`;
that module's own source scan forbids local getters after `differenceInCivilDays` and rejected it.
The gate was right — `civil-date.ts` is contractually clock-free and timezone-invariant, while
"today" must read *local* components. The function moved to `lib/today.ts`; `civil-date.ts` is
byte-identical to Block 9.

## False positives

**Three, all in Block 10's own new tests**, found and fixed before the commit. None was a product
defect; all three were my regexes matching **documentation** rather than code:

1. an "alarming vocabulary" scan flagged the one sentence whose job is to *deny* incorrectness
   (*"no significa que el dato sea incorrecto"*);
2. a "never reads a tier" scan matched the doc comment promising exactly that;
3. a "no clock" scan matched the doc comment stating there is no `new Date()` in the file.

All three now strip comments first, using the `withoutComments` helper this repository already
uses for the same reason elsewhere.

## Sources currently marked `needs re-check`

**None.** Every one of the 35 records is between 0 and 13 days old, and the strictest horizon in
the model is 365 days. The policy is in force and correctly silent.

The first record that will become due is `ZN-OSA-SHIN-OSAKA` and its 16 siblings dated
**2026-09-17**, which reach `needs-recheck` on **2027-09-18**. `ZN-OSA-NAMBA`'s station article
will never become due on its own, because it backs infrastructure alone.

## Remaining technical debt

| | |
|---|---|
| Reservation mechanisms and access points have no `covers` field | So Model B cannot be expressed for them. Inventoried (12 records, 3–13 days old) and left alone; `freshnessFor` serves them unchanged the day their provenance gains a volatility signal. |
| The `needs-recheck` UI state is unexercised in a browser | By construction: nothing is due. Covered at its boundaries by unit tests. A future block that refreshes a date could also assert it live. |
| `unsupported` is not representable | Deliberate: no source is in that state, and it would be a stored flag, not a computed one. |
| Editorial ratings still have no second reader | Inherited from Block 3; Block 9 made them reviewable, only the travellers can close it. |
| Ikebukuro's Narita coach is no longer recorded | Inherited from Block 8; unverifiable from this environment. |
| `railLines` and `shinkansen` remain encyclopedia-sourced | Inherited from Block 7; the operators refuse automated requests. **Note this is now doubly defensible**: those claims also carry no periodic horizon, so their sourcing is the stable half of the dataset. |
| Four zones inline the same Narita source record | Inherited from Block 7. |
| `.icon-button--small` is a 36px control in the saved list | Pre-existing, allowed since Block 1. |
| `RC-05` | Single JS chunk above Vite's advisory. Pre-existing, untouched. |

---

## ¿BLOQUE 10 CERRADO? **SÍ**

`consultedAt` has an unambiguous definition; an automatic freshness policy exists and its shape is
justified by the domain rather than invented; the threshold is one timetable-revision cycle and the
areas without a rhythm have none; `needs-recheck` is never confused with incorrect and cannot be;
the temporal logic is pure, injectable and tested at its boundaries including leap days; nothing
derivable is stored and no storage key was added; authority tier and freshness are independent and
tested in both directions; the validator rejects impossible and future dates while never rejecting
age; the new UI explains the state and today shows nothing; Blocks 1–9 are at baseline and
byte-identical; Block 10's audit is green at three viewports; the tree is clean, the branch is
pushed, `main` is untouched, and there is no merge and no pull request.

---

## Recommendation for Block 11

**Give `access-points` and `reservation-mechanisms` provenance a volatility signal, so the freshness
model already built can serve them.** Block 10 inventoried all 35 records but could only apply the
policy to the 23 that carry `covers`; the other twelve have `confidence` instead and no way to say
what kind of claim they back. Adding the equivalent of `covers` to those two schemas is additive,
bounded, needs no new external research, and would make one freshness function govern every sourced
fact in the app instead of two-thirds of them. It is also the natural completion of the arc Blocks
7–10 have been walking: what a source backs, how close it is, and when it was last checked.

**Second choice:** record the outcome of the human review Block 9 unblocked — still the oldest open
thread, and still requiring the two travellers first, so it cannot be started unilaterally.

**Explicitly NOT recommended now:**

- **Refreshing any `consultedAt` date.** Nothing is due until 2027-09-18, and re-visiting pages to
  bump dates would be exactly the "actualización" project §15 ruled out.
- **A shorter threshold.** 365 is one revision cycle; any smaller number would be invented.
- **Making an old source fail the build**, or downgrading its tier. Age is not falsehood, and both
  directions are now test-protected.
- **The backend / two-device layer**, more photography (both Block 2 STOP criteria hold), more
  zones (the 4–7 rule), travel-time estimation without a routing-provider decision.
