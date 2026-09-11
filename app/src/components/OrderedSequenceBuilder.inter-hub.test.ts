import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function builderSource(): Promise<string> {
  return readFile(new URL("./OrderedSequenceBuilder.tsx", import.meta.url), "utf8");
}

function sectionSource(source: string): string {
  const start = source.indexOf("function InterHubSegmentsSection");
  const end = source.indexOf("const FOCUSABLE", start);
  if (start === -1 || end === -1) throw new Error("InterHubSegmentsSection source boundary missing");
  return source.slice(start, end);
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("OrderedSequenceBuilder — Phase 3D-Y UI wiring", () => {
  it("renders one subsection in both relevant planner views, never a page, modal or wizard", async () => {
    const source = await builderSource();
    expect(source.match(/<InterHubSegmentsSection/g)).toHaveLength(2);
    expect(sectionSource(source)).toContain("Traslados entre ciudades");
    expect(sectionSource(source)).not.toMatch(/role="dialog"|modal|wizard/i);
  });

  it("creates only from domain-derived eligible pairs", async () => {
    const section = withoutComments(sectionSource(await builderSource()));
    expect(section).toContain("deriveEligibleInterHubPairs({ routeIds, days, resolvePlace })");
    expect(section).toContain("availablePairs.find");
    expect(section).toContain("fromHub: selectedPair.fromHub");
    expect(section).toContain("toHub: selectedPair.toHub");
  });

  it("does not infer mode or minutes", async () => {
    const section = withoutComments(sectionSource(await builderSource()));
    expect(section).toContain('useState<InterHubMode | "">("")');
    expect(section).toContain('useState("")');
    expect(section).toContain("Selecciona modo");
    expect(section).toContain("Duración manual del tramo principal");
    expect(section).not.toMatch(/defaultMode|defaultMinutes|inferMode|inferMinutes/);
  });

  it("keeps inactive segments visible with neutral reasons and shows active placement", async () => {
    const section = sectionSource(await builderSource());
    expect(section).toContain("segments.map");
    expect(section).toContain("assessInterHubSegment");
    expect(section).toContain("Activo ·");
    expect(section).toContain("Inactivo ·");
    expect(section).toContain("interHubPlacementText");
    expect(section).toContain("interHubInactiveText");
  });

  it("shows positional places, hub snapshots, mode, manual minutes and the scope disclaimer", async () => {
    const section = sectionSource(await builderSource());
    expect(section).toContain("{fromName} → {toName}");
    expect(section).toContain("{segment.fromHub} → {segment.toHub}");
    expect(section).toContain("INTER_HUB_MODE_LABELS");
    expect(section).toContain("min registrados manualmente");
    expect(section).toContain("Tramo principal entre estos dos puntos de tu plan;");
    expect(section).toContain("no es un tiempo puerta a puerta");
  });

  it("contains no routing, geometry, provider, price, booking or recommendation shortcut", async () => {
    const section = withoutComments(sectionSource(await builderSource()));
    expect(section).not.toMatch(/getBestTransfer|haversine|Math\.(sqrt|atan2|cos|sin)|\bfetch\b|openrouteservice/i);
    expect(section).not.toMatch(
      /mejor opción|ruta óptima|\bconviene\b|más rápido|llegarás a|toma este tren|toma este vuelo|reserva ahora|horario oficial|\bprecio\b|\btarifa\b/i
    );
  });

  it("keeps segment minutes outside every existing total", async () => {
    const section = withoutComments(sectionSource(await builderSource()));
    expect(section).not.toContain("TransferAndVisitTotals");
    expect(section).not.toContain("registeredTransferMinutes");
    expect(section).not.toMatch(/total del viaje/i);
  });

  it("wires create, edit and delete through the one V7 draft", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    expect(hook).toContain("withNewInterHubSegment(current, input, randomInterHubSegmentId)");
    expect(hook).toContain("withInterHubSegmentDetails(current, segmentId, mode, minutes)");
    expect(hook).toContain("withoutInterHubSegment(current, segmentId)");
    expect(hook).toContain("interHubSegments: draft.interHubSegments");
  });

  it("mints ids without time or semantic payload", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    const start = hook.indexOf("function randomInterHubSegmentId");
    const end = hook.indexOf("type SetStateAction", start);
    const factory = withoutComments(hook.slice(start, end));
    expect(factory).toContain("crypto.randomUUID");
    expect(factory).toContain("crypto.getRandomValues");
    expect(factory).not.toContain("Date.now");
    expect(factory).not.toMatch(/placeId|fromHub|toHub|mode|minutes|ordinal/);
  });
});
