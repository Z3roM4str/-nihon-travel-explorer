# Auditoría local de Astra, PR #139

- Worktree: `C:\Users\Fer\.codex\worktrees\astra-pr139-audit\nihon`
- Rama: `codex/completa-pr-#135-de-astra-16422227132192129267`
- SHA probado: `9408e27ec279e6ec80bd27632e656d4f6c265384`
- La API pública de GitHub confirmó este mismo SHA como HEAD del PR #139 y de su rama durante esta revisión. El cliente Git continúa sin acceso al remoto.

## Entorno y ejecución

- `NODE_USE_SYSTEM_CA=1` se fijó solo en las sesiones PowerShell que descargaron paquetes.
- `npm ci`: código 0; `npm ls --depth=0`: código 0. No se cambiaron `package.json` ni `package-lock.json`.
- `npx playwright install chromium`: código 0, Chromium revisión 1234, Chrome for Testing 151.0.7922.34.
- Arranque y cierre de `chromium.launch({headless:true})`: código 0.
- `npm run build`: código 0.
- `npm run audit:astra:browser`: código 0; nueve de nueve recorridos PASS. Véanse `results.json`, `summary.md`, `screenshots/` y `traces/`.
- Las comprobaciones visuales complementarias de recuperación en Explorar, ficha y Nuestro viaje pasaron; véase `visual-recovery-checks.json` y `screenshots/visual-*-recovered-mobile.png`.

## Revisión visual independiente

Se inspeccionaron las capturas nuevas de 320, 375, 390 y 430 px, tablet 768 y 1024 px, escritorio 1440 px, y los estados de fallo y recuperación de guardado en las tres superficies. La cuadrícula cambia a una columna en móvil, dos en tablet y tres en escritorio. Las alertas de fallo y sus botones de reintento se ven dentro del ancho móvil; tras el reintento, la alerta desaparece. En Nuestro viaje vuelve el mensaje de guardado en el dispositivo.

**Hallazgo visual:** a 320 px, se recorta el texto seleccionado de los dos selectores rápidos de Explorar (por ejemplo, el recuento de «Todo Japón» y «Todas las experiencias»). La captura `screenshots/01-reflow-320.png` conserva el estado. La regla `@media(max-width:360px)` de `app/src/astra/astra.css` dispone `.astra-quick` en una columna, pero una regla posterior `@media(max-width:767px)` la devuelve a dos columnas y prevalece también a 320 px. El recorrido automático 01/08 solo comprueba desbordamiento horizontal; por eso pasó. No se modificó CSS ni el runner.

Las barras fijas que aparecen superpuestas a mitad de las capturas de página completa reflejan su posición visible al momento de capturar una página desplazada; no constituyen por sí solas una comprobación de solapamiento en el viewport. La revisión visual no certifica por sí sola accesibilidad, atribución ni correspondencia editorial de cada fotografía.

## Acceso a GitHub

- Git con `http.sslBackend=schannel`: `SEC_E_NO_CREDENTIALS` durante TLS.
- Git con backend OpenSSL solo para diagnóstico: `unable to get local issuer certificate`.
- Una conexión HTTPS con Node y `NODE_USE_SYSTEM_CA=1` obtuvo respuesta 200 de GitHub y mostró un certificado de `github.com` emitido por `Norton Web/Mail Shield Root` para inspección TLS. No se configuró certificado cliente explícito en Git.
- `gh auth status` informó que su token guardado es inválido; es un problema separado de los fallos TLS de Git. No se mostraron ni borraron credenciales, ni se cambió la configuración TLS global.
