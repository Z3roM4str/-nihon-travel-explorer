# D0b — Handoff · higiene del sistema de diseño

Base `2f2e5e1677c0cb0a8b84536247fdd86f097277dc` · rama `claude/d0b-design-system-hygiene` · línea Claude · PR Draft, sin merge.
Sólo CSS + gate + docs. `lib/`, `data/`, V8, hooks, componentes y `index.html`: sin cambios.

## Literales (migrados)

| archivo | selector | literal | token elegido | justificación |
|---|---|---|---|---|
| App.css | `.place-marker__dot`, `.place-marker__saved`, `.zone-marker__pin`, `.zone-marker__saved` | `border: 2px solid #fff` | `var(--surface)` | valor idéntico (#ffffff); discovery.css ya usa `--surface` para blanco |
| App.css | `.selection-panel__count`, `.save-toast`, `.region-nav__item--active` | `color: #fff` | `var(--surface)` | idéntico |
| App.css | `.zone-marker__label` | `rgba(255,255,255,.92)` | `var(--overlay-paper)` | valor idéntico; superficie de papel translúcida sobre mapa |
| discovery.css | `.place-card__photo-count` | `rgba(20,22,26,.55)` | `var(--overlay-ink)` | idéntico; es la píldora de 04 §6 |
| discovery.css | (botón circular de galería, línea 679) | `rgba(255,255,255,.92)` | `var(--overlay-paper)` | idéntico; es el botón de 04 §5.4 |

## Literales no migrados

Sin token equivalente exacto; no se aproximan (cambiarían contraste/matiz). Todos: **DESIGN DECISION REQUIRED — literal sin token equivalente = sí**.

| archivo | selector (líneas aprox.) | literal | razón / candidatos considerados |
|---|---|---|---|
| App.css | marcadores/sombras 1115–1121, 2774, 2806 | `rgba(0,0,0,.35–.45)`, `rgba(183,40,46,.28)` | sombras sin token; `--elev-1/2` son otra geometría |
| App.css | chips de interés 1338–1360, 1410–1414, 2873–2886 | `#f3edfa #d9c9ee #5c3d86 #eccf9c #b3ddc5 #eaf2f8 #c7dcec #145c39 #d9eee2 #b9ddc8 #14603b #e9f0f7 #c3d6e6 #1f4d70 #e7c894 #7c4a0d` | candidatos `--ok-*`, `--warn-*`, `--info-*`: matiz/contraste distintos (p. ej. `#e9f0f7` vs `--info-050 #e9eff5`) |
| App.css | avisos ámbar/riesgo 4541–4929 | `#6c4310 #eccf9c #eeb4ae #7d211a #eec7c5` | `--warn-600 #8a5a10`, `--risk-600 #a3301f`: más claros, cambia contraste |
| App.css | fondos neutros/oscuros 2050–2103, 3246–3259, 3366, 3637–3646, 4002, 5743 | `#efe9e0 #ded5c8 #4a453d #241f1a #ff9e9e #eef2f5 #dde7ee #e7eef5 rgba(20,16,12,.92) rgba(30,24,18,.55) rgba(31,30,28,.45) rgba(255,255,255,.75/.9)` | `--surface-sunken`, `--surface-ink`, `--overlay-*`: valores distintos |
| discovery.css | 539–541, 1262–1264 | `rgba(20,22,26,.78/0)` | extremos de degradado propios; `--scrim-bottom` es otro degradado |
| discovery.css | 582, 1279, 1288 | `rgba(255,255,255,.82/.85)` | texto sobre foto; `--overlay-paper` es .92 |
| discovery.css | 819, 897 | `rgba(0,0,0,0)` | transparente del patrón; `--pattern-diagonal` ya es el color visible |

Quedan 37 líneas de declaración con hex (el gate fija el techo en 37).

## Inputs

| control | tamaño antes | token después | tamaño computado móvil |
|---|---|---|---|
| `.recorded-interval-fit__input` | 0.85rem (13,6px) | `--type-body-size` | 16px |
| `.accommodation-manager__input` | 0.85rem (13,6px) | `--type-body-size` | 16px |
| `.accommodation-boundary__input` (y su `select`) | 0.85rem (13,6px) | `--type-body-size` | 16px |
| `.inter-hub-segments input` (y sus `select`) | 0.82rem (13,12px) | `--type-body-size` | 16px |

Medido en Días a 320/360/390/430: todos los controles ≥ 16px; sin overflow nuevo. Precedente: `.traveller-manager__input`.

## Media queries

| query anterior | clasificación | sustitución | resultado |
|---|---|---|---|
| `min-width:861px` / `min-width:620 and max-width:860` (zone-panel, ZoneComparison) | C | ninguna | 861 vs 840 cambiaría 841–860; ZoneComparison fuera de alcance |
| `max-width:860` ×2 (lista/diálogo de análisis), `min 620 max 860` (lista) | C (B parcial: App.css documenta que se conservan hasta que otro bloque las toque) | ninguna | conservadas |
| `max-width:380` ×2 | C | ninguna | conservadas |
| `max-width:400` (`.dias`) | C | ninguna; Días fuera de alcance | conservada |
| `min-width:620` (`.zone-choice-action__button`) | C | ninguna; 620 no es breakpoint vigente | conservada |
| `min-width:600` (traveller-manager, discovery) | ya conforme (sm) | — | sin cambio |
| `@container (min-width:520px)` (ordinal de timeline) | B legítima | — | sin cambio |

Migradas: 0. El gate fija 10 `@media … max-width` (deuda registrada) y prohíbe nuevos (Art. 8).

## EvidenceMark

| norma | implementación | pruebas | decisión |
|---|---|---|---|
| 03 §1.4 y 04 §2: glifo 11px; 04 §2: etiqueta en `--type-caption` | `.evidence-mark` (discovery.css) usa `--type-caption-size` = 12px para glifo y etiqueta (un solo elemento) | ningún test ni gate fija el tamaño | **C — DESIGN DECISION REQUIRED**: no existe token de 11px y bajar el elemento entero a 11px contradice la etiqueta de 12px. No se cambia. |

## Safe-area

| elemento | uso env() | resultado |
|---|---|---|
| `.tab-bar` | `safe-area-inset-bottom` (alto + padding) | correcto, requiere viewport-fit para tener efecto |
| `.zone-panel__foot` | bottom | idem |
| `.save-toast-region` | bottom | idem |
| `.persistence-notice` | bottom | idem |
| `.quiero-ir__cta` | bottom | idem |
| `.filter-panel__foot` (discovery) | bottom | idem |
| `.app__detail`, `.lightbox`, paneles, NavRail `md+` | ninguno (top/left/right) | **DESIGN DECISION REQUIRED D0b-02** |

**viewport-fit=cover: NO aplicado.** Con `cover`, en iPhone apaisado los insets laterales pasan a ser reales y los ~18 elementos fijos/sticky y el NavRail (≥840px) quedarían bajo el notch; arreglarlo exige reglas laterales/superiores sin respaldo en tokens/contrato (03 sólo cubre el inferior). `index.html` sin cambios; el gate lo fija. iPhone Safari físico: **NO medido** (Playwright no equivale a Safari).

## Heredado

- A 320px el panel de «Dónde dormir» desborda 1–2px; idéntico en la base. Registrado como excepción en el gate; no corregido.
- oxlint: 1 warning heredado (`PlaceMap.tsx`, only-export-components).

## Resultados

- `tsc -b` limpio · `oxlint` 0 errores (1 warning heredado) · Vitest 3533/3533 (119 archivos).
- Gate D0b (Chromium): 56/56, también con `prefers-reduced-motion: reduce` (D0b no añade animación).
- Regresión en Chromium sobre la build de la rama: B27 48/48 · B28 43/43 · B29 36/36 · B30 48/48 · B31 26/26 (también en reduced-motion) ·
  block20 73/73 · phase5a 50/50 · b17 responsive y tap-target 26/26 · b18 responsive, chrome 6/6, a11y 25/25 · block19 grid 52/52 y contraste.
- Fallos exclusivos de D0b: ninguno. Heredado: el desborde de 1–2px a 320px en «Dónde dormir» (idéntico en la base).
- Invariantes B27–B31: sin cambios en `lib/`, hooks, V8 o clave; los gates de escrituras de B27–B31 pasan.

## Certificación independiente (auditoría final sobre `b63a8df`)

**WebKit** (Playwright 26.5, `webkit-2336`, Linux; NO es Safari físico): gate D0b 56/56 · con `prefers-reduced-motion: reduce` 56/56 · B30 48/48 · B31 26/26 (también reduced-motion).
Chromium 141: gate D0b 56/56 y 56/56 en reduced-motion · B31 26/26 y 26/26 reduced-motion.
B27 (48), B28 (43) y B29 (36) no tienen modo WebKit en su script (sólo Chromium; verdes). block20 73/73 y phase5a 50/50 (Chromium; sus scripts sólo lanzan Chromium).
`tsc -b` limpio · oxlint 0 errores (1 warning heredado) · Vitest 3533/3533.

**Auditoría visual BASE `2f2e5e1` vs D0b `b63a8df`** (screenshots reales, mismo estado/scroll/escala/fuentes, `reducedMotion`, 8 superficies × 5 anchos 320/390/430/840/1200, en Chromium y WebKit = 80 pares; comparación píxel a píxel + inspección ocular):

| superficie | anchos | diferencia base→D0b | esperada | veredicto |
|---|---|---|---|---|
| Explorar | 320–1200 | 0 px | — | SIN DIFERENCIA |
| Quiero ir | 320–1200 | 0 px | — | SIN DIFERENCIA |
| Viaje › Días | 320–1200 | sólo en los controles de texto/select (rangos de filas de formularios) | sí | ESPERADA — input ≥16px |
| Viaje › Dónde dormir | 320–1200 | 0 px (overflow 1–2px a 320 heredado, presente igual en la base) | — | SIN DIFERENCIA / DEUDA HEREDADA |
| Viaje › Reservas | 320–1200 | 0 px | — | SIN DIFERENCIA |
| Viaje › Resumen | 320–1200 | 0 px | — | SIN DIFERENCIA |
| Nosotros | 320–1200 | 0 px | — | SIN DIFERENCIA |
| PlaceDetail | 320–1200 | 0 px | — | SIN DIFERENCIA |

- Inputs ≥16px: medidos en ambos builds, 13,6/13,12px → 16px; anchura y altura de cada control idénticas (la altura la fija `min-height`), sin recorte horizontal (`scrollWidth ≤ clientWidth`), sin overflow de página, sin pisar botones, utilizables a 320px. Único efecto visible: el texto del `select` «Posición en el plan» (Traslados entre ciudades) se trunca con elipsis antes a 320px («…puntos cons…» vs «…consecutiv…» en la base; la base ya truncaba). Es consecuencia esperada del 16px y no es desborde.
- 10 literales → tokens: diff de `src/` = exactamente las 14 líneas previstas; valores resueltos idénticos (`--surface #ffffff`, `--overlay-paper rgba(255,255,255,.92)`, `--overlay-ink rgba(20,22,26,.55)`); 0 px de diferencia en las superficies capturadas → sin diferencia perceptible. (Marcadores de mapa, toast y píldoras no aparecen en todas las capturas; la equivalencia se sostiene por valor idéntico.)
- Safe-area, media queries y EvidenceMark: sin cambios (`index.html` intacto; 0 media queries tocadas; EvidenceMark 0 px de diferencia).
- Fallos exclusivos de D0b: ninguno. Heredado: overflow 1–2px a 320 en «Dónde dormir»; warning oxlint de `PlaceMap.tsx`.
- D0b-01, D0b-02 y EvidenceMark 11/12 siguen abiertos y NO bloquean la certificación.

## Límites

- **iPhone Safari físico: NO medido.** WebKit Playwright en Linux no equivale a Safari físico; no bloquea porque `viewport-fit=cover` no se aplicó.

## Pendientes de decisión (para el siguiente bloque)

D0b-01 literales sin token · D0b-02 `viewport-fit=cover` + reglas laterales/superiores · D0b-03 EvidenceMark 11px (falta token) · deuda de media queries C.

## Integración de D5 (D0b + D5)

- PR #176 (D5, `claude/d5-normative-vocabulary`, HEAD certificado `c0fa5624727ab22e3c671facdde953b49328a22e`) integrado en esta rama mediante **merge commit normal** (sin squash/rebase/force-push): `b7253d0`.
  Primer padre `4d2163165f791b2ba3b1db8c7cbb968e1c607314` (D0b certificado), segundo padre `c0fa562…`. Tree del merge `b398407ded00f8f8a3cb60042ccc0d9f1fba6e10` = tree certificado de D5 (D0b es ancestro de D5, el árbol resultante es exactamente el de D5).
- Esta rama (PR #174) contiene ahora **D0b + D5 certificados**. Sin cambios adicionales a lo certificado en cada uno (`data/`, hooks, V8, storage, CSS y `App.tsx` intactos respecto a D0b; el único cambio de `lib/` es el copy autorizado de D5).
- Recertificación sobre el merge: `tsc -b` 0 errores; oxlint 0 errores (1 aviso previo en `PlaceMap.tsx`); Vitest 120 ficheros · 3555 tests OK; gates D0b 56/56 y D5 26/26 en Chromium y **WebKit 26.5** (normal y reduced-motion); B30 48/48 y B31 26/26 en WebKit (normal y reduced-motion); B27 48/48, B28 43/43, B29 36/36, B30, B31, block20 73/73, phase5a 50/50, block5 231/0, phase3f-h/j/s sin fallos en Chromium. **block4**: falla igual en `4d21631` y en `2f2e5e1` (timeout esperando «Kioto») → heredado. Fallos exclusivos del merge / de D0b+D5: **ninguno**. Ningún gate debilitado.
- Auditoría visual: no se repiten capturas; el árbol es idéntico al de D5, ya auditado (BASE vs D5 y BASE vs D0b, 320–1200, Chromium y WebKit), y los gates D0b/D5/B27–B31 cubren las superficies afectadas. Safari físico en iPhone no medido.
- Los 5 DDR de D5 siguen cerrados (intervalo de fechas, día del viaje, «Restablecer lugares y días», «Nivel sin clasificar (X)»); E1 («Grado original» en «Fuentes») sigue como excepción documentada.
