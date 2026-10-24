# PR #203 — dónde está la evidencia retirada del árbol

El PR #203 reunía código de producto, pruebas permanentes, herramientas de investigación y ~5 MB de evidencia (404 ficheros). Para que lo que se integra sea sólo lo que ejecuta la aplicación y la CI, **la evidencia y las herramientas de investigación se retiraron del árbol en dos commits consecutivos**: `7aa4717` (las supresiones; su mensaje describe sólo la sonda y la guía, que también incluye) y `b53c7c9` (reescritura de enlaces, este índice, recorte de `p06-certification.yml` y sondas sólo manuales). Para restaurar el árbol anterior basta `git revert b53c7c9 7aa4717` (en ese orden). **No se reescribió historia ni se alteró ningún resultado**: todo sigue, byte a byte, en:

| Qué | Dónde (inmutable) |
|---|---|
| **Referencia permanente** | rama `evidence/pr203-2fd30db` → `2fd30dba0bed550afb5b742238da41537c2e34b7` (creada el 2026-10-09, SHA completo verificado, sin reemplazar ninguna referencia; ver nota) |
| Árbol completo auditado | commit [`2fd30db`](https://github.com/Z3roM4str/-nihon-travel-explorer/tree/2fd30dba0bed550afb5b742238da41537c2e34b7) — y `refs/pull/203/head` mientras exista el PR |
| Evidencia de rondas 2–5 y base/corregido | [`docs/final-audit-evidence/`](https://github.com/Z3roM4str/-nihon-travel-explorer/tree/2fd30dba0bed550afb5b742238da41537c2e34b7/docs/final-audit-evidence) (base 7 · fix 9 · round2 2 · round3 253 · round4-h03 16 · round5-h03 4) |
| Evidencia independiente (durabilidad, caso 4, caso 9) | [`docs/pr203-independent-evidence/`](https://github.com/Z3roM4str/-nihon-travel-explorer/tree/2fd30dba0bed550afb5b742238da41537c2e34b7/docs/pr203-independent-evidence) (25 ficheros) |
| Herramientas de investigación retiradas | los workflows `h03-*`, `pr203-anomaly-investigation`, `webstorage-durability` y los scripts `h03-*`, `p06-transfer-*`, `webstorage-durability-*`, `webstorage-lock-order-check`, `webstorage-safari-*`, `inspect-h03-sqlite.py`, `lib/h03-profile-evidence.mjs`, en ese mismo commit |
| Artefactos de CI (SQLite/WAL/SHM, perfiles originales, capturas) | enlazados en los informes de los PR #203/#204; GitHub los conserva 30 días desde cada ejecución |

> **Nota:** se intentó una etiqueta anotada `evidence/pr203-2fd30db`, pero la sesión no puede crear etiquetas (el proxy de git responde HTTP 403 a cualquier ref que no sea la rama de trabajo); se creó entonces una **rama** con ese nombre mediante la API de GitHub. Una rama puede moverse si alguien empuja a ella: **no empujar nunca a `evidence/*`**. Para inmutabilidad total, un propietario puede ejecutar `git tag -a evidence/pr203-2fd30db 2fd30dba0bed550afb5b742238da41537c2e34b7 && git push origin evidence/pr203-2fd30db`.

## Clasificación de lo que contenía el PR

| Clase | Qué es | Destino |
|---|---|---|
| **Producto** | `app/src` — 39 ficheros (almacén único `useStoredDocument`, `stored-document`, `storage-lock`, `persistence-recovery`, `download-file`, `lazy-surface`, avisos de protección, `portable-backup`, etc.) | Se integra |
| **Pruebas permanentes** | Pruebas Vitest nuevas/ajustadas; gates de navegador que ejecuta `scripts/p06-v2-certify.sh` (`final-audit-data-recovery/a11y/stale-tabs/export-protection/persistence-regressions`, `h03-reload-classification`, `lib/h03-reload`, `lib/settled-planning-draft`, fixtures) y los gates B10/B2x/B3x ajustados | Se integra |
| **CI permanente** | `p06-certification.yml` (añade `npm test`; sin ramas ni rutas específicas del PR) | Se integra |
| **Sondas manuales conservadas** | `webstorage-lock-staleness-probe.mjs` (valida la constante `SETTLE_AFTER_CONTENTION_MS`) y `safari-intro-gesture-probe.py` (recorrido real en Safari), lanzables sólo a mano con `closure-targeted-probes.yml` | Se integra, sin disparo automático |
| **Informes** | `FINAL_AUDIT_FIXES.md`, `FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md`, `PR203_INDEPENDENT_H03_AUDIT.md`, `PR203_CLOSURE_REPORT.md`, `IPHONE_SYNTHETIC_CHECK.md` (enlaces a la evidencia reescritos a este commit inmutable) | Se integran |
| **Registros históricos** | Todo lo que está bajo `docs/final-audit-evidence/` y `docs/pr203-independent-evidence/`; los 4 workflows y ~17 scripts de investigación | Sólo en `2fd30db` |

Por qué las herramientas de investigación no se integran: `webstorage-durability` y `h03-conservation-investigation` contienen contratos **rojos por diseño** (un `SIGKILL` temprano pierde la escritura en el motor; el estrés H03 conserva sus 8 s de navegación) y se dispararían en cada PR futuro que toque `app/`.
