import { expect, it } from "vitest";
import { CANONICAL_KEYS, type StorageLike } from "./stored-document";
import { keepSyncBackup, StorageFullError, SYNC_BACKUP_COUNT, SYNC_DAILY_BACKUP_DAYS } from "./sync-backups";

function memory(quotaFor: (key: string) => boolean = () => false) {
  const map = new Map<string, string>();
  for (const key of CANONICAL_KEYS) map.set(key, JSON.stringify({ key }));
  const storage: StorageLike = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      if (quotaFor(key)) throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
      map.set(key, value);
    },
    removeItem: (key) => { map.delete(key); },
  };
  return { map, storage };
}
const day = (n: number) => new Date(2026, 9, n, 12, 0, 0);
const daily = (map: Map<string, string>) => (JSON.parse(map.get("nihon.sync.backups.daily.v1") ?? "[]") as { day: string }[]).map((entry) => entry.day);
const copiesOf = (map: Map<string, string>, marker: string) => [...map.keys()].filter((key) => key.includes(marker));

it("keeps the first copy of each day for 7 days, which the 5 rotating copies never push out", () => {
  const { map, storage } = memory();
  for (let i = 0; i < 20; i++) keepSyncBackup(storage, day(1));
  expect(JSON.parse(map.get("nihon.sync.backups.v1")!)).toHaveLength(SYNC_BACKUP_COUNT);
  expect(daily(map)).toEqual(["2026-10-01"]);
  expect(copiesOf(map, "daily-2026-10-01")).toHaveLength(CANONICAL_KEYS.length);
  for (let d = 2; d <= 9; d++) keepSyncBackup(storage, day(d));
  expect(daily(map)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
  expect(daily(map)).toHaveLength(SYNC_DAILY_BACKUP_DAYS);
  expect(copiesOf(map, "daily-2026-10-01")).toEqual([]);
  expect(copiesOf(map, "daily-2026-10-02")).toEqual([]);
  expect(copiesOf(map, "daily-2026-10-03")).toHaveLength(CANONICAL_KEYS.length);
});

it("the daily copy is the first of the day and is not overwritten by later syncs", () => {
  const { map, storage } = memory();
  keepSyncBackup(storage, day(1));
  map.set(CANONICAL_KEYS[0], JSON.stringify({ changed: true }));
  keepSyncBackup(storage, day(1));
  const key = copiesOf(map, "daily-2026-10-01").find((k) => k.endsWith(CANONICAL_KEYS[0]))!;
  expect(map.get(key)).toBe(JSON.stringify({ key: CANONICAL_KEYS[0] }));
});

it("reports a full storage clearly instead of a generic failure", () => {
  const { storage } = memory((key) => key.startsWith("nihon.recovered."));
  expect(() => keepSyncBackup(storage, day(1))).toThrow(StorageFullError);
  const indexFull = memory((key) => key === "nihon.sync.backups.v1");
  expect(() => keepSyncBackup(indexFull.storage, day(1))).toThrow(StorageFullError);
});
