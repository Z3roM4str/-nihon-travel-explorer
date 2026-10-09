# Comprobación en iPhone con datos sintéticos (≈10 min, sin PC)

**Qué falta certificar.** Safari real de macOS (26.6.1) ya recorrió introducción → favorito → recarga → cambio → recuperación. Nadie ha podido todavía **cerrar y reabrir Safari con el mismo perfil**, ni probar **dos pestañas** o **exportar/importar** en un iPhone. Esta guía cubre eso, con la build candidata en una URL HTTPS propia (con HTTPS Safari ofrece Web Locks, así que se prueba también la protección entre pestañas).

**Garantía de no tocar tus datos.** Los datos de Nihon viven en el *origen* (dirección). La vista previa se sirve desde un origen **distinto** de `nihon-travel-explorer.vercel.app`, de modo que su almacenamiento empieza vacío (sintético por construcción) y nunca se mezcla con tu viaje real. **No abras la dirección de producción para esta prueba y no borres «Datos de sitios web» de Safari sin mirar el dominio.**

## Estado de la vista previa (9 oct 2026): autorizada, NO publicada — bloqueo externo

El propietario autorizó expresamente **una única vista previa en Vercel del SHA completo `889b247aacd4cda750bacdb0abd1e4fe8a25765b`**, separada de producción, sin autorizar producción ni despliegues automáticos generales. **No se pudo crear**: la conexión de Vercel de esta sesión responde `403 forbidden — Not authorized: Trying to access resource under scope "z3ro2"` incluso para leer el proyecto (con `teamId`, con `slug`), y no hay credenciales de la CLI de Vercel en el entorno. No se probó ninguna otra vía de acceso. El SHA se verificó antes (commit completo, cabeza de la rama).

**Desbloqueo (una de dos):** reautorizar la conexión de Vercel de la sesión para el ámbito `z3ro2` con permiso de lectura de proyecto, modificación de proyecto y creación de despliegues; o ejecutar el procedimiento de abajo con una sesión que ya tenga ese acceso.

### Procedimiento preparado (límite del *Ignored Build Step* a ese SHA)

1. Leer el proyecto `nihon-travel-explorer` (`prj_6MVsoR476rp484URO0amRRe0TbI9`, equipo `team_YPIfOulAGNBY8gz0dLWTmBxw`) y **anotar** `commandForIgnoringBuildStep` (esperado: `exit 0`); confirmar que `app/vercel.json` sigue con `**: false` y `main: true` (no se toca).
2. Fijar `commandForIgnoringBuildStep` = `test "$VERCEL_GIT_COMMIT_SHA" != "889b247aacd4cda750bacdb0abd1e4fe8a25765b"` (omite todo SHA distinto).
3. Crear **un** deployment *Preview* (sin `target`, que es preview; nunca `production`) con `gitSource {type: github, org: Z3roM4str, repo: -nihon-travel-explorer, ref: claude/sweet-mendel-v8st6b, sha: 889b247aacd4cda750bacdb0abd1e4fe8a25765b}`, `name: nihon-travel-explorer`, sin `deploymentId`/`withLatestCommit`.
4. En cuanto el build arranque, **restaurar** `commandForIgnoringBuildStep` a su valor anotado (`exit 0`) y comprobar la lectura.
5. Verificar: `gitSource.sha` del deployment = ese SHA; `target` = preview; ningún alias de producción (`nihon-travel-explorer.vercel.app` sigue en `dpl_Fu2dABdW5xohuo6cV9kMkyeh6whV`); los ficheros servidos son idénticos a `npm run build` de ese SHA (como el 2026-10-06).
6. Si la protección de despliegues de Vercel pide sesión, usar un enlace compartible o el bypass de automatización **sólo para este deployment**; no relajar la protección del proyecto.
7. Contra la URL publicada: `NIHON_PREVIEW_URL=<URL>/ node app/scripts/preview-journey-check.mjs` (con `NIHON_BROWSER=webkit` además de Chromium). Debe dar 10/10 antes de pasar el enlace al iPhone.

## Pasos en el iPhone (con la URL de la vista previa)

Con la vista previa de Vercel no hay `build-info.txt` (lo escribe sólo el workflow de Pages); la versión se comprueba por el deployment (paso 5). Usa una pestaña normal de Safari (no privada).

| # | Acción | Debe pasar |
|---|---|---|
| 1 | Abrir `<URL>/`. | Introducción «Nihon · El cuaderno de vuestro viaje a Japón». |
| 2 | Tocar **Saltar**. | La introducción se cierra. |
| 3 | Buscar «Ghibli» y tocar el corazón de **Ghibli Museum, Mitaka**. | El corazón queda activo. |
| 4 | Recargar. | Sigue activo y la introducción no reaparece. |
| 5 | Cerrar Safari **del todo** (deslizar la app hacia arriba en el selector). Esperar 10 s. Reabrir y volver a la URL. | Sigue activo. **Es el paso que nadie había podido probar.** |
| 6 | Quitar el corazón, esperar 5 s, cerrar Safari del todo, reabrir. | Sigue **sin** estar guardado. Volver a guardarlo, esperar 5 s, recargar: guardado. |
| 7 | **Dos pestañas:** abrir la URL en una segunda pestaña de Safari. En la segunda, guardar otro lugar (cualquier corazón). Volver a la primera. | La primera muestra los dos lugares tras unos segundos o al recargarla; **no desaparece ninguno**. Repetir al revés. |
| 8 | En **Nosotros › Exportar respaldo**. | Se descarga `nihon-backup-….json` (aparece en Descargas de Archivos). |
| 9 | En **Nosotros › Importar respaldo**, elegir ese archivo y **Sustituir con este respaldo**, luego **Continuar**. | «Respaldo restaurado»; tus lugares siguen ahí tras la recarga. |

## Qué contarme

Una línea por paso (✔/✘), modelo de iPhone, versión de iOS y una captura si algo falla. Para limpiar: Ajustes › Safari › Avanzado › Datos de sitios web › elimina **sólo** el dominio de la vista previa (`github.io`), no el de `vercel.app`.

## Si prefieres no publicar nada

Con un ordenador: `git checkout claude/sweet-mendel-v8st6b && cd app && npm ci && npm run build && npx vite preview --host --port 4173` y abrir en el iPhone la dirección `http://<IP>:4173` (misma Wi-Fi). Al ser `http`, Safari no ofrece Web Locks: los pasos 1–6, 8 y 9 valen; el 7 no ejercita la protección entre pestañas.
