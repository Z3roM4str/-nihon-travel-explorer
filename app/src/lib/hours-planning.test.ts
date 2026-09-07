import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import { buildRecordedHoursSummary } from "./hours-planning";

const places = placesData as Place[];

/** Same synthetic-fixture technique `day-weekday-signal.test.ts` established for
 * `schedule.closures`: clone a real dataset place and override `schedule.hours`, so aggregation
 * behavior (order, duplicates, counts) can be tested without depending on any specific real
 * dataset id staying stable. */
function place(id: string, hours: string, overrides: Partial<Place> = {}): Place {
  const base = places.find((p) => p.schedule.hours === hours);
  const template = base ?? places[0];
  return { ...template, id, name: id, schedule: { ...template.schedule, hours }, ...overrides };
}

describe("buildRecordedHoursSummary — fixtures", () => {
  it("a SAFE recorded-24h place produces exactly one item, counted as safe", () => {
    const summary = buildRecordedHoursSummary([place("A", "Espacio público 24 h")]);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].hours.kind).toBe("recorded-24h");
    expect(summary.safeCount).toBe(1);
    expect(summary.conditionalCount).toBe(0);
    expect(summary.externalDependencyCount).toBe(0);
    expect(summary.unknownCount).toBe(0);
  });

  it("a SAFE recorded-interval place produces exactly one item, counted as safe", () => {
    const summary = buildRecordedHoursSummary([place("A", "09:00–17:00")]);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].hours.kind).toBe("recorded-interval");
    expect(summary.safeCount).toBe(1);
  });

  it("a PARTIAL conditional place produces exactly one item, counted as conditional", () => {
    const summary = buildRecordedHoursSummary([place("A", "Diurno")]);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].hours.kind).toBe("conditional");
    expect(summary.conditionalCount).toBe(1);
    expect(summary.safeCount).toBe(0);
  });

  it("an OPAQUE external-dependency place produces exactly one item, counted as external dependency", () => {
    const summary = buildRecordedHoursSummary([place("A", "Ferry estacional y meteorológico")]);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].hours.kind).toBe("external-dependency");
    expect(summary.externalDependencyCount).toBe(1);
  });

  it("an UNKNOWN place produces exactly one item, counted as unknown", () => {
    const summary = buildRecordedHoursSummary([place("A", "Tours en horas fijas")]);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].hours.kind).toBe("unknown");
    expect(summary.unknownCount).toBe(1);
  });

  it("unlike reservation-planning, EVERY place produces an item — none omitted, including UNKNOWN/OPAQUE", () => {
    const summary = buildRecordedHoursSummary([
      place("A", "Espacio público 24 h"),
      place("B", "Ferry estacional y meteorológico"),
      place("C", "Tours en horas fijas"),
    ]);
    expect(summary.items).toHaveLength(3);
    expect(summary.items.map((item) => item.placeId)).toEqual(["A", "B", "C"]);
  });

  it("a mixed list produces correct per-tier counts", () => {
    const summary = buildRecordedHoursSummary([
      place("A", "09:00–17:00"), // safe
      place("B", "Diurno"), // partial/conditional
      place("C", "Ferry estacional y meteorológico"), // opaque/external-dependency
      place("D", "Tours en horas fijas"), // unknown
      place("E", "Espacio público 24 h"), // safe
    ]);
    expect(summary.items).toHaveLength(5);
    expect(summary.safeCount).toBe(2);
    expect(summary.conditionalCount).toBe(1);
    expect(summary.externalDependencyCount).toBe(1);
    expect(summary.unknownCount).toBe(1);
  });

  it("preserves the input route order exactly", () => {
    const summary = buildRecordedHoursSummary([
      place("C", "Tours en horas fijas"),
      place("A", "09:00–17:00"),
      place("B", "Diurno"),
    ]);
    expect(summary.items.map((item) => item.placeId)).toEqual(["C", "A", "B"]);
  });

  it("reordering the route changes display order but never the underlying classification", () => {
    const orderA = buildRecordedHoursSummary([place("X", "Diurno"), place("Y", "09:00–17:00")]);
    const orderB = buildRecordedHoursSummary([place("Y", "09:00–17:00"), place("X", "Diurno")]);
    expect(orderA.items.map((item) => item.placeId)).toEqual(["X", "Y"]);
    expect(orderB.items.map((item) => item.placeId)).toEqual(["Y", "X"]);
    const factA = orderA.items.find((item) => item.placeId === "X")?.hours;
    const factB = orderB.items.find((item) => item.placeId === "X")?.hours;
    expect(factA).toEqual(factB);
  });

  it("never sorts by tier, category, opening time, closing time, or urgency", () => {
    // Unknown first, safe second in the input — must stay in that exact order.
    const summary = buildRecordedHoursSummary([place("A", "Tours en horas fijas"), place("B", "09:00–17:00")]);
    expect(summary.items.map((item) => item.placeId)).toEqual(["A", "B"]);
  });

  it("throws a fail-loud error naming the duplicate id when the same place appears twice — never silently deduplicates", () => {
    const duplicated = place("A", "09:00–17:00");
    expect(() => buildRecordedHoursSummary([duplicated, duplicated])).toThrow(/duplicate place id.*A/);
  });

  it("the duplicate-id error names the exact offending id, not a generic message", () => {
    const b = place("B", "Diurno");
    expect(() =>
      buildRecordedHoursSummary([place("A", "09:00–17:00"), b, b])
    ).toThrow("B");
  });

  it("an empty route produces an empty summary", () => {
    const summary = buildRecordedHoursSummary([]);
    expect(summary).toEqual({
      safeCount: 0,
      conditionalCount: 0,
      externalDependencyCount: 0,
      unknownCount: 0,
      items: [],
    });
  });

  it("is deterministic across repeated calls", () => {
    const route = [place("A", "09:00–17:00"), place("B", "Diurno")];
    const results = new Set(
      Array.from({ length: 5 }, () => JSON.stringify(buildRecordedHoursSummary(route)))
    );
    expect(results.size).toBe(1);
  });
});

describe("buildRecordedHoursSummary — full real dataset", () => {
  it("re-derives the current whole-dataset totals: 214 inputs -> 214 items, tiers 80/50/19/65", () => {
    const summary = buildRecordedHoursSummary(places);
    expect(summary.items).toHaveLength(214);
    expect(summary.safeCount).toBe(80);
    expect(summary.conditionalCount).toBe(50);
    expect(summary.externalDependencyCount).toBe(19);
    expect(summary.unknownCount).toBe(65);
    expect(
      summary.safeCount + summary.conditionalCount + summary.externalDependencyCount + summary.unknownCount
    ).toBe(214);
  });

  it("preserves the full dataset's order exactly", () => {
    const summary = buildRecordedHoursSummary(places);
    expect(summary.items.map((item) => item.placeId)).toEqual(places.map((p) => p.id));
  });

  it("does not throw across all 214 current places", () => {
    expect(() => buildRecordedHoursSummary(places)).not.toThrow();
  });

  it("every item carries a RecordedHoursFact with raw text preserved", () => {
    const summary = buildRecordedHoursSummary(places);
    for (const item of summary.items) {
      expect(item.hours.category).toBeDefined();
      expect(typeof item.hours.raw).toBe("string");
    }
  });
});
