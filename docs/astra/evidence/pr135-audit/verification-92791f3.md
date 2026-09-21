# Intento de auditoría de persistencia — código `92791f33aba27b675dad63888743d15185ba05a5`

Fecha: 2026-09-21 (UTC)

Esta nota **no sustituye ni reetiqueta** `results.json`, `summary.md`, las capturas ni las trazas existentes: esos artefactos siguen correspondiendo exclusivamente a `79748e85b7884c8f85ea1d71066ae72b72e4bd95`.

## Resultado real

La auditoría nueva no pudo ejecutarse en este contenedor. La instalación de dependencias mediante `npm install`/`npm ci` quedó bloqueada esperando la red del registro y tuvo que interrumpirse. El árbol local carece de `jsdom` y después quedó incompleta la instalación de `@testing-library/react`.

- `npm run lint`: ejecutado; terminó correctamente con cuatro advertencias preexistentes (sin errores).
- `npm run build`: bloqueado en TypeScript por la dependencia de desarrollo local ausente `@testing-library/react`.
- `npm test -- --run src/astra/night-ui-corrections.test.ts`: bloqueado porque el entorno local no contiene `jsdom`.
- `ASTRA_EXPECTED_SHA=92791f33aba27b675dad63888743d15185ba05a5 npm run audit:astra:browser`: no ejecutado, porque requiere primero un build correcto.

## Recorrido preparado, no aprobado

El runner `app/scripts/astra-sol-0-2-browser-audit.mjs` incorpora el recorrido `09-persistence-recovery` para comprobar, a 375×812 px:

1. fallo y reintento en Explorar;
2. un único aviso dentro del diálogo de ficha;
3. fallo y reintento en Nuestro viaje;
4. visibilidad, ancho en viewport y altura táctil mínima de 44 px del botón;
5. desaparición del aviso y restauración del texto de éxito después del reintento.

No se incluyen capturas ni trazas nuevas porque no se generaron. Este commit no debe describirse como auditado hasta ejecutar el runner con el SHA del código indicado y conservar los resultados reales.
