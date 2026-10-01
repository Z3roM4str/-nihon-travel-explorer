# B10-P1 — Rendimiento de arranque: cierre

**Estado: CERRADO** (release hardening post-B10). Sin cambio de UX, contenido, datos canónicos ni fotografías.
Medición reproducible: `node scripts/b10-p1-baseline.mjs [--app <dir>]` (Chromium 141, `vite preview`, mediana de 7 cargas en frío tras calentamiento). Evidencia cruda:
[before](B10_P1_BASELINE_BEFORE.json) · [after](B10_P1_BASELINE_AFTER.json).

## Diagnóstico exacto (entry de main `8aa7d1d`)
| Bloque del entry | raw | nota |
|---|---|---|
| `react-dom` | 453 KB | |
| `places.json` | 407 KB (57,7 KB gzip) | necesario en la primera pintura (Explorar/hubs) |
| `photography-metadata.json` | **351 KB** (140,8 KB gzip) | **148 KB de LQIP base64** + URLs/fechas de adquisición + dimensiones originales |
| `walking-scale-results.json` | 277 KB (10,7 KB gzip) | sólo `lib/transfer.ts` |
| `leaflet` | 242 KB | |

Hallazgo decisivo: **el runtime no lee `lqip`, `acquisitionUrl`, `acquisitionDate`, `originalWidth/Height`, `role` ni `licenseBasis`.** `buildRegistry`
(`data/place-images.ts`) copia once campos a `PlaceImage`; el resto se enviaba a cada visitante sin usarse. (`PlaceGallery.css` cita el LQIP de `04 §6`, pero el fondo real es
`--surface-sunken`; ningún código lo consume.) Con el registro v1.1.0 (140 KB raw, 129 KB en el entry) el crecimiento era 2,7× sobre todo por esos campos.

## Arquitectura elegida y por qué no otra
* **Proyección en build**: `photography-metadata.json?runtime` (plugin en `vite.config.ts`, `src/data/photography-runtime-projection.ts`). El JSON canónico (que escribe el pipeline y leen
  validadores/gates) **no cambia**; no hay segunda copia que pueda divergir.
* **No se difirió por ciudad**: la home de Explorar pinta fotos de varios hubs con `loading="eager"` en la primera pantalla (DDR-MERGE-1 §2) y `ExplorerHome`, `Onboarding`, `PlaceCard` y
  el buscador resuelven imágenes de forma **síncrona** durante el primer render. Diferir el registro (aunque fuese por ciudad) introduciría un segundo viaje de red *antes* de pedir la primera
  imagen (cascada peor) o tarjetas sin foto en la primera pintura (cambio observable). Con el 78 % del peso inútil eliminado, lo que queda del registro (≈ 25 KB gzip) no justifica ese riesgo.
* **`walking-scale-results.json` no se difirió**: 10,7 KB gzip, API síncrona (`transfer.ts` la consumen 20+ módulos y `PlaceDetail`); ganancia < 4 % del entry frente a un refactor asíncrono de la ruta de montaje.
* `OrderedSequenceBuilder`/`ZoneComparison` ya estaban diferidos (BLOCK_12) y siguen fuera de la ruta crítica.

## Before / after (390×844 @2, Chromium 141)
| Métrica | main `8aa7d1d` | hardening | Δ |
|---|---|---|---|
| Entry raw | 1 669 376 B | 1 470 575 B | −11,9 % |
| **Entry gzip** | **390 436 B** (+53,9 % vs v1.1.0) | **277 912 B** (+9,5 % vs v1.1.0) | **−28,8 %** |
| Entry brotli | 327 101 B | 222 344 B | −32,0 % |
| LQIP base64 en el entry | 244 | 0 | |
| URLs de adquisición en el entry | 244 | 0 | |
| CSS gzip | 21 012 B | 21 012 B | 0 |
| FCP sin estrangular (mediana) | 424 ms | 436 ms | ruido (rango 368–496 / 360–500) |
| FCP 4G rápida + CPU×4 (mediana) | 2 004 ms | 1 924 ms | −4 % |
| `domContentLoaded` 4G + CPU×4 | 893 ms | 765 ms | −14 % |
| Descarga del entry 4G (waterfall) | 63→474 ms | 60→376 ms | −98 ms |
| Peticiones JS/CSS antes de FCP | 2 | 2 | 0 |
| Imágenes antes de FCP | 11 | 11 | 0 |
| Peticiones totales | 26 | 26 | 0 |
| Chunks diferidos | tras FCP (≈ 580 ms) | tras FCP (≈ 570 ms) | idéntico |
| Presupuesto por hub (Tokio/Kioto/Osaka/Okinawa, móvil y escritorio) | 12/12 | 12/12 | idéntico |

Las imágenes, sus bytes y su orden de petición no cambian (mismos 26 requests). El +9,5 % restante respecto a v1.1.0 es código de B25–B31 y datos de `places.json`.

## Equivalencia funcional (qué la demuestra)
* `src/data/photography-runtime-projection.test.ts`: `placeImages` (lo que la UI ve) **es `toEqual`** al registro construido desde el JSON completo; mismas 244 imágenes y orden; ningún campo fuera de la lista;
  y `buildRegistry` produce el mismo resultado con todos los campos no proyectados puestos a `undefined` (si alguien empieza a leer `lqip`, el test obliga a ampliar la proyección).
* Gate `b10-performance-check` (13/13): J01 techo ratcheteado a 285 000 B (antes 392 000), **J01b** (ni LQIP ni URLs de adquisición en el entry: la invariante real), J03/J04 y los 8 presupuestos por hub.
* Vitest 117 archivos / 3 505 pruebas.
