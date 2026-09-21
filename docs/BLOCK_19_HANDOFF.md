# Bloque 19 — B3 «Tarjeta y descubrimiento» — handoff

## Resumen

Implementa B3 del roadmap congelado (`10_ROADMAP_DE_BLOQUES.md`): `PlaceCard` (normal y
`compact`), `PlaceList`, la búsqueda de ciudad, `FilterSheet`, la presentación de categorías y los
estados vacíos. No toca B4 (galería/ficha/CreditsSheet), B5 (portada/mapa de Explorar), B6
(adquisición fotográfica/LQIP/`-400w`), B7 (Quiero ir), B8 (Nosotros) ni B9 (planner/`DayTimeline`)
— confirmado línea por línea en la sección «Confirmación explícita» al final de este documento.

- **Rama**: `claude/block-19-b3-card-discovery`
- **SHA inicial** (origin/main, punto de partida, PR #132 ya fusionado):
  `8eb725eeb836ca121180f8dd8b0dc49c65efae25`
- **SHA final**: el del commit que acompaña a este handoff (ver `git log -1` tras el commit; no
  se abre PR ni se fusiona, según instrucción explícita de cierre).
- **Commits**: uno o varios commits coherentes en esta rama, ninguno en `main`.

## Arquitectura

Superficies nuevas o reescritas:

| Componente | Estado | Qué hace |
|---|---|---|
| `PlaceCard.tsx` | reescrito | Anatomía completa de `04 §5`: overlay foto+scrim+nombre+categoría·zona, insignia sólo-S, corazón 40px/tap real ≥44×44, `PersonToken` de la otra persona, ≤2 chips con prioridad fija, variante `compact` en el mismo componente. |
| `PlaceList.tsx` | reescrito | Rejilla + carga progresiva de 12 en 12 (`IntersectionObserver`) + entrada «Dónde dormir» tras la 6ª tarjeta + `EmptyState`. |
| `FilterPanel.tsx` | reescrito | `FilterSheet`: grupos plegables en el orden fijo de `04 §13`, `ChipToggle` en vez de checkboxes, cabecera pegajosa con contador en vivo, pie fijo `Limpiar`/`Ver N lugares`. |
| `SearchSheet.tsx` | nuevo | Hoja casi a pantalla completa (`04 §12`) con resultados en vivo (`PlaceCard compact`), mismo `filters.query` que la lista principal. |
| `ChipToggle.tsx` | nuevo | `04 §3`: chip interactivo, `aria-pressed`, 40px visual + `.tap-target-min` real. |
| `PhotoPlaceholder.tsx` | nuevo | `04 §9`: trama diagonal 4%, icono de categoría 32px, nombre, `imageBrief` con `EvidenceMark`, etiqueta «Fotografía pendiente»/«No se pudo cargar la imagen». |
| `EmptyState.tsx` | nuevo | `04 §15`: icono 32px, título, frase, acción opcional. |
| `EvidenceMark.tsx` | nuevo | `04 §2`/`03 §1.4`: glifo `◼◧◇✎` + etiqueta, nunca color. Sólo `PhotoPlaceholder` lo usa en este bloque — no migra nada de `PlaceDetail` (eso es B4). |
| `lib/category-presentation.ts` | nuevo | Mapa de presentación categoría→(etiqueta colapsada, icono), 26 etiquetas desde 29 cadenas fuente. |
| `lib/traveller-presentation.ts` | extendido | `otherPersonMarker()` nuevo, junto al `interestMarker()` existente (que sigue usando `SelectionPanel.tsx` sin cambios). |
| `PersonToken.tsx` | extendido | Nuevo prop `label` opcional para sustituir el «Eres {nombre}» por defecto cuando el token representa a la OTRA persona, no a la activa (ver «Regresiones encontradas»). |
| `icons/Icon.tsx` | extendido | 26 iconos de categoría nuevos; `IconSize` gana `32` (mandatado por `04 §9`/`§15`). |
| `styles/discovery.css` | nuevo | Todas las reglas de las superficies de arriba, migradas a tokens directos (Art. 10) y extraídas a fichero propio (`08 §"Cómo tratar el CSS actual"`: superficie completamente migrada). |
| `App.css` | recortado | Se elimina la sección «Search + filters»/place-card/place-list antigua (566 líneas), sustituida por un comentario que apunta a `discovery.css`. |
| `App.tsx` | integración | `searchOpen`, `otherPersonMarkerFor`, `categoryGroups`, `activeHubHasZones`/`activeHubZoneCount`, disparador de `SearchSheet`, hilo de `onOpenDondeDormir`. |

## Preservación de filtros

Ningún valor, campo ni interpretación de filtro cambia — sólo la presentación:

| Filtro | Campo (sin cambios) | Cambio de presentación |
|---|---|---|
| Nivel de interés | `filters.grades` | Ninguno (ya era `ChipToggle`-like desde B17) |
| Categoría | `filters.categories` (29 valores fuente) | Se agrupa por las 26 etiquetas de `category-presentation.ts`; un chip activa/desactiva TODAS las cadenas fuente de su grupo a la vez |
| Duración | `filters.planningBlocks` | Ninguno |
| Reserva | `filters.reservation` (6 valores cerrados) | Ninguno |
| Afluencia | `filters.tourismLevels` | Renombrado de grupo («Nivel turístico» → «Afluencia»), mismo campo/valores |
| Joyas | `filters.hiddenGemStatuses` | Renombrado de grupo («Hidden gem» → «Joyas»), mismo campo/valores |
| Búsqueda libre | `filters.query` | Deja de filtrar in-situ; abre `SearchSheet`, mismo campo compartido |

`FilterPanel.test.ts` (sin tocar, 3/3 verde) protege los 6 valores/etiquetas de Reserva
literalmente.

## Categorías: fuente → presentación

`data/places.json` guarda 29 cadenas de categoría con emoji incrustado. Tres conceptos están
duplicados con emoji distinto (Gastronomía 🍜/🍶, Naturaleza 🌸/🌿, Cultura tradicional 🍵/🎭) —
`03 §8` autoriza colapsarlos SÓLO en presentación (OD-02 no bloquea B3). `category-presentation.ts`
produce exactamente 26 etiquetas; el dataset y `place.category` no se tocan en ningún punto.
Verificado por `block19-discovery-browser-audit.mjs` (cero emoji renderizado en la línea de
categoría·zona) y por el propio mapa (26 claves, contadas en `CATEGORY_PRESENTATION_LABELS`).

## PlaceCard — normal y compact

- **Normal**: 4:3 en `base`, 16:9 desde `sm` (600px). Nombre en `--type-title-m` (20/26); si a esa
  medida el texto no cabe en 2 líneas, baja a `--type-title-s` (17/24) — medido en el propio
  navegador (`useLayoutEffect`, comparando `scrollHeight`/`clientHeight`, no
  `-webkit-line-clamp`), nunca truncado con puntos suspensivos. Insignia «★ Imprescindible»
  SÓLO para grado S, sin color de fondo; A/B/C/D no muestran insignia (el nivel sigue disponible
  como texto accesible en el nombre del botón, para cualquier grado). Corazón: 40px visuales,
  ≥44×44 de área táctil real vía `.tap-target-min`, `aria-pressed`, animación al marcarse.
  `PersonToken` de la otra persona junto al corazón (nunca dentro), sólo cuando alguien más ha
  opinado. Chips: duración siempre primero; segundo chip por prioridad fija — aviso real (mismo
  criterio que el recuadro de febrero–marzo 2027, DD-011) > reserva obligatoria
  (`interpretPlaceReservation(place).category === "required"`) > joya escondida
  (`isHiddenGem`) — máximo 2, nunca más.
- **Compact**: mismo componente con `variant="compact"`, miniatura 72×72 `--radius-md`, nombre
  `--type-title-s` en una línea (elipsis), una sola línea de metadato. Usado en B19 sólo por
  `SearchSheet`; Quiero ir/planner/«Cerca de aquí» quedan fuera de alcance (B4/B7/B9), tal y
  como pide el encargo.
- **Fotografía múltiple**: sólo se muestra la primera imagen (identidad); si hay más de una, un
  contador informativo «N fotos» — nunca un carrusel ni un botón.

## PhotoPlaceholder

Sustituye tanto la ausencia de fotografía como el fallo de carga (`variant="missing"` /
`variant="error"`), con la etiqueta correspondiente («Fotografía pendiente» / «No se pudo cargar
la imagen»). No usa ni el emoji de categoría del dataset ni el icono roto del navegador. No se
tocó nada de la adquisición fotográfica, `photography-metadata.json`, LQIP ni derivados `-400w`
(B6 sigue intacto).

## Búsqueda

`SearchBar` conserva el único campo de 48px de B18 (`[Buscar en Tokio][Filtros②][Mapa]`); tocarlo
ahora abre `SearchSheet` (hoja casi a pantalla completa) en vez de filtrar in-situ. Mismos datos y
misma lógica: `results` es literalmente `filteredPlaces` (el mismo array que ya alimenta la lista
principal, que ya incluye `filters.query`) — no hay una segunda pasada de búsqueda ni un algoritmo
nuevo. Estado vacío con el copy exacto de `05 §4`: `Nada con "{query}" en {ciudad}. Prueba en otra
ciudad o quita los filtros.` Foco/Escape/trampa de foco/retorno al disparador los hereda de `Sheet`
sin cambios; el campo roba el foco inicial de `Sheet` (que por defecto enfoca su botón `×`) con un
`requestAnimationFrame` en un efecto hijo, que corre después del efecto del padre en el mismo
commit.

## FilterSheet

Grupos plegables en el orden fijo `04 §13`: Nivel de interés · Categoría · Duración · Reserva ·
Afluencia · Joyas. Cabecera pegajosa con contador en vivo («57 lugares»); pie fijo `Limpiar`
(quiet) + `Ver N lugares` (primary, ancho completo). Ambos usan `position: sticky` dentro del
único scroll de `Sheet` (`.sheet__body`), sin anidar un segundo contenedor con scroll propio.

## Carga progresiva (12×12)

`PlaceList` renderiza `Math.min(visibleCount, places.length)` tarjetas, con `visibleCount`
arrancando en 12 y creciendo de 12 en 12 vía `IntersectionObserver` sobre un `<li>` centinela.
El reinicio de la ventana al cambiar de ciudad/filtro/búsqueda es un ajuste de estado durante el
render (comparando la referencia de `places`, que `App.tsx` memoiza con `useMemo`), no un efecto —
evita el parpadeo de una ventana vieja seguida de la reiniciada y el aviso `set-state-in-effect`
de `oxlint`. Verificado en navegador: primer render ≤12, crece con el scroll hasta 57 (todo el
catálogo de Tokio), nunca duplica, nunca reordena.

## «Dónde dormir»

Entrada de navegación (no una `PlaceCard` falsa) insertada tras la 6ª tarjeta en las ciudades con
zonas modeladas (`HUBS_WITH_ZONES`, la misma lista que ya gobierna el selector de ciudad de B18).
No participa en filtros, contador de resultados, orden del dataset ni paginación de 12 en 12 — es
una fila más de la lista cuya presencia/posición depende sólo de la ciudad activa. Lleva a
Viaje › Dónde dormir con la ciudad preseleccionada, reutilizando `goToZones` (mecanismo B18
existente).

## Contraste fotográfico

Gate reproducible: `scripts/block19-contrast-check.mjs`. Identifica las 10 imágenes de catálogo
más claras en la banda inferior (donde vive el nombre), lee el degradado `--scrim-bottom`
REALMENTE aplicado (del `background-image` calculado de una `.place-card__overlay` viva, nunca
reescrito a mano) y la posición vertical real del nombre, compone cada candidata con ese
degradado en la franja del nombre, y mide el contraste WCAG de blanco sobre el resultado.

**Resultado: 20/20 mediciones ≥ 4.5:1** (10 imágenes × 2 puntos de muestreo cada una — el techo de
la caja del nombre, el peor caso, y su punto medio). La imagen más clara del catálogo
(`furuzamami-beach-800w.webp`) mide 4.72:1 en el peor caso, con margen sobre el mínimo. Ninguna
fotografía individual se ajustó para pasar el gate — el margen ya lo da el sistema de tarjeta.

## Responsive

`b18-responsive-check.mjs` (320/360/390/430/820/839/840/841/1200/1440/1600px): sin overflow
horizontal en ningún ancho, TabBar/NavRail mutuamente excluyentes en todos. Incluye la corrección
de rejilla descrita abajo.

## Accesibilidad

- Corazón: `aria-pressed`, ≥44×44 de área táctil real, nunca sólo color (icono relleno/hueco).
- `PersonToken` de la otra persona: nunca sólo color — inicial dentro del círculo +
  `aria-label`/`title` explícitos (corregidos para decir «{nombre} quiere ir» en vez de «Eres
  {nombre}», ver regresiones).
- `ChipToggle`: `aria-pressed`, operable por teclado (Enter/Space vía `<button>` nativo),
  `.tap-target-min` para el área táctil real pese a los 40px visuales.
- `EmptyState`/`PhotoPlaceholder`: `role="status"`/`role="img"` con `aria-label` describiendo el
  estado.
- `b18-a11y-check.mjs`: 23/23 verde (sin cambios de comportamiento respecto a B18).

## Rendimiento

- `loading="lazy"` en todo salvo la primera tarjeta visible de una lista, que lleva
  `fetchPriority="high"` sin `loading` (`06 §6.3`) — implementado con un prop `priority` en
  `PlaceCard`, hilado desde `PlaceList` (`priority={index === 0}`). Confirmado en el DOM real:
  la primera tarjeta pide `fetchpriority="high"`, el resto `loading="lazy"`.
- `width`/`height` declarados en todo `<img>`; `sizes` actualizado a la geometría real de B19
  — incluida la corrección de `sm`+ (ver regresiones) para que el panel de 372px fijos de `md`+
  no siga anunciando `50vw`.
- `decoding="async"` en todo.
- Bytes medidos con Playwright (`resourceType`, sin caché) navegando Tokio (57 lugares):
  - Carga inicial del shell (JS+CSS+datos, una vez): JS 1.42MB / CSS 117KB / datos (`fetch`)
    1.33MB — sin cambios de B19 en el bundle de datos; CSS crece ~sin cambio neto significativo
    tras extraer y recortar `App.css`.
  - Entrar en Tokio (primeras 12 tarjetas): ~317KB de imagen.
  - Navegar toda la ciudad (scroll hasta las 57): ~1.9MB adicionales de imagen — total de imagen
    por ciudad completa ≈ 2.16MB.
  - No se implementa LQIP ni derivado `-400w` (B6): si el presupuesto de imagen por ciudad debe
    bajar de los ~2.16MB medidos aquí, ese trabajo depende explícitamente del pipeline de B6 —
    no se adelanta aquí.
- Sin CLS: `width`/`height` reservan la caja antes de que lleguen los bytes; el nombre a dos
  niveles de tamaño se decide en `useLayoutEffect` (antes del pintado), no tras él.

## Regresiones encontradas y corregidas

1. **Rejilla de 2 columnas rota en `md`+ (840px+)**: `05 §4` fija "2 columnas desde `sm`" pensando
   en una lista a todo el ancho del viewport. Desde `md` (840px) el shell de B18 confina la lista
   a un panel lateral de 372px FIJOS para siempre (nunca vuelve a crecer con el viewport) — dos
   columnas ahí caían a ~172px cada una, y el nombre a dos líneas + la línea de categoría·zona ya
   no cabían en la altura 16:9 resultante, desbordando por encima de la fotografía e invadiendo
   la tarjeta anterior (rompía los clics reales, no sólo el aspecto visual). Corregido con un
   segundo `@media (min-width: 840px)` que revierte a 1 columna — misma técnica `min-width` que ya
   fija ese ancho (Art. 8, sin `max-width` nuevo). Verificado: `b18-responsive-check.mjs` pasa en
   los 11 anchos, incluido el punto de quiebre exacto (839/840/841px).
2. **`sizes` desactualizado para `md`+**: corregido en el mismo cambio, para que el navegador deje
   de pedir ~50vw de ancho de imagen en un panel que en realidad mide 372px fijos.
3. **`PersonToken` con texto accesible incorrecto para la otra persona**: el componente existía
   sólo para la identidad de la persona activa en la cabecera («Eres {nombre}»); B19 es el primer
   uso que lo hace representar a alguien QUE NO ES la persona activa (`04 §5.5`), donde «Eres
   {nombre}» es la frase equivocada. Se añadió un prop `label` opcional que sustituye el
   `aria-label`/`title` por defecto; `PlaceCard` pasa «{nombre} quiere ir» (misma voz que
   `interestMarker`'s «{quién} quiere ir»).
4. **Ninguna regresión de comportamiento real en scroll/apertura de ficha**: la falla inicial de
   `b18-regression-check.mjs` («volver desde la ficha restaura la posición de scroll») era un
   artefacto del propio script — clicaba `.place-card__open` `.first()` tras desplazar la lista
   260px, y con las tarjetas más altas de B19 esa primera tarjeta queda fuera de vista, así que
   Playwright la desplazaba de vuelta antes de poder pulsarla (`scrollIntoViewIfNeeded`, parte de
   su comprobación de "accionable"). Confirmado contra un worktree del SHA base
   (`8eb725e`, sin ningún cambio de B19): el mismo patrón de clic también "rompe" el scroll ahí en
   cuanto se usa un elemento fuera de vista — no es un comportamiento nuevo de la app. El script se
   corrigió para pulsar una tarjeta que sigue completamente dentro del viewport tras el scroll
   (como haría una persona real), y ahora pasa 40/40.

## Deuda diferida a B20+

- `sizes`/sizing sigue sin LQIP ni derivado `-400w` — depende de B6.
- La variante `compact` sólo se usa en `SearchSheet`; Quiero ir/planner/«Cerca de aquí» siguen con
  su anatomía anterior — migrarlos es B4/B7/B9.
- El presupuesto de imagen por ciudad completa (~2.16MB medidos) sólo puede bajar de forma
  sistémica con el pipeline de B6.
- `scripts/b17-regression-check.mjs` sigue apuntando a selectores anteriores a B18
  (`.view-bar__filters`, `#app-filter-sheet.app__filters--open`) — ya estaba obsoleto tras la
  consolidación de cromo de B18, antes de que empezara este bloque; no se ha tocado porque está
  fuera del alcance de B19 y la cobertura de regresión vigente (`b18-regression-check.mjs` +
  `block19-discovery-browser-audit.mjs`) ya lo sustituye.

## Confirmación explícita: B4/B5/B6/B7/B8/B9 no se han implementado

- **B4** (galería/ficha, `CreditsSheet`, reordenación interna de `PlaceDetail`): `PlaceDetail.tsx`
  y `PlaceGallery.tsx` no se tocan en este bloque — sólo `EvidenceMark.tsx` nace aquí porque
  `PhotoPlaceholder` lo necesita, pero no migra ningún dato práctico de la ficha (eso sigue siendo
  B4, explícitamente).
- **B5** (portada nueva de Explorar, rediseño de mapa/tiles/marcadores): `PlaceMap.tsx` no se toca;
  el mapa de la ciudad sigue exactamente igual que al cierre de B18.
- **B6** (adquisición fotográfica, `role` en `photography-metadata.json`, LQIP, derivado `-400w`,
  cambios al pipeline de adquisición): ningún script de `scripts/*photography*` ni
  `photography-metadata.json` se toca; sólo se usan imágenes/derivados ya existentes.
- **B7** (nuevo «Quiero ir»): `SelectionPanel.tsx` no se toca — sigue usando `interestMarker()` y
  su propio marcado, sin ningún cambio.
- **B8** (nuevo «Nosotros»): ningún fichero de Nosotros se toca.
- **B9** (`DayTimeline`, nuevo planner): `OrderedSequenceBuilder.tsx`/planner no se tocan.

## Verificación final

- `npx tsc -b`: limpio.
- `npm run lint` (`oxlint`): limpio.
- `npx vitest run`: **94 ficheros de test, 3272 pruebas, todas en verde.**
- `npx vite build`: limpio (mismo aviso preexistente de chunk >500kB, sin cambios de B19).
- Gates de navegador, todos en verde contra un build de producción real (`vite preview`):
  - `b18-chrome-check.mjs`: 6/6
  - `b18-a11y-check.mjs`: 23/23
  - `b18-responsive-check.mjs`: sin overflow en 11 anchos, TabBar/NavRail excluyentes
  - `b18-regression-check.mjs`: 40/40 (actualizado para la búsqueda ahora en `SearchSheet` y la
    corrección de metodología de scroll descrita arriba)
  - `b18-viaje-lugar-check.mjs`: 38/38
  - `b18-browser-back-check.mjs`: 15/15
  - `block19-discovery-browser-audit.mjs` (nuevo, gates permanentes de `04 §13`): 30/30
  - `block19-contrast-check.mjs` (nuevo, gate de contraste fotográfico): 20/20 mediciones ≥4.5:1
- Capturas de pantalla: `scripts/block19-capture.mjs`, en 390×844/840×900/1440×900, de las 8
  superficies pedidas (Tokio con tarjetas v2, mezcla foto/placeholder, grados S y A juntos,
  `PersonToken` junto al corazón, búsqueda con resultados compactos, `FilterSheet`, estado vacío
  de búsqueda y de filtro, «Dónde dormir»).

## `DESIGN DECISION REQUIRED`

Ninguna. Las dos ambigüedades reales encontradas se resolvieron con la autoridad normativa ya
existente, no inventando lenguaje visual nuevo:

- El tamaño de icono 32px (`PhotoPlaceholder`/`EmptyState`) no estaba en la lista de `03 §8`
  (16/20/24), pero `04 §9`/`§15` ya lo fijan por nombre para esos dos componentes exactos — se
  trató como una extensión de un tipo de ingeniería (`IconSize`), no como una decisión visual
  nueva.
- La colisión entre "2 columnas desde `sm`" (`05 §4`) y el panel de 372px fijos de `md`+ (B18) se
  resolvió con la misma técnica `min-width` que B18 ya usa para fijar ese ancho — geometría, no
  una decisión de diseño nueva.

---

# Corrección de B19 — la rejilla responde a su contenedor (DD-016)

**Fecha:** 2026-09-21 · **Rama:** `claude/block-19-b3-card-discovery`

## Qué deroga de este mismo documento

Lo que arriba se llamó «Regresión 1» y se despachó como «geometría, no una decisión de
diseño nueva» **no era geometría: era la decisión equivocada**. Revertir a una columna
desde `md` hacía aritméticamente imposible lo que `05 §4` pide literalmente («`md`:
2 columnas + ficha como panel derecho de 480 px»), y lo hacía porque daba por bueno el
panel de 372 px fijos que B18 había instalado. El diagnóstico del desbordamiento era
correcto; la conclusión, no. Quedan derogados los puntos 1 y 2 de «Regresiones» y la
última viñeta de «Decisiones tomadas dentro del margen de ingeniería».

## Qué se ha hecho en su lugar

Ver `docs/design/09_DECISIONES_DE_DISENO.md` § DD-016 para la decisión completa. En
resumen:

- **La lista es la superficie primaria.** El raíl derecho mide `min(480 px, 50 %)` y la
  lista se queda con el resto. Se acabó el panel de 372 px fijos.
- **Las columnas las decide el contenedor**, con `@container` sobre `.app__sidebar`
  (`container-name: lista-explorar`), acotadas por los topes de `02 §D5`
  (`base` 1 · `sm` 2 · `md` 2 · `lg` 2 · `xl` 3) y por el mínimo de 264 px de `PlaceCard`.
- **El mapa persistente empieza en `lg`**, no en `md`, como `02 §D5` y `05 §4` decían
  desde el principio. En `md` el mapa vuelve a ser la superficie conmutada que ya era en
  teléfono, con el control Lista/Mapa que hasta ahora no hacía nada a esos anchos. El
  control se retira en `lg`+, donde ya no tiene nada que conmutar.
- **La proporción sigue al número de columnas** (4:3 con una, 16:9 con dos o más), no al
  breakpoint.
- **Cero `text-shadow`** (`03 §5`): la banda de texto lleva su propio suelo de scrim, con
  el mismo valor que `--scrim-bottom` declara en su parada inferior. Ningún token nuevo.
- **`panelOffset`** pasa de colgar de `md` a colgar de `lg`, y `PlaceMap` no mueve el mapa
  cuando la ficha lo cubre entero — ver DDR-01 más abajo.

## Comportamiento verificado

`app/scripts/block19-grid-check.mjs` (35/35) mide los seis casos normativos:

| Viewport | Ficha | Columnas | Tarjeta más estrecha | Proporción | Raíl |
|---|---|---|---|---|---|
| 360 | cerrada | 1 | 336,0 px | 4:3 | 0 px (0 %) |
| 600 | cerrada | 2 | 282,0 px | 16:9 | 0 px (0 %) |
| 840 | cerrada | 2 | 357,5 px | 16:9 | 0 px (0 %) |
| 840 | **abierta** | **1** | 351,0 px | **4:3** | 376 px (50,0 %) |
| 1200 | cerrada | 2 | 297,5 px | 16:9 | 480 px (43,2 %) |
| 1600 | cerrada | 3 | 327,7 px | 16:9 | 480 px (31,7 %) |

Mapa en `lg`/`xl`, ciclo completo (antes de abrir → ficha abierta → después de cerrar):
caja 480×796 sin cambio, `transform` del lienzo idéntica, capa de teselas sin cambio, 57
marcadores en los tres momentos y exactamente 1 marcador seleccionado con la ficha
abierta. `text-shadow` calculado distinto de `none` en `.place-card` y descendientes: 0.

`app/scripts/block19-contrast-check.mjs`, reescrito para medir **píxeles realmente
compuestos** (sustituye la fotografía, oculta el texto, captura y lee el resultado) en
toda la banda de texto y en los dos regímenes de proporción:

| Régimen | Banda | Scrim efectivo | Nombre (blanco) | Categoría·zona (blanco 82 %) |
|---|---|---|---|---|
| 390 · 1 col · 4:3 | 59,4 px de 273,0 px (22 %) | 0,889–0,944 | ≥14,08:1 | ≥9,97:1 |
| 1200 · 2 col · 16:9 | 85,4 px de 166,2 px (51 %) | 0,811–0,935 | ≥12,78:1 | ≥9,15:1 |

Mínimos exigidos: scrim 0,60 y contraste 4,5:1, sobre las 10 fotografías más claras del
catálogo.

## Contradicción registrada, no improvisada

`05 §5` pide conservar `panelOffset` en `lg`+ («el panel no oculta el marcador
seleccionado en el mapa»), lo que presupone un raíl más ancho que la ficha. La fórmula de
cabida fija el raíl en exactamente una ficha de ancho, así que la ficha lo cubre entero y
no queda marcador que salvar. No se ha inventado una arquitectura para taparlo: está
escrito como **DDR-01** en `09_DECISIONES_DE_DISENO.md` § DESIGN DECISION REQUIRED, con
las tres salidas posibles y quién puede elegirlas. El mecanismo de `panelOffset` sigue
intacto y operativo.

## Fallos preexistentes encontrados al correr las auditorías (no son de esta corrección)

Tres gates antiguos fallan **idénticamente** en `b82451a` (el SHA de partida) y en esta
rama, por esperar marcado que B18/B19 ya habían sustituido:

| Gate | Espera | Estado |
|---|---|---|
| `b17-regression-check.mjs` | `.view-bar__filters` | Roto desde B18 (la barra única lo sustituyó) |
| `b17-tap-target-check.mjs` | `.app__help` | Roto desde antes de B19 (el elemento no existe) |
| `block1-ux-browser-audit.mjs` | `.interest-badge__label` en `.place-card` | Roto desde B19 (`PlaceCard` v2) |
| `block2-photography-browser-audit.mjs` | `.view-bar__filters` | Roto desde B18 |
| `phase5a-rc-browser-audit.mjs` | `.selection-panel__toggle` | Roto desde antes de B19 |

Comprobado construyendo `b82451a` en un worktree aparte y corriendo cada gate contra los
dos builds. **No se han tocado**: actualizarlos es trabajo de otro bloque, y hacerlo aquí
habría mezclado dos cosas distintas en el mismo diff.
