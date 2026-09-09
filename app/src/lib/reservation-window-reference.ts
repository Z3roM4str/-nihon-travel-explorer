import { isValidCivilDate } from "./civil-date";
import type { ReservationDateWindow } from "./reservation-deadline";

/**
 * Phase 3D-O — Reservation Window Reference-Date Relation.
 *
 * This module implements the narrow proposition approved by Phase 3D-N:
 * given one explicit civil reference date and an already-derived Phase 3D-H
 * `ReservationDateWindow`, classify only where that reference date falls relative to the
 * recorded advance-guidance window.
 *
 * It deliberately does NOT answer whether booking is open/closed, whether inventory exists,
 * whether the user is late, whether they should act now, or what date a Japanese operator
 * considers to be "today". The evaluator is pure and receives the reference date explicitly;
 * the device clock is captured only by `captureDeviceLocalCivilDate` at the application boundary.
 */

export type ReservationWindowReferenceRelation =
  | {
      kind: "not-assessed";
      reason: "invalid-reference-date" | "no-derived-window";
    }
  | {
      kind: "before-recorded-window";
      referenceDate: string;
      window: Extract<ReservationDateWindow, { kind: "derived-window" }>;
    }
  | {
      kind: "within-recorded-window";
      referenceDate: string;
      window: Extract<ReservationDateWindow, { kind: "derived-window" }>;
    }
  | {
      kind: "after-recorded-window";
      referenceDate: string;
      window: Extract<ReservationDateWindow, { kind: "derived-window" }>;
    };

/**
 * Pure relation evaluator. Phase 3D-H remains the sole owner of lead-time parsing and window
 * derivation; this function consumes that result as-is and never reparses `reservation.leadTime`.
 *
 * Because every valid civil date is normalized to fixed-width `YYYY-MM-DD`, lexical ordering is
 * identical to calendar ordering after validation. Both recorded bounds are inclusive.
 */
export function evaluateReservationWindowReference(
  window: ReservationDateWindow,
  referenceDate: string
): ReservationWindowReferenceRelation {
  if (!isValidCivilDate(referenceDate)) {
    return { kind: "not-assessed", reason: "invalid-reference-date" };
  }
  if (window.kind !== "derived-window") {
    return { kind: "not-assessed", reason: "no-derived-window" };
  }

  if (referenceDate < window.farAdvanceDate) {
    return { kind: "before-recorded-window", referenceDate, window };
  }
  if (referenceDate > window.nearAdvanceDate) {
    return { kind: "after-recorded-window", referenceDate, window };
  }
  return { kind: "within-recorded-window", referenceDate, window };
}

/**
 * Application-boundary adapter for a device-local civil date.
 *
 * The injected/default `Date` is read through LOCAL calendar getters only. Using UTC getters or
 * serializing through ISO would silently produce the wrong civil day near local midnight in many
 * timezones. The returned value is explicitly a device/reference date — never a Japan business
 * date — and is not persisted by this module.
 */
export function captureDeviceLocalCivilDate(now: Date = new Date()): string | null {
  if (Number.isNaN(now.getTime())) return null;

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const civilDate = `${yyyy}-${mm}-${dd}`;

  return isValidCivilDate(civilDate) ? civilDate : null;
}
