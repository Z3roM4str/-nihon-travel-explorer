import type { Place } from "../types";
import { getCivilWeekday, type CivilWeekday } from "./civil-date";
import { assessWeekdayClosure, interpretClosureText, type WeekdayClosureAssessment } from "./temporal-availability";

/**
 * Phase 3D-B — the `Place[]`-aware layer over `temporal-availability.ts`, mirroring this
 * codebase's existing `transfer.ts` → `ordered-sequence.ts` → `day-assignment.ts` layering:
 * `temporal-availability.ts` knows closure text and dates only, never a `Place`; this module is
 * where a day bucket's actual places first meet that domain logic.
 *
 * `buildDayWeekdaySignal` is the one function `OrderedSequenceBuilder.tsx`'s day view calls. It
 * is pure and derives everything on read from its two inputs — a day's places and that day's
 * already-derived civil date (Phase 3C-E's `startDate` offset by the day index) — so there is
 * nothing here to persist and nothing that could drift from `nihon.manualPlanningDraft`.
 */

export type PlaceWeekdaySignal = {
  placeId: string;
  placeName: string;
  assessment: WeekdayClosureAssessment;
};

export type DayWeekdaySignal =
  | { assessed: false }
  | {
      assessed: true;
      weekday: CivilWeekday;
      /** Every place in the day bucket, in the same order given — never reordered, filtered, or
       * deduplicated by this module. */
      perPlace: readonly PlaceWeekdaySignal[];
      /** Count of `"possible-weekday-closure-match"` outcomes — never a claim that any of them
       * is actually closed. */
      matchCount: number;
      /** Count of `"not-evaluable"` outcomes — surfaced so a caller can be honest about the
       * limits of this signal rather than implying every place was checked with equal
       * confidence. */
      notEvaluableCount: number;
    };

/**
 * Builds the weekday-closure signal for one day bucket. `assessed: false` — meaning "render
 * nothing," never a guessed or zeroed-out result — whenever `dateIso` is `null` or not a valid
 * civil date (`getCivilWeekday` returns `null` for both). An empty `places` array still resolves
 * to `assessed: true` with an empty `perPlace`/zeroed counts, since the date itself is what
 * decides whether an assessment is meaningful, not whether there happen to be places yet.
 */
export function buildDayWeekdaySignal(places: readonly Place[], dateIso: string | null): DayWeekdaySignal {
  const weekday = dateIso === null ? null : getCivilWeekday(dateIso);
  if (weekday === null) return { assessed: false };

  const perPlace: PlaceWeekdaySignal[] = places.map((place) => ({
    placeId: place.id,
    placeName: place.name,
    assessment: assessWeekdayClosure(interpretClosureText(place.schedule.closures), dateIso),
  }));

  const matchCount = perPlace.filter((p) => p.assessment.outcome === "possible-weekday-closure-match").length;
  const notEvaluableCount = perPlace.filter((p) => p.assessment.outcome === "not-evaluable").length;

  return { assessed: true, weekday, perPlace, matchCount, notEvaluableCount };
}
