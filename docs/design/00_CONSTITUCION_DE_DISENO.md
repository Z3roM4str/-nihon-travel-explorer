# 00 — Constitución de diseño

Doce artículos. Son **normativos**. Un agente de ingeniería que necesite romper uno
se detiene y devuelve `DESIGN DECISION REQUIRED`.

Todo lo demás en esta carpeta desarrolla estos artículos. Si algún documento
contradice la Constitución, manda la Constitución.

---

### Art. 1 — Qué es Nihon

Nihon es **el cuaderno de viaje de dos personas que van a Japón**. No es una base de
datos, ni un mapa con controles encima, ni un panel de administración, ni un clon de
Google Maps o TripAdvisor.

Prueba: si una pantalla se pudiera reutilizar tal cual para gestionar inventario
cambiando los textos, esa pantalla está mal diseñada.

### Art. 2 — La fotografía es contenido

La fotografía no ilustra a Nihon: **es** Nihon. Ninguna pantalla principal puede
empezar sin una imagen o sin una frase editorial. Un lugar sin fotografía no se
muestra como un hueco: se muestra con un marcador editorial deliberado que dice qué
imagen falta.

### Art. 3 — La honestidad se dibuja, no se explica

Nihon nunca exagera lo que sabe. Esa disciplina se expresa con **gramática visual**
—los cuatro niveles `Verificado / Registrado / Estimado / Nihon dice`— y no con
párrafos de descargo.

Límite duro: **máximo un aviso en prosa por pantalla**. Los demás se convierten en
marcadores de evidencia.

### Art. 4 — Nada calculado se presenta como hecho, nada de la fuente se reescribe

Un valor derivado por la aplicación lleva siempre marcador `Estimado`. Un texto de la
fuente se muestra íntegro o no se muestra, nunca parafraseado por la interfaz. La
opinión editorial de Nihon va siempre atribuida a Nihon.

### Art. 5 — Nihon no decide el viaje

Nihon **no ordena, no reparte, no equilibra y no optimiza** el itinerario. Puede
describir, comparar y ofrecer alternativas verificadas que el usuario aplica a mano.
Cualquier automatización futura es una propuesta separada, nunca un efecto lateral de
un rediseño.

### Art. 6 — Una señal que aparece en todo, no es una señal

Si un indicador se muestra en más del ~70 % de los elementos de una lista, deja de
informar y se retira de esa superficie.

Consecuencias vigentes: el nivel «Muy recomendable» (147/214 lugares) **no lleva
insignia** en tarjeta; el aviso de febrero–marzo 2027 **sólo aparece cuando hay un
problema real**, no cuando el estado es «pendiente de confirmar».

### Art. 7 — Vocabulario de viajero, no de repositorio

Prohibidas en la interfaz visible: *recorrido*, *secuencia*, *constructor*, *orden A /
orden B*, *tramo*, *candidato*, *Dato:*, *grado*, *provenance*, *freshness*,
*analizar selección*, *cobertura*.

El léxico correcto está en `03_SISTEMA_DE_DISENO.md § Voz y microcopy`.

### Art. 8 — Mobile-first literal

Todo el CSS se escribe **mobile-first, sólo con `min-width`**. Está prohibido añadir
`@media (max-width: …)` nuevo.

Límite duro: en teléfono, el cromo permanente superior **no puede superar 112 px**, y
el cromo total (superior + inferior) no puede superar 168 px. Una ficha de lugar
abierta en teléfono ocupa la pantalla completa, nunca se abre por debajo de barras de
navegación.

### Art. 9 — Cada preferencia es de una persona; cada plan es de los dos

Toda superficie declara sin ambigüedad si lo que muestra es **personal** (lo que quiere
una persona) o **compartido** (el plan). Ninguna pantalla puede dejarlo implícito, y
ningún rediseño puede introducir un estado cuya propiedad no esté definida.

### Art. 10 — Sólo tokens

Ningún componente define color, tipografía, radio, sombra, espaciado, duración o
easing fuera de los tokens de `03_SISTEMA_DE_DISENO.md`. Cero hex literales, cero
`rem` sueltos de espaciado, cero `px` de tipografía fuera de la escala.

### Art. 11 — Suelo de calidad no negociable

44×44 px mínimo de área táctil (48 en acciones primarias); contraste 4.5:1 en texto y
3:1 en elementos gráficos portadores de significado; el color **nunca** es el único
portador de una diferencia; foco visible siempre; `prefers-reduced-motion` respetado;
todo operable con teclado; ninguna imagen sin `alt` intencional o `alt=""` deliberado.

### Art. 12 — Evolución, no reescritura

Ningún cambio elimina una capacidad existente de v1.1.0. Puede reubicarla, y entonces
**está obligado a documentar dónde queda**. Si un bloque de implementación no puede
conservar una capacidad, se detiene y lo reporta; no la borra.

---

## Patrones explícitamente prohibidos

| Prohibido | Por qué | Qué hacer |
|---|---|---|
| Emoji como icono de interfaz | Renderiza distinto por plataforma, rompe el tono, no se puede tematizar | Set de iconos de línea propio (`03 § Iconografía`) |
| Etiquetas en MAYÚSCULAS con `letter-spacing` | Tell de plantilla; ilegible en móvil | Título en caja de frase |
| Cadenas de tres partes unidas por `·` | Tell de plantilla; densidad falsa | Máximo un `·` por línea |
| «Eyebrow» sobre un título | Ruido tipográfico | La información baja bajo el título o se convierte en chip |
| `→` al final de un botón o enlace | Tell de plantilla | Verbo activo sin flecha |
| Numerar contenido que no es una secuencia | Implica ranking donde no lo hay | Sin ordinal (ver zonas de alojamiento) |
| Créditos fotográficos en el flujo de lectura | Roba el mejor espacio de la pantalla | Detrás de un botón `ⓘ` |
| Bloques de descargo al abrir una pantalla | Coste de pantalla y de tono | Una línea + marcadores de evidencia |
| Mostrar la letra de grado (S/A/B/C/D) al usuario | Ya está traducida a lenguaje llano | Sólo en «Fuentes» plegado |
| Dependencias que traen su propio sistema visual | Rompe la identidad | CSS propio sobre tokens |
| UI muerta de funciones futuras | Promete lo que no existe | No se renderiza hasta que funciona |
