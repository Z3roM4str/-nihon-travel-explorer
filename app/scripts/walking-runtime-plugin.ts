import type { Plugin } from 'vite'

// transfer.ts builds its synchronous private index from these fields. Query coordinates,
// durationSecondsRaw remain in the canonical artifacts; the public
// TransferEdge retains minutes, distance, confidence, source and verifiedAt unchanged.
// Attribution literals are also retained in the build even though the API does not read them.
// Keep the snapping assessment: dropping it would demote validated edges to estimates.
const fields = [
  'fromId', 'toId', 'status', 'distance', 'minutes', 'confidence', 'verifiedAt',
  'source', 'endpointSnapping', 'attribution',
] as const

export function walkingRuntimeProjection(): Plugin {
  return {
    name: 'nihon-walking-runtime-projection',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/src\/data\/logistics\/walking-(pilot|scale)-results\.json$/.test(id.replace(/\\/g, '/'))) return
      const results = JSON.parse(code) as Record<string, unknown>[]
      return JSON.stringify(results.map(record => Object.fromEntries(
        fields.filter(field => field in record).map(field => [field, record[field]]),
      )))
    },
  }
}
