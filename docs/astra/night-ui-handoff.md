# Entregable y Handoff — Experiencia Visual Astra (`astra/night-ui` — PR #131 / #135)

## 1. Comportamiento Resultante y Correcciones Aplicadas

### Preferencias y Vista "Todos"
- **Unión sin duplicados**: La vista "Todos" deduce de manera unificada los lugares guardados heredados (`savedIds`) y los lugares con interés activo de Fernando y Lorena, sin duplicados.
- **Pestañas por persona y contadores**: Las pestañas `Todos`, `Fernando`, `Lorena` y `Coincidencias` muestran sus respectivos contadores y listas de lugares.
- **Acciones explícitas**: Se distingue la acción "Quitar guardado heredado" de desmarcar un interés personal (`★ Fernando` / `☆ Fernando`, `★ Lorena` / `☆ Lorena`). Desmarcar un interés no borra guardados generales ni altera actividades de itinerario.
- **Coherencia global**: Contadores de cabecera, "Comparar selección" y "Planificar con mis guardados" respetan la semántica unificada.

### Persistencia, Validación Estricta y Manejo de Errores
- **Aviso accesible y reintento en UI**: Si falla la escritura en almacenamiento local (ej. cuota excedida o almacenamiento deshabilitado), `App.tsx` muestra un aviso accesible (`role="alert"`) indicando que los cambios se conservan en memoria y ofrece un botón "Reintentar guardar" (`retrySave()`).
- **Validación de catálogo y fechas**: `readStorage()` y `readMemberInterests()` validan que cada `placeId` exista en el catálogo de lugares, los miembros sean reconocidos ("fernando", "lorena"), el viaje corresponda a `"trip-2027"` y la fecha `updatedAt` sea un timestamp ISO válido.
- **Aislamiento y preservación de otros viajes**: Al guardar preferencias del viaje actual, se preservan intactos los registros pertenecientes a otros viajes en `localStorage` sin sobrescribirlos ni borrarlos.

### Reactividad del Planificador
- **Actualización dinámica**: `plannerPlaces` reevalúa reactivamente la lista de lugares planificados al abrir o reabrir el modal del planificador (`plannerOpen`), sincronizando inmediatamente ediciones del itinerario guardadas en `localStorage`.

### Galería con Imágenes Fallidas
- **Controles persistentes**: Ante errores de carga de fotos (`loadState === "error"`), los controles de navegación (`‹` y `›`) permanecen interactivos para navegar entre imágenes.
- **Botón de reintento**: "Reintentar" restablece el estado de carga y detiene la propagación de eventos para no abrir la ficha accidentalmente.
- **Sincronización de créditos y alt**: `alt` y metadatos de atribución en `<details>` corresponden a la foto seleccionada (`photoIndex`).

### Accesibilidad y Responsive
- **Nombres accesibles con texto visible**: Eliminados marcadores/títulos ocultos obsoletos. Los botones derivan su nombre accesible de su texto visible ("Me gustaría ir ✓").
- **Estados seleccionados expuestos**: Botones de interés exponen `aria-pressed={boolean}`.
- **Layout responsive**: Ajustado CSS en `astra.css` para móviles (320px–375px), tablets y escritorio sin desbordamientos (`overflow: 0px`) y con objetivos de contacto táctil de mínimo 44px.

---

## 2. Archivos Modificados
- `app/src/App.tsx`
- `app/src/astra/Discovery.tsx`
- `app/src/astra/PlaceCard.tsx`
- `app/src/astra/interestAdapter.ts`
- `app/src/useSavedPlaces.ts`
- `app/src/astra/astra.css`
- `app/src/astra/corrections-integration.test.ts`
- `app/src/astra/night-ui-corrections.test.ts` *(Nuevo suite con pruebas de hook y componentes React)*
- `app/scripts/astra-sol-0-2-browser-audit.mjs`
- `docs/astra/night-ui-handoff.md`
- `docs/astra/evidence/pr135-audit/` *(Directorio de evidencia dentro del repositorio)*

---

## 3. Pruebas y Evidencia
- **Pruebas unitarias e integración (Vitest + JSDOM + Testing Library)**: 71 archivos pasados, 2472 pruebas pasadas (`npm run test`).
- **Linter (Oxlint)**: 0 errores (`npm run lint`).
- **Compilación (TypeScript + Vite)**: Exitoso sin errores (`npm run build`).
- **Auditoría Playwright (`astra-sol-0-2-browser-audit.mjs`)**: 8/8 recorridos pasados (PASS) en viewports 320, 375, 390, 430, 768, 1024 y 1440 px.
- **Evidencia Accesible en Repositorio**:
  - `docs/astra/evidence/pr135-audit/results.json`
  - `docs/astra/evidence/pr135-audit/summary.md`
  - `docs/astra/evidence/pr135-audit/screenshots/`

---

## 4. Dependencias Pendientes
- **Integración con #133 / #134**: La integración de la tubería de imágenes enriquecidas separada se realizará una vez aprobado ese lote.

---

## 5. Continuación de persistencia — PR #137

### Código preparado
- El código de producto a verificar es `92791f33aba27b675dad63888743d15185ba05a5`: aviso y reintento desde Explorar, ficha y Nuestro viaje, sin duplicar el anuncio cuando la ficha está abierta.
- La prueba del planificador ahora espera el diálogo real, cierra, modifica el borrador V7 persistido sin cambiar intereses, reabre y comprueba lugares y `visitStartTimes` conservados.
- La auditoría de navegador añade `09-persistence-recovery`, con las tres superficies a 375×812 px, pertenencia del aviso al modal, unicidad del `role="alert"` y objetivo táctil de 44 px.

### Verificación real en este entorno (2026-09-21 UTC)
- **Lint ejecutado:** sin errores; cuatro advertencias ya presentes en `App.tsx`, `useSavedPlaces.ts` y `Discovery.tsx`.
- **Tests bloqueados por entorno:** falta `jsdom` en `node_modules`; `npm install` y `npm ci` quedaron esperando la red del registro y se interrumpieron.
- **Build bloqueado por entorno:** TypeScript no puede resolver la instalación local incompleta de `@testing-library/react`.
- **Auditoría y revisión visual no ejecutadas:** dependen de un build correcto. Por tanto, no se declaran aprobadas ni se fabrican capturas/trazas.

La evidencia existente en `docs/astra/evidence/pr135-audit/results.json`, `summary.md`, `screenshots/` y `traces/` sigue siendo la auditoría histórica de `79748e85b7884c8f85ea1d71066ae72b72e4bd95`. El intento separado y sus limitaciones están registrados en `verification-92791f3.md`; debe reemplazarse por resultados nuevos únicamente después de ejecutar la auditoría contra el SHA de código correspondiente.

### Evidencia histórica recibida — PR #137
- Los artefactos publicados declaran como código auditado `abe7a624001d3b86727ece19201aa895eee63271`, pero ese objeto no está disponible en el checkout y no se pudo recuperar de GitHub desde este entorno. Por ello, los resultados y capturas se conservan sin alterarlos, pero **no prueban el HEAD `9408e27ec279e6ec80bd27632e656d4f6c265384`**.
- La ejecución histórica declaró que se instalaron las dependencias (`npm ci`) y el ejecutable de Chromium 1234 (`npx playwright install chromium`).
- **Pruebas unitarias e integración (Vitest):** 71 archivos / 2474 pruebas pasadas (`npm run test`).
- **Linter (Oxlint):** 0 errores, 4 advertencias no bloqueantes (`npm run lint`).
- **Build (TypeScript + Vite):** Compilación exitosa (`npm run build`).
- **Validadores pasivos:** OK en fotografía, dataset, geografía, logística y mecanismos de reserva.
- **Corrección en runner de auditoría:** Se añadió `await page.reload({ waitUntil: "networkidle" })` en `app/scripts/astra-sol-0-2-browser-audit.mjs` (recorrido 09) para garantizar la rehidratación del estado de React tras sembrar `localStorage` antes de navegar a `#/viaje`.
- **Auditoría de navegador (Playwright Chromium):** 9/9 recorridos pasados (PASS al 100%), incluyendo `09-persistence-recovery` en Explorar, ficha modal y Nuestro viaje a 375×812 px.
- **Revisión visual móvil:**
  - Aviso de fallo de guardado visible en contenedor rojo con bordes definidos.
  - Botón "Reintentar guardar" interactivo, sin desbordamientos (0px overflow) y con objetivo táctil accesible (>= 44px de altura).
  - En la ficha modal, el aviso de recuperación está autocontenido dentro de la ventana modal activa y limpia su anuncio accesible tras reintentar.

### Verificación de trazabilidad del HEAD `9408e27` (2026-09-22 UTC)

- **Rama esperada/local:** `codex/completa-pr-#135-de-astra-16422227132192129267`; SHA inicial y SHA de código verificado: `9408e27ec279e6ec80bd27632e656d4f6c265384`.
- **Estado remoto:** `.git/FETCH_HEAD` vincula ese SHA a la rama esperada. GitHub y `git ls-remote` respondieron 401/403, de modo que no fue posible reconfirmar el HEAD remoto ni editar la descripción del PR.
- **Checks ejecutados en `9408e27`:** 71 archivos / 2474 pruebas aprobadas; build correcto; lint con 0 errores y 4 advertencias; los cinco validadores terminaron correctamente y el validador de dataset comunicó 13 advertencias de metadatos secundarios.
- **Auditoría de navegador nueva:** bloqueada antes de iniciar recorridos. `npm ci` terminó correctamente, pero `npx playwright install chromium` recibió HTTP 403 en todos los intentos y no existe un Chromium del sistema. La ejecución con `ASTRA_EXPECTED_SHA=9408e27ec279e6ec80bd27632e656d4f6c265384` confirmó la ausencia del ejecutable. Por tanto, se registran **0/9 recorridos nuevos ejecutados**, no 9/9.
- **Revisión visual:** se inspeccionaron manualmente las capturas ya publicadas de 320, 375, 390, 430, 768, 1024 y 1440 px, además de fallo/recuperación en Explorar, ficha y Nuestro viaje. No se observaron recortes ni desbordamiento horizontal; los avisos de error y botones de reintento son visibles, y la captura final de Nuestro viaje muestra la recuperación. Esta es una revisión visual de artefactos **históricos de procedencia no verificable**, no una aprobación visual de `9408e27`.
- **Resultado:** no se detectó un fallo de producto en los checks ejecutables y no se cambió código. El detalle reproducible queda en `docs/astra/evidence/pr135-audit/verification-9408e27.md`. El commit posterior a `9408e27` incorpora exclusivamente esta documentación de trazabilidad; su SHA debe consignarse en la descripción del PR una vez creado.
