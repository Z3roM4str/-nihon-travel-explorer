import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deviceStorage,
  getPersistenceState,
  resetPersistenceForTests,
  retryPersistence,
  subscribePersistence,
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
  resetPersistenceForTests();
  behaviour = { fail: false };
  data = installStorage(behaviour);
});

afterEach(() => {
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

  it("leer nunca enciende el aviso: no había nada que perder", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    expect(deviceStorage.getItem("nihon.travellers.v1")).toBeNull();
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

describe("DDR-03 — «Reintentar» escribe de verdad", () => {
  it("si vuelve a fallar, el estado de error PERMANECE", () => {
    behaviour.fail = true;
    try {
      deviceStorage.setItem("nihon.travellers.v1", '{"a":1}');
    } catch {
      /* esperado */
    }
    expect(retryPersistence()).toBe("error");
    expect(getPersistenceState()).toBe("error");
  });

  it("si tiene éxito, vuelve el estado normal Y persiste la carga exacta que había fallado", () => {
    behaviour.fail = true;
    const payload = '{"travellers":[{"id":"trv-1"}]}';
    try {
      deviceStorage.setItem("nihon.travellers.v1", payload);
    } catch {
      /* esperado */
    }
    expect(getPersistenceState()).toBe("error");

    behaviour.fail = false;
    expect(retryPersistence()).toBe("ok");
    expect(getPersistenceState()).toBe("ok");
    // Lo que se escribe son los datos de la persona, tal cual se intentaron guardar.
    expect(data.get("nihon.travellers.v1")).toBe(payload);
  });

  it("reintenta TODAS las claves pendientes, no sólo la última", () => {
    behaviour.fail = true;
    for (const [key, value] of [
      ["nihon.travellers.v1", '{"t":1}'],
      ["nihon.manualPlanningDraft", '{"d":1}'],
    ] as const) {
      try {
        deviceStorage.setItem(key, value);
      } catch {
        /* esperado */
      }
    }
    behaviour.fail = false;
    expect(retryPersistence()).toBe("ok");
    expect(data.get("nihon.travellers.v1")).toBe('{"t":1}');
    expect(data.get("nihon.manualPlanningDraft")).toBe('{"d":1}');
  });

  it("nunca descarta ni reinicia datos: sólo reescribe lo que no se pudo guardar", () => {
    deviceStorage.setItem("nihon.manualPlanningDraft", '{"ya":"estaba"}');
    behaviour.fail = true;
    try {
      deviceStorage.setItem("nihon.travellers.v1", '{"nuevo":1}');
    } catch {
      /* esperado */
    }
    behaviour.fail = false;
    retryPersistence();
    // Lo que ya estaba en disco sigue ahí, sin tocar.
    expect(data.get("nihon.manualPlanningDraft")).toBe('{"ya":"estaba"}');
    expect(data.get("nihon.travellers.v1")).toBe('{"nuevo":1}');
  });

  it("una escritura posterior con éxito sobre la misma clave también recupera el estado", () => {
    behaviour.fail = true;
    try {
      deviceStorage.setItem("nihon.travellers.v1", '{"viejo":1}');
    } catch {
      /* esperado */
    }
    expect(getPersistenceState()).toBe("error");
    behaviour.fail = false;
    // Ese estado ya llegó al disco por la vía normal: no queda nada pendiente que recuperar.
    deviceStorage.setItem("nihon.travellers.v1", '{"nuevo":1}');
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
      expect(withoutComments, writer).toContain("deviceStorage");
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
