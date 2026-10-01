# 12 — Reglas de UX v2.1 (Fase 1) y backlog normativo

**Estado:** Normativo · congelado en repo · **Fecha:** 2026-10-01
Complementa `02`, `04`, `05`, `08` y `09`. No reescribe ninguno. Prevalecen, por este
orden: decisiones firmes previas · DD-015/DD-016 · contratos B27–B31 · este documento.

## Reglas

1. **Cuatro destinos:** Explorar · Quiero ir · Viaje · Nosotros.
2. **TabBar** móvil y **NavRail** `md`+ existentes; **no se reconstruyen**.
3. La superficie se llama **Días**, nunca *Planner*.
4. **PlaceDetail / DD-015:**
   - móvil a **100 % de altura**;
   - **misma pila** (instancia única, encadenable);
   - **retorno exacto** a la superficie de origen;
   - **mismo history/back**;
   - **mismo foco**;
   - **no es modal**: sin focus trap, sin `inert`, sin cierre por scrim, sin sheet parcial.
5. **History API** sólo para la pila de PlaceDetail.
6. **Dos viajeros en un dispositivo** con `activeTravellerId`. La sincronización v1.2
   queda **fuera de alcance**.
7. Se mantienen las **confirmaciones y deshacer actuales por acción**; D7 las revisa
   caso por caso.
8. `input`/`select`/`textarea` **≥ 16 px en móvil**.
9. **WCAG 2.2 AA** + gates existentes.
10. **PlaceGallery existente:** D4 sólo pule; no depende de `role`/`lqip`; audita foco
    del lightbox, una sola imagen, crédito, swipe y CLS.
11. **Vocabulario:** D5 corrige las palabras expresamente prohibidas por Art. 7 / `03 §10`.
    *Recorrido* y *tramo* forman parte de esa deuda. *Reparto* y *compromisos de escala
    día* **no se sustituyen automáticamente**.

## Backlog normativo (orden)

| # | Bloque | Contenido |
|---|---|---|
| 1 | **D0b** | Higiene técnica/visual |
| 2 | **D5** | Vocabulario normativo |
| 3 | **D2** | PlaceCard / PersonToken |
| 4 | **F1** | Curación fotográfica |
| 5 | **D4** | Pulido de PlaceGallery existente |
| 6 | **D3** | Pulido visual de PlaceDetail preservando DD-015 |
| 7 | **D6** | Días / Dónde dormir / ZoneComparison |
| 8 | **D7** | Vacíos y feedback por acción |

**D1:** *opcional / fuera del camino crítico*; sólo si una auditoría visual identifica
deuda concreta del shell existente.

## Pendientes abiertos (documentados, sin resolver)

- EvidenceMark 11 px (norma) vs 12 px (implementación).
- Token adecuado para inputs ≥ 16 px si no existe uno aplicable.
- Aplicación de `viewport-fit=cover` + validación en iPhone.
- Foco y accesibilidad del lightbox.
- Comportamiento de PlaceGallery con una sola imagen.
- Literales sin token equivalente.
- *Reparto* / *compromisos de escala día*.
- Cualquier futura exposición runtime de `role` / `lqip`.

## Validaciones visuales pendientes

Pendientes de registrar, **no bloquean** la publicación de esta normativa:

- Safe area real en iPhone.
- Foco oculto por chrome.
- Lightbox y restauración de foco.
- Una sola imagen.
- Créditos.
- EvidenceMark 11/12.
- CLS.
- ZoneComparison en ancho estrecho.
- Inputs post-D0b sin zoom.
- Alternativa a cualquier arrastre en Días, si existe.

## Contradicciones registradas

Ninguna que altere decisiones firmes. Ver `11 §Contradicciones registradas`.
