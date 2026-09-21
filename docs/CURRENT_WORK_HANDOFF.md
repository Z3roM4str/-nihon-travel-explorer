# Handoff reanudable — estado actual del trabajo

> **Este fichero es la única fuente de verdad para retomar el trabajo.** Se actualiza y se
> empuja en cada checkpoint estable, no sólo al cerrar un bloque. Si una sesión se corta, otro
> agente debe poder continuar usando exclusivamente: la rama remota, el último SHA pusheado,
> este fichero y los documentos normativos de `docs/design/`.

**Última actualización:** 2026-09-21 · checkpoint H — **DDR-03 resuelta e implementada; B19 cerrado**

---

## 1. Dónde estamos

| | |
|---|---|
| **Bloque actual** | Bloque 19 (B3 — Tarjeta y descubrimiento) · **CERRADO** (DD-016, DD-017, DDR-02, DDR-03 y los cinco gates heredados) |
| **Rama** | `claude/block-19-b3-card-discovery` |
| **Último SHA estable pusheado** | el checkpoint H (ver `git log -1`) |
| **Último SHA con cambio de producto** | checkpoint H — `lib/device-storage.ts` y `PersistenceNotice` (DDR-03) |
| **SHA de partida del bloque** | `b82451a` — `feat(block-19): implement B3 card and discovery surface` |
| **Estado del working tree** | Limpio. Local y `origin` al mismo SHA. |
| **Estado de la suite** | Verde entera, gates de navegador incluidos (detalle en §7). |
| **Siguiente bloque** | B4 — Ficha de lugar y capa fotográfica. **NO EMPEZADO. No empezarlo sin instrucción explícita de Claude.** |

> Este cuadro se actualiza en cada checkpoint. Para retomar, lo que manda es el HEAD de la rama
> remota (`git reset --hard origin/claude/block-19-b3-card-discovery`), no un SHA copiado a mano.

---

## 2. Objetivo exacto del trabajo en curso

**Terminado.** El objetivo era corregir B19 para que la rejilla de descubrimiento deje de decidir
sus columnas por breakpoints del viewport y pase a responder al **ancho efectivo de su propio
contenedor**, con topes por breakpoint, y para que la tarjeta cumpla el contrato de scrim y
contraste sin `text-shadow`.

Comportamiento de referencia exigido y **verificado**:

| Viewport | Ficha | Columnas |
|---|---|---|
| 360 | cerrada | 1 |
| 600 | cerrada | 2 |
| 840 | cerrada | 2 |
| 840 | **abierta** | **1** |
| 1200 | cerrada | 2 |
| 1600 | cerrada | 3 |

No queda nada pendiente de este objetivo. Lo que queda abierto está en §5 y §9.

---

## 3. Decisiones de diseño CONGELADAS (no se tocan)

Fuente normativa: `docs/design/09_DECISIONES_DE_DISENO.md` § **DD-016**, más `02 §D5`, `03 §5`,
`04 §5`, `05 §4` y los invariantes de `08`.

1. **Ninguna rejilla decide sus columnas sólo por el viewport.** El número de columnas es el
   menor de dos números, en este orden: (a) la **cabida real** del ancho efectivo del contenedor
   —vía `@container` o equivalente que mida el contenedor, nunca la pantalla—, con `PlaceCard`
   nunca por debajo de **264 px**; (b) el **tope del breakpoint**: `base` 1 · `sm` 2 · `md` 2 ·
   `lg` 2 · `xl` 3. El tope es un techo, jamás un suelo.
2. **El ancho de viewport en el que `lg` llega a 2 columnas (~1090–1140 px) NO es un breakpoint.**
   Es consecuencia aritmética de la fórmula. No se escribe en el CSS ni en la documentación.
3. **La lista es la superficie primaria.** El raíl derecho mide `min(480 px, 50 %)`
   (`--place-detail-panel-width`) y la lista se queda con el resto. El raíl nunca pasa del 50 %.
4. **El mapa persistente empieza en `lg` (1200 px)**, no en `md`. En `md` el mapa es la superficie
   conmutada por el control Lista/Mapa, como en teléfono. Ese control se retira en `lg`+.
5. **En `lg`/`xl` la ficha se apoya sobre el raíl del mapa sin cambiarlo de tamaño**: abrir y
   cerrar la ficha conserva centro, zoom y marcador seleccionado.
6. **La proporción sigue al número de columnas**, no al breakpoint: 4:3 con una columna, 16:9 con
   dos o más.
7. **Cero `text-shadow` en todo el producto** (`03 §5`). La legibilidad sobre fotografía la da el
   scrim y sólo el scrim.
8. **Scrim efectivo ≥0.60 bajo toda la banda de texto**, con contraste AA (4.5:1) usando la
   fotografía más clara del catálogo y para **cada** color de texto de la banda.
9. **Ningún token nuevo.** El suelo de scrim de la banda reutiliza el valor que `--scrim-bottom`
   ya declara en su parada inferior.
10. **DD-017 — mapa y ficha son una sola región en `lg`/`xl`.** Con la ficha cerrada el mapa
    funciona con normalidad; al abrirla, **la ficha puede cubrir el mapa por completo** y no se
    fabrica una franja residual de mapa para evitarlo. Lo que se conserva es el **estado**
    (centro, zoom, pin/selección), no la visibilidad: al cerrar, el mapa reaparece idéntico.
    `panelOffset` sobrevive como mecanismo, pero **sólo actúa donde mapa y panel se ven a la
    vez**.
11. **DDR-02 — toda la tarjeta abre el lugar.** El control principal es hijo directo del
    `<article>`, cubre la tarjeta entera y no nace dentro de `.place-card__media`, que conserva su
    `overflow: hidden`. Corazón y token quedan por encima y no abren.
12. **DDR-03 — la persistencia no falla en silencio.** **Una sola fuente de verdad**
    (`lib/device-storage.ts`), **un solo aviso** renderizado en la raíz (`04 §17`), copy exacto, y
    «Reintentar» que reescribe la carga que falló sin descartar nunca datos. Mientras hay error,
    ninguna superficie afirma que los cambios quedaron guardados.

---

## 4. Qué está terminado

- **Shell** (`app/src/App.css`, `app/src/App.tsx`): raíl derecho parametrizado, fin del panel de
  372 px fijos, mapa persistente desde `lg`, `.app__body--detail`, `.app__sidebar` como contenedor
  de consulta (`container-name: lista-explorar`).
- **Rejilla** (`app/src/styles/discovery.css`): columnas por `@container` con topes por `@media`;
  proporción 4:3 / 16:9 gobernada por las mismas condiciones.
- **Tarjeta** (`app/src/components/PlaceCard.tsx`, `discovery.css`): banda de texto
  (`.place-card__band`) con suelo de scrim propio; tres `text-shadow` eliminados; `sizes`
  corregido a la geometría real.
- **Mapa** (`app/src/components/PlaceMap.tsx`): `panelCoversMap()` — no mueve el mapa cuando la
  ficha lo cubre entero; `panelOffset` pasa de colgar de `md` a colgar de `lg`.
- **Gates**: `app/scripts/block19-grid-check.mjs` (nuevo, 35 comprobaciones) y
  `app/scripts/block19-contrast-check.mjs` (reescrito: mide píxeles realmente compuestos).
- **Documentación al mismo contrato**: `02 §D5`, `03 §5`, `04 §5`, `05 §4`, `08` (invariantes
  nuevas + G1/G4), `09` (DD-016 y DDR-01), `docs/BLOCK_19_HANDOFF.md` (deroga sus propios puntos
  1 y 2 de «Regresiones»).
- **Tests**: dos aserciones de `app/src/block18-shell.test.ts` actualizadas citando DD-016.

---

## 5. Qué falta

**Del bloque 19: nada.** DD-016 implementado y verificado, DDR-01 cerrada por DD-017, DDR-02
cerrada con el target principal al nivel del `<article>` y los cinco
gates heredados resueltos (§8). Cuatro defectos reales encontrados y corregidos por el camino.

Pendiente, y que **nadie debe abordar sin instrucción explícita**:

- **B4 — Ficha de lugar y capa fotográfica**: siguiente bloque del roadmap
  (`docs/design/10_ROADMAP_DE_BLOQUES.md` § B4). **No empezado, no empezar.**

## 6. Siguiente acción concreta

**Ninguna acción de implementación pendiente.** El estado está cerrado, verificado y es
recuperable. Quien retome el trabajo debe:

```bash
git fetch origin
git checkout claude/block-19-b3-card-discovery
git reset --hard origin/claude/block-19-b3-card-discovery
cd app && npm ci
```

…ejecutar los gates de §7 para confirmar que sigue verde, y **detenerse ahí a esperar
instrucción**. No abrir B4. No tocar nada de §10.

## 7. Comandos y gates que deben ejecutarse

Todo desde `app/`. Los gates de navegador necesitan un `vite preview` en marcha:

```bash
npm ci
npm run build            # tsc -b && vite build
npm run lint             # oxlint — debe salir sin una sola advertencia
npx vitest run           # 95 ficheros / 3286 tests

npx vite preview --port 4181 --strictPort &   # necesario para los gates de navegador
export NIHON_BASE_URL=http://localhost:4181
```

Gates que **deben** pasar (todos ejecutados en el checkpoint G, con Chromium real):

| Gate | Resultado |
|---|---|
| `node scripts/ddr03-persistence-check.mjs` | **43/43** — las once comprobaciones de DDR-03 en teléfono y escritorio, más los cinco breakpoints |
| `node scripts/block19-grid-check.mjs` | **52/52** — seis viewports, ≥264 px, proporción, raíl ≤50 %, estabilidad del mapa, DDR-02 (fotografía/nombre/razón/chips, con y sin foto, corazón y token independientes, geometría del target, teclado y anillo de foco legible), cero `text-shadow` |
| `node scripts/block19-contrast-check.mjs` | Dentro de contrato — scrim 0,811–0,944; nombre ≥12,78:1; categoría·zona ≥9,15:1 |
| `node scripts/block19-discovery-browser-audit.mjs` | 30/30 |
| `node scripts/b17-regression-check.mjs` | **18/18** |
| `node scripts/b17-tap-target-check.mjs` | **16/16** |
| `node scripts/b17-responsive-check.mjs` | Sin overflow horizontal |
| `node scripts/b18-a11y-check.mjs` | 23/23 |
| `node scripts/b18-browser-back-check.mjs` | 15/15 |
| `node scripts/b18-chrome-check.mjs` | 6/6 |
| `node scripts/b18-regression-check.mjs` | 40/40 |
| `node scripts/b18-responsive-check.mjs` | Sin overflow; `TabBar`/`NavRail` mutuamente exclusivos |
| `node scripts/b18-viaje-lugar-check.mjs` | 38/38 |
| `node scripts/block1-ux-browser-audit.mjs` | **153/153** (tres viewports) |
| `node scripts/block2-photography-browser-audit.mjs` | **69/69** (tres viewports) |
| `node scripts/phase5a-rc-browser-audit.mjs --viewport=desktop` | **50/50** |
| `node scripts/phase5a-rc-browser-audit.mjs --viewport=mobile` | **50/50** |

Los cuatro últimos levantan su propio `vite preview`, así que no necesitan `NIHON_BASE_URL`.

**Nota de entorno.** Los gates nuevos lanzan Chromium con
`executablePath: "/opt/pw-browsers/chromium"`. Los gates antiguos no lo hacen y esperan la
revisión que pide `playwright-core/browsers.json` (1234) mientras el entorno tiene la 1194; en
esta sesión se salvó con enlaces simbólicos **fuera del repositorio**
(`/opt/pw-browsers/chromium-1234`, `/opt/pw-browsers/chromium_headless_shell-1234/...`). Eso **no
está versionado** y hay que rehacerlo en un contenedor nuevo si se quieren correr los gates
antiguos.

---

## 8. Riesgos y hallazgos

### Los cinco gates heredados — RESUELTOS

Los cinco fallaban idénticamente en `b82451a` y ninguno llegaba a ejecutar una sola comprobación.
Requisito a requisito: lo vigente se actualizó al comportamiento actual, priorizando conducta y
semántica sobre selectores internos; lo que el diseño sustituyó a propósito se sustituyó también
en la prueba, nunca se borró sin dejar escrito dónde queda cubierto.

| Gate | Causa del fallo | Requisito original | ¿Vigente? | Acción | Sucesor | Resultado |
|---|---|---|---|---|---|---|
| `b17-regression-check.mjs` | `.view-bar__filters` (barra única de B18) | Las capacidades de v1.1.0 siguen alcanzables (G2) | Sí | Reescrito al shell vigente, por rol y nombre accesible | él mismo | **18/18** |
| `b17-tap-target-check.mjs` | `.app__help` (retirado por B18) | 44×44 reales, con la zona ampliada respondiendo (G5) | Sí | Controles actualizados; `.trip-backup__close` retirado (el control ya no existe); medición de conducta, no de coordenadas | él mismo; el respaldo lo cubre `b17-regression-check` | **16/16** |
| `block1-ux-browser-audit.mjs` | `.interest-badge__label` (`PlaceCard` v2) | Jerarquía y usabilidad medidas en layout real | Sí, salvo dos requisitos | Dos comprobaciones **sustituidas** por decisión congelada: la insignia sólo para grado S (`04 §5.3`/Art. 6) y búsqueda/filtros como hoja a cualquier ancho (`04 §12`/`§13`); una tercera estaba invertida (exigía la letra de grado que `08` prohíbe) | él mismo; el nivel se comprueba ahora en el nombre accesible | **153/153** |
| `block2-photography-browser-audit.mjs` | `.view-bar__filters` | Renditions, bytes, CLS, carrusel, lightbox, atribución | Sí | Camino actualizado; proporción derivada del número de columnas (DD-016) en vez de breakpoints; scroll pedido a `.app__sidebar`, que es quien scrollea | él mismo | **69/69** |
| `phase5a-rc-browser-audit.mjs` | `.selection-panel__toggle` desde Explorar | Cinco recorridos dorados + integridad en runtime | Sí | Ayudantes de navegación reescritos al shell de cuatro destinos; `readSaved`/`seedPlan` al modelo de viajeros (el Bloque 5 dejó `nihon.savedPlaceIds` sin escribir); F01 y F05 reexpresados | él mismo | **50/50** ×2 viewports |

### Cuatro defectos reales que los gates encontraron (todos corregidos)

1. **`.place-card__save--compact` con `position: static`** anulaba el `position: relative` de
   `.tap-target-min`: su `::after` medía 356×88 px y cubría la tarjeta compacta entera. Tocar el
   nombre en los resultados de búsqueda **guardaba** el lugar en vez de abrirlo (`04 §5.9`).
2. **Chips de `FilterSheet` pegados a su `<summary>`**: separación 0 entre dos objetivos táctiles,
   contra los 8 px de `--tap-gap` (`03 §7`).
3. **El botón del título de ciudad medía 88×26 px**. Es el selector de ciudad (`05 §4`), o sea
   navegación, y estaba por debajo de los 44 px de Art. 11.
4. **Las tarjetas sin fotografía no se podían abrir** (`pointer-events: none` mataba el enlace
   estirado) y, en TODAS las tarjetas, ese enlace se encogía al recuadro del texto del nombre
   (271×29 px en una tarjeta de 271×270) porque `.place-card__heading` estaba posicionado. Los
   ~53 lugares sin foto del catálogo eran inalcanzables con el ratón. Ambos vigilados ahora por
   `block19-grid-check.mjs`.

### Trabajo externo revisado en el checkpoint G

**Codex — PR #136, `codex/implementar-decisiones-de-diseno-para-placecard` @ `5028647`: INTEGRADO.**
Partía exactamente de `d52b6b4`, un solo commit, fast-forward limpio. Cierra DDR-02 con la
alternativa (a) ya aprobada: el botón principal pasa a ser hijo directo del `<article>`, cubre la
tarjeta entera y no nace dentro de `.place-card__media`, que conserva su `overflow: hidden`. `04
§5.9`, `08` y `09` quedan reforzados, no debilitados. Correcciones que hubo que hacerle encima
(checkpoint G), todas mecánicas y ninguna de diseño:

1. **Su gate no podía pasar.** Pulsaba con `locator.click()` sobre `.place-card__media`, y
   Playwright lo rechaza porque el botón la cubre — que es el contrato funcionando. Se pulsa
   ahora por coordenadas, que es lo que hace un dedo.
2. **Regresión de foco.** El anillo pasó a abarcar la tarjeta entera conservando
   `--focus-ring-color-on-dark` (blanco) metido 3px hacia dentro: invisible sobre el ~40 % de
   papel de la tarjeta, contra `03 §7` y la puerta G5. Se dibuja por fuera con
   `--focus-ring-color`, que es la forma literal que `03 §7` prescribe para superficie clara.
3. **Geometría mal tolerada.** Exigía coincidencia exacta con la caja de borde; `inset: 0` se
   resuelve contra la caja de relleno, así que el target queda encajado 1px por el borde de la
   tarjeta — correcto y deseable. Ahora se comprueba eso.
4. **Selectores heredados.** Tres comprobaciones leían el nombre del lugar del texto del botón,
   que DDR-02 vació; se leen del `aria-label` y del nombre visible.
5. **Referencia obsoleta.** El handoff citaba `67d9cdb`, un SHA que no existe en el remoto.

**Jules — `astra/night-ui-16277665032912679884-15623783607311441052` @ `ade9ec2`: NO INTEGRADO.**

- **Base incompatible.** Bifurca en `1a11fe8` (2026-09-16), que es el merge-base con `main` y con
  esta rama. Precede a los bloques 16–19 y al congelado del sistema de diseño (`d43735d`,
  2026-09-19): **`docs/design/` no existe en esa rama**. Es la línea «Astra», un rediseño
  paralelo con su propia autoridad (`docs/astra/`) y su propio modelo (`Descubrir`, «Nuestros
  Lugares», «Nuestro viaje»), que el sistema congelado sustituyó.
- **Cero solape.** Ni un fichero coincide: no tiene `PlaceCard.tsx`, ni `AppNav.tsx`, ni
  `styles/discovery.css`, ni `09_DECISIONES_DE_DISENO.md`. Su modelo de datos es
  `nihon.memberInterests.v1` con miembros fijos `fernando`/`lorena` y `tripId: "trip-2027"`;
  el de esta rama es `nihon.travellers.v1` con viajeros renombrables (`02 §D4`).
- **El resumen no coincide con el diff.** Se informó de un banner «across Explorar, Ficha, and
  Nuestro viaje» y «rendered in PlaceDetail». El diff lo renderiza **una sola vez**, en la
  superficie `astra-trip` (`App.tsx:106`); `PlaceDetail.tsx` existe en esa rama y **no fue
  tocado**. Y la frase «Guardados en este dispositivo» **sigue sin condicionar** (`App.tsx:104`),
  justo encima del banner: el estado contradictorio que se decía evitado está exactamente ahí.
- **Además contraviene normativa.** Estilos en línea con hex crudos (`#fef2f2`, `#991b1b`,
  `#f87171`) contra `08` prohibición 6 y `03 §1`; botón «Reintentar guardar» con
  `minHeight: 36px`, por debajo de los 44 px de `03 §7`/Art. 11.
- **Conclusión.** No se descarta la idea —un aviso honesto cuando la persistencia falla es
  valioso y no existe hoy en esta rama— pero no se puede portar código de una arquitectura que
  el sistema congelado reemplazó. Queda como **DDR-03**, abierta, en `09`.

### Otros riesgos anotados

- **`02 §D5` fija un ancho máximo de contenido de 1440 px centrado en `xl`, y no está
  implementado.** Anterior a esta corrección y fuera de alcance. Comprobado que no cambia el
  resultado: a 1600 px la lista da 3 columnas con el tope y sin él.
- **El gate de contraste no encuentra una tarjeta con insignia «★ Imprescindible»** entre las que
  tienen fotografía cargada al medir (informa `insignia ausente`). El suelo de scrim de la banda
  es plano, así que la fila de la insignia recibe el mismo valor; si alguna vez se cambia ese
  suelo por un degradado, hay que revisarlo.
- **Entorno**: los gates antiguos no fijan `executablePath` y esperan la revisión de Chromium que
  pide `playwright-core/browsers.json` (1234) mientras el contenedor tiene la 1194. En esta
  sesión se salvó con enlaces simbólicos **fuera del repositorio**
  (`/opt/pw-browsers/chromium-1234`, `/opt/pw-browsers/chromium_headless_shell-1234/...`). No
  está versionado: hay que rehacerlo en un contenedor nuevo.

## 9. DESIGN DECISION REQUIRED

**Pendientes: ninguna.** DDR-01, DDR-02 y DDR-03 están resueltas.

### DDR-03 — RESUELTA el 2026-09-21: la persistencia no falla en silencio

- **El defecto.** Cada módulo puro envolvía su `setItem` en un `try/catch` que se tragaba el
  error. La persona marcaba lugares, la interfaz confirmaba cada marca, y al cerrar no quedaba
  nada.
- **La auditoría previa.** No hacía falta una capa nueva: **ya existía el punto común**. Los cinco
  escritores (`useTravellers`, `usePlanningDraft`, `useZonePlanChoice`, `usePortableBackup`,
  `useZoneComparison`) pasaban por un adaptador con la misma forma. Ahora comparten
  `lib/device-storage.ts`, que registra el resultado y **vuelve a lanzar**: el camino de datos no
  cambia, y los `try/catch` existentes siguen comportándose igual.
- **`lib/onboarding.ts` queda fuera a propósito**: su clave es una preferencia de interfaz, no un
  cambio del viaje. Avisar de pérdida antes de que haya nada que perder sería un falso positivo.
- **Verificado** por `scripts/ddr03-persistence-check.mjs` (43/43) y
  `src/lib/device-storage.test.ts` (13 casos). Detalle en `09` y `04 §17`.

### DDR-03 — ABIERTA: qué dice Nihon cuando no consigue guardar en el dispositivo

Nihon afirma «Guardados en este dispositivo». Si `localStorage` falla —cuota, modo privado,
almacenamiento bloqueado— hoy **no lo cuenta**: la interfaz confirma cada marca y al volver no
queda nada. Un aviso de error es texto visible nuevo y, si es permanente, un control permanente
nuevo: `08` §«Lo que requiere revisión de diseño» lo reserva a diseño. Hay que decidir si se
avisa y dónde, qué dice en la voz de `03 §10`, con qué frase se sustituye la afirmación falsa,
si hay reintento explícito (y con sus 44 px), y cómo convive con la ficha a pantalla completa de
`05 §5`. Texto completo en `09`. **No se ha portado nada del código de Astra ni se ha inventado
copy.**

### DDR-02 — RESUELTA el 2026-09-21: toda la tarjeta abre el lugar

- **Qué dice la norma.** `04 §5.9`: «toda la tarjeta abre el lugar», sin excepciones.
- **Qué pasaba.** El botón estirado nacía dentro de `.place-card__media`, cuyo recorte impedía
  alcanzar la razón y los chips del cuerpo.
- **Decisión aprobada.** Se adopta (a): el botón principal nace como hijo directo del
  `<article>` y cubre exactamente la tarjeta; el nombre sigue visualmente sobre la fotografía y
  `.place-card__media` conserva `overflow: hidden`. Corazón y token quedan por encima y no abren.
- **Qué cambió.** `PlaceCard.tsx` separa el botón accesible del nombre visual;
  `discovery.css` confina el target al artículo; `block19-grid-check.mjs` vigila las ocho
  conductas aprobadas. `04 §5.9`, `08` y `09` quedan sincronizados.

### DDR-01 — CERRADA el 2026-09-21 por DD-017

- **Qué se planteó.** `05 §5` pedía conservar `panelOffset` en `lg`+ («el panel no oculta el
  marcador seleccionado en el mapa»), lo que presupone un raíl más ancho que la ficha. La
  fórmula de cabida de DD-016 lo fija en exactamente una ficha de ancho.
- **Qué se decidió** (`09` § DD-017, y §3 punto 10 de este fichero). Mapa y ficha son una sola
  región en `lg`/`xl`; la ficha puede cubrir el mapa del todo; se conserva el **estado**
  (centro, zoom, selección), no la visibilidad; `panelOffset` sólo actúa donde mapa y panel se
  ven a la vez; no se fabrica franja residual de mapa.
- **Qué cambió en código.** Nada: `panelCoversMap()` en `PlaceMap.tsx` ya lo implementaba, y
  `block19-grid-check.mjs` ya lo verificaba sobre el ciclo completo. Cambiaron `05 §5`, `08`
  (invariantes 6 y 6.b), `09` y los comentarios que citaban la decisión como pendiente.

> Si durante la implementación aparece algo que exija una decisión de diseño nueva, **no se
> improvisa**: se documenta aquí y en `09`, y se continúa sólo con lo que no dependa de ella.

## 10. Lo que un agente sustituto NO puede cambiar

Claude es la autoridad de diseño, UX y arquitectura. Un agente de implementación (Jules, Codex u
otro) **no tiene autoridad** para:

1. Cambiar UX o UI.
2. Alterar la arquitectura — en particular, nada de lo congelado en §3.
3. Modificar decisiones congeladas (`09` DD-001…DD-016) ni los documentos normativos de
   `docs/design/`.
4. Crear tokens nuevos en `app/src/styles/tokens.css` ni reglas de diseño nuevas.
5. Resolver un DESIGN DECISION REQUIRED (§9).
6. Empezar el siguiente bloque (B4) ni ningún otro.
7. Desactivar, relajar o saltarse un gate para poner algo en verde.
8. Cambiar de rama o abrir una nueva.
9. **Tomar la línea Astra como referencia.** Ver el cuadro de abajo — es una prohibición dura.

### Qué línea de producto es autoritativa (guardrail Astra)

| Línea | Ramas | Documentos | Estatus |
|---|---|---|---|
| **Nihon** | `claude/*` | `docs/design/` | **Autoritativa.** Es la que manda. |
| **Astra** | `astra/*` | `docs/astra/` | Experimento paralelo. **No es fuente de verdad** para esta línea. |

- **Ninguna rama `astra/*` sirve de base.** No se parte de ella, no se rebasea contra ella y no se
  cherry-pickea código desde ella hacia `claude/*`.
- **Ninguna discrepancia se resuelve a favor de Astra** sin instrucción explícita: si `docs/astra/`
  y `docs/design/` dicen cosas distintas, gana `docs/design/`.
- **El trabajo de Astra NO se borra, ni se archiva, ni se modifica.** Es un experimento legítimo,
  con su propia historia y su propia autoría. Lo único que se evita es que vuelva a confundirse
  con esta línea.
- **Cómo reconocerla de un vistazo:** una rama Astra **no contiene `docs/design/`** (bifurca de
  `1a11fe8`, anterior al congelado del sistema) y su código vive en `app/src/astra/`. Si estás en
  un árbol sin `docs/design/`, no estás en esta línea.

Esto no es teórico: en el checkpoint G se revisó un trabajo completo y correcto en su intención
—un aviso de fallo de persistencia— que no se pudo integrar porque estaba construido sobre Astra.
La idea se recuperó como DDR-03 y se implementó de cero en esta línea; el código no se portó.
Versión normativa completa en `08` §«Líneas de producto».

Si durante la implementación aparece algo que exige una decisión de diseño nueva, **no se
improvisa**: se documenta como `DESIGN DECISION REQUIRED` en
`docs/design/09_DECISIONES_DE_DISENO.md` y en §9 de este fichero, y se continúa sólo con las
partes que no dependan de esa decisión.

---

## 11. Protocolo de continuidad (obligatorio)

1. No acumular trabajo sin guardar. Cada bloque largo se parte en **checkpoints lógicos**.
2. En cada checkpoint estable, en este orden: **verificaciones mínimas → commit → push a la rama
   actual**.
3. **Ningún checkpoint puede dejar el código deliberadamente roto.** Cada estado empujado tiene
   que ser coherente y recuperable.
4. Mantener el working tree limpio con frecuencia. Nada importante debe quedarse sólo en local.
5. **Actualizar este fichero y empujarlo en cada checkpoint importante**, no sólo al final.
6. Antes de una operación larga o una modificación amplia, crear primero un checkpoint estable.

**Verificaciones mínimas de un checkpoint** (lo que hay que pasar antes de cada commit):

```bash
cd app && npm run build && npm run lint && npx vitest run
```

Y, si el checkpoint toca superficies con gate de navegador, el gate correspondiente de §7.
