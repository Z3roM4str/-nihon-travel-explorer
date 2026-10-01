import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { photoRegistryProjection } from './scripts/photo-registry-plugin.ts'

// B26 (`05 §11` «Acerca de»): la versión de la aplicación tiene una única fuente de verdad,
// `package.json`. Se inyecta en la compilación; nada en `src/` repite el número.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), photoRegistryProjection()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
