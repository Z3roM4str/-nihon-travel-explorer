import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deviceStorage,
  getPersistenceState,
  resetPersistenceForTests,
  retryPersistence,
  subscribePersistence,
  registerPersistenceRetry,
  getPersistenceProblems,
} from "./device-storage";

/**
 * DDR-03 — el contrato de persistencia, probado sobre la máquina de estados real.
 *
 * El entorno de pruebas es `node`, sin `localStorage`. En vez de añadir jsdom por esto, se instala
 * un doble en el global: el módulo lee `localStorage` en cada llamada, no al importarse, así que
 * un doble asignado antes de cada caso es exactamente lo que ve.
 */

type Behaviour = { fail: boolean };

function installStorage(behaviour: Behaviour) {
  const data = new Map<string, string>();
  const fake = {
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      if (behaviour.fail) throw new DOMException("quota", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key: string) => {
      if (behaviour.fail) throw new DOMException("denied", "SecurityError");
      data.delete(key);
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = fake;
  return data;
}

let behaviour: Behaviour;
let data: Map<string, string>;

beforeEach(() => {
  vi.stubGlobal("navigator", undefined);
  resetPersistenceForTests();
  behaviour = { fail: false };
  data = installStorage(behaviour);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("DDR-03 — estado de persistencia", () => {
  it("empieza y se queda en «ok» mientras las escrituras funcionan", () => {
    expect(getPersistenceState()).toBe("ok");
    deviceStorage.setItem("nihon.travellers.v1", "{}");
    deviceStorage.setItem("nihon.manualPlanningDraft", "{}");
    expect(getPersistenceState()).toBe("ok");
    expect(data.get("nihon.travellers.v1")).toBe("{}");
  });

  it("pasa a «error» en cuanto una escritura falla, y VUELVE A LANZAR", () => {
    behaviour.fail = true;
    expect(() => deviceStorage.setItem("nihon.travellers.v1", '{"a":1}')).toThrow();
    expect(getPersistenceState()).toBe("error");
  });

  it("re-lanzar es lo que mantiene intacto el `try/catch` de cada módulo puro", () => {
    behaviour.fail = true;
    // Así es como lo llaman `writeTravellersDocument`/`writeDraft`: atrapan y conservan en memoria.
    let swallowed = false;
    try {
      deviceStorage.setItem("nihon.manualPlanningDraft", "{}");
    } catch {
      swallowed = true;
    }
    expect(swallowed).toBe(true);
    expect(getPersistenceState()).toBe("error");
  });

  it("un borrado que falla también cuenta como fallo de persistencia", () => {
    behaviour.fail = true;
    expect(() => deviceStorage.removeItem("nihon.manualPlanningDraft")).toThrow();
    expect(getPersistenceState()).toBe("error");
  });

  it("una lectura fallida se lanza para que el propietario la clasifique como protegida", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    expect(() => deviceStorage.getItem("nihon.travellers.v1")).toThrow("blocked");
    expect(getPersistenceState()).toBe("ok");
  });

  it("notifica a los suscriptores sólo cuando el estado cambia de verdad", () => {
    let calls = 0;
    const unsubscribe = subscribePersistence(() => {
      calls += 1;
    });
    behaviour.fail = true;
    try {
      deviceStorage.setItem("k1", "v1");
    } catch {
      /* esperado */
    }
    try {
      deviceStorage.setItem("k2", "v2");
    } catch {
      /* esperado */
    }
    // Dos fallos, un solo cambio de estado: ok → error.
    expect(calls).toBe(1);
    unsubscribe();
  });
});

describe("DDR-03 — reintento seguro", () => {
  it("una preferencia que vuelve a fallar sigue pendiente", async () => {
    behaviour.fail = true;
    expect(() => deviceStorage.setItem("nihon.zoneComparison.v1", "preference")).toThrow();
    expect(await retryPersistence()).toBe("error");
    expect(data.has("nihon.zoneComparison.v1")).toBe(false);
  });
  it("reintenta la preferencia exacta sólo si su preimagen no cambió", async () => {
    const key = "nihon.zoneComparison.v1";
    behaviour.fail = true;
    expect(() => deviceStorage.setItem(key, "preference")).toThrow();
    behaviour.fail = false;
    expect(await retryPersistence()).toBe("ok");
    expect(data.get(key)).toBe("preference");
  });
  it("conserva una preferencia externa sin sobrescribirla", async () => {
    const key = "nihon.zoneComparison.v1";
    behaviour.fail = true;
    expect(() => deviceStorage.setItem(key, "local")).toThrow();
    behaviour.fail = false;
    data.set(key, "external");
    expect(await retryPersistence()).toBe("error");
    expect(data.get(key)).toBe("external");
    expect(getPersistenceProblems()[0].message).toContain("otra pestaña");
  });
  it("sin propietario no escribe un payload canónico viejo ni una versión futura", async () => {
    const key = "nihon.travellers.v1";
    behaviour.fail = true;
    expect(() => deviceStorage.setItem(key, "old snapshot")).toThrow();
    behaviour.fail = false;
    data.set(key, '{"version":2}');
    expect(await retryPersistence()).toBe("error");
    expect(data.get(key)).toBe('{"version":2}');
    expect(getPersistenceProblems()[0].message).toContain("originales");
  });
  it("delega TODAS las claves canónicas a los propietarios, no a sus payloads fallidos", async () => {
    const keys = ["nihon.travellers.v1", "nihon.manualPlanningDraft"];
    behaviour.fail = true;
    for (const key of keys) expect(() => deviceStorage.setItem(key, "old")).toThrow();
    behaviour.fail = false;
    for (const key of keys) registerPersistenceRetry(key, async () => { deviceStorage.setItem(key, "reconciled " + key); });
    expect(await retryPersistence()).toBe("ok");
    for (const key of keys) expect(data.get(key)).toBe("reconciled " + key);
  });
  it("un propietario fallido mantiene el aviso y nunca dispara una escritura directa", async () => {
    const key = "nihon.manualPlanningDraft";
    data.set(key, "original"); behaviour.fail = true;
    expect(() => deviceStorage.setItem(key, "old")).toThrow(); behaviour.fail = false;
    registerPersistenceRetry(key, async () => { throw new Error("lock failed"); });
    expect(await retryPersistence()).toBe("error");
    expect(data.get(key)).toBe("original");
  });
  it("el rollback cancela sólo las pendientes de la importación y conserva las previas", async () => {
    const key = "nihon.travellers.v1", draft = "nihon.manualPlanningDraft";
    behaviour.fail = true;
    expect(() => deviceStorage.setItem(key, "prior local")).toThrow();
    const finish = deviceStorage.beginPendingScope([key, draft]);
    expect(() => deviceStorage.setItem(draft, "failed import")).toThrow();
    finish("rollback"); behaviour.fail = false;
    registerPersistenceRetry(key, async () => deviceStorage.setItem(key, "prior reconciled"));
    expect(await retryPersistence()).toBe("ok");
    expect(data.get(key)).toBe("prior reconciled"); expect(data.has(draft)).toBe(false);
  });
  it("una escritura posterior con éxito sobre la misma clave también recupera el estado", () => {
    behaviour.fail = true;
    expect(() => deviceStorage.setItem("nihon.travellers.v1", "old")).toThrow();
    behaviour.fail = false; deviceStorage.setItem("nihon.travellers.v1", "new");
    expect(getPersistenceState()).toBe("ok");
  });
});

describe("DDR-03 — una sola fuente de verdad", () => {
  it("los cinco escritores persistentes comparten el adaptador, y nadie más toca localStorage", async () => {
    const { readFile } = await import("node:fs/promises");
    const writers = [
      "../useTravellers.ts",
      "../usePlanningDraft.ts",
      "../useZonePlanChoice.ts",
      "../usePortableBackup.ts",
      "../useZoneComparison.ts",
    ];
    for (const writer of writers) {
      const code = await readFile(new URL(writer, import.meta.url), "utf8");
      const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(withoutComments, writer).toContain(writer.endsWith("useZonePlanChoice.ts") ? "usePlanningDraft(savedIds)" : "deviceStorage");
      expect(withoutComments, writer).not.toMatch(/localStorage\.(setItem|removeItem)/);
    }
  });

  it("`lib/onboarding.ts` queda fuera a propósito: es preferencia de interfaz, no datos del viaje", async () => {
    const { readFile } = await import("node:fs/promises");
    const code = await readFile(new URL("./onboarding.ts", import.meta.url), "utf8");
    // Avisar de pérdida de datos antes de que exista un dato que perder sería un falso positivo.
    expect(code).toMatch(/localStorage\.setItem/);
    expect(code).not.toContain("deviceStorage");
  });
});
