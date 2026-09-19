# Evidencia pendiente — correcciones F01–F09

## Identidad comprobada

- Producto candidato: `0a80f44a6bad44f9c83bb25bf45192c34b7874a1`.
- Ancestro de auditoría requerido: `8350d3ea3b2a7b42dbcc55fe1d2df26815d7795a`.
- Checkout local: rama sintética `work`, árbol limpio al iniciar esta comprobación.
- PR objetivo: `#122`, rama declarada `codex/continuar-proyecto-z3rom4str-desde-astra-redesign`.

Este directorio **no contiene capturas ni traces nuevos**. No debe interpretarse como evidencia visual ni como aprobación de Astra.

## Comprobaciones del entorno

No existe un ejecutable Chromium, Chrome, Edge o Firefox en `PATH`, `/root/.cache`, `/opt`, `/usr/local`, `/usr/lib` ni `/ms-playwright`. Playwright está instalado como dependencia, pero su Chromium compatible no está presente. No se repitió la descarga previamente fallida.

El checkout no tiene ningún remoto Git configurado. GitHub CLI está instalado pero no autenticado (`gh auth status` solicita `gh auth login`) y no existe `GH_TOKEN`. El acceso anónimo a la API de GitHub fue rechazado por el proxy con HTTP 403. Por tanto, desde este entorno no es posible comprobar el OID remoto del head del PR, publicar el commit ni disparar/consultar Actions.

## Workflow real inspeccionado

El workflow es `.github/workflows/astra-sol-0-2-browser-audit.yml`, nombre visible **Astra SOL-0-2 browser audit**. Se activa al abrir, sincronizar, reabrir o marcar listo un pull request hacia `experiment/astra-redesign`. El job **Eight journeys and required viewports**:

1. hace checkout de `github.event.pull_request.head.sha`;
2. exige que ese SHA coincida con `ASTRA_EXPECTED_SHA`;
3. instala dependencias bloqueadas y Chromium;
4. construye la aplicación;
5. ejecuta `app/scripts/astra-sol-0-2-browser-audit.mjs`;
6. publica `astra-sol-0-2-<SHA>` durante 14 días, incluso si falla el journey.

## Acción mínima externa

1. Una persona o sesión con credenciales debe consultar el head actual del PR #122.
2. Si el head remoto todavía no contiene `0a80f44`, debe publicar esta línea **sin force-push y sólo si el remoto no avanzó**. Si avanzó, primero debe conservar e integrar esos commits; no debe sobrescribirlos.
3. El evento `synchronize` ejecutará automáticamente **Astra SOL-0-2 browser audit**. No existe `workflow_dispatch` en el archivo inspeccionado, por lo que no se debe indicar un despacho manual inexistente.
4. Descargar el artefacto `astra-sol-0-2-<SHA>` de esa ejecución y entregar `results.json`, `summary.md`, `runner.log`, `screenshots/` y `traces/` a Astra.

Hasta completar esos pasos, F01–F09 tienen cobertura de código/pruebas reportada, pero su resultado de navegador sigue **PENDING**, no PASS.
