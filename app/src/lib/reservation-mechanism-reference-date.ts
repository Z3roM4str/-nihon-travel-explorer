import { isValidCivilDate } from "./civil-date";
import type { ReservationMechanismDateDerivation } from "./reservation-mechanism-date-derivation";
import type { ReservationMechanismScope } from "./reservation-mechanism-evidence";

/**
 * Phase 3F-H — Official Reservation Reference-Date Relation.
 *
 * This module implements the single narrow proposition approved by the Phase 3F-G design gate:
 * given one explicit civil reference date and one already-derived Phase 3F-D official result,
 * describe only where that reference date sits relative to the recorded official calendar date or
 * calendar-date span.
 *
 * It is a CIVIL-DATE relation, not an availability relation. It deliberately cannot express, and
 * must never be extended to express, whether a sale/application is open or closed, whether tickets
 * remain, whether the reader is late, whether a deadline passed, or whether anything should be
 * bought now. Those claims need a current-instant contract plus operator-side state, and Phase 3F-G
 * explicitly refused to authorize either.
 *
 * Deliberate non-reuse: Phase 3D-O's `evaluateReservationWindowReference` and
 * `ReservationWindowReferenceRelation` describe an *editorial advance-guidance* window derived from
 * `Place.reservation.leadTime`. That is a different evidence domain with different provenance, so
 * Phase 3F owns this evaluator outright. The only thing the two phases share is the concrete
 * device-local civil date value captured once at the application boundary.
 *
 * The evaluator is pure and receives the reference date explicitly: it reads no clock, constructs
 * no ambient `Date`, generates no instant, performs no timezone conversion and never consults the
 * recorded release/open/close clock times or source timezone. Those remain Phase 3F-F presentation
 * evidence, shown as recorded — `Asia/Tokyo` stays `Asia/Tokyo` and `null` stays unknown.
 */

/** Phase 3F-D results that carry a calendar fact this phase is allowed to relate a date to. */
type DateRelatableDerivation = Extract<
  ReservationMechanismDateDerivation,
  { kind: "release-date" } | { kind: "application-window" }
>;

type RelationIdentity = {
  recordId: string;
  placeId: string;
  scope: ReservationMechanismScope;
};

export type OfficialReservationReferenceRelation =
  | {
      kind: "not-assessed";
      reason: "invalid-reference-date" | "derivation-not-date-relatable";
    }
  | (RelationIdentity & {
      kind:
        | "before-recorded-release-date"
        | "on-recorded-release-date"
        | "after-recorded-release-date";
      referenceDate: string;
      releaseDate: string;
    })
  | (RelationIdentity & {
      kind:
        | "before-recorded-application-date-span"
        | "within-recorded-application-date-span"
        | "after-recorded-application-date-span";
      referenceDate: string;
      openDate: string;
      closeDate: string;
    });

/** Every assessed relation, i.e. everything that carries identity and a concrete reference date. */
export type AssessedOfficialReservationReferenceRelation = Exclude<
  OfficialReservationReferenceRelation,
  { kind: "not-assessed" }
>;

const NOT_DATE_RELATABLE: OfficialReservationReferenceRelation = {
  kind: "not-assessed",
  reason: "derivation-not-date-relatable",
};

function identityOf(derivation: DateRelatableDerivation): RelationIdentity {
  return {
    recordId: derivation.recordId,
    placeId: derivation.placeId,
    scope: derivation.scope,
  };
}

/**
 * Pure relation evaluator over one Phase 3F-D derivation.
 *
 * Phase 3F-D remains the sole owner of official-date arithmetic (monthly alignment, rolling-month
 * fallbacks, day offsets, event applicability). This function consumes the already-derived civil
 * dates verbatim and never re-derives, re-aligns or "repairs" them.
 *
 * Because every civil date here is fixed-width `YYYY-MM-DD`, lexical ordering is identical to
 * calendar ordering once both sides are validated — which is why a year rollover needs no special
 * case and no instant arithmetic.
 *
 * Only `release-date` and `application-window` are assessable. `no-visit-date`,
 * `inactive-evidence`, `not-applicable-to-visit-date` and `not-derivable` describe the *absence* of
 * an applicable official calendar fact, so relating a date to them would fabricate a comparison the
 * evidence does not support.
 */
export function evaluateOfficialReservationReferenceDate(
  derivation: ReservationMechanismDateDerivation,
  referenceDate: string
): OfficialReservationReferenceRelation {
  if (!isValidCivilDate(referenceDate)) {
    return { kind: "not-assessed", reason: "invalid-reference-date" };
  }

  if (derivation.kind === "release-date") {
    if (!isValidCivilDate(derivation.releaseDate)) return NOT_DATE_RELATABLE;
    const common = {
      ...identityOf(derivation),
      referenceDate,
      releaseDate: derivation.releaseDate,
    };
    if (referenceDate < derivation.releaseDate) {
      return { kind: "before-recorded-release-date", ...common };
    }
    if (referenceDate > derivation.releaseDate) {
      return { kind: "after-recorded-release-date", ...common };
    }
    // Same civil-date label only. A recorded release time (e.g. Ghibli's 10:00) is NOT consulted,
    // so this result must never be read or rendered as "the sale has opened / has not opened yet".
    return { kind: "on-recorded-release-date", ...common };
  }

  if (derivation.kind === "application-window") {
    if (!isValidCivilDate(derivation.openDate) || !isValidCivilDate(derivation.closeDate)) {
      return NOT_DATE_RELATABLE;
    }
    // Two individually valid civil dates do not make an ordered span. Phase 3F-D's evidence parser
    // constrains `monthsBeforeVisitMonth` and `daysBeforeVisit` to positive integers, but nothing in
    // it guarantees that the DERIVED open date lands on or before the derived close date, so this
    // boundary must not assume the span it receives is ordered. An inverted span is refused
    // outright: swapping, repairing, re-ordering or guessing the intended direction would invent an
    // official date span the evidence never recorded. `openDate === closeDate` stays a legitimate
    // one-day span.
    if (derivation.openDate > derivation.closeDate) return NOT_DATE_RELATABLE;
    const common = {
      ...identityOf(derivation),
      referenceDate,
      openDate: derivation.openDate,
      closeDate: derivation.closeDate,
    };
    if (referenceDate < derivation.openDate) {
      return { kind: "before-recorded-application-date-span", ...common };
    }
    if (referenceDate > derivation.closeDate) {
      return { kind: "after-recorded-application-date-span", ...common };
    }
    // Both edges are inclusive AS CALENDAR DATES. Katsura's recorded 05:00 open and 23:59 close
    // times are not compared here, so an edge date means "inside the recorded date span" and never
    // "applications are open/closed today".
    return { kind: "within-recorded-application-date-span", ...common };
  }

  return NOT_DATE_RELATABLE;
}
