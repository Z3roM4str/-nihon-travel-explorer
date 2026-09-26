import { describe, expect, it } from "vitest";
import {
  MAP_GROUP_THRESHOLD,
  MARKER_HIT_GAP,
  MARKER_HIT_SIZE,
  groupScreenPoints,
  shouldGroupMarkers,
} from "./map-grouping";

// B24 (P0-4) — `03 §9` («por encima de 12 marcadores visibles, se agrupan») y Art. 11 (44 px,
// sin solapes ambiguos).

describe("umbral de agrupación (03 §9)", () => {
  it("es 12 y sólo agrupa POR ENCIMA de 12", () => {
    expect(MAP_GROUP_THRESHOLD).toBe(12);
    expect(shouldGroupMarkers(12)).toBe(false);
    expect(shouldGroupMarkers(13)).toBe(true);
  });

  it("usa --tap-min y --tap-gap como geometría de impacto (03 §7)", () => {
    expect(MARKER_HIT_SIZE).toBe(44);
    expect(MARKER_HIT_GAP).toBe(8);
  });
});

describe("groupScreenPoints", () => {
  const spacing = MARKER_HIT_SIZE + MARKER_HIT_GAP;

  it("deja sueltos los puntos que no se tocan", () => {
    const groups = groupScreenPoints([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 100, y: 0 },
      { id: "c", x: 0, y: 100 },
    ]);
    expect(groups.map((group) => group.ids)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("funde dos puntos cuyas cajas de 44 px se tocarían", () => {
    const groups = groupScreenPoints([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 30, y: 30 },
    ]);
    expect(groups).toEqual([{ ids: ["a", "b"], x: 15, y: 15 }]);
  });

  it("mide en Chebyshev: una diagonal de 52 px euclídeos sigue solapando cajas cuadradas", () => {
    const groups = groupScreenPoints([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 37, y: 37 },
    ]);
    expect(groups).toHaveLength(1);
  });

  it("al terminar, ninguna pareja de grupos queda a menos de 52 px en ningún eje dominante", () => {
    const points = Array.from({ length: 60 }, (_, index) => ({
      id: `p${index}`,
      x: (index * 37) % 300,
      y: (index * 53) % 260,
    }));
    const groups = groupScreenPoints(points);
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const distance = Math.max(Math.abs(groups[i].x - groups[j].x), Math.abs(groups[i].y - groups[j].y));
        expect(distance).toBeGreaterThanOrEqual(spacing);
      }
    }
    expect(groups.flatMap((group) => group.ids).sort()).toEqual(points.map((point) => point.id).sort());
  });

  it("es determinista y conserva el orden de entrada", () => {
    const points = [
      { id: "b", x: 0, y: 0 },
      { id: "a", x: 10, y: 0 },
      { id: "c", x: 200, y: 0 },
    ];
    expect(groupScreenPoints(points)).toEqual(groupScreenPoints(points));
    expect(groupScreenPoints(points)[0].ids).toEqual(["b", "a"]);
  });
});
