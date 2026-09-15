/**
 * Phase 3D-W — Trip Bounds Runtime: the planner's canonical runtime planning-draft schema.
 *
 * `ManualPlanningDraftV6` replaces `ManualPlanningDraftV5` as the single canonical runtime state,
 * stored under the SAME existing `nihon.manualPlanningDraft` key (`PLANNING_DRAFT_STORAGE_KEY`,
 * re-exported below). There is no second storage key, no side-car trip-bounds record, and no
 * parallel V5 state kept alongside this one: `planning-draft-v5.ts` stays in the codebase as the
 * V4 → V5 link of the historical migration chain AND as the shared implementation of everything V6
 * inherits unchanged, so a draft stored before this phase still loads exactly as it did.
 *
 * The one thing this phase adds is an UPPER CIVIL BOUND:
 *
 * ```ts
 * endDate: string | null;
 * ```
 *
 * `endDate` is the last civil calendar date the user considers part of the trip. `[startDate,
 * endDate]` is INCLUSIVE on both ends, so `endDate === startDate` is a valid one-day trip. It is a
 * civil date and nothing else — not a flight time, not a UTC instant, not a timezone, not a
 * check-out date, not a night count, not a booking. See `docs/TRIP_BOUNDS_DESIGN.md` §4.2.
 *
 * **The field is deliberately inert.** Nothing in this module reads `endDate` to decide anything:
 * every mutation below threads it through untouched, and all of its value is realized in the pure
 * derived layer (`trip-bounds.ts`) that annotates the UI and repairs nothing.
 *
 * **The load-bearing invariant (design §5):** the civil range and the day-bucket assignment are two
 * independent user decisions. Setting, changing or clearing either bound never creates, deletes,
 * truncates or reorders a day, never moves a place, never mints or reassigns a day id, never alters
 * an `accommodationBoundary`, an `AccommodationAnchor` or a `ManualAccommodationLeg`, and never
 * touches `routeIds` or `visitStartTimes`. Symmetrically, no day mutation ever writes to
 * `startDate` or `endDate`. That is enforced STRUCTURALLY here rather than by convention: every
 * inherited operation is applied to a `v5View` that does not contain `endDate` at all (so a V5
 * function provably cannot read or write it), and `endDate` is re-attached afterwards from the
 * caller's draft — see {@link liftFromV5}.
 *
 * `PlanningDayV5` is re-exported unchanged and KEEPS ITS NAME: no day-level field is added, and no
 * day entity stores a date, an ordinal or a bounds verdict. The day's ordinal is still exclusively
 * its position in the array, and the version bump is not about the day entity's shape.
 */

import {
  PLANNING_DRAFT_VERSION as PLANNING_DRAFT_VERSION_V5,
  freshDraft as freshDraftV5,
  parseStoredDraft as parseStoredDraftV5,
  reconcileDraft as reconcileDraftV5,
  resetRoute as resetRouteV5,
  withAccommodation as withAccommodationV5,
  withAccommodationLeg as withAccommodationLegV5,
  withDayAccommodationChoice as withDayAccommodationChoiceV5,
  withDayMoved as withDayMovedV5,
  withDays as withDaysV5,
  withInitialDays as withInitialDaysV5,
  withNewAccommodation as withNewAccommodationV5,
  withNewEmptyDay as withNewEmptyDayV5,
  withPlaceMovedBetweenDays as withPlaceMovedBetweenDaysV5,
  withPlaceMovedWithinDay as withPlaceMovedWithinDayV5,
  withRoute as withRouteV5,
  withStartDate as withStartDateV5,
  withVisitStartTime as withVisitStartTimeV5,
  withoutAccommodation as withoutAccommodationV5,
  withoutEmptyDay as withoutEmptyDayV5,
  type ManualPlanningDraftV5,
  type PlanningDayV5,
} from "./planning-draft-v5";
import { isValidCivilDate } from "./civil-date";
import { PLANNING_DRAFT_STORAGE_KEY, type DraftStorage } from "./planning-draft";
import type {
  AccommodationAnchor,
  AccommodationBoundaryChoice,
  ManualAccommodationLeg,
} from "./accommodation-commute";

export { PLANNING_DRAFT_STORAGE_KEY, type DraftStorage };
export {
  LEGACY_V4_DAY_ID_PREFIX,
  createAccommodationId,
  createDayId,
  dayMatrixFromPlanningDays,
  type PlanningDayV5,
} from "./planning-draft-v5";

export const PLANNING_DRAFT_VERSION = 6 as const;

/**
 * The canonical persisted draft. Structurally identical to `ManualPlanningDraftV5` plus exactly one
 * field. Nothing else was added, renamed, removed or reordered — no `tripLengthDays`, no persisted
 * `tripCalendarDays`, no persisted bounds assessment, no second day-order vector, and no per-day
 * date or ordinal (design §8.1, §16.2).
 */
export type ManualPlanningDraftV6 = {
  version: 6;
  routeIds: string[];
  days: PlanningDayV5[] | null;
  startDate: string | null;
  endDate: string | null;
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  accommodationLegs: ManualAccommodationLeg[];
};

/**
 * THE structural guarantee behind "no inherited operation can see, read, or write `endDate`".
 *
 * Every V6 mutation runs its inherited V5 implementation against this projection, which does not
 * carry `endDate` at any point. The bound is re-attached by {@link liftFromV5} from the ORIGINAL
 * draft afterwards, so its survival across `withRoute`, `resetRoute`, `reconcileDraft`, every day
 * mutation and every accommodation mutation is a property of the composition itself rather than
 * something each call site has to remember (design §5.2, §12).
 */
function v5View(draft: ManualPlanningDraftV6): ManualPlanningDraftV5 {
  return {
    version: PLANNING_DRAFT_VERSION_V5,
    routeIds: draft.routeIds,
    days: draft.days,
    startDate: draft.startDate,
    visitStartTimes: draft.visitStartTimes,
    accommodations: draft.accommodations,
    accommodationLegs: draft.accommodationLegs,
  };
}

/** Re-attaches `endDate` to a V5 result. The bound is passed in by the caller from the draft it
 *  started with; it is never read out of `base`, which structurally does not have it. */
function liftFromV5(base: ManualPlanningDraftV5, endDate: string | null): ManualPlanningDraftV6 {
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: base.routeIds,
    days: base.days,
    startDate: base.startDate,
    endDate,
    visitStartTimes: base.visitStartTimes,
    accommodations: base.accommodations,
    accommodationLegs: base.accommodationLegs,
  };
}

/**
 * Runs one inherited V5 operation over a V6 draft, preserving BOTH the V5 semantics and `endDate`.
 *
 * A V5 mutation signals "rejected, nothing applied" by returning its input by reference. That is
 * preserved faithfully here: when the operation returns the projection unchanged, the ORIGINAL V6
 * draft is returned by reference too, so a rejected write stays a true no-op rather than becoming a
 * fresh, equal-but-different object that would re-render and re-persist for nothing.
 */
function applyV5<Args extends unknown[]>(
  draft: ManualPlanningDraftV6,
  operation: (base: ManualPlanningDraftV5, ...args: Args) => ManualPlanningDraftV5,
  ...args: Args
): ManualPlanningDraftV6 {
  const base = v5View(draft);
  const next = operation(base, ...args);
  if (next === base) return draft;
  return liftFromV5(next, draft.endDate);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Migrates a shape-valid V5 draft to V6. ONE rule, and it invents nothing:
 *
 * ```ts
 * endDate: null
 * ```
 *
 * Every other field passes through by reference-equivalent copy, without reinterpretation:
 * `routeIds`, `days` (every id, every `placeIds` order and every `accommodationBoundary`
 * byte-for-byte), `startDate`, `visitStartTimes`, `accommodations` and `accommodationLegs`.
 * `days: null` stays `days: null`.
 *
 * **The migration may not invent an end date**, and the only way to guarantee that is for it to
 * have nothing to invent one from — which is why the literal `null` below is not a placeholder to
 * be improved later. Explicitly forbidden as a migration source (design §8.3): `days.length`,
 * `startDate + days.length - 1`, `startDate` itself, the last day's derived date, the last place,
 * the number of accommodations, any `visitStartTimes` key, today's date, and any dataset value.
 * A V5 draft did not contain this decision, so the only truthful migration is "not selected".
 */
export function migrateV5ToV6(draft: ManualPlanningDraftV5): ManualPlanningDraftV6 {
  return liftFromV5(draft, null);
}

/**
 * Parses V6 strictly, all-or-nothing. V1–V5 are delegated to the historical parser chain
 * (`parseStoredDraft` in `planning-draft-v5.ts`, which itself delegates V1–V4) and then migrated
 * once by {@link migrateV5ToV6}. The chain stays additive: no historical migration is rewritten.
 *
 * At `version: 6` the `endDate` key MUST be present and MUST be either `null` or a real civil date.
 * Absence is meaningful only at `version: 5`, where migration supplies `null`; at `version: 6` a
 * missing key is indistinguishable from corruption, which is exactly what the version field exists
 * to disambiguate. Rejection is whole-draft — the route, the days, the anchors and the legs are
 * never partially salvaged — and there is no repair of any kind: never coerced to `null`, never
 * normalized, never truncated to a date part, never re-derived, never defaulted.
 *
 * **`endDate < startDate` is deliberately NOT a parse invariant** (design §6.5). An inverted range
 * is a state the running application can legitimately produce mid-edit (moving a trip later means
 * setting a new start date that is temporarily past the stored end date). Making the order relation
 * a parse rule would turn that reachable transient state into whole-draft corruption on the next
 * reload, discarding the user's entire route, days, hotels and legs. Shape is a parse invariant;
 * the order relation is a derived assessment (`trip-bounds.ts`).
 */
export function parseStoredDraft(raw: unknown): ManualPlanningDraftV6 | null {
  if (!isPlainObject(raw)) return null;

  if (raw.version !== PLANNING_DRAFT_VERSION) {
    const older = parseStoredDraftV5(raw);
    return older ? migrateV5ToV6(older) : null;
  }

  if (!("endDate" in raw)) return null;
  const rawEndDate = raw.endDate;
  let endDate: string | null;
  if (rawEndDate === null) {
    endDate = null;
  } else if (typeof rawEndDate === "string" && isValidCivilDate(rawEndDate)) {
    // `isValidCivilDate` is the single gate, and it is strict about shape as well as calendar
    // reality: it rejects an empty string, a datetime, a timezone-suffixed value and an impossible
    // date alike, so none of those needs (or gets) a special case that could drift from it.
    endDate = rawEndDate;
  } else {
    return null;
  }

  // Everything V6 inherits unchanged is validated by the V5 parser, fed the same stored value under
  // its own version tag. `endDate` is not forwarded into it and is not something it knows about.
  const base = parseStoredDraftV5({
    version: PLANNING_DRAFT_VERSION_V5,
    routeIds: raw.routeIds,
    days: raw.days,
    startDate: raw.startDate,
    visitStartTimes: raw.visitStartTimes,
    accommodations: raw.accommodations,
    accommodationLegs: raw.accommodationLegs,
  });
  if (!base) return null;

  return liftFromV5(base, endDate);
}

export function freshDraft(savedIds: readonly string[]): ManualPlanningDraftV6 {
  return migrateV5ToV6(freshDraftV5(savedIds));
}

/**
 * Reconciles an already shape-valid stored draft against the CURRENT saved ids. The historical rule
 * decides route/days/times/legs exactly as before — a stale place is pruned from the route and from
 * every day that held it, and if the pruned partition no longer validates, `days` becomes `null`.
 *
 * `endDate` is untouched by every one of those outcomes (design §5.1 case 11 / §15 test 37): the
 * trip's civil extent is not a property of which places are still saved.
 */
export function reconcileDraft(
  stored: ManualPlanningDraftV6,
  savedIds: readonly string[]
): ManualPlanningDraftV6 {
  return liftFromV5(reconcileDraftV5(v5View(stored), savedIds), stored.endDate);
}

export function loadReconciledDraft(
  storage: DraftStorage,
  savedIds: readonly string[]
): ManualPlanningDraftV6 {
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

export function writeDraft(storage: DraftStorage, draft: ManualPlanningDraftV6): void {
  try {
    storage.setItem(PLANNING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — preserve in-memory state */
  }
}

/**
 * Sets, replaces or clears the trip's upper civil bound, and does NOTHING else.
 *
 * Three outcomes, and no fourth:
 *
 * - a real civil date → stored exactly as given, never normalized or reformatted;
 * - `null` → cleared;
 * - anything else → REJECTED, and the draft is returned unchanged by reference.
 *
 * Validation is per-field and never cross-field (design §6.1). In particular this setter does not
 * consult `startDate`: an `endDate` before the start date, and an `endDate` set while `startDate` is
 * still `null`, are both accepted and stored. Refusing them would require either discarding a fact
 * the user deliberately entered or silently repairing a neighbouring field, and this codebase's
 * mutation contracts forbid both. An inverted or unpaired range is surfaced honestly by
 * `assessTripBounds` instead (design §6.3, §6.5).
 *
 * By construction this only ever reassigns one scalar, so it is inert with respect to `days`, day
 * ids, `placeIds`, boundaries, legs, anchors, `routeIds`, `visitStartTimes` and `startDate` — there
 * is no code path here that could touch any of them.
 */
export function withEndDate(draft: ManualPlanningDraftV6, endDate: string | null): ManualPlanningDraftV6 {
  if (endDate !== null && !isValidCivilDate(endDate)) return draft;
  if (endDate === draft.endDate) return draft;
  return { ...draft, endDate };
}

/**
 * Sets, changes or clears the manual calendar anchor for Día 1, with the Phase 3C-E semantics
 * unchanged: an invalid string is rejected and the draft returned unchanged.
 *
 * Adapted to V6 only in the one respect this phase requires — the returned draft keeps `endDate`.
 * Changing or clearing `startDate` never clears, shifts or otherwise adjusts `endDate`, and never
 * touches `days`, day order or any id (design §5.2, §6.4).
 */
export function withStartDate(draft: ManualPlanningDraftV6, startDate: string | null): ManualPlanningDraftV6 {
  return applyV5(draft, withStartDateV5, startDate);
}

/**
 * Applies a new route, with the historical rule for `days` unchanged: a pure reorder of the same id
 * set retains the day assignment and every id and boundary with it; any composition change sets
 * `days: null`. Anchors always survive; legs are pruned only for places that left the route.
 *
 * BOTH bounds survive either outcome. The trip's civil extent is not a property of the route
 * (design §5.1 cases 10–11).
 */
export function withRoute(draft: ManualPlanningDraftV6, routeIds: readonly string[]): ManualPlanningDraftV6 {
  return applyV5(draft, withRouteV5, routeIds);
}

/** The compatibility bulk setter, unchanged: an element-for-element identical matrix preserves every
 *  entity, and any non-identical matrix is rejected outright. Both bounds survive. */
export function withDays(
  draft: ManualPlanningDraftV6,
  days: readonly (readonly string[])[]
): ManualPlanningDraftV6 {
  return applyV5(draft, withDaysV5, days);
}

/** Creates the FIRST day assignment for a draft that has none. Both bounds survive, and the new
 *  buckets are neither counted against nor fitted to the range. */
export function withInitialDays(
  draft: ManualPlanningDraftV6,
  days: readonly (readonly string[])[],
  idFactory: () => string
): ManualPlanningDraftV6 {
  return applyV5(draft, withInitialDaysV5, days, idFactory);
}

export function withVisitStartTime(
  draft: ManualPlanningDraftV6,
  placeId: string,
  time: string | null
): ManualPlanningDraftV6 {
  return applyV5(draft, withVisitStartTimeV5, placeId, time);
}

export function withPlaceMovedWithinDay(
  draft: ManualPlanningDraftV6,
  dayId: string,
  placeIndex: number,
  direction: -1 | 1
): ManualPlanningDraftV6 {
  return applyV5(draft, withPlaceMovedWithinDayV5, dayId, placeIndex, direction);
}

export function withPlaceMovedBetweenDays(
  draft: ManualPlanningDraftV6,
  fromDayId: string,
  toDayId: string,
  placeIndex: number
): ManualPlanningDraftV6 {
  return applyV5(draft, withPlaceMovedBetweenDaysV5, fromDayId, toDayId, placeIndex);
}

/**
 * Appends ONE new empty day, unchanged from Phase 3D-S. Neither bound moves to accommodate it: the
 * new bucket may land after `endDate`, and that is a reportable derived outcome, never a rejection
 * and never a reason to extend the range (design §5.1 case 6).
 */
export function withNewEmptyDay(
  draft: ManualPlanningDraftV6,
  idFactory: () => string
): ManualPlanningDraftV6 {
  return applyV5(draft, withNewEmptyDayV5, idFactory);
}

/** Deletes ONE empty day entity, unchanged from Phase 3D-S — including its refusal to delete the
 *  last remaining day. The range is NOT shortened to follow (design §5.1 case 7). */
export function withoutEmptyDay(draft: ManualPlanningDraftV6, dayId: string): ManualPlanningDraftV6 {
  return applyV5(draft, withoutEmptyDayV5, dayId);
}

/**
 * Moves ONE whole day entity one ordinal position, unchanged from Phase 3D-U: the id, the
 * `placeIds` and their internal order, and the `accommodationBoundary` travel together byte-for-byte.
 *
 * Neither bound changes. What DOES change is derived and only derived: the two swapped entities now
 * sit at different ordinals, so each recomputes its own date and its own bounds assessment from its
 * NEW position — a day can move into or out of the range while remaining, in every persisted
 * respect, exactly the same day (design §5.1 case 8, §15 test 42).
 */
export function withDayMoved(
  draft: ManualPlanningDraftV6,
  dayId: string,
  direction: -1 | 1
): ManualPlanningDraftV6 {
  return applyV5(draft, withDayMovedV5, dayId, direction);
}

export function withAccommodation(
  draft: ManualPlanningDraftV6,
  anchor: AccommodationAnchor
): ManualPlanningDraftV6 {
  return applyV5(draft, withAccommodationV5, anchor);
}

export function withNewAccommodation(
  draft: ManualPlanningDraftV6,
  label: string,
  location: { lat: number; lng: number },
  idFactory: () => string
): ManualPlanningDraftV6 {
  return applyV5(draft, withNewAccommodationV5, label, location, idFactory);
}

export function withoutAccommodation(
  draft: ManualPlanningDraftV6,
  accommodationId: string
): ManualPlanningDraftV6 {
  return applyV5(draft, withoutAccommodationV5, accommodationId);
}

export function withDayAccommodationChoice(
  draft: ManualPlanningDraftV6,
  dayId: string,
  side: "start" | "end",
  choice: AccommodationBoundaryChoice
): ManualPlanningDraftV6 {
  return applyV5(draft, withDayAccommodationChoiceV5, dayId, side, choice);
}

export function withAccommodationLeg(
  draft: ManualPlanningDraftV6,
  direction: ManualAccommodationLeg["direction"],
  accommodationId: string,
  placeId: string,
  minutes: number | null
): ManualPlanningDraftV6 {
  return applyV5(draft, withAccommodationLegV5, direction, accommodationId, placeId, minutes);
}

/**
 * "Restablecer recorrido": the route becomes the current saved ids and the day assignment is
 * cleared, with anchors and endpoint-keyed legs carried forward exactly as before.
 *
 * BOTH bounds survive, matching `resetRoute`'s existing explicit preservation of `startDate`:
 * resetting the route is not a statement about when the trip starts or ends (design §5.1 case 11).
 */
export function resetRoute(
  draft: ManualPlanningDraftV6,
  savedIds: readonly string[]
): ManualPlanningDraftV6 {
  return applyV5(draft, resetRouteV5, savedIds);
}
