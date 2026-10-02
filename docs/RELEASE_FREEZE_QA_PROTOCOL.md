# Release freeze V1 y protocolo de QA físico

Documento de handoff final del **RELEASE CANDIDATE CERTIFICADO**. No añade funcionalidades, no
cambia producto, dataset, fotografías, Astra ni Vercel. Vive sólo en la rama
`claude/vibrant-curie-gds22h`; **no se ha fusionado en `main`** (ver §1.4).

## 1. Registro del freeze (verificado contra remoto el 2026-10-02)

### 1.1 Commits
| Concepto | SHA | Comprobación |
|---|---|---|
| **HEAD remoto de `main`** (HEAD documental) | `80464643528a458de05149b01a8b5c2e5b94a77f` | `git fetch origin main` → `origin/main` = este SHA. Merge de #190 |
| **Commit técnico certificado** | `e124591b19f9f241a38091598faf2c1d27b554e4` | merge de #189; ancestro de `main` |
| Commit documental de #190 | `ad58eb4617203ae11fb708fab48fa12dd9b97784` | padre `e124591`; tree `ce0a8cbb…` **idéntico** al tree de `8046464` |
| Diferencia `e124591..8046464` | sólo `docs/` | `CURRENT_WORK_HANDOFF.md`, `GATE_AUTHORITY.md`, `RELEASE_CERTIFICATION.md` |

`RELEASE_CERTIFICATION.md` §1 identifica el `main` final con la receta
`git log -1 --format=%H -- docs/RELEASE_CERTIFICATION.md`, que devuelve `ad58eb4` (el commit
documental), no `8046464` (su merge en `main`). Como ambos tienen el mismo tree no es un dato
incorrecto, sino impreciso; esta tabla deja la correspondencia fijada. Para resolverlo sobre la
primera línea de `main`: `git log --first-parent -1 --format=%H -- docs/RELEASE_CERTIFICATION.md`
→ `8046464`.

### 1.2 PRs
* [#189](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/189): MERGED 2026-10-02T00:33:39Z (cabeza `ed8c589`, merge `e124591`).
* [#190](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/190): MERGED 2026-10-02T01:17:10Z (cabeza `ad58eb4`, merge `8046464`).
* PRs abiertos que apuntan a `main`: [#177](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/177) (Codex, **Draft**, B10 reconciliación, declarado «INCOMPLETO — sin fusionar») y [#163](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/163) (Claude, **Draft**, B27 histórico).
* Resto de PRs de Claude abiertos, todos apilados sobre ramas `claude/*` y no sobre `main`: [#165](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/165), [#168](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/168), [#170](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/170), [#173](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/173) (Draft) y [#174](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/174) (no Draft, base `claude/design-phase-1-v2-1-docs`). `CURRENT_WORK_HANDOFF.md` ya establece que esa cadena «no se fusiona».
* Ninguno puede llegar a `main` sin una acción manual explícita: marcar Ready y fusionar (#163, #177) o fusionar varias ramas en cadena (#174…). Ningún PR abierto procede de esta misión.

### 1.3 Documentación revisada
| Requisito | Dónde queda fijado | Estado |
|---|---|---|
| RELEASE CANDIDATE CERTIFICADO | `RELEASE_CERTIFICATION.md` (veredicto), `CURRENT_WORK_HANDOFF.md` §«Certificación final de release» | correcto |
| Commit técnico certificado `e124591` | ambos documentos, con tree y padres | correcto |
| HEAD documental de `main` | `RELEASE_CERTIFICATION.md` §1 (receta, ver §1.1) + este documento (`8046464`) | impreciso, no incorrecto |
| Deuda POST-V1 | `RELEASE_CERTIFICATION.md` §12, `CURRENT_WORK_HANDOFF.md` «Deuda vigente», `design/10_ROADMAP_DE_BLOQUES.md` B10 (OD-01) | correcto |
| Validaciones de hardware/persona | `RELEASE_CERTIFICATION.md` §14, `GATE_AUTHORITY.md` §4, handoff | correcto; protocolo concreto en §3 |
| Vercel congelado | `RELEASE_CERTIFICATION.md` §4/§13/§14, `DEPLOYMENT_POLICY.md` | correcto (ver matiz en §1.4) |
| No existe B11 | `CURRENT_WORK_HANDOFF.md` («No existe "B11": no se inventa»), `design/10_ROADMAP_DE_BLOQUES.md` («Este roadmap no define bloques posteriores») | correcto |

Nota: `docs/ROADMAP.md` es el registro histórico de ingeniería (Blocks 1–16, v1.1.0) y no describe
el estado del RC; la autoridad de estado es `CURRENT_WORK_HANDOFF.md` +
`RELEASE_CERTIFICATION.md` + `design/10_ROADMAP_DE_BLOQUES.md`.

### 1.4 Por qué no se fusionó nada en `main`
* No hay documentación objetivamente incorrecta (§1.3), así que no se cumple la única condición
  autorizada para fusionar.
* `app/vercel.json` mantiene `"**": false, "main": true`: **todo push a `main` dispara el despliegue
  automático de producción**. Un commit documental en `main` sería, en la práctica, un despliegue.
  «Vercel congelado» significa, según `DEPLOYMENT_POLICY.md`: ningún despliegue manual, ningún
  cambio de proyecto/dominio/configuración y ninguna otra rama desplegable; la regla automática de
  `main` es la única excepción autorizada.
* Esta rama (`claude/vibrant-curie-gds22h`) cae en `"**": false`: publicarla no despliega nada.

### 1.5 Huella de la build certificada
Build de producción del tree de `8046464` (= `app/` de `e124591`) en este entorno, `npm ci` + `npm run build`:
* Entrada JS: `assets/index-D4HWBx5K.js`, 1 469,06 kB sin comprimir (coincide con los 1 469 063 B de `RELEASE_CERTIFICATION.md` §6).
* CSS de entrada: `assets/index-DZegIJ9v.css`.
* Chunks diferidos: `OrderedSequenceBuilder-wPdYuU3z.js`, `ZoneComparison-CQw6BGPb.js`.

Sirve para confirmar en el iPhone que se prueba exactamente el RC (prueba P-00). Si el nombre del
hash difiere, se comprueba el tamaño: si cuadra al kB, es la misma build con otro entorno de compilación.

## 2. Clasificación

### 2.1 RELEASE BLOCKERS
**Abiertos: ninguno.** Ningún gate automatizado está en rojo sobre `e124591` (64/64 Chromium y la
matriz WebKit de `RELEASE_CERTIFICATION.md` §4/§7).

Un resultado del QA físico sólo es bloqueo de release si cumple al menos uno de estos criterios:
1. **Pérdida o corrupción de datos**: «Quiero ir», viaje, días, fechas, alojamiento, personas o
   respaldo desaparecen o cambian sin acción de la persona, tras recarga o tras importar.
2. **Escritura no pedida**: abrir, consultar, cancelar o cerrar algo cambia el viaje guardado.
3. **Flujo principal inutilizable sin alternativa** en Safari/iPhone: no se puede explorar, guardar
   en «Quiero ir», llevar al viaje, organizar días, aplicar «Probar otro orden» o exportar/importar.
4. **Página en blanco, cuelgue o recarga forzada** de Safari («Se ha producido un problema…»)
   reproducible.
5. **Flujo principal inaccesible con VoiceOver** (control sin nombre, foco atrapado sin salida,
   acción imposible de activar).
6. **Contenido legal ausente**: fotografía sin crédito/licencia accesible, o mapa sin atribución.
7. Cualquier texto que afirme que un orden es «mejor», «óptimo», «recomendado» o que «ahorra» tiempo.

Todo lo demás es defecto menor (se registra, no bloquea).

### 2.2 POST-V1 (deuda conocida, no se resuelve en este freeze)
* OD-01 modo oscuro — POST-V1 / DIFERIDO.
* D0b-01, D0b-02 (`viewport-fit=cover` no aplicado), EvidenceMark 11/12, migración de media queries.
* B10-M1…M6 (movimiento) y B10-C1 (vocabulario de guardado): documentados; cambios = decisión de Producto/Diseño.
* Modos modales no `embedded` de `ZoneComparison`/`OrderedSequenceBuilder` y APIs L3/L4 de `planning-draft` sin consumidor de UI.
* Decisión de diseño sobre `zone-fact--strong` (B30).
* Primitivos `.tag/.alert/.badge/.person-token` en `App.css`.
* Gates B25 y B27–B29 escritos sólo para Chromium.
* Fotografías reales de zona (hoy hay sustituto `ZonePhotoFallback`).
* Aviso de lint `PlaceMap.tsx:18` y aviso de tamaño de chunk de `vite build` (heredados).

### 2.3 Observaciones que no requieren acción
* `RELEASE_CERTIFICATION.md` §1: la receta de `main` final devuelve `ad58eb4` (mismo tree que `8046464`); fijado en §1.1.
* Observación de B21 sin impacto demostrado: el scroll de la búsqueda se guarda por evento `scroll` (por fotograma). Se vigila en P-03 sin actuar.
* PRs abiertos históricos (§1.2): Draft o apilados; sin riesgo sin acción manual. Cerrarlos es opcional y decisión de la persona propietaria.
* Safari puede borrar el almacenamiento de un sitio tras 7 días sin visitarlo (ITP). Los datos son locales al dispositivo por diseño; la mitigación existente es «Exportar respaldo». Se comprueba en P-11.
* Las referencias a Vercel en documentos de cierre anteriores son históricas y no autorizan despliegues (`DEPLOYMENT_POLICY.md`).

## 3. Protocolo de QA físico

### 3.0 Preparación (una vez)
* **Dispositivo**: iPhone real con la última iOS disponible. Anotar modelo, versión de iOS y ancho
  lógico (iPhone SE 375 pt, 13/14/15 390 pt, Pro Max/Plus 430 pt). Ideal: un iPhone pequeño (SE) y uno grande.
* **Mac con Safari** (opcional, recomendado): Ajustes del iPhone › Apps › Safari › Avanzado ›
  Inspector web = activado; en el Mac, Safari › Desarrollo › [iPhone] para ver consola, red y
  almacenamiento.
* **URL**: la de producción vigente (despliegue automático de `main`). **No** se crea ningún
  despliegue ni Preview para esta prueba. Si la URL de producción no sirve la build de §1.5, la
  alternativa sin Vercel es servir la build en red local: en un Mac de la misma Wi‑Fi,
  `cd app && npm ci && npm run build && npx vite preview --host` y abrir `http://<IP-del-Mac>:4173`.
* **Estado limpio**: Ajustes › Apps › Safari › Avanzado › Datos de sitios web → borrar los del dominio de prueba. Pestaña normal (no privada) salvo en P-11.4.
* **Evidencia por defecto si algo falla**: ID de la prueba; grabación de pantalla (Centro de
  control › Grabar pantalla) desde el paso 1; captura del estado final; hora; modelo, iOS y URL;
  si hay Mac, captura de la consola y de Almacenamiento › Local Storage. Para fallos de datos,
  exportar un respaldo antes y después (P-11.5) y guardar ambos `.json`.
* Notación: «toque» = un dedo; texto entre «» = texto exacto de la interfaz.

### P-00 Identidad de la build
| | |
|---|---|
| Pasos | 1. Abrir la URL. 2. Con el Mac: Inspector web › Fuentes/Red, localizar el JS de entrada. Sin Mac: anotar la URL y la fecha del último despliegue de `main` que muestre GitHub en el commit `8046464`. |
| Esperado | Entrada `index-D4HWBx5K.js` (≈1 469 kB) o build equivalente por tamaño (§1.5). |
| Bloqueo | No aplica al producto; si la build no es la del RC, **la sesión de QA no es válida**: parar y no evaluar. |
| Menor | — |
| Evidencia | Captura de la pestaña Red con el nombre y el tamaño del JS. |

### P-01 Primer arranque e introducción
| | |
|---|---|
| Pasos | 1. Con datos borrados, abrir la URL en Wi‑Fi. 2. Leer la introducción y avanzar con «Siguiente» hasta el final. 3. Recargar. 4. Borrar datos de nuevo, abrir y cerrar la introducción con «Cerrar la introducción». |
| Esperado | La introducción aparece sólo en el primer arranque, se recorre entera y no reaparece tras recargar; cerrarla también la marca como vista. Sin página en blanco. |
| Bloqueo | Página en blanco o error; la introducción no se puede cerrar; reaparece en cada recarga impidiendo usar la app. |
| Menor | Texto cortado, salto visual al cerrar. |
| Evidencia | Grabación desde la carga; consola del Inspector. |

### P-02 Navegación táctil
| | |
|---|---|
| Pasos | 1. Tocar cada pestaña de la barra inferior: «Explorar», «Quiero ir», «Viaje», «Nosotros», y volver a «Explorar». 2. En Explorar, entrar en «Tokio» (y luego en «Kioto»). 3. Abrir un lugar → ficha. 4. Volver con el botón de la ficha. 5. Abrir otra ficha y volver con el gesto de deslizar desde el borde izquierdo (atrás de Safari). 6. En una ficha con galería, usar «Imagen siguiente»/«Imagen anterior», abrir la imagen ampliada y cerrarla con «Cerrar imagen ampliada». 7. Tocar con el pulgar los botones pequeños (corazón «Quiero ir», «Borrar búsqueda», zoom del mapa) sin precisión especial. 8. Hacer *scroll* rápido por las listas y comprobar que no se activa un lugar por error. |
| Esperado | Cada pestaña cambia de superficie y marca la pestaña activa; atrás (botón o gesto) vuelve a la superficie anterior sin salir de la app ni perder el contexto; todos los objetivos se aciertan al primer toque; el *scroll* no dispara toques. |
| Bloqueo | Una pestaña no responde; el gesto atrás saca de la app o deja una pantalla vacía; un control principal no se puede activar con el dedo. |
| Menor | Objetivo que requiere 2 intentos; resaltado gris de toque de iOS visible; pequeño salto de *layout*. |
| Evidencia | Grabación; en fallos de objetivo, captura con el control señalado y el modelo de iPhone. |

### P-03 Búsqueda global y restauración de *scroll*
| | |
|---|---|
| Pasos | 1. En la portada de Explorar tocar «Buscar en todo Japón». 2. Escribir `a` (cientos de resultados). 3. Desplazar la lista hasta aproximadamente la mitad y fijarse en el lugar que queda arriba del todo. 4. Tocar un resultado → ficha. 5. Volver con el botón de la ficha. 6. Repetir 3–5 volviendo con el gesto atrás de Safari. 7. Repetir 3–5 tocando antes el corazón de un resultado (guardar) y luego el resultado. 8. Repetir 3–5 desplazando y tocando **inmediatamente** un resultado mientras la lista aún se mueve por inercia. 9. Cerrar la búsqueda y volver a abrirla. 10. Tocar «Borrar búsqueda». 11. Buscar un texto sin resultados (`zzzz`). 12. Dentro de una ciudad, repetir 1–5 con «Buscar en {ciudad}». 13. Con el teclado abierto, girar el iPhone y volver a vertical. |
| Esperado | 5–6: la hoja reaparece con la misma consulta y el mismo lugar arriba (tolerancia: ±1 tarjeta). 7: el guardado se conserva y se muestra confirmación con «Deshacer». 8: se restaura la posición en el instante del toque (la inercia puede dejar una diferencia de una tarjeta). 9: al cerrar y reabrir, la lista empieza arriba (cerrar reinicia el *scroll* por diseño). 10: el campo queda vacío. 11: «Sin resultados» con mensaje «Nada con “zzzz” en Japón…». 13: sin contenido detrás del teclado que impida escribir. |
| Bloqueo | Al volver, la búsqueda no reaparece o pierde la consulta; el *scroll* vuelve sistemáticamente arriba (≥ 3 de 5 intentos) en los pasos 5–6; un toque abre un lugar distinto al tocado. |
| Menor | Desfase de 1–2 tarjetas sólo con el paso 8 (observación §2.3); parpadeo al reaparecer; el teclado tapa parte de la lista. |
| Evidencia | Grabación de los 5 intentos con el lugar de referencia visible; anotar «n/5 restauraciones correctas» por paso. |

### P-04 Mapa
| | |
|---|---|
| Pasos | 1. Portada › «Mapa de Japón». 2. Esperar al mapa («Cargando el mapa de Japón…» debe desaparecer). 3. Tocar una región y una prefectura con lugares. 4. Mover el panel inferior con el asa entre posiciones (25 % / 75 %) y colapsarlo. 5. Comprobar la atribución «Fuente del mapa» (MLIT). 6. Entrar en una ciudad y abrir su mapa de lugares (Leaflet). 7. Pellizcar para ampliar/reducir, arrastrar con un dedo, usar los botones + / − del mapa. 8. Tocar un marcador y abrir su lugar. 9. Comprobar la atribución «OpenStreetMap». 10. Hacer *scroll* de la página pasando por encima del mapa. 11. Activar modo avión con el mapa abierto y moverlo a una zona no visitada. |
| Esperado | Mapa nacional visible y operable; el panel se ajusta a las posiciones; marcadores y prefecturas responden; pellizco y botones de zoom funcionan; las atribuciones son visibles y legibles; el *scroll* de página no queda atrapado de forma permanente por el mapa. 11: zonas sin teselas en gris, la app sigue respondiendo. |
| Bloqueo | El mapa no carga con red normal; no se puede abrir un lugar desde el mapa ni desde la lista alternativa; falta la atribución de OSM o MLIT; la página queda bloqueada sin poder salir del mapa. |
| Menor | Teselas lentas; el pellizco mueve también la página; marcadores que se solapan en zoom bajo; panel que no queda exactamente al 25/75 %. Teselas que no cargan sólo por la red (OSM/TLS externo, ver B25) = **externo, no bloqueo**. |
| Evidencia | Grabación; en fallos de carga, captura de la pestaña Red con el código HTTP y el dominio de la tesela. |

### P-05 Quiero ir → Viaje
| | |
|---|---|
| Pasos | 1. Guardar con el corazón 6–8 lugares de una misma ciudad (Tokio) y 2 de otra (Kioto). 2. Pestaña «Quiero ir»: comprobar el resumen y los lugares guardados; quitar uno y tocar «Deshacer» en el aviso. 3. Tocar «Llevar al viaje». 4. En Viaje comprobar la subnavegación «Días · Dónde dormir · Reservas · Resumen». |
| Esperado | Los guardados aparecen en Quiero ir; «Deshacer» restaura el lugar quitado; «Llevar al viaje» los pasa a Viaje sin duplicados. |
| Bloqueo | Un lugar guardado no aparece; «Deshacer» no restaura; los lugares no llegan a Viaje. |
| Menor | Orden de lista inesperado sin pérdida; aviso que se va antes de poder tocar «Deshacer» (anotar tiempo). |
| Evidencia | Grabación; respaldo exportado antes y después (P-11.5). |

### P-06 Viaje › Días
| | |
|---|---|
| Pasos | 1. Viaje › «Días». Fijar «Fecha de inicio (Día 1)» con el selector de fecha de iOS. 2. «Añadir día» hasta tener 3 días. 3. Mover una parada con su asa («Arrastrar {lugar}»): mantener y arrastrar con el dedo a otra posición del mismo día y luego a otro día. 4. Hacer lo mismo con la alternativa «Mover a…». 5. Mover una parada a «Sin asignar» y devolverla con «Elegir de Sin asignar» / «Añadir al día…». 6. Reordenar un día completo con «Mover Día N a la posición…». 7. Intentar «Eliminar Día N» en un día con paradas; vaciarlo (mover sus paradas a «Sin asignar») y eliminarlo. 8. Abrir la ficha de una parada desde Días y volver. 9. Visitar «Dónde dormir», elegir una zona («Dormir aquí») y quitarla («Quitar»). 10. Visitar «Reservas» y «Resumen»; usar «Ver Días» / «Ver Dónde dormir» desde Resumen. 11. Recargar la página. |
| Esperado | Las fechas de cada día se derivan de la fecha de inicio; el arrastre táctil muestra la tarjeta flotante «Día N, posición k de n» y la barra de inserción, mientras arrastra la página no se desplaza sola de forma incontrolada ni aparece el menú de copiar/seleccionar de iOS; «Mover a…» consigue el mismo resultado; «Eliminar Día N» está deshabilitado mientras el día tiene paradas (y si sólo queda un día) y se habilita al vaciarlo; al volver de la ficha se está en la misma sección y posición; tras recargar todo sigue igual. |
| Bloqueo | Un lugar desaparece al moverlo/eliminar un día; el orden guardado no coincide con el mostrado tras recargar; no hay forma táctil (asa ni «Mover a…») de reordenar; el selector de fecha no permite fijar la fecha. |
| Menor | Arrastre con poca precisión cerca de los bordes (el auto-*scroll* tarda); selección de texto ocasional al mantener; menú de iOS que aparece sin bloquear la acción. |
| Evidencia | Grabación del arrastre; respaldo antes/después (P-11.5); en pérdidas, captura de «Sin asignar» y de todos los días. |

### P-07 Probar otro orden
| | |
|---|---|
| Pasos | 1. En un día con 1 parada: el botón «Probar otro orden del Día N» está deshabilitado («Un solo lugar no tiene otro orden distinto.»). 2. En un día con 3–5 paradas: tocarlo. 3. Comprobar «Orden actual», «Propuesta», «Comparación de traslados» y «Opciones comprobadas». 4. «Usar este orden» deshabilitado y texto «La propuesta coincide con el orden actual.». 5. Cambiar una posición con «Mover a…» de la Propuesta (rueda de selección de iOS). 6. Tocar «Cancelar» → reabrir: el orden del día no ha cambiado. 7. Repetir 5 y, si hay «Opciones comprobadas», cargar una («La opción se cargó en Propuesta. Todavía no se ha usado en el viaje.»). 8. Tocar «Usar este orden». 9. Recargar. 10. Leer todo el texto del panel buscando «mejor», «óptimo», «recomendado», «ahorra», puntuaciones o *rankings*. |
| Esperado | El panel no escribe nada hasta «Usar este orden»; «Cancelar» y «Cerrar Probar otro orden» no cambian el viaje; aplicar cambia el orden del día una vez y persiste tras recargar; alojamiento y otros días intactos; ningún vocabulario de optimización. |
| Bloqueo | Cancelar/cerrar cambia el viaje; aplicar escribe un orden distinto al mostrado o toca otros días/alojamiento; no persiste; cualquier texto de optimización (criterio 7). |
| Menor | La rueda de iOS tapa la propuesta; el panel no queda centrado tras aplicar. «No hay opciones comprobadas con datos completos para este día.» es un resultado válido, no un defecto. |
| Evidencia | Grabación; respaldo antes y después de aplicar; captura de cualquier texto sospechoso. |

### P-08 *Responsive* y orientación
| | |
|---|---|
| Pasos | 1. Recorrer Explorar, ficha, búsqueda, Quiero ir, Viaje › Días/Dónde dormir/Reservas/Resumen y Nosotros en vertical. 2. Girar a horizontal en cada una. 3. Safari › menú «aA» › tamaño de texto 150 % y repetir 1. 4. Ajustes › Pantalla y brillo › Tamaño del texto al máximo (sin «Tamaños más grandes») y repetir 1. 5. Si hay iPad: vertical y horizontal (debe aparecer la navegación lateral). 6. Comprobar la barra inferior respecto al indicador de inicio y la isla/notch. |
| Esperado | Sin *scroll* horizontal de página; ningún texto ni botón cortado o superpuesto; la barra inferior no queda bajo el indicador de inicio; el contenido no queda bajo la isla/notch. |
| Bloqueo | Un control principal queda fuera de pantalla o tapado sin forma de alcanzarlo; *scroll* horizontal que impide leer contenido. |
| Menor | Márgenes desiguales, saltos de línea feos, franja blanca en horizontal junto a la isla (D0b-02 `viewport-fit=cover`, POST-V1). |
| Evidencia | Capturas por superficie, orientación y tamaño de texto, con modelo de iPhone. |

### P-09 Accesibilidad básica con VoiceOver
| | |
|---|---|
| Pasos | 1. Ajustes › Accesibilidad › VoiceOver (o triple clic lateral). 2. En Explorar, deslizar a la derecha elemento a elemento desde arriba: debe anunciarse el encabezado principal y la región principal. 3. Rotor › Encabezados: navegar por encabezados. 4. Llegar a la barra inferior («Navegación principal»): cada pestaña se anuncia con su nombre y la activa como seleccionada. 5. Doble toque en «Buscar en todo Japón», escribir con el teclado, recorrer «Resultados de la búsqueda», activar un resultado y volver. 6. En la ficha, activar «Quiero ir» y oír el cambio de estado («Ya lo quieres ver»). 7. Oír el aviso de guardado y activar «Deshacer». 8. Viaje › Días: recorrer «Paradas del Día N»; mover una parada con «Mover a…» (sin arrastrar). 9. Abrir «Probar otro orden», cambiar la propuesta y aplicar sólo con VoiceOver. 10. Abrir y cerrar una hoja/diálogo (búsqueda, imagen ampliada, introducción) con su botón y con el gesto de escape (frotar con dos dedos en Z). 11. Galería: «Imagen siguiente», «Créditos de las fotografías». |
| Esperado | Todos los controles tienen nombre en español y rol; el foco no se escapa detrás de una hoja abierta; al cerrar, el foco vuelve al control que la abrió; los cambios de estado se anuncian; todas las acciones de 5–9 se completan sin ver la pantalla. |
| Bloqueo | Criterio 5: control de un flujo principal sin nombre o imposible de activar; foco atrapado sin salida; reordenar o aplicar «Probar otro orden» imposible con VoiceOver. |
| Menor | Anuncios redundantes; orden de lectura mejorable; el gesto de escape no cierra una hoja (sí lo hace su botón); foco que vuelve al inicio en vez de al control de origen. |
| Evidencia | Grabación de pantalla **con audio** (la grabación de iOS recoge la voz de VoiceOver) y la transcripción del anuncio problemático. |

### P-10 Rendimiento percibido
| | |
|---|---|
| Pasos | 1. Wi‑Fi desactivada (datos móviles 4G/5G), datos del sitio borrados, cerrar Safari desde el selector de apps. 2. Abrir la URL y cronometrar hasta ver contenido utilizable y hasta poder tocar una ciudad. 3. Repetir con caché (segunda carga). 4. Búsqueda global con `a`: *scroll* rápido de arriba abajo. 5. Ficha con galería: pasar imágenes. 6. Días con 3 días y ≥ 10 paradas: arrastrar y abrir «Probar otro orden». 7. Usar 10 minutos seguidos alternando pestañas. 8. Con Ajustes › Accesibilidad › Movimiento › Reducir movimiento activado, repetir 2 y 6. |
| Esperado | Contenido visible en pocos segundos en datos móviles y casi inmediato con caché; *scroll* fluido; las respuestas a toques se perciben inmediatas; sin recargas forzadas de Safari tras 10 minutos; con Reducir movimiento no hay animaciones de desplazamiento. |
| Bloqueo | Criterio 4 (recarga forzada/cuelgue reproducible); pantalla en blanco > 10 s en 4G con buena cobertura; congelación ≥ 2 s repetible en una interacción principal. |
| Menor | Primer contenido lento sólo en la primera carga; tirones puntuales en el *scroll* de 200+ tarjetas; aparición progresiva de fotos. |
| Evidencia | Grabación con cronómetro visible o anotación de tiempos (3 repeticiones), tipo de red e intensidad de señal; con Mac, línea de tiempo del Inspector. |

### P-11 Persistencia y recarga
| | |
|---|---|
| Pasos | 1. Con el estado de P-05/P-07 (guardados, días, fecha, orden aplicado, zona de dormir), recargar. 2. Cerrar la pestaña, abrir otra con la URL. 3. Forzar cierre de Safari, reabrir. 4. Abrir la URL en una **pestaña privada**: hacer un guardado y comprobar si aparece «No pudimos guardar los cambios en este dispositivo. Pueden perderse al cerrar la app.» con «Reintentar». 5. Nosotros › «Copia del viaje» › «Exportar respaldo»: guardar el `.json` en Archivos. 6. Borrar datos del sitio (Ajustes de Safari), abrir la URL (estado vacío), «Importar respaldo» › «Elegir un archivo de respaldo» desde Archivos, revisar el resumen (Personas, Lugares en «Quiero ir», Días planificados, Fechas, Zonas elegidas…) y confirmar. 7. Importar un archivo que no sea respaldo (p. ej. una foto renombrada o un `.txt`). 8. Nosotros › «Viajeros»: «Reiniciar» lo de una persona y **cancelar**; luego hacerlo de verdad. 9. Abrir «Probar otro orden» sin aplicar, recargar: el panel no persiste y el orden no cambió. |
| Esperado | 1–3: todo idéntico. 4: o bien guarda con normalidad durante la sesión, o bien muestra el aviso; nunca falla en silencio. 6: «Respaldo restaurado en este navegador.» y el estado es exactamente el exportado (importar **reemplaza**, no fusiona: diseño de Block 13). 7: «Este archivo no es un respaldo de Nihon.» / «El archivo no parece un respaldo de Nihon.» y «Tus datos anteriores siguen como estaban.». 8: cancelar no cambia nada; confirmar sólo afecta a esa persona. 9: sin escritura. |
| Bloqueo | Criterio 1 o 2 en cualquier paso; el respaldo no se puede exportar o importar en iPhone; un archivo inválido altera los datos. |
| Menor | El selector de Archivos muestra nombres poco claros; el aviso de pestaña privada no aparece pero los datos sí se mantienen durante la sesión. |
| Evidencia | Los `.json` exportados (antes/después), capturas del resumen de importación, Almacenamiento › Local Storage del Inspector antes y después. |

### P-12 Fotografías y recursos externos
| | |
|---|---|
| Pasos | 1. Recorrer 10 fichas de ciudades distintas (incluidas Tokio, Kioto, Osaka, Okinawa) mirando la foto principal y la galería. 2. Abrir «Créditos de las fotografías» en 3 fichas: comprobar «Autoría», «Licencia», «Fuente» y enlace «Archivo de Commons». 3. Nosotros › «Fuentes y licencias». 4. Activar modo avión con una ficha abierta, pasar a una imagen no vista: aparece «No se pudo cargar la imagen.» con «Reintentar imagen»; desactivar modo avión y reintentar. 5. Lugar sin foto: «Sin fotografía disponible todavía». 6. Viaje › «Dónde dormir»: zonas con sustituto fotográfico. 7. Tocar un enlace externo de créditos (Commons) y volver a la app. |
| Esperado | Las fotos corresponden al lugar, sin deformar ni pixelar; cada foto tiene crédito accesible; los fallos de red muestran el estado de error y se recuperan con «Reintentar imagen»; el sustituto de zona es intencionado; los enlaces externos abren y se vuelve a la app con el estado intacto. |
| Bloqueo | Criterio 6 (foto sin crédito/licencia); foto que no corresponde al lugar (error de contenido); imagen rota sin estado de error ni reintento que deja la ficha inutilizable. |
| Menor | Foto lenta o recorte poco favorable; sustituto de zona (POST-V1: fotografías reales de zona); enlace externo que tarda. |
| Evidencia | Captura de la ficha con el nombre del lugar y la foto, y del crédito; en errores de carga, Red del Inspector con la URL de la imagen y el código. |

### 3.1 Registro de resultados
Para cada ID: `PASS` / `MENOR (descripción)` / `BLOQUEO (criterio n.º de §2.1)` + evidencia. El RC se
acepta físicamente si no hay ningún `BLOQUEO`. Los `MENOR` se registran como deuda POST-V1 sin
reabrir el desarrollo. Un `BLOQUEO` se reproduce primero en una segunda sesión limpia (P-00 +
estado limpio) antes de abrir ninguna corrección.
