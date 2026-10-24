# Phase 3F-C — Trip-Specific Reservation Date Derivation Design Gate

Status: **design/audit only**  
Base audited: `bbeb5daf560257f591ea92e9fb691fe15e65354d` (`main` after Phase 3F-B)  
Recommended successor if accepted: **Phase 3F-D — Trip-Specific Reservation Date Derivation Runtime Foundation**

---

## 1. Decision

Phase 3F-B established a versioned official reservation-mechanism evidence layer.

Phase 3F-C approves the next narrow step:

> Given one validated official reservation-mechanism record and one explicit planned visit civil date, derive only the civil reservation date(s) that follow deterministically from that mechanism. Only an `active` record may produce a normal derived date; a `superseded` record remains explicitly non-current evidence.

This phase does **not** approve:

- current-date comparison;
- booking-open / booking-closed claims;
- availability;
- inventory;
- urgency;
- reminders;
- notifications;
- purchase actions;
- browser automation;
- account/login flows;
- ranking;
- recommendations;
- automatic rescheduling;
- automatic itinerary changes.

A derived reservation date is a calendar fact, not an availability claim.

---

## 2. Why this phase is separate from Phase 3D

Phase 3D-H and Phase 3D-O derive conservative planning facts from the editorial field:

`Place.reservation.leadTime`

Phase 3F derives facts from a different evidence source:

`app/src/data/reservation-mechanisms.json`

These contracts must remain independent.

Phase 3F-C does not:

- reparse `reservation.leadTime`;
- overwrite a Phase 3D-H date window;
- suppress a Phase 3D-H date window;
- merge two different evidence sources into one synthetic range;
- choose which source is "better";
- convert a conflict into a recommendation.

A future presentation layer may show both sources side by side with clear labels.

The domain layer must not silently reconcile them.

---

## 3. Input contract

The future runtime consumes:

1. one validated `ReservationMechanismEvidenceRecord` — active or superseded;
2. one explicit `visitDate: string | null`.

The visit date is a civil date:

```text
YYYY-MM-DD
```

with no time of day and no timezone.

The preferred plan-level source remains the existing Phase 3D-H visit-date contract:

- valid day assignment;
- valid draft `startDate`;
- place belongs to exactly one day;
- visit date = `addCivilDays(startDate, dayIndex)`.

Phase 3F-D should reuse `deriveVisitDateForPlace` or an equivalent single existing owner of that contract.

It must not create a looser second interpretation of plan dates.

---

## 4. No device clock

The derivation core must never call:

- `Date.now()`;
- `new Date()` without an explicit civil-date arithmetic role;
- device-local calendar getters;
- browser timezone APIs;
- network time.

The output depends only on:

- the evidence record;
- the visit civil date.

The same inputs must always produce the same output.

---

## 5. Civil-date arithmetic

Phase 3F-C requires exact **calendar-month** arithmetic in addition to the existing `addCivilDays`.

This is not equivalent to:

- 30 days;
- 60 days;
- 90 days;
- milliseconds;
- average month duration.

Recommended future helper:

`shiftCivilMonth(iso, monthOffset, dayPolicy)`

or a smaller equivalent set of pure helpers.

The helper must follow the existing `civil-date.ts` discipline:

- validate `YYYY-MM-DD`;
- manipulate UTC calendar components only as arithmetic machinery;
- never treat the civil date as a user timezone instant;
- return `null` when the requested proposition cannot be represented safely;
- never silently roll an invalid aligned day into another date unless the **official mechanism itself** specifies the fallback.

This differs intentionally from a generic "clamp to end of month" helper.

Operator-specific fallback semantics belong to the mechanism derivation, not to a global month helper.

---

## 6. Suggested result union

Phase 3F-D may use equivalent names, but the result must remain a closed discriminated union.

Recommended shape:

```ts
type ReservationMechanismDateDerivation =
  | {
      kind: "no-visit-date";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
    }
  | {
      kind: "inactive-evidence";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
    }
  | {
      kind: "not-applicable-to-visit-date";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      visitDate: string;
      reason: "outside-recorded-event-period";
    }
  | {
      kind: "not-derivable";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      visitDate: string;
      reason:
        | "invalid-calendar-alignment"
        | "missing-recorded-applicability";
    }
  | {
      kind: "release-date";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      visitDate: string;
      releaseDate: string;
      releaseTimeLocal: string | null;
      sourceTimeZone: "Asia/Tokyo" | null;
      allocation: ReservationAllocation;
    }
  | {
      kind: "application-window";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      visitDate: string;
      openDate: string;
      openTimeLocal: string | null;
      openSourceTimeZone: "Asia/Tokyo" | null;
      closeDate: string;
      closeTimeLocal: string | null;
      closeSourceTimeZone: "Asia/Tokyo" | null;
      allocation: ReservationAllocation;
    };
```

No result variant may contain:

- `isOpen`;
- `isClosed`;
- `isLate`;
- `isUrgent`;
- `daysRemaining`;
- `shouldBook`;
- `recommendedAction`;
- `availability`;
- `inventory`.

---

## 7. Record identity and provenance

Every result must preserve at least:

- `recordId`;
- `placeId`;
- `scope`.

The derivation does not need to copy the entire provenance object into every result if the caller still has the source record.

However:

- the result must never detach itself semantically from the record that produced it;
- no result may combine dates from two different mechanism records;
- no result may combine provenance from one record with arithmetic from another.

---

## 8. Active vs superseded evidence

Only `status === "active"` may produce a derived reservation date.

A `superseded` record must produce:

```text
inactive-evidence
```

or be excluded by a clearly documented active-record selector before derivation.

It must never produce an actionable-looking date as though it were current evidence.

No automatic "pick newest consultedAt" behaviour is approved.

If multiple active records exist for different scopes, derive each independently.

If invalid data somehow contains conflicting active records for the same place+scope despite the validator, the runtime must not invent a winner.

---

## 9. monthly-fixed-release semantics

Current real fixture:

`RM-JP-044-001` — Ghibli Museum.

Mechanism:

```text
releaseDayOfMonth = 10
target = subsequent-calendar-month
releaseTimeLocal = 10:00
sourceTimeZone = Asia/Tokyo
```

For a visit in calendar month M:

- release month = M minus one calendar month;
- release day = the recorded day of month;
- preserve the recorded local release time and source timezone.

Example:

Visit:

```text
2027-02-20
```

Derived:

```text
releaseDate = 2027-01-10
releaseTimeLocal = 10:00
sourceTimeZone = Asia/Tokyo
```

Another example across year boundary:

Visit:

```text
2027-01-05
```

Derived:

```text
releaseDate = 2026-12-10
```

If a future monthly rule records a day that does not exist in the computed release month, and the mechanism contains no fallback rule:

```text
not-derivable / invalid-calendar-alignment
```

Do not clamp automatically.

---

## 10. rolling-calendar-month-release semantics

Current real fixtures:

- `RM-JP-203-001` — Tokyo Disneyland
- `RM-JP-204-001` — Tokyo DisneySea

Mechanism:

```text
monthsBeforeVisit = 2
alignment = same-calendar-day
missingAlignedDayRule = first-day-of-next-month
releaseTimeLocal = 14:00
sourceTimeZone = null
```

Normal aligned case:

Visit:

```text
2027-02-20
```

Nominal release month:

```text
2026-12
```

Same day exists.

Derived:

```text
releaseDate = 2026-12-20
releaseTimeLocal = 14:00
sourceTimeZone = null
```

The timezone remains `null`.

Do not upgrade it to `Asia/Tokyo` merely because the operator is in Japan.

### Missing aligned-day fallback

Example:

Visit:

```text
2027-04-30
```

Two calendar months earlier is nominally February 2027.

`2027-02-30` does not exist.

The mechanism explicitly says:

```text
first-day-of-next-month
```

Therefore:

```text
releaseDate = 2027-03-01
releaseTimeLocal = 14:00
```

This is an operator-specific fallback.

A generic calendar helper must not perform this fallback automatically for unrelated mechanisms.

If the mechanism instead says:

```text
missingAlignedDayRule = not-recorded
```

and the aligned day does not exist:

```text
not-derivable / invalid-calendar-alignment
```

---

## 11. rolling-day-release semantics

No current five-record pilot row uses this family, but Phase 3F-B's validator already approves the structure.

For:

```text
daysBeforeVisit = N
```

derive exactly:

```text
releaseDate = addCivilDays(visitDate, -N)
```

Example synthetic fixture:

```text
visitDate = 2027-03-15
daysBeforeVisit = 30
releaseDate = 2027-02-13
```

No month arithmetic.

No approximation.

---

## 12. relative-application-window semantics

Current real fixture:

`RM-JP-077-001` — Katsura Imperial Villa.

Open rule:

```text
kind = month-offset-first-day
monthsBeforeVisitMonth = 3
timeLocal = 05:00
sourceTimeZone = null
```

Close rule:

```text
kind = days-before-visit
daysBeforeVisit = 3
timeLocal = 23:59
sourceTimeZone = null
```

For visit:

```text
2027-03-15
```

derive:

```text
openDate = 2026-12-01
openTimeLocal = 05:00

closeDate = 2027-03-12
closeTimeLocal = 23:59
```

Allocation remains:

```text
lottery-if-oversubscribed
```

The derivation must not translate that allocation into:

- guaranteed lottery;
- guaranteed availability;
- first-come;
- expected acceptance probability.

The open and close edges are independent recorded propositions.

Do not replace them with one lead-time range.

---

## 13. fixed-sale-date semantics

Current real fixture:

`RM-JP-212-001` — Grand Sumo Tournament Osaka 2027.

Mechanism:

```text
saleDate = 2027-02-06
appliesToStartDate = 2027-03-14
appliesToEndDate = 2027-03-28
```

The event applicability bounds are inclusive.

Visit:

```text
2027-03-20
```

Derived:

```text
releaseDate = 2027-02-06
```

Visit:

```text
2027-03-14
```

also derives the same sale date.

Visit:

```text
2027-03-28
```

also derives the same sale date.

Visit:

```text
2027-03-29
```

must produce:

```text
not-applicable-to-visit-date
reason = outside-recorded-event-period
```

### Missing applicability bounds

A fixed sale date with no recorded application period must not automatically be assumed to apply to every possible visit date.

If the future data contains missing applicability bounds:

```text
not-derivable / missing-recorded-applicability
```

until a separate design explicitly supports another scope rule.

The current real Sumo record has complete bounds and is unaffected.

---

## 14. Visit-date eligibility

A mechanism derivation requires a valid visit date.

At the plan level:

- if day assignment is invalid;
- if `startDate` is missing;
- if `startDate` is invalid;
- if the place cannot be assigned to exactly one day;
- if civil-date addition fails;

the result must be:

```text
no-visit-date
```

No fallback to:

- trip start date;
- place `bestSeason`;
- `febMar2027`;
- event start date;
- device date;
- "today";
- itinerary bounds alone.

---

## 15. No requirement for a manual visit start time

Phase 3F-C derives booking calendar dates from the **visit civil date**, not the within-day visit clock time.

A missing `visitStartTime` does not block derivation.

A manual `visitStartTime` does not change the date arithmetic.

This phase does not solve opening hours or same-day booking cutoffs.

---

## 16. Timezone semantics

Phase 3F-C preserves time evidence exactly.

If source record says:

```text
sourceTimeZone = Asia/Tokyo
```

the derived time may preserve that label.

If source record says:

```text
sourceTimeZone = null
```

the derived result must also say `null`.

No inference.

No conversion to:

- user timezone;
- device timezone;
- UTC;
- Mexico City time.

No instant is produced.

The pair:

```text
releaseDate = 2027-01-10
releaseTimeLocal = 10:00
sourceTimeZone = Asia/Tokyo
```

is still evidence-oriented local civil information, not an epoch timestamp.

---

## 17. No currentness arithmetic

`consultedAt` is provenance.

It is not:

- an expiry date;
- a freshness TTL;
- proof that the rule remains current forever.

Phase 3F-C must not compare `consultedAt` to:

- device date;
- visit date;
- release date.

A future evidence-refresh policy requires its own design.

---

## 18. Multiple records per place

The data model deliberately allows multiple scopes per place.

Example future shape:

- park admission;
- area timed entry;
- workshop.

Phase 3F-C derives each active record independently.

It does not:

- select one primary record;
- combine scopes;
- suppress a workshop because park admission exists;
- rank by date;
- rank by requiredness.

Recommended function:

```ts
deriveReservationMechanismDatesForPlace(
  records,
  placeId,
  visitDate
): ReservationMechanismDateDerivation[]
```

with stable source-data order.

No sorting by release date unless a later presentation design explicitly approves it.

---

## 19. Relationship to allocation

Allocation is preserved as disclosure.

It does not alter calendar arithmetic.

Examples:

- `capacity-limited` does not shift Disney's release date;
- `lottery-if-oversubscribed` does not shift Katsura's window;
- `not-stated` does not imply first-come.

Do not derive:

- probability;
- recommendation;
- priority;
- urgency.

---

## 20. Relationship to reservation.required

The official mechanism record is independently evidenced.

Phase 3F-C should not require re-reading `Place.reservation.required` to decide whether the official mechanism arithmetic is mathematically derivable.

Why:

- the mechanism record is already scoped to one place and reservation product;
- the editorial `Place.reservation` is a separate evidence source;
- gating official evidence on editorial booleans would create hidden cross-source coupling.

A future UI may show editorial requiredness alongside official mechanism evidence.

The derivation module must remain source-pure.

---

## 21. Relationship to Phase 3D-H

For a place with both:

- a Phase 3D-H editorial window; and
- a Phase 3F official mechanism date;

derive both independently.

Do not compute:

- intersection;
- union;
- "best date";
- replacement;
- precedence.

If the two appear inconsistent, the domain layer exposes the independent results and the source evidence.

A later evidence-conflict design may decide how to present such a case.

---

## 22. Suggested future module boundaries

Recommended new runtime files for Phase 3F-D:

```text
app/src/lib/reservation-mechanism-evidence.ts
app/src/lib/reservation-mechanism-date-derivation.ts
```

Responsibilities:

### reservation-mechanism-evidence.ts

- typed JSON record union;
- parse/validate application-facing records defensively;
- active record selection by place;
- no date arithmetic.

### reservation-mechanism-date-derivation.ts

- pure visit-date-to-reservation-date derivation;
- calendar-month helper(s) if not placed in `civil-date.ts`;
- no React;
- no storage;
- no device clock;
- no network.

A small general month helper may be added to `civil-date.ts` only if it remains proposition-neutral and does not embed Disney/Ghibli fallback semantics.

---

## 23. Suggested future runtime scope

Phase 3F-D should be a **domain runtime foundation**, not UI.

It may add:

- typed evidence parsing;
- pure calendar derivation;
- domain tests;
- real-data fixture tests.

It should not yet modify:

- `OrderedSequenceBuilder.tsx`;
- CSS;
- planning-draft schema;
- localStorage;
- hooks;
- browser automation;
- visible booking copy.

After 3F-D, a separate presentation design gate can decide whether and where these facts belong in the planner.

---

## 24. Real fixtures required for Phase 3F-D

### Fixture A — Ghibli

Record:

`RM-JP-044-001`

Visit:

`2027-02-20`

Expected:

```text
release-date
2027-01-10
10:00
Asia/Tokyo
```

### Fixture B — Ghibli year rollover

Visit:

`2027-01-05`

Expected:

`2026-12-10`

### Fixture C — Disneyland normal alignment

Record:

`RM-JP-203-001`

Visit:

`2027-02-20`

Expected:

```text
2026-12-20
14:00
timezone null
```

### Fixture D — DisneySea missing-date fallback

Record:

`RM-JP-204-001`

Visit:

`2027-04-30`

Nominal:

`2027-02-30` — invalid.

Expected official fallback:

`2027-03-01`

### Fixture E — Katsura

Visit:

`2027-03-15`

Expected:

```text
open  2026-12-01 05:00
close 2027-03-12 23:59
allocation lottery-if-oversubscribed
```

### Fixture F — Sumo inside event

Visit:

`2027-03-20`

Expected:

`releaseDate = 2027-02-06`

### Fixture G — Sumo first event day

Visit:

`2027-03-14`

Expected:

`2027-02-06`

### Fixture H — Sumo last event day

Visit:

`2027-03-28`

Expected:

`2027-02-06`

### Fixture I — Sumo outside event

Visit:

`2027-03-29`

Expected:

`not-applicable-to-visit-date`

### Fixture J — no visit date

Any active record with `visitDate = null`.

Expected:

`no-visit-date`

---

## 25. Calendar edge cases required

Phase 3F-D tests must include at least:

- January → previous December;
- leap-year February;
- non-leap February;
- aligned day exists;
- aligned day missing;
- operator fallback present;
- operator fallback absent;
- valid day 31 in a 31-day release month;
- invalid day 31 in a 30-day release month with no fallback;
- day subtraction across month boundary;
- day subtraction across year boundary.

No DST test is required because no instant or timezone conversion is performed.

---

## 26. Determinism

Given the same:

- evidence record;
- visit date;

the serialized derivation result must be identical.

No nondeterministic fields.

Do not include:

- generated timestamps;
- `evaluatedAt`;
- random IDs;
- current locale;
- browser timezone.

---

## 27. Persistence

All derivations are recomputed.

Do not persist:

- release date;
- application window;
- derivation status;
- selected mechanism;
- derived allocation;
- computed calendar helpers.

Authoritative persistence remains:

```text
ManualPlanningDraftV7
nihon.manualPlanningDraft
```

No V8.

No new storage key.

---

## 28. Data mutation

Phase 3F-D does not modify:

- canonical reservation mechanism data;
- app parity JSON;
- `places.json`;
- workbook;
- provenance;
- consultedAt;
- status.

Runtime parsing is read-only.

---

## 29. No network

No runtime HTTP request.

No test HTTP request.

No source scraping.

No operator-page fetch in the application.

Evidence updates remain an explicit data-maintenance workflow.

---

## 30. Claim boundary for future presentation

Allowed future factual copy, when grounded in a derived result:

> Venta registrada para esta visita: 10 ene 2027, 10:00 (Asia/Tokyo).

> Ventana oficial registrada para esta visita: 1 dic 2026 05:00 – 12 mar 2027 23:59.

> Fecha oficial registrada de inicio de venta para este torneo: 6 feb 2027.

Not approved:

- "Ya puedes comprar".
- "Todavía no abre".
- "Cómpralo ahora".
- "Te quedan 4 días".
- "Ya es tarde".
- "Hay disponibilidad".
- "Quedan boletos".
- "Esta es tu fecha límite segura".
- "La reserva está garantizada".

A release date is not inventory.

A close edge is not proof that inventory survives until that date.

---

## 31. Composition with a future reference date

Phase 3D-O already demonstrates how to compare a **reference civil date** to an evidence-bounded window without calling it availability.

Phase 3F-C deliberately does not reuse that relation yet.

Why:

- Phase 3F mechanisms include release dates and application windows with different semantics;
- some include local clock times;
- some have unknown timezone labels;
- "before/within/after" might be useful, but it requires a separate explicit claim-boundary design.

Do not add a Phase 3F reference-date evaluator inside 3F-D without a new design gate.

---

## 32. Normative contracts for Phase 3F-D

The successor runtime must satisfy all of the following.

### Evidence and parsing

1. The app-facing reservation-mechanism JSON is the sole Phase 3F runtime evidence input.
2. No `Place.reservation.leadTime` parsing occurs.
3. No `Place.reservation.required` gate controls official mechanism derivation.
4. Record IDs are preserved.
5. Place IDs are preserved.
6. Scope is preserved.
7. Allocation is preserved.
8. Superseded evidence never yields a normal derived date.
9. Multiple scopes derive independently.
10. Source-data order is preserved.
11. No ranking is introduced.
12. No current record is chosen by `consultedAt` sorting.

### Visit-date source

13. Invalid day assignment produces no visit date.
14. Missing start date produces no visit date.
15. Invalid start date produces no visit date.
16. Missing place assignment produces no visit date.
17. No fallback to trip start date.
18. No fallback to event date.
19. No fallback to `febMar2027`.
20. No fallback to device date.
21. Manual visit start time is not required.

### Calendar arithmetic

22. Civil dates remain timezone-free calendar dates.
23. Month arithmetic uses calendar months, not fixed day counts.
24. Day arithmetic reuses exact civil-day semantics.
25. Invalid aligned dates do not silently roll.
26. Generic month helpers do not clamp unless their explicit API says so.
27. Operator fallback is applied only when encoded by the mechanism.
28. Year rollover is correct.
29. Leap-year behaviour is correct.
30. Invalid input dates never produce a derived normal result.

### monthly-fixed-release

31. Ghibli February 2027 visit derives 2027-01-10.
32. Ghibli January 2027 visit derives 2026-12-10.
33. Release day comes from evidence.
34. Release time comes from evidence.
35. Source timezone comes from evidence.
36. Missing release-day validity without fallback yields not-derivable.

### rolling-calendar-month-release

37. Disney uses calendar months.
38. Disney same-day alignment is exact.
39. 2027-02-20 derives 2026-12-20.
40. 2027-04-30 derives nominal February 2027 first.
41. Invalid nominal 2027-02-30 triggers only the recorded fallback.
42. The recorded fallback yields 2027-03-01.
43. A `not-recorded` fallback yields not-derivable instead.
44. Disney 14:00 is preserved.
45. Disney timezone null remains null.

### rolling-day-release

46. Exact recorded day count is subtracted.
47. No month conversion is used.
48. Synthetic 30-day fixture 2027-03-15 derives 2027-02-13.

### relative-application-window

49. Open and close edges are derived independently.
50. Katsura 2027-03-15 opens 2026-12-01.
51. Katsura open time is 05:00.
52. Katsura closes 2027-03-12.
53. Katsura close time is 23:59.
54. Katsura timezone null remains null.
55. Lottery disclosure is preserved without probabilistic inference.
56. The result is not collapsed into one lead-time range.

### fixed-sale-date

57. Applicability start is inclusive.
58. Applicability end is inclusive.
59. Sumo 2027-03-14 derives 2027-02-06.
60. Sumo 2027-03-20 derives 2027-02-06.
61. Sumo 2027-03-28 derives 2027-02-06.
62. Sumo 2027-03-29 is not applicable.
63. Missing applicability bounds do not imply universal applicability.
64. No sale time is invented when null.

### Time and timezone

65. No timezone is inferred from country.
66. No timezone is inferred from operator identity.
67. No UTC instant is generated.
68. No user-local conversion occurs.
69. No DST arithmetic occurs.
70. Local time without source timezone remains local-time evidence only.

### Current-date and action boundaries

71. No `Date.now()`.
72. No device-local date capture.
73. No booking-open claim.
74. No booking-closed claim.
75. No urgency.
76. No days remaining.
77. No availability.
78. No inventory.
79. No reminder.
80. No notification.
81. No purchase action.
82. No recommendation.

### Persistence and side effects

83. Derivations are not persisted.
84. V7 remains unchanged.
85. Storage key remains unchanged.
86. No new localStorage key.
87. No network.
88. No mutation of evidence JSON.
89. No mutation of `Place`.
90. No mutation of planning draft.

### Composition

91. Phase 3D-H still derives independently.
92. Phase 3F-D never suppresses Phase 3D-H.
93. Phase 3F-D never intersects official and editorial ranges.
94. Phase 3F-D never creates synthetic precedence.
95. Multiple official scopes are not merged.
96. No result is sorted by "best" date.

### Real data

97. All five Phase 3F-B pilot records parse.
98. JP-044 real fixture passes.
99. JP-203 real fixture passes.
100. JP-204 fallback fixture passes.
101. JP-077 real fixture passes.
102. JP-212 inside-period fixture passes.
103. JP-212 outside-period fixture passes.
104. USJ remains absent and therefore produces no Phase 3F result.
105. Nintendo Museum remains absent and therefore produces no Phase 3F result.
106. AnimeJapan 2027 remains absent and therefore produces no Phase 3F result.

---

## 33. Phase 3F-D validation expectations

The runtime successor should include:

- pure unit tests for evidence parsing;
- pure unit tests for calendar helpers;
- pure unit tests for every mechanism family;
- all real pilot fixtures;
- failure cases;
- full existing test suite;
- lint;
- build;
- `git diff --check`.

No browser audit is required for a domain-only successor with no UI.

If Phase 3F-D changes any visible UI, this gate no longer covers the scope and a separate browser contract is required.

---

## 34. Files Phase 3F-D may reasonably change

Expected:

- `app/src/lib/reservation-mechanism-evidence.ts`
- `app/src/lib/reservation-mechanism-evidence.test.ts`
- `app/src/lib/reservation-mechanism-date-derivation.ts`
- `app/src/lib/reservation-mechanism-date-derivation.test.ts`
- possibly `app/src/lib/civil-date.ts`
- corresponding civil-date tests if a generic calendar-month helper is added
- `docs/ROADMAP.md`

Not expected:

- React components;
- CSS;
- planning-draft schema;
- hooks;
- package manifests;
- data JSON changes;
- workbook;
- storage code.

Any broader change requires justification.

---

## 35. What Phase 3F-C does not decide

Still deferred:

- visible planner placement;
- Spanish copy hierarchy;
- how many scopes to show at once;
- route-wide reservation calendar;
- current-date relation;
- Japan-vs-user timezone conversion;
- notifications;
- automations;
- data refresh cadence;
- source expiry policy;
- source-conflict UI;
- cancellation policies;
- refund policies;
- live inventory;
- booking links/actions.

---

## 36. Acceptance gate

Accept Phase 3F-C only if review agrees that:

1. the derivation is based only on official Phase 3F evidence plus an explicit visit civil date;
2. calendar-month arithmetic is distinct from fixed-day arithmetic;
3. operator-specific missing-date fallback is not generalized;
4. Ghibli derives by previous calendar month + recorded day;
5. Disney derives by exact two-calendar-month alignment plus its recorded fallback;
6. Katsura produces separate open and close civil edges;
7. Sumo fixed sale date is gated by its recorded event period;
8. missing event applicability does not imply universal applicability;
9. superseded evidence cannot produce a normal current derivation;
10. multiple scopes remain independent;
11. timezone labels are preserved, never inferred;
12. no instant or timezone conversion is introduced;
13. no current date enters the derivation;
14. no booking-open/closed/urgency/availability claim is introduced;
15. official mechanism evidence remains independent of Phase 3D editorial lead-time evidence;
16. no derivation is persisted;
17. V7 and storage remain unchanged;
18. Phase 3F-D is domain-only;
19. all 106 normative contracts are implementable without network access;
20. a later presentation/current-date layer still requires its own design gate.

---

## 37. Conclusion

Phase 3F-B provides official structured reservation mechanisms.

Phase 3F-C establishes the exact safe boundary for turning those mechanisms into trip-specific civil dates.

The product may now know:

- **which calendar date** Ghibli tickets are scheduled to release for a planned month;
- **which calendar date** Disney tickets are scheduled to release for a planned visit date;
- **which civil application window** Katsura publishes for a planned visit;
- **which fixed sale date** applies to a planned Sumo tournament visit.

It still may not claim:

- whether sales are open now;
- whether inventory exists;
- whether the user should act;
- whether a booking will succeed.

That separation is intentional.

**Recommended successor: Phase 3F-D — Trip-Specific Reservation Date Derivation Runtime Foundation. NOT STARTED.**
