import reservationMechanismsData from "../data/reservation-mechanisms.json";

export type ReservationMechanismScope =
  | "general-admission"
  | "park-admission"
  | "guided-visit"
  | "event-admission"
  | "area-timed-entry"
  | "workshop"
  | "other-explicit";

export type ReservationAllocation =
  | "first-come"
  | "drawing"
  | "lottery-if-oversubscribed"
  | "capacity-limited"
  | "not-stated";

export type ReservationMechanismStatus = "active" | "superseded";
export type ReservationEvidenceConfidence = "official-explicit" | "official-derived";
export type ReservationSourceTimeZone = "Asia/Tokyo" | null;

export type ReservationMechanism =
  | {
      kind: "monthly-fixed-release";
      releaseDayOfMonth: number;
      releaseTimeLocal: string | null;
      sourceTimeZone: ReservationSourceTimeZone;
      target: "subsequent-calendar-month";
    }
  | {
      kind: "rolling-calendar-month-release";
      monthsBeforeVisit: number;
      alignment: "same-calendar-day";
      missingAlignedDayRule: "first-day-of-next-month" | "not-recorded";
      releaseTimeLocal: string | null;
      sourceTimeZone: ReservationSourceTimeZone;
    }
  | {
      kind: "rolling-day-release";
      daysBeforeVisit: number;
      releaseTimeLocal: string | null;
      sourceTimeZone: ReservationSourceTimeZone;
    }
  | {
      kind: "relative-application-window";
      openRule: {
        kind: "month-offset-first-day";
        monthsBeforeVisitMonth: number;
        timeLocal: string | null;
        sourceTimeZone: ReservationSourceTimeZone;
      };
      closeRule: {
        kind: "days-before-visit";
        daysBeforeVisit: number;
        timeLocal: string | null;
        sourceTimeZone: ReservationSourceTimeZone;
      };
    }
  | {
      kind: "fixed-sale-date";
      saleDate: string;
      releaseTimeLocal: string | null;
      sourceTimeZone: ReservationSourceTimeZone;
      appliesToStartDate: string | null;
      appliesToEndDate: string | null;
    };

export type ReservationMechanismEvidenceRecord = {
  id: string;
  placeId: string;
  scope: ReservationMechanismScope;
  mechanism: ReservationMechanism;
  allocation: ReservationAllocation;
  status: ReservationMechanismStatus;
  provenance: {
    sourceUrl: string;
    sourceEntity: string;
    consultedAt: string;
    evidence: string;
    confidence: ReservationEvidenceConfidence;
  };
};

const scopes = new Set<ReservationMechanismScope>([
  "general-admission",
  "park-admission",
  "guided-visit",
  "event-admission",
  "area-timed-entry",
  "workshop",
  "other-explicit",
]);
const allocations = new Set<ReservationAllocation>([
  "first-come",
  "drawing",
  "lottery-if-oversubscribed",
  "capacity-limited",
  "not-stated",
]);
const statuses = new Set<ReservationMechanismStatus>(["active", "superseded"]);
const confidences = new Set<ReservationEvidenceConfidence>(["official-explicit", "official-derived"]);
const timeZones = new Set<ReservationSourceTimeZone>([null, "Asia/Tokyo"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const idPattern = /^RM-(JP-\d{3})-\d{3}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}
function validHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}
function positiveInt(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}
function validDateShape(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function validTime(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && timePattern.test(value));
}
function validZone(value: unknown): value is ReservationSourceTimeZone {
  return timeZones.has(value as ReservationSourceTimeZone);
}
function validMechanism(value: unknown): value is ReservationMechanism {
  if (!isObject(value) || typeof value.kind !== "string") return false;
  if (value.kind === "monthly-fixed-release") {
    if (!hasExactKeys(value, ["kind", "releaseDayOfMonth", "releaseTimeLocal", "sourceTimeZone", "target"])) return false;
    return positiveInt(value.releaseDayOfMonth) &&
      value.releaseDayOfMonth <= 31 &&
      validTime(value.releaseTimeLocal) &&
      validZone(value.sourceTimeZone) &&
      value.target === "subsequent-calendar-month";
  }
  if (value.kind === "rolling-calendar-month-release") {
    if (!hasExactKeys(value, ["kind", "monthsBeforeVisit", "alignment", "missingAlignedDayRule", "releaseTimeLocal", "sourceTimeZone"])) return false;
    return positiveInt(value.monthsBeforeVisit) &&
      value.alignment === "same-calendar-day" &&
      (value.missingAlignedDayRule === "first-day-of-next-month" || value.missingAlignedDayRule === "not-recorded") &&
      validTime(value.releaseTimeLocal) &&
      validZone(value.sourceTimeZone);
  }
  if (value.kind === "rolling-day-release") {
    if (!hasExactKeys(value, ["kind", "daysBeforeVisit", "releaseTimeLocal", "sourceTimeZone"])) return false;
    return positiveInt(value.daysBeforeVisit) && validTime(value.releaseTimeLocal) && validZone(value.sourceTimeZone);
  }
  if (value.kind === "relative-application-window") {
    if (!hasExactKeys(value, ["kind", "openRule", "closeRule"])) return false;
    const open = value.openRule;
    const close = value.closeRule;
    return isObject(open) &&
      hasExactKeys(open, ["kind", "monthsBeforeVisitMonth", "timeLocal", "sourceTimeZone"]) &&
      open.kind === "month-offset-first-day" &&
      positiveInt(open.monthsBeforeVisitMonth) &&
      validTime(open.timeLocal) &&
      validZone(open.sourceTimeZone) &&
      isObject(close) &&
      hasExactKeys(close, ["kind", "daysBeforeVisit", "timeLocal", "sourceTimeZone"]) &&
      close.kind === "days-before-visit" &&
      positiveInt(close.daysBeforeVisit) &&
      validTime(close.timeLocal) &&
      validZone(close.sourceTimeZone);
  }
  if (value.kind === "fixed-sale-date") {
    if (!hasExactKeys(value, ["kind", "saleDate", "releaseTimeLocal", "sourceTimeZone", "appliesToStartDate", "appliesToEndDate"])) return false;
    const boundsOrdered =
      value.appliesToStartDate === null ||
      value.appliesToEndDate === null ||
      (typeof value.appliesToStartDate === "string" &&
        typeof value.appliesToEndDate === "string" &&
        value.appliesToStartDate <= value.appliesToEndDate);
    return validDateShape(value.saleDate) &&
      validTime(value.releaseTimeLocal) &&
      validZone(value.sourceTimeZone) &&
      (value.appliesToStartDate === null || validDateShape(value.appliesToStartDate)) &&
      (value.appliesToEndDate === null || validDateShape(value.appliesToEndDate)) &&
      boundsOrdered;
  }
  return false;
}

export function parseReservationMechanismEvidenceRecord(value: unknown): ReservationMechanismEvidenceRecord | null {
  if (!isObject(value)) return null;
  if (!hasExactKeys(value, ["id", "placeId", "scope", "mechanism", "allocation", "status", "provenance"])) return null;
  if (typeof value.id !== "string" || !idPattern.test(value.id)) return null;
  if (typeof value.placeId !== "string" || !value.id.startsWith(`RM-${value.placeId}-`)) return null;
  if (!scopes.has(value.scope as ReservationMechanismScope)) return null;
  if (!validMechanism(value.mechanism)) return null;
  if (!allocations.has(value.allocation as ReservationAllocation)) return null;
  if (!statuses.has(value.status as ReservationMechanismStatus)) return null;
  if (!isObject(value.provenance)) return null;
  if (!hasExactKeys(value.provenance, ["sourceUrl", "sourceEntity", "consultedAt", "evidence", "confidence"])) return null;
  if (!validHttpsUrl(value.provenance.sourceUrl)) return null;
  if (typeof value.provenance.sourceEntity !== "string" || value.provenance.sourceEntity.length === 0) return null;
  if (!validDateShape(value.provenance.consultedAt)) return null;
  if (typeof value.provenance.evidence !== "string" || value.provenance.evidence.length === 0) return null;
  if (!confidences.has(value.provenance.confidence as ReservationEvidenceConfidence)) return null;
  return value as ReservationMechanismEvidenceRecord;
}

export function parseReservationMechanismEvidenceRecords(value: unknown): ReservationMechanismEvidenceRecord[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: ReservationMechanismEvidenceRecord[] = [];
  const ids = new Set<string>();
  const activeIdentities = new Set<string>();
  for (const item of value) {
    const record = parseReservationMechanismEvidenceRecord(item);
    if (!record || ids.has(record.id)) return null;
    ids.add(record.id);
    if (record.status === "active") {
      const identity = `${record.placeId}\u0000${record.scope}`;
      if (activeIdentities.has(identity)) return null;
      activeIdentities.add(identity);
    }
    parsed.push(record);
  }
  return parsed;
}

const parsedBundledRecords = parseReservationMechanismEvidenceRecords(reservationMechanismsData as unknown);
if (!parsedBundledRecords) {
  throw new Error("Invalid bundled reservation-mechanism evidence");
}

export const reservationMechanismEvidenceRecords: readonly ReservationMechanismEvidenceRecord[] = parsedBundledRecords;

export function reservationMechanismEvidenceForPlace(
  records: readonly ReservationMechanismEvidenceRecord[],
  placeId: string
): ReservationMechanismEvidenceRecord[] {
  return records.filter((record) => record.placeId === placeId);
}
