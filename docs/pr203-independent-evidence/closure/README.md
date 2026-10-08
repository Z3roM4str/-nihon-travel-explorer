# Continuación independiente de H03

La auditoría de `docs/PR203_INDEPENDENT_H03_AUDIT.md` describe el HEAD original `6a87a7f`. Esta continuación publica la corrección recuperada `4829781` en el [PR #204](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/204), dirigido a la rama de Claude. El veredicto actualizado y los enlaces del candidato final se registran en ese PR.

## Primera ejecución de la continuación

Candidato `4e29737b38dd7d9ae3791f318618bc207a10d4af`, [Actions 37714147665](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37714147665). Árbol de `app/src`: `bf880b5a72ec9cf1c40c26725ab28688465e32bc`, idéntico al producto del PR #203.

- `4e29737-native-restart.json`: resultado íntegro de los dos contrafactuales de reinicio. Sin Nihon, sin mocks. Seis perfiles persistentes con una escritura de 25 s conservan JP-044 antes/después del reinicio y al abrir el mismo perfil desde otro proceso; seis controles efímeros pierden su backend, como espera ese contrato. El RESET nativo también pasa 48/48 con cada nivel de carga.
- `4e29737-independent-sqlite-readings.json`: lectura separada de las 18 bases SQLite descargadas. JP-044 está en todas. Las tres imágenes por perfil tienen exactamente el mismo valor canónico.
- `4e29737-stress-summary.json`: recuentos, hashes de los ZIP, procedencia y fallo conservado. Sin carga: 200 OK, 1 FAIL (caso 13), sin excepciones parciales. Con carga: 202 OK, 0 FAIL, dos diagnósticos de solicitud perdida. El caso 13 conserva JP-044 en la API, en SQLite antes/después del cierre y en otro proceso. No acredita la solicitud de navegación; permanece rojo.

El lector automático del perfil del caso 13 informó un error de URI relativa. No se confunde con ausencia de datos: las copias estaban presentes, se leyeron independientemente en modo de sólo lectura y contienen el original exacto. La corrección convierte la ruta de la copia a absoluta. Las aserciones de H03 no cambian.

## Hipótesis restante y prueba acotada

El contrafactual de 25 s no distingue si un reinicio **anterior** a ese plazo interrumpió el asentamiento de una escritura de los casos históricos 1/9/19. Sus perfiles fueron borrados por el arnés original; no es posible recuperar retrospectivamente sus bytes.

La siguiente ejecución incluye sólo tres edades de escritura: 700 ms, 3 s y 25 s, tres perfiles por edad y nivel de carga. Cada uno parte de un checkpoint asentado **sin** JP-044 y escribe el interés sin cerrar; conserva las imágenes del perfil antes del reinicio, después y tras el cierre, y lo abre de nuevo sin scripts ni siembra. Registra la edad efectiva al matar únicamente el NetworkProcess sintético inequívoco. Una regresión seguirá siendo roja. Esto puede separar una transacción reciente no asentada de una lectura obsoleta o una regresión del producto; no modifica los tiempos ni los reintentos del gate.

La matriz de estrés conserva el fallo original antes de inspeccionar el perfil. Los experimentos de 1220 resultados ya concluyentes no se repiten. No se modifica el producto, main, Astra ni Vercel.
