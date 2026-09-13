import { formatCivilDateDisplay } from "./civil-date";
import type { ReservationMechanismDateDerivation } from "./reservation-mechanism-date-derivation";
import type {
  ReservationAllocation,
  ReservationMechanismEvidenceRecord,
  ReservationMechanismScope,
  ReservationSourceTimeZone,
} from "./reservation-mechanism-evidence";

export type OfficialReservationDatePresentation = {
  kind: "release-date" | "application-window" | "not-applicable" | "not-derivable";
  recordId: string;
  placeId: string;
  /** Raw closed scope value, kept alongside the label so Phase 3F-H composition can prove identity
   * (record + place + scope) without reverse-engineering it from display text. */
  scope: ReservationMechanismScope;
  scopeLabel: string;
  heading: string;
  detailLines: readonly string[];
  allocationText: string | null;
  provenanceText: string;
  sourceUrl: string;
};

const SCOPE_LABEL: Record<ReservationMechanismScope, string> = {
  "general-admission": "Entrada general",
  "park-admission": "Entrada al parque",
  "guided-visit": "Visita guiada",
  "event-admission": "Entrada al evento",
  "area-timed-entry": "Acceso a área con horario",
  workshop: "Taller / actividad",
  "other-explicit": "Otro ámbito registrado",
};

const ALLOCATION_LABEL: Record<ReservationAllocation, string | null> = {
  "first-come": "Asignación registrada: por orden de solicitud.",
  drawing: "Asignación registrada: sorteo.",
  "lottery-if-oversubscribed": "La fuente indica sorteo si las solicitudes superan el cupo.",
  "capacity-limited": "La fuente indica capacidad de venta limitada.",
  "not-stated": null,
};

export function reservationMechanismScopeLabel(scope: ReservationMechanismScope): string {
  return SCOPE_LABEL[scope];
}

export function describeReservationAllocationForUi(allocation: ReservationAllocation): string | null {
  return ALLOCATION_LABEL[allocation];
}

function formatRecordedTime(time: string | null, sourceTimeZone: ReservationSourceTimeZone): string | null {
  if (time === null) return null;
  return sourceTimeZone === "Asia/Tokyo"
    ? `${time} (Asia/Tokyo)`
    : `${time} · zona horaria no registrada en la evidencia estructurada`;
}

function formatRecordedDateTime(
  date: string,
  time: string | null,
  sourceTimeZone: ReservationSourceTimeZone
): string {
  const dateText = formatCivilDateDisplay(date);
  const timeText = formatRecordedTime(time, sourceTimeZone);
  return timeText ? `${dateText} · ${timeText}` : dateText;
}

export function formatReservationMechanismProvenanceForUi(
  record: ReservationMechanismEvidenceRecord
): string {
  return `Fuente oficial: ${record.provenance.sourceEntity} · consultada el ${formatCivilDateDisplay(
    record.provenance.consultedAt
  )}`;
}

function identitiesMatch(
  record: ReservationMechanismEvidenceRecord,
  derivation: ReservationMechanismDateDerivation
): boolean {
  return (
    record.id === derivation.recordId &&
    record.placeId === derivation.placeId &&
    record.scope === derivation.scope
  );
}

/**
 * Phase 3F-F presentation boundary.
 *
 * This function only turns one already-derived Phase 3F-D result plus its exact source record into
 * conservative display text. It never re-derives dates, reads a clock, converts timezones, ranks
 * records, inspects Phase 3D editorial reservation data, or makes availability/currentness claims.
 */
export function buildOfficialReservationDatePresentation(
  record: ReservationMechanismEvidenceRecord,
  derivation: ReservationMechanismDateDerivation
): OfficialReservationDatePresentation | null {
  if (!identitiesMatch(record, derivation)) return null;
  if (derivation.kind === "inactive-evidence" || derivation.kind === "no-visit-date") return null;

  const common = {
    recordId: record.id,
    placeId: record.placeId,
    scope: record.scope,
    scopeLabel: reservationMechanismScopeLabel(record.scope),
    provenanceText: formatReservationMechanismProvenanceForUi(record),
    sourceUrl: record.provenance.sourceUrl,
  };

  if (derivation.kind === "release-date") {
    const fixedEventSale = record.mechanism.kind === "fixed-sale-date";
    return {
      ...common,
      kind: "release-date",
      heading: fixedEventSale
        ? "Inicio de venta oficial registrado para este evento"
        : "Venta registrada para esta visita",
      detailLines: [
        formatRecordedDateTime(
          derivation.releaseDate,
          derivation.releaseTimeLocal,
          derivation.sourceTimeZone
        ),
      ],
      allocationText: describeReservationAllocationForUi(derivation.allocation),
    };
  }

  if (derivation.kind === "application-window") {
    return {
      ...common,
      kind: "application-window",
      heading: "Ventana oficial registrada para esta visita",
      detailLines: [
        `Inicio: ${formatRecordedDateTime(
          derivation.openDate,
          derivation.openTimeLocal,
          derivation.openSourceTimeZone
        )}`,
        `Fin registrado de la ventana: ${formatRecordedDateTime(
          derivation.closeDate,
          derivation.closeTimeLocal,
          derivation.closeSourceTimeZone
        )}`,
      ],
      allocationText: describeReservationAllocationForUi(derivation.allocation),
    };
  }

  if (derivation.kind === "not-applicable-to-visit-date") {
    const detailLines = [
      "La fecha de visita asignada queda fuera del periodo del evento registrado.",
    ];
    if (
      record.mechanism.kind === "fixed-sale-date" &&
      record.mechanism.appliesToStartDate !== null &&
      record.mechanism.appliesToEndDate !== null
    ) {
      detailLines.push(
        `Periodo del evento registrado: ${formatCivilDateDisplay(
          record.mechanism.appliesToStartDate
        )} – ${formatCivilDateDisplay(record.mechanism.appliesToEndDate)}.`
      );
    }
    return {
      ...common,
      kind: "not-applicable",
      heading: "El registro oficial de venta no aplica a la fecha de visita asignada.",
      detailLines,
      allocationText: null,
    };
  }

  return {
    ...common,
    kind: "not-derivable",
    heading:
      "Hay un mecanismo oficial registrado, pero con los datos estructurados actuales no se puede derivar una fecha aplicable para esta visita.",
    detailLines: [],
    allocationText: null,
  };
}
