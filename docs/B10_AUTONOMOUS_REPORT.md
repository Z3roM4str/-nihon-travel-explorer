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
