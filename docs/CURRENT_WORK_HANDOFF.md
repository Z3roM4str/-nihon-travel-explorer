# Handoff reanudable — B21 + B6.1

**Última actualización:** 2026-09-23. La autoridad normativa es `docs/design/`. Astra es una línea separada y no forma parte de este trabajo.

| Campo | Estado remoto observable |
|---|---|
| Bloque actual | B21 implementado y B6.1 integrado/verificado dentro del PR #141; certificación final B21 PASS tras corregir origen, hub, browser back y scroll de búsqueda global |
| Rama actual | `codex/block-21-b5-explore-home-map-10303448645469361664` |
| PR de consolidación | [#141](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/141), abierto contra la rama canónica B21 |
| Base canónica B21 | `codex/block-21-b5-explore-home-map` @ `7e0e83339ad0ea46be8cfb52befd14b3e67d0632` |
| HEAD remoto de #141 al iniciar la auditoría | `80f148b5380bc2ba022f22eac36163f1f1e089ff` |
| B6.1 fuente | `e6693a4ffe89400b356c8159fb47865d075808a4` / [PR #138](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/138), abierto y sin merge |

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

La corrección está certificada localmente. Publicar los commits de código/gates y documentación en la rama de #141, verificar HEAD remoto, PR abierto/mergeable y árbol rastreado limpio. **No hacer merge**, no cerrar #138 y no tocar `main`.
