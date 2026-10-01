# Autoridad de gates de navegador

Clasificación de `app/scripts/*` medida sobre main `c512db1` (B10 integrado), Chromium 141, build de producción (`vite preview`).
Es evidencia de ejecución, no una opinión: la causa de cada fallo se leyó del log. Sigue siendo válido «Autoridad» sólo mientras el gate pase.

Requisitos de entorno: `npm run build` antes; gates que usan `vite preview --port 4181` (B17/B18/block19/block20/ddr03) necesitan ese servidor levantado; `NIHON_CHROMIUM_PATH` apunta al Chromium disponible.

## 1. Autoridad vigente (pasan)
B10 (motion, a11y, microcopy, performance) · D0b · D5 · B25 · B26 · B27 · B28 · B29 · B30 · B31 · block5 · block20 · block19 (contraste, grid) · block23 · ddr03 · DD-028 · B17 (tap-target, responsive) · B18 (a11y, chrome, responsive, viaje-lugar, browser-back) · b24-ddr3-home · b21-global-search · block6 · block12 (bundle) · block22 b6-2/b6-3/b6-5/b6-6 · phase4f · phase4h · integración B24+B23 · phase5a.

## 2. Actualizados en esta misión (eran del gate, no del producto)
| Gate | Estado previo en main | Ahora | Causa del desfase |
|---|---|---|---|
| phase5a (RC) | 47/50 (A14, C01, C06) | 50/50 desktop y mobile | `Dato:` retirado (D5/B31); composición y reservas viven en Resumen/Reservas |
| integración B24+B23 | 56/58 | 58/58 | consecuencia de phase5a |
| phase3f-f / h / j / s | crashean | pasan (2 pasadas) | corazón «Quiero ir: …», onboarding, «Mover a…», calendario «del viaje», borrador v7→v8, EvidenceMark en fechas |
| b18-regression | falla | 40/40 | `.selection-*` retirado (B25), Nosotros rehecho (B26), «Comparar otro orden» inalcanzable (D5-M1) |
| block12 (bundle) | 4 ✗ | 78/78 | ver §2.1 |

### 2.1 block12: no era una regresión de B10
`no deferred surface is pulled into the document's critical path` pasaba en `2a10ad3` y fallaba en `c512db1`. Causa: B10.4 dio CSS propio a los chunks `OrderedSequenceBuilder` y `ZoneComparison`; con CSS asociado Vite inyecta en tiempo de ejecución un `<link rel="modulepreload">` al hacer el `import()` en reposo, y el gate leía el DOM vivo.
Medido en ambos builds (3 repeticiones): FCP ≈ 300–360 ms; los chunks se piden a ≈ 420–470 ms (idéntico); `dist/index.html` tiene 0 `modulepreload`; el entry no importa estáticamente los chunks. La invariante real (fuera de la ruta crítica, pedidos tras la primera pintura) se mantiene; el gate ahora la mide directamente (HTML servido + `start > FCP`) y pasa en ambos builds.

## 3. Obsoletos o superseded (fallan por UI/estructura anterior; no son defectos de producto)
| Gate | Fallo observado | Cobertura vigente equivalente (criterio de ingeniería, no verificada ítem a ítem) |
|---|---|---|
| block4-zone-planner | `.hub-bar__zones`, panel de guardados | B30 (475/475) |
| block3-zones, block7-zone-provenance, block8-airport-link, block9-editorial-governance, block10-source-freshness | esperan `.hub-bar__zones` (cajón de zonas pre-B18) | B30 + B31 (Dónde dormir / Reservas) |
| block1-ux, block2-photography | esperan `.selection-panel__count` / `.selection-list__thumb` | B25 (Quiero ir), block20, B3/B4 |
| block13-portable-backup | espera botones «Kioto…» de la navegación antigua | B26 (Copia del viaje, 314/314) |
| block14-release-readiness | «mapa nacional en la primera pintura», buscador antiguo | phase5a + B21 |
| phase3e-e/g/i/k | 157 coincidencias de «Quiero ir» en el selector antiguo y planner pre-B27 | B27–B29 |
| phase4c / phase4d / phase4j | `locator` estricto: la galería ya tiene 2–3 imágenes | block20, block22 b6-x |
| phase4l | texto de placeholder «Sin fotografía disponible todavía» retirado | block20 / b24-ddr3 |
| block22-b6-4 | «slide 3 alcanzable» (galería con otro número de imágenes) | block22 b6-5/b6-6 |
| b24-real-input P0-2 | ningún `.icon-button--small` visible en Quiero ir | B25 + B17 tap-target |

No se han borrado ni modificado (salvo block4, marcado «OBSOLETO» en su cabecera). Retirarlos o reescribirlos es una decisión de higiene del repositorio, no de producto; ninguno bloquea trabajo.

## 4. No medibles aquí
WebKit (no instalado en esta sesión; B10 lo certificó con WebKit 26.5), Safari/iPhone físico, lector de pantalla físico.
