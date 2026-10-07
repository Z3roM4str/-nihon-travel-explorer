import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  reconcileDraft,
  type DraftStorage,
} from "./lib/planning-draft-v8";
import {
  TRAVELLERS_STORAGE_KEY,
  freshTravellersDocument,
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
import { clearPersistenceProblem, deviceStorage, getPersistenceState, reportPersistenceProblem, retryPersistence } from "./lib/device-storage";
import { clearPendingCopy, keepPendingCopy, readPendingCopy } from "./lib/persistence-recovery";
import { downloadTextFile } from "./lib/download-file";
import {
  collectOriginals,
  flushAllPendingWrites,
  getProtectionSnapshot,
  serializeOriginals,
  subscribeProtection,
  type ProtectedDocument,
  copyOriginals,
  isProtectedStatus,
  notifyStorageReplaced,
  readStoredDraft,
  readStoredTravellers,
  refreshProtection,
  CANONICAL_KEYS,
  runExclusiveDocuments,
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

/**
 * Resultado de «Exportar respaldo». Con datos PROTEGIDOS (inválidos o de una versión futura) el estado que la app
 * sirve es el inicial, no el viaje conservado: exportarlo sería entregar un respaldo vacío como si fuese el viaje.
 * Con una escritura fallida pendiente, el almacenamiento va por detrás de lo que se ve. En ambos casos NO se
 * descarga el respaldo normal y se explica por qué; la copia de lo conservado se pide aparte.
 */
export type ExportOutcome =
  | { ok: true; fileName: string }
  | { ok: false; reason: "protected" | "unsaved" | "download-failed" };

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
  const travellerRead = readStoredTravellers(browserStorage, randomTravellerId);
  const draftRead = readStoredDraft(browserStorage);
  if (isProtectedStatus(travellerRead.status) || isProtectedStatus(draftRead.status)) return null;
  const travellers = travellerRead.doc ?? freshTravellersDocument(randomTravellerId);
  const draft = draftRead.doc ? reconcileDraft(draftRead.doc, shortlistPlaceIds(travellers)) : null;
  return { travellers, draft };
}

export function usePortableBackup() {
  // Una restauración incompleta no desaparece al recargar: conserva la preimagen y bloquea otra escritura automática.
  const [restoreRecovery] = useState(() => readPendingCopy("restore"));
  useEffect(() => {
    if (restoreRecovery) reportPersistenceProblem("restore", "Una restauración anterior quedó a medias. Se conservan las copias anteriores; vuelve a importar el respaldo cuando puedas guardar.");
  }, [restoreRecovery]);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });

  /**
   * Builds the file and hands it to the browser.
   *
   * `URL.createObjectURL` + a synthetic click is the standard way to save a generated file without
   * a dependency, and the object URL is revoked immediately afterwards so nothing is left holding
   * the blob. `exportedAt` is the one clock read in this feature.
   */
  const exportBackup = useCallback(async (now: Date = new Date()): Promise<ExportOutcome> => {
    // Lo aplicado en memoria y aún sin escribir se vacía ANTES de leer el almacenamiento.
    try {
      await flushAllPendingWrites();
      return await runExclusiveDocuments(CANONICAL_KEYS, () => {
        refreshProtection(browserStorage);
        if (getProtectionSnapshot().length > 0) return { ok: false, reason: "protected" };
        if (getPersistenceState() === "error") return { ok: false, reason: "unsaved" };
        const state = readCanonicalState();
        if (!state) { refreshProtection(browserStorage); return { ok: false, reason: "protected" }; }
        const { travellers, draft } = state;
        const backup = buildPortableBackup(travellers, draft, now.toISOString());
        const text = serializePortableBackup(backup);
        const fileName = backupFileName(todayCivilDate(now));
        // Block 14: el revoke de la URL va diferido (ver `downloadTextFile`): Safari cancela la descarga si desaparece
        // en la misma tarea que el clic. No es un fallo medido: es un riesgo medido, registrado como tal.
        const delivered = downloadTextFile(fileName, text);
        return delivered.ok ? { ok: true, fileName } : { ok: false, reason: "download-failed" };
      });
    } catch {
      reportPersistenceProblem("export", "No se pudo obtener una lectura segura del viaje. No se ha entregado un respaldo como si estuviera completo.", false);
      return { ok: false, reason: "unsaved" };
    }
  }, []);

  /**
   * «Descargar copia de lo conservado»: entrega las cadenas ORIGINALES de los documentos canónicos (también los
   * protegidos), sin interpretarlas ni cambiar nada. Es la salida que sustituye al respaldo normal mientras haya
   * datos protegidos. No escribe en el almacenamiento.
   */
  const downloadOriginals = useCallback((now: Date = new Date()): { ok: boolean } => {
    try {
      const text = serializeOriginals(collectOriginals(browserStorage, true), now.toISOString());
      return downloadTextFile(`nihon-datos-conservados-${todayCivilDate(now)}.json`, text);
    } catch { return { ok: false }; }
  }, []);

  const protectedDocuments = useSyncExternalStore(subscribeProtection, getProtectionSnapshot, getProtectionSnapshot);

  /** Parses and validates a chosen file and produces a preview. Writes nothing. */
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
  const confirmImport = useCallback(async (plan: RestorePlan): Promise<void> => {
    try {
      await runExclusiveDocuments(CANONICAL_KEYS, () => {
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
        let originals: Record<string, string>;
        try { originals = collectOriginals(browserStorage); } catch {
          setImportState({ phase: "failed", rolledBack: true }); return;
        }
        // Una segunda importación fallida no sustituye la preimagen de la primera restauración
        // incompleta por su resultado parcial, ni la borra por haber deshecho sólo el segundo intento.
        const previousRecovery = readPendingCopy("restore");
        const copyKey = previousRecovery === null ? "restore" : "restore-attempt";
        const previousCopy = readPendingCopy(copyKey);
        const copied = (previousRecovery === null || keepPendingCopy("restore", previousRecovery)) &&
          keepPendingCopy(copyKey, JSON.stringify(originals));
        if (!copied) {
          if (previousCopy === null) clearPendingCopy(copyKey);
          else keepPendingCopy(copyKey, previousCopy);
          setImportState({ phase: "failed", rolledBack: true });
          reportPersistenceProblem("restore", "No se pudo conservar una copia anterior a la restauración. No se han sustituido los datos.", previousRecovery !== null);
          return;
        }
        const outcome = applyRestore(browserStorage, plan);
        if (!outcome.ok) {
          if (outcome.rolledBack) {
            clearPendingCopy(copyKey);
            if (previousRecovery === null) clearPersistenceProblem("restore");
          }
          setImportState({ phase: "failed", rolledBack: outcome.rolledBack });
          return;
        }
        clearPendingCopy("restore"); clearPendingCopy("restore-attempt");
        clearPersistenceProblem("restore");
        // Auditoría final (H01): los hooks montados siguen teniendo en memoria el viaje ANTERIOR. Se les
        // avisa ahora —no al pulsar «Continuar»— para que relean y rendericen lo restaurado, y cada
        // mutación posterior parte además del documento vigente (`useStoredDocument`).
        refreshProtection(browserStorage);
        notifyStorageReplaced();
        setImportState({ phase: "restored", summary: summarizeRestore(plan) });
      });
    } catch {
      setImportState({ phase: "failed", rolledBack: true });
      reportPersistenceProblem("restore", "No se pudo obtener acceso para restaurar. No se ha cambiado el viaje.", false);
    }
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
    protectedDocuments,
    retryPersistence,
    downloadOriginals,
    exportBackup,
    prepareImport,
    confirmImport,
    resetImport,
    finishRestore,
  };
}

export type { ProtectedDocument };
export { PLANNING_DRAFT_STORAGE_KEY, TRAVELLERS_STORAGE_KEY };
