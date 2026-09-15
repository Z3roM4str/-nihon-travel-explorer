import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildDayAssignment, validateDayPartition } from "./day-assignment";
import { addCivilDays } from "./civil-date";
import { buildDayWeekdaySignal } from "./day-weekday-signal";
import { buildPresentableDayHoursClosureCompositions } from "./hours-closure-composition";
import { buildDayRecordedIntervalFits } from "./recorded-interval-fit";
import { deriveVisitDateForPlace, derivePlaceReservationDateWindow } from "./reservation-deadline";
import { evaluateReservationWindowReference } from "./reservation-window-reference";
import { dayMatrixFromPlanningDays, withEndDate, withStartDate, type ManualPlanningDraftV6 } from "./planning-draft-v6";
import { assessTripBounds } from "./trip-bounds";
import placesData from "../data/places.json";
import type { Place } from "../types";

/**
 * Phase 3D-W — §15 tests 59–64 and §11's audit, exercised against the REAL evaluators rather than
 * stubs: the frontier this phase draws is "derivation is unconditional, presentation is
 * conditional", so the only way to prove it is to run the actual chain the planner runs and show
 * that an `after-trip-end` day still produces every signal it produced before.
 *
 * The shared method below is deliberately blunt: compute a signal with `endDate: null`, compute the
 * same signal with an `endDate` that puts the day firmly out of bounds, and assert the two results
 * are deep-equal — while separately asserting that the bounds assessment really did flip. If
 * `endDate` had leaked into any evaluator, the first assertion fails; if the fixture were not
 * actually out of bounds, the second one does.
 */

const PLACES = placesData as Place[];

/** The route below is a real four-place route split one place per day, so ordinal N is day N. */
const ROUTE_IDS = ["JP-019", PLACES[0].id, PLACES[1].id, PLACES[2].id].filter(
  (id, index, all) => all.indexOf(id) === index
);
const DAY_MATRIX = ROUTE_IDS.map((id) => [id]);
const START_DATE = "2027-02-19";
/** A three-calendar-day trip against a four-bucket assignment: ordinal 3 is after the end. */
const END_DATE = "2027-02-21";
const OUT_OF_BOUNDS_ORDINAL = 3;
const REFERENCE_DATE = "2027-01-15";

function draft(endDate: string | null): ManualPlanningDraftV6 {
  return {
    version: 6,
    routeIds: [...ROUTE_IDS],
    days: DAY_MATRIX.map((placeIds, index) => ({
      id: `d${index + 1}`,
      placeIds: [...placeIds],
      accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "unselected" } },
    })),
    startDate: START_DATE,
    endDate,
    visitStartTimes: { [ROUTE_IDS[OUT_OF_BOUNDS_ORDINAL]]: "10:00" },
    accommodations: [],
    accommodationLegs: [],
  };
}

const WITHOUT_BOUND = draft(null);
const WITH_BOUND = draft(END_DATE);

function assignmentFor(source: ManualPlanningDraftV6) {
  const matrix = dayMatrixFromPlanningDays(source.days)!;
  expect(validateDayPartition(source.routeIds, matrix).valid).toBe(true);
  return buildDayAssignment(source.routeIds, matrix);
}

function placesOfDay(ordinal: number): Place[] {
  return DAY_MATRIX[ordinal]
    .map((id) => PLACES.find((place) => place.id === id))
    .filter((place): place is Place => Boolean(place));
}

describe("the fixture really does put a day out of bounds", () => {
  it("has four buckets against a three-calendar-day range", () => {
    expect(DAY_MATRIX.length).toBe(4);
    expect(assessTripBounds(WITH_BOUND, OUT_OF_BOUNDS_ORDINAL)).toMatchObject({
      kind: "after-trip-end",
      tripCalendarDays: 3,
    });
    expect(assessTripBounds(WITH_BOUND, 2).kind).toBe("within-bounds");
  });

  it("reports the same day as bounds-unavailable when no end date is recorded", () => {
    expect(assessTripBounds(WITHOUT_BOUND, OUT_OF_BOUNDS_ORDINAL)).toEqual({
      kind: "bounds-unavailable",
      reason: "no-end-date",
    });
  });
});

describe("real temporal evaluators are unchanged for an after-trip-end day", () => {
  it("deriveVisitDateForPlace still returns the correct arithmetic date", () => {
    const placeId = ROUTE_IDS[OUT_OF_BOUNDS_ORDINAL];
    const withoutBound = deriveVisitDateForPlace(assignmentFor(WITHOUT_BOUND), WITHOUT_BOUND.startDate, placeId);
    const withBound = deriveVisitDateForPlace(assignmentFor(WITH_BOUND), WITH_BOUND.startDate, placeId);
    expect(withoutBound).toBe(addCivilDays(START_DATE, OUT_OF_BOUNDS_ORDINAL));
    expect(withBound).toBe(withoutBound);
    expect(withBound).toBe("2027-02-22");
  });

  it("buildDayWeekdaySignal still produces its closure signal for the out-of-bounds day's date", () => {
    const dayDate = addCivilDays(START_DATE, OUT_OF_BOUNDS_ORDINAL);
    const places = placesOfDay(OUT_OF_BOUNDS_ORDINAL);
    expect(buildDayWeekdaySignal(places, dayDate)).toEqual(buildDayWeekdaySignal(places, dayDate));
    // A weekday is a fact about a date; it does not become unknown because the user is not there.
    expect(buildDayWeekdaySignal(places, dayDate)).not.toBeNull();
  });

  it("the hours/closure composition still produces its items", () => {
    const places = placesOfDay(OUT_OF_BOUNDS_ORDINAL);
    const withoutBound = buildPresentableDayHoursClosureCompositions(
      places,
      assignmentFor(WITHOUT_BOUND),
      WITHOUT_BOUND.startDate
    );
    const withBound = buildPresentableDayHoursClosureCompositions(
      places,
      assignmentFor(WITH_BOUND),
      WITH_BOUND.startDate
    );
    expect(withBound).toEqual(withoutBound);
  });

  it("evaluateRecordedIntervalFit still evaluates the manual visit time", () => {
    const places = placesOfDay(OUT_OF_BOUNDS_ORDINAL);
    const withoutBound = buildDayRecordedIntervalFits(
      places,
      assignmentFor(WITHOUT_BOUND),
      WITHOUT_BOUND.startDate,
      WITHOUT_BOUND.visitStartTimes
    );
    const withBound = buildDayRecordedIntervalFits(
      places,
      assignmentFor(WITH_BOUND),
      WITH_BOUND.startDate,
      WITH_BOUND.visitStartTimes
    );
    expect(withBound).toEqual(withoutBound);
  });

  it("the reservation window → reference relation chain produces the SAME result either way", () => {
    const jp019 = PLACES.find((place) => place.id === "JP-019");
    expect(jp019).toBeDefined();
    if (!jp019) return;

    // Put JP-019 in the out-of-bounds bucket so the chain is genuinely evaluated for such a day.
    const routeIds = [...ROUTE_IDS];
    const matrix = DAY_MATRIX.map((ids) => [...ids]);
    const jpIndex = matrix.findIndex((ids) => ids.includes("JP-019"));
    [matrix[jpIndex], matrix[OUT_OF_BOUNDS_ORDINAL]] = [matrix[OUT_OF_BOUNDS_ORDINAL], matrix[jpIndex]];
    const assignment = buildDayAssignment(routeIds, matrix);

    const visitDate = deriveVisitDateForPlace(assignment, START_DATE, "JP-019");
    expect(visitDate).toBe(addCivilDays(START_DATE, OUT_OF_BOUNDS_ORDINAL));

    const window = derivePlaceReservationDateWindow(jp019, visitDate);
    // Asserting the concrete kind proves this is a real derived window, not a vacuous no-window.
    expect(window.kind).toBe("derived-window");
    const relation = evaluateReservationWindowReference(window, REFERENCE_DATE);

    // The bounds assessment for this same ordinal says the day is after the end of the trip…
    expect(assessTripBounds(WITH_BOUND, OUT_OF_BOUNDS_ORDINAL).kind).toBe("after-trip-end");
    // …and none of the three evaluators above took `endDate` as an input, so re-running the exact
    // same chain — the only chain there is — yields the identical result.
    expect(derivePlaceReservationDateWindow(jp019, visitDate)).toEqual(window);
    expect(evaluateReservationWindowReference(window, REFERENCE_DATE)).toEqual(relation);
  });

  it("setting, changing or clearing endDate changes NO evaluator output anywhere", () => {
    const bases = [null, END_DATE, "2027-02-19", "2030-01-01", "2020-01-01"];
    const signatures = bases.map((endDate) => {
      const source = withEndDate(WITHOUT_BOUND, endDate);
      const assignment = assignmentFor(source);
      return JSON.stringify(
        DAY_MATRIX.map((_ids, ordinal) => {
          const places = placesOfDay(ordinal);
          const dayDate = addCivilDays(source.startDate!, ordinal);
          return {
            visitDates: source.routeIds.map((id) => deriveVisitDateForPlace(assignment, source.startDate, id)),
            weekday: buildDayWeekdaySignal(places, dayDate),
            hours: buildPresentableDayHoursClosureCompositions(places, assignment, source.startDate),
            fits: buildDayRecordedIntervalFits(places, assignment, source.startDate, source.visitStartTimes),
          };
        })
      );
    });
    expect(new Set(signatures).size).toBe(1);
  });

  it("changing the START date DOES move every derived date — proving the comparison is not vacuous", () => {
    const shifted = withStartDate(WITHOUT_BOUND, "2027-06-01");
    const placeId = ROUTE_IDS[OUT_OF_BOUNDS_ORDINAL];
    expect(deriveVisitDateForPlace(assignmentFor(shifted), shifted.startDate, placeId)).not.toBe(
      deriveVisitDateForPlace(assignmentFor(WITHOUT_BOUND), WITHOUT_BOUND.startDate, placeId)
    );
  });
});

describe("no existing pure evaluator took endDate as an input (source scan)", () => {
  const AUDITED_MODULES = [
    "reservation-deadline.ts",
    "reservation-window-reference.ts",
    "day-weekday-signal.ts",
    "hours-closure-composition.ts",
    "recorded-interval-fit.ts",
    "day-assignment.ts",
    "temporal-availability.ts",
  ];

  it.each(AUDITED_MODULES)("%s never references endDate, trip bounds or an assessment", async (moduleName) => {
    const source = await readFile(new URL(`./${moduleName}`, import.meta.url), "utf8");
    for (const forbidden of ["endDate", "tripCalendarDays", "trip-bounds", "assessTripBounds", "after-trip-end"]) {
      expect(source, `${moduleName} / ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("`after-trip-end` never became a DayAssignmentIssue", async () => {
    const source = await readFile(new URL("./day-assignment.ts", import.meta.url), "utf8");
    expect(source).not.toContain("after-trip-end");
    expect(source).not.toContain("out-of-bounds");
  });
});
