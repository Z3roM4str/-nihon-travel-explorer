import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_TRAVELLERS, type Traveller } from "../lib/travellers";

/**
 * Block 5 — the one modal the two-person layer has.
 *
 * It is opened deliberately from the header's gear, never by the app, and it is where the rare,
 * deliberate operations live: renaming a person, clearing what they have said, and removing them.
 *
 * **Nothing destructive happens without the number being on screen first.** Resetting or removing
 * someone can take places out of the shared shortlist — and, downstream, out of the planner's
 * route — so the count of places only that person wants is stated next to the button, before it is
 * pressed, and again in the confirmation. A traveller's stances are never reattributed to the
 * other person: when they are gone, they are gone.
 */
export function TravellerManager({
  travellers,
  activeTravellerId,
  placesOnlyWantedBy,
  onRename,
  onReset,
  onRemove,
  onAdd,
  onClose,
}: {
  travellers: readonly Traveller[];
  activeTravellerId: string | null;
  placesOnlyWantedBy: (travellerId: string) => number;
  onRename: (travellerId: string, label: string) => void;
  onReset: (travellerId: string) => void;
  onRemove: (travellerId: string) => void;
  onAdd: (label: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** `{ travellerId, action }` while a destructive step is waiting for a second, explicit press. */
  const [confirming, setConfirming] = useState<{ id: string; action: "reset" | "remove" } | null>(
    null
  );

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (confirming) {
          setConfirming(null);
          return;
        }
        close();
        return;
      }
      if (event.key !== "Tab") return;
      // Same minimal focus trap the onboarding dialog uses: while this is open, nothing behind the
      // backdrop can take focus.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input"
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [close, confirming]);

  return (
    <div
      className="traveller-manager"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="traveller-manager__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="traveller-manager-title"
        ref={dialogRef}
      >
        <header className="traveller-manager__head">
          <div>
            <h2 id="traveller-manager-title">Las personas del viaje</h2>
            <p className="traveller-manager__sub">
              Sólo cambia de quién es cada «Quiero ir». El recorrido, los días, las fechas y el
              alojamiento son del viaje y los compartís los dos.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            ref={closeRef}
            aria-label="Cerrar las personas del viaje"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <ul className="traveller-manager__list">
          {travellers.map((traveller) => {
            const exclusive = placesOnlyWantedBy(traveller.id);
            const isConfirmingReset =
              confirming?.id === traveller.id && confirming.action === "reset";
            const isConfirmingRemove =
              confirming?.id === traveller.id && confirming.action === "remove";
            const inputId = `traveller-label-${traveller.id}`;

            return (
              <li key={traveller.id} className="traveller-manager__item">
                <label className="traveller-manager__field" htmlFor={inputId}>
                  Nombre
                  <input
                    id={inputId}
                    className="traveller-manager__input"
                    type="text"
                    value={traveller.label}
                    onChange={(event) => onRename(traveller.id, event.target.value)}
                  />
                </label>

                <p className="traveller-manager__meta">
                  {traveller.id === activeTravellerId && (
                    <span className="traveller-manager__badge">Estás usando este perfil</span>
                  )}{" "}
                  {exclusive === 0
                    ? "Ningún lugar de la lista depende sólo de esta persona."
                    : `${exclusive} lugar${exclusive === 1 ? "" : "es"} de la lista ${
                        exclusive === 1 ? "está" : "están"
                      } sólo porque lo quiere esta persona.`}
                </p>

                <div className="traveller-manager__actions">
                  {isConfirmingReset ? (
                    <span className="traveller-manager__confirm" role="alert">
                      <span className="traveller-manager__confirm-text">
                        Se borrará todo lo que ha dicho
                        {exclusive > 0 && (
                          <>
                            {" "}
                            y {exclusive} lugar{exclusive === 1 ? "" : "es"} saldrá
                            {exclusive === 1 ? "" : "n"} de la lista
                          </>
                        )}
                        . Lo que dijo la otra persona no se toca.
                      </span>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => {
                          onReset(traveller.id);
                          setConfirming(null);
                        }}
                      >
                        Sí, reiniciar
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setConfirming(null)}
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => setConfirming({ id: traveller.id, action: "reset" })}
                      aria-label={`Reiniciar lo que ha guardado ${traveller.label}`}
                    >
                      Reiniciar
                    </button>
                  )}

                  {isConfirmingRemove ? (
                    <span className="traveller-manager__confirm" role="alert">
                      <span className="traveller-manager__confirm-text">
                        Se quitará a {traveller.label} y todo lo que ha dicho
                        {exclusive > 0 && (
                          <>
                            {" "}
                            ({exclusive} lugar{exclusive === 1 ? "" : "es"} saldrá
                            {exclusive === 1 ? "" : "n"} de la lista)
                          </>
                        )}
                        . Nada pasa a la otra persona.
                      </span>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => {
                          onRemove(traveller.id);
                          setConfirming(null);
                        }}
                      >
                        Sí, quitar
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setConfirming(null)}
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => setConfirming({ id: traveller.id, action: "remove" })}
                      disabled={travellers.length <= 1}
                      aria-label={`Quitar a ${traveller.label} del viaje`}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {travellers.length < MAX_TRAVELLERS && (
          <div className="traveller-manager__add">
            <p className="traveller-manager__add-hint">
              Este viaje está pensado para dos personas.
            </p>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => onAdd(`Persona ${travellers.length + 1}`)}
            >
              <span aria-hidden="true">＋</span> Añadir a la segunda persona
            </button>
          </div>
        )}

        <p className="traveller-manager__note">
          Todo esto vive sólo en este navegador. No hay cuentas, ni servidor, ni sincronización
          entre dispositivos.
        </p>
      </div>
    </div>
  );
}
