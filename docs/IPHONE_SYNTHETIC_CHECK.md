# Comprobación en iPhone con datos sintéticos (≈10 min)

**Por qué hace falta.** Safari real (macOS 26.6.1) se ha comprobado de extremo a extremo con una sesión de automatización (introducción → favorito → recarga → cambio → recuperación: todo conservado). Lo que **ninguna automatización puede hacer** es cerrar y reabrir Safari con el mismo perfil, y nada de lo anterior es un iPhone. Esta guía cubre sólo eso.

**Garantía de no tocar tus datos.** Los datos de Nihon viven en el *origen* (dirección) donde se abre. Esta guía usa una dirección propia de tu red local (`http://<IP-de-tu-ordenador>:4173`), distinta de `nihon-travel-explorer.vercel.app`; nada de lo que hagas ahí puede leer ni modificar tu viaje real. **No abras la dirección de producción para esta prueba y no borres «Datos de sitios web» de Safari.**

## 1. En tu ordenador (una vez)

```bash
git fetch origin claude/sweet-mendel-v8st6b
git checkout claude/sweet-mendel-v8st6b
cd app && npm ci && npm run build
npx vite preview --host --port 4173
```

Apunta la línea `Network: http://192.168.x.x:4173/` que imprime. El iPhone debe estar en la **misma Wi-Fi**. No se publica nada en Internet.

> Límite conocido: por ser `http` (no `https`), Safari no ofrece `navigator.locks`; Nihon cae a su ruta sin exclusión entre pestañas. Esta prueba valida la conservación con **una** pestaña, que es lo que importa para cerrar/reabrir. La protección entre pestañas se cubre con las pruebas de WebKit/Chromium.

## 2. En el iPhone — qué hacer y qué debe pasar

Usa una pestaña normal de Safari (no privada), abre esa dirección y ve apuntando ✔/✘.

| # | Acción | Debe pasar |
|---|---|---|
| 1 | Abrir la dirección. | Aparece la introducción «Nihon · El cuaderno de vuestro viaje a Japón». |
| 2 | Tocar **Saltar**. | La introducción se cierra (si no se cierra: ✘, anota el modelo y la versión de iOS). |
| 3 | Buscar «Ghibli» y tocar el corazón de **Ghibli Museum, Mitaka**. | El corazón queda activo. |
| 4 | Recargar la página. | El corazón sigue activo y la introducción **no** reaparece. |
| 5 | Cerrar Safari **del todo** (deslizar la app hacia arriba en el selector de apps). Esperar 10 s. Reabrir Safari y volver a esa dirección. | El corazón sigue activo. **Este es el paso que nadie había podido probar.** |
| 6 | Tocar el corazón de Ghibli para quitarlo. Esperar 5 s. Cerrar Safari del todo y reabrir. | Sigue **sin** estar guardado. |
| 7 | Volver a guardarlo, esperar 5 s, recargar. | Sigue guardado. |
| 8 | En **Nosotros**, tocar **Exportar respaldo**. Después, en la misma pantalla, **Importar respaldo**, elegir el archivo descargado y confirmar **Sustituir con este respaldo**. | Se descarga un archivo `nihon-backup-….json`, el resumen muestra tu lugar y al confirmar dice «Respaldo restaurado». |

## 3. Qué contarme

Una línea por paso (✔/✘), modelo de iPhone, versión de iOS y, si algo falla, una captura. Con eso se cierra el único punto que queda sin certificar: **conservación tras cerrar y reabrir Safari en iPhone real**.

Cuando acabes, puedes borrar los datos sintéticos sin riesgo: Ajustes › Safari › Avanzado › Datos de sitios web › busca la IP de tu ordenador y elimínala (no la de `vercel.app`).
