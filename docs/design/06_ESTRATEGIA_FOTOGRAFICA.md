# 06 — Estrategia fotográfica

La fotografía deja de ser un adorno del dataset y pasa a ser la superficie del
producto (Art. 2).

---

## 1. Punto de partida, medido

Cifras reales de `photography-metadata.json` y `places.json` en v1.1.0:

- **163 imágenes** para **157 lugares** de 214.
- **151 lugares tienen exactamente una** imagen. **6 tienen dos. Ninguno tiene tres.**
- **57 lugares no tienen ninguna.**

Por nivel editorial:

| Grado | Total | 0 fotos | 1 foto | 2 fotos |
|---|---|---|---|---|
| **S** — Imprescindible | 32 | **4** | 22 | 6 |
| **A** — Muy recomendable | 147 | **35** | 112 | 0 |
| **B** — Recomendable | 25 | **8** | 17 | 0 |
| **C** — Opcional | 6 | **6** | 0 | 0 |
| **D** — Prescindible | 4 | **4** | 0 | 0 |

Por ciudad (0 / 1 / 2+): Tokio 16/40/1 · Osaka 15/35/3 · Okinawa 14/36/0 ·
Kioto 12/36/1 · Sapporo 0/2/1 · Nagoya 0/1/0 · Fukuoka 0/1/0.

**Lectura.** El problema no es la cantidad total: es que **cuatro lugares
imprescindibles no tienen ninguna imagen** y que **el 96 % del catálogo se explica con
una sola fotografía**. Una imagen dice qué es un sitio; no dice cómo se vive.

---

## 2. Roles de imagen

Cada fotografía adquiere un **rol** explícito. Es el cambio que impide rellenar
galerías con variaciones del mismo encuadre.

| Rol | Qué muestra | Ejemplo |
|---|---|---|
| `identity` | El plano que identifica el lugar sin dudas. **Es siempre la portada.** | La fachada del Senso-ji |
| `experience` | Cómo se vive: gente, escala, actividad, recorrido | El nakamise lleno a media mañana |
| `detail` | Interior, detalle, objeto o textura que justifica la visita | El incensario, un exvoto, una sala |
| `context` | Entorno, paisaje o vista que sitúa el lugar | El barrio desde arriba |
| `seasonal` | El lugar en la ventana del viaje (invierno / principios de primavera) | Nieve, ciruelo en flor |

**Cambio de datos requerido** (mínimo y aditivo): añadir `role` a cada registro de
`data/visual/photography-metadata.json`. Los 163 registros existentes se clasifican
una sola vez; por defecto, la primera imagen de cada lugar es `identity`.

### Regla de complementariedad

> **Dos fotografías excelentes valen más que tres casi iguales.**

Una imagen sólo se añade si su rol **no está ya cubierto** para ese lugar. Una segunda
imagen del mismo encuadre, la misma hora y la misma distancia **se rechaza**, aunque
esté disponible y bien licenciada. Es criterio de revisión, no una sugerencia.

Orden de galería: `identity` → `experience` → `detail` / `context` → `seasonal`.

---

## 3. Objetivos de cobertura por nivel

| Nivel | Objetivo | Estado | Falta |
|---|---|---|---|
| **S** — Imprescindible (32) | **3 imágenes**: identity + experience + una tercera | 34 imágenes | ~62 |
| **A** — Muy recomendable (147) | **1 garantizada**; **2** para los subconjuntos «Popular / turístico» y «Hidden Gem real» | 112 con una | 35 con cero, + segundas |
| **B** — Recomendable (25) | **1** | 17 con una | 8 |
| **C / D** (10) | **1** | 0 | 10 |

### Orden de adquisición (backlog priorizado)

1. **Los 4 lugares grado S sin ninguna fotografía.** Es el peor defecto del catálogo:
   un imprescindible sin imagen.
2. **Los 35 lugares grado A sin fotografía.** Mayor impacto por unidad de esfuerzo:
   son el grueso de lo que la gente ve al recorrer una ciudad.
3. **Los 8 grado B sin fotografía.**
4. **Segunda imagen (`experience`) para los 32 grado S.**
5. **Tercera imagen para los grado S** donde exista material que aporte un rol nuevo.
6. **Los 10 grado C/D sin fotografía.**
7. **Segunda imagen para los A «Popular / turístico» y «Hidden Gem real».**

Los pasos 1–3 cierran el agujero de cobertura (**53 imágenes**) y eliminan por completo
el estado «sin fotografía» del catálogo salvo C/D. Los pasos 4–5 crean la experiencia
de galería que hoy no existe.

---

## 4. Licencias y procedencia

Se conserva íntegro el régimen actual, que es correcto:

- **Sólo** fuentes con licencia verificable: dominio público, CC0, CC-BY, CC-BY-SA.
- **Nunca** una fotografía de otro lugar como sustituto.
- **Nunca** imágenes generadas por IA. Nihon muestra Japón, no una idea de Japón.
- Todo registro conserva `source`, `sourceUrl`, `credit`, `license`, `licenseUrl`,
  `originalTitle`, `attributionTitle` y `processing`.
- La atribución se muestra **íntegra** en `CreditsSheet`; lo que cambia es **dónde**,
  no **si**.
- El `alt` es descriptivo y específico del lugar, nunca el nombre repetido.

---

## 5. Presentación

### 5.1 En tarjeta

- Proporción **4:3** en teléfono, 16:9 desde `sm`.
- Sólo la imagen `identity`. **Nunca** un carrusel dentro de una tarjeta de lista:
  el deslizamiento horizontal compite con el scroll vertical y rompe el recorrido.
- Indicador de que hay más: un pequeño contador `3 fotos` abajo-derecha cuando el
  lugar tiene más de una. Es información, no un control.
- `--scrim-bottom` obligatorio bajo el nombre.

### 5.2 En ficha

- Galería a sangre **4:5** en teléfono, 4:3 en panel.
- Deslizamiento nativo con `scroll-snap-type: x mandatory`.
- Contador `1/3` siempre que haya más de una; puntos sólo con ≤5 imágenes.
- Toque → lightbox con imagen original, pellizco para ampliar, deslizar abajo para
  cerrar.
- Créditos detrás de `ⓘ`.
- Se conservan: navegación con flechas del teclado, trampa de foco del lightbox,
  devolución del foco al cerrar, y el anuncio `role="status"` de «imagen n de m».

### 5.3 Comportamiento según cantidad

| Imágenes | Tarjeta | Ficha |
|---|---|---|
| 0 | `PhotoPlaceholder` | `PhotoPlaceholder` a tamaño de galería, con `imageBrief` |
| 1 | imagen, sin contador | imagen fija, sin puntos, sin contador, sin flechas |
| 2 | imagen + «2 fotos» | galería con 2 puntos |
| 3–5 | imagen + «n fotos» | galería con n puntos + contador |
| 6+ | imagen + «n fotos» | contador, sin puntos |

### 5.4 Sin fotografía

`PhotoPlaceholder` (`04 §9`). Tres condiciones obligatorias:

1. Debe parecer **deliberado**, no roto.
2. Debe decir **qué falta**, usando el `imageBrief` editorial que ya existe.
3. No puede usar una fotografía de otro sitio ni un color plano genérico.

### 5.5 Zonas de alojamiento

Cada zona recibe **una imagen `context`** del barrio. Hoy la comparación de zonas no
tiene ninguna fotografía, lo que la convierte en una tabla. Si para una zona no hay
material con licencia adecuada, se usa `PhotoPlaceholder` con la línea editorial de la
zona; nunca una foto de otro barrio.

---

## 6. Rendimiento

### 6.1 Derivadas

Se conserva el pipeline existente y se añade un tamaño:

| Nombre | Ancho | Uso |
|---|---|---|
| `-400w` | 400 px | **nuevo** — miniaturas: `PlaceCard compact`, paradas del planner, «Cerca de aquí» |
| `-800w` | 800 px | existente — tarjeta de lista |
| original | 1600 px | héroe de ficha y lightbox |

Formato: WebP como hoy; AVIF opcional con `<picture>` cuando la ganancia supere el 15 %.

### 6.2 LQIP

Añadir a cada registro un campo `lqip`: la misma imagen a 20 px de ancho, en base64
(~400–700 bytes). Se pinta como fondo mientras carga la definitiva.

Esto elimina el destello gris del skeleton actual y es la mejora de rendimiento
percibido más barata disponible. **Sustituye a `place-card__skeleton` y a
`gallery__skeleton`.**

### 6.3 Carga

- `loading="lazy"` en todo salvo: la primera tarjeta visible de una lista y el héroe
  de una ficha abierta, que llevan `fetchpriority="high"`.
- `width`/`height` declarados siempre (ya se hace; se conserva).
- `sizes` describiendo la geometría real por breakpoint (ya se hace; se actualiza a los
  breakpoints nuevos).
- `decoding="async"` siempre.
- Presupuesto: **recorrer una ciudad completa no debe superar 3,5 MB de imágenes**.
  Con derivadas de 400/800 y LQIP el valor actual mejora respecto a la medición de
  v1.1.0.

### 6.4 Fallo de carga

Si la imagen falla: `PhotoPlaceholder` con la etiqueta «No se pudo cargar la imagen» y,
en la ficha, una acción «Reintentar». Nunca un icono de imagen rota del navegador.

---

## 7. Gobernanza

- La adquisición sigue haciéndose con `scripts/acquire-photography.py` y registrándose
  en `data/visual/photography-metadata.json`. **No se escribe nunca en
  `app/src/data/place-images.ts` a mano**: esa regla existente se mantiene.
- Cada tanda de adquisición se cierra con un informe que declara: lugares afectados,
  rol de cada imagen nueva, bytes añadidos y roles que siguen sin cubrir.
- **Criterio de revisión obligatorio por imagen**: ¿aporta un rol que no estaba
  cubierto? Si la respuesta es no, se rechaza aunque la imagen sea buena.

### Criterios de aceptación de la fotografía

- [ ] Ningún crédito aparece entre una fotografía y el título de su lugar.
- [ ] Ningún lugar grado S se muestra sin fotografía.
- [ ] Todo registro de imagen tiene `role` y `lqip`.
- [ ] Ninguna galería contiene dos imágenes del mismo rol sin justificación escrita.
- [ ] Una lista que mezcla lugares con y sin foto no parece rota.
- [ ] El comportamiento con 1 imagen no muestra puntos, contador ni flechas.
