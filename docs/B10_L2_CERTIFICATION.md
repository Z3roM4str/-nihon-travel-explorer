# B10 — Verificación y certificación acotada de L2

**Sólo copy contextual C01–C03. B10 INCOMPLETO; PR #177 Draft, sin merge.** Implementación `ebcb6fc5fe8cedbad8edae1ec8939447cccaa08f`; documentación/evidencia en commit separado, identificable con `git log -1 --format=%H -- docs/B10_L2_CERTIFICATION.md`. No se declara certificación global de B10 ni G5/G6.

## Alcance, autoridad y matriz

HEAD inicial exacto `20bdf2d16ccfefccae5626880c0246c385c87aa1`, rama `codex/b10-pulido-mission`; main remoto `b854db384c952e827b86d1bb35cac7caa70b035a`. Coinciden con las precondiciones; no se incorporaron ni sobrescribieron cambios remotos. AGENTS.md buscado en árbol/checkout/ascendentes aplicables, ninguno. Leídos misión, auditoría, handoff y certificación L1 antes de editar.

[Alcance y matriz L2](B10_L2_COPY_SCOPE.md) escritos antes de editar producto. La propuesta anterior incluía movimiento; la instrucción actual lo excluyó. Se revisaron **F-C02/F-C03**, sin sustitución global. L1, incluida su certificación y evidencia, permanece byte a byte intacto: **47 archivos y 41 hashes de artefactos comprobados**.

| Ubicación | Antes → después | Clasificación / fundamento |
|---|---|---|
| OrderedSequenceBuilder:1865 / vacío | ningún tramo entre ciudades → ningún traslado entre ciudades | C01, equivalencia canónica `03 §10` / `05 §7.3` |
| OrderedSequenceBuilder:1967 / alta | Añadir tramo → Añadir traslado | C02, misma entidad y fundamento, sin modificar su duración ni alcance |
| OrderedSequenceBuilder:1883–1884 / aria-label y title | Eliminar tramo {origen} a {destino} → Eliminar traslado {origen} a {destino} | C03, equivalencia canónica con origen/destino/dirección intactos |
| Introducción y ambos inputs de minutos | Tramo principal / Duración manual del tramo principal → sin cambio | V01–V02, contrato `INTER_HUB_TRANSPORT_DESIGN §1/§5.5/§10.1`: principal/manual, no puerta a puerta |
| Pares desconocidos y razones de ruta | tramo(s) sin traslado registrado / recorrido actual → sin cambio | V03–V04, distinción OrderedSequenceLeg/registro y ruta/adyacencia, conforme a LOGISTICS / diseño de transporte; validez contextual, no regla global |
| Ratio N/M, frase de Nosotros, partición inválida y hubs | Sin cambio | E01–E04, decisiones editoriales pendientes. No inventar extremos para ratio ni equivalencia ciudad/zona para hub |

## Implementación y conservación

Producto: **cuatro cadenas únicamente** en `OrderedSequenceBuilder.tsx`. La reconstrucción inversa de esas cuatro sustituciones produce exactamente el archivo del HEAD inicial: el resto del código, fuentes/citas, clases, handlers, callbacks, condiciones y cálculos permanece idéntico. No se modifica TravellerManager, lib, hooks, datos, modelo V8, claves, versiones ni formato de backup.

Cobertura en `app/scripts/b10-l2-check.mjs`: misma fixture V8, dos días con IDs estables y tres lugares reales (Tokio/Kioto/Tokio), Quiero ir coherente. Se verifican:

- Abrir/fill no escribe preferencias ni V8; alta deshabilitada con modo/minutos incompletos o cero.
- Alta con Enter de un segmento principal de 135 min, source user-entered y ID opaco; edición a 150 conserva ID; edición inválida vuelve a 150.
- Baja con Enter restablece el draft original, sin cambiar preferencias. Nombre accesible y title coinciden con la entidad canónica y los mismos extremos.
- Fixture inactiva con snapshot de hub discordante: registro conservado, neutral, razón intacta, sin rebind/reparación automática.
- Duraciones manuales principales y aviso no puerta a puerta intactos. Subtotales y parciales desconocidos byte a byte iguales antes/después de alta, edición y fixture inactiva; no incorpora minutos manuales a visitas/traslados locales.

Base y lote se verifican en **Chromium y WebKit**, 320×568, 390×844, 1440×900: **15 estados por motor/versión, 60 estados totales**, cero overflow y pageerrors en esa muestra. Comparación de registros: sólo 96 diferencias en los campos de copy canónico; valores de dominio, identidades, totales y resto del texto coinciden. La región `.analysis-totals` incluye las mismas cantidades/avisos parciales. Capturas revisadas y comprobación adicional con agent-browser de vacío, acción y duración principal.

## Comprobaciones ejecutadas, limitaciones y deuda

Estado final ejecutado: **B26 Chromium y WebKit 314/314; B27 A–K; B29 163 y B28 64/64 PASS**. La intermitencia de intentos anteriores se detalla abajo; no equivale a ausencia de incidencias.

Build PASS; lint final PASS con único warning heredado Fast Refresh PlaceMap; Vitest completo **116 archivos/3483 tests PASS**, incluidos portable-backup, V8, transporte, identidad, filtros y Nosotros. No se cambian expectativas Vitest ni se añaden pruebas que sólo reflejen literales.

B27: **base y lote PASS A–K en ocho viewports**. Único port de selector: «Añadir tramo» → «Añadir traslado», con comentario citando `03 §10`/`05 §7`; todas las assertions y acciones se conservan. B26/B28/B29 no se modifican. Runner L1 intacto: **15 estados PASS** sobre L2 (filtros 0/1/57/reset y backup/cancel/foco); sus nuevos resultados se guardan en evidencia L2, sin sobrescribir la evidencia L1.

G1 verde. G2/G7 comprobados para las cadenas y conservación descritas. G3: runner L1 devuelve cromo 390 de 104/160 px. G4: diff check PASS, sin CSS/tokens/estilos/valores nuevos. G5: nombres accesibles y teclado de las acciones modificadas probados; **sin certificación AA global**, F-A02/42 px heredado e intacto, más incidencias de foco registradas. G6 histórico/P-03 permanece pendiente: no se ejecuta trabajo de rendimiento ni se cambia baseline en L2.

**No ejecutadas / fuera de certificación**: Safari/iPhone real, lector físico y selector físico de archivos. **Bloqueada documentalmente**: consulta de protección de main por el 403 antecedente; no se consulta de nuevo ni se intenta eludir. No se afirma ausencia de checks requeridos; se registra sólo el estado público del PR. OSM/fotografía de zonas permanecen separados.

## Intentos e incidencias

Todos los intentos se preservan en evidencia L2. Primer runner de base (ambos motores): timeout al buscar label exacto del select cuya etiqueta incluye opciones; se corrigió el selector del runner nuevo para leer el control, sin tocar producto ni gate existente. Primer lint: dos variables sin uso en el runner; prefijo `_` y repetición sin warning nuevo.

B29/B28: dos ejecuciones completas y una aislada de B28 en L2 fallaron en J (auto-scroll después de cancelar); base aislada B28 y base B29/B28 pasaron. Última ejecución L2 sin otros gates activos: B29 163 y B28 64/64 PASS. Hay antecedente de intermitencia en L1/B31, pero esta sesión no prueba que todos los fallos sean heredados; se conserva esa limitación.

B26 WebKit: primer intento timeout entrando en Nosotros; segundo 312/314 (B-INVALID-FOCUS y K-FOCUS-VISIBLE a 1440). Base 313/314: reproduce una incidencia B-INVALID-FOCUS, con otra fixture, no K. Tercera pasada L2 aislada: 314/314 PASS, sin editar gate. Chromium 314/314 en primera pasada. No se convierte un intento fallido en PASS ni se ajustan assertions para obtener verde. Directorio aislado `/tmp/b10-l2-regression-base` contiene scripts/config/dataset/package originales y dist preservado de `20bdf2d`; misma versión de dependencias/motores. No se cambia de rama ni se modifica la base.

## Pendientes y siguiente lote

F-C02 resuelto sólo en C01–C03. Introducción/duración principal, tramo desconocido y razones de ruta son contextuales, conservados; la clasificación no crea una excepción general a Art. 7. F-C03 sólo conserva la corrección de etiqueta de L1; frase larga de Nosotros sigue pendiente.

E01–E04: decidir copy del ratio de parciales, propiedad personal/compartida, error de partición y hub. No se elimina información ni se cambia qué número representa cada estado. Siguiente lote recomendado **L2b documental/editorial**: resolver esas decisiones con sus estados de ejemplo antes de autorizar otra implementación. Las incidencias de gates se registran separadas de copy, sin añadir movimiento/rendimiento a L2.

OD-01, F-M01/movimiento, CSS, héroe/orden, navegación de colecciones, rendimiento y targets 42 px siguen fuera de esta instrucción. Main, #168 y claude/* intactos; sin Astra ni Vercel/deploy. PR #177 Draft; **B10 no está completo**.

## Evidencia publicada

[Manifiesto y hashes](B10_L2_EVIDENCE.json): cuatro registros completos antes/después, 28 capturas seleccionadas de los 60 estados comprobados, todos los logs de intentos, comparación, conservación y reejecución L1. Las capturas editado/retirado no seleccionadas están descritas en los registros completos.
