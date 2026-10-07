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
aserciones de contenido. Añade otras 17 ventanas que los gates ordinarios no cubrían: reintento
encolado con eventos retenidos + inválido/futuro; historia desconocida llena/ausente/malformada
que sigue conflictiva tras recarga y otra escritura externa; persona eliminada al pedir o ejecutar;
quitar interés atribuido a la persona vista; rollback satisfactorio tras recarga; rollback incompleto
con preimagen conservada; lock rechazado; parada cuyo día desapareció mientras esperaba;
zonas y planificador compartiendo cola; error de lectura protegido; inicialización del borrador tras
restaurar un respaldo cuyo itinerario es null (viajeros vigentes en lugar de la lista anterior de React); segunda restauración fallida conservando la primera preimagen; fallo de
copia de sesión antes de importar sin dejar un bloqueo de una importación que no empezó.

Diferencias respecto del script original:

- Gestiona su propio Vite y admite Chromium/WebKit; el fixture vive en `scripts/fixtures/` e importa
  los módulos reales del producto. Mismos datos y aislamiento; no se simula la implementación.
- Espera los resultados **asíncronos** de reintento, importación y exportación. Evita interpretar una
  promesa como un éxito o leer antes de que el bloqueo termine.
- Recarga con lock retenido: además de exigir finalmente 2 días, comprueba 1 día en almacenamiento
  mientras el lock sigue retenido y 2 en la copia visible recuperada. La base escribía al cerrar
  saltándose el lock: su aserción original más débil pasaba, pero no acreditaba exclusión.
- H03 timeout conserva el mínimo de 2,9 s para el tope de 3 s y comprueba recarga y datos; el máximo
  es 7 s incluyendo arranque del fixture (el original usaba 5). **No modifica** el producto H03 ni
  las 35 aserciones estrictas reset/503 de `final-audit-data-recovery-check`.
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
los 31 resultados dirigidos. El workflow comprueba el **HEAD del PR**, no su merge sintético, y ejecuta
Vitest antes de la certificación. Los resultados finales y enlaces se consignarán tras terminar CI.

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
