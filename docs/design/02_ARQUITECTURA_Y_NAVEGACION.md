# 02 — Arquitectura de información y navegación

## D1. El problema que resuelve

Hoy Nihon es **una pantalla y seis modales**. El explorador es el suelo; el planner, la
comparación de zonas, el análisis de selección, el respaldo, el gestor de viajeros y el
onboarding son overlays que se apilan encima. Consecuencias:

- Capacidades caras quedan invisibles (el usuario no sabe que existe el planner hasta
  que guarda lugares y abre un panel inferior).
- No hay «volver» coherente: cada overlay inventa su cierre.
- No hay sitio natural para la identidad de los viajeros, así que vive en la cabecera
  y la desborda.
- No hay sitio natural para la futura invitación/sincronización.

## D2. La estructura nueva: cuatro destinos

Nihon pasa a tener **cuatro destinos permanentes**, con barra de pestañas inferior en
teléfono y raíl lateral en pantallas grandes.

```
┌───────────────────────────────────────────────┐
│                                               │
│                  contenido                    │
│                                               │
├───────────────────────────────────────────────┤
│  Explorar   Quiero ir③   Viaje   Nosotros     │
└───────────────────────────────────────────────┘
```

| Destino | Contiene hoy | Pregunta que responde |
|---|---|---|
| **Explorar** | Vista nacional, hubs, lista, mapa, búsqueda, filtros, ficha de lugar | ¿Qué hay en Japón y qué merece la pena? |
| **Quiero ir** | Panel de selección + análisis de coincidencias/divergencias (Bloques 5 y 6) | ¿Qué queremos ver, y en qué coincidimos? |
| **Viaje** | Planner, días, traslados entre ciudades, zonas de alojamiento, reservas, resumen | ¿Cómo se convierte eso en un viaje? |
| **Nosotros** | Viajeros, nombres, respaldo JSON, ayuda, fuentes y licencias | ¿Quiénes somos y cómo funciona esto? |

**Por qué cuatro y por qué estos.** Coinciden uno a uno con los verbos del north star
(descubrir → acordar → planear) más un contenedor de identidad y sistema. Cada módulo
de código existente cae exactamente en uno, sin partirlo. Y «Nosotros» es el hueco
donde la sincronización de v1.2.0 aterriza sin reformar la navegación (ver `07`).

### Mapa completo de pantallas

```
Explorar
├── Inicio                     · ciudades como tarjetas fotográficas + colecciones editoriales
│   ├── Mapa de Japón          · pantalla completa, geometría MLIT (se conserva íntegra)
│   └── Ciudad                 · lista de lugares + buscador + filtros
│       ├── Mapa de la ciudad  · misma lista, otra lente
│       ├── Filtros            · bottom sheet
│       └── Lugar              · ficha a pantalla completa
│           ├── Galería        · lightbox
│           ├── Créditos       · sheet
│           └── Fuentes        · desplegable en la propia ficha
│
Quiero ir
├── Acuerdo                    · «Los dos» / «Sólo A» / «Sólo B» (Bloques 5 y 6)
└── Lugar                      · misma ficha que en Explorar
│
Viaje
├── Días                       · línea temporal del viaje (planner reencuadrado)
│   ├── Día                    · lugares en orden + traslados + alojamiento
│   │   ├── Mover a…           · sheet
│   │   └── Probar otro orden  · comparación A/B, ahora local al día
│   └── Sin asignar            · cajón inferior con lo guardado y no programado
├── Dónde dormir               · comparación de zonas (Bloque 3)
├── Reservas                   · mecanismos, fechas oficiales, calendario
├── Resumen                    · composición del viaje completo
└── Lugar                      · misma ficha que en Explorar/Quiero ir; apilada desde
│                                 «Dónde dormir» (DD-015). Volver devuelve a la
│                                 superficie exacta de origen; «Ver en el mapa» es la
│                                 única salida explícita hacia Explorar.
│
Nosotros
├── Viajeros                   · nombres, colores, qué ha marcado cada uno
├── Copia del viaje            · exportar / restaurar JSON (Bloque 13)
├── Cómo funciona Nihon        · onboarding reabrible
└── Fuentes y licencias        · MLIT, fotografía, versión del dataset
```

### Qué se conserva y adónde va

| Capacidad v1.1.0 | Dónde vive ahora |
|---|---|
| Mapa nacional con geometría MLIT | Explorar › Mapa de Japón (a pantalla completa) |
| Aviso de licencia MLIT | Nosotros › Fuentes y licencias, más `ⓘ` en el propio mapa |
| Selector de hub | Cabecera de Explorar › Ciudad (menú del título) |
| Lista / Mapa | Un control dentro de la barra de búsqueda, no una barra propia |
| Filtros y búsqueda | Bottom sheet desde la barra de búsqueda |
| Ficha de lugar | Pantalla completa, sin cromo por encima |
| «Quiero ir» (panel inferior) | Destino propio |
| Análisis de selección | Quiero ir › Acuerdo (es la vista principal, no un botón) |
| Constructor de recorrido | Viaje › Días |
| Comparación de órdenes A/B | Viaje › Día › Probar otro orden |
| Reparto por días | Viaje › Días (es la estructura, no una sub-vista) |
| Traslados entre ciudades | Viaje › Días, como fila entre días |
| Zonas de alojamiento | Viaje › Dónde dormir (+ acceso desde Explorar › Ciudad) |
| Reservas / calendario oficial | Viaje › Reservas |
| Composición del viaje | Viaje › Resumen |
| Respaldo JSON | Nosotros › Copia del viaje |
| Gestor de viajeros | Nosotros › Viajeros |
| Onboarding | Nosotros › Cómo funciona Nihon (y primera apertura) |
| Barra «Eres: Persona 1 / Persona 2» | **Se retira del cromo.** Ver D4 |

## D3. Reglas de navegación

1. **Las pestañas son destinos, no historial.** Cambiar de pestaña conserva el estado
   interno de cada una (ciudad activa, scroll, día abierto).
2. **La profundidad se apila dentro de una pestaña.** Ciudad → Lugar apila; volver
   devuelve exactamente al scroll anterior.
3. **Un modal sólo para lo que es verdaderamente modal**: lightbox, hojas de acción,
   confirmaciones destructivas, créditos. Nada que el usuario deba poder *recorrer*
   vive en un modal.
4. **Todo lo que cubre la pantalla en teléfono entra por abajo** (bottom sheet o push
   lateral), nunca por el centro con fondo oscurecido, salvo lightbox y confirmación.
5. **Una acción primaria por pantalla**, y está anclada abajo cuando es la
   continuación natural del flujo (p. ej. «Llevar al viaje» en Quiero ir).
6. **Insignias en pestañas**: sólo «Quiero ir» lleva contador. Ninguna otra pestaña
   lleva punto rojo. Un contador que siempre está encendido no informa (Art. 6).
7. **Cualquier enlace a un lugar apila la ficha dentro de la pestaña activa. No
   existen excepciones. Ninguna acción implícita cambia de pestaña; sólo lo hacen
   acciones explícitas y etiquetadas.** (DD-015, corrección final de B18.) Esto vale
   igual para Explorar, Quiero ir y Viaje: abrir un lugar desde «Dónde dormir» ya no
   navega a Explorar — apila la misma ficha dentro de Viaje, exactamente como ya
   hacía Quiero ir. La única salida hacia otra pestaña es una acción explícita y con
   etiqueta visible («Ver en el mapa» desde una ficha de Viaje), nunca un efecto
   secundario de tocar el lugar.

## D4. Decisión estructural: se retira el conmutador «Eres»

Hoy la cabecera contiene un control segmentado permanente «ERES [Persona 1][Persona 2]»
que **se sale de la pantalla en iPhone** (defecto D1) y que, conceptualmente, modela a
las personas como *slots de un dispositivo compartido*.

Cuando llegue la sincronización, cada teléfono tendrá un dueño y ese conmutador
desaparecerá o cambiará de significado. Diseñar ahora alrededor de él obligaría a
rehacer la cabecera después.

**Decisión:** la identidad se establece **una vez** (primera apertura o en Nosotros) y
se representa después con un **token de persona** de 24 px (inicial + color) en la
esquina de la cabecera. Tocarlo abre Nosotros › Viajeros, donde —mientras no haya
sincronización— se puede cambiar de persona activa. En un dispositivo compartido eso
sigue costando dos toques en vez de uno; a cambio se recupera toda la cabecera, se
arregla el defecto crítico y la UX no cambia el día que llegue el sync.

## D5. Estrategia responsive

### Breakpoints conceptuales (sólo `min-width`)

| Token | Desde | Dispositivo objetivo | Cambio estructural |
|---|---|---|---|
| `base` | 0 | Teléfono (diseño a 390) | Una columna. Pestañas abajo. |
| `sm` | 600 px | Teléfono apaisado, tablet pequeña | Tope de 2 columnas en listas. |
| `md` | 840 px | Tablet | Raíl lateral sustituye a las pestañas. Maestro/detalle: lista + ficha. Tope de 2 columnas. |
| `lg` | 1200 px | Portátil | Explorar añade panel de mapa persistente a la derecha. Viaje añade columna de «Sin asignar». Tope de 2 columnas. |
| `xl` | 1600 px | Escritorio grande | Contenido con ancho máximo 1440 px, centrado. El exceso es margen. Tope de 3 columnas. |

### El raíl derecho (DD-016)

Desde `md`, Explorar se parte en dos: la **región de lista** y el **raíl derecho**.

```
raíl = min(480 px, 50 % del cuerpo)        480 px = --place-detail-panel-width
región de lista = cuerpo − raíl
```

- **La lista es la superficie primaria**: se queda con todo el ancho que el raíl no usa.
  El raíl nunca crece a costa de la lista, y nunca pasa de la mitad del ancho.
- **Quién ocupa el raíl**: en `md`, sólo la ficha de lugar, y sólo mientras está abierta
  (el mapa sigue siendo una superficie conmutada, como en teléfono). En `lg`+, el mapa
  de forma permanente, con la ficha apoyada encima sobre la misma caja.
- **Abrir la ficha en `md` estrecha la lista** y la baja de 2 columnas a 1 sin que el
  viewport cambie. Es el caso que obliga a la regla de la rejilla de aquí abajo.
- **El mapa no se entera de la ficha** en `lg`/`xl`: su caja no cambia de tamaño al
  abrirla ni al cerrarla, así que conserva centro, zoom y marcador seleccionado.

### Reglas de escalado

- **El teléfono define la jerarquía.** Al crecer, Nihon **añade contexto lateral**; no
  reordena ni reprioriza. Lo que es primario en teléfono sigue siendo primario en
  escritorio.
- **El mapa nunca pasa de la mitad del ancho** en `lg`/`xl`. Hoy ocupa el 74 % y
  muestra sobre todo mar.
- **La ficha de lugar** es pantalla completa en `base`, y desde `md` es el raíl derecho:
  480 px, o la mitad del cuerpo cuando 480 px pasarían de ella. En `lg`+ conserva su
  galería a sangre dentro del panel.
- **Ninguna rejilla decide sus columnas sólo por el viewport** (DD-016). El número de
  columnas es el menor de dos cosas, en este orden:
  1. **la cabida real** del ancho efectivo de su propio contenedor — nunca del viewport —,
     con un ancho mínimo de tarjeta que la rejilla no puede violar (264 px en `PlaceCard`,
     `04 §5`);
  2. **el tope del breakpoint**: `base` 1 · `sm` 2 · `md` 2 · `lg` 2 · `xl` 3. Es un
     techo, nunca un suelo.

  El mecanismo es `@container` (o equivalente que mida el contenedor, no la pantalla).
  Los anchos de viewport en los que una rejilla cambia de número de columnas son una
  **consecuencia** de esa fórmula: no se escriben como breakpoints en ninguna parte.
- **La tarjeta de lugar** mantiene proporción 4:3 cuando la rejilla le da **una** columna
  y 16:9 cuando le da **dos o más**, con las mismas dos condiciones de arriba. No es una
  regla de viewport: en `md`, abrir la ficha la devuelve a 4:3 en el mismo momento en que
  la lista baja a una columna.
- **Máximo 72 caracteres** de longitud de línea en cualquier texto corrido; en `lg`+ el
  texto no se estira aunque haya sitio.
- **El raíl de `md`** es de iconos + etiqueta (88 px); en `xl` puede expandirse a 232 px.
  Los mismos cuatro destinos, mismo orden, mismos nombres.

### Prohibiciones responsive

- Ningún `@media (max-width: …)` nuevo. Los existentes se migran bloque a bloque.
- Ninguna pantalla exclusiva de escritorio. Si una capacidad no cabe en teléfono, se
  rediseña, no se esconde.
- Ninguna tabla de datos con scroll horizontal en teléfono. Se convierte en filas
  apiladas o en tarjetas.
