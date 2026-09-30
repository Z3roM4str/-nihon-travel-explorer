# MISIÓN B29 — B9.3 «Herramientas del día» · Nihon (línea Claude)

Bloque 29 del repositorio = **B9.3** del roadmap (`docs/design/10 §B9`), únicamente. Continúa **B28 / B9.2
de Claude** (`claude/b28-viaje-b9-2-reordenar`); no es B9.4, B9.5 ni B10.

## Línea y base

- Rama: `claude/b29-viaje-b9-3-herramientas-dia`.
- **Base obligatoria y verificada (`git fetch origin` + `git rev-parse HEAD` antes de tocar nada):**
  `dd5fee06e3c0b4bdaa7c03512466b0f967e02eb2` = HEAD de `claude/b28-viaje-b9-2-reordenar`. No existía otra
  rama B29 de Claude.
- No parte de `main`. Sin merge, rebase ni cherry-pick desde `main`, ramas `codex/*`, PR #162/#154, Astra
  (`experiment/astra-redesign`) ni Vercel. (El único commit con «codex» en el historial es una fusión
  antigua —PR #13— anterior a B27 y ya presente en la base.)
- PR en borrador: **base `claude/b28-viaje-b9-2-reordenar` ← head `claude/b29-viaje-b9-3-herramientas-dia`**.
  No apunta a `main`. No se hace merge.

## Contrato (`05 §7`, «Probar otro orden»)

«Probar otro orden» sustituye a «Orden A / Orden B» como vista de primer nivel y es una **hoja local a un
día**. Muestra: (1) el orden actual del día; (2) una propuesta que LA PERSONA reordena; (3) la comparación
de traslados que ya calcula `sequence-comparison.ts`; (4) las alternativas `evidence-complete-*` como
opciones etiquetadas «Comprobado con datos completos»; (5) ninguna se aplica sola; (6) acción explícita
«Usar este orden».

## Principio (Constitución Art. 5)

Nihon no ordena, no reparte, no equilibra y no optimiza. Por tanto: nada se elige por defecto, no hay
«mejor orden», ranking, puntuación ni «recomendada»; abrir, experimentar, cerrar o pulsar Escape no cambian
el borrador; **sólo «Usar este orden» escribe**.

## Alcance B9.3 (lo que este bloque hace)

1. Acción «Probar otro orden» por día (los días con ≥2 paradas; con 0 o 1 no hay nada que ordenar).
2. Hoja local (`DayOrderSheet`) que recibe el día por **id estable**.
3. «Orden actual» (sólo ese día) y «Otro orden» (empieza como COPIA del actual; teclado completo).
4. Comparación con `compareSequences` (reutilizada tal cual) redactada de forma neutral.
5. Las cinco familias `evidence-complete-*` como opciones del día abierto, en su orden de emisión; elegir
   una sólo **carga** «Otro orden».
6. «Usar este orden» aplica la propuesta a ese día; cerrar/Escape/«Cancelar» descartan.
7. Retirada de la comparación global (botón «Probar otro orden» de primer nivel, vista «Comparar órdenes»,
   `Orden A / Orden B`) y de la sección de alternativas con botones «Aplicar…» que vivía dentro de
   «Horarios, reservas y herramientas del Día N».

## Exclusiones (NO se hacen aquí)

| Subbloque | Estado en B29 |
|---|---|
| B9.4 Dónde dormir | Intacto. |
| B9.5 Reservas y Resumen; retirada de `Dato:` | Intactos; `Dato:` **sigue presente** (4 apariciones). |
| B10 Pulido | No se toca. |

## Invariantes (no cambian)

Esquema V8 (`PLANNING_DRAFT_VERSION = 8`) y clave `nihon.manualPlanningDraft` · identidad estable de día ·
fechas, alojamiento por día, legs manuales, horas de inicio, `InterHubSegment`, reservas, zonas, Quiero ir ·
generadores `evidence-complete-*` y `sequence-comparison.ts` (sin una línea cambiada) · arrastre, táctil,
teclado y «Mover a…» de B28 · PlaceDetail/back · DD-015. La protección `b28-invariants-scope.test.ts` no se
debilita; B29 añade `b29-invariants-scope.test.ts`, que no autoriza **ninguna** excepción (ver handoff).

Cierre y resultados: `docs/BLOCK_29_HANDOFF.md`.
