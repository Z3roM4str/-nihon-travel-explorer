import { useCallback, useEffect, useRef, useState } from "react";

/**
 * P-06·C — la superficie flotante abierta sobre Viaje › Días (hoja N2 o vista enfocada N3) y el
 * historial del navegador, en un solo sitio.
 *
 * Contrato (lo certifica `p06-v2-history-check.mjs`):
 *  - abrir una superficie empuja UNA entrada de historial (`state.nihonDias = <superficie>`);
 *  - «atrás» (gesto, botón, `history.back()`) la cierra y deja al usuario en Días, no en la pantalla anterior;
 *  - «adelante» sobre esa entrada la vuelve a abrir (si `isValid` sigue aceptándola; si no, se salta);
 *  - cerrar desde la UI (×, Escape, fondo, «Volver», terminar la acción) deshace nuestra entrada con
 *    `history.back()`, de modo que abrir y cerrar N veces no hace crecer la pila;
 *  - abrir mientras un cierre propio aún no ha llegado se encola (si no, el `back()` pendiente caería
 *    sobre la entrada nueva);
 *  - tras una recarga la entrada sobrante se limpia y se empieza en la lista (lo efímero no se restaura);
 *  - se conserva el resto del `state` (la pila de fichas de `App` guarda `nihonPlaceDepth` ahí).
 */
const KEY = "nihonDias";

type Options<S> = {
  /** Rechaza una superficie restaurada por «adelante» cuyo objetivo ya no existe. */
  isValid: (surface: S) => boolean;
};

export function useSurfaceHistory<S extends { kind: string }>({ isValid }: Options<S>) {
  const [surface, setSurface] = useState<S | null>(null);
  const surfaceRef = useRef<S | null>(null);
  const ownsEntryRef = useRef(false);
  const pendingBackRef = useRef(0);
  const queuedRef = useRef<S | null>(null);
  const isValidRef = useRef(isValid);
  useEffect(() => { isValidRef.current = isValid; });

  const commit = useCallback((next: S | null) => {
    surfaceRef.current = next;
    setSurface(next);
  }, []);

  const push = useCallback((next: S) => {
    const base = (window.history.state ?? {}) as Record<string, unknown>;
    window.history.pushState({ ...base, [KEY]: next }, "");
    ownsEntryRef.current = true;
  }, []);

  const open = useCallback((next: S) => {
    commit(next);
    if (pendingBackRef.current > 0) { queuedRef.current = next; return; }
    if (ownsEntryRef.current) {
      const base = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.replaceState({ ...base, [KEY]: next }, "");
    } else push(next);
  }, [commit, push]);

  const close = useCallback(() => {
    queuedRef.current = null;
    if (surfaceRef.current === null && !ownsEntryRef.current) return;
    commit(null);
    if (ownsEntryRef.current) {
      ownsEntryRef.current = false;
      pendingBackRef.current += 1;
      window.history.back();
    }
  }, [commit]);

  useEffect(() => {
    // Recarga con una entrada nuestra: se limpia; nunca se reabre estado efímero.
    const initial = (window.history.state ?? null) as Record<string, unknown> | null;
    if (initial && KEY in initial) {
      const { [KEY]: _dropped, ...rest } = initial;
      void _dropped;
      window.history.replaceState(rest, "");
    }
    function onPopState(event: PopStateEvent) {
      if (pendingBackRef.current > 0) {
        pendingBackRef.current -= 1;
        if (pendingBackRef.current === 0 && queuedRef.current) {
          const queued = queuedRef.current;
          queuedRef.current = null;
          push(queued);
        }
        return;
      }
      const state = event.state as Record<string, unknown> | null;
      const restored = (state?.[KEY] ?? null) as S | null;
      if (restored && isValidRef.current(restored)) {
        ownsEntryRef.current = true;
        commit(restored);
      } else if (restored) {
        // Entrada propia de una superficie que ya no existe: no se queda uno encima de ella; se salta.
        ownsEntryRef.current = false;
        commit(null);
        pendingBackRef.current += 1;
        window.history.back();
      } else {
        ownsEntryRef.current = false;
        commit(null);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [commit, push]);

  return { surface, open, close };
}
