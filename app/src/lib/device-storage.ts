import { runExclusive } from "./storage-lock";
import { clearPendingCopy, keepPendingCopy, pendingCopies } from "./persistence-recovery";

export type PersistenceState = "ok" | "error";
export type PersistenceProblem = { key: string; message: string; blocking: boolean };
type PendingWrite = { key: string; value: string | null; base: string | null; readable: boolean };
const pending = new Map<string, PendingWrite>();
const problems = new Map<string, PersistenceProblem>();
const retries = new Map<string, () => Promise<void>>();
const listeners = new Set<() => void>();
const problemListeners = new Set<() => void>();
let snapshot: PersistenceState = "ok";
let problemSnapshot: readonly PersistenceProblem[] = [];
const canonical = new Set(["nihon.travellers.v1", "nihon.manualPlanningDraft"]);

function publish(): void {
  const next: PersistenceState = pending.size > 0 || [...problems.values()].some((p) => p.blocking) ? "error" : "ok";
  if (next !== snapshot) {
    snapshot = next;
    for (const listener of listeners) listener();
  }
  problemSnapshot = [...problems.values()];
  for (const listener of problemListeners) listener();
}

export function reportPersistenceProblem(key: string, message: string, blocking = true): void {
  const before = problems.get(key);
  if (before?.message === message && before.blocking === blocking) return;
  problems.set(key, { key, message, blocking }); publish();
}
export function clearPersistenceProblem(key: string): void {
  if (problems.delete(key)) publish();
}
export function cancelPendingWrites(keys: readonly string[]): void {
  for (const key of keys) pending.delete(key);
  publish();
}
export function registerPersistenceRetry(key: string, retry: () => Promise<void>): () => void {
  retries.set(key, retry);
  return () => { if (retries.get(key) === retry) retries.delete(key); };
}

function mutate(key: string, value: string | null): void {
  let base: string | null = null;
  let readable = false;
  try {
    base = localStorage.getItem(key);
    readable = true;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (error) {
    pending.set(key, { key, value, base, readable });
    publish(); throw error;
  }
  pending.delete(key); publish();
}

/** Adaptador único. Una lectura fallida no se presenta como una clave ausente. */
export const deviceStorage = {
  getItem(key: string): string | null { return localStorage.getItem(key); },
  setItem(key: string, value: string): void { mutate(key, value); },
  removeItem(key: string): void { mutate(key, null); },
  pendingCopies,
  cancelPendingWrites,
  /** Cancela sólo las cargas de esta importación, conservando pendientes anteriores al rollback. */
  beginPendingScope(keys: readonly string[]): (outcome: "commit" | "rollback" | "incomplete") => void {
    const before = new Map(keys.map((key) => [key, pending.get(key)]));
    return (outcome) => {
      for (const key of keys) {
        pending.delete(key);
        if (outcome === "rollback" && before.get(key)) pending.set(key, before.get(key)!);
        if (outcome === "commit") clearPersistenceProblem(key);
        if (outcome === "incomplete") reportPersistenceProblem(key,
          "La restauración quedó a medias. Se han conservado las copias anteriores; vuelve a importar el respaldo cuando puedas guardar.");
      }
      publish();
    };
  },
};
export function subscribePersistence(listener: () => void): () => void {
  listeners.add(listener); return () => listeners.delete(listener);
}
export function getPersistenceState(): PersistenceState { return snapshot; }
export function subscribePersistenceProblems(listener: () => void): () => void {
  problemListeners.add(listener); return () => problemListeners.delete(listener);
}
export function getPersistenceProblems(): readonly PersistenceProblem[] { return problemSnapshot; }

/** Reintenta intenciones por su propietario. Nunca escribe una instantánea canónica anterior. */
export async function retryPersistence(): Promise<PersistenceState> {
  const keys = new Set([...pending.keys(), ...[...problems.values()].filter((p) => p.blocking).map((p) => p.key)]);
  for (const key of keys) {
    const retry = retries.get(key);
    if (retry) {
      try { await retry(); } catch { reportPersistenceProblem(key, "No se pudo reintentar con seguridad. Se conserva el cambio pendiente."); }
      continue;
    }
    const entry = pending.get(key);
    if (!entry) continue;
    if (canonical.has(key)) {
      reportPersistenceProblem(key, "No se puede aplicar ese cambio con seguridad. Los originales se han conservado; abre la sección del viaje antes de volver a intentarlo.");
      continue;
    }
    // Preferencias de comparación y copias aparte: compare-and-set, también bajo el lock.
    try {
      await runExclusive(key, () => {
        const now = localStorage.getItem(key);
        if (now === entry.value) { pending.delete(key); clearPersistenceProblem(key); return; }
        if (!entry.readable || now !== entry.base) {
          keepPendingCopy(key, JSON.stringify(entry));
          reportPersistenceProblem(key, "Ese dato cambió en otra pestaña. No se ha sustituido por la copia anterior.");
          return;
        }
        mutate(key, entry.value);
      });
    } catch { /* se conserva la pendiente; no se salta el lock */ }
  }
  publish(); return snapshot;
}

/** Sólo para pruebas. */
export function resetPersistenceForTests(): void {
  for (const key of pending.keys()) clearPendingCopy(key);
  pending.clear(); problems.clear(); retries.clear(); listeners.clear(); problemListeners.clear();
  snapshot = "ok"; problemSnapshot = [];
}
