# Bloque 24 — Handoff reanudable

Auditoría con input real y corrección de superficies construidas. Misión íntegra:
`docs/BLOCK_24_MISSION.md`. Autoridad normativa: `docs/design/` (00–10). Auditoría por hallazgo:
`docs/BLOCK_24_UX_AUDIT.md`.

## Estado: B24 COMPLETO en rama, sin PR ni merge

- Todos los P0 y P1 FIX-NOW corregidos; gate B24 **795/795** en los 8 viewports (rojo en la base:
  429/721, 292 fallos, con el mismo script).
- 3 DDR abiertas (DDR-B24-1/2/3) y 5 DEFERRED-ACTIVE-BRANCH + 6 DEFERRED-ROADMAP documentados.
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
| E — regresión | (este commit) | 1 regresión propia encontrada y corregida (`d901e03`); 1 expectativa de gate B19 actualizada citando `03 §9` (`e1b4f7d`); gate B24 **795/795** |

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

## Commits (base `4afbf50` → HEAD)

`0032c00` misión · `da7ce9b` gate rojo · `22fd492` timeout B20 · `454d31a` checkpoint A ·
`77a3345` auditoría (B) · `18c491f` DD-018…022 · `70789ef` P0-1 · `1206b0e` gate · `f0c1de1` P0-2 ·
`c6f9084` P0-3 · `d54126d` P0-5a · `7c74a82` P0-5b · `253bf7b` agrupación · `f4ffb7b` P0-4 ·
`b4d4e46` DDR-B24-1/2/3 · `7741371` gate · `960e0b7` test B18 · `3b4fd71` Art. 10 · `7794fd1`
checkpoint C · `057edd1` P1-01…04 · `4c58e61` P1-05 · `fca07f3` P1-06 · `c44dd80` P1-07 ·
`c27d383` P1-08 · `5ab0c0f` P1-09 · `462fbe1` gate · `37075e0` P1-10 · `776b5ba` gate · `c84b3aa`
P1-11/12 · `6035179` P2-7 · `f0b8b22` checkpoint D · `3f7f3b9` gate · `d901e03` regresión
FilterSheet · `e1b4f7d` gate B19 · (checkpoint E, este commit).

## Archivos tocados

- Código: `app/src/App.tsx`, `app/src/App.css`, `app/src/styles/discovery.css`,
  `app/src/components/{ExplorerHome,FilterPanel,Onboarding,PlaceDetail,PlaceMap,SearchSheet,Sheet}.tsx`,
  `app/src/lib/{map-grouping.ts (nuevo),onboarding.ts,transfer.ts}`.
- Tests: `app/src/lib/map-grouping.test.ts` (nuevo), `app/src/lib/transfer.test.ts`,
  `app/src/block18-shell.test.ts`, `app/src/block20-place-detail.test.ts` (sólo timeout).
- Gates: `app/scripts/b24-real-input-audit.mjs` (nuevo), `app/scripts/block19-grid-check.mjs`.
- Docs: `docs/BLOCK_24_{MISSION,HANDOFF,UX_AUDIT}.md`, `docs/design/09_DECISIONES_DE_DISENO.md`,
  `docs/CURRENT_WORK_HANDOFF.md` (sección nueva arriba).

## DDR pendientes (en `docs/design/09`)

- **DDR-B24-1** — encuadre inicial del mapa de ciudad (todos los lugares vs núcleo calculado vs
  editorial vs núcleo + indicador). `FitHubBounds` sin cambios.
- **DDR-B24-2** — marcadores cercanos con ≤12 a la vista: `03 §9` no agrupa y las cajas de 44 px se
  solapan (Tokio 1 par, Kioto 2, Osaka 5, Okinawa 7). Código: `03 §9` literal.
- **DDR-B24-3** — volver desde un lugar abierto en una colección de la portada cae en la ciudad,
  no en la portada (`02 §D3` pt. 2). Código: sin cambios.

## DEFERRED

- **ACTIVE-BRANCH (B23):** P0-5c metadato «{categoría} · {barrio}, {ciudad}»; AB-1 corazón
  40×40; AB-2 chip «Hidden gem». **(B6.7):** AB-3 split del import de `photography-metadata`;
  AB-4 los 8 fallos de Vitest y los 3 de Phase 5A (A06, A07, E01). Diffs propuestos en
  `docs/BLOCK_24_UX_AUDIT.md`.
- **ROADMAP:** P1-13 glifos de Quiero ir (B7); P2-1 salto de teclado en carruseles, P2-2 orden de
  colecciones, P2-3 foto de Tokio repetida, P2-4 bundle 1,65 MB, P2-6 «57 de 57 lugares» (B10);
  P2-5 estado vacío de Viaje con instrucción falsa (B9).

## Validación humana pendiente

- **Scroll táctil real** de la portada, las hojas y el mapa: Chromium headless no reproduce
  inercia, rebote ni gestos del sistema. Requiere un iPhone real.
- **Teclado de iOS** (zoom del input, desplazamiento al enfocar la búsqueda): requiere un
  iPhone real.
- Revisión visual humana (`08` G7) de las capturas de `/tmp/b24/` — no se commitean y se pierden
  con el contenedor; se regeneran con el gate.

## Siguiente acción exacta

1. Dirección decide DDR-B24-1, DDR-B24-2 y DDR-B24-3 (opciones en `docs/design/09`).
2. Validación humana en iPhone real: scroll táctil de portada/hojas/mapa y teclado de iOS en la
   búsqueda.
3. Cuando B23 se integre en la base canónica, aplicar los diffs DEFERRED-ACTIVE-BRANCH de
   `docs/BLOCK_24_UX_AUDIT.md` (P0-5c, AB-1, AB-2) sobre esa base y volver a pasar el gate B24.
4. Revisar e integrar esta rama (PR hacia la rama canónica) sólo por decisión de dirección: B24 no
   abre PR ni hace merge. No empezar B25.
