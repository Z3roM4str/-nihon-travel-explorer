# Certificación post-merge — D0b + D5 sobre main

## Integración (PR [#178](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/178))

| Dato | Valor |
|---|---|
| main pre-merge (primer padre) | `b854db384c952e827b86d1bb35cac7caa70b035a` |
| head certificado (segundo padre) | `094498a1a4eb1a40eb81d4379f7d70ba68bbcb47` (`claude/integration-d0b-d5-current-main`) |
| merge commit | `2a10ad3f11cd91a7d739e85307f04da9411bf5d1` (merge commit normal; sin squash/rebase/force-push) |
| tree del head certificado | `9a5953a0bd1aaa6f2002b6b661e31aab233b3aad` |
| tree del merge | `9a5953a0bd1aaa6f2002b6b661e31aab233b3aad` (**idéntico**) |
| estado previo al merge | OPEN, Ready for Review, MERGEABLE/clean; `origin/main` sin cambios desde la base |
| merged_at | 2026-10-01T07:02:34Z |

Padres y tree verificados con `git rev-parse` sobre `origin/main` tras el merge.

## Matriz sobre el merge exacto (worktree limpio de `2a10ad3`, Chromium 141 / WebKit 26.5)

| Comprobación | Resultado |
|---|---|
| build / `tsc -b` | PASS |
| oxlint | 0 errores, 1 aviso heredado (`PlaceMap.tsx:17`) |
| Vitest | 116 archivos / 3501 PASS |
| D0b Chromium / WebKit | 56/56 · 56/56; reduced-motion 56/56 · 56/56 |
| D5 Chromium / WebKit | 30/30 · 30/30; reduced-motion 30/30 · 30/30 |
| B27 / B28 / B29 | PASS · 64/64 · 163/163 |
| B30 Chromium / WebKit | 475/475 · 475/475 |
| B31 Chromium / WebKit | 281/281 · 281/281 |
| block20 / block5 / B25 / B18 back / ddr03 / DD-028 | 73/73 · 231/0 · 123/123 · exit 0 · 43/43 · 16/0 |
| B26 Chromium / WebKit | 314/314 · 314/314 (ver nota) |
| phase5a / integración B24+B23 | A14, C01, C06 / 56/58 — **HEREDADOS**, idénticos en main `b854db3` |

**Nota de intermitencias.** En la primera pasada fallaron B29 (por su B28 anidado: «J: auto-scroll continued after cancellation») y B26 WebKit
(I-RESET-CANCEL, 313/314). Ambos son los antecedentes intermitentes ya documentados en B26/B28/B31; con el mismo tree pasaron en la rama (B29 163/163,
B26 314/314 ×2) y en dos repeticiones completas sobre el merge (B29 163/163 ×2, B28 64/64, B26 314/314 Chromium y WebKit ×2). No se modificó producto ni gate.

**Fallos exclusivos del merge: 0.** Heredados: phase5a, integración B24+B23 (consecuencia de phase5a), phase3f-h/j/s (gates obsoletos), block4.
Como el tree del merge es idéntico al certificado en la rama, la certificación de la rama (docs/D0B_D5_MAIN_RECONCILIATION_HANDOFF.md) aplica byte a byte.
