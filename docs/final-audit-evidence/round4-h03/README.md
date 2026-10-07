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
