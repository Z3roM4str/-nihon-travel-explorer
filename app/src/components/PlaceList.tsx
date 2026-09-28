import { Fragment, useEffect, useRef, useState } from "react";
import type { Place } from "../types";
import { PlaceCard } from "./PlaceCard";
import { EmptyState } from "./EmptyState";
import type { OtherPersonMarker } from "../lib/traveller-presentation";
import { Icon } from "../icons/Icon";

/** Bloque 19 (B3, `05 §4`): "Carga progresiva de 12 en 12 al hacer scroll." */
const PAGE_SIZE = 12;

/** Bloque 19 (B3, `05 §4`/`02 §"Qué se conserva"`): las tres ciudades con zonas de alojamiento
 * modeladas son las únicas que ganan la entrada «Dónde dormir» — el resto no la muestra. La
 * lista concreta la decide `hasZones` (pasado por `App.tsx` desde `hubsWithZones()`, la misma
 * fuente que ya gobierna el acceso desde el selector de ciudad); este módulo no duplica esa
 * lista, sólo la posición dentro de la lista de tarjetas. */
const DONDE_DORMIR_AFTER = 6;

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
  /** Bloque 19 (B3, `04 §5.5`): resuelve el `PersonToken` junto al corazón de una tarjeta, o
   * `null` cuando no hay nada que decir. Función, no un mapa precomputado — la lista nunca
   * calcula el marcador de una tarjeta que no va a pintar. */
  otherPersonMarkerFor?: (placeId: string) => OtherPersonMarker | null;
  /** Nombre de la ciudad activa, para el texto de los estados vacíos y de la entrada «Dónde
   * dormir». */
  hubName: string;
  /** Bloque 19 (B3, `05 §4`): si esta ciudad tiene zonas de alojamiento modeladas — sólo
   * entonces se inserta la entrada «Dónde dormir» tras la sexta tarjeta. */
  hasZones: boolean;
  /** Cuántas zonas tiene la ciudad activa, para «{n} zonas con estrategias distintas». */
  zoneCount: number;
  /** Lleva a Viaje › Dónde dormir con esta ciudad preseleccionada (mecanismo B18 existente). */
  onOpenDondeDormir: () => void;
};

/**
 * An empty result is a deliberate state, not a hole in the product: it says what happened, in
 * the reader's own terms, and always offers the one action that gets them out of it.
 *
 * Bloque 19 (B3, `04 §15`, `05 §4`): migrado a `EmptyState` con el texto exacto que fija el
 * documento congelado — dos redacciones distintas según si lo vacío es un filtro o una
 * búsqueda, nunca la misma frase genérica para las dos.
 */
function EmptyResults({
  totalCount,
  hasActiveFilters,
  query,
  hubName,
  onClearFilters,
}: Pick<Props, "totalCount" | "hasActiveFilters" | "onClearFilters" | "query" | "hubName">) {
  const trimmed = query?.trim() ?? "";

  if (trimmed) {
    return (
      <EmptyState
        icon="buscar"
        title="Sin resultados"
        description={`Nada con “${trimmed}” en ${hubName}. Prueba en otra ciudad o quita los filtros.`}
        action={hasActiveFilters ? { label: "Limpiar filtros", onClick: onClearFilters } : undefined}
      />
    );
  }

  return (
    <EmptyState
      icon="filtro"
      title="Ningún lugar coincide"
      description={`Los ${totalCount} lugares de ${hubName} siguen ahí, sólo están filtrados.`}
      action={hasActiveFilters ? { label: "Limpiar filtros", onClick: onClearFilters } : undefined}
    />
  );
}

/**
 * Bloque 19 (B3, `05 §4`): entrada de navegación contextual, no un `PlaceCard`. No participa en
 * filtros, conteos, orden del dataset, carga de 12 en 12 ni búsqueda — es una fila más de la
 * lista, pero su presencia y posición dependen sólo de la ciudad activa, nunca del resultado
 * filtrado.
 */
function DondeDormirEntry({
  hubName,
  zoneCount,
  onOpen,
}: {
  hubName: string;
  zoneCount: number;
  onOpen: () => void;
}) {
  return (
    <li className="donde-dormir-entry-item">
      <button type="button" className="donde-dormir-entry" onClick={onOpen}>
        <span className="donde-dormir-entry__icon" aria-hidden="true">
          <Icon name="cama" size={24} />
        </span>
        <span className="donde-dormir-entry__text">
          <span className="donde-dormir-entry__title">Dónde dormir en {hubName}</span>
          <span className="donde-dormir-entry__hint">
            {zoneCount} zona{zoneCount === 1 ? "" : "s"} con estrategias distintas
          </span>
        </span>
        <Icon name="siguiente" size={20} className="donde-dormir-entry__chevron" />
      </button>
    </li>
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
  otherPersonMarkerFor,
  hubName,
  hasZones,
  zoneCount,
  onOpenDondeDormir,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLLIElement>(null);

  // Bloque 19 (B3, `05 §4`): "cambiar ciudad/filtro/query no arrastra una ventana inválida de
  // la lista anterior" — `places` es una referencia nueva (`useMemo` en App.tsx) cada vez que el
  // resultado filtrado cambia de verdad, así que reiniciar aquí no depende de comparar ids.
  // Ajuste de estado durante el render (la técnica que documenta React para "reiniciar el estado
  // cuando cambia una prop"), no un efecto: evita el resplandor de un render con la ventana
  // vieja seguido de otro con la reiniciada, y el aviso de `set-state-in-effect` de oxlint.
  const [placesForVisibleCount, setPlacesForVisibleCount] = useState(places);
  if (placesForVisibleCount !== places) {
    setPlacesForVisibleCount(places);
    setVisibleCount(PAGE_SIZE);
  }

  const hasMore = visibleCount < places.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, places.length));
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, places.length]);

  if (places.length === 0) {
    return (
      <EmptyResults
        totalCount={totalCount}
        hasActiveFilters={hasActiveFilters}
        query={query}
        hubName={hubName}
        onClearFilters={onClearFilters}
      />
    );
  }

  const savedSet = new Set(savedIds);
  const visible = places.slice(0, visibleCount);
  const showDondeDormir = hasZones && visible.length > DONDE_DORMIR_AFTER;

  return (
    <ul className="place-list" aria-label="Resultados">
      {visible.map((place, index) => (
        <Fragment key={place.id}>
          <li>
            <PlaceCard
              place={place}
              selected={place.id === selectedId}
              saved={savedSet.has(place.id)}
              onSelect={onSelect}
              onToggleSaved={onToggleSaved}
              otherPersonMarker={otherPersonMarkerFor ? otherPersonMarkerFor(place.id) : null}
              priority={index === 0}
            />
          </li>
          {showDondeDormir && index === DONDE_DORMIR_AFTER - 1 && (
            <DondeDormirEntry hubName={hubName} zoneCount={zoneCount} onOpen={onOpenDondeDormir} />
          )}
        </Fragment>
      ))}
      {hasMore && <li ref={sentinelRef} className="place-list__sentinel" aria-hidden="true" />}
    </ul>
  );
}
