# 10 — Roadmap de bloques

Nueve bloques. Cada uno produce una mejora visible, se puede probar, no rompe
funcionalidad y tiene límites claros. **Se puede parar entre bloques** y dejar el
producto en un estado coherente.

Continúa la numeración de bloques del proyecto (v1.1.0 cerró en el Bloque 16), así que
estos son **B17–B25**. Aquí se nombran B1–B9 por brevedad; al abrir cada uno en el
repositorio, usa su número real.

## Dependencias

```
B1 Fundación
 ├── B2 Shell de navegación
 │    ├── B3 Tarjeta y descubrimiento
 │    │    ├── B4 Ficha de lugar y fotografía
 │    │    │    └── B6 Adquisición fotográfica  (puede ir en paralelo desde B4)
 │    │    └── B5 Explorar: portada y mapa
 │    ├── B8 Nosotros                          (independiente desde B2)
 │    └── B7 Quiero ir  ──→  B9 Viaje
 └── B10 Pulido                                 (último)
```

---

## B1 — Fundación visual

**Objetivo.** Instalar el sistema sin mover ni una caja de sitio. Al terminar, Nihon se
ve claramente mejor y no ha cambiado de estructura.

**Superficies.** Todas, superficialmente.

**Qué cambia**
- `app/src/styles/tokens.css` nuevo con todos los tokens de `03`.
- Autoalojamiento de Zen Kaku Gothic New e IBM Plex Sans con subconjuntos.
- Tamaño base a 16 px.
- Set de iconos de línea en `app/src/icons/`; sustitución de **todos** los emoji del
  cromo (cabecera, barras, botones, quick-facts, chips). El emoji de categoría del
  dataset se recorta en presentación.
- Escalera de interés: retirada de `--color-interest-1…5`; la insignia pasa a tinta.
- Se retira la letra de grado de la ficha.
- Botones, chips y campos reconstruidos según `04 §3–4`.
- Anillo de foco nuevo.

**Qué NO cambia.** Navegación, estructura de pantallas, qué información se muestra,
lógica, datos, tests funcionales.

**Criterios de aceptación**
- [ ] Cero emoji en componentes (comprobado por lint).
- [ ] Cero hex literales nuevos; `tokens.css` es la única fuente.
- [ ] Ningún test funcional cambia de expectativa.
- [ ] Capturas antes/después a 390×844 de las 6 superficies principales.

---

## B2 — Shell de navegación

**Objetivo.** Recuperar la pantalla. Es el bloque de mayor impacto por unidad de
esfuerzo.

**Superficies.** Cabecera, barras de hub y de vista, panel «Quiero ir», contenedor de
la ficha.

**Qué cambia**
- `TabBar` en teléfono y `NavRail` desde `md`.
- Las cuatro barras actuales se reducen a cabecera (56) + barra de búsqueda/filtros
  (48).
- El selector de ciudad pasa al título de la cabecera.
- Se retira el conmutador «Eres»; aparece el `PersonToken` (DD-007). **Arregla D1.**
- La ficha de lugar pasa a pantalla completa, por encima de todo. **Arregla D3 y D4.**
- Planner, zonas, análisis, respaldo y viajeros dejan de ser overlays y pasan a ser
  contenido de su pestaña.
- El aviso MLIT se traslada a Nosotros + `ⓘ` en el mapa.

**Qué NO cambia.** El contenido interno de cada superficie; se mueve entero.

**Criterios de aceptación**
- [ ] Cromo superior ≤112 px y total ≤168 px a 390×844 (puerta G3).
- [ ] Ninguna cabecera se desborda a 320, 360, 390 y 430 px de ancho.
- [ ] Toda capacidad de v1.1.0 sigue alcanzable; checklist de `05 §12` firmada.
- [ ] Volver atrás restaura el scroll en todas las pestañas.

---

## B3 — Tarjeta y descubrimiento

**Objetivo.** Que recorrer una ciudad sea agradable.

**Superficies.** `PlaceCard`, lista de ciudad, búsqueda, hoja de filtros, estados
vacíos.

**Qué cambia**
- `PlaceCard` v2 según `04 §5`: 4:3, nombre sobre scrim, máximo 2 chips, insignia sólo
  para grado S, token de la otra persona junto al corazón.
- Variante `compact`.
- `FilterSheet` sustituye al formulario de casillas; mismos filtros, mismo vocabulario.
- Búsqueda como hoja con resultados en vivo.
- `PhotoPlaceholder` sustituye al recuadro con emoji.
- Mapa de categorías a iconos; colapso de los 3 duplicados en presentación (OD-02).
- Tarjeta de entrada «Dónde dormir en {ciudad}» dentro de la lista.

**Qué NO cambia.** Qué lugares se muestran, el orden, la lógica de filtrado, los
contadores.

**Criterios de aceptación**
- [ ] Ninguna tarjeta muestra más de 2 chips.
- [ ] Contraste del nombre sobre fotografía ≥4.5:1 medido en las 10 imágenes más claras
      del catálogo.
- [ ] Una lista que mezcla lugares con y sin foto no parece rota.
- [ ] Todos los filtros de v1.1.0 presentes y operables con teclado.

---

## B4 — Ficha de lugar y capa fotográfica

**Objetivo.** Que un lugar se lea como un argumento y la fotografía sea el contenido.

**Superficies.** Ficha, galería, lightbox, créditos, «Cerca de aquí».

**Qué cambia**
- Reordenación completa según `05 §5`.
- Galería a sangre 4:5, `scroll-snap`, contador y puntos según cantidad.
- `CreditsSheet` tras `ⓘ`. **Arregla D2.**
- `EvidenceMark` en datos prácticos, horarios, reservas y traslados: sustituye a los
  descargos en prosa. **DDR-06**: en «Cerca de aquí» el marcador sustituye a
  `transferListFootnote`, y la semántica de la nota se traslada al `detail` accesible del
  marcador de cada traslado. Es una **reubicación, no una pérdida**.
- El aviso de feb–mar 2027 pasa a condicional (DD-011). **Arregla la fatiga de alerta.**
- «Por qué vale la pena» recibe `--type-quote` y filete bermellón.
- Franja de los dos: sólo si alguien ha opinado. **Arregla D8.**
- «Cerca de aquí» con miniaturas.
- Sección «Fuentes» plegada con **los metadatos de procedencia disponibles en el modelo
  actual**: grado original, `updatedAt` y enlaces oficiales. **DDR-04**: `provenance`,
  `consultedAt`/freshness y la versión del dataset **no existen por lugar** y este bloque
  **no los crea, no los deriva y no los sustituye por placeholders**; `updatedAt` es la
  fecha de actualización del registro, nunca una fecha de consulta. Podrán añadirse cuando
  exista evidencia real en datos — ese trabajo de dataset **no entra en B4**.

**Qué NO cambia.** Ningún dato desaparece; todo tiene destino en `05 §5`.

**Criterios de aceptación**
- [ ] Entre la fotografía y el nombre no hay texto de atribución.
- [ ] Cada campo de `PlaceDetail` v1.1.0 aparece en la ficha nueva; lista firmada.
- [ ] Con una sola imagen no hay puntos, contador ni flechas.
- [ ] **(DDR-05, acotado)** La cadena `Dato:` no aparece **en `PlaceDetail` ni en ninguna
      superficie que este bloque introduzca**. B4 **no toca `OrderedSequenceBuilder.tsx` ni el
      planificador**: la retirada global de las cuatro apariciones actuales sigue siendo de
      B9.5, como establece `10 §B9.5`.
- [ ] **(DDR-04)** «Fuentes» no muestra `provenance`, `consultedAt`, frescura por lugar ni
      versión del dataset, y no presenta `updatedAt` como fecha de consulta.
- [ ] **(DDR-06)** «Cerca de aquí» no renderiza nota al pie, y cada traslado conserva en su
      `EvidenceMark` —accesible a lector de pantalla— la distinción que la nota explicaba.

---

## B5 — Explorar: portada y mapa

**Objetivo.** Una primera impresión que sea Japón, no un mapa administrativo.

**Superficies.** Portada de Explorar, mapa nacional, mapa de ciudad.

**Qué cambia**
- Portada nueva según `05 §2`: ciudades fotográficas, cobertura inicial separada,
  cuatro colecciones editoriales, tarjeta de mapa. **Arregla D5 y D6.**
- Mapa nacional a pantalla completa con panel arrastrable.
- Base cartográfica apagada (DD-003) y marcadores por interés de persona (DD-004).
  **Arregla D11.**
- Leyenda plegada a una línea.

**Qué NO cambia.** La geometría MLIT, la navegación región/prefectura/hub, la regla de
no fingir cobertura.

**Criterios de aceptación**
- [ ] Al menos una fotografía por encima del pliegue en la primera pantalla.
- [ ] Ningún aviso de licencia en la portada, y el texto MLIT sigue en el producto.
- [ ] Las colecciones se derivan del dataset sin campos nuevos.
- [ ] El mapa nunca ocupa más del 50 % del ancho en `lg`.

---

## B6 — Adquisición fotográfica

**Objetivo.** Cerrar el agujero de cobertura y crear galerías de verdad.

Puede ejecutarse en paralelo a B5–B9 en cuanto B4 fije el contrato de presentación.

**Qué cambia (datos y pipeline, no interfaz)**
- Campo `role` en los 163 registros existentes.
- Campo `lqip` generado para todos.
- Derivada `-400w` añadida al script de derivadas.
- Tandas de adquisición en el orden de `06 §3`.

**Tandas**
- **B6.1** — 4 lugares grado S sin foto. *El defecto de catálogo más grave.*
- **B6.2** — 35 lugares grado A sin foto.
- **B6.3** — 8 lugares grado B sin foto.
- **B6.4** — segunda imagen (`experience`) para los 32 grado S.
- **B6.5** — tercera imagen para los grado S con material que aporte rol nuevo.
- **B6.6** — 10 lugares C/D + segundas imágenes de A destacados.
- **B6.7** — una imagen `context` por zona de alojamiento.

**Criterios de aceptación por tanda**
- [ ] Informe con lugares, rol de cada imagen, bytes añadidos y roles sin cubrir.
- [ ] Ninguna imagen duplica un rol ya cubierto.
- [ ] Licencia y atribución completas en cada registro.
- [ ] Presupuesto de bytes por ciudad respetado.

---

## B7 — Quiero ir

**Objetivo.** Que el acuerdo sea la recompensa.

**Superficies.** Pestaña Quiero ir, coincidencias y divergencias.

**Qué cambia**
- Pantalla según `05 §6`: segmentado, resumen de tres datos, coincidencias primero.
  **Arregla D9.**
- `SelectionAnalysis` deja de ser un modal y se convierte en la organización de la
  pantalla.
- Estados vacíos nuevos.
- Acción anclada «Llevar al viaje».

**Qué NO cambia.** La lógica de los Bloques 5 y 6; un corazón sigue sin convertirse en
plan por sí solo.

**Criterios de aceptación**
- [ ] Las coincidencias se ven sin ningún clic.
- [ ] El titular no es una duración.
- [ ] Ningún texto dice «analizar» ni «selección».
- [ ] Las divergencias siguen calculándose igual.

---

## B8 — Nosotros

**Objetivo.** Dar casa a la identidad, al respaldo y a la honestidad del producto.

Independiente: puede hacerse en cualquier momento después de B2.

**Qué cambia**
- Pantalla según `05 §11`.
- `TravellerManager` deja de ser modal.
- Respaldo JSON reubicado, con confirmación explícita de reemplazo.
- «Fuentes y licencias»: MLIT, fotografía, versión del dataset.
- Onboarding reabrible y ampliado con el paso de nombres (`05 §1`).

**Criterios de aceptación**
- [ ] Exportar e importar funcionan igual en Safari de iOS (repetir la prueba física
      de aceptación del Bloque 15).
- [ ] La atribución MLIT sigue íntegra.
- [ ] Se puede cambiar de persona activa en dispositivo compartido.

---

## B9 — Viaje

**Objetivo.** Convertir el constructor de recorridos en un viaje. El bloque más grande;
se subdivide.

**B9.1 — Días como estructura.** `DayTimeline`, `TripStop`, conectores, cabeceras y
pies de día, cajón «Sin asignar». Se elimina el trío `↑ ↓ ×`. **Arregla D10.**

**B9.2 — Reordenar.** Arrastrar y soltar con alternativa obligatoria por teclado
(«Mover a…»).

**B9.3 — Herramientas del día.** «Probar otro orden» local al día, con la comparación
existente y las alternativas verificadas como opciones.

**B9.4 — Dónde dormir.** Zonas sin ordinal, con fotografía, con hecho / cálculo /
opinión separados visualmente. **Arregla D7.**

**B9.5 — Reservas y Resumen.** Sub-pestañas propias; se elimina `Dato:`; línea de
tiempo comprimida del viaje.

> **DDR-05 (resuelta).** Las cuatro apariciones reales de `Dato:` viven en
> `OrderedSequenceBuilder.tsx`, y su retirada **sigue siendo de este bloque**, no de B4. B4 se
> limita a afirmar y vigilar que la ficha no la contiene y que no la introduce; **no modifica el
> planificador**. La sustitución es la que `03 §10` ya fija: texto entre comillas con marcador
> `◧ Registrado`.

**Qué NO cambia.** Absolutamente nada del cálculo: traslados, identidad estable de día,
anclaje de calendario, límites del viaje, mecanismos de reserva, fechas oficiales,
composición del viaje, alternativas verificadas. Y Nihon sigue sin proponer un orden.

**Criterios de aceptación**
- [ ] Ninguna caja de descargo al abrir; exactamente una línea de encuadre.
- [ ] Cada parada tiene miniatura fotográfica.
- [ ] Reordenar es posible sólo con teclado.
- [ ] Las ~3.179 pruebas siguen verdes salvo cambios justificados por documento y
      sección.

---

## B10 — Pulido

**Objetivo.** Cerrar.

- Auditoría de movimiento: sólo los cinco movimientos nombrados; `prefers-reduced-motion`
  verificado.
- Auditoría de accesibilidad completa por pantalla.
- Presupuesto de rendimiento y de bytes de imagen verificado por ciudad.
- Erradicación final de `App.css`: cada superficie migrada tiene su CSS junto a su
  componente.
- Revisión de microcopy contra `03 §10`: léxico prohibido a cero.
- Decisión sobre modo oscuro (OD-01).

---

## Resumen de impacto por bloque

| Bloque | Esfuerzo | Impacto visible | Riesgo | Defectos que cierra |
|---|---|---|---|---|
| B1 Fundación | Medio | Alto | Bajo | D15 |
| B2 Shell | Alto | **Muy alto** | Medio | D1, D3, D4 |
| B3 Tarjeta | Medio | Alto | Bajo | D14 |
| B4 Ficha | Alto | **Muy alto** | Medio | D2, D8 |
| B5 Portada y mapa | Medio | Alto | Bajo | D5, D6, D11 |
| B6 Fotografía | Medio (continuo) | Alto | Bajo | cobertura |
| B7 Quiero ir | Medio | Alto | Bajo | D9 |
| B8 Nosotros | Bajo | Medio | Bajo | — |
| B9 Viaje | **Muy alto** | Alto | **Alto** | D7, D10 |
| B10 Pulido | Medio | Medio | Bajo | D12, D13 |

**Si sólo se pudieran hacer tres:** B2, B4 y B1, en ese orden. Recuperan la pantalla,
convierten la ficha en el corazón del producto y le dan identidad. Con esos tres Nihon
ya no se parece a lo que es hoy.
