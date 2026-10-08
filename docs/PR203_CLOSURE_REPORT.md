# Cierre de Nihon (PR #203) — informe único

Rama: `claude/sweet-mendel-v8st6b` (parte de `2fd30db`, el SHA auditado; `main` en `52503a9`). Sin fusión a `main`, sin despliegue, sin tocar Astra, Vercel ni datos reales, y sin PR nuevo. `PR203_FINAL_AUDIT.md` no existe como fichero: el informe vigente tomado como base es el cuerpo de #203/#204 y `docs/PR203_INDEPENDENT_H03_AUDIT.md`.

**Veredicto: APTO CON RIESGOS DOCUMENTADOS** (criterio en §9). Dos defectos del producto demostrados y corregidos; todo lo que sigue rojo es del motor o del arnés, o una incertidumbre nombrada.

## 0. Segunda ronda — los cuatro puntos

### 0.1 La lectura obsoleta que sobrevive al margen de 32 ms: ¿puede sobrescribir mal en Nihon?

**Sí.** Hay que decir primero lo que **no** se conservó: la sonda de la primera ronda guardaba sólo recuentos (y la ejecución que vio el caso aislado no medía la cola), así que **no se conservan los valores ni la duración de ese traspaso**. No se vuelve a buscarlo: se reproduce de forma controlada.

*Reproducción controlada* (`app/scripts/webstorage-stale-overwrite-probe.mjs`, WebKit 26.5, sin código de Nihon; A **no** espera margen alguno y escribe cuando su lectura sigue siendo la anterior, que es lo que ocurre en un traspaso con lectura obsoleta). Runs [37849813720](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37849813720) y [37853218876](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37853218876):

| | Escrituras sobre lectura obsoleta | …que destruyeron el documento de B en el almacén | …en las que A recibió un evento `storage` con el documento de B | …con `event.storageArea === localStorage` |
|---|---|---|---|---|
| Ejecución 1 (300 + 300 traspasos) | 82 | 70 | **82/82** | (no medido) |
| Ejecución 2 (150 + 150 traspasos) | 40 | 36 | **40/40** | **40/40** |

Consecuencias, demostradas:
1. **Sí hay daño real:** en 106 de 122 casos el documento de B quedó destruido en el almacén (en los otros 16 el orden interno del motor dejó a B el último).
2. **La invalidación tardía siempre llega como evento con el documento sobrescrito** (122/122). Es lo único con lo que se puede construir una protección, porque `localStorage` no ofrece compare‑and‑set y ningún margen puede garantizar frescura.
3. **Lo que ya protegía a Nihon, y lo que no:** si B es otra pestaña de Nihon, B ve que su escritura falta en el linaje `_w` y la reaplica (prueba `una lectura obsoleta que dura más de un turno…`). Si lo sobrescrito es un documento **protegido** (inválido o de versión futura), no había nada que lo recuperase: esa es la secuencia que destruía el original *y* dejaba exportar `ok` (exactamente el síntoma `preserved=false` de `72636d3`). El margen de 32 ms la hace rara (1 traspaso de 2.000 con carga en WebKit Linux; 0 de 2.000 sin carga; 0 de 1.000 en macOS WebKit), no imposible.

### 0.2 Protección implementada (no basta con el retraso)

`useStoredDocument.handleForeignValue`, activada por el evento `storage` de la clave: si el `newValue` es **inválido o de versión futura** y ya **no está** en el almacenamiento, (a) lo guarda aparte en `nihon.recovered.<instante>.<clave>` (se relee para comprobarlo), (b) si lo último escrito allí es **lo de esta pestaña**, lo **restituye** tal cual, (c) el cambio de esta pestaña queda en su copia pendiente (el documento vuelve a estar protegido, así que nada escribe encima y «Exportar» se niega), y (d) avisa. Un documento ajeno válido no necesita esto (linaje). Es un cambio de ~45 líneas en el almacén existente: sin arquitectura nueva.

Pruebas (cada una **falla sin la protección**, comprobado neutralizándola):

| Nivel | Prueba | Sin protección | Con protección |
|---|---|---|---|
| Unitaria ×2 | restituye, conserva aparte y deja el cambio en la copia pendiente (JSON inválido y versión futura); no vuelve a escribir encima | rojas | verdes |
| Unitaria | si después escribió otra cosa, no restituye pero conserva la copia | roja | verde |
| Unitaria | sin sobrescritura, o con documento ajeno válido o `null`: no escribe nada | — | verde |
| Navegador ×2 (`stale-overwrite-restores-protected-invalid/future`) | vista obsoleta de 600 ms (más que cualquier margen) e invalidación retenida hasta **después** de la escritura; comprueba que el escenario sí sobrescribe y que luego el original queda restituido, copiado aparte, el cambio en la copia pendiente y la exportación negada | **rojas: original destruido y `exportBackup` devuelve `ok`** | verdes en Chromium local y en **WebKit 26.5 de CI** |

### 0.3 Vista previa HTTPS para el iPhone

**No publicada: dependencia externa concreta.** Dos cosas la impiden, y ninguna se ha esquivado:
- El freeze de Vercel (`docs/DEPLOYMENT_POLICY.md`) prohíbe crear Previews o tocar el proyecto sin autorización expresa que nombre el SHA; no la hay.
- Un túnel efímero desde un runner de CI (lo que no necesitaba a Vercel) fue **denegado por el entorno de esta sesión** («External Ingress Tunnel»); lo respeté y no lo reintenté de otra forma.

**Lo que queda listo y comprobado:** `.github/workflows/iphone-preview-pages.yml` (sólo manual; `npm test` + build con ruta base + `build-info.txt` con el SHA + despliegue en GitHub Pages, origen distinto de producción, sin datos reales) y el guion `docs/IPHONE_SYNTHETIC_CHECK.md` con favoritos, recarga, cierre/reapertura, **dos pestañas**, exportar e importar. El guion se automatizó (`app/scripts/preview-journey-check.mjs`) y pasa **10/10 en Chromium** contra la build con esa ruta base; eso no sustituye al iPhone. **Autorización que falta** (propietario): (1) Settings › Pages › Source = GitHub Actions; (2) entorno `github-pages` con despliegue permitido desde esta rama; (3) autorización expresa para publicar el SHA final (§0.4) en una URL pública de `github.io` (sólo contiene la aplicación y su conjunto de datos público). Alternativa Vercel: un único Preview manual de ese SHA acotando temporalmente el *Ignored Build Step*, como el 2026‑10‑06.

### 0.4 Commits y HEAD final

| Commit | Qué es | Toca código de producto |
|---|---|---|
| `689f4f2` | margen de 32 ms tras un lock esperado + pruebas | **Sí** (`storage-lock.ts`) |
| `7aa4717` | **contiene las supresiones** de evidencia e investigación (334 ficheros); su mensaje sólo menciona la sonda y la guía: el mensaje es incompleto, la historia no se reescribió | No |
| `b53c7c9` | segunda mitad de la separación: enlaces reescritos, `PR203_EVIDENCE_INDEX.md`, recorte de `p06-certification.yml`, sondas sólo manuales | No (CI y docs) |
| `723e1af` | informe de la primera ronda + puntero en el handoff | No (2 docs) |
| `69d91a0` | «recuento final de ficheros» (la cifra en el informe) | No (1 doc) |
| `49284f1`, `1520eea` | sonda de sobrescritura y su `storageArea`; workflow de Pages con las bases de D5 | No (sondas y CI manual) |
| `617ace0` | **protección de §0.2** + pruebas + guion de iPhone + workflow de Pages | **Sí** (`useStoredDocument.ts`, `stored-document.ts`, 2 adaptadores) |
| último commit | este informe y el índice corregido | No |

Corrección de lo afirmado en la primera ronda: la separación **no** es un único commit (son `7aa4717` + `b53c7c9`; `git revert b53c7c9 7aa4717` la deshace), y «el producto no cambia» sólo valía hasta `b53c7c9`.

**HEAD final propuesto: el último commit de la rama** (`git rev-parse origin/claude/sweet-mendel-v8st6b`). **Su código coincide con el probado**: el SHA certificado es `617ace0`, y desde él sólo cambian sondas manuales, workflows manuales y documentación. Comprobación reproducible:

```
git diff --stat 617ace0 HEAD -- app/src app/package.json app/package-lock.json app/index.html app/public app/vite.config.ts app/tsconfig*.json   # vacío
git diff --stat 617ace0 HEAD -- app/scripts ':!app/scripts/webstorage-*' ':!app/scripts/safari-*'                                                   # vacío (los gates de P-06 idénticos)
git diff --stat 617ace0 HEAD -- .github/workflows/p06-certification.yml                                                                             # vacío
```
Resultado (verificado sobre `1520eea` más los cambios de este informe, que sólo tocan documentación): las tres comparaciones salen **vacías**, y el árbol `app/src` es idéntico: `ae7f729ddb1c5af8d0be815b575dd3e29fe2c5fd` en `617ace0` y en el HEAD final.

## 1. Clasificación (vigente)

| Clase | Elemento | Estado |
|---|---|---|
| **A — defecto de Nihon** | A1. `runExclusive` cedía una tarea tras un lock esperado (lectura obsoleta en WebKit: 3,4 % sin carga, 44 % con carga, ≤ 6 ms) | **Corregido** (margen de 32 ms sólo tras contención) |
| A | A2. Una escritura sobre lectura obsoleta destruía un documento protegido ajeno y dejaba exportar `ok` | **Corregido** (§0.2) |
| A (previos) | H01–H07 y atribución del gate de rendimiento | Corregidos en #203; 3.467/3.467 unitarias |
| **B — navegador** | B1. Pérdida de B ante `SIGKILL` temprano del proceso de red (WPE y macOS, **sin Nihon**) | No atribuible a Nihon |
| B | B2. Recargas perdidas de WebKit WPE tras RESET (60 atascos; 2/100 sin Nihon) | Motor |
| B | B3. Safari WebDriver aísla la sesión: no reutiliza perfil | Cierre/reapertura no certificable por esa vía |
| B | B4. La invalidación de `localStorage` entre pestañas puede llegar después del Web Lock | Plataforma; mitigada por A1/A2 |
| **C — arnés** | C1. El clic nativo de Safari WebDriver nunca llega a la página | Diagnóstico cerrado; el arnés usa teclado |
| C | C2. Safari ordinario por Apple Events: 8 s agotados antes de A/B | Permisos/entorno; no se sortean |
| C | C3–C5. Arnés móvil con lock, clasificador H03, identificación del proceso macOS | Corregidos y validados |
| **D — incertidumbre** | D1. H03 con RESET: B perdido en dos perfiles conservados con sustitución espontánea del proceso de red; causa interna no demostrada; los perfiles de los casos 1, 9 y 19 del run `37699345002` se eliminaron y no se les asigna causa | Abierta |
| D | D2. Que A2 causara el fallo concreto de `72636d3`: el artefacto no conservó valores; el mecanismo está demostrado y neutralizado, la causalidad de aquel caso **no** | Abierta |
| D | D3. Fallo móvil histórico del run `37715508535` | No atribuido |
| D | D4. Cierre/reapertura de Safari, dos pestañas y exportar/importar en iPhone real | Manual (§0.3) |
| D | D5. 32 ms es un margen medido, no una garantía; A2 cubre el resto sólo para documentos **protegidos** | Documentado |

Ningún caso histórico se declara resuelto por ejecuciones verdes posteriores.

## 2. Protección de información y respaldo

Medición de frescura sin Nihon (`webstorage-lock-staleness-probe.mjs`, 500 traspasos por carga; «carga» = 4 hilos ocupados):

| Motor / carga | Obsoleto tras 1 tarea (lo que cubría Nihon) | Obsoleto tras los 32 ms | Retraso máx. |
|---|---|---|---|
| WebKit 26.5 Linux, sin carga | 17 · 6 · 7 · 10 · 15 / 500 | 0 / 2.000 | 3 ms |
| WebKit 26.5 Linux, con carga | **221 (44 %)** · 210 · 237 · 193 · 215 / 500 | **1 / 2.000** | 6 ms |
| WebKit 26.5 macOS | 0 · 3 / 500 | 0 / 1.000 | 1 ms |
| Chromium Linux | 0 en la ejecución leída (1.000 traspasos) | — | 0 |

Respaldo, exportación y recuperación: adecuados **si se usan** (JSON validado; la exportación se niega con datos protegidos o escritura pendiente; la importación hace vista previa, copia, sustitución y reversión honesta; los documentos inválidos o futuros no se sobrescriben sin copia, y ahora tampoco por una lectura obsoleta). Huecos de producto, no implementados: **no hay recordatorio ni «último respaldo»**, no se pide `navigator.storage.persist()` y **Safari (ITP) borra el almacenamiento escribible por script tras 7 días sin interacción** salvo en apps de pantalla de inicio ([WebKit](https://webkit.org/tracking-prevention/)): el riesgo de pérdida más realista. Mitigación inmediata sin código: exportar antes de dejar de usarla y añadirla a la pantalla de inicio.

## 3. Safari real

Safari 26.6.1, macOS 15.7.9, `macos-15`, una pulsación por variante en origen nuevo, con página de control sin Nihon (runs completos 37801132736, 37804384206 y 37853218876; este último, sobre el código con la protección; el 37802868237 falló al crear la sesión y el 37849813720 se canceló por tiempo sin que revisara su Safari):

| Variante | Control | Nihon |
|---|---|---|
| Clic de elemento / acciones de puntero | **0 eventos** | **0 eventos**, introducción abierta |
| Teclado (Enter) | eventos fiables (`isTrusted`) | introducción cerrada |
| `element.click()` | evento no fiable | introducción cerrada |

El gesto de puntero nunca llega al documento (sin foco en la ventana de automatización): clase C, no defecto de interfaz. Con teclado, el recorrido completo (introducción → favorito → recarga → quitar → recarga → volver a guardar) pasó **en los tres runs completos, incluido el del código final**. Una sesión nueva de WebDriver ve el almacenamiento vacío: el aislamiento (B3) impide certificar el cierre/reapertura. Un intento de CI falló al crear la sesión de `safaridriver` (runner) y el job se repitió sin cambios.

## 4. Integración

`git diff --shortstat origin/main HEAD`: 404 → **82 ficheros**. Evidencia (5 MB), 4 workflows y 17 scripts de investigación fuera del árbol, íntegros en `2fd30db` y `refs/pull/203/head`; detalle en `docs/PR203_EVIDENCE_INDEX.md`. **Etiquetar `2fd30db` (`evidence/pr203-2fd30db`) antes de cerrar #203.** Como la rama contiene `2fd30db`, `claude/final-audit-data-recovery-fixes-l60xs9` puede avanzar a ella por fast‑forward sin PR nuevo (no lo hice: no tengo permiso para empujar a esa rama).

## 5. Pruebas y resultados (incluidos fallos)

| Prueba | Resultado |
|---|---|
| Vitest, `tsc -b`, `oxlint` en el código final | **3.467/3.467** (122 ficheros, +12 respecto de 3.455); tipos OK; 1 aviso heredado (`PlaceMap`) |
| Pruebas nuevas sin la corrección | 2 + 3 unitarias rojas, 2 de navegador rojas (original destruido y exportación `ok`) |
| Gates Chromium locales con la protección | persistencia **35/35**, pestañas obsoletas 16/16, exportación y recuperación H01–H04, clasificación H03: rc=0 |
| **P-06 en CI sobre `617ace0`** ([37852358275](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37852358275)) | **success, WebKit 26.5 `fail=0` y Chromium**: lista 190, historial 146, recorridos 68, recorte 104, recuperación 69/69, pestañas 16/16, exportación 16/16, persistencia **35/35**, clasificación 8/8; `npm test` y build |
| Recorrido del guion de iPhone (automatizado) | 10/10 Chromium con ruta base de Pages; sin ejecutar en WebKit ni iPhone |
| **Fallos y límites** | Primer intento local de gates: rc=1 por no haber compilado (mi entorno). La sonda de macOS WebKit no terminó la primera vez (rAF en segundo plano; corregida) y su ejecución con la sobrescritura superó el límite del job (cancelada: sin dato de macOS para §0.1, que no lo necesita). Un fallo de `safaridriver` al crear sesión (runner). El workflow de Pages **no se ejecutó** (denegado/sin autorización) |
| No ejecutado | iPhone real; cierre/reapertura de Safari; Apple Events; túnel efímero; Pages; repetir baterías WPE |

## 6. Archivos modificados

- **Producto:** `app/src/lib/storage-lock.ts`, `app/src/useStoredDocument.ts`, `app/src/lib/stored-document.ts`, `app/src/useTravellers.ts`, `app/src/usePlanningDraft.ts`.
- **Pruebas:** `app/src/lib/storage-lock.test.ts`, `app/src/test-web-locks.ts`, `app/src/useStoredDocument.persistence.test.ts`, `app/scripts/final-audit-persistence-regressions-check.mjs`.
- **Sondas manuales:** `app/scripts/webstorage-lock-staleness-probe.mjs`, `webstorage-stale-overwrite-probe.mjs`, `safari-intro-gesture-probe.py`, `preview-journey-check.mjs`; `.github/workflows/closure-targeted-probes.yml`, `iphone-preview-pages.yml`.
- **CI:** `p06-certification.yml` (sin rama ni diagnósticos específicos del PR).
- **Docs:** este informe, `PR203_EVIDENCE_INDEX.md`, `IPHONE_SYNTHETIC_CHECK.md`; enlaces reescritos en `FINAL_AUDIT_FIXES.md`, `FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md`, `PR203_INDEPENDENT_H03_AUDIT.md`, `CURRENT_WORK_HANDOFF.md`.
- **PR:** ninguno nuevo; #203 abierto, #204 sin tocar.

## 7. Riesgos abiertos

1. **Caída del proceso de almacenamiento antes del commit (B1/D1):** una escritura reciente puede perderse (≈ 500 ms en WebKit); sin extrapolación demostrada a Safari/iOS.
2. **ITP de Safari, 7 días:** el riesgo de pérdida más probable; mitigable con exportar/pantalla de inicio o con un recordatorio de producto.
3. **iPhone real sin certificar** (D4): cierre/reapertura, dos pestañas, exportar/importar.
4. **Lectura obsoleta residual:** tras 32 ms queda ~1 de 2.000 traspasos con carga; si lo sobrescrito es un documento **válido** de otra pestaña de Nihon, esa pestaña lo reaplica; si es protegido, se restituye. Un documento válido escrito por algo que **no** sea Nihon no tiene protección equivalente (no hay caso real conocido).
5. Producción (`32787a1`) **no contiene** H01–H07: integrar y desplegar son decisiones suyas.

## 8. Safari/iOS e intervención manual

Safari macOS real: recorrido completo OK con teclado, también con el código final (run 37853218876). iOS: no certificado. **Intervención manual única:** autorizar (§0.3) la vista previa y recorrer `docs/IPHONE_SYNTHETIC_CHECK.md` (10 min, sin PC). Sin esa autorización, el guion alternativo con un ordenador sigue en el mismo documento.

## 9. Recomendación final

**APTO CON RIESGOS DOCUMENTADOS.** (a) Los dos defectos demostrados atribuibles al producto están corregidos con pruebas que fallan sin la corrección y con P‑06 verde en WebKit y Chromium sobre el código final; (b) lo que sigue rojo es del motor o del arnés demostrado sin Nihon, o una incertidumbre nombrada que más ejecuciones no resolverían; (c) la ruta de respaldo y restauración es sólida y ahora también resiste una lectura obsoleta sobre datos protegidos; (d) los huecos restantes (recordatorio, ITP, iPhone) son de producto o de verificación manual, no de integridad. **Condiciones para integrar:** etiquetar `2fd30db`; fast‑forward de la rama de #203 al HEAD final; y, **antes de desplegar**, la comprobación en iPhone. No es NO APTO porque ningún riesgo abierto es un defecto demostrado de Nihon ni empeora con esta integración; no es APTO sin más porque B1/D1, el ITP y el iPhone siguen abiertos.
