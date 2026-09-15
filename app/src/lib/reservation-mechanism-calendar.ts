import { isValidCivilDate } from "./civil-date";
import type { DayAssignment } from "./day-assignment";
import type { Place } from "../types";
import { deriveReservationMechanismDatesForPlannedPlace } from "./reservation-mechanism-date-derivation";
import type { ReservationMechanismDateDerivation } from "./reservation-mechanism-date-derivation";
import type {
  ReservationMechanismEvidenceRecord,
  ReservationMechanismScope,
} from "./reservation-mechanism-evidence";
import {
  buildOfficialReservationDatePresentation,
  type OfficialReservationDatePresentation,
} from "./reservation-mechanism-presentation";
import { evaluateOfficialReservationReferenceDate } from "./reservation-mechanism-reference-date";
import {
  buildOfficialReservationReferenceRelationPresentation,
  type OfficialReservationReferenceRelationPresentation,
} from "./reservation-mechanism-reference-date-presentation";
import { formatOfficialReservationCalendarSpanForUi } from "./reservation-mechanism-calendar-presentation";

/**
 * Phase 3F-J — Route-Wide Official Reservation Calendar.
 *
 * A pure aggregator implementing exactly the Phase 3F-I design gate. It gathers the Phase 3F
 * official reservation facts **already derived** for the current plan into one route-wide list
 * ordered by recorded civil date.
 *
 * It is a second *view* of existing facts, never a second source of truth. Nothing here derives an
 * official date, reads a clock, converts a timezone, ranks anything, or makes a booking-state,
 * availability or urgency claim.
 *
 * **Chronology-only (Phase 3F-I §12).** The result contains exactly those facts that have a valid,
 * placeable civil date. A derivation that cannot produce one produces *nothing* here — no neutral
 * row, no placeholder, no substitute date. Those facts are not lost: the per-day Phase 3F-F surface
 * still renders them, unchanged.
 *
 * **Ordering is not priority (Phase 3F-I §8.3).** The chronological order is a reading order over
 * recorded civil dates. It says nothing about what to reserve first, what matters more, what is
 * urgent, scarce or risky. That is why no item carries a priority, rank, score, status or state.
 */

/** One planned day as the caller already has it: the user's explicit place order plus, when the
 * caller holds it, the stable opaque draft day id. The id is never invented here. */
export type RouteWideOfficialReservationCalendarDay = {
  id: string | null;
  places: readonly Place[];
};

/** The official calendar fact this row is anchored on, copied from the Phase 3F-D derivation. */
export type RouteWideOfficialReservationCalendarFact =
  | { kind: "release-date" }
  | {
      kind: "application-date-span";
      openDate: string;
      closeDate: string;
      /** Both recorded edges rendered together as one neutral span (Phase 3F-I §24.4). */
      spanText: string;
    };

export type RouteWideOfficialReservationCalendarItem = {
  // Identity — all copied verbatim from the derivation and its exact matching record.
  recordId: string;
  placeId: string;
  scope: ReservationMechanismScope;

  // Plan context.
  placeName: string;
  /** 1-based ordinal, exactly the "Día N" the day card shows. */
  dayNumber: number;
  /** Stable opaque draft day id when the caller had it; null otherwise. Never invented. */
  dayId: string | null;
  visitDate: string;

  /** The chronological key: the release date, or the recorded span's open date. */
  anchorDate: string;
  fact: RouteWideOfficialReservationCalendarFact;
  /** The existing Phase 3F-F presentation, reused verbatim — never re-derived or re-worded. */
  presentation: OfficialReservationDatePresentation;
  /** The existing Phase 3F-H relation, composed fail-closed. Null when unassessable. */
  relation: OfficialReservationReferenceRelationPresentation | null;
};

export type RouteWideOfficialReservationCalendar = {
  /** Every item, each with a real civil date, ordered by the Phase 3F-I §8 contract. */
  chronological: readonly RouteWideOfficialReservationCalendarItem[];
  /** The single concrete reference date every relation above was evaluated from, or null. */
  referenceDate: string | null;
};

const EMPTY_CALENDAR: RouteWideOfficialReservationCalendar = {
  chronological: [],
  referenceDate: null,
};

/**
 * Sort keys kept OUTSIDE the public item on purpose. They exist only to make the comparator total;
 * exposing them would invite a consumer to read them as a rank.
 */
type OrderedEntry = {
  item: RouteWideOfficialReservationCalendarItem;
  /** Position of the place in the flattened plan: day ordinal, then position within that day. */
  planOrdinal: number;
  /** Index of the record in the bundled catalog — the stable source-record order. */
  recordSourceIndex: number;
};

/**
 * The chronological key plus the span text, or `null` when this derivation has no placeable civil
 * date and therefore produces no route-wide item at all.
 *
 * A span is eligible only when both edges are valid civil dates AND `openDate <= closeDate`. An
 * inverted span is refused outright rather than swapped, sorted or repaired: anchoring it at its
 * `openDate` would file it *after* its own recorded end, and inventing a direction would present an
 * official span the evidence never recorded. Phase 3F-D and Phase 3F-H both stay unchanged.
 */
function eligibleFact(
  derivation: ReservationMechanismDateDerivation
): { anchorDate: string; visitDate: string; fact: RouteWideOfficialReservationCalendarFact } | null {
  if (derivation.kind === "release-date") {
    if (!isValidCivilDate(derivation.releaseDate)) return null;
    return {
      anchorDate: derivation.releaseDate,
      visitDate: derivation.visitDate,
      fact: { kind: "release-date" },
    };
  }

  if (derivation.kind === "application-window") {
    if (!isValidCivilDate(derivation.openDate) || !isValidCivilDate(derivation.closeDate)) return null;
    if (derivation.openDate > derivation.closeDate) return null;
    return {
      anchorDate: derivation.openDate,
      visitDate: derivation.visitDate,
      fact: {
        kind: "application-date-span",
        openDate: derivation.openDate,
        closeDate: derivation.closeDate,
        spanText: formatOfficialReservationCalendarSpanForUi(derivation),
      },
    };
  }

  // `no-visit-date`, `inactive-evidence`, `not-applicable-to-visit-date` and `not-derivable` all
  // describe the ABSENCE of an applicable official calendar fact. They are omitted entirely here,
  // with no fallback, and remain visible in their own day card.
  return null;
}

/**
 * Builds the route-wide calendar for the current plan.
 *
 * `days[i]` must describe the same day bucket as `dayAssignment.days[i]`; the caller derives both
 * from one day matrix. A place that is not in its own index's bucket means the caller's two views
 * disagree, so that place is skipped rather than filed under a day it may not belong to.
 *
 * Visit dates and official dates are never computed here: `deriveReservationMechanismDatesForPlannedPlace`
 * (Phase 3F-D) remains the sole owner, and its results are consumed verbatim.
 */
export function buildRouteWideOfficialReservationCalendar(
  records: readonly ReservationMechanismEvidenceRecord[],
  days: readonly RouteWideOfficialReservationCalendarDay[],
  dayAssignment: DayAssignment,
  startDate: string | null,
  referenceDate: string | null
): RouteWideOfficialReservationCalendar {
  if (!dayAssignment.valid) return EMPTY_CALENDAR;
  if (startDate === null || !isValidCivilDate(startDate)) return EMPTY_CALENDAR;

  const entries: OrderedEntry[] = [];
  let planOrdinal = 0;

  days.forEach((day, dayIndex) => {
    const bucket = dayAssignment.days[dayIndex];
    day.places.forEach((place) => {
      // Ordinal advances for every planned place, so it stays the place's position in the flattened
      // plan whether or not that place happens to carry official evidence.
      const currentOrdinal = planOrdinal;
      planOrdinal += 1;
      if (!bucket || !bucket.placeIds.includes(place.id)) return;

      const derivations = deriveReservationMechanismDatesForPlannedPlace(
        records,
        dayAssignment,
        startDate,
        place.id
      );

      for (const derivation of derivations) {
        const eligible = eligibleFact(derivation);
        if (!eligible) continue;

        const recordSourceIndex = records.findIndex((candidate) => candidate.id === derivation.recordId);
        if (recordSourceIndex === -1) continue;
        const record = records[recordSourceIndex];

        // Fail-closed: a record/place/scope mismatch yields no presentation, so no row.
        const presentation = buildOfficialReservationDatePresentation(record, derivation);
        if (!presentation) continue;

        // Phase 3F-H's shipped evaluator and its fail-closed composition, reused unchanged. A
        // `not-assessed` result becomes a null relation and renders no line — never a placeholder.
        const relation = referenceDate
          ? evaluateOfficialReservationReferenceDate(derivation, referenceDate)
          : null;
        const relationPresentation = relation
          ? buildOfficialReservationReferenceRelationPresentation(presentation, relation)
          : null;

        entries.push({
          planOrdinal: currentOrdinal,
          recordSourceIndex,
          item: {
            recordId: derivation.recordId,
            placeId: derivation.placeId,
            scope: derivation.scope,
            placeName: place.name,
            dayNumber: dayIndex + 1,
            dayId: day.id,
            visitDate: eligible.visitDate,
            anchorDate: eligible.anchorDate,
            fact: eligible.fact,
            presentation,
            relation: relationPresentation,
          },
        });
      }
    });
  });

  // Total comparator: every key is compared explicitly, so the result never depends on the engine's
  // sort stability. Civil dates are fixed-width `YYYY-MM-DD`, so lexical order IS calendar order —
  // no Date object, instant or timezone is constructed anywhere in this ordering.
  entries.sort((a, b) => {
    if (a.item.anchorDate !== b.item.anchorDate) {
      return a.item.anchorDate < b.item.anchorDate ? -1 : 1;
    }
    if (a.planOrdinal !== b.planOrdinal) return a.planOrdinal - b.planOrdinal;
    return a.recordSourceIndex - b.recordSourceIndex;
  });

  const chronological = entries.map((entry) => entry.item);
  // The field means "the date every relation above was evaluated from". If nothing composed a
  // relation — no reference date, an unusable one, or nothing assessable — there is no such date,
  // and echoing the input anyway would let a consumer disclose a date that was never used.
  const usedReferenceDate = chronological.some((item) => item.relation !== null) ? referenceDate : null;
  return { chronological, referenceDate: usedReferenceDate };
}
