import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import {
  isProtectedStatus,
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
 *    cambios en lugar de pisarse. Sólo dentro de un mismo turno de JavaScript es posible que haya
 *    una escritura entre la comprobación y el `setItem`, y ahí no puede entrar otra pestaña.
 * 2. **La escritura es síncrona con la mutación.** No hay una ventana «el estado ya cambió pero
 *    aún no se ha escrito» durante la que otro cambio pueda llegar por debajo.
 * 3. **Un documento inválido o de versión futura se protege.** El hook sirve un valor inicial EN
 *    MEMORIA para que la aplicación siga siendo utilizable, pero no escribe sobre el original hasta
 *    que la persona elija la salida explícita (`startFresh`).
 * 4. **Las escrituras externas se adoptan.** El evento `storage` (otras pestañas) y
 *    `notifyStorageReplaced` (restauración o recuperación en ESTA pestaña) hacen que el hook relea y
 *    renderice lo que hay, sin esperar a una recarga.
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

type Core<T> = {
  doc: T;
  /** La última cadena de almacenamiento que este hook leyó o escribió. */
  raw: string | null;
  status: StoredRead<T>["status"];
};

export function useStoredDocument<T>(
  adapter: StoredDocumentAdapter<T>
): [T, (action: SetStateAction<T>) => void] {
  const adapterRef = useRef(adapter);
  useEffect(() => {
    adapterRef.current = adapter;
  });

  // El estado mutable de este hook (el documento vigente y lo último leído del almacenamiento). La
  // lectura inicial se hace UNA vez, en el inicializador perezoso de `useState`; el `ref` la recibe
  // como valor inicial, así que nunca se lee `ref.current` durante el render.
  const [initialCore] = useState<Core<T>>(() => {
    const read = adapter.read();
    return { doc: read.doc ?? adapter.initial(), raw: read.raw, status: read.status };
  });
  const coreRef = useRef<Core<T>>(initialCore);
  const [doc, setDoc] = useState<T>(initialCore.doc);

  const isBlocked = useCallback(
    (): boolean =>
      isProtectedStatus(coreRef.current.status) || (adapterRef.current.externallyBlocked?.() ?? false),
    []
  );

  /** Escribe `next`, si no hay protección. Un fallo queda registrado por `device-storage`. */
  const persist = useCallback(
    (next: T) => {
      if (isBlocked()) return;
      const current = adapterRef.current;
      const serialized = current.serialize(next);
      try {
        current.storage.setItem(current.key, serialized);
      } catch {
        return;
      }
      coreRef.current.raw = serialized;
      coreRef.current.status = "valid";
    },
    [isBlocked]
  );

  /** Si el almacenamiento cambió por debajo de este hook, lo relee. `true` si cambió. */
  const sync = useCallback((): boolean => {
    const current = adapterRef.current;
    let now: string | null;
    try {
      now = current.storage.getItem(current.key);
    } catch {
      return false;
    }
    if (now === coreRef.current.raw) return false;
    const read = current.read();
    coreRef.current.raw = read.raw;
    coreRef.current.status = read.status;
    // `absent` (alguien retiró la clave) conserva lo que hay en memoria: es lo que se vuelve a escribir.
    if (read.doc) coreRef.current.doc = read.doc;
    setProtection(current.key, read.status);
    return true;
  }, []);

  const update = useCallback(
    (action: SetStateAction<T>) => {
      sync();
      const base = coreRef.current.doc;
      const next = typeof action === "function" ? (action as (current: T) => T)(base) : action;
      if (!Object.is(next, base)) {
        coreRef.current.doc = next;
        persist(next);
      }
      setDoc(coreRef.current.doc);
    },
    [persist, sync]
  );

  useEffect(() => {
    setProtection(adapterRef.current.key, coreRef.current.status);
    // El arranque normaliza lo migrado y crea el documento si no existía; un original protegido no se toca.
    persist(coreRef.current.doc);

    const rehydrate = () => {
      if (!sync()) return;
      setDoc(coreRef.current.doc);
      if (coreRef.current.status === "absent") persist(coreRef.current.doc);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === adapterRef.current.key) rehydrate();
    };
    window.addEventListener("storage", onStorage);
    const unsubscribe = subscribeStorageReplaced(rehydrate);
    return () => {
      window.removeEventListener("storage", onStorage);
      unsubscribe();
    };
  }, [persist, sync]);

  return [doc, update];
}
