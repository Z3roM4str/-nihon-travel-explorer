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
import { deviceStorage } from "./lib/device-storage";
import {
  copyOriginals,
  isProtectedStatus,
  notifyStorageReplaced,
  readStoredDraft,
  readStoredTravellers,
  refreshProtection,
} from "./lib/stored-document";

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

/* DDR-03: el adaptador compartido de `lib/device-storage.ts`. Misma forma estructural que el
   `browserStorage` local que sustituye —así que nada de este módulo cambia—, con una diferencia:
   registra el resultado de cada escritura en la única fuente de verdad del estado de persistencia
   y vuelve a lanzar el error, de modo que el `try/catch` de abajo sigue atrapando lo mismo. */
const browserStorage: RestoreStorage & DraftStorage = deviceStorage;

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
    // Auditoría final (H04): si lo que hay guardado es inválido o de una versión futura, es lo
    // único que esa persona tiene de su viaje anterior. «Sustituir» es una decisión explícita, pero
    // no debe borrarlo sin dejar copia: se guarda aparte ANTES de escribir, y si la copia falla no
    // se toca nada.
    const needsCopy =
      isProtectedStatus(readStoredTravellers(browserStorage, () => "unused").status) ||
      isProtectedStatus(readStoredDraft(browserStorage).status);
    if (needsCopy && !copyOriginals(browserStorage, new Date().toISOString().replace(/[:.]/g, "-")).ok) {
      setImportState({ phase: "failed", rolledBack: true });
      return;
    }
    const outcome = applyRestore(browserStorage, plan);
    if (!outcome.ok) {
      setImportState({ phase: "failed", rolledBack: outcome.rolledBack });
      return;
    }
    // Auditoría final (H01): los hooks montados siguen teniendo en memoria el viaje ANTERIOR. Se les
    // avisa ahora —no al pulsar «Continuar»— para que relean y rendericen lo restaurado, y cada
    // mutación posterior parte además del documento vigente (`useStoredDocument`).
    refreshProtection(browserStorage);
    notifyStorageReplaced();
    setImportState({ phase: "restored", summary: summarizeRestore(plan) });
  }, []);

  const resetImport = useCallback(() => setImportState({ phase: "idle" }), []);

  /**
   * Reloads the app after a successful restore — a clean exit, no longer what protects the data.
   *
   * **Historia (Block 13).** `useTravellers` and `usePlanningDraft` held their documents in React
   * state and wrote them back whenever it changed, so a restore that replaced the two storage keys
   * underneath them left the *previous* trip in memory and the next heart pressed wrote that stale
   * copy over everything just imported. The reload was the only defence, which is why the
   * confirmation screen's way out was this call.
   *
   * **Auditoría final (H01).** That defence failed: navigating away WITHOUT pressing «Continuar»
   * (the tab bar stays live) still reached the stale state. Now `confirmImport` tells the mounted
   * hooks to re-read (`notifyStorageReplaced`) and every mutation starts from the current stored
   * document (`useStoredDocument`), so nothing depends on this reload having happened.
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
