import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { dayAssignmentFromLookup } from "./day-assignment";
import {
  reservationMechanismEvidenceRecords,
  type ReservationMechanismEvidenceRecord,
} from "./reservation-mechanism-evidence";
import {
  deriveReservationMechanismDate,
  deriveReservationMechanismDatesForPlace,
  deriveReservationMechanismDatesForPlannedPlace,
} from "./reservation-mechanism-date-derivation";

function record(placeId: string): ReservationMechanismEvidenceRecord {
  const found = reservationMechanismEvidenceRecords.find((item) => item.placeId === placeId);
  if (!found) throw new Error(`missing fixture ${placeId}`);
  return found;
}

const ghibli = record("JP-044");
const disneyland = record("JP-203");
const disneySea = record("JP-204");
const katsura = record("JP-077");
const sumo = record("JP-212");

describe("monthly-fixed-release — Ghibli real fixture", () => {
  it("derives 2027-01-10 10:00 Asia/Tokyo for a 2027-02-20 visit", () => {
    expect(deriveReservationMechanismDate(ghibli, "2027-02-20")).toEqual({
      kind: "release-date",
      recordId: "RM-JP-044-001",
      placeId: "JP-044",
      scope: "general-admission",
      visitDate: "2027-02-20",
      releaseDate: "2027-01-10",
      releaseTimeLocal: "10:00",
      sourceTimeZone: "Asia/Tokyo",
      allocation: "not-stated",
    });
  });

  it("crosses the year boundary without fixed-day approximation", () => {
    const result = deriveReservationMechanismDate(ghibli, "2027-01-05");
    expect(result.kind).toBe("release-date");
    if (result.kind === "release-date") expect(result.releaseDate).toBe("2026-12-10");
  });

  it("refuses an impossible recorded release day rather than clamping", () => {
    const synthetic = {
      ...ghibli,
      mechanism: { ...ghibli.mechanism, releaseDayOfMonth: 31 },
    } as ReservationMechanismEvidenceRecord;
    expect(deriveReservationMechanismDate(synthetic, "2027-05-20")).toMatchObject({
      kind: "not-derivable",
      reason: "invalid-calendar-alignment",
    });
  });
});

describe("rolling-calendar-month-release — Tokyo Disney real fixtures", () => {
  it("derives exactly two calendar months before on the same day", () => {
    expect(deriveReservationMechanismDate(disneyland, "2027-02-20")).toMatchObject({
      kind: "release-date",
      releaseDate: "2026-12-20",
      releaseTimeLocal: "14:00",
      sourceTimeZone: null,
      allocation: "capacity-limited",
    });
  });

  it("uses only the recorded missing-day fallback", () => {
    expect(deriveReservationMechanismDate(disneySea, "2027-04-30")).toMatchObject({
      kind: "release-date",
      releaseDate: "2027-03-01",
      releaseTimeLocal: "14:00",
      sourceTimeZone: null,
    });
  });

  it("does not clamp to February 28", () => {
    const result = deriveReservationMechanismDate(disneySea, "2027-04-30");
    expect(result.kind).toBe("release-date");
    if (result.kind === "release-date") expect(result.releaseDate).not.toBe("2027-02-28");
  });

  it("returns not-derivable when the same alignment is missing and no fallback is recorded", () => {
    const synthetic = {
      ...disneySea,
      id: "RM-JP-204-002",
      mechanism: {
        ...disneySea.mechanism,
        missingAlignedDayRule: "not-recorded",
      },
    } as ReservationMechanismEvidenceRecord;
    expect(deriveReservationMechanismDate(synthetic, "2027-04-30")).toMatchObject({
      kind: "not-derivable",
      reason: "invalid-calendar-alignment",
    });
  });

  it("handles leap February by calendar validity, not fixed day counts", () => {
    const result = deriveReservationMechanismDate(disneyland, "2028-04-29");
    expect(result.kind).toBe("release-date");
    if (result.kind === "release-date") expect(result.releaseDate).toBe("2028-02-29");
  });
});

describe("rolling-day-release — synthetic contract fixture", () => {
  it("subtracts exact civil days", () => {
    const synthetic: ReservationMechanismEvidenceRecord = {
      ...ghibli,
      id: "RM-JP-044-002",
      mechanism: {
        kind: "rolling-day-release",
        daysBeforeVisit: 30,
        releaseTimeLocal: null,
        sourceTimeZone: null,
      },
    };
    expect(deriveReservationMechanismDate(synthetic, "2027-03-15")).toMatchObject({
      kind: "release-date",
      releaseDate: "2027-02-13",
    });
  });

  it("crosses a year boundary through exact day arithmetic", () => {
    const synthetic: ReservationMechanismEvidenceRecord = {
      ...ghibli,
      id: "RM-JP-044-002",
      mechanism: {
        kind: "rolling-day-release",
        daysBeforeVisit: 10,
        releaseTimeLocal: null,
        sourceTimeZone: null,
      },
    };
    expect(deriveReservationMechanismDate(synthetic, "2027-01-05")).toMatchObject({
      kind: "release-date",
      releaseDate: "2026-12-26",
    });
  });
});

describe("relative-application-window — Katsura real fixture", () => {
  it("derives independent open and close edges", () => {
    expect(deriveReservationMechanismDate(katsura, "2027-03-15")).toEqual({
      kind: "application-window",
      recordId: "RM-JP-077-001",
      placeId: "JP-077",
      scope: "guided-visit",
      visitDate: "2027-03-15",
      openDate: "2026-12-01",
      openTimeLocal: "05:00",
      openSourceTimeZone: null,
      closeDate: "2027-03-12",
      closeTimeLocal: "23:59",
      closeSourceTimeZone: null,
      allocation: "lottery-if-oversubscribed",
    });
  });

  it("preserves lottery disclosure without changing dates", () => {
    const result = deriveReservationMechanismDate(katsura, "2027-03-15");
    expect(result.kind).toBe("application-window");
    if (result.kind === "application-window") {
      expect(result.allocation).toBe("lottery-if-oversubscribed");
      expect(result.openDate).toBe("2026-12-01");
      expect(result.closeDate).toBe("2027-03-12");
    }
  });
});

describe("fixed-sale-date — Osaka Sumo real fixture", () => {
  it.each(["2027-03-14", "2027-03-20", "2027-03-28"])(
    "treats event boundary/interior date %s as applicable",
    (visitDate) => {
      expect(deriveReservationMechanismDate(sumo, visitDate)).toMatchObject({
        kind: "release-date",
        releaseDate: "2027-02-06",
        releaseTimeLocal: null,
        sourceTimeZone: null,
      });
    }
  );

  it("returns not-applicable immediately outside the recorded event period", () => {
    expect(deriveReservationMechanismDate(sumo, "2027-03-29")).toEqual({
      kind: "not-applicable-to-visit-date",
      recordId: "RM-JP-212-001",
      placeId: "JP-212",
      scope: "event-admission",
      visitDate: "2027-03-29",
      reason: "outside-recorded-event-period",
    });
  });

  it("does not assume universal applicability when bounds are missing", () => {
    // Narrow to the recorded branch first: spreading the whole `ReservationMechanism` union would
    // widen the literal to every kind, and the applicability bounds exist only on this one.
    if (sumo.mechanism.kind !== "fixed-sale-date") {
      throw new Error("expected a fixed-sale-date fixture for JP-212");
    }
    const synthetic: ReservationMechanismEvidenceRecord = {
      ...sumo,
      id: "RM-JP-212-002",
      mechanism: {
        ...sumo.mechanism,
        appliesToStartDate: null,
        appliesToEndDate: null,
      },
    };
    expect(deriveReservationMechanismDate(synthetic, "2027-03-20")).toMatchObject({
      kind: "not-derivable",
      reason: "missing-recorded-applicability",
    });
  });

  /**
   * Regression for the invariant the narrowing above depends on: recorded applicability bounds
   * belong to `fixed-sale-date` and to no other mechanism kind, so no other kind may ever reach an
   * applicability verdict. A future mechanism that grew bounds without its own recorded event
   * interval would fail here rather than silently gating a release date on absent evidence.
   */
  it("recorded applicability bounds exist on, and gate, only fixed-sale-date evidence", () => {
    for (const stored of reservationMechanismEvidenceRecords) {
      const carriesBounds =
        "appliesToStartDate" in stored.mechanism || "appliesToEndDate" in stored.mechanism;
      expect(carriesBounds).toBe(stored.mechanism.kind === "fixed-sale-date");
      if (stored.mechanism.kind === "fixed-sale-date") continue;
      const derived = deriveReservationMechanismDate(stored, "2027-03-20");
      expect(derived.kind).not.toBe("not-applicable-to-visit-date");
      if (derived.kind === "not-derivable") {
        expect(derived.reason).not.toBe("missing-recorded-applicability");
      }
    }
  });
});

describe("evidence status, visit date and plan composition", () => {
  it("superseded evidence never yields a normal date", () => {
    const superseded = { ...ghibli, status: "superseded" } as ReservationMechanismEvidenceRecord;
    expect(deriveReservationMechanismDate(superseded, "2027-02-20")).toEqual({
      kind: "inactive-evidence",
      recordId: ghibli.id,
      placeId: ghibli.placeId,
      scope: ghibli.scope,
    });
  });

  it("superseded status remains dominant even when visit date is missing", () => {
    const superseded = { ...ghibli, status: "superseded" } as ReservationMechanismEvidenceRecord;
    expect(deriveReservationMechanismDate(superseded, null).kind).toBe("inactive-evidence");
  });

  it("null and invalid visit dates return no-visit-date for active evidence", () => {
    expect(deriveReservationMechanismDate(ghibli, null).kind).toBe("no-visit-date");
    expect(deriveReservationMechanismDate(ghibli, "2027-02-30").kind).toBe("no-visit-date");
  });

  it("reuses the existing plan visit-date owner and offsets by day index", () => {
    const assignment = dayAssignmentFromLookup(
      ["JP-044", "JP-203"],
      [["JP-044"], ["JP-203"]],
      () => null
    );
    const result = deriveReservationMechanismDatesForPlannedPlace(
      reservationMechanismEvidenceRecords,
      assignment,
      "2027-02-19",
      "JP-203"
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "release-date", visitDate: "2027-02-20", releaseDate: "2026-12-20" });
  });

  it("an invalid day assignment yields no-visit-date, never a fallback", () => {
    const assignment = dayAssignmentFromLookup(
      ["JP-044", "JP-203"],
      [["JP-044"]],
      () => null
    );
    expect(assignment.valid).toBe(false);
    const result = deriveReservationMechanismDatesForPlannedPlace(
      reservationMechanismEvidenceRecords,
      assignment,
      "2027-02-19",
      "JP-044"
    );
    expect(result[0]?.kind).toBe("no-visit-date");
  });

  it("a missing start date yields no-visit-date", () => {
    const assignment = dayAssignmentFromLookup(["JP-044"], [["JP-044"]], () => null);
    const result = deriveReservationMechanismDatesForPlannedPlace(
      reservationMechanismEvidenceRecords,
      assignment,
      null,
      "JP-044"
    );
    expect(result[0]?.kind).toBe("no-visit-date");
  });
});

describe("multiple scopes and determinism", () => {
  it("derives every matching record in stable source order without ranking", () => {
    const workshop: ReservationMechanismEvidenceRecord = {
      ...ghibli,
      id: "RM-JP-044-002",
      scope: "workshop",
      mechanism: {
        kind: "rolling-day-release",
        daysBeforeVisit: 7,
        releaseTimeLocal: null,
        sourceTimeZone: null,
      },
    };
    const results = deriveReservationMechanismDatesForPlace([workshop, ghibli], "JP-044", "2027-02-20");
    expect(results.map((result) => result.recordId)).toEqual(["RM-JP-044-002", "RM-JP-044-001"]);
  });

  it("same record + visit date serializes identically across repeated calls", () => {
    const results = new Set(
      Array.from({ length: 8 }, () => JSON.stringify(deriveReservationMechanismDate(disneyland, "2027-02-20")))
    );
    expect(results.size).toBe(1);
  });
});

describe("claim and side-effect boundaries", () => {
  it("derived results contain no availability, urgency, recommendation or countdown fields", () => {
    const outputs = [
      deriveReservationMechanismDate(ghibli, "2027-02-20"),
      deriveReservationMechanismDate(disneyland, "2027-02-20"),
      deriveReservationMechanismDate(katsura, "2027-03-15"),
      deriveReservationMechanismDate(sumo, "2027-03-20"),
    ];
    const forbidden = [
      "isOpen",
      "isClosed",
      "isLate",
      "isUrgent",
      "daysRemaining",
      "shouldBook",
      "recommendedAction",
      "availability",
      "inventory",
    ];
    for (const output of outputs) {
      for (const key of forbidden) expect(output).not.toHaveProperty(key);
    }
  });

  it("module source has no clock, storage, network, editorial lead-time or timezone-conversion dependency", async () => {
    const source = await readFile(new URL("./reservation-mechanism-date-derivation.ts", import.meta.url), "utf8");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "Date.now",
      "new Date()",
      "localStorage",
      "fetch(",
      "XMLHttpRequest",
      "reservation.leadTime",
      "captureDeviceLocalCivilDate",
      "toISOString",
      "getTimezoneOffset",
    ]) {
      expect(codeOnly, forbidden).not.toContain(forbidden);
    }
  });

  it("real pilot has no result for intentionally absent USJ/Nintendo/AnimeJapan records", () => {
    for (const placeId of ["JP-125", "JP-097", "JP-211"]) {
      expect(deriveReservationMechanismDatesForPlace(reservationMechanismEvidenceRecords, placeId, "2027-03-15")).toEqual([]);
    }
  });
});
