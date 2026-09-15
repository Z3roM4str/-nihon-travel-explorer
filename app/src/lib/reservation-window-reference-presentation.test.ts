import { describe, expect, it } from "vitest";
import type { ReservationDateWindow } from "./reservation-deadline";
import {
  describeReservationWindowReferenceForUi,
  formatDeviceReferenceDateForUi,
} from "./reservation-window-reference-presentation";
import type { ReservationWindowReferenceRelation } from "./reservation-window-reference";

const WINDOW: Extract<ReservationDateWindow, { kind: "derived-window" }> = {
  kind: "derived-window",
  visitDate: "2027-03-15",
  farAdvanceDate: "2027-03-01",
  nearAdvanceDate: "2027-03-08",
  signal: {
    kind: "explicit-lead-window",
    minLeadDays: 7,
    maxLeadDays: 14,
    raw: "1–2 semanas",
  },
};

function relation(
  kind: Exclude<ReservationWindowReferenceRelation["kind"], "not-assessed">
): Exclude<ReservationWindowReferenceRelation, { kind: "not-assessed" }> {
  return { kind, referenceDate: "2026-09-08", window: WINDOW } as Exclude<
    ReservationWindowReferenceRelation,
    { kind: "not-assessed" }
  >;
}

describe("reservation-window-reference presentation", () => {
  it("uses the approved neutral before/within/after copy families", () => {
    expect(describeReservationWindowReferenceForUi(relation("before-recorded-window"))).toBe(
      "La fecha de referencia está antes de la ventana de anticipación registrada."
    );
    expect(describeReservationWindowReferenceForUi(relation("within-recorded-window"))).toBe(
      "La fecha de referencia cae dentro de la ventana de anticipación registrada."
    );
    expect(describeReservationWindowReferenceForUi(relation("after-recorded-window"))).toBe(
      "La fecha de referencia está después de la ventana de anticipación registrada."
    );
  });

  it("labels the concrete date as device/reference state", () => {
    expect(formatDeviceReferenceDateForUi("2026-09-08")).toBe(
      "Fecha de referencia (tu dispositivo): 2026-09-08"
    );
  });

  it("contains none of the prohibited booking/urgency/availability claims", () => {
    const copy = [
      describeReservationWindowReferenceForUi(relation("before-recorded-window")),
      describeReservationWindowReferenceForUi(relation("within-recorded-window")),
      describeReservationWindowReferenceForUi(relation("after-recorded-window")),
      formatDeviceReferenceDateForUi("2026-09-08"),
    ]
      .join(" ")
      .toLowerCase();

    for (const forbidden of [
      "ya puedes reservar",
      "reserva ahora",
      "última oportunidad",
      "fecha límite",
      "reservas abiertas",
      "reservas cerradas",
      "disponible",
      "no disponible",
      "urgente",
      "book now",
      "last chance",
    ]) {
      expect(copy, forbidden).not.toContain(forbidden);
    }
  });
});
