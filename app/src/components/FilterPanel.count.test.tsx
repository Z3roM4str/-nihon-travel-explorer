import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FilterPanel } from "./FilterPanel";
import type { Filters } from "../types";

// 04 §13 / B10 L1: results are independent of the hub total and active-filter count.
// Real filter transitions and list identities are exercised by b10-l1-check.mjs.
describe("FilterPanel result count", () => {
  it.each([
    { resultCount: 0, totalCount: 57, activeFilterCount: 2, text: "0 lugares" },
    { resultCount: 1, totalCount: 57, activeFilterCount: 1, text: "1 lugar" },
    { resultCount: 57, totalCount: 57, activeFilterCount: 0, text: "57 lugares" },
    { resultCount: 0, totalCount: 0, activeFilterCount: 0, text: "0 lugares" },
  ])("announces $text and keeps the matching apply action", ({ text, ...counts }) => {
    const filters: Filters = {
      query: "", categories: ["Fotografía"], grades: [], planningBlocks: [],
      hiddenGemStatuses: [], tourismLevels: [], reservation: "all",
    };
    const before = JSON.stringify(filters);
    const html = renderToStaticMarkup(createElement(FilterPanel, {
      filters, ...counts, categoryGroups: [{ label: "Fotografía", values: ["Fotografía"] }],
      grades: [], planningBlocks: [], hiddenGemStatuses: [], tourismLevels: [],
      onChange: () => {}, onReset: () => {}, onApply: () => {},
    }));
    const status = html.match(/<p role="status">(.*?)<\/p>/)?.[1].replace(/<[^>]*>/g, "");
    expect(status).toBe(text);
    expect(html).toContain(`Ver ${text}</button>`);
    expect(html.includes(`Limpiar (${counts.activeFilterCount})`)).toBe(counts.activeFilterCount > 0);
    expect(html).toMatch(/aria-pressed="true"[^>]*>[\s\S]*?Fotografía/);
    expect(JSON.stringify(filters)).toBe(before);
  });
});
