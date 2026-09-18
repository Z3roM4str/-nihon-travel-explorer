/**
 * Block 4 — Zone-seeded accommodation: the planner's canonical runtime planning-draft schema.
 *
 * `ManualPlanningDraftV8` adds exactly ONE persisted field to V7:
 *
 * ```ts
 * zoneAccommodationChoices: ZoneAccommodationChoice[];
 * ```
 *
 * ...under the SAME existing `nihon.manualPlanningDraft` key. There is no second storage key, no
 * side-car `selectedZone` record, and no parallel state: the decision "for this hub we sleep in
 * this zone" and the `AccommodationAnchor` that decision created live in one object, are written
 * in one transaction, and are reconciled and deleted together. That is the whole point of putting
 * the choice here rather than beside `nihon.zoneComparison.v1` — a choice stored outside the draft
 * could reference an anchor the draft had already deleted, and nothing would ever notice.
 *
 * Every inherited operation runs against a `v7View` that does not contain the new field at all, so
 * a V7 function provably cannot read or write it, and the choices are re-attached afterwards from
 * the caller's draft (the same structural guarantee V6 uses for `endDate` and V7 for
 * `interHubSegments`). The three exceptions are explicit and are the only places in this file that
 * reason about both halves at once: {@link withoutAccommodation}, {@link reconcileDraft} and
 * {@link resetRoute}, each of which must not leave a choice pointing at an anchor that is gone.
 *
 * **Nothing here derives anything.** No travel time, no route, no distance, no hub inferred from a
 * coordinate, no automatic boundary assignment, and no anchor chosen for the user because it is
 * the nearest or the only one. Seeding an anchor from a zone copies exactly the two fields the
 * anchor contract already requires — a label and a coordinate — from a registry record the user
 * explicitly picked.
 */
import {
  PLANNING_DRAFT_VERSION as PLANNING_DRAFT_VERSION_V7,
  freshDraft as freshDraftV7,
  parseStoredDraft as parseStoredDraftV7,
  reconcileDraft as reconcileDraftV7,
  resetRoute as resetRouteV7,
  withAccommodation as withAccommodationV7,
  withAccommodationLeg as withAccommodationLegV7,
  withDayAccommodationChoice as withDayAccommodationChoiceV7,
  withDayMoved as withDayMovedV7,
  withDays as withDaysV7,
  withEndDate as withEndDateV7,
  withFourPlacesReversedWithinDay as withFourPlacesReversedWithinDayV7,
  withInitialDays as withInitialDaysV7,
  withInterHubSegmentDetails as withInterHubSegmentDetailsV7,
  withNewAccommodation as withNewAccommodationV7,
  withNewEmptyDay as withNewEmptyDayV7,
  withNewInterHubSegment as withNewInterHubSegmentV7,
  withPlaceMovedBetweenDays as withPlaceMovedBetweenDaysV7,
  withPlaceMovedWithinDay as withPlaceMovedWithinDayV7,
  withPlaceRelocatedWithinDay as withPlaceRelocatedWithinDayV7,
  withPlacesTransposedWithinDay as withPlacesTransposedWithinDayV7,
  withRoute as withRouteV7,
  withStartDate as withStartDateV7,
  withTwoPairBlocksSwappedWithinDay as withTwoPairBlocksSwappedWithinDayV7,
  withVisitStartTime as withVisitStartTimeV7,
  withoutAccommodation as withoutAccommodationV7,
  withoutEmptyDay as withoutEmptyDayV7,
  withoutInterHubSegment as withoutInterHubSegmentV7,
  type ManualPlanningDraftV7,
  type PlanningDayV5,
} from "./planning-draft-v7";
import { PLANNING_DRAFT_STORAGE_KEY, type DraftStorage } from "./planning-draft";
import {
  isValidAccommodationLocation,
  type AccommodationAnchor,
  type AccommodationBoundaryChoice,
  type ManualAccommodationLeg,
} from "./accommodation-commute";
import type { InterHubMode, ManualInterHubSegment, NewManualInterHubSegment } from "./inter-hub-segment";
import {
  findZoneChoiceForHub,
  parseZoneAccommodationChoices,
  pruneZoneChoices,
  type ZoneAccommodationChoice,
} from "./zone-accommodation-choice";

export { PLANNING_DRAFT_STORAGE_KEY, type DraftStorage };
export {
  LEGACY_V4_DAY_ID_PREFIX,
  createAccommodationId,
  createDayId,
  dayMatrixFromPlanningDays,
  type PlanningDayV5,
} from "./planning-draft-v7";
export {
  findZoneChoiceForAnchor,
  findZoneChoiceForHub,
  type ZoneAccommodationChoice,
} from "./zone-accommodation-choice";

export const PLANNING_DRAFT_VERSION = 8 as const;

export type ManualPlanningDraftV8 = {
  version: 8;
  routeIds: string[];
  days: PlanningDayV5[] | null;
  startDate: string | null;
  endDate: string | null;
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  accommodationLegs: ManualAccommodationLeg[];
  interHubSegments: ManualInterHubSegment[];
  zoneAccommodationChoices: ZoneAccommodationChoice[];
};

/** The structural guarantee that no inherited operation can see, read or write the new field. */
function v7View(draft: ManualPlanningDraftV8): ManualPlanningDraftV7 {
  return {
    version: PLANNING_DRAFT_VERSION_V7,
    routeIds: draft.routeIds,
    days: draft.days,
    startDate: draft.startDate,
    endDate: draft.endDate,
    visitStartTimes: draft.visitStartTimes,
    accommodations: draft.accommodations,
    accommodationLegs: draft.accommodationLegs,
    interHubSegments: draft.interHubSegments,
  };
}

function liftFromV7(
  base: ManualPlanningDraftV7,
  zoneAccommodationChoices: ZoneAccommodationChoice[]
): ManualPlanningDraftV8 {
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: base.routeIds,
    days: base.days,
    startDate: base.startDate,
    endDate: base.endDate,
    visitStartTimes: base.visitStartTimes,
    accommodations: base.accommodations,
    accommodationLegs: base.accommodationLegs,
    interHubSegments: base.interHubSegments,
    zoneAccommodationChoices,
  };
}

function applyV7<Args extends unknown[]>(
  draft: ManualPlanningDraftV8,
  operation: (base: ManualPlanningDraftV7, ...args: Args) => ManualPlanningDraftV7,
  ...args: Args
): ManualPlanningDraftV8 {
  const base = v7View(draft);
  const next = operation(base, ...args);
  if (next === base) return draft;
  return liftFromV7(next, draft.zoneAccommodationChoices);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Does any user-authored planning decision still point at this anchor?
 *
 * "In use" means exactly two things, both of which are work the user typed or chose: a day
 * boundary that selects the anchor, and a manual accommodation leg whose duration was entered for
 * it. Nothing else counts — an anchor merely existing in the list is not use.
 *
 * This is the predicate the zone-choice operations below consult before removing an anchor they
 * previously seeded. An anchor that carries user work is NEVER removed automatically, because
 * removing it would take a boundary choice and a typed duration with it. See
 * {@link withZoneAccommodationChoice}.
 */
export function isAccommodationAnchorInUse(
  draft: ManualPlanningDraftV8,
  accommodationId: string
): boolean {
  const selectsAnchor = (choice: AccommodationBoundaryChoice): boolean =>
    choice.kind === "accommodation" && choice.accommodationId === accommodationId;
  const boundaryUse = (draft.days ?? []).some(
    (day) => selectsAnchor(day.accommodationBoundary.start) || selectsAnchor(day.accommodationBoundary.end)
  );
  const legUse = draft.accommodationLegs.some((leg) => leg.accommodationId === accommodationId);
  return boundaryUse || legUse;
}

/** V7 contained no zone decision, so migration adds an empty list and invents nothing. No anchor
 * already in a V7 draft is retroactively attributed to a zone. */
export function migrateV7ToV8(draft: ManualPlanningDraftV7): ManualPlanningDraftV8 {
  return liftFromV7(draft, []);
}

/**
 * Parses a stored value, or returns `null` for anything it cannot interpret — never a repaired or
 * partially-trusted draft.
 *
 * Beyond the shape and uniqueness rules `parseZoneAccommodationChoices` enforces, one relational
 * rule is checked here because only this layer can see both halves: **every choice must resolve to
 * an anchor that exists in the same draft.** A dangling choice is rejected outright rather than
 * silently dropped or rebound to another anchor — the same fail-closed policy the existing contract
 * already applies to a boundary choice referencing an unknown accommodation
 * (`docs/ACCOMMODATION_COMMUTE_DESIGN.md` §8.2).
 */
export function parseStoredDraft(raw: unknown): ManualPlanningDraftV8 | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== PLANNING_DRAFT_VERSION) {
    const older = parseStoredDraftV7(raw);
    return older ? migrateV7ToV8(older) : null;
  }

  const zoneAccommodationChoices = parseZoneAccommodationChoices(raw.zoneAccommodationChoices);
  if (zoneAccommodationChoices === null) return null;
  const base = parseStoredDraftV7({
    version: PLANNING_DRAFT_VERSION_V7,
    routeIds: raw.routeIds,
    days: raw.days,
    startDate: raw.startDate,
    endDate: raw.endDate,
    visitStartTimes: raw.visitStartTimes,
    accommodations: raw.accommodations,
    accommodationLegs: raw.accommodationLegs,
    interHubSegments: raw.interHubSegments,
  });
  if (!base) return null;

  const liveAnchorIds = new Set(base.accommodations.map((anchor) => anchor.id));
  if (zoneAccommodationChoices.some((choice) => !liveAnchorIds.has(choice.accommodationId))) {
    return null;
  }
  return liftFromV7(base, zoneAccommodationChoices);
}

export function freshDraft(savedIds: readonly string[]): ManualPlanningDraftV8 {
  return migrateV7ToV8(freshDraftV7(savedIds));
}

/**
 * Reconciliation against the caller's current saved ids.
 *
 * Anchors are not place-scoped and survive route edits under the existing contract, so a zone
 * choice survives every ordinary edit too. The prune here is defensive and exact: a choice is kept
 * if and only if its anchor is still present.
 */
export function reconcileDraft(
  stored: ManualPlanningDraftV8,
  savedIds: readonly string[]
): ManualPlanningDraftV8 {
  const base = reconcileDraftV7(v7View(stored), savedIds);
  return liftFromV7(
    base,
    pruneZoneChoices(
      stored.zoneAccommodationChoices,
      base.accommodations.map((anchor) => anchor.id)
    )
  );
}

export function loadReconciledDraft(
  storage: DraftStorage,
  savedIds: readonly string[]
): ManualPlanningDraftV8 {
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

export function writeDraft(storage: DraftStorage, draft: ManualPlanningDraftV8): void {
  try {
    storage.setItem(PLANNING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — preserve in-memory state */
  }
}

/**
 * Records "for this hub, we sleep in this zone", seeding the anchor that decision needs.
 *
 * One operation, one draft update — the anchor and the choice can never exist without each other.
 * The anchor is created through the ordinary {@link withNewAccommodation} contract, so it is an
 * ordinary anchor in every respect: it can be picked for any day's boundary, it needs the user's
 * own typed minutes exactly as a hand-made anchor does, and it carries no hub lock, no priority and
 * no privileged status.
 *
 * `label` and `location` are supplied by the caller from the registry record the user picked (the
 * zone's anchor station and its coordinate). This module does not read the zone registry — see the
 * note in `zone-accommodation-choice.ts`.
 *
 * ### Choosing a different zone for a hub the user already decided
 *
 * The previous choice for that hub is replaced, and its seeded anchor is removed **only when it
 * carries no user work** ({@link isAccommodationAnchorInUse}). That rule exists because the two
 * alternatives are both dishonest:
 *
 * * re-pointing the old anchor at the new zone's coordinate would silently reattribute durations
 *   the user typed for a *different* station — 25 minutes from Shinjuku is not 25 minutes from
 *   Asakusa;
 * * deleting an anchor that a day boundary selects, or that has a typed duration, would destroy
 *   manual state without asking.
 *
 * So an untouched seeded anchor is cleaned up (nothing is lost), and one the user has built on is
 * kept as an ordinary anchor they can review and delete themselves. The UI says which happened.
 *
 * Re-choosing the zone already chosen for that hub is a no-op: the draft is returned unchanged
 * rather than minting a second anchor for the same decision.
 */
export function withZoneAccommodationChoice(
  draft: ManualPlanningDraftV8,
  input: { hub: string; zoneId: string; label: string; location: { lat: number; lng: number } },
  idFactory: () => string
): ManualPlanningDraftV8 {
  if (
    input.hub.trim().length === 0 ||
    input.zoneId.trim().length === 0 ||
    input.label.trim().length === 0 ||
    !isValidAccommodationLocation(input.location)
  ) {
    return draft;
  }

  const previous = findZoneChoiceForHub(draft.zoneAccommodationChoices, input.hub);
  if (previous && previous.zoneId === input.zoneId) return draft;

  const seeded = withNewAccommodationV7(v7View(draft), input.label, input.location, idFactory);
  if (seeded.accommodations.length === draft.accommodations.length) return draft;
  const accommodationId = seeded.accommodations[seeded.accommodations.length - 1].id;

  const choices: ZoneAccommodationChoice[] = [
    ...draft.zoneAccommodationChoices.filter((choice) => choice.hub !== input.hub),
    { hub: input.hub, zoneId: input.zoneId, accommodationId },
  ];
  const next = liftFromV7(seeded, choices);

  if (previous && !isAccommodationAnchorInUse(next, previous.accommodationId)) {
    return liftFromV7(withoutAccommodationV7(v7View(next), previous.accommodationId), choices);
  }
  return next;
}

/**
 * Forgets the zone decision for one hub.
 *
 * The seeded anchor goes with it only when it carries no user work, on exactly the same terms as a
 * zone change above. An anchor the user has already attached a boundary or a typed duration to
 * survives as an ordinary anchor — this operation never silently removes manual state, and it never
 * converts a boundary choice to `no-accommodation` or to another anchor.
 */
export function withoutZoneAccommodationChoice(
  draft: ManualPlanningDraftV8,
  hub: string
): ManualPlanningDraftV8 {
  const choice = findZoneChoiceForHub(draft.zoneAccommodationChoices, hub);
  if (!choice) return draft;

  const choices = draft.zoneAccommodationChoices.filter((entry) => entry.hub !== hub);
  if (isAccommodationAnchorInUse(draft, choice.accommodationId)) {
    return { ...draft, zoneAccommodationChoices: choices };
  }
  return liftFromV7(withoutAccommodationV7(v7View(draft), choice.accommodationId), choices);
}

/**
 * Deletes one anchor — and, when that anchor was seeded by a zone, the choice that seeded it.
 *
 * Deleting the anchor directly from the accommodation manager is a perfectly legitimate way to
 * undo a zone decision, and leaving the choice behind would strand it pointing at nothing. The
 * inherited behaviour is otherwise untouched: the anchor's manual legs go with it and every
 * boundary that referenced it becomes `unselected`, never another anchor.
 */
export function withoutAccommodation(
  draft: ManualPlanningDraftV8,
  accommodationId: string
): ManualPlanningDraftV8 {
  const view = v7View(draft);
  const base = withoutAccommodationV7(view, accommodationId);
  if (base === view) return draft;
  return liftFromV7(
    base,
    pruneZoneChoices(
      draft.zoneAccommodationChoices,
      base.accommodations.map((anchor) => anchor.id)
    )
  );
}

export function withRoute(
  draft: ManualPlanningDraftV8,
  routeIds: readonly string[]
): ManualPlanningDraftV8 {
  return applyV7(draft, withRouteV7, routeIds);
}

/**
 * "Restablecer recorrido". Accommodation anchors are carried forward by the inherited contract, so
 * the zone decisions that seeded them are carried forward too — resetting the route is not a
 * decision about where the trip sleeps. The choices are still pruned against the anchors that
 * actually survived, so the relation cannot be left dangling by a future change to that contract.
 */
export function resetRoute(
  draft: ManualPlanningDraftV8,
  savedIds: readonly string[]
): ManualPlanningDraftV8 {
  const base = resetRouteV7(v7View(draft), savedIds);
  return liftFromV7(
    base,
    pruneZoneChoices(
      draft.zoneAccommodationChoices,
      base.accommodations.map((anchor) => anchor.id)
    )
  );
}

export function withAccommodation(
  draft: ManualPlanningDraftV8,
  anchor: AccommodationAnchor
): ManualPlanningDraftV8 {
  return applyV7(draft, withAccommodationV7, anchor);
}

export function withNewAccommodation(
  draft: ManualPlanningDraftV8,
  label: string,
  location: { lat: number; lng: number },
  idFactory: () => string
): ManualPlanningDraftV8 {
  return applyV7(draft, withNewAccommodationV7, label, location, idFactory);
}

export function withDayAccommodationChoice(
  draft: ManualPlanningDraftV8,
  dayId: string,
  side: "start" | "end",
  choice: AccommodationBoundaryChoice
): ManualPlanningDraftV8 {
  return applyV7(draft, withDayAccommodationChoiceV7, dayId, side, choice);
}

export function withAccommodationLeg(
  draft: ManualPlanningDraftV8,
  direction: ManualAccommodationLeg["direction"],
  accommodationId: string,
  placeId: string,
  minutes: number | null
): ManualPlanningDraftV8 {
  return applyV7(draft, withAccommodationLegV7, direction, accommodationId, placeId, minutes);
}

export function withNewInterHubSegment(
  draft: ManualPlanningDraftV8,
  input: NewManualInterHubSegment,
  idFactory: () => string
): ManualPlanningDraftV8 {
  return applyV7(draft, withNewInterHubSegmentV7, input, idFactory);
}

export function withInterHubSegmentDetails(
  draft: ManualPlanningDraftV8,
  segmentId: string,
  mode: InterHubMode,
  minutes: number
): ManualPlanningDraftV8 {
  return applyV7(draft, withInterHubSegmentDetailsV7, segmentId, mode, minutes);
}

export function withoutInterHubSegment(
  draft: ManualPlanningDraftV8,
  segmentId: string
): ManualPlanningDraftV8 {
  return applyV7(draft, withoutInterHubSegmentV7, segmentId);
}

export function withEndDate(draft: ManualPlanningDraftV8, endDate: string | null): ManualPlanningDraftV8 {
  return applyV7(draft, withEndDateV7, endDate);
}

export function withStartDate(
  draft: ManualPlanningDraftV8,
  startDate: string | null
): ManualPlanningDraftV8 {
  return applyV7(draft, withStartDateV7, startDate);
}

export function withDays(
  draft: ManualPlanningDraftV8,
  days: readonly (readonly string[])[]
): ManualPlanningDraftV8 {
  return applyV7(draft, withDaysV7, days);
}

export function withInitialDays(
  draft: ManualPlanningDraftV8,
  days: readonly (readonly string[])[],
  idFactory: () => string
): ManualPlanningDraftV8 {
  return applyV7(draft, withInitialDaysV7, days, idFactory);
}

export function withVisitStartTime(
  draft: ManualPlanningDraftV8,
  placeId: string,
  time: string | null
): ManualPlanningDraftV8 {
  return applyV7(draft, withVisitStartTimeV7, placeId, time);
}

export function withPlaceMovedWithinDay(
  draft: ManualPlanningDraftV8,
  dayId: string,
  placeIndex: number,
  direction: -1 | 1
): ManualPlanningDraftV8 {
  return applyV7(draft, withPlaceMovedWithinDayV7, dayId, placeIndex, direction);
}

export function withPlaceRelocatedWithinDay(
  draft: ManualPlanningDraftV8,
  dayId: string,
  fromIndex: number,
  toIndex: number
): ManualPlanningDraftV8 {
  return applyV7(draft, withPlaceRelocatedWithinDayV7, dayId, fromIndex, toIndex);
}

export function withPlacesTransposedWithinDay(
  draft: ManualPlanningDraftV8,
  dayId: string,
  leftIndex: number,
  rightIndex: number
): ManualPlanningDraftV8 {
  return applyV7(draft, withPlacesTransposedWithinDayV7, dayId, leftIndex, rightIndex);
}

export function withFourPlacesReversedWithinDay(
  draft: ManualPlanningDraftV8,
  dayId: string,
  windowStartIndex: number
): ManualPlanningDraftV8 {
  return applyV7(draft, withFourPlacesReversedWithinDayV7, dayId, windowStartIndex);
}

export function withTwoPairBlocksSwappedWithinDay(
  draft: ManualPlanningDraftV8,
  dayId: string,
  windowStartIndex: number
): ManualPlanningDraftV8 {
  return applyV7(draft, withTwoPairBlocksSwappedWithinDayV7, dayId, windowStartIndex);
}

export function withPlaceMovedBetweenDays(
  draft: ManualPlanningDraftV8,
  fromDayId: string,
  toDayId: string,
  placeIndex: number
): ManualPlanningDraftV8 {
  return applyV7(draft, withPlaceMovedBetweenDaysV7, fromDayId, toDayId, placeIndex);
}

export function withNewEmptyDay(
  draft: ManualPlanningDraftV8,
  idFactory: () => string
): ManualPlanningDraftV8 {
  return applyV7(draft, withNewEmptyDayV7, idFactory);
}

export function withoutEmptyDay(draft: ManualPlanningDraftV8, dayId: string): ManualPlanningDraftV8 {
  return applyV7(draft, withoutEmptyDayV7, dayId);
}

export function withDayMoved(
  draft: ManualPlanningDraftV8,
  dayId: string,
  direction: -1 | 1
): ManualPlanningDraftV8 {
  return applyV7(draft, withDayMovedV7, dayId, direction);
}

/**
 * The places this draft has actually put in a day, in day order then in each day's own order.
 *
 * A read, and nothing else: it takes a draft and returns ids. It is used by Block 6's derived
 * preferences view to state, as information, that a place whose interest is one-sided is already
 * on a day — never to move it, remove it, reschedule it or propose a replacement.
 *
 * **Route membership is deliberately not the test.** `freshDraft` seeds `routeIds` from the saved
 * list, so being in the route is not a decision anybody made; being assigned to a day is. With
 * `days` still `null` nothing has been scheduled and the answer is the empty list.
 */
export function dayAssignedPlaceIds(draft: ManualPlanningDraftV8): string[] {
  if (draft.days === null) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const day of draft.days) {
    for (const placeId of day.placeIds) {
      if (seen.has(placeId)) continue;
      seen.add(placeId);
      ids.push(placeId);
    }
  }
  return ids;
}
