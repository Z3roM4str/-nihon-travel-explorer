/**
 * Phase 3D-S — Stable Day Identity Runtime: the planner's canonical runtime planning-draft schema.
 *
 * `ManualPlanningDraftV5` replaces `ManualPlanningDraftV4` as the single canonical runtime state,
 * stored under the SAME existing `nihon.manualPlanningDraft` key (`PLANNING_DRAFT_STORAGE_KEY`,
 * re-exported below). There is no second storage key, no second day-id store, and no parallel V4
 * state kept alongside this one: `planning-draft-v4.ts` stays in the codebase purely as the
 * historical V1 → V2 → V3 → V4 migration chain and as the shared validator for everything V5
 * inherits unchanged, so a draft stored before this phase still loads exactly as it did.
 *
 * The one thing this phase adds is IDENTITY. A day is now a persisted entity
 * ({@link PlanningDayV5}) carrying one opaque stable id and its own accommodation boundary, instead
 * of an anonymous `string[]` at some ordinal position paired by index with a separate boundary
 * vector. The id means exactly one thing:
 *
 * > this is the same user-authored day bucket across manual edits that preserve that bucket.
 *
 * It encodes NOTHING else — not the ordinal position, not the civil date, not the weekday, not a
 * hub/city/prefecture/region, not an accommodation, not the first or last place, not how many
 * places the day holds, not route quality, not a recommendation, not a priority, not creation
 * order. Two days are the same day if and only if their persisted ids are equal; identity is never
 * inferred from array index, equal or similar `placeIds`, endpoints, hotel choice, date, the
 * visible `Día N` label, geography, or any edit-distance/similarity score. That prohibition is
 * load-bearing: content matching is inherently ambiguous for empty days and would silently move a
 * hotel choice onto the wrong bucket (see `docs/STABLE_DAY_IDENTITY_DESIGN.md` §3.3).
 *
 * Stable identity is a PERSISTENCE and MUTATION concern only. It is deliberately NOT a new
 * semantic input to `DayAssignment`, the calendar, weekday signals, reservation evaluation, hours
 * composition or intra-day transfers: every one of those consumers keeps receiving only the
 * ordinal `string[][]` matrix, produced here by the pure {@link dayMatrixFromPlanningDays}
 * projection (corrective addendum, Finding 2). No day id is ever passed to `validateDayPartition`,
 * `buildDayAssignment`, or any temporal/logistics module, and `Día N` plus
 * `addCivilDays(startDate, ordinalIndex)` stay derived from array order exactly as before.
 *
 * The parser is deliberately strict and fails the WHOLE stored draft rather than repairing part of
 * it — the existing all-or-nothing corruption policy, extended to day entities. It never renumbers,
 * regenerates an id, deduplicates, similarity-matches, rebinds, or partially applies. A duplicate
 * day id is corruption, not evidence that two records should merge.
 */
import { validateDayPartition } from "./day-assignment";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  parseStoredDraft as parseStoredDraftV3,
  reconcileDraft as reconcileDraftV3,
  resetRoute as resetRouteV3,
  withRoute as withRouteV3,
  withStartDate as withStartDateV3,
  withVisitStartTime as withVisitStartTimeV3,
  type DraftStorage,
  type ManualPlanningDraftV3,
} from "./planning-draft";
import {
  freshDraft as freshDraftV4,
  parseStoredDraft as parseStoredDraftV4,
  type ManualPlanningDraftV4,
} from "./planning-draft-v4";
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
export const PLANNING_DRAFT_VERSION = 5 as const;

/**
 * The prefix of the deterministic ids minted ONCE when a V4 draft is migrated. The historical
 * ordinal position is used exactly once, to create identity where none existed; after the migrated
 * draft is persisted, no id is ever recomputed from a position again, and nothing anywhere reads
 * this prefix or the trailing number back as the day's current ordinal.
 */
export const LEGACY_V4_DAY_ID_PREFIX = "legacy-v4-day-";

/**
 * One persisted day bucket. `id` is opaque and stable; `placeIds` is the user's explicit order
 * inside that day; `accommodationBoundary` is that same user-authored day's own start/end choice,
 * structurally embedded rather than paired by index with a separate vector — so it cannot drift in
 * length, cannot be shifted by a positional splice, travels with the day, and disappears with it.
 */
export type PlanningDayV5 = {
  id: string;
  placeIds: string[];
  accommodationBoundary: DayAccommodationBoundary;
};

export type ManualPlanningDraftV5 = {
  version: 5;
  routeIds: string[];
  days: PlanningDayV5[] | null;
  startDate: string | null;
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  accommodationLegs: ManualAccommodationLeg[];
};

/**
 * THE identity/ordinal boundary (corrective addendum, Finding 2). The only thing every existing
 * day-assignment, calendar, weekday, reservation, hours and transfer consumer ever receives.
 *
 * Pure and total: day array order is preserved exactly, each day's place order is preserved
 * exactly, and no `dayId` crosses this line. Because the projection depends on nothing but
 * `placeIds`, changing only a day's `id` provably cannot alter a `DayAssignment`, a civil date, a
 * weekday signal, a reservation result, or an intra-day transfer sequence.
 */
export function dayMatrixFromPlanningDays(
  days: readonly PlanningDayV5[] | null
): string[][] | null {
  return days?.map((day) => [...day.placeIds]) ?? null;
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

function cloneDay(day: PlanningDayV5): PlanningDayV5 {
  return {
    id: day.id,
    placeIds: [...day.placeIds],
    accommodationBoundary: cloneBoundary(day.accommodationBoundary),
  };
}

function cloneDays(days: readonly PlanningDayV5[] | null): PlanningDayV5[] | null {
  return days ? days.map(cloneDay) : null;
}

function unselectedBoundary(): DayAccommodationBoundary {
  return cloneBoundary(UNSELECTED_ACCOMMODATION_BOUNDARY);
}

function v3View(draft: ManualPlanningDraftV5): ManualPlanningDraftV3 {
  return {
    version: 3,
    routeIds: draft.routeIds,
    days: dayMatrixFromPlanningDays(draft.days),
    startDate: draft.startDate,
    visitStartTimes: draft.visitStartTimes,
  };
}

function sameDayMatrix(
  a: readonly (readonly string[])[] | null,
  b: readonly (readonly string[])[] | null
): boolean {
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

/** One stored day entity. Rejects a non-object, a missing/empty/non-string id, a `placeIds` that
 * is not an array of strings, and a malformed boundary — never repairs any of them. */
function parsePlanningDay(value: unknown): PlanningDayV5 | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.id !== "string" || value.id.length === 0) return null;
  if (!Array.isArray(value.placeIds) || !value.placeIds.every((placeId) => typeof placeId === "string")) {
    return null;
  }
  const accommodationBoundary = parseDayBoundary(value.accommodationBoundary);
  if (!accommodationBoundary) return null;
  return { id: value.id, placeIds: [...(value.placeIds as string[])], accommodationBoundary };
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
 * Migrates a shape-valid V4 draft to V5. This is the ONE place the historical ordinal position is
 * allowed to create identity, and it invents no semantic decision whatsoever.
 *
 * For the V4 day at index `i`: `placeIds` is copied exactly, `dayAccommodationBoundaries[i]` is
 * copied exactly, and the pair is packaged into one entity under the deterministic migration-only
 * id `legacy-v4-day-${i}`. Re-parsing the same stored V4 value therefore always yields the same
 * ids, and those ids are unique within the migrated draft by construction. Once the migrated V5 is
 * persisted, no id is ever recomputed from a position again, and nothing reads `${i}` back as the
 * day's current ordinal.
 *
 * Migration does NOT infer that a hotel belongs to a day — V4 already contains that explicit
 * boundary choice. It only packages the existing positional pair into one stable entity. No anchor,
 * manual leg, visit time, date, route id or boundary choice is created, removed, changed or
 * rebound. `days: null` stays `days: null`, and a V4 draft whose `dayAccommodationBoundaries` is
 * absent for a present `days` cannot exist (V4's own same-length parse invariant), so the fallback
 * below is an all-`unselected` boundary rather than a guess.
 */
export function migrateV4ToV5(draft: ManualPlanningDraftV4): ManualPlanningDraftV5 {
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: [...draft.routeIds],
    days:
      draft.days === null
        ? null
        : draft.days.map((placeIds, index) => ({
            id: `${LEGACY_V4_DAY_ID_PREFIX}${index}`,
            placeIds: [...placeIds],
            accommodationBoundary: draft.dayAccommodationBoundaries?.[index]
              ? cloneBoundary(draft.dayAccommodationBoundaries[index])
              : unselectedBoundary(),
          })),
    startDate: draft.startDate,
    visitStartTimes: { ...draft.visitStartTimes },
    accommodations: draft.accommodations.map((anchor) => ({ ...anchor, location: { ...anchor.location } })),
    accommodationLegs: [...draft.accommodationLegs],
  };
}

/**
 * Parses V5 strictly, all-or-nothing. V1–V4 are delegated to the historical parser chain and then
 * migrated once by {@link migrateV4ToV5}.
 *
 * The whole stored draft is rejected — never partially salvaged, renumbered, deduplicated,
 * regenerated, content-matched or rebound — when any of these hold: `days` is neither `null` nor an
 * array of well-formed day objects; a day id is empty; two day ids collide; a `placeIds` entry is
 * malformed; the PROJECTED ordinal matrix does not satisfy `validateDayPartition` against
 * `routeIds`; an empty day carries a boundary side that is not `unselected`; a boundary names an
 * unknown accommodation; a manual leg is malformed, names an unknown anchor or an out-of-route
 * place, carries invalid minutes, or duplicates another leg's exact directed key; or any inherited
 * V1–V4 route/date/visit-time invariant fails.
 */
export function parseStoredDraft(raw: unknown): ManualPlanningDraftV5 | null {
  if (!isPlainObject(raw)) return null;

  if (raw.version !== PLANNING_DRAFT_VERSION) {
    const older = parseStoredDraftV4(raw);
    return older ? migrateV4ToV5(older) : null;
  }

  let days: PlanningDayV5[] | null;
  if (raw.days === null) {
    days = null;
  } else if (Array.isArray(raw.days)) {
    days = [];
    for (const value of raw.days) {
      const day = parsePlanningDay(value);
      if (!day) return null;
      days.push(day);
    }
    if (new Set(days.map((day) => day.id)).size !== days.length) return null;
  } else {
    return null;
  }

  // Everything V5 inherits unchanged is validated by the historical parser, fed the PROJECTED
  // ordinal matrix — the same `string[][]` every downstream consumer sees, never the day entities.
  const base = parseStoredDraftV3({
    version: 3,
    routeIds: raw.routeIds,
    days: dayMatrixFromPlanningDays(days),
    startDate: raw.startDate,
    visitStartTimes: raw.visitStartTimes,
  });
  if (!base) return null;

  if (base.days !== null && !validateDayPartition(base.routeIds, base.days).valid) return null;

  if (!Array.isArray(raw.accommodations) || !Array.isArray(raw.accommodationLegs)) return null;
  const accommodations: AccommodationAnchor[] = [];
  for (const value of raw.accommodations) {
    const anchor = parseAccommodationAnchor(value);
    if (!anchor) return null;
    accommodations.push(anchor);
  }
  if (!hasUniqueAccommodationIds(accommodations)) return null;
  const accommodationIds = new Set(accommodations.map((anchor) => anchor.id));

  for (const day of days ?? []) {
    const { start, end } = day.accommodationBoundary;
    if (day.placeIds.length === 0 && (start.kind !== "unselected" || end.kind !== "unselected")) return null;
    for (const choice of [start, end]) {
      if (choice.kind === "accommodation" && !accommodationIds.has(choice.accommodationId)) return null;
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
    days,
    startDate: base.startDate,
    visitStartTimes: base.visitStartTimes,
    accommodations,
    accommodationLegs,
  };
}

export function freshDraft(savedIds: readonly string[]): ManualPlanningDraftV5 {
  return migrateV4ToV5(freshDraftV4(savedIds));
}

function pruneLegs(legs: readonly ManualAccommodationLeg[], routeIds: readonly string[]): ManualAccommodationLeg[] {
  const routeSet = new Set(routeIds);
  return legs.filter((leg) => routeSet.has(leg.placeId));
}

/**
 * Rebuilds day entities after a place-level edit, preserving identity by construction: each entity
 * keeps its own id and its own boundary, and the ONLY thing that changes is `placeIds`. The single
 * boundary rule applied here is Phase 3D-R §8.3 — a day that is now empty has no first or last
 * place, so both sides reset to `unselected` immediately. That reset is permanent state, not a
 * hidden stash: repopulating the same day id later leaves it `unselected`.
 */
function withDayPlaceIds(days: readonly PlanningDayV5[], next: ReadonlyMap<string, string[]>): PlanningDayV5[] {
  return days.map((day) => {
    const placeIds = next.get(day.id) ?? day.placeIds;
    return {
      id: day.id,
      placeIds: [...placeIds],
      accommodationBoundary:
        placeIds.length === 0 ? unselectedBoundary() : cloneBoundary(day.accommodationBoundary),
    };
  });
}

/**
 * Reconciles an already shape-valid stored draft against the CURRENT saved ids. The historical
 * rule decides the outcome for route/days/times unchanged: a stale place is pruned from the route
 * and from every day that held it, and if the pruned partition no longer validates, `days` becomes
 * `null` outright rather than being patched.
 *
 * Identity survives pruning because pruning is an edit to a day entity, not a replacement of it:
 * the surviving days are matched BY ID (they are literally the same entities, in the same order),
 * never by content similarity, and each keeps its own boundary unless the prune emptied it — the
 * ordinary §8.3 empty-day reset. When the partition dies, so does every day id with it, exactly as
 * §10 requires.
 */
export function reconcileDraft(stored: ManualPlanningDraftV5, savedIds: readonly string[]): ManualPlanningDraftV5 {
  const reconciledBase = reconcileDraftV3(v3View(stored), savedIds);
  let days: PlanningDayV5[] | null;
  if (reconciledBase.days === null || stored.days === null) {
    days = null;
  } else {
    // `reconcileDraftV3` prunes in place: it never adds, removes or reorders a bucket, so index
    // `i` of its result is the pruned content of the SAME entity at index `i` here.
    const pruned = new Map(stored.days.map((day, index) => [day.id, reconciledBase.days![index] ?? []]));
    days = withDayPlaceIds(stored.days, pruned);
  }
  return {
    version: PLANNING_DRAFT_VERSION,
    routeIds: reconciledBase.routeIds,
    days,
    startDate: reconciledBase.startDate,
    visitStartTimes: reconciledBase.visitStartTimes,
    accommodations: stored.accommodations,
    accommodationLegs: pruneLegs(stored.accommodationLegs, reconciledBase.routeIds),
  };
}

export function loadReconciledDraft(storage: DraftStorage, savedIds: readonly string[]): ManualPlanningDraftV5 {
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

export function writeDraft(storage: DraftStorage, draft: ManualPlanningDraftV5): void {
  try {
    storage.setItem(PLANNING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — preserve in-memory state */
  }
}

/**
 * Applies a new route. The historical rule decides the fate of `days` exactly as before: a pure
 * reorder of the same id set retains the day assignment, any composition change invalidates it.
 *
 * Because a retained assignment is by definition the very same day entities (the matrix is
 * element-for-element identical — asserted here against the actual matrices rather than assumed),
 * every id and every boundary is preserved untouched. A composition change sets `days: null`, and
 * every day identity and embedded boundary disappears with the invalidated assignment (§10) — this
 * phase never tries to reuse or re-match an old day afterwards.
 *
 * Anchors always survive: they are trip-scoped decisions, not route-scoped ones. Manual legs are
 * endpoint-keyed, so a pure reorder keeps every one; a composition change prunes exactly the legs
 * whose place left the route, and never rebinds one to another place or anchor.
 */
export function withRoute(draft: ManualPlanningDraftV5, routeIds: readonly string[]): ManualPlanningDraftV5 {
  const base = withRouteV3(v3View(draft), routeIds);
  const retained = base.days !== null && sameDayMatrix(dayMatrixFromPlanningDays(draft.days), base.days);
  return {
    ...draft,
    version: PLANNING_DRAFT_VERSION,
    routeIds: base.routeIds,
    days: retained ? cloneDays(draft.days) : null,
    startDate: base.startDate,
    visitStartTimes: base.visitStartTimes,
    accommodationLegs: pruneLegs(draft.accommodationLegs, base.routeIds),
  };
}

/**
 * The compatibility bulk setter, and the single hardest rule in this phase (corrective addendum,
 * Finding 1). A raw `string[][]` does not carry enough information to prove whether the user edited
 * existing day entities, deleted and recreated all of them, inserted one, moved one place between
 * two, or some combination — so it gets exactly two behaviours and no third:
 *
 * 1. **Element-for-element identical matrix** → the existing day entities, ids and boundaries are
 *    preserved exactly.
 * 2. **Any non-identical matrix** → the operation is REJECTED and the draft is returned unchanged.
 *
 * It never carries ids by index, matches by equal/similar contents, matches by endpoints/date/
 * hotel/score, regenerates every id as a fallback, or partially applies. Minting all-new ids would
 * invent the lifecycle interpretation "all old days were deleted and all incoming buckets are new",
 * which the caller never actually provided; that is why even that conservative-looking fallback is
 * forbidden here.
 *
 * Real edits go through the identity-aware mutations below. Establishing a FIRST assignment where
 * none exists is not an edit and has no identity to preserve — see {@link withInitialDays}.
 */
export function withDays(
  draft: ManualPlanningDraftV5,
  days: readonly (readonly string[])[]
): ManualPlanningDraftV5 {
  // Both branches return the draft untouched, and that is the whole point rather than an oversight:
  // for an identical matrix "preserve every current entity, id and boundary" IS the stored draft,
  // and for anything else the only permitted outcome is rejection. Written as two explicit branches
  // so the identical case can never quietly grow a rebuild that reassigns ids.
  if (sameDayMatrix(dayMatrixFromPlanningDays(draft.days), days)) return draft;
  return draft;
}

/**
 * Creates the FIRST day assignment for a draft that has none (`days === null`: never split, or
 * invalidated by a route composition change). This is not the bulk setter in disguise: there are no
 * existing day entities, so there is no identity to carry, match or invent — every bucket mints a
 * fresh opaque id and starts `unselected`.
 *
 * Rejected outright (draft returned unchanged) when `days` is already non-null, when the proposed
 * matrix does not partition `routeIds`, or when a unique id cannot be minted for every bucket — a
 * failure can never half-apply.
 */
export function withInitialDays(
  draft: ManualPlanningDraftV5,
  days: readonly (readonly string[])[],
  idFactory: () => string
): ManualPlanningDraftV5 {
  if (draft.days !== null) return draft;
  if (!validateDayPartition(draft.routeIds, days).valid) return draft;

  const minted: PlanningDayV5[] = [];
  const usedIds: string[] = [];
  for (const placeIds of days) {
    const id = createDayId(usedIds, idFactory);
    if (id === null) return draft;
    usedIds.push(id);
    minted.push({ id, placeIds: [...placeIds], accommodationBoundary: unselectedBoundary() });
  }
  return { ...draft, days: minted };
}

export function withStartDate(draft: ManualPlanningDraftV5, startDate: string | null): ManualPlanningDraftV5 {
  const base = withStartDateV3(v3View(draft), startDate);
  if (base.startDate === draft.startDate) return draft;
  return { ...draft, startDate: base.startDate };
}

export function withVisitStartTime(
  draft: ManualPlanningDraftV5,
  placeId: string,
  time: string | null
): ManualPlanningDraftV5 {
  const base = withVisitStartTimeV3(v3View(draft), placeId, time);
  if (base.visitStartTimes === draft.visitStartTimes) return draft;
  return { ...draft, visitStartTimes: base.visitStartTimes };
}

/**
 * Draws a DAY id from `idFactory` until it yields a non-empty id that is not already in use, or
 * gives up after `maxAttempts` and returns `null` — the same collision-safe pattern Phase 3D-Q
 * already uses for accommodation ids.
 *
 * The id is opaque: it is never derived from a date, an array index, a place id, an accommodation,
 * a coordinate, or anything else in the day's content. The factory is injected rather than
 * hard-coded so the browser API behind it (`crypto.randomUUID` in `usePlanningDraft.ts`) never has
 * to be stubbed in tests, and so a collision fails safely instead of overwriting an existing day.
 */
export function createDayId(
  existingIds: readonly string[],
  idFactory: () => string,
  maxAttempts = 8
): string | null {
  return createOpaqueId(existingIds, idFactory, maxAttempts);
}

/** The shared collision-safe draw behind both {@link createDayId} and
 * {@link createAccommodationId}: retry a bounded number of times, then fail safely with `null`
 * rather than overwrite an existing entity or fall back to a derived id. */
function createOpaqueId(
  existingIds: readonly string[],
  idFactory: () => string,
  maxAttempts: number
): string | null {
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const id = idFactory();
    if (typeof id === "string" && id.length > 0 && !existing.has(id)) return id;
  }
  return null;
}

function findDayIndex(days: readonly PlanningDayV5[] | null, dayId: string): number {
  return days ? days.findIndex((day) => day.id === dayId) : -1;
}

/**
 * Reorders ONE place inside ONE identified day. The day id survives, the accommodation boundary
 * choices survive, and the stored manual legs survive untouched — only `placeIds` changes.
 *
 * The derived first/last endpoints are recomputed from the new order on read. If the endpoint moved
 * and no EXACT manual leg exists for the new directed key, the result is `manual-leg-missing`; an
 * old leg is never rebound to the new endpoint and never reused as a duration for it. A leg whose
 * endpoint no longer matches simply sits unused, still persisted (§8.1).
 *
 * A no-op move (off either end of the list, an unknown day id, an out-of-range place index) returns
 * the draft unchanged.
 */
export function withPlaceMovedWithinDay(
  draft: ManualPlanningDraftV5,
  dayId: string,
  placeIndex: number,
  direction: -1 | 1
): ManualPlanningDraftV5 {
  const dayIndex = findDayIndex(draft.days, dayId);
  if (!draft.days || dayIndex === -1) return draft;
  const day = draft.days[dayIndex];
  const targetIndex = placeIndex + direction;
  if (!Number.isInteger(placeIndex) || placeIndex < 0 || placeIndex >= day.placeIds.length) return draft;
  if (targetIndex < 0 || targetIndex >= day.placeIds.length) return draft;

  const placeIds = [...day.placeIds];
  [placeIds[placeIndex], placeIds[targetIndex]] = [placeIds[targetIndex], placeIds[placeIndex]];
  return { ...draft, days: withDayPlaceIds(draft.days, new Map([[dayId, placeIds]])) };
}

/**
 * Moves ONE place from one identified day to another identified day, appending it to the end of the
 * target day's explicit order and reordering nothing else in either day.
 *
 * Both day ids survive. Each day's boundary survives as long as that day remains non-empty; a
 * source day left empty resets both of its sides to `unselected` (§8.3) while keeping its id as an
 * empty bucket — never converted to `no-accommodation`, and with no hidden previous choice stashed
 * for later restoration. Manual legs survive untouched because their identity is the exact directed
 * endpoint pair, not an ordinal day: each day's boundary result is recomputed from its NEW first/
 * last place, and a missing exact key yields `manual-leg-missing`, never a reused old duration.
 *
 * This is the principal product benefit of the phase — the user's hotel choice can survive an
 * ordinary edit while the endpoint evidence stays exact and conservative.
 *
 * Rejected (draft unchanged) for an unknown source or target day id, the same day on both sides, an
 * out-of-range place index, or a result that would not partition `routeIds`.
 */
export function withPlaceMovedBetweenDays(
  draft: ManualPlanningDraftV5,
  fromDayId: string,
  toDayId: string,
  placeIndex: number
): ManualPlanningDraftV5 {
  if (fromDayId === toDayId) return draft;
  const fromIndex = findDayIndex(draft.days, fromDayId);
  const toIndex = findDayIndex(draft.days, toDayId);
  if (!draft.days || fromIndex === -1 || toIndex === -1) return draft;

  const fromDay = draft.days[fromIndex];
  const toDay = draft.days[toIndex];
  if (!Number.isInteger(placeIndex) || placeIndex < 0 || placeIndex >= fromDay.placeIds.length) return draft;

  const placeId = fromDay.placeIds[placeIndex];
  const nextFrom = fromDay.placeIds.filter((_, index) => index !== placeIndex);
  const nextTo = [...toDay.placeIds, placeId];
  const days = withDayPlaceIds(
    draft.days,
    new Map([
      [fromDayId, nextFrom],
      [toDayId, nextTo],
    ])
  );
  if (!validateDayPartition(draft.routeIds, dayMatrixFromPlanningDays(days) ?? []).valid) return draft;
  return { ...draft, days };
}

/**
 * Appends ONE new empty day. It gets a fresh opaque id from the injected factory, `placeIds: []`,
 * and both boundary sides `unselected` — no accommodation is inferred for it and no date is stored
 * inside it (§8.4). Only the new day starts unselected; every existing day keeps its id, its places
 * and its boundary exactly.
 *
 * Returns the draft unchanged when there is no day assignment yet, or when no unique id could be
 * minted — never overwriting an existing day's id.
 */
export function withNewEmptyDay(draft: ManualPlanningDraftV5, idFactory: () => string): ManualPlanningDraftV5 {
  if (!draft.days) return draft;
  const id = createDayId(
    draft.days.map((day) => day.id),
    idFactory
  );
  if (id === null) return draft;
  return {
    ...draft,
    days: [...cloneDays(draft.days)!, { id, placeIds: [], accommodationBoundary: unselectedBoundary() }],
  };
}

/**
 * Deletes ONE empty day entity, and only that entity: its id and its necessarily-`unselected`
 * boundary go, and nothing else does. Accommodation anchors, endpoint-keyed manual legs, visit
 * start times, the start date and every other day (id, places and boundary alike) are untouched
 * (§8.5).
 *
 * Rejected (draft unchanged) for an unknown day id, a day that still holds places — only an empty
 * day is deletable under the current UI contract — and for the last remaining day, since `days: []`
 * would violate the domain's own `"no-days"` partition invariant.
 */
export function withoutEmptyDay(draft: ManualPlanningDraftV5, dayId: string): ManualPlanningDraftV5 {
  const dayIndex = findDayIndex(draft.days, dayId);
  if (!draft.days || dayIndex === -1) return draft;
  if (draft.days.length <= 1) return draft;
  if (draft.days[dayIndex].placeIds.length > 0) return draft;
  return { ...draft, days: draft.days.filter((day) => day.id !== dayId).map(cloneDay) };
}

/**
 * Draws an accommodation id from `idFactory` until it yields a non-empty id that is not already in
 * use, or gives up after `maxAttempts` and returns `null`. The id carries no geographic, chain,
 * quality, priority or booking meaning — it exists only so two anchors the user considers different
 * stay different.
 */
export function createAccommodationId(
  existingIds: readonly string[],
  idFactory: () => string,
  maxAttempts = 8
): string | null {
  return createOpaqueId(existingIds, idFactory, maxAttempts);
}

/**
 * Adds one anchor. Rejected outright (the draft is returned unchanged) for an empty id, an id
 * already in use, a label that is blank once trimmed, or a coordinate outside the ordinary
 * geographic ranges — never coerced, never renamed, never given a generated label or a default pin.
 *
 * Two anchors with the same label and/or the same coordinates are kept as two distinct anchors:
 * only the id decides identity, and nothing here merges, ranks, or reorders them.
 */
export function withAccommodation(
  draft: ManualPlanningDraftV5,
  anchor: AccommodationAnchor
): ManualPlanningDraftV5 {
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
 * {@link withAccommodation} rejects the anchor, so a failure can never half-apply. The label is
 * stored trimmed exactly as typed and is never geocoded.
 */
export function withNewAccommodation(
  draft: ManualPlanningDraftV5,
  label: string,
  location: { lat: number; lng: number },
  idFactory: () => string
): ManualPlanningDraftV5 {
  const id = createAccommodationId(
    draft.accommodations.map((anchor) => anchor.id),
    idFactory
  );
  if (id === null) return draft;
  return withAccommodation(draft, { id, label: label.trim(), location });
}

/**
 * Deletes one anchor. Its manual legs are removed with it, and every boundary choice that
 * referenced it becomes `{ kind: "unselected" }` — never another anchor and never
 * `no-accommodation`, which is a positive statement the user alone makes. Day ids, day contents and
 * boundary choices pointing at other anchors are left exactly as they are.
 */
export function withoutAccommodation(draft: ManualPlanningDraftV5, accommodationId: string): ManualPlanningDraftV5 {
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
    days:
      draft.days?.map((day) => ({
        id: day.id,
        placeIds: [...day.placeIds],
        accommodationBoundary: {
          start: resetChoice(day.accommodationBoundary.start),
          end: resetChoice(day.accommodationBoundary.end),
        },
      })) ?? null,
    accommodationLegs: draft.accommodationLegs.filter((leg) => leg.accommodationId !== accommodationId),
  };
}

/**
 * Records ONE side of ONE IDENTIFIED day's boundary choice. `unselected`, `no-accommodation` and
 * `accommodation` are three distinct persisted states; this setter never converts between them and
 * never touches the other side or another day.
 *
 * The day is addressed by its stable id rather than by ordinal position, so a choice can no longer
 * land on a different bucket than the one the user was looking at. Rejected outright: an unknown
 * day id, an anchor that does not exist, and an EMPTY day bucket — an empty day has no first or
 * last place, so there is no endpoint a choice could honestly connect to.
 */
export function withDayAccommodationChoice(
  draft: ManualPlanningDraftV5,
  dayId: string,
  side: "start" | "end",
  choice: AccommodationBoundaryChoice
): ManualPlanningDraftV5 {
  const dayIndex = findDayIndex(draft.days, dayId);
  if (!draft.days || dayIndex === -1) return draft;
  if (draft.days[dayIndex].placeIds.length === 0) return draft;
  if (choice.kind === "accommodation" && !draft.accommodations.some((anchor) => anchor.id === choice.accommodationId)) {
    return draft;
  }
  const days = cloneDays(draft.days)!;
  days[dayIndex] = {
    ...days[dayIndex],
    accommodationBoundary: { ...days[dayIndex].accommodationBoundary, [side]: choice },
  };
  return { ...draft, days };
}

/**
 * Sets, replaces, or clears the duration of exactly ONE directed endpoint key
 * `(direction, accommodationId, placeId)`. Day identity is deliberately NOT part of that key —
 * a manual leg is evidence about two endpoints, not about a day.
 *
 * `minutes` must be a positive safe integer; zero, negatives, fractions, `NaN`, infinities and
 * unsafe integers are rejected outright — never rounded, floored, or coerced. An unknown anchor or
 * a place outside the current route is rejected the same way. The write is strictly one-directional
 * and endpoint-exact.
 */
export function withAccommodationLeg(
  draft: ManualPlanningDraftV5,
  direction: ManualAccommodationLeg["direction"],
  accommodationId: string,
  placeId: string,
  minutes: number | null
): ManualPlanningDraftV5 {
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
 * cleared. No day id survives a state in which there is no day assignment (§10), so every day
 * entity and its embedded boundary goes with `days: null`.
 *
 * Anchors survive — resetting the route is not a statement about where the user is staying — and
 * endpoint-keyed manual legs survive for every place still in the rebuilt route, pruned only for
 * places that are no longer saved at all.
 */
export function resetRoute(draft: ManualPlanningDraftV5, savedIds: readonly string[]): ManualPlanningDraftV5 {
  const base = resetRouteV3(v3View(draft), savedIds);
  return {
    ...draft,
    routeIds: base.routeIds,
    days: null,
    startDate: base.startDate,
    visitStartTimes: base.visitStartTimes,
    accommodationLegs: pruneLegs(draft.accommodationLegs, base.routeIds),
  };
}
