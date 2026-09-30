# B29 — B9.3 «Herramientas del día» — handoff (línea Claude)

Misión: `docs/BLOCK_29_MISSION.md`. Continúa `docs/BLOCK_28_HANDOFF.md`.

| Campo | Valor |
|---|---|
| Rama | `claude/b29-viaje-b9-3-herramientas-dia` |
| Base (verificada) | `dd5fee06e3c0b4bdaa7c03512466b0f967e02eb2` = HEAD de `claude/b28-viaje-b9-2-reordenar` |
| PR | borrador: base `claude/b28-viaje-b9-2-reordenar` ← head B29 (no `main`) |
| Codex, Astra, `main`, Vercel | no usados ni mezclados |

## Auditoría previa
- **Comparación global (B28):** vista `compare` con Orden A/B sembrados con el orden visible, `compareSequences`
  y un texto de resultado tipo «gana A/B».
- **Alternativas:** cinco generadores (`generateEvidenceComplete*`: local swap, local relocation, interior
  transposition, four-place reversal, two-pair block swap), agrupados por `dayId` en el builder sin ordenar
  y con deduplicación por orden candidato. Cada alternativa lleva `candidateDayPlaceIds` (orden completo del día).
  Antes se aplicaban con `apply*` (guarda de obsolescencia + mutación) desde botones «Aplicar…» inline.
- **`sequence-comparison.ts`:** `compareSequences(a, b)` reutiliza `orderedSequenceFromLookup`/`getBestTransfer`.

## Arquitectura
- `components/DayOrderSheet.tsx`: hoja (sobre `Sheet`) con «Orden actual» (solo lectura), «Otro orden» (estado
  transitorio, copia del actual, ↑/↓ 44 px), comparación (`compareSequences(actual, propuesta)`), alternativas
  vía render-prop y acciones «Usar este orden» / «Cancelar».
- `components/day-order.ts`: helpers puros (`planDayOrderMoves`, `isPermutationOf`, mover ↑/↓).
- `OrderedSequenceBuilder`: estado `dayOrderFor` (id estable del día), botón por día (≥2 paradas) en el nuevo
  slot `tools` de `DayTimeline`, y `applyDayOrder`, **la única escritura**: repite `movePlaceToPosition` (B28,
  mismo día) por cada movimiento; al ser `setDraft` funcionales se agrupan en un solo borrador y una escritura.
- Cero cambios en `lib/`, `usePlanningDraft.ts`, V8 y clave.

## Comparación global retirada
Sin botón de primer nivel, vista `compare`, `Orden A/B`, `ReorderableList`, `CandidateSummary`,
`comparisonResultText`. La sección de alternativas salió de «Horarios, reservas y herramientas» (aplicaba
directamente) y vive solo en la hoja, con botones «Probar …» que únicamente cargan «Otro orden». Los `apply*`
de dominio siguen en `lib/` (con sus tests) pero la interfaz ya no los llama.

## Garantías
No auto-aplicación (abrir, editar, cargar alternativa, cancelar, Escape, fondo no escriben; probado con
contador de `setItem`). Sin «mejor»/«recomendado»/ranking/ganador. Propuesta idéntica = CTA deshabilitado.
Propuesta obsoleta (no permutación) no planea movimientos.
Persistencia: propuesta nunca persistida; día por id estable (probado con día movido por B28).
Accesibilidad: diálogo con foco atrapado, listas nombradas por sus h3, región `aria-live` cortés, foco a
«Probar otro orden» del mismo día al cerrar/aplicar, sin `aria-grabbed`.

## Tests y gates
- Vitest: 3493/3493 (+26: `b29-day-order-model`, `b29-day-order-wiring`, `b29-invariants-scope`). Reescritos
  17 tests de fuente 3E que fijaban el «Aplicar» inmediato (ahora fijan «cargar» + «Usar este orden»).
- `b29-day-tools-check.mjs`: 40/40 (A acción, B apertura, C propuesta, D cerrar, E opciones, F aplicar, G teclado,
  H 320/360/390/430/768/840/1200/1440, I invariantes B28, consola).
- Gates B27 (K01/K02) y B28 (I02) actualizados por el cambio de contrato: B27 48/48, B28 43/43.
- Audits 3E-e/g/i/k adaptados (cargar + «Usar este orden»): pasan.

## Regresión
Ver «Auditoría final (Claude Project)». Resumen: sin fallos exclusivos de B29; todos los fallos observados
están reproducidos también en la base `dd5fee0`.
Lint: 0 errores + el aviso heredado de `PlaceMap.tsx`.

## Visual
Capturas con `NIHON_B29_SHOTS` a 320/390/768/1440 (acción, hoja, propuesta reordenada, comparación, alternativa,
antes/después de usar, cancelación). Corregido: flechas que bajaban de línea, jerarquía de la frase de
comparación, barra del CTA a ancho completo.

## Auditoría final (Claude Project)
Veredicto: **IMPLEMENTACIÓN CERTIFICABLE**; sin fallos exclusivos de B29. Certificación frente a la base
contractual `dd5fee06e3c0b4bdaa7c03512466b0f967e02eb2`; los fallos heredados son deuda previa, no regresiones B29.

Pasan: `tsc -b` 0 errores; oxlint 0 errores (solo aviso heredado de `PlaceMap.tsx`); Vitest 3493/3493;
B29 40/40 en Chromium 1194 y 36/36 en WebKit 26.5; B28 43/43; B27 48/48; resto de gates principales.

Fallos heredados, reproducidos también en la base `dd5fee0`:
- Phase 5A: fotografía intermitente (falla a veces en B29 y en la base).
- Integración B24+B23: falla únicamente por Phase 5A.
- B28 T02 con Chromium 1234: 42/43 en B29 y en la base; con Chromium 1194, 43/43 en ambas.
- `b18-regression-check`, `b24-real-input-audit` P0-2, block1, block3, block4, block13, block14.

Fallos exclusivos de B29: ninguno.
WebKit 26.5 sí fue medido. Safari físico en iPhone NO fue medido.

Nota de trazabilidad: este commit documental sustituye funcionalmente a los commits locales no transferibles
`b8709f9` y `16fcc6b` (solo tocaban este archivo; no se pudieron publicar desde Claude Project por falta de
credenciales y no existen en este repositorio).

## Deuda
- iPhone Safari real pendiente (WebKit 26.5 sí medido: B29 36/36).
- Fallos heredados listados arriba: deuda previa a B29.
- Sin arrastre dentro de la hoja (solo flechas): decisión de alcance.
- La frase «suma al menos N min menos» describe la diferencia mínima entre rangos; revisar redacción en B10.
- Entorno: enlace de `chromium_headless_shell-1234` al binario 1194 y `vite preview` en 4181 para los gates B17/B18.
