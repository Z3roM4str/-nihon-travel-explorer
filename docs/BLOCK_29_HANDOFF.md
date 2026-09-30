# Handoff — Bloque 29 / B9.3 «Herramientas del día · Probar otro orden»

## Estado

- Rama: `codex/block-29-b9-3-day-tools`.
- Base canónica exigida: `main` @ `797c9980d6c9baf2deeb3bd635cd7d159e4743bf`.
- PR único: [#167](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/167), abierto de esta rama a `main`; no merge ni despliegue.
- Commit de implementación publicado: `64d4a73129b6f617941075669b289bf55b9f39ff`; `main` seguía en la base exacta `797c9980d6c9baf2deeb3bd635cd7d159e4743bf` al abrir el PR.
- La rama se mantiene separada de `main`. B9.4, B9.5, B30 y B10 no se iniciaron.

## Arquitectura

`OrderedSequenceBuilder` monta `DayOrderToolPanel` dentro de la tarjeta del día cuyo botón la abrió. La tarjeta y la herramienta se asocian por el `dayId` estable; la hoja presenta «Día N» y fecha/hub disponibles como contexto. El botón no está disponible para cero o un lugar.

Al abrir, `OrderedSequenceBuilder` copia `day.placeIds` en `baselineDayPlaceIds`. `DayOrderToolPanel` crea su propio `proposalIds` efímero como copia del baseline. Reordenar con el selector accesible «Mover a…» y «Posición N» sólo cambia el estado local de la hoja. No hay estado B9.3 nuevo en `localStorage`, `sessionStorage`, el draft V8 ni una storage key. Cancelar, cerrar y Escape descartan la propuesta.

La lista «Orden actual» y «Propuesta» se construyen con `compareSequences(baselineDayPlaceIds, proposalIds)`. Ambas presentan la secuencia, los tramos, los traslados registrados, el rango, la cobertura/desconocidos y la mezcla de evidencia a través de `SequenceCandidateSummary`. La hoja convierte el resultado de comparación a texto B9.3 neutral; desconocidos no son cero, no se elige ganador si falta cobertura completa y los rangos sólo se separan cuando no se solapan. Un resultado inválido se presenta como error.

Las cinco familias `evidence-complete-*` siguen usando sus generadores existentes y conservan el orden determinista por familia. La hoja las muestra en «Opciones comprobadas», agrupadas por familia y sin ranking ni selección inicial. Cada opción lleva «Comprobado con datos completos» y «Probar esta opción». Al probarla se valida de nuevo `dayId`, baseline y permutación, y sólo se reemplaza `proposalIds`; no se escribe ni se aplica al viaje. La explicación de evidencia se muestra una vez en la sección. El estado vacío es «No hay opciones comprobadas con datos completos para este día.»

## Commit, atomicidad y estado stale

`withDayPlaceOrderApplied` es una mutación pura/fail-closed en `planning-draft-v8.ts`; `usePlanningDraft.applyDayPlaceOrder` realiza una sola actualización funcional del draft. En commit se vuelven a validar `days`, existencia única de `dayId`, igualdad exacta del baseline vigente, ausencia de duplicados, mismo set y longitud, IDs presentes en `routeIds` y diferencia real entre propuesta y baseline. Una propuesta idéntica no produce escritura.

Si el día desapareció o su orden cambió, no se modifica el draft. El panel indica que el día cambió, deshabilita las acciones y pide cerrarlo y volverlo a abrir. «Usar este orden» es el único CTA que solicita commit y aplica únicamente `day.placeIds` del día seleccionado. No hay N movimientos ni llamadas repetidas a `relocatePlace`.

La mutación preserva el `dayId`, el orden de días, la referencia/valor de `routeIds`, route set, fechas, boundary de alojamiento del día y de los demás, alojamientos, `accommodationLegs`, `visitStartTimes`, `interHubSegments`, `zoneAccommodationChoices`, Sin asignar, Quiero ir y el resto del draft. Los tests puros cubren apply válido, referencias y campos intactos, duplicados, IDs extra/faltantes, baseline stale, `dayId` desconocido, `days === null` y candidato idéntico.

## Foco y regresión B28

La hoja es inline y no modal, consistente con Viaje; conserva el orden DOM lógico y no agrega otra trampa de foco. Al abrir mueve el foco al encabezado. Escape se captura en fase de captura, cierra sólo la herramienta y evita que la capa contenedora de Viaje reciba el mismo Escape. Cancelar, cerrar y el commit exitoso restauran foco al botón de «Probar otro orden» del mismo `dayId`.

No se reutiliza el controlador Pointer Events persistente para la propuesta. Mientras está abierta, el drag de `TripStop` se deshabilita para impedir iniciar un movimiento detrás de la herramienta. El gate nuevo ejecuta también el gate de drag B28 (mouse y touch). «Mover a…» de B28, «Mover día…», reduced motion, auto-scroll, live region, Sin asignar e identidad estable siguen cubiertos por B28/B27.

La vista global histórica «Orden A / Orden B» permanece como código del builder legacy; el entry point primario de Viaje abre la cronología Días y no presenta el flujo global. B9.3 conserva la comparación existente, ahora local al día, sin quitar `sequence-comparison.ts` ni otros helpers útiles.

## Responsive y revisión visual

Auditoría Chromium en 320×568, 375×667, 390×844, 430×932, 820×1180, 1024×768, 1280×800 y 1440×900. La lista se apila en móvil y usa dos columnas en anchos amplios; no se observó overflow horizontal ni CTA cubierto por TabBar. Botones y selectores cumplen el tamaño táctil mínimo del gate (44 px). En 320 px el texto del CTA deshabilitado puede ocupar dos líneas, manteniéndose visible y legible.

Capturas completas y de panel guardadas fuera del repositorio, en `/tmp/nihon-b29-shots/`:

- `b29-{320x568,375x667,390x844,430x932,820x1180,1024x768,1280x800,1440x900}.png`
- capturas de cabecera/acciones: `b29-{320x568,390x844,1440x900}-tool-{top,actions}.png`

## Verificación

- `git diff --check`: PASS.
- `npm run build`: PASS. Vite informa que el bundle principal supera 500 kB minificado; build correcto.
- `npm run lint`: 0 errores; un warning heredado en `src/components/PlaceMap.tsx:17` (`react(only-export-components)`).
- `npm test -- --run`: **112 archivos, 3457/3457 PASS**. Incluye `sequence-comparison`, `ordered-sequence`, cinco familias `evidence-complete-*`, planning draft V8, stable day identity y whole-trip composition.
- `app/scripts/b29-day-order-tools-check.mjs`: **101/101 PASS**, Chromium disponible en `/usr/bin/chromium`; incluye storage writes, apply/reload, Cancel/Escape/foco, stale, contenido accesible y ocho viewports. También ejecuta B28.
- B28 drag: **64/64 PASS**, mouse y touch.
- B27 Viaje Días: **A–K PASS**, ocho viewports (el gate ahora abre la herramienta y comprueba foco, baseline, no escritura y Escape).
- B26 Nosotros: **314/314 PASS**.
- B25 Quiero ir: **123/123 PASS**. El runner necesitó un wrapper de Chromium con `--ignore-certificate-errors` por certificados TLS de recursos externos en este entorno; el código de producto no se modificó por ello.
- B18 browser-back: **15/15 PASS** contra preview local en puerto 4181.
- Las capturas anteriores se revisaron visualmente después de la última corrida del gate.

## Archivos de B29

- UI/estilos: `app/src/components/DayOrderToolPanel.tsx`, `SequenceCandidateSummary.tsx`, `OrderedSequenceBuilder.tsx`, `app/src/App.css`.
- Dominio y hook: `app/src/lib/day-order-tool.ts`, `planning-draft-v8.ts`, `app/src/usePlanningDraft.ts`.
- Pruebas: `DayOrderToolPanel.test.ts`, `day-order-tool.test.ts`, `planning-draft-day-order.test.ts`; expectativas de superficie legacy alineadas en tests de `OrderedSequenceBuilder` por familia.
- Gates: `app/scripts/b29-day-order-tools-check.mjs`, actualización B9.3 del gate `app/scripts/b27-viaje-dias-check.mjs`.
- Documentación: `docs/BLOCK_29_MISSION.md`, este handoff y `docs/CURRENT_WORK_HANDOFF.md`.

## Diferido

B9.4 «Dónde dormir», B9.5 «Reservas/Resumen», B30 y B10 cleanup. No se tocaron Astra, Vercel, dataset, fotografía, cálculos de transporte, algoritmos evidence-complete ni semántica de reservas. No se desplegó ni se hizo merge.
