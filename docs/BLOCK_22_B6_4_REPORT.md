# Bloque 22 — B6.4: segunda fotografía experience para lugares Grado S

**Estado:** implementado y certificado en `codex/block-22-b6-4-grade-s-experience-photography`; pendiente de integración. No se abrió PR ni se hizo merge.

## Base y gate inicial

- SHA base canónica: `ad456be50e6b855bc79204bc50d26b154eb29441`.
- SHA de implementación certificado antes del cierre documental: `abf818029d42a004c7846353c9dead82c228e1cd`.
- El gate se derivó de `data/places.json`, `data/visual/photography-metadata.json` y la matriz inicial guardada en `data/visual/block22-b6-4-baseline.json`; no se codificó a mano una lista histórica.
- Resultado inicial: **32 lugares S**, identidad **32/32**, con experience **2/32**, objetivos reales **30**.

| ID | Lugar | Hub | Fotos iniciales | Roles y archivos iniciales | Necesita experience |
|---|---|---|---:|---|---|
| JP-021 | Tokyo National Museum | Tokio | 2 | `identity` — File:Tokyo National Museum Main Building PB304920.jpg; `context` — File:Tokyo National Museum, Honkan 2010.jpg | sí |
| JP-025 | Akihabara Electric Town | Tokio | 1 | `identity` — File:Akihabara Electric Town 06.jpg | sí |
| JP-033 | teamLab Borderless | Tokio | 1 | `identity` — File:TeamLab Borderless Azabudai Hills.jpg | sí |
| JP-044 | Ghibli Museum, Mitaka | Tokio | 1 | `identity` — File:Ghibli Museum 06.jpg | sí |
| JP-054 | Kiyomizu-dera | Kioto | 1 | `identity` — File:Kiyomizu-dera, Kyoto, November 2016 -01.jpg | sí |
| JP-066 | Fushimi Inari Taisha | Kioto | 1 | `identity` — File:Fushimi Inari Taisha tunnel droit.jpg | sí |
| JP-077 | Katsura Imperial Villa | Kioto | 1 | `identity` — File:Katsura Imperial Villa 桂離宮 X (951035811).jpg | sí |
| JP-089 | Nijō Castle | Kioto | 2 | `identity` — File:Ninomaru Palace, November 2016.jpg; `detail` — File:Nijojo-ninomaru-garden01s3s4592.jpg | sí |
| JP-096 | Sanjūsangen-dō | Kioto | 1 | `identity` — File:Sanjusangendo-building-dec2013.jpg | sí |
| JP-097 | Nintendo Museum | Kioto | 1 | `identity` — File:Nintendo Museum Entrance.jpg | sí |
| JP-125 | Universal Studios Japan | Osaka | 2 | `identity` — File:UNIVERSAL STUDIOS JAPAN ENTRANCE.jpg; `experience` — File:Hogwarts in Universal Studios Japan.jpg | no |
| JP-126 | SUPER NINTENDO WORLD | Osaka | 1 | `identity` — File:Super Nintendo World Entrance 5th Anniversary decoration at Universal Studios Japan.jpg | sí |
| JP-129 | Tōdai-ji | Osaka | 2 | `identity` — File:The Great Buddha Hall of Tōdai-ji, Nara, November 2016.jpg; `detail` — File:Daibutsu Grand bouddha - Tōdai-ji - Nara.jpg | sí |
| JP-134 | Hōryū-ji | Osaka | 1 | `identity` — File:Horyu-ji Kondo and Five-story Pagoda 2022.jpg | sí |
| JP-135 | Himeji Castle | Osaka | 1 | `identity` — File:20260429 Burg Himeji 01, Hyōgo, Japan anagoria.jpg | sí |
| JP-142 | Kinosaki Onsen | Osaka | 1 | `identity` — File:Kinosaki Onsen Otani River 2026-02 ac (1).jpg | sí |
| JP-143 | Koyasan temple stay | Osaka | 1 | `identity` — File:Ren'ge-in (Wakayama Koyasan) Temple hdsr S5 04.jpg | sí |
| JP-144 | Okunoin Cemetery | Osaka | 1 | `identity` — File:OKU - Jizo statues and memorials at Okunoin Cemetery, Koyasan, Japan, 2015.jpg | sí |
| JP-145 | Kumano Nachi Taisha + Nachi Falls | Osaka | 1 | `identity` — File:Nachikatsuura Seiganto-ji Three-Storied Pagoda & Nachi Falls 01.jpg | sí |
| JP-152 | Naoshima art island | Osaka | 2 | `identity` — File:Naoshima Ferry Terminal.jpg; `context` — File:150505 Benesse House Museum Naoshima Kagawa pref Japan01b3s5.jpg | sí |
| JP-157 | Shurijo Castle Park | Okinawa | 1 | `identity` — File:Shurei-mon 2023.jpg | sí |
| JP-162 | Sefa Utaki | Okinawa | 1 | `identity` — File:Okinawa Nanjo Sefa-utaki Gusuku site Yuinchi 04.jpg | sí |
| JP-173 | Okinawa Churaumi Aquarium | Okinawa | 1 | `identity` — File:Main tank of the Kuroshio Sea in Okinawa Churaumi Aquarium.JPG | sí |
| JP-179 | Yambaru National Park | Okinawa | 1 | `identity` — File:Subtropical Forest of Yanbaru National Park Okinawa 2018.jpg | sí |
| JP-184 | Zamami Island | Okinawa | 1 | `identity` — File:View of the ocean from Zamami Island, Okinawa, Japan (1) - October 2015.jpg | sí |
| JP-188 | Yonaha Maehama Beach | Okinawa | 1 | `identity` — File:Yonahamaehama Miyakojima Okinawa Japan01bs3s4592.jpg | sí |
| JP-192 | Kabira Bay | Okinawa | 1 | `identity` — File:Kabira Bay Ishigaki Island08s3s4592.jpg | sí |
| JP-196 | Taketomi Island village | Okinawa | 1 | `identity` — File:Walk in Taketomi Island 17.jpg | sí |
| JP-197 | Iriomote mangrove and jungle expedition | Okinawa | 1 | `identity` — File:Nakama River Iriomote Okinawa Japan05s3.jpg | sí |
| JP-203 | Tokyo Disneyland | Tokio | 1 | `identity` — File:Tokyo Disneyland Main Entrance (June 2025).jpg | sí |
| JP-204 | Tokyo DisneySea | Tokio | 1 | `identity` — File:Tokyo DisneySea-Volcania.jpg | sí |
| JP-205 | Sapporo Snow Festival | Sapporo | 2 | `identity` — File:Odori Park Sapporo Snow Festival 2007.JPG; `experience` — File:第65回さっぽろ雪まつり（SAPPORO SNOW FESTIVAL 65th） - panoramio.jpg | no |

Dos lugares ya tenían una fotografía con rol `experience`; por eso el trabajo no asumió que faltaban 32. Sus fotografías no se reclasificaron. Los otros **30** fueron particionados entre adquisiciones y excepciones documentadas.

## Decisiones de los 30 objetivos

- Adquiridas por `scripts/acquire-photography.py`: **15** nuevas fotografías `experience` en cuatro batches (3, 5, 6 y 1).
- Sin candidato legal y complementario suficiente: **15**.
- Experience Grado S: **2/32 → 17/32**. No se forzó el ideal 32/32.
- Todas las nuevas imágenes conservan `role: experience`; no se cambiaron roles preexistentes.

### Nuevas fotografías y comparación con identity

| ID / lugar | Identity que se conserva | Experience añadida | Qué información nueva aporta | Fuente original · autor · licencia | Resolución fuente → WebP preparado | Bytes original / 800w / 400w · LQIP |
|---|---|---|---|---|---|---|
| JP-025 · Akihabara Electric Town | `akihabara-electric-town.webp` · File:Akihabara Electric Town 06.jpg | `akihabara-pedestrian-crossing.webp` · File:Akhibara Crossing (14663984721).jpg | El candidato está tomado desde otra calle y centra el cruce y el flujo de peatones; la identity es una intersección diurna con edificios y señalética. La escala humana y el movimiento son información nueva. | [Commons](https://commons.wikimedia.org/wiki/File%3AAkhibara_Crossing_%2814663984721%29.jpg) · [página original](https://www.flickr.com/photos/bfishadow/14663984721/) · Julien G. · [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | 4928×3264 → 1600×1060 | 264,200 / 69,514 / 18,604 · sí |
| JP-054 · Kiyomizu-dera | `kiyomizu-dera-stage.webp` · File:Kiyomizu-dera, Kyoto, November 2016 -01.jpg | `kiyomizu-dera-otowa-fountain-visitors.webp` · File:Japan Kyoto KiyoMizuDera crowds queueing fountain DSC00685.jpg | La identity es una vista amplia del salón principal con follaje otoñal y sin actividad. El candidato muestra el ritual de Otowa desde otro punto del templo, con visitantes en circulación; no repite la fachada. | [Commons](https://commons.wikimedia.org/wiki/File%3AJapan_Kyoto_KiyoMizuDera_crowds_queueing_fountain_DSC00685.jpg) · [página original](https://commons.wikimedia.org/wiki/File:Japan_Kyoto_KiyoMizuDera_crowds_queueing_fountain_DSC00685.jpg) · David Monniaux · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 2592×1728 → 1600×1067 | 438,754 / 108,838 / 32,400 · sí |
| JP-066 · Fushimi Inari Taisha | `senbon-torii-path.webp` · File:Fushimi Inari Taisha tunnel droit.jpg | `fushimi-inari-shrine-visitors.webp` · File:Visitors at Fushimi Inari temple in Kyoto (53612593452).jpg | La identity muestra un corredor de torii vacío. El candidato cambia de punto y de sujeto: personas suben la escalinata hacia un edificio del santuario. Añade visita y escala sin duplicar el pasaje de torii. | [Commons](https://commons.wikimedia.org/wiki/File%3AVisitors_at_Fushimi_Inari_temple_in_Kyoto_%2853612593452%29.jpg) · [página original](https://www.flickr.com/photos/22974618@N00/53612593452) · Sergiy Galyonkin from Raleigh, USA · [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | 8682×5692 → 1600×1049 | 260,012 / 66,372 / 19,828 · sí |
| JP-096 · Sanjūsangen-dō | `sanjusangendo-main-hall.webp` · File:Sanjusangendo-building-dec2013.jpg | `sanjusangendo-couple-observes-gate.webp` · File:A couple looking at the gates (52370163970).jpg | La identity actual es una vista vacía de la fachada lateral del salón principal. Esta toma muestra la puerta exterior desde el patio y dos visitantes mirando el recinto, aportando relación visitante-lugar y escala, con composición distinta. | [Commons](https://commons.wikimedia.org/wiki/File%3AA_couple_looking_at_the_gates_%2852370163970%29.jpg) · [página original](https://www.flickr.com/photos/22974618@N00/52370163970/) · Sergiy Galyonkin from Raleigh, USA · [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | 9239×6328 → 1600×1096 | 334,330 / 67,862 / 19,490 · sí |
| JP-129 · Tōdai-ji | `todaiji-great-buddha-hall.webp` · File:The Great Buddha Hall of Tōdai-ji, Nara, November 2016.jpg | `todaiji-visitors-and-deer.webp` · File:Todaiji con visitantes y ciervos, Nara.jpg | La identity muestra el Gran Salón de Buda de frente, con personas pequeñas en el acceso. El candidato cambia al portal exterior y muestra visitantes interactuando en el sendero con ciervos; añade recorrido y ambiente, no otra fachada del Gran Salón. | [Commons](https://commons.wikimedia.org/wiki/File%3ATodaiji_con_visitantes_y_ciervos%2C_Nara.jpg) · [página original](https://commons.wikimedia.org/wiki/File:Todaiji_con_visitantes_y_ciervos,_Nara.jpg) · PerasNevadas · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 1920×1080 → 1280×720 | 236,036 / 67,654 / 21,346 · sí |
| JP-135 · Himeji Castle | `himeji-castle-keep.webp` · File:20260429 Burg Himeji 01, Hyōgo, Japan anagoria.jpg | `himeji-castle-visitor-approach.webp` · File:Throngs of people walking towards Himeji Castle, Himeji, 2016.jpg | La identity actual observa el castillo elevado desde el exterior del foso. El candidato muestra la ruta de llegada a nivel del suelo, con visitantes de espaldas y el castillo en segundo plano; cambia el punto de vista y aporta escala y recorrido. | [Commons](https://commons.wikimedia.org/wiki/File%3AThrongs_of_people_walking_towards_Himeji_Castle%2C_Himeji%2C_2016.jpg) · [página original](https://commons.wikimedia.org/wiki/File:Throngs_of_people_walking_towards_Himeji_Castle,_Himeji,_2016.jpg) · DimiTalen · [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.en) | 6016×4000 → 1600×1064 | 270,378 / 58,080 / 16,088 · sí |
| JP-142 · Kinosaki Onsen | `otani-river-canal.webp` · File:Kinosaki Onsen Otani River 2026-02 ac (1).jpg | `kinosaki-yukata-street-walk.webp` · File:Kinosaki Aruki.jpg | La identity es un canal nevado visto sin actividad. El candidato muestra una calle comercial a nivel peatonal con personas en yukata; cambia lugar, temporada, encuadre y actividad, y expresa cómo se recorre el onsen town. | [Commons](https://commons.wikimedia.org/wiki/File%3AKinosaki_Aruki.jpg) · [página original](https://commons.wikimedia.org/wiki/File:Kinosaki_Aruki.jpg) · Mypom9 · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 4256×2832 → 1600×1065 | 313,752 / 68,122 / 23,314 · sí |
| JP-143 · Koyasan temple stay | `koyasan-temple-lodging.webp` · File:Ren'ge-in (Wakayama Koyasan) Temple hdsr S5 04.jpg | `koyasan-shukubo-room-guest-experience.webp` · File:Temple lodging at Shojoshin-in on Koyasan (3810898436).jpg | La identity muestra desde fuera el edificio del hospedaje con jardín. El candidato abre una dimensión interior y doméstica: un huésped en la habitación tradicional, sin repetir fachada ni jardín. | [Commons](https://commons.wikimedia.org/wiki/File%3ATemple_lodging_at_Shojoshin-in_on_Koyasan_%283810898436%29.jpg) · [página original](https://web.archive.org/web/20190120221410/https://www.flickr.com/photos/49021451@N00/3810898436/) · Andrea Schaffer from Sydney, Australia · [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | 3953×2634 → 1600×1066 | 167,634 / 29,556 / 10,518 · sí |
| JP-144 · Okunoin Cemetery | `okunoin-memorial-mound.webp` · File:OKU - Jizo statues and memorials at Okunoin Cemetery, Koyasan, Japan, 2015.jpg | `okunoin-night-path.webp` · File:Pathway through graveyard at Okunoin at Koyasan at night - Japan 20170412102921 (34098937875).jpg | La identity centra las estatuas y memoriales durante el día. Esta imagen toma una senda nocturna amplia entre tumbas y árboles, haciendo legible el recorrido y la atmósfera del cementerio sin repetir el sujeto principal. | [Commons](https://commons.wikimedia.org/wiki/File%3APathway_through_graveyard_at_Okunoin_at_Koyasan_at_night_-_Japan_20170412102921_%2834098937875%29.jpg) · [página original](https://www.flickr.com/photos/zoonyzoozoodazoo/34098937875/) · Yiannis Theologos Michellis · [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.en) | 5148×3432 → 1600×1067 | 218,040 / 22,314 / 5,872 · sí |
| JP-145 · Kumano Nachi Taisha + Nachi Falls | `nachi-falls-pagoda.webp` · File:Nachikatsuura Seiganto-ji Three-Storied Pagoda & Nachi Falls 01.jpg | `nachi-pilgrimage-route.webp` · File:Nachi Falls Pilgrimage route (51928795062).jpg | La identity contrapone la pagoda de Seiganto-ji con Nachi Falls. El candidato muestra el sendero de peregrinación en otra parte del sitio; aporta recorrido entre el bosque y el conjunto sagrado, no otra vista de la cascada. | [Commons](https://commons.wikimedia.org/wiki/File%3ANachi_Falls_Pilgrimage_route_%2851928795062%29.jpg) · [página original](https://www.flickr.com/photos/raita/51928795062/) · Raita Futo from Tokyo, Japan · [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | 3710×5565 → 1067×1600 | 280,604 / 135,672 / 49,782 · sí |
| JP-157 · Shurijo Castle Park | `shurijo-castle-shureimon-gate.webp` · File:Shurei-mon 2023.jpg | `shuri-guided-tour.webp` · File:Local students give service members guided tour of Shuri Castle 121027-M-GX379-089.jpg | La identity es el portal Shureimon sin actividad de visita. Esta escena muestra a una guía local explicando el sitio a un visitante, con el entorno del recorrido alrededor; aporta interacción y uso del recinto. | [Commons](https://commons.wikimedia.org/wiki/File%3ALocal_students_give_service_members_guided_tour_of_Shuri_Castle_121027-M-GX379-089.jpg) · [página original](https://www.dvidshub.net/news/97104/local-students-give-service-members-guided-tour-shuri-castle) · Lance Cpl. Anne Henry · Public Domain | 4080×2720 → 1600×1067 | 273,206 / 67,378 / 18,940 · sí |
| JP-162 · Sefa Utaki | `sefa-utaki-yuinchi.webp` · File:Okinawa Nanjo Sefa-utaki Gusuku site Yuinchi 04.jpg | `sefa-utaki-ujoguchi-stairs.webp` · File:Stairs near Ujoguchi of Sefa-Utaki.JPG | La identity mira desde Yuinchi hacia el paisaje. Esta fotografía se concentra en un tramo de escaleras dentro del bosque, por lo que aporta recorrido y atmósfera en vez de repetir una vista panorámica. | [Commons](https://commons.wikimedia.org/wiki/File%3AStairs_near_Ujoguchi_of_Sefa-Utaki.JPG) · [página original](https://commons.wikimedia.org/wiki/File:Stairs_near_Ujoguchi_of_Sefa-Utaki.JPG) · そらみみ (Soramimi) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 3264×2448 → 1600×1200 | 355,448 / 80,706 / 27,048 · sí |
| JP-173 · Okinawa Churaumi Aquarium | `churaumi-aquarium-kuroshio-tank.webp` · File:Main tank of the Kuroshio Sea in Okinawa Churaumi Aquarium.JPG | `churaumi-visitors-watch-diver.webp` · File:USMC-081220-M-0902C-004.jpg | La identity actual presenta el tanque principal y sus animales desde el frente. Este encuadre añade la relación visitante-tanque y la presencia de un buzo trabajando, con las personas como escala y no como retrato. | [Commons](https://commons.wikimedia.org/wiki/File%3AUSMC-081220-M-0902C-004.jpg) · [página original](https://commons.wikimedia.org/wiki/File:USMC-081220-M-0902C-004.jpg) · Sgt. Josh Cox · Public Domain | 2000×1333 → 1600×1067 | 289,860 / 28,712 / 9,676 · sí |
| JP-184 · Zamami Island | `zamami-coast.webp` · File:View of the ocean from Zamami Island, Okinawa, Japan (1) - October 2015.jpg | `zamami-furuzamami-beach-visitors.webp` · File:JAP Zamami Furuzamami Beach.jpg | La identity mira desde una costa rocosa hacia el mar vacío. Esta toma muestra la playa de arena, visitantes y actividad de estancia, aportando escala y cómo se disfruta la isla sin repetir el paisaje costero. | [Commons](https://commons.wikimedia.org/wiki/File%3AJAP_Zamami_Furuzamami_Beach.jpg) · [página original](https://commons.wikimedia.org/wiki/File:JAP_Zamami_Furuzamami_Beach.jpg) · Grueslayer · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 3264×1840 → 1600×902 | 245,452 / 38,584 / 8,138 · sí |
| JP-196 · Taketomi Island village | `taketomi-island-house.webp` · File:Walk in Taketomi Island 17.jpg | `taketomi-water-buffalo-cart-ride.webp` · File:水牛車.jpg | La identity muestra una vivienda tradicional de Taketomi sin recorrido. Esta fotografía sitúa el carro de búfalo y a sus pasajeros en movimiento por la aldea, con una composición centrada en la experiencia de visita. | [Commons](https://commons.wikimedia.org/wiki/File%3A%E6%B0%B4%E7%89%9B%E8%BB%8A.jpg) · [página original](https://www.flickr.com/photos/alberth2/4975951555/) · Tzuhsun Hsu · [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | 3264×2176 → 1600×1067 | 379,526 / 76,006 / 24,558 · sí |

Las resoluciones de fuente se leen de los metadatos originales; el WebP preparado no supera la dimensión máxima del contrato y no hubo upscale artificial. Los assets originales preparados, `-800w`, `-400w` y LQIP se generaron/verificaron con el pipeline existente.

### Objetivos sin experience y candidatos rechazados

Categorías: **7 copyright de sujeto**, **7 sin experiencia representativa**, **1 resolución**.

#### JP-021 — Tokyo National Museum · UNRESOLVED — COPYRIGHTED SUBJECT

Las fotos localizadas de interiores con visitantes eran vacías o mostraban objetos sin una experiencia espacial. La única escena de visita activa localizada muestra de forma prominente a Hello Kitty durante un evento temporal; se rechaza porque la licencia del fotógrafo no resuelve los derechos del personaje. No se cambia el rol de la imagen context existente.

Búsqueda: Wikimedia Commons; Flickr; Tokyo National Museum official photography guidance.
Orientación oficial consultada: [https://www.tnm.jp/modules/r_free_page/index.php?id=127&lang=en](https://www.tnm.jp/modules/r_free_page/index.php?id=127&lang=en).
- Rechazado: [Tokyo National Museum (54166142528).jpg](https://commons.wikimedia.org/wiki/File:Tokyo_National_Museum_(54166142528).jpg) — Escena de evento con Hello Kitty y señal promocional como elementos centrales; riesgo de copyright de personaje no resuelto.
- Rechazado: [Interior view - Tokyo National Museum - DSC05447.JPG](https://commons.wikimedia.org/wiki/File:Interior_view_-_Tokyo_National_Museum_-_DSC05447.JPG) — CC0 y ubicación verificables, pero sala vacía con ornamentación; no comunica visita, recorrido ni escala humana.
- Rechazado: [Tokyo National Museum closed by COVID-19.jpg](https://commons.wikimedia.org/wiki/File:Tokyo_National_Museum_closed_by_COVID-19.jpg) — Exterior cerrado y sin visitantes; no representa la experiencia dentro del museo.

#### JP-033 — teamLab Borderless · UNRESOLVED — COPYRIGHTED SUBJECT

La identity actual corresponde a la sede de Azabudai Hills inaugurada en 2024. Las imágenes con experiencia encontradas de la sede nueva muestran obras inmersivas de teamLab; la licencia CC del fotógrafo no aclara los derechos de esas obras. Las imágenes licenciadas de Odaiba son de una sede anterior y no representan el lugar actual.

Búsqueda: Wikimedia Commons; Flickr.
- Rechazado: [TeamLab Borderless, Odaiba, Tokyo, Japan (49070113608).jpg](https://commons.wikimedia.org/wiki/File:TeamLab_Borderless,_Odaiba,_Tokyo,_Japan_(49070113608).jpg) — Sede anterior de Odaiba, no la ubicación actual de Azabudai Hills; además muestra una instalación artística contemporánea.
- Rechazado: [teamLab Borderless: MORI Building DIGITAL ART MUSEUM](https://www.flickr.com/photos/greentulips/sets/72177720329401968) — Las escenas de instalación que muestran el recorrido están dominadas por obras de teamLab cuyos derechos no se resuelven con la licencia del fotógrafo.

#### JP-044 — Ghibli Museum, Mitaka · UNRESOLVED — COPYRIGHTED SUBJECT

El museo prohíbe fotografiar sus interiores. Las escenas de visita encontradas en fuentes licenciadas dependen de personajes y diseños de Studio Ghibli (incluido el acceso/taquilla de Totoro), cuyos derechos no quedan cubiertos por la licencia del fotógrafo. Los registros externos restantes muestran solo el edificio vacío y no añaden experiencia frente a la identity.

Búsqueda: Wikimedia Commons; Flickr; Ghibli Museum official visitor guidance.
Orientación oficial consultada: [https://www.ghibli-museum.jp/en/](https://www.ghibli-museum.jp/en/).
- Rechazado: [Ghibli Museum Exterior Entrance Totoro Ticket Booth, Inokishira Park](https://www.flickr.com/photos/joshuamellin/53491817733/) — El puesto/figura de Totoro es un elemento central con copyright contemporáneo no aclarado.
- Rechazado: [TT061204-16J ghibli museum entrance sign.jpg](https://commons.wikimedia.org/wiki/File:TT061204-16J_ghibli_museum_entrance_sign.jpg) — Señal y exterior estáticos, sin personas ni recorrido; no aporta una segunda dimensión experience.
- Rechazado: [Ghibli museum.png](https://commons.wikimedia.org/wiki/File:Ghibli_museum.png) — Exterior vacío y casi frontal, redundante con la identity.

#### JP-077 — Katsura Imperial Villa · UNRESOLVED — NO REPRESENTATIVE EXPERIENCE

Se buscaron rutas, senderos y casas de té con personas en Commons, repositorios DPLA y Flickr. Las rutas con licencia compatible disponibles son reproducciones de archivo subexpuestas y sin visitantes; una escena con personas es también muy oscura y no permite apreciar la experiencia. Las imágenes adecuadas para ver jardines son vacías y repiten la información de paisaje de la identity.

Búsqueda: Wikimedia Commons; Digital Public Library of America; Flickr.
- Rechazado: [Katsura Imperial Villa: Stone walkway and porch (DPLA/Commons scan)](https://commons.wikimedia.org/wiki/Category:Katsura_Imperial_Villa) — Archivo con licencia CC BY 4.0 pero severamente subexpuesto; no permite leer el recorrido o la relación con la arquitectura.
- Rechazado: [Katsura Imperial Villa garden path (DPLA/Commons scan)](https://commons.wikimedia.org/wiki/Category:Katsura_Imperial_Villa) — Sendero vacío y muy oscuro, sin escala humana ni lectura clara del recorrido.
- Rechazado: [Katsura Imperial Villa visit photo](https://www.flickr.com/photos/freakland/217158196/) — La página solo declara Some rights reserved y no identifica una licencia reutilizable permitida.

#### JP-089 — Nijō Castle · UNRESOLVED — NO REPRESENTATIVE EXPERIENCE

Se buscaron jardines, rutas interiores y escenas con visitantes en Commons, Flickr y Openverse. Los candidatos licenciados localizados muestran jardines vacíos y aportan contexto o detalle, pero no muestran recorrido, personas ni uso del palacio. Una segunda arquitectura vacía sería redundante con la identity.

Búsqueda: Wikimedia Commons; Flickr; Openverse.
- Rechazado: [Nijojo-ninomaru-garden04s3s4592.jpg](https://commons.wikimedia.org/wiki/File:Nijojo-ninomaru-garden04s3s4592.jpg) — Jardín vacío; aporta contexto del recinto, no cómo se recorre o se usa.
- Rechazado: [Gardens of the Nijo Castle, Kyoto (14635952117).jpg](https://commons.wikimedia.org/wiki/File:Gardens_of_the_Nijo_Castle,_Kyoto_(14635952117).jpg) — CC0 pero composición de jardín vacía y sin visitantes; no se considera experience.
- Rechazado: [Ninomaru Garden @ Nijo Castle @ Kyoto (13405502463).jpg](https://commons.wikimedia.org/wiki/File:Ninomaru_Garden_%40_Nijo_Castle_%40_Kyoto_(13405502463).jpg) — Otra vista de jardín vacío, redundante con la identity y sin información de actividad o recorrido.

#### JP-097 — Nintendo Museum · UNRESOLVED — COPYRIGHTED SUBJECT

La única imagen abierta localizada del museo es la fachada exterior vacía y se solapa con la identity. Las escenas de actividad del museo disponibles en Reuters y prensa muestran visitantes jugando con consolas, personajes y productos Nintendo; sus derechos del sujeto no quedan resueltos por la licencia de la fotografía. No se obtuvo una escena de visita legalmente reutilizable y visualmente complementaria.

Búsqueda: Wikimedia Commons; Flickr; Nintendo Museum official site; Reuters Connect.
- Rechazado: [Nintendo Museum Entrance.jpg](https://commons.wikimedia.org/wiki/File:Nintendo_Museum_Entrance.jpg) — CC BY-SA 4.0 y lugar verificable, pero exterior vacío que repite la dimensión arquitectónica de la identity; no muestra una experiencia de visita.
- Rechazado: [Nintendo Museum \| jpellgen, Flickr](https://www.flickr.com/photos/jpellgen/54162327141/) — La página original solo declara ‘Some rights reserved’ sin licencia permitida verificable; además muestra la fachada, no actividad de visitantes.
- Rechazado: [A visitor plays a game at the Nintendo Museum during a press preview in Uji](https://www.reutersconnect.com/item/a-visitor-plays-a-game-at-the-nintendo-museum-during-a-press-preview-in-uji/dGFnOnJldXRlcnMuY29tLDIwMjQ6bmV3c21sX1JDMkc3QUEzN0VHSQ) — Imagen con licencia comercial de Reuters y un juego Nintendo como sujeto; no es una licencia reutilizable permitida y permanecen los derechos de la obra mostrada.

#### JP-126 — SUPER NINTENDO WORLD · UNRESOLVED — COPYRIGHTED SUBJECT

Las imágenes con visitantes y actividad dentro de SUPER NINTENDO WORLD se centran en escenografía, juegos, personajes y elementos de Nintendo. Las licencias CC de sus fotógrafos no resuelven los derechos de esas obras contemporáneas e instalaciones. Las vistas licenciadas sin esos elementos son fachadas estáticas o encuadres redundantes, por lo que no se fuerza una experience.

Búsqueda: Wikimedia Commons; Flickr; Openverse; Universal Studios Japan official site.
- Rechazado: [USJ Super Nintendo World overview.jpg](https://commons.wikimedia.org/wiki/File:USJ_Super_Nintendo_World_overview.jpg) — Panorámica de parque temático con arquitectura y objetos de Nintendo protegidos como protagonistas; la licencia fotográfica no limpia los derechos del sujeto.
- Rechazado: [Super Nintendo World Entrance.jpg](https://commons.wikimedia.org/wiki/File:Super_Nintendo_World_Entrance.jpg) — La instalación con branding y elementos reconocibles del mundo de Super Mario ocupa casi todo el encuadre; el riesgo de copyright no está resuelto.
- Rechazado: [Super Nintendo World Theme Park at USJ Osaka Evening Sky](https://www.flickr.com/search/?text=Super%20Nintendo%20World%20USJ%20Osaka) — Las fotos de actividad encontradas muestran personajes y decorados del parque como sujeto principal. No se aprueba una búsqueda genérica como una página de fuente ni se usa como activo.

#### JP-134 — Hōryū-ji · UNRESOLVED — NO REPRESENTATIVE EXPERIENCE

Commons, DPLA, Flickr y la guía turística oficial se buscaron para recorridos y visitantes del complejo. Los archivos libres localizados son vistas vacías del pórtico o de la pagoda; una diapositiva de archivo de 1963 con una figura diminuta es otra vista arquitectónica y no añade actividad o recorrido. El resultado visual complementario disponible en Flickr declara CC BY-NC-ND y no puede usarse.

Búsqueda: Wikimedia Commons; Digital Public Library of America; Flickr; Visit Nara official guide.
- Rechazado: [(Pagoda at Horyuji Temple, Japan) - DPLA - d98c2a15b3edeb2000a4eaeb52c9b137.jpg](https://commons.wikimedia.org/wiki/File:(Pagoda_at_Horyuji_Temple,_Japan)_-_DPLA_-_d98c2a15b3edeb2000a4eaeb52c9b137.jpg) — CC BY 4.0, pero diapositiva de archivo de 1963 centrada en la pagoda; la pequeña figura al borde no muestra recorrido ni experiencia significativa y la composición repite la arquitectura de la identity.
- Rechazado: [HoryujiGate0308.jpg](https://commons.wikimedia.org/wiki/File:HoryujiGate0308.jpg) — Puerta vacía en resolución baja, sin actividad de visita ni escala humana visible.
- Rechazado: [Temple Horyuji in Nara \| Japan-Kyoto.de](https://www.flickr.com/photos/satorinihon/8674127287/) — La página original declara CC BY-NC-ND 4.0, que está fuera de las licencias permitidas.

#### JP-152 — Naoshima art island · UNRESOLVED — NO REPRESENTATIVE EXPERIENCE

La identity vigente ya muestra una persona caminando ante la terminal de ferry. La búsqueda razonable en Commons, Flickr y Openverse no halló una imagen compatible de actividad que aportara información nueva: los candidatos disponibles son puerto o barco sin interacción, estacionamiento de bicicletas sin visitantes, o imágenes con ubicación no verificable. Otra escena de terminal o arquitectura sería redundante.

Búsqueda: Wikimedia Commons; Flickr; Openverse; Naoshima Tourism.
- Rechazado: [From the ferry to Naoshima (7046722809).jpg](https://commons.wikimedia.org/wiki/File:From_the_ferry_to_Naoshima_(7046722809).jpg) — El registro de origen y sus coordenadas corresponden a Megijima, no a Naoshima; ubicación no verificable.
- Rechazado: [Naoshima honmura port bike parking inside.jpg](https://commons.wikimedia.org/wiki/File:Naoshima_honmura_port_bike_parking_inside.jpg) — Estacionamiento de bicicletas vacío, sin personas ni uso visible; imagen de un objeto/espacio de servicio que no representa la visita.
- Rechazado: [Miyanoura port02s3872.jpg](https://commons.wikimedia.org/wiki/File:Miyanoura_port02s3872.jpg) — El barco atracado domina el encuadre; no muestra llegada, embarque o relación de visitantes con el lugar y repite el contexto portuario ya visible en la identity.

#### JP-179 — Yambaru National Park · UNRESOLVED — NO REPRESENTATIVE EXPERIENCE

Se buscaron recorridos y actividades en Commons, Flickr y fuentes de turismo local. Las imágenes reutilizables identificadas son bosque vacío parecido a la identity, un letrero del parque o material de un parque temático ajeno; las fotografías adecuadas de senderismo en fuentes oficiales no declaran una licencia compatible. No se fuerza una escena forestal genérica como experience.

Búsqueda: Wikimedia Commons; Flickr; Openverse; Yanbaru National Park official site; Okinawa tourism.
- Rechazado: [Yanbaru National Park.jpg](https://commons.wikimedia.org/wiki/File:Yanbaru_National_Park.jpg) — Señal del parque, sin experiencia ni recorrido.
- Rechazado: [Yambaru forest in Ryukyu Mura](https://commons.wikimedia.org/wiki/Category:Yanbaru_National_Park) — La foto identificada es del parque temático Ryukyu Mura, no del parque nacional.
- Rechazado: [Yanbaru forest hiking gallery](https://www.okinawastory.jp/feature/yanbaru) — Material oficial de promoción sin una licencia reutilizable compatible explícita.

#### JP-188 — Yonaha Maehama Beach · UNRESOLVED — RESOLUTION

Se buscaron imágenes en Commons, Flickr y Openverse. La candidata de windsurfing (1920 × 1080, CC BY-SA 4.0, ubicación exacta) sí muestra una actividad distinta, pero la adquisición sólo puede realizarse con el pipeline requerido: Commons devuelve el original sin miniatura al pedir 1600 px (thumbnail_unscaled), y el pipeline lo rechaza para no descargar directamente el original. La miniatura 1280 px existe, pero este pipeline no ofrece una solicitud de tamaño alternativo para un mismo archivo; no se modifica el registro ni se evita su control.

Búsqueda: Wikimedia Commons; Flickr; Openverse.
- Rechazado: [KIMG0450windsurfing in maehama.jpg](https://commons.wikimedia.org/wiki/File:KIMG0450windsurfing_in_maehama.jpg) — La comparación visual confirma un windsurfista en movimiento que aportaría una experiencia distinta; el original es 1920 × 1080, pero el pipeline solicita 1600px y Commons devuelve la URL original sin miniatura. Se rechaza para no descargar el original fuera del contrato ni modificar el pipeline para forzar este caso.
- Rechazado: [Yonaha Beach (51924567580).jpg](https://commons.wikimedia.org/wiki/File:Yonaha_Beach_(51924567580).jpg) — CC BY 2.0 y ubicación exacta, pero la imagen muestra la misma costa y pasarela vacías que la identity; no aporta uso de la playa.
- Rechazado: [Miyako maipama 1.jpg](https://commons.wikimedia.org/wiki/File:Miyako_maipama_1.jpg) — CC BY-SA 4.0, pero es otra vista estática de arena y mar sin actividad o recorrido; resulta redundante con la identity.

#### JP-192 — Kabira Bay · UNRESOLVED — NO REPRESENTATIVE EXPERIENCE

La comparación visual de la candidata CC BY disponible muestra agua, isletas y una sola embarcación sin pasajeros perceptibles; su composición sigue leyendo como paisaje de la bahía y no como visita. Otra fotografía licenciada de barcos de fondo de cristal aparece identificada con copyright reservado en Flickr; el material oficial de JNTO no publica licencia compatible. No se fuerza una segunda panorámica como experience.

Búsqueda: Wikimedia Commons; Flickr; Japan National Tourism Organization.
- Rechazado: [Kabira Bay (52117120293).jpg](https://commons.wikimedia.org/wiki/File:Kabira_Bay_(52117120293).jpg) — CC BY 2.0 y coordenadas exactas, pero el candidato muestra una bahía casi vacía con un único barco distante; al compararlo con la identity de Kabira con barcos, no añade pasajeros, actividad ni otro modo de recorrer el sitio.
- Rechazado: [Glass bottom boats in tropical lagoon in Kabira bay, Yaeyama Islands, Ishigaki, Japan](https://www.flickr.com/photos/mytripsmypics/53198347426) — La escena sería más representativa, pero la página original identifica copyright de Eric Lafforgue y no declara una licencia permitida.
- Rechazado: [Kabira Bay Glass Bottom Boats](https://www.japan.travel/en/spot/375/) — La fuente oficial muestra la actividad de paseo en barco, pero no declara una licencia compatible para reutilizar las fotografías.

#### JP-197 — Iriomote mangrove and jungle expedition · UNRESOLVED — NO REPRESENTATIVE EXPERIENCE

La búsqueda en Commons, Flickr, Openverse y la guía oficial de Okinawa halló manglares y fotografías de kayak, pero las imágenes con personas proceden de páginas sin licencia compatible o muestran otra isla; las imágenes CC verificables del Nakama River son paisajes vacíos. La candidata CC BY comparada desde arriba vuelve a mostrar el manglar sin visitantes ni recorrido, por lo que no complementa la identity con una experiencia.

Búsqueda: Wikimedia Commons; Flickr; Openverse; Visit Okinawa official guide; UNESCO World Heritage Centre.
- Rechazado: [Iriomote mangroves (52117082031).jpg](https://commons.wikimedia.org/wiki/File:Iriomote_mangroves_(52117082031).jpg) — CC BY 2.0 y ubicación exacta, pero muestra una franja de manglar y lodo desde arriba sin personas o recorrido; frente a la identity de Nakama River sólo añade otra vista vacía de la misma vegetación.
- Rechazado: [Iriomote mangrove 2007-04-04.jpg](https://commons.wikimedia.org/wiki/File:Iriomote_mangrove_2007-04-04.jpg) — CC BY-SA disponible y ubicación en Nakama River, pero representa sólo árboles de manglar y agua; no muestra visita, actividad o escala humana.
- Rechazado: [Kayaking iriomote mangrove river](https://www.tripadvisor.com/LocationPhotoDirectLink-g424929-d7240816-i351322294-Iriomote_Osanpo_Kibun-Iriomote_jima_Taketomi_cho_Yaeyama_gun_Okinawa_Pre.html) — La imagen muestra la experiencia adecuada, pero la página no declara una licencia abierta compatible para reutilización.
- Rechazado: [Mangrove forest (Nakama River, Iriomote Is.)](https://whc.unesco.org/en/documents/165860) — El archivo indica copyright © MOEJ y NoDerivatives, incompatible con la licencia permitida y el pipeline de reencodificación.

#### JP-203 — Tokyo Disneyland · UNRESOLVED — COPYRIGHTED SUBJECT

La búsqueda en Wikimedia Commons, Flickr y el sitio oficial del resort encontró escenas con visitantes que incluyen de forma sustancial el castillo, decoraciones o elementos de Disney. La licencia CC o CC0 del fotógrafo no despeja los derechos de esos sujetos contemporáneos. El material oficial no declara una licencia de reutilización compatible, y otras entradas licenciadas son fachadas estáticas redundantes con la identity. Se mantiene unresolved sin asumir una excepción legal.

Búsqueda: Wikimedia Commons; Flickr; Tokyo Disney Resort official photography FAQ; Tokyo Disney Resort official park terms.
- Rechazado: [Tokyo Disneyland Opening Year.jpg](https://commons.wikimedia.org/wiki/File:Tokyo_Disneyland_Opening_Year.jpg) — CC0 y visitantes verificables, pero la familia aparece ante el castillo icónico de Disney; los derechos del sujeto contemporáneo no quedan resueltos por la licencia del fotógrafo.
- Rechazado: [Tokyo Disneyland Entrance (9409986068).jpg](https://commons.wikimedia.org/wiki/File:Tokyo_Disneyland_Entrance_(9409986068).jpg) — CC BY 2.0, pero representa la entrada y señalización del parque casi igual que la identity y no muestra una experiencia distinta.
- Rechazado: [Tokyo Disneyland Electrical Parade Dreamlights](https://www.tokyodisneyresort.jp/en/tdl/show/detail/913/) — La página oficial describe el desfile y ofrece fotografías promocionales sin una licencia compatible de reutilización; personajes y decorados protegidos son centrales.

#### JP-204 — Tokyo DisneySea · UNRESOLVED — COPYRIGHTED SUBJECT

La búsqueda en Wikimedia Commons, Flickr y el sitio oficial del resort no encontró una escena de actividad legalmente clara que no dependa de decorados temáticos contemporáneos. Las fotos CC identificadas muestran el volcán Mount Prometheus, el puerto escenográfico o góndolas del parque: el fotógrafo puede licenciar su toma, pero no resuelve automáticamente los derechos de esas obras. No se convierte una segunda vista arquitectónica en experience.

Búsqueda: Wikimedia Commons; Flickr; Tokyo Disney Resort official photography FAQ; Tokyo Disney Resort official park terms.
- Rechazado: [Tokyo Disney Sea (52853628038).jpg](https://commons.wikimedia.org/wiki/File:Tokyo_Disney_Sea_(52853628038).jpg) — CC BY 2.0, pero el puerto y la arquitectura temática dominan la imagen y repiten la dimensión visual de Mount Prometheus ya presente en la identity; posible derecho de las obras de parque no resuelto.
- Rechazado: [Mediterranean Harbor: Venetian Gondolas](https://www.flickr.com/photos/jdhilger/6978548593) — La escena de recorrido muestra góndolas en un puerto escenográfico, pero la página original no confirma una licencia reutilizable compatible; el decorado del parque también sigue siendo sujeto central.
- Rechazado: [Can I take photos or videos at the Parks?](https://faq-en.tokyodisneyresort.jp/answer/680ba03d01fdf7431bafb1dd/) — La guía oficial no otorga una licencia de reutilización para imágenes promocionales o instalaciones protegidas; sólo confirma límites de fotografía comercial/publicación.

### Candidatos preparados y rechazados durante la comparación

- JP-184 · File:Sea kayaking Zamami Okinawa.jpg — CC BY 2.0 y ubicación correctas, pero el original es 1280 × 854 y Commons no sirvió la miniatura 1024px que exige el pipeline; se rechazó para no descargar el original como sustituto ni alterar el contrato de adquisición.
- JP-188 · File:KIMG0450windsurfing in maehama.jpg — La imagen tiene CC BY-SA 4.0 y aporta actividad, pero el pipeline solicitó 1600px y Commons devolvió el original (thumbnail_unscaled); no se elude el control de descarga directa ni se altera el pipeline.
- JP-188 · File:Yonaha Beach (51924567580).jpg — CC BY 2.0, pero la comparación visual muestra la misma costa y pasarela sin actividad humana legible; composición redundante con la identity, así que se reemplazó por la candidata de windsurfing.
- JP-192 · File:Kabira Bay (52117120293).jpg — CC BY 2.0, pero la comparación visual muestra agua vacía y un barco muy pequeño; repite la lectura escénica de la identity sin experiencia de visita.
- JP-197 · File:Iriomote mangroves (52117082031).jpg — CC BY 2.0, pero la toma elevada presenta sólo manglares y lodo sin actividad ni visitantes; otra vista de paisaje, no experience.

## Cobertura, conteos y conservación

| Métrica | Antes de B6.4 | Después de B6.4 |
|---|---:|---:|
| Imágenes registradas | 200 | 215 |
| Lugares con fotografía | 194 | 194 |
| Grado S con identity | 32/32 | 32/32, las 32 identidades originales conservadas byte a byte |
| Grado S con experience | 2/32 | 17/32 |
| Grado A | 139/147 + 8 excepciones | 139/147 + 8 excepciones, sin regresión |
| Grado B | 23/25 + 2 excepciones | 23/25 + 2 excepciones, sin regresión |

Excepciones A intactas: JP-050, JP-079, JP-095, JP-120, JP-121, JP-168, JP-195, JP-202. Excepciones B intactas: JP-041, JP-171. El total de lugares con fotografía se mantiene en 194; las 15 adquisiciones son segundas/terceras imágenes de lugares ya cubiertos.

`app/src/data/place-images.ts` no se editó. SHA-256 raw de la base inicial: `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb`; SHA-256 raw final: `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb` (iguales). Copias de metadata canónica/app sincronizadas: `a6aab4051207518fd38a8fa4fea235efaae20a6207c464f7925bd49980ae379a` ambas. Duplicados de bytes: **0**.

## Presupuesto de listas y coste de ficha

El presupuesto completo por hub suma todas las miniaturas `identity -800w` que pueden aparecer en la lista. El browser audit también midió los bytes efectivamente observados al recorrer la lista seleccionada (un subconjunto según la carga lazy); ambos se mantienen por debajo del total identity del hub.

| Hub | Lista completa identity 800w (B) | Browser móvil observado (B) | Browser escritorio observado (B) | ≤ 3.500.000 B |
|---|---:|---:|---:|---|
| Tokio | 3,421,914 | 2,067,050 | 1,780,442 | PASS |
| Kioto | 3,408,406 | 3,159,424 | 2,386,088 | PASS |
| Osaka | 3,170,658 | 3,129,520 | 3,129,520 | PASS |
| Okinawa | 2,866,922 | 2,788,756 | 2,788,756 | PASS |
| Sapporo | 166,986 | 166,986 | 166,986 | PASS |
| Nagoya | 69,552 | — | — | PASS |
| Fukuoka | 69,284 | — | — | PASS |

El audit muestreó Tokio, Kioto, Osaka, Okinawa (dos Grado S) y Sapporo. PlaceCard mantuvo `identity`; ninguna de las 17 experiences Grado S se descargó al recorrer estas listas. No se redujo compresión para el gate.

Coste estimado de apertura de ficha medido en 390×844 y 1440×900. En estos viewports el `srcSet` de B20 selecciona la rendición `-800w`; cuando el navegador ya la tenía en caché se usó el tamaño exacto del asset local. No se suma este coste al presupuesto de recorrido de ciudad.

| Lugar muestreado | Identity inicial (B) | Experience (B) | Resto de galería (B) | Total ficha (B) |
|---|---:|---:|---:|---:|
| JP-025 · Akihabara Electric Town | 64,654 | 69,514 | 0 | 134,168 |
| JP-054 · Kiyomizu-dera | 67,272 | 108,838 | 0 | 176,110 |
| JP-129 · Tōdai-ji | 69,584 | 67,654 | 66,600 | 203,838 |
| JP-173 · Okinawa Churaumi Aquarium | 26,506 | 28,712 | 0 | 55,218 |
| JP-196 · Taketomi Island village | 73,506 | 76,006 | 0 | 149,512 |
| JP-205 · Sapporo Snow Festival | 97,270 | 17,990 | 0 | 115,260 |

## Gates y browser audit

| Gate | Resultado |
|---|---|
| `scripts/validate-photography.py` | PASS |
| `scripts/test_photography.py` | 40/40 |
| `scripts/test_photography_rendition.py` | 28/28 |
| `scripts/test_block22_photography.py` | 8/8 |
| `scripts/test_block22_b6_2_photography.py` | 11/11 |
| `scripts/test_block22_b6_3_photography.py` | 8/8; aserción histórica ajustada para aislar sus seis altas ante bloques posteriores |
| `scripts/test_block22_b6_4_photography.py` | 9/9 |
| `scripts/build-photography-derivatives.py --check --quiet` | PASS — 215 registros; 400w 4.30 MiB y 800w 13.82 MiB |
| `npm run build` | PASS |
| `npm run lint` | exit 0; sólo warning heredada `PlaceMap.tsx:14` |
| `npx vitest run` | 100 archivos; 3328/3328 |
| `node --check app/scripts/block22-b6-4-photography-browser-audit.mjs` | PASS |
| Browser audit B6.4 | **462/462**, 0 fallos |

El browser audit corrió sobre Vite preview de producción en móvil (390×844) y escritorio (1440×900), con muestras JP-025 Tokio, JP-054 Kioto, JP-129 Osaka, JP-173 y JP-196 Okinawa, y JP-205 Sapporo. Verificó tarjeta principal y resultado compacto usando identity; lista sin experience eager; orden identity → experience → detail/context; galería B20 con scroll-snap, contador, puntos, teclado/flechas y ratio responsive; créditos por archivo/autor/licencia; retorno de foco al cerrar créditos y lightbox; fallback al abortar identity; cero fotos rotas y cero fetch fotográfico externo.

## Límites respetados y siguiente bloque

- **Cero rediseño UI**; sólo se actualizaron expectativas de pruebas históricas que fijaban conteos anteriores a B6.4. No se modificó `place-images.ts`.
- **Cero Astra**, cero IA, cero sustituciones de identities correctas, cero nuevos objetivos A/B/C/D y ninguna reclasificación artificial.
- `main` intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`; no se hizo merge. La rama B6.4 contiene cuatro commits de batch publicados y permanece sin integrar.
- Siguiente bloque permitido después de integrar B6.4: tercera foto complementaria para Grado S (detail, context o seasonal según el lugar). **No iniciado.**

### Commits de batch publicados

- Batch 1: `ffab05a730f2f14f24db499459549ecbf06845b2`
- Batch 2: `964ff51724a956f044458276237a723e4878422d`
- Batch 3: `2acaeedd1be09ecf4161719aa9e798417995c08d`
- Batch 4: `674bd0b` (JP-196 Taketomi Island village).

