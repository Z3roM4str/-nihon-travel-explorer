# Estado operativo B10 — reconciliación de #177, 2026-10-02

**INCOMPLETO; PR Draft, sin fusionar.** Main incorporado `e124591b19f9f241a38091598faf2c1d27b554e4` mediante dos merges normales; código final `5c69a6e72060805992b85a96543835820ac56652`. Respaldo `codex/b10-backup-pre-reconcile-20261001` → `40838062062c8820ea9f7b028675d8add0c96c32`. [Informe nuevo](B10_RECONCILIATION_REPORT.md) y [manifiesto](B10_RECONCILIATION_EVIDENCE.json) contienen matriz, comandos, intentos y handoff.

G6 FAIL: entrada escrita 273.259 B gzip frente a ceiling 253.742 (+19.517); presupuesto sin excepción. T-01 final y regresión afectada constan en el informe; foco B26 y scroll embedded corregidos con mutantes negativos. E01–E04 pendientes de aprobación; OD-01 ya diferida expresamente por Producto según `09` integrado de main, sin tema nuevo. CSS restante y pruebas físicas/OSM siguen pendientes. Los certificados/manifiestos anteriores mantienen su SHA histórico y no certifican esta combinación. Main posterior #190 (`8046464`) inspeccionado, sólo documentos de certificación de e124591, no incorporado.

El texto que sigue conserva el estado histórico y sus autorizaciones por lote. Cualquier PASS/cierre/ratchet o recomendación anterior se interpreta en su alcance y fecha; no autoriza ampliar G6 ni aprobar literales editoriales. La instrucción actual autoriza reconciliación y tareas técnicas acotadas, sin dependencias, deploy ni refactor amplio.

---

# B10 — Ejecución autónoma desde L2

B10 INCOMPLETO. Rama `codex/b10-pulido-mission`, PR #177 Draft. Inicio: `30d1446c20d28660b25f604c4786a0605079383b`; main remoto `b854db384c952e827b86d1bb35cac7caa70b035a`. Ambos refs coincidentes al recuperar el checkout. No existe AGENTS.md en árbol, checkout ni ascendentes. Leídos misión, auditoría, handoff, certificaciones L1/L2 y normas de diseño. La instrucción autónoma sustituye las limitaciones históricas L1/L2, conservando sus artefactos.

## L2b — Revisión editorial

No se encontró una equivalencia canónica adicional documentada para E01–E04. No se cambia producto ni se cierra una decisión por inferencia. Los textos siguientes son propuestas para Producto, no literales aprobados. `08` exige revisión para texto visible nuevo; esta dependencia no detiene lotes técnicos independientes.

| Decisión | Contexto / alternativas | Recomendación concreta |
|---|---|---|
| E01 ratio/parciales | `TransferAndVisitTotals` recibe cantidades, rango y completitud; no extremos. A: «traslados conocidos · N de M conexiones con tiempo registrado» y conservar contador separado de ausencias. B: «tiempo de traslados conocido · faltan N conexiones», conservando N/M en otra línea. Ninguna implica que el traslado principal manual sea puerta a puerta o sume a los totales locales. | A: conserva ratio y distinción de cantidad/tiempo sin ampliar el modelo. Revisar singular/plural, 0/1/N, completo y parcial antes de aprobar. No inventar X/Y a partir de cantidades. |
| E02 Nosotros compartido | A: «Sólo cambia de quién es cada “Quiero ir”. El plan del viaje, los días, las fechas y el alojamiento son compartidos por los dos.» B: «Cada persona tiene su “Quiero ir”. El plan, los días, las fechas y el alojamiento son del viaje y los compartís los dos.» Mantener preferencia personal separada del plan común; no implica sincronización remota. | A: conserva la explicación del cambio de persona y enumera los cuatro ámbitos compartidos. No sustituir sólo recorrido por viaje para dar la decisión por resuelta. |
| E03 partición inválida | Razón `invalid-day-partition`; registro conservado e inactivo, sin recuperación automática. A: «El reparto por días no es válido; este traslado no se aplica.» B: «Este traslado queda inactivo porque el reparto por días no es válido.» | B: explica estado y causa sin prometer reparación ni retirar registro. Probar fixture inválida, neutralidad y minutos excluidos cuando se apruebe. |
| E04 hubs | Hub es clasificación del catálogo e incluye regiones; ciudad no es equivalencia global. A: «destinos» en toda la presentación de esta sección, conservando nombres concretos; B: «ciudades o regiones» con ejemplos del catálogo. Incluye introducción, selección, ausencia y razones `hub-mismatch`/`same-current-hub`. | B: precisa la clasificación sin añadir un concepto ambiguo de destino de navegación. Aprobar las frases completas como conjunto y probar Okinawa además de Tokio/Kioto. |
| OD-01 | Implementar modo oscuro requiere tema, estados y contraste definidos; diferirlo requiere decisión expresa de Producto. | Diferir expresamente hasta especificación y auditoría de contraste. Permanece abierto; no se crea toggle/tema. |
| A-01 colecciones | Tab largo confirma volumen, no inaccesibilidad por sí solo. A: conservar navegación vigente; B: diseñar saltos contextuales manteniendo todos los controles accesibles. | Conservar el patrón vigente en B10 técnico; revisar B sólo mediante decisión de navegación explícita. No usar tabindex negativo para acortar Tab. |

L2b no necesita build ni capturas: sólo documentos, comprobación de contratos/cadenas y `git diff --check`. L1/L2 se conservan sin editar. Los lotes técnicos continúan.

## L3 — Movimiento y accesibilidad

Implementación publicada: `2285cfdfa42beb2ce0bdfee97d03903dff9e18fe`.

Reproducción: mismo build base, diez estados por motor (320/390/839/840/1440, normal/reduce), interacción real y estilos computados. Antes: summary 42 px; onboarding primario 44 px; hover de ciudad 220 ms; mark 0,6→1,22→1; Sheet reduced mantiene keyframes transformados a 0,001 ms. El mapa nacional, cards, carga de imágenes, guardar, toast y onboarding completan el inventario alcanzable.

Correcciones mínimas (`03 §6/§7`, Art. 11): summary usa `--tap-min` (44); botón primario usa `--tap-primary` (48). Se retiran transiciones de sombra/borde/color/altura y carga de imagen no incluidas en los cinco movimientos, y entradas toast/onboarding fuera del catálogo. Estados finales, hover, alturas del mapa y acciones permanecen. Mark pasa a 1→1,18→1; press a 0,98. Reduced motion desactiva animaciones/transiciones, skeleton y escalas de pulsación; no acelera transformaciones. Sheet-rise/press/mark son los movimientos existentes conservados; skeleton sigue como excepción en modo normal. No se añade push/cross-fade inexistente, ni se retiran controles de Tab o navegación de colecciones.

Después: todos los seis summary ≥44 en diez estados; primario onboarding 48 y dentro de pantalla; Escape y apertura/cierre por teclado devuelven foco visible; cero overflow/pageerrors. Chromium y WebKit PASS (diez estados cada uno). Runner L1 intacto PASS 15 estados, filtros reales 0/1/57 y backup conservados. B18 a11y 25/25; contraste B19 sobre píxeles compuestos PASS. B26 Chromium 314/314 en el primer diff; sus medidas 44 del primario confirmaron la segunda corrección, cuya regresión completa se ejecuta sobre el código final.

Build/lint PASS (único warning PlaceMap); G1 116 archivos/3483 PASS tras corrección primaria. `block1-ux.test.ts` exige ahora cancelación de animaciones/transiciones por §03.6, sin reducir el gate. Contrast runner recibió únicamente `NIHON_CHROMIUM_PATH` con el mismo default, por ausencia de `/opt/pw-browsers/chromium`; ninguna assertion cambia.

Intentos conservados: red/preview sin permisos de socket (EPERM); npm/browser cache por defecto no escribible, corregidos a `/tmp`; selector del runner nuevo encontró navegación visible y oculta, corregido con `:visible`; contraste falló dos veces por binario fijo, luego PASS con selector de ejecutable. Son fallos de preparación/runner con causa observada, no se etiquetan como regresión de producto o deuda heredada. WebKit WPE usa bibliotecas oficiales Debian extraídas en `/tmp`, sin root/TLS/dependencias de producto. Safari/iPhone y lector físicos pendientes.

[Evidencia y hashes](B10_AUTONOMOUS_EVIDENCE.json), logs/medidas/capturas en `evidence/b10/autonomous/l3`. G5 no se declara global desde esta muestra: quedan revisión completa de superficies, zoom/lector/dispositivo y contraste de superficies legacy. El cromo sigue en 104/160 px a 390 según L1. L1/L2 y fuentes/V8/cálculos permanecen intactos.

## L5 — Referencia histórica y optimización medida

Implementación publicada: `b2ecb87c91e35fc98f2e2c562b5863cd871f4734`. Referencia `v1.1.0^{}`: `d72e19921b4aa9c9f68d0d07f8b35f37f158a286`. Inicial: `30d1446c`; proyección sobre el L3 publicado. `git archive` recupera ambas referencias en `/tmp`, sin mover main ni crear otra rama de producto. Lockfiles y analizador idénticos; node_modules instalado con `npm ci --cache /tmp/nihon-npm-cache`, Node 24.19.0, Vite 8.2.2, plugin React 6.1.0, gzip nivel 9 y Brotli por defecto de node:zlib. Config histórica sólo difiere en la definición posterior `__APP_VERSION__`; cada referencia usa su configuración de producto, sin alterar datos ni minificador. El valor histórico reproduce exactamente el cierre B16.

| Entrada / analizador idéntico | Raw B | Gzip B | Brotli B |
|---|---:|---:|---:|
| v1.1.0 reconstruido | 1.389.652 | 253.742 | 203.791 |
| HEAD inicial reconstruido | 1.669.019 | 390.305 | 327.129 |
| L5 proyección | 1.470.243 | 277.825 | 222.253 |
| Diferencia L5 vs inicial | −198.776 | −112.480 | −104.876 |
| Diferencia L5 vs histórico | +80.591 | +24.083 | +18.462 |

La pequeña variación gzip/Brotli respecto a L2 archivado se conserva como medición nueva con ruta/hashes actuales; no se reutiliza su cifra para fingir igualdad. El reporte reconstruye dist: nunca mientras un gate lee esa salida. Los módulos JSON rendered crecen de 978.911 a 1.208.551 B en el inicial; photography-metadata pasa de 129.528 a 350.724 B. Tras proyección, JSON rendered baja a 1.000.961 B. Rendered no equivale a bytes comprimidos y las contribuciones no se suman como gzip independiente.

Optimización mínima de build, sin dependencias ni lazy split: `photoRegistryProjection` conserva exactamente los campos consumidos por `buildRegistry`, y excluye del JS de producción dimensiones/fechas/URL de adquisición, role y LQIP no expuestos por PlaceImage. Los JSON fuente, adquisición y herramientas siguen completos e idénticos; no se elimina ninguna imagen, capacidad ni literal citado. Dev/tests siguen leyendo el JSON completo; la comprobación dedicada compila y ejecuta el registro con/sin proyección: igualdad exacta de 202 lugares/244 imágenes, embedded, ausente y API de tarjetas. Todos los créditos/licencias/procedencia/alt y procesamiento expuestos son idénticos. No hay nuevas peticiones ni asincronía; documentado dónde ampliar la proyección si cambia el contrato PlaceImage.

Cold/warm en contextos limpios, 390/1440, mismo runner/servidor: home, hub Tokio y ficha. JS transfer observado en cold 436.244→323.606 B; warm 900 B por respuestas de revalidación en ambas builds. Incluye prefetch vigente; no es el presupuesto del chunk ni un SLA de latencia. Las listas sólo solicitan identity -800w, ficha conserva galería. G6 imágenes PASS: Tokio 3.499.770, Kioto 3.499.450, Osaka 3.356.478, Okinawa 2.903.352, Sapporo 166.986, Nagoya 69.552, Fukuoka 69.284 B.

Build/lint y G1 116/3483 PASS; proyección compilada PASS; validator PASS; Python fotografía/rendiciones 71 PASS; B20 73/73; B6.6 fotografía browser 316/316, sin fetch fotográfico externo ni imágenes rotas. Intento inicial del runner nuevo corrigió el resultado array de Vite lib; intento B20/WebKit default expuso ejecutables/biblioteca ausentes, port de selector de runtime sin tocar assertions. Todos los logs están en `evidence/b10/autonomous/l5`.

**G6 entrada INCUMPLE** aun después de mejorar: +24.083 B gzip vs v1.1.0. No reset ni excepción implícita. Recomendación: Producto debe decidir una excepción explícita por las capacidades/fotografías incorporadas después de v1.1.0, o autorizar una optimización de carga más amplia con resolución síncrona conservada. No se hace split amplio ni se retira información para alcanzar la cifra.

## L4 — Extracción de Sheet, conservación demostrada

Implementación publicada: `47a6a0fca4f20addd93b809dd0f329b127b8143a`.

Se extraen **99 líneas**, byte a byte, de la superficie Sheet completamente tokenizada a `components/Sheet.css`, importada por su dueño. App.css 7.025→6.926 líneas. Ningún valor/selector/breakpoint se cambia ni duplica; cero hex/max-width queries/text-shadow en la superficie extraída. Test de ancho pasa a leer su nuevo dueño, con la misma assertion 420 px en md. No se retira App.css globalmente ni se presenta una extracción parcial como cierre.

G1 116/3483, build/lint y diff check PASS. Antes/después en Chromium y WebKit: **18 estados por motor**, filtros/ciudad/búsqueda, 320/390/600/839/840/1440, a ambos lados del breakpoint. Todos los estilos computados y cajas iguales; **cero píxeles cambiados dentro de Sheet**, retorno de foco y overflow conservados. Datos completos comprimidos reversiblemente y resúmenes/hashes en `evidence/b10/autonomous/l4`.

Intentos: el primer hash de pantalla completa difiere en 839/city; repetición de la build base sin cambios también difiere. Comparación RGB sitúa 34 píxeles, diferencia máxima 1, en fotografías fuera de Sheet (bbox 396,117–827,477). La comparación exacta queda en la superficie extraída; diferencias exteriores se registran, sin declarar pantalla completa idéntica. WebKit mide keyframes a momentos distintos pese a esperar 350 ms; se compara la presentación final terminando la animación con la API nativa en **ambas** referencias. Motion normal/reduce tiene su gate separado. No cambia una assertion de un gate existente ni se atribuye un fallo de producto a obsolescencia sin prueba. Los intentos iniciales y base están publicados.

Propuesta para CSS restante: inventariar y migrar PlaceDetail/galería, shell, Nosotros/backup, ZoneComparison y planner en ese orden; cada superficie conserva su cascada y exige su propia matriz visual. Las ocho queries max-width legacy requieren reconversión de estructura; 48 hex legacy incluyen colores sin equivalencia aprobada. La retirada total requiere un refactor amplio y decisiones de tokens, por lo que se deja esta propuesta concreta conforme a la instrucción, sin elegir colores por proximidad ni modificar valores para facilitar la extracción. No bloquea accesibilidad ni regresión.

## L3c / L6 — Superficies restantes y cierre de ejecución

Código final certificado: `a6ec57c864c9ae9ca6d5a2aac7c6ffde452f90fe`. El HEAD documental final es el commit que contiene este informe (`git log -1 --format=%H -- docs/B10_AUTONOMOUS_REPORT.md`); no se inserta un SHA autorreferente. No hay nueva autorización pendiente para publicar estos lotes. Se entrega ejecución parcial de B10, no cierre del bloque.

### Reproducción y correcciones

| Antes | Después / evidencia |
|---|---|
| Inventario comparable de 30 estados: 206 observaciones de targets menores al suelo; fuentes/licencias, calendario, saltar onboarding, leyenda y controles de mapa. | 0 en los mismos 30; ampliación final de 50 estados a 320×568, 390×844 y 1440×900: 0 targets insuficientes, overflow, pageerrors, imágenes sin alt o controles sin nombre en la muestra. Scope modal/visibilidad real excluyen nodos de fondo y ocultos; se conservan inventario inicial y corrección del runner. |
| Créditos: círculo visual 32 px sin área ampliada; foco oscuro sobre fotografía. Gallery.scrollTo pide smooth también con reduce. | Se reutiliza tap-target-min: círculo 32, hit efectivo 44 comprobado con puntero fuera del círculo; foco usa el token blanco on-dark. ArrowRight conserva navegación y posición; pide auto bajo reduce y smooth en normal. Créditos/licencias/destinos idénticos; links tienen cajas ≥44. PASS en ambos motores. |
| Botón MLIT en esquina inferior, cubierto por la hoja nacional al 25%. | Esquina superior existente del mapa; apertura real por puntero y Sheet de atribución conservada. No se cambian geometría, proveedores ni gestos. |
| Los tres controles nacionales de altura pintan 40 px y carecen de ampliación táctil. | Reutilizan tap-target-min: visual 40 por 04 §3, hit 44 comprobado con puntero por encima del control. La subida inicial global a 44 se revierte antes de certificar: los chips de filtros mantienen su diseño. |
| La cabecera de filtros pasa 44→61 al aparecer Limpiar, reproducido por B24 sólo tras el lote de targets. | El mínimo directo de link-button se aplica únicamente sin tap-target-min; los controles aislados ya ampliados conservan su caja visual y hit 44. B24 vuelve a pasar P1-FILTER sin modificar su assertion. |
| Apertura del mapa desde el final de portada: scroll residual 1752/1651/1516 px a 320/390/1440, mapa fuera de pantalla. La espera de montaje no lo resuelve. Volver pierde scroll/foco; original 30d1446 reproduce todo. | App guarda la posición del dueño de portada y usa layout effect sólo al cambiar home/map: mapa scroll 0; volver restaura exactamente 2557/2327/2075 px y el foco en su botón, sin scroll inducido por foco. Sin storage writes. Colecciones, búsqueda, filtros y pila de fichas mantienen su camino. PASS en ambos motores y tres viewports. |
| Al 75%, la hoja de 75vh tapa el centro de Volver en 320×568; primer runner aborta por intercepción del asa. | Se limita la altura con tokens existentes para reservar espacio a controles superiores; 390/1440 conservan sus 75vh. Hit del centro de Volver despejado en tres tamaños. Conservados el fallo, comparación original y nueva comprobación del punto real. |

Revisión React (`react-best-practices`): ningún fetch/effect nuevo de datos, dependencia o estado persistido; el único efecto nuevo es de layout, depende del cambio explícito de vista y actúa sobre su dueño de scroll. La lectura de reduced motion ocurre en la acción de galería. Sin cambio de claves/identidades, V8, cálculos, datasets, fotografías ni literales de fuentes. CSS nuevo sólo usa tokens existentes; App.css sigue con 6.962 líneas y no se declara retirado. Las capturas finales del mapa son de la superficie montada y visible; las anteriores vacías quedan como reproducción, no revisión visual aprobada.

### Certificación final y límites

Los comandos, motores, rutas, exit codes, intentos completos y hashes están en el manifiesto y archivos comprimidos de `evidence/b10/autonomous/l6`. Descompresión con `tar -xzf ARCHIVO`; los JSON y textos se conservan sin pérdida. Las capturas 320/390/1440 verifican geometría, targets y visibilidad del cambio; revisión visual de Nosotros, créditos, Días y mapa contra 03/04/05. La conservación exacta de Sheet se certifica en su lote L4; los cambios posteriores deliberados de targets no se confunden con igualdad global de píxeles.

| Comprobación | Resultado final |
|---|---|
| Build / lint / G1 | PASS; 116 archivos, 3483/3483. Warning único PlaceMap y aviso de chunk grande anteriores. Los 231 invariantes de los nueve archivos siguen verdes dentro de G1; también se conserva la ejecución dedicada. |
| B26 Chromium / WebKit | 314/314 por motor sobre código final. |
| B27 / B29 / B28 | A–K en ocho viewports; 163/163 con B28 64/64 anidado; aislado 64/64. |
| B30 / B31, ambos motores | 475/475 y 281/281 por motor. |
| B18 back / a11y | 15/15 y 25/25; advertencias TLS externas conservadas, sin declarar salud de OSM. |
| B19 discovery / grid / contraste | 30/30, 52/52 y todos los ratios compuestos dentro del contrato. |
| B20 / fotografías y proyección | 73/73. En L5: 316/316 browser, 71 Python, validator y paridad compilada de 202 lugares/244 imágenes PASS; código/registro fotográfico idéntico desde esa certificación. |
| L1 / L2 | Runner L1 intacto: 15 estados. L2: 15 por motor. 0/1/57/reset, identidades, backup, fixture inválida/inactiva, altas/ediciones/bajas, principal/manual y parciales conservados. |
| Movimiento / galería / mapa | 10 estados por motor; galería normal/reduce por motor; mapa en tres tamaños por motor. Targets, hit real, foco y storage pasan. |
| B25 | NO VERDE: 122/123, fallo C-CLEAN por ERR_CERT_AUTHORITY_INVALID en recursos externos del vacío. Comparación original 121/123, mismo error externo en dos viewports. No se prueba igualdad del número de fallos ni se oculta la dependencia. TLS, proveedor y assertions intactos. |
| B24 histórico | NO VERDE: permanece sólo P0-2 (sin icon-button--small en Quiero ir desde B25), también reproducido en original. P1-FILTER introducido aquí corregido; resto de comprobaciones final PASS. No se presenta el gate entero como aprobado. |

**Intermitencia L2 investigada:** primer B26 WebKit del lote 313/314, I-RESET-CANCEL. Base original 314/314; diagnóstico de 60 cancelaciones por versión no reproduce (120 ciclos). Pasada aislada sin cambiar código/gate 314/314; código final 314/314. La comparación no demuestra que el fallo concreto sea heredado; queda sin atribución causal, con todos los intentos conservados. B28 final pasa anidado y aislado: no reaparece auto-scroll. No se añadieron esperas a los gates existentes ni se rebajaron assertions.

**T-01:** cinco gates históricos ejecutados contra original y lote. block1-ux se detiene en selection-panel__count, retirado por B25; block13 en selector de Kioto en la portada; block14 intenta Nosotros en navegación oculta bajo Sheet; b18-regression, tras port del ejecutable, en selection-panel__content/selection-list__name; B24 P0-2 requiere iconos inexistentes en el diseño actual. Se conservan los fallos comparables y los contratos vigentes B18/B25/B26/L1/L2/B30/B31 que sí se ejecutan. El primer B24 con --viewport=phone falla por argumento del runner, corregido a 390x844. No se declara una regresión de producto sólo desde selectors viejos, ni se restaura el UI retirado para hacerlos verdes. Mantenimiento técnico restante: portar su recorrido completo al shell/B25 preservando cada garantía; requiere una matriz propia, sin sustituir garantías por un selector que siempre pase.

### Entrada final — mismas condiciones históricas

| Medición | Raw B | Gzip B | Brotli B |
|---|---:|---:|---:|
| v1.1.0 reconstruido | 1.389.652 | 253.742 | 203.791 |
| Inicio reconstruido 30d1446c | 1.669.019 | 390.305 | 327.129 |
| Código final a6ec57c8 | 1470769 | 277958 | 222590 |
| Final menos inicio | -198250 | -112347 | -104539 |
| Final menos histórico | +81117 | +24216 | +18799 |

Analizador, compresión, lock y runtime equivalentes a L5; comandos/builds/hash de assets conservados. La pequeña contribución de los fixes de accesibilidad/mapa queda incluida; no se reutiliza la cifra intermedia L5 como final. G6 continúa INCUMPLE.

### Matriz completa B10

| Objetivo / gate | Terminado y verificable | Pendiente de decisión | Pendiente técnico | Pendiente físico/externo |
|---|---|---|---|---|
| Microcopy | L1/L2 canónicos y L2b auditado; fuentes/citas conservadas | E01–E04, héroe/orden editorial, A-01 si se desea otro patrón | Aplicar sólo el conjunto editorial aprobado con fixtures 0/1/N/parciales | — |
| Movimiento | Catálogo, press/mark, excepciones skeleton, CSS reduce y scroll JS reduce comprobados | — | — en defectos reproducidos del alcance tocado | Validación de gestos/OS físico |
| Accesibilidad / G5 | 44/48, hit real, teclado/foco/retorno, nombres, reflow 320, contraste compuesto y 50 estados cloud | A-01; tokens legacy si se amplía CSS | Mantenimiento T-01; no se certifica AA exhaustiva desde el muestreo | Safari/iPhone, lector y zoom/teclado del dispositivo real |
| Rendimiento / G6 | Referencia v1.1.0 equivalente, proyección conservadora, registro exacto, presupuestos por hub y cold/warm | Excepción explícita del chunk o autorización de carga más amplia | Chunk aún por encima de v1.1.0; sin excepción aprobada INCUMPLE | Recursos externos/OSM, sin adquisición automática |
| CSS | Sheet 99 líneas con paridad exacta por motor/breakpoint; CSS mínimo de defectos verificados | Equivalencias de 48 colores legacy antes de migrarlos | App.css restante, ocho max-width queries legacy; propuesta por superficie L4 | — |
| Modo oscuro / OD-01 | Contexto y recomendación documentados, ninguna decisión inferida | Implementar o diferir expresamente | Tema/estados/contraste sólo si se aprueba implementar | Validación física del tema si se implementa |

G5 real de 08 exige áreas, contraste y foco/teclado en la superficie tocada: se aporta evidencia de esas superficies, no una certificación física o AA global. G6 exige simultáneamente presupuesto de imágenes y no regresión contra v1.1.0: imágenes PASS, entrada INCUMPLE. G3 mantiene los límites 112/168 mediante gates de shell/L1. G4: sin hex/media max-width/emoji/text-shadow nuevos; el inventario legacy sigue abierto. G7 cuenta únicamente capturas con comprobación concreta.

Además de E01–E04/OD-01/A-01 ya detallados: para el héroe repetido, conservar por ahora la imagen licenciada actual frente a sustituirla por otra identidad ya licenciada; recomiendo revisar una alternativa concreta conjuntamente con la colección, sin adquisición. Para el orden, conservar dataset frente a aprobar una secuencia editorial explícita por colección; recomiendo conservar hasta esa aprobación, sin ranking ni reparto automático. Para G6, recomiendo una excepción explícita y cuantificada por las capacidades/fotos añadidas desde v1.1.0; si no se acepta, autorizar una optimización de carga más amplia manteniendo resolución y capacidad. Para CSS, aprobar equivalencias de los colores pendientes antes de migrar PlaceDetail/galería y continuar por superficie conforme a L4.

**Próximo paso:** Producto resuelve E01–E04, OD-01 y el incumplimiento G6; después se implementan únicamente las alternativas aprobadas y se agenda validación física. El refactor CSS completo y T-01 permanecen enumerados, no escondidos como deuda externa. B10 continúa INCOMPLETO. Main, #168 y claude/* sin escrituras; sin Astra, merge, force-push ni deploy.

### Checkpoints publicados por lote

| Commit | Lote / naturaleza |
|---|---|
| `7cc74c7dcd6a46fe278b381ddf05ce246f447c1a` | docs(b10): review L2b decisions and authorize autonomous technical batches |
| `2285cfdfa42beb2ce0bdfee97d03903dff9e18fe` | fix(b10): enforce motion catalog and accessible target sizes |
| `dda58e07d41304d1681a64bc027dd7d04db79329` | docs(b10): certify L3 motion and target corrections with attempts |
| `b2ecb87c91e35fc98f2e2c562b5863cd871f4734` | perf(b10): project only consumed photo fields during production builds |
| `680db736e1ea0115e76effb61f1e12d4d91374b2` | docs(b10): certify equivalent historical bundle and photo projection |
| `47a6a0fca4f20addd93b809dd0f329b127b8143a` | refactor(b10): extract tokenized Sheet CSS with visual parity |
| `6c3662a7a27213c28797be6386882c42c7b96dfc` | docs(b10): certify Sheet extraction across breakpoints and engines |
| `8ca1c9eac10af0e0ef80b58d43ada3247b4f0e1f` | fix(b10): complete audited targets and respect gallery reduced motion |
| `ed12e8086076ce764e865d9d79fc3c2fbf01a867` | test(b10): support cloud browser paths without changing gate assertions |
| `82c30a5e33e4045c2deac2e7309b908e463759d1` | fix(b10): preserve stable filter header and document focus timing checks |
| `a6ec57c864c9ae9ca6d5a2aac7c6ffde452f90fe` | fix(b10): restore national map viewport and home keyboard return |

El commit documental final añade esta certificación y evidencia, sin cambiar app. Cada publicación verifica el HEAD remoto/PR Draft y usa actualización no forzada. GitHub crea los commits con su propia metadata; los árboles publicados se comparan exactamente con los commits locales. No se sobrescribió ningún avance remoto concurrente.

Commit documental adicional: `42886ee68d7c3b0e5c2c7856ab97db4ade701204`, consolidación y evidencia anteriores a esta observación remota.

## Avance concurrente de main detectado al cierre

La lectura directa `git ls-remote`/fetch identifica **main `5498756b82b79818ea80cea83ee1d6fb312776e9`**, frente al inicial `b854db384c952e827b86d1bb35cac7caa70b035a`: **35 commits, 111 archivos y 15 rutas compartidas con #177**. Integraciones externas #178 (D0b/D5, `2a10ad3`), #179 (B10 de claude, `c512db1`), #180 y #181 (certificaciones/cierre, `8414a71` y `5498756`). Sus autores/merges constan en el historial remoto; esta misión no los ejecutó ni escribió a main o claude/*.

El avance incluye vocabulario D5, tokens D0b, movimiento/targets, extracción CSS extensa y su propio handoff que declara B10 cerrado con deuda. **No se adopta ese cierre como certificación de #177**: este encargo exige mantener abiertos los criterios obligatorios incumplidos. Rutas comunes incluyen App, NationalExplorer, PlaceGallery, Sheet, discovery CSS, runners, handoff y roadmap. Inventario completo de commits/rutas en `evidence/b10/autonomous/l6/main-concurrent-advance.json`.

Código de #177 sigue exactamente en `a6ec57c8`, certificado sobre la base original; no se integró el código concurrente ni se afirma haberlo probado. El proveedor de metadata de PR siguió devolviendo base_sha b854 aunque git remoto ya mostraba 5498756; para esta comparación se usa la referencia Git leída directamente. Primer intento de leer origin/main falla porque el refspec local sólo sigue la rama B10; comparación resuelta con el SHA fetched, sin cambiar una rama local main.

**Pendiente técnico nuevo: reconciliación con main actual**, con su propia revisión y regresión. No revertir extracciones ni decisiones concurrentes al aplicar #177. Recomendación/próximo paso inmediato: mantener Draft y comparar únicamente los aportes pendientes (proyección fotográfica, links/hit areas, filtro estable y mapa/retorno) con sus nuevos dueños CSS antes de decidir su incorporación; después resolver editorial/OD-01/G6 y validar físicamente. Sin merge/rebase/force-push durante este cierre. El HEAD de la rama B10 se comprueba directamente antes del checkpoint documental; el avance ajeno se conserva íntegro.
