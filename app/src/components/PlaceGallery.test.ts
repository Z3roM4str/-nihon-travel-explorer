import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Presentación de la atribución fotográfica — requisito de la Fase 4C, **vigente**, con la
 * superficie actualizada por el Bloque 20 (B4).
 *
 * Qué cambió y por qué. `04 §6`/`§7` y `05 §5` pt. 1 sacan los créditos del flujo de lectura:
 * hasta v1.1.0 los seis campos se pintaban como un párrafo entre la fotografía y el nombre
 * del lugar —el defecto D2, y una prohibición absoluta de `08`— y ahora viven en
 * `CreditsSheet`, detrás del botón `ⓘ`. El requisito original no se relaja ni se borra: los
 * mismos seis campos se siguen exigiendo, **en su nuevo sitio**, y además se añade lo que
 * antes no hacía falta comprobar — que la galería ya no los renderiza en el flujo.
 */

const galleryPath = new URL("./PlaceGallery.tsx", import.meta.url);
const sheetPath = new URL("./CreditsSheet.tsx", import.meta.url);

describe("Atribución fotográfica: los seis campos siguen presentes, ahora en CreditsSheet (04 §7)", () => {
  it("keeps source and license as distinct links", async () => {
    const source = await readFile(sheetPath, "utf8");
    expect(source).toContain("href={image.sourceUrl}");
    expect(source).toContain("href={image.licenseUrl}");
    expect(source).toContain("{image.license}");
    expect(source).toContain("{image.source}");
  });

  it("renders Commons file provenance and only separately recorded attribution title", async () => {
    const source = await readFile(sheetPath, "utf8");
    expect(source).toContain('label="Archivo de Commons">{image.sourceFileTitle}');
    expect(source).toContain('label="Título de atribución">{image.attributionTitle}');
  });

  it("renders the factual local processing disclosure", async () => {
    const source = await readFile(sheetPath, "utf8");
    expect(source).toContain("describePhotographyProcessing(image.processing)");
    expect(source).toContain("{processing}");
  });

  it("conserva la autoría, que en v1.1.0 se pintaba sin etiqueta tras un «·»", async () => {
    const source = await readFile(sheetPath, "utf8");
    expect(source).toContain("{image.credit}");
  });

  it("does not introduce legal-status claims", async () => {
    const sheet = (await readFile(sheetPath, "utf8")).toLowerCase();
    const gallery = (await readFile(galleryPath, "utf8")).toLowerCase();
    for (const forbidden of ["compliant", "cleared", "verified license", "legalmente seguro"]) {
      expect(sheet).not.toContain(forbidden);
      expect(gallery).not.toContain(forbidden);
    }
  });
});

describe("Defecto D2: la galería ya no renderiza atribución en el flujo (04 §6, 08 prohibición 9)", () => {
  it("PlaceGallery no lee ningún campo de atribución para pintarlo", async () => {
    const source = await readFile(galleryPath, "utf8");
    for (const field of [
      "image.source",
      "image.credit",
      "image.license",
      "image.sourceFileTitle",
      "image.attributionTitle",
      "image.processing",
    ]) {
      expect(source).not.toContain(`{${field}}`);
    }
    expect(source).not.toContain("gallery__credit\"");
    expect(source).not.toContain("describePhotographyProcessing");
  });

  it("el botón ⓘ existe, abre CreditsSheet y sólo se renderiza si hay algo que leer", async () => {
    const source = await readFile(galleryPath, "utf8");
    expect(source).toContain("gallery__credits");
    expect(source).toContain("setCreditsOpen(true)");
    expect(source).toContain("const showCredits = hasAnyAttribution(images)");
    expect(source).toContain("{showCredits && (");
  });
});

describe("PlaceGallery — recovery after an image load error", () => {
  it("shows retry only in the failed slide and retries that same image URL", async () => {
    const source = await readFile(galleryPath, "utf8");
    expect(source).toContain("const isBroken = failed[image.url];");
    expect(source).toContain('className="gallery__retry"');
    expect(source).toContain('aria-label={`Reintentar imagen ${slide + 1} de ${total}`}');
    expect(source).toContain("[image.url]: (state[image.url] ?? 0) + 1");
    expect(source).toContain("delete next[image.url];");
    expect(source).toContain('key={`${image.url}-${attempts[image.url] ?? 0}`}');
    expect(source).toContain("src={image.url}");
  });

  it("keeps carousel focus and preserves navigation, lightbox, and credits wiring", async () => {
    const source = await readFile(galleryPath, "utf8");
    expect(source).toContain("trackRef.current?.focus({ preventScroll: true });");
    expect(source).toContain('onKeyDown={handleKeyDown}');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("openerRef.current?.focus()");
    expect(source).toContain("setCreditsOpen(true)");
    expect(source).toContain("images={images}");
    expect(source).toContain('onError={() => setFailed((state) => ({ ...state, [image.url]: true }))}');
  });

  it("gives retry a real 44px target styled with the existing design tokens", async () => {
    const css = await readFile(new URL("../App.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.gallery__retry\s*\{[^}]*min-width:\s*var\(--tap-min\)/s);
    expect(css).toMatch(/\.gallery__retry\s*\{[^}]*min-height:\s*var\(--tap-min\)/s);
    expect(css).toMatch(/\.gallery__retry\s*\{[^}]*border-radius:\s*var\(--radius-md\)/s);
  });
});
