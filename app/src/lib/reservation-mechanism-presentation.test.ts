import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildOfficialReservationDatePresentation,
  describeReservationAllocationForUi,
  describeReservationPurchaseResidenceContextForUi,
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
const nintendo = record("JP-097");
const pokepark = record("JP-050");
const pokeparkDomestic = reservationMechanismEvidenceRecords.find((item) => item.id === "RM-JP-050-002")!;

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

  it("renders purchase residence context as route evidence, never as user eligibility", () => {
    expect(describeReservationPurchaseResidenceContextForUi("not-recorded")).toBeNull();
    expect(describeReservationPurchaseResidenceContextForUi("resides-in-japan")).toBe(
      "La fuente oficial citada presenta esta ruta de compra para residentes en Japón."
    );
    expect(describeReservationPurchaseResidenceContextForUi("resides-outside-japan")).toBe(
      "La fuente oficial citada dirige a quienes residen fuera de Japón a esta ruta de compra."
    );
    const wording = [
      describeReservationPurchaseResidenceContextForUi("resides-in-japan"),
      describeReservationPurchaseResidenceContextForUi("resides-outside-japan"),
    ].join(" ").toLowerCase();
    for (const forbidden of ["aplica para ti", "eres residente", "eres elegible", "puedes comprar"]) {
      expect(wording).not.toContain(forbidden);
    }
  });

  it("keeps purchase residence presentation compile-time exhaustive with no fallback branch", async () => {
    const source = await readFile(new URL("./reservation-mechanism-presentation.ts", import.meta.url), "utf8");
    expect(source).toMatch(
      /const PURCHASE_RESIDENCE_CONTEXT_LABEL:\s*Record<\s*ReservationPurchaseResidenceContext,\s*string \| null\s*>/
    );
    expect(source).toContain('return PURCHASE_RESIDENCE_CONTEXT_LABEL[context];');
    const helperStart = source.indexOf(
      "export function describeReservationPurchaseResidenceContextForUi"
    );
    const nextFunction = source.indexOf("\nfunction ", helperStart);
    const helper = source.slice(helperStart, nextFunction);
    expect(helper).not.toContain('if (context ===');
    expect(helper).not.toMatch(/return\s+["']/);
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
      purchaseResidenceContextText: null,
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

  it("presents Nintendo Museum's derived monthly drawing window neutrally", () => {
    const result = buildOfficialReservationDatePresentation(
      nintendo,
      deriveReservationMechanismDate(nintendo, "2027-03-15")
    );
    expect(result).toMatchObject({
      kind: "application-window",
      scopeLabel: "Entrada general",
      heading: "Ventana oficial registrada para esta visita",
      allocationText: "Asignación registrada: sorteo.",
    });
    expect(result?.detailLines[0]).toContain("1 dic 2026");
    expect(result?.detailLines[1]).toContain("31 dic 2026");
    expect(result?.detailLines.join(" ")).not.toContain("zona horaria no registrada");
  });

  it("presents PokéPark overseas with the recorded 20:00 Asia/Tokyo open edge only", () => {
    const result = buildOfficialReservationDatePresentation(
      pokepark,
      deriveReservationMechanismDate(pokepark, "2027-03-15")
    );
    expect(result).toMatchObject({
      kind: "application-window",
      scopeLabel: "Entrada general",
      heading: "Ventana oficial registrada para esta visita",
      allocationText: "Asignación registrada: sorteo.",
      purchaseResidenceContextText:
        "La fuente oficial citada dirige a quienes residen fuera de Japón a esta ruta de compra.",
      sourceUrl: "https://ticket-en.pokepark-kanto.co.jp/?viewLang=en",
    });
    expect(result?.detailLines[0]).toContain("1 dic 2026");
    expect(result?.detailLines[0]).toContain("20:00 (Asia/Tokyo)");
    expect(result?.detailLines[1]).toContain("12 dic 2026");
    expect(result?.detailLines[1]).not.toMatch(/\b\d{2}:\d{2}\b/);
    expect(result?.detailLines[1]).not.toContain("Asia/Tokyo");
    expect(result?.provenanceText).toContain("outside-Japan");
    expect(result?.provenanceText).toContain("14 sept 2026");
  });

  it("returns null before formatting a synthetic inverted application window", () => {
    const derivation: ReservationMechanismDateDerivation = {
      kind: "application-window",
      recordId: katsura.id,
      placeId: katsura.placeId,
      scope: katsura.scope,
      visitDate: "2027-03-31",
      openDate: "2027-02-01",
      openTimeLocal: null,
      openSourceTimeZone: null,
      closeDate: "2027-01-30",
      closeTimeLocal: null,
      closeSourceTimeZone: null,
      allocation: "lottery-if-oversubscribed",
    };
    expect(buildOfficialReservationDatePresentation(katsura, derivation)).toBeNull();
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
      buildOfficialReservationDatePresentation(
        nintendo,
        deriveReservationMechanismDate(nintendo, "2027-03-15")
      ),
      buildOfficialReservationDatePresentation(
        pokepark,
        deriveReservationMechanismDate(pokepark, "2027-03-15")
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

describe("Phase 3F-S — same-scope presentation reuses the existing contract", () => {
  it("renders the domestic route through the existing resides-in-japan copy", () => {
    const result = buildOfficialReservationDatePresentation(
      pokeparkDomestic,
      deriveReservationMechanismDate(pokeparkDomestic, "2027-03-15")
    );
    expect(result).toMatchObject({
      recordId: "RM-JP-050-002",
      placeId: "JP-050",
      scope: "general-admission",
      scopeLabel: "Entrada general",
      heading: "Ventana oficial registrada para esta visita",
      allocationText: "Asignación registrada: sorteo.",
      purchaseResidenceContextText:
        "La fuente oficial citada presenta esta ruta de compra para residentes en Japón.",
      sourceUrl: "https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index",
    });
    // The exact string Phase 3F-P already owns — Phase 3F-S adds no copy of its own.
    expect(result?.purchaseResidenceContextText).toBe(
      describeReservationPurchaseResidenceContextForUi("resides-in-japan")
    );
  });

  it("keeps both same-scope presentations distinct and record-local", () => {
    const overseas = buildOfficialReservationDatePresentation(
      pokepark,
      deriveReservationMechanismDate(pokepark, "2027-03-15")
    );
    const domestic = buildOfficialReservationDatePresentation(
      pokeparkDomestic,
      deriveReservationMechanismDate(pokeparkDomestic, "2027-03-15")
    );
    expect(overseas?.recordId).toBe("RM-JP-050-001");
    expect(domestic?.recordId).toBe("RM-JP-050-002");
    expect(overseas?.purchaseResidenceContextText).not.toBe(domestic?.purchaseResidenceContextText);
    expect(overseas?.sourceUrl).not.toBe(domestic?.sourceUrl);
    // Same scope, same heading, same detail lines: nothing is disambiguated by inventing a label.
    expect(overseas?.scopeLabel).toBe(domestic?.scopeLabel);
    expect(overseas?.heading).toBe(domestic?.heading);
    expect(overseas?.detailLines).toEqual(domestic?.detailLines);
  });

  it("makes no personal residence or eligibility claim for either route", () => {
    const rendered = [pokepark, pokeparkDomestic]
      .map((item) => buildOfficialReservationDatePresentation(item, deriveReservationMechanismDate(item, "2027-03-15")))
      .map((item) => JSON.stringify(item))
      .join(" ")
      .toLowerCase();
    for (const forbidden of [
      "aplica para ti",
      "no aplica para ti",
      "eres residente",
      "no eres residente",
      "eres elegible",
      "no eres elegible",
      "puedes comprar",
      "no puedes comprar",
      "para ti",
      "recomend",
    ]) {
      expect(rendered).not.toContain(forbidden);
    }
  });

  it("adds no new presentation field for same-scope composition", async () => {
    const source = await readFile(new URL("./reservation-mechanism-presentation.ts", import.meta.url), "utf8");
    for (const forbidden of [
      "sameScope",
      "collision",
      "routeBadge",
      "badge",
      "grouping",
      "groupLabel",
      "preferred",
      "primaryRoute",
      "alternativeRoute",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
