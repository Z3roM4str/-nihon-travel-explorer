# P-06 — Viaje › Días con revelación progresiva

> **Estado (2026-10-03): la interacción de este documento queda SUSTITUIDA** por [P06_LISTA_HOJAS_Y_VISTAS.md](P06_LISTA_HOJAS_Y_VISTAS.md) (DDR-P06-1, DD-029…DD-035). Se conservan aquí el inventario previo (§1), la corrección incidental (§4) y los resultados históricos de #193 (§5). La revelación progresiva *inline* descrita en §2–§3 (`⋯` desplegable, «Detalles del día», «Herramientas y datos del viaje» plegable, frase de ayuda y frase normativa al pie) **ya no es contrato**: es el estado transitorio de `main` hasta P-06·D.

Hallazgo de QA físico: Viaje › Días se percibía como «demasiada información, demasiado texto, demasiados
apartados; difícil de entender sin instrucciones». No era un fallo de lógica sino de jerarquía y carga
cognitiva. Esta misión reorganiza **sólo la presentación**; no cambia el modelo planning-draft, la
persistencia V8, los algoritmos, la semántica de fechas, los movimientos entre días, el arrastre, el
alojamiento, las reservas, las herramientas de orden, el dataset ni otras pestañas.

Base: `main` @ `78786327122a566fb04c751ffc28da1ded416976`. Rama: `claude/p06-days-progressive-disclosure`.

Principio: la vista inicial contesta sólo «¿qué hacemos cada día?». Lo secundario aparece al pedirlo.

## 1. Inventario previo (main) y clasificación

Medido con `app/scripts/p06-days-capture.mjs` (viaje de 2 días: 3 lugares en Tokio + 1 en Kioto, fechas
22 feb – 5 mar 2027). Altura desplazable de Días a 390×844: **5159 px antes → ≈1850 px después**. En la
primera pantalla móvil de `main` no se veía **ningún lugar**; ahora se ven el Día 1 y sus primeras paradas.

| # | Bloque visible en `main` | Clase | Destino en P-06 |
|---|---|---|---|
| 1 | Cabecera «Viaje» + fechas/subtítulo + cerrar | esencial | sin cambios |
| 2 | Frase normativa «Vosotros decidís el orden…» (arriba, tamaño cuerpo) | secundario | se conserva, discreta y al final de la lista |
| 3 | Fecha de inicio (etiqueta en línea) | esencial | fila compacta de dos campos |
| 4 | Fecha de fin «(último día del viaje)» | esencial | misma fila; la aclaración queda en el nombre accesible |
| 5 | «Herramientas y datos del viaje» (límites, traslados entre ciudades, zonas, alojamientos) | avanzado | sigue plegado, movido al final |
| 6 | Cabecera del día «Día N · fecha · ciudad» + «duración · N paradas» | esencial | «Día N · fecha» + resumen corto «ciudad · N lugares · duración» |
| 7 | Botón ✕ «Eliminar Día N» (deshabilitado si hay lugares) | secundario | sólo aparece cuando el día está vacío y hay más de uno |
| 8 | Botón grande «Probar otro orden» | secundario | enlace discreto al pie de la tarjeta |
| 9 | Selector «Mover día…» | avanzado | en «Detalles del día» |
| 10 | Selector «Añadir lugar» (desde Sin asignar) | secundario | en «Detalles del día» (y el cajón Sin asignar sigue ofreciendo «Añadir al día…») |
| 11 | Parada: nº, miniatura, nombre, zona · duración | esencial | sin cambios (miniatura más compacta) |
| 12 | Parada: asa de arrastre | esencial | visible, sin caja |
| 13 | Parada: botón «Mover a…» + enlace «Mover a Sin asignar» siempre visibles | secundario | un único «⋯» (nombre accesible «Mover a…») que despliega Día, Posición, «Mover parada» y «Mover a Sin asignar» |
| 14 | Conector entre paradas con traslado conocido | secundario | se mantiene en línea (una línea corta) |
| 15 | Conector «Sin traslado registrado» | avanzado | lista completa de traslados en «Detalles del día» |
| 16 | Señal de cierre semanal (resumen + lista + descargo) | avanzado | en «Detalles del día»; si hay coincidencias, una línea de aviso en la tarjeta |
| 17 | Horario/cierres registrados por lugar | avanzado | en «Detalles del día» |
| 18 | Hora de inicio manual vs. intervalo registrado | avanzado | en «Detalles del día» |
| 19 | Totales (visita, traslados conocidos, sin registrar, compromisos) | avanzado | en «Detalles del día» (la duración de visita sigue en el resumen corto) |
| 20 | «Alojamiento en este día»: inicio/fin, minutos manuales y texto normativo | avanzado | en «Detalles del día» |
| 21 | Pie «Dormís en X» / «Sin alojamiento elegido» | esencial | se mantiene + enlace «Dónde dormir» a la pestaña |
| 22 | Fila de traslado entre días | secundario | sin cambios (sólo aparece si hay traslado activo) |
| 23 | «＋ Añadir día» | esencial | sin cambios |
| 24 | Cajón «N sitios sin día» (fijo abajo) | esencial | «Sin asignar · N sitios»; deja de flotar cuando está vacío |

Reservas: Días no muestra ventanas ni fechas de reserva (viven en la pestaña Reservas desde B31); no hubo
nada que plegar ahí.

## 2. Qué queda visible

Fechas del viaje (una fila), una sola frase de ayuda («Organiza tus lugares por día: arrástralos con ⠿ o
usa ⋯ para moverlos.»), tarjetas Día N · fecha con su resumen corto, sus lugares (miniatura, nombre, zona,
duración, asa y ⋯), «Dormís en…/Sin alojamiento elegido» con acceso a Dónde dormir, «＋ Añadir día» y el
cajón Sin asignar.

## 3. Qué pasa a revelación progresiva

- **⋯ de cada parada** (`aria-expanded`): mover a otro día y posición, y mover a Sin asignar. Es la
  alternativa completa al arrastre, operable con teclado.
- **Detalles del día** (`<details>`, cerrado por defecto): mover el día, añadir lugar desde Sin asignar,
  todos los traslados (incluidas las ausencias), señales de cierre semanal y de horarios/cierres, hora de
  inicio frente al intervalo registrado, totales y alojamiento por tramo.
- **Probar otro orden**: enlace secundario en el pie de la tarjeta; el panel, su foco y Escape no cambian.
- **Herramientas y datos del viaje**: igual que antes, plegado, ahora al final.

No se eliminó ninguna capacidad ni ninguna frase normativa/evidencial; sólo cambió dónde se ven.

## 4. Corrección incidental

`.photo-placeholder` es `position: absolute; inset: 0`, pero `.trip-stop__media` no establecía un bloque
contenedor: el marcador de «Fotografía pendiente» cubría toda la parada e interceptaba los clics. Ahora la
miniatura es `position: relative`.

## 5. Gates

Gates de navegador ajustados sólo en su **entrada** (abrir ⋯ o «Detalles del día» antes de usar un control
que ahora está plegado; nuevo texto del cajón). Ninguna aserción se relajó; B27 añade dos comprobaciones:
las acciones de parada y «Detalles del día» empiezan plegadas.

- `b27-viaje-dias-check.mjs`, `b28-reorder-dnd-check.mjs`, `b29-day-order-tools-check.mjs`,
  `phase5a-rc-browser-audit.mjs` (A13 abre «Detalles del día» antes de escribir la hora manual).
- Test de fuente `OrderedSequenceBuilder.trip-bounds.test.ts`: la etiqueta visible es «Fecha de fin» y la
  aclaración «(último día del viaje)» sigue en el nombre accesible.

Resultados en la build final (Chromium 141, `/opt/pw-browsers/chromium`):

| Comprobación | Resultado |
|---|---|
| `tsc -b` · build | PASS |
| oxlint | 0 errores (warning heredado `PlaceMap.tsx:18`) |
| Vitest | 118 archivos · 3424/3424 |
| B27 Viaje · Días | PASS (A–K, 8 viewports) |
| B28 reordenación/arrastre | 64/64 (ratón + táctil, 8 viewports) |
| B29 Probar otro orden | 163/163 (8 viewports) |
| B30 Dónde dormir | 475/475 |
| B31 Reservas / Resumen | 281/281 |
| D0b higiene del sistema de diseño | 56/56 |
| B10 a11y · microcopy · motion | 89/89 · 52/52 · 17/17 |
| D5 vocabulario normativo · evidence-options | PASS · PASS |
| P-04 alcance del mapa nacional (shell intacto) | 55/55 |
| Phase 5A RC | 50/50 |

**WebKit no se ejecutó**: no está instalado en este entorno (`/opt/pw-browsers` sólo trae Chromium) y la
política del entorno impide `playwright install`. B30/B31/B10/D0b/D5/P-04 admiten `NIHON_BROWSER=webkit`
y deben repetirse en un entorno con WebKit; B27–B29 sólo están escritos para Chromium.
