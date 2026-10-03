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

# Merge-readiness — PR #152 · handoff

## ESTADO CANÓNICO ACTUAL (2026-09-28): PR #152 MERGED a `main`

- Merge commit: `8867e41b158b4651e473b390657ad3ff161a63bf` (merge commit real, no squash/rebase).
- Padres: `8eb725eeb836ca121180f8dd8b0dc49c65efae25` (main previo) y
  `e5ddbfa6c1eea82661c6002d4ee9d6e96f17bd57` (head certificado de #152, idéntico al de la
  auditoría de merge-readiness 2026-09-27 referenciada en el resto de este documento).
- `main` nuevo: `8867e41b158b4651e473b390657ad3ff161a63bf`.
- Certificación post-merge repetida desde el nuevo `main`: build/lint/Vitest/pytest y los gates
  de mayor riesgo (integration-b24-b23-check, B23 retry, DD-028, Block 2 Photography) en verde,
  mismos números que el head certificado. Detalle completo en `docs/CURRENT_WORK_HANDOFF.md`.
- El resto de este documento (todo lo de abajo) es **registro histórico** de la misión de
  merge-readiness previa al merge; se conserva sin reescribir.

---

**Fecha:** 2026-09-26 · **Rama:** `claude/integration-b24-b23-b65-b67` · **PR:** #152 (Draft en ese momento; MERGED desde 2026-09-28, ver arriba)
**SHA inicial de esta misión:** `fac2e9ed57c2a55b61653268dbf5619946af7d9c` · **Base:** `main` @ `8eb725eeb836ca121180f8dd8b0dc49c65efae25`
**SHA al abrir DDR-MERGE-1:** `b06c1d46fd63e2cee8c544f896ebf338c04243e0`
**SHA final tras la decisión de dirección (opción 1):** el HEAD de la rama tras el commit que añade
este documento (ver `git log`; los commits se listan abajo).

## Preflight

`origin/<rama>` = `fac2e9e` ✓ · `origin/main` = `8eb725e` ✓ · PR #152 abierto y Draft ✓ · árbol limpio ✓
· `main` ancestro de HEAD ✓ (el clon era superficial; se hizo `fetch --unshallow` para comprobarlo).

## Commits de la misión (sobre `fac2e9e`, sin rebase, squash ni merge)

| SHA | Qué |
|---|---|
| `7933b19` | DDR-MERGE-1 — diagnóstico del presupuesto de fotografía de hub |
| `4e82d05` | Python — B6.4 `BATCH_LIMIT` a nivel de módulo |
| `2cca972` | Python — reconstrucción de baselines históricas consciente de Block 22 |
| `264c626` | DD-028 — nombre accesible de PlaceCard + gate AX + docs normativas |
| `1bcd8df` | `docs/PYTHON_SUITE_STATUS.md` |
| `632fdf7` | Gate de integración: el 503 de B23 lo consumía la portada |
| `b06c1d4` | Handoffs de cierre (previos) |
| `9460187` | **Decisión de dirección aplicada:** DDR-MERGE-1 opción 1 — el gate mide desde que se entra al hub |
| (este) | Handoff actualizado con el cierre de DDR-MERGE-1 |

`OrderedSequenceBuilder.tsx` byte-idéntico a `fac2e9e`. Sin Astra. Ningún bloque nuevo (B7+) iniciado.

## Fotografía — Block 2

| | Antes (`fac2e9e`) | Tras el diagnóstico (`b06c1d4`) | Tras la decisión (opción 1, `9460187`) |
|---|---|---|---|
| Block 2 Photography | 79/81 | 79/81 (gate sin tocar aún) | **81/81** |
| phone / tablet / desktop (ventana del gate) | 4,82 / 5,31 / 5,77 MiB | idéntico | **3,09 / 3,03 / 3,09 MiB** |
| Hub Osaka en sí | — | 3 356 478 B = 3,20 MiB (medido aparte) | mismo número, ahora es lo que el gate reporta |

- **Decisión de dirección: opción 1.** El gate ahora vacía su registro de imágenes justo tras el
  clic que entra al hub, antes del scroll — la constante `< 5 MiB` no cambió de valor. Ninguna
  imagen se reoptimizó (el pipeline ya cumplía) y ningún `check(...)` se relajó.
- **Verificado en los 4 hubs, no sólo Osaka:** Tokio (2,13–2,85 MiB), Kioto (2,93–3,28 MiB), Osaka
  (2,38–3,16 MiB), Okinawa (2,63–2,69 MiB) en los tres viewports — las 12 combinaciones quedan
  por debajo de 5 MiB. **No hay hallazgo nuevo que reportar**; el límite no necesitó revisión.
- Todas las imágenes son derivados `-800w` WebP identity; 0 originales, 0 duplicados, 0 fallos;
  `build-photography-derivatives.py --check` → 244 registros byte-idénticos.
- El exceso que tenía el gate antes de la corrección lo ponía la **portada de Explorar** (B19/B24:
  tarjetas de ciudad + colecciones), que se contaba porque el gate escuchaba desde `page.goto`.
  Ese tráfico sigue existiendo — sólo dejó de atribuirse al presupuesto del hub, que nunca lo generó.
- Hallazgo secundario documentado en la DDR, **sin resolver por decisión explícita**: `PlaceCard
  compact` usa `-800w` aunque `06 §6.1` prescribe `-400w`; el gate congelado B6.5 exige `-800w`.
  Sigue pendiente de una decisión de dirección aparte.

## Python

| | Reportado en el handoff previo | Reejecutado en esta sesión (`b06c1d4`, antes de tocar nada) |
|---|---|---|
| `pytest scripts/` | 618 passed, 0 failed, 0 errors | **557 passed, 67 failed** |

**Discrepancia sin reconciliar.** Al reejecutar la suite completa desde cero en esta sesión, sobre el
mismo HEAD (`b06c1d4`) que el handoff previo declara en 618/0/0, se observan 67 fallos — todos en
`test_phase4m_stop_vs_continue.py` (`DesignOnlyScopeTests`, comprobaciones de determinismo y fixtures
de selector de fases anteriores). Se confirmó con `git stash`/`git stash pop` que el resultado es
**idéntico con y sin el cambio de esta sesión** (67 failed / 557 passed en ambos casos), así que no
lo introdujo el trabajo de DDR-MERGE-1. No se investigó más a fondo porque cae fuera del alcance de
esta decisión de dirección (presupuesto de fotografía del hub); se deja consignado en vez de repetir
sin verificar la cifra 618/0/0 del handoff anterior. Detalle previo: `docs/PYTHON_SUITE_STATUS.md`
(no actualizado en este cierre).

## DD-027 / DDR-MERGE-1

- DD-027: **no creada** (sigue sin aplicar; opción 1 no la requiere).
- DDR-MERGE-1: **CERRADA**. Decisión de dirección: **opción 1** — presupuesto de 5 MiB intacto,
  medición acotada al recorrido del hub. Ver `docs/DDR-MERGE-1_PRESUPUESTO_FOTOGRAFIA_HUB.md` §9.

## DD-028

FIRME (`09`, 2026-09-26; `04 §5` regla 11). `PlaceCard` usa un único `openLabel` con la misma línea
de ubicación que pinta la variante: compacta «{nombre}. {nivel}. {categoría} en {barrio}, {ciudad}.»;
normal sin cambios. Verificado en el árbol de accesibilidad de Chromium (CDP) en búsqueda global
(214 tarjetas), «Cerca de aquí» y lista de hub, móvil y escritorio: 16/16; con el código anterior,
4 fallos.

## Gates (HEAD de la misión, build de producción)

| Gate | Resultado |
|---|---|
| `npm run build` | ✅ |
| `npm run lint` | 0 errores, 1 warning heredado (`PlaceMap.tsx:17` `only-export-components`, idéntico) |
| Vitest | **3384/3384** (105 ficheros; +2 tests DD-028) |
| Block 2 Photography | **81/81** — DDR-MERGE-1 cerrada, opción 1 |
| Phase 5A desktop / mobile | 50/50 · 50/50 |
| B6.5 | 416/416 |
| B23 | 28/28 |
| B17 regression / tap-target / responsive | 18/18 · 16/16 · sin overflow |
| B18 regression / back / a11y / chrome / viaje-lugar / responsive | 40/40 · 15/15 · 23/23 · 6/6 · 38/38 · sin overflow |
| B19 | 30/30 |
| B20 | 73/73 |
| B21 global search mobile / desktop | 33/33 · 33/33 |
| DDR-03 | 43/43 |
| DDR-B24-3 | 9/9 |
| Block 1 | 153/153 |
| integration-b24-b23-check | **58/58** (50/52 en `fac2e9e` en este entorno; corregido en `632fdf7`) |
| DD-028 (nuevo) | 16/16 |
| B24 real-input audit | **1357/1357** (esta sesión, sin `--viewport=all`, que este script no acepta — se usó el barrido por defecto de 8 viewports) |
| integration-b24-b23-check (reejecutado tras el fix) | **58/58** |
| B23 retry (reejecutado tras el fix) | **28/28** |
| Vitest (reejecutado tras el fix) | **3384/3384** |
| lint (reejecutado tras el fix) | 0 errores, mismo warning heredado |
| build (reejecutado tras el fix) | ✅, bundle 390,42 kB gzip |

B24 varía por el mismo motivo que documentó el handoff previo (`P0-4`, marcadores de mapa contados
dinámicamente); ningún cambio de esta sesión toca el mapa. Los gates B17–B20 y DDR-03 no se
reejecutaron en este cierre porque exigen un servidor en `localhost:4181` aparte y no está en el
alcance de la decisión de dirección — sólo se reejecutaron los gates directamente afectados
(Block 2, integración, B23) y la regresión rápida (Vitest, lint, build, B24).

**Bundle (esta sesión):** JS inicial 1 654 636 B raw / 390 420 B gzip (variación menor de entorno
frente a los 386 129 B reportados antes; mismo bundle, sin cambios de código de producción en este
cierre).

## Blockers pendientes

1. ~~**DDR-MERGE-1**~~ — **resuelto**: opción 1 aplicada, Block 2 en 81/81.
2. Validación humana en iPhone real: scroll táctil y teclado de iOS.
3. Discrepancia sin reconciliar en la cifra de Python (ver arriba): 557 passed / 67 failed en esta
   sesión sobre `b06c1d4`, frente a 618/0/0 reportado antes sobre el mismo SHA. Los 67 fallos son
   preexistentes e idénticos con/sin el cambio de esta sesión (`test_phase4m_stop_vs_continue.py`),
   así que no bloquean DDR-MERGE-1, pero no se ha determinado por qué el número reportado difiere.

## Estado de PR #152

Draft, abierto, sin merge, sin squash, sin rebase. `main` sin tocar. Body actualizado con el cierre
de DDR-MERGE-1.
