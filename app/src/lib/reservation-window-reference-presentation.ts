import type { ReservationWindowReferenceRelation } from "./reservation-window-reference";

type AssessedReservationWindowReferenceRelation = Exclude<
  ReservationWindowReferenceRelation,
  { kind: "not-assessed" }
>;

/**
 * Phase 3D-O presentation vocabulary. These sentences deliberately describe only the relation of
 * the disclosed reference date to the recorded advance-guidance window. They are informational,
 * not success/failure states, and make no claim about booking policy or inventory.
 */
export function describeReservationWindowReferenceForUi(
  relation: AssessedReservationWindowReferenceRelation
): string {
  switch (relation.kind) {
    case "before-recorded-window":
      return "La fecha de referencia está antes de la ventana de anticipación registrada.";
    case "within-recorded-window":
      return "La fecha de referencia cae dentro de la ventana de anticipación registrada.";
    case "after-recorded-window":
      return "La fecha de referencia está después de la ventana de anticipación registrada.";
  }
}

/** The source label is load-bearing: this is the device's civil date, not Japan business time. */
export function formatDeviceReferenceDateForUi(referenceDate: string): string {
  return `Fecha de referencia (tu dispositivo): ${referenceDate}`;
}
