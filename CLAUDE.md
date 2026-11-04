# Reglas de seguridad para Claude en este repositorio

- Nunca hacer `git push` (ni force, ni merge a `main`) sin aprobación explícita de Orchy.
- Nunca tocar producción: nada de desplegar, promover ni cambiar configuración en Vercel o Firebase de producción.
- Nunca borrar datos (de usuarios, de Firestore, el Excel maestro, el registro de fotos ni archivos ajenos).
- Nunca guardar secretos (claves, tokens, `.env`, credenciales) en el repositorio.
- Nunca usar el modo `bypassPermissions` ni desactivar las protecciones del entorno.
