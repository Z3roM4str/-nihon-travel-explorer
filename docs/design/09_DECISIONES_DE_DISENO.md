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

## Decisiones abiertas

| # | Pregunta | Quién puede cerrarla | Bloquea |
|---|---|---|---|
| **DD-003** | Proveedor de teselas apagadas | Ingeniería, entre las dos opciones dadas | B5 |
| **OD-01** | ¿Se añade modo oscuro en esta evolución? | Producto | Nada; los tokens ya lo permiten |
| **OD-02** | ¿Se colapsan las 29 categorías a 26 sólo en presentación, o también en el workbook? | Producto + datos | B3 puede avanzar con el mapa de presentación |
| **OD-03** | ¿Hay presupuesto de adquisición fotográfica para las ~53 imágenes del agujero de cobertura? | Producto | B6 |
| **OD-04** | ¿Se permite alguna vez una tercera persona en el viaje? | Producto | Nada hoy; afectaría a `03 §1.2` |
