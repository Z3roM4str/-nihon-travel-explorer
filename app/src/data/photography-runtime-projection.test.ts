import { describe, expect, it } from "vitest";
import { buildRegistry, placeImages, type PhotographyRecord } from "./place-images";
import fullMetadata from "./photography-metadata.json";
import { RUNTIME_PHOTOGRAPHY_FIELDS, projectPhotographyMetadata } from "./photography-runtime-projection";

const full = fullMetadata as unknown as { images: Record<string, unknown>[] };

describe("B10-P1 — la proyección de runtime del registro fotográfico", () => {
  it("construye exactamente el mismo registro que el JSON canónico completo", () => {
    // La invariante real: lo que la interfaz ve (`placeImages`) no cambia al reducir el JSON.
    expect(placeImages).toEqual(buildRegistry(full.images as unknown as PhotographyRecord[]));
  });

  it("conserva todas las imágenes, el orden y el número de registros", () => {
    const projected = projectPhotographyMetadata(full).images;
    expect(projected).toHaveLength(full.images.length);
    expect(projected.map((r) => r.assetPath)).toEqual(full.images.map((r) => r.assetPath));
  });

  it("sólo conserva campos que el runtime lee y no inventa ninguno", () => {
    const allowed = new Set<string>(RUNTIME_PHOTOGRAPHY_FIELDS);
    for (const record of projectPhotographyMetadata(full).images) {
      for (const key of Object.keys(record)) expect(allowed.has(key), key).toBe(true);
    }
  });

  it("buildRegistry no lee ningún campo fuera de la proyección (el LQIP no es de runtime)", () => {
    // Si alguien empieza a leer `lqip` (u otro campo) en place-images.ts, este test obliga a
    // añadirlo a RUNTIME_PHOTOGRAPHY_FIELDS: el registro de runtime dejaría de ser equivalente.
    const poisoned = full.images.map((r) => {
      const copy: Record<string, unknown> = { ...r };
      for (const key of Object.keys(copy)) if (!(RUNTIME_PHOTOGRAPHY_FIELDS as readonly string[]).includes(key)) copy[key] = undefined;
      return copy;
    });
    expect(buildRegistry(poisoned as unknown as PhotographyRecord[])).toEqual(placeImages);
  });
});
