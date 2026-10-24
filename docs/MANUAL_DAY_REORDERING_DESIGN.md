# Phase 3D-T — Manual Day Reordering Design Gate

Status: **APPROVE a narrow manual successor**.

Recommended successor: **Phase 3D-U — Manual Day Reordering Runtime**.

This document is design/audit only. Phase 3D-T does not change runtime code, UI, persisted data,
dataset content, dependencies, routing, optimization, booking, hotel evidence, luggage logic, or
transport evidence.

---

## 1. Problem

Phase 3D-S introduced stable day entities:

```ts
type PlanningDayV5 = {
  id: string;
  placeIds: string[];
  accommodationBoundary: DayAccommodationBoundary;
};
```

The stable identity contract already defines what must happen if an existing day moves to a different
ordinal position: the whole day entity travels, while `Día N` and its derived civil date change from
the new array position.

The current UI does not expose such an action. A user can:

- reorder places inside one day;
- move a place between days;
- add an empty day;
- delete an empty day;
- choose accommodation boundaries by stable day id;

but cannot move an entire existing day earlier or later.

That omission is now the narrowest remaining gap in the stable-day-identity work. The identity model
exists specifically so a day can survive an ordinal move without rebinding its accommodation choice or
inventing a new identity.

---

## 2. Executive decision

Approve one explicit user-authored operation: **move one existing day entity one ordinal position up
or down**.

This is not itinerary optimization. The application must not decide that one day is better before
another, infer a preferred city order, compare transfer cost across day orderings, or automatically
rearrange days.

The user chooses the move. The runtime performs exactly that move.

---

## 3. Canonical persistence remains V5

No schema migration is justified.

`ManualPlanningDraftV5` remains canonical under the existing storage key:

```ts
nihon.manualPlanningDraft
```

No V6, second order vector, day-position field, date field, or parallel day-id store is introduced.
Day order is already represented by the order of `PlanningDayV5[]`.

A persisted V5 draft therefore needs only to serialize the same day entities in their new array order.

---

## 4. Identity and ordinal semantics

A day id continues to mean only:

> this is the same user-authored day bucket across edits that preserve that bucket.

Moving a day changes none of the identity-bearing content.

For a moved day:

- `id` travels unchanged;
- `placeIds` travel unchanged and in the same internal order;
- `accommodationBoundary` travels unchanged;
- no id is regenerated;
- no accommodation is reselected;
- no manual leg is rebound;
- no place is moved between day buckets.

Ordinal meaning remains array-derived:

```ts
visibleLabel(dayIndex) = `Día ${dayIndex + 1}`
date(dayIndex) = addCivilDays(startDate, dayIndex)
```

A day id is never an ordinal id or date id.

---

## 5. Approved pure mutation

The successor should add a pure V5 mutation equivalent to:

```ts
function withDayMoved(
  draft: ManualPlanningDraftV5,
  dayId: string,
  direction: -1 | 1
): ManualPlanningDraftV5
```

The operation is intentionally one-step. It supports the current button-based editing model without
introducing drag-and-drop, arbitrary-index addressing, or a second reorder abstraction.

### 5.1 Success path

Given `draft.days !== null` and a known `dayId`:

1. resolve the current index from the stable id;
2. compute `targetIndex = currentIndex + direction`;
3. if the target is in bounds, swap the two **whole day entities**;
4. return a new draft whose only semantic change is day-array order.

The implementation may clone the moved entities/array as needed for immutability, but must not rebuild
them from `string[][]`, re-mint ids, or reconstruct accommodation boundaries.

### 5.2 Rejected/no-op inputs

Return the draft unchanged for:

- `days === null`;
- unknown `dayId`;
- invalid direction;
- moving the first day up;
- moving the last day down;
- a one-day assignment;
- any operation that would somehow fail the existing partition invariant.

No partial application.

---

## 6. `routeIds` stays independent

Reordering day buckets does **not** reorder `routeIds`.

This is valid because `validateDayPartition(routeIds, days)` is a membership/uniqueness contract, not
a positional equality contract. It checks that every route id appears exactly once across the day
partition, with no extra ids or duplicates.

Therefore the successor must not rewrite the master route merely because day ordinal order changed.

This preserves the existing distinction:

- `routeIds`: the user's saved explicit route sequence;
- `days`: the user's explicit partition and per-day order.

No hidden attempt should make their flattened orders equal.

---

## 7. Empty days are movable

An existing empty day is a legitimate stable day entity and may be moved.

Moving an empty day:

- preserves its id;
- preserves `placeIds: []`;
- preserves both boundary sides as `unselected`;
- does not create an accommodation choice;
- does not delete or restore any manual leg;
- changes ordinal/date positions exactly like any other day.

This is useful for a manually-authored blank/rest day and requires no special new semantic type.

An empty day remains deletable under the existing Phase 3D-S rule.

---

## 8. Calendar consequences are deliberate

`startDate` remains one trip-level field and is not modified by a day move.

Because civil dates are ordinal-derived, moving days necessarily changes dates.

Example:

Before:

- day `A` at index 0 → March 1;
- day `B` at index 1 → March 2.

After moving `B` up:

- day `B` at index 0 → March 1;
- day `A` at index 1 → March 2.

This is correct. The user changed the day order.

The system must not preserve old dates by writing a date into the day entity.

---

## 9. Downstream temporal results must recompute

A day-order move can legitimately change every result that depends on ordinal-derived civil date.

After the move, consumers must recompute from the existing pure `PlanningDayV5[] -> string[][]`
projection and the new ordinal index.

Potentially changed derived outputs include:

- visible `Día N` label;
- derived visit civil date;
- weekday;
- recorded-hours/closure composition for that date;
- visit-time feasibility that depends on the date/weekday;
- reservation date window/reference evaluation;
- any other existing result whose documented input is ordinal-derived date.

This is not day identity leaking into temporal logic. The opposite remains required: temporal modules
must continue to receive the ordinal projection, never a day id.

Changing only a day id still cannot alter any downstream result. Changing day **order** can, because it
changes ordinal date.

---

## 10. Per-place visit start times remain attached to places

`visitStartTimes: Record<string, string>` remains unchanged.

If place `P` has manual `09:30` and its whole day moves to another date, `P` still has `09:30`; only
the derived civil date changes.

No time is cleared, shifted, timezone-converted, or chained automatically.

---

## 11. Accommodation semantics remain exact

The Phase 3D-Q/3D-S accommodation contract remains unchanged.

Because the whole day entity moves:

- start/end accommodation choices travel with it;
- first/last place inside that day do not change;
- exact directed manual accommodation legs therefore continue to address the same endpoint tuples;
- no reverse/sibling/geometry/network inference is introduced;
- missing remains missing and never becomes zero.

For a non-empty moved day, its registered accommodation boundary results and transfer subtotal should
therefore remain numerically unchanged, while its displayed ordinal/date may change.

The application must never infer a hotel-to-hotel transfer between adjacent days because their order
changed.

---

## 12. Intra-day logistics remain unchanged

A day move does not change `placeIds` inside the moved day.

Therefore its own:

- consecutive place pairs;
- validated/estimated transfer lookups;
- intra-day transfer subtotal;
- completeness state;

remain unchanged.

No cross-day pair is created. The existing day boundary remains load-bearing: last place of day N and
first place of day N+1 are still not treated as one ordered sequence.

---

## 13. Reservation reference date remains independent

The component's captured reservation reference date is not part of persisted day identity and must not
change because a day moved.

What can change is the evaluated reservation relation, because the visit date derived from the new
ordinal may change.

The successor must preserve this distinction in tests:

- same captured reference date;
- same reservation evidence;
- moved day/order;
- potentially different visit date/window/reference result for the same place.

No current-date lookup should be repeated merely because a day button was pressed.

---

## 14. Reconciliation must preserve stored day order

`reconcileDraft` must not sort day entities by:

- id;
- migration id suffix;
- place id;
- date;
- accommodation;
- creation order;
- geography.

For a valid persisted V5 draft, reconciliation may prune stale place ids under its existing contract,
but the relative order of surviving day entities must remain the persisted order.

A day that becomes empty during stale-place pruning keeps its position and existing Phase 3D-S empty-
day reset semantics unless a user separately moves or deletes it.

---

## 15. Existing compatibility boundary stays closed

The Phase 3D-R corrective rule for `withDays(string[][])` remains unchanged:

- identical matrix → preserve current entities/ids/boundaries;
- any non-identical matrix → reject and return the draft unchanged.

Day reordering must **not** be implemented through `withDays`.

That would erase the very identity information needed to know which day moved.

The new operation must be identity-aware and address the day by `dayId`.

---

## 16. UI contract

The successor should minimally extend each existing day card/header with explicit controls:

- **Mover día arriba**;
- **Mover día abajo**.

The controls should:

- operate on `dayEntity.id`, never `dayIndex` as identity;
- be disabled when the move is out of bounds;
- remain keyboard-accessible buttons;
- expose an unambiguous accessible name even if the visual treatment uses arrows/icons;
- not expose the stable id to the user;
- keep visible headings ordinal (`Día 1`, `Día 2`, ...).

No drag-and-drop dependency is approved by this gate.

No confirmation dialog is required for a one-step move. The action is explicit, local, and reversible
by the opposite move.

---

## 17. React key/focus expectation

The day card should continue to use the stable day id as its React key.

Reordering the array must therefore move the existing day entity rather than remounting a newly
identified replacement.

The implementation should avoid index keys and should not intentionally move focus to an unrelated day
after the user activates a move control.

This gate does not mandate a new focus-management framework or dependency.

---

## 18. Hook surface

The React hook should expose a narrow callback equivalent to:

```ts
moveDay(dayId: string, direction: -1 | 1): void
```

It delegates to the pure V5 mutation through the same single canonical `setDraft` state.

No parallel `dayOrder` state is allowed.

---

## 19. Required successor tests

Phase 3D-U should add focused coverage for at least:

1. moving a middle non-empty day up preserves its id/content/boundary;
2. moving it down restores the prior ordering;
3. first-up and last-down are exact no-ops;
4. unknown id is a no-op;
5. `days: null` and one-day assignments are no-ops;
6. an empty day can move and remains empty/unselected;
7. `routeIds`, `startDate`, accommodations, manual legs, and visit start times are byte-for-byte
   unchanged by the pure move;
8. the projected `string[][]` changes only by whole-day order;
9. `validateDayPartition` remains valid;
10. place order inside every day remains unchanged;
11. accommodation boundary results/manual-leg matching remain unchanged for the moved non-empty day;
12. intra-day transfer sequence/subtotal remains unchanged for the moved day;
13. derived `Día N` and civil dates change according to the new ordinal;
14. at least one real weekday/date-sensitive downstream evaluator recomputes from the new date;
15. at least one real reservation evaluator recomputes with the same reference date/evidence and the
    new visit date;
16. reconciliation/load round-trip preserves the new persisted day order;
17. UI buttons call the hook with stable day id;
18. boundary buttons are disabled at first/last positions;
19. stable ids remain invisible and continue to be React keys;
20. no `withDays(string[][])` call is used to perform the reorder.

Where this repository lacks a DOM test harness, the successor may follow the established combination of
pure transition tests, source-level wiring assertions, and browser QA. It must not add a test framework
solely for this phase unless independently justified.

---

## 20. Browser QA required for the successor

A focused browser pass should cover:

1. load a persisted multi-day V5 draft;
2. choose/verify distinct accommodation choices on at least two days;
3. move the second day up;
4. verify the whole day content and hotel choice moved together;
5. verify visible labels/dates changed by ordinal;
6. verify recorded manual accommodation durations still resolve for unchanged endpoints;
7. verify temporal/reservation display recomputes where date-sensitive;
8. move the day back down;
9. move an empty day across a non-empty day;
10. reload and confirm the reordered V5 array persists exactly.

No network-backed provider is needed for this QA.

---

## 21. Non-goals

Phase 3D-U must not add:

- automatic day ordering;
- route optimization/TSP;
- transfer-cost comparison between alternative day orders;
- recommended city order;
- drag-and-drop;
- bulk multi-day reorder suggestions;
- automatic rest-day insertion;
- hotel recommendation/search/routing;
- hotel-to-hotel transfer inference;
- geocoding;
- live transit;
- provider integration;
- luggage/takkyubin logic;
- check-in/check-out inference;
- automatic chained times;
- timezone scheduling;
- booking integration;
- trip-end-date persistence;
- schema V6;
- unrelated refactors or dependency upgrades.

---

## 22. Acceptance gate

Phase 3D-U is acceptable only if all of the following are true:

- the move is explicit and user-authored;
- the stable day id, content and accommodation boundary travel together;
- no raw matrix matching is used to recover identity;
- no new persisted order representation is introduced;
- ordinal labels/dates recompute from array position;
- date-sensitive outputs recompute from existing pure contracts;
- per-place times, anchors and exact manual legs are preserved;
- no cross-day transfer is fabricated;
- empty days can move without gaining semantics;
- current V5 parser/reconciliation invariants remain strict;
- full tests/build/lint/typecheck/diff-check pass;
- browser QA demonstrates persistence and visible behavior;
- Phase 3D-V or later work is not started.

---

## 23. Conclusion

Stable day identity removed the ambiguity that previously made changed day matrices unsafe. The next
useful step is to expose one operation that directly benefits from that identity: an explicit move of a
whole day bucket.

The safe implementation is small in semantics even though it touches persistence, calendar-derived
views and UI wiring: swap whole `PlanningDayV5` entities by stable id, preserve every user-authored
value inside them, and allow existing ordinal/date consumers to recompute normally.

**Decision: APPROVE Phase 3D-U — Manual Day Reordering Runtime as the narrow successor.**

Phase 3D-U is **NOT STARTED** by this design gate.
