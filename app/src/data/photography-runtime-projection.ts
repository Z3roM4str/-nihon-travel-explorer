/**
 * Runtime projection of the photography registry (B10-P1).
 *
 * `photography-metadata.json` is the pipeline's authoritative record of every licensed
 * photograph — it carries acquisition URLs/dates, original dimensions, the role and a ~600 byte
 * inline LQIP per image. The runtime reads none of that: `buildRegistry` in `place-images.ts`
 * copies exactly the fields below into a `PlaceImage`. Shipping the rest put ~215 kB of
 * bytes (148 kB of it base64, which gzip cannot shrink) into the entry chunk for nothing.
 *
 * The canonical file is not touched. A Vite plugin (`vite.config.ts`) serves this projection for
 * the `?runtime` import of the file, so there is no second copy to drift. Tests assert that
 * the registry built from the projection equals the registry built from the full file.
 */
export const RUNTIME_PHOTOGRAPHY_FIELDS = [
  "placeId",
  "assetPath",
  "alt",
  "source",
  "sourceUrl",
  "credit",
  "license",
  "licenseUrl",
  "originalTitle",
  "attributionTitle",
  "processing",
] as const;

export type RuntimePhotographyField = (typeof RUNTIME_PHOTOGRAPHY_FIELDS)[number];

/** Keeps only the runtime fields of every record, preserving record order and absent optionals. */
export function projectPhotographyMetadata(metadata: { images: Record<string, unknown>[] }): {
  images: Record<string, unknown>[];
} {
  return {
    images: metadata.images.map((record) => {
      const projected: Record<string, unknown> = {};
      for (const field of RUNTIME_PHOTOGRAPHY_FIELDS) {
        if (field in record) projected[field] = record[field];
      }
      return projected;
    }),
  };
}
