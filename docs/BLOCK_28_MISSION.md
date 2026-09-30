# Bloque 28 — B9.2 «Viaje · Reordenar»

Base canónica: `main` @ `47a6f0e1549f273622a112820ace5279455cbd9e`. Rama única: `codex/block-28-b9-2-reorder`.

## Contrato

Añadir arrastre de paradas con mouse, puntero y touch sobre la estructura de días de B27. Cada drop identifica la parada por `placeId` y los días por sus `dayId` estables; la posición se deriva al soltar. El draft cambia una sola vez en un drop válido. «Mover a…», «Mover día…», PlaceDetail, browser back y Sin asignar siguen disponibles por teclado.

El asa es el único elemento que inicia el drag. El destino acepta inicio, huecos intermedios, final y día vacío. La cancelación por Escape, `pointercancel`, pérdida de captura, salida del área, destino inválido, cambio de estado o desmontaje no modifica el draft. El auto-scroll se limita al contenedor desplazable y se detiene al salir del borde o terminar el gesto.

El movimiento entre días conserva el set de `routeIds`, los IDs de día, límites civiles, tiempos, anchors, tramos manuales, segmentos inter-hub y elecciones de zona. Si el origen queda vacío, sólo su boundary pasa a `unselected`. Sin asignar → día añade a `routeIds` y al destino sin restaurar datos podados. Día → Sin asignar permanece mediante el control B27; B28 no añade drop en esa dirección.

No se implementan drag de días completos, B9.3, B9.4, B9.5 ni B29. Tampoco se cambia transporte, alternativas, dataset, fotografía, Astra o Vercel.

## Gate

`app/scripts/b28-reorder-dnd-check.mjs` usa Playwright con Pointer Events reales por mouse y `Input.dispatchTouchEvent` en contexto touch de Chromium. Comprueba orden y persistencia, cancelación, teclado, foco, wishlist y ocho viewports. Las pruebas puras de V8 comprueban atomicidad, boundaries y no-op ante identidades o posiciones inválidas.
