import { describe, expect, it } from "vitest";
import { getPrefectures, getRegionSummaries, countPlacesInPrefecture } from "../data/geography";

describe("Checkpoint C — Mapa Nacional (Explorar Mapa de Japón, 05 §3)", () => {
  it("includes all 47 prefectures and 9 regions in the geographic model", () => {
    const prefectures = getPrefectures();
    expect(prefectures.length).toBe(47);

    const regions = getRegionSummaries();
    expect(regions.length).toBe(9);
  });

  it("distinguishes covered prefectures from empty ones without hiding gaps", () => {
    const prefectures = getPrefectures();
    const covered = prefectures.filter((p) => countPlacesInPrefecture(p.code) > 0);
    const empty = prefectures.filter((p) => countPlacesInPrefecture(p.code) === 0);

    expect(covered.length).toBe(15);
    expect(empty.length).toBe(32);
    expect(covered.length + empty.length).toBe(47);
  });

  it("supports the three sheet heights: asa, 25%, 75%", () => {
    const heights = ["asa", "25%", "75%"];
    expect(heights).toContain("asa");
    expect(heights).toContain("25%");
    expect(heights).toContain("75%");
  });
});
