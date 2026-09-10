import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as civilDate from "./civil-date";
import {
  assessTripBounds,
  buildTripBoundsSummary,
  deriveTripCalendarDays,
  type TripBounds,
} from "./trip-bounds";

/**
 * Phase 3D-W — Trip Bounds Runtime: the §15 matrix for the pure derived layer.
 *
 * Everything here is behavioural — real inputs through the real evaluator — except the two clearly
 * labelled source scans at the bottom, which pin architectural invariants (no local-timezone date
 * reads, no day id in the signature) that no behavioural test can express.
 */

const RANGE_15: TripBounds = { startDate: "2027-02-19", endDate: "2027-03-05" }; // 15 calendar days

describe("deriveTripCalendarDays — inclusive on both ends", () => {
  it("counts a one-day trip (end === start) as exactly 1, not 0 and not an empty range", () => {
    expect(deriveTripCalendarDays({ startDate: "2027-02-19", endDate: "2027-02-19" })).toBe(1);
  });

  it("counts two consecutive dates as 2", () => {
    expect(deriveTripCalendarDays({ startDate: "2027-02-19", endDate: "2027-02-20" })).toBe(2);
  });

  it("counts an ordinary multi-week range inclusively", () => {
    expect(deriveTripCalendarDays(RANGE_15)).toBe(15);
  });

  it("counts across a month boundary", () => {
    expect(deriveTripCalendarDays({ startDate: "2027-01-28", endDate: "2027-02-03" })).toBe(7);
  });

  it("counts across a year boundary", () => {
    expect(deriveTripCalendarDays({ startDate: "2027-12-28", endDate: "2028-01-03" })).toBe(7);
  });

  it("counts across a leap day", () => {
    expect(deriveTripCalendarDays({ startDate: "2028-02-27", endDate: "2028-03-02" })).toBe(5);
    // The same span in a non-leap year is one day shorter.
    expect(deriveTripCalendarDays({ startDate: "2027-02-27", endDate: "2027-03-02" })).toBe(4);
  });

  it("is ABSENT (null) — never 0, never negative, never days.length — for every unavailable state", () => {
    expect(deriveTripCalendarDays({ startDate: null, endDate: null })).toBeNull();
    expect(deriveTripCalendarDays({ startDate: "2027-02-19", endDate: null })).toBeNull();
    expect(deriveTripCalendarDays({ startDate: null, endDate: "2027-03-05" })).toBeNull();
    expect(deriveTripCalendarDays({ startDate: "2027-03-05", endDate: "2027-02-19" })).toBeNull(); // inverted
    expect(deriveTripCalendarDays({ startDate: "2027-02-30", endDate: "2027-03-05" })).toBeNull(); // impossible
    expect(deriveTripCalendarDays({ startDate: "2027-02-19", endDate: "nope" })).toBeNull();
  });
});

describe("assessTripBounds — the three kinds", () => {
  it("classifies ordinals 0..n-1 as within-bounds and n.. as after-trip-end", () => {
    const bounds: TripBounds = { startDate: "2027-02-19", endDate: "2027-02-21" }; // 3 calendar days
    const kinds = [0, 1, 2, 3, 4].map((ordinal) => assessTripBounds(bounds, ordinal).kind);
    expect(kinds).toEqual([
      "within-bounds",
      "within-bounds",
      "within-bounds",
      "after-trip-end",
      "after-trip-end",
    ]);
  });

  it("echoes the arithmetic dayDate, the ordinal and tripCalendarDays for an in-bounds day", () => {
    expect(assessTripBounds(RANGE_15, 3)).toEqual({
      kind: "within-bounds",
      dayDate: "2027-02-22",
      ordinal: 3,
      tripCalendarDays: 15,
    });
  });

  it("keeps the correct arithmetic dayDate for an out-of-bounds day — the date is not withheld", () => {
    expect(assessTripBounds(RANGE_15, 17)).toEqual({
      kind: "after-trip-end",
      dayDate: "2027-03-08",
      ordinal: 17,
      tripCalendarDays: 15,
    });
    // The same date the ordinal would derive with no bounds at all.
    expect(civilDate.addCivilDays("2027-02-19", 17)).toBe("2027-03-08");
  });

  it("treats a one-day trip as ordinal 0 in, every later ordinal out", () => {
    const bounds: TripBounds = { startDate: "2027-02-19", endDate: "2027-02-19" };
    expect(assessTripBounds(bounds, 0).kind).toBe("within-bounds");
    expect(assessTripBounds(bounds, 1).kind).toBe("after-trip-end");
    expect(assessTripBounds(bounds, 2).kind).toBe("after-trip-end");
  });

  it("classifies every ordinal as within-bounds when there are fewer buckets than calendar days", () => {
    for (const ordinal of [0, 5, 11]) {
      expect(assessTripBounds(RANGE_15, ordinal).kind, `ordinal=${ordinal}`).toBe("within-bounds");
    }
  });

  it("classifies exactly-matching counts as all within-bounds, and the next ordinal as out", () => {
    for (let ordinal = 0; ordinal < 15; ordinal += 1) {
      expect(assessTripBounds(RANGE_15, ordinal).kind, `ordinal=${ordinal}`).toBe("within-bounds");
    }
    expect(assessTripBounds(RANGE_15, 15).kind).toBe("after-trip-end");
  });

  it("never produces a `before-trip-start` kind for any reachable ordinal", () => {
    for (let ordinal = 0; ordinal <= 60; ordinal += 1) {
      const assessment = assessTripBounds(RANGE_15, ordinal);
      expect(["within-bounds", "after-trip-end", "bounds-unavailable"]).toContain(assessment.kind);
      expect(assessment.kind).not.toBe("before-trip-start");
    }
  });
});

describe("assessTripBounds — the five unavailable reasons, in resolution order", () => {
  it("reports no-start-date when both endpoints are null", () => {
    expect(assessTripBounds({ startDate: null, endDate: null }, 0)).toEqual({
      kind: "bounds-unavailable",
      reason: "no-start-date",
    });
  });

  it("reports no-end-date when only the start date is set", () => {
    expect(assessTripBounds({ startDate: "2027-02-19", endDate: null }, 0)).toEqual({
      kind: "bounds-unavailable",
      reason: "no-end-date",
    });
  });

  it("reports no-start-date — not no-end-date — when only the END date is set", () => {
    expect(assessTripBounds({ startDate: null, endDate: "2027-03-05" }, 0)).toEqual({
      kind: "bounds-unavailable",
      reason: "no-start-date",
    });
  });

  it("reports invalid-date when an endpoint is present but is not a real calendar date", () => {
    expect(assessTripBounds({ startDate: "2027-02-30", endDate: "2027-03-05" }, 0)).toEqual({
      kind: "bounds-unavailable",
      reason: "invalid-date",
    });
    expect(assessTripBounds({ startDate: "2027-02-19", endDate: "2027-02-29" }, 0)).toEqual({
      kind: "bounds-unavailable",
      reason: "invalid-date",
    });
  });

  it("reports inverted-range when the end precedes the start — and repairs nothing", () => {
    const bounds: TripBounds = { startDate: "2027-03-05", endDate: "2027-02-19" };
    expect(assessTripBounds(bounds, 0)).toEqual({ kind: "bounds-unavailable", reason: "inverted-range" });
    // Both values are exactly what was passed in: nothing swapped, shifted, or cleared.
    expect(bounds).toEqual({ startDate: "2027-03-05", endDate: "2027-02-19" });
  });

  it("reports inverted-range for a one-day inversion, not within-bounds", () => {
    expect(assessTripBounds({ startDate: "2027-02-20", endDate: "2027-02-19" }, 0).kind).toBe(
      "bounds-unavailable"
    );
  });

  it("puts no-start-date ahead of an invalid end date, and no-end-date ahead of an invalid start", () => {
    expect(assessTripBounds({ startDate: null, endDate: "not-a-date" }, 0)).toEqual({
      kind: "bounds-unavailable",
      reason: "no-start-date",
    });
    expect(assessTripBounds({ startDate: "not-a-date", endDate: null }, 0)).toEqual({
      kind: "bounds-unavailable",
      reason: "no-end-date",
    });
  });

  it("carries no dayDate, ordinal or tripCalendarDays on any unavailable result", () => {
    const unavailable = [
      assessTripBounds({ startDate: null, endDate: null }, 0),
      assessTripBounds({ startDate: "2027-02-19", endDate: null }, 0),
      assessTripBounds({ startDate: "2027-03-05", endDate: "2027-02-19" }, 0),
      assessTripBounds({ startDate: "2027-02-30", endDate: "2027-03-05" }, 0),
      assessTripBounds(RANGE_15, -1),
    ];
    for (const assessment of unavailable) {
      expect(Object.keys(assessment).sort()).toEqual(["kind", "reason"]);
    }
  });
});

describe("assessTripBounds — the ordinal domain is closed BEFORE any date arithmetic", () => {
  const INVALID_ORDINALS: [string, number][] = [
    ["negative -1", -1],
    ["negative -42", -42],
    ["fractional 0.5", 0.5],
    ["fractional 2.0000001", 2.0000001],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["unsafe integer MAX_SAFE_INTEGER + 1", Number.MAX_SAFE_INTEGER + 1],
    ["unsafe integer -(MAX_SAFE_INTEGER + 1)", -(Number.MAX_SAFE_INTEGER + 1)],
  ];

  it.each(INVALID_ORDINALS)("resolves %s to bounds-unavailable(invalid-ordinal)", (_label, ordinal) => {
    expect(assessTripBounds(RANGE_15, ordinal)).toEqual({
      kind: "bounds-unavailable",
      reason: "invalid-ordinal",
    });
  });

  it("resolves -1 to invalid-ordinal even when the bounds would make ordinal 0 valid", () => {
    // The bounds here are perfectly good; only the ordinal is not a reachable array position.
    expect(assessTripBounds(RANGE_15, 0).kind).toBe("within-bounds");
    expect(assessTripBounds(RANGE_15, -1)).toEqual({
      kind: "bounds-unavailable",
      reason: "invalid-ordinal",
    });
  });

  it("reports invalid-ordinal ahead of every other reason, including no-start-date", () => {
    // Each of these bounds would ON ITS OWN resolve to a different reason (no-start-date,
    // no-end-date, inverted-range, invalid-date). The ordinal check runs first regardless.
    const cases: [TripBounds, number][] = [
      [{ startDate: null, endDate: null }, -1],
      [{ startDate: "2027-02-19", endDate: null }, Number.NaN],
      [{ startDate: "2027-03-05", endDate: "2027-02-19" }, 0.5],
      [{ startDate: "2027-02-30", endDate: "x" }, Number.POSITIVE_INFINITY],
    ];
    for (const [bounds, ordinal] of cases) {
      expect(assessTripBounds(bounds, ordinal), JSON.stringify(bounds)).toEqual({
        kind: "bounds-unavailable",
        reason: "invalid-ordinal",
      });
    }
  });

  it("never fabricates a dayDate for an invalid ordinal", () => {
    for (const [, ordinal] of INVALID_ORDINALS) {
      const assessment = assessTripBounds(RANGE_15, ordinal);
      expect(assessment).not.toHaveProperty("dayDate");
    }
  });

  it("leaves every NON-NEGATIVE SAFE INTEGER ordinal unaffected by the invalid-ordinal guard", () => {
    for (const ordinal of [0, 1, 2, 14, 15, 16, 999, 100_000]) {
      const assessment = assessTripBounds(RANGE_15, ordinal);
      expect(assessment.kind, `ordinal=${ordinal}`).not.toBe("bounds-unavailable");
    }
  });

  it("reports invalid-date — never a fabricated dayDate — for a safe ordinal that overflows Date's range", () => {
    // `Number.MAX_SAFE_INTEGER - 1` IS a non-negative safe integer, so it passes the ordinal guard
    // legitimately; the offset then exceeds what a `Date` can represent. The design's second output
    // guard (§13) requires `invalid-date` here rather than a "NaN-NaN-NaN"-style fabricated string.
    const assessment = assessTripBounds(RANGE_15, Number.MAX_SAFE_INTEGER - 1);
    expect(assessment).toEqual({ kind: "bounds-unavailable", reason: "invalid-date" });
    expect(assessment).not.toHaveProperty("dayDate");
  });

  it("never calls addCivilDays for an invalid ordinal — asserted with a spy on the real helper", () => {
    const spy = vi.spyOn(civilDate, "addCivilDays");
    try {
      for (const [label, ordinal] of INVALID_ORDINALS) {
        spy.mockClear();
        expect(assessTripBounds(RANGE_15, ordinal).kind, label).toBe("bounds-unavailable");
        expect(spy, label).not.toHaveBeenCalled();
      }
      // Control: a VALID ordinal on the same bounds does reach it, so the spy is genuinely wired.
      spy.mockClear();
      expect(assessTripBounds(RANGE_15, 3).kind).toBe("within-bounds");
      expect(spy).toHaveBeenCalledWith("2027-02-19", 3);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("assessTripBounds — purity", () => {
  it("mutates neither the bounds object it is given nor anything else", () => {
    const bounds: TripBounds = { startDate: "2027-02-19", endDate: "2027-03-05" };
    const before = JSON.stringify(bounds);
    for (let ordinal = -3; ordinal <= 30; ordinal += 1) assessTripBounds(bounds, ordinal);
    expect(JSON.stringify(bounds)).toBe(before);
  });

  it("is referentially transparent — the same inputs always give the same result", () => {
    const first = assessTripBounds(RANGE_15, 17);
    const second = assessTripBounds({ ...RANGE_15 }, 17);
    expect(second).toEqual(first);
  });

  it("returns a fresh object each call, so a caller can never mutate a shared assessment", () => {
    const a = assessTripBounds(RANGE_15, 3);
    const b = assessTripBounds(RANGE_15, 3);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("assessTripBounds — timezone invariance", () => {
  const ORIGINAL_TZ = process.env.TZ;

  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("produces identical assessments east and west of UTC", () => {
    const serialized: string[] = [];
    for (const tz of ["UTC", "Etc/GMT+12", "Etc/GMT-14", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = tz;
      serialized.push(
        JSON.stringify([0, 7, 14, 15, 20].map((ordinal) => assessTripBounds(RANGE_15, ordinal)))
      );
    }
    expect(new Set(serialized).size).toBe(1);
  });
});

describe("buildTripBoundsSummary — three distinct facts, no recommendation", () => {
  it("reports the range, the bucket count and no mismatch when there are fewer buckets", () => {
    expect(buildTripBoundsSummary(RANGE_15, 12)).toEqual({
      startDate: "2027-02-19",
      endDate: "2027-03-05",
      tripCalendarDays: 15,
      dayCount: 12,
      unavailableReason: null,
      daysAfterTripEnd: 0,
    });
  });

  it("gives the FEWER and EQUAL cases the same shape — neither is privileged as correct", () => {
    const fewer = buildTripBoundsSummary(RANGE_15, 12);
    const equal = buildTripBoundsSummary(RANGE_15, 15);
    expect(fewer.daysAfterTripEnd).toBe(0);
    expect(equal.daysAfterTripEnd).toBe(0);
    expect(fewer.unavailableReason).toBe(equal.unavailableReason);
  });

  it("counts exactly how many buckets fall after the end date when there are more", () => {
    expect(buildTripBoundsSummary(RANGE_15, 18).daysAfterTripEnd).toBe(3);
    expect(buildTripBoundsSummary({ startDate: "2027-02-19", endDate: "2027-02-19" }, 3).daysAfterTripEnd).toBe(2);
  });

  it("agrees exactly with the per-day assessment about which buckets are out", () => {
    const dayCount = 18;
    const summary = buildTripBoundsSummary(RANGE_15, dayCount);
    const assessedOut = Array.from({ length: dayCount }, (_unused, ordinal) =>
      assessTripBounds(RANGE_15, ordinal)
    ).filter((assessment) => assessment.kind === "after-trip-end").length;
    expect(summary.daysAfterTripEnd).toBe(assessedOut);
  });

  it("reports dayCount null (never 0) when there is no day assignment at all", () => {
    const summary = buildTripBoundsSummary(RANGE_15, null);
    expect(summary.dayCount).toBeNull();
    expect(summary.daysAfterTripEnd).toBeNull();
    expect(summary.tripCalendarDays).toBe(15); // the range still resolves and is still shown
  });

  it("reports the unavailable reason and no mismatch count for each partial/invalid range", () => {
    expect(buildTripBoundsSummary({ startDate: null, endDate: null }, 4)).toMatchObject({
      tripCalendarDays: null,
      unavailableReason: "no-start-date",
      daysAfterTripEnd: null,
    });
    expect(buildTripBoundsSummary({ startDate: "2027-02-19", endDate: null }, 4)).toMatchObject({
      unavailableReason: "no-end-date",
      daysAfterTripEnd: null,
    });
    expect(buildTripBoundsSummary({ startDate: null, endDate: "2027-03-05" }, 4)).toMatchObject({
      unavailableReason: "no-start-date",
      daysAfterTripEnd: null,
    });
    expect(buildTripBoundsSummary({ startDate: "2027-03-05", endDate: "2027-02-19" }, 4)).toMatchObject({
      unavailableReason: "inverted-range",
      daysAfterTripEnd: null,
    });
    expect(buildTripBoundsSummary({ startDate: "2027-02-30", endDate: "2027-03-05" }, 4)).toMatchObject({
      unavailableReason: "invalid-date",
      daysAfterTripEnd: null,
    });
  });

  it("keeps both endpoints verbatim, including an inverted pair", () => {
    const summary = buildTripBoundsSummary({ startDate: "2027-03-05", endDate: "2027-02-19" }, 4);
    expect(summary.startDate).toBe("2027-03-05");
    expect(summary.endDate).toBe("2027-02-19");
  });

  it("rejects a nonsensical bucket count rather than reporting a fabricated mismatch", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const summary = buildTripBoundsSummary(RANGE_15, bad);
      expect(summary.dayCount, String(bad)).toBeNull();
      expect(summary.daysAfterTripEnd, String(bad)).toBeNull();
    }
  });

  it("never returns a negative mismatch count", () => {
    for (const dayCount of [0, 1, 14, 15, 16, 100]) {
      expect(buildTripBoundsSummary(RANGE_15, dayCount).daysAfterTripEnd).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("trip-bounds.ts — architectural invariants (source scan)", () => {
  async function readSource(): Promise<string> {
    return readFile(new URL("./trip-bounds.ts", import.meta.url), "utf8");
  }

  /**
   * The module's CODE with every comment removed. The doc comments deliberately NAME the things
   * whose absence they explain ("no day id crosses this line", "there is deliberately no
   * `before-trip-start`"), so a whole-file scan for those tokens would fail on the very prose that
   * documents the invariant. These assertions are about what the code does, so they read the code.
   */
  async function readCode(): Promise<string> {
    const source = await readSource();
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  it("takes no day id: the evaluator's signature is (bounds, ordinalIndex: number)", async () => {
    const source = await readSource();
    expect(source).toContain("export function assessTripBounds(bounds: TripBounds, ordinalIndex: number)");
    // No identifier resembling a day id, and no day entity type, appears anywhere in the code.
    const code = await readCode();
    expect(code).not.toMatch(/\bdayId\b/);
    expect(code).not.toMatch(/PlanningDay/);
  });

  it("reads no local-timezone date component, serializes no instant and reads no clock", async () => {
    const source = await readSource();
    for (const forbidden of [
      "getFullYear(",
      "getMonth(",
      "getDate(",
      "getHours(",
      "getMinutes(",
      "toISOString",
      "Date.now",
      "new Date(",
      "toLocale",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
    // Nor any timezone identifier or clock-time parsing.
    expect(source).not.toMatch(/Asia\/Tokyo|UTC[+-]|timeZone:/);
  });

  it("depends only on civil-date.ts — no draft, no place, no schedule, no storage", async () => {
    const source = await readSource();
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports).toEqual(["./civil-date"]);
  });

  it("never persists an assessment — the module touches no storage API", async () => {
    const source = await readSource();
    for (const forbidden of ["localStorage", "sessionStorage", "setItem", "getItem", "JSON.stringify"]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it("declares exactly the five approved unavailable reasons and the three approved kinds", async () => {
    const source = await readSource();
    for (const reason of ["invalid-ordinal", "no-start-date", "no-end-date", "invalid-date", "inverted-range"]) {
      expect(source, reason).toContain(`"${reason}"`);
    }
    for (const kind of ["bounds-unavailable", "within-bounds", "after-trip-end"]) {
      expect(source, kind).toContain(`"${kind}"`);
    }
    // There is no fourth kind anywhere in the code — the only mention is the doc comment
    // explaining why the state is structurally unreachable.
    expect(await readCode()).not.toContain("before-trip-start");
  });
});
