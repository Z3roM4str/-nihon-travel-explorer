import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CARD_IMAGE_WIDTH, cardImageUrl } from "./data/place-images";
import registry from "./data/photography-metadata.json";

/**
 * Block 2. The card-sized derivative is deliberately *derived*, not declared: no registry
 * field carries it, so three independent places must agree on the same string rule — this
 * module, `scripts/build-photography-derivatives.py`, and `scripts/validate-photography.py`.
 * These tests hold that agreement, and hold the size claim that justifies the tier existing.
 */

type Record = { placeId: string; assetPath: string };
const records = (registry as { images: Record[] }).images;
const assetRoot = new URL("../public/", import.meta.url);

function derivativeOf(assetPath: string): string {
  return `${assetPath.slice(0, -".webp".length)}-${CARD_IMAGE_WIDTH}w.webp`;
}

describe("cardImageUrl mirrors the build script's naming rule", () => {
  it("appends the width suffix before the extension", () => {
    expect(cardImageUrl("images/places/JP-001/a-photo.webp")).toBe(
      "images/places/JP-001/a-photo-800w.webp"
    );
  });

  it("keeps any base-url prefix the registry put in front of the path", () => {
    expect(cardImageUrl("/nihon/images/places/JP-001/a.webp")).toBe(
      "/nihon/images/places/JP-001/a-800w.webp"
    );
  });

  it("returns null for a non-webp url, so a future remote image keeps its own single src", () => {
    expect(cardImageUrl("https://example.invalid/photo.jpg")).toBeNull();
    expect(cardImageUrl("images/places/JP-001/a.webp?v=2")).toBeNull();
  });

  it("never produces a derivative of a derivative", () => {
    const once = cardImageUrl("images/places/JP-001/a.webp");
    expect(once).not.toBeNull();
    expect(once).not.toContain("-800w-800w");
  });
});

describe("every registered photograph ships its card derivative", () => {
  it("has one derivative file per record", async () => {
    const missing: string[] = [];
    for (const record of records) {
      const path = new URL(derivativeOf(record.assetPath), assetRoot);
      try {
        await stat(path);
      } catch {
        missing.push(record.assetPath);
      }
    }
    expect(missing).toEqual([]);
  });

  it("registers no derivative as if it were an original", () => {
    expect(records.filter((r) => r.assetPath.endsWith(`-${CARD_IMAGE_WIDTH}w.webp`))).toEqual([]);
  });

  it("keeps every derivative lighter than its original", async () => {
    const heavier: string[] = [];
    for (const record of records) {
      const original = await stat(new URL(record.assetPath, assetRoot));
      const derivative = await stat(new URL(derivativeOf(record.assetPath), assetRoot));
      if (derivative.size >= original.size) heavier.push(record.assetPath);
    }
    expect(heavier).toEqual([]);
  });

  it("cuts the card surface's bytes by at least half — the reason this tier exists", async () => {
    let originals = 0;
    let derivatives = 0;
    for (const record of records) {
      originals += (await stat(new URL(record.assetPath, assetRoot))).size;
      derivatives += (await stat(new URL(derivativeOf(record.assetPath), assetRoot))).size;
    }
    expect(derivatives).toBeLessThan(originals * 0.5);
  });
});

describe("the surfaces that must use the derivative do", () => {
  const src = (path: string) => readFile(new URL(`./${path}`, import.meta.url), "utf8");

  it("the place card requests the card rendition, not the detail hero", async () => {
    const source = await src("components/PlaceCard.tsx");
    expect(source).toContain("cardImageUrl(image.url)");
    expect(source).toContain("src={cardSrc}");
  });

  it("the place card declares its box so the image cannot shift the text under it", async () => {
    const source = await src("components/PlaceCard.tsx");
    expect(source).toContain("width={CARD_IMAGE_WIDTH}");
    expect(source).toContain("height={Math.round((CARD_IMAGE_WIDTH * 9) / 16)}");
    expect(source).toContain("sizes=");
  });

  it("the saved-places thumbnail reuses the same rendition rather than the 1600px original", async () => {
    const source = await src("components/SelectionPanel.tsx");
    expect(source).toContain("cardImageUrl(thumbnail.url)");
  });

  it("the detail hero offers both renditions and lets the browser choose", async () => {
    const source = await src("components/PlaceGallery.tsx");
    expect(source).toContain("srcSet={heroSrcSet}");
    expect(source).toContain(`\${CARD_IMAGE_WIDTH}w, \${current.url} 1600w`);
  });

  it("the lightbox still loads the full-resolution original", async () => {
    const source = await src("components/PlaceGallery.tsx");
    const lightbox = source.slice(source.indexOf('className="lightbox"'));
    expect(lightbox).toContain("src={current.url}");
    expect(lightbox).not.toContain("cardImageUrl");
  });
});
