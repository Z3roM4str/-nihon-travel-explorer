/** Copias de trabajo de esta pestaña. Nunca sustituyen por sí solas un documento canónico. */
export const PENDING_COPY_PREFIX = "nihon.pending.v1.";
const copies = new Map<string, string>();

export function readPendingCopy(key: string): string | null {
  if (copies.has(key)) return copies.get(key)!;
  try {
    const value = sessionStorage.getItem(`${PENDING_COPY_PREFIX}${key}`);
    if (value !== null) copies.set(key, value);
    return value;
  } catch { return null; }
}

export function keepPendingCopy(key: string, value: string): boolean {
  copies.set(key, value);
  try {
    sessionStorage.setItem(`${PENDING_COPY_PREFIX}${key}`, value);
    return sessionStorage.getItem(`${PENDING_COPY_PREFIX}${key}`) === value;
  } catch { return false; }
}

export function clearPendingCopy(key: string): void {
  copies.delete(key);
  try { sessionStorage.removeItem(`${PENDING_COPY_PREFIX}${key}`); } catch { /* sin garantía al cerrar */ }
}

export function pendingCopies(): Record<string, string> {
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PENDING_COPY_PREFIX)) {
        const value = sessionStorage.getItem(key);
        if (value !== null) copies.set(key.slice(PENDING_COPY_PREFIX.length), value);
      }
    }
  } catch { /* siguen disponibles las copias en memoria */ }
  return Object.fromEntries([...copies].map(([key, value]) => [`pending.${key}`, value]));
}
