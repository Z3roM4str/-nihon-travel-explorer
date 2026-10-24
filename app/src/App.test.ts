import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Phase 3D-C's structural integration coverage for `App.tsx`'s filtering — source-scanning, no
 * jsdom/Testing Library (see `components/PlaceDetail.test.ts`'s module doc for why). The actual
 * filtering semantics (required excludes recommended, recommended excludes plain "No", etc.) are
 * proven once, thoroughly, in `lib/reservation.test.ts`'s `matchesReservationFilter` tests — that
 * IS the exact predicate `matchesFilters` below calls. What this file protects is that
 * `App.tsx` actually calls it, rather than reimplementing (or silently reverting to) the old
 * lossy `place.reservation.required` boolean check inline.
 */

async function readSource(): Promise<string> {
  return readFile(new URL("./App.tsx", import.meta.url), "utf8");
}

/** Isolates `matchesFilters`' own function body, from its declaration up to the next top-level
 * function, so assertions are scoped to the actual filtering logic this phase changed. */
function extractMatchesFiltersSource(fullSource: string): string {
  const start = fullSource.indexOf("function matchesFilters(");
  if (start === -1) throw new Error("Could not find matchesFilters in App.tsx");
  const nextFunctionStart = fullSource.indexOf("\nfunction ", start + 1);
  if (nextFunctionStart === -1) throw new Error("Could not find the end boundary of matchesFilters");
  return fullSource.slice(start, nextFunctionStart);
}

describe("App.tsx — reservation filtering wiring (source-scanning integration check)", () => {
  it("imports matchesReservationFilter from lib/reservation", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bmatchesReservationFilter\b[^}]*\}\s*from\s*["']\.\/lib\/reservation["']/
    );
  });

  it("matchesFilters calls the shared reservation predicate", async () => {
    const matchesFiltersSource = extractMatchesFiltersSource(await readSource());
    expect(matchesFiltersSource).toMatch(/matchesReservationFilter\(place,\s*filters\.reservation\)/);
  });

  it("matchesFilters no longer reads place.reservation.required as the filter predicate", async () => {
    const matchesFiltersSource = extractMatchesFiltersSource(await readSource());
    // The old lossy pattern this phase replaces — a bare boolean check that treated
    // "Recomendable"/"Opcional"/"No para espectador" identically to a plain "No".
    expect(matchesFiltersSource).not.toContain("place.reservation.required");
  });
});

/**
 * Phase 5A RC finding RC-01. `App.tsx` builds the "Grado" filter's option list from a literal
 * grade vocabulary, and `matchesFilters` treats a non-empty `filters.grades` as exhaustive. A
 * grade present in the catalogue but missing from that literal is therefore unreachable: its
 * places vanish the moment the user ticks every grade on offer, with no way to filter to them.
 *
 * The literal shipped as `["S", "A", "B", "C"]` while `data/places.json` carried four grade-D
 * places (JP-056, JP-104, JP-106, JP-177), so Osaka, Kioto and Okinawa each hid places behind a
 * filter the UI never offered. This test is data-driven rather than pinned to "D" so that any
 * future grade added to the catalogue fails here instead of silently disappearing from the UI.
 */
describe("App.tsx — grade filter vocabulary covers the catalogue (RC-01 regression)", () => {
  async function readGradeVocabulary(): Promise<string[]> {
    const source = await readSource();
    const match = source.match(/const grades = useMemo\(\s*\(\) =>\s*\[([^\]]*)\]/);
    if (!match) throw new Error("Could not find the grade vocabulary literal in App.tsx");
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }

  async function catalogueGrades(): Promise<string[]> {
    const raw = await readFile(new URL("./data/places.json", import.meta.url), "utf8");
    const places = JSON.parse(raw) as { grade: string }[];
    return [...new Set(places.map((p) => p.grade))];
  }

  it("offers every grade that exists in the catalogue", async () => {
    const offered = await readGradeVocabulary();
    const missing = (await catalogueGrades()).filter((g) => !offered.includes(g));
    expect(missing).toEqual([]);
  });

  it("still offers grade D specifically", async () => {
    expect(await readGradeVocabulary()).toContain("D");
  });

  it("keeps the vocabulary in editorial order, not alphabetical", async () => {
    const offered = await readGradeVocabulary();
    const editorial = ["S", "A", "B", "C", "D"];
    expect(offered).toEqual(editorial.filter((g) => offered.includes(g)));
  });

  it("offers no grade the catalogue does not use", async () => {
    const catalogue = await catalogueGrades();
    const phantom = (await readGradeVocabulary()).filter((g) => !catalogue.includes(g));
    expect(phantom).toEqual([]);
  });
});

/**
 * RC-01 companion: a grade the filter offers must also have a visual treatment. The map marker
 * and the list/detail badge both key off the grade string, so a grade with no palette entry and
 * no badge rule renders as an unstyled chip next to styled ones.
 */
describe("grade presentation covers every offered grade (RC-01 regression)", () => {
  it("PlaceMap has a marker colour for every catalogue grade", async () => {
    const source = await readFile(new URL("./components/PlaceMap.tsx", import.meta.url), "utf8");
    const block = source.match(/const gradeColors: Record<string, string> = \{([\s\S]*?)\}/);
    if (!block) throw new Error("Could not find gradeColors in PlaceMap.tsx");
    const keyed = [...block[1].matchAll(/^\s*([A-Z]):/gm)].map((m) => m[1]);
    const raw = await readFile(new URL("./data/places.json", import.meta.url), "utf8");
    const catalogue = [...new Set((JSON.parse(raw) as { grade: string }[]).map((p) => p.grade))];
    expect(catalogue.filter((g) => !keyed.includes(g))).toEqual([]);
  });

  it("App.css has a badge rule for every catalogue grade", async () => {
    const css = await readFile(new URL("./App.css", import.meta.url), "utf8");
    const raw = await readFile(new URL("./data/places.json", import.meta.url), "utf8");
    const catalogue = [...new Set((JSON.parse(raw) as { grade: string }[]).map((p) => p.grade))];
    const missing = catalogue.filter((g) => !css.includes(`.badge--grade-${g}`) || !css.includes(`.tag--grade-${g}`));
    expect(missing).toEqual([]);
  });
});
