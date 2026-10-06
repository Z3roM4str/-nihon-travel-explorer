# Auditoría final independiente (2026-10-06) — correcciones H01–H07

**Base auditada:** `32787a1661665f53bba5dfcf73d630709a698ad2` (el árbol `app/` de `main` `52503a9` es idéntico).
**Rama:** `claude/final-audit-data-recovery-fixes-l60xs9` (la rama designada para la sesión).
**Alcance:** sólo fiabilidad; sin funcionalidades nuevas, sin cambios de datos (JP-126 queda como seguimiento), sin tocar Vercel,
Astra ni dependencias. Evidencia base/corregida en [`final-audit-evidence/`](final-audit-evidence/).

## Tabla H01–H07

| # | Causa confirmada | Corrección | Validación (base → corregido) |
|---|---|---|---|
| **H01** | Los hooks montados (`useTravellers`, `usePlanningDraft`) guardaban el documento en `useState` y lo reescribían entero tras cada cambio; una restauración escrita por debajo no los avisaba y la siguiente mutación (navegar y pulsar un corazón) escribía el viaje anterior encima. | `confirmImport` avisa a los hooks (`notifyStorageReplaced`) para que relean y rendericen lo restaurado; además cada mutación parte del documento vigente del almacenamiento (`useStoredDocument`). «Continuar» deja de ser la defensa. | `final-audit-data-recovery-check` H01: viajeros, intereses, itinerario, nuevo interés tras importar y recarga. Base falla 5/5 → 5/5 OK. |
| **H02** | La escritura reemplazaba el documento completo con la copia en memoria de la pestaña (confirmado igual para el itinerario). | Antes de aplicar cada mutación se compara la cadena almacenada con la última leída/escrita; si cambió, se relee y la operación se aplica **sobre el estado vigente** (estrategia: rehidratar y aplicar). Además se escucha `storage`. La escritura es síncrona (micro-tarea del mismo turno) con la mutación. Sin cuentas ni sincronización remota. | Intereses A+B conservan ambos; itinerario: añadir un día en cada pestaña → 3 días, parada y hotel intactos. Base falla (queda sólo JP-044; 2 días) → OK. |
| **H04** | Un único parser devolvía `null` para «no hay nada» y para «no lo entiendo»; el hook montaba el valor inicial y lo escribía encima (JSON roto, forma dañada, versión futura), y reconciliaba el borrador contra unos viajeros vacíos. | `lib/stored-document.ts` distingue `absent / valid / invalid / incompatible`. Inválido o futuro = **protegido**: no se escribe, el original se conserva tal cual, la app arranca con un valor en memoria y `StorageProtectionNotice` ofrece «Descargar copia» y «Empezar de nuevo» (confirmación; **copia previa de todo bajo `nihon.recovered.<instante>.<clave>`; si la copia falla no se borra nada**). Viajeros protegidos bloquean también el borrador (no se poda un itinerario válido). Importar un respaldo sobre datos protegidos también copia antes. Migración V1 válida intacta. | 3 variantes del informe + JSON roto + viajeros futuros: original idéntico tras montar y 2 recargas; aviso visible; V1 migra; viajeros inválidos no tocan el itinerario; copia/recuperación con fallo de escritura (no borra, explica, y se completa al volver). Base falla → OK. |
| **H03** | Dos superficies `React.lazy` (Viaje, Dónde dormir) sin frontera de errores: la importación rechazada desmontaba el árbol (pantalla en blanco). | `LazySurfaceBoundary` por superficie (mensaje visible, resto de la app utilizable, datos intactos) y `guardedImport`. Acción: **«Recargar la página»**, no «Reintentar»: `React.lazy` y el navegador reutilizan la importación rechazada. | Bloqueando `OrderedSequenceBuilder-*.js` y `ZoneComparison-*.js` a 390 y 1440 px: no hay blanco, aviso visible, navegación viva, datos iguales; al restablecer la red y recargar, la sección carga y el interés persiste. Base falla → OK. |
| **H05** | `--ink-500` (#6b7076) sobre `--surface-sunken` (#eceeeb) = 4,28:1 en ~12 px. | `--ink-700` (#3a3e44, token existente) en los textos/símbolos de `.official-reservation-date__*`, `.official-reservation-calendar__*` y `.trip-reservations__date`. Sin rediseño. | Gate mide el contraste calculado de **todos** los nodos de texto de Reservas y Resumen en 320/390/430/768/1440 (más que axe, que sólo vio 2/5 nodos): base 4,28 → corregido ≥4,5. axe: 0 violaciones. |
| **H06** | `<span aria-label>` genérico (axe `aria-prohibited-attr`). | `EvidenceMark` sólo-glifo: `role="img"` con el nombre en **`title`** (con `aria-label` + `title` iguales Chromium exponía el nombre y una descripción idéntica = anuncio doble). Variante con texto, sin cambios. `PersonToken` «los dos» (mismo patrón, mismas superficies) recibe `role="img"`. | Gate: sin genéricos etiquetados, rol/nombre/procedencia, un solo atributo de nombre, árbol AX (Chromium: `image` «Registrado», sin descripción). axe: 0. **No se probaron lectores físicos.** |
| **H07** | `select` 35,2 px e `input` 39,2 px en Herramientas. | `min-height: var(--tap-min)` en `.inter-hub-segments select/input` y `.accommodation-manager__input`. | 6 campos ≥44 px, sin solape, sin recorte ni overflow, foco visible y en vista en 320/390/430/768/1440. Base 35,2/39,2 → OK. |

## Rendimiento

Ver [FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md](FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md). Resumen: los dos excesos de presupuesto
eran **atribución del gate** (peticiones de la portada iniciadas antes del clic real y contadas como ciudad; diferencias
idénticas al byte a las de la auditoría); el gate pasa a medir por inicio de petición desde el clic real, sin tocar presupuestos.
La carga diferida de Tokio **no se reprodujo**: se separan comportamiento del navegador y carga anticipada del producto.
Tokio y Kioto siguen a 230 B y 550 B del límite real.

## Cambios en gates y tests (todos justificados, ninguno debilitado para dar verde)

- `b10-performance-check`: ventana/atribución (arriba).
- `block5-travellers-browser-audit` sección K: esperaba la sustitución silenciosa del documento corrupto, que es exactamente H04; ahora exige conservarlo y avisar.
- `b31-reservas-resumen-check`: su fixture «vacío» usaba `days: []`, que la app nunca produce y su parser rechaza (antes se sustituía en silencio); ahora `days: null`.
- Tests de código fuente (`useState<…>`, `}, []);`, estructura de `App.tsx`): se actualizan a `useStoredDocument`, `[setDraft]` y `LazySurfaceBoundary`, conservando las invariantes (un único dueño del documento, una sola clave).
- Nuevos: `final-audit-data-recovery-check`, `final-audit-a11y-check` (añadidos a `p06-v2-certify.sh`, de modo que el CI existente `p06-certification.yml` los ejecuta también en **WebKit**), `stored-document.test.ts`, y los scripts de investigación.

## Limitaciones y riesgos

- WebKit no existe en este entorno: sólo Chromium local; WebKit se valida en el CI del PR (`p06-certification.yml`).
- **H03 en WebKit (limitación real, no resuelta):** con el módulo bloqueado por el inspector de Playwright, en WebKit 26.5 ni «Recargar la página», ni una segunda recarga, ni navegar a otra URL vuelven a pedir el chunk dentro de la misma sesión (red correcta: `fetch` 200, otro chunk importa bien); un contexto **nuevo** con el mismo almacenamiento sí lo carga y conserva los datos (CI run 37507141241). No se sabe si un fallo de red real en Safari se comporta igual: el bloqueo por inspector no es un fallo de red. El gate acepta WebKit sólo si la sesión limpia recupera y emite un `WARN`. **Pendiente de prueba en Safari/iPhone reales**; si se confirma, la recuperación para el usuario sería cerrar y reabrir la pestaña, y habría que decidir si basta o si se necesita otra salida.
- Sin Safari/iPhone físico, VoiceOver, TalkBack ni NVDA.
- En una pestaña obsoleta, las mutaciones **por índice** (p. ej. mover una parada por posición) se aplican sobre el estado vigente; el evento `storage` reduce esa ventana a casi nada, pero no la elimina. Las mutaciones por id (reubicar, añadir a día) revalidan.
- `retryPersistence` (reintento tras fallo de cuota) reescribe la carga pendiente sin comprobar cambios externos.
- «Exportar respaldo» con datos protegidos exporta el estado en memoria (inicial), no los datos conservados; el aviso ofrece «Descargar copia» para eso.
- Quedan claves `nihon.recovered.*` en `localStorage` tras «Empezar de nuevo»; nada las lee ni las borra.
- Otros gates Chromium-only no ejecutados aquí (Phase 3F/4, Block 3/4/6/7…) podrían depender de la sustitución silenciosa de datos inválidos; la ejecución local cubrió los gates listados en `final-audit-evidence/fix/gates/summary.txt`.
- Seguimiento sin cambio: JP-126 (barrio/coordenadas frente a JP-125) — no se toca el dataset sin fuente oficial.
