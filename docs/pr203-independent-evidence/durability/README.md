# Conservación: confirmación de API, cierre normal e interrupción

Continuación de `f5694097ec2cdbf3cd2e2e87261139b06f0e77ca`. Implementación del producto: Claude; no se cambia `app/src`, sus timeouts ni sus mecanismos de almacenamiento.

## Pregunta que puede cambiar la decisión

Los 12 fallos nativos anteriores emplearon `SIGKILL` explícito del arnés sobre el NetworkProcess sintético. Esto demuestra una escritura B visible para JavaScript que todavía no estaba confirmada en SQLite, interrumpida antes del commit. No demuestra por sí solo incumplimiento de la API ni pérdida durante un cierre normal.

El caso 4 conservado de `d429ba2` es diferente: NetworkProcess 7006 fue sustituido por 7106 durante RESET/recuperación, **antes** del cierre solicitado por el arnés a las 02:58:58.727 UTC. El cierre del proceso padre 6989 terminó con `exitCode=0, signal=null`; ese código no es el del proceso 7006. No hay código/señal de salida del hijo, core dump o traza nativa que permita afirmar cómo terminó. B se leyó en el documento antiguo; todos los estados físicos conservados y la lectura del mismo perfil desde un proceso nuevo contienen A. No se demostró que B llegara a estar comprometido en disco y luego fuera borrado. Los perfiles originales de los casos 1, 9 y 19 históricos se eliminaron; su causa no se reconstruye a partir de este caso.

## Garantías y fuentes primarias

Playwright **1.62.1**, WebKit build **2336**, declara upstream WebKit **`343e13bf22dca9d0ec227801419aab0f9001a32f`** en [UPSTREAM_CONFIG.sh](https://github.com/microsoft/playwright/blob/v1.62.1/browser_patches/webkit/UPSTREAM_CONFIG.sh). No se ha empleado `main` de WebKit para atribuir comportamiento al binario probado. Es un upstream con parches de Playwright, no Safari.

* [StorageAreaMap::setItem](https://github.com/WebKit/WebKit/blob/343e13bf22dca9d0ec227801419aab0f9001a32f/Source/WebKit/WebProcess/WebStorage/StorageAreaMap.cpp#L86): cambia el mapa del WebProcess y envía `SetItem` por `sendWithAsyncReply`; retornar de JavaScript no espera al disco. `getItem` consulta ese mapa.
* [SQLiteStorageArea](https://github.com/WebKit/WebKit/blob/343e13bf22dca9d0ec227801419aab0f9001a32f/Source/WebKit/NetworkProcess/storage/SQLiteStorageArea.cpp#L45): `transactionDuration = 500_ms`; `setItem` empieza una transacción y ejecuta el INSERT. Su commit se programa en la cola de trabajo; el cierre de la zona llama a `commitTransactionIfNecessary`.
* [NetworkStorageManager::setItem](https://github.com/WebKit/WebKit/blob/343e13bf22dca9d0ec227801419aab0f9001a32f/Source/WebKit/NetworkProcess/storage/NetworkStorageManager.cpp#L1719): la respuesta IPC sigue al INSERT, no al commit diferido.
* [WHATWG HTML, Storage.setItem](https://html.spec.whatwg.org/multipage/webstorage.html#dom-storage-setitem): define la actualización del mapa y su difusión; no expone una operación de flush ni una confirmación de durabilidad frente a la caída del proceso. La [recomendación W3C histórica, hoy sustituida](https://www.w3.org/TR/2021/SPSD-webstorage-20210128/#the-storage-interface) lo expresaba: “This specification does not require that the above methods wait until the data has been physically written to disk”. No se presenta esta recomendación sustituida como norma actual.

Los hashes de los cuatro ficheros completos consultados están en `primary-source-manifest.json`; los fragmentos relevantes, en `primary-source-excerpts.txt`. La ventana de 500 ms es una decisión de esta revisión del motor, **no** una garantía universal ni una razón para añadir esperas al producto.

En Nihon, el corazón `aria-pressed=true` expresa la elección en la interfaz. `useStoredDocument` escribe bajo Web Locks, conserva el diario pendiente y lo confirma tras 2,5 s de lecturas canónicas; ninguna de esas lecturas puede certificar el commit SQLite. El aviso de persistencia informa de errores detectables por la API. No hay una promesa explícita de fsync ni una API web de localStorage que permita hacerla.

## Reproductor y prueba dirigida

`app/scripts/webstorage-durability-repro.html` es una página autónoma, sin Nihon, React, Playwright ni wrappers de Storage. No escribe automáticamente; rechaza datos existentes que no sean sintéticos. Escribe A, espera unos 1,7 s, escribe B y registra retorno de `setItem`, lectura, documento, origen y versión declarada por el navegador.

`app/scripts/webstorage-durability-check.mjs` compara:

* Nativo: recarga y cierre normal a edades mínimas 0, 100 y 700 ms tras B; interrupción explícita mediante SIGKILL a 0 y 100 ms. Tres repeticiones por condición. Se registra la edad real, incluida la copia forense anterior a la operación.
* Nihon, sin servidor defectuoso ni datos sembrados: guardar Ghibli por la interfaz y recargar/cerrar/reabrir, inmediatamente después de verificar UI+API y después de observar la confirmación interna existente del diario. Tres repeticiones por condición.
* Originales, copias anteriores y posteriores, errores tempranos, lecturas SQLite y lectura nativa desde un nuevo proceso sobre el **mismo perfil**, sin resembrar. Los tests de conservación siguen exigiendo B, también bajo SIGKILL; cualquier incumplimiento permanece rojo.

El lector físico SQLite se aplica a WebKit. Chromium emplea LevelDB: sus perfiles se conservan y su conservación se verifica mediante un proceso nuevo, sin presentar el lector SQLite como evidencia de sus bytes.

La nueva CI compara WPE/Linux y el puerto WebKit de Playwright/macOS, además de Chromium. macOS no equivale a Safari/iOS. Un job adicional comprueba la capacidad disponible de Safari real con safaridriver y el retorno+recarga nativo, conservando un posible error de disponibilidad. La sesión aislada de WebDriver no permite elegir/reutilizar un perfil persistente: esa prueba no certifica cerrar/reabrir Safari.

La primera ejecución, SHA `f1592dc265cda49ff6a8866c918613b7b7b79a8c`, confirmó Safari real 26.6.1 (20624.5.1.18.3), macOS 15.7.9 (24G830), y una recarga nativa con cambio de documento y B conservado. Por ello se amplía únicamente esta comprobación disponible a tres recargas nativas y tres guardados/recargas ordinarios de Nihon, con clicks WebDriver y orígenes sintéticos distintos, sin borrar los casos previos. Se guardan HTML, captura y lecturas antes de desechar la sesión automatizada; esa evidencia **no es una copia de perfil persistente**.

En ese mismo SHA, el contrafactual macOS de muerte abrupta no llegó a terminar ningún proceso: el descubrimiento no reconoció el nombre del servicio XPC. Sus seis rechazos quedaron rojos y sus perfiles se conservaron; **no son seis pérdidas de datos ni seis conservaciones bajo interrupción**. La corrección del arnés conserva los nombres sin truncar (`ps -ww`), reconoce el sufijo `.Development` del servicio XPC y registra los nombres de proceso. Sigue exigiendo un único NetworkProcess nuevo con ficheros abiertos en el perfil sintético antes de permitir SIGKILL. No se elimina ni suaviza esa comprobación de seguridad.

Las limitaciones de la sesión automatizada de Safari están documentadas por el propio equipo WebKit en [Safari-exclusive Safeguards](https://webkit.org/blog/6900/webdriver-support-in-safari-10/): las ventanas de automatización están aisladas de los perfiles normales y empiezan sin el estado persistente de sesiones anteriores. El Safari disponible para esta prueba no permite certificar el perfil normal tras salir y reabrir el navegador ni sustituye un dispositivo iOS.

La ejecución `72636d3b2e88ae3b5edffeb11665a358cf492b1a` identificó de forma inequívoca `com.apple.WebKit.Networking.Development` mediante PID nuevo y los descriptores del perfil. Sus seis SIGKILL tempranos también devolvieron A desde un proceso nuevo: el mecanismo **no es exclusivo de WPE/Linux**. Los 18 recorridos nativos normales y los 12 de Nihon conservaron B en ambos puertos. La ruta física de macOS es `LocalStorage/http_127.0.0.1_PORT.localstorage`, diferente de `localstorage.sqlite3` de WPE: se amplía el lector independiente a ese nombre observado y se exige una base encontrada para WebKit; cero bases ya no puede presentarse como validación física.

En Safari real, las tres recargas nativas pasaron; los tres recorridos de Nihon terminaron con `click intercepted` al intentar salir de la presentación inicial, antes de guardar B. Se conservaron los tres HTML, capturas y lecturas A. Es una prueba que no alcanzó el guardado, no una pérdida de datos ni una explicación del fallo móvil histórico P-06. El arnés incorpora la misma condición previa de interacción habitual en Playwright: botón conectado, visible, habilitado, geometría estable y centro que recibe el evento. Todo queda registrado, dentro del límite previo de ocho segundos y con **una única pulsación WebDriver**; no se reintenta una pulsación rechazada.

Ejecución local:

```sh
cd app
npm ci
npm run build
npx playwright install --with-deps webkit
NIHON_BROWSER=webkit NIHON_EVIDENCE_OUT=/tmp/native-durability node scripts/webstorage-durability-check.mjs
python3 scripts/inspect-h03-sqlite.py /tmp/native-durability > /tmp/native-durability-independent.json
```

## Safari/iOS: procedimiento listo para ejecutar

Utilizar Safari normal actualizado, **un perfil nuevo de prueba, no navegación privada**, y anotar versión completa de Safari/macOS o iOS, dispositivo y origen. Servir esta página con `python3 -m http.server 8080 --directory app/scripts`; en iOS usar el mismo host/origen accesible durante toda la prueba. El UUID tiene respaldo local para HTTP en red local.

1. Abrir `webstorage-durability-repro.html`, pulsar A, esperar aproximadamente 1,7 s, pulsar B y exportar las observaciones antes de cada operación. Conservar el JSON B esperado fuera del navegador.
2. Por separado, recargar, cerrar/reabrir la pestaña y salir/reabrir Safari normalmente, manteniendo origen y perfil. Pulsar **Leer**, nunca A ni B. Repetir tres veces con perfiles sintéticos separados. Registrar cada fallo, no sólo la última ejecución.
3. En otro perfil sintético, repetir con cierre abrupto/terminación del proceso del navegador inmediatamente después de B. En macOS, copiar antes y después el contenedor completo de ese perfil **sin modificarlo**, incluidos SQLite/WAL/SHM, y consultar una copia con el lector. Identificar el proceso y distinguir salir normalmente de forzar salida. En iOS, forzar cierre no acredita la señal exacta del NetworkProcess: registrar ese límite.
4. Nihon en ese mismo navegador soportado, con datos sintéticos: guardar Ghibli, verificar corazón activo, recargar y cerrar/reabrir normalmente; repetir también tras la confirmación interna (>2,5 s, condición del experimento, nunca remedio). Mantener copia del perfil y exportación de respaldo; no borrar ni resembrar el caso fallido.

**Qué resolvería la incertidumbre:** una pérdida de B en recorrido normal de Safari/iOS, con mismo perfil/origen/UUID y sin escrituras A posteriores, demostraría alcance fuera del runtime WPE. Conservación normal repetida más una reproducción nativa estrictamente limitada a muerte abrupta delimitaría el riesgo observado, sin prometer inmunidad frente a futuras caídas. Para atribuir el caso 4 exclusivamente a un defecto de WPE aún falta una causa de terminación del NetworkProcess o una diferencia causal reproducible respecto del runtime soportado; verdes nuevos no reconstruyen su salida histórica.

## Conclusiones separadas

La corrección del arnés móvil P-06 se mantiene validada por el contrafactual del Web Lock y las regresiones ya publicadas. El fallo móvil histórico sin traza sigue sin atribución. El riesgo de conservación se resuelve únicamente con los resultados de esta hipótesis y su alcance; las ejecuciones verdes anteriores no explican un fallo histórico.

Los resultados y el SHA exacto se publican en el informe del PR; esta nota define el experimento antes de su ejecución. No se introduce otra capa de almacenamiento, retrasos, reintentos ni cambios de clasificación.

La CI automática de `72636d3` conserva otro incumplimiento H03 bajo RESET, caso 9 sin carga, distinto del caso 9 histórico del run `37699345002`. La instrumentación observó únicamente dos `setItem` canónicos: A y luego B; ninguna escritura/eliminación canónica posterior a B. El diario de sesión se eliminó a los 2,507 s de B tras lecturas del documento antiguo. NetworkProcess 7985 fue sustituido por 8086; el documento nuevo, las tres copias físicas y el proceso nuevo sobre el mismo perfil contienen A. El arnés no terminó ese NetworkProcess. El cierre normal del contexto ocurrió después del fallo. Se conserva `72636d3-case9-write-not-conserved.json` con perfil, inode, valores, hashes, escrituras y documentos/PIDs; la señal de terminación del hijo sigue sin registrarse. Esta observación estrecha la atribución de las escrituras del producto, pero no convierte SIGKILL en explicación retrospectiva de ese reemplazo espontáneo.

## Comprobaciones finales dirigidas, sin otra batería manual

`d26ffe0` terminó P-06 completo en ambos motores, pero esto no explica el fallo `retry-queued-retained-events-invalid` de `72636d3` (32/33, exportación aceptada). Se añaden **24 casos independientes del mismo contrato**, conservando los 400 ms y las aserciones originales. Las lecturas TK y escrituras de ambas pestañas, el documento nuevo sin initScript/semilla/Nihon, el diario pendiente y `storageState` se capturan después de las observaciones originales que deciden el resultado. Los contextos privados no se presentan como perfiles físicos durables. Cada fallo mantiene rojo el job; las repeticiones son muestras predefinidas, no reintentos hasta verde.

El contrafactual `webstorage-lock-order-check.mjs` utiliza exclusivamente Web Storage y Web Locks, con la misma publicación mientras el lock está retenido, el turno `setTimeout(0)` existente y la lectura tras 400 ms. No escribe desde el receptor. Una lectura A dentro del lock después de la publicación B demostraría que ese orden de APIs no establece la visibilidad requerida en el runtime. Si no ocurre, no atribuye retrospectivamente el fallo a Nihon ni al motor.

También se intenta Safari ordinario por Apple Events en un runner macOS **nuevo y vacío**, porque la limitación de perfiles de WebDriver no prueba que toda capacidad alternativa esté ausente. `webstorage-safari-ordinary.py` rechaza ejecutarse fuera de CI, registra preferencias/permisos y conserva los directorios de WebKit antes/después del cierre normal y ante cualquier error. No altera TCC, no fuerza la terminación de Safari ni limpia perfiles. Si Apple Events está denegado, ese error acredita la dependencia externa concreta. La eventual interacción DOM de Nihon se identifica como tal, sin presentarla como un gesto físico de usuario. El inventario de simuladores no acredita un dispositivo iOS real. Los resultados están en el informe final de los PRs.
