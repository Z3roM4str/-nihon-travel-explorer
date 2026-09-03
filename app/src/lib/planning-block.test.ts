import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import {
  PLANNING_BLOCKS,
  availablePlanningBlocks,
  blockKind,
  classifyPlanningBlock,
  matchesAnyPlanningBlock,
  matchesPlanningBlock,
} from "./planning-block";

/** Minimal duration fixture: classification only ever reads these three fields. */
function duration(raw: string, minMinutes?: number, maxMinutes?: number): Place["duration"] {
  return minMinutes === undefined ? { raw } : { raw, minMinutes, maxMinutes };
}

describe("classifyPlanningBlock — quantified boundaries", () => {
  it("labels by the upper bound, not the lower one", () => {
    // A range whose minimum sits two blocks below still reads as the block it can reach.
    expect(classifyPlanningBlock(duration("1–4 h", 60, 240))).toBe("medium");
  });

  it("puts an exact boundary value in the lower block", () => {
    expect(classifyPlanningBlock(duration("60 min", 60, 60))).toBe("brief");
    expect(classifyPlanningBlock(duration("2 h", 120, 120))).toBe("short");
    expect(classifyPlanningBlock(duration("4 h", 240, 240))).toBe("medium");
  });

  it("moves to the next block one minute past a boundary", () => {
    expect(classifyPlanningBlock(duration("61 min", 61, 61))).toBe("short");
    expect(classifyPlanningBlock(duration("121 min", 121, 121))).toBe("medium");
    expect(classifyPlanningBlock(duration("241 min", 241, 241))).toBe("long");
  });

  it("classifies minute ranges", () => {
    expect(classifyPlanningBlock(duration("5–15 min", 5, 15))).toBe("brief");
    expect(classifyPlanningBlock(duration("45–90 min", 45, 90))).toBe("short");
    expect(classifyPlanningBlock(duration("30–60 min", 30, 60))).toBe("brief");
  });

  it("classifies decimal-hour ranges", () => {
    expect(classifyPlanningBlock(duration("1–1.5 h", 60, 90))).toBe("short");
    expect(classifyPlanningBlock(duration("1.5–2.5 h", 90, 150))).toBe("medium");
    expect(classifyPlanningBlock(duration("3–4.5 h", 180, 270))).toBe("long");
  });

  it("reads a range out of raw text when the exporter left no numbers", () => {
    // The exporter only emits a range, so a single value like "1.5 h" arrives raw-only.
    expect(classifyPlanningBlock(duration("1.5 h"))).toBe("short");
  });

  it("classifies every quantified block as summable", () => {
    for (const block of ["brief", "short", "medium", "long"] as const) {
      expect(blockKind(block)).toBe("quantified");
    }
  });
});

describe("classifyPlanningBlock — editorial day-scale families", () => {
  it("recognises half day", () => {
    expect(classifyPlanningBlock(duration("Medio día"))).toBe("half-day");
    expect(classifyPlanningBlock(duration("Medio día dentro de USJ"))).toBe("half-day");
  });

  it("recognises a half-to-full-day span", () => {
    expect(classifyPlanningBlock(duration("Medio día–día completo"))).toBe("half-to-full-day");
  });

  it("recognises a full day", () => {
    expect(classifyPlanningBlock(duration("Día completo"))).toBe("full-day");
  });

  it("treats anything reaching a night or plural days as overnight-plus", () => {
    expect(classifyPlanningBlock(duration("1 noche"))).toBe("overnight-plus");
    expect(classifyPlanningBlock(duration("1–2 noches"))).toBe("overnight-plus");
    expect(classifyPlanningBlock(duration("2–4 noches"))).toBe("overnight-plus");
    expect(classifyPlanningBlock(duration("Medio día–1 noche"))).toBe("overnight-plus");
    expect(classifyPlanningBlock(duration("Día completo–2 noches"))).toBe("overnight-plus");
    expect(classifyPlanningBlock(duration("1–2 días"))).toBe("overnight-plus");
    expect(classifyPlanningBlock(duration("Día completo–2 días"))).toBe("overnight-plus");
  });

  it("never converts a day-scale duration into minutes", () => {
    const dayScale = [
      "Medio día",
      "Medio día–día completo",
      "Día completo",
      "1 noche",
      "1–2 días",
      "Día completo–2 noches",
    ];
    for (const raw of dayScale) {
      const block = classifyPlanningBlock(duration(raw));
      expect(blockKind(block)).toBe("day-scale");
      // No quantified block, and therefore no minutes, may ever be produced for these.
      expect(["brief", "short", "medium", "long"]).not.toContain(block);
    }
  });

  it("ignores stray normalized minutes on a day-scale text", () => {
    // Defensive: even if minutes were present, the editorial text wins.
    const block = classifyPlanningBlock(duration("Día completo", 480, 480));
    expect(block).toBe("full-day");
    expect(blockKind(block)).toBe("day-scale");
  });

  it("returns unknown for text with neither numbers nor a day-scale word", () => {
    expect(classifyPlanningBlock(duration(""))).toBe("unknown");
    expect(classifyPlanningBlock(duration("Variable"))).toBe("unknown");
    expect(blockKind("unknown")).toBe("unknown");
  });
});

describe("matchesPlanningBlock — overlap, not label equality", () => {
  const oneToTwoHours = duration("1–2 h", 60, 120);

  it("matches every block its range overlaps", () => {
    expect(matchesPlanningBlock(oneToTwoHours, "brief")).toBe(true);
    expect(matchesPlanningBlock(oneToTwoHours, "short")).toBe(true);
  });

  it("does not match blocks its range never reaches", () => {
    expect(matchesPlanningBlock(oneToTwoHours, "medium")).toBe(false);
    expect(matchesPlanningBlock(oneToTwoHours, "long")).toBe(false);
  });

  it("matches a range that straddles three blocks", () => {
    const wide = duration("1–4 h", 60, 240);
    expect(matchesPlanningBlock(wide, "brief")).toBe(true);
    expect(matchesPlanningBlock(wide, "short")).toBe(true);
    expect(matchesPlanningBlock(wide, "medium")).toBe(true);
    expect(matchesPlanningBlock(wide, "long")).toBe(false);
  });

  it("keeps boundaries half-open so an exact value belongs to one block only", () => {
    const exactlyOneHour = duration("60 min", 60, 60);
    expect(matchesPlanningBlock(exactlyOneHour, "brief")).toBe(true);
    expect(matchesPlanningBlock(exactlyOneHour, "short")).toBe(false);
  });

  it("never matches a quantified place against a day-scale block", () => {
    expect(matchesPlanningBlock(oneToTwoHours, "full-day")).toBe(false);
    expect(matchesPlanningBlock(oneToTwoHours, "overnight-plus")).toBe(false);
  });

  it("never matches a day-scale place against a quantified block", () => {
    const fullDay = duration("Día completo");
    expect(matchesPlanningBlock(fullDay, "long")).toBe(false);
    expect(matchesPlanningBlock(fullDay, "medium")).toBe(false);
    expect(matchesPlanningBlock(fullDay, "full-day")).toBe(true);
    expect(matchesPlanningBlock(fullDay, "half-day")).toBe(false);
  });
});

describe("matchesAnyPlanningBlock", () => {
  it("imposes no constraint when nothing is selected", () => {
    expect(matchesAnyPlanningBlock(duration("Día completo"), [])).toBe(true);
    expect(matchesAnyPlanningBlock(duration("2–3 h", 120, 180), [])).toBe(true);
  });

  it("combines selected blocks with OR", () => {
    const place = duration("2–3 h", 120, 180);
    expect(matchesAnyPlanningBlock(place, ["brief", "full-day"])).toBe(false);
    expect(matchesAnyPlanningBlock(place, ["brief", "medium"])).toBe(true);
  });
});

describe("availablePlanningBlocks", () => {
  it("offers every block a duration overlaps, not just its label", () => {
    // "1–2 h" is labelled short, but it also reaches into brief, so brief has results.
    const durations = [duration("1–2 h", 60, 120)];
    expect(classifyPlanningBlock(durations[0])).toBe("short");
    expect(availablePlanningBlocks(durations)).toEqual(["brief", "short"]);
  });

  it("offers brief and short for a 45–90 min range", () => {
    expect(availablePlanningBlocks([duration("45–90 min", 45, 90)])).toEqual(["brief", "short"]);
  });

  it("offers short and medium for a 2–4 h range", () => {
    // 120 is the brief/short boundary: the range starts exactly on it, so brief is excluded.
    expect(availablePlanningBlocks([duration("2–4 h", 120, 240)])).toEqual(["short", "medium"]);
  });

  it("offers only its own block for a day-scale duration", () => {
    expect(availablePlanningBlocks([duration("Día completo")])).toEqual(["full-day"]);
    expect(availablePlanningBlocks([duration("1–2 noches")])).toEqual(["overnight-plus"]);
    expect(availablePlanningBlocks([duration("Medio día")])).toEqual(["half-day"]);
  });

  it("keeps the canonical order and never repeats a block", () => {
    const blocks = availablePlanningBlocks([
      duration("Día completo"),
      duration("2–4 h", 120, 240),
      duration("1–2 h", 60, 120),
      duration("Medio día"),
      duration("5–7 h", 300, 420),
      duration("2–4 h", 120, 240),
    ]);
    expect(blocks).toEqual(["brief", "short", "medium", "long", "half-day", "full-day"]);
    expect(new Set(blocks).size).toBe(blocks.length);
    const indices = blocks.map((block) => PLANNING_BLOCKS.indexOf(block));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it("returns nothing for an empty set", () => {
    expect(availablePlanningBlocks([])).toEqual([]);
  });

  it("agrees with the filter: every offered block returns at least one place", () => {
    const durations = [duration("1–2 h", 60, 120), duration("Día completo")];
    for (const block of availablePlanningBlocks(durations)) {
      expect(durations.some((d) => matchesPlanningBlock(d, block))).toBe(true);
    }
  });
});

describe("the real dataset", () => {
  const places = placesData as Place[];

  it("classifies every place into a known block, none unknown", () => {
    const unknown = places.filter((place) => classifyPlanningBlock(place.duration) === "unknown");
    expect(unknown.map((place) => `${place.id} ${place.duration.raw}`)).toEqual([]);
  });

  it("only ever produces blocks from the declared taxonomy", () => {
    for (const place of places) {
      expect(PLANNING_BLOCKS).toContain(classifyPlanningBlock(place.duration));
    }
  });

  it("offers only blocks that return results in the whole dataset", () => {
    const durations = places.map((place) => place.duration);
    const blocks = availablePlanningBlocks(durations);
    for (const block of blocks) {
      expect(durations.some((d) => matchesPlanningBlock(d, block))).toBe(true);
    }
    // Every block a place is labelled with must also be offered, since a label always
    // overlaps its own window.
    for (const place of places) {
      expect(blocks).toContain(classifyPlanningBlock(place.duration));
    }
  });

  it("gives every day-scale place a day-scale kind and no minutes", () => {
    const dayScale = places.filter(
      (place) => blockKind(classifyPlanningBlock(place.duration)) === "day-scale"
    );
    // Count is not asserted — it changes with the workbook — but the invariant is.
    expect(dayScale.length).toBeGreaterThan(0);
    for (const place of dayScale) {
      expect(matchesPlanningBlock(place.duration, "brief")).toBe(false);
      expect(matchesPlanningBlock(place.duration, "long")).toBe(false);
    }
  });
});
