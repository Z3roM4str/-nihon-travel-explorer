import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = new URL("./OrderedSequenceBuilder.tsx", import.meta.url);

async function readSource(): Promise<string> {
  return readFile(SOURCE_PATH, "utf8");
}

function extractReservationDeadlineNoticeSource(fullSource: string): string {
  const start = fullSource.indexOf("function ReservationDeadlineNotice");
  if (start === -1) throw new Error("ReservationDeadlineNotice not found");
  const end = fullSource.indexOf("const RESERVATION_PREP_LABEL", start);
  if (end === -1) throw new Error("ReservationDeadlineNotice end boundary not found");
  return fullSource.slice(start, end);
}

describe("OrderedSequenceBuilder.tsx — Phase 3D-O reference-date relation wiring", () => {
  it("imports the reference-date domain and presentation adapters", async () => {
    const source = await readSource();
    expect(source).toContain("captureDeviceLocalCivilDate");
    expect(source).toContain("evaluateReservationWindowReference");
    expect(source).toContain("describeReservationWindowReferenceForUi");
    expect(source).toContain("formatDeviceReferenceDateForUi");
  });

  it("captures one device-local reference date when the planner instance opens", async () => {
    const source = await readSource();
    expect(source).toContain(
      "const [reservationReferenceDate] = useState<string | null>(() => captureDeviceLocalCivilDate());"
    );
    expect(source).not.toContain("setInterval(");
    expect(source).not.toContain("setTimeout(");
  });

  it("passes the captured date into the existing ReservationDeadlineNotice surface", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /<ReservationDeadlineNotice[\s\S]*?referenceDate=\{reservationReferenceDate\}[\s\S]*?\/>/
    );
    expect((source.match(/role="dialog"/g) ?? []).length).toBe(1);
  });

  it("evaluates only after Phase 3D-H produced a derived window", async () => {
    const notice = extractReservationDeadlineNoticeSource(await readSource());
    const gate = notice.indexOf('if (window.kind !== "derived-window") continue;');
    const relation = notice.indexOf("evaluateReservationWindowReference(window, referenceDate)");
    expect(gate).toBeGreaterThan(-1);
    expect(relation).toBeGreaterThan(gate);
  });

  it("shows the exact device reference date, neutral relation copy, and original raw evidence", async () => {
    const notice = extractReservationDeadlineNoticeSource(await readSource());
    expect(notice).toContain("formatDeviceReferenceDateForUi(referenceDate)");
    expect(notice).toContain("describeReservationWindowReferenceForUi(relation)");
    expect(notice).toContain("Dato: «{window.signal.raw}»");
    expect(notice).toContain("no representa la fecha operativa en Japón");
    expect(notice).toContain("no se actualiza automáticamente");
  });

  it("does not introduce stronger booking-state or urgency copy", async () => {
    const notice = extractReservationDeadlineNoticeSource(await readSource());
    for (const forbidden of [
      "Ya puedes reservar",
      "Reserva ahora",
      "Última oportunidad",
      "Se te pasó la fecha límite",
      "Reservas abiertas",
      "Reservas cerradas",
      "Book now",
      "Too late",
    ]) {
      expect(notice, forbidden).not.toContain(forbidden);
    }
  });

  it("keeps the reference date out of persistence APIs", async () => {
    const notice = extractReservationDeadlineNoticeSource(await readSource());
    expect(notice).not.toContain("localStorage");
    expect(notice).not.toContain("sessionStorage");
    expect(notice).not.toContain("setStartDate(referenceDate");
  });
});
