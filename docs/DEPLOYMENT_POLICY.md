# Política de despliegue

**Vigente desde:** 2026-09-26  
**Estado:** Vercel congelado hasta que se comparen las alternativas y se elija la implementación
definitiva.

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
