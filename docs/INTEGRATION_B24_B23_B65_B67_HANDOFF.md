# Integración B24 + B23 + B6.5-fix + B6.7 test-closure — handoff reanudable

Misión: `docs/INTEGRATION_B24_B23_B65_B67.md`. Fecha de la integración: 2026-09-26.

## Estado

| Checkpoint | Estado | SHA |
|---|---|---|
| A — rama + preflight | hecho | `15ca0d1` |
| B — B6.7 test-closure | hecho | `d54e7ca` (+ docs) |
| C — B6.5-fix | hecho | `906c03a` · `e9ca02e` (+ docs) |

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
