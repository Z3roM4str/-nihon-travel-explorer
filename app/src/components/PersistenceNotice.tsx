import { useSyncExternalStore } from "react";
import { Icon } from "../icons/Icon";
import {
  getPersistenceState,
  retryPersistence,
  subscribePersistence,
} from "../lib/device-storage";

/**
 * DDR-03 / `04 §17` — el aviso de que Nihon no ha conseguido guardar en el dispositivo.
 *
 * Se renderiza **una sola vez**, en la raíz de la aplicación, desde la única fuente de verdad del
 * estado de persistencia (`lib/device-storage.ts`). No hay uno por destino: cuatro estados
 * independientes podrían discreparse entre sí, y en cuanto la ficha se abriese sobre Explorar
 * habría dos avisos a la vez.
 *
 * No es un `Toast` (`04 §16`): un `Toast` se va solo a los 2.400 ms, y este estado dura hasta que
 * se resuelva. Un aviso que desapareciera solo diría que el problema se fue solo.
 *
 * Mientras la persistencia funciona, **no renderiza nada** — ni un contenedor vacío, ni una región
 * en espera. Que aparezca en el DOM al entrar en error es justo lo que hace que `role="alert"` lo
 * anuncie, y `role="alert"` anuncia **sin mover el foco**: la persona puede seguir con lo que
 * estaba haciendo, que es precisamente lo que hay que comunicarle (puede seguir, pero sin
 * garantías).
 */
export function PersistenceNotice() {
  const state = useSyncExternalStore(subscribePersistence, getPersistenceState, getPersistenceState);

  if (state === "ok") return null;

  return (
    <div className="persistence-notice" role="alert">
      <span className="persistence-notice__icon" aria-hidden="true">
        <Icon name="aviso" size={20} />
      </span>
      <p className="persistence-notice__text">
        No pudimos guardar los cambios en este dispositivo. Pueden perderse al cerrar la app.
      </p>
      {/* `04 §17.6`: reintenta de verdad — reescribe la carga que falló por la misma vía. El
          módulo no oculta nada por su cuenta: si vuelve a fallar, el estado sigue en error y este
          aviso sigue aquí. */}
      <button
        type="button"
        className="button button--quiet persistence-notice__retry tap-target-min"
        onClick={() => retryPersistence()}
      >
        Reintentar
      </button>
    </div>
  );
}
