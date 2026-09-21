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
**Estado:** Provisional · **Afecta:** `03 §9`, `05 §3`, `05 §4`

**Decisión.** Se abandonan las teselas OSM crudas por una base gris clara con poca
rotulación.

**Alternativas descartadas.** OSM sin cambios: es el motivo principal de que la vista
de ciudad parezca un clon de Google Maps, y su saturación compite con los marcadores.

**Abierto.** El proveedor concreto depende de licencia y de política de uso. Preferido:
CARTO Positron. Alternativa aceptada sin coste ni dependencia nueva: OSM con filtro
CSS `saturate(.25) contrast(.92) brightness(1.04)`. Ingeniería puede elegir entre esas
dos e informar; cualquier tercera opción requiere revisión.

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

## DESIGN DECISION REQUIRED

Contradicciones reales entre el sistema congelado y una decisión ya tomada. **No se
improvisa una arquitectura para taparlas**: se dejan escritas aquí, con su tensión exacta,
hasta que producto o diseño las cierren.

### DDR-01 — `05 §5` pide conservar `panelOffset`; la geometría del raíl lo deja sin sitio
**Abierta desde:** 2026-09-21 · **Afecta:** `05 §5`, DD-016 · **Bloquea:** nada hoy; B4
tendrá que resolverlo al rediseñar la ficha

**Qué dice un lado.** `05 §5`, *Responsive*: «`lg`+: el panel no oculta el marcador
seleccionado en el mapa (se conserva `panelOffset`)». Eso presupone que el raíl del mapa
es **más ancho** que la ficha, de modo que quede una franja de mapa a la vista sobre la
que desplazar el marcador.

**Qué dice el otro.** La fórmula de cabida de DD-016 fija el raíl en exactamente una
ficha de ancho (`min(480 px, 50 %)`). No es una elección estética: a 1200 px, con el
`NavRail` de 88 px y el mínimo de 264 px por tarjeta, la región de lista necesita ≥564 px
para dar dos columnas, así que el raíl no puede pasar de 548 px; y cualquier raíl entre
481 y 548 px deja una tira de mapa de 1 a 68 px, que no es un mapa. Con el raíl a 480 px,
**la ficha lo cubre entero** y no queda marcador que salvar. La propia DD-016 exige además
que el mapa conserve centro, zoom y marcador al abrir y cerrar la ficha, lo que es
incompatible con moverlo al abrirla.

**Qué se ha hecho mientras tanto.** Se ha implementado la resolución: `panelOffset` sigue
existiendo y sigue significando lo mismo («cuánto del mapa tapa la ficha por la derecha»),
pero `PlaceMap` ya no desplaza el mapa cuando ese valor cubre el contenedor entero. El
mecanismo que `05 §5` manda conservar está **intacto y operativo** para el día en que la
ficha sea más estrecha que el raíl; hoy simplemente no tiene nada que compensar. No se ha
tocado `05 §5`.

**Qué habría que decidir.** Una de tres: (a) aceptar que en `lg`/`xl` la ficha cubre el
mapa y retirar la frase de `05 §5`; (b) estrechar la ficha por debajo de 480 px en `lg`+
para que quede mapa visible, lo que toca `02 §D5` y `05 §5` a la vez; o (c) bajar el
mínimo de 264 px de `PlaceCard`, lo que permitiría un raíl más ancho a costa de la
tarjeta. Nada de esto lo puede decidir ingeniería.

---

## Decisiones abiertas

| # | Pregunta | Quién puede cerrarla | Bloquea |
|---|---|---|---|
| **DD-003** | Proveedor de teselas apagadas | Ingeniería, entre las dos opciones dadas | B5 |
| **OD-01** | ¿Se añade modo oscuro en esta evolución? | Producto | Nada; los tokens ya lo permiten |
| **OD-02** | ¿Se colapsan las 29 categorías a 26 sólo en presentación, o también en el workbook? | Producto + datos | B3 puede avanzar con el mapa de presentación |
| **OD-03** | ¿Hay presupuesto de adquisición fotográfica para las ~53 imágenes del agujero de cobertura? | Producto | B6 |
| **OD-04** | ¿Se permite alguna vez una tercera persona en el viaje? | Producto | Nada hoy; afectaría a `03 §1.2` |
| **DDR-01** | ¿`panelOffset` en `lg`+, o ficha que cubre el mapa? (ver arriba) | Producto + diseño | Nada hoy; B4 al rediseñar la ficha |
