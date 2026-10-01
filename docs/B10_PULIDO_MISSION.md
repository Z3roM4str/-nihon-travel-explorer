# B10 — Pulido · Misión y ejecución autónoma

## Autorización vigente — ejecución autónoma

La ejecución autónoma ha publicado L2b, movimiento/targets, optimización medida, extracción Sheet y correcciones de scroll/foco del mapa. B10 INCOMPLETO: decisiones editoriales/OD-01, G6 histórico, CSS restante y pruebas físicas siguen pendientes. Alcance, commits, certificación y siguiente paso en el [informe consolidado](B10_AUTONOMOUS_REPORT.md). L1/L2 y evidencia intactos; PR #177 Draft, sin merge/deploy.

**Estado: L1 CONSERVADO; L2 IMPLEMENTADO Y VERIFICADO EN SU ALCANCE. B10 INCOMPLETO; PR #177 Draft.** [Certificación acotada](B10_L1_CERTIFICATION.md), [evidencia L1](B10_L1_EVIDENCE.json). HEAD documental inicial `2bbc09d63be2abe03b17aea8796274251425d32f`; implementación `3ac50d11392dce7635232a18baf4530f38895d10`.

Base exacta: `main @ b854db384c952e827b86d1bb35cac7caa70b035a`, tree `81c7cc4ccf80c3188a50281876ef0ed8f427657f`; remoto verificado sin avance. Rama `codex/b10-pulido-mission`, creada desde esa base. B31 / B9.5 sigue cerrado (#175). [Auditoría](B10_PULIDO_AUDIT.md), [medidas/evidencia](B10_PULIDO_EVIDENCE.json). No se presupone un número de proyecto para B10.

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
