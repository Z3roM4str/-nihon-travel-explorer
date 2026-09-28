/**
 * DDR-03 — la única fuente de verdad del estado de persistencia.
 *
 * ## Por qué existe, y por qué NO es una capa nueva
 *
 * Todas las escrituras persistentes de Nihon ya pasaban por un adaptador inyectado con esta misma
 * forma (`getItem`/`setItem`/`removeItem`): `useTravellers`, `usePlanningDraft`,
 * `useZonePlanChoice` y `usePortableBackup` declaraban uno idéntico cada uno, y `useZoneComparison`
 * escribía en línea. El punto común ya estaba; lo que faltaba era que alguien mirase el resultado.
 *
 * Porque el resultado se tiraba: cada módulo puro envuelve su `setItem` en un `try/catch` que se
 * traga el error con un comentario («storage unavailable — the roster stays in memory for this
 * session»). La persona seguía marcando lugares, la interfaz confirmaba cada marca, y al cerrar no
 * quedaba nada. Eso es lo que DDR-03 corrige.
 *
 * ## La regla que hace esto seguro
 *
 * `setItem`/`removeItem` **vuelven a lanzar** el error después de registrarlo. Ni un solo módulo
 * puro cambia de comportamiento: sus `try/catch` siguen atrapando exactamente lo mismo, en el
 * mismo sitio, y el estado en memoria sigue conservándose igual. Lo único nuevo es que el fallo
 * deja de ser invisible.
 *
 * ## Qué recuerda, y por qué
 *
 * Una entrada pendiente por clave, con la carga exacta que no se pudo escribir. «Reintentar»
 * reescribe ESA carga — no un valor de prueba, no un borrado, no un reinicio: los datos de la
 * persona, tal cual se intentaron guardar (DDR-03, «no descartes ni resetees datos del usuario»).
 * Una escritura posterior con éxito sobre la misma clave también limpia su pendiente: ese estado
 * ya llegó al disco, y no hay nada que recuperar.
 *
 * `lib/onboarding.ts` NO pasa por aquí, a propósito: su clave es una preferencia de interfaz («ya
 * vi la explicación»), no un cambio de la persona sobre su viaje. Avisar de pérdida de datos antes
 * de que exista un dato que perder sería un falso positivo.
 */

export type PersistenceState = "ok" | "error";

/** Lo que no se pudo escribir: `value === null` representa un borrado pendiente. */
type PendingWrite = { key: string; value: string | null };

const pending = new Map<string, PendingWrite>();
const listeners = new Set<() => void>();

/** Instantánea inmutable: `useSyncExternalStore` compara por identidad, así que sólo cambia
 * cuando cambia el estado de verdad — si no, React entraría en un bucle de renders. */
let snapshot: PersistenceState = "ok";

function publish(): void {
  const next: PersistenceState = pending.size > 0 ? "error" : "ok";
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function record(key: string, value: string | null, failed: boolean): void {
  if (failed) pending.set(key, { key, value });
  else pending.delete(key);
  publish();
}

/**
 * El adaptador que usan todos los escritores persistentes. Misma forma estructural que los
 * `browserStorage` que sustituye, así que satisface `Storage`, `DraftStorage` y `RestoreStorage`
 * sin que ninguno de esos módulos tenga que saber que esto existe.
 */
export const deviceStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      // Leer puede fallar donde el almacenamiento está bloqueado del todo. No es una pérdida de
      // datos —no había nada que guardar—, así que no enciende el aviso: se lee como "vacío".
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      record(key, value, true);
      throw error;
    }
    record(key, value, false);
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      record(key, null, true);
      throw error;
    }
    record(key, null, false);
  },
};

export function subscribePersistence(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPersistenceState(): PersistenceState {
  return snapshot;
}

/**
 * Reintenta de verdad: reescribe cada carga pendiente por la misma vía que falló.
 *
 * No oculta nada por su cuenta — si las escrituras vuelven a fallar, las pendientes siguen ahí y
 * el estado sigue siendo de error, que es justo lo que DDR-03 exige. Devuelve el estado resultante
 * para que quien llame pueda anunciarlo sin volver a preguntar.
 */
export function retryPersistence(): PersistenceState {
  for (const entry of [...pending.values()]) {
    try {
      if (entry.value === null) localStorage.removeItem(entry.key);
      else localStorage.setItem(entry.key, entry.value);
      pending.delete(entry.key);
    } catch {
      // Sigue sin poder escribirse: la entrada se queda pendiente para el próximo intento.
    }
  }
  publish();
  return snapshot;
}

/** Sólo para pruebas: devuelve el módulo a su estado inicial entre casos. */
export function resetPersistenceForTests(): void {
  pending.clear();
  snapshot = "ok";
  listeners.clear();
}
