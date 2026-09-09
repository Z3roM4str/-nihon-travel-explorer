# Reservation Window Reference-Date Design Gate (Phase 3D-N)

**Status: design/audit only. No runtime code, UI, persistence, schema, dataset, dependency, package, or lockfile change is authorized by this document.**

This gate starts a new temporal decision after Phase 3D-M, but it is **not** a successor to Phase 3D-M's refused opening-hours solver. It revisits a different already-shipped axis: reservation lead-time windows from Phase 3D-H.

---

## 0. Executive decision

**APPROVE A NARROW SUCCESSOR, SUBJECT TO THE CONTRACT BELOW.**

Nihon may safely compare one explicit **reference civil date** with Phase 3D-H's already-derived `ReservationDateWindow` and state only whether that reference date is:

1. **before the recorded advance-guidance window**;
2. **within the recorded advance-guidance window**; or
3. **after the recorded advance-guidance window**.

That relation is useful and mechanically derivable without claiming any of the things the current data does not establish.

The result must **not** be presented as:

- booking opening;
- booking deadline;
- inventory or availability;
- a guarantee that booking is possible;
- urgency (`late`, `urgent`, `book now`, `last chance`);
- a reminder or automation trigger;
- a Japan-local release date/time;
- a countdown;
- a stronger interpretation of `reservation.leadTime` than Phase 3D-H already permits.

The exact approved proposition is:

> **Given a valid reference civil date and an already-derived recorded advance-guidance window, where does that reference date fall relative to the two recorded window bounds?**

Nothing stronger is approved.

---

## 1. Why this gate exists

Phase 3D-D classifies `reservation.leadTime` conservatively. Phase 3D-G then audited whether any subset of those records could support deterministic date arithmetic. Phase 3D-H implemented exactly the approved Class A slice: an explicit numeric range over one non-mixed day/week unit.

For an eligible place with a valid assigned visit date, Phase 3D-H now derives:

- `minLeadDays`;
- `maxLeadDays`;
- `farAdvanceDate = visitDate - maxLeadDays`;
- `nearAdvanceDate = visitDate - minLeadDays`;
- a `ReservationDateWindow` carrying those dates and the original raw lead-time text.

The names are deliberately load-bearing: `farAdvanceDate` is **not** "booking opens" and `nearAdvanceDate` is **not** a guaranteed booking deadline. They are the two edges of the **recorded advance-guidance window**.

What the app still does not know is any current/reference date. Every prior Phase 3D runtime module deliberately excludes `Date.now()`, urgency and countdown semantics. The ROADMAP now correctly records that this axis remains unimplemented.

This gate asks whether adding a reference date necessarily creates those stronger claims. It does not, provided the date source and copy remain explicit.

---

## 2. Existing contracts that remain authoritative

### 2.1 Phase 3D-H owns lead-time interpretation

`app/src/lib/reservation-deadline.ts` remains the sole owner of the narrow numeric-window derivation on top of Phase 3D-D's classifier.

Phase 3D-N must not:

- reparse `reservation.leadTime`;
- widen eligibility to month ranges;
- widen eligibility to mixed units;
- infer a count from unit-only values;
- extract digits from a specific mechanism, lottery or release instruction;
- reinterpret `farAdvanceDate`/`nearAdvanceDate` as availability boundaries.

The new relation consumes a `ReservationDateWindow`; it does not manufacture one.

### 2.2 Civil dates remain timezone-free domain values

`app/src/lib/civil-date.ts` owns the `YYYY-MM-DD` civil-date contract. Existing arithmetic uses UTC calendar components only so a chosen civil date never shifts when formatted in another browser timezone.

The relation proposed here is also civil-date arithmetic. It must not convert the visit date or window bounds into instants, timestamps or timezones.

### 2.3 The day-assignment prerequisite remains unchanged

Phase 3D-H derives a window only when its strict visit-date prerequisite succeeds: structurally valid day assignment, valid `startDate`, the place in exactly one day bucket and a valid derived civil visit date.

Phase 3D-N inherits that result. It does not add a partial fallback when Phase 3D-H has no `derived-window`.

### 2.4 Orthogonal axes stay orthogonal

The relation must not read or alter:

- `febMar2027`;
- opening hours;
- closure evidence;
- `bestTime`;
- visit start times;
- recorded-interval fit;
- transfer data;
- hotel/accommodation state;
- reservation availability or inventory.

A weak value on another axis does not change the arithmetic truth of where one civil date lies relative to two other civil dates. Presentation may continue to show independent caveats, but the domain result is not a composition of those axes.

---

## 3. The reference-date contract

The key design choice is to make the clock boundary explicit rather than smuggling an ambient clock into the reservation domain.

### 3.1 Domain input: an explicit civil date

The pure evaluator receives a `referenceDate: string` in the same `YYYY-MM-DD` civil-date vocabulary already used by `civil-date.ts`.

It does **not** call:

- `Date.now()`;
- `new Date()` internally;
- `Intl` to discover a timezone;
- a network time service;
- a Japan-time API.

The reference date is an input, exactly like `visitDate` is an input to Phase 3D-H.

### 3.2 Runtime source: device-local civil date, explicitly labelled

A future UI implementation may capture the browser/device's current local calendar date at the application boundary and pass only the resulting `YYYY-MM-DD` string into the pure evaluator.

That source must be described honestly as the **device/reference date**. It is not "today in Japan" and not the reservation system's business date.

Recommended UI disclosure:

> `Fecha de referencia (tu dispositivo): 2026-09-08`

The date adapter should be injectable/testable. A fixed `Date` supplied by a test must produce the same local calendar components the adapter would read at runtime.

### 3.3 No persistence

The device/reference date is environmental state, not a user-authored planning decision. It must not create `ManualPlanningDraftV4` and must not be stored in `nihon.manualPlanningDraft`.

The relation is recomputed from the current reference date and the current derived reservation window whenever the relevant view is evaluated.

### 3.4 No timer or countdown contract

This phase does not require a midnight timer, background task, interval, notification or countdown. A future implementation may recapture the reference date when the planner/view is opened or naturally re-rendered.

The product must not claim second-by-second or minute-by-minute freshness. This is a date-level planning signal only.

---

## 4. Proposed closed domain result

A successor should expose a closed discriminated union rather than booleans such as `isBookable` or `isUrgent`.

Illustrative contract:

```ts
export type ReservationWindowReferenceRelation =
  | {
      kind: "not-assessed";
      reason: "invalid-reference-date" | "no-derived-window";
    }
  | {
      kind: "before-recorded-window";
      referenceDate: string;
      window: Extract<ReservationDateWindow, { kind: "derived-window" }>;
    }
  | {
      kind: "within-recorded-window";
      referenceDate: string;
      window: Extract<ReservationDateWindow, { kind: "derived-window" }>;
    }
  | {
      kind: "after-recorded-window";
      referenceDate: string;
      window: Extract<ReservationDateWindow, { kind: "derived-window" }>;
    };
```

The exact implementation name may differ, but the vocabulary must remain relational and record-subject.

Forbidden result names include:

- `booking-open`;
- `booking-closed`;
- `deadline-passed`;
- `book-now`;
- `urgent`;
- `too-late`;
- `available` / `unavailable`.

Those names assert facts the source data and this relation do not establish.

---

## 5. Exact arithmetic semantics

For a validated Phase 3D-H `derived-window`:

- `farAdvanceDate <= nearAdvanceDate` by construction because `maxLeadDays >= minLeadDays` and both are subtracted from the same visit date;
- all three dates are civil `YYYY-MM-DD` values;
- equality with either edge counts as **within** the recorded window.

The classification is therefore:

| Condition | Result |
|---|---|
| `referenceDate < farAdvanceDate` | `before-recorded-window` |
| `farAdvanceDate <= referenceDate <= nearAdvanceDate` | `within-recorded-window` |
| `referenceDate > nearAdvanceDate` | `after-recorded-window` |

A successor should centralize civil-date comparison rather than scatter string ordering through UI code. Adding a small pure `compareCivilDates` helper to `civil-date.ts` is acceptable if it validates both inputs and preserves that module's timezone-free contract.

No day-count distance is required for the first implementation. The proposition is position, not "N days until" anything.

---

## 6. Product copy and visual semantics

The UI must continue to render the existing recorded window and raw source text. The reference relation is secondary context, not a replacement.

Approved copy families:

- **Before:** `La fecha de referencia está antes de la ventana de anticipación registrada.`
- **Within:** `La fecha de referencia cae dentro de la ventana de anticipación registrada.`
- **After:** `La fecha de referencia está después de la ventana de anticipación registrada.`

The existing raw evidence remains visible, for example:

> `Dato: «1–2 semanas»`

The visual treatment should be neutral/informational. "Within" must not become a green success state and "after" must not become a red failure state, because neither result says anything about inventory, policy enforcement or whether the user can still reserve.

Explicitly prohibited copy:

- `Ya puedes reservar`;
- `Reserva ahora`;
- `Última oportunidad`;
- `Se te pasó la fecha límite`;
- `Reservas abiertas/cerradas`;
- `Disponible/no disponible`.

---

## 7. Why device-local date is acceptable — and what it does not mean

A browser in Mexico and a booking system in Japan can be on different civil dates for part of the day. This gate does not hide that fact.

The relation remains truthful because it says only where **the disclosed reference date** lies relative to the recorded guidance window. It does not claim that the Japanese operator currently considers itself to be on the same date.

Therefore:

- the source label must remain visible or otherwise unambiguous;
- the result must not be promoted into a release/opening/closing claim;
- no IANA timezone is introduced by this phase;
- no conversion to `Asia/Tokyo` is invented;
- if a future product requires Japanese business-date semantics, that is a separate gate requiring an explicit timezone/instant contract.

---

## 8. Real product reach

Phase 3D-G's audited dataset found a deliberately small Class A slice: explicit numeric ranges over a single day/week unit. Phase 3D-H implemented only that slice and did not broaden it.

Phase 3D-N inherits the same reach exactly. It gains no new eligible places by parsing more aggressively.

The small reach is acceptable because this feature adds genuinely new temporal context to an already-shipped high-value reservation signal without weakening its evidence boundary. The implementation must derive eligibility from the live Phase 3D-H result rather than hardcode a place count or place IDs.

---

## 9. Interaction with changes to the manual plan

The relation is derived, so it follows existing recomputation rules:

- change the route/day assignment such that the visit date disappears -> Phase 3D-H returns no derived window -> relation becomes `not-assessed`;
- change `startDate` -> visit date and window are recomputed -> relation is recomputed;
- remove a place from the route -> no orphan relation is persisted because nothing is persisted;
- change `visitStartTimes` -> no effect;
- change opening-hours/closure/febMar facts -> no effect on the domain result.

The reference relation never mutates planning state.

---

## 10. Testing contract for a successor

A future implementation should prove at least the following.

### Domain

1. invalid reference date -> `not-assessed`;
2. Phase 3D-H `no-visit-date` / `no-window` -> `not-assessed`, never a fabricated relation;
3. one day before `farAdvanceDate` -> before;
4. exactly `farAdvanceDate` -> within;
5. strictly between both bounds -> within;
6. exactly `nearAdvanceDate` -> within;
7. one day after `nearAdvanceDate` -> after;
8. month/year rollover cases;
9. leap-day cases;
10. a same-day future window (`farAdvanceDate === nearAdvanceDate`) remains well-defined and inclusive if the upstream contract ever produces one.

### Clock boundary

11. device-date capture is tested with an injected fixed `Date`, not a test that depends on the real wall clock;
12. no domain function reads `Date.now()` or constructs its own ambient current date;
13. no timezone conversion to Japan is introduced.

### Integration

14. only places with a Phase 3D-H `derived-window` render a relational state;
15. existing raw lead-time text remains visible;
16. no `febMar2027`, opening-hours or closure value changes the domain relation;
17. no persistence schema/version changes;
18. no copy says open/closed/available/deadline/urgent/book-now.

Real-dataset coverage should be derived at test time from the live classifier/window pipeline; no hardcoded eligible-ID list becomes a second source of truth.

---

## 11. Rejected alternatives

### 11.1 Rename `nearAdvanceDate` to booking deadline

Rejected. The source text records advance guidance, not the operator's guaranteed last permitted booking date.

### 11.2 Compute `daysRemaining` / countdown

Rejected for the first successor. It invites urgency semantics and implies a target deadline that the data does not establish. Position relative to the recorded window is sufficient.

### 11.3 Treat "within" as availability

Rejected. Inventory can be exhausted, unreleased, lottery-based, temporarily unavailable or governed by a mechanism the current structured data does not model.

### 11.4 Convert the reference date to Japan automatically

Rejected under the current architecture. The planner has no absolute instant/timezone contract, and a JavaScript browser timezone is not evidence of the operator's release clock.

### 11.5 Widen to month/mixed/specific-mechanism records

Rejected. This would reopen Phase 3D-G/3D-H eligibility rather than answer this gate's narrower question.

### 11.6 Add reminders/notifications now

Rejected. A reminder needs product semantics about what event deserves notification and when. This gate derives no actionable deadline.

---

## 12. Hotel-origin/return modelling remains separate

The ROADMAP's accommodation commute item remains valuable but is not chosen as this phase because the current logistics architecture cannot produce an honest hotel commute yet:

- `day-assignment.ts` explicitly assumes no return-to-hotel or cross-day commute;
- `getBestTransfer()` only resolves pre-recorded directed place-to-place edges;
- `transfer.ts` explicitly refuses to synthesize a transfer from geometry when no edge exists;
- the dataset has no accommodation entity contract;
- live transit remains off.

A future accommodation gate must first define a user accommodation identity/location contract and an honest source for accommodation-to-place transfer evidence. Phase 3D-N does not smuggle that work into reservation timing.

---

## 13. Recommended successor

If this design survives review, recommend a narrowly-scoped implementation phase:

### Phase 3D-O — Reservation Window Reference-Date Relation

Exact scope:

- one pure relation evaluator over `ReservationDateWindow` + explicit civil reference date;
- one testable device-local civil-date adapter at the application boundary;
- neutral per-place presentation next to the existing Phase 3D-H window;
- raw lead-time evidence retained;
- deterministic tests for before/within/after and both inclusive edges;
- no persistence migration;
- no dataset edit;
- no month/mixed/specific-mechanism widening;
- no availability claim;
- no booking-open/deadline claim;
- no urgency/countdown;
- no reminder/automation;
- no IANA timezone or Japan-date inference;
- no Phase 3D-P or later work.

Phase 3D-O is **recommended only**, not started or scheduled by this design document.

---

## 14. Final gate

**Decision: APPROVE the narrow reference-date relation; reject every stronger booking interpretation.**

The new fact is useful because it answers a question Phase 3D-H intentionally left unanswered while preserving Phase 3D-H's evidence semantics:

> `reference date is before / within / after the recorded advance-guidance window`

It never becomes:

> `booking is not open / open / closed`, `you should book now`, `you are late`, or `availability exists`.

That distinction is the safety and correctness boundary of Phase 3D-N.
