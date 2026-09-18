import { describe, expect, it } from "vitest";
import {
  EDITORIAL_AXES,
  NEUTRAL_AXES,
  PROXIMITY_BANDS,
  editorialContrasts,
  getZoneById,
  getZones,
  getZonesForHub,
  hubsWithZones,
  proximityBand,
  rankZonesBySavedPlaces,
  straightLineKm,
  zoneSavedPlacesFit,
} from "./accommodation-zone";
import type { Place } from "../types";
import placesJson from "../data/places.json";

const places = placesJson as unknown as Place[];
const byId = new Map(places.map((place) => [place.id, place]));
const pick = (...ids: string[]) => ids.map((id) => byId.get(id)!).filter(Boolean);

describe("the zone registry", () => {
  it("covers exactly the three hubs Block 3 modelled", () => {
    expect(hubsWithZones().sort()).toEqual(["Kioto", "Osaka", "Tokio"]);
  });

  it("offers 4–7 real alternatives per hub, not a directory of neighbourhoods", () => {
    for (const hub of hubsWithZones()) {
      const count = getZonesForHub(hub).length;
      expect({ hub, within: count >= 4 && count <= 7 }).toEqual({ hub, within: true });
    }
  });

  it("anchors every zone on a station inside its own hub's spread of places", () => {
    for (const zone of getZones()) {
      const hubPlaces = places.filter((place) => place.hub === zone.hub);
      const nearest = Math.min(
        ...hubPlaces.map((place) => straightLineKm(zone.anchor, place.coordinates))
      );
      // A zone anchored nowhere near any place in its hub would be mis-assigned.
      expect({ zone: zone.id, nearest: nearest < 25 }).toEqual({ zone: zone.id, nearest: true });
    }
  });

  it("resolves a zone by id and returns undefined for an unknown one", () => {
    expect(getZoneById("ZN-TOK-SHINJUKU")?.name).toBe("Shinjuku");
    expect(getZoneById("ZN-NOPE")).toBeUndefined();
  });
});

describe("facts stay separable from judgement", () => {
  it("gives every zone sourced provenance for its facts", () => {
    for (const zone of getZones()) {
      expect(zone.facts.provenance.sourceUrl.startsWith("https://")).toBe(true);
      expect(zone.facts.provenance.evidence.length).toBeGreaterThan(30);
    }
  });

  it("never attaches provenance to an editorial block", () => {
    for (const zone of getZones()) {
      expect(Object.keys(zone.editorial).sort()).toEqual(EDITORIAL_AXES.map((a) => a.key).sort());
    }
  });

  it("keeps every editorial axis an integer on the 1–5 scale", () => {
    for (const zone of getZones()) {
      for (const axis of EDITORIAL_AXES) {
        const value = zone.editorial[axis.key];
        expect({ zone: zone.id, axis: axis.key, ok: Number.isInteger(value) && value >= 1 && value <= 5 })
          .toEqual({ zone: zone.id, axis: axis.key, ok: true });
      }
    }
  });

  it("marks the axes where higher is not better, so nothing scores them as good", () => {
    expect(NEUTRAL_AXES.has("tourismIntensity")).toBe(true);
    for (const key of NEUTRAL_AXES) {
      expect(EDITORIAL_AXES.some((axis) => axis.key === key)).toBe(true);
    }
  });

  it("makes every zone state at least two honest drawbacks", () => {
    for (const zone of getZones()) {
      expect({ zone: zone.id, count: zone.tradeoffs.length >= 2 }).toEqual({ zone: zone.id, count: true });
    }
  });

  it("exposes no overall score — no zone is 'best' in the abstract", () => {
    for (const zone of getZones()) {
      const keys = Object.keys(zone);
      expect(keys.filter((k) => /score|rank|rating|best/i.test(k))).toEqual([]);
    }
  });
});

describe("straight-line geometry, honestly bounded", () => {
  it("is zero for a point against itself", () => {
    expect(straightLineKm({ lat: 35, lng: 139 }, { lat: 35, lng: 139 })).toBeCloseTo(0, 6);
  });

  it("is symmetric", () => {
    const a = { lat: 35.68, lng: 139.76 };
    const b = { lat: 34.98, lng: 135.75 };
    expect(straightLineKm(a, b)).toBeCloseTo(straightLineKm(b, a), 9);
  });

  it("matches a known Tokyo–Kyoto separation to within a few percent", () => {
    // Tokyo Station to Kyoto Station is ~367 km great-circle.
    const km = straightLineKm({ lat: 35.681382, lng: 139.766084 }, { lat: 34.985849, lng: 135.758767 });
    expect(km).toBeGreaterThan(355);
    expect(km).toBeLessThan(380);
  });

  it("bands distances without pretending to be a travel time", () => {
    expect(proximityBand(0.4)).toBe("doorstep");
    expect(proximityBand(2)).toBe("near");
    expect(proximityBand(7)).toBe("moderate");
    expect(proximityBand(40)).toBe("far");
  });

  it("keeps the band thresholds ordered and exhaustive", () => {
    const order = ["doorstep", "near", "moderate", "far"] as const;
    const maxima = order.map((band) => PROXIMITY_BANDS[band].maxKm);
    expect(maxima).toEqual([...maxima].sort((a, b) => a - b));
    expect(maxima[maxima.length - 1]).toBe(Infinity);
  });

  it("labels every band in the reader's terms, never in kilometres alone", () => {
    for (const band of Object.values(PROXIMITY_BANDS)) {
      expect(band.label.length).toBeGreaterThan(3);
      expect(band.hint).toMatch(/km/);
    }
  });
});

describe("fit against the places the user actually saved", () => {
  const shinjuku = getZoneById("ZN-TOK-SHINJUKU")!;
  const asakusa = getZoneById("ZN-TOK-ASAKUSA")!;

  it("considers nothing when nothing is saved", () => {
    const fit = zoneSavedPlacesFit(shinjuku, []);
    expect(fit.consideredCount).toBe(0);
    expect(fit.medianKm).toBeNull();
    expect(fit.nearest).toEqual([]);
  });

  it("ignores saved places in another hub, which say nothing about this zone", () => {
    const kyotoPlaces = places.filter((place) => place.hub === "Kioto").slice(0, 4);
    expect(zoneSavedPlacesFit(shinjuku, kyotoPlaces).consideredCount).toBe(0);
  });

  it("counts only the saved places of the zone's own hub", () => {
    const mixed = [...pick("JP-001", "JP-003"), ...places.filter((p) => p.hub === "Kioto").slice(0, 3)];
    expect(zoneSavedPlacesFit(shinjuku, mixed).consideredCount).toBe(2);
  });

  it("puts a Shibuya/Harajuku list closer to Shinjuku than to Asakusa", () => {
    const saved = pick("JP-001", "JP-003", "JP-005");
    const near = zoneSavedPlacesFit(shinjuku, saved).medianKm!;
    const far = zoneSavedPlacesFit(asakusa, saved).medianKm!;
    expect(near).toBeLessThan(far);
  });

  it("puts an Asakusa/Ueno list closer to Asakusa than to Shinjuku", () => {
    const saved = pick("JP-016", "JP-021", "JP-020");
    expect(zoneSavedPlacesFit(asakusa, saved).medianKm!).toBeLessThan(
      zoneSavedPlacesFit(shinjuku, saved).medianKm!
    );
  });

  it("bands add up to the number considered", () => {
    const saved = places.filter((place) => place.hub === "Tokio").slice(0, 12);
    const fit = zoneSavedPlacesFit(shinjuku, saved);
    const total = Object.values(fit.byBand).reduce((a, b) => a + b, 0);
    expect(total).toBe(fit.consideredCount);
  });

  it("returns the nearest saved places in ascending order", () => {
    const saved = places.filter((place) => place.hub === "Tokio").slice(0, 12);
    const km = zoneSavedPlacesFit(shinjuku, saved).nearest.map((n) => n.km);
    expect(km).toEqual([...km].sort((a, b) => a - b));
  });
});

describe("ranking answers one question and says so", () => {
  it("orders by median distance to the saved list", () => {
    const saved = pick("JP-016", "JP-020", "JP-021");
    const ranked = rankZonesBySavedPlaces(getZonesForHub("Tokio"), saved);
    const medians = ranked.map((entry) => entry.fit.medianKm).filter((v): v is number => v !== null);
    expect(medians).toEqual([...medians].sort((a, b) => a - b));
  });

  it("does not invent a winner when nothing is saved", () => {
    const ranked = rankZonesBySavedPlaces(getZonesForHub("Tokio"), []);
    expect(ranked.every((entry) => entry.fit.medianKm === null)).toBe(true);
  });

  it("sorts zones with nothing to measure last", () => {
    const saved = pick("JP-016");
    const ranked = rankZonesBySavedPlaces(
      [...getZonesForHub("Tokio"), ...getZonesForHub("Kioto")],
      saved
    );
    const firstNull = ranked.findIndex((entry) => entry.fit.medianKm === null);
    const lastNumber = ranked.map((e) => e.fit.medianKm).lastIndexOf(
      [...ranked].reverse().find((e) => e.fit.medianKm !== null)?.fit.medianKm ?? null
    );
    expect(firstNull).toBeGreaterThan(lastNumber - 1);
  });
});

describe("contrasts surface where the choice actually costs something", () => {
  it("returns nothing for fewer than two zones", () => {
    expect(editorialContrasts([getZoneById("ZN-TOK-SHINJUKU")!])).toEqual([]);
  });

  it("finds a real difference between a nightlife zone and a station zone", () => {
    const contrasts = editorialContrasts([
      getZoneById("ZN-OSA-NAMBA")!,
      getZoneById("ZN-OSA-SHIN-OSAKA")!,
    ]);
    expect(contrasts.length).toBeGreaterThan(0);
    expect(contrasts.map((c) => c.key)).toContain("nightlife");
  });

  it("orders by the size of the gap, widest first", () => {
    const contrasts = editorialContrasts(getZonesForHub("Tokio"));
    const spreads = contrasts.map((c) => c.spread);
    expect(spreads).toEqual([...spreads].sort((a, b) => b - a));
  });

  it("never reports an axis the zones agree on", () => {
    const contrasts = editorialContrasts(getZonesForHub("Kioto"), 2);
    for (const contrast of contrasts) expect(contrast.spread).toBeGreaterThanOrEqual(2);
  });
});
