# Integración B24 + B23 + B6.5-fix + B6.7 test-closure

**Fecha:** 2026-09-26 · **Rama:** `claude/integration-b24-b23-b65-b67` · **Sin PR, sin merge, `main` intacto.**

## Objetivo

Una única rama de integración que conserva íntegro el B24 cerrado, incorpora las correcciones
independientes de B6.7 test-closure, B6.5 timing fix y B23 photo retry, cierra los deferred de B24
bloqueados específicamente por B23/B6.7 (P0-5c, AB-1, AB-2, AB-4) y termina con regresión completa
en verde. AB-3 se reclasifica a roadmap (B10), no se implementa.

## SHAs autorizados (verificados con `git fetch --all`)

| Línea | Ref | SHA |
|---|---|---|
| B24 final (base de integración) | `claude/block-24-ux-real-input-audit` | `f95e81e96d497c253c1de86dac1319ba34dde785` |
| B6.7 test closure | `claude/block-22-b6-7-test-closure` | `61fa5e9c410e509521a103be9dd3d6962fc6e97c` |
| B23 photo retry | `codex/block-23-photo-retry` | `52a7073799bdeeb180949ef379275201a94879fe` |
| B6.5 timing fix | `codex/block-22-b6-5-gate-timing-fix` | `af21671a99b63b451df11ac15c11775d94dc324e` |
| B6.7 base | — | `4afbf50e9d1e3137f9148c6c471c1c40aac6a56f` |
| `main` (no se toca) | `origin/main` | `8eb725eeb836ca121180f8dd8b0dc49c65efae25` |

## Reglas

- B24 es la base y la autoridad sobre arquitectura, navegación, layout y normas de diseño. No se
  rebasa B24 sobre nada; B23 no es base.
- Se integran sólo los commits propios de cada línea, en su orden, por `cherry-pick` individual.
  Nunca se recuperan ficheros completos de un padre antiguo ni se resuelve con `--ours/--theirs`
  sobre ficheros completos.
- B23 tiene autoridad exclusivamente sobre el retry fotográfico.
- No se tocan datos fotográficos ni dataset. No se empieza B25/B7/B8/B9/B10. Astra no se usa.

## Fases / checkpoints

A preflight · B B6.7 test-closure · C B6.5-fix · D B23 · E P0-5c + AB-1 + AB-2 · F regresión
completa · G documentación final. Estado vivo: `docs/INTEGRATION_B24_B23_B65_B67_HANDOFF.md`.
