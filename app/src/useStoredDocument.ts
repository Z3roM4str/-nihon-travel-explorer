import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import {
  isProtectedStatus,
  registerFlusher,
  runExclusive,
  setProtection,
  subscribeStorageReplaced,
  type StorageLike,
  type StoredRead,
} from "./lib/stored-document";

/**
 * Auditoría final (H01, H02, H04) — el estado persistente de un documento canónico.
 *
 * Sustituye al par `useState` + «efecto que escribe el estado entero en cuanto cambia», que tenía
 * tres defectos de la misma raíz: el estado montado era la única verdad (H01: una restauración
 * escrita por debajo se sobrescribía en la siguiente mutación), la escritura reemplazaba el
 * documento completo con una copia posiblemente antigua (H02: otra pestaña perdía su trabajo), y
 * el valor inicial se escribía encima de lo que no se había sabido leer (H04).
 *
 * ## El contrato
 *
 * 1. **Cada mutación parte del documento vigente.** Antes de aplicar la operación se compara la
 *    cadena que hay en el almacenamiento con la última que este hook leyó o escribió. Si difiere,
 *    el documento se relee y la operación se aplica SOBRE ÉL: las dos pestañas componen sus
 *    cambios en lugar de pisarse.
 * 2. **Las operaciones se anotan en un diario hasta estar escritas.** La mutación se aplica ya en
 *    memoria (la interfaz responde al instante) y su función se guarda. La escritura ocurre dentro de
 *    un Web Lock del documento (`runExclusive`): se relee lo que haya, se REPRODUCE el diario sobre
 *    ello y se escribe. Así dos pestañas que escriben a la vez se serializan, y lo que una escribe
 *    nunca borra lo que la otra ya había escrito (medido: sin el lock, la lectura previa a la
 *    escritura podía ser anterior a la escritura de la otra pestaña y se perdían ~40 % de las
 *    operaciones en un estrés de 80 «Añadir día» simultáneos).
 *    Aun así, la caché de `localStorage` de cada pestaña se actualiza de forma asíncrona y la lectura
 *    dentro del lock puede ser anterior a la escritura de la otra (medido: 5 de 243 operaciones
 *    perdidas con sólo el lock). Por eso cada escritura lleva un **linaje**: la lista de los últimos
 *    identificadores de escritura (`_w`, un campo que los parsers ignoran). Una escritura SE DA POR
 *    PERDIDA si el documento que acaba quedando no contiene su identificador, y entonces se adopta ese
 *    documento y se REPRODUCEN las operaciones no confirmadas. Es una prueba de inclusión, no una
 *    suposición: una operación sólo se repite si se demuestra que no está.
 * 3. **Una operación con identidad se valida contra el estado vigente** (`guard`). Si la parada o el
 *    día ya no existen, o la operación entra en conflicto, NO se aplica y se avisa (`onReject`), tanto al
 *    pedirla como si deja de ser válida al reproducirla sobre lo que escribió otra pestaña.
 * 4. **Un documento inválido o de versión futura se protege.** El hook sirve un valor inicial EN
 *    MEMORIA para que la aplicación siga siendo utilizable, pero no escribe sobre el original hasta
 *    que la persona elija la salida explícita (`startFresh`).
 * 5. **Las escrituras externas se adoptan.** El evento `storage` (otras pestañas) y
 *    `notifyStorageReplaced` (restauración o recuperación en ESTA pestaña) hacen que el hook relea y
 *    renderice lo que hay, reproduciendo encima lo que aún estuviera sin escribir.
 * 6. **Al ocultarse o desmontarse, lo pendiente se escribe de forma síncrona** (`flushNow`), y
 *    «Exportar respaldo» lo vacía antes de leer el almacenamiento.
 *
 * Los fallos de `setItem` siguen siendo asunto de `device-storage`: se registra la carga pendiente
 * y el aviso global lo comunica. Este hook no oculta ni reintenta nada por su cuenta.
 */

export type StoredDocumentAdapter<T> = {
  key: string;
  storage: StorageLike;
  /** Lee el almacenamiento ahora, ya migrado y reconciliado. */
  read: () => StoredRead<T>;
  /** El documento en memoria cuando no hay nada utilizable. */
  initial: () => T;
  serialize: (doc: T) => string;
  /** Otra razón para no escribir: el borrador no se escribe mientras los viajeros estén protegidos. */
  externallyBlocked?: () => boolean;
};

/** Precondición de identidad de una operación: se evalúa contra el documento VIGENTE, no contra la vista. */
export type UpdateGuard<T> = {
  check: (doc: T) => boolean;
  onReject: () => void;
};

export type StoredDocumentUpdate<T> = (action: SetStateAction<T>, guard?: UpdateGuard<T>) => void;

/**
 * `writeIds`: TODAS las escrituras bajo las que esta operación ya se escribió (se repone con un id nuevo si una
 * pareció perderse). Basta que el linaje del documento adoptado contenga CUALQUIERA para saber que está incluida:
 * si no, un intento «perdido» que sí sobrevivió dentro de otra escritura se repondría de nuevo (duplicado).
 */
type JournalEntry<T> = { apply: (doc: T) => T; guard?: UpdateGuard<T>; writeIds?: string[] };

/** Cuántos identificadores de escritura conserva el linaje (`_w`). */
const LINEAGE_LENGTH = 96;
/** Cuánto se espera, tras escribir, antes de comprobar que la escritura sobrevivió. */
const VERIFY_AFTER_MS = 250;
/** Cuánto tiempo estable (sin cambios externos) hace falta para dar una escritura por confirmada. */
const CONFIRM_AFTER_MS = 2500;

function readLineage(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const ids = (parsed as { _w?: unknown } | null)?._w;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

let writeCounter = 0;
function newWriteId(): string {
  writeCounter += 1;
  return `${Math.random().toString(36).slice(2, 8)}${writeCounter.toString(36)}`;
}

/** Añade el linaje al JSON de un objeto sin tocar el resto de su contenido. */
function withLineage(json: string, lineage: readonly string[]): string {
  return json.endsWith("}") ? `${json.slice(0, -1)},"_w":${JSON.stringify(lineage)}}` : json;
}

type Core<T> = {
  doc: T;
  /** La última cadena de almacenamiento que este hook leyó o escribió. */
  raw: string | null;
  status: StoredRead<T>["status"];
  /** Operaciones aplicadas en memoria que todavía no están escritas. */
  pending: JournalEntry<T>[];
  /** Operaciones ya escritas cuya supervivencia aún no se ha comprobado (linaje). */
  unconfirmed: JournalEntry<T>[];
  /** Identificador de la última escritura de este hook. */
  lastWriteId: string | null;
  lastWriteAt: number;
  /** Hay que escribir aunque no haya operaciones (arranque: normalizar o crear el documento). */
  dirty: boolean;
  scheduled: boolean;
};

export function useStoredDocument<T>(adapter: StoredDocumentAdapter<T>): [T, StoredDocumentUpdate<T>] {
  const adapterRef = useRef(adapter);
  useEffect(() => {
    adapterRef.current = adapter;
  });

  // El estado mutable de este hook. La lectura inicial se hace UNA vez, en el inicializador perezoso
  // de `useState`; el `ref` la recibe como valor inicial, así que nunca se lee `ref.current` durante el render.
  const [initialCore] = useState<Core<T>>(() => {
    const read = adapter.read();
    return {
      doc: read.doc ?? adapter.initial(),
      raw: read.raw,
      status: read.status,
      pending: [],
      unconfirmed: [],
      lastWriteId: null,
      lastWriteAt: 0,
      dirty: true,
      scheduled: false,
    };
  });
  const coreRef = useRef<Core<T>>(initialCore);
  const [doc, setDoc] = useState<T>(initialCore.doc);
  const verifyRef = useRef<() => void>(() => {});

  const isBlocked = useCallback(
    (): boolean =>
      isProtectedStatus(coreRef.current.status) || (adapterRef.current.externallyBlocked?.() ?? false),
    []
  );

  /** Reproduce el diario sobre `base`; descarta (y avisa de) lo que ya no es válido sobre ello. */
  const replay = useCallback((base: T): T => {
    const core = coreRef.current;
    let next = base;
    const kept: JournalEntry<T>[] = [];
    for (const entry of core.pending) {
      if (entry.guard && !entry.guard.check(next)) {
        entry.guard.onReject();
        continue;
      }
      next = entry.apply(next);
      kept.push(entry);
    }
    core.pending = kept;
    return next;
  }, []);

  /**
   * Si el almacenamiento cambió por debajo de este hook, lo relee y repone encima lo que falte. Lo ya
   * escrito sólo se repone si el linaje del documento adoptado demuestra que NO lo contiene.
   */
  const sync = useCallback((): boolean => {
    const current = adapterRef.current;
    const core = coreRef.current;
    let now: string | null;
    try {
      now = current.storage.getItem(current.key);
    } catch {
      return false;
    }
    if (now === core.raw) return false;
    const read = current.read();
    core.raw = read.raw;
    core.status = read.status;
    // `absent` (alguien retiró la clave) o protegido: se conserva lo que hay en memoria, que es lo que se vuelve a escribir.
    if (read.doc) {
      const lineage = readLineage(read.raw);
      // Linaje lleno: no se puede probar nada; se da todo por incluido (no se repite a ciegas).
      const ambiguous = lineage.length >= LINEAGE_LENGTH;
      // Cada operación ya escrita se comprueba contra la escritura que la llevó: sólo se repone la que NO está.
      const included = (entry: JournalEntry<T>) => Boolean(entry.writeIds?.some((id) => lineage.includes(id)));
      const missing = ambiguous ? [] : core.unconfirmed.filter((entry) => !included(entry));
      core.unconfirmed = [];
      // Una operación ya repuesta (pendiente de reescribir) que resulta estar incluida por un intento anterior se descarta.
      if (!ambiguous) core.pending = core.pending.filter((entry) => !included(entry));
      if (missing.length > 0) {
        core.pending = [...missing, ...core.pending];
        core.dirty = true;
      }
      core.doc = replay(read.doc);
    }
    setProtection(current.key, read.status);
    return true;
  }, [replay]);

  /** Escribe `core.doc` (ya con el diario aplicado). Un fallo queda registrado por `device-storage`. */
  const writeNow = useCallback((): void => {
    const core = coreRef.current;
    if (!core.dirty && core.pending.length === 0) return;
    if (isBlocked()) {
      // Protegido: nada se escribe; los cambios viven sólo en memoria y no hay nada que reproducir después.
      core.pending = [];
      core.dirty = false;
      return;
    }
    const adopted = sync();
    // Arranque sobre un documento que otra pestaña acaba de crear o cambiar, sin operaciones nuestras que
    // reponer: se adopta el suyo y no se escribe el nuestro encima.
    if (adopted && core.pending.length === 0) {
      core.dirty = false;
      setDoc(core.doc);
      return;
    }
    const current = adapterRef.current;
    const id = newWriteId();
    const lineage = [...readLineage(core.raw), id].slice(-LINEAGE_LENGTH);
    const serialized = withLineage(current.serialize(core.doc), lineage);
    try {
      current.storage.setItem(current.key, serialized);
    } catch {
      return;
    }
    core.raw = serialized;
    core.status = "valid";
    core.lastWriteId = id;
    core.lastWriteAt = Date.now();
    core.unconfirmed = [...core.unconfirmed, ...core.pending.map((entry) => ({ ...entry, writeIds: [...(entry.writeIds ?? []), id] }))];
    core.pending = [];
    core.dirty = false;
    setDoc(core.doc);
    // Comprobar más tarde que la escritura sobrevivió (otra pestaña pudo escribir a la vez con una lectura anterior).
    setTimeout(() => verifyRef.current(), VERIFY_AFTER_MS);
  }, [isBlocked, sync]);

  /** Escritura diferida: dentro del Web Lock del documento y agrupando lo del mismo turno. */
  const scheduleFlush = useCallback((): void => {
    const core = coreRef.current;
    if (core.scheduled) return;
    core.scheduled = true;
    queueMicrotask(() => {
      runExclusive(adapterRef.current.key, () => {
        core.scheduled = false;
        writeNow();
      });
    });
  }, [writeNow]);

  /**
   * Comprobación posterior a una escritura: si lo almacenado cambió, `sync` aplica la prueba de linaje y repone
   * lo que no esté; si no cambió, la escritura sólo se da por confirmada tras un rato estable (una escritura
   * ajena puede tardar en llegar a la caché de esta pestaña).
   */
  useEffect(() => {
    verifyRef.current = () => {
      const core = coreRef.current;
      if (core.unconfirmed.length === 0) return;
      if (sync()) {
        setDoc(core.doc);
        if (core.pending.length > 0 || core.dirty) scheduleFlush();
        return;
      }
      if (Date.now() - core.lastWriteAt >= CONFIRM_AFTER_MS) core.unconfirmed = [];
      else setTimeout(() => verifyRef.current(), VERIFY_AFTER_MS);
    };
  }, [scheduleFlush, sync]);

  const update = useCallback<StoredDocumentUpdate<T>>(
    (action, guard) => {
      const core = coreRef.current;
      sync();
      const base = core.doc;
      if (guard && !guard.check(base)) {
        guard.onReject();
        setDoc(core.doc);
        return;
      }
      const apply = (value: T): T =>
        typeof action === "function" ? (action as (current: T) => T)(value) : action;
      const next = apply(base);
      if (!Object.is(next, base)) {
        core.doc = next;
        core.pending.push({ apply, guard });
        scheduleFlush();
      }
      setDoc(core.doc);
    },
    [scheduleFlush, sync]
  );

  useEffect(() => {
    const core = coreRef.current;
    setProtection(adapterRef.current.key, core.status);
    // El arranque normaliza lo migrado y crea el documento si no existía; un original protegido no se toca.
    scheduleFlush();

    const rehydrate = () => {
      if (!sync()) return;
      setDoc(core.doc);
      if (core.status === "absent") core.dirty = true;
      // Lo que se repuso encima (o la clave retirada) hay que escribirlo, y comprobar después que sobrevive.
      if (core.dirty || core.pending.length > 0) scheduleFlush();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === adapterRef.current.key) rehydrate();
    };
    // Al ocultarse o cerrarse la pestaña no hay tiempo para esperar un lock: lo pendiente se escribe ya.
    const flushNow = () => {
      core.scheduled = false;
      writeNow();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onHide);
    // Restauración o recuperación en ESTA pestaña: REEMPLAZA el documento; no se repone nada del diario.
    const unsubscribe = subscribeStorageReplaced(() => {
      core.pending = [];
      core.unconfirmed = [];
      rehydrate();
    });
    const unregister = registerFlusher(flushNow);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onHide);
      unsubscribe();
      unregister();
      flushNow();
    };
  }, [scheduleFlush, sync, writeNow]);

  return [doc, update];
}
