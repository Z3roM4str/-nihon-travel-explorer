import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const sourcePath = new URL("./PlaceGallery.tsx", import.meta.url);

describe("PlaceGallery photography attribution presentation (Phase 4C)", () => {
  it("keeps source and license as distinct links", async () => {
    const source = await readFile(sourcePath, "utf8");
    expect(source).toContain('href={image.sourceUrl}');
    expect(source).toContain('href={image.licenseUrl}');
    expect(source).toContain("{image.license}");
  });

  it("renders Commons file provenance and only separately recorded attribution title", async () => {
    const source = await readFile(sourcePath, "utf8");
    expect(source).toContain("Archivo de Commons: {image.sourceFileTitle}");
    expect(source).toContain("Título de atribución: {image.attributionTitle}");
  });

  it("renders the factual local processing disclosure", async () => {
    const source = await readFile(sourcePath, "utf8");
    expect(source).toContain("describePhotographyProcessing(image.processing)");
    expect(source).toContain("{processing}");
  });

  it("does not introduce legal-status claims", async () => {
    const source = (await readFile(sourcePath, "utf8")).toLowerCase();
    for (const forbidden of ["compliant", "cleared", "verified license", "legalmente seguro"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
