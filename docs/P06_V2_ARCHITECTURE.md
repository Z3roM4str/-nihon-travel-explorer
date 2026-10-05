# P-06 v2 — Viaje › Días: lista (N1) · hojas (N2) · vistas enfocadas (N3)

Sustituye, como modelo de interacción, a la «revelación progresiva» de [P06_DAYS_PROGRESSIVE_DISCLOSURE.md](P06_DAYS_PROGRESSIVE_DISCLOSURE.md)
(P-06 v1, en `main`). La v1 redujo la altura de Días (5159 → ≈1850 px) a base de `<details>` y paneles
inline; la revisión posterior confirmó que **más colapsables no resuelven el problema**: cada acción
secundaria sigue desplegando contenido dentro de la tarjeta y la página vuelve a crecer hasta parecer un formulario.

Base: `main` @ `de4b190b033a4d8c169d75a609e3d7d50527e674`. Rama: `claude/p06-v2-list-sheets`.
Alcance: sólo presentación. No cambia el modelo planning-draft (V8), la persistencia, los algoritmos, la
semántica de fechas, el dataset ni otras pestañas.

## 0. Estado (P-06 v2 completo en Chromium; WebKit pendiente de ejecución)

| Fase | Estado |
|---|---|
| **P-06·A — Lista principal (N1)** | **COMPLETADO** |
| **P-06·B — Hojas (N2)** | **COMPLETADO** |
| **P-06·C — Vistas enfocadas (N3) + History API + orden fino en touch** | **COMPLETADO** (Chromium) |
| **P-06·D — Limpieza** | **COMPLETADO**; la certificación final queda **abierta por WebKit** (bloqueo de entorno) y por dispositivo/lector de pantalla reales |

Evidencia, mediciones y límites: [P06_V2_CERTIFICATION.md](P06_V2_CERTIFICATION.md). Comandos reproducibles para WebKit: `app/scripts/p06-v2-certify.sh webkit`.

## 1. Arquitectura

| Nivel | Qué es | Para qué |
|---|---|---|
| **N1 — Lista** | La pestaña Días | Contestar «¿qué vamos a hacer cada día?» |
| **N2 — Hoja (Sheet)** | Diálogo corto, modal, anclado abajo (móvil) o centrado (escritorio) | Una acción corta sobre algo que se ve en N1 |
| **N3 — Vista enfocada (FocusedView)** | Pantalla completa propia, con History API | Una tarea compleja o de lectura larga |

### Invariante

> En la lista principal de Días **ninguna acción secundaria puede expandir contenido inline** de forma que
> aumente sustancialmente la altura de la tarjeta o de la página.
> Acciones cortas → Sheet. Tareas complejas → FocusedView.

Corolarios: N1 no contiene `<details>`, ni formularios, ni paneles que se abran dentro de una tarjeta; un
botón secundario de N1 abre una Sheet o una FocusedView, nunca crece en su sitio.

## 2. Decisiones cerradas

1. **N1 prioriza**: día/fecha, paradas, orden, contexto mínimo y «+ Añadir lugar». No es formulario, dashboard de datos, panel de logística ni acordeón.
2. **Eliminados como modelo principal**: «Detalles del día» inline, «Herramientas y datos del viaje» inline, «Probar otro orden» inline.
3. **«+ Añadir lugar»**: acción visible y clara en cada día.
4. **Sin asignar**: con lugares → sección normal y visible (no `<details>`); vacío → no ocupa espacio prominente.
5. **Orden**: el copy es **«Cambiar orden»** (no «Probar otro orden»). En touch no hay asas de arrastre en N1 (el orden fino se hace en N3); con puntero fino se conserva el arrastre.
6. **Mover entre días**: la parada se **añade al final** del día destino. No se pregunta «Posición N»; el orden fino se corrige después en Cambiar orden. Nada de lenguaje de modelo de datos («Posición 1…»).
7. **Alojamiento** (una línea en la tarjeta, tres estados):
   - sólo zona → «Zona para dormir: Shinjuku»;
   - alojamiento concreto → «Dormís en {alojamiento}»;
   - nada → «Elegir zona para dormir».
   Nunca «Dormís en la zona X» si sólo existe zona. La configuración real pertenece a Dónde dormir.
8. **Texto pedagógico** («Vosotros decidís el orden…») sale de la lista; vive en la vista Cambiar orden.
9. **History**: N3 usa History API (el botón/gesto «atrás» cierra la vista y vuelve a la lista con el mismo contexto).

## 3. Reparto en fases

### P-06·A — Lista principal (esta misión)

Estructura de la tarjeta de día:

```
Día 1 · 22 feb                                [⋯ acciones del día]
Tokio · 3 lugares · 5–6 h
  1 [foto] Nombre                                 [⋯]
           zona · duración
     └ traslado conocido (una línea)
  2 …
[aviso de cierre semanal — una línea, sólo si aplica]
🛏 {línea de alojamiento}
[+ Añadir lugar]  Cambiar orden  Detalles del día
```

- Fuera de N1: frase de ayuda «Organiza tus lugares por día…», frase normativa, `days-tools`, `unassigned-drawer`, `day-card__details`, el panel «⋯» inline de la parada, el panel inline de orden.
- Fechas del viaje: una línea compacta (rango + «Editar fechas»); los campos viven en una Sheet (B).
- Touch: `.trip-stop__handle` sólo con `(hover: hover) and (pointer: fine)`.
- Capacidades que pertenecen a B o C **no se eliminan**: quedan como entradas compactas que abren una superficie flotante, nunca un bloque inline. Las tareas de N3 (*Cambiar orden*, *Detalles del día*, *Herramientas del viaje*) se abren en `FocusedView` (ver P-06·C).

### P-06·B — Hojas (esta misión)

Contrato de Sheet: contexto visible (qué día/parada), título claro, **una** tarea concreta, contenido corto, cerrar con botón/Escape/fondo, foco entra al abrir y vuelve al disparador (o a la parada movida), teclado completo (Tab atrapado), touch ≥ 44 px, sin navegación accidental, sin duplicar formularios grandes.

| Sheet | Disparador | Contenido |
|---|---|---|
| Fechas del viaje | «Editar fechas» | inicio y fin (los dos `input type=date` + «Quitar fecha») |
| Acciones de la parada | ⋯ de la parada | «Mover al Día N» (al final) por cada otro día · «Mover a Sin asignar» |
| Añadir lugar | «+ Añadir lugar» del día | lugares de Sin asignar, cada uno se añade al final del día |
| Acciones del día | ⋯ del día | «Mover antes/después» (pasa a ser el Día N) · «Eliminar día» (sólo si está vacío y hay más de uno) |
| Añadir a un día | acción de un elemento de Sin asignar | un botón por día (al final) |

No entran en Sheet: editor completo de orden, logística avanzada del día, traslados entre ciudades (→ P-06·C).

### P-06·C — Vistas enfocadas, historial y orden fino (implementado)

- **Una sola superficie** (hoja o vista) abierta a la vez, y es el único estado de «qué está abierto»: `useSurfaceHistory` (`app/src/useSurfaceHistory.ts`) la enlaza con `history`.
  Abrir empuja **una** entrada (`state.nihonDias`, conservando `nihonPlaceDepth` de la ficha); «atrás» la cierra sin salir de Días; «adelante» la reabre si sigue siendo válida
  (si el objetivo ya no existe o la línea base de «Cambiar orden» cambió, se salta); cerrar por la UI (×, Escape, fondo, «Volver a Días», terminar la acción) deshace la entrada con `history.back()`,
  así que abrir/cerrar N veces no hace crecer la pila; abrir justo después de cerrar se encola hasta que llega el `popstate` propio; recargar limpia la entrada y empieza en la lista.
  Aplica a las **cuatro N2/N3 por igual** (las Sheets también: «back predecible»).
- `FocusedView` es la definitiva (ya no hay «provisional»): foco entra al abrir, Tab atrapado, Escape/«Volver», y el foco vuelve al disparador (se captura antes de que un hijo lo tome).
- **Cambiar orden** (`DayOrderToolPanel`): la propuesta se reordena con **Subir / Bajar** (≥ 44 px, nombre accesible por lugar, el foco sigue al lugar movido). Desaparece «Posición N» de la interacción; en touch es la vía del orden fino.
  Las opciones «Comprobado con datos completos» conservan su texto («Mover X a la posición N» es la descripción de la alternativa generada, un dato de evidencia, no una interacción).
- **Sin alojamiento esa noche**: la elección explícita `no-accommodation` del fin del día se conserva y se muestra como «Sin alojamiento esa noche» (decisión tomada, no pendiente; gana a la zona de la ciudad). Se fija en «Detalles del día» → «Fin del día» → «No aplica».

### P-06·D — Limpieza (implementada)

Retirado tras comprobar referencias: reglas CSS de v1 (`.days-hint`, `.days-tools`, `.day-card__details*`, `.unassigned-drawer*`, `.trip-stop__move-panel*`, `.day-card__actions`, `.day-card__footer`, `.day-card__sleep-link`, `.day-card__date`),
el select de posición de la propuesta (y su CSS), el modo «provisional» de `FocusedView`, `touchDrag` de B28 y el capture de v1. No se tocó CSS ajeno a P-06 (p. ej. `local-swap__*`, ya retirado de la UI antes: deuda previa).

## 4. Gates que congelaban la UI anterior

Revisados en la auditoría; se actualizan **sólo en su entrada y en las aserciones que contradicen la invariante** (nunca para relajar cobertura funcional):

| Gate | Congelaba | Cambio |
|---|---|---|
| `b27-viaje-dias-check.mjs` | `<details>` de «Detalles del día», ⋯ inline con Día/Posición, `#sequence-start-date` inline | entrada vía Sheet/host; nueva invariante |
| `b28-reorder-dnd-check.mjs` | asas de arrastre también en touch | touch: sin asas; ratón: arrastre intacto; mover por Sheet |
| `b29-day-order-tools-check.mjs` | «Probar otro orden» inline | «Cambiar orden» abre el host; contenido del panel intacto |
| `b30`, `b31`, `phase5a`, `phase3f-*`, `block4/6`, `evidence-options`, `d5-*`, `d0b`, `b10-a11y` | entradas a «Detalles del día» / `#sequence-*-date` / drawer | sólo la entrada |
| Vitest `OrderedSequenceBuilder.trip-bounds.test.ts`, `d5-normative-vocabulary.test.ts`, `DayOrderToolPanel.test.ts` | cadenas fuente | cadenas nuevas |
| **Nuevo** `p06-v2-list-invariant-check.mjs` | — | invariante, Sheet, añadir al final, sin «Posición N», touch sin asas, Sin asignar visible, + Añadir lugar, alojamiento 3 estados |

## 5. Auditoría de la base (resumen)

- `OrderedSequenceBuilder.tsx` (3002 líneas) concentra N1; `TripStop`/`DayTimeline` pintan paradas; `DayOrderToolPanel` el orden; B27/B28/B29 son los gates de Días/arrastre/orden; B18 cubre navegación y «atrás».
- v1 dejó 3 `<details>` + 2 paneles inline por pantalla y 7+ controles simultáneos por tarjeta; el cajón «Sin asignar» era `<details>` cerrado.
- Medidas «antes» (viaje de 2 días, 390×844): altura desplazable 1726 px; ver el informe de la fase 6 para antes/después completos.

## 6. Pendiente tras P-06 v2

- **Certificación en WebKit** (bloqueada: sin binario en el entorno; `playwright install` prohibido). Ejecutar `app/scripts/p06-v2-certify.sh webkit` en un entorno con WebKit; B27–B29, Phase 3F, Block 4/6 y Phase 5A son Chromium-only desde antes.
- Dispositivo físico (Safari/iPhone, gesto «atrás» real) y lector de pantalla.
- Decisión de producto abierta: dónde se fija «sin alojamiento esa noche» (hoy sólo en «Detalles del día»; no hay atajo desde la línea de la tarjeta).
