# Bloque 22 — B6.6: identity para lugares Grado C/D

**Estado:** implementado y certificado en la rama de trabajo; pendiente de integración.
**Rama:** `codex/block-22-b6-6-grade-cd-identity-photography`
**SHA base canónica:** `f74281a75cefe5f45469e1db84e5d4350110dba5`
**Fecha:** 2026-09-24

## 1. Gate inicial y targets derivados

El gate se derivó de `data/places.json` y `data/visual/photography-metadata.json`, sin fijar una lista histórica de targets. Los 10 lugares C/D no tenían registros fotográficos:

| ID | Lugar | Grado | Hub | Fotos actuales | Necesita identity |
|---|---|---:|---|---:|---|
| JP-004 | Takeshita Street | C | Tokio | 0 | Sí |
| JP-032 | Tsukiji Outer Market | C | Tokio | 0 | Sí |
| JP-071 | Arashiyama Bamboo Grove | C | Kioto | 0 | Sí |
| JP-091 | Nishiki Market | C | Kioto | 0 | Sí |
| JP-110 | Tsutenkaku | C | Osaka | 0 | Sí |
| JP-178 | JUNGLIA OKINAWA | C | Okinawa | 0 | Sí |
| JP-056 | Yasaka Kōshin-dō | D | Kioto | 0 | Sí |
| JP-104 | Glico Running Man sign | D | Osaka | 0 | Sí |
| JP-106 | Kuromon Ichiba Market | D | Osaka | 0 | Sí |
| JP-177 | Heart Rock | D | Okinawa | 0 | Sí |

| Grado | Total | Con foto antes | Sin foto / objetivos | Con foto después |
|---|---:|---:|---:|---:|
| C | 6 | 0 | 6 | 5 |
| D | 4 | 0 | 4 | 3 |

Targets reales: **10**. Adquiridas **8** identities; unresolved **2**. Ningún lugar tenía una foto previa que pudiera sustituirse.

El gate también confirmó al inicio: 225 imágenes, 194 lugares con fotografía; S identity 32/32, S experience 17/32, cobertura complementaria S 14/32; A 139/147 + 8 excepciones; B 23/25 + 2 excepciones.

## 2. Adquisiciones identity

Las ocho entradas nuevas son únicamente `role: identity`. Las páginas enlazadas son las páginas originales de Wikimedia Commons, usadas para verificar ubicación, autoría, licencia y dimensiones. La revisión visual comprobó que cada imagen nombra visualmente ese lugar concreto y funciona como portada.

| Lugar | Fuente / archivo original | Autor | Licencia | Original Commons | Archivo local | Bytes original / 800w / 400w | Revisión identity |
|---|---|---|---|---:|---:|---:|---|
| JP-004 Takeshita Street | [File:Takeshita Street, Tokyo, West view 20190418 1.jpg](https://commons.wikimedia.org/wiki/File:Takeshita_Street,_Tokyo,_West_view_20190418_1.jpg) | DXR | CC BY-SA 4.0 | 4819×6651 | 1159×1600 | 280610 / 97826 / 38218 B | Acceso con letrero Takeshita Street y comercios; GPS en la entrada de la calle. |
| JP-032 Tsukiji Outer Market | [File:Tsukiji Outer Market.jpg](https://commons.wikimedia.org/wiki/File:Tsukiji_Outer_Market.jpg) | Christophe95 | CC BY-SA 4.0 | 3777×2833 | 1600×1200 | 277880 / 69896 / 25032 B | Calle geolocalizada dentro de Tsukiji Naka-dōri, con locales y toldos del mercado actual. |
| JP-056 Yasaka Kōshin-dō | [File:Yasaka Koshin-do on Yumemizaka of Kyoto.jpg](https://commons.wikimedia.org/wiki/File:Yasaka_Koshin-do_on_Yumemizaka_of_Kyoto.jpg) | そらみみ | CC BY-SA 3.0 | 3264×2448 | 1600×1200 | 339434 / 79970 / 28702 B | Entrada, pabellón y kukurizaru visibles; identifica el templo además de sus amuletos. |
| JP-071 Arashiyama Bamboo Grove | [File:2021 Sagano Bamboo forest in Arashiyama, Kyoto, Japan.jpg](https://commons.wikimedia.org/wiki/File:2021_Sagano_Bamboo_forest_in_Arashiyama,_Kyoto,_Japan.jpg) | Naokijp | CC BY-SA 4.0 | 3837×2622 | 1600×1093 | 696992 / 131026 / 33900 B | Sendero del bosque con perspectiva despejada, tallos de bambú y GPS dentro de Sagano. |
| JP-091 Nishiki Market | [File:Nishiki ichiba kyoto.jpg](https://commons.wikimedia.org/wiki/File:Nishiki_ichiba_kyoto.jpg) | Pitan | CC BY-SA 3.0 | 2448×3264 | 1200×1600 | 296424 / 81794 / 37020 B | Vista longitudinal del pasillo cubierto y los puestos a ambos lados. |
| JP-106 Kuromon Ichiba Market | [File:黒門市場 2024(2).jpg](https://commons.wikimedia.org/wiki/File:%E9%BB%92%E9%96%80%E5%B8%82%E5%A0%B4_2024%282%29.jpg) | ほっきー | CC0 | 3024×4032 | 1200×1600 | 289182 / 112064 / 45070 B | Pasaje y puestos fotografiados dentro del mercado; ubicación y categoría de Commons coinciden. |
| JP-110 Tsutenkaku | [File:Tsutenkaku 108m.jpg](https://commons.wikimedia.org/wiki/File:Tsutenkaku_108m.jpg) | Sakai Yayoi | CC0 | 4012×5354 | 1199×1600 | 236150 / 73756 / 27274 B | Torre completa reconocible desde la calle de Shinsekai, con su entorno inmediato. |
| JP-177 Heart Rock | [File:Heart-shaped rocks at Kouri Island 202006.jpg](https://commons.wikimedia.org/wiki/File:Heart-shaped_rocks_at_Kouri_Island_202006.jpg) | Kugel~commonswiki | CC BY-SA 4.0 | 6000×4000 | 1600×1067 | 243910 / 36430 / 8160 B | Ambos perfiles rocosos identificables en Tīnu Hama, con mar como referencia de sitio. |

No se alteraron los originales para que entren en el presupuesto. El cambio de identidad de JP-071 se adquirió de nuevo con el pipeline y sustituyó una candidata provisional del mismo target, no una identidad canónica anterior al bloque.

## 3. Candidatos rechazados y comparación

Antes de aceptar cada portada se compararon los candidatos con el sujeto y ubicación del lugar:

- **JP-004:** `Takeshita Street in Harajuku.jpg` se rechazó porque la multitud oculta la calle; `Takeshita Street.jpg` porque su punto corresponde al arco de Meiji Street, al este de la ubicación objetivo.
- **JP-032:** `Tsukiji Outer Market -09.jpg` es una toma interior de 2011 que explica menos la calle; la foto histórica de 2005 antecede cambios importantes del mercado.
- **JP-056:** el primer plano `Multi-coloured kukuri-zaru talismans ... (2).jpg` funciona como detalle, pero no identifica inequívocamente el templo por sí solo.
- **JP-071:** la candidata inicialmente adquirida `Bamboo Grove, Arashiyama, Kyoto, Japan.jpg` era oscura y vertical y su rendición costaba 172672 B a calidad 48. La nueva toma horizontal es más clara, conserva el GPS dentro del sendero y requiere menos bytes a esa calidad. `Sagano Bamboo forest, Arashiyama, Kyoto.jpg` sólo mide 1500×1000 y ofrece menos definición del camino.
- **JP-091:** `Nishiki Market, Kyoto (53887898904).jpg` centra un puesto/producto, no la galería completa.
- **JP-106:** `Osaka market.jpg` es anterior (2018); se priorizó la toma del mercado de 2024, con categoría y ubicación verificables.
- **JP-110:** `Tsutenkaku Tower (13382330005).jpg` mira desde la torre al skyline; `Tsutenkaku Tower.JPG` está marcada para revisión. Se eligió una página CC0 vigente y verificable.
- **JP-177:** `Tinu-hama 202006 01.jpg` deja las rocas pequeñas en una vista amplia de playa; la elegida centra los perfiles por los que se reconoce el lugar.

La página original de JP-071 confirma autor Naokijp, CC BY-SA 4.0, ubicación 35.017009, 135.671808 y 3837×2622 px. No se hizo upscale. El pipeline produjo 1600×1093 y sus rendiciones locales.

## 4. Excepciones unresolved

- **JP-104 — UNRESOLVED — COPYRIGHTED SUBJECT.** El sujeto que define el lugar es el Glico Sign, con marca y figura gráfica. Se revisó la [categoría de Commons](https://commons.wikimedia.org/wiki/Category:Glico_Man_(Dotonbori)), una candidata fotográfica CC BY-SA de Metrotrekker y la [página oficial de Glico](https://www.glico.com/jp/health/contents/glicosign/). La licencia de la foto no resuelve los derechos del anuncio. Cambiar el encuadre no elimina ese problema.
- **JP-178 — UNRESOLVED — COPYRIGHTED SUBJECT.** Se revisaron las cinco imágenes de la [categoría de Commons](https://commons.wikimedia.org/wiki/Category:JUNGLIA_OKINAWA), la [web oficial de JUNGLIA](https://junglia.jp/) y la página de [JNTO sobre Okinawa](https://www.japan.travel/en/sg/story/okinawa-island-activities/). Las fotos abiertas encontradas centran atracciones e instalaciones temáticas modernas sin autorización documentada del titular del diseño; el material promocional no declara licencia abierta compatible.

Estas excepciones siguen con fallback y sin entrada en metadata. No se reabrieron excepciones A/B, S experience ni S complementary.

## 5. Totales y coberturas

| Métrica | Antes | Después |
|---|---:|---:|
| Imágenes en registry | 225 | 233 |
| Lugares con fotografía | 194 | 202 |
| Grado C con identity | 0/6 | 5/6 |
| Grado D con identity | 0/4 | 3/4 |
| Grado S identity | 32/32 | 32/32 |
| Grado S experience | 17/32 | 17/32 |
| Grado S complementary | 14/32 | 14/32 |
| Grado A | 139/147 + 8 excepciones | 139/147 + 8 excepciones |
| Grado B | 23/25 + 2 excepciones | 23/25 + 2 excepciones |

Sólo hubo ocho adquisiciones nuevas. Las dos resoluciones unresolved mantienen los contadores por debajo del total histórico; no se forzó cobertura del 100 %.

## 6. Presupuesto de listas por hub

La tarjeta sigue usando sólo identity `-800w`. Después de aplicar el generador determinista de rendiciones, todos los hubs quedan bajo 3500000 B:

| Hub | Identity -800w | Margen hasta el cap |
|---|---:|---:|
| Tokio | 3499770 B | 230 B |
| Kioto | 3499450 B | 550 B |
| Osaka | 3356478 B | 143522 B |
| Okinawa | 2903352 B | 596648 B |
| Sapporo | 166986 B | 3333014 B |
| Nagoya | 69552 B | 3430448 B |
| Fukuoka | 69284 B | 3430716 B |

Los originales y las rendiciones 400w permanecen en el contrato vigente. **38 rendiciones identity 800w existentes** se regeneraron mediante el pipeline para compensar el tamaño de nuevas portadas y mantener los caps. La redistribución determinista sólo toca rendiciones identity 800w hasta el piso 48 y falla si un hub no puede cumplir el presupuesto dentro de ese piso. Se mantuvieron los originales y no se manipuló ningún WebP manualmente. El margen de Tokio y Kioto es estrecho; el generador y los gates lo verifican exactamente.

## 7. Gates y regresiones

| Comprobación | Resultado |
|---|---|
| `scripts/validate-photography.py` | PASS |
| `scripts/test_photography.py` | PASS, 40/40 |
| `scripts/test_photography_rendition.py` | PASS, 30/30 |
| `scripts/test_block22_photography.py` | PASS, 8/8 |
| `scripts/test_block22_b6_2_photography.py` | PASS, 11/11 |
| `scripts/test_block22_b6_3_photography.py` | PASS, 8/8 |
| `scripts/test_block22_b6_4_photography.py` | PASS, 9/9 |
| `scripts/test_block22_b6_5_photography.py` | PASS, 7/7 |
| `scripts/test_block22_b6_6_photography.py` | PASS, 7/7 |
| `scripts/build-photography-derivatives.py --check --quiet` | PASS, 233 registros; 400w 4.72 MiB; 800w 14.78 MiB |
| `npm run build` | PASS; aviso heredado de bundle >500 kB |
| `npm run lint` | exit 0; sólo warning heredada `PlaceMap.tsx:14` |
| `npx vitest run` | PASS, 100/100 archivos, 3329/3329 |
| Browser audit B6.6 | PASS, 316/316, 0 fallos, móvil y escritorio |

Los tests históricos B6.3 y B6.5 se adaptaron sólo para que sus aserciones de conteos sean acumulativas y reconozcan las adquisiciones posteriores. Sus targets, fotos previas, excepciones y reglas editoriales no cambiaron. Se añadió cobertura de registry B6.6 al test frontend existente; no se tocó `place-images.ts`.

El test B6.6 deriva los 32 S y sus roles; conserva los targets, adquiridos/unresolved, metadata sincronizada, original/800w/400w/LQIP, licencias, duplicados de bytes, presupuestos por hub, S/A/B y hash de `place-images.ts`.

## 8. Browser audit, UI y archivos protegidos

El audit `app/scripts/block22-b6-6-photography-browser-audit.mjs` muestrea los ocho lugares adquiridos y los siete hubs en móvil 390×844 DPR2 y escritorio 1440×900 DPR1. Resultado: **316/316, cero fallos**. PlaceCard muestra la nueva identity y deja de mostrar placeholder; listas sólo solicitan identity 800w; fichas abren esa única foto sin contador, puntos ni flechas; CreditsSheet y restauración de foco son correctos; fallback, scroll-snap, proporción responsive, overflow, imágenes rotas y fetch fotográfico externo pasan.

Bytes observados de la identity en fichas (el mismo 800w en ambas vistas): JP-004 97.826 B; JP-032 69.896 B; JP-056 79.970 B; JP-071 131.026 B; JP-091 81.794 B; JP-106 112.064 B; JP-110 73.756 B; JP-177 36.430 B. El navegador recorrió listas y confirmó el total de solicitudes observadas por debajo del budget completo calculado para cada hub; los siete budgets se muestran en la sección 6.

`app/src/data/place-images.ts` conserva exactamente el SHA-256 base:

`0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb`

**Astra:** no utilizado. **UI:** sin rediseño ni cambios a componentes. **`main`:** intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`. B6.6 queda implementado/certificado pendiente de integración; no se inició el siguiente bloque.
