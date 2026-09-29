import { useEffect, useRef, useState } from "react";
import { MAX_TRAVELLERS, type Traveller } from "../lib/travellers";
import { PersonToken } from "./PersonToken";
import { Icon } from "../icons/Icon";

/**
 * Block 5 → B26 — «Nosotros › Viajeros» (`05 §11`, DD-007).
 *
 * Deja de ser un modal: es el contenido de la sección. Cada persona es una tarjeta con su
 * `PersonToken md`, el nombre editable, cuántos lugares ha marcado y —sin depender del color— si
 * es quien tiene este dispositivo. **Cambiar de persona activa ocurre aquí** y sólo aquí: el
 * conmutador «Eres» no vuelve a la cabecera.
 *
 * Se conserva íntegro lo de Block 5: renombrar, reiniciar, quitar y añadir (hasta
 * `MAX_TRAVELLERS`), con el número de lugares afectados a la vista ANTES de pulsar y una segunda
 * pulsación explícita para lo destructivo. Las posturas de una persona nunca pasan a la otra.
 * Cambiar de persona activa no toca ninguna preferencia: sólo dice quién sostiene el dispositivo.
 */
export function TravellerManager({
  travellers,
  activeTravellerId,
  placesOnlyWantedBy,
  placesMarkedBy,
  onSelect,
  onRename,
  onReset,
  onRemove,
  onAdd,
}: {
  travellers: readonly Traveller[];
  activeTravellerId: string | null;
  placesOnlyWantedBy: (travellerId: string) => number;
  placesMarkedBy: (travellerId: string) => number;
  onSelect: (travellerId: string) => void;
  onRename: (travellerId: string, label: string) => void;
  onReset: (travellerId: string) => void;
  onRemove: (travellerId: string) => void;
  onAdd: (label: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  /** `{ id, action }` while a destructive step is waiting for a second, explicit press. */
  const [confirming, setConfirming] = useState<{ id: string; action: "reset" | "remove" } | null>(
    null
  );
  /** Frase para la región `role="status"`: anuncia el cambio de persona activa. */
  const [announcement, setAnnouncement] = useState("");
  /** Qué elemento recibe el foco tras la próxima renderización (el que lo tenía desaparece). */
  const focusTargetRef = useRef<string | null>(null);
  const setFocusTarget = (key: string | null) => {
    focusTargetRef.current = key;
  };

  // Sin dependencias a propósito: corre tras cada renderización y consume el destino pendiente,
  // de modo que el foco se coloca cuando el elemento nuevo ya existe en el DOM.
  useEffect(() => {
    const key = focusTargetRef.current;
    if (!key) return;
    focusTargetRef.current = null;
    rootRef.current?.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)?.focus();
  });

  const activeTraveller = travellers.find((entry) => entry.id === activeTravellerId) ?? null;

  return (
    <div className="traveller-manager" ref={rootRef}>
      <p className="traveller-manager__sub">
        Sólo cambia de quién es cada «Quiero ir». El recorrido, los días, las fechas y el
        alojamiento son del viaje y los compartís los dos.
      </p>

      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      <ul className="traveller-manager__list">
        {travellers.map((traveller, index) => {
          const exclusive = placesOnlyWantedBy(traveller.id);
          const marked = placesMarkedBy(traveller.id);
          const isActive = traveller.id === activeTravellerId;
          const isConfirmingReset =
            confirming?.id === traveller.id && confirming.action === "reset";
          const isConfirmingRemove =
            confirming?.id === traveller.id && confirming.action === "remove";

          return (
            <li
              key={traveller.id}
              className={`traveller-card ${isActive ? "traveller-card--active" : ""}`.trim()}
              aria-label={traveller.label}
            >
              <div className="traveller-card__head">
                <PersonToken
                  traveller={traveller}
                  variant={index === 0 ? "a" : "b"}
                  size="md"
                  label={traveller.label}
                />
                <NameField
                  traveller={traveller}
                  onRename={onRename}
                  focusKey={`name-${traveller.id}`}
                />
              </div>

              <p className="traveller-card__marked">
                <span className="traveller-card__marked-label">Marcados: </span>
                <span className="traveller-card__marked-count">
                  {marked} lugar{marked === 1 ? "" : "es"}
                </span>
              </p>

              {isActive ? (
                <p
                  className="traveller-card__status"
                  tabIndex={-1}
                  data-focus-key={`active-${traveller.id}`}
                >
                  <Icon name="confirmado" size={16} aria-hidden="true" />
                  <span>Este dispositivo lo usa {traveller.label}</span>
                </p>
              ) : (
                <button
                  type="button"
                  className="button button--secondary traveller-card__use"
                  onClick={() => {
                    onSelect(traveller.id);
                    setAnnouncement(`Ahora Nihon se usa como ${traveller.label}.`);
                    setFocusTarget(`active-${traveller.id}`);
                  }}
                >
                  Usar este dispositivo como {traveller.label}
                </button>
              )}

              <p className="traveller-card__meta">
                {exclusive === 0
                  ? "Ningún lugar de la lista depende sólo de esta persona."
                  : `${exclusive} lugar${exclusive === 1 ? "" : "es"} de la lista ${
                      exclusive === 1 ? "está" : "están"
                    } sólo porque lo quiere esta persona.`}
              </p>

              <div className="traveller-card__actions">
                {isConfirmingReset ? (
                  <div className="traveller-manager__confirm" role="alert">
                    <p className="traveller-manager__confirm-text">
                      Se borrará todo lo que ha dicho
                      {exclusive > 0 && (
                        <>
                          {" "}
                          y {exclusive} lugar{exclusive === 1 ? "" : "es"} saldrá
                          {exclusive === 1 ? "" : "n"} de la lista
                        </>
                      )}
                      . Lo que dijo la otra persona no se toca.
                    </p>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => {
                        onReset(traveller.id);
                        setConfirming(null);
                        setFocusTarget(`reset-${traveller.id}`);
                      }}
                    >
                      Sí, reiniciar
                    </button>
                    <button
                      type="button"
                      className="button button--quiet"
                      data-focus-key={`cancel-${traveller.id}`}
                      onClick={() => {
                        setConfirming(null);
                        setFocusTarget(`reset-${traveller.id}`);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="button button--secondary"
                    data-focus-key={`reset-${traveller.id}`}
                    onClick={() => {
                      setConfirming({ id: traveller.id, action: "reset" });
                      setFocusTarget(`cancel-${traveller.id}`);
                    }}
                    aria-label={`Reiniciar lo que ha guardado ${traveller.label}`}
                  >
                    Reiniciar
                  </button>
                )}

                {isConfirmingRemove ? (
                  <div className="traveller-manager__confirm" role="alert">
                    <p className="traveller-manager__confirm-text">
                      Se quitará a {traveller.label} y todo lo que ha dicho
                      {exclusive > 0 && (
                        <>
                          {" "}
                          ({exclusive} lugar{exclusive === 1 ? "" : "es"} saldrá
                          {exclusive === 1 ? "" : "n"} de la lista)
                        </>
                      )}
                      . Nada pasa a la otra persona.
                    </p>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => {
                        onRemove(traveller.id);
                        setConfirming(null);
                        // La tarjeta desaparece: el foco pasa al nombre de la persona que queda.
                        const remaining = travellers.find((entry) => entry.id !== traveller.id);
                        setFocusTarget(remaining ? `name-${remaining.id}` : null);
                      }}
                    >
                      Sí, quitar
                    </button>
                    <button
                      type="button"
                      className="button button--quiet"
                      data-focus-key={`cancel-${traveller.id}`}
                      onClick={() => {
                        setConfirming(null);
                        setFocusTarget(`remove-${traveller.id}`);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="button button--secondary"
                    data-focus-key={`remove-${traveller.id}`}
                    onClick={() => {
                      setConfirming({ id: traveller.id, action: "remove" });
                      setFocusTarget(`cancel-${traveller.id}`);
                    }}
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
          <p className="traveller-manager__add-hint">Este viaje está pensado para dos personas.</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => onAdd(`Persona ${travellers.length + 1}`)}
          >
            <Icon name="mas" size={16} aria-hidden="true" /> Añadir a la segunda persona
          </button>
        </div>
      )}

      <p className="traveller-manager__note">
        Todo esto vive sólo en este navegador. No hay cuentas, ni servidor, ni sincronización entre
        dispositivos.
        {activeTraveller ? "" : " Ninguna persona está usando este dispositivo ahora mismo."}
      </p>
    </div>
  );
}

/**
 * Campo de nombre. Guarda cada cambio no vacío en cuanto se escribe (igual que antes), pero
 * mantiene un borrador propio: `withTravellerLabel` rechaza una etiqueta en blanco, y con un
 * campo totalmente controlado por el nombre guardado no se podría borrar para reescribir. Al
 * salir del campo, el borrador vuelve al nombre guardado — nunca se guarda un nombre vacío.
 */
function NameField({
  traveller,
  onRename,
  focusKey,
}: {
  traveller: Traveller;
  onRename: (travellerId: string, label: string) => void;
  focusKey: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputId = `traveller-label-${traveller.id}`;
  return (
    <label className="traveller-card__field" htmlFor={inputId}>
      <span className="traveller-card__field-label">Nombre</span>
      <input
        id={inputId}
        className="traveller-manager__input"
        type="text"
        autoComplete="off"
        data-focus-key={focusKey}
        value={draft ?? traveller.label}
        onChange={(event) => {
          setDraft(event.target.value);
          if (event.target.value.trim().length > 0) onRename(traveller.id, event.target.value);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}
