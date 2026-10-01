import type { Plugin } from 'vite'

// B10: the UI's synchronous registry consumes these fields in place-images.ts.
// Acquisition dimensions/dates, role and LQIP stay in the canonical JSON for tooling;
// no current PlaceImage exposes them. Sources, credits and cited literals are retained.
const registryFields = [
  'placeId', 'assetPath', 'alt', 'source', 'sourceUrl', 'credit', 'license',
  'licenseUrl', 'originalTitle', 'attributionTitle', 'processing',
] as const

export function photoRegistryProjection(): Plugin {
  return {
    name: 'nihon-photo-registry-projection',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/data/photography-metadata.json')) return
      const metadata = JSON.parse(code) as { images: Record<string, unknown>[] }
      return JSON.stringify({
        ...metadata,
        images: metadata.images.map(record => Object.fromEntries(
          registryFields.filter(field => field in record).map(field => [field, record[field]]),
        )),
      })
    },
  }
}
