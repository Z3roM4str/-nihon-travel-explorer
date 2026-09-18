import { useMemo } from "react";
import {
  dayAssignedPlaceIds,
  loadReconciledDraft,
  type DraftStorage,
} from "./lib/planning-draft-v8";

/**
 * A deliberately half-implemented `DraftStorage`.
 *
 * `loadReconciledDraft` takes the full interface, so the setter has to exist — and it is a no-op
 * that reaches nothing. Block 6 may not write the shared plan, and making that a property of the
 * object rather than a promise in a comment means no future edit to this file can break it by
 * accident: there is no path from here to `localStorage.setItem`.
 */
const readOnlyDraftStorage: DraftStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: () => {},
};

/**
 * Block 6 — a READ-ONLY snapshot of which places the shared planner has put in a day.
 *
 * ## It is not a second writer, and not a second truth
 *
 * There is exactly one `setItem` path to `nihon.manualPlanningDraft` while the planner is open
 * (`usePlanningDraft`) and one while the zone comparison is open (`useZonePlanChoice`), and
 * Block 4 keeps those two mutually exclusive. This hook adds a **reader** and nothing else: it
 * never writes, never reconciles anything back to storage, and holds no state of its own. Delete
 * it and the planner behaves identically.
 *
 * ## Why it re-reads when the planner closes
 *
 * `usePlanningDraft` persists on every change, so storage is current, but a React snapshot taken
 * in `App` would not know that a day assignment had changed. Rather than polling or subscribing,
 * this follows the lifecycle Block 4 already established and made structural: the planner is the
 * only live writer while it is mounted, so the moment it closes is exactly when the draft has
 * settled. `revision` is bumped there. `savedIds` is a dependency too, because a shortlist change
 * prunes the route through the existing cascade.
 *
 * The read is one `localStorage.getItem` and one `JSON.parse` of a document a few kilobytes long,
 * on a list the reader has just opened.
 */
export function usePlannedPlaceIds(savedIds: readonly string[], revision: number): string[] {
  return useMemo(
    () => dayAssignedPlaceIds(loadReconciledDraft(readOnlyDraftStorage, savedIds)),
    // `revision` is a deliberate cache key, not a value the derivation reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedIds, revision]
  );
}
