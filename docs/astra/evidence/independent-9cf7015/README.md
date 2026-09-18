# Evidencia independiente — producto 9cf7015

Veredicto y correcciones: [informe](../../ASTRA_INDEPENDENT_AUDIT_SOL_0_2_9cf7015.md).

`actions-*` conserva metadatos/resultados del artefacto 10552290075; `01-*-top.png` son recortes de inspección de sus siete tamaños. Se revisaron además las 15 imágenes completas y los ocho traces originales. `trace-review.json` y `artifact-manifest.json` permiten identificar los originales por hash. Los JSON extendidos registran observaciones, no assertions de aceptación general.

Las imágenes `reference-*` corresponden a la referencia, `local-card` al producto con crédito abierto, `grade-d` al filtro D, `lightbox-open` al fullscreen real, `text-200-card` al aumento sólo de texto. `native-zoom-top/cta` son capturas CDP válidas con zoom nativo 200%; no son CSS zoom ni el simple viewport 320.

Archivo local completo (CI ZIP, traces suplementarios, capturas originales, scripts exploratorios y perfiles temporales exclusivamente de prueba):

`C:\Users\Fer\AppData\Local\Temp\nihon-astra-independent-9cf7015`

Este archivo local es evidencia adicional no versionada; los resultados necesarios para revisar los hallazgos están aquí. La descarga de Actions expira el 2026-10-02. No se copiaron perfiles personales, credenciales ni los directorios ajenos del checkout.

Reproducción en el mismo entorno: los `.cjs` adjuntos usan Playwright/Vite ya instalados en `app/node_modules` y Edge. `extended.cjs` inicia preview 4173 y la referencia 4174, usa contextos aislados y los cierra. `native-zoom.cjs` crea un perfil **de prueba** al lado del script; `zoom-capture.cjs` reutiliza ese perfil. No ejecutar dentro de este directorio versionado sin copiarlo antes a una ubicación de trabajo y ajustar las rutas relativas: genera capturas/traces/JSON y un perfil temporal. No necesita instalar paquetes ni editar producto. El script observa; consultar el informe para interpretar PASS/FAIL y las fixtures.

La preferencia de zoom sigue la [implementación de Chromium](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc): clave de partición `x`, nivel `log(2)/log(1.2)`. Medición local: mismo exterior 1440×1000, contenido CSS 1396×898 a 100% frente a 698×449 a 200%, DPR 1 frente a 2. `native-zoom-capture.json` registra CTA de 632×48 CSS px dentro de la vista tras scroll; captura física 1396×898.

Intentos exploratorios descartados: primer seed V7 JP-046 tenía un segmento inactivo por hub, corregido a JP-054 y validado por el parser antes de la prueba definitiva; primer elemento de historia no tenía cercanos, reemplazado por JP-089; primer selector de categorías apuntaba a un disclosure cerrado, corregido. Una interrupción dejó el servidor apagado y produjo connection refused; no se cuentan esas ejecuciones como fallos de producto. Las observaciones definitivas de `extended-observations.json` no contienen errores de harness.

Limitaciones mantenidas: no lector humano, baseline histórico completo ni prueba entre motores de texto nativo 200%. El aumento sólo de texto usa duplicación de fuentes computadas, expresamente separado del zoom de página nativo y de CSS zoom exploratorio. El trace de CI no almacenó el cuerpo del JS inicial; se registran nombres de bundles y hashes locales, sin afirmar igualdad binaria no demostrada.
