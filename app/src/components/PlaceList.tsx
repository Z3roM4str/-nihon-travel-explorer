import type { Place } from "../types";
import { PlaceCard } from "./PlaceCard";
import type { InterestMarker } from "../lib/traveller-presentation";
import { Icon } from "../icons/Icon";

type Props = {
  places: Place[];
  /** Count before filters are applied, for the empty-state hint. */
  totalCount: number;
  selectedId: string | null;
  savedIds: string[];
  onSelect: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  /** The free-text term, when there is one — the empty state names it back to the reader. */
  query?: string;
  /** Block 5: resolves the two-person marker for one place, or null when there is nothing to say.
   * Passed as a function rather than a map so the list never builds a marker for a card it is not
   * about to render. */
  interestMarkerFor?: (placeId: string) => InterestMarker | null;
};

/**
 * An empty result is a deliberate state, not a hole in the product: it says what happened, in
 * the reader's own terms, and always offers the one action that gets them out of it.
 */
function EmptyResults({
  totalCount,
  hasActiveFilters,
  query,
  onClearFilters,
}: Pick<Props, "totalCount" | "hasActiveFilters" | "onClearFilters" | "query">) {
  const trimmed = query?.trim() ?? "";
  return (
    <div className="place-list__empty" role="status">
      <span className="place-list__empty-icon" aria-hidden="true">
        <Icon name="buscar" size={24} />
      </span>
      <p className="place-list__empty-title">
        {trimmed ? <>Nada coincide con “{trimmed}”</> : "Ningún lugar coincide con los filtros"}
      </p>
      <p className="place-list__empty-hint">
        {trimmed
          ? `Prueba con otro término, o quita los filtros para volver a ver los ${totalCount} lugares de esta zona.`
          : `Afloja algún filtro para volver a ver los ${totalCount} lugares de esta zona.`}
      </p>
      {hasActiveFilters && (
        <button type="button" className="button button--secondary" onClick={onClearFilters}>
          Limpiar búsqueda y filtros
        </button>
      )}
    </div>
  );
}

export function PlaceList({
  places,
  totalCount,
  selectedId,
  savedIds,
  onSelect,
  onToggleSaved,
  onClearFilters,
  hasActiveFilters,
  query,
  interestMarkerFor,
}: Props) {
  if (places.length === 0) {
    return (
      <EmptyResults
        totalCount={totalCount}
        hasActiveFilters={hasActiveFilters}
        query={query}
        onClearFilters={onClearFilters}
      />
    );
  }

  const savedSet = new Set(savedIds);

  return (
    <ul className="place-list" aria-label="Resultados">
      {places.map((place) => (
        <li key={place.id}>
          <PlaceCard
            place={place}
            selected={place.id === selectedId}
            saved={savedSet.has(place.id)}
            onSelect={onSelect}
            onToggleSaved={onToggleSaved}
            interestMarker={interestMarkerFor ? interestMarkerFor(place.id) : null}
          />
        </li>
      ))}
    </ul>
  );
}
