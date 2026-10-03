# P-06 (sucesor) — Viaje › Días: Lista, hojas y vistas

**Estado:** NORMATIVO · sólo documentación · producto **sin modificar** · gates **sin adaptar** · nada desplegado.
**Autoridad:** DDR-P06-1 y DD-029…DD-035 en [`design/09_DECISIONES_DE_DISENO.md`](design/09_DECISIONES_DE_DISENO.md), aprobadas por Producto el 2026-10-03.
**Base:** `main` @ `de4b190b033a4d8c169d75a609e3d7d50527e674` (merge de [#193](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/193)).
**Sucede a:** [`P06_DAYS_PROGRESSIVE_DISCLOSURE.md`](P06_DAYS_PROGRESSIVE_DISCLOSURE.md) **en lo que se refiere a la interacción**. De aquel documento se conservan el inventario previo, la corrección incidental de `.trip-stop__media` y la lección de método (la vista inicial contesta sólo «¿qué hacemos cada día?»). Quedan **sustituidos** por este documento: la revelación progresiva inline (`⋯` desplegable, `<details>` «Detalles del día», «Herramientas y datos del viaje» desplegable), el cajón fijo «Sin asignar», la frase de ayuda permanente y la frase normativa al pie de la lista.

> Por qué: el QA físico mostró que P-06 reorganizó la jerarquía pero mantuvo la mecánica de expandir dentro de la tarjeta. Cada expansión inline sigue empujando la página y desorienta en móvil. La respuesta no es plegar mejor: es **no expandir en la lista**.

---

## 1. Principio normativo nuevo

> **En N1 / lista principal de Días, ninguna acción secundaria puede expandir contenido inline y aumentar sustancialmente la altura de la tarjeta o de la página.**
> **Las acciones cortas usan Sheet. Las tareas complejas usan FocusedView.**

Corolarios (DD-029):

- Una acción de N1 puede abrir una **hoja** (N2) o una **vista focalizada** (N3), o ejecutarse en el sitio sin cambiar la altura. No existe una cuarta opción.
- «Aumentar sustancialmente» se mide: una acción de N1 que cambie la altura de la tarjeta que la contiene en más de **una fila táctil (48 px)**, o la `scrollHeight` de la página en más de esa cantidad, incumple. Los estados de arrastre (indicador de inserción) y los avisos de problema real (`Art. 6`) quedan fuera de esta medida.
- `<details>`/`<summary>` y los patrones `aria-expanded` que despliegan contenido propio **no pueden** usarse en N1.
- Una hoja **no abre otra hoja encima**; un segundo paso sustituye el contenido de la misma hoja (con «atrás» en su cabecera).

## 2. Contrato N1 / N2 / N3

| | **N1 · Lista de Días** | **N2 · Sheet** | **N3 · FocusedView** |
|---|---|---|---|
| Qué es | La pantalla Viaje › Días: fechas, aviso, días, Sin asignar, entradas a lo demás | Hoja inferior de acción corta (`04 §8`) | Vista que reemplaza el contenido de Viaje para una tarea compleja (`04 §8b`) |
| Contenido permitido | Resumen, filas, enlaces/botones de entrada, avisos de **problema real** | ≤ 1 decisión; ≤ 7 filas o 1–2 campos | Cualquier contenido de tarea: comparar, editar, ver tablas, formularios |
| Altura | Estable: ninguna acción la expande (§1) | `auto` hasta el 88 %; **≤ 7 filas caben sin scroll a 375×667** | Scroll propio dentro de la vista |
| Se abre con | — | Fila/botón de N1 | Fila/botón de N1 (nunca desde una hoja) |
| Se cierra con | — | `×`, fondo, Escape, o completar la acción | Chevron «atrás», **Escape**, **Back del navegador**, **gesto atrás de iOS** (todos convergen, DD-030) |
| Historial | No apila | **No** apila entrada de `history` | **Apila** una entrada de `history` |
| Foco al abrir | — | Al botón de cerrar de la hoja (`Sheet`, ya existente) | Al título de la vista (`tabIndex=-1`) |
| Foco y scroll al cerrar | — | Al disparador | **Al disparador exacto** y **scroll de N1 restaurado ±1 px** |
| N1 mientras está abierto | Montado | Montado, visible tras el scrim | **Montado y oculto** (`hidden`), con su estado, scroll y foco conservados |
| Vistas aprobadas | La lista | Fechas · Acciones de parada · Acciones del día · Añadir a un día · Mover a otro día | **Orden del día** · **Horarios y traslados del día** · **Traslados entre ciudades** |

Reglas transversales:

- **Dominio intacto.** Ninguna hoja ni vista escribe nada que N1 no pudiera escribir: mismas mutaciones atómicas V8, misma clave `nihon.manualPlanningDraft`, mismo esquema. Abrir o cerrar una hoja/vista **no escribe** en el almacenamiento.
- **Nihon no decide el viaje (`Art. 5`).** Ninguna hoja o vista reordena, reparte ni aplica nada sola. La frase «Vosotros decidís el orden. Nihon sólo describe lo que ese orden implica.» (con `EvidenceMark ✎`) vive en las vistas N3 donde el orden es relevante (**Orden del día**, **Horarios y traslados del día**), no en N1 (DD-034).
- **Mover entre días no pregunta posición.** Mover un lugar a otro día —desde una hoja, desde Sin asignar o desde el teclado— lo **añade al final** del día destino. La posición se cambia después en «Orden del día» (DD-032).
- **Arrastre sólo con puntero fino.** En N1 el asa de arrastre existe únicamente con `(hover: hover) and (pointer: fine)`; en táctil no hay asa y el orden táctil vive en «Orden del día» (DD-031). `(hover: hover) and (pointer: fine)` es una media feature, no un `max-width`: no infringe `Art. 8`.
- **Todo es alcanzable sin arrastrar.** Teclado, lector de pantalla y táctil usan hojas y vistas; el arrastre es una comodidad de ratón, nunca la única vía (`Art. 11`, `Art. 12`).

## 3. Métricas UX normativas del programa

Estos son los gates del programa completo. Cada uno **se activa** en el bloque indicado y **sigue vigente** en los posteriores.

| # | Gate | Se activa en |
|---|---|---|
| M1 | Ningún control de N1 expande contenido inline (ni `<details>`, ni `aria-expanded` que despliegue contenido propio) | D (A elimina el cajón; B el panel `⋯`; C «Detalles del día»; D «Herramientas») |
| M2 | No aparece «Posición» en N1 (texto visible ni opciones de `select`) | B |
| M3 | No existen `<details>` interactivos dentro de las tarjetas de día | C |
| M4 | A 390×844 con el fixture P-06, caben **el encabezado de Día 1 y 3 paradas completas** sin scroll de la lista | A |
| M5 | Back desde N3 restaura el scroll de N1 con ±1 px y el foco en el disparador (Back, gesto, chevron y Escape) | C |
| M6 | Los Sheets con ≤ 7 filas caben sin scroll a 375×667 | A (Fechas) y B (resto) |
| M7 | **WebKit es obligatorio** para todos los gates nuevos de P-06; Chromium además | A, B, C, D |

**Sobre WebKit.** Los gates nuevos se escriben para ambos motores (`NIHON_BROWSER=webkit|chromium`, como B30/B31). El entorno de implementación debe tener WebKit. Si no lo tiene, el bloque se entrega como **«implementado; certificación WebKit pendiente»** y **no puede declararse cerrado ni continuar el siguiente bloque**.

**Fixture P-06** (nombre de referencia para todos los gates): el de `app/scripts/p06-days-capture.mjs` ampliado explícitamente en el gate con: fechas 2027-02-22 → 2027-03-05, Día 1 con **3 paradas de Tokio**, Día 2 con una parada de Kioto, y **1 sitio sin asignar** (el peor caso: el aviso superior está presente).

## 4. Semántica nueva de B27 / B28 / B29 (DD-035)

Los tres gates **certifican la interacción nueva** conservando **las mismas garantías de dominio**. Dejan de exigir: `<details>` inline, selectores de posición, arrastre táctil en la lista, «Probar otro orden».

| Gate | Garantía de dominio que se conserva | Interacción que pasa a certificar |
|---|---|---|
| **B27** Viaje · Días (A–K) | Días como estructura; fechas ancladas y límites; añadir/eliminar/mover día; mover lugar entre días y a Sin asignar con poda V8 y restauración; `PlaceDetail` y back dentro de Viaje; sin escrituras al leer; 8 viewports | Fechas por Sheet; acciones de parada/día por Sheet; Sin asignar visible; mover = al final; N3 de Horarios y traslados |
| **B28** Reordenación | Mutación inter-día atómica; identidad estable de día; arrastre desde Sin asignar con posición exacta; cancelación sin escritura; sin auto-scroll espurio | Arrastre **sólo con ratón/puntero fino**; en táctil: **no hay asa** y el reordenamiento se hace en «Orden del día» |
| **B29** Herramientas del día | Línea base persistida; propuesta editable por teclado; comparación local (`compareSequences`); opciones `evidence-complete` etiquetadas y nunca aplicadas solas; aplicación atómica con protección *stale* | Se alcanza como **«Cambiar orden» → N3 «Orden del día»** |

La adaptación de estos gates ocurre **dentro del bloque que cambia la interacción que cada uno prueba** (§5), sin relajar ninguna aserción de dominio. Una aserción que desaparezca porque su interacción ya no existe se reemplaza por la aserción de la interacción nueva, en el mismo commit.

## 5. Programa y dependencias

```
P-06·A  (N1: limpieza)  ──►  P-06·B  (N2: hojas)  ──►  P-06·C  (N3: orden, horarios, historial)  ──►  P-06·D  (N3: traslados entre ciudades + cierre)
```

**Estricta e indivisible**: cada bloque parte del `main` que contiene el anterior ya integrado y certificado (Chromium + WebKit). Ningún bloque se adelanta, se fusiona con otro ni se implementa en paralelo.

| Si falta… | …no puede empezar | Por qué |
|---|---|---|
| A | B | B añade hojas sobre la lista limpia (cabecera del día con sitio para `⋯`, Sin asignar como sección con filas) |
| B | C | C quita el arrastre táctil: sin hojas de mover/añadir, el táctil perdería capacidad (`Art. 12`) |
| C | D | D reutiliza `FocusedView` y el puente de History creados en C |
| Cierre de DDR-P06-2 | D | D reubica límites, plan de zona y gestor de alojamientos (§9) |

### Estado transitorio (no normativo)

Tras A, B y C el código **conserva a propósito** lo que el bloque siguiente aún no sustituye. Nada de esto es contrato; sólo evita perder capacidad (`Art. 12`) entre bloques.

| Tras… | Aún existe (transitorio) | Lo sustituye |
|---|---|---|
| A | Panel `⋯` inline por parada (con «Posición»); `<details>` «Detalles del día» (incluye «Mover día…», «Añadir lugar» y sus «Posición»); «Probar otro orden» + `DayOrderToolPanel` inline; `<details>` «Herramientas y datos del viaje»; asa de arrastre táctil | B (`⋯`, «Mover día», «Añadir lugar»), C (Detalles, Probar otro orden, asa táctil), D (Herramientas) |
| B | `<details>` «Detalles del día» (sin las acciones del día); «Probar otro orden» + panel inline; `<details>` «Herramientas…»; asa táctil | C, C, D, C |
| C | `<details>` «Herramientas y datos del viaje» | D |

## 6. Inventario: dónde termina cada bloque visible en `main`

Numeración de `P06_DAYS_PROGRESSIVE_DISCLOSURE.md §1`. Nada se elimina: se reubica (`Art. 12`).

| # | Bloque en `main` | Destino final | Bloque |
|---|---|---|---|
| 1 | Cabecera «Viaje» + fechas + ✕ | Se elimina el encabezado interno y el ✕ (la pestaña ya titula «Viaje»); las fechas pasan a la fila resumen | A |
| 2 | Frase «Vosotros decidís el orden…» | Vistas N3 «Orden del día» y «Horarios y traslados del día». Mientras no existen, en `DayOrderToolPanel` | A → C |
| 3–4 | Fecha de inicio / fin | Fila resumen + Sheet «Fechas del viaje» | A |
| 5 | Herramientas y datos del viaje | N3 «Traslados entre ciudades» (traslados) y destinos de DDR-P06-2 (límites, zonas elegidas, alojamientos) | D |
| 6 | Cabecera de día + resumen | Cabecera compacta (§A.2) | A |
| 7 | ✕ Eliminar Día N | Sheet «Acciones del día» | B |
| 8 | Probar otro orden | «Cambiar orden» → N3 «Orden del día» | C |
| 9 | Mover día… (select con «Posición») | Sheet «Acciones del día» (mover antes / después) | B |
| 10 | Añadir lugar (select) y «Añadir al día…» | Sheet «Añadir a un día» (al final del día) | B |
| 11–12 | Parada: nº, miniatura, nombre, zona · duración, asa | Fila sin caja; asa sólo con puntero fino | A (fila), C (asa) |
| 13 | `⋯` desplegable: Día, Posición, Mover parada, Mover a Sin asignar | Sheet «Acciones de parada» + paso «Mover a otro día» (sin posición) | B |
| 14 | Conector con traslado conocido | Sin cambios | — |
| 15 | Lista completa de traslados / «Sin traslado registrado» | N3 «Horarios y traslados del día» | C |
| 16–19 | Cierre semanal, horarios/cierres, hora manual vs intervalo, totales | N3 «Horarios y traslados del día». La línea de aviso de la tarjeta se conserva | C |
| 20 | Alojamiento por tramo | N3 «Horarios y traslados del día» | C |
| 21 | Pie «Dormís en X» / «Sin alojamiento elegido» | Pie resumido con el contrato de copy de DD-033 | A |
| 22 | Fila de traslado entre días | Se conserva; pasa a abrir N3 «Traslados entre ciudades» | D |
| 23 | ＋ Añadir día | Sin cambios | — |
| 24 | Cajón «Sin asignar» fijo | Sección visible al final + aviso superior | A |

---

## A. P-06·A — Limpieza de la lista (N1)

**Objetivo.** Dejar la lista de Días limpia y estable sin añadir hojas ni vistas. Es el primer bloque implementable y **no requiere ninguna decisión de producto**: todo lo necesario está fijado aquí.

### A.1 Alcance exacto

A hace **estas diez cosas y ninguna más**:

1. **Limpieza de cromo.** Se elimina el encabezado interno de Días (`header.analysis-header`) cuando `embedded` y su botón ✕ (el falso «Cerrar Viaje»: en modo embebido su `onClose` sólo cambia a la sub-pestaña «Dónde dormir»; no cierra nada). La rama modal no embebida del componente, sin consumidor, **no se toca**. El nombre accesible «Viaje · Días» se conserva como `h2` visualmente oculto (`id="sequence-builder-title"`, B10-A3).
2. **Fila resumen de fechas** (§A.3.1) que sustituye al bloque `.calendar-anchor` visible.
3. **Sheet de fechas** «Fechas del viaje» (§A.3.2) que aloja los dos campos de fecha.
4. **Tarjetas simplificadas**: cabecera `Día N · fecha` + línea `ciudad · N lugares` (§A.4); sin cajas dentro de la caja.
5. **Filas de parada sin caja anidada** (§A.5).
6. **Duración compacta** (§A.4): el tiempo de visita del día, a la derecha del encabezado; sin texto «duración sin cuantificar».
7. **Alojamiento resumido** con el copy aprobado (§A.6) como una sola fila.
8. **Sin asignar como sección visible** (§A.7), en el flujo, al final de la lista; sin `<details>`, sin `position: sticky`.
9. **Aviso superior** si hay lugares sin asignar (§A.8).
10. **Eliminación de ayuda permanente**: se quita `p.days-hint` («Organiza tus lugares por día…») y `p.days-framing` («Vosotros decidís…») de N1. La frase normativa se **reubica** como primera línea de `DayOrderToolPanel` (§A.9) hasta que C la lleve a la vista N3.

A **no implementa** hojas de acción, N3, History para vistas, cambios de arrastre, «Cambiar orden» ni renombra nada fuera de lo listado.

### A.2 Anatomía resultante (de arriba abajo)

```
[h1 «Viaje» + viaje-nav: Días · Dónde dormir · Reservas · Resumen]          ← shell, intacto
(h2 «Viaje · Días» visualmente oculto)
[alerta del reparto no válido]                                               ← sólo si !dayAssignment.valid, intacta
[Fila de fechas]                                                             ← A.3.1 · siempre
[Aviso «N sitios sin asignar» · Ver]                                         ← A.8 · sólo si N > 0
[Tarjeta de Día 1] [fila de traslado entre días, si existe] [Tarjeta de Día 2] …
[＋ Añadir día]
[Sección «Sin asignar · N sitios»]                                           ← A.7 · sólo si N > 0
[<details> Herramientas y datos del viaje]                                   ← transitorio, intacto
```

### A.3 Fechas

#### A.3.1 Fila resumen

Un único `button` de ancho completo, `min-height: var(--tap-min)`, icono `calendario` a la izquierda, texto, icono `siguiente` a la derecha. Abre el Sheet. Texto (formato compacto, §A.10):

| Estado | Texto visible | Nombre accesible |
|---|---|---|
| Sin fechas | `Poner fechas del viaje` | `Poner fechas del viaje` |
| Sólo inicio | `Desde {inicio}` | `Desde {inicio}. Cambiar fechas del viaje` |
| Inicio y fin | `{inicio} – {fin}` | `{inicio} – {fin}. Cambiar fechas del viaje` |
| Sólo fin | `Hasta {fin}` | `Hasta {fin}. Cambiar fechas del viaje` |

El texto visible siempre está contenido en el nombre accesible. Las fechas siguen siendo dos decisiones independientes (Fase 3D-W): fijar o quitar una nunca toca la otra ni crea, borra o reordena días.

#### A.3.2 Sheet «Fechas del viaje» (N2)

Reutiliza `Sheet` (`04 §8`) sin cambios de API. Título «Fechas del viaje». Cuerpo, en este orden:

1. Campo **Fecha de inicio** (`input type="date"`, `id="sequence-start-date"`). Etiqueta visible `Fecha de inicio` + `<span class="visually-hidden"> (Día 1)</span>`, de modo que el nombre accesible sigue siendo «Fecha de inicio (Día 1)». Si hay valor: botón `link-button` visible «Quitar fecha», `aria-label="Quitar fecha de inicio"`.
2. Campo **Fecha de fin** (`id="sequence-end-date"`). Etiqueta visible `Fecha de fin` + `<span class="visually-hidden"> (último día del viaje)</span>`. Si hay valor: «Quitar fecha» con `aria-label="Quitar fecha de fin"`.

Comportamiento:

- **Se aplica al instante**, como hoy (`onChange` → `setStartDate`/`setEndDate`). No hay «Guardar» ni «Cancelar». Cerrar la hoja no escribe nada más.
- Se conserva **un único** `<div className="calendar-anchor">` con los dos campos dentro de la hoja (contrato del test de fuente existente).
- Cabe sin scroll a 375×667 (≤ 4 filas: M6). Al cerrar (×, fondo, Escape) el foco vuelve a la fila de fechas (comportamiento de `Sheet`).
- Los `input` sólo existen mientras la hoja está abierta.

### A.4 Tarjeta de día

```
┌──────────────────────────────────────────┐
│ Día 1 · lun 22 feb                 5–7 h │   ← h3 (izq.) · tiempo de visita (dcha.)
│ Tokio · 3 lugares                        │   ← resumen, una línea
│ [aviso de límites del viaje, si procede] │   ← TripBoundsDayWarning, intacto
│ ─ filas de parada (A.5) ───────────────  │
│ [línea de cierre semanal, si procede]    │   ← intacta, sigue diciendo «ver Detalles del día»
│ 🛏 Zona para dormir: Shinjuku         ›  │   ← A.6
│ Probar otro orden      Detalles del día  │   ← transitorio, intacto
└──────────────────────────────────────────┘
```

- **Encabezado.** `h3#day-heading-{i}`: `Día {n}` y, si hay fecha de inicio, ` · {fecha corta}`. Un solo `·`.
- **Resumen.** `{ciudad} · {N} lugar|lugares`. `ciudad` = el hub único del día, o `Varias ciudades` si hay más de uno; sin hub (día vacío) → `Sin lugares` (sin `·`). Un solo `·`.
- **Duración compacta.** Columna derecha del encabezado, `--type-num`, `--ink-600`: `formatRange(summarizeSelection(places).visitTime)` precedida de `<span class="visually-hidden">Tiempo de visita: </span>`. **Si no es cuantificable o el día está vacío no se pinta nada** (se retira «duración sin cuantificar»; el dato sigue completo en «Detalles del día» hasta C). Es un valor derivado: se mantiene el tratamiento de evidencia que ya tenía en su sitio actual (no se añade ni se quita marcador).
- **`✕ Eliminar Día N`** (día vacío con más de un día) **no se toca** en A: sigue donde está, en la columna derecha del encabezado cuando no hay duración (un día vacío nunca tiene duración).
- La tarjeta (`.day-card`) conserva su caja: es la **única** caja de la lista.
- Los iconos del esquema anterior son los del set propio (`cama`, `siguiente`, `aviso`); no se usan emoji ni flechas de texto (Constitución, «Patrones prohibidos»).

### A.5 Fila de parada sin caja anidada

- `.trip-stop` pierde **borde, fondo, sombra y radio** (en computado: `border-width: 0`, `background-color` transparente, `box-shadow: none`, `border-radius: 0`). Conserva rejilla, miniatura (3,5 rem), número, nombre, `{barrio} · {duración}`, asa y `⋯`.
- Separación entre filas: `border-top: 1px solid var(--line)` en cada `.day-timeline__item` salvo el primero; relleno vertical por tokens. Sin tarjeta dentro de tarjeta, sin esquinas redondeadas anidadas.
- `.trip-stop--dragging` conserva su realce (no es reposo). El conector de traslado (`LegConnector`) no cambia.
- La corrección `.trip-stop__media { position: relative }` **se conserva**.

### A.6 Alojamiento resumido — contrato de copy (DD-033)

Una única fila `button` al pie de la tarjeta (sólo en días con lugares, como hoy), `min-height: var(--tap-min)`, icono `cama`, texto, icono `siguiente`. Al activarla: `onSectionChange("dormir")` (lo mismo que hacía el enlace «Dónde dormir», que **desaparece** como control aparte). Nombre accesible: `{texto}. Abrir Dónde dormir`.

Se calcula con una función **pura** nueva `summarizeDaySleeping` (§A.11) y exactamente tres estados, por este orden de precedencia:

| Orden | Condición | Texto exacto |
|---|---|---|
| 1 | La frontera **final** del día (`accommodationBoundary.end`) elige un `AccommodationAnchor` que **no** es el sembrado por una elección de zona (`findZoneChoiceForAnchor(zoneChoices, id) === null`) | `Dormís en {etiqueta del alojamiento}` |
| 2 | No se cumple 1 **y** hay una elección de zona aplicable: la del hub único del día, o la que sembró el anclaje que la frontera final del día elige | `Zona para dormir: {nombre de la zona}` |
| 3 | Nada de lo anterior | `Elegir zona para dormir` |

Reglas:

- **Nunca** se pinta «Dormís en la zona X» ni «Dormís en {zona}» cuando sólo existe una elección de zona. «Dormís en» exige un alojamiento real elegido en la frontera del día.
- Un anclaje **sembrado por «Dormir aquí»** cuenta como **zona**, no como alojamiento, aunque la frontera del día lo elija (estado 2). Si la persona crea un alojamiento propio y lo elige, pasa a estado 1.
- `nombre de la zona` sale del registro de zonas ya resuelto (`zoneDayLinks[i].chosenZone?.zone?.name`). Si la elección existe pero la zona ya no está en el catálogo, **no se inventa nombre**: se cae a estado 3.
- Días con varias ciudades: sólo pueden mostrar estado 1, estado 2 vía anclaje sembrado en la frontera, o estado 3.
- **Elegir zona sigue siendo sólo contexto**: este resumen es de **lectura**. No crea ni reescribe alojamientos ni fronteras, y mostrarlo **no escribe** en V8 (`Art. 5`, DD-033). Las mutaciones existentes (`withZoneAccommodationChoice`, etc.) no se tocan.
- Un `button` que sólo navega no dispara escrituras.

### A.7 Sin asignar: sección visible

Se sustituye `<details class="unassigned-drawer">` por:

```
<section class="unassigned-section" aria-labelledby="unassigned-heading">
  <h3 id="unassigned-heading" tabindex="-1">Sin asignar · {N} sitio|sitios</h3>
  <ul> … filas como hoy … </ul>
</section>
```

- Va **después de «＋ Añadir día»** y **antes** de `Herramientas y datos del viaje`. En el flujo normal: **sin** `position: sticky`/`fixed`, sin `box-shadow` flotante, sin reservar espacio para la barra de pestañas.
- Cada fila **no cambia de contenido** en A: nombre, asa de arrastre (`data-drag-place-id`, `aria-label="Arrastrar {nombre}"`) y control «Añadir al día…» (los sustituye B).
- **Si N = 0 no se renderiza la sección ni el aviso** (`Art. 6`: una señal siempre encendida no informa). Se retira «Todos los sitios del plan están asignados.».
- El arrastre desde esta sección a un día sigue funcionando igual (misma lógica; el asa sólo cambia de contenedor).
- Se eliminan las reglas CSS de `.unassigned-drawer` (incluido el `scroll-margin-bottom` del asa) y se añaden las de `.unassigned-section`.

### A.8 Aviso superior

Si N > 0, entre la fila de fechas y el primer día:

```
⚠ 3 sitios sin asignar                [Ver]
```

- Texto: `{N} sitio sin asignar` (N = 1) / `{N} sitios sin asignar`. Icono `aviso`, tono **neutro** (`--surface-sunken`, `--ink-700`); nunca rojo.
- `Ver` es un `button` (`aria-label="Ver sitios sin asignar"`, ≥ 44 px) que hace *scroll* al `h3#unassigned-heading` (`behavior: "auto"` si `prefers-reduced-motion: reduce`, `"smooth"` si no) y le da foco (`preventScroll`).
- No es `role="alert"` ni `aria-live`. Es una línea, no un párrafo: cuenta como el aviso en prosa de la pantalla (`Art. 3`), el de reparto no válido es un error aparte y excepcional.

### A.9 Reubicación de la frase normativa

- `p.days-framing` desaparece de N1.
- Se añade como **primera línea** dentro de `DayOrderToolPanel` (bajo su cabecera), con el mismo texto y `EvidenceMark level="nihon" label={false}`: «Vosotros decidís el orden. Nihon sólo describe lo que ese orden implica.»
- Cambio de **ubicación, no de redacción**. C la lleva a las vistas N3 definitivas.

### A.10 Formato de fecha compacto

Nuevas funciones puras en `lib/civil-date.ts`, junto a `formatCivilDateDisplay`, que **no se modifica** (otros consumidores la usan):

- `formatCivilDateShort(iso, locale = "es")`: `Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })`. Sin año. Entrada inválida → devuelve `iso`, igual que la existente.
- `formatCivilRangeCompact(startIso, endIso, locale = "es")`: `"{día} {mes} – {día} {mes}"` (sin día de la semana). Si inicio y fin caen en **años distintos**, añade el año a ambos extremos. Entrada inválida → `iso` correspondiente.

Se usan en la fila de fechas y en el `h3` de cada día.

### A.11 Función pura de alojamiento

`app/src/lib/day-sleeping-summary.ts`:

```ts
type DaySleepingSummary =
  | { kind: "accommodation"; text: string }   // «Dormís en {etiqueta}»
  | { kind: "zone"; text: string }            // «Zona para dormir: {zona}»
  | { kind: "none"; text: string };           // «Elegir zona para dormir»
export function summarizeDaySleeping(input: {
  boundaryEnd: AccommodationBoundaryChoice | null;
  accommodations: readonly AccommodationAnchor[];
  zoneChoices: readonly ZoneAccommodationChoice[];
  dayZoneName: string | null;          // nombre resuelto de la zona aplicable al hub único del día
  seededZoneNameByAnchorId: ReadonlyMap<string, string | null>;
}): DaySleepingSummary;
```

Sin DOM, sin React, sin acceso a almacenamiento ni a datos; la prueba unitaria cubre los tres estados, la precedencia, el anclaje sembrado en la frontera, la zona fuera de catálogo y la ausencia total de «Dormís en la zona».

### A.12 Archivos previsibles

| Archivo | Cambio |
|---|---|
| `app/src/components/OrderedSequenceBuilder.tsx` | Cabecera embebida, fila + Sheet de fechas, cabecera/resumen/duración de día, pie de alojamiento, sección Sin asignar, aviso, retirada de `days-hint`/`days-framing` |
| `app/src/components/OrderedSequenceBuilder.css` | Reglas de fila de fechas, aviso, tarjeta, parada sin caja, `.unassigned-section`; baja de `.unassigned-drawer`, `.days-hint`, `.days-framing`; **ningún `@media (max-width)` nuevo**; sólo tokens |
| `app/src/components/DayOrderToolPanel.tsx` (+ `.css`) | Primera línea con la frase normativa |
| `app/src/lib/civil-date.ts` (+ test) | `formatCivilDateShort`, `formatCivilRangeCompact` |
| `app/src/lib/day-sleeping-summary.ts` (+ test) | Función pura de §A.11 |
| `app/src/components/OrderedSequenceBuilder.trip-bounds.test.ts` | Adaptar el contrato de fuente a la etiqueta visible + oculta y al `.calendar-anchor` dentro del Sheet |
| `app/scripts/p06a-days-n1-check.mjs` | **Gate nuevo** (§A.15) |
| `app/scripts/b27…`, `b28…`, `b29…`, `b31…`, `phase3f-f/h/j…`, `phase5a-rc…`, `d0b…`, `p06-days-capture.mjs` | **Sólo entrada** (§A.15) |
| `docs/P06_DAYS_PROGRESSIVE_DISCLOSURE.md`, `docs/CURRENT_WORK_HANDOFF.md` | Estado y resultados |

### A.13 Invariantes

- **Dominio intacto.** Sin cambios en `lib/planning-draft*`, `day-assignment`, `ordered-sequence`, `trip-bounds`, `zone-*`, `accommodation-*`, `day-order-tool`, `whole-trip-composition`. Misma clave y esquema V8. Abrir/cerrar la hoja de fechas y navegar con la fila de alojamiento **no escriben**.
- **Toda capacidad sigue alcanzable** (`Art. 12`): `⋯` por parada, «Detalles del día», «Probar otro orden», «Herramientas y datos del viaje», arrastre y «Añadir al día…» **siguen donde están**.
- Fechas independientes; fijar/quitar una no toca la otra ni los días.
- `Art. 8`: **cero** `@media (max-width)` nuevos; los existentes no se amplían.
- `Art. 10`: sólo tokens (el hex heredado de `.day-card__signal` no se toca ni se copia).
- `Art. 11`: objetivos ≥ 44×44, foco visible, `prefers-reduced-motion`, teclado.
- `Art. 6`: no se añade ninguna señal que aparezca en > 70 % de los elementos.
- Nombres accesibles existentes que los gates usan se conservan (`Mover a…`, `Arrastrar {nombre}`, `Probar otro orden del Día N`, `Fecha de inicio (Día 1)`, `Fecha de fin`), salvo los explícitamente cambiados aquí.

### A.14 Qué NO tocar

Dominio y almacenamiento (arriba); `Sheet.tsx` y su CSS (se reutiliza tal cual); `App.tsx` y el puente de History; el panel `⋯` inline, «Detalles del día» y su contenido, «Probar otro orden», «Herramientas y datos del viaje»; arrastre y lógica de `startDrag`; `LegConnector`, `InterHubSegmentsSection`, `AccommodationManagerSection`, `ZonePlanSection`; `TripBoundsDayWarning`; Dónde dormir, Reservas, Resumen; Explorar, Quiero ir, Nosotros; el dataset, fotografías, `docs/` fuera de lo listado; despliegue y Vercel. Tampoco se renombra «Probar otro orden» ni se elimina «Posición» (B y C).

### A.15 Criterios de aceptación

- [ ] En Días no existe `header.analysis-header` ni un botón cuyo nombre empiece por «Cerrar Viaje»; el `h2` oculto «Viaje · Días» existe y es el nombre de la sección.
- [ ] La fila de fechas muestra los cuatro estados de §A.3.1 con el texto exacto y se abre el Sheet «Fechas del viaje»; los dos `input` están **sólo** dentro de él y conservan `id`, nombre accesible y «Quitar fecha» independiente.
- [ ] Cambiar una fecha desde el Sheet persiste igual que antes (mismo valor en V8, mismos días); cerrar sin cambiar no escribe.
- [ ] El Sheet de fechas cabe sin scroll a 375×667; Escape/×/fondo lo cierran y el foco vuelve a la fila.
- [ ] El encabezado de cada día es `Día N · {fecha corta}` (o `Día N`); el resumen es `{ciudad} · {N} lugares` con un solo `·`; la duración se muestra a la derecha y no se pinta si no es cuantificable.
- [ ] `.trip-stop` en reposo no tiene borde, fondo, sombra ni radio (valores computados) y las filas se separan por una línea.
- [ ] El pie de día muestra uno de los tres textos de §A.6; **ningún** texto «Dormís en la zona». Probado con: sin elección; sólo elección de zona; zona con su anclaje sembrado en la frontera; alojamiento propio en la frontera; zona fuera de catálogo; día multi-ciudad. Toda lectura deja V8 idéntico byte a byte.
- [ ] «Sin asignar» es una sección `h3` visible, no `<details>`, no sticky/fixed; con N = 0 no existen ni la sección ni el aviso.
- [ ] El aviso superior aparece si y sólo si N > 0, con el singular/plural exacto; `Ver` lleva scroll y foco al `h3`.
- [ ] No hay `p.days-hint` ni «Vosotros decidís» en N1 con todo plegado; la frase aparece en `DayOrderToolPanel` abierto.
- [ ] **M4**: a 390×844 con el fixture P-06, el `h3` de Día 1 y las **3 paradas completas** quedan dentro del área visible (por encima de la barra de pestañas) con el aviso presente y el scroll de Días en 0.
- [ ] **M6** (Fechas): el Sheet cabe sin scroll a 375×667.
- [ ] Todas las capacidades de §6 marcadas «—»/«transitorio» siguen alcanzables y los gates históricos pasan **con sólo el cambio de entrada** documentado.
- [ ] Cero `@media (max-width)` nuevos; sin hex literales nuevos.

### A.16 Gates

**Nuevo — `p06a-days-n1-check.mjs`** (Chromium **y WebKit**, ocho viewports del B27: 320×568, 375×667, 390×844, 430×932, 820×1180, 1024×768, 1280×800, 1440×900; con y sin `prefers-reduced-motion`): todos los criterios de §A.15; sin desbordamiento horizontal; sin solapes; destinos táctiles ≥ 44; y la medida M4.

**Existentes — cambio de entrada permitido, ninguna aserción de dominio relajada:**

| Gate | Cambio de entrada |
|---|---|
| `b27-viaje-dias-check.mjs` | Abrir el Sheet de fechas antes de `#sequence-start-date`/`#sequence-end-date`; el literal «Poner fecha de inicio» pasa a ser el texto de la fila; el contador de Sin asignar se lee del `h3` (no del `summary`); con N = 0 se afirma la **ausencia** de sección y aviso |
| `b28-reorder-dnd-check.mjs` | Contenedor `.unassigned-section` en lugar de `.unassigned-drawer`; sin `summary.click()` (ya visible) |
| `b29-day-order-tools-check.mjs` | Sin cambios de comportamiento; verifica además que la frase normativa está en el panel |
| `b31-reservas-resumen-check.mjs` | «Ver fechas en Días» comprueba el texto de la fila de fechas (el `input` ya no existe con la hoja cerrada) |
| `phase3f-f/h/j-browser-audit.mjs`, `phase5a-rc-browser-audit.mjs` | Abrir el Sheet antes de escribir fechas |
| `d0b-design-system-hygiene-check.mjs` | Sin `max-width` nuevo; sin hex nuevo |
| `p06-days-capture.mjs` | Capturas del nuevo estado |
| Vitest | `OrderedSequenceBuilder.trip-bounds.test.ts`, `civil-date`, `day-sleeping-summary` |

Resto de la batería de regresión **sin tocar**: B30, B31, B26, B25, B18, B10 (a11y, microcopy, motion), D5, P-04, DD-028, Phase 5A, build, lint (0 errores) y `tsc -b`.

### A.17 Dependencia

Ninguna: A parte directamente de `main` @ `de4b190…`. **Desbloquea B.**

---

## B. P-06·B — Hojas de acción (N2)

**Objetivo.** Sustituir toda acción corta de N1 que hoy expande o usa `select` por una hoja, y fijar la regla «mover = al final».

### B.1 Alcance exacto

1. **Sheet «Acciones de parada»**, abierto por el `⋯` de cada parada (conserva `aria-label="Mover a…"` y el `title`). Filas: **«Mover a otro día…»** y **«Mover a Sin asignar»**. Desaparece el panel inline con «Día», «Posición» y «Mover parada».
2. **Paso «Mover a otro día»** dentro de la **misma** hoja (título «Mover a otro día», con «atrás» en la cabecera): una fila por día distinto del actual, `Día {n} · {fecha corta}`. Al elegir: el lugar se **añade al final** del día destino y la hoja se cierra. Sin selector de posición.
3. **Sheet «Acciones del día»**, abierto por un botón `⋯` (≥ 44 px, `aria-label="Acciones del Día {n}"`) en el extremo del encabezado de cada tarjeta. Filas: **«Mover día antes»**, **«Mover día después»** (deshabilitadas en los extremos), **«Añadir lugar…»** (paso a «Añadir a un día», lista de Sin asignar; deshabilitada si no hay), **«Eliminar día»** (sólo día vacío con más de un día; sustituye al ✕ del encabezado).
4. **Sheet «Añadir a un día»** para cada fila de Sin asignar (sustituye al `select` «Añadir al día…» y al `select` «Añadir lugar» de «Detalles del día»): lista de días; el lugar se **añade al final**.
5. Se **elimina «Posición» de N1**: el panel `⋯` y la opción «Posición n» de «Mover día…». «Detalles del día» pierde su bloque de acciones del día (queda con lo demás).
6. Sin cambio en arrastre (táctil y ratón siguen), en «Probar otro orden» ni en el resto de «Detalles del día».

### B.2 Archivos previsibles

`OrderedSequenceBuilder.tsx` y `.css`; `Sheet.tsx`/`.css` sólo si el paso interior «atrás» exige una prop (cabecera con acción izquierda; retrocompatible); `lib/day-assignment.ts` **sólo** para exponer el helper puro «posición = longitud del día destino» si no existe ya (sin cambiar semántica de las mutaciones); gate nuevo `p06b-n2-sheets-check.mjs`; adaptación de entrada de B27/B28/B29/phase5a (`Mover a…`, «Mover a Sin asignar», «Añadir al día…»); Vitest de contrato de fuente.

### B.3 Invariantes

- Mismas mutaciones atómicas V8 (`relocatePlace`, `removePlaceFromDay`, `addPlaceToDay`, `moveDay`, `removeEmptyDay`); mover = posición final = longitud del día destino **en el instante de elegir**, no calculada antes de abrir la hoja.
- Mover a Sin asignar conserva la poda V8 de referencias (horas manuales, tramos de alojamiento) y su restauración.
- Una hoja **no** apila otra; el paso interior sustituye contenido.
- Foco tras acción: al elemento que ocupa el lugar de la fila afectada; si no existe, al `h3` del día (`tabIndex=-1`). Anuncio por la región viva existente («{lugar} movido al Día N, al final»).
- Hojas no escriben al abrirse/cerrarse.

### B.4 Qué NO tocar

Dominio; fila de fechas/Sheet de fechas (A); arrastre; «Probar otro orden» y `DayOrderToolPanel`; «Detalles del día» más allá de retirar las acciones movidas; «Herramientas…»; History/App.

### B.5 Criterios de aceptación

- [ ] Ninguna acción de parada, de día ni de Sin asignar usa panel inline ni `select` en N1.
- [ ] **M2**: «Posición» no aparece en N1 (texto, `option`, nombre accesible).
- [ ] Mover a otro día añade **al final** (comprobado contra V8 con días de 0, 1 y n lugares); nunca pregunta posición.
- [ ] Mover a Sin asignar → aparece en la sección y en el aviso con el contador correcto; volver con «Añadir a un día» lo añade al final.
- [ ] «Mover día antes/después» reproduce el resultado de `moveDay` y respeta los extremos.
- [ ] **M6**: «Acciones de parada» (2 filas), «Acciones del día» (≤ 4), «Añadir a un día» y «Mover a otro día» con ≤ 7 filas caben sin scroll a 375×667; con > 7 días hay scroll interno con `overscroll-behavior: contain`.
- [ ] Teclado completo: `⋯` abre, Tab recorre filas, Escape cierra, foco vuelve al disparador (o según B.3).

### B.6 Gates

Nuevo `p06b-n2-sheets-check.mjs` (Chromium + WebKit, 8 viewports). **B27**: pasa a certificar mover/Sin asignar por hojas, conservando restauración y poda V8. **B28**: la parte de «Mover a…» pasa a hoja; el arrastre sigue intacto. **B29** y resto: sin cambios. M2 y M6 activos.

### B.7 Dependencia

Requiere **A integrado y certificado** (cabecera de día con sitio para `⋯`; Sin asignar como sección con filas). Desbloquea C.

---

## C. P-06·C — Orden del día y Horarios y traslados (N3) + History

**Objetivo.** Introducir `FocusedView`, convergir con History y retirar los últimos desplegables de la tarjeta y el arrastre táctil.

### C.1 Alcance exacto

1. **`FocusedView` (N3)** y su **puente con History API** (DD-030): `pushState` con `{ nihonTripView: { kind, dayId? } }` al abrir; Back del navegador, gesto atrás de iOS, chevron y Escape convergen en la misma navegación de cierre. N1 queda montado y oculto; al cerrar se restaura scroll (±1 px) y foco en el disparador exacto. Extiende el puente existente de fichas (`nihonPlaceDepth`); ambos campos coexisten y una ficha abierta desde una N3 se cierra antes que la N3. Al recargar con una entrada N3 en `history.state`, la N3 **no** se restaura: la entrada se normaliza con `replaceState`.
2. **N3 «Orden del día»**: `DayOrderToolPanel` promovido a vista. Conserva baseline, propuesta editable (selectores de posición **permitidos aquí**, N3), comparación de traslados, opciones `evidence-complete` etiquetadas y «Usar este orden» con protección *stale*. Lleva la frase «Vosotros decidís el orden…» (con `EvidenceMark ✎`). **Es el lugar del orden táctil** (DD-031). Disparador en la tarjeta: **«Cambiar orden»** (sustituye a «Probar otro orden»; `aria-label="Cambiar orden del Día {n}"`).
3. **N3 «Horarios y traslados del día»**: sustituye al `<details>` «Detalles del día». Contiene lo que éste aún alberga tras B: lista completa de traslados (`DayLegsList`), señal de cierre semanal, horarios/cierres, hora de inicio manual frente al intervalo, totales y alojamiento por tramo. Lleva la frase normativa. Disparador: fila «Horarios y traslados». La línea de aviso de cierre semanal de la tarjeta pasa a decir «· ver Horarios y traslados».
4. **Arrastre sólo con puntero fino** (DD-031): el asa (`.trip-stop__handle`, tanto en paradas como en Sin asignar) sólo se muestra con `(hover: hover) and (pointer: fine)`; por defecto `display: none`. Además `startDrag` ignora `pointerdown` si esa media query no se cumple (defensa en profundidad). En táctil no existe asa.
5. Se retira el `<details>` «Detalles del día» y el panel inline de «Probar otro orden» de la tarjeta (**M3**).

### C.2 Archivos previsibles

`App.tsx` (puente de History: ampliar `onPopState`, `syncNavPush/Replace`, refs espejo), nuevo `components/FocusedView.tsx`/`.css`, `OrderedSequenceBuilder.tsx`/`.css`, `DayOrderToolPanel.tsx`/`.css`, nuevo `components/DayScheduleView.tsx` (extrae los bloques de «Detalles del día»), `lib` sólo si hace falta un helper puro de historial; gates nuevos `p06c-n3-check.mjs`; **reescritura** de B27/B28/B29; Vitest.

### C.3 Invariantes

- Todo el contenido de «Detalles del día» y del panel de orden sigue accesible; no se pierde ningún aviso, descargo ni marcador de evidencia (`Art. 12`, `Art. 4`).
- **Historial limpio**: cerrar por cualquier vía deja la pila como antes de abrir (sin entradas residuales), incluido el caso de abrir/cerrar varias veces y el de combinar con ficha.
- **Un solo origen de verdad** para «¿hay una N3 abierta?»: el estado de `history`; no hay estado paralelo que pueda divergir.
- Escape cierra la N3 **sólo** si no hay un diálogo/hoja abierto por encima (éste lo consume antes).
- Abrir/cerrar N3 no escribe en V8. La aplicación de un orden sigue siendo explícita y atómica.
- Táctil conserva **toda** su capacidad de ordenar (vía N3 y hojas de B), nunca queda sin vía.
- N3 respeta `Art. 8`, `Art. 10`, `Art. 11` y reduce movimiento.

### C.4 Qué NO tocar

Dominio; fila de fechas/hojas (A, B) salvo enlazar disparadores; «Herramientas y datos del viaje» (D); InterHub; Dónde dormir/Reservas/Resumen; el contrato de fichas (DD-015) más allá de coexistir con el nuevo campo de estado.

### C.5 Criterios de aceptación

- [ ] **M3**: no hay `<details>` interactivo dentro de ninguna `.day-card`.
- [ ] **M5**: para cada N3 y para cada vía de cierre (`page.goBack()`, `history.back()`/gesto, chevron, Escape) el scroll de N1 vuelve con ±1 px y el foco al disparador.
- [ ] Back del navegador desde N3 **no** sale de Viaje ni cambia de pestaña; tras cerrar, `history.length` y `history.state` son los previos.
- [ ] Abrir ficha desde N3 y volver cierra primero la ficha, luego la N3.
- [ ] Recargar con N3 abierta lleva a N1 sin entradas residuales.
- [ ] Con puntero fino hay asa y el arrastre funciona (posición exacta, cancelación, desde Sin asignar); con puntero táctil **no existe asa** (`display: none`, fuera del árbol de accesibilidad) y reordenar se hace en «Orden del día».
- [ ] «Cambiar orden» sustituye por completo a «Probar otro orden» (ni visible ni nombre accesible).
- [ ] La frase normativa está en ambas N3 y no en N1.
- [ ] Paridad funcional completa con B29 y con lo que alojaba «Detalles del día».

### C.6 Gates

Nuevo `p06c-n3-check.mjs` (Chromium + WebKit; 8 viewports; M5 en cada uno). **B27 reescrito** (A–K con fechas por Sheet, hojas, Sin asignar visible, N3 de horarios). **B28 reescrito** (ratón: DnD completo; táctil: ausencia de asa + orden en N3; sin auto-scroll espurio). **B29 reescrito** (todas las garantías de dominio vía «Cambiar orden» → N3). Regresión de fichas: B18 back y viaje-lugar sin cambios de aserción. M1 parcial (queda sólo «Herramientas…»), M3 y M5 activos.

### C.7 Dependencia

Requiere **B integrado y certificado** (el táctil necesita las hojas de mover/añadir antes de perder el arrastre). Desbloquea D.

---

## D. P-06·D — Traslados entre ciudades y cierre del programa

**Objetivo.** Última vista N3, retirada del último desplegable y certificación completa.

### D.1 Alcance exacto

1. **N3 «Traslados entre ciudades»**: aloja `InterHubSegmentsSection` (añadir/actualizar/quitar). Entradas desde N1: la fila de traslado entre días (hoy `role="note"`) pasa a ser un botón que abre la vista, y una fila «Traslados entre ciudades» al final de la lista, visible sólo si la ruta tiene ≥ 2 ciudades.
2. **Se elimina `<details class="days-tools">`** («Herramientas y datos del viaje»). Sus restantes contenidos se reubican según **DDR-P06-2** (§9): límites del viaje (`TripBoundsNotice`), plan de zona (`ZonePlanSection`) y gestor de alojamientos (`AccommodationManagerSection`). **D no puede empezar hasta que DDR-P06-2 esté cerrada.**
3. **Certificación final del programa**: M1…M7 completos, B27/B28/B29 definitivos, retirada de CSS muerto (`.days-tools`, `.day-card__details`, `.unassigned-drawer`…), actualización de `05`/`04`/`02` si algún detalle de implementación obliga a precisar, handoff.

### D.2 Archivos previsibles

`OrderedSequenceBuilder.tsx`/`.css`, `FocusedView` (reutilizada), nuevo `components/InterHubView.tsx`, los componentes de destino de DDR-P06-2, `App.tsx` (sólo si el destino es otra pestaña), gates `p06d-final-check.mjs`, Vitest, documentación.

### D.3 Invariantes

Dominio intacto (`InterHubSegments`, zonas, alojamientos y límites con sus reglas actuales); ninguna capacidad se pierde (`Art. 12`); mismo puente de History y mismas garantías M5; `Art. 3`: sin descargos nuevos.

### D.4 Qué NO tocar

Dominio; A, B y C salvo para enlazar; Dónde dormir salvo lo que DDR-P06-2 decida; Reservas/Resumen; dataset.

### D.5 Criterios de aceptación

- [ ] **M1**: ningún control de N1 expande contenido inline; ningún `<details>` ni `aria-expanded` con contenido propio en N1.
- [ ] Todos los traslados entre ciudades existentes siguen editables y las filas entre días reflejan los cambios.
- [ ] Cada contenido de «Herramientas y datos del viaje» es alcanzable en su destino según DDR-P06-2, con el mismo texto normativo y sin nuevos descargos.
- [ ] M1–M7 en verde en Chromium **y** WebKit, 8 viewports.
- [ ] Sin CSS ni DOM huérfano de las expansiones retiradas.

### D.6 Gates

Nuevo `p06d-final-check.mjs` (suite de las métricas del programa), más B27/B28/B29 finales y toda la regresión (B30, B31, B26, B25, B18, B10, D0b, D5, P-04, DD-028, Phase 5A, build, lint, `tsc -b`, Vitest). WebKit obligatorio para los nuevos.

### D.7 Dependencia

Requiere **C integrado y certificado** y **DDR-P06-2 cerrada**. Cierra el programa P-06.

---

## 7. Reglas comunes para quien implemente

1. Un bloque, una rama (`claude/p06-{a|b|c|d}-…`), un PR; **no se crea el PR sin que se pida**. Parte del `main` vigente que contiene los bloques previos.
2. Si algo no está definido aquí, **se detiene** y devuelve `DESIGN DECISION REQUIRED` (`08`). No se improvisa copy, jerarquía ni comportamiento.
3. No se modifican dominio, dataset, almacenamiento ni despliegue.
4. No se relaja ninguna aserción de dominio de un gate; las aserciones de interacción retiradas se **reemplazan** por las de la interacción nueva.
5. Al cerrar cada bloque: tabla de resultados por gate y motor, y esta página actualizada con el estado.

## 8. Estado

| Bloque | Estado |
|---|---|
| A | **Especificado — pendiente de implementar** |
| B | Especificado — espera A |
| C | Especificado — espera B |
| D | Especificado — espera C y DDR-P06-2 |

## 9. Decisión abierta que bloquea sólo a D — DDR-P06-2

La arquitectura aprobada nombra tres vistas N3 y dice que «Herramientas y datos del viaje» desaparece como expansión inline, pero sólo asigna destino a los **traslados entre ciudades**. Quedan sin destino aprobado tres contenidos de ese desplegable: **límites del viaje** (`TripBoundsNotice`), **plan de zona** (`ZonePlanSection`) y **gestor de alojamientos** (`AccommodationManagerSection`, donde se crean y borran alojamientos con coordenadas). Texto completo, opciones y recomendación en `09`, **DDR-P06-2** (estado: **ABIERTA**, `OD-05`). No bloquea A, B ni C.
