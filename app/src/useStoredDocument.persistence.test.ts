import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoredDocumentStore, type StoredDocumentAdapter } from "./useStoredDocument";
import { deviceStorage, getPersistenceProblems, resetPersistenceForTests } from "./lib/device-storage";
import { clearPendingCopy, keepPendingCopy, readPendingCopy } from "./lib/persistence-recovery";
import type { StoredRead } from "./lib/stored-document";

type Doc = { version: number; count: number };
const key = "nihon.manualPlanningDraft";
let raw: string;
let writes: string[];
let adapter: StoredDocumentAdapter<Doc>;
function read(): StoredRead<Doc> {
  try {
    const doc = JSON.parse(raw) as Doc;
    return doc.version > 1 ? { status: "incompatible", raw, doc: null } : { status: "valid", raw, doc };
  } catch { return { status: "invalid", raw, doc: null }; }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal("navigator", undefined);
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) });
  resetPersistenceForTests(); clearPendingCopy(key); clearPendingCopy("restore");
  raw = JSON.stringify({ version: 1, count: 0, _w: [] }); writes = [];
  adapter = { key, initial: () => ({ version: 1, count: 0 }), read,
    serialize: JSON.stringify, parse: (value) => JSON.parse(value) as Doc,
    storage: { getItem: () => raw, setItem: (_, value) => { writes.push(value); raw = value; }, removeItem: () => { throw new Error("Unexpected delete"); } } };
});
afterEach(() => { clearPendingCopy(key); clearPendingCopy("restore"); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("diario de persistencia: protecciones en cada frontera", () => {
  it("clasifica de nuevo justo antes del setItem aunque la primera lectura bajo el lock fuese válida", async () => {
    const store = new StoredDocumentStore(adapter);
    store.update((doc) => ({ ...doc, count: doc.count + 1 }));
    const original = JSON.stringify({ version: 2, count: 77 });
    let first = true;
    adapter.read = () => { const result = read(); if (first) { first = false; raw = original; } return result; };
    await store.flush();
    expect(raw).toBe(original); expect(writes).toEqual([]);
    expect(readPendingCopy(key)).toContain('"count\\\":1');
  });
  it("un reintento reconcilia la intención con el vigente, no el payload que falló", async () => {
    let fail = true;
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem: (_: string, value: string) => { if (fail) throw new Error("quota"); raw = value; }, removeItem: () => { throw new Error("Unexpected delete"); } });
    adapter.storage = deviceStorage;
    const store = new StoredDocumentStore(adapter);
    store.update((doc) => ({ ...doc, count: doc.count + 1 })); await store.flush();
    expect(JSON.parse(raw).count).toBe(0);
    raw = JSON.stringify({ version: 1, count: 10, _w: ["remote"] }); fail = false;
    await store.flush(); expect(JSON.parse(raw).count).toBe(11);
  });
  it("un lock rechazado no ejecuta la tarea y conserva la copia", async () => {
    vi.stubGlobal("navigator", { locks: { request: vi.fn().mockRejectedValue(new Error("denied")) } });
    const store = new StoredDocumentStore(adapter);
    store.update((doc) => ({ ...doc, count: 1 })); await store.flush();
    expect(JSON.parse(raw).count).toBe(0); expect(writes).toEqual([]); expect(readPendingCopy(key)).not.toBeNull();
  });
  it("una tarea que lanza no se ejecuta de nuevo fuera del lock", async () => {
    const set = vi.fn(() => { throw new Error("quota"); }); adapter.storage.setItem = set;
    vi.stubGlobal("navigator", { locks: { request: (_: string, __: unknown, task: () => void) => Promise.resolve().then(task) } });
    const store = new StoredDocumentStore(adapter);
    store.update((doc) => ({ ...doc, count: 1 })); await store.flush();
    expect(set).toHaveBeenCalledTimes(1); expect(JSON.parse(raw).count).toBe(0);
  });
  it("conserva literalmente una copia de sesión ilegible, incluso tras cambios externos", async () => {
    keepPendingCopy(key, "{damaged-recovery"); const store = new StoredDocumentStore(adapter);
    raw = JSON.stringify({ version: 1, count: 7, _w: [] }); await store.flush();
    expect(JSON.parse(raw).count).toBe(7); expect(writes).toEqual([]); expect(readPendingCopy(key)).toBe("{damaged-recovery");
    expect(getPersistenceProblems().some((p) => p.blocking)).toBe(true);
  });
  it("el snapshot pendiente que se recupera de la recarga se bloquea si su base cambia", async () => {
    const recovery = JSON.stringify({ raw, value: JSON.stringify({ version: 1, count: 1 }), pending: true, conflict: false, writes: [[]] });
    keepPendingCopy(key, recovery); const store = new StoredDocumentStore(adapter);
    raw = JSON.stringify({ version: 1, count: 8, _w: ["remote"] }); await store.flush();
    expect(JSON.parse(raw).count).toBe(8); expect(writes).toEqual([]); expect(readPendingCopy(key)).toBe(recovery);
  });
});
