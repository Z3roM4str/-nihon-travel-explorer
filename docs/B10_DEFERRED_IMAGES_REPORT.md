# B10 — activación diferida de imágenes (#177, rama `claude/b10-deferred-images`)

**INCOMPLETO a nivel B10; #177 Draft, sin merge/deploy.** Lote autorizado en [design/09](design/09_DECISIONES_DE_DISENO.md) («autorización del lote de activación diferida de imágenes»). Base exacta `f9949325aea83d45907b7310fa635faf7633716b` (tree `320f45c…`, app `e0e87b8…`; último código de producto probado `26407373059e0f20e6e64e975f7a38eb7da5805f`, app tree idéntico). Código bajo prueba `965acc8c9660fe8515ccbadc7f0cf97028a79079` (tree `98f7c4e0df56382ee0a9abfba84f00cc4711bf94`, app `7192167902cd0a31ff232d2417818e90679e9e71`). [Evidencia](B10_DEFERRED_IMAGES_EVIDENCE.json). No se incorpora main ni P-06; no se tocan datos, fotografías, `package*.json`, `3500000`, `253742`, referencia ni ratchet.

## Qué cambia

| Archivo | Cambio |
|---|---|
| `app/src/useDeferredImageActivation.ts` (nuevo) | Hook y observadores compartidos |
| `app/src/components/PlaceCard.tsx` | `src={photoActive ? cardSrc : undefined}` en las dos variantes; la caja (`ref`) pasa al hook |
| `app/src/useDeferredImageActivation.test.ts` (nuevo), `PlaceCard.test.ts`, `photography-derivatives.test.ts` | Contrato sin DOM; los dos tests que fijaban el literal `src={cardSrc}` fijan ahora el literal nuevo |
| `app/scripts/b10-deferred-images-check.mjs` (nuevo) | Gate del lote, ambos motores, con tres controles negativos |
| `app/scripts/b10-performance-check.mjs` | Sólo el mutante `eager-far-card`: antes forzaba `loading=eager` sobre una imagen lejana con `src`; ahora esa imagen no tiene `src` hasta que su observador la activa, así que el mutante empieza informando toda observación como visible. Presupuesto, techos y criterio de distancia intactos |
| `docs/design/09…`, este informe y la evidencia | Documentación |

## Implementación exacta

- **Observador:** `IntersectionObserver` con `rootMargin: "200% 200% 200% 200%"` (`IMAGE_ACTIVATION_ROOT_MARGIN`): dos alturas arriba/abajo y dos anchuras a los lados de la raíz, y ninguna raíz supera el viewport ⇒ **máximo 2 viewports**.
- **Por tramos.** Con raíz implícita, `rootMargin` no amplía los contenedores con scroll propio: dentro de la lista de la ciudad (`aside.app__sidebar`) o de un carrusel de la portada la anticipación sería cero (se midió: el primer intento activaba sólo lo ya visible). Cada tarjeta se observa respecto de su contenedor con scroll más cercano, ese contenedor respecto del siguiente y el último respecto del viewport; se activa cuando **todos** los tramos están a ≤ 2 viewports. Un carrusel fuera de pantalla no activa sus tarjetas aunque estén a su lado. Sólo cuentan `overflow: auto|scroll`.
- **Compartido y con cuenta de referencias:** un observador por raíz; se crea con la primera suscripción y se desconecta con la última (la portada baja de ~460 observadores posibles a 5–6 con ~110–150 objetivos).
- **Activación de una sola vez.** Se cancelan todas las suscripciones al activarse y al desmontarse la tarjeta; una superficie abandonada no puede iniciar respuestas nuevas.
- **Política de prioridad:** sin cambios. `priority` (primera tarjeta de `PlaceList`) se activa de inmediato con `fetchpriority="high"` y sin `loading`; las demás conservan `loading="lazy"`, así que la petición nace cuando se cumplen *ambos* criterios (el autorizado y la distancia nativa). Las cuatro imágenes de ciudad de la portada (`loading="eager"`) no son tarjetas y no cambian.
- **Se conservan:** `width`/`height`/`sizes`, skeleton, fallback («No se pudo cargar la imagen»), reintento y su foco, créditos, `alt`/nombres accesibles, acceso por teclado.
- **Sin `IntersectionObserver`:** la imagen se activa de inmediato (comportamiento anterior).
- **Fuera del lote, sin tocar:** miniaturas del planner (`OrderedSequenceBuilder`), galería de la ficha, héroes eager.

## G6 — presupuesto

El guard existente (`b10-performance-check.mjs`, contabilidad sin cambios: ventana desde el clic en la ciudad, home-cut tras héroes + 500 ms + cuerpos pendientes, sin excluir respuestas) da **13/13 en Chromium y 13/13 en WebKit**, y de nuevo 13/13 en tres repeticiones adicionales por motor. **Osaka escritorio: 3 356 478 B (Chromium) / 3 315 340 B (WebKit)**, antes 3 862 290 B registrado; límite 3 500 000 B. Tokio y Kioto siguen en el tope (3 499 770 / 3 499 450 B en Chromium: 230 y 550 B de margen). Entrada **157 586 B** gzip ≤ 253 742 (+540 B del hook frente a 157 046).

**Lo que no se reprodujo y por qué importa.** El valor 3 862 290 B no apareció en este contenedor ni en la base sin tocar (13/13). Lo que sí se reproduce, con `--force-effective-connection-type` (distancia nativa de carga diferida de Chromium mayor), es la clase de fallo: la portada de la base descarga 23 → 55 imágenes en móvil (65 en escritorio) y el guard falla «imágenes nuevas a más de 3 pantallas» en los cuatro hubs móviles; con el lote, la misma ejecución da 13/13 y la portada se queda en 12 imágenes (móvil) / 47 (escritorio, Slow-2G) frente a 55 / 65. La atribución previa (ocho respuestas, 546 950 B, de «Menos saturado») queda resuelta *estructuralmente*: ninguna de las ocho se pide hasta entrar en rango. En condiciones normales de red el lote no reduce la portada (20 imágenes en escritorio frente a 18: el margen de 2 viewports activa algo más que la distancia nativa de 4G); su propiedad es el **tope**, independiente de la red y del motor.

### Las ocho imágenes (inicio → fin de respuesta, ms desde la apertura; reloj de pared)

Ninguna se pidió antes de que «Menos saturado» entrase en rango (ambos motores, ambos viewports). Al llevarlo a la vista (escritorio) las ocho se activan a la vez; en móvil sólo caben las primeras y el resto se activa al desplazar el carrusel.

| ID | Chromium móvil | Chromium escritorio | WebKit móvil | WebKit escritorio | Bytes |
|---|---|---|---|---|---|
| JP-004 | 1687→1696 (sección) | 1748→1763 | 2428→2438 | 2673→2723 | 97 826 |
| JP-005 | 1687→1695 | 1748→1761 | 2430→2441 | 2674→2722 | 51 724 |
| JP-011 | 1687→1695 | 1748→1763 | 2430→2441 | 2674→2722 | 62 926 |
| JP-024 | 1687→1695 | 1749→1763 | 3199→3203 (carrusel) | 2674→2722 | 61 220 |
| JP-037 | 2567→2571 (carrusel) | 1749→1764 | 3426→3429 | 2674→2722 | 53 724 |
| JP-046 | 2783→2786 | 1749→1764 | 3653→3657 | 2676→2723 | 67 180 |
| JP-049 | 2999→3002 | 1749→1778 | 3881→3884 | 2676→2726 | 67 476 |
| JP-073 | 3216→3220 | 1749→1778 | 4108→4111 | 2677→2727 | 84 874 |

(Inicio del scroll vertical y horizontal por escenario en la evidencia.) Las fotografías no se modificaron.

## Portada → ciudad inmediata

Gate `b10-deferred-images-check.mjs`, 16 recorridos por motor (2 viewports × 4 hubs × {clic en cuanto la portada empieza a pedir fotos; el mismo con las respuestas de imagen retrasadas 450 ms para que las de la portada sigan *en vuelo* al clic}). El clic se hace dentro de la página, sin esperar a ninguna imagen.

- **Las imágenes de la ciudad se activan con normalidad:** las tarjetas visibles cargan; ninguna a más de 2 alturas por debajo tiene `src` (muestreado en cada paso del scroll, también en la portada); al recorrer la ciudad todas cargan; la primera es la única prioritaria; el resto, `loading=lazy`.
- **Los observadores de la portada no bloquean ni sobreviven:** al clic hay 5–6 observadores (110–150 objetivos); tras abrir la ciudad quedan 0–2, todos con objetivos conectados; 0 huérfanos (objetivo desmontado u observador vivo sin objetivos) al abrir y al final.
- **Atribución:** la creación de cada petición se toma de la intercepción de ruta y su fin de `PerformanceResourceTiming` (los eventos de Playwright llegan con retrasos distintos por motor y dieron atribuciones falsas en WebKit). Toda petición nacida después del clic es de una tarjeta de la ciudad (0 mal atribuidas, 0 duplicados dentro de la ciudad, 0 fallos).
- **Bytes, sin excluir nada:** con clic inmediato y respuestas normales, ventana = ciudad (Chromium 3 499 770 / 3 499 450 / 3 356 478 / 2 903 352 B para Tokio/Kioto/Osaka/Okinawa; WebKit 2 825 186–3 438 492 B), 0 respuestas tardías de portada. **Con las respuestas retrasadas, las de la portada terminan dentro de la ventana de la ciudad y se cuentan íntegras** (Chromium: 11 respuestas/694 198 B en móvil, 18/1 130 404 B en escritorio; WebKit: 2/130 350 B y 18/1 143 848 B): la ventana total supera 3 500 000 B en los 8 recorridos retrasados de Chromium y en 5 de 8 de WebKit (p. ej. Osaka móvil 4 050 676 B = ciudad 3 356 478 + portada tardía 694 198) y la parte de la ciudad queda ≤ 3 500 000 B en los 32. **El gate afirma lo segundo (la parte atribuida a la ciudad) y registra lo primero; no es un resultado verde del total.** Tokio y Kioto están en el tope sin la portada, de modo que ninguna respuesta de portada que aterrice tras el clic puede caber, con ningún diseño que conserve las cuatro imágenes eager de la portada; sólo cancelar cargas en vuelo de una superficie abandonada lo evitaría, y eso queda fuera del lote autorizado. Decisión de Producto pendiente si ese criterio debe pasar a ser norma.

## Cuatro hubs, ambos motores

Tokio, Kioto, Osaka y Okinawa × Chromium 141.0.7390.37 y WebKit 26.5 × móvil (390×844@2) y escritorio (1440×900@1): carga de visibles, activación diferida de no visibles, observadores sin huérfanos, presupuesto (guard existente) y, en un hub (Osaka), fallback, reintento y créditos.

- **Fallback y reintento (ambos motores, ambos viewports):** se abortan las URL de una tarjeta cercana (índice 2) y de una lejana (índice 52 de 53) que la portada no había descargado. La lejana no tiene `src` antes de llegar; al llegar se activa, falla y muestra «No se pudo cargar la imagen» con «Reintentar fotografía de …»; con el servidor recuperado, el reintento carga la imagen en ambas, el foco vuelve a la acción de abrir y la acción desaparece (2 intentos fallidos + 2 correctos por URL).
- **Créditos:** la ficha conserva el control de créditos y la hoja con licencia/atribución.

## Controles negativos

| Control | Resultado |
|---|---|
| `always-intersecting` (todo se activa) ×2 motores | detectado: muestras con `src` a más de 2 alturas |
| `no-disconnect` ×2 | detectado: observadores huérfanos |
| `wide-margin` (1000 %) ×2 | detectado: margen distinto de 200 % |
| `negative-eager-photo` (guard existente, adaptado) | detectado: «imágenes nuevas a más de 3 pantallas» |
| Los otros diez controles heredados | 9 detectados bajo Chromium 141; `negative-scroll-chromium` **no detectado bajo Chromium 141** y **detectado bajo Chromium 151.0.7922.34** (ver «Recertificación») |

Los tres controles nuevos se ejecutan acotados a los dos recorridos de Osaka (`NIHON_B10_DEFERRED_ONLY`).

## Gates y estado

Build, `tsc -b`, lint (0 errores; avisos preexistentes), Vitest **120 archivos / 3 442 tests PASS** (base 119 / 3 430). Regresión: **85 trabajos = 68 positivos, 68 PASS; 17 negativos, 16 detectados, 1 no detectado** (resultado bajo Chromium 141, conservado; el no detectado quedó cerrado bajo Chromium 151, ver «Recertificación»). Lista completa e intentos en la evidencia.

Hechos que no quedan verdes y no se ocultan:

1. **[CERRADO por la recertificación con Chromium 151; se conserva el hecho original]** **`negative-scroll-chromium` no detecta su mutante en este Chromium 141** (`overscroll-behavior-y:contain` no cambia el encadenado de la rueda). Ocurre **igual sobre la base `f994932` sin cambios**; la certificación anterior usó Chromium 151.0.7922.34, que este contenedor no ofrece. WebKit lo detecta. No es una regresión del lote, pero el control no queda demostrado en Chromium aquí.
2. Seis gates `b18-*` fallaron la primera vez en <1 s por `ERR_CONNECTION_REFUSED` (sin servidor en `localhost:4181`); con `vite preview` en ese puerto sobre el mismo `dist` pasan. Ambos intentos están en la evidencia.
3. Entorno distinto al de la certificación anterior (Chromium 141 en lugar de 151; Node 22.22 en lugar de 24.19; WebKit descargado a un directorio de trabajo). Los registros TLS externos (`ERR_CERT_AUTHORITY_INVALID` hacia fuentes/OSM) no afectan a los resultados.
4. F01–F12 **NO EJECUTADO** (hardware real); OSM-TLS Chromium sigue siendo un bloqueo externo independiente; G4/CSS y OD-01 POST-V1/DIFERIDO sin cambios.

## Riesgos de producto a conocer

- Una foto de un carrusel o de la lista se activa a ≤ 2 anchuras/alturas de su contenedor: no hay *pop-in* mientras el desplazamiento no supere esa distancia; un salto mayor (anclas «Saltar a…») muestra el skeleton unos ms, como antes.
- Una pestaña oculta (`display:none`) ya no activa nada hasta mostrarse (la carga nativa tampoco lo hacía).
- La impresión de una página con tarjetas aún no activadas no incluye esas fotos (igual que con `loading=lazy`).

## Recertificación `negative-scroll-chromium` (Chromium 151.0.7922.34)

Sin cambios de producto: el tree de `app/` es idéntico al de `2181a686c0a3c291e2bc34d8e418489f37114cc7` (`7192167902cd0a31ff232d2417818e90679e9e71`). Sólo cambia documentación/evidencia.

**Historia completa (ninguna fila se borra):**

| Navegador | Código | Control normal | Mutante `contained` | Conclusión |
|---|---|---|---|---|
| Chromium 141.0.7390.37 | rama Claude | PASS | **NO detectado** (PASS) | `negative-scroll-chromium` NEGATIVE-MISSED |
| Chromium 141.0.7390.37 | base `f9949325` | PASS | **NO detectado** (PASS) | idéntico: no era regresión del lote |
| Chromium 151.0.7922.34 | `2181a686` | PASS (exit 0, 320/390) | **detectado** (exit 1, `waitForFunction: Timeout 10000ms exceeded`, `after=0`) | control demostrado |
| Chromium 151.0.7922.34 | base `f9949325` | PASS (exit 0) | **detectado** (exit 1, mismo timeout) | control demostrado |

El único pendiente del lote queda **CERRADO**. Chromium 151.0.7922.34 es el motor de la certificación anterior; se obtuvo como Chrome for Testing 151.0.7922.34 (linux64) fuera del repositorio y se pasó al script con `NIHON_CHROMIUM_PATH`. Node v22.22.0, Playwright 1.62.1; build de producción con `npm ci && npm run build` en `app/` y `vite preview` del propio script.

Comandos exactos (desde `app/`; `<chrome151>` = binario `chrome` de Chrome for Testing 151.0.7922.34):

```
NIHON_CHROMIUM_PATH=<chrome151> NIHON_B10_OUT=<salida> node scripts/b10-embedded-scroll-check.mjs
NIHON_SCROLL_MUTANT=contained NIHON_CHROMIUM_PATH=<chrome151> NIHON_B10_OUT=<salida> node scripts/b10-embedded-scroll-check.mjs
```

Para `f9949325` se ejecutaron los mismos dos comandos en un worktree desechable de ese SHA, con su propio `npm run build`.

**Estado final del lote:**

* Positivos **68/68 PASS** (regresión completa, Chromium 141).
* Negativos **17/17 detectados bajo el navegador de certificación correspondiente**: 16 en la regresión bajo Chromium 141 y `negative-scroll-chromium` bajo Chromium 151.0.7922.34 (el control no es detectable en 141 ni en la base; WebKit lo detecta).
* G6 fotográfico del guard existente **13/13 en Chromium y 13/13 en WebKit**.
* Activación diferida certificada (ver arriba).
* #177 se actualizó antes mediante fast-forward no forzado a `2181a686`; ningún cambio de producto durante esta recertificación.
* Siguen como antes: F01–F12 NO EJECUTADO, OSM-TLS Chromium externo, G4/CSS y OD-01 POST-V1/DIFERIDO; #177 Draft, sin merge/deploy.
