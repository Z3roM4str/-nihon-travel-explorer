import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string): Promise<string> {
  try {
    return await readFile(new URL(path, import.meta.url), "utf8");
  } catch {
    return "";
  }
}

describe("B9.3 — local ephemeral day-order tool", () => {
  it("opens a panel attached to the stable day and names its ordinal context", async () => {
    const panel = await source("./DayOrderToolPanel.tsx");
    const builder = await source("./OrderedSequenceBuilder.tsx");
    expect(builder).toContain("<DayOrderToolPanel");
    expect(builder).not.toContain("<LocalSwapAlternativesSection");
    expect(panel).toContain("Probar otro orden");
    expect(panel).toContain("Día {dayNumber}");
    expect(panel).toContain("Orden actual");
    expect(panel).toContain("Propuesta");
  });

  it("starts with a clone of the exact day baseline and edits no persisted draft", async () => {
    const panel = await source("./DayOrderToolPanel.tsx");
    expect(panel).toContain("useState(() => [...baselineDayPlaceIds])");
    expect(panel).toContain("movePlaceToPosition");
    expect(panel).not.toMatch(/setDraft|writeDraft|localStorage|sessionStorage|withDayPlaceOrderApplied/);
  });

  it("compares exactly the current day baseline and proposal through compareSequences", async () => {
    const panel = await source("./DayOrderToolPanel.tsx");
    expect(panel).toContain("compareSequences(baselineDayPlaceIds, proposalIds)");
    expect(panel).toContain("CandidateSummary");
  });

  it("loads evidence-complete alternatives into proposal state only", async () => {
    const panel = await source("./DayOrderToolPanel.tsx");
    expect(panel).toContain("alternative.dayId === toolDayId");
    expect(panel).toContain("alternative.baselineDayPlaceIds");
    expect(panel).toContain("setProposalIds([...alternative.candidateDayPlaceIds])");
    expect(panel).toContain("Comprobado con datos completos");
    expect(panel).toContain("Probar esta opción");
    expect(panel).not.toContain("Aplicar este intercambio");
  });

  it("has one explicit primary apply action and no proposal-A/B labels", async () => {
    const panel = await source("./DayOrderToolPanel.tsx");
    expect(panel.match(/Usar este orden/g)).toHaveLength(1);
    expect(panel).not.toContain("Orden A");
    expect(panel).not.toContain("Orden B");
  });

  it("fails closed on stale state and returns focus when the non-modal panel closes", async () => {
    const panel = await source("./DayOrderToolPanel.tsx");
    const builder = await source("./OrderedSequenceBuilder.tsx");
    expect(panel).toContain("dayIsStale");
    expect(panel).toContain("day-order-tool__stale");
    expect(builder).toContain("dayOrderTriggerRefs.current.get");
    expect(builder).toContain("event.stopImmediatePropagation()");
    expect(builder).toContain("aria-expanded={dayOrderSession?.dayId === dayEntity?.id}");
  });

  it("commits through one functional V8 draft mutation", async () => {
    const hook = await source("../usePlanningDraft.ts");
    const start = hook.indexOf("const applyDayPlaceOrder");
    const end = hook.indexOf("\n  );", start);
    const apply = hook.slice(start, end);
    expect(apply).toContain("setDraft((current) => withDayPlaceOrderApplied(current, dayId, expectedBaselineIds, proposalIds))");
    expect(apply.match(/setDraft\(/g)).toHaveLength(1);
  });
});
