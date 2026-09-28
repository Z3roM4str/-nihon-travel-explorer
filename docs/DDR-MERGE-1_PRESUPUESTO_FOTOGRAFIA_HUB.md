# DDR-MERGE-1 — Presupuesto de fotografía del hub

**Estado:** CERRADA — opción 1 aplicada por decisión de dirección.
**Fecha de apertura:** 2026-09-26 · **Fecha de cierre:** 2026-09-26
**Rama:** `claude/integration-b24-b23-b65-b67` · **HEAD al abrir:** `fac2e9e` · **HEAD al cerrar:** ver §9
**Origen:** misión merge-readiness de PR #152, §2 (Block 2 Photography 79/81).

No existe DD-027 sobre este problema. La constante `< 5 MiB` no cambió. Ningún assert ni requisito
fotográfico se relajó, y no se optimizó ninguna imagen — el pipeline ya cumplía (§4). La corrección
fue exclusivamente de instrumentación: dónde empieza a contar el gate.

## 1. Presupuestos vigentes

| Fuente | Contrato | Unidad |
|---|---|---|
| `app/scripts/block2-photography-browser-audit.mjs` l. 132–135 | `totalMiB < 5` — «a full hub scroll stays well under the pre-Block-2 cost» | MiB (1 048 576 B) |
| `docs/design/06_ESTRATEGIA_FOTOGRAFICA.md` §6.3 | «recorrer una ciudad completa no debe superar 3,5 MB de imágenes» | MB |
| `scripts/build-photography-derivatives.py` `IDENTITY_HUB_BUDGET_BYTES` | 3 500 000 B de 800w *identity* por hub | B |
| `06 §6.1` | 800w = tarjeta de lista; 400w = miniaturas (PlaceCard compact, paradas, «Cerca de aquí»); original 1600 px = héroe/lightbox; WebP | — |

## 2. Qué mide realmente el gate

El gate registra toda respuesta `.webp` **desde `page.goto("/")`**, no desde el clic en el hub. Desde
B19/B24 la página inicial de Explorar (tarjetas de ciudad `explorer-home__city-image` con
`loading="eager"` + raíles editoriales de `PlaceCard` normal) descarga fotografías de otros hubs
antes de que el script pulse «Osaka». Esas bytes se suman al «full hub scroll».

Medición independiente de sólo la home (sin clic, 700 ms):

| Viewport | Imágenes home | Bytes home |
|---|---|---|
| phone 390×844 @2 | 27 | 1 734 308 |
| tablet 820×1180 @2 | 34 | 2 256 332 |
| desktop 1440×900 @1 | 40 | 2 738 238 |

## 3. Medidas reales por hub (ventana del gate, `fac2e9e`)

| Viewport | Total gate | Osaka (hub recorrido) | Tokio | Kioto | Okinawa | Resultado |
|---|---|---|---|---|---|---|
| phone | 76 img · 5 049 648 B · **4,82 MiB** | 50 · 3 356 478 B · 3,20 MiB | 21 · 1 400 014 | 4 · 214 990 | 1 · 78 166 | ✓ |
| tablet | 83 img · 5 571 672 B · **5,31 MiB** | 50 · 3 356 478 B · 3,20 MiB | 22 · 1 467 742 | 10 · 669 286 | 1 · 78 166 | ✗ |
| desktop | 89 img · 6 053 578 B · **5,77 MiB** | 50 · 3 356 478 B · 3,20 MiB | 24 · 1 686 622 | 14 · 932 312 | 1 · 78 166 | ✗ |

- **El recorrido completo del hub Osaka cuesta 3 356 478 B (3,20 MiB)** en los tres viewports: cumple
  el `< 5 MiB` del gate y el 3,5 MB de `06 §6.3`. Es exactamente la cifra que el pipeline reporta
  (`identity 800w Osaka: 3,356,478 B / 3,500,000 B cap (25 image(s) quality-adjusted)`).
- **Todo el exceso (≈ 0,31 MiB tablet, ≈ 0,77 MiB desktop) lo explican las imágenes de la home de
  Explorar**: 2 215 194 B = 2,11 MiB (tablet) y 2 697 100 B = 2,57 MiB (desktop) de Tokio/Kioto/Okinawa (phone: 1 693 170 B, 1,61 MiB, que aún cabe). Crece con el viewport
  porque en pantallas anchas entran más tarjetas de los raíles antes del clic.

## 4. Cumplimiento del pipeline

- `python3 scripts/build-photography-derivatives.py --check` → **OK: 244 registros verificados a
  400px y 800px, byte-idénticos** a lo que el pipeline produce hoy.
- Las 89 imágenes (desktop) son **derivados `-800w` WebP** de rol **identity**, 800 px de ancho
  (alto variable según proporción: 800×180 … 800×1200). **0 originales**, **0 duplicados** (misma URL
  descargada dos veces), **0 fallos**, **0 fotografías complementarias (role ≠ identity)**.
- Ninguna tarjeta usa el original en lugar del derivado. Ningún derivado supera el tope del
  pipeline: los mayores (171 478 B `nunobiki-falls`, 153 620 B `kasuga-taisha`, 143 466 B
  `adashino`) ya están en el suelo de calidad o forman parte de un hub ya rebalanceado al tope
  (Tokio 3 499 770 B, Kioto 3 499 450 B, Osaka 3 356 478 B de 3 500 000 B).
- **Conclusión: no hay miniaturas fuera de especificación en la ventana medida.** El CASO A no aplica.

### Hallazgo secundario (no explica el exceso; no corregido)

`PlaceCard variant="compact"` (72 px; usado en `SearchSheet` y en «Cerca de aquí» de `PlaceDetail`)
pide `-800w` aunque `06 §6.1` prescribe `-400w` para «PlaceCard compact». No aparece en la ventana de
Block 2. **No se corrige aquí** porque el gate congelado B6.5 (416/416) afirma explícitamente lo
contrario (`block22-b6-5-photography-browser-audit.mjs` l. 249: «PlaceCard compacto también usa
identity … -800w»); cambiarlo exige que dirección decida cuál de las dos normas prevalece.

## 5. Mínimo alcanzable sin degradar el estándar

- **Hub Osaka:** 3 356 478 B ya es el resultado del rebalanceo del pipeline; no hay margen sin bajar
  del estándar.
- **Home de Explorar:** todas sus imágenes son 800w identity de hubs ya en el tope por hub. Bajar de
  ahí exige bajar calidad por debajo del contrato, o cambiar qué/cuándo carga la home (diseño de
  B19/B24, congelado).
- Por tanto, con la ventana actual del gate el mínimo alcanzable sin degradar es el medido:
  **5,31 MiB (tablet) / 5,77 MiB (desktop)**, es decir **+0,31 MiB (+328 792 B) y +0,77 MiB
  (+810 698 B)** sobre 5 MiB.

## 6. Opciones

| # | Opción | Qué cambia | Consecuencias |
|---|---|---|---|
| 1 | **Acotar la ventana del gate al recorrido del hub** (vaciar el registro justo antes del clic en el hub; opcionalmente añadir un segundo check `≤ 3 500 000 B` con `06 §6.3`). Constante 5 MiB intacta. | Sólo el instrumento de medida. | Block 2 → 81/81 con 3,20 MiB. Mide lo que su nombre y `06 §6.3` dicen. El coste de la home deja de estar vigilado por este gate (conviene un check propio, opción 4). |
| 2 | **Redefinir el check como «home + hub»** con un presupuesto nuevo. | Constante/contrato. | Requiere cifrar un número nuevo (fuera de mi autoridad). Mezcla dos superficies con presupuestos distintos. |
| 3 | **Reducir la carga de la home** (tarjetas de ciudad `lazy`, menos tarjetas en raíles, 400w en raíles con `srcset`). | Producto/diseño B19/B24. | Pasaría el gate actual; toca superficies congeladas y la calidad percibida de la home. |
| 4 | Opción 1 **+ nuevo presupuesto propio de la home de Explorar** documentado aparte. | Instrumento + nueva norma. | Máxima trazabilidad; exige cifrar el presupuesto de home. |

Recomendación técnica: **opción 1** (o 4 si se quiere vigilar la home), porque el contrato fotográfico
vigente (`06 §6.3`, pipeline) se cumple y el fallo es de alcance del instrumento, no del catálogo.

## 7. Desglose completo por imagen

Atribución «Superficie» por hub del lugar: Osaka = recorrido del hub; resto = home de Explorar.
Todas: WebP, rol identity, pasadas por `build-photography-derivatives.py` (verificado con `--check`).

### tablet — 83 imágenes, 5,571,672 B (5.31 MiB)

| # | Bytes | Acum. MiB | Dim. | Fmt | Rol | Lugar | Hub | Superficie | Archivo |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 171,478 | 0.16 | 800×1067 | WEBP | identity | JP-139 | Osaka | hub Osaka | `nunobiki-falls-herb-gardens-800w.webp` |
| 2 | 153,620 | 0.31 | 800×1200 | WEBP | identity | JP-131 | Osaka | hub Osaka | `kasuga-taisha-lanterns-800w.webp` |
| 3 | 143,466 | 0.45 | 800×608 | WEBP | identity | JP-076 | Kioto | home Explorar | `adashino-nenbutsu-ji-stone-statues-800w.webp` |
| 4 | 137,586 | 0.58 | 800×912 | WEBP | identity | JP-148 | Osaka | hub Osaka | `hikone-castle-keep-800w.webp` |
| 5 | 112,064 | 0.68 | 800×1067 | WEBP | identity | JP-106 | Osaka | hub Osaka | `kuromon-market-arcade-2024-800w.webp` |
| 6 | 100,336 | 0.78 | 800×1200 | WEBP | identity | JP-118 | Osaka | hub Osaka | `osaka-museum-of-history-800w.webp` |
| 7 | 100,034 | 0.88 | 800×531 | WEBP | identity | JP-144 | Osaka | hub Osaka | `okunoin-memorial-mound-800w.webp` |
| 8 | 97,826 | 0.97 | 800×1104 | WEBP | identity | JP-004 | Tokio | home Explorar | `takeshita-street-west-view-800w.webp` |
| 9 | 95,014 | 1.06 | 800×534 | WEBP | identity | JP-047 | Tokio | home Explorar | `edo-tokyo-open-air-architectural-museum-800w.webp` |
| 10 | 93,960 | 1.15 | 800×600 | WEBP | identity | JP-109 | Osaka | hub Osaka | `shinsekai-tsutenkaku-800w.webp` |
| 11 | 86,306 | 1.23 | 800×600 | WEBP | identity | JP-143 | Osaka | hub Osaka | `koyasan-temple-lodging-800w.webp` |
| 12 | 85,386 | 1.31 | 800×600 | WEBP | identity | JP-107 | Osaka | hub Osaka | `namba-yasaka-torii-name-stone-800w.webp` |
| 13 | 84,994 | 1.39 | 800×534 | WEBP | identity | JP-064 | Kioto | home Explorar | `honen-in-800w.webp` |
| 14 | 84,874 | 1.48 | 800×534 | WEBP | identity | JP-073 | Kioto | home Explorar | `okochi-sanso-garden-800w.webp` |
| 15 | 80,254 | 1.55 | 800×600 | WEBP | identity | JP-002 | Tokio | home Explorar | `shibuya-sky-observation-deck-800w.webp` |
| 16 | 79,470 | 1.63 | 800×534 | WEBP | identity | JP-103 | Osaka | hub Osaka | `dotonbori-night-800w.webp` |
| 17 | 79,394 | 1.70 | 800×600 | WEBP | identity | JP-061 | Kioto | home Explorar | `murinan-garden-800w.webp` |
| 18 | 78,166 | 1.78 | 800×600 | WEBP | identity | JP-157 | Okinawa | home Explorar | `shurijo-castle-shureimon-gate-800w.webp` |
| 19 | 77,012 | 1.85 | 800×1182 | WEBP | identity | JP-017 | Tokio | home Explorar | `asakusa-culture-tourist-information-center-800w.webp` |
| 20 | 76,058 | 1.92 | 800×534 | WEBP | identity | JP-151 | Osaka | hub Osaka | `ine-funaya-800w.webp` |
| 21 | 75,398 | 2.00 | 800×1197 | WEBP | identity | JP-111 | Osaka | hub Osaka | `abeno-harukas-800w.webp` |
| 22 | 74,508 | 2.07 | 800×588 | WEBP | identity | JP-145 | Osaka | hub Osaka | `nachi-falls-pagoda-800w.webp` |
| 23 | 74,406 | 2.14 | 800×534 | WEBP | identity | JP-147 | Osaka | hub Osaka | `enryaku-ji-konponchudo-autumn-800w.webp` |
| 24 | 73,756 | 2.21 | 800×1068 | WEBP | identity | JP-110 | Osaka | hub Osaka | `tsutenkaku-from-shinsekai-street-800w.webp` |
| 25 | 73,290 | 2.28 | 800×534 | WEBP | identity | JP-122 | Osaka | hub Osaka | `minoh-falls-800w.webp` |
| 26 | 71,154 | 2.35 | 800×534 | WEBP | identity | JP-069 | Kioto | home Explorar | `bishamondo-main-hall-yamashina-800w.webp` |
| 27 | 70,456 | 2.41 | 800×534 | WEBP | identity | JP-142 | Osaka | hub Osaka | `otani-river-canal-800w.webp` |
| 28 | 69,584 | 2.48 | 800×536 | WEBP | identity | JP-129 | Osaka | hub Osaka | `todaiji-great-buddha-hall-800w.webp` |
| 29 | 69,562 | 2.55 | 800×600 | WEBP | identity | JP-209 | Osaka | hub Osaka | `okunoshima-rabbit-ruins-800w.webp` |
| 30 | 69,272 | 2.61 | 800×600 | WEBP | identity | JP-033 | Tokio | home Explorar | `teamlab-borderless-azabudai-light-sculpture-800w.webp` |
| 31 | 69,240 | 2.68 | 800×534 | WEBP | identity | JP-113 | Osaka | hub Osaka | `grand-green-osaka-800w.webp` |
| 32 | 69,032 | 2.74 | 800×600 | WEBP | identity | JP-128 | Osaka | hub Osaka | `kishiwada-hachijin-garden-800w.webp` |
| 33 | 68,398 | 2.81 | 800×532 | WEBP | identity | JP-212 | Osaka | hub Osaka | `grand-sumo-tournament-osaka-800w.webp` |
| 34 | 68,270 | 2.87 | 800×600 | WEBP | identity | JP-028 | Tokio | home Explorar | `jimbocho-book-town-800w.webp` |
| 35 | 67,806 | 2.94 | 800×534 | WEBP | identity | JP-009 | Tokio | home Explorar | `daikanyama-t-site-800w.webp` |
| 36 | 67,728 | 3.00 | 800×534 | WEBP | identity | JP-012 | Tokio | home Explorar | `kabukicho-800w.webp` |
| 37 | 67,628 | 3.07 | 800×1067 | WEBP | identity | JP-114 | Osaka | hub Osaka | `nakanoshima-waterfront-800w.webp` |
| 38 | 67,476 | 3.13 | 800×600 | WEBP | identity | JP-049 | Tokio | home Explorar | `animate-ikebukuro-800w.webp` |
| 39 | 67,400 | 3.20 | 800×600 | WEBP | identity | JP-211 | Osaka | hub Osaka | `animejapan-tokyo-big-sight-entrance-800w.webp` |
| 40 | 67,320 | 3.26 | 800×600 | WEBP | identity | JP-007 | Tokio | home Explorar | `ota-memorial-museum-of-art-800w.webp` |
| 41 | 67,180 | 3.32 | 800×450 | WEBP | identity | JP-046 | Tokio | home Explorar | `nakano-broadway-800w.webp` |
| 42 | 67,118 | 3.39 | 800×534 | WEBP | identity | JP-149 | Osaka | hub Osaka | `miho-museum-800w.webp` |
| 43 | 66,984 | 3.45 | 800×534 | WEBP | identity | JP-136 | Osaka | hub Osaka | `koko-en-pines-himeji-castle-800w.webp` |
| 44 | 66,398 | 3.52 | 800×534 | WEBP | identity | JP-132 | Osaka | hub Osaka | `isuien-garden-nara-800w.webp` |
| 45 | 65,530 | 3.58 | 800×600 | WEBP | identity | JP-044 | Tokio | home Explorar | `ghibli-museum-exterior-800w.webp` |
| 46 | 64,600 | 3.64 | 800×450 | WEBP | identity | JP-135 | Osaka | hub Osaka | `himeji-castle-keep-800w.webp` |
| 47 | 63,810 | 3.70 | 800×601 | WEBP | identity | JP-003 | Tokio | home Explorar | `meiji-jingu-torii-800w.webp` |
| 48 | 63,370 | 3.76 | 800×451 | WEBP | identity | JP-117 | Osaka | hub Osaka | `osaka-castle-park-800w.webp` |
| 49 | 62,926 | 3.82 | 800×600 | WEBP | identity | JP-011 | Tokio | home Explorar | `tokyo-metropolitan-government-observatory-800w.webp` |
| 50 | 62,846 | 3.88 | 800×534 | WEBP | identity | JP-134 | Osaka | hub Osaka | `horyuji-kondo-pagoda-800w.webp` |
| 51 | 62,468 | 3.94 | 800×600 | WEBP | identity | JP-036 | Tokio | home Explorar | `21-21-design-sight-folded-roof-800w.webp` |
| 52 | 62,378 | 4.00 | 800×510 | WEBP | identity | JP-020 | Tokio | home Explorar | `sumida-hokusai-museum-800w.webp` |
| 53 | 61,220 | 4.06 | 800×601 | WEBP | identity | JP-024 | Tokio | home Explorar | `nezu-shrine-romon-gate-800w.webp` |
| 54 | 61,078 | 4.12 | 800×601 | WEBP | identity | JP-025 | Tokio | home Explorar | `akihabara-electric-town-800w.webp` |
| 55 | 60,958 | 4.18 | 800×492 | WEBP | identity | JP-054 | Kioto | home Explorar | `kiyomizu-dera-stage-800w.webp` |
| 56 | 60,430 | 4.23 | 800×600 | WEBP | identity | JP-108 | Osaka | hub Osaka | `den-den-town-800w.webp` |
| 57 | 58,472 | 4.29 | 800×600 | WEBP | identity | JP-146 | Osaka | hub Osaka | `tomogashima-battery-ruins-800w.webp` |
| 58 | 58,354 | 4.34 | 800×532 | WEBP | identity | JP-133 | Osaka | hub Osaka | `naramachi-shiryokan-migawari-zaru-800w.webp` |
| 59 | 57,594 | 4.40 | 800×534 | WEBP | identity | JP-105 | Osaka | hub Osaka | `hozenji-yokocho-800w.webp` |
| 60 | 56,332 | 4.45 | 800×534 | WEBP | identity | JP-115 | Osaka | hub Osaka | `nakanoshima-museum-art-800w.webp` |
| 61 | 56,324 | 4.51 | 800×536 | WEBP | identity | JP-141 | Osaka | hub Osaka | `arima-onsen-yumotozaka-800w.webp` |
| 62 | 54,650 | 4.56 | 800×602 | WEBP | identity | JP-001 | Tokio | home Explorar | `shibuya-scramble-crossing-800w.webp` |
| 63 | 53,724 | 4.61 | 800×586 | WEBP | identity | JP-037 | Tokio | home Explorar | `zojoji-tokyo-tower-800w.webp` |
| 64 | 52,844 | 4.66 | 800×532 | WEBP | identity | JP-137 | Osaka | hub Osaka | `engyo-ji-mitsunodo-halls-800w.webp` |
| 65 | 51,724 | 4.71 | 800×600 | WEBP | identity | JP-005 | Tokio | home Explorar | `cat-street-harajuku-800w.webp` |
| 66 | 47,416 | 4.75 | 800×534 | WEBP | identity | JP-124 | Osaka | hub Osaka | `osaka-aquarium-kaiyukan-800w.webp` |
| 67 | 44,510 | 4.80 | 800×514 | WEBP | identity | JP-112 | Osaka | hub Osaka | `umeda-sky-building-800w.webp` |
| 68 | 43,076 | 4.84 | 800×594 | WEBP | identity | JP-021 | Tokio | home Explorar | `tokyo-national-museum-stairs-800w.webp` |
| 69 | 41,816 | 4.88 | 800×450 | WEBP | identity | JP-077 | Kioto | home Explorar | `katsura-imperial-villa-pond-800w.webp` |
| 70 | 41,554 | 4.92 | 800×532 | WEBP | identity | JP-138 | Osaka | hub Osaka | `kobe-kitano-ijinkan-800w.webp` |
| 71 | 41,138 | 4.96 | 800×594 | WEBP | identity | JP-125 | Osaka | hub Osaka | `universal-studios-japan-entrance-800w.webp` |
| 72 | 39,698 | 4.99 | 800×504 | WEBP | identity | JP-089 | Kioto | home Explorar | `nijo-castle-ninomaru-palace-800w.webp` |
| 73 | 37,712 | 5.03 | 800×591 | WEBP | identity | JP-119 | Osaka | hub Osaka | `shitennoji-pagoda-dusk-800w.webp` |
| 74 | 35,858 | 5.07 | 800×508 | WEBP | identity | JP-130 | Osaka | hub Osaka | `nara-park-deer-800w.webp` |
| 75 | 34,896 | 5.10 | 800×600 | WEBP | identity | JP-126 | Osaka | hub Osaka | `super-nintendo-world-fifth-anniversary-entrance-800w.webp` |
| 76 | 33,154 | 5.13 | 800×601 | WEBP | identity | JP-116 | Osaka | hub Osaka | `osaka-housing-living-museum-800w.webp` |
| 77 | 32,822 | 5.16 | 800×534 | WEBP | identity | JP-066 | Kioto | home Explorar | `senbon-torii-path-800w.webp` |
| 78 | 30,432 | 5.19 | 800×600 | WEBP | identity | JP-150 | Osaka | hub Osaka | `amanohashidate-kasamatsu-view-800w.webp` |
| 79 | 30,110 | 5.22 | 800×534 | WEBP | identity | JP-096 | Kioto | home Explorar | `sanjusangendo-main-hall-800w.webp` |
| 80 | 26,242 | 5.24 | 800×534 | WEBP | identity | JP-152 | Osaka | hub Osaka | `naoshima-ferry-terminal-800w.webp` |
| 81 | 24,660 | 5.27 | 800×600 | WEBP | identity | JP-140 | Osaka | hub Osaka | `mount-rokko-night-view-kobe-800w.webp` |
| 82 | 24,546 | 5.29 | 800×180 | WEBP | identity | JP-127 | Osaka | hub Osaka | `sakai-cutlery-heritage-800w.webp` |
| 83 | 23,738 | 5.31 | 800×1067 | WEBP | identity | JP-123 | Osaka | hub Osaka | `church-of-the-light-800w.webp` |

### desktop — 89 imágenes, 6,053,578 B (5.77 MiB)

| # | Bytes | Acum. MiB | Dim. | Fmt | Rol | Lugar | Hub | Superficie | Archivo |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 171,478 | 0.16 | 800×1067 | WEBP | identity | JP-139 | Osaka | hub Osaka | `nunobiki-falls-herb-gardens-800w.webp` |
| 2 | 153,620 | 0.31 | 800×1200 | WEBP | identity | JP-131 | Osaka | hub Osaka | `kasuga-taisha-lanterns-800w.webp` |
| 3 | 148,972 | 0.45 | 800×1200 | WEBP | identity | JP-016 | Tokio | home Explorar | `sensoji-800w.webp` |
| 4 | 143,466 | 0.59 | 800×608 | WEBP | identity | JP-076 | Kioto | home Explorar | `adashino-nenbutsu-ji-stone-statues-800w.webp` |
| 5 | 137,586 | 0.72 | 800×912 | WEBP | identity | JP-148 | Osaka | hub Osaka | `hikone-castle-keep-800w.webp` |
| 6 | 112,064 | 0.83 | 800×1067 | WEBP | identity | JP-106 | Osaka | hub Osaka | `kuromon-market-arcade-2024-800w.webp` |
| 7 | 100,336 | 0.92 | 800×1200 | WEBP | identity | JP-118 | Osaka | hub Osaka | `osaka-museum-of-history-800w.webp` |
| 8 | 100,034 | 1.02 | 800×531 | WEBP | identity | JP-144 | Osaka | hub Osaka | `okunoin-memorial-mound-800w.webp` |
| 9 | 97,826 | 1.11 | 800×1104 | WEBP | identity | JP-004 | Tokio | home Explorar | `takeshita-street-west-view-800w.webp` |
| 10 | 95,014 | 1.20 | 800×534 | WEBP | identity | JP-047 | Tokio | home Explorar | `edo-tokyo-open-air-architectural-museum-800w.webp` |
| 11 | 93,960 | 1.29 | 800×600 | WEBP | identity | JP-109 | Osaka | hub Osaka | `shinsekai-tsutenkaku-800w.webp` |
| 12 | 89,598 | 1.38 | 800×534 | WEBP | identity | JP-070 | Kioto | home Explorar | `yamashina-canal-800w.webp` |
| 13 | 86,306 | 1.46 | 800×600 | WEBP | identity | JP-143 | Osaka | hub Osaka | `koyasan-temple-lodging-800w.webp` |
| 14 | 85,386 | 1.54 | 800×600 | WEBP | identity | JP-107 | Osaka | hub Osaka | `namba-yasaka-torii-name-stone-800w.webp` |
| 15 | 84,994 | 1.62 | 800×534 | WEBP | identity | JP-064 | Kioto | home Explorar | `honen-in-800w.webp` |
| 16 | 84,874 | 1.70 | 800×534 | WEBP | identity | JP-073 | Kioto | home Explorar | `okochi-sanso-garden-800w.webp` |
| 17 | 80,254 | 1.78 | 800×600 | WEBP | identity | JP-002 | Tokio | home Explorar | `shibuya-sky-observation-deck-800w.webp` |
| 18 | 79,788 | 1.86 | 800×600 | WEBP | identity | JP-074 | Kioto | home Explorar | `gio-ji-moss-garden-thatched-hall-800w.webp` |
| 19 | 79,470 | 1.93 | 800×534 | WEBP | identity | JP-103 | Osaka | hub Osaka | `dotonbori-night-800w.webp` |
| 20 | 79,394 | 2.01 | 800×600 | WEBP | identity | JP-061 | Kioto | home Explorar | `murinan-garden-800w.webp` |
| 21 | 78,166 | 2.08 | 800×600 | WEBP | identity | JP-157 | Okinawa | home Explorar | `shurijo-castle-shureimon-gate-800w.webp` |
| 22 | 77,012 | 2.15 | 800×1182 | WEBP | identity | JP-017 | Tokio | home Explorar | `asakusa-culture-tourist-information-center-800w.webp` |
| 23 | 76,058 | 2.23 | 800×534 | WEBP | identity | JP-151 | Osaka | hub Osaka | `ine-funaya-800w.webp` |
| 24 | 75,398 | 2.30 | 800×1197 | WEBP | identity | JP-111 | Osaka | hub Osaka | `abeno-harukas-800w.webp` |
| 25 | 74,508 | 2.37 | 800×588 | WEBP | identity | JP-145 | Osaka | hub Osaka | `nachi-falls-pagoda-800w.webp` |
| 26 | 74,406 | 2.44 | 800×534 | WEBP | identity | JP-147 | Osaka | hub Osaka | `enryaku-ji-konponchudo-autumn-800w.webp` |
| 27 | 73,756 | 2.51 | 800×1068 | WEBP | identity | JP-110 | Osaka | hub Osaka | `tsutenkaku-from-shinsekai-street-800w.webp` |
| 28 | 73,290 | 2.58 | 800×534 | WEBP | identity | JP-122 | Osaka | hub Osaka | `minoh-falls-800w.webp` |
| 29 | 71,154 | 2.65 | 800×534 | WEBP | identity | JP-069 | Kioto | home Explorar | `bishamondo-main-hall-yamashina-800w.webp` |
| 30 | 70,456 | 2.72 | 800×534 | WEBP | identity | JP-142 | Osaka | hub Osaka | `otani-river-canal-800w.webp` |
| 31 | 69,908 | 2.78 | 800×534 | WEBP | identity | JP-014 | Tokio | home Explorar | `omoide-yokocho-800w.webp` |
| 32 | 69,584 | 2.85 | 800×536 | WEBP | identity | JP-129 | Osaka | hub Osaka | `todaiji-great-buddha-hall-800w.webp` |
| 33 | 69,562 | 2.92 | 800×600 | WEBP | identity | JP-209 | Osaka | hub Osaka | `okunoshima-rabbit-ruins-800w.webp` |
| 34 | 69,272 | 2.98 | 800×600 | WEBP | identity | JP-033 | Tokio | home Explorar | `teamlab-borderless-azabudai-light-sculpture-800w.webp` |
| 35 | 69,240 | 3.05 | 800×534 | WEBP | identity | JP-113 | Osaka | hub Osaka | `grand-green-osaka-800w.webp` |
| 36 | 69,032 | 3.11 | 800×600 | WEBP | identity | JP-128 | Osaka | hub Osaka | `kishiwada-hachijin-garden-800w.webp` |
| 37 | 68,398 | 3.18 | 800×532 | WEBP | identity | JP-212 | Osaka | hub Osaka | `grand-sumo-tournament-osaka-800w.webp` |
| 38 | 68,270 | 3.24 | 800×600 | WEBP | identity | JP-028 | Tokio | home Explorar | `jimbocho-book-town-800w.webp` |
| 39 | 67,806 | 3.31 | 800×534 | WEBP | identity | JP-009 | Tokio | home Explorar | `daikanyama-t-site-800w.webp` |
| 40 | 67,728 | 3.37 | 800×534 | WEBP | identity | JP-012 | Tokio | home Explorar | `kabukicho-800w.webp` |
| 41 | 67,628 | 3.44 | 800×1067 | WEBP | identity | JP-114 | Osaka | hub Osaka | `nakanoshima-waterfront-800w.webp` |
| 42 | 67,476 | 3.50 | 800×600 | WEBP | identity | JP-049 | Tokio | home Explorar | `animate-ikebukuro-800w.webp` |
| 43 | 67,400 | 3.57 | 800×600 | WEBP | identity | JP-211 | Osaka | hub Osaka | `animejapan-tokyo-big-sight-entrance-800w.webp` |
| 44 | 67,320 | 3.63 | 800×600 | WEBP | identity | JP-007 | Tokio | home Explorar | `ota-memorial-museum-of-art-800w.webp` |
| 45 | 67,180 | 3.69 | 800×450 | WEBP | identity | JP-046 | Tokio | home Explorar | `nakano-broadway-800w.webp` |
| 46 | 67,118 | 3.76 | 800×534 | WEBP | identity | JP-149 | Osaka | hub Osaka | `miho-museum-800w.webp` |
| 47 | 66,984 | 3.82 | 800×534 | WEBP | identity | JP-136 | Osaka | hub Osaka | `koko-en-pines-himeji-castle-800w.webp` |
| 48 | 66,398 | 3.89 | 800×534 | WEBP | identity | JP-132 | Osaka | hub Osaka | `isuien-garden-nara-800w.webp` |
| 49 | 65,530 | 3.95 | 800×600 | WEBP | identity | JP-044 | Tokio | home Explorar | `ghibli-museum-exterior-800w.webp` |
| 50 | 64,600 | 4.01 | 800×450 | WEBP | identity | JP-135 | Osaka | hub Osaka | `himeji-castle-keep-800w.webp` |
| 51 | 63,810 | 4.07 | 800×601 | WEBP | identity | JP-003 | Tokio | home Explorar | `meiji-jingu-torii-800w.webp` |
| 52 | 63,370 | 4.13 | 800×451 | WEBP | identity | JP-117 | Osaka | hub Osaka | `osaka-castle-park-800w.webp` |
| 53 | 62,926 | 4.19 | 800×600 | WEBP | identity | JP-011 | Tokio | home Explorar | `tokyo-metropolitan-government-observatory-800w.webp` |
| 54 | 62,846 | 4.25 | 800×534 | WEBP | identity | JP-134 | Osaka | hub Osaka | `horyuji-kondo-pagoda-800w.webp` |
| 55 | 62,468 | 4.31 | 800×600 | WEBP | identity | JP-036 | Tokio | home Explorar | `21-21-design-sight-folded-roof-800w.webp` |
| 56 | 62,378 | 4.37 | 800×510 | WEBP | identity | JP-020 | Tokio | home Explorar | `sumida-hokusai-museum-800w.webp` |
| 57 | 61,220 | 4.43 | 800×601 | WEBP | identity | JP-024 | Tokio | home Explorar | `nezu-shrine-romon-gate-800w.webp` |
| 58 | 61,078 | 4.49 | 800×601 | WEBP | identity | JP-025 | Tokio | home Explorar | `akihabara-electric-town-800w.webp` |
| 59 | 60,958 | 4.55 | 800×492 | WEBP | identity | JP-054 | Kioto | home Explorar | `kiyomizu-dera-stage-800w.webp` |
| 60 | 60,430 | 4.60 | 800×600 | WEBP | identity | JP-108 | Osaka | hub Osaka | `den-den-town-800w.webp` |
| 61 | 58,472 | 4.66 | 800×600 | WEBP | identity | JP-146 | Osaka | hub Osaka | `tomogashima-battery-ruins-800w.webp` |
| 62 | 58,354 | 4.71 | 800×532 | WEBP | identity | JP-133 | Osaka | hub Osaka | `naramachi-shiryokan-migawari-zaru-800w.webp` |
| 63 | 57,594 | 4.77 | 800×534 | WEBP | identity | JP-105 | Osaka | hub Osaka | `hozenji-yokocho-800w.webp` |
| 64 | 56,332 | 4.82 | 800×534 | WEBP | identity | JP-115 | Osaka | hub Osaka | `nakanoshima-museum-art-800w.webp` |
| 65 | 56,324 | 4.88 | 800×536 | WEBP | identity | JP-141 | Osaka | hub Osaka | `arima-onsen-yumotozaka-800w.webp` |
| 66 | 54,650 | 4.93 | 800×602 | WEBP | identity | JP-001 | Tokio | home Explorar | `shibuya-scramble-crossing-800w.webp` |
| 67 | 53,724 | 4.98 | 800×586 | WEBP | identity | JP-037 | Tokio | home Explorar | `zojoji-tokyo-tower-800w.webp` |
| 68 | 52,844 | 5.03 | 800×532 | WEBP | identity | JP-137 | Osaka | hub Osaka | `engyo-ji-mitsunodo-halls-800w.webp` |
| 69 | 51,724 | 5.08 | 800×600 | WEBP | identity | JP-005 | Tokio | home Explorar | `cat-street-harajuku-800w.webp` |
| 70 | 47,720 | 5.13 | 800×532 | WEBP | identity | JP-102 | Kioto | home Explorar | `demachi-masugata-arcade-800w.webp` |
| 71 | 47,416 | 5.17 | 800×534 | WEBP | identity | JP-124 | Osaka | hub Osaka | `osaka-aquarium-kaiyukan-800w.webp` |
| 72 | 45,920 | 5.21 | 800×475 | WEBP | identity | JP-097 | Kioto | home Explorar | `nintendo-museum-entrance-800w.webp` |
| 73 | 44,510 | 5.26 | 800×514 | WEBP | identity | JP-112 | Osaka | hub Osaka | `umeda-sky-building-800w.webp` |
| 74 | 43,076 | 5.30 | 800×594 | WEBP | identity | JP-021 | Tokio | home Explorar | `tokyo-national-museum-stairs-800w.webp` |
| 75 | 41,816 | 5.34 | 800×450 | WEBP | identity | JP-077 | Kioto | home Explorar | `katsura-imperial-villa-pond-800w.webp` |
| 76 | 41,554 | 5.38 | 800×532 | WEBP | identity | JP-138 | Osaka | hub Osaka | `kobe-kitano-ijinkan-800w.webp` |
| 77 | 41,138 | 5.42 | 800×594 | WEBP | identity | JP-125 | Osaka | hub Osaka | `universal-studios-japan-entrance-800w.webp` |
| 78 | 39,698 | 5.45 | 800×504 | WEBP | identity | JP-089 | Kioto | home Explorar | `nijo-castle-ninomaru-palace-800w.webp` |
| 79 | 37,712 | 5.49 | 800×591 | WEBP | identity | JP-119 | Osaka | hub Osaka | `shitennoji-pagoda-dusk-800w.webp` |
| 80 | 35,858 | 5.52 | 800×508 | WEBP | identity | JP-130 | Osaka | hub Osaka | `nara-park-deer-800w.webp` |
| 81 | 34,896 | 5.56 | 800×600 | WEBP | identity | JP-126 | Osaka | hub Osaka | `super-nintendo-world-fifth-anniversary-entrance-800w.webp` |
| 82 | 33,154 | 5.59 | 800×601 | WEBP | identity | JP-116 | Osaka | hub Osaka | `osaka-housing-living-museum-800w.webp` |
| 83 | 32,822 | 5.62 | 800×534 | WEBP | identity | JP-066 | Kioto | home Explorar | `senbon-torii-path-800w.webp` |
| 84 | 30,432 | 5.65 | 800×600 | WEBP | identity | JP-150 | Osaka | hub Osaka | `amanohashidate-kasamatsu-view-800w.webp` |
| 85 | 30,110 | 5.68 | 800×534 | WEBP | identity | JP-096 | Kioto | home Explorar | `sanjusangendo-main-hall-800w.webp` |
| 86 | 26,242 | 5.70 | 800×534 | WEBP | identity | JP-152 | Osaka | hub Osaka | `naoshima-ferry-terminal-800w.webp` |
| 87 | 24,660 | 5.73 | 800×600 | WEBP | identity | JP-140 | Osaka | hub Osaka | `mount-rokko-night-view-kobe-800w.webp` |
| 88 | 24,546 | 5.75 | 800×180 | WEBP | identity | JP-127 | Osaka | hub Osaka | `sakai-cutlery-heritage-800w.webp` |
| 89 | 23,738 | 5.77 | 800×1067 | WEBP | identity | JP-123 | Osaka | hub Osaka | `church-of-the-light-800w.webp` |

### phone — 76 imágenes, 5,049,648 B (4.82 MiB)

| # | Bytes | Acum. MiB | Dim. | Fmt | Rol | Lugar | Hub | Superficie | Archivo |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 171,478 | 0.16 | 800×1067 | WEBP | identity | JP-139 | Osaka | hub Osaka | `nunobiki-falls-herb-gardens-800w.webp` |
| 2 | 153,620 | 0.31 | 800×1200 | WEBP | identity | JP-131 | Osaka | hub Osaka | `kasuga-taisha-lanterns-800w.webp` |
| 3 | 137,586 | 0.44 | 800×912 | WEBP | identity | JP-148 | Osaka | hub Osaka | `hikone-castle-keep-800w.webp` |
| 4 | 112,064 | 0.55 | 800×1067 | WEBP | identity | JP-106 | Osaka | hub Osaka | `kuromon-market-arcade-2024-800w.webp` |
| 5 | 100,336 | 0.64 | 800×1200 | WEBP | identity | JP-118 | Osaka | hub Osaka | `osaka-museum-of-history-800w.webp` |
| 6 | 100,034 | 0.74 | 800×531 | WEBP | identity | JP-144 | Osaka | hub Osaka | `okunoin-memorial-mound-800w.webp` |
| 7 | 97,826 | 0.83 | 800×1104 | WEBP | identity | JP-004 | Tokio | home Explorar | `takeshita-street-west-view-800w.webp` |
| 8 | 95,014 | 0.92 | 800×534 | WEBP | identity | JP-047 | Tokio | home Explorar | `edo-tokyo-open-air-architectural-museum-800w.webp` |
| 9 | 93,960 | 1.01 | 800×600 | WEBP | identity | JP-109 | Osaka | hub Osaka | `shinsekai-tsutenkaku-800w.webp` |
| 10 | 86,306 | 1.10 | 800×600 | WEBP | identity | JP-143 | Osaka | hub Osaka | `koyasan-temple-lodging-800w.webp` |
| 11 | 85,386 | 1.18 | 800×600 | WEBP | identity | JP-107 | Osaka | hub Osaka | `namba-yasaka-torii-name-stone-800w.webp` |
| 12 | 80,254 | 1.25 | 800×600 | WEBP | identity | JP-002 | Tokio | home Explorar | `shibuya-sky-observation-deck-800w.webp` |
| 13 | 79,470 | 1.33 | 800×534 | WEBP | identity | JP-103 | Osaka | hub Osaka | `dotonbori-night-800w.webp` |
| 14 | 79,394 | 1.40 | 800×600 | WEBP | identity | JP-061 | Kioto | home Explorar | `murinan-garden-800w.webp` |
| 15 | 78,166 | 1.48 | 800×600 | WEBP | identity | JP-157 | Okinawa | home Explorar | `shurijo-castle-shureimon-gate-800w.webp` |
| 16 | 77,012 | 1.55 | 800×1182 | WEBP | identity | JP-017 | Tokio | home Explorar | `asakusa-culture-tourist-information-center-800w.webp` |
| 17 | 76,058 | 1.63 | 800×534 | WEBP | identity | JP-151 | Osaka | hub Osaka | `ine-funaya-800w.webp` |
| 18 | 75,398 | 1.70 | 800×1197 | WEBP | identity | JP-111 | Osaka | hub Osaka | `abeno-harukas-800w.webp` |
| 19 | 74,508 | 1.77 | 800×588 | WEBP | identity | JP-145 | Osaka | hub Osaka | `nachi-falls-pagoda-800w.webp` |
| 20 | 74,406 | 1.84 | 800×534 | WEBP | identity | JP-147 | Osaka | hub Osaka | `enryaku-ji-konponchudo-autumn-800w.webp` |
| 21 | 73,756 | 1.91 | 800×1068 | WEBP | identity | JP-110 | Osaka | hub Osaka | `tsutenkaku-from-shinsekai-street-800w.webp` |
| 22 | 73,290 | 1.98 | 800×534 | WEBP | identity | JP-122 | Osaka | hub Osaka | `minoh-falls-800w.webp` |
| 23 | 70,456 | 2.05 | 800×534 | WEBP | identity | JP-142 | Osaka | hub Osaka | `otani-river-canal-800w.webp` |
| 24 | 69,584 | 2.11 | 800×536 | WEBP | identity | JP-129 | Osaka | hub Osaka | `todaiji-great-buddha-hall-800w.webp` |
| 25 | 69,562 | 2.18 | 800×600 | WEBP | identity | JP-209 | Osaka | hub Osaka | `okunoshima-rabbit-ruins-800w.webp` |
| 26 | 69,272 | 2.25 | 800×600 | WEBP | identity | JP-033 | Tokio | home Explorar | `teamlab-borderless-azabudai-light-sculpture-800w.webp` |
| 27 | 69,240 | 2.31 | 800×534 | WEBP | identity | JP-113 | Osaka | hub Osaka | `grand-green-osaka-800w.webp` |
| 28 | 69,032 | 2.38 | 800×600 | WEBP | identity | JP-128 | Osaka | hub Osaka | `kishiwada-hachijin-garden-800w.webp` |
| 29 | 68,398 | 2.44 | 800×532 | WEBP | identity | JP-212 | Osaka | hub Osaka | `grand-sumo-tournament-osaka-800w.webp` |
| 30 | 68,270 | 2.51 | 800×600 | WEBP | identity | JP-028 | Tokio | home Explorar | `jimbocho-book-town-800w.webp` |
| 31 | 67,806 | 2.57 | 800×534 | WEBP | identity | JP-009 | Tokio | home Explorar | `daikanyama-t-site-800w.webp` |
| 32 | 67,628 | 2.64 | 800×1067 | WEBP | identity | JP-114 | Osaka | hub Osaka | `nakanoshima-waterfront-800w.webp` |
| 33 | 67,476 | 2.70 | 800×600 | WEBP | identity | JP-049 | Tokio | home Explorar | `animate-ikebukuro-800w.webp` |
| 34 | 67,400 | 2.77 | 800×600 | WEBP | identity | JP-211 | Osaka | hub Osaka | `animejapan-tokyo-big-sight-entrance-800w.webp` |
| 35 | 67,320 | 2.83 | 800×600 | WEBP | identity | JP-007 | Tokio | home Explorar | `ota-memorial-museum-of-art-800w.webp` |
| 36 | 67,180 | 2.89 | 800×450 | WEBP | identity | JP-046 | Tokio | home Explorar | `nakano-broadway-800w.webp` |
| 37 | 67,118 | 2.96 | 800×534 | WEBP | identity | JP-149 | Osaka | hub Osaka | `miho-museum-800w.webp` |
| 38 | 66,984 | 3.02 | 800×534 | WEBP | identity | JP-136 | Osaka | hub Osaka | `koko-en-pines-himeji-castle-800w.webp` |
| 39 | 66,398 | 3.08 | 800×534 | WEBP | identity | JP-132 | Osaka | hub Osaka | `isuien-garden-nara-800w.webp` |
| 40 | 65,530 | 3.15 | 800×600 | WEBP | identity | JP-044 | Tokio | home Explorar | `ghibli-museum-exterior-800w.webp` |
| 41 | 64,600 | 3.21 | 800×450 | WEBP | identity | JP-135 | Osaka | hub Osaka | `himeji-castle-keep-800w.webp` |
| 42 | 63,810 | 3.27 | 800×601 | WEBP | identity | JP-003 | Tokio | home Explorar | `meiji-jingu-torii-800w.webp` |
| 43 | 63,370 | 3.33 | 800×451 | WEBP | identity | JP-117 | Osaka | hub Osaka | `osaka-castle-park-800w.webp` |
| 44 | 62,926 | 3.39 | 800×600 | WEBP | identity | JP-011 | Tokio | home Explorar | `tokyo-metropolitan-government-observatory-800w.webp` |
| 45 | 62,846 | 3.45 | 800×534 | WEBP | identity | JP-134 | Osaka | hub Osaka | `horyuji-kondo-pagoda-800w.webp` |
| 46 | 62,468 | 3.51 | 800×600 | WEBP | identity | JP-036 | Tokio | home Explorar | `21-21-design-sight-folded-roof-800w.webp` |
| 47 | 62,378 | 3.57 | 800×510 | WEBP | identity | JP-020 | Tokio | home Explorar | `sumida-hokusai-museum-800w.webp` |
| 48 | 61,220 | 3.63 | 800×601 | WEBP | identity | JP-024 | Tokio | home Explorar | `nezu-shrine-romon-gate-800w.webp` |
| 49 | 61,078 | 3.69 | 800×601 | WEBP | identity | JP-025 | Tokio | home Explorar | `akihabara-electric-town-800w.webp` |
| 50 | 60,958 | 3.74 | 800×492 | WEBP | identity | JP-054 | Kioto | home Explorar | `kiyomizu-dera-stage-800w.webp` |
| 51 | 60,430 | 3.80 | 800×600 | WEBP | identity | JP-108 | Osaka | hub Osaka | `den-den-town-800w.webp` |
| 52 | 58,472 | 3.86 | 800×600 | WEBP | identity | JP-146 | Osaka | hub Osaka | `tomogashima-battery-ruins-800w.webp` |
| 53 | 58,354 | 3.91 | 800×532 | WEBP | identity | JP-133 | Osaka | hub Osaka | `naramachi-shiryokan-migawari-zaru-800w.webp` |
| 54 | 57,594 | 3.97 | 800×534 | WEBP | identity | JP-105 | Osaka | hub Osaka | `hozenji-yokocho-800w.webp` |
| 55 | 56,332 | 4.02 | 800×534 | WEBP | identity | JP-115 | Osaka | hub Osaka | `nakanoshima-museum-art-800w.webp` |
| 56 | 56,324 | 4.08 | 800×536 | WEBP | identity | JP-141 | Osaka | hub Osaka | `arima-onsen-yumotozaka-800w.webp` |
| 57 | 54,650 | 4.13 | 800×602 | WEBP | identity | JP-001 | Tokio | home Explorar | `shibuya-scramble-crossing-800w.webp` |
| 58 | 53,724 | 4.18 | 800×586 | WEBP | identity | JP-037 | Tokio | home Explorar | `zojoji-tokyo-tower-800w.webp` |
| 59 | 52,844 | 4.23 | 800×532 | WEBP | identity | JP-137 | Osaka | hub Osaka | `engyo-ji-mitsunodo-halls-800w.webp` |
| 60 | 51,724 | 4.28 | 800×600 | WEBP | identity | JP-005 | Tokio | home Explorar | `cat-street-harajuku-800w.webp` |
| 61 | 47,416 | 4.32 | 800×534 | WEBP | identity | JP-124 | Osaka | hub Osaka | `osaka-aquarium-kaiyukan-800w.webp` |
| 62 | 44,510 | 4.37 | 800×514 | WEBP | identity | JP-112 | Osaka | hub Osaka | `umeda-sky-building-800w.webp` |
| 63 | 43,076 | 4.41 | 800×594 | WEBP | identity | JP-021 | Tokio | home Explorar | `tokyo-national-museum-stairs-800w.webp` |
| 64 | 41,816 | 4.45 | 800×450 | WEBP | identity | JP-077 | Kioto | home Explorar | `katsura-imperial-villa-pond-800w.webp` |
| 65 | 41,554 | 4.49 | 800×532 | WEBP | identity | JP-138 | Osaka | hub Osaka | `kobe-kitano-ijinkan-800w.webp` |
| 66 | 41,138 | 4.53 | 800×594 | WEBP | identity | JP-125 | Osaka | hub Osaka | `universal-studios-japan-entrance-800w.webp` |
| 67 | 37,712 | 4.56 | 800×591 | WEBP | identity | JP-119 | Osaka | hub Osaka | `shitennoji-pagoda-dusk-800w.webp` |
| 68 | 35,858 | 4.60 | 800×508 | WEBP | identity | JP-130 | Osaka | hub Osaka | `nara-park-deer-800w.webp` |
| 69 | 34,896 | 4.63 | 800×600 | WEBP | identity | JP-126 | Osaka | hub Osaka | `super-nintendo-world-fifth-anniversary-entrance-800w.webp` |
| 70 | 33,154 | 4.66 | 800×601 | WEBP | identity | JP-116 | Osaka | hub Osaka | `osaka-housing-living-museum-800w.webp` |
| 71 | 32,822 | 4.69 | 800×534 | WEBP | identity | JP-066 | Kioto | home Explorar | `senbon-torii-path-800w.webp` |
| 72 | 30,432 | 4.72 | 800×600 | WEBP | identity | JP-150 | Osaka | hub Osaka | `amanohashidate-kasamatsu-view-800w.webp` |
| 73 | 26,242 | 4.75 | 800×534 | WEBP | identity | JP-152 | Osaka | hub Osaka | `naoshima-ferry-terminal-800w.webp` |
| 74 | 24,660 | 4.77 | 800×600 | WEBP | identity | JP-140 | Osaka | hub Osaka | `mount-rokko-night-view-kobe-800w.webp` |
| 75 | 24,546 | 4.79 | 800×180 | WEBP | identity | JP-127 | Osaka | hub Osaka | `sakai-cutlery-heritage-800w.webp` |
| 76 | 23,738 | 4.82 | 800×1067 | WEBP | identity | JP-123 | Osaka | hub Osaka | `church-of-the-light-800w.webp` |

## 8. Reproducción

```bash
cd app && npm run build && node scripts/block2-photography-browser-audit.mjs   # 79/81
python3 scripts/build-photography-derivatives.py --check                         # OK 244
```

Nota: en `main` (`8eb725e`) este gate no llega al hub (5 imágenes y `TimeoutError`), así que no hay
línea base comparable en `main`.

## 9. Decisión de dirección y cierre

**Decisión:** opción 1. El presupuesto `< 5 MiB` se conserva sin cambio de valor; la medición
empieza cuando se entra efectivamente al hub, no desde `page.goto("/")`. El tráfico de la portada de
Explorar queda fuera del presupuesto del hub porque no le pertenece — no se esconde, se deja de
atribuir a una superficie que no lo generó.

**Implementación** (`app/scripts/block2-photography-browser-audit.mjs`): el registro de respuestas
`.webp` (`images`) se vacía (`images.length = 0`) inmediatamente después del clic que entra al hub y
antes del scroll de la lista, en vez de acumular desde el `page.goto` inicial. Es un cambio de
instrumentación de una línea; ninguna constante, ningún `check(...)`, ningún umbral se tocó.

**Osaka, tras el fix:** 3,09 MiB (phone) / 3,03 MiB (tablet) / 3,09 MiB (desktop) — coincide con el
recorrido real del hub medido en §3 (3,20 MiB), la pequeña diferencia es variación normal del orden
de llegada de imágenes bajo scroll asíncrono. **Block 2: 81/81** en los tres viewports.

### Verificación de los 4 hubs (no sólo Osaka)

Auditoría ad hoc (misma lógica: reset de tracking tras el clic al hub, scroll completo), Tokio,
Kioto, Osaka y Okinawa, en los tres viewports del gate:

| Hub | phone | tablet | desktop |
|---|---|---|---|
| Tokio | 2.848 MiB | 2.131 MiB | 2.257 MiB |
| Kioto | 3.279 MiB | 3.248 MiB | 2.932 MiB |
| Osaka | 3.162 MiB | 2.924 MiB | 2.380 MiB |
| Okinawa | 2.629 MiB | 2.629 MiB | 2.694 MiB |

Las 12 combinaciones quedan por debajo de 5 MiB — el máximo es Kioto/phone con 3,279 MiB, muy por
debajo del límite. **No se encontró ningún hub que exceda `< 5 MiB` contando sólo tráfico del hub**,
así que no hay hallazgo nuevo que reportar y la constante no necesitó revisión.

### Regresión ejecutada tras el fix

| Gate | Resultado |
|---|---|
| Block 2 (los 3 viewports) | 81/81 |
| Gate de integración B24+B23+B6.5+B6.7 | 58/58 (incluye 2-RETRY: Reintentar existe, es clicable y recupera la foto) |
| B23 retry (unit browser audit) | 28/28 — confirma que el 503 simulado dispara error real y el reintento reemite la misma URL |
| Vitest | 3384/3384 |
| lint | 0 errores (mismo warning heredado de `PlaceMap.tsx`) |
| build | OK — bundle inicial 390,42 kB gzip |
| pytest (`scripts/`) | 557/624 pasan; **67 fallos preexistentes e idénticos con y sin este cambio** (confirmado por `git stash`), concentrados en `test_phase4m_stop_vs_continue.py` y `test_phase4k_coverage_strategy.py` — comprobaciones de alcance de fases anteriores (`DesignOnlyScopeTests`, fixtures de selector) que ya fallaban en `b06c1d4` antes de tocar nada de esta DDR. Quedan fuera del alcance de DDR-MERGE-1; no se tocaron. |

**Punto sin resolver, por decisión explícita:** la contradicción 400w/800w de `PlaceCard
variant="compact"` (§4, hallazgo secundario) sigue abierta. No se resuelve en este cierre.
