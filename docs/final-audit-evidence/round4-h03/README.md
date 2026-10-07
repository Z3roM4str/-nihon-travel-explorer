# H03: investigación del bloqueo residual

El fallo original es WebKit `OrderedSequenceBuilder @390 [proxy-reset]` en
`acb38425fdd2902ff701358e92d04d935e33b6a1`, CI `37567604510`.
No se guardaron los valores antes/después de aquella aserción. Se conserva su
fallo; las ejecuciones verdes posteriores no explican su causa.

Entre ese commit y `5f3b3021a95ec39a11af5600954e96a0c3bdd790` no hay cambios en
`app/src/` ni en el lockfile. El árbol de producto sigue siendo
`bf880b5a72ec9cf1c40c26725ab28688465e32bc`. Cambian evidencia/documentación,
diagnósticos del gate y un probe previo de CI. Hubo instrumentación que escribía
trazas en sessionStorage y lecturas adicionales; 5f las separó del gate ordinario
y volvió a una lectura para el veredicto. Esto puede cambiar el tiempo de una
carrera, pero no demuestra el mecanismo del fallo original.

`app/scripts/h03-conservation-investigation.mjs` extrae el gate de cada SHA exacto
con `git show` y exige que el árbol del producto coincida con HEAD. Sirve la build
actual sin cambiar el producto. Conserva literalmente las aserciones y esperas;
verifica sus firmas antes de ejecutar. Sustituye sólo el bucle final por casos
dirigidos, alternando un control sin wrappers cada tres casos. El primer recorrido
H01/H02/H04/X es opcional para reproducir el preámbulo del gate que falló.

Las llamadas Storage existentes devuelven sus valores/errores originales. Sus
argumentos y resultados se envían por consola a Node: no hay lecturas adicionales,
escrituras de trazas en la página, bindings esperados ni demoras añadidas. También
se registran el botón que recibió el clic, identidad visible y atributos de UI,
sin lecturas que fuercen layout. La instrumentación tiene coste; por eso se
intercalan controles. Node escribe `external-trace.ndjson`, fuera de la página,
con lecturas reales del gate, llamadas nativas, copias pendientes, documentos,
navegaciones, fases y veredictos. Sobrevive a la recarga y al cierre del contexto.
Sólo después de un veredicto fallido se permite una lectura independiente en una
página sin producto del mismo origen; nunca convierte el fallo en éxito.

La carga consiste en hasta dos workers Node con ciclos de 20 ms ocupados y 10 ms
de cesión. No cambia las esperas de 700 ms/8 s del gate ni su servidor de reset
real. La matriz compara los gates acb/5f, con/sin carga, 24 casos por combinación
(8 controles y 16 observados). Cualquier aserción fallida conserva su resultado y
hace fallar el job. No se certifica Safari físico.

Reproducción en Ubuntu con WebKit instalado mediante Playwright del lockfile:

```sh
git fetch --no-tags --depth=1 origin acb38425fdd2902ff701358e92d04d935e33b6a1 5f3b3021a95ec39a11af5600954e96a0c3bdd790
cd app
npm ci
npx playwright install --with-deps webkit
npm run build
NIHON_BROWSER=webkit NIHON_GATE_REF=acb38425fdd2902ff701358e92d04d935e33b6a1 NIHON_H03_LOAD=1 NIHON_H03_REPETITIONS=24 NIHON_H03_PRIMER=1 NIHON_EVIDENCE_OUT=/tmp/h03-acb-load node scripts/h03-conservation-investigation.mjs
```

La procedencia incluye HEAD, SHA del gate, árbol del producto, hashes del original
y observado, coste/controles y estado del checkout antes de crear la evidencia.
El primer runner midió `dirty` después de crear sus archivos de salida y temporal;
por eso ese campo es true incluso en los checkouts CI. No hubo modificaciones al
producto: el árbol exacto se comprobó antes de ejecutar. El siguiente runner mide
`dirtyBeforeEvidence` antes de crear archivos.

## Reproducción capturada

SHA `f4fcf77e9f6561ed0874bec642f41e1c4ca97044`, CI
[37581466930](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37581466930),
24 escenarios por combinación, 96 en total. Se repitió la pérdida del interés:
acb/sin carga, caso 16 (control); 5f/sin carga, caso 19 (control); 5f/con carga,
casos 3, 11 y 15 (observados). En 5f/con carga hubo además dos timeouts de recarga
que no se consideran pérdidas de interés ni se convierten en éxito. acb/con carga
pasó todos sus casos. Los fallos mantienen las aserciones originales.

Las lecturas originales anteriores al reset y a la recarga contienen JP-044.
Después: null en acb/caso 16; documento vacío con IDs nuevos en los otros cuatro.
La página independiente del mismo origen lee también esos valores. En 5f tampoco
se recuperan tras la lectura diagnóstica de un segundo. En los tres casos
observados, la secuencia nativa muestra que las primeras lecturas tras recargar
devuelven null; luego el Store escribe el documento inicial vacío. No se observa
un removeItem del documento canónico. La copia pendiente ya se había eliminado
tras confirmar la escritura, antes de recargar. El clic sí llegó a Ghibli y a la
persona que tenía la postura persistida. Esto descarta seleccionar otro interés
en estos casos; no identifica todavía el origen de la ausencia nativa.

Se añade un contrafactual sin React ni código de Nihon: Storage nativo, reset
real, refresh y reload, con perfiles efímeros/persistentes y con una página del
mismo origen mantenida abierta. No cambia el gate original. Su resultado y los
diagnósticos del proceso WebKit deben distinguir el tramo del motor antes de
atribuir el defecto al producto o al test. Mientras no se cierre ese mecanismo,
**sigue el bloqueo de H03: sin merge ni deployment**.

En `dbaa7c148fb6efcab78aa6647a3dd506059411b1`, CI `37582779905`, el modo
buffered (memoria JS drenada por la llamada existente del gate y al pagehide,
sin Storage adicional) no repitió la pérdida del interés en sus 96 casos.
Hubo dos timeouts de recarga en los controles bajo carga. El contrafactual sin
Nihon pasó 48/48 sin carga; con carga tuvo un timeout y 47/48 éxitos, **ninguna
pérdida de Storage observada**. Por tanto no prueba la causa de los cinco casos
anteriores. stderr del gate 5f/con carga muestra aserciones GLib/libsoup y
`WebKit encountered an internal error. This is a WebKit bug` en el timeout.
No se extrapola ese diagnóstico a una pérdida no capturada con stderr.

La ejecución siguiente vuelve al modo console que capturó las pérdidas y añade
stderr `pw:browser`, claves de siembra y llamadas clear. Mantiene las aserciones,
tiempos originales y controles. Es una comparación de modos de observación, no
una corrección del producto ni una ampliación de esperas para conseguir verde.

En `af805765aba4cddffa2ca8dae33b4a4433b9871a`, CI `37583611131`, se repiten dos
pérdidas con el gate acb/sin carga (casos 11 observado y 19 control); además un
timeout. El gate 5f/con carga tuvo un timeout y un aviso no visible dentro de los
700 ms originales, no pérdidas confirmadas. Los otros dos gates y los 96
contrafactuales sin Nihon pasaron. En el caso 11 las lecturas previas contienen
JP-044; tras recarga las primeras llamadas nativas retornan null y luego se
escribe un documento vacío. Coinciden errores internos WebKit/libsoup antes de
la navegación. Esa coincidencia **no demuestra todavía un reinicio del proceso
de red**: el timer de carga interna tiene más de un origen. Se añade observación
de PID/PPid/comm desde `/proc`, fuera de la página, en fases ya existentes. Nunca
se leen command lines ni credenciales. Se cierran contextos/proxies abandonados
tras una excepción, después del veredicto, para aislar las siguientes repeticiones.

La primera observación de procesos (`8a39d60`) sólo capturó MiniBrowser: los
nombres de thread/comm de los hijos no coincidían con el filtro. Eso **no prueba
continuidad del proceso de red**. Se corrige el observador para incluir PID/PPid,
comm y basename del ejecutable, sin leer argumentos ni rutas completas. En esa
ejecución, con cleanup tras excepciones, 5f/sin carga vuelve a perder JP-044 en
los casos 2 y 3 observados; acb/sin carga en 16 control y 18 observado. El tramo
pendiente sigue siendo el mismo: ausencia nativa antes de la inicialización.

## Reinicio nativo observado en un fallo real

En el SHA `95319f2f13e1e431dae45720d8228e8ab1e4c1b6`, CI
[37585430837](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37585430837),
el gate exacto 5f, con carga, caso 14 observado, repitió la pérdida. Antes del
reset/recarga, `WPENetworkProcess` era PID 7197; después era 7263, mientras
`WPEWebProcess` seguía siendo 7199 y su proceso padre 5369 no cambió. La primera
lectura nativa del documento canónico tras recargar devuelve null; después Nihon
crea viajeros nuevos sin intereses. La lectura estricta, al segundo y en otra
página sin Nihon del mismo origen (nuevo WebProcess 7280) leen ese documento vacío.
No se observa un clear/remove del documento canónico. La copia pendiente ya estaba
confirmada y retirada antes del reset; el interés anterior pertenecía a la persona
visible en el clic. La evidencia descarta una UI obsoleta o una simple lectura
prematura en este caso. No basta el mensaje genérico del inspector: aquí hay
continuidad/discontinuidad de PID fuera del navegador.

Evidencia compacta:
[cronología](process-restart-chronology.json) y
[traza completa del caso](failure-process-5f-load1-case14.ndjson).
ZIP descargado y SHA-256 verificado: artefacto `11465529711`,
`9c74dc0fe07d78dcf4b625def79f6c6e5adfad3ed48cebb390b6bcfce624ad41`.
El fallo histórico original no tenía esta instrumentación; se demuestra el
mecanismo de esta reproducción actual, sin inventar mediciones del original.

Un probe adicional mata exclusivamente el NetworkProcess nuevo de un perfil
sintético, sin Nihon/React/wrappers, y contrasta un contexto efímero con una
preimagen durable de un perfil persistente. Registra los errores de navegación
inicial y lee después mediante una página independiente. Esto es un experimento
causal separado: no introduce reintentos ni demoras en H03. La primera versión
`3fbcff2` no obtuvo lecturas después de matar el proceso (la navegación fallaba;
un selector erróneo también hacía expirar la página estática). Se conserva ese
resultado; no se presenta como evidencia de conservación ni pérdida del Storage.

## Causa demostrada y ajuste del fixture

El contrafactual corregido, SHA `b688fd9dcfaa044ae081819291287f2e77473dd6`, CI
[37587349003](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37587349003),
obtuvo lecturas: en cada uno de dos runners, **3/3** contextos efímeros pierden
el documento (null) y **3/3** perfiles persistentes conservan sus bytes exactos
tras el cambio de PID. Sin código de producto, sin remove/clear ni un segundo
setItem. La preimagen persistente se estableció y cerró antes de iniciar el
experimento, para no asumir que una transacción recién iniciada sobrevivió a
SIGKILL. Contratos completos:
[nativo 1](native-restart-contract-load0.json),
[nativo 2](native-restart-contract-repetition.json).
Los dos contratos de ese SHA no tenían workers de carga activos (el segundo
runner sólo ejecutó previamente el probe de reset bajo carga). La regresión
actual sí aplica la misma carga a ambos experimentos según su matriz.
ZIPs verificados: `11467146745` / SHA-256
`ab147d3697901a022825ebdc09c45e70e495b979f82004edc7d2094553e2d296`;
`11467537093` /
`5a77c3d5eab9d082a56d3bd1e9d922e9e1d6e77c963ec7eeb2370425b4c5d3e5`.

El contexto privado de Playwright/WPE mantiene localStorage en memoria del
NetworkProcess. Su reinicio borra ese backend; no equivale a la conservación
de un perfil normal respaldado por disco. Es un defecto del fixture para ese
contrato de conservación. No se arregla Nihon restaurando ciegamente una copia
de datos después de perder todo el almacenamiento nativo.

Sólo H03/WebKit usa ahora `launchPersistentContext` con un directorio temporal
nuevo por caso, eliminado al cerrar. Misma sesión/perfil antes y después,
sin replay de storageState, reimportación ni recarga adicional. Chromium y los
otros gates conservan sus contextos. Las aserciones reset/503, lectura única,
700 ms, 8 s y timeout de chunks permanecen idénticos a 5f:
[firmas verificadas](strict-gate-signatures.json). El árbol de `app/src/` no cambia.

La regresión duradera ejecuta el gate del HEAD exacto: 24 resets reales a 390 px
sin carga y 24 con carga, alternando controles e instrumentación. Sigue rechazando
cada fallo estricto; no son repeticiones hasta obtener verde. La matriz causal
complementaria registra reinicios nativos deliberados, separada de H03 real.
Los gates históricos acb/5f pueden repetirse con el comando anterior; sus fallos
se mantienen en evidencia, sin seguir certificando un SHA histórico como HEAD.

Diagnóstico de esta reproducción cerrado; la certificación final corresponde
al SHA y artefactos que se indican en la descripción del PR/informe. Cualquier
fallo nuevo de recuperación o conservación mantiene el bloqueo. WebKit/WPE CI
no certifica Safari físico ni resistencia universal a corrupción del disco.
