import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyRestore, planRestore, readPortableBackup, summarizeRestore } from "../lib/portable-backup";
import { freshTravellersDocument, withStance } from "../lib/travellers";
import { freshDraft } from "../lib/planning-draft-v8";
import { keepSyncBackup, listSyncBackups, syncBackupFile, syncBackupTitle } from "../lib/sync-backups";
import type { StorageLike } from "../lib/stored-document";

function memory() {
  const map = new Map<string, string>();
  const storage: StorageLike = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
  return { map, storage };
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("a daily pre-sync copy can be restored from Nosotros through the import confirmation", async () => {
  const { storage } = memory();
  let n = 0;
  const people = freshTravellersDocument(() => `t-${++n}`);
  const liked = withStance(withStance(people, "JP-001", "t-1", "interested"), "JP-002", "t-2", "interested");
  expect(applyRestore(storage, { travellers: liked, planningDraft: freshDraft(["JP-001", "JP-002"]), droppedPlaceIds: [] }).ok).toBe(true);
  keepSyncBackup(storage, new Date(2026, 9, 11, 9, 0, 0));
  // Later a sync wipes the likes on this device.
  expect(applyRestore(storage, { travellers: people, planningDraft: freshDraft([]), droppedPlaceIds: [] }).ok).toBe(true);

  const entries = listSyncBackups(storage);
  const daily = entries.find((entry) => entry.kind === "daily")!;
  expect(entries[0]).toBe(daily);
  expect(syncBackupTitle(daily)).toBe("Copia diaria del 2026-10-11");
  expect(entries.some((entry) => entry.kind === "rotating")).toBe(true);

  // Same path as «Importar respaldo»: the file goes through readPortableBackup → planRestore → preview.
  const file = syncBackupFile(storage, daily)!;
  const read = readPortableBackup(await file.text());
  expect(read.ok).toBe(true);
  if (!read.ok) return;
  const plan = planRestore(read.backup, ["JP-001", "JP-002"]);
  expect(plan.travellers.interests.map((i) => i.placeId)).toEqual(["JP-001", "JP-002"]);
  expect(plan.planningDraft?.routeIds).toEqual(["JP-001", "JP-002"]);

  // With sync configured, Nosotros offers the copies and the preview still requires the shared confirmation.
  for (const key of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID", "TRIP_ID"]) vi.stubEnv(`VITE_FIREBASE_${key}`, "test");
  vi.resetModules();
  const { TripBackup } = await import("./TripBackup");
  const base = {
    protectedDocuments: [], onExport: async () => ({ ok: true as const, fileName: "x.json" }), onDownloadOriginals: () => ({ ok: true }),
    onRetryPersistence: () => {}, onChooseFile: () => {}, onConfirm: () => {}, onReset: () => {}, onFinishRestore: () => {},
  };
  const idle = renderToStaticMarkup(createElement(TripBackup, { ...base, importState: { phase: "idle" } }));
  expect(idle).toContain("Recuperar copia de antes de sincronizar");
  const preview = renderToStaticMarkup(createElement(TripBackup, {
    ...base, importState: { phase: "preview", preview: { plan, summary: summarizeRestore(plan), fileName: file.name } },
  }));
  expect(preview).toContain("copia-antes-de-sincronizar-2026-10-11.json");
  expect(preview).toContain("Confirmamos que queremos compartir estos cambios.");
  expect(preview).toMatch(/<button[^>]*disabled=""[^>]*>Sustituir con este respaldo/);
});

it("without sync config Nosotros does not offer pre-sync copies", async () => {
  for (const key of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID", "TRIP_ID"]) vi.stubEnv(`VITE_FIREBASE_${key}`, "");
  vi.resetModules();
  const { TripBackup } = await import("./TripBackup");
  const html = renderToStaticMarkup(createElement(TripBackup, {
    importState: { phase: "idle" }, protectedDocuments: [], onExport: async () => ({ ok: true as const, fileName: "x.json" }),
    onDownloadOriginals: () => ({ ok: true }), onRetryPersistence: () => {}, onChooseFile: () => {}, onConfirm: () => {}, onReset: () => {}, onFinishRestore: () => {},
  }));
  expect(html).not.toContain("Recuperar copia de antes de sincronizar");
});
