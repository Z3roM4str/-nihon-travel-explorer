# Bloque 25 — B7 «Quiero ir» · Handoff

Misión: `docs/BLOCK_25_MISSION.md`. Contrato: `docs/design/05 §6`, `10 §B7`.

## Estado: B25 CERRADO en rama (PR draft, sin merge)

| Campo | Valor |
|---|---|
| Rama | `claude/b25-quiero-ir` |
| Base | `origin/main` @ `88a741d4d1a84f69e7b85a82ba0328e9acc940ce` (verificado, sin discrepancia) |
| `main` | no modificado |
| Astra / Vercel / PR #153 / #154 | no mezclados |

## Arquitectura

**Antes.** `SelectionPanel` = panel plegable (▾▴) con dos métricas donde la duración era la cifra
grande, frase de recuento de B5, barra de filtros de B6 (`ShortlistFilterBar`), lista plana con
«×» por fila y dos botones «Analizar selección» / «Construir recorrido». `SelectionAnalysis` se
mostraba debajo al pulsar «Analizar selección» (modal en origen, `embedded` desde B18).

**Después.**
- `lib/quiero-ir.ts` (puro): reparte la lista en secciones leyendo `divergenceEntries` y
  `summarizeInterest` sin recalcular nada; `travellerYetToMark` para el estado de una persona.
- `SelectionPanel.tsx` = pantalla de `05 §6`: segmentado (`role="radiogroup"`, flechas/Home/End)
  · resumen de tres datos del mismo tamaño con `EvidenceMark ◇` y nota «Sólo tiempo dentro de
  cada lugar» · «Los dos queréis ir (N)» primero y sin plegar (`PlaceCard compact`, token
  bermellón y borde `--person-both`) · «Sólo {nombre}» plegables con `PersonToken` y color de
  persona · «Opiniones distintas» y «Sin reclamar» (B6, separados) · «Por ciudad y zona» ·
  «Descartados» plegado · «Llevar al viaje» `primary lg` anclado. Agrupación secundaria por ciudad
  dentro de cada sección cuando hay más de una.
- Contador en la cabecera de pantalla (`h1`), sólo en Quiero ir y sólo si > 0.
- `SelectionAnalysis.tsx`: sin cabecera «Tu selección», sin cierre, sin `role="dialog"`, sin
  trampa de foco; es el contenido de «Por ciudad y zona» con el mismo cálculo (`lib/selection`)
  sobre los lugares que muestra la lente.
- `useTravellers`: lecturas `declinedIds`, `snapshotActiveInterest` y `restoreInterest`
  (`withRestoredInterest`, pura). Nada de `withStance`/`withToggledInterest` cambia.
- `SaveToast`/`useSaveFeedback`: acción opcional «Deshacer» (`04 §16`).

## Comportamiento

- **Segmentado**: estado de vista (`useState`), no persistido; nunca llama a
  `setActiveTraveller`. Lente de persona = lugares con su postura `interested` (Descartados: su
  `not-interested`); «Sin reclamar» sólo en «Los dos».
- **Quitar**: el corazón de la tarjeta (persona activa). Si era suyo → `removeSaved` (sólo su
  postura) + Toast «{lugar} ya no está en Quiero ir» con «Deshacer»; el foco va a «Deshacer»,
  Escape lo descarta, el temporizador (6 s) se pausa con puntero o foco. «Deshacer» restaura el
  documento exacto (posición incluida) sin tocar lo que la otra persona haya dicho entretanto, y
  devuelve el foco al corazón del lugar. Si no era suyo → marcar (semántica de corazón intacta).
  Gesto de deslizar: no existe en el producto; no se ha añadido (el botón cubre táctil, puntero y
  teclado).
- **Vacíos**: vacío completo = `EmptyState` con el texto de `05 §6` + «Explorar Tokio» (Explorar ›
  Tokio). Una sola persona ha marcado = línea «Cuando {nombre} marque sus sitios, aquí veréis en
  qué coincidís.» en lugar de «Los dos» vacía. Nombres siempre del documento de viajeros.
- **Llevar al viaje** = `goToPlanner` existente; no toca preferencias ni planifica nada.
- **Ficha**: `selectPlace(id, "quiero-ir")` (DD-015) — se apila dentro de Quiero ir; cerrar o
  browser back vuelven con la misma lente, secciones y scroll (el panel nunca se desmonta).

## Puertas (finales, sobre `511c456` + docs)

| Puerta | Resultado |
|---|---|
| `git diff --check` | limpio |
| build | PASS (sólo el aviso heredado de tamaño de chunk) |
| lint | 0 errores, 1 warning heredado `PlaceMap.tsx:17` |
| Vitest | **3395/3395** (baseline 3384; +12 `lib/quiero-ir.test.ts`, −1 caso de B18 que exigía que `SelectionAnalysis` aceptara `embedded`) |
| `b25-quiero-ir-check.mjs` (nuevo) | **123/123** (390×844 y 1440×900 comportamiento; 320/360/390/430/768/1440 layout) |
| `integration-b24-b23-check` | 58/58 (Phase 5A 50/50 ×2 dentro) |
| Phase 5A desktop / mobile | 50/50 · 50/50 |
| B23 photo retry | 28/28 |
| DD-028 | 16/16 |
| `b18-browser-back-check` | 15/15 (selectores actualizados al marcado nuevo) |
| `b18-viaje-lugar-check` | 38/38 |

**Gates B5/B6 (antes omitidos) — actualizados y ejecutados en la certificación:**
`block5-travellers-browser-audit.mjs` 231/231 y `block6-divergence-browser-audit.mjs` 177/177
(Chromium `--browser=/opt/pw-browsers/chromium`). Sus contratos siguen vigentes; sólo cambió el
marcado: contador → insignia de la pestaña; frase de recuento/marcador por fila → secciones con
contador y filas `[data-quiero-ir-place]`; chips de B6 → secciones + segmentado (radiogroup,
flechas, anillo, 44 px); «Construir recorrido» → «Llevar al viaje». B6 ya estaba desfasado antes
de B25 (cambio de persona en Explorar retirado por DD-007, `×` de la ficha retirado en B20).
Ningún contrato se retiró. pytest no aplica (sin `.py` tocados).

## Auditoría visual (Chromium, 320/360/390/430/768/1440)

Corregido durante la auditoría: `h2` «Quiero ir» duplicaba el título de la cabecera (el contador
pasó a la cabecera); la cifra de duración en rojo de 20 px dentro del reparto competía con el
resumen (bajada a cuerpo `--ink-900`); flecha ↑/↓ en plegables (sustituida por chevron de línea);
nombres largos en el segmentado se recortan con elipsis y conservan el nombre completo en el texto
accesible y `title`. Sin overflow horizontal, CTA siempre dentro de la pantalla y sin tapar la
última fila, objetivos ≥44 px, columna acotada a 640 px en escritorio.

## Deudas restantes

- «Fotografía suave» del estado vacío (`05 §6`): se usa el icono de `EmptyState`; elegir la
  fotografía es decisión editorial → **B10**.
- Con rangos largos, el tercer dato del resumen baja a una segunda línea en ≤430 px (mismo
  tamaño, sin recorte) → revisar en **B10** (pulido).
- `ShortlistFilterBar.tsx` queda sin uso en la app (sus tests de B6 siguen); retirarlo → **B10**.
- Frases de concentración heredadas del análisis («de tus N guardados») hablan en singular →
  **B10** (copy).
- Pendiente humano heredado: iPhone real (scroll táctil, teclado iOS).

## Certificación contra `main` vigente (2026-09-28)

- `origin/main` @ `98260eb` (PR #153, freeze Vercel: README, `app/vercel.json`,
  `docs/DEPLOYMENT_POLICY.md`) incorporado por merge normal sin conflictos (merge `de79f87`).
- Corregido: la nota «Ya está en un día del recorrido» salía atrasada al llegar a Quiero ir por la
  barra desde Viaje (`selectDestination` refresca la foto de sólo lectura, gate B6-G);
  `quiero-ir.test.ts` comprobaba el titular con un selector inexistente (pasaba vacío) → ahora lee
  el `h1.app__title` real y exige encontrarlo.
- Puertas tras el merge: build PASS, lint 0 errores, Vitest 3395/3395, B25 123/123, integración
  58/58, Phase 5A 50/50 desktop y móvil, B23 28/28, DD-028 16/16, B18 back 15/15, B5 231/231,
  B6 177/177.
