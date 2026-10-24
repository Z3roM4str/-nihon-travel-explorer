import type { Place } from "../types";

/**
 * P0-5c de B24 (D-M6, `03 §2.3`): en la fila compacta de `PlaceCard` —búsqueda de todo Japón,
 * «Cerca de aquí»— el lugar tiene que decir en qué ciudad está. Lo que va detrás del único `·` de
 * la línea es «{barrio}, {ciudad}», o sólo «{ciudad}» si no hay barrio. Sólo presentación: el
 * dataset no cambia.
 */
export function compactPlaceLine(place: Pick<Place, "neighborhood" | "hub">): string {
  const neighborhood = place.neighborhood?.trim();
  return neighborhood ? `${neighborhood}, ${place.hub}` : place.hub;
}
