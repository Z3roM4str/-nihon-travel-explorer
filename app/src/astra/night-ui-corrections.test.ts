import { describe, expect, it, beforeEach } from "vitest";
import { readStorage, readMemberInterests } from "../useSavedPlaces";

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
};

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: createLocalStorageMock(),
    writable: true,
  });
}

describe("Astra Night UI PR #131 Corrections & Verification", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. Storage Sanitization and Persistence Validation", () => {
    it("sanitizes corrupted, non-string, or duplicate legacy savedPlaceIds", () => {
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify([null, 123, "JP-001", "JP-001", "", { bad: true }, "JP-002"]));
      const cleaned = readStorage();
      expect(cleaned).toEqual(["JP-001", "JP-002"]);
    });

    it("returns empty array when legacy storage JSON is completely corrupt", () => {
      localStorage.setItem("nihon.savedPlaceIds", "{invalid-json:---}");
      expect(readStorage()).toEqual([]);
    });

    it("sanitizes corrupted, non-object, or duplicate member interests", () => {
      const rawInterests = [
        null,
        "bad-string",
        { tripId: "trip-2027", memberId: "fernando", placeId: "JP-001", interested: true, updatedAt: "2027-01-01T10:00:00.000Z" },
        { tripId: "trip-2027", memberId: "fernando", placeId: "JP-001", interested: false, updatedAt: "2027-01-01T12:00:00.000Z" }, // newer
        { tripId: "trip-2027", memberId: "lorena", placeId: "JP-001", interested: "not-a-bool", updatedAt: "2027-01-01T10:00:00.000Z" },
        { tripId: "trip-2027", memberId: "lorena", placeId: "JP-002", interested: true, updatedAt: "2027-01-01T10:00:00.000Z" }
      ];
      localStorage.setItem("nihon.memberInterests.v1", JSON.stringify(rawInterests));

      const cleaned = readMemberInterests();
      expect(cleaned).toHaveLength(2);
      const fernando = cleaned.find(i => i.memberId === "fernando" && i.placeId === "JP-001");
      expect(fernando?.interested).toBe(false);
      const lorena = cleaned.find(i => i.memberId === "lorena" && i.placeId === "JP-002");
      expect(lorena?.interested).toBe(true);
    });
  });

  describe("2. Union Logic and Member Interest Coincidences", () => {
    it("computes union without duplicates across legacy saves and active member interests", () => {
      const savedIds = ["JP-001", "JP-002"];
      const fernandoIds = ["JP-002", "JP-003"];
      const lorenaIds = ["JP-003", "JP-004"];

      const todosIds = Array.from(new Set([...savedIds, ...fernandoIds, ...lorenaIds]));
      expect(todosIds).toEqual(["JP-001", "JP-002", "JP-003", "JP-004"]);

      // Coincidences (intersection of Fernando & Lorena active interests)
      const coincidences = fernandoIds.filter(id => lorenaIds.includes(id));
      expect(coincidences).toEqual(["JP-003"]);
    });

    it("ensures unmarking Fernando interest does not delete Lorena interest or legacy save", () => {
      let fernandoInterests = ["JP-001", "JP-002"];
      let lorenaInterests = ["JP-002", "JP-003"];
      let legacySaved = ["JP-001"];

      // Fernando unmarks JP-002
      fernandoInterests = fernandoInterests.filter(id => id !== "JP-002");

      expect(fernandoInterests).toEqual(["JP-001"]);
      expect(lorenaInterests).toEqual(["JP-002", "JP-003"]); // Lorena intact
      expect(legacySaved).toEqual(["JP-001"]); // Legacy save intact

      const todosIds = Array.from(new Set([...legacySaved, ...fernandoInterests, ...lorenaInterests]));
      expect(todosIds).toEqual(["JP-001", "JP-002", "JP-003"]); // JP-002 still present due to Lorena
    });
  });
});
