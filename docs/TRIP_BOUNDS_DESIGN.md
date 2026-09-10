# Phase 3D-V — Trip Bounds Design Gate

Status: **APPROVE a narrow manual successor**.

Approved representation: **`endDate: string | null` on a new `ManualPlanningDraftV6`**, plus a
purely derived out-of-bounds assessment. Rejected: `tripLengthDays: number | null`, deriving the
end from `days.length`, and adding nothing at all.

Recommended successor: **Phase 3D-W — Trip Bounds Runtime** (NOT started by this gate).

This document is design/audit only. Phase 3D-V does not change runtime code, UI, persisted data,
schema versions, dataset content, tests, dependencies, routing, live transit, hotel search,
luggage logic, flights, airports, clock times, timezone scheduling, or booking integration.

---

## 1. Problem

Phase 3D-U closed the manual day-editing surface. The canonical persisted planner state is:

```ts
type ManualPlanningDraftV5 = {
  version: 5;
  routeIds: string[];
  days: PlanningDayV5[] | null;
  startDate: string | null;
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  accommodationLegs: ManualAccommodationLeg[];
};

type PlanningDayV5 = {
  id: string;
  placeIds: string[];
  accommodationBoundary: DayAccommodationBoundary;
};
```

`startDate` is the civil anchor of Día 1 and nothing else. Día N is
`addCivilDays(startDate, N - 1)`; the ordinal N comes exclusively from the position in
`PlanningDayV5[]`; a stable day id encodes neither date, ordinal, city, hotel nor position
(`app/src/lib/planning-draft-v5.ts`, `app/src/components/OrderedSequenceBuilder.tsx:1817`).

**There is no upper calendar bound anywhere in the model.** That absence has been recorded three
times as a deliberate scope decision, not an oversight:

- `RESERVATION_DEADLINE_DESIGN.md` §12.2.1 — "assignment outside trip bounds" is *not a
  representable state*, because there is no trip end date; a future implementation must not invent
  handling for it, and must not add a field in order to create it.
- `OPENING_HOURS_CLOSURE_COMPOSITION_DESIGN.md` §"Explicitly rejected" — repeats the same
  prohibition verbatim in spirit for the composed hours/closure signal.
- `STABLE_DAY_IDENTITY_DESIGN.md` §non-goals and `MANUAL_DAY_REORDERING_DESIGN.md` §21 — a new
  trip-end-date model, trip-end-date persistence and schema V6 were each explicitly left out of
  scope.

Those statements are correct *about their own phases*. None of them says a trip end date is
conceptually wrong; each says it was not that phase's job and must not be smuggled in. This gate is
the phase whose job it is.

The gap is real and observable. A user typically knows both civil endpoints of the trip — the day
they arrive and the day they leave — **before and independently of** having split anything into
day buckets. Today Nihon can record the first and cannot record the second. The consequences:

- `days: null` with a fully known trip range is unrepresentable; the range is simply lost.
- A user who creates 15 day buckets for a 12-day trip gets no signal of any kind. Every derived
  date, weekday closure signal, hours composition and reservation window is computed and presented
  for Día 13, 14 and 15 exactly as confidently as for Día 1.
- The application silently presents dates the user is not in Japan for as ordinary trip days.

That last point is the actual product harm, and it is a *presentation* harm, not an arithmetic one.

---

## 2. Executive decision

**Approved.** Nihon persists one new field:

```ts
endDate: string | null;
```

on a new canonical schema `ManualPlanningDraftV6`, under the SAME storage key
`nihon.manualPlanningDraft`, migrated from V5 with `endDate: null` and never with a value invented
from `days.length`.

`endDate` is **the last civil calendar date the user considers part of the trip**. The range
`[startDate, endDate]` is **inclusive on both ends**.

Everything else this gate approves is **derived on read and never persisted**: the calendar-day
count, and a three-state per-day bounds assessment.

**Not approved, and explicitly forbidden to the successor:** any automatic creation, deletion,
truncation, reordering or repair of day buckets to make them agree with the range; any inference of
nights, check-in/check-out, flights, airports, arrival/departure clock times, timezones or luggage;
any recommendation about how long a trip should be.

The decision is deliberately asymmetric: **the range is a user decision that Nihon records and
reports against; the day buckets are a user decision that Nihon never touches.** A mismatch between
them is a fact to be shown, not a defect to be corrected.

---

## 3. Alternatives compared

Four candidates were required to be compared explicitly rather than assumed. All four were
evaluated against the same test: *does it let a user record what they actually know, without
coupling the civil range to the bucket assignment?*

### 3.1 Alternative A — `endDate: string | null` — **APPROVED**

A civil date, structurally symmetric with the existing `startDate`.

Arguments for:

- **It is the thing the user knows.** A traveller knows "vuelvo el 5 de marzo", not "mi viaje dura
  15 días" — the count is something they would derive by counting, which is exactly the direction
  of derivation Nihon should perform on their behalf.
- **It is standalone evidence.** A civil date is meaningful on its own, before a start date exists,
  before a route exists, and with `days: null`. A duration is not: `tripLengthDays: 15` with
  `startDate: null` denotes nothing at all.
- **It reuses a proven, timezone-safe primitive.** `YYYY-MM-DD` validated by `isValidCivilDate`,
  offset by `addCivilDays`, both already component-based via `Date.UTC`/`getUTC*` and already the
  storage form of `startDate` (`app/src/lib/civil-date.ts`).
- **Inclusivity is expressible once and unambiguously.** `end == start` is a one-day trip. There is
  no off-by-one for the reader to guess.
- **It cannot degrade into a bucket count.** A date is not a number of buckets, so no code path is
  tempted to compare it directly against `days.length` and "fix" the difference.

Arguments against, and their resolution:

- *It introduces a second nullable date and therefore a partial-range state.* Accepted deliberately
  and specified in §6 — the partial state is the honest representation of partial knowledge.
- *It allows an inverted range (`end < start`).* Accepted deliberately and surfaced as a derived
  failure state (§6.5, §9.2) rather than prevented by a cross-field write rule that would force
  silent repair.

### 3.2 Alternative B — `tripLengthDays: number | null` — **REJECTED**

Arguments considered in its favour: it is one field instead of a second date; it makes
`tripCalendarDays` a stored fact rather than a derived one; it survives a `startDate` change
without becoming inverted.

Rejected for five reasons, any one of which is sufficient:

1. **It is not standalone.** Without `startDate` it bounds nothing. It cannot record what a user
   knows before choosing a departure date, which is precisely the independence this gate exists to
   establish.
2. **It reintroduces the inclusive/exclusive ambiguity the gate is required to eliminate.** "15
   días" and "15 noches" differ by one, and the distinction is exactly where travel software
   habitually lies. A `number` field carries no evidence of which one it is; a second civil date
   carries it structurally.
3. **It is shaped like `days.length`.** A `number` next to an array whose `.length` is also a
   number is a standing invitation for a future contributor to compare them and "reconcile" — to
   auto-append buckets up to the length, or truncate down to it. §7 forbids that, but a
   representation that makes the forbidden operation look natural is a worse representation.
4. **It stores derived data.** The count is a function of the two endpoints. Storing the function's
   output instead of its input means a `startDate` change silently redefines which civil day the
   trip ends on — the trip would slide, which no user asked for.
5. **It is strictly worse at the one job.** Answering "is Día 13 after the end of my trip?" from a
   length requires reconstructing the end date anyway.

### 3.3 Alternative C — derive the end exclusively from `days.length` — **REJECTED**

This is the only alternative that adds no persisted field, so it deserves a real hearing. It is
rejected as **conceptually circular**, and it is the alternative the gate's own escape clause
("redundant with `days.length`") was written to test.

- It **cannot represent the problem it is supposed to solve.** If the end is defined as
  `startDate + days.length - 1`, then no day bucket can ever be after the end — the last bucket
  *is* the end, by construction. "Out of bounds" remains permanently unrepresentable. This
  alternative does not answer the gate's question; it re-states the current situation with extra
  words.
- It **inverts the dependency the whole model is built on.** `days` is downstream, invalidatable
  state: a route composition change sets it to `null` (`withRoute`), `resetRoute` clears it
  outright, and `reconcileDraft` drops it when a prune breaks the partition. `startDate` is upstream
  and deliberately survives all three. Deriving the trip's end from `days` would make the trip's
  civil extent evaporate whenever the route changes and reappear when it is re-split — a trip that
  changes length because the user removed a place is nonsense.
- It **makes ordinary editing rewrite the calendar.** Adding one empty day would lengthen the trip
  by a day; deleting one would shorten it. The user's stated travel dates would be a side effect of
  bucket manipulation.
- It **contradicts `days: null` semantics.** `days: null` means "no assignment currently exists",
  never "the trip has no duration".

**`endDate` is therefore not redundant with `days.length`. They are independent facts** — one is
the civil extent of the trip, the other is how many buckets the user has built so far — and their
disagreement is the informative signal this gate is chartered to make visible.

### 3.4 Alternative D — add nothing yet — **REJECTED, with the reasoning recorded**

The gate is explicitly permitted to resolve here, and this option was held open until the end.

The case for it: three prior contracts recorded "no trip end date" as settled; every existing
temporal evaluator works correctly without one; nothing is currently broken in the arithmetic
sense; and the honest observation that `endDate`'s entire value is realized through a *derived
assessment* rather than through the stored field itself.

The case against, which prevailed:

- Each prior statement scoped the exclusion to its own phase and none argued the model is wrong.
  `RESERVATION_DEADLINE_DESIGN.md` §12.2 forbids inventing handling for a nonexistent state and
  forbids adding a field *there*; it does not forbid a later gate from deciding the state should
  exist. This document supersedes those statements **only** on the question of whether a trip end
  date may exist, and leaves every other clause of them intact.
- The harm is present and user-visible today (§1): Nihon presents dates outside the trip with full
  confidence and no annotation.
- Deferring again costs more than it saves. `PlanningDayV5` reached its final shape in 3D-S/3D-U;
  the successor's migration is a one-field addition now, and would be a strictly larger change if
  bundled into a later phase.
- The "value is only in the derived layer" objection is correct and is not an argument against the
  field — it is an argument for keeping the field inert, which §5 and §8 do.

**Conclusion: approve Alternative A.**

---

## 4. Range semantics

### 4.1 What the two endpoints mean

| Field | Meaning |
|---|---|
| `startDate` | The civil calendar date of Día 1. **Unchanged from Phase 3C-E — this gate does not redefine it.** |
| `endDate` | The **last civil calendar date the user considers part of the trip**. |

Both are `YYYY-MM-DD`, both are validated by `isValidCivilDate`, and both are **civil dates**: a
calendar day as written on a calendar, with no time-of-day and no timezone.

### 4.2 What the endpoints are explicitly NOT

Recorded so a successor never widens them by implication, and so no UI copy ever suggests them:

| Not | Why it is different |
|---|---|
| A flight time | A flight departs at a clock time; a civil date has none. |
| A UTC instant | An instant is a point on a global timeline; a civil date is a calendar square. `2027-03-05` is not `2027-03-05T00:00:00Z`. |
| A timezone | Neither endpoint carries or implies one. JST is never assumed, stored or applied. |
| A check-in or check-out date | Those are accommodation facts owned by the accommodation domain, which this gate does not touch (§10). |
| A number of nights | Nights are not calendar days minus one in general; the relationship depends on arrival and departure accommodation semantics that do not exist in this model. **Nights are never inferred** (§4.4). |
| A flight duration | Elapsed travel time is not a calendar extent. |
| A booking, itinerary or reservation | `endDate` is a user's private note about their own calendar. |

### 4.3 The range is inclusive

`[startDate, endDate]` includes both endpoints. `endDate === startDate` is a **valid one-day trip**,
not an empty range and not an error.

The derived count, approved **only** as a read-model value and only under this definition:

```
tripCalendarDays = differenceInCivilDays(startDate, endDate) + 1
```

defined **exclusively** when all of the following hold:

1. `startDate !== null` and `isValidCivilDate(startDate)`;
2. `endDate !== null` and `isValidCivilDate(endDate)`;
3. `endDate >= startDate` (lexical comparison on validated fixed-width `YYYY-MM-DD` is identical to
   calendar comparison — the same property `evaluateReservationWindowReference` already relies on).

Otherwise `tripCalendarDays` **does not exist**. It is never `0`, never negative, never a fallback,
never `days.length`.

**Audit finding — the helper does not exist yet.** `app/src/lib/civil-date.ts` currently exports
`isValidCivilDate`, `addCivilDays`, `formatCivilDateDisplay`, `getCivilWeekday` and the
`CivilWeekday` vocabulary. There is **no `differenceInCivilDays`** anywhere in the repository. The
successor must add it as a pure civil-date helper in that module, and it must:

- read and write calendar components through `Date.UTC(...)`/`getUTC*` exclusively, exactly like
  every existing function in that module, so the result is timezone-invariant;
- return `null` — never a guess and never `0` — when either argument is not a valid civil date;
- return a signed whole number of calendar days (negative when `to` precedes `from`), so the
  inverted-range case is detectable rather than absorbed.

### 4.4 Nights are not derivable and must not be inferred

`tripCalendarDays - 1` is **not** the number of nights and must never be presented, stored, or used
as one. Whether the first and last calendar days involve a hotel night depends on arrival and
departure semantics that this model does not have and that this gate does not create (§10, §11).
Any night count requires its own separate contract in a future gate.

---

## 5. Independence from `days` — the load-bearing invariant

> **The civil range and the day-bucket assignment are two independent user decisions. Neither is
> ever derived from, validated against, reconciled with, or repaired to match the other.**

Trip bounds are **trip-scoped**, exactly like `startDate` and `accommodations`, and unlike
`routeIds`, `days`, `visitStartTimes` and `accommodationLegs`, which are route- or day-scoped.

### 5.1 Required behaviour, case by case

Every case the gate requires be resolved:

| # | Case | Required behaviour |
|---|---|---|
| 1 | `startDate` and/or `endDate` known, `days: null` | Both persist and are shown. No assignment is created. No per-day assessment exists (there are no days). `tripCalendarDays` is computed if both endpoints are valid and ordered. |
| 2 | Fewer buckets than calendar days | Allowed and normal. Every bucket is `within-bounds`. UI may state both counts neutrally. **No bucket is created.** |
| 3 | Exactly as many buckets as calendar days | Allowed. Every bucket is `within-bounds`. Not privileged, not "correct", not celebrated. |
| 4 | More buckets than calendar days | Allowed and persisted. Buckets at ordinal `>= tripCalendarDays` are `after-trip-end`. **Nothing is deleted, truncated, merged, reordered or reassigned.** |
| 5 | Empty days | An empty day is a real bucket. It occupies an ordinal, derives a date, and is assessed exactly like a non-empty one. Emptiness is never a licence to drop it to fit the range. |
| 6 | Adding an empty day | `withNewEmptyDay` is unchanged. The new day may land `after-trip-end`; that is a reportable outcome, not a rejection. The range is **not** extended to accommodate it. |
| 7 | Deleting an empty day | `withoutEmptyDay` is unchanged, including its existing refusal to delete the last remaining day. The range is **not** shortened to follow. |
| 8 | Moving/reordering days | `withDayMoved` is unchanged. Entities swap positions; each day's assessment is recomputed from its **new** ordinal. A day can move into or out of bounds. No id, `placeIds`, boundary or leg changes. |
| 9 | Moving places between days | `withPlaceMovedBetweenDays` / `withPlaceMovedWithinDay` are unchanged. Bucket count and ordinals are unaffected, so every assessment is unaffected. **No place is ever relocated because its day is out of bounds.** |
| 10 | Route composition change invalidating `days` | `withRoute` sets `days: null` exactly as today. `startDate` and `endDate` both **survive** — the trip's civil extent is not a property of the route. |
| 11 | `resetRoute` ("Restablecer recorrido") | `days: null`, day ids gone, anchors survive — exactly as today. `startDate` and `endDate` both **survive**, matching `resetRoute`'s existing explicit preservation of `startDate` (`planning-draft.ts`). |

### 5.2 The prohibition, stated once and absolutely

Setting, changing or clearing `startDate` or `endDate` must **never**:

- create a day bucket;
- delete a day bucket;
- truncate the day array;
- reorder the day array;
- move a place between days;
- change any `placeIds`;
- mint, regenerate or reassign a day id;
- alter any `accommodationBoundary`;
- add, remove or rebind an `accommodationLeg`;
- add, remove or modify an `AccommodationAnchor`;
- change `routeIds`;
- change any `visitStartTimes` entry;
- write a date, weekday or ordinal into a day entity.

Symmetrically, no day mutation may ever write to `startDate` or `endDate`.

---

## 6. Validation and null-state policy

### 6.1 Per-field validation, never cross-field at write time

Each endpoint is validated **independently and identically**: the value must be `null` (explicitly
unset) or a real civil date accepted by `isValidCivilDate`. An invalid value is **rejected outright
and the draft returned unchanged** — never coerced, never truncated, never normalized, never
partially applied. This is exactly the existing `withStartDate` contract, extended to a second
field.

### 6.2 Complete state table

| `startDate` | `endDate` | Persisted? | `tripCalendarDays` | Per-day assessment |
|---|---|---|---|---|
| `null` | `null` | yes | absent | `bounds-unavailable` (`no-start-date`) |
| valid | `null` | yes | absent | `bounds-unavailable` (`no-end-date`) |
| `null` | valid | **yes** — see §6.3 | absent | `bounds-unavailable` (`no-start-date`) |
| valid | valid, `end === start` | yes | `1` | assessed; ordinal `0` is `within-bounds`, every ordinal `>= 1` is `after-trip-end` |
| valid | valid, `end > start` | yes | `n >= 2` | assessed normally |
| valid | valid, `end < start` | **yes** — see §6.5 | absent | `bounds-unavailable` (`inverted-range`) |
| invalid input | — | **no** — write rejected, draft unchanged | unchanged | unchanged |
| — | invalid input | **no** — write rejected, draft unchanged | unchanged | unchanged |

### 6.3 Policy decision: `endDate` MAY exist while `startDate === null`

The gate requires an explicit choice between permitting this as an independent decision and
prohibiting it because no range can yet be formed. **Permitted.**

Compared:

- *Prohibit.* Requires a cross-field rule at write time: either reject an `endDate` write while
  `startDate` is null, or clear `endDate` when `startDate` is cleared. The first discards
  information the user deliberately entered; the second is a **silent repair of a neighbouring
  field**, which every parser and mutation contract in this codebase forbids. It also creates an
  ordering trap: a user who knows their return date first must invent a start date to record it.
- *Permit.* Each field independently records one thing the user knows. The *range* is a derived
  concept that simply does not resolve until both endpoints exist, which the assessment already
  reports as `bounds-unavailable`. Nothing downstream can misread it, because every consumer goes
  through the assessment.

**Chosen: permit.** Storing a known fact is never harmful; deriving a range from an incomplete pair
would be, and the derived layer refuses to.

Note the deliberate asymmetry with Día 1: `startDate` is a *positional anchor* that ordinal
arithmetic depends on, so without it there are no dates at all. `endDate` is a *boundary* that only
the assessment consumes. `bounds-unavailable(no-start-date)` therefore takes precedence in the
table above whenever `startDate` is missing, regardless of `endDate`.

### 6.4 Clearing

Either field may be cleared to `null` independently, at any time, through the same explicit
"Quitar fecha" affordance the planner already offers for `startDate`. Clearing one **never** clears,
sets or adjusts the other, and **never** touches `days` (§5.2). Clearing `endDate` returns the
model to exactly today's behaviour: no upper bound, every day `bounds-unavailable(no-end-date)`.

### 6.5 Policy decision: `end < start` is storable and surfaced, never prevented and never repaired

The obvious alternative — reject the write that would invert the range — was rejected:

- It **traps the user mid-edit.** Moving an existing trip later requires setting a new `startDate`
  that is temporarily after the stored `endDate`. A cross-field guard would refuse the first of the
  two edits and force the user to clear a field they intend to keep.
- It **tempts silent repair.** The natural workaround — auto-shifting `endDate` when `startDate`
  passes it — invents a decision the user never made, and would move the trip's end without asking.
- It **is unnecessary**, because the derived layer already has an honest answer.

So: both writes succeed independently, the pair is stored as entered, and the derived assessment
resolves to `bounds-unavailable` with reason `inverted-range`. The UI shows an explicit, neutral
notice (§9.2). Nothing is auto-corrected and no day bucket is affected.

**Critical parser consequence.** The strict all-or-nothing parser validates each field's civil-date
shape and **must NOT enforce the order relation**. `end < start` is a state the running application
can legitimately produce; making it a parse invariant would turn a reachable transient state into
whole-draft corruption on the next reload, discarding the user's entire route, days, hotels and
legs. Shape is a parse invariant; the order relation is a derived assessment.

---

## 7. Derived out-of-bounds assessment

The state that three prior contracts correctly called unrepresentable — **Día N after the end of
the trip** — becomes representable. It gets an explicit derived vocabulary, and nothing else.

### 7.1 Approved shape

```ts
type TripBounds = {
  startDate: string | null;
  endDate: string | null;
};

type TripBoundsUnavailableReason =
  | "no-start-date"
  | "no-end-date"
  | "invalid-date"
  | "inverted-range";

type TripBoundsAssessment =
  | { kind: "bounds-unavailable"; reason: TripBoundsUnavailableReason }
  | { kind: "within-bounds"; dayDate: string; ordinal: number; tripCalendarDays: number }
  | { kind: "after-trip-end"; dayDate: string; ordinal: number; tripCalendarDays: number };
```

Evaluated per day, from `(bounds, ordinalIndex)` where `ordinalIndex` is the zero-based array
position — the same ordinal every existing consumer already uses. `ordinal` is echoed back for
presentation only; it is never stored and never read as identity.

Resolution order: `no-start-date` → `no-end-date` → `invalid-date` → `inverted-range` → compare
`ordinal` against `tripCalendarDays`; `ordinal < tripCalendarDays` is `within-bounds`, otherwise
`after-trip-end`.

### 7.2 Why there is no `before-trip-start`

Día 1 **is** `startDate` by definition and ordinals are non-negative, so no bucket can precede the
range. The absence is structural, not an omission — recorded here so no successor adds a fourth,
permanently-unreachable state.

### 7.3 Placement — a planning/composition layer, not the pure evaluators

The gate requires preferring an assessment layer over rewriting existing evaluators. Adopted:

- a **new pure module** (`app/src/lib/trip-bounds.ts`) owning `TripBounds`,
  `TripBoundsAssessment` and the pure evaluator, depending only on `civil-date.ts`;
- a thin **planning-layer composition** that pairs each day's existing derived date with its
  assessment for the UI;
- **zero changes** to `deriveVisitDateForPlace`, `deriveReservationDateWindow`,
  `derivePlaceReservationDateWindow`, `evaluateReservationWindowReference`,
  `buildDayWeekdaySignal`, `assessWeekdayClosure`, `derivePlaceHoursClosureComposition`,
  `evaluateRecordedIntervalFit`, `buildDayAssignment`, `validateDayPartition` or
  `orderedSequenceFromLookup`.

No day id is passed into it, matching the identity/ordinal boundary
`dayMatrixFromPlanningDays` already enforces.

### 7.4 Prohibitions on the assessment

It must never: convert an out-of-range day into a valid one; delete or hide the day; change its
stable id; move its places; reorder days; alter `accommodationBoundary` or any leg; write anything
back to the draft; or be persisted in any form.

---

## 8. Persistence and migration

### 8.1 `ManualPlanningDraftV6` is required

The gate requires evaluating whether a version bump is genuinely necessary. It is.

The alternative — keep `version: 5` and treat a missing `endDate` as `null` on read — is a
**tolerant parse**, and the V5 parser is deliberately intolerant: it rejects the whole draft rather
than repairing part of it. Under a tolerant rule, a draft missing `endDate` because it predates the
feature and a draft missing `endDate` because it was corrupted are indistinguishable. The version
field is exactly the evidence that distinguishes them, which is what it is for. It is also how V4 →
V5 handled the same situation.

```ts
type ManualPlanningDraftV6 = {
  version: 6;
  routeIds: string[];
  days: PlanningDayV5[] | null;
  startDate: string | null;
  endDate: string | null;      // ← the only addition
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  accommodationLegs: ManualAccommodationLeg[];
};
```

`PlanningDayV5` is **unchanged and keeps its name** — no day-level field is added, and the day
entity's shape is not what this version bump is about.

### 8.2 Storage key

**`nihon.manualPlanningDraft`, unchanged.** No second key, no side-car store, no separate
trip-bounds record. The existing `PLANNING_DRAFT_STORAGE_KEY` export continues to be the single
key.

### 8.3 Migration V5 → V6

One rule:

```ts
endDate: null
```

Nothing else changes: `routeIds`, `days` (ids, `placeIds`, boundaries — byte-for-byte),
`startDate`, `visitStartTimes`, `accommodations` and `accommodationLegs` all pass through
untouched, and `days: null` stays `days: null`.

**The migration may not invent an end date.** Explicitly forbidden as a migration source:
`days.length`, `startDate + days.length - 1`, `startDate` itself, the last day's derived date, the
number of accommodations, any `visitStartTimes` key, today's date, and any dataset value. A V5
draft did not contain this decision; the only truthful migration is "not selected".

V1 → V2 → V3 → V4 → V5 continues to run first through the existing chain, then V5 → V6 applies
once. The chain stays additive; no historical migration is rewritten.

### 8.4 Strict parser rules for `endDate`

- Accepted: `null`, or a string that is `YYYY-MM-DD`-shaped **and** a real calendar date per
  `isValidCivilDate` (leap years included).
- Rejected — and **the whole draft is rejected**, never the field alone: a non-string non-null
  value; a malformed shape; a syntactically valid but impossible date (`2027-02-30`); a datetime
  string; a value carrying a timezone suffix; an empty string; `undefined` where the key must be
  present at `version: 6`.
- **Not** a parse rule: `endDate < startDate` (§6.5).
- No repair of any kind: never coerced to `null`, never normalized, never re-derived, never
  defaulted, never partially applied.

### 8.5 Forward compatibility

An older build reading a V6 draft sees `version: 6`, fails its `version !== 5` check, falls through
its V4 chain, fails, and returns `null` → `freshDraft`. That is the existing, already-accepted
behaviour of the version ladder for any forward version, and it is unchanged by this gate.

---

## 9. UI semantics

Minimal placement in the **existing** planner. No new product, page, panel, wizard, modal or
surface. All copy is Spanish, neutral, and free of any recommendation.

### 9.1 Placement

Inside the existing `.calendar-anchor` block in `OrderedSequenceBuilder.tsx`, immediately after the
current `Fecha de inicio (Día 1)` control, a structurally identical second control:

- label: **`Fecha de fin (último día del viaje)`**
- a native `type="date"` input;
- a `Quitar fecha` link-button, shown only when a value exists — mirroring the existing one.

Three distinct facts, never conflated, rendered as plain neutral text:

1. **the civil range the user chose** — e.g. `Rango elegido: vie, 19 feb 2027 – vie, 5 mar 2027 (15 días de calendario)`, using the existing `formatCivilDateDisplay`;
2. **the buckets that currently exist** — e.g. `Días creados: 12`;
3. **the mismatch, when there is one**, stated as a comparison and nothing more.

### 9.2 Copy (proposed, neutral)

| State | Copy |
|---|---|
| Both dates set | `Rango elegido: {inicio} – {fin} ({n} días de calendario).` |
| Only start | `Has fijado la fecha de inicio. Añade la fecha de fin si quieres registrar el rango completo.` |
| Only end | `Has fijado la fecha de fin. Nihon necesita también la fecha de inicio para situar los días.` |
| `end < start` | `⚠ La fecha de fin es anterior a la de inicio. Nihon no modifica ninguna de las dos ni tus días; revisa las fechas.` |
| Buckets exist, no end date | `Días creados: {m}. No has registrado una fecha de fin.` |
| Fewer buckets than days | `Rango elegido: {n} días de calendario · Días creados: {m}.` |
| Equal | `Rango elegido: {n} días de calendario · Días creados: {m}.` |
| More buckets than days | `Rango elegido: {n} días de calendario · Días creados: {m}. Hay {m − n} día(s) posteriores a la fecha de fin.` |
| Per-day card, `after-trip-end` | `⚠ Este día es posterior a la fecha de fin de tu viaje.` |

The equal and fewer cases share identical wording deliberately: neither is endorsed as correct.

**Forbidden copy**, in any form: "tu viaje debería durar X días"; "te faltan N días"; "te sobran N
días"; "añade un día"; "elimina este día"; any suggestion to change the range or the buckets; any
night count; any check-in/check-out language; any flight, airport or arrival/departure-time
language; any statement about what a good trip length is. Nihon states what the user chose and what
exists. It does not have an opinion.

### 9.3 Per-day presentation

A day assessed `after-trip-end` keeps everything it has today — its `Día N` heading, its derived
date, its places, its accommodation controls, its move/delete buttons — and **gains one warning**.
It is never hidden, greyed into uselessness, collapsed, disabled, auto-deleted or reordered.

The existing invalid-partition banner (`role="alert"`) stays a separate, unrelated signal; the two
must not be merged.

### 9.4 The presentation frontier for out-of-bounds days

The gate requires deciding precisely what continues to be computed and what is suppressed when a
bucket falls outside the range. The decision:

> **Every existing temporal computation continues unchanged. Only the presentation gains an explicit
> warning.**

Concretely, for a day assessed `after-trip-end`:

| Continues | Rationale |
|---|---|
| `deriveVisitDateForPlace` | The arithmetic date is still a real, correct civil date for that ordinal. Suppressing it would change an existing pure evaluator's contract, which §11 forbids. |
| `buildDayWeekdaySignal` / weekday closure | A weekday is a fact about a date. It does not become false because the user is not travelling that day. |
| Hours/closure composition | Same — recorded hours for a date are unchanged. |
| Recorded-hours feasibility / visit-time fit | Same. Purely a comparison of a manual time against recorded intervals. |
| Reservation window and reference relation | The window derives from `visitDate` and recorded lead-time evidence; the reference relation derives from the device-local reference date. Neither is a claim about trip membership. |

| Suppressed | Rationale |
|---|---|
| The *implicit claim that this is a day of the trip* | This — and only this — is what is false. It is corrected by the warning, not by withholding data. |

Rationale for the frontier: silently returning `null` from `deriveVisitDateForPlace` for an
out-of-bounds day would be a **behaviour change to a pure evaluator caused by an unrelated new
field**, would make an existing signal disappear with no explanation, and would leave the user
unable to see what they had before. The honest correction is annotation, not withholding.

---

## 10. Accommodation, arrival/departure, luggage

### 10.1 Accommodation — untouched

Trip bounds must **not**: select a hotel; delete a hotel; create a hotel-to-hotel transfer; change,
add, remove or rebind any `ManualAccommodationLeg`; change any `DayAccommodationBoundary`; infer an
arrival or departure airport; or interpret `no-accommodation` as an airport, station, port, transit
or travel day. `no-accommodation` remains exactly what Phase 3D-Q defined: a positive statement the
user alone makes, meaning only that no accommodation is attached to that boundary side.

The existing empty-day rule (§8.3 of the 3D-R contract — an empty day's boundary sides reset to
`unselected`) is unchanged and is unrelated to bounds.

### 10.2 Arrival / departure — a seam, not a feature

This gate is **not** flight integration. The civil range does **not** represent: a landing time; a
take-off time; an airport or terminal; a flight number or carrier; a transfer to or from a hotel; a
departure cut-off time; a check-out time; a check-in time; a timezone; or any clock time whatsoever.

A future arrival/departure gate, if one is ever chartered, would attach its own evidence to its own
model. It would find here exactly one thing: two validated civil dates with clean, documented
semantics, and no assumptions to unwind. That is the entire contribution to that future — a clean
seam, nothing more.

### 10.3 Luggage — expressly a separate axis

**Luggage remains a separate axis and is entirely out of scope**: takkyubin / luggage forwarding,
coin lockers, oversized-baggage rules on the Shinkansen, hotel baggage storage, and airport
baggage. Nothing in trip bounds models, implies, enables or constrains any of them. A trip's first
and last civil day say nothing about where a bag is, and no successor may use `endDate` as evidence
for a luggage decision.

---

## 11. Temporal / reservation audit

Audited consumers, and the verdict for each. **No rewrite is justified for any of them.**

| Consumer | Reads | Verdict |
|---|---|---|
| `deriveVisitDateForPlace` (`reservation-deadline.ts:299`) | `DayAssignment`, `startDate`, `placeId` | **Unchanged.** Its four-condition contract is correct and complete for what it claims: the civil date of the ordinal a place sits at. Trip membership is not its question. |
| `deriveReservationDateWindow` / `derivePlaceReservationDateWindow` | signal, `visitDate`, eligibility | **Unchanged.** Pure; receives an already-derived date. |
| `evaluateReservationWindowReference` (Phase 3D-O) | window, reference date | **Unchanged.** Relates a device-local reference date to recorded advance guidance. The trip's end has no bearing on when an operator's advance window opens. |
| `buildDayWeekdaySignal` / `assessWeekdayClosure` | places, `dateIso` | **Unchanged.** A weekday is a property of a date. |
| `deriveHoursClosureVisitDate` / `derivePlaceHoursClosureComposition` / `buildPresentableDayHoursClosureCompositions` | places, `DayAssignment`, `startDate` | **Unchanged.** |
| `evaluateRecordedIntervalFit` / `buildDayRecordedIntervalFits` | places, assignment, `startDate`, `visitStartTimes` | **Unchanged.** |
| `buildDayAssignment` / `validateDayPartition` / `dayAssignmentFromLookup` | `routeIds`, ordinal matrix | **Unchanged.** Structural only; no date input at all. `endDate` must never become a partition input, and `"after-trip-end"` must never become a `DayAssignmentIssue` — those issues describe partition structure, not the calendar. |
| `dayMatrixFromPlanningDays` | `PlanningDayV5[]` | **Unchanged.** The identity/ordinal boundary stands; no day id crosses into any bounds computation either. |
| `captureDeviceLocalCivilDate` | device clock | **Unchanged.** The reference date is not a trip bound and must not be compared against one. |

**The place-in-an-out-of-bounds-day question, decided.** A place assigned to a bucket after
`endDate`:

- **still has a derivable visit date** — the arithmetic is unchanged and correct;
- **still produces weekday, closure, hours-fit and reservation-window results** for that date;
- **is never automatically moved to another day, removed from the route, or unassigned**;
- **must not be presented as a valid day of the trip without the explicit warning of §9.2/§9.3.**

The frontier is therefore: **derivation is unconditional; presentation is conditional.** Evaluators
stay pure and total; the composition layer decides what a user is told.

---

## 12. Stable day identity — guarantees

Setting, changing or clearing either bound must be provably inert with respect to day identity. By
construction the approved setters only ever reassign one scalar field
(`{ ...draft, endDate }` / `{ ...draft, startDate }`), so:

- **no day id is reminted, regenerated, reassigned or reused**;
- **`days` is not reordered** — array order remains the sole source of ordinal, and the sole thing
  that determines it;
- **no `placeIds` array changes**, in content or in internal order;
- **no `accommodationBoundary` changes** on any day, on either side;
- **no `accommodationLeg` is added, removed, rebound or reinterpreted**;
- **no `AccommodationAnchor` changes**;
- **identity is never derived from a date** — not from `startDate`, not from `endDate`, not from a
  derived day date, not from an assessment;
- **the assessment never receives a day id**, so it provably cannot depend on one;
- **reordering a day still transports the same entity**, byte-for-byte, and changes only its
  derived ordinal date — and now, additionally and only as a derived read, possibly its bounds
  assessment.

`LEGACY_V4_DAY_ID_PREFIX` migration semantics are untouched: V5 → V6 does not renumber, re-mint or
re-prefix anything.

---

## 13. Failure states

| Failure | Required behaviour |
|---|---|
| `endDate` write with a malformed string | Rejected; draft unchanged. No coercion. |
| `endDate` write with an impossible date (`2027-02-30`) | Rejected by `isValidCivilDate`; draft unchanged. |
| `endDate` write with a datetime or timezone-suffixed string | Rejected; draft unchanged. Never truncated to its date part. |
| Stored `endDate` malformed at parse time | **Whole draft rejected** → `freshDraft`. Never salvaged. |
| Stored `endDate` key absent at `version: 6` | Whole draft rejected. Absence is only meaningful at `version: 5`, where migration supplies `null`. |
| `end < start` (stored or live) | Stored and kept; assessment `bounds-unavailable(inverted-range)`; explicit neutral UI notice; **nothing repaired, nothing deleted**. |
| `differenceInCivilDays` returns `null` or overflows JS `Date`'s representable range | `bounds-unavailable(invalid-date)`. Never a fabricated count. Mirrors the existing two-step output guard in `deriveReservationDateWindow`. |
| `startDate` cleared while `endDate` set | Both persist; assessment `bounds-unavailable(no-start-date)`. `endDate` is **not** cleared as a side effect. |
| `days: null` with a full valid range | Range persists and displays; no assignment created; no per-day assessment exists. |
| `localStorage` unavailable on write | Existing behaviour: in-memory state preserved, write swallowed. Unchanged. |

---

## 14. Compatibility matrix

| Stored input | Parsed result |
|---|---|
| No stored draft | `freshDraft` at V6 with `endDate: null`. |
| V1 / V2 / V3 / V4 draft | Existing chain → V5 → V6 with `endDate: null`. Every other field byte-identical. |
| V5 draft, `days: null` | V6, `days: null`, `endDate: null`, `startDate` preserved. |
| V5 draft, `days` present, `startDate` set | V6, days byte-identical (ids, `placeIds`, boundaries), `endDate: null`. |
| V5 draft with accommodations and manual legs | V6, anchors and legs byte-identical. |
| V6 draft, `endDate: null` | Accepted. |
| V6 draft, valid `endDate` ≥ `startDate` | Accepted. |
| V6 draft, valid `endDate` < `startDate` | **Accepted** (§6.5); assessment reports `inverted-range`. |
| V6 draft, `endDate: "2027-02-30"` | Whole draft rejected → `freshDraft`. |
| V6 draft, `endDate: 20270305` (number) | Whole draft rejected. |
| V6 draft, `endDate` key missing | Whole draft rejected. |
| V6 draft with any other invariant broken (bad partition, unknown anchor, duplicate day id, orphan leg) | Whole draft rejected, exactly as in V5. |
| V6 draft read by a pre-V6 build | Version ladder fails through → `freshDraft`. Existing, accepted behaviour. |

---

## 15. Test contract for the successor

An exhaustive matrix the eventual runtime successor must satisfy. **No test in this list may be
written in this gate** — this is a specification, not an implementation.

**Migration**
1. V5 → V6 sets `endDate: null` and changes nothing else.
2. V5 with `days: null` → V6 keeps `days: null`, `endDate: null`.
3. V5 with days → V6 preserves every day id, `placeIds` order and `accommodationBoundary` byte-for-byte.
4. V5 with anchors and legs → V6 preserves both exactly.
5. V1/V2/V3/V4 → V6 through the full chain, `endDate: null`.
6. Migration never derives an end from `days.length`, `startDate + days.length - 1`, `startDate`, an anchor count, `visitStartTimes`, or the current date — asserted for a multi-day migrated draft.
7. Migration is idempotent: re-parsing a persisted V6 yields an identical object.

**Strict parser**
8. `endDate: null` accepted.
9. Valid `endDate` accepted verbatim.
10. Malformed shape → whole draft rejected.
11. Impossible date (`2027-02-30`, `2027-13-01`, `2027-02-29`) → whole draft rejected.
12. Leap-valid `2028-02-29` accepted.
13. Non-string non-null (`number`, `boolean`, object, array) → whole draft rejected.
14. Datetime / timezone-suffixed string → rejected, never truncated.
15. Empty string → rejected.
16. Missing key at `version: 6` → rejected.
17. `end < start` **accepted** by the parser (order is not a parse invariant).
18. A draft rejected for `endDate` is rejected wholly — no partial salvage of route, days, anchors or legs.
19. Every pre-existing V5 rejection case still rejects at V6 (bad partition, duplicate day id, empty day with a non-`unselected` boundary side, unknown anchor in a boundary, orphan leg, duplicate directed leg key, invalid `startDate`, invalid visit time).

**Civil-date validation**
20. `differenceInCivilDays` returns a signed whole-day difference across month, year and leap boundaries.
21. It returns `null` for either argument invalid.
22. It is timezone-invariant — identical results under simulated non-UTC local timezones (including west of UTC).
23. `setEndDate` rejects an invalid date and returns the draft unchanged.
24. `setEndDate(null)` clears without touching `startDate` or `days`.
25. No `Date`/UTC instant, no timezone, and no clock time is ever stored, inferred or compared.

**Inclusive count**
26. `end === start` → `tripCalendarDays === 1`.
27. Consecutive dates → `2`.
28. A range spanning a month boundary, a year boundary and a leap day each count correctly.
29. `tripCalendarDays` is absent (not `0`, not negative) for every `bounds-unavailable` state.

**Null states**
30. Both null → `bounds-unavailable(no-start-date)`.
31. Start only → `no-end-date`.
32. End only → `no-start-date`, **and `endDate` is still persisted and reloads intact**.
33. `end < start` → `inverted-range`, both values persisted unchanged.

**Route / reset independence**
34. `withRoute` with a composition change → `days: null`, `startDate` and `endDate` both survive.
35. `withRoute` with a pure reorder → days retained, both bounds survive.
36. `resetRoute` → `days: null`, anchors survive, **both bounds survive**.
37. `reconcileDraft` pruning a stale place → bounds untouched, whether or not the partition survives.

**Day addition / removal / empty days / reorder**
38. `withNewEmptyDay` does not change either bound; the new day may be `after-trip-end`.
39. `withoutEmptyDay` does not change either bound; the range is not shortened.
40. An empty day is assessed exactly like a non-empty one at the same ordinal.
41. `withDayMoved` does not change either bound; assessments recompute from new ordinals.
42. A day moved from ordinal `n` (out of bounds) to ordinal `m` (in bounds) becomes `within-bounds` **with the same id, `placeIds` and boundary**.
43. `withPlaceMovedBetweenDays` / `withPlaceMovedWithinDay` leave every assessment unchanged.
44. **Negative test:** setting or clearing either bound never changes `days.length`, day order, any day id, any `placeIds`, any boundary, any leg, any anchor, `routeIds` or `visitStartTimes` — asserted by deep comparison across a matrix of bound values including inverted and cleared ones.

**Stable IDs / accommodations**
45. Every day id is identical before and after a bounds change (including a clear and an inversion).
46. Every `accommodationBoundary` is identical before and after.
47. Every `ManualAccommodationLeg` is identical before and after; none is created, removed or rebound.
48. No anchor is added, removed or modified by any bounds operation.
49. The assessment function's signature provably cannot receive a day id.

**Out-of-bounds assessment**
50. `tripCalendarDays = 3`, 5 buckets → ordinals 0–2 `within-bounds`, 3–4 `after-trip-end`.
51. Exactly matching counts → all `within-bounds`; no bucket is created or removed.
52. Fewer buckets than calendar days → all `within-bounds`; no bucket created.
53. One-day trip with 3 buckets → ordinal 0 in, 1–2 out.
54. `before-trip-start` is unreachable — asserted across ordinals `0..n`.
55. The assessment writes nothing back to the draft (deep-equality on the draft before/after).

**Persistence / reload**
56. Write → load round-trip preserves `endDate` exactly, including `null` and an inverted pair.
57. Reload preserves day order, ids, boundaries and legs alongside a set `endDate`.
58. The storage key remains `nihon.manualPlanningDraft`; a source scan pins that no second key is introduced.

**Real temporal / reservation consumers**
59. A **real** `deriveVisitDateForPlace` still returns the correct arithmetic date for a place in an `after-trip-end` bucket.
60. A **real** `buildDayWeekdaySignal` still produces its closure signal for an out-of-bounds day's date.
61. A **real** hours/closure composition still produces its items for an out-of-bounds day.
62. A **real** `evaluateRecordedIntervalFit` still evaluates for an out-of-bounds day.
63. A **real** `derivePlaceReservationDateWindow` → `evaluateReservationWindowReference` chain produces the same relation whether or not the day is out of bounds — proving `endDate` is not an input to reservation evaluation.
64. Setting, changing or clearing `endDate` changes **no** evaluator output anywhere — only the assessment and its presentation.

**UI**
65. The end-date input and its clear button exist in the existing planner block; no new surface is added.
66. An `after-trip-end` day card renders the warning and still renders its heading, date, places and controls.
67. No copy contains a duration recommendation, a night count, or a suggestion to add or remove days — asserted by scanning the rendered strings.
68. The chosen range, the created-bucket count and the mismatch are three distinct rendered facts.
69. The invalid-partition alert and the bounds notice remain separate elements.

**No timezone / instant inference**
70. A source scan of the new modules finds no local-getter date reads (`getFullYear`, `getMonth`, `getDate`, `getHours`), no `toISOString`, no timezone identifier, and no clock-time parsing.
71. Assessment results are identical under simulated local timezones east and west of UTC.

**Browser QA** (successor, not this gate): a seeded persisted draft with a set range and more buckets than calendar days — verify the warning appears on the right cards, the range and bucket counts display, moving a day in and out of bounds updates only the warning, clearing the end date removes every warning, and a reload preserves the range, the day order and every hotel choice.

---

## 16. Non-goals

This gate introduces none of the following, and the successor may not either:

runtime code, React/UI implementation, a real schema migration, new runtime tests, dataset or
workbook changes, `package.json`/lockfile/dependency changes, routing, live transit, hotel search,
hotel-to-hotel inference, luggage/takkyubin/lockers/oversized-baggage/hotel-or-airport storage,
check-in/check-out, flights, airports, arrival/departure clock times, timezone scheduling,
automatic itinerary generation, automatic day creation or removal, optimization or recommendation,
drag-and-drop, booking integration, night counts, trip-duration advice, per-place date assignment,
a second storage key, a day-level date or ordinal field, and any change to the existing pure
temporal or reservation evaluators.

---

## 17. Acceptance gate for the successor

Phase 3D-W may be considered complete only when all of the following hold:

1. `ManualPlanningDraftV6` exists with exactly one added field, under the unchanged storage key.
2. V5 → V6 migration sets `endDate: null` and provably never derives a value from `days.length`.
3. The parser is strict and all-or-nothing for `endDate`, and does **not** treat the order relation as a parse invariant.
4. `differenceInCivilDays` exists in `civil-date.ts`, is component-based and timezone-invariant, and returns `null` rather than guessing.
5. `tripCalendarDays` is derived, inclusive, and absent whenever the range is unavailable.
6. The bounds assessment is a pure module with the three approved kinds and four unavailable reasons, receives no day id, and is never persisted.
7. Every existing pure evaluator listed in §11 is byte-for-byte unchanged.
8. No bounds operation mutates `days`, ids, `placeIds`, boundaries, legs, anchors, `routeIds` or `visitStartTimes`.
9. The UI adds one control and one per-day warning inside the existing planner, with neutral Spanish copy and no recommendation.
10. The §15 matrix passes, `npm run build`, `npm run lint`, `npx tsc -b --force` and `git diff --check` all pass, and browser QA confirms the reload behaviour.

---

## 18. Conclusion

The absence of a trip end date was correctly scoped out three times and is now the narrowest
remaining gap in the planner's civil-date model. It is **not** redundant with `days.length`: the
civil extent of a trip is a user decision that survives route changes and exists with `days: null`,
while the bucket count is a downstream, invalidatable editing artifact. Deriving one from the other
would make a trip change length when a user removes a place.

**Approved: `endDate: string | null` on `ManualPlanningDraftV6`, inclusive of both endpoints, under
the unchanged storage key, migrated as `null`, validated per-field and never cross-field, storable
even when inverted or unpaired, and consumed only through a pure derived three-state assessment
that annotates but never repairs.**

The stored field is inert. All of its value is in the derived layer, and all of that layer does is
tell the user something true that Nihon currently hides: *this day is after the end of your trip.*
It does not act on that, and it never will.

Recommended successor: **Phase 3D-W — Trip Bounds Runtime**. **NOT STARTED.**
