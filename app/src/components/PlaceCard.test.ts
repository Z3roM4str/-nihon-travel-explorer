import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Block 1 structural coverage for the photo-led place card — source-scanning, no jsdom or
 * Testing Library, for the reason `PlaceDetail.test.ts`'s module doc records: this repository
 * has no component DOM harness and adding one is out of scope here.
 *
 * What this file protects is the card's contract, not its styling: the six things a scanning
 * reader must be able to answer, the two independent actions and their markup, and the
 * photography rules the project treats as non-negotiable.
 *
 * Verified end to end in Chromium at 390×844, 820×1180 and 1440×900 — see
 * `scripts/block1-ux-browser-audit.mjs`.
 */

async function readSource(): Promise<string> {
  return readFile(new URL("./PlaceCard.tsx", import.meta.url), "utf8");
}

describe("PlaceCard — what a scanning reader can answer", () => {
  it("reads the interest level through the shared ladder, not the raw grade letter", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\binterestLevelForPlace\b[^}]*\}\s*from\s*["']\.\.\/lib\/interest-level["']/
    );
    expect(source).toContain("interestLevelForPlace(place)");
    expect(source).toContain("{interest.label}");
  });

  it("carries the level's shape glyph as well as its colour class", async () => {
    const source = await readSource();
    expect(source).toContain("interest-badge__glyph");
    expect(source).toContain("{interest.glyph}");
    expect(source).toContain("badge--grade-${place.grade}");
  });

  it("names the category and the zone", async () => {
    const source = await readSource();
    expect(source).toContain("splitCategory(place.category)");
    expect(source).toContain("place.neighborhood || place.municipality");
  });

  it("shows a short reason drawn from the dataset, never generated", async () => {
    const source = await readSource();
    expect(source).toContain("place.differentiator");
    expect(source).toContain("place.description");
    expect(source).toContain("place-card__reason");
  });

  it("resolves visit time through the shared duration domain", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bresolveDuration\b[^}]*\}\s*from\s*["']\.\.\/lib\/duration["']/
    );
    expect(source).toContain("resolveDuration(place.duration)");
  });

  it("falls back to the editorial duration text rather than inventing a number", async () => {
    const source = await readSource();
    expect(source).toContain("place.duration.raw");
  });

  it("interprets reservation through the shared predicate, not the lossy boolean", async () => {
    const source = await readSource();
    expect(source).toContain("interpretPlaceReservation(place)");
    expect(source).not.toContain("place.reservation.required");
  });

  it("keeps tourism saturation as its own signal, not a downgrade of the level", async () => {
    const source = await readSource();
    expect(source).toContain("tourismCaution(place)");
    expect(source).toContain("place-card__fact--tourism");
  });
});

describe("PlaceCard — the two actions", () => {
  it("is an <article>, so the save control is not nested inside the open control", async () => {
    const source = await readSource();
    expect(source).toContain("<article");
    // The invalid shortcut this markup exists to avoid: a card-wide <button> wrapping another.
    expect(source).not.toMatch(/<button[^>]*>\s*[\s\S]{0,400}?<button/);
  });

  it("exposes the saved state to assistive technology", async () => {
    const source = await readSource();
    expect(source).toContain("aria-pressed={saved}");
  });

  it("labels the save control with what it will do and to which place", async () => {
    const source = await readSource();
    expect(source).toContain("Quitar ${place.name} de Quiero ir");
    expect(source).toContain("Guardar ${place.name} en Quiero ir");
  });

  it("uses a filled/hollow heart, so the state is not carried by colour alone", async () => {
    const source = await readSource();
    expect(source).toContain('saved ? "♥" : "♡"');
  });
});

describe("PlaceCard — photography rules", () => {
  it("resolves images only through the registry, never by guessing a path", async () => {
    const source = await readSource();
    expect(source).toContain("resolvePlaceImages(place.id, place.images)");
    expect(source).not.toMatch(/https?:\/\//);
  });

  it("lazy-loads and decodes off the main thread", async () => {
    const source = await readSource();
    expect(source).toContain('loading="lazy"');
    expect(source).toContain('decoding="async"');
  });

  it("handles the loading and error states instead of leaving a blank frame", async () => {
    const source = await readSource();
    expect(source).toContain('setMediaState("loaded")');
    expect(source).toContain('setMediaState("error")');
    expect(source).toContain("place-card__skeleton");
  });

  it("shows an editorial placeholder — never a stand-in photograph — when none exists", async () => {
    const source = await readSource();
    expect(source).toContain("place-card__placeholder");
    expect(source).toContain('category.icon || "⛩"');
  });

  it("leaves the decorative card image out of the accessibility tree", async () => {
    const source = await readSource();
    // The name, level, category and zone are already announced by the card's own text; a
    // repeated alt here would make every card read twice.
    expect(source).toContain('alt=""');
  });
});
