import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildOfficialReservationDatePresentation,
  describeReservationAllocationForUi,
  formatReservationMechanismProvenanceForUi,
  reservationMechanismScopeLabel,
} from "./reservation-mechanism-presentation";
import {
  deriveReservationMechanismDate,
  type ReservationMechanismDateDerivation,
} from "./reservation-mechanism-date-derivation";
import {
  reservationMechanismEvidenceRecords,
  type ReservationMechanismEvidenceRecord,
  type ReservationMechanismScope,
} from "./reservation-mechanism-evidence";

function record(placeId: string): ReservationMechanismEvidenceRecord {
  const found = reservationMechanismEvidenceRecords.find((item) => item.placeId === placeId);
  if (!found) throw new Error(`missing fixture ${placeId}`);
  return found;
}

const ghibli = record("JP-044");
const disneyland = record("JP-203");
const disneySea = record("JP-204");
const katsura = record("JP-077");
const sumo = record("JP-212");

describe("Phase 3F-F official reservation presentation", () => {
  it("labels every closed scope value explicitly", () => {
    const scopes: ReservationMechanismScope[] = [
      "general-admission",
      "park-admission",
      "guided-visit",
      "event-admission",
      "area-timed-entry",
      "workshop",
      "other-explicit",
    ];
    expect(scopes.map(reservationMechanismScopeLabel)).toEqual([
      "Entrada general",
      "Entrada al parque",
      "Visita guiada",
      "Entrada al evento",
      "Acceso a área con horario",
      "Taller / actividad",
      "Otro ámbito registrado",
    ]);
  });

  it("keeps allocation as disclosure and omits not-stated", () => {
    expect(describeReservationAllocationForUi("first-come")).toBe(
      "Asignación registrada: por orden de solicitud."
    );
    expect(describeReservationAllocationForUi("drawing")).toBe("Asignación registrada: sorteo.");
    expect(describeReservationAllocationForUi("lottery-if-oversubscribed")).toContain(
      "sorteo si las solicitudes superan el cupo"
    );
    expect(describeReservationAllocationForUi("capacity-limited")).toContain(
      "capacidad de venta limitada"
    );
    expect(describeReservationAllocationForUi("not-stated")).toBeNull();
  });

  it("renders Ghibli's real release fact with its recorded Asia/Tokyo label", () => {
    const result = buildOfficialReservationDatePresentation(
      ghibli,
      deriveReservationMechanismDate(ghibli, "2027-02-20")
    );
    expect(result).toMatchObject({
      kind: "release-date",
      scopeLabel: "Entrada general",
      heading: "Venta registrada para esta visita",
      sourceUrl: ghibli.provenance.sourceUrl,
    });
    expect(result?.detailLines[0]).toContain("10 ene 2027");
    expect(result?.detailLines[0]).toContain("10:00 (Asia/Tokyo)");
  });

  it("keeps Disney's recorded local time but discloses the null timezone", () => {
    const result = buildOfficialReservationDatePresentation(
      disneyland,
      deriveReservationMechanismDate(disneyland, "2027-02-20")
    );
    expect(result?.detailLines[0]).toContain("20 dic 2026");
    expect(result?.detailLines[0]).toContain("14:00");
    expect(result?.detailLines[0]).toContain("zona horaria no registrada");
    expect(result?.detailLines[0]).not.toContain("Asia/Tokyo");
    expect(result?.allocationText).toBe("La fuente indica capacidad de venta limitada.");
  });

  it("presents DisneySea's real missing-day fallback without exposing nominal invalid arithmetic", () => {
    const result = buildOfficialReservationDatePresentation(
      disneySea,
      deriveReservationMechanismDate(disneySea, "2027-04-30")
    );
    expect(result?.detailLines[0]).toContain("1 mar 2027");
    expect(JSON.stringify(result)).not.toContain("2027-02-30");
  });

  it("presents Katsura's two window edges independently and preserves lottery disclosure", () => {
    const result = buildOfficialReservationDatePresentation(
      katsura,
      deriveReservationMechanismDate(katsura, "2027-03-15")
    );
    expect(result).toMatchObject({
      kind: "application-window",
      heading: "Ventana oficial registrada para esta visita",
    });
    expect(result?.detailLines[0]).toContain("Inicio:");
    expect(result?.detailLines[0]).toContain("1 dic 2026");
    expect(result?.detailLines[0]).toContain("05:00");
    expect(result?.detailLines[1]).toContain("Fin registrado de la ventana:");
    expect(result?.detailLines[1]).toContain("12 mar 2027");
    expect(result?.detailLines[1]).toContain("23:59");
    expect(result?.detailLines.join(" ")).toContain("zona horaria no registrada");
    expect(result?.allocationText).toContain("sorteo si las solicitudes superan el cupo");
  });

  it("presents Sumo's fixed sale date without inventing a time", () => {
    const result = buildOfficialReservationDatePresentation(
      sumo,
      deriveReservationMechanismDate(sumo, "2027-03-20")
    );
    expect(result).toMatchObject({
      kind: "release-date",
      heading: "Inicio de venta oficial registrado para este evento",
      allocationText: null,
    });
    expect(result?.detailLines[0]).toContain("6 feb 2027");
    expect(result?.detailLines[0]).not.toMatch(/\b\d{2}:\d{2}\b/);
  });

  it("renders Sumo outside its recorded event period as neutral applicability evidence", () => {
    const result = buildOfficialReservationDatePresentation(
      sumo,
      deriveReservationMechanismDate(sumo, "2027-03-29")
    );
    expect(result).toMatchObject({
      kind: "not-applicable",
      heading: "El registro oficial de venta no aplica a la fecha de visita asignada.",
    });
    expect(result?.detailLines.join(" ")).toContain("fuera del periodo del evento registrado");
    expect(result?.detailLines.join(" ")).toContain("14 mar 2027");
    expect(result?.detailLines.join(" ")).toContain("28 mar 2027");
  });

  it("renders a restrained not-derivable state and never fabricates a date", () => {
    if (sumo.mechanism.kind !== "fixed-sale-date") throw new Error("expected fixed-sale-date fixture");
    const incomplete: ReservationMechanismEvidenceRecord = {
      ...sumo,
      id: "RM-JP-212-002",
      mechanism: {
        ...sumo.mechanism,
        appliesToStartDate: null,
        appliesToEndDate: null,
      },
    };
    const result = buildOfficialReservationDatePresentation(
      incomplete,
      deriveReservationMechanismDate(incomplete, "2027-03-20")
    );
    expect(result).toMatchObject({ kind: "not-derivable", detailLines: [] });
    expect(result?.heading).toContain("no se puede derivar una fecha aplicable");
  });

  it("omits inactive and no-visit-date derivations from the normal presentation", () => {
    const inactive = { ...ghibli, status: "superseded" } as ReservationMechanismEvidenceRecord;
    expect(
      buildOfficialReservationDatePresentation(
        inactive,
        deriveReservationMechanismDate(inactive, "2027-02-20")
      )
    ).toBeNull();
    expect(
      buildOfficialReservationDatePresentation(ghibli, deriveReservationMechanismDate(ghibli, null))
    ).toBeNull();
  });

  it("rejects provenance/result identity mismatches instead of cross-pairing records", () => {
    const derivation = deriveReservationMechanismDate(ghibli, "2027-02-20");
    expect(buildOfficialReservationDatePresentation(disneyland, derivation)).toBeNull();

    const wrongScope: ReservationMechanismDateDerivation =
      derivation.kind === "release-date"
        ? { ...derivation, scope: "workshop" }
        : derivation;
    expect(buildOfficialReservationDatePresentation(ghibli, wrongScope)).toBeNull();
  });

  it("keeps source entity, consultation date and source URL tied to the exact record", () => {
    const result = buildOfficialReservationDatePresentation(
      disneyland,
      deriveReservationMechanismDate(disneyland, "2027-02-20")
    );
    expect(result?.provenanceText).toContain("Tokyo Disney Resort");
    expect(result?.provenanceText).toContain("12 sept 2026");
    expect(result?.sourceUrl).toBe(disneyland.provenance.sourceUrl);
    expect(formatReservationMechanismProvenanceForUi(disneyland)).toBe(result?.provenanceText);
  });

  it("contains no clock/currentness/network/editorial-reservation dependency", async () => {
    const source = await readFile(new URL("./reservation-mechanism-presentation.ts", import.meta.url), "utf8");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "Date.now",
      "new Date(",
      "captureDeviceLocalCivilDate",
      "evaluateReservationWindowReference",
      "reservationReferenceDate",
      "fetch(",
      "XMLHttpRequest",
      "reservation.leadTime",
      "reservation.required",
      "febMar2027",
      "toISOString",
      "getTimezoneOffset",
    ]) {
      expect(codeOnly, forbidden).not.toContain(forbidden);
    }
  });

  it("does not emit action/currentness vocabulary", () => {
    const outputs = [
      buildOfficialReservationDatePresentation(
        ghibli,
        deriveReservationMechanismDate(ghibli, "2027-02-20")
      ),
      buildOfficialReservationDatePresentation(
        disneyland,
        deriveReservationMechanismDate(disneyland, "2027-02-20")
      ),
      buildOfficialReservationDatePresentation(
        katsura,
        deriveReservationMechanismDate(katsura, "2027-03-15")
      ),
      buildOfficialReservationDatePresentation(
        sumo,
        deriveReservationMechanismDate(sumo, "2027-03-20")
      ),
    ]
      .map((item) => JSON.stringify(item).toLowerCase())
      .join("\n");

    for (const forbidden of [
      "ya puedes comprar",
      "reserva ahora",
      "compra ahora",
      "última oportunidad",
      "se te pasó",
      "fecha límite",
      "reservas abiertas",
      "reservas cerradas",
      "venta abierta",
      "venta cerrada",
      "disponible",
      "no disponible",
      "quedan boletos",
      "te quedan",
      "urgente",
      "garantizada",
    ]) {
      expect(outputs, forbidden).not.toContain(forbidden);
    }
  });
});
