# Handoff reanudable — estado actual del trabajo

> **Este fichero es la única fuente de verdad para retomar el trabajo.** Se actualiza y se
> empuja en cada checkpoint estable, no sólo al cerrar un bloque. Si una sesión se corta, otro
> agente debe poder continuar usando exclusivamente: la rama remota, el último SHA pusheado,
> este fichero y los documentos normativos de `docs/design/`.

**Última actualización:** 2026-09-21 · **INTEGRACIÓN B21 + B6.1 COMPLETADA Y VERIFICADA EN `integration/b21-b6-1`**

---

## 1. Dónde estamos

| | |
|---|---|
| **Bloque actual** | **Bloque 21 (B5 — Explorar: portada y mapa) + Bloque 22 (B6.1 — Fotografía Grado S). INTEGRACIÓN FINALIZADA.** |
| **Rama actual** | `integration/b21-b6-1` (rama de integración derivada de B21 `b16a9e6` e integrando B6.1 `e6693a4`) |
| **Último SHA estable B21** | `b16a9e62fe09d57fbba86cf16fb43ecfd2aa3496` en `codex/block-21-b5-explore-home-map` |
| **SHA B6.1 / PR #138** | `e6693a4ffe89400b356c8159fb47865d075808a4` en `codex/block-22-b6-1-grade-s-photography` |
| **Estado del working tree** | Limpio para archivos rastreados. |
| **Estado de la suite** | Build/lint verdes (`0 warnings, 0 errors`); suite Vitest completa verde (`99 test files / 3324 tests passing`). Validadores Python de fotografía (38/38 y 28/28 passing). Gates Phase 5A RC verdes (50/50 desktop & mobile). |
| **Siguiente acción** | Confirmación final de la integración y entrega al usuario. |

---

## 2. Estado de Checkpoints B21

1. **Checkpoint Documental (DDR-B21-01…06):** RESUELTO y registrado (`dc2fd7b`).
   - DDR-B21-01 (DD-003): OSM tile filter `saturate(.25) contrast(.92) brightness(1.04)` aplicado.
   - DDR-B21-02: Sección «Más destinos» con contadores dinámicos ("X lugar(es) por ahora").
   - DDR-B21-03: Subtítulo dinámico «47 prefecturas · 15 con lugares en Nihon».
   - DDR-B21-04: Líneas editoriales exactas fijadas en las 4 colecciones derivativas.
   - DDR-B21-05: Búsqueda global «Buscar en todo Japón» sobre los 214 lugares con retención de estado de vuelta a Portada.
   - DDR-B21-06: Mapa de nombres japoneses (Tokio → 東京, Kioto → 京都, Osaka → 大阪, Okinawa → 沖縄) con `lang="ja"`.
2. **Checkpoint B (Portada):** COMPLETADO (`0ef1fb1`). `ExplorerHome` implementado con cabecera, búsqueda global, 4 tarjetas de ciudad principales con nombres en japonés, «Más destinos» (Sapporo, Nagoya, Fukuoka) con contadores y pluralización dinámica, 4 colecciones derivadas y tarjeta «Ver Japón en el mapa».
3. **Checkpoint C (Mapa Nacional):** COMPLETADO (`df16689`, `952d436`). Superficie nacional a pantalla completa con geometría GeoJSON de MLIT para 47 prefecturas y 9 regiones, bottom sheet de 3 posiciones (`asa`, `25%`, `75%`) navegable por táctil/teclado, atribución MLIT en modal/sheet y botón «‹ Volver a la portada».
4. **Checkpoint D (Mapa de Ciudad + Responsive):** COMPLETADO (`fa6a91b`). Implementación literal de DD-004 (marcadores de mapa codificados por interés de persona: `both`, `person-a`, `person-b`, `none`, `selected`), `InterestLegend` actualizado para describir el interés por persona, filtro OSM DD-003 aplicado y preservados todos los invariantes DD-015/016/017.
5. **Checkpoint E (Cierre Técnico):** COMPLETADO. Build, oxlint, Vitest (99/99 ficheros, 3322/3322 tests), audits de navegador B17–B21 / Phase 5A RC ejecutados y verdes.
6. **Checkpoint F (Integración B21 + B6.1):** COMPLETADO en rama `integration/b21-b6-1`. Merge sin conflictos, validadores de fotografía Python (38/38, 28/28), build, oxlint (0 errors, 0 warnings), Vitest (99 test files / 3324 tests passing) y audit Phase 5A RC (50/50 desktop, 50/50 mobile). Documentado en `docs/B21_B6_1_INTEGRATION_REPORT.md`.

---

## 3. Resumen de Commits Locales en B21

- `dc2fd7b` — `docs: registra y reconcilia DDR-B21-01...06`
- `0ef1fb1` — `feat(B21): implementa Checkpoint B - Explorar Inicio (portada)`
- `df16689` — `feat(B21): implementa Checkpoint C - Mapa Nacional (Explorar Mapa de Japón)`
- `952d436` — `docs: actualiza handoff para Checkpoint C (Mapa Nacional)`
- `fa6a91b` — `feat(B21): implementa Checkpoint D - Mapa de Ciudad + Responsive (DD-003, DD-004)`
- `b16a9e6` — `docs: actualiza handoff para Checkpoint E (Cierre Técnico)`
- `integration/b21-b6-1` merge commit — `merge: integra B21 (Explorar) y B6.1 (Fotografía Grado S / PR #138)`

---

## 4. Próximos pasos

Proceder a la entrega final.
