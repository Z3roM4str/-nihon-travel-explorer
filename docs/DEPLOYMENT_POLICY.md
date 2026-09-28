# Política de despliegue

**Vigente desde:** 2026-09-26
**Estado documental:** freeze técnico autorizado, versionado y activo mediante
`app/vercel.json`. Mientras se comparan las alternativas y se elige la implementación definitiva,
solamente `main` puede iniciar un deployment automático.

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

## Línea Astra

Si una misión pertenece a la línea Astra, puede dejarse preparada para una futura prueba en
ChatGPT Sites, siempre de forma neutral y sin migrarla ni publicarla. Cualquier migración,
publicación o integración específica con ChatGPT Sites requiere una solicitud expresa posterior.

## Comprobación antes de entregar

Antes de cerrar un cambio:

1. confirmar que la rama activa sigue siendo la rama autorizada y que no se ha cambiado su base;
2. confirmar que no se ha hecho merge a `main`;
3. confirmar que no se han incorporado cambios de la otra línea;
4. confirmar que `app/vercel.json` mantiene exclusivamente `**: false` y `main: true`;
5. ejecutar las validaciones locales aplicables, hacer commit y preparar el pull request desde la
   misma rama de trabajo.
