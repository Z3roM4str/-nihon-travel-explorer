import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = new URL("./OrderedSequenceBuilder.tsx", import.meta.url);

async function readSource(): Promise<string> {
  return readFile(SOURCE_PATH, "utf8");
}

function extractOfficialNotice(fullSource: string): string {
  const start = fullSource.indexOf("function OfficialReservationDateNotice");
  if (start === -1) throw new Error("OfficialReservationDateNotice not found");
  const end = fullSource.indexOf("\n/**", start + 1);
  if (end === -1) throw new Error("OfficialReservationDateNotice end boundary not found");
  return fullSource.slice(start, end);
}

function extractDeadlineNotice(fullSource: string): string {
  const start = fullSource.indexOf("function ReservationDeadlineNotice");
  if (start === -1) throw new Error("ReservationDeadlineNotice not found");
  const end = fullSource.indexOf("\n/**", start + 1);
  if (end === -1) throw new Error("ReservationDeadlineNotice end boundary not found");
  return fullSource.slice(start, end);
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("OrderedSequenceBuilder.tsx — Phase 3F-H reference-date relation wiring", () => {
  it("imports the Phase 3F-specific relation evaluator and its own presentation adapter", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bevaluateOfficialReservationReferenceDate\b[^}]*\}\s*from\s*["']\.\.\/lib\/reservation-mechanism-reference-date["']/
    );
    expect(source).toMatch(
      /import\s*\{[\s\S]*?\bbuildOfficialReservationReferenceRelationPresentation\b[\s\S]*?\}\s*from\s*["']\.\.\/lib\/reservation-mechanism-reference-date-presentation["']/
    );
  });

  it("reuses the single already-captured device civil date without a second clock capture", async () => {
    const source = await readSource();
    expect(source).toContain(
      "const [reservationReferenceDate] = useState<string | null>(() => captureDeviceLocalCivilDate());"
    );
    expect((source.match(/captureDeviceLocalCivilDate\(/g) ?? []).length).toBe(1);
    const notice = withoutComments(extractOfficialNotice(source));
    expect(notice).not.toContain("new Date(");
    expect(notice).not.toContain("Date.now(");
    expect(notice).not.toContain("captureDeviceLocalCivilDate");
  });

  it("passes that same explicit reference date into the Phase 3F surface", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /<OfficialReservationDateNotice[\s\S]*?referenceDate=\{reservationReferenceDate\}[\s\S]*?\/>/
    );
  });

  it("evaluates the relation from the same derivation the presentation was built from", async () => {
    const notice = extractOfficialNotice(await readSource());
    const presentation = notice.indexOf("buildOfficialReservationDatePresentation(record, derivation)");
    const relation = notice.indexOf(
      "evaluateOfficialReservationReferenceDate(derivation, referenceDate)"
    );
    const composition = notice.indexOf(
      "buildOfficialReservationReferenceRelationPresentation(presentation, relation)"
    );
    expect(presentation).toBeGreaterThan(-1);
    expect(relation).toBeGreaterThan(presentation);
    expect(composition).toBeGreaterThan(relation);
    expect(notice).toContain("if (!presentation) continue;");
  });

  it("evaluates nothing when no reference date was captured", async () => {
    const notice = extractOfficialNotice(await readSource());
    expect(notice).toMatch(
      /const relation = referenceDate\s*\?\s*evaluateOfficialReservationReferenceDate\(derivation, referenceDate\)\s*:\s*null;/
    );
  });

  it("renders the relation and the concrete reference date in the approved order", async () => {
    const notice = extractOfficialNotice(await readSource());
    const allocation = notice.indexOf("presentation.allocationText");
    const relationText = notice.indexOf("relationPresentation.relationText");
    const referenceDateText = notice.indexOf("relationPresentation.referenceDateText");
    const provenance = notice.indexOf("presentation.provenanceText");
    const sourceLink = notice.indexOf("href={presentation.sourceUrl}");
    expect(allocation).toBeGreaterThan(-1);
    expect(relationText).toBeGreaterThan(allocation);
    expect(referenceDateText).toBeGreaterThan(relationText);
    expect(provenance).toBeGreaterThan(referenceDateText);
    expect(sourceLink).toBeGreaterThan(provenance);
  });

  it("renders the relation only through the fail-closed composed result", async () => {
    const notice = extractOfficialNotice(await readSource());
    expect(notice).toMatch(/\{relationPresentation && \(/);
    // No raw relation kind, release date or window edge is rendered directly.
    expect(notice).not.toContain("relation.kind");
    expect(notice).not.toContain("relation.releaseDate");
    expect(notice).not.toContain("relation.openDate");
    expect(notice).not.toContain("relation.closeDate");
  });

  it("keeps the Phase 3F relation on its own neutral class names", async () => {
    const notice = extractOfficialNotice(await readSource());
    expect(notice).toContain("official-reservation-date__reference-relation");
    expect(notice).toContain("official-reservation-date__reference-date");
    // Phase 3D-O keeps its own classes; the two surfaces never share a node.
    expect(notice).not.toContain("reservation-deadline__reference-relation");
    expect(notice).not.toContain("reservation-deadline__reference-date");
  });

  it("keeps Phase 3D-O's own relation surface unchanged and separate", async () => {
    const deadline = await readSource().then(extractDeadlineNotice);
    expect(deadline).toContain("evaluateReservationWindowReference(window, referenceDate)");
    expect(deadline).toContain("describeReservationWindowReferenceForUi(relation)");
    expect(deadline).toContain("formatDeviceReferenceDateForUi(referenceDate)");
    // Phase 3D never learns about the Phase 3F domain.
    expect(deadline).not.toContain("evaluateOfficialReservationReferenceDate");
    expect(deadline).not.toContain("reservationMechanismEvidenceRecords");
    expect(deadline).not.toContain("OfficialReservationDate");
  });

  it("produces no combined, intersected or ranked official/editorial state", async () => {
    const notice = withoutComments(extractOfficialNotice(await readSource()));
    for (const forbidden of [
      "derivePlaceReservationDateWindow",
      "ReservationDateWindow",
      "farAdvanceDate",
      "nearAdvanceDate",
      "interpretPlaceFebMarStatus",
      ".sort(",
      "Math.min(",
      "Math.max(",
    ]) {
      expect(notice, forbidden).not.toContain(forbidden);
    }
  });

  it("discloses the device source and the non-refreshing basis of the comparison", async () => {
    const notice = extractOfficialNotice(await readSource());
    expect(notice).toContain("compara únicamente fechas");
    expect(notice).toContain("no considera la hora registrada ni la zona horaria de la fuente");
    expect(notice).toContain("no indica el");
    expect(notice).toContain("estado actual de la venta.");
    expect(notice).toContain("calendario local de tu");
    expect(notice).toContain("no representa la fecha operativa en Japón");
    expect(notice).toContain("no se actualiza");
    expect(notice).toContain("Nihon no combina ambas fuentes.");
  });

  it("adds no timer, listener, worker or background refresh for the reference date", async () => {
    const source = withoutComments(await readSource());
    for (const forbidden of [
      "setInterval(",
      "setTimeout(",
      "requestAnimationFrame(",
      "visibilitychange",
      "addEventListener(\"focus\"",
      "serviceWorker",
      "navigator.serviceWorker",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it("persists no relation, reference date or derived status", async () => {
    const notice = extractOfficialNotice(await readSource());
    expect(notice).not.toContain("localStorage");
    expect(notice).not.toContain("sessionStorage");
    expect(notice).not.toContain("setDraft");
    expect(notice).not.toContain("updateDraft");
    const source = await readSource();
    expect(source).not.toContain("ManualPlanningDraftV8");
    expect(source).not.toContain("reservationReferenceDate:");
  });

  it("does not introduce availability, urgency, countdown or action vocabulary", async () => {
    const notice = withoutComments(extractOfficialNotice(await readSource())).toLowerCase();
    for (const forbidden of [
      "venta abierta",
      "venta cerrada",
      "reservas abiertas",
      "reservas cerradas",
      "ya abrió",
      "todavía no abre",
      "abre hoy",
      "ya puedes comprar",
      "reserva ahora",
      "compra ahora",
      "última oportunidad",
      "fecha límite",
      "deadline",
      "agotado",
      "quedan boletos",
      "días restantes",
      "horas restantes",
      "urgente",
      "estás tarde",
      "se te pasó",
      "garantiz",
      "recomendamos comprar",
    ]) {
      expect(notice, forbidden).not.toContain(forbidden);
    }
  });
});
