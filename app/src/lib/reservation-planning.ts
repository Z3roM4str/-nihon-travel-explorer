import type { Place } from "../types";
import { interpretPlaceReservation, type ReservationFact } from "./reservation";
import { interpretPlaceLeadTime, type ReservationLeadTimeFact } from "./reservation-lead-time";

/**
 * Phase 3D-D — route-level reservation preparation summary.
 *
 * A small, pure aggregation over an explicit, user-ordered list of places (the current canonical
 * route, Phase 3C-A), composing two independent axes — Phase 3D-C's `ReservationFact` and this
 * phase's `ReservationLeadTimeFact` — without merging or overriding either. Lead-time never
 * changes what `reservation.ts` says about necessity; reservation necessity never changes the
 * lead-time tier. See `reservation-lead-time.ts`'s own doc for what a lead-time fact may and may
 * not claim.
 *
 * `not-applicable` lead-time places are omitted here — there is no lead-time preparation signal
 * to surface for them — but that is a fact about *this specific summary*, not a statement that
 * the place needs no reservation at all; `ReservationFact` (still computed and carried on every
 * included item) remains the only source of truth for that.
 */

export type ReservationPreparationItem = {
  placeId: string;
  placeName: string;
  reservation: ReservationFact;
  leadTime: ReservationLeadTimeFact;
};

export type ReservationPreparationSummary = {
  /** Count of items whose lead time is a `coarse-magnitude` fact. */
  coarseMagnitudeCount: number;
  /** Count of items whose lead time is a `specific-mechanism` fact needing manual review. */
  specificMechanismCount: number;
  /**
   * Exactly the input places' order, minus the omitted `not-applicable` ones — never resorted by
   * magnitude, reservation category, urgency, or any other derived quantity. Reordering the input
   * route changes this order; it never changes what any individual item says.
   */
  items: ReservationPreparationItem[];
};

/**
 * Builds the preparation summary for `places` in exactly the order given. A place is included
 * only when it has an applicable lead-time signal (`bare-magnitude` or
 * `opaque-entity-or-mechanism-specific`); a `not-applicable` lead time omits the place from
 * `items` entirely, per this phase's product boundary — see the module doc above.
 */
export function buildReservationPreparationSummary(places: readonly Place[]): ReservationPreparationSummary {
  const items: ReservationPreparationItem[] = [];
  let coarseMagnitudeCount = 0;
  let specificMechanismCount = 0;

  for (const place of places) {
    const leadTime = interpretPlaceLeadTime(place);
    if (leadTime.kind === "not-applicable") continue;

    items.push({
      placeId: place.id,
      placeName: place.name,
      reservation: interpretPlaceReservation(place),
      leadTime,
    });
    if (leadTime.kind === "coarse-magnitude") coarseMagnitudeCount += 1;
    if (leadTime.kind === "specific-mechanism") specificMechanismCount += 1;
  }

  return { coarseMagnitudeCount, specificMechanismCount, items };
}
