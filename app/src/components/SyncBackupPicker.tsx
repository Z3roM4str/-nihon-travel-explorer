import { useState } from "react";
import { deviceStorage } from "../lib/device-storage";
import { listSyncBackups, syncBackupFile, syncBackupTitle, type SyncBackupEntry } from "../lib/sync-backups";

/**
 * N12 — «Recuperar copia de antes de sincronizar». The copies kept before each sync (one per day for
 * 7 days and the last 5) become a normal backup file, so restoring one goes through the same
 * preview and confirmation (including the shared-trip confirmation) as importing a file.
 */
export function SyncBackupPicker({ onChooseFile }: { onChooseFile: (file: File) => void }) {
  const [entries, setEntries] = useState<SyncBackupEntry[] | null>(null);
  const [problem, setProblem] = useState(false);
  return (
    <div className="trip-backup__sync-copies">
      <button type="button" className="button button--secondary" onClick={() => { setProblem(false); setEntries(listSyncBackups(deviceStorage)); }}>
        Recuperar copia de antes de sincronizar
      </button>
      {entries && entries.length === 0 && (
        <p className="trip-backup__note">Todavía no hay copias de antes de sincronizar en este dispositivo.</p>
      )}
      {entries && entries.length > 0 && (
        <ul className="trip-backup__copies" aria-label="Copias de antes de sincronizar">
          {entries.map((entry) => (
            <li key={entry.keys[0]}>
              <button type="button" className="button button--secondary" onClick={() => {
                const file = syncBackupFile(deviceStorage, entry);
                if (!file) { setProblem(true); return; }
                onChooseFile(file);
              }}>
                {syncBackupTitle(entry)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem && <p role="alert">No se pudo leer esa copia. No se cambió nada; elijan otra.</p>}
    </div>
  );
}
