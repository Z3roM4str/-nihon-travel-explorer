# Phase 3F-I — Route-Wide Official Reservation Calendar Design Gate

Status: **design/audit only**
Base audited: `7c9536ff7128245a71c911504e732ab85f832c7a` (`main` after Phase 3F-H, merge of PR #77)
Recommended successor if accepted: **Phase 3F-J — Route-Wide Official Reservation Calendar Runtime**

This document changes documentation only. It implements no runtime, changes no UI, and does not
start Phase 3F-J.

---

## 1. Executive decision

Phase 3F-F made one official reservation fact visible inside the day card that grounds it. Phase
3F-H added a civil-date relation to an explicitly disclosed device reference date.

Phase 3F-I approves one narrow next proposition:

> Present the Phase 3F official reservation facts **already derived for the current plan** once
> more, gathered into a single route-wide, read-only, chronologically ordered list of the same
> facts, each still bound to the place, planned day and source record it came from.

This is an **aggregated view of existing facts**. Nothing is newly derived, newly claimed, or newly
ranked.

The surface is **chronology-only**: it contains exactly those official facts that have a valid,
placeable civil date, and nothing else. A result with no applicable official date has no route-wide
representation at all — it keeps the per-day Phase 3F-F surface it already has. See §12 for the full
policy and its rationale.

The approved surface is deliberately weaker than:

- a booking calendar;
- a to-do list;
- a priority list;
- a preparation schedule;
- a deadline tracker;
- an availability view;
- a reminder system;
- a calendar export.

A chronological list of recorded dates is a reading order, not an instruction.

---

## 2. Why this gate is now possible

Phase 3F-E (`OFFICIAL_RESERVATION_DATE_PRESENTATION_DESIGN.md` §21) deferred a route-wide calendar
for five stated reasons. Each is re-audited here against the real repository:

| Phase 3F-E's reason | State at this base |
| --- | --- |
| "the pilot has only five records" | Still five. Unchanged — but see §2.1: this is an argument about *value*, not about safety, and it is now answered. |
| "dates are tied to different scopes and mechanisms" | True and permanent. Answered by keeping scope + record identity on every item (§9) and never merging records (§10). |
| "a route-wide calendar would immediately raise ordering/ranking questions" | This gate answers them: a fixed, deterministic, four-key ordering contract (§8) with an explicit "order is not priority" declaration. |
| "sorting by date could imply priority" | Answered by §8.3: the ordering is declared non-semantic in the contract, in the copy, and in the tests. |
| "current-date relation is not yet designed" | Now designed *and* shipped: Phase 3F-G/3F-H. §11 reuses it verbatim rather than inventing a second one. |

### 2.1 The value argument

Five records is not an argument against the surface. The relevant number is not how many records
exist in the catalog but how many *land in one plan on different civil dates*, which is already up
to five across four mechanism families, and those dates can sit months apart and out of plan order.

A concrete worked plan (§25.6) produces this chronological sequence:

```
2026-12-01  Katsura window (Día 2, visit 15 mar 2027)
2027-01-17  Disneyland     (Día 4, visit 17 mar 2027)
2027-02-06  Osaka Sumo     (Día 1, visit 14 mar 2027)
2027-02-10  Ghibli         (Día 3, visit 16 mar 2027)
```

The plan order (Sumo, Katsura, Ghibli, Disneyland) and the official-date order are completely
different. Today the reader can only recover that by opening four separate day cards and mentally
sorting. That is the entire value proposition, and it needs no new claim to deliver.

### 2.2 What has *not* changed

Every boundary Phase 3F-A through 3F-H established stays exactly where it is. This gate adds a
second *view* of facts that already exist, not a second *source of truth*.

---

## 3. Audited state at this base

### 3.1 Documentation audited

- `OFFICIAL_RESERVATION_MECHANISM_EVIDENCE_DESIGN.md` (3F-A)
- `RESERVATION_MECHANISM_EVIDENCE.md` (3F-B)
- `TRIP_SPECIFIC_RESERVATION_DATE_DERIVATION_DESIGN.md` (3F-C)
- `TRIP_SPECIFIC_RESERVATION_DATE_DERIVATION_RUNTIME.md` (3F-D)
- `OFFICIAL_RESERVATION_DATE_PRESENTATION_DESIGN.md` (3F-E)
- `OFFICIAL_RESERVATION_DATE_PRESENTATION_RUNTIME.md` (3F-F)
- `OFFICIAL_RESERVATION_REFERENCE_DATE_RELATION_DESIGN.md` (3F-G)
- `OFFICIAL_RESERVATION_REFERENCE_DATE_RELATION_RUNTIME.md` (3F-H)
- `RESERVATION_DEADLINE_DESIGN.md` (Phase 3D-G, for the editorial surface boundary)
- `ROADMAP.md`

### 3.2 Runtime audited

- `app/src/lib/reservation-mechanism-evidence.ts`
- `app/src/lib/reservation-mechanism-date-derivation.ts`
- `app/src/lib/reservation-mechanism-presentation.ts`
- `app/src/lib/reservation-mechanism-reference-date.ts`
- `app/src/lib/reservation-mechanism-reference-date-presentation.ts`
- `app/src/lib/reservation-planning.ts`
- `app/src/lib/day-assignment.ts`, `app/src/lib/reservation-deadline.ts` (visit-date owner only)
- `app/src/components/OrderedSequenceBuilder.tsx`

### 3.3 Facts established by that audit

These are load-bearing for the rest of this document and were read, not assumed:

1. `reservationMechanismEvidenceRecords` is a frozen-order array parsed once from the bundled
   five-record pilot. Its array order is a stable, deterministic **source-record order**.
2. `deriveReservationMechanismDatesForPlace` filters that array by `placeId` **in array order**, so
   per-place multi-scope order is already deterministic and already preserved by Phase 3F-F.
3. `deriveReservationMechanismDatesForPlannedPlace` derives the visit date through the single
   existing owner `deriveVisitDateForPlace(dayAssignment, startDate, placeId)`, which returns `null`
   unless `dayAssignment.valid`, `startDate` is a valid civil date, and the place is in some bucket.
   The visit date is `startDate + dayIndex`.
4. `ReservationMechanismDateDerivation` already carries `recordId`, `placeId`, `scope` on every
   variant, and `visitDate` on every variant except `no-visit-date` / `inactive-evidence`.
5. `OfficialReservationDatePresentation` carries `recordId`, `placeId`, `scope`, `scopeLabel`,
   `heading`, `detailLines`, `allocationText`, `provenanceText`, `sourceUrl`. It returns `null` for
   `inactive-evidence` and `no-visit-date`, and for any record/derivation identity mismatch.
6. `evaluateOfficialReservationReferenceDate` + `buildOfficialReservationReferenceRelationPresentation`
   already implement the complete Phase 3F-H relation and its fail-closed identity composition,
   including the inverted-span refusal.
7. `OrderedSequenceBuilder` holds exactly one `reservationReferenceDate`, captured once at planner
   open via `captureDeviceLocalCivilDate()`.
8. `DayAssignment.days` is **positional** — a `DayBucket` carries `placeIds` and `sequence`, but no
   id. The stable opaque day id lives on the persisted draft day entities (`dayEntities` in the
   component), aligned by index. "Día N" shown to the user is the 1-based ordinal.
9. **Phase 3D's route-wide `ReservationPreparationSection` renders in the `builder` view**
   (`view === "builder"`), alongside `HoursPlanningSection`. The dated planner is a *different view*
   (`view === "days"`). The two surfaces are already in separate views, and Phase 3F-I keeps them
   there (§13).

---

## 4. Scope of the approved proposition

### 4.1 What the successor may build

One route-wide, read-only section that:

- collects the Phase 3F-D derivations already produced for the current plan;
- pairs each with its exact evidence record and its existing Phase 3F-F presentation;
- optionally annotates each with the existing Phase 3F-H relation;
- orders them by civil date under a fixed tie-break contract;
- shows place, `Día N`, visit date, scope, the official fact and its provenance on every row.

Every row in that section has a real civil date. There is no second block, no secondary list and no
dateless row.

### 4.2 What the successor may not build

- a second derivation of any official date;
- a second relation evaluator;
- a second reference-date capture;
- a merged official+editorial list;
- any ranking, scoring, priority, urgency or recommendation;
- any booking-state, availability or inventory claim;
- any reminder, notification, export or automation;
- any persistence of the aggregate;
- any route-wide representation of a result that has no applicable official date (§12).

---

## 5. Inputs

### 5.1 Permitted inputs

| Input | Why it is needed |
| --- | --- |
| the current canonical route / per-day place lists, in user order | supplies plan order for tie-breaking and the place identity/name |
| `DayAssignment` (must be `valid`) | supplies which day each place is in |
| the 1-based day ordinal (`Día N`) and, where available, the stable day id | supplies planned-day identity (§9.3) |
| `startDate` (must be a valid civil date) | supplies the visit civil date via the existing owner |
| `reservationMechanismEvidenceRecords` | the bundled Phase 3F evidence |
| Phase 3F-D derivations for each planned place | the already-derived official calendar facts |
| Phase 3F-F presentations | the already-approved display text and provenance |
| the single `reservationReferenceDate` | **only** when the Phase 3F-H relation is rendered (§11) |

### 5.2 Forbidden inputs

The aggregator must not read, receive or depend on:

- `visitStartTimes`;
- accommodations, accommodation boundaries or accommodation legs;
- transfers, legs, inter-hub segments, distances or durations;
- opening hours or `schedule.hours`;
- closures or `schedule.closures`;
- `febMar2027` / Feb–Mar suitability;
- `Place.reservation.required`, `Place.reservation.leadTime`, `ReservationFact`,
  `ReservationLeadTimeFact`;
- `derivePlaceReservationDateWindow`, `evaluateReservationWindowReference` or any Phase 3D
  reservation-window arithmetic;
- `endDate` or trip-bounds assessment;
- `bestTime`, tourism grade, price or any editorial quality axis;
- the device clock (beyond the one explicit reference civil date passed in);
- the network.

### 5.3 Eligibility precondition for the whole surface

The section renders **nothing at all** unless all of:

1. `dayAssignment.valid === true`;
2. `startDate !== null` and `isValidCivilDate(startDate)`;
3. `chronological.length > 0`.

This mirrors the existing Phase 3F-F precondition exactly and is the same reason
`ReservationPreparationSection` is *not* the host surface: it works before dates exist, and Phase 3F
facts are visit-date-dependent (3F-E §3.2).

Because the surface is chronology-only (§12), condition 3 is the whole condition: if no official
fact in the current plan has a placeable civil date, the **entire section is absent** — no heading,
no empty list, no "no hay fechas" message, no explanatory notice of any kind. Absence remains
absence, never a finding the reader has to interpret.

---

## 6. What enters the chronology

### 6.1 `release-date`

A `release-date` derivation becomes exactly **one** chronological item anchored at its
`releaseDate`.

This covers Ghibli (`monthly-fixed-release`), Disneyland and DisneySea
(`rolling-calendar-month-release`, including the operator's missing-day fallback already resolved
upstream) and an applicable Osaka Sumo (`fixed-sale-date`).

### 6.2 `application-window`

An `application-window` derivation becomes exactly **one** chronological item anchored at its
`openDate`, and that item renders **both** recorded edges as a span. See §24 for the full decision,
the rejected alternative and the mandatory mitigations.

**Exception — an unordered or invalid span is not a calendar entry.** A span is eligible only when
`openDate` is a valid civil date, `closeDate` is a valid civil date, **and** `openDate <= closeDate`.
Otherwise the derivation produces **zero route-wide items**.

Anchoring such a span at its `openDate` would file it *after* its own recorded end, which is not a
fact the evidence supports, and silently swapping the edges to make it sortable is exactly the repair
Phase 3F-H already refused.

It also receives **no fallback of any kind**: no neutral item, no dateless row, no placeholder, no
warning. That is not merely a scope preference — it is forced by the existing runtime. Phase 3F-F's
`buildOfficialReservationDatePresentation` does **not** validate edge ordering; for an inverted span
it still returns `kind: "application-window"` with its ordinary `Inicio:` / `Fin registrado de la
ventana:` detail lines. There is no existing neutral Phase 3F-F presentation for this case, so any
route-wide fallback row would require inventing a new presentation state and new copy that this gate
never designed and does not approve. Omission is the only disposition that needs nothing new.

It receives no Phase 3F-H relation either — Phase 3F-H's evaluator already returns `not-assessed` for
an inverted span, so the fail-closed composition drops it with no extra rule.

This is a defensive boundary, like Phase 3F-H's: no real bundled record produces it, Phase 3F-D is
not changed to prevent it, and Phase 3F-H is not changed either.

### 6.3 Nothing else

No other derivation kind produces a chronological item. See §12.

---

## 7. The item shape (illustrative, not final)

```ts
type RouteWideOfficialReservationCalendarItem = {
  // identity — all mandatory, all copied from the derivation/record, never reconstructed
  recordId: string;
  placeId: string;
  scope: ReservationMechanismScope;

  // plan context
  placeName: string;
  dayNumber: number;            // 1-based ordinal, exactly the "Día N" the day card shows
  dayId: string | null;         // stable opaque day id when the caller has it; never invented
  visitDate: string;            // civil date, YYYY-MM-DD

  // the official fact, already derived and already presented
  anchorDate: string;           // the chronological key (§8.1)
  fact:
    | { kind: "release-date" }
    | { kind: "application-date-span"; openDate: string; closeDate: string };
  presentation: OfficialReservationDatePresentation;   // heading/detail/allocation/provenance/url

  // secondary context, always populated when assessable; null only when no reference date was
  // supplied or Phase 3F-H returned not-assessed
  relation: OfficialReservationReferenceRelationPresentation | null;
};
```

```ts
type RouteWideOfficialReservationCalendar = {
  /** Every item, each with a real civil date, ordered by §8. This is the whole surface. */
  chronological: readonly RouteWideOfficialReservationCalendarItem[];
  /** The single concrete reference date used for every relation above, or null. */
  referenceDate: string | null;
};
```

The result has exactly these two fields. There is deliberately **no** second collection — no
`withoutApplicableDate`, no neutral-item type, no "other"/"unscheduled"/"sin fecha" bucket, and no
field that could grow into one. A derivation that cannot produce a dated item simply produces
nothing here (§12).

No field named `priority`, `rank`, `score`, `urgency`, `status`, `state`, `isOpen`, `isLate`,
`daysUntil`, `deadline`, `dueDate` or `nextAction` may exist on any of these types.

---

## 8. Chronological ordering contract

### 8.1 Primary key — `anchorDate`

- `release-date` item → `releaseDate`;
- `application-date-span` item → `openDate`.

Ascending. Because every value is a validated fixed-width `YYYY-MM-DD`, lexical comparison is
calendar comparison; no instant, `Date` object or timezone is required or permitted.

### 8.2 Tie-breakers — fixed, total and deterministic

Applied in this exact order, and only on an exact `anchorDate` tie:

1. **`anchorDate` ascending** (primary).
2. **Day ordinal ascending** — the `Día N` the place is assigned to.
3. **Position of the place within that day**, in the user's explicit order.
4. **Source-record order** — the index of the record in `reservationMechanismEvidenceRecords`,
   which is the bundled catalog's array order. This is what separates two scopes of the same place
   on the same date.

Keys 2 and 3 together are simply "the place's position in the flattened plan", so the comparator may
be implemented as `(anchorDate, planOrdinal, recordSourceIndex)`. That triple is **total**: no two
distinct items can tie on all three, because a `(place, record)` pair is unique within a plan and a
record appears at most once per place.

The ordering must be implemented with a stable sort over an input already built in plan order, so
the result is reproducible for identical input regardless of engine sort stability.

### 8.3 Ordering is not priority — normative declaration

The order produced by §8.1–8.2 is a **reading order over recorded civil dates**. It is declared,
here and in the runtime's own copy and tests, to carry **no** meaning about:

- what to buy or apply for first;
- what matters more;
- what is more urgent;
- what is scarcer or harder to obtain;
- what is likelier to sell out;
- which experience to prioritise;
- which reservation is riskier to postpone;
- how the reader should spend attention, time or money.

A reader who reverses the plan order sees the same chronological list; a reader who changes the
start date sees a different one. Neither fact says anything about importance.

### 8.4 Forbidden ordering keys

The comparator must never read: `allocation`, `ReservationFact` requiredness, tourism grade, price,
inventory, popularity, any urgency notion, `provenance.consultedAt`, `provenance.confidence`,
`sourceEntity`, `sourceUrl`, place name (alphabetical), visit date, or the Phase 3F-H relation kind.

Ordering by `consultedAt` or `confidence` is specifically forbidden because it would turn provenance
into a quality ranking — see §15.

### 8.5 There is nothing else to order

The chronology is the entire surface (§12), so §8.1–8.2 is the complete ordering specification.
There is no second list, no secondary ordering rule, and no dateless item that would need one.

---

## 9. Identity

### 9.1 Mandatory identity on every item

Every item — chronological or neutral — must carry, copied verbatim from the derivation and its
matching record:

- `recordId`;
- `placeId`;
- `scope`;
- planned day identity (§9.3);
- `visitDate`;
- the official date or date span;
- source/provenance identity (source entity, consultation date, source URL).

### 9.2 Fail-closed composition

The aggregator must reuse the existing `buildOfficialReservationDatePresentation(record, derivation)`
and `buildOfficialReservationReferenceRelationPresentation(presentation, relation)` boundaries, both
of which already return `null` on any `recordId`/`placeId`/`scope` mismatch. An item whose
presentation cannot be built is **omitted**, never rendered with partial or borrowed identity.

The aggregator must pair a derivation to its record by exact `recordId`, exactly as
`OfficialReservationDateNotice` already does. No nearest match, no place-level fallback, no
first-record-for-this-place shortcut.

### 9.3 Planned day identity

`DayAssignment.days` is positional and carries no id (§3.3.8). The contract is therefore:

- `dayNumber` (1-based ordinal) is **mandatory** and is exactly the number the day card shows;
- `dayId` (the stable opaque draft day id) is **carried when the caller has it** and is `null`
  otherwise; it is never invented, derived from the ordinal, or used as a display value.

`dayNumber` plus `visitDate` is already sufficient to bind an item to the right day card, because
both are derived from the same `startDate + dayIndex`. `dayId` is carried as a stronger machine
identity for future consumers, not as a second display axis.

### 9.4 No merging, no fusing, no deduplication by date

- Two records of the same place with different scopes stay two items.
- Two places on the same date stay two items.
- Two places in the same day stay two items.
- An identical `anchorDate` across records is a coincidence of the calendar, never a shared entity.

Deduplication is permitted on exactly one basis: a `(recordId, placeId, scope)` triple must appear at
most once, which is already guaranteed upstream (a record appears once per place, and active
`placeId + scope` uniqueness is enforced by the evidence parser). If a duplicate triple ever reaches
the aggregator, that is an upstream invariant violation and must not be silently repaired.

---

## 10. Visit context on every row

The reader must be able to tell, without leaving the section, which planned visit a fact belongs to.

Every chronological row shows, at minimum:

1. place name;
2. `Día N`;
3. the visit civil date;
4. the scope label;
5. the official date or date span (with recorded times exactly as Phase 3F-F renders them);
6. allocation disclosure when recorded;
7. the Phase 3F-H relation, when rendered (§11);
8. provenance text and the official-source link.

Illustrative row (not final copy):

```
Ghibli Museum, Mitaka · Día 3 · visita mar, 16 mar 2027
Entrada general
Venta registrada para esta visita
mié, 10 feb 2027 · 10:00 (Asia/Tokyo)
Fuente oficial: Ghibli Museum, Mitaka · consultada el sáb, 12 sept 2026
Ver fuente oficial
```

This is a **fact bound to a planned visit**, not an itinerary step, not a task, and not something to
tick off. No checkbox, no completion state, no "done", no progress count.

---

## 11. Phase 3F-H relation in the route-wide view

**Decision: yes — and it is not optional.** Phase 3F-J **renders** the existing relation as secondary
context on every row where one is assessable, under the conditions below. The conditionality is
entirely mechanical — a reference date exists, and the relation composes — never a product judgement
the runtime gets to make.

### 11.1 Conditions

1. It consumes the **same** single `reservationReferenceDate` already captured by the planner. No
   second capture, no re-capture, no ambient `new Date()`/`Date.now()` anywhere in this phase.
2. It reuses `evaluateOfficialReservationReferenceDate` verbatim. **No new relation evaluator, no
   variant, no route-wide relation kind.**
3. It reuses `buildOfficialReservationReferenceRelationPresentation`, so identity composition stays
   fail-closed and an inverted span stays unassessable.
4. Semantics are byte-identical to Phase 3F-H: before / same recorded date / after for a release
   date; before / within / after the recorded **date span** for an application window.
5. No currentness is recomputed, no instant is generated, no timezone is read or converted.
6. The concrete reference date stays visible (§11.2).
7. No open/closed/late/deadline/countdown state is derived from it, in the chronology or anywhere
   else.
8. A `not-assessed` relation renders **no relation line at all** — never a placeholder, a dash, an
   "unknown" chip, or an empty slot that implies a missing value.

### 11.2 Where the concrete reference date is disclosed

Phase 3F-G §13 requires the concrete reference date to be visible whenever an assessed relation is
shown. There is exactly **one** reference date for the whole planner instance, so repeating it on
every row adds no information and adds noise.

**Decision: disclose it once, at section level**, in the section's own header/disclaimer block, in
the form already approved:

> Fecha de referencia (tu dispositivo): sáb, 12 sept 2026

with the mandatory constraints that the disclosure:

- lives in the **same section** as the relations it applies to;
- is rendered whenever at least one assessed relation is shown in that section;
- is not collapsible, not hidden behind a toggle, and not truncated;
- states explicitly that it applies to every relation in the section;
- keeps the device/browser source label — it is never labelled `hoy`, `ahora` or `actualmente`.

The per-item disclosure inside the existing Phase 3F-F day card stays exactly as Phase 3F-H shipped
it. This gate changes nothing there.

### 11.3 Ordering is never affected by the relation

The relation must not be an ordering key, a grouping key, a filter, or a visibility condition. A row
whose relation is `after-recorded-release-date` sits in exactly the same place as it would with no
reference date at all, and is styled identically (§22.4).

---

## 12. Results with no applicable official date — no route-wide representation

### 12.1 The policy

**Phase 3F-J is chronology-only.** The route-wide surface exists exclusively for official facts that
have a valid, placeable civil date. A derivation that cannot produce one has **no route-wide
representation at all** — not a neutral row, not a secondary block, not a placeholder.

This is a decision, not a preference left to the runtime. There is no "may appear", no "if shipped"
and no product choice for Phase 3F-J to make here.

### 12.2 Disposition per derivation kind

| Derivation kind | Route-wide calendar | Where it still lives |
| --- | --- | --- |
| `release-date` with a valid `releaseDate` | ✅ one item at `releaseDate` | also in its day card |
| `application-window` with two valid edges and `openDate <= closeDate` | ✅ one item at `openDate` | also in its day card |
| `application-window` with an invalid edge | ❌ omitted entirely | its day card, unchanged |
| `application-window` with `openDate > closeDate` | ❌ omitted entirely | its day card, unchanged |
| `not-applicable-to-visit-date` | ❌ omitted entirely | its day card, where Phase 3F-F already renders the neutral copy and the recorded event period |
| `not-derivable` | ❌ omitted entirely | its day card, where Phase 3F-F already renders the neutral copy |
| `no-visit-date` | ❌ omitted entirely | nowhere — Phase 3F-F already omits it |
| `inactive-evidence` | ❌ omitted entirely | nowhere — Phase 3F-F already omits it |

"Omitted entirely" means exactly that: no item, no row, no neutral item, no placeholder, no synthetic
date, no sentinel date, no "sin fecha" row, no warning row, no error row, and no count.

### 12.3 Why omission is the right disposition

Five independent reasons, each sufficient on its own:

1. **They have no chronological key.** The surface's entire organising principle is a civil date.
   These results do not have one; that is what makes them these results.
2. **Giving them one would be fabrication.** Borrowing the visit date, the start date, the reference
   date, a far-future or far-past sentinel, or `null`-sorted-last-as-if-dated all invent a calendar
   position the evidence never recorded. §12.4 makes this absolute.
3. **A secondary block is a second product function.** The value proposition of this surface (§2.1)
   is seeing scattered official dates in one chronological place. A dateless list serves a different
   purpose — auditing coverage — and bolting it on doubles the surface's job for no gain against the
   problem this gate is solving.
4. **Phase 3F-F already keeps the information.** `not-applicable-to-visit-date` and `not-derivable`
   are already rendered, with their neutral copy and their provenance, in the day card of the place
   they belong to. Nothing is lost from the product; only the route-wide duplicate is declined.
5. **Omission is the only disposition that needs nothing new.** A route-wide neutral block would
   require new presentation state and new copy for at least the inverted-span case, because
   `buildOfficialReservationDatePresentation` does not validate edge ordering and returns an ordinary
   `application-window` presentation for it (§6.2). Designing that state is outside this gate, and
   inventing it in the runtime is exactly the kind of undesigned decision this correction closes.

### 12.4 The absolute rule

**No result without an applicable official date may ever be given a date, of any provenance, for any
purpose, anywhere in this surface.** Not the visit date, not the start date, not the reference date,
not a sentinel, not a null sorted as if dated.

A fact with no date is not a calendar entry, and this surface is only a calendar.

### 12.5 Phase 3F-F is untouched

This policy changes nothing about the existing per-day surface. `OfficialReservationDateNotice`
keeps rendering exactly what it renders today, including the neutral `not-applicable` and
`not-derivable` states and their existing copy. Phase 3F-J adds a second, narrower view; it does not
edit the first one.

---

## 13. Relationship with Phase 3D

### 13.1 They are already in different views

`ReservationPreparationSection` ("Reservas por preparar") renders in the **`builder`** view. The
Phase 3F route-wide calendar belongs in the **`days`** view, because it requires a valid day
assignment and a start date that the builder view does not have.

This is a structural separation, not a styling convention, and it is the strongest available
guarantee that the two lists cannot be read as one.

### 13.2 Forbidden

- merging the two lists, or rendering them inside one shared section or heading;
- a combined "booking dashboard", "todo de reservas" or unified preparation list;
- intersecting Phase 3D lead-time windows with Phase 3F official dates;
- using any Phase 3D value as an ordering, grouping, filtering or eligibility key for Phase 3F;
- using any Phase 3F value to reorder, regroup or alter Phase 3D;
- declaring precedence in either direction, in code or in copy;
- hiding, collapsing, dimming or de-emphasising Phase 3D because Phase 3F exists;
- hiding, collapsing, dimming or de-emphasising Phase 3F because Phase 3D exists;
- a shared count, a shared badge, or a shared "N reservas" summary across both.

### 13.3 Permitted

Visual proximity is permitted **only** if each surface keeps its own heading, its own disclaimer and
its own provenance, and neither is nested inside the other. Given §13.1 they are in different views
anyway, so the runtime should not go looking for proximity.

---

## 14. Source conflicts stay unresolved

If the Phase 3F official evidence and the Phase 3D editorial lead-time text appear to disagree for
the same place, Phase 3F-I resolves nothing.

Forbidden:

- picking a winner;
- flagging a conflict automatically;
- labelling either source stale, outdated, superseded or wrong;
- applying precedence;
- suppressing one surface;
- emitting a "verify this" prompt derived from the comparison.

Each surface shows its own recorded fact with its own provenance, and the reader compares them if
they wish. Source-conflict UI remains deferred.

---

## 15. Freshness

`provenance.consultedAt` remains **provenance**. It states when a human read the official page. It
is not:

- a TTL;
- an expiry;
- a "valid until";
- a confidence score;
- proof that the rule still holds today.

Therefore the route-wide calendar must not:

- sort, group, filter or tie-break by `consultedAt` (§8.4);
- colour, badge, dim or warn by source age;
- compute or display an age ("consultada hace N meses");
- emit an automatic "fuente antigua" notice;
- treat `official-explicit` vs `official-derived` confidence as a ranking.

`consultedAt` is rendered as a concrete date inside the existing provenance sentence, exactly as
Phase 3F-F already renders it. Evidence freshness/expiry remains deferred.

---

## 16. Time and timezone boundary

Phase 3F-I remains **civil-date and recorded-local-time evidence only**.

Forbidden in the aggregator, the presentation helper and the component alike:

- current Japan time or Japan business-date semantics;
- UTC instants or instant generation;
- `Intl.DateTimeFormat` timezone conversion (`formatCivilDateDisplay`'s existing UTC-pinned display
  formatting is unchanged and is not a conversion);
- `Date.parse` of source date/time strings;
- `getTimezoneOffset` or any browser-offset arithmetic;
- Mexico ↔ Japan or any cross-zone conversion;
- DST logic;
- comparing a recorded release clock time with any current time;
- inferring `Asia/Tokyo`, JST or UTC+9 for a record whose `sourceTimeZone` is `null`.

Recorded times remain visible facts exactly as recorded. `Asia/Tokyo` stays `Asia/Tokyo`. `null`
stays explicitly unknown, with the existing disclosure wording.

The chronological key is a civil date compared lexically. No `Date` object is required to order this
list, and none may be introduced for that purpose.

**One clarification so the successor does not write a contradictory test.** The existing display
helper `formatCivilDateDisplay` renders a civil date through `Intl.DateTimeFormat` pinned to
`timeZone: "UTC"`, purely so the date a user picked is the date they see in every browser timezone.
That is locale formatting of a civil date, not a timezone conversion, and reusing it is required for
visual consistency with every other date in the planner. A source-boundary scan forbidding `Intl` is
therefore correct for the **aggregator module** — which must do no formatting at all — and wrong for
a presentation helper. The aggregator returns civil-date strings; formatting stays where it already
lives.

---

## 17. Current booking state stays out

Chronological ordering does **not** unlock any current-state claim. Still forbidden:

- sale open / sale closed;
- applications open / applications closed;
- booking possible / booking impossible;
- tickets available / unavailable / sold out;
- inventory or capacity remaining;
- missed deadline / deadline passed;
- "still time" / "too late" / "you're late";
- "buy now" / "reserve now" / "last chance";
- countdowns, days remaining, hours remaining;
- probability of obtaining a place;
- any success/failure, complete/incomplete or on-track/off-track framing of a row.

The Phase 3F-H civil-date relation remains the **maximum** permitted current-date claim, unchanged in
strength by being shown in a chronological list.

---

## 18. Reminders, notifications and calendar export stay deferred

An internal visual agenda does not authorise calendar automation. Still not approved:

- reminders of any kind;
- push notifications;
- email or SMS alerts;
- scheduled tasks, cron or background jobs;
- `.ics` generation or download;
- Google Calendar / Apple Calendar / Outlook integration;
- an "Añadir al calendario" control;
- countdown timers;
- automatic midnight refresh or any timer/interval/focus/visibility recapture;
- service workers;
- any outbound request derived from a calendar item.

The official-source link stays what it already is: an ordinary user-initiated provenance link.

---

## 19. Persistence boundary

The route-wide calendar is **entirely derived**. Nothing about it is written anywhere.

Unchanged:

- `ManualPlanningDraftV7` and its schema;
- `nihon.manualPlanningDraft`;
- every localStorage/sessionStorage/IndexedDB key;
- `data/reservation-mechanisms.json` and its app parity copy;
- places data and the workbook;
- package manifests and dependencies.

No V8. No new storage key. Never persisted: sorted calendar items, item order, anchor dates,
relations, the reference date, official reservation dates, derived spans, calendar events, priority,
dismissal state, "seen" state, or any per-item user annotation.

---

## 20. Recomputation

The section must recompute, from current state, whenever any of these changes:

- route composition (a place added to or removed from the route);
- day assignment (a place moved between days, days reordered, days re-split);
- `startDate` (set or changed);
- a place's position within its day (affects tie-break key 3, and therefore order).

The section must disappear or correctly re-derive when:

- `startDate` is cleared → the whole section disappears (§5.3);
- the day assignment becomes invalid → the whole section disappears (§5.3);
- a place leaves the plan → its items disappear;
- a place changes day → its `Día N`, visit date, anchor date and position in the chronology all
  recompute together;
- the plan is reloaded → the section is rebuilt from persisted plan + bundled evidence only.

Because nothing is persisted (§19), no stale item can survive a reload by construction. The runtime
must still prove this in the browser gate (§28).

Recomputation is ordinary React derivation from current props/state. It must not be implemented with
a cache, a memo keyed on anything weaker than the full input, an effect that writes state, or any
listener.

---

## 21. Placement

### 21.1 Chosen placement

**View:** `days` ("Distribuir por días") in `OrderedSequenceBuilder.tsx`.

**Position:** immediately after `<AccommodationManagerSection />` and immediately before
`<div className="day-list">`.

**Cardinality:** exactly one instance per planner, route-wide. It is **not** repeated inside a day
card and does not replace the per-day `OfficialReservationDateNotice`, which stays exactly as Phase
3F-F/3F-H shipped it.

### 21.2 Why there

- The `days` view is the only view that has a valid day assignment and a start date, which §5.3
  requires.
- Everything above that point in the view is either an input control (`calendar-anchor`,
  inter-hub, accommodations) or a route-wide derived summary (`TripBoundsNotice`,
  `WholeTripCompositionSection`). A route-wide read-only derived summary belongs with the latter.
- Sitting immediately before `.day-list` gives the reader the route-wide overview first and the
  per-day detail immediately after, which is the same overview→detail shape
  `WholeTripCompositionSection` already established.
- It is far from `ReservationPreparationSection` (a different view entirely), which protects §13.

### 21.3 Rejected placements

| Candidate | Why rejected |
| --- | --- |
| inside each day card | it is route-wide by definition; repeating it per day would duplicate every item N times and directly contradict §9.4 |
| the `builder` view, next to `ReservationPreparationSection` | no day assignment, no start date, so no visit date and no derivable Phase 3F fact (3F-E §3.2); and adjacency to the Phase 3D list is exactly the §13 hazard |
| the `compare` view | that view is about ordering alternatives, not dates |
| `PlaceDetail.tsx` | place-centric, no plan/day context (3F-E §3.3) |
| a new modal or drawer | no demonstrated need; the content is static read-only text, and a second dialog would violate the existing single-dialog invariant already pinned by test |
| a new top-level tab/view | disproportionate for one read-only list, and it would separate the calendar from the plan it describes |

### 21.4 Accessibility and structure

One `<section>` with its own accessible name, one heading, one ordered or unordered list of rows,
and no interactive control other than the existing per-item official-source link. No `role="dialog"`,
no `aria-modal`, no focus trap, no tab order change.

---

## 22. Copy

### 22.1 Heading — decision

Two candidates were required to be evaluated:

| Candidate | Assessment |
| --- | --- |
| **Calendario oficial de reservas** | "Calendario" + "de reservas" reads as *a calendar of your bookings* — a thing you own, act on and complete. It invites "add to calendar", "mark as done" and "what's next". Rejected. |
| **Fechas oficiales de reserva del recorrido** | Names exactly what it is: recorded official dates, scoped to this route. "Fechas" is a fact noun, not an artefact you act on; "del recorrido" states the scope; nothing implies ownership, state or action. **Chosen.** |

**Chosen heading: `Fechas oficiales de reserva del recorrido`.**

### 22.2 Mandatory disclaimer content

The section disclaimer must state, at minimum, all five:

1. these are facts derived from the recorded official sources, per record;
2. each one is tied to the visit date planned for that place;
3. **chronological order does not mean priority, urgency or a recommended sequence**;
4. it does not indicate availability nor the current state of sale;
5. when a relation to the reference date is shown, it is a civil-date relation only — it does not
   consider the recorded time or the source timezone, and the reference date comes from the device's
   local calendar and does not refresh itself.

Proposed wording (runtime may refine, must not weaken):

> Estas fechas provienen del registro oficial de cada lugar y están calculadas sobre la fecha de
> visita planificada. **El orden cronológico solo ordena fechas de calendario: no indica prioridad,
> urgencia ni en qué orden conviene reservar.** No indica disponibilidad ni el estado actual de la
> venta. Cuando se muestra una relación con la fecha de referencia, compara únicamente fechas de
> calendario: no considera la hora registrada ni la zona horaria de la fuente. Esta información
> oficial se muestra por separado de la anticipación editorial registrada; Nihon no combina ambas
> fuentes.

### 22.3 Forbidden vocabulary

In headings, labels, rows, empty states and disclaimers alike: `próxima reserva`, `siguiente`,
`primero`, `prioridad`, `prioritario`, `importante`, `urgente`, `pendiente`, `por hacer`,
`completado`, `hecho`, `te falta`, `quedan`, `faltan`, `días restantes`, `horas restantes`,
`fecha límite`, `deadline`, `última oportunidad`, `cierra`, `abre`, `abierta`, `cerrada`,
`disponible`, `no disponible`, `agotado`, `boletos`, `compra`, `reserva ahora`, `no olvides`,
`recuerda`, `aviso`, `alerta`, `atención`, `ya puedes`, `todavía puedes`, `estás a tiempo`,
`se te pasó`, `tarde`.

`hoy`, `ahora` and `actualmente` remain forbidden as the reference-date label (§11.2).

### 22.4 Neutral styling

Every row uses one neutral treatment. No success/warning/danger palette, no traffic lights, no
badges, no icons that encode state, no emphasis derived from the anchor date, the relation kind, the
allocation, the confidence or the source age. A row whose relation is "after" looks exactly like a
row whose relation is "before".

---

## 23. Multiple facts on the same date

### 23.1 Decision: flat chronological list, date on every row

Two shapes were required to be evaluated:

| Shape | Assessment |
| --- | --- |
| **Grouped under a shared date header** | A shared header is precisely the affordance that suggests the grouped items share something real — a state, a moment, a batch to handle together. It also invites a per-date count ("3 reservas el 10 feb"), which is one step from a workload/priority reading, and it structurally implies a shared availability event the evidence does not support. Rejected for the first runtime. |
| **Flat list, every row carries its own full date** | Each fact stays a separate row with its own place, `Día N`, visit date, scope, official date and provenance. Two facts on the same date look like two facts that happen to share a date, which is exactly what they are. Costs a small amount of repetition. **Chosen.** |

**Chosen: a flat chronological list in which every row renders its own complete date.**

### 23.2 If a future phase wants grouping

Visual grouping by date is not forbidden forever, but it may only be reconsidered under all of:

- every record remains a separate, individually identified row;
- scope and provenance remain visible per row, not hoisted into the group header;
- the group header carries no count, no badge and no state;
- the grouping does not imply shared availability, a shared action or a shared moment;
- the deterministic §8 order is preserved exactly within and across groups.

Phase 3F-J should not implement grouping.

---

## 24. Application-window representation — the load-bearing decision

### 24.1 The options

**Option A — one range item.** A single chronological item anchored at `openDate`, rendering the
recorded span, e.g. `1 dic 2026 → 12 mar 2027`.

**Option B — two linked milestones.** Two chronological items sharing one identity: "inicio
registrado" at `openDate` and "fin registrado de la ventana" at `closeDate`.

### 24.2 Decision: **Option A**

### 24.3 Why

1. **Option B manufactures a deadline affordance.** A standalone row whose label is "fin registrado
   de la ventana", filed at its own position near the end of a date-ordered list, reads as a due
   date no matter how the copy is worded. The entire 3F line has refused exactly that claim
   (3F-G §7.2, §17 here). Option A never creates a row whose whole reason to exist is an end date.
2. **Option B breaks one-record-one-item.** §9.4 fixes the rule that identical dates never merge
   records; the symmetric hazard is one record appearing twice and being read as two mechanisms, or
   counted twice. Option A keeps a clean bijection between records-with-dates and rows.
3. **Option A preserves the recorded proposition exactly.** Katsura's evidence is one window with
   two edges — not two independent events. A single item with two visible edges *is* the recorded
   fact; two items are an interpretation of it.
4. **Option B would need a new milestone vocabulary.** "inicio"/"fin" as first-class item kinds is a
   new closed vocabulary one synonym away from "apertura"/"cierre", which is booking state.
5. **Option A's real cost is bounded and mitigable.** Its only genuine drawback is that the close
   edge does not occupy its own chronological slot — an *information placement* issue, not a false
   claim, and one §24.4 addresses directly.

### 24.4 Mandatory mitigations for Option A

Because Option A is chosen, all four are required, not optional:

1. **Both edges always render together**, as a span with a neutral connector
   (`1 dic 2026 · 05:00 → 12 mar 2027 · 23:59`, using the existing Phase 3F-F date/time rendering
   including the unknown-timezone disclosure). The close edge is never omitted, never truncated,
   never hidden behind a toggle, and never rendered alone.
2. **The chronological anchor is disclosed on the row**, e.g. "situado por la fecha de inicio
   registrada del tramo", so the reader is never misled about why the row sits where it does.
3. **The connector is directional and neutral.** `→` or `–` between two full dates. Never "hasta
   el", "antes del", "límite", "cierra el" or any single-edge framing.
4. **No standalone close-date row may be synthesised anywhere** — not in the chronology, not as a
   footnote row, not as a secondary list, and not in any other block, since there is no other block
   (§12).

### 24.5 Not combined

The two options are mutually exclusive here. A hybrid (a range row plus a separate close-edge
marker) reintroduces every Option B hazard while keeping Option A's duplication, and is forbidden.

---

## 25. Real fixtures

All values below were derived by reading the real Phase 3F-D runtime and the real bundled evidence,
not assumed.

### 25.1 Ghibli Museum (`JP-044`, `RM-JP-044-001`, `general-admission`)

`monthly-fixed-release`, day 10, 10:00, `Asia/Tokyo`, subsequent calendar month.

Visit `2027-02-20` → `release-date` `2027-01-10`.

Calendar representation: one chronological item anchored at `2027-01-10`, rendering
`dom, 10 ene 2027 · 10:00 (Asia/Tokyo)`. The recorded time stays visible; it is never compared with
anything. With a reference date of `2027-01-10` the row may additionally show
"coincide con la fecha oficial registrada" — and nothing stronger.

### 25.2 Tokyo Disneyland (`JP-203`, `RM-JP-203-001`, `park-admission`)

`rolling-calendar-month-release`, 2 months before, same calendar day, 14:00, `sourceTimeZone: null`.

Visit `2027-02-20` → `release-date` `2026-12-20`.

Calendar representation: one chronological item anchored at `2026-12-20`, rendering
`20 dic 2026 · 14:00 · zona horaria no registrada en la evidencia estructurada`. The unknown
timezone stays explicitly unknown in the route-wide view exactly as in the day card. No JST, no
`Asia/Tokyo`, no UTC+9 anywhere.

### 25.3 Tokyo DisneySea (`JP-204`, `RM-JP-204-001`, `park-admission`)

Same mechanism. Visit `2027-04-30` → the aligned day `2027-02-30` does not exist, so the operator's
recorded `first-day-of-next-month` rule already resolved upstream to `release-date` `2027-03-01`.

Calendar representation: one chronological item anchored at **`2027-03-01`** — the
already-derived date. The aggregator must consume that value and must never re-run, re-check or
re-implement the fallback, and the nominal invalid `2027-02-30` must not appear in any item, key,
label or serialized state.

### 25.4 Katsura Imperial Villa (`JP-077`, `RM-JP-077-001`, `guided-visit`)

`relative-application-window`: opens 05:00 on the first day of the month three months before the
visit month; closes 23:59 three days before the visit. `sourceTimeZone: null` on both edges.
Allocation `lottery-if-oversubscribed`.

Visit `2027-03-15` → `application-window` open `2026-12-01`, close `2027-03-12`.

Calendar representation (Option A, §24): **one** chronological item anchored at `2026-12-01`,
rendering both edges as a span with both recorded times and the unknown-timezone disclosure, plus
the recorded lottery allocation disclosure and the anchor note. **No** separate `2027-03-12` row
exists. With a reference date of `2026-12-01` or `2027-03-12` the row may show "cae dentro del tramo
de fechas registrado" — never "abierta", "último día" or "cierra hoy".

### 25.5 Grand Sumo Tournament Osaka 2027 (`JP-212`, `RM-JP-212-001`, `event-admission`)

`fixed-sale-date` `2027-02-06`, applicable to visits `2027-03-14` … `2027-03-28`, no recorded sale
time.

- Visit `2027-03-20` (inside the period) → `release-date` `2027-02-06` → one chronological item
  anchored at `2027-02-06`, rendering `6 feb 2027` with **no invented time**.
- Visit `2027-03-29` (outside the period) → `not-applicable-to-visit-date` → **completely absent
  from the route-wide surface**: no chronological item, no neutral item, no row of any kind, and no
  Phase 3F-H relation. The fact is not lost — the place's own day card still shows the existing
  Phase 3F-F neutral copy and the recorded `14 mar 2027 – 28 mar 2027` event period, exactly as it
  does today.

### 25.6 Worked multi-place plan

Plan: `startDate = 2027-03-14`; Día 1 = Osaka Sumo; Día 2 = Katsura; Día 3 = Ghibli;
Día 4 = Tokyo Disneyland.

Derived visit dates: `2027-03-14`, `2027-03-15`, `2027-03-16`, `2027-03-17`.

Derived official facts: Sumo `2027-02-06`; Katsura open `2026-12-01` / close `2027-03-12`; Ghibli
`2027-02-10`; Disneyland `2027-01-17`.

Resulting chronology (§8):

| # | anchor | item |
| --- | --- | --- |
| 1 | `2026-12-01` | Katsura · Día 2 · visita 15 mar 2027 · tramo `1 dic 2026 → 12 mar 2027` |
| 2 | `2027-01-17` | Tokyo Disneyland · Día 4 · visita 17 mar 2027 · `17 ene 2027 · 14:00 · zona horaria no registrada` |
| 3 | `2027-02-06` | Osaka Sumo · Día 1 · visita 14 mar 2027 · `6 feb 2027` |
| 4 | `2027-02-10` | Ghibli · Día 3 · visita 16 mar 2027 · `10 feb 2027 · 10:00 (Asia/Tokyo)` |

The chronological order (Katsura, Disneyland, Sumo, Ghibli) matches neither the plan order
(Sumo, Katsura, Ghibli, Disneyland) nor the visit order. Making that discrepancy visible in one place
is the entire value of the surface — and §8.3 is why it still says nothing about what to do first.

### 25.7 Same-date tie fixture

If the plan instead placed Ghibli on the day whose visit date makes its release fall on a date
another record also lands on, both rows appear separately, ordered by day ordinal, then position
within the day, then source-record order. Two rows, two records, two provenances, one shared
calendar date, zero implied relationship.

---

## 26. Expected future domain boundary

Recommended module for Phase 3F-J:

`app/src/lib/reservation-mechanism-calendar.ts`

### 26.1 Responsibilities

- accept the current plan context (ordered places per day, day ordinals, optional day ids,
  `DayAssignment`, `startDate`), the bundled Phase 3F evidence, and an optional explicit reference
  civil date;
- call the existing Phase 3F-D derivation owner per planned place;
- pair each derivation to its exact record by `recordId` and build the existing Phase 3F-F
  presentation;
- optionally evaluate and compose the existing Phase 3F-H relation;
- keep only the derivations that yield a valid, placeable civil date, and drop every other
  derivation without substitute, fallback or placeholder (§12);
- order the resulting items by the §8 contract;
- return a plain, serializable, closed-shape result with exactly the two fields in §7.

### 26.2 Prohibitions

- no React, no JSX, no hooks;
- no `localStorage`/`sessionStorage`/IndexedDB;
- no clock: no `Date.now()`, no ambient `new Date()`, no second reference-date capture;
- no `Intl` timezone conversion, no instant generation;
- no network;
- no Phase 3D parsing (`reservation.leadTime`, `reservation.required`, `ReservationFact`,
  `derivePlaceReservationDateWindow`, `evaluateReservationWindowReference`);
- no re-derivation of any official date, span or fallback;
- no new relation evaluator;
- no mutation of the evidence records, derivations or presentations it receives;
- no ranking, scoring or priority field.

**This module is not implemented by Phase 3F-I.**

---

## 27. Expected Phase 3F-J file scope

Reasonably expected:

- `app/src/lib/reservation-mechanism-calendar.ts`;
- `app/src/lib/reservation-mechanism-calendar.test.ts`;
- a focused presentation helper plus its test, only if row copy needs one beyond the existing
  Phase 3F-F/3F-H helpers;
- `app/src/components/OrderedSequenceBuilder.tsx`;
- a focused component test file;
- `app/src/App.css` (neutral rules only);
- a browser audit script;
- `docs/ROUTE_WIDE_OFFICIAL_RESERVATION_CALENDAR_RUNTIME.md`;
- `docs/ROADMAP.md`.

Not expected:

- `data/reservation-mechanisms.json` or its app parity copy;
- the workbook or canonical places data;
- `reservation-mechanism-date-derivation.ts` (Phase 3F-D arithmetic);
- `reservation-mechanism-reference-date.ts` semantics (Phase 3F-H evaluator);
- `reservation-mechanism-presentation.ts`, beyond a strictly additive field if one proves necessary;
- any Phase 3D module;
- planning-draft schema, storage or `usePlanningDraft.ts`;
- `package.json` / dependencies.

If Phase 3F-J finds broader scope necessary, it must stop and explain why before implementing it.

---

## 28. Required Phase 3F-J validation gate

### 28.1 Test suites

- focused aggregator tests (new), including **synthetic** coverage for the cases no bundled record
  produces: an `application-window` with an invalid edge, and one with `openDate > closeDate` —
  each must yield zero route-wide items, with the edges left untouched;
- focused presentation/component tests (new);
- Phase 3F-D regressions (`reservation-mechanism-date-derivation.test.ts`);
- Phase 3F-B/evidence regressions (`reservation-mechanism-evidence.test.ts`);
- Phase 3F-F regressions (`reservation-mechanism-presentation.test.ts`);
- Phase 3F-H regressions (`reservation-mechanism-reference-date*.test.ts`,
  `OrderedSequenceBuilder.official-reservation-reference-date.test.ts`);
- Phase 3D separation regressions (`reservation-planning.test.ts`,
  `reservation-window-reference*.test.ts`,
  `OrderedSequenceBuilder.reservation-window-reference.test.ts`);
- `OrderedSequenceBuilder.test.ts`.

### 28.2 Repository-native gates

- full `npm test`;
- `npm run lint`;
- `npm run build`;
- `git diff --check` over the PR range **and** the working tree.

Exact file counts, passed counts and failed counts must be reported — never "tests pass".

### 28.3 Browser gate

A dedicated browser audit must pass **twice consecutively after the final code change**, on the same
final code HEAD, with `consoleErrors = []` and `pageErrors = []` and no relaxed assertion. Any code
change after those two passes restarts both from zero.

Where a scenario depends on the device reference date, it must use the same deterministic
`addInitScript` `Date` shim Phase 3F-H established — never the host machine's wall clock, and never a
production test-date prop, query parameter, storage field or planning-draft field.

### 28.4 Required browser scenarios

1. **Chronological order across multiple places** — the §25.6 worked plan renders exactly four rows
   in exactly the order Katsura, Disneyland, Sumo, Ghibli.
2. **Same-date tie order** — two records sharing an anchor date render as two separate rows in the
   deterministic §8.2 order, each with its own place, scope and provenance.
3. **Ghibli** — anchored at its release date, `10:00 (Asia/Tokyo)` visible, no open-state copy.
4. **Disney unknown timezone** — recorded `14:00` visible, unknown-timezone disclosure present, and
   no `Asia/Tokyo` / `JST` / `UTC+9` anywhere in the section.
5. **Katsura representation** — exactly one row, anchored at the open date, both edges visible as a
   span with both recorded times, the anchor disclosed, and **no** separate close-date row anywhere
   in the section.
6. **Sumo applicable** — one row at `6 feb 2027` with no invented clock time.
7. **Sumo not applicable** — **no route-wide row of any kind** for Sumo: the section contains no
   Sumo entry, neutral or otherwise, and no relation for it. The existing per-day Phase 3F-F neutral
   item may still be visible in its own day card, and the audit asserts that it is unchanged.
8. **Coexistence with route-wide Phase 3D** — the builder view's "Reservas por preparar" is
   unchanged and the two surfaces never share a container, heading or count.
9. **Move a place between days** — `Día N`, visit date, anchor date and the row's position in the
   chronology all recompute together.
10. **Change the start date** — every anchor date and the whole order recompute.
11. **Clear the start date** — the entire section disappears.
12. **Reload** — no stale calendar item in the UI, and the persisted draft contains none of the
    derived fields (anchor dates, order, relation kinds, reference date).
13. **Reference-date disclosure** — with a deterministic shimmed date, the section shows the exact
    concrete reference date once, and the relation copy matches Phase 3F-H's vocabulary exactly.
14. **Zero console errors and zero page errors** in every scenario.

**Deliberately not a browser scenario.** The invalid/inverted application span does not exist in the
bundled evidence, and fabricating one in the browser would mean seeding synthetic evidence through a
test seam this design forbids. It is covered by the pure aggregator unit tests (§28.1) instead. The
browser gate stays on real fixtures.

---

## 29. Explicitly deferred after Phase 3F-I

Still not approved:

- current Japan instant or current Japan time;
- Japan business-date semantics;
- timezone conversion of any kind;
- release-time instant comparison;
- booking open/closed state;
- availability or inventory;
- reminders;
- notifications;
- calendar export (`.ics`, Google, Apple, Outlook) and "add to calendar";
- automatic midnight refresh or any background recapture;
- countdowns and days/hours remaining;
- evidence freshness, expiry or TTL;
- automatic source refresh or live source fetch;
- official vs editorial conflict resolution or precedence;
- booking actions, purchase links or booking automation;
- cancellation and refund logic;
- live inventory;
- operator-site browser automation;
- per-item user state (done, dismissed, snoozed, seen);
- grouping the chronology by date (§23.2);
- any route-wide representation of results with no applicable official date — a neutral block, a
  dateless list or a coverage/audit view (§12);
- promoting the route-wide calendar into its own view or modal.

---

## 30. Normative contracts for Phase 3F-J

### Source inputs

1. The aggregator consumes only the inputs listed in §5.1.
2. It reads none of the inputs forbidden in §5.2.
3. Official dates and spans are consumed verbatim from Phase 3F-D; no date arithmetic, alignment,
   fallback or repair is re-implemented.
4. Presentation text and provenance are consumed from the existing Phase 3F-F boundary.
5. The bundled evidence array order is the sole definition of source-record order.
6. The aggregator is pure: same inputs, same output, no mutation of anything it receives.

### Eligibility

7. The surface renders nothing unless the day assignment is valid.
8. The surface renders nothing unless `startDate` is a valid civil date.
9. The surface renders nothing when `chronological.length === 0`; there is no empty heading and no
   explanatory absence message.
10. A `release-date` derivation is eligible exactly when its `releaseDate` is a valid civil date.
11. An `application-window` derivation is eligible exactly when both edges are valid civil dates and
    `openDate <= closeDate`.
12. No other derivation kind is eligible, and no other eligibility rule exists.
13. The surface is chronology-only: every item it contains has a real, placeable civil date.
14. An ineligible derivation produces zero route-wide items, with no fallback of any kind.
15. Eligibility is evaluated per derivation; one place's ineligible record never suppresses or
    promotes another's.
16. No omitted result is ever assigned a substitute, sentinel, borrowed or inherited date, for any
    purpose, anywhere in this surface.

### Chronology semantics

17. The chronological key is `releaseDate` for a release item and `openDate` for a span item.
18. Ordering is ascending by that civil date, compared lexically after validation.
19. No `Date` object, instant or timezone is used to order.
20. The order is declared non-semantic: it is not priority, importance, urgency, scarcity, risk or a
    recommended sequence, in the contract, the copy and the tests.
21. No item is ever labelled first, next, upcoming, current or last.
22. No count, progress indicator, completion state or workload summary is derived from the list.

### Tie-breaking

23. Ties break on day ordinal ascending.
24. Then on the place's position within its day, in the user's explicit order.
25. Then on source-record order.
26. The resulting comparator is total for any valid plan.
27. The sort is stable over an input already built in plan order.
28. No forbidden key from §8.4 participates in ordering.

### Identity

29. Every item carries `recordId`, `placeId` and `scope`, copied from its derivation.
30. Every item carries `dayNumber` and `visitDate`.
31. Every item carries the stable `dayId` when the caller has it, and `null` otherwise; it is never
    invented.
32. Every item carries source entity, consultation date and source URL.
33. Derivations are paired to records by exact `recordId` only.
34. Presentation composition stays fail-closed on any record/place/scope mismatch; a non-composable
    item is omitted, never rendered under a borrowed identity.
35. No record is merged with another.
36. No scope is merged with another.
37. Items are never deduplicated by date, place or name.
38. A duplicate `(recordId, placeId, scope)` triple is an upstream invariant violation, not something
    this phase silently repairs.

### Multiple scopes

39. A place with several active scopes produces one item per scope.
40. Those items stay independent, each with its own scope label and provenance.
41. Their relative order is source-record order, never a ranking.

### Application-window representation

42. An application window produces exactly one chronological item, anchored at `openDate`.
43. That item always renders both recorded edges as a span, with both recorded times and the
    timezone disclosure exactly as Phase 3F-F renders them.
44. The item discloses that it is positioned by the recorded start date of the span.
45. The span connector is neutral and directional; no single-edge or deadline framing is used.
46. No standalone close-date item is created anywhere, in any block.
47. A span whose edges are not both valid civil dates, or whose `openDate` is later than its
    `closeDate`, produces **zero route-wide items** and no fallback row; the edges are never swapped,
    sorted, re-ordered, repaired or direction-inferred, Phase 3F-D is not changed, Phase 3F-H is not
    changed, and a synthetic aggregator unit test pins this rule.

### Results with no applicable official date

48. `not-applicable-to-visit-date`, `not-derivable`, `no-visit-date` and `inactive-evidence` each
    produce zero route-wide items.
49. An ineligible `application-window` (invalid edge, or `openDate > closeDate`) likewise produces
    zero route-wide items.
50. No neutral item, neutral block, secondary list, dateless row, "sin fecha" row, placeholder,
    warning row, error row or count is created for any omitted result; the aggregator result has
    exactly the two fields specified in §7 and no third collection may be added.
51. No new presentation state or copy is invented for an omitted result; omission is chosen
    precisely because it requires none.
52. The existing per-day Phase 3F-F surface is unchanged and remains where these results stay
    visible; omitting them route-wide removes nothing from the product.

### Phase 3F-H reuse

53. The relation is rendered on every row where one is assessable, and comes from
    `evaluateOfficialReservationReferenceDate` unchanged; whether it appears is never a runtime
    product choice.
54. Composition uses `buildOfficialReservationReferenceRelationPresentation` unchanged.
55. No new relation evaluator, relation kind or relation vocabulary is introduced.
56. The relation consumes the one already-captured `reservationReferenceDate`; no second capture,
    recapture, timer, listener or background refresh exists.
57. The concrete reference date is disclosed once at section level, in the same section, always
    rendered when any assessed relation is shown, never collapsible, never labelled `hoy`, `ahora` or
    `actualmente`.
58. A `not-assessed` relation renders no line and no placeholder.
59. The relation never affects ordering, grouping, filtering, visibility or styling.

### Phase 3D separation

60. The Phase 3F route-wide surface and the Phase 3D route-wide surface are never merged, nested or
    given a shared heading, container or count.
61. No Phase 3D value is an input to Phase 3F aggregation, ordering or eligibility.
62. No Phase 3F value alters Phase 3D output.
63. Neither surface is hidden, dimmed or de-emphasised because the other exists.
64. No precedence between official and editorial evidence is declared or implied.
65. Apparent source conflicts are left unresolved and unflagged.

### No ranking or priority

66. No field named priority, rank, score, urgency, importance, status, state or next-action exists.
67. No visual treatment encodes priority, state or risk; all rows share one neutral style.
68. No recommendation, suggestion or call to action appears anywhere in the surface.

### Timezone and instant

69. No timezone conversion, instant generation, `Date.parse` of source strings, offset arithmetic or
    DST logic is introduced.
70. `Asia/Tokyo` remains recorded evidence; `null` remains explicitly unknown; neither is inferred.
71. Recorded clock times are displayed as recorded and compared with nothing.

### No booking state

72. No open, closed, available, unavailable, sold-out, late, missed, deadline, countdown,
    remaining-time or probability claim appears in any item, label, tooltip, aria-label or
    disclaimer.
73. The Phase 3F-H civil-date relation remains the maximum current-date claim.
74. The forbidden vocabulary of §22.3 is asserted absent by test.

### Persistence

75. Nothing about the calendar is persisted: no items, order, anchor dates, relations, reference
    date, per-item user state or derived status.
76. No V8, no schema change, no new storage key, no change to `nihon.manualPlanningDraft`.
77. Evidence JSON, places data, the workbook and package manifests are unchanged.

### Network and automation

78. No network request, fetch, prefetch or source refresh is introduced.
79. No reminder, notification, scheduled task, service worker, calendar export or "add to calendar"
    control is introduced.
80. The official-source link remains an ordinary user-initiated provenance link.

### Recomputation

81. The surface recomputes from current state on route change, day-assignment change, start-date
    change and intra-day reordering.
82. The surface disappears when the start date is cleared or the day assignment becomes invalid.
83. A place leaving the plan removes its items; a place changing day recomputes its day number, visit
    date, anchor date and position together.
84. A reload rebuilds the surface from the persisted plan and bundled evidence only; no stale item
    can survive, because nothing is stored.
85. Recomputation uses ordinary derivation — no cache, no effect that writes state, no listener.

### Real fixtures

86. Ghibli's `2027-01-10` release from a `2027-02-20` visit appears as one item with its recorded
    `10:00 (Asia/Tokyo)` visible.
87. Disneyland's `2026-12-20` release from a `2027-02-20` visit appears with `14:00` and an explicit
    unknown-timezone disclosure and no JST inference.
88. DisneySea's already-resolved `2027-03-01` fallback release is consumed as given, and the nominal
    `2027-02-30` never appears anywhere.
89. Katsura's `2026-12-01 → 2027-03-12` window appears as exactly one item anchored at the open date,
    with both edges and both recorded times visible.
90. Osaka Sumo inside the recorded event period appears as one item at `2027-02-06` with no invented
    time.
91. Osaka Sumo outside the recorded event period produces no chronological item.
92. The §25.6 worked plan produces exactly the four rows in exactly that order.

### Browser validation

93. A dedicated browser audit covers every scenario in §28.4.
94. Any scenario depending on the device reference date fixes the browser's civil date before app
    boot with the Phase 3F-H deterministic shim and asserts it took effect.
95. No production test-date prop, query parameter, storage field or planning-draft field is
    introduced for testing.
96. The audit asserts `consoleErrors = []` and `pageErrors = []`.
97. The audit passes twice consecutively on the same final code HEAD after the last code change.
98. Any code change after those two passes restarts both audits from zero.
99. Focused, full, lint, build and both `git diff --check` gates all pass on that same final code
    HEAD, with exact counts reported.
100. Phase 3F-J opens as a Draft PR and is not marked Ready by the implementing session.

---

## 31. Hostile design review of this gate

Performed against this document before the pull request was opened. Every finding below was fixed
here; none required a runtime or data change, because none exists yet.

| # | Question | Verdict |
| --- | --- | --- |
| 1 | Does chronological ordering accidentally imply priority? | Addressed. §8.3 declares the order non-semantic; contracts 20–22 forbid first/next/upcoming/current/last labels, counts, progress and workload readings; §22.3 bans the vocabulary; §22.4 forbids any styling that encodes state. |
| 2 | Are application-window edges represented honestly? | Addressed. §24 chooses one range item, rejects the milestone split with reasons, and makes four mitigations mandatory — both edges always rendered, anchor disclosed, neutral connector, no synthesised close-date row. **Finding:** an unordered/invalid span had no specified disposition and would have been anchored after its own end. Fixed in §6.2 and contract 47. |
| 3 | Are same-date ties deterministic? | Addressed. §8.2 fixes four keys and argues totality from the uniqueness of a `(place, record)` pair in a valid plan; a stable sort over plan-ordered input is required. |
| 4 | Does any item lose record/place/scope identity? | Addressed. §9.1–9.4; composition reuses the two existing fail-closed boundaries and omits anything non-composable. **Finding:** a neutral item type was referenced but never defined, so its identity obligations were implicit. Initially defined in §7; subsequently removed altogether by the §31.1 corrective, which leaves one item type and one set of identity obligations. |
| 5 | Is Phase 3D accidentally merged with Phase 3F? | Addressed. §13.1 records the audited fact that the two route-wide surfaces already live in different views; §13.2 forbids merging, shared counts, precedence and mutual suppression. |
| 6 | Does relation reuse accidentally imply current booking state? | Addressed. §11 reuses the shipped evaluator verbatim, forbids a new one, keeps the vocabulary byte-identical, and §11.3 keeps the relation out of ordering, grouping, filtering and styling. §17 restates the ceiling. |
| 7 | Are non-date statuses kept out of the chronology? | Addressed, and later strengthened. The original answer kept them out of the chronology but allowed them into an optional neutral block; the §31.1 corrective removes that block entirely, so they are now out of the whole surface (§12). |
| 8 | Does any copy imply availability or urgency? | Addressed. §22.1 rejects "Calendario oficial de reservas" for exactly this reason and chooses a fact-noun heading; §22.2 mandates the "order is not priority" sentence; §22.3 lists the banned vocabulary and contract 74 makes it testable. |
| 9 | Is provenance retained? | Addressed. §9.1 and §10 require source entity, consultation date and source URL on every row, via the existing Phase 3F-F provenance text. |
| 10 | Is any timezone conversion sneaking in? | Addressed. §16 forbids conversion, instants, offsets and DST. **Finding:** a naive `Intl` source-scan would contradict the existing UTC-pinned `formatCivilDateDisplay` and push a successor toward hand-rolled formatting. Clarified in §16: the ban is absolute for the aggregator, and formatting stays where it already lives. |
| 11 | Is persistence still unnecessary? | Addressed. §19 and contracts 75–77; §20 notes that no stale item can survive a reload by construction, and §28.4 case 12 still requires proving it. |
| 12 | Are reminders and calendar automation still deferred? | Addressed. §18 and §29. The surface deliberately looks like an agenda, which is exactly why the deferral is restated as its own section rather than folded into a list. |
| 13 | Is recomputation after plan edits explicit? | Addressed. §20 and contracts 81–85 name each triggering edit, including intra-day reordering, which is an ordering input via tie-break key 3. |
| 14 | Are the browser gates sufficient for the runtime successor? | Addressed. §28.4's fourteen scenarios cover order, ties, every real fixture, the Katsura single-row rule, Phase 3D coexistence, all four recomputation paths, reload and the error gate; §28.3 requires two consecutive passes on the final code HEAD with the Phase 3F-H deterministic date shim. |

Two further documentation defects were found and fixed: a cross-reference pointing at the wrong
fixture section, and a sentence in §25.6 whose phrasing was both meaningless and at risk of reading
as commentary on importance. A missing rule for empty blocks was also added to §5.3, so a heading is
never rendered above an empty list and absence is never announced as a finding.

### 31.1 Independent-review corrective — the non-date policy is now closed

**Finding.** The non-date policy was left open in two connected ways.

First, §12.4 declared the route-wide neutral block *"optional for the runtime"*. A design gate whose
purpose is to make implementation mechanical cannot leave a product decision to the implementer.

Second — and this is what made the first problem concrete — the same section required the neutral
block to *"reuse the existing Phase 3F-F neutral copy verbatim"*, while §6.2 simultaneously routed an
**inverted** application span (`openDate > closeDate`, both edges individually valid) into that
block. Those two instructions cannot both be satisfied. Phase 3F-F has no neutral presentation for an
inverted span: `buildOfficialReservationDatePresentation` does not validate edge ordering, so for
that derivation it still returns `kind: "application-window"` with its ordinary `Inicio:` /
`Fin registrado de la ventana:` detail lines. Phase 3F-H is the phase that refuses the span, and it
refuses it only for the *relation*, not for the presentation. Honouring the design as written would
therefore have forced Phase 3F-J to invent a presentation state and copy that this gate never
designed — exactly the undesigned decision the gate exists to prevent.

**Corrective.** Phase 3F-J is **chronology-only**. The route-wide surface contains only official
facts with a valid, placeable civil date. The neutral block, the neutral item type and the
`withoutApplicableDate` collection are removed from the design entirely. Results with no applicable
date are omitted from this surface and stay visible in the per-day Phase 3F-F surface they already
have. §12 states the policy, the per-kind disposition and five independent reasons; §5.3, §6.2, §7,
§8.5, §24.4, §25.5, §26.1, §28 and contracts 9–16, 47 and 48–52 were all brought into line.

**Post-corrective hostile re-review.** All fifteen required checks, verified against the document as
it now stands:

| # | Check | Verdict |
| --- | --- | --- |
| 1 | Does Phase 3F-J still have optional product decisions? | No. "optional for the runtime", "may appear" and "if shipped" are gone from the successor specification; §12.1 states the policy is a decision, not a preference. |
| 2 | Does every route-wide item have a real chronological date? | Yes. Contract 13 states it; contracts 10–11 define eligibility as *having* a valid date; §7's result type has one collection and every member carries `anchorDate`. |
| 3 | Do non-date statuses receive a date? | No. Contract 16 forbids substitute, sentinel, borrowed and inherited dates for any purpose anywhere in the surface; §12.4 restates it absolutely. |
| 4 | Does an inverted span get a neutral fallback? | No. §6.2 and contracts 47, 49 and 50: zero route-wide items, no fallback row, no swap, sort, repair or inferred direction, and a synthetic unit test pins it. |
| 5 | Is Phase 3F-F's per-day surface untouched? | Yes. §12.5 and contract 52 state that it renders exactly what it renders today, including the `not-applicable` and `not-derivable` states. |
| 6 | Is chronology still declared ≠ priority? | Yes. §8.3 and contracts 20–22 are unchanged by this corrective. |
| 7 | Is the tie-break still total and deterministic? | Yes. §8.2 is unchanged; removing a second collection removes an ordering rule (§8.5) without touching the chronological comparator. |
| 8 | Is Katsura still one range item? | Yes. §24 and §25.4 are unchanged; contract 46's "in any block" was reworded only because there is no other block. |
| 9 | Is Phase 3F-H reuse unchanged? | Yes. §11 and contracts 53–59 are untouched; the corrective adds no relation behaviour and removes none. |
| 10 | Does Phase 3D stay separate? | Yes. §13 and contracts 60–65 are untouched. |
| 11 | Any current-state semantics introduced? | No. §17 and contracts 72–74 are untouched; a smaller surface adds no claims. |
| 12 | Any timezone or instant introduced? | No. §16 and contracts 69–71 are untouched; eligibility compares two validated civil-date strings. |
| 13 | Any persistence introduced? | No. §19 and contracts 75–77 are untouched. |
| 14 | Any automation introduced? | No. §18 and contracts 78–80 are untouched; §29 additionally defers any future dateless/coverage view. |
| 15 | Does the runtime scope get smaller? | Yes — strictly. One collection instead of two, one item type instead of two, one ordering rule instead of two, one conditional block instead of two, no second heading, no second copy family, and one fewer browser scenario shape. Nothing was added. |

The sweep found one further residual discretion beyond the reported finding, and it was fixed too:
§11 opened with "the existing relation **may** be shown", which left a second product choice open in
the same way the neutral block did. It now states that Phase 3F-J renders the relation on every row
where one is assessable, with the conditionality purely mechanical; contract 53 was tightened to
match.

No contradictory statement survived the sweep: `withoutApplicableDate`, the neutral item type,
"may appear", "if shipped" and "optional neutral block" no longer appear anywhere in the successor
specification. The contract set remains exactly **100**.

---

## 32. Acceptance gate

Accept Phase 3F-I only if review agrees that:

1. an aggregated second view of facts that already exist adds no new claim;
2. chronological order can be declared non-semantic and kept that way by contract, copy and tests;
3. the four-key ordering contract is deterministic and total;
4. one item per record, anchored at the open date, is a more honest representation of a recorded
   application window than two milestone rows;
5. record, place, scope, day and provenance identity survive aggregation intact;
6. results with no applicable official date must be omitted from this surface entirely rather than
   given a synthetic date or a neutral row, and the per-day Phase 3F-F surface is where they stay
   visible;
7. reusing the Phase 3F-H relation verbatim introduces no new current-state claim;
8. the Phase 3D editorial surface and the Phase 3F official surface stay separate — structurally, in
   different views;
9. source conflicts and evidence freshness both stay unresolved and unflagged;
10. no timezone, instant or clock-time comparison is required by any part of this design;
11. no persistence, schema, storage, data or dependency change is required;
12. reminders, notifications and calendar export stay deferred even though the surface looks like an
    agenda;
13. recomputation after every plan edit is specified and browser-verifiable;
14. the §28 gate is sufficient for a UI-visible successor.

---

## 33. Conclusion

Phase 3F-I approves **a second view of existing facts, ordered by date and nothing else** — and
containing nothing else either: every row has a real civil date, and a result without one has no
route-wide representation at all.

The app may eventually show, in one place:

- every official reservation date already derived for the current plan;
- each one bound to its place, its `Día N`, its visit date, its scope and its source;
- ordered by recorded civil date, with a deterministic tie-break;
- with the existing civil-date relation to the disclosed device reference date, where one applies.

The app still may not say:

- what to reserve first;
- what is most important or most urgent;
- that a sale is open, closed, or about to close;
- that tickets are available or running out;
- that the reader is late or on time;
- that a date is a deadline;
- that anything should be added to a calendar or remembered for them.

**Recommended successor: Phase 3F-J — Route-Wide Official Reservation Calendar Runtime. NOT
STARTED.**
