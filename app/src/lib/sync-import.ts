import { captureChanges, projectTrip, type SyncRecords, type TripState } from "./trip-sync";

export const SYNC_IMPORT_KEY = "nihon.sync.import.v1";
export type SyncImport = { id: string; confirmed: boolean; before: TripState; after: TripState };
export function importNeedsConfirmation(configured: boolean, confirmed: boolean): boolean { return configured && !confirmed; }

/** An unconfirmed offline import is a new baseline, never an instruction to remove shared data. */
export function captureImportedChanges(records: SyncRecords, baseline: SyncRecords | null, current: SyncRecords, writer: string, now: number, imported?: SyncImport | null): SyncRecords {
  const base = imported ? projectTrip(imported.confirmed ? imported.before : imported.after, writer) : baseline;
  return captureChanges(records, base, current, writer, now);
}
