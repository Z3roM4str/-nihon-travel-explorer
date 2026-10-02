# Autoridad de movimiento tras reconciliación #177

Este documento conserva el inventario histórico de main. Las seis excepciones funcionales inventariadas abajo no constituyen aprobación de diseño: rigen `03 §6` y la precedencia de `08`. La combinación limita movimiento a los cinco casos normativos y reduced-motion instantáneo. [Informe y comprobaciones nuevas](B10_RECONCILIATION_REPORT.md).

---

# B10-M1…M6 — Especificación formal de las transiciones funcionales

**Estado: CERRADO como documentación (sin rediseño).** El problema nunca fue un defecto observable: eran seis movimientos **sin nombre ni especificación** en `03 §6`, que sólo nombra cinco movimientos *expresivos*. Se comprobó que ninguno incumple reduced-motion ni la prohibición de hover, se **nombra su semántica** y se **fijan sus valores** en el gate. No se cambia ninguna animación.

## Taxonomía (la regla que faltaba)
| Clase | Qué es | Dónde se define |
|---|---|---|
| **Movimiento nombrado** | los cinco de `03 §6`: `sheet-rise`, `push`, `cross-fade`, `press`, `mark` (expresivos; los únicos que dan «carácter») | `03 §6` (normativo) |
| **Transición funcional de estado** | cambio de estado de un control o superficie que se anima para no ser un salto (aviso que aparece, telón que entra, chevron que gira…). No expresa carácter, no se dispara por scroll ni por hover, y lleva duración de token o literal fijado | **este documento** (descriptivo; no amplía `03 §6`) |

Una transición funcional **no puede** ser: escalonada al scroll, un efecto de hover en tarjetas, parallax, ni movimiento no disparado salvo el skeleton de carga. El gate lo impide para todo el CSS de producto.

## Las seis
| ID (DDR) | Nombre formal | Dónde | Disparador | Valores | Reduced-motion |
|---|---|---|---|---|---|
| B10-M1 | `notice-enter` | `@keyframes toast-in` (`App.css`) usado en `SaveToast.css` | aparece el aviso de «Quiero ir» | opacidad 0→1 + subida `translateY(8px→0)`, **0,2 s `ease-out`** (literal, fuera de tokens) | 0,001 ms (regla global) |
| B10-M2 | `scrim-fade` | `@keyframes onboarding-fade` (`App.css`) usado en `Onboarding.css` | se abre el onboarding | opacidad 0→1 del telón, **0,18 s `ease-out`** (literal) | `animation: none` explícito + regla global |
| B10-M3 | `disclosure-turn` | `.filter-group__chevron` (`discovery.css`) | plegar/desplegar un grupo de filtros | `transform` giro 90°, `--dur-fast` (140 ms) `--ease-standard` | regla global |
| B10-M4 | `focus-affordance` | `.place-card` (`discovery.css`) | `:focus-within` (**no hover**) | `box-shadow` y `border-color`, `--dur-base` (220 ms) `--ease-standard` | regla global |
| B10-M5 | `image-reveal` | `.place-card__image` (`discovery.css`) | la imagen termina de cargar | `opacity` 0→1, `--dur-base` `--ease-standard` | regla global |
| B10-M6 | `sheet-resize` | `.national__sheet` (`discovery.css`) | cambia la altura de la hoja del mapa nacional | `height`, `--dur-base` `--ease-standard` | regla global |

## Veredicto por ítem (¿defecto observable?)
* **Ninguno incumple reduced-motion**: `App.css` aplica `animation-duration/transition-duration: 0.001ms !important` a todo; el gate lo mide en navegador con `reducedMotion: reduce` (aviso, onboarding, hoja, `mark`, bucle, galería). M2 además declara `animation: none`.
* **Ninguno es hover**: M4 se dispara por `:focus-within`; `.place-card:hover` no existe (`S08` y `S04` lo impiden).
* **M3–M6 usan tokens** de duración y curva; **M1 y M2 usan literales** (0,2 s y 0,18 s). Pasarlos a tokens cambiaría su duración observable (a 0,14 s o 0,22 s): es una decisión estética, **no se hace**. Quedan fijados como literales documentados.
* `push` y `cross-fade` (de `03 §6`) siguen **no implementados**: la ficha y el cambio lista/mapa son instantáneos. No es infracción; si Producto quisiera esos movimientos sería una función nueva fuera del alcance de la versión actual.

## Protección
`b10-motion-check` (17 comprobaciones; antes 16): `S01–S03` inventario con trinquete sobre **todo el CSS bajo `src/`** (antes sólo cuatro archivos: tras B10.4 una `transition` nueva en una hoja de componente habría pasado sin clasificar; se midió que hoy no existe ninguna sin clasificar), **`S08` (nuevo)** fija nombre, valores y disparador de las seis, y las comprobaciones de navegador comparan con y sin `prefers-reduced-motion`.
