import type { MinuteRange } from "./duration";
import type { OrderedSequenceSummary } from "./ordered-sequence";

/** Phase 3D-Q — Manual Accommodation Commute Legs.
 *
 * Accommodation is deliberately NOT a tourism Place and manual accommodation legs are deliberately
 * NOT TransferEdges. The only evidence accepted here is an exact, directed, user-entered duration.
 * This module performs no geocoding, routing, nearest-place matching, reverse-edge inference, or
 * network access.
 */

export type AccommodationAnchor = {
  id: string;
  label: string;
  location: {
    lat: number;
    lng: number;
  };
};

export type AccommodationBoundaryChoice =
  | { kind: "unselected" }
  | { kind: "no-accommodation" }
  | { kind: "accommodation"; accommodationId: string };

export type DayAccommodationBoundary = {
  start: AccommodationBoundaryChoice;
  end: AccommodationBoundaryChoice;
};

export type ManualAccommodationLeg =
  | {
      direction: "accommodation-to-place";
      accommodationId: string;
      placeId: string;
      minutes: number;
      source: { kind: "user-entered" };
    }
  | {
      direction: "place-to-accommodation";
      placeId: string;
      accommodationId: string;
      minutes: number;
      source: { kind: "user-entered" };
    };

export type AccommodationBoundaryLegResult =
  | {
      kind: "not-applicable";
      side: "start" | "end";
      reason: "empty-day" | "explicit-no-accommodation";
    }
  | { kind: "boundary-unselected"; side: "start" | "end" }
  | {
      kind: "manual-leg-missing";
      side: "start" | "end";
      accommodationId: string;
      placeId: string;
    }
  | {
      kind: "manual-leg";
      side: "start" | "end";
      minutes: number;
      accommodationId: string;
      placeId: string;
    };

export type DayLogisticsWithAccommodation = {
  intraDay: OrderedSequenceSummary;
  outbound: AccommodationBoundaryLegResult;
  returnLeg: AccommodationBoundaryLegResult;
  /** Known transfer minutes only. Unknown/missing/not-applicable components add nothing — never 0.
   * Same `MinuteRange` shape `OrderedSequenceSummary.transferMinutes` already uses, summed
   * minimum-to-minimum and maximum-to-maximum exactly as that module sums its own legs. A manual
   * accommodation leg is a single exact integer, so it adds the same value to both bounds — it is
   * never widened into an invented ± range. */
  registeredTransferMinutes: MinuteRange | null;
  /** True only for a non-empty day with complete intra-day transfers and both manual boundary legs. */
  completeDoorToDoor: boolean;
};

export const UNSELECTED_ACCOMMODATION_BOUNDARY: DayAccommodationBoundary = {
  start: { kind: "unselected" },
  end: { kind: "unselected" },
};

export function isValidAccommodationLocation(location: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180
  );
}

export function isValidManualAccommodationMinutes(minutes: number): boolean {
  return Number.isSafeInteger(minutes) && minutes > 0;
}

export function manualAccommodationLegKey(
  leg: Pick<ManualAccommodationLeg, "direction" | "accommodationId" | "placeId">
): string {
  // NUL is not produced by the UI's ordinary ids, but length-prefixing avoids delimiter ambiguity
  // entirely and makes this key safe even if future user-authored ids contain punctuation.
  return `${leg.direction.length}:${leg.direction}${leg.accommodationId.length}:${leg.accommodationId}${leg.placeId.length}:${leg.placeId}`;
}

export function hasUniqueAccommodationIds(accommodations: readonly AccommodationAnchor[]): boolean {
  return new Set(accommodations.map((anchor) => anchor.id)).size === accommodations.length;
}

export function hasUniqueManualAccommodationLegKeys(legs: readonly ManualAccommodationLeg[]): boolean {
  const keys = legs.map(manualAccommodationLegKey);
  return new Set(keys).size === keys.length;
}

export function findManualAccommodationLeg(
  legs: readonly ManualAccommodationLeg[],
  direction: ManualAccommodationLeg["direction"],
  accommodationId: string,
  placeId: string
): ManualAccommodationLeg | null {
  return (
    legs.find(
      (leg) =>
        leg.direction === direction &&
        leg.accommodationId === accommodationId &&
        leg.placeId === placeId
    ) ?? null
  );
}

/** Replace or clear exactly one directed endpoint key. Invalid minutes are rejected as a no-op. */
export function withManualAccommodationLeg(
  legs: readonly ManualAccommodationLeg[],
  direction: ManualAccommodationLeg["direction"],
  accommodationId: string,
  placeId: string,
  minutes: number | null
): ManualAccommodationLeg[] {
  const key = manualAccommodationLegKey({ direction, accommodationId, placeId });
  const retained = legs.filter((leg) => manualAccommodationLegKey(leg) !== key);
  if (minutes === null) return retained.length === legs.length ? [...legs] : retained;
  if (!isValidManualAccommodationMinutes(minutes)) return [...legs];

  const replacement: ManualAccommodationLeg =
    direction === "accommodation-to-place"
      ? { direction, accommodationId, placeId, minutes, source: { kind: "user-entered" } }
      : { direction, placeId, accommodationId, minutes, source: { kind: "user-entered" } };
  return [...retained, replacement];
}

export function deriveAccommodationBoundaryLeg(
  dayPlaceIds: readonly string[],
  choice: AccommodationBoundaryChoice,
  side: "start" | "end",
  legs: readonly ManualAccommodationLeg[]
): AccommodationBoundaryLegResult {
  if (dayPlaceIds.length === 0) return { kind: "not-applicable", side, reason: "empty-day" };
  if (choice.kind === "unselected") return { kind: "boundary-unselected", side };
  if (choice.kind === "no-accommodation") {
    return { kind: "not-applicable", side, reason: "explicit-no-accommodation" };
  }

  const placeId = side === "start" ? dayPlaceIds[0] : dayPlaceIds[dayPlaceIds.length - 1];
  const direction: ManualAccommodationLeg["direction"] =
    side === "start" ? "accommodation-to-place" : "place-to-accommodation";
  const leg = findManualAccommodationLeg(legs, direction, choice.accommodationId, placeId);
  if (!leg) {
    return {
      kind: "manual-leg-missing",
      side,
      accommodationId: choice.accommodationId,
      placeId,
    };
  }
  return {
    kind: "manual-leg",
    side,
    minutes: leg.minutes,
    accommodationId: choice.accommodationId,
    placeId,
  };
}

export function buildDayLogisticsWithAccommodation(
  dayPlaceIds: readonly string[],
  intraDay: OrderedSequenceSummary,
  boundary: DayAccommodationBoundary,
  legs: readonly ManualAccommodationLeg[]
): DayLogisticsWithAccommodation {
  const outbound = deriveAccommodationBoundaryLeg(dayPlaceIds, boundary.start, "start", legs);
  const returnLeg = deriveAccommodationBoundaryLeg(dayPlaceIds, boundary.end, "end", legs);

  if (dayPlaceIds.length === 0) {
    return {
      intraDay,
      outbound,
      returnLeg,
      registeredTransferMinutes: null,
      completeDoorToDoor: false,
    };
  }

  // Only components that are actually KNOWN enter the sum. There is deliberately no zero-valued
  // placeholder anywhere in this arithmetic: an unknown intra-day leg, an unselected boundary, a
  // missing manual leg and an explicit `no-accommodation` side are simply absent from `known`, so
  // none of them can be mistaken for a real zero-minute transfer. When nothing is known the
  // subtotal is `null` rather than `{ minMinutes: 0, maxMinutes: 0 }`.
  const known: MinuteRange[] = [];
  if (intraDay.transferMinutes) known.push(intraDay.transferMinutes);
  // A manual leg is one exact integer, so it moves both bounds by the same amount — never widened
  // into an invented ± range.
  if (outbound.kind === "manual-leg") {
    known.push({ minMinutes: outbound.minutes, maxMinutes: outbound.minutes });
  }
  if (returnLeg.kind === "manual-leg") {
    known.push({ minMinutes: returnLeg.minutes, maxMinutes: returnLeg.minutes });
  }

  return {
    intraDay,
    outbound,
    returnLeg,
    registeredTransferMinutes: known.reduce<MinuteRange | null>(
      (total, range) =>
        total === null
          ? { ...range }
          : { minMinutes: total.minMinutes + range.minMinutes, maxMinutes: total.maxMinutes + range.maxMinutes },
      null
    ),
    completeDoorToDoor:
      intraDay.complete && outbound.kind === "manual-leg" && returnLeg.kind === "manual-leg",
  };
}
