# Handoff B31 — B9.5 «Reservas y Resumen» (línea Claude)

- Rama `claude/b31-viaje-b9-5-reservas-resumen`, base `1444e67805c60cf9a33f4be5c1a3808b900e505b` (HEAD de
  `claude/b30-viaje-b9-4-donde-dormir`). Misión: `docs/BLOCK_31_MISSION.md`. Decisiones: DDR-B31-01…07 en
  `docs/design/09`.
- **Arranque de sesión.** La sesión arrancó en `claude/b31-reservas-resumen-e8ytdk` = `a7b916b` (línea main/Codex).
  No se usó, no se reseteó ni se empujó. La rama de la misión se creó desde `1444e67` (verificado con
  `git rev-parse` y contra `origin/claude/b30-viaje-b9-4-donde-dormir`) por instrucción expresa del Product Owner.
- Sólo presentación. Cero cambios en `lib/`, `data/`, hooks, esquema V8, clave de storage, `DayTimeline`,
  `DayOrderSheet`, `TripStop`, `UnassignedDrawer`, `ZoneComparison` ni `PlaceDetail`. `App.tsx`: **una línea**
  (`onNavigateSection={setViajeSectionTracked}`, H4).

## Qué cambia

| Ítem | Dónde | Cambio |
|---|---|---|
| H1 «Dato:» | `OrderedSequenceBuilder.tsx` | Las 4 apariciones (`recorded-interval-fit__raw`, `reservation-deadline__raw`, `reservation-prep__raw`, `hours-planning__raw`) pasan a «{texto íntegro}» + `EvidenceMark registrado` con etiqueta visible. En Días sólo esa sustitución (descargos, campos y estructura intactos). `Dato:` = 0 en `app/src`. |
| H2 Reservas | `OrderedSequenceBuilder.tsx`, `App.css` | h2 «Reservas» + UNA nota (`RESERVAS_NOTE`). Lista 1 «Fechas oficiales» (h3 propio, ◼ por fila con la procedencia como `detail`, enlace «Ver fuente oficial» con `aria-label` «Ver fuente oficial de {lugar}»). Lista 2 «Reservas por preparar» (h3 propio, ◧). Subsección «Horarios registrados» (◧) después. Superficies distintas (oficial `--surface` + borde fuerte; editorial `--surface-sunken`). Orden: el de `lib` sin reordenar en la vista (DDR-1). Tres descargos en prosa eliminados → nota única + `detail` del marcador de cada lista (tabla abajo). |
| H3 Resumen | `TripSummaryCards.tsx`, `TripTimelineBand.tsx`, `viajeResumenModel.ts` (nuevos), `OrderedSequenceBuilder.tsx`, `App.css` | h2 «Resumen» + UNA nota (`RESUMEN_NOTE`) + banda comprimida + cuatro tarjetas h3 (Visitas · Traslados registrados · Alojamiento · Rango del viaje) con los mismos datos de `WholeTripComposition`, ◇ por tarjeta, avisos «incompleto» como texto de tarjeta y un `<button>` de navegación. Estado «unavailable»: una sola tarjeta con el texto existente, sin nota, banda ni enlaces. `WholeTripCompositionSection` desaparece del componente (su presentación vive en `TripSummaryCards`). |
| Banda (DDR-B31-05) | `TripTimelineBand.tsx`, `App.css` | Un segmento por día, ancho igual (`grid-auto-columns: minmax(0,1fr)`), sólo tokens neutros, sin color por ciudad, `role="img"` + `aria-label`, sin tabstops, sin animación. Etiqueta visible «N» + ciudad truncable («Día N» en contenedor ≥ 520 px, `@container`). Alternativa textual `<ol class="visually-hidden">` con «Día N · ciudad», «Día N · Tokio y Kioto», «Día N · sin lugares». Ciudad = `dayCityLabel(zoneDayLinks[i].hubs)` (la que ya usa el titular del día). Marcador ◇. |
| H4 Navegación | `App.tsx` (1 línea), `OrderedSequenceBuilder.tsx` (prop `onNavigateSection`), `viajeSurfaceFocus.ts` | Las tarjetas llaman al setter existente `setViajeSectionTracked`; `OrderedSequenceBuilder.onClose` sólo iba a «Dónde dormir», por eso hizo falta el callback. Sin estado nuevo, sin historial. Foco: tras navegar, `viajeSurfaceFocus` busca (≤ 90 fotogramas) el h2 de destino (`[data-viaje-surface="dias"] h2` / `#zone-panel-title`), le pone `tabindex=-1` si falta y lo enfoca. `ZoneComparison` no se toca. Los h2 de Días/Reservas/Resumen llevan `tabIndex={-1}`. |
| H5 Estilos | `App.css` (bloque «B31 (B9.5)») | Sólo tokens existentes; rejilla `repeat(auto-fill, minmax(min(264px, 100%), 1fr))` (DD-016, sin `@media`); banda con `@container`. |
| Docs | `docs/design/09` (DDR-B31-01…07), enmiendas en `05 §9`, `05 §10`, `10 §B9.5` | Ver §9 de la misión. |

## Tabla «descargo → destino» (DDR-B31-04: ninguna frase sin destino)

| Descargo eliminado | Frase | Destino |
|---|---|---|
| `official-reservation-calendar__disclaimer` | «Estas fechas provienen del registro oficial de cada lugar y están calculadas sobre la fecha de visita planificada.» | `detail` del ◼ de «Fechas oficiales» (`OFFICIAL_CALENDAR_MARK_DETAIL`), literal |
| ″ | «El orden cronológico solo ordena fechas de calendario: no indica prioridad, urgencia ni en qué orden conviene reservar.» | ″, literal. La negación se conserva (DDR-B31-04: no se elimina una advertencia); por eso vive en el `detail` y no en el texto visible, y el test de léxico la exime por esa constante |
| ″ | «No indica disponibilidad ni el estado actual de la venta.» | Nota única de Reservas, literal |
| ″ | «Cuando se muestra una relación con la fecha de referencia, compara únicamente fechas de calendario: no considera la hora registrada ni la zona horaria de la fuente…» | `detail` del ◼, literal |
| ″ | «…y esa fecha se toma del calendario local de tu dispositivo al abrir este plan sin actualizarse sola.» | Nota única: «La fecha de referencia se toma del calendario local de tu dispositivo al abrir este plan, no representa la fecha operativa en Japón y no se actualiza automáticamente mientras esta vista siga abierta.» — frase ya existente en los descargos de las tarjetas de día (`reservation-deadline__disclaimer`, `official-reservation-date__disclaimer`); mismo significado que «sin actualizarse sola» |
| ″ | «Esta información oficial se muestra por separado de la anticipación editorial registrada; Nihon no combina ambas fuentes.» | Nota única: «La información oficial se muestra por separado…» («Esta» → «La»; el resto literal) |
| `reservation-prep__disclaimer` | «Esta sección solo describe la anticipación registrada en el dato original de cada lugar.» | `detail` del ◧ de «Reservas por preparar» («Esta lista solo describe…»: «sección» → «lista», porque ahora es una lista) |
| ″ | «No calcula fechas límite de reserva ni las compara con tu calendario.» | Partida: «no calcula fechas límite de reserva» → nota única; «no compara esa anticipación con tu calendario» → `detail` del ◧ |
| `hours-planning__disclaimer` | «Esta sección solo describe qué horario está registrado en el dato original de cada lugar.» | `detail` del ◧ de «Horarios registrados» («lista» por «sección») |
| ″ | «No determina si el lugar abre o cierra en tu fecha, no revisa festivos ni cierres, y no se compara con la hora del día.» | ″, literal |
| `whole-trip-composition__intro` | «Describe únicamente los datos registrados para este reparto; no puntúa ni recomienda cambios.» | Nota única de Resumen (`RESUMEN_NOTE`), literal |
| `whole-trip-composition__incomplete` (×5) | avisos «incompleto» | Texto de su tarjeta (`trip-summary-card__incomplete`), con la sustitución léxica de abajo |

Comprobado: ninguna frase necesitó una afirmación nueva (no se disparó la parada de DDR-B31-04). Los detalles
en `aria-label`/`title` no son visibles en táctil: así lo fija DDR-B31-04 («recuperable por lector de pantalla»).

## Sustituciones léxicas en Resumen (03 §10 / Art. 7)

| Antes | Después | Número mostrado |
|---|---|---|
| «Resumen del plan completo» (h3) | h2 «Resumen» + `aria-label` «Resumen del viaje»; cuatro h3 | — |
| «Tramos manuales: N» | «Traslados manuales: N» | `manualLegCount`, igual |
| «faltan N tramo(s) local(es) y M tramo(s) entre ciudades» | «faltan N traslado(s) local(es) y M traslado(s) entre ciudades» | igual |
| «Posiciones de movimiento modeladas: N» | «Traslados entre lugares contemplados en este resumen: N» | `modeledAdjacencyCount`, igual |
| «Todos los tramos entre lugares que este resumen modela tienen tiempo registrado.» | «Todos los traslados entre lugares que este resumen contempla tienen tiempo registrado.» | — |
| «No hay posiciones de movimiento entre lugares modeladas en este reparto.» | «No hay traslados entre lugares contemplados en este reparto.» | — |
| «Fechas oficiales de reserva del recorrido» (h3) | «Fechas oficiales» | — |

Sin tocar (fuera de la lista nominal de la misión, sin equivalente de viajero inequívoco que conserve el
significado): «reparto», «compromisos de escala día», «límites de días vacíos no aplicables», «Locales/Entre
ciudades». Quedan como deuda léxica para una pasada de copy.

## Cambios a tests y gates existentes (todos justificados)

| Fichero | Cambio | Justificación |
|---|---|---|
| `block20-place-detail.test.ts` (DDR-05) | «4 apariciones» → 0 (+1 test: sin «Dato: «»), mismo número de tests | `10 §B9.5`/DDR-05: B9.5 retira `Dato:` |
| `b30-donde-dormir-wiring.test.ts` «invariantes heredados» | 4 → 0 | ″ |
| `OrderedSequenceBuilder.reservation-window-reference.test.ts` | espera «texto» + `<EvidenceMark level="registrado" />` y sin `Dato:` | `03 §10`, DDR-05 |
| `OrderedSequenceBuilder.official-reservation-calendar.test.ts` | descargo → `detail` del marcador + nota; heading «Fechas oficiales»; familia de clases admite `reservas__heading`; `sectionWithoutDisclaimer` sin descargo | DDR-B31-02/04 |
| `OrderedSequenceBuilder.whole-trip.test.ts` | lee `TripSummaryCards.tsx` + `viajeResumenModel.ts`; `onClick` sólo del botón de navegación; «tramos» → «traslados» | `05 §10`, DDR-B31-07, `03 §10` |
| `…local-swap`, `…local-relocation`, `…four-place-interior-reversal`, `…interior-transposition`, `…two-pair-block-swap`, `b29-day-order-wiring` | marcador de fin de sección `function wholeTripUnavailableText` → `export function OrderedSequenceBuilder(` | El bloque de composición salió del fichero (H3); el contenido escaneado es el mismo |
| `b30-invariants-scope.test.ts` | `App.tsx` y `OrderedSequenceBuilder.tsx` salen de la lista «sin cambios» con excepción citada (misión B31 §4 H1/H4 y §6) | La misión cambia ambos; nada más se relaja (lo vigila `b31-invariants-scope.test.ts` frente a `1444e67`) |
| `scripts/b27-viaje-dias-check.mjs` K03/K04/K05 | composición = tarjetas; `Dato:` = 0 (+ «…» ◧ Registrado); h3 «Fechas oficiales» | `10 §B9.5`, DDR-05, DDR-B31-02 (K03 no figuraba en la misión: lo fijaba el h3 «Resumen del plan completo») |
| `scripts/phase5a-rc-browser-audit.mjs` C06, A14 | «…» + ◧ Registrado y sin `Dato:`; `.whole-trip-composition` → `.trip-summary` | DDR-05; H3 (A14 no figuraba en la misión: la clase antigua ya no existe) |
| `scripts/phase3f-j-browser-audit.mjs` | h3 «Fechas oficiales»; el descargo se lee del `aria-label` del marcador y de la nota | DDR-B31-02/04 (no figuraba en la misión: fijaba el texto visible del descargo) |
| `scripts/block20-place-detail-check.mjs` | SIN CAMBIO (la ficha sigue sin «Dato:») | misión §6 |

## Tests y gates nuevos

- `src/b31-reservas-resumen.test.ts` (21) y `src/b31-invariants-scope.test.ts` (4: `lib/`/`data/`, hooks y
  componentes protegidos, `App.tsx` = una línea añadida sin borrados, sin claves de storage nuevas).
- `app/scripts/b31-reservas-resumen-check.mjs` (26 comprobaciones; Chromium 1194; `NIHON_BROWSER=webkit`;
  `NIHON_REDUCED_MOTION=1`).

## Resultados medidos

{{RESULTS}}

## Desviaciones y hallazgos que requieren decisión

1. **«Contador de `setItem` = 0» (misión §8 y §12) no es literalmente medible, ni en la base.** En `1444e67`
   cada montaje de una sub-pestaña del planificador (Días/Reservas/Resumen) vuelve a persistir el borrador
   **idéntico** (2 × `setItem` de `nihon.manualPlanningDraft`; `usePlanningDraft`, desde B27). Medido igual en
   base y en B31 (sonda de 6 escrituras al abrir Viaje y 2 por cambio de sub-pestaña). B31 no toca el hook
   (fuera de alcance). El gate comprueba la intención de «cero escrituras nuevas»: (E01) ninguna clave nueva y
   el valor del borrador no cambia; (E02) 0 escrituras en reposo sobre Reservas y Resumen, incluso recorriendo la
   banda con el puntero. **Si Producto quiere el 0 literal, es trabajo del hook (B27), no de B31.**
2. **Negación conservada.** «…no indica prioridad, urgencia ni en qué orden conviene reservar» permanece en el
   `detail` del ◼ (no visible). DDR-B31-04 prohíbe eliminar advertencias; DDR-B31-01 prohíbe el léxico de
   urgencia como lenguaje de la superficie. Se resolvió con la frase exenta sólo en su constante de detalle.
3. **Nota de Reservas** incorpora «no representa la fecha operativa en Japón», que hoy vive en los descargos de
   las tarjetas de día, no en el de calendario (es una advertencia ya existente en el código, DDR-B31-04).

## Deuda heredada (no tocada)

Sin cambios respecto a la base: `block3/4/7` de zonas; carrera de decodificación de foto de `phase5a`;
`b18-regression-check`; `b24-real-input` P0-2; `block1/3/4/13/14` con selectores legacy; B28 T02 con Chromium
1234. **Binario usado en este entorno: Chromium 1194** (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
141.0.7390.37). Los audits que no admiten `executablePath` se lanzaron con un preload local
(`playwright.chromium.launch` → 1194) fuera del repositorio.

## Límites declarados

- **WebKit no medido**: este entorno no trae WebKit instalado (`/opt/pw-browsers` sólo tiene Chromium 1194) y no
  se instala. `NIHON_BROWSER=webkit` está implementado y falla al lanzar (binario ausente). Pendiente de
  ejecutar donde exista WebKit.
- **iPhone Safari físico: no medido.**
