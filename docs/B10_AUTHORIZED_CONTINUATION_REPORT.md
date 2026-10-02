# B10 — continuación autorizada desde c868bd3 (2026-10-02)

**INCOMPLETO; #177 Draft, sin merge/deploy.** Última candidata de producto `26407373059e0f20e6e64e975f7a38eb7da5805f`; los lotes y regresiones intermedios inferiores conservan sus SHAs. Inicio `c868bd3e5bbb7df15ae44928476aa425f330ba12`. Los manifiestos históricos no se reetiquetan. Esta ejecución conserva backup/RC/main y publica únicamente en `codex/b10-pulido-mission`.

## Autorización y precondiciones

El prompt del usuario de 2026-10-02 autoriza E01 A, E02 primera propuesta, E03 primera propuesta, E04 conjunto B y A-01 (los dos literales de salto). Se comprobó el archivo completo `B10_EDITORIAL_PROPOSALS.md`: blob `82423b2632e2d58547a32c6edf5b7770cf819d32`, idéntico al HEAD indicado. La aprobación se registra en design/09; las alternativas no se aplican. G6 se amplía sólo a límites Leaflet verificables, sin presupuesto/métrica/ratchet/dependencias nuevos. OD-01 POST-V1/DIFERIDO.

No existe AGENTS.md en raíz/padres accesibles ni rutas del checkout; búsqueda rg y lectura GitHub raíz 404. Se leyó CURRENT_WORK_HANDOFF y los criterios 08 G1–G7/misión/informe/manifiesto/propuestas. Origin HTTPS corresponde a Z3roM4str/-nihon-travel-explorer. Remotos comprobados: rama `c868bd3`, main `80464643528a458de05149b01a8b5c2e5b94a77f`, backup `40838062062c8820ea9f7b028675d8add0c96c32`, tag v1.1.0 `d72e199`. Main no incorporado; RC no modificado.

Entorno nuevo, Node 24.19.0, lock exacto con npm ci. Chromium Playwright y WebKit 26.5 reales. Las bibliotecas faltantes de WebKit se descargan de los repositorios Debian configurados y se extraen al workspace: el runner conserva confianza TLS y usa WPE con LD_LIBRARY_PATH explícito. Los intentos de instalación sistémica fallidos quedan en evidencia; no son fallos de producto.

## Lote E01–E04 / A-01

Implementación `d9268bdce7862bc509b5f07fecbc65f57ecdb88a`, tree `51767d44423dc0ec7dde437d9263a9cc5524b73e`. Publicación Git-data no forzada, preflight de ref y tree exacto, checkout alineado al commit remoto sin rebase ni modificación de producto.

E01 conserva rama legCount=0 omitida (la propuesta prohibía añadir resumen en ramas que lo omiten), usa conexiones con tiempo registrado en completos y N de M en parciales; contador separado F conexiones sin tiempo registrado. E02 explicita atribución Quiero ir y plan/días/fechas/alojamiento compartidos. E03 explica inactividad por reparto inválido. E04 aplica sólo a los cinco contextos aprobados; títulos/empty generales de traslados entre ciudades y otras razones quedan como estaban. Cálculos, registro/inactividad y minutos no cambian.

A-01 añade cuatro enlaces nativos con href a encabezados identificables: tres «Saltar a la siguiente colección» y «Saltar al mapa de Japón». Sólo encabezados usan tabindex=-1. El handler enfoca y desplaza al destino sin añadir entradas al historial de fichas; Tab continúa desde allí. El destino limpia el buscador sticky con scroll-margin en tokens existentes. Ninguna acción original sale de Tab.

Build/typecheck, lint, G1 119 archivos/3429 PASS. Primera suite detectó cuatro expectativas de copy anterior: actualizadas por la aprobación, conservando assertions de valores, ratio parcial, reparto y vocabulario; el fallo completo queda registrado. Renderizado de funciones reales con seam sólo de prueba: completos 1/N, parciales 0/1/N, vacío, singular/plural y causas inválidas/mismatch/same-current; sin mutación de resumen. L2 15 estados por motor (30): alta/edición/baja, principal/manual separado, identidades opacas/V8/minutos intactos. A-01 24 estados por motor, 320/390/1440 × normal/reduced × cuatro colecciones: acciones 312, Tab 64/70/28/150 conservado, foco-visible y scroll, historial y Tab tras salto PASS. Primer intento de runner con h3 ambiguo corregido a encabezado específico, sin relajar la assertion.

[Evidencia nueva del lote y sus intentos](evidence/b10/authorized-20261002/editorial-a01.json). No certifica históricos ni QA físico.

## G6 en curso

Baseline escrito reproducido: `index-aHD23Flo.js`, raw 1377221, gzip nivel 9 **271025**. Ceiling **253742**, exceso inicial **17283**. La variante se acepta sólo con medición y protección de interacción/reintentos. Sigue el lote de implementación, separado de éste.

## Lote G6 — límites de interacción y recuperación

Implementación `7801f635e7ab20e6b7bcbe24b556119359edfb68`, tree `842e2416bdc6bfbb06078d3ed5a2070541ff5012`. Se conservan listas/shell síncronos y las dos precargas existentes después de pintar. PlaceMap y NationalMap importaban Leaflet estáticamente; la precarga de ZoneComparison también lo alcanzaba. Ahora sólo el módulo diferido `map-runtime` lo importa; la hoja cartográfica de zonas se separa para que la precarga de su lista no anule el límite. No se cambia dominio, cálculos, presupuesto, referencia, ratchet, dependencias ni funciones.

Entrada escrita gzip nivel 9 **271025 → 156890** (−114135; margen 96852 frente a **253742**). React runtime síncrono separado **66645**; conjunto JavaScript síncrono **223535**, margen 30207. Diferidos: mapas/Leaflet **48813**, Días **33204**, zonas **5849**. Los recursos se miden individualmente con la definición vigente; la suma síncrona es protección adicional, no reemplaza la métrica normativa. El informe final vuelve a medir sobre el código estable.

El primer prototipo dividía hojas y chunk compartido: 404 del compartido seguía fallando por cache del module map del navegador. Se descarta y conserva evidencia. La variante aceptada forma un único recurso diferido con dependencias host ya cargadas. Reintento lee el manifiesto sólo después de fallo y pide URL nueva de toda esa unidad. No hay fetch del manifiesto ni módulo cartográfico en portada/lista móvil/precarga idle. Éxito compartido se conserva en memoria; cambiar superficie y reabrir no repite descarga. La geometría nacional conserva su carga independiente y añade reintento.

Dos mapas: **19 escenarios por motor** en Chromium/WebKit, 320/390/1440, normal/reduced: primera apertura/reapertura, red lenta reteniendo JS real, feedback role=status, cajas exactas, 47 polígonos nacionales, marcadores/clusters, vista/centro/zoom y posición exactos, foco de retorno, sin escrituras al consultar. Fallos 404, repetidos, manifiesto 503 y geometría, teclado/reintento/foco y recuperación hacia la otra superficie. Ampliación de zonas: **6 estados por motor**, mismos tres tamaños/movimientos, fallo y recuperación real, dos marcadores seleccionados, comparación utilizable, cajas exactas, foco, reapertura y almacenamiento intacto. Los siete escenarios de fallo se repiten junto a esos seis; no se cuentan como cobertura independiente nueva.

La altura de fallback nacional en escritorio no coincidía inicialmente (396 vs 844 px): corregida mediante la misma regla de altura existente de la superficie. En zonas, el primer runner medía el mapa fuera de pantalla antes de que el clic de reintento lo desplazara; se conserva el fallo y se hace visible el mismo feedback antes de medir, manteniendo la igualdad exacta de posición/dimensiones. Para vista de ciudad se espera reposo efectivo de pan/tiles/marcadores; se conservan igualdad exacta de pane y, adicionalmente, centro/zoom geográfico. Un intento de sustituir esa assertion por identidad/zoom recibió rechazo de aprobación automática; no se ejecutó y se resolvió manteniendo la protección.

Build/typecheck/lint y **119/3430** PASS. Guardia de fuente contra imports Leaflet ajenos al módulo y guardia de grafo de build contra dependencias diferidas adicionales. Mutante que adelanta el módulo cartográfico: FAIL esperado en ambos motores. B30 añade espera de montaje y exige dos pins reales para que el nuevo límite no convierta una assertion vacía en éxito. Regresión completa pendiente sobre el código final.

[Evidencia G6, recursos y todos los intentos](evidence/b10/authorized-20261002/maps.json). Ensamblar partes en orden y comprobar hash antes de extraer; no modifica manifiestos históricos.

## Lote CSS canónico / investigación G4

Implementación `04a577dacad6ff4f93e8f3ba2aeb27937245a580`, tree `16e21b003c07c6f690d4a9905cb9ada9ed831574`. **43 sustituciones exactas**: alias declarados en foundation.css hacia tokens canónicos, espaciados exactos de la escala 03 (base 16px) y radio 999px ya documentado. El marco de ficha plenamente canónico se extrae a `components/PlaceDetailFrame.css`, importado inmediatamente antes del residual, en su posición original. Se compara el orden de **244 registros** de reglas/media/declaraciones y valores resueltos, sin diferencias. No se cambia orden/especificidad/responsive/estados. La reubicación junto al componente conserva CSS generado byte a byte respecto a la captura del candidato.

App.css queda en **444 líneas/43 reglas**. No se retira deuda a otro archivo para declarar migración completa. Ocho hex de declaraciones, dos queries max-width legacy y valores tipográficos/layout sin decisión permanecen. [34 ubicaciones, valores, alternativas y efecto, sin aplicar](B10_CSS_PENDING_DECISIONS.md). La coincidencia numérica con un token de otro rol tipográfico no aprueba cambiar jerarquía. OD-01 POST-V1/DIFERIDO.

Build/typecheck/lint, **119/3430 PASS**. Capturas Chromium/WebKit a 320/390/1440, 75 estados por captura: antes/después, referencia contra sí misma y candidato contra sí mismo, **75/75 estilos computados y cajas exactas en cada comparación/motor**, 138826 elementos por captura. Se elimina el redondeo anterior de cajas a 0,5px del runner: usa coordenadas completas, tolerancias sin ampliar. PNG: 63 por captura (los estados fresh/onboarding carecen de PNG en ese runner; sus estilos sí están). WebKit **63/63 exactas** en las tres comparaciones. Chromium: baseline-self **56/63**, candidato-self **55/63**, antes/después **58/63**. Las cinco diferencias cruzadas son 20/19/11/11/6 píxeles en ciudad-mapa, ciudad, Nosotros, Quiero ir-persona y Mover; cada ubicación distinta también cambia en al menos una comparación contra sí misma. Cero píxeles cruzados fuera de esa variabilidad en esta muestra. No se normaliza PNG, no se calcula promedio para aprobar y no se declara paridad PNG global.

Investigación adicional histórica: se reensambla y verifica css-shell original, conservando sus 25 pares publicados (20 discrepantes + cinco muestras exactas). La build inicial se captura dos veces a 320/390/840/860/861/1440: **150/150 estilos/cajas exactos**. El nuevo autocontrol no reproduce íntegramente las máscaras de ninguno de los 20 pares antiguos; algunos sólo se solapan parcialmente. **Atribución histórica de esos píxeles sigue sin cerrar**, no se reclasifica todo como variabilidad ni defecto determinista sin prueba. Los cuatro valores subpíxel WebKit históricos quedan en su evidencia original. No se detecta diferencia determinista de estilos/cajas en el nuevo lote canónico. Cambios de producto deterministas autorizados respecto al inicio (copy, saltos/encabezado y estados/wrappers de mapas) se enumeran por separado y no se incluyen en una afirmación de aspecto idéntico al inicio.

[Evidencia CSS nueva y todos los valores/capturas](evidence/b10/authorized-20261002/css-canonical.json). Se publican matrices completas, hashes de todas las PNG, todos los estados con discrepancias y muestras exactas de ficha/superficies tocadas; las capturas históricas originales conservan su propio manifiesto. El primer contador diagnóstico PNG comparaba una tupla RGB con 0: contadores inválidos conservados con nombre explícito y reemplazados por comparación RGB exacta; igualdad/bboxes originales no se usaron como resultado final. Un intento de comparación antes de terminar la segunda captura falló por archivo faltante: no se considera resultado de paridad.


## Lote de corrección tras la primera regresión — candidata intermedia e1f36aa

Código `e1f36aafeb81c6723fb998edff0b4aff6bd11898`, tree `22242e88c3f9ca4e760967138466cbb50900ebff`. La primera regresión completa sobre 04a577d ejecutó 72 trabajos: tres positivos fallaron (performance Chromium, B12 y B24); ocho negativos fueron detectados. Todos sus logs, capturas y resultados se conservan con su SHA. No certifican la corrección posterior.

La guarda B24 detectó seis oclusiones por la leyenda: el wrapper nuevo separaba el mapa de su cromo. La consulta se hace ahora al propietario `.app__map-area`, conservando las exclusiones originales. Comparación real de código anterior y corrección en worktree aislado: B24 recupera todos los checks; ningún guard geométrico se relaja.

Completar la descarga nacional después de cambiar a Nosotros producía `Invalid LatLng object: (NaN, NaN)` y vaciaba React en ambos motores. El primer montaje de Leaflet espera dimensiones positivas con ResizeObserver; después conserva la instancia al ocultarse. FitViewport espera también un viewport visible al ajustar región. Se descartó una variante que sólo protegía FitViewport: evitaba el crash pero cambiaba la proyección/clipping inicial. Se conserva su evidencia. La geometría resuelve incluso si el cache se completa entre render y efecto, sin otra petición. El nuevo guard retiene JS real, cambia destino/pane o cierra la superficie y compara todas las coordenadas de pantalla/colores de los 47 polígonos o el centro/zoom exacto de ciudad con una apertura normal: **14 casos por motor** a 390/1440, normal/reduced. Las assertions exactas previas de pane y vista siguen intactas.

B12 informaba «404» ante HTTP **304**, aun montando la aplicación. Se mantienen estados HTTP originales. Un 304 sólo se acepta si el módulo realmente parseado después de reload tiene bytes no vacíos y SHA-256 exactamente igual al recurso 200 frío; se borra el registro de scripts antes de recargar. No se hace fetch que repare el fallo, ni se acepta cualquier 304. Se añaden comprobaciones de request/console de reapertura. Chromium: **84/84** en phone/tablet/desktop; mutante real 404 de entry warm: **24/28**, cuatro fallos esperados. Los ensayos fallidos de body vacío/cache-only durante navegación se preservan; no son prueba de recuperación. No se alteran tolerancias, presupuesto, referencia ni ratchet.

## Medición estable G6 y límites de certificación

Definición vigente: archivo **escrito**, Node gzipSync nivel 9. La medición del analizador en generateBundle se conserva por separado (entry 156876), porque no mide el mismo instante y no se sustituye por ella el resultado contractual escrito.

| Recurso escrito | Raw bytes | Gzip nivel 9 | Carga |
|---|---:|---:|---|
| index-D1Dlqwxq.js | 738969 | **157049** | Entrada |
| jsx-runtime-DVGEMFBX.js | 477245 | **66645** | Dependencia estática de entrada |
| map-runtime-DRb29nYm.js | 165997 | **48881** | Interacción cartográfica; todas las hojas Leaflet juntas |
| OrderedSequenceBuilder-BTiKCPId.js | 128153 | **33207** | Boundary Días vigente |
| ZoneComparison-Dp8VTJ7L.js | 19743 | **5865** | Boundary/precarga idle de controles de zonas vigente |
| index-Cful-alX.css | 107993 | **21093** | CSS inicial |
| OrderedSequenceBuilder-DlQdSXy1.css | 26716 | **4389** | CSS Días |
| ZoneComparison-CEIEMi_4.css | 11050 | **2471** | CSS zonas |

Entrada **271025 → 157049**, ahorro **113976**, margen **96693** contra ceiling **253742**: **PASS entrada G6**. JavaScript síncrono completo **223694**: ahorro real de ruta crítica **47331** frente a la entrada única inicial, margen adicional **30048**. No se presenta el ahorro de entry como ahorro de toda la transferencia. El fichero compartido grande lleva datos de lugares y runtime JSX; es síncrono y se incluye, aunque el analizador lo rotule lazy por no ser isEntry. El grafo/manifiesto prueba que el runtime cartográfico sólo importa dependencias host ya cargadas. Sin import estático o precarga que adelante el JavaScript Leaflet; precarga de zonas sólo alcanza sus controles. React/DOM, datos canónicos proyectados, logística y shell siguen en ruta crítica por sus consumidores vigentes; no se añade otro refactor.

**G6 global no se certifica sólo por entry PASS.** La pasada final Chromium conserva FAIL del guard fotográfico: móvil Osaka, dos fotografías nuevas lejanas; escritorio Osaka **3862290 > 3500000 B** en su ventana. La comparación focal posterior da 3315340 B en referencia y candidato, sin peticiones ajenas a las tarjetas de ciudad en esa captura, pero no borra el exceso registrado ni demuestra su causa exacta. El exceso puntual queda abierto. La carga anticipada nativa lejana se reproduce con el código inicial y el final; distintas ciudades/URLs según la pasada. Las trazas conservan home-cut, entrada en ciudad, request start/end, rectángulos y loading/fetchpriority: no se atribuye una petición ya descargada a carga nueva por simple apariencia. Todos los presupuestos, bytes y fallos del guard original quedan visibles.

Propuesta concreta para un lote fotográfico adicional, fuera de la ampliación de dos mapas: activar src/srcset de tarjetas no prioritarias mediante IntersectionObserver con margen máximo de dos viewports, conservar loading=lazy y primera tarjeta prioritaria, dimensiones/fallback/retry y acceso por teclado; impedir activaciones nuevas de una superficie abandonada. Registrar ventanas originales completas con URL/instantes para resolver el exceso de Osaka antes de elegir implementación. Verificar portada→ciudad, scroll completo, red lenta/error/retry, créditos/galería, ambos motores/DPR y el mutante eager. No rebajar 3500000/253742 ni excluir respuestas, modificar la referencia o el criterio de distancia. No se cambian fotografías/datos ni se repiten microoptimizaciones de entry sin beneficio medible.

## OSM: entorno y aplicación por separado

Prueba real del código final, TLS por defecto, sin route/mocks ni flags de certificado: Chromium 151 registra **109 fallos OSM ERR_CERT_AUTHORITY_INVALID**, cero respuestas; WebKit 26.5 registra **77 respuestas reales**, cero fallos. Curl de la misma tesela: HTTP **200**, ssl_verify_result **0**, **6987 bytes**. El probe APIRequest/Node de ambos motores falla por ruta IPv6 ENETUNREACH; es otra ruta de conectividad, no el resultado de navegación de WebKit ni una prueba de caída del proveedor.

En ambos motores quedan 21 marcadores/clusters, atribución, apertura/cierre de ficha y regreso a lista operativos; cero errores React y localStorage idéntico al consultar. B25 funcional automatizado se informa separado de esta prueba externa: un PASS de UI no aprueba el acceso real OSM en Chromium. No se demostró un defecto propio reproducible del manejo de teselas dentro de la ampliación; el defecto propio de montaje oculto sí fue corregido y verificado arriba. La certificación conserva **OSM-TLS Chromium FAIL externo**. El pendiente histórico de fotografía/licencias de zonas también se conserva, sin sustituirlo por esta prueba de conectividad.

Feedback de carga/error: 24 PNG finales (390/1440 × mapas nacional/ciudad/zonas × carga/error × dos motores), role=status/aria-live=polite, botón Reintentar **100×44**, Tab real, focus-visible y anillo **2px**; las cajas de carga y mapa listo se comparan exactamente en el guard. Se conservan las capturas anteriores de foco programático: no se usaron para afirmar foco visible de teclado. Inspección visual de muestra nacional/error móvil WebKit y ciudad/carga escritorio Chromium; capturas completas en evidencia. No equivale a lector físico ni paridad PNG global.

## Integridad y QA físico

Código exacto para ejecutar F01–F12 cuando haya hardware: **e1f36aafeb81c6723fb998edff0b4aff6bd11898**, app tree/build/fingerprint en el manifiesto nuevo. Build funcional con bloqueos de certificación registrados; no sustituirla por el RC publicado. **F01–F12 NO EJECUTADO**, sin evidencia física. No se cierran Safari/iPhone, lectores, selector Files ni red de dispositivo con más emulación.

**836 registros** sin cambios inesperados respecto a c868bd3: JSON canónicos, fuentes/fotografías públicas, package/lock y funciones de V8, identidades, viajeros y backup. Única modificación esperada en ese conjunto: useJapanGeometry (carga/retry, datos geográficos intactos). **482/482** verificaciones de los tres nuevos manifiestos E/A, mapas y CSS, más **4036/4036** verificaciones históricas, partes/archivos/tar/hashes/blobs y manifiestos idénticos al inicio. Nueva huella de **1068** archivos de src/public, HTML/config/lock/tsconfig enumerados, no un censo intercambiable con manifiestos anteriores. APIs 202 lugares/244 imágenes y 46225 pares/325 enlaces preservadas; suite completa ejerce V8/identidad/backup. El CSS escrito estable conserva el hash del lote canónico `03731947128f41606b0e8529d196c6b52ef4d0743c6fda2a586294b18c5e817f`; corrección posterior no cambia estilos. El cambio determinista de posiciones por cromo de marcadores corrige B24 y no se llama paridad con el defecto anterior.

[Manifiesto consolidado nuevo](B10_AUTHORIZED_CONTINUATION_EVIDENCE.json). Los manifiestos anteriores de E/A, mapas y CSS conservan sus propios SHAs. Checkpoints fuente/documentación distinguidos, preflight remoto y actualización no forzada; main, backup y RC se verifican de nuevo al publicar. PR #177 permanece Draft. B10 sigue INCOMPLETO por G4/visual estricto, rendimiento fotográfico y pruebas físicas; OSM externo se informa separado. OD-01 POST-V1/DIFERIDO.


## Regresión completa del producto final

Build/typecheck/lint; **119 archivos/3430 tests PASS**. Build congelada y huella de inputs/recursos guardadas antes de ejecutar. **75 trabajos: 66 positivos (65 PASS, un FAIL de rendimiento Chromium) y nueve mutantes detectados**. Ningún mutante pasa inadvertido. El manifiesto registra comando, entorno, motor, tiempo, exit, SHA y tree por trabajo. No se usa «65 PASS» para aprobar el fallo restante.

| Frente | Chromium | WebKit / otra cobertura |
|---|---|---|
| E01–E04 render/domain reales; L2 | PASS; L2 15 estados | L2 15 estados PASS |
| A-01 | 24 estados,312 acciones por recorrido PASS | 24 estados,312 acciones PASS |
| Mapas cold/warm/slow/failure/retry | 25 casos PASS | 25 casos PASS |
| Descarga que termina tras abandonar/ocultar mapa | 14 casos PASS | 14 casos PASS |
| Movimiento, accesibilidad, microcopy, galería, mapa nacional | PASS | PASS |
| Scroll de contenido y retorno de foco | PASS; negativos detectados | PASS; negativos detectados |
| B26 / B30 / B31 | 314/314;484/484;281/281 | 314/314;484/484;281/281 |
| B27/B28/B29, D0b, B18 y B19/B20 | PASS | D0b y B21 PASS en ambos motores |
| B25 funcional / B24 real-input | 123/123;1335/1335 | OSM externo no se infiere de estos gates |
| B12 / backup B13 / release B14 / Phase5A | 84/84;150/150;229/229;50/50 por viewport | Sin cierre físico ni modificación del RC |
| Fotos/API/proyecciones/galería/retry/grid/contraste | PASS en sus guards | Fuente canónica íntegra; guard global fotográfico separado abajo |
| Rendimiento fotográfico completo | **11/13 FAIL**: móvil Osaka lazy y escritorio3862290 bytes | **13/13 PASS**, sin compensar el FAIL Chromium |
| Mutantes | scroll/foco/map eager por motor;foto eager;iconos ocultos;chunk warm404 | **9/9 detectados** |

Detalle de cada trabajo, sin agregación que oculte discrepancias:

| Trabajo | Resultado | Exit |
|---|---|---:|
| `a11y-chromium` | PASS | 0 |
| `a11y-webkit` | PASS | 0 |
| `b10-l1` | PASS | 0 |
| `b10-photo-projection` | PASS | 0 |
| `b10-walking-projection` | PASS | 0 |
| `b18-a11y-check` | PASS | 0 |
| `b18-browser-back-check` | PASS | 0 |
| `b18-chrome-check` | PASS | 0 |
| `b18-regression-check` | PASS | 0 |
| `b18-responsive-check` | PASS | 0 |
| `b18-viaje-lugar-check` | PASS | 0 |
| `b21-chromium-desktop` | PASS | 0 |
| `b21-chromium-mobile` | PASS | 0 |
| `b21-webkit-desktop` | PASS | 0 |
| `b21-webkit-mobile` | PASS | 0 |
| `b24-real-input-audit` | PASS | 0 |
| `b25-quiero-ir-check` | PASS | 0 |
| `b26-nosotros-check-chromium` | PASS | 0 |
| `b26-nosotros-check-webkit` | PASS | 0 |
| `b27-viaje-dias-check` | PASS | 0 |
| `b28-reorder-dnd-check` | PASS | 0 |
| `b29-day-order-tools-check` | PASS | 0 |
| `b30-where-to-sleep-check-chromium` | PASS | 0 |
| `b30-where-to-sleep-check-webkit` | PASS | 0 |
| `b31-reservas-resumen-check-chromium` | PASS | 0 |
| `b31-reservas-resumen-check-webkit` | PASS | 0 |
| `block1-ux-browser-audit` | PASS | 0 |
| `block12-bundle-architecture-browser-audit` | PASS | 0 |
| `block13-portable-backup-browser-audit` | PASS | 0 |
| `block14-release-readiness-browser-audit` | PASS | 0 |
| `block19-contrast-check` | PASS | 0 |
| `block19-discovery-browser-audit` | PASS | 0 |
| `block19-grid-check` | PASS | 0 |
| `block20-place-detail-check` | PASS | 0 |
| `block22-b6-6-photography-browser-audit` | PASS | 0 |
| `block23-photo-retry-browser-audit` | PASS | 0 |
| `collections-keyboard-chromium` | PASS | 0 |
| `collections-keyboard-webkit` | PASS | 0 |
| `d0b-design-system-hygiene-check-chromium` | PASS | 0 |
| `d0b-design-system-hygiene-check-webkit` | PASS | 0 |
| `editorial` | PASS | 0 |
| `embedded-scroll-chromium` | PASS | 0 |
| `embedded-scroll-webkit` | PASS | 0 |
| `evidence-options` | PASS | 0 |
| `gallery-motion-chromium` | PASS | 0 |
| `gallery-motion-webkit` | PASS | 0 |
| `l2-chromium` | PASS | 0 |
| `l2-webkit` | PASS | 0 |
| `lint` | PASS | 0 |
| `map-boundary-chromium` | PASS | 0 |
| `map-boundary-webkit` | PASS | 0 |
| `map-pending-chromium` | PASS | 0 |
| `map-pending-webkit` | PASS | 0 |
| `microcopy-chromium` | PASS | 0 |
| `microcopy-webkit` | PASS | 0 |
| `motion-chromium` | PASS | 0 |
| `motion-webkit` | PASS | 0 |
| `national-map-chromium` | PASS | 0 |
| `national-map-webkit` | PASS | 0 |
| `negative-eager-photo` | FAIL esperado (mutante) | 1 |
| `negative-focus-chromium` | FAIL esperado (mutante) | 1 |
| `negative-focus-webkit` | FAIL esperado (mutante) | 1 |
| `negative-hidden-icons` | FAIL esperado (mutante) | 1 |
| `negative-map-chromium` | FAIL esperado (mutante) | 1 |
| `negative-map-webkit` | FAIL esperado (mutante) | 1 |
| `negative-scroll-chromium` | FAIL esperado (mutante) | 1 |
| `negative-scroll-webkit` | FAIL esperado (mutante) | 1 |
| `negative-warm-404` | FAIL esperado (mutante) | 1 |
| `performance-chromium` | FAIL conservado | 1 |
| `performance-webkit` | PASS | 0 |
| `phase5a-desktop` | PASS | 0 |
| `phase5a-mobile` | PASS | 0 |
| `traveller-focus-chromium` | PASS | 0 |
| `traveller-focus-webkit` | PASS | 0 |
| `vitest` | PASS | 0 |


## Complemento de guardia c131ed2

Checkpoint `c131ed2f82dab196decc7b314bb27966335ac48f`: sólo se retira el filtro resourceType != fetch que había quedado del ensayo de cache-only; B12 vuelve a inspeccionar **todo JavaScript del origen**, sin excepción por tipo de petición. Producto, package, src/public/config,1068 inputs y ocho recursos JS/CSS más manifiesto escritos **idénticos** a e1f36aa. Se verifica la fuente ejecutada del guard por blob/SHA. Build/lint y **119/3430** PASS; B12 **84/84**, negativo real404 **24/28**. La regresión completa75 conserva su SHA e1f36aa, sin reetiquetar manifiestos previos.

La primera comprobación suplementaria se lanzó simultáneamente con reconstrucción. Sus dos logs se conservan con sufijo attempt1-overlap y quedan excluidos de certificación; tras terminar build se repiten B12 positivo/negativo con dist congelado. El intento de publicar el manifiesto final fue bloqueado por límite de uso del revisor automático; la acción no se ejecutó y el mensaje no la calificó como insegura. La continuación siguiente espera el restablecimiento y comprueba remotos de nuevo, sin eludir revisión.


## Último lote — contención nacional y avances remotos concurrentes

Código de candidata `26407373059e0f20e6e64e975f7a38eb7da5805f`, tree `beb0917c912b32a61c53802760d39aa3c6ebca2d`. Tras «Siguiente» se verifica de nuevo main: `4fc32feae3173581c2f6a0aef0fd95d9e9c91d11` incorpora #191. Su guard por coordenadas se ejecuta sin relajar assertions. B10 ya reseteaba scroll nacional y restauraba portada/foco; navegación fría/warm/Kanto/prefectura/Tokio/error tenía salida real. Fallaban exclusivamente dos assertions de rango oculto: **1696 px en teléfono y 1516 px en escritorio**, **51/53** en cada motor. No se aplica el key/cambio de App de main. Se contiene el label absoluto con `position:relative` en el propietario `.national__sheet-content`: **53/53 Chromium y WebKit**, con coordenadas reales, sin click que autocorrija scroll. Mutante revierte sólo esa contención y recupera **51/53** en ambos. Emulación no equivale a físico. Build/lint y 119/3430 PASS antes de publicar fuente; se repite la regresión final sobre el SHA publicado.

Durante ese checkpoint main avanza otra vez a `ce951a8366e37f35d801e237ab7f3071204879a8`, merge #192: tarjeta nacional al principio y nuevo diseño/copy, más adaptación de sus guards. Se inspecciona el diff completo; no modifica criterios/documentación. No se incorpora esa expansión visual/editorial a B10 ni se escribe main. La tarjeta, sus 312 acciones y el destino del salto aprobado permanecen según esta rama. Backup/tag RC siguen iguales.

La corrección es una diferencia determinista intencionada del producto, no una equivalencia canónica ni una prueba de paridad general. Sus capturas antes/después y autocontroles quedan en la evidencia final; no se amplía tolerancia. El primer instrumento visual intentó leer git en el root de referencia sin .git; no escribió resultados finales. Un segundo intento visual usaba continue en la ruta general y evitaba el fallo de geometría del contexto; se corrige a fallback. La interrupción por grupo inicial no detuvo el runner hijo y dejó intentos solapados; se terminan los PIDs exactos y se conserva toda esa evidencia excluida. La serie final se ejecuta sola, con identidad de fuente y error geométrico correctos. El guard de producto y la regresión no se modificaron por estos instrumentos. El primer nombre de script de bundle era inexistente; se conserva stderr y se ejecuta el analizador real, luego build. La reconstrucción termina antes de la nueva regresión; no hay reconstrucciones durante ella.

Medición final de archivos escritos con Node gzipSync nivel 9: entrada **157046** (raw **738969**), runtime React **66645**, crítico **223691**; mapas **48880**, Días **33206**, zonas **5864**. Entrada anterior exacta **271025**, techo **253742**, margen **96696**; mejora crítica **47334**. CSS principal **21099** según medición escrita indicada en el manifiesto (el valor exacto del manifiesto prevalece; no usar etapa generateBundle). El hash de nombres de assets cambia también en imports internos por el CSS aunque la lógica JS no cambie; se conservan archivos escritos nuevos, sin alegar identidad binaria con e1f36aa.

La geometría nacional diferida e intacta pesa **1329210 raw / 363763 gzip nivel 9**: petición independiente al abrir el mapa nacional, con su propio cache/reintento. No se suma ni excluye de forma distinta al entry normativo. main.tsx conserva el import inicial de **leaflet.css**, recogido en el CSS crítico medido (21099 gzip); ese import de estilos no solicita el JavaScript de mapas y evita un cambio visual de primera apertura. Las verificaciones de requests iniciales/idle y el mutante de precarga protegen ese límite.


### G6 — atribución nueva de la ventana fallida, sin excepción al presupuesto

La regresión sobre 2640737 reproduce **12/13 Chromium**: entrada/CSS y carga lejana móvil pasan en esta muestra, pero Osaka escritorio conserva **3862290 >3500000**. Se ejecuta una copia diagnóstica del guard que sólo exporta los arrays ya medidos al final, sin modificar assertions ni excluir respuestas. Reproduce exactamente **57 respuestas/3862290**, home-cut de **18 respuestas**. Otra ventana instrumentada asentó más portada (**37 respuestas** antes del corte) y midió Osaka **49 respuestas/3315340**.

La diferencia se identifica por URLs y tamaños individuales: **ocho respuestas, 546950 B** — JP-004 97826; JP-005 51724; JP-011 62926; JP-024 61220; JP-037 53724; JP-046 67180; JP-049 67476; JP-073 84874. Ninguna URL pertenece a los currentSrc de las tarjetas finales de Osaka; las ocho están en las URLs medidas de la portada del otro recorrido. **3315340+546950=3862290**. Son respuestas de portada que quedan contabilizadas tras el corte de la ventana de ciudad; el instrumento de exportación no determina por sí solo el instante exacto de inicio de cada petición. Se conserva esa limitación y no se afirma causalidad temporal más precisa. Esta atribución nueva concreta el exceso reproducido, sin borrar la anterior investigación inconclusa ni reclasificar el guard como aprobado.

Propuesta ampliada concreta: el lote fotográfico debe controlar la activación de src/srcset de tarjetas/colecciones no prioritarias de portada y ciudad dentro del margen vigente, y comprobar la vida de la superficie al activarlas. Registrar inicio/respuesta y transición para los ocho IDs identificados, además de las fotos lejanas ya reproducidas. Conservar los bytes de TODAS las respuestas de la ventana original; demostrar ≤3500000 también en navegación inmediata/solapada, no estabilizar artificialmente el home-cut ni excluir fotos de portada. Primera tarjeta, scroll completo, fallback/retry, dimensiones, foco, créditos, ambos motores/DPR y mutante eager siguen obligatorios. Esa implementación fotográfica excede la ampliación acotada a mapas: queda propuesta, sin tocar fotos, presupuesto, referencia, métrica o ratchet.


### Visual del último cambio — datos exactos, discrepancias conservadas

La serie válida compara c131ed2 (producto e1f36aa idéntico, CSS previo) con 2640737, ambos dos veces, Chromium/WebKit, 390×844@3 y 1440×900@1, nacional frío/reabierto/Kanto/error. Se capturan ocho estados por serie/motor, 32 PNG por motor; fixtures compartidas bloquean sólo imágenes externas y no certifican OSM. El guard de comportamiento sigue separado, con red/fallo geométrico real simulado y ambos movimientos en otros guards.

Referencias contra sí mismas: Chromium **8/8 estilos/cajas y PNG exactos**; WebKit **8/8**. Candidata contra sí misma: Chromium **8/8 estilos/cajas**, **7/8 PNG** (siete píxeles); WebKit **7/8 estilos completos**, **7/8 PNG** (1352 píxeles en una fila del header, cajas idénticas). Antes/después: cambios computados en ocho estados de ambos motores corresponden a contención/offsets de labels y rangos de scroll; no se etiquetan como equivalencia CSS. WebKit **8/8 PNG exactos** en esa comparación. Chromium **5/8 PNG exactos**; tres pares escritorio presentan **163/163/402 píxeles distintos**, con **163/163/400** fuera de la variabilidad demostrada en esos autocontroles. No se proclama paridad ni se atribuyen automáticamente esos 726 píxeles a ruido. Se realiza además reversión estática/relativa repetida dentro de la misma página para separar el efecto reproducible del cambio de rasterización.

Los manifiestos/matrices guardan valores sin redondeo, máscaras/bboxes, capturas y diferencias completas. Que el rango oculto deje de existir sólo prueba la corrección de ese defecto; no cierra G4/G7 ni las 20 discrepancias históricas pendientes.


La reversión controlada dentro de la MISMA página distingue efecto del producto: Chromium nacional frío/reabierto muestra **163 píxeles** en static→relative en ambas repeticiones, con static-self y relative-self **cero**; Kanto muestra **387** en ambas reversiones, también self **cero**. Las máscaras están en esquinas redondeadas de controles/hoja; para nacional frío se enumeran **23 componentes conexos, 163 píxeles, delta máximo 2 niveles por canal**, sin desplazamiento de controles visibles. Por tanto ese cambio de rasterización es determinista al introducir contención y no ruido de captura, aunque sea pequeño; **no se usa su magnitud para ampliar tolerancias ni declarar paridad**. Los 402 píxeles del cruce Kanto incluyen discrepancias adicionales respecto al control 387, conservadas sin atribución total. Estado error Chromium varía contra sí mismo (55/51 píxeles en las dos posiciones); WebKit mantiene cero en todos los toggles. El autocontrol WebKit previo con 1352 píxeles cambia borde inferior del header transparente→line; es variabilidad demostrada en ese recorrido, no equivalencia inferida para otros estados. Se conservan máscaras y valores completos, sin promedio.


### OSM-TLS — candidata final y cadena del entorno

Sobre 2640737, Chromium conserva **116 requestfailed OSM/cero respuestas**, `ERR_CERT_AUTHORITY_INVALID`; WebKit **53 respuestas reales/cero fallos OSM**. Ambos conservan 21 marcadores, atribución, apertura de ficha y regreso a lista, sin errores JS ni cambios en localStorage. Curl al mismo tile real devuelve **HTTP200, ssl_verify_result=0, 6987 B**. APIRequest separado vuelve a fallar por ruta IPv6 ENETUNREACH: no equivale a la ruta del motor navegador.

La cadena pública presentada a curl tiene Subject `CN=a.tile.openstreetmap.org`, emisor `OpenAI, LLC / openai.com` y raíz del mismo emisor: confirma intermediación TLS del proxy del entorno. Se conserva el certificado público y la verificación predeterminada, sin cambiar trust stores, ignorar certificados, desactivar TLS ni mocks para aprobar acceso real. El contraste de confianza Chromium/curl/WebKit es externo a la aplicación; no prueba caída de OSM. **OSM-TLS Chromium sigue FAIL**, separado de B25 UI y de hardware. No se reproduce defecto propio adicional en el manejo del fallo de teselas: marcadores/navegación/ficha/persistencia permanecen operativos; los defectos propios de carga de JS/geométrica/montaje oculto sí se corrigieron y verificaron por sus guards.


## Regresión final publicada — 2640737

Código probado `26407373059e0f20e6e64e975f7a38eb7da5805f`, tree `beb0917c912b32a61c53802760d39aa3c6ebca2d`; build congelado antes de iniciar ambos shards y sin reconstrucciones durante la regresión. **79 trabajos**: **67/68 positivos PASS**, **11/11 controles negativos detectados**. Único positivo FAIL: performance-chromium. El guard Chromium de rendimiento es **12/13**, Osaka escritorio **3862290 >3500000**; WebKit **13/13**. Las muestras anteriores con carga lejana móvil siguen en su evidencia. Los negativos salen con assertions/fallos del defecto elegido, no por ausencia de motor ni watchdog.

Build/typecheck, lint y **119 archivos/3430 tests**; B12 **84/84** con fuente HTTP304 ejecutada probada y 404 real aún detectado; B24 **1335/1335**; B25 UI **123/123**; B26 **314/314**, B30 **484/484**, B31 **281/281** por motor; backup150, release229 y Phase5A50 por viewport pasan. APIs/fuentes/fotos, V8, identidades y persistencia se conservan. OSM-TLS Chromium y F01–F12 siguen bloqueos independientes; esta regresión no declara aceptación B10.

| Trabajo | Resultado | Exit |
|---|---|---|
| `a11y-chromium` | PASS | 0 |
| `a11y-webkit` | PASS | 0 |
| `b10-l1` | PASS | 0 |
| `b10-photo-projection` | PASS | 0 |
| `b10-walking-projection` | PASS | 0 |
| `b18-a11y-check` | PASS | 0 |
| `b18-browser-back-check` | PASS | 0 |
| `b18-chrome-check` | PASS | 0 |
| `b18-regression-check` | PASS | 0 |
| `b18-responsive-check` | PASS | 0 |
| `b18-viaje-lugar-check` | PASS | 0 |
| `b21-chromium-desktop` | PASS | 0 |
| `b21-chromium-mobile` | PASS | 0 |
| `b21-webkit-desktop` | PASS | 0 |
| `b21-webkit-mobile` | PASS | 0 |
| `b24-real-input-audit` | PASS | 0 |
| `b25-quiero-ir-check` | PASS | 0 |
| `b26-nosotros-check-chromium` | PASS | 0 |
| `b26-nosotros-check-webkit` | PASS | 0 |
| `b27-viaje-dias-check` | PASS | 0 |
| `b28-reorder-dnd-check` | PASS | 0 |
| `b29-day-order-tools-check` | PASS | 0 |
| `b30-where-to-sleep-check-chromium` | PASS | 0 |
| `b30-where-to-sleep-check-webkit` | PASS | 0 |
| `b31-reservas-resumen-check-chromium` | PASS | 0 |
| `b31-reservas-resumen-check-webkit` | PASS | 0 |
| `block1-ux-browser-audit` | PASS | 0 |
| `block12-bundle-architecture-browser-audit` | PASS | 0 |
| `block13-portable-backup-browser-audit` | PASS | 0 |
| `block14-release-readiness-browser-audit` | PASS | 0 |
| `block19-contrast-check` | PASS | 0 |
| `block19-discovery-browser-audit` | PASS | 0 |
| `block19-grid-check` | PASS | 0 |
| `block20-place-detail-check` | PASS | 0 |
| `block22-b6-6-photography-browser-audit` | PASS | 0 |
| `block23-photo-retry-browser-audit` | PASS | 0 |
| `collections-keyboard-chromium` | PASS | 0 |
| `collections-keyboard-webkit` | PASS | 0 |
| `d0b-design-system-hygiene-check-chromium` | PASS | 0 |
| `d0b-design-system-hygiene-check-webkit` | PASS | 0 |
| `editorial` | PASS | 0 |
| `embedded-scroll-chromium` | PASS | 0 |
| `embedded-scroll-webkit` | PASS | 0 |
| `evidence-options` | PASS | 0 |
| `gallery-motion-chromium` | PASS | 0 |
| `gallery-motion-webkit` | PASS | 0 |
| `l2-chromium` | PASS | 0 |
| `l2-webkit` | PASS | 0 |
| `lint` | PASS | 0 |
| `map-boundary-chromium` | PASS | 0 |
| `map-boundary-webkit` | PASS | 0 |
| `map-pending-chromium` | PASS | 0 |
| `map-pending-webkit` | PASS | 0 |
| `microcopy-chromium` | PASS | 0 |
| `microcopy-webkit` | PASS | 0 |
| `motion-chromium` | PASS | 0 |
| `motion-webkit` | PASS | 0 |
| `national-map-chromium` | PASS | 0 |
| `national-map-webkit` | PASS | 0 |
| `national-reachability-chromium` | PASS | 0 |
| `national-reachability-webkit` | PASS | 0 |
| `negative-eager-photo` | FAIL esperado (control) | 1 |
| `negative-focus-chromium` | FAIL esperado (control) | 1 |
| `negative-focus-webkit` | FAIL esperado (control) | 1 |
| `negative-hidden-icons` | FAIL esperado (control) | 1 |
| `negative-map-chromium` | FAIL esperado (control) | 1 |
| `negative-map-webkit` | FAIL esperado (control) | 1 |
| `negative-national-reachability-chromium` | FAIL esperado (control) | 1 |
| `negative-national-reachability-webkit` | FAIL esperado (control) | 1 |
| `negative-scroll-chromium` | FAIL esperado (control) | 1 |
| `negative-scroll-webkit` | FAIL esperado (control) | 1 |
| `negative-warm-404` | FAIL esperado (control) | 1 |
| `performance-chromium` | FAIL conservado | 1 |
| `performance-webkit` | PASS | 0 |
| `phase5a-desktop` | PASS | 0 |
| `phase5a-mobile` | PASS | 0 |
| `traveller-focus-chromium` | PASS | 0 |
| `traveller-focus-webkit` | PASS | 0 |
| `vitest` | PASS | 0 |

[Manifiesto final asociado a este código](B10_AUTHORIZED_CONTINUATION_EVIDENCE.json) incluye inputs/blobs, archivos escritos, todos los trabajos y sus comandos/entorno/SHA, intentos previos con su alcance original, máscaras visuales y autocontroles, datos e integridad, OSM real y candidata física exacta. El tar usa hardlinks estándar sólo para archivos byte a byte idénticos, conservando cada ruta lógica y su hash; ensamblar partes en orden, comprobar SHA256 y luego verificar los miembros. Misión/decisiones/auditoría/handoffs y #177 reflejan los mismos bloqueos. Checkpoints de implementación y documentación distinguidos, todos no forzados.


El residual también conserva reglas ya expresadas en tokens (por ejemplo city-sheet, gallery y estados hover). No se vuelven a sustituir valores canónicos ni se desplazan aisladamente por delante de tags/shortcuts para aparentar retirada completa: sus superficies/dueños incluyen deuda o su extracción rompería el orden literal preservado. Se documenta la extracción del marco inicial plenamente canónico, y la retirada completa de App.css queda pendiente junto a los valores/intervalos concretos enumerados.


Integridad de publicación final: **2637/2637 PASS** (seis partes, tar ensamblado, 1553 rutas lógicas, 1068 inputs del SHA probado y nueve recursos escritos). Archivo ensamblado **49917441 bytes**, seis partes en orden; 747 hardlinks de contenido idéntico conservan todas las rutas. [Comprobación independiente de esta entrega](evidence/b10/authorized-20261002/stable-final-integrity.json). Este recuento se distingue de los 4036 históricos y 482 de los tres lotes previamente publicados.
