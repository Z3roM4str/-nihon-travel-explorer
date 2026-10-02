# Autoridad de gates de navegador

Clasificación de `app/scripts/*` medida sobre main `c512db1` (B10 integrado), Chromium 141, build de producción (`vite preview`).
Es evidencia de ejecución, no una opinión: la causa de cada fallo se leyó del log. Sigue siendo válido «Autoridad» sólo mientras el gate pase.

Requisitos de entorno: `npm run build` antes; gates que usan `vite preview --port 4181` (B17/B18/block19/block20/ddr03) necesitan ese servidor levantado; `NIHON_CHROMIUM_PATH` apunta al Chromium disponible.

## 1. Autoridad vigente (pasan)
B10 (motion, a11y, microcopy, performance) · evidence-options-check · block1-ux · block2-photography · block3-zones · block4-zone-planner · block7/8/9/10 (zonas) · block13-portable-backup · block14-release-readiness · phase4c/d/j/l · block22 b6-4 · b24-real-input · D0b · D5 · B25 · B26 · B27 · B28 · B29 · B30 · B31 · block5 · block20 · block19 (contraste, grid) · block23 · ddr03 · DD-028 · B17 (tap-target, responsive) · B18 (a11y, chrome, responsive, viaje-lugar, browser-back) · b24-ddr3-home · b21-global-search · block6 · block12 (bundle) · block22 b6-2/b6-3/b6-5/b6-6 · phase4f · phase4h · integración B24+B23 · phase5a.

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

## 3. Obsoletos: verificación ítem a ítem hecha (endurecimiento post-B10, Fase 6)
La columna «cobertura equivalente» de esta tabla fue «criterio de ingeniería, no verificada ítem a ítem». **Ya está verificada**: [GATE_RETIREMENT_AUDIT.md](GATE_RETIREMENT_AUDIT.md) enumera las invariantes de cada gate, las contrasta con la build actual y con los gates vigentes y documenta lo cambiado.
Resultado: **ningún gate se retiró por ser viejo**; 16 se **reescribieron** (misma cobertura, entrada moderna, verdes en 3 viewports) y están en §1; los 4 `phase3e-*` pasan a `evidence-options-check` (nuevo, §1).

| Gate | Estado | Cobertura |
|---|---|---|
| block1-ux · block2-photography · block3-zones · block4-zone-planner · block7-zone-provenance · block8-airport-link · block9-editorial-governance · block10-source-freshness · block13-portable-backup · block14-release-readiness · phase4c · phase4d · phase4j · phase4l · block22-b6-4 · b24-real-input (P0-2) | **REESCRITOS, vigentes** | ellos mismos (153 · 81 · 99 · 258 · 129 · 114 · 153 · 81 · 150 · 229 · PASS ×4 · 492 · 1323) |
| phase3e-e / g / i / k | **superseded** por `evidence-options-check` (89/89) + B29; se archivan con `LocalSwapAlternativesSection` | mismas fixtures y cifras en la interfaz vigente |

## 4. No medibles aquí
Safari/iPhone físico y lector de pantalla físico. WebKit de Playwright (26.5) **sí** es instalable en el entorno (`npx playwright install webkit` + `install-deps webkit`) y se ejecutó sobre los gates que lo admiten (`NIHON_BROWSER=webkit`; incluye B21): ver `RELEASE_CERTIFICATION.md` §7. B25 y B27–B29 sólo están escritos para Chromium.
