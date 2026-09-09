import { useCallback, useEffect, useState } from "react";
import type {
  AccommodationBoundaryChoice,
  ManualAccommodationLeg,
} from "./lib/accommodation-commute";
import {
  loadReconciledDraft,
  reconcileDraft,
  resetRoute as resetRouteInDraft,
  withAccommodationLeg,
  withDayAccommodationChoice,
  withDays,
  withNewAccommodation,
  withRoute,
  withStartDate,
  withVisitStartTime,
  withoutAccommodation,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV4,
} from "./lib/planning-draft-v4";

/** The real browser `localStorage`, wrapped to the minimal shape `planning-draft-v4.ts` depends
 * on — mirrors `useSavedPlaces.ts`'s own direct `localStorage` use. Tests exercise the pure
 * `planning-draft-v4.ts` functions directly with an in-memory `DraftStorage` instead. */
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

/** Same `Dispatch<SetStateAction<T>>` shape React's own `useState` setter has, so every existing
 * caller that already updates route/day state functionally (`setX((prev) => ...)`) keeps working
 * unchanged after switching from a plain `useState` to this hook. */
type SetStateAction<T> = T | ((previous: T) => T);

function resolve<T>(action: SetStateAction<T>, previous: T): T {
  return typeof action === "function" ? (action as (previous: T) => T)(previous) : action;
}

/**
 * Phase 3C-D — Persisted Manual Planning Draft: the thin React integration over
 * `lib/planning-draft-v4.ts`. Loads and reconciles the stored draft once per mount (the same
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
 * **Phase 3D-Q makes `ManualPlanningDraftV4` the canonical runtime draft**, under the same
 * `nihon.manualPlanningDraft` key as before — there is no second key and no parallel V3 state; a
 * V1/V2/V3 value already in storage still loads through the historical migration chain. The three
 * accommodation fields follow exactly the rule above: `accommodations`,
 * `dayAccommodationBoundaries` and `accommodationLegs` are returned straight from the draft and
 * every mutation goes back through the pure module, so no component ever holds a second copy of an
 * anchor, a boundary choice, or a manual duration.
 *
 * Nothing accommodation-related is derived here. This hook never geocodes a label, never reads an
 * anchor's coordinates for arithmetic, never picks a default anchor for a day, never reverses a
 * directed leg, and never calls a routing or booking service — every value it stores is one the
 * user typed or chose, and every rejection (`withAccommodationLeg` on a fractional minute,
 * `withDayAccommodationChoice` on an empty day) leaves the draft untouched rather than coercing it.
 */
export function usePlanningDraft(savedIds: readonly string[]) {
  const [draft, setDraft] = useState<ManualPlanningDraftV4>(() =>
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

  const setDays = useCallback((action: SetStateAction<string[][]>) => {
    setDraft((current) => withDays(current, resolve(action, current.days ?? [])));
  }, []);

  /** Phase 3C-E: sets, changes, or clears the manual calendar anchor for "Día 1". Accepts a
   * plain `YYYY-MM-DD` string or `null`; an invalid string is rejected by `withStartDate`
   * (the draft stays unchanged), never coerced or guessed. Phase 3D-Q: changing it never touches
   * an accommodation anchor, a day boundary choice, or a manual leg — they are independent axes. */
  const setStartDate = useCallback((startDate: string | null) => {
    setDraft((current) => withStartDate(current, startDate));
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
    (dayIndex: number, side: "start" | "end", choice: AccommodationBoundaryChoice) => {
      setDraft((current) => withDayAccommodationChoice(current, dayIndex, side, choice));
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

  return {
    routeIds: draft.routeIds,
    days: draft.days,
    startDate: draft.startDate,
    visitStartTimes: draft.visitStartTimes,
    accommodations: draft.accommodations,
    dayAccommodationBoundaries: draft.dayAccommodationBoundaries,
    accommodationLegs: draft.accommodationLegs,
    setRoute,
    setDays,
    setStartDate,
    setVisitStartTime,
    addAccommodation,
    removeAccommodation,
    setDayAccommodationChoice,
    setAccommodationLeg,
    resetRoute,
  };
}
