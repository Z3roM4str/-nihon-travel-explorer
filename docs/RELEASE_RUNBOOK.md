# Publicación y rollback de Nihon — procedimiento con el mínimo de intervenciones

Este documento **no autoriza** nada: publicar requiere una autorización expresa del propietario que nombre el SHA (`docs/DEPLOYMENT_POLICY.md`). El freeze de Vercel (`Ignored Build Step = exit 0`) sigue vigente.

## Estado de partida (verificado el 2026-10-09)

- Producción: `dpl_Fu2dABdW5xohuo6cV9kMkyeh6whV`, SHA `32787a1661665f53bba5dfcf73d630709a698ad2`, alias `nihon-travel-explorer.vercel.app`. **No contiene** las correcciones H01–H07 ni la protección de datos de este candidato.
- Candidato: la cabeza de la rama `claude/sweet-mendel-v8st6b` (SHA exacto en `docs/RELEASE_CLOSURE.md`). `main` = `52503a9` es ancestro de la rama: la fusión no tiene conflictos.
- Vercel: la conexión de la sesión devuelve `403 … scope "z3ro2"`. Sin acceso no se puede leer ni cambiar el proyecto.

## Intervenciones humanas necesarias (en orden, 3 como máximo)

1. **Prueba en iPhone** con `docs/IPHONE_SYNTHETIC_CHECK.md` (10 min). Sin su resultado no se publica.
2. **Reautorizar Vercel** para el ámbito `z3ro2` (lectura/modificación de proyecto y creación de despliegues) en la sesión que vaya a publicar.
3. **Autorizar la publicación nombrando el SHA** de la rama candidata y de su commit de fusión (una fusión con commit de merge sobre un `main` que ya es ancestro tiene el **mismo árbol**; se comprueba con `git rev-parse <merge>^{tree}` = `git rev-parse <candidato>^{tree}`).

## Publicar (lo ejecuta quien tenga acceso a Vercel; es el procedimiento ya usado el 2026-10-06)

1. Fusionar el PR definitivo en `main` con commit de merge. El build que genera Vercel queda `CANCELED` por el freeze: es lo esperado. Verificar el árbol: `git rev-parse origin/main^{tree}` = árbol del candidato.
2. Leer el proyecto y **anotar** `commandForIgnoringBuildStep` (esperado `exit 0`).
3. Fijarlo a `test "$VERCEL_GIT_COMMIT_SHA" != "<SHA-del-merge>"`.
4. Redesplegar el deployment cancelado de ese SHA **sin** `withLatestCommit` (conserva el `gitSource`).
5. En cuanto el build arranque, **restaurar** el valor anotado (`exit 0`) y comprobar la lectura.
6. Verificar: `READY`, `target: production`, `gitSource.sha` = SHA del merge, alias de producción apuntando al nuevo deployment, ficheros servidos idénticos a un `npm run build` limpio de ese SHA.
7. Comprobación de humo contra producción con un perfil nuevo del navegador de pruebas (no toca datos reales): `NIHON_PREVIEW_URL=https://nihon-travel-explorer.vercel.app/ node app/scripts/preview-journey-check.mjs` (Chromium y `NIHON_BROWSER=webkit`): 10/10.

## Rollback (un paso, sin migración de datos)

- **Qué:** reasignar los alias de producción a `dpl_Fu2dABdW5xohuo6cV9kMkyeh6whV` (`32787a1`), que queda como candidato de rollback y no se borra. Con la API: `request_rollback`/promoción de ese deployment; con el panel: *Deployments › ⋯ › Promote to Production*.
- **Datos de los usuarios:** compatibles hacia atrás. Se comprobó con el código de `main`: sus lectores aceptan sin problema los documentos que escribe el candidato (la clave de linaje `_w` es ignorada), así que volver atrás no deja datos «inválidos». Lo que el código viejo **no** hace es protegerlos: tras un rollback vuelve a sobrescribir documentos inválidos o de versión futura.
- **Cuándo:** si la comprobación de humo (paso 7) falla, o si tras publicar aparece cualquier pérdida de datos reproducible. No hace falta tocar el Ignored Build Step para un rollback de alias; si se hiciera, restaurar `exit 0`.
- Restaurar el freeze al terminar y anotar el resultado en `docs/DEPLOYMENT_POLICY.md`.
