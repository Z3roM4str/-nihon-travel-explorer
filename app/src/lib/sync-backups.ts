import { CANONICAL_KEYS, copyOriginals, readStoredDraft, readStoredTravellers, type StorageLike } from "./stored-document";
import { serializeVerifiedBackup } from "./portable-backup";

const INDEX = "nihon.sync.backups.v1";
const DAILY_INDEX = "nihon.sync.backups.daily.v1";
const PREFIX = "nihon.recovered.before-sync.";
export const SYNC_BACKUP_COUNT = 5;
export const SYNC_DAILY_BACKUP_DAYS = 7;
let sequence = 0;

/** The device has no room left for a pre-sync copy; nothing is applied without one. */
export class StorageFullError extends Error {
  constructor() { super("storage-full"); }
}

const isQuota = (error: unknown) => error instanceof Error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.message === "storage-full");
const validKeys = (keys: unknown) => Array.isArray(keys) && keys.every((key) => typeof key === "string" && key.startsWith(PREFIX));
const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dayNumber = (day: string) => Math.round(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86400000);

function copy(storage: StorageLike, stamp: string): string[] {
  const outcome = copyOriginals(storage, stamp);
  if (!outcome.ok) throw new StorageFullError();
  return outcome.copiedKeys;
}

/**
 * Before applying remote changes keep (1) the first copy of each local day for 7 days, which a
 * burst of syncs can never rotate away, and (2) the last 5 pre-sync copies.
 */
export function keepSyncBackup(storage: StorageLike, now = new Date()): void {
  const raw = storage.getItem(INDEX);
  const previous: string[][] = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(previous) || !previous.every(validKeys)) throw new Error("Invalid backup index");
  const dailyRaw = storage.getItem(DAILY_INDEX);
  const daily: { day: string; keys: string[] }[] = dailyRaw ? JSON.parse(dailyRaw) : [];
  if (!Array.isArray(daily) || !daily.every((entry) => entry && /^\d{4}-\d{2}-\d{2}$/.test(entry.day) && validKeys(entry.keys))) throw new Error("Invalid daily backup index");
  try {
    const today = localDay(now);
    if (!daily.some((entry) => entry.day === today)) {
      daily.push({ day: today, keys: copy(storage, `before-sync.daily-${today}`) });
      const keep = daily.filter((entry) => dayNumber(today) - dayNumber(entry.day) < SYNC_DAILY_BACKUP_DAYS);
      storage.setItem(DAILY_INDEX, JSON.stringify(keep));
      for (const entry of daily) if (!keep.includes(entry)) for (const key of entry.keys) storage.removeItem(key);
    }
    const stamp = `before-sync.${now.toISOString().replace(/[:.]/g, "-")}.${++sequence}`;
    const all = [...previous, copy(storage, stamp)];
    storage.setItem(INDEX, JSON.stringify(all.slice(-SYNC_BACKUP_COUNT)));
    for (const keys of all.slice(0, -SYNC_BACKUP_COUNT)) for (const key of keys) storage.removeItem(key);
  } catch (error) {
    if (isQuota(error)) throw new StorageFullError();
    throw error;
  }
}

export type SyncBackupEntry = { kind: "daily" | "rotating"; label: string; keys: string[] };

/** Every pre-sync copy on this device, daily ones first (newest first), then the rotating ones. */
export function listSyncBackups(storage: StorageLike): SyncBackupEntry[] {
  const parse = (key: string): unknown[] => {
    try { const value = JSON.parse(storage.getItem(key) ?? "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
  };
  const daily = parse(DAILY_INDEX)
    .filter((entry): entry is { day: string; keys: string[] } => !!entry && typeof (entry as { day?: unknown }).day === "string" && validKeys((entry as { keys?: unknown }).keys))
    .map((entry) => ({ kind: "daily" as const, label: entry.day, keys: entry.keys })).reverse();
  const rotating = parse(INDEX).filter(validKeys).map((keys) => {
    const stamp = (keys as string[])[0]?.slice(PREFIX.length).split(".")[0] ?? "";
    // `2026-10-11T17-03-05-123Z` → ISO instant, formatted by the UI in the device's time zone.
    const label = stamp.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "$1T$2:$3:$4.$5Z");
    return { kind: "rotating" as const, label, keys: keys as string[] };
  }).reverse();
  return [...daily, ...rotating].filter((entry) => entry.keys.length > 0);
}

/**
 * Turns a pre-sync copy back into a normal portable backup, so it is restored through the same
 * reader, preview and confirmation as an imported file. Returns null if the copy is unreadable.
 */
export function syncBackupText(storage: StorageLike, entry: SyncBackupEntry, now = new Date()): string | null {
  const view: StorageLike = {
    getItem: (canonical) => {
      if (!(CANONICAL_KEYS as readonly string[]).includes(canonical)) return null;
      const key = entry.keys.find((k) => k.endsWith(`.${canonical}`));
      return key ? storage.getItem(key) : null;
    },
    setItem: () => { throw new Error("read-only"); },
    removeItem: () => { throw new Error("read-only"); },
  };
  const travellers = readStoredTravellers(view, () => "unused");
  const draft = readStoredDraft(view);
  if (!travellers.doc || travellers.status !== "valid" || (draft.status !== "valid" && draft.status !== "absent")) return null;
  const verified = serializeVerifiedBackup(travellers.doc, draft.doc, now.toISOString());
  return verified.ok ? verified.text : null;
}

export function syncBackupTitle(entry: SyncBackupEntry): string {
  if (entry.kind === "daily") return `Copia diaria del ${entry.label}`;
  const at = new Date(entry.label);
  return Number.isNaN(at.getTime()) ? `Copia ${entry.label}` : `Copia del ${at.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`;
}

/** The file handed to the normal import (`prepareImport`), exactly as if the person had picked it. */
export function syncBackupFile(storage: StorageLike, entry: SyncBackupEntry, now = new Date()): File | null {
  const text = syncBackupText(storage, entry, now);
  return text === null ? null : new File([text], `copia-antes-de-sincronizar-${entry.label.slice(0, 10)}.json`, { type: "application/json" });
}
