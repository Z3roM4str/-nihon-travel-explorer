# B31 / B9.5 — Reservas y Resumen

## Identidad y autorización

Base canónica exacta: `main @ 393ef2b2a1a2db0641d3785b7e7cf155c914fa5c`, verificada por fetch antes de crear la rama nueva `codex/block-31-b9-5-reservas-resumen`. B30 permanece cerrado. #168 abierto, Draft e intacto en `1444e67805c60cf9a33f4be5c1a3808b900e505b`.

Fuentes releídas antes de modificar código: Constitución; sistema §10 y EvidenceMark; pantallas §7/§9/§10; guardrails; decisiones DD-001/002/006/011/015 y DDR-05; roadmap B9.5; certificación final B30 y handoff vigente. Las dos superficies y su copy canónico están autorizados por §9/§10 y por la misión. No se descubre una contradicción entre documentos canónicos. Los contratos históricos de los agregadores se mantienen: la lista de presentación B31 ordena resultados existentes sin cambiar los agregadores ni tratar una apertura de venta como cierre de solicitudes.

## Auditoría previa y matriz firmada de conservación

| Capacidad actual | Origen real | Destino B31 / conservación |
|---|---|---|
| Necesidad y mecanismo editorial, Reservas por preparar | `reservation.ts`, `reservation-lead-time.ts`, `reservation-planning.ts`; sección del planner plano | Reservas: listado completo, orden de lectura por fecha derivada; literal íntegro y EvidenceMark Registrado |
| Ventana editorial y relación con referencia del dispositivo | `reservation-deadline.ts`, `reservation-window-reference*`; `ReservationDeadlineNotice` en tarjetas diarias | Reservas: cada lugar mantiene ventana, fechas y relación; no se convierte en plazo oficial |
| Mecanismos oficiales y resultados no derivables/no aplicables | `reservation-mechanism-evidence`, `*-date-derivation`, `*-presentation`, `*-reference-date*`; `OfficialReservationDateNotice` | Reservas: detalles por lugar, ámbito, asignación, residencia, procedencia y enlace; incluidos resultados sin fecha |
| Calendario oficial con fecha/apertura y span completo | `reservation-mechanism-calendar*`; `OfficialReservationCalendarSection` en Días | Reservas: mismo agregador y detalles, orden cronológico oficial conservado |
| Estado de la ventana febrero–marzo 2027 | `feb-mar-status.ts`, campos `febMar2027` del lugar | Reservas: estado y literales íntegros de advertencia/acción; ninguna fuente se borra |
| Composición completa | `buildWholeTripComposition` sobre routeIds/planningDays/interHubSegments/accommodationLegs/bounds | Resumen: cuatro tarjetas con los mismos subtotales y estados de ausencia/parcialidad, enlaces a Días/Dónde dormir |
| Fechas y límites | `trip-bounds`, `civil-date`, calendario actual | Resumen: lectura del rango existente; edición sigue en Días |
| Reparto real entre ciudades | `planningDays` con IDs estables y resolución existente de lugares, fechas del calendario | Resumen: banda horizontal por día, nombres y fecha cuando existe, día vacío explícito; sin duración/ciudad/alojamiento inventados |
| Horarios literales | `recorded-interval-fit` y `hours-planning` en Días/herramientas | Se conservan en su superficie, sustituyendo sólo el patrón Dato por EvidenceMark + comillas |
| Apertura de PlaceDetail | stack compartido de Viaje en App | Reservas/Resumen abren el mismo stack con etiqueta exacta y retorno a la superficie montada |
| Edición de viaje y alternativas | planner, B27/B28/B29 | Días: sin cambios de cálculos, orden, identidad, drag ni modelo V8 |

**Firmada por Codex antes de implementar.** Ninguna capacidad se elimina; ninguna función de dominio se reimplementa.

## Inventario exacto de Dato renderizable en la base

Sólo cuatro hits en `app/src` excluyendo tests, todos en `OrderedSequenceBuilder.tsx`:

1. Línea 856: `hours.raw` en ajuste de duración a intervalo registrado.
2. Línea 967: `window.signal.raw` en anticipación editorial derivada.
3. Línea 1298: `item.leadTime.raw` en preparación de reservas.
4. Línea 1350: `item.hours.raw` en horarios registrados.

Sustitución: componente `EvidenceMark level="registrado"` + literal íntegro entre «comillas». Se distinguirá interfaz de comentarios, fixtures y documentación histórica; no se persigue grep cero artificial.

## Implementación y certificación previstas

Una instancia del planner comparte el estado entre Días/Reservas/Resumen. La navegación local no persiste nuevos datos. Las proyecciones B31 reciben datos del mismo runtime V8 y de los agregadores existentes. No se añade un hook de persistencia por superficie. Dónde dormir conserva su estado local y el stack vigente B30. Las dos vistas ya visitadas permanecen montadas y sólo una está visible. Al cruzar entre sus lectores después de una edición persistida real, se invalida el lector receptor con una revisión de montaje; consultar sin editar no invalida ni escribe V8.

Lista de reservas: fecha de cierre de solicitud oficial si existe, apertura oficial si sólo existe ese hito, y anticipación editorial cuando no hay hito oficial; cada fecha se etiqueta con su significado. Las fechas desconocidas quedan al final sin prioridad inventada. Los empates usan identidad/nombre, nunca orden de ruta. El calendario oficial sigue mostrando sus spans y orden original, por separado de ventanas editoriales.

Tests B31 de valores reales, orden de lectura, ausencia honesta, evidencia, literales y conservación. Gate browser Chromium/WebKit: navegación, stack, cero escritura al consultar tras finalizar el montaje existente, snapshots de orden/días/alojamiento, teclado, foco, 44 px, reduced motion y 320x568/390x844/escritorio. Regresión mínima: build, lint, Vitest completo, 231 invariantes, B30 ambos motores, B29/B28/B27/B26/B18 y diff check. Fallos y repeticiones quedan registrados sin modificar bloques ajenos para conseguir verde.

Sin datasets, fotografía/adquisición B6, Astra, Vercel/deploy, #168 ni ramas claude/*. Publicación sólo en la rama nueva, PR contra main Ready for Review, sin merge/squash/rebase/force-push.
