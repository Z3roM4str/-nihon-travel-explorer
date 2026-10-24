# Block 11 — semantic coverage of provenance in `access-points` and `reservation-mechanisms`

Block 10 inventoried 35 provenance records across three systems and could apply its freshness model
to only 23 of them. This block is about the other twelve: **8 reservation mechanisms and 4 access
points**, which carry `provenance` and `consultedAt` but no `covers`.

The brief was explicit that copying `covers` was not the assumed answer. It is not the answer.

---

## 1. The twelve records, audited

`today = 2026-09-18` throughout.

### Access points — `data/logistics/access-points.json`

| id | claim the provenance backs | source | entity | confidence | `consultedAt` | age |
|---|---|---|---|---|---|---|
| `AP-JP-029-001` Ōte-mon Gate | this gate is a visitor entrance to the East Gardens **and stands at 35.68596, 139.760215**; reachable on foot and from a local-transit station | `visit-chiyoda.tokyo/app/spot/detail/19` | Chiyoda City Tourism Association | `official-explicit` | 2026-09-05 | 13 d |
| `AP-JP-029-002` Hirakawa-mon Gate | same, at 35.689623, 139.757877 | `…/detail/653` | same | `official-explicit` | 2026-09-05 | 13 d |
| `AP-JP-029-003` Kitahanebashi-mon Gate | same, at 35.688868, 139.754043 — coordinate **derived** from the published bridge/gate map target | `…/detail/244` | same | `official-derived` | 2026-09-05 | 13 d |
| `AP-JP-181-001` ASMUI reception | the operator's reception/arrival point is at 26.8619707, 128.2550917; external walk only | `asmui.jp` | ASMUI Spiritual Hikes (operator) | `official-derived` | 2026-09-05 | 13 d |

Fields actually backed, in all four: `coordinates`, `role`, `label`, `applicableContexts`. **The same
set every time** — no record's source backs a subset of another's.

### Reservation mechanisms — `data/reservation-mechanisms.json`

| id | place | `mechanism.kind` | claim the provenance backs | entity | confidence | `consultedAt` | age |
|---|---|---|---|---|---|---|---|
| `RM-JP-044-001` | JP-044 Ghibli Museum | `monthly-fixed-release` | tickets release on the 10th at 10:00 JST for the next calendar month | Ghibli Museum, Mitaka | `official-explicit` | 2026-09-12 | 6 d |
| `RM-JP-203-001` | JP-203 | `rolling-calendar-month-release` | sold daily 14:00 for the same date two months later; capacity-limited | Tokyo Disney Resort | `official-explicit` | 2026-09-12 | 6 d |
| `RM-JP-204-001` | JP-204 | `rolling-calendar-month-release` | same rule, same page | Tokyo Disney Resort | `official-explicit` | 2026-09-12 | 6 d |
| `RM-JP-077-001` | JP-077 Katsura | `relative-application-window` | applications 05:00 on the 1st, 3 months before → 23:59, 3 days before; lottery if oversubscribed | Imperial Household Agency, Kyoto | `official-explicit` | 2026-09-12 | 6 d |
| `RM-JP-212-001` | JP-212 sumo | **`fixed-sale-date`** | **advance tickets sold from 2027-02-06** for the tournament **2027-03-14 … 2027-03-28** | Japan Sumo Association | `official-explicit` | 2026-09-12 | 6 d |
| `RM-JP-097-001` | JP-097 Nintendo Museum | `monthly-application-window` | drawing entries for the full calendar month 3 months before the visit month | Nintendo Museum ticketing | `official-derived` | 2026-09-13 | 5 d |
| `RM-JP-050-001` | JP-050 PokéPark | `monthly-application-window` | outside-Japan route: applications 1st–12th, 3 months ahead, from 20:00 JST | PokéPark KANTO web store | `official-explicit` | 2026-09-14 | 4 d |
| `RM-JP-050-002` | JP-050 PokéPark | `monthly-application-window` | Japan-resident route, same window shape | PokéPark KANTO ticket info | `official-explicit` | 2026-09-15 | 3 d |

Fields actually backed, in all eight: `mechanism`, `allocation`, `purchaseResidenceContext`.

### Structural findings from the audit

- **One provenance per record, in both systems.** Neither schema has an `extra sources` array; there
  is no record where two sources back different parts of one fact, and none where one source backs
  only part of one record.
- **No source URL carries two different dates.** `RM-JP-203-001` and `RM-JP-204-001` share the Tokyo
  Disney ticket page *and* its date — one reading, two places.
- **No structural relation between provenance and fields exists today**, in either schema, and none
  is needed: the record *is* the unit of claim.
- **Neither schema has an authority tier**, and this is not an omission. Both `confidence` enums are
  `official-explicit | official-derived` — every source in both systems is the operator or the
  responsible public body, so the lower rungs of Block 7's ladder (`secondary`, i.e. an
  encyclopedia) have no members here and nothing to rank.

---

## 2. The real problem — which is not the one Block 10 predicted

Block 10 recommended "the equivalent of `covers`". Auditing the twelve shows that recommendation is
**half right, and right for a different reason than it gave**.

`covers` exists because **one zone record makes three separable claims** — rail lines, Shinkansen,
airport links — and one source may back any subset. Without it, a station's encyclopedia article
stands silently behind an airport-link claim it never spoke to. That was a real defect with a real
victim, and Block 7 fixed it.

**Neither of these two systems has that shape.** One access point is one arrival point with one
source; one reservation mechanism is one sales rule with one source. There is no subset to pick out.
A `covers` field here would ask each record to restate, in a field that can drift out of sync, what
the record already *is* — reintroducing the exact failure `covers` was invented to prevent, as
ceremony.

So the answer to the brief's §2 is **C, with a twist**: neither system needs `covers`, but one of
them was hiding a genuine semantic gap that `covers` would not have caught.

> **What was missing is not *which* claim a source backs — that was never ambiguous — but *what kind
> of claim it is*, because the twelve are not all one kind.**

And both schemas already say which kind, in a field that is already stored, already validated
against a closed set, and **cannot contradict the fact it describes**:

| system | the field that already carries the distinction |
|---|---|
| access points | `role` — separates built fabric from a *served* stop |
| reservation mechanisms | `mechanism.kind` — separates a standing rule from one dated sale |

The claim class is therefore **derived from those, never stored beside them**. A stored class can be
wrong. A derived one is wrong only if `provenance-claim-class.ts` is.

### The finding that forced this block's shape

`RM-JP-212-001` is not like its seven siblings. Seven record a **standing rule** stated relative to
the visit date. The sumo record stores an **absolute** `saleDate: 2027-02-06` for an **absolute**
window `2027-03-14 … 2027-03-28`. It does not describe how sales work; it describes *one sale*.

That matters for freshness directly. On 2027-04-01 the 2026-09-12 check is 201 days old — "fine"
under any age model — while the tournament it describes finished four days earlier. **Age is the
wrong instrument for that record**, and giving it a horizon would have been precisely the false
precision the brief forbids.

This is also the §6 trap, and its mirror. The seven relative rules produce dates *derived from the
traveller's trip*; those are emphatically not provenance freshness, and Blocks 3F-C/D/F already own
them. The sumo record's date is neither: it is stored, absolute, and the same for every reader.

---

## 3. Decisions

### Reservation mechanisms — **no `covers`; a derived claim class; one class deliberately unautomated**

| class | members | volatility | horizon |
|---|---|---|---|
| `standing-sales-rule` | `monthly-fixed-release`, `rolling-calendar-month-release`, `rolling-day-release`, `monthly-application-window`, `relative-application-window` (7 records) | **commercial** | **`unknown` — none adopted** |
| `dated-sale-instance` | `fixed-sale-date` (1 record) | **temporal** | **none** |

### Access points — **no `covers`; a derived claim class; no periodic horizon for anything shipped**

| class | members | volatility | horizon |
|---|---|---|---|
| `built-arrival-point` | `visitor-entrance`, `gate`, `reception`, `trailhead`, `road-access`, `general-access` (all 4 records) | **structural** | **none** |
| `served-transit-stop` | `transit-stop` (**0 records today**) | **operational** | **365 days** |

`reception` is deliberately on the structural side: a reception desk belongs to a building, and a
business relocating one is an announced move, not a periodic revision.

---

## 4. Thresholds, one by one

### `served-transit-stop` — **365 days**

- **What can change:** whether a stop is *served* — which route calls there, and whether it still
  does.
- **Why a number is available:** that is a timetable fact, and Japanese operators revise timetables
  on an annual cycle. A check older than one cycle has provably not seen the current one.
- **Reaching the limit means:** the check predates the most recent revision. Nothing more.
- **Not borrowed from `airportLinks`.** §3 of the brief rightly forbids exporting the *value*
  `airportLinks` outside its domain, and this does not: it reuses the constant
  `TIMETABLE_CYCLE_DAYS` after re-making the argument in this domain, and arrives at the same
  rhythm because it is the same rhythm.
- **Recorded honestly:** no shipped record is a `transit-stop`. The branch is decided in advance so
  the first such record cannot silently inherit whichever branch happens to run, and it is exercised
  by constructed records in the tests rather than by the dataset.

### `built-arrival-point` — **no horizon**

- **What can change:** where a gate physically stands, or whether it is an entrance at all.
- **Why no number:** built fabric changes by construction — announced, years long, on no publication
  cycle. This is Block 10's `railLines` argument in the same domain of fact. A calendar cannot tell
  you a gate moved, and the calendar expiring tells you nothing.

### `dated-sale-instance` — **no horizon**

- **What can change:** nothing the record does not already state. It carries its own absolute dates.
- **Why no number:** re-reading the page on a cadence discovers nothing new. What ends this record's
  usefulness is the calendar passing, not our neglect. **Nothing periodic governs it**, which is
  literally what `no-periodic-recheck` means.

### `standing-sales-rule` — **no threshold, and that is the decision**

- **What can change:** the release day, the hour, the lead time, the sales channel, whether there is
  a lottery — any of it, at the operator's discretion.
- **Why no number:** Block 10 derived 365 from an event you can point at — operators publish a
  revised timetable once a year. **Ticketing policy supplies no such event.** A museum may change
  its rule next Tuesday and announce it only by editing the page. There is no cycle, so there is no
  number to derive, and a number derived from nothing would look decided while being invented.
- **Equally not `no-periodic-recheck`.** That state means *relax*, and these are the most volatile
  claims in the dataset. Folding the two together would let an operator's sales policy inherit the
  reassurance owed to concrete and steel.
- **Recorded as debt**, not as a verdict — per §12, a policy that is incomplete but honest.

---

## 5. Schema

### Before → after

| | before | after |
|---|---|---|
| `AccessPointProvenance` | `sourceUrl, sourceEntity, consultedAt, evidence, confidence` | **unchanged** |
| reservation `provenance` | `sourceUrl, sourceEntity, consultedAt, evidence, confidence` | **unchanged** |
| `data/logistics/access-points.json` | 4 records | **unchanged, byte for byte** |
| `data/reservation-mechanisms.json` | 8 records | **unchanged, byte for byte** |
| `SourceFreshnessState` | 3 members | **4** — `recheck-interval-unknown` added |
| freshness input | `covers: ZoneFactArea[]` only | `RecheckHorizon`, a three-way value |

**No data file was touched by this block.** That is not restraint applied carefully — it is
structural: the claim class is derived, so there was nothing to migrate. §10 and §14 ("ningún dato
parece recién verificado por una migración") therefore hold *by construction*, and a test pins all
twelve `consultedAt` values to exactly what Block 10 recorded.

### Why `SourceFreshnessState` grew a fourth member

Block 10 expressed a horizon as `number | null`, because its two answers were "365" and "no rhythm
exists". Block 11 found a third answer `null` cannot carry: *these claims change, and nothing supplies
an interval*. Collapsing it into `null` would have made every ticketing policy report
`no-periodic-recheck` — telling the reader to relax about the most volatile claims Nihon holds.

So the absence of a horizon is split into the two things it can mean, and the caller must say which:

```ts
type RecheckHorizon =
  | { kind: "days"; days: number }   // a real interval from a real rhythm
  | { kind: "none" }                 // nothing periodic governs this claim
  | { kind: "unknown" };             // it does change; no evidence supports an interval
```

Per §11, `no-periodic-recheck` was reused rather than renamed for the two classes it genuinely fits.
The fourth state is **not** a synonym of it — it is the opposite reading — and a test asserts the two
never produce the same wording.

---

## 6. The engine — extended, not duplicated

`freshnessForHorizon(consultedAt, horizon, today)` is now the single place a `consultedAt` becomes a
verdict, for all three systems. Everything Block 10 guaranteed is preserved:

- pure, `today` explicit, no `new Date()` anywhere in either module;
- whole-day, leap-correct, timezone-invariant arithmetic via `civil-date.ts`;
- boundary **inclusive**;
- a malformed, impossible or future date yields `needs-recheck` — **this outranks every horizon,
  `unknown` included**: not knowing when to look again is no reason to accept a date that cannot be
  a date;
- age is never falsehood; nothing is deleted, weakened or downgraded because a date got old;
- nothing derived is stored, and no storage key was added.

`freshnessFor(zoneSource, today)` keeps its exact Block 10 signature and behaviour, reimplemented on
top of the core so the three systems cannot drift into three readings of one date. **Block 10's own
38 tests were not modified and pass unchanged**, which is the evidence that the refactor is
behaviour-preserving.

Per §9, the domain knowledge lives in two small adapters (`accessPointFreshness`,
`reservationMechanismFreshness`) plus four lookup tables. Nothing about gates or tickets crosses into
`source-freshness.ts`; nothing about horizons is re-implemented in the domain module.

---

## 7. `confidence` stays independent

`confidence` in both systems records **how directly the source states the claim** —
`official-explicit` versus a coordinate or window Nihon derived from what the page published
(Kitahanebashi's map target; Nintendo's observed calendar). It is a property of the *inference step*.

It is **not** an authority tier (both values are already official — see §1), **not** coverage, and
**not** freshness. Tests assert both directions explicitly: a recent `official-derived` record and an
eleven-year-old `official-explicit` one are classified identically, and two records differing only in
`confidence` get byte-identical freshness. A source scan asserts the claim-class module never reads
the word `confidence`, `tier`, or `editorial` at all.

---

## 8. Visible changes

**None.** Two decisions, both per §15:

- **Access points have no UI surface whatsoever.** `access-points.ts` is imported by exactly one
  non-test module, `transit.ts`, and only for its *type*. The provenance is routing infrastructure,
  never rendered. There was nothing to reuse and nothing to add.
- **Reservation mechanisms already show provenance** — `Fuente oficial: … · consultada el …` — and
  that line already carries the check date coherently. Adding a badge saying "we don't know how
  often to re-check this" would put Nihon's own process in front of the reader, which is exactly the
  chip-and-badge accumulation §15 forbids. The signal is reused, not multiplied.

Note the consequence, stated plainly: with `unknown` and `none` as the only reservation horizons and
a validator that refuses impossible and future dates, **a reservation record can never reach
`needs-recheck`**. No note can fire. That is a real property of the model, not an oversight.

Only one UI-adjacent line changed: `freshnessAccessibleText` gained the branch the widened union
requires. It is unreachable from a zone source — zone fact areas resolve only to a horizon or to
none — and is written to be correct rather than to silence the compiler: *"puede cambiar sin aviso;
Nihon no fija cada cuánto volver a comprobarla."* It says both halves and neither more.

**No browser audit was added**, per §18: there is no visible change to audit. The ten historical
audits are the evidence, and all ten pass unmodified and byte-identical.

---

## 9. Validators

Block 10 taught the *zone* validator to refuse the two objectively impossible dates and left the
other two validators behind — the handoff called the zone one "the weak outlier", but by 2026-09-18
the outliers were these. Both now match:

- an impossible date (`2026-02-30`, `2026-13-01`, `2027-02-29`, wrong order, unpadded);
- a missing or empty date;
- **a date in the future** — a check dated tomorrow was never made.

`today` is injectable in both, so the rule is testable without a clock. **Age is never an error**, and
here that is load-bearing rather than merely allowed: a standing sales rule has no derivable
interval, so age cannot be made to mean anything.

The rule is about the **check's** date and never about `mechanism.saleDate`: a sale date in the
future is the normal case, validated elsewhere on its own terms. A test asserts the sumo record's
2027 sale date still passes.

**Rules deliberately not added.** §13 lists "coverage ausente", "valor desconocido", "coverage que no
corresponde a ningún campo", "una source que declara cubrir un campo inexistente". All four presuppose
a *stored* coverage field. With coverage derived from an already-closed enum they are not merely
unnecessary — they are **unrepresentable**, which is the stronger guarantee. An unknown `role` or
`mechanism.kind` is already rejected, and a `covers` key smuggled into either provenance is rejected
by the exact-key schemas. All three are exercised as negative cases below.

### Negative cases, run by hand against the real datasets

**32 of 32 behaved correctly.** Each mutates one field of the shipped data.

| case | access points | reservations |
|---|---|---|
| `consultedAt` one day in the future | rejected | rejected |
| `consultedAt` far in the future (2099) | rejected | rejected |
| Feb 30 · month 13 · Feb 29 in a non-leap year | rejected | rejected |
| wrong order (`05-09-2026`) · unpadded (`2026-9-5`) | rejected | rejected |
| empty date · field missing entirely | rejected | rejected |
| future date on the **last** record, not the first | rejected | rejected |
| unknown `role` / unknown `mechanism.kind` (class underivable) | rejected | rejected |
| unknown `confidence` value | rejected | rejected |
| a stray `covers` key in `provenance` | — | rejected |
| a check **eleven years old** | **accepted** | **accepted** (every record) |
| checked exactly today · Feb 29 in a leap year | **accepted** | **accepted** |
| the shipped dataset, unmutated | **accepted** | **accepted** |
| sumo `saleDate` 2027-02-06 in the future | — | **accepted** |

---

## 10. Tests

`app/src/lib/provenance-claim-class.test.ts` — **36 tests**, `today` explicit throughout.

| area | what is pinned |
|---|---|
| correct coverage | all 12 records classified **by name**, with the sumo record's `dated-sale-instance` called out |
| real categories | both maps exhaustive over the schema's roles and kinds; only `transit-stop` is a service claim; only `fixed-sale-date` is an instance |
| categories **with** a horizon | `served-transit-stop` at 364 / 365 / 366 days — inclusive boundary |
| categories **without** | `built-arrival-point` and `dated-sale-instance` at 0 … 4000 days, always `no-periodic-recheck` |
| the unknown category | `standing-sales-rule` never reports a number and never reports `current`, at any age — but its **age is still reported** |
| the two null-horizon states are distinct | different values, different wording, and the unknown one says *puede cambiar* and never *no necesita* |
| `confidence` independence | recent + derived vs old + explicit; records differing only in `confidence` are byte-identical; module never reads the word |
| tier independence | asserted on the shipped shape — neither schema *has* a tier, so a freshness reading one could not be written |
| editorial independence | source scan |
| determinism | same pair → same answer; only `today` moves it; no clock, no storage in the module |
| broken dates outrank every horizon | future / impossible / malformed / unusable `today` → `needs-recheck`, under `none` and `unknown` alike |
| engine shared | the adapters equal the engine called with a horizon; leap-day crossing at 366 vs 365 |
| Block 10 preserved | **no zone source can ever produce the new state**, across three far-future `today`s |
| migration completeness | all 12 `consultedAt` pinned to Block 10's recorded values; neither provenance grew a `covers` key; the class cannot disagree with the record |

### The guards that fail if the contract is broken — proven, not assumed

§17 asks for tests that fail if someone adds provenance without semantic coverage. With coverage
derived, the equivalent guard is stronger and was run:

| broken on purpose | what caught it |
|---|---|
| a new `role` added to `AccessPointRole` with no class | **`tsc` TS2741** — `Property 'helipad' is missing` |
| a `mechanism.kind` silently dropped from the class map | **`tsc` TS2741** — `Property '"rolling-day-release"' is missing` |
| `standing-sales-rule` quietly given the "stable" horizon | **5 tests failed** |
| an invented 180-day threshold for sales rules | **4 tests failed** |

---

## 11. The global contract

> For any fact with provenance in Nihon, do we know what claim it backs, and whether that class of
> claim needs periodic review?

**Yes, for all 35.**

| system | records | how the claim class is known | policy |
|---|---|---|---|
| zone facts | 23 | `covers`, **stored** (Block 7) | 365 d for `airportLinks`; none for `railLines` / `shinkansen` |
| reservation mechanisms | 8 | `mechanism.kind`, **derived** | none for the 1 dated instance; **no interval adopted** for the 7 rules |
| access points | 4 | `role`, **derived** | none for all 4; 365 d reserved for a `transit-stop`, unexercised |

The goal was never that everything carry a threshold. It is that the presence or absence of a policy
is **explicit and explicable**, and that a missing one is recorded as a gap rather than papered over
with a number. Seven records are deliberately unautomated, and this document says exactly why.

---

## 12. Remaining debt

| | |
|---|---|
| **`standing-sales-rule` has no re-check interval** | New, and the honest outcome of this block. Seven records. Closing it needs evidence Nihon does not have: either an operator that publishes a revision cycle, or an observed history of changes to measure. **Do not close it by picking a number.** |
| `served-transit-stop` is decided but unexercised | No shipped record is a `transit-stop`. Tested with constructed records. |
| The `needs-recheck` UI state is still unexercised in a browser | Inherited from Block 10, and now structurally so for reservations: no reservation record can reach it. |
| `unsupported` is still not representable | Deliberate, unchanged: it would be a stored flag written by whoever read the page, not a computed one. |
| Editorial ratings still have no second reader | Inherited from Block 3; only the travellers can close it. |
| Ikebukuro's Narita coach is no longer recorded | Inherited from Block 8. |
| `railLines` / `shinkansen` remain encyclopedia-sourced | Inherited from Block 7; the stable half of the dataset. |
| Four zones inline the same Narita source record | Inherited from Block 7. |
| `.icon-button--small` is a 36px control | Pre-existing, allowed since Block 1. |
| `RC-05` single JS chunk above Vite's advisory | Pre-existing, untouched. |
