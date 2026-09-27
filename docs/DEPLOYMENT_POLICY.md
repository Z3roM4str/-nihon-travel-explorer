# Política de despliegue

**Vigente desde:** 2026-09-26  
**Estado documental:** Vercel congelado hasta que se comparen las alternativas y se elija la
implementación definitiva. Esta regla limita las acciones de quienes trabajan en el repositorio,
pero **no constituye todavía un freeze técnico**: la integración externa entre GitHub y Vercel
sigue activa.

## Fuente de verdad y línea de trabajo

- GitHub es la fuente de verdad del proyecto.
- Cada alternativa debe continuar únicamente en su rama y sobre la base que tenga asignadas.
- No se debe hacer merge a `main` como parte del trabajo de una alternativa.
- Las líneas Astra y Claude son independientes: no se deben mezclar commits, código ni decisiones
  entre ellas.
- Los cambios deben publicarse únicamente en la rama de trabajo autorizada.

## Congelación de Vercel

Hasta autorización expresa posterior:

- no desplegar previews ni producción en Vercel;
- no modificar proyectos, deployments, dominios ni configuración de Vercel;
- no modificar ni crear `vercel.json`;
- no añadir adaptadores, workarounds ni otras soluciones específicas de Vercel.

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
GitHub Actions, hooks versionados ni scripts de `package.json` que invoquen Vercel. Por tanto, el
repositorio **no contiene el activador** del Preview; el vínculo y su política de auto-deploy viven
en la configuración externa del proyecto de Vercel y de su GitHub App.

Para conseguir un **freeze técnico real**, una persona autorizada debe cambiar externamente la
configuración Git del proyecto de Vercel: deshabilitar los despliegues automáticos de Preview para
las ramas/PR de estas alternativas o hacer que esas ramas se ignoren. No debe desconectar el
repositorio completo si se pretende conservar el mecanismo de producción. Esta intervención queda
pendiente y no está autorizada por este documento.

El alcance depende del ajuste elegido:

- una regla que ignore solamente las ramas de trabajo detiene sus futuros Previews sin cambiar por
  sí misma el dominio ni el deployment que ya sirve producción;
- desconectar la integración Git completa también detiene los despliegues automáticos de la rama
  de producción y exige un mecanismo autorizado alternativo para futuras publicaciones;
- una regla de exclusión demasiado amplia puede omitir validaciones Preview legítimas o impedir
  que una revisión necesaria se despliegue; una regla demasiado estrecha puede dejar otras ramas
  generando Previews.

Hasta que un responsable autorizado realice y verifique ese ajuste externo, cada push a una rama o
PR conectado puede seguir generando un Preview aunque cumpla íntegramente este documento. No se
deben eliminar deployments ni alterar Vercel, su GitHub App, dominios o producción como parte de
esta actualización documental.

## Línea Astra

Si una misión pertenece a la línea Astra, puede dejarse preparada para una futura prueba en
ChatGPT Sites, siempre de forma neutral y sin migrarla ni publicarla. Cualquier migración,
publicación o integración específica con ChatGPT Sites requiere una solicitud expresa posterior.

## Comprobación antes de entregar

Antes de cerrar un cambio:

1. confirmar que la rama activa sigue siendo la rama autorizada y que no se ha cambiado su base;
2. confirmar que no se ha hecho merge a `main`;
3. confirmar que no se han incorporado cambios de la otra línea;
4. confirmar que no se ha tocado Vercel ni se ha creado configuración específica del proveedor;
5. ejecutar las validaciones locales aplicables, hacer commit y preparar el pull request desde la
   misma rama de trabajo.
