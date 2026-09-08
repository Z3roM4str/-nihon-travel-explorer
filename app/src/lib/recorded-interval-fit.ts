import type { Place } from "../types";
import type { DayAssignment } from "./day-assignment";
import { deriveHoursClosureVisitDate } from "./hours-closure-composition";
import { resolveDuration, type MinuteRange } from "./duration";
import { interpretPlaceHours, type RecordedHoursFact } from "./recorded-hours";

/**
 * Phase 3D-L — Manual Visit-Start-Time vs. Recorded Interval Fit.
 *
 * Implements exactly the scope `docs/VISIT_TIME_FEASIBILITY_DESIGN.md` (Phase 3D-K) approved, and
 * nothing wider. This module answers one question, for one place on one assigned day:
 *
 *   "Given the recorded clock interval, a start time the user typed in by hand, and the recorded
 *   visit duration, how does that duration compare with the time remaining inside THE RECORDED
 *   INTERVAL?"
 *
 * **`duration fits recorded interval` ≠ `place is visitable`** — the load-bearing distinction of
 * the design gate (§10), and the reason every variant name below refers to the *recorded interval*
 * rather than to the place. Nothing here claims a place is open, available, feasible, visitable,
 * compatible, or valid; no such word appears as a variant, a field, or a boolean anywhere in this
 * module, and no boolean result exists at all (design §14).
 *
 * **This module is a NEW downstream consumer, never a widening of Phase 3D-E.**
 * `recorded-hours.ts` is frozen: its regex, categories, tiers, priority order, `RecordedHoursFact`
 * and entry points are untouched by this phase. Its own header refuses the question "this closes
 * before your visit ends" — design §3.8 reconciles that in full: the sentence scopes that module
 * (the same self-scoping `temporal-availability.ts` states and Phase 3D-J already consumed without
 * widening), the refused question is about the *place* while the outcome below is about the
 * *record*, and that refusal was made with no user-chosen start time available.
 *
 * **Eligibility is decided by narrowing the discriminated union, never by tier** (design §5).
 * `fact.tier === "safe"` would also admit `recorded-24h`, which has no recorded start or end to be
 * an operand and which 3 of its 15 real records narrow to a sub-facility in their own text
 * (`JP-016` even names a `06:00–17:00` hall interval the `known-24h` branch discards). Every
 * PARTIAL, OPAQUE and UNKNOWN family is refused the same way, including
 * `fixed-interval-with-caveat`, whose token is parseable precisely where the caveat says the
 * interval may not hold. Classification first, arithmetic second: an excluded fact's `raw` text is
 * never re-scanned here looking for a usable interval.
 *
 * **Deliberately NOT read anywhere in this module**: `place.bestTime` (an OPAQUE editorial
 * recommendation — `"Mañana"` is not an opening time, not 09:00, and not "before noon"; see design
 * §15), `place.schedule.closures`, any `ClosureFact`/`WeekdayClosureAssessment`/`CompositionClass`
 * (design §10 — the arithmetic carries no closure evidence and must never appear to), any
 * `TransferEdge` or transfer minutes (deriving a next place's arrival time is scheduling, design
 * §19), and `place.febMar2027`.
 *
 * **Pure, local, and unpersisted.** No React, no DOM, no storage, no network, no `Date`, no
 * `Date.now()`, no epoch value, no ISO instant, no IANA timezone. Every quantity below is *minutes
 * since local midnight* in one single unnamed local frame — the arithmetic never leaves that frame,
 * which is why no timezone is needed and why it would stay correct if the dataset ever covered a
 * second country (design §8). Nothing produced here is ever written to storage; only the user's
 * own `HH:mm` decision is persisted, by `planning-draft.ts`.
 */

/**
 * The parsed form of one `recorded-interval` fact's `intervalRaw` token.
 *
 * `intervalStartMinutes`/`intervalEndMinutes` are the RECORDED bounds. They are deliberately never
 * called a bare `startMinutes`: the user's own value is `chosenStartMinutes`, and Phase 3D-K's
 * second corrective review found that collapsing the two names made the remaining-time formula
 * readable as the interval *span* — the exact quantity Phase 3D-I evaluated and refused. The two
 * names stay distinct for that reason, not for style (design §6).
 */
export type ParsedRecordedInterval =
  | {
      kind: "parsed";
      intervalStartMinutes: number;
      intervalEndMinutes: number;
      crossesMidnight: boolean;
    }
  | {
      kind: "unparseable";
      reason: "shape" | "end-without-minutes" | "clock-out-of-range" | "degenerate";
    };

/**
 * The closed result vocabulary. Eight variants, no ninth, no `null`, no `undefined`, no catch-all,
 * and no boolean anywhere — a boolean could not carry `only-minimum-duration-fits-interval`, and a
 * consumer that reduced this union to one would be discarding the distinction it exists for
 * (design §14).
 *
 * `start-time-outside-recorded-interval` is the eighth variant the design gate added over the
 * seven the phase brief required, and it is a real need rather than an invention: a user can type
 * `07:00` for a place recorded as `09:00–17:00`, which is neither "does not fit" (the duration
 * might fit perfectly well from opening) nor an unevaluable input.
 */
export type RecordedIntervalDurationFit =
  | { kind: "visit-date-not-evaluable" }
  | {
      kind: "interval-not-evaluable";
      reason:
        | "hours-not-a-recorded-interval"
        | "interval-token-unparseable"
        | "overnight-interval-not-supported";
    }
  | { kind: "duration-not-evaluable" }
  | { kind: "no-start-time-chosen" }
  | { kind: "start-time-outside-recorded-interval"; chosenStartMinutes: number }
  | { kind: "recorded-duration-fits-interval"; remainingMinutes: number; duration: MinuteRange }
  | { kind: "only-minimum-duration-fits-interval"; remainingMinutes: number; duration: MinuteRange }
  | { kind: "recorded-duration-exceeds-interval"; remainingMinutes: number; duration: MinuteRange };

/**
 * A manual visit start time as stored and entered: a local civil clock time, 24-hour,
 * zero-padded, `00:00`–`23:59`. Deliberately the same pattern `planning-draft.ts` validates
 * stored values against, exported from here so the persistence layer and this evaluator can never
 * disagree about what counts as a well-formed manual time.
 */
export const VISIT_START_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Strictly narrower than `recorded-hours.ts`'s `TIME_RANGE_RE`: anchored end to end against the
 * token, with the end's minutes captured separately so a missing `:mm` is a NAMED refusal rather
 * than an assumed `:00`. The separator set is the classifier's own (`–`/`—`/`-`) — this parser
 * narrows what is accepted, it never widens it. */
const RECORDED_INTERVAL_TOKEN_PATTERN = /^(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?$/;

const MINUTES_PER_HOUR = 60;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;

function clockToMinutes(hours: number, minutes: number): number {
  return hours * MINUTES_PER_HOUR + minutes;
}

/**
 * Parses the RECORDED token of an already-classified `recorded-interval` fact.
 *
 * Takes the fact, never a bare `string` and never `place.schedule.hours`, so it is structurally
 * impossible to feed a PARTIAL/OPAQUE/UNKNOWN record into it (design §6 constraint 1). It reads
 * `intervalRaw` only — never `raw`, whose surrounding editorial text ("aprox.", "Tiendas…",
 * "según anuncio") is evidence for the reader, not input for arithmetic.
 *
 * Nothing is ever repaired: a missing end `:mm`, an out-of-range clock component, and a
 * zero-length window each produce a named `unparseable` reason. A degenerate `09:00–09:00`
 * specifically must NOT be read as "always open". An overnight token parses (so the refusal can be
 * named precisely) but is refused downstream by `evaluateRecordedIntervalFit` — `00:00` as an end
 * bound reaches that same branch rather than being silently rewritten to 1440 (design §6/§12).
 */
export function parseRecordedInterval(
  hours: RecordedHoursFact & { kind: "recorded-interval" }
): ParsedRecordedInterval {
  const match = RECORDED_INTERVAL_TOKEN_PATTERN.exec(hours.intervalRaw.trim());
  if (!match) return { kind: "unparseable", reason: "shape" };
  if (match[4] === undefined) return { kind: "unparseable", reason: "end-without-minutes" };

  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);
  if (
    startHour > MAX_HOUR ||
    endHour > MAX_HOUR ||
    startMinute > MAX_MINUTE ||
    endMinute > MAX_MINUTE
  ) {
    return { kind: "unparseable", reason: "clock-out-of-range" };
  }

  const intervalStartMinutes = clockToMinutes(startHour, startMinute);
  const intervalEndMinutes = clockToMinutes(endHour, endMinute);
  if (intervalStartMinutes === intervalEndMinutes) return { kind: "unparseable", reason: "degenerate" };

  return {
    kind: "parsed",
    intervalStartMinutes,
    intervalEndMinutes,
    crossesMidnight: intervalEndMinutes < intervalStartMinutes,
  };
}

/**
 * The user's own `HH:mm` decision as minutes since local midnight, or `null` when there is no
 * usable manual decision. Never guesses, never coerces, and never supplies a default — no `09:00`,
 * no opening time, no "now" (design §7).
 */
export function parseChosenStartMinutes(visitStartTime: string | null | undefined): number | null {
  if (typeof visitStartTime !== "string") return null;
  const match = VISIT_START_TIME_PATTERN.exec(visitStartTime.trim());
  if (!match) return null;
  return clockToMinutes(Number(match[1]), Number(match[2]));
}

/**
 * The whole evaluation, as a pure function of four already-resolved inputs.
 *
 * **Precedence is deliberate.** Refusals that are properties of the RECORD (no valid assigned day,
 * an ineligible or unparseable hours fact, a non-numeric duration) are decided before
 * `no-start-time-chosen`, which is a property of the USER's input. Otherwise a place whose duration
 * can never be evaluated — the 3 real `recorded-interval` places with a qualitative
 * `"Medio día"`/`"Día completo"` duration — would first ask the user to type a time and only then
 * admit the comparison was never possible.
 *
 * `visitDate` is a gate, not an operand: the arithmetic below is pure local clock arithmetic and
 * never consumes the date numerically. It is required because a manual start time is a decision
 * about a *specific assigned day*, so a place with no valid assigned day has no day for the user to
 * be deciding about (design §13).
 *
 * The start-eligibility window is half-open —
 * `intervalStartMinutes <= chosenStartMinutes < intervalEndMinutes`: a start exactly at the
 * recorded opening is inside, a start exactly at the recorded closing is outside (there is no
 * remaining recorded time at all), and anything before or after is outside.
 *
 * The remaining time is `intervalEndMinutes - chosenStartMinutes`. It is emphatically NOT
 * `intervalEndMinutes - intervalStartMinutes`, which is the interval's *span* — the quantity Phase
 * 3D-I evaluated and refused, and the MAJOR ambiguity Phase 3D-K's second corrective review
 * removed from the design document (design §9/§20).
 */
export function evaluateRecordedIntervalFit(
  hours: RecordedHoursFact,
  duration: MinuteRange | null,
  visitStartTime: string | null | undefined,
  visitDate: string | null
): RecordedIntervalDurationFit {
  if (visitDate === null) return { kind: "visit-date-not-evaluable" };

  // Eligibility by union narrowing — never `tier === "safe"` (which also admits `recorded-24h`),
  // and never a re-scan of an excluded fact's raw text.
  if (hours.kind !== "recorded-interval") {
    return { kind: "interval-not-evaluable", reason: "hours-not-a-recorded-interval" };
  }

  const interval = parseRecordedInterval(hours);
  if (interval.kind === "unparseable") {
    return { kind: "interval-not-evaluable", reason: "interval-token-unparseable" };
  }
  if (interval.crossesMidnight) {
    return { kind: "interval-not-evaluable", reason: "overnight-interval-not-supported" };
  }

  if (duration === null) return { kind: "duration-not-evaluable" };

  const chosenStartMinutes = parseChosenStartMinutes(visitStartTime);
  if (chosenStartMinutes === null) return { kind: "no-start-time-chosen" };

  if (
    chosenStartMinutes < interval.intervalStartMinutes ||
    chosenStartMinutes >= interval.intervalEndMinutes
  ) {
    return { kind: "start-time-outside-recorded-interval", chosenStartMinutes };
  }

  const remainingMinutes = interval.intervalEndMinutes - chosenStartMinutes;

  // Both bounds of the recorded range are always considered; neither end is ever discarded, and no
  // midpoint, mean, median, preferred value, or probability is ever computed (design §9).
  if (duration.maxMinutes <= remainingMinutes) {
    return { kind: "recorded-duration-fits-interval", remainingMinutes, duration };
  }
  if (duration.minMinutes <= remainingMinutes) {
    return { kind: "only-minimum-duration-fits-interval", remainingMinutes, duration };
  }
  return { kind: "recorded-duration-exceeds-interval", remainingMinutes, duration };
}

/** One place's signal, carried with the identity a consumer needs to render and key it. `hours` is
 * included so the raw recorded text stays available to the view — the parsed token is derivative
 * evidence and must never be shown in its place (design §16 rule 2). */
export type PlaceRecordedIntervalFit = {
  placeId: string;
  placeName: string;
  hours: RecordedHoursFact & { kind: "recorded-interval" };
  visitStartTime: string | null;
  fit: RecordedIntervalDurationFit;
};

/**
 * Derives one place's signal from current planning state.
 *
 * The visit-date prerequisite is Phase 3D-H's/3D-J's existing strict contract, reused unchanged via
 * `deriveHoursClosureVisitDate` rather than reimplemented: `dayAssignment.valid === true`, a valid
 * `startDate`, the place in exactly one day bucket, and a valid derived civil date, with no partial
 * fallback. That import is a DATE helper only — it reads no closure text and returns no closure
 * fact — so reusing it does not give this module a closure dependency; sharing it is what
 * guarantees this phase cannot drift into a competing second date contract (design §13).
 *
 * Returns `null` when the place must have no control at all: no valid assigned day, or an hours
 * fact that is not `recorded-interval`. A `recorded-interval` place always gets a signal, even when
 * its duration or token turns out not to be evaluable — the refusal is named rather than hidden.
 */
export function derivePlaceRecordedIntervalFit(
  place: Place,
  dayAssignment: DayAssignment,
  startDate: string | null | undefined,
  visitStartTimes: Readonly<Record<string, string>>
): PlaceRecordedIntervalFit | null {
  const visitDate = deriveHoursClosureVisitDate(dayAssignment, startDate, place.id);
  if (visitDate === null) return null;

  const hours = interpretPlaceHours(place);
  if (hours.kind !== "recorded-interval") return null;

  const visitStartTime = visitStartTimes[place.id] ?? null;
  return {
    placeId: place.id,
    placeName: place.name,
    hours,
    visitStartTime,
    fit: evaluateRecordedIntervalFit(hours, resolveDuration(place.duration), visitStartTime, visitDate),
  };
}

/**
 * Pure day-card boundary: the eligible places of one day, in that day's own order, each with its
 * current signal. Recomputing from new route/day/date/time input cannot retain stale state — there
 * is nothing cached and nothing persisted here.
 *
 * Places with no valid assigned day and places whose hours are not `recorded-interval` are absent
 * from the result entirely, so the view renders no control for them. That absence is intentional:
 * a disabled placeholder on a PARTIAL or OPAQUE place would invite the reading "this place has no
 * hours", which is false for every one of them (design §18).
 */
export function buildDayRecordedIntervalFits(
  places: readonly Place[],
  dayAssignment: DayAssignment,
  startDate: string | null | undefined,
  visitStartTimes: Readonly<Record<string, string>>
): PlaceRecordedIntervalFit[] {
  const items: PlaceRecordedIntervalFit[] = [];
  for (const place of places) {
    const item = derivePlaceRecordedIntervalFit(place, dayAssignment, startDate, visitStartTimes);
    if (item !== null) items.push(item);
  }
  return items;
}
