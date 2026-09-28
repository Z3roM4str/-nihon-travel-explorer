import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("Bloque 25 — Quiero ir", () => {
  it("presents the three-data summary and agreement immediately", async () => {
    const source = await read("./components/SelectionPanel.tsx");
    expect(source).toContain('aria-label="Resumen de lugares"');
    expect(source).toContain(">lugares<");
    expect(source).toContain(">ciudades<");
    expect(source).toContain("de visitas");
    expect(source.indexOf("selection-panel__summary")).toBeLessThan(source.indexOf("Los dos queréis ir"));
    expect(source).not.toContain("Analizar");
  });

  it("uses a view-only accessible person filter", async () => {
    const source = await read("./components/SelectionPanel.tsx");
    expect(source).toContain('aria-label="Filtrar lugares por persona"');
    expect(source).toContain("aria-pressed");
    expect(source).toContain("stanceFor(place.id, traveller.id)");
    expect(source).not.toContain("setActiveTraveller");
  });

  it("keeps divergences and uses the existing deliberate planner bridge", async () => {
    const panel = await read("./components/SelectionPanel.tsx");
    const app = await read("./App.tsx");
    expect(panel).toContain("Opiniones distintas");
    expect(panel).toContain("Llevar al viaje");
    expect(app).toContain("onBuildSequence={goToPlanner}");
  });

  it("replaces P1-13 text glyphs with the shared SVG icon set", async () => {
    const source = await read("./components/SelectionPanel.tsx");
    expect(source).not.toMatch(/[▾▴▸]/);
    expect(source).toContain('<Icon name="expandir"');
  });

  it("covers the real empty situations", async () => {
    const source = await read("./components/SelectionPanel.tsx");
    expect(source).toContain("Todavía no habéis marcado nada");
    expect(source).toContain("Todavía no hay coincidencias");
    expect(source).toContain("todavía no ha marcado lugares");
  });
});
