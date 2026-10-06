# Política de despliegue

**Vigente desde:** 2026-09-26
**Estado documental:** freeze técnico autorizado, versionado en `app/vercel.json` y **reforzado el
2026-10-05 con una protección remota temporal** (ver «Protección temporal vigente»). **No hay
autorización para publicar automáticamente desde `main`**: que `app/vercel.json` conserve `main: true`
describe qué ramas puede construir la integración Git, no concede permiso para publicar.

## Fuente de verdad y línea de trabajo

- GitHub es la fuente de verdad del proyecto.
- Cada alternativa debe continuar únicamente en su rama y sobre la base que tenga asignadas.
- No se debe hacer merge a `main` como parte del trabajo de una alternativa.
- Las líneas Astra y Claude son independientes: no se deben mezclar commits, código ni decisiones
  entre ellas.
- Los cambios deben publicarse únicamente en la rama de trabajo autorizada.

## Congelación de Vercel

Hasta autorización expresa posterior:

- no iniciar deployments manuales de Preview ni de producción en Vercel;
- no modificar proyectos, deployments, dominios, Production Branch ni ajustes remotos de Vercel;
- no modificar la excepción de `main` ni ampliar las ramas habilitadas en `app/vercel.json`;
- no añadir adaptadores, workarounds ni otras soluciones específicas de Vercel.

El freeze técnico mediante `app/vercel.json` sí fue autorizado. Su incorporación es la única
excepción autorizada a la prohibición anterior de añadir configuración de Vercel al repositorio.
La excepción `main: true` conserva el despliegue automático de producción; no autoriza un
deployment manual ni cambia la Production Branch.

Las referencias históricas a pruebas o previews de Vercel en documentos de cierre anteriores son
registro de hechos ya ocurridos; no constituyen autorización para repetirlos.

### Freeze documental frente a freeze técnico

El **freeze documental** anterior prohíbe iniciar o configurar despliegues, pero un archivo Markdown
no puede detener automatizaciones ya conectadas al repositorio. El PR #153 lo demostró: al recibir
su actualización, una integración externa creó un Preview y devolvió a GitHub un check de Vercel
con resultado `success` para el HEAD `ded233b9f5b4715ebb29cb6cfb6e5f0411494a2a`.

La causa es la **integración Git de un proyecto de Vercel conectado a este repositorio mediante la
GitHub App de Vercel**. La aplicación recibe el evento de push/PR, aplica el auto-deploy configurado
en el proyecto para ramas que no son la rama de producción, crea el Preview y publica su check en
GitHub. No fue un comando ni un workflow ejecutado desde este repositorio.

La auditoría del árbol del PR #153 no encontró `vercel.json`, directorio `.vercel`, workflows de
GitHub Actions, hooks versionados ni scripts de `package.json` que invocaran Vercel. Por tanto, el
activador del Preview era la configuración externa del proyecto y de su GitHub App.

El 27 de septiembre de 2026 se autorizó superar la preferencia anterior por configuración externa.
Como el Root Directory del proyecto es `app`, el freeze se versiona en `app/vercel.json`. Según la
[configuración oficial de proyectos de Vercel](https://vercel.com/docs/project-configuration#git.deploymentenabled),
la clave `git.deploymentEnabled` usa patrones minimatch: `**` coincide con todos los nombres de
rama, incluidos los que contienen `/`, mientras que la coincidencia específica `main: true`
permite producción. Cuando varias reglas coinciden, basta una regla `true` para permitir el
deployment; por eso `main` permanece habilitada y cualquier otra rama queda deshabilitada.

Este mecanismo conserva la integración de GitHub y no cambia la Production Branch, los
deployments ni los dominios existentes. La regla se aplica a toda rama de trabajo, de pull request
o experimental, sin necesidad de mantener una lista de prefijos. En consecuencia, esas ramas no
generan deployments automáticos; únicamente `main` permanece habilitada para producción.

## Protección temporal vigente (2026-10-05)

**Qué ocurrió.** El merge de #196 a `main` (`592c0c4`) creó el deployment de producción
`dpl_2eiLZExrgQzUrVRUCVusgPCf9Cc5` (origen `git`, entorno production, READY, alias de producción
asignados), porque `main: true` hace que todo push a `main` publique. No lo inició ningún comando ni
workflow del repositorio y no estaba autorizado como publicación.

**Qué se hizo (autorizado, mínimo y reversible).** En el proyecto Vercel `nihon-travel-explorer` se fijó
el **Ignored Build Step** a `exit 0`, que omite todo build nuevo. No se hizo rollback, no se borró ningún
deployment, no se tocaron dominios ni la Production Branch, y `app/vercel.json` no se modificó.

**Verificación (por comportamiento; la API no devuelve ese campo al leer el proyecto).**

| Push a `main` | Deployment creado | Estado |
|---|---|---|
| `ebd6ae8` (#198) | `dpl_4crhCtFAk8R8e2MtYigHQETX5XKd` | CANCELED |
| `32787a1` (#199) | `dpl_5s4GtvM5PshuyKXPijj58uQY8mea` | CANCELED |

Hasta la publicación autorizada de 2026-10-06 (ver la sección siguiente), producción siguió en
`dpl_2eiLZExrgQzUrVRUCVusgPCf9Cc5` (SHA `592c0c46435dd61d4b2ef84566c4fdb75f53c56d`, READY) con sus tres
alias; los deployments cancelados no tienen alias.

**Reglas mientras esté vigente.**

- Todo build que genere un push a `main` debe quedar CANCELED. Si alguno llega a READY o se asigna a un
  alias de producción: detener las escrituras siguientes a `main`, reportar el incidente y **no** hacer
  rollback ni borrar deployments sin autorización expresa.
- No se retira ni se modifica el Ignored Build Step, ni se cambia cualquier otro ajuste de Vercel, sin
  autorización expresa y previa.
- Publicar una versión (automática o manual) requiere autorización expresa que nombre el SHA a publicar.
- Para revertir la protección: dejar vacío el campo «Ignored Build Step» en Settings › Git del proyecto.
  Hacerlo reactiva la publicación automática desde `main`, por lo que sólo procede con esa autorización.
- Decisión pendiente del propietario: mantener esta protección o sustituirla por una política definitiva
  (p. ej. `main: false` en `app/vercel.json`, que exige tocar la excepción de `main`).

## Publicación única autorizada (2026-10-06)

El propietario autorizó **una sola** publicación en producción del SHA exacto
`32787a1661665f53bba5dfcf73d630709a698ad2` (merge de #199). Esa autorización quedó **consumida**; cualquier
otra publicación requiere una autorización nueva que nombre su SHA.

**Procedimiento (sin retirar el freeze ni publicar el HEAD de `main`).**

1. Se intentó redeployar el deployment existente de ese SHA (`dpl_5s4GtvM5PshuyKXPijj58uQY8mea`, cancelado por el
   freeze): el Ignored Build Step `exit 0` también cancela redeploys (`dpl_57LpC99n3UsYKcdQSNbr7EXardjc`,
   CANCELED; nada se publicó).
2. Se acotó **temporalmente** el Ignored Build Step a ese SHA
   (`test "$VERCEL_GIT_COMMIT_SHA" != "32787a1661665f53bba5dfcf73d630709a698ad2"`: omite todo SHA distinto) y se
   repitió el redeploy sin `withLatestCommit`, de modo que conserva el `gitSource` en `32787a1`.
3. En cuanto el build arrancó se restauró el Ignored Build Step a `exit 0`.

**Resultado.** `dpl_Fu2dABdW5xohuo6cV9kMkyeh6whV`: SHA `32787a1661665f53bba5dfcf73d630709a698ad2`, entorno
production, READY, origen `redeploy`; los tres alias de producción (incl. `nihon-travel-explorer.vercel.app`)
apuntan a él. Los ficheros de código y datos que sirve la URL son byte-idénticos a un build limpio de ese SHA.
El deployment anterior (`dpl_2eiLZExrgQzUrVRUCVusgPCf9Cc5`, `592c0c4`) queda sin alias y como candidato de
rollback; no se tocó. El freeze (`exit 0`) sigue activo.

## Línea Astra

Si una misión pertenece a la línea Astra, puede dejarse preparada para una futura prueba en
ChatGPT Sites, siempre de forma neutral y sin migrarla ni publicarla. Cualquier migración,
publicación o integración específica con ChatGPT Sites requiere una solicitud expresa posterior.

## Comprobación antes de entregar

Antes de cerrar un cambio:

1. confirmar que la rama activa sigue siendo la rama autorizada y que no se ha cambiado su base;
2. confirmar que no se ha hecho merge a `main`;
3. confirmar que no se han incorporado cambios de la otra línea;
4. confirmar que `app/vercel.json` mantiene exclusivamente `**: false` y `main: true` y que, tras cualquier
   merge a `main`, el build generado queda CANCELED y producción no cambia de deployment;
5. ejecutar las validaciones locales aplicables, hacer commit y preparar el pull request desde la
   misma rama de trabajo.
