# Auditoría de integración B21 + B6.1 — PR #141

**Fecha de auditoría:** 23 de septiembre de 2026

**Autoridad normativa:** `docs/design/`

**Estado:** certificación final **PASS**. B21 y B6.1 integrados; PR #141 apto para merge a la rama canónica B21, sujeto a la comprobación remota final.

## Topología Git publicada

| Referencia | Estado comprobado |
|---|---|
| Base canónica B21 | `codex/block-21-b5-explore-home-map` @ `7e0e83339ad0ea46be8cfb52befd14b3e67d0632` |
| Rama consolidada | `codex/block-21-b5-explore-home-map-10303448645469361664` |
| HEAD publicado al iniciar la auditoría | `80f148b5380bc2ba022f22eac36163f1f1e089ff` |
| PR de consolidación | [#141](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/141), abierto contra la base B21 |
| Fuente B6.1 | `codex/block-22-b6-1-grade-s-photography` @ `e6693a4ffe89400b356c8159fb47865d075808a4`, [PR #138](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/138) |

La historia publicada de #141 contiene **un commit** después de `7e0e833`: `80f148b`. El SHA B6.1 no es ancestro de #141: sus archivos de fotografía y metadatos se incorporaron por contenido en ese commit único. La comparación de esos archivos entre `e6693a4` y `80f148b` no mostró diferencias. No existe una rama remota `integration/b21-b6-1`; tampoco se publicó una secuencia separada de checkpoints B21 ni un merge `--allow-unrelated-histories`. El SHA local `b16a9e6` no se usa como referencia remota de cierre.

El diff base → #141 comprende portada ExplorerHome, búsqueda global, mapa nacional y de ciudad, DD-003/DD-004, documentación y gate B21, además de fotografía B6.1 (metadatos, roles, LQIP, originales nuevos, derivados `-400w`/`-800w`, pipeline, validadores y pruebas). No contiene rutas `docs/astra/`, archivos Astra, planner ajeno, B6.2, B7/B8/B9 ni cambios a `main`. `app/src/data/place-images.ts` no cambia en el diff y coincide con el SHA-256 fijado en el baseline: `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb`.

## Gates ejecutados

| Gate | Resultado real |
|---|---|
| `python scripts/validate-photography.py` | PASS; manifest y metadata válidos |
| `python scripts/test_photography.py` | 38/38 |
| `python scripts/test_photography_rendition.py` | 28/28 |
| `python scripts/test_block22_photography.py` | 8/8 |
| `python scripts/build-photography-derivatives.py --check --quiet` | PASS; 167 registros, 400 px y 800 px |
| `npm run build` | PASS; aviso de tamaño de chunk >500 kB |
| `npm run lint` | Código de salida 0; una advertencia `react(only-export-components)` en `PlaceMap.tsx` |
| `npx vitest run --reporter=dot` | 100 archivos; 3327/3327 tests |
| B17 `b17-regression-check.mjs`, `b17-tap-target-check.mjs`, `b17-responsive-check.mjs` | 18/18, 16/16, seis viewports sin overflow |
| B18 `b18-a11y-check.mjs`, `b18-browser-back-check.mjs`, `b18-chrome-check.mjs`, `b18-regression-check.mjs`, `b18-responsive-check.mjs`, `b18-viaje-lugar-check.mjs` | 23/23, 15/15, 6/6, 40/40, once viewports sin overflow, 38/38 |
| B19 `block19-grid-check.mjs`, `block19-contrast-check.mjs`, `block19-discovery-browser-audit.mjs` | 52/52, contraste dentro del contrato, 30/30 |
| B20 `block20-place-detail-check.mjs` | 73/73 |
| DDR-03 `ddr03-persistence-check.mjs` | 43/43 |
| Block 1 UX `block1-ux-browser-audit.mjs` | 153/153 |
| Block 2 Photography `block2-photography-browser-audit.mjs` | Evidencia anterior conservada: 81/81 |
| Phase 5A RC `phase5a-rc-browser-audit.mjs` | 50/50 desktop 1440×900; 50/50 móvil 390×844 |
| Phase 4 Photography `phase4c/d/f/h/j/l-browser-audit.mjs` | Evidencia anterior conservada: seis scripts PASS; Phase 4D 5/5, 4F 4/4, 4H 5/5, 4J 7/7, 4L 8/8; 4C informa PASS sin conteo |

Los scripts de navegador se ejecutaron con Microsoft Edge instalado localmente como Chromium. Para los scripts que fijaban `/opt/pw-browsers/chromium` se usaron copias temporales con sólo la ruta del ejecutable sustituida. B17/B18 responsive usaron un directorio de capturas local. Estas adaptaciones de entorno no cambiaron sus aserciones.

La metadata canónica y la copia de `app/src/data/` son idénticas: **167 imágenes, 161 lugares, 32/32 lugares S cubiertos**. Los 167 registros tienen `role` y LQIP. JP-033, JP-126, JP-203 y JP-204 tienen exactamente una imagen cada uno, con rol `identity`. El validador comprobó atribuciones/licencias y los derivados se verificaron a 400 y 800 px. SHA-256 de `data/visual/photography-metadata.json`: `c309c97e1e8bb694a1e39a60fa596b702c501d5d2ff1420a5325fd3cef882dc3`.

## Gates heredados y vigencia

| Requisito original | Vigencia | Causa del fallo previo | Sucesor aplicado | Resultado |
|---|---|---|---|---|
| B18: atribución MLIT accesible desde el mapa nacional | Vigente | `city-sheet__japan` devuelve a la nueva portada B21 | El gate abre la tarjeta «Ver Japón en el mapa» antes de pulsar ⓘ | 40/40 |
| Phase 4D: un lugar sin fotografía conserva fallback y no inventa licencia | Vigente | Los ejemplos teamLab Borderless y Tokyo Disneyland recibieron fotografía en B6.1 | Se prueban Takeshita Street y Nezu Shrine, aún sin foto | 5/5 |
| Phase 4F/H/J: entrada a Sapporo y Fukuoka | Vigente | B21 trasladó esos hubs a «Más destinos» | El helper localiza hubs en ambas secciones de la portada | PASS |
| Tests de fuente: contratos de B17/B18 y otros bloques | Vigentes | Rutas URL `/C:/...`, comparaciones LF contra CRLF y firma B18 anterior a B21 | Conversión URL→ruta nativa, normalización de fin de línea y aserciones B18 adaptadas al parámetro opcional de retorno global | 100 archivos, 3327/3327 |

## Auditoría específica B21 y cierre

La auditoría anterior reprodujo el fallo en Edge 390×844: consulta `a` (214 resultados), `.sheet__body.scrollTop=360`, apertura de ficha y regreso con scroll a 0. Además, `selectPlace(id, "explorar")` sincronizaba el hub del resultado; desde portada `activeHub=null`, así que abrir Tokio sustituía silenciosamente la vista nacional por Tokio. `SearchSheet` ejecutaba `onClose()` inmediatamente tras `onSelect()`, sin distinguir cierre temporal de cierre explícito. El autofocus posterior podía desplazar el body.

La corrección conserva un contexto explícito `exploreDetailReturnRef: "global-search" | null` durante toda la pila de fichas. `selectPlace`, `pushPlace`, `goBack`, `popstate` y la restauración del trail consultan ese contexto; la apertura global no cambia `view` ni ejecuta `enterHub`. La Sheet global usa `closeOnSelect={false}` y se desmonta temporalmente al seleccionar; el cierre explícito limpia el contexto. Las búsquedas de ciudad mantienen el valor por defecto `closeOnSelect=true` y su navegación histórica. `Sheet` recibe opcionalmente `initialBodyScrollTop` y `onBodyScroll`, aplicados al scroll owner real `.sheet__body`; App guarda la posición en un ref y la restaura al remontar. El foco del botón y del campo usa `preventScroll: true`.

Gate permanente: `app/scripts/b21-global-search-browser-audit.mjs` contra el build de producción en Edge, **33/33 móvil 390×844 y 33/33 escritorio 1440×900**. En ambos: UI back y browser back restauran automáticamente consulta `a`, 214 resultados y **scrollTop 360→360**, verificado dos frames después del remonte; la apertura de Tokio y toda la pila de «Cerca de aquí» dejan visible la portada nacional subyacente; browser back recorre C→B→A→búsqueda con scroll 360→360; cerrar la búsqueda devuelve a portada; «Buscar en Tokio» conserva filtro, cierre al seleccionar y retorno a ciudad sin búsqueda global antigua.

Cierre técnico posterior al arreglo: `npm run build` PASS (aviso conocido de chunk >500 kB); `npm run lint` exit 0 con **una** advertencia `react(only-export-components)` en `PlaceMap.tsx:14`. `gradeColors` ya se exportaba en la base canónica B21 `7e0e833`, por lo que la advertencia es heredada, no causada por #141 ni por los gates locales. La mención previa de “0 warnings” no coincide con la ejecución actual y queda corregida aquí. Vitest **100 archivos, 3327/3327**. Gates repetidos tras el arreglo: B18 browser back 15/15 y regression 40/40; B19 discovery 30/30 y grid 52/52; B20 73/73; DDR-03 43/43; Block 1 UX 153/153; Phase 5A desktop 50/50 y móvil 50/50; B21 completo 33/33 en cada viewport. El gate nuevo y tres pruebas de fuente B21 protegen el contrato. `git diff --check` sin errores.

La fotografía B6.1 no recibió cambios en este arreglo: `place-images.ts` conserva SHA-256 `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb` y la metadata conserva `c309c97e1e8bb694a1e39a60fa596b702c501d5d2ff1420a5325fd3cef882dc3`. Se mantiene la evidencia anterior de validadores, derivados, 167 imágenes, 161 lugares y 32/32 S. No se inició B6.2, no se hizo merge, y #138 y `main` no se modificaron.
