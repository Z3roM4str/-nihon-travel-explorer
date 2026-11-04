import { describe, expect, it } from "vitest";
import places from "../data/places.json";
import type { Place } from "../types";
import { hiddenGemLabel, hiddenGemOrder, hiddenGemTag, spanishAlias } from "./place";
import { categoryFilterIcon, categoryFilterLabel, categoryPresentation } from "./category-presentation";

const all = places as unknown as Place[];
const byId = (id: string) => all.find((p) => p.id === id)!;

describe("Lugares nuevos — etiquetas de joya en español", () => {
  it("traduce cada valor del dataset y deja intacto el dato", () => {
    expect(hiddenGemLabel("Hidden Gem real")).toBe("Joya escondida");
    expect(hiddenGemLabel("Semi-hidden")).toBe("Poco conocido");
    expect(hiddenGemLabel("Alternativa menos saturada")).toBe("Menos saturado");
    expect(hiddenGemLabel("Lugar conocido pero excelente")).toBe("Conocido y excelente");
    expect(hiddenGemLabel("Popular / turístico")).toBe("Popular");
    expect(hiddenGemLabel("No aplica")).toBe("Sin clasificar");
    expect(byId("JP-215").hiddenGemStatus).toBe("Hidden Gem real");
  });

  it("ningún valor real del dataset se queda sin traducir", () => {
    const statuses = new Set(all.map((p) => p.hiddenGemStatus).filter(Boolean) as string[]);
    for (const status of statuses) expect(hiddenGemLabel(status), status).not.toBe(status);
  });

  it("ordena el filtro de menos a más conocido", () => {
    const sorted = ["Popular / turístico", "Semi-hidden", "Hidden Gem real"].sort(
      (a, b) => hiddenGemOrder(a) - hiddenGemOrder(b)
    );
    expect(sorted).toEqual(["Hidden Gem real", "Semi-hidden", "Popular / turístico"]);
  });

  it("la etiqueta de joya sólo aparece en lugares que isHiddenGem reconoce", () => {
    expect(hiddenGemTag(byId("JP-215"))).toBe("Joya escondida"); // Hidden Gem real
    expect(hiddenGemTag(byId("JP-225"))).toBe("Poco conocido"); // Semi-hidden
    expect(hiddenGemTag(byId("JP-224"))).toBeNull(); // Popular / turístico
  });
});

describe("Lugares nuevos — nombre en español", () => {
  it("muestra mapTitle cuando dice algo distinto del nombre oficial", () => {
    expect(spanishAlias(byId("JP-224"))).toBe("Gran Buda de Kamakura (Kōtoku-in)");
  });

  it("no repite un mapTitle igual o que sólo acorta el nombre", () => {
    expect(spanishAlias(byId("JP-001"))).toBeNull();
    expect(spanishAlias(byId("JP-100"))).toBeNull();
  });
});

describe("Lugares nuevos — categorías", () => {
  it("«Deporte» tiene icono propio", () => {
    expect(categoryPresentation("⚽ Deporte")).toEqual({ label: "Deporte", icon: "categoria-deporte" });
  });

  it("el filtro agrupa las categorías de un solo lugar sin cambiar la etiqueta de la tarjeta", () => {
    expect(categoryFilterLabel("🌌 Cielo nocturno")).toBe("Nocturno");
    expect(categoryFilterLabel("🤖 Tecnología")).toBe("Museos");
    expect(categoryFilterLabel("🐋 Fauna y experiencias estacionales")).toBe("Naturaleza");
    expect(categoryFilterLabel("🍶 Gastronomía")).toBe("Gastronomía");
    expect(categoryPresentation("🤖 Tecnología").label).toBe("Tecnología");
    expect(categoryFilterIcon("Museos")).toBe("categoria-museos");
  });

  it("toda categoría del dataset tiene un icono propio (ninguna cae al genérico salvo Extraño)", () => {
    for (const raw of new Set(all.map((p) => p.category))) {
      const { label, icon } = categoryPresentation(raw);
      if (label !== "Extraño/peculiar/único") expect(icon, raw).not.toBe("categoria-extrano");
    }
  });
});
