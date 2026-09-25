# PR #139: auditoría local tras corregir los selectores

## Identidad y secuencia

- Auditoría original: `9408e27ec279e6ec80bd27632e656d4f6c265384`, 9/9 PASS automáticos, con recorte visual de los selectores rápidos a 320 px. Evidencia conservada en `../pr139-local-9408e27-20260923/` por el commit `b0e1ad4a40b8c5730790e59e65535bb074147451`.
- Corrección CSS: `95377a20ab06868ac0e5e631a92109a15f08686c`. El checkout estaba limpio antes de repetir el runner; `ASTRA_EXPECTED_SHA` fue ese SHA completo.
- Auditoría corregida: `results.json` registra 9/9 PASS y `summary.md`, `screenshots/` y `traces/` conservan la salida del runner.

## Causa y corrección mínima

La regla `@media(max-width:360px)` de `app/src/astra/astra.css` pedía una columna, pero una regla posterior `@media(max-width:767px)` volvía a imponer dos columnas también a 320 px. El commit de corrección retiró la declaración redundante del bloque de 360 px y añadió, después de la regla de 767 px, `@media(max-width:480px){.astra-quick{grid-template-columns:1fr}}`. Los anchos mayores mantienen su disposición anterior.

## Verificación funcional y visual

`selector-verification/selector-checks.json` registra, para 320, 375, 390, 430, 768, 1024 y 1440 px, cero desbordamiento horizontal, altura de ambos controles de al menos 44 px, espacio suficiente para el texto seleccionado y cambio/restauración de valor en ambos selectores. Las siete capturas de viewport de ese directorio y las siete capturas nuevas del recorrido 01 se inspeccionaron visualmente: «Todo Japón (214)» y «Todas las experiencias» se muestran completos en todos los tamaños. A 320–430 px los selectores se apilan; a 768–1440 px conservan el diseño anterior. Las capturas nuevas de fallo de guardado en Explorar, ficha y Nuestro viaje mantienen aviso y reintento visibles; la captura final de Nuestro viaje muestra la recuperación. Las barras fijas en capturas de página completa reflejan su posición durante el desplazamiento.

## Comprobaciones

- `npm run lint`: código 0, cuatro advertencias ya presentes en TSX.
- `npm test`: código 1, tres fallos de pruebas de lectura literal del código fuente por finales de línea CRLF en este checkout Windows (dos de OrderedSequenceBuilder y una de feb-mar-status). El único archivo de código modificado entre la evidencia original y la nueva auditoría fue `app/src/astra/astra.css`; no se tocaron ni debilitaron las pruebas.
- `npx vitest run src/astra --reporter=dot`: código 0, 5 archivos y 24 tests PASS.
- `npm run build`: código 0, con el aviso existente de chunk inicial mayor de 500 kB.
- `npm run audit:astra:browser`: código 0, nueve recorridos PASS desde el SHA corregido.

## Publicación pendiente

El cliente Git sigue bloqueado por TLS (`schannel: SEC_E_NO_CREDENTIALS`; OpenSSL no valida el emisor local de Norton) y el token guardado de `gh` es inválido. La API pública confirmó antes de los commits locales que el HEAD del PR #139 era el SHA original `9408e27ec279e6ec80bd27632e656d4f6c265384`. No se hizo push, merge ni otro PR. Antes de publicar, verificar de nuevo el HEAD remoto, resolver TLS/autenticación por los mecanismos autorizados y trasladar estos commits locales a la rama del PR.
