import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  formatOfficialReservationCalendarSpanForUi,
  OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE,
} from "./reservation-mechanism-calendar-presentation";
import { deriveReservationMechanismDate } from "./reservation-mechanism-date-derivation";
import {
  reservationMechanismEvidenceRecords,
  type ReservationMechanismEvidenceRecord,
} from "./reservation-mechanism-evidence";

const MODULE_SOURCE = new URL("./reservation-mechanism-calendar-presentation.ts", import.meta.url);

function record(placeId: string): ReservationMechanismEvidenceRecord {
  const found = reservationMechanismEvidenceRecords.find((item) => item.placeId === placeId);
  if (!found) throw new Error(`missing record ${placeId}`);
  return found;
}

const katsuraWindow = deriveReservationMechanismDate(record("JP-077"), "2027-03-15");
if (katsuraWindow.kind !== "application-window") throw new Error("unexpected derivation");

describe("Phase 3F-J span rendering", () => {
  it("renders Katsura's two recorded edges as one neutral span", () => {
    expect(formatOfficialReservationCalendarSpanForUi(katsuraWindow)).toBe(
      "mar, 1 dic 2026 · 05:00 · zona horaria no registrada en la evidencia estructurada → " +
        "vie, 12 mar 2027 · 23:59 · zona horaria no registrada en la evidencia estructurada"
    );
  });

  it("keeps a recorded Asia/Tokyo edge labelled exactly as Phase 3F-F labels it", () => {
    const tokyoEdges = {
      ...katsuraWindow,
      openSourceTimeZone: "Asia/Tokyo" as const,
      closeSourceTimeZone: "Asia/Tokyo" as const,
    };
    const text = formatOfficialReservationCalendarSpanForUi(tokyoEdges);
    expect(text).toContain("05:00 (Asia/Tokyo)");
    expect(text).toContain("23:59 (Asia/Tokyo)");
    expect(text).not.toContain("zona horaria no registrada");
  });

  it("omits an absent recorded time without inventing one", () => {
    const noTimes = { ...katsuraWindow, openTimeLocal: null, closeTimeLocal: null };
    const text = formatOfficialReservationCalendarSpanForUi(noTimes);
    expect(text).toBe("mar, 1 dic 2026 → vie, 12 mar 2027");
    expect(text).not.toMatch(/\d{2}:\d{2}/);
  });

  it("always shows both edges, never one alone", () => {
    const text = formatOfficialReservationCalendarSpanForUi(katsuraWindow);
    expect(text).toContain("1 dic 2026");
    expect(text).toContain("12 mar 2027");
    expect(text.split("→")).toHaveLength(2);
  });

  it("uses a neutral directional connector and no single-edge framing", () => {
    const text = formatOfficialReservationCalendarSpanForUi(katsuraWindow).toLowerCase();
    for (const forbidden of ["hasta el", "antes del", "límite", "cierra", "último", "vence", "fin de plazo"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });
});

describe("Phase 3F-J anchor note", () => {
  it("states why the row sits where it does, without a deadline claim", () => {
    expect(OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE).toBe(
      "Situado en esta lista por la fecha de inicio registrada del tramo."
    );
    const lower = OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE.toLowerCase();
    for (const forbidden of [
      "fecha límite",
      "deadline",
      "cierra",
      "último día",
      "vence",
      "prioridad",
      "urgente",
      "abierta",
      "cerrada",
      "disponible",
    ]) {
      expect(lower, forbidden).not.toContain(forbidden);
    }
  });
});

describe("Phase 3F-J presentation source boundary", () => {
  it("reuses Phase 3F-F's formatter rather than duplicating date/time rendering", async () => {
    const source = await readFile(MODULE_SOURCE, "utf8");
    expect(source).toContain('import { formatRecordedDateTime } from "./reservation-mechanism-presentation"');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "Asia/Tokyo",
      "zona horaria no registrada",
      "formatCivilDateDisplay",
      "Intl",
      "new Date(",
      "Date.now(",
      "localStorage",
      "fetch(",
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });
});
