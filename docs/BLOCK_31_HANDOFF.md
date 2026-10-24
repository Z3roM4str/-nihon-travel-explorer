# B31 / B9.5 — Reservas y Resumen

## Estado y base

**B31 / B9.5 CERRADO E INTEGRADO EN MAIN** mediante [PR #175](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/175), `merged_at=2026-10-01T03:51:31Z`. Merge commit `cde9b14bc9e456270576c8dafe0243ddb8c650db`, padres `393ef2b2a1a2db0641d3785b7e7cf155c914fa5c` (main previo) y `c00a35da6ab26d4ccf3389fad6f265f1c06a6868` (HEAD publicado). Tree `4e0ad7437ce48e0ca40de1bdf6848445d35b080f`, idéntico al certificado. Sin squash, rebase ni force-push.

Implementación en `codex/block-31-b9-5-reservas-resumen`, nacida exactamente del main previo, commit `9761817f0d7acfcff418145c36e14615b2840760`. Entre implementación y HEAD sólo cambió documentación. B30 permanece cerrado. La matriz firmada antes de código está en [BLOCK_31_MISSION.md](BLOCK_31_MISSION.md).

La matriz post-merge completa pasó a la primera sobre el merge exacto: build/lint, Vitest 3479/3479, invariantes 231/231, B31 281/281 y B30 475/475 por motor Chromium/WebKit, B29 163/163, B28 anidado y aislado 64/64, B27 A–K en ocho viewports, B26 314/314, B18 15/15 y diff check. Sin fallos funcionales ni nuevas regresiones observadas; los antecedentes B26/B28 no reaparecieron. GitHub no configura checks obligatorios y no tiene checks publicados en el HEAD. Detalles, evidencia y límites: [certificación de main](BLOCK_31_MAIN_CERTIFICATION.md).

El cierre documental se publica después del merge sobre main mediante push normal. Main final corresponde al commit que contiene esta actualización; su identidad se obtiene con `git log -1 --format=%H -- docs/BLOCK_31_MAIN_CERTIFICATION.md`. Sólo cambia documentación y conserva exactamente el código probado. **Siguiente bloque pendiente: B10 — Pulido**, según el roadmap vigente; no iniciado.

## Capacidades trasladadas y conservadas

Reservas reúne preparación, mecanismo editorial, anticipación literal, ventana derivada, mecanismo oficial, fecha/hora oficial, asignación, residencia, enlace, relación con la referencia del dispositivo, calendario oficial y ventana febrero–marzo 2027. Se reutilizan todos los módulos `reservation-*` existentes; ninguno se modifica. Los registros que no permiten derivar una fecha siguen mostrando su mecanismo y evidencia.

La proyección `buildTripReservationRows` sólo ordena la lectura: cierre oficial de solicitudes si ese mecanismo tiene ventana; apertura oficial si tiene fecha de venta; referencia editorial de anticipación cuando no existe un hito oficial derivable. Orden ascendente por fecha, desconocidos al final y empate por nombre/ID, nunca por posición de ruta. El significado se muestra junto a cada fecha. La anticipación editorial no se presenta como plazo oficial. El calendario oficial mantiene su agregador y su orden cronológico propio.

Resumen consume el único `buildWholeTripComposition` vigente, sobre routeIds, planningDays, accommodationLegs, interHubSegments y bounds del mismo planner. Cuatro tarjetas: visitas, traslados registrados, alojamiento y rango. Conserva subtotales, componentes faltantes y desajustes de rango; enlaces llevan a Días o Dónde dormir. No añade recomendación, ranking ni optimización.

La línea de tiempo usa exactamente `dayEntities`: IDs estables, lugares resueltos del estado actual, ciudades únicas por día y fechas calculadas con `addCivilDays` sobre el anclaje existente. Una banda igual por día; el ancho no inventa duración. Los días vacíos y los lugares no disponibles se dicen explícitamente. Sin fecha inicial, no se inventan fechas. Nombres de ciudad visibles, lista ordenada accesible, región enfocada por teclado y scroll local; detalles de visitas desplegables. Sin animación; reduced motion conserva la lectura. No hay scroll horizontal de página.

## DDR-05

Se retiran las cuatro apariciones renderizables heredadas en OrderedSequenceBuilder: `hours.raw`, `window.signal.raw`, `item.leadTime.raw` e `item.hours.raw`. Se conservan íntegros entre «comillas» con `EvidenceMark level="registrado"` (◧ Registrado); la anticipación se traslada a TripReservations. Un test recorre el AST de todo TS/TSX de producción y detecta la cadena en JSX/literales, excluyendo comentarios y tests. El gate verifica la interfaz real. No se borran fixtures ni documentación histórica para conseguir un grep cero.

## Navegación y estado

Días · Dónde dormir · Reservas · Resumen usan `aria-pressed` y la misma navegación de Viaje. Días/Reservas/Resumen comparten una instancia de `usePlanningDraft`; no hay una segunda fuente de verdad. Las superficies visitadas permanecen montadas, con una sola visible. La consulta conserva selección y modo de comparación de zonas y no escribe V8.

Para evitar un lector obsoleto tras una edición explícita en la otra superficie, App compara el texto canónico persistido al cruzar el límite planner/zonas. Sólo si cambió invalida el lector receptor mediante una revisión de montaje. No añade almacenamiento ni modifica el hook/modelo V8. El gate comprueba elección de zona, edición de fecha y conservación posterior de ambas, orden e identidades de día. Los enlaces de Resumen transfieren foco a la sub-pestaña destino.

Reservas y las visitas de la línea temporal abren el mismo stack PlaceDetail de Viaje con etiqueta de origen correcta. Cierre y browser back conservan sección, posición y foco. El contrato B30 sigue certificado.

## Adaptación necesaria de verificaciones históricas

La primera suite completa encontró 33 aserciones estructurales que exigían la ubicación anterior, la cadena Dato o el desmontaje por sub-pestaña. Se actualizaron al alcance autorizado B31; no se modificó ningún test de cálculo de dominio. Se mantuvo el número de tests históricos y se añadió cobertura de render real y browser.

El gate B30 reprodujo un timeout de 30 segundos esperando dos escrituras nuevas al volver a una instancia que B31 conserva montada (`b30-lifecycle-baseline.log`). Su helper ahora reconoce el mismo nodo ya observado con WeakSet. Una instancia nueva sigue esperando exactamente las dos escrituras de montaje; el registro completo y las 475 aserciones se conservan, incluida `320x568 reopening reads selection without serializing it` y reduced motion. Este cambio de sincronización se requiere por el ciclo de vida B31; no cambia producto B30, V8 ni las expectativas.

## Certificación

| Verificación | Resultado final |
|---|---|
| Build | PASS |
| Lint | PASS; una advertencia heredada en PlaceMap, sin nuevas advertencias |
| Vitest completo | 3479/3479, 115 archivos; 3465 base + 14 nuevos B31 |
| Invariantes V8/días/alojamiento/traslados | 231/231, 9 archivos |
| B31 Chromium | 281/281 |
| B31 WebKit | 281/281 |
| B30 Chromium | 475/475 |
| B30 WebKit | 475/475 |
| B29 | 163/163; B28 anidado 64/64 |
| B28 aislado | 64/64 |
| B27 | A–K en 8 viewports |
| B26 | 314/314 en repetición; primer intento abortado por timeout de onboarding |
| B18 browser back | 15/15 |
| git diff --check | PASS |

B31 incluye 320×568, 390×844, 1280×800, reduced motion, estados vacíos/sin fecha, consulta sin escrituras V8, orden/identidades/alojamiento, selección de comparación conservada, edición explícita entre lectores, fuentes y mecanismos oficiales, teclado, foco, targets de 44 px y retorno exacto por cierre/browser back. B30 conserva reapertura 320×568 sin serialización y reduced motion.

Evidencia final local: `build-complete.log`, `lint-complete.log`, `vitest-complete.log`, `invariants-final-2.log`, `b31-{chromium,webkit}-final-complete.log`, `b30-{chromium,webkit}-final-complete.log`, `b29-day-order-tools-final-1.log`, `b28-reorder-dnd-final-1.log`, `b27-viaje-dias-final-1.log`, `b26-nosotros-final-{1,2}.log`, `b18-final.log`.

Logs y capturas locales: `app/certification-b31/`, fuera del commit. No se desactivó TLS ni se interceptaron/simularon recursos externos. Los fixtures de browser usan lugares reales del dataset sin modificarlo.

## Incidencias y deuda

Los intentos de desarrollo del gate B31 registraron supuestos incorrectos del propio gate: el runtime B27 crea un día real vacío al montar, un argumento de evaluate faltante, la diferencia de foco por ratón en WebKit, el nombre accesible del botón Comparar y una etiqueta de zonas que no pertenece a whole-trip-composition. La comprobación nueva de foco detectó que el montaje de Dónde dormir enfoca su cierre según el contrato existente B30; la aserción acepta ese destino visible o el botón de navegación, y sigue rechazando contenido oculto y foco perdido. No se modifica ZoneComparison ni se fuerza otro foco sobre su montaje. Se corrigió la instrumentación y se comprobó la información real; no se inventaron valores ni se cambiaron cálculos para satisfacer esas expectativas.

B28 pasó 64/64 dentro de B29 y 64/64 aislado; no reapareció el auto-scroll. B26 abortó en la primera ejecución con timeout de 10 segundos esperando el diálogo de onboarding identity a 430×932 (`auditOnboardingLayout`, línea 710), antes de entrar en Viaje. La repetición completa pasó 314/314. Nosotros, Onboarding y el gate B26 permanecen idénticos a la base; no se modificaron para obtener verde. Entre esos intentos se terminó el trabajo de foco de los enlaces de Resumen B31, que no participa en ese contexto nuevo de onboarding. I-RESET-CANCEL y K-FOCUS-VISIBLE pasaron; no se demuestra una regresión determinista. No se mezcla investigación adicional de B26 con B31.

Fuera de certificación: Safari físico/iPhone y lector de pantalla físico. Siguen pendientes fotografías reales de zonas y recursos externos/OSM; B25 conserva su antecedente externo 122/123. No se añade adquisición, fotografía ni nuevo dataset. #168 continúa separado: abierto Draft, HEAD `1444e67805c60cf9a33f4be5c1a3808b900e505b`. Sin cambios en claude/*, Astra ni Vercel/deploy.

## Archivos

- `app/scripts/b30-where-to-sleep-check.mjs`
- `app/scripts/b31-reservas-resumen-check.mjs`
- `app/src/App.tsx`
- `app/src/block18-shell.test.ts`
- `app/src/block20-place-detail.test.ts`
- `app/src/bundle-architecture.test.ts`
- `app/src/components/OrderedSequenceBuilder.official-reservation-calendar.test.ts`
- `app/src/components/OrderedSequenceBuilder.official-reservation-reference-date.test.ts`
- `app/src/components/OrderedSequenceBuilder.reservation-window-reference.test.ts`
- `app/src/components/OrderedSequenceBuilder.test.ts`
- `app/src/components/OrderedSequenceBuilder.tsx`
- `app/src/components/OrderedSequenceBuilder.whole-trip.test.ts`
- `app/src/components/TravellerLayer.test.ts`
- `app/src/components/TripOverview.b31.test.tsx`
- `app/src/components/TripReservations.tsx`
- `app/src/components/TripTimeline.tsx`
- `app/src/components/ZonePlanSection.test.ts`
- `app/src/lib/trip-reservation-presentation.ts`
- `app/src/styles/trip-overview.css`
- `docs/BLOCK_31_HANDOFF.md`
- `docs/BLOCK_31_MISSION.md`
- `docs/CURRENT_WORK_HANDOFF.md`
- `docs/design/09_DECISIONES_DE_DISENO.md`
- `docs/design/10_ROADMAP_DE_BLOQUES.md`

## Decisiones

No se encontró contradicción real entre documentos canónicos que requiriese una nueva DDR. Se completa DDR-05 dentro del bloque autorizado. Se mantienen separados mecanismo oficial y anticipación editorial, aunque compartan la nueva sección. La entrega original no autorizaba el merge; la autorización posterior explícita integra y cierra #175. No se inicia otro bloque.
