import { useEffect, useLayoutEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { Place } from "../types";
import type { PlaceInterestSummary, Traveller } from "../lib/travellers";

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

  const icon = L.divIcon({
    className: `place-marker ${isSelected ? "place-marker--selected" : ""} place-marker--${interestState}`,
    html: `<i class="place-marker__dot" style="--marker-color:${color};--marker-size:${size}px;opacity:${opacity}"></i>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  iconCache.set(key, icon);
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

function FitHubBounds({ hub, places, panelOffset }: { hub: string; places: Place[]; panelOffset: number }) {
  const map = useMap();

  useLayoutEffect(() => {
    if (places.length === 0) return;
    const bounds = L.latLngBounds(places.map((place) => [place.coordinates.lat, place.coordinates.lng]));
    const rightPadding = panelCoversMap(map, panelOffset) ? BOUNDS_PADDING : BOUNDS_PADDING + panelOffset;
    const options = {
      paddingTopLeft: [BOUNDS_PADDING, BOUNDS_PADDING] as [number, number],
      paddingBottomRight: [rightPadding, BOUNDS_PADDING] as [number, number],
      maxZoom: SELECTION_ZOOM,
    };
    if (prefersReducedMotion()) {
      map.fitBounds(bounds, { ...options, animate: false });
    } else {
      map.flyToBounds(bounds, options);
    }
  }, [hub, places, panelOffset, map]);

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
      {visiblePlaces.map((place) => {
        const isSelected = place.id === selectedPlace?.id;
        const summary = interestSummaryFor ? interestSummaryFor(place.id) : undefined;
        // Fallback to savedSet if interestSummaryFor not provided
        let interestState: InterestState = "none";
        if (interestSummaryFor) {
          interestState = resolveInterestState(summary, firstTravellerId);
        } else if (savedSet.has(place.id)) {
          interestState = "both";
        }

        return (
          <Marker
            key={place.id}
            position={[place.coordinates.lat, place.coordinates.lng]}
            icon={markerIcon(interestState, isSelected)}
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
      })}
    </MapContainer>
  );
}
