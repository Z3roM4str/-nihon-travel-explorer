# Bloque 21 (B5) — Inventario de Explorar, mapa nacional y mapa de ciudad

> **Contrato.** Este inventario se escribe antes de tocar UI. Cada capacidad existente tiene un
> destino explícito en B21 y un gate que la protege. Nada puede desaparecer por accidente
> (`00` Art. 12, `05 §12`, `08`).

**Rama:** `codex/block-21-b5-explore-home-map`
**Base obligatoria:** `e3fca24a362efcfa99bd141599972944c0fabb99`
**Fecha de apertura:** 2026-09-21
**Estado:** checkpoint A; no se ha implementado UI de B21.

Los gates marcados **B21 (nuevo)** son contratos de cierre todavía no implementados. Los demás
existen en la base B20 y se ejecutaron durante el preflight.

---

## 1. Hechos de partida

- Catálogo: **214 lugares** en **7 hubs**: Tokio 57, Kioto 49, Osaka 53, Okinawa 50,
  Sapporo 3, Nagoya 1 y Fukuoka 1.
- Geografía: **47 prefecturas**, **9 regiones de navegación** y **15 prefecturas con lugares**,
  todo derivado por código de prefectura; la geometría MLIT no se usa como prueba de cobertura
  editorial.
- Fotografía en la base B20: **163 registros para 157 lugares**. Las cuatro ciudades principales
  tienen al menos una fotografía válida de un lugar grado S. B6.1/PR #138 no está integrado.
- Entrada actual a Explorar: la vista nacional administrativa (`NationalExplorer`) es la primera
  superficie. B21 la sustituye por la portada de `05 §2`; el mapa se conserva un nivel más dentro.
- Mapa de ciudad actual: Leaflet + teselas OSM crudas, selección por lugar, mapa conmutado bajo
  `lg` y raíl persistente desde `lg`.

---

## 2. Explorar nacional — matriz de conservación

| Capacidad actual | Destino exacto en B21 | Gate que la protege |
|---|---|---|
| Explorar abre en `ViewState.mode = "national"`, hoy con mapa y navegación administrativa | Explorar seguirá abriendo en estado nacional, pero renderizará primero la **portada** de `05 §2`; «Ver Japón en el mapa» abrirá la superficie nacional existente reencuadrada por `05 §3` | **B21-HOME-01 (nuevo)** + migración de `block12-bundle-architecture-browser-audit.mjs` |
| Los 7 hubs son accesos directos y sus contadores se derivan de `getPlacesByHub` | Tokio, Kioto, Osaka y Okinawa pasan a «Ciudades» fotográficas; Sapporo, Nagoya y Fukuoka quedan separados como destinos de profundidad editorial inicial; los 7 siguen abriendo el mismo hub | `block1-ux-browser-audit.mjs` (7/7 hoy) + **B21-HOME-02 (nuevo)** |
| Los 4 hubs principales se muestran hoy como botones de texto, sin fotografía | Tarjetas fotográficas 16:9 según `05 §2`, usando sólo `resolvePlaceImages` y candidatos grado S del propio hub; sin URL externa ni lista manual de IDs | `block2-photography-browser-audit.mjs` + **B21-HOME-03 (nuevo)** |
| Sapporo (3), Nagoya (1) y Fukuoka (1) se muestran al mismo nivel visual que las ciudades de 49–57 lugares | Sección separada prescrita por `05 §2`, manteniendo contadores derivados y sin afirmar profundidad equivalente | **B21-HOME-04 (nuevo)** |
| Las 9 regiones, las 47 prefecturas y los huecos de catálogo viven dentro de la primera pantalla | Se conservan íntegramente en **Explorar › Mapa de Japón**, no en la portada | `phase5a-rc-browser-audit.mjs` A01–A03 + `RegionNavigator.test.ts` + **B21-NAT-01 (nuevo)** |
| La cobertura por prefectura/región se deriva de los 214 lugares; no hay conteos escritos a mano | La portada sólo comunica profundidad editorial real; el mapa conserva las 47 geometrías y su estado con/sin lugares sin convertir geometría en cobertura | `phase5a` A02 + **B21-HOME-05/B21-NAT-02 (nuevos)** |
| Prefecturas/regiones sin lugares permanecen navegables y dicen «Sin lugares aún» / «Todavía no tenemos…» | Siguen visibles en el mapa; al seleccionarlas muestran el estado de `05 §3`: «Todavía sin lugares verificados» | `RegionNavigator.test.ts` + **B21-NAT-03 (nuevo)** |
| Entrar a un hub reinicia filtros, ficha, foco de mapa y vuelve a lista | La portada y el mapa nacional reutilizan `enterHub`; el destino exacto sigue siendo Explorar › Ciudad, lista primero | `b17-regression-check.mjs`, `b18-regression-check.mjs`, `phase5a` A03 + **B21-NAV-01 (nuevo)** |
| Buscar/filtrar sólo es posible dentro de una ciudad; la superficie nacional actual no tiene búsqueda global funcional | La portada prescribe «Buscar en todo Japón», pero no existe hoy lógica global ni contrato de resultados. No se simulará ni se convertirá en UI muerta; queda bloqueado por decisión de navegación/alcance (§7) | **B21-HOME-06 (nuevo, pendiente de decisión)** |
| La atribución MLIT está detrás de `ⓘ` en el mapa y completa en Nosotros › Fuentes y licencias | No aparece en contenido principal de la portada. Permanece íntegra, accesible y enlazada desde el mapa y Nosotros | `b18-regression-check.mjs` + **B21-HOME-07/B21-NAT-04 (nuevos)** |

---

## 3. Mapa nacional — matriz de conservación

| Capacidad actual | Destino exacto en B21 | Gate que la protege |
|---|---|---|
| GeoJSON MLIT N03 (2026), 47 `Feature`, cargado desde el mismo origen y cacheado por sesión | Mismo fichero, mismas geometrías y mismo join por código; B21 no modifica geometría | `dataset-contract.test.ts`, `RegionNavigator.test.ts`, `phase5a` A01–A03 + **B21-NAT-01** |
| Selección de prefectura desde polígono o lista; ambas rutas comparten `prefectureCode` | Misma selección dentro del panel arrastrable; mapa y lista siguen siendo dos controles del mismo estado | `phase5a` A03 + **B21-NAT-05 (nuevo)** |
| Al elegir prefectura, su región se activa automáticamente | Se conserva la transición Japón → región → prefectura sin estados contradictorios | `phase5a` A03 + **B21-NAT-06 (nuevo)** |
| Región activa reencuadra el mapa con `fitBounds`; volver a Todo Japón reencuadra el país | Se conserva dentro del mapa a pantalla completa; el movimiento sigue respetando `prefers-reduced-motion` | **B21-NAT-07 (nuevo)** |
| Zoom inicial 4, mínimo 3, máximo 10; sin control de zoom visible; rueda desactivada | B21 conserva la capacidad de encuadre/zoom; cualquier cambio visible de controles requerirá norma adicional | **B21-NAT-08 (nuevo)** |
| Desplazamiento Leaflet por arrastre está activo; el scroll de rueda queda para la página | Mapa usable dentro de la pantalla completa sin atrapar la alternativa navegable | **B21-NAT-08** |
| Las 9 regiones permanecen visibles; fuera de la región activa retroceden visualmente | Se conserva la región activa y la geometría completa, ahora coordinada con el panel inferior | **B21-NAT-06** |
| Prefectura seleccionada gana estado propio y abre `PrefecturePanel` | La ficha se reubica dentro del panel arrastrable; selección, cierre y `Escape` se conservan | `RegionNavigator.test.ts` + **B21-NAT-09 (nuevo)** |
| Un hub se alcanza desde atajo nacional, resumen regional o ficha de prefectura | Se conserva el hub como último paso de la ruta administrativa y abre Explorar › Ciudad | `phase5a` A03 + **B21-NAT-10 (nuevo)** |
| No hay leyenda nacional separada; fill, tooltip, listas y ficha comunican presencia/ausencia de lugares | B21 debe conservar la distinción sin color solo. La «leyenda plegada a una línea» del roadmap se aplicará a la semántica congelada que corresponda; no se inventará una leyenda nueva | **B21-NAT-11 (nuevo)** |
| `MlitAttribution` se abre con `ⓘ`, está completa en Nosotros y el control es alcanzable por teclado | Mismo patrón exacto de `05 §3`/B18, integrado en la superficie a pantalla completa | `b18-regression-check.mjs` + **B21-NAT-04** |
| Error/carga de geometría tiene fallback textual y deja operativa la lista | Se conserva como alternativa funcional; una caída del GeoJSON no bloquea región/prefectura/hub | **B21-NAT-12 (nuevo)** |
| Prefectura sin lugares abre una ficha honesta sin hub falso | Se conserva el estado vacío exacto de `05 §3` | `RegionNavigator.test.ts` + **B21-NAT-03** |
| Todas las acciones esenciales tienen alternativa de botones; no dependen del polígono | El panel arrastrable debe conservar regiones, prefecturas, hub, `Escape`, foco visible y targets ≥44×44 | `b18-a11y-check.mjs`, `block1-ux-browser-audit.mjs` + **B21-NAT-13 (nuevo)** |
| `PrefecturePanel` es una tarjeta superpuesta, no arrastrable | Se sustituye por el panel inferior de tres alturas (asa, 25 %, 75 %) especificado en `05 §3`; la información y acciones de la tarjeta pasan dentro, no desaparecen | **B21-NAT-14 (nuevo)** |

---

## 4. Mapa de ciudad — matriz de conservación

| Capacidad actual | Destino exacto en B21 | Gate que la protege |
|---|---|---|
| Cada marcador selecciona un lugar y abre la instancia única de `PlaceDetail` | Misma selección y mismo stack de ficha; sólo cambia la semántica visual del marcador según DD-004 | `b17-regression-check.mjs`, `b18-regression-check.mjs`, `b18-viaje-lugar-check.mjs` + **B21-CITY-01 (nuevo)** |
| El lugar seleccionado tiene marcador propio y un lugar filtrado se añade al mapa mientras está seleccionado | Se conserva el pin seleccionado y la garantía de que ficha y mapa describen el mismo lugar | `block19-grid-check.mjs` + **B21-CITY-02 (nuevo)** |
| `FitHubBounds` encuadra el hub sólo cuando cambia el hub; filtros y ficha no reencuadran todo | Se conserva centro/zoom al filtrar, abrir y cerrar ficha | `block19-grid-check.mjs` + **B21-CITY-03 (nuevo)** |
| `FocusSelected` lleva la selección a zoom ≥14 y respeta movimiento reducido | Se conserva salvo cuando la ficha cubre por completo el mapa, donde DD-017 prohíbe moverlo de forma invisible | `block19-grid-check.mjs` + **B21-CITY-04 (nuevo)** |
| Abrir/cerrar ficha mantiene montado el mapa en `lg`/`xl` | La ficha puede cubrirlo por completo; al cerrar reaparecen centro, zoom y selección idénticos | `block19-grid-check.mjs` (52/52) + **B21-CITY-05 (nuevo)** |
| `history` + `ficheOrigin` conserva encadenado de lugares, cierre y back del navegador | Se conserva sin cambiar de destino implícitamente | `b18-browser-back-check.mjs` (15/15), `b18-viaje-lugar-check.mjs` (38/38) + **B21-CITY-06 (nuevo)** |
| «Ver en el mapa» desde Viaje cierra la ficha, cambia explícitamente a Explorar, centra el lugar y no reabre ficha | Se conserva exactamente (DD-015); B21 no altera la salida explícita | `b18-viaje-lugar-check.mjs` + **B21-CITY-07 (nuevo)** |
| Cambiar de destino deja los paneles montados; volver a Explorar conserva Lista/Mapa y estado | Se conserva el estado previo del mapa y de la ciudad | `b18-regression-check.mjs`, `phase5a` G01b + **B21-CITY-08 (nuevo)** |
| En `base`–`md`, Lista/Mapa conmuta una superficie; en `lg`+ el mapa es raíl persistente | Se conserva la arquitectura de DD-016, sin breakpoint ad hoc ni `max-width` nuevo | `b18-responsive-check.mjs`, `block19-grid-check.mjs` + **B21-CITY-09 (nuevo)** |
| En `lg`/`xl`, raíl `min(480px, 50%)`; a 1200 mide 43,2 % y a 1600 31,7 % en la baseline | El mapa nunca supera 50 %; lista sigue primaria | `block19-grid-check.mjs` + **B21-CITY-10 (nuevo)** |
| `panelOffset` sólo se pasa con raíl persistente + ficha; `panelCoversMap` evita pan cuando la ficha cubre todo | Se conserva exactamente según DD-017; no se fabrica franja residual | `block19-grid-check.mjs` + **B21-CITY-11 (nuevo)** |
| Mapa vacío por filtros conserva el mapa y ofrece reset explícito | Se conserva el estado, contador total y «Limpiar búsqueda y filtros» | `block1-ux-browser-audit.mjs` + **B21-CITY-12 (nuevo)** |
| Marcadores actuales codifican grado en tinta y sólo añaden una marca binaria de guardado | Se sustituye por DD-004: nadie / A / B / los dos + seleccionado, con forma/tamaño/texto además de color | **B21-CITY-13 (nuevo)** |
| Leyenda actual enumera niveles editoriales dentro de `<details>` plegado | Se sustituye por una línea plegable que explique la semántica de persona de DD-004 | `block1-ux-browser-audit.mjs` (protege que exista leyenda) + **B21-CITY-14 (nuevo)** |
| OSM crudo con atribución nativa, zoom visible abajo-derecha y tiles externos; el fallo de tiles no rompe la lista | La base sólo puede cambiar tras cerrar DD-003; lista y acciones esenciales siguen siendo alternativa al mapa | `phase5a` H03–H04 + **B21-CITY-15 (nuevo, bloqueado por DD-003)** |
| Marcadores Leaflet aceptan teclado y nombre (`keyboard`, `title`, `alt`); la lista ofrece la alternativa completa | Se conserva teclado, nombre accesible, foco visible y target ≥44×44 para cualquier control nuevo | `b18-a11y-check.mjs`, `block1-ux-browser-audit.mjs` + **B21-CITY-16 (nuevo)** |

---

## 5. Cuatro colecciones editoriales — derivación cerrada

No hay IDs editoriales escritos a mano. El orden interno conserva el orden actual del dataset;
ordenar, ponderar o destacar de otra forma sería criterio editorial nuevo.

| Colección (`05 §2`) | Regla de derivación | Campos / función existentes | Resultado en `e3fca24` | Fallback de datos |
|---|---|---|---:|---|
| Imprescindibles | `place.grade === "S"` | `grade` | 32 | `[]`; nunca sustituir por grado A ni por IDs manuales |
| Joyas escondidas | `place.hiddenGemStatus === "Hidden Gem real"` | `hiddenGemStatus` | 35 | `[]`; nunca promover `Semi-hidden` |
| Menos saturado | `place.hiddenGemStatus === "Alternativa menos saturada"` | `hiddenGemStatus` | 14 | `[]`; nunca inferir desde `tourismLevel`/`crowdLevel` |
| Para una tarde | `resolveDuration(place.duration)?.maxMinutes <= 120` | `duration.minMinutes`, `duration.maxMinutes`, `duration.raw`, `resolveDuration` | 75 | `[]`; una duración no resoluble no se adivina |

Las cuatro tienen resultados en el snapshot actual, así que no hay estado vacío observable. El
tratamiento visible de una colección futura vacía y las cuatro líneas editoriales no están
especificados; no se inventarán (§7).

---

## 6. Auditoría obligatoria de decisiones

### DD-003 — bloqueada parcialmente

`09` mantiene DD-003 en estado **Provisional**. Autoriza dos soluciones materiales distintas:

1. CARTO Positron (proveedor/tiles nuevos), preferida pero pendiente de licencia y política de uso.
2. OSM actual con filtro CSS `saturate(.25) contrast(.92) brightness(1.04)`.

El prompt de B21 prohíbe que Codex elija proveedor, tiles o estilo cartográfico. Por tanto, B21
puede conservar y probar todo el mapa, pero **no puede cambiar su base visual** hasta recibir la
decisión. No se evaluó ninguna tercera opción.

### DD-004 — implementable literalmente

DD-004 está **Firme** y `03 §9` fija toda la semántica necesaria:

- nadie: punto 10 px `--ink-500`, opacidad .7;
- persona A: punto 12 px `--person-a`, anillo blanco;
- persona B: punto 12 px `--person-b`, anillo blanco;
- los dos: punto 14 px `--shu-600`, anillo blanco;
- seleccionado: nodo 20 px con halo y prioridad superior;
- más de 12 marcadores visibles: agrupación en círculo con cifra.

No hay autorización para nuevos colores, badges, símbolos, estados ni ranking editorial.

### DD-015 / DD-016 / DD-017 — conservación, no rediseño

- DD-015 conserva destino, stack, back y «Ver en el mapa» explícito.
- DD-016 conserva lista primaria, raíl ≤50 %, cabida por contenedor y breakpoints existentes.
- DD-017 permite que la ficha cubra el mapa; exige preservar estado y limita `panelOffset` a
  geometrías donde mapa y panel sean simultáneamente visibles.

---

## 7. DESIGN DECISION REQUIRED

### DDR-B21-01 — solución concreta de DD-003

**Bloque:** B21/B5
**Superficie:** Explorar › Mapa de ciudad (y cualquier base cartográfica de B21)
**Pregunta:** ¿B21 debe usar CARTO Positron, previa confirmación de licencia/política, u OSM con
el filtro CSS ya aceptado?
**Consultado:** `03 §9`, `05 §3`, `10 §B5`, `09 DD-003`, prompt B21.
**Opciones reales:** (a) CARTO Positron; (b) OSM filtrado con la fórmula exacta de DD-003.
**Impacto:** proveedor/red, atribución, aspecto cartográfico y gates de tiles.
**Bloqueante:** **sí, sólo para cambiar la base cartográfica**; no bloquea portada, datos,
conservación ni DD-004.

### DDR-B21-02 — copy prohibido frente a copy prescrito

**Bloque:** B21/B5
**Superficie:** Explorar › Inicio › destinos con 1–3 lugares
**Pregunta:** `05 §2` exige la etiqueta visible «Cobertura inicial», pero `00` Art. 7 prohíbe la
palabra visible «cobertura». ¿Cuál es el copy aprobado?
**Consultado:** `00` Art. 7, `05 §2`, `10 §B5`, prompt B21.
**Opciones reales:** (a) autorizar la excepción literal de `05 §2`; (b) aprobar otra etiqueta de
viajero que mantenga la distinción; (c) corregir `05 §2` con copy nuevo decidido por diseño.
**Impacto:** título de la sección Sapporo/Nagoya/Fukuoka y sus gates de copy.
**Bloqueante:** **sí para esa etiqueta**, no para derivar ni renderizar los destinos.

### DDR-B21-03 — conteo falso en la tarjeta de mapa

**Bloque:** B21/B5
**Superficie:** Explorar › Inicio › tarjeta «Ver Japón en el mapa»
**Pregunta:** `05 §2` prescribe «47 prefecturas, 6 con lugares verificados», pero el dataset
actual deriva **15** prefecturas con lugares. ¿Debe el texto ser dinámico (47/15) o debe cambiar
la unidad que el «6» pretendía describir?
**Consultado:** `00` Arts. 3–4, `05 §2`, `data/geography.ts`, `prefectures.json`, `places.json`.
**Opciones reales:** (a) contador dinámico de prefecturas (hoy 15); (b) copy corregido con otra
unidad aprobada; (c) retirar el segundo número mediante copy aprobado.
**Impacto:** honestidad del acceso al mapa y aserción exacta del gate de portada.
**Bloqueante:** **sí para el subtítulo**, no para la tarjeta ni su navegación.

### DDR-B21-04 — copy editorial de las colecciones

**Bloque:** B21/B5
**Superficie:** Explorar › Inicio › cuatro colecciones
**Pregunta:** `05 §2` exige «una línea editorial» bajo cada título, pero ninguna de las cuatro
líneas está congelada y Codex no puede escribir copy visible nuevo. ¿Cuáles son las cuatro líneas?
**Consultado:** `01` (voz), `03 §10`, `05 §2`, `08` (copy nuevo requiere revisión), `09 DD-014`.
**Opciones reales:** (a) diseño entrega cuatro líneas; (b) diseño elimina formalmente la línea;
(c) diseño autoriza un campo existente concreto como texto sin reescritura.
**Impacto:** jerarquía y copy de las cuatro colecciones; la derivación de datos ya está cerrada.
**Bloqueante:** **sí para los subtítulos**, no para las consultas ni sus tests de pureza.

### DDR-B21-05 — búsqueda nacional sin contrato funcional

**Bloque:** B21/B5
**Superficie:** Explorar › Inicio › «Buscar en todo Japón»
**Pregunta:** ¿Qué resultados, filtros, destino al seleccionar y comportamiento de back debe
tener el buscador nacional? La aplicación sólo tiene `SearchSheet` acotado al hub activo.
**Consultado:** `02` mapa de pantallas, `04 §12`, `05 §2`/`§4`, `08` navegación/copy.
**Opciones reales:** (a) búsqueda global en los 214 lugares con ficha dentro de Explorar y retorno
a portada; (b) selector de ciudad antes de buscar; (c) retirar la fila hasta que exista contrato.
**Impacto:** navegación, estado, filtros, back y copy de vacío; no es un cambio interno.
**Bloqueante:** **sí para el buscador de portada**, no para el resto de la portada.

### DDR-B21-06 — nombre japonés de los hubs principales

**Bloque:** B21/B5
**Superficie:** Explorar › Inicio › tarjetas de Tokio/Kioto/Osaka/Okinawa
**Pregunta:** `05 §2` exige el nombre japonés bajo cada hub, pero no existe metadato de hub;
`prefectures.json` describe prefecturas y no siempre una ciudad. ¿Qué fuente/copy se aprueba?
**Consultado:** `05 §2`, `data/store.ts`, `prefectures.json`, `places.json`, `08`.
**Opciones reales:** (a) añadir metadato normativo de hubs; (b) aprobar un mapa de presentación
con las cuatro grafías; (c) retirar ese renglón mediante cambio de especificación.
**Impacto:** copy y modelo de presentación de las cuatro tarjetas.
**Bloqueante:** **sí para ese renglón**, no para fotografía, nombre español, contador o navegación.

---

## 8. Baseline del checkpoint A

### Herramientas base

| Gate | Resultado |
|---|---|
| `npm run build` | **PASS**; sólo advertencia heredada de chunk >500 kB |
| `npm run lint` | **PASS**, sin advertencias |
| `npx vitest run` | **3299/3313**, 88/96 ficheros; 14 fallos heredados de path/CRLF en Windows (§8.1) |

### Gates de B17–B20, persistencia, Explorar y fotografía

| Gate | Resultado |
|---|---|
| B17 regression / tap / responsive | **18/18**, **16/16**, sin overflow |
| B18 a11y / browser-back / chrome / regression / responsive / Viaje→Lugar | **23/23**, **15/15**, **6/6**, **40/40**, sin overflow, **38/38** |
| B19 grid / contrast / discovery | **52/52**, dentro de contrato, **30/30** |
| B20 place detail | **73/73** |
| DDR-03 persistence | **43/43** |
| Block 1 UX | **153/153** |
| Block 2 photography | **81/81** |
| Phase 5A RC desktop / mobile | **50/50** y **50/50** |
| Phase 4C/4D/4F/4H/4J/4L photography | **PASS** las seis |
| Python photography/rendition/selectors | **91/91** (36 + 25 + 13 + 8 + 9) |

Los gates de navegador se ejecutaron con Microsoft Edge real mediante Playwright. El adaptador
temporal usado para sustituir la ruta Linux `/opt/pw-browsers/chromium` se eliminó después de la
baseline; no forma parte del repositorio.

### 8.1 Fallos heredados y alcance real

| Gate | Causa | ¿Heredado? | ¿Llega a la superficie que pretende comprobar? | Tratamiento B21 |
|---|---|---:|---|---|
| `block17-design-foundation.test.ts` (3) y `bundle-architecture.test.ts` (1) | En Windows construyen `C:\\C:\\…` al convertir rutas | Sí; la misma suite figura verde en el cierre Linux de B20 | No; fallan al abrir el fichero | No tocar deuda ajena; ejecutar cierre en Linux o hacer portable el helper sólo con justificación separada |
| `block18-shell.test.ts` (4), `DivergenceView.test.ts` (1), `OrderedSequenceBuilder.*` (2), `PlaceCard.test.ts` (2), `feb-mar-status.test.ts` (1) | Aserciones de fuente dependen de `\n` y/o cortes textuales exactos; el checkout Windows usa CRLF | Sí | No en esos 10 casos; comparan texto fuente antes de conducta | Los browser gates sucesores sí pasaron; no relajar aserciones vigentes |
| `block12-bundle-architecture-browser-audit.mjs` | Asume mapa nacional en primer render y luego intenta abrir planner con `.selection-panel__analyze`, control oculto desde B18 | Sí; selector/superficie obsoletos | Parcial: carga/chunks sí; no llega al planner por la navegación vieja. Su espera fija de 900 ms tampoco espera explícitamente el GeoJSON | B21 debe migrar el requisito original: portada crítica primero, mapa diferible según la nueva arquitectura y planner por Viaje; no borrar el gate |

### 8.2 Limpieza del árbol

Los únicos elementos no rastreados al abrir B21 eran `phase3b2b-run-audit/` y `worktree/`, ambos
preexistentes y ajenos al bloque. No se modificaron, borraron, añadieron ni ocultaron. El diff
rastreado del checkpoint A contiene únicamente este inventario y el handoff.
