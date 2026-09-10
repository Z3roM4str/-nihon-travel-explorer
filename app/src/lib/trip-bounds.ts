/**
 * Phase 3D-W — Trip Bounds Runtime: the pure derived layer over the trip's two civil endpoints.
 *
 * The authoritative contract is `docs/TRIP_BOUNDS_DESIGN.md` (Phase 3D-V). The one-paragraph
 * version: the planner persists two independent civil dates — `startDate` (the civil date of Día 1,
 * unchanged since Phase 3C-E) and `endDate` (the last civil date the user considers part of the
 * trip, added by this phase) — and NOTHING about the range is persisted beyond those two strings.
 * The calendar-day count and the per-day in/out-of-range verdict are derived on read, here, and
 * are never written back into a draft, a day entity or storage.
 *
 * The load-bearing invariant this module exists to protect (design §5): **the civil range and the
 * day-bucket assignment are two independent user decisions.** This module therefore reads bounds
 * and an ordinal position and returns a verdict — it cannot create, delete, truncate, reorder or
 * repair a day, because it never receives a draft, a day entity or a day id in the first place.
 * A day assessed `after-trip-end` keeps every existing derived signal it has today (its date, its
 * weekday, its closure composition, its recorded-hours fit, its reservation window); the ONLY thing
 * that changes is that the presentation layer can now annotate it. Derivation is unconditional;
 * presentation is conditional (design §9.4, §11).
 *
 * This module depends on `civil-date.ts` and nothing else. It contains no `Place`, no schedule, no
 * hotel, no night count, no clock time, no timezone, no instant, and no recommendation of any kind.
 */

import { addCivilDays, differenceInCivilDays, isValidCivilDate } from "./civil-date";

/**
 * The trip's two civil endpoints, exactly as persisted. Both are independently nullable: partial
 * knowledge is the honest representation of partial knowledge, and an `endDate` may legitimately
 * exist while `startDate` is still `null` (design §6.3). The pair is NOT validated as a range at
 * this level — an inverted pair is a storable state, diagnosed below rather than prevented.
 */
export type TripBounds = {
  startDate: string | null;
  endDate: string | null;
};

/**
 * Why no in/out-of-range verdict could be formed. Five reasons, closed, in resolution order.
 *
 * `invalid-ordinal` is first deliberately: it is a statement about the CALLER's argument, not about
 * the trip, and it must short-circuit before any date arithmetic is attempted (design §7.1).
 */
export type TripBoundsUnavailableReason =
  | "invalid-ordinal"
  | "no-start-date"
  | "no-end-date"
  | "invalid-date"
  | "inverted-range";

/**
 * The three-state verdict for ONE day bucket at ONE ordinal position.
 *
 * There is deliberately no `before-trip-start` (design §7.2): Día 1 *is* `startDate` by definition
 * and ordinals are non-negative, so no bucket can precede the range. The absence is structural, not
 * an omission — a fourth state would be permanently unreachable.
 *
 * `ordinal` and `tripCalendarDays` are echoed back for presentation only. Neither is ever persisted,
 * and `ordinal` is never read back as identity — a day's identity is its opaque stable id, which
 * this module provably cannot see.
 */
export type TripBoundsAssessment =
  | { kind: "bounds-unavailable"; reason: TripBoundsUnavailableReason }
  | { kind: "within-bounds"; dayDate: string; ordinal: number; tripCalendarDays: number }
  | { kind: "after-trip-end"; dayDate: string; ordinal: number; tripCalendarDays: number };

/**
 * Whether `ordinalIndex` is a value that could actually be an array position.
 *
 * The evaluator's parameter type is `number`, which is wider than the domain: negative values,
 * fractions, `NaN`, `±Infinity` and integers beyond `Number.MAX_SAFE_INTEGER` are all `number`s and
 * none of them is a reachable position in a `PlanningDayV5[]`. Passing any of them to
 * `addCivilDays` would fabricate a date — `Infinity` produces an Invalid Date, `-1` produces a real
 * but meaningless civil date one day before Día 1 — so the domain is closed here, once, and checked
 * before anything else runs.
 */
function isValidOrdinalIndex(ordinalIndex: number): boolean {
  return Number.isSafeInteger(ordinalIndex) && ordinalIndex >= 0;
}

/**
 * The inclusive calendar-day count of `[startDate, endDate]`, or `null` when the range does not
 * resolve — never `0`, never negative, never a fallback, and never `days.length` (design §4.3).
 *
 * "Inclusive" is the whole point and is expressed once, here: `endDate === startDate` is a valid
 * ONE-day trip, not an empty range. The count exists only when both endpoints are present, both are
 * real calendar dates, and `endDate` is not before `startDate`.
 *
 * This is a calendar-day count and nothing else. It is NOT a number of nights, and `count - 1` must
 * never be presented as one: whether the first and last civil day involve a hotel night depends on
 * arrival/departure semantics this model does not have and this phase does not create (design §4.4).
 */
export function deriveTripCalendarDays(bounds: TripBounds): number | null {
  const { startDate, endDate } = bounds;
  if (startDate === null || endDate === null) return null;
  if (!isValidCivilDate(startDate) || !isValidCivilDate(endDate)) return null;
  const difference = differenceInCivilDays(startDate, endDate);
  if (difference === null || difference < 0) return null;
  return difference + 1;
}

/**
 * Assesses ONE day bucket, identified ONLY by its zero-based ordinal position — the same ordinal
 * every existing consumer already derives from array position. No day id is accepted, so this
 * function provably cannot depend on identity (design §12); no draft is accepted, so it provably
 * cannot mutate one.
 *
 * Resolution order, exactly as specified (design §7.1), each step short-circuiting:
 *
 *   1. `invalid-ordinal`  — the caller's ordinal is not a reachable array position;
 *   2. `no-start-date`    — no Día 1 anchor, so no bucket has a date at all;
 *   3. `no-end-date`      — no upper bound recorded, so no bucket can be outside one;
 *   4. `invalid-date`     — an endpoint is not a real calendar date, or the arithmetic did not
 *                           resolve (an out-of-range `Date`, an unrepresentable offset);
 *   5. `inverted-range`   — `endDate` precedes `startDate`; stored and reported, never repaired;
 *   6. otherwise compute the inclusive `tripCalendarDays` and compare:
 *      `ordinal < tripCalendarDays` → `within-bounds`, else `after-trip-end`.
 *
 * `no-start-date` deliberately outranks `no-end-date`: `startDate` is the positional anchor all
 * ordinal arithmetic depends on, so without it there is no date to assess, whatever `endDate` says.
 *
 * `addCivilDays` is reached only after every guard above has passed, so no invalid ordinal and no
 * unavailable range can ever fabricate a `dayDate`.
 */
export function assessTripBounds(bounds: TripBounds, ordinalIndex: number): TripBoundsAssessment {
  if (!isValidOrdinalIndex(ordinalIndex)) {
    return { kind: "bounds-unavailable", reason: "invalid-ordinal" };
  }

  const { startDate, endDate } = bounds;
  if (startDate === null) return { kind: "bounds-unavailable", reason: "no-start-date" };
  if (endDate === null) return { kind: "bounds-unavailable", reason: "no-end-date" };
  if (!isValidCivilDate(startDate) || !isValidCivilDate(endDate)) {
    return { kind: "bounds-unavailable", reason: "invalid-date" };
  }

  const difference = differenceInCivilDays(startDate, endDate);
  if (difference === null) return { kind: "bounds-unavailable", reason: "invalid-date" };
  if (difference < 0) return { kind: "bounds-unavailable", reason: "inverted-range" };

  const tripCalendarDays = difference + 1;
  const dayDate = addCivilDays(startDate, ordinalIndex);
  // Defensive second step, mirroring the existing output guard in `deriveReservationDateWindow`:
  // a valid start date plus a valid ordinal can still exceed what a `Date` can represent, and a
  // fabricated date string is never an acceptable answer.
  if (dayDate === null || !isValidCivilDate(dayDate)) {
    return { kind: "bounds-unavailable", reason: "invalid-date" };
  }

  return ordinalIndex < tripCalendarDays
    ? { kind: "within-bounds", dayDate, ordinal: ordinalIndex, tripCalendarDays }
    : { kind: "after-trip-end", dayDate, ordinal: ordinalIndex, tripCalendarDays };
}

/**
 * The three distinct facts the planner may state about the range, derived together so the UI never
 * has to conflate them (design §9.1): the civil range the user chose, how many buckets currently
 * exist, and — only when both are known — how many buckets fall after the end of the range.
 *
 * Deliberately structured data, not prose: this module states facts and the component renders them,
 * so the counting logic is testable on its own and the copy stays where copy belongs.
 *
 * `daysAfterTripEnd` is a COUNT OF BUCKETS, never advice. Nothing here says a trip should be longer
 * or shorter, and the "fewer" and "equal" cases are deliberately indistinguishable in the output —
 * neither is endorsed as correct (design §9.2).
 */
export type TripBoundsSummary = {
  startDate: string | null;
  endDate: string | null;
  /** Inclusive calendar-day count, or `null` when the range does not resolve. */
  tripCalendarDays: number | null;
  /** How many day buckets currently exist. `null` when there is no day assignment (`days: null`). */
  dayCount: number | null;
  /** Why the range does not resolve, or `null` when it does. Mirrors the assessment's vocabulary. */
  unavailableReason: Exclude<TripBoundsUnavailableReason, "invalid-ordinal"> | null;
  /** Buckets at an ordinal at or beyond `tripCalendarDays`; `0` when there are none. `null` when
   *  either the range or the bucket count is unknown, so "no mismatch" is never faked. */
  daysAfterTripEnd: number | null;
};

export function buildTripBoundsSummary(bounds: TripBounds, dayCount: number | null): TripBoundsSummary {
  const { startDate, endDate } = bounds;
  const tripCalendarDays = deriveTripCalendarDays(bounds);

  let unavailableReason: TripBoundsSummary["unavailableReason"] = null;
  if (tripCalendarDays === null) {
    if (startDate === null) unavailableReason = "no-start-date";
    else if (endDate === null) unavailableReason = "no-end-date";
    else if (!isValidCivilDate(startDate) || !isValidCivilDate(endDate)) unavailableReason = "invalid-date";
    else unavailableReason = "inverted-range";
  }

  const normalizedDayCount =
    dayCount !== null && Number.isSafeInteger(dayCount) && dayCount >= 0 ? dayCount : null;

  return {
    startDate,
    endDate,
    tripCalendarDays,
    dayCount: normalizedDayCount,
    unavailableReason,
    daysAfterTripEnd:
      tripCalendarDays === null || normalizedDayCount === null
        ? null
        : Math.max(0, normalizedDayCount - tripCalendarDays),
  };
}
