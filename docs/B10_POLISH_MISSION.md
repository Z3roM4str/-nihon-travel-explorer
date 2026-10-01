# B10 — Pulido · misión, matrices y decisiones

Rama `claude/b10-pulido`, creada desde el main POST-MERGE certificado `2a10ad3f11cd91a7d739e85307f04da9411bf5d1`
(merge de #178 = D0b + D5 sobre B27–B31; tree `9a5953a0bd1aaa6f2002b6b661e31aab233b3aad`). **No se mezcla con la reconciliación, no se
fusiona en esta misión.** El número de bloque no se asigna por inferencia: el roadmap lo llama «B10 — Pulido».

Objetivos canónicos (`10_ROADMAP_DE_BLOQUES.md`): (1) auditoría de movimiento, (2) accesibilidad completa por pantalla,
(3) presupuesto de rendimiento y de bytes de imagen por ciudad, (4) erradicación de `App.css`, (5) microcopy contra `03 §10`,
(6) **OD-01 — modo oscuro: pendiente de Producto, NO resuelto, NO implementado** (`09`: «Quién puede cerrarla: Producto»).

Reglas respetadas: sin datasets (`data/`, `app/src/data/` intactos), sin fotografías nuevas, sin Astra, sin Vercel, sin lógica
matemática/logística/reservas/ranking/persistencia, sin debilitar gates, sin force-push/squash/rebase.

---

## 1. Movimiento (B10.1) — gate `app/scripts/b10-motion-check.mjs`

**Los cinco movimientos nombrados** (`03 §6`): ① `sheet-rise` (hoja inferior, `--dur-sheet` 320 ms / `--ease-enter`), ② `push` (ficha desde la
derecha, `--dur-base`), ③ `cross-fade` (lista ↔ mapa, `--dur-fast`), ④ `press` (`scale(.98)` pulsado, `--dur-fast`), ⑤ `mark` (corazón 1 → 1,18 → 1,
`--dur-base`; único momento celebratorio). Prohibido: entradas escalonadas al scroll, **transiciones de hover en todas las tarjetas**,
parallax, movimiento no disparado salvo el skeleton. `prefers-reduced-motion: reduce` → ≤ 100 ms.

### Inventario (CSS + JS) y veredicto

| Movimiento encontrado | Dónde | Clasificación | Acción |
|---|---|---|---|
| `sheet-rise` 320 ms | `Sheet.css` | ① nombrado | conforme |
| `press` `scale(.98)` / 140 ms | `.button`, `.icon-button` | ④ nombrado | conforme |
| `press` del corazón: `scale(.92)`, sin transición | `.place-card__save:active` | ④ **con valor incorrecto** | **corregido** → `scale(.98)` + transición de `transform` a `--dur-fast` |
| `mark` 0,6 → 1,22 → 1 | `place-card-save-mark` | ⑤ **con valores incorrectos** | **corregido** → 1 → 1,18 → 1, 220 ms |
| `transition: box-shadow, border-color` + `:hover` en tarjetas de Explorar (`city-card`, `more-card`, `map-card`) | `discovery.css` | **prohibido** («transiciones de hover en todas las tarjetas») | **corregido**: transiciones retiradas (el estado :hover cambia al instante) |
| `behavior: "smooth"` en la galería (flechas) | `PlaceGallery.tsx` | movimiento programático **sin respetar reduced-motion** (el `scroll-behavior:auto !important` global no gobierna el `behavior` explícito de JS) | **corregido**: `reduced ? "auto" : "smooth"` |
| `card-shimmer` infinito | `.place-card__skeleton` | skeleton de carga (permitido) | conforme (único bucle; verificado) |
| `toast-in` 0,2 s `ease-out`, `translateY(8px)` | `SaveToast.css` | no es un movimiento nombrado, duración/curva fuera de tokens | **DDR B10-M1** |
| `onboarding-fade` 0,18 s | `Onboarding.css` | no nombrado | **DDR B10-M2** |
| giro del chevron de plegado (`transform` 140 ms) | `.filter-group__chevron` | no nombrado | **DDR B10-M3** |
| `box-shadow`/`border-color` 220 ms en foco | `.place-card` | no nombrado (foco, no hover) | **DDR B10-M4** |
| fundido de carga de imagen (`opacity` 220 ms) | `.place-card__image` | ¿`cross-fade`? | **DDR B10-M5** |
| `height` 220 ms de la hoja del mapa nacional | `.national__sheet` | no nombrado | **DDR B10-M6** |
| `push` y `cross-fade` | — | **no implementados** (la ficha y el cambio lista/mapa son instantáneos) | no es infracción; si Producto los quiere, B10-M7 |
| `flyTo`/`panBy`/`flyToBounds` de Leaflet | `PlaceMap`, `NationalMap` | movimiento programático del mapa; ya guardado por `prefers-reduced-motion` / `canAnimate` | conforme (verificado estáticamente) |
| auto-scroll del arrastre (rAF), arrastre fantasma | `OrderedSequenceBuilder` | disparados por la persona; sin animación CSS | conforme |
| Toast, Sheet, PlaceDetail | — | Sheet = ①; Toast = B10-M1; PlaceDetail sin movimiento | ver arriba |

**DDR B10-M1…M6** (DESIGN DECISION REQUIRED): cada movimiento no nombrado admite dos salidas legítimas (retirarlo, o mapearlo a un
movimiento nombrado — p. ej. toast/onboarding → `cross-fade` a `--dur-fast`). Elegir es decisión estética nueva; **no se inventa**. El gate
fija el inventario exacto (trinquete): cualquier `@keyframes`/`transition`/`animation` nuevo falla.

El gate (Chromium y WebKit) comprueba además en navegador, con y sin `reducedMotion`: `sheet-rise` = 320 ms (≤ 100 ms reducido), `mark` = 220 ms,
ninguna animación infinita viva fuera del skeleton, el onboarding sin fundido reducido, y que la galería salta instantáneamente en reduced-motion
(descubrió el defecto de la galería: contra el código anterior falla).

## 2. Accesibilidad (B10.2) — gate `app/scripts/b10-a11y-check.mjs`

Medición programática de DOM y estilos computados en Chromium y WebKit (390×844 y 1200×900), pantalla por pantalla: portada, ciudad, filtros (hoja),
mapa, ficha, créditos, lightbox, Quiero ir, Nosotros, Viaje › Días / mover parada / Probar otro orden / Dónde dormir / Reservas / Resumen, onboarding,
estados vacíos, toast. **No se afirma equivalencia con VoiceOver/TalkBack ni con iPhone físico: no se midió.**

| Criterio | Resultado |
|---|---|
| Nombre accesible de todo control visible; ids duplicados; `aria-labelledby/describedby/controls` rotos; enfocables en `aria-hidden`; `img` sin `alt`; `lang`/`title` | **0 hallazgos** en las 13 pantallas × 2 anchos |
| Modalidad: `Sheet`, ficha, lightbox, onboarding → `role=dialog` + `aria-modal` + nombre; foco dentro; Tab atrapado; Escape cierra; foco vuelve | **conforme** |
| Toast: región `aria-live`, no roba el foco | conforme |
| Foco visible en el recorrido por Tab (Explorar, Quiero ir, Nosotros, Viaje) | conforme (los `input[type=date]` se excluyen: la UA pinta su foco interno) |
| Contraste y rejillas | `block19-contrast-check`, `block19-grid-check` conformes |
| Áreas táctiles ≥ 44 px (`03 §7`) | **5 defectos encontrados y corregidos** (abajo) |
| Movimiento reducido | ver §1 |

**Defectos corregidos** (solución dictada por `03 §7`, «44 px mínimo absoluto»): `.filter-group__summary` 42 → 44; `.interest-legend__summary` 40 → 44;
botón ⓘ de la galería (`.gallery__credits`) 40 px pintado → área real 44 px con `::after` (misma técnica que `.tap-target-min`); «Quitar fecha»
(`.calendar-anchor__clear`) 34 → 44; hora de inicio (`.recorded-interval-fit__input`) 41 → 44.

**Excepción registrada**: controles de Leaflet (zoom 30×30, atribución) — chrome de la librería; el mapa es alternativo a la lista (**B10-A4**).

**Hallazgos estructurales sin solución prescrita (DESIGN DECISION REQUIRED, pinned en el gate):**
**B10-A1** sólo la vista de mapa expone `main` (el resto de destinos no tiene landmark `main`); **B10-A2** lista de ciudad, mapa y ficha no tienen `h1`
(la ficha salta de `h3` a `h2`); **B10-A3** Viaje repite «Viaje» como `h1` y `h2`. Arreglarlos cambia arquitectura de información, no un valor.

## 3. Rendimiento e imágenes (B10.3) — gate `app/scripts/b10-performance-check.mjs`, evidencia `docs/B10_PERFORMANCE_EVIDENCE.json`

Medido sobre main (no se reutilizan números históricos). Por ciudad con ≥ 10 lugares, en 390×844@2 y 1440×900@1, Chromium y WebKit: bytes de imagen al recorrer
la ciudad completa tras abrirla (presupuesto `06 §6.3` / `08` G6 = 3,5 MB), 0 originales, 0 duplicados, 0 fallos, carga diferida
(ninguna imagen a más de tres pantallas descargada al abrir), 0 imágenes sobredimensionadas (> 2,5× su caja × DPR).

| Ciudad | Imágenes | Bytes | vs 3 500 000 |
|---|---|---|---|
| Tokio | 55 | 3 499 770 | −230 B (**en el tope**) |
| Kioto | 47 | 3 499 450 | −550 B (**en el tope**) |
| Osaka | 50 | 3 356 478 | −143 522 |
| Okinawa | 45 | 2 903 352 | −596 648 |

Tokio y Kioto están exactamente en el tope del pipeline (`IDENTITY_HUB_BUDGET_BYTES`): **sin margen** para fotos nuevas sin recorte de calidad — deuda
externa (B6). Imágenes previas a abrir la ciudad (portada): 0,69 MB móvil / 1,68 MB escritorio (no cuentan para el presupuesto; DDR-MERGE-1 ya cerrada).
Ningún derivado supera 200 KB (mayor: `nunobiki-falls-herb-gardens-800w.webp`, 171 478 B).

**B10-P1 (hallazgo, no corregido):** chunk de entrada 1 669 144 B raw / 390 329 B gzip frente a **253 742 B gzip de v1.1.0** (+53,8 %; `08` G6: «sin regresión del
chunk de entrada»). La causa es **de datos**, no de código: `photography-metadata.json` pesa 142 KB gzip (de ellos ~148 KB de LQIP en base64, campo exigido por `06 §6.2`)
y `places.json` creció con las fotos/lugares de B6. Corregirlo exige cargar el registro fotográfico por ciudad (refactor funcional de la ruta de montaje, que BLOCK_12
descartó con otro dato) o decidir cómo se mide G6 → **DESIGN DECISION REQUIRED**. El gate fija el techo actual (392 000 B gzip) para que no crezca sin decisión.
Efecto lateral positivo de B10.4: el CSS inicial baja de 154,6 KB a ~111 KB raw (el resto viaja con los chunks diferidos).

## 4. Erradicación de `App.css` (B10.4)

`App.css` pasa de **7 052 → 1 287 líneas** (−82 %), sin cambiar un solo valor computado. Método reproducible:
`scripts/css-inventory.mjs` (clasifica cada regla A token/base · B shell/global · C superficie · D muerta · E ambigua),
`scripts/css-migrate.mjs` (mueve/borra reglas por clase; divide los `@media` mixtos; no mueve cabeceras de sección) y
`scripts/css-equivalence-check.mjs` (estilo **computado + caja** de **cada elemento** en 125 estados × 5 anchos [320/390/430/840/1200] = 235 851 elementos,
BASE vs rama; la propia base repetida da 0 diferencias → determinista). Cada lote se commitea sólo con **0 diferencias**. La prueba cazó **dos** riesgos de cascada
antes de commitear (orden de `@media` mixtos; `NationalMap` frente a `.national__map-fallback`), que se resolvieron sin tocar valores.

| Lote | Qué |
|---|---|
| 1 | CSS muerto desde B25/B29: `selection-panel*`, `selection-list*`, `tag-row`, `reservation-prep__*`, `day-order-alternatives` (43 clases, 0 referencias en `src/`; 362 líneas) |
| 2–7, 9 | PlaceGallery, PlaceDetail, DayOrderToolPanel, TripBackup, SelectionPanel, TravellerManager, SelectionAnalysis, ZonePlanSection, RegionNavigator, PrefecturePanel, PlaceMap, NationalExplorer, InterestLegend, CreditsSheet, PersonToken, ShortlistFilterBar, SourcesAndLicences, NosotrosScreen, HubSelector, ZonePhotoFallback, TripReservations, SequenceCandidateSummary, **OrderedSequenceBuilder** (1 336 líneas) y **ZoneComparison** (733), AppNav, Sheet, SaveToast, PersistenceNotice, Onboarding — cada una a `src/components/<Nombre>.css`, importado por el componente (los chunks diferidos arrastran su CSS) |
| 8–9 | reglas descendientes (`.componente__x .button`…) junto a su propietario |
| 10 | 14 reglas muertas: modificadores sin ninguna referencia (`zone-column__tag--*`, `place-card__interest--*`, `place-interest__line--silent`, …) |
| 11 | `analysis-*` (compartido por el planificador y el análisis de Quiero ir) → `AnalysisDialog.css` |
| 12 | cabeceras de sección huérfanas fuera; cabecera de `App.css` documenta qué conserva |

Orden de importación: las hojas globales (`App.css`, `discovery.css`, `trip-overview.css`) se importan **primero** en `App.tsx`; el CSS de componente queda después
(lo migrado sólo puede ganar a una global de igual especificidad, nunca al revés; verificado por el equivalence-check). Los tests que buscan una regla leen `App.css` + CSS de
componentes (`src/test-css.ts`; las aserciones no cambian, sólo dónde está la regla).

**Lo que queda en `App.css` y por qué** (inventario final): `:root` y alias heredados (A); botones y utilidades globales `.button*`, `.icon-button*`, `.link-button`,
`.tap-target-min`, `.visually-hidden` (B); shell de `App.tsx` (`app__*`, `destination-panel`, `viaje-nav`, `explorer-bar`, `map-empty`, `city-sheet`, layout nacional) — el
shell **es** la superficie de `App.tsx` y su CSS es `App.css`; primitivos compartidos `.tag*`, `.alert*`, `.badge*`, `.person-token` (E); y reglas enredadas con otras hojas globales
(`whole-trip-composition*` con `trip-overview.css`; `NationalMap` con `.national__map-fallback`; `national-start`, `region-nav__empty`, `nosotros-section*`, `sources__*`) — se
dejan donde están porque moverlas cambia el orden de cascada y no se demostró equivalencia sin riesgo. Una fase posterior puede separar el shell de `App.tsx` en su propio
fichero y los primitivos en `styles/primitives.css`.

## 5. Microcopy (B10.5) — gate `app/scripts/b10-microcopy-check.mjs`

Auditoría de TODO texto visible y nombre accesible (1 616 cadenas distintas en 52 estados/anchos, Chromium y WebKit) y de las cadenas literales de componentes y módulos
de presentación, contra `03 §10` y `00 Art. 7`: *recorrido, secuencia, constructor, orden A/B, tramo, candidato, Dato:, grado, provenance, freshness, analizar selección,
cobertura, cluster, submit*, «Guardar … en Quiero ir», «Aceptar/Submit», flechas finales, exclamaciones, emoji. **Léxico prohibido visible: 0** (excepciones: E1 «Grado original»
en «Fuentes» plegado; contenido editorial de `data/`, no se toca).

* **Corregido**: el corazón se llamaba «Guardar {lugar} en Quiero ir» (`03 §10`: *No decir «Guardar en Quiero ir» → decir «Quiero ir»*) → ahora «Quiero ir: {lugar}» (`aria-label`; estado pulsado
  `aria-pressed`; «Quitar {lugar} de Quiero ir» se mantiene). Se actualizaron el test de `PlaceCard` y el gate B26.
* **DDR B10-C1**: prosa «guardar/guardado/guardó/guardad» para el acto de marcar un lugar (6 cadenas: Quiero ir vacío, leyenda de interés, análisis, `traveller-presentation`,
  `divergence-presentation` ×2). `03 §10` exige que la acción conserve su nombre «Quiero ir» pero sólo da el ejemplo «marcado» para un estado vacío; elegir el verbo de la voz es decisión de Producto.
  El gate fija las seis.
* **DDR B10-C2 = D5-M1**: vistas «builder»/«compare» no alcanzables con léxico prohibido (lista pinned; el test D5 comprueba que siguen sin ser alcanzables).

## 6. OD-01

`OD-01 — ¿Se añade modo oscuro en esta evolución?` — **Producto**. Sin decisión; no se implementa, no se resuelve. No bloquea B10.

## 7. Deuda abierta tras B10

Safari/iPhone físico y lector de pantalla físico (no medidos); fotografías reales de zona; recursos externos/OSM; DDR B10-M1…M6, B10-A1…A4, B10-P1, B10-C1/C2 (= D5-M1),
D0b-01/D0b-02/EvidenceMark; tags/alerts/badges y shell de `App.tsx` aún en `App.css`; gates heredados obsoletos (phase3f-h/j/s, block4) y phase5a/integración con 3 fallos
heredados idénticos en main.
