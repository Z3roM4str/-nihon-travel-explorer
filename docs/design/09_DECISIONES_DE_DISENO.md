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

## Decisiones abiertas

| # | Pregunta | Quién puede cerrarla | Bloquea |
|---|---|---|---|
| **OD-01** | ¿Se añade modo oscuro en esta evolución? | Producto | Nada; los tokens ya lo permiten |
| **OD-02** | ¿Se colapsan las 29 categorías a 26 sólo en presentación, o también en el workbook? | Producto + datos | B3 puede avanzar con el mapa de presentación |
| **OD-03** | ¿Hay presupuesto de adquisición fotográfica para las ~53 imágenes del agujero de cobertura? | Producto | B6 |
| **OD-04** | ¿Se permite alguna vez una tercera persona en el viaje? | Producto | Nada hoy; afectaría a `03 §1.2` |

> **DDR-01, DDR-02, DDR-03, DDR-04, DDR-05 y DDR-06 están RESUELTAS.** No queda ninguna
> decisión de diseño pendiente que bloquee B20.
