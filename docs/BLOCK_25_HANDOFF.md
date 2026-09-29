# Handoff — BLOQUE 25 / B7 «Quiero ir»

## Estado

B25 implementado en `codex/implementar-bloque-25-b7-quiero-ir`, desde
`98260eb67b508527cd6836fda2d3d3f33d909c1a`. La pantalla recompensa el acuerdo primero y mantiene
la semántica de preferencias de dos personas y del planner.

## Resultado funcional

La pantalla abre con título/contador, filtro de personas y tres magnitudes equivalentes. «Los dos
queréis ir» está siempre visible tras el resumen y usa `PlaceCard compact` con el token compartido.
Los lugares exclusivos de cada persona y las opiniones explícitamente distintas continúan
derivados de `divergenceFor`, sin persistencia nueva; cada sección se subdivide por ciudad. La
sección plegada «Descartados» sólo lee posturas `not-interested`, nunca la ausencia de postura. El
filtro individual lee `stanceFor` y no cambia la identidad activa. Una preferencia ajena no ofrece
un control de retirada, por lo que tampoco puede producir una confirmación falsa. «Llevar al
viaje», con el CTA primario grande, cambia deliberadamente a la superficie de planner existente;
no crea itinerario ni altera su cálculo.

`SelectionAnalysis` deja de montarse en esta superficie. Toda su información derivada —hubs,
clusters, concentración o dispersión, compromisos, elementos sin estimación y distribución por
duración— se integró directamente en la jerarquía principal. PlaceDetail sigue siendo la instancia
compartida con origen `quiero-ir`.

## Calidad y límites

- Build: PASS.
- Lint: PASS, con el warning heredado `PlaceMap.tsx:17`.
- Vitest: PASS completo.
- P1-13: resuelto y cubierto; no quedan glifos de texto en los controles de B25.
- Auditoría browser/capturas: gate ampliado; ejecución bloqueada por ausencia del ejecutable de
  Chromium de Playwright. Se requiere ejecutar el gate en CI con navegador disponible y validación
  táctil final en iPhone real.
- Sin DDR: las autoridades existentes resolvían todas las decisiones.
- `app/vercel.json`, Astra, dataset, fotos y B8/B9/B10 no se tocaron.

## Siguiente acción

Ejecutar `node app/scripts/b25-want-to-go-browser-audit.mjs` contra preview en un runner con
Chromium. No iniciar un bloque posterior como parte de este handoff.
