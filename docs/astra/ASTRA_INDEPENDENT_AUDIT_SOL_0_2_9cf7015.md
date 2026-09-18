# TRACK: ASTRA — Auditoría independiente SOL-0–SOL-2

MODEL ROLE: ASTRA DIRECTOR

**Veredicto: FAIL. Auditoría cerrada; implementación no aprobada. SOL-3 no autorizado.**

Fecha: 2026-09-18. SHA de producto auditado: `9cf70156fcff41b09b2123e9cfd5452816c91b99`.
PR [#122](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/122), rama `codex/continuar-proyecto-z3rom4str-desde-astra-redesign`.
Resultado: **0 P0 reproducidos, 8 P1 y 1 P2** en el alcance implementado. No se implementaron correcciones de producto.

## Identidad, autoridad y preservación

- Checkout inicial: rama y HEAD exactamente iguales a los solicitados. PR abierto, sin merge, base `experiment/astra-redesign` (`b986a60dc5c115e76af45fd53f8dfd9b7e46d448`). Base estable `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` confirmada como ancestro.
- Estado preexistente: únicamente `?? phase3b2b-run-audit/` y `?? worktree/`. No se leyeron ni modificaron sus contenidos. No se inspeccionó Claude, modificó main, hizo merge, adquisición o despliegue.
- Leídos DESIGN_AUTHORITY, SOL_IMPLEMENTATION_PLAN, ASTRA_AUDIT_CHECKLIST, SOL_HANDOFF, ambos informes anteriores y PLAYWRIGHT_AUDIT_RUNNER. Los handoffs históricos no certifican este HEAD.
- `git diff` contra la base estable no presenta cambios en `data/`, `app/src/data/`, fotografías locales ni workbooks. El catálogo conserva 214 lugares y 403 relaciones. Los módulos V7 y galería heredada no cambian en el diff del PR.
- **Rectificación de autoridad:** el primer `ASTRA_AUDIT_SOL_0_2.md` pidió retirar los créditos de entre fotografía y cuerpo. Esa instrucción contradice DA-06, que explícitamente los coloca justo debajo del marco. Se retira aquella interpretación; no se modifica retroactivamente el informe histórico. La referencia renderizada también coloca allí los créditos. La lista numerada del cuerpo de tarjeta no anula la regla específica de atribución.

## Evidencia y método

Directorio versionado: [evidence/independent-9cf7015](evidence/independent-9cf7015/README.md). Sus JSON registran entradas, observaciones y límites, no una certificación automática.

- Actions [35355643803](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/35355643803): SUCCESS, job `105634210906`, ocho journeys PASS.
- Artefacto `10552290075`, `astra-sol-0-2-9cf70156fcff41b09b2123e9cfd5452816c91b99`, 43,995,842 bytes. ZIP descargado y SHA-256 verificado: `ff4b8eccd29e43ac1835c3a27f971f553207d9cbe3f72467d80def1621a93a0d`. Caduca en Actions el 2026-10-02.
- Se inspeccionaron las 15 capturas del artefacto: siete tamaños, final de viewports y siete finales restantes. Se revisaron recortes legibles de la parte superior y vistas completas reducidas, sin interpretar fotografías lazy aún no solicitadas fuera del viewport como fallo de carga.
- Se inspeccionaron los ocho traces: llamadas, estados/snapshots, errores y red. [trace-review.json](evidence/independent-9cf7015/trace-review.json) registra hashes, 86/16/23/39/99/23/9/139 snapshots respectivamente y todos los assets solicitados. No hubo errores de llamadas en esos traces. No se confunde el nombre de un journey con acciones que no ejecuta.
- Navegador local: Microsoft Edge `153.0.4234.32`, Playwright instalado en `app/node_modules`, Windows, contextos de prueba aislados. `agent-browser` no estaba instalado; se reutilizó Playwright y Edge existentes, sin instalación ni reconstrucción de infraestructura.
- Se sirvió `app/dist` existente con Vite preview; nombres de JS/CSS coinciden con el artefacto (`index-BG4QJj8X.js`, `index-BmUpoEhL.css`). [bundle-identity.json](evidence/independent-9cf7015/bundle-identity.json) registra hashes locales. El trace no conserva el cuerpo del JS inicial: no se afirma una comparación byte a byte del JS contra CI.
- Referencia existente servida con su comando Vite documentado, capturada e inspeccionada a 390, 768, 1024 y 1440. No se transformó en aplicación ni se copiaron sus omisiones como requisitos.
- Perfil de producto: `Mis gustos`, adaptador transitorio de una persona; preferencias, alojamiento y minutos introducidos son **fixtures**, nunca recomendaciones reales o elecciones atribuidas al usuario.

## Disposición por bloque

| Bloque | Resultado | Alcance y razón |
|---|---|---|
| SOL-0 | PARTIAL | Ya existe inspección independiente de producto actual, referencia, tamaños y traces. No hay certificación retrospectiva de todos los estados del baseline original ni lector de pantalla humano. |
| SOL-1 | FAIL | Regiones pierde origen tras recarga; retorno desde cercanos pierde foco; confirmación y anuncio accesible tienen defectos. |
| SOL-2 | FAIL | Atribución y recomendación contradicen DA; texto aumentado se solapa; permanece el mensaje visual de carga. |

## Matriz de aceptación aplicada

| Criterio / estado probado | Resultado | Esperado / observado / disposición |
|---|---|---|
| PRE-01, DATA-01, IMG-05 | PASS | Identidad y bases correctas; sin cambios canónicos ni en exclusiones. Preservar estos mismos bytes. |
| NAV-01; VIS-02 geometría básica | PASS | Dos destinos; 1/2/3 columnas. Headers medidos 56/64/72 px. Marcos 4:3, sin overflow horizontal en los siete tamaños. No equivale a PASS de toda la fidelidad. |
| VIS-01, REC-01, CARD-01, IMG-02 tarjeta | FAIL | DA-06/07 versus créditos al pie, metadatos incompletos y badges/copy distintos. F01/F02. |
| NAV-03 entrada secundaria | FAIL | Regiones accesible, pero cuarto control separado en vez de opción del hub. F03. |
| DIS-01 orden/paginación | PASS parcial por subcriterio | Orden fuente grado/round-robin/ID; 12→24 mantiene foco en botón y emite una vez `Resultados 13–24 añadidos`. Otras opciones futuras de orden no quedan certificadas aquí. |
| DIS-02 vocabulario | PASS | Catálogo de 214 preservado; cuatro D visibles y estados sin foto presentes. No se ocultó D para resolver vacíos. |
| CARD-02 / IMG-04 retry | PASS para separación y recuperación | Trace 06 aborta JP-001 exactamente una vez y recupera el mismo URL con segundo request; sin `a button`, sin detalle accidental. Mensaje de carga residual: F09. |
| PLAN-01 / VOTE-05 preservación V7 | PASS para regresión SOL-2 | Fixture aceptada por parser V7, dos días estables, fechas, hora, alojamiento, leg y segmento activo. Siete checkpoints byte-equivalentes y mismos guardados. No certifica toda operación del planner. |
| A11Y-02 confirmación protectora | FAIL | Datos intactos, pero Shift+Tab/Tab salen del alertdialog. F04. |
| NAV-02, 24 resultados + cercano | PASS para URLs/scroll; FAIL para foco | JP-089→JP-092 real y JP-089→JP-021 fixture interhub: Back/Forward preservan 24 IDs y scroll 9841; retorno final enfoca BODY. F05. |
| FIL-01 / NAV-02 dos categorías + D + duración + recommended | PASS para serialización y persistencia probada | D solo da cero resultados válidos. Variante D+S conserva D y permite probar detalle sobre JP-021; seis selecciones sobreviven detalle, Regiones, recarga en Explorar y Back/Forward. No son cuatro grupos contados correctamente todavía; rediseño de conteo/draft corresponde a SOL-6. |
| NAV-02 recarga dentro de Regiones | FAIL | `Volver a Explorar` pierde hub/query/grado/página: 3 resultados → 214. F06. Back del navegador sin ese enlace sí conserva el hash anterior en las pruebas. |
| A11Y-02 detalle/filtros/lightbox | PASS para teclado probado | Detalle 30 Tab + 30 Shift+Tab; filtros 35 + 35 y Shift+Tab inicial, sin fuga. Lightbox real: ambos sentidos permanecen en cierre; primer Escape vuelve a Ampliar, segundo al enlace abridor. |
| A11Y-03 anuncios de resultados | FAIL | Un evento debounced en DOM, pero con filtros abiertos el propietario está inert y desaparece del árbol AX. F07. |
| VIS-03 320 CSS px / zoom nativo 200% | PASS para casos medidos | 320×800 normal sin overflow; zoom nativo comprobado por DPR 1→2 y ancho CSS 1396→698, una columna, CTA visible y alcanzable al desplazar. |
| VIS-03 / CARD-03 texto solamente 200% | FAIL | En 320×800, fuente de título 40px con line-height 25px; líneas de Tokyo National Museum se superponen. F08. |
| PERF-01 carga diferida | PASS para recorrido de CI | Traces iniciales sin chunks mapa/planner ni tiles; trace 07 solicita mapa y contenedor al pulsar Mapa. Sin reconstruir bundle ni afirmar nueva puntuación de dispositivo. |
| QA-01 / QA-02 | PARTIAL / FAIL | Build y ocho journeys de este SHA comprobados en Actions. No se vuelven a presentar Vitest/lint/validators históricos como recién ejecutados. Capturas inspeccionadas muestran defectos; verde de CI no otorga aprobación. |
| A11Y-01, A11Y-04; todos los lectores/dispositivos | PARTIAL | Sin medición completa de todos los contrastes/targets, teclado virtual/safe area físico ni lector de pantalla humano. Árbol AX y teclado automatizado son evidencia acotada. |

### Límites que cambian la interpretación del runner

1. CI V7 tiene `days:null` y arrays vacíos de alojamiento/segmentos; comprueba bytes **antes** de cancelar, no después. La prueba independiente sí cubre cancelación en tarjeta y viaje, recarga y apertura del planner. [v7-checkpoints.json](evidence/independent-9cf7015/v7-checkpoints.json) contiene siete `same:true`; el planner muestra `Activo · entre Día 1 y Día 2`, Tokio→Kioto, 140 minutos y 15 minutos de alojamiento. Fixture JP-021/JP-054 válida, en [v7-valid-fixture.json](evidence/independent-9cf7015/v7-valid-fixture.json).
2. CI history nunca pulsa un cercano; su journey modal nunca abre una foto ampliada. Esas omisiones son limitaciones de test, no fallos del producto por sí mismas.
3. No existen aristas interhub en las 403 relaciones reales. Para comprobar la capacidad del router se sustituyó **sólo en la respuesta JS de un contexto de prueba** JP-089→JP-092 por JP-089→JP-021. Una sustitución verificada; ningún archivo/dataset editado. No se certifica esa relación como geografía real. El salto real dentro de Kioto y el interhub controlado produjeron el mismo fallo de foco.
4. Los cuatro D tienen reserva `No`. D+recommended debe dar cero: no se inventó un resultado para abrir detalle. Se verificó ese vacío y después se añadió S **conservando D**, categorías Templos/Museos, duración medium y recommended. Un resultado JP-021, mismas selecciones tras todo el recorrido.
5. Map/list en CI compara número de marcadores, no identidad de cada ID. Se acepta como prueba de cantidad de esa fixture, no demostración exhaustiva de paridad de IDs.
6. Full-page screenshots muestran navegación fija a la altura del viewport inicial y fotos lazy fuera de vista. Eso no prueba por sí solo que el pie tape permanentemente una tarjeta ni que una foto haya fallado. El overlay `Cargando…` sobre `data-state=loaded` sí es un fallo reproducido aparte.
7. Zoom por teclado no actuó en headless. CSS `zoom:2` fue exploratorio y **se excluye del veredicto de zoom nativo**. La prueba válida usa un perfil temporal con zoom nativo 200%, `partition.default_zoom_level.x`, conforme al [código de Chromium](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc). Se validaron DPR, ancho CSS y captura CDP `fromSurface:true`. Las primeras capturas de Playwright recortadas y las de `fromSurface:false` blancas son limitaciones de captura, no defectos de Nihon.

## Hallazgos entregados a SOL

### F01 — P1 — CARD-01 / IMG-02 — Créditos fuera de posición e incompletos

- **Bloque:** SOL-2; `PlaceCard.tsx`. Aplicable ahora.
- **Evidencia:** siete capturas `01-*-top.png`, `local-card.png`, `focused-observations.json/local-card`; children frame→body→credit. JP-021 muestra Commons, Kestrel, CC BY-SA 4.0 y un único enlace a la fuente.
- **Esperado:** DA-06 créditos inmediatamente debajo del marco; DA-08 todos los metadatos del asset accesibles desde esa superficie.
- **Observado:** disclosure después de Quiero ir; no enlace de licencia, título original, attributionTitle cuando exista, procesamiento ni recorte de visualización. El detalle sí presenta varios de esos campos, lo cual no satisface la tarjeta.
- **Impacto/severidad:** jerarquía y contrato de atribución incumplidos. P1, no P0: existe crédito/fuente/licencia identificada y no se comprobó sustitución de asset, falsificación o pérdida de metadatos. No constituye dictamen jurídico sobre licencias.
- **Corrección exacta:** mover disclosure entre frame y body; reutilizar la presentación de atribución existente para todos los campos disponibles, manteniendo la acción como hermana del enlace de detalle. No cambiar metadatos ni adquirir fotos.
- **Aceptación:** abrir créditos de JP-021 desde tarjeta en 390/768/1440; verificar orden y valores contra registro, enlace de licencia y procesamiento; asset con attributionTitle lo conserva; error de foto mantiene créditos y retry independiente.

### F02 — P1 — REC-01 / VIS-01 — Recomendación S y vocabulario editorial

- **Bloque:** SOL-2; `recommendation.ts`, `PlaceCard.tsx`, `astra.css`.
- **Evidencia:** badge S sin icono, color `rgb(36,90,71)` y fondo `rgb(230,241,233)`, iguales a A. Referencia renderizada muestra estrella y fondo neutro. `grade-d.png` y `final-probes.json` muestran los cuatro D como `Interés específico`.
- **Esperado:** DA-07 S `Imprescindible`, estrella, ink/subtle y bold; A `Muy recomendable`, B `Recomendable`, C `Opcional`, D `Prescindible`, desconocido `Sin clasificación`, cada icono indicado.
- **Observado:** A `Muy recomendado`, B `Recomendado`, C `Vale la pena si encaja`, D `Interés específico`, desconocido `Sin valoración editorial`; todos sin icono. No se limita a una variación cromática de S.
- **Impacto/severidad:** cambia el significado editorial, especialmente D, y borra la diferenciación S/A. P1 de SOL-2; el badge crudo del detalle heredado se trata aparte como SOL-3 aplazado.
- **Corrección exacta:** adapter único con copy/icono/tratamiento de la tabla DA-07, iconos SVG decorativos y texto accesible; nunca convertir D en turismo extremo ni cambiar el dato.
- **Aceptación:** fixtures S/A/B/C/D/unknown con texto exacto; S estrella ink/subtle y A check-circle together/together-soft; inspección visual y computed styles, no sólo prueba de string.

### F03 — P1 — NAV-03 / DA-05 — Regiones como cuarto control

- **Bloque:** SOL-1/2; `.astra-quick` en Discovery.
- **Evidencia:** capturas de todos los tamaños; `<a href="#/regiones">` hermano de Hub, Experiencias y Filtros. En móvil ocupa otra fila antes de resultados.
- **Esperado:** tres controles rápidos; entrada `Explorar por región` dentro del selector/menú de hub, después de los siete hubs con sus cantidades.
- **Observado:** cuarto control independiente y hub nativo sin esa entrada ni cantidades.
- **Impacto/severidad:** incumple la jerarquía de navegación ya implementada y desplaza descubrimiento en móvil. P1 de fidelidad/IA, aunque regiones sigue siendo alcanzable; no es función ausente ni P0.
- **Corrección exacta:** integrar la entrada secundaria y cantidades en el control de hub conservando los siete valores y comportamiento de filtros; retirar el enlace independiente. Sin rediseñar mapa o regiones.
- **Aceptación:** 390/768/1440, teclado y puntero: abrir hub→regiones, volver con filtros, siete hubs accesibles y sólo tres controles rápidos.

### F04 — P1 — A11Y-02 — La confirmación que protege el plan no contiene el foco

- **Bloque:** SOL-2; `plannedRemoval` en App.
- **Evidencia:** `extended-observations.json/v7-valid-active.focus`: desde Mantener guardado, Shift+Tab enfoca `Ver 12 más` detrás; tras Ir a Planificar, Tab llega a BODY. El V7 permanece intacto.
- **Esperado:** DA-13 dialog modal con fondo inert, trap en ambos sentidos, Escape/cancelación no destructiva y restauración al abridor.
- **Observado:** `role=alertdialog`/`aria-modal` y autoFocus sin aislamiento ni trap equivalentes al wrapper del detalle.
- **Impacto/severidad:** flujo primario de guardado/protección inaccesible por teclado; P1, no fallo de conservación P0.
- **Corrección exacta:** montar la confirmación con el primitive modal existente adaptado a alertdialog y propietario superior de teclado; mantener exactamente el guard de V7.
- **Aceptación:** repetir fixture completa, dos vueltas Tab/Shift+Tab sin salir, Escape equivale a Mantener, foco regresa a la tarjeta/Quitar; siete checkpoints de V7 y guardados siguen idénticos.

### F05 — P1 — NAV-02 / A11Y-02 — El retorno desde cercanos pierde el abridor

- **Bloque:** SOL-1; `App.openPlace`, estado `opener`.
- **Evidencia:** `extended-observations.json/interhub-fixture-24`: JP-089, scroll 9841 y 24 tarjetas → JP-021 → Back→Back. URL, IDs y scroll correctos, foco BODY. También reproducido JP-089→JP-092 con datos reales.
- **Esperado:** historial local por capas; al abandonar toda la cadena, foco en el enlace original de Nijō Castle, no en un nodo desmontado.
- **Observado:** cada cercano reemplaza el único `opener` con un botón del detalle que después desaparece.
- **Corrección exacta:** preservar el abridor de exploración durante la cadena y asociar abridores a entradas cuando corresponda; al cerrar, resolver nodo vivo por ID o heading de resultados como fallback. No tocar las relaciones.
- **Aceptación:** 24 resultados, título original enfocado, cercano, Back dos veces y Forward dos veces; URLs/IDs/scroll y foco correcto en cada cierre, con fixtures real e interhub claramente separadas.

### F06 — P1 — NAV-02 — Regiones pierde el origen al recargar

- **Bloque:** SOL-1; `lastExplore` y enlace de retorno en App.
- **Evidencia:** `extended-observations.json/regions-reload-origin`: origen `#/explorar?hub=Kioto&q=templo&page=2&grade=S`, 3 resultados; entrar en Regiones, recargar, retorno href `#/explorar`; aparece catálogo 214/12 tarjetas.
- **Esperado:** preservar filtros/hub/página/origen cuando se regresa de superficie secundaria, también tras recarga.
- **Observado:** `lastExplore` existe sólo en memoria y se reinicia a EMPTY al arrancar en `#/regiones`.
- **Corrección exacta:** persistir origen tipado en history/session por entrada y leerlo al montar Regiones; retorno directo sin origen mantiene fallback honesto. Evitar un estado global que sobrescriba otras entradas.
- **Aceptación:** repetir con dos categorías, D+S, medium/recommended y hub/query en variante compatible; recargar **dentro** de Regiones, usar enlace de retorno y Back/Forward; mismo hash y selecciones, página y scroll cuando aplicable.

### F07 — P1 — A11Y-03 — Anuncio debounced eliminado del árbol accesible

- **Bloque:** SOL-1/2, corrección de accesibilidad ya implementada; Discovery + RouteDialog.
- **Evidencia:** `focused-observations.json/announcements`: tres teclas producen una mutación a ~212 ms del último input con filtros cerrados; con filtros abiertos, una a ~215 ms pero `inert:true`. `extended-observations.json/live-ax`: un status AX antes, **cero** con el diálogo abierto; un status DOM existe en ambos casos.
- **Esperado:** exactamente un anuncio accesible debounced por resultado, también al escribir en la búsqueda del diálogo.
- **Observado:** `#astra-content` inert contiene el único live region; el panel visible tiene `announceResults=false`. No es duplicación, es pérdida del anuncio.
- **Corrección exacta:** trasladar la propiedad del live region a la capa activa (o a un contenedor vivo correctamente expuesto fuera del fondo inert), manteniendo 200ms y un único propietario. No reactivar dos anuncios simultáneos.
- **Aceptación:** tres caracteres rápidos dentro/fuera del diálogo; una mutación final ≥200ms después del último cambio, un status accesible en AX; lector humano anuncia una vez. Paginación conserva su único anuncio de rango y foco. Sin lector humano, la comprobación de voz queda PARTIAL.

### F08 — P1 — VIS-03 / CARD-03 — Texto al 200% con líneas superpuestas

- **Bloque:** SOL-2; tipografía de tarjeta.
- **Evidencia:** `text-200-card.png`, `extended-observations.json/text-200-320`. Método explícito: multiplicar las fuentes computadas de los elementos existentes por dos, sin cambiar viewport, alturas de línea ni estilos de layout. Es prueba de aumento sólo de texto, no zoom de página.
- **Esperado:** DA-06/13 títulos legibles, crecimiento vertical y sin clipping al aumentar texto.
- **Observado:** Tokyo National Museum ocupa tres líneas que se superponen: fuente 40px con line-height fijo 25px. Descripción 32px/24px queda clampada a 48px pese a scrollHeight 129px. No hay overflow de página y el botón permanece, lo que no hace legible el título.
- **Impacto/severidad:** contenido primario ilegible al aumentar texto; P1. El zoom nativo 200% **sí pasó** el caso medido y no se presenta como fallo.
- **Corrección exacta:** alturas de línea relativas compatibles con la escala y crecimiento del título; no forzar recorte en modo de texto aumentado. Evitar alturas máximas que oculten nombre/acción; no reducir la fuente para acomodarla.
- **Aceptación:** 320 y 390 CSS px, sólo texto 200% y zoom nativo 200% por separado; título largo sin solapamiento, CTA y créditos accesibles; conservar 1/2/3 columnas a escala normal. Repetir también en navegador con función nativa de zoom sólo de texto para ampliar evidencia entre motores.

### F09 — P2 — IMG-04 — Mensaje visual de carga sobre foto ya cargada

- **Bloque:** SOL-2; PlaceCard y estilo de `.astra-card__loading`.
- **Evidencia:** capturas CI 1440/768/1024 y retry 06; `focused-observations.json/local-card`: `data-state=loaded`, `naturalWidth=1600`, loader `aria-hidden=true` pero `display:grid`.
- **Esperado:** skeleton/mensaje sólo durante carga; éxito muestra únicamente la foto.
- **Observado:** `aria-hidden` la retira del árbol accesible, no del render visual. Texto permanece superpuesto.
- **Impacto/severidad:** estado visual engañoso y ruido fotográfico, sin impedir acción ni recuperación; P2 acotado.
- **Corrección exacta:** desmontar u ocultar visualmente loader al cargar, conservar frame 4:3 y estados error/retry.
- **Aceptación:** carga lenta→éxito y aborto→retry→éxito: mensaje ausente visualmente al finalizar, mismo asset y geometría, no apertura accidental de detalle.

## Aplazado, sin convertirlo en correcciones nuevas de SOL-0–2

- **SOL-3 / PARTIAL:** disposición final de detalle, badge legado `Grado S`, disclosures, footer, fallback con imageBrief, galería múltiple, swipe vertical y atribución dentro del fullscreen. Se observó lightbox de una foto sin créditos internos; el componente no fue cambiado por este slice. La conservación del acceso y el teclado de su wrapper sí se probaron ahora. No se ordena implementar la galería completa como parte de este cierre.
- **SOL-4/5 / PARTIAL:** dos personas, elección de identidad, tabla de nueve votos, undo/discard, pendientes/shortlist, selector de persona funcional y UX final del viaje. `Mis guardados` transitorio está permitido por SOL-2 y no representa votos de pareja.
- **SOL-6 / PARTIAL:** draft/apply/cancel de filtros, conteo por grupos, chips, selección de mapa, clustering y diseño final. El panel heredado actual aplica de inmediato; cerrar no es una cancelación de draft. Esto se distingue de la persistencia completa ya exigida a la navegación de este slice.
- **SOL-7/8/9 / PARTIAL:** expansión fotográfica, backend/sync y investigación/comparación de zonas; ninguna adquisición, hotel sugerido ni sincronización afirmada.
- **PERF-02 / PARTIAL:** advisory histórico del bundle; no nueva comparación de build comprimido ni puntuación de dispositivo. No se entrega a SOL una optimización amplia sin medir.
- **SOL-0 / PARTIAL residual:** falta baseline histórico completo y pruebas humanas/entre motores; las capturas actuales y de referencia no se hacen pasar por aquel baseline.

## Handoff y continuidad

SOL recibe exclusivamente F01–F09, en commits acotados; debe preservar V7, datos y las carpetas ajenas. Corregir primero los P1, después F09 y devolver evidencia focalizada. No reabrir infraestructura, reconstruir la aplicación, iniciar SOL-3, hacer merge o editar main.

Después de correcciones: auditar diff, reproducir F01–F09 y vecinos afectados; conservar prueba V7 completa, historial interhub controlado y teclado real del lightbox. Actions verde sigue siendo sólo evidencia automatizada. Aprobación de SOL-0–2 requiere cerrar sus fallos aplicables y declarar explícitamente los PARTIAL residuales.

Prompt de continuación si cambia la sesión:

> TRACK: ASTRA. MODEL ROLE: ASTRA DIRECTOR. Continuar desde la rama `codex/continuar-proyecto-z3rom4str-desde-astra-redesign` en `Z3roM4str/-nihon-travel-explorer`, PR #122. El producto auditado fue `9cf70156fcff41b09b2123e9cfd5452816c91b99`; el commit de documentación posterior contiene `ASTRA_INDEPENDENT_AUDIT_SOL_0_2_9cf7015.md`. Verificar HEAD y sólo los cambios posteriores. Leer ese informe, su evidence/README, DESIGN_AUTHORITY, SOL_IMPLEMENTATION_PLAN y ASTRA_AUDIT_CHECKLIST. Veredicto FAIL: 0 P0, 8 P1 F01–F08 y P2 F09. No iniciar SOL-3 ni aplicar rediseño amplio. Preservar `phase3b2b-run-audit/` y `worktree/`, que ya eran untracked; no leer Claude, modificar main ni hacer merge. Reutilizar Actions 35355643803/artifact 10552290075, capturas/JSON versionados y archivo local descrito en evidence/README. V7 completo pasó, zoom nativo pasó, sólo texto 200% falla; no confundir sus métodos. No hay cercanos interhub reales: usar fixture browser-only etiquetada. Tras correcciones de SOL, reauditar fallos y regresiones vecinas, registrar evidencia y commit, sin aprobación global basada en CI.
