import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PlaceImage } from "../types";
import { placeImages, resolvePlaceImages } from "./place-images";

const here = path.dirname(fileURLToPath(import.meta.url));
// The pilot manifest lives at the repo root (data/visual/...), never duplicated into
// app/src — only the metadata this file derives placeImages from is copied in, per the
// project's existing data/*.json -> app/src/data/*.json convention.
const pilotManifestPath = path.resolve(here, "../../../data/visual/photography-pilot.json");
const pilot = JSON.parse(readFileSync(pilotManifestPath, "utf-8")) as {
  places: { placeId: string; hub: string }[];
};
const pilotPlaceIds = pilot.places.map((p) => p.placeId);

describe("photography pilot manifest (Phase 4A)", () => {
  it("contains exactly 24 places", () => {
    expect(pilotPlaceIds).toHaveLength(24);
    expect(new Set(pilotPlaceIds).size).toBe(24);
  });

  it("has exactly 6 places per target hub", () => {
    const byHub = new Map<string, number>();
    for (const place of pilot.places) {
      byHub.set(place.hub, (byHub.get(place.hub) ?? 0) + 1);
    }
    expect(Object.fromEntries(byHub)).toEqual({
      Tokio: 6,
      Kioto: 6,
      Osaka: 6,
      Okinawa: 6,
    });
  });
});

describe("resolvePlaceImages — registry semantics (Phase 4A)", () => {
  it("resolves at least one image for every pilot place", () => {
    for (const placeId of pilotPlaceIds) {
      const images = resolvePlaceImages(placeId);
      expect(images.length, `expected ${placeId} to have a photograph`).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives a non-pilot place zero images, falling back to no registry entry", () => {
    for (const placeId of ["JP-999-does-not-exist", "JP-121", "JP-050"]) {
      if (pilotPlaceIds.includes(placeId)) continue;
      expect(resolvePlaceImages(placeId)).toEqual([]);
    }
  });

  it("every registry image resolves to a unique asset path across the whole registry", () => {
    const urls = Object.values(placeImages)
      .flat()
      .map((image) => image.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("every registry image carries a resolvable local asset URL, alt text, and Commons attribution", () => {
    for (const [placeId, images] of Object.entries(placeImages)) {
      for (const image of images) {
        expect(image.url, placeId).toMatch(/^\/images\/places\/JP-\d{3}\/[a-z0-9-]+\.webp$/);
        expect(image.alt?.length ?? 0, placeId).toBeGreaterThan(0);
        expect(image.source, placeId).toBe("Wikimedia Commons");
        expect(image.sourceUrl, placeId).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
        expect(image.license, placeId).toBeTruthy();
        expect(image.licenseUrl, placeId).toMatch(/^https:\/\/creativecommons\.org\//);
        expect(image.sourceFileTitle, placeId).toMatch(/^File:/);
        expect(
          ["webp-reencoded", "resized-and-webp-reencoded"],
          placeId
        ).toContain(image.processing);
      }
    }
  });

  it("carries only source-backed attribution titles for the three rechecked CC BY 2.0 records", () => {
    const titled = Object.entries(placeImages)
      .flatMap(([placeId, images]) =>
        images
          .filter((image) => image.attributionTitle)
          .map((image) => [placeId, image.attributionTitle] as const)
      );

    expect(titled).toEqual([
      ["JP-002", "Yoyogi Park and Shinjuku Skyline from Shibuya Sky Observation Deck"],
      ["JP-077", "Katsura Imperial Villa / 桂離宮 X"],
      ["JP-179", "DSC04640"],
    ]);
  });

  it("derives exactly 7 WebP-only records and 156 resized+WebP records from the committed metadata", () => {
    const processing = Object.values(placeImages).flat().map((image) => image.processing);
    expect(processing.filter((value) => value === "webp-reencoded")).toHaveLength(7);
    expect(processing.filter((value) => value === "resized-and-webp-reencoded")).toHaveLength(156);
    for (const placeId of ["JP-077", "JP-155", "JP-046", "JP-167", "JP-061", "JP-043", "JP-190"]) {
      expect(placeImages[placeId]?.[0]?.processing, placeId).toBe("webp-reencoded");
    }
  });

  it("carries the Phase 4D batch as the first photograph of each newly covered place", () => {
    // Phase 4D acquired 12 of its 16 S-grade targets; the other four failed closed on
    // subject-matter grounds and must still resolve to no photograph at all.
    //
    // Asserted as "first", not "only": the registry is append-only, so a later block adding a
    // second facet (Block 2 did, to JP-205) must leave this batch's own photograph in place and
    // in position. That is the property worth protecting — a re-ordering or a replacement would
    // silently rewrite a historical tranche's result.
    const acquired = [
      "JP-044", "JP-066", "JP-096", "JP-135", "JP-142", "JP-143",
      "JP-144", "JP-184", "JP-188", "JP-192", "JP-197", "JP-205",
    ];
    for (const placeId of acquired) {
      expect(placeImages[placeId]?.length, placeId).toBeGreaterThanOrEqual(1);
    }
    expect(placeImages["JP-205"]?.[0]?.url).toContain("odori-park-snow-festival");
    for (const deferred of ["JP-033", "JP-126", "JP-203", "JP-204"]) {
      expect(placeImages[deferred]).toBeUndefined();
    }
  });

  it("carries the Phase 4F tranche as 22 acquired targets and two explicit fallbacks", () => {
    const acquired = [
      "JP-068", "JP-210", "JP-155", "JP-103", "JP-206", "JP-009",
      "JP-099", "JP-108", "JP-018", "JP-085", "JP-164", "JP-115",
      "JP-037", "JP-093", "JP-160", "JP-141", "JP-040", "JP-102",
      "JP-174", "JP-116", "JP-092", "JP-005",
    ];
    for (const placeId of acquired) {
      expect(placeImages[placeId], placeId).toHaveLength(1);
    }
    for (const deferred of ["JP-195", "JP-050"]) {
      expect(placeImages[deferred], deferred).toBeUndefined();
    }
  });

  it("carries the Phase 4H tranche as 27 acquired targets and five explicit fallbacks", () => {
    const acquired = [
      "JP-101", "JP-207", "JP-028", "JP-070", "JP-161", "JP-111", "JP-008",
      "JP-090", "JP-180", "JP-151", "JP-046", "JP-159", "JP-128", "JP-016",
      "JP-127", "JP-208", "JP-098", "JP-167", "JP-146", "JP-026", "JP-061",
      "JP-182", "JP-118", "JP-049", "JP-058", "JP-181", "JP-015",
    ];
    for (const placeId of acquired) {
      expect(placeImages[placeId], placeId).toHaveLength(1);
    }
    for (const deferred of ["JP-121", "JP-156", "JP-095", "JP-079", "JP-202"]) {
      expect(placeImages[deferred], deferred).toBeUndefined();
    }
  });

  it("carries the Phase 4J tranche as 28 acquired targets and four explicit fallbacks", () => {
    const acquired = [
      "JP-214", "JP-100", "JP-163", "JP-123", "JP-013", "JP-073", "JP-183",
      "JP-022", "JP-055", "JP-194", "JP-014", "JP-059", "JP-189", "JP-124",
      "JP-078", "JP-165", "JP-117", "JP-043", "JP-060", "JP-138", "JP-006",
      "JP-081", "JP-198", "JP-105", "JP-039", "JP-212", "JP-011", "JP-047",
    ];
    for (const placeId of acquired) {
      expect(placeImages[placeId], placeId).toHaveLength(1);
    }
    for (const deferred of ["JP-120", "JP-211", "JP-041", "JP-168"]) {
      expect(placeImages[deferred], deferred).toBeUndefined();
    }
  });

  it("carries the Phase 4L tranche as 31 acquired targets and one explicit fallback", () => {
    const acquired = [
      "JP-084", "JP-190", "JP-149", "JP-012", "JP-062", "JP-176", "JP-122",
      "JP-213", "JP-087", "JP-200", "JP-112", "JP-053", "JP-064", "JP-158",
      "JP-113", "JP-007", "JP-063", "JP-185", "JP-130", "JP-042", "JP-065",
      "JP-172", "JP-139", "JP-051", "JP-067", "JP-169", "JP-114", "JP-020",
      "JP-186", "JP-052", "JP-017",
    ];
    for (const placeId of acquired) {
      expect(placeImages[placeId], placeId).toHaveLength(1);
    }
    expect(placeImages["JP-140"]).toBeUndefined();
  });

  /**
   * Phase 4A's "exactly one image per place" invariant, retired deliberately by Block 2 and
   * replaced rather than deleted.
   *
   * It held for five acquisition phases because no phase ever added a second photograph — not
   * because one was forbidden. Block 2 adds a second facet to six grade S places whose single
   * image showed an exterior or an aerial and not the experience. What still needs protecting
   * is that a gallery is a *decision*, never a side effect: every extra image must be an
   * intended one, on a place that was chosen for it.
   */
  it("gives a second photograph only to the places Block 2 deliberately chose", () => {
    const galleries = Object.entries(placeImages)
      .filter(([, images]) => images.length > 1)
      .map(([placeId]) => placeId)
      .sort();
    expect(galleries).toEqual(["JP-021", "JP-089", "JP-125", "JP-129", "JP-152", "JP-205"]);
  });

  it("keeps every other place at exactly one photograph", () => {
    const depth = new Set(["JP-021", "JP-089", "JP-125", "JP-129", "JP-152", "JP-205"]);
    for (const [placeId, images] of Object.entries(placeImages)) {
      if (depth.has(placeId)) continue;
      expect({ placeId, count: images.length }).toEqual({ placeId, count: 1 });
    }
  });

  it("never lets a gallery grow past a reviewable size", () => {
    // Not a supply to be scaled: each extra image is argued for one at a time in
    // docs/BLOCK_2_PHOTOGRAPHY_DESIGN.md. A jump past three means that stopped happening.
    for (const [placeId, images] of Object.entries(placeImages)) {
      expect({ placeId, withinLimit: images.length <= 3 }).toEqual({ placeId, withinLimit: true });
    }
  });

  it("covers 157 places", () => {
    expect(Object.keys(placeImages)).toHaveLength(157);
  });

  it("keeps every registered asset local and every source link on Commons", () => {
    for (const image of Object.values(placeImages).flat()) {
      expect(image.url.startsWith("/images/places/")).toBe(true);
      expect(image.sourceUrl?.startsWith("https://commons.wikimedia.org/")).toBe(true);
      expect(image.licenseUrl?.startsWith("https://creativecommons.org/")).toBe(true);
    }
  });

  it("merges embedded images ahead of registry images, preserving existing precedence", () => {
    const embedded: PlaceImage[] = [
      { url: "/embedded.jpg", alt: "Embedded fixture image" },
    ];
    const placeId = pilotPlaceIds[0];
    const merged = resolvePlaceImages(placeId, embedded);
    expect(merged[0]).toEqual(embedded[0]);
    expect(merged.length).toBe(1 + resolvePlaceImages(placeId).length);
  });

  it("returns only embedded images, unchanged, for a place with no registry entry", () => {
    const embedded: PlaceImage[] = [{ url: "/embedded.jpg", alt: "Embedded fixture image" }];
    const nonPilotId = "JP-121";
    expect(pilotPlaceIds.includes(nonPilotId)).toBe(false);
    expect(resolvePlaceImages(nonPilotId, embedded)).toEqual(embedded);
  });

  it("returns a fresh empty array (not a shared reference) for repeated calls with no images", () => {
    const a = resolvePlaceImages("JP-121");
    const b = resolvePlaceImages("JP-121");
    expect(a).toEqual([]);
    expect(a).not.toBe(b);
  });
});
