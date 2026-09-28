# Bloque 22 — B6.3: fotografía de lugares Grado B

**Estado:** implementado y certificado en `codex/block-22-b6-3-grade-b-photography`; pendiente de integración. Se adquirieron 6 de 8 imágenes `identity`; dos objetivos conservan `PhotoPlaceholder` por excepciones documentadas. No se forzó la meta ideal 25/25.

## Base y gate inicial

- Base canónica verificada tras `git fetch origin --prune`, checkout y reset de `codex/block-21-b5-explore-home-map`: `80f638ae68e88ad62d8c706d75c3aa107b27f4f2`.
- `select-block22-b6-3-targets.py` derivó desde `data/places.json` y `data/visual/photography-metadata.json`: **25 Grado B, 17 con foto, 8 sin foto**. La lista quedó fijada en `data/visual/block22-b6-3-baseline.json`; `--check` reconstruye el conjunto a partir de los registros base.
- Objetivos reales: **JP-041** Unicorn Gundam at DiverCity (Tokio), **JP-107** Namba Yasaka Shrine (Osaka), **JP-140** Mount Rokko night view (Osaka), **JP-150** Amanohashidate (Osaka), **JP-166** Mihama American Village (Okinawa), **JP-171** Blue Cave at Cape Maeda (Okinawa), **JP-199** Hateruma Island (Okinawa), **JP-209** Okunoshima (Rabbit Island) (Osaka).

## Adquisiciones

Se revisaron visualmente los candidatos en una hoja de contacto local, se contrastaron sus descripciones, ubicación y licencias en las páginas originales de Wikimedia Commons y se adquirieron mediante `scripts/acquire-photography.py`. La licencia, URL, autor, dimensiones y URL de adquisición de cada registro se obtuvieron en vivo por `prepare-block2-photography-metadata.py`, invocado por el preparador B6.3. Cada original preparado es **1600×1200**; no se amplió ninguna fuente. Los bytes son de los WebP finales; los originales de la fuente constan en `originalWidth` y `originalHeight`.

| Lugar → archivo local | Fuente original · autor · licencia | Origen px | Original / 800 / 400 B | Revisión `identity` |
|---|---|---:|---:|---|
| JP-107 → `namba-yasaka-torii-name-stone.webp` | [Commons](https://commons.wikimedia.org/wiki/File:Namba-yasaka-jinja_Torii_entrance.jpg) · KENPEI · CC BY-SA 3.0 | 3264×2448 | 408.696 / 85.386 / 28.496 | Torii, placa y estela rotulada 難波八阪神社: entrada específica. Evita poner la escultura moderna como sujeto principal. |
| JP-140 → `mount-rokko-night-view-kobe.webp` | [Commons](https://commons.wikimedia.org/wiki/File:Night_View_from_Mount_Rokko_2008-02.JPG) · Mugu-shisai · CC BY-SA 3.0 | 3072×2304 | 260.488 / 24.660 / 6.120 | Panorama nocturno de Hanshin tomado desde Rokko; la fuente incluye coordenadas del mirador. |
| JP-150 → `amanohashidate-kasamatsu-view.webp` | [Commons](https://commons.wikimedia.org/wiki/File:View_of_Amano-Hashidate_at_Kasamatsu_Park.JPG) · Kamigata0 · CC0 | 2048×1536 | 225.886 / 30.432 / 9.792 | La barra de pinos cruza visiblemente la bahía desde Kasamatsu; silueta inequívoca. |
| JP-166 → `mihama-american-village-colorful-buildings.webp` | [Commons](https://commons.wikimedia.org/wiki/File:Mihama_Town_Resort_American_Village_3.JPG) · Abasaa · Public Domain (`PD-self`) | 2048×1536 | 175.674 / 47.780 / 16.304 | Torre rosa y fachadas multicolores del complejo identificado en Chatan. El registro no inventa `licenseUrl`. |
| JP-199 → `hateruma-nishihama-turquoise-water.webp` | [Commons](https://commons.wikimedia.org/wiki/File:Hateruma_nishihama_1.jpg) · Paipateroma · CC BY-SA 4.0 | 5184×3888 | 269.124 / 22.788 / 5.352 | Nishihama documentada en Hateruma; arena blanca y bandas turquesas características. |
| JP-209 → `okunoshima-rabbit-ruins.webp` | [Commons](https://commons.wikimedia.org/wiki/File:Rabbits_of_Okunoshima,_March_2019.jpg) · Tak H. · CC BY-SA 2.0 | 4032×3024 | 337.236 / 69.562 / 22.444 | Conejo con ruinas de hormigón de la isla detrás; fuente con coordenadas dentro de Okunoshima. |

Cada registro tiene `role: identity`, `alt` específico, procedencia, crédito, licencia, procesamiento, original, `-800w`, `-400w` y LQIP. Las dos copias de metadata son byte a byte idénticas. Hay **0 duplicados de bytes** y **0 títulos de fotografía reutilizados** entre lugares. El detector B6.2 permanece activo.

## Candidatos rechazados y excepciones

| Objetivo | Candidatos y evidencia original | Decisión |
|---|---|---|
| JP-041 Unicorn Gundam | [Categoría Commons de Gundam Odaiba](https://commons.wikimedia.org/wiki/Category:Gundam_Odaiba): las fotos de la estatua se centran en el personaje y la escultura contemporánea. La CC del fotógrafo no acredita los derechos subyacentes. Una foto del centro comercial sin la estatua no identificaría este lugar. | **UNRESOLVED — COPYRIGHTED SUBJECT**. Sigue el mismo criterio prudente aplicado a Tower of the Sun en B6.2. |
| JP-171 Blue Cave | [Blue Cave de Janne Moren](https://www.flickr.com/photos/jannem/14975932851) identifica Cape Maeda, pero la fuente original consultable no permitió verificar licencia compatible; no se infirió una. [Ishigaki’s blue cave](https://commons.wikimedia.org/wiki/File:Ishigaki%27s_blue_cave_(51924566975).jpg) es otro sitio. [Cape Maeda](https://commons.wikimedia.org/wiki/File:Cape_Maeda.jpg) tiene sólo 450×338 px y muestra el exterior del cabo, no la cueva. | **UNRESOLVED — LICENSE**. No se sustituyó la cueva por otro cabo o cueva. |
| JP-107 | [Toma con cabeza de león al fondo](https://commons.wikimedia.org/wiki/File:Namba-Yasaka-Shrine-entrance_seeing_lion_head.jpg) descartada para evitar hacer de la escultura moderna el elemento de portada sin revisar derechos; se eligió el acceso rotulado. | Adquirido. |
| JP-140 | [Vista nocturna desde Mount Maya](https://commons.wikimedia.org/wiki/File:Night_view_of_Rokk%C5%8D_Island_and_Higashinada-ku,_Kobe,_Japan.jpg) descartada: mirador distinto aunque la ciudad aparezca. | Adquirido desde Rokko. |
| JP-150 | [ViewLand](https://commons.wikimedia.org/wiki/File:Amanohashidate_view_from_ViewLand.jpg) sólo mide 603×900 px; no se amplió. | Adquirido desde Kasamatsu. |
| JP-199 | [Aérea de NASA](https://commons.wikimedia.org/wiki/File:Hateruma_Island.jpg) rechazada porque no muestra la playa y el mar que justifican la visita. | Adquirido Nishihama. |
| JP-209 | [Conejo aislado](https://commons.wikimedia.org/wiki/File:Rabbit_on_Okunoshima_Island_1.jpg) descartado a favor de un encuadre con ruinas reconocibles de la isla. | Adquirido. |

## Conteos y presupuesto

| Métrica derivada | Antes | Después |
|---|---:|---:|
| Imágenes registradas | 194 | **200** |
| Lugares con fotografía | 188 | **194** |
| Grado B con fotografía | 17/25 | **23/25 + 2 excepciones** |
| Grado A con fotografía | 139/147 + 8 excepciones | **139/147 + 8 excepciones** |
| Grado S con fotografía | 32/32 | **32/32** |

Presupuesto: suma de la primera rendición `-800w` de cada lugar en **todos** los hubs. Todas las cifras están bajo **3.500.000 B**.

| Hub | Bytes |
|---|---:|
| Tokio | 3.421.914 |
| Kioto | 3.408.406 |
| Osaka | 3.170.658 |
| Okinawa | 2.866.922 |
| Sapporo | 166.986 |
| Nagoya | 69.552 |
| Fukuoka | 69.284 |

La regla B6.2 de calidad descendente determinista de `-800w` y el límite por hub siguen vigentes, sin recodificación manual.

## Gates y frontend

| Gate | Resultado |
|---|---|
| `validate-photography.py` | PASS |
| `test_photography.py` | 40/40 |
| `test_photography_rendition.py` | 28/28 |
| `test_block22_photography.py` | 8/8 |
| `test_block22_b6_2_photography.py` | 11/11; su test de append queda acotado a los objetivos A para permitir bloques posteriores |
| `test_block22_b6_3_photography.py` | 8/8: lista real, partición adquirido/unresolved, `identity`, LQIP, tres assets, licencia, sincronía, cobertura B/A/S, presupuesto y duplicados |
| `select-block22-b6-3-targets.py --check` | PASS |
| `build-photography-derivatives.py --check --quiet` | PASS — 200 registros |
| `npm run build` | PASS |
| `npm run lint` | exit 0; sólo warning heredada `PlaceMap.tsx:14` |
| `npx vitest run` | 100 archivos; **3328/3328** |
| `block22-b6-3-photography-browser-audit.mjs` | **216/216** en 390×844 y 1440×900 |

La auditoría de navegador muestrea los seis lugares nuevos en sus hubs, tanto tarjeta como ficha. Comprueba imagen local decodificada, una sola foto sin contador/puntos/flechas, alt, créditos y licencia (incluido PD-self sin enlace inventado), ausencia de fetch fotográfico externo o WebP fallido y fallback de tarjeta normal/compacta/ficha al abortar una imagen. No se cambió UI para el gate.

`app/src/data/place-images.ts` SHA-256 **antes y después**: `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb` en este checkout Windows. No se editó. Los tests de conteos de `place-images.test.ts` se actualizaron para los seis nuevos registros; el contrato de UI permanece intacto.

**Cero UI, cero Astra y `main` intacto** (`origin/main` permaneció en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`). No se abrió PR ni se hizo merge a `main` o a la rama canónica. El paso posterior a integrar B6.3 es la segunda imagen `experience` para los 32 Grado S; no se inició.
