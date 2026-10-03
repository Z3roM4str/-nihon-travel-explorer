# Estado operativo B10 — activación diferida de imágenes, 2026-10-03

**INCOMPLETO; #177 Draft, sin merge/deploy.** Lote autorizado en design/09 y ejecutado sobre `f9949325aea83d45907b7310fa635faf7633716b` en `claude/b10-deferred-images`: las fotografías de tarjetas no prioritarias no inician su respuesta hasta estar a ≤ 2 viewports (`IntersectionObserver`, margen 200 %, observadores compartidos y desconectados al activar/desmontar); prioridad, `loading=lazy`, dimensiones, fallback, reintento, créditos y teclado intactos. Código probado `965acc8c9660fe8515ccbadc7f0cf97028a79079`. [Informe](B10_DEFERRED_IMAGES_REPORT.md), [evidencia](B10_DEFERRED_IMAGES_EVIDENCE.json).

G6 fotográfico: guard existente **13/13 Chromium y 13/13 WebKit** (+3 repeticiones por motor); Osaka escritorio **3 356 478 / 3 315 340 B** (antes 3 862 290 B registrado) ≤ 3 500 000 B; el valor 3 862 290 no se reprodujo en el entorno nuevo, sí su clase de fallo con la distancia nativa de carga diferida ampliada (base falla, lote 13/13). Entrada 157 586 B ≤ 253 742. **Sin ventana total ≤ 3,5 MB en navegación inmediata con respuestas de portada en vuelo** (las respuestas tardías se cuentan íntegras; Tokio y Kioto están en el tope sin la portada): decisión de Producto pendiente. Regresión 85 trabajos: 68/68 positivos PASS, 16/17 controles negativos detectados; `negative-scroll-chromium` no detecta su mutante en Chromium 141 (igual sobre la base; la certificación anterior usó 151). F01–F12 NO EJECUTADO; OSM-TLS externo; G4/CSS y OD-01 sin cambios.

---

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

# B10 — Pulido · Misión y ejecución autónoma

## Autorización vigente — ejecución autónoma

La ejecución autónoma ha publicado L2b, movimiento/targets, optimización medida, extracción Sheet y correcciones de scroll/foco del mapa. B10 INCOMPLETO: decisiones editoriales/OD-01, G6 histórico, CSS restante y pruebas físicas siguen pendientes. Alcance, commits, certificación y siguiente paso en el [informe consolidado](B10_AUTONOMOUS_REPORT.md). L1/L2 y evidencia intactos; PR #177 Draft, sin merge/deploy.

**Estado: L1 CONSERVADO; L2 IMPLEMENTADO Y VERIFICADO EN SU ALCANCE. B10 INCOMPLETO; PR #177 Draft.** [Certificación acotada](B10_L1_CERTIFICATION.md), [evidencia L1](B10_L1_EVIDENCE.json). HEAD documental inicial `2bbc09d63be2abe03b17aea8796274251425d32f`; implementación `3ac50d11392dce7635232a18baf4530f38895d10`.

Base exacta: `main @ b854db384c952e827b86d1bb35cac7caa70b035a`, tree `81c7cc4ccf80c3188a50281876ef0ed8f427657f`; remoto verificado sin avance. Rama `codex/b10-pulido-mission`, creada desde esa base. B31 / B9.5 sigue cerrado (#175). [Auditoría](B10_PULIDO_AUDIT.md), [medidas/evidencia](B10_PULIDO_EVIDENCE.json). No se presupone un número de proyecto para B10.

Main avanzó externamente a `5498756b` (#178–#181). Esta certificación permanece sobre b854/a6ec57c8; **#177 requiere reconciliación comparativa antes de integrar**. [Inventario y recomendación](B10_AUTONOMOUS_REPORT.md#avance-concurrente-de-main-detectado-al-cierre).

## Objetivo y límites

Cerrar incumplimientos concretos de presentación y completar los seis trabajos expresamente definidos en `10_ROADMAP_DE_BLOQUES.md §B10`: movimiento, accesibilidad, rendimiento/imágenes, extracción final de App.css, microcopy y decisión OD-01. Conservar la navegación y capacidades de `05 §12`, los cálculos existentes, identidad de día, almacenamiento V8 y los contratos B27–B31. B10 no autoriza un rediseño general.

La preparación inicial sólo publicó documentos, medidas y capturas. La instrucción posterior autorizó **L1 exclusivamente**: contador de FilterPanel y etiqueta de TripBackup, con cobertura proporcional y evidencia separada. Se implementaron ambas sustituciones documentadas; no se cambian CSS, gates existentes, dependencias, datasets ni assets de producto. Los lotes restantes siguen siendo propuestas y requieren autorización posterior. Una decisión pendiente sólo detiene el trabajo que depende de ella.

Fuera de alcance: pantallas nuevas, destinos/controles permanentes nuevos, cambio de modelo o navegación, optimización/recomendación de itinerarios, sincronización/backend, nuevos providers, adquisición fotográfica, fotografía de zonas, cambios de teselas/OSM, Astra, ramas `claude/*`, #168 y Vercel/deploy. No se usa una rama alternativa como base ni se altera el freeze de despliegue.

## Prioridades y lotes propuestos

| Lote / prioridad | Alcance concreto | Archivos previstos / condición |
|---|---|---|
| L1 / P1, implementado y verificado en su alcance | F-C01 y la etiqueta simple de F-C03: «N de M lugares» → «N lugares»; «Lugares en el recorrido» → «Lugares en el viaje». Pluralización «1 lugar». Ningún cálculo, acción, estructura o estilo cambia | `app/src/components/FilterPanel.tsx`, `TripBackup.tsx`; cuatro pruebas renderizadas y runner browser. [Certificación L1](B10_L1_CERTIFICATION.md); no cierre global G5/G6 |
| L2 / P1, implementado; alcance fijado antes de editar | Sólo copy contextual F-C02/F-C03: clasificar equivalencias canónicas, términos válidos por contexto y decisiones editoriales. Ejecutar sólo C01–C03; F-M01/movimiento excluido por la instrucción actual | [Matriz y alcance L2](B10_L2_COPY_SCOPE.md). OrderedSequenceBuilder: empty, añadir y nombre accesible/title de baja; principal/manual y parciales conservados. TravellerManager pendiente de decisión; sin cambio |
| L3 / P1 condicionado | Auditoría accesible por pantalla y estados; A-01 sin reducir capacidad ni esconder controles; foco visible, nombres/announcements, tamaños efectivos, contraste y zoom | `ExplorerHome.tsx`, `PlaceCard.tsx` y componentes que la evidencia señale. Patrón de salto de colecciones aprobado antes de implementarlo. No se añaden dependencias visuales |
| L4 / P2, por superficie | Extraer CSS, preservar precedencia y comentarios útiles, mapear a tokens y mobile-first. Inventario → extracción de **una superficie** → comparación antes/después → commit; repetir hasta retirar import/archivo App.css | `App.css`, import en `App.tsx`; CSS junto a `Sheet`, `PlaceDetail`/galería, `ZoneComparison`, `TravellerManager`/`TripBackup`, `OrderedSequenceBuilder`, shell y demás dueños. No crear todos estos archivos en un solo lote ni cambiar valores para simplificar. `tokens.css` sólo para equivalencias expresamente aprobadas |
| L5 / P2 | P-01/P-02: medición cold/warm y por superficie, presupuesto identity por hub, propuesta de carga de metadatos con compatibilidad síncrona | `scripts/bundle-report.mjs`, `src/data/place-images.ts` y tests de fotografía/arquitectura sólo si la optimización elegida lo requiere. Primer paso es medir; no se decide split aquí ni se elimina información |
| L6 / cierre | Contrastar seis objetivos, revisar sólo gates históricos reproducidos T-01, registrar OD-01 como decisión implementada o diferida expresamente por Producto y excepciones físicas/externas | Auditoría/certificación/handoff documental; cada port de gate identifica contrato vigente y conserva comportamiento. No tratar un selector obsoleto como regresión ni un fallo de producto como obsolescencia sin evidencia |

Las decisiones editoriales de orden/héroe de colecciones permanecen fuera de los lotes ejecutables hasta una revisión explícita. Su aceptación futura puede usar fotografías existentes; no implica adquirir nuevas. El primer lote no depende de esas decisiones ni de OD-01.

## Primer lote de implementación — L1 ejecutado

**L1: dos componentes, sólo dos patrones de microcopy.** Cambiar el contador visible/anunciado de filtros manteniendo `resultCount`, `totalCount` y filtros intactos; cambiar sólo la etiqueta del resumen previo de backup. Verificar 0/1/57 resultados y un backup con lugares, sin confirmar importación salvo en fixture de prueba. Nada de extracción CSS, movimiento, colecciones, copy extenso ni carga de datos en ese lote.

Criterios L1:

1. Contador «0 lugares», «1 lugar», «57 lugares», vivo al cambiar filtros; botón «Ver N lugares» y resultados siguen coincidiendo. No se cambia qué lugares pasan un filtro.
2. Preview de backup conserva exactamente números, fechas, avisos y sustituir/cancelar; sólo la etiqueta es «Lugares en el viaje». Export/import y V8 no cambian.
3. Recorrido de teclado y foco antes/después de cancelar intactos; sin nuevas escrituras al consultar; sin overflow a 320/390/escritorio.
4. Diff limitado a esas presentaciones y, si procede, expectativas existentes justificadas. F-C02, la frase larga F-C03, A-01 y los demás lotes siguen explícitamente pendientes; L1 no se presenta como cierre de B10.

Comprobaciones L1 proporcionales: build/lint y `git diff --check`; suite Vitest completa por G1 (base B31: 115 archivos/3479 tests, número que deberá actualizarse si cambia la suite), pruebas existentes de filtros/backup pertinentes; browser filtros 0/1/N y preview/cancel de backup a 320×568, 390×844 y 1440×900; B26 Chromium/WebKit para Nosotros/backup. No repetir todos los gates B27–B31 por texto de dos componentes si no hay cambios ni una incidencia que lo justifique. No añadir tests que sólo dupliquen literales sin comprobar comportamiento.

Resultado L1: build/lint PASS; Vitest **116 archivos/3483 tests PASS**; B26 **314/314 por motor**; matriz antes/después de 15 estados por versión y cero overflow/pageerror en la muestra. 0/1/57/reset y etiquetas/números/fechas/cancelación/foco/V8 conservados. Cromo 390: 104/160 px. F-A02 nuevo antecedente medido: los summary de filtros miden 42 px también en base; pendiente L3, sin cambiar el lote. P-03 histórico sigue abierto y Brotli aumenta 181 B frente a base aunque raw/gzip disminuyen. No se declara G5/G6 global ni B10 completo; detalles e intentos en la certificación.

## Aceptación global de B10

- Microcopy: ningún término prohibido de producto en texto visible o nombre accesible alcanzable (`03 §10`, Art. 7); preservar literal de fuente entre comillas/evidencia y excluir imports, clases, fixtures y comentarios del criterio. Inventario de ramas legacy: probar alcanzabilidad antes de cambiar/eliminar; ninguna retirada de capacidad encubierta.
- Movimiento: cada movimiento mapeado a uno de los cinco del sistema, con excepción de skeleton documentada; reduced motion sin transformaciones animadas y ≤100 ms. Mapas y gestos conforme a contratos existentes. Nada de nuevos movimientos ni valores.
- Accesibilidad: teclado completo y vuelta de foco por pantalla/estado, tamaños efectivos ≥44 px (primarias ≥48), contraste 4,5:1/3:1, zoom/reflow, anuncios pertinentes. No afirmar certificación completa desde una lista de nodos o una emulación.
- CSS: App.css retirado al completar las migraciones por superficie; sin reglas duplicadas, sin nuevos tokens/valores sin revisión, cero hex fuera de tokens, cero max-width restantes en superficies migradas y cero text-shadow. Preservar comportamiento a ambos lados de cada breakpoint existente.
- Rendimiento: baseline actual raw/gzip con compresión idéntica; no empeorar entrada frente a la base certificada ni el presupuesto contractual histórico. Las medidas actuales no sustituyen v1.1.0 como guardrail: P-03 registra crecimiento respecto al cierre histórico y exige comparación con igual runner antes de declarar G6 cumplida. Cualquier excepción requiere decisión expresa; no se resetea baseline ni se retiran capacidades para alcanzar un número. Identity 800w ≤3.500.000 B por hub; sin requests extra de galerías en listas ni pérdida de créditos/fallbacks.
- Decisiones: OD-01 y decisiones editoriales/teclado/copy sin resolver se enumeran; cerrar o diferir mediante decisión explícita de su autoridad, nunca inferirla. No declarar B10 completamente cerrado mientras objetivos normativos o decisiones necesarias carezcan de resolución.
- Física/externalidad: Safari/iPhone real y lector de pantalla físico permanecen pendientes hasta evidencia humana real. Fotografías de zonas y OSM/recursos externos se registran como deuda separada; no forman automáticamente parte de esta misión.

## Estrategia de comprobación y publicación

Para cada lote: build/lint, Vitest completo por G1, diff check y G2–G7 aplicables a la superficie. Capturas 390×844/1440×900, y 320×568 cuando cambien medidas, teclado, cromo o planner; geometría/cromo ≤112/168 px. Añadir casos de error, vacío y parciales relacionados con el cambio. Contraste sobre píxeles compuestos en fotos, no sólo color declarado.

CSS de shell/ficha/planner requiere gates vigentes de las superficies afectadas (B18/B19/B20, B25/B26, B27/B28/B29, B30/B31 ambos motores según el diff); cambios de carga fotográfica requieren suites de fotografía, arquitectura, presupuestos y galerías/retry. No ampliar/repetir la matriz una vez verde sin cambios, fallos o incertidumbre nueva. Un fallo de gate legacy se compara con la base del lote y sus selectores; una intermitencia se repite sin cambiar código, se conserva cada intento y, si reaparece, se compara contra baseline. No falsear verde ni relajar contratos.

Publicación L1: implementación y cobertura en un commit; documentación/evidencia en otro. Antes de publicar, comprobar diff limitado al lote y docs, enlaces/hashes, rama/base, main remoto y #168; push normal a la misma rama, sin merge, squash, rebase ni force-push. PR #177 sigue Draft mientras B10 esté incompleto. Ningún otro lote queda autorizado por esta certificación.

La implementación posterior volverá a verificar main remoto. Si avanzó, inventariar commits/diff y crear el lote desde la base vigente; no sobrescribir cambios ni arrastrar código desde otra línea. Conservar esta auditoría como snapshot de la base citada y recertificar sólo lo que el nuevo diff afecte.

## Resultado L2 — copy contextual, sin cierre de B10

Desde `20bdf2d16ccfefccae5626880c0246c385c87aa1`, implementación `ebcb6fc5fe8cedbad8edae1ec8939447cccaa08f`: cuatro cadenas canónicas (vacío, alta, aria-label/title de baja). [Matriz](B10_L2_COPY_SCOPE.md), [certificación acotada](B10_L2_CERTIFICATION.md), [evidencia](B10_L2_EVIDENCE.json). Principal/manual, pares desconocidos y razones de ruta conservados; E01–E04 pendientes. L1 y sus 47 archivos/41 hashes intactos. Build/lint y 116/3483 tests PASS; Chromium/WebKit 60 estados; B26 314/314 por motor, B27 A–K, B29 163/B28 64 en última pasada. Intentos fallidos conservados, sin relajar gates ni declarar toda intermitencia heredada. G5/G6 globales siguen abiertos. Siguiente L2b: decisiones documentales/editoriales de E01–E04 antes de otra implementación. PR #177 Draft, sin merge/deploy ni consulta de protección de main.
