# Merge-readiness — PR #152 · handoff

**Fecha:** 2026-09-26 · **Rama:** `claude/integration-b24-b23-b65-b67` · **PR:** #152 (Draft)
**SHA inicial:** `fac2e9ed57c2a55b61653268dbf5619946af7d9c` · **Base:** `main` @ `8eb725eeb836ca121180f8dd8b0dc49c65efae25`
**SHA final:** el HEAD de la rama tras el commit que añade este documento (ver `git log`; los
commits de la misión se listan abajo).

## Preflight

`origin/<rama>` = `fac2e9e` ✓ · `origin/main` = `8eb725e` ✓ · PR #152 abierto y Draft ✓ · árbol limpio ✓
· `main` ancestro de HEAD ✓ (el clon era superficial; se hizo `fetch --unshallow` para comprobarlo).

## Commits de la misión (sobre `fac2e9e`, sin rebase, squash ni merge)

| SHA | Qué |
|---|---|
| `7933b19` | DDR-MERGE-1 — diagnóstico del presupuesto de fotografía de hub |
| `4e82d05` | Python — B6.4 `BATCH_LIMIT` a nivel de módulo |
| `2cca972` | Python — reconstrucción de baselines históricas consciente de Block 22 |
| `264c626` | DD-028 — nombre accesible de PlaceCard + gate AX + docs normativas |
| `1bcd8df` | `docs/PYTHON_SUITE_STATUS.md` |
| `632fdf7` | Gate de integración: el 503 de B23 lo consumía la portada |
| (este) | Handoffs y documentación de cierre |

`OrderedSequenceBuilder.tsx` byte-idéntico a `fac2e9e`. Sin Astra. Ningún bloque nuevo (B7+) iniciado.

## Fotografía — Block 2

| | Antes (`fac2e9e`) | Después |
|---|---|---|
| Block 2 Photography | 79/81 | **79/81** (sin cambios: no se ha tocado el gate ni la constante) |
| phone / tablet / desktop (ventana del gate) | 4,82 / 5,31 / 5,77 MiB | idéntico |
| Hub Osaka en sí | — | **3 356 478 B = 3,20 MiB** en los tres viewports |

- Todas las imágenes son derivados `-800w` WebP identity; 0 originales, 0 duplicados, 0 fallos;
  `build-photography-derivatives.py --check` → 244 registros byte-idénticos.
- El exceso lo pone la **portada de Explorar** (B19/B24: tarjetas de ciudad + colecciones), que el
  gate registra porque escucha desde `page.goto`: 2,11 MiB (tablet) y 2,57 MiB (desktop) de
  Tokio/Kioto/Okinawa antes del clic en Osaka.
- **No es el CASO A** (no hay miniaturas fuera de especificación en la ventana medida) **ni
  exactamente el CASO B** (el catálogo del hub sí cabe). Como cerrarlo exige cambiar qué mide el
  gate o la portada, se sigue la vía de CASO B: **DDR-MERGE-1 ABIERTA**
  (`docs/DDR-MERGE-1_PRESUPUESTO_FOTOGRAFIA_HUB.md`), **sin DD-027**.
- Hallazgo secundario documentado en la DDR, no corregido: `PlaceCard compact` usa `-800w` aunque
  `06 §6.1` prescribe `-400w`; el gate congelado B6.5 exige `-800w`. Requiere decisión.

## Python

| | Antes | Después |
|---|---|---|
| `pytest scripts/` | 19 failed, 590 passed, 9 errors | **618 passed, 0 failed, 0 errors** |

Ejecución limpia (sin `__pycache__`, sin `.pytest_cache`, `PYTHONDONTWRITEBYTECODE=1`) reproducida
dos veces. Ningún skip/xfail. Detalle: `docs/PYTHON_SUITE_STATUS.md`.

## DD-027 / DDR-MERGE-1

- DD-027: **no creada**.
- DDR-MERGE-1: **abierta**, pendiente de dirección. Recomendación técnica: opción 1 (acotar la
  ventana del gate al recorrido del hub, constante intacta) u opción 4 (1 + presupuesto propio de
  portada).

## DD-028

FIRME (`09`, 2026-09-26; `04 §5` regla 11). `PlaceCard` usa un único `openLabel` con la misma línea
de ubicación que pinta la variante: compacta «{nombre}. {nivel}. {categoría} en {barrio}, {ciudad}.»;
normal sin cambios. Verificado en el árbol de accesibilidad de Chromium (CDP) en búsqueda global
(214 tarjetas), «Cerca de aquí» y lista de hub, móvil y escritorio: 16/16; con el código anterior,
4 fallos.

## Gates (HEAD de la misión, build de producción)

| Gate | Resultado |
|---|---|
| `npm run build` | ✅ |
| `npm run lint` | 0 errores, 1 warning heredado (`PlaceMap.tsx:17` `only-export-components`, idéntico) |
| Vitest | **3384/3384** (105 ficheros; +2 tests DD-028) |
| Block 2 Photography | 79/81 — DDR-MERGE-1 |
| Phase 5A desktop / mobile | 50/50 · 50/50 |
| B6.5 | 416/416 |
| B23 | 28/28 |
| B17 regression / tap-target / responsive | 18/18 · 16/16 · sin overflow |
| B18 regression / back / a11y / chrome / viaje-lugar / responsive | 40/40 · 15/15 · 23/23 · 6/6 · 38/38 · sin overflow |
| B19 | 30/30 |
| B20 | 73/73 |
| B21 global search mobile / desktop | 33/33 · 33/33 |
| DDR-03 | 43/43 |
| DDR-B24-3 | 9/9 |
| Block 1 | 153/153 |
| integration-b24-b23-check | **58/58** (50/52 en `fac2e9e` en este entorno; corregido en `632fdf7`) |
| DD-028 (nuevo) | 16/16 |
| B24 real-input audit | **1359/1359**, ejecutado en los 8 viewports: 320×568, 375×667, 390×844, 430×932, 820×1180, 1024×768, 1280×800, 1440×900 |

B24: `fac2e9e` en el mismo entorno da 1355/1355; la diferencia es sólo `P0-4` (344 → 348 marcadores
de mapa enumerados dinámicamente), 0 fallos en ambos, y ningún cambio de la misión toca el mapa.
Los gates B17–B20 y DDR-03 exigen un servidor en `localhost:4181` (`vite preview --port 4181`).

**Bundle:** JS inicial 1 654 671 B raw / 386 129 B gzip / 323 538 B brotli; diferido 37 784 B gzip en 2 chunks.

## Blockers pendientes

1. **DDR-MERGE-1** — decisión de dirección sobre el presupuesto de Block 2 (único punto técnico abierto).
2. Validación humana en iPhone real: scroll táctil y teclado de iOS.

## Estado de PR #152

Draft, abierto, sin merge. Body actualizado con estos resultados.
