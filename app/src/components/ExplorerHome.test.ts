import { describe, expect, it } from "vitest";
import { getAllPlaces, getPlacesByHub } from "../data/store";
import { getPrefectures, countPlacesInPrefecture } from "../data/geography";
import { resolveDuration } from "../lib/duration";

describe("Checkpoint B — Portada (Explorar Inicio, 05 §2)", () => {
  it("derives the 4 main city counts dynamically from the dataset", () => {
    expect(getPlacesByHub("Tokio").length).toBe(57);
    expect(getPlacesByHub("Kioto").length).toBe(49);
    expect(getPlacesByHub("Osaka").length).toBe(53);
    expect(getPlacesByHub("Okinawa").length).toBe(50);
  });

  it("derives the 3 'Más destinos' counts with dynamic pluralization", () => {
    expect(getPlacesByHub("Sapporo").length).toBe(3);
    expect(getPlacesByHub("Nagoya").length).toBe(1);
    expect(getPlacesByHub("Fukuoka").length).toBe(1);

    const formatLabel = (count: number) => `${count} ${count === 1 ? "lugar" : "lugares"} por ahora`;
    expect(formatLabel(3)).toBe("3 lugares por ahora");
    expect(formatLabel(1)).toBe("1 lugar por ahora");
  });

  it("derives the 4 editorial collections pure from the dataset without hardcoded IDs", () => {
    const allPlaces = getAllPlaces();
    expect(allPlaces.length).toBe(214);

    const imprescindibles = allPlaces.filter((p) => p.grade === "S");
    expect(imprescindibles.length).toBe(32);

    const joyas = allPlaces.filter((p) => p.hiddenGemStatus === "Hidden Gem real");
    expect(joyas.length).toBe(35);

    const menosSaturado = allPlaces.filter((p) => p.hiddenGemStatus === "Alternativa menos saturada");
    expect(menosSaturado.length).toBe(14);

    const tarde = allPlaces.filter((p) => {
      const dur = resolveDuration(p.duration);
      return dur !== null && dur.maxMinutes <= 120;
    });
    expect(tarde.length).toBe(75);
  });

  it("derives the covered prefectures count dynamically for the map card subtitle", () => {
    const coveredCount = getPrefectures().filter((p) => countPlacesInPrefecture(p.code) > 0).length;
    expect(coveredCount).toBe(15);
    const subtitle = `47 prefecturas · ${coveredCount} con lugares en Nihon`;
    expect(subtitle).toBe("47 prefecturas · 15 con lugares en Nihon");
  });
});
