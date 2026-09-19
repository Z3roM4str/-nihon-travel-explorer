# 01 — Visión y diagnóstico

## A. Diagnóstico ejecutivo

Auditoría realizada sobre el código de `v1.1.0` y sobre la aplicación desplegada, en
viewport de iPhone (393×852) y escritorio (1440×900).

### La causa raíz, en una frase

> El rigor de Nihon sobre la verdad es excepcional, pero está expresado como **texto y
> controles** en lugar de como **lenguaje visual**. Por eso la aplicación se lee como
> sus propias notas de investigación en vez de como un producto de viaje.

Todo lo demás se deriva de ahí. Nihon no tiene un problema de funcionalidad: tiene un
problema de **codificación**. Sabe cosas valiosísimas y las dice en prosa, en
mayúsculas, en cajas de aviso y en nombres de ingeniería.

### Los cinco fallos estructurales

**1. Impuesto de cromo.** En un iPhone, la pantalla de una ciudad apila cuatro barras
permanentes —cabecera, barra de hubs, barra Lista/Mapa/Filtros, y la barra inferior
«Quiero ir»—. Son **≈330 px de 852**: el **39 % de la pantalla es navegación antes de
ver una sola tarjeta**. Peor: la ficha de un lugar se abre *por debajo* de esas
barras, así que la fotografía principal queda comprimida en una franja de ~200 px.

**2. Interfaz gobernada por descargos.** El planner abre con dos cajas de aviso antes
de cualquier contenido, y repite otras tres más abajo. La ficha de lugar muestra un
recuadro ámbar de febrero–marzo 2027 incluso cuando no hay nada que avisar («No hay
cierre específico confirmado»). El resultado es fatiga de alerta: si todo avisa, nada
avisa. Y el producto gasta una parte enorme de su presupuesto de pantalla en decir lo
que **no** hace.

**3. Señales que no discriminan.** 179 de 214 lugares (**84 %**) son grado S o A, así
que la insignia «Imprescindible / Muy recomendable» aparece prácticamente en cada
tarjeta y no informa de nada. Además la ficha muestra «Muy recomendable **· Grado A**»:
traduce la letra a lenguaje llano y a continuación enseña la letra igualmente.

**4. Vocabulario de repositorio.** «Construir recorrido», «Analizar selección», «Orden
A / Orden B», «3/4 tramos cubiertos», «tramo sin traslado registrado», y —el caso más
claro— celdas del dataset impresas literalmente: `Dato: «2–4 semanas; atardecer
antes»`. Es honesto y es exactamente lo que hace que se lea como una herramienta de
investigación.

**5. Ausencia de identidad visual.** Tipografía `"Segoe UI", system-ui` (la pila por
defecto de cualquier proyecto); emoji como iconografía en todo el cromo (⤓ ? 🛏 ▤ 🗺 🔍
⏱ 📍 💎 👥 🎟 💴 🕰 🗓); teselas OSM crudas, saturadas y con toda la rotulación, que
convierten la vista de ciudad en un clon de Google Maps; y un único fichero `App.css`
de 5.869 líneas sin escala de espaciado (valores ad hoc: `0.35rem`, `0.55rem`,
`0.85rem`, `1.1rem`…).

### Defectos concretos encontrados

| # | Defecto | Severidad | Evidencia |
|---|---|---|---|
| D1 | La barra de viajeros **se sale de la pantalla** en iPhone: los nombres se truncan a «Person…» y el último control queda cortado | Crítico | Visible en 393 px en todas las vistas |
| D2 | El bloque de atribución fotográfica (3 líneas: fuente, autor, licencia, nombre de fichero de Commons, nota de reprocesado) se renderiza **entre la foto y el título** del lugar | Crítico | `PlaceGallery.tsx → Attribution` |
| D3 | La ficha de lugar se abre bajo 330 px de barras irrelevantes | Crítico | `.app__detail` dentro de `.app__body` |
| D4 | El botón `×` de la ficha flota sobre el contenido al hacer scroll y solapa el texto | Mayor | `.place-detail__bar` |
| D5 | La primera pantalla del producto no contiene **ninguna fotografía**: mapa coroplético + 90 px de aviso de licencia MLIT + chips de texto | Mayor | Vista nacional |
| D6 | Hubs con 1 lugar (Nagoya, Fukuoka) se presentan como iguales a Tokio (57) | Mayor | `HubSelector` |
| D7 | Las zonas de alojamiento se numeran 1–6 mientras el propio texto dice «Ninguna es "la mejor"» | Mayor | `ZoneComparison` |
| D8 | «Persona 1 no ha dicho nada / Persona 2 no ha dicho nada»: la función insignia se estrena mostrando dos filas vacías | Mayor | `PlaceDetail → place-interest` |
| D9 | El titular de «Quiero ir» es un **rango de duración** («2 h 50 min–5 h 40 min»), no los lugares | Mayor | `SelectionPanel` |
| D10 | El planner no muestra ninguna fotografía: es una lista de cadenas con 3 botones circulares por fila | Mayor | `OrderedSequenceBuilder` |
| D11 | El color de los marcadores del mapa codifica el nivel de interés, que es casi constante (84 % S/A) | Medio | `PlaceMap` + `--color-interest-*` |
| D12 | `--color-accent` y `--color-interest-1` son el mismo rojo: la marca y un nivel de datos compiten | Medio | `App.css:8,26` |
| D13 | CSS *desktop-first*: 9 bloques `@media (max-width: …)` construyen el móvil restando al escritorio | Medio | `App.css` |
| D14 | Taxonomía de 29 categorías con duplicados (`🍜 Gastronomía` / `🍶 Gastronomía`, `🌿 Naturaleza` / `🌸 Naturaleza`, `🎭 Cultura tradicional` / `🍵 Cultura tradicional`) | Medio | `places.json` |
| D15 | Tamaño base 15 px: por debajo de 16 px iOS hace zoom automático al enfocar inputs | Medio | `App.css:41` |

### Lo que está bien y hay que proteger

No todo hay que tocarlo. Estas decisiones son **mejores que las de la mayoría de
productos de viaje** y el rediseño las hereda:

- **La escalera de interés en lenguaje llano** (`interest-level.ts`). Traducir S/A/B/C/D
  a «Imprescindible / Muy recomendable / …» con glifo de forma distinta, no sólo color,
  es exactamente correcto. Se conserva; sólo cambia dónde se muestra.
- **La negativa a inventar.** Nunca una foto de otro sitio, nunca un orden sugerido,
  nunca una hora que la fuente no respalde. Es el alma del producto.
- **Las líneas editoriales de zona** («La máxima conectividad de Tokio, con vida
  nocturna a la puerta. Ruidoso y enorme»). Es la mejor voz que tiene Nihon hoy y hay
  que extenderla, no reducirla.
- **El campo `differentiator`** («El movimiento colectivo, más que un monumento, es la
  atracción»). Es oro editorial enterrado en una línea de 14 px.
- **Las derivadas de imagen a 800 px** y el `sizes` correcto por breakpoint.
- **Accesibilidad**: `aria-pressed`, trampas de foco, `visually-hidden` con frases
  completas, `prefers-reduced-motion`. Está por encima de la media del sector.

---

## B. North star de producto

> **Nihon es el cuaderno de viaje de los dos.**
> Un lugar bonito y honesto donde dos personas descubren Japón, marcan qué les llama,
> ven en qué coinciden y construyen un viaje que es de ambos.

Tres verbos, en este orden: **descubrir → acordar → planear.**

Lo que Nihon debe hacer sentir, en diez segundos de primera apertura:

1. «Esto es sobre Japón, y es bonito.» (fotografía)
2. «Alguien ha elegido esto por mí, no es una lista volcada.» (voz editorial)
3. «Somos dos y esto lo sabe.» (identidad de los viajeros)

Y lo que debe hacer sentir a los cinco minutos: **«esto sabe de lo que habla, y no me
está vendiendo nada»** — que es exactamente lo que el dataset ya permite y hoy se
comunica en forma de descargos.

### Personalidad

**Editorial, precisa, cálida, evidencial.** Como una guía impresa muy buena que además
está viva. Tranquila. Nunca exclamativa, nunca promocional, nunca corporativa.

Nihon **no** es: minimalista-zen de catálogo, ni entusiasta de agencia de viajes, ni
neutra de dashboard.

### Metáfora rectora: el diagrama de línea

La referencia visual de Nihon **no es el Japón turístico de postal** (torii sobre
crema, flor de cerezo, pincelada). Es la otra tradición japonesa, la que encaja con lo
que este producto realmente hace: **el diseño de información ferroviaria japonés** —la
señalética de JR y Tokyo Metro, los diagramas de línea, los códigos de estación, la
obsesión por que un extranjero entienda a la primera dónde está y cuánto falta.

Por qué es la metáfora correcta para *este* producto y no una decoración:

- Es japonesa sin ser el cliché turístico de Japón.
- Trata exactamente del problema de Nihon: **decidir adónde ir y cuánto cuesta en
  tiempo**.
- Su gramática —nodo, línea, conexión, transbordo— es literalmente la estructura de un
  día del planner.
- Y regala la mejor imagen posible para dos viajeros: **dos líneas que comparten
  algunas estaciones y divergen en otras**. Eso no es una analogía forzada; es
  exactamente lo que `Block 5` y `Block 6` ya calculan.

Este es el único sitio donde el rediseño gasta su audacia. Todo lo demás es disciplina.

---

## C. Principios de diseño

**P1. La foto primero, el dato después.**
En cualquier superficie de descubrimiento, la imagen llega antes que cualquier
metadato. Si hay que elegir entre un chip y 40 px más de fotografía, gana la
fotografía.

**P2. Un lugar es un argumento, no una ficha.**
Cada lugar tiene que responder «¿por qué este y no otro?» antes que «¿qué horario
tiene?». El `differentiator` es el contenido de mayor valor del dataset y recibe el
mejor tratamiento tipográfico del producto.

**P3. La evidencia es una gramática de cuatro niveles.**
`Verificado` (fuente oficial) · `Registrado` (dato del dataset) · `Estimado` (calculado
por Nihon) · `Nihon dice` (juicio editorial). Cuatro marcadores, siempre los mismos,
en toda la aplicación. Sustituyen a casi todos los párrafos de descargo actuales.

**P4. Progressive disclosure con contrato.**
Nada se borra: se pliega. Toda información que se retira de la vista principal tiene un
sitio nombrado donde vive («Fuentes», «Datos prácticos», «Cómo se calcula esto»), y
ese sitio está documentado en `05_ESPECIFICACIONES_DE_PANTALLA.md`.

**P5. Lo compartido se ve compartido.**
Lo que es de una persona lleva su color y su inicial. Lo que es de los dos no lleva
color de persona. Nunca hay duda sobre de quién es una decisión.

**P6. El acuerdo es la recompensa.**
La pantalla más emocionalmente importante del producto no es el mapa ni el planner: es
«los dos queréis ir a estos seis sitios». Esa sección va primero en «Quiero ir», no
escondida tras un botón llamado «Analizar selección».

**P7. El mapa es una lente, no un hogar.**
El mapa sirve para responder «¿dónde cae esto?» y «¿qué hay cerca?». Nunca es la
primera pantalla, nunca es el contenedor de la navegación, y su color codifica **quién
quiere ir**, no la calidad editorial.

**P8. Densidad calculada, no densidad máxima.**
En teléfono: una tarjeta lleva como máximo **dos** chips de metadato. Una pantalla
lleva como máximo **un** aviso en prosa. Un día del planner muestra lo que pasa ese
día, no todo lo que se sabe del viaje.

**P9. Manual por diseño, y que se note como virtud.**
Que Nihon no ordene el viaje no es una limitación que haya que disculpar cinco veces:
es una promesa. Se dice **una vez**, bien, en el sitio adecuado, y se deja de repetir.

**P10. Una decisión, no un menú.**
El sistema define un camino. Las variantes existen sólo donde el contenido las exige
(1 foto vs. 3 fotos), nunca por indecisión.
