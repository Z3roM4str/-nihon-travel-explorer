# Ronda 3 — cinco hallazgos bloqueantes de persistencia

## Procedencia y reproducción anterior a la corrección

Se recuperaron los **scripts originales de Codex**, sin reconstruir los fixtures. Están en
[`baseline/scripts/`](baseline/scripts/). Se ejecutaron antes de modificar el producto, sobre
`d26d86ba183fe9c23a06a21720e6a7450a637345`, en un checkout aislado de la rama Claude.
Los datos son sintéticos, los perfiles son `browser.newContext()` desechables, y sólo se usa localhost.

- [`baseline/independent-results.json`](baseline/independent-results.json): **6 pasan y 8 fallan**;
  [`independent.log`](baseline/independent.log) conserva la salida original.
- [`baseline/production-retry.json`](baseline/production-retry.json): también falla el botón real
  «Reintentar» sobre la build de ese SHA: la protección futura se ve antes del clic y el original se sustituye.
- Para repetir la base: checkout de ese SHA en otro directorio, `npm ci && npm run build` en `app/`,
  copiar los cuatro archivos de `baseline/scripts/` a ese `app/`, iniciar Vite en 127.0.0.1:4301,
  ejecutar `node pr203-independent-check.mjs` y `node pr203-production-retry-check.mjs`.
  Los scripts originales requieren `/usr/bin/chromium`; el segundo inicia su preview en 4302.

| Hallazgo | Fixture de Codex | Resultado antes |
|---|---|---|
| Reintento viejo | `retry-clobbers-other-tab-and-export`, `retry-overwrites-protected-future` | JP-077 desaparece aunque la exportación dice éxito; una versión 2 se sobrescribe |
| Cola protegida | `queued-write-protection-invalid/future` | ambos originales sobrescritos tras liberar el lock |
| Linaje lleno | `lineage-full-drops-missing-operation`, `pending-replay-inclusion-full` | 2 días en vez de 3 (pérdida); 3 en vez de 2 (duplicación) |
| Rollback | `failed-restore-retry-applies-partial-import` | rollback declarado satisfactorio; reintento mezcla viajeros anteriores con fecha importada |
| Persona vista | `stale-active-traveller-attribution` | vista p1, interés atribuido a p2 |

## Regresiones duraderas y diferencias documentadas

`app/scripts/final-audit-persistence-regressions-check.mjs` conserva los 14 escenarios y sus
aserciones de contenido. Añade otras 19 ventanas que los gates ordinarios no cubrían: reintento
encolado con eventos retenidos + inválido/futuro; historia desconocida llena/ausente/malformada
que sigue conflictiva tras recarga y otra escritura externa; persona eliminada al pedir o ejecutar;
quitar interés atribuido a la persona vista; rollback satisfactorio tras recarga; rollback incompleto
con preimagen conservada; lock rechazado; parada cuyo día desapareció mientras esperaba;
zonas y planificador compartiendo cola; error de lectura protegido; inicialización del borrador tras
restaurar un respaldo cuyo itinerario es null (viajeros vigentes en lugar de la lista anterior de React); segunda restauración fallida conservando la primera preimagen; fallo de
copia de sesión antes de importar sin dejar un bloqueo de una importación que no empezó; recuperación del acceso sin escribir un documento que ya está al día.

Diferencias respecto del script original:

- Gestiona su propio Vite y admite Chromium/WebKit; el fixture vive en `scripts/fixtures/` e importa
  los módulos reales del producto. Mismos datos y aislamiento; no se simula la implementación.
- Espera los resultados **asíncronos** de reintento, importación y exportación. Evita interpretar una
  promesa como un éxito o leer antes de que el bloqueo termine.
- Recarga con lock retenido: además de exigir finalmente 2 días, comprueba 1 día en almacenamiento
  mientras el lock sigue retenido y 2 en la copia visible recuperada. La base escribía al cerrar
  saltándose el lock: su aserción original más débil pasaba, pero no acreditaba exclusión.
- H03 timeout conserva los límites originales: mínimo 2,9 s y máximo 5 s, incluyendo la recarga
  del fixture; comprueba además la copia visible y los datos almacenados después de liberar el lock.
  **No modifica** el producto H03 ni las 35 aserciones estrictas reset/503 de
  `final-audit-data-recovery-check`. Al cerrar esta ronda se retiró una ampliación intermedia a 7 s;
  la validación final usa el límite original.
- B30 espera la escritura de la elección de zona (ahora diferida por el mismo diario). Sigue exigiendo
  **exactamente una** escritura canónica; el registro conserva ambas APIs y se comprueba aparte que las
  copias de sesión sólo usan la clave de recuperación del borrador. Conserva todas las aserciones de contenido, identidad y recarga.
- Añade `dirty` a la evidencia: un resultado local con cambios sin commit nunca certifica su HEAD
  como si esos cambios pertenecieran a ese SHA.
- Tests de fuente ajustados a ids capturados y al escritor compartido; el contrato unitario viejo que
  exigía reescribir el payload fallido se sustituye por CAS de preferencias y delegación del documento
  canónico. Se añaden pruebas de comportamiento de segunda clasificación, reintento reconciliado,
  rechazo de lock, no doble ejecución, copia ilegible y snapshot de recarga con base cambiada.

Ejecución corregida, desde `app/`:

```sh
npm ci
npm test
npm run build
NIHON_CHROMIUM_PATH=/usr/bin/chromium scripts/p06-v2-certify.sh chromium
# En un runner autorizado con WebKit instalado:
scripts/p06-v2-certify.sh webkit
```

El nuevo gate está incluido en ambas ramas de la matriz CI, junto con los gates de pestañas obsoletas,
exportación protegida y H03 existentes. Cada artefacto lleva SHA y navegador, log por gate y JSON con
los 33 resultados dirigidos. El workflow comprueba el **HEAD del PR**, no su merge sintético, y ejecuta
Vitest antes de la certificación. Los resultados exactos están en la sección de certificación inferior.

La variante con itinerario null se añadió al revisar todos los caminos de restauración: falló en
la primera corrección (`86e8dfb`, con fixture añadido, `dirty=true`), dejando una ruta vacía al podar
la lista anterior; tras crear el borrador con los viajeros vigentes conserva JP-021. Las salidas
antes/después se conservan junto a la evidencia de esta ronda. No altera los 14 fixtures originales.

Dos variantes adicionales de preimagen fallaron sobre `f548570` con sólo el fixture añadido:
un segundo rollback satisfactorio borraba la copia de la primera restauración incompleta, y una
denegación al guardar la copia impedía incluso un interés posterior aunque la importación nunca
hubiese empezado. La copia inicial y la de cada intento ahora se mantienen aparte (dos claves
acotadas, sin anidar historias); el rollback sólo cancela su intento, y un fallo previo a empezar
no deja un bloqueo falso. Evidencia antes/después en `supplemental/preimage-*.log`.

El primer CI de `c5ba08e` pasó todos los gates en Chromium. En WebKit pasó el resto de la matriz,
H03 69/69 (35 reset/503 estrictas y 24 diagnósticos de inspector) y 30/31 regresiones. El fixture
fallido de lock rechazado asignaba directamente `navigator.locks.request` sin verificar que se
usara ese reemplazo: WebKit no registró rechazos y escribió usando su API nativa. La inyección
ahora parchea el prototipo de `LockManager` (corrección de Claude `8952d18`), comprueba la identidad del método y el contador de llamadas,
y vacía las tareas de arranque antes de instalarla. Se conservan todas las aserciones de protección,
rechazo de exportación y explicación, sin aceptar una inyección ineficaz. La matriz final las supera.

El primer CI omitió tres pruebas históricas de D5 porque su checkout era shallow y carecía de la base histórica
`b854db3`; las tres pasan en el checkout local completo. No son pruebas de persistencia: todas las
nuevas pruebas de contrato y navegador se ejecutaron. En ese CI: 3449 pasan y 3 omitidas. El workflow corregido obtiene **sólo** esos dos SHA (ambos antecesores de la base declarada), con fetch de profundidad 1 y sin recuperar otras ramas ni cambiar HEAD, para ejecutar los tres contratos. Con las dos regresiones de invalidación de caché: **3455/3455** en local y ambos jobs finales, sin omisiones.

La recuperación tras un lock rechazado también se probó: cuando otro documento no tenía cambios,
su aviso anterior seguía bloqueando la exportación aun después de recuperar el acceso. El nuevo
caso falla sobre `c5ba08e` y pasa al retirar el problema tras una lectura segura bajo lock, **sin
escribir** ese documento. La exportación exitosa retira también su aviso transitorio. Se incluyen
una regresión de navegador y otra de contrato; evidencia en `supplemental/noop-*.log`.

## Ventana de caché de WebKit detectada durante la validación

El CI de `6166c47` pasó Chromium completo, pero en WebKit una cola sustituyó un documento futuro
(31/32 regresiones). No se aceptó una repetición verde como solución. Sobre `363e5b0` —mismo producto,
sólo instrumentación— doce repeticiones y trazas nativas reprodujeron una sobrescritura real de un
inválido: el publicador lo releyó a las `1791342833093`; la pestaña en cola releyó tres veces su
caché válida a +2/+4 ms y ejecutó `setItem` a +4 ms. Ambas pestañas leyeron después el payload
incorrecto. Evidencia exacta en `supplemental/queue-probe-webkit-363e5b0/` y el primer fallo en
`supplemental/webkit-6166c47-attempt1/`. La concesión de Web Locks no basta para que esa caché ya
haya procesado la invalidación de otro proceso.

`storage-lock.ts` cede una tarea **manteniendo el mismo lock** antes de ejecutar cualquier lectura,
clasificación o escritura. Así cubre también reintentos, exportación, importación y reinicio. Dos
contratos con invalidación pendiente fallan antes (2 fallan, 7 pasan) y pasan después (9/9); registros
`cache-before.log` y `cache-after.log`. La nueva regresión repetida se añade a las originales; no
cambia sus 450 ms ni oculta eventos, y exige original exacto desde **ambas** pestañas, publicación
releída y **cero setItem** sobre el documento protegido. CI publica inmediatamente estas trazas
antes de la matriz completa. El CI final de `4117e72` supera las 14 ventanas iniciales y las 14
del gate completo por motor con cero escrituras protegidas.

## Certificación exacta del producto corregido

- SHA: **`4117e72c605656d24dbe7b25995c00cb1a84ef24`**; árbol `app/`:
  `6f6bbda6cc6fb903a662f5da29ca99ab767ca668`; árbol `app/src/`:
  `bf880b5a72ec9cf1c40c26725ab28688465e32bc`.
- [CI 37566049602](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37566049602),
  intento 1, resultado **success**, ambos jobs verifican ese HEAD real:
  [Chromium 112613958853](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37566049602/job/112613958853),
  [WebKit 112613958686](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37566049602/job/112613958686).
- **33/33** regresiones de contenido por motor, `dirty=false`. Prueba dirigida previa: **14/14**
  publicaciones protegidas por motor, leídas desde ambas pestañas y sin ningún `setItem` de la cola.
  Misma comprobación repetida en el gate completo. Pestañas obsoletas y exportación: **16/16** cada
  gate y motor. B30: **484/484**. Todos los gates en `summary.txt`: `rc=0`, `RESULT fail=0`.
- **3455/3455**, 121 archivos, **sin omisiones**, tanto localmente como en ambos jobs;
  `job-contracts.txt` conserva SHA, versiones y conteo del runner. Build correcta; lint local sin
  errores y con el aviso heredado de `PlaceMap`.
- H03: **93/93 Chromium**; **69/69 WebKit**, con **35/35 estrictas reset/503** y **24/24 diagnósticos
  del inspector**, 0 `DIAG-FAIL`, 0 cobertura parcial. WebKit Playwright **26.5**. Los resultados y
  diagnósticos son grupos distintos en el JSON. El timeout adicional midió 3124/3128 ms, cumpliendo
  2,9–5 s. La publicación de cierre restituye la aserción máxima original de 5 s y conserva el
  producto; su SHA y CI se verifican también en la descripción del PR y el informe final.
- [`failure-to-pass.json`](failure-to-pass.json) compara cada uno de los 14 originales con ambos
  motores corregidos (los ocho fallos originales pasan). [`ci/provenance.json`](ci/provenance.json)
  registra SHA, árboles, jobs, artefactos y digest SHA-256; el hash de cada ZIP descargado se verificó.
  [`ci/chromium/summary.txt`](ci/chromium/summary.txt) y [`ci/webkit/summary.txt`](ci/webkit/summary.txt)
  resumen la matriz; logs y JSON detallados en las mismas carpetas. [`local/provenance.json`](local/provenance.json)
  registra la ejecución local limpia y aislada, con botón real en la build final (`production-retry.json`).
- La matriz local inicial falló en B30 y tuvo un H03 interrumpido por otra build; no se presenta como
  verde. Las repeticiones corregidas y estables son suplementos; la matriz completa certificada es
  el CI exacto. Los CI intermedios de `c5ba08e` y `6166c47`, y las trazas fallidas de `363e5b0`, están
  separados bajo `supplemental/` para no certificar el SHA anterior con datos posteriores.

**Resultado histórico de `4117e72`: sin bloqueantes encontrados en aquella ejecución.**

## Validación posterior exacta y bloqueo residual H03

Código y gates probados: **`a8a97ba3ed311fb77288d6e7d5689b441be003a2`**. CI
[37569278763](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37569278763), intento 1:
Chromium y WebKit success. `ci-a8/` contiene salidas, JSON y resumen de cada gate, pruebas aisladas
previas y procedencia con SHA y hashes de los ZIP verificados. Las **33/33 regresiones**, **3455/3455
pruebas** sin omisiones y todos los gates pasan en ambos motores. Comparación de los 14 originales
contra estos resultados: [`failure-to-pass-a8.json`](failure-to-pass-a8.json).

El CI de cierre anterior `acb3842` había fallado la conservación del interés tras reset/recarga a
390 px en WebKit; su artefacto se mantiene en `supplemental/webkit-acb3842-attempt1/`. Los cambios
posteriores sólo instrumentan el gate y añaden la prueba H03 aislada al workflow: el producto H03 y
el árbol `app/src/` no cambian. No hay una corrección que explique ese cambio de resultado.

En `a8a97ba`, WebKit pasa H03 **35/35 estrictas + 24/24 diagnósticos** tanto aislado como en la matriz;
Chromium pasa **59/59** aislado y **93/93** completo. Los nueve escenarios por ejecución conservan
exactamente los mismos bytes antes, tras la recarga y 250 ms después; hay trazas nativas de los
valores completos de `getItem` y `setItem`. Las aserciones estrictas y el criterio de misma sesión
permanecen intactos. Las lecturas tardías son sólo diagnósticos: un fallo inicial seguiría fallando.
Timeout con cambios pendientes bajo lock: 3126 ms Chromium / 3131 ms WebKit; mínimo 2,9 s y máximo
5 s originales intactos. Ninguno de estos resultados identifica la causa del fallo anterior.

**Cinco hallazgos corregidos; integración aún bloqueada por H03 sin diagnóstico concluyente.**
El verde posterior no convierte la observación anterior en una pérdida descartada. Veredicto
conservador: **requiere correcciones / aclarar H03 antes de integrar**. Freeze mantenido.

La entrega separa además las dos modalidades H03: el paso previo CI activa
`NIHON_H03_NATIVE_TRACE=1`; la matriz ordinaria no instala los wrappers de Storage. Las 35
aserciones reset/503 permanecen iguales en ambas, y la primera lectura tras recarga es la única
que determina el veredicto. Su cadena completa queda en `evidence.h03Snapshots` sin una lectura
adicional antes de comprobar el interés. Sólo el modo con trazas espera 250 ms después de las
aserciones para añadir `evidence.h03Native`. El fallo estricto seguiría siendo fallo aunque una
lectura posterior recuperase el interés. No se presume que los wrappers carezcan de efecto
temporal: sólo conservan valores/resultados. Localmente ambos modos aprueban 59/59 en Chromium;
JSON y logs están en `supplemental/h03-modes-local/` (modificaciones sólo del gate; sin atribuir
esta ejecución local previa al commit a su HEAD anterior). CI repite ambos sobre el SHA publicado.

## Límites

WebKit local no disponible: la descarga de sus binarios no está autorizada por la red del entorno;
se valida en GitHub Actions. WebKit de Playwright no certifica Safari físico. Sin Web Locks sólo
hay ejecución síncrona de mejor esfuerzo; las escrituras de versiones viejas u otros clientes que no
respeten el lock no constituyen una transacción. Si falta prueba de inclusión o ausencia, se bloquea
el cambio y se conservan ambas copias. `_w` sigue acotado a 96; los ids de intentos permanecen en el
diario hasta confirmación o conflicto. `sessionStorage` conserva trabajo entre recargas de la misma
pestaña, no promete supervivencia al cierre definitivo ni ante cuota/denegación de esa API. El
archivo de datos conservados incluye cadenas originales y copias pendientes, y no afirma que sean
un respaldo portable restaurable. No se toca ningún perfil, dato existente, dataset ni Vercel.
