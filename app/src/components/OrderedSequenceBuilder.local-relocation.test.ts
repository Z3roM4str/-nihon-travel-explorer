import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/* Phase 3E-E UI/browser integration contracts 85-103 from the normative design. */

async function source(): Promise<string> {
  return readFile(new URL("./OrderedSequenceBuilder.tsx", import.meta.url), "utf8");
}

function withoutComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function sectionBlock(fullSource: string): string {
  const start = fullSource.indexOf("function LocalSwapAlternativesSection");
  const end = fullSource.indexOf("function wholeTripUnavailableText", start);
  if (start === -1 || end === -1) throw new Error("local alternatives section not found");
  return fullSource.slice(start, end);
}

describe("OrderedSequenceBuilder — Phase 3E-E UI (§34.85-103)", () => {
  it("85. one existing surface contains distinct swap and relocation subgroups", async () => {
    const full = await source();
    const block = sectionBlock(full);
    expect(full.match(/<LocalSwapAlternativesSection/g)).toHaveLength(1);
    expect(block).toContain("Alternativas locales con evidencia completa");
    expect(block).toContain("Intercambios adyacentes");
    expect(block).toContain("Reubicaciones de un lugar");
    expect(block).not.toMatch(/role=["']dialog|modal|wizard/i);
  });

  it("86. relocation copy names the moved place", async () => {
    expect(sectionBlock(await source())).toContain("nameOf(alternative.movedPlaceId)");
  });

  it("87. destination is described naturally through the following place", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("Mover <strong>");
    expect(block).toContain("antes de");
    expect(block).toContain("candidateDayPlaceIds[alternative.toDayIndex + 1]");
    expect(block).not.toMatch(/fromIndex.*→.*toIndex/);
  });

  it("88. baseline and candidate registered local ranges are visible", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("Traslados registrados del bloque actual");
    expect(block).toContain("Traslados registrados de esta reubicación");
    expect(block).toContain("formatRange(alternative.baselineTransferMinutes)");
    expect(block).toContain("formatRange(alternative.candidateTransferMinutes)");
  });

  it("89. the minimum recorded-range gap is visible", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("Ventaja mínima entre los rangos registrados:");
    expect(block).toContain("formatMinutes(alternative.guaranteedAdvantageMinutes)");
  });

  it("90. confidence is disclosed for baseline and candidate", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("confidenceMixText(alternative.baselineConfidenceCounts)");
    expect(block).toContain("confidenceMixText(alternative.candidateConfidenceCounts)");
    expect(block.match(/local-swap__evidence/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("91. every relocation carries the local-only disclaimer", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.");
  });

  it("92. relocation UI uses no forbidden optimisation claim", async () => {
    const block = withoutComments(sectionBlock(await source()));
    for (const forbidden of [
      "Mejor orden", "Ruta óptima", "Día optimizado", "recomendamos", "te conviene",
      "ahorras", "mejor alternativa",
    ]) expect(block.toLowerCase()).not.toContain(forbidden.toLowerCase());
  });

  it("93. Apply is an explicit button click", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("Aplicar esta reubicación");
    expect(block).toContain("onClick={() => onApplyRelocation(alternative)}");
  });

  it("94. Apply delegates one exact final-order relocation", async () => {
    const full = await source();
    const apply = full.slice(full.indexOf("function applyLocalRelocation"), full.indexOf("function moveUp"));
    expect(apply).toContain("applyEvidenceCompleteLocalRelocation(");
    expect(apply).toContain("relocatePlaceWithinDay(dayId, fromIndex, toIndex)");
    expect(apply.match(/relocatePlaceWithinDay\(/g)).toHaveLength(1);
  });

  it("95. the adjacent-swap subgroup and Apply path remain functional", async () => {
    const full = await source();
    const block = sectionBlock(full);
    expect(block).toContain("Aplicar este intercambio");
    expect(block).toContain("onClick={() => onApply(alternative)}");
    expect(full).toContain("applyEvidenceCompleteLocalSwap(");
  });

  it("96. the relocation section never mutates or reassesses inter-hub state", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).not.toMatch(/interHub|InterHub/);
  });

  it("97. the relocation Apply path never mutates accommodation state", async () => {
    const full = await source();
    const apply = withoutComments(full.slice(full.indexOf("function applyLocalRelocation"), full.indexOf("function moveUp")));
    expect(apply).not.toMatch(/Accommodation|accommodation/);
  });

  it("98. the existing after-end warning remains outside and unchanged", async () => {
    const full = await source();
    expect(full).toContain("Este día es posterior a la fecha de fin de tu viaje.");
    expect(full).toContain("<TripBoundsDayWarning assessment={boundsAssessment} />");
    expect(sectionBlock(full)).not.toContain("TripBoundsDayWarning");
  });

  it("99. affected manual times suppress generation and are rechecked at Apply", async () => {
    const full = await source();
    const generation = full.slice(full.indexOf("const localRelocationGeneration"), full.indexOf("const localRelocationsByDayId"));
    const apply = full.slice(full.indexOf("function applyLocalRelocation"), full.indexOf("function moveUp"));
    expect(generation).toContain("{ routeIds, days: planningDays, visitStartTimes }");
    expect(apply).toContain("{ routeIds, days: planningDays, visitStartTimes }");
  });

  it("100. no automatic follow-up Apply exists", async () => {
    const full = await source();
    const block = sectionBlock(full);
    expect(block).not.toMatch(/useEffect|setTimeout|setInterval/);
    expect(full).not.toMatch(/useState<[^>]*LocalRelocation|setLocalRelocation|accumulatedSavings/);
  });

  it("101. reload/render derives fresh swaps and relocations from the current V7 draft", async () => {
    const full = await source();
    expect(full).toContain("generateEvidenceCompleteLocalSwaps(");
    expect(full).toContain("generateEvidenceCompleteLocalRelocations(");
    // Each generation is a render-time useMemo over the current draft. Asserted per generation
    // rather than as a file-wide tally, so a later phase adding its own generation with the same
    // dependencies cannot mask a regression here.
    for (const generator of [
      "generateEvidenceCompleteLocalSwaps(",
      "generateEvidenceCompleteLocalRelocations(",
    ]) {
      const start = full.indexOf(generator);
      expect(full.slice(start, start + 400)).toContain(
        "[routeIds, planningDays, visitStartTimes, placeById]"
      );
    }
  });

  it("102. the executable Chromium audit records and asserts zero console errors", async () => {
    const audit = await readFile(new URL("../../scripts/phase3e-e-browser-audit.mjs", import.meta.url), "utf8");
    expect(audit).toContain('page.on("console"');
    expect(audit).toContain("assert.deepEqual(consoleErrors, [])");
  });

  it("103. the executable Chromium audit records and asserts zero page errors", async () => {
    const audit = await readFile(new URL("../../scripts/phase3e-e-browser-audit.mjs", import.meta.url), "utf8");
    expect(audit).toContain('page.on("pageerror"');
    expect(audit).toContain("assert.deepEqual(pageErrors, [])");
  });
});
