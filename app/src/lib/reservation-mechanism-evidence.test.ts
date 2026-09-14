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
  it("parses the five Phase 3F-B pilot records plus the Phase 3F-L Nintendo record", () => {
    expect(reservationMechanismEvidenceRecords).toHaveLength(6);
    expect(reservationMechanismEvidenceRecords.map((record) => record.placeId)).toEqual([
      "JP-044",
      "JP-203",
      "JP-204",
      "JP-077",
      "JP-212",
      "JP-097",
    ]);
  });

  it("parses the raw app JSON to the same records", () => {
    expect(parseReservationMechanismEvidenceRecords(rawData as unknown)).toEqual(reservationMechanismEvidenceRecords);
  });

  it("keeps the Phase 3F-K explicit exclusions absent", () => {
    const ids = new Set(reservationMechanismEvidenceRecords.map((record) => record.placeId));
    for (const absent of ["JP-002", "JP-050", "JP-125", "JP-126", "JP-211"]) {
      expect(ids.has(absent)).toBe(false);
    }
    expect(ids.has("JP-097")).toBe(true);
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

  it("rejects duplicate active placeId + scope identities", () => {
    const second = {
      ...valid,
      id: "RM-JP-044-002",
      mechanism: {
        kind: "rolling-day-release",
        daysBeforeVisit: 7,
        releaseTimeLocal: null,
        sourceTimeZone: null,
      },
    };
    expect(parseReservationMechanismEvidenceRecords([valid, second])).toBeNull();
  });

  it("allows distinct active scopes for the same place", () => {
    const second = {
      ...valid,
      id: "RM-JP-044-002",
      scope: "workshop",
      mechanism: {
        kind: "rolling-day-release",
        daysBeforeVisit: 7,
        releaseTimeLocal: null,
        sourceTimeZone: null,
      },
    };
    expect(parseReservationMechanismEvidenceRecords([valid, second])).not.toBeNull();
  });

  it("rejects unsupported extra fields instead of silently widening the runtime schema", () => {
    expect(parseReservationMechanismEvidenceRecord({ ...valid, urgency: "book-now" })).toBeNull();
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        mechanism: { ...valid.mechanism, availability: "open" },
      })
    ).toBeNull();
  });

  it("accepts the approved monthly-application-window family", () => {
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        id: "RM-JP-044-002",
        mechanism: {
          kind: "monthly-application-window",
          monthsBeforeVisitMonth: 3,
          openDay: { kind: "fixed-day-of-month", day: 1 },
          closeDay: { kind: "last-day-of-month" },
          openTimeLocal: null,
          openSourceTimeZone: null,
          closeTimeLocal: null,
          closeSourceTimeZone: null,
        },
      })
    ).not.toBeNull();
  });

  it("rejects statically inverted monthly fixed-day windows", () => {
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        id: "RM-JP-044-002",
        mechanism: {
          kind: "monthly-application-window",
          monthsBeforeVisitMonth: 3,
          openDay: { kind: "fixed-day-of-month", day: 20 },
          closeDay: { kind: "fixed-day-of-month", day: 12 },
          openTimeLocal: null,
          openSourceTimeZone: null,
          closeTimeLocal: null,
          closeSourceTimeZone: null,
        },
      })
    ).toBeNull();
  });

  it("accepts the approved rolling-day-release family in a synthetic record", () => {
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        id: "RM-JP-044-002",
        mechanism: {
          kind: "rolling-day-release",
          daysBeforeVisit: 30,
          releaseTimeLocal: null,
          sourceTimeZone: null,
        },
      })
    ).not.toBeNull();
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
