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

export function withRoute(draft: ManualPlanningDraftV4, routeIds: readonly string[]): ManualPlanningDraftV4 {
  const base = withRouteV3(v3View(draft), routeIds);
  const daysSurvived = base.days !== null && draft.days !== null;
  return {
    ...draft,
    version: PLANNING_DRAFT_VERSION,
    routeIds: base.routeIds,
    days: base.days,
    startDate: base.startDate,
    visitStartTimes: base.visitStartTimes,
    dayAccommodationBoundaries: daysSurvived
      ? draft.dayAccommodationBoundaries?.map(cloneBoundary) ?? freshBoundaryVector(base.days ?? [])
      : null,
    accommodationLegs: pruneLegs(draft.accommodationLegs, base.routeIds),
  };
}

export function withDays(
  draft: ManualPlanningDraftV4,
  days: readonly (readonly string[])[]
): ManualPlanningDraftV4 {
  const nextBase = withDaysV3(v3View(draft), days);
  if (nextBase.days === draft.days) return draft;
  // withDaysV3 returns its input object only for an invalid partition. Because v3View creates a
  // fresh object, compare the resulting matrix against the requested one to distinguish rejection.
  if (!sameDayMatrix(nextBase.days, days.map((day) => [...day]))) return draft;
  const unchanged = sameDayMatrix(draft.days, nextBase.days);
  return {
    ...draft,
    days: nextBase.days,
    dayAccommodationBoundaries:
      unchanged && draft.dayAccommodationBoundaries
        ? draft.dayAccommodationBoundaries.map(cloneBoundary)
        : freshBoundaryVector(nextBase.days),
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

export function withAccommodation(
  draft: ManualPlanningDraftV4,
  anchor: AccommodationAnchor
): ManualPlanningDraftV4 {
  if (
    anchor.id.length === 0 ||
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
