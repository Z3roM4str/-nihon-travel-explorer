# Cierre técnico de Nihon — informe breve (9 oct 2026)

**SHA certificado:** `bb4dd6f9435fba74df43c74def88ce7f1410da37`. **PR definitivo:** [#205](https://github.com/Z3roM4str/-nihon-travel-explorer/pull/205) (sustituye a #203 y #204; `main` = `52503a9` es ancestro, sin conflictos). El HEAD final de la rama sólo añade este documento; su árbol `app/` es idéntico al certificado (`git rev-parse bb4dd6f:app` = `git rev-parse HEAD:app`).

## Veredicto
- **Integrar: APTO.** **Publicar: pendiente de tres acciones humanas** (abajo). **iPhone: preparado, no certificado.**
- Enlace de la aplicación: **no hay versión final publicada**. Producción (`nihon-travel-explorer.vercel.app`) sigue en `32787a1`, sin estas correcciones.

## Qué se corrigió de verdad
| Defecto | Evidencia | Corrección |
|---|---|---|
| H01–H07 de la auditoría final (pérdidas por restauración, pestañas, JSON inválido, versión futura…) | ya en #203; suites unitarias y de navegador | almacén único con linaje y protección de originales |
| Lectura obsoleta tras un Web Lock esperado (WebKit 26.5: 3,4 % sin carga, 44 % con carga, ≤ 6 ms) | sonda sin código de Nihon | margen de 32 ms sólo tras contención |
| Un documento protegido ajeno sobrescrito por una lectura obsoleta y exportación `ok` (síntoma del fallo `72636d3`) | reproducción controlada: 106/122 destruidos, 122/122 con evento `storage` que trae lo sobrescrito | se conserva aparte, se restituye, el cambio queda pendiente y la exportación se niega |
| Un respaldo podía salir sin pasar por su propio lector | revisión del flujo | `serializeVerifiedBackup`: lo que la restauración rechazaría no se entrega |
| El usuario no sabía que Safari borra datos de webs no abiertas en una semana (ITP) | WebKit ITP | aviso en Nosotros › respaldo |

**JSON inválido:** la importación rechaza archivos corruptos sin escribir nada (≈ 60 pruebas existentes de `portable-backup`, intactas); un documento inválido o de versión futura en el almacenamiento nunca se sobrescribe (y ahora tampoco por lectura obsoleta); la exportación se niega con datos protegidos. **Durabilidad:** nada de la app afirma que una escritura sea durable porque `setItem` terminase; la mitigación práctica es el respaldo y su aviso.

## Clasificación de lo que sigue sin cerrarse (no impide integrar)
- **Limitación de WebKit (documentada):** una escritura reciente puede perderse si el proceso de red muere antes del commit (≈ 500 ms), reproducido sin Nihon en WPE y macOS. Mitigación: respaldo.
- **Entorno de pruebas:** el clic nativo de Safari WebDriver nunca llega a la página (control sin Nihon: 0 eventos); con teclado el recorrido completo pasa en **Safari 26.6.1 real**. La pantalla de introducción **no** es un defecto.
- **Sin atribución:** H03/RESET (dos perfiles) y el fallo móvil histórico `37715508535`. Evidencia conservada (`evidence/pr203-2fd30db`). **No impiden una entrega segura**: ninguna ejecución reproduce pérdida en recorridos normales (recarga, cierre/reapertura, importación) y las causas probables son del motor de pruebas, no de la aplicación.

## Pruebas sobre el SHA certificado
| Prueba | Resultado |
|---|---|
| `tsc -b`, `oxlint`, `npm run build` | sin errores (1 aviso heredado de `PlaceMap`) |
| Vitest | **3.469/3.469** (122 ficheros) |
| **P-06 en CI, WebKit 26.5 y Chromium** (run [37885638813](https://github.com/Z3roM4str/-nihon-travel-explorer/actions/runs/37885638813), sobre el PR) | **success**: lista 190, historial 146, recorridos 68, recorte 104, recuperación 69/69, pestañas 16/16, exportación 16/16, persistencia 35/35, clasificación H03 8/8, 8 viewports de Viaje (días, reordenar, dónde dormir, reservas) |
| Gates Chromium locales tras el último cambio | microcopia 52/52, vocabulario D5 35/35, exportación 16/16 |
| Recorrido del guion de iPhone (Chromium, build con ruta base) | 10/10 |
| Compatibilidad hacia atrás para el rollback | el código de `main` lee sin problema los documentos del candidato |
| **No ejecutado** | iPhone físico; cierre/reapertura de Safari real; despliegue de Vercel (403); repetir baterías WPE (sin hipótesis nueva) |

## Qué tienes que hacer tú (indispensable, en este orden)
1. **Prueba en el iPhone** (10 min) con `docs/IPHONE_SYNTHETIC_CHECK.md`. Necesita una URL HTTPS: o bien reautorizas Vercel (punto 2) y se publica un Preview del SHA, o bien activas GitHub Pages (Settings › Pages › Source = GitHub Actions + permitir el entorno `github-pages` desde la rama) y ejecutas *Vista previa HTTPS para iPhone*; con un ordenador sirve también la variante local de ese documento.
2. **Reautorizar Vercel** para el ámbito `z3ro2` (ahora mismo `403`). Es lo único que impide crear el Preview y publicar.
3. **Autorizar la publicación nombrando el SHA** de la rama y de su commit de fusión. Procedimiento y rollback de un paso en `docs/RELEASE_RUNBOOK.md`.

Después de fusionar #205, cerrar #203 y #204 como superados.
