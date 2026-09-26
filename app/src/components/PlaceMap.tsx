import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Place } from "../types";
import type { PlaceInterestSummary, Traveller } from "../lib/travellers";
import { MARKER_HIT_SIZE, groupScreenPoints } from "../lib/map-grouping";
import { resolveHubView } from "../lib/hub-view";

const JAPAN_FALLBACK_CENTER: [number, number] = [36.5, 138];
const JAPAN_FALLBACK_ZOOM = 5;
const SELECTION_ZOOM = 14;
const BOUNDS_PADDING = 32;

// Preserved for RC-01 regression testing contract in App.test.ts
// oxlint-disable-next-line no-unused-vars
export const gradeColors: Record<string, string> = {
  S: "var(--ink-900)",
  A: "var(--ink-700)",
  B: "var(--ink-500)",
  C: "var(--ink-300)",
  D: "var(--ink-300)",
};

type InterestState = "both" | "person-a" | "person-b" | "none";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resolveInterestState(
  summary: PlaceInterestSummary | undefined,
  firstTravellerId: string | null
): InterestState {
  if (!summary) return "none";
  if (summary.kind === "both") return "both";
  if (summary.kind === "only") {
    return summary.interestedId === firstTravellerId ? "person-a" : "person-b";
  }
  if (summary.kind === "split") {
    const interestedId = summary.interestedIds[0];
    if (!interestedId) return "none";
    return interestedId === firstTravellerId ? "person-a" : "person-b";
  }
  return "none";
}

const iconCache = new Map<string, L.DivIcon>();

function markerIcon(interestState: InterestState, isSelected: boolean): L.DivIcon {
  const key = `${interestState}|${isSelected}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  let color = "var(--ink-500)";
  let size = 10;
  let opacity = 0.7;

  if (interestState === "both") {
    color = "var(--shu-600)";
    size = 14;
    opacity = 1;
  } else if (interestState === "person-a") {
    color = "var(--person-a)";
    size = 12;
    opacity = 1;
  } else if (interestState === "person-b") {
    color = "var(--person-b)";
    size = 12;
    opacity = 1;
  }

  if (isSelected) {
    size = 20;
    opacity = 1;
  }

  // B24 (P0-4b, Art. 11): la caja del icono —que es lo que recibe el toque— mide 44 px; el punto
  // visible conserva su tamaño de `03 §9` (10/12/14/20 px), centrado dentro de ella.
  const icon = L.divIcon({
    className: `place-marker ${isSelected ? "place-marker--selected" : ""} place-marker--${interestState}`,
    html: `<i class="place-marker__dot" style="--marker-color:${color};--marker-size:${size}px;opacity:${opacity}"></i>`,
    iconSize: [MARKER_HIT_SIZE, MARKER_HIT_SIZE],
    iconAnchor: [MARKER_HIT_SIZE / 2, MARKER_HIT_SIZE / 2],
  });
  iconCache.set(key, icon);
  return icon;
}

const clusterIconCache = new Map<number, L.DivIcon>();

/** `03 §9`: «un círculo con cifra (`--type-num`), estilo indicador de estación». Misma caja de
 * impacto de 44 px que un marcador suelto. */
function clusterIcon(count: number): L.DivIcon {
  const cached = clusterIconCache.get(count);
  if (cached) return cached;
  const icon = L.divIcon({
    className: "place-cluster",
    html: `<span class="place-cluster__count">${count}</span>`,
    iconSize: [MARKER_HIT_SIZE, MARKER_HIT_SIZE],
    iconAnchor: [MARKER_HIT_SIZE / 2, MARKER_HIT_SIZE / 2],
  });
  clusterIconCache.set(count, icon);
  return icon;
}

function panelCoversMap(map: L.Map, panelOffset: number): boolean {
  return panelOffset > 0 && panelOffset >= map.getSize().x - 1;
}

function FocusSelected({ place, panelOffset }: { place: Place | null; panelOffset: number }) {
  const map = useMap();
  const placeId = place?.id ?? null;

  useEffect(() => {
    if (!place) return;
    map.invalidateSize({ animate: false });
    if (panelCoversMap(map, panelOffset)) return;
    const zoom = Math.max(map.getZoom(), SELECTION_ZOOM);
    const point = map.project([place.coordinates.lat, place.coordinates.lng], zoom);
    const target = map.unproject(point.add([panelOffset / 2, 0]), zoom);

    if (prefersReducedMotion()) {
      map.setView(target, zoom, { animate: false });
    } else {
      map.flyTo(target, zoom, { duration: 0.6 });
    }
  }, [place, placeId, panelOffset, map]);

  return null;
}

/**
 * B24 (DDR-B24-1) — encuadre inicial del mapa de ciudad: editorial por hub con fallback
 * calculado sobre el núcleo (`lib/hub-view.ts`), nunca `fitBounds` de todos los lugares del hub.
 * Los lugares periféricos no desaparecen del mapa ni del dataset: sólo dejan de decidir la
 * primera vista. Si el mapa se centra explícitamente en un lugar, `FocusSelected` es quien manda
 * mientras la ficha está abierta — este encuadre inicial no vuelve a competir por la vista hasta
 * que se cierra (regla 6 de DDR-B24-1: el lugar seleccionado tiene prioridad).
 */
function FitHubBounds({
  hub,
  places,
  panelOffset,
  hasSelection,
}: {
  hub: string;
  places: Place[];
  panelOffset: number;
  hasSelection: boolean;
}) {
  const map = useMap();

  useLayoutEffect(() => {
    if (places.length === 0 || hasSelection) return;
    const view = resolveHubView(hub, places.map((place) => place.coordinates));
    const point = map.project(view.center, view.zoom);
    const target = map.unproject(point.add([panelOffset / 2, 0]), view.zoom);
    if (prefersReducedMotion()) {
      map.setView(target, view.zoom, { animate: false });
    } else {
      map.flyTo(target, view.zoom, { duration: 0.6 });
    }
  }, [hub, places, panelOffset, hasSelection, map]);

  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/**
 * B24 (P0-4a) — los marcadores del mapa de ciudad, agrupados según `03 §9`.
 *
 * Por encima de 12 marcadores dentro del encuadre, los que se tocarían (cajas de 44 px a menos de
 * `--tap-gap`) se funden en un grupo con cifra; los que no, siguen sueltos. Con 12 o menos, todos
 * sueltos. Se recalcula al terminar cada zoom o desplazamiento. El lugar seleccionado nunca entra
 * en un grupo: `03 §9` lo quiere «encima de todos». Pulsar un grupo acerca el mapa hasta sus
 * lugares (sin animación con `prefers-reduced-motion`, `03 §6`).
 */
function MarkerLayer({
  places,
  selectedId,
  panelOffset,
  onSelect,
  interestStateFor,
}: {
  places: Place[];
  selectedId: string | null;
  panelOffset: number;
  onSelect: (id: string) => void;
  interestStateFor: (id: string) => InterestState;
}) {
  const map = useMap();
  const [, setViewVersion] = useState(0);
  useMapEvents({
    zoomend: () => setViewVersion((version) => version + 1),
    moveend: () => setViewVersion((version) => version + 1),
    resize: () => setViewVersion((version) => version + 1),
  });

  const zoom = map.getZoom();
  const selected = places.find((place) => place.id === selectedId) ?? null;
  const others = places.filter((place) => place.id !== selectedId);

  // DDR-B24-2 (resuelta): `groupScreenPoints` sólo funde parejas cuyas cajas de 44 px se
  // tocarían, así que aplicarlo siempre cubre tanto la regla de densidad de `03 §9` (>12
  // marcadores visibles) como la red de seguridad geométrica añadida para ≤12: cuando el zoom
  // separa las cajas, `groupScreenPoints` las vuelve a dejar sueltas por sí solo.
  const groups = groupScreenPoints(
    others.map((place) => {
      const point = map.project([place.coordinates.lat, place.coordinates.lng], zoom);
      return { id: place.id, x: point.x, y: point.y };
    })
  );

  const byId = new Map(places.map((place) => [place.id, place]));

  function marker(place: Place, isSelected: boolean) {
    return (
      <Marker
        key={place.id}
        position={[place.coordinates.lat, place.coordinates.lng]}
        icon={markerIcon(interestStateFor(place.id), isSelected)}
        eventHandlers={{ click: () => onSelect(place.id) }}
        keyboard
        title={place.name}
        alt={place.name}
        zIndexOffset={isSelected ? 1000 : 0}
      >
        <Tooltip direction="top" offset={[0, -14]}>
          {place.name}
        </Tooltip>
      </Marker>
    );
  }

  function expand(members: Place[]) {
    const memberBounds = L.latLngBounds(
      members.map((place) => [place.coordinates.lat, place.coordinates.lng] as [number, number])
    );
    const rightPadding = panelCoversMap(map, panelOffset) ? BOUNDS_PADDING : BOUNDS_PADDING + panelOffset;
    const options = {
      paddingTopLeft: [BOUNDS_PADDING, BOUNDS_PADDING] as [number, number],
      paddingBottomRight: [rightPadding, BOUNDS_PADDING] as [number, number],
    };
    const reduced = prefersReducedMotion();
    if (map.getBoundsZoom(memberBounds) > zoom) {
      if (reduced) map.fitBounds(memberBounds, { ...options, animate: false });
      else map.flyToBounds(memberBounds, options);
      return;
    }
    // Lugares casi en el mismo punto: encuadrarlos no acercaría nada; se acerca dos niveles.
    const center = memberBounds.getCenter();
    const nextZoom = Math.min(zoom + 2, map.getMaxZoom());
    if (reduced) map.setView(center, nextZoom, { animate: false });
    else map.flyTo(center, nextZoom, { duration: 0.4 });
  }

  return (
    <>
      {groups.map((group) => {
        const members = group.ids
          .map((id) => byId.get(id))
          .filter((place): place is Place => Boolean(place));
        if (members.length === 1) return marker(members[0], false);
        const center = map.unproject([group.x, group.y], zoom);
        const label = `${members.length} lugares`;
        return (
          <Marker
            key={`grupo:${group.ids.join(",")}`}
            position={center}
            icon={clusterIcon(members.length)}
            eventHandlers={{ click: () => expand(members) }}
            keyboard
            title={label}
            alt={label}
          />
        );
      })}
      {selected && marker(selected, true)}
    </>
  );
}

type Props = {
  places: Place[];
  hubPlaces: Place[];
  activeHub: string;
  selectedPlace: Place | null;
  savedIds: string[];
  onSelect: (id: string) => void;
  panelOffset: number;
  travellers?: readonly Traveller[];
  interestSummaryFor?: (id: string) => PlaceInterestSummary;
};

export function PlaceMap({
  places,
  hubPlaces,
  activeHub,
  selectedPlace,
  savedIds,
  onSelect,
  panelOffset,
  travellers = [],
  interestSummaryFor,
}: Props) {
  const firstTravellerId = travellers[0]?.id ?? null;
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  const interestStateFor = (id: string): InterestState => {
    if (interestSummaryFor) return resolveInterestState(interestSummaryFor(id), firstTravellerId);
    // Fallback to savedSet if interestSummaryFor not provided
    return savedSet.has(id) ? "both" : "none";
  };

  const visiblePlaces = useMemo(() => {
    if (!selectedPlace || places.some((place) => place.id === selectedPlace.id)) return places;
    return [...places, selectedPlace];
  }, [places, selectedPlace]);

  return (
    <MapContainer
      center={JAPAN_FALLBACK_CENTER}
      zoom={JAPAN_FALLBACK_ZOOM}
      className="place-map"
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <FitHubBounds
        hub={activeHub}
        places={hubPlaces}
        panelOffset={panelOffset}
        hasSelection={Boolean(selectedPlace)}
      />
      <FocusSelected place={selectedPlace} panelOffset={panelOffset} />
      <InvalidateOnResize />
      <MarkerLayer
        places={visiblePlaces}
        selectedId={selectedPlace?.id ?? null}
        panelOffset={panelOffset}
        onSelect={onSelect}
        interestStateFor={interestStateFor}
      />
    </MapContainer>
  );
}
