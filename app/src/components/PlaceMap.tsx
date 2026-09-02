import { useEffect, useLayoutEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { Place } from "../types";

/**
 * Generic starting point for MapContainer, which needs a center/zoom before any hub's
 * bounds are known. Not tied to any specific hub — FitHubBounds immediately corrects the
 * view to the active hub on mount, before paint, so this is never actually seen.
 */
const JAPAN_FALLBACK_CENTER: [number, number] = [36.5, 138];
const JAPAN_FALLBACK_ZOOM = 5;
/** Deep enough to read the surrounding streets, shallow enough to keep neighbours in view. */
const SELECTION_ZOOM = 14;
/** Keeps markers off the viewport edge when a hub's bounds are fit. */
const BOUNDS_PADDING = 32;

const gradeColors: Record<string, string> = {
  S: "#b7282e",
  A: "#c2701c",
  B: "#2f6f9f",
  C: "#6b6257",
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const iconCache = new Map<string, L.DivIcon>();

function markerIcon(grade: string, isSelected: boolean, isSaved: boolean): L.DivIcon {
  const key = `${grade}|${isSelected}|${isSaved}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const color = gradeColors[grade] ?? gradeColors.C;
  const size = isSelected ? 28 : 20;
  const savedBadge = isSaved ? '<i class="place-marker__saved"></i>' : "";
  const icon = L.divIcon({
    className: `place-marker ${isSelected ? "place-marker--selected" : ""}`,
    html: `<i class="place-marker__dot" style="--marker-color:${color};--marker-size:${size}px">${savedBadge}</i>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  iconCache.set(key, icon);
  return icon;
}

/**
 * Centres the selected place in the part of the map the detail panel does not cover, so the
 * marker stays visible next to its own card on desktop.
 */
function FocusSelected({ place, panelOffset }: { place: Place | null; panelOffset: number }) {
  const map = useMap();
  const placeId = place?.id ?? null;

  useEffect(() => {
    if (!place) return;
    const zoom = Math.max(map.getZoom(), SELECTION_ZOOM);
    const point = map.project([place.coordinates.lat, place.coordinates.lng], zoom);
    const target = map.unproject(point.add([panelOffset / 2, 0]), zoom);

    if (prefersReducedMotion()) {
      map.setView(target, zoom, { animate: false });
    } else {
      map.flyTo(target, zoom, { duration: 0.6 });
    }
    // Re-centres when the selected place changes, not when the user pans afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, panelOffset, map]);

  return null;
}

/**
 * Fits the map to the active hub's full set of places whenever the hub changes — a manual
 * switch, a saved place opened from another hub, a cross-hub nearby jump, or Back landing on
 * a place in another hub. Deliberately keyed on `hub` alone (not `places`/`panelOffset`), so
 * tweaking filters or opening/closing the detail panel never re-triggers a whole-hub refit;
 * `FocusSelected` already handles centring the selected marker for those.
 */
function FitHubBounds({ hub, places, panelOffset }: { hub: string; places: Place[]; panelOffset: number }) {
  const map = useMap();

  useLayoutEffect(() => {
    if (places.length === 0) return;
    const bounds = L.latLngBounds(places.map((place) => [place.coordinates.lat, place.coordinates.lng]));
    const options = {
      paddingTopLeft: [BOUNDS_PADDING, BOUNDS_PADDING] as [number, number],
      paddingBottomRight: [BOUNDS_PADDING + panelOffset, BOUNDS_PADDING] as [number, number],
      maxZoom: SELECTION_ZOOM,
    };
    if (prefersReducedMotion()) {
      map.fitBounds(bounds, { ...options, animate: false });
    } else {
      map.flyToBounds(bounds, options);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub, map]);

  return null;
}

/** Leaflet caches the container size; recompute it whenever the layout changes around it. */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

type Props = {
  places: Place[];
  /** Every place in the active hub, unfiltered — used to fit bounds around the whole hub
   * rather than whatever a leftover filter from a previous hub happens to match. */
  hubPlaces: Place[];
  activeHub: string;
  /** Resolved from the full dataset, so a place hidden by filters can still be focused. */
  selectedPlace: Place | null;
  savedIds: string[];
  onSelect: (id: string) => void;
  /** Horizontal space covered by the detail panel, in pixels. */
  panelOffset: number;
};

export function PlaceMap({
  places,
  hubPlaces,
  activeHub,
  selectedPlace,
  savedIds,
  onSelect,
  panelOffset,
}: Props) {
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  /**
   * A place reached through a "nearby" jump can sit outside the active filters. Its marker is
   * added anyway, so the card on screen always has its pin on the map.
   */
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
      <FitHubBounds hub={activeHub} places={hubPlaces} panelOffset={panelOffset} />
      <FocusSelected place={selectedPlace} panelOffset={panelOffset} />
      <InvalidateOnResize />
      {visiblePlaces.map((place) => (
        <Marker
          key={place.id}
          position={[place.coordinates.lat, place.coordinates.lng]}
          icon={markerIcon(place.grade, place.id === selectedPlace?.id, savedSet.has(place.id))}
          eventHandlers={{ click: () => onSelect(place.id) }}
          keyboard
          title={place.name}
          alt={place.name}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            {place.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
