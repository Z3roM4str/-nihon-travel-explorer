import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isValidCivilDate } from "./civil-date";
import {
  evaluateOfficialReservationReferenceDate,
  type OfficialReservationReferenceRelation,
} from "./reservation-mechanism-reference-date";
import {
  deriveReservationMechanismDate,
  type ReservationMechanismDateDerivation,
} from "./reservation-mechanism-date-derivation";
import {
  reservationMechanismEvidenceRecords,
  type ReservationMechanismEvidenceRecord,
} from "./reservation-mechanism-evidence";

const MODULE_SOURCE = new URL("./reservation-mechanism-reference-date.ts", import.meta.url);

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

/** Real Phase 3F-D outputs, produced by the real derivation owner — never hand-written dates. */
const ghibliRelease = deriveReservationMechanismDate(ghibli, "2027-02-20");
const disneylandRelease = deriveReservationMechanismDate(disneyland, "2027-02-20");
const disneySeaFallbackRelease = deriveReservationMechanismDate(disneySea, "2027-04-30");
const katsuraWindow = deriveReservationMechanismDate(katsura, "2027-03-15");
const sumoApplicable = deriveReservationMechanismDate(sumo, "2027-03-20");
const sumoOutsideEvent = deriveReservationMechanismDate(sumo, "2027-03-29");

function kindOf(
  derivation: ReservationMechanismDateDerivation,
  referenceDate: string
): OfficialReservationReferenceRelation["kind"] {
  return evaluateOfficialReservationReferenceDate(derivation, referenceDate).kind;
}

describe("Phase 3F-H — real fixtures feeding the relation", () => {
  it("uses the already-derived Phase 3F-D dates rather than reimplementing arithmetic", () => {
    expect(ghibliRelease).toMatchObject({ kind: "release-date", releaseDate: "2027-01-10" });
    expect(disneylandRelease).toMatchObject({ kind: "release-date", releaseDate: "2026-12-20" });
    // DisneySea's real missing-day fallback (2027-02-30 does not exist) already resolved upstream.
    expect(disneySeaFallbackRelease).toMatchObject({
      kind: "release-date",
      releaseDate: "2027-03-01",
    });
    expect(katsuraWindow).toMatchObject({
      kind: "application-window",
      openDate: "2026-12-01",
      closeDate: "2027-03-12",
    });
    expect(sumoApplicable).toMatchObject({ kind: "release-date", releaseDate: "2027-02-06" });
    expect(sumoOutsideEvent).toMatchObject({ kind: "not-applicable-to-visit-date" });
  });
});

describe("Phase 3F-H — statuses that are never assessed", () => {
  it("returns not-assessed for an invalid reference date", () => {
    expect(evaluateOfficialReservationReferenceDate(ghibliRelease, "2027-02-30")).toEqual({
      kind: "not-assessed",
      reason: "invalid-reference-date",
    });
    expect(evaluateOfficialReservationReferenceDate(katsuraWindow, "not-a-date")).toEqual({
      kind: "not-assessed",
      reason: "invalid-reference-date",
    });
  });

  it("returns not-assessed when no visit date exists", () => {
    const derivation = deriveReservationMechanismDate(ghibli, null);
    expect(derivation.kind).toBe("no-visit-date");
    expect(evaluateOfficialReservationReferenceDate(derivation, "2027-01-10")).toEqual({
      kind: "not-assessed",
      reason: "derivation-not-date-relatable",
    });
  });

  it("returns not-assessed for inactive evidence", () => {
    const superseded: ReservationMechanismEvidenceRecord = { ...ghibli, status: "superseded" };
    const derivation = deriveReservationMechanismDate(superseded, "2027-02-20");
    expect(derivation.kind).toBe("inactive-evidence");
    expect(evaluateOfficialReservationReferenceDate(derivation, "2027-01-10")).toEqual({
      kind: "not-assessed",
      reason: "derivation-not-date-relatable",
    });
  });

  it("returns not-assessed when the official record does not apply to the visit date", () => {
    expect(evaluateOfficialReservationReferenceDate(sumoOutsideEvent, "2027-02-06")).toEqual({
      kind: "not-assessed",
      reason: "derivation-not-date-relatable",
    });
  });

  it("returns not-assessed for a not-derivable result", () => {
    const withoutApplicability: ReservationMechanismEvidenceRecord = {
      ...sumo,
      mechanism: { ...sumo.mechanism, appliesToStartDate: null, appliesToEndDate: null } as
        ReservationMechanismEvidenceRecord["mechanism"],
    };
    const derivation = deriveReservationMechanismDate(withoutApplicability, "2027-03-20");
    expect(derivation.kind).toBe("not-derivable");
    expect(evaluateOfficialReservationReferenceDate(derivation, "2027-02-06")).toEqual({
      kind: "not-assessed",
      reason: "derivation-not-date-relatable",
    });
  });
});

describe("Phase 3F-H — recorded release-date relation", () => {
  it("classifies one day before Ghibli's recorded release date", () => {
    expect(kindOf(ghibliRelease, "2027-01-09")).toBe("before-recorded-release-date");
  });

  it("classifies the exact recorded release date as same-date only", () => {
    const relation = evaluateOfficialReservationReferenceDate(ghibliRelease, "2027-01-10");
    expect(relation).toEqual({
      kind: "on-recorded-release-date",
      recordId: "RM-JP-044-001",
      placeId: "JP-044",
      scope: "general-admission",
      referenceDate: "2027-01-10",
      releaseDate: "2027-01-10",
    });
    // The recorded 10:00 Asia/Tokyo time is not part of the result and cannot have been consulted.
    expect(JSON.stringify(relation)).not.toContain("10:00");
    expect(JSON.stringify(relation)).not.toContain("Asia/Tokyo");
  });

  it("classifies one day after Ghibli's recorded release date", () => {
    expect(kindOf(ghibliRelease, "2027-01-11")).toBe("after-recorded-release-date");
  });

  it("handles a year rollover as an ordinary civil-date comparison", () => {
    // Visit 2027-01-20 -> Ghibli's monthly release falls in the previous calendar year.
    const rollover = deriveReservationMechanismDate(ghibli, "2027-01-20");
    expect(rollover).toMatchObject({ kind: "release-date", releaseDate: "2026-12-10" });
    expect(kindOf(rollover, "2026-12-09")).toBe("before-recorded-release-date");
    expect(kindOf(rollover, "2026-12-10")).toBe("on-recorded-release-date");
    expect(kindOf(rollover, "2027-01-01")).toBe("after-recorded-release-date");
  });

  it("relates Disney's null-timezone release without inferring a timezone", () => {
    const relation = evaluateOfficialReservationReferenceDate(disneylandRelease, "2026-12-20");
    expect(relation.kind).toBe("on-recorded-release-date");
    const serialized = JSON.stringify(relation);
    for (const forbidden of ["Asia/Tokyo", "JST", "UTC", "14:00"]) {
      expect(serialized, forbidden).not.toContain(forbidden);
    }
  });

  it("consumes DisneySea's already-resolved missing-day fallback date", () => {
    expect(kindOf(disneySeaFallbackRelease, "2027-02-28")).toBe("before-recorded-release-date");
    expect(kindOf(disneySeaFallbackRelease, "2027-03-01")).toBe("on-recorded-release-date");
    expect(kindOf(disneySeaFallbackRelease, "2027-03-02")).toBe("after-recorded-release-date");
  });

  it("relates Sumo's recorded fixed sale date for an applicable visit", () => {
    expect(kindOf(sumoApplicable, "2027-02-05")).toBe("before-recorded-release-date");
    expect(kindOf(sumoApplicable, "2027-02-06")).toBe("on-recorded-release-date");
    expect(kindOf(sumoApplicable, "2027-02-07")).toBe("after-recorded-release-date");
  });
});

describe("Phase 3F-H — recorded application date-span relation", () => {
  it("classifies one day before the recorded open date", () => {
    expect(kindOf(katsuraWindow, "2026-11-30")).toBe("before-recorded-application-date-span");
  });

  it("treats the exact recorded open date as within the date span", () => {
    expect(kindOf(katsuraWindow, "2026-12-01")).toBe("within-recorded-application-date-span");
  });

  it("treats a date strictly between both edges as within the date span", () => {
    expect(kindOf(katsuraWindow, "2027-01-15")).toBe("within-recorded-application-date-span");
  });

  it("treats the exact recorded close date as within the date span", () => {
    const relation = evaluateOfficialReservationReferenceDate(katsuraWindow, "2027-03-12");
    expect(relation).toEqual({
      kind: "within-recorded-application-date-span",
      recordId: "RM-JP-077-001",
      placeId: "JP-077",
      scope: "guided-visit",
      referenceDate: "2027-03-12",
      openDate: "2026-12-01",
      closeDate: "2027-03-12",
    });
    // Katsura's recorded 05:00/23:59 edge times never reach this result.
    expect(JSON.stringify(relation)).not.toContain("05:00");
    expect(JSON.stringify(relation)).not.toContain("23:59");
  });

  it("classifies one day after the recorded close date", () => {
    expect(kindOf(katsuraWindow, "2027-03-13")).toBe("after-recorded-application-date-span");
  });

  it("treats an equal open/close pair as a legitimate one-day span", () => {
    if (katsuraWindow.kind !== "application-window") throw new Error("unexpected derivation");
    const oneDay = { ...katsuraWindow, openDate: "2027-01-15", closeDate: "2027-01-15" };
    expect(kindOf(oneDay, "2027-01-14")).toBe("before-recorded-application-date-span");
    expect(kindOf(oneDay, "2027-01-15")).toBe("within-recorded-application-date-span");
    expect(kindOf(oneDay, "2027-01-16")).toBe("after-recorded-application-date-span");
  });
});

describe("Phase 3F-H — an inverted application date span fails closed", () => {
  /**
   * Both dates below are individually valid civil dates; only their ORDER is wrong. Phase 3F-D's
   * evidence parser constrains `monthsBeforeVisitMonth`/`daysBeforeVisit` to positive integers but
   * does not itself guarantee `derived openDate <= derived closeDate`, so Phase 3F-H must not assume
   * every application window it receives is ordered.
   */
  function invertedSpan() {
    if (katsuraWindow.kind !== "application-window") throw new Error("unexpected derivation");
    return { ...katsuraWindow, openDate: "2027-03-01", closeDate: "2027-02-15" };
  }

  it("refuses an inverted span whose individual dates are both valid", () => {
    const inverted = invertedSpan();
    expect(isValidCivilDate(inverted.openDate)).toBe(true);
    expect(isValidCivilDate(inverted.closeDate)).toBe(true);
    expect(inverted.openDate > inverted.closeDate).toBe(true);
    expect(evaluateOfficialReservationReferenceDate(inverted, "2027-02-20")).toEqual({
      kind: "not-assessed",
      reason: "derivation-not-date-relatable",
    });
  });

  it("never produces a span relation for an inverted span, at any reference date", () => {
    const inverted = invertedSpan();
    const forbidden = [
      "before-recorded-application-date-span",
      "within-recorded-application-date-span",
      "after-recorded-application-date-span",
    ];
    for (const reference of [
      "2027-02-14", // before both edges
      "2027-02-15", // on the (smaller) recorded close date
      "2027-02-20", // between the two edges, i.e. inside the inverted range
      "2027-03-01", // on the (larger) recorded open date
      "2027-03-02", // after both edges
    ]) {
      const relation = evaluateOfficialReservationReferenceDate(inverted, reference);
      expect(relation, reference).toEqual({
        kind: "not-assessed",
        reason: "derivation-not-date-relatable",
      });
      expect(forbidden, reference).not.toContain(relation.kind);
    }
  });

  it("does not swap, repair, re-order or infer intent from an inverted span", () => {
    const inverted = invertedSpan();
    const snapshot = JSON.stringify(inverted);
    const relation = evaluateOfficialReservationReferenceDate(inverted, "2027-02-20");
    // The refusal carries no identity and no dates at all: nothing is salvaged or rewritten.
    expect(Object.keys(relation).sort()).toEqual(["kind", "reason"]);
    expect(JSON.stringify(inverted)).toBe(snapshot);
    expect(inverted.openDate).toBe("2027-03-01");
    expect(inverted.closeDate).toBe("2027-02-15");
  });

  it("leaves the real ordered Katsura span untouched", () => {
    // The corrective is a defensive boundary only; real Phase 3F-D output is unaffected.
    expect(kindOf(katsuraWindow, "2026-11-30")).toBe("before-recorded-application-date-span");
    expect(kindOf(katsuraWindow, "2026-12-01")).toBe("within-recorded-application-date-span");
    expect(kindOf(katsuraWindow, "2027-01-15")).toBe("within-recorded-application-date-span");
    expect(kindOf(katsuraWindow, "2027-03-12")).toBe("within-recorded-application-date-span");
    expect(kindOf(katsuraWindow, "2027-03-13")).toBe("after-recorded-application-date-span");
  });
});

describe("Phase 3F-H — identity is preserved on every assessed relation", () => {
  it("preserves record identity", () => {
    const relation = evaluateOfficialReservationReferenceDate(ghibliRelease, "2027-01-09");
    expect(relation).toMatchObject({ recordId: "RM-JP-044-001" });
  });

  it("preserves place identity", () => {
    const relation = evaluateOfficialReservationReferenceDate(katsuraWindow, "2027-01-15");
    expect(relation).toMatchObject({ placeId: "JP-077" });
  });

  it("preserves scope identity", () => {
    expect(evaluateOfficialReservationReferenceDate(disneylandRelease, "2026-12-20")).toMatchObject({
      scope: "park-admission",
    });
    expect(evaluateOfficialReservationReferenceDate(sumoApplicable, "2027-02-06")).toMatchObject({
      scope: "event-admission",
    });
  });

  it("carries the exact reference date it was given", () => {
    expect(evaluateOfficialReservationReferenceDate(ghibliRelease, "2027-01-09")).toMatchObject({
      referenceDate: "2027-01-09",
    });
  });
});

describe("Phase 3F-H — time and timezone cannot change the result", () => {
  it("ignores a recorded release clock time", () => {
    if (ghibliRelease.kind !== "release-date") throw new Error("unexpected derivation");
    const midnight = { ...ghibliRelease, releaseTimeLocal: "00:00" };
    const lateNight = { ...ghibliRelease, releaseTimeLocal: "23:59" };
    const none = { ...ghibliRelease, releaseTimeLocal: null };
    for (const reference of ["2027-01-09", "2027-01-10", "2027-01-11"]) {
      const baseline = kindOf(ghibliRelease, reference);
      expect(kindOf(midnight, reference)).toBe(baseline);
      expect(kindOf(lateNight, reference)).toBe(baseline);
      expect(kindOf(none, reference)).toBe(baseline);
    }
  });

  it("ignores the recorded source timezone on a release date", () => {
    if (ghibliRelease.kind !== "release-date") throw new Error("unexpected derivation");
    const unknownZone = { ...ghibliRelease, sourceTimeZone: null } as typeof ghibliRelease;
    for (const reference of ["2027-01-09", "2027-01-10", "2027-01-11"]) {
      expect(kindOf(unknownZone, reference)).toBe(kindOf(ghibliRelease, reference));
    }
  });

  it("ignores recorded edge clock times and timezones on an application window", () => {
    if (katsuraWindow.kind !== "application-window") throw new Error("unexpected derivation");
    const shifted = {
      ...katsuraWindow,
      openTimeLocal: "23:59",
      closeTimeLocal: "00:00",
      openSourceTimeZone: "Asia/Tokyo",
      closeSourceTimeZone: "Asia/Tokyo",
    } as typeof katsuraWindow;
    for (const reference of ["2026-11-30", "2026-12-01", "2027-03-12", "2027-03-13"]) {
      expect(kindOf(shifted, reference)).toBe(kindOf(katsuraWindow, reference));
    }
  });

  it("produces the same result under any host timezone offset", () => {
    // The evaluator never constructs an instant, so a process-level TZ change is inert here. This
    // asserts the property directly rather than trusting the source scan alone.
    const before = kindOf(ghibliRelease, "2027-01-10");
    const original = process.env.TZ;
    try {
      for (const zone of ["UTC", "Pacific/Kiritimati", "Pacific/Midway", "America/Mexico_City"]) {
        process.env.TZ = zone;
        expect(kindOf(ghibliRelease, "2027-01-10")).toBe(before);
        expect(kindOf(katsuraWindow, "2026-12-01")).toBe("within-recorded-application-date-span");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("Phase 3F-H — purity and non-mutation", () => {
  it("does not mutate the upstream derivation", () => {
    const snapshot = JSON.stringify(katsuraWindow);
    evaluateOfficialReservationReferenceDate(katsuraWindow, "2027-01-15");
    expect(JSON.stringify(katsuraWindow)).toBe(snapshot);
  });

  it("is deterministic for the same inputs", () => {
    const first = evaluateOfficialReservationReferenceDate(ghibliRelease, "2027-01-11");
    const second = evaluateOfficialReservationReferenceDate(ghibliRelease, "2027-01-11");
    expect(first).toEqual(second);
  });
});

describe("Phase 3F-H — source boundary", () => {
  it("reads no clock, builds no instant and converts no timezone", async () => {
    const source = await readFile(MODULE_SOURCE, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "Date.now(",
      "new Date(",
      "Date.parse(",
      "Date.UTC(",
      "Intl",
      "getTimezoneOffset",
      "toISOString",
      "toLocaleDateString",
      "Asia/Tokyo",
      "releaseTimeLocal",
      "sourceTimeZone",
      "openTimeLocal",
      "closeTimeLocal",
      "openSourceTimeZone",
      "closeSourceTimeZone",
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  it("does not reuse the Phase 3D reservation-window evaluator or lead-time domain", async () => {
    const source = await readFile(MODULE_SOURCE, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "evaluateReservationWindowReference",
      "ReservationWindowReferenceRelation",
      "derivePlaceReservationDateWindow",
      "reservation-window-reference",
      "reservation-deadline",
      "leadTime",
      "captureDeviceLocalCivilDate",
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  it("performs no network, storage or mutation", async () => {
    const source = await readFile(MODULE_SOURCE, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      ".push(",
      ".sort(",
      "delete ",
      "Object.assign(",
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  it("imports only civil-date validation and Phase 3F types", async () => {
    const source = await readFile(MODULE_SOURCE, "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports.sort()).toEqual([
      "./civil-date",
      "./reservation-mechanism-date-derivation",
      "./reservation-mechanism-evidence",
    ]);
  });

  it("uses no availability, urgency, action or countdown vocabulary", async () => {
    const source = (await readFile(MODULE_SOURCE, "utf8")).toLowerCase();
    for (const forbidden of [
      "booking-open",
      "booking-closed",
      "sale-open",
      "sale-closed",
      "deadline-passed",
      "too-late",
      "book-now",
      "isopen",
      "isclosed",
      "islate",
      "shouldbook",
      "countdown",
      "daysremaining",
      "hoursremaining",
      "soldout",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
