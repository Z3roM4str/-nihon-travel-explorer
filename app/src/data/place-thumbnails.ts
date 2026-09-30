/**
 * Width of the list-sized rendition (`06 §7`: «`-400w` — miniaturas: `PlaceCard compact`, paradas
 * del planner»). B27 (B9.1): `TripStop` draws a 56×56 CSS-px thumbnail, so the 800px card
 * derivative would ship ~4× the pixels it can show. The `-400w` file is emitted for every registry
 * asset by `scripts/build-photography-derivatives.py` and its presence is asserted by
 * `photography-derivatives.test.ts`.
 *
 * Deliberately its own module: `data/place-images.ts` is a guarded catalogue file (the B24+B23
 * integration gate requires it byte-identical), and B27 does not touch the catalogue.
 */
export const THUMB_IMAGE_WIDTH = 400;

/** `.../slug.webp` -> `.../slug-400w.webp`; null for anything that is not a `.webp` registry asset. */
export function thumbImageUrl(url: string): string | null {
  if (!url.endsWith(".webp")) return null;
  return `${url.slice(0, -".webp".length)}-${THUMB_IMAGE_WIDTH}w.webp`;
}
