// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PlaceImage } from "../types";
import { PlaceGallery } from "./PlaceGallery";

afterEach(cleanup);

// Test-only media: distinct URLs deliberately exercise carousel behavior without changing live data.
const testImages: PlaceImage[] = [1, 2, 3].map(number => ({
  url: `/test-only/gallery-${number}.jpg`, alt: `Vista de prueba ${number}`,
  source: `Fuente de prueba ${number}`, sourceUrl: `https://example.test/source/${number}`,
  credit: "Una atribución de prueba deliberadamente larga para verificar que el crédito completo puede envolver sin recortarse",
  license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceFileTitle: `Test-only-${number}.jpg`, attributionTitle: `Vista ${number}`, processing: "resized-and-webp-reencoded",
}));

describe("PlaceGallery SOL-3", () => {
  it("renders an honest zero-image state", () => {
    const view = render(<PlaceGallery images={[]} imageBrief="not rendered" placeName="Lugar" />);
    expect(view.getByRole("img", { name: "Fotografía pendiente de Lugar" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Imagen siguiente" })).toBeNull();
  });

  it("has no carousel controls for exactly one real image", () => {
    const view = render(<PlaceGallery images={[testImages[0]]} imageBrief="" placeName="Lugar" />);
    expect(view.getAllByRole("img")).toHaveLength(1);
    expect(view.queryByRole("button", { name: "Imagen siguiente" })).toBeNull();
    expect(view.queryByText("1 de 1")).toBeNull();
  });

  it("navigates three distinct test-only images horizontally, but ignores vertical gestures", () => {
    const view = render(<PlaceGallery images={testImages} imageBrief="" placeName="Lugar" />);
    const group = view.getByRole("group", { name: "Fotografías de Lugar" });
    fireEvent.touchStart(group, { changedTouches: [{ clientX: 100, clientY: 20 }] });
    fireEvent.touchEnd(group, { changedTouches: [{ clientX: 50, clientY: 120 }] });
    expect(view.getByText("1 de 3")).toBeTruthy();
    fireEvent.touchStart(group, { changedTouches: [{ clientX: 100, clientY: 20 }] });
    fireEvent.touchEnd(group, { changedTouches: [{ clientX: 40, clientY: 25 }] });
    expect(view.getByText("2 de 3")).toBeTruthy();
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(view.getByText("3 de 3")).toBeTruthy();
  });

  it("shows failure in place and performs a real retry of the same URL", () => {
    const view = render(<PlaceGallery images={[testImages[0]]} imageBrief="" placeName="Lugar" />);
    fireEvent.error(view.getByRole("img"));
    expect(view.getByText("No pudimos cargar esta foto.")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Reintentar" }));
    expect((view.getByRole("img") as HTMLImageElement).src).toContain(testImages[0].url);
  });

  it("opens accessible fullscreen, exposes full credits, closes topmost, and restores its opener", async () => {
    const view = render(<div role="dialog" aria-modal="true" aria-label="Ficha"><PlaceGallery images={testImages} imageBrief="" placeName="Lugar" /></div>);
    const opener = view.getByRole("button", { name: "Ver Lugar a pantalla completa" });
    fireEvent.click(opener);
    const lightbox = within(document.body).getByRole("dialog", { name: "Lugar" });
    const detail = view.getByRole("dialog", { name: "Ficha" });
    expect(detail.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(within(lightbox).getByRole("button", { name: "Cerrar pantalla completa" }));
    fireEvent.keyDown(document, { key: "Tab" });
    expect(lightbox.contains(document.activeElement)).toBe(true);
    expect(within(lightbox).getByText(/Una atribución de prueba deliberadamente larga/)).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(within(document.body).queryByRole("dialog", { name: "Lugar" })).toBeNull();
    await Promise.resolve();
    expect(detail.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});
