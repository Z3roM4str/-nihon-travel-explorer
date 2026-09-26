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
  it("es 12: la regla de agrupación general por densidad sigue activándose por encima de 12", () => {
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

// DDR-B24-2 (resuelta): además del umbral de densidad de `03 §9` (>12), existe una regla de
// seguridad geométrica independiente que agrupa dos o más marcadores sueltos aunque haya ≤12
// visibles, si sus cajas de impacto de 44 px se tocarían (Art. 11: sin solape ambiguo). Como
// `groupScreenPoints` sólo funde parejas que se tocarían, `PlaceMap` la aplica siempre — eso
// cubre las dos reglas con el mismo código y las vuelve a separar en cuanto el zoom las aleja.
describe("DDR-B24-2 — red de seguridad geométrica con ≤12 marcadores", () => {
  const TILE_SIZE = 256;

  /** Proyección Web Mercator (EPSG:3857) idéntica a la que usa Leaflet para `map.project`. */
  function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const scale = TILE_SIZE * 2 ** zoom;
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const x = ((lng + 180) / 360) * scale;
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return { x, y };
  }

  const conflicts: Record<string, [string, { lat: number; lng: number }][]> = {
    Tokio: [
      ["Shibuya Crossing", { lat: 35.6595, lng: 139.7005 }],
      ["SHIBUYA SKY", { lat: 35.6585, lng: 139.7022 }],
    ],
    Kioto: [
      ["Yasaka Kōshin-dō", { lat: 34.9995, lng: 135.7807 }],
      ["Kennin-ji", { lat: 35.0007, lng: 135.7739 }],
      ["Kōdai-ji", { lat: 35.0007, lng: 135.781 }],
      ["Gion Corner", { lat: 35.0, lng: 135.7755 }],
    ],
    Osaka: [
      ["Dotonbori", { lat: 34.6687, lng: 135.5013 }],
      ["Glico Running Man sign", { lat: 34.6686, lng: 135.5006 }],
      ["Hozenji Yokocho", { lat: 34.6674, lng: 135.5022 }],
    ],
    Okinawa: [
      ["Kokusai Street", { lat: 26.2155, lng: 127.6845 }],
      ["First Makishi Public Market", { lat: 26.2143, lng: 127.6872 }],
      ["Tsuboya Yachimun Street", { lat: 26.211, lng: 127.6916 }],
    ],
  };

  it.each(Object.entries(conflicts))(
    "%s: los lugares que la auditoría B24 encontró solapados se agrupan a nivel de barrio",
    (_hub, places) => {
      const zoom = 13; // encuadre de barrio: son ≤12 marcadores visibles, nunca se agrupaban antes
      const points = places.map(([id, coords]) => ({ id, ...project(coords.lat, coords.lng, zoom) }));
      const groups = groupScreenPoints(points);
      expect(groups.length).toBeLessThan(points.length);
    }
  );

  it("Shibuya Crossing / SHIBUYA SKY: vuelven a separarse en cuanto el zoom aleja sus cajas de 44 px", () => {
    const shibuya: [string, { lat: number; lng: number }][] = [
      ["Shibuya Crossing", { lat: 35.6595, lng: 139.7005 }],
      ["SHIBUYA SKY", { lat: 35.6585, lng: 139.7022 }],
    ];
    const closeZoom = shibuya.map(([id, c]) => ({ id, ...project(c.lat, c.lng, 15) }));
    const farZoom = shibuya.map(([id, c]) => ({ id, ...project(c.lat, c.lng, 19) }));
    expect(groupScreenPoints(closeZoom)).toHaveLength(1);
    expect(groupScreenPoints(farZoom)).toHaveLength(2);
  });

  it("con ≤12 marcadores que NO se tocan, cada uno sigue siendo su propio grupo", () => {
    const zoom = 15;
    const spread = [
      { id: "a", lat: 35.0, lng: 135.0 },
      { id: "b", lat: 35.02, lng: 135.02 },
      { id: "c", lat: 34.98, lng: 134.98 },
    ].map((p) => ({ id: p.id, ...project(p.lat, p.lng, zoom) }));
    expect(groupScreenPoints(spread)).toHaveLength(3);
  });
});
