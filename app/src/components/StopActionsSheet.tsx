import { useState } from "react";
import type { Place } from "../types";
import { Sheet } from "./Sheet";

export type StopActionsDay = {
  /** «Día 2 · jue 25 feb · Kioto» — the same headline the day shows. */
  label: string;
  placeCount: number;
};

type Props = {
  place: Place;
  /** Index (0-based) of the day the stop is in and of the stop inside it. */
  dayIndex: number;
  placeIndex: number;
  days: readonly StopActionsDay[];
  /** `false` when removing would be a no-op for the model. */
  confirmRemoveNote: string;
  onMove: (toDayIndex: number, toPositionIndex: number) => void;
  onRemove: () => void;
  onClose: () => void;
};

type Step = "menu" | "move" | "remove";

/**
 * B27 (B9.1) — the single home for what the per-row `↑ ↓ ×` trio used to do (defect D10).
 *
 *  ↑ ↓ (within a day)   → «Mover a…» with an explicit day AND position;
 *  ← → (to the adjacent day, Día view only) → the same «Mover a…», pick another day;
 *  × («Quitar del recorrido», route composition) → «Quitar del recorrido», confirmed in words.
 *
 * INFRAESTRUCTURA MÍNIMA ADELANTADA POR CONSERVACIÓN DE CAPACIDAD: retiring `↑ ↓` in B9.1 would
 * otherwise leave no accessible way to change a stop's position or day before B9.2. B9.2 remains
 * responsible for the complete reordering system and drag-and-drop; this sheet has no drag, no
 * reorder animation and reuses the existing mutations verbatim (`relocatePlaceWithinDay`,
 * `movePlaceBetweenDays`).
 */
export function StopActionsSheet({
  place,
  dayIndex,
  placeIndex,
  days,
  confirmRemoveNote,
  onMove,
  onRemove,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>("menu");
  const [targetDay, setTargetDay] = useState(dayIndex);
  const [targetPosition, setTargetPosition] = useState(placeIndex);

  const target = days[targetDay];
  const positions = targetDay === dayIndex ? days[dayIndex].placeCount : (target?.placeCount ?? 0) + 1;
  const unchanged = targetDay === dayIndex && targetPosition === placeIndex;

  function changeDay(next: number) {
    setTargetDay(next);
    // A different day starts at its end; the own day starts where the stop already is.
    setTargetPosition(next === dayIndex ? placeIndex : days[next].placeCount);
  }

  return (
    <Sheet title={place.name} onClose={onClose} labelledBy="stop-actions-title">
      {step === "menu" && (
        <ul className="stop-actions__menu">
          <li>
            <button type="button" className="stop-actions__item" onClick={() => setStep("move")}>
              Mover a…
              <span className="stop-actions__hint">Elige el día y la posición.</span>
            </button>
          </li>
          <li>
            <button type="button" className="stop-actions__item" onClick={() => setStep("remove")}>
              Quitar del recorrido
              <span className="stop-actions__hint">Sigue en Quiero ir y pasa a «Sin asignar».</span>
            </button>
          </li>
        </ul>
      )}

      {step === "move" && (
        <form
          className="stop-actions__form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!unchanged) onMove(targetDay, targetPosition);
          }}
        >
          <label className="stop-actions__field">
            Día
            <select
              autoFocus
              value={targetDay}
              onChange={(event) => changeDay(Number(event.target.value))}
            >
              {days.map((day, index) => (
                <option key={index} value={index}>
                  {day.label}
                  {index === dayIndex ? " (actual)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="stop-actions__field">
            Posición en el día
            <select value={targetPosition} onChange={(event) => setTargetPosition(Number(event.target.value))}>
              {Array.from({ length: positions }, (_, index) => (
                <option key={index} value={index}>
                  {index + 1} de {positions}
                  {index === 0 ? " · al principio" : index === positions - 1 ? " · al final" : ""}
                  {targetDay === dayIndex && index === placeIndex ? " (actual)" : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="stop-actions__hint" role="status">
            {unchanged ? "Ya está en ese día y en esa posición." : ""}
          </p>
          <div className="stop-actions__buttons">
            <button type="submit" className="button button--primary" disabled={unchanged}>
              Mover aquí
            </button>
            <button type="button" className="button button--secondary" onClick={() => setStep("menu")}>
              Volver
            </button>
          </div>
        </form>
      )}

      {step === "remove" && (
        <div className="stop-actions__form">
          <p>
            Vas a quitar <strong>{place.name}</strong> del recorrido. Sigue guardado en Quiero ir.
          </p>
          <p className="stop-actions__hint">{confirmRemoveNote}</p>
          <div className="stop-actions__buttons">
            <button type="button" className="button button--primary" autoFocus onClick={onRemove}>
              Quitar del recorrido
            </button>
            <button type="button" className="button button--secondary" onClick={() => setStep("menu")}>
              Volver
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
