# Auditoría final independiente (2026-10-06) — correcciones H01–H07

**Base auditada:** `32787a1661665f53bba5dfcf73d630709a698ad2` (el árbol `app/` de `main` `52503a9` es idéntico).
**Rama:** `claude/final-audit-data-recovery-fixes-l60xs9` (la rama designada para la sesión).
**Alcance:** sólo fiabilidad; sin funcionalidades nuevas, sin cambios de datos (JP-126 queda como seguimiento), sin tocar Vercel,
Astra ni dependencias. Evidencia base/corregida en [`final-audit-evidence/`](final-audit-evidence/).

## Ronda 3 (2026-10-07): cierre de cinco hallazgos bloqueantes

**Los cinco hallazgos están corregidos; la integración continúa sin certificarse.** Validación
exacta del producto y de los gates instrumentados: `a8a97ba3ed311fb77288d6e7d5689b441be003a2`, CI
[37569278763](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37569278763), intento 1,
Chromium y WebKit **success**. Ambos ejecutaron **33/33 regresiones**, **3455/3455 pruebas** sin
omisiones, build y toda la matriz con `rc=0`. Evidencia descargada y ZIP verificados:
[ci-a8/provenance.json](final-audit-evidence/round3/ci-a8/provenance.json),
[failure-to-pass-a8.json](final-audit-evidence/round3/failure-to-pass-a8.json).

El CI anterior de `acb38425fdd2902ff701358e92d04d935e33b6a1` falló **una aserción estricta H03**:
interés guardado tras recarga con reset a 390 px (34/35 estrictas; 24/24 diagnósticos). Se conserva
íntegro en `round3/supplemental/webkit-acb3842-attempt1/`. El árbol `app/src/` es idéntico entre
`4117e72`, `acb3842` y `a8a97ba`; no se atribuye el verde posterior a una corrección de H03.
Las pruebas aislada y completa posteriores de WebKit aprobaron **35/35 estrictas** y **24/24
diagnósticos** cada una: las 18 recargas conservaron exactamente los bytes anteriores tanto en la
primera lectura como 250 ms después. El gate captura lecturas/escrituras nativas y conserva el
veredicto original; las esperas diagnósticas no convierten un fallo en éxito. Esas trazas no existen
para el fallo anterior: **no permiten distinguir una lectura transitoria de pérdida real ni conocer
su causa**. No se declara arreglado ni se certifica Safari físico.

Para conservar también la ejecución ordinaria de H03, las trazas nativas son ahora opt-in
(`NIHON_H03_NATIVE_TRACE=1`) sólo en el paso diagnóstico previo. La matriz completa mantiene las
llamadas nativas originales y una única lectura para la aserción tras recarga: una lectura extra
antes del veredicto podría refrescar una caché obsoleta. Guarda esa misma cadena para diagnóstico,
sin releer primero. Local Chromium: **59/59** aserciones en cada modalidad, nueve escenarios con
traza desactivada y nueve con traza activada. Se conserva el mínimo 2,9 s / máximo 5 s del timeout
adicional y las 35 aserciones reset/503. Instrumentar puede cambiar tiempos aunque devuelva los
mismos valores; las dos ejecuciones no se consideran equivalentes para descartar una carrera.
El resultado CI del SHA final y los dos modos se registra en la descripción del PR y sus artefactos.

**Veredicto de integración: requiere correcciones / diagnóstico concluyente de H03.** Los cinco
hallazgos solicitados tienen evidencia falla→pasa; el fallo estricto restante impide retirar el
bloqueo. Freeze vigente; sin merge, deployment, cambios de Vercel ni datos existentes.


La revisión independiente sobre **`d26d86ba183fe9c23a06a21720e6a7450a637345`** encontró cinco fallos.
Se recuperaron y ejecutaron los scripts de Codex antes de editar: **6/14 pasan, 8/14 fallan**; el botón
real de reintento también sobrescribe el futuro. Evidencia y diferencias de fixtures:
[round3/README.md](final-audit-evidence/round3/README.md). Esta sección sustituye las garantías y
limitaciones de persistencia de las rondas anteriores; H03 y sus aserciones estrictas permanecen intactos.

| Hallazgo | Causa y mecanismo | Corrección | Falla → pasa |
|---|---|---|---|
| 1. Reintento viejo | `device-storage.ts` guardaba una cadena fallida y `retryPersistence` la escribía directamente, borrando cambios externos o futuros. | El reintento canónico delega al diario propietario, adquiere **el mismo lock**, relee/clasifica y reconcilia la intención; sin propietario rechaza y conserva originales. Preferencias: CAS bajo lock. Error al adquirir lock no habilita un camino sin bloqueo; al recuperarlo se retira el aviso incluso sin una escritura nueva. | JP-077 perdido con exportación exitosa → JP-077 y JP-021 presentes en almacenamiento **y archivo leído**; futuro sustituido → bytes intactos. |
| 2. Cola protegida | `useStoredDocument.ts` comprobaba la protección antes de `sync()`, pero podía esperar y descubrir un documento protegido después. | La invalidación pendiente de la caché de WebKit se procesa cediendo una tarea sin soltar el lock; recomprueba **después de sync, dentro del lock y justo antes de setItem**; lecturas fallidas son `unreadable`, nunca ausencia. Exportación e importación adquieren ambos locks en orden estable; exportación clasifica también la lectura que usa para el archivo. | Inválido/futuro sobrescrito tras liberar lock y retener eventos → ambos intactos; reintento en esa misma ventana también protegido. |
| 3. Linaje 96 | La rama saturada daba por confirmada una operación ausente y dejaba repetir una pendiente incluida. | Inclusión positiva por **cualquier id de intento**, incluso lleno; sólo repone ausencia demostrable (historia completa o antecesor aún presente). Historia insuficiente: conflicto, ambas copias, sin descartar ni repetir. Ids de entidades capturados una vez, estables al reproducir. Un solo diario por clave/pestaña para todas las superficies, incluidas zonas. | Pérdida: 2 → 3 días. Duplicado: 3 → 2. Id anterior incluido sigue sin duplicarse; historia desconocida/ausente/malformada queda protegida también tras recarga. |
| 4. Rollback | Importación fallida dejaba en la cola de `device-storage` un payload importado aunque el rollback hubiese restituido viajeros y borrador. | Scope de importación cancela **sus** pendientes al rollback, preserva las previas. Preimagen de ambos documentos conservada antes de escribir. Rollback incompleto bloquea reintentos automáticos y exportación, conserva preimagen entre recargas. Restauración satisfactoria cancela el diario anterior inmediatamente. Segunda importación fallida conserva la primera preimagen incompleta; una copia fallida antes de empezar no deja un bloqueo falso. | Reintentar mezclaba viajeros anteriores con fecha importada → preimagen intacta al reintentar y recargar; rollback incompleto se declara y conserva. |
| 5. Persona vista | La intención guardar/quitar releía `activeTravellerId` de un estado posterior. | Captura **persona e intención vistas** al solicitar; guarda de existencia al pedir y reproducir. Si desapareció, rechaza con explicación. También quitar, postura explícita y deshacer respetan la identidad. | Vista p1, operación a p2 → operación a p1; desaparición mientras espera → sin atribuirla a p2 y aviso visible. |

**Producto certificado:** `4117e72c605656d24dbe7b25995c00cb1a84ef24`; árbol `app/src/`:
`bf880b5a72ec9cf1c40c26725ab28688465e32bc`. CI completo
[37566049602](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37566049602):
Chromium y WebKit **success**, checkout de ese SHA exacto. **33/33 regresiones por motor**,
**3455/3455 Vitest sin omisiones** en local y en ambos jobs; build correcta, lint local sin errores
(aviso heredado de `PlaceMap`). Todos los gates de la matriz tienen `rc=0`; pestañas obsoletas y
exportación protegida **16/16** cada uno, B30 **484/484**. La ejecución local inicial de la matriz tuvo
fallos y no se certifica como verde; sus repeticiones corregidas y el CI exacto quedan separados.

H03: Chromium **93/93**; WebKit **69/69**, con **35/35 estrictas reset/503** y **24/24 diagnósticos
del inspector** separados, 0 `DIAG-FAIL`, sin cobertura parcial. Timeout adicional medido:
3124 ms Chromium y 3128 ms WebKit, dentro de los límites originales 2,9–5 s. El cierre restituye
explícitamente el máximo original de 5 s en ese fixture; producto y gate estricto H03 intactos.
WebKit de Playwright **26.5**, sin certificación de Safari físico. Evidencia exacta, hashes de los ZIP,
logs por gate y comparación de los 14 escenarios originales:
[round3/README.md](final-audit-evidence/round3/README.md),
[failure-to-pass.json](final-audit-evidence/round3/failure-to-pass.json).

La validación descubrió otra ventana dentro del hallazgo 2: WebKit concedía el lock antes de procesar
la invalidación de caché. Se conservan el fallo de `6166c47` y las trazas de `363e5b0` (mismo producto),
con original publicado y tres lecturas antiguas seguidas de sobrescritura real 4 ms después.
El helper común cede una tarea sin liberar el lock antes de clasificar. Dos contratos fallan antes
y pasan después (9/9 del módulo); las 14 ventanas dirigidas y las 14 repetidas en el gate completo
por motor conservan ambos originales y registran **cero setItem** sobre ellos. No se ampliaron sus
450 ms ni se retiraron aserciones. El primer fallo de inyección de lock en WebKit también se conserva:
la inyección efectiva en el prototipo verifica identidad del método y seis rechazos, sin relajar el gate.

**Resultado histórico de `4117e72`: sin bloqueantes encontrados en aquella ejecución.** El veredicto
de integración vigente es el indicado al inicio: la observación posterior de H03 se mantiene abierta.

Caminos adicionales revisados: arranque/migración, mutación, verificación posterior, reintento,
exportación, importación/rollback, «Empezar de nuevo», desmontaje de superficies, `pagehide` y
recarga H03. Cierre/recarga conserva copia de sesión sin saltarse el lock. «Empezar de nuevo» relee
la protección tras esperar; una eliminación fallida no se convierte en un borrado futuro en cola.
Las copias originales pueden incluir el trabajo pendiente, separado del respaldo portable. Restaurar
un respaldo con itinerario null inicializa el borrador con los viajeros vigentes, evitando crear y
podar una ruta desde la preimagen de React (regresión adicional reproducida falla → pasa).

## Tabla H01–H07

| # | Causa confirmada | Corrección | Validación (base → corregido) |
|---|---|---|---|
| **H01** | Los hooks montados (`useTravellers`, `usePlanningDraft`) guardaban el documento en `useState` y lo reescribían entero tras cada cambio; una restauración escrita por debajo no los avisaba y la siguiente mutación (navegar y pulsar un corazón) escribía el viaje anterior encima. | `confirmImport` avisa a los hooks (`notifyStorageReplaced`) para que relean y rendericen lo restaurado; además cada mutación parte del documento vigente del almacenamiento (`useStoredDocument`). «Continuar» deja de ser la defensa. | `final-audit-data-recovery-check` H01: viajeros, intereses, itinerario, nuevo interés tras importar y recarga. Base falla 5/5 → 5/5 OK. |
| **H02** | La escritura reemplazaba el documento completo con la copia en memoria de la pestaña (confirmado igual para el itinerario). | Antes de aplicar cada mutación se compara la cadena almacenada con la última leída/escrita; si cambió, se relee y la operación se aplica **sobre el estado vigente** (estrategia: rehidratar y aplicar). Además se escucha `storage`. La escritura es síncrona (micro-tarea del mismo turno) con la mutación. Sin cuentas ni sincronización remota. | Intereses A+B conservan ambos; itinerario: añadir un día en cada pestaña → 3 días, parada y hotel intactos. Base falla (queda sólo JP-044; 2 días) → OK. |
| **H04** | Un único parser devolvía `null` para «no hay nada» y para «no lo entiendo»; el hook montaba el valor inicial y lo escribía encima (JSON roto, forma dañada, versión futura), y reconciliaba el borrador contra unos viajeros vacíos. | `lib/stored-document.ts` distingue `absent / valid / invalid / incompatible`. Inválido o futuro = **protegido**: no se escribe, el original se conserva tal cual, la app arranca con un valor en memoria y `StorageProtectionNotice` ofrece «Descargar copia» y «Empezar de nuevo» (confirmación; **copia previa de todo bajo `nihon.recovered.<instante>.<clave>`; si la copia falla no se borra nada**). Viajeros protegidos bloquean también el borrador (no se poda un itinerario válido). Importar un respaldo sobre datos protegidos también copia antes. Migración V1 válida intacta. | 3 variantes del informe + JSON roto + viajeros futuros: original idéntico tras montar y 2 recargas; aviso visible; V1 migra; viajeros inválidos no tocan el itinerario; copia/recuperación con fallo de escritura (no borra, explica, y se completa al volver). Base falla → OK. |
| **H03** | Dos superficies `React.lazy` (Viaje, Dónde dormir) sin frontera de errores: la importación rechazada desmontaba el árbol (pantalla en blanco). | `LazySurfaceBoundary` por superficie (mensaje visible, resto de la app utilizable, datos intactos) y `guardedImport`. Acción: **«Recargar la página»**, no «Reintentar»: `React.lazy` y el navegador reutilizan la importación rechazada. | Bloqueando `OrderedSequenceBuilder-*.js` y `ZoneComparison-*.js` a 390 y 1440 px: no hay blanco, aviso visible, navegación viva, datos iguales; al restablecer la red y recargar, la sección carga y el interés persiste. Base falla → OK. |
| **H05** | `--ink-500` (#6b7076) sobre `--surface-sunken` (#eceeeb) = 4,28:1 en ~12 px. | `--ink-700` (#3a3e44, token existente) en los textos/símbolos de `.official-reservation-date__*`, `.official-reservation-calendar__*` y `.trip-reservations__date`. Sin rediseño. | Gate mide el contraste calculado de **todos** los nodos de texto de Reservas y Resumen en 320/390/430/768/1440 (más que axe, que sólo vio 2/5 nodos): base 4,28 → corregido ≥4,5. axe: 0 violaciones. |
| **H06** | `<span aria-label>` genérico (axe `aria-prohibited-attr`). | `EvidenceMark` sólo-glifo: `role="img"` con el nombre en **`title`** (con `aria-label` + `title` iguales Chromium exponía el nombre y una descripción idéntica = anuncio doble). Variante con texto, sin cambios. `PersonToken` «los dos» (mismo patrón, mismas superficies) recibe `role="img"`. | Gate: sin genéricos etiquetados, rol/nombre/procedencia, un solo atributo de nombre, árbol AX (Chromium: `image` «Registrado», sin descripción). axe: 0. **No se probaron lectores físicos.** |
| **H07** | `select` 35,2 px e `input` 39,2 px en Herramientas. | `min-height: var(--tap-min)` en `.inter-hub-segments select/input` y `.accommodation-manager__input`. | 6 campos ≥44 px, sin solape, sin recorte ni overflow, foco visible y en vista en 320/390/430/768/1440. Base 35,2/39,2 → OK. |

## Rendimiento

Ver [FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md](FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md). Resumen: los dos excesos de presupuesto
eran **atribución del gate** (peticiones de la portada iniciadas antes del clic real y contadas como ciudad; diferencias
idénticas al byte a las de la auditoría); el gate pasa a medir por inicio de petición desde el clic real, sin tocar presupuestos.
La carga diferida de Tokio **no se reprodujo**: se separan comportamiento del navegador y carga anticipada del producto.
Tokio y Kioto siguen a 230 B y 550 B del límite real.

## Cambios en gates y tests (todos justificados, ninguno debilitado para dar verde)

- `b10-performance-check`: ventana/atribución (arriba).
- `block5-travellers-browser-audit` sección K: esperaba la sustitución silenciosa del documento corrupto, que es exactamente H04; ahora exige conservarlo y avisar.
- `b31-reservas-resumen-check`: su fixture «vacío» usaba `days: []`, que la app nunca produce y su parser rechaza (antes se sustituía en silencio); ahora `days: null`.
- Tests de código fuente (`useState<…>`, `}, []);`, estructura de `App.tsx`): se actualizan a `useStoredDocument`, `[setDraft]` y `LazySurfaceBoundary`, conservando las invariantes (un único dueño del documento, una sola clave).
- Nuevos: `final-audit-data-recovery-check`, `final-audit-a11y-check` (añadidos a `p06-v2-certify.sh`, de modo que el CI existente `p06-certification.yml` los ejecuta también en **WebKit**), `stored-document.test.ts`, y los scripts de investigación.

## Ronda 2 — pestañas obsoletas, exportación protegida y H03 en WebKit

**HEAD verificado:** `87f9ae6078d721043df4c0bfb49843ecea723d4e` · CI [run 37544893802](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37544893802) (chromium y webkit en verde) ·
artefactos: [webkit](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37544893802/artifacts/11450028908) (`p06-webkit-87f9ae6…`), job
[webkit](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37544893802/job/112546422645) y [chromium](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37544893802/job/112546422971).
Copias de los logs por gate en [`final-audit-evidence/round2/`](final-audit-evidence/round2/) (el log del job sólo conserva las últimas líneas de cada gate; el detalle está en el artefacto).

### 1. Operaciones desde pestañas obsoletas (sustituye la limitación «por índice»)

- **Por identidad:** mover/quitar/añadir paradas, mover/eliminar días, reordenar y fijar hora llevan una *guarda* (`UpdateGuard`) que se evalúa contra el documento **vigente**, al pedirla y otra vez al reponerla. Si la parada o el día ya no existen, o la operación entra en conflicto, **no se aplica**, se explica (`data-stale-rejection`, «No se ha hecho nada…») y la vista se refresca. «Sin asignar → día» valida lo contrario (la parada sigue sin estar en la ruta); un error mío inicial aquí rechazaba esa operación y lo detectaron `p06-v2-list-invariant`/`journeys`.
- **Corazón por intención:** `toggleSaved` aplica lo que la persona vio y pidió (guardar/quitar), no «alternar» el estado vigente.
- **Escrituras próximas entre pestañas:** «releer antes de persistir» no basta (medido: 80 «Añadir día» simultáneos dejaban ~48 de 81 días; con sólo Web Lock se perdían 5 de 243). `useStoredDocument` aplica la operación en memoria, la anota en un diario y la escribe **dentro de un Web Lock** (`nihon:<clave>`); cada escritura lleva un linaje de ids (`_w`, 96 últimos, ignorado por los parsers) y sólo se **repone** lo que se demuestra ausente del documento que acaba quedando. Hallazgo: una operación repuesta con un id nuevo seguía «incluida» bajo el original y se duplicaba (138 días en vez de 121); ahora cada operación recuerda todos los ids bajo los que se escribió.
- **Escribir sólo lo que cambia:** un documento ya canónico no se reescribe al arrancar y una operación que devuelve un documento igual no es una mutación (leer no altera el almacenamiento ni su linaje).
- **Gate nuevo `final-audit-stale-tabs-check`** (S1–S6): A saca una parada y B (vista anterior) intenta moverla; A reordena y B actúa sobre otra parada cuyo índice cambió; A elimina un día y B mueve a él; corazón; **3 pestañas × 40 «Añadir día» simultáneos = 121/121 días, ids únicos, las tres vistas coinciden** (2 rondas) y dos pestañas guardando 14 lugares distintos a la vez; B muta con el almacenamiento ya inválido (original intacto). La vista obsoleta se fabrica descartando los eventos `storage` en B y esperando 3 s a que termine su comprobación posterior a escribir. Resultado: chromium 16/16 y webkit 16/16.
- No hay cuentas ni sincronización remota; todo es local.

### 2. «Exportar respaldo» con datos protegidos

Con un documento protegido, o con una escritura fallida pendiente, **no se ofrece** el respaldo normal (exportaría el estado inicial vacío como si fuera el viaje): se explica (`data-export-blocked`) y, si está protegido, se ofrece «Descargar copia de lo conservado» (las cadenas originales, byte a byte). Si el navegador no entrega el archivo se dice y no se afirma «Archivo generado» (`lib/download-file.ts`). Antes de exportar se vacían las escrituras pendientes. No se borra ninguna clave `nihon.recovered.*` ni original. **Gate `final-audit-export-protection-check`** (E1–E5): protegido + válido, recarga, fallo de descarga, fallo de escritura y reintento; chromium 16/16, webkit 16/16.

### 3. H03 en WebKit — comprobaciones exactas

Qué modela cada escenario (`final-audit-data-recovery-check`, función `h03Scenario`):

- **Fallo real** (`proxy-reset`, `proxy-503`): un proxy local delante de `vite preview` **no entrega el chunk diferido** (corta la conexión, o responde 503) y después vuelve a responder con normalidad. No se modifica ningún asset del producto; no hay `route.abort`.
- **Inspector** (`inspector`): el `route.abort` de Playwright («Blocked by Web Inspector»), que WebKit retiene entre recargas. Estricto en Chromium; **sólo diagnóstico en WebKit** (`DIAG-OK`/`DIAG-FAIL`, no cuenta como comprobación).
- Cada escenario comprueba, en este orden: (a) el servidor realmente falló (`peticiones rechazadas > 0`); (b) el fallo no deja la aplicación en blanco; (c) aparece el aviso `[data-lazy-failure]` visible; (d) la navegación sigue utilizable; (e) los datos guardados (`nihon.travellers.v1`) son **idénticos byte a byte**; (f) al volver el servidor, la salida ofrecida («Recargar la página») **recupera la sección en la MISMA sesión** (el criterio estricto; la sesión nueva sólo se mide como diagnóstico si falla); (g) el interés guardado sobrevive a la recarga.
- Matriz: `proxy-reset` × {OrderedSequenceBuilder, ZoneComparison} × {390, 1440} (4 escenarios) + `proxy-503` × OrderedSequenceBuilder @390 (1) = **5 escenarios × 7 = 35 comprobaciones estrictas**; `inspector` × 2 superficies × 2 anchos = 4 escenarios × 6 = 24.

**Resultado en WebKit 26.5 sobre `87f9ae6`** (artefacto, `final-audit-data-recovery-check.log`): las **35 comprobaciones estrictas pasan** (`peticiones rechazadas` = 7, 4, 4, 4 en los reset y 1 en el 503; `sirvió` 58/92/64/98 y 58 peticiones tras el fallo) y los 24 diagnósticos del inspector también (`DIAG-OK`). Línea final del gate: `69/69 comprobaciones OK (webkit)`. En Chromium: `93/93` (59 H03: 35 + 24 del inspector, estrictas).

**¿Aparece «COBERTURA PARCIAL»?** **No** en `87f9ae6` (0 apariciones, 0 `DIAG-FAIL`, 0 líneas `DIAG [`). El gate la imprime en su línea final cuando algún diagnóstico del inspector no es concluyente en el motor (la línea final es la que recoge `p06-v2-certify.sh` en `summary.txt`), para que un WARN nunca se lea como validación completa. Sí apareció en las ejecuciones anteriores (run 37538683260 sobre `d0a3c20` y 37542659380 sobre `33fd46c`: «64/69 … COBERTURA PARCIAL: 4 diagnóstico(s)») porque entonces la recarga no recuperaba en WebKit.

**Por qué recuperaba antes y ahora sí.** Evidencia (run 37542659380, sondas sólo-diagnóstico en WebKit): tras el fallo, `recargar`, `recargar otra vez`, `navegar a otra URL` y `esperar 6 s y navegar` **no** recuperan (`false`); `fetch(chunk, {cache:"reload"})` devolvió 200 y **recargar después sí recupera** (`true`); una sesión nueva también (`true`). WebKit conserva la entrada fallida del módulo hasta que se refresca. Corrección: «Recargar la página» hace antes `fetch(url, {cache:"reload"})` de los `<link rel="modulepreload">` (Vite los inserta antes de importar), con tope de 3 s para recargar siempre (`lib/lazy-surface.ts::reloadRefreshingModules`). El aviso añade «si sigue igual, cierra esta pestaña y vuelve a abrir Nihon».

### 4. Cambios en gates y tests de la ronda 2 (ninguno debilitado)

- Los documentos almacenados llevan ahora el campo de linaje `_w` y las escrituras son **diferidas** (Web Lock, microtarea). Los gates que leían `localStorage` justo tras un clic, comparaban el JSON almacenado completo o esperaban «exactamente 2 escrituras de arranque» ahora **esperan a que el almacenamiento se asiente** (3 lecturas iguales a 40 ms) y comparan sin `_w`: `p06-v2-list-invariant`, `p06-v2-journeys`, `b27`, `b28/b29`, `b26`, `b25`, `phase5a` (`readSaved`), `b30` y `b31` (esperan a que el montaje se asiente, ~600 ms sin escrituras, en vez de «=== 2»). Las aserciones de contenido no cambian.
- `b25` (S-EVIDENCE), `block9` y `block20` leían el nombre del EvidenceMark sólo-glifo en `aria-label`; tras H06 está en `title` (resto de la ronda 1 que no estaba en la certificación).
- Pruebas de código fuente: `DayOrderToolPanel`, `OrderedSequenceBuilder` (×3), `stable-day-identity` y `portable-backup` (la entrega del archivo vive ahora en `lib/download-file.ts`) se actualizan a las guardas y al `useState` del aviso de rechazo (el único: no hay copia del borrador).
- Nuevos gates, añadidos a `p06-v2-certify.sh` (y por tanto a `p06-certification.yml`, chromium y webkit): `final-audit-stale-tabs-check`, `final-audit-export-protection-check`. `final-audit-data-recovery-check` reescribe H03 (arriba). Microcopy: el aviso de exportación evita «guardar/guardado» (gate B10).
- El resumen de CI de cada gate es **la última línea** de su log; por eso la cobertura parcial se declara ahí.

## Limitaciones y riesgos de las rondas 1–2 (persistencia vigente: ronda 3)

- WebKit no existe en el entorno local: sólo Chromium local; WebKit se valida en el CI del PR (`p06-certification.yml`, WebKit 26.5 de Playwright). Sin Safari/iPhone físico, VoiceOver, TalkBack ni NVDA: H03 está probado en WebKit de Playwright con un servidor local que falla, **no** en Safari real.
- **H03:** la recuperación depende de que Vite siga insertando `<link rel="modulepreload">` antes de las importaciones diferidas (de ahí sale la lista a refrescar). Si en algún navegador no hubiera enlace, «Recargar» equivale a recargar a secas y el aviso indica cerrar y reabrir la pestaña (una sesión nueva recupera). El gate ya no acepta «sólo en sesión nueva»: ese resultado es diagnóstico.
- **Escrituras entre pestañas:** requiere Web Locks (Chrome/Edge, Safari ≥ 15.4, Firefox ≥ 96); sin ellos se cae al comportamiento síncrono sin exclusión (la prueba de linaje sigue detectando y reponiendo lo perdido). Desde ronda 3, un linaje lleno aún acredita inclusión positiva o ausencia si conserva un antecesor; sin prueba suficiente se comunica conflicto y se conservan ambas copias sin escribir ni adivinar. La estrategia es de mejor esfuerzo local, **no** una garantía transaccional.
- Una operación que sólo es válida sobre una vista vieja se **rechaza** (con aviso) en vez de aplicarse por posición; las operaciones sin identidad natural (p. ej. «Añadir día») se componen entre pestañas.
- `retryPersistence` reconcilia intenciones bajo el mismo lock; el historial insuficiente o la falta del propietario rechazan el reintento sin sustituir originales.
- Las copias de sesión conservan trabajo al recargar la misma pestaña; no garantizan supervivencia al cierre definitivo ni si `sessionStorage` está denegado o lleno. La imposibilidad de conservar se comunica.
- «Exportar respaldo» no se ofrece con datos protegidos, conflicto ni escritura fallida; «Descargar copia de lo conservado» no valida que el contenido sea restaurable, sólo que es lo original.
- Quedan claves `nihon.recovered.*` en `localStorage` tras «Empezar de nuevo»; nada las lee ni las borra.
- Gates Chromium-only (`phase5a`, `phase3f-*`, `block4/6`, …) no corren en WebKit; phase5a sí corre en el job chromium de CI. Los demás gates que tocan los documentos se ejecutaron localmente en Chromium tras los cambios (block4–14, block19, phase3f-f/h/j/s, ddr03, b10-a11y, evidence-options, css-equivalence); `ddr03` y `block19-*` necesitan un servidor en el puerto 4181.
- Seguimiento sin cambio: JP-126 (barrio/coordenadas frente a JP-125) — no se toca el dataset sin fuente oficial.
- Producción y freeze intactos: `app/vercel.json` sin cambios y el último despliegue READY de producción sigue siendo `dpl_Fu2dABdW5xohuo6cV9kMkyeh6whV` (`32787a1`); no se ha fusionado ni desplegado nada.
