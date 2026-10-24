/**
 * Phase 3D-Q — Manual Accommodation Commute Legs: the runtime planning-draft schema.
 *
 * `ManualPlanningDraftV4` is the planner's single canonical runtime state, stored under the SAME
 * existing `nihon.manualPlanningDraft` key (`PLANNING_DRAFT_STORAGE_KEY`, re-exported below) — this
 * phase adds no second storage key and keeps no parallel V3 state. `planning-draft.ts` stays in the
 * codebase as the historical V1 → V2 → V3 migration chain and as the shared shape-validator for the
 * four fields V4 inherits unchanged, so a draft stored before this phase still loads exactly as it
 * did.
 *
 * Everything this module adds is a USER DECISION and nothing else: which accommodation anchors
 * exist, which anchor (if any) the user chose for each side of each ordinal day, and the exact
 * directed accommodation↔place durations the user typed. No minute, boundary, anchor or leg is ever
 * derived here — not from an anchor's coordinates, not from another day, not from the reverse
 * direction, not from a nearby place, and not from any provider. `AccommodationAnchor.location` is
 * geographic identity/context only; no function in this module or in `accommodation-commute.ts`
 * reads it for arithmetic.
 *
 * The parser is deliberately strict and fails the WHOLE stored draft rather than repairing part of
 * it — the existing all-or-nothing corruption policy in `planning-draft.ts`, extended to the new
 * fields. It never pads, truncates, deduplicates, shifts, rounds, rebinds or first-wins/last-wins
 * its way around a malformed shape, because none of those shapes could have been produced by this
 * app's own setters.
 */
import { validateDayPartition } from "./day-assignment";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  freshDraft as freshDraftV3,
  parseStoredDraft as parseStoredDraftV3,
  reconcileDraft as reconcileDraftV3,
  resetRoute as resetRouteV3,
  withDays as withDaysV3,
  withRoute as withRouteV3,
  withStartDate as withStartDateV3,
  withVisitStartTime as withVisitStartTimeV3,
  type DraftStorage,
  type ManualPlanningDraftV3,
} from "./planning-draft";
import {
  UNSELECTED_ACCOMMODATION_BOUNDARY,
  hasUniqueAccommodationIds,
  hasUniqueManualAccommodationLegKeys,
  isValidAccommodationLocation,
  isValidManualAccommodationMinutes,
  withManualAccommodationLeg,
  type AccommodationAnchor,
  type AccommodationBoundaryChoice,
  type DayAccommodationBoundary,
  type ManualAccommodationLeg,
} from "./accommodation-commute";

export { PLANNING_DRAFT_STORAGE_KEY, type DraftStorage } from "./planning-draft";
export const PLANNING_DRAFT_VERSION = 4 as const;

export type ManualPlanningDraftV4 = {
  version: 4;
  routeIds: string[];
  days: string[][] | null;
  startDate: string | null;
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  dayAccommodationBoundaries: DayAccommodationBoundary[] | null;
  accommodationLegs: ManualAccommodationLeg[];
};

function v3View(draft: ManualPlanningDraftV4): ManualPlanningDraftV3 {
  return {
    version: 3,
    routeIds: draft.routeIds,
    days: draft.days,
    startDate: draft.startDate,
    visitStartTimes: draft.visitStartTimes,
  };
}

function cloneBoundary(boundary: DayAccommodationBoundary): DayAccommodationBoundary {
  return {
    start:
      boundary.start.kind === "accommodation"
        ? { kind: "accommodation", accommodationId: boundary.start.accommodationId }
        : { kind: boundary.start.kind },
    end:
      boundary.end.kind === "accommodation"
        ? { kind: "accommodation", accommodationId: boundary.end.accommodationId }
        : { kind: boundary.end.kind },
  };
}

function freshBoundaryVector(days: readonly (readonly string[])[]): DayAccommodationBoundary[] {
  return days.map(() => cloneBoundary(UNSELECTED_ACCOMMODATION_BOUNDARY));
}

function sameDayMatrix(a: readonly (readonly string[])[] | null, b: readonly (readonly string[])[] | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  return a.every(
    (day, index) =>
      day.length === b[index].length && day.every((placeId, placeIndex) => placeId === b[index][placeIndex])
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAccommodationAnchor(value: unknown): AccommodationAnchor | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.id !== "string" || value.id.length === 0 || typeof value.label !== "string") return null;
  if (!isPlainObject(value.location)) return null;
  if (typeof value.location.lat !== "number" || typeof value.location.lng !== "number") return null;
  const location = { lat: value.location.lat, lng: value.location.lng };
  if (!isValidAccommodationLocation(location)) return null;
  return { id: value.id, label: value.label, location };
}

function parseBoundaryChoice(value: unknown): AccommodationBoundaryChoice | null {
  if (!isPlainObject(value) || typeof value.kind !== "string") return null;
  if (value.kind === "unselected" || value.kind === "no-accommodation") return { kind: value.kind };
  if (value.kind === "accommodation" && typeof value.accommodationId === "string" && value.accommodationId.length > 0) {
    return { kind: "accommodation", accommodationId: value.accommodationId };
  }
  return null;
}

function parseDayBoundary(value: unknown): DayAccommodationBoundary | null {
  if (!isPlainObject(value)) return null;
  const start = parseBoundaryChoice(value.start);
  const end = parseBoundaryChoice(value.end);
  return start && end ? { start, end } : null;
}

function parseManualLeg(value: unknown): ManualAccommodationLeg | null {
  if (!isPlainObject(value)) return null;
  if (
    (value.direction !== "accommodation-to-place" && value.direction !== "place-to-accommodation") ||
    typeof value.accommodationId !== "string" ||
    value.accommodationId.length === 0 ||
    typeof value.placeId !== "string" ||
    value.placeId.length === 0 ||
    typeof value.minutes !== "number" ||
    !isValidManualAccommodationMinutes(value.minutes) ||
    !isPlainObject(value.source) ||
    value.source.kind !== "user-entered"
  ) {
    return null;
  }
  return value.direction === "accommodation-to-place"
    ? {
        direction: "accommodation-to-place",
        accommodationId: value.accommodationId,
        placeId: value.placeId,
        minutes: value.minutes,
        source: { kind: "user-entered" },
      }
    : {
        direction: "place-to-accommodation",
        placeId: value.placeId,
        accommodationId: value.accommodationId,
        minutes: value.minutes,
        source: { kind: "user-entered" },
      };
}

/**
 * Migrates a shape-valid V3 draft to V4. `routeIds`, `days`, `startDate` and `visitStartTimes` pass
 * through exactly unchanged; the three new fields invent nothing. A V3 draft predates accommodation
 * planning entirely, so there is no anchor, no boundary decision and no duration to carry forward,
 * and none is guessed from the route, the dates, or the places.
 *
 * `dayAccommodationBoundaries` is the one structural exception, and it is scaffolding rather than a
 * decision: a V3 draft that already has a day partition migrates to an all-`unselected` vector of
 * exactly the same length, so the migrated value immediately satisfies V4's same-length invariant.
 * A V3 draft with `days: null` migrates to `dayAccommodationBoundaries: null`.
 */
export function migrateV3ToV4(draft: ManualPlanningDraftV3): ManualPlanningDraftV4 {
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: [...draft.routeIds],
    days: draft.days ? draft.days.map((day) => [...day]) : null,
    startDate: draft.startDate,
    visitStartTimes: { ...draft.visitStartTimes },
    accommodations: [],
    dayAccommodationBoundaries: draft.days ? freshBoundaryVector(draft.days) : null,
    accommodationLegs: [],
  };
}

/**
 * Parses V4 strictly. V1/V2/V3 are delegated to the historical parser and then migrated.
 * Structural corruption is rejected rather than padded, deduplicated, shifted, rounded or rebound.
 */
export function parseStoredDraft(raw: unknown): ManualPlanningDraftV4 | null {
  if (!isPlainObject(raw)) return null;

  if (raw.version !== PLANNING_DRAFT_VERSION) {
    const older = parseStoredDraftV3(raw);
    return older ? migrateV3ToV4(older) : null;
  }

  const base = parseStoredDraftV3({
    version: 3,
    routeIds: raw.routeIds,
    days: raw.days,
    startDate: raw.startDate,
    visitStartTimes: raw.visitStartTimes,
  });
  if (!base) return null;

  if (!Array.isArray(raw.accommodations) || !Array.isArray(raw.accommodationLegs)) return null;
  const accommodations: AccommodationAnchor[] = [];
  for (const value of raw.accommodations) {
    const anchor = parseAccommodationAnchor(value);
    if (!anchor) return null;
    accommodations.push(anchor);
  }
  if (!hasUniqueAccommodationIds(accommodations)) return null;
  const accommodationIds = new Set(accommodations.map((anchor) => anchor.id));

  let dayAccommodationBoundaries: DayAccommodationBoundary[] | null;
  if (base.days === null) {
    if (raw.dayAccommodationBoundaries !== null) return null;
    dayAccommodationBoundaries = null;
  } else {
    if (!Array.isArray(raw.dayAccommodationBoundaries)) return null;
    if (raw.dayAccommodationBoundaries.length !== base.days.length) return null;
    dayAccommodationBoundaries = [];
    for (let index = 0; index < raw.dayAccommodationBoundaries.length; index += 1) {
      const boundary = parseDayBoundary(raw.dayAccommodationBoundaries[index]);
      if (!boundary) return null;
      if (base.days[index].length === 0 && (boundary.start.kind !== "unselected" || boundary.end.kind !== "unselected")) {
        return null;
      }
      for (const choice of [boundary.start, boundary.end]) {
        if (choice.kind === "accommodation" && !accommodationIds.has(choice.accommodationId)) return null;
      }
      dayAccommodationBoundaries.push(boundary);
    }
  }

  const routeSet = new Set(base.routeIds);
  const accommodationLegs: ManualAccommodationLeg[] = [];
  for (const value of raw.accommodationLegs) {
    const leg = parseManualLeg(value);
    if (!leg || !accommodationIds.has(leg.accommodationId) || !routeSet.has(leg.placeId)) return null;
    accommodationLegs.push(leg);
  }
  if (!hasUniqueManualAccommodationLegKeys(accommodationLegs)) return null;

  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: base.routeIds,
    days: base.days,
    startDate: base.startDate,
    visitStartTimes: base.visitStartTimes,
    accommodations,
    dayAccommodationBoundaries,
    accommodationLegs,
  };
}

export function freshDraft(savedIds: readonly string[]): ManualPlanningDraftV4 {
  return migrateV3ToV4(freshDraftV3(savedIds));
}

function pruneLegs(legs: readonly ManualAccommodationLeg[], routeIds: readonly string[]): ManualAccommodationLeg[] {
  const routeSet = new Set(routeIds);
  return legs.filter((leg) => routeSet.has(leg.placeId));
}

export function reconcileDraft(stored: ManualPlanningDraftV4, savedIds: readonly string[]): ManualPlanningDraftV4 {
  const reconciledBase = reconcileDraftV3(v3View(stored), savedIds);
  const dayShapeUnchanged = sameDayMatrix(stored.days, reconciledBase.days);
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: reconciledBase.routeIds,
    days: reconciledBase.days,
    startDate: reconciledBase.startDate,
    visitStartTimes: reconciledBase.visitStartTimes,
    accommodations: stored.accommodations,
    dayAccommodationBoundaries:
      reconciledBase.days === null
        ? null
        : dayShapeUnchanged && stored.dayAccommodationBoundaries
          ? stored.dayAccommodationBoundaries.map(cloneBoundary)
          : freshBoundaryVector(reconciledBase.days),
    accommodationLegs: pruneLegs(stored.accommodationLegs, reconciledBase.routeIds),
  };
}

export function loadReconciledDraft(storage: DraftStorage, savedIds: readonly string[]): ManualPlanningDraftV4 {
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

export function writeDraft(storage: DraftStorage, draft: ManualPlanningDraftV4): void {
  try {
    storage.setItem(PLANNING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — preserve in-memory state */
  }
}

/**
 * Applies a new route. `withRouteV3` decides the fate of `days` exactly as before (retained on a
 * pure reorder, invalidated on any composition change); this wrapper only decides what that means
 * for the accommodation state.
 *
 * The boundary vector is positional, so it survives only when the resulting day matrix is
 * element-for-element identical to the stored one — checked here against the actual matrices
 * rather than assumed from "both are non-null", so no future change to the V3 rule could silently
 * leave Hotel A attached to a day whose places moved. Anything else gets a fresh all-`unselected`
 * vector (or `null` when `days` was invalidated).
 *
 * Anchors always survive — they are trip-scoped decisions, not route-scoped ones. Manual legs are
 * endpoint-keyed, so a pure reorder keeps every one of them; a composition change prunes exactly
 * the legs whose place left the route, and never rebinds one to another place or anchor.
 */
export function withRoute(draft: ManualPlanningDraftV4, routeIds: readonly string[]): ManualPlanningDraftV4 {
  const base = withRouteV3(v3View(draft), routeIds);
  const dayShapeUnchanged = sameDayMatrix(draft.days, base.days);
  return {
    ...draft,
    version: PLANNING_DRAFT_VERSION,
    routeIds: base.routeIds,
    days: base.days,
    startDate: base.startDate,
    visitStartTimes: base.visitStartTimes,
    dayAccommodationBoundaries:
      base.days === null
        ? null
        : dayShapeUnchanged && draft.dayAccommodationBoundaries
          ? draft.dayAccommodationBoundaries.map(cloneBoundary)
          : freshBoundaryVector(base.days),
    accommodationLegs: pruneLegs(draft.accommodationLegs, base.routeIds),
  };
}

/**
 * Applies a new day assignment, and with it THE critical Phase 3D-Q rule: an ordinal-day boundary
 * choice survives only when the new matrix is element-for-element identical to the stored one —
 * same bucket count, same places, same bucket, same order inside each bucket. Any other valid
 * assignment resets EVERY side of EVERY day to `{ kind: "unselected" }`.
 *
 * This deliberately prefers losing the user's boundary choices over shifting Hotel A onto a day
 * whose first/last place is no longer the one they chose it for. Nothing here shifts a boundary by
 * position, similarity-matches an old day to a new one, or carries a duration across a re-split:
 * the planner has no stable day identity to justify any of that (see
 * `docs/ACCOMMODATION_COMMUTE_DESIGN.md` §8.2).
 *
 * Manual leg records are untouched — their identity is the exact directed endpoint pair, not an
 * ordinal day — so they simply sit unused until the user explicitly chooses a boundary whose
 * endpoints match one again.
 *
 * Rejection is decided by `validateDayPartition`, the same shared rule `withDaysV3` itself applies,
 * rather than by inspecting the object identity of its return value.
 */
export function withDays(
  draft: ManualPlanningDraftV4,
  days: readonly (readonly string[])[]
): ManualPlanningDraftV4 {
  const { valid } = validateDayPartition(draft.routeIds, days);
  if (!valid) return draft;

  const nextBase = withDaysV3(v3View(draft), days);
  const nextDays = nextBase.days ?? [];
  const unchanged = sameDayMatrix(draft.days, nextDays);
  return {
    ...draft,
    days: nextDays,
    dayAccommodationBoundaries:
      unchanged && draft.dayAccommodationBoundaries
        ? draft.dayAccommodationBoundaries.map(cloneBoundary)
        : freshBoundaryVector(nextDays),
  };
}

export function withStartDate(draft: ManualPlanningDraftV4, startDate: string | null): ManualPlanningDraftV4 {
  const base = withStartDateV3(v3View(draft), startDate);
  if (base.startDate === draft.startDate) return draft;
  return { ...draft, startDate: base.startDate };
}

export function withVisitStartTime(
  draft: ManualPlanningDraftV4,
  placeId: string,
  time: string | null
): ManualPlanningDraftV4 {
  const base = withVisitStartTimeV3(v3View(draft), placeId, time);
  if (base.visitStartTimes === draft.visitStartTimes) return draft;
  return { ...draft, visitStartTimes: base.visitStartTimes };
}

/**
 * Draws an accommodation id from `idFactory` until it yields a non-empty id that is not already in
 * use, or gives up after `maxAttempts` and returns `null`. The id carries no geographic, chain,
 * quality, priority or booking meaning — it exists only so two anchors the user considers different
 * stay different.
 *
 * The factory is injected rather than hard-coded so the browser API behind it (`crypto.randomUUID`
 * in `usePlanningDraft.ts`) never has to be stubbed in tests, and so a collision fails safely
 * instead of overwriting an existing anchor.
 */
export function createAccommodationId(
  existingIds: readonly string[],
  idFactory: () => string,
  maxAttempts = 8
): string | null {
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const id = idFactory();
    if (typeof id === "string" && id.length > 0 && !existing.has(id)) return id;
  }
  return null;
}

/**
 * Adds one anchor. Rejected outright (the draft is returned unchanged) for an empty id, an id
 * already in use, a label that is blank once trimmed, or a coordinate outside the ordinary
 * geographic ranges — never coerced, never renamed, never given a generated label or a default pin.
 *
 * Two anchors with the same label and/or the same coordinates are kept as two distinct anchors:
 * only the id decides identity, and nothing here merges, ranks, or reorders them. Array order has
 * no meaning at all — it is neither priority nor recency nor a tie-breaker.
 */
export function withAccommodation(
  draft: ManualPlanningDraftV4,
  anchor: AccommodationAnchor
): ManualPlanningDraftV4 {
  if (
    anchor.id.length === 0 ||
    anchor.label.trim().length === 0 ||
    !isValidAccommodationLocation(anchor.location) ||
    draft.accommodations.some((existing) => existing.id === anchor.id)
  ) {
    return draft;
  }
  return {
    ...draft,
    accommodations: [...draft.accommodations, { ...anchor, location: { ...anchor.location } }],
  };
}

/**
 * The composed "user created an accommodation" operation the React hook calls: mint an id, then add
 * the anchor. Returns the draft unchanged when no unique id could be minted or when
 * {@link withAccommodation} rejects the anchor, so a failure can never half-apply.
 *
 * The label is stored trimmed exactly as typed. It is display text — never parsed as an address, a
 * brand, a hub, a station, or a transport instruction — and it is never geocoded: the coordinate is
 * the user's own, entered separately.
 */
export function withNewAccommodation(
  draft: ManualPlanningDraftV4,
  label: string,
  location: { lat: number; lng: number },
  idFactory: () => string
): ManualPlanningDraftV4 {
  const id = createAccommodationId(
    draft.accommodations.map((anchor) => anchor.id),
    idFactory
  );
  if (id === null) return draft;
  return withAccommodation(draft, { id, label: label.trim(), location });
}

/**
 * Deletes one anchor. Its manual legs are removed with it, and every boundary choice that
 * referenced it becomes `{ kind: "unselected" }` — never another anchor (not the remaining one, not
 * the nearest, not the most recent) and never `no-accommodation`, which is a positive statement the
 * user alone makes. Boundary choices pointing at other anchors are left exactly as they are.
 */
export function withoutAccommodation(draft: ManualPlanningDraftV4, accommodationId: string): ManualPlanningDraftV4 {
  if (!draft.accommodations.some((anchor) => anchor.id === accommodationId)) return draft;
  const resetChoice = (choice: AccommodationBoundaryChoice): AccommodationBoundaryChoice =>
    choice.kind === "accommodation" && choice.accommodationId === accommodationId
      ? { kind: "unselected" }
      : choice.kind === "accommodation"
        ? { kind: "accommodation", accommodationId: choice.accommodationId }
        : { kind: choice.kind };
  return {
    ...draft,
    accommodations: draft.accommodations.filter((anchor) => anchor.id !== accommodationId),
    dayAccommodationBoundaries:
      draft.dayAccommodationBoundaries?.map((boundary) => ({
        start: resetChoice(boundary.start),
        end: resetChoice(boundary.end),
      })) ?? null,
    accommodationLegs: draft.accommodationLegs.filter((leg) => leg.accommodationId !== accommodationId),
  };
}

/**
 * Records ONE side of ONE ordinal day's boundary choice. `unselected`, `no-accommodation` and
 * `accommodation` are three distinct persisted states; this setter never converts between them and
 * never touches the other side or another day.
 *
 * Rejected outright: a day index outside the current matrix, an anchor that does not exist, and an
 * EMPTY day bucket — an empty day has no first or last place, so there is no endpoint a choice
 * could honestly connect to (design §4.1).
 */
export function withDayAccommodationChoice(
  draft: ManualPlanningDraftV4,
  dayIndex: number,
  side: "start" | "end",
  choice: AccommodationBoundaryChoice
): ManualPlanningDraftV4 {
  if (!draft.days || !draft.dayAccommodationBoundaries) return draft;
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= draft.days.length) return draft;
  if (draft.days[dayIndex].length === 0) return draft;
  if (choice.kind === "accommodation" && !draft.accommodations.some((anchor) => anchor.id === choice.accommodationId)) {
    return draft;
  }
  const boundaries = draft.dayAccommodationBoundaries.map(cloneBoundary);
  boundaries[dayIndex] = { ...boundaries[dayIndex], [side]: choice };
  return { ...draft, dayAccommodationBoundaries: boundaries };
}

/**
 * Sets, replaces, or clears the duration of exactly ONE directed endpoint key
 * `(direction, accommodationId, placeId)`. Setting an existing key replaces that record rather than
 * appending a competing one; `minutes: null` clears only that key.
 *
 * `minutes` must be a positive safe integer (`Number.isSafeInteger(minutes) && minutes > 0`).
 * Zero, negatives, fractions, `NaN`, infinities and unsafe integers are rejected outright — never
 * rounded, floored, or coerced. An unknown anchor or a place outside the current route is rejected
 * the same way, so this setter can never create the out-of-route record the V4 parser treats as
 * structural corruption.
 *
 * The write is strictly one-directional and endpoint-exact: `Hotel A → Place X` never populates
 * `Place X → Hotel A`, `Hotel B → Place X`, or `Hotel A → Place Y`.
 */
export function withAccommodationLeg(
  draft: ManualPlanningDraftV4,
  direction: ManualAccommodationLeg["direction"],
  accommodationId: string,
  placeId: string,
  minutes: number | null
): ManualPlanningDraftV4 {
  if (!draft.accommodations.some((anchor) => anchor.id === accommodationId)) return draft;
  if (!draft.routeIds.includes(placeId)) return draft;
  if (minutes !== null && !isValidManualAccommodationMinutes(minutes)) return draft;
  return {
    ...draft,
    accommodationLegs: withManualAccommodationLeg(
      draft.accommodationLegs,
      direction,
      accommodationId,
      placeId,
      minutes
    ),
  };
}

/**
 * "Restablecer recorrido": the route becomes the current saved ids and the day assignment is
 * cleared, so the ordinal-day boundary vector goes with it (`null`, matching `days: null`).
 *
 * Anchors survive — resetting the route is not a statement about where the user is staying — and
 * endpoint-keyed manual legs survive for every place still in the rebuilt route, pruned only for
 * places that are no longer saved at all.
 */
export function resetRoute(draft: ManualPlanningDraftV4, savedIds: readonly string[]): ManualPlanningDraftV4 {
  const base = resetRouteV3(v3View(draft), savedIds);
  return {
    ...draft,
    routeIds: base.routeIds,
    days: null,
    startDate: base.startDate,
    visitStartTimes: base.visitStartTimes,
    dayAccommodationBoundaries: null,
    accommodationLegs: pruneLegs(draft.accommodationLegs, base.routeIds),
  };
}
