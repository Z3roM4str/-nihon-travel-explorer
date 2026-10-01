# B31 / B9.5 — Integración y certificación de main

**B31 / B9.5 CERRADO E INTEGRADO EN MAIN.** Verificación post-merge: 2026-09-30 America/Mexico_City / 2026-10-01 UTC.

## Identidad verificada

| Dato | Valor |
|---|---|
| PR canónico | [#175](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/175) |
| main pre-merge / primer padre | `393ef2b2a1a2db0641d3785b7e7cf155c914fa5c` |
| Rama fuente | `codex/block-31-b9-5-reservas-resumen` |
| HEAD certificado / segundo padre | `c00a35da6ab26d4ccf3389fad6f265f1c06a6868` |
| Implementación | `9761817f0d7acfcff418145c36e14615b2840760` |
| Merge commit | `cde9b14bc9e456270576c8dafe0243ddb8c650db` |
| Tree certificado y del merge | `4e0ad7437ce48e0ca40de1bdf6848445d35b080f` |
| merged / merged_at | `true` / `2026-10-01T03:51:31Z` |

Antes del merge se verificaron por remoto las dos referencias exactas, PR OPEN, Ready for Review (`isDraft=false`), MERGEABLE y estado CLEAN. Main no tiene protección ni reglas aplicables: no existen checks requeridos. El HEAD tiene cero check-runs y cero statuses; el agregado `pending` con cero entradas no es un check pendiente ni una aprobación de CI. La certificación aplicable es la matriz local exigida por la misión B31.

El commit entre implementación y HEAD publicado sólo modifica cuatro documentos. `app`, `data` y `scripts` son idénticos al código certificado. Se leyeron misión, handoff, estado vigente, Constitución, guardrails, especificaciones Reservas/Resumen, decisiones, roadmap y política de despliegue. La autorización expresa de integrar #175 sustituye el alcance de entrega sin merge de la misión original. No cambió ninguna referencia de código ni fue necesaria una recertificación pre-merge adicional.

GitHub fusionó mediante merge commit con HEAD esperado; sin squash, rebase ni force-push. Se verificó `merged=true` mediante API, y por fetch los dos padres, exactamente la base y el HEAD certificados. El tree del merge es idéntico al certificado: no hay cambios de contenido introducidos por la integración.

## Certificación post-merge

Ejecutada sobre el merge exacto en el checkout local `b31-close`, con dependencias del runner previamente certificado. Todas las comprobaciones terminaron con código 0 en su primer intento post-merge. Código, gates, datos y configuración permanecen intactos.

| Comprobación | Resultado |
|---|---|
| Build | PASS; aviso de chunk grande ya presente en la certificación previa |
| Lint | PASS; warning heredado `PlaceMap.tsx:17`, cero nuevos |
| Vitest completo | 115 archivos; 3479/3479 PASS |
| Invariantes | 9 archivos; 231/231 PASS |
| B31 Chromium / WebKit | 281/281 por motor PASS |
| B30 Chromium / WebKit | 475/475 por motor PASS |
| B29 y B28 anidado | 163/163 y 64/64 PASS |
| B28 aislado | 64/64 PASS |
| B27 | A–K en 8 viewports PASS |
| B26 | 314/314 PASS a la primera |
| B18 browser back | 15/15 PASS |
| git diff --check | PASS |

Comandos: `npm run build`, `npm run lint`, `npm test -- --reporter=basic`, suite de nueve archivos de invariantes citada en el manifiesto, gates `b31-reservas-resumen-check.mjs` y `b30-where-to-sleep-check.mjs` con `NIHON_BROWSER=chromium` y `webkit`, `b29-day-order-tools-check.mjs` (incluye B28), `b28-reorder-dnd-check.mjs`, `b27-viaje-dias-check.mjs`, `b26-nosotros-check.mjs` y `b18-browser-back-check.mjs` mediante preview Vite local con puerto dinámico. Chromium usa headless shell 1234 y WebKit 2336. No se desactiva TLS ni se interceptan recursos externos.

Los logs y capturas se conservan en `b31-close/app/logs/b31-postmerge/`, ignorados por Git. [El manifiesto documental](BLOCK_31_POST_MERGE_EVIDENCE.json) registra SHA-256 de los logs, comandos e identidad del código. Se revisaron capturas de Reservas y Resumen; los gates verifican dimensiones, foco, teclado, targets, reduced motion, retorno exacto, conservación de V8 y ausencia de escrituras al consultar. El build mantiene el mismo asset de entrada `index-OVb2DdYf.js`, 1.669,00 kB / 394,70 kB gzip, que la certificación pre-merge.

## Incidencias, límites y siguiente bloque

No hubo fallos funcionales post-merge. La certificación previa registró un timeout B26 en onboarding a 430×932, seguido de 314/314 sin cambiar Nosotros, Onboarding ni el gate. B28 tiene antecedentes de auto-scroll documentados en el cierre B30. B26 pasó 314/314 a la primera, incluidos I-RESET-CANCEL y K-FOCUS-VISIBLE; B28 pasó 64/64 anidado y aislado. No se reprodujeron esas intermitencias ni se observó una regresión nueva. PlaceMap y el aviso de chunk grande son antecedentes, con el mismo warning y asset en los logs pre-merge.

Los primeros comandos de autenticación y la simulación `merge-tree` dentro del sandbox fallaron por falta de credenciales/permisos locales. Se repitió la verificación remota con las credenciales autorizadas, y el merge real fue verificado por API y fetch. Son incidencias del runner previas al merge, no fallos de producto ni resultados funcionales de los gates.

Siguen pendientes Safari/iPhone físico, lector de pantalla físico, fotografías reales de zonas y recursos externos/OSM. B25 conserva su antecedente externo 122/123 y no se declara verde por este cierre. No se inicia adquisición B6 ni se cambia ningún dataset.

#168 se conserva OPEN, Draft, HEAD `1444e67805c60cf9a33f4be5c1a3808b900e505b`. No se modifican ramas `claude/*`, ni se usa Astra, Vercel o comandos de deploy. La política existente mantiene el automatismo externo para main; este trabajo no lo invoca ni modifica.

El siguiente bloque pendiente documentado es **B10 — Pulido**, según `docs/design/10_ROADMAP_DE_BLOQUES.md`, incluyendo auditorías de movimiento, accesibilidad, rendimiento, CSS y microcopy, y decisión OD-01. No iniciado; no se inventa un número de proyecto para él.

El cierre se publica en un commit exclusivamente documental posterior al merge, mediante push normal desde el main remoto verificado. Su SHA se obtiene del commit que contiene este informe (`git log -1 --format=%H -- docs/BLOCK_31_MAIN_CERTIFICATION.md`); no se inserta un SHA autorreferente. El tree final añade sólo documentación al tree integrado y se distingue del tree certificado de código. El checkout de integración es `b31-close`; los checkouts y artefactos locales preexistentes se preservan.
