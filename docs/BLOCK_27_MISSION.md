# Bloque 27 — B9.1 «Viaje · Días»

## Misión

Convertir el día persistido en la unidad primaria de Viaje sin cambiar cálculos, evidencia, preferencias
ni la clave `nihon.manualPlanningDraft`.

## Criterio de cierre

B9.1 se considera cerrado **sólo** con:

1. `npm test -- --run` al 100 %; y
2. `app/scripts/b27-viaje-dias-check.mjs` A–K ejecutado con Chromium real y verde, incluida revisión
   visual de 320, 390, 430, 820 y 1440 px.

La implementación y Vitest están completos (3395/3395). En el entorno del 29-09-2026 el gate de
navegador queda **BLOCKED**, no certificado: no hay Chromium preinstalado y las dos vías de instalación
fallan por HTTP 403 del proxy. Véase `docs/BLOCK_27_HANDOFF.md`.

## Alcance implementado

Días estables; calendario civil; TripStop completo; movimiento explícito entre día/posición y dentro del
mismo día; movimiento de día completo; ciclo día → Sin asignar → día sin tocar Quiero ir; acciones de
día; alternativas locales opcionales; fila inter-hub derivada entre tarjetas; PlaceDetail dentro de
Viaje; persistencia única y gate conductual A–K.

## Fuera de alcance

B9.2 añadirá drag-and-drop. B9.3 rediseñará la comparación local. B9.4 rediseñará Dónde dormir. B9.5
implementará Reservas y Resumen. Ninguno se adelantó y B28 no se inició.
