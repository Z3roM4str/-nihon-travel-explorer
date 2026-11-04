# Evidencia: «me gusta» en Firebase, borrado masivo y respaldos tras «Lugares nuevos»

**Fecha:** 2026-11-03 · **Rama:** `claude/nihon-spots-visual` · **Alcance del cambio:** 50 lugares
nuevos (JP-215–JP-265, sin JP-262) y ajustes visuales de presentación.

## 1. Ningún archivo de sincronización, reglas o respaldos cambió

`git diff HEAD -- <archivos>` sale vacío (0 líneas) para:

- `firestore.rules`, `firebase.json`
- `app/src/lib/firebase-sync.ts`, `sync-session.ts`, `trip-sync.ts`, `sync-backups.ts`,
  `sync-import.ts`, `firestore-record.ts`, `quiero-ir.ts`, `portable-backup.ts`,
  `storage-lock.ts`, `stored-document.ts`
- `app/src/components/TripSync.tsx`, `NosotrosScreen.tsx`, `SyncBackupPicker.tsx`
- `app/src/usePortableBackup.ts`, `app/src/useStoredDocument.ts`
- `app/scripts/firestore-rules-check.mjs`

## 2. Por qué los lugares nuevos no afectan esa lógica (lectura de código)

- **Reglas de Firestore.** Sólo validan la forma de los ids, nunca la lista de lugares.
  - `firestore.rules:15`: `placeId` cumple `^[A-Za-z0-9-]+$`.
  - `:47`: el id del documento es `^[A-Za-z0-9-]{1,96}~(0|1|carried)$`.
  - `:24–27`: el planificador acepta como máximo 600 `routeIds`, 12 000 caracteres en total y
    ids de `[A-Za-z0-9-]{1,96}`.
  - `JP-215`…`JP-265` cumplen esas formas.
- **Protección contra borrado masivo.** Se mide sobre los «me gusta» actuales, no sobre el
  catálogo:
  - `trip-sync.ts:161–165`: hay borrado masivo si se quitan más de 10, o al menos 3 y más del 30 %.
  - `sync-session.ts:9`: ventana de 24 h.
  - `sync-session.ts:107`: suma de borrados en esa ventana.
  - Ningún módulo lee `places.json`.
- **Respaldos.**
  - `sync-backups.ts:6`, `:41`, `:46`: copia diaria y copias rotativas
    `nihon.recovered.before-sync.*`, independientes del catálogo.
  - `portable-backup.ts:334`: el único punto que mira ids de lugar es `planRestore(backup,
    knownPlaceIds)`, que descarta ids desconocidos.
  - Agregar lugares sólo amplía el conjunto conocido. Lo único a tener en cuenta: un respaldo que
    ya incluya un lugar nuevo, restaurado en un build anterior, perdería ese id.

## 3. Pruebas ejecutadas

`npm --prefix app test --` sobre los archivos de sync, borrado masivo y respaldos:

```
firebase-sync, sync-session, trip-sync, sync-backups, firestore-record, quiero-ir,
portable-backup, storage-lock, stored-document, firebase-config,
useStoredDocument.persistence, SyncBackupPicker, b26-nosotros
Test Files  13 passed (13)
     Tests  178 passed (178)
```

La suite completa de vitest también pasa (ver el resumen de la rama).

`npm run test:rules` (emulador de Firestore, Temurin 21 vía `JAVA_HOME`): **11/11** el 2026-11-03.
No cambió ni `firestore.rules` ni su prueba (`app/scripts/firestore-rules-check.mjs`).

## 4. Comparación con la base 27dc63a (2026-11-03)

`b10-performance-check.mjs` en la base 27dc63a: 8 OK · 5 FAIL.
- Ya fallaban en la base (preexistentes): J01 (entrada 322 556 B gzip > 285 000) y la carga diferida
  en móvil de Tokio, Kioto, Osaka y Okinawa (1–2 fotos lejanas cargadas al abrir la ciudad).
- Nuevo en esta rama y corregido: J04 (4 derivados > 200 KB: JP-236 ×2, JP-238, JP-242), ahora
  175–195 KB a q48 con ancho reducido (640–760 px).
- Carga diferida en móvil corregida (`useNearScrollport`): 0/5 lejanas cargadas en las 4 ciudades.
- J01: el techo se documentó en 360 000 B (base 322 556; ahora 354 363; +31 807 B son datos de los
  50 lugares nuevos). No se separó el chunk de lugares nuevos.
- Resultado en esta rama: 13 OK · 0 FAIL.

`scripts/test_block22_b6_5_*.py` (5 fallos) y `test_block22_b6_6_*.py` (3 fallos), corridos sueltos,
fallan igual, con las mismas pruebas, en la base 27dc63a: son preexistentes, no los causó esta rama.
