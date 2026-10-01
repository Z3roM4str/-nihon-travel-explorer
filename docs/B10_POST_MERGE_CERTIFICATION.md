# Certificación post-merge — B10 «Pulido» sobre main

## Integración (PR [#179](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/179))

| Dato | Valor |
|---|---|
| main pre-merge (primer padre) | `2a10ad3f11cd91a7d739e85307f04da9411bf5d1` |
| head certificado (segundo padre) | `538d2ebf4134d372b4cbb060bf1e854cce59b980` (`claude/b10-pulido`, 25 commits) |
| merge commit | `c512db15a1d253a1c6704ad0798f80dea142e173` (merge commit normal; sin squash/rebase/force-push) |
| tree del head certificado | `c781f598996664ab98c58560f09899509b7cb0a3` |
| tree del merge | `c781f598996664ab98c58560f09899509b7cb0a3` (**idéntico**) |
| estado previo | OPEN, Ready for Review, mergeable/clean; `origin/main` y HEAD de #179 sin cambios desde la certificación |

Después se integró (#180, `8414a71`) la certificación documental de D0b+D5, que sólo añade un documento.

## Matriz sobre el commit exacto `c512db1` (Chromium 141; clon limpio, `npm ci`, build de producción)

| Comprobación | Resultado |
|---|---|
| `tsc -b` / build | PASS |
| oxlint | 0 errores, 2 avisos (`PlaceMap.tsx:18`, `css-equivalence-check.mjs` import no usado) — ya presentes en la rama certificada |
| Vitest | 116 archivos / 3501 PASS |
| B10 motion · a11y · microcopy · performance | 16/16 · 87/87 · 52/52 · 12/12 |
| D0b · D5 | 56/56 · 30/30 |
| B25 · B26 · B27 · B28 · B29 | 123/123 · 314/314 · PASS (A–K) · 64/64 · 163/163 |
| B30 · B31 | 475/475 · 281/281 |
| block20 · block5 · ddr03 · DD-028 | 73/73 · 231/0 · 43/43 · 16/0 |
| B18 a11y / chrome / responsive / viaje-lugar / browser-back | 25/25 · 6/6 · sin overflow · PASS · exit 0 |
| B17 tap-target / responsive · block19 contraste / grid | 16/16 · sin overflow · en contrato · 52/52 |
| block23 photo retry · B24-DDR3 home | 28/28 · 9/9 |

Todo a la primera: **no reaparecieron** los antecedentes intermitentes B26/B28/B29.

### Heredados (idénticos a main `2a10ad3`; no causados por B10)
| Gate | Resultado en el merge | Causa |
|---|---|---|
| phase5a | 47/50 (A14, C01, C06) | gate previo a B25–B31 |
| integración B24+B23 | 56/58 | consecuencia de phase5a |
| phase3f-h / j / s | crashean | `getByRole('button',{name:/Quiero ir/})` resuelve 157 elementos (el corazón se llama «Quiero ir: {lugar}») |
| block4 · b18-regression | falla | gates obsoletos tras B25 |

**Fallos exclusivos del merge: 0.**

## Límites de esta certificación
* **WebKit no se ejecutó**: el entorno de esta sesión sólo dispone de Chromium (`webkit-2336` no instalado). Como el tree del merge es byte a byte el de la rama certificada en Chromium 141 **y** WebKit 26.5 (`B10_POLISH_HANDOFF.md`), la certificación WebKit de la rama aplica; no se ha repetido sobre el merge.
* Safari/iPhone físico y lector de pantalla físico: no medidos.
* Los gates se ejecutaron contra `vite preview` (build de producción); ningún despliegue.
