import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/* Phase 3E-I UI wiring contracts 122-123 from the normative design §31.
 *
 * Contracts 124-125 are executable-only and are proved by `scripts/phase3e-i-browser-audit.mjs`
 * against a real Chromium runtime, not here. That audit also exercises contracts 122-123 at
 * runtime. Everything numbered 1-121 lives in the domain, pure-V7 and invariant suites. */

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

/** Only the fourth subgroup's markup, so no assertion can be satisfied by an earlier group. */
function reversalGroup(fullSource: string): string {
  const block = sectionBlock(fullSource);
  const start = block.indexOf("Reversiones de cuatro lugares");
  if (start === -1) throw new Error("four-place reversal subgroup not found");
  return block.slice(start);
}

describe("OrderedSequenceBuilder — Phase 3E-I UI (§31.122-123)", () => {
  it("122. the one existing surface gains a fourth subgroup, rendered only when applicable", async () => {
    const full = await source();
    const block = sectionBlock(full);
    expect(full.match(/<LocalSwapAlternativesSection/g)).toHaveLength(1);
    expect(block).toContain("Alternativas locales con evidencia completa");
    for (const heading of [
      "Intercambios adyacentes",
      "Reubicaciones de un lugar",
      "Intercambios no adyacentes",
      "Reversiones de cuatro lugares",
    ]) {
      expect(block).toContain(heading);
    }
    // Gated on its own non-empty group, exactly like the three earlier subgroups.
    expect(block).toContain("{reversalAlternatives.length > 0 && (");
    expect(block).not.toMatch(/role=["']dialog|modal|wizard/i);
  });

  it("122b. the neutral empty state still covers all four groups being empty", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).toContain(
      "No hay una alternativa local con mejora demostrable usando todos los traslados registrados"
    );
    const start = block.indexOf("const hasAlternatives");
    const guard = block.slice(start, block.indexOf(";", start));
    expect(guard).toContain("reversalAlternatives.length > 0");
    expect(guard).toContain("transpositionAlternatives.length > 0");
    expect(guard).toContain("relocationAlternatives.length > 0");
    expect(guard).toContain("alternatives.length > 0");
  });

  it("123a. the candidate names all four reversed places in natural copy", async () => {
    const group = reversalGroup(await source());
    expect(group).toContain("Revertir el orden de <strong>");
    expect(group).toContain("dentro del bloque de");
    expect(group).toContain("alternative.originalWindowPlaceIds");
    const copyStart = group.indexOf("Revertir el orden de <strong>");
    const copy = group.slice(copyStart, group.indexOf("</p>", copyStart));
    expect(copy.match(/nameOf\(/g)).toHaveLength(4);
    // Not raw-index-first: no index identifier appears in the user-facing sentence.
    expect(copy).not.toMatch(/windowStartDayIndex|windowStartIndex|índice|\bindex\b/i);
  });

  it("123b. both recorded ranges and the minimum gap are visible", async () => {
    const group = reversalGroup(await source());
    expect(group).toContain("Traslados registrados del bloque actual");
    expect(group).toContain("Traslados registrados de esta reversión");
    expect(group).toContain("formatRange(alternative.baselineTransferMinutes)");
    expect(group).toContain("formatRange(alternative.candidateTransferMinutes)");
    // JSX wraps the sentence across lines; the rendered string is pinned by the browser audit.
    expect(group).toMatch(/Ventaja mínima entre los rangos\s+registrados:/);
    expect(group).toContain("formatMinutes(alternative.guaranteedAdvantageMinutes)");
  });

  it("123c. both confidence mixes are disclosed", async () => {
    const group = reversalGroup(await source());
    expect(group).toContain("confidenceMixText(alternative.baselineConfidenceCounts)");
    expect(group).toContain("confidenceMixText(alternative.candidateConfidenceCounts)");
    expect(group.match(/local-swap__evidence/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("123d. the local-only disclaimer is present", async () => {
    expect(reversalGroup(await source())).toContain(
      "No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo."
    );
  });

  it("123e. no forbidden optimisation claim appears on the surface", async () => {
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
    ]) {
      expect(block).not.toMatch(forbidden);
    }
    expect(block).toContain(
      "Esta reversión de cuatro lugares reduce de forma demostrable el rango de"
    );
  });

  it("123f. Apply is an explicit button routed through the stale-guarded wrapper", async () => {
    const group = reversalGroup(await source());
    expect(group).toContain("Aplicar esta reversión de cuatro lugares");
    expect(group).toContain("onClick={() => onApplyReversal(alternative)}");
    expect(group).not.toMatch(/useEffect|setTimeout|autoApply/);

    const full = withoutComments(await source());
    expect(full).toContain("applyEvidenceCompleteFourPlaceInteriorReversal(");
    const handlerStart = full.indexOf("function applyFourPlaceReversal");
    const declarationEnd = full.indexOf("{", full.indexOf(") {", handlerStart));
    const body = full.slice(declarationEnd, full.indexOf("\n  }", handlerStart));
    expect(body).toContain("reverseFourPlacesWithinDay(dayId, windowStartIndex)");
    expect(body.match(/reverseFourPlacesWithinDay\(/g)).toHaveLength(1);
    // No automatic follow-up Apply, and no other neighbourhood's mutation is reachable from here.
    expect(body).not.toMatch(
      /applyLocalSwap|applyLocalRelocation|applyInteriorTransposition|applyFourPlaceReversal\(/
    );
    expect(full).not.toMatch(/useEffect\([^)]*applyFourPlaceReversal/);
  });

  it("123g. alternatives are derived on render and never persisted", async () => {
    const full = withoutComments(await source());
    expect(full).toContain("const fourPlaceReversalGeneration = useMemo(");
    expect(full).toContain("const fourPlaceReversalsByDayId = useMemo(");
    const memoStart = full.indexOf("generateEvidenceCompleteFourPlaceInteriorReversals(");
    expect(full.slice(memoStart, memoStart + 300)).toContain(
      "[routeIds, planningDays, visitStartTimes, placeById]"
    );
    expect(full).not.toMatch(/setDraft|writeDraft/);
  });

  it("123h. the three earlier groups remain wired and unranked", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("onClick={() => onApply(alternative)}");
    expect(block).toContain("onClick={() => onApplyRelocation(alternative)}");
    expect(block).toContain("onClick={() => onApplyTransposition(alternative)}");
    // Group order is positional and fixed; nothing sorts or ranks between groups.
    const order = [
      "Intercambios adyacentes",
      "Reubicaciones de un lugar",
      "Intercambios no adyacentes",
      "Reversiones de cuatro lugares",
    ].map((heading) => block.indexOf(heading));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(withoutComments(block)).not.toMatch(/\.sort\(/);
  });
});
