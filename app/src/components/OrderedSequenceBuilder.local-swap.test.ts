import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/*
 * Phase 3E-C — what remains of the UI half of the test contract in
 * `docs/EVIDENCE_COMPLETE_LOCAL_SWAP_DESIGN.md` §30 (items 73-87).
 *
 * The presentation of the old "Alternativas locales" panel (items 74-85: copy, ranges, gap, evidence mix, qualification, no
 * best/optimal claims, explicit Apply) belonged to `LocalSwapAlternativesSection`, which B9.3 stopped mounting and the
 * release-hardening pass RETIRED with its Apply handlers. Those claims are measured today on the surface that replaced it — the day tool —
 * by `scripts/evidence-options-check.mjs` (same fixtures and figures) and `DayOrderToolPanel.test.ts`; see
 * `docs/GATE_RETIREMENT_AUDIT.md`. Kept here: the wiring of the GENERATION the tool still consumes (temporal lock, derived on every render,
 * nothing persisted) and the guard that the retired component and its handlers do not come back.
 */

async function source(): Promise<string> {
  return (await readFile(new URL("./OrderedSequenceBuilder.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
}

function withoutComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("OrderedSequenceBuilder — Phase 3E-C local swap wiring", () => {
  it("73. the day-local tool is the only surface; the retired Apply disclosure, its handlers and hook mutations are gone", async () => {
    const fullSource = await source();
    expect(fullSource).toContain("<DayOrderToolPanel");
    for (const gone of ["LocalSwapAlternativesSection", "applyLocalSwap", "applyLocalRelocation", "applyInteriorTransposition", "applyFourPlaceReversal", "applyTwoPairBlockSwap", "confidenceMixText"]) {
      expect(fullSource, gone).not.toContain(gone);
    }
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    for (const gone of ["movePlaceWithinDay", "relocatePlaceWithinDay", "transposePlacesWithinDay", "reverseFourPlacesWithinDay", "swapTwoPairBlocksWithinDay"]) {
      expect(hook, gone).not.toContain(gone);
    }
    expect(fullSource).toContain("toolDayId={dayEntity.id}");
    const panel = withoutComments(await readFile(new URL("./DayOrderToolPanel.tsx", import.meta.url), "utf8"));
    expect(panel).toContain("Opciones comprobadas");
    expect(panel).toContain("Comprobado con datos completos");
    expect(panel).toContain("Probar esta opción");
    expect(panel).toContain("Usar este orden");
  });

  it("73b. the section is only offered per day, from that day's own alternatives", async () => {
    const fullSource = await source();
    expect(fullSource).toContain("localSwapsByDayId.get(dayEntity.id) ?? []");
    expect(fullSource).toContain('localSwapGeneration.kind !== "available"');
  });

  it("86. the temporal lock reaches the UI through the generator's own input", async () => {
    const fullSource = await source();
    const wiring = fullSource.slice(
      fullSource.indexOf("const localSwapGeneration"),
      fullSource.indexOf("const localSwapsByDayId")
    );
    expect(wiring).toContain("generateEvidenceCompleteLocalSwaps(");
    expect(wiring).toContain("{ routeIds, days: planningDays, visitStartTimes }");
  });

  it("87. alternatives are derived on every render, so nothing chains a second one", async () => {
    const fullSource = await source();
    const wiring = fullSource.slice(
      fullSource.indexOf("const localSwapGeneration"),
      fullSource.indexOf("function openDayOrderTool")
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
