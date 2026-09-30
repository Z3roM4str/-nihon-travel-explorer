# B27 — B9.1 «Días como estructura» — handoff

Misión: `docs/BLOCK_27_MISSION.md`. Contratos: `docs/design/05 §7`, `04 §14`, `02 §D5`, `10 §B9.1`, DD-015.

| Campo | Valor |
|---|---|
| Rama | `claude/b27-viaje-b9-1-dias` |
| Base | `origin/main` @ `eab63a8af34c8e0474340eba4687766be979933b` (verificado con `git fetch origin`) |
| `main` | no modificado |
| Astra / PR #154 / Vercel | no mezclados |

## ⚠ Corrección de scope que NO debe volver a propagarse

`docs/BLOCK_26_HANDOFF.md` afirma que B9.1 retira `Dato:` (DDR-05, «`◧ Registrado`»). **Es incorrecto.**
`10 §B9.5` («se elimina `Dato:`») y DDR-05 asignan esa retirada a **B9.5**. B27 **conserva** las cuatro
apariciones de `Dato:` (`recorded-interval-fit`, `reservation-deadline`, `reservation-prep`, `hours-planning`);
un test (`block20-place-detail.test.ts`, «las cuatro apariciones») y el gate B27 (`K04`, `K05`) lo vigilan
con `=== 4`. Tampoco se reescribe Reservas ni se anticipa nada de B9.5.

## Arquitectura anterior de Viaje (auditada antes de tocar)

- `App.tsx`: sub-navegación `Planificar · Dónde dormir` (`viajeSection: "planificar" | "dormir"`).
- «Planificar» montaba `OrderedSequenceBuilder embedded` (3.606 líneas) con tres vistas internas:
  `builder` (recorrido **plano**: `ReorderableList` con `↑ ↓ ×`, totales de ruta, resumen de reservas,
  horas, traslados entre ciudades, zona, «Comparar otro orden», **«Distribuir por días»**, composición,
  «Restablecer recorrido», «Guardados fuera del recorrido»), `compare` (Orden A/B) y `days`
  (reparto por días: fechas, cuatro cajas de descargo, calendario oficial, alojamientos, `day-card`).
  Se llegaba a días sólo pulsando «Distribuir por días».
- Fuentes de datos de las tarjetas de día (todas ya existían y no cambian): `usePlanningDraft` →
  `routeIds` (ruta), `planningDays` (entidades con id estable + límite de alojamiento), `days` (proyección
  ordinal `string[][]`), `startDate`/`endDate`, `visitStartTimes`, `accommodations`, `accommodationLegs`,
  `interHubSegments`, `zoneAccommodationChoices`; derivados: `buildDayAssignment`, `buildZoneDayLinks`,
  `assessInterHubSegment`/`deriveEligibleInterHubPairs`, `summarizeSelection`, `assessTripBounds`.
- Controles `↑ ↓ ×` (auditoría D10):

| Control | Dónde estaba | Capacidad | Sustituto en B27 |
|---|---|---|---|
| `↑` `↓` (por parada) | recorrido plano y días | reordenar dentro del recorrido/día | «Mover a…» (día + posición) en la hoja de acciones |
| `←` `→` (por parada, sólo días) | días | pasar la parada al día anterior/siguiente | «Mover a…» con otro día |
| `×` «Quitar del recorrido» | sólo recorrido plano | sacar el lugar de la ruta (sigue en Quiero ir) | «Quitar del recorrido» en la hoja de acciones (confirmado en palabras) |
| `↑` `↓` `×` **de día** | cabecera de día | mover/eliminar el día entero | se conservan (no son el trío de fila) |
| `↑` `↓` en Orden A/B | vista comparar | reordenar candidatos | intactos (B9.3 los rediseñará) |

## Arquitectura nueva

`Viaje` = sub-navegación `Días · Dónde dormir · Reservas · Resumen` (`viajeSection:
"dias" | "dormir" | "reservas" | "resumen"`); **Días** es la de apertura y la de `goToPlanner`.
`OrderedSequenceBuilder` recibe `section`, `onSelectPlace` y `onOpenZones`; **una sola instancia** montada
a la vez (invariante «un escritor del borrador»). Reservas y Resumen re-alojan **sin rediseño** las
secciones existentes (`OfficialReservationCalendarSection` + `ReservationPreparationSection` +
`HoursPlanningSection`; `WholeTripCompositionSection`); B9.5 las rediseña.

Componentes nuevos (presentación pura, sin estado de planificación):

| Fichero | Función |
|---|---|
| `components/DayTimeline.tsx` | `<section>` + `<h3>` + `<ol>` (raíl) + slots de detalle/pie |
| `components/TripStop.tsx` | miniatura 56×56 (`-400w`), nombre, duración, `◇`, acción única |
| `components/UnassignedDrawer.tsx` | «N sitios sin día»: asa (`button aria-expanded`) o columna en `lg` |
| `components/StopActionsSheet.tsx` | «Mover a…» + «Quitar del recorrido» (usa `Sheet`) |
| `lib/day-timeline-presentation.ts` | titulares, ciudad, «Dormís en…», rango, contador |
| `data/place-thumbnails.ts` | `thumbImageUrl` (`-400w`, ya generado y validado por el pipeline). Módulo propio: `data/place-images.ts` es un fichero de catálogo guardado (el gate de integración B24+B23 exige que sea idéntico a B24 final) y B27 no lo toca |

Lógica y sub-secciones por día siguen **dentro** de `OrderedSequenceBuilder.tsx` (los ~190 tests de
fuente por texto los recorren): sólo se extrajo presentación. Nada de cálculo se movió.

### Qué se ve en Días

Cabecera «Viaje» + rango (`22 feb – 5 mar`) o «Poner fecha de inicio» (panel con los mismos dos
`<input type="date">`, `Quitar fecha` y la nota de fecha); **una** línea de encuadre con `✎`; por día:
«Día 3 · mié 24 feb · Kioto» (varias ciudades: «Tokio y Kioto», nunca una inventada; día vacío: sin
ciudad), «2 h 20 min–4 h 40 min de visitas · 3 paradas», `TripStop`, conectores («Traslado sin datos»,
`--ink-500`, sin `?`), pie «Dormís en …»/«Sin alojamiento elegido» + enlace «Dónde dormir», y un
`<details>` «Horarios, reservas y herramientas del Día N» con todo lo que antes era por día
(avisos de cierre semanal/horario, hora de inicio, plazos y fechas oficiales de reserva, totales,
alternativas verificadas, alojamiento y traslados del día). Entre días de ciudades distintas: fila
`InterHubSegment` (`Tokio → Kioto · Shinkansen · 140 min ◧` o «Traslado entre ciudades sin datos» +
«Registrar/Editar traslado», que abre el formulario existente en «Alojamientos y traslados entre
ciudades»). Al final: «Añadir día», «Probar otro orden», esa sección y «Restablecer recorrido».

`Dormís en …` = límite de fin del día si eligió un alojamiento (nombre de la zona si es el ancla de la
zona elegida, si no su etiqueta); si el fin no está seleccionado y el hub del día tiene zona elegida,
esa zona; en cualquier otro caso «Sin alojamiento elegido». No se infiere de días vecinos.

### `Mover a…` — infraestructura mínima adelantada por conservación de capacidad

**Infraestructura mínima adelantada por conservación de capacidad; B9.2 sigue siendo responsable del
sistema completo de reordenación y drag-and-drop.** Sin `↑ ↓` no habría forma accesible de cambiar la
posición o el día de una parada (Constitución + matriz de conservación). La hoja reutiliza
`relocatePlaceWithinDay` / `movePlaceBetweenDays` (mutaciones existentes, por id estable). Sin drag, sin
`aria-grabbed`, sin animación de reordenación. Anuncia el resultado (`role="status"`) y devuelve el foco
a la acción de la parada movida.

### Limitación heredada del modelo V8 (documentada, no resuelta aquí)

`days` es una partición de `routeIds`: **añadir o quitar un lugar de la ruta invalida el reparto** y la app
lo rehace en un solo día (comportamiento anterior; antes sólo se veía en el recorrido plano). Por eso
«Añadir al recorrido» (Sin asignar) y «Quitar del recorrido» piden confirmación **cuando hay algo que
perder** (más de un día o un alojamiento por día elegido) y lo dicen con esas palabras; parten del orden
que el lector ve, no del de `routeIds`. «Añadir al día…» / «Quitar del día» sin rehacer el reparto
necesitaría una mutación nueva (`withPlaceAddedToDay`…) sobre V8 sin cambiar esquema: **propuesta para B9.2**.

## Miniaturas y rendimiento

`-400w` (`06 §7`: «paradas del planner»): 244 ficheros ya generados y validados
(`photography-derivatives.test.ts` comprueba que existen para todo el registro). `loading="lazy"`,
`decoding="async"`, `width/height` fijos (sin salto de layout), 56×56 CSS-px. Un lugar sin foto o con
error de carga muestra el icono de categoría (igual que `PlaceCard compact`); nunca imagen rota. No se
añade ninguna URL externa. No se toca el presupuesto por hub (DDR-MERGE-1).

## Clasificación de gates con selector del marcado anterior

| Clase | Gate / test | Qué se hizo |
|---|---|---|
| A contrato vigente, selector actualizado | `OrderedSequenceBuilder.{inter-hub,whole-trip,official-reservation-calendar,stable-day-identity,trip-bounds,local-swap,local-relocation}.test.ts`, `ZonePlanSection.test.ts`, `TravellerLayer.test.ts`, `bundle-architecture.test.ts`, `block18-shell.test.ts` | el contrato se mantiene (una instancia de cada sección, mutaciones por id estable, un solo escritor…); se cambia dónde/cómo se localiza. Cada cambio comentado en el test |
| A | `phase3e-{e,g,i,k}`, `phase3f-{f,h,j,s}` (browser audits del planificador) | entran por `enterDaysView` (Viaje › Días) en vez de «Quiero ir → Construir recorrido → Distribuir por días»; borrador V7 sembrado se migra a V8 (assert `version, 8`) |
| B navegación obsoleta desde B18 | los mismos audits: `getByRole("button",{name:/Quiero ir/})` + overlay de onboarding | corregido en el helper compartido `scripts/lib/shell-navigation.mjs` |
| C responsabilidad de otro subbloque | `Dato:` (B9.5), comparación A/B (B9.3), ordinales de zona (B9.4) | no se tocan; el test de `Dato:` se endurece a `=== 4` |
| D deuda histórica previa | `block1-ux`, `block13`, `block14`, `b18-regression`, `b24-real-input` P0-2 | ya obsoletos en el baseline; sin cambios |

## Gates

Gate nuevo permanente: `app/scripts/b27-viaje-dias-check.mjs`. Resultados y regresión: ver la sección
«Cierre» al final de este documento.

## Deuda / siguiente

- B9.2: arrastrar y soltar + sistema completo de reordenación; «Añadir al día…» sin rehacer el reparto.
- B9.3: «Probar otro orden» local al día (hoy sigue siendo la comparación A/B de toda la ruta, alcanzable
  desde «Probar otro orden», sembrada con el orden que se ve en Días).
- B9.4: Dónde dormir (`ZoneComparison` intacta; sus ordinales siguen).
- B9.5: Reservas/Resumen propios, **retirada de `Dato:`**, línea de tiempo comprimida.
- La sección «Alojamientos y traslados entre ciudades» (formularios existentes) vive al final de Días
  hasta que B9.4 decida su sitio definitivo.
- Pendiente humano heredado: iPhone Safari real (sin cambios).

## Cierre — resultados (medidos sobre la build final de la rama)

Baseline (árbol `eab63a8`, worktree aparte) → rama:

| Comprobación | Baseline | Rama |
|---|---|---|
| `git diff --check` | limpio | limpio |
| build | PASS | PASS |
| lint | 0 errores, 1 warning heredado (`PlaceMap.tsx:17`) | 0 errores, el mismo warning |
| Vitest | 107 ficheros, 3415/3415 | 108 ficheros, **3430/3430** (+2 miniaturas, +13 invariantes de modelo) |
| **B27 `b27-viaje-dias-check`** | — | **48/48** |
| Phase 5A | 50/50 desktop + 50/50 móvil | 50/50 + 50/50 |
| integración B24+B23 | 58/58 | 58/58 |
| B25 Quiero ir | 123/123 | 123/123 |
| B26 Nosotros (Chromium) | 314/314 | 314/314 (WebKit: no hay WebKit en este entorno → **no medido**) |
| DD-028 | 16/16 | pasa (16) |
| B18 back / viaje-lugar / chrome / a11y | 15 / 38 / 6 / 23 | 15/15 · 38/38 · 6/6 · 25/25 |
| B17 regresión / tap | 18/18 · 16/16 | 18/18 · **25/25** (ahora mide de verdad Días: antes se saltaba el planificador en silencio) |
| B5 · B6 | 231 · 177 | 231/231 · 177/177 |
| B23 photo retry · DDR-03 · ficha · grid · contraste | 28 · 43 · 73 · 52 · PASS | 28/28 · 43/43 · 73/73 · 52/52 · PASS |
| audits del planificador `phase3e-{e,g,i,k}` / `phase3f-{f,h,j,s}` | **8/8 fallaban** (navegación anterior a B18) | **8/8 pasan** (day assignment, identidad estable, calendario y fechas oficiales, alternativas evidence-complete, traslados) |

Gates que fallan igual en el baseline y en la rama (clase D, deuda histórica documentada, sin cambios):
`block1-ux`, `block3-zones`, `block4-zone-planner`, `block13`, `block14`, `b18-regression`
(navegación anterior a B18/B19: «^Kioto», `.hub-bar__zones`, `.selection-list__name`…). El
comportamiento que `block4-zone-planner` medía (zona → días) lo cubren `ZonePlanSection.test.ts`,
`b27` y `phase5a`/`integración`.

### Gate B27 — cobertura (`scripts/b27-viaje-dias-check.mjs`)

A (apertura en Días, sin «Distribuir por días», una sola línea de encuadre exacta con ✎, cabecera,
sin cajas de descargo) · D (titular, duración, nº de paradas, pies con/sin alojamiento, enlace a
Dónde dormir) · S (miniatura 400w real 56×56 lazy, fallback sin foto, conectores, «Traslado sin datos»
ni rojo ni `?`) · H (InterHub sin/con dato, mismo hub sin fila) · U (cajón, contador, teclado,
confirmación al rehacer el reparto) · M (añadir/eliminar día conservando ids, «Mover a…» dentro y entre
días, quitar del recorrido) · R (trío retirado, ninguna semántica de arrastre, acción accesible
«parada N de M») · K (comparación de órdenes, alternativas verificadas, Reservas, Resumen, fechas
oficiales, **`Dato:` presente**) · P (V8, mismos campos, refresco) · F (ficha dentro de Viaje, chevron
«Días», scroll conservado, browser back, instancia única) · L (320/360/390/430/768/840/1200/1440: sin
overflow, objetivos ≥44, «Añadir día» no tapado por la TabBar, columna «Sin asignar» en lg) · Y (foco y
anuncio tras mutaciones, Enter/Escape) · E (0/1 días, día largo, muchos sin asignar, sin fechas) · C
(sin errores de consola ni 4xx/5xx propios).

### Auditoría visual (Chromium real)

Capturas con `NIHON_B27_SHOTS`: 390×844, 768×1024, 1440×900 (Días arriba, día con paradas, dos ciudades,
Sin asignar abierto, día vacío, ficha desde `TripStop`); layouts 320/360/430/840/1200 medidos por el gate.
Hallazgos corregidos (todos atribuibles a B27): coma en «lun, 22 feb» (ahora «lun 22 feb», `05 §7`);
icono `+` para «acciones de parada» (confundía con añadir → icono nuevo `opciones`); `TripBoundsNotice`
de tres párrafos al abrir (sólo cuando hay fecha de fin o con el panel de fechas abierto); avisos de
horario/cierre que dominaban cada día (pasan al `<details>` del día, que se abre con un toque);
el cajón «Sin asignar» abierto no se veía (ahora se trae a la vista al abrirse). Pendiente (P2,
no bloqueante): el trazo punteado del conector es tenue frente al raíl sólido; B10 (polish) decide.
