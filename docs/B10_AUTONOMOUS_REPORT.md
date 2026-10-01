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
