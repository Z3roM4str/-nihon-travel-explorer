import placesData from "./places.json";
import nearbyData from "./nearby.json";
import type { NearbyRelation, Place } from "../types";

const allPlaces = placesData as Place[];
const nearbyRelations = nearbyData as NearbyRelation[];

const EMPTY_PLACES: Place[] = [];
const EMPTY_NEARBY: NearbyRelation[] = [];

const placesById = new Map(allPlaces.map((place) => [place.id, place]));

const placesByHub = allPlaces.reduce((map, place) => {
  const list = map.get(place.hub);
  if (list) list.push(place);
  else map.set(place.hub, [place]);
  return map;
}, new Map<string, Place[]>());

const nearbyBySource = nearbyRelations.reduce((map, relation) => {
  const list = map.get(relation["Desde ID"]);
  if (list) list.push(relation);
  else map.set(relation["Desde ID"], [relation]);
  return map;
}, new Map<string, NearbyRelation[]>());

/**
 * Single access point for the place dataset. Components read through these functions
 * instead of importing the JSON directly, so the storage shape (one file today, possibly
 * split by hub or region later) can change without touching UI code.
 */

/** Every place in the dataset, independent of hub. */
export function getAllPlaces(): Place[] {
  return allPlaces;
}

/** Looks up a place by id regardless of hub — used to resolve saved places and nearby
 * jumps even if they point outside whatever hub is currently active. */
export function getPlaceById(id: string): Place | undefined {
  return placesById.get(id);
}

export function getPlacesByHub(hub: string): Place[] {
  return placesByHub.get(hub) ?? EMPTY_PLACES;
}

/** Hubs present in the dataset, in first-seen order. */
export function getHubs(): string[] {
  return [...placesByHub.keys()];
}

/** Regions present in the dataset, in first-seen order. */
export function getRegions(): string[] {
  return [...new Set(allPlaces.map((place) => place.region))];
}

export function getNearby(placeId: string): NearbyRelation[] {
  return nearbyBySource.get(placeId) ?? EMPTY_NEARBY;
}
