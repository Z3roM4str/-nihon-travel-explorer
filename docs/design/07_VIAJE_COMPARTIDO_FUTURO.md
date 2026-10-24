# 07 — Viaje compartido: preparación de la UX

Alcance: **no se diseña ni se implementa backend**. Este documento sólo fija las
decisiones de UX que hay que tomar **ahora** para que la evolución actual no haya que
rehacerla cuando llegue la sincronización (v1.2.0).

---

## 1. El escenario

Dos personas, dos teléfonos, un viaje.

- **Personal**: lo que cada una quiere ver.
- **Compartido**: el plan, los días, las fechas, el orden, el alojamiento, los
  traslados, las reservas.

Hoy todo eso vive en un solo navegador y se mueve entre dispositivos con un JSON que
**reemplaza, no fusiona**.

## 2. Las cinco decisiones que hay que tomar ahora

### DS-1 — La persona es un individuo, no un asiento

**Decisión tomada** (ver `02 §D4`): se retira el conmutador permanente
«Eres [Persona 1][Persona 2]» del cromo. La identidad se establece una vez y se
representa con un `PersonToken` en la cabecera.

**Por qué ahora.** Ese control modela a las personas como *slots de un dispositivo
compartido*. En cuanto cada teléfono tenga dueño, el control deja de tener sentido y
habría que rehacer la cabecera, la ficha y las tarjetas. Además hoy está roto: se sale
de la pantalla en iPhone.

**Forma futura.** El `PersonToken` de la cabecera pasa a ser «yo» y deja de poder
cambiarse; el modo dispositivo compartido queda como opción en Nosotros.

### DS-2 — Toda superficie declara si es personal o compartida

**Regla permanente** (Art. 9). El vocabulario visual queda fijado así:

| Naturaleza | Señal visual | Ejemplos |
|---|---|---|
| **Personal** | `PersonToken` con color e inicial | corazón, «no me interesa», secciones «Sólo Ana» |
| **Compartido** | sin color de persona; tinta neutra o bermellón cuando es de los dos | días, fechas, orden, alojamiento, traslados, reservas |

Ningún componente puede mezclar ambas naturalezas sin que se distingan. Esto vale hoy
(con dos perfiles en un navegador) y vale igual con sincronización real.

### DS-3 — Huecos reservados, no interfaz muerta

Estas piezas **no se implementan ni se renderizan** ahora (Art.: nada de UI muerta),
pero su sitio queda reservado en la especificación para que aparecer no altere ningún
diseño:

| Pieza futura | Dónde aterriza | Espacio reservado |
|---|---|---|
| Invitar a la otra persona | Nosotros › Viajeros | Fila bajo las dos tarjetas de persona |
| Estado de conexión / última sincronización | Nosotros › Viajeros | Línea al pie de la sección |
| «Lo ha cambiado Ana · hace 2 h» | Viaje › Días, pie de cada día | Línea `--type-caption` bajo la cabecera de día |
| Presencia («Ana está viendo el Día 3») | Viaje › Días | Slot a la derecha de la cabecera de día |
| Novedades desde tu última visita | Quiero ir, cabecera | Banda plegable sobre el resumen |
| Atribución por elemento («añadido por Luis») | `TripStop` | `PersonToken xs` a la derecha del nombre |

Todos ellos caben dentro de los componentes ya especificados en `04`. Ninguno exige
una pantalla nueva ni un destino nuevo. **Ese es el objetivo de la estructura de cuatro
pestañas.**

### DS-4 — Modelo de conflicto: sin diálogos de fusión

Principios de UX de conflicto, decididos ahora para que ingeniería no invente después:

1. **Preferencias personales**: no hay conflicto posible. Cada persona escribe sólo las
   suyas. Se unen, nunca se sobrescriben.
2. **Campos escalares compartidos** (fecha de inicio, zona de alojamiento de un día,
   orden de un día): **gana la última escritura**, y el cambio deja una marca visible
   «Cambiado por Ana · hace 5 min». Se puede deshacer desde esa marca.
3. **Conjuntos compartidos** (lugares de un día, días del viaje): **unión**. Quitar es
   una acción explícita, y también deja marca.
4. **Nunca un diálogo de resolución de conflictos.** Un producto para dos personas que
   planean unas vacaciones no puede pedirle a nadie que arbitre un merge.
5. **Nunca se pierde trabajo en silencio.** Toda sobrescritura deja rastro reversible
   durante al menos la sesión.

### DS-5 — El respaldo JSON sobrevive, cambiando de papel

Hoy es el único puente entre dispositivos. Después será el **seguro**, no el puente.

- Se mueve a Nosotros › Copia del viaje (ya especificado).
- Su semántica de **reemplazo, no fusión** se conserva, y pasa a confirmarse
  explícitamente antes de importar: «Esto sustituirá todo lo que hay en este
  navegador», con el resumen de lo que se va a perder.
- Cuando exista sincronización, la importación advertirá además de que reemplaza el
  estado local, no el compartido.

---

## 3. Lo que este rediseño NO debe hacer

- **No** inventar un identificador de viaje visible al usuario antes de que exista
  sincronización.
- **No** añadir «compartir» ni «invitar» a ninguna pantalla todavía.
- **No** diseñar avatares, fotos de perfil ni cuentas. La identidad es inicial + color
  + nombre, y con eso basta para dos personas.
- **No** introducir una tercera persona en la interfaz. El modelo de datos lo permite
  (`addTraveller` existe) y se conserva, pero la interfaz está diseñada para dos y las
  reglas de color y de «los dos» lo asumen. Si algún día hacen falta tres,
  `DESIGN DECISION REQUIRED`.
- **No** mover estado personal al plan compartido «por comodidad». El corazón nunca se
  convierte en una parada del viaje por sí solo; eso ya es una regla del producto
  (Bloque 5) y se mantiene.

## 4. Criterios de aceptación

- [ ] Ninguna cabecera contiene un conmutador de persona.
- [ ] Toda pantalla especificada en `05` declara si su contenido es personal o
      compartido.
- [ ] Ninguna pieza de la tabla DS-3 está implementada, y todas caben en los
      componentes existentes sin cambiar su anatomía.
- [ ] El respaldo JSON conserva exactamente su comportamiento verificado en iPhone.
