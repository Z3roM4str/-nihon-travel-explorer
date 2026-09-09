# Phase 3D-R — Stable Day Identity Design Gate: corrective addendum

This addendum is **normative** and forms part of the Phase 3D-R contract in
[`STABLE_DAY_IDENTITY_DESIGN.md`](STABLE_DAY_IDENTITY_DESIGN.md).

It records the independent hostile review of the initial gate. Where this file conflicts with the
initial document, **this addendum takes precedence**.

## Finding 1 — non-identical bulk `withDays(string[][])` must fail closed

### Problem

The initial design's §9 correctly forbids positional/content/similarity matching, but still called
"create an entirely new set of day entities with fresh ids and all-`unselected` boundaries" the
safest fallback for a non-identical bulk matrix.

That is too permissive. A raw changed `string[][]` does not contain enough information to prove
whether the user:

- edited existing day entities;
- deleted and recreated every day;
- inserted one new day;
- moved one place between two existing days; or
- performed some combination of those actions.

Minting all-new ids would therefore invent a lifecycle interpretation — "all old days were deleted
and all incoming buckets are new" — that the caller did not actually provide. It is conservative
about accommodation choices, but it defeats the purpose of stable identity and can erase user
state unnecessarily.

### Corrected rule

A compatibility bulk setter that accepts only `string[][]` may do exactly two things:

1. **Element-for-element identical matrix:** return/preserve the existing day entities, ids and
   boundaries unchanged.
2. **Any non-identical matrix:** reject the operation and return the draft unchanged.

It must never:

- carry ids by index;
- match ids by equal/similar contents;
- match by endpoints, date, hotel or score;
- regenerate every id as a fallback;
- partially apply the matrix.

All user-visible day edits that can legitimately preserve identity must go through explicit
identity-aware mutations (add day, delete empty day, reorder inside one day, move one place between
known day ids, and any future explicit day-order move).

This removes the last place where the runtime could silently invent day lifecycle semantics.

## Finding 2 — V5 persistence must not redefine `DayAssignment`

### Problem

The initial design correctly changes the persisted V5 `days` shape from `string[][]` to stable day
entities, but it did not explicitly close the boundary with the existing day-assignment and
calendar consumers, which currently operate on ordinal `string[][]` matrices.

Without an explicit rule, an implementation could unnecessarily widen `day-assignment.ts`,
reservation-date helpers, weekday signals, hours/closure composition and other consumers to know
about persistence-only day ids.

### Corrected rule

Stable day identity is a **planning-draft persistence/mutation concern**, not a new semantic input to
`DayAssignment`.

V5 must expose/use a pure projection equivalent to:

```ts
function dayMatrixFromPlanningDays(
  days: readonly PlanningDayV5[] | null
): string[][] | null {
  return days?.map((day) => [...day.placeIds]) ?? null;
}
```

The exact helper name is not prescribed, but these semantics are:

- preserve day array order exactly;
- preserve each day's place order exactly;
- expose no `dayId` to `validateDayPartition` or `buildDayAssignment`;
- derive `Día N` and `startDate + ordinalIndex` from the projected order exactly as today;
- do not add persistence identity to temporal/logistics domain contracts that do not need it.

Existing domain modules should remain unchanged unless a concrete compile-time/API constraint makes
a minimal adapter change unavoidable. The implementing phase must not use day identity as evidence
for opening hours, reservation timing, transport, accommodation duration, optimization or any
other semantic axis.

## Required successor tests added by this review

Phase 3D-S must additionally prove:

- a non-identical legacy/bulk `string[][]` replacement is rejected with byte-for-byte unchanged
  day ids/boundaries;
- an identical bulk matrix preserves every id/boundary;
- the pure V5→matrix projection is deterministic and preserves both day order and place order;
- `validateDayPartition` sees only the projected `string[][]`, never day ids;
- changing only a day id while keeping the same place matrix cannot alter a `DayAssignment`, civil
  date, weekday signal, reservation-date result or intra-day transfer sequence;
- identity-aware UI mutations, rather than the compatibility bulk setter, are what preserve ids
  across real edits.

## Result of corrective review

No blocker remains in the decision to introduce stable day identity. The executive decision stays:
**APPROVE a narrow Phase 3D-S runtime successor.**

The correction narrows the implementation further:

- no heuristic identity matching;
- no implicit mass delete/recreate fallback;
- no widening of `DayAssignment` semantics;
- stable ids remain internal persistence/mutation identity only.

All other Phase 3D-R decisions and non-goals remain unchanged.
