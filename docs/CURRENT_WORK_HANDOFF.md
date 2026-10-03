# Handoff operativo — Nihon / línea Claude

## Decisión vigente — 3 de octubre de 2026

El usuario elige continuar con la versión de Claude, que está más avanzada. La continuación duplicada Work/Astra/Codex queda cancelada. El agente utilizado no cambia la identidad del producto: cualquier trabajo nuevo aquí pertenece a Nihon/Claude y sigue `docs/design/`.

No reanudar el lote fotográfico de #177 ni trasladar sus decisiones, deuda, código o presupuestos a esta línea. Su cancelación operativa no significa que se haya cerrado el PR remoto. Las ramas históricas se conservan.

## Base comprobada

- `main` consultado en GitHub el 3 de octubre: **`de4b190b033a4d8c169d75a609e3d7d50527e674`**, merge de [#193](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/193).
- Es la base de esta actualización documental, no una promesa de que el remoto no avance. Antes de implementar, volver a consultar `main` y leer este handoff en el árbol recibido.
- B1–B10 están completos. No existe un bloque oficial B11. El trabajo restante es validación, deuda clasificada y decisiones de diseño.

## Qué está integrado

| Trabajo | Estado / fuente |
|---|---|
| B10 y hardening posterior | Integrados: #179 y #183–#187. [Handoff B10](B10_POLISH_HANDOFF.md) |
| Certificación automatizada completa | Árbol exacto `e124591b19f9f241a38091598faf2c1d27b554e4`, no el `main` posterior. [Informe](RELEASE_CERTIFICATION.md) |
| P-04: mapa nacional fuera de pantalla tras desplazar portada | #191 integrado. Chromium/WebKit registrados sobre la rama; no equivale a Safari físico |
| Acceso destacado al mapa antes de Ciudades | #192 integrado. WebKit no ejecutado para esta modificación según el PR |
| P-06: Días con información secundaria plegada | #193 integrado. [Inventario y pruebas](P06_DAYS_PROGRESSIVE_DISCLOSURE.md). Chromium documentado; WebKit pendiente |

La crítica sobre exceso de texto en Días ya tiene una solución integrada en #193. Evaluar esa solución antes de proponer otra reorganización.

## Próximas acciones, por prioridad

| Prioridad | Acción | Criterio de cierre |
|---|---|---|
| 1 — Ingeniería / runner | Repetir sobre una build exacta de `main` los gates afectados por #191–#193 que admiten WebKit: P-04, B21, B30, B31, B10 accesibilidad/movimiento/microcopy, D0b, D5 y evidence-options | Registrar SHA, hash de build, motor y resultados reales; los gates sin soporte WebKit se identifican, no se declaran ejecutados |
| 2 — Validación humana | Comprobar mapa y Días en iPhone/Safari real; teclado, VoiceOver/TalkBack, gestos y rendimiento real | Evidencia de dispositivo/versión/build y resultado por recorrido; la emulación no cierra estas pruebas |
| 3 — Producto/Diseño | Evaluar P-06 con el usuario: primera pantalla comprensible, localizar mover parada y Detalles del día, volver desde Dónde dormir | Hallazgos concretos aprobados; no rediseñar otras pestañas por inferencia |
| 4 — Contenido / externo | Fotografías reales de zonas, licencias y recursos OSM bajo red real | Procedencia/licencia y conectividad verificadas por separado de la UI |

No elevar a «certificación completa del main actual» las pruebas del árbol `e124591`. No rebajar límites ni omitir respuestas para hacer pasar rendimiento.

## Deuda conservada, sin abrir otro frente

- OD-01 (modo oscuro): POST-V1 / DIFERIDO.
- B10-M1…M6 y B10-C1: documentados; un cambio exige decisión de Producto/Diseño.
- D0b-01, D0b-02, EvidenceMark 11/12, media queries y `zone-fact--strong`: deuda/decisión de diseño.
- Primitivos `.tag/.alert/.badge/.person-token` de `App.css`: deuda técnica menor.
- Modos modales no `embedded` y APIs L3/L4 sin consumidor: retirada sólo con prueba de inalcanzabilidad y cobertura del dominio conservada.
- B21 no es un bug de producto pendiente: su carrera del gate se resolvió. [Causa raíz](B21_ROOT_CAUSE.md).

## Forma de trabajar

1. Confirmar repositorio, base remota exacta y misión; crear una rama de trabajo desde esa base. No usar #177 ni una rama experimental como base.
2. Leer [guardrails](design/08_GUARDRAILS_DE_INGENIERIA.md), especificación de la superficie y [autoridad de gates](GATE_AUTHORITY.md). Conservar datos, capacidades, persistencia y fotografías.
3. Un lote acotado, con criterios de cierre. Reutilizar evidencia sólo si su árbol y alcance corresponden al cambio; distinguir pruebas nuevas de resultados históricos.
4. Publicar cambios en la rama y preparar PR revisable. Merge y deployment requieren su autorización; [freeze vigente](DEPLOYMENT_POLICY.md) sin cambios.
5. Actualizar este handoff al cerrar el lote, sin acumular otro «estado actual» en su interior.

## Comprobaciones de esta organización documental

Ejecutadas sobre el producto de `de4b190` el 3 de octubre: instalación limpia, build/typecheck y lint PASS (un warning heredado en PlaceMap). Vitest: **118 archivos; 3421 PASS y 3 omitidas**, de 3424. Las tres omitidas son guardas históricas D5: el clon superficial no contiene su base `b854db3`; no se presentan como PASS. Sin pruebas browser nuevas ni validación física en esta sesión.

El archivo histórico conserva literalmente el handoff previo; los enlaces de README y del handoff operativo se verificaron. Esta actualización sólo modifica documentación: producto, datos, fotografías, scripts y configuración de despliegue permanecen idénticos a la base.

## Historial y fuentes

El handoff anterior se conserva completo en [el archivo histórico](CURRENT_WORK_HANDOFF_HISTORY_2026_10_03.md). Sus siguientes bloques, cierres y SHA son snapshots, no instrucciones actuales. La certificación y los handoffs específicos mantienen su evidencia original.
