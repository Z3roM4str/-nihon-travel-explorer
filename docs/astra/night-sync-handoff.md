# Handoff: Infraestructura de Gustos Compartidos Privados (Astra Night Sync)

**Fecha**: 2026-09-20
**Proyecto**: Nihon Travel Explorer
**Base Commit**: `d24997aa7afa2e2f13079aa0c67d8f51d7414036`
**Branch de Trabajo**: `astra/night-sync`
**Propietario del Módulo**: Astra / Implementador (`app/src/astra/shared-trip/*`, `supabase/migrations/*`, `docs/astra/night-sync-handoff.md`)

---

## 1. Resumen Ejecutivo y Estado

Se implementó la arquitectura e infraestructura de **gustos compartidos privados** para Lorena y Fernando. La solución está completamente tipada, probada de forma unitaria e integrada con un adaptador desacoplado y reactivo preparado para la interfaz de usuario.

### Resumen de Estado
* **Implementado**:
  - Contrato de tipos canonical (`TripMember`, `PlaceInterest`, `ConnectionState`, `AuthSession`, `SharedTripAdapter`).
  - Adaptador en memoria con simulación en tiempo real multi-sesión (`MockSharedTripAdapter` + `MockSharedTripStore`).
  - Adaptador para Supabase (`SupabaseSharedTripAdapter`) contra REST y Realtime con manejo de headers y autenticación.
  - Hook React reusable (`useSharedTrip`) para gestión de sesión, sincronización, reintentos y estados de conexión (`loading` / `saving` / `synced` / `offline` / `error`).
  - Esquema SQL de migración local con Row Level Security (RLS) y publicación de Supabase Realtime (`supabase/migrations/20260920000000_shared_trip_schema.sql`).
  - Suite completa de pruebas automatizadas en `app/src/astra/shared-trip/shared-trip.test.ts`.
* **Verificado**:
  - Pruebas unitarias de sincronización reactiva multi-sesión (8/8 pasadas).
  - Verificación de linter Oxlint en la codebase completa (0 errores, 0 advertencias).
  - Reglas de aislamiento: ninguna edición a `App.tsx`, navegación, lugares, fotografías, workflows ni lockfiles compartidos.
  - Verificación de no interferencia con el itinerario ni datos locales existentes.
* **Pendiente de Activación**:
  - Conexión de variables de entorno de Supabase en producción/staging (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
  - Montaje del hook `useSharedTrip` en los componentes visuales de UI desarrollados por el otro trabajador.

---

## 2. Arquitectura de Datos y Contrato Compartido

### Tipos Canónicos (`app/src/astra/shared-trip/types.ts`)

```typescript
export type ConnectionState = 'loading' | 'saving' | 'synced' | 'offline' | 'error';

export interface TripMember {
  tripId: string;
  memberId: string;
  displayName: string;
}

export interface PlaceInterest {
  tripId: string;
  memberId: string;
  placeId: string;
  interested: boolean;
  updatedAt: string; // ISO-8601
}
```

### Reglas Clave
1. **Identidad del Miembro (`memberId`)**: Proviene de la sesión autenticada (`auth.uid()`), **no** de un campo editable por el cliente.
2. **Clave Lógica del Gusto**: La combinación `(tripId, memberId, placeId)`.
   - Fernando y Lorena tienen registros independientes por cada lugar.
   - Si Fernando marca un lugar (`interested: true`), no sobreescribe el estado de Lorena.
   - Si Lorena desmarca un lugar (`interested: false`), no elimina el interés de Fernando.
3. **Idempotencia y Tiempos**: Cada actualización actualiza o inserta el registro con un `updatedAt` autoritativo.

---

## 3. Adaptador de Sincronización (`SharedTripAdapter`)

El adaptador aísla a la UI de la implementación del backend backend (`Supabase` o `Mock`).

```typescript
export interface SharedTripAdapter {
  getSession(): Promise<AuthSession | null>;
  login(displayName: string, userId?: string): Promise<AuthSession>;
  logout(): Promise<void>;

  getMembers(tripId: string): Promise<TripMember[]>;
  listInterests(tripId: string): Promise<PlaceInterest[]>;

  setInterest(
    tripId: string,
    placeId: string,
    interested: boolean,
    deviceTimestamp?: string
  ): Promise<PlaceInterest>;

  subscribeToChanges(
    tripId: string,
    onEvent: (event: SharedTripChangeEvent) => void
  ): UnsubscribeFn;
}
```

### Hook de React (`useSharedTrip`)

```typescript
import { useSharedTrip } from './astra/shared-trip/useSharedTrip';

const {
  session,
  members,
  interests,
  connectionState, // 'loading' | 'saving' | 'synced' | 'offline' | 'error'
  errorMessage,
  toggleInterest,
  refreshState
} = useSharedTrip({ adapter, tripId: 'japan-trip-2027' });
```

---

## 4. Base de Datos y Seguridad RLS (`supabase/migrations/`)

Ubicación del archivo de migración local aislado:
`supabase/migrations/20260920000000_shared_trip_schema.sql`

### Políticas de Seguridad (Row Level Security - RLS)
* **Lectura de Miembros y Gustos**: Un usuario autenticado solo puede consultar registros de viajes donde figure registrado en `trip_members`.
* **Escritura de Gustos (`place_interests`)**: Un miembro solo puede insertar, actualizar o borrar registros donde `member_id = auth.uid()`. Se prohíbe modificar los gustos de otro miembro.
* **Terceros no autorizados**: Todo intento de consulta o suscripción por un `member_id` no registrado en el viaje es bloqueado en la base de datos PostgreSQL.
* **Publicación Realtime**:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.place_interests;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_members;
  ```

---

## 5. Pruebas Ejecutadas y Resultados

Ubicación del test suite: `app/src/astra/shared-trip/shared-trip.test.ts`

| Test # | Descripción de Verificación | Resultado |
|---|---|---|
| 1 | Dos sesiones independientes autenticadas (Fernando y Lorena) ven a ambos miembros | PASS |
| 2 | Fernando marca un lugar y Lorena recibe la actualización en tiempo real sin recargar página | PASS |
| 3 | Lorena marca el mismo lugar y coexisten ambos intereses bajo la clave `(tripId, memberId, placeId)` | PASS |
| 4 | Fernando desmarca un lugar y NO borra ni afecta el gusto de Lorena | PASS |
| 5 | Cambios simultáneos a lugares diferentes por ambas personas se preservan sin pérdidas | PASS |
| 6 | Intentos de lectura/escritura/suscripción por un tercero no autorizado son rechazados (Forbidden) | PASS |
| 7 | Desconexión, cola de operaciones offline y resincronización automática al reconectar | PASS |
| 8 | Cierre de sesión (`logout`) purga la sesión activa y deniega accesos subsiguientes | PASS |

---

## 6. Separación del Itinerario Planificado

* **Aislamiento Total**: La infraestructura de gustos compartidos no altera los borradores ni el itinerario local guardado (`usePlanningDraft`, `planning-draft-v7.ts`).
* **Futura Integración**: En el futuro, la UI podrá ofrecer la opción de "Importar gustos de Lorena y Fernando al itinerario", lo cual agregará lugares al plan sin duplicar días ni reordenar automáticamente la ruta.

---

## 7. Pasos Exactos de Integración para el Frontend Developer

1. Importar el hook en el componente deseado:
   ```tsx
   import { useSharedTrip } from '../astra/shared-trip/useSharedTrip';
   import { MockSharedTripAdapter } from '../astra/shared-trip/mock-adapter';
   // O SupabaseSharedTripAdapter en modo conectado
   ```
2. Instanciar el adaptador e iniciar la suscripción:
   ```tsx
   const adapter = useMemo(() => new MockSharedTripAdapter(currentSession), [currentSession]);
   const { interests, toggleInterest, connectionState } = useSharedTrip({ adapter, tripId: 'japan-trip-2027' });
   ```
3. Para conectar con Supabase en el futuro:
   - Configurar variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
   - Ejecutar la migración local `supabase/migrations/20260920000000_shared_trip_schema.sql` en la instancia de Supabase.
   - Reemplazar `MockSharedTripAdapter` por `SupabaseSharedTripAdapter`.
