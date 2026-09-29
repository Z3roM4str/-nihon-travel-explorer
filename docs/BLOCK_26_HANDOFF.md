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

## Safari / iOS

- **Hecho (automático):** el mismo gate B26 ejecutado en **Playwright WebKit** (motor de Safari,
  Linux) — export con descarga real, `input file`, confirmación, reemplazo, fallo de escritura.
  Diferencias Chromium/WebKit observadas: ver informe final.
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
