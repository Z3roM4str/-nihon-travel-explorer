# Handoff — Bloque 27 / B9.1 «Viaje · Días»

## Estado de cierre

**Regresión de dominio corregida; certificación Chromium bloqueada en este contenedor.** B9.1 sólo se
puede declarar **cerrado** cuando coincidan las dos condiciones: suite completa 100 % verde y ejecución
real verde de `app/scripts/b27-viaje-dias-check.mjs`. La primera está cumplida (106 ficheros,
3406/3406, incluidos 11 casos puros nuevos de la mutación); la segunda no se falsea ni se sustituye por un análisis estático.

Evidencia del bloqueo: no existe ejecutable en `/opt/pw-browsers/chromium` ni en las rutas habituales;
`npx playwright install chromium` recibió HTTP 403 del proxy en cinco intentos y `apt-get install -y
chromium` terminó `Unable to locate package chromium` tras los repositorios devolver HTTP 403. Por ello
no hay capturas ni auditoría visual manual certificable en este entorno.

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
  storage keys, InterHub activo/inactivo, targets, overflow, consola y ocho viewports. La búsqueda de
  navegador sólo admite ficheros ejecutables e incluye todas las rutas `/opt/pw-browsers` conocidas.

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

No se tocó dataset, metadata fotográfica, Astra, Vercel ni esquema/storage key. No se inició B28.
