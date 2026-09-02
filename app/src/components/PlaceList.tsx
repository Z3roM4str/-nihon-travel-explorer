import type { Place } from "../types";
import { resolveDuration, formatRange } from "../lib/duration";
import { isHiddenGem, splitCategory } from "../lib/place";

type Props = {
  places: Place[];
  /** Count before filters are applied, for the empty-state hint. */
  totalCount: number;
  selectedId: string | null;
  savedIds: string[];
  onSelect: (id: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

function durationLabel(place: Place): string {
  const range = resolveDuration(place.duration);
  return range ? formatRange(range) : place.duration.raw;
}

export function PlaceList({
  places,
  totalCount,
  selectedId,
  savedIds,
  onSelect,
  onClearFilters,
  hasActiveFilters,
}: Props) {
  if (places.length === 0) {
    return (
      <div className="place-list__empty">
        <p className="place-list__empty-title">Ningún lugar coincide con la búsqueda</p>
        <p className="place-list__empty-hint">
          Prueba con otro término o quita algunos filtros para volver a ver los {totalCount} lugares
          disponibles.
        </p>
        {hasActiveFilters && (
          <button type="button" className="button button--secondary" onClick={onClearFilters}>
            Limpiar búsqueda y filtros
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="place-list" aria-label="Resultados">
      {places.map((place) => {
        const { icon, label } = splitCategory(place.category);
        const saved = savedIds.includes(place.id);
        return (
          <li key={place.id}>
            <button
              type="button"
              className={`place-list__item ${place.id === selectedId ? "place-list__item--selected" : ""}`}
              onClick={() => onSelect(place.id)}
              aria-current={place.id === selectedId ? "true" : undefined}
            >
              <span className={`place-list__grade badge--grade-${place.grade}`} aria-hidden="true">
                {place.grade}
              </span>
              <span className="place-list__text">
                <span className="place-list__name">
                  {place.name}
                  {saved && (
                    <span className="place-list__saved" title="Guardado en Quiero ir">
                      <span aria-hidden="true">✓</span>
                      <span className="visually-hidden">Guardado</span>
                    </span>
                  )}
                  {isHiddenGem(place) && (
                    <span className="place-list__gem" title={place.hiddenGemStatus}>
                      <span aria-hidden="true">💎</span>
                      <span className="visually-hidden">Hidden gem</span>
                    </span>
                  )}
                </span>
                <span className="place-list__meta">
                  <span className="visually-hidden">Grado {place.grade}. </span>
                  {icon} {label} · {place.neighborhood || place.municipality} · {durationLabel(place)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
