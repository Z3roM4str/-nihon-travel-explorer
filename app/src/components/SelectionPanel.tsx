import type { Place } from "../types";
import { formatRange, resolveDuration, sumVisitTime } from "../lib/duration";

type Props = {
  savedPlaces: Place[];
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  open: boolean;
  onToggle: () => void;
};

export function SelectionPanel({ savedPlaces, onRemove, onSelect, open, onToggle }: Props) {
  const totals = sumVisitTime(savedPlaces);

  return (
    <section className="selection-panel" aria-label="Lugares guardados">
      <button type="button" className="selection-panel__toggle" onClick={onToggle} aria-expanded={open}>
        <span className="selection-panel__title">
          <span aria-hidden="true">📍</span> Quiero ir
          <span className="selection-panel__count">{savedPlaces.length}</span>
        </span>
        <span
          className={`selection-panel__hint ${
            savedPlaces.length === 0 ? "selection-panel__hint--placeholder" : ""
          }`}
        >
          {savedPlaces.length === 0 ? (
            "Guarda lugares desde su ficha"
          ) : totals.estimated ? (
            <>
              <span className="visually-hidden">Tiempo estimado de visita: </span>
              {formatRange(totals.estimated)} de visita
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
          {savedPlaces.length === 0 ? (
            <p className="selection-panel__empty">
              Aún no has guardado lugares. Abre una ficha y pulsa <strong>Quiero ir</strong> para
              añadirla aquí.
            </p>
          ) : (
            <>
              <div className="selection-panel__summary">
                <div className="selection-panel__metric">
                  <span className="selection-panel__metric-value">{totals.saved}</span>
                  <span className="selection-panel__metric-label">
                    lugar{totals.saved === 1 ? "" : "es"} guardado{totals.saved === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="selection-panel__metric">
                  <span className="selection-panel__metric-value">
                    {totals.estimated ? formatRange(totals.estimated) : "—"}
                  </span>
                  <span className="selection-panel__metric-label">
                    tiempo estimado de visita
                    {totals.withoutEstimate > 0 && (
                      <>
                        {" "}
                        ({totals.withoutEstimate} sin estimación numérica)
                      </>
                    )}
                  </span>
                </div>
                <p className="selection-panel__disclaimer">
                  <span aria-hidden="true">ⓘ</span> Solo suma el tiempo dentro de cada lugar.{" "}
                  <strong>No incluye traslados</strong> entre lugares.
                </p>
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
