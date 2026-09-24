# Bloque 22 — B6.2: fotografía Grado A sin cobertura

**Estado:** CERRADO CON UNRESOLVED — 26 de 35 objetivos adquiridos; 9 unresolved documentados.
**No apto para integración** hasta que se decida qué hacer con los 9 unresolved (ver §11 y §20).

**Rama:** `codex/block-22-b6-2-grade-a-photography` · **Fecha de adquisición:** 2026-09-24

## 1. SHA base

`88b9592c4351c8a48ccd216d372797d535d63968` (`codex/block-21-b5-explore-home-map`, B21 + B6.1 cerrados).
Verificado con `git rev-parse HEAD` tras el `reset --hard` del preflight. La rama B6.2 no existía en remoto.

## 2. Lista exacta de los 35 objetivos

Derivada de los datos, no escrita a mano: `scripts/select-block22-b6-2-targets.py` calcula los lugares
Grado A sin ningún registro en `data/visual/photography-metadata.json` y se niega a continuar si la
realidad no es 147/35. Gate inicial en la base: **147 Grado A, 35 sin fotografía** → PASS. El conjunto
queda fijado en `data/visual/block22-b6-2-baseline.json`; `--check` lo re-deriva desde el registro
base y el test B6.2 lo comprueba.

| # | ID | Lugar | Hub | Batch | Resultado |
|---|---|---|---|---|---|
| 1 | JP-023 | Yanaka Ginza and cemetery lanes | Tokio | 1 | adquirido |
| 2 | JP-024 | Nezu Shrine | Tokio | 1 | adquirido |
| 3 | JP-027 | Kanda Myojin | Tokio | 1 | adquirido |
| 4 | JP-029 | Imperial Palace East Gardens | Tokio | 1 | adquirido |
| 5 | JP-031 | Hama-rikyu Gardens | Tokio | 1 | adquirido |
| 6 | JP-035 | The National Art Center, Tokyo | Tokio | 1 | adquirido |
| 7 | JP-036 | 21_21 DESIGN SIGHT | Tokio | 1 | adquirido |
| 8 | JP-045 | Kichijoji + Inokashira Park | Tokio | 1 | adquirido |
| 9 | JP-048 | Shimokitazawa | Tokio | 1 | adquirido |
| 10 | JP-050 | PokéPark KANTO | Tokio | 1 | **unresolved** |
| 11 | JP-069 | Bishamon-dō | Kioto | 2 | adquirido |
| 12 | JP-074 | Giō-ji | Kioto | 2 | adquirido |
| 13 | JP-075 | Otagi Nenbutsu-ji | Kioto | 2 | adquirido |
| 14 | JP-076 | Adashino Nenbutsu-ji | Kioto | 2 | adquirido |
| 15 | JP-079 | Kyoto Rakusai Bamboo Park | Kioto | 2 | **unresolved** |
| 16 | JP-082 | Daitoku-ji subtemples | Kioto | 2 | adquirido |
| 17 | JP-083 | Genkō-an | Kioto | 2 | adquirido |
| 18 | JP-088 | Jingo-ji | Kioto | 2 | adquirido |
| 19 | JP-095 | teamLab Biovortex Kyoto | Kioto | 2 | **unresolved** |
| 20 | JP-120 | teamLab Botanical Garden Osaka | Osaka | 2 | **unresolved** |
| 21 | JP-121 | Expo ’70 Park + Tower of the Sun | Osaka | 3 | **unresolved** |
| 22 | JP-133 | Naramachi | Osaka | 3 | adquirido |
| 23 | JP-136 | Kōko-en | Osaka | 3 | adquirido |
| 24 | JP-137 | Engyō-ji on Mount Shosha | Osaka | 3 | adquirido |
| 25 | JP-147 | Enryaku-ji | Osaka | 3 | adquirido |
| 26 | JP-156 | Sakaemachi Arcade nightlife | Okinawa | 3 | **unresolved** |
| 27 | JP-168 | Yachimun no Sato | Okinawa | 3 | **unresolved** |
| 28 | JP-170 | Katsuren Castle Ruins | Okinawa | 3 | adquirido |
| 29 | JP-175 | Nakijin Castle Ruins | Okinawa | 3 | adquirido |
| 30 | JP-191 | Yabiji coral reef | Okinawa | 3 | adquirido |
| 31 | JP-193 | Yonehara Beach and coral | Okinawa | 4 | adquirido |
| 32 | JP-195 | Yaeyama stargazing experience | Okinawa | 4 | **unresolved** |
| 33 | JP-201 | Hatenohama | Okinawa | 4 | adquirido |
| 34 | JP-202 | Whale watching in the Kerama waters | Okinawa | 4 | **unresolved** |
| 35 | JP-211 | AnimeJapan 2027 | Osaka | 4 | adquirido |

Los batches siguen el orden estable del dataset (10/10/10/5).

## 3–9. Lugar → archivo, fuente, autor, licencia, rol, bytes e identidad

Todos los campos (`source`, `sourceUrl`, `credit`, `license`, `licenseUrl`, `acquisitionUrl`,
dimensiones y `processing`) se leyeron de la API de Commons en el momento de preparar, con
`prepare-block2-photography-metadata.build` (el mismo contrato que B6.1). El plan sólo aporta la
elección revisada, el slug, el alt y el rol. Ningún crédito ni licencia se tecleó a mano.

| ID | Lugar | Archivo | Fuente (Commons) | Autor/crédito | Licencia | Rol | Original B | 800w B | 400w B | LQIP B |
|---|---|---|---|---|---|---|---:|---:|---:|---:|
| JP-023 | Yanaka Ginza and cemetery lanes | `yanaka-ginza-shopping-street-gate.webp` | [Yanaka Ginza (53149155977).jpg](https://commons.wikimedia.org/wiki/File%3AYanaka_Ginza_%2853149155977%29.jpg) | Dick Thomas Johnson from Tokyo. Japan | CC BY 2.0 | `identity` | 285.546 | 66.848 | 23.762 | 639 |
| JP-024 | Nezu Shrine | `nezu-shrine-romon-gate.webp` | [Nezu-jinja Romon 4.jpg](https://commons.wikimedia.org/wiki/File%3ANezu-jinja_Romon_4.jpg) | Zairon | CC BY-SA 4.0 | `identity` | 275.314 | 67.404 | 19.364 | 651 |
| JP-027 | Kanda Myojin | `kanda-myojin-main-hall-courtyard.webp` | [Kanda-Myojin grand hall.jpg](https://commons.wikimedia.org/wiki/File%3AKanda-Myojin_grand_hall.jpg) | Hyppolyte de Saint-Rambert | CC BY-SA 4.0 | `identity` | 272.736 | 47.000 | 15.250 | 639 |
| JP-029 | Imperial Palace East Gardens | `imperial-palace-east-gardens-honmaru-lawn.webp` | [Tokyo Imperial Palace East Gardens Park.jpg](https://commons.wikimedia.org/wiki/File%3ATokyo_Imperial_Palace_East_Gardens_Park.jpg) | Alexander Klink | CC BY 4.0 | `identity` | 296.450 | 63.258 | 13.824 | 523 |
| JP-031 | Hama-rikyu Gardens | `hama-rikyu-pond-bridge-shiodome.webp` | [Tokio Hamarikyu-Garten-20091017-RM-141110.jpg](https://commons.wikimedia.org/wiki/File%3ATokio_Hamarikyu-Garten-20091017-RM-141110.jpg) | Reinhold Möller Ermell | CC BY-SA 4.0 | `identity` | 524.618 | 98.232 | 30.132 | 695 |
| JP-035 | The National Art Center. Tokyo | `national-art-center-tokyo-glass-facade.webp` | [2018 National Art Center. Tokyo 2.jpg](https://commons.wikimedia.org/wiki/File%3A2018_National_Art_Center%2C_Tokyo_2.jpg) | Kakidai | CC BY-SA 4.0 | `identity` | 280.320 | 67.328 | 18.888 | 599 |
| JP-036 | 21_21 DESIGN SIGHT | `21-21-design-sight-folded-roof.webp` | [21 21 DESIGN SIGHT 201306.jpg](https://commons.wikimedia.org/wiki/File%3A21_21_DESIGN_SIGHT_201306.jpg) | Wpcpey | CC BY-SA 4.0 | `identity` | 331.554 | 69.168 | 19.796 | 691 |
| JP-045 | Kichijoji + Inokashira Park | `inokashira-pond-benzaiten-hall.webp` | [Inokashira park pond 2024.jpg](https://commons.wikimedia.org/wiki/File%3AInokashira_park_pond_2024.jpg) | ARandomName123 | CC BY-SA 4.0 | `identity` | 419.122 | 90.932 | 26.146 | 615 |
| JP-048 | Shimokitazawa | `shimokitazawa-shopping-street-banners.webp` | [Shimokitazawa Street 2015.jpg](https://commons.wikimedia.org/wiki/File%3AShimokitazawa_Street_2015.jpg) | Aw1805 | CC BY-SA 4.0 | `identity` | 216.830 | 68.718 | 26.346 | 615 |
| JP-069 | Bishamon-dō | `bishamondo-main-hall-yamashina.webp` | [240316 Bishamondo Yamashina Kyoto Japan01s3.jpg](https://commons.wikimedia.org/wiki/File%3A240316_Bishamondo_Yamashina_Kyoto_Japan01s3.jpg) | 663highland | CC BY-SA 4.0 | `identity` | 379.396 | 71.154 | 21.474 | 583 |
| JP-074 | Giō-ji | `gio-ji-moss-garden-thatched-hall.webp` | [Giō-ji - Kyoto - DSC06265.JPG](https://commons.wikimedia.org/wiki/File%3AGi%C5%8D-ji_-_Kyoto_-_DSC06265.JPG) | Daderot | CC0 | `identity` | 346.460 | 79.788 | 30.472 | 639 |
| JP-075 | Otagi Nenbutsu-ji | `otagi-nenbutsu-ji-rakan-autumn.webp` | [Otagi nenbutsuji08s3200.jpg](https://commons.wikimedia.org/wiki/File%3AOtagi_nenbutsuji08s3200.jpg) | 663highland | CC BY 2.5 | `identity` | 418.394 | 92.350 | 30.536 | 615 |
| JP-076 | Adashino Nenbutsu-ji | `adashino-nenbutsu-ji-stone-statues.webp` | [Adashino-nenbutsuji (化野念仏寺). Sagano. Kyoto. Japan.jpg](https://commons.wikimedia.org/wiki/File%3AAdashino-nenbutsuji_%28%E5%8C%96%E9%87%8E%E5%BF%B5%E4%BB%8F%E5%AF%BA%29%2C_Sagano%2C_Kyoto%2C_Japan.jpg) | Dudva | CC0 | `identity` | 666.654 | 143.466 | 41.932 | 639 |
| JP-082 | Daitoku-ji subtemples | `daitoku-ji-koto-in-approach-path.webp` | [Koto in zen chemin.jpg](https://commons.wikimedia.org/wiki/File%3AKoto_in_zen_chemin.jpg) | Hyppolyte de Saint-Rambert | CC BY-SA 4.0 | `identity` | 407.978 | 106.168 | 35.084 | 639 |
| JP-083 | Genkō-an | `genko-an-round-and-square-windows.webp` | [Genkō-an. Round and Square Windows 01.jpg](https://commons.wikimedia.org/wiki/File%3AGenk%C5%8D-an%2C_Round_and_Square_Windows_01.jpg) | Naokijp | CC BY-SA 4.0 | `identity` | 212.742 | 49.584 | 14.098 | 699 |
| JP-088 | Jingo-ji | `jingo-ji-precinct-autumn-maples.webp` | [Jingoji Kyoto Kyoto15s3s4500.jpg](https://commons.wikimedia.org/wiki/File%3AJingoji_Kyoto_Kyoto15s3s4500.jpg) | 663highland | CC BY 2.5 | `identity` | 480.046 | 98.840 | 31.010 | 647 |
| JP-133 | Naramachi | `naramachi-shiryokan-migawari-zaru.webp` | [Naramachi-shiryokan Nara02n3200.jpg](https://commons.wikimedia.org/wiki/File%3ANaramachi-shiryokan_Nara02n3200.jpg) | 663highland | CC BY 2.5 | `identity` | 248.746 | 58.354 | 18.916 | 643 |
| JP-136 | Kōko-en | `koko-en-pines-himeji-castle.webp` | [Kokoen 2009-04-08 (3640594934).jpg](https://commons.wikimedia.org/wiki/File%3AKokoen_2009-04-08_%283640594934%29.jpg) | KimonBerlin | CC BY-SA 2.0 | `identity` | 306.366 | 66.984 | 21.268 | 623 |
| JP-137 | Engyō-ji on Mount Shosha | `engyo-ji-mitsunodo-halls.webp` | [Engyoji05s4592.jpg](https://commons.wikimedia.org/wiki/File%3AEngyoji05s4592.jpg) | 663highland | CC BY 2.5 | `identity` | 243.372 | 52.844 | 14.432 | 635 |
| JP-147 | Enryaku-ji | `enryaku-ji-konponchudo-autumn.webp` | [Enryakuji Konponchudo04n4272.jpg](https://commons.wikimedia.org/wiki/File%3AEnryakuji_Konponchudo04n4272.jpg) | 663highland | CC BY 2.5 | `identity` | 387.886 | 74.406 | 23.234 | 671 |
| JP-170 | Katsuren Castle Ruins | `katsuren-castle-terraced-walls.webp` | [Katsuren Castle ruins.jpg](https://commons.wikimedia.org/wiki/File%3AKatsuren_Castle_ruins.jpg) | kanegen | CC BY 2.0 | `identity` | 279.036 | 66.578 | 15.904 | 575 |
| JP-175 | Nakijin Castle Ruins | `nakijin-castle-serpentine-walls.webp` | [Nakijin Gusuku - panoramio.jpg](https://commons.wikimedia.org/wiki/File%3ANakijin_Gusuku_-_panoramio.jpg) | FoxyStranger Kawasaki | CC BY-SA 3.0 | `identity` | 557.446 | 101.366 | 28.140 | 611 |
| JP-191 | Yabiji coral reef | `yabiji-reef-aerial-view.webp` | [Miyako yabiji.jpg](https://commons.wikimedia.org/wiki/File%3AMiyako_yabiji.jpg) | Paipateroma | CC BY-SA 4.0 | `identity` | 141.564 | 23.138 | 8.136 | 635 |
| JP-193 | Yonehara Beach and coral | `yonehara-beach-sand-and-mountains.webp` | [Yonehara Beach 5.jpg](https://commons.wikimedia.org/wiki/File%3AYonehara_Beach_5.jpg) | Syced | CC0 | `identity` | 341.738 | 69.498 | 21.914 | 631 |
| JP-201 | Hatenohama | `hatenohama-sandbar-aerial.webp` | [Okinawa-kumejima Hatenohama Beach-xl.jpg](https://commons.wikimedia.org/wiki/File%3AOkinawa-kumejima_Hatenohama_Beach-xl.jpg) | Kumejima93_OKINAWA | CC BY 4.0 | `identity` | 263.460 | 27.678 | 8.764 | 607 |
| JP-211 | AnimeJapan 2027 | `animejapan-tokyo-big-sight-entrance.webp` | [AnimeJapan 2014 (13370919653).jpg](https://commons.wikimedia.org/wiki/File%3AAnimeJapan_2014_%2813370919653%29.jpg) | James Dennes | CC BY 2.0 | `identity` | 275.946 | 67.400 | 20.998 | 599 |

Todas las imágenes: `role: "identity"`, exactamente una por objetivo, WebP. Original ≤1600 px
(JP-191 queda a 1280 px porque su fuente mide 1600 px y Commons sólo sirve miniaturas estrictamente
menores: regla existente de `acquire-photography.py`, registrada como `resized-and-webp-reencoded`).
LQIP de 20 px en base64 (523–699 B) generado por `build-photography-derivatives.py`.

### Revisión de identidad

Cada candidato se revisó visualmente (hojas de contacto de miniaturas de Commons) y, cuando el título
era ambiguo, por sus categorías de Commons (p. ej. JP-082 `Category:Koutouin, Daitokuji`, JP-083
`Category:Satori-no-mado and Mayoi-no-mado, Genko-an`, JP-074 `Category:Moss Garden, Giō-ji`). La
hoja final de las 26 derivadas confirmó que cada imagen muestra su lugar. El alt describe lo que se
ve y dónde; ninguno repite sólo el nombre.

| ID | Revisión de identidad |
|---|---|
| JP-023 | ACEPTADA — El arco con el nombre de la calle comercial la identifica sin ambigüedad y muestra la escala residencial baja que define el barrio. |
| JP-024 | ACEPTADA — La descripción de Commons sitúa la puerta principal del santuario Nezu (Bunkyō); la Rōmon con placa es su imagen de acceso característica. |
| JP-027 | ACEPTADA — El haiden frontal del santuario ante los edificios de oficinas de Akihabara es la vista que lo identifica; la fuente lo describe como el patio del santuario. |
| JP-029 | ACEPTADA — La explanada del Honmaru, antiguo recinto central del castillo de Edo, recortada contra el skyline de Marunouchi, es la vista propia de los Jardines Este. |
| JP-031 | ACEPTADA — El estanque de agua de mar, el puente y el contraste con las torres de Shiodome identifican Hama-rikyū frente a cualquier otro jardín de Tokio. |
| JP-035 | ACEPTADA — La fachada ondulada de Kishō Kurokawa con el cono de acceso es la arquitectura que el propio lugar ofrece como contenido. |
| JP-036 | ACEPTADA — La cubierta plegada de una sola lámina y el muro de hormigón visto de Ando son inconfundibles; el césped y los árboles de Tokyo Midtown la sitúan. |
| JP-045 | ACEPTADA — El pabellón de Benzaiten a orillas del estanque es el hito del parque Inokashira junto a Kichijōji; la fuente fecha la toma en julio de 2024. |
| JP-048 | ACEPTADA — Las banderolas con 下北沢 y la calle estrecha y densa de tiendas identifican el barrio y transmiten su atractivo: explorar a pie. |
| JP-069 | ACEPTADA — La fuente identifica Bishamondō en Yamashina; el pabellón principal frontal con la colina boscosa funciona como portada del templo. |
| JP-074 | ACEPTADA — Commons lo clasifica en Category:Moss Garden, Giō-ji; el musgo ondulado bajo los arces y la ermita de paja son la imagen propia del templo. |
| JP-075 | ACEPTADA — Las 1.200 rakan de rostros distintos son el contenido del lugar; la fuente lo identifica como Otagi Nenbutsu-ji en Sagano. |
| JP-076 | ACEPTADA — El mar de estatuas funerarias en torno a la pagoda es el paisaje de memoria que define el templo; la fuente lo nombra explícitamente. |
| JP-082 | ACEPTADA — Commons lo clasifica en Category:Koutouin, Daitokuji; el sendero de acceso de Kōtō-in es la imagen más reconocible de los subtemplos visitables. |
| JP-083 | ACEPTADA — Commons lo clasifica en Category:Satori-no-mado and Mayoi-no-mado, Genko-an: las dos ventanas son exactamente la experiencia que justifica la visita. |
| JP-088 | ACEPTADA — La fuente identifica Jingo-ji (Ukyō-ku); el recinto elevado entre bosque transmite el aislamiento que el lugar ofrece tras la subida. |
| JP-133 | ACEPTADA — La fuente lo sitúa en Naramachi (Nara); los migawari-zaru rojos y el rótulo del museo local son el signo propio del barrio y no de otra ciudad. |
| JP-136 | ACEPTADA — Kōko-en linda con el castillo de Himeji; la torre al fondo sobre el jardín de pinos lo distingue de cualquier otro jardín japonés. |
| JP-137 | ACEPTADA — La fuente identifica Engyō-ji en Himeji; el conjunto de tres salas del Mitsunodō en el bosque es la vista monumental característica del monte Shosha. |
| JP-147 | ACEPTADA — La fuente identifica el Konpon-chūdō, tesoro nacional y sala central de Enryaku-ji; su escala entre el bosque del monte Hiei es la identidad del lugar. |
| JP-170 | ACEPTADA — Las terrazas amuralladas que ascienden hacia la cima son la forma reconocible de Katsuren; la fuente la sitúa en Uruma, Okinawa. |
| JP-175 | ACEPTADA — La muralla ondulante de piedra caliza es el rasgo inconfundible de Nakijin Gusuku; la fuente la nombra explícitamente. |
| JP-191 | ACEPTADA — La fuente la describe como 八重干瀬 (Yabiji, Miyakojima); la vista aérea muestra la escala del sistema de arrecifes que ninguna toma submarina puede situar. |
| JP-193 | ACEPTADA — Commons la clasifica en Category:Yonehara Beach; la playa con el arrecife somero y la cordillera de Ishigaki detrás sitúa el lugar frente a otra playa genérica. |
| JP-201 | ACEPTADA — La lengua de arena deshabitada entre arrecifes frente a Kumejima es exactamente Hate no Hama; la fuente (proyecto FIND/47) la nombra así. |
| JP-211 | ACEPTADA — Coincide con el brief editorial (pabellón principal y señalética del evento): la sede con la señalética de AnimeJapan identifica la feria; el alt declara que es la edición de 2014. |

## 10. Rechazos relevantes

Lista completa y estructurada en `data/visual/block22-b6-2-acquisition-plan.json` (`rejected`).

| ID | Candidato | Causa |
|---|---|---|
| JP-023 | `File:Yanaka Ginza, Yanaka (53417016334).jpg` | Muestra el mismo arco, pero lleva una marca de agua superpuesta del autor; se prefiere una toma limpia equivalente. |
| JP-023 | `File:Yanaka cemetery 2.jpg` | Tumba individual en primer plano: no funciona como portada del conjunto calle + cementerio. |
| JP-024 | `File:Nezu jinja - Torii 1.jpg` | Un torii aislado no distingue Nezu de otros santuarios; la Rōmon con placa sí. |
| JP-027 | `File:Kanda-Myojin 501.jpg` | Es un goshuin (sello caligráfico), no el lugar. |
| JP-027 | `File:Kanda-myōjin haiden.jpg` | Válida pero con un letrero y un visitante en primer plano; la toma frontal elegida es más limpia. |
| JP-029 | `File:Imperial Palace East Garden @ Tokyo (11165664295).jpg` | Césped seco invernal sin elemento que sitúe el lugar; poco representativa. |
| JP-029 | `File:Chiyoda Tokyo August Tokyo Imperial Palace 2014 43.JPG` | Descrita sólo como Palacio Imperial, sin garantía de que sea el recinto de los Jardines Este. |
| JP-031 | `File:Hama-Rikyu Gardens (11324122253).jpg` | Hojas en el suelo: detalle sin identidad. |
| JP-031 | `File:Hamarikyu Garden as seen from Shiodome.jpg` | Vista aérea: contexto, no identidad; ilegible como portada a 4:3. |
| JP-035 | `File:National Art Center @ Tokyo (11495394516).jpg` | Detalle abstracto de la fachada: no identifica el edificio a tamaño tarjeta. |
| JP-036 | `File:21 21 DESIGN SIGHT模型.jpg` | Maqueta del edificio, no el lugar. |
| JP-045 | `File:Inokashira Park Zoo PC053119.jpg` | Capibara del zoo: no representa el parque ni el barrio. |
| JP-045 | `File:Inokashira Park Cherry blossoms.jpg` | Iluminación nocturna estacional: rol seasonal, no identity. |
| JP-048 | `File:Cake-shaped clocks for sale in Shimokitazawa.jpg` | Detalle de un escaparate sin contexto del barrio. |
| JP-048 | `File:Walk in Shimokitazawa.jpg` | Edificio de la estación de Odakyū: identifica la estación, no el barrio de callejuelas. |
| JP-050 | `File:ProfSekkokuLab 20260205.jpg` | Interior de una sala-laboratorio con tres Poké Balls: no muestra el bosque ni las figuras que definen PokéPark KANTO y no es inequívoco como portada. |
| JP-050 | `File:PokéPark Kanto logo.png` | Logotipo, no fotografía del lugar. |
| JP-069 | `File:Bishamondō 01.jpg` | Licencia CC BY 2.1 JP fuera de la lista permitida del pipeline. |
| JP-069 | `File:Bishamondō stairs.JPG` | Escalinata en el bosque sin el templo reconocible. |
| JP-074 | `File:Giō-ji Buddhist Temple - Entrance.jpg` | Portillo de entrada poco legible a tamaño tarjeta. |
| JP-075 | `File:Laughing pilgrim statue of Otagi-nenbutsuji.jpg` | Primer plano de una sola estatua: detail, no identity. |
| JP-076 | `File:Kyoto Adashino Nenbutsu-ji Bamboo Forest 1.jpg` | Bosque de bambú vertical: se confunde con Arashiyama y no muestra las estatuas. |
| JP-082 | `File:Daitoku-ji in Koka 01.jpg` | Es otro Daitoku-ji, en Kōka (Shiga): lugar diferente. |
| JP-082 | `File:Daitoku-ji Temple , 大徳寺 勅使門 - panoramio.jpg` | Puerta del recinto principal, no un subtemplo; resolución baja (1196 px). |
| JP-082 | `File:Daisen-in Daitokuji (Kita-Ku Kyoto) SubTemple hdsr S5 02.jpg` | Cartel indicador del subtemplo, no el lugar. |
| JP-083 | `File:Genkō-an, Main Hall 01.jpg` | Pabellón genérico que no muestra las ventanas que definen la visita. |
| JP-083 | `File:Genkoan-Windows.jpg` | Mismo sujeto a 1500 px y con la ventana redonda descentrada; se prefiere la toma de 3264 px. |
| JP-088 | `File:Jingo-ji (7066697911).jpg` | Niña en un puesto de kawarake: persona identificable y sin el lugar. |
| JP-088 | `File:Jingo-ji (6920612150).jpg` | Bosque de cedros sin el templo. |
| JP-095 | `File:TOKIO INKARAMI in Tadasu Forest Shimogamo Shrine 01.jpg` | Instalación de luz en Shimogamo, no teamLab Biovortex. |
| JP-120 | `File:Nemophila field at Nagai Botanical Garden.jpg` | Jardín botánico de Nagai de día: no muestra la obra nocturna de teamLab que define el lugar. |
| JP-121 | `Category:Tower of the Sun` | La Torre del Sol es obra protegida de Tarō Okamoto y Japón no tiene libertad de panorama para esculturas: Commons borra las fotos centradas en ella (categoría de solicitudes de borrado). |
| JP-121 | `File:Expo70 Park (Suite Osaka) hdsr S5 06.jpg` | Vista desde el parque hacia el monorraíl y Expocity: no muestra la torre ni el parque de forma reconocible. |
| JP-121 | `File:EXPO '70 PAVILION bekkan 2.jpg` | Patio del anexo del pabellón Expo'70: no identifica el parque ni la torre. |
| JP-133 | `File:Naramachii01n3200.jpg` | Calle de machiya válida pero intercambiable con otros barrios históricos; se prefiere la toma con los migawari-zaru y el rótulo del museo. |
| JP-136 | `File:Chicken February 2009-1.jpg` | Resultado de búsqueda sin relación con el lugar. |
| JP-136 | `File:Himeji Koukoen32n4592.jpg` | Estanque otoñal bonito pero sin elemento que distinga Kōko-en de otro jardín; la toma con el castillo lo sitúa. |
| JP-137 | `File:Engyô-ji Temple - Paper lanterns.jpg` | Detalle de farolillos: detail, no identity. |
| JP-147 | `File:Enryakuji - IMG 6251.JPG` | Sendero en el bosque sin edificios del templo. |
| JP-147 | `File:Yamagata Risshaku-ji Konpon Chudo Main Hall 1.jpg` | Es el Konpon-chūdō de Risshaku-ji (Yamagata): lugar diferente. |
| JP-156 | `File:Naha Sakaemachi Ichiba 01.JPG` | Identifica el mercado (rótulo 栄町市場), pero su licencia es PD-self; el contrato actual del pipeline/validador sólo representa CC0, CC BY y CC BY-SA con licenseUrl de creativecommons.org, y no se inventa una URL de licencia. |
| JP-156 | `File:栄町りうぼう リウボウストア 那覇市安里 Sep 10, 2011 (1).jpg` | Supermercado Ryubo de Sakaemachi, no la galería comercial nocturna. |
| JP-168 | `File:Yomitan Yachimun no Sato.jpg` | 450×338 px: resolución insuficiente para portada (el pipeline sirve hasta 1600 px y no reescala al alza). |
| JP-168 | `File:Kitagama-Kasen(Akazu-chō).jpg` | Horno Kitagama de Akazu (Seto, Aichi): lugar diferente pese al nombre. |
| JP-170 | `File:Katsuren Castle support column ruins.jpg` | Basas de columnas en la cima: detail, no identity. |
| JP-175 | `File:Nakijin-Castle Ticket-counter.jpg` | Taquilla de acceso, no las ruinas. |
| JP-191 | `File:Yabishi1.jpg` | Coral submarino genérico y sin autor declarado en Commons (CC BY 3.0 exige crédito). |
| JP-191 | `File:Yabiji coral reef Aerial photograph.2008.jpg` | Ortofoto del GSI con licencia 'Attribution' propia fuera de la lista del pipeline. |
| JP-193 | `File:Yonehara Beach 20.jpg` | Acceso por carretera con vallas y contenedores: no muestra la playa. |
| JP-193 | `File:Yonehara Beach 24.jpg` | Aparcamiento de coches. |
| JP-195 | `File:Milky Way - 7 July 2013.jpg` | Vía Láctea fotografiada en Okayama: otro lugar. |
| JP-195 | `File:Milky Way and Sagittarius.JPG` | Tomada desde el monte Yakushi (Alpes japoneses): otro lugar. |
| JP-195 | `File:Haterumajima Observatory Tower.jpg` | Torre de observación de Hateruma de día: un edificio concreto, no el cielo nocturno que define la experiencia en Yaeyama. |
| JP-201 | `File:Hateno-hama beach はての浜 DSCF7906.JPG` | Pareja identificable sentada en la arena como sujeto principal. |
| JP-202 | `File:Kerama Island.jpg` | Paisaje de islas: no muestra ballenas; sustituiría la experiencia por otro sujeto. |
| JP-202 | `File:Okinawa Churaumi Aquarium.jpg` | Acuario Churaumi: otro lugar. |
| JP-211 | `Category:AnimeJapan 2015` | Retratos de cosplayers y azafatas identificables: personas como sujeto, no el evento. |
| JP-211 | `File:Animejapanlogo.png` | Logotipo, no fotografía. |

## 11. Unresolved

Ninguno se sustituyó por una imagen incorrecta, genérica o de otro lugar.

| ID | Lugar | Causa |
|---|---|---|
| JP-050 | PokéPark KANTO | Commons (Category:PokéPark Kanto y búsquedas en inglés/japonés) sólo contiene el logotipo y una sala interior no representativa. Ninguna fotografía con licencia verificable muestra el recorrido forestal ni las figuras de Pokémon. |
| JP-079 | Kyoto Rakusai Bamboo Park | Sin archivos en Commons para el Parque de Bambú de Rakusai (búsquedas 'Rakusai Bamboo Park', 'Rakusai chikurin', '洛西竹林公園' y categorías Rakusai). Un bambú genérico de otro sitio no es aceptable. |
| JP-095 | teamLab Biovortex Kyoto | teamLab Biovortex Kyoto (abierto en 2025) no tiene fotografías en Commons ni en Category:TeamLab; las obras de teamLab de otras sedes no sirven. |
| JP-120 | teamLab Botanical Garden Osaka | Commons sólo tiene fotografías diurnas del Jardín Botánico de Nagai; ninguna muestra teamLab Botanical Garden Osaka. |
| JP-121 | Expo ’70 Park + Tower of the Sun | La Torre del Sol no tiene fotografías libres en Commons (obra protegida, sin libertad de panorama en Japón); las vistas incidentales del parque no identifican el lugar. |
| JP-156 | Sakaemachi Arcade nightlife | Las únicas fotografías de la galería Sakaemachi son PD-self. Aceptarlas requiere ampliar el contrato de licencias del pipeline/validador (licenseUrl no-CC); queda para decisión explícita fuera de B6.2. |
| JP-168 | Yachimun no Sato | Sólo existe una foto de 450 px de Yachimun no Sato; el resto de resultados son de otros lugares. |
| JP-195 | Yaeyama stargazing experience | No existe en Commons una fotografía del cielo nocturno verificablemente tomada en Yaeyama (Ishigaki, Iriomote o Hateruma); las de Vía Láctea son de otras regiones. |
| JP-202 | Whale watching in the Kerama waters | Ninguna fotografía de ballenas jorobadas en aguas de Kerama (búsquedas en inglés, japonés y latín); los paisajes de las islas no representan la experiencia. |

Posibles vías, todas fuera del alcance de B6.2 y pendientes de decisión explícita:
- JP-156: aceptar `PD-self` exige ampliar el contrato de licencias (`validate-photography.py`,
  `prepare-block2-…`, y el test de Vitest que exige `licenseUrl` en creativecommons.org).
- El resto: sólo hay material con licencia verificable fuera de Commons o no hay ninguno; el
  pipeline actual (`acquire-photography.py`) es exclusivamente Commons.
- JP-121 (Torre del Sol) y JP-095/JP-120 (teamLab) son obras protegidas: no es previsible que
  aparezca material libre.

## 12. Conteos antes/después

| Métrica | Antes (base) | Después | Esperado si 35/35 |
|---|---:|---:|---:|
| Imágenes registradas | 167 | **193** | 202 |
| Lugares con fotografía | 161 | **187** | 196 |
| Grado A con ≥1 fotografía | 112/147 | **138/147** | 147/147 |
| Grado A sin fotografía | 35 | **9** | 0 |
| Grado S con fotografía | 32/32 | **32/32** | 32/32 |

Los conteos los calculan los gates (`test_block22_b6_2_photography.py`, `place-images.test.ts`),
no se fijan como fuente de verdad.

## 13. Presupuesto por ciudad

Contrato: recorrer una ciudad ≤ 3.500.000 B. `PlaceCard` carga siempre la rendición `-800w` (no hay
`srcset` en la tarjeta), así que el presupuesto es la suma de las `-800w` de la primera imagen de cada
lugar del hub (medida del validador).

| Hub | Base | Tras batch 1 (sin corrección) | Final |
|---|---:|---:|---:|
| Tokio | 3.143.702 | **3.886.132 ✗** | 3.421.914 |
| Kioto | 3.351.110 | — | 3.408.406 |
| Osaka | 3.096.870 | — | 2.960.618 |
| Okinawa | 2.871.326 | — | 2.740.472 |
| Sapporo / Nagoya / Fukuoka | 201.342 / 69.552 / 84.716 | — | 166.986 / 69.552 / 69.284 |

**Causa del exceso:** tras el batch 1 Tokio superó el contrato. No era un activo aislado: unas pocas
tomas de mucho detalle (follaje, agua, calles densas) codificaban a 100–170 KB en `-800w` con calidad
72, frente a ~50 KB típicos (p. ej. JP-031 127.400 B, JP-045 114.670 B).

**Corrección por pipeline** (`build-photography-derivatives.py`): una `-800w` que supera 70.000 B baja
de calidad en pasos de 4 desde 72 hasta encajar o hasta el suelo 48 — la misma regla determinista que
ya aplica la adquisición a los originales (`PHOTOGRAPHY_TARGET_BYTES`) y el propio script al LQIP. Las
que ya cumplían siguen byte-idénticas a calidad 72; `-400w` y originales no cambian. Efecto:
82 de las 167 `-800w` preexistentes se re-codificaron (sólo ficheros `-800w`; revisión visual del caso
más comprimido, JP-016 Sensō-ji a q48, sin artefactos visibles). `--check` sigue siendo
reproducible. Margen final más estrecho: Kioto (91.594 B).

**Medida real en navegador** (Chromium, recorrido completo de la lista del hub tras la portada, sólo
`-800w`): Tokio 2.893.202 B (teléfono) / 2.352.094 B (escritorio); Kioto 3.341.134 / 2.934.582;
Osaka 2.919.480 / 2.919.480; Okinawa 2.662.306 / 2.662.306. Todos < 3.500.000 B.

## 14. Validators y tests Python

| Gate | Resultado |
|---|---|
| `python3 scripts/validate-photography.py` | PASS |
| `python3 scripts/test_photography.py` | PASS — 38/38 |
| `python3 scripts/test_photography_rendition.py` | PASS — 28/28 |
| `python3 scripts/test_block22_photography.py` | 7/8 — único fallo: **heredado CRLF** |
| `python3 scripts/test_block22_b6_2_photography.py` (nuevo) | PASS — 11/11 |
| `python3 scripts/build-photography-derivatives.py --check --quiet` | PASS — 193 registros, 400w + 800w + LQIP |
| `python3 scripts/select-block22-b6-2-targets.py --check` | PASS — 35 objetivos re-derivados |

**Fallo heredado CRLF (no funcional):** `test_place_images_source_was_not_manually_edited` compara el
SHA-256 de `app/src/data/place-images.ts` con `0326a91c…270fb`, calculado sobre un checkout Windows
con CRLF. En Linux el archivo mide `6e690411…af9d`, idéntico al de la base `88b9592`. No se normalizó
ni se editó el archivo. El test B6.2 compara contra el SHA medido en la base y pasa.

**Duplicados por bytes:** no existía un check previo de hash de bytes (sólo por título/URL de Commons).
`validate-photography.py` incorpora `validate_unique_asset_bytes` (hashlib, sin Pillow): ningún
original ni rendición registrada comparte bytes con otra. Resultado: 579 archivos, 0 duplicados.

## 15. Frontend

| Comando | Resultado |
|---|---|
| `npm run build` | PASS (sólo el aviso heredado de chunk > 500 kB) |
| `npm run lint` | exit 0 — 1 advertencia heredada Fast Refresh `PlaceMap.tsx:14` (no tocada) |
| `npx vitest run` | **100/100 archivos, 3328/3328** (base 3327 + 1 test B6.2 nuevo) |

`place-images.test.ts` fija conteos del registro por convención (B6.1 también los actualizó):
7 WebP-only / 186 redimensionados, 187 lugares. El fallback histórico de Phase 4J para JP-211 se
conserva como hecho histórico para JP-120/JP-041/JP-168 y se añade un test B6.2 que fija las 26
adquisiciones (por slug) y los 9 unresolved sin fotografía.

## 16. Regresión visual

Build de producción con `vite preview`, Chromium 1194 (`/opt/pw-browsers`).

| Gate | Resultado |
|---|---|
| `app/scripts/block22-b6-2-photography-browser-audit.mjs` (nuevo) | **216/216** |
| `app/scripts/block20-place-detail-check.mjs` | **73/73** |
| `app/scripts/block2-photography-browser-audit.mjs` (teléfono, tableta, escritorio) | **81/81** |

El gate B6.2 muestrea lugares nuevos de los cuatro hubs — JP-024 Nezu (Tokio), JP-083 Genkō-an
(Kioto), JP-147 Enryaku-ji y JP-211 AnimeJapan (Osaka), JP-175 Nakijin y JP-201 Hate no Hama
(Okinawa) — en teléfono 390 y escritorio 1440, y comprueba: PlaceCard con la `-800w` nueva y
decodificada; la capa de carga desaparece tras `load`; ficha con una sola diapositiva, sin contador,
sin puntos y sin flechas; alt del registro en la ficha; `CreditsSheet` con autor, licencia, Commons y
enlace de licencia exactos del registro; ninguna petición de imagen fuera del origen; ninguna imagen
rota ni petición fallida. Fallback (JP-088 con la imagen abortada): la tarjeta de lista cae a
`PhotoPlaceholder` «No se pudo cargar la imagen», la compacta de SearchSheet a su icono y la ficha a
`gallery__error`, sin `<img>` rotos.

**Nota LQIP (brecha heredada, no de B6.2):** todos los registros llevan `lqip` válido, pero el UI —sin
cambios desde B6.1— no lo pinta todavía: la capa previa a la carga sigue siendo
`place-card__skeleton`. El gate verifica que esa capa desaparece tras cargar. Pintar el LQIP es un
cambio de UI, fuera del alcance de B6.2.

## 17. Cero cambios de UI

`git diff 88b9592 -- app/src/components app/src/*.css` vacío. Fuera de datos, assets y scripts, los
únicos archivos de `app/` tocados son `app/src/data/photography-metadata.json` (copia derivada,
idéntica byte a byte a la canónica), `app/src/data/place-images.test.ts` (pins de conteo) y el gate
nuevo en `app/scripts/`. Las fotografías aparecen solas por el contrato existente.

`app/src/data/place-images.ts`: SHA-256 antes y después
`6e6904113aa02f56795257302d05cc1c528e8935d01a810cb208157d4a17af9d` — **sin cambios** (el archivo lee el
JSON en tiempo de build; ningún cambio esperado). SHA-256 final de
`data/visual/photography-metadata.json`: `19cf548627fc1d50e89bba99ef8e5599d420abc2a93e6747710946ee76ec8a04`.

## 18. Cero Astra

Ningún archivo, rama ni documento Astra se leyó, creó o modificó.

## 19. `main` intacto

No se hizo checkout, commit, merge ni push a `main`; no se abrió PR. Todo el trabajo está en
`codex/block-22-b6-2-grade-a-photography`.

## 20. Siguiente bloque permitido

B6.2 **no** alcanza 147/147. Antes de B6.3 hace falta una decisión explícita sobre los 9 unresolved:
aceptarlos como cobertura pendiente (con `PhotoPlaceholder` e `imageBrief`, comportamiento vigente)
o abrir un sub-bloque que amplíe fuentes/licencias (p. ej. PD-self para JP-156). Una vez decidido,
el siguiente bloque del backlog es **B6.3 — 8 lugares Grado B sin fotografía**, **NO iniciado**.

## Archivos

- Pipeline/gates: `scripts/select-block22-b6-2-targets.py`,
  `scripts/prepare-block22-b6-2-photography-metadata.py`, `scripts/test_block22_b6_2_photography.py`,
  `scripts/build-photography-derivatives.py` (objetivo de bytes `-800w`),
  `scripts/validate-photography.py` (duplicados por bytes),
  `app/scripts/block22-b6-2-photography-browser-audit.mjs`.
- Datos: ambas copias de `photography-metadata.json`, `block22-b6-2-baseline.json`,
  `block22-b6-2-acquisition-plan.json`.
- Assets: 78 archivos nuevos (26 × original/`-800w`/`-400w`) y 82 `-800w` preexistentes re-codificadas.
