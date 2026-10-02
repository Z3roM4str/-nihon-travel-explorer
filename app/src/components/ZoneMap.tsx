import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { Place } from "../types";
import type { AccommodationZone } from "../lib/accommodation-zone";

/** Fits the map to whatever is on it; re-runs when the selection changes. */
function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14, animate: false });
  }, [map, points]);
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

const zoneIcon = (selected: boolean) =>
  L.divIcon({
    className: "zone-marker",
    html: `<i class="zone-marker__pin ${selected ? "zone-marker__pin--on" : ""}" aria-hidden="true">●</i>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const savedIcon = L.divIcon({
  className: "zone-marker",
  html: '<i class="zone-marker__saved"></i>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

type Props = {
  selectedZones: AccommodationZone[];
  hubTripPlaces: Place[];
  mapPoints: [number, number][];
  onSelectPlace: (id: string) => void;
};

export function ZoneMap({ selectedZones, hubTripPlaces, mapPoints, onSelectPlace }: Props) {
  return (
    <MapContainer
      center={[selectedZones[0]?.anchor.lat ?? 35.68, selectedZones[0]?.anchor.lng ?? 139.76]}
      zoom={12}
      className="zone-map"
      zoomControl={false}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <FitToMarkers points={mapPoints} />
      <InvalidateOnResize />
      {hubTripPlaces.map((place) => (
        <Marker
          key={place.id}
          position={[place.coordinates.lat, place.coordinates.lng]}
          icon={savedIcon}
          title={place.name}
          eventHandlers={{ click: () => onSelectPlace(place.id) }}
        >
          <Tooltip direction="top">{place.name}</Tooltip>
        </Marker>
      ))}
      {selectedZones.map((zone) => (
        <Marker
          key={zone.id}
          position={[zone.anchor.lat, zone.anchor.lng]}
          icon={zoneIcon(true)}
          title={zone.name}
        >
          <Tooltip direction="top">{zone.anchor.label}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
