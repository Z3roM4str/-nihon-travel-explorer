import { describe, expect, it } from "vitest";
import type { Place } from "../types";
import {
  CONCENTRATION_MIN_SAVED,
  blockDistribution,
  concentration,
  groupByCluster,
  groupByHub,
  groupByPrefecture,
  groupPrefectureName,
  summarizeSelection,
} from "./selection";

/**
 * Fixtures carry only the fields the selection layer reads. Everything else on Place is
 * irrelevant here, so the cast keeps the tests readable rather than restating the schema.
 */
function place(
  id: string,
  hub: string,
  cluster: string,
  prefecture: string,
  raw: string,
  minMinutes?: number,
  maxMinutes?: number
): Place {
  return {
    id,
    hub,
    cluster,
    prefecture,
    name: id,
    duration: minMinutes === undefined ? { raw } : { raw, minMinutes, maxMinutes },
  } as unknown as Place;
}

const oneHour = (id: string, hub: string, cluster: string, prefecture = "Tokio") =>
  place(id, hub, cluster, prefecture, "1 h", 60, 60);

describe("summarizeSelection", () => {
  it("reports nothing for an empty selection", () => {
    const summary = summarizeSelection([]);
    expect(summary.savedCount).toBe(0);
    expect(summary.visitTime).toBeNull();
    expect(summary.commitments).toEqual([]);
    expect(summary.nonQuantified).toEqual([]);
  });

  it("sums minima and maxima separately, never averaging", () => {
    const summary = summarizeSelection([
      place("a", "Tokio", "Shibuya", "Tokio", "1–2 h", 60, 120),
      place("b", "Tokio", "Shibuya", "Tokio", "45–90 min", 45, 90),
      place("c", "Tokio", "Shinjuku", "Tokio", "2–4 h", 120, 240),
    ]);
    expect(summary.visitTime).toEqual({ minMinutes: 225, maxMinutes: 450 });
    expect(summary.quantifiedCount).toBe(3);
  });

  it("keeps day-scale commitments out of the hour total", () => {
    const summary = summarizeSelection([
      place("a", "Tokio", "Shibuya", "Tokio", "2–3 h", 120, 180),
      place("b", "Tokio", "Disney", "Chiba", "Día completo"),
      place("c", "Okinawa", "Yaeyama", "Okinawa", "1–2 noches"),
    ]);
    // Only the quantified place contributes minutes.
    expect(summary.visitTime).toEqual({ minMinutes: 120, maxMinutes: 180 });
    expect(summary.quantifiedCount).toBe(1);
    expect(summary.commitmentCount).toBe(2);
    expect(summary.commitments.map((entry) => entry.block)).toEqual([
      "overnight-plus",
      "full-day",
    ]);
    expect(summary.nonQuantified.map((p) => p.id)).toEqual(["c", "b"]);
  });

  it("returns a null total when nothing is quantified", () => {
    const summary = summarizeSelection([
      place("a", "Osaka", "Nara", "Nara", "Medio día"),
      place("b", "Osaka", "Nara", "Nara", "Día completo"),
    ]);
    expect(summary.visitTime).toBeNull();
    expect(summary.commitmentCount).toBe(2);
  });

  it("counts unclassifiable durations as withoutEstimate", () => {
    const summary = summarizeSelection([place("a", "Tokio", "Shibuya", "Tokio", "")]);
    expect(summary.withoutEstimate.map((p) => p.id)).toEqual(["a"]);
    expect(summary.nonQuantified.map((p) => p.id)).toEqual(["a"]);
    expect(summary.visitTime).toBeNull();
  });
});

describe("grouping", () => {
  const places = [
    oneHour("a", "Tokio", "Shibuya"),
    oneHour("b", "Tokio", "Shibuya"),
    oneHour("c", "Tokio", "Shinjuku"),
    place("d", "Osaka", "Nara", "Nara", "1 h", 60, 60),
    place("e", "Osaka", "Naoshima", "Kagawa", "1 h", 60, 60),
  ];

  it("groups by hub, largest first", () => {
    const groups = groupByHub(places);
    expect(groups.map((g) => [g.key, g.places.length])).toEqual([
      ["Tokio", 3],
      ["Osaka", 2],
    ]);
  });

  it("groups by physical prefecture, not by hub", () => {
    const groups = groupByPrefecture(places);
    expect(groups.map((g) => g.label).sort()).toEqual(["Kagawa", "Nara", "Tokio"]);
    // The two Osaka-hub places sit in two different prefectures, neither of them Osaka.
    expect(groups.find((g) => g.label === "Osaka")).toBeUndefined();
  });

  it("keys clusters by hub and cluster together", () => {
    const groups = groupByCluster(places);
    expect(groups.map((g) => g.key)).toContain("Tokio|Shibuya");
    expect(groups.map((g) => g.label)).toContain("Shibuya");
    expect(groups.find((g) => g.key === "Tokio|Shibuya")?.places.length).toBe(2);
  });

  it("does not clone places — groups hold the original references", () => {
    const groups = groupByHub(places);
    expect(groups[0].places[0]).toBe(places[0]);
  });

  it("names a group's prefecture only when its places agree", () => {
    const groups = groupByCluster(places);
    const naoshima = groups.find((g) => g.key === "Osaka|Naoshima");
    expect(naoshima && groupPrefectureName(naoshima)).toBe("Kagawa");
    const mixed = { key: "x", label: "x", places, summary: summarizeSelection(places) };
    expect(groupPrefectureName(mixed)).toBeNull();
  });

  it("carries a summary per group", () => {
    const groups = groupByHub(places);
    expect(groups[0].summary.visitTime).toEqual({ minMinutes: 180, maxMinutes: 180 });
  });
});

describe("blockDistribution", () => {
  it("counts only the blocks present, in taxonomy order", () => {
    const distribution = blockDistribution([
      place("a", "Tokio", "Shibuya", "Tokio", "30 min", 30, 30),
      place("b", "Tokio", "Shibuya", "Tokio", "2–4 h", 120, 240),
      place("c", "Tokio", "Disney", "Chiba", "Día completo"),
    ]);
    expect(distribution).toEqual([
      { block: "brief", count: 1 },
      { block: "medium", count: 1 },
      { block: "full-day", count: 1 },
    ]);
  });
});

describe("concentration", () => {
  it("says nothing below the minimum saved count", () => {
    // Three places all in one cluster: a 100% share that still stays silent.
    const three = [
      oneHour("a", "Tokio", "Shibuya"),
      oneHour("b", "Tokio", "Shibuya"),
      oneHour("c", "Tokio", "Shibuya"),
    ];
    expect(three.length).toBe(CONCENTRATION_MIN_SAVED - 1);
    expect(concentration("Tokio", three).hasConcentration).toBe(false);
  });

  it("speaks at the minimum saved count when the share is reached", () => {
    const report = concentration("Tokio", [
      oneHour("a", "Tokio", "Shibuya"),
      oneHour("b", "Tokio", "Shibuya"),
      oneHour("c", "Tokio", "Shibuya"),
      oneHour("d", "Tokio", "Shinjuku"),
    ]);
    expect(report.savedCount).toBe(CONCENTRATION_MIN_SAVED);
    expect(report.topShare).toBeCloseTo(0.75);
    expect(report.hasConcentration).toBe(true);
    expect(report.topClusters.map((g) => g.label)).toEqual(["Shibuya"]);
  });

  it("stays silent when the leading set is only one-place clusters", () => {
    const report = concentration("Tokio", [
      oneHour("a", "Tokio", "Shibuya"),
      oneHour("b", "Tokio", "Shinjuku"),
      oneHour("c", "Tokio", "Ueno"),
      oneHour("d", "Tokio", "Ginza"),
      oneHour("e", "Tokio", "Asakusa"),
    ]);
    // The greedy leading set reaches 60%, but it is three one-place clusters — that is the
    // selection listed back, not a concentration.
    expect(report.topShare).toBeCloseTo(0.6);
    expect(report.hasConcentration).toBe(false);
  });

  it("speaks exactly at a 60% share", () => {
    const report = concentration("Tokio", [
      oneHour("a", "Tokio", "Shibuya"),
      oneHour("b", "Tokio", "Shibuya"),
      oneHour("c", "Tokio", "Shibuya"),
      oneHour("d", "Tokio", "Shinjuku"),
      oneHour("e", "Tokio", "Ueno"),
    ]);
    expect(report.topShare).toBeCloseTo(0.6);
    expect(report.hasConcentration).toBe(true);
  });

  it("never claims a concentration that needs every cluster", () => {
    const report = concentration("Tokio", [
      oneHour("a", "Tokio", "Shibuya"),
      oneHour("b", "Tokio", "Shibuya"),
      oneHour("c", "Tokio", "Shinjuku"),
      oneHour("d", "Tokio", "Shinjuku"),
    ]);
    // Reaching 60% takes both clusters, which describes the whole hub, not a concentration.
    expect(report.topClusters.length).toBe(report.distinctClusters);
    expect(report.hasConcentration).toBe(false);
  });
});

describe("dispersion", () => {
  it("speaks when every cluster holds a single place", () => {
    const report = concentration("Osaka", [
      place("a", "Osaka", "Nara", "Nara", "1 h", 60, 60),
      place("b", "Osaka", "Kobe", "Hyogo", "1 h", 60, 60),
      place("c", "Osaka", "Umeda", "Osaka", "1 h", 60, 60),
      place("d", "Osaka", "Namba", "Osaka", "1 h", 60, 60),
      place("e", "Osaka", "Naoshima", "Kagawa", "1 h", 60, 60),
    ]);
    expect(report.dispersionRatio).toBe(1);
    expect(report.distinctClusters).toBe(5);
    expect(report.hasDispersion).toBe(true);
  });

  it("speaks exactly at a 0.7 ratio", () => {
    const places = [
      oneHour("a", "Tokio", "Shibuya"),
      oneHour("b", "Tokio", "Shibuya"),
      oneHour("c", "Tokio", "Shinjuku"),
      oneHour("d", "Tokio", "Shinjuku"),
      oneHour("e", "Tokio", "Ueno"),
      oneHour("f", "Tokio", "Ginza"),
      oneHour("g", "Tokio", "Asakusa"),
      oneHour("h", "Tokio", "Ikebukuro"),
      oneHour("i", "Tokio", "Odaiba"),
      oneHour("j", "Tokio", "Akihabara"),
    ];
    const report = concentration("Tokio", places);
    // 6 singleton clusters out of 8 distinct.
    expect(report.singletonClusters).toBe(6);
    expect(report.distinctClusters).toBe(8);
    expect(report.dispersionRatio).toBeCloseTo(0.75);
    expect(report.hasDispersion).toBe(true);
  });

  it("stays silent just below the ratio", () => {
    const report = concentration("Tokio", [
      oneHour("a", "Tokio", "Shibuya"),
      oneHour("b", "Tokio", "Shibuya"),
      oneHour("c", "Tokio", "Shinjuku"),
      oneHour("d", "Tokio", "Shinjuku"),
      oneHour("e", "Tokio", "Ueno"),
      oneHour("f", "Tokio", "Ginza"),
    ]);
    // 2 singletons of 4 clusters = 0.5.
    expect(report.dispersionRatio).toBeCloseTo(0.5);
    expect(report.hasDispersion).toBe(false);
  });

  it("stays silent below the minimum saved count however scattered", () => {
    const report = concentration("Sapporo", [
      place("a", "Sapporo", "Odori", "Hokkaido", "1 h", 60, 60),
      place("b", "Sapporo", "Otaru", "Hokkaido", "1 h", 60, 60),
      place("c", "Sapporo", "Shikotsu", "Hokkaido", "1 h", 60, 60),
    ]);
    expect(report.dispersionRatio).toBe(1);
    expect(report.hasDispersion).toBe(false);
  });
});
