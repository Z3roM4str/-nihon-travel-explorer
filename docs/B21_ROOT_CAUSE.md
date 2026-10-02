# B21 — causa raíz del «scroll changed: 360 -> 0» intermitente

**Estado: CERRADO. Defecto del gate (carrera con la animación de entrada + reintento de Playwright), no del producto.** Sin cambios en `src/` (salvo una prueba de cobertura ajena, ver `RELEASE_CERTIFICATION.md`). Corregido en `app/scripts/b21-global-search-browser-audit.mjs`.

## Síntoma
`b21-global-search-browser-audit` fallaba en una fracción de las ejecuciones con `scroll changed: 360 -> 0` al volver desde la ficha a la búsqueda global. Reproducido en `8aa7d1d` (anterior al endurecimiento): no era regresión.

## Reproducción (Playwright 1.62.1, Chromium 141, `vite preview` de la build de producción)
| Configuración | Resultado del gate original |
|---|---|
| Chromium 141 completo, 112 ejecuciones (secuencial y 6 en paralelo) | 0 fallos |
| `chromium_headless_shell` 141, ejecuciones secuenciales | **fallos ≈ 8–23 %**; los que dejó la traza cayeron todos en «nearby stack / browser back» (la última `assertRestored`) |

El binario completo no reprodujo el fallo en 112 ejecuciones; la diferencia de probabilidad entre binarios es de temporización (no se midió por qué) y bajo carga paralela tampoco falla el original (60/60): la carrera exige que el driver llegue al click mientras `sheet-rise` aún corre, y la animación avanza en tiempo real. La carrera existe en el gate con cualquier binario; sólo cambia la probabilidad. (Coherente con la nota previa «el headless shell no restaura el scroll en escritorio».)

## Cadena causal (medida, no supuesta)
1. El gate abre la hoja, escribe «a» (214 tarjetas), fija `scrollTop = 360` y hace `click()` sobre el primer resultado totalmente visible.
2. La entrada de la `Sheet` es `animation: sheet-rise 320ms var(--ease-enter)`. Sondeo por fotogramas en el instante del `scrollTop = 360` (10 ejecuciones): `sheet-rise` seguía **en curso** (`currentTime` 267–317 de 320 ms) y la posición del resultado cambiaba **−0,317 / −0,117 / −0,021 px** en los 2–4 fotogramas siguientes (20–70 ms). Además había 56 fundidos de imagen (`opacity`) en marcha.
3. Playwright (`_performPointerAction`) exige que el elemento tenga el mismo bounding box en dos fotogramas consecutivos. No lo tiene → log `element is not stable` → `retrying click action`.
4. `_retryPointerAction` reintenta con `node.scrollIntoView({ block: "end" })`, luego `center`, luego `start`. Para un resultado situado en la parte alta de una lista de 21 052 px, `block: "end"` deja **`.sheet__body.scrollTop = 0`** (se recorta contra el inicio del contenedor).
5. Ese scroll es nativo y llega al producto como un evento `scroll` legítimo: `onBodyScroll` guarda `globalSearchScrollTopRef = 0`. El producto restaura fielmente la última posición que observó → `360 -> 0`.
6. Intermitencia: el evento `scroll` sólo se despacha en el siguiente fotograma. Si el `click` desmonta la hoja antes de ese fotograma, el 0 no se llega a guardar y el gate pasa. Por eso, de 40 ejecuciones con `DEBUG=pw:api`: 11 sin «not stable» → 0 fallos; 29 con «not stable» en ese click → 8 fallos y 21 aciertos (el `click` ganó la carrera contra el fotograma del evento).

## Evidencia de control (todas con el mismo build y binario)
| Experimento | Resultado |
|---|---|
| Espera pasiva 700 ms tras fijar el scroll, sin ninguna acción del driver | **0/80** reinicios: el producto no mueve el scroll por sí solo |
| `click()` normal | 12/60 |
| `click({ force: true })` (sin comprobación de estabilidad ni reintento) | 0/60 |
| `page.mouse.click` en coordenadas | 0/60 |
| `element.click()` en JS | 0/60 |
| Log de Playwright, 40 ejecuciones | 8/8 fallos con `element is not stable` en el click del resultado; 0/11 fallos sin él |

## Clasificación
**C (Playwright) + B (carrera del gate)**, con la animación de entrada como detonante legítimo. **No es A (producto):** el producto no escribe ni restablece el scroll fuera de `Sheet` (`useLayoutEffect` con `initialBodyScrollTop`) y `App` (`globalSearchScrollTopRef`); ante un scroll real a 0 antes de seleccionar, restaurar 0 es el comportamiento correcto. No se modificó el producto.

## Corrección (en el gate, esperando la condición real; ningún `waitForTimeout`)
* `settled(page)`: espera `Animation.finished` de **todas las animaciones finitas** (`sheet-rise`, fundidos de imagen) hasta que no queda ninguna; excluye las infinitas (`card-shimmer`), que no mueven nada. Se llama al final de `openSearch`, es decir, antes de fijar el scroll y de pulsar.
* La línea base pasa a ser **el scroll en el instante de la selección**: un listener de captura de `click` lo registra antes del manejador de React, y `assertScrollAtSelection` falla con un mensaje que atribuye el cambio al driver si el scroll difiere de lo fijado. Así un reintento de Playwright nunca vuelve a presentarse como fallo de restauración.
* El gate admite `NIHON_BROWSER=webkit` (`NIHON_WEBKIT_PATH` opcional), igual que b10-a11y/motion, d0b y d5. Pasa de 33 a 36 aserciones.

## Estabilidad tras la corrección (`chromium_headless_shell`, donde antes fallaba)
| Prueba | Original (`a8350d4`) | Corregido |
|---|---|---|
| 60 pares alternados, móvil, máquina libre | **14/60 fallos (23 %)**, todos `scroll changed: 360 -> 0` | **0/60** |
| 30 pares alternados, escritorio, máquina libre | **6/30 fallos (20 %)**, todos `scroll changed: 360 -> 0` | **0/30** |
| 120 móvil + 60 escritorio, 4 procesos en paralelo | — | 120/120 y 60/60 |
