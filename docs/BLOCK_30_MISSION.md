# B30 — B9.4 «Dónde dormir»

## Base y alcance

- Base canónica: `main` / `origin/main` en `a7b916be005f002e46c67442968379f72d3b480d`.
- Rama: `codex/block-30-b9-4-donde-dormir`.
- B29 / B9.3 está integrado y cerrado mediante PR #167. Este bloque conserva sus contratos y los de B27/B28.
- Alcance: hacer que «Dónde dormir» ayude a comparar zonas para el viaje actual, sin ranking universal ni decisión automática. No inicia B9.5, B10 ni cambios de esquema.

## Auditoría previa: arquitectura actual

La superficie vive en `App.tsx` como `Viaje › Dónde dormir`. El componente perezoso `ZoneComparison` se mantiene montado con el destino Viaje y ofrece dos modos (`browse` y `compare`). `ZonePlanSection` muestra después en el planificador la decisión de zona y sus consecuencias para los días. Al abrir un lugar desde el comparador, B18 apila la misma `PlaceDetail` dentro de Viaje y conserva la superficie de origen.

`ZoneComparison` reúne tres responsabilidades que ya tienen contratos útiles:

- `accommodation-zone.ts` proporciona las 16 zonas de Tokio, Kioto y Osaka y calcula proximidad geográfica. También conserva un helper que ordena por mediana para usos existentes; la superficie B30 muestra cada cálculo por separado y conserva el orden del catálogo, sin usar ese helper como ranking. Ninguna función usa la red de transporte ni produce tiempos.
- `useZoneComparison.ts` conserva qué zonas se comparan en `nihon.zoneComparison.v1` (máximo cuatro). `useZonePlanChoice.ts` lee y escribe la decisión explícita en el draft V8 bajo `nihon.manualPlanningDraft`. Elegir una zona crea el alojamiento de referencia existente; no reserva ni define límites diarios.
- `ZoneSources`, `zone-provenance-presentation.ts`, `EvidenceMark` y `zone-editorial-presentation.ts` ya distinguen procedencia de hechos y autoría editorial. `ZonePlanSection` ya presenta geometría de línea recta como cálculo y prohíbe convertirla en tiempo.

El registro contiene, por zona: nombre y nombre japonés; hub; resumen; estación de referencia y coordenadas; hechos de líneas, Shinkansen y enlaces a aeropuertos con procedencia; diez ejes editoriales de 1–5; tres textos `tradeoffs`; y clusters servidos. Los hechos no tienen todos el mismo nivel de fuente: cada afirmación conserva sus fuentes por área y nivel. Las valoraciones y los `tradeoffs` son criterio de Nihon, no tienen procedencia factual. `zoneSavedPlacesFit` calcula mediana, distancias más cercanas y bandas de distancia en línea recta para los lugares del hub que recibe; no calcula desplazamientos ni tiempo.

La llamada actual recibe desde App `savedPlaces`, que deriva de «Quiero ir», y usa esos lugares como contexto. No recibe la composición `routeIds` del viaje. Si se usa esa lista para decir qué conviene «para este viaje», se atribuiría al viaje una selección que todavía puede no estar en él.

La capa fotográfica de app se construye desde `photography-metadata.json`, con registros por `placeId`, rol, alt, fuente, crédito, licencia, LQIP y derivadas. `place-images.ts` resuelve esas imágenes para lugares. La inspección de los 244 registros y de los assets encontró **cero** registros o rutas de imagen de zona. El roadmap nombra B6.7 como «una imagen `context` por zona», pero esa cobertura no está presente en la base canónica y el registro actual no permite asignar una foto de lugar a una zona sin falsear el sujeto. `PhotoPlaceholder` existente está tipado para lugares y requiere categoría/`imageBrief`; una zona no tiene esos campos. No se encontraron datos de precio de alojamiento, distancias del itinerario ni tiempos desde alojamiento.

Los tests existentes cubren la estructura/procedencia de las zonas (`accommodation-zone`, `zone-provenance`, `zone-editorial-governance`, `zone-airport-link`), la presentación de fuentes (`ZoneSources`), el plan asociado (`ZonePlanSection`), selección/persistencia V8, y navegación de Viaje/B18. Los gates browser existentes incluyen `block3-zones-browser-audit.mjs`, `block4-zone-planner-browser-audit.mjs` y `b18-viaje-lugar-check.mjs`. No existe aún un gate permanente de B9.4. El defecto D7 visible en la pantalla activa consiste en los badges `1…n` de las tarjetas, los números repetidos en el modo comparar (incluido el mapa) y la ausencia de fotografía; además, hechos, proximidad y opinión sólo se despliegan de forma incompleta entre browse y compare. El orden contextual por cercanía se anuncia hoy como orden de lugares guardados, aunque no son necesariamente la ruta.

## Dirección de implementación

1. Mantener el componente y la navegación en `Viaje › Dónde dormir`, el comparador opcional de hasta cuatro zonas, las fuentes, la apertura de `PlaceDetail` en Viaje y la acción humana existente para elegir zona. No tocar los cálculos de proximidad ni el modelo V8.
2. Alimentar la comparación de proximidad con lugares que estén en `routeIds` y pertenezcan al hub actual. La lectura será sólo lectura; no se deriva ni persiste un segundo itinerario. Si la ruta no contiene lugares de ese hub, el estado será explícito y neutral: no habrá distancias ni orden contextual calculados.
3. Retirar los ordinales que identifican o posicionan zonas de tarjetas, columnas y mapa. Mantener el orden del catálogo aunque haya una ruta local; mostrar la proximidad como un dato separado en cada alternativa, sin usarla para ordenar zonas. Sin datos calculables, se conserva el mismo orden y se omite el cálculo.
4. Cada alternativa mostrará bloques etiquetados con `EvidenceMark`: **Hechos registrados** (`◧`, con procedencia), **Calculado** (`◇`, geometría en línea recta de la ruta local) y **Nihon dice** (`✎`, resumen/criterio/tradeoffs). El modo compare mantiene máximo cuatro y se apila en teléfono.
5. Mostrar fotografía sólo cuando exista un registro licenciado cuyo sujeto sea esa zona. En la base auditada no existe ninguno, así que usar un fallback deliberado y específico de zona basado en contenido editorial existente, identificado como fotografía pendiente. No se reutilizan fotos de POI, no se crean placeholders que parezcan fotos y no se amplía el pipeline de adquisición sin assets B6.7.
6. Evitar escrituras al abrir y recorrer la comparación: `useZoneComparison` escribe actualmente su selección inicial mediante un efecto de montaje. Se conservará su clave y payload, pero la escritura se limitará a cambios explícitos de selección. La elección explícita de una zona conserva la acción existente, ahora visible como «Dormir aquí»; navegación, lectura de contexto y comparación no mutan V8.
7. Conservar controles de teclado, targets de 44 px, foco visible, `prefers-reduced-motion`, retorno de Viaje/PlaceDetail y el comportamiento responsive del shell. Cubrir los casos de ruta vacía, una zona, múltiples zonas y fallback de fotografía con Vitest y un gate browser propio.

## Verificación al cierre

Se añadirá `app/scripts/b30-where-to-sleep-check.mjs` para comprobar ausencia de ordinales/ranking, separación de evidencia, contexto de ruta, foto/fallback, teclado, navegación, almacenamiento, ausencia de mutaciones inesperadas, viewports y regresiones de Viaje. La certificación ejecutará build, lint, Vitest completo, B30, B29, B28, B27, B26, B25, B18 e invariantes relacionadas. El resultado final, capturas, problemas y deuda B6.7 se registrarán en `docs/BLOCK_30_HANDOFF.md`.
