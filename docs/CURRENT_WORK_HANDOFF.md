# Handoff reanudable — B21 + B6.1 + B6.2 + B6.3

**Última actualización:** 2026-09-24. La autoridad normativa es `docs/design/`. Astra es una línea separada y no forma parte de este trabajo.

## Estado actual B6.3

- **B21 cerrado; B6.1 cerrado; B6.2 integrado y cerrado** mediante PR #143, con ocho excepciones Grado A preservadas.
- **B6.3 implementado y certificado, pendiente de integración** en `codex/block-22-b6-3-grade-b-photography`, desde la base canónica `80f638ae68e88ad62d8c706d75c3aa107b27f4f2`. SHA de cierre: el HEAD publicado de esta rama (`git rev-parse codex/block-22-b6-3-grade-b-photography`); el informe es `docs/BLOCK_22_B6_3_REPORT.md`.
- Gate inicial derivado: Grado B **25 total / 17 con foto / 8 sin foto**. Se adquirieron seis identidades (JP-107, JP-140, JP-150, JP-166, JP-199, JP-209); JP-041 y JP-171 son excepciones documentadas. Cobertura final **23/25 Grado B + 2 excepciones**; **200 imágenes / 194 lugares**.
- Grado A permanece **139/147 + 8 excepciones** (JP-050, JP-079, JP-095, JP-120, JP-121, JP-168, JP-195, JP-202). Grado S permanece **32/32**.
- Validator PASS; Python 40/40, rendiciones 28/28, Block 22 8/8, B6.2 11/11, B6.3 8/8; derivados 200 PASS; build PASS; lint exit 0 con warning heredada `PlaceMap.tsx:14`; Vitest 100 archivos, 3328/3328; navegador B6.3 216/216 móvil/escritorio.
- No se integró B6.3, no se tocó `main`, no se cambió UI ni se inició trabajo Astra. Después de integrar B6.3, el siguiente paso será una segunda imagen `experience` para los 32 lugares Grado S; **no iniciado**.

| Campo | Estado |
|---|---|
| B21 | **CERRADO** |
| B6.1 | **INTEGRADO Y CERRADO** (vía PR #141) |
| B6.2 | **INTEGRADO Y CERRADO CON 8 EXCEPCIONES DOCUMENTADAS** — 27/35 objetivos adquiridos; 8 excepciones conservan PhotoPlaceholder e imageBrief. Integrado vía PR #143. Informe: `docs/BLOCK_22_B6_2_REPORT.md` |
| B6.3 | **IMPLEMENTADO Y CERTIFICADO, PENDIENTE DE INTEGRACIÓN** — 6/8 objetivos adquiridos; JP-041 y JP-171 conservan PhotoPlaceholder. Informe: `docs/BLOCK_22_B6_3_REPORT.md` |
| Rama B6.3 | `codex/block-22-b6-3-grade-b-photography` @ HEAD publicado de la rama |
| Rama B6.2 | `codex/block-22-b6-2-grade-a-photography` @ `f8115b67b0fe1aa8986e418cd34f2fb4fed96639` (conservada) |
| SHA de cierre B6.2-R | `f8115b67b0fe1aa8986e418cd34f2fb4fed96639` |
| Cobertura Grado A | **139/147 con fotografía + 8 excepciones documentadas**: JP-050, JP-079, JP-095, JP-120, JP-121, JP-168, JP-195, JP-202 |
| Registro | **200 imágenes / 194 lugares**; Grado B **23/25 + 2 excepciones**; Grado S **32/32** |
| Grado S | **32/32** |
| Rama canónica | `codex/block-21-b5-explore-home-map` @ `80f638ae68e88ad62d8c706d75c3aa107b27f4f2` — PR #143 merged y handoff B6.2 |
| `main` | intacto (`8eb725e`), sin PR abierto hacia `main` |
| Siguiente paso | **Integrar B6.3 tras revisión; luego segunda imagen `experience` para los 32 Grado S.** |

## Integración B6.2 en la rama canónica

- PR #143: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.2: `f8115b67b0fe1aa8986e418cd34f2fb4fed96639`.
- Merge commit: `abe9941bcda926f0d3ee44f1ae86bcab48873855`.
- El tree del merge commit es `f1e25a68735d2f8a12867e749e8acdf945e7b2d4`, idéntico al tree del head certificado B6.2; el merge no introdujo cambios de contenido adicionales.
- Estado integrado: **139/147 Grado A con fotografía + 8 excepciones documentadas; 194 imágenes / 188 lugares; Grado S 32/32**.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- B6.3 no se inició durante esta integración.

## B6.2 — verificación de cierre (2026-09-24, Linux)

- Adquisición vía `acquire-photography.py` + `prepare-block22-b6-2-photography-metadata.py` (contrato Block 2), 4 batches con commit y push cada uno; `place-images.ts` sin cambios (SHA-256 `6e690411…af9d`, igual a la base).
- Presupuesto al cierre original de B6.2, antes de recuperar JP-156: Tokio superó 3,5 MB tras el batch 1 (3.886.132 B). Corregido en el pipeline: `-800w` > 70.000 B baja calidad en pasos de 4 hasta 48. Entonces: Tokio 3.421.914, Kioto 3.408.406, Osaka 2.960.618, Okinawa 2.740.472 B. 82 `-800w` preexistentes re-codificadas. El presupuesto final tras B6.2-R aparece en la fila de resultado.
- `validate-photography.py` PASS; Python fotografía 40/40, rendiciones 28/28, Block 22 8/8, B6.2 11/11; derivados `--check` PASS (194), `select-block22-b6-2-targets.py --check` PASS (35).
- `PD-self` se normaliza como `Public Domain` con `licenseBasis: PD-self`, procedencia Commons y sin `licenseUrl`; no se inventó un enlace.
- Build PASS; lint exit 0 (1 advertencia heredada `PlaceMap.tsx:14`); Vitest 100 archivos, 3328/3328.
- Navegador: B6.2 250/250 (7 lugares nuevos en 4 hubs, con JP-156, teléfono/escritorio y fallbacks), B20 73/73, Block 2 81/81.
- Resultado: 194 imágenes / 188 lugares, 139/147 Grado A con fotografía + 8 excepciones documentadas. Presupuesto `-800w`: Tokio 3.421.914, Kioto 3.408.406, Osaka 2.960.618, Okinawa 2.796.354 B; todos bajo 3.500.000 B.
- Brecha heredada anotada: el UI aún no pinta `lqip` (usa `place-card__skeleton`); fuera de alcance por la regla de cero cambios de UI.

## Historial B21 + B6.1
## Verificación post-merge (2026-09-24, Linux)

- Build PASS; lint exit 0 (1 advertencia heredada Fast Refresh `PlaceMap.tsx:14`); Vitest 100 archivos, 3327/3327.
- Gate B21 búsqueda global 33/33 móvil y 33/33 escritorio: consulta preservada, resultados preservados, scroll preservado, portada nacional preservada, UI back, browser back y Cerca de aquí. En el contenedor, el escritorio requirió el binario Chromium completo 1194; el headless shell 1194 (desfasado frente al 1234 esperado por Playwright) no restaura el scroll en escritorio (360→0), sin cambios de código.
- Phase 5A 50/50 escritorio y 50/50 móvil.
- Fotografía: 167 imágenes, 161 lugares con foto, 32/32 Grado S; `validate-photography.py` PASS; `build-photography-derivatives.py --check --quiet` PASS; `test_block22_photography.py` 7/8 en Linux: el único fallo compara el SHA-256 de `app/src/data/place-images.ts` contra una línea base calculada con CRLF (Windows). El archivo es byte a byte idéntico a B6.1 `e6693a4`; fallo heredado dependiente de plataforma.

## Historial de la certificación previa (#141)

La historia remota de #141 contiene un solo commit posterior a la base B21. El SHA B6.1 no es ancestro del PR, pero los archivos de fotografía consolidados coinciden por contenido con la fuente. No existe remotamente `integration/b21-b6-1`; los checkpoints locales antes citados no representan commits publicados por separado. Véase `docs/B21_B6_1_INTEGRATION_REPORT.md` para el diff, los gates y la evidencia.

## Certificación técnica de esta auditoría

- Fotografía: 167 imágenes, 161 lugares, 32/32 S; `validate-photography.py` PASS; Python 38/38, 28/28 y 8/8; derivados 400/800 px PASS.
- Frontend: build PASS; lint código 0 con una advertencia de Fast Refresh; Vitest 100 archivos, 3327/3327. La advertencia Fast Refresh de `PlaceMap.tsx:14` es heredada de la base B21; la afirmación anterior de 0 warnings era incorrecta.
- Gates heredados: B17, B18, B19, B20, DDR-03, Block 1 UX, Block 2 Photography, Phase 5A RC y seis auditorías Phase 4 Photography ejecutados; resultados individuales en el informe.
- Navegador B21: portada, búsqueda, mapas, fotografía local, ficha y responsive comprobados en 390×844, 1440×900 y 1600×900; raíl xl 31,7 % del cuerpo; sin overflow, errores de consola o fetch fotográfico externo.
- **B21 corregido:** `exploreDetailReturnRef` identifica explícitamente la ficha abierta desde búsqueda global; no cambia el hub subyacente. `Sheet` restaura `.sheet__body.scrollTop` desde un ref y `focus({ preventScroll: true })` evita el reset posterior. El cierre explícito limpia el contexto; la búsqueda de ciudad conserva su comportamiento.
- **Gate B21 permanente:** `b21-global-search-browser-audit.mjs` PASS 33/33 en móvil y 33/33 en escritorio; UI back, browser back y cadena Cerca de aquí restauran consulta `a`, 214 resultados y scroll 360→360 tras dos frames. La portada nacional sigue subyacente, el cierre vuelve a portada y Buscar en Tokio no hereda retorno global.
- **Regresión repetida tras el arreglo:** B18 browser back 15/15, regression 40/40; B19 discovery 30/30, grid 52/52; B20 73/73; DDR-03 43/43; Block 1 UX 153/153; Phase 5A desktop/mobile 50/50 cada uno. Build PASS, lint exit 0 con una advertencia heredada, Vitest 100 archivos/3327 tests. Fotografía B6.1 sin cambios; se conserva toda su evidencia anterior.

## Estado de entrega

B6.2 está integrado y cerrado en la rama canónica mediante PR #143, con ocho excepciones documentadas. B6.3 queda implementado y certificado en su rama propia, pendiente de integración, con seis fotos nuevas y dos excepciones honestas.
