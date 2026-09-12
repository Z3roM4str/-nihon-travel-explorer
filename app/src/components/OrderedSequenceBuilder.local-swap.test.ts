import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/*
 * Phase 3E-C — the UI half of the test contract in
 * `docs/EVIDENCE_COMPLETE_LOCAL_SWAP_DESIGN.md` §30 (items 73-87).
 *
 * The domain guarantees are proved against behaviour in `lib/evidence-complete-local-swap.test.ts`.
 * What is asserted here is the part that lives only in the presentation layer — what is claimed,
 * how strongly, with which qualification attached, and that nothing is applied without a click —
 * following the same source-contract style the whole-trip and inter-hub wiring tests already use.
 */

async function source(): Promise<string> {
  return readFile(new URL("./OrderedSequenceBuilder.tsx", import.meta.url), "utf8");
}

function sectionBlock(fullSource: string): string {
  const start = fullSource.indexOf("function LocalSwapAlternativesSection");
  const end = fullSource.indexOf("function wholeTripUnavailableText", start);
  if (start === -1 || end === -1) throw new Error("Local-swap presentation boundary missing");
  return fullSource.slice(start, end);
}

function withoutComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("OrderedSequenceBuilder — Phase 3E-C local swap wiring", () => {
  it("73. renders inside the existing day card — no page, modal or wizard", async () => {
    const fullSource = await source();
    expect(fullSource).toContain("<LocalSwapAlternativesSection");
    // Exactly one call site, inside the day-card branch of the day list.
    expect(fullSource.match(/<LocalSwapAlternativesSection/g)).toHaveLength(1);
    const block = withoutComments(sectionBlock(fullSource));
    expect(block).not.toMatch(/role="dialog"|aria-modal|modal|wizard|<input|<select/i);
    expect(block).toContain("Alternativas locales con evidencia completa");
  });

  it("73b. the section is only offered per day, from that day's own alternatives", async () => {
    const fullSource = await source();
    expect(fullSource).toContain("localSwapsByDayId.get(dayEntity.id) ?? []");
    expect(fullSource).toContain('localSwapGeneration.kind === "available"');
  });

  it("74. names both exchanged places rather than positions", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).toContain("nameOf(alternative.leftPlaceId)");
    expect(block).toContain("nameOf(alternative.rightPlaceId)");
    expect(block).toContain("Intercambiar");
  });

  it("75. shows the current and candidate registered local ranges, both labelled as registered", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).toContain("formatRange(alternative.baselineTransferMinutes)");
    expect(block).toContain("formatRange(alternative.candidateTransferMinutes)");
    expect(block).toContain("Traslados registrados del bloque actual");
    expect(block).toContain("Traslados registrados de esta alternativa");
  });

  it("76. frames the gap as a minimum between recorded ranges, never a real-world guarantee", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).toContain("Ventaja mínima entre los rangos registrados");
    expect(block).toContain("formatMinutes(alternative.guaranteedAdvantageMinutes)");
    expect(block).toContain("queda al menos esa diferencia por debajo del rango registrado");
    for (const forbidden of ["Ahorras", "ahorras", "ahorro", "garantizad", "más rápido", "mas rapido"]) {
      expect(block).not.toContain(forbidden);
    }
  });

  it("77. shows the evidence quality of BOTH orders", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).toContain("confidenceMixText(alternative.baselineConfidenceCounts)");
    expect(block).toContain("confidenceMixText(alternative.candidateConfidenceCounts)");
    expect(block).toContain("{baselineMix}");
    expect(block).toContain("{candidateMix}");
  });

  it("78. reuses the Phase 3C-B evidence vocabulary and never relabels estimated as validated", async () => {
    const fullSource = await source();
    const helper = fullSource.slice(
      fullSource.indexOf("function confidenceMixText"),
      fullSource.indexOf("function LocalSwapAlternativesSection")
    );
    expect(helper).toContain("counts.validatedStatic");
    expect(helper).toContain("counts.estimated");
    expect(helper).toContain("counts.scheduleAware");
    expect(helper).toContain("estimado");
    // No branch collapses a mixed tally into a single flattering label.
    expect(withoutComments(helper)).not.toMatch(/completo|fiable|verificad|confiable/i);
  });

  it("79. attaches the local-only qualification to every alternative", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).toContain(
      "Esta comparación usa únicamente los traslados locales registrados de este bloque."
    );
    expect(block).toContain(
      "No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo."
    );
    // The disclaimer sits inside the per-alternative <li>, not once at the top of the section.
    const listStart = block.indexOf("alternatives.map(");
    expect(block.indexOf("local-swap__disclaimer")).toBeGreaterThan(listStart);
  });

  it("80. makes no best/optimal/recommended/whole-trip claim, and the empty state makes none either", async () => {
    const block = withoutComments(sectionBlock(await source()));
    for (const forbidden of [
      "óptim",
      "Óptim",
      "recomend",
      "Recomend",
      "optimizad",
      "Te conviene",
      "viaje más rápido",
      "ranking",
      "score",
    ]) {
      expect(block).not.toContain(forbidden);
    }
    // "mejora demostrable" is the design's own approved empty-state wording, so a bare substring
    // check on "mejor" would reject the correct copy. What must never appear is the superlative:
    // a claim that one order IS the best, rather than that one swap is provably lower.
    expect(block).not.toMatch(/\b(el|la|lo|un[ao]?|mi) mejor\b/i);
    expect(block).not.toMatch(/\bmejor(es)?\b(?!a)/i);
    expect(block).toContain(
      "No hay una alternativa local con mejora demostrable usando todos los traslados registrados"
    );
  });

  it("80b. the section never sorts or slices the alternatives it was given", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).not.toContain(".sort(");
    expect(block).not.toContain(".slice(");
    expect(block).not.toContain("[0]");
    const fullSource = await source();
    const grouping = fullSource.slice(
      fullSource.indexOf("const localSwapsByDayId"),
      fullSource.indexOf("function applyLocalSwap")
    );
    expect(withoutComments(grouping)).not.toContain(".sort(");
  });

  it("81. application requires an explicit click on an explicit button", async () => {
    const block = withoutComments(sectionBlock(await source()));
    expect(block).toContain("Aplicar este intercambio");
    expect(block).toContain("onClick={() => onApply(alternative)}");
    // The section itself owns no effect, timer or auto-invocation.
    expect(block).not.toContain("useEffect");
    expect(block).not.toContain("setTimeout");
  });

  it("82. applying goes through the stale guard and the ordinary single-day reorder", async () => {
    const fullSource = await source();
    const apply = withoutComments(
      fullSource.slice(
        fullSource.indexOf("function applyLocalSwap"),
        fullSource.indexOf("function moveUp")
      )
    );
    // One apply path only: the tested wrapper, which runs the stale guard itself and reaches the
    // mutation callback solely when the candidate is still applicable.
    expect(apply).toContain("applyEvidenceCompleteLocalSwap(");
    expect(apply).toContain("movePlaceWithinDay(dayId, placeIndex, direction)");
    // No other draft mutation is reachable from the apply path.
    for (const forbidden of [
      "setRouteIds",
      "movePlaceBetweenDays",
      "setVisitStartTime",
      "setDayAccommodationChoice",
      "setAccommodationLeg",
      "addInterHubSegment",
      "updateInterHubSegment",
      "removeInterHubSegment",
      "moveDay(",
      "addEmptyDay",
      "removeEmptyDay",
      "setStartDate",
      "setEndDate",
    ]) {
      expect(apply).not.toContain(forbidden);
    }
  });

  it("83/84/85. no inter-hub, accommodation or bounds presentation is touched by the section", async () => {
    const block = withoutComments(sectionBlock(await source()));
    for (const forbidden of [
      "InterHub",
      "interHub",
      "Accommodation",
      "accommodation",
      "TripBounds",
      "boundsAssessment",
    ]) {
      expect(block).not.toContain(forbidden);
    }
  });

  it("86. the temporal lock reaches the UI through the generator's own input", async () => {
    const fullSource = await source();
    const wiring = fullSource.slice(
      fullSource.indexOf("const localSwapGeneration"),
      fullSource.indexOf("const localSwapsByDayId")
    );
    expect(wiring).toContain("generateEvidenceCompleteLocalSwaps(");
    expect(wiring).toContain("{ routeIds, days: planningDays, visitStartTimes }");
    // The stale guard re-reads the same field at apply time.
    expect(fullSource).toContain(
      "{ routeIds, days: planningDays, visitStartTimes },\n      { resolvePlace: (placeId) => placeById.get(placeId) ?? null }"
    );
  });

  it("87. alternatives are derived on every render, so an apply never chains a second one", async () => {
    const fullSource = await source();
    const wiring = fullSource.slice(
      fullSource.indexOf("const localSwapGeneration"),
      fullSource.indexOf("function applyLocalSwap")
    );
    expect(wiring).toContain("useMemo");
    expect(wiring).toContain("[routeIds, planningDays, visitStartTimes, placeById]");
    // No accumulated state: no candidate list, savings tally or optimisation session is held.
    expect(fullSource).not.toMatch(/useState<[^>]*LocalSwap|setLocalSwap|savedAdvantage|totalSaved|optimisationSession/);
  });

  it("87b. nothing about an alternative is persisted, and the draft stays V7", async () => {
    const fullSource = await source();
    expect(fullSource).not.toMatch(/persistLocalSwap|writeLocalSwap|localSwapDraft|PLANNING_DRAFT_VERSION\s*=\s*8/);
    // The generator is fed by the draft; the draft is never fed by the generator.
    const wiring = fullSource.slice(
      fullSource.indexOf("const localSwapGeneration"),
      fullSource.indexOf("const localSwapsByDayId")
    );
    expect(withoutComments(wiring)).not.toContain("setDraft");
  });
});
