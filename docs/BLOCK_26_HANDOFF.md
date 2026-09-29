# Bloque 26 — B8 «Nosotros» · Handoff

Misión: `docs/BLOCK_26_MISSION.md`. Contratos: `docs/design/05 §11`, `05 §1`, `10 §B8`, DD-007.

| Campo | Valor |
|---|---|
| Rama | `claude/b26-nosotros` |
| Base | `origin/main` @ `b5e734169e0940aaa21427d2c9c0f5dc03d9a236` (verificado) |
| `main` | no modificado |
| Astra / Vercel / PR #154 | no mezclados |

## Arquitectura

**Antes (B18–B25).** Pestaña «Nosotros» = cuatro bloques sueltos: `TravellerBar` (segmentado con
leyenda «Eres» y engranaje) + `TravellerManager embedded`; `TripBackup embedded`; botón «Ver de
nuevo»; MLIT + un recuento. Ambos componentes arrastraban un modo modal (scrim, trampa de foco,
cierre) sin uso. Onboarding de tres tarjetas, sin nombres.

**Después.**
- `components/NosotrosScreen.tsx`: cinco secciones (`<section aria-labelledby>` + `h2`) en el orden
  de `05 §11`: Viajeros · Copia del viaje · Cómo funciona Nihon · Fuentes y licencias · Acerca de.
  Columna de lectura ≤ 40 rem; nada en modal.
- `TravellerManager.tsx`: dos tarjetas (`PersonToken md`, nombre editable, «Marcados: N lugares»,
  estado de dispositivo en texto + icono + borde, «Usar este dispositivo como …» en la otra).
  `TravellerBar` (y su «Eres») eliminado. Sin modo modal.
- `TripBackup.tsx`: sólo contenido de sección. Foco al bloque que hay que decidir/leer; Escape
  retrocede un paso pendiente (nunca confirma); frase de confirmación del contrato.
- `Onboarding.tsx` + `lib/onboarding.ts`: Hola (fotografía real de un lugar grado S) · Explora Japón
  · Marca lo que te gustaría ver · Después comparáis · ¿Quiénes sois?; «Saltar» desde cualquier paso.
- `SourcesAndLicences.tsx` + `lib/sources-summary.ts`; `lib/app-version.ts` + `vite.config.ts`.
- `useTravellers`: `placesMarkedBy` (lectura) y `saveIdentity` (compone `withTravellerLabel` +
  `withActiveTraveller` en una sola actualización). Sigue habiendo un único `useState`.

## Auditoría de respaldo (hecha ANTES de tocar TripBackup)

1. **Qué exporta:** `nihon-portable-backup` v1 = `{format, version, exportedAt, data:{travellers,
   planningDraft}}`: el documento de viajeros (personas, activa, posturas) y el borrador de
   planificación V8 reconciliado con la lista compartida. Nada derivado, ni catálogo, ni fotos.
2. **Qué valida:** sobre, formato, versión (una versión futura se rechaza como tal), claves
   estrictas (`__proto__`/`constructor` rechazados), y cada documento con su propio parser.
3. **Qué claves reemplaza:** exactamente dos, `nihon.travellers.v1` y `nihon.manualPlanningDraft`
   (`RESTORED_STORAGE_KEYS`). Un borrador `null` **elimina** la clave (no deja el plan viejo).
4. **Error parcial:** `applyRestore` captura ambas claves, escribe, y ante cualquier fallo repone las
   ya escritas. Informa `rolledBack` de forma honesta (incluso `false`).
5. **JSON inválido:** `prepareImport` rechaza y no escribe nada; el mensaje dice «No se ha cambiado
   nada en este navegador».
6. **Rollback/transacción:** rollback de mejor esfuerzo, **no** transacción (localStorage no es
   atómico); documentado en `lib/portable-backup.ts`.
7. **APIs del navegador:** `<input type=file>` + `File.text()`, `Blob`, `URL.createObjectURL`, ancla
   con `download` añadida al DOM antes del clic y `revokeObjectURL` diferido (`setTimeout 0`),
   `localStorage`, `location.reload()` tras restaurar. Ninguna petición de red.

B26 no modifica `lib/portable-backup.ts`, `usePortableBackup.ts` ni el formato. Sólo cambia la
presentación y la frase de confirmación («Esto sustituirá todo lo que hay en este navegador.»).

## Decisiones de reconciliación

- **`05 §1` «Saltar acepta los nombres por defecto y la persona A como activa».** El almacén nace
  con «Persona 1 / Persona 2» y la primera persona activa, así que «Saltar» en la primera ejecución
  **no escribe nada** y ya cumple la frase. Al **reabrir** desde Nosotros, Escape / × / fondo /
  «Saltar» tampoco escriben: aplicar defaults o A al saltar destruiría nombres y persona activa
  existentes, semántica que ningún documento pide. Sólo «Entrar» escribe. No requiere DDR.
- **«Tocar el token lleva a Nosotros › Viajeros» (`02 §D4`, DD-007).** Nosotros conserva su scroll,
  así que sólo cambiar de pestaña podía aterrizar en «Fuentes». `openViajeros` cambia de pestaña y
  además lleva el scroll y el foco al `h2` de Viajeros. Respaldado por `02 §D4`; sin navegación profunda
  nueva.
- **«Versión/dataset».** No existe un número de versión de dataset. No se inventa: se muestra la
  versión de la app (los datos viajan dentro) y los recuentos reales del catálogo. `updatedAt` de
  los lugares no se muestra; la fecha que aparece es `Consultada` de `data/sources.json`.
- **Onboarding con una sola persona** (tras «Quitar»): muestra un campo, no crea personas.
- **Gate `block13-portable-backup-browser-audit.mjs`**: ya estaba obsoleto en `main` (pulsa un
  botón «Respaldo del viaje» que no existe desde B18, y usa `.selection-panel__toggle`,
  `.traveller-bar__option`). No se modifica en B26; su contrato lo cubre ahora
  `b26-nosotros-check.mjs` (archivo real descargado, confirmación previa, cancelar, inválido,
  reemplazo, fallo de escritura, sin red).

## Gates de B26

- `src/b26-nosotros.test.ts` (Vitest): contrato de identidad (puro), onboarding, fuentes, versión,
  estructura, orden de escritura del import.
- `scripts/b26-nosotros-check.mjs` (`NIHON_BROWSER=webkit` para WebKit): estructura y headings,
  viajeros, cambio de persona (token, corazones posteriores, preferencias intactas), renombrar
  (blanco/borrador), reiniciar/quitar/añadir, token de cabecera, export real, confirmación previa,
  cancelar, Escape, cinco tipos de JSON inválido, fallo de persistencia, reemplazo, persistencia
  tras recarga, sin red, onboarding (primera ejecución, foto, secuencia, defaults, «Saltar»,
  reapertura, «Entrar»), fuentes/MLIT/versión, responsive 320–1440, teclado, reduced motion, consola.

## Resultados de cierre (2026-09-29)

- `git diff --check` limpio · build PASS · lint 0 errores (1 warning heredado `PlaceMap.tsx:17`) ·
  Vitest 107 ficheros **3415/3415** (3395 + 20 de `b26-nosotros.test.ts`).
- Gate B26 `b26-nosotros-check.mjs`: **308/308 Chromium** y **308/308 WebKit** (verde en 6 ejecuciones
  finales, incl. 3 en paralelo). Una ejecución intermedia, concurrente con otros gates, dio 307/308
  y no se pudo reproducir ni identificar (su log no se conservó); se reporta tal cual.
- Regresión (certificado en el estado final): B25 123/123 · integración B24+B23 58/58 · Phase 5A
  50/50 escritorio + 50/50 móvil · DD-028 16/16 · B18 back 15/15 · viaje-lugar 38/38 · chrome 6/6 ·
  a11y 23/23 · responsive OK · B17 regresión 18/18 (+ responsive, tap 16/16) · B5 231/231 · B6 177/177
  · B23 28/28 · ddr03 43/43 · B20 ficha 73/73 · grid 52/52 · contraste OK · DDR-B24-3 9/9.
- Selectores actualizados **manteniendo el contrato**: `block5`, `block6` (tarjetas de persona en
  lugar de `.traveller-bar__option` / «Editar las personas»), `b17-regression` (idem), `block1-ux`
  (explicador «1 de 5»), `b24-real-input` (el texto «ciudad» está en el paso 2 tras «Hola»). Tests
  Vitest de `block17`, `block18-shell`, `TravellerLayer`, `onboarding` ajustados igual.
- **Fallos que ya existían en `main` @ `b5e7341` (verificados construyendo `main` en un worktree):**
  `b18-regression-check` (`.selection-list__name`, retirado por B25), `b24-real-input-audit` 8×
  «P0-2 … `.icon-button--small` en Quiero ir» (B25), y —sin cambiar— `block1-ux-browser-audit` tras
  el explicador (`.selection-panel__count`, B25), `block13-…-audit` y `block14-…-audit` (UI previa a
  B18). Ninguno es atribuible a B26; no se han tocado sus aserciones. Deuda para B10.
- Entorno de ejecución: `NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium`; los gates que llaman a
  `chromium.launch()` sin ruta necesitan `PLAYWRIGHT_BROWSERS_PATH` con un enlace al headless-shell
  preinstalado (Playwright 1.62 espera el build 1234, el entorno trae el 1194). B18 back /
  viaje-lugar usan `vite preview --port 4181`.

## Auditoría visual (Chromium, capturas reales 320/360/390/430/768/1440)

Revisadas: primera pantalla de Nosotros, dos tarjetas, nombre largo (80 caracteres, sin overflow:
el campo elipsa, la marca «Este dispositivo lo usa …» envuelve), edición, persona activa,
confirmación de importación, fuentes y licencias, «Hola», «¿Quiénes sois?» y reapertura.
Corregido en la auditoría: botón «Sustituir con este respaldo» ilegible (ahora secundario con color de
riesgo), icono de check comprimido en nombres largos, espacio de la nota bajo las tarjetas.
Estados de un solo viajero, nombres cortos y los seis anchos están cubiertos por el gate.

## Safari / iOS

- **Hecho (automático):** el mismo gate B26 ejecutado en **Playwright WebKit** (motor de Safari,
  Linux, Playwright 1.62 / WebKit 26.5) — export con descarga real (`download` desde ancla añadida al
  DOM), `input file`, confirmación, reemplazo, fallo de escritura: 308/308. **No se observó ninguna
  diferencia de resultado entre Chromium y WebKit.** Diferencias de entorno conocidas: WebKit no
  expone la ruta de escritorio del archivo descargado igual que Chromium (Playwright la resuelve),
  y el motor de escritorio no reproduce el manejo de descargas de la hoja de Safari iOS. Para
  ejecutarlo: `PLAYWRIGHT_BROWSERS_PATH=<dir> NIHON_BROWSER=webkit node scripts/b26-nosotros-check.mjs`
  (el WebKit de Playwright necesitó `playwright install webkit` + `install-deps`; el entorno base no
  lo trae).
- **PENDIENTE HUMANO — iPhone Safari real.** No se ha hecho ninguna prueba física. Falta validar en un
  iPhone: (1) que «Exportar respaldo» entrega un `.json` que se puede guardar en Archivos/compartir
  (Safari iOS trata `download` con su propia hoja); (2) que el selector de archivos de iOS puede
  elegir ese `.json` desde Archivos/iCloud; (3) que tras «Sustituir con este respaldo» y «Continuar»
  la app recarga con el viaje restaurado; (4) teclado de iOS al editar nombres y safe areas con la
  TabBar. WebKit de escritorio **no** sustituye esa prueba.

## Deudas diferidas

- `block13-portable-backup-browser-audit.mjs` obsoleto desde B18 (arriba).
- El selector de archivo usa el control nativo del navegador (su texto sigue el idioma del sistema).
- Sin DDR nueva.
