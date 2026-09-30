# B28 — B9.2 «Reordenar» — handoff (línea Claude)

Misión: `docs/BLOCK_28_MISSION.md`. Continúa `docs/BLOCK_27_HANDOFF.md` (B27 / B9.1, PR #163).

| Campo | Valor |
|---|---|
| Rama | `claude/b28-viaje-b9-2-reordenar` |
| Base (verificada con `git rev-parse HEAD`) | `b351469024ecedad5fc8952015614973d56226ed` = HEAD de `claude/b27-viaje-b9-1-dias` |
| PR | apilado, **borrador**: base `claude/b27-viaje-b9-1-dias` ← head `claude/b28-viaje-b9-2-reordenar` |
| `main`, Codex, Astra, Vercel | **no** usados ni mezclados (sin merge/rebase/cherry-pick de ninguno) |

## Arquitectura

Una sola fuente de verdad (borrador V8, `nihon.manualPlanningDraft`, esquema y clave **sin cambios**) y una
sola ruta de commit. Ratón, táctil, teclado y «Mover a…» terminan en `commitStopMove`
(`OrderedSequenceBuilder.tsx`), que llama a **una** mutación pura por gesto, por ids estables de día.

| Pieza | Fichero | Función |
|---|---|---|
| Mutaciones V8 | `lib/planning-draft-v8.ts` | `withPlaceMovedToPosition` (día y posición finales, un solo estado; compone las dos mutaciones de identidad estable ya existentes), `withPlaceAddedToDay` («Añadir al día…»), `withPlaceRemovedFromDay` (día → «Sin asignar») |
| Hook del borrador | `usePlanningDraft.ts` | `movePlaceToPosition`, `addPlaceToDay`, `removePlaceFromDay` (mismo `setDraft(current => …)` funcional) |
| Geometría pura | `lib/stop-reorder.ts` | `StopSlot`/`StopOrigin`, `insertionIndex`, `stepSlot` (teclado), `clampSlot`, `describeSlot`, `clampGhostPoint` |
| Controlador | `components/useStopReorder.ts` | estado **transitorio** «llevando una parada» (nunca se persiste, no toca el borrador ni el almacenamiento), eventos de puntero, teclado, auto-scroll |
| Presentación | `TripStop` (asa), `DayTimeline` (destino), `UnassignedDrawer` (origen/destino), `StopDragGhost` (tarjeta flotante), `StopActionsSheet` (`Mover a…` / `Añadir al día…`) | sin lógica de planificación |

Coordenadas: el índice de destino es **final** (mismo día 0…n-1; otro día 0…n). Un gesto = un borrador
final; recargar nunca observa un orden intermedio.

## Drag / puntero

Asa por parada (`<button>` 44×44, icono `arrastrar`), eventos de puntero (no HTML5 drag: sin `draggable`,
`aria-grabbed` ni `onDrag*`). Umbral 4 px, `setPointerCapture`, escucha en `window`. Feedback: parada de
origen atenuada y con borde discontinuo; **tarjeta flotante** sobre el puntero con «Día N · fecha · ciudad,
posición k de n» (o «Suelta dentro de un día»); **barra de inserción** azul (`--info-600`, absoluta: no
desplaza el layout); día destino con contorno; día vacío con zona «Suelta aquí»; «Sin asignar» resaltado
cuando el destino es sacar la parada del día. Cancelar: Escape, `pointercancel` o soltar fuera de un
destino; soltar en la misma posición no escribe nada. El cursor pasa a `grabbing` (`body.is-reordering`).

Destinos cubiertos: mismo día (primero↔último), otro día en posición exacta, día vacío, «Sin asignar» → día
(hueco exacto) y día → «Sin asignar».

## Touch

- `touch-action: none` **sólo** en las asas (un test de fuente lo fija a una única declaración); un gesto
  que empieza en el nombre, la miniatura, la tarjeta o el conector sigue desplazando la pantalla (medido con
  eventos táctiles reales por CDP en el gate).
- Auto-scroll en los 72 px superiores/inferiores del viewport (no sobre «Sin asignar», que en móvil está
  fijo abajo); verificado que un arrastre hasta el borde superior desplaza la lista sin perder nada.
- Sin hover. Objetivos ≥44 (asa y «Acciones»). En ≤400 px asa y «Acciones» se **apilan** (columna) porque
  lado a lado el nombre quedaba en ~20 px a 320 px; `--trip-rail-x` baja a 8 px en ese rango.
- El fantasma queda encima del dedo (nunca debajo) y se acota al viewport.

## Teclado y «Mover a…»

En el asa: **Espacio/Intro** coge · **↑/↓** mueven por la lista completa (día 1 … día N, «Sin asignar» al
final; cruzar un borde de día entra por su extremo cercano) · **Espacio/Intro** suelta · **Escape** cancela ·
salir del asa (Tab) **cancela**, nunca suelta. `aria-pressed` refleja «cogida»; instrucciones en
`#reorder-instructions` (`aria-describedby`). Cada paso se anuncia por la región `aria-live` existente
(«Día 2, posición 1 de 3.»; «movido al Día 1, posición 3 de 3.»; «Movimiento cancelado…»). Foco tras
soltar: el asa de la parada (tras «Mover a…» sigue siendo su botón «Acciones», contrato B27; tras sacarla del
día, «Sin asignar»).

**«Mover a…» se conserva como alternativa completa** (día + posición, mismo día u otro, día vacío, cancelar
con Escape devolviendo el foco, anuncio). Para una parada de «Sin asignar», el botón `＋` pasa a
**«Añadir al día…»** (hoja con día y posición; «Añadir aquí» / «Cancelar»).

## Persistencia e identidad estable

Ningún gesto crea ni reasigna ids de día; los días vacíos conservan su id; los demás días quedan
byte-a-byte iguales (test de modelo). Alojamiento por día, legs manuales, horas de inicio, fecha y
traslados entre ciudades no se tocan (un día que queda vacío resetea su alojamiento a `unselected`, regla
§8.3 ya existente; el destino conserva el suyo). Recargar conserva orden e ids (I01 del gate). Los ↑ ↓
de **día** (B27) siguen moviendo la entidad entera.

## «Añadir al día…» — resuelto (deuda de B27)

Encajaba limpiamente en V8 sin cambiar el esquema: `withRoute` invalida `days` porque una lista plana no
dice *dónde* va el lugar; aquí la persona lo dice (día y posición), así que la ruta crece en el lugar y se
inserta en **ese** día. Tampoco «Quitar del recorrido» rehace ya el reparto (`withPlaceRemovedFromDay`, poda
hora/legs/traslados del lugar como `withRoute`). Consecuencias, con el contrato B27 actualizado y
documentado en el gate B27 (M05, U02, U03): desaparece la confirmación «rehace el reparto por días» y el
aviso equivalente; `hasChosenBoundary`/`routeChangeDiscardsSplit` y `addUnassignedToRoute` se eliminan.
La vía `withRoute` (invalidar el reparto) queda intacta para «Restablecer recorrido» y el modelo.

## Tests

- `src/b28-reorder-model.test.ts` (17): mutaciones nuevas — mismo día, entre días, primero↔último, día
  vacío, ruta inversa, ids estables, sin duplicados/pérdidas, alojamiento/legs/horas, rechazos sin efecto,
  persistencia serializar/parsear.
- `src/lib/stop-reorder.test.ts` (7): geometría pura y navegación por teclado.
- `src/b28-reorder-wiring.test.ts` (8): una sola ruta de commit, sin estado paralelo, sin HTML5 drag,
  `touch-action` sólo en el asa, `aria-live`/instrucciones, Art. 10 (tokens) en el CSS nuevo.
- Actualizados con comentario: `b27-model-invariants` (protege lib/hook salvo lo de B28; el icono
  `arrastrar` ya es legítimo), `OrderedSequenceBuilder.stable-day-identity` (el commit único por ids).
- **Gate permanente** `app/scripts/b28-viaje-reordenar-check.mjs` (43): D puntero (12) · I invariantes (3) ·
  K teclado (7) · M «Mover a…» (6) · T táctil real con CDP (6) · L 320/360/390/430/768/840/1200/1440 (8)
  · C consola. Cubre: mismo día, entre días, primero→último, último→primero, día vacío, «Sin asignar»↔día,
  keyboard-only, cancelación (Escape, soltar fuera, `pointercancel`, blur), foco, `aria-live`, recarga,
  ids estables, conectores (N−1 por día), alojamiento intacto, comparación A/B, PlaceDetail/back, sin
  duplicados ni pérdidas, sin overflow (también durante el arrastre).
- `b17-tap-target-check` mide ahora también el asa (`.trip-stop__handle` ≥44).

## Regresión (sobre la build final; los históricos comparados con la base Claude `b351469`, no con `main`)

| Comprobación | Base `b351469` | Rama B28 |
|---|---|---|
| build / lint | PASS · 0 errores + 1 warning heredado (`PlaceMap.tsx:17`) | PASS · el mismo warning |
| Vitest | 108 ficheros, 3430/3430 | 111 ficheros, **3462/3462** |
| **B28** `b28-viaje-reordenar-check` | — | **43/43** |
| B27 `b27-viaje-dias-check` | 48/48 | 48/48 (M05/U02/U03 actualizados por diseño) |
| Phase 5A · integración B24+B23 · B25 | 50+50 · 58 · 123 | 50/50 · 58/58 · 123/123 |
| B26 Nosotros (Chromium) · DD-028 | 314 · 16 | pasa · 16/16 |
| B18 back / viaje-lugar / chrome / a11y | 15 · 38 · 6 · 25 | pasan (exit 0; a11y 25/25, chrome 6/6) |
| B17 regresión / tap | 18 · 25 | pasan (tap: + asa) |
| B5 · B6 · B23 · DDR-03 · ficha B20 · grid · contraste | — | pasan (73/73 ficha, 52/52 grid, contraste PASS) |
| audits planner 3e-{e,g,i,k} y 3f-{f,h,j,s} | pasan | **8/8 pasan** (0 errores de consola/página) |
| `block1-ux`, `block3-zones`, `block4-zone-planner`, `block13`, `block14`, `b18-regression` | fallan (deuda B10) | fallan **con la misma salida** (comparado con `diff` de los checks) |

Nota de entorno: los audits que lanzan `chromium.launch({headless:true})` sin ruta necesitan el
`chromium_headless_shell` que esta imagen no trae bajo la revisión que pide Playwright; se resolvió
enlazando el binario 1194 existente (cambio de entorno, no del repositorio). WebKit: no medido (no hay
WebKit en el entorno). Pendiente humano heredado: iPhone Safari real (arrastre táctil real en iOS).

## Auditoría visual (Chromium real)

Capturas del gate con `NIHON_B28_SHOTS`: arrastrando y tras cancelar a 320, 390, 768 y 1440; día vacío como
destino y teclado cogido a 1440/390; medidas de layout (overflow, tamaños, solapes, texto legible ≥70 px,
fantasma dentro del viewport, arrastre y cancelación completos) a **320, 360, 390, 430, 768, 840, 1200 y
1440**. Hallazgos corregidos: a 320 px el nombre de la parada quedaba en ~20 px con asa y acciones lado a
lado → se apilan en ≤400 px y el raíl se estrecha; el fantasma tapaba «Suelta aquí» → ahora flota **sobre**
el puntero; el icono del asa era tenue → `--ink-900` a 24 px; el título fijo de «Sin asignar» en `lg` no
recibía foco → `tabIndex={-1}`. Estado tras cancelar: sin restos (atenuado, barra, contorno) en ningún ancho.

## Deuda / decisiones abiertas

- **Arrastrar días completos**: no se implementa; los ↑ ↓ de día de B27 (mueven la entidad con id,
  paradas y alojamiento) cubren el contrato y un arrastre de bloque alto compite con el scroll. Reabrible
  si B10 lo pide.
- **Densidad a 320 px**: con la columna asa/acciones el texto ronda 76 px (3–4 líneas en nombres largos);
  la decisión final de la miniatura/rail a 320 es de B10 (polish).
- **iPhone Safari real** (gesto táctil, `touch-action` en iOS): sin medir aquí.
- **Reordenar dentro de «Sin asignar»**: no aplica (es la lista guardada, no un orden).
- B9.3 «Probar otro orden» (y su relación con el orden arrastrado), B9.4, B9.5 y la retirada de `Dato:`
  siguen intactos y son de sus bloques.
