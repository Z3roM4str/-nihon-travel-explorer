import { useMemo, useState } from "react";
import type { Place } from "../types";
import { cardImageUrl, resolvePlaceImages } from "../data/place-images";
import { formatRange, resolveDuration } from "../lib/duration";
import { interestLevelForPlace } from "../lib/interest-level";
import { summarizeSelection } from "../lib/selection";
import { tallySentence, type InterestMarker } from "../lib/traveller-presentation";
import type { ShortlistTally, Traveller } from "../lib/travellers";
import {
  matchesShortlistFilter,
  shortlistFilterCounts,
  type DivergenceEntry,
  type ShortlistFilterKind,
} from "../lib/interest-divergence";
import {
  divergenceLine,
  emptyFilterSentence,
  filterStatusSentence,
  plannedNote,
} from "../lib/divergence-presentation";
import { ShortlistFilterBar } from "./ShortlistFilterBar";
import { Icon } from "../icons/Icon";

type Props = {
  savedPlaces: Place[];
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  open: boolean;
  onToggle: () => void;
  onAnalyze: () => void;
  onBuildSequence: () => void;
  /**
   * Block 5: this is the one list where the two-person picture belongs in full — it is where the
   * two of them look at what they have between them. Counts only, never a score.
   */
  tally?: ShortlistTally;
  interestMarkerFor?: (placeId: string) => InterestMarker | null;
  /** Names whose "Quitar" this is, so the reader knows it withdraws only their own interest. */
  activeTravellerLabel?: string | null;
  /**
   * Block 6: the derived "dónde no coincidimos" view — one entry per shortlisted place, grouped by
   * what the two of them have actually said, with a flag for the ones the planner already holds.
   *
   * Derived on every render from the Block 5 document. Nothing here is stored, and nothing here
   * changes the plan: the filter is a lens over the rows this panel was already rendering.
   */
  divergence?: readonly DivergenceEntry[];
  travellers?: readonly Traveller[];
  activeTravellerId?: string | null;
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
  tally,
  interestMarkerFor,
  activeTravellerLabel = null,
  divergence,
  travellers = [],
  activeTravellerId = null,
}: Props) {
  const summary = summarizeSelection(savedPlaces);

  /**
   * View state, and deliberately only view state.
   *
   * It is not persisted. A filter is what the reader is looking at right now, not a decision about
   * the trip, and the app stores decisions. Reopening Nihon should show the list, not the question
   * somebody asked of it last Tuesday — and no new `localStorage` key exists for Block 6 at all.
   */
  const [filter, setFilter] = useState<ShortlistFilterKind>("all");

  const entries = useMemo(() => divergence ?? [], [divergence]);
  const counts = useMemo(() => shortlistFilterCounts(entries), [entries]);
  const groupOf = useMemo(() => {
    const byPlace = new Map<string, DivergenceEntry>();
    for (const entry of entries) byPlace.set(entry.placeId, entry);
    return byPlace;
  }, [entries]);

  /** "Todo" is Block 5's list, untouched. Any other filter narrows it and nothing else. */
  const visiblePlaces =
    filter === "all"
      ? savedPlaces
      : savedPlaces.filter((place) => {
          const entry = groupOf.get(place.id);
          return entry ? matchesShortlistFilter(entry, filter) : false;
        });
  const filtering = filter !== "all";

  return (
    <section className="selection-panel" aria-label="Lugares guardados">
      <button type="button" className="selection-panel__toggle" onClick={onToggle} aria-expanded={open}>
        <span className="selection-panel__title">
          <Icon name="ubicacion" size={16} /> Quiero ir
          <span className="selection-panel__count">{summary.savedCount}</span>
        </span>
        <span
          className={`selection-panel__hint ${
            summary.savedCount === 0 ? "selection-panel__hint--placeholder" : ""
          }`}
        >
          {summary.savedCount === 0 ? (
            <>
              Pulsa <Icon name="corazon" size={16} /> en cualquier lugar
            </>
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
                <Icon name="corazon" size={20} /> Todavía no hay nada guardado
              </p>
              <p className="selection-panel__empty-hint">
                Pulsa el <strong><Icon name="corazon" size={16} /></strong> de cualquier tarjeta, o
                el botón <strong>Quiero ir</strong> dentro de una ficha. Guarda de más: luego se
                compara y se recorta.
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
                {tally && tally.total > 0 && (
                  <p className="selection-panel__tally" role="status">
                    <Icon name="personas" size={16} /> {tallySentence(tally)}
                  </p>
                )}
                {entries.length > 0 && (
                  <ShortlistFilterBar counts={counts} active={filter} onSelect={setFilter} />
                )}
                {filtering && (
                  <p className="selection-panel__filter-status" role="status">
                    {filterStatusSentence(filter, visiblePlaces.length)}
                  </p>
                )}
                {(summary.savedCount >= ANALYSIS_MIN_SAVED ||
                  summary.savedCount >= SEQUENCE_BUILDER_MIN_SAVED) && (
                  <div className="selection-panel__actions">
                    {summary.savedCount >= ANALYSIS_MIN_SAVED && (
                      <button
                        type="button"
                        className="button button--secondary selection-panel__analyze"
                        onClick={onAnalyze}
                      >
                        <Icon name="lista" size={16} /> Analizar selección
                      </button>
                    )}
                    {summary.savedCount >= SEQUENCE_BUILDER_MIN_SAVED && (
                      <button
                        type="button"
                        className="button button--secondary selection-panel__analyze"
                        onClick={onBuildSequence}
                      >
                        <Icon name="explorar" size={16} /> Construir recorrido
                      </button>
                    )}
                  </div>
                )}
              </div>

              {filtering && visiblePlaces.length === 0 ? (
                <p className="selection-panel__filter-empty">{emptyFilterSentence(filter)}</p>
              ) : (
              <ul className="selection-list">
                {visiblePlaces.map((place) => {
                  const range = resolveDuration(place.duration);
                  const interest = interestLevelForPlace(place);
                  const thumbnail = resolvePlaceImages(place.id, place.images)[0];
                  // One indicator per row, never two. While a filter is active the derived line
                  // below states the same fact in full and from the reader's own side, so Block
                  // 5's short marker would be a duplicate of it and is stood down.
                  const marker = filtering || !interestMarkerFor ? null : interestMarkerFor(place.id);
                  const entry = filtering ? groupOf.get(place.id) ?? null : null;
                  const note = entry ? plannedNote(entry) : null;
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
                            <Icon name="imagen" className="selection-list__thumb-icon" size={20} />
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
                            {marker && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span
                                  className={`selection-list__interest-marker selection-list__interest-marker--${marker.tone}`}
                                >
                                  <Icon name={marker.glyph} size={16} /> {marker.label}
                                  <span className="visually-hidden">. {marker.description}</span>
                                </span>
                              </>
                            )}
                          </span>
                          {entry && (
                            <span className="selection-list__divergence">
                              {divergenceLine(entry.group, travellers, activeTravellerId)}
                              {note && (
                                <span className="selection-list__planned"> {note}</span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--small"
                        aria-label={
                          activeTravellerLabel
                            ? `Quitar ${place.name} de Quiero ir de ${activeTravellerLabel}`
                            : `Quitar ${place.name} de Quiero ir`
                        }
                        title={
                          activeTravellerLabel
                            ? `Quitar ${place.name} de Quiero ir de ${activeTravellerLabel}`
                            : `Quitar ${place.name} de Quiero ir`
                        }
                        onClick={() => onRemove(place.id)}
                      >
                        <Icon name="cerrar" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
