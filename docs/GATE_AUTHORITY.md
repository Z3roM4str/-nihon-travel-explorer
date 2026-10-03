# Estado operativo B10 — activación diferida de imágenes, 2026-10-03

**INCOMPLETO; #177 Draft, sin merge/deploy.** Lote autorizado en design/09 y ejecutado sobre `f9949325aea83d45907b7310fa635faf7633716b` en `claude/b10-deferred-images`: las fotografías de tarjetas no prioritarias no inician su respuesta hasta estar a ≤ 2 viewports (`IntersectionObserver`, margen 200 %, observadores compartidos y desconectados al activar/desmontar); prioridad, `loading=lazy`, dimensiones, fallback, reintento, créditos y teclado intactos. Código probado `965acc8c9660fe8515ccbadc7f0cf97028a79079`. [Informe](B10_DEFERRED_IMAGES_REPORT.md), [evidencia](B10_DEFERRED_IMAGES_EVIDENCE.json).

G6 fotográfico: guard existente **13/13 Chromium y 13/13 WebKit** (+3 repeticiones por motor); Osaka escritorio **3 356 478 / 3 315 340 B** (antes 3 862 290 B registrado) ≤ 3 500 000 B; el valor 3 862 290 no se reprodujo en el entorno nuevo, sí su clase de fallo con la distancia nativa de carga diferida ampliada (base falla, lote 13/13). Entrada 157 586 B ≤ 253 742. **Sin ventana total ≤ 3,5 MB en navegación inmediata con respuestas de portada en vuelo** (las respuestas tardías se cuentan íntegras; Tokio y Kioto están en el tope sin la portada): decisión de Producto pendiente. Regresión 85 trabajos: 68/68 positivos PASS, 16/17 controles negativos detectados; `negative-scroll-chromium` no detecta su mutante en Chromium 141 (igual sobre la base; la certificación anterior usó 151). F01–F12 NO EJECUTADO; OSM-TLS externo; G4/CSS y OD-01 sin cambios.

---

# Estado operativo B10 — autorización ejecutada desde c868bd3 (2026-10-02)

**INCOMPLETO; #177 Draft, sin merge.** Candidata de producto probada `26407373059e0f20e6e64e975f7a38eb7da5805f`, tree `beb0917c912b32a61c53802760d39aa3c6ebca2d`; inicio `c868bd3e5bbb7df15ae44928476aa425f330ba12`. [Informe por lote](B10_AUTHORIZED_CONTINUATION_REPORT.md), [manifiesto nuevo](B10_AUTHORIZED_CONTINUATION_EVIDENCE.json), [34 decisiones CSS pendientes](B10_CSS_PENDING_DECISIONS.md), [matriz física](B10_PHYSICAL_QA_MATRIX.md). Los snapshots inferiores/manifiestos históricos conservan sus propios SHAs y alcances.

E01–E04 **aprobadas, implementadas y verificadas**, sólo literales/contextos acordados; completos/parciales/vacíos/inválidos, N/M y singular/plural. A-01 **implementado/verificado**: cuatro enlaces nativos a encabezados, foco visible, scroll correcto y Tab posterior. **312 acciones** con acceso normal **64/70/28/150**; Chromium/WebKit, móvil/escritorio y normal/reduced. No esperan aprobación.

G6 entrada **PASS: 271025 → 157046 B gzip nivel 9**, ceiling **253742**, margen **96696**. JavaScript crítico completo **223691** (runtime compartido **66645**), ahorro crítico **47334**. Diferidos: mapas/Leaflet **48880**, Días **33206**, zonas **5864**. Límites reales de interacción, sin import/prefetch que adelante Leaflet; primera apertura/reapertura, red lenta, fallo/reintento, cambios de superficie, selección/clusters/filtros, foco/scroll/persistencia/dimensiones verificados. **G6 global permanece sin certificar**: guard Chromium detectó fotos lejanas y ventana Osaka **3862290 > 3500000**; ese fallo no se borra por repeticiones distintas. Atribución nueva: ocho respuestas de portada (546950 B) completan la ventana de Osaka; propuesta concreta de siguiente lote fotográfico en el informe; presupuesto, definición y ratchet intactos.

CSS: **43 equivalencias canónicas exactas**, marco de ficha en posición original, App.css **444 líneas/43 reglas**. **G4 abierto**: ocho hex, dos queries legacy y 34 decisiones tipográficas/layout con ubicación/valor/alternativa/efecto. Atribución visual histórica/subpíxel y paridad estricta pendientes, sin promedio ni inferencia por ausencia de overflow. Corrección determinista adicional: contención de labels nacionales (position:relative); elimina rango oculto **1696/1516 px**. Guard por coordenadas **53/53 en ambos motores**, mutante vuelve a **51/53**; no se añade el cambio de App ni la nueva tarjeta de main.

Build/lint, **119 archivos/3430 tests PASS**. Regresión final: 79 trabajos, 67/68 positivos PASS, 11/11 controles negativos detectados; fallos positivos: performance-chromium. Datos/assets/V8/backup **836** sin cambios inesperados; integridad histórica **4036/4036**, manifiestos de esta autorización **482/482**. Identidades, fuentes/fotos, package/lock intactos. F01–F12 **NO EJECUTADO**: probar la candidata exacta indicada con hardware, sin sustituir por emulación/documentación. OD-01 **POST-V1/DIFERIDO**.

OSM real: Chromium 116 fallos TLS/0 respuestas; WebKit 53 respuestas/0 fallos. B25 UI y disponibilidad externa se certifican por separado; TLS verificado, sin mocks para aprobar OSM. Fotografía/licencias de zonas conserva su pendiente histórico independiente.

Main observado avanza **8046464 → 4fc32fe (#191) → ce951a8366e37f35d801e237ab7f3071204879a8 (#192)**; cambios inspeccionados, sin incorporar/escribir main. Backup `40838062062c8820ea9f7b028675d8add0c96c32`, RC/tag v1.1.0 `d72e19921b4aa9c9f68d0d07f8b35f37f158a286` intactos. Checkpoints no forzados sólo en codex/b10-pulido-mission; sin merge/main/claude/*/#168/Astra/Vercel/deploy ni modificación del RC.

---

# Estado operativo B10 — continuación autónoma de #177, 2026-10-02

**INCOMPLETO; PR #177 Draft, sin fusionar.** Inicio `23e112f288600d115633963e2edf50676bdd4469`; código nuevo publicado `0518646c0c429ad405371bc40789e8059f880e78`. [Informe operativo y lotes](B10_CONTINUATION_REPORT.md), [evidencia nueva](B10_CONTINUATION_EVIDENCE.json), [propuestas E01–E04 completas](B10_EDITORIAL_PROPOSALS.md) y [matriz física](B10_PHYSICAL_QA_MATRIX.md). Las evidencias históricas mantienen sus SHAs y no certifican los nuevos commits.

G6 **FAIL**: entrada escrita 273259 → **271025 B gzip**, ahorro 2234; ceiling **253742**, exceso **17283**, sin ratchet/excepción ni métrica distinta. CSS: cuatro superficies/globales extraídas por lotes, **App.css 1259 → 457 líneas**; CSS compilado final idéntico al inicial, con limitaciones de PNG y subpíxel WebKit detalladas en el informe. Tokens/hex y responsive legacy pendientes, sin equivalencias inventadas. A-01 confirmado (64/70/28/150 pasos Tab), patrón/textos de salto condicionado a Producto. E01–E04 abiertas, ninguna propuesta aplicada; OD-01 **POST-V1/DIFERIDO**.

Datos canónicos, package/lock, fotografías públicas y persistencia V8 conservados; APIs y funciones verificadas. Build/lint y G1 **119 archivos/3429 PASS**; censo explica también la certificación anterior 116/3501 y replacements de main. Integridad histórica y comprobación adicional git-hash-object **2131/2131**. Regresión final por gate/motor y todos los intentos en el informe/manifiesto; no convertir muestras parciales en PASS global. Matriz física F01–F12 **NO EJECUTADO**: no aprobación de Safari/iPhone/lector/selector físico. OSM/TLS y fotografías/licencias de zonas son dos pendientes externos separados.

Main incorporado permanece `e124591b19f9f241a38091598faf2c1d27b554e4`. Main remoto observado `80464643528a458de05149b01a8b5c2e5b94a77f` (#190, sólo documentos inspeccionados, no incorporados). Respaldo remoto intacto `codex/b10-backup-pre-reconcile-20261001` → `40838062062c8820ea9f7b028675d8add0c96c32`. Publicación exclusivamente en esta rama con actualización no forzada y verificación concurrente previa. Sin merge, rebase, force-push, main/claude/*/#168, Astra, Vercel/deploy ni cambios al RC congelado.

Lo siguiente conserva snapshots anteriores y su autoridad/alcance histórico. El estado operativo es esta continuación; propuestas previas no son aprobación ni permiso para ampliar presupuestos.

---

# Autoridad de gates de navegador

Clasificación de `app/scripts/*` medida sobre main `c512db1` (B10 integrado), Chromium 141, build de producción (`vite preview`).
Es evidencia de ejecución, no una opinión: la causa de cada fallo se leyó del log. Sigue siendo válido «Autoridad» sólo mientras el gate pase.

Requisitos de entorno: `npm run build` antes; gates que usan `vite preview --port 4181` (B17/B18/block19/block20/ddr03) necesitan ese servidor levantado; `NIHON_CHROMIUM_PATH` apunta al Chromium disponible.

## 1. Autoridad vigente (pasan)
B10 (motion, a11y, microcopy, performance) · evidence-options-check · block1-ux · block2-photography · block3-zones · block4-zone-planner · block7/8/9/10 (zonas) · block13-portable-backup · block14-release-readiness · phase4c/d/j/l · block22 b6-4 · b24-real-input · D0b · D5 · B25 · B26 · B27 · B28 · B29 · B30 · B31 · block5 · block20 · block19 (contraste, grid) · block23 · ddr03 · DD-028 · B17 (tap-target, responsive) · B18 (a11y, chrome, responsive, viaje-lugar, browser-back) · b24-ddr3-home · b21-global-search · block6 · block12 (bundle) · block22 b6-2/b6-3/b6-5/b6-6 · phase4f · phase4h · integración B24+B23 · phase5a.

## 2. Actualizados en esta misión (eran del gate, no del producto)
| Gate | Estado previo en main | Ahora | Causa del desfase |
|---|---|---|---|
| phase5a (RC) | 47/50 (A14, C01, C06) | 50/50 desktop y mobile | `Dato:` retirado (D5/B31); composición y reservas viven en Resumen/Reservas |
| integración B24+B23 | 56/58 | 58/58 | consecuencia de phase5a |
| phase3f-f / h / j / s | crashean | pasan (2 pasadas) | corazón «Quiero ir: …», onboarding, «Mover a…», calendario «del viaje», borrador v7→v8, EvidenceMark en fechas |
| b18-regression | falla | 40/40 | `.selection-*` retirado (B25), Nosotros rehecho (B26), «Comparar otro orden» inalcanzable (D5-M1) |
| block12 (bundle) | 4 ✗ | 78/78 | ver §2.1 |

### 2.1 block12: no era una regresión de B10
`no deferred surface is pulled into the document's critical path` pasaba en `2a10ad3` y fallaba en `c512db1`. Causa: B10.4 dio CSS propio a los chunks `OrderedSequenceBuilder` y `ZoneComparison`; con CSS asociado Vite inyecta en tiempo de ejecución un `<link rel="modulepreload">` al hacer el `import()` en reposo, y el gate leía el DOM vivo.
Medido en ambos builds (3 repeticiones): FCP ≈ 300–360 ms; los chunks se piden a ≈ 420–470 ms (idéntico); `dist/index.html` tiene 0 `modulepreload`; el entry no importa estáticamente los chunks. La invariante real (fuera de la ruta crítica, pedidos tras la primera pintura) se mantiene; el gate ahora la mide directamente (HTML servido + `start > FCP`) y pasa en ambos builds.

## 3. Obsoletos: verificación ítem a ítem hecha (endurecimiento post-B10, Fase 6)
La columna «cobertura equivalente» de esta tabla fue «criterio de ingeniería, no verificada ítem a ítem». **Ya está verificada**: [GATE_RETIREMENT_AUDIT.md](GATE_RETIREMENT_AUDIT.md) enumera las invariantes de cada gate, las contrasta con la build actual y con los gates vigentes y documenta lo cambiado.
Resultado: **ningún gate se retiró por ser viejo**; 16 se **reescribieron** (misma cobertura, entrada moderna, verdes en 3 viewports) y están en §1; los 4 `phase3e-*` pasan a `evidence-options-check` (nuevo, §1).

| Gate | Estado | Cobertura |
|---|---|---|
| block1-ux · block2-photography · block3-zones · block4-zone-planner · block7-zone-provenance · block8-airport-link · block9-editorial-governance · block10-source-freshness · block13-portable-backup · block14-release-readiness · phase4c · phase4d · phase4j · phase4l · block22-b6-4 · b24-real-input (P0-2) | **REESCRITOS, vigentes** | ellos mismos (153 · 81 · 99 · 258 · 129 · 114 · 153 · 81 · 150 · 229 · PASS ×4 · 492 · 1323) |
| phase3e-e / g / i / k | **superseded** por `evidence-options-check` (89/89) + B29; se archivan con `LocalSwapAlternativesSection` | mismas fixtures y cifras en la interfaz vigente |

## 4. No medibles aquí
WebKit (no instalado en esta sesión; B10 lo certificó con WebKit 26.5), Safari/iPhone físico, lector de pantalla físico.
