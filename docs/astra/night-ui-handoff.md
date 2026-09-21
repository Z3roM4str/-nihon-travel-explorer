# Entregable y Handoff — Experiencia Visual Astra (`astra/night-ui` — PR #131)

## 1. Comportamiento Resultante y Correcciones Aplicadas

### Preferencias y Vista "Todos"
- **Unión sin duplicados**: La vista "Todos" deduce de manera unificada los lugares guardados heredados (`savedIds`) y los lugares con interés activo de Fernando y Lorena, sin duplicados.
- **Pestañas por persona**: Las pestañas `Todos`, `Fernando`, `Lorena` y `Coincidencias` muestran sus respectivos contadores y listas de lugares.
- **Acciones honestas**: Se distingue claramente entre "Quitar guardado heredado" (que remueve la marca general previa) y los botones de interés personal de Fernando y Lorena (`★ Fernando` / `☆ Fernando`, `★ Lorena` / `☆ Lorena`). Desmarcar un interés personal no altera el de la otra persona, ni borra guardados generales ni modifica actividades de itinerarios existentes.
- **Coherencia global**: Los contadores del header, la herramienta "Comparar selección" y la selección disponible para "Planificar con mis guardados" respetan la semántica unificada.

### Galería con Imágenes Fallidas
- **Controles persistentes**: Ante el fallo de carga de una imagen (`loadState === "error"`), los controles de navegación (`‹` y `›`) permanecen interactivos para permitir cambiar a otra fotografía.
- **Reintento independiente**: El botón "Reintentar" reinicia el estado de carga y detiene la propagación para evitar la apertura accidental del detalle.
- **Sincronización de metadatos**: El texto alternativo (`alt`) y los créditos/licencia de la fotografía en `<details>` corresponden exactamente a la imagen seleccionada (`photoIndex`).

### Accesibilidad
- **Etiquetas accesibles con texto visible**: Se eliminaron etiquetas antiguas u ocultas (como `<span className="visually-hidden"> ¿Qué les gustaría descubrir?</span>` y `aria-label="En Mis guardados"`). Los nombres accesibles derivan de su texto visible ("¿Qué te gustaría vivir en Japón?", "Me gustaría ir ✓").
- **Estados seleccionados expuestos**: Los botones de interés personal exponen explícitamente `aria-pressed={isInterested}`.

### Persistencia y Adaptador
- **Sanitización estricta de almacenamiento**: `readStorage()` y `readMemberInterests()` validan tipos, ignoran registros nulos o corruptos y eliminan duplicados.
- **Estado de sincronización honesto**: `InterestAdapter` reporta `syncState: "local-only"` para operaciones locales exitosas o `syncState: "error"` con `saveError` si falla la escritura en almacenamiento.

### Comportamiento Responsive
- Las pestañas de `Nuestro viaje` y los controles de filas se adaptan a teléfonos estrechos (320px–375px), tablets y escritorios sin desbordamiento horizontal (`overflow: 0px`) y con tamaños de toque óptimos (mínimo 44px).

---

## 2. Archivos Modificados
- `app/src/App.tsx`
- `app/src/astra/Discovery.tsx`
- `app/src/astra/PlaceCard.tsx`
- `app/src/astra/interestAdapter.ts`
- `app/src/useSavedPlaces.ts`
- `app/src/astra/astra.css`
- `app/src/astra/corrections-integration.test.ts`
- `app/src/astra/night-ui-corrections.test.ts` *(Nuevo suite de pruebas)*
- `app/scripts/astra-sol-0-2-browser-audit.mjs`
- `docs/astra/night-ui-handoff.md`

---

## 3. Pruebas y Evidencia
- **Pruebas unitarias/integración (Vitest)**: 71 archivos aprobados, 2470 pruebas pasadas (`npm run test`).
- **Linter (Oxlint)**: 0 errores (`npm run lint`).
- **Compilación (TypeScript + Vite)**: Exitoso sin errores (`npm run build`).
- **Auditoría Playwright (`astra-sol-0-2-browser-audit.mjs`)**: 8/8 recorridos pasados (PASS) en viewports 320, 375, 390, 430, 768, 1024 y 1440 px.
- **Capturas y Video de Verificación**: Generados en `/home/jules/verification/screenshots/` y `/home/jules/verification/videos/`.

---

## 4. Dependencias Pendientes
- **Integración con #133 / #134**: Integración de fotografía enriquecida separada pendiente cuando se apruebe el lote de imágenes.
