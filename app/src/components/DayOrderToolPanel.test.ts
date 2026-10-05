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
    expect(panel).toContain("Cambiar orden");
    expect(panel).not.toContain("Probar otro orden");
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
    // P-06 v2: ya no es un panel inline (aria-expanded); es una vista enfocada que devuelve el foco al disparador.
    expect(builder).toContain("<FocusedView label={`Cambiar orden del Día ${dayIndex + 1}`} onClose={closeDayOrderTool}>");
    expect(builder).toContain("aria-label={`Cambiar orden del Día ${dayIndex + 1}`}");
  });

  it("commits through one functional V8 draft mutation", async () => {
    const hook = await source("../usePlanningDraft.ts");
    const start = hook.indexOf("const applyDayPlaceOrder");
    const end = hook.indexOf("\n  );", start);
    const apply = hook.slice(start, end);
    expect(apply).toContain("setDraft((current) => withDayPlaceOrderApplied(current, dayId, expectedBaselineIds, proposalIds))");
    expect(apply.match(/setDraft\(/g)).toHaveLength(1);
  });

  /**
   * Cobertura moderna de la invariante «ninguna afirmación de optimización» que protegían las pruebas 80/92/112/123g del panel
   * heredado retirado (D5-M1 / LEGACY_SWAP_RETIREMENT). Aquí se fija sobre la herramienta VIVA; el gate `evidence-options-check`
   * la mide además sobre el texto renderizado.
   */
  it("makes no optimisation claim and never sorts, slices or ranks the alternatives it was given", async () => {
    const OPTIMISATION = /\bmejor(es)?\b|recomend|óptim|optim|ahorr|garantizad|ranking|puntuaci|score/i;
    for (const file of ["./DayOrderToolPanel.tsx", "../lib/day-order-tool.ts", "./SequenceCandidateSummary.tsx"]) {
      const code = (await source(file)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      const strings = [...code.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2]);
      expect(strings.filter((s) => OPTIMISATION.test(s)), file).toEqual([]);
      expect(code, file).not.toMatch(/\.sort\(|\.slice\(|\.toSorted\(/);
    }
  });
});
