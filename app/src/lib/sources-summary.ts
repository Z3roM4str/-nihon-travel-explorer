import type { PlaceImage } from "../types";

/**
 * B26 (`05 §11` «Fuentes y licencias») — lectura agregada de la fotografía del catálogo.
 *
 * Es sólo un conteo de lo que el catálogo YA registra en cada imagen (`source`, `license`,
 * `licenseUrl`): no añade ninguna licencia, ningún enlace ni ninguna fecha que el dato no afirme.
 * La atribución completa por imagen (autoría, archivo original, reprocesado) sigue en
 * `CreditsSheet`, en la ficha de cada lugar.
 */
export type LicenseGroup = {
  license: string;
  licenseUrl: string | null;
  imageCount: number;
};

export type PhotographySummary = {
  imageCount: number;
  placeCount: number;
  sources: string[];
  licenses: LicenseGroup[];
  /** Imágenes que no registran licencia — se cuentan, no se ocultan. */
  withoutLicenseCount: number;
};

export function summarizePhotography(
  registry: Record<string, readonly PlaceImage[]>
): PhotographySummary {
  const groups = new Map<string, LicenseGroup>();
  const sources = new Set<string>();
  let imageCount = 0;
  let placeCount = 0;
  let withoutLicenseCount = 0;

  for (const images of Object.values(registry)) {
    if (images.length > 0) placeCount += 1;
    for (const image of images) {
      imageCount += 1;
      if (image.source) sources.add(image.source);
      if (!image.license) {
        withoutLicenseCount += 1;
        continue;
      }
      const group = groups.get(image.license);
      if (group) {
        group.imageCount += 1;
        if (!group.licenseUrl && image.licenseUrl) group.licenseUrl = image.licenseUrl;
      } else {
        groups.set(image.license, {
          license: image.license,
          licenseUrl: image.licenseUrl ?? null,
          imageCount: 1,
        });
      }
    }
  }

  return {
    imageCount,
    placeCount,
    sources: [...sources].sort((a, b) => a.localeCompare(b, "es")),
    licenses: [...groups.values()].sort(
      (a, b) => b.imageCount - a.imageCount || a.license.localeCompare(b.license, "es")
    ),
    withoutLicenseCount,
  };
}
