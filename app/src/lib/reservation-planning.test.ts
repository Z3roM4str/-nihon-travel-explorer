import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import { buildReservationPreparationSummary } from "./reservation-planning";

const places = placesData as Place[];

// Real, representative fixtures pulled from the current dataset (never invented): a plain
// not-applicable place, a bare-magnitude place, and an opaque-mechanism place.
const shibuyaCrossing = places.find((p) => p.id === "JP-001") as Place; // "—"
const yabijiCoralReef = places.find((p) => p.id === "JP-191") as Place; // "Semanas"
const nintendoMuseum = places.find((p) => p.id === "JP-097") as Place; // lottery text
const tokyoSkytree = places.find((p) => p.id === "JP-019") as Place; // "1–2 semanas"

describe("buildReservationPreparationSummary — fixtures", () => {
  it("fixtures resolve to the expected real dataset values", () => {
    expect(shibuyaCrossing.reservation.leadTime).toBe("—");
    expect(yabijiCoralReef.reservation.leadTime).toBe("Semanas");
    expect(nintendoMuseum.reservation.leadTime).toBe("Lotería 3 meses antes; revisar liberaciones");
    expect(tokyoSkytree.reservation.leadTime).toBe("1–2 semanas");
  });

  it("a not-applicable place is omitted from items", () => {
    const summary = buildReservationPreparationSummary([shibuyaCrossing]);
    expect(summary.items).toEqual([]);
    expect(summary.coarseMagnitudeCount).toBe(0);
    expect(summary.specificMechanismCount).toBe(0);
  });

  it("a bare-magnitude place produces exactly one item, counted as coarse magnitude", () => {
    const summary = buildReservationPreparationSummary([yabijiCoralReef]);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].placeId).toBe("JP-191");
    expect(summary.items[0].leadTime.kind).toBe("coarse-magnitude");
    expect(summary.coarseMagnitudeCount).toBe(1);
    expect(summary.specificMechanismCount).toBe(0);
  });

  it("an opaque-mechanism place produces exactly one item, counted as specific mechanism", () => {
    const summary = buildReservationPreparationSummary([nintendoMuseum]);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].placeId).toBe("JP-097");
    expect(summary.items[0].leadTime.kind).toBe("specific-mechanism");
    expect(summary.coarseMagnitudeCount).toBe(0);
    expect(summary.specificMechanismCount).toBe(1);
  });

  it("a mixed list produces correct counts and includes every applicable place", () => {
    const summary = buildReservationPreparationSummary([
      shibuyaCrossing,
      yabijiCoralReef,
      nintendoMuseum,
      tokyoSkytree,
    ]);
    expect(summary.items).toHaveLength(3);
    expect(summary.coarseMagnitudeCount).toBe(2);
    expect(summary.specificMechanismCount).toBe(1);
    expect(summary.items.map((item) => item.placeId)).toEqual(["JP-191", "JP-097", "JP-019"]);
  });

  it("preserves the input route order exactly, minus the omitted not-applicable places", () => {
    const summary = buildReservationPreparationSummary([
      tokyoSkytree,
      shibuyaCrossing,
      nintendoMuseum,
      yabijiCoralReef,
    ]);
    expect(summary.items.map((item) => item.placeId)).toEqual(["JP-019", "JP-097", "JP-191"]);
  });

  it("reordering the route changes display order but never the underlying classification", () => {
    const orderA = buildReservationPreparationSummary([yabijiCoralReef, nintendoMuseum]);
    const orderB = buildReservationPreparationSummary([nintendoMuseum, yabijiCoralReef]);
    expect(orderA.items.map((item) => item.placeId)).toEqual(["JP-191", "JP-097"]);
    expect(orderB.items.map((item) => item.placeId)).toEqual(["JP-097", "JP-191"]);
    // Same underlying facts regardless of position.
    const factA = orderA.items.find((item) => item.placeId === "JP-097")?.leadTime;
    const factB = orderB.items.find((item) => item.placeId === "JP-097")?.leadTime;
    expect(factA).toEqual(factB);
  });

  it("removing a place removes its signal", () => {
    const withBoth = buildReservationPreparationSummary([yabijiCoralReef, nintendoMuseum]);
    const withoutOne = buildReservationPreparationSummary([nintendoMuseum]);
    expect(withBoth.items).toHaveLength(2);
    expect(withoutOne.items).toHaveLength(1);
    expect(withoutOne.items[0].placeId).toBe("JP-097");
  });

  it("throws a fail-loud error naming the duplicate id when the same place appears twice — never silently deduplicates", () => {
    // A duplicate place id in the canonical route would indicate an upstream planning-draft/route
    // invariant regression (routeIds is supposed to be duplicate-free — see planning-draft.ts).
    // Silently dropping or keeping only one copy would hide that defect; this module surfaces it
    // instead, by name, rather than guessing which copy is "the real one."
    expect(() => buildReservationPreparationSummary([yabijiCoralReef, yabijiCoralReef])).toThrow(
      /duplicate place id.*JP-191/
    );
  });

  it("the duplicate-id error names the exact offending id, not a generic message", () => {
    expect(() => buildReservationPreparationSummary([nintendoMuseum, tokyoSkytree, nintendoMuseum])).toThrow(
      "JP-097"
    );
  });

  it("a duplicate not-applicable place still throws, even though neither copy would produce an item", () => {
    expect(() => buildReservationPreparationSummary([shibuyaCrossing, shibuyaCrossing])).toThrow(
      /JP-001/
    );
  });

  it("never sorts by magnitude, reservation category, or any derived urgency", () => {
    // Opaque first, coarse-magnitude second in the input — must stay in that exact order.
    const summary = buildReservationPreparationSummary([nintendoMuseum, tokyoSkytree, yabijiCoralReef]);
    expect(summary.items.map((item) => item.placeId)).toEqual(["JP-097", "JP-019", "JP-191"]);
  });

  it("an empty route produces an empty summary", () => {
    const summary = buildReservationPreparationSummary([]);
    expect(summary).toEqual({ coarseMagnitudeCount: 0, specificMechanismCount: 0, items: [] });
  });
});

describe("buildReservationPreparationSummary — full real dataset", () => {
  it("re-derives the current whole-dataset totals: 21 coarse-magnitude + 65 specific-mechanism = 86 items", () => {
    const summary = buildReservationPreparationSummary(places);
    expect(summary.coarseMagnitudeCount).toBe(21);
    expect(summary.specificMechanismCount).toBe(65);
    expect(summary.items).toHaveLength(86);
  });

  it("omits only the 128 not-applicable places", () => {
    const summary = buildReservationPreparationSummary(places);
    const includedIds = new Set(summary.items.map((item) => item.placeId));
    const omitted = places.filter((p) => !includedIds.has(p.id));
    expect(omitted).toHaveLength(128);
    for (const place of omitted) {
      expect(place.reservation.leadTime.trim() === "" || place.reservation.leadTime === "—").toBe(true);
    }
  });

  it("preserves the full dataset's order exactly", () => {
    const summary = buildReservationPreparationSummary(places);
    const expectedOrder = places
      .filter((p) => p.reservation.leadTime !== "—" && p.reservation.leadTime.trim() !== "")
      .map((p) => p.id);
    expect(summary.items.map((item) => item.placeId)).toEqual(expectedOrder);
  });

  it("every item carries both a ReservationFact and a ReservationLeadTimeFact, independently derived", () => {
    const summary = buildReservationPreparationSummary(places);
    for (const item of summary.items) {
      expect(item.reservation.category).toBeDefined();
      expect(item.leadTime.category).not.toBe("not-applicable");
    }
  });

  it("does not throw across all 214 current places", () => {
    expect(() => buildReservationPreparationSummary(places)).not.toThrow();
  });
});
