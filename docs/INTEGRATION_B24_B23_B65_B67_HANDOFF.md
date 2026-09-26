# Integración B24 + B23 + B6.5-fix + B6.7 test-closure — handoff reanudable

Misión: `docs/INTEGRATION_B24_B23_B65_B67.md`. Fecha de la integración: 2026-09-26.

## Estado

| Checkpoint | Estado | SHA |
|---|---|---|
| A — rama + preflight | hecho | `15ca0d1` |
| B — B6.7 test-closure | hecho | `d54e7ca` (+ docs) |
| C — B6.5-fix | hecho | `906c03a` · `e9ca02e` (+ docs) |
| D — B23 photo retry | hecho | `b7c7e50` (+ docs) |
| E — P0-5c + AB-1 + AB-2 | hecho | `a6d798b` · `e6bfbc6` (+ docs) |

## A — Preflight

**Ascendencia.** La rama nace de B24 `f95e81e`. B6.7 test-closure desciende de la base B6.7
`4afbf50` (merge-base con B24 = `4afbf50`). B23 y B6.5-fix nacen de `f74281a` (base B6.6, anterior
a B21/B6.7/B24); ninguno de los dos es ancestro de B24.

**Commits exclusivos y ficheros.**

| Línea | Commits | Ficheros |
|---|---|---|
| B6.7 test-closure | `bd9defa` tests B6.7 · `b3b6e7e` Phase 5A A06/A07/E01 · `61fa5e9` docs | `app/src/data/place-images.test.ts`, `app/src/photography-depth.test.ts`, `app/scripts/phase5a-rc-browser-audit.mjs`, `docs/BLOCK_22_B6_7_TEST_CLOSURE.md`, `docs/CURRENT_WORK_HANDOFF.md` |
| B6.5-fix | `d1a5eef` contabilidad por época + fallback asentado · `af21671` activar hub sin scroll | `app/scripts/block22-b6-5-photography-browser-audit.mjs`, `app/scripts/block22-b6-5-sync.mjs` (nuevo), `app/scripts/block22-b6-5-sync.test.mjs` (nuevo) |
| B23 | `52a7073` retry de fotografía fallida | `app/scripts/block23-photo-retry-browser-audit.mjs` (nuevo), `app/src/App.css`, `app/src/components/PlaceCard{.tsx,.test.ts}`, `app/src/components/PlaceGallery{.tsx,.test.ts}`, `app/src/styles/discovery.css` |

**Solapes con B24.** `docs/CURRENT_WORK_HANDOFF.md` (B6.7); `app/src/App.css` y
`app/src/styles/discovery.css` (B23; también cambiaron entre `f74281a` y B24). Ningún solape con
`PlaceCard`, `PlaceGallery` ni los scripts B6.5 (B24 no los tocó: eran zona protegida).

**Línea base en B24 `f95e81e`.** build PASS (`index-*.js` 1.653,74 kB, 390,17 kB gzip) · lint 0
errores, 1 warning heredado · Vitest 3353/3361 (los 8 fallos B6.7 conocidos, que esta integración
debe eliminar) · gate B24 1347/1347.

## B — B6.7 test-closure

`git cherry-pick -x` de `bd9defa`, `b3b6e7e` y `61fa5e9`, en ese orden, **sin conflictos** (B24 no
había tocado esos tests ni el gate Phase 5A; `docs/CURRENT_WORK_HANDOFF.md` aplicó limpio: la
sección B6.7 se insertó arriba y se reordena en G — integración arriba, B24 debajo, B6.7 como
histórico — sin borrar nada). Commits en la rama: `722b08c` · `b510407` · `d54e7ca`.

- Ficheros: sólo `place-images.test.ts`, `photography-depth.test.ts`,
  `scripts/phase5a-rc-browser-audit.mjs` y docs. Ningún fichero de producto ni dataset.
- Vitest: **3361/3361** (desaparecen los 8 fallos B6.7). Phase 5A: **50/50 escritorio · 50/50
  móvil**. → **AB-4 RESUELTO** por integración de B6.7 test-closure.

## C — B6.5 timing fix

`git cherry-pick -x` de `d1a5eef` y `af21671`, en ese orden, **sin conflictos**: ni B21, ni B6.7,
ni B24 habían tocado `block22-b6-5-photography-browser-audit.mjs` desde `f74281a`, así que se
aplicó sólo el patch propio de los dos commits sobre la versión actual (no se recuperó ningún
fichero completo). Commits: `906c03a` · `e9ca02e`.

- `scripts/block22-b6-5-sync.test.mjs` (Vitest): **11/11**.
- `scripts/block22-b6-5-photography-browser-audit.mjs`: **416 passed, 0 failed**.
- Nota de entorno: el gate llama `chromium.launch()` sin ruta; en este contenedor se ejecuta con
  un `--import` fuera del repo que sólo inyecta `executablePath` del Chromium preinstalado. El
  script no se modifica.
- Sin cambios de fotografía ni dataset.

## D — B23 photo retry

`git cherry-pick -x 52a7073` → `b7c7e50`, **sin conflictos textuales**. Revisión semántica de los
hunks sobre B24 (no basta con que Git resuelva):

- `App.css`: añade sólo `.gallery__retry` (+ `:focus-visible`) junto a los estilos de la galería;
  ninguna regla de B24 cambia.
- `styles/discovery.css`: añade sólo `.place-card__photo-retry*` antes de «Acción guardar»;
  la rejilla, la búsqueda global y el resto de B24 quedan intactos.
- `PlaceCard.tsx`: `photoAttempt`, `openButtonRef`, `retryPhoto`, botón
  `.place-card__photo-retry tap-target-min`, `key={`${cardSrc}-${photoAttempt}`}` en las dos
  variantes y `title` en el control de abrir. `PlaceGallery.tsx`: `attempts`, `.gallery__retry`,
  `key` por intento, `role="status"` en el mensaje de error. Nada de B24 se pierde (B24 no había
  tocado estos dos componentes).
- No se recuperó ningún fichero completo del padre `f74281a`; no se usó `--ours/--theirs`.

Validación: `PlaceCard.test.ts` + `PlaceGallery.test.ts` **40/40**; build PASS (`index-*.js`
1.654,57 kB); lint 0 errores + 1 warning heredado; `block23-photo-retry-browser-audit.mjs`
**28 passed, 0 failed** (móvil y escritorio: error HTTP → «Reintentar» 89×44 → misma URL
recuperada; Quiero ir conservado; foco en abrir/pista; índice y navegación de la galería
conservados); gate B24 sobre esta build **1347/1347**.

## E — P0-5c, AB-1, AB-2 cerrados

- **P0-5c → RESUELTO.** Fila compacta de `PlaceCard`: «{categoría} · {barrio}, {ciudad}», o
  «{categoría} · {ciudad}» sin barrio; un solo `·`. `lib/place-line.ts` (`compactPlaceLine`), fuera
  del componente para no añadir un warning de Fast Refresh. Aplica a toda fila compacta (búsqueda
  global y «Cerca de aquí»). Dataset intacto (los 214 lugares tienen barrio; ninguno repite la
  ciudad). El gate B24 lo convierte de nota DEFERRED en comprobación dura.
- **AB-1 → RESUELTO (verificado, sin cambio de código).** El corazón ya llevaba `tap-target-min`
  en las dos variantes desde la base (`80f638a`): el `::after` lleva el área real a 44×44 con el
  círculo pintado en 40×40. El hallazgo de B24 midió `getBoundingClientRect` (40×40), que no ve el
  pseudo-elemento. Hit-testing real en los 4 bordes y 4 esquinas a ±21,5 px: 8/8 resuelven al botón
  a 390 y 1440. Cobertura nueva en `PlaceCard.test.ts` y en el gate de integración.
- **AB-2 → RESUELTO.** «Hidden gem» → «Joya escondida» (`04 §5` pt. 7). Sólo la etiqueta;
  `isHiddenGem` y `hiddenGemStatus` no cambian.
- Tests: `PlaceCard.test.ts` 34/34 (+4).
- **Gate de integración permanente** `app/scripts/integration-b24-b23-check.mjs`: **58/58**
  (puntos 1–10 de la misión, en 390×844 y 1440×900, más Phase 5A 50/50 ×2 sobre la misma build).
  Una primera corrida dio 52/53: el gate usaba la 4.ª tarjeta con índice fijo, que en la rejilla de
  3 columnas de 1440 queda fuera de pantalla tras desplazar; ahora elige la primera tarjeta
  realmente visible. Error del gate, no de la app.
