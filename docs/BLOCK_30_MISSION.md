# MISIÓN B30 — B9.4 «Dónde dormir» · Nihon (línea Claude)

Bloque 30 = **B9.4** (`docs/design/10 §B9.4`), únicamente. Continúa B29 / B9.3 de Claude. No es B9.5.

## Línea y base

- Rama: `claude/b30-viaje-b9-4-donde-dormir`, creada desde `52fbc6bd029e5fa9e34ce4aa1104a1914bfc0c7e`
  (= HEAD de `claude/b29-viaje-b9-3-herramientas-dia`, verificado con `git fetch` + `git rev-parse`).
- PR en borrador: base `claude/b29-viaje-b9-3-herramientas-dia`. Sin merge, sin `main`, sin Codex/Astra/Vercel.
- Nota de entorno: la sesión arrancó en `claude/b30-donde-dormir-decisions-c0xek5` (desde `main`, con el
  merge de Codex PR #167). Esa rama NO se usa: mezclaría líneas. Se trabaja sólo en la rama de la misión.

## Fuente de verdad

`docs/design/05 §8`, `06 §5.5`, `10 §B9.4`, `02`, `03` (registros ◼◇✎), `09` (DD-015), `00 Art. 5`.

## Objetivo

Elegir zona de alojamiento comparando hechos, cálculos y opinión, sin ranking. Arregla D7. Sólo presentación.

## Decisiones cerradas por el Product Owner (D1–D5)

- **D1** `PhotoPlaceholder` admite `icon` y `brief` opcionales; comportamiento previo intacto; zonas con icono de cama.
- **D2** Zona elegida = insignia «Zona elegida» + «Quitar»; las demás = «Dormir aquí».
- **D3** Sin numerales: pin neutro con el nombre de la zona como etiqueta; columnas y contrastes por nombre.
- **D4** Bloques actuales → ◼ Hechos / ◇ Calculado / ✎ Nihon dice, sin contenido nuevo.
- **D5** Única línea de encuadre «◇ Ordenadas por cercanía a vuestros sitios guardados» (+ aclaración de línea
  recta); subtítulo y banner se reubican sin perder información.

## Escribe / no escribe

- Escribe: sólo lo que ya escriben `chooseZone`/`clearZone` (borrador V8 vía `useZonePlanChoice`).
- No escribe: claves nuevas, dataset, fotografías, nada al abrir/comparar/cerrar.

## Fuera de alcance

B9.5 y retirada de `Dato:` (4 apariciones se conservan); «Alojamientos y traslados entre ciudades»; `lib/`,
`planning-draft-v8`, `useZonePlanChoice`, `useZoneComparison`, `OrderedSequenceBuilder`, `DayTimeline`,
`DayOrderSheet`, `App.tsx`; refactors; despliegues; fotografía real de zonas.

## Invariantes

DD-015 (ficha apilada, chevron «‹ Dónde dormir», retorno exacto); Días como apertura; pie «Dormís en …»;
`DayOrderSheet` único escritor de orden; identidad estable de día; V8 y clave intactos; sin
«mejor/recomendada/ranking/ganador»; `Dato:` = 4; 16 zonas; Comparar máx. 4.
