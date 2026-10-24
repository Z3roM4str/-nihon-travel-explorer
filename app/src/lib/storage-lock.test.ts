import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeLocks } from "../test-web-locks";
import { SETTLE_AFTER_CONTENTION_MS, runExclusive } from "./storage-lock";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("runExclusive", () => {
  it("sin Web Locks ejecuta la tarea y devuelve su resultado", async () => {
    vi.stubGlobal("navigator", undefined);
    await expect(runExclusive("k", () => 7)).resolves.toBe(7);
  });

  it("sin contención cede sólo un turno: no añade espera al camino habitual", async () => {
    vi.stubGlobal("navigator", { locks: fakeLocks() });
    const ran = vi.fn();
    const done = runExclusive("k", () => { ran(); });
    await vi.advanceTimersByTimeAsync(0);
    await done;
    expect(ran).toHaveBeenCalledTimes(1);
  });

  it("con contención espera a que la invalidación de localStorage del escritor anterior pueda llegar", async () => {
    const locks = fakeLocks();
    vi.stubGlobal("navigator", { locks });
    let release!: () => void;
    const holder = locks.request("nihon:k", {}, () => new Promise<void>((resolve) => { release = resolve; }));
    const ran = vi.fn();
    const queued = runExclusive("k", () => { ran(); return "ok"; });
    await vi.advanceTimersByTimeAsync(5);
    expect(ran).not.toHaveBeenCalled();
    release(); await holder;
    await vi.advanceTimersByTimeAsync(SETTLE_AFTER_CONTENTION_MS - 1);
    expect(ran).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(queued).resolves.toBe("ok");
    expect(ran).toHaveBeenCalledTimes(1);
  });

  it("un lock rechazado no ejecuta la tarea ni la repite", async () => {
    vi.stubGlobal("navigator", { locks: { request: vi.fn().mockRejectedValue(new Error("denied")) } });
    const ran = vi.fn();
    await expect(runExclusive("k", ran)).rejects.toThrow("denied");
    expect(ran).not.toHaveBeenCalled();
  });

  it("una tarea que lanza se ejecuta una sola vez y propaga el error", async () => {
    vi.stubGlobal("navigator", { locks: fakeLocks() });
    const task = vi.fn(() => { throw new Error("boom"); });
    const outcome = runExclusive("k", task).catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(0);
    await expect(outcome).resolves.toBe("boom");
    expect(task).toHaveBeenCalledTimes(1);
  });
});
