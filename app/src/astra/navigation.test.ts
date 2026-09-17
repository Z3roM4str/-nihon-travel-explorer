import { describe, expect, it } from "vitest";
import { exploreHref, parseAstraRoute, placeHref } from "./navigation";

describe("Astra URL navigation", () => {
  it("falls back to Explorar for empty and unknown routes", () => {
    expect(parseAstraRoute("").surface).toBe("explore");
    expect(parseAstraRoute("#/desconocido").surface).toBe("explore");
  });
  it("parses destinations, hub state and place deep links", () => {
    expect(parseAstraRoute("#/explorar?hub=Kioto")).toEqual({ surface: "explore", hub: "Kioto", placeId: null });
    expect(parseAstraRoute("#/viaje/planificar").surface).toBe("trip");
    expect(parseAstraRoute("#/lugar/JP-002?hub=Tokio")).toEqual({ surface: "place", hub: "Tokio", placeId: "JP-002" });
  });
  it("encodes stable links", () => {
    expect(exploreHref("Monte Fuji")).toBe("#/explorar?hub=Monte%20Fuji");
    expect(placeHref("JP-002", "Tokio")).toBe("#/lugar/JP-002?hub=Tokio");
  });
});
