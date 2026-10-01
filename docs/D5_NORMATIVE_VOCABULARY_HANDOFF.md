# D5 — Vocabulario normativo · handoff

**Línea Claude.** Base `4d2163165f791b2ba3b1db8c7cbb968e1c607314` (verificada con `git fetch`: la rama remota `claude/d0b-design-system-hygiene`
seguía exactamente ahí). Rama `claude/d5-normative-vocabulary`. Sólo presentación/copy.

## 1. Inventario (término | apariciones UI | internas | excepciones | DDR)

Clasificación sobre `app/src` (+ `data/`). «Internas» = identificadores, tipos, comentarios, nombres de fichero/CSS, tests; no llegan a pantalla.

| Término | Apariciones UI (A, cambiadas) | Internas (C) | Excepciones (B) | DDR (D) |
|---|---|---|---|---|
| tramo | `OrderedSequenceBuilder`: resumen k/n, «sin registrar», inter-hub (intro, vacío, aria+title «Eliminar…», «Duración manual…» ×2, «Añadir…», inactivo); `DayOrderSheet`: 5 cadenas | `knownLegCount`…, comentarios (p. ej. geometría en `PlaceCard`) | — | L1 (3 cadenas de `lib/reservation-mechanism-reference-date-presentation.ts`), L2 (`lib/…-calendar-presentation.ts`): *tramo* = intervalo de fechas |
| recorrido | `OrderedSequenceBuilder` (4), `StopActionsSheet` (3), `TripBackup`, `viajeResumenModel` (2), `TravellerManager` | `routeIds`, `resetRoute`, comentarios | — | L3 (`lib/divergence-presentation.ts`), R1 «Restablecer recorrido» |
| constructor | 1 (aria-label + title del botón de cerrar) | comentarios, clases | — | — |
| secuencia | 0 | `OrderedSequenceBuilder`, `sequence-comparison`, clases | — | — |
| orden A / orden B | 0 (ya era «orden actual / otro orden») | `candidateA/B`, comentarios | — | — |
| candidato | 0 | `candidateDayPlaceIds`, `candidateMix`, `SequenceCandidate` | — | — |
| Dato: | 0 | — | — | — |
| grado | 0 en chrome | `place.grade`, comentarios | E1: «Grado original» dentro de «Fuentes» plegado (`PlaceDetail`) | etiqueta «Grado X» de `lib/interest-level.ts` `unknownLevel` (latente: el catálogo sólo tiene S/A/B/C/D) |
| provenance / freshness | 0 | `provenanceText`, `freshnessFor`, clases CSS | — | — |
| analizar selección | 0 | — | — | — |
| cobertura | 0 | `source.Cobertura` (campo de `sources.json`) | — | — |
| contenido editorial de `data/` | 6 descripciones de lugares usan «recorrido», «secuencia», «tramos» como español corriente | — | Art. 4; `data/` protegido | — |

## 2. Sustituciones (antes | después | pantalla | norma | justificación)

| Antes | Después | Pantalla | Norma | Justificación |
|---|---|---|---|---|
| «Quitar del recorrido» (botón y menú de la hoja) | «Quitar del día» | Días › acciones de parada | 03 §10 recorrido→día | La acción saca la parada del día y pasa a «Sin asignar»; el aviso en vivo ya decía «quitado del día» |
| «Vas a quitar X del recorrido. Sigue guardado en Quiero ir.» | «… del día. Sigue guardado en Quiero ir.» | ídem | ídem | ídem |
| «k/n tramos cubiertos» (Viaje) | «k/n traslados registrados» | Viaje, resumen del plan | 03 §10 tramo→traslado | Mismo conteo; «cubierto» = con traslado registrado |
| «N tramos sin traslado registrado» | «N traslados sin registrar» | Viaje | ídem | Mismo número y relación |
| «en el recorrido actual» / «…del recorrido actual» / «…consecutivos en el recorrido actual» | «…el viaje actual» | Traslados entre ciudades (estado) | recorrido→viaje | Mismo ámbito |
| «…el tramo no se aplica.» | «…el traslado no se aplica.» | ídem | tramo→traslado | «reparto» se conserva (12 §11) |
| «Tramo principal entre estos dos puntos…» | «Traslado principal …» | ídem | tramo→traslado | El encabezado ya era «Traslados entre ciudades» |
| «ningún tramo entre ciudades» | «ningún traslado entre ciudades» | ídem | ídem | |
| aria-label y title «Eliminar tramo A a B» | «Eliminar traslado A a B» | ídem | ídem + Art. 7 en ARIA | Conserva origen y destino |
| «Duración manual del tramo principal» (×2) | «…del traslado principal» | ídem | ídem | |
| «Añadir tramo» | «Añadir traslado» | ídem | ídem | |
| «El reparto actual no coincide exactamente con el recorrido.» | «…con el viaje.» | Viaje | recorrido→viaje | |
| aria-label y title «Cerrar el constructor de recorrido» | «Cerrar {Viaje\|Reservas\|Resumen}» | planificador (diálogo) | Art. 7 constructor | Nombra la superficie que se cierra, igual que su `<h2>` |
| «Lugares en el recorrido» | «Lugares en el viaje» | Nosotros › copia del viaje | recorrido→viaje | Mismo número |
| «…no coincide exactamente con el recorrido…» / «Un lugar del recorrido no…» | «…con el viaje…» / «Un lugar del viaje…» | Resumen (no disponible) | ídem | |
| «El recorrido, los días, las fechas y el alojamiento son del viaje…» | «Los lugares planificados, los días, las fechas y el alojamiento son del viaje…» | Nosotros › Viajeros | ídem | *recorrido* = los lugares del plan; «el viaje» sería redundante en esa frase. Confianza media |
| «Sin tramos en este día» | «Sin traslados en este día» | «Probar otro orden» | tramo→traslado | |
| «k/n tramos cubiertos» | «k/n traslados registrados» | ídem | ídem | |
| «…al menos un tramo sin traslado registrado» (×3) | «…al menos un traslado sin registrar» | ídem | ídem | |

Tests y gates que fijaban el copy antiguo, actualizados: `OrderedSequenceBuilder.inter-hub.test.ts`, `b27`, `block4`, `block5`, `phase5a`.

## 3. No modificadas (cadena | motivo | excepción / DDR)

| Cadena | Motivo | Clase |
|---|---|---|
| «Grado original» (`PlaceDetail`, «Fuentes» plegado) | `03`: la letra de grado sólo en «Fuentes» plegado | **E1** (excepción normativa) |
| «La fecha de referencia del dispositivo … del tramo de fechas registrado para la solicitud» (3 cadenas) | Origen en `lib/` protegido (el texto sale de un `switch` sobre estados del dominio). Adaptarlo en presentación exige reinterpretar estados. Además *tramo* aquí es un **intervalo de fechas**, no un traslado: la equivalencia de `03 §10` sería **falsa** | **DDR L1 — copy visible originado en lib protegido**. Los gates `phase3f-h/j/s` siguen fijándolas |
| «Situado en esta lista por la fecha de inicio registrada del tramo.» | Constante de `lib/…-calendar-presentation.ts`; mismo caso de intervalo de fechas | **DDR L2** |
| «Ya está en un día del recorrido. Esto no lo cambia.» (Quiero ir) | `plannedNote` de `lib/divergence-presentation.ts`; sustitución probable «día del viaje» | **DDR L3** |
| «Restablecer recorrido» | Acción real: el orden de lugares vuelve al de guardados y se vacía el reparto por días; se conservan fechas y alojamiento. «Restablecer el viaje» exagera el alcance; «Restablecer los días» lo reduce | **DDR R1** |
| `Grado ${grade}` (`lib/interest-level.ts`, nivel desconocido) | Lib protegido; latente (S/A/B/C/D, todos conocidos) | **DDR** latente |
| «reparto por días», «reparto actual» | `12 §11` | no prohibido |
| «compromisos de escala día» | `12 §11`; no aparece en las superficies tocadas | no prohibido |
| 6 descripciones de `places.json` («recorrido lineal», «secuencia de vistas», «primeros tramos»…) | Contenido editorial de fuente (Art. 4); `data/` protegido; español corriente, no vocabulario de producto | B (fuera de D5) |
| «hub» (inter-hub) | No está en Art. 7 | no prohibido |

## 4. DESIGN DECISION REQUIRED abiertos

1. **L1** — «tramo de fechas registrado» (3 cadenas, `lib/reservation-mechanism-reference-date-presentation.ts`): decidir «periodo/intervalo de fechas».
2. **L2** — «…registrada del tramo.» (`lib/reservation-mechanism-calendar-presentation.ts`): ídem.
3. **L3** — «Ya está en un día del recorrido» (`lib/divergence-presentation.ts`): «del viaje».
4. **R1** — «Restablecer recorrido»: decidir el nombre exacto de la acción.
5. `Grado ${grade}` latente en `interest-level.ts`.

L1–L3 y el latente exigen tocar `lib/` (prohibido sin decisión explícita), con sus tests y los gates `phase3f-*`.

## 5. Archivos modificados

`app/src/components/{OrderedSequenceBuilder,DayOrderSheet,StopActionsSheet,TripBackup,TravellerManager}.tsx`, `viajeResumenModel.ts`,
`OrderedSequenceBuilder.inter-hub.test.ts`; gates `app/scripts/{b27-viaje-dias-check,block4-zone-planner-browser-audit,block5-travellers-browser-audit,phase5a-rc-browser-audit}.mjs`;
nuevos `app/src/d5-normative-vocabulary.test.ts`, `app/scripts/d5-normative-vocabulary-check.mjs`; docs.

## 6. Archivos protegidos

- `app/src/lib/`: **sin cambios** (`git diff 4d21631 HEAD -- app/src/lib` vacío; lo verifica el test D5).
- `data/` y `app/src/data/`: **sin cambios**.
- Hooks (`use*.ts`), `App.tsx`, CSS, `index.html`: **sin cambios**.
- Esquema V8 y claves de storage: **sin cambios**.

## 7. Resultados

Entorno: Chromium 141 (Playwright). **WebKit no está instalado** (`/opt/pw-browsers/webkit-*` ausente; `playwright install` no permitido): **no se ejecutó**.

| Comprobación | Resultado |
|---|---|
| `tsc -b` | 0 errores |
| `oxlint` | 0 errores (1 aviso previo en `PlaceMap.tsx`) |
| Vitest | 120 ficheros · 3549 tests OK |
| Gate D5 Chromium | 25/25 |
| Gate D5 reduced-motion (Chromium) | 25/25 |
| Gate D5 WebKit | NO EJECUTADO |
| D0b | 56/56 |
| B27 / B28 / B29 / B30 / B31 | 48/48 · 43/43 · 36/36 · 48/48 · 26/26 |
| block20 | 73/73 |
| phase5a | 50/50 |
| block5 (fija el copy cambiado) | 231/0 |
| block4 | FALLA igual en la base (no encuentra el botón «Kioto» en la navegación de hubs): **HEREDADO** |
| Gate D5 contra la base `4d21631` | FALLA (detecta «tramo» en inter-hub, etc.): el gate discrimina |

Auditoría visual (Chromium, 320/390/430/840/1200; Días, hoja «Quitar del día», «Probar otro orden», Nosotros, traslados entre ciudades): BASE vs D5,
sin overflow horizontal, 0 elementos recortados y alturas de botón idénticas (44 px). Safari físico no medido.

Fallos heredados: block4. Fallos exclusivos de D5: ninguno.

## Veredicto

**D5 CLAUDE: NO CERTIFICADO — WebKit no ejecutable en este entorno (navegador no instalado) y 5 DESIGN DECISION REQUIRED abiertos.**
Todo lo demás verificado en Chromium. Sin D2. Sin merge.
