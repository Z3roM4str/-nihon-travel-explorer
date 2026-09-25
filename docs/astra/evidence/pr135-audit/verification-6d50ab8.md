# Verificación de la corrección JSDOM — código `6d50ab86f5ab9cd0d734b448f9e5307935d5f235`

Fecha: 2026-09-21 (UTC)

Esta es evidencia de un **intento bloqueado**, no un resultado aprobado. No modifica ni reetiqueta los artefactos históricos de `79748e85b7884c8f85ea1d71066ae72b72e4bd95`.

## Cambio verificado por inspección

`night-ui-corrections.test.ts` instala para cada prueba una implementación controlada `vi.fn()` de `HTMLElement.prototype.scrollTo`. Guarda previamente el descriptor y, en `afterEach`, lo restaura exactamente o elimina la propiedad si JSDOM no la proporcionaba. No cambia código de producción ni elimina aserciones.

## Comandos y resultados reales

- `npm ci --include=dev --ignore-scripts --no-audit --no-fund`: quedó esperando la red del registro durante más de dos minutos y se interrumpió; dejó `node_modules` incompleto.
- `npm run lint`: no ejecutable después del intento de instalación (`oxlint: not found`). La verificación independiente del commit anterior informó lint sin errores y cuatro advertencias.
- `npm test`: no ejecutable (`vitest: not found`). La verificación independiente del commit anterior informó 2473 aprobadas y el único fallo de `scrollTo` que corrige este commit.
- `npm run build`: bloqueado porque TypeScript no puede resolver `@testing-library/react` en la instalación incompleta.
- `ASTRA_EXPECTED_SHA=6d50ab86f5ab9cd0d734b448f9e5307935d5f235 npm run audit:astra:browser`: bloqueado antes de los recorridos porque falta el ejecutable Chromium de Playwright.

## Evidencia visual

No se generaron capturas ni trazas nuevas, y no se declara aprobado `09-persistence-recovery`. La revisión móvil de Explorar, ficha y Nuestro viaje sigue pendiente de un entorno con dependencias completas y Chromium instalado.
