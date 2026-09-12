# Phase 3F-E — Official Reservation Date Presentation Design Gate

Status: **design/audit only**  
Base audited: `07c38353c0ddb478242a65dac8be52152b9b8b0a` (`main` after Phase 3F-D)  
Recommended successor if accepted: **Phase 3F-F — Official Reservation Date Presentation Runtime**

---

## 1. Decision

Phase 3F-D now provides a validated, pure domain runtime that can derive trip-specific official reservation calendar facts from the Phase 3F evidence catalog.

Phase 3F-E approves the next narrow step:

> Present Phase 3F's already-derived official reservation facts inside the manual planner, next to the day whose visit date produced them, while preserving source identity, source date, scope, time/timezone uncertainty and allocation disclosure.

This gate approves **presentation only**.

It does not approve:

- current-date comparison;
- booking-open / booking-closed claims;
- "already on sale" claims;
- availability or inventory;
- urgency or countdowns;
- reminders or notifications;
- purchase actions;
- automatic booking links/actions;
- timezone conversion;
- Japan-business-date inference;
- source freshness TTL;
- source expiry;
- automatic conflict resolution against Phase 3D editorial guidance;
- recommendation or ranking;
- automatic itinerary changes.

A derived official reservation date remains a **recorded calendar fact for the assigned visit**, not an action signal.

---

## 2. Audited runtime state after Phase 3F-D

The audited `main` contains:

- `app/src/lib/reservation-mechanism-evidence.ts`;
- `app/src/lib/reservation-mechanism-date-derivation.ts`;
- 45 focused repository-native tests across the two Phase 3F-D suites;
- five active official-evidence pilot records in `app/src/data/reservation-mechanisms.json`;
- no Phase 3F consumer in React/UI.

Phase 3F-D derives these result families:

- `release-date`;
- `application-window`;
- `no-visit-date`;
- `inactive-evidence`;
- `not-applicable-to-visit-date`;
- `not-derivable`.

The domain result preserves:

- record ID;
- place ID;
- scope;
- visit date when applicable;
- release/application civil dates;
- recorded local times;
- recorded source timezone, including `null`;
- allocation disclosure.

The source record still owns provenance:

- official source URL;
- source entity;
- `consultedAt`;
- evidence text;
- confidence;
- mechanism applicability bounds.

Phase 3F-E does not reopen any of that arithmetic or parsing.

---

## 3. Existing planner surfaces audited

### 3.1 `OrderedSequenceBuilder.tsx` owns the relevant plan context

The current planner already has:

- canonical route;
- day assignment;
- explicit `startDate`;
- derived per-day civil visit dates;
- `deriveVisitDateForPlace`;
- Phase 3D-H's per-day `ReservationDeadlineNotice`;
- Phase 3D-O's device/reference-date relation;
- independent Feb–Mar, hours, closure and recorded-interval signals.

Therefore it is the first existing UI surface that has all inputs required to call:

`deriveReservationMechanismDatesForPlannedPlace(...)`

without inventing a second visit-date contract.

### 3.2 `ReservationPreparationSection` is not the right surface

The route-wide "Reservas por preparar" section intentionally works before day assignment and before a start date exists.

It has no trip-specific visit civil date.

Phase 3F dates are visit-date-dependent.

Therefore Phase 3F-F must **not** inject derived official dates into that route-wide section.

The route-wide section may continue to describe the existing editorial `Place.reservation.leadTime` signal exactly as before.

### 3.3 `PlaceDetail.tsx` is not the right first surface

`PlaceDetail.tsx` is place-centric, not plan-day-centric.

It does not own:

- the place's assigned plan day;
- the plan start date;
- the strict visit-date eligibility contract.

Showing a trip-specific Phase 3F release date there would require introducing new plan context or a second visit-date interpretation.

Rejected for the first presentation runtime.

### 3.4 Existing Phase 3D-O reference date must remain separate

`OrderedSequenceBuilder.tsx` already captures a device-local `reservationReferenceDate` for the Phase 3D-O editorial-window relation.

Phase 3F-C explicitly prohibited reusing that relation without another design gate because Phase 3F mechanisms have:

- release dates;
- application windows;
- optional local times;
- sometimes-known and sometimes-null source timezones.

Therefore Phase 3F-F must not read:

- `reservationReferenceDate`;
- `captureDeviceLocalCivilDate`;
- `evaluateReservationWindowReference`;
- `ReservationWindowReferenceRelation`;

for official mechanism presentation.

This is a load-bearing separation, not a temporary omission.

---

## 4. Approved placement

The first Phase 3F UI belongs **inside each day card** in the existing manual planner.

Recommended component:

`OfficialReservationDateNotice`

or an equivalent narrowly named component.

It should render as a sibling of `ReservationDeadlineNotice`, not inside it.

Recommended order within the reservation-related area of a day:

1. existing Phase 3D-H editorial advance-guidance window;
2. new Phase 3F official mechanism date/window;
3. existing unrelated day signals continue in their established order.

The exact CSS order may follow the live component structure, but the semantic separation must remain visible.

Approved section heading:

> **Fechas de reserva según fuente oficial**

Equivalent wording is acceptable if it preserves all three ideas:

- these are reservation-related dates;
- they come from an official source record;
- they are recorded/derived facts, not current availability.

---

## 5. Why Phase 3D-H and Phase 3F must not be merged

A place may have both:

- an editorial Phase 3D-H "ventana de anticipación registrada"; and
- an official Phase 3F release date/application window.

They come from different evidence domains.

Phase 3F-F must not calculate or display:

- an intersection;
- a union;
- a "recommended booking period";
- one "best" date;
- a conflict winner;
- "official overrides editorial";
- "editorial overrides official";
- a synthesized deadline.

The two UI blocks may be adjacent, but they must remain independently labelled.

The new official section should include a short neutral boundary statement when Phase 3D-H is also visible:

> Esta fecha/ventana oficial se muestra por separado de la anticipación editorial registrada; Nihon no combina ambas fuentes.

This statement may be section-level rather than repeated for every item.

---

## 6. Record-to-presentation composition

Phase 3F-F should compose each derivation with the **same source record by `recordId`**.

This is required because the presentation needs provenance and, for some statuses, mechanism metadata that the derivation intentionally does not duplicate.

The composition must be one-to-one:

`ReservationMechanismEvidenceRecord + matching ReservationMechanismDateDerivation`

Forbidden:

- pairing a result with another record's source URL;
- sharing provenance across scopes;
- merging two records into one displayed item;
- using a place-level "best source";
- sorting by release date and losing source order.

For a place with multiple records/scopes, render each independently in stable source-data order.

---

## 7. Scope disclosure

The Phase 3F schema deliberately permits multiple scopes per place.

The first presentation runtime should show the scope explicitly for every item so a future park-admission record cannot be mistaken for a workshop or timed-entry record.

Approved Spanish labels:

| Domain scope | UI label |
|---|---|
| `general-admission` | Entrada general |
| `park-admission` | Entrada al parque |
| `guided-visit` | Visita guiada |
| `event-admission` | Entrada al evento |
| `area-timed-entry` | Acceso a área con horario |
| `workshop` | Taller / actividad |
| `other-explicit` | Otro ámbito registrado |

Equivalent concise labels are acceptable.

No scope is "primary."

No scope is visually ranked by importance.

---

## 8. Approved presentation for `release-date`

For a normal `release-date` result, the UI may say:

> **Venta registrada para esta visita:** 10 ene 2027 · 10:00 (Asia/Tokyo)

When the record is a fixed event sale date, more specific wording is allowed:

> **Inicio de venta oficial registrado para este evento:** 6 feb 2027

The wording must remain descriptive.

Forbidden substitutions:

- "Venta abre";
- "Ya estará disponible";
- "Podrás comprar desde";
- "Reserva desde";
- "Compra el";
- "Fecha límite";
- "Último día";
- "Ya puedes comprar".

A release date is not inventory and is not proof of successful purchase.

---

## 9. Time and timezone presentation

### 9.1 Known source timezone

When the derivation records:

`sourceTimeZone = "Asia/Tokyo"`

the UI may display:

> 10:00 (Asia/Tokyo)

It may optionally add a human label such as:

> hora local registrada — Asia/Tokyo

No conversion is performed.

### 9.2 Unknown source timezone

When:

`sourceTimeZone = null`

and a local time exists, the UI must not silently imply Japan time.

Required disclosure family:

> 14:00 · zona horaria no registrada en la evidencia estructurada

or a concise equivalent.

This applies to the current Disney and Katsura pilot records.

The UI must not replace `null` with:

- Asia/Tokyo;
- JST;
- UTC+9;
- device timezone;
- Mexico City time.

### 9.3 No recorded time

When `releaseTimeLocal === null`, show the date without inventing a time.

Do not render:

- 00:00;
- "todo el día";
- local midnight;
- noon;
- an inferred operator opening hour.

---

## 10. Approved presentation for `application-window`

For `application-window`, preserve the two edges independently.

Approved family:

> **Ventana oficial registrada para esta visita:**  
> Inicio: 1 dic 2026 · 05:00 · zona horaria no registrada  
> Cierre: 12 mar 2027 · 23:59 · zona horaria no registrada

The word "cierre" here refers to the **recorded application-window edge**, not current booking state.

To avoid ambiguity, a fuller label is preferable:

> Fin registrado de la ventana de solicitud

The UI must not collapse this into:

- "3 meses de anticipación";
- one generic lead-time range;
- a single deadline;
- a countdown.

---

## 11. Allocation disclosure

Allocation is source disclosure, not a probability or action signal.

Approved labels:

| Allocation | UI disclosure |
|---|---|
| `first-come` | Asignación registrada: por orden de solicitud |
| `drawing` | Asignación registrada: sorteo |
| `lottery-if-oversubscribed` | La fuente indica sorteo si las solicitudes superan el cupo |
| `capacity-limited` | La fuente indica capacidad de venta limitada |
| `not-stated` | omit allocation line |

The first runtime may omit `not-stated` entirely.

Forbidden:

- probability estimates;
- "difícil";
- "fácil";
- "alta demanda";
- "compra cuanto antes";
- success likelihood;
- derived priority.

---

## 12. Provenance presentation

Every visible Phase 3F item must expose provenance compactly.

Minimum:

- source entity;
- concrete `consultedAt` date.

Recommended:

> Fuente oficial: Tokyo Disney Resort · consultada el 12 sep 2026

The source entity may be a normal external link to the already-recorded `sourceUrl`.

That link is provenance navigation, not a booking action.

The application must not:

- fetch the page in the background;
- scrape it;
- revalidate it live;
- claim the page is unchanged;
- describe `consultedAt` as "vigente hasta";
- infer a freshness TTL.

Approved link label:

> Ver fuente oficial

Forbidden link/action labels:

- Comprar;
- Reservar;
- Comprar ahora;
- Abrir venta;
- Ir a checkout.

The first Phase 3F-F runtime does not implement booking actions.

---

## 13. Evidence text

The structured source record contains an English `evidence` sentence.

The first UI does **not** need to dump that entire sentence into every day card.

The required provenance is source entity + consultation date + source link.

The evidence text remains available in the data layer for audit/tests.

A future expandable evidence-details UI would require a separate presentation decision if it materially increases visual density.

---

## 14. Result-status presentation policy

### 14.1 `release-date`

Render.

### 14.2 `application-window`

Render.

### 14.3 `not-applicable-to-visit-date`

Render a neutral informational result **only when the record is active and the planned visit date exists**.

Approved family:

> El registro oficial de venta no aplica a la fecha de visita asignada porque esa fecha queda fuera del periodo del evento registrado.

For a fixed-sale-date record, the UI may also show the recorded event period from the matching source record.

Example:

> Periodo del evento registrado: 14–28 mar 2027.

Forbidden:

- "No puedes ir";
- "Fecha inválida para el viaje";
- "Evento cerrado";
- "No hay entradas";
- automatic rescheduling.

This is only a scope/applicability fact.

### 14.4 `not-derivable`

Do not fabricate a date.

The first runtime should render a restrained evidence-state line:

> Hay un mecanismo oficial registrado, pero con los datos estructurados actuales no se puede derivar una fecha aplicable para esta visita.

The provenance remains visible.

No fallback to Phase 3D, event date, device date or guessed calendar rule.

### 14.5 `inactive-evidence`

Do not render an actionable-looking date.

For the first runtime, omit inactive records from the normal official-date list.

A future evidence-history UI may expose superseded records separately.

### 14.6 `no-visit-date`

Do not render a Phase 3F date item.

The planner already has no valid trip-specific date to ground the derivation.

Do not show an error merely because:

- start date is missing;
- day assignment is invalid;
- the place is not assigned exactly once.

The official-date section appears only when a valid trip-specific proposition can be evaluated for the place.

---

## 15. Current pilot fixtures and required UI meaning

### 15.1 Ghibli Museum — JP-044

Planned visit:

`2027-02-20`

Expected official presentation fact:

> Venta registrada para esta visita: 10 ene 2027 · 10:00 (Asia/Tokyo)

Scope:

> Entrada general

Source:

> Ghibli Museum, Mitaka · consultada 12 sep 2026

No current-date relation.

### 15.2 Tokyo Disneyland — JP-203

Planned visit:

`2027-02-20`

Expected:

> Venta registrada para esta visita: 20 dic 2026 · 14:00 · zona horaria no registrada en la evidencia estructurada

Allocation:

> La fuente indica capacidad de venta limitada.

No inference of JST.

### 15.3 Tokyo DisneySea — JP-204

Planned visit:

`2027-04-30`

Expected:

> Venta registrada para esta visita: 1 mar 2027 · 14:00 · zona horaria no registrada en la evidencia estructurada

The UI does not need to explain the invalid nominal 30 February arithmetic.

That is domain logic, already tested.

### 15.4 Katsura Imperial Villa — JP-077

Planned visit:

`2027-03-15`

Expected:

> Ventana oficial registrada para esta visita:
> Inicio: 1 dic 2026 · 05:00
> Fin registrado: 12 mar 2027 · 23:59

Both times disclose unknown structured timezone.

Allocation:

> La fuente indica sorteo si las solicitudes superan el cupo.

### 15.5 Osaka Grand Sumo — JP-212

Planned visit inside the recorded tournament period:

`2027-03-20`

Expected:

> Inicio de venta oficial registrado para este evento: 6 feb 2027.

No time is invented.

A planned visit on `2027-03-29` instead renders the neutral outside-recorded-event-period state, not the sale date as applicable.

---

## 16. Interaction with `febMar2027`

Phase 3F official mechanism presentation must not read or gate on:

- `place.febMar2027.status`;
- `warning`;
- `action`.

Those are a separate editorial/calendar-confidence axis.

If the surrounding day card already displays a Feb–Mar warning, both may coexist.

The official Phase 3F result is not:

- suppressed;
- recolored;
- downgraded;
- upgraded;

because of `febMar2027`.

No cross-source classifier is introduced.

---

## 17. Interaction with `reservation.required`

Phase 3F-F must not gate display on `Place.reservation.required`.

The official evidence record already names a reservation product/scope.

A Phase 3F official record may be displayed even when the editorial reservation field is:

- required;
- recommended;
- optional;
- unrecognized;
- missing.

The two facts may coexist.

The presentation must not use the Phase 3F date to rewrite the existing required/recommended/optional label.

---

## 18. Interaction with Phase 3D-H

The official section must not call:

- `derivePlaceReservationDateWindow`;
- `evaluateReservationWindowReference`;

to compute its own content.

The only approved shared dependency is the existing visit-date ownership already used by Phase 3F-D.

The Phase 3F-F component may render in the same day card as Phase 3D-H.

That is visual composition, not domain composition.

---

## 19. No current-date relation in Phase 3F-F

Phase 3F-E explicitly rejects current/reference-date comparison for the first UI runtime.

Even though the app already has a device-local reference date for Phase 3D-O, Phase 3F-F must not produce:

- before release;
- release day;
- after release;
- application window open now;
- application window closed now;
- days until release;
- days remaining;
- "already on sale."

Reasons:

1. some records include a local clock time;
2. some record source timezone as `null`;
3. device-local date may differ from Japan civil date;
4. date-only comparison would invite stronger booking-currentness claims;
5. 3F-C explicitly requires a separate claim-boundary design.

A later Phase 3F current-date design gate may revisit this.

It is not authorized here.

---

## 20. No timezone conversion in Phase 3F-F

The first presentation runtime remains civil-date/local-time evidence only.

No conversion to:

- device timezone;
- Mexico City time;
- UTC;
- Japan time when source timezone is null.

No JavaScript `Date` instant is needed to render a Phase 3F item.

Date formatting should reuse timezone-free civil-date display helpers.

Recorded `HH:MM` strings are rendered as recorded.

---

## 21. No route-wide reservation calendar yet

Phase 3F-C deferred a route-wide reservation calendar.

Phase 3F-E continues to defer it.

Why:

- the pilot has only five records;
- dates are tied to different scopes and mechanisms;
- a route-wide calendar would immediately raise ordering/ranking questions;
- sorting by date could imply priority;
- current-date relation is not yet designed.

The first presentation should be local to the day/place whose visit date grounds the fact.

A future calendar/agenda view requires its own design.

---

## 22. No notifications, reminders or automation

The presence of a release/application date does not authorize:

- creating a reminder;
- scheduling a notification;
- adding to calendar;
- monitoring inventory;
- checking the operator website;
- sending purchase prompts.

Those are user-action semantics and require their own gate.

Phase 3F-F is read-only presentation.

---

## 23. Accessibility and visual hierarchy

The official section should be neutral/informational.

It must not use color semantics that imply:

- success;
- failure;
- urgency;
- availability.

Recommended structure:

- section heading;
- place name;
- scope;
- derived date/window;
- optional allocation disclosure;
- provenance;
- neutral disclaimer.

If icons are used, they must not be equivalent to:

- green check = "bookable";
- red error = "missed";
- warning triangle = "urgent."

Existing product typography may be reused.

No animation or countdown.

---

## 24. Suggested presentation helper boundary

Phase 3F-F should not embed all copy logic directly into JSX.

Recommended new module:

`app/src/lib/reservation-mechanism-presentation.ts`

Responsibilities may include:

- scope labels;
- allocation labels;
- presentation-safe date/window descriptions;
- timezone-unknown disclosure;
- result visibility policy;
- provenance label construction.

It must not:

- read the device clock;
- mutate evidence;
- rederive calendar dates;
- rank records;
- fetch sources;
- parse `Place.reservation.leadTime`;
- read `febMar2027`.

The React component then composes:

- the matching evidence record;
- the already-derived Phase 3F result;
- presentation helpers.

---

## 25. Suggested React boundary

Recommended component inside `OrderedSequenceBuilder.tsx`:

`OfficialReservationDateNotice`

Illustrative inputs:

```ts
{
  places: readonly Place[];
  dayAssignment: DayAssignment;
  startDate: string | null;
}
```

It may read the bundled:

`reservationMechanismEvidenceRecords`

and call:

`deriveReservationMechanismDatesForPlannedPlace`

for each place in the day.

Equivalent extraction into a small planning/presentation aggregator is acceptable if it remains read-only and source-pure.

The component does not need:

- `referenceDate`;
- `visitStartTimes`;
- `endDate`;
- Feb–Mar status;
- hours;
- closures;
- transfers;
- accommodation state.

---

## 26. Stable ordering

Within a day:

1. preserve the existing place order;
2. within each place, preserve Phase 3F source-record order;
3. do not sort by release date;
4. do not sort by allocation;
5. do not sort by scope;
6. do not sort by source confidence.

This mirrors Phase 3F-D's no-ranking contract.

---

## 27. Data and persistence

Phase 3F-F must not change:

- `ManualPlanningDraftV7`;
- `nihon.manualPlanningDraft`;
- any localStorage key;
- canonical evidence JSON;
- app parity JSON;
- workbook;
- `places.json`.

All presentation is recomputed from:

- the current manual plan;
- existing bundled Phase 3F evidence.

No derived reservation display state is persisted.

---

## 28. Network boundary

Phase 3F-F does not perform background HTTP requests.

Rendering an ordinary external provenance link is allowed.

No:

- `fetch`;
- XHR;
- scraping;
- source refresh;
- availability check;
- inventory check.

The source link is user-initiated navigation only.

---

## 29. Source currentness boundary

`consultedAt` must be shown as a consultation date, not a validity guarantee.

Approved:

> consultada el 12 sep 2026

Forbidden:

- vigente al 12 sep 2026;
- válida hasta;
- actualizada hoy;
- confirmada para 2027;
- sigue vigente.

The first UI does not compare `consultedAt` to the device date.

Evidence-refresh cadence remains a separate future design.

---

## 30. Forbidden visible vocabulary

Phase 3F-F source-scanning tests should reject, in the new official-reservation presentation path, action/currentness language including at least:

- `ya puedes comprar`;
- `reserva ahora`;
- `compra ahora`;
- `última oportunidad`;
- `se te pasó`;
- `fecha límite`;
- `reservas abiertas`;
- `reservas cerradas`;
- `venta abierta`;
- `venta cerrada`;
- `disponible`;
- `no disponible`;
- `quedan boletos`;
- `te quedan`;
- `urgente`;
- `garantizada`.

Tests may scope the scan to the new presentation module/component instead of banning unrelated existing prose globally.

---

## 31. Required Phase 3F-F tests

A runtime successor should prove at least:

### Presentation helper

1. every scope has an explicit Spanish label;
2. every allocation has a safe disclosure policy;
3. `not-stated` does not invent first-come semantics;
4. known `Asia/Tokyo` renders exactly as recorded;
5. null source timezone is disclosed as unknown, never Japan-inferred;
6. null release time does not invent a clock time;
7. release-date copy is descriptive, not actionable;
8. application-window copy preserves separate edges;
9. provenance label includes source entity;
10. provenance label includes concrete `consultedAt`;
11. source URL remains the matching record's URL;
12. no freshness TTL/currentness claim is generated.

### Real pilot fixtures

13. Ghibli 2027-02-20 shows 2027-01-10 10:00 Asia/Tokyo;
14. Disneyland 2027-02-20 shows 2026-12-20 14:00 with unknown structured timezone;
15. DisneySea 2027-04-30 shows 2027-03-01 14:00 with unknown structured timezone;
16. Katsura 2027-03-15 shows both 2026-12-01 05:00 and 2027-03-12 23:59;
17. Katsura preserves lottery-if-oversubscribed disclosure;
18. Sumo 2027-03-20 shows 2027-02-06 with no invented time;
19. Sumo 2027-03-29 renders the neutral not-applicable state rather than an applicable sale date.

### Integration

20. UI imports Phase 3F evidence and derivation owners rather than reparsing JSON;
21. UI reuses the strict plan visit-date contract through Phase 3F-D;
22. official section renders per day, not route-wide before date assignment;
23. place order is preserved;
24. multiple scopes preserve source order;
25. Phase 3D-H still renders independently;
26. `reservation.required` does not gate official Phase 3F display;
27. `febMar2027` does not gate official Phase 3F display;
28. `visitStartTimes` do not affect official date output;
29. trip `endDate` does not affect official date output;
30. no persistence schema/version changes;
31. no new storage key;
32. no network fetch;
33. no device/reference date is read by the Phase 3F path;
34. no timezone conversion occurs;
35. no result is sorted by release date/priority.

### Browser audit

36. Ghibli official item visibly appears on the correct day for a valid dated plan;
37. Disney item clearly discloses unknown structured timezone;
38. Katsura shows open and close edges distinctly;
39. official-source provenance is visible and the link target is correct;
40. existing Phase 3D-H window remains separately visible when both exist;
41. no visible copy says booking is open/closed/available/urgent;
42. no current-date relation appears in the new Phase 3F section;
43. removing the start date removes trip-specific official-date items without stale residue;
44. moving a place to another day recomputes its Phase 3F date from the new visit date;
45. reloading preserves only the existing manual plan, not derived Phase 3F display state.

---

## 32. Browser audit requirement for Phase 3F-F

Unlike Phase 3F-D, the proposed successor changes visible React/UI.

Therefore browser validation is mandatory before Ready/merge.

Minimum browser audit should exercise:

- at least one Ghibli release-date fixture;
- one Disney null-timezone fixture;
- Katsura application-window fixture;
- Sumo applicable fixture;
- Sumo not-applicable fixture;
- coexistence with an existing Phase 3D-H editorial window if a real/synthetic plan can expose both;
- removal/reassignment recomputation;
- provenance link rendering;
- no stale current-date relation.

Two consecutive successful browser audits after the final code change are recommended, matching the repository's recent hostile-review practice for UI phases.

---

## 33. Expected Phase 3F-F file scope

Reasonably expected:

- `app/src/lib/reservation-mechanism-presentation.ts`;
- `app/src/lib/reservation-mechanism-presentation.test.ts`;
- `app/src/components/OrderedSequenceBuilder.tsx`;
- `app/src/components/OrderedSequenceBuilder.test.ts`;
- relevant stylesheet if the section needs a new class;
- browser audit script only if repository convention requires a new dedicated script;
- `docs/ROADMAP.md`;
- Phase 3F-F execution record.

Not expected:

- Phase 3F evidence JSON changes;
- Python validator changes;
- workbook changes;
- `reservation-mechanism-date-derivation.ts` arithmetic changes;
- `reservation-deadline.ts` changes;
- `reservation-window-reference.ts` changes;
- planning-draft V8;
- new dependencies;
- new storage keys;
- network code.

Any broader runtime scope requires explicit justification.

---

## 34. What Phase 3F-E continues to defer

Still deferred:

- current/reference-date relation for Phase 3F;
- release-time instant conversion;
- Japan business-date semantics;
- Mexico/Japan timezone conversion;
- route-wide reservation calendar;
- source-conflict UI;
- official-vs-editorial precedence;
- evidence freshness/expiry policy;
- source-refresh workflow in the app;
- reminders;
- notifications;
- calendar export;
- booking actions;
- cancellation/refund rules;
- live inventory;
- account/login flows;
- browser automation.

---

## 35. Normative contracts for Phase 3F-F

The successor runtime must satisfy all of the following.

### Ownership and source identity

1. Phase 3F evidence JSON remains the only official-mechanism evidence source.
2. Phase 3F-D remains the owner of calendar derivation.
3. The UI does not duplicate mechanism arithmetic.
4. Every displayed derivation is paired to its own record ID.
5. Every displayed derivation uses its own record provenance.
6. Multiple scopes remain independent.
7. Stable source order is preserved.
8. No ranking is introduced.

### Placement

9. Trip-specific official facts render only where a valid planned visit date is available.
10. The first approved surface is the per-day planner view.
11. No trip-specific Phase 3F date is added to route-wide pre-date "Reservas por preparar."
12. No trip-specific Phase 3F date is added to `PlaceDetail` in this phase.
13. Official Phase 3F presentation is a sibling of Phase 3D-H, not merged into it.

### Copy

14. Release dates are labelled as recorded official sale/release facts.
15. Application-window edges remain distinct.
16. No booking-open claim.
17. No booking-closed claim.
18. No availability claim.
19. No inventory claim.
20. No urgency.
21. No countdown.
22. No recommendation.
23. No purchase instruction.
24. No guarantee.

### Time and timezone

25. Recorded local time is preserved.
26. Null time remains absent.
27. `Asia/Tokyo` is preserved when recorded.
28. Null timezone remains explicitly unknown.
29. No country-based timezone inference.
30. No user/device timezone conversion.
31. No UTC instant generation.
32. No Phase 3F current-date relation.

### Provenance

33. Source entity is visible.
34. Concrete consultation date is visible.
35. Source URL may be exposed as provenance navigation.
36. No background source fetch.
37. `consultedAt` is not treated as expiry.
38. `consultedAt` is not treated as proof of current validity.

### Status handling

39. `release-date` is presentable.
40. `application-window` is presentable.
41. `not-applicable-to-visit-date` may render only neutral applicability copy.
42. `not-derivable` never fabricates a date.
43. `inactive-evidence` never renders as an active date.
44. `no-visit-date` does not create a guessed plan date.

### Orthogonality

45. Phase 3D-H remains independent.
46. `reservation.required` does not gate official derivation display.
47. `febMar2027` does not gate official derivation display.
48. Hours do not affect official reservation dates.
49. Closures do not affect official reservation dates.
50. Visit start times do not affect official reservation dates.
51. Trip end date does not affect official reservation dates.
52. Transfers/accommodation do not affect official reservation dates.

### Persistence and side effects

53. V7 remains unchanged.
54. Existing storage key remains unchanged.
55. No new localStorage key.
56. Derived official display state is not persisted.
57. Evidence records are not mutated.
58. Planning draft is not mutated by presentation.
59. No network fetch.
60. No automation.

### Real pilot

61. JP-044 presentation is correct.
62. JP-203 presentation is correct.
63. JP-204 fallback presentation is correct.
64. JP-077 application-window presentation is correct.
65. JP-212 applicable presentation is correct.
66. JP-212 outside-period presentation is correct.
67. USJ still has no Phase 3F item.
68. Nintendo Museum still has no Phase 3F item.
69. AnimeJapan 2027 still has no Phase 3F item.

### Validation

70. Focused presentation tests pass.
71. Existing Phase 3F-D tests remain unchanged and pass.
72. Relevant Phase 3D reservation regressions pass.
73. Full Vitest passes.
74. Lint passes.
75. Build passes.
76. `git diff --check` passes.
77. Browser audit passes after the final UI change.
78. Browser audit is repeated successfully after the final code state.

---

## 36. Acceptance gate

Accept Phase 3F-E only if review agrees that:

1. the planner day card is the correct first trip-specific surface;
2. route-wide pre-date and place-detail surfaces are intentionally excluded;
3. Phase 3D-H and Phase 3F remain visibly separate evidence domains;
4. multiple official scopes remain separately visible and source-ordered;
5. release dates and application windows can be shown without current availability semantics;
6. null timezone must be disclosed, not inferred;
7. null time must remain absent;
8. allocation can be disclosed without probability/urgency inference;
9. official source entity and consultation date should remain visible;
10. source links are provenance navigation, not booking actions;
11. not-applicable is a neutral scope fact, not a "cannot visit" claim;
12. not-derivable never falls back to guessed dates;
13. superseded evidence is not presented as active;
14. no device/reference date enters Phase 3F-F;
15. no current-date relation is approved;
16. no timezone conversion is approved;
17. no persistence/schema/data change is needed;
18. the successor requires browser validation because it changes visible UI.

---

## 37. Conclusion

Phase 3F-D made trip-specific official reservation dates computable.

Phase 3F-E defines the narrow safe way to make those facts visible.

The product may show:

- Ghibli's recorded release date/time for the planned visit month;
- Disney's recorded release date/time while explicitly preserving unknown structured timezone;
- Katsura's recorded application-window edges and lottery disclosure;
- Osaka Sumo's recorded fixed sale date when the assigned visit lies inside the recorded tournament period;
- source entity, source link and consultation date.

The product still may not say:

- sales are open now;
- sales are closed now;
- tickets are available;
- the user is late;
- the user should buy;
- the booking will succeed.

**Recommended successor: Phase 3F-F — Official Reservation Date Presentation Runtime. NOT STARTED.**
