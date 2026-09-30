import { describe, expect, it } from "vitest";
import { getAllPlaces } from "../data/store";
import { placesForTripHub } from "./zone-journey-context";

const tokyoPlaces = getAllPlaces().filter((place) => place.hub === "Tokio");
const kyotoPlaces = getAllPlaces().filter((place) => place.hub === "Kioto");

describe("zone proximity context comes from the trip route", () => {
  it("keeps only route places from the requested hub and preserves their route order", () => {
    const route = [tokyoPlaces[1].id, kyotoPlaces[0].id, tokyoPlaces[0].id];
    expect(placesForTripHub(route, "Tokio").map((place) => place.id)).toEqual([
      tokyoPlaces[1].id,
      tokyoPlaces[0].id,
    ]);
  });

  it("ignores unknown ids and returns no synthetic places for an empty hub route", () => {
    expect(placesForTripHub(["not-a-place"], "Tokio")).toEqual([]);
    expect(placesForTripHub([], "Tokio")).toEqual([]);
  });
});
