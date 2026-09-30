# Handoff B30 — B9.4 «Dónde dormir» (línea Claude)

- Rama `claude/b30-viaje-b9-4-donde-dormir`, base `52fbc6bd029e5fa9e34ce4aa1104a1914bfc0c7e` (B29 Claude). Misión: `docs/BLOCK_30_MISSION.md`.

## Qué cambia (sólo presentación)

| Ítem | Dónde | Cambio |
|---|---|---|
| Numerales | `ZoneComparison.tsx`, `App.css` | Eliminados `zone-card__index`, `zone-column__index` (columna y contrastes) y el número del pin. Pin neutro + etiqueta con el nombre (`zone-marker__label`, HTML escapado). Se conservan las cinco marcas editoriales (`Ordinal`). |
| Foto por zona | `PhotoPlaceholder.tsx`, `ZoneComparison.tsx` | `PhotoPlaceholder` gana `icon?` y `brief?` (sin ellos, salida idéntica). Cada tarjeta: `role="img"`, icono cama, línea editorial (`zone.summary`) también en el nombre accesible. Sin `<img>`, sin tocar dataset/assets. |
| Registros | `ZoneComparison.tsx`, `App.css` | ◼ Hechos = chips neutros (`.zone-fact--strong` ya no es verde); ◇ Calculado = fondo `--surface-sunken`; ✎ Nihon dice = `--font-voice` / `--type-quote`. Marca + texto (`EvidenceMark`), no sólo color. Las etiquetas `criterio` de contrastes y diez valoraciones se conservan (tests de B9). |
| Encuadre | `ZoneComparison.tsx` | Nota única «◇ Ordenadas por cercanía a vuestros sitios guardados (N en Ciudad). Es distancia en línea recta, no tiempo de trayecto.» Subtítulo de cabecera → pie de lista (`zone-list__closing`) en browse; «Comparando N zonas» sigue en compare. Banner `role="status"` pasa a después de la nota en browse (primero en compare). |
| Acción | `ZoneComparison.tsx` | «Dormir aquí» (`aria-label` «Dormir aquí en {zona}»). Elegida: insignia «Zona elegida» + «Quitar» (`aria-label` «Quitar {zona} del plan»). Un único `<button>` persistente → el foco no se pierde. Casilla: `aria-label` «Comparar {zona}»; «Quitar» del pie → «Quitar las zonas marcadas para comparar». |
| Comparar | sin cambio de lógica | Máx. 4 (`MAX_COMPARED`); bloques apilados en teléfono. |

## Cambios a tests existentes (justificados)

- `ZonePlanSection.test.ts` (bloque «ZoneComparison.tsx — the choice itself»): el texto «Usar esta zona en el
  plan», «Cambiar a esta zona» y «Quitar del plan» cambia a «Dormir aquí» / «Zona elegida» / «Quitar» —
  `docs/design/05 §8` («Acción por zona: “Dormir aquí”»), D2. Los `aria-label` siguen nombrando la zona.
- `scripts/block4-zone-planner-browser-audit.mjs`: regex de botones actualizadas al nuevo nombre (el script
  ya no llega a ese punto: falla antes en la base, ver deuda).

## Tests y gates nuevos

- `src/b30-donde-dormir-wiring.test.ts` (13) y `src/b30-invariants-scope.test.ts` (2; ni `lib/`, `data/`,
  `App.tsx`, hooks de zona/borrador ni componentes de Días cambian frente a `52fbc6b`).
- `app/scripts/b30-donde-dormir-check.mjs` (48 comprobaciones, Chromium 1194; `NIHON_BROWSER=webkit` para WebKit).

## Resultados (ver informe final para la tabla completa)

- `tsc -b` 0 errores; `oxlint` 0 errores (aviso heredado de `PlaceMap.tsx`); Vitest 3508/3508 (3493 + 15).
- B30 Chromium 48/48; B27 48/48; B28 43/43; B29 36/36 (el “40” de la misión y del handoff de B29 no
  coincide con lo medido, idéntico en la base: 36/36).

## Deuda / heredado (NO arreglado, reproducido en `52fbc6b`)

- `block3-zones-browser-audit`, `block4-zone-planner-browser-audit`, `block7-zone-provenance-browser-audit`:
  fallan idénticos en la base (navegan con selectores previos a B18/B19: `hub-bar__zones`, botón de ciudad).
- **WebKit no medido**: el binario `webkit-2336` no está instalado en el entorno y no se puede instalar aquí.
  iPhone Safari real: NO medido.
- Retirada de `Dato:` y mover «Alojamientos y traslados entre ciudades»: B9.5.
