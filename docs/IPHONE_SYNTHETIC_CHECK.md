# Comprobación en iPhone con datos sintéticos (≈10 min, sin PC)

**Qué falta certificar.** Safari real de macOS (26.6.1) ya recorrió introducción → favorito → recarga → cambio → recuperación. Nadie ha podido todavía **cerrar y reabrir Safari con el mismo perfil**, ni probar **dos pestañas** o **exportar/importar** en un iPhone. Esta guía cubre eso, con la build candidata en una URL HTTPS propia (con HTTPS Safari ofrece Web Locks, así que se prueba también la protección entre pestañas).

**Garantía de no tocar tus datos.** Los datos de Nihon viven en el *origen* (dirección). La vista previa se sirve desde un origen **distinto** de `nihon-travel-explorer.vercel.app`, de modo que su almacenamiento empieza vacío (sintético por construcción) y nunca se mezcla con tu viaje real. **No abras la dirección de producción para esta prueba y no borres «Datos de sitios web» de Safari sin mirar el dominio.**

## Estado de la vista previa: preparada, NO publicada

El freeze de Vercel (`docs/DEPLOYMENT_POLICY.md`) prohíbe crear Previews de Vercel o tocar el proyecto sin autorización expresa que nombre el SHA, y no se ha usado. Un túnel efímero desde un runner de CI tampoco se pudo preparar: el entorno de esta sesión deniega abrir una entrada externa. Lo que queda **listo y comprobado** es una publicación en GitHub Pages, que no usa Vercel ni toca producción:

- `.github/workflows/iphone-preview-pages.yml` (solo manual): ejecuta `npm test`, compila con la ruta base del repositorio, escribe `build-info.txt` (SHA y árbol de `app/src`) y despliega en `https://<usuario>.github.io/-nihon-travel-explorer/`.
- La build con esa ruta base se comprobó antes: `scripts/preview-journey-check.mjs` (este mismo guion, automatizado) pasa **10/10** en Chromium contra `vite preview --base /-nihon-travel-explorer/`. Esa comprobación no sustituye al iPhone.

### Autorización que falta (tres pasos, todos del propietario)

1. **Ajuste del repositorio:** Settings › Pages › *Build and deployment* › Source = **GitHub Actions**.
2. **Entorno:** Settings › Environments › `github-pages` › permitir despliegues desde la rama `claude/sweet-mendel-v8st6b` (por defecto sólo `main`).
3. **Autorización expresa** para publicar **este SHA** (el HEAD final está en `docs/PR203_CLOSURE_REPORT.md`) en una URL pública de `github.io`: el sitio contiene sólo la aplicación y su conjunto de datos público, sin datos de usuario ni secretos, y se retira desactivando Pages. Después se ejecuta *Actions › Vista previa HTTPS para iPhone › Run workflow* sobre esa rama (se puede hacer desde la app de GitHub del iPhone).

Alternativa con Vercel: autorización expresa para **un único Preview manual** del SHA indicado, acotando temporalmente el *Ignored Build Step* a ese SHA y restaurándolo a `exit 0` al terminar (el mismo procedimiento ya usado el 2026-10-06).

## Pasos en el iPhone (con la URL de la vista previa)

Primero abre `<URL>/build-info.txt`: debe mostrar el SHA propuesto. Después usa una pestaña normal de Safari (no privada).

| # | Acción | Debe pasar |
|---|---|---|
| 1 | Abrir `<URL>/`. | Introducción «Nihon · El cuaderno de vuestro viaje a Japón». |
| 2 | Tocar **Saltar**. | La introducción se cierra. |
| 3 | Buscar «Ghibli» y tocar el corazón de **Ghibli Museum, Mitaka**. | El corazón queda activo. |
| 4 | Recargar. | Sigue activo y la introducción no reaparece. |
| 5 | Cerrar Safari **del todo** (deslizar la app hacia arriba en el selector). Esperar 10 s. Reabrir y volver a la URL. | Sigue activo. **Es el paso que nadie había podido probar.** |
| 6 | Quitar el corazón, esperar 5 s, cerrar Safari del todo, reabrir. | Sigue **sin** estar guardado. Volver a guardarlo, esperar 5 s, recargar: guardado. |
| 7 | **Dos pestañas:** abrir la URL en una segunda pestaña de Safari. En la segunda, guardar otro lugar (cualquier corazón). Volver a la primera. | La primera muestra los dos lugares tras unos segundos o al recargarla; **no desaparece ninguno**. Repetir al revés. |
| 8 | En **Nosotros › Exportar respaldo**. | Se descarga `nihon-backup-….json` (aparece en Descargas de Archivos). |
| 9 | En **Nosotros › Importar respaldo**, elegir ese archivo y **Sustituir con este respaldo**, luego **Continuar**. | «Respaldo restaurado»; tus lugares siguen ahí tras la recarga. |

## Qué contarme

Una línea por paso (✔/✘), modelo de iPhone, versión de iOS y una captura si algo falla. Para limpiar: Ajustes › Safari › Avanzado › Datos de sitios web › elimina **sólo** el dominio de la vista previa (`github.io`), no el de `vercel.app`.

## Si prefieres no publicar nada

Con un ordenador: `git checkout claude/sweet-mendel-v8st6b && cd app && npm ci && npm run build && npx vite preview --host --port 4173` y abrir en el iPhone la dirección `http://<IP>:4173` (misma Wi-Fi). Al ser `http`, Safari no ofrece Web Locks: los pasos 1–6, 8 y 9 valen; el 7 no ejercita la protección entre pestañas.
