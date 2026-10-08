# Handoff reanudable — P-06 v2 INTEGRADO en main; pendientes del proyecto clasificados

## Correcciones de la auditoría final independiente (2026-10-06, PR sin fusionar)

Rama `claude/final-audit-data-recovery-fixes-l60xs9` sobre `52503a9` (árbol `app/` idéntico a `32787a1`). Corrige H01–H07 de la auditoría
y deja la investigación del gate de rendimiento: [FINAL_AUDIT_FIXES.md](FINAL_AUDIT_FIXES.md),
[FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md](FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md), evidencia histórica en [`final-audit-evidence/`](https://github.com/Z3roM4str/-nihon-travel-explorer/tree/2fd30dba0bed550afb5b742238da41537c2e34b7/docs/final-audit-evidence/) (retirada del árbol; ver [PR203_EVIDENCE_INDEX.md](PR203_EVIDENCE_INDEX.md)).
**Nada de esto está publicado**: freeze de Vercel intacto, sin autorización de publicación; la producción sigue en `dpl_Fu2dABdW5xohuo6cV9kMkyeh6whV` (`32787a1`).

## CIERRE FINAL PARA REVISIÓN (2026-10-06) — baseline de esta entrega

- **SHA integrado en `main`:** `32787a1661665f53bba5dfcf73d630709a698ad2` (merge commit de [#199](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/199); cierra [#197](https://github.com/Z3roM4str/-nihon-travel-explorer/issues/197)). Línea definitiva: **Claude**; Astra queda fuera.
- **Certificado sobre ese SHA** en WebKit (Playwright) y Chromium, GitHub Actions: `P-06 certificación` [run 37396856738](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37396856738) y B26 ×5 por motor [run 37396891972](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37396891972), todo en verde. Esto **no** certifica Safari/iPhone físicos ni lectores de pantalla.
- **Producción actual (publicada el 2026-10-06 con autorización expresa):** deployment `dpl_Fu2dABdW5xohuo6cV9kMkyeh6whV`, SHA **`32787a1661665f53bba5dfcf73d630709a698ad2`**, READY, URL https://nihon-travel-explorer.vercel.app. **Contiene la corrección de foco de #199.** Los pushes posteriores a `main` solo añaden documentación y no están publicados. Detalle, procedimiento y verificación en [DEPLOYMENT_POLICY.md](DEPLOYMENT_POLICY.md). Rollback disponible: `dpl_2eiLZExrgQzUrVRUCVusgPCf9Cc5` (`592c0c4`), no tocado.
- **Freeze de Vercel (comprobado):** Ignored Build Step `exit 0` activo; los pushes a `main` generan deployments **CANCELED**. **No hay autorización para publicar automáticamente desde `main`**; la autorización de publicación única de `32787a1` quedó consumida.
- **Diseño actual = baseline.** Las propuestas visuales abiertas son **mejoras posteriores**, no requisitos incumplidos: ningún documento demuestra un requisito no cumplido ni un problema de accesibilidad en ellas (B10-A1…A4 ya se cerraron). **Ninguna está implementada:** `zone-fact--strong`, D0b-01/02 (incluye `viewport-fit=cover`), EvidenceMark 11/12, B10-M1…M6, B10-C1, D5-M1 y el atajo a «sin alojamiento esa noche». OD-01 modo oscuro: POST-V1 / diferido.

### Recorrido breve para revisar desde el iPhone

URL de producción: **https://nihon-travel-explorer.vercel.app** (sirve `32787a1`; si Vercel pide iniciar sesión, es la protección del proyecto).

1. **Portada → Viaje:** abre la app, entra en «Viaje» y en «Días»; comprueba la lista de días y que el scroll no corta contenido a los lados (notch/barra inferior).
2. **Hojas y vista de un día:** abre un día («Detalles del día»), una hoja y «Cambiar orden» (Subir/Bajar). Con el gesto «atrás» de iOS debe cerrar hoja o vista antes de salir de Días (**pendiente de prueba física**).
3. **Sin alojamiento esa noche:** sólo debe aparecer en «Detalles del día».
4. **Nosotros › Viajeros:** pulsa «Usar este dispositivo como …». Tras pulsar, el foco debe quedar en «Este dispositivo lo usa …»; con VoiceOver activo, anota si salta al inicio de la página (pendiente de prueba física).
5. **Reflexión:** anota cualquier recorte, tap < 44 px o desbordamiento horizontal.

Pruebas físicas pendientes (no son defectos confirmados): Safari/iPhone reales, gesto «atrás» de iOS, teclado/IME, barras dinámicas, VoiceOver/TalkBack/NVDA.

## Estado vigente — P-06 v2 CERRADO E INTEGRADO EN MAIN

- PR [#196](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/196) MERGED mediante merge commit `592c0c46435dd61d4b2ef84566c4fdb75f53c56d` (padres `de4b190b…` y `4bad1815…`; árbol `fdd05933…` idéntico al del HEAD del PR). Detalle, tablas y artefactos: [P06_V2_CERTIFICATION.md](P06_V2_CERTIFICATION.md) («Integración en `main` y certificación post-merge»); arquitectura: [P06_V2_ARCHITECTURE.md](P06_V2_ARCHITECTURE.md).
- **Certificado sobre el SHA integrado** en **WebKit 26.5 y Chromium** (GitHub Actions, `p06-certification.yml`, run 37361031993): `RESULT fail=0` en ambos. Esto es WebKit de Playwright, **no Safari ni iPhone**.
- **Pendientes explícitos de P-06:** (1) Safari/iPhone físicos y gesto «atrás» real de iOS; (2) lector de pantalla (VoiceOver/TalkBack/NVDA). El issue [#197](https://github.com/Z3roM4str/-nihon-travel-explorer/issues/197) (B26 `K-FOCUS-VISIBLE`) tiene corrección en PR aparte: era un **defecto real de foco**, no una carrera del gate (ver [P06_V2_CERTIFICATION.md](P06_V2_CERTIFICATION.md)).
- «Sin alojamiento esa noche» permanece **sólo** en «Detalles del día» (decisión cerrada).
- **Vercel — publicación inesperada registrada:** el merge `592c0c4` creó el deployment `dpl_2eiLZExrgQzUrVRUCVusgPCf9Cc5` (origen `git`, entorno **production**, estado READY, `githubCommitSha` = `592c0c46435dd61d4b2ef84566c4fdb75f53c56d`, creado 2026-10-05 ≈19:06 UTC) y **llegó a producción**: los alias `nihon-travel-explorer.vercel.app`, `nihon-travel-explorer-z3ro2.vercel.app` y `nihon-travel-explorer-git-main-z3ro2.vercel.app` apuntan a él. Causa: `app/vercel.json` mantiene `main: true` (por diseño de [DEPLOYMENT_POLICY.md](DEPLOYMENT_POLICY.md)), de modo que todo merge a `main` publica en producción; ya había ocurrido con #190, #191, #193 y el commit `7878632`. Contención aplicada el 2026-10-05 (autorizada, mínima y reversible): Ignored Build Step del proyecto = `exit 0` (omite todo build nuevo). No hubo rollback, ni borrado de deployments, ni cambios de dominio o Production Branch; `app/vercel.json` no se modificó. Verificado: el push de #198 (`ebd6ae8`) creó `dpl_4crhCtFAk8R8e2MtYigHQETX5XKd` en estado **CANCELED**; no se publicó nada y producción sigue en `dpl_2eiLZ…`. (La API no devuelve el campo en lectura; la prueba es el comportamiento.) Revertir = restaurar el campo a vacío en Settings › Git.

### Pendientes para terminar el proyecto (plan vigente de la línea Claude)

El roadmap de bloques está completo (B1–B10 cerrados; sin «B11»); P-06 cierra el último hallazgo UX conocido de Días. Lo que queda es deuda, validación física y decisiones:

**A. Puede resolverlo Claude (sin revisión directa tuya salvo el merge del PR resultante)**

| # | Pendiente | Nota |
|---|---|---|
| ~~A1~~ | ~~Issue #197~~ **RESUELTO en PR aparte** (causa demostrada: `TravellerManager` consumía el destino de foco antes de que existiera el elemento) | Defecto real de producto, no del gate |
| A2 | Llevar a `NIHON_BROWSER` (WebKit) los gates que siguen Chromium-only: Phase 3F-f/h/j/s, Block 4/6, Phase 5A, B25, y añadirlos al workflow | Ampliar CI: lo haría tras tu visto bueno al alcance |
| A3 | Deuda de ingeniería: `local-swap__*` y otras reglas CSS muertas, primitivos `.tag/.alert/.badge/.person-token` de `App.css`, deuda de media queries, APIs L3/L4 de `planning-draft` y modos modales no `embedded` sin consumidor | Retirar exige reescribir tests de dominio; acotar por PR |
| A4 | Actualizar README/`RELEASE_*` y `RELEASE_CERTIFICATION.md` con P-06 y con la certificación WebKit automatizada de CI | Documental |
| A5 | Ejecutar periódicamente `p06-certification` sobre `main` (p. ej. `push` a `main`) para detectar regresiones | Cambio de workflow |

**B. Requiere tu revisión directa o decisión**

| # | Pendiente | Por qué |
|---|---|---|
| B1 | **Safari/iPhone físicos** (gesto «atrás», teclado/IME, barras dinámicas, rendimiento) y **lector de pantalla** real sobre Días, hojas y vistas | Hardware/persona; WebKit de Playwright no los sustituye |
| B2 | **Vercel:** decidir si se mantiene el Ignored Build Step provisional o se corrige la política (`main: true` publica en cada merge); revisar el deployment de producción `dpl_2eiLZ…` ya publicado; cualquier otro cambio de freeze, Production Branch, dominios o deployment manual | Requiere autorización expresa (`DEPLOYMENT_POLICY.md`) |
| ~~B3~~ | ~~Elección Astra/Claude~~ **RESUELTO:** Claude es la implementación definitiva. Astra queda fuera; sus ramas no se mezclan ni se borran | Decisión confirmada 2026-10-05 |
| B4 | **Decisiones de Producto/Diseño abiertas (no bloquean el cierre; ninguna es un defecto confirmado):** `zone-fact--strong` (B30 retiró el énfasis sin decisión documentada; `GATE_RETIREMENT_AUDIT.md`), D0b-01/02, EvidenceMark 11/12, B10-M1…M6 (DDR de movimiento registrados, sin decisión estética inventada), B10-C1 (voz «guardar/guardado»), atajo opcional a «sin alojamiento esa noche» desde la tarjeta | Son decisiones, no defectos; se resuelven o se aceptan tal cual |
| B5 | **Diferido (POST-V1, fuera de la versión actual):** OD-01 modo oscuro (`design/09`, `design/10 §B10`); fotografías reales de zona; OSM/recursos externos en red real. **Resuelto y cerrado:** B10-P1, B10-A1…A4, D5-M1, «sin alojamiento esa noche» sólo en «Detalles del día», elección Astra/Claude | No se implementa nada de esto en el cierre |
| ~~B6~~ | ~~Fusionar el PR documental de cierre~~ **RESUELTO:** autorizado; se integra mediante merge commit si los checks requeridos pasan | Decisión confirmada 2026-10-05 |

## Anterior — B10 «Pulido» CERRADO E INTEGRADO EN MAIN

- PR [#179](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/179) MERGED mediante merge commit `c512db15a1d253a1c6704ad0798f80dea142e173` (padres `2a10ad3f…` y `538d2ebf…`; tree idéntico al certificado `c781f598…`). Certificación post-merge: [B10_POST_MERGE_CERTIFICATION.md](B10_POST_MERGE_CERTIFICATION.md). Fallos exclusivos: 0.
- Certificación D0b+D5 del merge `2a10ad3`: [D0B_D5_POST_MERGE_CERTIFICATION.md](D0B_D5_POST_MERGE_CERTIFICATION.md) (integrada por #180).
- **`design/10_ROADMAP_DE_BLOQUES.md` no define ningún bloque posterior a B10** (B1–B10 completos; B6 con tandas B6.1–B6.7 cerradas aparte). No existe «B11»: no se inventa. El trabajo restante es deuda/DDR (abajo), no un bloque oficial.
- Contenido, matrices y deuda de B10: [B10_POLISH_HANDOFF.md](B10_POLISH_HANDOFF.md) y [B10_POLISH_MISSION.md](B10_POLISH_MISSION.md).

### Certificación final de release (PR #189 + este informe)
`main` certificado: merge commit `e124591b19f9f241a38091598faf2c1d27b554e4` (tree `896c2b50…`; padres `a8350d4` + `ed8c589`). Informe único: [RELEASE_CERTIFICATION.md](RELEASE_CERTIFICATION.md) (reconciliación Vitest 3501→3421, B21, 64 gates en Chromium, WebKit 26.5, lint completo, cifras B10-P1). Veredicto: **RELEASE CANDIDATE CERTIFICADO** (alcance automatizable); Safari/iPhone y lector de pantalla físicos siguen pendientes.

### Endurecimiento post-B10 (cerrado, PRs #183–#187)
Sin bloques nuevos ni cambios de dataset/fotos. Cerrado: B10-P1 (entrada con proyección runtime de metadatos, ver `B10_P1_*`), B10-A1…A4 (landmark `main`, `h1`, «Viaje · Días», zoom de Leaflet ≥ 44 px por `::after`; cero diferencia de píxeles), D5-M1/B10-C2 (vistas `builder`/`compare` retiradas con prueba de inalcanzabilidad, `D5_M1_UNREACHABLE_VIEWS_RETIREMENT.md`), gates obsoletos reescritos/archivados (`GATE_RETIREMENT_AUDIT.md`, `GATE_AUTHORITY.md`) y panel heredado de intercambios (`LEGACY_SWAP_RETIREMENT.md`). OD-01 sigue POST-V1 / DIFERIDO. B10-M1…M6 y B10-C1 documentados (`B10_MOTION_SPEC.md`, `B10_C1_SAVE_VOCABULARY.md`), sin rediseño.

### Deuda vigente (clasificada)
| Ítem | Naturaleza | Quién resuelve |
|---|---|---|
| OD-01 modo oscuro | **POST-V1 / DIFERIDO** | — |
| B10-M1…M6, B10-C1 | documentados; cualquier cambio es decisión de Producto/Diseño | Producto/Diseño |
| D0b-01, D0b-02, EvidenceMark 11/12, media queries | deuda heredada | Diseño |
| Modos modales no `embedded` de `ZoneComparison`/`OrderedSequenceBuilder`; APIs L3/L4 de `planning-draft` sin consumidor de UI | código sin consumidor; retirar exige reescribir tests de dominio | Ingeniería |
| B30 retiró `zone-fact--strong` sin decisión documentada | decisión de diseño | Producto/Diseño |
| ~~B21 «restaurar scroll de la búsqueda global»~~ | **CERRADO**: carrera del gate (animación `sheet-rise` + reintento de Playwright), no defecto de producto; gate corregido (`B21_ROOT_CAUSE.md`) | — |
| `App.css`: primitivos `.tag/.alert/.badge/.person-token` | deuda técnica menor | Ingeniería |
| Safari/iPhone, WebKit y lector de pantalla reales; fotos reales de zona; OSM/recursos externos | restricción física/externa | humano |

## Anterior — D0b + D5 reconciliados sobre main (integrados, #178)

- Base exacta `b854db384c952e827b86d1bb35cac7caa70b035a`. Rama `claude/integration-d0b-d5-current-main`. La rama histórica `claude/d0b-design-system-hygiene` (PR #174 OPEN) es fuente de intención: **no se fusiona** la cadena Claude (#174 → #173 → #170 → #168 → #166/#165 → #163).
- Matriz A/B/C/D, adaptaciones, certificación Chromium/WebKit y auditoría visual: [D0B_D5_MAIN_RECONCILIATION_HANDOFF.md](D0B_D5_MAIN_RECONCILIATION_HANDOFF.md).
- Fallos exclusivos de la reconciliación: 0. Heredados en main inicial (idénticos antes/después): phase5a (A14/C01/C06), integración B24+B23 56/58, phase3f-h/j/s (gates obsoletos), block4.
- Abiertas (no se cierran): D0b-01, D0b-02, EvidenceMark 11/12, D5-M1 (vistas «builder»/«compare» no alcanzables con copy prohibido). OD-01 es POST-V1 / DIFERIDO: no bloquea el cierre de la versión actual.

## Anterior — B31 / B9.5 cerrado; B10 pendiente

## Estado vigente — B31 / B9.5 CERRADO E INTEGRADO EN MAIN

- PR [#175](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/175) MERGED `2026-10-01T03:51:31Z` mediante merge commit `cde9b14bc9e456270576c8dafe0243ddb8c650db`.
- Main pre-merge / primer padre: `393ef2b2a1a2db0641d3785b7e7cf155c914fa5c`. Segundo padre / HEAD certificado: `c00a35da6ab26d4ccf3389fad6f265f1c06a6868`, rama `codex/block-31-b9-5-reservas-resumen`. Tree del merge = certificado: `4e0ad7437ce48e0ca40de1bdf6848445d35b080f`.
- Preflight remoto exacto: OPEN, Ready for Review, MERGEABLE/CLEAN. GitHub no configura checks requeridos y publica cero checks/statuses para ese HEAD. Certificación local corresponde al código publicado; entre implementación `9761817f0d7acfcff418145c36e14615b2840760` y HEAD sólo cambian documentos.
- Post-merge en el merge exacto: build/lint PASS (warning PlaceMap y aviso de bundle heredados), Vitest 115 archivos/3479 PASS, invariantes 231 PASS, B31 Chromium/WebKit 281/281 y B30 475/475 por motor, B29 163/163, B28 anidado/aislado 64/64, B27 A–K en ocho viewports, B26 314/314, B18 15/15, diff check PASS. Todo a la primera; no reaparecieron los antecedentes B26/B28 ni se observaron nuevas regresiones.
- Reservas/Resumen, DDR-05, conservación y navegación quedan cerrados. Informe y hashes de evidencia: [BLOCK_31_MAIN_CERTIFICATION.md](BLOCK_31_MAIN_CERTIFICATION.md) y [BLOCK_31_POST_MERGE_EVIDENCE.json](BLOCK_31_POST_MERGE_EVIDENCE.json).
- Main final es el commit documental posterior que contiene este cierre; SHA recuperable con `git log -1 --format=%H -- docs/BLOCK_31_MAIN_CERTIFICATION.md`. Sólo documentación sobre el merge certificado; push normal, sin sobrescribir cambios remotos. Checkout de integración: `b31-close`; se preservan los artefactos anteriores.
- #168 sigue OPEN/Draft en `1444e67805c60cf9a33f4be5c1a3808b900e505b`; no se toca. Sin cambios en `claude/*`, Astra, datasets, fotografía, adquisición B6 ni Vercel/deploy.
- Pendientes: Safari/iPhone y lector de pantalla físicos, fotografías reales de zonas, recursos externos/OSM; B25 conserva antecedente externo 122/123. **Siguiente bloque según roadmap: B10 — Pulido** (OD-01 quedó POST-V1 / DIFERIDO). No iniciado ni numerado por inferencia.

## Histórico — B31 certificado antes de su integración

- Rama nueva `codex/block-31-b9-5-reservas-resumen`, base canónica exacta `393ef2b2a1a2db0641d3785b7e7cf155c914fa5c`. Implementación `9761817f0d7acfcff418145c36e14615b2840760`; documentación en un commit independiente posterior. Main no se modifica en esta misión.
- Viaje mantiene Días · Dónde dormir · Reservas · Resumen. Reservas reúne mecanismos/ventanas/fechas/calendario/Feb–Mar y ordena sólo la lectura por hito derivado. Resumen reutiliza whole-trip-composition con cuatro tarjetas y bandas por los días reales. DDR-05 queda ejecutada: cuatro literales conservados con ◧ Registrado y comillas; ausencia global de Dato renderizable comprobada.
- Build/lint PASS (sólo warning heredado PlaceMap); Vitest 3479/3479; invariantes 231/231; B31 Chromium y WebKit 281/281 por motor; B30 475/475 por motor. B29 163/163, B28 anidado/aislado 64/64, B27 A–K en 8 viewports, B26 314/314 en repetición, B18 back 15/15, diff check PASS.
- B26: primer intento abortado por timeout del diálogo onboarding a 430×932; repetición completa verde sin modificar Nosotros/Onboarding/gate B26. No reaparecieron I-RESET-CANCEL/K-FOCUS-VISIBLE. B28 no mostró auto-scroll intermitente. No se demostró regresión nueva determinista.
- Consulta y cambio de sub-pestañas no escriben V8; selección/modo de comparación y retorno de ficha conservados. Un lector se refresca tras una edición persistida real en la otra superficie. El helper B30 reconoce la instancia ya observada, conserva todas sus aserciones y sigue sincronizando dos escrituras al montar una nueva.
- B30 permanece CERRADO E INTEGRADO EN MAIN. B31 se entrega para revisión contra main; no se fusiona. Sin cambios de cálculos, datasets, fotografía, adquisición B6, storage V8, Astra ni Vercel/deploy. #168 continúa abierto Draft en `1444e67805c60cf9a33f4be5c1a3808b900e505b`; claude/* permanece separado.
- Deuda: Safari físico/iPhone, lector de pantalla físico, fotografías reales de zona y recursos externos/OSM; B25 conserva el antecedente externo 122/123. Matriz, decisiones, archivos y evidencia: [BLOCK_31_MISSION.md](BLOCK_31_MISSION.md) y [BLOCK_31_HANDOFF.md](BLOCK_31_HANDOFF.md).


## Histórico — cierre de main antes de B31 / B9.5 (2026-09-30)

- PR #169: implementación B30; #171: hotfix CSS de invariantes; #172: corrección de race del gate WebKit. Los tres están integrados.
- Main certificado tras #172: `a21920bcef2478ba1e5c0367e118a997f20acc31`, merge commit con segundo padre `43ca260056912843c7246cb700bbf5e8644d3d40`; tree `78ba86c69c3f53af38e20067e565ff408199d9c9` idéntico al certificado previamente.
- Build y lint PASS; Vitest 3465/3465; invariantes 231/231; B30 Chromium **2/2** y WebKit **2/2**, 475/475 cada ejecución, incluida reapertura 320x568 sin serialización y reduced motion.
- B29 163/163 (B28 anidado 64/64); B27 A–K en 8 viewports; B26 314/314; B18 back 15/15; diff check PASS. B28 aislado: tres fallos conocidos de auto-scroll, luego 64/64 sin cambios; comparación pre-merge 64/64 y producto/gate B28 idénticos. No se observó regresión nueva determinista. Antecedentes B26 de foco no reaparecieron.
- La race era del gate: medía antes de acabar los efectos de montaje/reconciliación de Días. #172 espera sus dos escrituras V8, conservando las aserciones. Nunca fue necesario modificar producto para corregir WebKit. Producto certificado en ambos motores.
- Deuda: fotografías reales de zona; Safari físico/iPhone; recursos externos/OSM. B25 conserva el antecedente externo 122/123, no se declara verde.
- #168 permanece abierto, Draft e intacto en `1444e67805c60cf9a33f4be5c1a3808b900e505b`.
- **B31 / B9.5 NO fue iniciado.** Sin cambios en `claude/*`, Astra, Vercel/deploy, fotografías ni OSM/recursos externos.
- Evidencia completa y datos de integración: [BLOCK_30_MAIN_CERTIFICATION.md](BLOCK_30_MAIN_CERTIFICATION.md). Este cierre sustituye estados históricos de publicación pendiente; el commit de cierre contiene sólo documentación.

## Registro histórico — cierre de B29 / B9.3

## B29 / B9.3 «Herramientas del día · Probar otro orden» — CERRADO E INTEGRADO

- PR canónico [#167](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/167): MERGED `2026-09-30T15:16:19Z` mediante merge commit `d7144ef1fb02c9ec5ffc4b63dfb414512183496b`.
- `main` anterior: `797c9980d6c9baf2deeb3bd635cd7d159e4743bf`. HEAD fuente B29: `5a7b54d09adc55b802f27d8c0f3aa200ac808ce4`. HEAD de `main` en el merge: `d7144ef1fb02c9ec5ffc4b63dfb414512183496b`; sus padres son la base anterior y el HEAD B29.
- Commit de implementación: `64d4a73129b6f617941075669b289bf55b9f39ff`. La certificación de gates previa al merge fue `485caf3f82b8ab9f766ae2cc7c5f388de1728173`. La auditoría cruzada quedó documentada en `5a7b54d09adc55b802f27d8c0f3aa200ac808ce4`.
- B29 implementa la herramienta efímera por día: baseline persistido, propuesta editable por teclado, comparación local mediante `compareSequences`, alternativas evidence-complete como opciones, y aplicación explícita atómica con protección stale.
- Post-merge en el merge commit: build PASS; lint salida 0 con un warning heredado; Vitest 112 archivos/3457 PASS; B29 163/163; B28 64/64; B27 A–K; B26 314/314; B25 123/123; B18 15/15. Informe completo y deuda de audits Phase 3E: `docs/BLOCK_29_HANDOFF.md`.
- B29/B9.3 queda cerrado. Siguiente bloque lógico: B9.4 «Dónde dormir», pendiente y no iniciado. B9.5, B30 y B10 también siguen pendientes. Astra y Vercel permanecen fuera de alcance; no hubo despliegue.
- Este cierre documental se registra en un commit posterior sobre `main` y no cambia el código probado en el merge commit; el HEAD final de `main` es el SHA de este commit documental.

## HISTÓRICO — B28 / B9.2 antes de integración

`codex/block-28-b9-2-reorder` parte de `main` @ `47a6f0e1549f273622a112820ace5279455cbd9e`. Añade drag de TripStop por Pointer Events con alternativa completa «Mover a…», mutación inter-día atómica V8 y arrastre desde Sin asignar. Build PASS, lint 0 errores (un warning heredado), Vitest 3430/3430, B28 52/52, B27 A–K y gates históricos B26/B25/B18/B6/Phase 5A/integración/DD-028/DDR03 verdes. Véanse `docs/BLOCK_28_MISSION.md` y `docs/BLOCK_28_HANDOFF.md` para arquitectura, pruebas y límites. B9.3/B9.4/B9.5 estaban diferidos en ese punto; B28 ya está integrado.

## ESTADO CANÓNICO ACTUAL — B26 (PR #159) integrado a `main` (2026-09-29)

- **PR #159 MERGED** 2026-09-29T21:59:39Z mediante **merge commit** (no squash, no rebase).
- **Merge commit:** `a53c1af33716d54f5717b4607bd7e123281fefa1`; padres `b5e734169e0940aaa21427d2c9c0f5dc03d9a236`
  + `bd24ccce49c5d49d95d939fb0aede6c8431c73d8`. Árbol idéntico al head certificado.
- **Certificación post-merge:** build PASS · lint 0 errores (1 warning heredado) · Vitest 3415/3415 · B26 314/314
  Chromium y WebKit · B25 123/123 · integración 58/58 · Phase 5A 50/50 ×2 · DD-028 16/16 · B18 15/15 y 38/38 ·
  B5 231/231 · B6 177/177 · B23 28/28 · ddr03 43/43 · smoke Chromium 28/28. Detalle: `docs/BLOCK_26_HANDOFF.md`.
- **PENDIENTE HUMANO — iPhone Safari real** (export/import, selector de archivos, teclado iOS): no hecho.
- Gates históricos obsoletos (deuda B10): `block1-ux`, `block13`, `block14`, `b18-regression`, `b24-real-input` P0-2.
- **B27 / B9.1 ya integrado** en `main` mediante PR #162. Ver sección canónica B27 y `docs/BLOCK_27_HANDOFF.md`.
- **B28 / B9.2 ya integrado** mediante PR #164. Siguiente: B29 / B9.3 «Probar otro orden». No mezclar Astra ni #154.
## ESTADO CANÓNICO ACTUAL — B27 / B9.1 integrado a `main` (2026-09-29)

- **PR #162 MERGED** mediante merge commit `fa64d868420880ba598e05e61dbe8d213d16430c`.
- **Padres:** `eab63a8af34c8e0474340eba4687766be979933b` (main previo) +
  `30549a19df02b352aaf66985357827a568f71510` (HEAD B27 certificado).
- **Árbol del merge = árbol del HEAD certificado:** `1f235da5b0746c636f278746d40e7bdc2134a01e`.
- Funcionalidad B9.1 integrada: días reordenables, TripStop bidireccional con Sin asignar y poda V8, acciones de día,
  alternativas accesibles, InterHub entre tarjetas, cabecera con fechas y PlaceDetail/back dentro de Viaje.
- Certificación transferida sin cambios de código: **107 archivos, 3426/3426 Vitest PASS**; build PASS; lint 0 errores
  + 1 warning heredado; B26 314/314, B25 123/123, B5 231/231, B6 177/177, B18 15/15 + 38/38 + 6/6 + 25/25,
  B23 28/28, Phase 5A 50/50 escritorio + 50/50 móvil, integración B24+B23 58/58, DD-028 16/16,
  DDR03 43/43, DDR-B24-3 9/9 y B27 A–K en 8 viewports.
- Chromium local de certificación: Edge `C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe`
  (Chromium 153.0.4234.48). Auditoría visual: 320×568, 390×844, 430×932, 820×1180 y 1440×900 sin overflow/solapamientos.
- Deuda histórica de gates antiguos sigue documentada en B26; no se relajó para B27.
- **B28 / B9.2 ya integrado.** Siguiente canónico: B29 / B9.3 «Probar otro orden». B9.4 y B9.5 siguen pendientes. No mezclar Astra ni Vercel.

## ESTADO CANÓNICO ACTUAL — B25 (PR #157) integrado a `main` (2026-09-29)

- **PR #157 MERGED** el 2026-09-29T04:07:23Z mediante **merge commit** (no squash, no rebase).
- **Merge commit:** `d90a9d53fbc61da8a6843d6dc44af1d8c3551945`.
- **Padres:** `98260eb67b508527cd6836fda2d3d3f33d909c1a` (main previo) +
  `c57d58aa632b4532136919350dd00d85949a4cf6` (head certificado de `claude/b25-quiero-ir`).
- **Certificación post-merge desde el nuevo `main`:** `git diff --check` limpio; build PASS; lint
  0 errores (1 warning heredado `PlaceMap.tsx:17`); Vitest 106 ficheros, 3406/3406; B25
  `b25-quiero-ir-check` 123/123; integración B24+B23 58/58; Phase 5A 50/50 desktop y 50/50 móvil;
  B23 photo retry 28/28; DD-028 16/16; B18 back 15/15; B18 viaje-lugar 38/38; B5 231/231; B6 177/177.
- Siguiente bloque: requiere decisión de dirección (ver `docs/BLOCK_25_HANDOFF.md`). No mezclar Astra.

## B25 — B7 «Quiero ir» (2026-09-28) — INTEGRADO en `main` (ver arriba)

- Rama `claude/b25-quiero-ir` desde `origin/main` @ `88a741d` (verificado). `main` intacto.
- Pantalla según `05 §6`: segmentado (filtro de vista), resumen de tres datos, coincidencias
  primero, «Sólo {persona}», Descartados, «Llevar al viaje»; `SelectionAnalysis` integrado como
  «Por ciudad y zona»; quitar + Toast «Deshacer». P1-13 resuelto.
- Puertas: build PASS, lint 0 errores, Vitest 3406/3406, gate nuevo
  `app/scripts/b25-quiero-ir-check.mjs` 123/123, integración 58/58, Phase 5A 50/50 ×2, B23 28/28,
  DD-028 16/16, B18 back 15/15, viaje-lugar 38/38. Detalle: `docs/BLOCK_25_HANDOFF.md`.
- Certificado contra `main` @ `98260eb` (merge sin conflictos); gates B5 231/231 y B6 177/177
  actualizados y verdes. PR #157 Ready for Review. Detalle: `docs/BLOCK_25_HANDOFF.md`.
- PR #157 merged 2026-09-29 (merge commit `d90a9d5`).

## ESTADO CANÓNICO ACTUAL — PR #152 integrado a `main` (2026-09-28)

**`main` ya no está en `8eb725e`.** PR #152 se certificó MERGE-READY (auditoría 2026-09-27,
HEAD `e5ddbfa`) y se integró mediante **merge commit** (no squash, no rebase) el 2026-09-28.

- **Merge commit:** `8867e41b158b4651e473b390657ad3ff161a63bf`.
- **Padres del merge:** `8eb725eeb836ca121180f8dd8b0dc49c65efae25` (main previo) +
  `e5ddbfa6c1eea82661c6002d4ee9d6e96f17bd57` (head certificado de #152). Ambos son ancestros de
  `origin/main`; verificado con `git merge-base --is-ancestor`.
- **SHA canónico nuevo de `main`:** `8867e41b158b4651e473b390657ad3ff161a63bf`. Todo trabajo
  nuevo debe partir de aquí.
- **PR #152:** `MERGED` (no cerrado manualmente; GitHub lo marcó merged).
- **Certificación post-merge (ejecutada desde el nuevo `main`, no desde la rama):** build ✅;
  lint 0 errores (1 warning heredado `PlaceMap.tsx:17`); Vitest 3384/3384; pytest `scripts/`
  (historia completa) 618 passed/0 failed/0 errors — reproduce el estado reconciliado, no el
  artefacto de clon superficial; `integration-b24-b23-check` 58/58; B23 retry 28/28; DD-028
  16/16; Block 2 Photography 81/81. Sin regresiones atribuibles al merge (comportamiento
  idéntico al head certificado, como se esperaba de un merge commit).
- Astra, PR #153, PR #154 y cambios de Vercel/deployment: **no mezclados** en este merge.
- Rama fuente `claude/integration-b24-b23-b65-b67` conservada (no borrada) a la espera de que
  se complete cualquier certificación adicional.
- Pendiente humano sin cambios: validación real en iPhone (scroll táctil, teclado iOS) — no
  bloqueante, no ejecutable en este entorno.
- La condición "no empezar B25" ya no depende de una integración pendiente: **la integración ya
  ocurrió.** El siguiente bloque autorizado se decide contra roadmap (`docs/design/10_ROADMAP_DE_BLOQUES.md`)
  y se reporta por separado; no se ha iniciado ningún trabajo de bloque nuevo en esta misión.

## ESTADO HISTÓRICO — merge-readiness de PR #152 (2026-09-26, previo a la integración)

Handoff completo: `docs/MERGE_READINESS_HANDOFF.md`. Rama `claude/integration-b24-b23-b65-b67`,
de `fac2e9e` a HEAD (ver handoff). En este punto histórico PR #152 seguía **Draft**; sin merge,
squash ni rebase; `main` intacto en `8eb725e`. (Superado por la sección canónica de arriba.)

- **Block 2 Photography 79/81 → DDR-MERGE-1 ABIERTA** (`docs/DDR-MERGE-1_PRESUPUESTO_FOTOGRAFIA_HUB.md`).
  El hub Osaka cuesta 3,20 MiB y cumple el pipeline y `06 §6.3`; el exceso (5,31 / 5,77 MiB) lo
  pone la portada de Explorar, que el gate cuenta desde `page.goto`. No hay DD-027; ni el gate ni
  la constante se han tocado. **Único punto pendiente de decisión de dirección.**
- **Python:** `19 failed / 9 errors` → **618 passed, 0/0** sin skip/xfail
  (`docs/PYTHON_SUITE_STATUS.md`). Corrige la deuda que figuraba abajo como «fuera de alcance».
- **DD-028 FIRME:** nombre accesible de PlaceCard = identificación visible (`09`, `04 §5` regla 11),
  gate nuevo `dd028-placecard-accessible-name-check.mjs` (árbol AX).
- `integration-b24-b23-check.mjs` daba 50/52 también en `fac2e9e` (503 consumido por la portada);
  corregido → 58/58.
- **Pendiente humano:** scroll táctil real y teclado de iOS en iPhone.

## Estado actual — integración B24 + B23 + B6.5-fix + B6.7 test-closure (rama, sin integrar en `main`)

**Última actualización:** 2026-09-26. Misión: `docs/INTEGRATION_B24_B23_B65_B67.md`; handoff:
`docs/INTEGRATION_B24_B23_B65_B67_HANDOFF.md`.

- **Rama:** `claude/integration-b24-b23-b65-b67`, creada desde B24 final
  `f95e81e96d497c253c1de86dac1319ba34dde785`. Incorpora por `cherry-pick -x`: B6.7 test-closure
  (`bd9defa`, `b3b6e7e`, `61fa5e9`), B6.5 timing fix (`d1a5eef`, `af21671`) y B23 photo retry
  (`52a7073`). **Sin PR ni merge; `main` intacto en `8eb725e`.**
- Cerrados en la integración: **AB-4** (por B6.7 test-closure), **P0-5c**, **AB-1**, **AB-2**
  (tras B23). **AB-3** reclasificado a DEFERRED-ROADMAP(B10) con P2-4.
- Roadmap sin adelantar: P1-13 → B7; P2-1/2/3/4/6 → B10; P2-5 → B9. No empezar B25/B7/B8/B9/B10.
- Gate permanente nuevo: `app/scripts/integration-b24-b23-check.mjs`.
- Deuda histórica fuera de alcance, idéntica antes y después: suite Python de `scripts/`
  `19 failed, 590 passed, 9 errors` (incl. `NameError: BATCH_LIMIT` de B6.4).
- **Pendiente humano:** scroll táctil real y teclado de iOS en un iPhone (heredado de B24).
- Regresión F: Vitest 3382/3382, Phase 5A 50/50 ×2, B6.5 416/416, B23 28/28, integración 58/58, B24 1355/1355 y 1363/1363; resto de gates en verde (detalle en el handoff de integración §F).

## B24 auditoría con input real — cerrado 2026-09-25 (base de la integración de arriba)

**Última actualización:** 2026-09-25 (F7 — P0-4e corregido, cierre real de B24). Handoff completo:
`docs/BLOCK_24_HANDOFF.md`; auditoría: `docs/BLOCK_24_UX_AUDIT.md`; misión:
`docs/BLOCK_24_MISSION.md`.

- **Rama:** `claude/block-24-ux-real-input-audit`, desde la base canónica
  `origin/codex/block-22-b6-7-grade-a-depth-photography` @ `4afbf50e9d1e3137f9148c6c471c1c40aac6a56f`
  (descendiente de B21 `0390708`). **Sin PR ni merge.** B23 `52a7073` y B6.5-fix `af21671` no se
  incorporaron; ninguna zona protegida tocada. `main` intacto en `8eb725e`.
- Checkpoints: A `454d31a` · B `77a3345` · C `7794fd1` · D `f0b8b22` · E `6b100e5` · F `9fba00f` ·
  G (F7, cierre real — ver `docs/BLOCK_24_HANDOFF.md` §F7).
- Corregido: P0-1 portada sin scroll, P0-2 iconos `.icon-button--small` tapados, P0-3 contador de
  ciudad (D-M1), P0-4 mapa de ciudad agrupado (`03 §9`) con áreas de 44 px, P0-5 filas de
  búsqueda y contador vivo (D-M6); P1 de FilterSheet, onboarding, toasts y «Misma zona» (D-M4),
  foco tras Escape, héroe de ficha (D-M3), «Más destinos» y panel anidado de la portada.
- Decisiones de dirección registradas como DD-018…DD-022 en `docs/design/09`.
  **DDR-B24-1/2/3 RESUELTAS en F6** (`DD-023` encuadre editorial por hub con fallback calculado,
  `DD-024` agrupación geométrica siempre activa, `DD-025` colecciones de la portada como búsqueda
  global). No queda ninguna DDR abierta en B24.
- **F7 (cierre real):** P0-4e corregido → `DD-026` (el cromo interactivo del mapa es zona de
  exclusión tras todo movimiento programático; `lib/map-chrome.ts`). Regresión propia de F6
  encontrada y corregida: `flyTo` con el mapa oculto (0×0) lanzaba `LatLng(NaN, NaN)` y
  desmontaba la app (`b18-viaje-lugar-check`). El «flake» de P1-FILTER era una carrera del gate
  (medía durante la animación de entrada de la hoja) — estabilizado sin cambiar la expectativa.
  DD-023/024/025 y el cierre de DDR-B24-1/2/3 fechados 2026-09-25.
- Puertas (F7): build PASS; lint 0 errores + 1 warning heredado (`PlaceMap.tsx:17`); Vitest
  3353/3361 (los 8 fallos B6.7 de la base, 0 nuevos); B17, B18 (incl. viaje-lugar 38/38), B19
  grid 52/52, B21 33/33 ×2, DDR-B24-3 9/9 en verde; **gate B24 100 % verde (1347/1347 y
  1351/1351 en dos corridas completas de 8 viewports)**. Ningún P0 propio de B24 queda deferred.
- **Pendiente humano:** scroll táctil real y teclado de iOS en un iPhone.
- **Siguiente acción:** decisión de dirección sobre la integración de esta rama. No empezar B25.

## Histórico — rama paralela: cierre de pruebas B6.7 (test-alignment, no producto)

> Integrada el 2026-09-26 en `claude/integration-b24-b23-b65-b67` (ver arriba).

**Rama:** `claude/block-22-b6-7-test-closure`, creada desde
`origin/codex/block-22-b6-7-grade-a-depth-photography` @ `4afbf50e9d1e3137f9148c6c471c1c40aac6a56f`
(tip de B6.7: commits `8601a9d` y `4afbf50`, "feat(photography): add B6.7 depth batch 1/2"). Esta
rama **no** es una integración de producto: es una misión de alineación de pruebas, en paralelo a
este handoff, que corrige expectativas de test desactualizadas tras B6.7. No toca `main`, no
mezcla B23/B24/"B6.5 timing fix", no usa Astra y no abre PR.

- Vitest antes: 3321/3329 (8 fallos en `place-images.test.ts` y `photography-depth.test.ts`).
  Después: 3329/3329.
- Phase 5A gate antes: 47/50 (A06, A07, E01 fallando). Después: 50/50, en escritorio y móvil.
- Detalle completo, causa raíz de cada fallo, y evidencia normativa: ver
  `docs/BLOCK_22_B6_7_TEST_CLOSURE.md`.
- Solo se tocaron archivos de test, el script de gate `app/scripts/phase5a-rc-browser-audit.mjs`,
  y documentación. Ningún archivo de producto, componente, o dataset fue modificado.

---

**Última actualización:** 2026-09-24. La autoridad normativa es `docs/design/`. Astra es una línea separada y no forma parte de este trabajo.

## Estado actual — B6.6 integrado

**Última actualización:** 2026-09-24. La autoridad normativa sigue siendo `docs/design/06_ESTRATEGIA_FOTOGRAFICA.md`.

- B21 cerrado; B6.1–B6.6 integrados y cerrados. B6.6 se integró mediante PR #148.
- **Rama B6.6:** `codex/block-22-b6-6-grade-cd-identity-photography` @ `5d5956c649b9fcf7e15890ae5598deb807853cdd`. **SHA base:** `f74281a75cefe5f45469e1db84e5d4350110dba5`; merge commit `c5286844571ebe351119ece0987a0cc0917a6684`.
- Gate C/D derivado desde los datos: C **6 total, 0/6 → 5/6**; D **4 total, 0/4 → 3/4**. Targets reales: 10; adquiridas 8 identities; unresolved 2 (JP-104, JP-178, copyright del sujeto).
- Registro B6.6: **233 imágenes / 202 lugares con fotografía**. C 5/6 y D 3/4. S permanece identity **32/32**, experience **17/32**, complementary **14/32**; A **139/147 + 8 excepciones**; B **23/25 + 2 excepciones**.
- Gates B6.2–B6.6, validator, pruebas de fotografía/rendition/Block22 y derivados `--check` PASS. Build PASS; lint exit 0 con el warning heredado `PlaceMap.tsx:14`; Vitest 100 archivos, 3329/3329; browser audit B6.6 PASS 316/316 en móvil y escritorio.
- Presupuesto identity 800w: Tokio 3.499.770 B; Kioto 3.499.450 B; Osaka 3.356.478 B; Okinawa 2.903.352 B; Sapporo 166.986 B; Nagoya 69.552 B; Fukuoka 69.284 B. Todas las listas quedan bajo 3.500.000 B. `app/src/data/place-images.ts` conserva SHA-256 `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb`.
- `main` sigue intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`; Astra no se usó y no hubo rediseño de UI.
- **Siguiente bloque:** segunda imagen para lugares Grado A de “Popular / turístico” y “Hidden Gem real”. No iniciado.

## Snapshot de cierre B6.4 — base de B6.5

- B21 cerrado; B6.1 cerrado; B6.2 integrado y cerrado; B6.3 integrado y cerrado.
- **B6.4 integrado y cerrado con 15 excepciones documentadas** mediante PR #146. Rama fuente `codex/block-22-b6-4-grade-s-experience-photography` @ `f22ce0c33534b5ac457a9826c4eb165e97b40b0c`; merge commit `53d4d26dc22d3e214481af823e280a3ad479c11a`.
- Base canónica B6.4: `ad456be50e6b855bc79204bc50d26b154eb29441`. SHA final certificado de la rama B6.4: `f22ce0c33534b5ac457a9826c4eb165e97b40b0c`; el informe completo está en `docs/BLOCK_22_B6_4_REPORT.md`.
- Gate inicial: **32/32 S con identity; 2/32 ya tenían experience; 30 objetivos reales**. Resultado: 15 nuevas experience y 15 unresolved documentados; cobertura final **17/32 S con experience**. Las 32 identities iniciales siguen intactas.
- Registro: **215 imágenes / 194 lugares**. Grado A permanece **139/147 + 8 excepciones**; Grado B permanece **23/25 + 2 excepciones**.
- Validator PASS; fotografía 40/40; rendition 28/28; Block 22 8/8; B6.2 11/11; B6.3 8/8; B6.4 9/9; derivados 215 PASS; build PASS; lint exit 0 con warning heredada `PlaceMap.tsx:14`; Vitest 100 archivos, 3328/3328; browser audit **462/462**, 0 fallos.
- Listas: máximo completo Tokio **3.421.914 B**, bajo 3.500.000 B; ningún hub muestreado solicita experience. `place-images.ts` permanece byte a byte intacto. No se tocó `main`, no hubo rediseño, Astra ni merge.
- **Siguiente bloque:** tercera foto complementaria para Grado S (`detail`, `context` o `seasonal` según el lugar). No iniciado.

## Snapshot histórico al cierre de B6.3

- **B21 cerrado; B6.1 cerrado; B6.2 integrado y cerrado** mediante PR #143, con ocho excepciones Grado A preservadas.
- **B6.3 integrado y cerrado con 2 excepciones documentadas** mediante PR #145. Rama fuente `codex/block-22-b6-3-grade-b-photography` @ `8d1752f945ff4b7594a490a6df4ab23324f597a5`; merge commit `eafcd61964bda9c462a27df5779d404aa23c4e9e`. Informe: `docs/BLOCK_22_B6_3_REPORT.md`.
- Gate inicial derivado: Grado B **25 total / 17 con foto / 8 sin foto**. Se adquirieron seis identidades (JP-107, JP-140, JP-150, JP-166, JP-199, JP-209); JP-041 y JP-171 son excepciones documentadas. Cobertura final **23/25 Grado B + 2 excepciones**; **200 imágenes / 194 lugares**.
- Grado A permanece **139/147 + 8 excepciones** (JP-050, JP-079, JP-095, JP-120, JP-121, JP-168, JP-195, JP-202). Grado S permanece **32/32**.
- Validator PASS; Python 40/40, rendiciones 28/28, Block 22 8/8, B6.2 11/11, B6.3 8/8; derivados 200 PASS; build PASS; lint exit 0 con warning heredada `PlaceMap.tsx:14`; Vitest 100 archivos, 3328/3328; navegador B6.3 216/216 móvil/escritorio.
- Al corte de B6.3, B6.4 aún no se había iniciado. El estado vigente está en la sección superior.

| Campo | Estado |
|---|---|
| B21 | **CERRADO** |
| B6.1 | **INTEGRADO Y CERRADO** (vía PR #141) |
| B6.2 | **INTEGRADO Y CERRADO CON 8 EXCEPCIONES DOCUMENTADAS** — 27/35 objetivos adquiridos; 8 excepciones conservan PhotoPlaceholder e imageBrief. Integrado vía PR #143. Informe: `docs/BLOCK_22_B6_2_REPORT.md` |
| B6.3 | **INTEGRADO Y CERRADO CON 2 EXCEPCIONES DOCUMENTADAS** — 6/8 objetivos adquiridos; JP-041 y JP-171 conservan PhotoPlaceholder. Integrado vía PR #145. Informe: `docs/BLOCK_22_B6_3_REPORT.md` |
| B6.4 | **INTEGRADO Y CERRADO CON 15 EXCEPCIONES DOCUMENTADAS** — 15 nuevas `experience`; cobertura S experience 17/32. Integrado vía PR #146. Informe: `docs/BLOCK_22_B6_4_REPORT.md` |
| B6.5 | **INTEGRADO Y CERRADO CON 18 EXCEPCIONES DOCUMENTADAS** — 10 nuevas complementarias (`detail/context/seasonal`); cobertura complementaria S 14/32. Integrado vía PR #147. Informe: `docs/BLOCK_22_B6_5_REPORT.md` |
| B6.6 | **INTEGRADO Y CERRADO CON 2 EXCEPCIONES DOCUMENTADAS** — 8 identities nuevas para C/D; JP-104 y JP-178 unresolved por copyright de sujeto. Integrado vía PR #148. Informe: `docs/BLOCK_22_B6_6_REPORT.md` |
| Rama B6.3 | `codex/block-22-b6-3-grade-b-photography` @ `8d1752f945ff4b7594a490a6df4ab23324f597a5` (conservada) |
| Rama B6.2 | `codex/block-22-b6-2-grade-a-photography` @ `f8115b67b0fe1aa8986e418cd34f2fb4fed96639` (conservada) |
| SHA de cierre B6.2-R | `f8115b67b0fe1aa8986e418cd34f2fb4fed96639` |
| Cobertura Grado A | **139/147 con fotografía + 8 excepciones documentadas**: JP-050, JP-079, JP-095, JP-120, JP-121, JP-168, JP-195, JP-202 |
| Registro | **233 imágenes / 202 lugares**; C **5/6**, D **3/4**; Grado S identity **32/32**; Grado S experience **17/32**; cobertura complementaria S **14/32**; Grado A **139/147 + 8 excepciones**; Grado B **23/25 + 2 excepciones** |
| Grado S | **32/32** |
| Rama canónica | `codex/block-21-b5-explore-home-map` @ `c5286844571ebe351119ece0987a0cc0917a6684` — PR #148 merged |
| `main` | intacto (`8eb725e`), sin PR abierto hacia `main` |
| Siguiente paso | **Segunda imagen para lugares Grado A de “Popular / turístico” y “Hidden Gem real”. NO iniciado.** |

## Integración B6.6 en la rama canónica

- PR #148: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.6: `5d5956c649b9fcf7e15890ae5598deb807853cdd`.
- Merge commit: `c5286844571ebe351119ece0987a0cc0917a6684`.
- El tree del merge commit coincide con el tree del head certificado B6.6; no hubo cambios de contenido adicionales durante el merge.
- Estado integrado: **C 5/6; D 3/4; 8 identities nuevas; 2 excepciones documentadas; 233 imágenes / 202 lugares; S identity 32/32; S experience 17/32; S complementaria 14/32; A 139/147 + 8 excepciones; B 23/25 + 2 excepciones**.
- El pipeline regeneró 38 rendiciones identity `-800w` existentes para mantener todos los hubs bajo 3.500.000 B; originales y `-400w` permanecen intactos.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- El siguiente bloque permitido es la segunda imagen para lugares Grado A de “Popular / turístico” y “Hidden Gem real”; no iniciado.

## Integración B6.5 en la rama canónica

- PR #147: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.5: `4ad32973744263043def217b4a65934a9be925ce`.
- Merge commit: `241d0a88fed2f07b17854a04e7b2395fb5cb2950`.
- El tree del merge commit coincide con el tree del head certificado B6.5; no hubo cambios de contenido adicionales durante el merge.
- Estado integrado: **10 nuevas complementarias; cobertura complementaria S 4/32 → 14/32; S identity 32/32; S experience 17/32; 225 imágenes / 194 lugares; A 139/147 + 8 excepciones; B 23/25 + 2 excepciones**.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- El siguiente bloque permitido es identity para los lugares Grado C/D que siguen sin fotografía; no iniciado.

## Integración B6.4 en la rama canónica

- PR #146: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.4: `f22ce0c33534b5ac457a9826c4eb165e97b40b0c`.
- Merge commit: `53d4d26dc22d3e214481af823e280a3ad479c11a`.
- El tree del merge commit coincide con el tree del head certificado B6.4; no hubo cambios de contenido adicionales durante el merge.
- Estado integrado: **S identity 32/32; S experience 17/32 + 15 excepciones documentadas; 215 imágenes / 194 lugares; A 139/147 + 8 excepciones; B 23/25 + 2 excepciones**.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- El siguiente bloque permitido es la tercera fotografía complementaria para Grado S (`detail`, `context` o `seasonal`); no iniciado.

## Integración B6.3 en la rama canónica

- PR #145: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.3: `8d1752f945ff4b7594a490a6df4ab23324f597a5`.
- Merge commit: `eafcd61964bda9c462a27df5779d404aa23c4e9e`.
- El tree del merge commit coincide con el tree del head certificado B6.3; no hubo cambios de contenido adicionales durante el merge.
- Estado integrado: **23/25 Grado B con fotografía + 2 excepciones documentadas; 200 imágenes / 194 lugares; Grado A 139/147 + 8 excepciones; Grado S 32/32**.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- El siguiente bloque fotográfico será la segunda imagen `experience` para los 32 lugares Grado S; no iniciado.

## Integración B6.2 en la rama canónica

- PR #143: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.2: `f8115b67b0fe1aa8986e418cd34f2fb4fed96639`.
- Merge commit: `abe9941bcda926f0d3ee44f1ae86bcab48873855`.
- El tree del merge commit es `f1e25a68735d2f8a12867e749e8acdf945e7b2d4`, idéntico al tree del head certificado B6.2; el merge no introdujo cambios de contenido adicionales.
- Estado integrado: **139/147 Grado A con fotografía + 8 excepciones documentadas; 194 imágenes / 188 lugares; Grado S 32/32**.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- B6.3 no se inició durante esta integración.

## B6.2 — verificación de cierre (2026-09-24, Linux)

- Adquisición vía `acquire-photography.py` + `prepare-block22-b6-2-photography-metadata.py` (contrato Block 2), 4 batches con commit y push cada uno; `place-images.ts` sin cambios (SHA-256 `6e690411…af9d`, igual a la base).
- Presupuesto al cierre original de B6.2, antes de recuperar JP-156: Tokio superó 3,5 MB tras el batch 1 (3.886.132 B). Corregido en el pipeline: `-800w` > 70.000 B baja calidad en pasos de 4 hasta 48. Entonces: Tokio 3.421.914, Kioto 3.408.406, Osaka 2.960.618, Okinawa 2.740.472 B. 82 `-800w` preexistentes re-codificadas. El presupuesto final tras B6.2-R aparece en la fila de resultado.
- `validate-photography.py` PASS; Python fotografía 40/40, rendiciones 28/28, Block 22 8/8, B6.2 11/11; derivados `--check` PASS (194), `select-block22-b6-2-targets.py --check` PASS (35).
- `PD-self` se normaliza como `Public Domain` con `licenseBasis: PD-self`, procedencia Commons y sin `licenseUrl`; no se inventó un enlace.
- Build PASS; lint exit 0 (1 advertencia heredada `PlaceMap.tsx:14`); Vitest 100 archivos, 3328/3328.
- Navegador: B6.2 250/250 (7 lugares nuevos en 4 hubs, con JP-156, teléfono/escritorio y fallbacks), B20 73/73, Block 2 81/81.
- Resultado: 194 imágenes / 188 lugares, 139/147 Grado A con fotografía + 8 excepciones documentadas. Presupuesto `-800w`: Tokio 3.421.914, Kioto 3.408.406, Osaka 2.960.618, Okinawa 2.796.354 B; todos bajo 3.500.000 B.
- Brecha heredada anotada: el UI aún no pinta `lqip` (usa `place-card__skeleton`); fuera de alcance por la regla de cero cambios de UI.

## Historial B21 + B6.1
## Verificación post-merge (2026-09-24, Linux)

- Build PASS; lint exit 0 (1 advertencia heredada Fast Refresh `PlaceMap.tsx:14`); Vitest 100 archivos, 3327/3327.
- Gate B21 búsqueda global 33/33 móvil y 33/33 escritorio: consulta preservada, resultados preservados, scroll preservado, portada nacional preservada, UI back, browser back y Cerca de aquí. En el contenedor, el escritorio requirió el binario Chromium completo 1194; el headless shell 1194 (desfasado frente al 1234 esperado por Playwright) no restaura el scroll en escritorio (360→0), sin cambios de código.
- Phase 5A 50/50 escritorio y 50/50 móvil.
- Fotografía: 167 imágenes, 161 lugares con foto, 32/32 Grado S; `validate-photography.py` PASS; `build-photography-derivatives.py --check --quiet` PASS; `test_block22_photography.py` 7/8 en Linux: el único fallo compara el SHA-256 de `app/src/data/place-images.ts` contra una línea base calculada con CRLF (Windows). El archivo es byte a byte idéntico a B6.1 `e6693a4`; fallo heredado dependiente de plataforma.

## Historial de la certificación previa (#141)

La historia remota de #141 contiene un solo commit posterior a la base B21. El SHA B6.1 no es ancestro del PR, pero los archivos de fotografía consolidados coinciden por contenido con la fuente. No existe remotamente `integration/b21-b6-1`; los checkpoints locales antes citados no representan commits publicados por separado. Véase `docs/B21_B6_1_INTEGRATION_REPORT.md` para el diff, los gates y la evidencia.

## Certificación técnica de esta auditoría

- Fotografía: 167 imágenes, 161 lugares, 32/32 S; `validate-photography.py` PASS; Python 38/38, 28/28 y 8/8; derivados 400/800 px PASS.
- Frontend: build PASS; lint código 0 con una advertencia de Fast Refresh; Vitest 100 archivos, 3327/3327. La advertencia Fast Refresh de `PlaceMap.tsx:14` es heredada de la base B21; la afirmación anterior de 0 warnings era incorrecta.
- Gates heredados: B17, B18, B19, B20, DDR-03, Block 1 UX, Block 2 Photography, Phase 5A RC y seis auditorías Phase 4 Photography ejecutados; resultados individuales en el informe.
- Navegador B21: portada, búsqueda, mapas, fotografía local, ficha y responsive comprobados en 390×844, 1440×900 y 1600×900; raíl xl 31,7 % del cuerpo; sin overflow, errores de consola o fetch fotográfico externo.
- **B21 corregido:** `exploreDetailReturnRef` identifica explícitamente la ficha abierta desde búsqueda global; no cambia el hub subyacente. `Sheet` restaura `.sheet__body.scrollTop` desde un ref y `focus({ preventScroll: true })` evita el reset posterior. El cierre explícito limpia el contexto; la búsqueda de ciudad conserva su comportamiento.
- **Gate B21 permanente:** `b21-global-search-browser-audit.mjs` PASS 33/33 en móvil y 33/33 en escritorio; UI back, browser back y cadena Cerca de aquí restauran consulta `a`, 214 resultados y scroll 360→360 tras dos frames. La portada nacional sigue subyacente, el cierre vuelve a portada y Buscar en Tokio no hereda retorno global.
- **Regresión repetida tras el arreglo:** B18 browser back 15/15, regression 40/40; B19 discovery 30/30, grid 52/52; B20 73/73; DDR-03 43/43; Block 1 UX 153/153; Phase 5A desktop/mobile 50/50 cada uno. Build PASS, lint exit 0 con una advertencia heredada, Vitest 100 archivos/3327 tests. Fotografía B6.1 sin cambios; se conserva toda su evidencia anterior.

## Estado de entrega

B6.2, B6.3, B6.4, B6.5 y B6.6 están integrados y cerrados en la rama canónica. B6.6 se integró mediante PR #148 con 8 nuevas identities C/D y 2 excepciones documentadas; véase `docs/BLOCK_22_B6_6_REPORT.md`. El próximo bloque permitido es la segunda imagen para lugares Grado A de “Popular / turístico” y “Hidden Gem real”; no iniciado.

## Bloque 27 — B9.1 Viaje · Días

B27 convierte Días en la entrada de Viaje sobre el draft manual existente. Véanse `docs/BLOCK_27_MISSION.md` y `docs/BLOCK_27_HANDOFF.md`. B9.2, B9.3, B9.4 y B9.5 siguen diferidos y no se consideran completados.
