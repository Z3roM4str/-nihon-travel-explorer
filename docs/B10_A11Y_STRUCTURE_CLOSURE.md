# B10-A1…A4 — Accesibilidad estructural: cierre

**Estado: CERRADOS** en el endurecimiento post-B10. Cero cambio visual medido: 55 pares main-vs-rama (320/390/430/840/1200 × 11 superficies, Chromium 141) **idénticos píxel a píxel** (pixelmatch, 0 px de diferencia).

| ID | Hallazgo | Clase | Solución | Qué cambia para una persona con lector de pantalla |
|---|---|---|---|---|
| **B10-A1** | Sólo la vista de mapa tenía landmark `main` | **A** defecto semántico reparable | `div.app__content` → `<main class="app__content">` (un único `main` visible en todas las pantallas); los dos `<main>` internos (`.app__map-area`, `.national__map-area`) pasan a `<div>` con las mismas clases | «Ir al contenido principal» existe en toda pantalla; cabecera y barras quedan fuera |
| **B10-A2** | Lista de ciudad, mapa y ficha sin `h1`; la lista saltaba de `h1`/nada a `h3` | **A** | El selector de ciudad (botón de la cabecera) queda dentro de `<h1 class="app__heading">` con reseteo que no pinta nada; la lista lleva un `<h2 class="visually-hidden">Lugares de {ciudad}</h2>` | Un `h1` por pantalla («Tokio», «Viaje»…); las tarjetas (`h3`) cuelgan de un `h2`; la ficha (`h2`) vuelve a subir de nivel, que es válido |
| **B10-A3** | «Viaje» duplicado como `h1` y `h2` | **A** (la parte semántica) / **B** (el texto visible duplicado) | El `h2` de la sección Días conserva su texto visible «Viaje» y añade `<span class="visually-hidden"> · Días</span>` → nombre accesible «Viaje · Días», coherente con «Reservas», «Resumen», «Dónde dormir en Tokio» | Ya no hay dos encabezados con el mismo nombre. **No se tocó** lo visible: que el título «Viaje» se vea dos veces (cabecera y tarjeta de Días) es una decisión visual de Producto (B), no se fuerza |
| **B10-A4** | Controles de Leaflet < 44 px (zoom 30×30) | **A** parcial / **C** parcial | Zoom: se amplía **sólo el área de impacto**, hacia fuera y sin solaparse («+» crece 15 px hacia arriba, «−» 14 px hacia abajo, ambos 7 px por lado → 44×44 reales; `z-index` del zoom sobre la franja de 2 px de relleno de la atribución). Lo pintado es idéntico (30×30). **Atribución** («Leaflet», «© OpenStreetMap»): enlaces legales en línea → **C** (restricción de tercero, obligación de licencia, texto en línea) y exentos como enlaces en línea | El zoom es objetivo de 44×44 también con el puntero grueso |

## Por qué el zoom no se agranda visualmente
Los botones de Leaflet van apilados con paso de 30 px: agrandarlos a 44 px **pintados** cambia el cromo del mapa y puede tapar marcadores y la leyenda (decisión visual, B). Ampliar el área de impacto hacia fuera consigue los 44 px sin tocar un píxel, y como «+» crece hacia arriba y «−» hacia abajo **no se solapan** (el gate lo comprueba con `elementFromPoint`).

## Protección (qué impide la regresión)
* `b10-a11y-check` (89 comprobaciones; antes 87): por pantalla y ancho → un único `main`, un único `h1` y el primero, ningún salto de nivel hacia abajo, ningún `h2` con el nombre del `h1`; `KNOWN_STRUCTURE.noH1` y la excepción `A.leaflet-*` **eliminados**; nuevo `Z-390`/`Z-1200`: el toque 13 px fuera del botón cae en el botón correcto y no hay solape.
* `src/b10-structure.test.ts` (5 pruebas): un solo `<main>` en el código, un solo `<h1>` fuera de `App.tsx`… ninguno, el `h1` envuelve el selector, el `h2` oculto de la lista, el sufijo de A3 y el CSS de zoom (sin redimensionar botones).
* El gate sólo exceptúa ya la atribución legal.

## Honestidad sobre lo no medido
No hay lector de pantalla físico ni Safari/iPhone en este entorno: la mejora de navegación por landmarks/encabezados se midió en el árbol DOM/estilos computados (Chromium), no con VoiceOver/TalkBack. WebKit no está instalado en esta sesión.

## Certificación de la rama (Chromium 141; clon de trabajo, build de producción)
tsc/build PASS · oxlint 0 errores (1 aviso heredado `PlaceMap.tsx:18`) · Vitest 118 archivos / 3 510 · **b10-a11y 89/89** · motion 16/16 · microcopy 52/52 · performance 13/13 · D0b 56/56 · D5 30/30 ·
block12 · B17 ×2 · B18 ×5 · block19 ×2 · block20 · b24-ddr3 · B25 123 · B26 · B27 · **B28** (pasó en la tanda; intermitente conocido de temporización) · **B29 163/163** · B30 475/475 · B31 281/281 · ddr03 · DD-028 · block5 · block6 · b21 33/33 · phase5a · block23 · b18-regression 40/40.
**Cambios de gates por esta misión (no por debilitar)**: `b29` busca el `h2` por su nuevo nombre accesible «Viaje · Días» (A3); `b10-a11y` se reforzó (arriba); el test de alcance D5 mide `b854db3..2a10ad3` (se rompía con cualquier cambio posterior de `lib/`/`data/`, ya en main tras #183).
Sin WebKit en esta sesión (no repetido); sin lector de pantalla ni Safari físicos.
