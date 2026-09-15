import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import placesJson from "../data/places.json";
import { buildDayAssignment, type DayAssignment } from "./day-assignment";
import { resolveDuration, type MinuteRange } from "./duration";
import { interpretHoursText, interpretPlaceHours, type RecordedHoursFact } from "./recorded-hours";
import {
  buildDayRecordedIntervalFits,
  derivePlaceRecordedIntervalFit,
  evaluateRecordedIntervalFit,
  parseChosenStartMinutes,
  parseRecordedInterval,
  VISIT_START_TIME_PATTERN,
  type RecordedIntervalDurationFit,
} from "./recorded-interval-fit";
import type { Place } from "../types";

const places = placesJson as unknown as Place[];
const VISIT_DATE = "2027-02-19";

/** Builds a `recorded-interval` fact from text the real classifier agrees is
 * `fixed-interval-clean` — never a hand-made object, so a test can never assert against a shape
 * `recorded-hours.ts` would not actually produce. */
function intervalFact(raw: string): RecordedHoursFact & { kind: "recorded-interval" } {
  const fact = interpretHoursText(raw);
  if (fact.kind !== "recorded-interval") {
    throw new Error(`expected "${raw}" to classify as recorded-interval, got ${fact.kind}`);
  }
  return fact;
}

function range(minMinutes: number, maxMinutes: number): MinuteRange {
  return { minMinutes, maxMinutes };
}

describe("parseRecordedInterval — the narrow second parser", () => {
  it("parses the only shape the real dataset actually uses (U+2013 en dash)", () => {
    expect(parseRecordedInterval(intervalFact("09:00–17:00"))).toEqual({
      kind: "parsed",
      intervalStartMinutes: 540,
      intervalEndMinutes: 1020,
      crossesMidnight: false,
    });
  });

  it("accepts the ASCII hyphen the classifier's own separator set permits", () => {
    expect(parseRecordedInterval(intervalFact("09:00-17:00"))).toEqual({
      kind: "parsed",
      intervalStartMinutes: 540,
      intervalEndMinutes: 1020,
      crossesMidnight: false,
    });
  });

  it("accepts the em dash the classifier's own separator set permits", () => {
    expect(parseRecordedInterval(intervalFact("09:00—17:00"))).toEqual({
      kind: "parsed",
      intervalStartMinutes: 540,
      intervalEndMinutes: 1020,
      crossesMidnight: false,
    });
  });

  it("refuses an end bound with no minutes rather than assuming :00", () => {
    // This shape classifies fixed-interval-clean/SAFE today: recorded-hours.ts's TIME_RANGE_RE
    // makes the end's minutes optional. The narrow parser must refuse, never repair.
    const fact = intervalFact("09:00–17");
    expect(fact.intervalRaw).toBe("09:00–17");
    expect(parseRecordedInterval(fact)).toEqual({ kind: "unparseable", reason: "end-without-minutes" });
  });

  it("refuses an out-of-range hour rather than wrapping it", () => {
    const fact = intervalFact("25:00–26:00");
    expect(fact.tier).toBe("safe");
    expect(parseRecordedInterval(fact)).toEqual({ kind: "unparseable", reason: "clock-out-of-range" });
  });

  it("refuses an out-of-range minute", () => {
    expect(parseRecordedInterval(intervalFact("09:60–17:00"))).toEqual({
      kind: "unparseable",
      reason: "clock-out-of-range",
    });
  });

  it("refuses a degenerate same-time interval, and specifically does not read it as always open", () => {
    const parsed = parseRecordedInterval(intervalFact("09:00–09:00"));
    expect(parsed).toEqual({ kind: "unparseable", reason: "degenerate" });
    expect(parsed).not.toHaveProperty("crossesMidnight");
  });

  it("detects an overnight interval instead of silently wrapping it", () => {
    expect(parseRecordedInterval(intervalFact("18:00–02:00"))).toEqual({
      kind: "parsed",
      intervalStartMinutes: 1080,
      intervalEndMinutes: 120,
      crossesMidnight: true,
    });
  });

  it("treats an end bound of 00:00 as overnight, never rewriting it to 1440", () => {
    const parsed = parseRecordedInterval(intervalFact("09:00–00:00"));
    expect(parsed).toEqual({
      kind: "parsed",
      intervalStartMinutes: 540,
      intervalEndMinutes: 0,
      crossesMidnight: true,
    });
    expect(parsed).not.toMatchObject({ intervalEndMinutes: 1440 });
  });

  it("parses 00:00 as a legitimate start bound, not a sentinel", () => {
    expect(parseRecordedInterval(intervalFact("00:00–09:00"))).toEqual({
      kind: "parsed",
      intervalStartMinutes: 0,
      intervalEndMinutes: 540,
      crossesMidnight: false,
    });
  });

  it("refuses a token with trailing text rather than matching a prefix of it", () => {
    // Anchored end to end: unlike the classifier's unanchored TIME_RANGE_RE, a token that is not
    // wholly a clock range is refused instead of partially consumed.
    expect(parseRecordedInterval({ ...intervalFact("09:00–17:00"), intervalRaw: "09:00–17:00 aprox." })).toEqual({
      kind: "unparseable",
      reason: "shape",
    });
  });
});

describe("parseChosenStartMinutes — the user's own value", () => {
  it.each([
    ["09:00", 540],
    ["00:00", 0],
    ["23:59", 1439],
    ["14:30", 870],
  ])("parses %s", (input, expected) => {
    expect(parseChosenStartMinutes(input)).toBe(expected);
  });

  it.each(["9:00", "24:00", "12:60", "0900", "9", "", "  ", "09:00:00"])(
    "refuses %s rather than coercing it",
    (input) => {
      expect(parseChosenStartMinutes(input)).toBeNull();
    }
  );

  // Phase 3D-L corrective audit. Design §7 requires the manual time to be refused rather than
  // COERCED on anything that is not an exact HH:mm, and authorises no whitespace normalisation.
  // A `.trim()` here would have made these three strings evaluate to 540 while
  // `withVisitStartTime` and the V3 stored-draft validator — which test the same shared pattern
  // against the raw value — refuse them, which is exactly the disagreement between persistence
  // and arithmetic that sharing `VISIT_START_TIME_PATTERN` exists to prevent.
  it.each([
    ["leading space", " 09:00"],
    ["trailing space", "09:00 "],
    ["leading tab", "\t09:00"],
    ["trailing newline", "09:00\n"],
    ["surrounding spaces", " 09:00 "],
  ])("refuses a whitespace-padded %s without normalising it", (_label, input) => {
    expect(parseChosenStartMinutes(input)).toBeNull();
  });

  it("never normalises whitespace away where the shared pattern would refuse the raw value", () => {
    for (const input of [" 09:00", "09:00 ", "\t09:00", "09:00\n", " 09:00 "]) {
      expect(VISIT_START_TIME_PATTERN.test(input)).toBe(false);
      expect(parseChosenStartMinutes(input)).toBeNull();
    }
  });

  it("accepts exactly the strings the shared pattern accepts, and only those", () => {
    for (const input of ["09:00", "00:00", "23:59", "14:30", " 09:00", "09:00 ", "\t09:00", "9:00", "24:00", "12:60"]) {
      expect(parseChosenStartMinutes(input) !== null).toBe(VISIT_START_TIME_PATTERN.test(input));
    }
  });

  it("refuses a whitespace-padded time end to end through evaluateRecordedIntervalFit", () => {
    for (const input of [" 09:00", "09:00 ", "\t09:00"]) {
      expect(
        evaluateRecordedIntervalFit(intervalFact("09:00\u201317:00"), range(60, 90), input, VISIT_DATE)
      ).toEqual({ kind: "no-start-time-chosen" });
    }
  });

  it("treats an absent value as absent, never as a default", () => {
    expect(parseChosenStartMinutes(null)).toBeNull();
    expect(parseChosenStartMinutes(undefined)).toBeNull();
  });
});

describe("evaluateRecordedIntervalFit — eligibility", () => {
  it("accepts a recorded-interval fact", () => {
    const result = evaluateRecordedIntervalFit(intervalFact("09:00–17:00"), range(60, 90), "09:00", VISIT_DATE);
    expect(result.kind).toBe("recorded-duration-fits-interval");
  });

  it("refuses recorded-24h even though its tier is SAFE", () => {
    const fact = interpretHoursText("Espacio público 24 h");
    expect(fact.kind).toBe("recorded-24h");
    expect(fact.tier).toBe("safe");
    expect(evaluateRecordedIntervalFit(fact, range(60, 90), "09:00", VISIT_DATE)).toEqual({
      kind: "interval-not-evaluable",
      reason: "hours-not-a-recorded-interval",
    });
  });

  it("refuses a real 24h record whose own text narrows it to a sub-facility (JP-016)", () => {
    const jp016 = places.find((place) => place.id === "JP-016");
    expect(jp016).toBeDefined();
    const fact = interpretPlaceHours(jp016!);
    expect(fact.kind).toBe("recorded-24h");
    // The raw text names a 06:00–17:00 hall interval that the known-24h branch discards. Nothing
    // here may reach for it.
    expect(jp016!.schedule.hours).toContain("06:00–17:00");
    expect(evaluateRecordedIntervalFit(fact, range(60, 120), "09:00", VISIT_DATE)).toEqual({
      kind: "interval-not-evaluable",
      reason: "hours-not-a-recorded-interval",
    });
  });

  it.each([
    ["known-24h-with-caveat", "Abierto 24 h; puede cerrar por viento"],
    ["seasonal-variable", "09:00–16:00/17:30 según temporada"],
    ["solar-relative", "Amanecer–atardecer; varía por mes"],
    ["daytime-qualitative", "Diurno"],
    ["partial-single-bound", "Abre desde 06:00; cierre variable"],
    ["ambiguous-alternative-interval", "09:00–16:00/16:30"],
    ["fixed-interval-with-caveat", "10:00–17:00 aprox.; verificar exposición"],
  ])("refuses the PARTIAL family %s, even when a clock token is present", (category, raw) => {
    const fact = interpretHoursText(raw);
    expect(fact.category).toBe(category);
    expect(fact.tier).toBe("partial");
    expect(evaluateRecordedIntervalFit(fact, range(30, 45), "09:00", VISIT_DATE)).toEqual({
      kind: "interval-not-evaluable",
      reason: "hours-not-a-recorded-interval",
    });
  });

  it.each([
    ["weather-or-tide-dependent", "Según marea y operador"],
    ["third-party-operator-dependent", "Según tienda, aprox. 11:00–20:00"],
  ])("refuses the OPAQUE family %s, even when a clean-looking token is present", (category, raw) => {
    const fact = interpretHoursText(raw);
    expect(fact.category).toBe(category);
    expect(fact.tier).toBe("opaque");
    expect(evaluateRecordedIntervalFit(fact, range(30, 45), "09:00", VISIT_DATE)).toEqual({
      kind: "interval-not-evaluable",
      reason: "hours-not-a-recorded-interval",
    });
  });

  it.each([
    ["missing", ""],
    ["explicit-unknown-variable", "Variable por fecha"],
    ["qualitative-uncategorized", "Horario asignado"],
  ])("refuses the UNKNOWN family %s", (category, raw) => {
    const fact = interpretHoursText(raw);
    expect(fact.category).toBe(category);
    expect(fact.tier).toBe("unknown");
    expect(evaluateRecordedIntervalFit(fact, range(30, 45), "09:00", VISIT_DATE)).toEqual({
      kind: "interval-not-evaluable",
      reason: "hours-not-a-recorded-interval",
    });
  });

  it("never rescues an excluded fact by re-reading its raw text", () => {
    // "Según tienda, aprox. 11:00–20:00" contains a perfectly parseable 11:00–20:00. A duration of
    // 60 min from 11:00 would trivially "fit" if the raw string were re-scanned — it must not be.
    const opaque = interpretHoursText("Según tienda, aprox. 11:00–20:00");
    const result = evaluateRecordedIntervalFit(opaque, range(60, 60), "11:00", VISIT_DATE);
    expect(result.kind).toBe("interval-not-evaluable");
    expect(result).not.toHaveProperty("remainingMinutes");
  });
});

describe("evaluateRecordedIntervalFit — refusal states", () => {
  const fact = intervalFact("09:00–17:00");

  it("reports an unevaluable visit date before anything else", () => {
    expect(evaluateRecordedIntervalFit(fact, range(60, 90), "09:00", null)).toEqual({
      kind: "visit-date-not-evaluable",
    });
  });

  it("names an unparseable token", () => {
    expect(evaluateRecordedIntervalFit(intervalFact("09:00–17"), range(60, 90), "09:00", VISIT_DATE)).toEqual({
      kind: "interval-not-evaluable",
      reason: "interval-token-unparseable",
    });
  });

  it("names an overnight interval as a refusal, never evaluating it", () => {
    const result = evaluateRecordedIntervalFit(intervalFact("18:00–02:00"), range(60, 90), "23:30", VISIT_DATE);
    expect(result).toEqual({ kind: "interval-not-evaluable", reason: "overnight-interval-not-supported" });
    expect(result).not.toHaveProperty("remainingMinutes");
  });

  it("reports a non-numeric duration", () => {
    expect(evaluateRecordedIntervalFit(fact, null, "09:00", VISIT_DATE)).toEqual({
      kind: "duration-not-evaluable",
    });
  });

  it("reports a missing start time without inventing one", () => {
    expect(evaluateRecordedIntervalFit(fact, range(60, 90), null, VISIT_DATE)).toEqual({
      kind: "no-start-time-chosen",
    });
    expect(evaluateRecordedIntervalFit(fact, range(60, 90), "", VISIT_DATE)).toEqual({
      kind: "no-start-time-chosen",
    });
  });

  it("decides record-level refusals before asking the user for a time", () => {
    // A place whose duration can never be evaluated must say so up front, rather than inviting the
    // user to type a time that could never produce an answer.
    expect(evaluateRecordedIntervalFit(fact, null, null, VISIT_DATE)).toEqual({
      kind: "duration-not-evaluable",
    });
  });
});

describe("evaluateRecordedIntervalFit — start-time boundaries for 09:00–17:00", () => {
  const fact = intervalFact("09:00–17:00");
  const duration = range(30, 60);

  it("treats 08:59 as outside the recorded interval", () => {
    expect(evaluateRecordedIntervalFit(fact, duration, "08:59", VISIT_DATE)).toEqual({
      kind: "start-time-outside-recorded-interval",
      chosenStartMinutes: 539,
    });
  });

  it("treats 09:00, exactly the recorded opening, as inside", () => {
    expect(evaluateRecordedIntervalFit(fact, duration, "09:00", VISIT_DATE)).toMatchObject({
      kind: "recorded-duration-fits-interval",
      remainingMinutes: 480,
    });
  });

  it("treats an interior time as inside", () => {
    expect(evaluateRecordedIntervalFit(fact, duration, "13:00", VISIT_DATE)).toMatchObject({
      kind: "recorded-duration-fits-interval",
      remainingMinutes: 240,
    });
  });

  it("treats 16:59, one minute before closing, as inside", () => {
    expect(evaluateRecordedIntervalFit(fact, duration, "16:59", VISIT_DATE)).toMatchObject({
      kind: "recorded-duration-exceeds-interval",
      remainingMinutes: 1,
    });
  });

  it("treats 17:00, exactly the recorded closing, as outside", () => {
    expect(evaluateRecordedIntervalFit(fact, duration, "17:00", VISIT_DATE)).toEqual({
      kind: "start-time-outside-recorded-interval",
      chosenStartMinutes: 1020,
    });
  });

  it("treats 17:01, after closing, as outside", () => {
    expect(evaluateRecordedIntervalFit(fact, duration, "17:01", VISIT_DATE)).toEqual({
      kind: "start-time-outside-recorded-interval",
      chosenStartMinutes: 1021,
    });
  });

  it("computes the remaining time from the CHOSEN start, never the interval's span", () => {
    // The span is 480. Starting at 15:00 leaves 120 — if the span were used instead, a 300-minute
    // duration would wrongly "fit".
    const result = evaluateRecordedIntervalFit(fact, range(300, 300), "15:00", VISIT_DATE);
    expect(result).toEqual({
      kind: "recorded-duration-exceeds-interval",
      remainingMinutes: 120,
      duration: range(300, 300),
    });
  });
});

describe("evaluateRecordedIntervalFit — range semantics and their exact boundaries", () => {
  const fact = intervalFact("09:00–17:00"); // 480 minutes of span

  it("reports a full fit when the recorded maximum is strictly under the remaining time", () => {
    expect(evaluateRecordedIntervalFit(fact, range(60, 90), "15:00", VISIT_DATE)).toEqual({
      kind: "recorded-duration-fits-interval",
      remainingMinutes: 120,
      duration: range(60, 90),
    });
  });

  it("reports a full fit when the recorded maximum EQUALS the remaining time", () => {
    expect(evaluateRecordedIntervalFit(fact, range(60, 120), "15:00", VISIT_DATE)).toEqual({
      kind: "recorded-duration-fits-interval",
      remainingMinutes: 120,
      duration: range(60, 120),
    });
  });

  it("reports a minimum-only fit for a true middle case", () => {
    expect(evaluateRecordedIntervalFit(fact, range(60, 180), "15:00", VISIT_DATE)).toEqual({
      kind: "only-minimum-duration-fits-interval",
      remainingMinutes: 120,
      duration: range(60, 180),
    });
  });

  it("reports a minimum-only fit when the recorded minimum EQUALS the remaining time", () => {
    expect(evaluateRecordedIntervalFit(fact, range(120, 180), "15:00", VISIT_DATE)).toEqual({
      kind: "only-minimum-duration-fits-interval",
      remainingMinutes: 120,
      duration: range(120, 180),
    });
  });

  it("reports an excess when even the recorded minimum exceeds the remaining time", () => {
    expect(evaluateRecordedIntervalFit(fact, range(150, 180), "15:00", VISIT_DATE)).toEqual({
      kind: "recorded-duration-exceeds-interval",
      remainingMinutes: 120,
      duration: range(150, 180),
    });
  });

  it("never reduces a range to a midpoint", () => {
    // Midpoint of 60–180 is 120, which equals the remaining time and would read as a full fit.
    // The correct answer is minimum-only: the recorded maximum does not fit.
    expect(evaluateRecordedIntervalFit(fact, range(60, 180), "15:00", VISIT_DATE).kind).toBe(
      "only-minimum-duration-fits-interval"
    );
  });

  it("never answers from the minimum alone", () => {
    // min 60 fits in 120, but max 200 does not — a min-only rule would call this a full fit.
    expect(evaluateRecordedIntervalFit(fact, range(60, 200), "15:00", VISIT_DATE).kind).toBe(
      "only-minimum-duration-fits-interval"
    );
  });

  it("never answers from the maximum alone", () => {
    // max 200 does not fit in 120, but min 60 does — a max-only rule would call this an excess.
    expect(evaluateRecordedIntervalFit(fact, range(60, 200), "15:00", VISIT_DATE).kind).not.toBe(
      "recorded-duration-exceeds-interval"
    );
  });

  it("carries both recorded bounds on every evaluated outcome, discarding neither end", () => {
    for (const duration of [range(60, 90), range(60, 180), range(150, 180)]) {
      const result = evaluateRecordedIntervalFit(fact, duration, "15:00", VISIT_DATE);
      expect(result).toMatchObject({ duration });
    }
  });
});

describe("the result union is closed", () => {
  const fact = intervalFact("09:00–17:00");

  const everyOutcome: RecordedIntervalDurationFit[] = [
    evaluateRecordedIntervalFit(fact, range(60, 90), "09:00", null),
    evaluateRecordedIntervalFit(interpretHoursText("Diurno"), range(60, 90), "09:00", VISIT_DATE),
    evaluateRecordedIntervalFit(intervalFact("09:00–17"), range(60, 90), "09:00", VISIT_DATE),
    evaluateRecordedIntervalFit(intervalFact("18:00–02:00"), range(60, 90), "20:00", VISIT_DATE),
    evaluateRecordedIntervalFit(fact, null, "09:00", VISIT_DATE),
    evaluateRecordedIntervalFit(fact, range(60, 90), null, VISIT_DATE),
    evaluateRecordedIntervalFit(fact, range(60, 90), "08:00", VISIT_DATE),
    evaluateRecordedIntervalFit(fact, range(60, 90), "09:00", VISIT_DATE),
    evaluateRecordedIntervalFit(fact, range(60, 180), "15:00", VISIT_DATE),
    evaluateRecordedIntervalFit(fact, range(150, 180), "15:00", VISIT_DATE),
  ];

  it("produces exactly the eight approved kinds and no others", () => {
    expect(new Set(everyOutcome.map((outcome) => outcome.kind))).toEqual(
      new Set([
        "visit-date-not-evaluable",
        "interval-not-evaluable",
        "duration-not-evaluable",
        "no-start-time-chosen",
        "start-time-outside-recorded-interval",
        "recorded-duration-fits-interval",
        "only-minimum-duration-fits-interval",
        "recorded-duration-exceeds-interval",
      ])
    );
  });

  it("reaches all three named interval-not-evaluable reasons", () => {
    const reasons = everyOutcome
      .filter((outcome) => outcome.kind === "interval-not-evaluable")
      .map((outcome) => (outcome as { reason: string }).reason);
    expect(new Set(reasons)).toEqual(
      new Set([
        "hours-not-a-recorded-interval",
        "interval-token-unparseable",
        "overnight-interval-not-supported",
      ])
    );
  });

  it("never returns null, undefined, or a boolean-shaped result", () => {
    for (const outcome of everyOutcome) {
      expect(outcome).not.toBeNull();
      expect(outcome).toBeTypeOf("object");
      expect(typeof outcome.kind).toBe("string");
      for (const value of Object.values(outcome)) {
        expect(typeof value).not.toBe("boolean");
      }
    }
  });

  it("uses no vocabulary that would describe the place rather than the record", () => {
    const serialised = JSON.stringify(everyOutcome).toLowerCase();
    for (const forbidden of ["open", "available", "feasible", "visitable", "compatible", "valid", '"ok"']) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});

describe("derivePlaceRecordedIntervalFit — the date gate and control eligibility", () => {
  const interval = places.find((place) => interpretPlaceHours(place).kind === "recorded-interval")!;
  const h24 = places.find((place) => interpretPlaceHours(place).kind === "recorded-24h")!;

  function assignmentFor(ids: readonly string[]): DayAssignment {
    return buildDayAssignment(ids, [[...ids]]);
  }

  it("returns a signal for a recorded-interval place with a valid assigned day", () => {
    const item = derivePlaceRecordedIntervalFit(interval, assignmentFor([interval.id]), VISIT_DATE, {});
    expect(item).not.toBeNull();
    expect(item!.placeId).toBe(interval.id);
    expect(item!.hours.kind).toBe("recorded-interval");
  });

  it("returns null — no control at all — for a recorded-24h place", () => {
    expect(derivePlaceRecordedIntervalFit(h24, assignmentFor([h24.id]), VISIT_DATE, {})).toBeNull();
  });

  it("returns null when no start date is set", () => {
    expect(derivePlaceRecordedIntervalFit(interval, assignmentFor([interval.id]), null, {})).toBeNull();
  });

  it("returns null when the day assignment is structurally invalid", () => {
    const invalid = buildDayAssignment([interval.id], [[interval.id], [interval.id]]);
    expect(invalid.valid).toBe(false);
    expect(derivePlaceRecordedIntervalFit(interval, invalid, VISIT_DATE, {})).toBeNull();
  });

  it("returns null when the place is in no day bucket", () => {
    expect(derivePlaceRecordedIntervalFit(interval, buildDayAssignment([], [[]]), VISIT_DATE, {})).toBeNull();
  });

  it("carries the stored manual time through, and no default when there is none", () => {
    const withTime = derivePlaceRecordedIntervalFit(interval, assignmentFor([interval.id]), VISIT_DATE, {
      [interval.id]: "10:00",
    });
    expect(withTime!.visitStartTime).toBe("10:00");
    const without = derivePlaceRecordedIntervalFit(interval, assignmentFor([interval.id]), VISIT_DATE, {});
    expect(without!.visitStartTime).toBeNull();
    expect(without!.fit.kind).toBe("no-start-time-chosen");
  });

  it("re-evaluates from the current time, retaining nothing stale", () => {
    const assignment = assignmentFor([interval.id]);
    const first = derivePlaceRecordedIntervalFit(interval, assignment, VISIT_DATE, { [interval.id]: "09:00" });
    const second = derivePlaceRecordedIntervalFit(interval, assignment, VISIT_DATE, {});
    expect(first!.fit.kind).not.toBe("no-start-time-chosen");
    expect(second!.fit.kind).toBe("no-start-time-chosen");
  });
});

describe("buildDayRecordedIntervalFits — the day-card boundary", () => {
  it("includes only recorded-interval places, in the day's own order", () => {
    const intervalPlaces = places.filter((place) => interpretPlaceHours(place).kind === "recorded-interval");
    const h24Places = places.filter((place) => interpretPlaceHours(place).kind === "recorded-24h");
    const dayPlaces = [intervalPlaces[0], h24Places[0], intervalPlaces[1]];
    const ids = dayPlaces.map((place) => place.id);

    const items = buildDayRecordedIntervalFits(dayPlaces, buildDayAssignment(ids, [ids]), VISIT_DATE, {});
    expect(items.map((item) => item.placeId)).toEqual([intervalPlaces[0].id, intervalPlaces[1].id]);
  });

  it("returns nothing at all when the date contract is unmet", () => {
    const dayPlaces = places.filter((place) => interpretPlaceHours(place).kind === "recorded-interval").slice(0, 2);
    const ids = dayPlaces.map((place) => place.id);
    expect(buildDayRecordedIntervalFits(dayPlaces, buildDayAssignment(ids, [ids]), null, {})).toEqual([]);
  });
});

describe("real-dataset regression (re-derived, never hardcoded into production behaviour)", () => {
  const facts = places.map((place) => interpretPlaceHours(place));
  const intervalPlaces = places.filter((_, index) => facts[index].kind === "recorded-interval");
  const h24Places = places.filter((_, index) => facts[index].kind === "recorded-24h");

  it("covers 214 places", () => {
    expect(places).toHaveLength(214);
  });

  it("finds 65 SAFE recorded-interval places and 15 SAFE recorded-24h places", () => {
    expect(intervalPlaces).toHaveLength(65);
    expect(h24Places).toHaveLength(15);
  });

  it("finds 62 interval places with a numeric duration and 3 without", () => {
    const numeric = intervalPlaces.filter((place) => resolveDuration(place.duration) !== null);
    expect(numeric).toHaveLength(62);
    const nonNumeric = intervalPlaces.filter((place) => resolveDuration(place.duration) === null);
    expect(nonNumeric.map((place) => place.id).sort()).toEqual(["JP-121", "JP-147", "JP-211"]);
  });

  it("parses all 65 real tokens with zero failures, zero overnight, and zero degenerate", () => {
    const parsed = intervalPlaces.map((place) => {
      const fact = interpretPlaceHours(place);
      if (fact.kind !== "recorded-interval") throw new Error("unreachable");
      return parseRecordedInterval(fact);
    });
    expect(parsed.filter((result) => result.kind === "unparseable")).toHaveLength(0);
    expect(parsed.filter((result) => result.kind === "parsed" && result.crossesMidnight)).toHaveLength(0);
  });

  it("finds 29 distinct eligible interval tokens", () => {
    const tokens = new Set(
      intervalPlaces.map((place) => {
        const fact = interpretPlaceHours(place);
        if (fact.kind !== "recorded-interval") throw new Error("unreachable");
        return fact.intervalRaw;
      })
    );
    expect(tokens.size).toBe(29);
  });

  it("keeps every real clock value inside 00:00–23:59", () => {
    for (const place of intervalPlaces) {
      const fact = interpretPlaceHours(place);
      if (fact.kind !== "recorded-interval") throw new Error("unreachable");
      const parsed = parseRecordedInterval(fact);
      expect(parsed.kind).toBe("parsed");
      if (parsed.kind !== "parsed") continue;
      for (const minutes of [parsed.intervalStartMinutes, parsed.intervalEndMinutes]) {
        expect(minutes).toBeGreaterThanOrEqual(0);
        expect(minutes).toBeLessThanOrEqual(1439);
      }
    }
  });

  it("never evaluates a single one of the 15 recorded-24h places, at any chosen time", () => {
    for (const place of h24Places) {
      for (const time of ["00:00", "09:00", "23:59"]) {
        const result = evaluateRecordedIntervalFit(
          interpretPlaceHours(place),
          resolveDuration(place.duration),
          time,
          VISIT_DATE
        );
        expect(result).toEqual({ kind: "interval-not-evaluable", reason: "hours-not-a-recorded-interval" });
      }
    }
  });
});

describe("structural guarantees (source-scanned — otherwise unobservable)", () => {
  const SOURCE_PATH = new URL("./recorded-interval-fit.ts", import.meta.url);

  /**
   * Strips block and line comments, so these scans assert on what the module's CODE references —
   * not on what its documentation names. The header deliberately names `bestTime`, closures,
   * transfers and `Date` in order to record that they are excluded; scanning the raw file would
   * make that explanation itself look like a violation, and the only way to keep such a test green
   * would be to delete the explanation. The executable statement is "this code does not touch
   * those", and that is what is checked here.
   */
  async function source(): Promise<string> {
    const raw = await readFile(SOURCE_PATH, "utf8");
    return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  it("never reads bestTime", async () => {
    expect(await source()).not.toContain("bestTime");
  });

  it("never reads closures or any closure/composition fact", async () => {
    const text = await source();
    for (const forbidden of [
      "schedule.closures",
      "interpretClosureText",
      "assessWeekdayClosure",
      "classifyHoursClosureComposition",
      "ClosureFact",
      "WeekdayClosureAssessment",
      "CompositionClass",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("never reads transfer, transit, or any other place's time", async () => {
    const text = await source();
    for (const forbidden of ["TransferEdge", "getBestTransfer", "./transfer", "./transit", "ordered-sequence"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("constructs no Date, epoch, ISO instant, or timezone", async () => {
    const text = await source();
    for (const forbidden of ["new Date", "Date.now", "getTime()", "toISOString", "Asia/Tokyo", "timeZone", "Temporal"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("performs no midpoint or averaging arithmetic", async () => {
    const text = await source();
    for (const forbidden of ["/ 2", "midpoint", "average", "median"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("imports only the date helper from the composition module, never a closure symbol", async () => {
    const text = await source();
    const importLine = /import \{([^}]*)\} from "\.\/hours-closure-composition";/.exec(text);
    expect(importLine).not.toBeNull();
    expect(importLine![1].trim()).toBe("deriveHoursClosureVisitDate");
  });

  it("shares one visit-start-time pattern with the persistence layer", async () => {
    const draftSource = await readFile(new URL("./planning-draft.ts", import.meta.url), "utf8");
    expect(draftSource).toContain("VISIT_START_TIME_PATTERN");
    expect(VISIT_START_TIME_PATTERN.test("09:00")).toBe(true);
    expect(VISIT_START_TIME_PATTERN.test("9:00")).toBe(false);
    expect(VISIT_START_TIME_PATTERN.test("24:00")).toBe(false);
  });

  it("leaves recorded-hours.ts untouched by this phase", async () => {
    const classifier = await readFile(new URL("./recorded-hours.ts", import.meta.url), "utf8");
    // The classifier must still stop at the raw token — no minutes, no parsed interval.
    expect(classifier).not.toContain("intervalStartMinutes");
    expect(classifier).not.toContain("chosenStartMinutes");
    expect(classifier).toContain("never minutes-since-midnight");
  });
});
