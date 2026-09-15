import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import rawData from "../data/reservation-mechanisms.json";
import {
  parseReservationMechanismEvidenceRecord,
  parseReservationMechanismEvidenceRecords,
  reservationMechanismEvidenceForPlace,
  reservationMechanismEvidenceRecords,
  type ReservationMechanismEvidenceRecord,
  type ReservationPurchaseResidenceContext,
} from "./reservation-mechanism-evidence";

const DATE_DERIVATION_SOURCE = new URL("./reservation-mechanism-date-derivation.ts", import.meta.url);
const REFERENCE_DATE_SOURCE = new URL("./reservation-mechanism-reference-date.ts", import.meta.url);
const CALENDAR_SOURCE = new URL("./reservation-mechanism-calendar.ts", import.meta.url);

describe("reservation-mechanism-evidence — bundled pilot", () => {
  it("parses the five Phase 3F-B pilot records plus Nintendo and both PokéPark routes", () => {
    expect(reservationMechanismEvidenceRecords).toHaveLength(8);
    expect(reservationMechanismEvidenceRecords.map((record) => record.placeId)).toEqual([
      "JP-044",
      "JP-203",
      "JP-204",
      "JP-077",
      "JP-212",
      "JP-097",
      "JP-050",
      "JP-050",
    ]);
    expect(new Set(reservationMechanismEvidenceRecords.map((record) => record.id)).size).toBe(8);
  });

  it("parses the raw app JSON to the same records", () => {
    expect(parseReservationMechanismEvidenceRecords(rawData as unknown)).toEqual(reservationMechanismEvidenceRecords);
  });

  it("adds only the Phase 3F-N PokéPark overseas place among the prior exclusions", () => {
    const ids = new Set(reservationMechanismEvidenceRecords.map((record) => record.placeId));
    for (const absent of ["JP-002", "JP-125", "JP-126", "JP-211"]) {
      expect(ids.has(absent)).toBe(false);
    }
    expect(ids.has("JP-050")).toBe(true);
    expect(ids.has("JP-097")).toBe(true);
  });

  it("carries both PokéPark purchase routes as separate same-scope records", () => {
    const records = reservationMechanismEvidenceForPlace(reservationMechanismEvidenceRecords, "JP-050");
    expect(records).toHaveLength(2);
    expect(records.map((item) => item.id)).toEqual(["RM-JP-050-001", "RM-JP-050-002"]);
    // Same place, same scope, both active: the Phase 3F-S cardinality change is exactly this.
    expect(new Set(records.map((item) => `${item.placeId}:${item.scope}:${item.status}`)).size).toBe(1);
    expect(records[0]).toMatchObject({
      id: "RM-JP-050-001",
      placeId: "JP-050",
      scope: "general-admission",
      purchaseResidenceContext: "resides-outside-japan",
      allocation: "drawing",
      status: "active",
      mechanism: {
        kind: "monthly-application-window",
        monthsBeforeVisitMonth: 3,
        openDay: { kind: "fixed-day-of-month", day: 1 },
        closeDay: { kind: "fixed-day-of-month", day: 12 },
        openTimeLocal: "20:00",
        openSourceTimeZone: "Asia/Tokyo",
        closeTimeLocal: null,
        closeSourceTimeZone: null,
      },
      provenance: {
        sourceUrl: "https://ticket-en.pokepark-kanto.co.jp/?viewLang=en",
        consultedAt: "2026-09-14",
        confidence: "official-explicit",
      },
    });
    expect(records[0].provenance.sourceEntity).toContain("outside-Japan");
    expect(records[0].provenance.evidence).toContain("outside Japan");
    expect(records[0].provenance.evidence).toContain(
      "https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US"
    );
    expect(records[0].provenance.evidence).not.toContain("two months");

    expect(records[1]).toMatchObject({
      id: "RM-JP-050-002",
      placeId: "JP-050",
      scope: "general-admission",
      purchaseResidenceContext: "resides-in-japan",
      allocation: "drawing",
      status: "active",
      mechanism: {
        kind: "monthly-application-window",
        monthsBeforeVisitMonth: 3,
        openDay: { kind: "fixed-day-of-month", day: 1 },
        closeDay: { kind: "fixed-day-of-month", day: 12 },
        openTimeLocal: "20:00",
        openSourceTimeZone: "Asia/Tokyo",
        closeTimeLocal: null,
        closeSourceTimeZone: null,
      },
      provenance: {
        sourceUrl: "https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index",
        consultedAt: "2026-09-15",
        confidence: "official-explicit",
      },
    });
    // The Japan-resident assignment rests on a published routing statement, not on the page's
    // language, locale, domain or source entity.
    expect(records[1].provenance.evidence).toContain("residents of Japan");
    expect(records[1].provenance.evidence).toContain("residing outside Japan");
    expect(records[1].provenance.evidence).toContain(
      "not inferred from page language, locale, domain or source entity"
    );
    expect(records[1].provenance.evidence).toContain(
      "https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index"
    );
    // Phase 3F-S encodes the domestic drawing only; the first-come route stays deferred.
    expect(JSON.stringify(records[1].mechanism)).not.toContain("first-come");
    expect(JSON.stringify(records[1].mechanism)).not.toContain("last-day-of-shifted-month");
  });

  it("keeps six records unasserted and gives each PokéPark route its own specific context", () => {
    expect(
      reservationMechanismEvidenceRecords.map((record) => record.purchaseResidenceContext)
    ).toEqual([
      "not-recorded",
      "not-recorded",
      "not-recorded",
      "not-recorded",
      "not-recorded",
      "not-recorded",
      "resides-outside-japan",
      "resides-in-japan",
    ]);
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

describe("Phase 3F-S — active same-scope collision guard", () => {
  const base = reservationMechanismEvidenceRecords[0]!;

  /** A JP-044 general-admission record differing only in id and residence context. */
  function sameScope(id: string, purchaseResidenceContext: ReservationPurchaseResidenceContext) {
    return { ...base, id, purchaseResidenceContext };
  }

  it("accepts an active collision group whose members all state a specific context", () => {
    const parsed = parseReservationMechanismEvidenceRecords([
      sameScope("RM-JP-044-001", "resides-outside-japan"),
      sameScope("RM-JP-044-002", "resides-in-japan"),
    ]);
    expect(parsed?.map((record) => record.id)).toEqual(["RM-JP-044-001", "RM-JP-044-002"]);
  });

  it("accepts two active same-scope records sharing one specific context", () => {
    // Residence context is applicability evidence, not identity: two domestic routes may both be
    // `resides-in-japan` and still be distinct evidence propositions.
    expect(
      parseReservationMechanismEvidenceRecords([
        sameScope("RM-JP-044-001", "resides-in-japan"),
        sameScope("RM-JP-044-002", "resides-in-japan"),
      ])
    ).toHaveLength(2);
  });

  it("introduces no placeId + scope + context uniqueness rule", () => {
    expect(
      parseReservationMechanismEvidenceRecords([
        sameScope("RM-JP-044-001", "resides-in-japan"),
        sameScope("RM-JP-044-002", "resides-in-japan"),
        sameScope("RM-JP-044-003", "resides-in-japan"),
      ])
    ).toHaveLength(3);
  });

  it("rejects an active collision group containing one not-recorded member", () => {
    expect(
      parseReservationMechanismEvidenceRecords([
        sameScope("RM-JP-044-001", "resides-in-japan"),
        sameScope("RM-JP-044-002", "not-recorded"),
      ])
    ).toBeNull();
  });

  it("rejects the not-recorded member even when it is read first", () => {
    // The group is judged after the whole catalog is read: a record accepted as solitary becomes a
    // collision member retroactively once a second active same-scope record appears.
    expect(
      parseReservationMechanismEvidenceRecords([
        sameScope("RM-JP-044-001", "not-recorded"),
        sameScope("RM-JP-044-002", "resides-in-japan"),
      ])
    ).toBeNull();
  });

  it("rejects an active collision group of only not-recorded members", () => {
    expect(
      parseReservationMechanismEvidenceRecords([
        sameScope("RM-JP-044-001", "not-recorded"),
        sameScope("RM-JP-044-002", "not-recorded"),
      ])
    ).toBeNull();
  });

  it("keeps a solitary active not-recorded record valid", () => {
    expect(parseReservationMechanismEvidenceRecords([sameScope("RM-JP-044-001", "not-recorded")])).toHaveLength(1);
  });

  it("does not let a superseded record trigger the collision guard", () => {
    const parsed = parseReservationMechanismEvidenceRecords([
      sameScope("RM-JP-044-001", "not-recorded"),
      { ...sameScope("RM-JP-044-002", "not-recorded"), status: "superseded" as const },
    ]);
    expect(parsed).toHaveLength(2);
  });

  it("does not let two superseded same-scope records collide", () => {
    expect(
      parseReservationMechanismEvidenceRecords([
        { ...sameScope("RM-JP-044-001", "not-recorded"), status: "superseded" as const },
        { ...sameScope("RM-JP-044-002", "not-recorded"), status: "superseded" as const },
      ])
    ).toHaveLength(2);
  });

  it("still separates records that differ by scope", () => {
    expect(
      parseReservationMechanismEvidenceRecords([
        sameScope("RM-JP-044-001", "not-recorded"),
        { ...sameScope("RM-JP-044-002", "not-recorded"), scope: "workshop" as const },
      ])
    ).toHaveLength(2);
  });

  it("still separates records that differ by placeId", () => {
    expect(
      parseReservationMechanismEvidenceRecords([
        sameScope("RM-JP-044-001", "not-recorded"),
        { ...sameScope("RM-JP-212-001", "not-recorded"), placeId: "JP-212" },
      ])
    ).toHaveLength(2);
  });

  it("keeps global record-id uniqueness mandatory under the relaxed cardinality", () => {
    expect(
      parseReservationMechanismEvidenceRecords([
        sameScope("RM-JP-044-001", "resides-in-japan"),
        sameScope("RM-JP-044-001", "resides-outside-japan"),
      ])
    ).toBeNull();
  });

  it("keeps id-namespace matching mandatory under the relaxed cardinality", () => {
    expect(
      parseReservationMechanismEvidenceRecords([
        sameScope("RM-JP-044-001", "resides-in-japan"),
        sameScope("RM-JP-212-002", "resides-outside-japan"),
      ])
    ).toBeNull();
  });

  it("promotes no field other than id into record identity", async () => {
    const source = await readFile(new URL("./reservation-mechanism-evidence.ts", import.meta.url), "utf8");
    for (const forbidden of ["channel", "pathway", "acquisitionChannel", "mechanismRole"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe("Phase 3F-P — residence-context ownership boundaries", () => {
  it("keeps date derivation, temporal relation and route calendar logic context-blind", async () => {
    for (const sourceUrl of [DATE_DERIVATION_SOURCE, REFERENCE_DATE_SOURCE, CALENDAR_SOURCE]) {
      const source = await readFile(sourceUrl, "utf8");
      expect(source).not.toContain("purchaseResidenceContext");
      expect(source).not.toContain("resides-in-japan");
      expect(source).not.toContain("resides-outside-japan");
    }
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

  it("requires the closed purchaseResidenceContext field without defaulting", () => {
    const missing: Record<string, unknown> = { ...valid };
    delete missing.purchaseResidenceContext;
    expect(parseReservationMechanismEvidenceRecord(missing)).toBeNull();
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        purchaseResidenceContext: "worldwide",
      })
    ).toBeNull();
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        purchaseResidenceContext: "resides-in-japan",
      })
    ).not.toBeNull();
    expect(
      parseReservationMechanismEvidenceRecord({
        ...valid,
        purchaseResidenceContext: "resides-outside-japan",
      })
    ).not.toBeNull();
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
