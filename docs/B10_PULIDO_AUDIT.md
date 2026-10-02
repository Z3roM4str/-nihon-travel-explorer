# Estado operativo B10 — autorización ejecutada desde c868bd3 (2026-10-02)

**INCOMPLETO; #177 Draft, sin merge.** Candidata de producto probada `26407373059e0f20e6e64e975f7a38eb7da5805f`, tree `beb0917c912b32a61c53802760d39aa3c6ebca2d`; inicio `c868bd3e5bbb7df15ae44928476aa425f330ba12`. [Informe por lote](B10_AUTHORIZED_CONTINUATION_REPORT.md), [manifiesto nuevo](B10_AUTHORIZED_CONTINUATION_EVIDENCE.json), [34 decisiones CSS pendientes](B10_CSS_PENDING_DECISIONS.md), [matriz física](B10_PHYSICAL_QA_MATRIX.md). Los snapshots inferiores/manifiestos históricos conservan sus propios SHAs y alcances.

E01–E04 **aprobadas, implementadas y verificadas**, sólo literales/contextos acordados; completos/parciales/vacíos/inválidos, N/M y singular/plural. A-01 **implementado/verificado**: cuatro enlaces nativos a encabezados, foco visible, scroll correcto y Tab posterior. **312 acciones** con acceso normal **64/70/28/150**; Chromium/WebKit, móvil/escritorio y normal/reduced. No esperan aprobación.

G6 entrada **PASS: 271025 → 157046 B gzip nivel 9**, ceiling **253742**, margen **96696**. JavaScript crítico completo **223691** (runtime compartido **66645**), ahorro crítico **47334**. Diferidos: mapas/Leaflet **48880**, Días **33206**, zonas **5864**. Límites reales de interacción, sin import/prefetch que adelante Leaflet; primera apertura/reapertura, red lenta, fallo/reintento, cambios de superficie, selección/clusters/filtros, foco/scroll/persistencia/dimensiones verificados. **G6 global permanece sin certificar**: guard Chromium detectó fotos lejanas y ventana Osaka **3862290 > 3500000**; ese fallo no se borra por repeticiones distintas. Atribución nueva: ocho respuestas de portada (546950 B) completan la ventana de Osaka; propuesta concreta de siguiente lote fotográfico en el informe; presupuesto, definición y ratchet intactos.

CSS: **43 equivalencias canónicas exactas**, marco de ficha en posición original, App.css **444 líneas/43 reglas**. **G4 abierto**: ocho hex, dos queries legacy y 34 decisiones tipográficas/layout con ubicación/valor/alternativa/efecto. Atribución visual histórica/subpíxel y paridad estricta pendientes, sin promedio ni inferencia por ausencia de overflow. Corrección determinista adicional: contención de labels nacionales (position:relative); elimina rango oculto **1696/1516 px**. Guard por coordenadas **53/53 en ambos motores**, mutante vuelve a **51/53**; no se añade el cambio de App ni la nueva tarjeta de main.

Build/lint, **119 archivos/3430 tests PASS**. Regresión final: 79 trabajos, 67/68 positivos PASS, 11/11 controles negativos detectados; fallos positivos: performance-chromium. Datos/assets/V8/backup **836** sin cambios inesperados; integridad histórica **4036/4036**, manifiestos de esta autorización **482/482**. Identidades, fuentes/fotos, package/lock intactos. F01–F12 **NO EJECUTADO**: probar la candidata exacta indicada con hardware, sin sustituir por emulación/documentación. OD-01 **POST-V1/DIFERIDO**.

OSM real: Chromium 116 fallos TLS/0 respuestas; WebKit 53 respuestas/0 fallos. B25 UI y disponibilidad externa se certifican por separado; TLS verificado, sin mocks para aprobar OSM. Fotografía/licencias de zonas conserva su pendiente histórico independiente.

Main observado avanza **8046464 → 4fc32fe (#191) → ce951a8366e37f35d801e237ab7f3071204879a8 (#192)**; cambios inspeccionados, sin incorporar/escribir main. Backup `40838062062c8820ea9f7b028675d8add0c96c32`, RC/tag v1.1.0 `d72e19921b4aa9c9f68d0d07f8b35f37f158a286` intactos. Checkpoints no forzados sólo en codex/b10-pulido-mission; sin merge/main/claude/*/#168/Astra/Vercel/deploy ni modificación del RC.

---

# Estado operativo B10 — continuación autónoma de #177, 2026-10-02

**INCOMPLETO; PR #177 Draft, sin fusionar.** Inicio `23e112f288600d115633963e2edf50676bdd4469`; código nuevo publicado `0518646c0c429ad405371bc40789e8059f880e78`. [Informe operativo y lotes](B10_CONTINUATION_REPORT.md), [evidencia nueva](B10_CONTINUATION_EVIDENCE.json), [propuestas E01–E04 completas](B10_EDITORIAL_PROPOSALS.md) y [matriz física](B10_PHYSICAL_QA_MATRIX.md). Las evidencias históricas mantienen sus SHAs y no certifican los nuevos commits.

G6 **FAIL**: entrada escrita 273259 → **271025 B gzip**, ahorro 2234; ceiling **253742**, exceso **17283**, sin ratchet/excepción ni métrica distinta. CSS: cuatro superficies/globales extraídas por lotes, **App.css 1259 → 457 líneas**; CSS compilado final idéntico al inicial, con limitaciones de PNG y subpíxel WebKit detalladas en el informe. Tokens/hex y responsive legacy pendientes, sin equivalencias inventadas. A-01 confirmado (64/70/28/150 pasos Tab), patrón/textos de salto condicionado a Producto. E01–E04 abiertas, ninguna propuesta aplicada; OD-01 **POST-V1/DIFERIDO**.

Datos canónicos, package/lock, fotografías públicas y persistencia V8 conservados; APIs y funciones verificadas. Build/lint y G1 **119 archivos/3429 PASS**; censo explica también la certificación anterior 116/3501 y replacements de main. Integridad histórica y comprobación adicional git-hash-object **2131/2131**. Regresión final por gate/motor y todos los intentos en el informe/manifiesto; no convertir muestras parciales en PASS global. Matriz física F01–F12 **NO EJECUTADO**: no aprobación de Safari/iPhone/lector/selector físico. OSM/TLS y fotografías/licencias de zonas son dos pendientes externos separados.

Main incorporado permanece `e124591b19f9f241a38091598faf2c1d27b554e4`. Main remoto observado `80464643528a458de05149b01a8b5c2e5b94a77f` (#190, sólo documentos inspeccionados, no incorporados). Respaldo remoto intacto `codex/b10-backup-pre-reconcile-20261001` → `40838062062c8820ea9f7b028675d8add0c96c32`. Publicación exclusivamente en esta rama con actualización no forzada y verificación concurrente previa. Sin merge, rebase, force-push, main/claude/*/#168, Astra, Vercel/deploy ni cambios al RC congelado.

Lo siguiente conserva snapshots anteriores y su autoridad/alcance histórico. El estado operativo es esta continuación; propuestas previas no son aprobación ni permiso para ampliar presupuestos.

---

# B10 — Auditoría de preparación

## Checkpoint autónomo

Defectos reproducidos y corregidos: summary 42 px, targets secundarios, reduced motion JS, cabecera de filtros variable y mapa con scroll residual/retorno perdido. La [matriz consolidada](B10_AUTONOMOUS_REPORT.md) distingue gates verdes, fallos históricos comparados, G6 incumplido y pruebas físicas pendientes. Los snapshots siguientes conservan su fecha y alcance original; B10 no está cerrado.

Main avanzó externamente a `5498756b` (#178–#181). Esta certificación permanece sobre b854/a6ec57c8; **#177 requiere reconciliación comparativa antes de integrar**. [Inventario y recomendación](B10_AUTONOMOUS_REPORT.md#avance-concurrente-de-main-detectado-al-cierre).

## Actualización L2 — clasificación contextual; B10 incompleto

[Alcance/matriz](B10_L2_COPY_SCOPE.md), [certificación](B10_L2_CERTIFICATION.md), [evidencia](B10_L2_EVIDENCE.json). Desde `20bdf2d16ccfefccae5626880c0246c385c87aa1`; implementación `ebcb6fc5fe8cedbad8edae1ec8939447cccaa08f`. L1 y evidencia intactos.

- F-C02: C01–C03 corregidos (cuatro cadenas de entidad/acciones); V01–V04 conservados por contexto documentado. No hay sustitución global de tramo/recorrido.
- E01–E04 siguen abiertos: ratio/parciales, frase compartida F-C03, partición inválida y hubs. Siguiente lote L2b documental/editorial.
- Build/lint, 116/3483 tests, browser Chromium/WebKit (60 estados) y última regresión B26/B27/B29/B28 PASS. Intentos fallidos y comparación base se preservan; no se atribuyen todos a deuda heredada. G5/G6 globales no cerrados; targets 42 px y resto de lotes fuera de alcance.

## Histórico L1 — producto implementado, B10 incompleto

HEAD documental inicial `2bbc09d63be2abe03b17aea8796274251425d32f`; implementación `3ac50d11392dce7635232a18baf4530f38895d10`, misma rama y PR #177 Draft. Main/rama remotos coincidieron con las precondiciones, sin cambios que incorporar. [Certificación acotada](B10_L1_CERTIFICATION.md), [evidencia y hashes](B10_L1_EVIDENCE.json).

- **F-C01 resuelto en L1**: status «0 lugares»/«1 lugar»/«57 lugares», filtros activos reales y botón Ver coincidentes. No cambia filtrado ni identidades.
- **F-C03 parcialmente resuelto**: sólo «Lugares en el viaje» en SummaryList (preview/restaurado). Sustitución canónica documentada, sin decisión abierta. Conteos/fechas/avisos/acciones, V8 y backup conservados. La frase larga de Nosotros sigue pendiente de copy.
- Build/lint PASS; Vitest 116/3483; B26 Chromium/WebKit 314/314 cada uno. Matriz antes/después: 15 estados por versión, tres viewports; conservación y teclado/foco comprobados. Se conservan intentos fallidos y causas, sin relajar gates existentes.
- **F-A02 / P1, heredado y pendiente L3**: los seis encabezados `summary.filter-group__summary` tienen 42 px de alto en 320/390/1440, tanto en base como en L1. Recorrido de teclado y foco visible pasan; medidas efectivas registradas en before/after/results.json. Incumple suelo 44 px (Art. 11/G5); fuera de corrección autorizada de copy. No se afirma G5/AA global.
- Cromo 390: 104/160 px; sin overflow/pageerrors en la muestra. Identity 800w sin cambios, bajo presupuesto. Entrada raw/gzip disminuye 14/13 B vs base con mismo analizador; Brotli +181 B. **P-03/G6 histórico continúa pendiente**, sin declarar B10 completo.
- F-C02, resto F-C03, F-M01, A-01, CSS, movimiento, rendimiento y OD-01 permanecen pendientes. Siguiente lote recomendado L2; F-A02 se incorpora al inventario de L3, sin ampliar L1.

## Snapshot de preparación — anterior a la implementación

**Fase documental; producto sin cambios.** Base exacta `main @ b854db384c952e827b86d1bb35cac7caa70b035a`, tree `81c7cc4ccf80c3188a50281876ef0ed8f427657f`. Main remoto coincide con la base esperada; no hay commits nuevos que incorporar. Rama `codex/b10-pulido-mission`. No se asigna un número de bloque de proyecto no documentado.

## Fuentes y método

Se buscaron `AGENTS.md` en el árbol versionado, checkout y directorios ascendentes: no existe uno aplicable. Se leyeron `CURRENT_WORK_HANDOFF.md`, cierre y handoff B31, Constitución, sistema §6/§7/§10, componentes §13, pantallas, guardrails, decisiones abiertas, roadmap B10, auditoría B24, deuda B26 y política de despliegue. B31 continúa cerrado; esta auditoría no cambia su certificación.

Build local PASS. `node scripts/bundle-report.mjs --json` vuelve a medir el mismo asset de entrada. Auditoría exploratoria con Playwright instalado y Chromium headless shell 1234: 320×568, 390×844, 1440×900 y 390×844 con reduced motion. Se inspeccionan portada, búsqueda global, ficha, ciudad/lista, filtros, Días/herramientas, Reservas, Resumen, Dónde dormir, Quiero ir, Nosotros y preview de backup; primera pantalla de onboarding a 390×844. 53 capturas, cero overflow horizontal y cero `pageerror` en la muestra. No es una auditoría completa AA ni certificación de B10.

El navegador usa un contexto nuevo con lugares reales JP-044, JP-203 y un lugar de Kioto; dos días, fechas y una persona de prueba en el V8 existente. El backup se exporta a un archivo local de esa fixture y se presenta mediante `setInputFiles`; se cancela sin confirmar restauración. Eso **no comprueba el selector de archivos físico ni Safari/iPhone**. No se usan datos del navegador personal. Se espera el montaje lazy de Dónde dormir y dos frames antes de medir.

Evidencia publicada: [resumen y medidas](B10_PULIDO_EVIDENCE.json) y seis capturas en `docs/evidence/b10/`. Logs, runner y datos completos locales: `app/logs/b10-preparation/`; sus hashes están en el resumen. El intento de `agent-browser` falló por certificado TLS de npm; se usó Playwright disponible, sin cambiar TLS, dependencias ni producto. Las peticiones abortadas de OSM (34/83/105 en los contextos normales; 0 en reduced motion) coinciden con navegación/cierre del contexto; ninguna petición local falló. No demuestran caída de OSM ni son una regresión de producto.

## Defectos reproducibles de conformidad

Son incumplimientos de normas existentes, no fallos nuevos atribuibles a B31. No se reproduce un bloqueo funcional P0 en la muestra; tampoco se declara que no pueda existir fuera de ella.

| ID / prioridad | Reproducción y evidencia | Norma / límite |
|---|---|---|
| F-C01 / P1 | Inicio → Tokio → Filtros, sin filtros: «57 de 57 lugares» en 320/390/escritorio/reduced motion. `FilterPanel.tsx:88`; [captura](evidence/b10/390-filters.png). Sigue vigente P2-6 de B24 | `04 §13`: «57 lugares». Cambiar sólo presentación; preservar conteo, filtros y anuncio vivo |
| F-C02 / P1 | Viaje → Días → Herramientas y datos: «Tramo principal…», «ningún tramo entre ciudades», «Duración manual del tramo principal», «Añadir tramo», «0/1 tramo cubierto». `OrderedSequenceBuilder.tsx:598,607,1865,1911,1956,1967`; [captura](evidence/b10/390-day-tools.png), textos completos en el resumen | Art. 7 y `03 §10`: traslado, viaje; la redacción de ausencia tiene que preservar parciales, ámbitos y minutos. No cambiar cálculo ni literales de fuentes |
| F-C03 / P1 | Nosotros: «El recorrido, los días…» (`TravellerManager.tsx:67`). Importar la fixture sin aplicar: «Lugares en el recorrido» (`TripBackup.tsx:225`). [Nosotros](evidence/b10/390-us.png), [preview](evidence/b10/390-backup-preview.png) | Art. 7 / `03 §10`. Etiqueta de backup admite sustitución canónica «Lugares en el viaje»; la frase completa de propiedad compartida necesita revisión de copy, sin cambiar su significado |
| F-M01 / P1 | Portada escritorio: hover de tarjeta de ciudad cambia elevación 1→2 con transición de sombra/borde de 220 ms. Medida before/after en JSON; `discovery.css:1209`, también `:hover`. [portada](evidence/b10/1440-home.png) | `03 §6`: cinco movimientos, prohíbe hover animado general de tarjetas. La auditoría de movimiento debe mapear cada transición al contrato, sin introducir otra animación |

La búsqueda AST es un inventario de candidatos, **no un conteo de defectos visibles**: contiene imports, clases CSS y ramas legacy no recorridas. No se persigue grep cero en comentarios, fuentes, dataset o identificadores internos. `Dato:` sigue resuelto por B31; no se reabre DDR-05.

## Pulido previsto y antecedentes vigentes

| ID / prioridad | Hallazgo actualizado | Trabajo acotado pendiente |
|---|---|---|
| A-01 / P1 condicionado | Colecciones: 32/35/14/75 tarjetas; 64/70/28/150 controles. Tab real desde la primera tarjeta hasta salir confirma exactamente 64/70/28/150 pasos. `ExplorerHome.tsx:197–220`; P2-1 B24 sigue vigente | Resolver acceso entre colecciones conservando apertura y Quiero ir de cada tarjeta. Falta patrón aprobado de salto; no quitar tarjetas ni acciones para reducir el número |
| S-01 / P2 | `App.css` sigue importado por App; alrededor de 7.000 líneas. Scanner sin comentarios: 48 hex literales y 8 queries con `max-width`. Discovery y trip-overview ya tienen CSS separado | Extraer por superficie junto a componentes, mantener orden/cascada y migrar reglas a tokens/min-width. No reescribir de golpe (`08`, «Cómo tratar el CSS actual») |
| M-02 / P2 | Keyframes actuales: `sheet-rise`, `toast-in`, `onboarding-fade`, `card-shimmer`, `place-card-save-mark`; transición de altura de leyenda en `discovery.css:1073`, además de sombras/colores | Mapear intención y disparador; el skeleton es excepción de carga permitida. Un nombre distinto no basta para declarar defecto. Revisar toast/onboarding/leyenda con `03 §6`, sin inventar movimientos |
| M-03 / verificación pendiente | Override global reduced motion (`App.css:3583`): 0,001 ms en las duraciones computadas muestreadas; [captura](evidence/b10/390-reduce-home.png). B31 ya certifica sus superficies | Completar estados de entrada, salida, press, mark y mapas; no convertir esta muestra en certificación global |
| P-01 / P2 | Entrada `index-OVb2DdYf.js`: 1.669.033 B raw; 390.317 B gzip **nivel 9**; 327.016 B Brotli. `photography-metadata.json` aporta 350.724 B rendered según el analizador, import estático `place-images.ts:2`. P2-4/AB-3 B24 sigue vigente | Medir cold/warm y carga por superficie; una propuesta de split debe conservar resolución síncrona identity, galería, créditos, fallback/retry y ausencia de nuevos requests remotos. No equiparar rendered con bytes comprimidos ni elegir una arquitectura en esta fase |
| P-02 / medida sana | Identity 800w: Tokio 3.499.770 B, Kioto 3.499.450 B, Osaka 3.356.478 B, Okinawa 2.903.352 B, Sapporo 166.986 B, Nagoya 69.552 B, Fukuoka 69.284 B. Todos ≤3.500.000 B | Mantener presupuesto; sólo 230/550 B de margen Tokio/Kioto. No implica adquirir/recomprimir fotos en esta misión |
| P-03 / antecedente a comparar | Cierre v1.1.0 (`BLOCK_16_V1_1_RELEASE_CLOSURE.md:95`): 1.389.652 B raw / 253.742 B gzip / 203.791 B Brotli. Frente al registro actual: +279.381 B raw / +136.575 B gzip | No declarar G6 satisfecha frente a v1.1.0 sólo porque el build pasa. Comparar con igual runner/método y atribuir crecimiento a cambios posteriores antes de elegir optimización o proponer excepción; no retirar capacidades ni resetear baseline silenciosamente |
| T-01 / P2 | B26 documenta gates legacy `block1-ux`, `block13`, `block14`, `b18-regression`, `b24-real-input` P0-2 con selectors/expectativas anteriores al shell/B25 | Reproducir cada fallo sobre la base del lote antes de portarlo. Esta fase no los ejecuta ni declara corregidos; no relajar assertions de comportamiento para conseguir verde |

El gzip del build Vite es 394.700 B aproximados y el analizador usa nivel 9 (390.317 B): son métodos distintos sobre el mismo asset, no una mejora de producto. Los avisos de bundle y Fast Refresh PlaceMap son antecedentes; no se atribuyen a esta fase documental.

## Decisiones pendientes, sin resolver por el agente

| Decisión | Evidencia / autoridad | Dependencia |
|---|---|---|
| OD-01: modo oscuro | `09`, «Decisiones abiertas»; B10 lo menciona expresamente | Producto decide implementar o diferir. Ningún theme/toggle nuevo mientras siga abierto; no bloquea el primer lote |
| Orden editorial de colecciones | P2-2 B24: siguen empezando JP-021/JP-007/JP-004/JP-001, todos Tokio; el código filtra conservando orden del dataset | Revisión editorial antes de cambiar orden. No ranking, reparto automático ni modificación del dataset |
| Héroe Tokio repetido | P2-3 B24 confirmado: ciudad Tokio y primer Imprescindible usan `JP-021/tokyo-national-museum-stairs-800w.webp` | Decisión editorial con material ya licenciado; no adquisición automática |
| Acceso de teclado entre colecciones | A-01 confirmado; guardrails requieren revisar cambios de navegación/controles | Definir salto contextual/por encabezados u otro patrón; conservar todos los controles. No se elige patrón nuevo en esta misión |
| Copy no mecánico y colores sin token equivalente | F-C02/F-C03; Art. 4, `03 §10`, guardrails | Revisar frases completas, estados parciales y equivalencias antes de reemplazar; no inventar textos, colores ni suprimir datos |

OD-02/OD-03/OD-04 siguen en su documento original; esta preparación no los resuelve ni convierte cambios de workbook, adquisición fotográfica o tercera persona en B10.

## Deuda externa y comprobaciones físicas

- Safari/iPhone real: selector de archivos, export/import, teclado iOS, gestos/inercia y retorno. **Pendiente humano**, no PASS por Chromium o WebKit.
- Lector de pantalla físico: anuncios, nombres, orden y foco de cada flujo. **Pendiente humano**, no PASS por inspección DOM.
- Fotografías reales de zonas: fallback accesible vigente; cobertura/licencias pertenecen a una decisión de adquisición separada. Excluidas automáticamente de B10.
- Recursos externos y teselas OSM: no se cambian proveedor, TLS ni configuración; B25 conserva antecedente externo 122/123. Fuera del cierre funcional local.
- Flakiness B26 onboarding/foco y B28 auto-scroll: antecedentes documentados; B31 post-merge pasó a la primera. No se han vuelto a ejecutar esos gates completos aquí ni se abre una investigación sin fallo nuevo reproducido.

Esta auditoría precisa una misión; no certifica B10 completo ni modifica las decisiones pendientes.
