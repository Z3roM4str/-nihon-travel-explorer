# Handoff — Bloque 28 / B9.2 «Viaje · Reordenar»

## Estado

**B28 / B9.2 INTEGRADO en `main`** mediante PR #164 y merge commit
`2e5d3c32e4e773cea78de68c7c8c6a7b09a351f6`.

- Main previo: `47a6f0e1549f273622a112820ace5279455cbd9e`.
- HEAD B28 certificado: `d3b8a04831c3beed67f2e397d741f40e22b421e6`.
- Padres del merge: exactamente esos dos SHAs.
- Árbol del merge: `663d2e38354ab84116a98a03364834095b473c59`.
- Árbol del HEAD certificado: `663d2e38354ab84116a98a03364834095b473c59`.
- Resultado: **árbol idéntico**, por lo que la certificación B28 se transfiere al merge sin cambios de código.

## Arquitectura

No se añadió dependencia. Un controlador pequeño de Pointer Events en `OrderedSequenceBuilder` usa `setPointerCapture` en el asa de 44 px, hit testing con `elementFromPoint` y una ranura transitoria por día. El componente no modifica ni preordena el draft durante `pointermove`. La fuente lleva `placeId` y `dayId` estable. El helper puro `resolveFinalPosition` normaliza el slot crudo al probar el destino; el resultado guardado alimenta la mutación y tanto el anuncio durante el drag como el anuncio final. Sólo ajusta el movimiento dentro del mismo día. Un origen o destino que ya no coincida produce no-op.

`withPlaceRelocatedBetweenDays` es una mutación pura V8 para traslado entre días. `withPlaceInsertedIntoDay` añade una parada desde Sin asignar en posición exacta. Ambas validan el destino y la partición; la primera conserva todo el estado de ruta y sólo limpia el boundary de un origen vacío. El hook aplica una única actualización funcional por drop. «Mover a…» reutiliza `relocatePlace`, por lo que teclado y drag comparten semántica. «Mover día…» no cambia.

El asa conserva touch-action: none; el resto de la tarjeta y la pantalla mantienen scroll y click. pointercancel, Escape, pérdida de captura, salida con drop inválido, cambio de vista/estado y desmontaje limpian el preview y detienen el auto-scroll. El controlador usa incrementos de 12 px por frame mientras el puntero permanece en los 72 px interiores de un borde desplazable (admite 24 px de margen exterior). Con prefers-reduced-motion: reduce, aplica saltos discretos de 64 px; mientras el puntero siga en el borde, vuelve a comprobar la posición en cada frame, pero sólo cambia scrollTop como máximo una vez cada 160 ms. Al cancelar o soltar se cancela el frame pendiente; no usa scroll suave de CSS. Durante drag, el destino presenta contorno y línea de inserción, y un chip indica el nombre movido. Una live region anuncia la posición final normalizada durante el drag y tras el drop, o la cancelación, sin anunciar cada pixel. Tras el drop se devuelve el foco al asa del lugar movido.

El drawer Sin asignar conserva «Añadir al día…» y añade asa. B28 no implementa drop Día → Sin asignar; el botón B27 continúa usando exactamente `withoutPlaceFromDay`. Tampoco implementa drag de tarjetas de día; «Mover día…» sigue vigente. No hay storage key ni dependencia nueva.

## Pruebas y evidencia

Recertificación de los P1: build PASS (Vite informa el límite heredado de chunk >500 kB); lint PASS, sin errores y con el warning heredado de `PlaceMap`; Vitest **109 archivos, 3431/3431 PASS**; `git diff --check` limpio. El gate B28 pasa **64/64** en Microsoft Edge Chromium, con mouse, touch real por CDP en contexto Playwright touch, una escritura persistida por drop inter-día, posición exacta y no-op, día vacío, Sin asignar, foco, cancelación (Escape, pointercancel y pérdida de captura), auto-scroll y ocho viewports. Añade el caso A entre C y D: el draft queda B C A D y la live region anuncia «Día 1, posición 3» durante el drag y «Parada movida al Día 1, posición 3» tras soltar; también verifica D al inicio y el anuncio de posición 1. En contexto Playwright con reducedMotion=reduce comprueba avance ≥192 px en saltos observados de 64 px, Escape cancela el siguiente frame y el draft no cambia. En 320 px comprueba por hit testing que el asa y «Añadir al día…» del drawer no quedan bajo TabBar.

Regresión repetida en Microsoft Edge Chromium: B27 A–K PASS; B18 browser back 15/15; B25 123/123; B26 314/314. B6.6 316/316; B18 Viaje-lugar 38/38, cromo 6/6 y a11y 25/25; Phase 5A 50/50; integración B24+B23 58/58 (incluye Phase 5A escritorio y móvil 50/50 cada uno); DD-028 16/16; DDR03 43/43 son resultados históricos previos a esta recertificación. Las suites puras de V5–V8, stable-day-identity, day-assignment, ordered-sequence, inter-hub, trip-bounds, accommodation y whole-trip-composition forman parte del Vitest total verde.

Capturas locales en `C:\Users\Fer\.codex\visualizations\2026\09\30\01a0efde-b0d9-78c1-a478-afe2272d5dd3\b28-shots` (fuera del PR): 320×568, 375×667, 390×844, 430×932, 820×1180, 1024×768, 1280×800, 1440×900 y estados durante drag. Se inspeccionaron manualmente 320, 390, 430, 820 y 1440: asa, miniatura, texto, drawer, TabBar, chip de parada e indicador legibles sin desbordamiento horizontal.

La primera ejecución paralela de B26, Phase 5A e integración agotó timeouts de click por carga de navegadores; la repetición secuencial pasó. Se actualizaron cuatro pruebas source-scanning heredadas: B27 ahora espera la mutación atómica, y dos pruebas de reserva limitan su prohibición de `requestAnimationFrame` a sus propias superficies. La prueba B17 de botones de icono motivó añadir `title` al asa. No hay DDR nueva.

## Diferidos

**Siguiente bloque canónico: B29 / B9.3 — Herramientas del día · «Probar otro orden».** Debe convertir la capacidad existente en una hoja local al día: orden actual + propuesta manipulable + comparación de traslados mediante `sequence-comparison.ts`, y ofrecer las alternativas `evidence-complete-*` como opciones «Comprobado con datos completos», nunca aplicadas solas. B9.4 y B9.5 siguen pendientes. No se modificaron Astra, Vercel, dataset, metadata fotográfica ni cálculos de transporte.

## Addendum P-06 v2 (contrato modificado)

B28 certificaba asas de arrastre con ratón **y touch real por CDP**. Con P-06 v2 las asas sólo existen con puntero fino (`(hover: hover) and (pointer: fine)`): **en touch no hay asas en N1** y el orden fino pasa a «Cambiar orden» (N3, P-06·C).
El gate (ahora 69 comprobaciones) conserva todo el arrastre con ratón, comprueba que touch no muestra ninguna asa y que la alternativa táctil/teclado (Sheet de la parada) mueve **al final** del día destino. Ya no hay «Posición N» en la alternativa al arrastre.
