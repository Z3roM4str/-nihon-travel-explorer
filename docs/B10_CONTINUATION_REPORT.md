# B10 — continuación técnica desde la reconciliación (2026-10-02)

**INCOMPLETO; #177 Draft.** Esta evidencia nueva parte de `23e112f288600d115633963e2edf50676bdd4469`. No certifica ni modifica los manifiestos históricos. Sólo se publica en `codex/b10-pulido-mission`; sin merge, deploy, rebase, force-push, escrituras a main/#168/claude/* o cambios al RC congelado.

## Estado consolidado de esta continuación

Inicio **23e112f288600d115633963e2edf50676bdd4469**, código final **0518646c0c429ad405371bc40789e8059f880e78**. Publicación documental final identificada por HEAD de #177; checkpoints completos abajo. G6 **273259 → 271025 gzip**, −2234, **FAIL +17283**; CSS cuatro lotes y archivo compilado idéntico, App.css **1259→457**. A-01 reproducido/condicionado; propuestas E01–E04 completas sin aplicar; matriz física toda NO EJECUTADO; OD-01 POST-V1/DIFERIDO.

Regresión nueva completa **119/3429**, invariantes/replacements/API y superficies verificadas; 51 ejecuciones principales (42 positivas PASS, seis negativos detectados, tres FAIL G6×2/B25). Integridad histórica y git hash-object **2131/2131**. Los seis archivos lógicos de evidencia nueva, sus partes/miembros y fingerprint de app se describen en [B10_CONTINUATION_EVIDENCE.json](B10_CONTINUATION_EVIDENCE.json). [Core final](evidence/b10/continuation-20261002/final-core.json) contiene comandos/logs/intententos/censos y comparación B24, sin reetiquetar históricos. Los criterios exactos que impiden Ready for Review están al final.

## Precondiciones y nuevo hallazgo

Rama inicial remota exacta `23e112f`; main remoto `80464643528a458de05149b01a8b5c2e5b94a77f`; respaldo remoto intacto `40838062062c8820ea9f7b028675d8add0c96c32`. Se examinó `e124591..8046464`: sólo CURRENT_WORK_HANDOFF, GATE_AUTHORITY y RELEASE_CERTIFICATION; la certificación corresponde a main, no a #177. No se incorpora. No hay AGENTS.md en raíz, padres accesibles ni rutas del repositorio (`git ls-files`/rg y GET raíz 404).

`npm ci` con lock exacto falló por caché fuera del workspace; reintento con `--cache /workspace/b10-work/npm-cache` PASS. Node 24.19.0/npm 11.9.0 y Vite 8.2.2 reproducen los inputs publicados. `npm run build` **fallaba en HEAD inicial** por TS6133, `useEffect` sin uso en TravellerManager. Se retira sólo el import: sin cambiar restauración de foco ni datos. El analizador construye directamente con Vite y reproduce el bundle inicial, pero ese éxito no sustituye typecheck.

## Lote G6 — optimizaciones acotadas, sin excepción

Medición exacta: `node scripts/bundle-report.mjs --json`, y `gzipSync(buffer,{level:9})` del archivo que referencia dist/index.html. Entrada inicial escrita `index-BnwsS3X1.js`: raw 1.414.556, **273.259 B gzip**, SHA256 `54a626c5ca9d0288d3c7131b3568f53b8f310765939f3fd85910f5fd71cec955`. Analizador: **273.163 B**, idéntico al histórico. CSS inicial 21.040 B gzip. Ceiling inalterado **253.742 B**.

- Compartir cadenas fotográficas repetidas en el módulo generado: −219 B gzip del analizador. Datos canónicos, campos, orden, identidad y API síncrona intactos; no decoder ni carga diferida. 202 lugares/244 imágenes, registro completo, embedded/fallback/missing/card API exactamente iguales.
- Proyectar sólo `assessment` de endpointSnapping privado: el runtime sólo lo consume en `isSnapClean`; coordenadas/distancias/radius permanecen en los artefactos canónicos auditables. API pública idéntica en 46.225 pares dirigidos, 325 enlaces validated-static y métricas forward/reverse; mutante que elimina assessment detectado en 325 pares.
- Entrada conjunta escrita provisional **271.025 B gzip**, ahorro **2.234 B**, exceso **17.283 B**. **G6 FAIL**. No se cambian métrica, ceiling, referencia, exclusiones ni funcionalidades. El ensayo JSON.stringify global aumentó la entrada (+196 B analizador) y se descartó; su fallo/medidas se conservan. Ningún módulo de producto se difiere en este lote.

Build/lint y suite completa **119 archivos/3429 tests PASS**. WebKit rendimiento **12 PASS/1 FAIL, sólo G6**. Chromium registró un exceso fotográfico adicional con `homeCount=0` en Okinawa desktop; comparación inicial registró exceso en Tokio móvil. Se conserva y se investiga la frontera de medición; aún no se atribuye a herencia ni se declara PASS fotográfico desde esas muestras. Identity físico y la regresión final se completan por separado.

Módulos mayores del entry: ReactDOM 453.153 B renderizados; places 407.066; Leaflet 242.212; walking-scale 220.554 antes del lote; fotografía runtime 143.107; nearby 105.154. No son gzip aditivo ni explicación cuantitativa exacta del delta histórico. Store mantiene catálogo/nearby síncronos; transfer es compartido por consulta y planificación; fotografía sirve lista/ficha/créditos; Leaflet es alcanzado estáticamente por PlaceMap y NationalExplorer→NationalMap, además de ZoneComparison diferida. Los dos chunks de viaje y su prefetch de main se conservan.

## Integridad y conservación de pruebas

Nueva comprobación local completa: **2131 registros, cero discrepancias** (archivos, miembros de tar y inputs de app en el SHA inicial); hashes SHA256 y Git blob SHA1 por contenido. Todos los manifiestos B10 históricos byte a byte iguales al inicio. La primera comparación incluyó cinco inputs de trabajo modificados: se conservó el diagnóstico y se corrigió la selección a `git show 23e112f:path`, sin modificar hashes esperados. No son cinco artefactos históricos corruptos. La ampliación sobre los 369 registros anteriores verifica también reconciliación y sus miembros, no cambia su resultado histórico.

Suite ejecutada de nuevo con el mismo lock/toolchain: B31 `b854db3` **115/3479**, respaldo `4083806` **116/3483**, main incorporado `e124591` **117/3422**, reconciliación **119/3429**. El inventario incluye src, scripts `.test.mjs` y server/transit.test.ts; contar sólo src habría omitido suites reales. El censo conserva cambios por fichero y diferencias de assertions; la explicación detallada se completa antes de certificar el código final. Main retiró las vistas inalcanzables builder/compare, hours-planning y callbacks del panel LocalSwap: no se restablecen alternativas rechazadas. Ver D5_M1_UNREACHABLE_VIEWS_RETIREMENT, LEGACY_SWAP_RETIREMENT y GATE_RETIREMENT_AUDIT para su autoridad y reemplazos B29/evidence-options.

## Publicación y evidencia de este checkpoint

| Lote | Commit remoto | Commit local conservado | Tree idéntico |
|---|---|---|---|
| Import de build | `3590845c73678f2b59321c813c0e2cee7be0c358` | `d32bd384ea0b5d980d056d38a70a5581350d1eb0` | `3579551f9610fa81443bed7771b058551a1f8900` |
| G6 | `774d989a99d83b7e6778a58f6ecd0c8639ba3893` | `8b2a265ee491d13c8b77f8c63d6463c0012d203c` | Ver manifiesto de continuación |

HTTPS push sin credenciales; publicación Git-data con `force:false`, comparación de refs previa y tree exacto. Se conservan refs locales de transporte; el puntero local se alinea con el mismo tree remoto sin rebase ni cambio de código. Implementación y documentos/evidencia en commits separados.

[Evidencia G6 reversible](evidence/b10/continuation-20261002/g6.tar.gz) · [SHA256/Git blobs y miembros](evidence/b10/continuation-20261002/g6.json).

Continúa la extracción de CSS por superficies y la investigación A-01. E01–E04 siguen sin aprobación verificable; OD-01 POST-V1/DIFERIDO. Safari/iPhone, lector y dispositivo físicos siguen no ejecutados; protocolo preparado no equivale a QA físico. OSM/TLS y fotografías/licencias de zonas son pendientes externos separados. Ready for Review sigue bloqueado; este checkpoint no es el cierre de B10.

## CSS lote 1 — alias/reset/foco global

Extraídas 88 líneas a `styles/foundation.css`, importada justo antes del App.css restante. Orden/especificidad/tokens sin cambios. Implementación remota `e72304cc2e8bbbd4b5cd0575a0a115ee84b15d3f`, tree `78729affccdcb73cc351d9334463f00da24818e3`. Typecheck/build y G1 **119/3429 PASS**; el test de alias conserva todas sus assertions y apunta al nuevo dueño.

CSS compilado inicial/final de este lote byte a byte idéntico: SHA256 `4141b3abc0339ad473bd40205fb861cd7a8075cc23b979da3a28f1fb06d0bccf`, 107.588 B raw/21.040 gzip. Chromium: captura de 200 estados en 320/390/839/840/860/861/1200/1440. Primera comparación: 194 iguales, seis con cabecera en distinto estado de scroll (borde visible); repetición focalizada de ambas builds en 860/861: **50/50 iguales**, sin normalizar ni quitar el borde. WebKit: **75/75 iguales**, 320/390/1440. Incluye búsqueda/filtros, ficha/Créditos/lightbox, mapas, Días/Mover/otro orden, Nosotros, Reservas/Resumen y vacíos.

Fixture visual de primitivas: 24 estados normal/reduced × base/hover/focus/active × 320/390/1440. El primer intento PNG registró 11 píxeles distintos en el borde del botón enfocado 1440 (estilos/cajas iguales), conservado. Captura posterior aplica dos frames y la opción nativa `animations:disabled` a **ambas** referencias para comparar presentación final, sin tolerancia: **24/24 estilos/pseudos/cajas/PNG exactos**. El movimiento se comprueba además con sus guards propios; no se certifica una animación a partir de una captura terminada. El CSS generado es idéntico, también durante la extracción posterior de botones.

[Archivo del lote y todos sus intentos](evidence/b10/continuation-20261002/css-foundation.tar.gz) · [Manifiesto](evidence/b10/continuation-20261002/css-foundation.json). Continúan botones, shell y superficies globales restantes; la extracción de App.css no está terminada.

## CSS lote 2 — botones/utilidades

Extraídas **163 líneas** a `styles/buttons.css`, después de foundation y antes del shell restante. `.button` y variantes primary/secondary/quiet/danger/lg, `.icon-button`, `.tap-target-min`/pseudo-target y `.link-button` conservan declaraciones, comentarios, precedencia y reduced-motion posterior. Sin nuevos tokens/valores, hex ni media queries. G1 **119/3429**, build/lint PASS. Los tests globales ahora leen los imports reales en orden, y fallan si no encuentran ninguna hoja; no se retira ninguna assertion ni se estrecha el inventario.

CSS compilado sigue idéntico (SHA256 de lote 1). Paridad de primitivas **24/24 PNG/pseudos/cajas/estilos por motor** en Chromium y WebKit, normal/reduced, hover/focus/active/disabled y tres anchos. La primera comparación de superficies mostró 19 diferencias: 16 estados con una skeleton extra de una foto lejana (persistía oculta en destinos posteriores) y tres con distinto scroll de cabecera. Se conserva el fallo. Para comparar el mismo estado se prepara explícitamente **en ambas builds de paridad** una fixture con imágenes decodificadas y el evento del dueño de scroll; no se elimina ningún elemento de la comparación ni se excluye CSS. **75/75 estados computados/cajas iguales**. Esta fixture no certifica lazy loading ni disponibilidad externa: rendimiento, errores fotográficos y movimiento tienen guards separados.

Gate de rendimiento corregido: espera la portada realmente montada y todas sus imágenes eager, y asienta las lecturas de cuerpos de respuesta antes de cerrar la ventana. No aumenta timeouts ni cambia ceiling/ventana contractual. Chromium **12 PASS/1 FAIL (G6)**, con portada medida (nunca homeCount=0). Mutante real de imagen lejana eager: **FAIL adicional por descarga nueva**, conserva la protección. Su publicación separada es `d69dd2d5867ebd21b6ca5ce20abb89c984c18e73`.

[Evidencia del lote](evidence/b10/continuation-20261002/css-buttons.tar.gz) · [Manifiesto](evidence/b10/continuation-20261002/css-buttons.json). Continúa shell; App.css permanece para otras superficies y deudas normativas.

## CSS lote 3 — shell y guardas globales

Extraídas **489 líneas** a `styles/shell.css`, después de buttons y antes del residual App.css. Shell, cabecera, paneles/destinos, estados de búsqueda, zoom/backdrop y sticky conservan literalmente declaraciones, orden, tokens, responsive y especificidad. G1 **119/3429**, build PASS. CSS compilado conserva SHA256 `4141b3abc0339ad473bd40205fb861cd7a8075cc23b979da3a28f1fb06d0bccf`. Movimiento Chromium **17/17**; higiene D0b **56/56**. Al ampliar el inventario global, el primer D0b contó discovery dos veces (8≠7 safe-area): fallo conservado; se corrigió lectura disjunta sin cambiar el esperado 7 ni assertions. Motion/higiene leen imports globales reales y fallan si no hay hojas, evitando un PASS vacío tras moverlas.

Captura Chromium, siete anchos (320/390/839/840/860/861/1440): **175/175 estilos/cajas iguales**. Las seis diferencias previas eran la cabecera en otro scroll. Fixture común final prepara imágenes, fuentes y scroll real en reposo; no normaliza ni elimina propiedades/elementos. WebKit: los intentos de 75 estados conservan una diferencia de DOM en onboarding y después Viaje vacío; 74/75 estilos/cajas iguales. Se comprueba el montaje lazy antes de repetir; no se declara aún la captura completa PASS. Las captures de PNG de Chromium: **127/147 exactas**, otras 20 con 8–305 píxeles distintos (bounds/cuentas conservados), pese a iguales estilos/cajas y CSS compilado. No se declaran los 147 PNG exactos ni se atribuyen esas diferencias a herencia: la certificación acota paridad de cascade/cajas y primitivas; los PNG originales quedan disponibles para revisión.

## A-01 — reproducción exacta, condicionado a Producto

Se leyó A-01 de B10_PULIDO_AUDIT: **recorrido lineal de teclado entre colecciones**, no el identificador distinto B10-A1 ni el defecto de scroll embedded. Tab real en Chromium y WebKit, 390 y 1440, reproduce cuatro colecciones con **32/35/14/75 tarjetas, 64/70/28/150 pasos hasta salir**. Conserva apertura y Quiero ir, dos controles por tarjeta. Se publican inventarios de controles visitados y capturas. No es físico/lector, ni demuestra confort de navegación.

Corregir requiere patrón aprobado de navegación/controles (`08`, auditoría y misión); no hay aprobación verificable, comentarios/reviews #177 vacíos al revisar. Propuesta concreta recomendada: enlace contextual al inicio de cada colección que salte al encabezado de la siguiente (foco programático, `tabindex=-1` sólo en encabezado), texto completo **«Saltar a la siguiente colección»**; en la última **«Saltar al mapa de Japón»**. Conserva los 312 controles existentes y sus funciones; volver conserva foco/scroll. Producto debe aprobar patrón y estos textos. Alternativa: navegación por landmarks/encabezados ya útil con lector, pero no reduce Tab lineal. Roving tabindex quitaría acciones del recorrido normal, no se implementa. A-01 continúa OPEN/DECISIÓN, sin atribuir corrección a los guards de scroll/foco.

## G6 — atribución por cambio y trabajo adicional concreto

Medición **del archivo escrito** aislando sólo el pool fotográfico (mismo nuevo código con el plugin walking inicial): **273.042 B gzip**, −217 B vs 273.259. Al añadir la proyección endpointSnapping: **271.025 B**, ahorro marginal −2.017 B. Conjunto −2.234 B, exceso **17.283 B** respecto al ceiling inalterado 253.742. El −219 anterior corresponde exclusivamente al analizador y no se sustituye silenciosamente por una cifra escrita. Ahorros comprimidos no son aditivos por módulo; esta atribución se refiere al orden de cambios probado.

No queda una optimización pequeña demostrada que cierre G6 en las condiciones autorizadas. JSON global aumentó y se descartó; ampliar proyección elimina campos consumidos o canonización/persistencia; borrar funciones/datos y ratchet/excepción no están autorizados. Trabajo adicional propuesto, sin implementarlo ni estimar ahorros gzip a partir de rendered: delimitar conjuntamente las dos hojas de Leaflet (PlaceMap y NationalMap) detrás de un loader compartido, manteniendo NationalExplorer/lista síncronos, CSS ordenado y estado de centro/zoom. Medir un prototipo y ruta crítica antes de adoptarlo. Requiere ampliar alcance de carga/presentación, con estados aprobados de error/reintento si son nuevos. Gates necesarios: entrada fría y warm, primera apertura de cada mapa, segunda navegación, prefetched/not prefetched, chunk 404/offline y reintento, volver y restauración de foco/scroll/zoom, galería/otras pestañas y V8 sin escritura al consultar; comprobar chunks secundarios y foto/CPU/ruta crítica. No se aplaza ningún módulo de producto en esta continuación; se conservan boundaries y prefetch que ya venían de main.

## CSS que sigue pendiente por norma

Las extracciones conservan todos los valores legacy; no equivalen a aprobar su migración de tokens. Tags `.tag--gem`, `.tag--alert` y variantes reservation, fondo del mapa nacional y sus equivalencias no tienen autorización para inventar un color equivalente. Se conservan los siete hex de declaraciones y dos hex en comentarios, más el fondo nacional: diez referencias en App.css. Responsive legacy global conserva max-width y el patrón de tablet; la conversión mobile-first exige validar por dueño y puntos fraccionarios de ruptura, junto con overrides de componentes. No se cambia diseño, valor ni consulta para hacer que un inventario marque PASS. El residual y sus propietarios quedan en el inventario final; no se elimina App.css entero a costa de declaraciones sin migrar (`08`, Cómo tratar el CSS actual).

Implementación shell `c8ad41056f6426abfc5f5a0794dcbe78920e3641`, tree `1d0394e4f286a7c25f9ce8c014657be89d07a2c6`. [Evidencia shell/A-01, archivo dividido y hashes](evidence/b10/continuation-20261002/css-shell.json) · [Manifiesto](evidence/b10/continuation-20261002/css-shell.json).

El primer envío del archivo shell fue rechazado por límite MCP de 16 MiB. Se preserva el fallo y el archivo local íntegro; almacenamiento publicado dividido en partes de 8 MiB, con hash del archivo ensamblado y de cada parte. Ensamblar en orden `.part000…` y verificar SHA256 antes de extraer. Los 147 pares PNG tienen inventario de hashes; se publican los 20 pares distintos y cinco pares representativos, no todas las capturas iguales. Originales completos disponibles en workspace. No se modificó ninguna referencia remota en el intento fallido.

## CSS lote 4 — Quiero ir/Nosotros/Viaje y fuentes compartidas

Extraídas **61 líneas** y retirado un separador vacío final a `styles/secondary-screens.css`: contador Quiero ir, foco contextual, columna Nosotros/lista de licencias, navegación Viaje y targets de fuentes/atribución. Mantienen posición inmediatamente tras App.css y antes de alerts/discovery/trip-overview. El primer candidato movía los targets por delante del resto del lote: aunque 75/75 estados por motor coincidían, se descartó por alterar el orden compilado. Se incluyeron en el mismo dueño/global y se recuperó **CSS compilado idéntico al inicial**, SHA256 `4141b3abc0339ad473bd40205fb861cd7a8075cc23b979da3a28f1fb06d0bccf`, 107.588 raw/21.040 gzip. Implementación `0518646c0c429ad405371bc40789e8059f880e78`, tree `4ac6063fa499fe59d3ffefd589d9f7c991384659`.

G1 del lote **119/3429** y build PASS; movimiento **17/17** y D0b **56/56 por motor**. Chromium final: **75/75 estilos/cajas iguales**, 320/390/1440. WebKit final: **74/75**, cuatro valores de ancho flex/SVG de Dónde dormir 320 difieren **0,015625 px**. Repetición de ambos lados conserva la diferencia pero intercambia las dos variantes. Comparaciones **baseline consigo misma y final consigo mismo**: ambas reproducen esos mismos cuatro valores; no hay cambio de declaraciones/cascada ni se normalizan/redondean propiedades para forzar PASS. Las superficies modificadas de este lote coinciden; la limitación de paridad estricta de toda la recorrida se conserva. Las capturas previas fallidas por skeleton/onboarding/Viaje frío motivaron esperar montaje real del panel y fuentes/imágenes en ambas referencias; no cambia el gate de rendimiento.

App.css: **1259 → 457 líneas**, 801 trasladadas por superficie y un separador vacío retirado en cuatro lotes. Ocho hex de declaraciones, dos referencias en comentarios, dos queries max-width globales y overrides legacy de componentes continúan; no se declaran G4 ni la migración completa cerradas. No hay hex/media consultas/tema/textos nuevos. Paridad demostrada: CSS generado exacto final, matrices anteriores y checks de superficies; PNG global estrictamente exacto sólo en 127/147 pares del lote shell y 24/24 primitivas por motor, con todos los fallos conservados.

## Diferencia de suites: inventario, autoridad y regresión

Censo ejecutado (mismo lock/runtime) B31 **115/3479**, backup **116/3483**, main incorporado **117/3422**, inicio y código nuevo **119/3429**. B31→main: −89 assertions y +32, neto −57. Eliminadas/reducidas: OrderedSequenceBuilder four-place-interior-reversal −9, interior-transposition −14, local-relocation −14, local-swap −11, test principal −12, two-pair-block-swap −9; evidence-complete-four-place-interior-reversal −1; hours-planning −19 (única suite completa retirada). Añadidas: b10-structure +5, DayOrderToolPanel +1, d5-normative-vocabulary +22, photography projection +4. Backup añade cuatro assertions L1 de FilterPanel; main→inicio conserva esas cuatro y tres motion-contract.

La retirada es de main y está documentada en D5_M1_UNREACHABLE_VIEWS_RETIREMENT, LEGACY_SWAP_RETIREMENT y GATE_RETIREMENT_AUDIT; no se acepta sólo por el total. Las funciones puras de dominio se conservan. La assertion −1 verificaba una única escritura del hook reverseFourPlacesWithinDay que main retiró junto al callback inalcanzable. Se conserva diff/nombres de cada assertion y se ejecutan los reemplazos **evidence-options 89/89**, B29 y los nueve archivos de invariantes **231 tests** sobre el nuevo código. En esta continuación **ninguna suite/assertion eliminada**; lectores CSS apuntan a dueños/imports reales y conservan todos los esperados. El JSON Vitest `numTotalTestSuites` cuenta también describes; archivos reales = longitud de `testResults` (119), no 719.

[Evidencia lote 4, incluso candidato descartado y autocontroles WebKit](evidence/b10/continuation-20261002/css-secondary.json).

Se investigó además la certificación **116/3501** de `c512db15a1d253a1c6704ad0798f80dea142e173` (#179, sólo lectura, sin escribir claude/*): rerun exacto **116/3501 PASS**. Lock/package idénticos al actual. B31→c512 añade las 22 assertions D5; c512→main retira las mismas 89 y añade 10 (5 structure, 1 DayOrderToolPanel, 4 photography), **3501−89+10=3422**; inicio añade siete, **3422+7=3429**, diferencia neta **−72** frente a aquella certificación. El nombre del test de alias cambió al dueño foundation (mismas assertions, delta cero); el censo nuevo distingue esa sustitución nominal de eliminación. No se oculta la cifra previa 3501.

Tag **v1.1.0 d72e199** reconstruido nuevamente en worktree separado: mismo lock y SHA256 del analizador (`b4e555b4…`), mismo Node/compresión. Analizador **253742 B gzip**, archivo escrito **253725 B**, raw 1389624, Brotli 203729; SHA256 `e157fcb004aac0fabc9acdcc79da421da1226ad1401a15d01627688d3fa3e48b`. Reproduce la diferencia de etapa histórica, conserva ceiling 253742. Entrada nueva escrita raw 1377221 / gzip **271025** / Brotli 217843; SHA256 `256f0d3a54fe36ff6b8db98b5dfd540d464b1ab7049cb1b1455d9629abbd99de`. Comparación entre archivos escritos: +17300 frente al tag; exceso del gate +17283. La mejora no se traslada a chunks/ruta crítica: ningún boundary cambia; CSS idéntico, presupuesto de imágenes identity de siete hubs conservado y performance final 12/13 por motor sólo falla J01/G6.

Comprobación adicional independiente previamente no ejecutada: **git hash-object --stdin**, sin `-w`, sobre los **2131 contenidos** históricos ya verificados por hashlib: **2131/2131 iguales**, sin eludir permisos ni límites. Se conserva JSON individual. SHA256 históricos y todos sus manifests siguen byte a byte; nuevo app fingerprint sólo corresponde a `0518646c`, no recertifica artefactos anteriores.

## Externos reales y pendientes físicos

B25 final **121/123 FAIL**, dos C-CLEAN por `ERR_CERT_AUTHORITY_INVALID`. Comparación nueva sobre el SHA inicial con el mismo Chromium/instalación/browser y dist inicial: **122/123 FAIL**, misma clase TLS, distinta incidencia de ventanas; no se igualan artificialmente los totales ni se atribuye un éxito/fallo completo a herencia. Diagnóstico real sin interceptar red: **107 peticiones externas, cero respuestas**, 70 errores TLS en `a/b/c.tile.openstreetmap.org`, 37 abortadas durante navegación; probe HTTPS directo además falla `ENETUNREACH` IPv6. Eso describe este entorno, no demuestra caída de OSM ni aprueba B25. TLS por defecto intacto; sin mocks/ignoreHTTPSErrors/certificate flags. Se conservan URLs/errores y ambos gates íntegros.

[Matriz física F01–F12](B10_PHYSICAL_QA_MATRIX.md) lista pasos/configuración/resultado esperado para el código `0518646c`: **todas NO EJECUTADO**, sin aprobación de QA físico. Chromium/WebKit Linux, DOM y `setInputFiles` no certifican Safari/iPhone, VoiceOver/TalkBack, selector, gestos, zoom o comportamiento del dispositivo real. OSM/TLS y adquisición/verificación real de fotografías/licencias de zonas son **dos pendientes externos separados**; preparar matriz no los cierra. OD-01 sigue POST-V1/DIFERIDO, sin control nuevo.

Los [literales E01–E04 completos y contextos 0/1/N/parciales](B10_EDITORIAL_PROPOSALS.md) quedan preparados para decisión verificable; ninguno aplicado. Comentarios/reviews #177 vacíos al revisar no son aprobación. Recomendaciones del informe anterior conservan ese carácter.

CSS restante requiere resolver valores no tokenizados por dueño (tags, fondo nacional, tipografía/espaciado legacy) con equivalencias aprobadas; una aproximación que cambia el aspecto contradice la paridad exigida. Responsive App conserva dos consultas max-width; convertirlas exige definir la equivalencia de bordes/intervalos y cascada de overrides de discovery, incluida anchura fraccionaria: sustituir max860 por min861 introduce un intervalo distinto, no es una conversión exacta autorizada. No se hace limpieza de queries/colores por grep ni se extrae una superficie sin migrar como si G4 estuviera cerrado.

## Checkpoints publicados de esta continuación

| Commit remoto | Lote |
|---|---|
| `3590845c73678f2b59321c813c0e2cee7be0c358` | fix(b10): remove unused hook import blocking the reconciled build |
| `774d989a99d83b7e6778a58f6ecd0c8639ba3893` | perf(b10): share photo literals and project private snapping detail |
| `672bb790802d6c047ad8a3d1d1659bcce4450696` | docs(b10): preserve continuation baseline and bounded G6 evidence |
| `e72304cc2e8bbbd4b5cd0575a0a115ee84b15d3f` | refactor(b10): extract token aliases and reset with CSS parity |
| `f78c3a34447305a392f89b32d4d00a00e4da7f50` | docs(b10): certify the foundation extraction and preserve parity attempts |
| `d69dd2d5867ebd21b6ca5ce20abb89c984c18e73` | test(b10): measure rendered home and compare matched CSS states |
| `11caf4bcd4ce1c1375db52891891771786c52dc0` | refactor(b10): extract shared buttons with states and cascade parity |
| `e0e3c60d61578331ee392306085af86d9cbd3c61` | docs(b10): certify button parity and keep measurement failures |
| `c8ad41056f6426abfc5f5a0794dcbe78920e3641` | refactor(b10): extract shell without changing cascade or motion guards |
| `ea2b2310cd869c8a5d2d008609ac5437beb8550b` | docs(b10): record shell parity A-01 reproduction and physical protocol |
| `0518646c0c429ad405371bc40789e8059f880e78` | refactor(b10): extract shared screens and source targets in original order |
| `8ecb4698a6b75ffcce6525c98370273965cfcd79` | docs(b10): certify shared surfaces and explain retained test coverage |

## Regresión final completa sobre `0518646c`

Orquestador principal terminado: **51 ejecuciones**, **42 PASS positivos**, **6 negativos detectados**, **3 FAIL reales conservados**: performance Chromium/WebKit (J01/G6) y B25 (TLS). Además 17 ejecuciones de superficies ampliadas PASS, y block12 **78/78 PASS**. En el extra, los archivos etiquetados block20-chromium/block20-webkit ejecutan **ambos Chromium** porque ese runner sólo soporta Chromium; no se presenta su duplicación como cobertura WebKit. Gallery/motion/L2/visual WebKit se ejecutan con los runners que sí soportan ese motor. Primer nombre erróneo block12 queda MODULE_NOT_FOUND, separado de la ejecución corregida; no es un FAIL de producto ni se oculta.

- Build/typecheck, lint y G1 **119/3429 PASS**; invariantes nueve archivos **231**, evidence-options **89**. API fotografías **202 lugares/244 imágenes**, walking **46225 pares/325 enlaces** y controles negativos del lote G6 preservados.
- Movimiento, a11y, galería, mapa nacional, L1/L2 y D0b PASS según cada log/motor. B26 **314/314**, B30 **475/475**, B31 **281/281** por motor; B27 ocho viewports, B29 **163**, B28 **64**, B18 back **15** y regression **40**.
- T-01 block1 **153**, block13 **150**, block14 **229**; Phase5A **50/50 por viewport**. B19 discovery/grid/contraste, B20 detalle, B6.6 fotografía, B23 retry, B18 responsive/chrome/a11y/Viaje-lugar y B21 móvil/desktop de ambos motores PASS.
- Foco: **20 repeticiones por motor**, devolución inmediata y storage igual; mutante bloqueado falla en la primera iteración (BODY/null frente a reset-trv-b). Scroll embedded: rueda real mueve dueño visible sin escribir; mutante CSS contained mantiene 0→0 y falla en ambos motores. Imagen lejana eager falla adicionalmente I-móvil-Tokio (una descarga nueva), además del G6 que ya fallaba. Icono oculto de Días falla P0-2 por contraste1.00<1.5. No se usan sus exit1 sin revisar la causa.

**Contador B24 investigado también**: histórico 1341, primera ejecución final Chromium sistema **1333/1333**, SHA del gate idéntico `abf039fb5f342c65b715c4ced218a52ff5b3fa2086bf21544bd9e53d50ac0f1e`. Delta de ocho únicamente P0-4 (354→346), ningún otro ID pierde checks. Esa categoría emite una assertion numérica por cluster visible; número dinámico no equivale a suites retiradas. Comparación inicial con mismo Chromium sistema **1341/1341**; código final con Chromium Playwright de certificación anterior **1341/1341**. Se conserva la primera muestra1333; no se atribuye la causa sólo al motor a partir de estas muestras. Las tres aperturas de clusters y todos los invariantes fijos/IDs restantes siguen cubiertos; el mutante de icono oculto también sigue detectado. No se retiró assertion ni gate para restaurar el total; inventarios/grupos y código hash publicados. Diferencias de Vitest se explican separadamente por la autoridad de main, no por este contador dinámico.

## Criterios exactos que impiden Ready for Review

1. **G6/J01** obligatorio: 271025>253742 (+17283). El trabajo adicional requiere ampliar alcance de carga con el prototipo/guards enumerados, conservando el presupuesto; no se propone aprobar un ceiling nuevo.
2. **CSS/G4 y migración L4** incompletos: 457 líneas residuales, ocho colores en declaraciones sin equivalencia aprobada, valores legacy y dos consultas max-width globales/overrides por dueño. Paridad estricta de todos los PNG y de Dónde dormir WebKit no se certifica como exacta; datos y límites publicados, sin cambiar diseño para resolverlos por aproximación.
3. **A-01**: recorrido confirmado, patrón de salto y textos requieren decisión de Producto; 312 acciones preservadas, sin implementación no autorizada.
4. **E01–E04**: aprobación/resolución editorial verificable y posterior implementación/validación del conjunto aprobado pendientes. Propuestas literales completas listas, no aprobación implícita.
5. **QA físico requerido**: F01–F11 Safari/iPhone/lector/gestos/zoom/selector real no ejecutados ni firmados; preparar F01–F12 no constituye aprobación.
6. **B25 C-CLEAN / OSM-TLS** no PASS: verificación real en entorno/red con confianza TLS válida pendiente; F12 no ejecutado físicamente. No se presenta la interceptación usada por otras fixtures como prueba de disponibilidad.

Fotografías/licencias de zonas siguen como pendiente externo de adquisición/verificación **separado**, excluido de ejecución automática: no se inventa su aprobación ni un requisito nuevo de alcance B10. OD-01 POST-V1/DIFERIDO se conserva y no constituye un bloqueo nuevo.

Se agotaron los lotes pequeños ejecutables dentro de estas restricciones: las siguientes acciones dependen de ampliar alcance G6, equivalencias/patrón/literales de Producto o ejecución física/externa. Esta continuación aporta trabajo nuevo y regresión propia; **B10 continúa INCOMPLETO** y #177 permanece Draft. RC congelado intacto; sin integrar ni desplegar.
