import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { placeImages, resolvePlaceImages } from "./data/place-images";
import placesJson from "./data/places.json";

/**
 * Block 2, depth. `PlaceGallery` has shipped a complete carousel since before Block 1 — swipe,
 * arrows, dots, a `n / total` counter, keyboard navigation, a focus trap — and production never
 * exercised any of it, because `total > 1` was never true at one photograph per place.
 *
 * These tests hold the two things that matter now that galleries exist: that a gallery is a
 * deliberate editorial choice on a place that earns it, and that a second photograph never
 * becomes a way to smuggle in an image of somewhere else.
 */

type Place = { id: string; grade: string; tourismLevel: string; name: string };
const places = new Map((placesJson as Place[]).map((place) => [place.id, place]));

const galleries = Object.entries(placeImages).filter(([, images]) => images.length > 1);

describe("galleries exist only where the criterion was met", () => {
  it("adds depth only to places of the highest interest", () => {
    // Criterion 1: grade S, or grade A with Extremo/Alto prominence.
    for (const [placeId] of galleries) {
      const place = places.get(placeId);
      expect(place, placeId).toBeDefined();
      const qualifies =
        place!.grade === "S" ||
        (place!.grade === "A" && ["Extremo", "Alto"].includes(place!.tourismLevel));
      expect({ placeId, qualifies }).toEqual({ placeId, qualifies: true });
    }
  });

  it("never gives depth to a place that has no first photograph", () => {
    for (const [placeId, images] of galleries) {
      expect(images[0], placeId).toBeDefined();
    }
  });

  it("leaves the great majority of the catalogue at a single photograph", () => {
    // Depth is not a supply to be scaled; if this ratio ever inverts, the criterion stopped
    // being applied.
    const covered = Object.keys(placeImages).length;
    expect(galleries.length).toBeLessThan(covered * 0.1);
  });
});

describe("a second photograph is still of the same place", () => {
  it("keeps every image of a gallery under that place's own asset folder", () => {
    for (const [placeId, images] of galleries) {
      for (const image of images) {
        expect(image.url, `${placeId} ${image.url}`).toContain(`/images/places/${placeId}/`);
      }
    }
  });

  it("never repeats one source file across two images of the same place", () => {
    for (const [placeId, images] of galleries) {
      const titles = images.map((image) => image.sourceFileTitle);
      expect({ placeId, unique: new Set(titles).size }).toEqual({ placeId, unique: titles.length });
    }
  });

  it("never repeats one asset path anywhere in the registry", () => {
    const urls = Object.values(placeImages).flat().map((image) => image.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("carries full attribution on every image of a gallery, not just the first", () => {
    for (const [placeId, images] of galleries) {
      for (const [index, image] of images.entries()) {
        expect({ placeId, index, ok: Boolean(image.source && image.license) }).toEqual({
          placeId,
          index,
          ok: true,
        });
        if (image.license !== "CC0") {
          expect({ placeId, index, credited: Boolean(image.credit) }).toEqual({
            placeId,
            index,
            credited: true,
          });
        }
      }
    }
  });

  it("gives every image of a gallery its own distinct alt text", () => {
    for (const [placeId, images] of galleries) {
      const alts = images.map((image) => image.alt);
      expect({ placeId, unique: new Set(alts).size }).toEqual({ placeId, unique: alts.length });
      for (const alt of alts) expect(alt.trim().length).toBeGreaterThan(20);
    }
  });
});

describe("the carousel is now reachable by real data", () => {
  it("resolves more than one image for at least one place, so total > 1 can happen", () => {
    const multi = Object.keys(placeImages).filter((id) => resolvePlaceImages(id).length > 1);
    expect(multi.length).toBeGreaterThan(0);
  });

  it("still resolves exactly one image for a single-photograph place", () => {
    expect(resolvePlaceImages("JP-001")).toHaveLength(1);
  });

  it("still resolves none for an uncovered place", () => {
    expect(resolvePlaceImages("JP-033")).toHaveLength(0);
  });

  it("keeps the gallery's multi-image affordances wired to the real count", async () => {
    // Bloque 20 (B4, `04 §6`): el requisito —los indicadores dependen de la CANTIDAD real de
    // imágenes, no del breakpoint— sigue vigente palabra por palabra. Lo que cambia es que
    // ahora hay tres umbrales distintos en vez de uno, porque el contrato los distingue:
    // píldora y flechas con >1, puntos sólo con ≤5. La condición `{total > 1 && (` se sustituye
    // por las tres banderas nombradas que la derivan.
    const source = await readFile(new URL("./components/PlaceGallery.tsx", import.meta.url), "utf8");
    expect(source).toContain("const total = images.length");
    expect(source).toContain("const showCounter = total > 1");
    expect(source).toContain("const showArrows = total > 1");
    expect(source).toContain("const showDots = total > 1 && total <= MAX_DOTS");
    expect(source).toContain("gallery__counter");
  });
});
