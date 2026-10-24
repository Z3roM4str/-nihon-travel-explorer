import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Phase 3D-C's structural integration coverage for `FilterPanel.tsx`'s reservation filter
 * group — source-scanning, no jsdom/Testing Library (see `PlaceDetail.test.ts`'s module doc for
 * why). Proves the false Todas/Requiere reserva/Sin reserva binary was actually replaced, not
 * merely supplemented, and that the six filter option values match `lib/reservation.ts`'s
 * closed `ReservationFilterValue` union exactly.
 *
 * Manually verified end-to-end in a real browser: the "Reserva" filter group renders all six
 * options (Todas, Requiere reserva, Reserva recomendable, No requiere reserva, Reserva opcional,
 * Depende del rol) — see `docs/ROADMAP.md`'s Phase 3D-C entry.
 */

async function readSource(): Promise<string> {
  return readFile(new URL("./FilterPanel.tsx", import.meta.url), "utf8");
}

/** Isolates the "Reserva" `<FilterGroup>` block so assertions are scoped to the actual filter UI
 * this phase changed, not the whole ~220-line file. */
function extractReservationGroupSource(fullSource: string): string {
  const start = fullSource.indexOf('<FilterGroup label="Reserva"');
  if (start === -1) throw new Error('Could not find the Reserva <FilterGroup> in FilterPanel.tsx');
  const end = fullSource.indexOf("</FilterGroup>", start);
  if (end === -1) throw new Error("Could not find the closing </FilterGroup> for the Reserva group");
  return fullSource.slice(start, end);
}

describe("FilterPanel.tsx — reservation filter options (source-scanning integration check)", () => {
  it("exposes all six closed-union reservation filter values", async () => {
    const groupSource = extractReservationGroupSource(await readSource());
    for (const value of ["all", "required", "recommended", "not-required", "optional", "role-specific"]) {
      expect(groupSource, `value: "${value}"`).toContain(`value: "${value}"`);
    }
  });

  it("exposes the required, recommended, not-required, optional, and role-specific option labels", async () => {
    const groupSource = extractReservationGroupSource(await readSource());
    for (const label of [
      "Requiere reserva",
      "Reserva recomendable",
      "No requiere reserva",
      "Reserva opcional",
      "Depende del rol",
    ]) {
      expect(groupSource, label).toContain(label);
    }
  });

  it("no longer offers only the old two-option Requiere/Sin reserva binary", async () => {
    const groupSource = extractReservationGroupSource(await readSource());
    // The old label this phase replaces — "Sin reserva" collapsed every non-required nuance
    // (Recomendable, Opcional, No para espectador) into one bucket.
    expect(groupSource).not.toContain("Sin reserva");
  });
});
