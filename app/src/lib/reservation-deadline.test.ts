import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import placesData from "../data/places.json";
import type { Place } from "../types";
import { buildDayAssignment, type DayAssignment } from "./day-assignment";
import { interpretPlaceReservation } from "./reservation";
import {
  deriveReservationDateWindow,
  deriveVisitDateForPlace,
  derivePlaceReservationDateWindow,
  interpretPlaceReservationDeadlineSignal,
  interpretReservationDeadlineText,
  isReservationEligibleForDeadlineWindow,
  type ReservationDeadlineSignal,
} from "./reservation-deadline";

const places = placesData as Place[];

/**
 * Phase 3D-H — Explicit Lead-Time Window (Class A only). Domain tests for
 * `reservation-deadline.ts`, modeled on the existing Phase 3D-D/3D-E/3D-F test suites
 * (`reservation-lead-time.test.ts`, `recorded-hours.test.ts`, `feb-mar-status.test.ts`) per the
 * design gate's own test-strategy section (§14).
 */

describe("interpretReservationDeadlineText — not-applicable", () => {
  it("'—' classifies not-applicable", () => {
    expect(interpretReservationDeadlineText("—")).toEqual({ kind: "not-applicable", raw: "—" });
  });

  it("empty and null/undefined classify not-applicable, never throwing", () => {
    expect(interpretReservationDeadlineText("").kind).toBe("not-applicable");
    expect(interpretReservationDeadlineText(null).kind).toBe("not-applicable");
    expect(interpretReservationDeadlineText(undefined).kind).toBe("not-applicable");
  });
});

describe("interpretReservationDeadlineText — Class A: explicit numeric range + single day/week unit", () => {
  it("'1–2 semanas' → explicit-lead-window, 7–14 days", () => {
    const signal = interpretReservationDeadlineText("1–2 semanas");
    expect(signal).toEqual({ kind: "explicit-lead-window", minLeadDays: 7, maxLeadDays: 14, raw: "1–2 semanas" });
  });

  it("'2–4 semanas' → explicit-lead-window, 14–28 days", () => {
    const signal = interpretReservationDeadlineText("2–4 semanas");
    expect(signal).toEqual({ kind: "explicit-lead-window", minLeadDays: 14, maxLeadDays: 28, raw: "2–4 semanas" });
  });

  it("'2–6 semanas' → explicit-lead-window, 14–42 days", () => {
    const signal = interpretReservationDeadlineText("2–6 semanas");
    expect(signal).toEqual({ kind: "explicit-lead-window", minLeadDays: 14, maxLeadDays: 42, raw: "2–6 semanas" });
  });

  it("a plain hyphen range is accepted exactly like an en dash range", () => {
    const signal = interpretReservationDeadlineText("2-4 semanas");
    expect(signal).toEqual({ kind: "explicit-lead-window", minLeadDays: 14, maxLeadDays: 28, raw: "2-4 semanas" });
  });

  it("raw text is preserved verbatim, never replaced by the derived window", () => {
    const signal = interpretReservationDeadlineText("1–2 semanas");
    expect(signal.raw).toBe("1–2 semanas");
  });

  it("is deterministic across repeated calls", () => {
    const results = new Set(
      Array.from({ length: 5 }, () => JSON.stringify(interpretReservationDeadlineText("2–4 semanas")))
    );
    expect(results.size).toBe(1);
  });
});

describe("interpretReservationDeadlineText — days unit (synthetic, not present in current real data)", () => {
  // The current dataset contains no Class A 'X–Y días' record (confirmed by the design gate's own
  // audit), but the implementation must follow the designed unit-general contract rather than
  // accidentally becoming weeks-only. These fixtures are synthetic, not copied from `places.json`.
  it("'3–5 días' → explicit-lead-window, 3–5 days (1:1 conversion)", () => {
    const signal = interpretReservationDeadlineText("3–5 días");
    expect(signal).toEqual({ kind: "explicit-lead-window", minLeadDays: 3, maxLeadDays: 5, raw: "3–5 días" });
  });

  it("'1-1 día' (singular unit, degenerate single-day range) → explicit-lead-window, 1–1 days", () => {
    const signal = interpretReservationDeadlineText("1-1 día");
    expect(signal).toEqual({ kind: "explicit-lead-window", minLeadDays: 1, maxLeadDays: 1, raw: "1-1 día" });
  });

  it("'10–20 dias' (unaccented) is accepted exactly like the accented form", () => {
    const signal = interpretReservationDeadlineText("10–20 dias");
    expect(signal).toEqual({ kind: "explicit-lead-window", minLeadDays: 10, maxLeadDays: 20, raw: "10–20 dias" });
  });
});

describe("interpretReservationDeadlineText — Class B: unit only, no quantity", () => {
  it("'Semanas' → not-computable / unit-without-quantity", () => {
    expect(interpretReservationDeadlineText("Semanas")).toEqual({
      kind: "not-computable",
      reason: "unit-without-quantity",
      raw: "Semanas",
    });
  });

  it("'Días' → not-computable / unit-without-quantity", () => {
    expect(interpretReservationDeadlineText("Días")).toEqual({
      kind: "not-computable",
      reason: "unit-without-quantity",
      raw: "Días",
    });
  });
});

describe("interpretReservationDeadlineText — Class C: mixed coarse units, no quantity", () => {
  it("'Días/semanas' → not-computable / mixed-unit-without-quantity", () => {
    expect(interpretReservationDeadlineText("Días/semanas")).toEqual({
      kind: "not-computable",
      reason: "mixed-unit-without-quantity",
      raw: "Días/semanas",
    });
  });

  it("'Semanas/meses' → not-computable / mixed-unit-without-quantity (canonical pattern support, even if absent from today's data)", () => {
    expect(interpretReservationDeadlineText("Semanas/meses")).toEqual({
      kind: "not-computable",
      reason: "mixed-unit-without-quantity",
      raw: "Semanas/meses",
    });
  });
});

describe("interpretReservationDeadlineText — Class D: numeric month range", () => {
  it("'1–3 meses' → not-computable / month-range-not-supported — never a 30-day approximation", () => {
    expect(interpretReservationDeadlineText("1–3 meses")).toEqual({
      kind: "not-computable",
      reason: "month-range-not-supported",
      raw: "1–3 meses",
    });
  });

  it("bare 'Meses' also refuses computation — month semantics are refused entirely, not just the numeric-range shape", () => {
    const signal = interpretReservationDeadlineText("Meses");
    expect(signal.kind).toBe("not-computable");
    if (signal.kind === "not-computable") expect(signal.reason).toBe("month-range-not-supported");
  });
});

describe("interpretReservationDeadlineText — Class E / OPAQUE adversarial tests: never promoted to a numeric window", () => {
  it("'Lotería 3 meses antes; revisar liberaciones' → not-computable / specific-mechanism, never a window", () => {
    expect(interpretReservationDeadlineText("Lotería 3 meses antes; revisar liberaciones")).toEqual({
      kind: "not-computable",
      reason: "specific-mechanism",
      raw: "Lotería 3 meses antes; revisar liberaciones",
    });
  });

  it("'2–4 semanas; atardecer antes' stays specific-mechanism — the embedded numeric range is never extracted", () => {
    const signal = interpretReservationDeadlineText("2–4 semanas; atardecer antes");
    expect(signal.kind).toBe("not-computable");
    if (signal.kind === "not-computable") expect(signal.reason).toBe("specific-mechanism");
  });

  it("'Venta oficial desde 6 feb 2027' (a fixed calendar date, not a lead time) stays specific-mechanism", () => {
    expect(interpretReservationDeadlineText("Venta oficial desde 6 feb 2027").kind).toBe("not-computable");
  });

  it("'App obligatoria para timed entry desde 2026; Express opcional' stays specific-mechanism", () => {
    const signal = interpretReservationDeadlineText("App obligatoria para timed entry desde 2026; Express opcional");
    expect(signal.kind).toBe("not-computable");
    if (signal.kind === "not-computable") expect(signal.reason).toBe("specific-mechanism");
  });

  it("a magnitude-shaped phrase followed by extra text never becomes computable ('Semanas extra')", () => {
    const signal = interpretReservationDeadlineText("Semanas extra");
    expect(signal.kind).toBe("not-computable");
    if (signal.kind === "not-computable") expect(signal.reason).toBe("specific-mechanism");
  });
});

describe("interpretPlaceReservationDeadlineSignal — real Class A places", () => {
  it("agrees with interpretReservationDeadlineText(place.reservation.leadTime) for every place", () => {
    for (const place of places) {
      expect(interpretPlaceReservationDeadlineSignal(place)).toEqual(
        interpretReservationDeadlineText(place.reservation.leadTime)
      );
    }
  });

  it("JP-019, JP-034, JP-095 (the three Feb–Mar-pending Class A places) all classify explicit-lead-window", () => {
    // Illustrative current-data examples per the design gate (§4.2) — not a pinned allowlist. The
    // domain module itself never reads febMar2027; this test only proves these three real places
    // happen to be Class A today, for use as UI-layer fixtures elsewhere.
    for (const id of ["JP-019", "JP-034", "JP-095"]) {
      const place = places.find((p) => p.id === id);
      expect(place, id).toBeDefined();
      if (place) expect(interpretPlaceReservationDeadlineSignal(place).kind).toBe("explicit-lead-window");
    }
  });
});

describe("real dataset invariant: whole-dataset partition (5 / 5 / 10 / 1 / 65 / 128 = 214)", () => {
  it("does not throw across all 214 current places", () => {
    expect(() => {
      for (const place of places) interpretPlaceReservationDeadlineSignal(place);
    }).not.toThrow();
  });

  it("re-derives the audited A/B/C/D/E/not-applicable partition, pinned as a regression", () => {
    const counts = {
      "explicit-lead-window": 0,
      "unit-without-quantity": 0,
      "unusable-numeric-range": 0,
      "mixed-unit-without-quantity": 0,
      "month-range-not-supported": 0,
      "specific-mechanism": 0,
      "not-applicable": 0,
    };
    for (const place of places) {
      const signal = interpretPlaceReservationDeadlineSignal(place);
      if (signal.kind === "explicit-lead-window") counts["explicit-lead-window"] += 1;
      else if (signal.kind === "not-applicable") counts["not-applicable"] += 1;
      else counts[signal.reason] += 1;
    }
    expect(counts).toEqual({
      "explicit-lead-window": 5, // Class A
      "unit-without-quantity": 5, // Class B
      "unusable-numeric-range": 0, // no malformed/unsafe numeric range exists in the real dataset
      "mixed-unit-without-quantity": 10, // Class C
      "month-range-not-supported": 1, // Class D
      "specific-mechanism": 65, // Class E
      "not-applicable": 128,
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(214);
  });

  it("explicit-lead-window places always have minLeadDays <= maxLeadDays and both positive", () => {
    for (const place of places) {
      const signal = interpretPlaceReservationDeadlineSignal(place);
      if (signal.kind === "explicit-lead-window") {
        expect(signal.minLeadDays).toBeGreaterThan(0);
        expect(signal.maxLeadDays).toBeGreaterThanOrEqual(signal.minLeadDays);
      }
    }
  });
});

describe("reservation-level eligibility (design §10.4) — synthetic fixtures, not literal raw values", () => {
  function place(overrides: Partial<Place["reservation"]>): Place {
    return {
      ...(places[0] as Place),
      reservation: { required: false, leadTime: "2–4 semanas", raw: "Recomendable", ...overrides },
    };
  }

  it("a Class A leadTime with an unknown-tier reservation record → not eligible", () => {
    const p = place({ raw: "", required: false }); // "missing" category → tier "unknown"
    const fact = interpretPlaceReservation(p);
    expect(fact.tier).toBe("unknown");
    expect(isReservationEligibleForDeadlineWindow(fact)).toBe(false);
  });

  it("an unrecognized-value reservation record → not eligible", () => {
    const p = place({ raw: "Quizás", required: false });
    const fact = interpretPlaceReservation(p);
    expect(fact.category).toBe("unrecognized-value");
    expect(fact.tier).toBe("unknown");
    expect(isReservationEligibleForDeadlineWindow(fact)).toBe(false);
  });

  it("a reservation record whose prose and required boolean disagree → not eligible", () => {
    const p = place({ raw: "Sí", required: false }); // "Sí" expects required === true
    const fact = interpretPlaceReservation(p);
    expect(fact.consistentWithDerivedBoolean).toBe(false);
    expect(isReservationEligibleForDeadlineWindow(fact)).toBe(false);
  });

  it("a cleanly interpreted reservation record → eligible", () => {
    const p = place({ raw: "Recomendable", required: false });
    const fact = interpretPlaceReservation(p);
    expect(fact.tier).not.toBe("unknown");
    expect(fact.consistentWithDerivedBoolean).toBe(true);
    expect(isReservationEligibleForDeadlineWindow(fact)).toBe(true);
  });

  it("end-to-end: derivePlaceReservationDateWindow — unknown tier suppresses an otherwise-computable window", () => {
    const p = place({ raw: "", required: false, leadTime: "2–4 semanas" });
    const window = derivePlaceReservationDateWindow(p, "2027-03-01");
    expect(window.kind).toBe("no-window");
  });

  it("end-to-end: inconsistent record suppresses an otherwise-computable window", () => {
    const p = place({ raw: "Sí", required: false, leadTime: "2–4 semanas" });
    const window = derivePlaceReservationDateWindow(p, "2027-03-01");
    expect(window.kind).toBe("no-window");
  });

  it("end-to-end: a clean reservation record with a Class A leadTime yields a derived window", () => {
    const p = place({ raw: "Recomendable", required: false, leadTime: "2–4 semanas" });
    const window = derivePlaceReservationDateWindow(p, "2027-03-01");
    expect(window.kind).toBe("derived-window");
  });
});

describe("deriveReservationDateWindow — date application", () => {
  const classAFixture: ReservationDeadlineSignal = {
    kind: "explicit-lead-window",
    minLeadDays: 7,
    maxLeadDays: 14,
    raw: "1–2 semanas",
  };

  it("derives farAdvanceDate/nearAdvanceDate for a fixed visit date, eligible reservation", () => {
    const window = deriveReservationDateWindow(classAFixture, "2027-03-15", true);
    expect(window).toEqual({
      kind: "derived-window",
      visitDate: "2027-03-15",
      farAdvanceDate: "2027-03-01", // 15 - 14
      nearAdvanceDate: "2027-03-08", // 15 - 7
      signal: classAFixture,
    });
  });

  it("crosses a month boundary correctly", () => {
    const window = deriveReservationDateWindow(classAFixture, "2027-03-05", true);
    expect(window.kind).toBe("derived-window");
    if (window.kind === "derived-window") {
      expect(window.farAdvanceDate).toBe("2027-02-19"); // 5 - 14 days, Feb has 28 days in 2027
      expect(window.nearAdvanceDate).toBe("2027-02-26"); // 5 - 7 days
    }
  });

  it("crosses a year boundary correctly", () => {
    const window = deriveReservationDateWindow(classAFixture, "2028-01-05", true);
    expect(window.kind).toBe("derived-window");
    if (window.kind === "derived-window") {
      expect(window.farAdvanceDate).toBe("2027-12-22");
      expect(window.nearAdvanceDate).toBe("2027-12-29");
    }
  });

  it("accounts for a leap-year February correctly", () => {
    // 2028 is a leap year: Feb has 29 days.
    const window = deriveReservationDateWindow(classAFixture, "2028-03-05", true);
    expect(window.kind).toBe("derived-window");
    if (window.kind === "derived-window") {
      expect(window.farAdvanceDate).toBe("2028-02-20"); // 5 - 14 days, through a 29-day Feb
      expect(window.nearAdvanceDate).toBe("2028-02-27");
    }
  });

  it("for every Class A range in the real dataset, farAdvanceDate <= nearAdvanceDate < visitDate", () => {
    const visitDate = "2027-06-15";
    for (const place of places) {
      const signal = interpretPlaceReservationDeadlineSignal(place);
      if (signal.kind !== "explicit-lead-window") continue;
      const window = deriveReservationDateWindow(signal, visitDate, true);
      expect(window.kind, place.id).toBe("derived-window");
      if (window.kind === "derived-window") {
        expect(window.farAdvanceDate <= window.nearAdvanceDate, place.id).toBe(true);
        expect(window.nearAdvanceDate < window.visitDate, place.id).toBe(true);
      }
    }
  });

  it("null visitDate → no-visit-date, even for an otherwise-eligible Class A signal", () => {
    expect(deriveReservationDateWindow(classAFixture, null, true)).toEqual({ kind: "no-visit-date" });
  });

  it("an invalid visitDate string → no-visit-date rather than a guessed date", () => {
    expect(deriveReservationDateWindow(classAFixture, "not-a-date", true).kind).toBe("no-visit-date");
  });

  it("a not-computable signal with a valid visit date → no-window, carrying the signal", () => {
    const signal: ReservationDeadlineSignal = { kind: "not-computable", reason: "unit-without-quantity", raw: "Semanas" };
    expect(deriveReservationDateWindow(signal, "2027-03-15", true)).toEqual({ kind: "no-window", signal });
  });

  it("a not-applicable signal with a valid visit date → no-window, carrying the signal", () => {
    const signal: ReservationDeadlineSignal = { kind: "not-applicable", raw: "—" };
    expect(deriveReservationDateWindow(signal, "2027-03-15", true)).toEqual({ kind: "no-window", signal });
  });

  it("an eligible Class A signal but reservationEligible=false → no-window, never a fabricated window", () => {
    expect(deriveReservationDateWindow(classAFixture, "2027-03-15", false)).toEqual({
      kind: "no-window",
      signal: classAFixture,
    });
  });
});

describe("deriveVisitDateForPlace — visit-date contract (design §5), stricter than the existing day-view date", () => {
  function assignment(routeIds: string[], days: string[][]): DayAssignment {
    return buildDayAssignment(routeIds, days);
  }

  it("days === null (represented here as an empty day list) → invalid assignment → null for every place", () => {
    const a = assignment(["A", "B"], []);
    expect(a.valid).toBe(false);
    expect(deriveVisitDateForPlace(a, "2027-03-01", "A")).toBeNull();
  });

  it("an invalid partition (missing route id) → null for every place, not just the affected one", () => {
    const a = assignment(["A", "B"], [["A"]]); // "B" missing from any day
    expect(a.valid).toBe(false);
    expect(deriveVisitDateForPlace(a, "2027-03-01", "A")).toBeNull(); // even the present one
    expect(deriveVisitDateForPlace(a, "2027-03-01", "B")).toBeNull();
  });

  it("an invalid partition (duplicate across days) → null for every place", () => {
    const a = assignment(["A", "B"], [["A", "B"], ["B"]]);
    expect(a.valid).toBe(false);
    expect(deriveVisitDateForPlace(a, "2027-03-01", "A")).toBeNull();
  });

  it("missing startDate (null) → null, even with a valid assignment", () => {
    const a = assignment(["A", "B"], [["A"], ["B"]]);
    expect(a.valid).toBe(true);
    expect(deriveVisitDateForPlace(a, null, "A")).toBeNull();
  });

  it("invalid startDate string → null, even with a valid assignment", () => {
    const a = assignment(["A", "B"], [["A"], ["B"]]);
    expect(deriveVisitDateForPlace(a, "not-a-date", "A")).toBeNull();
  });

  it("valid assignment, valid startDate, place on Día 1 (index 0) → startDate itself", () => {
    const a = assignment(["A", "B"], [["A"], ["B"]]);
    expect(deriveVisitDateForPlace(a, "2027-03-01", "A")).toBe("2027-03-01");
  });

  it("valid assignment, valid startDate, place on Día N (index > 0) → startDate offset by N-1 days", () => {
    const a = assignment(["A", "B", "C"], [["A"], ["B"], ["C"]]);
    expect(deriveVisitDateForPlace(a, "2027-03-01", "C")).toBe("2027-03-03");
  });

  it("an empty day bucket ahead of the place's day still offsets correctly", () => {
    const a = assignment(["A", "B"], [[], ["A"], ["B"]]);
    expect(a.valid).toBe(true);
    expect(deriveVisitDateForPlace(a, "2027-03-01", "A")).toBe("2027-03-02");
    expect(deriveVisitDateForPlace(a, "2027-03-01", "B")).toBe("2027-03-03");
  });

  it("a place not assigned to any day (absent from routeIds/days) → null", () => {
    const a = assignment(["A"], [["A"]]);
    expect(deriveVisitDateForPlace(a, "2027-03-01", "Z")).toBeNull();
  });
});

describe("no availability booleans or urgency fields (structural check, mirrors feb-mar-status.test.ts's own precedent)", () => {
  it("ReservationDeadlineSignal never carries an availability/bookable/urgency field", () => {
    const signals: ReservationDeadlineSignal[] = [
      interpretReservationDeadlineText("1–2 semanas"),
      interpretReservationDeadlineText("Semanas"),
      interpretReservationDeadlineText("Días/semanas"),
      interpretReservationDeadlineText("1–3 meses"),
      interpretReservationDeadlineText("Lotería 3 meses antes; revisar liberaciones"),
      interpretReservationDeadlineText("—"),
    ];
    for (const signal of signals) {
      for (const forbidden of ["available", "bookable", "open", "isLate", "isUrgent", "daysRemaining"]) {
        expect(signal, JSON.stringify(signal)).not.toHaveProperty(forbidden);
      }
    }
  });

  it("ReservationDateWindow never carries an availability/bookable/urgency field", () => {
    const window = deriveReservationDateWindow(
      { kind: "explicit-lead-window", minLeadDays: 7, maxLeadDays: 14, raw: "1–2 semanas" },
      "2027-03-15",
      true
    );
    for (const forbidden of ["available", "bookable", "open", "isLate", "isUrgent", "daysRemaining"]) {
      expect(window).not.toHaveProperty(forbidden);
    }
  });
});

describe("cross-axis orthogonality (design §6.2 Rule 1 and Rule 3) — structural and behavioral", () => {
  it("this module's own source never imports feb-mar-status.ts and never references febMar2027 or Date.now", async () => {
    // The module's own doc comments legitimately *mention* these tokens in prose (to state the
    // guarantee that they are NOT used in code) — so the check strips comments first, exactly
    // like `OrderedSequenceBuilder.test.ts` scopes its forbidden-phrase checks to function bodies
    // rather than whole-file prose, for the same reason.
    const source = await readFile(new URL("./reservation-deadline.ts", import.meta.url), "utf8");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toContain("feb-mar-status");
    expect(codeOnly).not.toContain("febMar2027");
    expect(codeOnly).not.toContain("Date.now");
  });

  it("two synthetic places with identical reservation data but different febMar2027.status produce byte-identical results", () => {
    const base = places[0] as Place;
    const pendingPlace: Place = {
      ...base,
      reservation: { required: false, leadTime: "2–4 semanas", raw: "Recomendable" },
      febMar2027: { status: "CALENDARIO / CONDICIÓN PENDIENTE", warning: "w", action: "a" },
    };
    const confirmedPlace: Place = {
      ...base,
      reservation: { required: false, leadTime: "2–4 semanas", raw: "Recomendable" },
      febMar2027: { status: "ABIERTO CONFIRMADO", warning: "", action: "" },
    };
    const visitDate = "2027-03-01";
    const pendingResult = derivePlaceReservationDateWindow(pendingPlace, visitDate);
    const confirmedResult = derivePlaceReservationDateWindow(confirmedPlace, visitDate);
    expect(pendingResult).toEqual(confirmedResult);
  });

  it("a real Feb–Mar-pending Class A place (JP-019) still yields derived-window given a valid visit date", () => {
    const jp019 = places.find((p) => p.id === "JP-019");
    expect(jp019).toBeDefined();
    if (!jp019) return;
    expect(jp019.febMar2027.status).toContain("PENDIENTE");
    const window = derivePlaceReservationDateWindow(jp019, "2027-03-01");
    expect(window.kind).toBe("derived-window");
  });
});

/**
 * Corrective coverage (independent adversarial audit, MINOR-1/MINOR-2/MINOR-3): a numeric range
 * that matches the explicit-range shape but cannot safely become an ordered positive pair of
 * safe-integer day bounds must classify as `unusable-numeric-range` — never the misleading
 * `unit-without-quantity` (a quantity is plainly present) — and must never reach a caller as a
 * `derived-window` carrying a malformed (e.g. `NaN`-containing) date string. Every case here was
 * unreachable through the pre-correction code path without either producing a wrong reason or, for
 * the date-overflow case, an actively malformed result.
 */
describe("malformed/unsafe numeric ranges (design gate closed vocabulary, corrective audit finding) — unusable-numeric-range", () => {
  it("a reversed range ('4–2 semanas') is unusable-numeric-range, not unit-without-quantity", () => {
    expect(interpretReservationDeadlineText("4–2 semanas")).toEqual({
      kind: "not-computable",
      reason: "unusable-numeric-range",
      raw: "4–2 semanas",
    });
  });

  it("a zero lower bound ('0–2 semanas') is unusable-numeric-range", () => {
    expect(interpretReservationDeadlineText("0–2 semanas")).toEqual({
      kind: "not-computable",
      reason: "unusable-numeric-range",
      raw: "0–2 semanas",
    });
  });

  it("a zero upper bound / invalid ordering ('2–0 semanas') is unusable-numeric-range", () => {
    expect(interpretReservationDeadlineText("2–0 semanas")).toEqual({
      kind: "not-computable",
      reason: "unusable-numeric-range",
      raw: "2–0 semanas",
    });
  });

  it("a zero-length range ('0–0 semanas') is unusable-numeric-range", () => {
    expect(interpretReservationDeadlineText("0–0 semanas")).toEqual({
      kind: "not-computable",
      reason: "unusable-numeric-range",
      raw: "0–0 semanas",
    });
  });

  it("a degenerate but positive equal range ('2–2 semanas') stays computable — not inherently unsafe", () => {
    expect(interpretReservationDeadlineText("2–2 semanas")).toEqual({
      kind: "explicit-lead-window",
      minLeadDays: 14,
      maxLeadDays: 14,
      raw: "2–2 semanas",
    });
  });

  it("a numeric token beyond Number.MAX_SAFE_INTEGER is unusable-numeric-range, never a window", () => {
    const raw = "1–9007199254740993 semanas"; // MAX_SAFE_INTEGER + 2, still finite once parsed
    const signal = interpretReservationDeadlineText(raw);
    expect(signal).toEqual({ kind: "not-computable", reason: "unusable-numeric-range", raw });
  });

  it("bounds that are safe integers individually but become unsafe after the ×7 week conversion are unusable-numeric-range", () => {
    // 1300000000000000 is a safe integer; ×7 = 9100000000000000 > Number.MAX_SAFE_INTEGER.
    const raw = "1–1300000000000000 semanas";
    expect(Number.isSafeInteger(1300000000000000)).toBe(true);
    expect(Number.isSafeInteger(1300000000000000 * 7)).toBe(false);
    const signal = interpretReservationDeadlineText(raw);
    expect(signal).toEqual({ kind: "not-computable", reason: "unusable-numeric-range", raw });
  });

  it("an oversized-but-finite explicit-lead-window signal (constructed directly) can never surface as a derived-window containing NaN", () => {
    // Bypasses the extractor entirely to exercise deriveReservationDateWindow's own output guard
    // in isolation, in case a future caller constructs a signal some other way.
    const signal: ReservationDeadlineSignal = {
      kind: "explicit-lead-window",
      minLeadDays: 7,
      maxLeadDays: 100_000_000, // large enough to overflow addCivilDays/JS Date range
      raw: "synthetic",
    };
    const window = deriveReservationDateWindow(signal, "2027-02-19", true);
    expect(window.kind).toBe("no-visit-date");
    expect(JSON.stringify(window)).not.toContain("NaN");
  });

  it("the extractor itself never produces an explicit-lead-window whose bounds are unsafe (defense in depth)", () => {
    for (const raw of [
      "4–2 semanas",
      "0–2 semanas",
      "2–0 semanas",
      "0–0 semanas",
      "1–9007199254740993 semanas",
      "1–1300000000000000 semanas",
      "1–99999999999999999999 semanas",
    ]) {
      const signal = interpretReservationDeadlineText(raw);
      expect(signal.kind).not.toBe("explicit-lead-window");
    }
  });

  it("the real Class A values are unaffected by the new safe-integer/ordering checks", () => {
    expect(interpretReservationDeadlineText("1–2 semanas")).toEqual({
      kind: "explicit-lead-window",
      minLeadDays: 7,
      maxLeadDays: 14,
      raw: "1–2 semanas",
    });
    expect(interpretReservationDeadlineText("2–4 semanas")).toEqual({
      kind: "explicit-lead-window",
      minLeadDays: 14,
      maxLeadDays: 28,
      raw: "2–4 semanas",
    });
    expect(interpretReservationDeadlineText("2–6 semanas")).toEqual({
      kind: "explicit-lead-window",
      minLeadDays: 14,
      maxLeadDays: 42,
      raw: "2–6 semanas",
    });
  });

  it("adversarial classification-order examples are unaffected by the new checks — never reach numeric parsing at all", () => {
    const adversarial = [
      "Lotería 3 meses antes; revisar liberaciones",
      "1–2 semanas para atardecer",
      "1–3 semanas; antes en fines de semana",
      "2–4 semanas; atardecer antes",
      "Venta oficial desde 6 feb 2027",
      "Para Seiden desde 23 nov 2026, revisar reserva",
      "Reservar con 1-2 días de antelación",
    ];
    for (const raw of adversarial) {
      const signal = interpretReservationDeadlineText(raw);
      expect(signal.kind).toBe("not-computable");
      if (signal.kind === "not-computable") {
        expect(signal.reason).toBe("specific-mechanism");
      }
    }
  });
});
