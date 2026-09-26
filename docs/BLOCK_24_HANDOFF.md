# Bloque 24 — Handoff reanudable

Auditoría con input real y corrección de superficies construidas. Misión íntegra:
`docs/BLOCK_24_MISSION.md`. Autoridad normativa: `docs/design/` (00–10).

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
| D — P1 | (este commit) | P1-01…P1-12 y P2-7 corregidos; gate **763/763** en los 8 viewports |

## Validación humana pendiente

- **Scroll táctil real** de la portada, las hojas y el mapa: Chromium headless no reproduce
  inercia, rebote ni gestos del sistema. Requiere un iPhone real.
- **Teclado de iOS** (zoom del input, desplazamiento al enfocar la búsqueda): requiere un
  iPhone real.
