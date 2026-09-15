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
