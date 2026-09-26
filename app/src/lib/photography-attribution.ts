import type { PlaceImage } from "../types";

type PhotographyProcessing = NonNullable<PlaceImage["processing"]>;

export function describePhotographyProcessing(
  processing: PlaceImage["processing"]
): string | null {
  if (!processing) return null;

  switch (processing) {
    case "webp-reencoded":
      return "Archivo optimizado por Nihon: convertido a WebP.";
    case "resized-and-webp-reencoded":
      return "Archivo optimizado por Nihon: redimensionado y convertido a WebP.";
    default: {
      const exhaustive: never = processing;
      return exhaustive;
    }
  }
}

export const PHOTOGRAPHY_PROCESSING_VALUES: readonly PhotographyProcessing[] = [
  "webp-reencoded",
  "resized-and-webp-reencoded",
];

/**
 * Bloque 20 (B4, `04 §6`/`§7`) — ¿hay algo que leer detrás del botón `ⓘ`?
 *
 * Los seis campos de atribución son opcionales en `PlaceImage`, y ~una parte del catálogo no
 * tiene ninguno. Renderizar el botón de créditos igualmente abriría una hoja vacía, que es
 * «UI de funciones que no existen» (`08` prohibición 8). Vive aquí, junto al resto de la
 * lectura de atribución, y no en el componente: así ni la galería ni `CreditsSheet` tienen su
 * propia idea de qué cuenta como atribución.
 */
export function hasAttribution(image: PlaceImage): boolean {
  return Boolean(
    image.source ||
      image.credit ||
      image.license ||
      image.sourceFileTitle ||
      image.attributionTitle ||
      image.processing
  );
}

export function hasAnyAttribution(images: readonly PlaceImage[]): boolean {
  return images.some(hasAttribution);
}
