/**
 * Bloque 24 (DDR-B24-1) — encuadre inicial del mapa de ciudad: encuadre editorial por hub con
 * fallback calculado sobre el núcleo de lugares del hub (`03 §9`, `05 §4`).
 *
 * Esta configuración vive fuera del dataset de lugares (nunca en `Place`): es presentación,
 * como el mapa de nombres japoneses de hub (DDR-B21-06). `FitHubBounds` (`PlaceMap.tsx`) la
 * consume para decidir el centro/zoom inicial; nunca hace `fitBounds` de todos los lugares del
 * hub, porque los hubs incluyen excursiones lejanas (Okutama, Izu, Okunoshima, Yonaguni) que
 * comprimirían el núcleo urbano en una esquina. Los lugares periféricos siguen en el dataset,
 * en listas/búsqueda y en el mapa: sólo dejan de decidir la primera vista.
 */

export type HubView = { center: [number, number]; zoom: number };
export type Coordinates = { lat: number; lng: number };

/**
 * Centros y zooms editoriales, calculados en la auditoría B24 sobre el núcleo urbano real de
 * cada hub (mediana de sus lugares, radio 10 km): Tokio 48/57 lugares, Kioto 39/49, Osaka 23/53,
 * Okinawa 11/50 dentro de ese núcleo. Zoom 12 encuadra el núcleo (~10-13 km de lado) en los
 * cuatro hubs con el tamaño de mapa actual.
 */
export const HUB_EDITORIAL_VIEW: Readonly<Record<string, HubView>> = {
  Tokio: { center: [35.6802, 139.7435], zoom: 12 },
  Kioto: { center: [35.0079, 135.7574], zoom: 12 },
  Osaka: { center: [34.6681, 135.4923], zoom: 12 },
  Okinawa: { center: [26.2099, 127.7044], zoom: 12 },
};

const FALLBACK_CORE_RADIUS_KM = 10;
const FALLBACK_ZOOM = 12;
const JAPAN_FALLBACK_VIEW: HubView = { center: [36.5, 138], zoom: 5 };

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const s = sinLat * sinLat + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(s));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  return sorted.length % 2 === 1
    ? sorted[Math.floor(middle)]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * DDR-B24-1, opción (b): núcleo calculado sobre la mediana de las coordenadas del hub, radio
 * 10 km. Nunca usa los lugares lejanos para decidir el centro; si ninguno cae dentro del radio
 * (hub muy disperso), cae de vuelta a la mediana de todos los lugares del hub.
 */
export function calculatedHubCore(coordinates: readonly Coordinates[]): {
  center: [number, number];
  coreCount: number;
} | null {
  if (coordinates.length === 0) return null;
  const medianLat = median(coordinates.map((c) => c.lat));
  const medianLng = median(coordinates.map((c) => c.lng));
  const core = coordinates.filter(
    (c) => haversineKm({ lat: medianLat, lng: medianLng }, c) <= FALLBACK_CORE_RADIUS_KM
  );
  const pool = core.length > 0 ? core : coordinates;
  const centerLat = pool.reduce((sum, c) => sum + c.lat, 0) / pool.length;
  const centerLng = pool.reduce((sum, c) => sum + c.lng, 0) / pool.length;
  return { center: [centerLat, centerLng], coreCount: core.length };
}

/**
 * Resuelve el encuadre inicial de un hub: editorial si existe, si no el núcleo calculado sobre
 * sus propios lugares. `FocusSelected` (`PlaceMap.tsx`) corre después y gana cuando el mapa se
 * abre o se centra explícitamente en un lugar concreto (regla 6 de DDR-B24-1).
 */
export function resolveHubView(hub: string, coordinates: readonly Coordinates[]): HubView {
  const editorial = HUB_EDITORIAL_VIEW[hub];
  if (editorial) return editorial;
  const calculated = calculatedHubCore(coordinates);
  if (!calculated) return JAPAN_FALLBACK_VIEW;
  return { center: calculated.center, zoom: FALLBACK_ZOOM };
}
