# Auditoría independiente del PR #203 — 8 de octubre de 2026

**Veredicto del HEAD solicitado: NO APTO.** Las recargas perdidas están suficientemente atribuidas al WebKit WPE de Playwright. Sin embargo, los artefactos originales también muestran una regresión observable de los datos en los tres perfiles persistentes que agotaron las recargas. No basta con aceptar una limitación de navegación: todavía falta separar esa regresión de una pérdida duradera o una lectura obsoleta. Además, la clasificación original permite excepciones sin demostrar que el producto solicitó una navegación.

PR: https://github.com/Z3roM4str/-nihon-travel-explorer/pull/203

HEAD auditado: `6a87a7f5b35e8e73603288b5a716bdd8e4f706e6`.
Rama local de corrección: `audit/pr203-h03-independent`, creada para esta auditoría y basada en ese HEAD.
Árbol del producto: `bf880b5a72ec9cf1c40c26725ab28688465e32bc`.

## 1. Causa confirmada y evidencia independiente

Leí primero `FINAL_AUDIT_FIXES.md`, Ronda 5, y el README de `round5-h03`. Después contrasté los scripts, el producto, los logs originales de Actions y cuatro artefactos descargados. El diff entre `f09b283` y el HEAD sólo cambia dos documentos: el CI rojo anterior corresponde al mismo código del producto **y del arnés**. El script original dentro del artefacto rojo coincide byte a byte con el del HEAD; SHA-256 `128f81b50b89c2c5839c57499ff5bef2467c7a2caa0fb504cb0d9babfe0f1304`.

**Demostrado:** WebKit WPE pierde solicitudes de navegación tras RESET. En las sondas versionadas, las cifras recalculadas de 1220 resultados coinciden con el resumen: producto 12/340 atascos; recarga simple 46/340; página sin Nihon 2/100. Los controles con 503 registran 0/140 y 0/100. Las trazas disponibles muestran `beforeunload`, petición de documento en el driver, ausencia de recepción en el proxy y documento anterior todavía vivo. Los logs contienen errores internos de WebKit/libsoup. La reproducción sin código de Nihon descarta que ejecutar su manejador de recuperación sea una condición necesaria del atasco.

**Límite:** el agregado conserva 60 atascos y 14 ejemplos detallados; no he reconstruido 60 líneas de tiempo completas a partir del resumen. Los mensajes de libsoup también aparecen en casos sanos. No identifican por sí solos el defecto interno ni prueban que Safari, con otra pila de red, esté afectado.

**Hallazgo adicional, verificado en el artefacto original:** [run rojo 37699345002](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37699345002), artefacto `11517481148`, casos **1, 9 y 19**. Los tres tienen JP-044 antes del fallo y antes de recargar; después del timeout, el documento leído ya no contiene ese interés y su linaje vuelve al anterior. Los mismos IDs de viajeros siguen presentes. El marcador del documento viejo sigue activo y el proxy sólo recibió el documento inicial.

| Caso | Observación nativa | NetworkProcess antes → después | Resultado posterior |
|---|---|---|---|
| 1 | Control sin wrappers de Storage | 6310 → 6412 | Documento anterior sin JP-044; ninguna copia pendiente |
| 9 | Instrumentado | 7226 → 7325 | Documento anterior sin JP-044; ninguna copia pendiente |
| 19 | Control sin wrappers de Storage | 8358 → 8462 | Documento anterior sin JP-044; ninguna copia pendiente |

En el caso 9 se observa `setItem` con JP-044, lecturas posteriores con ese interés y eliminación de la copia pendiente tras la confirmación. Después no se observa otra escritura canónica de Nihon que quite el interés; la lectura posterior al reemplazo del proceso devuelve el documento inicial. Esto demuestra la **regresión observable de la API**, no una sobrescritura detectada del producto. No demuestra qué quedó en disco: el arnés elimina el perfil al cerrar y no obtiene en esa rama una lectura independiente del backend. Las otras dos repeticiones, sin wrappers, descartan que la instrumentación de Storage sea necesaria para ese síntoma.

**Probable:** la regresión corresponde a recuperación del backend/caché del motor o a una escritura no asentada en su almacenamiento persistente. **No verificado:** lectura obsoleta frente a pérdida duradera, supervivencia de esos valores al reabrir el perfil y ocurrencia en Safari/iOS.

El contrato nativo existente sí demuestra que el contexto efímero pierde su backend al reiniciar el proceso, y que los originales persistentes asentados mediante un cierre previo sobreviven. Ese cierre previo es una diferencia material respecto de las escrituras realizadas durante H03. Por tanto, no acredita la conservación de todos los cambios del escenario que falló.

## 2. Riesgo real para usuarios

El rechazo normal de un chunk ya está contenido por `LazySurfaceBoundary`: conserva el resto del árbol, ofrece recuperación y el refresco de módulos tiene un tope de tres segundos. Su manejador no escribe ni borra datos. La build y las pruebas de Chromium funcionan sin añadir esperas o reintentos al producto.

En WPE bajo carga y RESET existe una **recuperación realmente fallida**: tres casos pierden las tres solicitudes y mantienen la sesión anterior durante más de 24 segundos. En esos casos la API también deja de entregar un interés previamente confirmado. Esto afecta al escenario de prueba; no es sólo una aserción de tiempo demasiado exigente. No puedo certificar ausencia de riesgo de datos en ese motor ni afirmar que cerrar la pestaña sea seguro con cambios pendientes.

No hay evidencia de pantalla en blanco en esos tres casos: las comprobaciones previas pasan y el diagnóstico posterior conserva el aviso y el documento vivo. Tampoco hay evidencia de este fallo en usuarios reales de Safari. Sus frecuencias en el runner no son tasas de incidencia de producción. Fuera del entorno WPE examinado, no se ha demostrado un defecto nuevo de Nihon.

## 3. Pruebas y resultados

| Comprobación | Resultado y alcance |
|---|---|
| [P-06 del HEAD, 37704830916](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37704830916) | Chromium y WebKit success; 3455/3455 unitarias. Artefacto WebKit: recuperación 69/69, H03 35 estrictas y 24 diagnósticos separados; nueve snapshots antes/después idénticos; sin fallos de motor clasificados en la matriz ordinaria. |
| [Estrés original, 37699345002](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37699345002) | `load=0`: 202 OK, 0 FAIL y dos diagnósticos. `load=1`: 196 OK, 3 FAIL, casos 1/9/19. El control sin producto también pierde Storage en un contexto efímero. |
| [Estrés del HEAD, 37704830901](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37704830901) | Success; el artefacto cargado registra 202 OK y dos diagnósticos de recarga perdida. Confirma intermitencia, no una corrección del código. |
| Build y Vitest locales | Correctos; 121 archivos, 3455/3455 tests. Producto exacto del HEAD. |
| Recuperación local Chromium 151 | 93/93 en el HEAD y 93/93 con el arnés endurecido. Datos sintéticos, localhost. |
| Persistencia local Chromium | Los 33 casos completados cumplen sus aserciones. El proceso terminó con ENOENT al escribir el JSON en un directorio de evidencia inexistente; recuperé los resultados del log aplicando sus mismos criterios, sin repetir los 33 casos. |
| Control negativo independiente del clasificador original | Reproduce el defecto: primera pulsación sin navegación + cambio de proceso → acepta segunda pulsación y declara cobertura parcial. Debía fallar estrictamente. |
| Mismo control con corrección y suite de clasificación | Control negativo correcto; 8/8 casos deterministas Chromium. |
| Lint, sintaxis y diff | Sin errores; aviso heredado de Fast Refresh en PlaceMap. `git diff --check` correcto en las correcciones de código. |

WebKit no está instalado en este entorno local. La validación de ese motor procede de CI inspeccionado, **no** de una reproducción local. La corrección nueva y el contrafactual de escritura reciente aún no tienen validación WebKit. Los experimentos originales extensivos no se repitieron.

## 4. Correcciones preparadas

La clasificación original no era completamente rigurosa. Un PID nuevo, detectado desde el principio del escenario, podía justificar reintentos aunque el botón no navegara o la petición hubiera llegado al servidor. Si faltaba el aviso y cambiaba el proceso, tanto el aviso como la recuperación pasaban a diagnóstico y la función retornaba antes de comprobar el interés tras recargar. La afirmación de que todo el resto seguía estricto no describe esa rama.

En la rama independiente:

- `h03-reload.mjs` exige una petición del **frame principal**, emitida en esa pulsación y no recibida por el proxy. Un cambio de PID por sí solo ya no exime del fallo. Se mantienen ocho segundos por pulsación y el máximo existente de tres; no se añade ningún reintento.
- `final-audit-data-recovery-check.mjs` mantiene estrictos el aviso y la recuperación también cuando cambia el proceso de red.
- La regresión de clasificación conserva el caso de petición recibida sin respuesta como fallo estricto y añade el botón sin navegación con PID reemplazado. Permite seleccionar Chromium del sistema, igual que los otros gates.
- El contrafactual nativo de reinicio incorpora un modo opcional de escritura reciente. Asienta un checkpoint sin interés mediante cierre, abre el perfil, escribe JP-044 sin cerrarlo, comprueba el valor tras 25 segundos y reinicia sólo su NetworkProcess sintético. Distingue el checkpoint de la escritura nueva. Esa espera pertenece a una sonda causal separada; no cambia ningún límite de H03. **Preparado, no ejecutado.**

`app/src/`, dependencias, dataset y configuración de Vercel no cambian. No he aplicado una compensación del motor al producto. No hay merge, deployment, push ni mensajes publicados; Astra y los datos existentes no se han utilizado.

## 5. Bloqueantes y requisito exacto de integración

Quedan **dos** bloqueantes concretos: validar en WebKit el arnés endurecido y cerrar la clasificación de la regresión de datos de los perfiles persistentes. No hace falta volver a ejecutar las 1220 sondas ni acumular nuevos CI verdes.

Para fusionar con seguridad:

1. Incorporar las correcciones de esta rama. Ejecutar clasificación Chromium/WebKit y el gate de recuperación del candidato exacto; conservar los fallos estrictos y la distinción entre validación completa y cobertura parcial.
2. Ejecutar el contrafactual nativo acotado que faltaba:

   ```sh
   cd app
   NIHON_H03_RESTART_RECENT=1 NIHON_H03_RESTART_REPETITIONS=3 \
     NIHON_EVIDENCE_OUT=/tmp/h03-recent DEBUG=pw:browser \
     node scripts/h03-webkit-network-restart-probe.mjs
   ```

   Si reproduce la misma regresión sin Nihon, la limitación del backend del motor queda aislada también para escrituras recientes: se podrá valorar **APTO CON LIMITACIONES DOCUMENTADAS**, declarando expresamente que WPE no certifica esa durabilidad. Si no la reproduce, la lectura del perfil afectado desde una página nativa independiente y al reabrirlo, sin resembrar, es la comprobación dirigida necesaria para distinguir caché de pérdida. No sustituir esa comprobación por otro estrés verde.
3. Documentar ese resultado y el alcance aceptado en la decisión de integración. Si aparece una sobrescritura de Nihon, corregirla y ejecutar su regresión antes de integrar. Safari físico sólo es obligatorio si se pretende certificar expresamente ese alcance; no lo impongo como una nueva ronda genérica.

**No recomiendo aceptar ahora una limitación exclusivamente de navegación**, porque la evidencia de datos persistentes no está cerrada. El bloqueo ya no consiste en desconocer quién solicitó la recarga: consiste en no poder garantizar todavía qué ocurrió con el dato confirmado.

## 6. Evidencia conservada

- [`round5-failed-cases.json`](pr203-independent-evidence/round5-failed-cases.json): extracción de los tres casos, originales, valores posteriores, PIDs, escrituras observadas y peticiones.
- [`artifact-hashes.json`](pr203-independent-evidence/artifact-hashes.json): SHA-256 de los cuatro ZIP descargados; los dos del run rojo coinciden con los digest publicados por GitHub.
- [`local/`](pr203-independent-evidence/local/): resultados locales y limitaciones de ejecución.
- [`classification-negative-check.mjs`](pr203-independent-evidence/classification-negative-check.mjs): control mínimo reproducible contra el HEAD original; `NIHON_AUDIT_REF=WORKTREE` verifica la corrección.
- Logs originales y artefactos íntegros descargados: `/workspace/pr203-audit-raw/`; ZIP: `/workspace/attachments/`. Las copias compactas versionadas no reemplazan esos originales.

**Conclusión final: NO APTO en el HEAD de referencia.** El camino de cierre es el contraste de persistencia reciente indicado y la validación dirigida de las correcciones del arnés; no una investigación abierta ni un cambio de comportamiento para obtener verde.
