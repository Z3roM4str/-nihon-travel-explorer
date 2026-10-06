import { beforeEach, describe, expect, it } from "vitest";
import {
  CANONICAL_KEYS,
  RECOVERED_KEY_PREFIX,
  collectOriginals,
  copyOriginals,
  getProtectionSnapshot,
  isKeyProtected,
  notifyStorageReplaced,
  readStoredDraft,
  readStoredTravellers,
  refreshProtection,
  setProtection,
  startFresh,
  subscribeStorageReplaced,
  type StorageLike,
} from "./stored-document";
import { TRAVELLERS_STORAGE_KEY, freshTravellersDocument } from "./travellers";
import { PLANNING_DRAFT_STORAGE_KEY, freshDraft } from "./planning-draft-v8";

/**
 * Auditoría final (H04) — la clasificación de lo que hay en el almacenamiento y la salida explícita.
 *
 * Son las reglas puras bajo `useStoredDocument` y `StorageProtectionNotice`: ausente / válido /
 * inválido / versión futura, y el orden «copiar primero, retirar después» de «Empezar de nuevo».
 */

function memoryStorage(initial: Record<string, string> = {}, failOn: (key: string) => boolean = () => false) {
  const data = new Map(Object.entries(initial));
  const storage: StorageLike & { data: Map<string, string> } = {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (failOn(key)) throw new DOMException("quota", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return storage;
}

const ids = () => "trv-test";
const validTravellers = () => JSON.stringify(freshTravellersDocument(ids));
const validDraft = () => JSON.stringify(freshDraft([]));

beforeEach(() => {
  setProtection(TRAVELLERS_STORAGE_KEY, "absent");
  setProtection(PLANNING_DRAFT_STORAGE_KEY, "absent");
});

describe("readStoredTravellers", () => {
  it("distingue ausente, válido, inválido y versión futura", () => {
    expect(readStoredTravellers(memoryStorage(), ids).status).toBe("absent");
    expect(readStoredTravellers(memoryStorage({ [TRAVELLERS_STORAGE_KEY]: validTravellers() }), ids).status).toBe("valid");
    expect(readStoredTravellers(memoryStorage({ [TRAVELLERS_STORAGE_KEY]: "{no json" }), ids).status).toBe("invalid");
    const damaged = { ...JSON.parse(validTravellers()), activeTravellerId: "missing-traveller" };
    expect(readStoredTravellers(memoryStorage({ [TRAVELLERS_STORAGE_KEY]: JSON.stringify(damaged) }), ids).status).toBe("invalid");
    const future = { ...JSON.parse(validTravellers()), version: 2 };
    expect(readStoredTravellers(memoryStorage({ [TRAVELLERS_STORAGE_KEY]: JSON.stringify(future) }), ids).status).toBe("incompatible");
  });

  it("no considera futuro un 0, un negativo, un decimal ni una cadena: es inválido", () => {
    for (const version of [0, -1, 1.5, "2", null]) {
      const doc = { ...JSON.parse(validTravellers()), version };
      expect(readStoredTravellers(memoryStorage({ [TRAVELLERS_STORAGE_KEY]: JSON.stringify(doc) }), ids).status).toBe("invalid");
    }
  });

  it("devuelve la cadena original tal cual, también cuando es inválida", () => {
    const raw = "  {not json  ";
    const read = readStoredTravellers(memoryStorage({ [TRAVELLERS_STORAGE_KEY]: raw }), ids);
    expect(read.raw).toBe(raw);
    expect(read.doc).toBeNull();
  });

  it("migra el legado sólo cuando no hay documento, y lo trata como ausente (se escribirá)", () => {
    const legacy = memoryStorage({ "nihon.savedPlaceIds": JSON.stringify(["JP-044"]) });
    const read = readStoredTravellers(legacy, ids);
    expect(read.status).toBe("absent");
    expect(read.doc?.interests.map((entry) => entry.placeId)).toEqual(["JP-044"]);
    // Con un documento inválido, el legado NO lo sustituye: el original manda y se protege.
    const both = memoryStorage({ [TRAVELLERS_STORAGE_KEY]: "{broken", "nihon.savedPlaceIds": JSON.stringify(["JP-044"]) });
    expect(readStoredTravellers(both, ids).status).toBe("invalid");
  });

  it("un almacenamiento ilegible se lee como ausente", () => {
    const broken: StorageLike = { getItem: () => { throw new Error("blocked"); }, setItem: () => {}, removeItem: () => {} };
    expect(readStoredTravellers(broken, ids).status).toBe("absent");
    expect(readStoredDraft(broken).status).toBe("absent");
  });
});

describe("readStoredDraft", () => {
  it("distingue ausente, válido (incluida una V1 migrable), inválido y versión futura", () => {
    expect(readStoredDraft(memoryStorage()).status).toBe("absent");
    expect(readStoredDraft(memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: validDraft() })).status).toBe("valid");
    const v1 = readStoredDraft(memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify({ version: 1, routeIds: ["JP-044"], days: [["JP-044"]] }) }));
    expect(v1.status).toBe("valid");
    expect(v1.doc?.version).toBe(8);
    expect(v1.doc?.routeIds).toEqual(["JP-044"]);
    expect(readStoredDraft(memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: "{no json" })).status).toBe("invalid");
    const damaged = { ...JSON.parse(validDraft()), interHubSegments: "damaged" };
    expect(readStoredDraft(memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(damaged) })).status).toBe("invalid");
    const future = { ...JSON.parse(validDraft()), version: 9 };
    expect(readStoredDraft(memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(future) })).status).toBe("incompatible");
  });
});

describe("protección publicada", () => {
  it("refreshProtection publica sólo lo inválido o futuro, y lo retira al volver a ser válido", () => {
    const storage = memoryStorage({ [TRAVELLERS_STORAGE_KEY]: validTravellers(), [PLANNING_DRAFT_STORAGE_KEY]: "{broken" });
    refreshProtection(storage);
    expect(isKeyProtected(PLANNING_DRAFT_STORAGE_KEY)).toBe(true);
    expect(isKeyProtected(TRAVELLERS_STORAGE_KEY)).toBe(false);
    expect(getProtectionSnapshot().map((entry) => entry.status)).toEqual(["invalid"]);
    storage.setItem(PLANNING_DRAFT_STORAGE_KEY, validDraft());
    refreshProtection(storage);
    expect(getProtectionSnapshot()).toHaveLength(0);
  });

  it("la instantánea mantiene su identidad mientras no cambia nada (useSyncExternalStore)", () => {
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: "{broken" });
    refreshProtection(storage);
    const first = getProtectionSnapshot();
    refreshProtection(storage);
    expect(getProtectionSnapshot()).toBe(first);
  });

  it("notifyStorageReplaced avisa a los suscriptores de esta pestaña", () => {
    let calls = 0;
    const unsubscribe = subscribeStorageReplaced(() => { calls += 1; });
    notifyStorageReplaced();
    unsubscribe();
    notifyStorageReplaced();
    expect(calls).toBe(1);
  });
});

describe("copia y «empezar de nuevo»", () => {
  const stamp = "2026-10-06T00-00-00-000Z";

  it("copia TODO lo que hay, con el contenido exacto, antes de retirar los documentos protegidos", () => {
    const draftRaw = JSON.stringify({ ...JSON.parse(validDraft()), version: 9 });
    const travellersRaw = validTravellers();
    const storage = memoryStorage({ [TRAVELLERS_STORAGE_KEY]: travellersRaw, [PLANNING_DRAFT_STORAGE_KEY]: draftRaw });
    const outcome = startFresh(storage, [PLANNING_DRAFT_STORAGE_KEY], stamp);
    expect(outcome.ok).toBe(true);
    expect(storage.getItem(`${RECOVERED_KEY_PREFIX}${stamp}.${PLANNING_DRAFT_STORAGE_KEY}`)).toBe(draftRaw);
    expect(storage.getItem(`${RECOVERED_KEY_PREFIX}${stamp}.${TRAVELLERS_STORAGE_KEY}`)).toBe(travellersRaw);
    expect(storage.getItem(PLANNING_DRAFT_STORAGE_KEY)).toBeNull();
    // Sólo se retira lo protegido: el otro documento sigue donde estaba.
    expect(storage.getItem(TRAVELLERS_STORAGE_KEY)).toBe(travellersRaw);
  });

  it("si la copia no se puede escribir, NO se retira nada", () => {
    const draftRaw = "{broken";
    const storage = memoryStorage(
      { [TRAVELLERS_STORAGE_KEY]: validTravellers(), [PLANNING_DRAFT_STORAGE_KEY]: draftRaw },
      (key) => key.startsWith(RECOVERED_KEY_PREFIX)
    );
    const outcome = startFresh(storage, [PLANNING_DRAFT_STORAGE_KEY], stamp);
    expect(outcome).toEqual({ ok: false, reason: "copy-failed" });
    expect(storage.getItem(PLANNING_DRAFT_STORAGE_KEY)).toBe(draftRaw);
  });

  it("si la retirada falla tras copiar, informa y deja las copias", () => {
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: "{broken" });
    storage.removeItem = () => { throw new Error("blocked"); };
    expect(startFresh(storage, [PLANNING_DRAFT_STORAGE_KEY], stamp)).toEqual({ ok: false, reason: "remove-failed" });
    expect(storage.getItem(PLANNING_DRAFT_STORAGE_KEY)).toBe("{broken");
    expect(storage.getItem(`${RECOVERED_KEY_PREFIX}${stamp}.${PLANNING_DRAFT_STORAGE_KEY}`)).toBe("{broken");
  });

  it("una copia que no se relee igual se trata como fallida", () => {
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: "{broken" });
    storage.setItem = (key, value) => { storage.data.set(key, `${value} `); };
    expect(copyOriginals(storage, stamp)).toEqual({ ok: false });
  });

  it("collectOriginals sólo recoge claves canónicas existentes", () => {
    const storage = memoryStorage({ [PLANNING_DRAFT_STORAGE_KEY]: "x", other: "y" });
    expect(Object.keys(collectOriginals(storage))).toEqual([PLANNING_DRAFT_STORAGE_KEY]);
    expect(CANONICAL_KEYS).toHaveLength(2);
  });
});
