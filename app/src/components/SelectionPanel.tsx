import type { Place } from "../types";
import { cardImageUrl, resolvePlaceImages } from "../data/place-images";
import { formatRange, resolveDuration } from "../lib/duration";
import { interestLevelForPlace } from "../lib/interest-level";
import { summarizeSelection } from "../lib/selection";
import { splitCategory } from "../lib/place";

type Props = {
  savedPlaces: Place[];
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  open: boolean;
  onToggle: () => void;
  onAnalyze: () => void;
  onBuildSequence: () => void;
};

/** Below this many saved places the grouped view has nothing to group. */
const ANALYSIS_MIN_SAVED = 3;
/** Building an ordered sequence needs at least one leg to describe. */
const SEQUENCE_BUILDER_MIN_SAVED = 2;

export function SelectionPanel({
  savedPlaces,
  onRemove,
  onSelect,
  open,
  onToggle,
  onAnalyze,
  onBuildSequence,
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
            "Pulsa ♥ en cualquier lugar"
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
            <div className="selection-panel__empty">
              <p className="selection-panel__empty-title">
                <span aria-hidden="true">♡</span> Todavía no hay nada guardado
              </p>
              <p className="selection-panel__empty-hint">
                Pulsa el <strong>♥</strong> de cualquier tarjeta, o el botón{" "}
                <strong>Quiero ir</strong> dentro de una ficha. Guarda de más: luego se compara y
                se recorta.
              </p>
            </div>
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
                {(summary.savedCount >= ANALYSIS_MIN_SAVED ||
                  summary.savedCount >= SEQUENCE_BUILDER_MIN_SAVED) && (
                  <div className="selection-panel__actions">
                    {summary.savedCount >= ANALYSIS_MIN_SAVED && (
                      <button
                        type="button"
                        className="button button--secondary selection-panel__analyze"
                        onClick={onAnalyze}
                      >
                        <span aria-hidden="true">▤</span> Analizar selección
                      </button>
                    )}
                    {summary.savedCount >= SEQUENCE_BUILDER_MIN_SAVED && (
                      <button
                        type="button"
                        className="button button--secondary selection-panel__analyze"
                        onClick={onBuildSequence}
                      >
                        <span aria-hidden="true">🧭</span> Construir recorrido
                      </button>
                    )}
                  </div>
                )}
              </div>

              <ul className="selection-list">
                {savedPlaces.map((place) => {
                  const range = resolveDuration(place.duration);
                  const interest = interestLevelForPlace(place);
                  const thumbnail = resolvePlaceImages(place.id, place.images)[0];
                  const category = splitCategory(place.category);
                  return (
                    <li key={place.id} className="selection-list__item">
                      <button type="button" className="selection-list__name" onClick={() => onSelect(place.id)}>
                        {/* The same photograph the card showed, so a saved place is recognised
                            here by sight rather than re-read by name. */}
                        <span className="selection-list__thumb" aria-hidden="true">
                          {thumbnail ? (
                            /* The same card derivative the list already fetched, so this
                               48px box reuses a cached response instead of decoding the
                               1600px hero — and never needs a tier of its own. */
                            <img
                              src={cardImageUrl(thumbnail.url) ?? thumbnail.url}
                              alt=""
                              width={48}
                              height={48}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="selection-list__thumb-icon">{category.icon || "⛩"}</span>
                          )}
                        </span>
                        <span className="selection-list__text">
                          <span className="selection-list__place">{place.name}</span>
                          <span className="selection-list__meta">
                            <span
                              className={`selection-list__interest badge--grade-${place.grade}`}
                              aria-hidden="true"
                            >
                              {interest.glyph}
                            </span>
                            <span className="visually-hidden">{interest.label}. </span>
                            {place.hub}
                            <span aria-hidden="true"> · </span>
                            <span className="selection-list__duration">
                              <span className="visually-hidden">Tiempo de visita: </span>
                              {range ? formatRange(range) : place.duration.raw}
                            </span>
                          </span>
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
