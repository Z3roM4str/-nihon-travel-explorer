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
 * `data/visual/photography-metadata.json`. Every place outside the pilot simply has no entry here, so the gallery falls back to the
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
  licenseUrl: string;
  originalTitle: string;
  attributionTitle?: string;
  processing: "webp-reencoded" | "resized-and-webp-reencoded";
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
      licenseUrl: record.licenseUrl,
      sourceFileTitle: record.originalTitle,
      attributionTitle: record.attributionTitle,
      processing: record.processing,
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

/**
 * Width of the card-sized rendition built by `scripts/build-photography-derivatives.py`.
 *
 * Block 1 made the place list photo-led, and every card was then filling a ~350-390 CSS px
 * slot from the 1600px detail hero: scrolling one hub pulled ~9.5 MiB to draw 37 thumbnails.
 * The derivative is the same photograph at the width a card actually needs.
 */
export const CARD_IMAGE_WIDTH = 800;

/**
 * `.../slug.webp` -> `.../slug-800w.webp`.
 *
 * Deliberately derived rather than declared. The alternative — a second URL field on every
 * registry record — would add 144 hand-maintainable strings, a second parity surface between
 * the canonical and app copies of the registry, and a way for the two to disagree. This
 * function is mirrored byte for byte by `derivative_path_for()` in the build script and by
 * `scripts/validate-photography.py`, and the validator fails if any derivative is missing.
 *
 * Returns null for anything that is not a `.webp` registry asset, so a future embedded or
 * remote image (which has no derivative) silently keeps using its own single URL.
 */
export function cardImageUrl(url: string): string | null {
  if (!url.endsWith(".webp")) return null;
  return `${url.slice(0, -".webp".length)}-${CARD_IMAGE_WIDTH}w.webp`;
}
