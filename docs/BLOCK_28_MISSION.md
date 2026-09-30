# MISIÓN B28 — B9.2 «Reordenar» · Nihon (línea Claude)

Bloque 28 del repositorio = **B9.2** del roadmap (`docs/design/10 §B9`), únicamente. Continúa **B27 / B9.1
de Claude** (`claude/b27-viaje-b9-1-dias`); no es B9.3, B9.4 ni B9.5.

## Línea y base

- Rama: `claude/b28-viaje-b9-2-reordenar`.
- **Base obligatoria y verificada (`git rev-parse HEAD` antes de tocar nada):**
  `b351469024ecedad5fc8952015614973d56226ed` = HEAD de `claude/b27-viaje-b9-1-dias` (PR #163).
- No parte de `main`. No hay merge ni rebase desde `main`, ni cherry-pick, ni ramas `codex/*`, ni Astra,
  ni Vercel. La arquitectura B27 de Claude es la única base funcional.
- PR apilado en borrador: **base `claude/b27-viaje-b9-1-dias` ← head `claude/b28-viaje-b9-2-reordenar`**.
  No apunta a `main` (mezclaría líneas). No se hace merge.

## Alcance B9.2 (lo que este bloque hace)

1. Reordenar una parada dentro del mismo día (puntero, táctil y teclado).
2. Moverla a otro día, a una **posición concreta** (incluido un día vacío).
3. «Sin asignar» como origen (→ día) y como destino (día → «Sin asignar»).
4. Reordenar días: se **conservan** los controles `↑ ↓` de día de B27 (mueven la entidad entera con su
   id, sus paradas y su alojamiento). Arrastrar días no se hace: los controles cubren el contrato y
   arrastrar un bloque tan alto choca con el scroll (ver deuda).
5. Persistencia por la **misma fuente de verdad** (borrador V8, `nihon.manualPlanningDraft`): sin
   estructura paralela para el arrastre; el estado «llevando una parada» es transitorio y nunca se persiste.
6. Identidad estable de día: ningún gesto regenera ni reasigna ids.
7. Alternativa completa por «Mover a…» (día + posición) y, para «Sin asignar», «Añadir al día…».
8. Accesibilidad por teclado y `aria-live`; foco restaurado; cancelación.
9. Feedback visual: parada de origen atenuada, tarjeta flotante con «Día N, posición k de n», barra de
   inserción, día destino resaltado, zona «Suelta aquí» en un día vacío, «Sin asignar» resaltado.
10. **«Añadir al día…» sin rehacer el reparto** (la deuda que documentó B27): implementada porque
    encaja limpiamente en V8 (ver handoff).

## Exclusiones (NO se hacen aquí)

| Subbloque | Responsable de | Estado en B28 |
|---|---|---|
| B9.3 | «Probar otro orden» local al día | La comparación A/B sigue exactamente como en B27 (sembrada con el orden visible). |
| B9.4 | Dónde dormir | Intacto. |
| B9.5 | Reservas y Resumen propios; retirada de `Dato:` | Intactos; `Dato:` **sigue presente**. |

## Invariantes (no cambian)

Esquema y clave V8 · identidad estable de día · `startDate`/`endDate` · alojamiento por día, legs
manuales y horas de inicio · `InterHubSegment` · fechas oficiales de reserva · composición del viaje ·
alternativas verificadas · comparación de órdenes · algoritmo de traslados · formato de backup portátil.
Nihon no propone ni «mejora» ningún orden: sólo mueve lo que la persona mueve.

## Contratos de interacción

- **Asa** (único elemento con `touch-action: none`): `<button>` de 44×44 con nombre «Reordenar X, parada
  N de M» y `aria-describedby` a las instrucciones. Un gesto táctil que empieza en cualquier otro punto
  de la tarjeta sigue desplazando la pantalla.
- **Puntero/táctil**: eventos de puntero (no HTML5 drag); umbral de 4 px; captura de puntero; auto-scroll
  en los bordes; `pointercancel` y Escape cancelan; soltar fuera de un destino cancela.
- **Teclado** (en el asa): Espacio/Intro coge · ↑/↓ mueven por la lista completa (día 1 … día N, y
  «Sin asignar» al final) · Espacio/Intro suelta · Escape cancela · salir del asa cancela (nunca suelta).
- **Un único commit**: ratón, táctil, teclado y «Mover a…» terminan en `commitStopMove`, una mutación
  pura por gesto (sin orden intermedio persistible).

Cierre y resultados: `docs/BLOCK_28_HANDOFF.md`.
