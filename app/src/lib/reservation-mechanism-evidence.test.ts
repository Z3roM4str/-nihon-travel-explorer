import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import rawData from "../data/reservation-mechanisms.json";
import {
  parseReservationMechanismEvidenceRecord,
  parseReservationMechanismEvidenceRecords,
  reservationMechanismEvidenceForPlace,
  reservationMechanismEvidenceRecords,
  type ReservationMechanismEvidenceRecord,
} from "./reservation-mechanism-evidence";

describe("reservation-mechanism-evidence — bundled pilot", () => {
  it("parses all five Phase 3F-B pilot records", () => {
    expect(reservationMechanismEvidenceRecords).toHaveLength(5);
    expect(reservationMechanismEvidenceRecords.map((record) => record.placeId)).toEqual([
      "JP-044",
      "JP-203",
      "JP-204",
      "JP-077",
      "JP-212",
    ]);
  });

  it("parses the raw app JSON to the same records", () => {
    expect(parseReservationMechanismEvidenceRecords(rawData as unknown)).toEqual(reservationMechanismEvidenceRecords);
  });

  it("keeps USJ, Nintendo Museum and AnimeJapan absent", () => {
    const ids = new Set(reservationMechanismEvidenceRecords.map((record) => record.placeId));
    for (const absent of ["JP-125", "JP-097", "JP-211"]) expect(ids.has(absent)).toBe(false);
  });

  it("preserves source-data order for one place without sorting", () => {
    const a = reservationMechanismEvidenceRecords[0]!;
    const synthetic: ReservationMechanismEvidenceRecord = { ...a, id: "RM-JP-044-002", scope: "workshop" };
    expect(reservationMechanismEvidenceForPlace([synthetic, a], "JP-044").map((record) => record.id)).toEqual([
      "RM-JP-044-002",
      "RM-JP-044-001",
    ]);
  });
});

describe("reservation-mechanism-evidence — defensive parsing", () => {
  const valid = reservationMechanismEvidenceRecords[0]!;

  it("rejects non-object and malformed record IDs", () => {
    expect(parseReservationMechanismEvidenceRecord(null)).toBeNull();
    expect(parseReservationMechanismEvidenceRecord({ ...valid, id: "reservation-1" })).toBeNull();
  });

  it("rejects an ID namespace that disagrees with placeId", () => {
    expect(parseReservationMechanismEvidenceRecord({ ...valid, placeId: "JP-203" })).toBeNull();
  });

  it("rejects unsupported scope, allocation and status", () => {
    expect(parseReservationMechanismEvidenceRecord({ ...valid, scope: "restaurant" })).toBeNull();
    expect(parseReservationMechanismEvidenceRecord({ ...valid, allocation: "probably-first-come" })).toBeNull();
    expect(parseReservationMechanismEvidenceRecord({ ...valid, status: "current" })).toBeNull();
  });

  it("rejects unsupported mechanism kinds and malformed mechanism fields", () => {
    expect(parseReservationMechanismEvidenceRecord({ ...valid, mechanism: { kind: "magic" } })).toBeNull();
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        mechanism: { ...valid.mechanism, releaseTimeLocal: "25:00" },
      })
    ).toBeNull();
  });

  it("rejects malformed provenance", () => {
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        provenance: { ...valid.provenance, sourceUrl: "http://example.test" },
      })
    ).toBeNull();
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        provenance: { ...valid.provenance, consultedAt: "2026-02-30" },
      })
    ).toBeNull();
  });

  it("rejects duplicate global IDs at catalog level", () => {
    expect(parseReservationMechanismEvidenceRecords([valid, valid])).toBeNull();
  });

  it("accepts a superseded validated record without treating it as active", () => {
    const parsed = parseReservationMechanismEvidenceRecord({ ...valid, status: "superseded" });
    expect(parsed?.status).toBe("superseded");
  });
});

describe("reservation-mechanism-evidence — source boundaries", () => {
  it("contains no Place reservation-lead-time parser or clock dependency", async () => {
    const source = await readFile(new URL("./reservation-mechanism-evidence.ts", import.meta.url), "utf8");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of ["reservation.leadTime", "Date.now", "localStorage", "fetch(", "XMLHttpRequest"]) {
      expect(codeOnly, forbidden).not.toContain(forbidden);
    }
  });
});
