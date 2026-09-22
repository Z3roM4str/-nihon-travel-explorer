# Handoff reanudable — estado actual del trabajo

> **Este fichero es la única fuente de verdad para retomar el trabajo.** Se actualiza y se
> empuja en cada checkpoint estable, no sólo al cerrar un bloque. Si una sesión se corta, otro
> agente debe poder continuar usando exclusivamente: la rama remota, el último SHA pusheado,
> este fichero y los documentos normativos de `docs/design/`.

**Última actualización:** 2026-09-21 · **B21 ABIERTO — checkpoint A** (preflight,
baseline, inventario y auditoría DD-003/DD-004; todavía sin cambios de UI)

---

## 1. Dónde estamos

| | |
|---|---|
| **Bloque actual** | **Bloque 21 (B5 — Explorar: portada y mapa), ABIERTO en checkpoint A.** Preflight, baseline, inventario y auditorías DD-003/DD-004 completos. No se ha implementado UI de B21. |
| **Rama** | `codex/block-21-b5-explore-home-map` |
| **Último SHA estable pusheado** | El HEAD de `origin/codex/block-21-b5-explore-home-map` después de empujar este checkpoint. La rama remota, no un SHA copiado dentro de este mismo commit, es la fuente de verdad reanudable. |
| **Último SHA con cambio de producto** | `b051606` dentro de la historia cerrada de B20; B21 todavía no contiene cambios de producto. |
| **SHA de partida del bloque** | `e3fca24a362efcfa99bd141599972944c0fabb99` — cierre documental de B20. Verificado como ancestro y HEAD inicial exacto. |
| **Estado del working tree** | El diff rastreado del checkpoint es sólo documentación. Persisten dos directorios no rastreados preexistentes y ajenos (`phase3b2b-run-audit/`, `worktree/`), conservados intactos. |
| **Estado de la suite** | Build/lint verdes; gates de navegador B17–B20, DDR-03, Explorar y fotografía verdes. Vitest: 3299/3313 por 14 fallos heredados de paths/CRLF en Windows, documentados en `BLOCK_21_INVENTORY.md §8.1`. |
| **Siguiente acción** | Diseño/producto debe cerrar DDR-B21-01…06. Después, checkpoint B puede implementar sólo las partes desbloqueadas de la portada, sin elegir proveedor/copy/navegación por cuenta propia. |
| **Bloque anterior** | Bloque 20 (B4), **CERRADO** en `e3fca24a362efcfa99bd141599972944c0fabb99`. B6.1 sigue separado en PR #138 y no se integra todavía. |

> Este cuadro se actualiza en cada checkpoint. Para retomar, lo que manda es el HEAD de la rama
> remota B21. No usar `main`, la rama B6.1 ni ninguna rama `astra/*`.

### 1.A Checkpoint A de B21

**Hecho**

- Rama corregida: al iniciar, el nombre B21 apuntaba indebidamente al SHA de B6.1 (`e6693a4`).
  Se hizo detach en `e3fca24…`, se recreó `codex/block-21-b5-explore-home-map` desde esa base y
  se verificó `merge-base --is-ancestor` con resultado 0. La rama B6.1 no se modificó.
- Leídos completos los diez documentos obligatorios del prompt B21.
- Creado `docs/BLOCK_21_INVENTORY.md`: Explorar nacional, mapa nacional, mapa de ciudad,
  derivación de las cuatro colecciones, matriz capacidad → destino → gate y baseline.
- DD-004 está firme e implementable literalmente. DD-003 sigue provisional y su elección
  concreta queda bloqueada.
- Baseline de navegador ejecutada con Edge real. Resultados exactos en el inventario §8.
- B6.1/PR #138 no se integró; no se tocó el pipeline fotográfico.

**Falta**

- Toda implementación de portada, mapa nacional y mapa de ciudad.
- Gates B21 nuevos, revisión visual y checkpoints B–E.
- La prueba temporal de integración con B6.1, que sólo procede tras un SHA técnico estable de
  B21 y una instrucción posterior.

**DESIGN DECISION REQUIRED**

1. **DDR-B21-01:** CARTO Positron u OSM filtrado (DD-003).
2. **DDR-B21-02:** `05 §2` exige «Cobertura inicial», pero `00` Art. 7 prohíbe «cobertura» visible.
3. **DDR-B21-03:** `05 §2` dice 6 prefecturas con lugares; el dataset deriva 15.
4. **DDR-B21-04:** faltan las cuatro líneas editoriales obligatorias de las colecciones.
5. **DDR-B21-05:** «Buscar en todo Japón» no tiene contrato de resultados/navegación/back.
6. **DDR-B21-06:** no existe metadato aprobado para los nombres japoneses de los hubs.

Cada pregunta, opciones, documentos, impacto y alcance bloqueante están en
`docs/BLOCK_21_INVENTORY.md §7`. Ninguna autoriza improvisar. Las partes independientes podrán
continuar cuando se abra el siguiente checkpoint.

---

## 2. Objetivo exacto del trabajo en curso

**Bloque 20 (B4) — Ficha de lugar y capa fotográfica.** Alcance normativo en `05 §5`, `04 §6`/`§7`
y `10 §B4`: reordenación completa de `PlaceDetail`, galería a sangre 4:5 con `scroll-snap`,
contador y puntos según cantidad real de imágenes, `CreditsSheet` tras `ⓘ`, `EvidenceMark` en datos
prácticos, aviso feb–mar 2027 condicional (DD-011), «Por qué vale la pena» con `--type-quote` y
filete bermellón, franja de los dos condicional, «Cerca de aquí» con miniaturas, y «Fuentes»
plegada.

**El contrato que manda sobre todo lo demás: ningún dato desaparece.** El inventario completo y la
matriz campo→destino están en **`docs/BLOCK_20_INVENTORY.md`**, escrita antes de tocar código. Es
el guardián: si al terminar hay una fila sin destino verificado, B4 no está cerrado.

**Las tres contradicciones normativas están CERRADAS** (§9): DDR-04, DDR-05 y DDR-06 se
resolvieron el 2026-09-21, las tres por la opción (a). Nada del alcance queda bloqueado.

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
9. **Ningún token nuevo *para resolver el suelo de scrim de `PlaceCard`*.** La banda reutiliza el
   valor que `--scrim-bottom` ya declara en su parada inferior, en vez de inventar un token de
   scrim propio. **Alcance (aclarado en el cierre de B20):** esto es una decisión sobre CÓMO se
   resuelve ese problema concreto —no fabricar un valor nuevo cuando el sistema ya tiene el
   correcto—, **no una prohibición global** de que un bloque posterior dé nombre en `tokens.css`
   a un valor que `03`/`04` ya prescriben literalmente. Lo contrario chocaría con Art. 10, que
   exige justo eso: que ningún componente escriba un color como literal. La prueba está en el
   propio fichero, que ya nombraba `--scrim-page` (`04 §8`) y `--pattern-diagonal` (`04 §9`) por
   esa misma razón y bajo esta misma decisión. Lo que sigue prohibido, sin matices, es **un valor
   nuevo**: un color, tamaño, radio, sombra, duración o easing que ningún documento normativo
   haya fijado (`08` §«Lo que requiere revisión de diseño»).
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
    ninguna superficie afirma que los cambios quedaron guardados. Dos precisiones aprobadas el
    2026-09-21, ya implementadas: **(a)** el aviso aparece con el primer fallo real, incluido el de
    la escritura de arranque, sin esperar al primer gesto; **(b)** queda por debajo de `Sheet` y de
    cualquier superficie modal enfocada y reaparece al cerrarlas, pero **sigue por encima de
    `PlaceDetail`**, incluido su modo a pantalla completa.

---

## 4. Qué está terminado

**De B20:** el preflight, la relectura normativa, el **inventario completo de `PlaceDetail`
v1.1.0** con su matriz campo→destino (`docs/BLOCK_20_INVENTORY.md`, 55 filas), el cierre de
DDR-04/05/06 **antes** de tocar código, y **los ocho pasos del plan**:

1. **Galería** — pista con `scroll-snap`, 4:5 en teléfono y 4:3 en `md`+, índice derivado del
   scroll, flechas sólo `md`+, puntos sólo con ≤5, contador como píldora, sin skeleton gris.
2. **`CreditsSheet`** — los seis campos de atribución salen del flujo (D2) y viven tras el `ⓘ`,
   etiquetados uno a uno y por cada imagen; pie hacia Nosotros › Fuentes y licencias.
3. **Cabecera y acciones** — nombre `--type-display`, japonés debajo, una línea de
   categoría·barrio con un solo `·`, insignia sólo grado S, primario a ancho completo con «Ya lo
   quieres ver» y «No me interesa» en `quiet` a su lado, botón atrás flotante único (D4).
4. **Cuerpo editorial** — «Por qué vale la pena» en `--type-quote`/`--font-voice` con filete
   bermellón de 2 px, «Qué es», «Qué se hace o se ve», y la franja de los dos condicional (D8).
5. **Datos prácticos** — rejilla de 2 columnas más filas, cada valor con `EvidenceMark ◧`,
   títulos en caja de frase, «Aglomeración» → «Afluencia» y «Turismo» con fila propia.
6. **Aviso feb–mar 2027** — condicional (DD-011), y su degradación a línea de «Horario» con `◧`.
7. **«Cerca de aquí»** — carrusel de `PlaceCard compact` con miniatura, sin nota al pie, con la
   semántica de la nota trasladada al `detail` del marcador de cada traslado (DDR-06).
8. **«Fuentes»** — plegada, con grado original, nivel en lenguaje llano, fecha de actualización
   del registro y enlaces. Nada inventado (DDR-04).

**Verificación del bloque:** `vite build`, `oxlint` sin advertencias, **96 ficheros / 3313
tests**, y los gates de navegador de §7 con Chromium real.

**De B19 (cerrado, en su propia rama):** ver `docs/BLOCK_19_HANDOFF.md`.

---

## 5. Qué falta

**De B20, nada del alcance de `05 §5`.** Los ocho pasos están hechos y las 55 filas cerradas
(`docs/BLOCK_20_INVENTORY.md` §2.c). Lo que queda son revisiones y bloques posteriores, que **no
se empiezan**.

**Las siete auditorías heredadas ya no son deuda: están reparadas y verdes** (§8). Lo que queda
anotado, y sigue fuera del alcance de este bloque:

- **`02 §D5` fija 1440 px de ancho máximo de contenido en `xl` y sigue sin implementarse.**
  Anterior a este bloque; comprobado que no cambia el resultado de la rejilla.
- **El buscador de ciudad no dice nunca qué hace.** `App.tsx` pinta
  `filters.query.trim() || "Buscar en {ciudad}"`, así que en cuanto hay una consulta activa el
  **nombre accesible** del control pasa a ser lo que el lector escribió, y deja de nombrar su
  acción. No viola ninguna norma —`04 §4` sólo exige `aria-label` a los botones de icono sin
  texto—, así que no abre DDR; pero es la superficie de Explorar (`05 §4`), no la ficha, y
  arreglarlo aquí sería cambiar producción para satisfacer un gate. Anotado para quien tome esa
  superficie. Mientras tanto, `lib/shell-navigation.mjs` lo localiza por la clase del componente
  que `04 §12` nombra, con el motivo escrito al lado.

---

## 6. Siguiente acción concreta

**Ninguna dentro de B20: el bloque está cerrado.** Implementación, revisión y saneamiento hechos
y verificados. Lo que sigue es **abrir el bloque que el roadmap (`10`) ponga a continuación**, con
su propio preflight, su propio inventario si procede y su propia rama. **Nada de esta rama lo
adelanta.**

El orden en que se implementó B20, por si hay que auditarlo paso a paso:

1. **Galería** (`04 §6`): 4:5 a sangre, `scroll-snap`, flechas sólo `md`+, puntos sólo con ≤5,
   contador como píldora. Gate de geometría y de «una imagen ⇒ sin puntos, contador ni flechas».
2. **`CreditsSheet`** (`04 §7`): sacar `<Attribution>` del flujo —hoy se renderiza justo entre la
   fotografía y el cuerpo, que es el defecto D2— y llevarlo íntegro tras `ⓘ`. Gate: cero texto de
   atribución entre foto y nombre; los seis campos siguen presentes dentro de la hoja.
3. **Cabecera y acciones**: nombre `--type-display`, línea única categoría·barrio, insignia sólo
   grado S, primario + `quiet` juntos, botón atrás flotante y retirada del `×` (D4).
4. **Cuerpo editorial**: «Por qué vale la pena» con `--type-quote` y filete, «Qué es», «Qué se hace
   o se ve», franja de los dos condicional (D8).
5. **Datos prácticos**: rejilla 2 columnas + filas, cada valor con `EvidenceMark`, títulos en caja
   de frase, «Aglomeración» → «Afluencia».
6. **Aviso feb–mar 2027** condicional (DD-011) y su degradación a línea de «Horario» con `◧`.
7. **«Cerca de aquí»** con `PlaceCard compact` y miniaturas.
8. **«Fuentes»** plegada — grado original, `updatedAt` y enlaces; nada inventado (DDR-04).

Cada paso: verificación → commit → push → actualizar este fichero.

## 7. Comandos y gates que deben ejecutarse

Todo desde `app/`. Los gates de navegador necesitan un `vite preview` en marcha:

```bash
npm ci
npm run build            # tsc -b && vite build
npm run lint             # oxlint — debe salir sin una sola advertencia
npx vitest run           # 96 ficheros / 3313 tests

npx vite preview --port 4181 --strictPort &   # necesario para los gates de navegador
export NIHON_BASE_URL=http://localhost:4181
```

Gates que **deben** pasar (todos reejecutados en el cierre de B20, con Chromium real):

| Gate | Resultado |
|---|---|
| `node scripts/block20-place-detail-check.mjs` | **73/73** — teléfono y escritorio: D2/D3/D4/D8, galería por cantidad de imágenes, solape del cuerpo, marcador en cada valor práctico, caja de frase, «Fuentes» plegada sin procedencia inventada, `Dato:` ausente, la letra de grado sólo en «Fuentes», y «Cerca de aquí» sin nota al pie con la distinción de cada traslado legible por lector de pantalla |
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
| `node scripts/block2-photography-browser-audit.mjs` | **81/81** (tres viewports) — B20 le añadió el `ⓘ`, `CreditsSheet` y la ausencia de atribución en el flujo |
| `node scripts/phase5a-rc-browser-audit.mjs --viewport=desktop` | **50/50** |
| `node scripts/phase5a-rc-browser-audit.mjs --viewport=mobile` | **50/50** |
| `node scripts/block5-travellers-browser-audit.mjs` | **231/231** (tres viewports) — reparada en el cierre de B20 |
| `node scripts/phase4c-browser-audit.mjs` | **PASS** — reparada en el cierre de B20 |
| `node scripts/phase4d-browser-audit.mjs` | **PASS** — ídem |
| `node scripts/phase4f-browser-audit.mjs` | **PASS** — ídem |
| `node scripts/phase4h-browser-audit.mjs` | **PASS** — ídem |
| `node scripts/phase4j-browser-audit.mjs` | **PASS** — ídem |
| `node scripts/phase4l-browser-audit.mjs` | **PASS** — ídem |

Los cuatro últimos levantan su propio `vite preview`, así que no necesitan `NIHON_BASE_URL`.

**Actualizado en el cierre de B20:** `block2-photography-browser-audit` pasa de 69 a **81**
comprobaciones (el `ⓘ` y `CreditsSheet` añaden las suyas), `block20-place-detail-check.mjs` es
nuevo, y las **siete auditorías heredadas entran en esta tabla por primera vez**, reparadas y en
verde (§8). Las seis `phase4*` levantan su propio servidor de Vite, así que tampoco necesitan
`NIHON_BASE_URL`.

**Nota de entorno.** Los gates nuevos lanzan Chromium con
`executablePath: "/opt/pw-browsers/chromium"`. Los gates antiguos no lo hacen y esperan la
revisión que pide `playwright-core/browsers.json` (1234) mientras el entorno tiene la 1194. Hay
que rehacer los enlaces simbólicos **fuera del repositorio** en cada contenedor nuevo; los
exactos que funcionan:

```bash
ln -sfn /opt/pw-browsers/chromium-1194 /opt/pw-browsers/chromium-1234
mkdir -p /opt/pw-browsers/chromium_headless_shell-1234
ln -sfn /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux \
        /opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64
ln -sfn headless_shell \
        /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/chrome-headless-shell
```

Eso **no está versionado** a propósito: toca `/opt`, no el repositorio.

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
| `block2-photography-browser-audit.mjs` | `.view-bar__filters` | Renditions, bytes, CLS, carrusel, lightbox, atribución | Sí | Camino actualizado; proporción derivada del número de columnas (DD-016) en vez de breakpoints; scroll pedido a `.app__sidebar`, que es quien scrollea | él mismo | **69/69** en B19; **81/81** tras la ampliación de B20 |
| `phase5a-rc-browser-audit.mjs` | `.selection-panel__toggle` desde Explorar | Cinco recorridos dorados + integridad en runtime | Sí | Ayudantes de navegación reescritos al shell de cuatro destinos; `readSaved`/`seedPlan` al modelo de viajeros (el Bloque 5 dejó `nihon.savedPlaceIds` sin escribir); F01 y F05 reexpresados | él mismo | **50/50** ×2 viewports |

### Las siete auditorías heredadas — RESUELTAS en el cierre de B20

Mismo método que «los cinco gates heredados» de B19, y por la misma razón: siete auditorías que
**no llegaban a ejecutar una sola comprobación** porque se rompían en la NAVEGACIÓN. No era un
fallo de siete requisitos, era un camino repetido siete veces —«entra a la ciudad, abre este
lugar, cierra la ficha»— que B18 (`05 §2`, cromo de cuatro destinos), B19 (`04 §12`, la búsqueda
como hoja) y B20 (`05 §5`, el `×` de D4) fueron moviendo sin que nadie actualizara las copias.

Ese camino vive ahora en **`app/scripts/lib/shell-navigation.mjs`**, uno solo, por rol y nombre
accesible salvo donde el shell no ofrece un nombre estable —y ahí, por la clase que el documento
normativo nombra, con el motivo escrito al lado—. La próxima vez que el shell se mueva habrá un
sitio que tocar, no siete.

| Gate | Requisito original | Causa del fallo | ¿Vigente? | Acción | Cobertura sucesora | Resultado |
|---|---|---|---|---|---|---|
| `phase4c-browser-audit.mjs` | La fotografía se sirve del build local y nada se pide en runtime; la atribución nombra fuente, autoría, licencia, archivo y reprocesado; el lightbox atrapa el foco y lo devuelve | `getByRole("button", {name: /^Tokio/})` empataba con el atajo de ciudad **y** con la prefectura del navegador de regiones (`05 §2` + `05 §3` coexisten desde B18) | **Sí, entero** | Navegación al camino vigente (atajo de ciudad acotado por rol de región + hoja de búsqueda); la atribución se lee en `CreditsSheet`; el zoom se pide a la diapositiva visible (`04 §6`: una por imagen) | él mismo | **PASS** |
| `phase4d-browser-audit.mjs` | Cada registro adquirido sirve local y acredita su propio archivo y licencia; el registro de marca no afirma ninguna liberación de derechos | `enterHub` + `.place-list__item` + `«Cerrar la ficha de …»` (el `×` que D4 retira) | **Sí, entero** | Navegación compartida; créditos vía `ⓘ`; cierre por el botón atrás flotante | él mismo | **PASS** |
| `phase4f-browser-audit.mjs` | Lote 4F: asset local, atribución completa, y los objetivos fallidos conservan el marcador sin foto | ídem | **Sí, entero** | ídem | él mismo | **PASS** |
| `phase4h-browser-audit.mjs` | Lote 4H, incluido el objetivo de marca y el temporal, que siguen siendo factuales | ídem | **Sí, entero** | ídem | él mismo | **PASS** |
| `phase4j-browser-audit.mjs` | Lote 4J, cinco objetivos y su *fallback* | ídem, más el nombre del lugar anclado a la cadena exacta del catálogo | **Sí, entero** | ídem; el nombre se ancla al PRINCIPIO del nombre accesible, no a la cadena completa — las auditorías nombran «Tokyo Marathon», el dataset guarda «Tokyo Marathon 2027» | él mismo | **PASS** |
| `phase4l-browser-audit.mjs` | Lote 4L, más la comprobación de que cada imagen afirmada decodifica de verdad | ídem | **Sí, entero** | ídem | él mismo | **PASS** |
| `block5-travellers-browser-audit.mjs` | La capa de dos personas desaparece cuando no tiene nada que decir; guardar sigue siendo un toque sin selector de persona; los dos lectores ven el mismo estado desde su lado; un rechazo explícito nunca borra lo que la otra quiere; un paso destructivo dice su coste antes | `.traveller-bar__option` en la cabecera (DD-007 lo movió a Nosotros); `.place-card__interest` (B19 lo sustituyó por `PersonToken`); `.selection-panel__count` y «Construir recorrido» (B18 llevó «Quiero ir» a su propia pestaña); el `×` de la ficha (D4) | **Sí**, salvo dos comprobaciones | Navegación por rol y nombre accesible; el cambio de persona se hace por donde el lector lo hace ahora (cabecera → Nosotros › Viajeros); el marcador se lee del `aria-label` del `PersonToken`; el recuento, del contador de la pestaña (`04 §10`). **Dos sustituidas**: «el gestor abre como diálogo etiquetado» → *es una sección etiquetada de Nosotros* (B18 lo embebió: un modal menos), y «`Escape` cierra el gestor» → *`Escape` no lo desmonta ni navega a otro sitio*, porque una sección embebida no tiene nada que cerrar | él mismo; la salida por teclado del shell la cubre `b18-a11y-check` (23/23) | **231/231** |

**Un hallazgo real, corregido.** `block5-travellers` «pasaba» sus comprobaciones de la lista
compartida sin navegar a «Quiero ir»: leía el panel con `innerText` mientras estaba oculto, y en
Chromium `innerText` sobre un elemento no renderizado cae a `textContent`. Ahora abre la pestaña,
así que las mismas aserciones miden la superficie **visible**. Es más estricto que antes, no menos.

**Ninguna reparación tocó producción para satisfacer un selector.** Los dos únicos cambios de
producto del checkpoint salen de la revisión de tokens (abajo), no de un gate.

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

### Revisión de los tres `--overlay-*` (Art. 10)

Pedida en el cierre. Resultado: **dos se quedan, uno se retira.**

| Token | ¿Lo prescribe el sistema? | Resultado |
|---|---|---|
| `--overlay-ink: rgba(20,22,26,.55)` | **Sí, literal.** `04 §6`: «píldora `1/3` abajo-derecha, `--type-num`, fondo `rgba(20,22,26,.55)`» | Se queda. Es centralización pura: Art. 10 prohíbe que un componente escriba un color como literal, así que nombrarlo es lo correcto |
| `--overlay-paper: rgba(255,255,255,.92)` | **Sí, literal.** `04 §5.4`: «botón circular 40 px, fondo `rgba(255,255,255,.92)`» | Se queda, por lo mismo |
| `--overlay-paper-soft: rgba(255,255,255,.55)` | **No. Ningún documento fija el color del punto inactivo de la galería** | **Retirado.** No era centralizar un valor del sistema: era estrenar uno |

El punto inactivo se distingue ahora **por forma** —contorno frente a relleno, ambos `--surface`—,
que es lo que `03 §1.4` prescribe para el producto entero («forma y peso, no matiz») y lo que los
puntos ya hacían antes de B20. Cero valores nuevos, y sin necesidad de decisión de diseño: quitar
un valor no autorizado apoyándose en lo que el sistema ya da es cumplimiento, no diseño.

De paso, `.alert__severity` dejó de usar `--overlay-paper` y pasa a `--surface`: no es un control
flotante sobre fotografía, y ese token significa exactamente eso.

Vigilado por `block20-place-detail.test.ts` §«Art. 10», que falla si aparece un tercer
`--overlay-*` o si el punto vuelve a distinguirse por matiz.

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

**Pendientes: ninguna.** DDR-01…DDR-06 están todas resueltas. Las tres que abrió B20 se
cerraron el 2026-09-21, las tres por la opción (a); texto completo en `09`.

### DDR-04 — RESUELTA el 2026-09-21: «Fuentes» sólo muestra evidencia que existe

Se adopta la opción **(a)**. La sección se conserva, plegada por defecto, y sólo puede mostrar
datos realmente presentes y verificables para ese lugar: **grado original**, **`updatedAt`**, el
**enlace oficial** cuando exista y cualquier otro enlace que el contrato ya reconozca como fuente
real. **No se crean ni se derivan** `provenance`, `consultedAt`, frescura por lugar, versión del
dataset ni ninguna etiqueta equivalente inferida desde `updatedAt`. `updatedAt` significa
únicamente **actualización del registro**: no es fecha de consulta y no permite inferir frescura.
**Nada de placeholders** («Procedencia: no disponible») para campos inexistentes. Ampliar el
dataset es trabajo de datos y **no entra en B20**; cuando exista evidencia real, `05 §5` pt. 14
podrá volver a admitir esos campos.

### DDR-05 — RESUELTA el 2026-09-21: `Dato:` sigue siendo de B9.5 fuera de la ficha

Se adopta la opción **(a)**. El criterio de aceptación de B20 queda acotado a la superficie B4:
la cadena `Dato:` **no aparece en `PlaceDetail` ni en ninguna superficie que B20 introduzca**.
**B20 no modifica `OrderedSequenceBuilder.tsx` ni el planificador.** La eliminación global de las
cuatro apariciones actuales **permanece en B9.5**, como ya establece el roadmap. B20 mantiene un
gate que garantiza que no introduce `Dato:` en la ficha; no duplica ese trabajo.

### DDR-06 — RESUELTA el 2026-09-21: el `EvidenceMark` sustituye a la nota al pie

Se adopta la opción **(a)**. En «Cerca de aquí» cada tarjeta compacta lleva su `EvidenceMark`,
`transferListFootnote` **deja de mostrarse** en esta sección y no queda párrafo de descargo que
repita la confianza que ya expresa el marcador.

Pero **ninguna información desaparece**: es una **reubicación**. La semántica que hoy comunica la
nota pasa al `detail` accesible del `EvidenceMark` de **cada** traslado —una ruta validada sigue
diciendo que son datos de ruta validados y **estáticos**, no un horario en vivo; una estimación
geográfica sigue diciendo que es una estimación y **no** una ruta validada; un traslado
*schedule-aware* se distingue explícitamente como tal; y cualquier *fallback* que hoy se presente
legítimamente como estimación geográfica **mantiene esa semántica**—. Se usan la gramática y el
mapeo de evidencia existentes: **ninguna procedencia nueva** y **ningún ascenso a «Verificado»**
fuera de lo que el contrato ya determina. El texto vive en `detail`, `aria-label` y/o `title`; no
se repite como párrafo visible.

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
