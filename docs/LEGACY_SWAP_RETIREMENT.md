# Retirada del panel heredado «Alternativas locales con evidencia completa»

**Estado:** ejecutada en el endurecimiento post-B10. Sin cambio de UX: el componente ya no estaba montado.

## Qué se retiró
- `LocalSwapAlternativesSection` y su cadena de handlers `apply*` en `OrderedSequenceBuilder.tsx` (L1, UI).
- Cinco callbacks de `usePlanningDraft` que sólo ese panel invocaba (L2, hook).
- Las aserciones de tests que escaneaban esos callbacks o el texto del panel; se conservan las que fijan la mutación pura sobre el borrador (v8) y las cifras de las alternativas.
- Los gates `phase3e-e/g/i/k-browser-audit` pasan a `scripts/archive/` con banner ARCHIVADO. Su cobertura vigente: `evidence-options-check` y B29 (equivalencia en `GATE_RETIREMENT_AUDIT.md`).

## Prueba de que era inalcanzable
`DayOrderToolPanel` (B29) sustituyó al panel; ninguna vista montaba `LocalSwapAlternativesSection` y ningún otro llamador usaba los callbacks retirados (verificado por tsc/oxlint sin imports huérfanos y por la suite completa).

## Deuda restante (no retirada a propósito)
- L3/L4: `withPlace…Within Day`-style wrappers de aplicación y funciones puras de `planning-draft` siguen existiendo con tests propios; ya no tienen consumidor de UI. Retirarlos exigiría reescribir sus tests de dominio; se difiere.
- Modos modales no `embedded` de `ZoneComparison` y `OrderedSequenceBuilder`: `App` siempre monta `embedded`; sin consumidor.
- B30 retiró el énfasis de directitud (`zone-fact--strong`) sin decisión documentada (ver `GATE_RETIREMENT_AUDIT.md`).
