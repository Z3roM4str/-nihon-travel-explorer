import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
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
      return `export default ${JSON.stringify(projected)}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [photographyRuntimeProjection(), react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
