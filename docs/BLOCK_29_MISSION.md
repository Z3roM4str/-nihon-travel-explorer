# Bloque 29 — B9.3 «Herramientas del día · Probar otro orden»

## Misión

Convertir «Probar otro orden» en una herramienta efímera asociada a un día. La hoja compara el orden persistido con una propuesta editable mediante `compareSequences` y ofrece las alternativas `evidence-complete-*` como opciones comprobadas. Ninguna alternativa se aplica sola.

La única acción que modifica el día es «Usar este orden». El commit valida otra vez el `dayId`, el orden base exacto y la permutación completa; si el día cambió, no escribe.

## Criterios de aceptación

- La herramienta se abre desde el día exacto e identifica «Día N», fecha y hub cuando existen.
- Al abrir, `baselineDayPlaceIds` y `proposalIds` son copias efímeras del orden persistido.
- La propuesta se reorganiza por teclado con «Mover a…» y posiciones; el viaje permanece intacto durante la edición.
- Orden actual y Propuesta muestran secuencias, traslados registrados, cobertura/desconocidos y mezcla de evidencia.
- La comparación es local al día, conserva las reglas conservadoras de `sequence-comparison.ts` y no presenta A/B ni un score.
- Cada alternativa mantiene la etiqueta exacta «Comprobado con datos completos» y sólo carga la propuesta.
- Cancelar/Escape descartan la propuesta y restauran el foco al disparador del mismo día.
- «Usar este orden» aplica una permutación válida con una única actualización funcional del draft; el estado stale falla cerrado.
- Se conservan identidad y orden de días, ruta, fechas, límites de alojamiento, alojamientos, tramos, horarios, Sin asignar y Quiero ir.
- La hoja no crea storage key, schema o estado persistido nuevo; la edición no escribe `nihon.manualPlanningDraft`.
- No se rompe drag de B28, «Mover a…», «Mover día…», reduced motion, regiones vivas ni browser back.

## Límites

B29 no implementa B9.4 «Dónde dormir», B9.5 «Reservas/Resumen», B30 ni el cleanup B10. No cambia algoritmos evidence-complete, cálculos de transporte, dataset, fotografía, Astra o Vercel. No despliega ni hace merge.

El gate principal es `app/scripts/b29-day-order-tools-check.mjs`. Certifica la hoja y llama también al gate B28 de drag. La matriz de regresión y sus resultados finales están en [BLOCK_29_HANDOFF.md](./BLOCK_29_HANDOFF.md).
