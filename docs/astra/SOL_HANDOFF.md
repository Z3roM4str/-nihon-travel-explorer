# TRACK: ASTRA — Sol implementation handoff

MODEL ROLE: SOL IMPLEMENTER

## Repository state

- Repository: `Z3roM4str/-nihon-travel-explorer`
- Branch in this checkout: `work` (the supplied checkout is the Astra branch content; no local `main` or `experiment/astra-redesign` ref exists).
- Stable base: `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (verified ancestor).
- Authority: `a31c6ea49da9bd8d3cb5befee28c9e7b01e1935b` (verified ancestor).
- Starting HEAD: `b986a60dc5c115e76af45fd53f8dfd9b7e46d448`.
- Current implementation commit: see final handoff/`git log` (this file is part of that commit).
- No main edit, merge, force-push, backend, acquisition, or canonical data change was made.

## Completed bounded blocks

### SOL-0 — PARTIAL

The required authority, plan, checklist, prompt, reference and validation documents were present and read. The baseline remains 214 places, seven hubs, 144 photograph records; runtime planning still imports V7. Existing tests/build and passive dataset, photography and geography validators were run.

Rendered browser certification remains **PARTIAL**, not PASS. Playwright was installed but its Chromium executable was absent. `npx playwright install chromium` retried the official CDN and received HTTP 403 each time. Therefore no new screenshot is claimed and `docs/astra/evidence/sol-0-2/` contains no fabricated artifact. This is an environment limitation and remains the first fidelity audit task on a browser-equipped runner.

### SOL-1 — implemented, visual audit PARTIAL

Introduced the Astra token layer and responsive shell with exactly two primary destinations, `Explorar` and `Nuestro viaje`, a visible local `Mis gustos` label, hash navigation, validated place deep links and hub query state. Region/prefecture navigation remains reachable from discovery. Existing selection analysis and V7 planner entry points remain reachable from Nuestro viaje. Unknown hashes fall back to Explorar. No map is instantiated on the initial discovery route.

### SOL-2 — implemented, visual audit PARTIAL

Discovery now spans all canonical places/hubs with accent-normalized canonical search, canonical category selection, hub selection, deterministic grade/hub/ID ordering, 12-item explicit pagination, and 1/2/3 responsive columns. Cards use actual local photography where available, an honest fixed-ratio pending/error state otherwise, accessible attribution, translated S/A/B/C/D/unknown recommendation labels, canonical location/category/description/duration/reservation/seasonal signals, separate detail links and save buttons, and the existing persistent single-reviewer adapter labelled `Mis guardados`. Save removal does not reconcile or prune the V7 authored plan.

## Checks and audit disposition

- PASS: ancestry and clean starting tree; canonical counts; source implementation; URL parser tests; all existing Vitest tests; TypeScript/Vite build; lint after correction; dataset, photography and geography validators; `git diff --check`.
- PARTIAL: NAV-01, VIS-01–03, CARD-01–03, IMG-01–04, A11Y-01–04, QA-02 because a browser executable could not be acquired (CDN 403). Source contracts and compilation pass, but this is not rendered approval.
- Deferred by prompt: SOL-3+ detail redesign, two-person review truth table, shared backend, map mode/advanced filter sheet, photography expansion and accommodation research. The existing detail remains reachable as a compatibility surface; it is not claimed as SOL-3-complete.
- Known risk: production output retains the pre-existing large-bundle advisory. Planner/map are not yet fully split into dynamic chunks; initial discovery does not instantiate the map, but chunk-level lazy-boundary work remains an optimization follow-up.

## Exact next objective

Return this committed SOL-0–2 slice to Astra for independent audit. On a browser-equipped runner, render and inspect 375×812, 390×844, 430×932, 768×1024, 1024×768, 1440×900 and 320px/200% reflow; exercise search, pagination, save/reload, detail/back, region entry, Nuestro viaje and planner survival. Record screenshots with route/profile/fixture metadata and issue bounded P0/P1/P2 corrections. Do not begin SOL-3 before that audit.

---

## Correction handoff after Astra audit

### Checkout identity

The correction session was requested against original implementation `fc09e33f906963dd5ed51c2615dd4677060f5432`, while the preceding audit saw a recreated PR commit `523758b07aa054a0376a0be8a28020805c9cc41f`. Neither object exists in this newly supplied checkout. Its starting HEAD was `1ef890b2a765fd59c5494cea67fdb1c2f6ded0f9`, with parent `b986a60`, the same PR title and the same 12-file combined implementation/audit content shown in the prompt. There were no post-PR product changes to preserve and the starting tree was clean. Corrections were made only on local implementation branch `work`; no main/Claude branch was inspected or changed.

### Correction commits

- `2ee3dea` — `astra(sol-2): guard authored plans from save removal`
- `8af7a69` — `astra(sol-1-2): correct navigation and discovery regressions`

### Audit findings addressed

1. **PLAN-01 / VOTE-05:** both card and trip removal paths now fail closed when the ID is in a parsed authored V7 route. They show a non-destructive Planificar handoff instead of changing saved state. Planner eligibility is the union of current saves and authored route IDs, so opening the planner cannot reconcile against a reduced preference list. Pure V7 regression fixtures verify read-only inspection and malformed-state fail-closed behavior.
2. **NAV-03 / FIL-01 / MAP-01:** reachable `Filtros (n)` and `Lista / Mapa` controls restore the canonical grade, duration, hidden-gem, tourism and reservation filters and the existing PlaceMap behind a lazy boundary. Regions and all hubs remain reachable.
3. **NAV-02:** exploration URL state now carries validated hub, query, category, page and list/map mode. Detail entries record a same-app origin, direct links have a replace fallback, Back/Forward drive route state, and nearby navigation creates ordered history entries.
4. **DIS-01:** national grade buckets now round-robin canonical hubs while keeping stable IDs per hub; explicit hub view remains grade then ID. Tests cover uneven queues, determinism and all 214 unique IDs.
5. **CARD-01 / IMG-02 / IMG-04:** recommendation/title follow the image directly; attribution no longer interrupts that sequence. Cards have fixed-ratio loading, honest missing/error states and a retry of the same local URL.
6. **A11Y-02 / DET-01:** detail uses a labelled modal route wrapper with inert shell/content, initial focus, Tab loop, top-layer Escape protection and exact opener restoration. Existing detail facts/gallery are unchanged; SOL-3 was not started.
7. **PERF-01:** PlaceMap, NationalExplorer and OrderedSequenceBuilder use dynamic React lazy boundaries. Build emits separate map (3.65 kB), national (10.22 kB), planner (127.40 kB), and Leaflet container (152.65 kB) chunks. The remaining initial bundle is 1,136.85 kB and retains a >500 kB advisory; no claim is made that all unrelated legacy code is optimized.
8. **DIS-01 / A11Y-03:** result live output is debounced 200ms; search has a conditional labelled clear button; pagination retains button focus and announces the appended range.

### Verification at correction HEAD

- PASS: `npm test -- --run` — 70 files / 2463 tests.
- PASS: `npm run lint` — no diagnostics.
- PASS with advisory: `npm run build` — dynamic chunks above; initial chunk still >500 kB.
- PASS: dataset, photography, geography, logistics and reservation-mechanism validators.
- PASS: `git diff --check`.
- **PARTIAL visual certification:** no installed Chromium/Chrome/Firefox executable. `npx playwright install chromium` again made five requests for Chrome for Testing 151.0.7922.34 and each returned exact HTTP `403 Forbidden` from `https://cdn.playwright.dev/builds/cft/151.0.7922.34/linux64/chrome-linux64.zip`. No screenshots were fabricated and no viewport/keyboard/network visual PASS is claimed.

### New-audit objective and remaining risks

Astra must re-audit the corrected source and reproduce all required viewports and journeys on a browser-equipped runner, especially byte-equivalent V7 survival after blocked unsave, Back/Forward/nearby history, advanced-filter/map parity, modal/lightbox focus stacking, image retry, and initial-network lazy chunk behavior. Visual items remain PARTIAL until then. The build's initial chunk advisory is recorded. Do not begin SOL-3 before Astra disposes these corrections.

---

## Independent-audit F01–F09 correction checkpoint (2026-09-19)

Starting point was the exact required audit commit `8350d3ea3b2a7b42dbcc55fe1d2df26815d7795a` on the supplied `work` checkout; it is a descendant of the requested implementation history. No later product correction was present.

The bounded correction commit addresses only F01–F09: complete card attribution directly below photography; exact DA-07 recommendation vocabulary/icons/treatments; region entry and per-hub counts inside the hub selector; reusable alertdialog trapping/restoration; preservation of the original live discovery opener through nearby chains; per-history-entry region origin surviving reload; one accessible result status in the active filter layer; relative card typography without description clipping; and removal of the completed image's loading overlay. Canonical data, photography bytes, V7 structures, legacy detail, and SOL-3+ remain untouched.

Verification: all 70 Vitest files (2464 tests), lint, production build, five passive validators, and `git diff --check` pass. The build retains its pre-existing >500 kB initial-chunk advisory. The browser workflow's live-region assertion was corrected to measure the active non-inert layer instead of counting hidden DOM. Browser evidence could not be regenerated in this container: no browser executable is installed, and five Playwright CDN attempts returned HTTP 403. Therefore rendered approval remains **PARTIAL** and no screenshot is fabricated. Astra should execute `ASTRA_EXPECTED_SHA=<final-sha> ASTRA_AUDIT_OUTPUT=<evidence-dir> npm run audit:astra:browser` from `app/` on the browser-equipped PR runner, inspect the produced screenshots/traces, and specifically recheck F01–F09. SOL-3 is not started.

### Evidence-run availability audit (2026-09-19)

A follow-up environment audit found no installed browser or compatible cache. The checkout has no Git remote, `gh` is unauthenticated, no `GH_TOKEN` exists, and anonymous GitHub API access is blocked by the proxy. Consequently this session cannot verify whether the candidate product commit `0a80f44a6bad44f9c83bb25bf45192c34b7874a1` is the remote PR #122 head, publish it, trigger Actions, download an artifact, or attach externally accessible screenshots. The exact inspected workflow, trigger, artifact name, limitations and minimum external action are recorded in `docs/astra/evidence/corrections-0a80f44/README.md`. No visual PASS is claimed.

---

## PR #139: auditoría local y corrección visual (2026-09-23)

La auditoría original se ejecutó sobre `9408e27ec279e6ec80bd27632e656d4f6c265384`: los nueve recorridos automáticos pasaron, pero la captura a 320 px mostró el texto seleccionado recortado en los dos controles rápidos de Explorar. La evidencia original, incluidas capturas y trazas, quedó preservada en `docs/astra/evidence/pr139-local-9408e27-20260923/` mediante el commit exclusivo de documentación `b0e1ad4a40b8c5730790e59e65535bb074147451`.

La causa era de cascada CSS: una regla para hasta 360 px pedía una columna, pero otra regla posterior para hasta 767 px volvía a imponer dos. El commit `95377a20ab06868ac0e5e631a92109a15f08686c` retira la declaración redundante y apila los controles hasta 480 px después de la regla de 767 px. Los anchos mayores conservan el diseño previo. No se cambiaron datos, dependencias, lockfile, runner ni pruebas.

Desde ese commit, con checkout limpio y `ASTRA_EXPECTED_SHA=95377a20ab06868ac0e5e631a92109a15f08686c`, el runner produjo nueve PASS nuevos en `docs/astra/evidence/pr139-corrected-95377a2-20260923/`. La revisión visual de las capturas nuevas y la comprobación complementaria de los dos selectores en 320, 375, 390, 430, 768, 1024 y 1440 px confirman texto completo, cero desbordamiento horizontal y controles operativos. Se inspeccionaron también las capturas nuevas de fallo de guardado en Explorar, ficha y Nuestro viaje. Esto resuelve el defecto visual concreto; la automatización por sí sola no certifica todos los aspectos editoriales ni de accesibilidad.

Lint y build terminaron con código 0; las 24 pruebas específicas de Astra pasaron. La suite completa de Vitest terminó con tres fallos preexistentes de comparación literal de código fuente que espera LF y recibe CRLF en este checkout Windows (dos de OrderedSequenceBuilder, uno de feb-mar-status). No se modificaron ni debilitaron esas pruebas. El detalle está en `docs/astra/evidence/pr139-corrected-95377a2-20260923/CORRECTED_AUDIT_REVIEW.md`.

No hubo push, merge ni otro PR. La API pública de GitHub confirmó el SHA original como HEAD del PR #139 antes de estos commits locales. Git CLI sigue bloqueado por TLS de Schannel/Norton y `gh` informa de un token inválido; son problemas separados. Para publicar, verificar otra vez el HEAD remoto, resolver el acceso mediante mecanismos autorizados, trasladar los commits locales y ejecutar los controles de CI de la rama del PR. El bundle local verificado acompaña este handoff fuera del checkout.

---

## SOL-3 — DETAIL AND GALLERY (2026-09-25)

### Identidad de checkout

- Base exacta usada: `b2ae3877111e2b207ca7e7f452bd9e4f30ec12f1`; tree verificado: `753202881846603ed83a44b211bf5e8431ff9a15`.
- Rama: `codex/astra-sol-3-detail-gallery`.
- Commit final: el commit `astra(sol-3): implement detail and accessible gallery` que contiene este handoff; el SHA se comunica junto al handoff porque un commit no puede incluir de forma autorreferencial su propio SHA.
- El checkout inicial estaba limpio y coincidía exactamente con el HEAD Astra solicitado. El contenedor no incluía un remoto; se configuró `origin`, pero tanto `git fetch origin` como la descarga de Chromium fueron bloqueados por el proxy con HTTP 403. No se inspeccionó, incorporó ni mezcló ninguna rama Claude, ni se modificó `main`.

### Archivos y comportamiento implementado

- `app/src/components/PlaceDetail.tsx`: ficha progresiva con señal Feb–Mar visible, campos prácticos completos en disclosures ordenados, fuentes y actualización, enlaces oficiales descriptivos, navegación nearby y nota de confianza preservadas, y acción de interés persistente fuera del área desplazable.
- `app/src/components/PlaceGallery.tsx`: estados honestos para cero, una o varias imágenes; controles sólo para múltiples imágenes; imagen inicial eager y posteriores lazy; error de tamaño estable y retry sobre la misma URL; swipe con umbral de 40 px y discriminación de eje; teclado; fullscreen `contain`; atribución completa tanto en ficha como en fullscreen; Escape de capa superior y restauración del foco al opener.
- `app/src/astra/Disclosure.tsx`, `app/src/astra/astra.css` y `app/src/App.css`: primitive nativo accesible, detalle móvil de altura completa, diálogo desktop 52/48 de dos columnas, galería izquierda sticky, columna derecha desplazable, footer CTA persistente, targets de 48 px, safe area y reduced motion sin animación.
- `app/src/components/PlaceGallery.sol3.test.tsx` usa tres URLs distintas marcadas explícitamente como **test-only**; no se añadieron imágenes ni se duplicó ninguna imagen real. `app/src/astra/RouteDialog.sol3.test.tsx` cubre foco inicial, trap, inert, Escape y restauración exacta.
- No cambiaron dataset, IDs, metadata/bytes fotográficos, parsers de dominio, V7, backend, autenticación ni funcionalidad SOL-4+.

### Verificación

- `npm test -- --run`: PASS, 74 archivos / 2484 pruebas. Incluye 0/1/3 imágenes, atribución larga, fallo/retry, gestos vertical/horizontal, teclado/fullscreen/foco, modal/inert/restore, y las regresiones existentes de nearby/Back-Forward, persistencia, planes V7 y guardados.
- `npm run lint`: PASS con tres warnings preexistentes fuera del diff (`App.tsx`, `useSavedPlaces.ts`, `Discovery.tsx`); no se introdujo un warning nuevo.
- `npm run build`: PASS. Permanece el advisory preexistente de chunk inicial superior a 500 kB.
- PASS: validadores pasivos de dataset (214 lugares, 403 relaciones, 13 warnings secundarios preexistentes), fotografía, geografía, logística y mecanismos de reserva.
- PASS: `git diff --check`.

### Auditoría visual y riesgos

**PARTIAL real:** no existe ejecutable Chromium/Chrome/Firefox en el contenedor. `npx playwright install chromium` intentó cinco veces Chrome for Testing 151.0.7922.34 y recibió HTTP 403 en cada intento. Por ello no se fabrican capturas ni se declara PASS visual para 320, 375×812, 390×844, 430×932, 768×1024, 1024×768 o 1440×900. La semántica y geometría están cubiertas por código, tests DOM, lint y build, pero necesitan inspección renderizada independiente, incluido zoom 200%, teclado real, créditos largos, CTA, fullscreen y retry.

### Siguiente objetivo exacto

Astra debe auditar SOL-3 de forma independiente en un runner con navegador real, ejecutar los siete viewports requeridos y el golden journey de galería (0/1/3 imágenes, fallo/retry, swipe, fullscreen, Escape por capas y restauración de foco). Corregir únicamente hallazgos SOL-3 P0/P1. No iniciar SOL-4, no fusionar a `main` y no desplegar producción.

---

## Corrección PR #149 — persistence gate y modal stack (2026-09-25)

### Identidad remota autorizada

- Base remota Astra: `b2ae3877111e2b207ca7e7f452bd9e4f30ec12f1`.
- HEAD remoto anterior real del PR #149: `5b7987493beb75bf10fcf27c33262d53876c0f07`.
- Rama del mismo PR: `codex/implementar-sol-3-detalle-y-galeria`.
- El SHA local histórico `bc6b665cd6512dad97a0f04fbac3cd60daca638a` **no es ni fue el HEAD publicado de PR #149**. La referencia anterior se conserva sólo como explicación histórica y no debe utilizarse como identidad remota.

### Diagnóstico y correcciones

- Journey 09 fallaba únicamente por un gate obsoleto: buscaba el antiguo nombre visible `Guardado en Quiero ir`, mientras DA-06 permite y SOL-3 presenta el estado seleccionado como `Quiero ir ✓`. No existía evidencia de un defecto de persistencia en ese fallo. El journey ahora exige exactamente `button.save-button[aria-pressed="true"]`, confirma el estado seleccionado antes de pulsar y conserva todas las comprobaciones de alert único, retry visible y >=44 px, recuperación durable y supervivencia byte-exacta del plan V7.
- Al abrir fullscreen, la ficha modal padre se marca `inert`. Al cerrar fullscreen se retira primero ese aislamiento y después se restaura el foco exactamente al botón de apertura. El lightbox sigue atrapando Tab/Shift+Tab y consume el primer Escape; el segundo Escape pertenece a `RouteDialog`, cierra la ficha y restaura el opener de la tarjeta.
- Journey 05 abre ahora el fullscreen real, comprueba foco inicial, ficha inferior inert, veinte ciclos de Tab, Escape por capas y ambas restauraciones de foco.
- Journey 01 abre fichas en los siete viewports, genera evidencia de detalle con una imagen y estado sin imagen, y en 375×812 y 390×844 comprueba el CTA antes y después de llevar el scroll interno al final: footer y botón visibles, botón >=48 px, dentro del viewport y sin overflow horizontal.
- El workflow, artifact, job y summary se denominan ahora `Astra SOL-0–SOL-3 browser audit`; no se alteró su arquitectura.

### Ejecución local y publicación

- PASS local: sintaxis del runner, cinco validadores pasivos y `git diff --check`.
- LIMITACIÓN local: el primer `npm test` detectó que la imagen del contenedor no tenía `jsdom`. `npm ci` intentó reparar dependencias pero el proxy respondió 403 para paquetes npm y dejó `node_modules` incompleto; por ello esta ejecución local no puede presentar nuevos resultados de Vitest/lint/build ni instalar Chromium. Los resultados verdes del HEAD remoto anterior no se reinterpretan como resultados de esta corrección.
- La auditoría corregida debe ejecutarse en GitHub Actions sobre el HEAD publicado y producir 9/9 sólo si todas las nuevas aserciones pasan. Los siete viewports declarados son 320×800, 375×812, 390×844, 430×932, 768×1024, 1024×768 y 1440×900.
- No se modificaron datos, fotografía canónica, parsers, V7, `experiment/astra-redesign`, `main` ni trabajo Claude. No se inició SOL-4.

---

## Corrección final pendiente PR #149 — CTA y tabbables (2026-09-25)

- HEAD remoto inicial confirmado por el propietario del PR: `515af3a2f9e1844fc23f89354dcf1977468a2b78`; base Astra inalterada: `b2ae3877111e2b207ca7e7f452bd9e4f30ec12f1`.
- Causa de `01-viewports`: en móvil `.place-detail__scroll { height: 100% }` ocupaba toda la altura disponible dentro del layout y desplazaba el footer fuera del viewport. La columna ahora es un contenedor flex vertical y el scroll usa solamente el espacio restante mediante `flex: 1 1 auto`, `min-height: 0` y `height: auto`. El grid desktop 52/48 permanece intacto.
- Causa de `05-modal-focus`: el focus trap enumeraba links, botones y `tabindex`, pero omitía el `summary` nativamente tabbable. Con créditos cerrados, el navegador podía enfocar el summary y el siguiente Tab escapaba porque el trap no lo reconocía como último control. La enumeración incluye ahora `summary`, controles de formulario y tabindex; filtra disabled/tabindex=-1, ancestros hidden/inert/aria-hidden, estilos no visibles y links dentro de `details` cerrado. Al abrir créditos, los links de fuente/licencia se incorporan a la secuencia.
- El test SOL-3 verifica summary cerrado como límite, links de créditos al abrirlo, wrap adelante/atrás, detail padre inert, Escape superior y restauración del opener.
- Validadores pasivos y `git diff --check`: PASS. Lint: código 0 con los tres warnings preexistentes. La suite alcanzó 70 archivos / 2465 pruebas no-jsdom PASS, pero cuatro archivos jsdom no pudieron arrancar porque la imagen suministrada carece de `jsdom`; `npm install --offline` confirmó que faltan tarballs y el proxy impide recuperarlos. Build quedó bloqueado sólo por los tipos de `@testing-library/react` ausentes tras esa instalación incompleta.
- No hay Chromium instalado localmente y el remoto no es accesible desde este contenedor (`CONNECT tunnel failed, response 403`). Por ello no se declara un 9/9 nuevo ni un HEAD remoto publicado sin evidencia. El workflow del PR debe ejecutar los nueve journeys y los viewports 320×800, 375×812, 390×844, 430×932, 768×1024, 1024×768 y 1440×900 después de publicar el commit correctivo.
- No se tocaron `main`, ramas Claude, dataset, IDs, fotografía, parsers ni V7. SOL-4 no se inició.

---

## SOL-4 — Votes, review queue and legacy bridge (2026-09-26)

### Identidad

- Base inicial exacta: `8b992df8cced8ab3199bec50db2b0515ca9f948b` (merge de SOL-3).
- Rama: `codex/astra-sol-4-votes-review-legacy`.
- El checkout inicial estaba limpio y la base local era exacta. Se intentó primero `git fetch origin`, pero el proxy devolvió `CONNECT tunnel failed, response 403`; por ello la comprobación remota y publicación requieren el runner externo. No se inspeccionó ni mezcló ninguna rama Claude; `main` local continúa apuntando al objeto requerido `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.

### Store y reglas

- Nuevo store local versionado `nihon.astra.review.v1`, schema `nihon.astra.review`, versión 1. Personas estables `fernando` y `ella`; cada registro conserva votos independientes `unreviewed/yes/no`, pertenencia a review queue, marcador legacy, disposition opcional `candidate/shortlisted/discarded` y prioridad opcional. “Ambos”, textos, buckets y conteos son derivados.
- El parser ignora registros parciales inválidos, pero bloquea escrituras sobre JSON malformado o una versión futura. Una escritura fallida conserva el último estado durable, muestra error y conserva exactamente el estado deseado para Retry.
- El primer interés sin reviewer abre “¿De quién son estos gustos?”, muestra honestamente “Dos perfiles en este dispositivo” y sólo una confirmación persiste en una operación el reviewer y el yes pendiente. Cancelar no escribe. El selector visible permite cambios deliberados.
- `yes` retirado vuelve a `unreviewed`, conserva queue y ofrece “Interés retirado · Deshacer”. `no` es explícito y sólo actúa sobre el reviewer activo. Discard conserva votos; restore vuelve a candidate; un yes sobre discarded exige reconsideración.

### Legacy y planner

- La lectura de `nihon.savedPlaceIds` crea únicamente una proyección en memoria como queue legacy “Guardado anterior · Sin asignar”; no escribe ni normaliza esa clave ni `nihon.manualPlanningDraft`.
- “Estos guardados son míos (N)” exige reviewer y confirmación, asigna sólo a esa persona y guarda un único marker versionado con los IDs. Una segunda claim es un no-op; cancelar no cambia nada. Los nuevos yes se escriben sólo en review v1.
- Elegibilidad del planner: `set(legacy saved IDs) ∪ set(disposition === shortlisted)`, más los IDs ya detectados en el plan authored para su protección al abrir el editor. Nunca se calcula desde reviewer, likes, filtros, cards o búsquedas. Ninguna mutación de review llama reconcile ni escribe el draft V7.

### Archivos y pruebas

- Modelo/adaptadores: `app/src/astra/review.ts`, `review-migration.ts`, `useReview.ts`.
- Integración mínima: `App.tsx`, `AppShell.tsx`, `Discovery.tsx`, `PlaceCard.tsx`, `astra.css`.
- Cobertura: `review.sol4.test.ts` (30 pruebas SOL-4) más actualización de la aserción de integración del puente planner. Incluye tabla completa, independencia, transiciones, undo, disposition/priority/queue, claims, parser, roundtrip, fallo/retry y unión de elegibilidad.
- Auditoría: el runner y workflow se denominan SOL-0–SOL-4. El journey 09 cubre onboarding/cancel/yes pendiente, cambio deliberado, yes/yes, reload, legacy unassigned, confirmación/cancel/idempotencia, V7/legacy byte-stable y storage failure/retry. Los nueve journeys históricos siguen presentes.

### Resultado y riesgos

- PASS local: 34 pruebas focales, lint (sólo tres warnings preexistentes), cinco validadores pasivos, sintaxis del runner y `git diff --check`.
- Suite amplia: 70 archivos / 2492 pruebas pasaron; un gate literal antiguo se actualizó al puente aditivo SOL-4 y pasa focalmente. Cuatro archivos jsdom no arrancaron porque esta imagen carece de los paquetes ya declarados `jsdom`/`@testing-library/react`; el proxy bloquea su recuperación. Build queda limitado por esos tipos ausentes, no por diagnósticos del código productivo.
- Browser: no se declara PASS local. Playwright localiza un binario cacheado, pero el build previo requerido está bloqueado porque la instalación incompleta carece de `@testing-library/react` y el proxy impide repararla; no se ejecutó un audit contra un bundle nuevo. GitHub Actions debe ejecutar el workflow sobre el SHA remoto exacto y Astra debe inspeccionar evidencia.
- P0: ninguno observado en pruebas fuente. P1: auditoría browser/render independiente pendiente por limitación ambiental. P2: warning preexistente de bundle y warnings lint preexistentes.
- No cambiaron dataset, IDs, fotografía/metadata, parsers de dominio ni V7. SOL-5 no se inició.

---

## Corrección SOL-4 para PR #150 (2026-09-26)

### Identidad y diagnóstico

- HEAD remoto inicial comunicado y verificado por el propietario del PR: `0a04f8fc80f08651d37cdcc94d9808c2a48c1627`; base Astra: `8b992df8cced8ab3199bec50db2b0515ca9f948b`; rama real: `codex/implementar-sol-4-para-revision-y-votos`.
- Este contenedor conserva el tree SOL-4 equivalente, pero `git fetch origin` continúa bloqueado por el proxy (`CONNECT tunnel failed, response 403`), de modo que el objeto remoto `0a04f8fc…` no pudo importarse localmente. La corrección se mantiene en la rama real indicada y debe publicarse sobre ese PR sin abrir otro.
- Los cinco fallos Astra iniciales eran cuatro expectativas históricas pre-SOL-4 (`Explorar lugares`, dos referencias a `Me gustaría ir`, `☆ Lorena`) y un flujo de persistencia detail que omitía establecer reviewer. Esas pruebas se actualizaron sin skip ni reducción: ahora demuestran las mismas garantías con `Explorar Japón`, nombres accesibles `Quiero ir a … como …`, review store v1 durable y mutaciones DA-09.

### Correcciones

- Reconsideración atómica: `reconsiderWithYes` produce en una sola transición y un solo commit `candidate + own yes + queue`, conservando el voto del partner. Cancelar no ejecuta transición.
- Undo durable: el toast `Interés retirado · Deshacer` sólo se crea cuando el commit de `yes -> unreviewed` devuelve éxito. Ante fallo permanece el `yes` durable, se muestra PersistenceNotice, no hay toast falso y Retry aplica la mutación pendiente antes de mostrarlo.
- “Quitar de pendientes”: `useReview` expone la transición; la UI sólo la muestra para queue completamente unreviewed, no legacy y no protegida por `readAuthoredPlanIds`. No cambia votos, disposition, legacy ni V7.
- “Restablecer mi respuesta”: lleva sólo el voto del reviewer activo a `unreviewed`; partner, queue, disposition y planner permanecen intactos.
- Primer reviewer: antes del primer interés el header muestra `Mis gustos` sin selector mutable. El primer CTA abre el onboarding; Cancel no escribe, y elegir persona persiste reviewer + yes pendiente en un único commit. El selector deliberado aparece sólo después.
- Foco: onboarding, claim legacy y reconsideración capturan el opener real y lo pasan a `RouteDialog`; el trap, Escape de capa superior y restauración exacta quedan cubiertos en jsdom/browser.

### Pruebas y auditoría

- `review.sol4.test.ts` añade reconsideración/Cancel, bloqueo de queue con voto y reset preservando partner/queue/disposition. La integración fuente exige el helper atómico y prohíbe la secuencia antigua.
- `night-ui-corrections.test.ts` prueba las tres superficies con fallo exclusivo de `nihon.astra.review.v1`, último estado durable, alert único, Retry, bytes legacy/V7, ausencia de Undo falso, nombres accesibles, onboarding y restauración de foco, claim, reset y queue removal.
- Journey 09 mantiene los ocho journeys anteriores y amplía onboarding/cancel/foco, switch sin voto, ambos/reload, claim lossless/idempotente, bytes legacy/V7, fallo/retry, Undo durable, reset, queue removal y reconsideración cancel/confirm atómica.
- Verificación local disponible: 38 pruebas puras/integración PASS; `src/astra` no-jsdom 49 PASS; lint directo PASS con tres warnings preexistentes; cinco validadores pasivos PASS; runner syntax y `git diff --check` PASS. La instalación local de npm sigue incompleta (`jsdom/index.js` y resolución de `@testing-library/react` ausentes), por lo que jsdom, full suite, build y browser real quedan para Actions y no se declaran PASS localmente.
- HEAD remoto final: pendiente de push/Actions desde un entorno con acceso GitHub. No se tocó main, dataset, fotografía, parsers ni V7; no se inspeccionó ni mezcló Claude; SOL-5 no se inició.
