import { describe, expect, it } from "vitest";
import {
  describePhotographyProcessing,
  PHOTOGRAPHY_PROCESSING_VALUES,
} from "./photography-attribution";

describe("photography attribution processing disclosure (Phase 4C)", () => {
  it("keeps the processing vocabulary closed", () => {
    expect(PHOTOGRAPHY_PROCESSING_VALUES).toEqual([
      "webp-reencoded",
      "resized-and-webp-reencoded",
    ]);
  });

  it("renders the WebP-only transformation factually", () => {
    expect(describePhotographyProcessing("webp-reencoded")).toBe(
      "Archivo optimizado por Nihon: convertido a WebP."
    );
  });

  it("renders resize + WebP without legal classification", () => {
    expect(describePhotographyProcessing("resized-and-webp-reencoded")).toBe(
      "Archivo optimizado por Nihon: redimensionado y convertido a WebP."
    );
  });

  it("renders no processing copy when the optional field is absent", () => {
    expect(describePhotographyProcessing(undefined)).toBeNull();
  });
});
