import { parseStoredDraft, PLANNING_DRAFT_STORAGE_KEY } from "../lib/planning-draft-v7";

export type ReadStorage = Pick<Storage, "getItem">;

/** Read-only: it never reconciles or writes the authored V7 draft. */
export function readAuthoredPlanIds(storage: ReadStorage): ReadonlySet<string> {
  try {
    const raw = storage.getItem(PLANNING_DRAFT_STORAGE_KEY);
    if (!raw) return new Set();
    const draft = parseStoredDraft(JSON.parse(raw));
    return new Set(draft?.routeIds ?? []);
  } catch {
    return new Set();
  }
}

export function canRemoveSavedPlace(id: string, storage: ReadStorage): boolean {
  try {
    const raw = storage.getItem(PLANNING_DRAFT_STORAGE_KEY);
    if (!raw) return true;
    const draft = parseStoredDraft(JSON.parse(raw));
    return Boolean(draft) && !draft!.routeIds.includes(id);
  } catch {
    // A draft we cannot safely inspect must never be changed indirectly through saved state.
    return false;
  }
}
