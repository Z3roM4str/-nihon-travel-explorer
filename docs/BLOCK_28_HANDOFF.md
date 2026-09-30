# Handoff — Bloque 28 / B9.2 «Viaje · Reordenar»

## Estado

Trabajo en `codex/block-28-b9-2-reorder` desde `47a6f0e1549f273622a112820ace5279455cbd9e`. El PR único apunta a `main`; no se hace merge. SHA y URL se indican en el PR al publicarlo.

## Arquitectura

No se añadió dependencia. Un controlador pequeño de Pointer Events en `OrderedSequenceBuilder` usa `setPointerCapture` en el asa de 44 px, hit testing con `elementFromPoint` y una ranura transitoria por día. El componente no modifica ni preordena el draft durante `pointermove`. La fuente lleva `placeId` y `dayId` estable; el slot destino se convierte en posición final al soltar, con ajuste sólo para el movimiento dentro del mismo día. Un origen o destino que ya no coincida produce no-op.

`withPlaceRelocatedBetweenDays` es una mutación pura V8 para traslado entre días. `withPlaceInsertedIntoDay` añade una parada desde Sin asignar en posición exacta. Ambas validan el destino y la partición; la primera conserva todo el estado de ruta y sólo limpia el boundary de un origen vacío. El hook aplica una única actualización funcional por drop. «Mover a…» reutiliza `relocatePlace`, por lo que teclado y drag comparten semántica. «Mover día…» no cambia.

El asa contiene `touch-action: none`; el resto de la tarjeta y la pantalla conservan scroll y click. `pointercancel`, Escape, pérdida de captura, salida con drop inválido, cambio de vista/estado y desmontaje limpian el preview y detienen el auto-scroll. El scroll se aplica sólo al contenedor realmente desplazable, con velocidad acotada y sin animación decorativa; respeta reduced motion. Durante drag, el destino presenta contorno y línea de inserción, y un chip indica el nombre movido. Una live region anuncia destino o cancelación sin anunciar cada pixel. Tras el drop se devuelve el foco al asa del lugar movido.

El drawer Sin asignar conserva «Añadir al día…» y añade asa. B28 no implementa drop Día → Sin asignar; el botón B27 continúa usando exactamente `withoutPlaceFromDay`. Tampoco implementa drag de tarjetas de día; «Mover día…» sigue vigente. No hay storage key ni dependencia nueva.

## Pruebas y evidencia

La prueba pura se escribió y ejecutó roja antes de añadir las mutaciones V8 (2 fallos por funciones ausentes). Tras la implementación: build PASS; lint 0 errores con el warning heredado de `PlaceMap`; Vitest **108 archivos, 3430/3430 PASS**; `git diff --check` limpio. El gate B28 pasa **52/52** en Edge Chromium, con mouse, touch real por CDP en contexto Playwright touch, una escritura persistida por drop inter-día, posición exacta y no-op, día vacío, Sin asignar, foco, cancelación (Escape, pointercancel y pérdida de captura), auto-scroll y ocho viewports. En 320 px comprueba por hit testing que el asa y «Añadir al día…» del drawer no quedan bajo TabBar.

Regresión: B27 A–K PASS; B26 314/314; B25 123/123; B6.6 316/316; B18 browser back 15/15, Viaje-lugar 38/38, cromo 6/6, a11y 25/25; Phase 5A 50/50; integración B24+B23 58/58 (incluye Phase 5A escritorio y móvil 50/50 cada uno); DD-028 16/16; DDR03 43/43. Las suites puras de V5–V8, stable-day-identity, day-assignment, ordered-sequence, inter-hub, trip-bounds, accommodation y whole-trip-composition forman parte del Vitest total verde.

Capturas locales en `C:\Users\Fer\.codex\visualizations\2026\09\30\01a0efde-b0d9-78c1-a478-afe2272d5dd3\b28-shots` (fuera del PR): 320×568, 375×667, 390×844, 430×932, 820×1180, 1024×768, 1280×800, 1440×900 y estados durante drag. Se inspeccionaron manualmente 320, 390, 430, 820 y 1440: asa, miniatura, texto, drawer, TabBar, chip de parada e indicador legibles sin desbordamiento horizontal.

La primera ejecución paralela de B26, Phase 5A e integración agotó timeouts de click por carga de navegadores; la repetición secuencial pasó. Se actualizaron cuatro pruebas source-scanning heredadas: B27 ahora espera la mutación atómica, y dos pruebas de reserva limitan su prohibición de `requestAnimationFrame` a sus propias superficies. La prueba B17 de botones de icono motivó añadir `title` al asa. No hay DDR nueva.

## Diferidos

B9.3 «Probar otro orden» final, B9.4 «Dónde dormir», B9.5 Reservas/Resumen y B29 continúan pendientes. No se modificaron Astra, Vercel, dataset, metadata fotográfica, cálculos de transporte ni algoritmos de alternativas. No se desplegó ni se modificó `main`.
