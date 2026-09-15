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
    for (const placeId of ["JP-999-does-not-exist", "JP-006", "JP-050"]) {
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
      }
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
    const nonPilotId = "JP-006";
    expect(pilotPlaceIds.includes(nonPilotId)).toBe(false);
    expect(resolvePlaceImages(nonPilotId, embedded)).toEqual(embedded);
  });

  it("returns a fresh empty array (not a shared reference) for repeated calls with no images", () => {
    const a = resolvePlaceImages("JP-006");
    const b = resolvePlaceImages("JP-006");
    expect(a).toEqual([]);
    expect(a).not.toBe(b);
  });
});
