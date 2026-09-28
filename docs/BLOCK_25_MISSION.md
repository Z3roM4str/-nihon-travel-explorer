# BLOQUE 25 — B7 «Quiero ir»

## Alcance y base

- Rama: `codex/block-25-b7-quiero-ir`.
- Base canónica: `main @ 98260eb67b508527cd6836fda2d3d3f33d909c1a`.
- Autoridad: `docs/design/05_ESPECIFICACIONES_DE_PANTALLA.md` §6 y roadmap B7.
- Fuera de alcance: B8, B9, B10, Astra, dataset, fotografía, cálculo del planner y Vercel.

## Auditoría previa

`SelectionPanel` era un cajón heredado, aunque B18 ya lo alojaba en una pestaña: la duración
dominaba el encabezado, las coincidencias sólo se encontraban mediante filtros y
`SelectionAnalysis` se desplegaba como una segunda experiencia. La verdad de producto ya era
correcta: `useTravellers` deriva `savedIds` de las posturas, `divergenceFor` conserva los grupos
`agreed`, `only-you`, `only-them` y `differing`, y `goToPlanner` es el puente deliberado al Viaje.
PlaceDetail ya se apilaba dentro del destino con origen `quiero-ir` y restauración de scroll.

P1-13 se reprodujo en los glifos de texto `▾`, `▴` y `▸` de `SelectionPanel`/
`SelectionAnalysis`. B25 elimina esos controles de la superficie y usa `Icon expandir`.

## Contrato implementado

- Cabecera «Quiero ir» con contador.
- Segmentado `Los dos · persona 1 · persona 2`, exclusivamente como estado de vista local.
- Resumen equilibrado de lugares, ciudades y duración de visitas, con `EvidenceMark` estimado.
- Coincidencias inmediatamente después del resumen; lados individuales y opiniones distintas
  conservan los grupos derivados existentes.
- Estados vacíos para lista total, coincidencias y lente individual.
- CTA anclada «Llevar al viaje» reutiliza `goToPlanner`: no escribe preferencias ni incorpora
  lugares automáticamente al plan.
- La información deja de depender de `SelectionAnalysis`; no se crea store, migración o clave.

## Cobertura

`app/src/block25-want-to-go.test.ts` fija estructura, léxico, segmentado, vacíos, CTA y P1-13.
`app/scripts/b25-want-to-go-browser-audit.mjs` cubre los ocho viewports exigidos, overflow,
targets, foco, ficha, vuelta/scroll y captura. En este contenedor no pudo ejecutarse porque no
hay Chromium instalado y el CDN de Playwright respondió 403; el gate queda listo para CI.

