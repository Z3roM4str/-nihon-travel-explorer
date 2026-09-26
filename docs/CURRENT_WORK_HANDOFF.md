## Rama paralela: cierre de pruebas B6.7 (test-alignment, no producto)

**Rama:** `claude/block-22-b6-7-test-closure`, creada desde
`origin/codex/block-22-b6-7-grade-a-depth-photography` @ `4afbf50e9d1e3137f9148c6c471c1c40aac6a56f`
(tip de B6.7: commits `8601a9d` y `4afbf50`, "feat(photography): add B6.7 depth batch 1/2"). Esta
rama **no** es una integración de producto: es una misión de alineación de pruebas, en paralelo a
este handoff, que corrige expectativas de test desactualizadas tras B6.7. No toca `main`, no
mezcla B23/B24/"B6.5 timing fix", no usa Astra y no abre PR.

- Vitest antes: 3321/3329 (8 fallos en `place-images.test.ts` y `photography-depth.test.ts`).
  Después: 3329/3329.
- Phase 5A gate antes: 47/50 (A06, A07, E01 fallando). Después: 50/50, en escritorio y móvil.
- Detalle completo, causa raíz de cada fallo, y evidencia normativa: ver
  `docs/BLOCK_22_B6_7_TEST_CLOSURE.md`.
- Solo se tocaron archivos de test, el script de gate `app/scripts/phase5a-rc-browser-audit.mjs`,
  y documentación. Ningún archivo de producto, componente, o dataset fue modificado.

---

# Handoff reanudable — B21 + B6.1–B6.6

**Última actualización:** 2026-09-24. La autoridad normativa es `docs/design/`. Astra es una línea separada y no forma parte de este trabajo.

## Estado actual — B6.6 integrado

**Última actualización:** 2026-09-24. La autoridad normativa sigue siendo `docs/design/06_ESTRATEGIA_FOTOGRAFICA.md`.

- B21 cerrado; B6.1–B6.6 integrados y cerrados. B6.6 se integró mediante PR #148.
- **Rama B6.6:** `codex/block-22-b6-6-grade-cd-identity-photography` @ `5d5956c649b9fcf7e15890ae5598deb807853cdd`. **SHA base:** `f74281a75cefe5f45469e1db84e5d4350110dba5`; merge commit `c5286844571ebe351119ece0987a0cc0917a6684`.
- Gate C/D derivado desde los datos: C **6 total, 0/6 → 5/6**; D **4 total, 0/4 → 3/4**. Targets reales: 10; adquiridas 8 identities; unresolved 2 (JP-104, JP-178, copyright del sujeto).
- Registro B6.6: **233 imágenes / 202 lugares con fotografía**. C 5/6 y D 3/4. S permanece identity **32/32**, experience **17/32**, complementary **14/32**; A **139/147 + 8 excepciones**; B **23/25 + 2 excepciones**.
- Gates B6.2–B6.6, validator, pruebas de fotografía/rendition/Block22 y derivados `--check` PASS. Build PASS; lint exit 0 con el warning heredado `PlaceMap.tsx:14`; Vitest 100 archivos, 3329/3329; browser audit B6.6 PASS 316/316 en móvil y escritorio.
- Presupuesto identity 800w: Tokio 3.499.770 B; Kioto 3.499.450 B; Osaka 3.356.478 B; Okinawa 2.903.352 B; Sapporo 166.986 B; Nagoya 69.552 B; Fukuoka 69.284 B. Todas las listas quedan bajo 3.500.000 B. `app/src/data/place-images.ts` conserva SHA-256 `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb`.
- `main` sigue intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`; Astra no se usó y no hubo rediseño de UI.
- **Siguiente bloque:** segunda imagen para lugares Grado A de “Popular / turístico” y “Hidden Gem real”. No iniciado.

## Snapshot de cierre B6.4 — base de B6.5

- B21 cerrado; B6.1 cerrado; B6.2 integrado y cerrado; B6.3 integrado y cerrado.
- **B6.4 integrado y cerrado con 15 excepciones documentadas** mediante PR #146. Rama fuente `codex/block-22-b6-4-grade-s-experience-photography` @ `f22ce0c33534b5ac457a9826c4eb165e97b40b0c`; merge commit `53d4d26dc22d3e214481af823e280a3ad479c11a`.
- Base canónica B6.4: `ad456be50e6b855bc79204bc50d26b154eb29441`. SHA final certificado de la rama B6.4: `f22ce0c33534b5ac457a9826c4eb165e97b40b0c`; el informe completo está en `docs/BLOCK_22_B6_4_REPORT.md`.
- Gate inicial: **32/32 S con identity; 2/32 ya tenían experience; 30 objetivos reales**. Resultado: 15 nuevas experience y 15 unresolved documentados; cobertura final **17/32 S con experience**. Las 32 identities iniciales siguen intactas.
- Registro: **215 imágenes / 194 lugares**. Grado A permanece **139/147 + 8 excepciones**; Grado B permanece **23/25 + 2 excepciones**.
- Validator PASS; fotografía 40/40; rendition 28/28; Block 22 8/8; B6.2 11/11; B6.3 8/8; B6.4 9/9; derivados 215 PASS; build PASS; lint exit 0 con warning heredada `PlaceMap.tsx:14`; Vitest 100 archivos, 3328/3328; browser audit **462/462**, 0 fallos.
- Listas: máximo completo Tokio **3.421.914 B**, bajo 3.500.000 B; ningún hub muestreado solicita experience. `place-images.ts` permanece byte a byte intacto. No se tocó `main`, no hubo rediseño, Astra ni merge.
- **Siguiente bloque:** tercera foto complementaria para Grado S (`detail`, `context` o `seasonal` según el lugar). No iniciado.

## Snapshot histórico al cierre de B6.3

- **B21 cerrado; B6.1 cerrado; B6.2 integrado y cerrado** mediante PR #143, con ocho excepciones Grado A preservadas.
- **B6.3 integrado y cerrado con 2 excepciones documentadas** mediante PR #145. Rama fuente `codex/block-22-b6-3-grade-b-photography` @ `8d1752f945ff4b7594a490a6df4ab23324f597a5`; merge commit `eafcd61964bda9c462a27df5779d404aa23c4e9e`. Informe: `docs/BLOCK_22_B6_3_REPORT.md`.
- Gate inicial derivado: Grado B **25 total / 17 con foto / 8 sin foto**. Se adquirieron seis identidades (JP-107, JP-140, JP-150, JP-166, JP-199, JP-209); JP-041 y JP-171 son excepciones documentadas. Cobertura final **23/25 Grado B + 2 excepciones**; **200 imágenes / 194 lugares**.
- Grado A permanece **139/147 + 8 excepciones** (JP-050, JP-079, JP-095, JP-120, JP-121, JP-168, JP-195, JP-202). Grado S permanece **32/32**.
- Validator PASS; Python 40/40, rendiciones 28/28, Block 22 8/8, B6.2 11/11, B6.3 8/8; derivados 200 PASS; build PASS; lint exit 0 con warning heredada `PlaceMap.tsx:14`; Vitest 100 archivos, 3328/3328; navegador B6.3 216/216 móvil/escritorio.
- Al corte de B6.3, B6.4 aún no se había iniciado. El estado vigente está en la sección superior.

| Campo | Estado |
|---|---|
| B21 | **CERRADO** |
| B6.1 | **INTEGRADO Y CERRADO** (vía PR #141) |
| B6.2 | **INTEGRADO Y CERRADO CON 8 EXCEPCIONES DOCUMENTADAS** — 27/35 objetivos adquiridos; 8 excepciones conservan PhotoPlaceholder e imageBrief. Integrado vía PR #143. Informe: `docs/BLOCK_22_B6_2_REPORT.md` |
| B6.3 | **INTEGRADO Y CERRADO CON 2 EXCEPCIONES DOCUMENTADAS** — 6/8 objetivos adquiridos; JP-041 y JP-171 conservan PhotoPlaceholder. Integrado vía PR #145. Informe: `docs/BLOCK_22_B6_3_REPORT.md` |
| B6.4 | **INTEGRADO Y CERRADO CON 15 EXCEPCIONES DOCUMENTADAS** — 15 nuevas `experience`; cobertura S experience 17/32. Integrado vía PR #146. Informe: `docs/BLOCK_22_B6_4_REPORT.md` |
| B6.5 | **INTEGRADO Y CERRADO CON 18 EXCEPCIONES DOCUMENTADAS** — 10 nuevas complementarias (`detail/context/seasonal`); cobertura complementaria S 14/32. Integrado vía PR #147. Informe: `docs/BLOCK_22_B6_5_REPORT.md` |
| B6.6 | **INTEGRADO Y CERRADO CON 2 EXCEPCIONES DOCUMENTADAS** — 8 identities nuevas para C/D; JP-104 y JP-178 unresolved por copyright de sujeto. Integrado vía PR #148. Informe: `docs/BLOCK_22_B6_6_REPORT.md` |
| Rama B6.3 | `codex/block-22-b6-3-grade-b-photography` @ `8d1752f945ff4b7594a490a6df4ab23324f597a5` (conservada) |
| Rama B6.2 | `codex/block-22-b6-2-grade-a-photography` @ `f8115b67b0fe1aa8986e418cd34f2fb4fed96639` (conservada) |
| SHA de cierre B6.2-R | `f8115b67b0fe1aa8986e418cd34f2fb4fed96639` |
| Cobertura Grado A | **139/147 con fotografía + 8 excepciones documentadas**: JP-050, JP-079, JP-095, JP-120, JP-121, JP-168, JP-195, JP-202 |
| Registro | **233 imágenes / 202 lugares**; C **5/6**, D **3/4**; Grado S identity **32/32**; Grado S experience **17/32**; cobertura complementaria S **14/32**; Grado A **139/147 + 8 excepciones**; Grado B **23/25 + 2 excepciones** |
| Grado S | **32/32** |
| Rama canónica | `codex/block-21-b5-explore-home-map` @ `c5286844571ebe351119ece0987a0cc0917a6684` — PR #148 merged |
| `main` | intacto (`8eb725e`), sin PR abierto hacia `main` |
| Siguiente paso | **Segunda imagen para lugares Grado A de “Popular / turístico” y “Hidden Gem real”. NO iniciado.** |

## Integración B6.6 en la rama canónica

- PR #148: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.6: `5d5956c649b9fcf7e15890ae5598deb807853cdd`.
- Merge commit: `c5286844571ebe351119ece0987a0cc0917a6684`.
- El tree del merge commit coincide con el tree del head certificado B6.6; no hubo cambios de contenido adicionales durante el merge.
- Estado integrado: **C 5/6; D 3/4; 8 identities nuevas; 2 excepciones documentadas; 233 imágenes / 202 lugares; S identity 32/32; S experience 17/32; S complementaria 14/32; A 139/147 + 8 excepciones; B 23/25 + 2 excepciones**.
- El pipeline regeneró 38 rendiciones identity `-800w` existentes para mantener todos los hubs bajo 3.500.000 B; originales y `-400w` permanecen intactos.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- El siguiente bloque permitido es la segunda imagen para lugares Grado A de “Popular / turístico” y “Hidden Gem real”; no iniciado.

## Integración B6.5 en la rama canónica

- PR #147: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.5: `4ad32973744263043def217b4a65934a9be925ce`.
- Merge commit: `241d0a88fed2f07b17854a04e7b2395fb5cb2950`.
- El tree del merge commit coincide con el tree del head certificado B6.5; no hubo cambios de contenido adicionales durante el merge.
- Estado integrado: **10 nuevas complementarias; cobertura complementaria S 4/32 → 14/32; S identity 32/32; S experience 17/32; 225 imágenes / 194 lugares; A 139/147 + 8 excepciones; B 23/25 + 2 excepciones**.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- El siguiente bloque permitido es identity para los lugares Grado C/D que siguen sin fotografía; no iniciado.

## Integración B6.4 en la rama canónica

- PR #146: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.4: `f22ce0c33534b5ac457a9826c4eb165e97b40b0c`.
- Merge commit: `53d4d26dc22d3e214481af823e280a3ad479c11a`.
- El tree del merge commit coincide con el tree del head certificado B6.4; no hubo cambios de contenido adicionales durante el merge.
- Estado integrado: **S identity 32/32; S experience 17/32 + 15 excepciones documentadas; 215 imágenes / 194 lugares; A 139/147 + 8 excepciones; B 23/25 + 2 excepciones**.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- El siguiente bloque permitido es la tercera fotografía complementaria para Grado S (`detail`, `context` o `seasonal`); no iniciado.

## Integración B6.3 en la rama canónica

- PR #145: **merged** el 2026-09-24 hacia `codex/block-21-b5-explore-home-map`.
- Head certificado B6.3: `8d1752f945ff4b7594a490a6df4ab23324f597a5`.
- Merge commit: `eafcd61964bda9c462a27df5779d404aa23c4e9e`.
- El tree del merge commit coincide con el tree del head certificado B6.3; no hubo cambios de contenido adicionales durante el merge.
- Estado integrado: **23/25 Grado B con fotografía + 2 excepciones documentadas; 200 imágenes / 194 lugares; Grado A 139/147 + 8 excepciones; Grado S 32/32**.
- `main` permanece intacto en `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
- El siguiente bloque fotográfico será la segunda imagen `experience` para los 32 lugares Grado S; no iniciado.

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

B6.2, B6.3, B6.4, B6.5 y B6.6 están integrados y cerrados en la rama canónica. B6.6 se integró mediante PR #148 con 8 nuevas identities C/D y 2 excepciones documentadas; véase `docs/BLOCK_22_B6_6_REPORT.md`. El próximo bloque permitido es la segunda imagen para lugares Grado A de “Popular / turístico” y “Hidden Gem real”; no iniciado.
