# D5 — Vocabulario normativo · handoff

**Línea Claude.** Base `4d2163165f791b2ba3b1db8c7cbb968e1c607314` (verificada con `git fetch`: la rama remota `claude/d0b-design-system-hygiene`
seguía exactamente ahí). Rama `claude/d5-normative-vocabulary`. Sólo presentación/copy. **Segunda ronda: los 5 DDR cerrados y certificación WebKit 26.5.**

## 1. Inventario (término | apariciones UI | internas | excepciones | DDR)

Clasificación sobre `app/src` (+ `data/`). «Internas» = identificadores, tipos, comentarios, nombres de fichero/CSS, tests; no llegan a pantalla.

| Término | Apariciones UI (A, cambiadas) | Internas (C) | Excepciones (B) | DDR (D) |
|---|---|---|---|---|
| tramo | `OrderedSequenceBuilder`: resumen k/n, «sin registrar», inter-hub (intro, vacío, aria+title «Eliminar…», «Duración manual…» ×2, «Añadir…», inactivo); `DayOrderSheet`: 5 cadenas | `knownLegCount`…, comentarios (p. ej. geometría en `PlaceCard`) | — | L1 (3 cadenas) y L2 (1): *tramo* = intervalo de fechas → **resueltos** («intervalo de fechas registrado») |
| recorrido | `OrderedSequenceBuilder` (4), `StopActionsSheet` (3), `TripBackup`, `viajeResumenModel` (2), `TravellerManager` | `routeIds`, `resetRoute`, comentarios | — | L3 y R1 → **resueltos** («día del viaje», «Restablecer lugares y días») |
| constructor | 1 (aria-label + title del botón de cerrar) | comentarios, clases | — | — |
| secuencia | 0 | `OrderedSequenceBuilder`, `sequence-comparison`, clases | — | — |
| orden A / orden B | 0 (ya era «orden actual / otro orden») | `candidateA/B`, comentarios | — | — |
| candidato | 0 | `candidateDayPlaceIds`, `candidateMix`, `SequenceCandidate` | — | — |
| Dato: | 0 | — | — | — |
| grado | 0 en chrome | `place.grade`, comentarios | E1: «Grado original» dentro de «Fuentes» plegado (`PlaceDetail`) | etiqueta latente «Grado X» → **resuelta** («Nivel sin clasificar (X)») |
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
| «reparto por días», «reparto actual» | `12 §11` | no prohibido |
| «compromisos de escala día» | `12 §11`; no aparece en las superficies tocadas | no prohibido |
| 6 descripciones de `places.json` («recorrido lineal», «secuencia de vistas», «primeros tramos»…) | Contenido editorial de fuente (Art. 4); `data/` protegido; español corriente, no vocabulario de producto | B (fuera de D5) |
| «hub» (inter-hub) | No está en Art. 7 | no prohibido |

## 4. DESIGN DECISION REQUIRED — cerrados (0 abiertos)

Decisiones tomadas por el responsable del producto y aplicadas con el cambio mínimo; sin cambios de lógica, cálculo, datos, V8 ni storage.

| DDR | Antes | Después | Fichero |
|---|---|---|---|
| L1 | «…antes / cae dentro / después **del tramo de fechas registrado** para la solicitud.» (3) | «…del **intervalo de fechas registrado** para la solicitud.» (*tramo* = intervalo temporal, nunca «traslado») | `lib/reservation-mechanism-reference-date-presentation.ts` |
| L2 | «Situado en esta lista por la fecha de inicio registrada del tramo.» | «…registrada del **intervalo**.» | `lib/reservation-mechanism-calendar-presentation.ts` |
| L3 | «Ya está en un día del recorrido. Esto no lo cambia.» | «Ya está en un día del **viaje**. Esto no lo cambia.» | `lib/divergence-presentation.ts` |
| R1 | «Restablecer recorrido» | «Restablecer lugares y días» (`resetRoute` conserva su nombre interno; la acción restaura los lugares guardados en su orden y elimina el reparto por días, conservando el anclaje temporal y el alojamiento) | `OrderedSequenceBuilder.tsx` |
| latente | `Grado ${grade}` (label y shortLabel) | `Nivel sin clasificar (${grade})`; `grade`, `rank`, `level`, `glyph` y comportamiento intactos; la letra desconocida sigue visible | `lib/interest-level.ts` |

**Excepción a la protección de `lib/` (autorizada, documentada):** sólo copy de presentación en esos 4 ficheros más los tests que fijaban las cadenas
(`reservation-mechanism-reference-date-presentation.test.ts`, `…-calendar-presentation.test.ts`, `reservation-mechanism-calendar.test.ts`, `divergence-presentation.test.ts`).
Un test D5 comprueba, línea a línea, que el diff de esos 4 ficheros contra la base consiste únicamente en esas sustituciones (mismas líneas, sólo los términos autorizados).
Los tests de alcance históricos (`b27`…`b31`), que fijaban «lib/ y DayOrderSheet intactos» frente a bases antiguas, admiten ahora exactamente estos 5 ficheros
(`D5_COPY`); nada más. Gates `phase3f-h/j/s` actualizados al copy nuevo y en verde.

**Revisión de la sustitución de confianza media (`TravellerManager`):** «Sólo cambia de quién es cada «Quiero ir». Los lugares planificados, los días, las fechas y el alojamiento son del viaje y los compartís los dos.»
La frase enumera lo que **no** cambia al cambiar de persona; «los lugares planificados» describe correctamente la lista de lugares del plan (la antigua «recorrido»). Se mantiene sin cambios.

**E1** (excepción normativa «Grado original» en «Fuentes» plegado de PlaceDetail) sigue documentada y verificada por gate y test; no es un DDR.

## 5. Archivos modificados

`app/src/components/{OrderedSequenceBuilder,DayOrderSheet,StopActionsSheet,TripBackup,TravellerManager}.tsx`, `viajeResumenModel.ts`,
`OrderedSequenceBuilder.inter-hub.test.ts`; los 4 ficheros de `lib/` de la excepción (§4) y sus 4 tests; tests de alcance `b27`…`b31`/`d5` (`D5_COPY`);
gates `app/scripts/{b27-viaje-dias-check,block4-zone-planner-browser-audit,block5-travellers-browser-audit,phase5a-rc-browser-audit,phase3f-h-browser-audit,phase3f-j-browser-audit,phase3f-s-browser-audit}.mjs`;
nuevos `app/src/d5-normative-vocabulary.test.ts`, `app/scripts/d5-normative-vocabulary-check.mjs`; docs.

## 6. Archivos protegidos

- `app/src/lib/`: **sólo** los 4 ficheros de copy de §4 (+ sus tests); el resto, sin cambios. El diff de esos 4 ficheros es únicamente copy (test D5).
- `data/` y `app/src/data/`: **sin cambios**.
- Hooks (`use*.ts`), `App.tsx` (se revirtió un comentario fuera de alcance), CSS, `index.html`: **sin cambios**.
- Esquema V8 y claves de storage: **sin cambios**.

## 7. Resultados

Chromium 141 y **WebKit 26.5** (Playwright 1.62.1). WebKit no venía instalado: se descargó `webkit-2336` en un directorio de trabajo (`PLAYWRIGHT_BROWSERS_PATH`)
y se instalaron las librerías del sistema con `playwright install-deps webkit`; sin cambios en el producto ni en CI. No se simuló WebKit con Chromium.

| Comprobación | Chromium | WebKit 26.5 |
|---|---|---|
| `tsc -b` / `oxlint` | 0 errores / 0 errores (1 aviso previo en `PlaceMap.tsx`) | — |
| Vitest | 120 ficheros · 3555 tests OK | — |
| Gate D5 | 26/26 | 26/26 |
| Gate D5 reduced-motion | 26/26 | 26/26 |
| D0b | 56/56 | 56/56 |
| B27 / B28 / B29 | 48/48 · 43/43 · 36/36 | (gates sólo Chromium por diseño) |
| B30 / B31 | 48/48 · 26/26 | 48/48 · 26/26 |
| block20 / phase5a / block5 | 73/73 · 50/50 · 231/0 | — |
| phase3f-h / j / s (copy de `lib/` fijado) | exit 0 | — |
| block4 | FALLA igual en la base (no encuentra «Kioto»): **HEREDADO** | — |
| Gate D5 contra la base `4d21631` | FALLA (detecta «tramo»…): el gate discrimina | — |

Auditoría visual BASE vs D5 (320/390/430/840/1200; Días, «Quitar del día», «Probar otro orden», Nosotros, Reservas, Resumen, Quiero ir; Chromium y WebKit):
0 overflow horizontal, 0 recortes nuevos, alturas de botón idénticas (44 px). Safari físico en iPhone no medido.

Fallos heredados: block4. Fallos exclusivos de D5: **ninguno**.

## Veredicto

**D5 CLAUDE: CERTIFICADO**

## Integración

PR #176 integrado en `claude/d0b-design-system-hygiene` (PR #174) mediante merge commit `b7253d0` (padres `4d21631…` y `c0fa562…`; tree `b398407…` = tree certificado de D5). Recertificado el conjunto D0b + D5; ver `docs/D0B_DESIGN_SYSTEM_HYGIENE_HANDOFF.md`.
