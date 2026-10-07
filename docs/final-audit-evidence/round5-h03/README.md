# H03 — por qué «Recargar la página» se atasca en WebKit (ronda 5)

**Estado: causa localizada en el motor (WebKit/libsoup), demostrada con y sin código de Nihon. El producto no cambia.**
Se corrige el arnés (clasificación con prueba objetiva + segunda pulsación estricta + regresión determinista). No se certifica
Safari físico: el motor medido es el WebKit de Playwright 1.62.1 (WPE, WebKit 26.5, Ubuntu 24.04), que usa libsoup; Safari usa
otra pila de red.

## 1. Pregunta y método

Los fallos B (la recarga no termina en 8 s) y C (no aparece el aviso a tiempo) de la matriz de ronda 4 eran indistinguibles de
«el producto no recarga». Se escribió una sonda dirigida, `app/scripts/h03-reload-stall-probe.mjs`, que repite el mismo flujo
con un perfil persistente NUEVO, un proxy nuevo y servidor caído por RESET, y une en una línea de tiempo lo que ven la página
(clic, `fetch` del refresco con inicio/fin/error, temporizador de 3 s, `beforeunload`/`pagehide`/`pageshow`/`load`), el driver
(petición/respuesta/fallo del documento, navegación) y el proxy (cada petición que LLEGA, sockets destruidos). Variantes:

| | qué hace | producto |
|---|---|---|
| A | clic en «Recargar la página» (refresco de módulos + `location.reload()`), servidor por RESET | sí |
| B | `location.reload()` simple desde la página, mismo RESET | solo la página |
| C | como A, pero el servidor responde HTTP 503 (sin destruir sockets) | sí |
| D | como B, tras una petición neutra `cache: "reload"` (no es un módulo) | solo la página |
| F | contrafactual SIN producto: página mínima con 3 importaciones dinámicas (2 rechazadas por RESET) + recarga simple | no |
| G | como F, con HTTP 503 | no |
| H | como A, con 150 ms de espera (en la sonda) entre el fin del refresco y la recarga | sí |

Ejecuciones locales con WebKit 26.5 (mismo build que CI; 4 CPU; con 2 workers de carga salvo la primera): `probe1` (sin carga),
`probe2`, `probe4`, `probe5`, `probe6`. Datos: `reload-stall-outcomes.ndjson` (una línea por repetición),
`reload-stall-summary.json` (totales y 14 líneas de tiempo completas), `webkit-stderr-signatures.txt`.

## 2. Resultados

| variante | repeticiones | recarga completa | **atascada** | sin aviso en 8 s | observación |
|---|---|---|---|---|---|
| A producto actual (RESET) | 340 | 325 | **12 (3,5 %)** | 3 | |
| B recarga simple (RESET) | 340 | 286 | **46 (13,5 %)** | 7 | |
| C producto actual (503) | 140 | 140 | **0** | 0 | |
| D recarga simple tras petición neutra | 100 | 99 | **0** | 1 | |
| F SIN producto (RESET) | 100 | 98 | **2** | 0 | reproduce sin Nihon |
| G SIN producto (503) | 100 | 100 | **0** | 0 | |
| H producto + 150 ms de asentamiento | 100 | 96 | **0** | 4 | A en esa misma ejecución: 5/100 |

### Qué ocurre en un atasco (60 de 60 repeticiones atascadas, con su línea de tiempo)

1. `beforeunload` se dispara: `location.reload()` **sí se ejecutó** (en A, 2 ms después de que terminara el refresco de módulos).
2. El driver ve la petición de documento (`request /`, `isNavigationRequest`).
3. **El servidor local no la recibe nunca** (60/60: el proxy no registra ningún `/` tras el clic), y la navegación no termina:
   en 37 de 60 (62 %) queda pendiente indefinidamente y en 23 de 60 (38 %) el driver recibe
   `requestfailed: WebKit encountered an internal error`.
4. La página anterior sigue viva y respondiendo (60/60: un `evaluate` posterior contesta `{stale: true, ready: "complete"}`; en el
   ejemplo A#52 el temporizador de 3 s del producto dispara a los 3059 ms). No es una página colgada.
5. No se recupera sola en 20 s (`reload-late` = 0). En las 29 repeticiones atascadas con diagnóstico de reintento (probe5/probe6):
   una segunda recarga recuperó 21 (72 %); en las 8 restantes, una petición neutra + recarga recuperó 8 de 8.

Por tanto el timeout de `waitForFunction` NO significa «no hubo recarga»: hubo recarga solicitada y el motor la perdió.

### Qué ocurre en un «sin aviso» (3+7+1+4 = 15 repeticiones)

En las 14 de ellas con instrumentación de procesos, el `WPENetworkProcess` se reemplazó entre el inicio y el instante del fallo
(PID distinto). Con las 820 repeticiones de producto con proceso de red estable no hubo ni un «sin aviso» (0/820); con el proceso
reemplazado, 14 de 20 (70 %) no tuvieron aviso. El stderr del motor muestra, justo tras el clic, ráfagas de
`libsoup-CRITICAL: soup_session_feature_request_queued: assertion 'SOUP_IS_SESSION_FEATURE (feature)' failed` y
`WebKit encountered an internal error ... WebLoaderStrategy::internallyFailedLoadTimerFired()`: la sesión de red se destruyó con
peticiones en cola. La importación del módulo no llega a rechazarse (no hay `LazyLoadError` en ese proceso), así que el producto
no tiene un error que mostrar. Estos avisos de libsoup son frecuentes también en repeticiones sanas, por sí solos no discriminan;
lo que discrimina es el reemplazo del proceso de red. Es la misma familia que la pérdida de `localStorage` en contextos
efímeros de ronda 4 (reemplazo del proceso de red = almacenamiento efímero perdido).

### Aviso «tardío»

Medido en la página (clic → `[data-lazy-failure]` en el DOM, 198 repeticiones sanas): p50 344 ms, p95 361 ms, máximo 368 ms.
En CI (instantáneas del trazado de ronda 4): máximo 338 ms. La espera de 700 ms del gate es **correcta** y se conserva como límite
explícito; el único fallo C observado en CI (caso 12, 8360fbb) no es un aviso lento sino un aviso que no aparece (ningún cambio de DOM
en los 21 s siguientes). La medición que dio 28 % por encima de 700 ms en las primeras pasadas incluía la latencia del driver
(Playwright `click` + sondeo), no la del producto.

## 3. Causa

**Demostrada (motor, no producto, no proxy):**

- Con RESET, la primera petición de documento tras el fallo se pierde dentro de WebKit con una frecuencia de 13,5 % (recarga simple)
  y 3,5 % (producto). Con 503 (sin destruir sockets) es 0 % en 140 + 100 repeticiones. Sin código de Nihon (F) ocurre; con 503 (G) no.
- El proxy nunca recibe la petición: el proxy no puede ser la causa de que no llegue. El producto sí ejecutó `reload()`.
- Una petición sana previa a la recarga (D) elimina el atasco (0/100 frente a 46/340), y 150 ms de asentamiento entre el refresco
  y la recarga también (H: 0/100; A en la misma ejecución 5/100). El refresco de módulos que ya hace el producto reduce el atasco
  de 13,5 % a 3,5 %; el residuo es del motor.

**No demostrado:** el defecto exacto dentro de libsoup (por qué una conexión keep-alive tras un RESET deja una petición sin enviar);
si ocurre en Safari físico (otra pila de red); la causa del reemplazo espontáneo del proceso de red.

## 4. Cambios

- `app/scripts/lib/h03-reload.mjs` (nuevo): `pressOfferedReload`. Pulsa el botón, espera 8 s a que desaparezca el documento anterior
  (límite explícito, no se amplía) y, si se supera, clasifica con prueba objetiva: petición de documento emitida y **no recibida por
  el servidor**, o proceso de red de WebKit reemplazado → informa (cobertura parcial) y **vuelve a pulsar; la segunda pulsación es
  estricta**. Sin esa prueba el timeout sigue siendo un fallo estricto. Usa `noWaitAfter` porque el `click` esperaría hasta 30 s.
- `app/scripts/final-audit-data-recovery-check.mjs`: el proxy cuenta las peticiones de documento que le llegan; el gate registra los
  procesos de red de WebKit por escenario (Linux); si falta el aviso y el proceso de red se reemplazó durante la importación, la
  aserción «aparece un mensaje» queda como diagnóstico (cobertura parcial) en vez de fallo, y se anota en `evidence.h03EngineFaults`.
  Siguen siendo estrictos: aplicación no en blanco, navegación utilizable, datos intactos, recuperación en la MISMA sesión tras la
  salida ofrecida, interés conservado. Espera de 700 ms: sin cambios.
- `app/scripts/h03-reload-classification-check.mjs` (nuevo, regresión determinista en Chromium y WebKit, sin código de Nihon):
  T1 recarga perdida → informe + 2.ª pulsación; T2 la recarga llega al servidor y no recibe respuesta → fallo estricto;
  T3 el botón no recarga → fallo estricto; T4 recarga sana; T5 recarga perdida y 2.ª también → fallo estricto;
  T6 proceso de red reemplazado + petición sin respuesta → informe + 2.ª pulsación. Añadido a `p06-v2-certify.sh`.
- `app/scripts/h03-reload-stall-probe.mjs` (nuevo): la sonda de este informe.
- **Producto: sin cambios.** No se altera `reloadRefreshingModules` ni `LazySurfaceBoundary` para compensar a libsoup: la mejora que
  mostraría la variante H sería una espera añadida a todos los usuarios para un defecto de una pila de red que Safari no usa.

## 5. Limitaciones que se conservan

- La conservación de datos en WebKit se prueba con **perfil persistente** (ronda 4). El contexto efímero pierde `localStorage` cuando
  el proceso de red se reemplaza (diagnóstico de ronda 4 y sonda de reinicio forzado): es una limitación del entorno de pruebas, no
  una garantía del producto en ese modo.
- Un gate WebKit con un fallo del motor clasificado queda en **COBERTURA PARCIAL**: no equivale a validación completa.
- No se certifica Safari físico ni iOS.

## 6. Reproducción

```sh
cd app && npm ci && npx playwright install --with-deps webkit && npm run build
NIHON_PROBE_LOAD=1 NIHON_PROBE_VARIANTS=A,B,C,D,F,G,H NIHON_PROBE_REPS=100 NIHON_PROBE_OUT=/tmp/h03-stall DEBUG=pw:browser \
  node scripts/h03-reload-stall-probe.mjs
NIHON_BROWSER=webkit node scripts/h03-reload-classification-check.mjs   # y chromium
```
