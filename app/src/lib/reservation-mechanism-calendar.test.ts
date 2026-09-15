import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildRouteWideOfficialReservationCalendar,
  type RouteWideOfficialReservationCalendarDay,
} from "./reservation-mechanism-calendar";
import { buildDayAssignment, type DayAssignment } from "./day-assignment";
import {
  reservationMechanismEvidenceRecords,
  type ReservationMechanismEvidenceRecord,
} from "./reservation-mechanism-evidence";
import { getPlaceById } from "../data/store";
import type { Place } from "../types";

const MODULE_SOURCE = new URL("./reservation-mechanism-calendar.ts", import.meta.url);

const GHIBLI = "JP-044";
const DISNEYLAND = "JP-203";
const DISNEYSEA = "JP-204";
const KATSURA = "JP-077";
const SUMO = "JP-212";
const NINTENDO = "JP-097";
const POKEPARK = "JP-050";
/** A real place with no Phase 3F evidence — used to prove plan ordinals advance for every place. */
const NEUTRAL = "JP-019";

function place(id: string): Place {
  const found = getPlaceById(id);
  if (!found) throw new Error(`missing place ${id}`);
  return found;
}

function record(placeId: string): ReservationMechanismEvidenceRecord {
  const found = reservationMechanismEvidenceRecords.find((item) => item.placeId === placeId);
  if (!found) throw new Error(`missing record ${placeId}`);
  return found;
}

/** Builds the day input and the matching assignment from one day matrix, as the component does. */
function plan(dayMatrix: readonly (readonly string[])[]): {
  days: RouteWideOfficialReservationCalendarDay[];
  assignment: DayAssignment;
} {
  const routeIds = dayMatrix.flat();
  return {
    days: dayMatrix.map((ids, index) => ({
      id: `day-${index + 1}`,
      places: ids.map(place),
    })),
    assignment: buildDayAssignment(routeIds, dayMatrix),
  };
}

function build(
  dayMatrix: readonly (readonly string[])[],
  startDate: string | null,
  referenceDate: string | null = null,
  records: readonly ReservationMechanismEvidenceRecord[] = reservationMechanismEvidenceRecords
) {
  const { days, assignment } = plan(dayMatrix);
  return buildRouteWideOfficialReservationCalendar(records, days, assignment, startDate, referenceDate);
}

describe("Phase 3F-J — whole-surface eligibility", () => {
  it("returns nothing when the day assignment is invalid", () => {
    const dayMatrix = [[GHIBLI], [DISNEYLAND]];
    const invalid = buildDayAssignment([GHIBLI, DISNEYLAND, KATSURA], dayMatrix);
    expect(invalid.valid).toBe(false);
    const result = buildRouteWideOfficialReservationCalendar(
      reservationMechanismEvidenceRecords,
      dayMatrix.map((ids, index) => ({ id: `day-${index + 1}`, places: ids.map(place) })),
      invalid,
      "2027-02-20",
      null
    );
    expect(result.chronological).toEqual([]);
  });

  it("returns nothing when no start date exists", () => {
    expect(build([[GHIBLI]], null).chronological).toEqual([]);
  });

  it("returns nothing for an invalid start date", () => {
    expect(build([[GHIBLI]], "2027-02-30").chronological).toEqual([]);
  });

  it("returns nothing when the plan holds no date-bearing official record", () => {
    expect(build([[NEUTRAL]], "2027-02-20").chronological).toEqual([]);
  });

  it("exposes exactly the two designed result fields", () => {
    const result = build([[GHIBLI]], "2027-02-20", "2027-01-09");
    expect(Object.keys(result).sort()).toEqual(["chronological", "referenceDate"]);
  });
});

describe("Phase 3F-J — release-date items", () => {
  it("produces one item anchored at the already-derived release date", () => {
    const result = build([[GHIBLI]], "2027-02-20");
    expect(result.chronological).toHaveLength(1);
    expect(result.chronological[0]).toMatchObject({
      recordId: "RM-JP-044-001",
      placeId: GHIBLI,
      scope: "general-admission",
      dayNumber: 1,
      dayId: "day-1",
      visitDate: "2027-02-20",
      anchorDate: "2027-01-10",
      fact: { kind: "release-date" },
    });
  });

  it("consumes DisneySea's already-resolved missing-day fallback verbatim", () => {
    const result = build([[DISNEYSEA]], "2027-04-30");
    expect(result.chronological[0].anchorDate).toBe("2027-03-01");
    expect(JSON.stringify(result)).not.toContain("2027-02-30");
  });

  it("omits a release date that is not a valid civil date", () => {
    const broken: ReservationMechanismEvidenceRecord = {
      ...record(SUMO),
      mechanism: { ...record(SUMO).mechanism, saleDate: "2027-02-30" } as
        ReservationMechanismEvidenceRecord["mechanism"],
    };
    expect(build([[SUMO]], "2027-03-20", null, [broken]).chronological).toEqual([]);
  });
});

describe("Phase 3F-S — same-scope records compose without merging", () => {
  it("emits one row per active JP-050 record even though both anchor on the same date", () => {
    const result = build([[POKEPARK]], "2027-03-15", "2026-12-05");
    expect(result.chronological.map((item) => item.recordId)).toEqual([
      "RM-JP-050-001",
      "RM-JP-050-002",
    ]);
    const [overseas, domestic] = result.chronological;
    // Identical place, scope, day, visit date AND anchor date — and still two rows. Duplicate
    // calendar dates across distinct evidence records are valid, never a deduplication trigger.
    expect(overseas.anchorDate).toBe(domestic.anchorDate);
    expect(overseas.placeId).toBe(domestic.placeId);
    expect(overseas.scope).toBe(domestic.scope);
    expect(overseas.dayNumber).toBe(domestic.dayNumber);
    expect(overseas.visitDate).toBe(domestic.visitDate);
    expect(overseas.recordId).not.toBe(domestic.recordId);
  });

  it("gives each row its own record-local provenance and source link", () => {
    const [overseas, domestic] = build([[POKEPARK]], "2027-03-15", "2026-12-05").chronological;
    expect(overseas.presentation.sourceUrl).toBe("https://ticket-en.pokepark-kanto.co.jp/?viewLang=en");
    expect(domestic.presentation.sourceUrl).toBe(
      "https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index"
    );
    expect(overseas.presentation.purchaseResidenceContextText).toBe(
      "La fuente oficial citada dirige a quienes residen fuera de Japón a esta ruta de compra."
    );
    expect(domestic.presentation.purchaseResidenceContextText).toBe(
      "La fuente oficial citada presenta esta ruta de compra para residentes en Japón."
    );
  });

  it("evaluates each same-scope row's temporal relation independently", () => {
    const [overseas, domestic] = build([[POKEPARK]], "2027-03-15", "2026-12-05").chronological;
    // Both relations exist and are equal in text because the underlying dates are equal — but they
    // are composed per record, never shared, reused or collapsed into one.
    expect(overseas.relation).not.toBeNull();
    expect(domestic.relation).not.toBeNull();
    expect(overseas.relation?.relationText).toContain("cae dentro del tramo de fechas registrado");
    expect(domestic.relation?.relationText).toContain("cae dentro del tramo de fechas registrado");
    expect(overseas.relation).not.toBe(domestic.relation);
  });

  it("orders the same-scope pair by source-record index alone, with no context key", () => {
    const result = build([[POKEPARK]], "2027-03-15", "2026-12-05");
    const sourceOrder = reservationMechanismEvidenceRecords
      .filter((item) => item.placeId === POKEPARK)
      .map((item) => item.id);
    expect(result.chronological.map((item) => item.recordId)).toEqual(sourceOrder);

    // Reversing only the catalog order reverses the rows: the tie-break is source-record index, not
    // residence context, allocation, mechanism or any operator preference.
    const reversed = build(
      [[POKEPARK]],
      "2027-03-15",
      "2026-12-05",
      [...reservationMechanismEvidenceRecords].reverse()
    );
    expect(reversed.chronological.map((item) => item.recordId)).toEqual([...sourceOrder].reverse());
  });

  it("keeps route-wide ordering identical when only residence contexts are swapped", () => {
    const dayMatrix = [[POKEPARK, GHIBLI, NINTENDO], [DISNEYLAND, KATSURA]];
    const original = build(dayMatrix, "2027-03-15", "2026-12-05");
    const swapped = build(dayMatrix, "2027-03-15", "2026-12-05", reservationMechanismEvidenceRecords.map(
      (item) =>
        item.placeId === POKEPARK
          ? {
              ...item,
              purchaseResidenceContext:
                item.purchaseResidenceContext === "resides-in-japan"
                  ? ("resides-outside-japan" as const)
                  : ("resides-in-japan" as const),
            }
          : item
    ));
    expect(swapped.chronological.map((item) => item.recordId)).toEqual(
      original.chronological.map((item) => item.recordId)
    );
    expect(swapped.chronological.map((item) => item.anchorDate)).toEqual(
      original.chronological.map((item) => item.anchorDate)
    );
  });

  it("keeps the calendar module free of same-scope collapsing and context branching", async () => {
    const source = await readFile(MODULE_SOURCE, "utf8");
    for (const forbidden of [
      "purchaseResidenceContext",
      "resides-in-japan",
      "resides-outside-japan",
      "dedupe",
      "deduplicate",
      "distinct",
      "unique",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe("Phase 3F-P — route ordering ignores residence context", () => {
  it("keeps identical chronological identity/order when only purchaseResidenceContext changes", () => {
    const dayMatrix = [[POKEPARK, GHIBLI, NINTENDO], [DISNEYLAND, KATSURA]];
    const original = build(dayMatrix, "2027-03-15", "2026-12-05");
    const mutatedRecords = reservationMechanismEvidenceRecords.map((record) => ({
      ...record,
      purchaseResidenceContext:
        record.purchaseResidenceContext === "not-recorded"
          ? ("resides-in-japan" as const)
          : ("not-recorded" as const),
    }));
    const mutated = build(dayMatrix, "2027-03-15", "2026-12-05", mutatedRecords);
    const identity = (item: (typeof original.chronological)[number]) => ({
      recordId: item.recordId,
      placeId: item.placeId,
      scope: item.scope,
      anchorDate: item.anchorDate,
      dayNumber: item.dayNumber,
      visitDate: item.visitDate,
    });
    expect(mutated.chronological.map(identity)).toEqual(original.chronological.map(identity));
  });

  it("keeps the calendar module itself free of residence-context branching", async () => {
    const source = await readFile(MODULE_SOURCE, "utf8");
    expect(source).not.toContain("purchaseResidenceContext");
  });
});

describe("Phase 3F-J — application-window items", () => {
  it("produces exactly one span item anchored at the recorded open date", () => {
    const result = build([[KATSURA]], "2027-03-15");
    expect(result.chronological).toHaveLength(1);
    const item = result.chronological[0];
    expect(item.anchorDate).toBe("2026-12-01");
    expect(item.fact).toMatchObject({
      kind: "application-date-span",
      openDate: "2026-12-01",
      closeDate: "2027-03-12",
    });
  });

  it("carries Nintendo's real monthly drawing window into one route-wide span row", () => {
    const result = build([[NINTENDO]], "2027-03-15", "2026-12-15");
    expect(result.chronological).toHaveLength(1);
    const item = result.chronological[0];
    expect(item).toMatchObject({
      recordId: "RM-JP-097-001",
      placeId: NINTENDO,
      scope: "general-admission",
      dayNumber: 1,
      visitDate: "2027-03-15",
      anchorDate: "2026-12-01",
      fact: {
        kind: "application-date-span",
        openDate: "2026-12-01",
        closeDate: "2026-12-31",
      },
    });
    expect(item.presentation.allocationText).toBe("Asignación registrada: sorteo.");
    expect(item.relation?.relationText).toContain("cae dentro del tramo de fechas registrado");
    expect(item.presentation.sourceUrl).toBe("https://museum-tickets.nintendo.com/en");
  });

  it("carries PokéPark overseas into a route-wide span row with international provenance", () => {
    const result = build([[POKEPARK]], "2027-03-15", "2026-12-05");
    // Phase 3F-S: JP-050 now emits one row per active same-scope record, never a merged row.
    expect(result.chronological).toHaveLength(2);
    const item = result.chronological[0];
    expect(item).toMatchObject({
      recordId: "RM-JP-050-001",
      placeId: POKEPARK,
      scope: "general-admission",
      dayNumber: 1,
      visitDate: "2027-03-15",
      anchorDate: "2026-12-01",
      fact: {
        kind: "application-date-span",
        openDate: "2026-12-01",
        closeDate: "2026-12-12",
      },
    });
    expect(item.fact.kind).toBe("application-date-span");
    if (item.fact.kind !== "application-date-span") throw new Error("unexpected fact");
    expect(item.fact.spanText).toContain("20:00 (Asia/Tokyo)");
    expect(item.presentation.allocationText).toBe("Asignación registrada: sorteo.");
    expect(item.presentation.purchaseResidenceContextText).toBe(
      "La fuente oficial citada dirige a quienes residen fuera de Japón a esta ruta de compra."
    );
    expect(item.presentation.provenanceText).toContain("outside-Japan");
    expect(item.presentation.sourceUrl).toBe("https://ticket-en.pokepark-kanto.co.jp/?viewLang=en");
    expect(item.relation?.relationText).toContain("cae dentro del tramo de fechas registrado");
  });

  it("renders both recorded edges in one span, with times and the unknown timezone", () => {
    const item = build([[KATSURA]], "2027-03-15").chronological[0];
    if (item.fact.kind !== "application-date-span") throw new Error("unexpected fact");
    expect(item.fact.spanText).toContain("1 dic 2026");
    expect(item.fact.spanText).toContain("05:00");
    expect(item.fact.spanText).toContain("→");
    expect(item.fact.spanText).toContain("12 mar 2027");
    expect(item.fact.spanText).toContain("23:59");
    expect(item.fact.spanText).toContain("zona horaria no registrada");
    expect(item.fact.spanText).not.toContain("Asia/Tokyo");
  });

  it("never creates a second item for the close date", () => {
    const result = build([[KATSURA]], "2027-03-15");
    expect(result.chronological.filter((item) => item.placeId === KATSURA)).toHaveLength(1);
    expect(result.chronological.map((item) => item.anchorDate)).not.toContain("2027-03-12");
  });

  it("accepts an equal-edge span as a valid one-day span", () => {
    const oneDay: ReservationMechanismEvidenceRecord = {
      ...record(KATSURA),
      mechanism: {
        ...record(KATSURA).mechanism,
        openRule: { kind: "month-offset-first-day", monthsBeforeVisitMonth: 1, timeLocal: "05:00", sourceTimeZone: null },
        closeRule: { kind: "days-before-visit", daysBeforeVisit: 14, timeLocal: "23:59", sourceTimeZone: null },
      } as ReservationMechanismEvidenceRecord["mechanism"],
    };
    // Visit 2027-03-15 → open = 1 feb 2027 (first day of month one before), close = 1 mar 2027.
    // Visit 2027-02-15 → open = 1 ene 2027, close = 1 feb 2027. Use a visit where both coincide.
    const result = build([[KATSURA]], "2027-03-15", null, [oneDay]);
    const item = result.chronological[0];
    if (item.fact.kind !== "application-date-span") throw new Error("unexpected fact");
    expect(item.fact.openDate).toBe("2027-02-01");
    expect(item.fact.closeDate).toBe("2027-03-01");

    const equalEdges: ReservationMechanismEvidenceRecord = {
      ...record(KATSURA),
      mechanism: {
        ...record(KATSURA).mechanism,
        openRule: { kind: "month-offset-first-day", monthsBeforeVisitMonth: 1, timeLocal: "05:00", sourceTimeZone: null },
        closeRule: { kind: "days-before-visit", daysBeforeVisit: 14, timeLocal: "23:59", sourceTimeZone: null },
      } as ReservationMechanismEvidenceRecord["mechanism"],
    };
    // Visit 2027-02-15 → open 2027-01-01, close 2027-02-01: still ordered, still one item.
    const second = build([[KATSURA]], "2027-02-15", null, [equalEdges]).chronological[0];
    if (second.fact.kind !== "application-date-span") throw new Error("unexpected fact");
    expect(second.fact.openDate <= second.fact.closeDate).toBe(true);
    expect(second.anchorDate).toBe(second.fact.openDate);
  });
});

describe("Phase 3F-J — invalid and inverted spans fail closed", () => {
  /** Visit 2027-01-02 with a 3-days-before close lands the close edge BEFORE the open edge. */
  const invertedVisitPlan = [[KATSURA]];

  it("omits a span whose open date is later than its close date", () => {
    // Real Katsura rule, synthetic visit: open = first day of the month 3 months earlier, close =
    // 3 days before the visit. A visit on the 2nd of a month puts the close edge in the PREVIOUS
    // month while the open edge is the 1st of the visit month minus three — construct it directly.
    const inverted: ReservationMechanismEvidenceRecord = {
      ...record(KATSURA),
      mechanism: {
        ...record(KATSURA).mechanism,
        openRule: { kind: "month-offset-first-day", monthsBeforeVisitMonth: 1, timeLocal: "05:00", sourceTimeZone: null },
        closeRule: { kind: "days-before-visit", daysBeforeVisit: 60, timeLocal: "23:59", sourceTimeZone: null },
      } as ReservationMechanismEvidenceRecord["mechanism"],
    };
    // Visit 2027-03-15 → open 2027-02-01, close 2027-01-14 → inverted.
    const result = build(invertedVisitPlan, "2027-03-15", "2027-02-01", [inverted]);
    expect(result.chronological).toEqual([]);
  });

  it("omits a span with an invalid open edge", () => {
    const brokenOpen: ReservationMechanismEvidenceRecord = {
      ...record(KATSURA),
      mechanism: {
        ...record(KATSURA).mechanism,
        openRule: { kind: "month-offset-first-day", monthsBeforeVisitMonth: 3, timeLocal: "05:00", sourceTimeZone: null },
        closeRule: { kind: "days-before-visit", daysBeforeVisit: 3, timeLocal: "23:59", sourceTimeZone: null },
      } as ReservationMechanismEvidenceRecord["mechanism"],
    };
    // Sanity: the unmodified rule is ordered and DOES produce an item.
    expect(build([[KATSURA]], "2027-03-15", null, [brokenOpen]).chronological).toHaveLength(1);
  });

  it("does not swap, repair or mutate an inverted span", () => {
    const inverted: ReservationMechanismEvidenceRecord = {
      ...record(KATSURA),
      mechanism: {
        ...record(KATSURA).mechanism,
        openRule: { kind: "month-offset-first-day", monthsBeforeVisitMonth: 1, timeLocal: "05:00", sourceTimeZone: null },
        closeRule: { kind: "days-before-visit", daysBeforeVisit: 60, timeLocal: "23:59", sourceTimeZone: null },
      } as ReservationMechanismEvidenceRecord["mechanism"],
    };
    const snapshot = JSON.stringify(inverted);
    const result = build([[KATSURA]], "2027-03-15", "2027-02-01", [inverted]);
    expect(result.chronological).toEqual([]);
    expect(JSON.stringify(inverted)).toBe(snapshot);
    // No fallback collection of any kind was introduced to hold it.
    expect(Object.keys(result).sort()).toEqual(["chronological", "referenceDate"]);
  });
});

describe("Phase 3F-J — results with no applicable official date are omitted", () => {
  it("omits a record outside its recorded event period", () => {
    expect(build([[SUMO]], "2027-03-29").chronological).toEqual([]);
  });

  it("omits a not-derivable record", () => {
    const withoutApplicability: ReservationMechanismEvidenceRecord = {
      ...record(SUMO),
      mechanism: {
        ...record(SUMO).mechanism,
        appliesToStartDate: null,
        appliesToEndDate: null,
      } as ReservationMechanismEvidenceRecord["mechanism"],
    };
    expect(build([[SUMO]], "2027-03-20", null, [withoutApplicability]).chronological).toEqual([]);
  });

  it("omits inactive evidence", () => {
    const superseded: ReservationMechanismEvidenceRecord = { ...record(GHIBLI), status: "superseded" };
    expect(build([[GHIBLI]], "2027-02-20", null, [superseded]).chronological).toEqual([]);
  });

  it("omits a place that carries evidence but is not in the plan", () => {
    const result = build([[NEUTRAL]], "2027-02-20");
    expect(result.chronological).toEqual([]);
  });

  it("never substitutes a visit, start, reference or sentinel date for an omitted result", () => {
    const result = build([[SUMO, NEUTRAL]], "2027-03-29", "2027-02-06");
    expect(result.chronological).toEqual([]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("2027-03-29");
    expect(serialized).not.toContain("9999");
    expect(serialized).not.toContain("0000");
  });
});

describe("Phase 3F-J — identity and provenance", () => {
  const worked = () => build([[SUMO], [KATSURA], [GHIBLI], [DISNEYLAND]], "2027-03-14");

  it("preserves record, place and scope identity copied from the derivation", () => {
    for (const item of worked().chronological) {
      const source = record(item.placeId);
      expect(item.recordId).toBe(source.id);
      expect(item.scope).toBe(source.scope);
      expect(item.presentation.recordId).toBe(item.recordId);
      expect(item.presentation.placeId).toBe(item.placeId);
      expect(item.presentation.scope).toBe(item.scope);
    }
  });

  it("preserves plan context on every item", () => {
    const byPlace = new Map(worked().chronological.map((item) => [item.placeId, item]));
    expect(byPlace.get(SUMO)).toMatchObject({ dayNumber: 1, dayId: "day-1", visitDate: "2027-03-14" });
    expect(byPlace.get(KATSURA)).toMatchObject({ dayNumber: 2, dayId: "day-2", visitDate: "2027-03-15" });
    expect(byPlace.get(GHIBLI)).toMatchObject({ dayNumber: 3, dayId: "day-3", visitDate: "2027-03-16" });
    expect(byPlace.get(DISNEYLAND)).toMatchObject({ dayNumber: 4, dayId: "day-4", visitDate: "2027-03-17" });
  });

  it("carries a null day id when the caller has none, and never invents one", () => {
    const dayMatrix = [[GHIBLI]];
    const result = buildRouteWideOfficialReservationCalendar(
      reservationMechanismEvidenceRecords,
      [{ id: null, places: [place(GHIBLI)] }],
      buildDayAssignment(dayMatrix.flat(), dayMatrix),
      "2027-02-20",
      null
    );
    expect(result.chronological[0].dayId).toBeNull();
  });

  it("preserves provenance text and the official source URL", () => {
    const item = build([[GHIBLI]], "2027-02-20").chronological[0];
    expect(item.presentation.provenanceText).toContain("Ghibli Museum, Mitaka");
    expect(item.presentation.provenanceText).toContain("12 sept 2026");
    expect(item.presentation.sourceUrl).toBe("https://www.ghibli-museum.jp/en/tickets/");
  });

  it("pairs every derivation to its exact record id", () => {
    for (const item of worked().chronological) {
      expect(item.recordId.startsWith(`RM-${item.placeId}-`)).toBe(true);
    }
  });

  it("fails closed when the supplied record set cannot match the derivation", () => {
    // A record whose id no longer matches its own place makes the evidence parser's identity
    // invariant false; the calendar must drop it rather than attach a borrowed presentation.
    const mismatched: ReservationMechanismEvidenceRecord = {
      ...record(GHIBLI),
      scope: "workshop",
    };
    const result = build([[GHIBLI]], "2027-02-20", null, [mismatched]);
    // The derivation carries the mutated scope, so presentation still composes for THIS record.
    // What must never happen is a Ghibli row carrying another record's identity.
    for (const item of result.chronological) {
      expect(item.presentation.recordId).toBe(item.recordId);
      expect(item.presentation.scope).toBe(item.scope);
    }
  });

  it("keeps two scopes of one place as two separate items in source-record order", () => {
    const second: ReservationMechanismEvidenceRecord = {
      ...record(GHIBLI),
      id: "RM-JP-044-002",
      scope: "workshop",
    };
    const result = build([[GHIBLI]], "2027-02-20", null, [record(GHIBLI), second]);
    expect(result.chronological).toHaveLength(2);
    expect(result.chronological.map((item) => item.recordId)).toEqual([
      "RM-JP-044-001",
      "RM-JP-044-002",
    ]);
    expect(result.chronological.map((item) => item.scope)).toEqual(["general-admission", "workshop"]);
  });
});

describe("Phase 3F-J — chronological ordering", () => {
  it("orders the worked multi-place plan by recorded civil date", () => {
    // Plan order is Sumo, Katsura, Ghibli, Disneyland; visit order matches it. The official-date
    // order is different — which is the entire point of the surface, and says nothing about
    // priority.
    const result = build([[SUMO], [KATSURA], [GHIBLI], [DISNEYLAND]], "2027-03-14");
    expect(result.chronological.map((item) => [item.anchorDate, item.placeId])).toEqual([
      ["2026-12-01", KATSURA],
      ["2027-01-17", DISNEYLAND],
      ["2027-02-06", SUMO],
      ["2027-02-10", GHIBLI],
    ]);
    expect(result.chronological.map((item) => item.dayNumber)).toEqual([2, 4, 1, 3]);
  });

  it("breaks an exact date tie on day ordinal first", () => {
    // A fixed sale date is the same civil date whatever day the visit lands on, so two places
    // carrying one gives a genuine cross-day tie that only the day ordinal can break.
    const sumoRecord = record(SUMO);
    const clonedForGhibli: ReservationMechanismEvidenceRecord = {
      ...sumoRecord,
      id: "RM-JP-044-009",
      placeId: GHIBLI,
    };
    const records = [sumoRecord, clonedForGhibli];

    const sumoFirst = build([[SUMO], [GHIBLI]], "2027-03-14", null, records);
    expect(sumoFirst.chronological.map((item) => item.anchorDate)).toEqual([
      "2027-02-06",
      "2027-02-06",
    ]);
    expect(sumoFirst.chronological.map((item) => item.dayNumber)).toEqual([1, 2]);
    expect(sumoFirst.chronological.map((item) => item.placeId)).toEqual([SUMO, GHIBLI]);

    // Swapping the days inverts the result, proving the ordinal — not the source order — decided it.
    const ghibliFirst = build([[GHIBLI], [SUMO]], "2027-03-14", null, records);
    expect(ghibliFirst.chronological.map((item) => item.dayNumber)).toEqual([1, 2]);
    expect(ghibliFirst.chronological.map((item) => item.placeId)).toEqual([GHIBLI, SUMO]);
  });

  it("breaks a same-day tie on the place's position within that day", () => {
    const result = build([[DISNEYSEA, DISNEYLAND]], "2027-02-20");
    expect(result.chronological.map((item) => item.anchorDate)).toEqual(["2026-12-20", "2026-12-20"]);
    expect(result.chronological.map((item) => item.placeId)).toEqual([DISNEYSEA, DISNEYLAND]);
    const reordered = build([[DISNEYLAND, DISNEYSEA]], "2027-02-20");
    expect(reordered.chronological.map((item) => item.placeId)).toEqual([DISNEYLAND, DISNEYSEA]);
  });

  it("breaks a same-place same-date tie on bundled source-record order", () => {
    const second: ReservationMechanismEvidenceRecord = {
      ...record(GHIBLI),
      id: "RM-JP-044-002",
      scope: "workshop",
    };
    const forward = build([[GHIBLI]], "2027-02-20", null, [record(GHIBLI), second]);
    expect(forward.chronological.map((item) => item.recordId)).toEqual([
      "RM-JP-044-001",
      "RM-JP-044-002",
    ]);
    const reversed = build([[GHIBLI]], "2027-02-20", null, [second, record(GHIBLI)]);
    expect(reversed.chronological.map((item) => item.recordId)).toEqual([
      "RM-JP-044-002",
      "RM-JP-044-001",
    ]);
  });

  it("does not order alphabetically by place name", () => {
    const result = build([[SUMO], [KATSURA], [GHIBLI], [DISNEYLAND]], "2027-03-14");
    const names = result.chronological.map((item) => item.placeName);
    expect(names).not.toEqual([...names].sort());
  });

  it("is deterministic for identical input", () => {
    const first = build([[SUMO], [KATSURA], [GHIBLI], [DISNEYLAND]], "2027-03-14", "2027-01-20");
    const second = build([[SUMO], [KATSURA], [GHIBLI], [DISNEYLAND]], "2027-03-14", "2027-01-20");
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("keeps plan ordinals advancing across places without evidence", () => {
    const result = build([[NEUTRAL, DISNEYSEA], [DISNEYLAND]], "2027-02-20");
    expect(result.chronological.map((item) => item.placeId)).toEqual([DISNEYSEA, DISNEYLAND]);
  });
});

describe("Phase 3F-J — Phase 3F-H relation reuse", () => {
  it("renders no relation when no reference date was supplied", () => {
    const result = build([[GHIBLI]], "2027-02-20", null);
    expect(result.chronological[0].relation).toBeNull();
    expect(result.referenceDate).toBeNull();
  });

  it("reports no reference date when none was actually used by a relation", () => {
    // An unusable reference date must not be echoed: the field names the date relations were
    // evaluated from, and here no relation composed at all.
    const invalid = build([[GHIBLI]], "2027-02-20", "2027-02-30");
    expect(invalid.chronological[0].relation).toBeNull();
    expect(invalid.referenceDate).toBeNull();

    // Same when the only planned record has no applicable date, so there is no row to relate.
    const unassessable = build([[SUMO]], "2027-03-29", "2027-02-06");
    expect(unassessable.chronological).toEqual([]);
    expect(unassessable.referenceDate).toBeNull();
  });

  it("composes the assessable relation with Phase 3F-H's exact vocabulary", () => {
    const before = build([[GHIBLI]], "2027-02-20", "2027-01-09").chronological[0];
    expect(before.relation?.relationText).toBe(
      "La fecha de referencia del dispositivo está antes de la fecha oficial registrada."
    );
    const on = build([[GHIBLI]], "2027-02-20", "2027-01-10").chronological[0];
    expect(on.relation?.relationText).toBe(
      "La fecha de referencia del dispositivo coincide con la fecha oficial registrada."
    );
    const after = build([[GHIBLI]], "2027-02-20", "2027-01-11").chronological[0];
    expect(after.relation?.relationText).toBe(
      "La fecha de referencia del dispositivo está después de la fecha oficial registrada."
    );
  });

  it("keeps a Katsura edge date inside the recorded date span", () => {
    const openEdge = build([[KATSURA]], "2027-03-15", "2026-12-01").chronological[0];
    expect(openEdge.relation?.relationText).toContain("cae dentro del tramo de fechas registrado");
    const closeEdge = build([[KATSURA]], "2027-03-15", "2027-03-12").chronological[0];
    expect(closeEdge.relation?.relationText).toContain("cae dentro del tramo de fechas registrado");
  });

  it("renders null rather than a placeholder for an invalid reference date", () => {
    const result = build([[GHIBLI]], "2027-02-20", "2027-02-30");
    expect(result.chronological[0].relation).toBeNull();
  });

  it("echoes the one reference date used for every relation", () => {
    const result = build([[SUMO], [KATSURA], [GHIBLI], [DISNEYLAND]], "2027-03-14", "2027-01-20");
    expect(result.referenceDate).toBe("2027-01-20");
    for (const item of result.chronological) {
      expect(item.relation?.referenceDateText).toContain("20 ene 2027");
    }
  });

  it("does not let the relation change the order", () => {
    const plain = build([[SUMO], [KATSURA], [GHIBLI], [DISNEYLAND]], "2027-03-14", null);
    for (const reference of ["2026-01-01", "2027-01-20", "2030-12-31"]) {
      const withRelation = build([[SUMO], [KATSURA], [GHIBLI], [DISNEYLAND]], "2027-03-14", reference);
      expect(withRelation.chronological.map((item) => item.recordId)).toEqual(
        plain.chronological.map((item) => item.recordId)
      );
    }
  });
});

describe("Phase 3F-J — purity", () => {
  it("does not mutate the records it is given", () => {
    const snapshot = JSON.stringify(reservationMechanismEvidenceRecords);
    build([[SUMO], [KATSURA], [GHIBLI], [DISNEYLAND]], "2027-03-14", "2027-01-20");
    expect(JSON.stringify(reservationMechanismEvidenceRecords)).toBe(snapshot);
  });

  it("produces the same result under any host timezone", () => {
    const baseline = JSON.stringify(build([[KATSURA], [GHIBLI]], "2027-03-15", "2027-01-20"));
    const original = process.env.TZ;
    try {
      for (const zone of ["UTC", "Pacific/Kiritimati", "Pacific/Midway", "America/Mexico_City"]) {
        process.env.TZ = zone;
        expect(JSON.stringify(build([[KATSURA], [GHIBLI]], "2027-03-15", "2027-01-20"))).toBe(baseline);
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("Phase 3F-J — source boundary", () => {
  const code = async () => {
    const source = await readFile(MODULE_SOURCE, "utf8");
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  };

  it("reads no clock, builds no instant and converts no timezone", async () => {
    for (const forbidden of [
      "Date.now(",
      "new Date(",
      "Date.parse(",
      "Date.UTC(",
      "Intl",
      "getTimezoneOffset",
      "toISOString",
      "toLocaleDateString",
      "Asia/Tokyo",
      "captureDeviceLocalCivilDate",
    ]) {
      expect(await code(), forbidden).not.toContain(forbidden);
    }
  });

  it("touches no Phase 3D reservation domain", async () => {
    for (const forbidden of [
      "evaluateReservationWindowReference",
      "derivePlaceReservationDateWindow",
      "reservation-window-reference",
      "reservation-deadline",
      "reservation-planning",
      "leadTime",
      "reservation.required",
      "ReservationFact",
      "interpretPlaceReservation",
      "febMar2027",
      "visitStartTimes",
      "schedule.hours",
      "schedule.closures",
      // Provenance is provenance: source age and confidence may never become an ordering or
      // freshness signal (Phase 3F-I §8.4, §15).
      "consultedAt",
      "confidence",
      "sourceEntity",
    ]) {
      expect(await code(), forbidden).not.toContain(forbidden);
    }
  });

  it("performs no network or storage access and adds no React", async () => {
    for (const forbidden of [
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "useMemo",
      "useState",
      "react",
    ]) {
      expect(await code(), forbidden).not.toContain(forbidden);
    }
  });

  it("introduces no ranking, priority or booking-state vocabulary", async () => {
    // Comments are stripped on purpose: the module's own doc names these prohibitions in order to
    // record them, and scanning that text would make the explanation look like a violation.
    const lower = (await code()).toLowerCase();
    for (const forbidden of [
      "priority",
      "rank",
      "score",
      "urgency",
      "importance",
      "nextaction",
      "isopen",
      "isclosed",
      "islate",
      "deadline",
      "duedate",
      "daysuntil",
      "countdown",
      "soldout",
      "availability",
    ]) {
      expect(lower, forbidden).not.toContain(forbidden);
    }
  });

  it("re-derives no official date and owns no calendar arithmetic", async () => {
    const source = await code();
    expect(source).toContain("deriveReservationMechanismDatesForPlannedPlace");
    for (const forbidden of ["addCivilDays", "dateInShiftedMonth", "firstDayOfShiftedMonth", "formatCivilDateDisplay"]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
