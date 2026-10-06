# P-06 v2 — Certificación (P-06·A + B + C + D)

Base `main` @ `de4b190b033a4d8c169d75a609e3d7d50527e674`. Rama `claude/p06-v2-list-sheets`. Arquitectura: [P06_V2_ARCHITECTURE.md](P06_V2_ARCHITECTURE.md).

## Alcance real y desviación de proceso

La misión pedía implementar A, certificar A, implementar B y certificar A+B. **A y B se implementaron juntas y se certificaron una sola vez (A+B)**: la regla «ningún botón secundario de N1 abre un bloque inline grande» y la
prohibición de «recrear el problema con otro `<details>`» dejaban a A sin ningún lugar donde alojar fechas, acciones de parada o mover entre días salvo la Sheet de B. Los commits separan documentación, producto y gates, pero no existe una certificación intermedia «sólo A».

## Entorno

Chromium 141 (`/opt/pw-browsers/chromium-1194`), Playwright 1.62.1, `vite preview` de la build de producción, un servidor por árbol. Los gates que necesitan servidor externo (B17/B18/Block 20/DDR03) se ejecutaron con `NIHON_BASE_URL`;
los que lanzan `chromium.launch()` sin ruta (Block 6, Phase 3F-*) con un `PLAYWRIGHT_BROWSERS_PATH` temporal que enlaza el headless-shell disponible. **La base `main` se ejecutó en el mismo entorno y todos esos gates pasan ahí**, salvo `block4`, que ya estaba roto en `main` por P-06 v1.

## Resultados — Chromium (rama, HEAD final)

| Comprobación | Resultado |
|---|---|
| `tsc -b` · build · oxlint | PASS · PASS · 0 errores (warning heredado `PlaceMap.tsx:18`) |
| Vitest | 119 archivos · **3428/3428** (base 118 · 3424: +1 archivo `day-sleep-line`, +4 pruebas) |
| B27 Viaje · Días | PASS (A–K, 8 viewports) |
| B28 reordenación/arrastre | **69/69** (ratón; touch: sin asas + mover por Sheet; 8 viewports) |
| B29 Cambiar orden (antes «Probar otro orden») | **163/163** (ejecuta B28 dentro) |
| B30 Dónde dormir · B31 Reservas/Resumen | 475/475 · 281/281 |
| B18 a11y · back · chrome · regression · responsive · viaje-lugar | 25/25 · PASS · 6/6 · PASS · PASS · PASS |
| B17 regression · responsive · tap-target | PASS · PASS · 16/16 |
| Block 20 place-detail · B24 DDR3 · B25 · B26 · DDR03 | 73/73 · 9 · 123/123 · 314/314 · 43/43 |
| B10 a11y · microcopy · motion | 89/89 · 52/52 · 17/17 |
| D0b higiene del sistema de diseño | **128/128** (antes 56: el recorrido mide cada hoja/vista) |
| D5 vocabulario normativo · evidence-options | **35/35** (antes 30) · 89/89 |
| P-04 alcance mapa nacional | 55/55 |
| Phase 5A RC | 50/50 |
| Block 4 zona→planificador | **258/258** (en `main` fallaba desde P-06 v1: selectores dentro de `<details>` cerrado) |
| Block 6 divergencias · Phase 3F-f/h/j/s | 177/177 · PASS ×4 |
| **`p06-v2-list-invariant-check`** (nuevo) | **184/184** en 390×844 (touch) y 1440×900 (puntero fino) |

### WebKit — NO EJECUTADO

`webkit.launch()` falla: `Executable doesn't exist at /opt/pw-browsers/webkit-2336/pw_run.sh`. El entorno sólo trae Chromium y su política prohíbe `playwright install`. Sin WebKit no hay evidencia para: el comportamiento de `(hover: hover) and (pointer: fine)` en Safari,
`input[type=date]` dentro de la Sheet, foco al cerrar hojas y Tab atrapado. El gate nuevo, B30/B31/B10/D0b/D5/P-04 admiten `NIHON_BROWSER=webkit`; deben repetirse en un entorno con WebKit antes de integrar. B27–B29 siguen siendo sólo Chromium (como antes).

## Gates actualizados (y por qué)

Ninguna aserción funcional se relajó. Cambió la **entrada** (abrir la hoja/vista) y se sustituyeron las aserciones que certificaban la UI antigua por la invariante:

- **B27**: sin `<details>`/frase pedagógica en N1; fechas por Sheet; «Eliminar/Mover día» por Sheet («Mover después», no «Posición N»); mover entre días por Sheet y **al final**; orden fino del día por «Cambiar orden»; «Sin asignar» visible; Cambiar orden en vista enfocada.
- **B28**: touch ya no arrastra (no hay asas): comprueba que no hay ninguna asa visible y que la Sheet mueve por touch/teclado; el arrastre con ratón queda intacto; «Sin asignar» sin `<details>`.
- **B29**: «Probar otro orden» → «Cambiar orden»; el panel vive en una vista enfocada; los casos «obsoleto» simulan el cambio externo sobre controles tapados (`dispatchEvent`); el TabBar tapado ya no cuenta para la geometría del CTA.
- **Resto**: B31, B18-regression (el estado local que sobrevive al cambiar de pestaña pasa de `<details class="days-tools">` a la vista «Herramientas del viaje»), D0b (A01 ya no exige reglas de selects retirados; recorrido por superficie), D5 (siete superficies de Días), B10-a11y, surface-walk, visual-capture, css-equivalence, evidence-options, Block 4/6, Phase 3F-f/h/j y Phase 5A. Helpers nuevos en `lib/modern-trip.mjs`: `moveStopToDay`, `setTripStartDate`, `closeDaysOverlays`.
- **Vitest de fuente**: `OrderedSequenceBuilder.stable-day-identity`, `OrderedSequenceBuilder` (3D-Q) y `DayOrderToolPanel` — mismas garantías (id estable, nombres accesibles, foco) contra la estructura nueva; sin `dayId=`/`dayId: day…` hacia módulos de dominio.

## Mediciones antes / después (viaje de 2 días: Día 1 con 3 paradas, Día 2 con 1, 1 sitio sin asignar)

`scripts/p06-v2-measure.mjs` (misma sonda contra `main` y contra la rama).

| Métrica | 390×844 antes → después | 1440×900 antes → después |
|---|---|---|
| Altura desplazable de Días (estado inicial) | 1726 → **1487 px** (−14 %) | 1522 → **1346 px** (−12 %) |
| Tarjeta del Día 1 (3 paradas) | 578 → **538 px** (−7 %) | 498 → **489 px** (−2 %) |
| Controles interactivos visibles a la vez (toda la lista) | 40 → **21** (−48 %) | 40 → **26** (−35 %; las asas de puntero fino cuentan) |
| Controles en la tarjeta del Día 1 | 16 → **11** | 16 → **14** |
| Texto en el cuerpo de Días | 808 → **629** caracteres (−22 %) | ídem |
| `<details>` / paneles inline en N1 | 3 + 2 → **0** | ídem |
| Crecimiento de la página al accionar un control secundario | ⋯ parada **+289** · Detalles **+1888** · Probar orden **+1454** · Herramientas **+1200** · cajón +220 → **0 px en las 8 entradas** | +291 · +1460 · +977 · +659 · +123 → **0 px** |

Lectura honesta: la altura **inicial** baja de forma moderada (P-06 v1 ya había hecho la mayor parte: 5159 → ≈1850 px). Lo que cambia de naturaleza es la **interacción**: ninguna acción secundaria vuelve a alargar la página (hasta +1888 px antes), hay la mitad de controles simultáneos y menos texto. «Sin asignar» con lugares ahora ocupa su lista (antes un cajón cerrado), por eso la altura inicial no cae más.

Capturas locales (fuera del repo): 390×844 y 1440×900, lista, hoja de parada y vista «Detalles del día».

## Regresiones propias encontradas y corregidas

1. Texto «guardados/Guarda más lugares» en la Sheet «Añadir lugar» violaba el vocabulario de B10-C1 → «Todos los lugares de Quiero ir ya tienen día…».
2. `@media (max-width)` nuevo violaba D0b E01 (Art. 8) → reescrito mobile-first con `min-width`.
3. El foco tras mover una parada se leía antes del siguiente fotograma → el gate espera al foco (el comportamiento era correcto).
4. Tres gates leían una regla/estado retirado (A01 de D0b, `.days-tools` en B18, `.zone-plan__card` en B31) → adaptados.

## Riesgos residuales

- **WebKit sin ejecutar** (arriba) y sin dispositivo físico.
- *(Resuelto en P-06·C: «atrás» cierra la superficie; ver la actualización al final.)*
- Vistas N3 y Sheets son modales y cubren el TabBar; los casos «obsoleto» de B29 ya no son alcanzables por un usuario real (sólo por el gate).
- Mover entre días cambia las fechas derivadas (la fecha del día es `inicio + ordinal`): «Mover antes/después» lo advierte con «Pasa a ser el Día N».
- *(Resuelto en P-06·C: «Sin alojamiento esa noche».)*
- `FocusedView` y las Sheets de Días no se auditaron con lector de pantalla real.

## Actualización P-06·C + P-06·D

Alcance añadido: historial (`useSurfaceHistory`), `FocusedView` definitiva, Subir/Bajar en «Cambiar orden», «Sin alojamiento esa noche» y limpieza de v1 (ver [P06_V2_ARCHITECTURE.md](P06_V2_ARCHITECTURE.md) §3). Esta sección **sustituye** a los resultados de A+B donde difieren.

### Resultados — Chromium (rama, HEAD de la fase C+D)

`tsc -b` · build · oxlint (sólo el warning heredado `PlaceMap.tsx:18`) limpios. Vitest **119 archivos · 3429/3429**.

| Gate | Resultado |
|---|---|
| `p06-v2-list-invariant-check` | **190/190** (390×844 touch y 1440×900 ratón; añade el 4.º estado de alojamiento) |
| `p06-v2-history-check` (nuevo) | **146/146** — atrás/adelante/aperturas repetidas de las 8 superficies, cierre por UI, apertura inmediata tras cierre, recarga, convivencia con la pila de la ficha |
| `p06-v2-journeys-check` (nuevo) | **68/68** — recorridos completos en móvil (tap) y escritorio (ratón): fechas, añadir día/lugar, Sin asignar, mover paradas, reordenar días y paradas, detalles, alojamiento, herramientas, Reservas/Resumen, recarga |
| B27 · B28 · B29 | PASS · **69/69** · **164/164** |
| B30 · B31 | 475/475 · 281/281 |
| B18 (a11y, back, chrome, regression, responsive, viaje-lugar) · B17 · Block 20 · DDR03 · B24 · B25 | PASS (25/25, PASS, 6/6, PASS, PASS, PASS · PASS ×3 · 73/73 · 43/43 · 9 · 123/123) |
| B26 | 314/314 en la segunda ejecución; **313/314 en la batería (K-FOCUS-VISIBLE, 1440×900, Nosotros)** — intermitente y ajeno a Viaje (pasa con 314/314 al repetir; no toca ningún archivo de P-06) |
| B10 a11y · microcopy · motion | 89/89 · 52/52 · 17/17 |
| D0b | 128/128 |
| D5 · evidence-options · P-04 · Phase 5A | 35/35 · 89/89 · 55/55 · 50/50 |
| Block 4 · Block 6 · Phase 3F-f/h/j/s | 258/258 · 177/177 · PASS ×4 |

Defecto propio corregido durante la fase: la barra «Cancelar / Usar este orden» quedaba a media pantalla dentro de la vista (offset del TabBar) → `bottom: 0` en la vista enfocada. `FocusedView` capturaba como «disparador» el encabezado del panel (un hijo toma el foco antes) → se captura al montar.

### WebKit — (histórico) bloqueado en el entorno de la sesión; resuelto con GitHub Actions, ver «Certificación WebKit automatizada»

Comprobado en esta fase: `/opt/pw-browsers` sólo contiene `chromium`, `chromium-1194`, `chromium_headless_shell-1194`, `ffmpeg-1011`; no hay `webkit-*`. `webkit.launch()` y los tres gates nuevos con `NIHON_BROWSER=webkit` fallan con
`browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2336/pw_run.sh`. No se instaló ningún navegador (prohibido). **Estado WebKit: NO EJECUTADO.**

Reproducible en un entorno con WebKit (Playwright 1.62.1, `webkit-2336`): `cd app && npm ci && npm run build && scripts/p06-v2-certify.sh webkit`. El script aborta con código 2 si WebKit no arranca y lista explícitamente qué gates son Chromium-only (B27–B29, Phase 5A/3F, Block 4/6): sin evidencia en WebKit por diseño previo.
Lo que más importa verificar allí: `(hover: hover) and (pointer: fine)` para las asas, `input[type=date]` dentro de la Sheet, `history.back()`/`popstate` con las entradas propias, foco al cerrar, Tab atrapado.

### Revisión de las adaptaciones de gates (¿alguna debilita la conducta exigida?)

| Cambio | Veredicto |
|---|---|
| Entradas por Sheet/vista en lugar de `<details>`/«⋯» inline (B27, B31, D0b, D5, B10, Phase 5A/3F, Block 4/6, B18-regression…) | Misma aserción, otra entrada. No debilita. |
| B27/B28: «Posición N» → «al final» + Subir/Bajar | Cambio de contrato exigido (decisión cerrada); se **añade** comprobar que no hay «Posición». |
| B28 touch: ya no arrastra | El contrato nuevo es la ausencia de asas en touch; se prueba que ninguna es visible y que la vía alternativa (Sheet, Cambiar orden) mueve. El arrastre con ratón queda íntegro. |
| D0b A01: se quitan 4 selectores de reglas `select` | Esos controles ya no existen; el recorrido dinámico mide **más** superficies (56→128 comprobaciones) con ≥ 16 px en cada input/select real. |
| B18-regression: el estado local que sobrevive al cambiar de pestaña pasa de `<details>` a la vista «Herramientas del viaje» | La intención («el planificador no se desmonta») se conserva, pero el cambio de pestaña se dispara con `dispatchEvent` sobre un control tapado por la vista modal. **Es el único test que sigue usando ese atajo**; un usuario real no puede cambiar de pestaña con una vista abierta salvo por «atrás» (cubierto en `p06-v2-history-check`). |
| B29 «obsoleto» (**reescrito en C**) | Ver abajo. |
| p06-v2-measure/capture | Herramientas de medición, no gates. |

### B29: qué demostraba la simulación y qué demuestra ahora

Antes (A+B): con «Cambiar orden» abierto, el gate disparaba clics (`dispatchEvent`) sobre las acciones de parada **tapadas** por la vista modal para mover el día «por debajo», y comprobaba que el panel mostraba el aviso de obsoleto y deshabilitaba «Usar este orden».
Eso demostraba la **guarda de código** (`dayIsStale` + `applyDayOrderProposal` fail-closed), pero **no un recorrido de usuario**: un usuario no puede alcanzar ese estado con la UI.
Con C hay una sola superficie abierta a la vez, y abrir otra *reemplaza* la actual, así que el atajo ya ni siquiera reproduce el estado. Se sustituyó por la secuencia real que sí lleva a una línea base obsoleta, con ratón y sin atajos:
abrir «Cambiar orden» → **«atrás»** (se cierra; su entrada queda en «adelante») → cambiar el día con **arrastre** real (cambia el conjunto, H1; o sólo el orden, H2) → **«adelante»**. Se exige que no se reabra, que no se aplique ni escriba nada y que el orden nuevo se conserve.
Lo que **ya no** se prueba de forma directa es el aviso `role="alert"` del panel: la guarda sigue en el código como defensa en profundidad, pero ningún flujo de usuario la dispara.

Las interacciones reales de usuario se verifican por separado en `p06-v2-journeys-check` (tap/clic/teclado/arrastre, sin `dispatchEvent`) y `p06-v2-history-check` (atrás/adelante reales).

### Evidencia visual (capturas locales fuera del repo)

390×844 y 1440×900: lista, hoja de parada, hoja de fechas, añadir lugar, acciones del día, vista Cambiar orden (Subir/Bajar, barra de acciones pegada abajo), Detalles del día y Herramientas del viaje. Generadas con `scripts/p06-days-capture.mjs`.

### Riesgos residuales (vigentes)

- **WebKit sin ejecutar**; sin dispositivo físico ni lector de pantalla.
- «Sin alojamiento esa noche» sólo se fija en «Detalles del día» (sin atajo desde la tarjeta): decisión de producto abierta.
- Una entrada de historial propia cuyo objetivo ya no existe se salta con un `history.back()` automático (visible como un parpadeo del historial, no de la UI); no se ha probado con el gesto físico de iOS.
- B26 es intermitente en batería (ajeno a P-06).

## Cierre de la verificación (código exacto: `0bf2908b9d07e2c295723161e46db7e19913250e`)

Base `origin/main` = `de4b190b033a4d8c169d75a609e3d7d50527e674` (sin cambios). HEAD remoto de la rama `claude/p06-v2-list-sheets` = `0bf2908b9d07e2c295723161e46db7e19913250e` (verificado con `git fetch` + `git rev-parse`). Los resultados de Chromium de arriba corresponden a este código (el único cambio posterior a `2f635e7` en `app/` es de gates/docs).

### Búsqueda de un entorno con WebKit — resultado: no hay ninguno accesible

- `list_environments` devuelve **un solo** entorno (`env_01C5f56sVeNM8yCzwpjqhFYX`, «Predeterminado», `anthropic_cloud`): es el mismo en el que corre esta sesión y ya se comprobó que no trae WebKit (`/opt/pw-browsers/webkit-2336/pw_run.sh` inexistente). No se creó otra sesión en él ni se repitió el intento.
- El repositorio lista 36 workflows de Actions heredados (auditorías «exact-head» de fases anteriores y uno de Astra); ninguno ejecuta WebKit ni P-06, no existen en la rama, y añadir uno sería ampliar el repositorio sin autorización. No se usó.
- **Se necesita ejecución externa** (abajo).

### Handoff para certificar WebKit (ejecución externa)

- Código: rama `claude/p06-v2-list-sheets` @ `0bf2908b9d07e2c295723161e46db7e19913250e`.
- Dependencias: Node 22; Playwright **1.62.1** con `webkit-2336`; en Ubuntu 24.04: `npx playwright install --with-deps webkit` (en una máquina donde instalar navegadores esté permitido).
- Comandos: `cd app && npm ci && npm run build && scripts/p06-v2-certify.sh webkit` (aborta con código 2 si WebKit no arranca; si pasa, ejecuta los 3 gates P-06 v2 + B30, B31, B10-microcopy/motion, D0b, D5, P-04 con `NIHON_BROWSER=webkit`). Capturas opcionales: `NIHON_BROWSER=webkit NIHON_P06_SHOTS=out NIHON_P06_LABEL=webkit node scripts/p06-days-capture.mjs`.
- Cobertura que esos gates dan en WebKit: **historial** atrás/adelante, cierre por UI y reapertura repetida, entrada cuyo objetivo ya no existe (parada movida) y línea base de «Cambiar orden» obsoleta (`p06-v2-history-check`); **foco** (entra, vuelve al disparador, sigue al lugar movido), **Tab** atrapado y **Escape** en las 8 superficies (`p06-v2-list-invariant-check`); **fechas** y el recorrido completo con **tap** en contexto touch (`p06-v2-journeys-check`).
- **Lo que NO cubre WebKit hoy** (scripts Chromium-only: B27, B28, B29, Phase 5A/3F, Block 4/6): arrastre con ratón por Pointer Events, auto-scroll y movimiento reducido (B28); y el teclado de «Cambiar orden» con Enter repetido, tamaño de objetivos y geometría del CTA por 8 viewports (B29). Esos tres necesitan portar `launch()` a `NIHON_BROWSER` (B27/B28/B29 llaman a `chromium.launch` directamente); no se hizo aquí porque no se puede validar sin WebKit y sería cambiar gates a ciegas.
- Criterios pendientes para aprobar WebKit: 0 fallos en esos gates; asas sólo con `(hover: hover) and (pointer: fine)`; `input[type=date]` operable dentro de la Sheet; `popstate` sin entradas colgantes; foco visible tras cerrar; sin errores de consola.
- Estado: **WebKit NO EJECUTADO. El PR sigue en Draft.**

### K-FOCUS-VISIBLE de B26: comparación HEAD vs base

Condiciones idénticas: dos árboles (base `de4b190…` y HEAD `0bf2908…`), cada uno con su build de producción, B26 ejecutado 8 veces por árbol, los dos bucles **a la vez** en la misma máquina, Chromium 141.

| Árbol | Ejecuciones | Fallos | Detalle |
|---|---|---|---|
| base `main` | 8 | **1** (run 1) | `K-FOCUS-VISIBLE` 1440×900 |
| HEAD `0bf2908` | 8 | **1** (run 1) | `K-FOCUS-VISIBLE` 1440×900 |

Mismo check, mismo viewport, misma ejecución (la primera, en frío) en **ambos** árboles: **no es una regresión de P-06**; reproduce en `main`. Causa probable: `TravellerManager` mueve el foco en un efecto tras el cambio de persona y el gate lee `document.activeElement` de forma síncrona justo tras `Enter` (carrera del gate bajo carga). P-06 no toca `TravellerManager` ni Nosotros (`git diff origin/main..HEAD -- app/src` sin esos archivos). No se corrigió porque es ajeno al alcance; la causa es una hipótesis por lectura de código, no probada con una traza. Registrado como intermitente heredado, con esta evidencia.

### Capturas

Galería accesible (artefacto privado; compartir desde su menú): https://claude.ai/artifact/1akyRzn6CVZ2XULtVun5Yq — 8 estados × (390×844, 1440×900), Chromium, mismo commit.

## Certificación WebKit automatizada (GitHub Actions) — SHA certificado `c190864340071ebde0bc78ecc7c39b893878d459`

- **Workflow:** `.github/workflows/p06-certification.yml` («P-06 certificación»). Dispara con `pull_request` (también Draft; sólo si cambian `app/**` o el propio workflow) y `workflow_dispatch`. `permissions: contents: read`, sin secretos, sin despliegue, `timeout-minutes: 75`, `ubuntu-24.04` estándar, una matriz `webkit` + `chromium`. Hace checkout del **SHA exacto** de la cabeza del PR, `npm ci` con el lockfile, comprueba la versión de Playwright (**1.62.1**, la del lockfile), instala el navegador y sus dependencias **sólo en el runner** (`npx playwright install --with-deps <navegador>`), `npm run build` y `scripts/p06-v2-certify.sh <navegador>`. Sube logs y capturas como artefacto `p06-<navegador>-<sha>` (30 días).
- **Ejecución:** https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37348728631 — tres intentos (1, 2 y 3) **verdes en WebKit y Chromium** sobre `c190864…`. Artefactos (intento 3): `p06-webkit-c190864340071ebde0bc78ecc7c39b893878d459` (id 11362348714) y `p06-chromium-c190864340071ebde0bc78ecc7c39b893878d459` (id 11363605004), con `summary.txt`, un log por gate y `shots/`. Capturas WebKit en la galería: https://claude.ai/artifact/1akyRzn6CVZ2XULtVun5Yq (privada).
- **WebKit 26.5** (Playwright `webkit-2336`), Node 22.23.3:

| Gate (WebKit) | Resultado |
|---|---|
| `p06-v2-list-invariant-check` | 190/190 |
| `p06-v2-history-check` | 146/146 |
| `p06-v2-journeys-check` | 68/68 |
| B27 | PASS (A–K, 8 viewports) |
| B28 (dentro de B29) | **69/69** — ratón, auto-scroll, movimiento reducido, 8 viewports, contexto touch |
| B29 | **164/164** — teclado de Cambiar orden, geometría de los 8 viewports |
| B30 · B31 | 475/475 · 281/281 |
| B10 microcopy · motion | 52/52 · 17/17 |
| D0b · D5 · P-04 | 128/128 · 35/35 · 55/55 |

Chromium en el mismo runner y SHA: los mismos gates en verde más Phase 5A 50/50 (Chromium-only).

### Qué se adaptó para cubrir WebKit (y por qué no debilita)

1. **B27/B28/B29 aceptan `NIHON_BROWSER=webkit`** (antes llamaban a `chromium.launch` directo). Mismas aserciones; cambia sólo el lanzador. Se validaron en Chromium (local y CI) tras el cambio.
2. **B29 mide tras asentar la animación** `sheet-rise` (un subpíxel mid-animación daba 43.99 px, intermitente en Chromium).
3. **B29 cuenta sólo escrituras que cambian el borrador.** WebKit mostró (2 de 6 ejecuciones, `E-2`) una reescritura **idéntica** del mismo JSON por `usePlanningDraft` al terminar de cargar el documento de viajeros, que caía después del reinicio del contador. Una reescritura idéntica no es un cambio persistido; lo que el gate exige —abrir, cargar una opción o cancelar **no cambia** el borrador— se conserva (y los recuentos «una escritura al aplicar» siguen exactos). **Es el único cambio que reduce la estrictez literal («cero escrituras»)**; no se tocó el comportamiento de la app.
4. **Defecto real encontrado por WebKit y corregido (regresión propia):** en «Herramientas del viaje» el texto interno de un `<select>` (la opción «Selecciona dos puntos consecutivos de hubs distintos») hacía que `scrollWidth` de la vista fuese 415 > 390 y la vista se pudiera desplazar en horizontal. Se corrigió con `overflow-x: hidden` en el cuerpo de `FocusedView` y D0b ahora distingue desbordamiento **visible** (elementos fuera del borde) o **desplazable** del puramente interno. Un primer intento (ancho 100 % del select) **no** surtió efecto y se revirtió.
5. `scripts/p06-v2-certify.sh` ahora ejecuta B27 y B29 también en WebKit, deja un log por gate, `summary.txt` y capturas, y vuelca el final del log de los gates que fallan.

### Qué sigue sin estar probado

- **Safari/iPhone físicos y gesto «atrás» real de iOS:** no probados. WebKit de Playwright en Linux **no** es Safari (motor sí; chrome del navegador, teclado/IME, barras dinámicas y gestos no).
- **Lector de pantalla** (VoiceOver/TalkBack/NVDA): no probado.
- Phase 3F, Block 4/6 y Phase 5A siguen siendo Chromium-only (fuera de la certificación P-06); Phase 5A corre en el job Chromium del workflow.
- B26 `K-FOCUS-VISIBLE`: ver su sección (intermitente, reproduce en `main`, hipótesis sin traza); no se tocó.
- Coste: dos jobs de ~9 min por ejecución en runners estándar; no se necesitó habilitar servicios ni permisos adicionales.

## Revisión final para integración — SHA certificado `7bc0990f9167631ea4872fee7882984b9aac23d1`

**Alcance del diff final** (`origin/main..HEAD`): 46+ archivos, sólo `app/src` (Días, `FocusedView`, `useSurfaceHistory`, `day-sleep-line`, panel de orden), `app/scripts` (gates/helpers), `docs/`, `.github/workflows/p06-certification.yml` y una línea de `.gitignore`. Sin dataset, sin Vercel/Astra, sin cambios de configuración global. El HEAD final sólo añade documentación respecto a `7bc0990` (código de producto sin cambios desde `c190864`; entre `c190864` y `7bc0990` sólo cambiaron scripts de gates).

**Ejecución:** https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37353521922 (intentos 1, 2 y 3, todos verdes en WebKit 26.5 y Chromium). Artefactos: `p06-webkit-7bc0990f9167631ea4872fee7882984b9aac23d1` (id 11365750985) y `p06-chromium-7bc0990f9167631ea4872fee7882984b9aac23d1` (id 11365426977).

### `overflow-x: hidden` en las vistas enfocadas: no recorta nada necesario
Nuevo gate `p06-v2-clip-check` (3 vistas × 8 viewports: 320, 360, 375, 390, 430, 820, 1280, 1440): (1) ningún elemento visible queda fuera del cuerpo; (2) ningún texto de lectura queda recortado por overflow oculto (los `<select>`/`<input>` truncan por diseño); (3) con Tab, el anillo de foco (rect + `outline-width` + `outline-offset`) de **cada** control cabe en el cuerpo y todos muestran indicador. **104/104 en Chromium y en WebKit 26.5.** Autoprueba negativa (`P06_CLIP_NEGATIVE=1`, inyecta un anillo de 40 px): falla en 24 comprobaciones, de modo que el gate no es vacuo. Nota: el texto de la opción larga de «Posición en el plan» se ve truncado dentro del propio `<select>` (comportamiento nativo; las opciones se leen al abrirlo): no lo introduce `overflow-x`.

### B29: la tolerancia sólo ignora escrituras idénticas
El contador cuenta una escritura si `getItem(key) !== value`. Autoprueba nueva dentro de B29 (5 comprobaciones, **169 en total**): reescribir el mismo borrador no cuenta; reordenar el día cuenta; cambiar el conjunto del día cuenta; **cualquier** diferencia de contenido (incluido un espacio) cuenta; el borrador queda intacto tras la autoprueba. Las aserciones de «abrir / probar otra opción / cancelar / Escape no escriben» siguen exigiendo recuento 0 y las de «aplicar» exigen exactamente 1, así que un cambio real provocado por cancelar o probar otro orden **sigue haciendo fallar el gate**. Los casos «obsoleto» (atrás → arrastre → adelante) no cambian.

### Decisión de producto cerrada
«Sin alojamiento esa noche» se mantiene **sólo en «Detalles del día»** (Fin del día → «No aplica»); no se amplía su ubicación en esta entrega.

### Seguimiento independiente: B26 `K-FOCUS-VISIBLE`
Registrado como issue [#197](https://github.com/Z3roM4str/-nihon-travel-explorer/issues/197) con la evidencia (main 1/8, rama 1/8, misma ejecución en frío, mismo check) y la hipótesis marcada como **no confirmada y sin traza**. Fuera de P-06.

### Pendientes explícitos (no bloquean este cierre)
- **Safari/iPhone físicos y gesto «atrás» real de iOS:** no probados.
- **Lector de pantalla** (VoiceOver/TalkBack/NVDA): no probado.
- Phase 3F, Block 4/6: Chromium-only, fuera de P-06.

## Integración en `main` y certificación post-merge

- PR #196 integrado con **merge commit** (sin squash, rebase ni force-push) el 2026-10-05: **`592c0c46435dd61d4b2ef84566c4fdb75f53c56d`**. Antes de fusionar: HEAD del PR `4bad18159b74480d8aac1488cb9d3fc5f3f7e544` (verificado con `expectedHeadSha`), base `main` = `de4b190b033a4d8c169d75a609e3d7d50527e674`, checks `webkit` y `chromium` en verde, estado de fusión limpio.
- Padres del merge: `de4b190b033a4d8c169d75a609e3d7d50527e674` (primer padre, la base) y `4bad18159b74480d8aac1488cb9d3fc5f3f7e544`. **Árbol del merge `fdd05933e9c355c14ce003d78a65fea788c80885` = árbol del HEAD del PR** (`git diff` vacío); 47 archivos, +2721 −707, idéntico al diff del PR.
- **Certificación sobre el SHA integrado** (`workflow_dispatch` sobre `main`): https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37361031993 — `592c0c4…`, **WebKit 26.5 y Chromium en verde**, `RESULT fail=0` en ambos:

| Gate | WebKit 26.5 | Chromium |
|---|---|---|
| Lista/hojas · historial · recorridos · recorte | 190 · 146 · 68 · 104 | 190 · 146 · 68 · 104 |
| B27 · B28 · B29 | PASS · 69/69 · 169 | PASS · 69/69 · 169 |
| B30 · B31 | 475 · 281 | 475 · 281 |
| B10 microcopy · motion | 52 · 17 | 52 · 17 |
| D0b · D5 · P-04 | 128 · 35 · 55 | 128 · 35 · 55 |
| Phase 5A | (Chromium-only) | 50/50 |

  Artefactos: `p06-webkit-592c0c46435dd61d4b2ef84566c4fdb75f53c56d` (id 11366807519) y `p06-chromium-592c0c46435dd61d4b2ef84566c4fdb75f53c56d` (id 11367137172).
- **Despliegue de producción no previsto por este trabajo:** el push del merge a `main` activó la integración Git de Vercel (`app/vercel.json`: `main: true`). Evidencia: deployment `dpl_2eiLZExrgQzUrVRUCVusgPCf9Cc5`, origen `git`, entorno production, READY, SHA `592c0c46435dd61d4b2ef84566c4fdb75f53c56d`, alias de producción asignados. El estado de commit `Vercel: success` significa exactamente eso: build correcto y publicado en producción. Detalle de la contención en el handoff.
- Siguen pendientes, sin cambios: issue [#197](https://github.com/Z3roM4str/-nihon-travel-explorer/issues/197) (B26 `K-FOCUS-VISIBLE`, hipótesis sin confirmar), **Safari/iPhone físicos y lector de pantalla** (no probados).

## #197 — causa raíz de `K-FOCUS-VISIBLE` (B26)

**Veredicto: defecto real de foco en `TravellerManager`, no una carrera del gate.** La hipótesis del issue (lectura síncrona antes del efecto) se descartó con datos: tras el fallo, `document.activeElement` seguía siendo `<body>` 3 s después, y el historial de focos mostraba `focusout` del botón y ningún `focusin` posterior.

- **Instrumentación** (en el gate B26, sólo se imprime si la primera lectura falla): predicados de visibilidad por separado, muestras durante 3 s y traza de `focusin/focusout`; más una traza temporal en el efecto de la app.
- **Traza del efecto** (CPU ×8): `effect active-trv-b found=false` a ~4 ms de la tecla, con el foco aún en el botón; el `<p>` «Este dispositivo lo usa» aparece ~120 ms después, en otro commit, sin destino pendiente.
- **Mecanismo:** el destino de foco vivía en una `ref` consumida por un `useEffect` sin dependencias. React vacía los passive effects pendientes de un render anterior justo antes de procesar la actualización; esa función leía la `ref` ya fijada por el manejador de clic, no encontraba aún el elemento (el cambio de persona todavía no estaba confirmado), consumía el destino y el foco caía a `<body>` para siempre. Depende del tiempo: **1/30 sin carga y 28/30 con CPU ×8** (Chromium 141, sonda con recorrido de Tab previo y hueco entre `focus()` y `Enter`).
- **Corrección:** el destino pasa a ser estado de React (`focusRequest`), que se confirma en el mismo commit que el cambio que crea el elemento. Sin cambios de comportamiento visibles; el gate **no** se debilita (sigue leyendo en el instante, sin `waitForFunction`).
- **Prueba de regresión nueva `K-FOCUS-LOAD`** (B26, Chromium, 1440×900): página nueva con CPU ×8 desde la carga, recorrido de Tab, hueco de un frame y `Enter`. **Falla 2/2 sin la corrección** (`BODY`) y pasa con ella.
- **Validación:** Chromium 141 local — B26 315/315 ×3 con la corrección; sonda 0/40 a ×8 y 0/60 a ×1 (antes 28/30 y 1/30); vitest 3429/3429; `tsc` limpio. WebKit 26.x y Chromium en GitHub Actions sobre `d3defc470046c6d4e83fe9da42182944902b7e03` (workflow temporal, ya retirado): B26 ×8 sin ningún fallo en ambos motores ([run 37390504405](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37390504405)) y `p06-certification` en verde ([run 37390504004](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37390504004)). Antes de la corrección no se midió la tasa de fallo en WebKit, así que esas 8 repeticiones muestran ausencia de fallos, no que WebKit estuviera afectado. `K-FOCUS-LOAD` es Chromium-only (usa CDP); en WebKit rige `K-FOCUS-VISIBLE`. Ninguna prueba de Playwright certifica Safari/iPhone ni lectores de pantalla.
