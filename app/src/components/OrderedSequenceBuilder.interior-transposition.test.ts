import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/* Phase 3E-G UI wiring contracts 105-123 from the normative design §35 — what remains after the release-hardening pass retired the unmounted
 * `LocalSwapAlternativesSection` (items 105-119 and 122 were its copy/ranges/gap/confidence/disclaimer/claims/Apply wiring; they are measured on the
 * day tool that replaced it by `scripts/evidence-options-check.mjs` — same fixtures and figures as `phase3e-g` — and `DayOrderToolPanel.test.ts`;
 * see docs/GATE_RETIREMENT_AUDIT.md). Kept: the wiring of the GENERATION the tool still consumes (120-121 temporal lock, 123 derived on render). */

async function source(): Promise<string> {
  return (await readFile(new URL("./OrderedSequenceBuilder.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
}

function withoutComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("OrderedSequenceBuilder — Phase 3E-G UI (§35.105-123)", () => {
  it("120-121. the temporal lock is the domain module's exact affected set", async () => {
    const full = withoutComments(await source());
    // The component passes the persisted times straight through and never filters or widens them.
    expect(full).toContain("generateEvidenceCompleteInteriorTranspositions(");
    const memoStart = full.indexOf("generateEvidenceCompleteInteriorTranspositions(");
    const memo = full.slice(memoStart, memoStart + 260);
    expect(memo).toContain("visitStartTimes");
    expect(memo).not.toMatch(/affected|filter\(/);
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
