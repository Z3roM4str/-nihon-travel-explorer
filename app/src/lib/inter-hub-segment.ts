import { validateDayPartition } from "./day-assignment";

/** Closed, deliberately separate vocabulary for user-entered major transport segments. */
export const INTER_HUB_MODES = [
  "shinkansen",
  "limited-express",
  "domestic-flight",
  "ferry",
  "highway-bus",
  "other",
] as const;

export type InterHubMode = (typeof INTER_HUB_MODES)[number];

export type ManualInterHubSegment = {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  fromHub: string;
  toHub: string;
  mode: InterHubMode;
  minutes: number;
  source: { kind: "user-entered" };
};

export type InterHubSegmentAssessment =
  | {
      kind: "active";
      placement: "route-only" | "same-day" | "between-consecutive-days";
      fromDayOrdinal: number | null;
      toDayOrdinal: number | null;
    }
  | {
      kind: "inactive";
      reason:
        | "missing-from-place"
        | "missing-to-place"
        | "from-hub-mismatch"
        | "to-hub-mismatch"
        | "same-current-hub"
        | "not-consecutive-in-route"
        | "not-consecutive-in-day"
        | "not-boundary-of-consecutive-days"
        | "invalid-day-partition";
    };

export type InterHubPlaceLookup = (placeId: string) => { hub: string } | null;

export type InterHubAssessmentContext = {
  routeIds: readonly string[];
  /** `null` means there is no day assignment. A present but invalid matrix never falls back. */
  days: readonly (readonly string[])[] | null;
  resolvePlace: InterHubPlaceLookup;
};

export type EligibleInterHubPair = {
  fromPlaceId: string;
  toPlaceId: string;
  fromHub: string;
  toHub: string;
  placement: "route-only" | "same-day" | "between-consecutive-days";
  fromDayOrdinal: number | null;
  toDayOrdinal: number | null;
};

export type NewManualInterHubSegment = Omit<ManualInterHubSegment, "id" | "source">;

const SEGMENT_KEYS = [
  "fromHub",
  "fromPlaceId",
  "id",
  "minutes",
  "mode",
  "source",
  "toHub",
  "toPlaceId",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isInterHubMode(value: unknown): value is InterHubMode {
  return typeof value === "string" && (INTER_HUB_MODES as readonly string[]).includes(value);
}

export function isValidInterHubMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Strict, all-fields parser for one persisted segment. Applicability is intentionally absent. */
export function parseManualInterHubSegment(value: unknown): ManualInterHubSegment | null {
  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== SEGMENT_KEYS.length || !SEGMENT_KEYS.every((key, index) => keys[index] === key)) {
    return null;
  }
  if (
    !isNonBlankString(value.id) ||
    !isNonBlankString(value.fromPlaceId) ||
    !isNonBlankString(value.toPlaceId) ||
    value.fromPlaceId === value.toPlaceId ||
    !isNonBlankString(value.fromHub) ||
    !isNonBlankString(value.toHub) ||
    value.fromHub === value.toHub ||
    !isInterHubMode(value.mode) ||
    !isValidInterHubMinutes(value.minutes) ||
    !isPlainObject(value.source) ||
    Object.keys(value.source).length !== 1 ||
    value.source.kind !== "user-entered"
  ) {
    return null;
  }
  return {
    id: value.id,
    fromPlaceId: value.fromPlaceId,
    toPlaceId: value.toPlaceId,
    fromHub: value.fromHub,
    toHub: value.toHub,
    mode: value.mode,
    minutes: value.minutes,
    source: { kind: "user-entered" },
  };
}

function directionalPairKey(segment: Pick<ManualInterHubSegment, "fromPlaceId" | "toPlaceId">): string {
  return `${segment.fromPlaceId}\u0000${segment.toPlaceId}`;
}

export function parseManualInterHubSegments(value: unknown): ManualInterHubSegment[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: ManualInterHubSegment[] = [];
  const ids = new Set<string>();
  const pairs = new Set<string>();
  for (const candidate of value) {
    const segment = parseManualInterHubSegment(candidate);
    if (!segment || ids.has(segment.id) || pairs.has(directionalPairKey(segment))) return null;
    ids.add(segment.id);
    pairs.add(directionalPairKey(segment));
    parsed.push(segment);
  }
  return parsed;
}

/** Collision-safe opaque id draw. The factory is injected; no semantic value is consulted. */
export function createInterHubSegmentId(
  existingIds: readonly string[],
  idFactory: () => string,
  maxAttempts = 8
): string | null {
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const id = idFactory();
    if (typeof id === "string" && id.trim().length > 0 && !existing.has(id)) return id;
  }
  return null;
}

export function createManualInterHubSegment(
  existing: readonly ManualInterHubSegment[],
  input: NewManualInterHubSegment,
  idFactory: () => string
): ManualInterHubSegment | null {
  if (existing.some((segment) => directionalPairKey(segment) === directionalPairKey(input))) return null;
  const id = createInterHubSegmentId(existing.map((segment) => segment.id), idFactory);
  if (id === null) return null;
  return parseManualInterHubSegment({ ...input, id, source: { kind: "user-entered" } });
}

function resolveAnchors(
  segment: ManualInterHubSegment,
  context: InterHubAssessmentContext
): InterHubSegmentAssessment | { fromHub: string; toHub: string } {
  if (!context.routeIds.includes(segment.fromPlaceId)) return { kind: "inactive", reason: "missing-from-place" };
  if (!context.routeIds.includes(segment.toPlaceId)) return { kind: "inactive", reason: "missing-to-place" };
  const from = context.resolvePlace(segment.fromPlaceId);
  if (!from) return { kind: "inactive", reason: "missing-from-place" };
  const to = context.resolvePlace(segment.toPlaceId);
  if (!to) return { kind: "inactive", reason: "missing-to-place" };
  if (from.hub === to.hub) return { kind: "inactive", reason: "same-current-hub" };
  if (from.hub !== segment.fromHub) return { kind: "inactive", reason: "from-hub-mismatch" };
  if (to.hub !== segment.toHub) return { kind: "inactive", reason: "to-hub-mismatch" };
  return { fromHub: from.hub, toHub: to.hub };
}

/** Pure applicability check. It never mutates the segment, route, days, or resolved places. */
export function assessInterHubSegment(
  segment: ManualInterHubSegment,
  context: InterHubAssessmentContext
): InterHubSegmentAssessment {
  if (context.days !== null && !validateDayPartition(context.routeIds, context.days).valid) {
    return { kind: "inactive", reason: "invalid-day-partition" };
  }
  const anchors = resolveAnchors(segment, context);
  if ("kind" in anchors) return anchors;

  if (context.days === null) {
    const fromIndex = context.routeIds.indexOf(segment.fromPlaceId);
    if (fromIndex === -1 || context.routeIds[fromIndex + 1] !== segment.toPlaceId) {
      return { kind: "inactive", reason: "not-consecutive-in-route" };
    }
    return { kind: "active", placement: "route-only", fromDayOrdinal: null, toDayOrdinal: null };
  }

  let fromDayOrdinal = -1;
  let toDayOrdinal = -1;
  let fromIndex = -1;
  let toIndex = -1;
  context.days.forEach((day, dayIndex) => {
    const candidateFrom = day.indexOf(segment.fromPlaceId);
    const candidateTo = day.indexOf(segment.toPlaceId);
    if (candidateFrom !== -1) {
      fromDayOrdinal = dayIndex;
      fromIndex = candidateFrom;
    }
    if (candidateTo !== -1) {
      toDayOrdinal = dayIndex;
      toIndex = candidateTo;
    }
  });

  if (fromDayOrdinal === toDayOrdinal) {
    if (toIndex !== fromIndex + 1) return { kind: "inactive", reason: "not-consecutive-in-day" };
    return {
      kind: "active",
      placement: "same-day",
      fromDayOrdinal,
      toDayOrdinal,
    };
  }

  const fromDay = context.days[fromDayOrdinal];
  const toDay = context.days[toDayOrdinal];
  if (
    toDayOrdinal !== fromDayOrdinal + 1 ||
    !fromDay ||
    !toDay ||
    fromIndex !== fromDay.length - 1 ||
    toIndex !== 0
  ) {
    return { kind: "inactive", reason: "not-boundary-of-consecutive-days" };
  }
  return {
    kind: "active",
    placement: "between-consecutive-days",
    fromDayOrdinal,
    toDayOrdinal,
  };
}

function eligiblePair(
  fromPlaceId: string,
  toPlaceId: string,
  placement: EligibleInterHubPair["placement"],
  fromDayOrdinal: number | null,
  toDayOrdinal: number | null,
  resolvePlace: InterHubPlaceLookup
): EligibleInterHubPair | null {
  const from = resolvePlace(fromPlaceId);
  const to = resolvePlace(toPlaceId);
  if (!from || !to || from.hub.trim().length === 0 || to.hub.trim().length === 0 || from.hub === to.hub) {
    return null;
  }
  return { fromPlaceId, toPlaceId, fromHub: from.hub, toHub: to.hub, placement, fromDayOrdinal, toDayOrdinal };
}

/** Current pairs from which the UI may create a new segment; mode and minutes remain absent. */
export function deriveEligibleInterHubPairs(context: InterHubAssessmentContext): EligibleInterHubPair[] {
  const pairs: EligibleInterHubPair[] = [];
  if (context.days === null) {
    for (let index = 0; index + 1 < context.routeIds.length; index += 1) {
      const pair = eligiblePair(
        context.routeIds[index],
        context.routeIds[index + 1],
        "route-only",
        null,
        null,
        context.resolvePlace
      );
      if (pair) pairs.push(pair);
    }
    return pairs;
  }
  if (!validateDayPartition(context.routeIds, context.days).valid) return pairs;

  context.days.forEach((day, dayIndex) => {
    for (let placeIndex = 0; placeIndex + 1 < day.length; placeIndex += 1) {
      const pair = eligiblePair(
        day[placeIndex],
        day[placeIndex + 1],
        "same-day",
        dayIndex,
        dayIndex,
        context.resolvePlace
      );
      if (pair) pairs.push(pair);
    }
    const nextDay = context.days?.[dayIndex + 1];
    if (!nextDay || day.length === 0 || nextDay.length === 0) return;
    const pair = eligiblePair(
      day[day.length - 1],
      nextDay[0],
      "between-consecutive-days",
      dayIndex,
      dayIndex + 1,
      context.resolvePlace
    );
    if (pair) pairs.push(pair);
  });
  return pairs;
}

export function pruneInterHubSegments(
  segments: readonly ManualInterHubSegment[],
  routeIds: readonly string[]
): ManualInterHubSegment[] {
  const live = new Set(routeIds);
  const next = segments.filter((segment) => live.has(segment.fromPlaceId) && live.has(segment.toPlaceId));
  return next.length === segments.length ? (segments as ManualInterHubSegment[]) : next;
}
