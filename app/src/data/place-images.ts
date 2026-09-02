import type { PlaceImage } from "../types";

/**
 * Photography registry, keyed by place id.
 *
 * `data/places.json` is a build artifact generated from the research workbook, so image assets
 * are kept here instead of being written back into it. Every place currently ships with
 * `imageStatus: "brief-only"`, meaning no licensed photography has been sourced yet — the
 * registry is therefore intentionally empty and the gallery falls back to the editorial
 * `imageBrief`.
 *
 * To add photography for a place, append an entry with a resolvable `url` plus the licensing
 * metadata the source requires:
 *
 * ```ts
 * "JP-001": [
 *   {
 *     url: "/images/JP-001/crossing-night.jpg",
 *     alt: "Peatones cruzando en diagonal bajo las pantallas de Shibuya",
 *     credit: "Nombre del autor",
 *     source: "Wikimedia Commons",
 *     sourceUrl: "https://commons.wikimedia.org/wiki/File:...",
 *     license: "CC BY-SA 4.0",
 *   },
 * ],
 * ```
 *
 * Rules: never point at a URL that is not cleared for use, never reuse a photograph of a
 * different place, and always carry `credit`/`license` when the source demands attribution.
 */
export const placeImages: Record<string, PlaceImage[]> = {};

/** Images available for a place: those exported with the record, plus the registry. */
export function resolvePlaceImages(placeId: string, embedded?: PlaceImage[]): PlaceImage[] {
  return [...(embedded ?? []), ...(placeImages[placeId] ?? [])];
}
