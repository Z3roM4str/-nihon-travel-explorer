# Cierre de Nihon (PR #203) — informe único

Rama de trabajo: `claude/sweet-mendel-v8st6b` (parte de `2fd30db`, el SHA auditado; `main` en `52503a9`). Sin fusión a `main`, sin despliegue, sin tocar Astra ni datos reales. `PR203_FINAL_AUDIT.md` no existe como fichero en el repositorio: el informe vigente que se tomó como base es el cuerpo de #203/#204 y `docs/PR203_INDEPENDENT_H03_AUDIT.md`.

## Resumen

**Recomendación: APTO CON RIESGOS DOCUMENTADOS** (criterio al final). Resultado en una frase por fase:

1. **Un defecto del producto, nuevo y demostrado, corregido:** tras recibir un Web Lock que hubo que esperar, WebKit seguía devolviendo `localStorage` obsoleto aun después de la tarea que Nihon cedía (3,4 % de traspasos sin carga, 44 % con carga, siempre ≤ 6 ms). Era un mecanismo plausible de `retry-queued-retained-events-invalid`.
2. **Safari WebDriver: causa encontrada y no es de Nihon.** El clic nativo no entrega ningún evento a la página ni siquiera en una página de control sin Nihon; con teclado la introducción se cierra y el recorrido completo pasa en Safari 26.6.1 real.
3. **Integración:** 404 → 79 ficheros respecto de `main`, sin perder ni alterar evidencia.
4. **Sin iPhone ni reapertura de perfil real**: queda **una** intervención manual (guía de 10 min en `docs/IPHONE_SYNTHETIC_CHECK.md`).

## 1. Clasificación definitiva

| Clase | Elemento | Estado |
|---|---|---|
| **A — defecto de Nihon** | A1. `runExclusive` cedía una tarea tras un lock esperado; no cubre la invalidación tardía de `localStorage` (medida abajo). Efecto: una pestaña con un reintento en cola podía clasificar el documento viejo como válido y escribir sobre lo que acababa de publicar la otra, incluido un documento protegido (inválido/versión futura), y exportar «ok». | **Corregido** (`storage-lock.ts`, margen de 32 ms sólo tras contención) + 8 pruebas, 2 de ellas rojas sin la corrección |
| A (previos) | H01–H07 y atribución del gate de rendimiento | Ya corregidos en #203; 3.463/3.463 unitarias con esta rama |
| **B — limitación del navegador** | B1. Pérdida de B ante `SIGKILL` temprano del proceso de red (12 fallos nativos, 6/6 WPE y 6/6 macOS, **sin Nihon**): `setItem` retorna, SQLite aún conserva A. WHATWG no define durabilidad ante caída del proceso. | No se puede arreglar con garantías de `localStorage` que no existen; **no se atribuye a Nihon** |
| B | B2. Recargas perdidas de WebKit WPE tras RESET (60 atascos; `beforeunload` sale, el servidor nunca recibe la petición; 2/100 sin código de Nihon) | Motor/libsoup |
| B | B3. Safari WebDriver aísla la sesión: no reutiliza un perfil ordinario | Cierre/reapertura no certificable por esa vía |
| B | B4. La visibilidad de una escritura ajena en `localStorage` puede retrasarse unos ms respecto del Web Lock | Plataforma; mitigada por A1 y por el linaje `_w` |
| **C — arnés** | C1. El clic nativo de Safari WebDriver nunca llegó a la página (demostrado en una página de control) | Resuelto el diagnóstico; el arnés usa teclado |
| C | C2. Safari ordinario por Apple Events: tiempos agotados a 8 s antes de A/B; `simctl` también | Permisos/entorno del runner; no se sortean |
| C | C3. Arnés móvil P-06 declaraba asentado un borrador con el escritor reteniendo el lock; C4 clasificador H03 que aceptaba reintentos sin prueba; C5 identificación del proceso en macOS | Corregidos y validados en #203/#204 |
| **D — incertidumbre que puede afectar a usuarios** | D1. H03 con RESET: B perdido en dos perfiles conservados (caso 4 de `d429ba2`, caso 9 de `72636d3`) con sustitución espontánea del proceso de red; sin cierre normal certificado. Causa interna no demostrada; no se extrapola a Safari/iOS. Los perfiles de los casos 1, 9 y 19 del run `37699345002` se eliminaron y **no se les asigna causa** | Abierta |
| D | D2. El fallo concreto de `72636d3` (`retry-queued…`, 32/33): el artefacto no conservó los valores. A1 es un mecanismo medido y suficiente, **no una causa demostrada** de ese fallo | Abierta (la corrección elimina el mecanismo) |
| D | D3. Fallo móvil histórico del run `37715508535` (sin valor ni gesto) | No atribuido |
| D | D4. Cerrar y reabrir Safari en iPhone real | Manual |
| D | D5. Margen de 32 ms: es una medida (máx. 6 ms), no una garantía de la plataforma | Documentado |

No se declara resuelto ningún caso histórico: ningún verde posterior se usa como causalidad.

## 2. Protección de información

**Anomalía `retry-queued-retained-events-invalid`.** Secuencia plausible, ahora demostrada a nivel de plataforma: pestaña B retiene el lock y publica un documento protegido; la pestaña A (reintento en cola) recibe el lock; en WebKit su `localStorage` aún devuelve el valor anterior tras ceder una tarea; Nihon lo clasifica como válido y escribe encima, y `exportBackup` responde `ok`.

Medición sin código de Nihon (`app/scripts/webstorage-lock-staleness-probe.mjs`, 500 traspasos por carga; «carga» = 4 hilos ocupados en el mismo runner). Runs de CI [37801132736](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37801132736) (sin margen), [37802868237](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37802868237) y [37804384206](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37804384206) (con el margen de 32 ms):

| Motor / carga | Obsoleto tras 1 tarea (lo que cubría Nihon) | Obsoleto tras los 32 ms | Retraso máx. observado |
|---|---|---|---|
| WebKit 26.5 Linux, sin carga | 17/500 · 6/500 · 7/500 | 0 · 0 | 3 ms |
| WebKit 26.5 Linux, con carga | **221/500 (44 %)** · 210/500 · 237/500 | **1/500** · 0/500 | 6 ms |
| WebKit 26.5 macOS (puerto Playwright), ambas cargas | 0/500 · 3/500 | 0 · 0 | 1 ms |
| Chromium Linux, ambas cargas | 0/500 | — | 0 |

Hay **un** traspaso con carga (de 1.000 con el margen) que superó los 32 ms; la primera ejecución no medía la cola y en la siguiente no se repitió, así que su duración se desconoce. Es la razón de que el margen sea una mitigación y no una garantía (D5).

Corrección (mínima, sin arquitectura nueva): `runExclusive` intenta primero `ifAvailable`; si hubo titular, espera 32 ms antes de la tarea (5× el máximo medido). La ruta sin contención no cambia. Regresiones: `storage-lock.test.ts` (5), reintento en cola con invalidación tardía para JSON inválido y versión futura (2, **rojas sin la corrección**, verdes con ella) y reaplicación por linaje cuando la lectura obsoleta dura más de un turno (1). Esa última prueba demuestra que entre dos pestañas de Nihon, aunque una sobrescriba, la otra detecta que su escritura falta y la reaplica sin duplicar.

**Suficiencia de respaldo, exportación y recuperación.** Adecuados para no perder planes importantes *si se usan*: el respaldo exportable es un JSON validado; la exportación se **niega** con datos protegidos o escritura pendiente (en lugar de entregar un respaldo vacío); la importación hace vista previa, copia de originales, sustitución y reversión con aviso honesto si la reversión falla; los documentos inválidos o de versión futura nunca se sobrescriben sin copia. Huecos reales (no se implementan, son decisiones de producto, ninguna exige un almacén nuevo):
- **No hay recordatorio ni «último respaldo»**; todo depende de que alguien pulse Exportar.
- **No se pide `navigator.storage.persist()`.**
- **Safari (ITP) borra el almacenamiento escribible por script tras 7 días sin interacción**, salvo para apps añadidas a pantalla de inicio ([WebKit](https://webkit.org/tracking-prevention/)). Para un viaje planificado con semanas de antelación es el riesgo de pérdida más realista de toda la lista. Mitigación recomendada sin código: exportar antes de dejar de usarla y añadir Nihon a la pantalla de inicio; mitigación de producto recomendada: un aviso/recordatorio de respaldo.

## 3. Safari real

Safari 26.6.1 (20624.5.1.18.3), macOS 15.7.9, GitHub Actions (`macos-15`), runs [37801132736](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37801132736) y [37804384206](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37804384206) (resultado idéntico; el segundo, sobre el código final), una pulsación por variante, cada una en un origen nuevo, con una página de control sin Nihon:

| Variante | Control (sin Nihon) | Nihon |
|---|---|---|
| Clic de elemento (WebDriver) | **0 eventos** | **0 eventos**, introducción abierta |
| Acciones de puntero (WebDriver) | **0 eventos** | **0 eventos**, introducción abierta |
| Teclado (Enter en «Saltar») | `keydown`/`click`/`keyup` fiables (`isTrusted`) | introducción cerrada, marca de «vista» escrita |
| `element.click()` por script | evento no fiable | introducción cerrada |

Conclusión: **no es un defecto de interfaz y no es que Nihon ignore el gesto: el gesto de puntero nunca llega al documento** (`document.hasFocus() === false` en toda la sesión; la ventana de automatización no recibe entrada de puntero del runner). Clase C. Con activación por teclado el recorrido completo pasó en Safari real: introducción → favorito (Ghibli, JP-044 en `localStorage`) → recarga (favorito visible, introducción ausente, documento idéntico) → quitar → recarga (sigue quitado) → volver a guardar. Una sesión nueva de WebDriver en el mismo origen ve el almacenamiento vacío: confirma el aislamiento (B3) y por qué **cerrar/reabrir no se puede certificar por esta vía**. No se siguieron simulando pruebas: queda la guía manual `docs/IPHONE_SYNTHETIC_CHECK.md`.

## 4. Integración

`git diff --shortstat main` : 404 → **79 ficheros**. Detalle y destino de cada clase en `docs/PR203_EVIDENCE_INDEX.md`. La evidencia (5 MB), 4 workflows y 17 scripts de investigación se retiran del árbol en **un commit revertible**; siguen íntegros en `2fd30db` y en `refs/pull/203/head`, y los informes enlazan allí. Se retiraron de la integración porque `webstorage-durability` y `h03-conservation-investigation` contienen contratos rojos por diseño y se dispararían en cada PR futuro que toque `app/`. **Recomendación:** etiquetar `2fd30db` (`evidence/pr203-2fd30db`) antes de cerrar #203. No se abrió ningún PR nuevo: la rama contiene a `2fd30db` como ancestro, así que `claude/final-audit-data-recovery-fixes-l60xs9` puede avanzar a esta rama (fast-forward) y #203 pasa a mostrar sólo el código.

## 5. Pruebas ejecutadas y resultados (incluidos fallos)

| Prueba | Resultado |
|---|---|
| Vitest, `tsc -b`, `oxlint` en el árbol final | 3.463/3.463 (122 ficheros); tipos sin errores; un aviso heredado (`PlaceMap`, Fast Refresh) |
| Pruebas nuevas sin la corrección | 2 rojas (reintento en cola, JSON inválido y versión futura), como se esperaba |
| Gates Chromium locales con la corrección | persistencia 33/33, pestañas obsoletas 16/16, exportación y recuperación H01–H04 rc=0 |
| Primer intento local de esos gates | **Falló (rc=1)**: faltaba `npm run build` en mi entorno (`ERR_HTTP_RESPONSE_CODE_FAILURE`) y un directorio de evidencia; no era el producto; repetido tras compilar |
| Sonda de frescura, primera ejecución en CI | Ubuntu WebKit/Chromium OK (tabla arriba); **macOS WebKit no terminó en 17 min** (`waitForFunction` usa rAF, que una página en segundo plano no recibe); cancelada, corregida (sondeo por temporizador, página al frente) y repetida: terminó en 16 min, 0 obsoletos tras el margen |
| Sonda Safari | Completada (tabla §3). **Un intento de CI falló** (`timed out` al crear la sesión de `safaridriver`, antes de ninguna variante: runner, run 37802868237); se repitió el job entero sin cambios y completó. Ninguna aserción se reintentó |
| Validación final sobre el árbol dividido (`b53c7c9`) | `P-06 certificación` ([37802873449](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37802873449), lanzada a mano sobre `b53c7c9`, ya con el árbol dividido): **success en WebKit y Chromium** (incluye `npm test`, build y los gates `final-audit-*`/`h03-reload-classification`). Los commits posteriores sólo tocan una sonda manual y esta documentación; el producto no cambia |
| No ejecutado | iPhone real; cierre/reapertura de Safari; Apple Events (permisos); repetir baterías WPE |

## 6. Archivos y PR

- **PR:** ninguno nuevo. #203 (abierto, sin fusionar) y #204 (incorporado, `dirty`) sin tocar.
- **Producto:** `app/src/lib/storage-lock.ts`.
- **Pruebas:** `app/src/lib/storage-lock.test.ts`, `app/src/test-web-locks.ts`, `app/src/useStoredDocument.persistence.test.ts`.
- **Sondas (sólo manuales):** `app/scripts/webstorage-lock-staleness-probe.mjs`, `app/scripts/safari-intro-gesture-probe.py`, `.github/workflows/closure-targeted-probes.yml`.
- **Docs:** `docs/PR203_CLOSURE_REPORT.md`, `docs/PR203_EVIDENCE_INDEX.md`, `docs/IPHONE_SYNTHETIC_CHECK.md`; enlaces reescritos en `FINAL_AUDIT_FIXES.md`, `FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md`, `PR203_INDEPENDENT_H03_AUDIT.md`, `CURRENT_WORK_HANDOFF.md`.
- **CI:** `p06-certification.yml` (sin rama ni diagnósticos duplicados específicos del PR).
- Commits: `e39b528`, `689f4f2`, `7aa4717`, `b53c7c9` (+ el de este informe).

## 7. Riesgos reales abiertos

1. **Caída del proceso de almacenamiento antes del commit (D1/B1):** una escritura reciente puede perderse; un viajero lo sufriría sólo si el motor muere en la ventana (≈ 500 ms en WebKit). Sin extrapolación demostrada a Safari/iOS.
2. **ITP de Safari, 7 días** (§2): el riesgo de pérdida más probable; mitigable con exportar/pantalla de inicio.
3. **Cierre y reapertura en iPhone real, sin certificar** (D4).
4. **El margen de 32 ms es empírico** (D5) y su efecto sobre `retry-queued…` no está demostrado como causa del fallo histórico (D2).
5. Producción (`32787a1`) **no contiene** las correcciones H01–H07: integrar y desplegar siguen siendo decisiones suyas.

## 8. Resultado de Safari/iOS e intervención manual

Safari macOS real: recorrido completo OK con teclado; clic nativo inutilizable por el arnés. iOS: no certificado. **Única intervención manual:** `docs/IPHONE_SYNTHETIC_CHECK.md` (10 min, origen propio en red local, sin tocar sus datos reales).

## 9. Recomendación final

**APTO CON RIESGOS DOCUMENTADOS.** Criterio: (a) el único defecto demostrado atribuible al producto está corregido con regresión que falla sin la corrección y gates Chromium/unitarias verdes; (b) todo lo rojo restante es una limitación del motor o del arnés **demostrada sin Nihon**, o una incertidumbre explícita que ningún número de ejecuciones resolvería; (c) la ruta de respaldo/restauración es sólida, y los huecos (recordatorio, ITP) son de producto, no de integridad. No es APTO sin más porque D1, D4 y el ITP siguen abiertos; no es NO APTO porque ninguno de ellos es un defecto demostrado de Nihon ni se agrava con esta integración. Condición para integrar: verde de `P-06` y de las sondas sobre el SHA final y la comprobación manual de iPhone antes de desplegar.
