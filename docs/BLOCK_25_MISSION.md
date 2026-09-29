# MISIÓN B25 — B7 «Quiero ir» · Nihon

Bloque 25 del repositorio = **B7 «Quiero ir»** del roadmap (`docs/design/10 §B7`).
Autoridad normativa: `docs/design/` (00–10). Contrato de pantalla: `05 §6`.

## Baseline

- Rama: `claude/b25-quiero-ir`, creada desde `origin/main` @
  `88a741d4d1a84f69e7b85a82ba0328e9acc940ce` (merge de PR #152 `8867e41` + reconciliación de
  handoff). Verificado con `git fetch origin` el 2026-09-28: coincide exactamente.
- Working tree limpio al crear la rama.
- Baseline de puertas (antes de tocar código): build PASS (sólo el aviso de tamaño de chunk
  heredado); lint 0 errores + 1 warning heredado (`PlaceMap.tsx:17`); Vitest **3384/3384**
  (105 ficheros).
- No se usa como base: `8867e41` suelto, `claude/integration-b24-b23-b65-b67`, ramas Codex,
  Astra, PR #153/#154, ramas de Vercel.

## Scope

- Pantalla «Quiero ir» según `05 §6`: cabecera + contador; segmentado `Los dos · {persona 1} ·
  {persona 2}` (filtro de vista, nunca cambia la persona activa); resumen de tres datos
  equivalentes con `EvidenceMark ◇` y nota «Sólo tiempo dentro de cada lugar»; «Los dos queréis
  ir (N)» primero y sin clic; «Sólo {persona}» plegables; «Descartados» plegado; acción anclada
  `primary lg` «Llevar al viaje».
- `SelectionAnalysis` deja de ser una herramienta detrás de un botón: su lógica (`lib/selection`)
  organiza la pantalla (agrupación por ciudad, totales) y su detalle (zonas, reparto por
  duración, compromisos de jornada) queda integrado como sección plegable de la propia pantalla,
  sin cabecera propia, sin botón de cierre y sin rol de diálogo.
- Quitar con confirmación por `Toast` + «Deshacer», operable con puntero, táctil y teclado.
- Estados vacíos (`05 §6`: vacío completo; sólo una persona ha marcado).
- P1-13 (B24): glifos de texto `▾ ▴ ▸` como icono en Quiero ir → iconos de línea.

## Fuera de scope

Explorar, mapa, `PlaceDetail`, Viaje, Nosotros, shell global, tokens. B8/B9/B10 y B26. Deuda P2
de B24 destinada a B9/B10. Cualquier cambio en `lib/travellers.ts` que altere semántica.

## Componentes afectados

`components/SelectionPanel.tsx` (reescrito como pantalla Quiero ir), `components/SelectionAnalysis.tsx`
(pasa a contenido integrado), `components/SaveToast.tsx` + `useSaveFeedback.ts` (acción opcional
«Deshacer», `04 §16`), `useTravellers.ts` (lecturas derivadas + restauración exacta para
«Deshacer»), `lib/travellers.ts` (función pura de restauración), `lib/quiero-ir.ts` (nuevo,
agrupación de presentación), `App.tsx` (cableado), `App.css`.

## Invariantes (lógica protegida)

1. Un corazón = interés de la persona activa (`withToggledInterest`). Sin cambios.
2. Quitar retira sólo el interés de la persona activa (`removeSaved` → `withStance(null)`).
3. Coincidencias/divergencias = `divergenceEntries` + `summarizeInterest`, sin reimplementar.
4. Duraciones = `summarizeSelection` / `formatRange`, misma semántica (horas dentro del lugar).
5. Ninguna clave de almacenamiento nueva; el filtro y los plegados son estado de vista.
6. El segmentado nunca llama a `setActiveTraveller`.
7. «Llevar al viaje» = `goToPlanner` existente; ninguna planificación automática.
8. Ficha desde Quiero ir se apila dentro de Quiero ir (DD-015), sin cambiar de destino.

## Criterios de aceptación

Los de `05 §6` y `10 §B7`: coincidencias visibles sin clic y primero tras el resumen; el
titular no es una duración; ningún texto dice «analizar» ni «selección»; divergencias
calculadas igual; más los de accesibilidad, responsive y navegación del encargo.

## Riesgos

- Tests de código fuente de B5/B6/B17/B18 que fijan el marcado antiguo del panel: se actualizan
  para seguir comprobando la misma invariante sobre el nuevo marcado.
- Gate histórico `block6-divergence-browser-audit.mjs` fija la barra de filtros de B6, sustituida
  por la organización de B7: queda superado y se documenta.
- Ventana de «Deshacer» frente a `04 §16` (2.400 ms): se pausa mientras el toast tiene puntero o
  foco (WCAG 2.2.1) — decisión de implementación de accesibilidad.

## Plan de gates

build · lint · Vitest completo · `scripts/b25-quiero-ir-check.mjs` (nuevo, navegador real) ·
`integration-b24-b23-check` · B23 retry · DD-028 · B18 browser-back / viaje-lugar.
