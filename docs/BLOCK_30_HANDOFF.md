# B30 — B9.4 «Dónde dormir» · Handoff

La auditoría cruzada final de PR #169 y las decisiones frente a #168 se registran en [BLOCK_30_FINAL_CROSS_AUDIT.md](BLOCK_30_FINAL_CROSS_AUDIT.md). Ese informe y los SHA remotos de la descripción de #169 sustituyen el estado de publicación pendiente de este handoff histórico.

## Cierre vigente

**B30 / B9.4 CERRADO E INTEGRADO EN MAIN** mediante #169, #171 y #172. Main certificado: `a21920bcef2478ba1e5c0367e118a997f20acc31`; B30 Chromium 2/2 y WebKit 2/2, 475/475 por ejecución. Véase [certificación final de main](BLOCK_30_MAIN_CERTIFICATION.md) para SHA, race, pruebas, flakiness y deuda. B31 / B9.5 NO fue iniciado.

Lo que sigue conserva la evidencia histórica de implementación; sus estados de publicación pendiente y cifras anteriores quedan sustituidos por el cierre vigente.

## Estado histórico de la rama

- Base certificada al iniciar: `main` y `origin/main` en `a7b916be005f002e46c67442968379f72d3b480d`.
- Rama: `codex/block-30-b9-4-donde-dormir`.
- Commit de implementación local: `041a0e7cd3bd6d300c881304757eeaad39b27220`.
- HEAD documental de partida: `88d3699a95eca2efc2d702cfa83599025f40d650`.
- Antes de publicar, la API de GitHub confirmó `main` en `a7b916be005f002e46c67442968379f72d3b480d`. El `git fetch` de este runner no conectó al proxy; no se usó ese fallo de red para inferir el estado remoto.
- El push normal no pudo autenticarse en este runner; la autorización vigente permite publicar por el conector de GitHub. Estado de rama remota y PR: pendiente de esta publicación.
- El PR #166 paralelo de B29 se cerró como supersedido por #167. No se fusionó ni se borró su rama. El PR #167 sigue siendo la línea canónica de B29, integrada.

## Arquitectura encontrada

«Dónde dormir» vive en `Viaje › Dónde dormir`, dentro de `ZoneComparison`. Mantiene los modos de alternativas y comparación de hasta cuatro zonas, la navegación B18 hacia `PlaceDetail`, las fuentes de zona y la elección existente de alojamiento para el plan.

El registro contiene 16 zonas de Tokio, Kioto y Osaka. Cada zona tiene estación de referencia y coordenadas, Shinkansen, líneas ferroviarias, enlaces de aeropuerto con procedencia, resumen, diez valoraciones editoriales y trade-offs. `zoneSavedPlacesFit` calcula medianas y distancias rectas desde la estación a lugares de un hub; no calcula rutas ni tiempos.

La pantalla antes calculaba con `savedPlaces` («Quiero ir») y ordenaba por proximidad. B30 lee `routeIds` del draft V8 de forma read-only, conserva sólo lugares de la ruta del hub seleccionado, y muestra el cálculo de cada zona en paralelo. Las alternativas mantienen el orden del catálogo; no se ordenan ni puntúan por cercanía.

La inspección del registro fotográfico de 244 entradas y de los assets encontró cero fotografías con sujeto de zona. El catálogo actual está indexado por lugar, no por zona. B30 usa un marco con nombre de zona y el rótulo accesible «Fotografía pendiente»; no toma imágenes de POI ni introduce otro registro. La incorporación de fotos queda ligada a los assets de zona de B6.7.

## Diseño y contratos

- **Hecho:** la sección «Hechos · Registrado» conserva los datos del registro de zona y `ZoneSources`; los enlaces de fuente se muestran con procedencia.
- **Cálculo:** «Cálculo de cercanía a este viaje · Estimado · Línea recta» reutiliza `zoneSavedPlacesFit`; enseña mediana, lugares cercanos y su distancia recta. El texto dice cuántos lugares de la ruta de ese hub se usaron y aclara que el catálogo no se ordena por proximidad. Sin esos lugares, no se muestra un cálculo.
- **Opinión:** «Opinión · Nihon dice» contiene resumen y trade-offs editoriales, separados del bloque factual y del cálculo.
- Las zonas ya no tienen ordinales en tarjetas, columnas ni marcadores. Los marcadores no codifican recomendación.
- El comparador conserva su clave `nihon.zoneComparison.v1), pero el montaje ya no la reescribe. Sólo una selección explícita cambia esa preferencia.
- El contexto de viaje se lee desde V8; abrir la pantalla y cambiar a compare no escriben `nihon.manualPlanningDraft`. Abrir no reescribe `nihon.zoneComparison.v1`; cada selección explícita se conserva sólo en esa clave existente. La acción humana se presenta como «Dormir aquí» y conserva la mutación V8 de elección de zona/alojamiento de referencia. No reserva hotel ni asigna límites diarios.
- No cambian el esquema V8, la clave de storage, el cálculo de traslados, las semánticas de reservas, los IDs estables ni la composición del viaje.

## Verificación ejecutada

| Gate | Resultado |
|---|---|
| `git diff --check` | PASS |
| `npm run build` | PASS; queda el warning existente de bundle principal >500 kB |
| `npm run lint` | Exit 0; un warning existente de `PlaceMap.tsx:17` (`react/only-export-components`) |
| Vitest completo | PASS, 114 archivos y 3465/3465 tests |
| Suites dirigidas de zonas, V8, stable day identity, secuencia, alojamiento e inter-hub | PASS, 13 archivos y 342/342 tests |
| B30 browser | PASS, 360/360 con Chromium `/usr/bin/chromium`; cubre los ocho viewports, teclado, foco, 44 px, reduced motion, cero escrituras V8 al abrir/comparar, selección de comparación sólo en su clave existente, elección explícita, reload, datos vacíos y snapshot del plan |
| B29 | PASS, 163/163; el gate anidado B28 también PASS 64/64 |
| B28 | PASS, 64/64 con mouse/touch y ocho viewports |
| B27 | PASS, A–K y ocho viewports |
| B26 | PASS, 314/314 |
| B25 | **No PASS por el entorno; comparación base/B30 completada:** con el mismo Chromium `/usr/bin/chromium`, proxy preload, build de producción y gate, B30 dio 122/123 y la base `a7b916be...` dio 122/123. En ambos falló únicamente `C-CLEAN` al abrir el estado vacío, con `ERR_CERT_AUTHORITY_INVALID` de recursos externos; el viewport afectado varió (1440×900 en B30, 390×844 en base). Otra ejecución previa de B30 dio 121/123 y una 122/123. La base reproduce el mismo tipo de fallo externo: B30 no introduce esta regresión. No se desactivó TLS ni se modificó B25. |
| B18 browser back | 15/15 checks funcionales; el proceso termina con éxito, pero registra errores externos `ERR_CERT_AUTHORITY_INVALID`. |

El primer B28 ejecutado a la vez que B29 tuvo un fallo intermitente de cancelación de auto-scroll; al repetir B28 aislado pasó 64/64, y el B28 anidado dentro del B29 pasó 64/64. No se cambió la implementación B28.

Chromium muestra el mapa base sin teselas en este runner: la comprobación al proveedor OSM recibe respuesta bloqueada por su política de tiles automatizadas. Los marcadores se renderizan y no producen overflow; la cobertura del proveedor externo no se certifica desde este entorno. Las comprobaciones B25/B18 también registran errores de certificado de recursos externos. No se desactivó TLS.

## Capturas y deuda

Las capturas del gate final están en `/tmp/b30-final-shots/` durante esta sesión. Incluyen browse y compare en los ocho viewports; la ruta temporal no forma parte del árbol de fuentes.

Deuda real:

1. Añadir fotografía de zona cuando exista cobertura licenciada de zona en el pipeline B6.7.
2. Resolver el acceso del runner a los recursos externos para que los gates antiguos B25/B18 no fallen sus comprobaciones de consola por certificado y para ver teselas OSM durante una auditoría cloud.
3. Completar la publicación autorizada de la rama y abrir el PR Draft; no hubo merge ni deployment.

B9.5, B10, Astra y Vercel no se iniciaron ni se modificaron.
