import { useCallback, useState } from "react";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  loadReconciledDraft,
  type DraftStorage,
} from "./lib/planning-draft-v8";
import {
  TRAVELLERS_STORAGE_KEY,
  loadTravellersDocument,
  shortlistPlaceIds,
} from "./lib/travellers";
import {
  applyRestore,
  backupFileName,
  buildPortableBackup,
  planRestore,
  readPortableBackup,
  serializePortableBackup,
  summarizeRestore,
  type BackupProblem,
  type RestorePlan,
  type RestoreStorage,
  type RestoreSummary,
} from "./lib/portable-backup";
import { todayCivilDate } from "./lib/today";
import { getAllPlaces } from "./data/store";

/**
 * Block 13 — the impure edge of the portable backup: the clock, storage, and the file.
 *
 * `lib/portable-backup.ts` is pure and knows nothing about browsers. Everything it cannot do lives
 * here and nowhere else: reading the two storage keys, reading the clock for `exportedAt`, handing
 * the browser a Blob to download, and writing on confirmation.
 *
 * **The ordering rule this hook exists to enforce:** `prepareImport` parses, validates, reconciles
 * and summarises, and touches no storage at all. `confirmImport` is the only function here that
 * writes, and it can only be called with a plan `prepareImport` already produced. There is no path
 * from a chosen file to a write that does not pass through a human pressing the second button.
 *
 * Nothing here fetches. The file goes from `localStorage` to a Blob the browser saves, and comes
 * back from a `File` the person picked. No request is made, nothing is uploaded, and there is no
 * telemetry — a backup that could be posted anywhere would stop being a file under their control.
 */

const browserStorage: RestoreStorage & DraftStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

/** A traveller id is only minted when no document exists; an export of a blank browser is valid. */
function randomTravellerId(): string {
  return `t-${Math.random().toString(36).slice(2, 10)}`;
}

export type ImportPreview = {
  plan: RestorePlan;
  summary: RestoreSummary;
  fileName: string;
};

export type ImportState =
  | { phase: "idle" }
  | { phase: "preview"; preview: ImportPreview }
  | { phase: "rejected"; problem: BackupProblem; fileName: string }
  | { phase: "failed"; rolledBack: boolean }
  | { phase: "restored"; summary: RestoreSummary };

/**
 * Reads the two canonical documents exactly as the app does, so an export is a snapshot of what
 * the app would load — not of what happens to be in storage.
 *
 * The draft is loaded *reconciled against the current shortlist*, which means an export can never
 * carry a route entry for a place nobody wants any more. That is the same reconciliation the
 * planner performs on mount, so the file describes the trip the person actually sees.
 */
function readCanonicalState() {
  const travellers = loadTravellersDocument(browserStorage, randomTravellerId);
  const savedIds = shortlistPlaceIds(travellers);
  const draft = loadReconciledDraft(browserStorage, savedIds);
  return { travellers, draft };
}

export function usePortableBackup() {
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });

  /**
   * Builds the file and hands it to the browser.
   *
   * `URL.createObjectURL` + a synthetic click is the standard way to save a generated file without
   * a dependency, and the object URL is revoked immediately afterwards so nothing is left holding
   * the blob. `exportedAt` is the one clock read in this feature.
   */
  const exportBackup = useCallback((now: Date = new Date()): string => {
    const { travellers, draft } = readCanonicalState();
    const backup = buildPortableBackup(travellers, draft, now.toISOString());
    const text = serializePortableBackup(backup);
    const fileName = backupFileName(todayCivilDate(now));

    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    // The anchor is attached before clicking on purpose: a detached anchor's synthetic click is
    // ignored by some browsers, notably on iOS.
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Block 14. The revoke is DEFERRED rather than immediate, and that is the one line in this
    // feature written for a browser this repository cannot run. Revoking synchronously right after
    // `click()` is a pattern Chromium tolerates — it is what shipped in Block 13 and what 226
    // passing checks exercise — but Safari has historically cancelled a download whose object URL
    // disappears in the same task. Deferring to a macrotask is correct everywhere and removes a
    // known-fragile dependency on one engine's timing before the iPhone test this repo still owes.
    // Not a measured failure; a measured *risk*, recorded as such in the Block 14 findings.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return fileName;
  }, []);

  /**
   * Parses and validates a chosen file, and produces a preview. **Writes nothing.**
   *
   * Every failure before this returns leaves storage untouched by construction: the only call that
   * can write is `confirmImport`, and it needs a plan that only this function produces.
   */
  const prepareImport = useCallback(async (file: File): Promise<void> => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportState({ phase: "rejected", problem: { kind: "not-json" }, fileName: file.name });
      return;
    }
    const result = readPortableBackup(text);
    if (!result.ok) {
      setImportState({ phase: "rejected", problem: result.problem, fileName: file.name });
      return;
    }
    const plan = planRestore(
      result.backup,
      getAllPlaces().map((place) => place.id)
    );
    setImportState({
      phase: "preview",
      preview: { plan, summary: summarizeRestore(plan), fileName: file.name },
    });
  }, []);

  /** The only writer. Replaces; never merges. */
  const confirmImport = useCallback((plan: RestorePlan): void => {
    const outcome = applyRestore(browserStorage, plan);
    if (!outcome.ok) {
      setImportState({ phase: "failed", rolledBack: outcome.rolledBack });
      return;
    }
    setImportState({ phase: "restored", summary: summarizeRestore(plan) });
  }, []);

  const resetImport = useCallback(() => setImportState({ phase: "idle" }), []);

  /**
   * Reloads the app after a successful restore. **Not cosmetic — it is required for correctness.**
   *
   * `useTravellers` and `usePlanningDraft` hold their documents in React state and write them back
   * whenever that state changes. A restore replaces the two storage keys underneath them, so until
   * the app re-reads storage its in-memory copies are the *previous* trip — and the next heart
   * pressed would write that stale copy straight over everything just imported, destroying it
   * silently. Re-reading from storage is exactly what a load does, so the restore ends with one.
   *
   * This is why the confirmation screen's only way out is this call: leaving the person inside a
   * restored-but-not-reloaded app would be leaving a trap open.
   */
  const finishRestore = useCallback(() => {
    window.location.reload();
  }, []);

  return {
    importState,
    exportBackup,
    prepareImport,
    confirmImport,
    resetImport,
    finishRestore,
  };
}

export { PLANNING_DRAFT_STORAGE_KEY, TRAVELLERS_STORAGE_KEY };
