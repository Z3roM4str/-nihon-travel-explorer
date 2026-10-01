# 11 — Sistema de diseño v2.1 (Fase 1)

**Estado:** Normativo · congelado en repo · **Fecha:** 2026-10-01
**Base:** B31 / B9.5 certificado (`9b81e3066e18bb41cf99d8c75c6aad4dc7e5e0fb`).
**Alcance:** documental. Este documento **no implementa nada** y **no sustituye** `03`, `04`
ni `06`: los **complementa**. Si hay contradicción con un DD firme (DD-015, DD-016) o con
los contratos B27–B31, prevalecen estos últimos (ver `§Contradicciones registradas`).

## 1. Principio rector

El sistema existente del repositorio es la base; **no se sustituye**. v2.1 fija el
rumbo del siguiente ciclo visual (bloques D0b–D7, ver `12 §Backlog`) como pulido
incremental sobre lo construido.

## 2. Tokens

- `app/src/styles/tokens.css` es la **fuente de verdad visual**.
- **No introducir literales** de color o tamaño si existe un token. Los literales
  sin token equivalente se registran como pendiente (`12 §Pendientes abiertos`), no se
  resuelven por inventiva.

## 3. Tipografía

- Familias existentes: **Zen Kaku Gothic New** e **IBM Plex Sans**. No se añaden familias.
- Escala real, **sólo mediante tokens** `--type-*` de `tokens.css`: `display`,
  `title-l`, `title-m`, `title-s`, `quote`, `body`, `body-s`, `label`, `caption`.
- `input`, `select` y `textarea` deben tener **≥ 16 px computados en móvil**
  (evita el zoom de iOS). Si no existe token aplicable, es pendiente abierto: no se
  inventa un token en este documento.

## 4. EvidenceMark

- **Norma** (`03`/`04`): glifo de 11 px.
- **Implementación actual:** 12 px (`.evidence-mark` usa `--type-caption-size`).
- Es **deuda abierta para D0b**. **No se corrige automáticamente**: D0b decide si la
  norma o la implementación es la correcta y lo registra.

## 5. Iconografía

Se conserva `app/src/icons/Icon.tsx`. **No se añade ninguna librería** de iconos.

## 6. Viajeros

Se conserva `PersonToken` con `--person-a`, `--person-b` y `--person-both`.
**No se crea ningún `TravellerMark`** nuevo.

## 7. Fotografía

- El esquema existente `PlaceImage[]` es el contrato; ya soporta **varias fotos por lugar**.
- F1 puede **adquirir, curar, licenciar y ordenar** fotos **sin cambio de esquema**.
- `role` y `lqip` existen en la metadata (`photography-metadata.json`) pero **no llegan
  a runtime**. La UI **no puede depender de ellos** sin una decisión de diseño nueva.

## 8. PlaceGallery

Ya existe con: multiimagen, carril, contador, flechas en `md`+, lightbox, reintento y
`srcset`/`sizes`. **D4 es pulido incremental, no reconstrucción.**

## 9. PlaceDetail

- D3 puede cambiar radios, elevación, transición y composición.
- **Sin asa / drag handle. Sin gesto de descarte.**
- **DD-015 permanece intacto** (ver `12 §PlaceDetail`).

## 10. ZoneComparison

Se conservan los **bloques verticales**, el **mapa compartido** y los **contrastes**.
**No** se convierte en carrusel horizontal.

## 11. Responsive

Se conservan los puntos `base/sm/md/lg/xl` y las **container queries** existentes
(DD-016 incluido). **No** se crea un sistema paralelo compact/medium/expanded.
Art. 8 sigue vigente (mobile-first, sólo `min-width`).

## 12. Safe area

- Existe uso de `env(safe-area-inset-*)` (`App.css`, `styles/discovery.css`).
- **Falta `viewport-fit=cover`** en `app/index.html` (hoy:
  `width=device-width, initial-scale=1.0`), por lo que esos insets no tienen efecto real.
- Deuda concreta: aplicarlo en **D0b** + **validación posterior en iPhone real**.

## 13. Accesibilidad

**WCAG 2.2 AA** como objetivo mínimo, **manteniendo los gates más estrictos** que ya
existan (tap targets, scripts `bNN-a11y-check`, etc.). Ningún gate se relaja.

## Contradicciones registradas

Ninguna entre la misión y el repo en lo normativo. Observaciones, **sin modificar código**:

1. `EvidenceMark`: norma 11 px frente a implementación 12 px (§4).
2. `viewport-fit=cover` ausente aunque hay `env(safe-area-inset-*)` (§12).
3. `role`/`lqip` presentes en metadata y tests de derivados, ausentes del runtime (§7).
4. `03 §10` y Art. 7 prohíben *recorrido* y *tramo*; siguen existiendo en la UI (ver `12`, D5).
