# B10 — continuación autorizada desde c868bd3 (2026-10-02)

**INCOMPLETO; #177 Draft, sin merge/deploy.** Inicio `c868bd3e5bbb7df15ae44928476aa425f330ba12`. Los manifiestos históricos no se reetiquetan. Esta ejecución conserva backup/RC/main y publica únicamente en `codex/b10-pulido-mission`.

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
