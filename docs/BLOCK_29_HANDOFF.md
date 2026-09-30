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
Pasan: b17 regresión/tap/responsive, b18 a11y/back/chrome/viaje-lugar/responsive, b24, b25, b26, b27, b28, b29,
block5, block6, block19 contraste/grid, block20, block23, dd028, ddr03, integración B24+B23, phase3e-e/g/i/k,
phase3f-f/h/j/s, phase5a.
Fallan y ya fallaban en la base B28 `dd5fee0` (medido en un worktree de la base; misma salida ignorando rutas):
block1, block3, block4, block13, block14. `b18-regression-check` falla también (deuda B10 documentada en B28;
no se re-ejecutó en la base porque usa el puerto fijo 4181).
Lint: 0 errores + el aviso heredado de `PlaceMap.tsx`.

## Visual
Capturas con `NIHON_B29_SHOTS` a 320/390/768/1440 (acción, hoja, propuesta reordenada, comparación, alternativa,
antes/después de usar, cancelación). Corregido: flechas que bajaban de línea, jerarquía de la frase de
comparación, barra del CTA a ancho completo.

## Deuda
- WebKit no medido (no hay en el entorno); iPhone Safari real pendiente.
- Sin arrastre dentro de la hoja (solo flechas): decisión de alcance.
- La frase «suma al menos N min menos» describe la diferencia mínima entre rangos; revisar redacción en B10.
- Entorno: enlace de `chromium_headless_shell-1234` al binario 1194 y `vite preview` en 4181 para los gates B17/B18.
