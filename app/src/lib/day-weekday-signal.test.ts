import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import { buildDayWeekdaySignal } from "./day-weekday-signal";

const places = placesData as Place[];

/**
 * This repository has no component-level test harness (no jsdom, no Testing Library — see the
 * precedent noted in `docs/ROADMAP.md`'s Phase 3B2I entry, and no dependency may be added for
 * this phase per its own scope). `OrderedSequenceBuilder.tsx`'s `WeekdayClosureNotice` renders
 * directly and only from `buildDayWeekdaySignal`'s output, with no additional branching of its
 * own beyond formatting — so these tests exercise that exact function, the same "pure boundary a
 * component calls" pattern `day-assignment.ts`/`ordered-sequence.ts` already use, to stand in
 * for what a DOM assertion would check. The actual rendered output was additionally verified
 * manually in a real browser via `npm run dev` + Playwright during development (a Monday date
 * showed the warning with both matched places named; a Tuesday date showed only the neutral "sin
 * coincidencias" line; clearing the date removed the section entirely).
 */

function place(id: string, closures: string, overrides: Partial<Place> = {}): Place {
  const base = places.find((p) => p.schedule.closures === closures);
  const template = base ?? places[0];
  return { ...template, id, name: id, schedule: { ...template.schedule, closures }, ...overrides };
}

describe("buildDayWeekdaySignal", () => {
  it("no date -> not assessed, no signal built", () => {
    const day = [place("A", "Lunes; verificar")];
    const signal = buildDayWeekdaySignal(day, null);
    expect(signal.assessed).toBe(false);
  });

  it("an invalid date string -> not assessed, same as no date", () => {
    const day = [place("A", "Lunes; verificar")];
    expect(buildDayWeekdaySignal(day, "2027-02-30").assessed).toBe(false);
    expect(buildDayWeekdaySignal(day, "not-a-date").assessed).toBe(false);
  });

  it("a dated day with a matching candidate closure surfaces the match", () => {
    const day = [place("A", "Lunes; verificar")];
    const signal = buildDayWeekdaySignal(day, "2027-02-15"); // confirmed Monday
    expect(signal.assessed).toBe(true);
    if (signal.assessed) {
      expect(signal.weekday).toBe("monday");
      expect(signal.matchCount).toBe(1);
      expect(signal.perPlace[0].assessment.outcome).toBe("possible-weekday-closure-match");
    }
  });

  it("a dated day with no match does not claim the whole day is valid/open", () => {
    const day = [place("A", "Lunes; verificar")];
    const signal = buildDayWeekdaySignal(day, "2027-02-16"); // confirmed Tuesday
    expect(signal.assessed).toBe(true);
    if (signal.assessed) {
      expect(signal.matchCount).toBe(0);
      expect(signal.perPlace[0].assessment.outcome).toBe("no-weekday-match");
      // No boolean anywhere in the summary that could be read as "day is valid"/"day works".
      expect(Object.entries(signal).every(([key, value]) => key === "assessed" || typeof value !== "boolean")).toBe(
        true
      );
    }
  });

  it("non-evaluable places are counted and individually identifiable, not silently dropped", () => {
    const day = [place("A", "Según comercio"), place("B", "Lunes; verificar"), place("C", "Clima")];
    const signal = buildDayWeekdaySignal(day, "2027-02-15");
    expect(signal.assessed).toBe(true);
    if (signal.assessed) {
      expect(signal.notEvaluableCount).toBe(2);
      expect(signal.matchCount).toBe(1);
      expect(signal.perPlace).toHaveLength(3);
      expect(signal.perPlace.map((p) => p.placeId)).toEqual(["A", "B", "C"]);
    }
  });

  it("moving a place to a different day recomputes its assessment from the NEW day's date", () => {
    const movedPlace = place("A", "Lunes; verificar");
    const onMonday = buildDayWeekdaySignal([movedPlace], "2027-02-15");
    const onTuesday = buildDayWeekdaySignal([movedPlace], "2027-02-16");
    expect(onMonday.assessed && onMonday.matchCount).toBe(1);
    expect(onTuesday.assessed && onTuesday.matchCount).toBe(0);
  });

  it("changing the start date recomputes the signal for the same day's places", () => {
    const day = [place("A", "Lunes; verificar")];
    const before = buildDayWeekdaySignal(day, "2027-02-16"); // Tuesday: no match
    const after = buildDayWeekdaySignal(day, "2027-02-15"); // start date moved: now Monday
    expect(before.assessed && before.matchCount).toBe(0);
    expect(after.assessed && after.matchCount).toBe(1);
  });

  it("an empty day (no places) with a valid date still assesses, with zero counts", () => {
    const signal = buildDayWeekdaySignal([], "2027-02-15");
    expect(signal.assessed).toBe(true);
    if (signal.assessed) {
      expect(signal.matchCount).toBe(0);
      expect(signal.notEvaluableCount).toBe(0);
      expect(signal.perPlace).toEqual([]);
    }
  });

  it("is deterministic across repeated calls", () => {
    const day = [place("A", "Lunes; verificar"), place("B", "Según comercio")];
    const results = new Set(
      Array.from({ length: 5 }, () => JSON.stringify(buildDayWeekdaySignal(day, "2027-02-15")))
    );
    expect(results.size).toBe(1);
  });

  it("does not throw across the real dataset's places for a single day bucket", () => {
    expect(() => buildDayWeekdaySignal(places, "2027-02-15")).not.toThrow();
  });

  it("outcome vocabulary never implies certainty ('closed'/'open') — only a possible match", () => {
    // The exact closed set this phase's product boundary allows, restated here as a literal
    // regression check on the domain's own vocabulary — a future edit that added a stronger
    // outcome name (e.g. "closed", "compatible") would fail this test immediately.
    const day = [place("A", "Lunes; verificar"), place("B", "Sin cierre"), place("C", "Según comercio")];
    const signal = buildDayWeekdaySignal(day, "2027-02-15");
    expect(signal.assessed).toBe(true);
    if (!signal.assessed) return;
    const outcomes = new Set(signal.perPlace.map((p) => p.assessment.outcome));
    const allowed = new Set([
      "possible-weekday-closure-match",
      "no-weekday-match",
      "no-known-closure",
      "not-evaluable",
      "not-assessed",
    ]);
    for (const outcome of outcomes) {
      expect(allowed.has(outcome), outcome).toBe(true);
      for (const forbidden of ["closed", "open", "cerrado", "abierto", "compatible", "incompatible", "feasible"]) {
        expect(outcome.toLowerCase()).not.toContain(forbidden);
      }
    }
  });
});

describe("Phase 3D-B persists nothing (item 12: no schema change, no new storage key)", () => {
  async function moduleSource(relativePath: string): Promise<string> {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "");
  }

  it("temporal-availability.ts references no persistence API", async () => {
    const code = await moduleSource("./temporal-availability.ts");
    for (const forbidden of ["localStorage", "sessionStorage", "indexedDB"]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("day-weekday-signal.ts references no persistence API", async () => {
    const code = await moduleSource("./day-weekday-signal.ts");
    for (const forbidden of ["localStorage", "sessionStorage", "indexedDB"]) {
      expect(code).not.toContain(forbidden);
    }
  });
});
