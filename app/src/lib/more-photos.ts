/**
 * «Ver más fotos»: abre Google Maps en el lugar, en una pestaña nueva, para ver las fotos que
 * publica la gente. Nunca copiamos imágenes de Google; sólo enlazamos.
 *
 * Se busca por nombre + municipio (lo que hace que Maps abra la ficha del lugar, con su
 * pestaña de fotos). Si no hay nombre, caen las coordenadas.
 */
export const FULL_GALLERY_SIZE = 4;

type PlaceLike = {
  name?: string;
  municipality?: string;
  coordinates?: { lat: number; lng: number };
};

export function morePhotosUrl(place: PlaceLike): string | null {
  const name = place.name?.trim();
  let query: string | null = null;
  if (name) {
    query = [name, place.municipality?.trim(), "Japan"].filter(Boolean).join(", ");
  } else if (place.coordinates && Number.isFinite(place.coordinates.lat) && Number.isFinite(place.coordinates.lng)) {
    query = `${place.coordinates.lat},${place.coordinates.lng}`;
  }
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Con menos de 4 fotos el enlace se destaca; con la galería completa queda discreto. */
export function morePhotosVariant(imageCount: number): "prominent" | "subtle" {
  return imageCount < FULL_GALLERY_SIZE ? "prominent" : "subtle";
}
