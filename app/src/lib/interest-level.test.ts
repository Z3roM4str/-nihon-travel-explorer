import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  INTEREST_LEVELS,
  compareByInterest,
  interestLevelForGrade,
  interestLevelForPlace,
  tourismCaution,
} from "./interest-level";

/**
 * Block 1 (UX hierarchy). The interest ladder is the only translation of the dataset's
 * single-letter `grade` into language a first-time reader can act on, so these tests hold it to
 * three promises: it covers the real catalogue, it never re-ranks a place, and it never leans on
 * colour alone.
 */

async function catalogueGrades(): Promise<string[]> {
  const raw = await readFile(new URL("../data/places.json", import.meta.url), "utf8");
  return [...new Set((JSON.parse(raw) as { grade: string }[]).map((place) => place.grade))];
}

describe("interest ladder covers the catalogue", () => {
  it("has a descriptor for every grade the dataset actually uses", async () => {
    const mapped = INTEREST_LEVELS.map((descriptor) => descriptor.grade);
    expect((await catalogueGrades()).filter((grade) => !mapped.includes(grade))).toEqual([]);
  });

  it("offers no level for a grade the catalogue does not use", async () => {
    const catalogue = await catalogueGrades();
    expect(INTEREST_LEVELS.filter((d) => !catalogue.includes(d.grade)).map((d) => d.grade)).toEqual([]);
  });

  it("orders the five levels from imprescindible to prescindible", () => {
    expect(INTEREST_LEVELS.map((d) => d.level)).toEqual([
      "imprescindible",
      "muy-recomendable",
      "recomendable",
      "opcional",
      "prescindible",
    ]);
  });

  it("keeps rank strictly increasing so comparisons are unambiguous", () => {
    const ranks = INTEREST_LEVELS.map((d) => d.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});

describe("interest ladder never depends on colour alone", () => {
  it("gives every level a non-empty text label", () => {
    for (const descriptor of INTEREST_LEVELS) {
      expect(descriptor.label.trim().length, descriptor.level).toBeGreaterThan(0);
      expect(descriptor.shortLabel.trim().length, descriptor.level).toBeGreaterThan(0);
    }
  });

  it("gives every level a distinct shape glyph", () => {
    const glyphs = INTEREST_LEVELS.map((d) => d.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("gives every level a one-sentence explanation", () => {
    for (const descriptor of INTEREST_LEVELS) {
      expect(descriptor.description.trim().length, descriptor.level).toBeGreaterThan(10);
    }
  });
});

describe("grade → level resolution", () => {
  it("maps each catalogue grade to its editorial level", () => {
    expect(interestLevelForGrade("S").level).toBe("imprescindible");
    expect(interestLevelForGrade("A").level).toBe("muy-recomendable");
    expect(interestLevelForGrade("B").level).toBe("recomendable");
    expect(interestLevelForGrade("C").level).toBe("opcional");
    expect(interestLevelForGrade("D").level).toBe("prescindible");
  });

  it("keeps an unknown grade visible instead of silently re-grading it", () => {
    const unknown = interestLevelForGrade("Z");
    expect(unknown.grade).toBe("Z");
    expect(unknown.label).toContain("Z");
  });

  it("reads the grade off a place without touching any other field", () => {
    expect(interestLevelForPlace({ grade: "S" }).label).toBe("Imprescindible");
  });

  it("sorts the highest interest first", () => {
    const sorted = [{ grade: "C" }, { grade: "S" }, { grade: "B" }].sort(compareByInterest);
    expect(sorted.map((p) => p.grade)).toEqual(["S", "B", "C"]);
  });
});

describe("tourism saturation stays a separate axis", () => {
  it("flags the two saturated levels the dataset records", () => {
    expect(tourismCaution({ tourismLevel: "Extremo" })).toEqual({ label: "Muy turístico", level: "extremo" });
    expect(tourismCaution({ tourismLevel: "Alto" })).toEqual({ label: "Turístico", level: "alto" });
  });

  it("stays silent for the unsaturated levels", () => {
    expect(tourismCaution({ tourismLevel: "Medio" })).toBeNull();
    expect(tourismCaution({ tourismLevel: "Bajo" })).toBeNull();
  });

  it("never downgrades an imprescindible place for being crowded", () => {
    const place = { grade: "S", tourismLevel: "Extremo" };
    expect(interestLevelForPlace(place).level).toBe("imprescindible");
    expect(tourismCaution(place)?.level).toBe("extremo");
  });
});
