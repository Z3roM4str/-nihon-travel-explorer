import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Phase 3D-C's structural integration coverage for `PlaceDetail.tsx`'s reservation display —
 * the same source-scanning technique `OrderedSequenceBuilder.test.ts` already established for
 * Phase 3D-B, for the same reason: this repository has no component DOM harness (no jsdom, no
 * Testing Library), and adding one is out of scope for this phase (no new dependency).
 *
 * The actual wording correctness ("Reserva recomendable"/"Reserva opcional" exist, generic "No
 * es necesaria" is reserved for the plain not-required category, role-specific nuance is
 * preserved verbatim) is proven once, thoroughly, in `lib/reservation.test.ts`'s
 * `describeReservationForUi` tests — that IS the exact function this component calls, so
 * duplicating those string assertions here would test the same logic twice under a different
 * name. What this file protects instead is the WIRING: that `PlaceDetail.tsx` actually calls the
 * shared domain function rather than reimplementing (or silently reverting to) its own
 * boolean-only interpretation of `place.reservation.required`.
 *
 * Manually verified end-to-end in a real browser (`npm run dev` + Playwright) for five
 * representative places — see `docs/ROADMAP.md`'s Phase 3D-C entry for the exact recorded
 * output.
 */

async function readSource(): Promise<string> {
  return readFile(new URL("./PlaceDetail.tsx", import.meta.url), "utf8");
}

describe("PlaceDetail.tsx — reservation domain wiring (source-scanning integration check)", () => {
  it("imports the reservation domain from lib/reservation", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bdescribeReservationForUi\b[^}]*\binterpretPlaceReservation\b[^}]*\}\s*from\s*["']\.\.\/lib\/reservation["']/
    );
  });

  it("computes the reservation display once from the place's raw reservation state", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /describeReservationForUi\(\s*interpretPlaceReservation\(place\)\s*,\s*place\.reservation\.leadTime\s*\)/
    );
  });

  it("renders the tag from the domain's own label/className, not a hardcoded 'Requiere reserva' literal", async () => {
    const source = await readSource();
    expect(source).toContain("reservation.tag.label");
    expect(source).toContain("reservation.tag.className");
    // The old lossy pattern this phase replaces — a literal boolean-gated tag — must be gone.
    expect(source).not.toMatch(/place\.reservation\.required\s*&&\s*<span/);
  });

  it("renders the practical-info 'Reserva' row from the domain's practicalRow, not a boolean ternary", async () => {
    const source = await readSource();
    expect(source).toMatch(/label="Reserva"\s+value=\{reservation\.practicalRow\}/);
    // The old lossy pattern this phase replaces: `place.reservation.required ? "Necesaria..." :
    // "No es necesaria"` collapsed every non-binary raw value into the same false branch.
    expect(source).not.toMatch(/place\.reservation\.required\s*\?/);
  });

  it("no longer reads place.reservation.required directly anywhere in this component", async () => {
    // The boolean is still a real field on Place (Phase 3D-C keeps it — see lib/reservation.ts's
    // module doc), but this component must resolve reservation semantics through the domain
    // function's output only, never by reading the boolean itself for a UI decision.
    const source = await readSource();
    expect(source).not.toContain("place.reservation.required");
  });
});
