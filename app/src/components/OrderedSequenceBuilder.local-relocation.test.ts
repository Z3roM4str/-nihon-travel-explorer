import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/*
 * Phase 3E-E UI/browser integration contracts 85-103 from the normative design — what remains after the release-hardening pass retired the
 * unmounted `LocalSwapAlternativesSection` (items 86-97 and 100 were its copy/ranges/gap/confidence/disclaimer/claims/Apply wiring; they are
 * measured today on the day tool by `scripts/evidence-options-check.mjs` and `DayOrderToolPanel.test.ts` — docs/GATE_RETIREMENT_AUDIT.md).
 */

async function source(): Promise<string> {
  return readFile(new URL("./OrderedSequenceBuilder.tsx", import.meta.url), "utf8");
}

describe("OrderedSequenceBuilder — Phase 3E-E UI (§34.85-103)", () => {
  it("85. the day-local tool replaces the mounted swap/relocation disclosure; the retired panel is gone", async () => {
    const full = await source();
    expect(full).toContain("<DayOrderToolPanel");
    expect(full).not.toContain("LocalSwapAlternativesSection");
    expect(full).not.toContain("Alternativas locales con evidencia completa");
    expect(full).not.toContain("Aplicar este intercambio");
    expect(full).not.toContain("Aplicar esta reubicación");
  });

  it("98. the existing after-end warning remains outside and unchanged", async () => {
    const full = await source();
    expect(full).toContain("Este día es posterior a la fecha de fin de tu viaje.");
    expect(full).toContain("<TripBoundsDayWarning assessment={boundsAssessment} />");
  });

  it("99. affected manual times suppress generation (the day tool consumes the same generator)", async () => {
    const full = await source();
    const generation = full.slice(full.indexOf("const localRelocationGeneration"), full.indexOf("const localRelocationsByDayId"));
    expect(generation).toContain("{ routeIds, days: planningDays, visitStartTimes }");
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

  it("102-103. the executable Chromium gate that inherits 3E-E records and asserts zero console and page errors", async () => {
    const audit = await readFile(new URL("../../scripts/evidence-options-check.mjs", import.meta.url), "utf8");
    expect(audit).toContain("errors.length === 0 && pageErrors.length === 0");
    const shared = await readFile(new URL("../../scripts/lib/modern-trip.mjs", import.meta.url), "utf8");
    expect(shared).toContain('page.on("console"');
    expect(shared).toContain('page.on("pageerror"');
  });
});
