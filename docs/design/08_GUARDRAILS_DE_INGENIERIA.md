# 08 — Guardrails de ingeniería

Para Claude Code, Codex, Jules, ChatGPT o cualquier otro agente que implemente este
diseño.

> **Antes de tocar nada, lee `docs/CURRENT_WORK_HANDOFF.md`.** Dice en qué bloque estamos,
> cuál es el último SHA estable empujado, qué está terminado, qué falta, cuál es la
> siguiente acción concreta y —sobre todo— qué NO puede cambiar un agente de
> implementación. Se actualiza en cada checkpoint, no sólo al cerrar un bloque.

---

## Regla principal

> **Las especificaciones de diseño de esta carpeta son normativas.**
> Los agentes de implementación no inventan decisiones de UX/UI. Si una decisión
> necesaria no está especificada, **se detienen** y devuelven
> `DESIGN DECISION REQUIRED`.

### Formato obligatorio de la parada

```
DESIGN DECISION REQUIRED

Bloque:     B3 — Tarjeta y lista
Superficie: Explorar › Ciudad › PlaceCard
Pregunta:   Un lugar sin `differentiator` ni `description` deja la tarjeta sin
            línea de razón. ¿Se colapsa la tarjeta o se muestra la categoría?
Consultado: 04 §5.6, 05 §4
Opciones:   (a) colapsar y subir los chips; (b) mostrar el `experience` recortado
Impacto:    3 lugares del catálogo
Bloqueante: no — se puede continuar con el resto del bloque
```

No se improvisa una respuesta «razonable». Una decisión inventada que parece correcta
es peor que una parada, porque se propaga.

---

## Lo que ingeniería decide libremente

Sin consultar, siempre que se cumplan los criterios de aceptación:

- Estructura de ficheros, módulos y carpetas; nombres de funciones y variables internas.
- Gestión de estado, hooks, memoización, `Suspense`, límites de carga diferida.
- Estrategia de tests, fixtures, selectores de test y organización de suites.
- Técnicas de rendimiento: virtualización de listas, `IntersectionObserver`,
  precarga, caché, tamaño de chunks.
- **Implementación** de accesibilidad (roles ARIA concretos, gestión de foco,
  anuncios), siempre que el comportamiento resultante sea el especificado.
- Corrección de bugs funcionales que no cambien ninguna decisión visual.
- Refactor interno sin efecto visible.
- Elección de librería para arrastrar y soltar, siempre que cumpla `04 §14`
  (alternativa por teclado obligatoria) y no traiga su propio sistema visual.

## Lo que requiere revisión de diseño

Parada obligatoria:

- Cualquier **pantalla nueva** o destino nuevo.
- Cualquier **control permanente nuevo** en cabecera, barra de pestañas o pie.
- Cualquier cambio en la **navegación** o en el modelo de vuelta atrás.
- Cualquier **valor nuevo** de color, tipografía, radio, sombra, espaciado, duración o
  easing.
- Cualquier cambio en **qué información es primaria** en una tarjeta o en una ficha.
- Cualquier **texto visible** nuevo que no sea pluralización trivial o formato de
  fecha/hora: estados vacíos, errores, confirmaciones, etiquetas.
- **Retirar** una capacidad de v1.1.0, o moverla a un sitio no especificado en
  `05 §12`.
- Cambiar el proveedor de teselas o el estilo del mapa.
- Cualquier automatización del itinerario, aunque sea opt-in.

## Prohibiciones absolutas

No se hacen ni preguntando. Requieren cambiar la Constitución primero.

1. **Reconstruir la aplicación desde cero** o sustituir su arquitectura funcional.
2. **Eliminar una capacidad** existente para simplificar la implementación.
3. Añadir una **dependencia con sistema visual propio** (MUI, Chakra, Bootstrap,
   Ant, DaisyUI, kits de componentes). Utilidades sin opinión visual: consultar.
4. Añadir **emoji** a la interfaz.
5. Escribir **`@media (max-width: …)`** nuevo.
6. **Hex literales**, `px` de tipografía o espaciados fuera de los tokens.
7. Que Nihon **ordene, reparta, equilibre u optimice** el itinerario.
8. Mostrar **UI de funciones que no existen**.
9. Mostrar **créditos fotográficos dentro del flujo de lectura**.
10. Usar una **fotografía de otro lugar** o generada por IA.
11. Mostrar la **letra de grado** fuera de «Fuentes».
12. **Subir datos a ningún servidor.** Nihon sigue siendo local mientras no exista
    v1.2.0.

---

## Invariantes verificables del shell de navegación (DD-015)

Añadidas por la corrección final de B18 que resuelve la apertura de ficha desde
Viaje (`02 §D3`, `05 §7`/`§8`, DD-015). Se aplican a los cuatro destinos por igual,
no sólo a Viaje, y cada una es una prueba automatizable, no sólo una intención:

1. **Ninguna apertura implícita de ficha cambia de destino.** Tocar un lugar nunca
   muta `destination` salvo cuando el propio origen ya es Explorar (que comparte
   pantalla con la ficha). Verificable: el destino activo antes y después de abrir
   una ficha desde Quiero ir o Viaje es idéntico.
2. **Como mucho una ficha activa en un stack a la vez.** Nunca coexisten dos
   `.app__detail` montados con contenido a la vez, sea cual sea la secuencia de
   pestañas tocadas. Verificable: contar nodos `.app__detail` en el DOM tras
   cualquier combinación de aperturas/cierres/cambios de pestaña.
3. **Cambiar de destino conserva el stack completo**, ficha abierta incluida. Volver
   manualmente a la pestaña que tenía una ficha abierta la encuentra exactamente
   donde se dejó — mismo lugar, mismo scroll, misma profundidad de pila.
Verificable: abrir una ficha, cambiar de pestaña, volver, comparar contra el
   estado justo antes de cambiar.
4. **Toda acción explícita de cambio de destino debe cerrar/hacer pop de la ficha de
   origen.** Ninguna acción etiquetada («Ver en el mapa» y cualquier futura
   equivalente) puede dejar una ficha fantasma abierta en la pestaña que abandona.
   Verificable: tras «Ver en el mapa», ningún `.app__detail` sigue montado dentro
   del panel de la pestaña de origen.

## Invariantes verificables de la rejilla de descubrimiento (DD-016)

Añadidas por la corrección de B19 que resuelve el número de columnas de Explorar
(`02 §D5`, `03 §5`, `04 §5`, `05 §4`, DD-016). Sustituyen a la regla que B18/B19 habían
dejado en pie («2 columnas desde `sm`, 1 desde `md`», consecuencia del panel de 372 px
fijos) y se aplican a cualquier rejilla de tarjetas, no sólo a la de Explorar. Cada una
es una prueba automatizable — `app/scripts/block19-grid-check.mjs` las ejecuta todas:

1. **Ninguna rejilla decide sus columnas sólo con `@media`.** El número de columnas se
   calcula sobre el **ancho efectivo del contenedor** (`@container` o equivalente que
   mida el contenedor, nunca la pantalla), acotado por el tope del breakpoint. Es
   obligatorio, no preferible: en `md`, abrir la ficha estrecha la región de lista sin
   que el viewport cambie, y la rejilla tiene que reaccionar. Verificable: a 840 px, la
   lista da 2 columnas con la ficha cerrada y 1 con la ficha abierta.
2. **Topes por breakpoint, nunca suelos**: `base` 1 · `sm` 2 · `md` 2 · `lg` 2 · `xl` 3.
   Verificable: los seis casos de referencia (360 / 600 / 840 / 840 con ficha / 1200 /
   1600) dan exactamente 1 / 2 / 2 / 1 / 2 / 3 columnas.
3. **`PlaceCard` nunca baja de 264 px de ancho**, a ningún ancho de pantalla y con
   cualquier combinación de raíl abierto o cerrado. Verificable: medir la tarjeta más
   estrecha del DOM en los seis casos.
4. **La proporción sigue al número de columnas, no al breakpoint**: 4:3 con una columna,
   16:9 con dos o más. Verificable: medir `width/height` de `.place-card__media` en los
   seis casos.
5. **El raíl derecho nunca pasa del 50 % del ancho del cuerpo.** Verificable: comparar la
   caja del raíl (ficha o mapa, el que esté visible) con la del cuerpo.
6. **La ficha no mueve el mapa en `lg`/`xl`** (DD-017). Mapa y ficha son una sola región:
   la ficha **puede** cubrir el mapa del todo, y no se fabrica una franja residual de mapa
   para evitarlo. Lo que se conserva es el **estado**, no la visibilidad — abrir y cerrar la
   ficha deja el mapa con el mismo tamaño de caja, el mismo centro, el mismo zoom y la misma
   selección. Verificable: leer las cuatro cosas antes de abrir, con la ficha abierta y
   después de cerrar, y comprobar que no cambian.
6.b **`panelOffset` sólo actúa donde mapa y panel se ven a la vez** (DD-017). Es el hueco
   que el panel tapa por la derecha; cuando el panel cubre el mapa entero, no desplaza nada.
   Verificable: con la ficha abierta en `lg`/`xl`, el centro del mapa es idéntico al que
   tenía antes de abrirla.
7. **Ningún `text-shadow`, en ninguna parte** (`03 §5`). Verificable: recorrer el DOM de
   la superficie tocada y comprobar que ningún elemento tiene `text-shadow` calculado
   distinto de `none`.
8. **Scrim efectivo ≥0.60 bajo toda la banda de texto sobre fotografía**, con contraste
   AA usando la fotografía más clara del catálogo y para cada color de texto de la banda.
   Verificable sobre píxeles realmente compuestos, no sobre aritmética de degradados:
   `app/scripts/block19-contrast-check.mjs`.
9. **Ningún ancho de viewport «de cabida» escrito como breakpoint.** Los anchos en los
   que una rejilla cambia de columnas son consecuencia de la fórmula (mínimo de tarjeta,
   `gap`, `padding`, cromo); si aparecen escritos en el CSS o en la documentación, la
   fórmula ha dejado de ser la fuente y hay que quitarlos.
10. **Toda `PlaceCard` abre desde toda superficie no interactiva** (DDR-02), con y sin
   fotografía. El target principal pertenece al nivel del `<article>`, coincide con sus
   límites y no nace dentro de `.place-card__media`; ésta conserva `overflow: hidden`.
   Corazón y token de persona quedan por encima, no abren la ficha y mantienen su
   comportamiento independiente. Verificable por puntero y teclado, incluidos fotografía,
   nombre, razón y chips, y comprobando que el target no sobresale de la tarjeta.

## Líneas de producto: cuál es autoritativa (guardrail Astra)

El repositorio contiene **dos líneas de rediseño** que no son intercambiables. Confundirlas ya
costó un trabajo completo que no se pudo integrar, así que queda escrito:

| Línea | Ramas | Documentos | Estatus |
|---|---|---|---|
| **Nihon** | `claude/*` | `docs/design/` | **Autoritativa.** Es esta carpeta, y es la que manda. |
| **Astra** | `astra/*` | `docs/astra/` | Experimento paralelo. **No es fuente de verdad** para esta línea. |

Reglas, para cualquier agente:

1. **Ninguna rama `astra/*` sirve de base.** No se parte de ella, no se rebasea contra ella y no
   se cherry-pickea código desde ella hacia `claude/*`.
2. **Ninguna discrepancia se resuelve a favor de Astra** sin instrucción explícita. Si `docs/astra/`
   y `docs/design/` dicen cosas distintas, gana `docs/design/` — sin excepciones y sin preguntar.
3. **El trabajo de Astra no se borra, ni se archiva, ni se modifica.** Es un experimento legítimo
   con su propia historia y su propia autoría. Lo único que se evita es que vuelva a confundirse
   con esta línea.
4. **Señal práctica para reconocerla**: una rama de la línea Astra **no contiene `docs/design/`**
   (bifurca de `1a11fe8`, anterior al congelado del sistema) y su código vive en `app/src/astra/`
   con un modelo de datos propio (`nihon.memberInterests.v1`, miembros fijos). Si estás mirando un
   árbol sin `docs/design/`, no estás en esta línea.

## Invariantes verificables de la persistencia (DDR-03)

1. **Una sola fuente de verdad.** El estado de persistencia es uno para todo el producto. No hay
   estado por destino, y el aviso se renderiza una única vez en la raíz. Verificable: contar nodos
   del aviso en el DOM tras cualquier combinación de destinos y de ficha abierta ⇒ siempre 0 o 1.
2. **Silencio cuando todo va bien.** Con la persistencia sana, no existe aviso alguno.
3. **Ninguna afirmación falsa.** Mientras el estado es de error, ninguna superficie afirma que los
   cambios quedaron guardados.
4. **Visible donde se escribe.** El aviso es perceptible desde cualquier destino donde pueda
   producirse una escritura, y **sigue visible con la ficha abierta**, incluido su modo a pantalla
   completa (`05 §5`), sin duplicarse. Queda por debajo de `Sheet` y de cualquier superficie modal
   enfocada, y reaparece al cerrarlas.
4.b **Avisa con el primer fallo real**, incluido el de la escritura de arranque: no espera a que
   la persona toque nada. Verificable: con el almacenamiento roto, el aviso está presente antes de
   cualquier interacción; con el almacenamiento sano no aparece nunca.
5. **El reintento escribe de verdad.** «Reintentar» reintenta la carga que falló a través de la
   infraestructura vigente. Éxito ⇒ estado normal. Fallo ⇒ el error permanece. Nunca descarta ni
   reinicia datos de la persona. Verificable: forzar el fallo, reintentar con el fallo activo
   (sigue el aviso), levantar el fallo, reintentar (desaparece) y comprobar que el dato escrito es
   el que se había intentado guardar.
6. **No modal, sin robo de foco, anunciado.** Verificable: al entrar en error el foco no se mueve,
   el aviso tiene `role="alert"`, y «Reintentar» mide ≥44×44 y es alcanzable por teclado.

## Puertas de calidad por bloque

Todo bloque de implementación se cierra sólo si pasa las siete:

| # | Puerta | Cómo se comprueba |
|---|---|---|
| G1 | Tests verdes | La suite completa (hoy 94 ficheros / 3.272 tests). Un test que cambia debe justificarse por una decisión de esta carpeta, citando documento y sección. |
| G2 | Sin regresión de capacidades | Checklist de `05 §12` para las superficies tocadas. |
| G3 | Cromo en teléfono | Medición automática a 390×844: cromo superior ≤112 px, total ≤168 px. |
| G4 | Sin tokens fuera de sistema | Lint de CSS: cero hex literales, cero `max-width` media queries nuevas, cero emoji en fuentes de componentes, cero `text-shadow` (`03 §5`). |
| G5 | Accesibilidad | Áreas ≥44 px, contraste 4.5:1 / 3:1, foco visible, recorrido de teclado completo en la superficie tocada. |
| G6 | Rendimiento | Presupuesto de imágenes por ciudad ≤3,5 MB; sin regresión del chunk de entrada frente a la medición de v1.1.0. |
| G7 | Revisión visual | Capturas a 390×844 y 1440×900 de cada superficie tocada, comparadas contra la especificación. |

## Cómo tratar el CSS actual

`App.css` tiene 5.869 líneas y valores ad hoc. **No se reescribe de golpe.**

1. `tokens.css` se crea en el bloque B1 y se importa antes que `App.css`.
2. Cada bloque posterior migra **sólo** las reglas de las superficies que toca, de
   valores literales a tokens.
3. Las reglas `max-width` existentes se convierten a `min-width` **al migrar su
   superficie**, no antes.
4. Cuando una superficie queda totalmente migrada, su CSS se extrae a un fichero
   propio junto al componente. `App.css` encoge bloque a bloque hasta desaparecer.
5. Está prohibido dejar la misma propiedad definida en los dos sitios.

## Qué hacer con los comentarios del código

El código actual tiene comentarios largos que documentan decisiones de bloques
anteriores (Bloques 1–16). **Son un activo y se conservan.** Cuando una decisión de
esta carpeta invalide un comentario, se actualiza el comentario citando el documento
nuevo — no se borra dejando el código sin explicación.

## Orden de precedencia

Si dos fuentes se contradicen:

1. `00_CONSTITUCION_DE_DISENO.md`
2. El documento específico (`03`–`07`)
3. `09_DECISIONES_DE_DISENO.md` — una decisión posterior gana sobre una anterior
4. El código existente
5. Cualquier otra cosa

Un comentario del código nunca gana sobre esta carpeta.
