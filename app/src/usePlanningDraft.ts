import { useCallback, useEffect, useState } from "react";
import {
  loadReconciledDraft,
  reconcileDraft,
  resetRoute as resetRouteInDraft,
  withDays,
  withRoute,
  withStartDate,
  withVisitStartTime,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV3,
} from "./lib/planning-draft";

/** The real browser `localStorage`, wrapped to the minimal shape `planning-draft.ts` depends
 * on — mirrors `useSavedPlaces.ts`'s own direct `localStorage` use. Tests exercise the pure
 * `planning-draft.ts` functions directly with an in-memory `DraftStorage` instead. */
const browserStorage: DraftStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

/** Same `Dispatch<SetStateAction<T>>` shape React's own `useState` setter has, so every existing
 * caller that already updates route/day state functionally (`setX((prev) => ...)`) keeps working
 * unchanged after switching from a plain `useState` to this hook. */
type SetStateAction<T> = T | ((previous: T) => T);

function resolve<T>(action: SetStateAction<T>, previous: T): T {
  return typeof action === "function" ? (action as (previous: T) => T)(previous) : action;
}

/**
 * Phase 3C-D — Persisted Manual Planning Draft: the thin React integration over
 * `lib/planning-draft.ts`. Loads and reconciles the stored draft once per mount (the same
 * "conditionally rendered, so a fresh mount is exactly the builder opening" lifecycle
 * `OrderedSequenceBuilder` already relied on for its formerly-ephemeral state), re-reconciles
 * whenever the caller's `savedIds` actually changes, and writes the draft back on every update.
 *
 * `routeIds`/`days` here are the single canonical source of that state — `OrderedSequenceBuilder`
 * no longer keeps a second copy in its own `useState`, so there is nothing for this hook's
 * persisted state and the component's rendered state to disagree about. Phase 3D-L's
 * `visitStartTimes` joins them on exactly the same terms: the map returned here is the only copy,
 * and the component renders from it rather than mirroring it into local state.
 */
export function usePlanningDraft(savedIds: readonly string[]) {
  const [draft, setDraft] = useState<ManualPlanningDraftV3>(() =>
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
   * (the draft stays unchanged), never coerced or guessed. */
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

  /** "Restablecer recorrido": the route becomes the current saved ids in their saved order and
   * the day assignment is cleared — the same starting point as no stored draft at all — but the
   * calendar anchor (if any) is carried forward: see `resetRoute` in `lib/planning-draft.ts` for
   * why resetting the route is not a decision about the trip's start date. Never touches
   * "Quiero ir" itself. */
  const resetRoute = useCallback(() => {
    setDraft((current) => resetRouteInDraft(current, savedIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIds]);

  return {
    routeIds: draft.routeIds,
    days: draft.days,
    startDate: draft.startDate,
    visitStartTimes: draft.visitStartTimes,
    setRoute,
    setDays,
    setStartDate,
    setVisitStartTime,
    resetRoute,
  };
}
