import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, doc, documentId, getFirestore, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";
import { deviceStorage, getPersistenceState } from "./device-storage";
import {
  CANONICAL_KEYS, flushAllPendingWrites, isProtectedStatus, notifyStorageReplaced,
  readStoredDraft, readStoredTravellers, runExclusive, runExclusiveDocuments,
} from "./stored-document";
import { applyRestore } from "./portable-backup";
import { compareRecords, parseSyncRecord, projectTrip, recordKey, reorderForSlot, type SyncRecord, type TripState } from "./trip-sync";
import { fromFirestoreRecord, toFirestoreRecord } from "./firestore-record";
import { keepSyncBackup, StorageFullError } from "./sync-backups";
import { SYNC_IMPORT_KEY, type SyncImport } from "./sync-import";
import { SyncHold, SyncSession, type RemovalDecision, type RemovalHistory, type SyncJournal, type SyncLocal } from "./sync-session";

function readTrip(): TripState {
  const travellers = readStoredTravellers(deviceStorage, () => "unused");
  const draft = readStoredDraft(deviceStorage);
  if (!travellers.doc || isProtectedStatus(travellers.status) || isProtectedStatus(draft.status) || getPersistenceState() !== "ok") {
    throw new Error("Local trip is protected or has pending writes");
  }
  return { travellers: travellers.doc, draft: draft.doc };
}

export const removalDecisionKey = (journalKey: string) => `${journalKey}.removal-decision`;
export const removalHistoryKey = (journalKey: string) => `${journalKey}.removal-history`;
export const joinAnsweredKey = (journalKey: string) => `${journalKey}.join-answered`;

/** es-MX (ustedes) status for a failed sync; connection advice only for real Firestore errors. */
export function syncErrorMessage(error: unknown): string {
  if (error instanceof SyncHold && error.reason === "roster-order") {
    return "Las dos personas están en distinto orden en este teléfono y en el otro. Pónganlas en el mismo orden (Persona 1 y Persona 2) en los dos teléfonos para seguir sincronizando. No se aplicó ni se publicó nada; sus datos locales se conservan.";
  }
  if (error instanceof SyncHold && error.reason === "who-are-you") {
    return "Este teléfono todavía no se une al viaje compartido y los nombres no coinciden con los del otro teléfono. Respondan abajo para que cada «me gusta» quede con la persona correcta. No se aplicó ni se publicó nada; sus datos locales se conservan.";
  }
  if (error instanceof SyncHold) {
    return `El viaje compartido quitaría ${error.removed} «me gusta» (de golpe o en las últimas 24 horas), así que no lo aplicamos automáticamente. Guardamos una copia de sus datos en este dispositivo. Si fue a propósito, confírmenlo aquí abajo; si no, conserven los suyos.`;
  }
  if (error instanceof StorageFullError) {
    return "El almacenamiento de este navegador está lleno, así que no pudimos guardar la copia previa ni aplicar los cambios del viaje. Exporten un respaldo y liberen espacio; sus datos locales se conservan.";
  }
  if (error instanceof Error && error.message === "clock-ahead") {
    return "Revisen la fecha y hora del dispositivo: el reloj está adelantado más de cinco minutos. Sus datos locales se conservan.";
  }
  if (error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string") {
    return "No se pudo sincronizar. Sus datos locales se conservan. Revisen la conexión y el acceso al viaje; volveremos a intentarlo.";
  }
  if (error instanceof Error && /^Invalid/.test(error.message)) {
    return "Los datos del viaje compartido no son válidos, así que no se aplicaron. Sus datos locales se conservan; volveremos a intentarlo.";
  }
  return "No se pudo sincronizar. Sus datos locales se conservan; volveremos a intentarlo.";
}

export function localSyncAdapter(key: string): SyncLocal {
  let heldSignature: string | null = null;
  return {
    removalDecision() {
      try {
        const value = JSON.parse(deviceStorage.getItem(removalDecisionKey(key)) ?? "null") as RemovalDecision | null;
        return value && typeof value.signature === "string" && (value.decision === "apply" || value.decision === "keep") ? value : null;
      } catch { return null; }
    },
    decideRemoval(decision) { deviceStorage.setItem(removalDecisionKey(key), JSON.stringify(decision)); },
    consumeRemoval() { deviceStorage.removeItem(removalDecisionKey(key)); },
    removalHistory() {
      try {
        const value = JSON.parse(deviceStorage.getItem(removalHistoryKey(key)) ?? "[]");
        return Array.isArray(value) ? value.filter((e) => Number.isFinite(e?.at) && Number.isInteger(e?.count)) as RemovalHistory : [];
      } catch { return []; }
    },
    saveRemovalHistory(history) {
      if (history.length === 0) deviceStorage.removeItem(removalHistoryKey(key));
      else deviceStorage.setItem(removalHistoryKey(key), JSON.stringify(history.slice(-50)));
    },
    joinAnswered() { return deviceStorage.getItem(joinAnsweredKey(key)) === "1"; },
    async chooseSlot(slot) {
      await flushAllPendingWrites();
      await runExclusiveDocuments(CANONICAL_KEYS, () => {
        const current = readTrip();
        const next = reorderForSlot(current, slot);
        if (next !== current) {
          keepSyncBackup(deviceStorage);
          const outcome = applyRestore(deviceStorage, { travellers: next.travellers, planningDraft: next.draft, droppedPlaceIds: [] });
          if (!outcome.ok) throw new Error("Could not reorder travellers; originals preserved");
          notifyStorageReplaced();
        }
        deviceStorage.setItem(joinAnsweredKey(key), "1");
      });
    },
    holdBackup(signature) {
      if (heldSignature === signature) return;
      // Best effort: nothing is applied while the change is held, so a full device loses nothing.
      try { keepSyncBackup(deviceStorage); heldSignature = signature; } catch { /* reported when applying */ }
    },
    async read() {
      await flushAllPendingWrites();
      return runExclusiveDocuments(CANONICAL_KEYS, readTrip);
    },
    journal() {
      const raw = deviceStorage.getItem(key);
      if (!raw) return { version: 1, records: {}, baseline: null };
      const journal = JSON.parse(raw) as SyncJournal;
      if (journal.version !== 1 || !journal.records || !("baseline" in journal)) throw new Error("Invalid sync journal");
      for (const [key, record] of Object.entries(journal.records)) {
        if (recordKey(parseSyncRecord(record)) !== key) throw new Error("Invalid journal key");
      }
      if (journal.baseline) for (const record of Object.values(journal.baseline)) parseSyncRecord(record);
      return journal;
    },
    saveJournal(journal) {
      const raw = JSON.stringify(journal);
      if (deviceStorage.getItem(key) !== raw) deviceStorage.setItem(key, raw);
    },
    importPolicy() {
      const raw = deviceStorage.getItem(SYNC_IMPORT_KEY);
      if (!raw) return null;
      const policy = JSON.parse(raw) as SyncImport;
      if (!policy.id || typeof policy.confirmed !== "boolean") throw new Error("Invalid import policy");
      // Validate both snapshots before using them as a deletion baseline.
      projectTrip(policy.before, "import"); projectTrip(policy.after, "import");
      return policy;
    },
    consumeImport(id) {
      const raw = deviceStorage.getItem(SYNC_IMPORT_KEY);
      if (raw && JSON.parse(raw).id === id) deviceStorage.removeItem(SYNC_IMPORT_KEY);
    },
    async apply(transform) {
      await flushAllPendingWrites();
      await runExclusiveDocuments(CANONICAL_KEYS, () => {
        const current = readTrip();
        const previousJournal = deviceStorage.getItem(key);
        const next = transform(current);
        if (JSON.stringify(current) === JSON.stringify(next)) return;
        try { keepSyncBackup(deviceStorage); } catch (error) {
          if (previousJournal === null) deviceStorage.removeItem(key);
          else deviceStorage.setItem(key, previousJournal);
          throw error;
        }
        const outcome = applyRestore(deviceStorage, { travellers: next.travellers, planningDraft: next.draft, droppedPlaceIds: [] });
        if (!outcome.ok) {
          if (previousJournal === null) deviceStorage.removeItem(key);
          else deviceStorage.setItem(key, previousJournal);
          throw new Error("Could not apply sync; originals preserved");
        }
        notifyStorageReplaced();
      });
    },
  };
}

/** Journal ownership is the device and trip, never a disposable anonymous account. */
export const syncJournalKey = (config: NonNullable<ReturnType<typeof firebaseConfig>>) =>
  `nihon.sync.v2.${config.options.projectId}.${config.tripId}`;

export type SyncHoldPrompt =
  | { kind: "mass-removal"; removed: number; approve: () => void; keep: () => void }
  | { kind: "who-are-you"; names: string[]; choose: (slot: 0 | 1) => void };

export function connectFirebase(config: NonNullable<ReturnType<typeof firebaseConfig>>, status: (message: string) => void,
  local: SyncLocal = localSyncAdapter(syncJournalKey(config)), onHold: (prompt: SyncHoldPrompt | null) => void = () => {}) {
  const app = getApps().find((app) => app.name === "nihon-sync") ?? initializeApp(config.options, "nihon-sync");
  const auth = getAuth(app);
  const db = getFirestore(app);
  let cleanupSession = () => {};
  let disposed = false;
  let authenticating = false;
  const authenticate = async () => {
    if (disposed || authenticating) return;
    authenticating = true;
    try { await signInAnonymously(auth); }
    catch { if (!disposed) status("No se pudo conectar el viaje. Sus datos locales se conservan."); }
    finally { authenticating = false; }
  };
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    cleanupSession();
    if (disposed) return;
    if (!user?.isAnonymous) { void authenticate(); return; }
    let stopped = false;
    let readyItems = false;
    let readyState = false;
    let items: SyncRecord[] = [];
    let state: SyncRecord[] = [];
    let quarantined = false;
    const quarantine = (id: string) => {
      quarantined = true;
      // Store only bounded metadata, not an untrusted payload or private trip contents.
      try {
        const key = `nihon.sync.quarantine.${config.tripId}`;
        const raw = JSON.parse(deviceStorage.getItem(key) ?? "[]");
        const entries = Array.isArray(raw) ? raw.slice(-19) : [];
        deviceStorage.setItem(key, JSON.stringify([...entries, { id: id.slice(0, 128), at: Date.now() }]));
      } catch { /* A full storage device must not block otherwise valid remote records. */ }
    };
    const session = new SyncSession(local, {
      async write(record) {
        if (record.updatedAt > Date.now() + 300000) throw new Error("clock-ahead");
        const path = record.kind === "place" ? "items" : "state";
        const ref = doc(db, "trips", config.tripId, path, record.id);
        return runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(ref);
          let previous: SyncRecord | null = null;
          if (snapshot.exists()) {
            try { previous = fromFirestoreRecord(snapshot.data()); } catch { quarantine(record.id); }
          }
          if (previous && compareRecords(previous, record) >= 0) return previous;
          // Rules deny creating a tombstone; with no document there is nothing to remove.
          if (!snapshot.exists() && record.deleted) return record;
          transaction.set(ref, toFirestoreRecord(record));
          return record;
        });
      },
    }, user.uid);
    let retryAt = 0;
    let writeBackoff = 1000;
    const sync = async () => {
      if (!readyItems || !readyState || stopped || Date.now() < retryAt) return;
      try {
        const completed = await runExclusive(`sync-session:${config.tripId}`, () => session.sync([...items, ...state]));
        if (completed && !stopped) {
          writeBackoff = 1000; retryAt = 0; onHold(null);
          status(quarantined ? "Viaje sincronizado. Se omitieron datos remotos inválidos; sus datos locales se conservan."
            : "Viaje sincronizado. Los cambios se comparten automáticamente.");
        }
      } catch (error) {
        retryAt = Date.now() + writeBackoff; writeBackoff = Math.min(writeBackoff * 2, 30000);
        if (stopped) return;
        status(syncErrorMessage(error));
        const resume = () => { retryAt = 0; writeBackoff = 1000; onHold(null); void sync(); };
        if (error instanceof SyncHold && error.reason === "mass-removal") {
          const signature = error.signature;
          onHold({ kind: "mass-removal", removed: error.removed,
            approve: () => { local.decideRemoval?.({ signature, decision: "apply" }); resume(); },
            keep: () => { local.decideRemoval?.({ signature, decision: "keep" }); resume(); } });
        } else if (error instanceof SyncHold && error.reason === "who-are-you") {
          onHold({ kind: "who-are-you", names: error.names, choose: (slot) => {
            void Promise.resolve(local.chooseSlot?.(slot)).then(resume, (failure) => status(syncErrorMessage(failure)));
          } });
        } else onHold(null);
      }
    };
    const listen = (path: "items" | "state") => {
      let unsubscribe = () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;
      let backoff = 1000;
      const ready = (value: boolean) => { if (path === "items") readyItems = value; else readyState = value; };
      const subscribe = () => {
        if (stopped) return;
        unsubscribe = onSnapshot(
          path === "state" ? query(collection(db, "trips", config.tripId, path), where(documentId(), "in", ["roster", "planner"]))
            : collection(db, "trips", config.tripId, path), { includeMetadataChanges: true }, (snapshot) => {
            if (snapshot.metadata.fromCache) {
              ready(false);
              status("Conectando el viaje… Sus datos locales se conservan.");
              return;
            }
            backoff = 1000;
            const records: SyncRecord[] = [];
            for (const document of snapshot.docs) {
              try {
                const record = fromFirestoreRecord(document.data());
                if (record.id !== document.id || (path === "items" ? record.kind !== "place" : record.kind === "place")) throw new Error("Invalid remote path");
                records.push(record);
              } catch { quarantine(document.id); }
            }
            if (path === "items") items = records; else state = records;
            ready(true); void sync();
          }, () => {
            ready(false); unsubscribe();
            if (stopped) return;
            status("No se pudo conectar el viaje. Sus datos locales se conservan; volveremos a intentarlo.");
            timer = setTimeout(subscribe, backoff); backoff = Math.min(backoff * 2, 30000);
          });
      };
      subscribe();
      return () => { unsubscribe(); clearTimeout(timer); };
    };
    status("Conectando el viaje… Sus datos locales se conservan.");
    const stopItems = listen("items");
    const stopState = listen("state");
    const interval = setInterval(() => { void sync(); }, 2000);
    cleanupSession = () => { stopped = true; session.stop(); stopItems(); stopState(); clearInterval(interval); };
  }, () => status("No se pudo verificar la sesión. Sus datos locales se conservan."));
  const retry = setInterval(() => { if (!auth.currentUser?.isAnonymous) void authenticate(); }, 15000);
  return { dispose() { disposed = true; cleanupSession(); unsubscribeAuth(); clearInterval(retry); } };
}
