import type { Place } from "../types";
import { addCivilDays, isValidCivilDate } from "./civil-date";
import type { DayAssignment } from "./day-assignment";
import { interpretPlaceHours, type HoursTier, type RecordedHoursFact } from "./recorded-hours";
import {
  assessWeekdayClosure,
  interpretClosureText,
  type ClosureFact,
  type TemporalTier,
  type WeekdayClosureAssessment,
} from "./temporal-availability";

/** Phase 3D-J's closed presentation vocabulary. It describes how two recorded facts may be
 * displayed; it does not make a claim about a visit or the place's real-world state. */
export type CompositionClass =
  | "jointly-presentable"
  | "present-with-caveat"
  | "keep-separate"
  | "not-composable";

export type HoursClosureComposition =
  | { kind: "no-visit-date" }
  | {
      kind: "composed";
      compositionClass: CompositionClass;
      visitDate: string;
      hours: RecordedHoursFact;
      closure: ClosureFact;
      weekdayAssessment: WeekdayClosureAssessment;
    };

export type PlaceHoursClosureComposition = {
  placeId: string;
  placeName: string;
  signal: HoursClosureComposition;
};

/** Lower is stronger. This ordering is intentionally shared by both axes. */
export const COMPOSITION_TIER_RANK: Readonly<Record<HoursTier | TemporalTier, number>> = {
  safe: 0,
  partial: 1,
  opaque: 2,
  unknown: 3,
};

/** Selects the presentation class solely from the two facts' tiers. */
export function classifyHoursClosureComposition(
  hoursTier: HoursTier,
  closureTier: TemporalTier
): CompositionClass {
  const weakestTierRank = Math.max(COMPOSITION_TIER_RANK[hoursTier], COMPOSITION_TIER_RANK[closureTier]);
  if (weakestTierRank === COMPOSITION_TIER_RANK.safe) return "jointly-presentable";
  if (weakestTierRank === COMPOSITION_TIER_RANK.partial) return "present-with-caveat";
  if (weakestTierRank === COMPOSITION_TIER_RANK.opaque) return "keep-separate";
  return "not-composable";
}

/** Combines already-classified evidence without reinterpreting either classifier's `kind`. */
export function composeRecordedHoursAndClosure(
  hours: RecordedHoursFact,
  closure: ClosureFact,
  visitDate: string
): Extract<HoursClosureComposition, { kind: "composed" }> {
  return {
    kind: "composed",
    compositionClass: classifyHoursClosureComposition(hours.tier, closure.tier),
    visitDate,
    hours,
    closure,
    weekdayAssessment: assessWeekdayClosure(closure, visitDate),
  };
}

/**
 * Resolves the date prerequisite for this signal only. All six guards are conjunctive: the
 * partition must be globally valid, its place must occur in exactly one bucket, and both the
 * anchor and derived civil date must validate. There is deliberately no partial fallback.
 */
export function deriveHoursClosureVisitDate(
  dayAssignment: DayAssignment,
  startDate: string | null | undefined,
  placeId: string
): string | null {
  if (!dayAssignment.valid || !startDate || !isValidCivilDate(startDate)) return null;

  const containingDayIndexes: number[] = [];
  dayAssignment.days.forEach((day, dayIndex) => {
    if (day.placeIds.includes(placeId)) containingDayIndexes.push(dayIndex);
  });
  if (containingDayIndexes.length !== 1) return null;

  const visitDate = addCivilDays(startDate, containingDayIndexes[0]);
  if (visitDate === null || !isValidCivilDate(visitDate)) return null;
  return visitDate;
}

/** Derives one place's non-persisted signal from current route/day state and existing facts. */
export function derivePlaceHoursClosureComposition(
  place: Place,
  dayAssignment: DayAssignment,
  startDate: string | null | undefined
): PlaceHoursClosureComposition {
  const visitDate = deriveHoursClosureVisitDate(dayAssignment, startDate, place.id);
  if (visitDate === null) {
    return { placeId: place.id, placeName: place.name, signal: { kind: "no-visit-date" } };
  }

  const hours = interpretPlaceHours(place);
  const closure = interpretClosureText(place.schedule.closures);
  return {
    placeId: place.id,
    placeName: place.name,
    signal: composeRecordedHoursAndClosure(hours, closure, visitDate),
  };
}

/** Pure day-card boundary: recomputing with new route/day input cannot retain stale state. */
export function buildDayHoursClosureCompositions(
  places: readonly Place[],
  dayAssignment: DayAssignment,
  startDate: string | null | undefined
): PlaceHoursClosureComposition[] {
  return places.map((place) => derivePlaceHoursClosureComposition(place, dayAssignment, startDate));
}
