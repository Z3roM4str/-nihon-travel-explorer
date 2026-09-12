import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AccommodationBoundaryChoice,
  ManualAccommodationLeg,
} from "./lib/accommodation-commute";
import type {
  InterHubMode,
  NewManualInterHubSegment,
} from "./lib/inter-hub-segment";
import {
  dayMatrixFromPlanningDays,
  loadReconciledDraft,
  reconcileDraft,
  resetRoute as resetRouteInDraft,
  withAccommodationLeg,
  withDayAccommodationChoice,
  withDayMoved,
  withInitialDays,
  withInterHubSegmentDetails,
  withNewAccommodation,
  withNewEmptyDay,
  withNewInterHubSegment,
  withPlaceMovedBetweenDays,
  withPlaceMovedWithinDay,
  withPlaceRelocatedWithinDay,
  withPlacesTransposedWithinDay,
  withFourPlacesReversedWithinDay,
  withEndDate,
  withRoute,
  withStartDate,
  withVisitStartTime,
  withoutAccommodation,
  withoutEmptyDay,
  withoutInterHubSegment,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV7,
} from "./lib/planning-draft-v7";

/** The real browser `localStorage`, wrapped to the minimal shape `planning-draft-v7.ts` depends
 * on — mirrors `useSavedPlaces.ts`'s own direct `localStorage` use. Tests exercise the pure
 * `planning-draft-v7.ts` functions directly with an in-memory `DraftStorage` instead. */
const browserStorage: DraftStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

/**
 * Phase 3D-Q: the local id minted for a newly created accommodation anchor. It is an OPAQUE
 * identifier and nothing else — it encodes no location, no hotel chain, no quality, no priority,
 * no ordering and no booking reference; two anchors the user considers different simply need two
 * different strings.
 *
 * Injected into `withNewAccommodation` rather than called inside it, so the pure module stays
 * testable without stubbing a browser API, and so a collision fails safely (`createAccommodationId`
 * gives up and the draft is returned unchanged) instead of overwriting an existing anchor.
 */
function randomAccommodationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `acc-${crypto.randomUUID()}`;
  }
  return `acc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Phase 3D-S: the local id minted for a newly created day bucket, on exactly the same terms as
 * `randomAccommodationId` above. It is OPAQUE and nothing else — it encodes no ordinal position,
 * no date, no weekday, no city or hub, no accommodation, no first/last place, no place count, no
 * route quality and no priority. Its only job is to say "this is still the same user-authored day"
 * across ordinary edits.
 *
 * Corrective pass (post-3D-S hostile review): every branch here — including the non-`randomUUID`
 * fallbacks — must stay free of creation-time/date signal. `crypto.getRandomValues` is the second
 * choice when `randomUUID` is unavailable; the last-resort branch draws from `Math.random()` alone
 * and deliberately never reads the clock (no `Date.now()`), so a day id still encodes no creation
 * time even on that path.
 *
 * Injected into the pure mutations rather than called inside them, so `planning-draft-v5.ts` stays
 * testable with a deterministic factory instead of stubbing a browser API, and so a collision fails
 * safely (`createDayId` gives up and the draft is returned unchanged) instead of overwriting an
 * existing day.
 */
function randomDayId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `day-${crypto.randomUUID()}`;
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `day-${hex}`;
  }
  return `day-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Opaque inter-hub segment id, with no anchor, hub, mode, duration, ordinal or clock payload. */
function randomInterHubSegmentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Same `Dispatch<SetStateAction<T>>` shape React's own `useState` setter has, so every existing
 * caller that already updates route/day state functionally (`setX((prev) => ...)`) keeps working
 * unchanged after switching from a plain `useState` to this hook. */
type SetStateAction<T> = T | ((previous: T) => T);

function resolve<T>(action: SetStateAction<T>, previous: T): T {
  return typeof action === "function" ? (action as (previous: T) => T)(previous) : action;
}

/**
 * Phase 3C-D — Persisted Manual Planning Draft: the thin React integration over
 * `lib/planning-draft-v5.ts`. Loads and reconciles the stored draft once per mount (the same
 * "conditionally rendered, so a fresh mount is exactly the builder opening" lifecycle
 * `OrderedSequenceBuilder` already relied on for its formerly-ephemeral state), re-reconciles
 * whenever the caller's `savedIds` actually changes, and writes the draft back on every update.
 *
 * `routeIds`/`days` here are the single canonical source of that state — `OrderedSequenceBuilder`
 * no longer keeps a second copy in its own `useState`, so there is nothing for this hook's
 * persisted state and the component's rendered state to disagree about. Phase 3D-L's
 * `visitStartTimes` joins them on exactly the same terms: the map returned here is the only copy,
 * and the component renders from it rather than mirroring it into local state.
 *
 * **Phase 3D-Y makes `ManualPlanningDraftV7` the canonical runtime draft**, under the same
 * `nihon.manualPlanningDraft` key as before — there is no second key, no second day-id store, no
 * side-car inter-hub record, and no parallel legacy state; a V1–V6 value already in storage still
 * loads through the historical migration chain and is migrated once (V6 → V7 adds
 * `interHubSegments: []` and nothing else). `accommodations` and `accommodationLegs` are returned
 * straight from the draft and every mutation goes back through the pure module, so no component
 * ever holds a second copy of an anchor, a boundary choice, or a manual duration.
 *
 * **Phase 3D-S splits the day state into two deliberately unequal views.** `planningDays` is the
 * persisted identity view — day entities carrying an opaque stable id and that day's own
 * accommodation boundary — and it exists only to address identity-aware mutations and to read each
 * day's own choice. `days` is the ORDINAL PROJECTION (`dayMatrixFromPlanningDays`), and it is the
 * only day value handed to `buildDayAssignment`, `addCivilDays`, weekday signals, reservation
 * evaluation, hours composition and intra-day transfers. No day id ever crosses that line, so
 * changing only an id cannot move a date, a weekday, a reservation result or a transfer. The
 * visible `Día N` label stays derived from array position, and the id stays invisible to the user.
 *
 * Nothing accommodation-related is derived here. This hook never geocodes a label, never reads an
 * anchor's coordinates for arithmetic, never picks a default anchor for a day, never reverses a
 * directed leg, and never calls a routing or booking service — every value it stores is one the
 * user typed or chose, and every rejection (`withAccommodationLeg` on a fractional minute,
 * `withDayAccommodationChoice` on an empty day) leaves the draft untouched rather than coercing it.
 */
export function usePlanningDraft(savedIds: readonly string[]) {
  const [draft, setDraft] = useState<ManualPlanningDraftV7>(() =>
    loadReconciledDraft(browserStorage, savedIds)
  );

  // Defensive, not load-bearing in today's UI: the builder's backdrop blocks interacting with
  // "Quiero ir" while it is open, so `savedIds` should not actually change mid-mount. If that
  // ever stops being true, this re-reconciles the already-loaded draft against the new saved
  // ids — pruning anything now stale, never auto-adding anything newly saved — exactly the same
  // rule the initial load applies, just re-run in memory instead of against storage.
  useEffect(() => {
    setDraft((current) => reconcileDraft(current, savedIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIds]);

  useEffect(() => {
    writeDraft(browserStorage, draft);
  }, [draft]);

  const setRoute = useCallback((action: SetStateAction<string[]>) => {
    setDraft((current) => withRoute(current, resolve(action, current.routeIds)));
  }, []);

  /**
   * Phase 3D-S: creates the FIRST day assignment when none exists yet (`days === null`). It is
   * deliberately NOT a general day setter: a draft that already has day entities is returned
   * unchanged, because a raw `string[][]` cannot say which existing bucket is which without the
   * heuristic matching this phase exists to eliminate. Every real edit goes through the
   * identity-aware mutations below instead.
   */
  const initializeDays = useCallback((days: readonly (readonly string[])[]) => {
    setDraft((current) => withInitialDays(current, days, randomDayId));
  }, []);

  /** Phase 3D-S: reorders one place inside one identified day. The day id, its accommodation
   * boundary and every stored manual leg survive; only the place order changes, and the boundary's
   * endpoint evidence is recomputed from the new first/last place on read. */
  const movePlaceWithinDay = useCallback((dayId: string, placeIndex: number, direction: -1 | 1) => {
    setDraft((current) => withPlaceMovedWithinDay(current, dayId, placeIndex, direction));
  }, []);

  /** Phase 3E-E: commits one place directly to its final index in one identified day. */
  const relocatePlaceWithinDay = useCallback(
    (dayId: string, fromIndex: number, toIndex: number) => {
      setDraft((current) => withPlaceRelocatedWithinDay(current, dayId, fromIndex, toIndex));
    },
    []
  );

  /** Phase 3E-G: one explicit non-adjacent interior transposition, as a single draft update. */
  const transposePlacesWithinDay = useCallback(
    (dayId: string, leftIndex: number, rightIndex: number) => {
      setDraft((current) => withPlacesTransposedWithinDay(current, dayId, leftIndex, rightIndex));
    },
    []
  );

  /** Phase 3E-I: one explicit four-place interior reversal, as a single draft update. */
  const reverseFourPlacesWithinDay = useCallback((dayId: string, windowStartIndex: number) => {
    setDraft((current) => withFourPlacesReversedWithinDay(current, dayId, windowStartIndex));
  }, []);

  /** Phase 3D-S: moves one place from one identified day to another. Both day ids survive, and each
   * day's accommodation choice survives while that day stays non-empty; a day left empty keeps its
   * id but resets both boundary sides to `unselected`, and repopulating it later never resurrects
   * the old choice. */
  const movePlaceBetweenDays = useCallback((fromDayId: string, toDayId: string, placeIndex: number) => {
    setDraft((current) => withPlaceMovedBetweenDays(current, fromDayId, toDayId, placeIndex));
  }, []);

  /** Phase 3D-S: appends one empty day with a fresh opaque id and both boundary sides `unselected`.
   * Only the new day starts unselected; no existing day's id, places or choices are touched. */
  const addEmptyDay = useCallback(() => {
    setDraft((current) => withNewEmptyDay(current, randomDayId));
  }, []);

  /** Phase 3D-S: deletes one empty day entity and nothing else — anchors, manual legs, visit start
   * times, the start date and every other day survive untouched. */
  const removeEmptyDay = useCallback((dayId: string) => {
    setDraft((current) => withoutEmptyDay(current, dayId));
  }, []);

  /**
   * Phase 3D-U: moves ONE whole identified day entity one ordinal position up (`-1`) or down
   * (`1`). The id, its `placeIds` (and their internal order), and its accommodation boundary all
   * travel together as a single unit — this never touches any other day, never regenerates an id,
   * and never rebuilds a day through a `string[][]` matrix. A no-op at either boundary, for an
   * unknown day id, or when there is no day assignment yet leaves the draft unchanged. See
   * `withDayMoved` in `lib/planning-draft-v5.ts` for the full contract.
   */
  const moveDay = useCallback((dayId: string, direction: -1 | 1) => {
    setDraft((current) => withDayMoved(current, dayId, direction));
  }, []);

  /** Phase 3C-E: sets, changes, or clears the manual calendar anchor for "Día 1". Accepts a
   * plain `YYYY-MM-DD` string or `null`; an invalid string is rejected by `withStartDate`
   * (the draft stays unchanged), never coerced or guessed. Phase 3D-Q: changing it never touches
   * an accommodation anchor, a day boundary choice, or a manual leg — they are independent axes. */
  const setStartDate = useCallback((startDate: string | null) => {
    setDraft((current) => withStartDate(current, startDate));
  }, []);

  /**
   * Phase 3D-W: sets, changes, or clears the trip's upper civil bound — the last calendar date the
   * user considers part of the trip. Accepts a plain `YYYY-MM-DD` string or `null`; an invalid
   * string is rejected by `withEndDate` (the draft stays unchanged), never coerced or guessed.
   *
   * It goes through the SAME `setDraft(current => ...)` as every other mutation, over the one
   * canonical draft. There is deliberately no second `useState` for the end date, no parallel
   * bounds state, and no derived copy persisted anywhere: `endDate` lives in the draft, and the
   * calendar-day count and the per-day in/out-of-range verdict are derived on read by
   * `lib/trip-bounds.ts` and never stored.
   *
   * Validation is per-field, never cross-field: an end date before the start date, and an end date
   * set while `startDate` is still `null`, are both accepted and stored. Nothing is auto-repaired
   * and no day bucket is created, deleted, reordered or reassigned — see `withEndDate` in
   * `lib/planning-draft-v7.ts` for the full contract.
   */
  const setEndDate = useCallback((endDate: string | null) => {
    setDraft((current) => withEndDate(current, endDate));
  }, []);

  /**
   * Phase 3D-L: sets, replaces, or clears ONE place's manual visit start time. Accepts a plain
   * `HH:mm` string or `null`; an invalid time, or a place id outside the current route, is
   * rejected by `withVisitStartTime` (the draft stays unchanged), never coerced or guessed. No
   * default is ever supplied here or anywhere downstream — an untouched place simply has no entry.
   */
  const setVisitStartTime = useCallback((placeId: string, time: string | null) => {
    setDraft((current) => withVisitStartTime(current, placeId, time));
  }, []);

  /**
   * Phase 3D-Q: creates one accommodation anchor from a user-typed label and a user-entered
   * coordinate. The id is minted locally (see `randomAccommodationId`); a blank label, an
   * out-of-range coordinate, or an id collision that cannot be resolved leaves the draft unchanged.
   * Nothing is looked up: no geocoding, no hotel search, no address parsing.
   */
  const addAccommodation = useCallback((label: string, location: { lat: number; lng: number }) => {
    setDraft((current) => withNewAccommodation(current, label, location, randomAccommodationId));
  }, []);

  /**
   * Phase 3D-Q: deletes one anchor, its manual legs, and every boundary choice that referenced it —
   * those choices become `unselected`, never another anchor and never `no-accommodation`.
   */
  const removeAccommodation = useCallback((accommodationId: string) => {
    setDraft((current) => withoutAccommodation(current, accommodationId));
  }, []);

  /**
   * Phase 3D-Q: records ONE side of ONE day's explicit boundary choice. `unselected`,
   * `no-accommodation` and `accommodation` stay three distinct states; an empty day bucket or an
   * unknown anchor is rejected by `withDayAccommodationChoice` and the draft stays unchanged.
   */
  const setDayAccommodationChoice = useCallback(
    (dayId: string, side: "start" | "end", choice: AccommodationBoundaryChoice) => {
      setDraft((current) => withDayAccommodationChoice(current, dayId, side, choice));
    },
    []
  );

  /**
   * Phase 3D-Q: sets, replaces, or clears the user-entered duration of exactly one directed
   * endpoint key. `minutes` must be a positive safe integer or `null` (clear); anything else, an
   * unknown anchor, or a place outside the route is rejected by `withAccommodationLeg` — never
   * rounded, never coerced, and never applied to the reverse direction or another endpoint.
   */
  const setAccommodationLeg = useCallback(
    (
      direction: ManualAccommodationLeg["direction"],
      accommodationId: string,
      placeId: string,
      minutes: number | null
    ) => {
      setDraft((current) =>
        withAccommodationLeg(current, direction, accommodationId, placeId, minutes)
      );
    },
    []
  );

  /** Creates one explicitly-timed segment from an eligible pair supplied by the planner UI. */
  const addInterHubSegment = useCallback(
    (input: NewManualInterHubSegment) => {
      setDraft((current) => withNewInterHubSegment(current, input, randomInterHubSegmentId));
    },
    []
  );

  /** In-place edits are deliberately limited to the two user-entered facts. */
  const updateInterHubSegment = useCallback(
    (segmentId: string, mode: InterHubMode, minutes: number) => {
      setDraft((current) => withInterHubSegmentDetails(current, segmentId, mode, minutes));
    },
    []
  );

  const removeInterHubSegment = useCallback((segmentId: string) => {
    setDraft((current) => withoutInterHubSegment(current, segmentId));
  }, []);

  /** "Restablecer recorrido": the route becomes the current saved ids in their saved order and
   * the day assignment is cleared — the same starting point as no stored draft at all — but the
   * calendar anchor (if any) is carried forward: see `resetRoute` in `lib/planning-draft-v4.ts`
   * for why resetting the route is not a decision about the trip's start date. Accommodation
   * anchors are carried forward for the same reason; the ordinal-day boundary vector goes with
   * `days`. Never touches "Quiero ir" itself. */
  const resetRoute = useCallback(() => {
    setDraft((current) => resetRouteInDraft(current, savedIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIds]);

  // `planningDays` is the persisted identity view (ids + boundaries), used only to address
  // mutations and to read each day's own boundary. `days` is the ORDINAL PROJECTION and the only
  // thing handed to `buildDayAssignment`, the calendar, weekday signals, reservation evaluation and
  // intra-day transfers — no day id ever crosses that line (corrective addendum, Finding 2).
  const days = useMemo(() => dayMatrixFromPlanningDays(draft.days), [draft.days]);

  return {
    routeIds: draft.routeIds,
    planningDays: draft.days,
    days,
    startDate: draft.startDate,
    endDate: draft.endDate,
    visitStartTimes: draft.visitStartTimes,
    accommodations: draft.accommodations,
    accommodationLegs: draft.accommodationLegs,
    interHubSegments: draft.interHubSegments,
    setRoute,
    initializeDays,
    movePlaceWithinDay,
    relocatePlaceWithinDay,
    transposePlacesWithinDay,
    reverseFourPlacesWithinDay,
    movePlaceBetweenDays,
    addEmptyDay,
    removeEmptyDay,
    moveDay,
    setStartDate,
    setEndDate,
    setVisitStartTime,
    addAccommodation,
    removeAccommodation,
    setDayAccommodationChoice,
    setAccommodationLeg,
    addInterHubSegment,
    updateInterHubSegment,
    removeInterHubSegment,
    resetRoute,
  };
}
