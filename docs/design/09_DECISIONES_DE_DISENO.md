# 09 — Decisiones de diseño

Registro **append-only**. Cada decisión importante, con su alternativa descartada y su
motivo. Una decisión nueva **no invalida el resto de la visión**: se añade aquí.

Estados: `Firme` · `Provisional` · `Abierta` · `Sustituida por DD-nnn`

Formato para añadir:

```
### DD-nnn — Título
**Estado:** Firme | **Fecha:** AAAA-MM-DD | **Afecta:** documento §sección
**Decisión.** Una frase.
**Alternativas descartadas.** Cuál y por qué no.
**Consecuencias.** Qué obliga y qué desbloquea.
```

---

### DD-001 — Cuatro destinos permanentes en lugar de una pantalla y seis modales
**Estado:** Firme · **Afecta:** `02`, `04 §10`, `05`

**Decisión.** Nihon pasa a tener Explorar · Quiero ir · Viaje · Nosotros, con barra de
pestañas en teléfono y raíl en pantallas grandes.

**Alternativas descartadas.** (a) Mantener la pila de overlays y sólo rediseñarlos:
deja capacidades caras invisibles y no da sitio a la sincronización futura. (b) Tres
pestañas fusionando Quiero ir y Viaje: mezcla lo personal con lo compartido, que es
justo la distinción que el producto necesita mantener (Art. 9). (c) Cajón lateral:
esconde la navegación, que es el problema actual.

**Consecuencias.** Obliga a un shell nuevo (bloque B2) antes que cualquier otra
superficie. Desbloquea: recuperar ~220 px de pantalla en teléfono, visibilidad de las
capacidades, y un hueco natural para invitación y presencia en v1.2.0.

---

### DD-002 — El día es el objeto primario del planner
**Estado:** Firme · **Afecta:** `05 §7`, `04 §14`

**Decisión.** «Viaje» abre mostrando días. El orden dentro de un día es una propiedad
del día. La comparación de órdenes pasa a ser una herramienta local a un día.

**Alternativas descartadas.** (a) Conservar el recorrido plano como vista principal: es
un objeto algorítmico, no mental; nadie planea unas vacaciones como una secuencia
plana que luego reparte. (b) Generar el reparto automáticamente: prohibido por Art. 5.

**Consecuencias.** Toda la lógica de `OrderedSequenceBuilder` se conserva; cambia su
encuadre y su presentación. Es el bloque de implementación más grande (B7).

---

### DD-003 — Base cartográfica apagada
**Estado:** Firme · **Fecha:** 2026-09-21 · **Afecta:** `03 §9`, `05 §3`, `05 §4` · **Cierra:** DDR-B21-01

**Decisión.** Se mantiene el proveedor OSM actual aplicando únicamente a la capa de
teselas el filtro CSS `saturate(.25) contrast(.92) brightness(1.04)`.

**Alternativas descartadas.** (a) CARTO Positron: requiere gestión de proveedor/clave
y riesgo de política de uso sin aportar ventaja sobre el filtro CSS aprobado. (b) OSM sin
filtro: la saturación compite con los marcadores.

**Consecuencias.** No se modifican URL de tiles, atribución OSM, geometría, marcadores,
controles ni paneles. DD-003 pasa a estado **Firme**.

---

### DD-004 — El color del marcador codifica quién quiere ir
**Estado:** Firme · **Afecta:** `03 §9`

**Decisión.** Los marcadores del mapa dejan de codificar el nivel editorial y pasan a
codificar el estado de interés: nadie / persona A / persona B / los dos.

**Alternativas descartadas.** Mantener la escala de interés en el mapa: el 84 % del
catálogo es S o A, así que casi todos los marcadores tenían el mismo color y el mapa no
informaba de nada.

**Consecuencias.** El mapa pasa a responder una pregunta que la pareja se hace de
verdad. Se retiran `--color-interest-1…5`. Requiere que la leyenda cambie de texto.

---

### DD-005 — Insignia de nivel sólo para «Imprescindible»
**Estado:** Firme · **Afecta:** `04 §5`, `05 §5`

**Decisión.** En tarjeta, sólo los 32 lugares grado S muestran insignia. La escalera
completa sigue disponible en filtros y en la ficha.

**Alternativas descartadas.** Mostrar los cinco niveles como hoy: 179 de 214 tarjetas
llevan la misma insignia, lo que la convierte en decoración (Art. 6).

---

### DD-006 — La evidencia se codifica con forma, no con color
**Estado:** Firme · **Afecta:** `03 §1.4`, `04 §2`

**Decisión.** Cuatro marcadores (`◼ ◧ ◇ ✎`) en tinta neutra sustituyen a la mayoría de
los párrafos de descargo.

**Alternativas descartadas.** (a) Colores por nivel de evidencia: colisiona con los
colores de estado y de persona, y satura una interfaz que ya usa color para tres cosas.
(b) Mantener los descargos en prosa: cuestan un tercio de la pantalla del planner y
fijan un tono defensivo.

**Consecuencias.** Toda la inversión de los Bloques 7, 9, 10 y 11 (provenance,
gobernanza editorial, `consultedAt`, cobertura semántica) se conserva y **se vuelve
legible de un vistazo** en vez de leerse como notas al pie.

---

### DD-007 — Retirada del conmutador «Eres» del cromo
**Estado:** Firme · **Afecta:** `02 §D4`, `04 §11`, `07 §DS-1`

**Decisión.** La identidad se fija una vez y se representa con un `PersonToken` en la
cabecera; cambiar de persona activa se hace desde Nosotros.

**Alternativas descartadas.** Conservarlo y arreglar el desbordamiento: sigue modelando
a las personas como asientos de un dispositivo, lo que obliga a rehacer la UX cuando
cada teléfono tenga dueño.

**Consecuencias.** Arregla el defecto crítico D1, libera la cabecera, y cuesta un toque
más en dispositivo compartido. Aceptado.

---

### DD-008 — Dos familias tipográficas con significado: voz y registro
**Estado:** Firme · **Afecta:** `03 §2`

**Decisión.** Zen Kaku Gothic New para lo que Nihon dice; IBM Plex Sans para lo que
Nihon anota.

**Alternativas descartadas.** (a) Mantener `Segoe UI`/system: no tiene identidad y se
ve distinto en cada plataforma. (b) Serif editorial de alto contraste + sans: es el
emparejamiento por defecto más repetido; no dice nada sobre este producto. (c) Una sola
familia: no permite distinguir voz de registro, que es la tesis del producto.

**Consecuencias.** Zen Kaku resuelve además los nombres japoneses, que hoy se ven en
una fuente distinta a la del resto. Requiere autoalojar con subconjuntos y
`unicode-range`.

---

### DD-009 — Paleta de señalética, no de postal
**Estado:** Firme · **Afecta:** `03 §1`

**Decisión.** Papel frío-neutro `#F5F6F4`, tinta azulada `#14161A`, bermellón `shu`
`#C2362F` reservado a tres usos, añil y peonía para las personas.

**Alternativas descartadas.** Crema `#F4F1EA` + serif + terracota: es el aspecto por
defecto de todo producto «premium» reciente y Nihon ya lo roza; no distingue.

---

### DD-010 — Las coincidencias son la vista principal de «Quiero ir»
**Estado:** Firme · **Afecta:** `05 §6`

**Decisión.** «Los dos queréis ir» va primero, sin clic. Se elimina el botón «Analizar
selección».

**Alternativas descartadas.** Mantenerlo tras un botón: esconde la recompensa
emocional del producto detrás de un verbo de ingeniería.

---

### DD-011 — El aviso de febrero–marzo 2027 sólo se muestra si hay problema
**Estado:** Firme · **Afecta:** `05 §5`

**Decisión.** El recuadro de alerta aparece únicamente con cierre confirmado,
restricción o riesgo. El estado «pendiente de confirmar» baja a una línea dentro de
«Horario».

**Alternativas descartadas.** Mostrarlo siempre, como hoy: produce fatiga de alerta;
un aviso que sale en todas las fichas deja de avisar (Art. 6). La información no se
pierde: cambia de peso.

---

### DD-012 — Las zonas de alojamiento pierden el ordinal
**Estado:** Firme · **Afecta:** `05 §8`

**Decisión.** Se eliminan los números 1–6 de las tarjetas de zona.

**Alternativas descartadas.** Conservarlos: el propio producto dice «ninguna es la
mejor» y a la vez las numera. Numerar es legítimo sólo cuando el contenido es una
secuencia; los días del planner sí lo son, las zonas no.

---

### DD-013 — Roles de imagen obligatorios
**Estado:** Firme · **Afecta:** `06 §2`

**Decisión.** Cada fotografía declara un rol (`identity`, `experience`, `detail`,
`context`, `seasonal`) y sólo se añade una imagen si cubre un rol nuevo.

**Alternativas descartadas.** Un objetivo numérico de «2–3 imágenes por lugar» sin
roles: produce galerías con tres variaciones del mismo encuadre, que es peor que una
sola buena.

---

### DD-014 — Colecciones editoriales en la portada
**Estado:** Firme · **Afecta:** `05 §2`

**Decisión.** La portada de Explorar muestra ciudades como tarjetas fotográficas y
cuatro colecciones derivadas del dataset existente.

**Alternativas descartadas.** Abrir en el mapa nacional, como hoy: la primera pantalla
del producto no contiene ninguna fotografía y sí un aviso de licencia. El mapa se
conserva íntegro, un toque más adentro.

---

### DD-015 — Apertura de ficha de lugar desde Viaje
**Estado:** Firme · **Fecha:** 2026-09-20 · **Afecta:** `02 §D3`, `05 §7`/`§8`, `08`

**Decisión.** Un lugar abierto desde Viaje (hoy, «Dónde dormir» › `ZoneComparison`)
apila la misma `PlaceDetail` dentro de la propia pestaña Viaje — nunca navega a
Explorar. Cerrar esa ficha (chevron, `×` o back del navegador) devuelve exactamente a
la superficie que la abrió, con su scroll, su zona seleccionada, su modo
(`browse`/`compare`) y cualquier otro estado local intactos, porque esa superficie
nunca se desmonta mientras la ficha está por encima. Abrir un lugar cercano desde ahí
encadena («Lugar A → Lugar B → Lugar C»), y volver recorre la pila uno a uno antes de
llegar a la superficie de origen. En cualquier momento, como en el resto del producto,
una ficha de lugar sólo puede estar abierta en un destino a la vez (instancia única).
La única acción autorizada a cambiar de pestaña desde una ficha abierta en Viaje es
«Ver en el mapa», explícita y etiquetada (nunca icon-only): cierra el stack de Viaje,
cambia a Explorar y centra ese lugar en el mapa — nunca abre su ficha en Explorar, la
cierra del todo — sin dejar una segunda ficha abierta en Viaje ni en Explorar. En
teléfono la ficha sigue la regla general de `05 §5` (cubre el
100 % de la altura visible, incluidos cabecera y `TabBar`) sin excepción para Viaje;
en `md`+ es el panel derecho de 480 px con `NavRail` visible. Esta decisión generaliza
la regla de `02 §D3` — «cualquier enlace a un lugar apila la ficha dentro de la
pestaña activa» — para que no tenga excepciones.

**Alternativas descartadas.** (a) Mantener el comportamiento heredado de B18 (abrir
siempre en Explorar): contradice la regla ya vigente para Quiero ir y obliga a
recordar una excepción no documentada cada vez que se toca un lugar desde Viaje. (b)
Una ficha reducida/alternativa sólo para Viaje: duplica `PlaceDetail` (Bloque 4) y el
estado de lugares por pestaña, que `02 §D3` prohíbe explícitamente («las pestañas son
destinos, no historial»). (c) Sin salida explícita hacia el mapa: deja sin resolver el
caso real de querer ver un lugar guardado en su contexto geográfico, que es
precisamente lo que Explorar ya resuelve — mejor una acción con nombre que un salto
implícito.

**Consecuencias.** Deroga la nota abierta de `docs/BLOCK_18_HANDOFF.md` sobre el
destino de retorno al abrir un lugar desde `ZoneComparison`. Extiende (no sustituye)
el mecanismo de `ficheOrigin` de B18 con una etiqueta de origen (`ficheOriginLabel`)
para que el back pueda nombrar la superficie real cuando Viaje tenga más de una que
abra lugares. No afecta a Explorar ni a Quiero ir, cuyo comportamiento con B18 ya
cumplía esta misma regla general.

---

### DD-016 — La rejilla de descubrimiento responde a su contenedor, no al viewport
**Estado:** Firme · **Fecha:** 2026-09-21 · **Afecta:** `02 §D5`, `03 §5`, `04 §5`, `05 §4`, `08`

**Decisión.** Tres reglas, que se sostienen entre sí:

1. **El número de columnas es el menor de dos números, en este orden.** Primero, la
   **cabida real**: cuántas `PlaceCard` de **264 px mínimo** caben en el **ancho efectivo
   de la región de lista** — nunca en el del viewport. Después, el **tope del
   breakpoint**: `base` 1 · `sm` 2 · `md` 2 · `lg` 2 · `xl` 3. El tope es un techo, jamás
   un suelo: a 1440 px caben tres columnas y el tope de `lg` las deja en dos.
2. **El mecanismo tiene que medir el contenedor** (`@container`, o equivalente). No basta
   con `@media`, y no es una preferencia de implementación: en `md`, abrir la ficha
   estrecha la región de lista de ~752 px a ~376 px **sin que el viewport cambie**, y la
   lista tiene que bajar de 2 columnas a 1. Ningún `@media` puede ver eso.
3. **La lista es la superficie primaria; el raíl derecho es lo secundario.** El raíl mide
   `min(480 px, 50 % del cuerpo)` y la lista se queda con el resto. En `md` el raíl sólo
   existe mientras hay una ficha abierta (el mapa sigue conmutado, como en teléfono); en
   `lg`+ lo ocupa el mapa de forma permanente y la ficha se apoya encima, sobre la misma
   caja, de modo que el mapa **no cambia de tamaño** al abrir ni al cerrar la ficha y
   conserva centro, zoom y marcador.

La proporción de la tarjeta sigue al número de columnas, no al breakpoint: 4:3 con una
columna, 16:9 con dos o más. Y el scrim de la banda de texto deja de apoyarse en un
`text-shadow` (prohibido por `03 §5`) para apoyarse en un **suelo de scrim propio de la
banda**, con scrim efectivo **≥0.60 bajo todo el texto** y contraste AA con la fotografía
más clara del catálogo. Sin tokens nuevos: el suelo usa el mismo valor que
`--scrim-bottom` ya declara en su parada inferior.

**El ancho de viewport en el que `lg` llega a dos columnas (~1090–1140 px según el cromo
real) NO es un breakpoint.** Es una consecuencia aritmética de la fórmula de cabida, y no
se escribe en ninguna parte: si mañana cambia el ancho del `NavRail` o el `--space-3` de
la rejilla, ese número cambia solo, y nada hay que tocar.

**Contradicciones que esta decisión resuelve** (estaban en los documentos congelados, no
sólo en el código):

- `04 §5.2` exigía «`text-shadow` de respaldo» y `03 §5` lo prohíbe («las superficies
  sobre fotografía no usan sombra: usan `--scrim-*`»). Gana `03 §5`: la sombra tapaba el
  síntoma en vez de arreglar el scrim, y fallaba justo con las fotografías más claras.
  `04 §5.2` queda reescrito.
- `02 §D5` y `05 §4` sitúan el **mapa persistente en `lg`**, pero B18 lo instaló desde
  `md` y clavó la lista en 372 px fijos, lo que hacía aritméticamente imposible el «`md`:
  2 columnas» que `05 §4` pide. Gana el documento: el mapa persistente empieza en `lg`, y
  en `md` sigue siendo una superficie conmutada por el control Lista/Mapa que ya existe
  (que hasta ahora no hacía nada a esos anchos). Ese control se retira en `lg`+, donde ya
  no tiene nada que conmutar.

**Alternativas descartadas.** (a) Seguir con `@media` y elegir un breakpoint alrededor de
1090 px: codifica como causa lo que es un efecto, y sigue sin poder ver el caso de `md`
con la ficha abierta, que es el que originó todo esto. (b) Dejar el raíl en el 50 % pleno
en `lg`: con 264 px de mínimo y el `NavRail`, la lista se queda a 8 px de poder dar dos
columnas y `lg` cae a una — el «máximo 50 %» de `02 §D5` es un techo, no una medida. (c)
Subir la opacidad de `--scrim-bottom` en `tokens.css` para salvar la banda de texto:
oscurece **todas** las fotografías del producto (portada, galería, ficha) para arreglar un
problema que sólo tiene la tarjeta, y contradice `06`.

**Consecuencias.** `.app__sidebar` pasa a ser contenedor de consulta
(`container-type: inline-size`). `panelOffset` deja de colgar de `md` y pasa a colgar de
`lg`, y `PlaceMap` no mueve el mapa cuando la ficha lo cubre entero — ver la DESIGN
DECISION REQUIRED de abajo sobre `05 §5`. Dos aserciones de `block18-shell.test.ts` se
actualizan citando esta decisión (ancho de `.app__detail`, consulta de `panelOffset`).
Gates nuevos: `app/scripts/block19-grid-check.mjs` (los seis viewports, el mínimo de
264 px, el raíl ≤50 %, la estabilidad del mapa y la ausencia de `text-shadow`) y la
reescritura de `app/scripts/block19-contrast-check.mjs`, que ahora mide píxeles compuestos
de verdad en toda la banda de texto y en los dos regímenes de proporción.

---

### DD-017 — En `lg`/`xl`, mapa y ficha son una sola región; la ficha puede cubrir el mapa
**Estado:** Firme · **Fecha:** 2026-09-21 · **Afecta:** `02 §D5`, `05 §5`, `08` · **Cierra:** DDR-01

**Decisión.** En `lg`/`xl`, el mapa y la ficha de lugar **no son dos superficies que compiten
por el espacio: son una sola región** — el raíl derecho de `02 §D5`. De ahí, el contrato
completo:

1. **Con la ficha cerrada, el mapa funciona con normalidad.** Nada de esta decisión le quita
   capacidades: encuadra, centra al seleccionar desde la lista, responde a «Ver en el mapa».
2. **Al abrir la ficha, ésta puede cubrir el mapa por completo.** No existe obligación de
   mantener visible el marcador seleccionado.
3. **Mientras está cubierto, el mapa conserva centro, zoom y pin/selección.** No se
   reinicializa, no se reencuadra, no se redimensiona y no pierde el marcador.
4. **Al cerrar la ficha, el mapa reaparece exactamente en el estado en que se quedó.**
5. **`panelOffset` se conserva como mecanismo, con alcance acotado**: sólo actúa en una
   geometría donde el mapa y el panel sean **simultáneamente visibles**. Cuando el panel cubre
   el mapa entero, no desplaza nada.
6. **No se fabrica una franja residual de mapa** para poder seguir cumpliendo la regla del
   marcador visible. Un mapa de 40 px no es un mapa: es un adorno que cuesta una columna de
   lista.

**Por qué.** La redacción anterior de `05 §5` («el panel no oculta el marcador seleccionado en
el mapa, se conserva `panelOffset`») presuponía un raíl más ancho que la ficha. La fórmula de
cabida de DD-016 lo fija en exactamente una ficha de ancho, y no por gusto: a 1200 px, con el
`NavRail` de 88 px y el mínimo de 264 px por tarjeta, la región de lista necesita ≥564 px para
dar dos columnas, así que el raíl no puede pasar de 548 px. Cualquier raíl entre 481 y 548 px
deja una tira de mapa de 1 a 68 px. La elección real era: **una columna de lista menos, o un
marcador que no se ve mientras se lee la ficha.** Gana la lista — y además, mover el mapa
mientras está tapado es activamente peor que no moverlo, porque el lector se lo encuentra
descolocado al cerrar.

**Alternativas descartadas.** (a) Estrechar la ficha por debajo de 480 px en `lg`+ para dejar
mapa a la vista: rompe `02 §D5`/`05 §5` a la vez y convierte la ficha —«la pantalla donde Nihon
demuestra que tiene criterio»— en la superficie sacrificada. (b) Bajar el mínimo de 264 px de
`PlaceCard`: paga el marcador con la legibilidad de toda la lista, que es la superficie
primaria. (c) Dejar que `FocusSelected` siga centrando el mapa aunque esté tapado: es trabajo
invisible cuyo único efecto observable es destruir la vista que el lector tenía.

**Consecuencias.** `05 §5` queda reescrito. `08` gana un invariante verificable con el alcance
de `panelOffset`. En código no hace falta cambiar nada: `panelCoversMap()` en `PlaceMap.tsx` ya
implementa exactamente el punto 5, y `block19-grid-check.mjs` ya verifica los puntos 2–4 sobre
el ciclo completo (antes de abrir → abierta → después de cerrar). **DDR-01 queda cerrada.**

---

### DD-018 — Contador de ciudad sin píldora, sobre el scrim (D-M1)
**Estado:** Firme · **Fecha:** 2026-09-25 · **Afecta:** `05 §2` pt. 3, `03 §5` · **Origen:** dirección, Bloque 24

**Decisión.** En las tarjetas de ciudad de la portada, «57 lugares» va **sin píldora**, en
`--type-num`, directamente sobre el scrim de la fotografía. El scrim cumple su contrato de `03 §5`:
opacidad efectiva **≥0,60 en toda la banda de texto** (nombre, nombre japonés y contador), con
contraste AA sobre la fotografía más clara posible.

**Alternativas descartadas.** Conservar la píldora clara con texto blanco: ilegible (≈1,15:1).
Oscurecer la píldora: añade una superficie que `05 §2` no prescribe y no arregla el nombre, que
tampoco llegaba a AA con el scrim largo.

**Consecuencias.** La banda de texto de la tarjeta de ciudad recibe su propio suelo de scrim con el
valor de la parada inferior de `--scrim-bottom`, el mismo mecanismo que `PlaceCard` (DD-016). Sin
tokens nuevos. Lo mide `app/scripts/b24-real-input-audit.mjs` sobre píxeles compuestos.

---

### DD-019 — Proporción del héroe de la ficha por debajo de `md` (D-M3)
**Estado:** Firme · **Fecha:** 2026-09-25 · **Afecta:** `04 §6`, `05 §5` pt. 1, `06 §5.2` · **Origen:** dirección, Bloque 24

**Decisión.** Por debajo de `md`, la galería de la ficha mantiene la proporción **4:5**, con **altura
máxima 60svh** y `object-fit: cover`. Desde `md` sigue `04 §6`: 4:3 dentro del panel.

**Alternativas descartadas.** 4:5 sin tope: a 820 px de ancho la foto mide 1025 px y empuja el
nombre fuera de la primera pantalla.

**Consecuencias.** En teléfono estrecho nada cambia (4:5 cabe bajo el tope); en tablets verticales la
foto se recorta, no se deforma.

---

### DD-020 — Léxico: «Misma zona» y toasts de «Quiero ir» (D-M4)
**Estado:** Firme · **Fecha:** 2026-09-25 · **Afecta:** `03 §10`, `04 §16`, `05 §5` pt. 12 · **Origen:** dirección, Bloque 24

**Decisión.**
- El valor del dataset «Mismo cluster» se presenta como **«Misma zona»**. Sólo en presentación: el
  dataset (`nearby.json`) y la normalización de `lib/transfer.ts` no cambian.
- Toast al marcar: **«{lugar} está en Quiero ir»**. Toast al desmarcar: **«{lugar} ya no está en
  Quiero ir»**.

**Alternativas descartadas.** «Guardado en Quiero ir: {lugar}»: contradice `03 §10` («el botón
"Quiero ir" produce el estado "Quiero ir", no "Guardado"»). «Mismo cluster»: vocabulario de
repositorio (Art. 7).

---

### DD-021 — Iconos del set propio en lugar de glifos de texto (D-M5)
**Estado:** Firme · **Fecha:** 2026-09-25 · **Afecta:** `03 §8` · **Origen:** dirección, Bloque 24

**Decisión.** Los glifos de texto que hacen de icono (`▾`, `▸`, `↓`) en cromo y hojas se sustituyen
por el set de `app/src/icons`, fuera de las zonas vedadas.

**Consecuencias.** En B24 se aplica a `FilterSheet`. Los glifos de Quiero ir (`SelectionPanel`,
`SelectionAnalysis`) quedan para B7, y los de `OrderedSequenceBuilder.tsx` (vedado) para B9.

---

### DD-022 — Resultados de búsqueda (D-M6)
**Estado:** Firme · **Fecha:** 2026-09-25 · **Afecta:** `04 §5.10`, `04 §12` · **Origen:** dirección, Bloque 24

**Decisión.**
- Las filas de resultados **nunca son más anchas que la hoja**.
- Metadato: **«{categoría} · {barrio}, {ciudad}»**, con un solo `·` (`03 §2.3`).
- **Contador vivo en la cabecera**: «14 lugares».

**Consecuencias.** El ancho y el contador se aplican en B24. El metadato vive en `PlaceCard.tsx`, zona
protegida por una rama activa (B23): queda como DEFERRED-ACTIVE-BRANCH con su diff en
`docs/BLOCK_24_UX_AUDIT.md` (P0-5c).

---

## DESIGN DECISION REQUIRED

Contradicciones reales entre el sistema congelado y una decisión ya tomada. **No se
improvisa una arquitectura para taparlas**: se dejan escritas aquí, con su tensión exacta,
hasta que producto o diseño las cierren. Se conservan cerradas, con su resolución, para que
quede el rastro de por qué el documento dice lo que dice.

### DDR-01 — `05 §5` pedía conservar `panelOffset`; la geometría del raíl lo dejaba sin sitio
**Estado: RESUELTA** · Abierta 2026-09-21 · Cerrada 2026-09-21 por **DD-017**

**La tensión que se planteó.** `05 §5` decía: «`lg`+: el panel no oculta el marcador
seleccionado en el mapa (se conserva `panelOffset`)». Eso presupone un raíl del mapa **más
ancho** que la ficha. La fórmula de cabida de DD-016 fija el raíl en exactamente una ficha de
ancho (`min(480 px, 50 %)`), así que la ficha lo cubre entero y no queda marcador que salvar.
No era una elección estética: a 1200 px el raíl no puede pasar de 548 px sin dejar `lg` en una
sola columna, y entre 481 y 548 px la tira de mapa visible va de 1 a 68 px.

**Cómo se ha cerrado.** Ver **DD-017**. En corto: mapa y ficha son una sola región; la ficha
puede cubrir el mapa del todo; lo que se conserva es el **estado** del mapa (centro, zoom,
selección), no su visibilidad; `panelOffset` sobrevive con su alcance acotado a las geometrías
donde mapa y panel se ven a la vez; y no se fabrica ninguna franja residual de mapa.

### DDR-02 — El cuerpo de la tarjeta no abre el lugar, y `04 §5.9` no admite excepciones
**Estado: RESUELTA** · Abierta 2026-09-21 · Cerrada 2026-09-21 · **Afecta:** `04 §5`, `08`

**Qué dice la norma.** `04 §5.9`: «**Toda la tarjeta abre el lugar**; el corazón y el token de
persona están por encima en el orden de apilamiento. Se conserva el patrón actual de `<article>`
+ botón estirado (es correcto y accesible)».

**Qué pasa de verdad.** El botón estirado nace dentro de `.place-card__media`, porque el nombre
va sobre la fotografía (`04 §5.2`). `.place-card__media` tiene `overflow: hidden` —lo necesita
para recortar la foto a la proporción—, así que **ningún pseudo-elemento nacido dentro de ella
puede llegar al cuerpo de la tarjeta**. Resultado medido: la fotografía y su banda de texto
abren el lugar; la razón y los chips, no. (Hasta esta corrección era peor: el enlace se encogía
al recuadro del texto del nombre, 271×29px en una tarjeta de 271×270, y ni siquiera la fotografía
abría nada. Eso sí era un defecto inequívoco y está corregido.)

**Decisión aprobada.** Se mantiene íntegramente `04 §5.9` y se adopta la alternativa (a). El
control principal que abre el lugar pertenece estructuralmente al nivel del
`<article>`/`PlaceCard`, cubre exactamente la tarjeta completa y no nace dentro de
`.place-card__media`. La media conserva `overflow: hidden`; el nombre continúa visualmente sobre
la fotografía. Fotografía, nombre, razón, chips y cualquier otra superficie no interactiva
abren el lugar. Corazón y token de persona permanecen por encima, conservan su comportamiento
independiente y no abren la ficha. No se anidan controles interactivos ni se extiende ningún
target invisible fuera de la tarjeta; el control principal mantiene semántica de botón, foco
visible y activación por teclado.

**Cómo se ha cerrado.** `PlaceCard` renderiza el botón principal como hijo directo del
`<article>` y presenta el nombre por separado dentro de la banda fotográfica. El gate
`app/scripts/block19-grid-check.mjs` prueba cada zona, las acciones independientes, ambos estados
fotográficos, teclado y límites geométricos del target. `04 §5.9` y los invariantes de `08`
quedan actualizados al mismo contrato.

---

### DDR-03 — Qué dice Nihon cuando no consigue guardar en el dispositivo
**Estado: RESUELTA** · Abierta 2026-09-21 · Cerrada 2026-09-21 · **Afecta:** `04 §17`, `05 §12`, `08`

**El problema.** Nihon guarda en `localStorage` y construye todo su discurso sobre eso («vive sólo
en este navegador», `TravellerManager`; «se guarda automáticamente», el planificador). Si la
escritura falla —cuota llena, modo privado, almacenamiento bloqueado— el producto **no lo contaba**:
cada módulo puro envolvía su `setItem` en un `try/catch` que se tragaba el error con un comentario
(«storage unavailable — the roster stays in memory for this session»). La persona seguía marcando
lugares, la interfaz confirmaba cada marca, y al volver no quedaba nada. Es la peor clase de fallo
silencioso y contradice de frente el compromiso de `00` de no afirmar lo que no se sabe.

**Decisión aprobada.**

*Estado normal.* Mientras la persistencia funciona, es lícito afirmar que los cambios quedan
guardados en el dispositivo — **pero sólo mientras sea verdad**.

*Estado de error.* En cuanto una operación de persistencia falle:
- **no se muestra ni se mantiene ninguna afirmación** de que los cambios están guardados;
- se muestra **un único aviso**, no modal, con este texto exacto:
  «No pudimos guardar los cambios en este dispositivo. Pueden perderse al cerrar la app.»
- con una sola acción: **«Reintentar»**.

*Reintentar.* No puede limitarse a ocultar el aviso: ejecuta una **escritura real** a través de la
infraestructura de persistencia vigente, reintentando exactamente la carga que falló. Si tiene
éxito, el estado vuelve a normal y el aviso desaparece. Si vuelve a fallar, el estado y el aviso
permanecen. **Nunca descarta ni reinicia datos de la persona** como parte del reintento.

*Arquitectura.* **Una sola fuente de verdad** del estado de persistencia para todo el producto. No
hay estados independientes por destino: Explorar, Ficha, Quiero ir y Viaje leen el mismo. El aviso
se renderiza **una sola vez**, en la raíz de la aplicación, nunca por destino.

*Ubicación y forma.* Se ancla **sobre la barra de pestañas**, el mismo idioma que `04 §16` fija
para `Toast`, y por encima de la ficha en el orden de apilamiento, de modo que siga visible con la
ficha abierta —incluido su modo a pantalla completa de `05 §5`— sin crear un segundo aviso. No es
modal, no roba el foco al aparecer, se anuncia a la tecnología asistiva al entrar en error, no
tapa la navegación ni los controles de la ficha, y «Reintentar» cumple los 44 px de `03 §7`. Sólo
tokens existentes: ningún hex crudo ni estilo ad hoc.

*Cuándo aparece — aprobado 2026-09-21.* **En cuanto falle una escritura real, incluida la que la
aplicación hace al arrancar.** No espera al primer gesto de la persona. Nihon persiste su
documento de viajeros al montar; si esa escritura ya falla, es verdad que no se va a poder guardar
nada, y decirlo entonces evita trabajo que se perdería. No es un falso positivo porque no se
dispara por una suposición sino por un fallo ocurrido: con la persistencia sana no aparece nunca.

*Qué puede taparlo — aprobado 2026-09-21.* Queda **por debajo de `Sheet` y de cualquier superficie
modal enfocada** (`04 §8`), y **reaparece en cuanto se cierran**. Una hoja modal es una tarea
enfocada con su propio fondo de página: superponerle un aviso persistente competiría con lo que la
persona acaba de abrir. Esto **no relaja** la regla anterior: el aviso sigue estando por encima de
`PlaceDetail`, incluido su modo a pantalla completa, porque la ficha no es una tarea modal sino la
superficie donde se lee y se marca — y marcar es justo lo que no se va a poder guardar.

**Alternativas descartadas.** (a) Un aviso por destino: cuatro estados que pueden discreparse
entre sí, y dos avisos simultáneos en cuanto la ficha se abre sobre Explorar. (b) Un `Toast`: `04
§16` lo fija en 2.400 ms y este estado dura hasta que se resuelva; un aviso que se va solo diría
que el problema se fue solo. (c) Un modal: robaría el foco y bloquearía justo lo que la persona
intenta hacer, cuando lo que hay que comunicar es que puede seguir, pero sin garantías. (d) Portar
la implementación de la línea Astra: base, arquitectura y modelo de datos incompatibles — ver el
guardrail de `08`.

**Cómo se ha cerrado.** No se creó una segunda capa: **ya existía un punto común**. Cada escritura
persistente pasaba por un adaptador inyectado `{getItem, setItem, removeItem}`, declarado por
separado en cuatro módulos (`useTravellers`, `usePlanningDraft`, `useZonePlanChoice`,
`usePortableBackup`) y en línea en un quinto (`useZoneComparison`). Los cinco pasan a compartir
`lib/device-storage.ts`, que es ese mismo adaptador con una responsabilidad añadida: registrar el
resultado de cada escritura y **volver a lanzar** el error, para que el `try/catch` de cada módulo
puro siga comportándose exactamente igual que antes. El camino de datos no cambia; lo que cambia
es que el fallo deja de ser invisible.

`lib/onboarding.ts` queda deliberadamente fuera: su clave es una preferencia de interfaz («ya vi
la explicación»), no un cambio de la persona sobre su viaje. Avisar de pérdida de datos antes de
que exista un dato que perder sería un falso positivo.

---

### DDR-04 — «Fuentes» pide campos que el modelo `Place` no tiene
**Estado: RESUELTA** · Abierta 2026-09-21 · Cerrada 2026-09-21 · **Afecta:** `05 §5` pt. 14, `10 §B4`

**Qué pedía la norma.** `05 §5` pt. 14: «**Fuentes** — desplegable cerrado por defecto. Contiene:
grado original, `provenance`, `consultedAt`/freshness, `updatedAt`, versión del dataset, enlaces
oficiales.» `10 §B4` lo repetía: «Sección «Fuentes» plegada con grado, provenance, freshness y
fechas.»

**Qué hay.** De esos seis, el tipo `Place` (`app/src/types.ts`) sólo tiene **dos**: `grade` y
`updatedAt`, más `officialUrl`/`googleMapsUrl`. **No existe `provenance` por lugar, ni
`consultedAt`, ni una versión de dataset en ninguna parte de la aplicación.**
`lib/source-freshness.ts` sí implementa la gramática de frescura, pero sirve a zonas de
alojamiento, puntos de acceso y mecanismos de reserva — no a los 214 lugares del catálogo.

**Decisión aprobada.** Se adopta la alternativa (a): **«Fuentes» sólo muestra evidencia que
realmente existe.** La sección se conserva, plegada por defecto, y en B4 puede contener
exclusivamente:

- el **grado original** (la letra, que fuera de aquí sigue prohibida);
- **`updatedAt`**;
- el **enlace oficial** cuando exista;
- cualquier otro enlace que el contrato ya reconozca como fuente real.

**Lo que queda expresamente prohibido en B4.** No se crea ni se deriva `provenance`, ni
`consultedAt`, ni una frescura por lugar, ni una versión del dataset, **ni ninguna etiqueta
equivalente inferida desde `updatedAt`**.

**`updatedAt` significa una sola cosa: cuándo se actualizó el registro.** No es fecha de consulta
de una fuente y no autoriza a inferir frescura. Presentarlo como «consultado en…» sería exactamente
la afirmación sin verificar que `00` prohíbe.

**Tampoco se rellenan huecos con placeholders.** No se muestran filas del tipo «Procedencia: no
disponible» ni ningún marcador de posición para un campo inexistente: esos campos **no existen
todavía** en esta sección, y una fila que anuncia su ausencia es ruido que además sugiere que
alguien los buscó lugar por lugar.

**Qué no entra en B4.** Ampliar el dataset con `provenance`/`consultedAt` por lugar es trabajo de
datos y de investigación; queda fuera del alcance de este bloque y no lo bloquea. Cuando exista
evidencia real en datos, `05 §5` pt. 14 podrá volver a admitir esos campos — hasta entonces la
especificación dice lo que la sección puede mostrar hoy, no lo que se desearía mostrar.

**Alternativas descartadas.** (b) Ampliar el dataset dentro de B4: convierte un bloque de
presentación en un proyecto de investigación y retrasa indefinidamente la ficha. (c) Derivar una
frescura por lugar desde `updatedAt` con el umbral de `source-freshness.ts`: **inventa** una
afirmación de procedencia que nadie ha verificado, que es justo lo que `00` prohíbe. (d) Mostrar
filas vacías o «no disponible»: mismo error, en voz baja.

**Cómo se ha cerrado.** `05 §5` pt. 14 y `10 §B4` quedan reescritos para prometer sólo lo que
existe. La sección se implementa con grado, `updatedAt` y enlaces, y un gate comprueba que no
aparece ninguna de las cuatro etiquetas prohibidas ni una presentación de `updatedAt` como fecha
de consulta.

---

### DDR-05 — El criterio «la cadena `Dato:` no aparece» es de B4, pero el texto vive en B9
**Estado: RESUELTA** · Abierta 2026-09-21 · Cerrada 2026-09-21 · **Afecta:** `05 §11`, `10 §B4`, `10 §B9.5`

**La tensión.** `10 §B4` ponía entre los criterios de aceptación de este bloque: «La cadena
`Dato:` no aparece». `05 §11` lo decía aún más amplio: «no aparece **en ninguna parte de la
interfaz**». Pero las cuatro apariciones reales están en `OrderedSequenceBuilder.tsx` —el
planificador, pantalla `05 §7`/`§11`— y **ninguna en la ficha**. Y `10 §B9.5` asigna expresamente
su retirada a B9.5: «Sub-pestañas propias; **se elimina `Dato:`**».

**Decisión aprobada.** Se adopta la alternativa (a). **El criterio de aceptación de B20 se acota
explícitamente a la superficie B4**: la cadena `Dato:` no aparece en `PlaceDetail` ni en ninguna
superficie que B20 introduzca. B20 **no modifica `OrderedSequenceBuilder.tsx` ni el planificador**.
La eliminación global de las cuatro apariciones actuales **permanece en B9.5**, tal como ya
establece el roadmap, con la sustitución que `03 §10` fija (texto entre comillas con marcador
`◧ Registrado`).

**Qué sí hace B20.** Mantiene un gate que garantiza que la ficha no contiene `Dato:` y que este
bloque no la introduce. Es una afirmación verificable hoy y barata de sostener; no duplica el
trabajo de B9.5 ni lo adelanta.

**Alternativa descartada.** (b) Ampliar B4 al planificador: mete en este diff una pantalla que
nadie ha revisado en este bloque, y se apropia de un alcance que el roadmap ya asignó.

---

### DDR-B21-01…06 — Resoluciones del Bloque 21 (Explorar: portada y mapa)
**Estado: RESUELTAS** · Fecha: 2026-09-21 · **Afecta:** `05 §2`/`§3`/`§4`, `03 §9`, `09`, `10 §B5`

1. **DDR-B21-01 (DD-003): Base cartográfica**
   Usar el proveedor OSM actual aplicando a la capa de teselas el filtro CSS:
   `saturate(.25) contrast(.92) brightness(1.04)`. No usar CARTO. Atribución, geometría,
   marcadores y controles permanecen intactos. DD-003 pasa a estado Firme.

2. **DDR-B21-02: Destinos con 1–3 lugares**
   La palabra visible «cobertura» sigue prohibida. La sección de Sapporo/Nagoya/Fukuoka se llama
   exactamente «Más destinos». Contadores dinámicos con pluralización: «3 lugares por ahora» /
   «1 lugar por ahora».

3. **DDR-B21-03: Conteo dinámico de prefecturas**
   Eliminar el literal obsoleto «47 prefecturas, 6 con lugares verificados». Usar dinámicamente:
   «47 prefecturas · 15 con lugares en Nihon» (ambos números derivados del modelo).

4. **DDR-B21-04: Líneas editoriales de colecciones**
   - Imprescindibles: *Los lugares que más justifican el viaje.*
   - Joyas escondidas: *Sitios especiales que suelen quedar fuera de lo más obvio.*
   - Menos saturado: *Alternativas para disfrutar con menos gente alrededor.*
   - Para una tarde: *Planes que caben bien en un par de horas.*

5. **DDR-B21-05: Búsqueda global**
   Título/placeholder: «Buscar en todo Japón». Búsqueda real sobre todos los lugares sin ranking,
   conservando el orden del dataset. Consulta vacía no muestra resultados. Sin resultados:
   «Nada con “{consulta}” en Japón. Prueba con otro nombre.». Seleccionar un resultado abre
   `PlaceDetail` como superposición dentro de Explorar sin cambiar implícitamente la ciudad activa.
   Navegación back retiene consulta, resultados y scroll. Cierre de búsqueda/back devuelve a la portada.

6. **DDR-B21-06: Nombres japoneses de hubs**
   Mapa de presentación tipado y centralizado: Tokio → 東京, Kioto → 京都, Osaka → 大阪,
   Okinawa → 沖縄, renderizados con `lang="ja"` y fuente de voz. Sin cambios en dataset/workbook.

---

### DDR-06 — «Cerca de aquí»: nota al pie y `EvidenceMark` a la vez
**Estado: RESUELTA** · Abierta 2026-09-21 · Cerrada 2026-09-21 · **Afecta:** `04 §2`, `05 §5` pt. 12, `05 §12`

**La tensión.** `05 §5` pt. 12 pide que cada lugar cercano lleve «distancia, modo y `EvidenceMark`
según su confianza». Hoy, además, hay una nota al pie por sección (`transferListFootnote`) que
explica en prosa de dónde salen esos traslados. Pero `04 §2` prohíbe expresamente que «un bloque
con marcador» lleve «además un párrafo que repita lo mismo»: **el marcador sustituye al descargo**.
Y `05 §11` lo generaliza: «una sola nota al pie por sección, no un descargo por bloque».

**Decisión aprobada.** Se adopta la alternativa (a). En «Cerca de aquí»:

- **cada tarjeta compacta lleva su `EvidenceMark`**;
- **`transferListFootnote` deja de mostrarse en esta sección**;
- **no queda ningún párrafo de descargo** que repita la confianza que ya expresa el marcador.

**Pero el contrato «ninguna información desaparece» sigue vigente.** Esto es una **reubicación de
información, no una pérdida**: la semántica que hoy comunica la nota pasa al `detail` accesible del
`EvidenceMark` de **cada** traslado, que es además donde es cierta —la nota hablaba de la lista
entera y por eso tenía que generalizar—. Cada traslado conserva explícitamente su distinción:

- una **ruta validada** sigue dejando claro que son **datos de ruta validados y estáticos, no un
  horario en vivo**;
- una **estimación geográfica** sigue dejando claro que es una **estimación, no una ruta
  validada**;
- un traslado **schedule-aware**, si existe, sigue distinguiéndose **explícitamente** como horario
  en vivo;
- cualquier **fallback** que hoy se presente legítimamente como estimación geográfica **mantiene
  esa semántica**, sin ascender de nivel.

**Sin procedencia nueva y sin ascensos de confianza.** Se usan la gramática y el mapeo de evidencia
ya existentes (`03 §1.4`, `04 §2`, `lib/transfer-display.ts`): `validated-static` → `◼`,
`schedule-aware` → `◼` con su detalle propio, estimación y ausencia de traslado → `◇`. **Ningún
traslado sube a «Verificado» salvo donde el contrato existente ya lo determina.**

**Dónde vive el texto.** En `detail`, `aria-label` y/o `title`, conforme al contrato de
`EvidenceMark` (`04 §2`: cuando `label` es falso, el texto va a `aria-label` y `title` — no
desaparece de la información accesible, sólo del trazo visual). **No necesita repetirse como
párrafo visible**, y repetirlo sería precisamente lo que `04 §2` prohíbe.

**Alternativa descartada.** (b) Conservar la nota: obliga a enunciar qué dice que el marcador no
dice, y la respuesta honesta es «nada» — la nota generaliza sobre la lista lo que el marcador
afirma por traslado, con menos precisión.

**Cómo se ha cerrado.** `04 §2`, `05 §5` pt. 12, `05 §12` y `10 §B4` quedan explícitos en que esto
es una reubicación. `transferListFootnote` **sigue existiendo y sigue probado** en
`lib/transfer-display.ts` (otras superficies pueden usarlo); lo que cambia es que la ficha ya no lo
renderiza. Gates: la sección no contiene párrafo de descargo, cada traslado lleva marcador, y el
texto de la distinción es legible por un lector de pantalla.

---

### DDR-B24-1 — Encuadre inicial del mapa de ciudad
**Estado: RESUELTA** · Abierta 2026-09-25 (Bloque 24, P0-4) · Cerrada 2026-09-25 por **DD-023** · **Afecta:** `03 §9`, `05 §4` · **Bloqueante:** no

**La pregunta.** ¿Qué encuadra el mapa de una ciudad al abrirse? Hoy `FitHubBounds` ajusta el
mapa a **todos** los lugares del hub, y los hubs contienen excursiones lejanas: Tokio incluye
Takao (45 km), Mitake/Okutama (55 km) y el festival de Kawazu en Izu (123 km); Osaka llega a
Okunoshima (233 km); Okinawa a Yonaguni (513 km). El núcleo urbano queda comprimido en una esquina.

**Evidencia (medida en B24, dataset actual).**

| Hub | Lugares | Caja de todos los lugares | A ≤10 km de la mediana |
|---|---|---|---|
| Tokio | 57 | 114 × 81 km | 48 |
| Kioto | 49 | 26 × 16 km | 39 |
| Osaka | 53 | 223 × 302 km | 23 |
| Okinawa | 50 | 313 × 535 km | 11 |

Con la agrupación de `03 §9` ya aplicada, Tokio abre a 390×844 con un grupo «50», uno «4» y tres
puntos periféricos sueltos. Capturas (fuera del repositorio): `/tmp/b24/ddr1-{Tokio,Kioto,Osaka,
Okinawa}-A-{390,1440}.png` (encuadre actual) y `…-B-…png` (tras abrir el grupo mayor, que equivale
a encuadrar el núcleo).

**Opciones.**
- **(a) Conservar el encuadre de todos los lugares.** Honesto con el alcance del hub; el núcleo
  llega con uno o dos toques en el grupo mayor. Coste: la primera vista es casi vacía en Tokio,
  Osaka y Okinawa.
- **(b) Encuadrar el núcleo, calculado.** Ajustar a los lugares dentro de un radio de la mediana
  (p. ej. 10–15 km) o a un percentil; los lejanos quedan fuera de la primera vista y aparecen al
  alejar. Sin datos nuevos. Coste: un lugar guardado puede quedar fuera de cuadro sin aviso.
- **(c) Encuadre editorial por hub.** Un centro y un zoom fijados por ciudad en un mapa de
  presentación (como los nombres japoneses de DDR-B21-06). Sin tocar el dataset. Coste: una
  decisión editorial por hub.
- **(d) Núcleo + indicador de «fuera del mapa».** (b) o (c) más una marca en el borde que dice
  cuántos lugares quedan fuera. Coste: UI nueva, que `08` obliga a revisar.

**Qué ha hecho B24.** Nada sobre el encuadre: `FitHubBounds` no cambia.

**Cómo se ha cerrado.** Ver **DD-023**. En corto: opción (c) con fallback (b) — encuadre editorial
por hub (`lib/hub-view.ts`), calculado sobre el núcleo real de cada hub cuando no hay uno
declarado; los lugares periféricos no se retiran de nada, sólo dejan de decidir la primera vista;
el lugar seleccionado explícitamente sigue ganando siempre.

---

### DDR-B24-2 — Marcadores cercanos cuando hay 12 o menos a la vista
**Estado: RESUELTA** · Abierta 2026-09-25 (Bloque 24, P0-4) · Cerrada 2026-09-25 por **DD-024** · **Afecta:** `03 §9`, Art. 11 · **Bloqueante:** no

**La tensión.** `03 §9` agrupa **sólo por encima de 12** marcadores visibles. Art. 11 exige 44×44
por objetivo, y dos cajas de 44 px que se solapan son ambiguas (el criterio de
`b17-tap-target-check`). Al acercarse hasta tener 12 o menos a la vista, lugares vecinos vuelven a
ser marcadores sueltos cuyas cajas se solapan.

**Evidencia (B24, clic real sobre el grupo mayor hasta deshacerlo).** Tokio: «Shibuya Crossing» /
«SHIBUYA SKY» (1 par). Kioto: «Yasaka Kōshin-dō» / «Kōdai-ji» y «Kennin-ji» / «Gion Corner» (2).
Osaka: Dotonbori / Glico / Hozenji Yokocho (5 pares a 390). Okinawa: Kokusai Street / Makishi /
Tsuboya (7). Acercando un nivel más se separan.

**Opciones.**
- **(a) Agrupar también por debajo de 12, pero sólo los que se tocan.** Misma regla geométrica que
  ya se usa por encima de 12; nunca hay solape. Coste: cambia el umbral literal de `03 §9`.
- **(b) Sueltos, con impacto al más cercano.** Se reparte la zona solapada por la mediatriz: cero
  ambigüedad, pero cada objetivo queda por debajo de 44 px en un eje (incumple Art. 11).
- **(c) Aceptar el solape.** El orden de pintado decide; es la ambigüedad que Art. 11 prohíbe.

**Qué ha hecho B24.** Aplica `03 §9` literalmente: agrupa por encima de 12 y, cuando agrupa, ningún
par de cajas se toca (verificado en el gate B24). Por debajo de 12 no agrupa.

**Cómo se ha cerrado.** Ver **DD-024**. En corto: opción (a) — la regla geométrica de
`groupScreenPoints` (funde parejas cuya caja de 44 px se tocaría) se aplica siempre, no sólo por
encima de 12 marcadores visibles; eso cubre a la vez la regla de densidad de `03 §9` y la red de
seguridad de Art. 11 con el mismo código, y vuelve a separar en cuanto el zoom aleja las cajas.

---

### DDR-B24-3 — Volver desde un lugar abierto en una colección de la portada
**Estado: RESUELTA** · Abierta 2026-09-25 (Bloque 24, hallado al hacer la portada desplazable) · Cerrada 2026-09-25 por **DD-025** · **Afecta:** `02 §D3` pt. 2, `05 §2` · **Bloqueante:** no

**La tensión.** `02 §D3` pt. 2: «la profundidad se apila dentro de una pestaña … volver devuelve
exactamente al scroll anterior». Al abrir un lugar desde una colección de la portada, `selectPlace`
cambia Explorar a la ciudad de ese lugar (comportamiento de B21, igual que desde el mapa nacional);
al cerrar la ficha se vuelve a la lista de esa ciudad, no a la portada ni a su scroll. Con la
portada sin scroll (P0-1) el caso casi no se alcanzaba; ahora sí.

**Opciones.**
- **(a) Tratar las colecciones como la búsqueda global (DDR-B21-05):** la ficha se apila sobre la
  portada sin cambiar de ciudad; volver devuelve a la portada con su scroll.
- **(b) Conservar el salto a la ciudad**, que da contexto del lugar, y documentarlo como excepción
  a `02 §D3` pt. 2.

**Qué ha hecho B24.** Nada: es un cambio del modelo de vuelta atrás, que `08` reserva a revisión de
diseño. Cambiar de pestaña y volver sí conserva el scroll de la portada (verificado).

**Cómo se ha cerrado.** Ver **DD-025**. En corto: opción (a) — las colecciones de la portada se
comportan exactamente como la búsqueda global de DDR-B21-05.

---

### DD-023 — DDR-B24-1: encuadre editorial por hub con fallback calculado
**Estado:** Firme · **Fecha:** 2026-09-25 · **Afecta:** `03 §9`, `05 §4` · **Origen:** dirección, Bloque 24

**Decisión.** Se adopta la opción (c) de DDR-B24-1 con el fallback (b) para cualquier hub sin
encuadre declarado. Contrato:

1. Los hubs principales (Tokio, Kioto, Osaka, Okinawa) declaran un centro/zoom editorial.
2. Esa configuración vive fuera del dataset de lugares, en `lib/hub-view.ts` — una estructura de
   presentación tipada y centralizada (mismo patrón que el mapa de nombres japoneses de
   DDR-B21-06). No se introducen coordenadas editoriales dentro de los registros `Place`.
3. Si un hub no tiene configuración editorial, el encuadre inicial es el núcleo calculado sobre
   la mediana de sus propios lugares (radio 10 km, o la mediana de todos si ninguno cae dentro de
   ese radio) — nunca `fitBounds` de todos los lugares del hub.
4. Los lugares periféricos no desaparecen: siguen en el dataset, en listas y en búsqueda, y
   siguen disponibles en el mapa al desplazarlo o alejarlo — sólo dejan de decidir la primera
   vista.
5. Si el mapa se abre o se centra explícitamente desde un lugar concreto, ese lugar tiene
   prioridad y queda visible/centrado aunque esté fuera del encuadre editorial inicial
   (`FocusSelected` corre después de `FitHubBounds` y gana; mientras hay una ficha abierta,
   `FitHubBounds` no vuelve a competir por la vista).
6. No se añade ningún indicador nuevo de «lugares fuera del mapa» — la opción (d) queda
   descartada por ahora; si se necesita en el futuro, es una decisión de diseño propia (nueva UI
   que `08` obliga a revisar).

**Centros editoriales (calculados en la auditoría B24 sobre el núcleo real de cada hub, mediana +
radio 10 km):** Tokio `[35.6802, 139.7435]`, Kioto `[35.0079, 135.7574]`, Osaka `[34.6681,
135.4923]`, Okinawa `[26.2099, 127.7044]`, zoom 12 en los cuatro (encuadra un núcleo de ~10–13 km
de lado con el tamaño de mapa actual). Corresponden a 48/57, 39/49, 23/53 y 11/50 lugares del hub
dentro de ese núcleo — la misma evidencia que registró DDR-B24-1.

**Alternativas descartadas.** (a) Conservar el encuadre de todos los lugares: la primera vista
queda casi vacía en Tokio, Osaka y Okinawa (evidencia de DDR-B24-1). (d) Núcleo + indicador de
«fuera del mapa»: UI nueva fuera del alcance de este cierre; queda como posible trabajo futuro, no
como parte de esta decisión.

**Consecuencias.** `FitHubBounds` (`PlaceMap.tsx`) deja de llamar a `fitBounds`/`flyToBounds` con
todos los lugares del hub; usa `resolveHubView` (`lib/hub-view.ts`) y sólo actúa cuando no hay
ningún lugar seleccionado. Gate: `src/lib/hub-view.test.ts` (encuadre editorial para los cuatro
hubs, núcleo calculado reproduce la evidencia de la auditoría, un hub sin configuración cae al
fallback, el centro editorial no lo determinan los outliers). **DDR-B24-1 queda cerrada.**

---

### DD-024 — DDR-B24-2: red de seguridad geométrica de agrupación, siempre activa
**Estado:** Firme · **Fecha:** 2026-09-25 · **Afecta:** `03 §9`, Art. 11 · **Origen:** dirección, Bloque 24

**Decisión.** Se adopta la opción (a) de DDR-B24-2. Contrato:

- El umbral `>12` de `03 §9` sigue siendo la regla general de agrupación por densidad.
- Existe además una regla de seguridad geométrica independiente: si dos o más marcadores sueltos
  producirían áreas táctiles de 44×44 px con solape ambiguo, se agrupan aunque haya ≤12
  marcadores visibles.
- Cuando el zoom es suficiente para que esas áreas ya no colisionen, vuelven a separarse.
- Los tamaños visuales de `03 §9` no cambian; ningún objetivo baja de 44 px; no se acepta solape
  ambiguo; sin dependencia nueva.

**Cómo se implementa.** `groupScreenPoints` (`lib/map-grouping.ts`) ya fundía sólo las parejas de
puntos cuyas cajas de 44 px se tocarían — es exactamente la regla de seguridad geométrica.
`MarkerLayer` (`PlaceMap.tsx`) pasa a llamarla **siempre**, sin la condición previa
`shouldGroupMarkers(visibleCount)`: por encima de 12 el resultado es el mismo que antes (la
densidad produce solapes que se funden), y por debajo de 12 ahora también agrupa cualquier pareja
que se tocaría. `shouldGroupMarkers`/`MAP_GROUP_THRESHOLD` se conservan como la constante y
predicado que documentan el umbral literal de `03 §9`, aunque `MarkerLayer` ya no la usa como
condición de entrada — la geometría por sí sola cubre ambas reglas a la vez.

**Alternativas descartadas.** (b) Sueltos con impacto repartido por la mediatriz: incumple Art. 11
(un objetivo queda por debajo de 44 px en un eje). (c) Aceptar el solape: es exactamente la
ambigüedad que Art. 11 prohíbe.

**Consecuencias.** `03 §9` se reescribe para dejar constancia de que el umbral de 12 ya no es la
única condición de agrupación: la geometría de impacto de Art. 11 puede agrupar también por
debajo. Cobertura permanente de los cuatro conflictos que registró la auditoría (Tokio: Shibuya
Crossing/SHIBUYA SKY; Kioto: Yasaka Kōshin-dō/Kōdai-ji y Kennin-ji/Gion Corner; Osaka:
Dotonbori/Glico/Hozenji Yokocho; Okinawa: Kokusai Street/Makishi/Tsuboya) en
`src/lib/map-grouping.test.ts`, con una proyección Web Mercator idéntica a la de Leaflet para
reproducir sus coordenadas reales a distintos niveles de zoom, y una prueba de que vuelven a
separarse al acercar. **DDR-B24-2 queda cerrada.**

---

### DD-025 — DDR-B24-3: las colecciones de la portada se comportan como la búsqueda global
**Estado:** Firme · **Fecha:** 2026-09-25 · **Afecta:** `02 §D3` pt. 2, `05 §2` · **Origen:** dirección, Bloque 24

**Decisión.** Se adopta la opción (a) de DDR-B24-3. Al seleccionar un lugar desde una colección de
la portada:

- `PlaceDetail` se apila sobre la portada dentro de Explorar; no se cambia implícitamente la
  ciudad activa.
- La portada permanece montada (nunca se desmonta mientras la ficha está abierta).
- Cerrar mediante UI, Escape o back del navegador vuelve exactamente a la portada, con el scroll
  que tenía justo antes de abrirse la ficha.
- Se conserva cualquier estado local de la portada (nunca se remonta).
- No se introduce una segunda instancia de `PlaceDetail`.

Coherente con `02 §D3`: la portada es una superficie más de Explorar, y abrir un lugar desde ella
es la misma "profundidad apilada dentro de una pestaña" que abrirlo desde cualquier otro sitio de
Explorar — la única corrección es que, igual que la búsqueda global, no debe tratarse como un
salto implícito a la ciudad del lugar.

**Cómo se implementa.** `selectPlace` ya distinguía un cuarto parámetro, `exploreReturnSurface`,
con el valor `"global-search"` para eximir a la búsqueda global del salto de hub. Se generaliza a
`"global-search" | "home-collection"`, y las tres comprobaciones que antes miraban
específicamente `=== "global-search"` (el cambio de hub en `selectPlace`/`pushPlace`/`goBack`, y la
restauración de vista en un back real del navegador) pasan a mirar "cualquier
`exploreReturnSurface` no nulo". `ExplorerHome` etiqueta sus selecciones como `"home-collection"`;
el resto del mecanismo —apilado sobre la portada, sin desmontarla, restauración exacta al
cerrar— ya lo daba gratis la arquitectura existente (la portada es una superficie que se sigue
montando mientras `activeHub` sea `null`, y `placeDetailOverlay` ya se renderiza como hermano
suyo, no encima condicionalmente).

**Alternativa descartada.** (b) Conservar el salto a la ciudad como excepción documentada a `02
§D3` pt. 2: mantiene la inconsistencia entre dos superficies (búsqueda global y colecciones) que
deberían comportarse igual por ser ambas entradas "sin ciudad" a un lugar.

**Consecuencias.** Cobertura permanente en `src/block24-ddr3-home-collections.test.ts` (contrato
de código) y `app/scripts/b24-ddr3-home-collections-check.mjs` (comportamiento en vivo: apertura
desde colección, cierre normal, Escape, back del navegador, restauración de scroll, ausencia de
cambio implícito de ciudad). **DDR-B24-3 queda cerrada.**

---

### DD-026 — El cromo interactivo del mapa es zona de exclusión para los objetivos
**Estado:** Firme · **Fecha:** 2026-09-25 · **Afecta:** `03 §9`, `05 §4`, Art. 11 · **Origen:** dirección, Bloque 24 (P0-4e)

**Decisión.** El rectángulo que ocupa cualquier control interactivo superpuesto al mapa (la
leyenda de intereses, los controles de Leaflet de zoom y atribución, y cualquier control futuro)
es espacio no válido para las cajas de impacto de 44×44 px de marcadores y grupos. Contrato:

- Tras **todo movimiento programático** del mapa —encuadre inicial de un hub, abrir un grupo,
  centrar un lugar seleccionado, volver a mostrar un mapa que estaba oculto— ninguna caja de
  impacto queda debajo del cromo, total o parcialmente: `elementFromPoint` en su centro resuelve
  al marcador.
- Si el movimiento deja alguna debajo, el mapa se desplaza la **traslación más corta** que las
  libera a todas sin meter otra debajo, sin sacar de la pantalla a las que libera y sin sacar al
  lugar seleccionado. Trasladar no cambia la agrupación (es invariante a traslaciones).
- Los gestos de la persona (arrastrar, rueda, pellizco) **no** se corrigen: el mapa no pelea con
  quien lo maneja.
- No se reduce ningún objetivo por debajo de 44 px, no se oculta ningún lugar, no se resuelve
  subiendo el `z-index` de los marcadores (los dos controles deben seguir siendo usables) y la
  leyenda conserva su sitio (esquina inferior izquierda): moverla de esquina sólo trasladaría la
  colisión.
- El cromo se mide en vivo, no se declara con números: la regla sigue valiendo si la leyenda
  cambia de tamaño (abierta, otro idioma, otra tipografía) o si se añade un control.

**Cómo se implementa.** `lib/map-chrome.ts` (geometría pura, sin Leaflet ni DOM):
`chromeClearingShift(objetivos, cromo, encuadre, conservar)` devuelve la traslación mínima o
`null`. En `PlaceMap.tsx`, todo movimiento programático pasa por `moveProgrammatically`; al
terminar (`moveend`), la guarda de `MarkerLayer` proyecta los objetivos reales (los mismos grupos
que pinta) y mide el cromo: los elementos marcados con `data-map-chrome` junto al mapa y los
`.leaflet-control`. Un control nuevo superpuesto al mapa **debe** llevar `data-map-chrome`. Los
movimientos programáticos sólo se animan si el mapa tiene tamaño (`canAnimate`): con otro
destino activo el contenedor mide 0×0 y `flyTo` de Leaflet calcula `LatLng(NaN, NaN)`.

**Alternativas descartadas.** Ajustar el encuadre de `expand()` con márgenes mayores (probado dos
veces en F6: la posición final de un marcador depende de todos los lugares de la ciudad, no sólo
del grupo abierto, y no establece ningún invariante). Mover la leyenda de esquina (traslada la
colisión). Una franja muerta fija en el contenedor (cambia el diseño del mapa y deja de valer si
la leyenda cambia de tamaño). Subir el `z-index` de los marcadores (tapa la leyenda).

**Consecuencias.** `03 §9` y `05 §4` recogen el invariante. Cobertura permanente:
`src/lib/map-chrome.test.ts` (unitario) y `b24-real-input-audit.mjs` hallazgo `P0-4e` en los 8
viewports, con y sin `prefers-reduced-motion`: tras el encuadre inicial, tras abrir hasta tres
grupos seguidos y tras seleccionar un lugar, cada marcador visible mide ≥44×44, no toca el cromo
y `elementFromPoint` resuelve a él; la leyenda se abre y se cierra con clic real; los iconos
siguen representando todos los lugares.

---

### DD-028 — El nombre accesible de PlaceCard iguala su identificación visible
**Estado:** Firme · **Fecha:** 2026-09-26 · **Afecta:** `04 §5` (regla 11), Art. 11 · **Origen:** dirección, merge-readiness de PR #152

**Decisión.** El nombre accesible de `PlaceCard` debe igualar la información visible de
identificación. Si el texto visible identifica «{nombre del lugar}» y «{barrio}, {ciudad}», el
nombre accesible incluye la misma información en el mismo orden lógico —«{nombre}, {barrio},
{ciudad}»—, o «{nombre}, {ciudad}» si no hay barrio, adaptado al patrón existente del control
de apertura («{nombre}. {nivel}. {categoría} en {ubicación}.»).

**Regla general.** El nombre accesible nunca puede ser un subconjunto de la información
visible de identificación de una tarjeta. Si en el futuro se añade información identificativa
al texto visible de `PlaceCard`, su nombre accesible se actualiza en el mismo cambio.

**Problema que cierra.** Tras P0-5c (B24) la fila compacta —búsqueda de todo Japón, «Cerca de
aquí»— pinta «{categoría} · {barrio}, {ciudad}», pero el control de apertura seguía diciendo
«… en {barrio}.» (o «… en {municipio}.»): quien usa lector de pantalla no oía la ciudad que
todos los demás ven, precisamente en las dos superficies que mezclan lugares de varias ciudades.

**Cómo se implementa.** `PlaceCard.tsx` calcula `visibleWhere` con la misma función que pinta la
línea visible (`compactPlaceLine` en `compact`, `zone` en `normal`) y un único `openLabel` que
alimenta `aria-label` y `title` del único botón de apertura. La variante `normal` no cambia.

**Consecuencias.** Cobertura: `src/components/PlaceCard.test.ts` (contrato de fuente y texto con y
sin barrio), `src/block1-ux.test.ts` (patrón actualizado) y
`app/scripts/dd028-placecard-accessible-name-check.mjs`, que lee el nombre del árbol de
accesibilidad de Chromium (CDP) en búsqueda global, «Cerca de aquí» y lista de hub, en móvil y
escritorio (16/16; con el código anterior, 4 fallos).

---

## Decisiones abiertas

| # | Pregunta | Quién puede cerrarla | Bloquea |
|---|---|---|---|
| **OD-01** | ¿Se añade modo oscuro en esta evolución? | Producto | Nada; los tokens ya lo permiten |
| **OD-02** | ¿Se colapsan las 29 categorías a 26 sólo en presentación, o también en el workbook? | Producto + datos | B3 puede avanzar con el mapa de presentación |
| **OD-03** | ¿Hay presupuesto de adquisición fotográfica para las ~53 imágenes del agujero de cobertura? | Producto | B6 |
| **OD-04** | ¿Se permite alguna vez una tercera persona en el viaje? | Producto | Nada hoy; afectaría a `03 §1.2` |

> **DDR-01, DDR-02, DDR-03, DDR-04, DDR-05 y DDR-06 están RESUELTAS.** No queda ninguna
> decisión de diseño pendiente que bloquee B20.
>
> **Bloque 24:** DDR-B24-1, DDR-B24-2 y DDR-B24-3 están **RESUELTAS** (DD-023, DD-024, DD-025).
> DD-026 (cromo del mapa como zona de exclusión, P0-4e) es firme. No queda ninguna decisión de
> diseño abierta en B24.
