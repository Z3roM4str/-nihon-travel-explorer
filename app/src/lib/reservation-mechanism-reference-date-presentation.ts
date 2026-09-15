import { formatCivilDateDisplay } from "./civil-date";
import type { OfficialReservationDatePresentation } from "./reservation-mechanism-presentation";
import type {
  AssessedOfficialReservationReferenceRelation,
  OfficialReservationReferenceRelation,
} from "./reservation-mechanism-reference-date";

/**
 * Phase 3F-H presentation boundary.
 *
 * Two jobs, both deliberately small:
 *
 *  1. turn one assessed Phase 3F-H relation into strictly relational Spanish copy;
 *  2. refuse to attach a relation to a Phase 3F-F item that is not the same record/place/scope.
 *
 * The vocabulary below never says open, closed, available, sold out, late, remaining, deadline or
 * "book now" — the underlying relation cannot support any of those, and copy is the place where an
 * over-claim would actually reach a reader. Every sentence names the *reference date* and the
 * *recorded* official date/date span, so the reader can see that this is a calendar comparison and
 * not a live booking state.
 */
export type OfficialReservationReferenceRelationPresentation = {
  recordId: string;
  placeId: string;
  relationText: string;
  referenceDateText: string;
};

export function describeOfficialReservationReferenceRelationForUi(
  relation: AssessedOfficialReservationReferenceRelation
): string {
  switch (relation.kind) {
    case "before-recorded-release-date":
      return "La fecha de referencia del dispositivo está antes de la fecha oficial registrada.";
    case "on-recorded-release-date":
      // Same civil-date label only — never "opens today", "already opened" or "not open yet".
      return "La fecha de referencia del dispositivo coincide con la fecha oficial registrada.";
    case "after-recorded-release-date":
      return "La fecha de referencia del dispositivo está después de la fecha oficial registrada.";
    case "before-recorded-application-date-span":
      return "La fecha de referencia del dispositivo está antes del tramo de fechas registrado para la solicitud.";
    case "within-recorded-application-date-span":
      // Inclusive calendar edges — never "last day", "closes today" or "still open".
      return "La fecha de referencia del dispositivo cae dentro del tramo de fechas registrado para la solicitud.";
    case "after-recorded-application-date-span":
      return "La fecha de referencia del dispositivo está después del tramo de fechas registrado para la solicitud.";
  }
}

/**
 * The device/browser source label is load-bearing, and so is the concrete date. This is the civil
 * date read from the reader's own device when the planner opened — not Japan's business date, not
 * the operator's date, and not a value that refreshes itself. Showing only "hoy"/"ahora" would
 * imply a freshness contract Phase 3F-H does not provide.
 */
export function formatOfficialReservationReferenceDateForUi(referenceDate: string): string {
  return `Fecha de referencia (tu dispositivo): ${formatCivilDateDisplay(referenceDate)}`;
}

/**
 * Fail-closed composition.
 *
 * A relation may only annotate the exact Phase 3F-F item it was evaluated from. If record, place or
 * scope disagree, the relation is dropped entirely: no nearest match, no place-level fallback, no
 * cross-scope sharing, no silent repair. Showing a correct sentence under the wrong official record
 * would be a worse failure than showing no relation at all.
 */
export function buildOfficialReservationReferenceRelationPresentation(
  presentation: OfficialReservationDatePresentation,
  relation: OfficialReservationReferenceRelation
): OfficialReservationReferenceRelationPresentation | null {
  if (relation.kind === "not-assessed") return null;
  if (
    relation.recordId !== presentation.recordId ||
    relation.placeId !== presentation.placeId ||
    relation.scope !== presentation.scope
  ) {
    return null;
  }
  return {
    recordId: presentation.recordId,
    placeId: presentation.placeId,
    relationText: describeOfficialReservationReferenceRelationForUi(relation),
    referenceDateText: formatOfficialReservationReferenceDateForUi(relation.referenceDate),
  };
}
