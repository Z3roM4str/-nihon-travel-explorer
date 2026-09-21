# Bloque 20 (B4) — Inventario de `PlaceDetail` y matriz de destino

> **Para qué sirve este fichero.** `05 §5` y `10 §B4` exigen que **ningún dato desaparezca** y que
> «cada campo de `PlaceDetail` v1.1.0 aparezca en la ficha nueva; lista firmada». Esta es esa
> lista. Se escribe **antes** de tocar código, y es el guardián: si al terminar hay una fila sin
> destino verificado, B4 no está cerrado.

**Rama:** `claude/block-20-b4-place-detail-photography` · **Base:** `62050c2` (= `7b8f54f` + el
registro de las dos precisiones de DDR-03) · **Fecha:** 2026-09-21

---

## 1. Matriz: qué hay hoy → dónde va

Orden de la columna «destino» = los 14 puntos de `05 §5`. «Hoy» es el render actual de
`app/src/components/PlaceDetail.tsx` (394 líneas) y `PlaceGallery.tsx` (294).

### Galería y fotografía

| # | Hoy | Dónde está | Destino B4 (`05 §5`) | Cambia |
|---|---|---|---|---|
| 1 | `images[].url` + `srcSet` | `gallery__image` | pt. 1 — galería a sangre **4:5** (4:3 en `md`+) | Proporción y `scroll-snap` |
| 2 | `images[].alt` | `alt` de la imagen | pt. 1 — igual | No |
| 3 | Contador `n / total` | `gallery__counter`, sólo si `total > 1` | pt. 1 — píldora abajo-derecha, `--type-num` | Posición y estilo |
| 4 | Flechas prev/next | `gallery__nav`, sólo si `total > 1` | `04 §6` — **sólo en `md`+** | Se ocultan en teléfono |
| 5 | Puntos | `gallery__dots`, sólo si `total > 1` | `04 §6` — **sólo con ≤5 imágenes** | Tope de 5 |
| 6 | Lightbox (original, `×`, trampa de foco) | `lightbox` | `04 §6` — se conserva; la trampa de foco «es correcta» | No |
| 7 | `imageBrief` (sin foto) | `PhotoPlaceholder` vía `brief` | `04 §9` — se conserva | No |
| 8 | **`images[].source` + `sourceUrl`** | `<Attribution>` **en el flujo, entre foto y cuerpo** | pt. 1 + `04 §7` — **`CreditsSheet` tras `ⓘ`** | **Sale del flujo (D2)** |
| 9 | **`images[].credit`** (autor) | ídem | `CreditsSheet` | **Sale del flujo** |
| 10 | **`images[].license` + `licenseUrl`** | ídem | `CreditsSheet` | **Sale del flujo** |
| 11 | **`images[].sourceFileTitle`** | ídem («Archivo de Commons: …») | `CreditsSheet` | **Sale del flujo** |
| 12 | **`images[].attributionTitle`** | ídem («Título de atribución: …») | `CreditsSheet` | **Sale del flujo** |
| 13 | **`images[].processing`** | ídem (nota de reprocesado) | `CreditsSheet` | **Sale del flujo** |
| 14 | «Imagen n de total» (lector de pantalla) | `visually-hidden role=status` | Se conserva | No |

> `04 §7` es explícito: «toda la información de atribución actual se conserva íntegra; sólo cambia
> de sitio». Las filas 8–13 son exactamente esa información.

### Cabecera y acciones

| # | Hoy | Dónde está | Destino B4 | Cambia |
|---|---|---|---|---|
| 15 | `category` (etiqueta colapsada) | `place-detail__eyebrow` | pt. 4 — **una línea** `icono · categoría · barrio` | Deja de ser eyebrow |
| 16 | `neighborhood \|\| municipality` | ídem | pt. 4 — misma línea | No |
| 17 | `name` | `<h2 id="place-detail-title">` | pt. 3 — `--type-display` | Tipografía |
| 18 | `japaneseName` | `place-detail__japanese` `lang="ja"` | pt. 3 — debajo, `--ink-500` | No |
| 19 | `grade` → nivel de interés (glifo + etiqueta) | `tag tag--grade-*` | pt. 5 — insignia **sólo si grado S**; el resto no muestra insignia | **A/B/C/D dejan de rotularse** |
| 20 | `grade` (letra cruda) | Sólo clase CSS; **no visible** hoy | pt. 14 — **«Fuentes»**, plegado (DDR-04) | Reaparece, dentro de Fuentes |
| 21 | `hiddenGemStatus` | `tag tag--gem` | Chip/etiqueta en cabecera (se conserva) | Por confirmar en maquetación |
| 22 | `tourismLevel` | `tag tag--muted` «Turismo: X» | pt. 10 — fila **«Afluencia»** de datos prácticos | Baja al bloque práctico |
| 23 | `reservation` → etiqueta | `tag ${reservation.tag.className}` | pt. 10 — fila «Reserva» | Se unifica con la fila |
| 24 | Botón «Quiero ir» / «Guardado en Quiero ir» | `save-button` | pt. 6 — `primary lg` a ancho completo | Copy: `05 §5` dice «Ya lo quieres ver» |
| 25 | «No me interesa» | `place-interest__decline` | pt. 6 — botón `quiet` **junto** al primario | Sube junto al primario |
| 26 | «Ver en el mapa» (sólo origen Viaje) | `place-detail__view-on-map` | Se conserva (DD-015) | No |
| 27 | Chevron atrás / `×` cerrar | `place-detail__bar` | `05 §5` — botón atrás **flotante** sobre `--scrim-top`; el `×` flotante **desaparece** (D4) | **Reestructura** |

### Cuerpo editorial

| # | Hoy | Dónde está | Destino B4 | Cambia |
|---|---|---|---|---|
| 28 | Franja de los dos (`stanceLines`) | `place-interest__lines` | pt. 7 — **una línea**, sólo si alguien ha opinado | **Condicional (D8)** |
| 29 | `description` | `place-detail__description` | pt. 9 — «Qué es» | Gana título |
| 30 | `differentiator` | `highlight` | pt. 8 — `--type-quote`, `--font-voice`, filete `--shu-600` 2 px | **Tratamiento nuevo** |
| 31 | `experience` (si difiere) | «Qué se hace o se ve» | pt. 9 — igual | No |

### Datos prácticos

| # | Hoy | Dónde está | Destino B4 | Cambia |
|---|---|---|---|---|
| 32 | `duration` (`raw`/`min`/`max`) | `QuickFact` «Tiempo de visita» | pt. 10 — rejilla 2 col. + `EvidenceMark` | Gana marcador |
| 33 | `price` (`currency`/`min`/`max`) | `QuickFact` «Precio» | pt. 10 — ídem | Gana marcador |
| 34 | `bestTime` | `QuickFact` «Mejor momento» | pt. 10 — ídem | Gana marcador |
| 35 | `bestSeason` | `QuickFact` «Mejor época» | pt. 10 — ídem | Gana marcador |
| 36 | `schedule.hours` | `Row` «Horario» | pt. 10 — fila + `EvidenceMark` | Gana marcador |
| 37 | `schedule.closures` | `Row` «Cierres» | pt. 10 — ídem | Gana marcador |
| 38 | `reservation.practicalRow` (`required`, `leadTime`, `raw`) | `Row` «Reserva» | pt. 10 — ídem | Gana marcador |
| 39 | `transport` | `Row` «Cómo llegar» | pt. 10 — ídem | Gana marcador |
| 40 | `accessibility` | `Row` «Accesibilidad» | pt. 10 — ídem | Gana marcador |
| 41 | `crowdLevel` | `Row` «Aglomeración» | pt. 10 — fila «Afluencia» | Renombrada (`05 §5` dice «afluencia») |
| 42 | Títulos en mayúsculas | CSS de `detail-rows` | pt. 10 — **caja de frase** | Sí |

### Aviso y enlaces

| # | Hoy | Dónde está | Destino B4 | Cambia |
|---|---|---|---|---|
| 43 | `febMar2027.status` | `alert__status` | pt. 11 — **sólo si problema real**; si «pendiente», una línea dentro de «Horario» con `◧` | **Condicional (DD-011)** |
| 44 | `febMar2027.warning` | `alert` | pt. 11 — ídem | Condicional |
| 45 | `febMar2027.action` | `alert__action` «Qué hacer:» | pt. 11 — ídem | Condicional |
| 46 | Severidad (icono + etiqueta) | `alert__severity` | pt. 11 — ídem | Condicional |
| 47 | `officialUrl` | `link-row` | pt. 13 — «Sitio oficial»; **además** en «Fuentes» (pt. 14) | Duplicado deliberado |
| 48 | `googleMapsUrl` | `link-row` | pt. 13 — «Google Maps» | No |

### Cerca de aquí, y pie

| # | Hoy | Dónde está | Destino B4 | Cambia |
|---|---|---|---|---|
| 49 | `nearbyIds` → nombre del destino | `nearby-item__name` | pt. 12 — **`PlaceCard compact` con miniatura** | **Lista de texto → carrusel** |
| 50 | `relation["Relación"]` | `nearby-item__relation` | pt. 12 — metadato del compact | Reubicado |
| 51 | `relation["Distancia km"]` / `transfer.distanceText` | `nearby-item__distance` | pt. 12 — distancia | Reubicado |
| 52 | `relation["Modo"]` / `transfer.timeText` | `nearby-item__mode` | pt. 12 — modo | Reubicado |
| 53 | Calidad del traslado (`qualityLabel`) | `nearbyQualityClassName` | pt. 12 — **`EvidenceMark`**: `validated-static` → `◼`, geográfica → `◇` | Pasa a marcador |
| 54 | `transferListFootnote` | `place-detail__footnote` | pt. 12 — **el marcador la sustituye** (DDR-06 (a)): la nota deja de renderizarse y su semántica pasa al `detail` del `EvidenceMark` de **cada** traslado | **Reubicada, no perdida** |
| 55 | `updatedAt` | «Datos actualizados el …» | pt. 14 — **«Fuentes»**, plegado, como **fecha de actualización del registro** (DDR-04); nunca como fecha de consulta | Baja a Fuentes |

### Campos de `Place` que hoy NO se renderizan en la ficha

`hub`, `region`, `prefecture`, `cluster`, `mapTitle`, `type`, `coordinates`, `alternativeTo`,
`duration.planningBlock`, `duration.variability`, `price.mxnMin`, `price.mxnMax`.

**No entran en B4.** «Ningún dato desaparece» protege lo que la ficha muestra hoy; no obliga a
estrenar campos que nunca se mostraron. Quedan anotados para que nadie los confunda con una
pérdida.

---

## 2. Lo que ya está resuelto y no hay que rehacer

- **`EvidenceMark`** existe (B19, `04 §2`), con los cuatro niveles y su modo sólo-glifo.
- **`PlaceCard` variante `compact`** existe (B19, `04 §5.10`) — es lo que pt. 12 pide.
- **`Sheet`** existe (`04 §8`) — es el contenedor de `CreditsSheet`.
- **Contador/puntos/flechas ya se ocultan con una sola imagen.** El criterio de aceptación «con
  una sola imagen no hay puntos, contador ni flechas» **ya se cumple**; B4 añade el tope de 5
  puntos y que las flechas sean sólo de `md`+.
- **La letra de grado ya no aparece en ninguna parte.** B4 la **devuelve**, dentro de «Fuentes».

---

## 3. Contradicciones normativas encontradas — RESUELTAS el 2026-09-21

Se registraron en `09` como DESIGN DECISION REQUIRED antes de implementar, conforme al protocolo,
y se cerraron antes de tocar código. Texto completo en `09`.

- **DDR-04 — RESUELTA, opción (a).** «Fuentes» sólo muestra evidencia que realmente existe: grado
  original, `updatedAt`, enlace oficial y cualquier otro enlace que el contrato ya reconozca como
  fuente real. **No se crean ni se derivan** `provenance`, `consultedAt`, frescura por lugar ni
  versión del dataset, ni ninguna etiqueta equivalente inferida desde `updatedAt`, que significa
  únicamente «cuándo se actualizó el registro». **No se muestran placeholders** de campos
  inexistentes. Ampliar el dataset no entra en B20.
- **DDR-05 — RESUELTA, opción (a).** El criterio se acota a la superficie B4: `Dato:` no aparece
  en `PlaceDetail` ni en ninguna superficie que B20 introduzca. **B20 no modifica
  `OrderedSequenceBuilder.tsx` ni el planificador**; la retirada global sigue en B9.5. Se mantiene
  un gate que garantiza que la ficha no la introduce.
- **DDR-06 — RESUELTA, opción (a).** En «Cerca de aquí» cada tarjeta compacta lleva su
  `EvidenceMark` y `transferListFootnote` deja de mostrarse; no queda párrafo de descargo. La
  información que la nota comunicaba **se traslada** al `detail` accesible del marcador de cada
  traslado: ruta validada estática (no horario en vivo), estimación geográfica (no ruta validada),
  horario en vivo cuando lo haya, y el *fallback* sin traslado, que sigue siendo estimación. Sin
  procedencia nueva y sin ascensos de confianza.

**Ninguna bloquea ya. La matriz completa es implementable.**
