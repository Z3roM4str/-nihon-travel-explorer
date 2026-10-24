import { useCallback, useEffect, useState, type SetStateAction } from "react";
import {
  RECOVERED_KEY_PREFIX, isProtectedStatus, registerFlusher, runExclusive, setProtection, subscribeStorageReplaced,
  type StorageLike, type StoredRead, type StoredStatus,
} from "./lib/stored-document";
import {
  cancelPendingWrites, clearPersistenceProblem, registerPersistenceRetry, reportPersistenceProblem,
} from "./lib/device-storage";
import { clearPendingCopy, keepPendingCopy, readPendingCopy } from "./lib/persistence-recovery";

export type StoredDocumentAdapter<T> = {
  key: string;
  storage: StorageLike;
  read: () => StoredRead<T>;
  /** Clasifica una cadena ajena (el `newValue` de un evento `storage`); sin esto no se protege lo sobrescrito. */
  classify?: (raw: string) => StoredStatus;
  initial: () => T;
  serialize: (doc: T) => string;
  parse: (raw: string) => T | null;
  externallyBlocked?: () => boolean;
};
export type UpdateGuard<T> = { check: (doc: T) => boolean; onReject: () => void };
export type StoredDocumentUpdate<T> = (action: SetStateAction<T>, guard?: UpdateGuard<T>) => void;
type JournalEntry<T> = {
  apply: (doc: T) => T;
  guard?: UpdateGuard<T>;
  writeIds: string[];
  anchors: string[];
};
type Recovery = { raw: string | null; value: string; pending: boolean; conflict: boolean; writes: string[][] };
const LINEAGE_LENGTH = 96;
const VERIFY_AFTER_MS = 250;
const CONFIRM_AFTER_MS = 2500;

/** null significa que no hay historia fiable, no una demostración de ausencia. */
function readLineage(raw: string | null): string[] | null {
  try {
    const ids: unknown = raw === null ? undefined : JSON.parse(raw)._w;
    return Array.isArray(ids) && ids.every((id) => typeof id === "string") && new Set(ids).size === ids.length
      ? ids : null;
  } catch { return null; }
}
function isCanonical(raw: string | null, status: string, canonical: string): boolean {
  if (status !== "valid" || raw === null) return false;
  try {
    const { _w, ...rest } = JSON.parse(raw) as Record<string, unknown>;
    void _w; return JSON.stringify(rest) === canonical;
  } catch { return false; }
}
function withLineage(json: string, lineage: readonly string[]): string {
  return json.endsWith("}") ? json.slice(0, -1) + ',"_w":' + JSON.stringify(lineage) + "}" : json;
}
let writeCounter = 0;
function newWriteId(): string {
  writeCounter += 1;
  return Math.random().toString(36).slice(2, 10) + writeCounter.toString(36);
}

/**
 * Único diario por clave y pestaña, compartido por las vistas montadas y desmontadas.
 * Las operaciones conservan todos sus ids de escritura y los antecesores bajo los que se escribieron.
 * Se descarta lo demostrado incluido; sólo se reproduce lo demostrado ausente. La duda bloquea la
 * escritura y conserva el trabajo local, sin sustituir el original externo ni confirmar a ciegas.
 */
export class StoredDocumentStore<T> {
  private adapter: StoredDocumentAdapter<T>;
  private raw: string | null;
  private status: StoredRead<T>["status"];
  private doc: T;
  private pending: JournalEntry<T>[] = [];
  private unconfirmed: JournalEntry<T>[] = [];
  private dirty: boolean;
  private conflict = false;
  private recoveredCopy: string | null = null;
  private recoveredWrites: string[][] = [];
  private lastWriteAt = 0;
  /** Lo último que escribió ESTA pestaña, para distinguir su propia sobrescritura de la de otra. */
  private lastWritten: string | null = null;
  private revision = 0;
  private flushedRevision = 0;
  private flight: Promise<void> | null = null;
  private started = false;
  private listeners = new Set<(doc: T) => void>();

  constructor(adapter: StoredDocumentAdapter<T>) {
    this.adapter = adapter;
    const read = adapter.read();
    this.raw = read.raw; this.status = read.status;
    this.doc = read.doc ?? adapter.initial();
    this.dirty = !isProtectedStatus(read.status) && !isCanonical(read.raw, read.status, adapter.serialize(this.doc));
    const saved = readPendingCopy(adapter.key);
    if (saved) {
      try {
        const recovery = JSON.parse(saved) as Recovery;
        if (typeof recovery.value !== "string" || typeof recovery.pending !== "boolean" || typeof recovery.conflict !== "boolean" || !Array.isArray(recovery.writes) || !recovery.writes.every((ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string"))) throw new Error("Invalid recovery");
        const recovered = adapter.parse(recovery.value);
        if (!recovered) throw new Error("Invalid pending document");
        const lineage = readLineage(read.raw) ?? [];
        const included = recovery.writes.length > 0 && recovery.writes.every((ids) => ids.length > 0 && ids.some((id) => lineage.includes(id)));
        if (included && !isProtectedStatus(read.status)) clearPendingCopy(adapter.key);
        else if (recovered) {
          this.doc = recovered;
          if (!recovery.conflict && recovery.pending && read.raw === recovery.raw && !isProtectedStatus(read.status)) {
            this.pending = [{
              apply: () => recovered, writeIds: [], anchors: [],
              guard: { check: () => this.raw === recovery.raw, onReject: () => { this.recoveredCopy = saved; this.conflict = true; this.problem("El documento cambió durante la recarga. Se conserva la copia pendiente; no se ha escrito encima."); } },
            }];
            this.dirty = true;
          } else {
            this.conflict = true; this.recoveredCopy = saved; this.recoveredWrites = recovery.writes;
            this.problem("Hay cambios pendientes de esta pestaña que no se pueden aplicar con seguridad. Se conservan su copia y el documento almacenado.");
          }
        }
      } catch { this.conflict = true; this.recoveredCopy = saved; this.problem("No se puede leer la copia pendiente. Se ha conservado sin sustituir el documento almacenado."); }
    }
  }

  getSnapshot = (): T => this.doc;
  configure(adapter: StoredDocumentAdapter<T>): void { this.adapter = adapter; }
  subscribe(listener: (doc: T) => void): () => void {
    this.listeners.add(listener); listener(this.doc); return () => this.listeners.delete(listener);
  }
  private emit(): void { for (const listener of this.listeners) listener(this.doc); }
  private problem(message: string): void {
    if (this.started) reportPersistenceProblem(this.adapter.key, message);
    else queueMicrotask(() => reportPersistenceProblem(this.adapter.key, message));
  }
  private blocked(): boolean {
    return isProtectedStatus(this.status) || readPendingCopy("restore") !== null || (this.adapter.externallyBlocked?.() ?? false);
  }
  private stash(): void {
    // Tras una recarga las funciones de intención no existen: nunca convertir esa copia en un
    // diario vacío que parezca confirmado ni reescribir una copia que no sabemos interpretar.
    if (this.recoveredCopy !== null) return;
    if (!this.dirty && this.pending.length === 0 && this.unconfirmed.length === 0 && !this.conflict) {
      clearPendingCopy(this.adapter.key); clearPersistenceProblem(this.adapter.key); return;
    }
    const copy: Recovery = {
      raw: this.raw, value: this.adapter.serialize(this.doc), pending: this.pending.length > 0 || this.dirty,
      conflict: this.conflict || this.blocked(), writes: [...this.unconfirmed, ...this.pending].map((entry) => entry.writeIds),
    };
    if (!keepPendingCopy(this.adapter.key, JSON.stringify(copy))) {
      this.problem("No se pudo conservar la copia pendiente al recargar. Los cambios siguen en memoria y pueden perderse al cerrar la pestaña.");
    }
  }
  private reject(entry: JournalEntry<T>): void {
    entry.guard?.onReject();
  }
  private replay(base: T): T {
    let next = base;
    this.pending = this.pending.filter((entry) => {
      if (entry.guard && !entry.guard.check(next)) { this.reject(entry); return false; }
      next = entry.apply(next); return true;
    });
    return next;
  }
  private inclusion(entry: JournalEntry<T>, lineage: string[] | null): "included" | "missing" | "unknown" {
    if (entry.writeIds.length === 0) return "missing"; // nunca se llegó a escribir
    if (lineage && entry.writeIds.some((id) => lineage.includes(id))) return "included";
    // Con la historia completa se prueba ausencia. Con la ventana llena, un antecesor aún presente
    // prueba que las escrituras posteriores a él no pudieron desaparecer por truncamiento.
    if (lineage && (lineage.length < LINEAGE_LENGTH || entry.anchors.some((id) => lineage.includes(id)))) return "missing";
    return "unknown";
  }
  sync(): boolean {
    const read = this.adapter.read();
    setProtection(this.adapter.key, read.status);
    if (read.raw === this.raw && read.status === this.status) return false;
    this.raw = read.raw; this.status = read.status;
    if (this.blocked()) {
      if (this.pending.length || this.unconfirmed.length || this.dirty) {
        this.problem("No se ha aplicado el cambio: el documento vigente está protegido o no se puede leer. El original y la copia pendiente se conservan.");
        this.stash();
      }
      this.emit(); return true;
    }
    const lineage = readLineage(read.raw);
    if (this.recoveredCopy !== null) {
      const included = this.recoveredWrites.length > 0 && this.recoveredWrites.every((ids) => ids.length > 0 && ids.some((id) => lineage?.includes(id)));
      if (!included) {
        this.problem("La copia pendiente de la recarga no se puede reconciliar con seguridad. Se conservan ambas copias sin sustituir el documento almacenado.");
        this.emit(); return true;
      }
      this.recoveredCopy = null; this.recoveredWrites = []; this.conflict = false;
    }
    const missing: JournalEntry<T>[] = [];
    const unknown: JournalEntry<T>[] = [];
    for (const entry of this.unconfirmed) {
      const state = this.inclusion(entry, lineage);
      if (state === "missing") missing.push(entry);
      else if (state === "unknown") unknown.push(entry);
    }
    // La prueba positiva se usa SIEMPRE, incluso con 96 ids y aunque el id sea de un intento anterior.
    this.pending = this.pending.filter((entry) => this.inclusion(entry, lineage) !== "included");
    const ambiguousPending = this.pending.some((entry) => this.inclusion(entry, lineage) === "unknown");
    this.unconfirmed = unknown;
    this.pending = [...missing, ...this.pending];
    this.conflict = unknown.length > 0 || ambiguousPending;
    if (this.conflict) {
      this.problem("No se puede saber si un cambio ya está guardado porque falta parte del historial. Se han conservado ambas copias; no se ha repetido ni descartado el cambio.");
      this.stash(); this.emit(); return true;
    }
    this.doc = this.replay(read.doc ?? this.adapter.initial());
    this.dirty = this.pending.length > 0;
    if (this.conflict) { this.stash(); this.emit(); return true; }
    clearPersistenceProblem(this.adapter.key);
    if (this.pending.length === 0) cancelPendingWrites([this.adapter.key]);
    this.stash(); this.emit(); return true;
  }

  private writeNow(): void {
    const adopted = this.sync(); // la clasificación ocurre dentro del lock
    if (this.blocked() || this.conflict) {
      if (this.pending.length || this.dirty) this.problem("No se ha escrito sobre los datos conservados. El cambio pendiente no se puede aplicar con seguridad.");
      this.stash(); return;
    }
    if (adopted && this.pending.length === 0) this.dirty = false;
    if (!this.dirty && this.pending.length === 0) {
      // Se obtuvo el lock y la lectura es segura: también se recupera un fallo de acceso anterior
      // cuando el documento ya está al día, sin forzar una escritura para quitar el aviso.
      clearPersistenceProblem(this.adapter.key); this.stash(); return;
    }
    // Segunda clasificación inmediatamente antes del setItem, también dentro del lock.
    this.sync();
    if (this.blocked() || this.conflict) { this.stash(); return; }
    if (!this.dirty && this.pending.length === 0) {
      // Se obtuvo el lock y la lectura es segura: también se recupera un fallo de acceso anterior
      // cuando el documento ya está al día, sin forzar una escritura para quitar el aviso.
      clearPersistenceProblem(this.adapter.key); this.stash(); return;
    }
    const lineage = readLineage(this.raw) ?? [];
    const anchor = lineage.at(-1);
    const id = newWriteId();
    const serialized = withLineage(this.adapter.serialize(this.doc), [...lineage, id].slice(-LINEAGE_LENGTH));
    this.flushedRevision = this.revision;
    try { this.adapter.storage.setItem(this.adapter.key, serialized); }
    catch { this.stash(); return; }
    for (const entry of this.pending) {
      entry.writeIds.push(id);
      if (anchor) entry.anchors.push(anchor);
    }
    this.unconfirmed.push(...this.pending); this.pending = [];
    this.raw = serialized; this.lastWritten = serialized; this.status = "valid"; this.dirty = false;
    this.lastWriteAt = Date.now();
    setProtection(this.adapter.key, "valid"); clearPersistenceProblem(this.adapter.key);
    this.stash(); this.emit();
    setTimeout(() => this.verify(), VERIFY_AFTER_MS);
  }
  /**
   * Una escritura sobre una lectura obsoleta no se puede evitar con certeza —localStorage no ofrece compare-and-set y
   * la invalidación de otra pestaña puede llegar más tarde que cualquier margen—, pero SIEMPRE llega después como
   * evento `storage` con el documento que se sobrescribió (medido sin Nihon en WebKit: 82/82 sobrescrituras obsoletas
   * recibieron un evento con el `newValue` ajeno; `scripts/webstorage-stale-overwrite-probe.mjs`). Un documento ajeno
   * PROTEGIDO (inválido o de versión futura) que ya no está en el almacenamiento se conserva siempre aparte y, si lo
   * último escrito allí es lo de esta pestaña, se RESTITUYE; el cambio de esta pestaña queda en su copia pendiente.
   * Un documento ajeno válido no necesita esto: su pestaña ve que falta en el linaje y reaplica su cambio.
   */
  handleForeignValue = (foreign: string | null): Promise<void> => {
    const classify = this.adapter.classify;
    if (foreign === null || !classify || !isProtectedStatus(classify(foreign))) return Promise.resolve();
    return runExclusive(this.adapter.key, () => this.protectForeign(foreign))
      .catch(() => this.problem("No se pudo comprobar si se sobrescribió un documento protegido de otra pestaña. Se conserva la copia pendiente."));
  };
  private protectForeign(foreign: string): void {
    const storage = this.adapter.storage; const key = this.adapter.key;
    let current: string | null;
    try { current = storage.getItem(key); } catch { return; }
    if (current === foreign) { this.sync(); return; } // sigue ahí: la protección ordinaria ya actúa
    let preserved = false;
    try {
      const copyKey = `${RECOVERED_KEY_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.${key}`;
      storage.setItem(copyKey, foreign); preserved = storage.getItem(copyKey) === foreign;
    } catch { /* se informa abajo */ }
    let restored = false;
    if (this.lastWritten !== null && current === this.lastWritten) {
      try { storage.setItem(key, foreign); restored = storage.getItem(key) === foreign; } catch { /* se informa abajo */ }
    }
    this.problem(restored
      ? "Otra pestaña había publicado datos que esta no veía y se habían sobrescrito. Se han restituido tal cual y el cambio de esta pestaña queda en su copia pendiente."
      : preserved
        ? "Otra pestaña publicó datos protegidos que se han sobrescrito. Se ha guardado una copia aparte (nihon.recovered.*); no se ha escrito encima."
        : "Otra pestaña publicó datos protegidos que se han sobrescrito y no se pudo guardar una copia. Descarga la copia de lo conservado antes de seguir.");
    this.sync(); this.stash(); this.emit();
  }
  flush = (): Promise<void> => {
    if (this.flight) return this.flight;
    this.flight = runExclusive(this.adapter.key, () => this.writeNow())
      .catch(() => this.problem("No se pudo obtener acceso para guardar. Se conserva la copia pendiente; vuelve a intentarlo."))
      .finally(() => {
        this.flight = null;
        if (this.pending.length && this.revision > this.flushedRevision && !this.blocked() && !this.conflict) {
          this.flushedRevision = this.revision; // no reintento en bucle ante cuota
          this.schedule();
        }
      });
    return this.flight;
  };
  private schedule(): void { queueMicrotask(() => { void this.flush(); }); }
  private verify(): void {
    if (this.unconfirmed.length === 0 || this.conflict) return;
    if (this.sync()) { if (this.pending.length || this.dirty) this.schedule(); return; }
    if (Date.now() - this.lastWriteAt >= CONFIRM_AFTER_MS) {
      this.unconfirmed = []; this.stash();
    } else setTimeout(() => this.verify(), VERIFY_AFTER_MS);
  }
  update: StoredDocumentUpdate<T> = (action, guard) => {
    this.sync();
    if (this.blocked() || this.conflict) {
      this.problem("No se ha aplicado el cambio: los datos conservados no se pueden sustituir con seguridad.");
      this.emit(); return;
    }
    if (guard && !guard.check(this.doc)) {
      guard.onReject(); this.emit(); return;
    }
    const apply = (value: T): T => typeof action === "function" ? (action as (current: T) => T)(value) : action;
    const next = apply(this.doc);
    if (!Object.is(next, this.doc) && this.adapter.serialize(next) !== this.adapter.serialize(this.doc)) {
      this.doc = next;
      this.pending.push({ apply, guard, writeIds: [], anchors: [] });
      this.revision += 1; this.stash(); this.schedule();
    }
    this.emit();
  };

  start(): void {
    if (this.started) return;
    this.started = true;
    setProtection(this.adapter.key, this.status);
    registerPersistenceRetry(this.adapter.key, this.flush);
    registerFlusher(this.flush);
    subscribeStorageReplaced(() => {
      this.pending = []; this.unconfirmed = []; this.conflict = false; this.recoveredCopy = null; this.recoveredWrites = []; this.dirty = false;
      cancelPendingWrites([this.adapter.key]); clearPersistenceProblem(this.adapter.key); clearPendingCopy(this.adapter.key);
      const read = this.adapter.read();
      this.raw = read.raw; this.status = read.status; this.doc = read.doc ?? this.adapter.initial();
      this.dirty = !isProtectedStatus(read.status) && !isCanonical(read.raw, read.status, this.adapter.serialize(this.doc));
      setProtection(this.adapter.key, read.status); this.emit(); this.schedule();
    });
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === this.adapter.key) {
        if (event.key !== null && event.storageArea === window.localStorage) void this.handleForeignValue(event.newValue);
        if (this.sync() && (this.dirty || this.pending.length)) this.schedule();
      }
    });
    const preserve = () => { this.stash(); void this.flush(); };
    window.addEventListener("pagehide", preserve);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") preserve(); });
    this.schedule();
  }
}

const stores = new WeakMap<StorageLike, Map<string, StoredDocumentStore<unknown>>>();
function storeFor<T>(adapter: StoredDocumentAdapter<T>): StoredDocumentStore<T> {
  let byKey = stores.get(adapter.storage);
  if (!byKey) { byKey = new Map(); stores.set(adapter.storage, byKey); }
  let store = byKey.get(adapter.key);
  if (!store) {
    store = new StoredDocumentStore(adapter) as unknown as StoredDocumentStore<unknown>;
    byKey.set(adapter.key, store);
  }
  return store as unknown as StoredDocumentStore<T>;
}

/** React sólo observa el diario único; desmontar una superficie no pierde su intención ni su reintento. */
export function useStoredDocument<T>(adapter: StoredDocumentAdapter<T>): [T, StoredDocumentUpdate<T>] {
  const [store] = useState(() => storeFor(adapter));
  const [doc, setDoc] = useState<T>(store.getSnapshot);
  useEffect(() => { store.configure(adapter); });
  useEffect(() => { store.start(); return store.subscribe(setDoc); }, [store]);
  const update = useCallback<StoredDocumentUpdate<T>>((action, guard) => store.update(action, guard), [store]);
  return [doc, update];
}
