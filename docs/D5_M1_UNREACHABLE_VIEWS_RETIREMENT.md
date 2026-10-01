# D5-M1 / B10-C2 — Retirada de las vistas `builder` y `compare` de `OrderedSequenceBuilder`

**Decisión: RETIRADAS.** Autorizada por Producto para el caso «código muerto y fuera del alcance canónico vigente». Esta página es la prueba formal de que se cumplen las cuatro condiciones.

## 1. No son alcanzables (prueba por cierre de la máquina de estados)
`OrderedSequenceBuilder` (antes de la retirada) tenía **un único** estado de vista: `useState<"builder" | "compare" | "days">("days")`. Todas las escrituras de ese estado (`grep -n "setView("`):

| Escritura | Función | Quién la llama | Dónde está ese control |
|---|---|---|---|
| `setView("compare")` | `openComparison` | botón «Comparar otro orden» | **dentro** del JSX de `view === "builder"` |
| `setView("builder")` | `closeComparison` | botón «Volver al recorrido» | **dentro** del JSX de `view === "compare"` |
| `setView("days")` | `openDayAssignment` | botón «Distribuir por días» | **dentro** del JSX de `view === "builder"` |

Estado inicial `days`; los únicos caminos para salir de `days` nacen en `builder`/`compare`, que sólo se alcanzan desde `builder`/`compare`. Ni props (`savedPlaces`, `onClose`, `embedded`, `onSelectPlace`, `section`, `onSectionChange`), ni efectos, ni teclado, ni URL, ni `localStorage` escriben `view`. Hay un único montaje (`App.tsx:1422`, `section={viajeSection}`), sin `initialView`. Conjunto cerrado ⇒ `builder` y `compare` no se pueden alcanzar. Verificado además en navegador: en 13 pantallas × 2 anchos (gate B10 a11y) y en la sonda de encabezados sólo aparecen los de la vista `days`; la vista sólo se podía observar con «Comparar otro orden», que `b29` prueba **ausente** («22: global A/B compare is absent from primary Días UX»).

## 2. Ningún estado persistido vigente depende de ellas
`view` es `useState` (no se persiste). Los candidatos A/B eran estado efímero del componente («deliberately NOT part of the persisted draft», `lib/planning-draft.ts`); el borrador persistido (`nihon.manualPlanningDraft`, v8) guarda `routeIds`, días, fechas, alojamientos y tiempos de visita, que **siguen** usándose en `days`. No hay migración ni cambio de esquema; `lib/planning-draft*` sólo cambió en un comentario. `usePlanningDraft` conserva `resetRoute` (API del hook y de `planning-draft-v*`, con sus pruebas); sólo desaparece su único botón, que vivía en la vista retirada («Restablecer lugares y días»).

## 3. Ningún contrato actual depende de ellas
* **Datos/lib**: `lib/` sólo cambió en comentarios y en la retirada de `lib/hours-planning.ts` (único consumidor: la sección «Horarios registrados» de la vista `builder`). `lib/sequence-comparison.ts`, `ordered-sequence.ts` y todas las alternativas `evidence-complete-*` **siguen vivas**: las consume `DayOrderToolPanel` («Probar otro orden», B29).
* **Gates**: `b29` exige la ausencia del A/B global; `b17-tap-target` toca «Construir recorrido» sólo si es visible (`isVisible().catch(false)` ⇒ no-op); `b18-regression` ya registraba «Comparar otro orden» como inalcanzable; los gates `phase3e-*`/`block4` que lo nombran ya estaban clasificados obsoletos (`GATE_AUTHORITY.md`).
* **Exports**: ningún módulo importaba símbolos de las vistas (los `export` del archivo —`WholeTripCompositionSection`— no cambian).

## 4. El roadmap final no contempla esa capacidad
* B29 (`BLOCK_29_MISSION.md`): «Convertir “Probar otro orden” en una herramienta efímera asociada a un día… **no presenta A/B ni un score**»; es la sustitución explícita del A/B global.
* `docs/design/03 §10`: «Construir recorrido → Planear el viaje» y B25: «Construir recorrido → Llevar al viaje» (la capacidad «constructor de recorrido» se reemplazó por Quiero ir → Viaje).
* B27 convirtió Días en la superficie de entrada; el roadmap canónico termina en B10 sin una vista de recorrido ni de comparación globales.
* Corrección documental: `BLOCK_31_MISSION.md` afirmaba que `hours-planning` se «conserva en Días/herramientas»; en realidad su única superficie era la vista `builder`, no renderizada desde B27.

## Qué se retiró
| Qué | Antes → después |
|---|---|
| `OrderedSequenceBuilder.tsx` | 3 946 → 3 423 líneas: estado `view`, candidatos A/B, `openComparison/closeComparison/openDayAssignment`, `comparisonResultText`, `ReorderableList`, `HoursPlanningSection`, etiquetas de horario, `moveItemUp/Down`, `moveUp/moveDown/removeFromRoute/addToRoute`, vistas `builder` y `compare`, y los memos que sólo ellas usaban |
| `ZonePlanSection` | variante `summary` (sólo la usaba la vista `builder`) |
| CSS | 32 reglas huérfanas (`.sequence-item*`, `.sequence-list*`, `.comparison-*`, `.sequence-back/-compare-toggle/-secondary-actions/-reset`, `.hours-planning*`, `.zone-plan__summary-list`); `@media (max-width:380px)` y el resto de consultas se conservan |
| `lib/hours-planning.ts` (+ test) | 86 + 194 líneas, sin consumidor |
| Copy | «Construir recorrido», «Volver al recorrido», «Comparar órdenes», «Orden A/B», «Guardados fuera del recorrido», «Restablecer lugares y días», frases asociadas (la lista pinned del test D5 desaparece: ya no hay excepciones) |
| Pruebas | el bloque «recorded-hours signal wiring» (15 pruebas de una sección retirada) y su extractor; `hours-planning.test.ts` (19). Se **reescribieron** (no se borraron): D5 «sin alcanzables» → «retiradas y sin copy», R1, inter-hub (2→1 copia), stable-day-identity (sin union de vistas), local-swap/relocation (marcador de fin de función estable) |

## Qué NO cambió (medido)
Comparación visual main-vs-rama de **todas** las superficies vivas (320/390/430/840/1200 × 11): ver `docs/RELEASE_HARDENING_CERTIFICATION.md`.

## Certificación de la rama (Chromium 141; build de producción de la rama)
**Visual main-vs-rama**: 55 pares (320/390/430/840/1200 × 11 superficies vivas) **idénticos píxel a píxel**; las dos vistas retiradas no se podían ver, y ninguna superficie viva cambió.
tsc/build PASS · oxlint 0 errores · Vitest 117 archivos / **3 479** (antes 3 510 de la rama a11y: −31 = −19 de `hours-planning` y −15 del bloque «recorded-hours signal wiring» de una sección retirada, +3 pruebas nuevas de retirada) ·
b10 a11y 89/89 · motion 16/16 · microcopy 52/52 (**sin excepciones**: se retira `UNREACHABLE`) · performance 13/13 · D0b 56/56 · **D5 30/30** (R1 reescrito) · block12 · B17 ×2 · B18 ×5 · block19 ×2 · block20 · b24-ddr3 · B25 · B26 · B27 · B28 · **B29 163/163** · B30 475/475 · B31 281/281 · ddr03 · DD-028 · block5 · block6 · b21 · phase5a · block23 · b18-regression · integración B24+B23 58/58 · b6-5 416/416.
Cambios de gates (sólo para seguir midiendo lo mismo tras retirar las vistas): `d5-normative-vocabulary-check` R1 («el botón retirado no reapareció») y `b10-microcopy-check` sin la lista `UNREACHABLE`; y `b28` (J) mide que el auto-scroll queda quieto tras cancelar en vez de un baseline leído en vivo (la carrera hacía fallar a B28/B29 también en main).
