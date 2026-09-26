# 04 — Reglas de componentes

Contrato de cada componente reutilizable. Un agente de ingeniería puede construirlos
sin inventar nada. Lo que no esté aquí ni en `05`, se pregunta.

Convención: todo componente consume tokens de `03`. Ninguno acepta props de estilo
(`color`, `size` libre, `className` arbitrario para pintar). Las variantes son
enumeradas.

---

## 1. `PersonToken`

La marca de identidad de una persona. Aparece en cabecera, tarjetas, planner y
«Quiero ir».

- **Forma**: círculo `--radius-full`, fondo `--person-a` / `--person-b`, texto blanco.
- **Contenido**: **la inicial** del nombre en `--font-record` 600. Nunca sólo color.
- **Tamaños**: `xs` 18 px (dentro de una línea de texto), `sm` 24 px (cabecera,
  tarjetas), `md` 40 px (Nosotros).
- **Estado «los dos»**: no se apilan dos tokens. Se usa **un token bermellón con el
  glifo de dos personas**, con `aria-label="Los dos queréis ir"`.
- Si el nombre está vacío, la inicial es `A` / `B` según el orden de creación.

## 2. `EvidenceMark`

Implementa la gramática de `03 §1.4`.

- **Props**: `level: "verificado" | "registrado" | "estimado" | "nihon"`,
  `detail?: string` (p. ej. «consultado en 2026-09»), `label?: boolean`.
- **Render**: glifo (`◼ ◧ ◇ ✎`) 11 px `--ink-500` + etiqueta opcional
  `--type-caption`. Cuando `label` es falso, el texto va en `aria-label` y `title`.
- **Prohibido**: colorear el marcador, usarlo como badge destacado, o acompañarlo de
  un párrafo que repita lo mismo.
- **El marcador sustituye al descargo, y se queda con su información (DDR-06).** Cuando un
  bloque cambia un párrafo de descargo por marcadores, eso es una **reubicación de
  información, no una pérdida**: lo que el párrafo afirmaba tiene que seguir siendo
  recuperable desde el marcador —en `detail`, y por tanto en `aria-label`/`title` cuando
  `label` es falso—, por elemento y no en general. Retirar el párrafo **sin** trasladar su
  semántica sí sería una pérdida, y está prohibido. El caso que fija la regla es «Cerca de
  aquí» (`05 §5` pt. 12): cada traslado conserva en su marcador la distinción que la nota al
  pie explicaba para la lista entera —ruta validada estática frente a estimación geográfica
  frente a horario en vivo—, sin inventar procedencia ni subir de nivel de confianza.

## 3. `Chip`

Unidad de metadato. Reemplaza los `place-card__fact` actuales.

- **Variantes**: `neutral` (por defecto), `attention` (aviso real),
  `person` (lleva `PersonToken`).
- **Anatomía**: icono 16 px opcional + texto `--type-label`, altura 28 px, padding
  `--space-1 --space-2`, `--radius-xs`, fondo `--surface-sunken`, texto `--ink-700`.
  `attention` usa `--warn-050` / `--warn-600`.
- **No es interactivo** salvo en la hoja de filtros, donde `ChipToggle` añade estado
  `aria-pressed` y altura 40 px.
- **Límite duro**: en tarjeta de lugar, **máximo 2 chips**. En ficha, sin límite pero
  agrupados en su sección.

## 4. `Button`

- **Variantes**: `primary` (fondo `--shu-600`, texto blanco), `secondary` (fondo
  `--surface`, borde `--line-strong`), `quiet` (sin fondo ni borde, texto `--ink-700`),
  `danger` (texto `--risk-600`, sin fondo).
- **Tamaños**: `md` 44 px, `lg` 48 px (acción primaria de pantalla, ancho completo).
- Texto en `--font-record` 500, caja de frase, **sin flecha final**.
- Estado pulsado: `press` de `03 §6`. Estado deshabilitado: opacidad .45, sin
  `pointer-events`, y **siempre** acompañado de un texto que explique por qué.
- Un botón de icono sin texto exige `aria-label` y `title`.

## 5. `PlaceCard`

El componente más importante del producto. Sustituye al actual, que llega a mostrar
seis chips con emoji.

```
┌─────────────────────────────┐
│                         (♡) │  ← acción guardar, 40px, arriba-dcha
│        FOTOGRAFÍA           │
│     (4:3 a una columna)     │
│  ★ Imprescindible           │  ← sólo si grado S
│  Shibuya Crossing           │  ← voice 20/26, blanco sobre scrim
│  Ciudad · Shibuya           │  ← record 13, blanco 82%
├─────────────────────────────┤
│ El movimiento colectivo,    │  ← differentiator, body-s, 2 líneas máx
│ más que un monumento…       │
│ [⏱ 20–40 min] [🎟 Reserva]  │  ← máximo 2 chips
└─────────────────────────────┘
```

**Reglas**

0. **Ancho mínimo (DD-016)**: la tarjeta **nunca** mide menos de **264 px** de ancho.
   Es la restricción que manda sobre cualquier rejilla que la contenga: si a un ancho
   dado no caben `n` tarjetas de 264 px, la rejilla baja a `n−1` columnas, sea cual sea
   el viewport. El número de columnas se calcula sobre el **ancho efectivo del
   contenedor** (`02 §D5`), nunca sobre el del viewport.
1. **Proporción (DD-016)**: 4:3 cuando la rejilla le da **una** columna, 16:9 cuando le
   da **dos o más**. Lo que manda es el número de columnas, no el breakpoint: en `md`,
   abrir la ficha estrecha la lista a una columna y la tarjeta vuelve a 4:3 sin que el
   viewport cambie.
2. **Nombre sobre la fotografía**, con `--scrim-bottom` obligatorio. Clamp a 2 líneas.
   Si el nombre supera 2 líneas, se reduce a `--type-title-s`, nunca se trunca con
   puntos suspensivos en mitad de una palabra.

   **Sin `text-shadow` (DD-016, `03 §5`).** La versión anterior de esta regla pedía un
   `text-shadow` «de respaldo», que `03 §5` prohíbe expresamente («las superficies sobre
   fotografía no usan sombra: usan `--scrim-*`») y que además enmascaraba el problema
   real: a 16:9 la banda de texto ocupa ~50 % de la fotografía, y ahí `--scrim-bottom`
   ya vale ~0.05. La banda —insignia, nombre y línea de categoría·zona— lleva **su
   propio suelo de scrim**, con el mismo valor que `--scrim-bottom` declara en su parada
   inferior, de modo que el scrim efectivo sea **≥0.60 bajo todo el texto** y el
   contraste llegue a AA con la fotografía más clara del catálogo (`03 §5`, «Scrim bajo
   texto»). Ningún token nuevo.
3. **Insignia de nivel**: **sólo** grado S («Imprescindible»), glifo `★` + texto,
   blanco sobre scrim, sin fondo de color. Los grados A/B/C/D no muestran insignia en
   tarjeta (Art. 6).
4. **Acción guardar**: botón circular 40 px, fondo `rgba(255,255,255,.92)`, icono
   corazón `--ink-700`. Al estar marcado por la persona activa: fondo `--shu-600`,
   icono blanco, animación `mark`. `aria-pressed` obligatorio.
5. **Estado de la otra persona**: si la otra persona ha marcado el lugar, un
   `PersonToken` `xs` aparece **junto al corazón**, no dentro de él. Si lo han marcado
   las dos, un único token bermellón. Si nadie más ha opinado, no se renderiza nada —
   nunca «no ha dicho nada».
6. **Razón**: el `differentiator`; si falta, `description`. `--type-body-s`, 2 líneas.
7. **Chips**: duración siempre. Segundo chip por prioridad fija, sólo uno:
   `aviso real` > `reserva obligatoria` > `joya escondida`. Todo lo demás vive en la
   ficha.
8. **Sin fotografía**: ver `PhotoPlaceholder` (§9) — nunca un hueco gris.
9. **Toda la tarjeta abre el lugar** (DDR-02): fotografía, nombre, razón, chips y
   cualquier otra superficie no interactiva. El control principal pertenece
   estructuralmente al nivel del `<article>`/`PlaceCard` y cubre exactamente la tarjeta;
   **no nace dentro de `.place-card__media`**, cuyo `overflow: hidden` se conserva. El
   nombre continúa visualmente sobre la fotografía. Corazón y token de persona quedan
   por encima y conservan su comportamiento independiente, sin controles interactivos
   anidados ni targets invisibles fuera de la tarjeta. El control principal es enfocable
   y operable por teclado.
10. **Variante `compact`**: fila horizontal, miniatura 72×72 `--radius-md`, nombre
    `--type-title-s`, una línea de metadato. Se usa en «Quiero ir», planner, «Cerca
    de aquí» y resultados de búsqueda.
11. **Nombre accesible = identificación visible (DD-028, 2026-09-26).** El nombre
    accesible del control que abre la ficha **nunca puede ser un subconjunto** de la
    información visible que identifica la tarjeta. Nombra el lugar con la **misma** línea
    de ubicación que la variante pinta y en el mismo orden lógico:
    - `normal`: «{nombre}. {nivel}. {categoría} en {zona}.» — la banda pinta
      «{categoría} · {zona}».
    - `compact`: «{nombre}. {nivel}. {categoría} en {barrio}, {ciudad}.», o
      «… en {ciudad}.» sin barrio — la fila pinta «{categoría} · {barrio}, {ciudad}»
      (`compactPlaceLine`, P0-5c).

    El nivel puede aparecer sólo en el nombre accesible (regla 3); lo que no puede es
    faltar en él algo que la tarjeta muestra para identificar el lugar. Si en el futuro la
    parte visible de `PlaceCard` gana información identificativa, su nombre accesible se
    actualiza **en el mismo cambio**. Cobertura: `PlaceCard.test.ts` y
    `app/scripts/dd028-placecard-accessible-name-check.mjs` (árbol de accesibilidad real).

## 6. `PhotoGallery`

- **Ficha en teléfono**: a sangre, proporción **4:5** (vertical: la fotografía es el
  contenido, no una franja). En `md`+ dentro del panel: 4:3.
- **Navegación**: deslizamiento horizontal nativo con `scroll-snap`, no un carrusel con
  índice en estado. Flechas sólo en `md`+.
- **Indicador**: píldora `1/3` abajo-derecha, `--type-num`, fondo
  `rgba(20,22,26,.55)`. Puntos **sólo** cuando hay ≤5 imágenes, centrados abajo.
  Con 1 sola imagen no hay ni píldora ni puntos.
- **Créditos**: **nunca en el flujo**. Botón `ⓘ` 32 px abajo-izquierda que abre
  `CreditsSheet`. Corrige el defecto D2.
- **Lightbox**: toque en la imagen. Fondo `--surface-ink`, imagen original, zoom por
  pellizco, deslizar abajo para cerrar, `×` arriba-derecha. Se conserva la trampa de
  foco actual, que es correcta.
- **Carga**: LQIP de fondo → imagen. Sin skeleton gris. Primera imagen de la ficha
  `fetchpriority="high"`.

## 7. `CreditsSheet`

Hoja inferior. Contiene, por cada imagen visible: fuente (enlace), autor, licencia
(enlace), título del archivo original y nota de reprocesado. Toda la información de
atribución actual se conserva íntegra; sólo cambia de sitio.

Encabezado: «Fotografía de {lugar}». Al pie: enlace a «Fuentes y licencias» en
Nosotros.

## 8. `Sheet` (hoja inferior)

Contenedor de todo lo que hoy es modal centrado.

- Entra con `sheet-rise`. Fondo `--surface`, `--radius-xl` sólo arriba, `--elev-2`.
- Barra de arrastre 36×4 px `--line-strong` centrada; arrastrar hacia abajo cierra.
- Altura: `auto` hasta un máximo del 88 % de la altura visible; si el contenido es
  mayor, scroll interno con `overscroll-behavior: contain`.
- Fondo de página: `rgba(20,22,26,.38)`, cierra al tocar.
- Cabecera pegajosa con título `--type-title-s` y `×` a la derecha.
- `role="dialog"`, `aria-modal`, trampa de foco, `Escape` cierra, foco devuelto al
  disparador.
- En `md`+ una hoja puede renderizarse como panel lateral derecho de 420 px. Mismo
  componente, misma API.

## 9. `PhotoPlaceholder`

Sustituye al recuadro con emoji actual. Un lugar sin fotografía **no puede parecer un
error**.

- Fondo `--surface-sunken` con una trama sutil de líneas diagonales al 4 % de opacidad
  (referencia: papel de plano ferroviario).
- Icono de categoría 32 px `--ink-300` centrado en el tercio superior.
- Nombre del lugar en `--font-voice` `--type-title-m`, `--ink-700`.
- Debajo, el `imageBrief` en `--type-caption` `--ink-500`, 2 líneas máx, precedido de
  `EvidenceMark level="nihon"`.
- Etiqueta discreta: «Fotografía pendiente».
- Debe verse **deliberado**: una lista que mezcla fotos y marcadores no puede parecer
  rota.

## 10. `TabBar` / `NavRail`

- `base`–`sm`: barra inferior fija, 4 destinos, altura 56 px + `safe-area-inset-bottom`,
  fondo `--surface`, borde superior `--line`. Cada ítem: icono 24 px + etiqueta 11 px.
  Activo: icono relleno + `--ink-900`; inactivo: `--ink-500`.
- «Quiero ir» lleva contador `--radius-full` `--shu-600` cuando es > 0. Ninguna otra
  pestaña lleva indicador.
- `md`+: raíl vertical izquierdo de 88 px (icono + etiqueta); en `xl` puede expandirse
  a 232 px con etiqueta a la derecha del icono.
- La barra **no se oculta al hacer scroll**. La previsibilidad vale más que 56 px.

## 11. `ScreenHeader`

- Altura 56 px. Contenido máximo: **atrás/título + una acción**.
- Sobre fotografía es transparente con `--scrim-top`; sobre papel es `--surface` con
  borde inferior `--line` que **sólo aparece al hacer scroll**.
- Título en `--font-voice` `--type-title-m`. Si la pantalla es una ciudad, el título
  lleva un icono de expandir y abre el selector de ciudad como `Sheet`.
- El `PersonToken` de la persona activa vive aquí, a la derecha, 24 px. Es el **único**
  resto del antiguo conmutador «Eres» (ver `02 §D4`).
- Prohibido: subtítulos de estadísticas («57 lugares verificados», «47 prefecturas ·
  6 con lugares verificados…»). Esa información va al cuerpo, no al cromo.

## 12. `SearchBar` + `FilterButton`

Una sola fila pegajosa de 48 px bajo la cabecera de una ciudad. Sustituye a las dos
barras actuales.

```
[ ⌕ Buscar en Tokio            ] [ Filtros ② ] [ Mapa ]
```

- El campo abre la búsqueda como `Sheet` de pantalla casi completa con resultados en
  vivo (`PlaceCard compact`).
- `Filtros` abre `FilterSheet`, con contador de filtros activos.
- `Mapa` alterna a la lente de mapa con `cross-fade`; su etiqueta cambia a `Lista`.
- Tamaño de fuente del input **≥16 px** para evitar el zoom automático de iOS.

## 13. `FilterSheet`

Hoy es un formulario largo de casillas. Pasa a ser una hoja con grupos plegables:

- Orden fijo: **Nivel de interés · Categoría · Duración · Reserva · Afluencia · Joyas**.
- Cada grupo es una fila de `ChipToggle` que envuelve; sin casillas de verificación.
- Contador de resultados en vivo en la cabecera pegajosa: «57 lugares».
- Pie fijo: `Limpiar` (quiet) + `Ver 57 lugares` (primary, ancho completo).
- Se conservan **todos** los filtros existentes y su vocabulario de lenguaje llano.

## 14. `DayTimeline` y `TripStop`

El componente que materializa la metáfora del diagrama de línea.

```
  ┃  ┌──────────────────────────────────────┐
  ●──┤ [foto]  Shibuya Crossing             │  ← TripStop
  ┃  │         20–40 min   ◧                │
  ┃  └──────────────────────────────────────┘
  ┆   a pie · 13 min  ◼                        ← conector
  ┃  ┌──────────────────────────────────────┐
  ●──┤ [foto]  Meiji Jingū                  │
```

- **Raíl**: línea vertical 2 px `--line-strong` a 12 px del borde izquierdo. Los nodos
  son círculos de 10 px rellenos de `--ink-700`; el día en curso usa `--shu-600`.
- **`TripStop`**: miniatura 56×56, nombre `--type-title-s`, duración `--type-num`,
  `EvidenceMark` cuando procede. Arrastrable (`aria-grabbed`, y **alternativa por
  teclado obligatoria**: menú «Mover a…»).
- **Conector**: línea punteada + texto del traslado + marcador de evidencia. Sin
  traslado registrado: texto `--ink-500` «Traslado sin datos», **nunca en rojo** y
  nunca con `?`. No es un error: es una ausencia conocida.
- **Traslado entre ciudades**: variante de conector con icono de tren, fondo
  `--surface-sunken`, ocupa el ancho completo entre dos días.
- Se elimina el trío de botones circulares `↑ ↓ ×` por fila. Reordenar es arrastrar;
  el resto de acciones viven en una hoja al pulsar largo o en el icono de arrastre.

## 15. `EmptyState`

- Icono de línea 32 px `--ink-300`, título `--font-voice` `--type-title-m`, una frase
  `--type-body-s` `--ink-500`, y **una acción** si la hay.
- Es una invitación, nunca una disculpa. Texto obligatorio por pantalla en `05`.

## 16. `Toast`

Se conserva el `SaveToast` actual. Ajustes: se ancla **sobre la barra de pestañas**,
no sobre el borde inferior; duración 2.400 ms; una sola línea; puede llevar una acción
(«Deshacer»). Nunca dos toasts simultáneos.

## 17. `PersistenceNotice` (DDR-03)

El aviso de que Nihon **no ha conseguido guardar** en el dispositivo. No es un `Toast`:
un `Toast` se va solo a los 2.400 ms, y este estado dura hasta que se resuelva.

```
┌──────────────────────────────────────────────┐
│ No pudimos guardar los cambios en este       │
│ dispositivo. Pueden perderse al cerrar la    │
│ app.                          [ Reintentar ] │
└──────────────────────────────────────────────┘
```

**Reglas**

1. **Copy exacto**, sin variantes: «No pudimos guardar los cambios en este dispositivo.
   Pueden perderse al cerrar la app.» Acción: «Reintentar».
2. **Uno solo, en la raíz.** Se renderiza una única vez para toda la aplicación, desde una
   **única fuente de verdad** del estado de persistencia. Nunca uno por destino, nunca dos
   a la vez.
3. **Sólo en error.** Mientras la persistencia funciona no se renderiza nada; y mientras hay
   error, **ninguna superficie puede afirmar** que los cambios quedaron guardados.
4. **Posición**: anclado sobre la barra de pestañas, el mismo idioma que §16, y **por encima
   de la ficha** en el orden de apilamiento, para seguir visible con la ficha abierta
   —incluido su modo a pantalla completa de `05 §5`—. No tapa la navegación ni los controles
   de la ficha. Queda **por debajo de `Sheet` y de cualquier superficie modal enfocada**
   (`04 §8`) y **reaparece al cerrarlas**: una hoja modal tiene su propio fondo de página y es
   una tarea enfocada; la ficha no lo es.
5. **Aparece con el primer fallo real**, incluido el de la escritura que la aplicación hace al
   arrancar. No espera a que la persona toque nada: si ya no se puede guardar, decirlo pronto
   evita trabajo que se perdería. Con la persistencia sana no se renderiza nunca, que es lo que
   garantiza que no hay falsos positivos.
6. **No es modal y no roba el foco.** Se anuncia a la tecnología asistiva al entrar en error
   (`role="alert"`, que anuncia sin mover el foco). Alcanzable por teclado en el orden natural.
7. **«Reintentar»** es un `Button` `quiet` con área táctil ≥44 px (`03 §7`). Ejecuta una
   escritura real; **nunca descarta ni reinicia datos**. Éxito ⇒ estado normal y el aviso
   desaparece. Fallo ⇒ estado y aviso permanecen.
8. **Sólo tokens.** Ningún hex crudo, ningún estilo en línea, ninguna sombra fuera de `03 §5`.
