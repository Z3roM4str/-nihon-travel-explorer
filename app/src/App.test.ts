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
