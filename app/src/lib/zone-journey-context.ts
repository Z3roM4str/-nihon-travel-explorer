import { getPlaceById } from "../data/store";
import type { Place } from "../types";

/** Places already in the canonical trip route for one accommodation hub, in route order. */
export function placesForTripHub(routeIds: readonly string[], hub: string): Place[] {
  const places: Place[] = [];
  for (const id of routeIds) {
    const place = getPlaceById(id);
    if (place?.hub === hub) places.push(place);
  }
  return places;
}
