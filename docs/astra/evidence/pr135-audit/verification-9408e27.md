# Verificación de trazabilidad del PR #139

Fecha: 2026-09-22 UTC  
Rama: `codex/completa-pr-#135-de-astra-16422227132192129267`  
SHA inicial y SHA de código comprobado: `9408e27ec279e6ec80bd27632e656d4f6c265384`

## Identidad y alcance

El checkout estaba limpio en `9408e27ec279e6ec80bd27632e656d4f6c265384`. `.git/FETCH_HEAD` identifica ese commit como la rama esperada. No se pudo consultar de nuevo el PR ni su HEAD remoto: GitHub CLI no dispone de autenticación, la consulta web devolvió HTTP 401 y `git ls-remote` devolvió HTTP 403 por el proxy. El objeto `abe7a624001d3b86727ece19201aa895eee63271` citado por los resultados existentes no está en este clon shallow y no pudo recuperarse.

No se modificó código de producto. En consecuencia, `9408e27ec279e6ec80bd27632e656d4f6c265384` es el SHA de código comprobado; el commit siguiente contiene solo documentación de trazabilidad.

## Resultados ejecutados

| Comprobación | Resultado real |
| --- | --- |
| `npm ci` | OK; 225 paquetes instalados. |
| `npm run test` | OK; 71 archivos y 2474 pruebas aprobadas. |
| `npm run lint` | OK; 0 errores y 4 advertencias (`exhaustive-deps`, `no-unused-vars`, `only-export-components`, `set-state-in-effect`). |
| `npm run build` | OK; TypeScript y Vite completaron el build. Vite advirtió de un chunk superior a 500 kB. |
| `python scripts/validate-photography.py` | OK. |
| `python scripts/validate-dataset.py` | OK; 214 lugares, 403 relaciones, 0 referencias rotas y 13 advertencias de metadatos secundarios. |
| `python scripts/validate-geography.py` | OK; 47 prefecturas, 47 polígonos, 9 regiones, 214 lugares. |
| `python scripts/validate-logistics.py` | OK; 24 aristas piloto y 308 de escala. |
| `python scripts/validate-reservation-mechanisms.py` | OK; catálogo válido y paridad de bytes. |
| `npx playwright install chromium` | BLOQUEADO; cuatro descargas de Chromium 1234 devolvieron HTTP 403. |
| `ASTRA_EXPECTED_SHA=9408e27ec279e6ec80bd27632e656d4f6c265384 node scripts/astra-sol-0-2-browser-audit.mjs` | BLOQUEADO antes de los recorridos: falta `chromium_headless_shell-1234`. |

## Nueve recorridos y revisión visual

No se regeneraron `results.json`, capturas ni trazas: **0/9 recorridos nuevos fueron ejecutados**. Los nueve PASS existentes declaran el SHA `abe7a624001d3b86727ece19201aa895eee63271`; se preservan literalmente como evidencia histórica y no se reasignan a `9408e27`.

Se inspeccionaron manualmente las capturas existentes para móvil (320/375/390/430), tablet (768/1024) y escritorio (1440), incluidas `09-explore-mobile.png`, `09-detail-mobile.png`, `09-trip-mobile.png` y `09-persistence-recovery-final.png`. En esos artefactos no se observaron recortes ni desbordamiento horizontal; los tres avisos de fallo son visibles, los controles de reintento son distinguibles y el estado final de Nuestro viaje ya no muestra el aviso. Esta conclusión solo describe los archivos inspeccionados: la procedencia respecto de un commit recuperable no se pudo confirmar y no equivale a una aprobación visual de `9408e27`.

## Texto propuesto para la descripción del PR

> SHA de código verificado: `9408e27ec279e6ec80bd27632e656d4f6c265384`. Tests: 71/71 archivos y 2474/2474 pruebas; build correcto; lint con 0 errores y 4 advertencias; cinco validadores OK, con 13 advertencias secundarias del dataset. La auditoría Playwright nueva quedó bloqueada porque la descarga de Chromium 1234 devolvió HTTP 403; por tanto, 0/9 recorridos nuevos fueron ejecutados. Los artefactos existentes declaran `abe7a624001d3b86727ece19201aa895eee63271`, objeto no recuperable en este entorno, y se mantienen como evidencia histórica sin atribuirlos al SHA verificado. La revisión manual de esas capturas cubrió móvil, tablet, escritorio y fallo/recuperación en Explorar, ficha y Nuestro viaje, sin defectos visuales observados en los artefactos, pero no constituye aprobación visual de `9408e27`. Commit de documentación/evidencia: `<SHA_FINAL>`; el diff desde el SHA auditado contiene exclusivamente documentación.
