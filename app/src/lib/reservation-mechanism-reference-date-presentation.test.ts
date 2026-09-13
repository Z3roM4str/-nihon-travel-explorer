import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildOfficialReservationReferenceRelationPresentation,
  describeOfficialReservationReferenceRelationForUi,
  formatOfficialReservationReferenceDateForUi,
} from "./reservation-mechanism-reference-date-presentation";
import {
  evaluateOfficialReservationReferenceDate,
  type AssessedOfficialReservationReferenceRelation,
} from "./reservation-mechanism-reference-date";
import {
  buildOfficialReservationDatePresentation,
  type OfficialReservationDatePresentation,
} from "./reservation-mechanism-presentation";
import { deriveReservationMechanismDate } from "./reservation-mechanism-date-derivation";
import {
  reservationMechanismEvidenceRecords,
  type ReservationMechanismEvidenceRecord,
} from "./reservation-mechanism-evidence";

const MODULE_SOURCE = new URL("./reservation-mechanism-reference-date-presentation.ts", import.meta.url);

function record(placeId: string): ReservationMechanismEvidenceRecord {
  const found = reservationMechanismEvidenceRecords.find((item) => item.placeId === placeId);
  if (!found) throw new Error(`missing fixture ${placeId}`);
  return found;
}

const ghibli = record("JP-044");
const katsura = record("JP-077");
const sumo = record("JP-212");

function compose(
  evidence: ReservationMechanismEvidenceRecord,
  visitDate: string | null,
  referenceDate: string
) {
  const derivation = deriveReservationMechanismDate(evidence, visitDate);
  const presentation = buildOfficialReservationDatePresentation(evidence, derivation);
  if (!presentation) throw new Error("expected a presentable Phase 3F-F item");
  const relation = evaluateOfficialReservationReferenceDate(derivation, referenceDate);
  return { presentation, relation };
}

describe("Phase 3F-H relation copy", () => {
  const assessed = (
    kind: AssessedOfficialReservationReferenceRelation["kind"]
  ): AssessedOfficialReservationReferenceRelation =>
    kind.includes("application")
      ? ({
          kind,
          recordId: "RM-JP-077-001",
          placeId: "JP-077",
          scope: "guided-visit",
          referenceDate: "2027-01-15",
          openDate: "2026-12-01",
          closeDate: "2027-03-12",
        } as AssessedOfficialReservationReferenceRelation)
      : ({
          kind,
          recordId: "RM-JP-044-001",
          placeId: "JP-044",
          scope: "general-admission",
          referenceDate: "2027-01-10",
          releaseDate: "2027-01-10",
        } as AssessedOfficialReservationReferenceRelation);

  it("describes every release relation relationally", () => {
    expect(describeOfficialReservationReferenceRelationForUi(assessed("before-recorded-release-date"))).toBe(
      "La fecha de referencia del dispositivo está antes de la fecha oficial registrada."
    );
    expect(describeOfficialReservationReferenceRelationForUi(assessed("on-recorded-release-date"))).toBe(
      "La fecha de referencia del dispositivo coincide con la fecha oficial registrada."
    );
    expect(describeOfficialReservationReferenceRelationForUi(assessed("after-recorded-release-date"))).toBe(
      "La fecha de referencia del dispositivo está después de la fecha oficial registrada."
    );
  });

  it("describes every application date-span relation relationally", () => {
    expect(
      describeOfficialReservationReferenceRelationForUi(assessed("before-recorded-application-date-span"))
    ).toBe(
      "La fecha de referencia del dispositivo está antes del tramo de fechas registrado para la solicitud."
    );
    expect(
      describeOfficialReservationReferenceRelationForUi(assessed("within-recorded-application-date-span"))
    ).toBe(
      "La fecha de referencia del dispositivo cae dentro del tramo de fechas registrado para la solicitud."
    );
    expect(
      describeOfficialReservationReferenceRelationForUi(assessed("after-recorded-application-date-span"))
    ).toBe(
      "La fecha de referencia del dispositivo está después del tramo de fechas registrado para la solicitud."
    );
  });

  it("never uses open/closed, availability, urgency or action vocabulary", () => {
    const kinds: AssessedOfficialReservationReferenceRelation["kind"][] = [
      "before-recorded-release-date",
      "on-recorded-release-date",
      "after-recorded-release-date",
      "before-recorded-application-date-span",
      "within-recorded-application-date-span",
      "after-recorded-application-date-span",
    ];
    const allCopy = kinds
      .map((kind) => describeOfficialReservationReferenceRelationForUi(assessed(kind)))
      .join(" ")
      .toLowerCase();
    for (const forbidden of [
      "abierta",
      "abiertas",
      "cerrada",
      "cerradas",
      "ya abrió",
      "todavía no",
      "disponible",
      "agotado",
      "boletos",
      "entradas disponibles",
      "fecha límite",
      "deadline",
      "última oportunidad",
      "compra",
      "reserva ahora",
      "urgente",
      "quedan",
      "faltan",
      "hoy",
      "ahora",
      "actualmente",
      "tarde",
      "cierra",
      "último día",
      "puedes",
    ]) {
      expect(allCopy, forbidden).not.toContain(forbidden);
    }
  });
});

describe("Phase 3F-H reference-date disclosure", () => {
  it("names the device source and shows the concrete date", () => {
    expect(formatOfficialReservationReferenceDateForUi("2027-01-10")).toBe(
      "Fecha de referencia (tu dispositivo): dom, 10 ene 2027"
    );
  });

  it("shows a concrete date rather than a bare currentness word", () => {
    const text = formatOfficialReservationReferenceDateForUi("2026-09-12").toLowerCase();
    expect(text).toContain("2026");
    expect(text).toContain("tu dispositivo");
    for (const forbidden of ["hoy", "ahora", "actualmente"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });
});

describe("Phase 3F-H composition — real fixtures", () => {
  it("annotates Ghibli's same-date relation without any open-state claim", () => {
    const { presentation, relation } = compose(ghibli, "2027-02-20", "2027-01-10");
    const composed = buildOfficialReservationReferenceRelationPresentation(presentation, relation);
    expect(composed).toEqual({
      recordId: "RM-JP-044-001",
      placeId: "JP-044",
      relationText: "La fecha de referencia del dispositivo coincide con la fecha oficial registrada.",
      referenceDateText: "Fecha de referencia (tu dispositivo): dom, 10 ene 2027",
    });
    // The recorded 10:00 Asia/Tokyo evidence stays on the Phase 3F-F fact line, untouched.
    expect(presentation.detailLines[0]).toContain("10:00 (Asia/Tokyo)");
    expect(composed?.relationText).not.toContain("10:00");
  });

  it("annotates Katsura's inclusive close edge as a date span, not a closing day", () => {
    const { presentation, relation } = compose(katsura, "2027-03-15", "2027-03-12");
    const composed = buildOfficialReservationReferenceRelationPresentation(presentation, relation);
    expect(composed?.relationText).toContain("cae dentro del tramo de fechas registrado");
    expect(composed?.referenceDateText).toContain("12 mar 2027");
    expect(presentation.detailLines[1]).toContain("23:59");
  });

  it("does not annotate a Sumo item outside the recorded event period", () => {
    const { presentation, relation } = compose(sumo, "2027-03-29", "2027-02-06");
    expect(presentation.kind).toBe("not-applicable");
    expect(relation).toEqual({ kind: "not-assessed", reason: "derivation-not-date-relatable" });
    expect(buildOfficialReservationReferenceRelationPresentation(presentation, relation)).toBeNull();
  });

  it("drops an unassessable relation from an invalid reference date", () => {
    const { presentation, relation } = compose(ghibli, "2027-02-20", "2027-02-30");
    expect(relation).toEqual({ kind: "not-assessed", reason: "invalid-reference-date" });
    expect(buildOfficialReservationReferenceRelationPresentation(presentation, relation)).toBeNull();
  });
});

describe("Phase 3F-H composition fails closed on identity mismatch", () => {
  const { presentation, relation } = compose(ghibli, "2027-02-20", "2027-01-09");

  it("accepts only the exact matching item", () => {
    expect(buildOfficialReservationReferenceRelationPresentation(presentation, relation)).not.toBeNull();
  });

  it("rejects a mismatched recordId", () => {
    const mismatched: OfficialReservationDatePresentation = {
      ...presentation,
      recordId: "RM-JP-203-001",
    };
    expect(buildOfficialReservationReferenceRelationPresentation(mismatched, relation)).toBeNull();
  });

  it("rejects a mismatched placeId", () => {
    const mismatched: OfficialReservationDatePresentation = { ...presentation, placeId: "JP-203" };
    expect(buildOfficialReservationReferenceRelationPresentation(mismatched, relation)).toBeNull();
  });

  it("rejects a mismatched scope", () => {
    const mismatched: OfficialReservationDatePresentation = {
      ...presentation,
      scope: "park-admission",
    };
    expect(buildOfficialReservationReferenceRelationPresentation(mismatched, relation)).toBeNull();
  });

  it("never borrows a relation from another real record in the same plan", () => {
    const katsuraSide = compose(katsura, "2027-03-15", "2027-01-09");
    expect(
      buildOfficialReservationReferenceRelationPresentation(presentation, katsuraSide.relation)
    ).toBeNull();
    expect(
      buildOfficialReservationReferenceRelationPresentation(katsuraSide.presentation, relation)
    ).toBeNull();
  });
});

describe("Phase 3F-H presentation source boundary", () => {
  it("reads no clock, converts no timezone and reaches no storage or network", async () => {
    const source = await readFile(MODULE_SOURCE, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "Date.now(",
      "new Date(",
      "Intl",
      "getTimezoneOffset",
      "Asia/Tokyo",
      "localStorage",
      "sessionStorage",
      "fetch(",
      "evaluateReservationWindowReference",
      "describeReservationWindowReferenceForUi",
      "formatDeviceReferenceDateForUi",
      "leadTime",
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });
});
