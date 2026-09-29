# MISIÓN B26 — B8 «Nosotros» · Nihon

Bloque 26 del repositorio = **B8 «Nosotros»** del roadmap (`docs/design/10 §B8`).
Autoridad normativa: `docs/design/` (00–10). Contratos: `05 §11` (Nosotros), `05 §1` (onboarding),
`02 §D4` y DD-007 (identidad), `02 §D2` (una pantalla, no modales).

## Baseline

- Rama: `claude/b26-nosotros`, creada desde `origin/main` @
  `b5e734169e0940aaa21427d2c9c0f5dc03d9a236` (verificado con `git fetch origin`: coincide).
  Working tree limpio al crear la rama.
- Baseline (antes de tocar código): build PASS · lint 0 errores + 1 warning heredado
  (`PlaceMap.tsx:17`) · Vitest 106 ficheros, **3395/3395**.
- No se usa como base: ramas históricas, `claude/integration-*`, Astra, PR #154, Vercel.

## Punto de partida (inventario)

Nosotros ya existía como pestaña desde B18 con cuatro secciones de contenido «reubicado»:
`TravellerBar` (segmentado con la leyenda «Eres» + engranaje) + `TravellerManager embedded`,
`TripBackup embedded`, un botón «Ver de nuevo» y MLIT + un recuento. Los dos componentes seguían
llevando el código de un modal (scrim, trampa de foco, botón de cierre) que nunca se usaba.
El onboarding tenía tres tarjetas, sin fotografía ni nombres. No había «Acerca de» ni licencias
fotográficas.

**Reubicado / conservado:** toda la lógica de `lib/travellers.ts`, `lib/portable-backup.ts`,
`usePortableBackup.ts`, el formato del archivo, `MlitAttribution` (una sola copia del texto).
**Modificado:** presentación de Viajeros (tarjetas), flujo de confirmación de importación (foco,
Escape, frase del contrato), onboarding (cinco pasos), Nosotros (cinco secciones).
**Retirado:** `TravellerBar` («Eres» y engranaje), los modos modales de `TravellerManager` y
`TripBackup`.

## Scope

1. **Viajeros** — dos tarjetas con `PersonToken md`, nombre editable, «Marcados: N lugares» y
   estado de dispositivo en texto; cambiar de persona activa aquí; renombrar, reiniciar, quitar
   y añadir con las confirmaciones de Block 5, sin cambiar sus consecuencias.
2. **Copia del viaje** — exportar/importar JSON sin tocar el formato; confirmación explícita
   «Esto sustituirá todo lo que hay en este navegador.» ANTES de escribir; foco y Escape.
3. **Cómo funciona Nihon** — reabre el explicador de cinco pasos (`05 §1`); el último paso escribe
   nombres y persona activa en el mismo almacén de `useTravellers`.
4. **Fuentes y licencias** — datos, MLIT íntegro, resumen y enlaces de licencias fotográficas,
   fuentes de datos con su fecha de consulta.
5. **Acerca de** — versión de la app desde `package.json` (única fuente de verdad).

## Fuera de scope

Explorar, Quiero ir, Viaje (B9), Pulido (B10), `PlaceDetail`, mapas, shell global, datasets y
fotografía, Vercel/deployment, Astra, PR #154.

## Invariantes / datos protegidos

- Claves de almacenamiento: `nihon.travellers.v1`, `nihon.manualPlanningDraft` (las dos únicas que
  restaura un import) y `nihon.onboarding.seen.v1`. Ninguna clave nueva.
- Un único almacén de nombres/persona activa: `useTravellers` (un solo `useState`).
- Formato de backup `nihon-portable-backup` v1: sin cambios. Reemplazo, no fusión.
- `MAX_TRAVELLERS = 2`. Cambiar la persona activa no toca preferencias, ids ni personas.
- DD-007: el conmutador «Eres» no vuelve a la cabecera.

## Criterios de aceptación

Los de `05 §11` y `10 §B8` más los de `05 §1`; verificados por `scripts/b26-nosotros-check.mjs`
(Chromium y WebKit) y `src/b26-nosotros.test.ts`. Ver `docs/BLOCK_26_HANDOFF.md`.

## Puertas

`git diff --check` · build · lint · Vitest completo · gate B26 (Chromium + WebKit) · B25 ·
integration-b24-b23 · Phase 5A (×2) · DD-028 · B18 back / viaje-lugar / chrome / a11y / regression /
responsive · B17 · B5 · B6 · B23 · resto de gates de navegador vigentes.
