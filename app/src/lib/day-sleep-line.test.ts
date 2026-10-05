import { describe, expect, it } from "vitest";
import { describeDaySleepLine } from "./day-sleep-line";

const accommodations = [
  { id: "zone-anchor", label: "Shinjuku" },
  { id: "hotel", label: "Hotel Sakura" },
];
const zoneChoices = [{ hub: "Tokio", accommodationId: "zone-anchor" }];

describe("describeDaySleepLine", () => {
  it("names a concrete accommodation with «Dormís en»", () => {
    expect(describeDaySleepLine({ endAccommodationId: "hotel", lastPlaceHub: "Tokio", accommodations, zoneChoices }))
      .toEqual({ kind: "accommodation", label: "Hotel Sakura", text: "Dormís en Hotel Sakura" });
  });

  it("never says «Dormís en la zona X» when only the zone exists", () => {
    const viaBoundary = describeDaySleepLine({ endAccommodationId: "zone-anchor", lastPlaceHub: "Tokio", accommodations, zoneChoices });
    const viaHub = describeDaySleepLine({ endAccommodationId: null, lastPlaceHub: "Tokio", accommodations, zoneChoices });
    expect(viaBoundary.text).toBe("Zona para dormir: Shinjuku");
    expect(viaHub.text).toBe("Zona para dormir: Shinjuku");
    expect(viaBoundary.kind).toBe("zone");
  });

  it("asks to choose a zone when nothing is selected", () => {
    expect(describeDaySleepLine({ endAccommodationId: null, lastPlaceHub: "Kioto", accommodations, zoneChoices }))
      .toEqual({ kind: "none", label: null, text: "Elegir zona para dormir" });
    expect(describeDaySleepLine({ endAccommodationId: null, lastPlaceHub: null, accommodations: [], zoneChoices: [] }).kind).toBe("none");
  });

  it("keeps an explicit «no accommodation» decision, ahead of any zone, and never as a pending choice", () => {
    const line = describeDaySleepLine({ endAccommodationId: null, endIsNoAccommodation: true, lastPlaceHub: "Tokio", accommodations, zoneChoices });
    expect(line).toEqual({ kind: "no-accommodation", label: null, text: "Sin alojamiento esa noche" });
    expect(line.text).not.toMatch(/Elegir/);
  });

  it("falls back when the boundary points at an anchor that no longer exists", () => {
    expect(describeDaySleepLine({ endAccommodationId: "gone", lastPlaceHub: "Kioto", accommodations, zoneChoices }).kind).toBe("none");
  });
});
