# P-06 v2 — Certificación de P-06·A + P-06·B

Base `main` @ `de4b190b033a4d8c169d75a609e3d7d50527e674`. Rama `claude/p06-v2-list-sheets`. Arquitectura: [P06_V2_ARCHITECTURE.md](P06_V2_ARCHITECTURE.md).

## Alcance real y desviación de proceso

La misión pedía implementar A, certificar A, implementar B y certificar A+B. **A y B se implementaron juntas y se certificaron una sola vez (A+B)**: la regla «ningún botón secundario de N1 abre un bloque inline grande» y la
prohibición de «recrear el problema con otro `<details>`» dejaban a A sin ningún lugar donde alojar fechas, acciones de parada o mover entre días salvo la Sheet de B. Los commits separan documentación, producto y gates, pero no existe una certificación intermedia «sólo A».

## Entorno

Chromium 141 (`/opt/pw-browsers/chromium-1194`), Playwright 1.62.1, `vite preview` de la build de producción, un servidor por árbol. Los gates que necesitan servidor externo (B17/B18/Block 20/DDR03) se ejecutaron con `NIHON_BASE_URL`;
los que lanzan `chromium.launch()` sin ruta (Block 6, Phase 3F-*) con un `PLAYWRIGHT_BROWSERS_PATH` temporal que enlaza el headless-shell disponible. **La base `main` se ejecutó en el mismo entorno y todos esos gates pasan ahí**, salvo `block4`, que ya estaba roto en `main` por P-06 v1.

## Resultados — Chromium (rama, HEAD final)

| Comprobación | Resultado |
|---|---|
| `tsc -b` · build · oxlint | PASS · PASS · 0 errores (warning heredado `PlaceMap.tsx:18`) |
| Vitest | 119 archivos · **3428/3428** (base 118 · 3424: +1 archivo `day-sleep-line`, +4 pruebas) |
| B27 Viaje · Días | PASS (A–K, 8 viewports) |
| B28 reordenación/arrastre | **69/69** (ratón; touch: sin asas + mover por Sheet; 8 viewports) |
| B29 Cambiar orden (antes «Probar otro orden») | **163/163** (ejecuta B28 dentro) |
| B30 Dónde dormir · B31 Reservas/Resumen | 475/475 · 281/281 |
| B18 a11y · back · chrome · regression · responsive · viaje-lugar | 25/25 · PASS · 6/6 · PASS · PASS · PASS |
| B17 regression · responsive · tap-target | PASS · PASS · 16/16 |
| Block 20 place-detail · B24 DDR3 · B25 · B26 · DDR03 | 73/73 · 9 · 123/123 · 314/314 · 43/43 |
| B10 a11y · microcopy · motion | 89/89 · 52/52 · 17/17 |
| D0b higiene del sistema de diseño | **128/128** (antes 56: el recorrido mide cada hoja/vista) |
| D5 vocabulario normativo · evidence-options | **35/35** (antes 30) · 89/89 |
| P-04 alcance mapa nacional | 55/55 |
| Phase 5A RC | 50/50 |
| Block 4 zona→planificador | **258/258** (en `main` fallaba desde P-06 v1: selectores dentro de `<details>` cerrado) |
| Block 6 divergencias · Phase 3F-f/h/j/s | 177/177 · PASS ×4 |
| **`p06-v2-list-invariant-check`** (nuevo) | **184/184** en 390×844 (touch) y 1440×900 (puntero fino) |

### WebKit — NO EJECUTADO

`webkit.launch()` falla: `Executable doesn't exist at /opt/pw-browsers/webkit-2336/pw_run.sh`. El entorno sólo trae Chromium y su política prohíbe `playwright install`. Sin WebKit no hay evidencia para: el comportamiento de `(hover: hover) and (pointer: fine)` en Safari,
`input[type=date]` dentro de la Sheet, foco al cerrar hojas y Tab atrapado. El gate nuevo, B30/B31/B10/D0b/D5/P-04 admiten `NIHON_BROWSER=webkit`; deben repetirse en un entorno con WebKit antes de integrar. B27–B29 siguen siendo sólo Chromium (como antes).

## Gates actualizados (y por qué)

Ninguna aserción funcional se relajó. Cambió la **entrada** (abrir la hoja/vista) y se sustituyeron las aserciones que certificaban la UI antigua por la invariante:

- **B27**: sin `<details>`/frase pedagógica en N1; fechas por Sheet; «Eliminar/Mover día» por Sheet («Mover después», no «Posición N»); mover entre días por Sheet y **al final**; orden fino del día por «Cambiar orden»; «Sin asignar» visible; Cambiar orden en vista enfocada.
- **B28**: touch ya no arrastra (no hay asas): comprueba que no hay ninguna asa visible y que la Sheet mueve por touch/teclado; el arrastre con ratón queda intacto; «Sin asignar» sin `<details>`.
- **B29**: «Probar otro orden» → «Cambiar orden»; el panel vive en una vista enfocada; los casos «obsoleto» simulan el cambio externo sobre controles tapados (`dispatchEvent`); el TabBar tapado ya no cuenta para la geometría del CTA.
- **Resto**: B31, B18-regression (el estado local que sobrevive al cambiar de pestaña pasa de `<details class="days-tools">` a la vista «Herramientas del viaje»), D0b (A01 ya no exige reglas de selects retirados; recorrido por superficie), D5 (siete superficies de Días), B10-a11y, surface-walk, visual-capture, css-equivalence, evidence-options, Block 4/6, Phase 3F-f/h/j y Phase 5A. Helpers nuevos en `lib/modern-trip.mjs`: `moveStopToDay`, `setTripStartDate`, `closeDaysOverlays`.
- **Vitest de fuente**: `OrderedSequenceBuilder.stable-day-identity`, `OrderedSequenceBuilder` (3D-Q) y `DayOrderToolPanel` — mismas garantías (id estable, nombres accesibles, foco) contra la estructura nueva; sin `dayId=`/`dayId: day…` hacia módulos de dominio.

## Mediciones antes / después (viaje de 2 días: Día 1 con 3 paradas, Día 2 con 1, 1 sitio sin asignar)

`scripts/p06-v2-measure.mjs` (misma sonda contra `main` y contra la rama).

| Métrica | 390×844 antes → después | 1440×900 antes → después |
|---|---|---|
| Altura desplazable de Días (estado inicial) | 1726 → **1487 px** (−14 %) | 1522 → **1346 px** (−12 %) |
| Tarjeta del Día 1 (3 paradas) | 578 → **538 px** (−7 %) | 498 → **489 px** (−2 %) |
| Controles interactivos visibles a la vez (toda la lista) | 40 → **21** (−48 %) | 40 → **26** (−35 %; las asas de puntero fino cuentan) |
| Controles en la tarjeta del Día 1 | 16 → **11** | 16 → **14** |
| Texto en el cuerpo de Días | 808 → **629** caracteres (−22 %) | ídem |
| `<details>` / paneles inline en N1 | 3 + 2 → **0** | ídem |
| Crecimiento de la página al accionar un control secundario | ⋯ parada **+289** · Detalles **+1888** · Probar orden **+1454** · Herramientas **+1200** · cajón +220 → **0 px en las 8 entradas** | +291 · +1460 · +977 · +659 · +123 → **0 px** |

Lectura honesta: la altura **inicial** baja de forma moderada (P-06 v1 ya había hecho la mayor parte: 5159 → ≈1850 px). Lo que cambia de naturaleza es la **interacción**: ninguna acción secundaria vuelve a alargar la página (hasta +1888 px antes), hay la mitad de controles simultáneos y menos texto. «Sin asignar» con lugares ahora ocupa su lista (antes un cajón cerrado), por eso la altura inicial no cae más.

Capturas locales (fuera del repo): 390×844 y 1440×900, lista, hoja de parada y vista «Detalles del día».

## Regresiones propias encontradas y corregidas

1. Texto «guardados/Guarda más lugares» en la Sheet «Añadir lugar» violaba el vocabulario de B10-C1 → «Todos los lugares de Quiero ir ya tienen día…».
2. `@media (max-width)` nuevo violaba D0b E01 (Art. 8) → reescrito mobile-first con `min-width`.
3. El foco tras mover una parada se leía antes del siguiente fotograma → el gate espera al foco (el comportamiento era correcto).
4. Tres gates leían una regla/estado retirado (A01 de D0b, `.days-tools` en B18, `.zone-plan__card` en B31) → adaptados.

## Riesgos residuales

- **WebKit sin ejecutar** (arriba) y sin dispositivo físico.
- `FocusedView` provisional **sin History API**: «atrás» del navegador con una vista abierta navega fuera de Días en lugar de cerrar la vista. Ocurre por diseño hasta P-06·C.
- Vistas N3 y Sheets son modales y cubren el TabBar; los casos «obsoleto» de B29 ya no son alcanzables por un usuario real (sólo por el gate).
- Mover entre días cambia las fechas derivadas (la fecha del día es `inicio + ordinal`): «Mover antes/después» lo advierte con «Pasa a ser el Día N».
- Un día cuyo alojamiento es `no-accommodation` se muestra como «Elegir zona para dormir» (los tres estados cerrados no incluyen «sin alojamiento»); decisión de producto pendiente.
- `FocusedView` y las Sheets de Días no se auditaron con lector de pantalla real.
