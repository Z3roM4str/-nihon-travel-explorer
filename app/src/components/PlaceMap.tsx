import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { Place } from "../types";

const TOKYO_CENTER: [number, number] = [35.6812, 139.7671];

const gradeColors: Record<string, string> = {
  S: "#c0392b",
  A: "#d68910",
  B: "#2471a3",
  C: "#5d6d7e",
};

function markerIcon(place: Place, isSelected: boolean, isSaved: boolean) {
  const color = gradeColors[place.grade] ?? "#5d6d7e";
  const size = isSelected ? 30 : 22;
  const ring = isSelected ? "0 0 0 4px rgba(198,40,40,0.25)" : "none";
  const savedBadge = isSaved
    ? '<span style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:#1e8449;border:2px solid #fff;"></span>'
    : "";
  return L.divIcon({
    className: "place-marker",
    html: `<span style="position:relative;display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:${ring}, 0 1px 3px rgba(0,0,0,0.4);">${savedBadge}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FlyToSelected({ place }: { place: Place | null }) {
  const map = useMap();
  useEffect(() => {
    if (place) {
      map.flyTo([place.coordinates.lat, place.coordinates.lng], Math.max(map.getZoom(), 15), {
        duration: 0.6,
      });
    }
  }, [place, map]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

type Props = {
  places: Place[];
  selectedId: string | null;
  savedIds: string[];
  onSelect: (place: Place) => void;
};

export function PlaceMap({ places, selectedId, savedIds, onSelect }: Props) {
  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedId) ?? null,
    [places, selectedId]
  );
  const mapRef = useRef<L.Map | null>(null);

  return (
    <MapContainer
      center={TOKYO_CENTER}
      zoom={12}
      className="place-map"
      ref={mapRef}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FlyToSelected place={selectedPlace} />
      <InvalidateOnResize />
      {places.map((place) => (
        <Marker
          key={place.id}
          position={[place.coordinates.lat, place.coordinates.lng]}
          icon={markerIcon(place, place.id === selectedId, savedIds.includes(place.id))}
          eventHandlers={{ click: () => onSelect(place) }}
          keyboard={true}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            {place.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
