import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Phase 5A RC finding RC-02. `RegionNavigator` renders the place count as a visible
 * "N lugar/lugares" plus a screen-reader-only " verificado(s)" suffix. The visible noun was
 * pluralised but the hidden suffix was hardcoded plural, so a single-place region or prefecture
 * — Chugoku, Shikoku, Kyushu, Gifu, Shizuoka, Hiroshima, Kagawa, Fukuoka — was announced to
 * assistive technology as "1 lugar verificados".
 *
 * Source-scanning, matching the convention of `App.test.ts` and `FilterPanel.test.ts`:
 * `PlaceDetail.test.ts`'s module doc explains why these components are not mounted in jsdom.
 * `PrefecturePanel.tsx` already used the correct pattern and is asserted here as the reference.
 */
async function readSource(file: string): Promise<string> {
  return readFile(new URL(`./${file}`, import.meta.url), "utf8");
}

describe("RegionNavigator.tsx — screen-reader count agreement (RC-02 regression)", () => {
  it("never emits an unconditionally plural 'verificados' suffix", async () => {
    const source = await readSource("RegionNavigator.tsx");
    expect(source).not.toMatch(/<span className="visually-hidden">\s*verificados\s*<\/span>/);
  });

  it("pluralises the hidden suffix from the same count as the visible noun", async () => {
    const source = await readSource("RegionNavigator.tsx");
    const suffixes = [...source.matchAll(/verificado\{([^}]+)\}/g)].map((m) => m[1].trim());
    expect(suffixes.length).toBe(2);
    for (const suffix of suffixes) {
      expect(suffix).toMatch(/=== 1 \? "" : "s"/);
    }
  });

  it("pluralises the visible noun and the hidden suffix off the same expression", async () => {
    const source = await readSource("RegionNavigator.tsx");
    const nouns = [...source.matchAll(/lugar\{([^}]+?)\s*===\s*1/g)].map((m) => m[1].trim());
    const suffixes = [...source.matchAll(/verificado\{([^}]+?)\s*===\s*1/g)].map((m) => m[1].trim());
    expect(nouns.length).toBe(2);
    expect(suffixes).toEqual(nouns);
  });

  it("matches the agreement pattern PrefecturePanel already used", async () => {
    const reference = await readSource("PrefecturePanel.tsx");
    expect(reference).toMatch(/verificado\s*\n?\s*\{count === 1 \? "" : "s"\}/);
  });
});
