# 03 — Sistema de diseño

Todos los valores de esta página son **tokens**. Ningún componente define color,
tipografía, radio, sombra, espaciado, duración o easing fuera de aquí (Art. 10).

Implementación: variables CSS en `:root`, declaradas en un fichero nuevo
`app/src/styles/tokens.css`, importado antes que cualquier otro estilo. `App.css` se
migra bloque a bloque para consumirlas; no se reescribe de golpe.

---

## 1. Color

### 1.1 Por qué esta paleta y no la obvia

La dirección obvia para un producto sobre Japón es **crema + serif de alto contraste +
terracota**. Es exactamente lo que Nihon ya roza hoy (`#f6f4f1` + rojo granate) y es la
combinación más repetida en diseño generado. No aporta identidad.

La paleta de Nihon parte del otro Japón: **la señalética ferroviaria**. Papel
frío-neutro (no crema), tinta con matiz azulado (no negro tintado), y un bermellón
*shu* verdadero —el del torii y el de los sellos— reservado a un único trabajo.

Regla de gasto de color: **el bermellón sólo hace tres cosas** —la marca, el corazón de
«Quiero ir» activo, y el día actual del viaje—. En ningún otro sitio. Es lo que le da
peso.

### 1.2 Tokens base

```css
/* --- Tinta y papel --- */
--ink-900: #14161A;   /* texto principal */
--ink-700: #3A3E44;   /* texto secundario fuerte */
--ink-500: #6B7076;   /* texto atenuado, metadatos */
--ink-300: #A7ACB2;   /* sólo decorativo: separadores, iconos inactivos */

--paper:          #F5F6F4;  /* fondo de la aplicación */
--surface:        #FFFFFF;  /* tarjetas, hojas, paneles */
--surface-sunken: #ECEEEB;  /* campos, zonas inertes, «sin asignar» */
--surface-ink:    #191C21;  /* superficies oscuras: lightbox, scrim sólido */

--line:        #E2E4E0;   /* separador por defecto */
--line-strong: #C9CCC7;   /* borde de control */

/* --- Marca --- */
--shu-600: #C2362F;   /* bermellón. Marca, corazón activo, día actual */
--shu-700: #96271F;   /* estado pulsado */
--shu-050: #FBEFEE;   /* fondo tenue, sólo para el corazón activo */

/* --- Identidad de las personas --- */
--person-a: #1B4D7E;  /* añil (ai) */
--person-b: #7B3F6B;  /* peonía (botan) */
--person-both: var(--shu-600);

/* --- Estados semánticos --- */
--ok-600:   #1F6B4A;  --ok-050:   #E9F3ED;
--warn-600: #8A5A10;  --warn-050: #FAF1E1;
--risk-600: #A3301F;  --risk-050: #FBEDEA;
--info-600: #1B4D7E;  --info-050: #E9EFF5;

/* --- Scrim sobre fotografía --- */
--scrim-bottom: linear-gradient(to top, rgba(20,22,26,.78) 0%, rgba(20,22,26,.42) 34%, rgba(20,22,26,0) 68%);
--scrim-top:    linear-gradient(to bottom, rgba(20,22,26,.46) 0%, rgba(20,22,26,0) 100%);
```

### 1.3 Reglas de uso

- **Los cuatro colores semánticos no se usan nunca para identidad de persona**, y los
  dos colores de persona no se usan nunca para estado. Sin excepciones.
- **`--person-a` y `--person-b` se distinguen en deuteranopia y protanopia** (azul vs.
  magenta), pero el color **nunca** es el único portador: toda marca de persona lleva
  además la inicial del nombre.
- **El nivel de interés ya no tiene color propio.** Se retiran
  `--color-interest-1…5`. El único nivel que se muestra en tarjeta es
  «Imprescindible», y usa tinta sobre papel con su glifo `★`, no un color.
- **Modo oscuro**: fuera de alcance para esta evolución, pero todos los tokens son
  semánticos por rol precisamente para poder añadirlo después sin tocar componentes.
  Está **prohibido** escribir un hex literal alegando que «sólo hay modo claro».
- Verificación obligatoria: un test automatizado comprueba 4.5:1 en texto y 3:1 en
  gráficos portadores de significado, para todas las parejas token-sobre-token usadas.

### 1.4 Gramática de evidencia — sin color

La honestidad de Nihon se codifica con **forma y peso, no con matiz**. Así el color
queda libre para identidad y estado, y la evidencia se lee igual en escala de grises.

| Nivel | Marcador | Significado | Ejemplo |
|---|---|---|---|
| **Verificado** | `◼` relleno | Lo dice una fuente oficial consultada | Horario de la web del templo |
| **Registrado** | `◧` medio | Está en el dataset de investigación | «2–4 semanas de antelación» |
| **Estimado** | `◇` hueco | Lo calcula Nihon a partir de otros datos | Distancia geográfica entre dos lugares |
| **Nihon dice** | `✎` pluma | Juicio editorial, no un hecho | «Ruidoso y enorme» |

Todos en `--ink-500`, 11 px, siempre acompañados de su etiqueta o disponibles como
`title`/`aria-label`. Un bloque con marcador **no lleva además un párrafo explicando lo
mismo**: el marcador sustituye al descargo.

`Estimado` y `Registrado` con antigüedad superior al umbral de `source-freshness.ts`
añaden un sufijo textual («consultado en 2026-09»), no un color de alarma.

---

## 2. Tipografía

### 2.1 Las dos familias, y qué significan

No es «display vs. body». Es **voz vs. registro**, y esa distinción es la tesis del
producto:

| Familia | Rol | Qué lleva |
|---|---|---|
| **Zen Kaku Gothic New** | **Voz** — lo que Nihon *dice* | Nombres de lugar y ciudad, nombres en japonés, títulos de pantalla, «Por qué vale la pena», textos editoriales, estados vacíos, nombres de personas |
| **IBM Plex Sans** | **Registro** — lo que Nihon *anota* | Horas, fechas, duraciones, cantidades, chips, datos prácticos, filtros, etiquetas de evidencia, botones, microcopy de sistema |

**Por qué.** Zen Kaku Gothic New es una gótica humanista **diseñada en Japón** que
cubre latín y japonés en la misma voz: `Shibuya Crossing` y `渋谷スクランブル交差点`
dejan de parecer dos productos distintos, que es como se ven hoy. IBM Plex Sans aporta
cifras tabulares reales y un registro de diseño de información —el de la señalética—
para todo lo que es dato. La pareja es claramente distinta y **significa algo**:
cuando el tipo cambia, cambia quién habla.

```css
--font-voice:  "Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif;
--font-record: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
```

Ambas con licencia SIL OFL. **Se autoalojan** con subconjuntos (`latin`,
`latin-ext`, y para Zen Kaku además `japanese` cargado con `unicode-range` para que un
usuario que no abra un nombre japonés no descargue kanji). `font-display: swap`.
Pesos: Zen Kaku 400/500/700; Plex 400/500/600.

### 2.2 Escala

Base **16 px** (hoy son 15, lo que provoca zoom automático en inputs de iOS).

| Token | Tamaño / interlínea | Familia | Uso |
|---|---|---|---|
| `--type-display` | 32 / 36, `-0.02em` | voice 500 | Nombre de lugar en ficha, título de pantalla grande |
| `--type-title-l` | 24 / 30, `-0.01em` | voice 500 | Nombre de ciudad, títulos de sección mayores |
| `--type-title-m` | 20 / 26 | voice 500 | Nombre en tarjeta grande, «Día 3» |
| `--type-title-s` | 17 / 24 | voice 500 | Nombre en tarjeta compacta, cabecera de sheet |
| `--type-quote` | 19 / 30 | voice 400 | «Por qué vale la pena». El mejor tratamiento del producto |
| `--type-body` | 16 / 26 | record 400 | Texto corrido |
| `--type-body-s` | 14 / 21 | record 400 | Razón en tarjeta, descripciones secundarias |
| `--type-label` | 13 / 16, `+0.005em` | record 500 | Chips, botones, etiquetas de dato |
| `--type-caption` | 12 / 16 | record 400 | Créditos, notas al pie, marcadores de evidencia |
| `--type-num` | hereda, `tabular-nums` | record 500 | Cualquier cifra en columna: horas, duraciones, contadores |

En `md`+ se permite subir `--type-display` a 40/44 y `--type-quote` a 21/32. Nada más
escala con el viewport.

### 2.3 Reglas tipográficas

- **Caja de frase siempre.** Prohibidas las etiquetas en MAYÚSCULAS con
  `letter-spacing` (hoy: «INFORMACIÓN PRÁCTICA», «REGIONES», «NIVEL DE INTERÉS»).
- **Prohibidos los *eyebrows***: nada de una etiqueta pequeña encima de un título. La
  categoría y el barrio van **debajo** del nombre.
- **Máximo un `·` por línea.** Prohibidas las cadenas de tres partes (`A · B · C`).
  Hoy están en tarjeta, ficha y planner.
- **Longitud de línea ≤ 72 caracteres** en texto corrido, en cualquier viewport.
- **Sin cursiva para énfasis** en interfaz; la cursiva se reserva a citas textuales de
  la fuente.
- **Ninguna palabra suelta coloreada o en negrita dentro de un titular.**
- Los nombres en japonés van siempre en `--font-voice` con `lang="ja"`.

---

## 3. Espaciado y rejilla

Base **4 px**. Toda medida de separación sale de esta escala.

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 20px;  --space-6: 24px;  --space-8: 32px;  --space-10: 40px;
--space-12: 48px; --space-16: 64px; --space-20: 80px;
```

- **Margen de pantalla**: `--space-4` (16) en `base`, `--space-6` en `sm`+,
  `--space-8` en `lg`+.
- **Separación entre tarjetas de una lista**: `--space-3`.
- **Separación entre secciones de una ficha**: `--space-8`.
- **Ritmo interno de una tarjeta**: `--space-3` entre bloques, `--space-1` dentro de
  una línea.
- **Áreas seguras**: todo contenido ancorado abajo suma `env(safe-area-inset-bottom)`.

## 4. Radios

```css
--radius-xs: 6px;    /* chips, marcadores */
--radius-sm: 10px;   /* botones, campos */
--radius-md: 14px;   /* tarjetas compactas, contenedores de dato */
--radius-lg: 20px;   /* tarjeta de lugar, fotografía */
--radius-xl: 28px;   /* hojas inferiores (sólo esquinas superiores) */
--radius-full: 999px;/* tokens de persona, contadores, píldoras */
```

Regla: **el radio codifica jerarquía**. Está prohibido aplicar el mismo radio a todo.
Una hoja es más redondeada que una tarjeta, y una tarjeta más que un chip.

## 5. Elevación

Sólo tres niveles. Prohibida cualquier sombra fuera de esta lista.

```css
--elev-0: none;                                   /* sobre papel: se separa con --line */
--elev-1: 0 1px 2px rgba(20,22,26,.05),
          0 8px 20px -10px rgba(20,22,26,.12);    /* tarjeta */
--elev-2: 0 -2px 8px rgba(20,22,26,.06),
          0 24px 56px -16px rgba(20,22,26,.26);   /* hoja, panel flotante, lightbox */
```

Las superficies sobre fotografía no usan sombra: usan `--scrim-*`.

## 6. Motion

```css
--dur-fast: 140ms;   --dur-base: 220ms;   --dur-sheet: 320ms;
--ease-standard: cubic-bezier(.2,.8,.2,1);
--ease-enter:    cubic-bezier(.16,1,.3,1);
--ease-exit:     cubic-bezier(.4,0,1,1);
```

Sólo existen **cinco movimientos nombrados**. Cualquier otro requiere revisión de
diseño:

1. `sheet-rise` — hoja inferior entra desde abajo, `--dur-sheet` / `--ease-enter`.
2. `push` — pantalla de detalle entra desde la derecha (o desde abajo en `base`),
   `--dur-base`.
3. `cross-fade` — cambio lista ↔ mapa, `--dur-fast`, sin desplazamiento.
4. `press` — `scale(.98)` durante la pulsación, `--dur-fast`.
5. `mark` — el corazón al activarse: escala 1 → 1.18 → 1, `--dur-base`. Es **el único
   momento celebratorio del producto**.

Prohibido: animaciones de entrada escalonadas al hacer scroll, transiciones de hover en
todas las tarjetas, parallax, cualquier movimiento no disparado por el usuario salvo el
skeleton de carga.

`prefers-reduced-motion: reduce` → todo se reduce a opacidad, ≤100 ms, y `mark` se
convierte en un cambio de estado instantáneo.

## 7. Áreas táctiles y foco

```css
--tap-min: 44px;      /* mínimo absoluto */
--tap-primary: 48px;  /* acciones primarias y barra de pestañas */
--tap-gap: 8px;       /* separación mínima entre dos objetivos adyacentes */
```

Foco: `outline: 2px solid var(--ink-900); outline-offset: 2px;` sobre superficies
claras, y `--surface` sobre superficies oscuras o fotografía. Se retira el anillo azul
actual de 3 px, que choca con el bermellón.

## 8. Iconografía

**Cero emoji en la interfaz** (hoy hay al menos 14 distintos en el cromo).

Set propio de iconos de línea, trazo **1.5 px**, caja **24×24**, terminaciones
redondeadas, entregados como componentes React desde `app/src/icons/`. Tamaños
permitidos: 16, 20, 24. Heredan `currentColor`.

Inventario mínimo: `explorar`, `corazón`, `corazón-relleno`, `calendario`, `personas`,
`buscar`, `filtro`, `mapa`, `lista`, `atrás`, `cerrar`, `más`, `info`, `reloj`,
`ticket`, `cama`, `tren`, `a-pie`, `aviso`, `enlace-externo`, `descargar`, `arriba`,
`abajo`, `arrastrar`, `expandir`.

**Categorías**: el dataset trae el emoji dentro de la propia etiqueta
(`⛩️ Templos y santuarios`). No se toca el dataset: se añade un mapa
`categoría → icono` en presentación y **se recorta el emoji al renderizar**. Las 29
categorías con duplicados (`🍜`/`🍶 Gastronomía`, `🌿`/`🌸 Naturaleza`,
`🎭`/`🍵 Cultura tradicional`) se colapsan a **26 etiquetas de presentación** mediante
ese mismo mapa, sin modificar el workbook.

## 9. Cartografía

El mapa actual usa teselas OSM crudas: saturadas, con toda la rotulación viaria y
municipal. Es el motivo principal de que la vista de ciudad parezca un clon de Google
Maps.

- **Teselas**: base gris claro sin etiquetas de comercio (CARTO Positron o equivalente
  apagado). Si su licencia no encaja, alternativa aceptada: OSM con filtro CSS
  `saturate(.25) contrast(.92) brightness(1.04)`. La elección concreta es
  `DD-003` en `09_DECISIONES_DE_DISENO.md`.
- **Marcadores**: el color codifica **quién quiere ir**, no la calidad editorial (que
  es casi constante).

  | Estado | Marcador |
  |---|---|
  | Nadie lo ha marcado | punto 10 px `--ink-500`, opacidad .7 |
  | Lo quiere la persona A | punto 12 px `--person-a`, anillo blanco |
  | Lo quiere la persona B | punto 12 px `--person-b`, anillo blanco |
  | Lo queréis los dos | punto 14 px `--shu-600`, anillo blanco |
  | Seleccionado | nodo 20 px con halo, encima de todos |

- **Agrupación**: por encima de 12 marcadores visibles, se agrupan en un círculo con
  cifra (`--type-num`), estilo indicador de estación.
- **Leyenda**: una línea plegable, no un panel permanente. En teléfono sólo aparece
  sobre el mapa, nunca sobre la lista.

## 10. Voz y microcopy

Español de España, tuteo a la persona y **«vosotros» para la pareja** (ya es el uso
actual: «lo que queráis ver»). Frases en caja de frase, verbos activos, sin signos de
exclamación, sin emoji.

### Léxico obligatorio

| No decir | Decir |
|---|---|
| Construir recorrido | Planear el viaje |
| Recorrido / secuencia | El viaje · el día |
| Orden A / Orden B | Este orden / otro orden |
| Analizar selección | En qué coincidís |
| Tramo | Traslado |
| `Dato: «…»` | Texto entre comillas con marcador `◧ Registrado` |
| Grado A | (no se muestra; sólo en «Fuentes») |
| Provenance / freshness | Fuentes · Consultado en… |
| 3/4 tramos cubiertos | Falta el traslado de X a Y |
| Guardar en Quiero ir | Quiero ir |
| Submit / Aceptar | El verbo de lo que pasa: «Guardar copia», «Añadir al día 2» |

### Reglas de copy

- **Una acción conserva su nombre en todo el flujo**: el botón «Quiero ir» produce el
  estado «Quiero ir», no «Guardado».
- **Los estados vacíos son invitaciones**, no disculpas: «Todavía no habéis marcado
  nada en Tokio. Pulsa el corazón en cualquier lugar que te llame.»
- **Los errores dicen qué pasó y qué hacer**, sin pedir perdón: «No se pudo cargar la
  imagen. Vuelve a intentarlo o sigue sin ella.»
- **Un aviso por pantalla como máximo** (Art. 3). El resto, marcadores de evidencia.
- Prohibido `→` al final de un botón o enlace.
