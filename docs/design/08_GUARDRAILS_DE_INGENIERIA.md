# 08 — Guardrails de ingeniería

Para Claude Code, Codex, ChatGPT o cualquier otro agente que implemente este diseño.

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

## Puertas de calidad por bloque

Todo bloque de implementación se cierra sólo si pasa las siete:

| # | Puerta | Cómo se comprueba |
|---|---|---|
| G1 | Tests verdes | La suite completa (hoy 91 ficheros / ~3.179 tests). Un test que cambia debe justificarse por una decisión de esta carpeta, citando documento y sección. |
| G2 | Sin regresión de capacidades | Checklist de `05 §12` para las superficies tocadas. |
| G3 | Cromo en teléfono | Medición automática a 390×844: cromo superior ≤112 px, total ≤168 px. |
| G4 | Sin tokens fuera de sistema | Lint de CSS: cero hex literales, cero `max-width` media queries nuevas, cero emoji en fuentes de componentes. |
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
