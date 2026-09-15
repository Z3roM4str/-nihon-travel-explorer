import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/* Phase 3E-K UI wiring contract 123 from the normative design §33.
 *
 * Contracts 124-125 are executable-only and are proved by `scripts/phase3e-k-browser-audit.mjs`
 * against a real Chromium runtime, not here. That audit also exercises contract 123 at runtime.
 * Everything numbered 1-122 lives in the domain, pure-V7 and invariant suites. */

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

/** Only the fifth subgroup's markup, so no assertion can be satisfied by an earlier group. */
function pairBlockGroup(fullSource: string): string {
  const block = sectionBlock(fullSource);
  const start = block.indexOf("Intercambios de bloques de dos lugares");
  if (start === -1) throw new Error("two-pair block swap subgroup not found");
  return block.slice(start);
}

describe("OrderedSequenceBuilder — Phase 3E-K UI (§33.123)", () => {
  it("123a. the one existing surface gains a fifth subgroup, rendered only when applicable", async () => {
    const full = await source();
    const block = sectionBlock(full);
    expect(full.match(/<LocalSwapAlternativesSection/g)).toHaveLength(1);
    expect(block).toContain("Alternativas locales con evidencia completa");
    for (const heading of [
      "Intercambios adyacentes",
      "Reubicaciones de un lugar",
      "Intercambios no adyacentes",
      "Reversiones de cuatro lugares",
      "Intercambios de bloques de dos lugares",
    ]) {
      expect(block).toContain(heading);
    }
    // Gated on its own non-empty group, exactly like the four earlier subgroups.
    expect(block).toContain("{pairBlockSwapAlternatives.length > 0 && (");
    // No new page, modal or wizard.
    expect(block).not.toMatch(/role=["']dialog|modal|wizard/i);
  });

  it("123b. the neutral empty state still covers all five groups being empty", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).toContain(
      "No hay una alternativa local con mejora demostrable usando todos los traslados registrados"
    );
    const start = block.indexOf("const hasAlternatives");
    const guard = block.slice(start, block.indexOf(";", start));
    expect(guard).toContain("pairBlockSwapAlternatives.length > 0");
    expect(guard).toContain("reversalAlternatives.length > 0");
    expect(guard).toContain("transpositionAlternatives.length > 0");
    expect(guard).toContain("relocationAlternatives.length > 0");
    expect(guard).toContain("alternatives.length > 0");
  });

  it("123c. the copy names both two-place blocks naturally, never by index", async () => {
    const group = pairBlockGroup(await source());
    expect(group).toContain("Intercambiar los bloques de dos lugares");
    expect(group).toContain("dentro del bloque de");
    expect(group).toContain("alternative.firstPairPlaceIds");
    expect(group).toContain("alternative.secondPairPlaceIds");
    const copyStart = group.indexOf("Intercambiar los bloques de dos lugares");
    const copy = group.slice(copyStart, group.indexOf("</p>", copyStart));
    // Four named places: both endpoints of both two-place blocks.
    expect(copy.match(/nameOf\(/g)).toHaveLength(4);
    expect(copy).not.toMatch(/windowStartDayIndex|windowStartIndex|índice|\bindex\b/i);
  });

  it("123d. both recorded ranges and the minimum gap are visible", async () => {
    const group = pairBlockGroup(await source());
    expect(group).toContain("Traslados registrados del bloque actual");
    expect(group).toContain("Traslados registrados de este intercambio de bloques");
    expect(group).toContain("formatRange(alternative.baselineTransferMinutes)");
    expect(group).toContain("formatRange(alternative.candidateTransferMinutes)");
    // JSX wraps the sentence across lines; the rendered string is pinned by the browser audit.
    expect(group).toMatch(/Ventaja mínima entre los rangos registrados:/);
    expect(group).toContain("formatMinutes(alternative.guaranteedAdvantageMinutes)");
  });

  it("123e. both confidence mixes are disclosed", async () => {
    const group = pairBlockGroup(await source());
    expect(group).toContain("confidenceMixText(alternative.baselineConfidenceCounts)");
    expect(group).toContain("confidenceMixText(alternative.candidateConfidenceCounts)");
    expect(group.match(/local-swap__evidence/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("123f. the local-only disclaimer is present", async () => {
    expect(pairBlockGroup(await source())).toContain(
      "No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo."
    );
  });

  it("123g. the approved claim appears and no forbidden optimisation claim does", async () => {
    const block = withoutComments(sectionBlock(await source()));
    for (const forbidden of [
      /mejor orden/i,
      /ruta óptima/i,
      /día optimizado/i,
      /recomendado/i,
      /recomendamos/i,
      /te conviene/i,
      /ahorras/i,
      /mejor alternativa/i,
      /fastest/i,
      /best route/i,
      /viaje completo más rápido/i,
      /18 min/,
      /ahorro total/i,
    ]) {
      expect(block).not.toMatch(forbidden);
    }
    expect(block).toContain(
      "Este intercambio de bloques reduce de forma demostrable el rango de traslado"
    );
  });

  it("123h. Apply is an explicit button routed through the stale-guarded wrapper", async () => {
    const group = pairBlockGroup(await source());
    expect(group).toContain("Aplicar este intercambio de bloques");
    expect(group).toContain("onClick={() => onApplyPairBlockSwap(alternative)}");
    expect(group).not.toMatch(/useEffect|setTimeout|autoApply/);

    const full = withoutComments(await source());
    expect(full).toContain("applyEvidenceCompleteTwoPairBlockSwap(");
    const handlerStart = full.indexOf("function applyTwoPairBlockSwap");
    const declarationEnd = full.indexOf("{", full.indexOf(") {", handlerStart));
    const body = full.slice(declarationEnd, full.indexOf("\n  }", handlerStart));
    expect(body).toContain("swapTwoPairBlocksWithinDay(dayId, windowStartIndex)");
    expect(body.match(/swapTwoPairBlocksWithinDay\(/g)).toHaveLength(1);
    // No automatic follow-up Apply — in particular, never the 3E-E relocation the applied order
    // newly admits — and no other neighbourhood's mutation is reachable from here.
    expect(body).not.toMatch(
      /applyLocalSwap|applyLocalRelocation|applyInteriorTransposition|applyFourPlaceReversal|applyTwoPairBlockSwap\(/
    );
    expect(full).not.toMatch(/useEffect\([^)]*applyTwoPairBlockSwap/);
  });

  it("123i. alternatives are derived on render and never persisted", async () => {
    const full = withoutComments(await source());
    expect(full).toContain("const twoPairBlockSwapGeneration = useMemo(");
    expect(full).toContain("const twoPairBlockSwapsByDayId = useMemo(");
    const memoStart = full.indexOf("generateEvidenceCompleteTwoPairBlockSwaps(");
    expect(full.slice(memoStart, memoStart + 300)).toContain(
      "[routeIds, planningDays, visitStartTimes, placeById]"
    );
    expect(full).not.toMatch(/setDraft|writeDraft/);
  });

  it("123j. the four earlier groups remain wired, ordered C → E → G → I → K and unranked", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("onClick={() => onApply(alternative)}");
    expect(block).toContain("onClick={() => onApplyRelocation(alternative)}");
    expect(block).toContain("onClick={() => onApplyTransposition(alternative)}");
    expect(block).toContain("onClick={() => onApplyReversal(alternative)}");
    // Group order is positional and fixed; nothing sorts or ranks between groups, so a larger
    // pair-block gap can never displace or suppress an earlier group.
    const order = [
      "Intercambios adyacentes",
      "Reubicaciones de un lugar",
      "Intercambios no adyacentes",
      "Reversiones de cuatro lugares",
      "Intercambios de bloques de dos lugares",
    ].map((heading) => block.indexOf(heading));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(withoutComments(block)).not.toMatch(/\.sort\(/);
  });
});
