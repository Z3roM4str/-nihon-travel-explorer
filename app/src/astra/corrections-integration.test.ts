import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("Astra SOL-0–2 correction wiring", () => {
  it("guards both save-removal paths and preserves authored ids for planner eligibility", async () => {
    const app = await source("../App.tsx");
    expect(app).toContain("canRemoveSavedPlace(id, localStorage)");
    expect(app.match(/canRemoveSavedPlace\(id, localStorage\)/g)).toHaveLength(2);
    expect(app).toContain("new Set([...savedIds, ...readAuthoredPlanIds(localStorage)])");
    expect(app).toContain("savedPlaces={plannerPlaces}");
  });
  it("uses lazy boundaries for map, national geography and planner", async () => {
    const [app, discovery] = await Promise.all([source("../App.tsx"), source("./Discovery.tsx")]);
    expect(app).not.toMatch(/^import .*NationalExplorer/m);
    expect(app).not.toMatch(/^import .*OrderedSequenceBuilder/m);
    expect(app).toContain('lazy(() => import("./components/NationalExplorer")');
    expect(app).toContain('lazy(() => import("./components/OrderedSequenceBuilder")');
    expect(discovery).toContain('lazy(() => import("../components/PlaceMap")');
  });
  it("owns detail modal semantics and focus isolation", async () => {
    const dialog = await source("./RouteDialog.tsx");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('setAttribute("inert"');
    expect(dialog).toContain("returnFocus?.focus()");
  });
});
