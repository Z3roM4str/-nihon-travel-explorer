# Handoff reanudable — estado actual del trabajo

> **Este fichero es la única fuente de verdad para retomar el trabajo.** Se actualiza y se
> empuja en cada checkpoint estable, no sólo al cerrar un bloque. Si una sesión se corta, otro
> agente debe poder continuar usando exclusivamente: la rama remota, el último SHA pusheado,
> este fichero y los documentos normativos de `docs/design/`.

**Última actualización:** 2026-09-21 · checkpoint A (DDR-01 cerrada)

---

## 1. Dónde estamos

| | |
|---|---|
| **Bloque actual** | Bloque 19 (B3 — Tarjeta y descubrimiento) · corrección DD-016 cerrada · **cierre de B19 en curso** |
| **Rama** | `claude/block-19-b3-card-discovery` |
| **Último SHA estable pusheado** | `cc6392e` — `docs: handoff reanudable y protocolo de continuidad por checkpoints` |
| **Último SHA con cambio de producto** | `bb46042` — `fix(block-19): la rejilla … (DD-016)` |
| **SHA de partida del bloque** | `b82451a` — `feat(block-19): implement B3 card and discovery surface` |
| **Estado del working tree** | Limpio. Local y `origin` al mismo SHA. |
| **Estado de la suite** | Verde entera (detalle en §7) |
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

Para cerrar B19 quedan **dos frentes**, ambos encargados y en curso:

1. **~~DDR-01~~ — CERRADA** el 2026-09-21 por **DD-017** (checkpoint A). Ver §9.
2. **Los cinco gates heredados** (§8): por cada uno hay que identificar qué requisito
   protegía, si ese requisito sigue vigente tras B18/B19, y entonces actualizarlo al
   comportamiento actual —priorizando comportamiento y semántica sobre selectores internos
   frágiles— o retirarlo documentando qué prueba lo cubre ahora. **Nunca** se toca código de
   producción para satisfacer una prueba obsoleta, ni se borra una prueba sin justificar qué
   contrato desapareció.

No es de este bloque y nadie debe abordarlo sin instrucción explícita:

- **B4 — Ficha de lugar y capa fotográfica**: siguiente bloque del roadmap
  (`docs/design/10_ROADMAP_DE_BLOQUES.md` § B4). **No empezado, no empezar.**

## 6. Siguiente acción concreta

**Frente 2 de §5: los cinco gates heredados de §8.** Se trabajan de uno en uno o de dos en
dos, cada tanda con su propio checkpoint (verificaciones → commit → push → actualizar este
fichero). Orden sugerido, de menos a más invasivo:

1. `b17-regression-check.mjs` y `block2-photography-browser-audit.mjs` — los dos fallan por el
   mismo motivo (`.view-bar__filters`, sustituido por la barra única de B18).
2. `b17-tap-target-check.mjs` — `.app__help` ya no existe.
3. `block1-ux-browser-audit.mjs` — `.interest-badge__label`: hay que decidir, requisito a
   requisito, cuáles sobreviven a `PlaceCard` v2 y `04 §5.3` (sólo grado S lleva insignia).
4. `phase5a-rc-browser-audit.mjs` — `.selection-panel__toggle`.

Después: la verificación final completa de §7 y el cierre de B19.

Para arrancar desde cero:

```bash
git fetch origin
git checkout claude/block-19-b3-card-discovery
git reset --hard origin/claude/block-19-b3-card-discovery
cd app && npm ci
```

## 7. Comandos y gates que deben ejecutarse

Todo desde `app/`. Los gates de navegador necesitan un `vite preview` en marcha:

```bash
npm ci
npm run build            # tsc -b && vite build
npm run lint             # oxlint — debe salir sin una sola advertencia
npx vitest run           # 94 ficheros / 3272 tests

npx vite preview --port 4181 --strictPort &   # necesario para los gates de navegador
export NIHON_BASE_URL=http://localhost:4181
```

Gates que **deben** pasar (último resultado conocido, en `bb46042`):

| Gate | Resultado |
|---|---|
| `node scripts/block19-grid-check.mjs` | 35/35 — los seis viewports, ≥264 px, proporción, raíl ≤50 %, mapa estable, cero `text-shadow` |
| `node scripts/block19-contrast-check.mjs` | Dentro de contrato — scrim 0,811–0,944; nombre ≥12,78:1; categoría·zona ≥9,15:1 |
| `node scripts/block19-discovery-browser-audit.mjs` | 30/30 |
| `node scripts/b18-a11y-check.mjs` | 23/23 |
| `node scripts/b18-browser-back-check.mjs` | 15/15 |
| `node scripts/b18-chrome-check.mjs` | 6/6 |
| `node scripts/b18-regression-check.mjs` | 40/40 |
| `node scripts/b18-viaje-lugar-check.mjs` | 38/38 |
| `node scripts/b18-responsive-check.mjs` | Sin overflow horizontal; `TabBar`/`NavRail` mutuamente exclusivos |
| `node scripts/b17-responsive-check.mjs` | Sin overflow horizontal |

**Nota de entorno.** Los gates nuevos lanzan Chromium con
`executablePath: "/opt/pw-browsers/chromium"`. Los gates antiguos no lo hacen y esperan la
revisión que pide `playwright-core/browsers.json` (1234) mientras el entorno tiene la 1194; en
esta sesión se salvó con enlaces simbólicos **fuera del repositorio**
(`/opt/pw-browsers/chromium-1234`, `/opt/pw-browsers/chromium_headless_shell-1234/...`). Eso **no
está versionado** y hay que rehacerlo en un contenedor nuevo si se quieren correr los gates
antiguos.

---

## 8. Riesgos y hallazgos

**Cinco gates antiguos fallan idénticamente en `b82451a` (SHA de partida) y en `bb46042`.** No son
regresiones de esta corrección; esperan marcado que B18/B19 ya habían sustituido. Comprobado
construyendo `b82451a` en un worktree aparte y corriendo cada gate contra los dos builds:

| Gate | Espera | Roto desde |
|---|---|---|
| `b17-regression-check.mjs` | `.view-bar__filters` | B18 (la barra única lo sustituyó) |
| `b17-tap-target-check.mjs` | `.app__help` | Antes de B19 (el elemento no existe) |
| `block1-ux-browser-audit.mjs` | `.interest-badge__label` en `.place-card` | B19 (`PlaceCard` v2) |
| `block2-photography-browser-audit.mjs` | `.view-bar__filters` | B18 |
| `phase5a-rc-browser-audit.mjs` | `.selection-panel__toggle` | Antes de B19 |

Otros riesgos anotados:

- **`02 §D5` fija un ancho máximo de contenido de 1440 px centrado en `xl`, y no está
  implementado.** Es anterior a esta corrección y queda fuera de alcance. Comprobado que no
  cambia el resultado: a 1600 px la lista da 3 columnas con el tope de 1440 px y sin él.
- **El gate de contraste no ha encontrado una tarjeta con insignia «★ Imprescindible»** entre las
  que tienen fotografía cargada en el momento de medir (informa `insignia ausente`). El suelo de
  scrim de la banda es plano, así que la fila de la insignia recibe el mismo valor que el resto;
  aun así, si alguna vez se cambia ese suelo por un degradado, hay que revisar este punto.

---

## 9. DESIGN DECISION REQUIRED

**Pendientes: ninguna.**

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
