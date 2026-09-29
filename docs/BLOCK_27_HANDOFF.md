# Handoff — Bloque 27

## Resultado

Viaje abre sobre **Días**. El modelo y la persistencia no migraron: los días siguen identificados por su `id` opaco y las fechas se derivan de `startDate` por ordinal. Cada `TripStop` consume la derivada fotográfica de tarjeta y abre el `PlaceDetail` compartido en el stack de Viaje.

El menú **Mover a…** elige día y posición mediante controles nativos enfocados por teclado. Los movimientos intra/interdía pasan por las mutaciones existentes. La restauración desde «sin día» se realiza como una única actualización del mismo draft para no exponer una partición inválida.

## Compatibilidad

Los conectores siguen recibiendo `OrderedSequenceLeg`; la ausencia conserva «Sin traslado registrado». Comparaciones evidence-complete, inter-hub, reservas, horas, alojamiento y composición completa siguen accesibles bajo un disclosure secundario, sin recalcular ni aplicar alternativas automáticamente.

## Deferred

- **B9.2:** drag-and-drop y reordenación visual de días.
- **B9.3:** nueva comparación local y herramientas del día.
- **B9.4:** nueva superficie Dónde dormir.
- **B9.5:** Reservas y Resumen funcionales.

No se creó DDR: no hubo cambio de esquema, clave, dataset ni semántica de cálculo.
