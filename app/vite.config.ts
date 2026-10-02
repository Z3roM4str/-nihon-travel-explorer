import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { walkingRuntimeProjection } from './scripts/walking-runtime-plugin.ts'
import { projectPhotographyMetadata } from './src/data/photography-runtime-projection.ts'

// B26 (`05 §11` «Acerca de»): la versión de la aplicación tiene una única fuente de verdad,
// `package.json`. Se inyecta en la compilación; nada en `src/` repite el número.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

// B10-P1: `photography-metadata.json?runtime` is the registry reduced to the fields the runtime
// reads (see `src/data/photography-runtime-projection.ts`). The full JSON stays canonical.
const RUNTIME_SUFFIX = '?runtime'
const VIRTUAL_PREFIX = '\0nihon-photography-runtime:'
function photographyRuntimeProjection(): Plugin {
  return {
    name: 'nihon-photography-runtime-projection',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.endsWith(`photography-metadata.json${RUNTIME_SUFFIX}`)) return null
      const resolved = await this.resolve(source.slice(0, -RUNTIME_SUFFIX.length), importer, { ...options, skipSelf: true })
      // A virtual id (not `*.json`) so Vite's JSON plugin does not parse the generated module.
      return resolved ? `${VIRTUAL_PREFIX}${resolved.id}.js` : null
    },
    load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return null
      const file = id.slice(VIRTUAL_PREFIX.length, -".js".length)
      this.addWatchFile(file)
      const projected = projectPhotographyMetadata(JSON.parse(readFileSync(file, 'utf8')))
      return photographyModule(projected)
    },
  }
}

function photographyModule(data: unknown): string {
  const counts = new Map<string, number>()
  const count = (value: unknown): void => {
    if (typeof value === 'string') counts.set(value, (counts.get(value) ?? 0) + 1)
    else if (value && typeof value === 'object') Object.values(value).forEach(count)
  }
  count(data)
  const repeated = new Map([...counts].filter(([value, n]) => n > 1 && value.length >= 24)
    .map(([value], i) => [value, `_s${i}`]))
  const serialize = (value: unknown): string => {
    if (typeof value === 'string') return repeated.get(value) ?? JSON.stringify(value)
    if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`
    if (value && typeof value === 'object') return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}:${serialize(item)}`).join(',')}}`
    return JSON.stringify(value)
  }
  return `${[...repeated].map(([value, name]) => `const ${name}=${JSON.stringify(value)};`).join('\n')}\nexport default ${serialize(data)}`
}

// https://vite.dev/config/
export default defineConfig({
  build: { manifest: "map-manifest.json" },
  plugins: [photographyRuntimeProjection(), react(), walkingRuntimeProjection()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
