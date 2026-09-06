import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "../types";
import { formatRange } from "../lib/duration";
import { summarizeSelection } from "../lib/selection";
import { buildOrderedSequence, type OrderedSequenceLeg } from "../lib/ordered-sequence";
import { describeTransferForUi, transferModeIcon } from "../lib/transfer-display";

type Props = {
  /** The wishlist, in its saved order — the source the route draft is initialized from and
   * the set a place can be added back from. Never mutated: removing a place from the route
   * here does not unsave it, and this component never calls anything that changes "Quiero ir". */
  savedPlaces: Place[];
  onClose: () => void;
};

/**
 * Phase 3C-A — Ordered Sequence Builder.
 *
 * The user defines an explicit order over (a subset of) their saved places; this component
 * describes the logistics of THAT EXACT ORDER via `buildOrderedSequence`. It never chooses,
 * suggests, or optimises an order itself — see `ordered-sequence.ts` for the guarantees that
 * rests on.
 *
 * The route draft is local component state, separate from "Quiero ir": it is initialized from
 * `savedPlaces` once, on mount (this component is conditionally rendered rather than always
 * mounted, so a fresh mount is exactly "the builder opens" — the same lifecycle
 * `SelectionAnalysis` already relies on). It is never persisted — no new localStorage key,
 * no change to the existing saved-ids format.
 */

function LegConnector({ leg }: { leg: OrderedSequenceLeg }) {
  if (!leg.transfer) {
    return (
      <p className="sequence-leg sequence-leg--unknown">
        <span aria-hidden="true">❓</span> Sin traslado registrado
      </p>
    );
  }
  const display = describeTransferForUi(leg.transfer);
  return (
    <p className="sequence-leg">
      <span aria-hidden="true">{transferModeIcon(leg.transfer.mode)}</span> {display.timeText} ·{" "}
      {display.qualityLabel}
    </p>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function OrderedSequenceBuilder({ savedPlaces, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const placeById = useMemo(() => new Map(savedPlaces.map((place) => [place.id, place])), [savedPlaces]);
  const [routeIds, setRouteIds] = useState<string[]>(() => savedPlaces.map((place) => place.id));

  const routePlaces = useMemo(
    () => routeIds.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place)),
    [routeIds, placeById]
  );
  const removedPlaces = useMemo(
    () => savedPlaces.filter((place) => !routeIds.includes(place.id)),
    [savedPlaces, routeIds]
  );

  const sequence = useMemo(() => buildOrderedSequence(routeIds), [routeIds]);
  const visitSummary = useMemo(() => summarizeSelection(routePlaces), [routePlaces]);

  function moveUp(index: number) {
    if (index <= 0) return;
    setRouteIds((ids) => {
      const next = [...ids];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setRouteIds((ids) => {
      if (index >= ids.length - 1) return ids;
      const next = [...ids];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function removeFromRoute(id: string) {
    setRouteIds((ids) => ids.filter((existing) => existing !== id));
  }

  function addToRoute(id: string) {
    setRouteIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }

  // Same focus-management/backdrop-trap pattern as SelectionAnalysis: focus moves into the
  // dialog on open and returns to whatever opened it on close; Escape closes; Tab cycles
  // inside the dialog so the map behind never takes focus.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null
      );
      if (focusable.length === 0) return;
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
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const { legCount, knownLegCount, unknownLegCount, transferMinutes, complete } = sequence.summary;

  return (
    <div className="analysis-overlay">
      <div className="analysis-backdrop" onClick={onClose} role="presentation" aria-hidden="true" />
      <div
        ref={dialogRef}
        className="analysis-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sequence-builder-title"
      >
        <header className="analysis-header">
          <div>
            <h2 id="sequence-builder-title">Construir recorrido</h2>
            <p className="analysis-header__sub">
              {routePlaces.length} lugar{routePlaces.length === 1 ? "" : "es"} en el recorrido
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar el constructor de recorrido"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="analysis-body">
          <p className="analysis-disclaimer">
            <span aria-hidden="true">ⓘ</span> Tú eliges el orden con las flechas. Nihon describe
            los traslados de ese orden exacto; <strong>no sugiere ni calcula el mejor orden</strong>.
          </p>

          {routePlaces.length === 0 ? (
            <p className="sequence-empty">
              El recorrido está vacío. Añade lugares guardados desde la lista de abajo.
            </p>
          ) : (
            <>
              <ol className="sequence-list">
                {routePlaces.map((place, index) => (
                  <li key={place.id} className="sequence-item">
                    <div className="sequence-item__row">
                      <span className="sequence-item__index" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="sequence-item__name">{place.name}</span>
                      <div className="sequence-item__controls">
                        <button
                          type="button"
                          className="icon-button icon-button--small"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          aria-label={`Mover ${place.name} hacia arriba`}
                        >
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--small"
                          onClick={() => moveDown(index)}
                          disabled={index === routePlaces.length - 1}
                          aria-label={`Mover ${place.name} hacia abajo`}
                        >
                          <span aria-hidden="true">↓</span>
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--small"
                          onClick={() => removeFromRoute(place.id)}
                          aria-label={`Quitar ${place.name} del recorrido`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    </div>
                    {index < sequence.legs.length && <LegConnector leg={sequence.legs[index]} />}
                  </li>
                ))}
              </ol>

              <div className="analysis-totals">
                <div className="analysis-total">
                  <span className="analysis-total__value">
                    {visitSummary.visitTime ? formatRange(visitSummary.visitTime) : "—"}
                  </span>
                  <span className="analysis-total__label">
                    tiempo de visita
                    {visitSummary.nonQuantified.length > 0 && (
                      <> ({visitSummary.nonQuantified.length} sin estimación numérica)</>
                    )}
                  </span>
                </div>
                {legCount > 0 && (
                  <div className="analysis-total">
                    <span className="analysis-total__value">
                      {transferMinutes ? formatRange(transferMinutes) : "—"}
                    </span>
                    <span className="analysis-total__label">
                      {complete ? "traslados totales" : "traslados conocidos"} · {knownLegCount}/
                      {legCount} tramo{legCount === 1 ? "" : "s"} cubierto{legCount === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
                {unknownLegCount > 0 && (
                  <div className="analysis-total">
                    <span className="analysis-total__value">{unknownLegCount}</span>
                    <span className="analysis-total__label">
                      tramo{unknownLegCount === 1 ? "" : "s"} sin traslado registrado
                    </span>
                  </div>
                )}
                {visitSummary.commitmentCount > 0 && (
                  <div className="analysis-total">
                    <span className="analysis-total__value">{visitSummary.commitmentCount}</span>
                    <span className="analysis-total__label">
                      con compromiso de jornada, fuera de la suma de horas
                    </span>
                  </div>
                )}
              </div>

              <p className="analysis-disclaimer">
                <span aria-hidden="true">ⓘ</span> Los traslados conocidos usan la misma
                clasificación que la ficha de cada lugar: rutas validadas, estimaciones geográficas
                u horarios en vivo. <strong>No incluyen tiempo dentro de cada lugar.</strong>
              </p>
            </>
          )}

          {removedPlaces.length > 0 && (
            <section className="analysis-section">
              <h3>Guardados fuera del recorrido</h3>
              <p className="analysis-section__note">
                Siguen en <strong>Quiero ir</strong>. Añádelos aquí si quieres incluirlos en este
                recorrido.
              </p>
              <ul className="analysis-place-list">
                {removedPlaces.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      className="analysis-place"
                      onClick={() => addToRoute(place.id)}
                      aria-label={`Añadir ${place.name} al recorrido`}
                    >
                      <span>{place.name}</span>
                      <span aria-hidden="true">＋</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
