# Auditoría final — investigación del gate de rendimiento (B10.3)

**Fecha:** 2026-10-06 · **Base investigada:** `32787a1661665f53bba5dfcf73d630709a698ad2` (sin cambios de producto) ·
**Gate:** `app/scripts/b10-performance-check.mjs` · **Navegador:** Chromium 141 (Playwright 1.62.1), Linux.

La auditoría independiente conservó tres fallos del gate original (10/13): presupuesto de imágenes de
**Kioto móvil** (4.132.690 B) y **Osaka móvil** (3.589.036 B) sobre 3.500.000 B, y la comprobación de carga
diferida de **Tokio móvil** (una imagen a 2539 px, 7 px más allá de tres pantallas de 844 px). Su medición
independiente, atribuyendo cada respuesta al instante en que empezó su petición, dio 3.438.492 B (Kioto) y
3.315.340 B (Osaka), pero el informe dejó la causa como hipótesis. Este documento la separa de la hipótesis.

**No se aumentó ningún presupuesto, no se tocó ningún asset ni dato, y los resultados originales se conservan**
(`docs/final-audit-evidence/base/performance-original.{log,json}`, y el log del informe de auditoría).

## 1. Contrato de la medición (definido, porque no estaba escrito en el código)

Fuente: `docs/design/06_ESTRATEGIA_FOTOGRAFICA.md` §6.3 («recorrer una ciudad completa no debe superar 3,5 MB de
imágenes»), `docs/DDR-MERGE-1_PRESUPUESTO_FOTOGRAFIA_HUB.md` (opción 1: «vaciar el registro justo antes del clic en
el hub») y el comentario de cabecera del gate («desde el clic en la ciudad hasta el final de la lista»).

| Elemento | Definición |
|---|---|
| **Inicio** | El **evento `click` real** sobre la tarjeta del hub. Un listener en captura dentro de la página lo sella con `Date.now()`. |
| **Fin** | Tras recorrer la lista hasta el final (scroll del contenedor) y 700 ms de asentamiento. |
| **Atribución** | Por el instante en que **se inició la petición** (`request.timing().startTime`; respaldo: `Date.now()` en el evento `request`). Pertenece a la **ciudad** si empezó en el clic o después; a la **portada** si empezó antes. |
| **Superficie** | Portada de Explorar (antes del clic) / lista de la ciudad (después). El presupuesto de 3,5 MB sólo se aplica a la segunda. |

El gate original hacía otra cosa: vaciaba el registro **antes de llamar a `btn.click()`** y atribuía cada imagen al
instante en que **terminaba de leerse su cuerpo**.

## 2. Causa confirmada de los dos fallos de presupuesto

`btn.click()` de Playwright no es el clic: antes comprueba actionability y hace **scroll hasta el botón** (la tarjeta
de Osaka/Kioto queda en la parte baja de la portada: `y = 793` en un viewport de 844). Ese scroll de la portada
acerca imágenes `loading="lazy"` de **otras ciudades** al margen de carga del navegador, que las pide **antes del
evento de clic** pero **después** de que el gate vació su registro. El gate las sumaba a la ciudad recorrida.

Medición (base, sin modificar; `app/scripts/final-audit-performance-attribution.mjs`, que replica el procedimiento
del gate y añade la atribución del contrato):

| Condición | Resultado de la base |
|---|---|
| Osaka móvil, 12 ejecuciones, equipo normal | El gate original dio 3.630.174 B (**excede**) en **2/12**; las otras 10, 3.356.478 B. Con el contrato (petición iniciada en el clic real): **3.356.478 B en 12/12**. |
| Qué eran los 4 archivos de más | `cat-street-harajuku`, `nezu-shrine-romon-gate`, `takeshita-street-west-view`, `tokyo-metropolitan-government-observatory` (**Tokio**, 273.696 B). Peticiones iniciadas **2–7 ms antes** del evento de clic (55–87 ms después de la llamada del script). Al final no queda ningún `<img>` suyo en el DOM: son de la portada, que se desmonta. |
| Kioto y Tokio móvil, CPU ×4 (equipo lento/cargado), 4 ejecuciones | El gate original dio **4.193.648 B (Kioto) y 4.193.968 B (Tokio), 4/4 en exceso**. Con el contrato: **3.499.450 B y 3.499.770 B**. La diferencia es siempre **694.198 B = 11 imágenes** de la portada iniciadas ~1,2 s antes del clic, mientras Playwright esperaba la estabilidad del botón. |
| Concordancia con la auditoría | Kioto: 4.132.690 − 3.438.492 = **694.198 B** (idéntico). Osaka: 3.589.036 − 3.315.340 = **273.696 B** (idéntico). Los importes absolutos difieren (otro equipo, otro instante del scroll); las diferencias coinciden al byte. |

**Conclusión (causa, no hipótesis):** los dos excesos de presupuesto son un error de atribución del gate, no
bytes de la ciudad. Los hubs más pesados cuestan **Tokio 3.499.770 B, Kioto 3.499.450 B, Osaka 3.356.478 B**
(móvil) — los mismos importes que el pipeline fija como tope (`DDR-MERGE-1`, `BLOCK_22_B6_5_REPORT`) y por debajo de
3.500.000 B, aunque **Tokio y Kioto siguen a 230 B y 550 B del límite**: no hay margen, y cualquier imagen nueva en
esos hubs superaría el presupuesto real. No existe un exceso real que corregir en el producto.

(Variación aparte, **no** atribuible a la ventana: Okinawa móvil alterna 2.903.352 B / 45 imágenes y 3.177.048 B /
49 imágenes entre ejecuciones con idéntica atribución por inicio de petición; depende de cuántas imágenes `lazy`
alcanza el scroll del gate a 110 ms por paso. Ambas cifras están bajo el presupuesto. Se deja registrada, sin
corregirla.)

## 3. Corrección del gate (sólo el instrumento)

`b10-performance-check.mjs`: el inicio pasa a ser el evento de clic real y la atribución, el inicio de la petición
(definición de §1). **Presupuestos y umbrales sin cambios** (3.500.000 B, 285.000 B, 28.500 B, 200 KB, 2,5×). Lo que el
procedimiento anterior habría sumado de más se **informa aparte** («de la portada, no sumadas») para que no
desaparezca silenciosamente.

| Gate | Resultado |
|---|---|
| Original (base), este equipo | 12/13 (Osaka móvil por la fuga de 273.696 B) — el equipo de la auditoría: 10/13 |
| Corregido, equipo normal | **13/13**; sin fugas de la portada en la ventana |
| Corregido, CPU ×4 (`NIHON_CPU_THROTTLE=4`) | **13/13**, informando 11–26 imágenes (0,69–1,68 MB) de la portada que el original habría contado |

## 4. Carga diferida (Tokio móvil): comportamiento del navegador frente a carga anticipada del producto

**No se reproduce** el fallo de Tokio en este entorno: en 5/5 ejecuciones la imagen cargada más lejana de Tokio móvil
está a 1673 px (1,98 pantallas) y la de Kioto a 2020 px (2,39). Por tanto la causa exacta del fallo de la auditoría
**no queda demostrada**; lo que sí está demostrado es lo siguiente:

1. **El producto no carga por anticipado.** En cada ciudad medida, de todas las imágenes de tarjeta **exactamente una**
   carece de `loading="lazy"` y esa tiene `fetchpriority="high"` (la primera tarjeta visible, `06 §6.3`/`PlaceCard`).
   Esta condición —ninguna imagen de tarjeta sin `lazy` salvo la prioritaria, y como mucho una prioritaria— es la que
   mide ahora el gate como defecto del producto, y la corrección la cumple en las 8 combinaciones ciudad × viewport.
2. **El margen de `loading="lazy"` de Chromium depende de la conexión efectiva.** Control sin la aplicación (una
   página con 40 imágenes `lazy` de 800 px de alto, 390×844; `app/scripts/final-audit-lazy-margin-control.mjs`): sin limitación Chromium cargó
   hasta la imagen que empieza a **1600 px (1,90 pantallas)**; con **3G emulada**, hasta **3200 px (3,79 pantallas)**,
   es decir, margen de 1250 px frente a 2500 px más allá del viewport. Una imagen `lazy` a 3,01 pantallas —como la del
   informe— cae dentro del margen de una conexión lenta: es comportamiento permitido del navegador.
3. **La distancia de «3 pantallas» era frágil:** 3 × 844 = 2532 px está a unos 30 px del margen lento de Chromium
   (2500 px sobre el viewport implica cargas hasta 3344 px) y se medía **después** de cargar, cuando las imágenes
   superiores ya han empujado el layout. Esa distancia, por sí sola, no puede probar un defecto.

**Cambio en el gate** (la aserción se **separa**, no se relaja sin evidencia): se mantiene el fallo si alguna imagen
cargada a más de 3 pantallas **no** es `loading="lazy"` o queda más allá de `viewport + 2500 px`, y se añaden dos
fallos estructurales (imagen de tarjeta sin `lazy` que no es la prioritaria; más de una tarjeta prioritaria). Las
imágenes `lazy` a más de 3 pantallas pero dentro del margen del navegador se **informan** sin fallar. Límite: el
margen de 2500 px es el de Chromium; WebKit no se midió (ver limitaciones).

## 5. Limitaciones

- Medido en Chromium 141 local. El gate admite `NIHON_BROWSER=webkit`, pero WebKit no está instalado en este
  entorno y `p06-certification.yml` no ejecuta el gate de rendimiento.
- La causa del fallo de Tokio de la auditoría no se reprodujo (§4): se descartó el producto como origen (la prueba
  estructural) y se acotó el comportamiento del navegador (el control), pero no se observó el fallo original.
- Los importes de la auditoría (4.132.690 y 3.589.036) no se reprodujeron en valor absoluto, sólo en mecanismo y en
  diferencia exacta.
- La portada descarga hasta ~1,7 MB de imágenes de otras ciudades bajo CPU lenta. No es objeto del presupuesto de
  3,5 MB por ciudad (`DDR-MERGE-1` §6 opción 4 propone un presupuesto propio de la portada); queda como decisión de
  diseño pendiente, no como defecto de esta entrega.
