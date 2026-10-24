import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/* Phase 3E-K UI wiring — what remains after the release-hardening pass retired the unmounted `LocalSwapAlternativesSection` (its copy, ranges, gap,
 * confidence, disclaimer, claims and Apply wiring are measured on the day tool that replaced it by `scripts/evidence-options-check.mjs` — same fixtures
 * and figures as `phase3e-k`; see docs/GATE_RETIREMENT_AUDIT.md). Kept: the generation the tool still consumes is derived on render and never persisted. */

async function source(): Promise<string> {
  return readFile(new URL("./OrderedSequenceBuilder.tsx", import.meta.url), "utf8");
}

function withoutComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("OrderedSequenceBuilder — Phase 3E-K UI (§33.123)", () => {
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

});
