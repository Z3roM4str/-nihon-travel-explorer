# Bloque 22 — B6.1: cierre de cobertura fotográfica grado S

**Estado:** CERRADO

**Rama:** `codex/block-22-b6-1-grade-s-photography`

**Base verificada:** `e3fca24a362efcfa99bd141599972944c0fabb99` (`claude/block-20-b4-place-detail-photography`)

**Fecha de adquisición:** 2026-09-21

## Resultado

La auditoría reproducible del SHA base confirmó que los únicos lugares grado S sin fotografía
eran `JP-033`, `JP-126`, `JP-203` y `JP-204`. Los cuatro reciben exactamente una fotografía
`identity`, con licencia verificada en Wikimedia Commons, sin segunda imagen y sin sustitutos.

| ID | Lugar | Resultado | Archivo/fuente | Licencia | Autor | role | bytes añadidos |
|---|---|---|---|---|---|---|---:|
| JP-033 | teamLab Borderless | Aceptada | `TeamLab Borderless Azabudai Hills.jpg` | CC BY-SA 4.0 | DannyWithLove | `identity` | 411.320 B |
| JP-126 | SUPER NINTENDO WORLD | Aceptada | `Super Nintendo World Entrance 5th Anniversary decoration at Universal Studios Japan.jpg` | CC0 | archive 2025 ark | `identity` | 242.338 B |
| JP-203 | Tokyo Disneyland | Aceptada | `Tokyo Disneyland Main Entrance (June 2025).jpg` | CC BY-SA 4.0 | Fred Cherrygarden | `identity` | 243.228 B |
| JP-204 | Tokyo DisneySea | Aceptada | `Tokyo DisneySea-Volcania.jpg` | CC BY-SA 2.5 | Okwhatev at en.wikipedia | `identity` | 251.730 B |

`bytes añadidos` suma el WebP principal y sus derivadas `-400w` y `-800w`. El presupuesto de
lista se mide aparte y usa exclusivamente la derivada que realmente carga la lista (`-800w`).

## Evidencia por fotografía

### JP-033 — teamLab Borderless

- Identidad: la instalación Light Sculpture de la sede vigente de Azabudai Hills llena el
  encuadre; el punto luminoso central y los visitantes sobreviven a 4:3, 16:9 y 4:5. La página
  de Commons aporta coordenadas a 0,19 km del lugar.
- Fuente: <https://commons.wikimedia.org/wiki/File%3ATeamLab_Borderless_Azabudai_Hills.jpg>
- Adquisición: <https://upload.wikimedia.org/wikipedia/commons/0/07/TeamLab_Borderless_Azabudai_Hills.jpg>
- Autor/licencia: DannyWithLove, CC BY-SA 4.0
  (<https://creativecommons.org/licenses/by-sa/4.0/>).
- Dimensiones fuente: 3852×2889. Procesamiento: `resized-and-webp-reencoded` a WebP 1600×1200.
- Asset: `images/places/JP-033/teamlab-borderless-azabudai-light-sculpture.webp` (297.012 B).
- Derivadas: `-400w` 29.248 B; `-800w` 85.060 B.
- LQIP: WebP de 20 px generado automáticamente, data URL de 571 B. `role: identity`.

### JP-126 — SUPER NINTENDO WORLD

- Identidad: el rótulo completo y la tubería de acceso identifican inequívocamente el lugar;
  la composición nocturna 4:3 conserva el sujeto en los tres recortes requeridos.
- Fuente: <https://commons.wikimedia.org/wiki/File%3ASuper_Nintendo_World_Entrance_5th_Anniversary_decoration_at_Universal_Studios_Japan.jpg>
- Adquisición: <https://upload.wikimedia.org/wikipedia/commons/b/b3/Super_Nintendo_World_Entrance_5th_Anniversary_decoration_at_Universal_Studios_Japan.jpg>
- Autor/licencia: archive 2025 ark, CC0
  (<https://creativecommons.org/publicdomain/zero/1.0/deed.en>).
- Dimensiones fuente: 4000×3000. Procesamiento: `resized-and-webp-reencoded` a WebP 1600×1200.
- Asset: `images/places/JP-126/super-nintendo-world-fifth-anniversary-entrance.webp` (195.008 B).
- Derivadas: `-400w` 12.434 B; `-800w` 34.896 B.
- LQIP: WebP de 20 px generado automáticamente, data URL de 687 B. `role: identity`.

### JP-203 — Tokyo Disneyland

- Identidad: la entrada principal frontal y su rótulo nombran el parque; el encuadre simétrico
  funciona como portada y conserva el sujeto en los tres formatos.
- Fuente: <https://commons.wikimedia.org/wiki/File%3ATokyo_Disneyland_Main_Entrance_%28June_2025%29.jpg>
- Adquisición: <https://upload.wikimedia.org/wikipedia/commons/f/f0/Tokyo_Disneyland_Main_Entrance_%28June_2025%29.jpg>
- Autor/licencia: Fred Cherrygarden, CC BY-SA 4.0
  (<https://creativecommons.org/licenses/by-sa/4.0/>).
- Dimensiones fuente: 6000×4000. Procesamiento: `resized-and-webp-reencoded` a WebP 1600×1067.
- Asset: `images/places/JP-203/tokyo-disneyland-main-entrance-2025.webp` (187.880 B).
- Derivadas: `-400w` 12.548 B; `-800w` 42.800 B.
- LQIP: WebP de 20 px generado automáticamente, data URL de 523 B. `role: identity`.

### JP-204 — Tokyo DisneySea

- Identidad: Mount Prometheus, Fortress Expeditions y los canales forman la vista central
  característica del parque y permanecen legibles en 4:3, 16:9 y 4:5.
- Fuente: <https://commons.wikimedia.org/wiki/File%3ATokyo_DisneySea-Volcania.jpg>
- Adquisición: <https://upload.wikimedia.org/wikipedia/commons/d/d0/Tokyo_DisneySea-Volcania.jpg>
- Autor/licencia: Okwhatev at en.wikipedia, CC BY-SA 2.5
  (<https://creativecommons.org/licenses/by-sa/2.5/>).
- Dimensiones fuente: 2560×1920. Procesamiento: `resized-and-webp-reencoded` a WebP 1600×1200.
- Asset: `images/places/JP-204/tokyo-disneysea-mount-prometheus-fortress.webp` (191.508 B).
- Derivadas: `-400w` 14.370 B; `-800w` 45.852 B.
- LQIP: WebP de 20 px generado automáticamente, data URL de 587 B. `role: identity`.

## Candidatos rechazados

- JP-033: `Azabudai Hills 3.jpg` identifica la sede, pero el original vertical pierde el sujeto
  en 16:9; los archivos de Odaiba muestran la sede cerrada, no la ubicación vigente.
- JP-126: `Super Nintendo World Entrance.jpg` tiene una persona desenfocada dominante; la toma
  `20220814` es vertical y corta el rótulo o la entrada en 16:9.
- JP-203: las alternativas del Disneyland Hotel y Resort Line muestran hotel o monorraíl, no el
  parque.
- JP-204: `Disneysea entrance.jpg` está descrita como entrada de Ikspiari; `Tokyo Disney Sea.jpg`
  sólo muestra Temple of the Crystal Skull; Tower of Terror, Nemo SeaRider y Toy Story Mania son
  atracciones individuales, no una portada del parque.

La lista estructurada completa y sus motivos están en
`data/visual/block22-b6-1-acquisition-plan.json`.

## Fundación B6 y pipeline

- Los 163 registros heredados recibieron `role` con migración cerrada y auditada: la primera
  imagen es `identity`; sólo seis segundas imágenes con evidencia previa reciben `context`,
  `detail` o `experience`. No se inventó ninguna clasificación.
- `build-photography-derivatives.py` genera `-400w`, conserva `-800w` y produce LQIP WebP de
  20 px/base64 dentro del objetivo aproximado de 400–700 B. El modo `--check` recalcula y detecta
  derivados o LQIP obsoletos.
- `validate-photography.py` comprueba roles, unicidad de `identity`, LQIP, ambas derivadas,
  integridad de assets y presupuesto de lista por hub.
- La adquisición siguió `scripts/acquire-photography.py`; la preparación reutiliza el contrato
  de fuentes/licencias del pipeline existente. No se creó un pipeline paralelo.
- `app/src/data/place-images.ts` conserva el SHA-256 del baseline:
  `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb`.
- No se añadió AVIF ni se modificó UI, CSS, navegación, mapa, planner o copy visible.

## Cobertura y presupuesto

| Métrica | Antes | Añadido | Después | Variación |
|---|---:|---:|---:|---:|
| Grado S con fotografía | 28/32 | 4 | 32/32 | +12,5 puntos porcentuales |
| Tokio, primeras imágenes `-800w` | 2.969.990 B | 173.712 B | 3.143.702 B | +5,85 % |
| Osaka, primeras imágenes `-800w` | 3.061.974 B | 34.896 B | 3.096.870 B | +1,14 % |

Ambos hubs permanecen bajo el contrato de 3.500.000 B. El registro final tiene 167 imágenes
para 161 lugares. Para estos cuatro lugares quedan fuera de alcance y pendientes de bloques
posteriores las fotos `experience` (B6.4) y la tercera imagen complementaria (B6.5).

## Validación

| Gate | Resultado |
|---|---|
| Baseline exacto de cuatro IDs S | PASS — conjunto fijado y revalidado |
| `scripts/validate-photography.py` | PASS |
| `scripts/test_photography.py` | PASS — 38/38 |
| `scripts/test_photography_rendition.py` | PASS — 28/28 |
| `scripts/test_block22_photography.py` | PASS — 8/8 |
| `build-photography-derivatives.py --check --quiet` | PASS — 167 registros, 400w + 800w + LQIP |
| Vitest enfocado (`place-images`, depth, derivatives) | PASS — 48/48, 3/3 archivos |
| `npm run build` | PASS — sólo aviso heredado de chunk >500 kB |
| `npm run lint` | PASS |
| Auditoría B20/B2 en Edge, phone/tablet/desktop | PASS — 81/81 |
| `npx vitest run` completo | 3301/3315 PASS; 14 fallos en 8/96 archivos |

Los 14 fallos de la suite completa no tocan archivos de B6.1 y reproducen fragilidad heredada
del checkout Windows: tres lecturas construyen `C:\\C:\\...`; varios source-string tests esperan
LF literal sobre archivos CRLF; y el parser textual de `feb-mar-status` no reconoce el cuerpo
Python con estos saltos de línea. Desglose: `block17-design-foundation` (3), `block18-shell` (4),
`DivergenceView` (1), `OrderedSequenceBuilder.local-swap` (1),
`OrderedSequenceBuilder.interior-transposition` (1), `PlaceCard` (2), `feb-mar-status` (1) y
`bundle-architecture` (1). No se relajaron ni modificaron esos gates. Los tests directamente
afectados por fotografía, el build y la auditoría real de navegador sí pasan.

No quedó ningún gate solicitado sin ejecutar: Chromium estaba disponible mediante Microsoft Edge.

## Archivos y alcance

- Pipeline/gates: `scripts/build-photography-derivatives.py`,
  `scripts/validate-photography.py`, `scripts/test_photography.py`,
  `scripts/test_photography_rendition.py`, `scripts/test_block22_photography.py`,
  `scripts/prepare-block22-photography-foundation.py` y
  `scripts/prepare-block22-b6-1-photography-metadata.py`.
- Datos: las dos copias de `photography-metadata.json`, el baseline y el plan B6.1.
- Assets: 163 nuevas derivadas históricas `-400w` y 12 archivos de los cuatro objetivos
  (principal, `-400w`, `-800w`).
- Tests de consumo: `place-images.test.ts`, `photography-depth.test.ts` y
  `photography-derivatives.test.ts`.
- Documentación: este informe y `docs/BLOCK_22_B6_1_HANDOFF.md`.

B6.2 no empezó. B21, `docs/CURRENT_WORK_HANDOFF.md`, `main`, las ramas `claude/*` y todo código o
documentación Astra quedaron intactos.
