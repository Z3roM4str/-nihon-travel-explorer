# Handoff reanudable — B21 + B6.1 (consolidados)

**Última actualización:** 2026-09-24. La autoridad normativa es `docs/design/`. Astra es una línea separada y no forma parte de este trabajo.

| Campo | Estado |
|---|---|
| B21 | **CERRADO** |
| B6.1 | **INTEGRADO Y CERRADO** (vía PR #141; PR #138 cerrado sin merge como superado, rama `codex/block-22-b6-1-grade-s-photography` @ `e6693a4` conservada) |
| Rama canónica | `codex/block-21-b5-explore-home-map` |
| PR #141 | [merged](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/141) con merge commit normal `201dba7b8b9f1b71b3ca98f6132fe4bd8ca6339a` (head certificado `c3b7b89`, base `7e0e833`) |
| SHA canónico final | `201dba7b8b9f1b71b3ca98f6132fe4bd8ca6339a` (árbol idéntico a `c3b7b89`) + el commit de este handoff, sólo documental |
| `main` | intacto (`8eb725e`), sin PR abierto hacia `main` |
| Siguiente bloque | **B6.2 — fotografía Grado A** — EN CURSO en `codex/block-22-b6-2-grade-a-photography` (batch 1/4 cerrado; ver `docs/BLOCK_22_B6_2_REPORT.md`) |

## Verificación post-merge (2026-09-24, Linux)

- Build PASS; lint exit 0 (1 advertencia heredada Fast Refresh `PlaceMap.tsx:14`); Vitest 100 archivos, 3327/3327.
- Gate B21 búsqueda global 33/33 móvil y 33/33 escritorio: consulta preservada, resultados preservados, scroll preservado, portada nacional preservada, UI back, browser back y Cerca de aquí. En el contenedor, el escritorio requirió el binario Chromium completo 1194; el headless shell 1194 (desfasado frente al 1234 esperado por Playwright) no restaura el scroll en escritorio (360→0), sin cambios de código.
- Phase 5A 50/50 escritorio y 50/50 móvil.
- Fotografía: 167 imágenes, 161 lugares con foto, 32/32 Grado S; `validate-photography.py` PASS; `build-photography-derivatives.py --check --quiet` PASS; `test_block22_photography.py` 7/8 en Linux: el único fallo compara el SHA-256 de `app/src/data/place-images.ts` contra una línea base calculada con CRLF (Windows). El archivo es byte a byte idéntico a B6.1 `e6693a4`; fallo heredado dependiente de plataforma.

## Historial de la certificación previa (#141)

La historia remota de #141 contiene un solo commit posterior a la base B21. El SHA B6.1 no es ancestro del PR, pero los archivos de fotografía consolidados coinciden por contenido con la fuente. No existe remotamente `integration/b21-b6-1`; los checkpoints locales antes citados no representan commits publicados por separado. Véase `docs/B21_B6_1_INTEGRATION_REPORT.md` para el diff, los gates y la evidencia.

## Certificación técnica de esta auditoría

- Fotografía: 167 imágenes, 161 lugares, 32/32 S; `validate-photography.py` PASS; Python 38/38, 28/28 y 8/8; derivados 400/800 px PASS.
- Frontend: build PASS; lint código 0 con una advertencia de Fast Refresh; Vitest 100 archivos, 3327/3327. La advertencia Fast Refresh de `PlaceMap.tsx:14` es heredada de la base B21; la afirmación anterior de 0 warnings era incorrecta.
- Gates heredados: B17, B18, B19, B20, DDR-03, Block 1 UX, Block 2 Photography, Phase 5A RC y seis auditorías Phase 4 Photography ejecutados; resultados individuales en el informe.
- Navegador B21: portada, búsqueda, mapas, fotografía local, ficha y responsive comprobados en 390×844, 1440×900 y 1600×900; raíl xl 31,7 % del cuerpo; sin overflow, errores de consola o fetch fotográfico externo.
- **B21 corregido:** `exploreDetailReturnRef` identifica explícitamente la ficha abierta desde búsqueda global; no cambia el hub subyacente. `Sheet` restaura `.sheet__body.scrollTop` desde un ref y `focus({ preventScroll: true })` evita el reset posterior. El cierre explícito limpia el contexto; la búsqueda de ciudad conserva su comportamiento.
- **Gate B21 permanente:** `b21-global-search-browser-audit.mjs` PASS 33/33 en móvil y 33/33 en escritorio; UI back, browser back y cadena Cerca de aquí restauran consulta `a`, 214 resultados y scroll 360→360 tras dos frames. La portada nacional sigue subyacente, el cierre vuelve a portada y Buscar en Tokio no hereda retorno global.
- **Regresión repetida tras el arreglo:** B18 browser back 15/15, regression 40/40; B19 discovery 30/30, grid 52/52; B20 73/73; DDR-03 43/43; Block 1 UX 153/153; Phase 5A desktop/mobile 50/50 cada uno. Build PASS, lint exit 0 con una advertencia heredada, Vitest 100 archivos/3327 tests. Fotografía B6.1 sin cambios; se conserva toda su evidencia anterior.

## Estado de entrega

Consolidación completada. No tocar `main`. No iniciar B6.2 sin instrucción explícita.
