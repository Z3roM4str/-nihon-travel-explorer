# Reconciliación D0b + D5 sobre current main — handoff

Rama `claude/integration-d0b-d5-current-main`, creada desde `origin/main` exacto `b854db384c952e827b86d1bb35cac7caa70b035a`
(B27–B31 ya integrados por la línea canónica). **No se fusionó la cadena histórica `claude/*`**
(#174 → #173 → #170 → #168 → #166/#165 → #163): la rama `claude/d0b-design-system-hygiene`
(`d6338961b8f0b348d532b131eebfe0a037767118`, PR #174 OPEN) es **fuente de intención**, no vehículo de merge. Sin `git merge`
de esa rama, sin cherry-pick indiscriminado, sin force-push, sin squash/rebase.

Delta certificado usado como fuente semántica: `2f2e5e1677c0cb0a8b84536247fdd86f097277dc..d6338961b8f0b348d532b131eebfe0a037767118`
(37 ficheros, +1216/−89).

## 1. A1 — Matriz diferencial (A aplicable · B ya equivalente · C adaptación · D histórico, no se porta)

Las dos líneas divergieron: `main` carece de `DayOrderSheet.tsx`, `StopActionsSheet.tsx`, `viajeResumenModel.ts` y de los tests de
alcance `b27…b31-invariants-scope`; en su lugar implementa B27–B31 con `DayOrderToolPanel`, `SequenceCandidateSummary`,
`lib/day-order-tool.ts`, `trip-overview.css`, etc. Por eso no es aplicable un parche mecánico: todo se re-auditó contra lo que `main` renderiza.

### D0b

| Cambio en el delta | Clase | Tratamiento en main |
|---|---|---|
| `border: 2px solid #fff` → `var(--surface)` (`.place-marker__dot`, `.place-marker__saved`, `.zone-marker__pin`, `.zone-marker__saved`) | A | aplicado (valor idéntico `#ffffff`) |
| `color: #fff` → `var(--surface)` (`.selection-panel__count`, `.save-toast`, `.region-nav__item--active`) | A | aplicado |
| `.zone-marker__label` `rgba(255,255,255,.92)` → `var(--overlay-paper)` | D | la regla no existe en main (variante de la línea Claude de B30); no se porta |
| `color: #fff` en `.zone-marker__pin` y `.zone-card__index, .zone-column__index` | C | literales idénticos presentes sólo en main (B30); misma regla D0b → `var(--surface)` |
| `discovery.css`: `rgba(20,22,26,.55)` → `--overlay-ink`; `rgba(255,255,255,.92)` → `--overlay-paper` | A | aplicado |
| 4 reglas de input de Viaje → `font-size: var(--type-body-size)` (16 px) | A | aplicado (`.recorded-interval-fit__input`, `.accommodation-manager__input`, `.accommodation-boundary__input`, `.inter-hub-segments input`) |
| «todo control de Viaje ≥ 16 px» (invariante del gate D0b) | C | main tiene tres `select` nuevos de B27–B29 a 13,33 px (UA): `.trip-stop__move-panel select, .unassigned-drawer select`, `.day-card__actions select`, `.day-order-tool__move select`. Se aplica la misma norma con el mismo token; sólo cambia `font-size` (el alto lo fija `min-height: var(--tap-min)`) |
| Literales sin token equivalente exacto (D0b-01), `viewport-fit=cover` (D0b-02), media queries, EvidenceMark 11/12 | — | **no se tocan**; siguen como DESIGN DECISION REQUIRED (D0b-01, D0b-02, EvidenceMark) |
| Gate `d0b-design-system-hygiene-check.mjs` | C | portado y adaptado: CSS incluye `trip-overview.css`; techos medidos sobre main (hex ≤ 39 [37+2 de B30/B31], `@media max-width` = 11 [10+1 de B28–B31]); abre «Mover a…» y «Probar otro orden» para medir sus `select`; amplía A01 a las tres reglas nuevas |
| Docs `D0B_DESIGN_SYSTEM_HYGIENE_{HANDOFF,MISSION}.md`, parche a `CURRENT_WORK_HANDOFF` de la línea Claude | D | históricos de esa línea; este documento los sustituye. Intención conservada aquí |

### D5

| Cambio en el delta | Clase | Tratamiento en main |
|---|---|---|
| `TravellerManager.tsx`, `TripBackup.tsx` | A | aplicados idénticos |
| `lib/divergence-presentation.ts` (L3), `lib/interest-level.ts` (nivel sin clasificar), `lib/reservation-mechanism-{calendar,reference-date}-presentation.ts` (L1/L2) | A | aplicados idénticos + sus 4 tests |
| `OrderedSequenceBuilder.tsx` | C | main ya tenía «con el viaje» en la ruta de resumen (B31) → B; el resto sustituido: traslados entre ciudades, «k/n traslados registrados», «sin registrar», cierre de la superficie (`Cerrar ${headerTitle}`), «Vuelve a los días», R1 «Restablecer lugares y días» |
| `DayOrderSheet.tsx` (5 cadenas «tramo») | C | equivalente en main: `SequenceCandidateSummary.tsx` («traslados registrados», «Sin traslados en este día/viaje») y `lib/day-order-tool.ts` («Con los traslados desconocidos…») |
| `StopActionsSheet.tsx` («Quitar del día») | D | no existe en main; su acción es «Mover a Sin asignar» (sin «recorrido») |
| `viajeResumenModel.ts` | B | main ya muestra «con el viaje» / «del viaje» (B31) |
| `inter-hub.test.ts`, tests de `lib/` | A | aplicados |
| `b27…b31-*-invariants-scope.test.ts` (`D5_COPY`) | D | no existen en main (main no fija «lib intacto» por git diff) |
| Gates `b27`, `block4`, `block5`, `phase3f-h/j/s`, `phase5a` | A/C | copy nuevo; `b27`/`phase5a` también «Añadir traslado» y «Duración manual del traslado principal» (equivalentes de main) |
| `d5-normative-vocabulary{.test.ts,-check.mjs}` | C | re-escritos sobre la UI de main: panel «Mover a…», herramienta «Probar otro orden», más superficies (búsqueda, filtros, mapa, ficha/créditos, onboarding, estados vacíos) |
| E1 «Grado original» dentro de «Fuentes» plegado | — | conservado y verificado por gate y test |
| `grade`, `rank`, `level`, `glyph` del fallback | — | conservados (test) |

### Hallazgo específico de main: vistas «builder» y «compare» no alcanzables

`OrderedSequenceBuilder` arranca en `view = "days"` y nada cambia a `"builder"` ni `"compare"` (`setView("builder")` sólo vive en
`closeComparison`, que sólo es alcanzable desde `compare`, que sólo se abre desde `builder`). Esas dos vistas **no se renderizan en main**.
Su copy contiene vocabulario de Art. 7 que no se inventa:

> **DESIGN DECISION REQUIRED (D5-M1)** — «Construir recorrido», «Volver al recorrido», «Guardados fuera del recorrido», «Orden A / Orden B»
> (y frases asociadas) están en código no renderizado. Opciones: (a) eliminar las vistas muertas, (b) reescribir su copy según `03 §10`
> («Planear el viaje», «Este orden / otro orden»). No se decide aquí. Un test (`d5-normative-vocabulary.test.ts`) fija la lista exacta
> y comprueba que las vistas siguen sin ser alcanzables; cualquier término nuevo falla.

Para las cadenas de esas vistas con sustitución certificada e inequívoca (traslado, «sin registrar») se aplicó el mismo copy que en las vistas vivas.

## 2. Entorno de certificación

Cloud (Linux), Playwright 1.62.1. **Chromium 141.0.7390.37** (`/opt/pw-browsers/chromium-1194`) y **WebKit 26.5** (`webkit-2336`, descargado con
`npx playwright install webkit` + `playwright install-deps webkit`; no es Safari físico). Para los gates que lanzan Chromium sin ruta explícita se
creó un enlace en el entorno (`/opt/pw-browsers/chromium_headless_shell-1234/…/chrome-headless-shell` → `headless_shell` 1194) — sólo entorno; ni producto ni CI.
La comparación «base» se hizo con un `git worktree` de `origin/main` exacto (`b854db3`) con su propia build y su propio `vite preview`, no con la rama.

## 3. Gates — rama vs main inicial (`b854db3`)

| Gate | main inicial | rama (HEAD certificado) | Nota |
|---|---|---|---|
| `tsc -b` / `npm run build` | PASS (aviso de chunk heredado) | PASS | |
| `oxlint` | 0 errores, 1 aviso (`PlaceMap.tsx:17`) | 0 errores, 1 aviso (igual) | |
| Vitest completo | 115 archivos / 3479 | **116 archivos / 3501** (+22 del test D5) | |
| D0b Chromium / WebKit | (no existe) | **56/56 / 56/56** | |
| D0b reduced-motion Chromium / WebKit | — | **56/56 / 56/56** | |
| D5 Chromium / WebKit | (no existe) | **30/30 / 30/30** | |
| D5 reduced-motion Chromium / WebKit | — | **30/30 / 30/30** | |
| B27 | PASS | PASS | A–K, 8 viewports |
| B28 | 64/64 | 64/64 | |
| B29 | 163/163 | 163/163 | |
| B30 Chromium / WebKit (+reduced-motion) | 475/475 · 475/475 | 475/475 · 475/475 (+ reduced-motion igual) | |
| B31 Chromium / WebKit (+reduced-motion) | 281/281 · 281/281 | 281/281 · 281/281 (+ reduced-motion igual) | |
| block20 | 73/73 | 73/73 | |
| block5 | 231/231 | 231/231 | |
| B26 Chromium / WebKit | 314/314 · 314/314 | 314/314 · 314/314 | |
| B25 | 123/123 | 123/123 | |
| B18 back | exit 0 | exit 0 | |
| ddr03 / DD-028 | 43/43 · 16/16 | 43/43 · 16/16 | |
| phase5a | **FALLA** A14, C01, C06 (47/50) | **FALLA igual** (mismas tres) | **HEREDADO**: idéntico en main inicial en este entorno |
| integración B24+B23 | **56/58** (los dos de phase5a) | 56/58 (mismos) | **HEREDADO** |
| phase3f-h / j / s | **crashean** (`strict mode violation` por «Quiero ir», gate obsoleto tras B25) | idéntico | **HEREDADO**: gates obsoletos (deuda B10 documentada en el handoff de B26) |
| block4 | **falla** (no encuentra «Kioto», timeout) | idéntico | **HEREDADO** (también en la línea Claude) |

**Fallos exclusivos de la reconciliación: 0.** Ningún gate se debilitó, saltó ni se convirtió en xfail. Los textos fijados por phase3f-h/j/s, block4,
block5, b27 y phase5a se actualizaron al copy nuevo (como D5); b27 y block5 (que sí ejecutan) siguen verdes.

Los gates D0b y D5 se probaron también **contra main inicial** y fallan (discriminan): D5 detecta «Tramo principal…», «tramo de fechas»,
«día del recorrido»…; D0b detecta `#fff`, los inputs a 13,6 px y los seis `select` a 13,33 px.

## 4. Auditoría visual (main inicial vs rama)

`app/scripts/visual-capture.mjs` + `visual-compare.py` (pixel a pixel, `reducedMotion`, recursos externos bloqueados). 11 superficies × 5 anchos
(320×568, 390×844, 430×932, 840×1180, 1200×900) × Chromium y WebKit = 110 pares: Explorar, Explorar › Tokio, ficha, Quiero ir, Nosotros, Viaje ›
Días, Días + «Mover a…», Días + «Probar otro orden», Dónde dormir, Reservas, Resumen.

* **0 overflow horizontal** en las 110 capturas.
* **Idénticas (0 px): 69/110**, incluidas Dónde dormir, Reservas y Resumen en los cinco anchos y ambos motores.
* **Diferencias (41)**, todas atribuidas a los cambios definidos por D0b/D5:
  * *Nosotros* (frase de viajeros «Los lugares planificados…», una línea más a 430) y *Quiero ir* («…día del viaje…»): sólo texto.
  * *Viaje › Días* / «Mover a…» / «Probar otro orden»: texto de los `select` a 16 px; ancho y alto de cada control idénticos (alto fijado por `--tap-min`).
  * Explorar › Tokio / ficha / Explorar (≤ 150 px): ruido de carga de imágenes y antialiasing — **la misma captura de main inicial repetida dos veces ya difiere 85–149 px en esas mismas pantallas**; el caso mayor (WebKit 840, 80 k px) es una foto de tarjeta que llegó tarde en una de las dos ejecuciones.
* Sin recortes, sin solapamientos nuevos, sin cambio de altura de los botones.
* Safari/iPhone físico **no medido**.

## 5. Estado de las decisiones abiertas heredadas (no se cierran aquí)

D0b-01 (literales sin token exacto) · D0b-02 (`viewport-fit=cover`/laterales) · EvidenceMark 11/12 · deuda de media queries · **D5-M1** (vistas muertas del constructor).
`data/` y datasets intactos, sin Astra, sin Vercel, sin fotografías nuevas.
