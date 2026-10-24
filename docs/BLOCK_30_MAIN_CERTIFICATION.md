# B30 / B9.4 — Certificación final de main

**B30 / B9.4 CERRADO E INTEGRADO EN MAIN.** Certificación ejecutada el 2026-09-30 (America/Mexico_City), 2026-10-01 UTC. B31 / B9.5 NO fue iniciado.

## Integración verificada

| Dato | Valor |
|---|---|
| PR #169 — implementación B30 | Integrado; merge `194d7601b1a0f9a84e2b35c2faf053a13987c7e6` |
| PR #171 — hotfix CSS de invariantes | Integrado; merge `cd9f60c01450141300b5d044f30ba95f8ca32d18` |
| PR #172 — corrección de race del gate WebKit | Integrado mediante merge commit; sin squash ni rebase |
| main pre-merge / primer padre | `cd9f60c01450141300b5d044f30ba95f8ca32d18` |
| Merge #172 / main post-merge certificado | `a21920bcef2478ba1e5c0367e118a997f20acc31` |
| Segundo padre integrado | `43ca260056912843c7246cb700bbf5e8644d3d40` |
| merged_at / merged | `2026-10-01T01:30:24Z` / `true` |
| Tree de main certificado | `78ba86c69c3f53af38e20067e565ff408199d9c9` |

Antes del merge se repitió fetch y se verificaron main, HEAD, mergeable=true, Ready for Review y el único diff: `app/scripts/b30-where-to-sleep-check.mjs`, +17/-0. El árbol post-merge coincide exactamente con el árbol previamente certificado.

## Causa y corrección de la race

La visibilidad del DOM de Días no garantiza que sus efectos de montaje y reconciliación hayan terminado. La fixture V8 sin cambios escribe una vez al montar y otra tras reconciliar. El gate reiniciaba/observaba el registro de escrituras antes de finalizar esos efectos; una escritura pendiente podía entrar en la ventana de observación de la reapertura de Dónde dormir. WebKit expuso esa carrera de sincronización.

#172 añade `waitForPlannerMountWrites`: espera el panel del planificador y exactamente sus dos escrituras V8 antes de entrar en la superficie o medir la reapertura. Conserva el registro completo y las aserciones estrictas. **Nunca fue necesario modificar producto para corregir WebKit**: #172 cambia sólo el gate. No altera almacenamiento, expectativas ni comportamiento del producto. #171 corrige por separado las invariantes de tokens CSS; no es la corrección de esta race.

## Certificación sobre main post-merge

| Comprobación | Resultado |
|---|---|
| Build | PASS, exit 0; warning heredado de bundle >500 kB |
| Lint | PASS, exit 0; warning heredado `PlaceMap.tsx:17`, `react/only-export-components` |
| Vitest completo | **3465/3465**, 114 archivos, exit 0 |
| Invariantes dirigidas | **231/231**, 9 archivos, exit 0 |
| B30 Chromium, ejecución 1 | **475/475**, exit 0 |
| B30 Chromium, ejecución 2 | **475/475**, exit 0 |
| B30 WebKit, ejecución 1 | **475/475**, exit 0 |
| B30 WebKit, ejecución 2 | **475/475**, exit 0 |
| B29 | **163/163**; B28 anidado **64/64**, exit 0 |
| B28 aislado | Tres fallos `J: auto-scroll continued after cancellation`; cuarta ejecución **64/64**, exit 0, sin cambios |
| B27 | PASS A–K, 8 viewports, exit 0 |
| B26 | **314/314**, exit 0 |
| B18 browser back | **15/15**, exit 0 |
| `git diff --check` | PASS |

Las cuatro ejecuciones B30 usan el gate íntegro del tree certificado. Cada una incluye `320x568 reopening reads selection without serializing it`, los ocho viewports y el recorrido completo adicional de lista con reduced motion, además de las comprobaciones específicas de media query/fallback. No se cambiaron aserciones ni se omitió un recorrido. **El producto quedó certificado en Chromium y WebKit**, con 2/2 ejecuciones verdes por motor desde main.

Runner Windows: Node 22.21.0, Playwright del proyecto, Chromium headless shell v1234 y WebKit v2336. El Chromium completo instalado no arrancó (`spawn UNKNOWN`); se usó el headless shell instalado y ya empleado en evidencia previa. Los intentos de Vitest dentro del sandbox fallaron al cargar la configuración por permisos; las ejecuciones autorizadas pasaron. Dos intentos iniciales WebKit dentro del sandbox fallaron en consola por TLS de recursos externos (`SSL peer certificate or SSH remote key was not OK`); ambos recorridos completos autorizados pasaron. No se desactivó TLS, interceptaron recursos ni cambiaron producto/tests. Hubo intentos de launcher con una ruta incorrecta de headless shell; quedaron registrados y no se cuentan como ejecuciones funcionales.

Logs conservados localmente en `b30-post-hotfix-main/app/certification-b30/`: `build.log`, `lint.log`, `vitest-authorized.log`, `invariants-authorized.log`, `b30-chromium-{1,2}-final.log`, `b30-webkit-{1,2}-authorized.log`, `b29-day-order-tools-final-1.log`, `b28-reorder-dnd-final-{1,2,3,4}.log`, `b27-viaje-dias-final-1.log`, `b26-nosotros-final-1.log` y `b18-final.log`. No forman parte del commit documental.

## Flakiness y comparación acotada

B28 ya tenía dos fallos previos de auto-scroll antes de pasadas verdes. En esta certificación pasó anidado dentro de B29, falló tres veces aislado y pasó la cuarta vez aislado **sin modificar tests ni producto**. Por la repetición del fallo se construyó el main pre-merge `cd9f60c...` y su B28 pasó **64/64** en el mismo runner; después main post-merge pasó **64/64**. El diff de producto y del gate B28 entre ambas revisiones está vacío. No se observa una regresión nueva determinista ni se declara que todas las ejecuciones B28 fueron verdes. Logs de comparación: `b28-baseline-build.log`, `b28-premerge-baseline.log` y `b28-reorder-dnd-final-4.log`.

B26 conserva antecedentes de foco `I-RESET-CANCEL` y `K-FOCUS-VISIBLE`. En esta certificación funcional pasó a la primera, 314/314; no reaparecieron. No se investigó ni modificó B26.

## Deuda y límites

- Fotografías reales de zona pendientes de cobertura licenciada; se conserva el fallback accesible «Fotografía pendiente».
- Safari físico / iPhone real sigue fuera de certificación. WebKit automatizado no sustituye esa prueba.
- Recursos externos y teselas OSM siguen fuera de certificación. B25 conserva su antecedente base/B30 122/123 por `C-CLEAN / ERR_CERT_AUTHORITY_INVALID`; este cierre no lo declara completamente verde ni lo reabre.
- #168 sigue abierto y Draft en `1444e67805c60cf9a33f4be5c1a3808b900e505b`, sin cambios.
- B31 / B9.5 NO fue iniciado. Sin cambios en ramas `claude/*`, Astra, Vercel/deploy, fotografías ni OSM/recursos externos.

Este informe sustituye los estados históricos de publicación pendiente en `BLOCK_30_HANDOFF.md` y `CURRENT_WORK_HANDOFF.md`, y complementa la auditoría histórica de #169 en `BLOCK_30_FINAL_CROSS_AUDIT.md`. El cierre documental se publica en un commit independiente que contiene únicamente documentación.
