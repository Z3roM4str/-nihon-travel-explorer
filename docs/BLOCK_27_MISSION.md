# MISIÓN B27 — B9.1 «Días como estructura» · Nihon

Bloque 27 del repositorio = **B9.1** del roadmap (`docs/design/10 §B9`), únicamente. **No es B9
completo.** Autoridad normativa: `docs/design/` (00–10). Contratos: `05 §7` (Viaje — Días),
`04 §14` (`DayTimeline`/`TripStop`), `02 §D5` (Viaje añade columna «Sin asignar» en `lg`), DD-015
(ficha apilada dentro de Viaje).

## Baseline

- Rama: `claude/b27-viaje-b9-1-dias`, creada desde `origin/main` @
  `eab63a8af34c8e0474340eba4687766be979933b` (verificado con `git fetch origin`: coincide). Árbol limpio
  al crear la rama.
- Baseline medido antes de tocar código: build PASS · lint 0 errores + 1 warning heredado
  (`PlaceMap.tsx:17`) · Vitest 107 ficheros, **3415/3415**. Los gates de navegador se midieron sobre una
  copia congelada del árbol base (ver `docs/BLOCK_27_HANDOFF.md §Baseline de gates`).
- No se usa como base: ramas históricas, Astra, PR #154, Vercel.

## Alcance B9.1 (lo que este bloque hace)

Viaje › Días abre directamente mostrando **días** (no un recorrido plano):

1. Cabecera «Viaje» + rango de fechas, o «Poner fecha de inicio».
2. **Una** línea de encuadre con `EvidenceMark ✎` en lugar de las cajas de descargo.
3. `DayTimeline` por día: cabecera «Día N · fecha · ciudad», duración de visitas, nº de paradas.
4. `TripStop`: miniatura (rendición `-400w`, `06 §7`), nombre, duración, conector, `EvidenceMark`.
5. Conectores: traslado registrado o «Traslado sin datos» (nunca rojo, nunca `?`).
6. Pie de día: «Dormís en {zona}» / «Sin alojamiento elegido».
7. Fila de traslado entre ciudades (`InterHubSegment`, sin recalcular).
8. Cajón «N sitios sin día» (teclado; columna en `lg`).
9. «Añadir día» (misma mutación de identidad estable).
10. Retirada del trío `↑ ↓ ×` por fila, con sustituto para cada capacidad (ver handoff).
11. Sub-navegación de Viaje: `Días · Dónde dormir · Reservas · Resumen`; Días es la de apertura.

## Exclusiones (NO se hacen aquí)

| Subbloque | Responsable de | Estado en B27 |
|---|---|---|
| B9.2 | arrastrar y soltar; sistema completo de reordenación y «Mover a…» | **No** hay drag. Sólo el mínimo «Mover a…» como puente de conservación de capacidad. |
| B9.3 | «Probar otro orden» local al día | La comparación A/B y las alternativas verificadas siguen alcanzables con su UI actual. |
| B9.4 | Dónde dormir: sin ordinales, fotos de zona, hecho/cálculo/opinión | `ZoneComparison` intacta. |
| B9.5 | Reservas y Resumen propios; **retirada de `Dato:`**; timeline comprimida | `Dato:` **se conserva**. Reservas/Resumen sólo re-alojan las secciones existentes, sin rediseño. |

### Corrección de scope heredada de `BLOCK_26_HANDOFF.md` (para que no vuelva a propagarse)

`docs/BLOCK_26_HANDOFF.md` (párrafo «B9.1 — objetivo exacto») dice que B9.1 retira `Dato:` (DDR-05,
«sustituido por texto entre comillas con `◧ Registrado`»). **Es una imprecisión.**
`docs/design/10_ROADMAP_DE_BLOQUES.md` asigna explícitamente a **B9.5** «se elimina `Dato:`» y la
DDR-05 (resuelta) dice que la retirada «sigue siendo de este bloque» refiriéndose a B9 con su reparto
por subbloques, cuyo punto es B9.5. **B27/B9.1 no elimina `Dato:`, no reescribe Reservas y no convierte
textos a `◧ Registrado`.** La corrección se repite en `docs/BLOCK_27_HANDOFF.md`.

## Invariantes (no cambian)

Algoritmo de traslados · identidad estable de día · asignación por días · `startDate`/`endDate` · anclaje
de calendario · límites del viaje · mecanismos de reserva · fechas oficiales · composición del viaje
entero · alternativas verificadas · comparación de órdenes · datos de alojamiento · modelo
`InterHubSegment` · planificación V8 · clave `nihon.manualPlanningDraft` · formato de backup portátil.
Nihon no propone un orden ni introduce heurística de «mejor recorrido».

Cierre: ver `docs/BLOCK_27_HANDOFF.md`.
