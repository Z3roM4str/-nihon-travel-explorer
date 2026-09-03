import type { Place } from "../types";
import { formatRange, resolveDuration } from "../lib/duration";
import { summarizeSelection } from "../lib/selection";

type Props = {
  savedPlaces: Place[];
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  open: boolean;
  onToggle: () => void;
  onAnalyze: () => void;
};

/** Below this many saved places the grouped view has nothing to group. */
const ANALYSIS_MIN_SAVED = 3;

export function SelectionPanel({
  savedPlaces,
  onRemove,
  onSelect,
  open,
  onToggle,
  onAnalyze,
}: Props) {
  const summary = summarizeSelection(savedPlaces);

  return (
    <section className="selection-panel" aria-label="Lugares guardados">
      <button type="button" className="selection-panel__toggle" onClick={onToggle} aria-expanded={open}>
        <span className="selection-panel__title">
          <span aria-hidden="true">📍</span> Quiero ir
          <span className="selection-panel__count">{summary.savedCount}</span>
        </span>
        <span
          className={`selection-panel__hint ${
            summary.savedCount === 0 ? "selection-panel__hint--placeholder" : ""
          }`}
        >
          {summary.savedCount === 0 ? (
            "Guarda lugares desde su ficha"
          ) : summary.visitTime ? (
            <>
              <span className="visually-hidden">Tiempo estimado de visita: </span>
              {formatRange(summary.visitTime)} de visita
            </>
          ) : (
            "Sin estimación numérica"
          )}
        </span>
        <span aria-hidden="true" className="selection-panel__chevron">
          {open ? "▾" : "▴"}
        </span>
      </button>

      {open && (
        <div className="selection-panel__content">
          {summary.savedCount === 0 ? (
            <p className="selection-panel__empty">
              Aún no has guardado lugares. Abre una ficha y pulsa <strong>Quiero ir</strong> para
              añadirla aquí.
            </p>
          ) : (
            <>
              <div className="selection-panel__summary">
                <div className="selection-panel__metric">
                  <span className="selection-panel__metric-value">{summary.savedCount}</span>
                  <span className="selection-panel__metric-label">
                    lugar{summary.savedCount === 1 ? "" : "es"} guardado
                    {summary.savedCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="selection-panel__metric">
                  <span className="selection-panel__metric-value">
                    {summary.visitTime ? formatRange(summary.visitTime) : "—"}
                  </span>
                  <span className="selection-panel__metric-label">
                    tiempo estimado de visita
                    {summary.nonQuantified.length > 0 && (
                      <> ({summary.nonQuantified.length} sin estimación numérica)</>
                    )}
                  </span>
                </div>
                {summary.commitmentCount > 0 && (
                  <div className="selection-panel__metric">
                    <span className="selection-panel__metric-value">{summary.commitmentCount}</span>
                    <span className="selection-panel__metric-label">
                      con compromiso de jornada, fuera de la suma de horas
                    </span>
                  </div>
                )}
                <p className="selection-panel__disclaimer">
                  <span aria-hidden="true">ⓘ</span> Solo tiempo dentro de cada lugar.{" "}
                  <strong>No incluye traslados.</strong>
                </p>
                {summary.savedCount >= ANALYSIS_MIN_SAVED && (
                  <button
                    type="button"
                    className="button button--secondary selection-panel__analyze"
                    onClick={onAnalyze}
                  >
                    <span aria-hidden="true">▤</span> Analizar selección
                  </button>
                )}
              </div>

              <ul className="selection-list">
                {savedPlaces.map((place) => {
                  const range = resolveDuration(place.duration);
                  return (
                    <li key={place.id} className="selection-list__item">
                      <button type="button" className="selection-list__name" onClick={() => onSelect(place.id)}>
                        <span>{place.name}</span>
                        <span className="selection-list__duration">
                          {range ? formatRange(range) : place.duration.raw}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--small"
                        aria-label={`Quitar ${place.name} de Quiero ir`}
                        onClick={() => onRemove(place.id)}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
