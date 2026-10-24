# Informe B6.5 — tercera fotografía complementaria para Grado S

**Estado:** implementado y certificado en rama fuente; pendiente de integración. No hubo merge ni PR.

## Base y gate inicial

- Rama: `codex/block-22-b6-5-grade-s-third-photography`. Base canónica: `3ebe7aee70d8046448f10749984d5829b7a4f2cc`.
- Los batches de adquisición y sus pushes quedaron en cuatro checkpoints; el último checkpoint fotográfico fue `a9d7969e551102e2e5167db3167e746ff0e86c7a`. El SHA final de entrega se confirma al cierre contra el remoto.
- Estado inicial derivado directamente del registro: 32 lugares S; identity 32/32; experience 17/32; 215 imágenes en 194 lugares con fotografía.
- Grado A: 139/147 + 8 excepciones (JP-050, JP-079, JP-095, JP-120, JP-121, JP-168, JP-195, JP-202). Grado B: 23/25 + 2 excepciones (JP-041, JP-171). Gate concordante.
- Las 15 excepciones `experience` de B6.4 se mantienen unresolved: JP-021, JP-033, JP-044, JP-077, JP-089, JP-097, JP-126, JP-134, JP-152, JP-179, JP-188, JP-192, JP-197, JP-203 y JP-204. B6.5 no añadió roles `experience`.

| Batch | Targets | Adquiridas | Unresolved | Commit (pushed a esta rama) |
|---:|---:|---:|---:|---|
| 1 | 8 | 3 | 5 | `d0125910af52bf459c546ed7a3ba62a8d1c6a061` |
| 2 | 8 | 3 | 5 | `27bd68bee7ef1f33b8027aaed3d4631095caffd6` |
| 3 | 8 | 3 | 5 | `4495d3e389c3fa062b254e6ff87cfe14c1e355d3` |
| 4 | 4 | 1 | 3 | `a9d7969e551102e2e5167db3167e746ff0e86c7a` |

### Matriz inicial de los 32 lugares S

| ID | Lugar | Hub | Fotos | Roles iniciales | Necesita B6.5 |
|---|---|---|---:|---|---|
| JP-021 | Tokyo National Museum | Tokio | 2 | identity, context | no |
| JP-025 | Akihabara Electric Town | Tokio | 2 | identity, experience | sí |
| JP-033 | teamLab Borderless | Tokio | 1 | identity | sí |
| JP-044 | Ghibli Museum, Mitaka | Tokio | 1 | identity | sí |
| JP-054 | Kiyomizu-dera | Kioto | 2 | identity, experience | sí |
| JP-066 | Fushimi Inari Taisha | Kioto | 2 | identity, experience | sí |
| JP-077 | Katsura Imperial Villa | Kioto | 1 | identity | sí |
| JP-089 | Nijō Castle | Kioto | 2 | identity, detail | no |
| JP-096 | Sanjūsangen-dō | Kioto | 2 | identity, experience | sí |
| JP-097 | Nintendo Museum | Kioto | 1 | identity | sí |
| JP-125 | Universal Studios Japan | Osaka | 2 | identity, experience | sí |
| JP-126 | SUPER NINTENDO WORLD | Osaka | 1 | identity | sí |
| JP-129 | Tōdai-ji | Osaka | 3 | identity, experience, detail | no |
| JP-134 | Hōryū-ji | Osaka | 1 | identity | sí |
| JP-135 | Himeji Castle | Osaka | 2 | identity, experience | sí |
| JP-142 | Kinosaki Onsen | Osaka | 2 | identity, experience | sí |
| JP-143 | Koyasan temple stay | Osaka | 2 | identity, experience | sí |
| JP-144 | Okunoin Cemetery | Osaka | 2 | identity, experience | sí |
| JP-145 | Kumano Nachi Taisha + Nachi Falls | Osaka | 2 | identity, experience | sí |
| JP-152 | Naoshima art island | Osaka | 2 | identity, context | no |
| JP-157 | Shurijo Castle Park | Okinawa | 2 | identity, experience | sí |
| JP-162 | Sefa Utaki | Okinawa | 2 | identity, experience | sí |
| JP-173 | Okinawa Churaumi Aquarium | Okinawa | 2 | identity, experience | sí |
| JP-179 | Yambaru National Park | Okinawa | 1 | identity | sí |
| JP-184 | Zamami Island | Okinawa | 2 | identity, experience | sí |
| JP-188 | Yonaha Maehama Beach | Okinawa | 1 | identity | sí |
| JP-192 | Kabira Bay | Okinawa | 1 | identity | sí |
| JP-196 | Taketomi Island village | Okinawa | 2 | identity, experience | sí |
| JP-197 | Iriomote mangrove and jungle expedition | Okinawa | 1 | identity | sí |
| JP-203 | Tokyo Disneyland | Tokio | 1 | identity | sí |
| JP-204 | Tokyo DisneySea | Tokio | 1 | identity | sí |
| JP-205 | Sapporo Snow Festival | Sapporo | 2 | identity, experience | sí |

La cobertura complementaria previa ya estaba en JP-021 (context), JP-089 (detail), JP-129 (detail) y JP-152 (context): **4/32**. Los objetivos derivan por ausencia de `detail`, `context` y `seasonal` en el estado inicial; son **28**, agrupados en cuatro batches de targets de 8, 8, 8 y 4.

### Targets B6.5 derivados y resultado

| ID | Lugar | Roles iniciales | Resultado |
|---|---|---|---|
| JP-025 | Akihabara Electric Town | identity, experience | UNRESOLVED — NO COMPLEMENTARY IMAGE |
| JP-033 | teamLab Borderless | identity | UNRESOLVED — COPYRIGHTED SUBJECT |
| JP-044 | Ghibli Museum, Mitaka | identity | UNRESOLVED — COPYRIGHTED SUBJECT |
| JP-054 | Kiyomizu-dera | identity, experience | `seasonal` adquirida |
| JP-066 | Fushimi Inari Taisha | identity, experience | `context` adquirida |
| JP-077 | Katsura Imperial Villa | identity | UNRESOLVED — NO COMPLEMENTARY IMAGE |
| JP-096 | Sanjūsangen-dō | identity, experience | `detail` adquirida |
| JP-097 | Nintendo Museum | identity | UNRESOLVED — COPYRIGHTED SUBJECT |
| JP-125 | Universal Studios Japan | identity, experience | UNRESOLVED — COPYRIGHTED SUBJECT |
| JP-126 | SUPER NINTENDO WORLD | identity | UNRESOLVED — COPYRIGHTED SUBJECT |
| JP-134 | Hōryū-ji | identity | UNRESOLVED — LICENSE |
| JP-135 | Himeji Castle | identity, experience | `detail` adquirida |
| JP-142 | Kinosaki Onsen | identity, experience | `detail` adquirida |
| JP-143 | Koyasan temple stay | identity, experience | `detail` adquirida |
| JP-144 | Okunoin Cemetery | identity, experience | UNRESOLVED — NO COMPLEMENTARY IMAGE |
| JP-145 | Kumano Nachi Taisha + Nachi Falls | identity, experience | UNRESOLVED — NO COMPLEMENTARY IMAGE |
| JP-157 | Shurijo Castle Park | identity, experience | UNRESOLVED — LOCATION UNVERIFIABLE |
| JP-162 | Sefa Utaki | identity, experience | `context` adquirida |
| JP-173 | Okinawa Churaumi Aquarium | identity, experience | `detail` adquirida |
| JP-179 | Yambaru National Park | identity | UNRESOLVED — RESOLUTION |
| JP-184 | Zamami Island | identity, experience | UNRESOLVED — NO COMPLEMENTARY IMAGE |
| JP-188 | Yonaha Maehama Beach | identity | UNRESOLVED — NO COMPLEMENTARY IMAGE |
| JP-192 | Kabira Bay | identity | UNRESOLVED — NO COMPLEMENTARY IMAGE |
| JP-196 | Taketomi Island village | identity, experience | `detail` adquirida |
| JP-197 | Iriomote mangrove and jungle expedition | identity | `context` adquirida |
| JP-203 | Tokyo Disneyland | identity | UNRESOLVED — COPYRIGHTED SUBJECT |
| JP-204 | Tokyo DisneySea | identity | UNRESOLVED — COPYRIGHTED SUBJECT |
| JP-205 | Sapporo Snow Festival | identity, experience | UNRESOLVED — NO COMPLEMENTARY IMAGE |

Total: **28 targets; 10 adquiridos; 18 unresolved**. Sólo se añadió una imagen a cada adquisición. Los roles añadidos fueron detail=6, context=3, seasonal=1; no se añadieron identity, experience, ni imágenes a lugares fuera de Grado S.

## Adquisiciones, selección editorial y comparación

Resolución de origen = dimensiones verificadas en la página/fuente original; resolución local = archivo WebP procesado del pipeline. Los bytes listados son archivo local, `-800w` y `-400w`. No hubo upscale artificial. Cada enlace de Commons lleva a la página original usada para autor, licencia y dimensiones.

### JP-054 — Kiyomizu-dera: `seasonal`

- Archivo: `File:Kiyomizu-dera sakura light-up (51472868886).jpg` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:Kiyomizu-dera_sakura_light-up_(51472868886).jpg>)
- Autor/crédito: Raita Futo from Tokyo, Japan · licencia: **CC BY 2.0** · resolución origen: 5898×3932 · WebP local: 1600×1067.
- Bytes: original local 168,026 B · 800w 37,148 B · 400w 11,960 B · LQIP en metadata.
- Por qué `seasonal`: La escena de noche y la floración de marzo aportan una dimensión primaveral distinta a la identity otoñal diurna y a la foto de visitantes en Otowa. La floración es visible detrás del salón y la estructura iluminada cambia materialmente la lectura del templo.
- Comparación visual con todas las fotos previas: Comparada con las dos imágenes actuales: no repite el escenario frontal otoñal ni la vista de visitantes en la fuente; introduce sakura visible y el recinto iluminado de noche.
  - Rechazado: [File:Kiyomizu-dera sakura light-up (51473113188).jpg](<https://commons.wikimedia.org/wiki/File:Kiyomizu-dera_sakura_light-up_(51473113188).jpg>) — La comparación visual muestra principalmente calle y edificios oscuros; no deja leer la floración estacional.
  - Rechazado: [Kiyomizu-dera, Kyoto, November 2016 -01.jpg](<https://commons.wikimedia.org/wiki/File:Kiyomizu-dera,_Kyoto,_November_2016_-01.jpg>) — Es la identity actual: escenario diurno con follaje otoñal; repetirla o variar el encuadre no añadiría información.

### JP-066 — Fushimi Inari Taisha: `context`

- Archivo: `File:View of Kyoto from Mount Inari.jpg` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:View_of_Kyoto_from_Mount_Inari.jpg>)
- Autor/crédito: Christophe95 · licencia: **CC BY-SA 4.0** · resolución origen: 4032×3024 · WebP local: 1600×1200.
- Bytes: original local 281,114 B · 800w 52,092 B · 400w 12,602 B · LQIP en metadata.
- Por qué `context`: La vista desde Yotsutsuji sitúa el santuario en la ladera y muestra la ciudad que lo rodea, un contexto geográfico ausente en el túnel de torii y en la arquitectura del santuario con visitantes.
- Comparación visual con todas las fotos previas: Las fotos existentes son un corredor de torii y los edificios del santuario. La candidata cambia a una vista elevada de Kyoto desde un punto verificable del monte Inari; no es otra fachada ni otra experiencia de recorrido.
  - Rechazado: [Fushimi Inari Taisha tunnel droit.jpg](<https://commons.wikimedia.org/wiki/File:Fushimi_Inari_Taisha_tunnel_droit.jpg>) — Mismo corredor de torii que la identity actual.
  - Rechazado: [Fushimi Inari Taisha shrine visitors](<https://commons.wikimedia.org/wiki/Category:Fushimi_Inari-taisha>) — Las vistas bajas del santuario repiten los edificios y la escala de visitantes ya cubierta por experience.

### JP-096 — Sanjūsangen-dō: `detail`

- Archivo: `File:Kyoto Sanjusangen-do Haupthalle Inen Buddhastatuen 1.jpg` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:Kyoto_Sanjusangen-do_Haupthalle_Inen_Buddhastatuen_1.jpg>)
- Autor/crédito: Zairon · licencia: **CC BY-SA 4.0** · resolución origen: 4378×3069 · WebP local: 1600×1122.
- Bytes: original local 285,022 B · 800w 77,036 B · 400w 30,912 B · LQIP en metadata.
- Por qué `detail`: Las filas de estatuas Kannon son el elemento distintivo que explica por qué el salón de 120 metros es conocido; esa colección no aparece en la fachada identity ni en la escena exterior con visitantes.
- Comparación visual con todas las fotos previas: El candidato es una vista interior centrada en la colección histórica de estatuas; las imágenes existentes muestran el edificio exterior y su puerta con visitantes. No repite arquitectura exterior ni la escena de visita.
  - Rechazado: [Sanjusangendo-building-dec2013.jpg](<https://commons.wikimedia.org/wiki/File:Sanjusangendo-building-dec2013.jpg>) — Es la identity exterior vigente.
  - Rechazado: [A couple looking at the gates (52370163970).jpg](<https://commons.wikimedia.org/wiki/File:A_couple_looking_at_the_gates_(52370163970).jpg>) — Es la experience exterior con visitantes ya registrada; no añade detalle interior.

### JP-135 — Himeji Castle: `detail`

- Archivo: `File:Himeji Castle Interior.jpg` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:Himeji_Castle_Interior.jpg>)
- Autor/crédito: ScribblingGeek · licencia: **CC BY-SA 4.0** · resolución origen: 5191×3461 · WebP local: 1600×1067.
- Bytes: original local 231,702 B · 800w 40,938 B · 400w 15,776 B · LQIP en metadata.
- Por qué `detail`: La estructura interior de madera, los niveles y el paso por el tenshu explican el recorrido y la construcción del castillo, dimensión que no aparece en la identity exterior ni en la aproximación con visitantes.
- Comparación visual con todas las fotos previas: Frente al keep exterior y el camino de llegada, esta foto entra en el corredor interior del Ro-no-watari-yagura; cambia el sujeto y la escala. No hay una obra contemporánea dominante en el encuadre.
  - Rechazado: [20260429 Burg Himeji 01, Hyōgo, Japan anagoria.jpg](<https://commons.wikimedia.org/wiki/File:20260429_Burg_Himeji_01,_Hyōgo,_Japan_anagoria.jpg>) — Otra vista exterior muy cercana a la identity.
  - Rechazado: [Throngs of people walking towards Himeji Castle, Himeji, 2016.jpg](<https://commons.wikimedia.org/wiki/File:Throngs_of_people_walking_towards_Himeji_Castle,_Himeji,_2016.jpg>) — Escena de aproximación con visitantes que ya cubre experience.

### JP-142 — Kinosaki Onsen: `detail`

- Archivo: `File:Kinosaki-Onsen Gosho-no-yu.jpg` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:Kinosaki-Onsen_Gosho-no-yu.jpg>)
- Autor/crédito: MaedaAkihiko · licencia: **CC0** · resolución origen: 5471×3647 · WebP local: 1600×1067.
- Bytes: original local 423,646 B · 800w 79,708 B · 400w 24,538 B · LQIP en metadata.
- Por qué `detail`: Identifica un baño público concreto del circuito de Kinosaki y muestra su arquitectura; la identity es el canal invernal y experience el paseo de yukata. Aclara qué significa recorrer una ciudad termal más allá de su canal.
- Comparación visual con todas las fotos previas: No repite el canal nevado ni la calle peatonal con personas en yukata: centra un establecimiento de baños termales distinto y verificable dentro de Kinosaki.
  - Rechazado: [Kinosaki Onsen Otani River 2026-02 ac (1).jpg](<https://commons.wikimedia.org/wiki/File:Kinosaki_Onsen_Otani_River_2026-02_ac_(1).jpg>) — Identity actual: canal y fachadas nevadas.
  - Rechazado: [Kinosaki Aruki.jpg](<https://commons.wikimedia.org/wiki/File:Kinosaki_Aruki.jpg>) — Experience actual: calle comercial y paseo en yukata; el nuevo detalle debía explicar el baño termal.

### JP-143 — Koyasan temple stay: `detail`

- Archivo: `File:Breakfast at a buddhist temple by Flowizm in Koyasan.jpg` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:Breakfast_at_a_buddhist_temple_by_Flowizm_in_Koyasan.jpg>)
- Autor/crédito: Flowizm from Koyasan, Wakayama · licencia: **CC BY 2.0** · resolución origen: 2816×2112 · WebP local: 1600×1200.
- Bytes: original local 243,300 B · 800w 48,050 B · 400w 14,736 B · LQIP en metadata.
- Por qué `detail`: La comida vegetariana del shukubō es una dimensión concreta de una estancia en un templo; no se ve en la fachada identity ni en la habitación con huésped de experience.
- Comparación visual con todas las fotos previas: La toma se centra en la bandeja de desayuno y el servicio de comida, no vuelve a mostrar fachada, jardín ni tatami/huésped de la experience. El archivo identifica el alojamiento Shōjōshin-in en Koyasan.
  - Rechazado: [Temple lodging at Shojoshin-in on Koyasan (3810898436).jpg](<https://commons.wikimedia.org/wiki/File:Temple_lodging_at_Shojoshin-in_on_Koyasan_(3810898436).jpg>) — Experience actual: habitación y huésped dentro del alojamiento.
  - Rechazado: [Ren'ge-in (Wakayama Koyasan) Temple hdsr S5 04.jpg](<https://commons.wikimedia.org/wiki/File:Ren%27ge-in_(Wakayama_Koyasan)_Temple_hdsr_S5_04.jpg>) — Identity actual: fachada y jardín del hospedaje.

### JP-162 — Sefa Utaki: `context`

- Archivo: `File:Kudakajima Island from Ujoguchi of Sefa-Utaki.JPG` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:Kudakajima_Island_from_Ujoguchi_of_Sefa-Utaki.JPG>)
- Autor/crédito: そらみみ (Soramimi) · licencia: **CC BY-SA 4.0** · resolución origen: 3264×2448 · WebP local: 1600×1200.
- Bytes: original local 243,704 B · 800w 49,828 B · 400w 12,684 B · LQIP en metadata.
- Por qué `context`: La isla sagrada de Kudaka aparece en el horizonte desde Ujoguchi y aporta la relación entre el sitio de culto y su entorno marino. No es una panorámica genérica: el original identifica la vista y tiene coordenadas en Sefa-Utaki.
- Comparación visual con todas las fotos previas: La identity es una formación rocosa/cueva de Yuinchi y experience el tramo de escaleras; la candidata es un punto de vista exterior hacia Kudaka desde otra entrada, con sujeto y sentido geográfico distintos.
  - Rechazado: [Okinawa Nanjo Sefa-utaki Gusuku site Yuinchi 04.jpg](<https://commons.wikimedia.org/wiki/File:Okinawa_Nanjo_Sefa-utaki_Gusuku_site_Yuinchi_04.jpg>) — Identity actual: roca de Yuinchi; no enseña la relación con Kudaka desde Ujoguchi.
  - Rechazado: [Stairs near Ujoguchi of Sefa-Utaki.JPG](<https://commons.wikimedia.org/wiki/File:Stairs_near_Ujoguchi_of_Sefa-Utaki.JPG>) — Experience actual: escaleras y recorrido interior, dimensión que no se debe repetir como context.

### JP-173 — Okinawa Churaumi Aquarium: `detail`

- Archivo: `File:Corals in Okinawa Churaumi Aquarium 4.jpg` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:Corals_in_Okinawa_Churaumi_Aquarium_4.jpg>)
- Autor/crédito: そらみみ · licencia: **CC BY-SA 4.0** · resolución origen: 2448×3264 · WebP local: 1200×1600.
- Bytes: original local 227,958 B · 800w 86,616 B · 400w 36,410 B · LQIP en metadata.
- Por qué `detail`: Muestra un tanque/exhibición de coral distinta del gran Kuroshio con tiburón ballena y de la escena del buzo; informa que la visita incluye vida arrecifal además del tanque icónico.
- Comparación visual con todas las fotos previas: Las dos fotos vigentes comparten el tanque principal y el trabajo del buzo en él. La candidata es un coral identificado dentro del acuario y cambia sujeto, escala y tanque.
  - Rechazado: [Main tank of the Kuroshio Sea in Okinawa Churaumi Aquarium.JPG](<https://commons.wikimedia.org/wiki/File:Main_tank_of_the_Kuroshio_Sea_in_Okinawa_Churaumi_Aquarium.JPG>) — Identity actual: tanque principal con tiburón ballena.
  - Rechazado: [USMC-081220-M-0902C-004.jpg](<https://commons.wikimedia.org/wiki/File:USMC-081220-M-0902C-004.jpg>) — Experience actual: visitantes y buzo frente al mismo tanque principal.

### JP-196 — Taketomi Island village: `detail`

- Archivo: `File:Stone wall Taketomi Island.jpg` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:Stone_wall_Taketomi_Island.jpg>)
- Autor/crédito: KQuhen · licencia: **CC BY-SA 4.0** · resolución origen: 4608×3456 · WebP local: 1600×1200.
- Bytes: original local 458,348 B · 800w 102,164 B · 400w 33,062 B · LQIP en metadata.
- Por qué `detail`: El muro de piedra volcánica permite leer un elemento concreto de la construcción tradicional de Taketomi, distinto de la vivienda identity y del carro de búfalo de experience.
- Comparación visual con todas las fotos previas: La candidata centra el límite de piedra y vegetación con resolución amplia; las imágenes existentes centran una casa tradicional y el recorrido en carro. No vuelve a representar el carro ni otra vivienda completa.
  - Rechazado: [Walk in Taketomi Island 17.jpg](<https://commons.wikimedia.org/wiki/File:Walk_in_Taketomi_Island_17.jpg>) — Identity actual: casa y calle de la aldea.
  - Rechazado: [水牛車.jpg](<https://commons.wikimedia.org/wiki/File:%E6%B0%B4%E7%89%9B%E8%BB%8A.jpg>) — Experience actual: carro de búfalo y visitantes, no detalle arquitectónico.

### JP-197 — Iriomote mangrove and jungle expedition: `context`

- Archivo: `File:Iriomote pinaisara fall.jpg` · [página original de Commons](<https://commons.wikimedia.org/wiki/File:Iriomote_pinaisara_fall.jpg>)
- Autor/crédito: Paipateroma · licencia: **CC BY-SA 4.0** · resolución origen: 1600×1200 · WebP local: 1280×960.
- Bytes: original local 192,902 B · 800w 49,692 B · 400w 10,010 B · LQIP en metadata.
- Por qué `context`: La cascada Pinai-saara amplía el contexto del paisaje de río/manglar a una formación fluvial concreta de Iriomote que ayuda a entender el componente de jungla de la excursión.
- Comparación visual con todas las fotos previas: La identity vigente mira el estuario y manglar del río Nakama desde una perspectiva elevada. La candidata es una cascada interior identificada por fuente y categoría exactas en Iriomote; no repite el estuario ni el manglar.
  - Rechazado: [Nakama River Iriomote Okinawa Japan05s3.jpg](<https://commons.wikimedia.org/wiki/File:Nakama_River_Iriomote_Okinawa_Japan05s3.jpg>) — Identity actual: paisaje del río y manglar.
  - Rechazado: [Iriomote mangroves (52117082031).jpg](<https://commons.wikimedia.org/wiki/File:Iriomote_mangroves_(52117082031).jpg>) — Otra vista elevada y vacía del manglar, redundante con identity.

## Unresolved y candidatos rechazados

En todos los unresolved se consultaron varias fuentes, incluida una fuente fotográfica de descubrimiento; se preserva la decisión porque no apareció una imagen a la vez útil, licenciable, legal y verificable bajo el pipeline actual. Se listan las fuentes y candidatos comparados.

### JP-025 — UNRESOLVED — NO COMPLEMENTARY IMAGE

Las opciones licenciadas localizadas son más calles, cruces y señalética de Akihabara. Identity y experience ya muestran las dos dimensiones visuales centrales del distrito; una tercera vista urbana seguiría contando lo mismo.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Akihabara>) · [fuente](<https://www.flickr.com/search/?text=Akihabara%20street%20night>) · [fuente](<https://commons.wikimedia.org/wiki/File:Akhibara_Crossing_(14663984721).jpg>)
  - Rechazado: [Akihabara Main Street with Onari-kaidō Overpass at night](<https://commons.wikimedia.org/wiki/Category:Akihabara>) — Otra calle nocturna del distrito, casi el mismo sujeto que identity y experience.
  - Rechazado: [Akihabara Electric Town 06.jpg](<https://commons.wikimedia.org/wiki/File:Akihabara_Electric_Town_06.jpg>) — Identity actual: edificios y señalética del distrito.

### JP-033 — UNRESOLVED — COPYRIGHTED SUBJECT

Los candidatos de la sede Azabudai Hills que aportan otra dimensión interior están dominados por instalaciones contemporáneas de teamLab. La licencia del fotógrafo no despeja los derechos de esas obras; los exteriores licenciados repetirían el edificio sin explicar la visita.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/File:TeamLab_Borderless_Azabudai_Hills.jpg>) · [fuente](<https://commons.wikimedia.org/wiki/Category:teamLab_Borderless>) · [fuente](<https://www.teamlab.art/e/borderless-azabudai/>)
  - Rechazado: [TeamLab Borderless Azabudai Hills.jpg](<https://commons.wikimedia.org/wiki/File:TeamLab_Borderless_Azabudai_Hills.jpg>) — Instalación inmersiva contemporánea como sujeto central; derechos de la obra no aclarados.
  - Rechazado: [TeamLab Borderless, Odaiba, Tokyo, Japan (49070113608).jpg](<https://commons.wikimedia.org/wiki/File:TeamLab_Borderless,_Odaiba,_Tokyo,_Japan_(49070113608).jpg>) — Sede anterior de Odaiba y obra artística contemporánea; no representa la ubicación actual ni resuelve copyright.

### JP-044 — UNRESOLVED — COPYRIGHTED SUBJECT

Las imágenes interiores no se pueden fotografiar según las normas del museo y las tomas de visita abiertas encontradas dependen de personajes o diseños de Studio Ghibli. La licencia del fotógrafo no resuelve esos derechos; los exteriores disponibles repiten la identity.
- Fuentes revisadas: [fuente](<https://www.ghibli-museum.jp/en/>) · [fuente](<https://commons.wikimedia.org/wiki/Category:Ghibli_Museum>) · [fuente](<https://www.flickr.com/search/?text=Ghibli%20Museum%20Mitaka>)
  - Rechazado: [Ghibli Museum Exterior Entrance Totoro Ticket Booth, Inokishira Park](<https://www.flickr.com/photos/joshuamellin/53491817733/>) — Totoro/taquilla con personaje ocupa la escena y conserva derechos contemporáneos no despejados.
  - Rechazado: [Ghibli Museum 06.jpg](<https://commons.wikimedia.org/wiki/File:Ghibli_Museum_06.jpg>) — Exterior del edificio vacío, casi frontal y redundante con la identity.

### JP-077 — UNRESOLVED — NO COMPLEMENTARY IMAGE

Las imágenes licenciadas de casas de té y recorridos que localicé son diapositivas de archivo subexpuestas; la escena de habitación revisada no permite distinguir detalles útiles a tamaño de galería. Los jardines vacíos repiten el paisaje de la identity.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Katsura_Imperial_Villa>) · [fuente](<https://dp.la/search?q=Katsura%20Imperial%20Villa>) · [fuente](<https://www.flickr.com/search/?text=Katsura%20Imperial%20Villa>)
  - Rechazado: [(Teahouse interior view in Katsura Imperial Villa, Japan) - DPLA](<https://commons.wikimedia.org/wiki/File:(Teahouse_interior_view_in_Katsura_Imperial_Villa,_Japan)_-_DPLA_-_5b2151951efa5b557747380894b5a813.jpg>) — CC BY 4.0 y lugar comprobable, pero la diapositiva de 1963 está muy subexpuesta y no hace legible el detalle interior.
  - Rechazado: [Katsura Imperial Villa garden path (DPLA/Commons scan)](<https://commons.wikimedia.org/wiki/Category:Katsura_Imperial_Villa>) — Archivo oscuro de jardín vacío, sin información distinta de la identity.

### JP-097 — UNRESOLVED — COPYRIGHTED SUBJECT

La fachada legalmente licenciada es la identity vigente. Las imágenes interiores de consolas, juegos y personajes muestran obras contemporáneas de Nintendo; el crédito CC del fotógrafo no autoriza por sí solo esos sujetos.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/File:Nintendo_Museum_Entrance.jpg>) · [fuente](<https://museum.nintendo.com/en/>) · [fuente](<https://www.flickr.com/search/?text=Nintendo%20Museum%20Uji>)
  - Rechazado: [Nintendo Museum Entrance.jpg](<https://commons.wikimedia.org/wiki/File:Nintendo_Museum_Entrance.jpg>) — Exterior vacío que repite la identity actual.
  - Rechazado: [A visitor plays a game at the Nintendo Museum during a press preview in Uji](<https://www.reutersconnect.com/item/a-visitor-plays-a-game-at-the-nintendo-museum-during-a-press-preview-in-uji/dGFnOnJldXRlcnMuY29tLDIwMjQ6bmV3c21sX1JDMkc3QUEzN0VHSQ>) — Licencia comercial de Reuters y juego Nintendo como sujeto contemporáneo.

### JP-125 — UNRESOLVED — COPYRIGHTED SUBJECT

La experiencia licenciada actual muestra Hogwarts; otras escenas de actividad dependen de decorados, marcas y obras contemporáneas de Universal. Las tomas de entrada licenciadas repetirían la identity y el fotógrafo no resuelve por sí solo los derechos de los sujetos del parque.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/File:Hogwarts_in_Universal_Studios_Japan.jpg>) · [fuente](<https://www.usj.co.jp/web/en/us/park-guide/>) · [fuente](<https://commons.wikimedia.org/wiki/Category:Universal_Studios_Japan>)
  - Rechazado: [Hogwarts in Universal Studios Japan.jpg](<https://commons.wikimedia.org/wiki/File:Hogwarts_in_Universal_Studios_Japan.jpg>) — Experience actual: decorado contemporáneo de una franquicia cinematográfica.
  - Rechazado: [UNIVERSAL STUDIOS JAPAN ENTRANCE.jpg](<https://commons.wikimedia.org/wiki/File:UNIVERSAL_STUDIOS_JAPAN_ENTRANCE.jpg>) — Identity actual: entrada y branding, redundante con el activo actual.

### JP-126 — UNRESOLVED — COPYRIGHTED SUBJECT

Las vistas que podrían aportar un detalle/contexto muestran como sujeto central la escenografía y los elementos reconocibles de Super Mario/Nintendo. La licencia fotográfica no despeja los derechos de esas obras contemporáneas.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/File:Super_Nintendo_World_Entrance_5th_Anniversary_decoration_at_Universal_Studios_Japan.jpg>) · [fuente](<https://www.usj.co.jp/web/en/us/areas/super-nintendo-world/>) · [fuente](<https://commons.wikimedia.org/wiki/Category:Super_Nintendo_World>)
  - Rechazado: [Super Nintendo World Entrance 5th Anniversary decoration at Universal Studios Japan.jpg](<https://commons.wikimedia.org/wiki/File:Super_Nintendo_World_Entrance_5th_Anniversary_decoration_at_Universal_Studios_Japan.jpg>) — Identity actual: la decoración de Mario domina la foto y conserva derechos contemporáneos.
  - Rechazado: [USJ Super Nintendo World overview.jpg](<https://commons.wikimedia.org/wiki/File:USJ_Super_Nintendo_World_overview.jpg>) — Panorámica de la zona con obras y ambientación de Nintendo como sujeto principal.

### JP-134 — UNRESOLVED — LICENSE

Un detalle de Tamamushi-no-zushi sería útil y distinto de la arquitectura exterior, pero las páginas originales localizadas son reproducciones de publicaciones de archivo bajo PD-Japan-oldphoto/PD-1996 o una imagen sin licencia compatible explícita. La preparación existente no admite esas bases y no se fuerza el caso.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Tamamushi_Shrine>) · [fuente](<https://www.horyuji.or.jp/en/garan/kondo/>) · [fuente](<https://commons.wikimedia.org/wiki/Category:Hōryū-ji>)
  - Rechazado: [Tamamushi Shrine ColorPhoto.jpg](<https://commons.wikimedia.org/wiki/File:Tamamushi_Shrine_ColorPhoto.jpg>) — La reproducción procede de una revista de 1933 y está etiquetada PD-Japan-oldphoto/PD-1996, fuera de las bases de Public Domain aceptadas por este proyecto.
  - Rechazado: [Tamamushi Shrine (lower right).jpg](<https://commons.wikimedia.org/wiki/File:Tamamushi_Shrine_(lower_right).jpg>) — La fuente es una reproducción fiel de una obra bidimensional; el estatuto de la foto no se resuelve con CC0 del texto estructurado y la página no ofrece una licencia de fotografía compatible clara.

### JP-144 — UNRESOLVED — NO COMPLEMENTARY IMAGE

Las opciones libres encontradas son otra toma de lápidas/Jizō del cementerio, una vista nocturna del camino que repite experience o un close-up de gorintō sin una fotografía candidata clara que separe visualmente una pieza concreta de los memoriales ya visibles en identity.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Okunoin_Cemetery>) · [fuente](<https://www.flickr.com/search/?text=Okunoin%20Cemetery%20Koyasan%20gorinto>) · [fuente](<https://www.koyasan.or.jp/en/>)
  - Rechazado: [Gorintō at Okunoin's cemetery, Koyasan](<https://commons.wikimedia.org/wiki/Category:Okunoin_Cemetery>) — El archivo localizado se centra en otra estela funeraria; en la comparación a tamaño de galería se lee como otro memorial dentro del mismo grupo de identity, sin un rasgo separable suficientemente legible.
  - Rechazado: [Pathway through graveyard at Okunoin at Koyasan at night](<https://commons.wikimedia.org/wiki/Category:Okunoin_Cemetery>) — Camino nocturno del cementerio, la misma dimensión ya cubierta por experience.

### JP-145 — UNRESOLVED — NO COMPLEMENTARY IMAGE

Las rutas de peregrinación y senderos licenciados revisados se parecen a la senda de bosque ya usada como experience, mientras que las demás fotos vuelven a presentar la cascada y pagoda de la identity. No encontré un tercer detalle/contexto que agregue información distinta.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Nachi_Falls>) · [fuente](<https://www.flickr.com/search/?text=Nachi%20Falls%20pilgrimage%20route>) · [fuente](<https://www.kumano-travel.com/en/>)
  - Rechazado: [Nachi Falls Pilgrimage route (51928795062).jpg](<https://commons.wikimedia.org/wiki/File:Nachi_Falls_Pilgrimage_route_(51928795062).jpg>) — Sendero forestal que repite el recorrido boscoso ya visible en experience.
  - Rechazado: [Kumano Kodo World heritage Nachi-no-taki view](<https://commons.wikimedia.org/wiki/Category:Nachi_Falls>) — Repite el mismo par visual de cascada y pagoda de la identity.

### JP-179 — UNRESOLVED — RESOLUTION

El original tiene 1800×1200, pero Commons devolvió el original al pedir 1600px en vez de una miniatura reducida. Para respetar el contrato que evita descargar el original como sustituto, esta candidata no se adquiere ni se altera el pipeline.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/File:Okinawa_Rail_388492704.jpg>) · [fuente](<https://www.inaturalist.org/photos/388492704>) · [fuente](<https://commons.wikimedia.org/wiki/File:Subtropical_Forest_of_Yanbaru_National_Park_Okinawa_2018.jpg>)
  - Rechazado: [Okinawa Rail 388492704.jpg](<https://commons.wikimedia.org/wiki/File:Okinawa_Rail_388492704.jpg>) — La fuente y ubicación son adecuadas y CC BY 4.0, pero el endpoint de Commons no entregó el thumbnail reducido solicitado; se rechazó sin usar el original.
  - Rechazado: [Yambaru forest in Ryukyu Mura, Onna, Okinawa.jpg](<https://commons.wikimedia.org/wiki/File:Yambaru_forest_in_Ryukyu_Mura,_Onna,_Okinawa.jpg>) — El propio registro ubica la escena en el parque temático Ryukyu Mura, no en Yambaru National Park.

### JP-157 — UNRESOLVED — LOCATION UNVERIFIABLE

Las fotos con escenas del castillo principal anteriores al incendio de 2019 ya no representan el estado actual del recinto. La identity (Shureimon, foto 2023) y la experience vigente (visita guiada en el parque) son actuales; las vistas de reconstrucción/obras localizadas no aportan una tercera dimensión vigente verificable.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Shurijo_Castle>) · [fuente](<https://oki-park.jp/shurijo/en/>) · [fuente](<https://www.flickr.com/search/?text=Shurijo%20Castle%20Park%20garden>)
  - Rechazado: [Shuri Castle - Light up.JPG](<https://commons.wikimedia.org/wiki/File:Shuri_Castle_-_Light_up.JPG>) — Vista nocturna del salón principal destruido en el incendio; no representa el recinto actual.
  - Rechazado: [Ryutan and Shuri Castle 01.JPG](<https://commons.wikimedia.org/wiki/Category:Ryutan>) — El salón histórico aparece en una vista anterior al incendio y no se puede ofrecer como estado actual en la ventana de viaje.

### JP-184 — UNRESOLVED — NO COMPLEMENTARY IMAGE

Identity ya establece el paisaje costero y experience muestra uso de Furuzamami Beach. La opción que cambiaría materialmente el contexto de febrero–marzo sería una ballena jorobada en Zamami, pero no encontré fotografía con licencia compatible y ubicación original verificable; otras playas repiten mar, costa y visitantes.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Zamami_Island>) · [fuente](<https://www.flickr.com/search/?text=Zamami%20humpback%20whale>) · [fuente](<https://www.japan.travel/en/destinations/okinawa/okinawa/kerama-islands/>)
  - Rechazado: [Sea kayaking Zamami Okinawa.jpg](<https://commons.wikimedia.org/wiki/File:Sea_kayaking_Zamami_Okinawa.jpg>) — Original de 1280×854 sin una miniatura reducida servida por Commons conforme al pipeline; además duplica la dimensión de visita/playa ya cubierta.
  - Rechazado: [JAP Zamami Furuzamami Beach.jpg](<https://commons.wikimedia.org/wiki/File:JAP_Zamami_Furuzamami_Beach.jpg>) — Experience actual: playa y visitantes, misma dimensión que ya cubre la galería.

### JP-188 — UNRESOLVED — NO COMPLEMENTARY IMAGE

La identity actual ya contiene el agua turquesa, arena y pasarela de Yonaha Maehama. Los otros archivos licenciados de playa muestran la misma costa vacía; windsurfing sería otra experience y no se convierte en context/detail para forzar la tercera foto.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Yonaha_Maehama_Beach>) · [fuente](<https://www.flickr.com/search/?text=Yonaha%20Maehama%20Beach>) · [fuente](<https://www.japan.travel/en/spot/1776/>)
  - Rechazado: [KIMG0450windsurfing in maehama.jpg](<https://commons.wikimedia.org/wiki/File:KIMG0450windsurfing_in_maehama.jpg>) — Muestra windsurf; sería una segunda experience, prohibida en B6.5, no un detalle/contexto adicional.
  - Rechazado: [Yonaha Beach (51924567580).jpg](<https://commons.wikimedia.org/wiki/File:Yonaha_Beach_(51924567580).jpg>) — Repite la pasarela y el mismo tramo de costa vacío de la identity.

### JP-192 — UNRESOLVED — NO COMPLEMENTARY IMAGE

Las fotos libres de Kabira Bay encontradas vuelven a mostrar el agua y pequeños barcos; la escena de glass-bottom boat añadiría otra activity/experience, y el material oficial no declara una licencia compatible. No hay otro detalle/contexto que la galería actual no comunique ya.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Kabira_Bay>) · [fuente](<https://www.flickr.com/search/?text=Kabira%20Bay%20glass%20bottom%20boat>) · [fuente](<https://www.japan.travel/en/spot/375/>)
  - Rechazado: [Kabira Bay (52117120293).jpg](<https://commons.wikimedia.org/wiki/File:Kabira_Bay_(52117120293).jpg>) — Otra panorámica de la bahía con agua/isletas y embarcación distante, visualmente equivalente a identity.
  - Rechazado: [Glass bottom boats in tropical lagoon in Kabira bay](<https://www.flickr.com/photos/mytripsmypics/53198347426/>) — La fuente declara copyright reservado y la escena corresponde a otra experience, no un rol B6.5.

### JP-203 — UNRESOLVED — COPYRIGHTED SUBJECT

Las escenas de actividad de Tokyo Disneyland se centran en decorados, castillo, personajes y espectáculos de Disney. La licencia abierta del fotógrafo no resuelve los derechos de las obras contemporáneas; las entradas estáticas repiten la identity.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Tokyo_Disneyland>) · [fuente](<https://www.tokyodisneyresort.jp/en/tdl/>) · [fuente](<https://www.flickr.com/search/?text=Tokyo%20Disneyland%20parade>)
  - Rechazado: [Tokyo Disneyland Opening Year.jpg](<https://commons.wikimedia.org/wiki/File:Tokyo_Disneyland_Opening_Year.jpg>) — Visitantes ante el castillo icónico de Disney; derechos del sujeto contemporáneo sin resolver.
  - Rechazado: [Tokyo Disneyland Entrance (9409986068).jpg](<https://commons.wikimedia.org/wiki/File:Tokyo_Disneyland_Entrance_(9409986068).jpg>) — Entrada estática y branding, redundante con la identity.

### JP-204 — UNRESOLVED — COPYRIGHTED SUBJECT

Las opciones libres encontradas muestran el volcán temático, el puerto escenográfico y las góndolas del parque. Son instalaciones contemporáneas protegidas; la licencia del fotógrafo no aclara los derechos de esas obras, y los encuadres vuelven a cubrir la arquitectura de la identity.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Tokyo_DisneySea>) · [fuente](<https://www.tokyodisneyresort.jp/en/tds/>) · [fuente](<https://www.flickr.com/search/?text=Tokyo%20DisneySea%20harbor>)
  - Rechazado: [Tokyo Disney Sea (52853628038).jpg](<https://commons.wikimedia.org/wiki/File:Tokyo_Disney_Sea_(52853628038).jpg>) — Puerto y arquitectura temática dominan el cuadro; sujeto contemporáneo con derechos no resueltos.
  - Rechazado: [Tokyo DisneySea-Volcania.jpg](<https://commons.wikimedia.org/wiki/File:Tokyo_DisneySea-Volcania.jpg>) — Identity actual: volcán de fantasía del parque; no se usa otro ángulo como detail/context.

### JP-205 — UNRESOLVED — NO COMPLEMENTARY IMAGE

Identity ya muestra el festival invernal desde el parque y experience una escultura iluminada con público. Las opciones adicionales vuelven a mostrar esculturas de nieve/escenas del festival; aunque ilustran invierno, no aportan una tercera dimensión separable y algunas son obras contemporáneas de autoría no aclarada.
- Fuentes revisadas: [fuente](<https://commons.wikimedia.org/wiki/Category:Sapporo_Snow_Festival>) · [fuente](<https://www.snowfes.com/en/>) · [fuente](<https://www.flickr.com/search/?text=Sapporo%20Snow%20Festival%20night>)
  - Rechazado: [US Navy 060209-N-7526R-205 Illuminated trees and ice sculptures...](<https://commons.wikimedia.org/wiki/File:US_Navy_060209-N-7526R-205_Illuminated_trees_and_ice_sculptures_line_the_streets_leading_up_to_Sapporo%27s_TV_Tower_during_the_Sapporo_Ice_Festival.jpg>) — Noche y esculturas ya se ven en experience; vuelve a describir el mismo festival, y la escultura de concurso mantiene derechos del autor no identificados.
  - Rechazado: [Sapporo Snow Festival 2025 (8846080).jpg](<https://commons.wikimedia.org/wiki/File:Sapporo_Snow_Festival_2025_(8846080).jpg>) — Otra escultura de nieve del mismo festival; no agrega estación, ubicación o elemento distinto de identity/experience.

Categorías: 7 UNRESOLVED — COPYRIGHTED SUBJECT, 1 UNRESOLVED — LICENSE, 1 UNRESOLVED — LOCATION UNVERIFIABLE, 8 UNRESOLVED — NO COMPLEMENTARY IMAGE, 1 UNRESOLVED — RESOLUTION.

## Resultado y contratos preservados

- Complementary coverage de Grado S (`detail`/`context`/`seasonal`): **4/32 → 14/32**. Las 10 adquiridas elevan la cobertura en 10; las 18 no se fuerzan.
- Registry: **215 → 225 imágenes** (+10); lugares con fotografía: **194 → 194** (permanece en 194). Bytes de los 10 originales locales: 2,755,722 B; las listas siguen cargando únicamente el derivado 800w de identity.
- identity S: **32/32**, sin reemplazos. experience S: **17/32**, exactamente igual. Las 15 excepciones B6.4 siguen documentadas y sin nuevos `experience`.
- Grado A permanece **139/147 + 8 excepciones** y Grado B **23/25 + 2 excepciones**; no hubo adquisiciones A/B ni cambios en su cobertura.
- Máximo de tres fotos por lugar; targets adquiridos reciben como máximo una complementaria. Orden de galería verificado: identity → experience → complementaria; cuando no hay experience, identity → complementaria. No hay identity nueva o reemplazada.
- Metadata canónica/app sincronizada byte por byte. Licencias admitidas por el validador (PD/PD-self, CC0, CC BY, CC BY-SA); cero imágenes con autor/licencia inventados. Bytes duplicados: cero. Cada nueva imagen tiene original procesado, 800w, 400w y LQIP. Las pruebas de contrato y `--check` pasan para los 225 registros.
- SHA-256 de `app/src/data/place-images.ts`: `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb` antes y después; sin edición manual.

### Presupuesto completo de identity 800w por hub

| Hub | Total identity 800w | Phone observado | Desktop observado | Gate ≤3,500,000 B |
|---|---:|---:|---:|---|
| Tokio | 3,421,914 B | 1,691,922 B | 1,780,442 B | PASS |
| Kioto | 3,408,406 B | 3,159,424 B | 2,386,088 B | PASS |
| Osaka | 3,170,658 B | 3,129,520 B | 3,129,520 B | PASS |
| Okinawa | 2,866,922 B | 2,788,756 B | 2,788,756 B | PASS |
| Sapporo | 166,986 B | 166,986 B | 166,986 B | PASS |
| Nagoya | 69,552 B | 69,552 B | 69,552 B | PASS |
| Fukuoka | 69,284 B | 69,284 B | 69,284 B | PASS |

El audit recorre las listas y confirma que no descargan assets detail/context/seasonal, sólo fotos identity locales 800w; por tanto B6.5 añade **0 B** al coste de las listas. Los observados dependen del lazy loading/scroll del muestreo; la columna identity es la suma completa del hub.

### Coste en ficha

| Lugar | Viewports | Identity | Experience | Complementaria | Resto | Total galería |
|---|---|---:|---:|---:|---:|---:|
| JP-054 (Kioto) | phone y desktop | 67,272 B | 108,838 B | 37,148 B | 37,148 B | 213,258 B |
| JP-066 (Kioto) | phone y desktop | 45,052 B | 66,372 B | 52,092 B | 52,092 B | 163,516 B |
| JP-096 (Kioto) | phone y desktop | 40,242 B | 67,862 B | 77,036 B | 77,036 B | 185,140 B |
| JP-142 (Osaka) | phone y desktop | 70,456 B | 68,122 B | 79,708 B | 79,708 B | 218,286 B |
| JP-197 (Okinawa) | phone y desktop | 87,410 B | 0 B | 49,692 B | 49,692 B | 137,102 B |

JP-054, JP-066, JP-096 y JP-142 se probaron como fichas de tres fotos; JP-197 añade context pero conserva sin resolver su excepción experience, por lo que presenta identity + complementaria. Los bytes coinciden en ambos viewports. “Resto” corresponde a las complementarias después de separar identity/experience.

## Verificación

- `scripts/validate-photography.py`: PASS.
- `scripts/test_photography.py`: 40/40; `scripts/test_photography_rendition.py`: 28/28; `scripts/test_block22_photography.py`: 8/8.
- B6.2 11/11; B6.3 8/8; B6.4 9/9; B6.5 7/7. B6.4 se ajustó para reconstruir su línea base histórica excluyendo únicamente los títulos añadidos luego por B6.5.
- `scripts/build-photography-derivatives.py --check --quiet`: PASS en 225 registros; 400w total 4.49 MiB y 800w 14.41 MiB.
- `app`: `npm run build` PASS; `npm run lint` exit 0 con el warning heredado `PlaceMap.tsx:14` (sin cambios en ese archivo); `npx vitest run`: **100 archivos, 3328/3328**.
- Browser audit `app/scripts/block22-b6-5-photography-browser-audit.mjs`: **416/416, 0 fallos**. Móvil 390×844 y escritorio 1440×900; hubs Tokio/Kioto/Osaka/Okinawa/Sapporo/Nagoya/Fukuoka; roles seasonal/context/detail; ficha de 3 fotos; JP-197 como excepción experience con nueva complementaria. Verifica identidad en PlaceCard, contador 3 fotos, carga diferida/no complementarias en listas, contador y puntos 1/3→2/3→3/3, scroll-snap, teclado, créditos, focus, fallback, responsive, imágenes rotas y fetch externo.
- El audit comprobó todas las galerías muestreadas en ambos viewports; cero fotos rotas y cero fetch fotográfico externo. `PlaceCard` conserva identity y el contador visible “3 fotos”.

## Límites del bloque

- No se tocó `main` (sigue en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`), no se creó PR ni se hizo merge.
- `scripts/acquire-photography.py` y el pipeline de derivados no se modificaron; `place-images.ts` no se editó manualmente.
- Cero uso de Astra; cero rediseño de UI; ningún bloque posterior iniciado. B6.5 queda implementado y certificado, pendiente de integración.
- Siguiente bloque sólo después de integrar B6.5: identities de lugares Grado C/D que siguen sin fotografía. No iniciado.
