import type { Place } from "../types";
import type { DayAssignment } from "./day-assignment";
import { interpretPlaceReservation } from "./reservation";
import { buildReservationPreparationSummary } from "./reservation-planning";
import { derivePlaceReservationDateWindow, deriveVisitDateForPlace } from "./reservation-deadline";
import { reservationMechanismEvidenceRecords } from "./reservation-mechanism-evidence";
import { deriveReservationMechanismDatesForPlannedPlace } from "./reservation-mechanism-date-derivation";

/** B31 display ordering only. Domain facts and the official chronological calendar stay unchanged. */
export function buildTripReservationRows(places: readonly Place[], assignment: DayAssignment, startDate: string | null) {
  const preparation = buildReservationPreparationSummary(places);
  const rows = places.flatMap((place) => {
    const reservation = interpretPlaceReservation(place);
    const prep = preparation.items.find((item) => item.placeId === place.id) ?? null;
    const records = reservationMechanismEvidenceRecords.filter((record) => record.placeId === place.id);
    if (!prep && records.length === 0 && ["not-required", "not-required-role-specific"].includes(reservation.category)) return [];
    const visitDate = deriveVisitDateForPlace(assignment, startDate, place.id);
    const window = derivePlaceReservationDateWindow(place, visitDate);
    const official = deriveReservationMechanismDatesForPlannedPlace(reservationMechanismEvidenceRecords, assignment, startDate, place.id);
    const officialDates = official.flatMap((fact) => fact.kind === "application-window"
      ? [{ date: fact.closeDate, label: "Cierre de solicitudes" }]
      : fact.kind === "release-date" ? [{ date: fact.releaseDate, label: "Apertura de venta" }] : []);
    // Editorial anticipation is a reference, never silently promoted to an official deadline.
    const dates = officialDates.length ? officialDates : window.kind === "derived-window"
      ? [{ date: window.nearAdvanceDate, label: "Referencia de anticipación" }] : [];
    const next = dates.toSorted((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    return [{ place, reservation, prep, records, window, official, visitDate,
      dayNumber: assignment.days.findIndex((day) => day.placeIds.includes(place.id)) + 1,
      urgencyDate: next?.date ?? null, urgencyLabel: next?.label ?? null }];
  });
  return rows.toSorted((a, b) => {
    if (a.urgencyDate !== b.urgencyDate) {
      if (a.urgencyDate === null) return 1;
      if (b.urgencyDate === null) return -1;
      return a.urgencyDate.localeCompare(b.urgencyDate);
    }
    return a.place.name.localeCompare(b.place.name, "es") || a.place.id.localeCompare(b.place.id);
  });
}

export type TripReservationRow = ReturnType<typeof buildTripReservationRows>[number];
