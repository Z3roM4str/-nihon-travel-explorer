# Handoff — Bloque 27 / B9.1 «Viaje · Días»

## Estado de cierre

**B27 / B9.1 INTEGRADO en `main`** mediante PR #162 y merge commit
`fa64d868420880ba598e05e61dbe8d213d16430c`.

- Main previo: `eab63a8af34c8e0474340eba4687766be979933b`.
- HEAD B27 certificado: `30549a19df02b352aaf66985357827a568f71510`.
- Padres del merge: exactamente esos dos SHAs.
- Árbol del merge: `1f235da5b0746c636f278746d40e7bdc2134a01e`.
- Árbol del HEAD certificado: `1f235da5b0746c636f278746d40e7bdc2134a01e`.
- Resultado: **árbol idéntico**, por lo que la certificación de B27 se transfiere al merge sin cambios de código.

La rama se había rebasado sobre `origin/main` `eab63a8af34c8e0474340eba4687766be979933b`, que ya contiene B26/PR #159.
El rebase tuvo cruces en `app/src/App.css` y `docs/CURRENT_WORK_HANDOFF.md`; se conservaron juntos los estilos de
Nosotros/onboarding de B26 y la presentación de Días de B27, y se mantuvieron el handoff canónico de B26 y la sección
B27. No se eligió `ours`/`theirs` automáticamente.

## Certificación final

- `git diff --check`: limpio.
- `npm run build`: PASS. Vite advierte que el bundle principal minificado supera 500 kB; build termina correctamente.
- `npm run lint`: 0 errores; 1 warning heredado en `src/components/PlaceMap.tsx:17:14` (`react/only-export-components`).
- Vitest: **107 archivos, 3426/3426 PASS**, incluidas las 11 pruebas puras nuevas de la mutación V8.
- B26 Nosotros: 314/314; B25 Quiero ir: 123/123; B5 viajeros: 231/231; B6 divergencia: 177/177.
- B18: browser-back 15/15, Viaje-lugar 38/38, cromo 6/6 y accesibilidad 25/25.
- B23 photo retry: 28/28; Phase 5A: 50/50 escritorio + 50/50 móvil; integración B24+B23: 58/58.
- DD-028: 16/16; DDR03 persistencia: 43/43; DDR-B24-3 colecciones de portada: 9/9.
- Gate B27: **PASS A–K, 8 viewports**, incluido browser back, asignación/poda V8, persistencia, teclado, drawer y consola.

Chromium real de esta PC: Microsoft Edge `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
(motor Chromium 153.0.4234.48). Playwright Chromium empaquetado no pudo arrancar por configuración Side-by-Side de Windows;
el ejecutable Edge local se usó para los gates de navegador.

Capturas finales en `C:\Users\Fer\AppData\Local\Temp\nihon-b27-shots-20260929-final` (320×568, 375×667,
390×844, 430×932, 820×1180, 1024×768, 1280×800 y 1440×900), más capturas de «Mover a…», Sin asignar arriba/abajo,
InterHub activo y «Probar otro orden». Se inspeccionaron visualmente 320×568, 390×844, 430×932, 820×1180 y 1440×900:
sin desbordamiento horizontal ni solapamientos; rail, tarjetas, miniaturas, transferencias, acciones, fechas y TabBar
legibles; el panel de escritorio conserva un ancho cómodo. Los inputs de fecha y alojamiento recibieron altura mínima de
44 px para cumplir el objetivo táctil. Los gates verifican el resto de controles y el contenido final del drawer.

Teclado real: se recorrieron controles con Tab/Shift+Tab, foco visible, Enter/Space y select de «Mover a…»; PlaceDetail
se abrió y se volvió a la superficie. `page.goBack()` de Playwright pasó en B18/B25/B27. En la sesión visual local,
`Alt+Left` no fue emitido por el navegador integrado; su equivalente de historial `tab.back()` sí volvió a Viaje y el
gate Playwright confirmó la semántica de browser back.

La deuda de gates históricos `b18-regression-check`, `b24-real-input-audit`, `block1`, `block13` y `block14` sigue
documentada en `docs/BLOCK_26_HANDOFF.md`; no se usó para debilitar ningún gate de esta certificación.

## Implementación

- **Día como unidad primaria:** entrada directa en Días, IDs opacos persistidos y fechas civiles
  derivadas por ordinal.
- **Día completo:** «Mover día…» elige una posición explícita y delega cada paso en `moveDay`; viajan
  juntos ID, lugares, alojamiento y datos asociados. No reaparece el trío ↑ ↓ × ni drag-and-drop.
- **TripStop:** miniatura de tarjeta/placeholder, posición, nombre, contexto y duración, ficha compartida,
  «Mover a…» con día/posición y «Mover a Sin asignar».
- **Sin asignar:** `withoutPlaceFromDay` es una mutación pura de V8. Valida ruta+día, actualiza
  atómicamente el set del recorrido y la entidad estable, y poda el `visitStartTime`, los tramos de
  alojamiento y los segmentos inter-hub que referencian al lugar. Si el día queda vacío, sólo su
  `accommodationBoundary` vuelve a `unselected`.
- **Estado preservado:** IDs/orden/contenido de los demás días, fechas, anchors, elecciones de zona,
  datos de otros lugares y Quiero ir permanecen intactos. `withPlaceAddedToDay` restaura únicamente
  la pertenencia a ruta+día; lo podado no se reconstruye ni resucita.
- **Acciones del día:** añadir desde el mismo conjunto derivado de Sin asignar, eliminar día vacío,
  mover el día y disclosure local «Probar otro orden». Las alternativas existentes siguen siendo
  opcionales, neutrales y sólo se aplican tras acción expresa.
- **Inter-hub:** un segmento que `assessInterHubSegment` clasifica activo y
  `between-consecutive-days` se proyecta como fila compacta entre esas dos tarjetas; los inactivos y
  same-hub no se presentan como traslado activo. El editor completo sigue en Herramientas.
- **Cabecera:** «Viaje» muestra rango civil derivado cuando hay dos límites, sólo inicio cuando es el
  único dato, y el control canónico «Poner fecha de inicio» cuando falta.
- **Gate B27:** ampliado a comportamiento A–K, fechas reales, añadir/eliminar/mover días, teclado,
  movimientos inter/intradía, ciclo bidireccional Sin asignar con poda verificada, persistencia/reload,
  wishlist inmutable, back con `aria-pressed="true"`, tolerancia real de scroll y estado del drawer,
  storage keys, InterHub activo/inactivo, targets, overflow, consola y ocho viewports. La búsqueda acepta
  `.exe` en Windows y respeta `NIHON_CHROMIUM_PATH`.

## Suite y alineación de los 17 fallos iniciales

Los 17 fallos eran expectativas source-scanning del marcado anterior, no fallos de dominio: B18 (2),
identidad/reordenación estable (6), TravellerLayer (1), B20 (1), ZonePlan (3), Divergence reduced-motion
(1), trip bounds (2) y bundle architecture (1). Se actualizaron sólo las expectativas de presentación:
`planificar` → `dias`, select de destino estable en vez de flechas, fecha integrada en el heading,
`Fragment` como key, disclosure nuevo entre calendario y herramientas, y búsqueda de la regla de
reduced-motion correcta. B20 ahora acota su diff al cierre real de B20. Cada prueba conserva la misma
invariante histórica; no se eliminó, relajó ni omitió ninguna.

## Deferred normativo

- **B9.2:** drag-and-drop queda pendiente; no se implementó.
- **B9.3:** queda pendiente el rediseño final de «Probar otro orden»; B27 sólo preserva acceso local a
  la capacidad evidence-complete existente, sin «mejor», ranking ni aplicación automática.
- **B9.4:** «Dónde dormir» queda pendiente.
- **B9.5:** Reservas/Resumen quedan pendientes.

No se tocó dataset, metadata fotográfica, Astra, Vercel ni esquema/storage key.

**Siguiente bloque canónico: B28 / B9.2 — Reordenar.** Debe añadir drag-and-drop/puntero sobre la estructura de días ya integrada sin eliminar ni degradar la ruta accesible por teclado («Mover a…» y movimiento de día completo). B9.3/B9.4/B9.5 siguen pendientes.

## Addendum P-06 v2 (contrato modificado)

[P06_V2_ARCHITECTURE.md](P06_V2_ARCHITECTURE.md) rediseña Días sin tocar el modelo ni la persistencia. Lo que B27 certificaba y cambia:
las fechas se editan en la Sheet «Fechas del viaje» (`#sequence-start-date`/`#sequence-end-date` siguen siendo los mismos controles, ahora dentro de la hoja); «Eliminar Día N» y «Mover día»
viven en la Sheet «Acciones del Día N» («Mover antes/después», sin «Posición N»); las acciones de parada («Mover al Día N», «Mover a Sin asignar») viven en una Sheet y **mover entre días añade al final**;
«Sin asignar» es una sección visible (no `<details>`); «Detalles del día» y «Herramientas del viaje» abren una vista enfocada (N3, con historial desde P-06·C). La invariante: ninguna acción secundaria de N1 expande inline.
Gate: `b27-viaje-dias-check.mjs` actualizado en sus entradas; nuevo `p06-v2-list-invariant-check.mjs`.
