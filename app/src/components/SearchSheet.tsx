import { useEffect, useRef } from "react";
import type { Place } from "../types";
import { PlaceCard } from "./PlaceCard";
import { EmptyState } from "./EmptyState";
import { Sheet } from "./Sheet";
import type { OtherPersonMarker } from "../lib/traveller-presentation";

type Props = {
  hubName: string;
  query: string;
  onQueryChange: (query: string) => void;
  /** Bloque 19 (B3, `04 §12`): "mismos datos y misma lógica actual de búsqueda" — este es
   * literalmente el mismo `filteredPlaces` que ya alimenta la lista de la ciudad (`hubPlaces`
   * filtrado por `matchesFilters`, que ya incluye `filters.query`), no una segunda pasada de
   * búsqueda ni un ranking nuevo. */
  results: Place[];
  savedIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleSaved: (id: string) => void;
  otherPersonMarkerFor?: (placeId: string) => OtherPersonMarker | null;
  onClose: () => void;
};

/**
 * Bloque 19 (B3) — la hoja de búsqueda de `04 §12`: "abre la búsqueda como Sheet de pantalla
 * casi completa con resultados en vivo (`PlaceCard compact`)". Sustituye al campo de texto que
 * antes vivía inline en la barra única de 48px de B18 — la barra conserva el mismo control
 * (`[ Buscar en Tokio ]`), pero ahora lo abre en vez de filtrar en el sitio.
 */
export function SearchSheet({
  hubName,
  query,
  onQueryChange,
  results,
  savedIds,
  selectedId,
  onSelect,
  onToggleSaved,
  otherPersonMarkerFor,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // `Sheet` ya enfoca su propio botón de cierre al montar (comportamiento correcto para el
  // resto de sus usos); una búsqueda necesita el campo de texto listo para escribir de
  // inmediato, así que este efecto —que corre después, tras el primer pintado— se lo quita.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const trimmed = query.trim();
  const savedSet = new Set(savedIds);

  return (
    <Sheet title={`Buscar en ${hubName}`} onClose={onClose}>
      <div className="search-sheet">
        <div className="search-sheet__field">
          <div className="search-field">
            <input
              ref={inputRef}
              type="search"
              className="search-field__input"
              placeholder={`Buscar en ${hubName}`}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="search-field__clear tap-target-min"
                onClick={() => onQueryChange("")}
                aria-label="Borrar búsqueda"
                title="Borrar búsqueda"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="search-sheet__results">
          {trimmed === "" ? null : results.length === 0 ? (
            <EmptyState
              icon="buscar"
              title="Sin resultados"
              description={`Nada con “${trimmed}” en ${hubName}. Prueba en otra ciudad o quita los filtros.`}
            />
          ) : (
            <ul className="place-list place-list--compact" aria-label="Resultados de la búsqueda">
              {results.map((place) => (
                <li key={place.id}>
                  <PlaceCard
                    place={place}
                    variant="compact"
                    selected={place.id === selectedId}
                    saved={savedSet.has(place.id)}
                    onSelect={(id) => {
                      onSelect(id);
                      onClose();
                    }}
                    onToggleSaved={onToggleSaved}
                    otherPersonMarker={otherPersonMarkerFor ? otherPersonMarkerFor(place.id) : null}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}
