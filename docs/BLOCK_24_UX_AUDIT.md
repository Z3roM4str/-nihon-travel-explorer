# Bloque 24 — Auditoría UX con input real

Base `4afbf50`. Método (`docs/BLOCK_24_MISSION.md` §5): rueda real (`page.mouse.wheel`), clic en
coordenadas tras `elementFromPoint`, muestreo de píxeles de SVG, teclado real, auditoría estática
del ancestro con scroll. Gate permanente: `app/scripts/b24-real-input-audit.mjs`. Viewports:
320×568 · 375×667 · 390×844 · 430×932 · 820×1180 · 1024×768 · 1280×800 · 1440×900 («todos»).

Estados: **FIX-NOW** · **DDR** · **DEFERRED-ROADMAP(Bn)** · **DEFERRED-ACTIVE-BRANCH**.
Severidad: P0 (bloquea una tarea básica) · P1 (incumple norma, tarea posible) · P2 (catálogo).

## Resumen

| Estado | Hallazgos |
|---|---|
| FIX-NOW | P0-1, P0-2, P0-3, P0-4a, P0-4b, P0-4e (F7, → `DD-026`), P0-5a, P0-5b, P1-01 … P1-12, P2-7, R-F7 (crash de `flyTo` con el mapa oculto, F7) |
| RESUELTO (era DDR) | DDR-B24-1 (encuadre del mapa de ciudad → `DD-023`), DDR-B24-2 (marcadores cercanos con ≤12 a la vista → `DD-024`), DDR-B24-3 (volver desde una colección → `DD-025`) |
| DEFERRED-ACTIVE-BRANCH | P0-5c, AB-1, AB-2, AB-3, AB-4 |
| DEFERRED-ROADMAP | P1-13 (B7), P2-1 … P2-4 (B10), P2-5 (B9), P2-6 (B10) |

---

## P0

### P0-1 — La portada de Explorar no se desplaza
- **Superficie:** Explorar › Inicio. **Viewport:** todos. **Severidad:** P0.
- **Evidencia:** `.explorer-home` mide 3007 px de alto dentro de un `.app__body--national` de
  732 px (390×844) y 2921 px dentro de 844 px (1440×900). El recorrido de ancestros no encuentra
  ningún `overflow-y: auto|scroll`: `.app__body { overflow: hidden }`, `.app__content` y `.app`
  también ocultan. 40 pasos de `mouse.wheel(0, 240)` no mueven «Ver Japón en el mapa»
  (`top` 2981 → 2981 a 390). Okinawa, «Más destinos», las colecciones y la tarjeta del mapa
  nunca entran en pantalla; el clic real en «Ver Japón en el mapa» cae en (195, 3022), fuera del
  viewport. Gate: 53 fallos en 8 viewports.
- **Norma:** `05 §2` (contenido 3–6 de la portada), `05 §2` pt. 2 (buscador pegajoso), `02 §D3`
  pt. 2 (volver restaura el scroll), `08` G5.
- **Estado:** FIX-NOW. Criterios: desplazable en todos los viewports; el buscador sigue fijo
  arriba; la regla de montaje de Leaflet (`App.css` §`.app__body`, superficies `absolute` con
  caja real) no cambia; la restauración de scroll de B18/B21 no se rompe.

### P0-2 — Iconos de `.icon-button--small` invisibles
- **Superficie:** Quiero ir (quitar), Viaje › Planificar (↑ ↓ × por fila), cabeceras de día.
  **Viewport:** todos. **Severidad:** P0.
- **Evidencia:** el `::before` (`position: absolute`, fondo `--color-surface`) se pinta después
  del SVG en el orden de apilamiento y lo tapa. Muestreo de píxeles de la caja del SVG en Quiero
  ir: contraste trazo/fondo **1,00:1** (el icono no existe en pantalla) en los 8 viewports.
  Gate: 30 fallos.
- **Norma:** Art. 11 (3:1 en gráficos portadores de significado), `04 §4` (botón de icono).
- **Estado:** FIX-NOW en `App.css` con `isolation: isolate` + `z-index`, sin cambiar la caja de
  44 px (técnica 2 de `b17-tap-target-check`). Quiero ir y Viaje sólo reciben este P0.

### P0-3 — Contador de las tarjetas de ciudad ilegible
- **Superficie:** Explorar › Inicio › Ciudades. **Viewport:** todos. **Severidad:** P0.
- **Evidencia:** «57 lugares» en `rgba(255,255,255,.82)` sobre una píldora
  `rgb(236,238,235)` (clase heredada `national-start__hub-count`): contraste ~1,15:1. Con la
  fotografía más clara posible (píxel blanco) el scrim efectivo mínimo bajo la banda de texto es
  **0,081** (exigido ≥0,60): `--scrim-bottom` sólo llega a 0,60 en el 17 % inferior de la foto.
  Contraste del nombre en blanco en ese peor caso: 1,18:1. Gate: 48 fallos.
- **Norma:** D-M1 (nueva, `09`), `03 §5` «Scrim bajo texto», `05 §2` pt. 3, Art. 11.
- **Estado:** FIX-NOW: sin píldora, cifra en `--type-num` sobre el scrim, suelo de scrim propio
  de la banda con el valor de la parada inferior de `--scrim-bottom` (mismo mecanismo que
  `PlaceCard`, DD-016).

### P0-4a — Mapa de ciudad sin agrupación
- **Superficie:** Explorar › Ciudad › Mapa. **Viewport:** todos. **Severidad:** P0.
- **Evidencia:** Tokio muestra **57 marcadores sueltos** a la vez; `03 §9` exige agruparlos por
  encima de 12 visibles. **177 pares** de marcadores se solapan (390×844). Gate: 32 fallos.
- **Norma:** `03 §9` («Agrupación: por encima de 12 marcadores visibles, se agrupan en un círculo
  con cifra (`--type-num`), estilo indicador de estación»).
- **Estado:** FIX-NOW en `PlaceMap.tsx` (no es zona protegida), sin dependencia nueva.

### P0-4b — Área de impacto de los marcadores < 44 px
- **Superficie:** Explorar › Ciudad › Mapa. **Viewport:** todos. **Severidad:** P0.
- **Evidencia:** la caja del icono Leaflet mide lo mismo que el punto visible (10/12/14/20 px);
  `elementFromPoint` en el centro de un marcador resuelve a `place-marker__dot`, 10×10.
- **Norma:** Art. 11 (44×44), `03 §7`.
- **Estado:** FIX-NOW: caja de impacto de 44 px centrada; **los tamaños visibles no cambian**
  (ya cumplen `03 §9`). Sin solapes ambiguos entre áreas.

### P0-4c — Encuadre inicial del mapa de ciudad → **DDR-B24-1**
- **Superficie:** Explorar › Ciudad › Mapa. **Viewport:** todos. **Severidad:** P0 (decisión).
- **Evidencia:** `FitHubBounds` encuadra **todos** los lugares del hub; en Tokio incluye lugares
  periféricos (Okutama, Takao, Izu), así que el núcleo urbano queda comprimido en una fracción
  del mapa. Capturas: `/tmp/b24/city-map-390x844.png`, `/tmp/b24/city-map-1440x900.png` (y
  las de después de la agrupación, ver `DDR-B24-1` en `09`).
- **Norma:** ninguna sección fija el encuadre inicial (`03 §9`, `05 §4` no lo prescriben).
- **Estado:** **RESUELTO** (DDR-B24-1 cerrada por `DD-023` en `09`): encuadre editorial por hub
  (`lib/hub-view.ts`) con fallback calculado sobre el núcleo real del hub; ningún lugar
  desaparece del mapa ni del dataset; el lugar seleccionado explícitamente sigue ganando.
  `FitHubBounds` ya no usa `fitBounds` de todos los lugares del hub. Gate:
  `src/lib/hub-view.test.ts`.

### P0-4d — Solapes con 12 o menos marcadores a la vista → **DDR-B24-2**
- **Superficie:** Explorar › Ciudad › Mapa, tras acercar. **Viewport:** todos. **Severidad:** P0 (decisión).
- **Evidencia:** abriendo grupos con clic real hasta deshacerlos, vuelven a solaparse cajas de
  44 px de lugares vecinos: Tokio 1 par (Shibuya Crossing / SHIBUYA SKY), Kioto 2, Osaka 5,
  Okinawa 7. `03 §9` sólo agrupa por encima de 12; Art. 11 no admite el solape.
- **Estado:** **RESUELTO** (DDR-B24-2 cerrada por `DD-024` en `09`): `groupScreenPoints` (ya
  agrupaba sólo parejas que se tocarían) se aplica siempre, no sólo por encima de 12 visibles —
  cubre densidad y seguridad geométrica con el mismo código, y vuelve a separar al alejar el
  solape con el zoom. Gate: los cuatro conflictos de la auditoría cubiertos permanentemente en
  `src/lib/map-grouping.test.ts` con proyección Web Mercator real.

### DDR-B24-3 — Volver desde una colección de la portada
- **Superficie:** Explorar › Inicio › colecciones. **Viewport:** todos. **Severidad:** P1 (decisión).
- **Evidencia:** abrir un lugar desde una colección cambia Explorar a su ciudad (B21); al cerrar
  la ficha no se vuelve a la portada ni a su scroll. Se hizo alcanzable al arreglar P0-1.
- **Norma:** `02 §D3` pt. 2.
- **Estado:** **RESUELTO** (DDR-B24-3 cerrada por `DD-025` en `09`): las colecciones de la
  portada se comportan como la búsqueda global (DDR-B21-05) — `selectPlace` recibe
  `exploreReturnSurface="home-collection"`, la ficha se apila sobre la portada sin cambiar de
  ciudad, la portada sigue montada y cerrar (UI/Escape/back) devuelve exactamente a ella con su
  scroll. Gate: `src/block24-ddr3-home-collections.test.ts` (contrato) y
  `app/scripts/b24-ddr3-home-collections-check.mjs` (comportamiento en vivo).

### P0-4e — Regresión propia: un marcador puede quedar bajo `InterestLegend` tras expandir un grupo
- **Superficie:** Explorar › Ciudad › Mapa (Tokio), tras expandir un grupo. **Viewport:** 375×667
  (reproducido sólo en ese viewport en la comprobación aislada; aparece de forma intermitente en
  otros durante la corrida completa de 8 viewports). **Severidad:** P0.
- **Evidencia:** al implementar DDR-B24-1/DDR-B24-2, el encuadre resultante de expandir el grupo
  mayor de Tokio deja «Daikanyama T-SITE» exactamente bajo `.interest-legend__summary` (esquina
  inferior izquierda del mapa); `elementFromPoint` en su centro resuelve a la leyenda, no al
  marcador (Art. 11: ningún objetivo tapado). No ocurre en la base `4afbf50` (0 fallos en 8
  viewports antes de esta implementación).
- **Norma:** Art. 11.
- **Causa técnica.** Ningún movimiento programático del mapa tenía en cuenta el cromo que se le
  superpone: `InterestLegend` es hermana del contenedor de Leaflet dentro de `.app__map-area`
  (`z-index: 10` sobre el panel de marcadores), y ni `FitHubBounds`, ni `expand()`, ni
  `FocusSelected` sabían que ese rectángulo existe. Antes de B24 el encuadre `fitBounds` de todos
  los lugares de Tokio dejaba por casualidad libre esa esquina; el encuadre editorial (`DD-023`) y
  la agrupación siempre activa (`DD-024`) cambiaron la geometría y, al abrir el grupo mayor de
  Tokio a 375×667, la caja de «Daikanyama T-SITE» caía entera bajo `.interest-legend__summary`.
  Los dos intentos de F6 (más margen en `fitBounds` de `expand()`) no podían funcionar: la
  posición final de un marcador depende de todos los lugares de la ciudad a ese zoom, no sólo de
  los miembros del grupo abierto.
- **Estado:** **RESUELTO (F7) → `DD-026`.** El cromo interactivo del mapa es zona de exclusión.
  `lib/map-chrome.ts` calcula, en geometría pura, la traslación más corta que deja todas las cajas
  de impacto de 44×44 fuera del cromo sin meter otra debajo, sin sacar de pantalla a las liberadas
  ni al lugar seleccionado (traslación → la agrupación no cambia). `PlaceMap.tsx` hace pasar todo
  movimiento programático por `moveProgrammatically`; al terminar, la guarda de `MarkerLayer`
  mide en vivo el cromo (`[data-map-chrome]` —la leyenda lo declara— y `.leaflet-control`) y
  desplaza el mapa si hace falta. También al volver a mostrarse un mapa que estaba oculto. Los
  gestos de la persona no se corrigen. Sin offsets mágicos, sin lugar ni viewport concretos, sin
  bajar de 44 px, sin `z-index`, sin ocultar lugares, sin mover la leyenda.
- **Invariante (gate `P0-4e`, 8 viewports × con/sin `prefers-reduced-motion`).** Tras el encuadre
  inicial, tras abrir hasta tres grupos seguidos y tras seleccionar un lugar: cada marcador o
  grupo visible mide ≥44×44, no se cruza con ningún rectángulo de cromo y `elementFromPoint` en su
  centro resuelve a él; la leyenda se abre y se cierra con clic real; los iconos siguen
  representando el mismo número de lugares que antes de abrir grupos. Sin el arreglo, el gate
  reproduce el fallo original a 375×667 («Daikanyama T-SITE» bajo `interest-legend`).

### P0-5a — Filas de la búsqueda global más anchas que la hoja
- **Superficie:** Explorar › Buscar en todo Japón. **Viewport:** todos. **Severidad:** P0.
- **Evidencia:** a 390×844 cada fila mide **417,75 px** en una hoja de 390 (termina en 434);
  el corazón (tercer control) queda en x = 393–425, fuera del viewport. Causa: la rejilla
  `.place-list--compact` usa `1fr` (= `minmax(auto, 1fr)`) y el nombre en `nowrap` impone su
  min-content. Gate: 32 fallos.
- **Norma:** D-M6 (nueva), `04 §12`, Art. 11.
- **Estado:** FIX-NOW en `styles/discovery.css` (`.place-list--compact`, regla no protegida).

### P0-5b — Sin contador vivo en la cabecera de la búsqueda
- **Evidencia:** la cabecera sólo dice «Buscar en todo Japón».
- **Norma:** D-M6 («contador vivo en la cabecera: "14 lugares"»).
- **Estado:** FIX-NOW en `SearchSheet`/`Sheet`.

### P0-5c — Metadato «{categoría} · {barrio}, {ciudad}»
- **Evidencia:** la fila compacta dice «Ciudad y barrios · Shibuya», sin ciudad: en una búsqueda
  de todo Japón no se distingue la ciudad.
- **Norma:** D-M6, `03 §2.3` (un solo `·`).
- **Estado:** **DEFERRED-ACTIVE-BRANCH (B23)** — la línea vive en `PlaceCard.tsx`, zona
  protegida. Diff propuesto, **no aplicado**:

```diff
--- a/app/src/components/PlaceCard.tsx
+++ b/app/src/components/PlaceCard.tsx
@@ variant === "compact"
           <p className="place-card__meta">
             {categoryLabel}
             <span aria-hidden="true"> · </span>
-            {zone}
+            {zone ? `${zone}, ${place.hub}` : place.hub}
           </p>
```

---

## P1

| id | Superficie | Viewport | Evidencia | Norma | Estado |
|---|---|---|---|---|---|
| P1-01 | FilterSheet | todos | Desplegable «▾ Filtros» (`.filter-panel__toggle`) que oculta los grupos; no existe en `04 §13` | `04 §13` | FIX-NOW |
| P1-02 | FilterSheet | todos | Al llegar al final con rueda, el contenido asoma **24 px** bajo el pie fijo (el `padding-bottom` de `.sheet__body` queda debajo del pie) | `04 §13` (pie fijo), `04 §8` | FIX-NOW |
| P1-03 | FilterSheet | todos | 6 `summary` en `text-transform: uppercase` + `letter-spacing` | `03 §2.3`, Art. 00 patrones prohibidos | FIX-NOW |
| P1-04 | FilterSheet | todos | Glifos `▾ ▸` (toggle y `::before` de cada grupo) como icono | D-M5, `03 §8` | FIX-NOW |
| P1-05 | Onboarding | todos | «PASO 1 DE 3» en mayúsculas **encima** del título: eyebrow | `03 §2.3` | FIX-NOW |
| P1-06 | Onboarding | todos | Paso 1: «Elige una **zona** y ve pasando tarjetas» — la portada ofrece ciudades | `05 §1`, `05 §2` | FIX-NOW |
| P1-07 | Toast al marcar/desmarcar | todos | «Guardado en Quiero ir: Shibuya Crossing» / «Quitado de Quiero ir: …» | D-M4, `03 §10` («el botón "Quiero ir" produce el estado "Quiero ir", no "Guardado"») | FIX-NOW |
| P1-08 | Ficha › Cerca de aquí | todos | Se muestra el valor crudo del dataset «Mismo cluster» | D-M4, Art. 7 | FIX-NOW (sólo presentación; `nearby.json` intacto) |
| P1-09 | Ficha | todos | Escape cierra la ficha y el foco cae en `<body>` | Art. 11, `04 §8` (foco devuelto al disparador) | FIX-NOW |
| P1-10 | Ficha › galería | 820×1180 (y < md en general) | Héroe 4:5 a 820 px de ancho = **1025 px** de alto (> 60 % de 1180) | D-M3, `04 §6` | FIX-NOW |
| P1-11 | Inicio › Más destinos | 320–820 | Fila horizontal de tarjetas de 200 px: la segunda tarjeta la corta el borde de la pantalla a media palabra («1 lugar por ahor»); contador en píldora | `05 §2` pt. 4, DDR-B21-02 | FIX-NOW |
| P1-12 | Inicio | todos | La sección «Ciudades» es un panel interior (`.national-start`: fondo `--surface`, borde inferior, relleno propio) dentro de la portada; `05 §2` no lo prescribe | `05 §2` | FIX-NOW (se retira el panel; el texto se conserva) |
| P1-13 | Quiero ir (`SelectionPanel` ▾▴, `SelectionAnalysis` ▸) | todos | Glifos de texto como icono | D-M5 | DEFERRED-ROADMAP(B7) — la misión sólo admite P0 en Quiero ir |

## P2 — catálogo

| id | Superficie | Evidencia | Estado |
|---|---|---|---|
| P2-1 | Inicio › colecciones | Sin salto de teclado: 64 / 70 / 28 / 150 paradas de Tab (Imprescindibles / Joyas / Menos saturado / Para una tarde), dos por tarjeta | DEFERRED-ROADMAP(B10) — auditoría de accesibilidad completa |
| P2-2 | Inicio › colecciones | Las cuatro colecciones empiezan por lugares de Tokio (orden del dataset: Tokyo National Museum, Ota Memorial Museum, Takeshita Street, Shibuya Crossing) | DEFERRED-ROADMAP(B10) — requiere decisión editorial de orden |
| P2-3 | Inicio | La foto de la tarjeta de Tokio (`JP-021/tokyo-national-museum-stairs-800w.webp`) es la misma que la del primer «Imprescindible» | DEFERRED-ROADMAP(B10) — decisión editorial de héroe |
| P2-4 | Bundle | Chunk de entrada `index-*.js` **1.648,69 kB** (388,21 kB gzip); el mayor componente es `photography-metadata.json` importado estáticamente | DEFERRED-ROADMAP(B10) medición; el split del import es AB-3 |
| P2-5 | Viaje › Planificar vacío | «El recorrido está vacío. Añade lugares guardados desde la lista de abajo.» sin lista debajo cuando no hay nada guardado | DEFERRED-ROADMAP(B9) — `OrderedSequenceBuilder.tsx` vedado |
| P2-6 | FilterSheet | El contador dice «57 de 57 lugares»; `04 §13` escribe «57 lugares» | DEFERRED-ROADMAP(B10) — microcopy, fuera de los P1 de la misión |
| P2-7 | Cabecera de ciudad | El título «Tokio» lleva el icono `abajo` (flecha); `04 §11` pide «un icono de expandir» y el set tiene `expandir` | FIX-NOW (trivial, dentro del alcance: icono del set, `03 §8`) |

## DEFERRED-ACTIVE-BRANCH (zonas protegidas)

| id | Qué | Zona | Diff propuesto (no aplicado) |
|---|---|---|---|
| P0-5c | Metadato de búsqueda D-M6 | `PlaceCard.tsx` (B23) | ver P0-5c |
| AB-1 | Corazón de `PlaceCard` 40×40 < `--tap-min` | `.place-card__save*` (B23) | `.place-card__save { width: 40px; height: 40px }` → mantener el círculo visible de 40 px y añadir `tap-target-min` al botón (técnica 1, control aislado): `className={\`place-card__save tap-target-min …\`}` en `PlaceCard.tsx` |
| AB-2 | Chip «Hidden gem» en inglés (`PlaceCard.tsx:84`) | `PlaceCard.tsx` (B23) | `return { icon: "joya", label: "Hidden gem" }` → `label: "Joya escondida"` (`04 §5.7`) |
| AB-3 | Split del import de `photography-metadata` para aligerar el bundle | cómo se importan los datos B6.7 | `import metadata from "./photography-metadata.json"` → carga diferida (`import()`) desde `place-images.ts` con registro síncrono de `identity` |
| AB-4 | 8 fallos de Vitest de línea base (`place-images.test.ts` ×5, `photography-depth.test.ts` ×3) y 3 de Phase 5A (A06, A07, E01), idénticos en la base | tests y gates de fotografía B6.7 | actualizar las expectativas «una sola fotografía» / `.gallery__image` única a los lugares con profundidad B6.7, y el texto de fallback de A07 |

## Resolución (F3–F4)

| Hallazgo | Estado final | Commit |
|---|---|---|
| P0-1 portada sin scroll | Corregido | `70789ef` (+ `960e0b7` test B18 citado) |
| P0-2 iconos `.icon-button--small` | Corregido | `f0c1de1` |
| P0-3 contador de ciudad (D-M1) | Corregido | `c6f9084` |
| P0-4a/b agrupación + 44 px | Corregido | `253bf7b`, `f4ffb7b` |
| P0-4c encuadre | **RESUELTO** (DDR-B24-1 → `DD-023`) | `b4d4e46` (abierta), cerrada en F6 |
| P0-4d solapes con ≤12 | **RESUELTO** (DDR-B24-2 → `DD-024`) | `b4d4e46` (abierta), cerrada en F6 |
| P0-5a filas | Corregido | `d54126d` |
| P0-5b contador vivo | Corregido | `7c74a82`, `3b4fd71` |
| P0-5c metadato | DEFERRED-ACTIVE-BRANCH (B23) | diff en P0-5c |
| P1-01…04 FilterSheet | Corregido | `057edd1` |
| P1-05 eyebrow onboarding | Corregido | `4c58e61` |
| P1-06 «zona» → «ciudad» | Corregido | `fca07f3` |
| P1-07 toasts D-M4 | Corregido | `c44dd80` |
| P1-08 «Misma zona» | Corregido | `c27d383` |
| P1-09 foco tras Escape | Corregido | `5ab0c0f` |
| P1-10 héroe D-M3 | Corregido | `37075e0` |
| P1-11 «Más destinos» | Corregido | `c84b3aa` |
| P1-12 panel anidado | Corregido | `c84b3aa` |
| P2-7 icono de expandir | Corregido | `6035179` |
| DDR-B24-3 volver desde colección | **RESUELTO** (→ `DD-025`) | `b4d4e46` (abierta), cerrada en F6 |

| Regresión propia de P1-01 (cabecera de filtros salta 7 px) | Corregido en F5 | `d901e03` (+ gate `3f7f3b9`) |

Gate B24 tras F4: **763/763**; tras F5 (con la comprobación de la cabecera): **795/795, 0 fallos**
en los 8 viewports. El mismo script sobre la base `4afbf50`: 429/721, 292 fallos.

## F6 — Cierre de DDR-B24-1/2/3 (dirección)

Dirección resolvió las tres DDR (`DD-023`, `DD-024`, `DD-025` en `09`). Implementación:

- **DDR-B24-1**: `lib/hub-view.ts` (nuevo) — encuadre editorial por hub (Tokio/Kioto/Osaka/
  Okinawa), fallback calculado sobre la mediana + radio 10 km. `FitHubBounds` (`PlaceMap.tsx`) deja
  de hacer `fitBounds` de todos los lugares del hub y sólo actúa cuando no hay ningún lugar
  seleccionado (para no competir con `FocusSelected`, que sigue ganando siempre que hay selección).
- **DDR-B24-2**: `MarkerLayer` (`PlaceMap.tsx`) aplica `groupScreenPoints` siempre, sin la condición
  previa `shouldGroupMarkers(visibleCount)` — la propia función ya sólo fundía parejas que se
  tocarían, así que cubre densidad (`03 §9`) y seguridad geométrica (Art. 11) con el mismo código.
- **DDR-B24-3**: `exploreReturnSurface` gana el valor `"home-collection"` (además de
  `"global-search"`); las comprobaciones que impedían el salto de hub pasan de mirar
  `=== "global-search"` a "cualquier valor no nulo". `ExplorerHome` etiqueta sus selecciones con
  ese valor.

**Regresión propia encontrada al implementar DDR-B24-1/2 y corregida.** `block19-grid-check.mjs`
(«el mapa conserva el zoom en todo el ciclo») dejó de pasar porque su lectura del zoom (la
transformación CSS de la primera capa de teselas) es sensible a una capa vieja sin podar cuando la
red de teselas no está disponible (entorno, `net::ERR_CERT_AUTHORITY_INVALID`) — el zoom real (leído
del `z` de las URLs de tesela pedidas, estable pase lo que pase con la red) nunca cambió. Se
corrigió el propio gate para leer esa señal fiable en vez de la CSS de una capa potencialmente sin
podar; también se cerró una segunda causa real: `FitHubBounds` competía con `FocusSelected` por la
vista mientras la ficha estaba abierta (ambas reaccionaban a `panelOffset`), así que ahora
`FitHubBounds` no actúa mientras hay un lugar seleccionado.

Gate B24 al cerrar F6: 873/875 (P0-4e y el «flake» de P1-FILTER). Ambos resueltos en F7, abajo.

## F7 — P0-4e corregido y cierre real de B24

- **P0-4e** — corregido (ver la entrada en P0; decisión normativa `DD-026`).
- **R-F7 — regresión propia de F6 encontrada en la regresión final y corregida.** Desde
  `5e76ef7`, `FitHubBounds` vuelve a encuadrar al cerrarse una ficha aunque el mapa esté oculto
  (otro destino activo, contenedor 0×0). `flyTo` de Leaflet divide por el tamaño del contenedor,
  calcula `LatLng(NaN, NaN)` y lanza; la excepción desmonta la app entera (pantalla en blanco).
  Lo encontró `b18-viaje-lugar-check` (Viaje › Dónde dormir › lugar cercano tras «Ver en el
  mapa»): pasa 38/38 en `6b100e5`, falla en `5e76ef7`, `035514b` y `9fba00f`; F6 no volvió a
  pasar ese gate. Arreglo: los movimientos programáticos sólo se animan si el mapa tiene tamaño
  (`canAnimate`); sin tamaño se aplica `setView` sin animación. 38/38.
- **P1-FILTER «primer chip sin marcar: centro fuera del viewport» (320×568)** — investigado:
  **carrera del gate**, no de la app ni regresión. La hoja entra con una animación de 320 ms; el
  gate medía dos fotogramas después de abrirla. Muestreado cada 40 ms a 320×568, el centro del
  primer chip pasa por y≈620 (fuera de una pantalla de 568) → 383 → … → 266 y se detiene al
  terminar la animación. Bajo la carga de la corrida completa, la medida caía a veces en el primer
  tramo. El gate ahora espera a que terminen las animaciones de la hoja (`getAnimations()`) antes
  de medir; la expectativa funcional no cambia.
- **Gate B24 tras F7: 1347/1347 y 1351/1351, 0 fallos**, en dos corridas completas de 8 viewports
  seguidas (el total varía en unas pocas comprobaciones porque el gate abre «hasta tres» grupos y
  sólo los que tienen el centro dentro del mapa; no hay ningún fallo en ninguna corrida).

## Qué no puede verificarse aquí

- Scroll táctil real (inercia, rebote, gestos del sistema) y teclado de iOS: **pendiente de
  validación humana en un iPhone real**. `synthesizeScrollGesture` de CDP no desplaza
  contenedores reales en Chromium headless y no se usa como evidencia.
- Teselas OSM: el contenedor no tiene red hacia `tile.openstreetmap.org`; las capturas del mapa
  muestran marcadores y controles sobre el fondo vacío.
