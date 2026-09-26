import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("Astra SOL-0–2 correction wiring", () => {
  it("keeps votes separate and preserves authored ids for planner eligibility", async () => {
    const app = await source("../App.tsx");
    expect(app).toContain("getPlannerEligibility(review.legacyIds,review.store)");
    expect(app).toContain("...readAuthoredPlanIds(localStorage)");
    expect(app).not.toContain("usePlanningDraft(activeYesIds");
    expect(app).toContain("savedPlaces={plannerPlaces}");
    expect(app).toContain("review.reconsider(reconsiderId,review.store.activeReviewer!)");
    expect(app).not.toContain('review.disposition(id,"candidate");review.toggleInterest');
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
    expect(dialog).toContain('typeof returnFocus === "function" ? returnFocus() : returnFocus');
    expect(dialog).toContain("target?.focus()");
  });
  it("implements the independent F01–F09 correction contracts", async () => {
    const [app, discovery, card, recommendation, dialog, css] = await Promise.all([
      source("../App.tsx"), source("./Discovery.tsx"), source("./PlaceCard.tsx"),
      source("./recommendation.ts"), source("./RouteDialog.tsx"), source("./astra.css"),
    ]);
    expect(card.indexOf("astra-card__credit")).toBeLessThan(card.indexOf("astra-card__body"));
    expect(card).toContain("image.licenseUrl");
    expect(card).toContain("image.attributionTitle || image.sourceFileTitle");
    expect(card).toContain('loadState === "loading" &&');
    expect(recommendation).toContain('D: "Prescindible"');
    expect(discovery).toContain('<option value="__regions">Explorar por región</option>');
    expect(discovery).not.toContain("astra-region-link");
    expect(discovery).toContain("announceResults />");
    expect(app).toContain('role="alertdialog"');
    expect(app).toContain("history.state?.astraExploreOrigin");
    expect(app).toContain('route.surface !== "place"');
    expect(dialog).toContain('data-astra-modal=""');
    expect(css).toContain("line-height:1.25");
    expect(css).not.toContain("-webkit-line-clamp:2");
  });
});
