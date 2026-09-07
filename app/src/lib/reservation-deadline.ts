import type { Place } from "../types";
import { interpretLeadTimeText } from "./reservation-lead-time";
import { interpretPlaceReservation, type ReservationFact } from "./reservation";
import { addCivilDays, isValidCivilDate } from "./civil-date";
import type { DayAssignment } from "./day-assignment";

/**
 * Phase 3D-H — Explicit Lead-Time Window (Class A only).
 *
 * Implements the design gate `docs/RESERVATION_DEADLINE_DESIGN.md` (Phase 3D-G) authorized this
 * phase. This module answers exactly one question beyond what Phase 3D-D already answers: for the
 * narrow slice of `reservation.leadTime` records that are an explicit numeric range over a single,
 * non-mixed day/week unit ("Class A" in the design gate), what recorded advance-notice window can
 * be derived for a place's assigned visit date? Everything else — unit-only records, mixed-unit
 * records, month ranges, opaque/specific-mechanism records — stays a named, non-computable result,
 * exactly as the design gate decided.
 *
 * **This module does not replace Phase 3D-D.** `interpretLeadTimeText` (`reservation-lead-time.ts`)
 * remains the sole classifier of `reservation.leadTime` free text into
 * `not-applicable`/`bare-magnitude`/`opaque-entity-or-mechanism-specific`. This module only adds a
 * second, narrower pass — numeric-range extraction — and only for the `bare-magnitude` category,
 * reusing the classification rather than re-implementing or loosening it.
 *
 * **Ordering is the safety property (design §10.1/§8.1).** `interpretReservationDeadlineText`
 * checks `not-applicable` and `specific-mechanism` first and returns immediately for both — a
 * `specific-mechanism` record's raw text is never re-scanned for numeric-looking substrings, no
 * matter how parseable it looks (`"Lotería 3 meses antes; revisar liberaciones"` must never become
 * a numeric window). Numeric parsing happens only inside the `coarse-magnitude` branch, and only
 * for a single, non-mixed day/week unit — a mixed unit (`"Días/semanas"`) or a month unit
 * (`"1–3 meses"`) never reaches numeric extraction, matching the design's Class B/C/D boundaries.
 *
 * **Reservation-level eligibility is a separate concern (design §10.4), never a digit parser.** A
 * numerically clean `leadTime` must not override reservation-level semantics that are unknown or
 * internally contradictory. `isReservationEligibleForDeadlineWindow` gates on
 * `interpretPlaceReservation`'s existing `tier`/`consistentWithDerivedBoolean` fields — never on a
 * literal `reservation.raw` string — reusing the existing interpreter rather than adding a second
 * reservation parser.
 *
 * **The visit-date contract is deliberately stricter than the existing day-view date (design §5).**
 * `OrderedSequenceBuilder.tsx` already computes and renders a per-day date
 * (`addCivilDays(startDate, dayIndex)`) regardless of whether the day assignment is structurally
 * valid — only a warning banner gates on that. `deriveVisitDateForPlace` below imposes a stricter
 * rule for this feature specifically: `DayAssignment.valid === true` is required, on top of a valid
 * `startDate` and the place actually belonging to exactly one day bucket. An invalid assignment
 * yields `null` for every place, never a partial "trust the parts that look fine" reading.
 *
 * **`febMar2027` orthogonality (design §6.2) is structural, not just a convention.** This module
 * never imports `feb-mar-status.ts`, never reads `place.febMar2027` in any form, and never accepts
 * a Feb–Mar status as an argument. Two places with identical `reservation`/day-assignment data but
 * different `febMar2027.status` produce byte-identical results here — composing the two axes for
 * presentation is a UI-layer concern (`OrderedSequenceBuilder.tsx`), never this module's.
 *
 * **No current-date/urgency axis.** Every function below is relative to a *visit* date, never to
 * `Date.now()`, the browser's clock, or any other notion of "now." No `daysRemaining`, `isLate`, or
 * `isUrgent` field exists anywhere in this module's types, matching every prior Phase 3D runtime
 * module's own discipline.
 *
 * **Pure and unpersisted.** Every function here is pure — no `Date.now()`, no I/O, no mutation of
 * a `Place` or a `ManualPlanningDraftV2`. Nothing produced here is ever written to storage; a
 * derived window is recomputed on every read, exactly like every other Phase 3D fact.
 */

/**
 * The one structured fact `interpretReservationDeadlineText` produces from raw `reservation.leadTime`
 * text alone — pure text-to-evidence, no `Place`, no date. A closed, kind-tagged union so a
 * consumer can never read `minLeadDays`/`maxLeadDays` off anything but an `explicit-lead-window`.
 * `raw` is carried verbatim on every variant, per the Phase 3D-A contract's rule 1.
 */
export type ReservationDeadlineSignal =
  | { kind: "not-applicable"; raw: string }
  | {
      kind: "not-computable";
      /** Named, not inferred — every reason traces to a specific evidence class in the design gate
       * (§4/§7/§8): `specific-mechanism` is Class E (opaque, never re-scanned for numbers),
       * `unit-without-quantity` is Class B (a unit with no recorded quantity, e.g. "Semanas" — or a
       * numeric range malformed enough that no safely usable quantity was recorded, e.g. a reversed
       * or zero-length range; that shape does not occur in the audited dataset, but is treated
       * identically rather than fabricated a direction for it), `mixed-unit-without-quantity` is
       * Class C ("Días/semanas" — which unit the count would apply to is inherently ambiguous,
       * regardless of whether a quantity is present), and `month-range-not-supported` is Class D
       * (refused for a first implementation — see the design gate §7). */
      reason: "specific-mechanism" | "unit-without-quantity" | "mixed-unit-without-quantity" | "month-range-not-supported";
      raw: string;
    }
  | {
      /** Class A only: an explicit numeric range over a single, non-mixed day/week unit. */
      kind: "explicit-lead-window";
      minLeadDays: number;
      maxLeadDays: number;
      raw: string;
    };

/** Matches an explicit numeric range over exactly one non-mixed day/week unit — deliberately a
 * stricter, digit-capturing sibling of `reservation-lead-time.ts`'s own `BARE_MAGNITUDE_RE`, not a
 * replacement for it. Never matches a mixed unit (`"días/semanas"`) or a month unit (`"meses"`) —
 * those are excluded by construction, not filtered out afterward, so this regex can never itself
 * become a second classifier for categories `interpretLeadTimeText` already owns. */
const EXPLICIT_SINGLE_UNIT_RANGE_RE = /^(\d+)\s*[–—-]\s*(\d+)\s*(d[ií]as?|semanas?)$/i;

const WEEK_UNIT_RE = /^semanas?$/i;

/** The one and only unit conversion this module performs: 1 week = 7 days, exact arithmetic over
 * an inexact (approximate, editorial) input — see the design gate §6 for why that distinction is
 * load-bearing rather than cosmetic. A day unit converts 1:1. */
function daysPerUnit(unit: string): number {
  return WEEK_UNIT_RE.test(unit) ? 7 : 1;
}

/**
 * Classifies raw `reservation.leadTime` text into a `ReservationDeadlineSignal`. Pure — no `Place`
 * dependency, so it can be tested (and reused) independently of the dataset shape, exactly like
 * `interpretLeadTimeText` itself.
 *
 * Safety order (design §10.1, §2.2 of this phase's brief):
 *  1. Derive the existing `ReservationLeadTimeFact` via `interpretLeadTimeText` — Phase 3D-D
 *     remains the sole classifier; this never reimplements or loosens `classifyLeadTimeCategory`.
 *  2. `kind === "not-applicable"` → returns `{ kind: "not-applicable" }` immediately.
 *  3. `kind === "specific-mechanism"` → returns `{ kind: "not-computable", reason:
 *     "specific-mechanism" }` **immediately, without scanning `raw` for numeric tokens at all**.
 *     This is the load-bearing branch: the opaque text is never re-read for digits.
 *  4. `kind === "coarse-magnitude"` → and ONLY here does numeric parsing happen, gated further by
 *     `magnitude`: a month unit refuses computation outright (Class D); a mixed unit refuses
 *     computation outright (Class C, ambiguous which unit a count would apply to); a single
 *     day/week unit is re-matched against `raw` with `EXPLICIT_SINGLE_UNIT_RANGE_RE` — a pattern
 *     `interpretLeadTimeText`'s own `magnitude` field structurally cannot recover the digits for,
 *     since its regex's numeric prefix is a non-capturing group.
 */
export function interpretReservationDeadlineText(raw: string | null | undefined): ReservationDeadlineSignal {
  const leadTimeFact = interpretLeadTimeText(raw);

  if (leadTimeFact.kind === "not-applicable") {
    return { kind: "not-applicable", raw: leadTimeFact.raw };
  }
  if (leadTimeFact.kind === "specific-mechanism") {
    return { kind: "not-computable", reason: "specific-mechanism", raw: leadTimeFact.raw };
  }

  // kind === "coarse-magnitude" from here on — the sole category numeric parsing may ever touch.
  const { magnitude, raw: text } = leadTimeFact;

  if (magnitude === "months") {
    return { kind: "not-computable", reason: "month-range-not-supported", raw: text };
  }
  if (magnitude === "days-to-weeks" || magnitude === "weeks-to-months") {
    return { kind: "not-computable", reason: "mixed-unit-without-quantity", raw: text };
  }

  // magnitude is "days" or "weeks" — a single, non-mixed unit; look for an explicit numeric range.
  const match = EXPLICIT_SINGLE_UNIT_RANGE_RE.exec(text.trim());
  if (!match) {
    return { kind: "not-computable", reason: "unit-without-quantity", raw: text };
  }

  const perUnit = daysPerUnit(match[3]);
  const minLeadDays = Number(match[1]) * perUnit;
  const maxLeadDays = Number(match[2]) * perUnit;

  const boundsAreSafe =
    Number.isFinite(minLeadDays) && Number.isFinite(maxLeadDays) && minLeadDays > 0 && minLeadDays <= maxLeadDays;
  if (!boundsAreSafe) {
    return { kind: "not-computable", reason: "unit-without-quantity", raw: text };
  }

  return { kind: "explicit-lead-window", minLeadDays, maxLeadDays, raw: text };
}

/** The usual entry point: classifies a real `Place`'s `reservation.leadTime` directly. */
export function interpretPlaceReservationDeadlineSignal(place: Place): ReservationDeadlineSignal {
  return interpretReservationDeadlineText(place.reservation.leadTime);
}

/**
 * Reservation-level eligibility (design §10.4): a numerically clean `leadTime` must not override
 * reservation-level semantics that are unknown or internally contradictory. Gates on
 * `interpretPlaceReservation`'s existing `tier`/`consistentWithDerivedBoolean` fields — never on a
 * literal `reservation.raw` value such as `"Sí"`/`"Recomendable"`, which are current data values,
 * not a contract. `tier === "unknown"` covers both `missing` and `unrecognized-value` — records
 * this app could not interpret at all; `consistentWithDerivedBoolean === false` means the record's
 * prose and its derived `required` boolean disagree, which is internally contradictory. Pure — a
 * small, separately testable function, deliberately not folded into the text-only
 * `interpretReservationDeadlineText` above (see this module's own doc for why the two stay
 * separate layers).
 */
export function isReservationEligibleForDeadlineWindow(reservation: ReservationFact): boolean {
  return reservation.tier !== "unknown" && reservation.consistentWithDerivedBoolean;
}

/**
 * The application layer: evidence (`ReservationDeadlineSignal`) + reservation-level eligibility +
 * a visit date → a window. A closed union so a consumer can never read `farAdvanceDate`/
 * `nearAdvanceDate` off anything but a `derived-window`.
 *
 * `farAdvanceDate`/`nearAdvanceDate` are named for their distance from the visit date, deliberately
 * never `earliestDate`/`latestDate`/`opensAt`/`closesAt` (design §6.1): `farAdvanceDate` is **not**
 * "the earliest date booking is allowed" (booking earlier may be possible and preferable);
 * `nearAdvanceDate` is **not** a guaranteed last booking date or availability deadline; neither
 * edge implies inventory availability. Both describe edges of the *recorded advance-guidance
 * range*, nothing more.
 */
export type ReservationDateWindow =
  | { kind: "no-visit-date" }
  | { kind: "no-window"; signal: ReservationDeadlineSignal }
  | {
      kind: "derived-window";
      visitDate: string;
      /** The edge FURTHER FROM the visit: `addCivilDays(visitDate, -maxLeadDays)`. */
      farAdvanceDate: string;
      /** The edge NEARER TO the visit: `addCivilDays(visitDate, -minLeadDays)`. */
      nearAdvanceDate: string;
      signal: Extract<ReservationDeadlineSignal, { kind: "explicit-lead-window" }>;
    };

/**
 * Pure. Never reads `Date.now()`, never reads `place.febMar2027` or any Feb–Mar status (design
 * §6.2 Rule 1 — that axis composes at presentation only, never here), never mutates anything, and
 * never re-derives `startDate`/`dayIndex` itself — `visitDate` is computed by the caller via
 * `deriveVisitDateForPlace` below, which already owns that state.
 *
 * `visitDate === null` means the caller has already determined the visit-date contract is not met
 * (see `deriveVisitDateForPlace`) — this always yields `"no-visit-date"`, never a guess. Given a
 * real `visitDate`, a signal that is not `explicit-lead-window`, or a `reservationEligible` of
 * `false`, yields `"no-window"` (carrying the signal, so a caller can still show *why* — the
 * `not-computable` reason, or `not-applicable`). Only an eligible `explicit-lead-window` signal
 * produces a `derived-window`; if `addCivilDays` fails for any reason (should not happen for an
 * already-validated `visitDate`, but never assumed), this falls back to `"no-visit-date"` rather
 * than fabricating a date — matching the design gate's own failure table (§12).
 */
export function deriveReservationDateWindow(
  signal: ReservationDeadlineSignal,
  visitDate: string | null,
  reservationEligible: boolean
): ReservationDateWindow {
  if (visitDate === null) return { kind: "no-visit-date" };
  if (signal.kind !== "explicit-lead-window" || !reservationEligible) {
    return { kind: "no-window", signal };
  }

  const farAdvanceDate = addCivilDays(visitDate, -signal.maxLeadDays);
  const nearAdvanceDate = addCivilDays(visitDate, -signal.minLeadDays);
  if (farAdvanceDate === null || nearAdvanceDate === null) return { kind: "no-visit-date" };

  return { kind: "derived-window", visitDate, farAdvanceDate, nearAdvanceDate, signal };
}

/**
 * The visit-date source contract (design §5), deliberately **stricter** than the existing
 * per-day date `OrderedSequenceBuilder.tsx` already renders (see this module's own doc). Returns
 * `null` — never a guess, never a fallback to `startDate` alone — unless ALL of the following hold:
 *
 *  1. `dayAssignment.valid === true` — the day partition is structurally unambiguous. An invalid
 *     assignment yields `null` for every place, not just the affected one.
 *  2. `startDate` is non-null and a valid civil date.
 *  3. `placeId` belongs to exactly one day bucket (guaranteed by `dayAssignment.valid`) — its index
 *     is the zero-based day offset ("Día 1" is index 0).
 *  4. `addCivilDays(startDate, dayIndex)` succeeds.
 *
 * Pure — never mutates `dayAssignment`, never persists anything; the caller already owns both
 * inputs (typically from `usePlanningDraft`/`buildDayAssignment`).
 */
export function deriveVisitDateForPlace(
  dayAssignment: DayAssignment,
  startDate: string | null,
  placeId: string
): string | null {
  if (!dayAssignment.valid) return null;
  if (startDate === null || !isValidCivilDate(startDate)) return null;

  const dayIndex = dayAssignment.days.findIndex((bucket) => bucket.placeIds.includes(placeId));
  if (dayIndex === -1) return null;

  return addCivilDays(startDate, dayIndex);
}

/**
 * The usual place-level entry point, composing everything above: extracts the deadline signal from
 * `place.reservation.leadTime`, checks reservation-level eligibility via
 * `interpretPlaceReservation`, and derives the window for the given (already-validated) visit date.
 * Pure — a thin composition, not new logic; see the individual functions above for what each step
 * actually decides.
 */
export function derivePlaceReservationDateWindow(place: Place, visitDate: string | null): ReservationDateWindow {
  const signal = interpretPlaceReservationDeadlineSignal(place);
  const eligible = isReservationEligibleForDeadlineWindow(interpretPlaceReservation(place));
  return deriveReservationDateWindow(signal, visitDate, eligible);
}
