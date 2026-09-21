# 05 — Especificaciones de pantalla

Cada pantalla: propósito, contenido y jerarquía, comportamiento, estados, responsive y
**criterios de aceptación** verificables.

Todo lo no especificado aquí se resuelve con `03` y `04`. Si tampoco está ahí:
`DESIGN DECISION REQUIRED`.

---

## 1. Primera apertura

**Propósito.** Que en diez segundos alguien entienda que esto es sobre Japón, que es
bonito, que hay dos personas y que su trabajo es marcar lo que le llame.

**Cambio respecto a hoy.** El explicador de tres tarjetas actual es correcto en
contenido y se conserva **casi íntegro**, pero pasa a ser **pantalla completa con
fotografía a sangre**, no un cuadro blanco centrado sobre un mapa gris. Y se le añade
un cuarto paso funcional: los nombres.

**Secuencia**

1. **Hola.** Fotografía a sangre de un lugar grado S. Sobre `--scrim-bottom`:
   «Nihon» (`--type-display`) y «El cuaderno de vuestro viaje a Japón». Un botón
   `primary lg`: «Empezar».
2. **Explora Japón** — texto actual, conservado.
3. **Marca lo que te gustaría ver** — texto actual, conservado.
4. **Después comparáis** — texto actual, conservado.
5. **¿Quiénes sois?** Dos campos de nombre con su `PersonToken` en vivo (A añil, B
   peonía), prerrellenados con «Persona 1» / «Persona 2» y seleccionables de golpe.
   Debajo: «¿Quién tiene este teléfono?» con dos opciones grandes. Botón: «Entrar».

**Comportamiento.** Se puede saltar en cualquier paso; saltar acepta los nombres por
defecto y la persona A como activa. Se marca como visto y no vuelve a aparecer. Es
reabrible desde Nosotros › Cómo funciona Nihon.

**Criterios de aceptación**
- [ ] El paso 1 muestra una fotografía real del catálogo, nunca un color plano.
- [ ] El paso 5 escribe nombre y persona activa en el mismo almacén que usa hoy
      `useTravellers`, sin migración de datos.
- [ ] Ninguna pantalla del explicador usa emoji.
- [ ] `Escape`, el botón de cierre y «Saltar» siguen cerrando y marcando visto.

---

## 2. Explorar — Inicio

**Propósito.** La portada del producto. Sustituye al mapa nacional como primera
pantalla (defecto D5: hoy la primera impresión es un mapa coroplético y 90 px de aviso
de licencia).

**Contenido, en orden**

1. **Cabecera** (56 px): «Explorar» + `PersonToken` activo.
2. **Buscador** pegajoso: «Buscar en todo Japón».
3. **Ciudades** — tarjetas fotográficas a ancho completo, 16:9, apiladas:
   Tokio (57), Kioto (49), Osaka (53), Okinawa (50). Cada una: fotografía de un lugar
   grado S de esa ciudad, nombre en `--font-voice` `--type-title-l` y el nombre japonés
   debajo, más «57 lugares» en `--type-num`.
4. **Cobertura inicial** — fila horizontal de tarjetas `compact`: Sapporo (3),
   Nagoya (1), Fukuoka (1), con la etiqueta honesta **«Cobertura inicial»**. Corrige
   el defecto D6: un hub con un lugar no puede presentarse como igual a Tokio.
5. **Colecciones** — carruseles horizontales de `PlaceCard` (proporción 3:4, ancho
   264 px), derivados de campos que ya existen:
   - «Imprescindibles» → grado S (32 lugares)
   - «Joyas escondidas» → `hiddenGemStatus = Hidden Gem real` (35)
   - «Menos saturado» → `Alternativa menos saturada` (14)
   - «Para una tarde» → duración ≤ 2 h
   Cada colección: título `--type-title-m` + una línea editorial. **Sin ordinales.**
6. **Mapa de Japón** — tarjeta ancha con miniatura de la silueta, texto «Ver Japón en
   el mapa» y «47 prefecturas, 6 con lugares verificados». Abre la pantalla 3.

**Por qué las colecciones.** Es el cambio que más barato convierte «base de datos» en
«producto editorial»: no requiere ningún dato nuevo, sólo consultas sobre campos que ya
están en `places.json`.

**Responsive.** `sm`: ciudades en 2 columnas. `md`+: ciudades en 2 columnas grandes y
colecciones en rejilla de 3. `lg`+: ancho máximo 1440, sin panel de mapa (aquí el mapa
es una tarjeta, no una lente).

**Criterios de aceptación**
- [ ] La primera pantalla muestra al menos una fotografía por encima del pliegue en
      390×844.
- [ ] Ningún aviso de licencia aparece en esta pantalla.
- [ ] Las cuatro colecciones se derivan del dataset existente, sin campos nuevos.
- [ ] Los hubs de 1–3 lugares aparecen separados y etiquetados como cobertura inicial.

---

## 3. Explorar — Mapa de Japón

**Propósito.** Conservar íntegra la inversión en geometría MLIT y navegación
región → prefectura → hub, sin que sea la puerta de entrada.

**Cambios.** Pantalla completa (el mapa ocupa todo, sin barras encima). Panel inferior
arrastrable en tres alturas (asa, 25 %, 75 %) con regiones y prefecturas: es la lista
actual, reubicada. El aviso de licencia MLIT se sustituye por un botón `ⓘ` de 32 px en
la esquina inferior derecha que abre una hoja con el texto completo; el texto íntegro
vive además en Nosotros › Fuentes y licencias.

**Estados.** Prefectura sin lugares verificados: permanece dibujada, sin relleno, y al
tocarla muestra «Todavía sin lugares verificados». Se conserva la regla actual de no
fingir contenido.

**Criterios de aceptación**
- [ ] Toda la navegación region/prefectura/hub existente sigue accesible por teclado.
- [ ] El aviso MLIT sigue presente en el producto y enlazado desde el propio mapa.
- [ ] Las teselas usan la base apagada definida en `03 §9`.

---

## 4. Explorar — Ciudad

**Propósito.** El corazón del descubrimiento. Hoy cuesta 330 px de cromo; el objetivo
son **104 px**.

**Cromo** (Art. 8)

```
┌──────────────────────────────────────┐
│ ← Tokio ⌄                       (A)  │  56 px  cabecera
│ [ ⌕ Buscar en Tokio ][Filtros][Mapa] │  48 px  barra pegajosa
├──────────────────────────────────────┤
│  tarjetas                            │
```

- El selector de ciudad desaparece como barra: es el menú del título (`Sheet` con las
  7 ciudades y sus contadores).
- «Dónde dormir» deja de ser un icono de cama sin etiqueta en el cromo. Pasa a ser una
  **tarjeta de entrada** insertada tras las primeras 6 tarjetas de la lista: «Dónde
  dormir en Tokio — 6 zonas con estrategias distintas», que enlaza a Viaje › Dónde
  dormir con la ciudad preseleccionada. Sólo en las 3 ciudades con zonas modeladas.

**Lista.** `PlaceCard` a ancho completo, separación `--space-3`. Orden por defecto: el
actual del dataset. Carga progresiva de 12 en 12 al hacer scroll.

**Estados**
- *Sin resultados de filtro*: `EmptyState` «Ningún lugar coincide. Los 57 lugares de
  Tokio siguen ahí, sólo están filtrados.» + «Limpiar filtros». (Se conserva el texto
  actual, que ya es bueno.)
- *Búsqueda sin resultados*: «Nada con "onsen" en Tokio. Prueba en otra ciudad o quita
  los filtros.»

**Responsive (DD-016).** La lista es la superficie primaria: se queda con todo el ancho
que el **raíl derecho** no usa, y el raíl mide `min(480 px, 50 % del cuerpo)` (`02 §D5`).
El número de columnas **no lo decide el viewport**: lo decide la cabida real del ancho
efectivo de la región de lista —con `PlaceCard` nunca por debajo de 264 px (`04 §5`)—,
acotada por el tope del breakpoint. Topes: `base` 1 · `sm` 2 · `md` 2 · `lg` 2 · `xl` 3.

- `sm`: la lista ocupa la pantalla; 2 columnas.
- `md`: la lista ocupa el cuerpo entero (2 columnas). Al abrir la ficha, ésta pasa a ser
  el raíl y la región de lista se estrecha: **2 columnas → 1**, sin que el viewport
  cambie. El mapa sigue siendo una superficie conmutada, como en teléfono.
- `lg`: mapa persistente en el raíl, **máximo 50 % del ancho** (hoy es 74 %); lista a
  2 columnas. La ficha se apoya sobre el mismo raíl, así que el mapa no cambia de tamaño
  al abrirla ni al cerrarla y conserva centro, zoom y marcador seleccionado.
- `xl`: lo mismo con 3 columnas de lista.

El ancho de viewport en el que `lg` llega a 2 columnas (~1090–1140 px según el cromo
real) es una **consecuencia aritmética** de esa fórmula, no un breakpoint: no se escribe
en el código ni en este documento.

**Comportamiento de referencia** (lo que mide `app/scripts/block19-grid-check.mjs`):

| Viewport | Ficha | Columnas |
|---|---|---|
| 360 | cerrada | 1 |
| 600 | cerrada | 2 |
| 840 | cerrada | 2 |
| 840 | **abierta** | **1** |
| 1200 | cerrada | 2 |
| 1600 | cerrada | 3 |

**Criterios de aceptación**
- [ ] En 390×844, el cromo permanente superior mide ≤112 px.
- [ ] Existe una sola barra de controles, no tres.
- [ ] Todos los filtros de v1.1.0 siguen disponibles y con el mismo vocabulario.
- [ ] «Dónde dormir» sigue alcanzable desde la ciudad, ahora con etiqueta visible.
- [ ] Los seis casos de la tabla de arriba dan exactamente 1/2/2/1/2/3 columnas.
- [ ] Ninguna `PlaceCard` mide menos de 264 px de ancho a ningún ancho de pantalla.
- [ ] El raíl derecho nunca pasa del 50 % del ancho del cuerpo.
- [ ] En `lg`/`xl`, abrir y cerrar la ficha deja el mapa con el mismo centro, el mismo
      zoom y el mismo marcador seleccionado.

---

## 5. Ficha de lugar

**Propósito.** Responder «¿por qué este sitio?» antes que «¿qué horario tiene?».
Es la pantalla donde Nihon demuestra que tiene criterio.

**Cambio estructural.** Pantalla completa en teléfono, **sin ninguna barra encima**
(corrige D3). El bloque de créditos sale del flujo (corrige D2). El `×` flotante
desaparece (corrige D4).

**Contenido, en orden**

1. **Galería** a sangre 4:5. Botón atrás flotante arriba-izquierda sobre
   `--scrim-top`; `ⓘ` de créditos abajo-izquierda; contador abajo-derecha.
2. **Cuerpo**, sobre `--surface`, con `--radius-xl` arriba y solapando la fotografía
   20 px (señal de que hay contenido debajo).
3. **Nombre** `--type-display`. Debajo, nombre japonés `lang="ja"` `--ink-500`.
4. **Una línea** de categoría y barrio: `icono Ciudad y barrios · Shibuya`.
   Sin eyebrow encima del título, un solo `·`.
5. **Insignia** «★ Imprescindible» sólo si grado S. **Nunca «Grado A»** (corrige la
   redundancia actual). La letra sobrevive en «Fuentes».
6. **Acciones**: botón `primary lg` a ancho completo «Quiero ir» (o «Ya lo quieres
   ver», estado activo con `mark`). A su lado, `quiet`: «No me interesa».
7. **Franja de los dos** — sólo si alguien ha opinado. Una línea:
   `(A) Ana quiere ir · (B) Luis todavía no ha dicho nada`. Si nadie ha opinado, **no
   se renderiza** (corrige D8: hoy se estrena con dos filas vacías).
8. **Por qué vale la pena** — el `differentiator` en `--type-quote`, `--font-voice`,
   sin comillas decorativas, con un filete vertical `--shu-600` de 2 px a la izquierda.
   **Es el mejor tratamiento tipográfico del producto.**
9. **Qué es** — `description`. **Qué se hace o se ve** — `experience`, si difiere.
10. **Datos prácticos** — rejilla de 2 columnas: tiempo de visita, precio, mejor
    momento, mejor época; y debajo, filas de horario, cierres, reserva, cómo llegar,
    accesibilidad, afluencia. Cada valor con su `EvidenceMark`. Títulos en caja de
    frase, **no en mayúsculas**.
11. **Aviso de febrero–marzo 2027** — **sólo si hay un problema real** (cierre
    confirmado, restricción, riesgo). Si el estado es «pendiente de confirmar», baja a
    una línea dentro de «Horario»: «Sin cierre confirmado para feb–mar 2027 ·
    reconfirmar antes de ir» con marcador `◧`. Corrige la fatiga de alerta.
12. **Cerca de aquí** — carrusel horizontal de `PlaceCard compact` **con miniatura**
    (hoy es una lista de texto). Cada uno con distancia, modo y `EvidenceMark` según su
    confianza (`validated-static` → `◼`, geográfica → `◇`).
13. **Enlaces**: sitio oficial, Google Maps.
14. **Fuentes** — desplegable cerrado por defecto. Contiene: grado original, `provenance`,
    `consultedAt`/freshness, `updatedAt`, versión del dataset, enlaces oficiales.
    **Aquí vive todo lo que hoy se derrama por la ficha.**

**Responsive (DD-016, DD-017).** `md`+: panel derecho de 480 px, galería 4:3, mismo
orden. La ficha **es** el raíl derecho (`02 §D5`): en `md` lo crea ella, y en `lg`+ lo
comparte con el mapa, que ya vive ahí.

`lg`/`xl` — **mapa y ficha son una sola región** (DD-017). Con la ficha cerrada el mapa
funciona con normalidad. Al abrirla, **la ficha puede cubrir el mapa por completo**: no
hay obligación de mantener visible el marcador seleccionado, y **no se fabrica una franja
residual de mapa** para simular que sí. Lo que sí es obligatorio es que el mapa **no se
entere**: conserva centro, zoom y selección mientras está tapado, y al cerrar la ficha
reaparece exactamente en el mismo estado en que se quedó.

`panelOffset` se conserva como mecanismo, con su alcance acotado: **sólo actúa en una
geometría donde el mapa y el panel sean simultáneamente visibles**. Cuando el panel cubre
el mapa entero, no desplaza nada — mover un mapa que nadie ve sólo consigue que el lector
se lo encuentre en otro sitio al cerrar la ficha.

**Criterios de aceptación**
- [ ] En teléfono, la ficha ocupa el 100 % de la altura visible; ninguna barra de
      navegación de nivel superior es visible tras ella.
- [ ] Entre la fotografía y el nombre no hay ningún texto de atribución.
- [ ] La letra de grado no aparece fuera de «Fuentes».
- [ ] El aviso de feb–mar 2027 no se renderiza como alerta cuando el estado es
      «pendiente».
- [ ] Toda la información de `PlaceDetail` v1.1.0 sigue presente en alguna sección, y
      esta especificación dice en cuál.
- [ ] Vuelta atrás restaura la posición de scroll exacta de la lista.

---

## 6. Quiero ir

**Propósito.** La pantalla emocional del producto: **en qué coincidís**. Hoy esto está
detrás de un botón llamado «Analizar selección» y el titular de la pantalla es un
rango de duración (defecto D9).

**Contenido**

1. Cabecera «Quiero ir» + contador.
2. **Segmentado**: `Los dos` · `Ana` · `Luis`. Es un filtro, no un cambio de identidad.
3. **Resumen** — una fila de tres datos `--type-num`, del mismo tamaño:
   `18 lugares · 4 ciudades · ≈2–3 días de visitas`. La duración deja de ser el
   titular; es uno de tres. Con `EvidenceMark ◇` y una única nota: «Sólo tiempo dentro
   de cada lugar».
4. **Los dos queréis ir (6)** — primero, siempre. `PlaceCard compact` con token
   bermellón.
5. **Sólo Ana (7)** / **Sólo Luis (5)** — secciones plegables, cada una con su color.
6. **Descartados** — lo marcado «no me interesa», plegado.
7. Acción anclada abajo: `primary lg` **«Llevar al viaje»** (sin flecha).

**Comportamiento.** Quitar un lugar usa deslizamiento o botón con confirmación por
`Toast` y «Deshacer». Agrupación secundaria por ciudad dentro de cada sección.

**Estados**
- *Vacío*: fotografía suave + «Todavía no habéis marcado nada. Pulsa el corazón en
  cualquier lugar que os llame; guardad de más, que luego se recorta.» + «Explorar
  Tokio».
- *Sólo una persona ha marcado*: la sección «Los dos» no se muestra vacía; en su lugar,
  una línea: «Cuando Luis marque sus sitios, aquí veréis en qué coincidís.»

**Criterios de aceptación**
- [ ] La sección de coincidencias es lo primero tras el resumen, sin ningún clic.
- [ ] Toda la lógica de `SelectionAnalysis` y de divergencia (Bloques 5 y 6) se
      conserva; sólo cambia su ubicación.
- [ ] El titular de la pantalla no es una duración.
- [ ] Ningún texto dice «analizar».

---

## 7. Viaje — Días

**Propósito.** Convertir lo acordado en un viaje. **Inversión del modelo actual**: hoy
el objeto primario es un «recorrido» plano y los días son una sub-vista a la que se
llega con «Distribuir por días». A partir de ahora **el día es el objeto primario**,
que es como piensan las personas.

**Sub-pestañas de Viaje**: `Días` · `Dónde dormir` · `Reservas` · `Resumen`.

**Contenido de «Días»**

1. Cabecera «Viaje» + fechas si están fijadas («22 feb – 5 mar»). Si no: botón
   «Poner fecha de inicio».
2. **Una sola línea de encuadre**, permanente y discreta, en lugar de las cinco cajas
   de descargo actuales: «Vosotros decidís el orden. Nihon sólo describe lo que ese
   orden implica.» Con `EvidenceMark ✎`.
3. **Lista de días** con `DayTimeline`:
   - Cabecera de día: «Día 3 · mié 24 feb · Kioto», duración total de visitas, número
     de paradas.
   - Paradas como `TripStop`, conectadas por el raíl.
   - Pie de día: «Dormís en Shinjuku» (enlaza a Dónde dormir) o «Sin alojamiento
     elegido».
   - Acciones por día: añadir lugar, probar otro orden, eliminar día.
   - Entre días de ciudades distintas: fila de **traslado entre ciudades** (el
     `InterHubSegment` actual).
4. **Sin asignar** — cajón inferior persistente con asa: «7 sitios sin día». Se
   expande y permite arrastrar o «Añadir al día…».
5. «Añadir día» al final.

**Reordenar.** Arrastrar dentro de un día. Alternativa obligatoria por teclado y para
lectores de pantalla: menú «Mover a…» con destino explícito (día y posición). Se
eliminan los tríos `↑ ↓ ×` por fila (defecto D10).

**Probar otro orden.** Sustituye a «Orden A / Orden B» como vista de primer nivel. Es
una hoja **local a un día**: muestra el orden actual y una propuesta que el usuario
reordena, con la comparación de traslados que ya calcula `sequence-comparison.ts`. Las
alternativas verificadas (`evidence-complete-*`) se ofrecen aquí como opciones
etiquetadas «Comprobado con datos completos», **nunca aplicadas solas**. Botón:
«Usar este orden».

**Criterios de aceptación**
- [ ] La pantalla abre mostrando días, no una lista plana.
- [ ] Ninguna caja de descargo aparece al abrir; hay exactamente una línea de encuadre.
- [ ] Cada parada muestra una miniatura fotográfica.
- [ ] Toda la capacidad de `OrderedSequenceBuilder` sigue alcanzable: comparación de
      órdenes, alternativas verificadas, anclaje de calendario, identidad estable de
      día, límites del viaje, traslados entre ciudades.
- [ ] Reordenar es posible sólo con teclado.
- [ ] Nihon sigue sin proponer un orden por su cuenta.

Cuando esta pantalla (o cualquier otra sub-pestaña de Viaje) abra la ficha de un
lugar, aplica exactamente el mismo contrato que «Dónde dormir» ya implementa —
ver «Apertura de ficha de lugar desde Viaje» al final de `§8`.

---

## 8. Viaje — Dónde dormir

**Propósito.** Elegir zona de alojamiento comparando hechos, cálculos y opinión, sin
convertirlo en un ranking.

**Cambios**

- **Se eliminan los ordinales 1–6** (defecto D7): numerar contradice «ninguna es la
  mejor». Las zonas se ordenan según la cercanía a lo que habéis guardado, y eso se
  dice en una línea: «Ordenadas por cercanía a vuestros sitios guardados», con
  `EvidenceMark ◇`.
- **Cada zona lleva fotografía** (hoy no hay ninguna). Ver `06 §7`.
- Los tres registros se separan visualmente, que es el punto entero de esta pantalla:
  - **Hechos** (`◼`): shinkansen, aeropuertos, líneas. Chips neutros.
  - **Calculado** (`◇`): distancia a vuestros sitios. Fondo `--surface-sunken`.
  - **Nihon dice** (`✎`): la línea editorial, en `--font-voice` `--type-quote`.
- Comparar: máximo 4, se conserva. En teléfono la comparación es una tabla de filas
  apiladas por criterio, nunca scroll horizontal.
- Acción por zona: «Dormir aquí» (hoy «Usar esta zona en el plan»).

**Criterios de aceptación**
- [ ] Ninguna zona lleva número de orden.
- [ ] Hecho, cálculo y opinión son distinguibles sin leer el texto.
- [ ] Ninguna zona se etiqueta como la mejor.
- [ ] Los 16 conjuntos de zonas de Tokio, Kioto y Osaka siguen presentes.

### Apertura de ficha de lugar desde Viaje

Corrección final de B18 (DD-015): tocar un lugar guardado desde «Dónde dormir»
(la lista de zonas o el mapa de comparación) abre la **misma** `PlaceDetail` que
usan Explorar y Quiero ir — no navega a Explorar. Vale igual para cualquier otra
sub-pestaña de Viaje que en el futuro abra lugares (p. ej. `Días`, `§7`).

- **Apilado dentro de Viaje.** La ficha se apila dentro de la pestaña Viaje,
  igual que «Quiero ir └── Lugar» (`02 §"Mapa completo de pantallas"`, `02 §D3`).
- **Retorno a la superficie exacta de origen.** Cerrar la ficha (chevron, `×` o
  back del navegador) devuelve a «Dónde dormir» con su scroll, su zona
  seleccionada y su modo (`browse`/`compare`) intactos — `ZoneComparison` nunca
  se desmonta mientras se ve un lugar por encima.
- **El chevron nombra la superficie real**, nunca «Viaje» a secas: «‹ Dónde
  dormir», no un cierre genérico.
- **Encadenado.** Si desde esa ficha se abre un lugar cercano, y desde ahí otro,
  volver los recorre uno a uno antes de volver a «Dónde dormir» — mismo
  mecanismo de pila que ya usan Explorar/Quiero ir.
- **Instancia única.** Como en cualquier otra pestaña, la ficha de un lugar sólo
  puede estar abierta en un destino a la vez.
- **«Ver en el mapa» es la única salida explícita.** Un botón etiquetado (nunca
  icon-only) dentro de la ficha cierra el stack de Viaje, cambia a Explorar y
  centra ese lugar en el mapa — **nunca abre su ficha en Explorar**: la ficha
  se cierra del todo, no se traslada de pestaña. Es la única acción, desde una
  ficha abierta en Viaje, autorizada a cambiar de pestaña — cualquier otro
  cierre vuelve a Viaje, nunca a Explorar.
- **Deroga el comportamiento heredado** de B18 (abrir siempre en Explorar por
  defecto, documentado como nota abierta en `docs/BLOCK_18_HANDOFF.md`).

**Responsive**
- `base` (teléfono): la ficha cubre el 100 % de la altura visible — cabecera,
  `TabBar` y cualquier navegación superior quedan cubiertas, sin excepción para
  Viaje (`05 §5`).
- `md`+: panel derecho de 480 px (`02 §D5`); `NavRail` permanece visible, y el
  destino marcado `aria-current="page"` sigue siendo Viaje mientras la ficha le
  pertenezca.

---

## 9. Viaje — Reservas

Recoge lo que hoy vive disperso dentro del planner: mecanismos de reserva, fechas
oficiales derivadas del viaje, calendario de la ventana febrero–marzo 2027 y la
sección «Reservas por preparar».

- Lista ordenada por **urgencia real** (fecha límite derivada), no por orden de ruta.
- Cada fila: lugar, qué hay que reservar, ventana de antelación con `EvidenceMark`, y
  enlace oficial.
- Los textos literales del dataset se muestran entre comillas con marcador `◧`, **nunca
  con el prefijo `Dato:`**.
- Una sola nota al pie por sección, no un descargo por bloque.

**Criterios de aceptación**
- [ ] La cadena `Dato:` no aparece en ninguna parte de la interfaz.
- [ ] Toda la lógica de `reservation-*` y del calendario oficial sigue disponible.

---

## 10. Viaje — Resumen

La composición del viaje completo (`whole-trip-composition`): visitas, traslados
registrados, alojamiento, rango del viaje. Presentado como **cuatro tarjetas de
resumen**, cada una con su marcador de evidencia, y un enlace a la sección detallada.

Se añade una lectura que hoy no existe y es barata: **el viaje en una línea de tiempo
horizontal comprimida**, una banda por día con el color de la ciudad, para ver de un
vistazo el reparto entre ciudades.

---

## 11. Nosotros

**Propósito.** Identidad, sistema y honestidad del producto en un solo sitio. Y el
hueco donde aterriza la sincronización futura sin reformar la navegación.

**Contenido**

1. **Viajeros** — dos tarjetas con `PersonToken md`, nombre editable, «marcados: 24
   lugares», y qué persona tiene este teléfono. Se conservan renombrar, reiniciar,
   quitar y añadir de `TravellerManager`.
2. **Copia del viaje** — exportar e importar JSON (Bloque 13). Se conserva íntegro,
   incluida la semántica de **reemplazo, no fusión**, que pasa a mostrarse como
   confirmación explícita antes de importar: «Esto sustituirá todo lo que hay en este
   navegador.»
3. **Cómo funciona Nihon** — reabre el explicador.
4. **Fuentes y licencias** — dataset y versión, licencia MLIT íntegra, licencias
   fotográficas, enlaces. **Casa definitiva del aviso que hoy ocupa la portada.**
5. **Acerca de** — versión de la aplicación.

**Criterios de aceptación**
- [ ] El conmutador «Eres» ya no aparece en ninguna cabecera.
- [ ] Sigue siendo posible cambiar de persona activa en un dispositivo compartido.
- [ ] El texto de atribución MLIT sigue presente y completo.
- [ ] Exportar e importar siguen funcionando exactamente igual en Safari de iOS.

---

## 12. Matriz de conservación

Ninguna capacidad se pierde (Art. 12). Verificable en revisión:

| v1.1.0 | v1.2 diseño | Pantalla |
|---|---|---|
| 214 lugares, 7 hubs | conservado | 2, 4 |
| Mapa nacional MLIT | conservado | 3 |
| Búsqueda libre | conservado | 2, 4 |
| Filtros (categoría, grado, joya, turismo, reserva, duración) | conservados | 4 |
| Nivel de interés en lenguaje llano | conservado, menos visible en tarjeta | 4, 5 |
| Galería y créditos | conservados, créditos reubicados | 5 |
| Fallback `imageBrief` | conservado, rediseñado | `04 §9` |
| «Quiero ir» por persona | conservado | 6 |
| Coincidencias y divergencias | **promovido** a vista principal | 6 |
| «No me interesa» | conservado, más visible | 5 |
| Planner manual, días, identidad estable | conservado, reencuadrado | 7 |
| Comparación de órdenes | conservado, local al día | 7 |
| Alternativas verificadas | conservadas, como opción | 7 |
| Traslados entre ciudades | conservados | 7 |
| Zonas de alojamiento y comparación | conservadas, sin ranking | 8 |
| Reservas y calendario oficial | conservados, agrupados | 9 |
| Composición del viaje | conservada | 10 |
| Provenance y freshness | conservados como gramática visual | todas |
| Respaldo JSON | conservado | 11 |
| Persistencia local | conservada | — |
| Onboarding | conservado, ampliado | 1 |
