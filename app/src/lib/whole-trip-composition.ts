import type { Place } from "../types";
import {
  deriveAccommodationBoundaryLeg,
  type AccommodationBoundaryLegResult,
  type DayAccommodationBoundary,
  type ManualAccommodationLeg,
} from "./accommodation-commute";
import { validateDayPartition } from "./day-assignment";
import type { MinuteRange } from "./duration";
import {
  assessInterHubSegment,
  type InterHubMode,
  type ManualInterHubSegment,
} from "./inter-hub-segment";
import { summarizeSelection } from "./selection";
import { buildTripBoundsSummary, type TripBounds, type TripBoundsSummary } from "./trip-bounds";
import { getBestTransfer, type TransferEdge } from "./transfer";

/** Phase 3E-A — derived composition of one exact user-authored day plan. */

export type WholeTripCompositionUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";

export type WholeTripCompositionDay = {
  placeIds: readonly string[];
  accommodationBoundary: DayAccommodationBoundary;
};

export type WholeTripVisitComposition = {
  quantifiedMinutes: MinuteRange | null;
  quantifiedPlaceCount: number;
  nonQuantifiedPlaceCount: number;
  dayScaleCommitmentCount: number;
  unclassifiedPlaceCount: number;
  completeNumericCoverage: boolean;
};

export type WholeTripMovementComponent =
  | {
      kind: "local-transfer";
      dayOrdinal: number;
      fromPlaceId: string;
      toPlaceId: string;
      transfer: TransferEdge;
    }
  | {
      kind: "local-transfer-missing";
      dayOrdinal: number;
      fromPlaceId: string;
      toPlaceId: string;
    }
  | {
      kind: "inter-hub";
      fromDayOrdinal: number;
      toDayOrdinal: number;
      fromPlaceId: string;
      toPlaceId: string;
      segmentId: string;
      minutes: number;
      mode: InterHubMode;
      placement: "same-day" | "between-consecutive-days";
    }
  | {
      kind: "inter-hub-missing";
      fromDayOrdinal: number;
      toDayOrdinal: number;
      fromPlaceId: string;
      toPlaceId: string;
      placement: "same-day" | "between-consecutive-days";
    };

export type WholeTripMovementComposition = {
  components: WholeTripMovementComponent[];
  registeredMinutes: MinuteRange | null;
  localKnownCount: number;
  localMissingCount: number;
  interHubActiveCount: number;
  interHubMissingCount: number;
  modeledAdjacencyCount: number;
  /** May be vacuously true at zero slots; presentation must also require a positive slot count. */
  adjacencyCoverageComplete: boolean;
};

export type WholeTripAccommodationComponent = {
  dayOrdinal: number;
  result: AccommodationBoundaryLegResult;
};

export type WholeTripAccommodationComposition = {
  components: WholeTripAccommodationComponent[];
  registeredMinutes: number | null;
  manualLegCount: number;
  manualLegMissingCount: number;
  boundaryUnselectedCount: number;
  explicitNoAccommodationCount: number;
  /** Counts the two side results independently, preserving the accommodation domain vocabulary. */
  emptyDayNotApplicableCount: number;
};

export type WholeTripInterHubComposition = {
  activeSegmentIds: string[];
  inactiveSegmentIds: string[];
  missingExpectedCount: number;
  registeredMinutes: number | null;
};

export type WholeTripBoundsComposition = {
  startDate: string | null;
  endDate: string | null;
  tripCalendarDays: number | null;
  dayCount: number;
  daysAfterTripEnd: number | null;
  unavailableReason: TripBoundsSummary["unavailableReason"];
};

export type WholeTripComposition =
  | { kind: "unavailable"; reason: WholeTripCompositionUnavailableReason }
  | {
      kind: "available";
      dayCount: number;
      visit: WholeTripVisitComposition;
      movement: WholeTripMovementComposition;
      accommodation: WholeTripAccommodationComposition;
      interHub: WholeTripInterHubComposition;
      bounds: WholeTripBoundsComposition;
      /** Movement plus exact manual accommodation minutes; never includes visit minutes. */
      registeredTransportMinutes: MinuteRange | null;
    };

export type WholeTripCompositionInput = {
  routeIds: readonly string[];
  days: readonly WholeTripCompositionDay[] | null;
  interHubSegments: readonly ManualInterHubSegment[];
  accommodationLegs: readonly ManualAccommodationLeg[];
  bounds: TripBounds;
};

export type WholeTripCompositionDependencies = {
  resolvePlace: (placeId: string) => Place | null;
  /** Defaults to the existing exact directed lookup; injectable fixtures never need the dataset. */
  lookupTransfer?: (fromPlaceId: string, toPlaceId: string) => TransferEdge | null;
};

function addRange(total: MinuteRange | null, range: MinuteRange): MinuteRange {
  return total === null
    ? { ...range }
    : {
        minMinutes: total.minMinutes + range.minMinutes,
        maxMinutes: total.maxMinutes + range.maxMinutes,
      };
}

function addExact(total: MinuteRange | null, minutes: number): MinuteRange {
  return addRange(total, { minMinutes: minutes, maxMinutes: minutes });
}

function pairKey(fromPlaceId: string, toPlaceId: string): string {
  return `${fromPlaceId.length}:${fromPlaceId}${toPlaceId.length}:${toPlaceId}`;
}

function buildVisit(places: Place[]): WholeTripVisitComposition {
  const summary = summarizeSelection(places);
  return {
    quantifiedMinutes: summary.visitTime,
    quantifiedPlaceCount: summary.quantifiedCount,
    nonQuantifiedPlaceCount: summary.nonQuantified.length,
    dayScaleCommitmentCount: summary.commitmentCount,
    unclassifiedPlaceCount: summary.withoutEstimate.length,
    completeNumericCoverage: summary.quantifiedCount === places.length,
  };
}

function buildAccommodation(
  days: readonly WholeTripCompositionDay[],
  legs: readonly ManualAccommodationLeg[]
): WholeTripAccommodationComposition {
  const components: WholeTripAccommodationComponent[] = [];
  let registeredMinutes = 0;
  let manualLegCount = 0;
  let manualLegMissingCount = 0;
  let boundaryUnselectedCount = 0;
  let explicitNoAccommodationCount = 0;
  let emptyDayNotApplicableCount = 0;

  days.forEach((day, dayOrdinal) => {
    for (const result of [
      deriveAccommodationBoundaryLeg(day.placeIds, day.accommodationBoundary.start, "start", legs),
      deriveAccommodationBoundaryLeg(day.placeIds, day.accommodationBoundary.end, "end", legs),
    ]) {
      components.push({ dayOrdinal, result });
      if (result.kind === "manual-leg") {
        registeredMinutes += result.minutes;
        manualLegCount += 1;
      } else if (result.kind === "manual-leg-missing") {
        manualLegMissingCount += 1;
      } else if (result.kind === "boundary-unselected") {
        boundaryUnselectedCount += 1;
      } else if (result.reason === "explicit-no-accommodation") {
        explicitNoAccommodationCount += 1;
      } else {
        emptyDayNotApplicableCount += 1;
      }
    }
  });

  return {
    components,
    registeredMinutes: manualLegCount > 0 ? registeredMinutes : null,
    manualLegCount,
    manualLegMissingCount,
    boundaryUnselectedCount,
    explicitNoAccommodationCount,
    emptyDayNotApplicableCount,
  };
}

function projectBounds(bounds: TripBounds, dayCount: number): WholeTripBoundsComposition {
  const summary = buildTripBoundsSummary(bounds, dayCount);
  return {
    startDate: summary.startDate,
    endDate: summary.endDate,
    tripCalendarDays: summary.tripCalendarDays,
    dayCount,
    daysAfterTripEnd: summary.daysAfterTripEnd,
    unavailableReason: summary.unavailableReason,
  };
}

/**
 * Composes recorded evidence for the current valid day plan. Bounds annotate but never filter: all
 * day buckets are classified before their independent bounds projection is attached.
 */
export function buildWholeTripComposition(
  input: WholeTripCompositionInput,
  dependencies: WholeTripCompositionDependencies
): WholeTripComposition {
  if (input.days === null) return { kind: "unavailable", reason: "no-day-assignment" };
  const dayMatrix = input.days.map((day) => day.placeIds);
  if (!validateDayPartition(input.routeIds, dayMatrix).valid) {
    return { kind: "unavailable", reason: "invalid-day-partition" };
  }

  const placesById = new Map<string, Place>();
  const routePlaces: Place[] = [];
  for (const placeId of input.routeIds) {
    const place = dependencies.resolvePlace(placeId);
    if (!place) return { kind: "unavailable", reason: "unresolved-route-place" };
    placesById.set(placeId, place);
    routePlaces.push(place);
  }

  const resolveHub = (placeId: string) => {
    const place = placesById.get(placeId);
    return place ? { hub: place.hub } : null;
  };
  const assessmentContext = { routeIds: input.routeIds, days: dayMatrix, resolvePlace: resolveHub };
  const activeByPair = new Map<
    string,
    {
      segment: ManualInterHubSegment;
      placement: "same-day" | "between-consecutive-days";
      fromDayOrdinal: number;
      toDayOrdinal: number;
    }
  >();

  for (const segment of input.interHubSegments) {
    const assessment = assessInterHubSegment(segment, assessmentContext);
    if (
      assessment.kind === "active" &&
      assessment.placement !== "route-only" &&
      assessment.fromDayOrdinal !== null &&
      assessment.toDayOrdinal !== null &&
      !activeByPair.has(pairKey(segment.fromPlaceId, segment.toPlaceId))
    ) {
      activeByPair.set(pairKey(segment.fromPlaceId, segment.toPlaceId), {
        segment,
        placement: assessment.placement,
        fromDayOrdinal: assessment.fromDayOrdinal,
        toDayOrdinal: assessment.toDayOrdinal,
      });
    }
  }

  const lookupTransfer = dependencies.lookupTransfer ?? getBestTransfer;
  const components: WholeTripMovementComponent[] = [];
  const countedSegmentIds = new Set<string>();
  let registeredMovementMinutes: MinuteRange | null = null;
  let localKnownCount = 0;
  let localMissingCount = 0;
  let interHubMissingCount = 0;

  function addInterHubSlot(
    fromPlaceId: string,
    toPlaceId: string,
    placement: "same-day" | "between-consecutive-days",
    fromDayOrdinal: number,
    toDayOrdinal: number
  ) {
    const active = activeByPair.get(pairKey(fromPlaceId, toPlaceId));
    if (
      active &&
      active.placement === placement &&
      active.fromDayOrdinal === fromDayOrdinal &&
      active.toDayOrdinal === toDayOrdinal &&
      !countedSegmentIds.has(active.segment.id)
    ) {
      components.push({
        kind: "inter-hub",
        fromDayOrdinal,
        toDayOrdinal,
        fromPlaceId,
        toPlaceId,
        segmentId: active.segment.id,
        minutes: active.segment.minutes,
        mode: active.segment.mode,
        placement,
      });
      countedSegmentIds.add(active.segment.id);
      registeredMovementMinutes = addExact(registeredMovementMinutes, active.segment.minutes);
      return;
    }
    components.push({
      kind: "inter-hub-missing",
      fromDayOrdinal,
      toDayOrdinal,
      fromPlaceId,
      toPlaceId,
      placement,
    });
    interHubMissingCount += 1;
  }

  input.days.forEach((day, dayOrdinal) => {
    for (let placeOrdinal = 0; placeOrdinal + 1 < day.placeIds.length; placeOrdinal += 1) {
      const fromPlaceId = day.placeIds[placeOrdinal];
      const toPlaceId = day.placeIds[placeOrdinal + 1];
      const fromPlace = placesById.get(fromPlaceId)!;
      const toPlace = placesById.get(toPlaceId)!;
      if (fromPlace.hub !== toPlace.hub) {
        addInterHubSlot(fromPlaceId, toPlaceId, "same-day", dayOrdinal, dayOrdinal);
        continue;
      }
      const transfer = lookupTransfer(fromPlaceId, toPlaceId);
      if (transfer) {
        components.push({ kind: "local-transfer", dayOrdinal, fromPlaceId, toPlaceId, transfer });
        registeredMovementMinutes = addRange(registeredMovementMinutes, transfer.minutes);
        localKnownCount += 1;
      } else {
        components.push({ kind: "local-transfer-missing", dayOrdinal, fromPlaceId, toPlaceId });
        localMissingCount += 1;
      }
    }

    const nextDay = input.days?.[dayOrdinal + 1];
    if (!nextDay || day.placeIds.length === 0 || nextDay.placeIds.length === 0) return;
    const fromPlaceId = day.placeIds[day.placeIds.length - 1];
    const toPlaceId = nextDay.placeIds[0];
    if (placesById.get(fromPlaceId)!.hub !== placesById.get(toPlaceId)!.hub) {
      addInterHubSlot(
        fromPlaceId,
        toPlaceId,
        "between-consecutive-days",
        dayOrdinal,
        dayOrdinal + 1
      );
    }
  });

  const activeSegmentIds = input.interHubSegments
    .filter((segment) => countedSegmentIds.has(segment.id))
    .map((segment) => segment.id);
  const inactiveSegmentIds = input.interHubSegments
    .filter((segment) => !countedSegmentIds.has(segment.id))
    .map((segment) => segment.id);
  const interHubRegisteredMinutes = input.interHubSegments.reduce<number | null>(
    (total, segment) =>
      countedSegmentIds.has(segment.id) ? (total ?? 0) + segment.minutes : total,
    null
  );
  const accommodation = buildAccommodation(input.days, input.accommodationLegs);
  const modeledAdjacencyCount = components.length;
  const movement: WholeTripMovementComposition = {
    components,
    registeredMinutes: registeredMovementMinutes,
    localKnownCount,
    localMissingCount,
    interHubActiveCount: activeSegmentIds.length,
    interHubMissingCount,
    modeledAdjacencyCount,
    adjacencyCoverageComplete: localMissingCount === 0 && interHubMissingCount === 0,
  };

  let registeredTransportMinutes = movement.registeredMinutes;
  if (accommodation.registeredMinutes !== null) {
    registeredTransportMinutes = addExact(registeredTransportMinutes, accommodation.registeredMinutes);
  }

  return {
    kind: "available",
    dayCount: input.days.length,
    visit: buildVisit(routePlaces),
    movement,
    accommodation,
    interHub: {
      activeSegmentIds,
      inactiveSegmentIds,
      missingExpectedCount: interHubMissingCount,
      registeredMinutes: interHubRegisteredMinutes,
    },
    bounds: projectBounds(input.bounds, input.days.length),
    registeredTransportMinutes,
  };
}
