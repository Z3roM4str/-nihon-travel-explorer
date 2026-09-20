# Block 18 (design roadmap "B2" — Shell de navegación) — handoff

Escrito para que la siguiente sesión, o un auditor, pueda continuar sólo desde GitHub y este
repositorio. Nada aquí depende de la conversación que lo produjo. Numeración: este es el
**Bloque 18** en la secuencia real del proyecto; `docs/design/10_ROADMAP_DE_BLOQUES.md` lo llama
"B2" por brevedad sólo dentro de ese documento.

## Identidad

| | |
|---|---|
| Rama | `claude/fervent-ritchie-9li8nf` |
| SHA inicial (`origin/main`) | `0833912c308fb28f203b69eaae716f5b566f7936` |
| SHA final | ver `git log -1` en esta rama tras el commit de este bloque |
| ¿Fusionado a `main`? | No. No se ha abierto pull request (no se pidió). |
| Estado del Bloque 18 | **Cerrado**, tras una corrección de cumplimiento normativo (ver más abajo). Las 12 puertas de la sección "Gates" están en verde. |

**Este handoff fue corregido tras una auditoría independiente que encontró cuatro incumplimientos
en el primer cierre.** El registro de abajo es el estado corregido y final; la sección
"Corrección de cumplimiento normativo (auditoría posterior al cierre)" documenta exactamente qué
estaba mal y cómo se arregló. Nada de lo que hay por encima de ese apartado debe leerse como una
descripción del primer cierre, no conforme — todas las cifras y descripciones de este documento
son posteriores a la corrección.

## Preflight (antes de cualquier cambio)

- `git fetch` confirmó `origin/main` = `0833912c308fb28f203b69eaae716f5b566f7936`, exactamente el
  SHA exigido.
- Working tree limpio; la rama designada de esta sesión ya existía, ramificada exactamente desde
  ese commit (mismo SHA, cero commits propios todavía).
- `docs/BLOCK_17_HANDOFF.md` presente en `origin/main`.
- Los 12 documentos de `docs/design/` presentes y leídos en el orden pedido: `README`, `00`, `02`,
  `03`, `04`, `05`, `08`, `09`, `10`, más `docs/BLOCK_17_HANDOFF.md`. (`01`, `06`, `07` no citan
  nada que B18 necesitara y no se citan abajo.)

No se necesitó ningún `DESIGN DECISION REQUIRED`. Todas las decisiones de este documento citan el
documento y la sección que las respalda; donde los documentos congelados callaban sobre un
detalle de implementación, la decisión se tomó bajo `08 §"Lo que ingeniería decide libremente"` y
se señala explícitamente más abajo.

## Objetivo cumplido

Recuperar la pantalla convirtiendo "una pantalla y seis modales" (Explorer + overlays de Quiero
ir, planificador, zonas, análisis, respaldo, gestor de viajeros) en **cuatro destinos
permanentes** — Explorar · Quiero ir · Viaje · Nosotros — con `TabBar` en teléfono y `NavRail`
desde `md` (840px). Confirmado al final: cromo superior 330px → **104px** en Explorar › Ciudad;
cromo total (+ `TabBar`) **160px**, dentro del límite de 168px del Art. 8. Ninguna capacidad de
v1.1.0 se ha eliminado; todas están re-ubicadas según la tabla de `02
§"Qué se conserva y adónde va"` (ver la sección "Mapa de capacidades" más abajo).

## Arquitectura elegida

- **Los cuatro paneles de destino están siempre montados.** `App.tsx` renderiza los cuatro
  (`Explorar`, `Quiero ir`, `Viaje`, `Nosotros`) en todo momento dentro de `.app__content`, y usa
  el atributo HTML nativo `hidden` (no una clase con `display:none` a mano, no desmontar/montar)
  para mostrar sólo el activo. `hidden` saca al panel del árbol de accesibilidad y del orden de
  tabulación de verdad — verificado en `scripts/b18-a11y-check.mjs`, no sólo declarado — y
  como nada se desmonta, el estado interno de cada destino (ciudad activa, filtros, `Lista`/
  `Mapa`, lugar abierto, sección de Viaje, scroll) sobrevive intacto al cambiar de pestaña (`02
  §D3`). Es la decisión de ingeniería más importante de este bloque: convierte "conservar
  estado al cambiar de pestaña" de una responsabilidad de lógica a una garantía estructural del
  DOM.
- **La ficha de lugar se apila dentro del destino que la abre — Explorar o Quiero ir, cada uno
  con su propia profundidad** (`02 §"Mapa completo de pantallas"`: "Quiero ir └── Lugar · misma
  ficha que en Explorar"; `02 §D3`). `selectPlace(id, origin)` recibe qué destino la abre;
  `ficheOrigin` (estado, no derivado) decide en cuál de los cuatro paneles se monta el único
  `placeDetailOverlay` compartido, y sólo cuando `origin === "explorar"` se toca `view`/
  `filters`/`destination` de Explorar — abrir un lugar desde Quiero ir nunca navega a Explorar
  ni muta su hub/lista/mapa en segundo plano. `pushPlace`/`goBack` (saltos "cerca de aquí" y
  volver) heredan la misma regla. El contenedor sigue siendo el mismo `.app__detail` de siempre
  (`position:fixed; inset:0` en `base`, panel absoluto de 420px — ahora `var(--panel-width)` —
  desde `md`); lo que cambia es dónde se monta, no cómo se ve. Ver "Corrección de cumplimiento
  normativo" para el detalle del error original y su arreglo.
- **`ViajeSection`** (para "Viaje", cuya doble sección `05 §7`/`§8` no aparece en `02` como una
  ruta con "Lugar" propia) sigue resolviéndose siempre a Explorar cuando `ZoneComparison` abre un
  lugar guardado — ver la nota de decisión abierta en "Corrección de cumplimiento normativo".
- **El planificador y la comparación de zonas pasan de "dos overlays mutuamente excluyentes
  coordinados a mano" a "dos secciones de un único enum, mutuamente excluyentes por
  construcción".** `ViajeSection = "planificar" | "dormir"` sustituye a los booleanos
  `sequenceBuilderOpen`/`zonesOpen`. La invariante de un solo escritor del borrador de
  planificación (Bloque 4) se conserva exactamente — los dos siguen escribiendo
  `nihon.manualPlanningDraft` — sólo cambia el mecanismo que impide que compitan.
- **Cinco superficies dejan de ser modales globales de navegación** (gate 11 §11):
  `SelectionAnalysis`, `OrderedSequenceBuilder`, `ZoneComparison`, `TravellerManager`,
  `TripBackup`. Las cinco reciben una prop `embedded?: boolean` (por defecto `false`, así que su
  comportamiento de modal sigue existiendo si algún día se necesita fuera de este shell): cuando
  es `true`, cada componente omite su scrim, su `role="dialog"`/`aria-modal`, su trampa de foco y
  su cierre por `Escape` — nada de eso tiene sentido para contenido que nunca deja de estar en
  pantalla. El contenido interior (JSX, lógica, cálculo) es **byte a byte el mismo**; sólo cambia
  el contenedor. Los botones `×` que quedaban sin destino claro al dejar de ser modal se
  resolvieron caso a caso: `OrderedSequenceBuilder` ahora alterna a «Dónde dormir» (simetría con
  el `×` de `ZoneComparison`, que ya volvía a «Planificar»); `TravellerManager`/`TripBackup` — que
  no tienen una sección hermana a la que volver dentro de Nosotros — ocultan su `×` cuando
  `embedded`, ya que «cerrar» no tiene un destino con sentido cuando el contenido no se puede
  descartar.
- **`Sheet`** (`04 §8`) es un componente nuevo y genérico: hoja inferior con `sheet-rise`, asa,
  cabecera con título + `×`, `Escape`/backdrop-click cierran, trampa de foco, `role="dialog"`.
  Sustituye dos construcciones ad hoc distintas que hacían lo mismo con menos disciplina: la
  hoja de filtros (que antes tenía su propia `div.app__filters`/`.app__filters-bar`) y el nuevo
  selector de ciudad. En `md`+ se renderiza centrada en vez de como panel lateral — `04 §8` dice
  que un panel lateral de 420px "puede" ser la variante de escritorio, no que deba serlo; con el
  presupuesto de este bloque, un diálogo centrado cumple el mismo contrato (mismo componente,
  misma API) sin inventar una segunda geometría.
- **`PersonToken`** (`04 §1`) sustituye al conmutador «Eres» en la cabecera (DD-007). Círculo de
  24px, inicial del nombre, `variant="a"|"b"` resuelto por quien llama según el orden real de
  creación de los viajeros (no por el `id` opaco, que `lib/travellers.ts` deja explícitamente sin
  significado posicional). Es un botón real — no un indicador decorativo — que navega a
  `Nosotros › Viajeros`.
- **`TabBar`/`NavRail`** (`04 §10`) comparten un único inventario de los cuatro destinos
  (`AppNav.tsx`), así que no pueden desincronizarse en nombre u orden. Ambos están siempre
  montados; el CSS decide cuál se ve con un único breakpoint (`min-width: 840px`, el token `md`
  de `02 §D5`) — verificado en 320/360/390/430/820/839/840/841/1200/1440/1600 que nunca aparecen
  los dos ni ninguno.
- **`MlitAttribution.tsx`** extrae el párrafo de atribución (antes incrustado dos veces, una en
  el mapa nacional) a un componente único, para que el texto detrás del nuevo `ⓘ` del mapa y el
  de `Nosotros › Fuentes y licencias` sean literalmente el mismo nodo de React (Art. 4: el texto
  de la fuente no se parafrasea).
- **`.app__content`** es un `div` nuevo, sin contraparte visual, cuyo único trabajo es ser el
  contenedor flex que da sentido a `flex:1` en `.destination-panel`. Se documenta aquí porque su
  ausencia fue el bug más caro de este bloque (ver "Problemas encontrados").

## Mapa de capacidad antigua → nueva ubicación

| Capacidad v1.1.0 | Antes | Ahora |
|---|---|---|
| Selector de hub | Barra `.hub-bar` permanente | Sheet «Elegir ciudad», abierta desde el título de la cabecera (`.app__title--expand`) |
| Lista/Mapa | Segmented control en `.view-bar` | Un botón (`.explorer-bar__pane`) cuya etiqueta cambia, en la barra única de 48px |
| Búsqueda | Campo dentro de `FilterPanel`, duplicado móvil/escritorio | Campo visible siempre en la barra única (`FilterPanel` se abre con `showSearch={false}`) |
| Filtros | `.app__filters` (sheet ad hoc) | `Sheet` genérico con `FilterPanel` dentro |
| «Dónde dormir» (acceso desde ciudad) | Icono de cama sin etiqueta en `.hub-bar` | Fila con etiqueta completa dentro del Sheet «Elegir ciudad» (`.city-sheet__zones`) |
| Panel «Quiero ir» | Barra inferior colapsable, cromo global | Contenido permanente de la pestaña «Quiero ir» (`SelectionPanel` con `open` por defecto `true`) |
| «Analizar selección» | Modal de pantalla completa (`SelectionAnalysis`) | Sección desplegable embebida dentro de «Quiero ir» (`embedded`) |
| Planificador (`OrderedSequenceBuilder`) | Overlay de pantalla completa | Contenido de «Viaje › Planificar» (`embedded`) |
| Comparación de zonas (`ZoneComparison`) | Overlay de pantalla completa | Contenido de «Viaje › Dónde dormir» (`embedded`) |
| Gestor de viajeros (`TravellerManager`) | Modal centrado | Contenido de «Nosotros › Viajeros» (`embedded`) |
| Respaldo JSON (`TripBackup`) | Modal centrado | Contenido de «Nosotros › Copia del viaje» (`embedded`) |
| Conmutador «Eres» (`TravellerBar`) | Fila permanente en la cabecera | Movido (sin cambios internos) a «Nosotros › Viajeros»; la cabecera lleva `PersonToken` |
| Onboarding reabrible | Botón «?» en la cabecera | Botón «Ver de nuevo» en «Nosotros › Cómo funciona Nihon» |
| Aviso MLIT | Franja permanente bajo el mapa nacional | Botón `ⓘ` sobre el mapa (`Sheet`) + texto íntegro en «Nosotros › Fuentes y licencias» |
| Ficha de lugar | Panel dentro de `.app__body`, sin cubrir el cromo en teléfono | Pantalla completa en teléfono (`position:fixed`, por encima de todo); panel de 420px sin cambios desde `md` |

## Archivos

**Nuevos**

| Fichero | Qué es |
|---|---|
| `app/src/lib/destination.ts` | El tipo `Destination` y su orden canónico, consumido por `AppNav.tsx` y `App.tsx`. |
| `app/src/components/AppNav.tsx` | `TabBar` y `NavRail`, un único inventario de ítems. |
| `app/src/components/PersonToken.tsx` | `04 §1`. Sustituye al conmutador «Eres». |
| `app/src/components/Sheet.tsx` | `04 §8`. Hoja inferior genérica, usada por filtros y selector de ciudad. |
| `app/src/components/MlitAttribution.tsx` | El párrafo de atribución MLIT, una sola fuente para el mapa y para Nosotros. |
| `app/src/block18-shell.test.ts` | Guardas permanentes de este bloque (25 tests): cuatro destinos, cromo, retirada de «Eres», ficha completa, las cinco superficies embebidas, `hidden` real, MLIT, cero `@media(max-width)` nuevo. |
| `app/scripts/b18-chrome-check.mjs` | Gate 11 §1/§2: cromo ≤112/168px a 390×844; cabecera sin overflow en 320/360/390/430. |
| `app/scripts/b18-responsive-check.mjs` | Gate 12 + gate 4: overflow horizontal y transición exacta `TabBar`↔`NavRail` en 840px, en 11 anchos. |
| `app/scripts/b18-regression-check.mjs` | Auditoría funcional (punto 14) contra un build real: 31 comprobaciones. |
| `app/scripts/b18-a11y-check.mjs` | Punto 13: áreas táctiles reales ≥44px, `aria-current`, `prefers-reduced-motion`, `hidden` real en el orden de foco. |
| `app/scripts/b18-capture.mjs` | Evidencia visual (punto 15): 5 superficies × 2 viewports. |

**Modificados** (16 ficheros; `+1517 −959` líneas)

| Fichero | Qué cambió |
|---|---|
| `App.tsx` | Reescritura del shell: estado `destination`, `ViajeSection`, `citySheetOpen`, cabecera consolidada, barra única, `Sheet`s, los cuatro paneles con `hidden`, MLIT vía botón. `matchesFilters`, el vocabulario de grados y toda la lógica de filtrado/selección/travellers quedan intactos. |
| `App.css` | Ver "CSS" abajo. |
| `components/FilterPanel.tsx` | `showSearch?: boolean` para no duplicar el campo de búsqueda que ahora vive en la barra única. |
| `components/NationalExplorer.tsx` | El párrafo MLIT se sustituye por un botón `ⓘ` + `Sheet` con `MlitAttribution`. Geometría, navegación región/prefectura/hub y teselas: sin cambios. |
| `components/SelectionAnalysis.tsx`, `OrderedSequenceBuilder.tsx`, `ZoneComparison.tsx`, `TravellerManager.tsx`, `TripBackup.tsx` | Prop `embedded` (ver "Arquitectura elegida"). Cero cambios en cálculo, contenido o copy. |
| 6 ficheros de test (`block1-ux`, `block17-design-foundation`, `bundle-architecture`, `DivergenceView`, `TravellerLayer`, `ZonePlanSection`, `lib/onboarding`) | Actualizados para reflejar la nueva estructura de `App.tsx`/componentes que ellos mismos escanean (ver "Tests" abajo) — cada cambio cita el documento/sección que lo justifica en su propio comentario. |

**No tocados en absoluto**: `data/`, `scripts/` Python, `PlaceCard.tsx`, `PlaceDetail.tsx`,
`PlaceGallery.tsx`, `PlaceList.tsx`, `PlaceMap.tsx`, `NationalMap.tsx`, `HubSelector.tsx` (salvo
su nuevo lugar de montaje), `SelectionPanel.tsx`, el contenido interno/algoritmos de
`OrderedSequenceBuilder.tsx` y `ZoneComparison.tsx`, cualquier `lib/` de planificación,
reservas, provenance o freshness, `icons/`, `styles/tokens.css`, `styles/fonts.css`.

## Qué overlays dejaron de ser overlays

`SelectionAnalysis`, `OrderedSequenceBuilder`, `ZoneComparison`, `TravellerManager`, `TripBackup`
— los cinco de la lista explícita de la gate 11 §11. Además, dos piezas de cromo permanente (no
modales, pero tampoco contenido de una pestaña) desaparecieron como tales: la barra `.hub-bar` y
la barra `.view-bar`, sustituidas por el título de la cabecera + la barra única + el Sheet de
ciudad.

## Qué modales legítimos permanecen, y por qué

- **`Onboarding`** — explicador de primera apertura, reabrible. Sigue siendo un modal genuino:
  se puede saltar en cualquier paso, no es contenido navegable, y `05 §1` lo describe como una
  secuencia que se cierra, no una pestaña.
- **Lightbox de galería** (`PlaceGallery`) — `04 §6` lo especifica explícitamente como modal
  (fondo `--surface-ink`, cierre deslizando o con `×`). Ficha de lugar y galería son B4, no B18;
  no se ha tocado su comportamiento.
- **Confirmaciones destructivas** dentro de `TravellerManager` (reiniciar/quitar viajero) y el
  flujo de importación de `TripBackup` — son pasos de un flujo con estado propio, no navegación;
  `04 §3`/`05 §11` no piden convertirlas en pantallas.
- **`Sheet`** en sus dos usos (filtros, selector de ciudad) — `04 §8` los define explícitamente
  como el contenedor correcto para "lo que hoy es modal centrado" cuando el contenido es
  transitorio (una elección, no una superficie que recorrer). No están en la lista de la gate 11.

## Decisiones de ingeniería (bajo `08 §"Lo que ingeniería decide libremente"`)

- **`hidden` nativo, no una clase CSS a mano**, para alternar los cuatro paneles — decide el
  mecanismo de estado/gestión de foco, no un valor visual nuevo.
- **Ambos panes (lista/mapa) se solapan con `position:absolute` en `base`**, con el que está
  oculto en `visibility:hidden` (nunca `display:none`) — técnica exacta heredada de v1.1.0,
  necesaria porque Leaflet calcula `NaN` sobre un contenedor de tamaño cero (ver "Problemas
  encontrados"). Es implementación de un comportamiento ya especificado (`05 §4`: "Lista/Mapa"),
  no una decisión de diseño nueva.
- **Breakpoint del shell alineado a 840px** (`DESKTOP_QUERY` en `App.tsx`, antes 861px) — `02
  §D5` ya fija `md = 840px`; este bloque es el primero en tener un layout de shell que depende de
  ese número en JS (offset del panel de ficha, apertura por defecto de los filtros), así que
  alinearlo evita una ventana donde CSS y JS no estén de acuerdo sobre si el layout es "de
  escritorio".
- **`Sheet` centrado en `md`+, no panel lateral** — `04 §8` ofrece las dos variantes como
  igualmente válidas ("puede"); centrado es la opción sin geometría nueva que inventar.
- **«Dónde dormir en {ciudad}» dentro del Sheet de ciudad, no como tarjeta insertada en la
  lista** — la tarjeta insertada es explícitamente `05 §4`/roadmap B3 ("tras las primeras 6
  tarjetas"); B18 debe preservar la capacidad sin adelantar ese rediseño, así que se ubica donde
  no compite con el layout de lista que B3 va a tocar.
- **`OrderedSequenceBuilder`'s `×` alterna a «Dónde dormir»** en vez de no hacer nada — simetría
  con el `×` de `ZoneComparison` (que ya volvía a «Planificar»); ninguno de los dos es un valor
  de diseño nuevo, son la misma convención aplicada en las dos direcciones.

## Mediciones exactas de cromo (390×844, `scripts/b18-chrome-check.mjs`)

| Elemento | Alto medido |
|---|---|
| `.app__header` | 56px |
| `.explorer-bar` | 48px |
| **Cromo superior** | **104px** (límite 112px, Art. 8) |
| `.tab-bar` | 56px |
| **Cromo total** | **160px** (límite 168px, Art. 8) |

Cabecera sin overflow horizontal verificado en 320/360/390/430px. Estos cinco valores (56/48/56,
más 88px de `NavRail` y 18/24/40px de `PersonToken`) son ahora tokens semánticos en `tokens.css`
(`--chrome-header-height`, `--chrome-bar-height`, `--chrome-tabbar-height`,
`--chrome-navrail-width`, `--person-token-xs/sm/md`) consumidos desde `App.css`/`AppNav.tsx` —
ver "Corrección de cumplimiento normativo", hallazgo 3.

## Scroll restoration

Verificado en `scripts/b18-regression-check.mjs`: se fuerza `scrollTop = 260` en `.app__sidebar`,
se abre una ficha, se cierra, y se confirma `scrollTop` idéntico (±2px) tras volver. Funciona
porque `.app__sidebar` nunca se desmonta (la ficha vive en un hermano posicionado por encima, no
reemplaza a la lista en el DOM) y porque el destino «Explorar» completo permanece montado al
cambiar de pestaña.

La misma garantía se probó también en «Quiero ir»: se hace scroll en `.destination-panel--scroll`
de Quiero ir, se abre un lugar (que ahí se monta como hermano superpuesto, no reemplaza el
contenido), se cierra, y el `scrollTop` de Quiero ir vuelve idéntico — ver hallazgo 1 de
"Corrección de cumplimiento normativo".

## Responsive

`scripts/b18-responsive-check.mjs`: 320, 360, 390, 430, 820 (tablet), 839, 840, 841, 1200, 1440,
1600 — **33/33 comprobaciones sin overflow horizontal**, y la transición `TabBar`↔`NavRail`
ocurre exactamente en 840px sin ningún ancho con los dos visibles o ninguno.

## Accesibilidad

`scripts/b18-a11y-check.mjs`, **23/23**: áreas táctiles reales (no declaradas) ≥44×44px en
`TabBar`, `PersonToken`, la barra única, el Sheet de ciudad, `HubSelector` dentro del Sheet, el
botón de cierre de `Sheet`, y `viaje-nav`; exactamente un `aria-current="page"` en la navegación,
coincidente con el destino activo; `prefers-reduced-motion` reduce la animación `sheet-rise` a
≤0.001ms; el panel visible expone controles reales en el orden de tabulación; un panel oculto
**no puede recibir foco** (verificado forzando `.focus()`, no sólo inspeccionando CSS). No se han
debilitado los gates de áreas táctiles del Bloque 17 (`block17-design-foundation.test.ts` sigue
verde, con los ajustes puntuales descritos en "Tests").

Cinco comprobaciones nuevas de la auditoría posterior al cierre (hallazgo 4, ver más abajo):
el icono activo de `TabBar`/`NavRail` tiene una geometría SVG distinta de la del inactivo (no
sólo un color distinto — comparación de `fill`/forma por elemento, no de clase CSS); y el borde
inferior de `.app__header` no lleva la clase `--scrolled` en `scrollTop = 0`, la gana al hacer
scroll, cambia de color (`transparent` → `--line`), y se retira de nuevo al volver a
`scrollTop = 0`.

## Baseline → final

| Medición | Baseline (`0833912`) | Final (esta rama, post-corrección) |
|---|---|---|
| Vitest | 93 archivos / 3200 tests | **94 archivos / 3241 tests** |
| Lint (`oxlint`) | limpio | limpio |
| `tsc -b` / `vite build` | limpio | limpio |
| Entry JS | 1,398,734 B / gzip 259.95 kB | 1,407,180 B / gzip 261.80 kB (+0.6% / +0.7%) |
| CSS | 106,443 B / gzip 20.98 kB | 110,800 B / gzip 21.63 kB (+4.1% / +3.1%) |
| `ZoneComparison` chunk | 19,010 B / gzip 5.87 kB | 19,090 B / gzip 5.91 kB |
| `OrderedSequenceBuilder` chunk | 136,800 B / gzip 32.18 kB | 136,900 B / gzip 32.26 kB |
| `@media (max-width:…)` en `App.css` | 9 | **7** (reducido; nunca debía crecer) |
| Cromo superior en Explorar › Ciudad, 390×844 | ~330px (cabecera + `hub-bar` + `view-bar`) | **104px** |
| Cromo total (+ navegación permanente) | ~330px (sin `TabBar` propio) | **160px** |

El crecimiento adicional de CSS/JS respecto al cierre original de B18 (que ya reportaba 94/3226 y
109,926 B de CSS) proviene íntegramente de la corrección post-cierre: los nuevos tokens de
`tokens.css` (Sección 8, "Cromo del shell"), los tres iconos `-relleno` nuevos en `Icon.tsx`, el
estado `ficheOrigin`/`viajeVisited`/`headerScrolled` en `App.tsx`, y las 16 pruebas nuevas o
reescritas en `block18-shell.test.ts` — ningún byte proviene de trabajo de B19+.

## Tests

`block18-shell.test.ts` es nuevo (25 tests en el cierre original; **41 tests** tras la
corrección posterior). Seis ficheros de test pre-existentes se editaron porque escaneaban
literalmente la estructura de código que este bloque tenía que cambiar (booleanos
`sequenceBuilderOpen`/`zonesOpen`, la barra «Eres» en la cabecera, el segmentado `view-switch`
de dos botones, el texto exacto "Cómo se usa Nihon"); cada edición cita en un comentario el
documento/sección que la justifica, y ninguna relaja una aserción de comportamiento — todas
verifican el nuevo mecanismo con el mismo o mayor detalle que el anterior. Cero tests eliminados
sin reemplazo.

**Corrección posterior al cierre** (ver "Corrección de cumplimiento normativo" para el detalle):
`block18-shell.test.ts` sumó 16 tests — se invirtió el test que exigía "`selectPlace` siempre
cambia a Explorar" por seis pruebas nuevas bajo "destinos como estado, no como historial"; se
añadieron los describe blocks "Viaje conserva su estado al cambiar de pestaña", "TabBar/NavRail:
el activo cambia de glifo, no sólo de color", "ScreenHeader: el borde inferior sólo aparece al
hacer scroll", y "Art. 10 sólo tokens, auditoría diff-scoped" (este último ejecuta
`git diff <SHA-baseline> -- <ruta>` sobre `App.tsx`/`App.css`/`AppNav.tsx`/`tokens.css` y falla
si aparece un color/tamaño/offset/radio/sombra/duración/easing literal fuera de la lista de
legado ya presente antes de B18). `bundle-architecture.test.ts`, `TravellerLayer.test.ts` y
`ZonePlanSection.test.ts` — los tres ya editados en el cierre original para verificar
`destination === "viaje" && viajeSection === ...` — se editaron una segunda vez para verificar
`viajeVisited && viajeSection === ...`, reflejando el arreglo del hallazgo 2.

## Rendimiento

Presupuesto de imágenes por ciudad: sin cambios (B18 no toca fotografía). Chunk de entrada:
+0.5% (nuevos componentes de shell, `Sheet`, `PersonToken`, `AppNav`). CSS: +3.3% (nuevas reglas
de shell más los `--embedded` de los cinco componentes reconvertidos); sin duplicación de
propiedades entre CSS antiguo y nuevo — cada superficie migrada tiene su regla `min-width`
sustituyendo, no coexistiendo con, la `max-width` que reemplaza.

## Regresiones encontradas y corregidas dentro de este bloque

1. **Mapa Leaflet lanzaba `Invalid LatLng object: (NaN, NaN)` y desmontaba toda la app.** Al
   convertir `.app__body` de grid desktop-first a flex mobile-first, la primera versión ocultó
   `.app__map-area` con `display:none` en la vista de lista. Leaflet necesita que su contenedor
   tenga dimensiones reales incluso mientras está oculto (`panTo`/`fitBounds` calculan sobre el
   tamaño del contenedor); con `display:none` el contenedor mide 0×0 y el cálculo produce `NaN`,
   que Leaflet lanza como excepción no capturada. Corregido volviendo a la técnica de v1.1.0:
   ambos paneles se solapan con `position:absolute`, y el oculto usa `visibility:hidden` (que
   conserva el tamaño), nunca `display:none`. Encontrado por `scripts/quick-smoke` ad hoc antes
   de formalizar los scripts `b18-*`; sin este script manual habría llegado a producción.
2. **Toda la altura del shell colapsaba: `.app__content` no tenía ninguna regla CSS.** Sin
   `flex:1`/`display:flex` en `.app__content`, `.destination-panel`'s `flex:1` no heredaba de
   ningún contenedor flex real, así que `.app__body` (y con él `.app__sidebar`,
   `position:absolute; inset:0`) colapsaba a una altura mínima. Efecto observable: la última
   tarjeta de la lista "scrolleaba" hasta quedar bajo `TabBar`, que entonces interceptaba el
   click. Corregido añadiendo la regla que faltaba.
3. **`TravellerBar` truncaba "Persona 1"/"Persona 2" a "Person…"** — `.traveller-bar__name` tenía
   `max-width: 7.5ch`, correcto para la cabecera estrecha de la que salió, roto en su nuevo sitio
   (`Nosotros`, con ancho de sobra). Ampliado a `16ch`.
4. **Tres botones `×` quedaban sin destino tras dejar de ser modales** (ver "Decisiones de
   ingeniería" y "Arquitectura elegida" para el detalle y la corrección de cada uno).

Ninguna de las cuatro sobrevivió a la verificación final: `scripts/b18-regression-check.mjs`
(**39/39** tras la corrección posterior, ver más abajo), `b18-chrome-check.mjs` (6/6),
`b18-responsive-check.mjs` (33/33) y `b18-a11y-check.mjs` (**23/23**) pasan contra el build
final, además de la suite Vitest completa (94/94 ficheros, 3241/3241 tests).

## Corrección de cumplimiento normativo (auditoría posterior al cierre)

Una auditoría independiente, realizada después del commit de cierre original de B18
(`cfa33ec24fa7d5a9c3e52e7285a096aecb2f8d0e`), encontró cuatro incumplimientos. Se corrigieron en
un commit correctivo separado, sin tocar alcance de B19+. Detalle por hallazgo:

### 1. Quiero ir → Lugar cambiaba el destino activo a Explorar

**Hallazgo:** `selectPlace()` llamaba siempre a `setDestination("explorar")`, y
`block18-shell.test.ts` protegía esa decisión con un test explícito. Contradecía
`02_ARQUITECTURA_Y_NAVEGACION.md` ("Quiero ir └── Lugar · misma ficha que en Explorar"; `02 §D3`,
"la profundidad se apila dentro de una pestaña"): abrir un lugar desde Quiero ir navegaba fuera
de esa pestaña en vez de apilar la ficha dentro de ella.

**Fix:** `selectPlace`, `pushPlace`, `goBack` y `closeDetail` reciben ahora de dónde se abrió la
ficha (`ficheOrigin`, estado explícito, no derivado) y sólo tocan `view`/`filters`/`destination`
de Explorar cuando `origin === "explorar"`. El único componente `placeDetailOverlay`
(`PlaceDetail` + su envoltorio, sin duplicar JSX ni lógica) se referencia condicionalmente en
exactamente uno de los dos posibles huecos de render — el panel de Explorar o el de Quiero ir —
según `ficheOrigin`. Quiero ir se reestructuró en un `.destination-panel` externo (no scrolleable,
gestiona `hidden`) que envuelve un `.destination-panel--scroll` interno (el que scrollea de
verdad) más, como hermano, la ficha cuando `ficheOrigin === "quiero-ir"` — así la ficha se
superpone sin desplazar ni desmontar el contenido de Quiero ir debajo. Se añadió
`explorarSelectedId`/`explorarSelectedPlace` (`null` cuando la ficha pertenece a Quiero ir) para
que `PlaceMap`/`PlaceList` de Explorar, que siguen montados en segundo plano, no reaccionen a una
selección que no es suya — evitando un crash real de Leaflet (`Invalid LatLng: NaN, NaN`)
detectado durante el arreglo.

**Verificado:** `block18-shell.test.ts`, describe "destinos como estado, no como historial" (6
tests) invierte el test anterior y prueba que abrir un lugar desde Quiero ir preserva
`destination === "quiero-ir"`. `scripts/b18-regression-check.mjs` añade el flujo completo en
navegador real: Quiero ir con scroll y filtros aplicados → abrir un lugar (ficha a pantalla
completa) → cerrar → mismo `scrollTop` (±2px), mismos filtros, `destination` intacto.

**Guard añadido:** el test invertido en `block18-shell.test.ts` falla si `selectPlace` vuelve a
forzar `setDestination("explorar")` incondicionalmente; el paso de regresión en
`b18-regression-check.mjs` falla si el scroll o los filtros de Quiero ir no sobreviven al
ciclo abrir/cerrar ficha.

### 2. Viaje se desmontaba realmente al cambiar de pestaña

**Hallazgo:** el handoff original afirmaba que los destinos permanecían montados, pero
`OrderedSequenceBuilder`/`ZoneComparison` estaban gateados por
`destination === "viaje" && viajeSection === ...` — al cambiar `destination` a otra pestaña,
React desmontaba el componente activo de Viaje (ambos con estado local propio), perdiendo ese
estado pese a lo que el documento decía.

**Fix:** se añadió `viajeVisited` (estado, no derivado; se pone a `true` la primera vez que se
entra en Viaje y nunca vuelve a `false`) y las condiciones de render pasaron a
`viajeVisited && viajeSection === "..."`, desacoplando "¿se ha visitado esta sección alguna vez?"
de "¿es Viaje la pestaña activa ahora mismo?" (que sigue gobernando sólo el atributo `hidden` del
panel exterior). No se exige montar simultáneamente Planificar y Dónde dormir — sólo que el
componente correspondiente a `viajeSection` no se desmonte por el mero hecho de que `destination`
deje de ser `"viaje"`, preservando la invariante de único escritor.

**Verificado:** `block18-shell.test.ts`, describe "Viaje conserva su estado al cambiar de
pestaña". `scripts/b18-regression-check.mjs` añade: entrar en Viaje → activar el modo comparar
(`.sequence-compare-toggle`) → leer `#sequence-builder-title` → cambiar a otra pestaña → volver a
Viaje → releer el mismo título y confirmarlo sin cambios → salir del modo comparar
(`.link-button.sequence-back`).

**Guard añadido:** `bundle-architecture.test.ts`, `TravellerLayer.test.ts` y
`ZonePlanSection.test.ts` verifican ahora `viajeVisited && viajeSection === ...` en el código
fuente (en vez del patrón `destination === "viaje" && ...` que este mismo hallazgo invalida), así
que una regresión al patrón antiguo vuelve a hacer fallar la suite Vitest, no sólo el gate de
Playwright.

### 3. Colores/tipografía/espaciados nuevos sin token

**Hallazgo:** B18 introdujo valores CSS literales en vez de tokens semánticos:
`.sheet-scrim { background: rgba(20,22,26,.38) }` raw; `.tab-bar__item { gap: 2px }`; un
`font-size: 10px` nuevo en `PersonToken`; y varios tamaños/offsets del shell (alturas de
cabecera/barra/`TabBar`, ancho de `NavRail`, tamaños de `PersonToken`, badges, `sheet-grabber`,
ancho del panel de ficha en escritorio) escritos como números sueltos pese a que
`04_SISTEMA_VISUAL.md` ya los especifica exactamente (56/48/56/88px, 18/24/40px, etc.).

**Fix:** se añadió una nueva Sección 8 ("Cromo del shell") a `tokens.css` con un token semántico
por cada medida ya especificada por `04` (`--chrome-header-height`, `--chrome-bar-height`,
`--chrome-tabbar-height`, `--chrome-navrail-width`, `--person-token-xs/sm/md`,
`--info-button-size`, `--sheet-grabber-width/height`, `--panel-width`) más `--scrim-page` para el
color del scrim. `App.css`/`AppNav.tsx` pasaron a consumir estos tokens en vez de los literales.
El único valor sin respaldo documental (el `font-size: 10px` inventado de `.person-token--xs`) se
resolvió reutilizando `--type-caption-size`, un token tipográfico ya existente y visualmente
compatible — no hizo falta ningún valor nuevo, así que no aplica `DESIGN DECISION REQUIRED` aquí.
El `gap: 2px` de `.tab-bar__item` pasó a `var(--space-1)`. Los offsets/tamaños de los badges de
`TabBar`/`NavRail` pasaron a la escala de espaciado (`--space-1/2/4`) y a `--type-caption-size`.
De paso, se tokenizó también el ancho del panel de ficha en escritorio (antes `480px` inventado
en `.sheet` y `420px` literal en `.app__detail`, dos valores distintos para el mismo panel):
ambos ahora usan `--panel-width: 420px`, el valor que `04 §8` especifica.

**Verificado:** auditoría manual `git diff <baseline> -- app/src/App.css app/src/App.tsx
app/src/components/AppNav.tsx app/src/styles/tokens.css` línea por línea, distinguiendo literales
introducidos por B18 de deuda heredada de bloques anteriores (fuera de alcance de esta
corrección).

**Guard añadido:** `block18-shell.test.ts`, describe "Art. 10 sólo tokens, auditoría
diff-scoped" — ejecuta `git diff <SHA-baseline-B18> -- <rutas>` en tiempo de test
(`execFileSync`) y falla si las líneas *añadidas* por B18 contienen un color rgb/rgba/hex, un
`font-size`/`gap`/`padding`/`margin`/offset/radio/sombra/duración/easing literal que no esté en
una lista corta y justificada de valores de legado ya presentes antes de B18 (p. ej. la regla
global `prefers-reduced-motion { animation-duration: 0.001ms }` de B17, o `min(420px, 100%)`
—ahora sustituido por el token pero documentado como legado válido si reaparece por otra vía).
Esto convierte la revisión manual en un gate permanente contra regresiones futuras del mismo
tipo, sin re-litigar deuda de bloques anteriores.

### 4. Dos reglas visuales directas de `04` sin implementar

**4a. `TabBar`/`NavRail` (`04 §10`):** activo = icono relleno + `--ink-900`; inactivo = icono de
línea + `--ink-500`. Sólo cambiaba el color.
**Fix:** se añadieron variantes "-relleno" de los cuatro iconos de destino
(`explorar-relleno`, `calendario-relleno`, `personas-relleno`, y el ya existente
`corazon-relleno` para Quiero ir) en `Icon.tsx`, con la misma técnica ya establecida por el par
`corazon`/`corazon-relleno`: mismo trazado, `fill="currentColor"` en la forma principal. `ITEMS`
en `AppNav.tsx` ganó `iconActive`, y tanto `TabBar` como `NavRail` renderizan
`isActive ? item.iconActive : item.icon`. Sin emoji, sin segundo sistema de iconos.
**Verificado:** `block18-shell.test.ts` comprueba el mapeo `icon`/`iconActive` en código fuente;
`b18-a11y-check.mjs` compara en navegador real la geometría SVG (forma + `fill` por elemento) del
icono activo contra el inactivo y confirma que difieren, no sólo el color heredado del texto.
**Guard añadido:** el check de geometría SVG en `b18-a11y-check.mjs` falla si un futuro cambio
vuelve a hacer que actúen únicamente por color.

**4b. `ScreenHeader` (`04 §11`):** borde inferior `--line` que sólo aparece al hacer scroll.
`.app__header` llevaba el borde siempre.
**Fix:** `.app__header` pasó a `border-bottom: 1px solid transparent` por defecto, con una nueva
clase `.app__header--scrolled { border-bottom-color: var(--line) }`. Un único listener de
`scroll` a nivel de `document` en fase de captura (`addEventListener("scroll", handler, true)`)
observa el scroll de las distintas superficies scrolleables hijas (una por destino) sin necesitar
un listener por superficie, y actualiza `headerScrolled`; un efecto de resincronización evita
arrastrar el estado de scroll de una pestaña previamente activa al cambiar de destino.
**Verificado:** `b18-a11y-check.mjs` comprueba en el mismo navegador, en orden: sin scroll →
sin clase `--scrolled`; con `scrollTop` de vuelta a 0 → clase retirada; el color del borde
computado difiere entre ambos estados.

## Deuda diferida a B19+ (deliberadamente, no implementada aquí)

| Qué | A dónde pertenece | Por qué no aquí |
|---|---|---|
| `NavRail` expandido a 232px en `xl` | Polish (`04 §10`, mención "puede expandirse") | No es un criterio de cierre de B18; 88px cumple el contrato mínimo |
| Sub-pestañas «Reservas»/«Resumen» dentro de Viaje | B9 | `05 §7` las especifica, pero el roadmap asigna su implementación a B9; B18 sólo instala «Planificar»/«Dónde dormir», las dos capacidades que ya existían |
| Confirmación explícita "esto sustituirá todo" antes de importar respaldo | B8 (`05 §11` pt. 2) | Comportamiento/copy nuevo de una superficie que B18 sólo reubica, no rediseña |
| Panel derecho de `Sheet` en `md`+ (en vez de centrado) | Sin bloque asignado | Ver "Decisiones de ingeniería"; ambas variantes son válidas por `04 §8` |
| `.tag--gem`/`.tag--alert` hex sin token | B4 (heredado de B17) | Sin cambios en este bloque |
| ALL-CAPS + letter-spacing (`.traveller-bar__legend` "ERES", `REGIONES`, etc.) | B3/B4/B8 (heredado de B17) | Prohibido por Art. 00, pero pre-existente y fuera de la checklist enumerada de este bloque; señalado aquí para que no se pierda |
| `App.css` sigue siendo un monolito (~6.3k líneas) | B10 | `08`: "encoge bloque a bloque hasta desaparecer" — B18 no está obligado a extraer CSS a ficheros propios |

## Confirmación explícita: B3/B4/B5/B7/B8/B9 no se han implementado

No hay `PlaceCard` v2, ni portada editorial nueva, ni `FilterSheet` nuevo (la hoja de filtros usa
el `FilterPanel` de siempre dentro de un `Sheet` nuevo, pero sus grupos, chips y vocabulario son
exactamente los de v1.1.0), ni nuevo mapa/teselas, ni rediseño de coincidencias/divergencias de
Quiero ir, ni rediseño de Nosotros más allá de darle una casa a lo que ya existía, ni
`DayTimeline` ni rediseño interno del planificador. `PlaceCard.tsx`, `PlaceDetail.tsx`,
`PlaceGallery.tsx`, `PlaceMap.tsx`, `NationalMap.tsx`, el algoritmo de
`OrderedSequenceBuilder.tsx` y el de `ZoneComparison.tsx` son, en su contenido, idénticos a los
de `0833912`.

## `DESIGN DECISION REQUIRED`

Ninguno de los cuatro hallazgos de la auditoría posterior al cierre requirió una decisión de
diseño no cubierta por `08`: los tres primeros y el 4a/4b se resolvieron enteramente con
ingeniería (tokens, `ficheOrigin`, `viajeVisited`, iconos `-relleno`, listener de scroll). Todas
las demás decisiones nuevas de este bloque (mecanismo de `hidden`, técnica de superposición de
paneles, breakpoint 840px alineado en JS, `Sheet` centrado en escritorio, ubicación de «Dónde
dormir» en el Sheet de ciudad, destino de los tres botones `×`) caen bajo
`08 §"Lo que ingeniería decide libremente"` y están registradas arriba con su razón.

Se señala, sin bloquear el cierre de esta corrección (tal y como pidió explícitamente quien
encargó la auditoría), un único punto no cubierto de forma suficiente por `02`/`05`:

- **Destino de retorno al abrir un lugar guardado desde Viaje (`ZoneComparison`).** `02` no lista
  una ruta "Lugar" propia colgando de Viaje (a diferencia de Quiero ir, que sí la lista
  explícitamente), y `05 §7`/`§8` describen el contenido de Viaje sin especificar qué ocurre al
  abrir la ficha de un lugar ya guardado desde ahí. Este bloque mantiene, sin cambios, el
  comportamiento pre-existente: abrir un lugar desde `ZoneComparison` navega a Explorar
  (`ficheOrigin = "explorar"`), igual que hacía antes de esta corrección. Esto **no** es una
  regresión ni una omisión del hallazgo 1 — el hallazgo 1 es exclusivamente sobre Quiero ir, cuya
  ruta "Lugar" sí está definida en `02` — pero queda documentado aquí como una decisión de
  producto pendiente para quien posea `02`/`05`: si Viaje debería, como Quiero ir, apilar la
  ficha dentro de su propia pestaña en vez de cruzar a Explorar.
