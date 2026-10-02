# Estado operativo B10 — continuación autónoma de #177, 2026-10-02

**INCOMPLETO; PR #177 Draft, sin fusionar.** Inicio `23e112f288600d115633963e2edf50676bdd4469`; código nuevo publicado `0518646c0c429ad405371bc40789e8059f880e78`. [Informe operativo y lotes](B10_CONTINUATION_REPORT.md), [evidencia nueva](B10_CONTINUATION_EVIDENCE.json), [propuestas E01–E04 completas](B10_EDITORIAL_PROPOSALS.md) y [matriz física](B10_PHYSICAL_QA_MATRIX.md). Las evidencias históricas mantienen sus SHAs y no certifican los nuevos commits.

G6 **FAIL**: entrada escrita 273259 → **271025 B gzip**, ahorro 2234; ceiling **253742**, exceso **17283**, sin ratchet/excepción ni métrica distinta. CSS: cuatro superficies/globales extraídas por lotes, **App.css 1259 → 457 líneas**; CSS compilado final idéntico al inicial, con limitaciones de PNG y subpíxel WebKit detalladas en el informe. Tokens/hex y responsive legacy pendientes, sin equivalencias inventadas. A-01 confirmado (64/70/28/150 pasos Tab), patrón/textos de salto condicionado a Producto. E01–E04 abiertas, ninguna propuesta aplicada; OD-01 **POST-V1/DIFERIDO**.

Datos canónicos, package/lock, fotografías públicas y persistencia V8 conservados; APIs y funciones verificadas. Build/lint y G1 **119 archivos/3429 PASS**; censo explica también la certificación anterior 116/3501 y replacements de main. Integridad histórica y comprobación adicional git-hash-object **2131/2131**. Regresión final por gate/motor y todos los intentos en el informe/manifiesto; no convertir muestras parciales en PASS global. Matriz física F01–F12 **NO EJECUTADO**: no aprobación de Safari/iPhone/lector/selector físico. OSM/TLS y fotografías/licencias de zonas son dos pendientes externos separados.

Main incorporado permanece `e124591b19f9f241a38091598faf2c1d27b554e4`. Main remoto observado `80464643528a458de05149b01a8b5c2e5b94a77f` (#190, sólo documentos inspeccionados, no incorporados). Respaldo remoto intacto `codex/b10-backup-pre-reconcile-20261001` → `40838062062c8820ea9f7b028675d8add0c96c32`. Publicación exclusivamente en esta rama con actualización no forzada y verificación concurrente previa. Sin merge, rebase, force-push, main/claude/*/#168, Astra, Vercel/deploy ni cambios al RC congelado.

Lo siguiente conserva snapshots anteriores y su autoridad/alcance histórico. El estado operativo es esta continuación; propuestas previas no son aprobación ni permiso para ampliar presupuestos.

---

# B10 — Pulido · handoff

**Rama** `claude/b10-pulido` · **base exacta** `2a10ad3f11cd91a7d739e85307f04da9411bf5d1` (main POST-MERGE certificado de #178: D0b + D5 sobre B27–B31, tree `9a5953a0bd1aaa6f2002b6b661e31aab233b3aad`).
**Estado: entregado SIN MERGE** (esta misión no lo fusiona). Misión, matrices y decisiones: [B10_POLISH_MISSION.md](B10_POLISH_MISSION.md). Evidencia de imágenes: [B10_PERFORMANCE_EVIDENCE.json](B10_PERFORMANCE_EVIDENCE.json).

## Qué contiene (commits por frente)

| Frente | Commits | Resultado |
|---|---|---|
| B10.1 movimiento | galería con reduced-motion · `press`/`mark` con valores de `03 §6` y sin transiciones de hover en tarjetas · gate `b10-motion-check` | 5 movimientos inventariados; 3 defectos corregidos; 6 movimientos no nombrados registrados como DDR B10-M1…M6 (no se inventa decisión estética) |
| B10.2 accesibilidad | 5 áreas táctiles a 44 px · gate `b10-a11y-check` (13 pantallas × 2 anchos, diálogos, foco, aria) | 0 hallazgos de nombres/ids/aria/foco oculto; hallazgos estructurales B10-A1…A4 registrados |
| B10.3 rendimiento | gate `b10-performance-check` + evidencia por ciudad | 4 ciudades ≤ 3,5 MB (Tokio y Kioto **en el tope**); 0 originales/duplicados/fallos; B10-P1: entrada +53,8 % gzip frente a v1.1.0 (datos, no código) |
| B10.4 `App.css` | 12 lotes + 3 herramientas (`css-inventory`, `css-migrate`, `css-equivalence-check`) | 7 052 → 1 287 líneas; 30 hojas junto a sus componentes; **0 diferencias de estilo computado/caja** en 125 estados × 5 anchos (Chromium: 235 851 elementos; WebKit 26.5: 235 791 elementos) |
| B10.5 microcopy | corazón «Quiero ir: {lugar}» · gate `b10-microcopy-check` | léxico prohibido visible = 0; B10-C1 (guardar/guardado) y B10-C2 (= D5-M1) como DDR |
| OD-01 | — | no implementado; **resuelto después como POST-V1 / DIFERIDO** (ver `design/09`) |

## Certificación (rama vs main certificado `2a10ad3`)

Entorno: Linux cloud, Playwright 1.62.1, Chromium 141.0.7390.37 y WebKit 26.5 (no es Safari físico). Misma máquina y herramientas que la certificación de #178.

| Comprobación | main `2a10ad3` | rama B10 |
|---|---|---|
| `tsc -b` / `npm run build` | PASS | PASS |
| oxlint | 0 errores, 1 aviso (`PlaceMap.tsx:17`) | igual |
| Vitest | 116 archivos / 3501 | 116 archivos / 3501 (+0; el test D5 de alcance se adaptó) |
| B27 · B28 · B29 | PASS · 64/64 · 163/163 | PASS · 64/64 · 163/163 |
| B30 Chromium / WebKit | 475/475 · 475/475 | 475/475 · 475/475 |
| B31 Chromium / WebKit | 281/281 · 281/281 | 281/281 · 281/281 |
| B26 Chromium / WebKit · B25 | 314/314 · 314/314 · 123/123 | 314/314 · 314/314 · 123/123 |
| D0b Chromium / WebKit (+ reduced-motion) | 56/56 | **56/56 · 56/56 (+56/56 reducido)** |
| D5 Chromium / WebKit (+ reduced-motion) | 30/30 | **30/30 · 30/30 (+30/30 reducido)** |
| block20 · block5 · ddr03 · DD-028 | 73/73 · 231/0 · 43/43 · 16/0 | idénticos |
| B18 a11y / chrome / responsive / viaje-lugar / browser-back | PASS | PASS (25/25 · 6/6 · sin overflow · PASS · exit 0) |
| B17 tap-target · responsive · block19 contraste · grid | PASS | PASS (16/16 · sin overflow · en contrato · 52/52) |
| block23 photo retry · B24-DDR3 home | 28/28 · 9/9 | 28/28 · 9/9 |
| **B10 motion** Chromium / WebKit (+ reduced-motion) | — | **16/16 · 16/16 (+16/16 · 16/16)** |
| **B10 a11y** Chromium / WebKit (+ reduced-motion) | — | **87/87 · 87/87 (+87/87 · 87/87)** |
| **B10 microcopy** Chromium / WebKit | — | **52/52 · 52/52** |
| **B10 performance** Chromium / WebKit | — | **12/12 · 12/12** |
| phase5a · integración B24+B23 | A14/C01/C06 · 56/58 | **idénticos** (HEREDADOS) |
| b18-regression · phase3f-h/j/s · block4 | falla / crashean / falla | **idénticos** (HEREDADOS: gates obsoletos tras B25) |

**Fallos exclusivos de B10: 0.** (Antecedentes intermitentes B26/B28 conocidos; no reaparecieron en la matriz de rama.) Ningún gate se debilitó ni se saltó; los gates
que cambiaron lo hicieron para seguir midiendo lo mismo tras mover reglas de CSS (D0b: lee todo el CSS y fija las 5 consultas `max-width` legacy; tests: `readProductCss`)
o por la decisión de copy del corazón (B26 + test de `PlaceCard`).

### Auditoría visual (main certificado vs B10; 320/390/430/840/1200 × 11 superficies × Chromium y WebKit = 110 pares)
0 overflow horizontal. 99/110 pares idénticos. Las 11 diferencias son: Viaje › Días a 390/430 (Chromium y WebKit: «Quitar fecha» y la hora de inicio pasan a 44 px de alto, el
contenido de debajo baja 10 px), la leyenda de interés/«Fuentes» a 44 px (Explorar › ciudad a 1200) y ruido de carga de imágenes/antialiasing en Explorar › Tokio / ficha
(≤ 93 px; la misma captura de main repetida difiere igual). Sin recortes ni solapamientos nuevos. Safari/iPhone físico: **no medido**.

## Pendiente / deuda

* **OD-01 (Producto)**: modo oscuro — **POST-V1 / DIFERIDO** (no es requisito de la versión actual).
* **DESIGN DECISION REQUIRED nuevas**: B10-M1…M6 (movimientos no nombrados: toast, onboarding, chevron de plegado, foco de tarjeta, fundido de imagen, altura de hoja nacional; y B10-M7 si Producto quiere `push`/`cross-fade`),
  B10-A1…A3 (landmark `main`, `h1` ausentes, «Viaje» duplicado), B10-A4 (controles de Leaflet < 44 px), B10-P1 (chunk de entrada: datos/LQIP; cómo medir G6), B10-C1 («guardar/guardado»), B10-C2 = D5-M1 (vistas muertas).
* Heredadas: D0b-01, D0b-02, EvidenceMark 11/12, deuda de media queries; Tokio y Kioto sin margen de bytes de imagen (B6).
* `App.css`: shell de `App.tsx` y primitivos `.tag/.alert/.badge/.person-token` siguen ahí; reglas enredadas (`whole-trip-composition*`, `NationalMap`, `national-start`, `nosotros-section*`, `sources__*`) no se movieron sin demostración de equivalencia.
* Físico: Safari/iPhone y lector de pantalla reales sin medir; fotografías reales de zona; recursos externos/OSM; gates obsoletos (phase3f-h/j/s, block4, b18-regression) y phase5a/integración con 3 fallos heredados idénticos en main.
