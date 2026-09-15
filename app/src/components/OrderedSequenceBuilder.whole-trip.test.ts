import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(): Promise<string> {
  return readFile(new URL("./OrderedSequenceBuilder.tsx", import.meta.url), "utf8");
}

function compositionBlock(fullSource: string): string {
  const start = fullSource.indexOf("function wholeTripUnavailableText");
  const end = fullSource.indexOf("\nexport function OrderedSequenceBuilder", start);
  if (start === -1 || end === -1) throw new Error("Whole-trip presentation boundary missing");
  return fullSource.slice(start, end);
}

function withoutComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("OrderedSequenceBuilder — Phase 3E-A whole-trip wiring", () => {
  it("renders one read-only section in each relevant planner view, never a page, modal or wizard", async () => {
    const fullSource = await source();
    const block = withoutComments(compositionBlock(fullSource));
    expect(fullSource.match(/<WholeTripCompositionSection/g)).toHaveLength(2);
    expect(block).toContain("Resumen del plan completo");
    expect(block).not.toMatch(/<input|<select|onClick=|role="dialog"|modal|wizard/i);
  });

  it("derives from the V7 runtime facts and never writes composition back", async () => {
    const fullSource = await source();
    expect(fullSource).toContain("buildWholeTripComposition(");
    expect(fullSource).toContain("days: planningDays");
    expect(fullSource).toContain("interHubSegments,");
    expect(fullSource).toContain("accommodationLegs,");
    expect(fullSource).toContain("bounds: { startDate, endDate }");
    expect(fullSource).toContain("resolvePlace: (placeId) => placeById.get(placeId) ?? null");
    expect(fullSource).not.toMatch(/setWholeTrip|writeWholeTrip|persistWholeTrip/);
  });

  it("shows neutral unavailable states without partial arithmetic", async () => {
    const block = compositionBlock(await source());
    expect(block).toContain('composition.kind === "unavailable"');
    expect(block).toContain("no se muestran cálculos parciales");
    const unavailableStart = block.indexOf('if (composition.kind === "unavailable")');
    const availableStart = block.indexOf("const totalPlaceCount", unavailableStart);
    const unavailableBranch = block.slice(unavailableStart, availableStart);
    expect(unavailableBranch).not.toContain("quantifiedMinutes");
    expect(unavailableBranch).not.toContain("registeredTransportMinutes");
  });

  it("keeps quantified and non-quantified visits visibly separate", async () => {
    const block = compositionBlock(await source());
    expect(block).toContain("Tiempo de visita cuantificado");
    expect(block).toContain("lugares con duración numérica");
    expect(block).toContain("No cuantificados:");
    expect(block).toContain("compromisos de escala día:");
    expect(block).toContain("sin clasificación:");
  });

  it("shows partial movement counts and qualifies positive coverage with a nonzero slot gate", async () => {
    const block = compositionBlock(await source());
    expect(block).toContain("Traslado registrado:");
    expect(block).toContain("locales faltantes:");
    expect(block).toContain("Entre ciudades activos:");
    expect(block).toContain("Cobertura incompleta:");
    expect(block).toContain("composition.movement.modeledAdjacencyCount > 0");
    expect(block).toContain("Todos los tramos entre lugares que este resumen modela tienen tiempo registrado.");
  });

  it("shows every accommodation state without a global completeness claim", async () => {
    const block = compositionBlock(await source());
    expect(block).toContain("Minutos manuales registrados:");
    expect(block).toContain("manualLegMissingCount");
    expect(block).toContain("boundaryUnselectedCount");
    expect(block).toContain("explicitNoAccommodationCount");
    expect(block).toContain("emptyDayNotApplicableCount");
    expect(block).not.toMatch(/accommodationComplete|alojamiento completo/i);
  });

  it("keeps after-end days in composition while exposing the bounds mismatch", async () => {
    const block = compositionBlock(await source());
    expect(block).toContain("composition.bounds.daysAfterTripEnd");
    expect(block).toContain("Días posteriores a la fecha de fin:");
    expect(block).toContain("Siguen incluidos en las visitas y traslados registrados de este resumen.");
  });

  it("contains no score, optimisation, real-total or grand-total claim", async () => {
    const block = withoutComments(compositionBlock(await source()));
    expect(block).not.toMatch(/totalTripMinutes|tripScore|itineraryScore|qualityScore|optimisationScore/);
    expect(block).not.toMatch(/tiempo real|tiempo óptimo|duración total del viaje|ruta óptima|mejor opción/i);
    expect(block).not.toMatch(/tiempo total de visitas|tiempo total de traslado/i);
  });

  it("recomputes when inter-hub minutes, accommodation legs, order, days or bounds change", async () => {
    const fullSource = withoutComments(await source());
    expect(fullSource).toMatch(
      /\[routeIds, planningDays, interHubSegments, accommodationLegs, startDate, endDate, placeById\]/
    );
  });
});
