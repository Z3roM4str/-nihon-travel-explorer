# Verificación ítem a ítem de los gates obsoletos (Fase 6 del endurecimiento post-B10)

`GATE_AUTHORITY.md` §3 clasificaba 19 gates como «obsoletos» con la cobertura vigente «por criterio de ingeniería, **no verificada ítem a ítem**». Esta página es esa verificación.

**Método.** Para cada gate: (1) se enumeraron sus aserciones (≈ 700 en total, por título); (2) se ejecutó contra la build actual para localizar el punto exacto donde deja de ser válido; (3) se comprobó, aserción por aserción, si el fallo era **de la entrada** (el gate recorre una interfaz que ya no existe) o **de la invariante** (el producto cambió de contrato); (4) se **reescribió** el gate cambiando sólo la entrada —así conserva toda su cobertura— y, donde la premisa desapareció, se registró la aserción retirada con el gate/prueba vigente que cubre su invariante, creando una prueba moderna cuando no existía.
Ningún gate se retiró por ser viejo. Resultado: **16 gates reescritos y verdes en 3 viewports, 1 gate nuevo que hereda los 4 `phase3e` (que se archivan con el componente heredado que medían)**.

Entrada común: `scripts/lib/modern-trip.mjs` siembra un viaje real (borrador V8 + personas) y abre las superficies por la interfaz vigente (Viaje › Dónde dormir, «Dónde dormir en {ciudad}», Nosotros › Copia del viaje…). **Prueba de mutación** (3 mutaciones en una copia: disclosure de valoraciones abierta, etiqueta de fuente «operador» alterada, «criterio de Nihon» cambiado): `block3` falla 1, `block7` falla 2 y `block9` falla 13 — los gates reescritos detectan regresiones, no son vacuos.

## Resumen
| Gate | Antes (contra main) | Ahora (Chromium, 3 viewports) | Qué cambió | Aserciones retiradas (premisa) → cobertura vigente |
|---|---|---|---|---|
| block1-ux | 20 ✓ y se cuelga | **153 ✓ / 0 ✗** | contador de «Quiero ir» → insignia de la pestaña (`.tab-bar__badge`) | ninguna |
| block2-photography | 23 ✓ y se cuelga | **81 / 0** | miniatura de guardados → fila `.quiero-ir__row` (sigue exigiendo -800w) | ninguna |
| block3-zones | falla al abrir | **99 / 0** | entrada Viaje › Dónde dormir; vocabulario de evidencia | «el orden sale de los guardados» → orden de catálogo (b30); Escape → «Volver a las zonas»/«Cerrar dónde dormir» (b30) |
| block4-zone-planner | falla al abrir | **258 / 0** | viaje de 2 ciudades sembrado en 2 días; Dónde dormir + Días › herramientas | recuento del panel de guardados (B25); diálogo modal/Escape (B31); «vista de ruta» (D5-M1) |
| block7-zone-provenance | falla al abrir | **129 / 0** | entrada; «Hechos»/«Cálculo» | ninguna |
| block8-airport-link | falla al abrir | **114 / 0** | entrada | énfasis de la directitud (ver «B30 y `zone-fact--strong`») |
| block9-editorial-governance | falla al abrir | **153 / 0** | entrada; etiquetas → encabezados con EvidenceMark; lector A/B en Nosotros | `.zone-column__tag` → «Hechos ◧ Registrado / Cálculo … Estimado / Opinión · Nihon dice ✎» |
| block10-source-freshness | falla al abrir | **81 / 0** | entrada | ninguna |
| block13-portable-backup | se cuelga | **150 / 0** | viaje sembrado y adoptado; respaldo = sección de Nosotros | botón de cierre del diálogo y Escape que lo cierra → b26 (B-ESCAPE, B-CONFIRM-FOCUS…) |
| block14-release-readiness | 8 ✓ 3 ✗ | **229 / 0** | primera pintura = portada; búsqueda = hoja; carta = `.place-card__open`; ciudades por título de cabecera | «el mapa nacional en la primera pintura» → portada + mapa a petición; diálogos de respaldo/zonas/planificador → pestañas |
| phase4c / 4d / 4j / 4l | locator estricto | **PASS ×4** | galerías con 2–3 fotos: se mide la de identidad (primer registro); fallback con un lugar sin foto derivado de los datos | «Takeshita/Nezu/JP-140 sin foto» → ganaron foto (B6.x autorizado); la invariante se mide con un lugar que hoy no la tiene |
| block22-b6-4 | 488 ✓ 4 ✗ | **492 / 0** | espera por condición en vez de 200 ms | ninguna (la diapositiva 3 SÍ es alcanzable; el reloj fijo no alcanzaba el desplazamiento suave) |
| b24-real-input (P0-2) | 1299/1307 | **1323 / 0** | control de fila de Quiero ir = corazón (área ≥ 44 con `::after`) | `.icon-button--small` en Quiero ir (no existe desde B25) |
| phase3e-e / g / i / k | cuelgan (157 «Quiero ir») | **`evidence-options-check`: 89 / 89** | gate nuevo con las mismas fixtures y cifras | panel «Aplicar» retirado; ver abajo |

## Detalle por familia

### Zonas (block3, 4, 7, 8, 9, 10) — 834 comprobaciones ahora
Las seis medían el panel de comparación de zonas. Lo que se rompió era **sólo el acceso** (`.hub-bar__zones`, panel de guardados, «Usar … en el plan»). Invariantes verificadas como vigentes (todas pasan): 4–7 alternativas reales por ciudad; la comparación nunca llama «mejor» a una zona; tope de 4 con casilla deshabilitada; comparar exige 2; verificables/calculado/criterio diferenciados con palabras y marca; fuentes con nombre, nivel («operador», «fuente secundaria»), sin URL cruda, enlaces con nombre accesible único, foco visible y fuera de trampa, historial del navegador; vuelos con «tren directo/autobús directo/con transbordo» y frase para tecnología asistiva; sin ancho extra ni recortes; valoraciones editoriales tras una disclosure cerrada, con propietario («Nihon»), «no datos verificables», «no se pueden editar», sin puntuaciones ni «x/10», idénticas para las dos personas y no tocadas por un corazón; frescura de fuentes sin fechas crudas; elección de zona → borrador V8, un ancla, sin tramos inventados, sin segunda clave, preservada al recargar, cambio de zona con reconciliación (ancla con trabajo se conserva), quitar zona sin huérfanos; tramo manual `user-entered`; segmento entre ciudades manual; región etiquetada, sin `div` clicables, nombres accesibles; objetivos táctiles; sin desbordes; sin errores.
**Cobertura vigente cruzada**: b30 (475) cubre elección/cambio/quitar con foco, preservación de borrador, recarga y mapa; los tests `ZoneComparison.b30.test.ts`, `ZonePlanSection.test.ts`, `ZoneSources.test.ts` y `lib/zone-*.test.ts` cubren copy y dominio. Lo que **sólo** estos gates medían en navegador (banner, disclosure, procedencia, vuelos, frescura, zona → Días) queda ahora vigilado por ellos reescritos.

### Fotografía (block2, phase4c/d/j/l, block22-b6-4) — 
Medían bytes de rendición (-800w, sin originales), proporción, CLS, galería (contador, flechas md+, puntos ≤ 5, teclado), atribución (CreditsSheet: autor, archivo, título, licencia, procesado, sin afirmaciones legales), lightbox (original, foco), y que los lugares sin foto conservan el respaldo. Todo sigue en vigor y pasa. Los ajustes son de **datos** (más fotos por lugar, fotos nuevas en lugares que antes no tenían): la afirmación se aplica ahora a la fotografía de identidad (primer registro) y a un lugar sin foto elegido de los datos.

### Respaldo y viaje completo (block13, block14)
Cada afirmación sobre el archivo exportado (nombre, formato, versión, sólo `travellers`+`planningDraft`, sin claves/URL/tokens, sin catálogo), la vista previa que no escribe, sustituir (nunca fusionar), archivos inválidos (incl. `__proto__`) y ausencia de peticiones externas se conserva. block14 recorre un viaje de tres ciudades con dos personas, recarga, respaldo, restauración y chunks diferidos. Cambio documentado: la ausencia de `modulepreload` de chunks diferidos se mide en el HTML servido, no en el DOM vivo (`GATE_AUTHORITY` §2.1).

### B30 y `zone-fact--strong` (hallazgo)
`block8` fijaba que el énfasis visual de la directitud de un enlace aéreo lo recibían igual «tren directo» y «autobús directo». B30 (commit `178d1f1`) **retiró ese énfasis** (`zone-fact--strong`) sin dejar decisión documentada. La invariante de equidad entre modos se conserva (ningún enlace se enfatiza; el texto sigue diciendo «tren directo / autobús directo / con transbordo») y la aserción es ahora «si hay énfasis, trata igual a ambos modos». Queda registrado: si Producto quisiera recuperar el énfasis, el gate ya lo constriñe.

### phase3e-e / g / i / k → `evidence-options-check` (nuevo)
Medían el panel «Alternativas locales con evidencia completa» con botón «Aplicar» (retirado: B29 convirtió las alternativas en opciones de «Probar otro orden»). Equivalencia, aserción por aserción:

| Invariante de 3E | Cobertura vigente |
|---|---|
| copy natural de la opción (3E-E «Mover X antes de Y…», G «Intercambiar A y B…», I «Revertir…», K par de bloques) | `evidence-options-check`: patrones por familia («Mover … a la posición N», «Intercambiar …», «Invertir …», «Intercambiar el par …») |
| rangos registrados y su mezcla de evidencia en ambos órdenes (G 1 h 8 min → 1 h, I 1 h 31 → 1 h 12, K 1 h 32 → 1 h 21) | mismo gate, **mismas fixtures y cifras**, y «N/N traslados registrados · N validados» |
| «Ventaja mínima entre los rangos registrados: 8 / 19 / 11 / 7 min» | ya no se escribe como línea (B29: «no presenta A/B ni un score»); el gate comprueba la diferencia derivada de los dos rangos (> 0) |
| vocabulario prohibido («mejor», «recomendado», «ahorras», «garantizada»…) | mismo gate (`FORBIDDEN`) sobre la herramienta; más `DayOrderToolPanel.test.ts` |
| aplicar escribe el orden esperado en el día estable, una vez, conservando `routeIds`; sobrevive a recarga | mismo gate y b29 (E-1…E-5) |
| tras aplicar, nada más demostrable → estado vacío neutro; intercambio de bloques → la reubicación sigue ofreciéndose (K, 1 h 21 → 1 h 14) | mismo gate («No hay opciones comprobadas con datos completos para este día.»; cadena de K) |
| versión del borrador 7 | ahora V8 (el gate lo comprueba) |
Los cuatro scripts originales están archivados en `app/scripts/archive/` (ver `LEGACY_SWAP_RETIREMENT.md`) tras retirar el componente heredado `LocalSwapAlternativesSection` (que los 3E medían y que ya no está montado).

## Qué quedó sin cobertura equivalente (huecos)
Ninguno detectado que no esté cerrado arriba. Lo **no medible** aquí sigue siéndolo (WebKit, Safari/iPhone, lector de pantalla reales).

## Certificación (Chromium 141, build de producción de main `bda5927` + este cambio)
Reescritos, todos en los tres viewports: block1 153 · block2 81 · block3 99 · block4 258 · block7 129 · block8 114 · block9 153 · block10 81 · block13 150 · block14 229 · phase4c/d/j/l PASS ×4 · b6-4 492 · b24-real-input 1 323/1 323. Nuevo: `evidence-options-check` 89/89.
Gates tocados por esta misión, re-ejecutados: b10-motion 17/17 (S08 nuevo; escanea todo el CSS) · b10-microcopy 52/52 · b28 64/64 (la comprobación J mide la invariante real) · b10-a11y 89/89 · D5 30/30.
oxlint: 0 errores, 1 aviso heredado (`PlaceMap.tsx:18`). Los avisos nuevos de scripts se eliminaron.
Límite: sin WebKit en esta sesión (los gates no se repitieron en WebKit); sin Safari/iPhone ni lector de pantalla físicos.
