import type { ReservationMechanismDateDerivation } from "./reservation-mechanism-date-derivation";
import { formatRecordedDateTime } from "./reservation-mechanism-presentation";

/**
 * Phase 3F-J presentation boundary — deliberately tiny.
 *
 * The route-wide calendar reuses Phase 3F-F's presentation for everything it can. Exactly one row
 * element has no existing equivalent: an application window rendered as a single chronological row
 * must show BOTH recorded edges together as one span, and must disclose why that row sits where it
 * does in the chronology (Phase 3F-I §24.4).
 *
 * Neither piece of copy introduces a new claim. The span is two recorded dates joined by a neutral
 * directional connector — never "hasta el", "antes del", "cierra el", a deadline, a last day or a
 * due date — and the anchor note states a fact about the list's ordering, not about the reservation.
 */

type ApplicationWindowDerivation = Extract<
  ReservationMechanismDateDerivation,
  { kind: "application-window" }
>;

/**
 * The recorded span as one line, e.g. `1 dic 2026 · 05:00 → 12 mar 2027 · 23:59`.
 *
 * Both edges always render, with their recorded local times and the recorded timezone disclosure,
 * through Phase 3F-F's own formatter. The close edge is never omitted, truncated or shown alone,
 * and no separate close-date row is ever synthesised anywhere.
 */
export function formatOfficialReservationCalendarSpanForUi(
  derivation: ApplicationWindowDerivation
): string {
  const open = formatRecordedDateTime(
    derivation.openDate,
    derivation.openTimeLocal,
    derivation.openSourceTimeZone
  );
  const close = formatRecordedDateTime(
    derivation.closeDate,
    derivation.closeTimeLocal,
    derivation.closeSourceTimeZone
  );
  return `${open} → ${close}`;
}

/**
 * Why a span row sits at its chronological position. Load-bearing: without it a reader could think
 * the row's place in the list says something about the window's end, which it does not.
 */
export const OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE =
  "Situado en esta lista por la fecha de inicio registrada del tramo.";
