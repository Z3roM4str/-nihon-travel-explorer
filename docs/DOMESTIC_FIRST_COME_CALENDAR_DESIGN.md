# Phase 3F-T — Domestic First-Come Calendar & Evidence Design Gate

Status: **design gate only — no runtime/data/schema/test/UI implementation in this phase**

Base: `a15837bf0816b700639a35f11d29c3bc26c9aff5` (`main` after Phase 3F-S / PR #90)

Official PokéPark KANTO source recheck: **2026-09-15**

Design handoff: GitHub Issue #91

---

## 1. Question this gate answers

Phase 3F-S relaxed same-scope cardinality safely, so cardinality no longer blocks a third JP-050
record. Two questions remained, and this gate keeps them strictly separate:

1. **Calendar arithmetic** — how to represent the operator's month-end alignment rule as
   `last-day-of-shifted-month`;
2. **Evidence semantics** — whether current official wording supports emitting a deterministic
   first-come release fact, or whether the route is conditional enough that the record must remain
   deferred or acquire a new semantic qualifier.

The second question is the hard one and was not assumed either way.

---

## 2. Official evidence recheck — 2026-09-15

### 2.1 Domestic ticket information (current primary source)

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index`

First-come schedule, verbatim:

```text
■2か月先の同日までの入場分（1日単位）
○販売期間：2か月前の同日20:00から毎日
※売り切れ次第終了となります。
※毎月末日に2か月後の末日までの入場分が販売されます。
　（例2月28日に4月28日・29日・30日の入場分が販売開始）
```

Drawing schedule, verbatim (already encoded as `RM-JP-050-002`):

```text
■3か月先の入場分（1か月単位）
○ 抽選申込期間：毎月1日～12日
○ 当選のご案内：毎月下旬
○ 当選者決済期限：毎月末日まで
```

Four propositions follow from the first-come block:

- **cadence** — sales run 毎日 ("daily"), in 1日単位 ("per-day units");
- **offset** — sales for an admission date open 2か月前の同日 ("the same date two months prior");
- **time** — 20:00;
- **month-end alignment** — on 毎月末日 ("the last day of each month"), admission through the last
  day two months later opens, with the worked example *Feb 28 → April 28, 29 and 30*.

### 2.2 Timing notice (current, supersedes an earlier time)

`https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index`

Dated 2026年6月16日（火）, titled 2026年7月以降のチケット抽選・先着販売開始時間の変更について.

```text
2026年6月まで　18:00
2026年7月から　20:00
7月25日20:00に9月25日入場分チケットの先着販売を開始
7月1日20:00に10月入場分チケットの抽選申込を開始
今後変更となる可能性がございます
```

Classification, as Issue #91 requires:

| wording | status |
|---|---|
| 20:00 start, from July 2026 | **current rule** (today is 2026-09-15, so in force) |
| 18:00 start, through June 2026 | **superseded** — must not be recorded |
| 「7月25日20:00に9月25日入場分…先着販売を開始」 | **current rule, worked example** |
| 「今後変更となる可能性がございます」 | operator's own change-notice caveat, not a schedule contingency |

The first-come worked example is decisive: admission 2026-09-25 opens 2026-07-25 at 20:00 — exactly
two months earlier, same day of month.

### 2.3 Residence-routing English page (current)

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

```text
We ask guests residing outside of Japan to please use this external website (English only).
Residents of Japan can purchase tickets via PokéPark KANTO's official website (only in Japanese).
Please note that tickets may sell out or become available without prior announcement.
```

The English page does **not** describe the first-come route; it only routes Japan residents to the
Japanese site. So the first-come schedule rests entirely on §2.1 and §2.2, both Japanese primary
sources. No third-party summary was used anywhere in this gate.

### 2.4 What is contingent, and what is not

This is the crux, so it is stated precisely.

**Deterministic** — the *commencement* of the sale. For every admission date there is exactly one
published opening date and time, computable from the visit date by the rule in §3. Two independent
official worked examples confirm it, one for the aligned branch and one for the month-end branch.

**Contingent** — the *continuation* of the sale:

- 「※売り切れ次第終了となります。」 — "sales end once sold out";
- "tickets may sell out or become available without prior announcement" — inventory can also
  *reappear*, so even a sold-out observation is not stable.

**Searched for and NOT found** in current official material:

- any statement that first-come applies to only *some* admission dates;
- any statement that first-come sells only lottery leftovers, remaining seats or 残席;
- any 一部 / 場合により narrowing of which dates get a first-come sale;
- any dependency of the first-come schedule on drawing results or drawing inventory.

The cadence wording is the opposite of narrowing: 毎日 and 1日単位, bounded only by 2か月先の同日まで
and extended by the month-end catch-up. Every admission date receives an opening.

Therefore the contingency in this source bounds **how long tickets last after opening**, never
**whether an opening occurs**. That distinction is what makes the rest of this design possible.

---

## 3. Calendar rule — `last-day-of-shifted-month`

### 3.1 Exact civil semantics

Given visit civil date `V = (y, m, d)` and `monthsBeforeVisit = n`:

1. compute the shifted year/month `S = (y, m) - n months`, by total-month arithmetic, so year
   rollover needs no special case;
2. attempt civil date `(S.year, S.month, d)`;
3. if that date exists in `S`, it **is** the release date — the rule never fires;
4. if it does not exist, the release date is the **real final civil day of `S` itself**;
5. release time and source timezone are carried through untouched, never folded into the date;
6. no `Date` instant, epoch value, UTC conversion or timezone arithmetic is constructed anywhere.

Step 4 is the whole rule. It is deliberately *not* symmetrical with the existing
`first-day-of-next-month`, which leaves `S` and lands on day 1 of `S + 1`.

| rule | lands in | direction vs aligned date | effect on lead time |
|---|---|---|---|
| `first-day-of-next-month` | month `S + 1` | **later** | shortens |
| `last-day-of-shifted-month` | month `S` | **earlier or equal** | never shortens |
| `not-recorded` | — | not derivable | no date emitted |

`last-day-of-shifted-month` therefore never emits a release date later than the naive aligned date.
That is the correct direction for this operator: the month-end catch-up releases *more* dates
*earlier*, it does not delay any.

### 3.2 Equivalence to the operator's published rule

The operator states the rule from the seller's side ("on the last day of month `M`, everything
through the last day of `M + 2` opens"); §3.1 states it from the visit date's side. They are the
same function:

- an unrepresentable shifted day arises only when `S` is shorter than `d`;
- step 4 then lands on the last day of `S`, which is by definition a 毎月末日;
- the visit month is `S + 2`, and `d` cannot exceed the last day of the visit month;
- so every date the operator sweeps into a month-end release is exactly the set step 4 produces,
  and nothing else is produced.

Verified against both official worked examples and the Issue #91 audit cases, using a faithful
replica of the repository's own civil-date helpers:

| visit | branch | derived release | source |
|---|---|---|---|
| 2026-09-25 | aligned | 2026-07-25 | announcement worked example ✓ |
| 2027-04-28 | aligned | 2027-02-28 | ticketInfo worked example ✓ |
| 2027-04-29 | month-end | 2027-02-28 | ticketInfo worked example ✓ |
| 2027-04-30 | month-end | 2027-02-28 | ticketInfo worked example ✓ |
| 2028-04-30 | month-end | 2028-02-29 | leap year |
| 2027-05-31 | **aligned** | 2027-03-31 | rule does not fire — March has 31 days |

The last row matters: Issue #91 lists it among the month-end examples, but 2027-05-31 aligns
cleanly. The successor's tests must assert it takes the *aligned* branch, or they will pass for the
wrong reason.

### 3.3 Boundary behaviour

| visit | `last-day-of-shifted-month` | `first-day-of-next-month` | `not-recorded` |
|---|---|---|---|
| 2027-01-31 | 2026-11-30 | 2026-12-01 | not derivable |
| 2028-01-31 | 2027-11-30 | 2027-12-01 | not derivable |
| 2028-04-30 | 2028-02-29 | 2028-03-01 | not derivable |
| 2100-04-30 | 2100-02-28 | 2100-03-01 | not derivable |
| 2000-04-30 | 2000-02-29 | 2000-03-01 | not derivable |
| 2027-03-31 | 2027-01-31 | 2027-01-31 | 2027-01-31 |
| 2027-12-31 | 2027-10-31 | 2027-10-31 | 2027-10-31 |

28-, 29-, 30- and 31-day months, both leap-year forms, the non-leap century 2100, the leap century
2000, and year rollover are all covered. Month length is never hard-coded: the existing helper
descends from day 31 to day 28 and returns the first date the calendar accepts.

### 3.4 Disney cannot regress

`RM-JP-203-001` and `RM-JP-204-001` declare `missingAlignedDayRule: "first-day-of-next-month"`.

The new value is reachable only from a record that declares it. The three rules agree exactly on the
aligned branch (§3.3, last two rows) and differ only in the fallback, which is selected per record.
Adding a third enum member is therefore behaviour-preserving for every existing record — a
widening of a closed vocabulary, not a change of meaning.

The successor must still pin this: Disney's existing fallback dates must be asserted unchanged, by
value, after the enum grows.

### 3.5 No new calendar helper is required

`lastDayOfShiftedMonth` **already exists** in `reservation-mechanism-date-derivation.ts` and is
already exercised in production by `monthly-application-window` when
`closeDay.kind === "last-day-of-month"`.

So the arithmetic this phase was convened to design is already implemented, already used and
already tested. The successor needs no new date function — only a new branch that calls the existing
one with offset `-monthsBeforeVisit`.

Note the offset difference, which is the easiest place to introduce a silent bug:

```text
first-day-of-next-month  -> firstDayOfShiftedMonth(visit, -monthsBeforeVisit + 1)
last-day-of-shifted-month -> lastDayOfShiftedMonth (visit, -monthsBeforeVisit)
```

### 3.6 Naming

The repository already spells a similar idea `last-day-of-month` in `closeDay.kind`. The new value
keeps the Phase 3F-R/3F-S name `last-day-of-shifted-month` instead, because it sits beside
`first-day-of-next-month`, where the distinction between *the shifted month* and *the next month*
carries the entire meaning. The two live in different enums in different positions and do not
collide.

---

## 4. Runtime audit — D / F / H / J

Issue #91's ten questions, answered against the code at the base SHA.

### 4.1 What exact fields would change if `last-day-of-shifted-month` were added?

Four, and nothing else:

| file | change |
|---|---|
| `app/src/lib/reservation-mechanism-evidence.ts` | the `missingAlignedDayRule` union (line ~39) and its parser guard (line ~183) |
| `scripts/validate-reservation-mechanisms.py` | the `missingAlignedDayRule` membership set (line ~151) |
| `app/src/lib/reservation-mechanism-date-derivation.ts` | one fallback branch in `rolling-calendar-month-release` |
| both JSON catalogs | only if a record actually uses it |

No type outside that union changes. No presentation, relation, calendar, component or CSS file needs
to change for the calendar rule.

**Required shape of the derivation change.** The current code is a two-value negative test:

```ts
if (mechanism.missingAlignedDayRule !== "first-day-of-next-month") {
  return { kind: "not-derivable", ... };
}
releaseDate = firstDayOfShiftedMonth(visitDate, -mechanism.monthsBeforeVisit + 1);
```

With three members that shape is fragile — a fourth member added later would silently fall into the
`first-day-of-next-month` arm. The successor must replace it with an **exhaustive mapping over the
union**, so `not-recorded` still yields `not-derivable` and any future member fails to compile
rather than defaulting.

### 4.2 Does D treat every active rolling release record as deterministically derivable?

Yes, and correctly so. `deriveReservationMechanismDate` returns `release-date` carrying exactly
`releaseDate`, `releaseTimeLocal`, `sourceTimeZone` and `allocation`. It is a claim about **one
recorded opening**, and it says nothing about inventory, availability or sale state — there is no
field in which such a claim could even be expressed.

`not-derivable` already exists for genuinely unrepresentable alignments and is the correct sink for
`not-recorded`.

### 4.3 Would F wording overstate a conditional first-come mechanism?

No. F renders:

```text
Venta registrada para esta visita
<date> · 20:00 (Asia/Tokyo)
Asignación registrada: por orden de solicitud.
```

Every heading in F is built on *registrada* / *registrado* — "recorded". The subject of each
sentence is the official record, not the user's prospects. `allocation: "first-come"` already has
its neutral string, `"Asignación registrada: por orden de solicitud."`, in the existing closed
`ALLOCATION_LABEL` map. **No new copy and no new field is needed in F.**

### 4.4 Would H relation language imply the date definitely applies?

No. H's entire vocabulary is a civil-date comparison:

```text
La fecha de referencia del dispositivo está antes de la fecha oficial registrada.
La fecha de referencia del dispositivo coincide con la fecha oficial registrada.
La fecha de referencia del dispositivo está después de la fecha oficial registrada.
```

The sentence's subject is the device's reference date and its predicate is a date ordering. It never
says the sale is open, that tickets exist, or that the user may buy. H also reads no clock and
performs no timezone conversion.

### 4.5 Would J put a conditional event into chronology as a concrete fact?

J places the record's anchor date into a chronological list. The date *is* concrete — it is the
published opening date. What J must not imply is priority or availability, and its disclaimer
already says so explicitly:

```text
El orden cronológico solo ordena fechas de calendario: no indica prioridad, urgencia ni en qué
orden conviene reservar. No indica disponibilidad ni el estado actual de la venta.
```

J is adequate as written. It also needs no eligibility gate: `eligibleFact` already admits exactly
`release-date` and valid `application-window`, and drops every other derivation kind.

### 4.6 Is provenance alone sufficiently visible? — **the one real gap**

Almost, but not symmetrically. The two Phase 3F surfaces disclaim differently:

- **route-wide** — `No indica disponibilidad ni el estado actual de la venta.` Unconditional, and
  covers both availability and current sale state.
- **per-day** — the only availability-adjacent clause is
  `...la relación con la fecha de referencia compara únicamente fechas de calendario: no considera
  la hora registrada ni la zona horaria de la fuente, y no indica el estado actual de la venta.`

On the per-day surface that caveat is grammatically **scoped to the reference-date relation**, and
the relation renders only when a start date and reference date exist. So a per-day reader with no
start date sees a recorded sale date with **no unconditional availability caveat at all**, and the
word *disponibilidad* never appears on that surface.

For the five existing records this asymmetry is tolerable. For a record whose defining published
qualifier is 「売り切れ次第終了となります」 it is the one place where the product could be read as
promising more than the operator does.

This is a **copy-only** gap. It needs no schema, no field, no new vocabulary and no new element —
only parity with the sentence the route-wide surface already ships.

### 4.7 Can a third same-scope JP-050 record coexist without identity or cardinality changes?

Yes — Phase 3F-S already guarantees it, and this was proven there rather than assumed here. The
active collision group `(JP-050, general-admission)` would hold three members with contexts
`resides-outside-japan`, `resides-in-japan`, `resides-in-japan`. Every member carries a specific
context, so the guard passes; no `placeId + scope + purchaseResidenceContext` uniqueness exists, so
the two `resides-in-japan` members do not clash. Phase 3F-S ships an explicit test for exactly the
three-member single-context case.

`recordId` remains the only identity. **No cardinality, identity or collision change is needed.**

### 4.8 Does the browser UI need a new neutral qualifier?

No new *qualifier construct*. The decision in §5 introduces no conditional semantic, so there is
nothing new to qualify. The only UI work is the §4.6 disclaimer parity sentence.

### 4.9 Can the solution avoid persistence / network / user-state changes?

Yes, entirely. The release date is derived from the planned visit date by pure civil-date
arithmetic. Nothing is stored, fetched, remembered or personalised. No user residence, profile or
eligibility is read, and `purchaseResidenceContext` remains descriptive evidence about the *route*.

### 4.10 What is the smallest successor that is actually justified?

§6.

---

## 5. Design decision

### 5.1 Outcome

**Outcome A — the existing model is sufficient — plus one bounded copy-only disclaimer fix.**

No new evidence field. No new vocabulary beyond the single already-designed enum member
`last-day-of-shifted-month`, which is calendar arithmetic, not semantics.

### 5.2 Why the evidence supports it

The proposition to be recorded is *"the official source states that the sale for this admission date
opens on this date at this time"*. That proposition is true, deterministic for every admission date,
and confirmed by two independent official worked examples. It is not weakened by 売り切れ次第終了,
because that sentence constrains when the sale **ends**, and Nihon records no end for a
`release-date`.

The model's own vocabulary makes the overstatement impossible rather than merely unlikely: a
`release-date` derivation has no field for inventory, availability or sale state, F speaks only of
what is *registrada*, H only compares two civil dates, and J disclaims availability outright.

### 5.3 Why Outcome B would be a mistake here

Outcome B — a structural qualifier separating "conditional" from "guaranteed" release schedules —
was evaluated seriously and rejected on four grounds.

1. **It would misdescribe the source.** The schedule is not conditional. Only post-opening
   availability is, and that is a different predicate from the one the record asserts.

2. **It would be inconsistent the moment it shipped.** `RM-JP-203-001` (Tokyo Disneyland) is
   *already* an active `rolling-calendar-month-release` with `monthsBeforeVisit: 2` whose provenance
   already records *"sales may be suspended when the daily ticket sales limit is reached"* — the same
   sell-out contingency, shipped since Phase 3F-B. A new qualifier would have to mark Disney too, or
   two identical propositions would carry different qualifiers. Marking Disney means retrofitting
   records outside this phase's scope; not marking it means the field is already wrong.

3. **It would drift into forbidden territory.** A field distinguishing "might sell out" from "will
   definitely be purchasable" is a statement about inventory and current sale state. Issue #91
   forbids exactly that, and every neighbouring phase has refused it. Fail-closed vocabularies do
   not help if the vocabulary itself encodes the wrong category.

4. **Provenance already carries it, and is already rendered.** Both surfaces show
   `provenanceText` on every row, so the operator's own 売り切れ次第終了 wording reaches the reader
   through the field designed to carry source wording. §4.6's gap is that one *surface-level*
   sentence is conditionally scoped — not that the information is missing.

### 5.4 Why Outcome C is not required

Deferral would be correct if the opening date were unknowable or genuinely date-dependent. It is
neither: the offset, the time and the month-end rule are all explicitly published, with worked
examples for both branches. Continuing to defer would now be under-recording verified official
evidence, which is its own kind of inaccuracy.

Deferral of the *availability* question, by contrast, is permanent and deliberate: Nihon does not
model it, and this gate does not change that.

### 5.5 What this decision does not authorize

The phrase "Outcome A" must not be read as a general licence. It authorizes exactly §6 and nothing
adjacent — in particular no inventory model, no sale-state model, no sold-out state, no user
residence or eligibility, no ranking, no route recommendation and no automatic route selection.

---

## 6. Successor contract — Phase 3F-U

A later implementation phase, and only such a phase, may change exactly the following.

### 6.1 Schema — one enum member, two files

Add `last-day-of-shifted-month` to `missingAlignedDayRule`:

- `app/src/lib/reservation-mechanism-evidence.ts` — the union and its parser guard;
- `scripts/validate-reservation-mechanisms.py` — the membership set.

The two must stay in lockstep. No other vocabulary changes: not `alignment`, not `scope`, not
`allocation`, not `purchaseResidenceContext`, not `confidence`, not `status`.

### 6.2 Derivation — one exhaustive branch

In `rolling-calendar-month-release`, replace the two-value negative test with an exhaustive mapping
over the three-member union:

| rule | result |
|---|---|
| `first-day-of-next-month` | `firstDayOfShiftedMonth(visit, -monthsBeforeVisit + 1)` |
| `last-day-of-shifted-month` | `lastDayOfShiftedMonth(visit, -monthsBeforeVisit)` |
| `not-recorded` | `not-derivable`, reason `invalid-calendar-alignment` |

Reuse the existing `lastDayOfShiftedMonth`; add no new date helper. Construct no instant, epoch
value or timezone conversion.

### 6.3 Data — at most one new record

`RM-JP-050-003`, subject to its own implementation-day source recheck:

```text
id: RM-JP-050-003
placeId: JP-050
scope: general-admission
purchaseResidenceContext: resides-in-japan
status: active
mechanism:
  kind: rolling-calendar-month-release
  monthsBeforeVisit: 2
  alignment: same-calendar-day
  missingAlignedDayRule: last-day-of-shifted-month
  releaseTimeLocal: "20:00"
  sourceTimeZone: Asia/Tokyo
allocation: first-come
```

Canonical source: `https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index`
Supporting timing source: `https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index`

Provenance requirements:

- carry the published residence-routing proposition, as `RM-JP-050-002` does, so the
  `resides-in-japan` assignment rests on a statement and not on page language, locale, domain or
  source entity;
- carry the 売り切れ次第終了 sell-out wording verbatim in substance, so the operator's own
  qualifier is visible on both surfaces;
- carry the month-end rule and its official worked example;
- record the 20:00 start as the **current** rule and must not record the superseded 18:00;
- **timezone precision:** `Asia/Tokyo` is authorized only if the successor can cite the same JST
  anchoring already used by `RM-JP-050-001`/`RM-JP-050-002` for this operator's 20:00. If that
  recheck finds the domestic page states a bare 20:00 with no timezone the successor must record
  `sourceTimeZone: null` and let the existing presentation render *zona horaria no registrada*.
  Inventing `Asia/Tokyo` from the page's language or domain is forbidden.

Catalog goes **8 → 9**. Both catalogs stay byte-identical. No existing record is modified or merged.

### 6.4 UI — one copy-only disclaimer sentence

Bring the per-day Phase 3F disclaimer to parity with the route-wide one by adding an unconditional
availability clause, so the caveat no longer depends on a reference-date relation being rendered.
The route-wide sentence already in production is the model:

```text
No indica disponibilidad ni el estado actual de la venta.
```

Constraints: text only, inside the existing `official-reservation-date__disclaimer` element. No new
element, class, badge, tag, panel, grouping or taxonomy. No new field reaches the UI. No warning,
success, urgency or priority styling.

### 6.5 Tests the successor must add

Calendar rule: both official worked examples; the aligned branch for 2027-05-31 asserted *as
aligned*; 28/29/30/31-day targets; both leap-year forms; the 2100 non-leap century and the 2000 leap
century; year rollover; and `not-recorded` still yielding `not-derivable`.

Disney regression: `RM-JP-203-001` and `RM-JP-204-001` fallback dates asserted unchanged **by
value** after the enum grows.

Parser / validator: the new member accepted, unknown members still rejected fail-closed, and
TypeScript / Python agreement on all three members.

Composition: nine records; three active `(JP-050, general-admission)` members all with specific
contexts; `RM-JP-050-003` deriving its own `release-date` under its own `recordId`; three distinct
route-wide rows; comparator unchanged; no residence-context sorting, filtering or ranking.

Boundaries: no availability, inventory, sale-state, sold-out, user-residence, eligibility, ranking,
recommendation, persistence or network field introduced.

Browser: the existing Phase 3F-F/H/J/S audits must pass, and the per-day disclaimer parity sentence
must be asserted on a surface rendered **without** a reference date, which is the case §4.6 is
about.

### 6.6 Explicitly still not authorized

Availability, inventory, current-sale-state, sold-out state, lottery-result state, user residence,
nationality, citizenship, visa, country profile, eligibility booleans, automatic residence
filtering, ranking, recommendation, automatic purchase-route selection, reminders, notifications,
calendar export, new grouping UI, planning-draft or localStorage changes, network requests, account
integration, any change to Phase 3F-S collision semantics, and any merging of JP-050 records.

---

## 7. Hostile review of this design

| challenge | outcome |
|---|---|
| 28 / 29 / 30 / 31-day transitions | §3.3 — all four covered; month length read from the calendar, never hard-coded |
| leap years | 2028 and 2000 correct; 2100 correctly non-leap |
| year boundary | 2027-01-31 → 2026-11-30 crosses the year with no special case, because the shift is total-month arithmetic |
| valid aligned dates | rule never fires; all three enum members agree (§3.3) |
| Disney regression | §3.4 — new value reachable only from a record declaring it; successor must still pin the dates by value |
| timezone leakage | date arithmetic is pure Y/M/D; time and timezone are carried as separate recorded fields; §6.3 refuses to infer `Asia/Tokyo` from language or domain |
| current vs superseded source drift | §2.2 — 20:00 is current, 18:00 superseded and must not be recorded; successor repeats the recheck on its own implementation day |
| "some tickets" wording | searched; absent. Cadence wording is 毎日 / 1日単位, which is the opposite of narrowing |
| contingency on lottery outcome or inventory | searched; absent. Drawing and first-come are published as independent schedules |
| sold-out wording | present, and deliberately **not** modelled. It bounds the sale's end; a `release-date` records only its start, and §6.3 puts the operator's wording in provenance |
| confusing mechanism existence with availability | the failure mode this gate was convened for. D has no field for availability, F speaks only of what is *registrada*, H compares civil dates only, J disclaims availability. §4.6 found the one asymmetric surface and §6.4 fixes it with copy |
| confusing residence context with user eligibility | unchanged from Phase 3F-P/Q/S: the copy describes the cited route, never the reader; no user state is introduced |
| duplicate same-context mechanisms | two active `resides-in-japan` records are legitimate under Phase 3F-S and covered by its tests; drawing and first-come are different mechanisms, not duplicates |
| route-calendar duplication | the drawing anchors in visit-month − 3 and first-come in visit-month − 2, so their anchors are always different dates; and Phase 3F-S already proved identical anchors are valid anyway |
| a new field accidentally becoming priority / status / current-state | no new field is created. This is the strongest reason to prefer Outcome A over B |
| is this gate over-reaching by touching UI copy? | §6.4 is one sentence copied from a sibling surface already in production, adding no element, class or field. Omitting it would leave the one identified overstatement path open |

The review changed the design once: an earlier reading treated per-day and route-wide disclaimers as
equivalent. They are not (§4.6), and that finding is the only UI work this gate authorizes.

---

## 8. Divergences from the Issue #91 candidate shape

Recorded so the successor does not copy an invalid record.

1. **`alignment: same-day-of-month` does not exist.** The field is a single-value union whose only
   member is `same-calendar-day`, enforced in both validators. The candidate in §6.3 uses the real
   value. A record using `same-day-of-month` would be rejected fail-closed by the parser and flagged
   by the Python validator.

2. **`last-day-of-shifted-month` needs no new helper.** Issue #91 frames the arithmetic as work to
   be designed; `lastDayOfShiftedMonth` already exists and is already in production use (§3.5). The
   successor's surface is correspondingly smaller.

3. **2027-05-31 is an aligned case, not a month-end case.** Issue #91 lists it among the month-end
   examples; March has 31 days, so the rule does not fire (§3.2).

4. **One UI change is warranted.** Issue #91 anticipates UI work only if a conditional semantic is
   introduced. No such semantic is introduced, yet §4.6 identifies an independent disclaimer
   asymmetry that a first-come record would be the first to expose.

None of these changes the phase's conclusion; all four narrow or correct the successor's scope.

---

## 9. Phase 3F-T normative contracts

1. Phase 3F-T changes documentation only.
2. No runtime, data, schema, test, React, CSS, dependency, persistence or network change.
3. The official recheck of 2026-09-15 found the first-come opening schedule fully specified.
4. The 20:00 start is current; the 18:00 start is superseded and must never be recorded.
5. First-come sales open for every admission date; no official wording narrows them.
6. 売り切れ次第終了 bounds the sale's end, not its start.
7. Availability, inventory and current sale state remain unmodelled, permanently.
8. `last-day-of-shifted-month` semantics are fixed by §3.1 and equivalent to the published rule.
9. The rule lands in the shifted month, not the following month.
10. It never emits a release date later than the naive aligned date.
11. All three `missingAlignedDayRule` members agree on the aligned branch.
12. Disney's `first-day-of-next-month` behaviour is unchanged and must be pinned by value.
13. No new calendar helper is required.
14. The derivation branch must be exhaustive over the union.
15. Outcome A is authorized; Outcome B is rejected with reasons in §5.3.
16. No new evidence field, variant or qualifier is authorized.
17. No vocabulary other than `missingAlignedDayRule` is widened.
18. `recordId` remains the only evidence-record identity.
19. Phase 3F-S collision semantics are unchanged.
20. A third active `(JP-050, general-admission)` record is structurally permitted already.
21. Two active `resides-in-japan` records remain legitimate.
22. No JP-050 record is merged, hidden, ranked, preferred or deduplicated.
23. The successor may add at most one record, `RM-JP-050-003`.
24. Catalog would become 9; both catalogs stay byte-identical.
25. `allocation: first-come` and its UI string already exist and need no change.
26. F needs no new copy for the record itself.
27. H needs no change.
28. J needs no change.
29. The only authorized UI change is the per-day disclaimer parity sentence in §6.4.
30. That change adds no element, class, badge, taxonomy or field.
31. `sourceTimeZone: Asia/Tokyo` requires cited JST anchoring, or `null` must be recorded instead.
32. Residence context is never inferred from language, locale, domain or source entity.
33. Residence context never becomes user profile data or an eligibility decision.
34. The successor must repeat the official recheck on its own implementation day.
35. Material source drift blocks implementation rather than being normalized into this model.
36. Phase 3F-U's scope is exactly §6 and nothing adjacent.
37. Phase 3F-U is not started by this gate.

---

## 10. Successor

Authorized successor, tightly bounded to §6:

**Phase 3F-U — Domestic First-Come Calendar Rule & Evidence Foundation**

It is a runtime/data phase requiring its own implementation-day source recheck, exact-head
validation, hostile review and independent focused review, under the pattern Phases 3F-P/Q/S
established.

Phase 3F-T authorizes the design only. It is not started.
