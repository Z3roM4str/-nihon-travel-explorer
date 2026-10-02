# B10 — Certificación acotada de L1

**L1 implementado y verificado en su alcance. B10 INCOMPLETO; PR #177 permanece Draft. Sin merge ni deploy.** Esta certificación cubre F-C01 y sólo la etiqueta simple de F-C03, no declara las siete puertas globales de B10 satisfechas.

## Base y autoridad

- HEAD inicial/documental: `2bbc09d63be2abe03b17aea8796274251425d32f`.
- Main remoto: `b854db384c952e827b86d1bb35cac7caa70b035a`; rama `codex/b10-pulido-mission`. Ambos refs coincidieron antes de editar y antes de publicar; no hubo cambios remotos que incorporar.
- Implementación: `3ac50d11392dce7635232a18baf4530f38895d10`. El commit posterior contiene únicamente documentación/evidencia; su HEAD se obtiene con `git log -1 --format=%H -- docs/B10_L1_CERTIFICATION.md`.
- AGENTS.md buscado en checkout, árbol versionado y ascendentes: ninguno aplicable. Leídos misión, auditoría, handoff, Constitución, guardrails, componentes §13, sistema §10 y política de despliegue antes de editar.
- `04 §13` prescribe «57 lugares»; `03 §10` y Art. 7 prescriben viaje/día. La misión y auditoría ya autorizaban «Lugares en el viaje»; no depende de revisión de copy. La frase larga de Nosotros y F-C02 siguen pendientes.

## Cambio y conservación

| Superficie | Antes | Después | Conservación |
|---|---|---|---|
| FilterPanel / status vivo | «57 de 57 lugares», «1 de 57 lugares», «0 de 57 lugares» | «57 lugares», «1 lugar», «0 lugares» | `resultCount` real, `role=status`, filtros, selección, badges, Limpiar y Ver N intactos. Se conserva `totalCount` en el contrato y caller; deja de consumirse en la presentación |
| TripBackup / resumen | «Lugares en el recorrido» | «Lugares en el viaje» | Mismo `routeCount`, condición >0 y filas. SummaryList sirve tanto preview como resumen restaurado; ambos usan la etiqueta canónica. Export/import, advertencias, sustituir/cancelar y formato intactos |

Producto: sólo `app/src/components/FilterPanel.tsx` y `TripBackup.tsx`. Cobertura: `FilterPanel.count.test.tsx` y `app/scripts/b10-l1-check.mjs`. Cuatro casos renderizados prueban 0/1/57, total cero, independencia del total/filtros activos, acción coincidente y ausencia de mutación. El runner comprueba filtros **reales**: Fotografía → JP-037 (uno); añadir Imprescindible → cero; Limpiar → 57. Aplicar con Enter conserva las identidades visibles y cierra la hoja; no modifica almacenamiento.

Fixture aislada y coherente: dos personas, Quiero ir de JP-044/JP-203, V8 con dos días de IDs estables y fechas 2027-02-22/23. Archivo descargado realmente, reimportado con `setInputFiles`; conserva envelope versión 1 y draft versión 8. Preview conserva números/fechas/aviso, no escribe; Tab llega a Cancelar, Enter cancela y devuelve foco al input. B26 comprueba además sustitución, persistencia tras recarga, errores, rollback y Escape. No se usan datos personales del navegador.

## Comprobaciones y puertas

[Manifiesto y hashes](B10_L1_EVIDENCE.json); [comparación antes/después](evidence/b10/l1/comparison.json). Logs completos y 16 capturas seleccionadas publicados en `docs/evidence/b10/l1/`. Se capturaron 30 estados visuales en total; los restantes permanecen locales en `app/logs/b10-l1/`.

| Comprobación | Resultado y límite |
|---|---|
| Build / lint | PASS, salida 0. Aviso heredado de bundle >500 kB y warning Fast Refresh PlaceMap, sin cambios de dependencias/configuración |
| G1 / Vitest completo | **116 archivos / 3483 tests PASS**. Incluye filtros, portable-backup (53), Nosotros, V8 y todas las suites de invariantes. No se repiten por separado suites ya verdes |
| G2 / capacidades tocadas (`05 §12`) | Filtros completos y acciones conservados; exportación, preview, cancelar/Escape, confirmación y reemplazo/restauración verificados por runner+B26. Ningún cambio de datos, lógica, identidades ni formato |
| G3 / cromo | 390×844: superior **104 px**, total **160 px** (límites 112/168). 320 también 104/160; escritorio 104/104 |
| G4 / diff y sistema | `git diff --check` PASS. Cero cambios CSS/tokens/estilos, ni nuevos hex/queries/emoji/text-shadow. Suites de diseño/fundación incluidas en G1 |
| G5 / alcance comprobado | Todos los controles **desplegados** en cada estado de filtros recorridos con Tab dentro de la hoja; foco visible. Preview/cancel y foco de retorno intactos; B26 accesibilidad/teclado PASS. Geometría antes/después idéntica dentro de 0,001 px. **No PASS global**: los seis summary existentes miden 42 px de alto también en la base. Pendiente F-A02; no se cambian en L1. Contraste/estilos no cambian; revisión visual y lectura DOM no certifican lector físico ni AA global |
| G6 / medición acotada | Identity 800w de siete hubs ≤3.500.000 B, iguales a la base. Entrada con mismo analizador: raw 1.669.033→1.669.019 B; gzip nivel 9 390.317→390.304 B; Brotli 327.016→327.197 B (+181). No PASS histórico/global: P-03 y comparación equivalente con v1.1.0 siguen abiertos, sin reset de baseline ni optimización en L1 |
| G7 / navegador y revisión visual | Antes/después: **15 estados por versión** a 320×568, 390×844 y 1440×900; 57/1/0/reset y backup. Cero overflow/pageerror en esa muestra. Capturas revisadas contra §13 y léxico. Comparación de registros: sólo las 15 diferencias de copy previstas; identidades, controles, datos y geometría conservados |
| B26 Chromium / WebKit | **314/314 por motor**, salida 0, assertions y gate sin modificaciones. WebKit emulado no equivale a Safari/iPhone real |

Comandos: `npm ci`; `npm run build`; `npm run lint`; `npm test -- --reporter=basic`; `node scripts/bundle-report.mjs --json` sobre base y lote; `node scripts/b10-l1-check.mjs`; `NIHON_BROWSER=chromium node scripts/b26-nosotros-check.mjs`; `NIHON_BROWSER=webkit NIHON_WEBKIT_PATH=/tmp/b10-webkit node scripts/b26-nosotros-check.mjs`; `git diff --check`. Runner de base: `NIHON_B10_BASELINE=1 NIHON_B10_DIST=/tmp/nihon-b10-base-dist NIHON_B10_OUT=logs/b10-l1/before node scripts/b10-l1-check.mjs`. **El analizador reconstruye dist: no ejecutarlo mientras los gates leen esa salida.**

Entorno Debian 13, Node 24.19.0, Playwright 1.62.1, Chromium 1234, WebKit 2336/WPE. Bibliotecas oficiales Debian extraídas en `/tmp`, sin root ni cambios de producto/TLS. También se usó agent-browser para abrir la build actual y comprobar «57 lugares»; revisión React limitada al diff, sin nuevos hooks/effects/dependencias.

## Intentos conservados

- B26 Chromium primer intento: el analizador reconstruyó dist concurrentemente, produjo 404 temporales y timeout. Repetición con dist estable: 314/314. Error de coordinación del runner, no fallo silenciado ni modificación de producto/gate.
- WebKit: instalación global no posible sin root; bibliotecas oficiales aisladas. Primer wrapper GTK pidió display; se corrigió a WPE headless: 314/314. Sin falsear Safari físico.
- Desarrollo del runner B10: la primera fixture no incluía los lugares de planificación en Quiero ir, y la reconciliación vigente los retiró; se corrigió la fixture. La inspección inicial de foco de puntero se corrigió a modalidad Tab; se excluyeron controles de details cerrado con `checkVisibility`. El umbral de áreas expuso 42 px en base y lote: se conserva esa medida y se registra como deuda, sin cambiar gates existentes. Logs de todos los intentos publicados.

## Pendientes y siguiente lote

F-C01 resuelto; F-C03 resuelto **sólo en la etiqueta de backup**. F-C02 y la frase larga F-C03, F-M01, A-01, F-A02, CSS, movimiento completo, rendimiento/P-03 y OD-01 siguen abiertos. También orden/héroe editorial y patrón de acceso de colecciones. Safari/iPhone real y lector físico pendientes humanos; fotografías de zonas y OSM continúan separados.

Siguiente lote recomendado: **L2**, inventario visible/accesible de F-C02 y frase larga F-C03, con revisión de copy para estados parciales antes de implementar; corregir F-M01 según catálogo en su alcance propio. F-A02 alimenta L3, sin añadirse retroactivamente a L1.

#168 verificado OPEN/Draft en `1444e67805c60cf9a33f4be5c1a3808b900e505b`, intacto. Sin cambios en `claude/*`, Astra, main, datasets, fotografías o configuración de Vercel. Freeze `**:false/main:true` intacto. Publicación normal a la misma rama, commits separados de implementación y evidencia; no merge. **B10 no se declara completo.**
