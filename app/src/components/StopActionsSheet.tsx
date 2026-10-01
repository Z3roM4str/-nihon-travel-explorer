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
  /** `null` for a «Sin asignar» place («Añadir al día…»). */
  dayIndex: number | null;
  placeIndex: number | null;
  days: readonly StopActionsDay[];
  /** `false` when removing would be a no-op for the model. */
  confirmRemoveNote: string;
  onMove: (toDayIndex: number, toPositionIndex: number) => void;
  onRemove: () => void;
  onClose: () => void;
};

type Step = "menu" | "move" | "remove";

/**
 * B27 (B9.1) → B28 (B9.2) — the keyboard/touch-complete alternative to dragging.
 *
 *  «Mover a…»           day AND position (same day or another), for a stop that is in a day;
 *  «Quitar del día» the stop goes to «Sin asignar» (no split rebuild since B9.2);
 *  «Añadir al día…»     for a «Sin asignar» place (`dayIndex === null`): day AND position, straight
 *                       into the form — no rebuild of the rest of the trip.
 *
 * Dragging is a convenience over this sheet, never a replacement: everything the handle can do is
 * reachable here with a select and a button.
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
  const adding = dayIndex === null || placeIndex === null;
  const [step, setStep] = useState<Step>(adding ? "move" : "menu");
  const [targetDay, setTargetDay] = useState(dayIndex ?? Math.max(0, days.length - 1));
  const [targetPosition, setTargetPosition] = useState(
    placeIndex ?? days[Math.max(0, days.length - 1)]?.placeCount ?? 0
  );

  const target = days[targetDay];
  const positions = targetDay === dayIndex ? days[targetDay].placeCount : (target?.placeCount ?? 0) + 1;
  const unchanged = !adding && targetDay === dayIndex && targetPosition === placeIndex;

  function changeDay(next: number) {
    setTargetDay(next);
    // A different day starts at its end; the own day starts where the stop already is.
    setTargetPosition(next === dayIndex && placeIndex !== null ? placeIndex : days[next].placeCount);
  }

  return (
    <Sheet title={adding ? `Añadir ${place.name} al día` : place.name} onClose={onClose} labelledBy="stop-actions-title">
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
              Quitar del día
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
              {adding ? "Añadir aquí" : "Mover aquí"}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => (adding ? onClose() : setStep("menu"))}
            >
              {adding ? "Cancelar" : "Volver"}
            </button>
          </div>
        </form>
      )}

      {step === "remove" && (
        <div className="stop-actions__form">
          <p>
            Vas a quitar <strong>{place.name}</strong> del día. Sigue guardado en Quiero ir.
          </p>
          <p className="stop-actions__hint">{confirmRemoveNote}</p>
          <div className="stop-actions__buttons">
            <button type="button" className="button button--primary" autoFocus onClick={onRemove}>
              Quitar del día
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
