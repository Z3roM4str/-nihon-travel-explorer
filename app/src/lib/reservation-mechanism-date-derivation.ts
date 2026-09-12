import { addCivilDays, isValidCivilDate } from "./civil-date";
import { deriveVisitDateForPlace } from "./reservation-deadline";
import type { DayAssignment } from "./day-assignment";
import type {
  ReservationAllocation,
  ReservationMechanismEvidenceRecord,
  ReservationMechanismScope,
  ReservationSourceTimeZone,
} from "./reservation-mechanism-evidence";

export type ReservationMechanismDateDerivation =
  | {
      kind: "no-visit-date";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
    }
  | {
      kind: "inactive-evidence";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
    }
  | {
      kind: "not-applicable-to-visit-date";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      visitDate: string;
      reason: "outside-recorded-event-period";
    }
  | {
      kind: "not-derivable";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      visitDate: string;
      reason: "invalid-calendar-alignment" | "missing-recorded-applicability";
    }
  | {
      kind: "release-date";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      visitDate: string;
      releaseDate: string;
      releaseTimeLocal: string | null;
      sourceTimeZone: ReservationSourceTimeZone;
      allocation: ReservationAllocation;
    }
  | {
      kind: "application-window";
      recordId: string;
      placeId: string;
      scope: ReservationMechanismScope;
      visitDate: string;
      openDate: string;
      openTimeLocal: string | null;
      openSourceTimeZone: ReservationSourceTimeZone;
      closeDate: string;
      closeTimeLocal: string | null;
      closeSourceTimeZone: ReservationSourceTimeZone;
      allocation: ReservationAllocation;
    };

type CivilParts = { year: number; month: number; day: number };

function civilParts(iso: string): CivilParts | null {
  if (!isValidCivilDate(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function formatCivilParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftedYearMonth(iso: string, offsetMonths: number): { year: number; month: number } | null {
  const parts = civilParts(iso);
  if (!parts || !Number.isSafeInteger(offsetMonths)) return null;
  const total = parts.year * 12 + (parts.month - 1) + offsetMonths;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  return { year, month };
}

function dateInShiftedMonth(iso: string, offsetMonths: number, day: number): string | null {
  if (!Number.isSafeInteger(day) || day < 1 || day > 31) return null;
  const target = shiftedYearMonth(iso, offsetMonths);
  if (!target) return null;
  const candidate = formatCivilParts(target.year, target.month, day);
  return isValidCivilDate(candidate) ? candidate : null;
}

function firstDayOfShiftedMonth(iso: string, offsetMonths: number): string | null {
  return dateInShiftedMonth(iso, offsetMonths, 1);
}

function baseIdentity(record: ReservationMechanismEvidenceRecord) {
  return { recordId: record.id, placeId: record.placeId, scope: record.scope };
}

export function deriveReservationMechanismDate(
  record: ReservationMechanismEvidenceRecord,
  visitDate: string | null
): ReservationMechanismDateDerivation {
  const identity = baseIdentity(record);

  if (record.status !== "active") {
    return { kind: "inactive-evidence", ...identity };
  }
  if (visitDate === null || !isValidCivilDate(visitDate)) {
    return { kind: "no-visit-date", ...identity };
  }

  const mechanism = record.mechanism;

  if (mechanism.kind === "monthly-fixed-release") {
    const releaseDate = dateInShiftedMonth(visitDate, -1, mechanism.releaseDayOfMonth);
    if (!releaseDate) {
      return { kind: "not-derivable", ...identity, visitDate, reason: "invalid-calendar-alignment" };
    }
    return {
      kind: "release-date",
      ...identity,
      visitDate,
      releaseDate,
      releaseTimeLocal: mechanism.releaseTimeLocal,
      sourceTimeZone: mechanism.sourceTimeZone,
      allocation: record.allocation,
    };
  }

  if (mechanism.kind === "rolling-calendar-month-release") {
    const visit = civilParts(visitDate);
    if (!visit) return { kind: "no-visit-date", ...identity };
    let releaseDate = dateInShiftedMonth(visitDate, -mechanism.monthsBeforeVisit, visit.day);
    if (!releaseDate) {
      if (mechanism.missingAlignedDayRule !== "first-day-of-next-month") {
        return { kind: "not-derivable", ...identity, visitDate, reason: "invalid-calendar-alignment" };
      }
      releaseDate = firstDayOfShiftedMonth(visitDate, -mechanism.monthsBeforeVisit + 1);
    }
    if (!releaseDate) {
      return { kind: "not-derivable", ...identity, visitDate, reason: "invalid-calendar-alignment" };
    }
    return {
      kind: "release-date",
      ...identity,
      visitDate,
      releaseDate,
      releaseTimeLocal: mechanism.releaseTimeLocal,
      sourceTimeZone: mechanism.sourceTimeZone,
      allocation: record.allocation,
    };
  }

  if (mechanism.kind === "rolling-day-release") {
    const releaseDate = addCivilDays(visitDate, -mechanism.daysBeforeVisit);
    if (!releaseDate || !isValidCivilDate(releaseDate)) {
      return { kind: "not-derivable", ...identity, visitDate, reason: "invalid-calendar-alignment" };
    }
    return {
      kind: "release-date",
      ...identity,
      visitDate,
      releaseDate,
      releaseTimeLocal: mechanism.releaseTimeLocal,
      sourceTimeZone: mechanism.sourceTimeZone,
      allocation: record.allocation,
    };
  }

  if (mechanism.kind === "relative-application-window") {
    const openDate = firstDayOfShiftedMonth(visitDate, -mechanism.openRule.monthsBeforeVisitMonth);
    const closeDate = addCivilDays(visitDate, -mechanism.closeRule.daysBeforeVisit);
    if (!openDate || !closeDate || !isValidCivilDate(closeDate)) {
      return { kind: "not-derivable", ...identity, visitDate, reason: "invalid-calendar-alignment" };
    }
    return {
      kind: "application-window",
      ...identity,
      visitDate,
      openDate,
      openTimeLocal: mechanism.openRule.timeLocal,
      openSourceTimeZone: mechanism.openRule.sourceTimeZone,
      closeDate,
      closeTimeLocal: mechanism.closeRule.timeLocal,
      closeSourceTimeZone: mechanism.closeRule.sourceTimeZone,
      allocation: record.allocation,
    };
  }

  if (mechanism.appliesToStartDate === null || mechanism.appliesToEndDate === null) {
    return { kind: "not-derivable", ...identity, visitDate, reason: "missing-recorded-applicability" };
  }
  if (
    !isValidCivilDate(mechanism.appliesToStartDate) ||
    !isValidCivilDate(mechanism.appliesToEndDate) ||
    visitDate < mechanism.appliesToStartDate ||
    visitDate > mechanism.appliesToEndDate
  ) {
    return {
      kind: "not-applicable-to-visit-date",
      ...identity,
      visitDate,
      reason: "outside-recorded-event-period",
    };
  }
  return {
    kind: "release-date",
    ...identity,
    visitDate,
    releaseDate: mechanism.saleDate,
    releaseTimeLocal: mechanism.releaseTimeLocal,
    sourceTimeZone: mechanism.sourceTimeZone,
    allocation: record.allocation,
  };
}

export function deriveReservationMechanismDatesForPlace(
  records: readonly ReservationMechanismEvidenceRecord[],
  placeId: string,
  visitDate: string | null
): ReservationMechanismDateDerivation[] {
  return records
    .filter((record) => record.placeId === placeId)
    .map((record) => deriveReservationMechanismDate(record, visitDate));
}

export function deriveReservationMechanismDatesForPlannedPlace(
  records: readonly ReservationMechanismEvidenceRecord[],
  dayAssignment: DayAssignment,
  startDate: string | null,
  placeId: string
): ReservationMechanismDateDerivation[] {
  const visitDate = deriveVisitDateForPlace(dayAssignment, startDate, placeId);
  return deriveReservationMechanismDatesForPlace(records, placeId, visitDate);
}
