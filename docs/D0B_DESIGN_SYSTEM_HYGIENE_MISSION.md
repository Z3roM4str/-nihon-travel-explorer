# D0b — Higiene del sistema de diseño (misión)

**Línea:** Claude. **Base exacta:** `2f2e5e1677c0cb0a8b84536247fdd86f097277dc`
(`claude/design-phase-1-v2-1-docs`). **Rama:** `claude/d0b-design-system-hygiene`. PR en borrador, sin merge.

D0b es higiene técnica/visual del sistema existente (`docs/design/11 §2/§3/§11/§12`, `12 regla 8`). **No** es un
rediseño y no cambia arquitectura, navegación, comportamiento, persistencia, datos ni funcionalidades.

## Frentes

| Frente | Alcance | Regla de parada |
|---|---|---|
| A | Literales visuales → tokens **existentes** | Sin equivalente exacto/inequívoco: no se toca; se registra `DESIGN DECISION REQUIRED — literal sin token equivalente`. |
| B | `input`/`select`/`textarea` ≥ 16 px en móvil, sólo con tokens `--type-*` | Sin token adecuado: `DESIGN DECISION REQUIRED — falta token tipográfico adecuado`. |
| C | `viewport-fit=cover` + auditoría de `env(safe-area-inset-*)` | Si exige reglas de layout no respaldadas por contrato: parar y documentar. |
| D | Media queries legacy: clasificar A (equivalente directo) / B (excepción documentada) / C (deuda) | Sólo se migra A. |
| — | EvidenceMark 11 px vs 12 px | Sólo auditoría; no se cambia. |

## Fuera de alcance

`lib/`, `data/`, V8 y su clave, hooks, persistencia, DayTimeline, DayOrderSheet, ZoneComparison, PlaceDetail
(salvo safe-area estrictamente necesaria), PlaceGallery, fotografía, navegación de 4 destinos, History API,
confirmaciones/toasts, viajeros/PersonToken, vocabulario (D5). No se empieza D5, D2, F1, D4, D3, D6 ni D7.

## Gate

`app/scripts/d0b-design-system-hygiene-check.mjs` (ver cabecera del script). Resultados y decisiones:
`docs/D0B_DESIGN_SYSTEM_HYGIENE_HANDOFF.md`.
