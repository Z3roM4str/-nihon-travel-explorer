# Certificación final de release — árbol `e124591`

**Veredicto técnico: RELEASE CANDIDATE CERTIFICADO** (alcance automatizable: Chromium 141 y WebKit 26.5 de Playwright). Las validaciones con hardware/persona (§14) siguen siendo independientes y no están cubiertas por este veredicto.
Misión de certificación: sin funcionalidades, sin cambios de producto, sin tocar dataset, fotografías, Astra ni Vercel (congelado).

## 1. Remoto y commit certificado
| | SHA |
|---|---|
| `main` inicial (verificado con `git fetch` al arrancar) | `a8350d4bebde74afbfa670ae2df97731fc3d255d` (#188, sólo `docs/CURRENT_WORK_HANDOFF.md`) |
| Último merge con código/tests antes de esta misión | `2075062` (#187): sigue siendo ancestro; los SHA de partida eran actuales |
| PR de esta misión | [#189](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/189), cabeza certificada `ed8c5891354c3623c1060b0c817599cc03f43fb0` |
| **Commit exacto certificado** (merge commit, sin squash/rebase/force-push; padres `a8350d4` + `ed8c589`) | **`e124591b19f9f241a38091598faf2c1d27b554e4`**, tree `896c2b50372d0eabc96f0b1ec4e79bb11ea20e43` (idéntico al de la cabeza) |
| `main` final | el commit documental posterior que contiene este informe (`git log -1 --format=%H -- docs/RELEASE_CERTIFICATION.md`); sólo `docs/` sobre `e124591` |

**Equivalencia de producto con #188:** `git rev-parse` de los trees `app/`, `data/` y `scripts/` (raíz del repo) es **idéntico** en `2075062` y `a8350d4` (`3ae9ae4c…`, `145aaa2f…`, `78a38b18…`); sólo `docs/` difiere. Entre `a8350d4` y `e124591` cambian 3 ficheros: `app/scripts/b21-global-search-browser-audit.mjs`, `app/src/components/DayOrderToolPanel.test.ts` (+1 prueba) y `docs/B21_ROOT_CAUSE.md`. `data/` y `app/public/` (fotografías) idénticos.

## 2. Reconciliación Vitest 3501 → 3421 (exacta)
Método: `vitest run --reporter=json` en un worktree de cada merge de la cadena `8aa7d1d..main` y diferencia por archivo y por título de prueba.

| Paso | Merge | Archivos | Pruebas | Δ | Origen |
|---|---|---|---|---|---|
| Antes del hardening | `8aa7d1d` | 116 | 3 501 | | |
| #183 B10-P1 | `a6520cc` | 117 | 3 505 | **+4** | archivo nuevo `data/photography-runtime-projection.test.ts` |
| #184 A11y | `696fc85` | 118 | 3 510 | **+5** | archivo nuevo `b10-structure.test.ts` |
| #185 D5-M1 (builder/compare) | `bda5927` | 117 | 3 479 | **−31** | ver abajo |
| #186 gates | `a4dd5bb` | 117 | 3 479 | 0 | sólo scripts de navegador |
| #187 panel heredado de intercambios | `2075062` | 117 | 3 421 | **−58** | ver abajo |
| #189 (esta misión) | `e124591` | 117 | **3 422** | **+1** | cobertura moderna de la herramienta viva |

**3 501 + 4 + 5 − 31 − 58 = 3 421** (+1 de #189 = 3 422). La diferencia −80 = **−31 (retirada de builder/compare) −58 (retirada del panel heredado) +9 (pruebas nuevas)**.

### 2.1 −31: retirada de las vistas `builder`/`compare` (#185)
| Archivo | Antes → después | Δ | Qué protegía | Cobertura vigente |
|---|---|---|---|---|
| `lib/hours-planning.test.ts` (**eliminado**, junto con `lib/hours-planning.ts`) | 19 → — | −19 | `buildRecordedHoursSummary`: un ítem por lugar, conteos por nivel, orden de entrada, error ruidoso por id duplicado, determinismo, 214 lugares → 214 ítems (80/50/19/65) | El módulo no tenía consumidor: su única superficie era `HoursPlanningSection` de la vista `builder`, inalcanzable (prueba de cierre de la máquina de estados en `D5_M1_UNREACHABLE_VIEWS_RETIREMENT.md`). La clasificación de horarios vive en `lib/recorded-hours.ts` (+ `recorded-hours.test.ts`, intactos) |
| `components/OrderedSequenceBuilder.test.ts` | 92 → 80 | −12 | bloque «recorded-hours signal wiring» (13 pruebas de escaneo de código de la sección retirada: copy SAFE/PARTIAL/OPAQUE, sin vocabulario abierto/cerrado, sin 2.º diálogo…) **−13**, +1 guarda de que la sección ya no existe | idem: sin superficie no hay invariante que cubrir; la guarda +1 impide que reaparezca |
| `d5-normative-vocabulary.test.ts` | 22 → 22 | 0 | 3 pruebas **reescritas** (ya no hay excepciones «inalcanzables»; R1 pasa a «el botón retirado no reapareció»; copy sin excepciones) | misma suite, más estricta |
| `OrderedSequenceBuilder.inter-hub.test.ts` | 9 → 9 | 0 | 1 prueba reescrita (2 copias de la subsección → 1) | misma suite |

### 2.2 −58: retirada de `LocalSwapAlternativesSection` y su cadena Apply (#187)
| Archivo | Antes → después | Δ | Qué protegía (en el panel heredado, no montado desde B29) |
|---|---|---|---|
| `OrderedSequenceBuilder.interior-transposition.test.ts` | 17 → 3 | −14 | 3E-G: copy natural, rangos registrados, brecha mínima, mezcla de confianza, aviso «solo local», sin «mejor/óptimo», Apply explícito y con guarda de obsolescencia |
| `OrderedSequenceBuilder.local-relocation.test.ts` | 19 → 5 | −14 (−17 +3) | 3E-E, idem para reubicación; no tocar inter-hub/alojamiento |
| `OrderedSequenceBuilder.local-swap.test.ts` | 16 → 5 | −11 (−13 +2) | 3E-C, idem para intercambio; no ordenar/recortar alternativas |
| `OrderedSequenceBuilder.four-place-interior-reversal.test.ts` | 10 → 1 | −9 | 3E-I, idem |
| `OrderedSequenceBuilder.two-pair-block-swap.test.ts` | 10 → 1 | −9 | 3E-K, idem |
| `lib/evidence-complete-four-place-interior-reversal.test.ts` | 119 → 118 | −1 | «el hook hace exactamente una escritura» (callback retirado) |
| `lib/evidence-complete-{interior-transposition,local-relocation,two-pair-block-swap}.test.ts` | sin cambio de recuento | 0 | 1 prueba cada una **reescrita** (el helper puro sigue sin secuencias multi-click) |

Suma: −14 −14 −11 −9 −9 −1 = **−58**. Las pruebas del dominio (mutación pura sobre el borrador v8 y cifras de las alternativas: 118/106/85/… casos) **se conservan**.

### 2.3 Dónde está ahora la cobertura equivalente y el hueco encontrado
Las invariantes del panel heredado (nombrar los lugares, rangos y mezcla de confianza, sin afirmaciones de optimización, Apply explícito y una sola vez, guarda de obsolescencia, no encadenar, no tocar alojamiento/inter-hub) viven hoy en la herramienta «Probar otro orden»:
* `evidence-options-check` (89/89 en Chromium y WebKit): mismas fixtures y cifras (G 1 h 8 min → 1 h, I 1 h 31 → 1 h 12, K 1 h 32 → 1 h 21), vocabulario prohibido sobre el texto **renderizado**, aplicar escribe el orden esperado una vez y sobrevive a recarga.
* `b29` (163), `DayOrderToolPanel.test.ts` (7 → **8**), `planning-draft-day-order.test.ts` (el borde de alojamiento y todo otro campo del borrador se preservan; baseline obsoleto rechazado), `d5-normative-vocabulary.test.ts`, `GATE_RETIREMENT_AUDIT.md` (equivalencia aserción por aserción).
* **Hueco detectado y cerrado:** el vocabulario de afirmaciones de optimización (`mejor|recomend|óptim|ahorr|garantizad|ranking|puntuaci|score`) y «nunca `.sort`/`.slice`/`.toSorted` sobre las alternativas» sólo tenían cobertura de navegador sobre la herramienta viva (Vitest los medía en el panel retirado). Se añadió **1 prueba moderna** en `DayOrderToolPanel.test.ts` sobre `DayOrderToolPanel.tsx`, `lib/day-order-tool.ts` y `SequenceCandidateSummary.tsx`. No se restauró ninguna prueba de código muerto.
* Decisión de diseño deliberada, no pérdida: la línea «ventaja mínima entre rangos» y el aviso «solo local» por alternativa ya no se escriben (B29: «no presenta A/B ni un score»); el gate comprueba la diferencia derivada de los dos rangos.

Observación histórica: el merge `a6520cc` (#183) tenía **1** prueba en rojo (la guarda de alcance D5 `git diff b854db3..HEAD` veía `data/photography-runtime-projection.ts` y `place-images.ts`); #184 la adaptó. Ningún merge posterior está en rojo y el árbol final está en verde.

## 3. B21 — causa raíz
Informe completo con evidencia: [B21_ROOT_CAUSE.md](B21_ROOT_CAUSE.md). **Defecto del gate (carrera con la animación de entrada `sheet-rise` + reintento de actionability de Playwright), no del producto.** `click()` sobre un elemento aún en movimiento sub-píxel → «element is not stable» → reintento con `scrollIntoView({block:"end"})` → `.sheet__body.scrollTop = 0`, que el producto restaura fielmente. Corregido en el gate (espera `Animation.finished` de las animaciones finitas + línea base = scroll en el instante de la selección + atribución explícita al driver). Sin cambios de producto.

| Repeticiones B21 | Gate original (`a8350d4`) | Gate corregido |
|---|---|---|
| headless shell, 60 pares alternados móvil | **14/60 fallos** (todos `360 -> 0`) | **0/60** |
| headless shell, 30 pares alternados escritorio | **6/30** | **0/30** |
| headless shell, paralelo (4 procesos) | 60/60 sin fallo (la carga impide la carrera) | 120/120 móvil + 60/60 escritorio |
| Chromium 141 completo | 112 ejecuciones, 0 fallos | 25/25 móvil + 25/25 escritorio (+ 2 en cada batería) |
| WebKit 26.5 | (el gate original no admitía WebKit) | 25/25 móvil + 25/25 escritorio (+ 2 en cada batería) |
| Controles de causalidad | espera pasiva 0/80 · `click()` 12/60 · `force` 0/60 · `mouse` 0/60 · `el.click()` 0/60 | |

## 4. Gates sobre el árbol final
Entorno: Playwright 1.62.1, **Chromium 141.0.7390.37 completo** (`/opt/pw-browsers/chromium`; ver §9). `npm run build` previo; servidor `vite preview` en 4181 para los gates que lo exigen.

### 4.1 Los cuatro gates que no habían corrido sobre el tree final (y todos los demás de `app/scripts`)
Se ejecutaron **los 64 gates de navegador vigentes** (+ `css-equivalence-check`, que es una captura) sobre la cabeza `ed8c589` (tree idéntico al de `e124591`), de uno en uno: **64/64 con código de salida 0**.
| Gate | Resultado |
|---|---|
| `phase4d-browser-audit` · `phase4j-browser-audit` · `phase4l-browser-audit` | PASS ×3 |
| `block22-b6-4-photography-browser-audit` | **492 / 0** |
| `phase4c` · `phase4f` · `phase4h` · `phase3f-f/h/j/s` | PASS |
| `block22-b6-2` 250 · `b6-3` 216 · `b6-5` 416 · `b6-6` 316 · `block23` 28 | 0 fallos |
| `block1` 153 · `block2` 81 · `block3` 99 · `block4` 258 · `block5` 231 · `block6` 177 · `block7` 129 · `block8` 114 · `block9` 153 · `block10` 81 · `block12` 78 · `block13` 150 · `block14` 229 | 0 fallos |
| `block19` contraste · discovery 30 · grid 52 · `block20` 73 · `dd028` 16 · `ddr03` 43 · `integration-b24-b23` (incluye phase5a 50/50) · `b24-ddr3` 9 · `b24-real-input` | PASS |
| `b17` regression 18 · responsive · tap-target 16 · `b18` a11y 25 · back 15 · chrome 6 · regression 40 · responsive · viaje-lugar 38 | PASS |
| `phase5a-rc` | 50/50 (255 peticiones externas registradas, no bloqueantes por diseño del gate) |

### 4.2 Batería proporcional sobre el commit integrado exacto `e124591` (Chromium)
tsc PASS · lint completo PASS (§5) · build PASS · **Vitest 117 archivos / 3 422** · B10 performance **13/13** · a11y **89/89** · motion **17/17** · microcopy **52/52** · D0b **56/56** · D5 **30/30** · evidence-options **89/89** · **B21 36/36 móvil y 36/36 escritorio** · B24-ddr3 9 · **B25 123/123** · **B26 314/314** · B27 A–K ×8 viewports · **B28 64/64** · **B29 163/163** · **B30 475/475** · **B31 281/281** · phase4d/4j/4l PASS · b6-4 492/0 · block12 78 · block23 28 · block14 229 · ddr03 43 · b18-regression 40.

## 5. Lint completo
`npx oxlint` (el `npm run lint` canónico; `.oxlintrc.json`: plugins react/typescript/oxc, 116 reglas) sobre **336 archivos** (`app/`: `src`, `scripts`, `server`): **0 errores, 1 aviso**.
* **Deuda heredada (1):** `src/components/PlaceMap.tsx:18` `react(only-export-components)` (`export const gradeColors`). Presente ya en `8aa7d1d`; no bloquea (es de recarga en caliente en desarrollo, sin efecto en producción).
* **Hallazgos nuevos:** 0. No se hizo limpieza. `tsc -b` (app + node + server): 0 errores. El único aviso de `vite build` (chunk > 500 kB) es heredado desde v1.1.0.

## 6. Rendimiento B10-P1 (cifras exactas)
Herramienta: `node scripts/b10-p1-baseline.mjs` (mediana de 7 cargas en frío tras calentamiento, 390×844 @2). Fuentes: [BEFORE](B10_P1_BASELINE_BEFORE.json) / [AFTER](B10_P1_BASELINE_AFTER.json) (cierre de la rama P1), y **medición nueva sobre el árbol final** en este entorno (`8aa7d1d` y `e124591` en la misma máquina, Chromium 141, mismo script).

| Métrica | `8aa7d1d` (antes) | cierre P1 (doc) | **árbol final `e124591`** | Δ final vs antes |
|---|---|---|---|---|
| Entry raw | 1 669 376 B | 1 470 575 B | **1 469 063 B** | −200 313 B (**−12,0 %**) |
| **Entry gzip** | **390 436 B** | 277 912 B | **277 614 B** | **−112 822 B (−28,9 %)** |
| Entry brotli | 327 101 B | 222 344 B | **222 257 B** | −104 844 B (−32,1 %) |
| CSS gzip | 21 012 B | 21 012 B | 21 096 B | +84 B (+0,4 %) |
| vs v1.1.0 (253 742 B gzip) | +53,9 % | +9,5 % | **+9,4 %** | |
| Techo `b10-performance-check` J01 | 392 000 B (antes) | 285 000 B | **285 000 B** (holgura 7 386 B, 2,6 %) | |
| LQIP base64 / URLs de adquisición en el entry | 244 / 244 | 0 / 0 | **0 / 0** | |
| Peticiones JS+CSS antes de FCP · imágenes antes de FCP · totales | 2 · 11 · 26 | 2 · 11 · 26 | **2 · 11 · 26** | sin cambio |
| FCP sin estrangular (mediana; rango) | 424 ms (368–496) *· aquí 324 ms (312–348)* | 436 ms (360–500) | **324 ms (316–340)** | ruido |
| FCP 4G rápida + CPU×4 | 2 004 ms *· aquí 1 648 ms* | 1 924 ms | **1 540 ms (1 500–1 672)** | −6,6 % *(medido aquí: 1 648 → 1 540)* |
| `domContentLoaded` 4G + CPU×4 | 893 ms *· aquí 814 ms* | 765 ms | **701 ms** | −13,9 % *(aquí)* |
| Descarga del entry (4G + CPU×4) | 63→474 ms *· aquí 62→469* | 60→376 ms | **59→368 ms** | −98 ms *(aquí)* |
| Chunks diferidos | tras FCP | tras FCP | **tras FCP**: 469→477 ms sin estrangular (FCP 324); 2 663→2 776 ms con 4G+CPU×4 (FCP 1 540) | idénticos en estructura; ya sin la ruta crítica |
| Chunk `OrderedSequenceBuilder` | 36 516 B + CSS 4 819 B | 36 516 B + 4 819 B | **33 235 B + 4 430 B** (retirada de builder/compare) | −3 281 B / −389 B |
| Chunk `ZoneComparison` | 6 184 B + 2 468 B | idem | 6 229 B + 2 468 B | +45 B |

Las cifras en cursiva son la medición de este entorno con el mismo script (los FCP absolutos dependen de la máquina; la comparación válida es antes/después en la misma). El entry «antes» se reprodujo **al byte** (390 436 B gzip, 1 669 376 B raw, 244 LQIP), lo que valida la cadena de medición. Por hub (Tokio/Kioto/Osaka/Okinawa, móvil y escritorio): 8 presupuestos en verde (J03/J04, 13/13).

## 7. WebKit (Playwright) — instalado y ejecutado
* **Instalable sin tocar producto:** `npx playwright install webkit` (descarga de `cdn.playwright.dev` a través del proxy; WebKit 26.5, build `webkit-2336`) + `npx playwright install-deps webkit` (apt). El primer intento sólo falló por bibliotecas del sistema ausentes (`libGLESv2.so.2`…), resuelto con `install-deps`. `webkit.launch()` → `WebKit 26.5` (UA «Version/26.5 Safari/605.1.15»).
* **Es WebKit automatizado en Linux, no Safari ni iPhone.**
* Matriz ejecutada (justificada: todos los gates que admiten `NIHON_BROWSER=webkit` + superficies afectadas por el hardening), **sobre `ed8c589`: 19 gates + captura css-equivalence, todos con salida 0**: B10 a11y 89/89 · motion 17/17 · microcopy 52/52 · performance 13/13 · D0b 56/56 · D5 30/30 · evidence-options 89/89 · **B21 36/36 móvil y escritorio** · B26 · B30 475/475 · B31 281/281 · block3 99 · block4 258 · block7 129 · block8 114 · block9 153 · block10 81 · block13 150.
* **Repetida sobre el commit exacto `e124591`:** B21 (m/d), a11y 89, motion 17, D0b 56, D5 30, evidence-options 89, B26, B30 475, B31 281 → todos PASS.
* Los gates B25, B27, B28 y B29 están escritos sólo para Chromium (lanzan `chromium` fijo); no se modificaron para esta misión.

## 8. Chromium
Chromium **141.0.7390.37 completo** para toda la batería; además `chromium_headless_shell` 141 como configuración de estrés para B21 (donde la carrera del gate se manifestaba).

## 9. Notas de entorno (fuera del repositorio)
Playwright 1.62.1 espera el *headless shell* revisión 1234, no instalado (sólo 1194). Los gates con `chromium.launch()` sin ruta fallaban con «Executable doesn't exist». Para ejecutar **todos** los gates sobre el mismo binario se creó, fuera del repo, un envoltorio en la ruta esperada (`/opt/pw-browsers/chromium_headless_shell-1234/…/chrome-headless-shell` → `exec /opt/pw-browsers/chromium-1194/chrome-linux/chrome "$@"`). El gate B21 y los que aceptan `NIHON_CHROMIUM_PATH` usan `/opt/pw-browsers/chromium` directamente.

## 10. Fallos heredados
Ninguno reprodujo en esta sesión: 0 gates en rojo sobre el árbol final (los antecedentes documentados —B25 `C-CLEAN` por TLS externo, B28 «J» de auto-scroll, phase5a, block2…— no aparecieron: B25 123/123, B28 64/64 a la primera, phase5a 50/50). Heredados no bloqueantes: aviso de lint `PlaceMap.tsx:18`; aviso de tamaño de chunk de `vite build`.

## 11. Fallos exclusivos de esta misión
**0.** El único cambio de código es una prueba añadida y un gate corregido; el producto (`app/src` salvo esa prueba) es byte a byte el de `a8350d4`.

## 12. Deuda realmente restante (no bloquea)
OD-01 modo oscuro (POST-V1/DIFERIDO) · D0b-01, D0b-02, EvidenceMark 11/12, deuda de media queries · APIs L3/L4 de `planning-draft` y modos modales no `embedded` de `ZoneComparison`/`OrderedSequenceBuilder` sin consumidor de UI · decisión de diseño sobre `zone-fact--strong` (B30) · primitivos `.tag/.alert/.badge/.person-token` en `App.css` · B25/B27–B29 sólo certificados en Chromium. **B21 deja de ser deuda.**
Observación sin evidencia de impacto (no es deuda): el producto guarda el scroll de la búsqueda a partir de eventos `scroll`, que se despachan por fotograma; una selección en el mismo fotograma que un scroll podría guardar un valor desfasado un fotograma. No se reprodujo ni se actúa.

## 13. Qué no se tocó
Dataset, fotografías, `data/`, `app/public/`, Astra, Vercel (congelado), `src/` de producto, `App.css`, nuevas funcionalidades/bloques/ciudades.

## 14. Validaciones que requieren hardware/persona
Safari y iPhone físicos (WebKit de Playwright ≠ Safari), VoiceOver/TalkBack reales, gestos táctiles y rendimiento en dispositivo, fotografías reales de zona, recursos externos/OSM en red real, y todo lo que dependa de Vercel (congelado).
