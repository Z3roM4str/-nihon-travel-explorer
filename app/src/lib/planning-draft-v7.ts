/**
 * Phase 3D-Y — Manual Inter-Hub Segment Runtime.
 *
 * V7 adds exactly one persisted field to V6: `interHubSegments`. All inherited operations run
 * through a V6 projection that cannot see that field, after which the original segment array is
 * reattached. Route composition changes are the sole exception: they prune only segments whose
 * positional anchor place was actually removed. Reorders, day edits, bounds, accommodations and
 * visit-time edits preserve every stored segment and merely change derived applicability.
 */
import {
  PLANNING_DRAFT_VERSION as PLANNING_DRAFT_VERSION_V6,
  freshDraft as freshDraftV6,
  parseStoredDraft as parseStoredDraftV6,
  reconcileDraft as reconcileDraftV6,
  resetRoute as resetRouteV6,
  withAccommodation as withAccommodationV6,
  withAccommodationLeg as withAccommodationLegV6,
  withDayAccommodationChoice as withDayAccommodationChoiceV6,
  withDayMoved as withDayMovedV6,
  withDays as withDaysV6,
  withEndDate as withEndDateV6,
  withInitialDays as withInitialDaysV6,
  withNewAccommodation as withNewAccommodationV6,
  withNewEmptyDay as withNewEmptyDayV6,
  withPlaceMovedBetweenDays as withPlaceMovedBetweenDaysV6,
  withPlaceMovedWithinDay as withPlaceMovedWithinDayV6,
  withRoute as withRouteV6,
  withStartDate as withStartDateV6,
  withVisitStartTime as withVisitStartTimeV6,
  withoutAccommodation as withoutAccommodationV6,
  withoutEmptyDay as withoutEmptyDayV6,
  type ManualPlanningDraftV6,
  type PlanningDayV5,
} from "./planning-draft-v6";
import { PLANNING_DRAFT_STORAGE_KEY, type DraftStorage } from "./planning-draft";
import type {
  AccommodationAnchor,
  AccommodationBoundaryChoice,
  ManualAccommodationLeg,
} from "./accommodation-commute";
import {
  createManualInterHubSegment,
  isInterHubMode,
  isValidInterHubMinutes,
  parseManualInterHubSegments,
  pruneInterHubSegments,
  type InterHubMode,
  type ManualInterHubSegment,
  type NewManualInterHubSegment,
} from "./inter-hub-segment";

export { PLANNING_DRAFT_STORAGE_KEY, type DraftStorage };
export {
  LEGACY_V4_DAY_ID_PREFIX,
  createAccommodationId,
  createDayId,
  dayMatrixFromPlanningDays,
  type PlanningDayV5,
} from "./planning-draft-v6";

export const PLANNING_DRAFT_VERSION = 7 as const;

export type ManualPlanningDraftV7 = {
  version: 7;
  routeIds: string[];
  days: PlanningDayV5[] | null;
  startDate: string | null;
  endDate: string | null;
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  accommodationLegs: ManualAccommodationLeg[];
  interHubSegments: ManualInterHubSegment[];
};

function v6View(draft: ManualPlanningDraftV7): ManualPlanningDraftV6 {
  return {
    version: PLANNING_DRAFT_VERSION_V6,
    routeIds: draft.routeIds,
    days: draft.days,
    startDate: draft.startDate,
    endDate: draft.endDate,
    visitStartTimes: draft.visitStartTimes,
    accommodations: draft.accommodations,
    accommodationLegs: draft.accommodationLegs,
  };
}

function liftFromV6(
  base: ManualPlanningDraftV6,
  interHubSegments: ManualInterHubSegment[]
): ManualPlanningDraftV7 {
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: base.routeIds,
    days: base.days,
    startDate: base.startDate,
    endDate: base.endDate,
    visitStartTimes: base.visitStartTimes,
    accommodations: base.accommodations,
    accommodationLegs: base.accommodationLegs,
    interHubSegments,
  };
}

function applyV6<Args extends unknown[]>(
  draft: ManualPlanningDraftV7,
  operation: (base: ManualPlanningDraftV6, ...args: Args) => ManualPlanningDraftV6,
  ...args: Args
): ManualPlanningDraftV7 {
  const base = v6View(draft);
  const next = operation(base, ...args);
  if (next === base) return draft;
  return liftFromV6(next, draft.interHubSegments);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** V6 contained no segment decision, so migration adds an empty list and invents nothing. */
export function migrateV6ToV7(draft: ManualPlanningDraftV6): ManualPlanningDraftV7 {
  return liftFromV6(draft, []);
}

export function parseStoredDraft(raw: unknown): ManualPlanningDraftV7 | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== PLANNING_DRAFT_VERSION) {
    const older = parseStoredDraftV6(raw);
    return older ? migrateV6ToV7(older) : null;
  }

  const interHubSegments = parseManualInterHubSegments(raw.interHubSegments);
  if (interHubSegments === null) return null;
  const base = parseStoredDraftV6({
    version: PLANNING_DRAFT_VERSION_V6,
    routeIds: raw.routeIds,
    days: raw.days,
    startDate: raw.startDate,
    endDate: raw.endDate,
    visitStartTimes: raw.visitStartTimes,
    accommodations: raw.accommodations,
    accommodationLegs: raw.accommodationLegs,
  });
  return base ? liftFromV6(base, interHubSegments) : null;
}

export function freshDraft(savedIds: readonly string[]): ManualPlanningDraftV7 {
  return migrateV6ToV7(freshDraftV6(savedIds));
}

export function reconcileDraft(
  stored: ManualPlanningDraftV7,
  savedIds: readonly string[]
): ManualPlanningDraftV7 {
  const base = reconcileDraftV6(v6View(stored), savedIds);
  return liftFromV6(base, pruneInterHubSegments(stored.interHubSegments, base.routeIds));
}

export function loadReconciledDraft(
  storage: DraftStorage,
  savedIds: readonly string[]
): ManualPlanningDraftV7 {
  let raw: string | null;
  try {
    raw = storage.getItem(PLANNING_DRAFT_STORAGE_KEY);
  } catch {
    return freshDraft(savedIds);
  }
  if (!raw) return freshDraft(savedIds);
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return freshDraft(savedIds);
  }
  const stored = parseStoredDraft(decoded);
  return stored ? reconcileDraft(stored, savedIds) : freshDraft(savedIds);
}

export function writeDraft(storage: DraftStorage, draft: ManualPlanningDraftV7): void {
  try {
    storage.setItem(PLANNING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — preserve in-memory state */
  }
}

export function withRoute(
  draft: ManualPlanningDraftV7,
  routeIds: readonly string[]
): ManualPlanningDraftV7 {
  const base = withRouteV6(v6View(draft), routeIds);
  return liftFromV6(base, pruneInterHubSegments(draft.interHubSegments, base.routeIds));
}

export function resetRoute(
  draft: ManualPlanningDraftV7,
  savedIds: readonly string[]
): ManualPlanningDraftV7 {
  const base = resetRouteV6(v6View(draft), savedIds);
  return liftFromV6(base, pruneInterHubSegments(draft.interHubSegments, base.routeIds));
}

export function withNewInterHubSegment(
  draft: ManualPlanningDraftV7,
  input: NewManualInterHubSegment,
  idFactory: () => string
): ManualPlanningDraftV7 {
  if (!draft.routeIds.includes(input.fromPlaceId) || !draft.routeIds.includes(input.toPlaceId)) return draft;
  const segment = createManualInterHubSegment(draft.interHubSegments, input, idFactory);
  if (!segment) return draft;
  return { ...draft, interHubSegments: [...draft.interHubSegments, segment] };
}

/** Anchors and hub snapshots are immutable in-place; only these two explicit fields may change. */
export function withInterHubSegmentDetails(
  draft: ManualPlanningDraftV7,
  segmentId: string,
  mode: InterHubMode,
  minutes: number
): ManualPlanningDraftV7 {
  if (!isInterHubMode(mode) || !isValidInterHubMinutes(minutes)) return draft;
  const index = draft.interHubSegments.findIndex((segment) => segment.id === segmentId);
  if (index === -1) return draft;
  const current = draft.interHubSegments[index];
  if (current.mode === mode && current.minutes === minutes) return draft;
  const interHubSegments = [...draft.interHubSegments];
  interHubSegments[index] = { ...current, mode, minutes };
  return { ...draft, interHubSegments };
}

export function withoutInterHubSegment(
  draft: ManualPlanningDraftV7,
  segmentId: string
): ManualPlanningDraftV7 {
  if (!draft.interHubSegments.some((segment) => segment.id === segmentId)) return draft;
  return {
    ...draft,
    interHubSegments: draft.interHubSegments.filter((segment) => segment.id !== segmentId),
  };
}

export function withEndDate(draft: ManualPlanningDraftV7, endDate: string | null): ManualPlanningDraftV7 {
  return applyV6(draft, withEndDateV6, endDate);
}

export function withStartDate(draft: ManualPlanningDraftV7, startDate: string | null): ManualPlanningDraftV7 {
  return applyV6(draft, withStartDateV6, startDate);
}

export function withDays(
  draft: ManualPlanningDraftV7,
  days: readonly (readonly string[])[]
): ManualPlanningDraftV7 {
  return applyV6(draft, withDaysV6, days);
}

export function withInitialDays(
  draft: ManualPlanningDraftV7,
  days: readonly (readonly string[])[],
  idFactory: () => string
): ManualPlanningDraftV7 {
  return applyV6(draft, withInitialDaysV6, days, idFactory);
}

export function withVisitStartTime(
  draft: ManualPlanningDraftV7,
  placeId: string,
  time: string | null
): ManualPlanningDraftV7 {
  return applyV6(draft, withVisitStartTimeV6, placeId, time);
}

export function withPlaceMovedWithinDay(
  draft: ManualPlanningDraftV7,
  dayId: string,
  placeIndex: number,
  direction: -1 | 1
): ManualPlanningDraftV7 {
  return applyV6(draft, withPlaceMovedWithinDayV6, dayId, placeIndex, direction);
}

/**
 * Phase 3E-E: moves exactly one place to one final-coordinate position inside an identified day.
 * This is one synchronous pure mutation: no intermediate order exists or can be persisted.
 */
export function withPlaceRelocatedWithinDay(
  draft: ManualPlanningDraftV7,
  dayId: string,
  fromIndex: number,
  toIndex: number
): ManualPlanningDraftV7 {
  if (
    draft.days === null ||
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex === toIndex
  ) {
    return draft;
  }
  const dayIndex = draft.days.findIndex((day) => day.id === dayId);
  if (dayIndex === -1) return draft;
  const day = draft.days[dayIndex];
  if (fromIndex >= day.placeIds.length || toIndex >= day.placeIds.length) return draft;

  const placeIds = [...day.placeIds];
  const [movedPlaceId] = placeIds.splice(fromIndex, 1);
  placeIds.splice(toIndex, 0, movedPlaceId);
  const days = [...draft.days];
  days[dayIndex] = { ...day, placeIds };
  return { ...draft, days };
}

/**
 * Phase 3E-G: exchanges exactly two places inside one identified day.
 *
 * A direct transposition, not a remove-and-insert: every other place keeps its exact index, so no
 * intervening place shifts. One call produces the final order — there is deliberately no
 * intermediate draft, because two persisted moves would be two undoable states and would let a
 * reload observe an order the user never chose.
 *
 * The day's id and accommodation boundary, every other day, `routeIds`, the dates,
 * `visitStartTimes`, the accommodations, the manual accommodation legs and every stored
 * inter-hub segment object all travel through untouched, and the draft stays V7.
 */
export function withPlacesTransposedWithinDay(
  draft: ManualPlanningDraftV7,
  dayId: string,
  leftIndex: number,
  rightIndex: number
): ManualPlanningDraftV7 {
  if (
    draft.days === null ||
    !Number.isInteger(leftIndex) ||
    !Number.isInteger(rightIndex) ||
    leftIndex < 0 ||
    rightIndex < 0 ||
    leftIndex === rightIndex
  ) {
    return draft;
  }
  const dayIndex = draft.days.findIndex((day) => day.id === dayId);
  if (dayIndex === -1) return draft;
  const day = draft.days[dayIndex];
  if (leftIndex >= day.placeIds.length || rightIndex >= day.placeIds.length) return draft;

  const placeIds = [...day.placeIds];
  [placeIds[leftIndex], placeIds[rightIndex]] = [placeIds[rightIndex], placeIds[leftIndex]];
  const days = [...draft.days];
  days[dayIndex] = { ...day, placeIds };
  return { ...draft, days };
}

/**
 * Phase 3E-I: reverses exactly four consecutive places inside one identified day.
 *
 * Two direct end-for-end exchanges, not a splice: nothing is removed and re-inserted, so no place
 * outside the four-place window can shift. One call produces the final order — there is
 * deliberately no intermediate draft, because four sequential moves would be four undoable states
 * and would let a reload observe an order the user never chose.
 *
 * The day's id and accommodation boundary, every other day, `routeIds`, the dates,
 * `visitStartTimes`, the accommodations, the manual accommodation legs and every stored
 * inter-hub segment object all travel through untouched, and the draft stays V7.
 */
export function withFourPlacesReversedWithinDay(
  draft: ManualPlanningDraftV7,
  dayId: string,
  windowStartIndex: number
): ManualPlanningDraftV7 {
  if (draft.days === null || !Number.isInteger(windowStartIndex) || windowStartIndex < 0) {
    return draft;
  }
  const dayIndex = draft.days.findIndex((day) => day.id === dayId);
  if (dayIndex === -1) return draft;
  const day = draft.days[dayIndex];
  const windowEndIndex = windowStartIndex + 3;
  if (windowEndIndex >= day.placeIds.length) return draft;

  const placeIds = [...day.placeIds];
  [placeIds[windowStartIndex], placeIds[windowEndIndex]] = [
    placeIds[windowEndIndex],
    placeIds[windowStartIndex],
  ];
  [placeIds[windowStartIndex + 1], placeIds[windowEndIndex - 1]] = [
    placeIds[windowEndIndex - 1],
    placeIds[windowStartIndex + 1],
  ];
  const days = [...draft.days];
  days[dayIndex] = { ...day, placeIds };
  return { ...draft, days };
}

export function withPlaceMovedBetweenDays(
  draft: ManualPlanningDraftV7,
  fromDayId: string,
  toDayId: string,
  placeIndex: number
): ManualPlanningDraftV7 {
  return applyV6(draft, withPlaceMovedBetweenDaysV6, fromDayId, toDayId, placeIndex);
}

export function withNewEmptyDay(
  draft: ManualPlanningDraftV7,
  idFactory: () => string
): ManualPlanningDraftV7 {
  return applyV6(draft, withNewEmptyDayV6, idFactory);
}

export function withoutEmptyDay(draft: ManualPlanningDraftV7, dayId: string): ManualPlanningDraftV7 {
  return applyV6(draft, withoutEmptyDayV6, dayId);
}

export function withDayMoved(
  draft: ManualPlanningDraftV7,
  dayId: string,
  direction: -1 | 1
): ManualPlanningDraftV7 {
  return applyV6(draft, withDayMovedV6, dayId, direction);
}

export function withAccommodation(
  draft: ManualPlanningDraftV7,
  anchor: AccommodationAnchor
): ManualPlanningDraftV7 {
  return applyV6(draft, withAccommodationV6, anchor);
}

export function withNewAccommodation(
  draft: ManualPlanningDraftV7,
  label: string,
  location: { lat: number; lng: number },
  idFactory: () => string
): ManualPlanningDraftV7 {
  return applyV6(draft, withNewAccommodationV6, label, location, idFactory);
}

export function withoutAccommodation(
  draft: ManualPlanningDraftV7,
  accommodationId: string
): ManualPlanningDraftV7 {
  return applyV6(draft, withoutAccommodationV6, accommodationId);
}

export function withDayAccommodationChoice(
  draft: ManualPlanningDraftV7,
  dayId: string,
  side: "start" | "end",
  choice: AccommodationBoundaryChoice
): ManualPlanningDraftV7 {
  return applyV6(draft, withDayAccommodationChoiceV6, dayId, side, choice);
}

export function withAccommodationLeg(
  draft: ManualPlanningDraftV7,
  direction: ManualAccommodationLeg["direction"],
  accommodationId: string,
  placeId: string,
  minutes: number | null
): ManualPlanningDraftV7 {
  return applyV6(draft, withAccommodationLegV6, direction, accommodationId, placeId, minutes);
}
