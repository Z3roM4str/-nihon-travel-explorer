# Estado operativo B10 — continuación autónoma de #177, 2026-10-02

**INCOMPLETO; PR #177 Draft, sin fusionar.** Inicio `23e112f288600d115633963e2edf50676bdd4469`; código nuevo publicado `0518646c0c429ad405371bc40789e8059f880e78`. [Informe operativo y lotes](B10_CONTINUATION_REPORT.md), [evidencia nueva](B10_CONTINUATION_EVIDENCE.json), [propuestas E01–E04 completas](B10_EDITORIAL_PROPOSALS.md) y [matriz física](B10_PHYSICAL_QA_MATRIX.md). Las evidencias históricas mantienen sus SHAs y no certifican los nuevos commits.

G6 **FAIL**: entrada escrita 273259 → **271025 B gzip**, ahorro 2234; ceiling **253742**, exceso **17283**, sin ratchet/excepción ni métrica distinta. CSS: cuatro superficies/globales extraídas por lotes, **App.css 1259 → 457 líneas**; CSS compilado final idéntico al inicial, con limitaciones de PNG y subpíxel WebKit detalladas en el informe. Tokens/hex y responsive legacy pendientes, sin equivalencias inventadas. A-01 confirmado (64/70/28/150 pasos Tab), patrón/textos de salto condicionado a Producto. E01–E04 abiertas, ninguna propuesta aplicada; OD-01 **POST-V1/DIFERIDO**.

Datos canónicos, package/lock, fotografías públicas y persistencia V8 conservados; APIs y funciones verificadas. Build/lint y G1 **119 archivos/3429 PASS**; censo explica también la certificación anterior 116/3501 y replacements de main. Integridad histórica y comprobación adicional git-hash-object **2131/2131**. Regresión final por gate/motor y todos los intentos en el informe/manifiesto; no convertir muestras parciales en PASS global. Matriz física F01–F12 **NO EJECUTADO**: no aprobación de Safari/iPhone/lector/selector físico. OSM/TLS y fotografías/licencias de zonas son dos pendientes externos separados.

Main incorporado permanece `e124591b19f9f241a38091598faf2c1d27b554e4`. Main remoto observado `80464643528a458de05149b01a8b5c2e5b94a77f` (#190, sólo documentos inspeccionados, no incorporados). Respaldo remoto intacto `codex/b10-backup-pre-reconcile-20261001` → `40838062062c8820ea9f7b028675d8add0c96c32`. Publicación exclusivamente en esta rama con actualización no forzada y verificación concurrente previa. Sin merge, rebase, force-push, main/claude/*/#168, Astra, Vercel/deploy ni cambios al RC congelado.

Lo siguiente conserva snapshots anteriores y su autoridad/alcance histórico. El estado operativo es esta continuación; propuestas previas no son aprobación ni permiso para ampliar presupuestos.

---

# B10 — reconciliación autónoma de #177 con main

Estado: **INCOMPLETO; PR Draft, sin fusionar**. Este informe sustituye el estado operativo del informe anterior; no modifica sus mediciones ni las certificaciones L1/L2. Las recomendaciones editoriales no son aprobaciones.

## Referencias, procedencia y publicación

Inicio remoto comprobado: `40838062062c8820ea9f7b028675d8add0c96c32`, exactamente el esperado. Main real incorporado: `a8350d4bebde74afbfa670ae2df97731fc3d255d`, no el histórico `5498756b`. Se compararon los 63 commits y 174 rutas de main desde `b854db3`, incluidas #178–#188; 17 rutas compartidas con los 242 aportes de #177. No se importó una rama externa directamente. Main avanzó posteriormente a `e124591b19f9f241a38091598faf2c1d27b554e4` (#189): tres rutas, sólo runner/prueba/documentación. Se evaluó e incorporó mediante segundo merge normal; total desde base: 65 commits / 177 rutas. Se congela esa base para este cierre.

Respaldo remoto: `codex/b10-backup-pre-reconcile-20261001` → `4083806`. Checkout limpio inicial y worktrees separados de main y v1.1.0; referencias locales de checkpoints conservadas. Se preservó el primer merge abortado con sus 12 conflictos y patch, antes de continuar tareas independientes y resolver con evidencia normativa.

Publicación no destructiva: git HTTPS permitió clone/fetch pero `git push` no dispuso de credenciales de escritura. Se publicaron objetos Git mediante el conector GitHub y se avanzó únicamente la referencia autorizada con `force:false`, verificando el remoto antes de cada actualización. Los trees publicados se comprobaron iguales a los locales. Diferencias de SHA por metadatos de transporte están registradas; se conservan ambos historiales locales. El merge publicado tiene dos padres, checkpoint B10 y main; no hubo rebase, squash ni force-push. Un árbol diagnóstico inicialmente conservó cuatro runners movidos como duplicados: se detectó antes de actualizar cualquier referencia, se corrigieron las eliminaciones y se verificó el tree exacto.

| Lote | Commit publicado | Resultado |
|---|---|---|
| CSS alertas | `9a4c02a87f43448ae5bcec9e90bcd38006146b07` | Primitive `.alert` extraída, 26 líneas; mismos tokens/orden/especificidad. Paridad exacta de estilos, cajas y píxeles en diez estados por motor antes/después. |
| Walking runtime | `32a6e195eb29f5e71e84652ac2e1a1e14ce77d24` | Retira del payload campos de consulta no consumidos; conserva JSON canónicos, fuentes/atribución y resultados públicos. 46.225 pares, 325 enlaces static y métricas, mutante negativo detectado. |
| Merge main vigente | `b24807b1f3f9dd27d49d25720391d86fce1d3d82` | Dos padres; resolución individual de conflictos y semántica. |
| Runners cloud | `e0c9c7985899340444c5a8ee1a0bc4d32ceab572` | Paths explícitos por motor, sin aumentar timeouts/assertions. |
| Selección de motor | `b11bccfd1f565e451e7bdea27a009e4aac29889b` | Corrige Chromium lanzando MiniBrowser de WebKit. |
| Microcopy WebKit | `9b9b735049ded19b1bab52627b55843133d7a3c9` | Path WebKit opcional en el runner, sin cambiar copy. |

Checkpoint histórico previo al diagnóstico definitivo de scroll: `372fe99937165189bfd8118962b47b26c621d81f`. Lote adicional `372fe999`: B24 exige muestreo de icono real de Días, espera el montaje y envía rueda al padding del contenedor desplazable; mantiene contraste/44 px y detecta el mutante de iconos ocultos.

## Matriz y resolución de conflictos

La matriz JSON incluida en la evidencia clasifica **cada una de las 242 rutas iniciales**, incluida documentación/evidencia; no se limita a archivos con conflicto textual.

| Superficie | Clasificación y tratamiento |
|---|---|
| Copy/contadores L1 | Exclusivo válido: filtro `N lugares`, plural y anuncio; altura estable. Backup `Lugares en el viaje` equivalente de main, una sola implementación. Resultados/filtrado conservados. |
| L2 traslado principal | Equivalente: cuatro literales canónicos. Main retiró builder/comparación/local swap inalcanzables con auditoría propia; se conserva esa procedencia, no se restablecen UI retiradas. E01–E04 quedan pendientes en el contexto actual. |
| Movimiento | Complementario para mark/sheet/press/skeleton y reduced motion JS/CSS; **incompatible** aceptar seis excepciones funcionales adicionales sólo por un inventario descriptivo. `03 §6` permite cinco movimientos y exige revisión para otro; `08` tiene precedencia. B10 conserva estados instantáneos y un único sheet-rise en su dueño. Gate amplio más mutante de transición no permitida; runner de superficies original conservado. |
| Targets/foco/teclado | Complementarios: primary 48, secundarios 44, enlaces con cajas reales, chips de mapa y fuentes. Zoom Leaflet: geometría/pseudo-target de main equivalente, sin duplicar dos expansiones. No se retiran controles del Tab. |
| Mapa/scroll | Exclusivo válido: apertura desde scroll controla/restaura el contenedor propietario y devuelve foco al disparador; atribución fuera del área de navegación. Combina el shell y h1/main vigentes de main. |
| Galería/fuentes | Guardia reduced-motion equivalente de main; target y foco B10 en CSS dueño. Créditos/fuentes/literales y todos los slides preservados; API de fotografías completa comprobada, 202 lugares y 244 imágenes. |
| CSS/cascada | Complementarios: extracciones de main conservadas; estilos globales primero y dueños después. Alertas independiente. Target de `.zone-source__link` situado en su dueño, conservando underline y el test estático. App.css restante no se borra por limpieza. |
| Carga diferida/prefetch | Prefetch y los dos chunks de viaje de main conservados; gate mide HTML servido + solicitudes después de FCP. Proyección fotográfica de main sustituye plugin B10 equivalente, no dos proyecciones; walking complementaria. No se cambia resolución síncrona de catálogo/cálculo. |
| Pruebas/runners | Mantenimiento histórico integrado desde main, con trazabilidad GATE_RETIREMENT_AUDIT; adapters cloud mínimos. G6 ratchet 285.000 es incompatible con cierre contractual: ceiling 253.742. No se debilitan assertions para volver verde. |
| Documentos/aceptación | Históricos L1/L2/informe y manifiestos intactos. Estado operativo actualizado en misión, auditoría, handoffs, ambos roadmaps y registro de autoridad; certificaciones separadas no certifican esta combinación. |
| Editorial/colecciones/OD-01 | E01–E04 pendientes de decisión explícita; sin cambios a orden/héroe/recorrido de colecciones. Estado POST-V1 de OD-01 importado de main conserva la decisión expresa de Producto documentada en `09`; no se atribuye a las recomendaciones previas ni se implementa tema. |

El primer fallo unitario tras merge fue una inspección estática de `.zone-source__link`: encontraba antes un selector global nuevo que la regla del dueño. Se trasladó la caja táctil al dueño, manteniendo la protección y el underline; segunda suite completa PASS. No se eligió ours/theirs globalmente.

## Verificación nueva y límites

| Comprobación final tras foco | Exit | Resultado |
|---|---:|---|
| `lint` | 0 | PASS |
| `vitest` | 0 | PASS |
| `bundle` | 0 | PASS |
| `b26-nosotros-check-chromium` | 0 | PASS |
| `b26-nosotros-check-webkit` | 0 | PASS |
| `b30-where-to-sleep-check-chromium` | 0 | PASS |
| `b30-where-to-sleep-check-webkit` | 0 | PASS |
| `b31-reservas-resumen-check-chromium` | 0 | PASS |
| `b31-reservas-resumen-check-webkit` | 0 | PASS |
| `b10-a11y-check-chromium` | 0 | PASS |
| `b10-a11y-check-webkit` | 0 | PASS |
| `b10-performance-check-chromium` | 1 | FAIL G6 (resto PASS) |
| `b10-performance-check-webkit` | 1 | FAIL G6 (resto PASS) |
| `block1-ux-browser-audit` | 0 | PASS |
| `block13-portable-backup-browser-audit` | 0 | PASS |
| `block14-release-readiness-browser-audit` | 0 | PASS |
| `b18-browser-back-check` | 0 | PASS |
| `b18-regression-check` | 0 | PASS |
| `b24-real-input-audit` · ocho viewports | 0 | PASS 1341/1341 |

Regresión post-scroll previa al último cambio de TravellerManager: build/lint, 119 archivos/3428 tests; invariantes 9 archivos/231 tests; API photo/walking y L1; motion, a11y, gallery, national-map y L2 en ambos motores; B27 ocho viewports, B29 163 y B28 64, B18 back/regression, B24 ocho viewports y Phase5A 50/50 por viewport. Todo PASS salvo G6, el foco B26 luego corregido y B25 C-CLEAN (121/123, TLS OSM). Tras #189: typecheck y 119/3429 tests, B21 móvil/escritorio en ambos motores PASS; mutante de restauración FAIL. Estos resultados pertenecen a las etapas indicadas; el cambio final sólo afecta foco de TravellerManager, cuyas suites afectadas se repiten arriba, junto a T-01, a11y y rendimiento. No se certifica la combinación usando resultados separados de main/B10.

Fallos conservados y clasificación: G6 regresión acumulada no aprobada (FAIL real); I-RESET-CANCEL defecto reproducible de foco corregido con guard; gate lazy de imágenes almacenadas incompatibilidad de medición corregida con mutante eager real; B24 iconos deferred/cobertura negativa incompleta corregida con muestreo y guard específico; selector de fuente CSS corregido por dueño; rutas/launcher/missing-runner fallos de runner/entorno corregidos; B25 TLS `ERR_CERT_AUTHORITY_INVALID` de OSM en muestras comparables de main y combinación (121/123): bloqueo de entorno/external, no prueba de caída de OSM ni atribución automática a herencia. Los demás intentos e intermitencias constan en logs; no se ocultan ni se cambian timeouts.


Producción y pruebas en cloud Debian 13, Node 24.19.0/npm 11.9.0, lock por `npm ci`, Vite 8.2.2, Playwright 1.62.1. Chromium Playwright 1234 (151.0.7922.34), Chromium sistema 151.0.7922.173 en paridad CSS, WebKit 2336/26.5. WebKit usa librerías oficiales Debian aisladas en /tmp y wrapper local; no nuevas dependencias del proyecto. Todos los comandos/configuración, resultados y reintentos conservados en evidencia nueva. Un primer gate de movimiento coincidió con un rebuild del analizador: no se utiliza solo como certificación; la batería posterior se ejecutó serialmente con dist estable.

No se afirma Safari/iPhone físico, lector de pantalla, selector de archivos físico ni zoom/teclado del dispositivo real a partir de emulación. Los gates que interceptan red para aislar recursos locales conservan esa configuración explícita; no prueban disponibilidad de OSM.

Los 369 registros de integridad históricos (L1 41, L2 61, autonomous 267 incluyendo miembros de tar) se verificaron: cero discrepancias. Los manifiestos/certificaciones anteriores no se reetiquetan con el nuevo SHA. `data/`, fotografías públicas, JSON canónicos, modelo V8 y formato backup siguen byte a byte iguales a 4083806; en `app/src/data` sólo se añade la proyección runtime integrada de main y su uso/test. Flujos de persistencia y consulta sin escritura están cubiertos por invariantes/gates nuevos.

## G6 — comparación equivalente y presupuesto sin excepción

Norma exacta `08`: imágenes por ciudad ≤3.500.000 bytes **y** sin regresión del chunk de entrada frente a v1.1.0. No se aumenta presupuesto, excluyen recursos ni cambia la métrica para obtener PASS.

Referencia histórica real: tag v1.1.0 `d72e19921b4aa9c9f68d0d07f8b35f37f158a286` (misma tree que la referencia previa 8a645c). Mismo Node, lock, analizador `node scripts/bundle-report.mjs --json`, gzip nivel 9 y Brotli por defecto.

| Código | Entrada raw | gzip analizador | Brotli analizador |
|---|---:|---:|---:|
| v1.1.0 | 1.389.652 | 253.742 | 203.791 |
| #177 inicial 4083806 | 1.470.769 | 277.958 | 222.590 |
| main a8350d4 | 1.468.811 | 277.526 | 222.167 |
| Walking independiente | 1.415.780 | 273.442 | 219.326 |
| Combinación anterior al foco | 1.414.265 | 273.153 | 218.952 |
| Combinación final, foco corregido | 1.414.304 | 273.163 | 218.999 |

Walking ahorra 4.516 bytes gzip respecto al inicio y no cambia las APIs. La combinación reduce 4.363 bytes respecto a main, pero sigue **+19.421 bytes** frente a referencia con ese analizador. No se sustituyen estos tamaños por transfer cold/warm ni suma de chunks diferidos.

Se midió también el archivo realmente escrito en dist con gzip nivel 9: v1.1.0 **253.725**, main **277.614**, combinación final **273.259**. El analizador observa `generateBundle`; no es idéntico al archivo final después de plugins. El gate de dist mantiene ceiling contractual **253.742**, por tanto falla **+19.517 bytes**; comparación de archivos finales equivalente: **+19.534**. Esta diferencia de etapa queda visible y no se usa para elegir una cifra aprobada. `focus-written-asset.json` registra la entrada final `index-BnwsS3X1.js` (raw 1.414.556, Brotli 219.107); `scroll-written-asset-2.json` conserva la medición anterior al foco; `written-assets.json` conserva la etapa anterior y raw/Brotli/nombres; builds y hashes de herramientas/config/lock en `measurement-inputs.json`.

Causas identificadas por módulos del analizador: catálogo places 407.066 bytes renderizados, walking scale 220.554/pilot 18.133, photography metadata runtime 143.107, nearby 105.154; ReactDOM 453.153 y Leaflet 242.212 bytes renderizados. Estas cantidades de módulos no son gzip aditivo ni atribución exacta del delta histórico. Registro fotográfico ya proyectado por main; walking ya conserva sólo campos funcionales y atribución. No se elimina información pública, fuentes ni enlaces validados para lograr el presupuesto.

Presupuesto físico identity 800w por las siete ciudades sin cambios: Tokio 3.499.770, Kioto 3.499.450, Osaka 3.356.478, Okinawa 2.903.352, Sapporo 166.986, Nagoya 69.552 y Fukuoka 69.284 B. El gate corregido distingue imágenes reutilizadas de la portada de descargas nuevas a distancia: JP-007 estaba ya solicitada antes de abrir Tokio, a y=2539 frente al umbral 2532. Se reprodujo en main y combinación tres veces cada uno; mantenerla en cache no incumple carga diferida. Los bytes/cuentas raw se conservan y el mutante eager real añade una descarga nueva y falla. El gate de main recorre cuatro ciudades de ≥10 lugares; no se presenta como cobertura de las siete. Registra bytes de red después de portada y carga de galería/lista; esos números no reemplazan el inventario identity completo. El análisis de carga anticipada se detalla en los resultados nuevos.

Alternativas restantes, sin implementar por expansión de alcance: (a) separar la carga compartida Leaflet/PlaceMap/NationalMap: toca dos árboles de navegación, límites Suspense, estado de carga y cascada; 1–2 jornadas estimadas más regresión de mapa/frío/foco/scroll, riesgo medio, ahorro por medir (no garantía desde tamaño renderizado); (b) compactar catálogos con adaptador: 2–4 jornadas estimadas y cobertura exhaustiva de API/fuentes, riesgo mayor sobre resolución síncrona y formato interno; (c) excepción/presupuesto nuevo: expresamente **no autorizado**, no se solicita como salida para hacer PASS. Ninguna de las dos primeras es una nueva dependencia ni se introduce parcialmente. El resultado autorizado acotado está publicado y G6 permanece incumplido.

## T-01 y gates históricos

T-01 exige conservar invariantes de los cinco gates históricos: block1 UX, block13 backup, block14 release, b18 regression y B24 real-input. Es ejecutable en cloud sobre la build; no exige fingir pruebas físicas. En 4083806 fallaban por rutas/selectores retirados (selection-panel/count, Kioto portada, navegación bajo Sheet, selection-list y icon-button pequeño). Main integra su mantenimiento con inventario de invariantes; se evaluó como trabajo ya integrado, no se copió de claude/Astra. Logs de base y combinación quedan separados. Los resultados finales, incluidos fallos de entorno, están en la tabla de ejecución.

No se atribuye un fallo a herencia por una repetición verde: B21/scroll incluye diagnóstico y mantenimiento ya integrado por #189. Las muestras históricas de su documento pertenecen a main; los éxitos propios nuevos sólo demuestran las ejecuciones del cierre, con mutante de restauración roto. Los fallos de red/entorno se identifican por logs y comparación bajo igual motor. B24 inicialmente daba una rama de Días por diferida desde CSS común. Se exigió muestreo efectivo y se investigó el scroll: analysis-body tenía overflow auto y overscroll contain pese a no tener recorrido propio, bloqueando la rueda sobre el contenido. Cambiar origen a padding evitaba el defecto; el diagnóstico posterior lo identificó como defecto de producto presente en main/combinación. El CSS se acotó a overscroll-behavior-y:auto del modo embedded, sin alterar overflow/sticky. La variante que retiraba overflow falló paridad por desplazar Sin día y se descartó con sus capturas/logs conservados. B24 final vuelve a usar el centro del contenido y exige iconos. El mutante de icono oculto falla. El mutante de contención dentro de B24 pasó porque no garantizaba necesitar scroll: ese intento se conserva como cobertura insuficiente. El guard dedicado `b10-embedded-scroll-check.mjs` usa el dueño visible y rueda real: PASS Chromium/WebKit, mutante CSS estático previo al montaje FAIL (0 de desplazamiento). El primer guard dinámico tampoco reprodujo la contención: se conserva y no se presenta como protección efectiva.

Un nombre incorrecto de B28 en el orquestador quedó registrado como missing-runner y se ejecutó después el runner correcto aislado; no es regresión del producto. La suite nueva 119/3429 final (+1 test de #189) refleja retiradas de tests inalcanzables provenientes de main y nuevos tests normativos/L1, no la desaparición inadvertida de pruebas para llegar a verde.


## Cierre técnico adicional: scroll y foco de viajeros

El CSS final cambia únicamente `overscroll-behavior-y` en `.analysis-dialog--embedded .analysis-body`. Mantiene overflow y sticky; paridad exacta de píxeles/cajas/resto de estilos en Chromium/WebKit, 320/390/1440 (seis comparaciones, tres viewports por motor; sólo la propiedad y aliases difieren). Antes: rueda sobre contenido 0→0; después: 0→160 en Chromium y desplazamiento efectivo en WebKit. Persistencia/V8 intactos. No se presenta la variante rechazada sin overflow como solución final.

B26 WebKit falló I-RESET-CANCEL en la combinación (313/314), con otras repeticiones verdes. Las comparaciones parciales y dos muestras de main verdes no autorizan llamarlo heredado. La traza capturó datos intactos y foco en BODY inmediatamente y después de dos frames, sin evento focusin a Reset. Se corrigió TravellerManager: solicitar destino antes de cambiar estado/contexto, restaurarlo en layout effect tras el commit y consumirlo sólo cuando el elemento existe. Sin cambios de copy/datos/acciones/recorrido ni timeout/assertion del gate. Diez trazas posteriores pasan; una coincidió con rebuild idéntico del analizador y no se usa sola como prueba. Guard final sobre dist estable: 20 repeticiones por motor PASS, devolución de foco bloqueada deliberadamente FAIL en el primer intento. B26 completo final 314/314 en ambos motores.

Código final publicado: `5c69a6e72060805992b85a96543835820ac56652`, tree `5e958067575c123cc8363a598aedff7e543b7d6b` (local `5f331cae8c7965a1f5eac8f8c5e9949c30537fe2`). Segundo merge de main: `b562a865627779e2af410e69cff3d60e6b6eb5ae`. Lotes adicionales completos y pares local/remoto en el manifiesto/publication.json: corrección lazy cache, B24 centro, CSS scroll, guard de scroll y foco. Implementación y documentación/evidencia se publican en commits separados.

Main posterior observado: `80464643528a458de05149b01a8b5c2e5b94a77f`, #190, dos commits / tres archivos sólo documentales (CURRENT_WORK_HANDOFF, GATE_AUTHORITY y RELEASE_CERTIFICATION). Se inspeccionó el diff y la certificación de e124591; no se incorpora a esta base congelada ni se considera certificación de #177. Sus fuentes se preservan en evidencia. No hay un cambio de producto adicional pendiente de evaluar en esa observación.

| Commit local | Commit publicado | Lote |
|---|---|---|
| `39e919b` | `9a4c02a87f43448ae5bcec9e90bcd38006146b07` | refactor(b10): extract shared alert primitives with visual parity |
| `9574372` | `32a6e195eb29f5e71e84652ac2e1a1e14ce77d24` | perf(b10): project unused walking query fields with API parity |
| `e1a4fea` | `b24807b1f3f9dd27d49d25720391d86fce1d3d82` | merge(main): reconcile B10 with current main and normative motion gates |
| `51a0d75` | `e0c9c7985899340444c5a8ee1a0bc4d32ceab572` | test(b10): make reconciled browser runners portable in cloud |
| `11228d8` | `b11bccfd1f565e451e7bdea27a009e4aac29889b` | fix(b10-test): select executable for the requested browser engine |
| `2a0b7b9` | `9b9b735049ded19b1bab52627b55843133d7a3c9` | test(b10): allow explicit cloud WebKit executable in copy gate |
| `3ece9f2` | `372fe99937165189bfd8118962b47b26c621d81f` | test(b24): require real day icon sampling from its scroll container |
| `f0d3ed5` | `e3b6d2424d1b7de9a994260d75c8b40152d61d32` | test(b10): distinguish cached home images from new eager hub loads |
| `e3d2856` | `cc4216964c7b174ff9432631de5d33b69af77d9e` | fix(b10): allow embedded journey content to scroll its destination owner |
| `ca55862` | `ce0cb951e5dfebc5b6e09313fbc7cb6881e2d177` | test(b24): detect scroll containment on journey content |
| `832b590` | `e943864c9cb1503e748ecb3440376128a83c9e5e` | fix(b10): preserve sticky layout while releasing vertical scroll chaining |
| `1384ce75ee8698c13cb62511201f0488b4267a76` | `b562a865627779e2af410e69cff3d60e6b6eb5ae` | Merge commit 'e124591b19f9f241a38091598faf2c1d27b554e4' into codex/b10-pulido-mission |
| `57057d2613715fee147aa6ea0f7a01e1af74bfb9` | `64e2bba933799dd4723312494045a9f236ebb731` | test(b10): guard real wheel chaining and persistence in embedded Days |
| `45d2c6834c2f5a622b578fc09c219860dd2f2dc4` | `5798a1285b181312e54ae6a084fa020bf823b1f5` | test(b10): measure the visible scroll owner and mutate CSS before mount |
| `5f331cae8c7965a1f5eac8f8c5e9949c30537fe2` | `5c69a6e72060805992b85a96543835820ac56652` | fix(b10): restore traveller focus during DOM commit |

## Decisiones editoriales: literales y alternativas sin aprobación

| ID / pantalla y estado | Texto actual de la combinación | Propuesta literal y alternativa | Recomendación / conservar |
|---|---|---|---|
| E01 · Días, totales locales completos/parciales, 0/1/N | «traslados totales» o «traslados conocidos» · «N/M traslado(s) registrado(s)» y «N traslado(s) sin registrar». Antes B10 decía «tramos cubiertos»; main cambió el contexto. | A: «traslados conocidos · N de M conexiones con tiempo registrado», conservando contador separado «N conexiones sin tiempo registrado», con singular equivalente. B: «tiempo de traslados conocido · faltan N conexiones», conservando N/M en otra línea. Completo: «traslados totales · N conexiones con tiempo registrado». | A: conserva ratio/completitud y evita inventar extremos X/Y que la API no recibe. Mantener deja terminología registrada/traslado en vez de conexiones; no implica aprobación ni error en cálculo. No sumar traslado principal manual como puerta a puerta. |
| E02 · Nosotros, cambio de persona/plan compartido | «Sólo cambia de quién es cada «Quiero ir». Los lugares planificados, los días, las fechas y el alojamiento son del viaje y los compartís los dos.» | A: «Sólo cambia de quién es cada «Quiero ir». El plan del viaje, los días, las fechas y el alojamiento son compartidos por los dos.» B: «Cada persona tiene su «Quiero ir». El plan, los días, las fechas y el alojamiento son del viaje y los compartís los dos.» | A: mantiene causa del cambio y cuatro ámbitos compartidos. Conservar mantiene el copy integrado de main, más largo; no cambia preferencia personal ni implica sincronización remota. |
| E03 · Días/herramientas, invalid-day-partition; registro conservado inactivo | «El reparto por días no es estructuralmente válido; el traslado no se aplica.» | A: «El reparto por días no es válido; este traslado no se aplica.» B: «Este traslado queda inactivo porque el reparto por días no es válido.» | B: explica estado/causa sin prometer reparación automática. Conservar mantiene tecnicismo «estructuralmente» y estado implícito, sin cambiar exclusión de minutos. |
| E04 · traslado principal, alta/ausencia/hub mismatch/same current hub; incluye Okinawa | «Los hubs vienen de los lugares elegidos; tú seleccionas el modo y escribes los minutos.» / «Selecciona dos puntos consecutivos de hubs distintos» / «No hay una pareja consecutiva nueva entre hubs distintos en el reparto actual.» / «El hub actual de uno de los puntos ya no coincide con el registrado.» / «Los dos puntos pertenecen actualmente al mismo hub.» | A: sustituir conjunto por «destinos» (destino, destinos). B: «Las ciudades o regiones corresponden a los lugares elegidos; tú seleccionas el modo y escribes los minutos.»; «Selecciona dos puntos consecutivos de ciudades o regiones distintas»; «No hay una pareja consecutiva nueva entre ciudades o regiones distintas en el reparto actual.»; «La ciudad o región actual de uno de los puntos ya no coincide con la registrada.»; «Los dos puntos pertenecen actualmente a la misma ciudad o región.» | B: hub incluye región, no es siempre ciudad; «destino» también significa navegación. Conservar deja jerga de catálogo visible; identidades/nombres de hub y clasificación permanecen iguales en cualquier alternativa. |
| OD-01 · tema global y todos sus estados | No existe control de tema/dark mode. `09` de main marca «POST-V1 / DIFERIDO» y atribuye decisión a Producto; se conserva ese registro de procedencia. | A: «OD-01: diferido expresamente a una fase posterior a v1. No se incorpora modo oscuro en B10 ni un control de tema.» B: aprobar implementación posterior con paleta/estados/contraste definidos. | Recomendar conservar A: `09` ya registra decisión expresa de Producto; esta misión conserva su procedencia y no la crea desde recomendaciones anteriores. Conservar deja tema actual y ninguna capacidad dark, sin bloquear trabajos técnicos independientes. |

Ninguna de estas propuestas se implementa por inferencia. Las equivalencias canónicas inequívocas ya documentadas de L1/L2 siguen vigentes; los cambios editoriales que llegaron con main conservan su procedencia y no se atribuyen a una aprobación de estas propuestas.

## Pendientes y siguiente paso exacto

Técnicos: G6 entrada por encima del histórico; incidencias de gates clasificadas en resultados; App.css restante (1.259 líneas, 10 referencias hex incluyendo comentarios, 6 max-width, cero text-shadow): alias/reset, botones globales, shell, tags/badges y responsive. Extraer botones requiere preservar su posición frente a reglas reduced-motion posteriores; retirar App.css entero requiere reorganizar imports/globales y varios lotes. Propuesta por dueño en `css-remaining-proposal.json`; las equivalencias de color sin aprobación no se inventan, sin limpieza masiva; A-01 necesita patrón de salto aprobado conservando los 64/70/28/150 controles de colecciones. No se rediseñan orden/héroe ni se quitan controles del teclado.

Físicos: Safari/iPhone real, lector de pantalla, zoom/reflow del dispositivo y selector físico de backup, con matriz de las superficies tocadas. Externos: OSM/TLS y fotografías/licencias de zonas; sin adquisición ni cambio de proveedor/acceso automático. Editoriales: E01–E04 y OD-01 diferida según decisión expresa registrada en main, sin tema/control nuevo, alternativas arriba.

Ready for Review queda impedido concretamente por G6 obligatorio incumplido, verificación física pendiente y criterios globales/documentales sin cerrar; no se denomina B10 completo desde gates parciales o certificados anteriores. La reconciliación y optimizaciones acotadas publicadas sí son revisables.

Próximo paso: partir del HEAD publicado de #177 y la evidencia nueva; resolver primero la discrepancia G6 con una propuesta explícita de carga/medición que conserve el presupuesto, ejecutar los gates pendientes en el entorno indicado y agendar la matriz física. Aplicar después únicamente los literales editoriales que Producto apruebe. No hace falta trasladar el informe anterior: este archivo, la matriz y el manifiesto contienen las referencias, comandos, intentos y causas para continuar. Main, #168, claude/* y Astra no recibieron escrituras; sin deploy.


## Incidencias de preservación de intentos

Se conservaron los logs de los errores de cwd/fixtures iniciales y los fallos de runners/entorno. En el diagnóstico pequeño de scroll, una segunda ejecución reutilizó el nombre de JSON: el TXT raw de la primera se conserva íntegro y el JSON posterior se renombró como after; el manifiesto no presenta el JSON sobrescrito como evidencia anterior. Los manifiestos/artefactos históricos L1/L2/autonomous permanecen byte a byte intactos. Las variantes de CSS que fallaron paridad tienen carpetas/versiones separadas; la variante final sólo cambia propagación vertical, conserva overflow y pasa píxeles/cajas/resto de estilos (salvo esa propiedad y aliases) en seis comparaciones: tres viewports por motor (320/390/1440).

## Consultar y reproducir la evidencia

El manifiesto nuevo lista SHA256/tamaños y miembros de `docs/evidence/b10/reconciliation-20261001/core.tar.gz` y 22 archivos visuales. Extraer cada tar en un directorio nuevo y comprobar sus entradas contra el manifiesto; no mezclarlo con los artefactos anteriores. Core contiene la matriz de 242 aportes, historiales remoto/local, comparación main, inputs de medición, comandos Python/Node, resultados por etapa e intentos fallidos. Los scripts diagnósticos cloud que antes eran untracked están conservados bajo `cloud-diagnostics/app-scripts`; los guards permanentes están en `app/scripts`.

T-01 final: block1 **153**, block13 **150**, block14 **229**, b18 regression **40**, B24 **1341** comprobaciones PASS; B18 browser-back adicional **15**. Build/lint y 119/3429 tests PASS. `focus-final-results.json` y `focus-final-b24-results.json` enlazan sus logs/comandos; `scroll-final-results.json` conserva la regresión amplia del producto reconciliado anterior al último cambio de foco. B21 nuevo: cuatro combinaciones motor/viewport PASS, con restauración rota detectada por el guard. Ninguna batería física se declara realizada.
