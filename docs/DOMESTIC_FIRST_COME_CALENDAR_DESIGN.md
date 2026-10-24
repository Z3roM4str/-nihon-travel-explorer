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

The hostile review found a material distinction the first draft missed.

The **current** domestic ticket-information page publishes the two-month first-come calendar
mechanics, including the daily cadence, the 20:00 start and the month-end catch-up. But that same
current page also says:

```text
また、一部チケットを先着方式にて販売いたします。
```

That is a real narrowing statement: **some tickets** are sold first-come. It cannot be normalized
away merely because the schedule itself is expressed daily.

Two official historical notices make the semantic risk concrete. The 2025-12-24 first-come launch
notice states:

```text
抽選販売の状況によっては先着販売を実施しない場合があります。
```

The 2026-01-26 Town Pass notice repeats the same proposition for that ticket type: depending on the
drawing-sales situation, first-come sales may not be conducted.

The current ticket-information page no longer repeats that exact lottery-result contingency, and the
2026-07-14 operator notice says the ticket-information site would be updated on 2026-08-01.
However, no current official source located by this gate says that the old contingency was
**revoked**, that first-come now occurs for **every admission date**, or that 「一部チケット」 means
a deterministic subset that Nihon can identify from the planned visit date alone.

Therefore the evidence supports two different propositions:

1. **calendar proposition — supported:** when a first-come sale is conducted for a covered admission
   date, the operator publishes the two-month same-calendar-day / month-end rule and the current
   20:00 start;
2. **event-existence proposition — not safely supported:** current sources do not prove that a
   first-come sale necessarily occurs for every visit date that the calendar formula can map.

The sell-out wording is a post-opening availability constraint. The 「一部チケット」 wording and the
historical drawing-dependent wording are different: they create uncertainty about whether the
first-come event itself exists for a particular target.

That distinction is decisive. A concrete `release-date` row cannot be emitted safely until
applicability is deterministic.

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

### 4.6 Is provenance alone sufficiently visible?

No, but this is no longer the decisive blocker.

The route-wide surface already disclaims availability unconditionally. The per-day surface scopes
its nearest equivalent to the optional reference-date relation, so the caveat disappears when that
relation is absent. That is a real copy asymmetry.

But a disclaimer cannot repair the stronger problem found in §2.4. If the first-come event itself may
not occur for a target date, rendering a concrete derived `release-date` and then disclaiming
availability still overstates the evidence. Availability and event existence are different
predicates.

The copy gap is therefore **documented but not authorized for implementation by this phase**.

### 4.7 Can a third same-scope JP-050 record coexist without identity or cardinality changes?

Structurally, yes. Phase 3F-S already permits it and `recordId` remains the only evidence-record
identity. Semantically, that is not enough: unresolved applicability evidence blocks
`RM-JP-050-003`.

### 4.8 Does the browser UI need a new neutral qualifier?

No qualifier is authorized. Current evidence does not provide a deterministic rule for whether a
first-come event exists for a visit date, so a qualifier would preserve ambiguity while still
emitting a concrete anchor.

### 4.9 Can the solution avoid persistence / network / user-state changes?

Yes. Nothing in the blocker requires those systems. The correct fail-closed response is to keep the
record deferred.

### 4.10 What is the smallest successor that is actually justified?

No runtime/data successor is justified from the current evidence. The calendar arithmetic is
well-defined (§3), but widening runtime vocabulary solely for a record that remains semantically
blocked would create dead surface area.

---

## 5. Design decision

### 5.1 Outcome

**Outcome C — domestic first-come remains deferred.**

The calendar arithmetic is understood and documented, but current official evidence does not safely
support an active deterministic `release-date` record for every visit date.

### 5.2 Why Outcome A is rejected

Outcome A would require the proposition that, for every relevant admission date, the domestic
first-come sale definitely begins on the derived date at the recorded time.

The current official page does not establish that proposition. It says 「一部チケット」 are sold
first-come, while historical official notices state that first-come could be skipped depending on
drawing-sales conditions. The present omission of that historical sentence is not, by itself, an
explicit revocation.

The schedule therefore tells Nihon **how to calculate an opening when the mechanism applies**, but
not **that it applies to every target date**.

D/F/H/J cannot manufacture that missing applicability proposition. D would emit a concrete
`release-date`; F would render it as a recorded sale date; H could compare it to a reference date;
J could place it in route chronology. Those behaviors are safe only after event existence is known.

### 5.3 Why Outcome B is not justified either

A narrow structural qualifier was considered and rejected.

The missing information is not merely a label such as "conditional" versus "guaranteed". Current
sources do not provide a closed deterministic condition Nihon can evaluate from the planned visit
date. Adding a qualifier would therefore preserve ambiguity while still emitting a concrete date,
and would drift toward the availability/inventory/current-state rules engine Issue #91 forbids.

### 5.4 What remains valid

The following findings survive unchanged:

- 20:00 is the current start time from July 2026; 18:00 is superseded;
- the published month-end calendar arithmetic is coherent;
- `last-day-of-shifted-month` semantics in §3 are correct;
- `lastDayOfShiftedMonth` already exists in runtime;
- 2027-05-31 is aligned, not fallback;
- Phase 3F-S cardinality is not a blocker;
- the per-day disclaimer asymmetry is real, but independent.

### 5.5 What this decision authorizes

Documentation only.

It does **not** authorize widening `missingAlignedDayRule`, changing derivation runtime, adding
`RM-JP-050-003`, changing either catalog, adding a conditional qualifier, changing F/H/J, changing
React/CSS/browser copy, or adding any availability, inventory, sold-out, lottery-result,
user-residence or eligibility model.

---

## 6. Reopening criteria

Domestic first-come implementation may be reconsidered only after a new official-source gate finds
evidence strong enough to make applicability deterministic.

At minimum, one of the following would be required:

1. current official wording explicitly states that first-come sales are conducted for every
   admission date covered by the two-month schedule; or
2. current official wording defines a closed deterministic rule identifying which dates/tickets
   receive first-come sales, such that Nihon can evaluate applicability without inventory, lottery
   results, network state or user-profile data.

If that happens, a new implementation phase may reconsider the already-designed calendar rule and
the possible `RM-JP-050-003` record. It must repeat the official-source recheck on its own day.

Until then, `RM-JP-050-003` remains intentionally absent.

---

## 7. Hostile review of the corrected design

| challenge | outcome |
|---|---|
| 28 / 29 / 30 / 31-day transitions | Calendar rule survives; §3.3 covers all four |
| leap years | 2028 and 2000 correct; 2100 correctly non-leap |
| year boundary | Total-month arithmetic remains sound |
| valid aligned dates | 2027-05-31 correctly remains aligned |
| Disney regression | No runtime change is authorized, so existing behavior is untouched |
| timezone leakage | No runtime/data record is authorized; future use still requires source-supported timezone precision |
| current vs superseded time | 20:00 current; 18:00 superseded |
| "some tickets" wording | **Present in the current official page** as 「一部チケット」; blocks universal applicability |
| contingency on lottery outcome | **Present in official historical notices**; current sources do not explicitly revoke it, so fail closed |
| sold-out wording | Post-opening availability only; not the decisive blocker |
| mechanism existence vs availability | Corrected design separates them; an availability disclaimer cannot prove event existence |
| residence context vs user eligibility | Unchanged; no user state introduced |
| duplicate same-context mechanisms | Structurally allowed after 3F-S, but semantic applicability blocks a third record |
| route-calendar duplication | No new row is emitted |
| new qualifier becoming a rules engine | Avoided by choosing Outcome C |
| per-day disclaimer asymmetry | Real but independent; documented, not authorized here |

The hostile review changed the phase conclusion from **Outcome A** to **Outcome C**.

---

## 8. Divergences from the Issue #91 candidate shape

1. **`alignment: same-day-of-month` does not exist.** The real value is `same-calendar-day`.
2. **`last-day-of-shifted-month` needs no new helper.** `lastDayOfShiftedMonth` already exists.
3. **2027-05-31 is aligned**, not a month-end fallback case.
4. **The candidate record is not authorized.** Current official wording includes 「一部チケット」,
   and historical official notices make first-come occurrence drawing-dependent; current sources do
   not explicitly establish universal deterministic applicability.
5. **The per-day disclaimer gap does not justify implementation.** It is a separate presentation
   asymmetry and cannot cure event-existence uncertainty.

These divergences narrow the executable successor surface to zero.

---

## 9. Phase 3F-T normative contracts

1. Phase 3F-T changes documentation only.
2. No runtime, data, schema, test, React, CSS, dependency, persistence or network change.
3. 20:00 is the current published start time; 18:00 is superseded.
4. The two-month same-calendar-day and month-end calendar arithmetic is verified.
5. `last-day-of-shifted-month` semantics are fixed by §3.
6. `lastDayOfShiftedMonth` already exists; no new helper is required.
7. 2027-05-31 is an aligned case.
8. The current official page says 「一部チケット」 are sold first-come.
9. Historical official notices state that first-come may not be conducted depending on drawing-sales
   conditions.
10. The current omission of that historical sentence is not treated as an explicit revocation.
11. Current evidence therefore does not prove first-come event existence for every visit date.
12. A concrete `release-date` must not be emitted when event existence is not deterministic.
13. Availability/sell-out and event existence remain distinct predicates.
14. Outcome A is rejected.
15. Outcome B is rejected because current evidence supplies no deterministic applicability condition.
16. **Outcome C is authoritative: domestic first-come remains deferred.**
17. `RM-JP-050-003` is not authorized.
18. Catalog cardinality remains 8.
19. `missingAlignedDayRule` is not widened by this phase.
20. No derivation-runtime branch is authorized.
21. Phase 3F-S collision semantics remain unchanged.
22. The per-day availability disclaimer asymmetry is documented but not authorized for implementation
   by this phase.
23. No user residence, eligibility, availability, inventory, sold-out or lottery-result state is
   introduced.
24. A future implementation requires a fresh official-source gate satisfying §6.
25. No Phase 3F-U runtime/data phase is authorized by this design.

---

## 10. Successor

**No implementation successor is authorized.**

The next action, if the project revisits domestic first-come, is a future evidence recheck after the
operator publishes clearer applicability wording. Until then the mechanism remains deliberately
unencoded.

Phase 3F-T closes the design question without starting executable work.
