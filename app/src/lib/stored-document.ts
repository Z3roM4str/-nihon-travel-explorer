import {
  LEGACY_SAVED_PLACES_KEY,
  TRAVELLERS_STORAGE_KEY,
  TRAVELLERS_VERSION,
  migrateLegacySavedIds,
  parseTravellersDocument,
  type TravellersDocumentV1,
} from "./travellers";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  PLANNING_DRAFT_VERSION,
  parseStoredDraft,
  type ManualPlanningDraftV8,
} from "./planning-draft-v8";

/**
 * Auditoría final (H01, H02, H04) — qué hay REALMENTE en el almacenamiento, y qué se hace con ello.
 *
 * Los dos documentos canónicos (`nihon.travellers.v1` y `nihon.manualPlanningDraft`) se cargaban
 * con un parser que devolvía `null` tanto para «no hay nada» como para «hay algo que no entiendo»,
 * y el hook montaba entonces un valor inicial y lo escribía encima. Una incoherencia pequeña
 * destruía el original. Este módulo separa los cuatro casos que importan:
 *
 *  - `absent`        no hay documento (primer uso, o almacenamiento ilegible): crear uno es correcto;
 *  - `valid`         documento actual o migrable: se carga y se puede escribir encima;
 *  - `invalid`       hay texto, pero no es un documento que Nihon entienda (JSON roto, forma dañada);
 *  - `incompatible`  es un documento de una versión POSTERIOR a la que esta build sabe leer.
 *
 * Los dos últimos están **protegidos**: no se escribe sobre ellos mientras la persona no elija una
 * salida explícita ({@link startFresh}), y esa salida primero guarda una copia aparte.
 */

export type StoredStatus = "absent" | "valid" | "invalid" | "incompatible";

export type StoredRead<T> = {
  status: StoredStatus;
  /** La cadena exacta del almacenamiento (`null` si no había nada). */
  raw: string | null;
  /** El documento cargado; `null` si el estado es `invalid`/`incompatible` (o `absent` sin legado). */
  doc: T | null;
};

export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Una versión numérica entera mayor que la que esta build conoce: es futuro, no daño. */
function isFutureVersion(decoded: unknown, current: number): boolean {
  return (
    isPlainObject(decoded) &&
    typeof decoded.version === "number" &&
    Number.isInteger(decoded.version) &&
    decoded.version > current
  );
}

function classify<T>(
  raw: string | null,
  currentVersion: number,
  parse: (decoded: unknown) => T | null
): StoredRead<T> {
  if (raw === null || raw === "") return { status: "absent", raw, doc: null };
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { status: "invalid", raw, doc: null };
  }
  if (isFutureVersion(decoded, currentVersion)) return { status: "incompatible", raw, doc: null };
  const doc = parse(decoded);
  return doc ? { status: "valid", raw, doc } : { status: "invalid", raw, doc: null };
}

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Lee el documento de viajeros. El almacenamiento legado sólo se consulta cuando no hay documento. */
export function readStoredTravellers(
  storage: StorageLike,
  idFactory: () => string
): StoredRead<TravellersDocumentV1> {
  const read = classify(
    safeGet(storage, TRAVELLERS_STORAGE_KEY),
    TRAVELLERS_VERSION,
    parseTravellersDocument
  );
  if (read.status !== "absent") return read;
  const legacyRaw = safeGet(storage, LEGACY_SAVED_PLACES_KEY);
  if (!legacyRaw) return read;
  try {
    const decoded: unknown = JSON.parse(legacyRaw);
    if (Array.isArray(decoded)) return { ...read, doc: migrateLegacySavedIds(decoded, idFactory) };
  } catch {
    /* un legado ilegible no es un documento protegido: es una clave inerte, que no se toca */
  }
  return read;
}

export function readStoredDraft(storage: StorageLike): StoredRead<ManualPlanningDraftV8> {
  return classify(
    safeGet(storage, PLANNING_DRAFT_STORAGE_KEY),
    PLANNING_DRAFT_VERSION,
    parseStoredDraft
  );
}

export function isProtectedStatus(status: StoredStatus): status is "invalid" | "incompatible" {
  return status === "invalid" || status === "incompatible";
}

// ── Protección en curso (una sola fuente de verdad, como `device-storage`) ─────────────────────

export type ProtectedDocument = {
  key: string;
  status: "invalid" | "incompatible";
};

const protections = new Map<string, ProtectedDocument>();
const protectionListeners = new Set<() => void>();
/** Instantánea inmutable: `useSyncExternalStore` compara por identidad. */
let protectionSnapshot: readonly ProtectedDocument[] = [];

function publishProtection(): void {
  protectionSnapshot = [...protections.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const listener of protectionListeners) listener();
}

export function setProtection(key: string, status: StoredStatus): void {
  const before = protections.get(key);
  if (isProtectedStatus(status)) {
    if (before && before.status === status) return;
    protections.set(key, { key, status });
  } else {
    if (!before) return;
    protections.delete(key);
  }
  publishProtection();
}

export function isKeyProtected(key: string): boolean {
  return protections.has(key);
}

export function getProtectionSnapshot(): readonly ProtectedDocument[] {
  return protectionSnapshot;
}

export function subscribeProtection(listener: () => void): () => void {
  protectionListeners.add(listener);
  return () => protectionListeners.delete(listener);
}

// ── Aviso de «el almacenamiento cambió por debajo de ti» dentro de la MISMA pestaña ─────────────

/**
 * El evento `storage` del navegador sólo llega a las OTRAS pestañas. Una restauración (H01) o una
 * recuperación escribe en esta, así que los hooks montados se enteran por aquí y vuelven a leer.
 */
const replacedListeners = new Set<() => void>();

export function subscribeStorageReplaced(listener: () => void): () => void {
  replacedListeners.add(listener);
  return () => replacedListeners.delete(listener);
}

export function notifyStorageReplaced(): void {
  for (const listener of [...replacedListeners]) listener();
}

// ── Copia y recuperación explícita ─────────────────────────────────────────────────────────────

export const CANONICAL_KEYS = [TRAVELLERS_STORAGE_KEY, PLANNING_DRAFT_STORAGE_KEY] as const;
export const RECOVERED_KEY_PREFIX = "nihon.recovered.";

/** El contenido original, tal cual está, de cada documento canónico que exista. */
export function collectOriginals(storage: StorageLike): Record<string, string> {
  const originals: Record<string, string> = {};
  for (const key of CANONICAL_KEYS) {
    const value = safeGet(storage, key);
    if (value !== null) originals[key] = value;
  }
  return originals;
}

/** Texto del archivo que se entrega al descargar la copia: un JSON con las cadenas originales. */
export function serializeOriginals(originals: Record<string, string>, exportedAt: string): string {
  return JSON.stringify({ format: "nihon-stored-data-copy", exportedAt, originals }, null, 2);
}

export type CopyOutcome = { ok: true; copiedKeys: string[] } | { ok: false };

/**
 * Guarda una copia aparte de TODO lo que hay (no sólo del documento dañado: el otro puede quedar
 * sin sentido sin él), bajo `nihon.recovered.<instante>.<clave>`. Nada en la aplicación la lee ni
 * la borra. Cada copia se relee para comprobar que quedó escrita tal cual.
 */
export function copyOriginals(storage: StorageLike, stamp: string): CopyOutcome {
  const copied: string[] = [];
  for (const [key, value] of Object.entries(collectOriginals(storage))) {
    const copyKey = `${RECOVERED_KEY_PREFIX}${stamp}.${key}`;
    try {
      storage.setItem(copyKey, value);
      if (safeGet(storage, copyKey) !== value) throw new Error("copy mismatch");
      copied.push(copyKey);
    } catch {
      // Lo copiado hasta aquí se deja: sobra, no estorba, y quien reintente escribirá la misma clave.
      return { ok: false };
    }
  }
  return { ok: true, copiedKeys: copied };
}

export type StartFreshOutcome =
  | { ok: true; copiedKeys: string[] }
  | { ok: false; reason: "copy-failed" | "remove-failed" };

/**
 * La salida explícita: copia todo ({@link copyOriginals}) y sólo entonces retira los documentos
 * protegidos.
 *
 * El orden es la garantía. Si cualquier copia falla, no se ha borrado nada y se devuelve el error;
 * si la retirada falla después de copiar, las copias sobran pero ningún dato se ha perdido.
 */
export function startFresh(
  storage: StorageLike,
  protectedKeys: readonly string[],
  stamp: string
): StartFreshOutcome {
  const copy = copyOriginals(storage, stamp);
  if (!copy.ok) return { ok: false, reason: "copy-failed" };
  for (const key of protectedKeys) {
    try {
      storage.removeItem(key);
    } catch {
      return { ok: false, reason: "remove-failed" };
    }
  }
  return { ok: true, copiedKeys: copy.copiedKeys };
}

/** Vuelve a clasificar los dos documentos y publica el resultado (arranque, restauración, recuperación). */
export function refreshProtection(storage: StorageLike): void {
  setProtection(TRAVELLERS_STORAGE_KEY, readStoredTravellers(storage, () => "unused").status);
  setProtection(PLANNING_DRAFT_STORAGE_KEY, readStoredDraft(storage).status);
}
