import type { PlaceImage } from "../types";
import photographyMetadata from "./photography-metadata.json";

/**
 * Photography registry, keyed by place id.
 *
 * `data/places.json` is a build artifact generated from the research workbook, so image
 * assets are kept here instead of being written back into it. Phase 4A sourced a 24-place
 * pilot (see `docs/PHOTOGRAPHY_PILOT.md`) from `photography-metadata.json` — the
 * authoritative record of every licensed photograph's asset path, alt text, and
 * attribution, produced by `scripts/acquire-photography.py` from
 * `data/visual/photography-metadata.json`. Every place outside the pilot still ships with
 * `imageStatus: "brief-only"` and has no entry here, so the gallery falls back to the
 * editorial `imageBrief` exactly as before this phase.
 *
 * To add photography for a place, append a record to `data/visual/photography-metadata.json`
 * (never here directly — this file only reshapes that JSON into the `PlaceImage` the
 * gallery renders) with a licensed asset acquired via `scripts/acquire-photography.py`.
 * Rules: never point at an unlicensed source, never reuse a photograph of a different
 * place, and always carry `credit`/`license` when the source demands attribution.
 */
type PhotographyRecord = {
  placeId: string;
  assetPath: string;
  alt: string;
  source: string;
  sourceUrl: string;
  credit: string;
  license: string;
};

function buildRegistry(records: PhotographyRecord[]): Record<string, PlaceImage[]> {
  const registry: Record<string, PlaceImage[]> = {};
  for (const record of records) {
    const image: PlaceImage = {
      url: `${import.meta.env.BASE_URL}${record.assetPath}`,
      alt: record.alt,
      credit: record.credit,
      source: record.source,
      sourceUrl: record.sourceUrl,
      license: record.license,
    };
    const list = registry[record.placeId];
    if (list) list.push(image);
    else registry[record.placeId] = [image];
  }
  return registry;
}

export const placeImages: Record<string, PlaceImage[]> = buildRegistry(
  (photographyMetadata as { images: PhotographyRecord[] }).images
);

/** Images available for a place: those exported with the record, plus the registry. */
export function resolvePlaceImages(placeId: string, embedded?: PlaceImage[]): PlaceImage[] {
  return [...(embedded ?? []), ...(placeImages[placeId] ?? [])];
}
