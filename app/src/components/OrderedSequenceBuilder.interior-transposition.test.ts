import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/* Phase 3E-G UI wiring contracts 105-123 from the normative design §35.
 *
 * Contracts 124-125 (console errors, page errors) are executable-only and are proved by
 * `scripts/phase3e-g-browser-audit.mjs` against a real Chromium runtime, not here. That audit also
 * exercises contracts 105-116 and 122-123 at runtime. Contracts 117-121 are covered here and in
 * the domain/invariant suites rather than in the browser: they are statements about state this
 * surface never renders. */

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

/** Only the third subgroup's markup, so a passing assertion cannot be satisfied by 3E-C/3E-E. */
function transpositionGroup(fullSource: string): string {
  const block = sectionBlock(fullSource);
  const start = block.indexOf("Intercambios no adyacentes");
  if (start === -1) throw new Error("non-adjacent subgroup not found");
  return block.slice(start);
}

describe("OrderedSequenceBuilder — Phase 3E-G UI (§35.105-123)", () => {
  it("105. the one existing surface gains a distinct non-adjacent subgroup", async () => {
    const full = await source();
    const block = sectionBlock(full);
    expect(full.match(/<LocalSwapAlternativesSection/g)).toHaveLength(1);
    expect(block).toContain("Alternativas locales con evidencia completa");
    expect(block).toContain("Intercambios adyacentes");
    expect(block).toContain("Reubicaciones de un lugar");
    expect(block).toContain("Intercambios no adyacentes");
    expect(block).not.toMatch(/role=["']dialog|modal|wizard/i);
  });

  it("106. the candidate names both exchanged places", async () => {
    const group = transpositionGroup(await source());
    expect(group).toContain("nameOf(alternative.leftPlaceId)");
    expect(group).toContain("nameOf(alternative.rightPlaceId)");
  });

  it("107. the natural copy does not lead with raw indices", async () => {
    const group = transpositionGroup(await source());
    expect(group).toContain("Intercambiar <strong>");
    expect(group).toContain("dentro del bloque de");
    const copyStart = group.indexOf("Intercambiar <strong>");
    const copyEnd = group.indexOf("</p>", copyStart);
    const copy = group.slice(copyStart, copyEnd);
    expect(copy).not.toMatch(/leftDayIndex|rightDayIndex|leftIndex|rightIndex|índice/i);
  });

  it("108. baseline and candidate registered ranges are visible", async () => {
    const group = transpositionGroup(await source());
    expect(group).toContain("Traslados registrados del bloque actual");
    expect(group).toContain("Traslados registrados de este intercambio");
    expect(group).toContain("formatRange(alternative.baselineTransferMinutes)");
    expect(group).toContain("formatRange(alternative.candidateTransferMinutes)");
  });

  it("109. the minimum recorded-range gap is visible", async () => {
    const group = transpositionGroup(await source());
    expect(group).toContain("Ventaja mínima entre los rangos registrados:");
    expect(group).toContain("formatMinutes(alternative.guaranteedAdvantageMinutes)");
  });

  it("110. both confidence mixes are disclosed", async () => {
    const group = transpositionGroup(await source());
    expect(group).toContain("confidenceMixText(alternative.baselineConfidenceCounts)");
    expect(group).toContain("confidenceMixText(alternative.candidateConfidenceCounts)");
    expect(group.match(/local-swap__evidence/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("111. the local-only disclaimer is present", async () => {
    const group = transpositionGroup(await source());
    expect(group).toContain(
      "No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo."
    );
  });

  it("112. no best, optimal, recommended or whole-trip claim appears", async () => {
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
    // The approved claim is explicitly about this block's recorded local range.
    expect(block).toContain(
      "Este intercambio no adyacente reduce de forma demostrable el rango de traslado"
    );
  });

  it("113. Apply is an explicit button, never automatic", async () => {
    const group = transpositionGroup(await source());
    expect(group).toContain("Aplicar este intercambio no adyacente");
    expect(group).toContain("onClick={() => onApplyTransposition(alternative)}");
    expect(group).not.toMatch(/useEffect|setTimeout|autoApply/);
  });

  it("114. Apply routes through the stale-guarded domain wrapper and one V7 mutation", async () => {
    const full = withoutComments(await source());
    expect(full).toContain("applyEvidenceCompleteInteriorTransposition(");
    const handlerStart = full.indexOf("function applyInteriorTransposition");
    const handler = full.slice(handlerStart, full.indexOf("\n  }", handlerStart));
    expect(handler).toContain("transposePlacesWithinDay(dayId, leftIndex, rightIndex)");
    expect(handler.match(/transposePlacesWithinDay\(/g)).toHaveLength(1);
    expect(handler).not.toMatch(/relocatePlaceWithinDay|movePlaceWithinDay/);
  });

  it("115. the adjacent-swap group remains functional and untouched", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("Intercambios adyacentes");
    expect(block).toContain("Aplicar este intercambio\n");
    expect(block).toContain("onClick={() => onApply(alternative)}");
  });

  it("116. the relocation group remains functional and untouched", async () => {
    const block = sectionBlock(await source());
    expect(block).toContain("Reubicaciones de un lugar");
    expect(block).toContain("Aplicar esta reubicación");
    expect(block).toContain("onClick={() => onApplyRelocation(alternative)}");
  });

  it("117-119. inter-hub, accommodation and bounds surfaces are not touched by this phase", async () => {
    const block = sectionBlock(await source());
    // The local-alternatives section renders none of those surfaces, so none can change here.
    for (const foreign of [
      /InterHubSegment/,
      /AccommodationCommuteSection/,
      /TripBounds/,
      /accommodationBoundary/,
    ]) {
      expect(block).not.toMatch(foreign);
    }
  });

  it("120-121. the temporal lock is the domain module's exact affected set", async () => {
    const full = withoutComments(await source());
    // The component passes the persisted times straight through and never filters or widens them.
    expect(full).toContain("generateEvidenceCompleteInteriorTranspositions(");
    const memoStart = full.indexOf("generateEvidenceCompleteInteriorTranspositions(");
    const memo = full.slice(memoStart, memoStart + 260);
    expect(memo).toContain("visitStartTimes");
    expect(memo).not.toMatch(/affected|filter\(/);
  });

  it("122. no automatic follow-up Apply exists", async () => {
    const full = withoutComments(await source());
    const handlerStart = full.indexOf("function applyInteriorTransposition");
    const declarationEnd = full.indexOf("{", full.indexOf(") {", handlerStart));
    // The body only: the handler's own signature is not a self-invocation.
    const body = full.slice(declarationEnd, full.indexOf("\n  }", handlerStart));
    expect(body).not.toMatch(/applyLocalSwap|applyLocalRelocation|applyInteriorTransposition\(/);
    expect(full).not.toMatch(/useEffect\([^)]*applyInteriorTransposition/);
  });

  it("123. alternatives are derived on render and never persisted", async () => {
    const full = withoutComments(await source());
    expect(full).toContain("const interiorTranspositionGeneration = useMemo(");
    expect(full).toContain("const interiorTranspositionsByDayId = useMemo(");
    // Nothing about a candidate reaches the draft: the only writer is the V7 transposition.
    expect(full).not.toMatch(/setDraft|writeDraft/);
  });

  it("groups are deduplicated by candidate day order, never re-sorted or ranked", async () => {
    const full = withoutComments(await source());
    const memoStart = full.indexOf("const interiorTranspositionsByDayId = useMemo(");
    const memo = full.slice(memoStart, full.indexOf("}, [interiorTranspositionGeneration", memoStart));
    expect(memo).toContain("JSON.stringify(shown.candidateDayPlaceIds)");
    expect(memo).toContain("localSwapsByDayId.get(alternative.dayId)");
    expect(memo).toContain("localRelocationsByDayId.get(alternative.dayId)");
    expect(memo).not.toMatch(/\.sort\(|guaranteedAdvantageMinutes/);
  });
});
