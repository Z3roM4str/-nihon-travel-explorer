# Bloque 24 — Handoff reanudable

Auditoría con input real y corrección de superficies construidas. Misión íntegra:
`docs/BLOCK_24_MISSION.md`. Autoridad normativa: `docs/design/` (00–10). Auditoría por hallazgo:
`docs/BLOCK_24_UX_AUDIT.md`.

## Estado: B24 COMPLETO en rama, sin PR ni merge

- Todos los P0 y P1 FIX-NOW corregidos, incluido P0-4e (F7, `DD-026`); gate B24 **100 % verde**
  en los 8 viewports (1347/1347 y 1351/1351 en dos corridas completas; rojo en la base con el
  script de F5: 429/721, 292 fallos). Ningún P0 propio de B24 queda deferred.
- DDR-B24-1/2/3 resueltas (`DD-023/024/025`); 5 DEFERRED-ACTIVE-BRANCH + 7 DEFERRED-ROADMAP
  documentados.
- Ninguna zona protegida tocada (verificado con `git diff --name-only 4afbf50..HEAD`): ni
  `PlaceCard.tsx`, `PlaceGallery.tsx` y sus tests, ni reglas `.place-card__save*`,
  `.place-card__photo-retry*`, `.gallery__retry`, ni datos/scripts/imágenes de fotografía, ni
  `block22-b6-5-*.mjs`, ni `OrderedSequenceBuilder.tsx`.

## Rama y base

| Campo | Valor |
|---|---|
| Rama | `claude/block-24-ux-real-input-audit` (única rama de push) |
| Base canónica | `origin/codex/block-22-b6-7-grade-a-depth-photography` @ `4afbf50e9d1e3137f9148c6c471c1c40aac6a56f` |
| Ascendencia | desciende de B21 `0390708df514215778a835b4e2328a85854c759d`; los 46 ficheros entre B21 y la base son sólo fotografía (`app/public/images/**`), metadatos (`photography-metadata.json` ×2, `data/visual/block22-b6-7-*`) y scripts de fotografía |
| `origin/main` | `8eb725eeb836ca121180f8dd8b0dc49c65efae25` (verificado, intacto) |
| `origin/codex/block-21-b5-explore-home-map` | `0390708df514215778a835b4e2328a85854c759d` (verificado) |
| Líneas protegidas NO incorporadas | B23 `52a7073` (no ancestro); B6.5 timing fix `af21671` (no ancestro) |
| PR / merge | ninguno |

## Línea base (F1, medida en `4afbf50` en este contenedor Linux)

| Puerta | Esperado por la misión | Medido | Nota |
|---|---|---|---|
| build | PASS | **PASS** | chunk principal `index-*.js` 1.648,69 kB (388,21 kB gzip) |
| lint | 0 errores, 1 warning `PlaceMap.tsx:14` | **0 errores, 1 warning `PlaceMap.tsx:14`** | heredado |
| vitest | 3328/3329 (timeout de `block20-place-detail.test.ts`) | **3321/3329 — 8 fallos, 2 ficheros** | ver abajo |

**Discrepancia de línea base (registrada, no corregida).** En este contenedor el timeout de
`block20-place-detail.test.ts` no se reprodujo (24/24). Los 8 fallos reales son otros y están
**todos en zona protegida B6.7**:

- `src/data/place-images.test.ts` — 5 fallos («carries the Phase 4H/4J/4L tranche…», «gives
  additional photographs only to the places selected by Block 2, B6.4, and B6.5», «keeps every
  place outside those selections at exactly one photograph»).
- `src/photography-depth.test.ts` — 3 fallos («adds depth only to places of the highest
  interest», «leaves the great majority of the catalogue at a single photograph», «still resolves
  exactly one image for a single-photograph place»).

Causa: los commits B6.7 `8601a9d`/`4afbf50` añaden segundas fotografías (p. ej. JP-001 pasa de 1
a 2 imágenes) y las expectativas de estos tests todavía dicen «una sola». En B21 `0390708` los dos
ficheros pasan 36/36 (comprobado en un worktree temporal). Estado:
**DEFERRED-ACTIVE-BRANCH (B6.7)** — actualizar esas expectativas es trabajo de la rama de
fotografía, no de B24.

**Timeout de B20.** Se da al test `B20 no modifica OrderedSequenceBuilder.tsx` un timeout propio
de 30 s (`git diff` sobre un árbol con cientos de imágenes supera los 5 s bajo carga). Su
expectativa no cambia; nada más cambia en ese fichero.

## Gate B24 — `app/scripts/b24-real-input-audit.mjs`

Escrito antes de cualquier arreglo. Rueda real (`page.mouse.wheel`), clic real en coordenadas
tras `elementFromPoint`, muestreo de píxeles del SVG, teclado real; 8 viewports
(320×568 · 375×667 · 390×844 · 430×932 · 820×1180 · 1024×768 · 1280×800 · 1440×900).

Uso: `npm run build && NIHON_CHROMIUM_PATH=<chromium> node scripts/b24-real-input-audit.mjs`
(opcional `--viewport=390x844`). Capturas en `/tmp/b24/`, nunca en el repo.

**Rojo antes de los arreglos (Checkpoint A): 426/716 comprobaciones, 290 fallos.**

| Hallazgo | ok · fallos |
|---|---|
| P0-1 portada sin scroll | 19 · 53 |
| P0-2 iconos `.icon-button--small` | 42 · 30 |
| P0-3 contador de ciudad | 0 · 48 |
| P0-4 mapa de ciudad | 34 · 32 |
| P0-5 búsqueda global | 32 · 32 |
| P1-CLUSTER «Mismo cluster» | 0 · 8 |
| P1-FILTER FilterSheet | 0 · 32 |
| P1-FOCUS foco tras Escape | 0 · 8 |
| P1-HERO héroe < md | 7 · 3 |
| P1-MAS «Más destinos» cortado | 4 · 4 |
| P1-NEST panel anidado | 0 · 8 |
| P1-ONB onboarding | 0 · 24 |
| P1-TOAST toast D-M4 | 0 · 8 |
| KBD / MOTION / NAV | 40 · 0 / 32 · 0 / 216 · 0 |

## Checkpoints

| Checkpoint | SHA | Contenido |
|---|---|---|
| A — preflight + gate rojo | `454d31a` | misión, handoff base, gate B24 en rojo, timeout B20 |
| B — auditoría | `77a3345` | `docs/BLOCK_24_UX_AUDIT.md`: 19 FIX-NOW, 1 DDR, 5 DEFERRED-ACTIVE-BRANCH, 6 DEFERRED-ROADMAP |
| C — P0 | `7794fd1` | P0-1…P0-5 FIX-NOW en verde en los 8 viewports (663/758; los 95 fallos restantes son P1 pendientes). DD-018…022 y DDR-B24-1/2/3 en `09` |
| D — P1 | `f0b8b22` | P1-01…P1-12 y P2-7 corregidos; gate **763/763** en los 8 viewports |
| E — regresión | `6b100e5` | 1 regresión propia encontrada y corregida (`d901e03`); 1 expectativa de gate B19 actualizada citando `03 §9` (`e1b4f7d`); gate B24 **795/795** |
| F — cierre DDR-B24-1/2/3 | `9fba00f` | `DD-023/024/025` en `09`; encuadre editorial + agrupación siempre activa (`5e76ef7`); colecciones de la portada (`035514b`); gate B19 robusto (`6e6044a`); gate B24 **873/875** (2 hallazgos, ver abajo) |
| G — cierre real (F7) | (este commit) | P0-4e corregido (`DD-026`, `lib/map-chrome.ts`); regresión R-F7 (`flyTo` con mapa oculto) corregida; gate P1-FILTER estabilizado; fechas; gate B24 **1347/1347 · 1351/1351** |

## F5 — Regresión (HEAD `e1b4f7d` + docs)

| Puerta | Resultado | Nota |
|---|---|---|
| build | **PASS** | `index-*.js` 1.650,84 kB (388,94 kB gzip): +2,15 kB frente a la base (agrupación del mapa) |
| lint | **0 errores, 1 warning** heredado Fast Refresh | ahora en `PlaceMap.tsx:15` (antes `:14`): el import nuevo de `map-grouping` desplaza la misma línea |
| vitest | **3331/3339** (101 ficheros) | los **mismos 8 fallos de la base** (B6.7, ver arriba), 0 nuevos; +10 tests nuevos (`map-grouping` 7, `transfer` 3) |
| B17 regression / responsive / tap-target | 18/18 · sin overflow · **16/16** | tap-target encontró la regresión de la cabecera de filtros (ver abajo) |
| B18 a11y / browser-back / chrome / regression / responsive / viaje-lugar | 23/23 · 15/15 · 6/6 · 40/40 · OK · 38/38 | |
| B19 discovery / grid / contrast | 30/30 · **52/52** · todas dentro de contrato | grid: expectativa actualizada (`e1b4f7d`) |
| B20 place detail | 73/73 | |
| B21 (DDR-B21) global search | móvil 33/33 · escritorio 33/33 | |
| DDR-03 persistencia | 43/43 | |
| Block 1 UX | 153/153 | |
| Block 2 Photography | 81/81 | |
| Phase 5A RC | escritorio 47/50 · móvil 47/50 | **idéntico en la base `4afbf50`** (47/50, mismos A06, A07, E01): A06/E01 esperan una sola `.gallery__image` y B6.7 da dos a JP-001; A07 busca el texto de fallback «Sin fotografía disponible todavía». No lo causa B24 → DEFERRED-ACTIVE-BRANCH (B6.7) |
| **B24 real input audit** | **795/795** | base con el mismo script: 429/721 (292 fallos) |

Los «Console errors» de los gates son `net::ERR_CERT_AUTHORITY_INVALID` de las teselas OSM: el
contenedor no alcanza `tile.openstreetmap.org` a través del proxy. Entorno, no aplicación.

**Regresión propia encontrada en F5 y corregida (`d901e03`).** Al retirar el desplegable
«▾ Filtros» (P1-01), la altura de la cabecera pegajosa dejaba de venir de ese botón de 44 px; al
activar el primer filtro aparecía «Limpiar (n)» en otra línea, la cabecera crecía 7 px y el segundo
toque caía en el chip vecino (lo detectó `b17-tap-target-check`). Arreglo: cabecera con alto mínimo
de 44 px, «Limpiar» en la línea del estado con área de 44 px (`.tap-target-min`) y
`scroll-padding-bottom` para que lo enfocado quede por encima del pie fijo. El gate B24 lo vigila.

**Expectativas de test cambiadas (con norma).**
- `block18-shell.test.ts` — `OWNER_SELECTOR` incluye `.app__body--home` (`05 §2` pt. 2, `04 §11`).
- `block19-grid-check.mjs` — «no perder marcadores» se cuenta en lugares representados (`03 §9`:
  el seleccionado sale de su grupo «encima de todos»); 57/57/57.
- `block20-place-detail.test.ts` — sólo timeout propio de 30 s en un test (misión §1).

## F6 — Cierre DDR-B24-1/2/3 (HEAD `6e6044a` + este commit de docs)

**Preflight de esta sesión.** `git fetch --all`; HEAD inicial `6b100e5a76349275b89766239875a312d801f110`
(idéntico al remoto, working tree limpio, rama correcta). Base B24 `4afbf50e9d1e3137f9148c6c471c1c40aac6a56f`
sigue siendo la misma. B23 `52a7073799bdeeb180949ef379275201a94879fe` y B6.5-fix
`af21671a99b63b451df11ac15c11775d94dc324e` verificados como no-ancestros de HEAD (`git merge-base
--is-ancestor` niega ambos).

**Resolución e implementación exacta.**

- **DDR-B24-1 (→ `DD-023`).** Encuadre editorial por hub con fallback calculado. `lib/hub-view.ts`
  (nuevo): `HUB_EDITORIAL_VIEW` con centro/zoom para Tokio/Kioto/Osaka/Okinawa (calculados sobre la
  mediana + radio 10 km del propio dataset, reproduciendo la evidencia de la auditoría: 48/57,
  39/49, 23/53, 11/50 lugares en el núcleo); `calculatedHubCore`/`resolveHubView` para cualquier
  otro hub. `FitHubBounds` (`PlaceMap.tsx`) deja de llamar `fitBounds`/`flyToBounds` con todos los
  lugares del hub; sólo actúa cuando `hasSelection` es falso (ninguna ficha abierta), para que
  `FocusSelected` (que corre después, en un `useEffect`, no un `useLayoutEffect`) siga ganando
  siempre que hay un lugar seleccionado explícitamente.
- **DDR-B24-2 (→ `DD-024`).** `MarkerLayer` llama `groupScreenPoints` incondicionalmente (antes
  gateado por `shouldGroupMarkers(visibleCount)`, que sólo agrupaba por encima de 12). Como
  `groupScreenPoints` ya sólo fundía parejas cuyas cajas de 44 px se tocarían, aplicarla siempre
  cubre la regla de densidad de `03 §9` y la red de seguridad geométrica de Art. 11 con el mismo
  código, y las vuelve a separar en cuanto el zoom aleja las cajas.
- **DDR-B24-3 (→ `DD-025`).** `exploreReturnSurface` gana `"home-collection"` junto a
  `"global-search"`. Las tres comprobaciones que antes miraban específicamente
  `=== "global-search"` (el salto de hub en `selectPlace`, en `pushPlace`/`goBack`, y la
  restauración de vista de un back real de navegador en `restoreViewForTrail`) pasan a mirar
  "cualquier valor no nulo". `ExplorerHome` etiqueta sus selecciones con `"home-collection"`. El
  resto del contrato (apilado sobre la portada, portada nunca desmontada, restauración de scroll)
  ya lo daba la arquitectura existente una vez quitado el salto de hub.

**Pruebas y gates.**

| Puerta | Resultado |
|---|---|
| `src/lib/hub-view.test.ts` (nuevo) | 6/6 — encuadre editorial de los 4 hubs, no lo determinan los outliers, núcleo calculado reproduce la evidencia de la auditoría, fallback para hub sin editorial, fallback sin lugares |
| `src/lib/map-grouping.test.ts` (ampliado) | 13/13 — los 4 conflictos de la auditoría (Shibuya Crossing/SHIBUYA SKY, Kioto ×2, Osaka, Okinawa) con proyección Web Mercator real; se separan al alejar el zoom |
| `src/block24-ddr3-home-collections.test.ts` (nuevo) | 4/4 — contrato de código de la generalización de `exploreReturnSurface` |
| `src/block21-global-search.test.ts` (actualizado) | expectativa de código generalizada citando DDR-B24-3 |
| `app/scripts/b24-ddr3-home-collections-check.mjs` (nuevo, Playwright) | 9/9 — apertura desde colección, sin cromo de ciudad, cierre por UI/Escape/back con restauración exacta de scroll |
| vitest completo | 3347/3355 (8 fallos, los mismos de la base B6.7 — ver abajo) |
| build | PASS — `index-*.js` 1.651,51 kB |
| lint | 0 errores, 1 warning heredado (Fast Refresh, `PlaceMap.tsx:16`) |
| `block19-grid-check.mjs` | 52/52 (tras la corrección del propio gate, ver «Regresiones» abajo) |
| `b24-real-input-audit.mjs` (8 viewports) | **873/875, 2 fallos** (ver «Regresiones» abajo) |

**Regresiones encontradas y corregidas.**

1. **`block19-grid-check.mjs` — «el mapa conserva el zoom en todo el ciclo».** Dos causas reales:
   (a) sin red de teselas en este contenedor, una capa de teselas vieja podía quedar sin podar con
   una escala CSS residual ajena al zoom real — el gate ahora lee el zoom del propio `z` de las
   URLs de tesela pedidas, señal estable pase lo que pase con la red; (b) `FitHubBounds` competía
   de verdad con `FocusSelected` por la vista mientras la ficha estaba abierta (ambas reaccionaban
   a `panelOffset`) — `FitHubBounds` ahora no actúa mientras hay una selección. Verificado también
   contra la base sin estos cambios (52/52 limpio) para confirmar que la causa era de esta
   implementación, no del entorno.
2. **`block18-shell.test.ts`** — expectativa de la firma de `selectPlace` actualizada para incluir
   `"home-collection"` (contrato de código, no de comportamiento).

**Regresión encontrada en F6 — P0-4e (CORREGIDA en F7, ver §F7).** Al
expandir el grupo mayor de Tokio a 375×667, «Daikanyama T-SITE» queda exactamente bajo
`.interest-legend__summary`; `elementFromPoint` resuelve a la leyenda, no al marcador. No ocurre en
la base `4afbf50` (0 fallos). Se intentaron dos ajustes de encuadre en `expand()` (`PlaceMap.tsx`)
sin éxito verificable: la posición final del marcador depende de la geometría completa de los 57
lugares de Tokio a ese zoom, no sólo de los miembros del grupo expandido — un ajuste fiable exige
una zona muerta reservada en el propio contenedor del mapa o mover la leyenda de esquina, ambas
decisiones de diseño/`08` fuera del alcance de este cierre. F6 lo dejó como DEFERRED-ROADMAP;
dirección lo rechazó (P0 introducido por B24) y se corrigió en F7.

**Segundo hallazgo del gate B24, no reproducible en aislamiento (en F7: carrera del gate, estabilizado — ver §F7).** «P1-FILTER primer chip sin
marcar: centro fuera del viewport» a 320×568 apareció en las corridas completas de 8 viewports pero
**no en 3/3 corridas aisladas de ese único viewport** (108/108 limpio); no toca código de
filtros. Se registra como flake de la corrida completa en este contenedor, no como regresión.

**Corrección documental de fechas.** DD-018…022 y DDR-B24-1/2/3 quedaban registradas con una
fecha posterior a la de la sesión de creación (2026-09-25) — corregido en `docs/design/09`. En F7
se completó: DD-023/024/025 y el cierre de DDR-B24-1/2/3 también son del 2026-09-25 (ver §F7).
No se tocó ninguna fecha de decisiones anteriores.

## F7 — P0-4e corregido y cierre real de B24

**Preflight.** HEAD inicial `9fba00fef74d4c1dc87d234d18be135a970f413c` (el contenedor venía en
`6b100e5`; `git fetch` + fast-forward al remoto, sin cambios locales). B23 `52a7073`, B6.5-fix
`af21671` y `claude/block-22-b6-7-test-closure` @ `61fa5e9` no se incorporan.

**P0-4e — causa técnica.** Ningún movimiento programático del mapa tenía en cuenta el cromo que se
le superpone. `InterestLegend` es hermana del contenedor de Leaflet dentro de `.app__map-area`
(`z-index: 10` sobre el panel de marcadores); `FitHubBounds`, `expand()` y `FocusSelected` no
conocían ese rectángulo. El encuadre `fitBounds` de la base dejaba por casualidad libre la
esquina; `DD-023`/`DD-024` cambiaron la geometría y, tras abrir el grupo mayor de Tokio a
375×667, la caja de 44×44 de «Daikanyama T-SITE» caía bajo `.interest-legend__summary`.

**P0-4e — solución (`DD-026`).** El cromo interactivo es zona de exclusión tras cualquier
movimiento programático:

- `app/src/lib/map-chrome.ts` (nuevo, geometría pura): `chromeClearingShift` devuelve la
  traslación más corta que deja todas las cajas de 44×44 fuera del cromo, sin meter otra debajo,
  sin sacar de pantalla a las liberadas ni al seleccionado. Una traslación no altera la
  agrupación. `src/lib/map-chrome.test.ts` (nuevo, 6 tests).
- `PlaceMap.tsx`: todo movimiento programático (encuadre inicial, abrir un grupo, centrar la
  selección) pasa por `moveProgrammatically`; al terminar (`moveend`, siguiente fotograma), la
  guarda de `MarkerLayer` proyecta los objetivos reales, mide en vivo el cromo
  (`[data-map-chrome]` + `.leaflet-control`) y hace `panBy` si hace falta. También al volver a
  mostrarse un mapa oculto. Los gestos de la persona no se corrigen.
- `InterestLegend.tsx`: sólo declara `data-map-chrome`. Misma posición, tamaño y estilo.
- Nada hardcodeado a un lugar, ciudad o viewport; sin bajar de 44 px; sin `z-index`; sin ocultar
  lugares; la leyenda no se mueve.

**R-F7 — regresión propia de F6 encontrada en la regresión final y corregida.** Desde `5e76ef7`,
`FitHubBounds` vuelve a encuadrar al cerrarse la ficha aunque el mapa esté oculto (otro destino,
contenedor 0×0); `flyTo` de Leaflet divide por ese tamaño, calcula `LatLng(NaN, NaN)` y lanza, y
la excepción desmonta la app entera. `b18-viaje-lugar-check` lo encontró (timeout esperando
`.place-detail`, pantalla en blanco): 38/38 en `6b100e5`, falla en `5e76ef7`, `035514b`,
`9fba00f`. F6 no había vuelto a pasar ese gate. Arreglo: los movimientos programáticos sólo se
animan si el mapa tiene tamaño (`canAnimate`). 38/38.

**P1-FILTER «flake» — diagnóstico.** Carrera **del gate**: medía el primer chip dos fotogramas
después de abrir la hoja, que entra con una animación de 320 ms. Muestreado cada 40 ms a
320×568: centro del chip en y≈620 (fuera de pantalla) → 383 → 322 → … → 266, estable al acabar la
animación. No es carrera de la app ni regresión. El gate espera ahora a `getAnimations()` de la
hoja antes de medir; la expectativa no cambia.

**Gate B24 ampliado — hallazgo `P0-4e`.** En los 8 viewports, con y sin
`prefers-reduced-motion`: tras el encuadre inicial, tras abrir hasta tres grupos seguidos y tras
seleccionar un lugar (≥1024), cada marcador/grupo con el centro dentro del mapa mide ≥44×44, no
se cruza con ningún rectángulo de cromo y `elementFromPoint` en su centro resuelve a él; la
leyenda se abre y se cierra con clic real; los iconos representan el mismo número de lugares
antes y después de abrir grupos (no se pierde ninguno); abrir un grupo sigue repartiéndolo. Con el
`PlaceMap.tsx` de `9fba00f` el gate reproduce el fallo original a 375×667 (162/165: «Daikanyama
T-SITE» bajo `interest-legend`). Dos ajustes del dominio del gate, sin debilitarlo: un icono con
el centro exactamente en el borde de la ventana (`x = innerWidth`, `elementFromPoint` → `null`) no
cuenta como visible, y un marcador tapado por la ficha que se apoya sobre el raíl (`DD-016/017`,
cubrir está permitido) no es cromo del mapa.

**Puertas F7 (HEAD final).**

| Puerta | Resultado |
|---|---|
| build | PASS — `index-*.js` 1.653,74 kB (390,17 kB gzip) |
| lint | 0 errores, 1 warning heredado Fast Refresh (`PlaceMap.tsx:17`) |
| vitest | 3353/3361 — los mismos 8 fallos B6.7 (`place-images` 5, `photography-depth` 3); +6 tests (`map-chrome`) |
| `block19-grid-check.mjs` | 52/52 |
| B17 regression / responsive / tap-target | 18/18 · sin overflow · 16/16 |
| B18 a11y / browser-back / chrome / regression / responsive / viaje-lugar | 23/23 · 15/15 · 6/6 · 40/40 · OK · **38/38** (era rojo desde `5e76ef7`) |
| B21 global search | móvil 33/33 · escritorio 33/33 |
| DDR-B24-3 (`b24-ddr3-home-collections-check.mjs`) | 9/9 |
| B19 discovery / contrast · B20 place detail · DDR-03 | 30/30 · dentro de contrato · 73/73 · 43/43 |
| Block 1 UX · Block 2 Photography | 153/153 · 81/81 |
| Phase 5A RC | escritorio 47/50 · móvil 47/50 — idéntico a la base (A06, A07, E01; DEFERRED-ACTIVE-BRANCH B6.7) |
| **B24 real input audit (8 viewports)** | **1347/1347 · 1351/1351, 0 fallos** |

## Commits (base `4afbf50` → HEAD)

`0032c00` misión · `da7ce9b` gate rojo · `22fd492` timeout B20 · `454d31a` checkpoint A ·
`77a3345` auditoría (B) · `18c491f` DD-018…022 · `70789ef` P0-1 · `1206b0e` gate · `f0c1de1` P0-2 ·
`c6f9084` P0-3 · `d54126d` P0-5a · `7c74a82` P0-5b · `253bf7b` agrupación · `f4ffb7b` P0-4 ·
`b4d4e46` DDR-B24-1/2/3 · `7741371` gate · `960e0b7` test B18 · `3b4fd71` Art. 10 · `7794fd1`
checkpoint C · `057edd1` P1-01…04 · `4c58e61` P1-05 · `fca07f3` P1-06 · `c44dd80` P1-07 ·
`c27d383` P1-08 · `5ab0c0f` P1-09 · `462fbe1` gate · `37075e0` P1-10 · `776b5ba` gate · `c84b3aa`
P1-11/12 · `6035179` P2-7 · `f0b8b22` checkpoint D · `3f7f3b9` gate · `d901e03` regresión
FilterSheet · `e1b4f7d` gate B19 · `6b100e5` checkpoint E · `5e76ef7` DDR-B24-1/2 · `035514b`
DDR-B24-3 · `6e6044a` gate B19 robusto · `9fba00f` checkpoint F · (F7: ver `git log 9fba00f..HEAD`).

## Archivos tocados

- Código: `app/src/App.tsx`, `app/src/App.css`, `app/src/styles/discovery.css`,
  `app/src/components/{ExplorerHome,FilterPanel,Onboarding,PlaceDetail,PlaceMap,SearchSheet,Sheet}.tsx`,
  `app/src/lib/{map-grouping.ts,hub-view.ts (nuevo, F6),map-chrome.ts (nuevo, F7),onboarding.ts,transfer.ts}`,
  `app/src/components/InterestLegend.tsx` (F7, sólo `data-map-chrome`).
- Tests: `app/src/lib/map-grouping.test.ts`, `app/src/lib/hub-view.test.ts` (nuevo, F6),
  `app/src/lib/map-chrome.test.ts` (nuevo, F7),
  `app/src/lib/transfer.test.ts`, `app/src/block18-shell.test.ts`,
  `app/src/block21-global-search.test.ts`, `app/src/block24-ddr3-home-collections.test.ts`
  (nuevo, F6), `app/src/block20-place-detail.test.ts` (sólo timeout).
- Gates: `app/scripts/b24-real-input-audit.mjs` (nuevo), `app/scripts/block19-grid-check.mjs`,
  `app/scripts/b24-ddr3-home-collections-check.mjs` (nuevo, F6).
- Docs: `docs/BLOCK_24_{MISSION,HANDOFF,UX_AUDIT}.md`, `docs/design/{02,03,05,
  09_DECISIONES_DE_DISENO}.md`, `docs/CURRENT_WORK_HANDOFF.md` (sección nueva arriba).

## DDR (en `docs/design/09`) — todas RESUELTAS

- **DDR-B24-1** — encuadre inicial del mapa de ciudad → **`DD-023`**: editorial por hub con
  fallback calculado (`lib/hub-view.ts`).
- **DDR-B24-2** — marcadores cercanos con ≤12 a la vista → **`DD-024`**: red de seguridad
  geométrica siempre activa (`groupScreenPoints` sin gate de densidad).
- **DDR-B24-3** — volver desde una colección de la portada → **`DD-025`**: se comporta como la
  búsqueda global (`exploreReturnSurface="home-collection"`).

No queda ninguna decisión de diseño abierta en B24. F7 añade **`DD-026`** (firme): el cromo
interactivo del mapa es zona de exclusión para los objetivos tras todo movimiento programático.

## DEFERRED

- **ACTIVE-BRANCH (B23):** P0-5c metadato «{categoría} · {barrio}, {ciudad}»; AB-1 corazón
  40×40; AB-2 chip «Hidden gem». **(B6.7):** AB-3 split del import de `photography-metadata`;
  AB-4 los 8 fallos de Vitest y los 3 de Phase 5A (A06, A07, E01). Diffs propuestos en
  `docs/BLOCK_24_UX_AUDIT.md`.
- **ROADMAP:** P1-13 glifos de Quiero ir (B7); P2-1 salto de teclado en carruseles, P2-2 orden de
  colecciones, P2-3 foto de Tokio repetida, P2-4 bundle 1,65 MB, P2-6 «57 de 57 lugares» (B10);
  P2-5 estado vacío de Viaje con instrucción falsa (B9). Ningún P0 propio de B24 (P0-4e se
  corrigió en F7).

## Validación humana pendiente

- **Scroll táctil real** de la portada, las hojas y el mapa: Chromium headless no reproduce
  inercia, rebote ni gestos del sistema. Requiere un iPhone real.
- **Teclado de iOS** (zoom del input, desplazamiento al enfocar la búsqueda): requiere un
  iPhone real.
- Revisión visual humana (`08` G7) de las capturas de `/tmp/b24/` — no se commitean y se pierden
  con el contenedor; se regeneran con el gate.

## Siguiente acción exacta

1. ~~Dirección decide DDR-B24-1, DDR-B24-2 y DDR-B24-3~~ — hecho en F6 (`DD-023/024/025`).
2. Validación humana en iPhone real: scroll táctil de portada/hojas/mapa y teclado de iOS en la
   búsqueda.
3. Cuando B23 se integre en la base canónica, aplicar los diffs DEFERRED-ACTIVE-BRANCH de
   `docs/BLOCK_24_UX_AUDIT.md` (P0-5c, AB-1, AB-2) sobre esa base y volver a pasar el gate B24.
4. ~~P0-4e~~ — corregido en F7 (`DD-026`).
5. Revisar e integrar esta rama (PR hacia la rama canónica) sólo por decisión de dirección: B24 no
   abre PR ni hace merge. No empezar B25.
