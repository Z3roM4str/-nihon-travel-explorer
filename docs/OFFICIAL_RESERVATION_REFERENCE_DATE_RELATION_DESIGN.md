# Phase 3F-G — Official Reservation Reference-Date Relation Design Gate

Status: **design/audit only**  
Base audited: `a006dc3a13bc20953e972ecbd414d5201c681824` (`main` after Phase 3F-F)  
Recommended successor if accepted: **Phase 3F-H — Official Reservation Reference-Date Relation Runtime**

---

## 1. Executive decision

Phase 3F-F now exposes trip-specific official reservation calendar facts safely in the dated planner.

Phase 3F-G approves one narrow next proposition:

> Compare one explicitly disclosed **device/reference civil date** with the already-derived Phase 3F official reservation **calendar date or calendar-date span**, and describe only their civil-date relation.

This gate does **not** approve a current booking state.

The approved relation is deliberately weaker than:

- sale is open;
- sale is closed;
- reservations are open/closed;
- tickets are available;
- inventory remains;
- the user is late;
- the user should buy now;
- a deadline has passed;
- a booking will succeed.

A reference-date relation is calendar context only.

---

## 2. Why another gate is required

Phase 3F mechanisms differ materially from Phase 3D-H editorial lead-time windows.

Phase 3F may contain:

- one release civil date;
- an application-window start/end pair;
- a recorded local clock time;
- a known source timezone such as `Asia/Tokyo`;
- a null/unknown source timezone;
- a fixed event sale date with no clock time.

Phase 3D-O already captures one device-local civil date and compares it with a Phase 3D-H civil-date window, but Phase 3F-E explicitly prohibited reusing that behavior until a separate claim-boundary gate.

The main reason is **time semantics**.

If the device/reference date is `2027-01-10` and Ghibli records `2027-01-10 10:00 Asia/Tokyo`, a date-only comparison can truthfully say that both facts share the same civil date label.

It cannot truthfully say:

> the sale has opened.

That stronger claim requires an instant/timezone contract and a current-time comparison, which this phase does not authorize.

---

## 3. Audited state after Phase 3F-F

The audited `main` already contains:

- Phase 3F structured official mechanism evidence;
- pure Phase 3F date derivation;
- conservative Phase 3F presentation;
- per-day `OfficialReservationDateNotice`;
- exact record/provenance pairing;
- explicit source timezone or unknown-timezone disclosure;
- one existing application-boundary `reservationReferenceDate` captured for Phase 3D-O;
- no Phase 3F current/reference-date relation.

Phase 3F-F intentionally receives no reference-date input today.

That separation remains authoritative until a successor explicitly implements this gate.

---

## 4. Reference-date source

### 4.1 One explicit device/reference civil date

The successor may use the **same already-captured device-local civil date value** currently held by `OrderedSequenceBuilder` as `reservationReferenceDate`.

Sharing that environmental input does **not** merge Phase 3D and Phase 3F evidence domains.

The successor must still keep separate:

- Phase 3D relation evaluator;
- Phase 3F relation evaluator;
- Phase 3D presentation;
- Phase 3F presentation;
- source evidence and provenance.

### 4.2 What may be reused

The concrete device-local civil date value may be reused.

The existing capture boundary `captureDeviceLocalCivilDate` may continue to be the application-level source of that value.

### 4.3 What must not be reused

Phase 3F-H must not call:

- `evaluateReservationWindowReference`;
- `ReservationWindowReferenceRelation`;
- Phase 3D-H lead-time parsing;
- `derivePlaceReservationDateWindow`.

Those names and semantics belong to Phase 3D.

Phase 3F requires its own closed relation type over Phase 3F-D derivations.

---

## 5. Device/reference date is not Japan business date

The existing device reference date remains exactly what Phase 3D-O already says it is:

> the local civil date captured from the user's device/browser.

It is not:

- Japan's current business date;
- the operator's server date;
- an `Asia/Tokyo` date;
- a UTC date;
- an authoritative booking-system clock.

A device in Mexico and an operator in Japan can be on different civil dates for part of the day.

Therefore every visible Phase 3F relation must disclose the exact concrete reference date used, for example:

> Fecha de referencia (tu dispositivo): 12 sept 2026

Do not label the value merely as `hoy` unless a later phase defines a freshness/recapture contract.

---

## 6. Approved relation for a release date

For a Phase 3F-D `release-date` result with:

`releaseDate = YYYY-MM-DD`

the successor may classify only:

1. `before-recorded-release-date`
2. `on-recorded-release-date`
3. `after-recorded-release-date`

Illustrative pure semantics:

- reference < release date -> before;
- reference === release date -> on;
- reference > release date -> after.

### 6.1 Approved copy families

Before:

> La fecha de referencia del dispositivo está antes de la fecha oficial registrada.

Same date:

> La fecha de referencia del dispositivo coincide con la fecha oficial registrada.

After:

> La fecha de referencia del dispositivo está después de la fecha oficial registrada.

### 6.2 Same-date rule is load-bearing

If a release has a clock time, the `on-recorded-release-date` result must **not** infer whether that time has already occurred.

For example:

`10 ene 2027 · 10:00 (Asia/Tokyo)`

plus device/reference date:

`10 ene 2027`

supports only:

> coincide con la fecha oficial registrada.

It does not support:

- sale already opened;
- sale has not opened yet;
- X hours remain;
- booking is currently possible.

---

## 7. Approved relation for an application window

For a Phase 3F-D `application-window` result with:

- `openDate`;
- `closeDate`;

the successor may classify only the reference civil date against the **calendar-date span**:

1. `before-recorded-application-date-span`
2. `within-recorded-application-date-span`
3. `after-recorded-application-date-span`

Both civil-date edges are inclusive for this date-span relation.

### 7.1 Approved copy families

Before:

> La fecha de referencia del dispositivo está antes del tramo de fechas registrado para la solicitud.

Within:

> La fecha de referencia del dispositivo cae dentro del tramo de fechas registrado para la solicitud.

After:

> La fecha de referencia del dispositivo está después del tramo de fechas registrado para la solicitud.

### 7.2 Edge dates with recorded clock times

Katsura records:

- open date + local time;
- close date + local time;
- source timezone currently null.

If the reference civil date equals either edge date, the result may still say that the date lies within the **date span**.

It may not say the application window is currently open or closed.

The clock-time evidence remains visible independently.

---

## 8. Time and timezone boundary

Phase 3F-H is a **civil-date relation only**.

The relation evaluator must not use:

- release/open/close clock times for comparison;
- `Intl.DateTimeFormat` timezone conversion;
- UTC instant generation;
- `Date.parse` of source date/time strings;
- browser timezone offset arithmetic;
- `Asia/Tokyo` conversion;
- inferred timezone for null records.

Known timezone remains source evidence shown by Phase 3F-F.

Unknown timezone remains unknown.

The relation result must be identical regardless of browser timezone when given the same explicit reference civil date and same derivation.

---

## 9. Derivation statuses eligible for assessment

### Eligible

- `release-date`
- `application-window`

### Not assessed

- `no-visit-date`
- `inactive-evidence`
- `not-applicable-to-visit-date`
- `not-derivable`

A neutral `not-applicable-to-visit-date` item may continue to render its existing Phase 3F-F copy, but it must not receive a before/on/after reference relation.

Do not fabricate a relation from mechanism metadata when Phase 3F-D did not produce an applicable calendar fact.

---

## 10. Proposed closed domain result

A successor should use a closed discriminated union, not booleans such as `isOpen`, `isLate` or `shouldBook`.

Illustrative contract:

```ts
type OfficialReservationReferenceRelation =
  | {
      kind: "not-assessed";
      reason:
        | "invalid-reference-date"
        | "derivation-not-date-relatable";
    }
  | {
      kind:
        | "before-recorded-release-date"
        | "on-recorded-release-date"
        | "after-recorded-release-date";
      referenceDate: string;
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      releaseDate: string;
    }
  | {
      kind:
        | "before-recorded-application-date-span"
        | "within-recorded-application-date-span"
        | "after-recorded-application-date-span";
      referenceDate: string;
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      openDate: string;
      closeDate: string;
    };
```

Exact names may differ, but the vocabulary must remain relational and evidence-bounded.

Forbidden domain names include:

- `booking-open`;
- `booking-closed`;
- `sale-open`;
- `sale-closed`;
- `deadline-passed`;
- `book-now`;
- `urgent`;
- `available`;
- `unavailable`;
- `too-late`.

---

## 11. Record identity remains mandatory

Every relation must retain enough identity to prove it belongs to the same:

- record ID;
- place ID;
- scope;

as the Phase 3F derivation/presentation it annotates.

The UI must not attach one record's reference relation to another record or scope.

No place-level "best relation" is allowed.

Multiple scopes remain independent and source-ordered.

---

## 12. Presentation placement

The reference relation belongs inside the existing Phase 3F official item in the dated planner.

It is secondary context beneath the already-visible official calendar fact.

The existing official date/window remains the primary fact.

Recommended structure:

1. place;
2. scope;
3. official release/window fact;
4. optional allocation disclosure;
5. reference-date relation;
6. concrete device/reference date;
7. provenance/source link.

The Phase 3D-H block remains a separate sibling surface.

---

## 13. Reference date visibility

The concrete reference date used for the relation must be visible in the Phase 3F section whenever an assessed relation is shown.

Approved label:

> Fecha de referencia (tu dispositivo): 12 sept 2026

Equivalent wording is acceptable if it preserves:

- this is a reference date;
- it came from the user's device/browser;
- the concrete date used is visible.

Do not show only:

- `hoy`;
- `actualmente`;
- `ahora`.

Those words imply a freshness contract this phase does not provide.

---

## 14. No automatic freshness claim

The current planner captures `reservationReferenceDate` once through component state.

Phase 3F-H may consume that same captured value.

This gate does not authorize:

- midnight timers;
- intervals;
- background recapture;
- focus/visibility listeners;
- notifications;
- service workers;
- scheduled refresh;
- background source checks.

If the planner remains open across midnight, the visible concrete reference date makes the evaluation basis explicit.

A later freshness gate may decide whether automatic recapture is worthwhile.

---

## 15. Phase 3D and Phase 3F remain independent

Sharing a device/reference civil date does not authorize any evidence synthesis.

Forbidden:

- intersecting Phase 3D-H editorial window with Phase 3F official dates;
- choosing an "official winner";
- saying official overrides editorial;
- saying editorial overrides official;
- producing a unified "best booking window";
- changing Phase 3D copy based on Phase 3F;
- changing Phase 3F relation based on Phase 3D.

Each evidence domain derives and presents its own facts.

---

## 16. No action semantics

A relation result must not alter:

- reservation required/recommended/optional semantics;
- allocation semantics;
- lottery semantics;
- itinerary ordering;
- day assignment;
- start date;
- visit start time;
- accommodations;
- transfers.

No relation may trigger:

- reminder;
- notification;
- calendar event;
- purchase link;
- automatic source navigation;
- booking automation.

---

## 17. Persistence boundary

No relation or device/reference date is persisted.

Unchanged:

- `ManualPlanningDraftV7`;
- `nihon.manualPlanningDraft`;
- all localStorage keys;
- evidence JSON;
- places data;
- workbook;
- package manifests.

No V8.

No derived reference status stored in the planning draft.

Reload recomputes from the current captured reference date plus current plan/evidence.

---

## 18. Real pilot expectations

### Ghibli

Official fact:

`2027-01-10 10:00 Asia/Tokyo`

Reference `2027-01-09` -> before.

Reference `2027-01-10` -> same recorded release date only.

Reference `2027-01-11` -> after.

Same-day must never become an open/closed claim.

### Disneyland / DisneySea

The same before/on/after release-date relation is allowed even though source timezone is null.

The UI must continue to disclose unknown source timezone.

The relation compares civil-date labels only; it does not infer Japan time.

### Katsura

For the derived application date span:

`2026-12-01 .. 2027-03-12`

Reference `2026-11-30` -> before date span.

Reference `2026-12-01` -> within date span.

Reference `2027-03-12` -> within date span.

Reference `2027-03-13` -> after date span.

No edge-date result becomes "applications open/closed."

### Osaka Sumo

For an applicable visit, compare against the recorded `2027-02-06` sale civil date.

For a visit outside the recorded event applicability period, Phase 3F-D remains `not-applicable-to-visit-date`; no reference relation is assessed.

---

## 19. Required successor tests

### Domain

1. invalid reference date -> not assessed;
2. no-visit derivation -> not assessed;
3. inactive evidence -> not assessed;
4. not-applicable -> not assessed;
5. not-derivable -> not assessed;
6. release one day before -> before;
7. release exact date -> on;
8. release one day after -> after;
9. release year rollover remains ordinary lexical civil-date comparison after validation;
10. application one day before open -> before span;
11. exact open date -> within span;
12. date strictly between edges -> within span;
13. exact close date -> within span;
14. one day after close -> after span;
15. record/place/scope identity is preserved;
16. no clock-time field changes the result;
17. no timezone field changes the result.

### Source boundary

18. no `Date.now()` in pure evaluator;
19. no ambient `new Date()` in pure evaluator;
20. no `Intl` timezone conversion;
21. no `evaluateReservationWindowReference` reuse;
22. no Phase 3D lead-time parsing;
23. no network;
24. no storage;
25. no mutation.

### Presentation/integration

26. exact concrete device/reference date is visible;
27. release before/on/after copy stays neutral;
28. application before/within/after copy stays neutral;
29. same release date with a recorded time makes no open-state claim;
30. Katsura edge date makes no open/closed-state claim;
31. null timezone remains disclosed;
32. Phase 3D-H and Phase 3F remain separate;
33. multiple scopes remain independent and source-ordered;
34. changing start date/day assignment recomputes the official derivation and then the relation;
35. clearing start date removes assessed relations;
36. reload persists no derived relation;
37. no urgency/countdown/action vocabulary.

---

## 20. Browser audit requirement for Phase 3F-H

Because the proposed successor changes visible planner output, browser validation is mandatory.

Minimum cases:

- Ghibli reference day before release;
- Ghibli reference day exactly equal to release date with 10:00 Asia/Tokyo, proving no open claim;
- Ghibli reference day after release;
- Disney null-timezone same-day relation without JST inference;
- Katsura exact open-date edge;
- Katsura exact close-date edge;
- Sumo applicable release-date relation;
- Sumo not-applicable remains unassessed;
- coexistence with Phase 3D-H relation as separate surfaces;
- day reassignment recomputation;
- start-date clear/reload no stale relation;
- zero console/page errors.

Two consecutive successful browser audits after the final UI/code change are required.

---

## 21. Expected Phase 3F-H scope

Reasonably expected:

- one Phase 3F-specific pure relation module;
- focused relation tests;
- one Phase 3F-specific presentation helper or extension of the existing Phase 3F presentation boundary;
- `OrderedSequenceBuilder.tsx` wiring to pass the existing explicit reference date into Phase 3F;
- focused integration tests;
- neutral CSS only if needed;
- dedicated browser audit update/new script;
- Phase 3F-H execution record;
- ROADMAP update.

Not expected:

- evidence JSON changes;
- workbook changes;
- Phase 3F-D mechanism arithmetic changes;
- Phase 3D-H derivation changes;
- `evaluateReservationWindowReference` changes;
- planning-draft schema change;
- new storage;
- dependencies;
- network code.

---

## 22. Explicitly deferred after Phase 3F-G

Still not approved:

- release-time instant comparison;
- current time in Japan;
- Japan business-date semantics;
- UTC conversion;
- user/Japan timezone conversion;
- booking-open/booking-closed state;
- inventory/availability;
- countdowns or days remaining;
- reminders/notifications;
- automatic midnight refresh;
- route-wide reservation calendar;
- source freshness/expiry;
- automatic source refresh;
- conflict resolution against editorial guidance;
- booking actions;
- cancellation/refund logic;
- live inventory;
- browser automation against operator sites.

---

## 23. Normative contracts for Phase 3F-H

1. The reference input is an explicit valid civil date.
2. The device-local source is visibly disclosed.
3. Phase 3F owns its own relation evaluator.
4. Phase 3D's evaluator is not reused.
5. Release relation vocabulary is before/on/after recorded release date.
6. Application relation vocabulary is before/within/after recorded application date span.
7. Equality with release date means same date only.
8. Equality with application edges counts as within the date span.
9. Clock times are not compared.
10. Source timezone is not used to convert the reference date.
11. Null timezone remains unknown.
12. Known timezone remains evidence only.
13. No instant is generated.
14. No booking-open claim.
15. No booking-closed claim.
16. No availability claim.
17. No inventory claim.
18. No urgency.
19. No countdown.
20. No deadline claim.
21. No recommendation.
22. No purchase action.
23. Concrete reference date is visible with every assessed relation.
24. No implicit automatic-midnight freshness claim.
25. No timer/background refresh.
26. `release-date` is assessable.
27. `application-window` is assessable.
28. `no-visit-date` is not assessed.
29. `inactive-evidence` is not assessed.
30. `not-applicable-to-visit-date` is not assessed.
31. `not-derivable` is not assessed.
32. Record ID stays paired.
33. Place ID stays paired.
34. Scope stays paired.
35. Multiple scopes remain independent.
36. Stable source order remains.
37. No ranking.
38. Phase 3D-H remains a separate sibling evidence domain.
39. No official/editorial intersection.
40. No precedence.
41. No V8.
42. No new storage key.
43. No persistence of relation/reference date.
44. No network.
45. No data mutation.
46. No dependency change.
47. Real Ghibli before/on/after fixtures pass.
48. Real Disney null-timezone fixture stays timezone-unknown.
49. Real Katsura edge-date fixtures remain date-span-only.
50. Real Sumo applicable relation passes.
51. Real Sumo not-applicable remains unassessed.
52. Focused tests pass.
53. existing Phase 3F-D/3F-F tests pass.
54. relevant Phase 3D-O regressions pass unchanged.
55. full Vitest passes.
56. lint passes.
57. build passes.
58. `git diff --check` passes.
59. browser audit passes after final UI/code change.
60. browser audit passes a second consecutive time on the same final code state.

---

## 24. Acceptance gate

Accept Phase 3F-G only if review agrees that:

1. a disclosed device/reference civil date can be compared to recorded Phase 3F civil dates without claiming current booking state;
2. same release date must remain distinct from "sale open";
3. application edge dates must remain date-span relations rather than open/closed states;
4. Phase 3F requires its own evaluator;
5. sharing the explicit reference-date value does not merge Phase 3D and Phase 3F;
6. no source timezone conversion is needed for the approved civil-date proposition;
7. null timezone remains explicitly unknown;
8. clock times remain presentation evidence only;
9. the concrete reference date must be visible;
10. no automatic freshness contract is implied;
11. no persistence/schema/data change is required;
12. the successor requires browser validation.

---

## 25. Conclusion

Phase 3F-G approves **calendar relation, not current booking state**.

The app may eventually say:

- the disclosed device/reference date is before the recorded official release date;
- it is the same recorded release date;
- it is after the recorded official release date;
- it is before/within/after the recorded application **date span**.

The app still may not say:

- sale is open now;
- sale has not opened yet;
- applications are currently open/closed;
- tickets are available;
- the user is late;
- the user should buy;
- a deadline has passed.

**Recommended successor: Phase 3F-H — Official Reservation Reference-Date Relation Runtime. NOT STARTED.**
