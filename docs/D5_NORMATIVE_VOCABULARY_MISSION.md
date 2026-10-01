# D5 — Vocabulario normativo (misión)

Línea Claude. Base exacta `4d2163165f791b2ba3b1db8c7cbb968e1c607314` (HEAD de `claude/d0b-design-system-hygiene`).
Rama `claude/d5-normative-vocabulary`. PR en borrador contra la rama base de D0b. Sin merge.

## Objetivo

Quitar de la **interfaz visible** (texto, headings, labels, botones, `aria-label`, `title`, estados vacíos, avisos, hojas) el
vocabulario interno que prohíben `00 Art. 7` y `03 §10`, con una sustitución sólo si **conserva exactamente el significado**.
Si no hay sustitución inequívoca: `DESIGN DECISION REQUIRED` y la cadena no se toca.

## Fuente normativa

- `00 Art. 7`: *recorrido*, *secuencia*, *constructor*, *orden A / orden B*, *tramo*, *candidato*, *Dato:*, *grado*, *provenance*,
  *freshness*, *analizar selección*, *cobertura*.
- `03 §10` (léxico): Recorrido/secuencia → «El viaje · el día»; Tramo → «Traslado»; «3/4 tramos cubiertos» → «Falta el traslado de X a Y»;
  Orden A/B → «Este orden / otro orden»; Grado → sólo en «Fuentes» plegado.
- `03` patrones prohibidos: letra de grado sólo en «Fuentes» plegado ⇒ excepción E1.
- `12 §11`: *reparto* y *compromisos de escala día* NO se sustituyen automáticamente.

## Alcance y prohibiciones

Sólo copy en la capa de presentación. Sin cambios en `lib/`, `data/`, hooks, V8, claves de storage, CSS, tokens, layout, navegación.
No D2/F1/D4/D3/D6/D7. No `main`, Codex, Astra, Vercel.

## Metodología

Inventario completo → clasificación A (visible, cambia) / B (visible, excepción normativa) / C (interna) / D (ambigua, DDR) →
sólo se modifica A. Gate de navegador `app/scripts/d5-normative-vocabulary-check.mjs` (texto visible + nombres accesibles) y test
`app/src/d5-normative-vocabulary.test.ts`. Detalle y resultados: `docs/D5_NORMATIVE_VOCABULARY_HANDOFF.md`.
