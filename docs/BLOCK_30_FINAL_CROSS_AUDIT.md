# B30 — auditoría cruzada final de PR #169 / #168

## Identidad y alcance

- Canónico: PR #169, `codex/block-30-b9-4-donde-dormir`.
- Base: `a7b916be005f002e46c67442968379f72d3b480d`.
- HEAD remoto auditado inicialmente: `178d1f11f278ed1e76aca45f6136c4997ee3b8e5`.
- Tree anterior: `24c12a73a42860629b50bea33abab353fa7d2f39`.
- #168 se inspeccionó como referencia; no se fusionó, no se tomó como base y no se copió su implementación automáticamente.
- Los SHA finales de publicación y el nuevo tree se registran en la descripción de #169, después de comprobar que el tree remoto coincide con el local. El cambio de tree corresponde únicamente al botón persistente, nombres accesibles de comparación, cobertura browser y documentación de esta auditoría.

## Diferencias y decisiones

| Diferencia de #168 | Clasificación | Decisión en #169 |
|---|---|---|
| Botón persistente al elegir/quitar | Mejora objetiva incorporada | Un solo botón con identidad estable en `ZoneChoiceAction`; sin efectos de refocus ni cambios de lógica V8. |
| Etiqueta `Comparar {zona}` en cada casilla | Mejora objetiva incorporada | Cada casilla identifica su zona incluso fuera del contexto visual de la tarjeta. |
| Nombre del control para quitar las zonas de comparación | Mejora objetiva incorporada | `Quitar las zonas marcadas para comparar`, distinto de quitar la elección del plan. |
| Nombres de elegir/quitar y estado elegido | Ya cubierta/equivalente | Las acciones ya nombraban la zona; se conserva la insignia y el banner persistente `role="status"`. |
| Otras zonas siguen diciendo sólo «Dormir aquí» | Inferior | Se conserva `Cambiar a esta zona` / `Cambiar la zona del plan a {zona}`: informa explícitamente que sustituye la elección. |
| Contexto de lugares guardados y ordenación por proximidad | Incompatible con el contrato canónico | Sólo `routeIds` V8 del hub activo; proximidad descriptiva; orden del catálogo; sin ranking. |
| Etiquetas permanentes de nombre en los pins | Fuera de alcance para esta corrección opcional | No se demuestra un beneficio claro que compense el contenido adicional en el mapa de 210 px. Se conservan pins neutros, `title` con nombre de zona y tooltip de estación. No se afirma haber probado una variante de etiquetas en móvil. |
| Adaptación de `PhotoPlaceholder` con resumen editorial dentro del espacio fotográfico | Inferior para este contrato | Se mantiene `ZonePhotoFallback`: específico de zona, menos acoplado a POI, «Fotografía pendiente» explícita, opinión en su propio bloque. Ninguno aporta fotografías reales de zona. |
| Separación de hechos, cálculo y opinión; ausencia de ordinales | Ya cubierta/equivalente | Se mantienen los bloques etiquetados de #169, las fuentes y los pins sin números. |
| Teclado, 44 px, responsive, reduced motion y almacenamiento | Ya cubierta/equivalente, con refuerzo útil | Se mantiene el gate canónico y se añade el recorrido completo de lista con reduced motion. |
| Foco tras elegir/quitar/cambiar en lista y columnas | Mejora objetiva incorporada | Aserciones contra `document.activeElement` después de activación con Enter. |
| Límite de cuatro y retorno PlaceDetail al mismo comparador | Mejora objetiva incorporada como cobertura | Quinta casilla deshabilitada, cuatro columnas y mismo orden/zonas tras volver; cero escrituras del draft. |
| Certificación en WebKit | Mejora objetiva incorporada como cobertura | `NIHON_BROWSER=webkit` ejecuta el mismo gate, sin cambiar expectativas. |
| Diferencias heredadas de la base Claude y B9.5 | Fuera de alcance | Sin adopción ni investigación de bloques posteriores. |

## Prueba real de foco

Antes de corregir, Chromium sobre la build del HEAD certificado:

1. Enfocar «Dormir aquí» y pulsar Enter: `document.activeElement` = `BODY`, sin `aria-label`.
2. Enfocar el nuevo «Quitar del plan» y pulsar Enter: `document.activeElement` = `BODY`, sin `aria-label`.

Después, el gate comprueba el botón exacto de la misma tarjeta: elegir → quitar; quitar → dormir; elegir otra zona → quitar de la nueva zona; quitar esa sustitución → dormir de esa misma zona. También comprueba estos cuatro cambios en las columnas del comparador. No se hace un `.focus()` después de la activación para ocultar una pérdida de foco.

Los nombres accesibles conservan la zona, el cambio de zona es explícito y el estado se comunica mediante la insignia y el banner `role="status"` existente. La automatización valida DOM y foco; no certifica el audio de un lector de pantalla físico.

## Verificación final

| Gate final | Resultado |
|---|---|
| Build | PASS; warning heredado de bundle >500 kB |
| Lint | Exit 0; warning heredado `PlaceMap.tsx:17` |
| Vitest completo | 114 archivos, 3465/3465 |
| Invariantes dirigidas | 9 archivos, 231/231: zonas, contexto routeIds/hub, V8, elección, enlace al plan, identidad de día e inter-hub |
| B30 Chromium | 475/475, `/usr/bin/chromium`, ocho viewports y un recorrido completo adicional de lista con reduced motion |
| B30 WebKit | 475/475, WebKit 26.5 / Playwright v2336, mismo gate y expectativas |
| Reduced motion | PASS en ambos motores: 51 checks del recorrido completo de lista y 2 checks específicos de media query/fallback; incluidos en 475, no sumados otra vez |
| B29 | 163/163; también B28 anidado 64/64 |
| B28 aislado | 64/64, mouse/touch y ocho viewports |
| B27 | A–K, ocho viewports |
| B26 aislado | 314/314 |
| B18 browser back | 15/15 |
| `git diff --check` | PASS |

La primera ejecución B26 con otros navegadores activos dio 313/314, fallo `K-FOCUS-VISIBLE` en Nosotros a 1440×900. La ejecución final secuencial y aislada pasó 314/314 sin cambiar código de Nosotros, el gate ni expectativas. No se atribuye causalidad al paralelismo sólo por esta observación; se registra el fallo intermitente.

WebKit no estaba operativo inicialmente: se descargó v2336 y se extrajeron sus bibliotecas Debian en `/tmp/b30-webkit-libs`. Una copia temporal del launcher conserva `LD_LIBRARY_PATH` para cargarlas; el binario WebKit y las expectativas del gate no se modificaron. Para esta sesión se usó `PLAYWRIGHT_BROWSERS_PATH=/tmp/b30-pw`, `LD_LIBRARY_PATH=/tmp/b30-webkit-libs/root/usr/lib/x86_64-linux-gnu` y `NIHON_BROWSER=webkit`. Esta preparación del runner no pertenece al árbol del proyecto.

La prueba de lista usa Shinjuku y Estación de Tokio / Marunouchi. Enter transforma `Dormir en Shinjuku` en `Quitar Shinjuku del plan` conservando el elemento activo; otro Enter devuelve `Dormir en Shinjuku`. Al sustituir por Marunouchi, el elemento activo es `Quitar Estación de Tokio / Marunouchi del plan`; al quitarla vuelve a `Dormir en Estación de Tokio / Marunouchi`. Se repite en las columnas de comparación.

Los únicos cambios de producto son la identidad del botón y los dos nombres accesibles de comparación. App, datos, cálculos, hooks de zona, modelo V8, Días y almacenamiento conservan el contenido del HEAD inicial.

## Límites y deuda

- Fotografías reales de zona: pendientes de cobertura licenciada; fallback honesto conservado, sin fotografías de POI.
- B25 no se reabre: resultado previamente demostrado base 122/123 y B30 122/123, misma clase `C-CLEAN / ERR_CERT_AUTHORITY_INVALID`, ambiental/preexistente. **No se declara completamente verde.**
- Los recursos externos y las teselas OSM no se certifican por el éxito de los checks funcionales. Se conserva la clasificación de errores externos del gate canónico; no se desactiva TLS ni se cambian expectativas para WebKit.
- WebKit automatizado no equivale a Safari físico de iPhone.
- No merge, cierre de #168, deploy, Vercel, Astra, B9.5, B10, force-push ni rebase.
