# B10 — integración del lote deferred-images sobre main actual: ventana de medida de G6

**Compatibilidad de integración con main moderno; NO es un defecto del lote original de #177.** #177 (`02b01cdf…`) sigue como referencia histórica certificada, Draft y sin merge.

## Qué se encontró

Al integrar los cinco commits del lote sobre `main` (`de4b190b033a4d8c169d75a609e3d7d50527e674`), G6 (`b10-performance-check.mjs`) daba **13/13 en Chromium 151.0.7922.34 y 10/13 en WebKit 26.5** (Osaka móvil 3 522 050 B, Osaka escritorio 4 072 942 B, Okinawa escritorio 3 582 788 B).

* El **main puro** (sin el lote) reproduce exactamente los mismos bytes en WebKit.
* El lote original certificado en su línea daba 13/13: correcto en su contexto.
* Causa demostrada (no es lifecycle ni `IntersectionObserver`): `locator.click()` de Playwright hace un auto-scroll hasta el botón de ciudad **antes** de despachar el evento `click`. En la portada actual de main, ese scroll activa fotos de la portada. El gate vaciaba `responses` justo antes de `locator.click()`, de modo que las peticiones iniciadas durante ese scroll previo se atribuían al presupuesto del hub (≈ 757 KB en Osaka escritorio, WebKit).
* Medición con el evento real: en WebKit, 10 peticiones de imágenes de portada **antes** del clic y **0** de portada después; con un clic DOM directo sin scroll previo, 0 activaciones de portada tras el clic. Observadores huérfanos = 0.

## Contrato de G6 (corregido)

G6 mide **bytes de imagen desde el clic real en la ciudad hasta el final del recorrido del hub**:

1. petición iniciada antes del evento `click` real → tráfico de portada/pre-clic (`pre`);
2. petición iniciada desde el evento `click` real → tráfico del hub (`hub`), siempre íntegra;
3. una petición iniciada antes del clic y terminada después **no** se atribuye al hub;
4. ninguna espera arbitraria oculta tráfico.

## Implementación (sólo `app/scripts/b10-performance-check.mjs`)

* La frontera es un listener `click` en captura (inyectado con `addInitScript`) que registra `performance.now()` en el primer clic sobre un botón de ciudad.
* El instante de inicio de cada petición de imagen sale de Resource Timing (`startTime`), en la misma línea de tiempo; `responses` ya no se vacía y cada respuesta se clasifica `pre`/`hub`. Una respuesta sin entrada de Resource Timing falla el gate (no se atribuye en silencio).
* El scroll hasta el botón se hace explícitamente antes de abrir la ventana (`scrollIntoViewIfNeeded`), seguido de dos fotogramas y de «sin imágenes en vuelo» + `networkidle` (condición de estado de red, no un retardo).
* Presupuesto `HUB_BUDGET_BYTES = 3 500 000` intacto; ninguna respuesta del hub se excluye.
* Control nuevo **K**: hay tarjetas de la portada sin activar; el scroll previo al clic activa algunas y quedan como `pre`; tras el clic real, lo iniciado después queda en `hub`; una petición artificial posterior al clic suma íntegra a `hubBytes`.
* Control del propio gate `NIHON_B10_PERF_MUTANT=window-at-click-call`: reintroduce la ventana anterior. Resultado: reproduce los tres fallos de WebKit (3 522 050 / 4 072 942 / 3 582 788 B) y **K falla en Chromium y WebKit**; con la instrumentación nueva K pasa.

Sin cambios de producto (`app/src/` intacto respecto de los commits del lote y de main).

## Recertificación comparativa (Chromium 151.0.7922.34 y WebKit 26.5)

Los bytes pre-clic **no desaparecen**: se atribuyen a su fase. Los valores de cada ejecución están en [B10_G6_WINDOW_EVIDENCE.json](B10_G6_WINDOW_EVIDENCE.json). Nota: en Chromium escritorio, Tokio/Kioto varían entre ejecuciones (p. ej. 45/48 y 41/44 imágenes en el hub) con y sin lote; todas bajo 3 500 000 B.

### A) main puro `de4b190…` con el gate corregido

* Chromium: 12/14 — falla Tokio móvil por «1 imagen a más de 3 pantallas descargada al abrir» (carga no diferida; el lote lo resuelve) y K («no había tarjetas de la portada sin activar»: sin el lote todas tienen `src`, K es específico del lote).
* WebKit: 13/14 — sólo K, por la misma razón. **Los 13 controles de presupuesto pasan** con la ventana corregida.

#### A · Chromium
| Viewport · hub | pre-clic (portada) img | pre-clic bytes | hub img | hub bytes |
|---|---|---|---|---|
| móvil · Tokio | 11 | 694 198 | 47 | 2 985 834 |
| móvil · Kioto | 11 | 694 198 | 46 | 3 438 492 |
| móvil · Osaka | 15 | 967 894 | 49 | 3 315 340 |
| móvil · Okinawa | 15 | 967 894 | 44 | 2 825 186 |
| escritorio · Tokio | 18 | 1 130 404 | 45 | 2 828 352 |
| escritorio · Kioto | 18 | 1 130 404 | 42 | 3 199 466 |
| escritorio · Osaka | 26 | 1 677 354 | 49 | 3 315 340 |
| escritorio · Okinawa | 26 | 1 677 354 | 44 | 2 825 186 |

#### A · WebKit
| Viewport · hub | pre-clic (portada) img | pre-clic bytes | hub img | hub bytes |
|---|---|---|---|---|
| móvil · Tokio | 6 | 353 688 | 52 | 3 326 344 |
| móvil · Kioto | 6 | 353 688 | 46 | 3 438 492 |
| móvil · Osaka | 9 | 560 398 | 49 | 3 315 340 |
| móvil · Okinawa | 9 | 560 398 | 44 | 2 825 186 |
| escritorio · Tokio | 12 | 609 584 | 51 | 3 260 814 |
| escritorio · Kioto | 12 | 609 584 | 41 | 3 248 126 |
| escritorio · Osaka | 22 | 1 367 186 | 49 | 3 315 340 |
| escritorio · Okinawa | 22 | 1 367 186 | 44 | 2 825 186 |

### B) main + lote (esta rama) con el gate corregido: **14/14 en ambos motores** (13 de G6 + K)

#### B · Chromium 151.0.7922.34
| Viewport · hub | pre-clic (portada) img | pre-clic bytes | hub img | hub bytes |
|---|---|---|---|---|
| móvil · Tokio | 11 | 694 198 | 47 | 2 985 834 |
| móvil · Kioto | 11 | 694 198 | 46 | 3 438 492 |
| móvil · Osaka | 15 | 967 894 | 49 | 3 315 340 |
| móvil · Okinawa | 15 | 967 894 | 44 | 2 825 186 |
| escritorio · Tokio | 18 | 1 130 404 | 48 | 3 051 364 |
| escritorio · Kioto | 18 | 1 130 404 | 41 | 3 159 768 |
| escritorio · Osaka | 26 | 1 677 354 | 49 | 3 315 340 |
| escritorio · Okinawa | 26 | 1 677 354 | 44 | 2 825 186 |

#### B · WebKit 26.5
| Viewport · hub | pre-clic (portada) img | pre-clic bytes | hub img | hub bytes |
|---|---|---|---|---|
| móvil · Tokio | 6 | 353 688 | 52 | 3 326 344 |
| móvil · Kioto | 6 | 353 688 | 46 | 3 438 492 |
| móvil · Osaka | 9 | 560 398 | 49 | 3 315 340 |
| móvil · Okinawa | 9 | 560 398 | 44 | 2 825 186 |
| escritorio · Tokio | 12 | 609 584 | 51 | 3 260 814 |
| escritorio · Kioto | 12 | 609 584 | 41 | 3 248 126 |
| escritorio · Osaka | 22 | 1 367 186 | 49 | 3 315 340 |
| escritorio · Okinawa | 22 | 1 367 186 | 44 | 2 825 186 |

## Resto de la regresión sobre main + lote

Build, `tsc -b`, lint (0 errores), Vitest 119 archivos / 3 436 tests: PASS. Deferred-images 21/21 en Chromium y WebKit (Portada → ciudad inmediata, Tokio/Kioto/Osaka/Okinawa, observadores huérfanos 0); mutantes `always-intersecting`, `no-disconnect` y `wide-margin` detectados en ambos motores; `eager-far-card` detectado en ambos. B21 36/36, P-04 55/55, B25 123/123, B26 314/314, B18 (regresión 40/40, a11y 25/25, back 15/15, chrome 6/6, responsive, viaje-lugar 38/38), B10 a11y 89/89, motion 17/17, microcopy 52/52 y Phase5A, en Chromium y WebKit.

B24 DDR-B24-3 (colecciones de la portada) 9/9 en ambos motores.

`b10-embedded-scroll-check.mjs` (`negative-scroll-chromium`) no existe en main: pertenece a la línea antigua y no forma parte de este lote.
