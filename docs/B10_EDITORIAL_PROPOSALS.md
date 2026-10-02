# E01–E04 — propuestas literales completas, sin aprobación

**OPEN / NO IMPLEMENTADAS.** Recomendaciones del informe reconciliado y esta continuación no constituyen aprobación. Revisadas discusión y reviews de #177: vacías al comprobar. No se cambió copy de producto. Mantener estos textos como propuestas de Producto; preservar datos, límites de ámbito y literales de las fuentes. OD-01 continúa POST-V1/DIFERIDO con procedencia en design/09, sin tema/control.

## E01 — Viaje › Días, resumen local de traslados

Propuesta A recomendada. N = conexiones locales con tiempo registrado, M = conexiones locales consideradas, F = M−N. No sumar traslado principal manual como duración puerta a puerta ni inventar extremos X/Y que no recibe la API. Aplicar sólo a estados donde el resumen ya existe; no añadir un resumen a una rama que lo omite.

| Estado | Literal propuesto completo |
|---|---|
| Completo, cero conexiones | «traslados totales · 0 conexiones con tiempo registrado» |
| Completo, una | «traslados totales · 1 conexión con tiempo registrado» |
| Completo, N≥2 | «traslados totales · {N} conexiones con tiempo registrado» |
| Parcial, ninguna conocida/M=1 | «traslados conocidos · 0 de 1 conexión con tiempo registrado»; contador separado «1 conexión sin tiempo registrado» |
| Parcial, ninguna conocida/M≥2 | «traslados conocidos · 0 de {M} conexiones con tiempo registrado»; contador separado «{M} conexiones sin tiempo registrado» |
| Parcial, una conocida/M≥2 | «traslados conocidos · 1 de {M} conexiones con tiempo registrado»; contador separado según F: «1 conexión sin tiempo registrado» o «{F} conexiones sin tiempo registrado» |
| Parcial, N≥2 | «traslados conocidos · {N} de {M} conexiones con tiempo registrado»; contador separado según F: «1 conexión sin tiempo registrado» o «{F} conexiones sin tiempo registrado» |

Alternativa B, también no aprobada: «tiempo de traslados conocido · faltan {F} conexiones», singular «tiempo de traslados conocido · falta 1 conexión», conservando N/M en otra línea. Se recomienda A por explicitar el ratio y completitud sin inventar información.

## E02 — Nosotros › cambio de persona y plan compartido

«Sólo cambia de quién es cada «Quiero ir». El plan del viaje, los días, las fechas y el alojamiento son compartidos por los dos.»

Alternativa: «Cada persona tiene su «Quiero ir». El plan, los días, las fechas y el alojamiento son del viaje y los compartís los dos.» Se recomienda la primera: mantiene causa del cambio y los cuatro ámbitos compartidos, sin prometer sincronización remota.

## E03 — Días/herramientas › invalid-day-partition

«Este traslado queda inactivo porque el reparto por días no es válido.»

Alternativa: «El reparto por días no es válido; este traslado no se aplica.» Se recomienda la primera por explicitar estado y causa. El registro sigue conservado/inactivo y sus minutos excluidos; no implica reparación automática.

## E04 — traslado principal › alta, ausencia y cambio de catálogo

Conjunto B recomendado (incluye regiones como Okinawa, no sólo ciudades):

1. Ayuda de alta: «Las ciudades o regiones corresponden a los lugares elegidos; tú seleccionas el modo y escribes los minutos.»
2. Selector de pareja: «Selecciona dos puntos consecutivos de ciudades o regiones distintas».
3. Ausencia de pareja nueva: «No hay una pareja consecutiva nueva entre ciudades o regiones distintas en el reparto actual.»
4. Hub mismatch: «La ciudad o región actual de uno de los puntos ya no coincide con la registrada.»
5. Same current hub: «Los dos puntos pertenecen actualmente a la misma ciudad o región.»

Alternativa A: sustituir el conjunto por «destinos»/«destino». Se recomienda B porque «destino» también significa una pestaña de navegación. Identidades, nombres de hub, orden, clasificación y minutos permanecen iguales.
