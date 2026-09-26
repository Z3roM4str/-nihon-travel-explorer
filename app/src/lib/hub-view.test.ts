import { describe, expect, it } from "vitest";
import { calculatedHubCore, HUB_EDITORIAL_VIEW, resolveHubView } from "./hub-view";
import placesData from "../data/places.json";

// DDR-B24-1 (resuelta): encuadre editorial por hub con fallback calculado. `FitHubBounds` nunca
// vuelve a hacer `fitBounds` de todos los lugares del hub.

type RawPlace = { hub: string; coordinates: { lat: number; lng: number } };
const places = placesData as RawPlace[];

function coordsFor(hub: string) {
  return places.filter((place) => place.hub === hub).map((place) => place.coordinates);
}

describe("DDR-B24-1 — encuadre editorial", () => {
  it("declara centro/zoom editorial para los cuatro hubs principales", () => {
    for (const hub of ["Tokio", "Kioto", "Osaka", "Okinawa"]) {
      expect(HUB_EDITORIAL_VIEW[hub]).toBeDefined();
      expect(HUB_EDITORIAL_VIEW[hub].zoom).toBeGreaterThan(0);
    }
  });

  it("resolveHubView usa el encuadre editorial para los hubs principales, no fitBounds de todos", () => {
    const view = resolveHubView("Tokio", coordsFor("Tokio"));
    expect(view).toEqual(HUB_EDITORIAL_VIEW.Tokio);
  });

  it("el encuadre editorial no lo determinan los outliers (Okutama, Izu, Okunoshima, Yonaguni)", () => {
    // La caja de TODOS los lugares de cada hub es muy mayor que su núcleo real; el centro
    // editorial cae dentro del núcleo, no en el centro geométrico de la caja completa.
    for (const hub of ["Tokio", "Kioto", "Osaka", "Okinawa"]) {
      const coords = coordsFor(hub);
      const latMin = Math.min(...coords.map((c) => c.lat));
      const latMax = Math.max(...coords.map((c) => c.lat));
      const lngMin = Math.min(...coords.map((c) => c.lng));
      const lngMax = Math.max(...coords.map((c) => c.lng));
      const bboxCenterLat = (latMin + latMax) / 2;
      const bboxCenterLng = (lngMin + lngMax) / 2;
      const [editorialLat, editorialLng] = HUB_EDITORIAL_VIEW[hub].center;
      const distanceFromBboxCenter = Math.hypot(
        editorialLat - bboxCenterLat,
        editorialLng - bboxCenterLng
      );
      // El centro editorial se aparta del centro de la caja de todos los lugares (que está
      // sesgado por las excursiones lejanas) en cada uno de los cuatro hubs.
      expect(distanceFromBboxCenter).toBeGreaterThan(0.005);
    }
  });

  it("núcleo calculado (fallback) reproduce la evidencia de la auditoría B24", () => {
    const expected: Record<string, number> = { Tokio: 48, Kioto: 39, Osaka: 23, Okinawa: 11 };
    for (const [hub, coreCount] of Object.entries(expected)) {
      const core = calculatedHubCore(coordsFor(hub));
      expect(core?.coreCount).toBe(coreCount);
    }
  });

  it("un hub sin configuración editorial cae al núcleo calculado, no a un fallback vacío", () => {
    const coords = [
      { lat: 35.0, lng: 135.0 },
      { lat: 35.01, lng: 135.01 },
      { lat: 40.0, lng: 141.0 }, // outlier lejano
    ];
    const view = resolveHubView("Hub-Sin-Editorial", coords);
    expect(view.center[0]).toBeCloseTo(35.005, 2);
    expect(view.center[1]).toBeCloseTo(135.005, 2);
  });

  it("sin lugares, cae al fallback de Japón sin lanzar", () => {
    const view = resolveHubView("Hub-Vacio", []);
    expect(view.zoom).toBeGreaterThan(0);
  });
});
