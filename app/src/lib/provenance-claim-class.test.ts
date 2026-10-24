import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ACCESS_POINT_CLAIM_CLASS,
  ACCESS_POINT_HORIZON,
  ACCESS_POINT_VOLATILITY,
  RESERVATION_CLAIM_CLASS,
  RESERVATION_HORIZON,
  RESERVATION_VOLATILITY,
  accessPointClaimClass,
  accessPointFreshness,
  accessPointHorizon,
  reservationClaimClass,
  reservationHorizon,
  reservationMechanismFreshness,
  type AccessPointClaimClass,
  type ReservationClaimClass,
} from "./provenance-claim-class";
import {
  TIMETABLE_CYCLE_DAYS,
  freshnessFor,
  freshnessForHorizon,
  HORIZON_NONE,
  HORIZON_UNKNOWN,
  horizonOfDays,
} from "./source-freshness";
import { getAllAccessPoints, type AccessPointRole, type LogisticsAccessPoint } from "./access-points";
import {
  reservationMechanismEvidenceRecords,
  type ReservationMechanism,
  type ReservationMechanismEvidenceRecord,
} from "./reservation-mechanism-evidence";
import { getZones, zoneSources } from "./accommodation-zone";
import { addCivilDays } from "./civil-date";
import { freshnessAccessibleText } from "./zone-provenance-presentation";

/**
 * Block 11 — the claim-class contract for access points and reservation mechanisms.
 *
 * These tests fix the MEANING of the twelve records: what kind of claim each provenance backs, and
 * whether that kind of claim has a re-check rhythm. Every one passes `today` explicitly, so nothing
 * here can start failing with the calendar.
 */

/** Strips comments, so a scan asserts on what a module DOES rather than on what its docs promise. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function daysBefore(to: string, days: number): string {
  const result = addCivilDays(to, -days);
  if (result === null) throw new Error(`bad date ${to}`);
  return result;
}

/** A constructed access point. `role` is the only field any of this reads. */
function point(role: AccessPointRole, consultedAt: string): LogisticsAccessPoint {
  return {
    id: "AP-JP-999-001",
    placeId: "JP-999",
    label: "Test point",
    role,
    coordinates: { lat: 35, lng: 139 },
    applicableContexts: ["external-walk"],
    provenance: {
      sourceUrl: "https://example.test/a",
      sourceEntity: "Example",
      consultedAt,
      evidence: "e".repeat(40),
      confidence: "official-explicit",
    },
    selection: {},
    status: "active",
  };
}

/** A constructed reservation record. `mechanism.kind` is the only field any of this reads. */
function reservation(
  mechanism: ReservationMechanism,
  consultedAt: string,
  confidence: "official-explicit" | "official-derived" = "official-explicit"
): ReservationMechanismEvidenceRecord {
  return {
    id: "RM-JP-999-001",
    placeId: "JP-999",
    scope: "general-admission",
    purchaseResidenceContext: "not-recorded",
    mechanism,
    allocation: "not-stated",
    status: "active",
    provenance: {
      sourceUrl: "https://example.test/a",
      sourceEntity: "Example",
      consultedAt,
      evidence: "e".repeat(40),
      confidence,
    },
  };
}

const STANDING_RULE: ReservationMechanism = {
  kind: "monthly-fixed-release",
  releaseDayOfMonth: 10,
  releaseTimeLocal: "10:00",
  sourceTimeZone: "Asia/Tokyo",
  target: "subsequent-calendar-month",
};

const DATED_SALE: ReservationMechanism = {
  kind: "fixed-sale-date",
  saleDate: "2027-02-06",
  releaseTimeLocal: null,
  sourceTimeZone: null,
  appliesToStartDate: "2027-03-14",
  appliesToEndDate: "2027-03-28",
};

/** Every role the schema allows, listed here so a new one fails this file rather than sliding in. */
const ALL_ROLES: readonly AccessPointRole[] = [
  "visitor-entrance",
  "gate",
  "reception",
  "trailhead",
  "road-access",
  "transit-stop",
  "general-access",
];

/** Every mechanism kind the schema allows, listed here for the same reason. */
const ALL_MECHANISM_KINDS: readonly ReservationMechanism["kind"][] = [
  "monthly-fixed-release",
  "rolling-calendar-month-release",
  "rolling-day-release",
  "monthly-application-window",
  "relative-application-window",
  "fixed-sale-date",
];

describe("Block 11 — the twelve records are classified, completely and by name", () => {
  it("classifies all four shipped access points, and they are the four Block 10 inventoried", () => {
    const points = getAllAccessPoints();
    expect(points).toHaveLength(4);
    expect(
      Object.fromEntries(points.map((p) => [p.id, accessPointClaimClass(p)]))
    ).toEqual({
      "AP-JP-029-001": "built-arrival-point",
      "AP-JP-029-002": "built-arrival-point",
      "AP-JP-029-003": "built-arrival-point",
      "AP-JP-181-001": "built-arrival-point",
    });
  });

  it("classifies all eight shipped reservation records, and the sumo one stands apart", () => {
    const records = reservationMechanismEvidenceRecords;
    expect(records).toHaveLength(8);
    expect(
      Object.fromEntries(records.map((r) => [r.id, reservationClaimClass(r)]))
    ).toEqual({
      "RM-JP-044-001": "standing-sales-rule",
      "RM-JP-203-001": "standing-sales-rule",
      "RM-JP-204-001": "standing-sales-rule",
      "RM-JP-077-001": "standing-sales-rule",
      // The only `fixed-sale-date` in the dataset, and the reason the distinction exists: it
      // records one dated tournament sale, not a rule about sales.
      "RM-JP-212-001": "dated-sale-instance",
      "RM-JP-097-001": "standing-sales-rule",
      "RM-JP-050-001": "standing-sales-rule",
      "RM-JP-050-002": "standing-sales-rule",
    });
  });

  it("gives every one of the twelve a stated policy — none is left without an answer", () => {
    const answers = [
      ...getAllAccessPoints().map((p) => accessPointFreshness(p, "2026-09-18").state),
      ...reservationMechanismEvidenceRecords.map(
        (r) => reservationMechanismFreshness(r, "2026-09-18").state
      ),
    ];
    expect(answers).toHaveLength(12);
    // Every record resolves, and none of the twelve is due today: the four gates and the sumo
    // record have no rhythm at all, the seven sales rules have no derivable one.
    expect(answers.filter((s) => s === "no-periodic-recheck")).toHaveLength(5);
    expect(answers.filter((s) => s === "recheck-interval-unknown")).toHaveLength(7);
    expect(answers).not.toContain("needs-recheck");
  });
});

describe("Block 11 — the classes are real, and no value escapes them", () => {
  it("maps every role the schema allows, with no silent default", () => {
    for (const role of ALL_ROLES) {
      expect(ACCESS_POINT_CLAIM_CLASS[role]).toBeDefined();
      expect(accessPointClaimClass({ role })).toBe(ACCESS_POINT_CLAIM_CLASS[role]);
    }
    expect(Object.keys(ACCESS_POINT_CLAIM_CLASS).sort()).toEqual([...ALL_ROLES].sort());
  });

  it("maps every mechanism kind the schema allows, with no silent default", () => {
    for (const kind of ALL_MECHANISM_KINDS) {
      expect(RESERVATION_CLAIM_CLASS[kind]).toBeDefined();
    }
    expect(Object.keys(RESERVATION_CLAIM_CLASS).sort()).toEqual([...ALL_MECHANISM_KINDS].sort());
  });

  it("only `transit-stop` is a service claim; every other role names built fabric", () => {
    const served = ALL_ROLES.filter(
      (role) => ACCESS_POINT_CLAIM_CLASS[role] === "served-transit-stop"
    );
    expect(served).toEqual(["transit-stop"]);
  });

  it("only `fixed-sale-date` is a dated instance; every other kind is a standing rule", () => {
    const dated = ALL_MECHANISM_KINDS.filter(
      (kind) => RESERVATION_CLAIM_CLASS[kind] === "dated-sale-instance"
    );
    expect(dated).toEqual(["fixed-sale-date"]);
  });

  it("gives every class a horizon and a volatility — the premise is recorded beside the policy", () => {
    const accessClasses: AccessPointClaimClass[] = ["built-arrival-point", "served-transit-stop"];
    for (const c of accessClasses) {
      expect(ACCESS_POINT_HORIZON[c]).toBeDefined();
      expect(ACCESS_POINT_VOLATILITY[c]).toBeDefined();
    }
    const reservationClasses: ReservationClaimClass[] = [
      "standing-sales-rule",
      "dated-sale-instance",
    ];
    for (const c of reservationClasses) {
      expect(RESERVATION_HORIZON[c]).toBeDefined();
      expect(RESERVATION_VOLATILITY[c]).toBeDefined();
    }
    expect(ACCESS_POINT_VOLATILITY).toEqual({
      "built-arrival-point": "structural",
      "served-transit-stop": "operational",
    });
    expect(RESERVATION_VOLATILITY).toEqual({
      "standing-sales-rule": "commercial",
      "dated-sale-instance": "temporal",
    });
  });
});

describe("Block 11 — thresholds exist only where they were justified", () => {
  it("built arrival points carry no horizon, at any age", () => {
    for (const age of [0, 1, 365, 366, 4000]) {
      const p = point("visitor-entrance", daysBefore("2026-09-18", age));
      const freshness = accessPointFreshness(p, "2026-09-18");
      expect(freshness.state).toBe("no-periodic-recheck");
      expect(freshness.horizonDays).toBeNull();
      expect(freshness.ageDays).toBe(age);
    }
  });

  it("a dated sale instance carries no horizon either — the calendar ends it, not our checking", () => {
    for (const age of [0, 365, 366, 4000]) {
      const r = reservation(DATED_SALE, daysBefore("2026-09-18", age));
      const freshness = reservationMechanismFreshness(r, "2026-09-18");
      expect(freshness.state).toBe("no-periodic-recheck");
      expect(freshness.horizonDays).toBeNull();
    }
  });

  it("a standing sales rule never reports a number, at any age — and never reports `current`", () => {
    for (const age of [0, 1, 200, 365, 366, 4000]) {
      const r = reservation(STANDING_RULE, daysBefore("2026-09-18", age));
      const freshness = reservationMechanismFreshness(r, "2026-09-18");
      expect(freshness.state).toBe("recheck-interval-unknown");
      expect(freshness.horizonDays).toBeNull();
      // The age is still a fact and is still reported. What is withheld is the verdict.
      expect(freshness.ageDays).toBe(age);
    }
  });

  it("a served transit stop takes one timetable cycle, inclusive at the boundary", () => {
    const today = "2027-06-15";
    expect(accessPointHorizon({ role: "transit-stop" })).toEqual(
      horizonOfDays(TIMETABLE_CYCLE_DAYS)
    );
    expect(
      accessPointFreshness(point("transit-stop", daysBefore(today, TIMETABLE_CYCLE_DAYS - 1)), today)
        .state
    ).toBe("current");
    expect(
      accessPointFreshness(point("transit-stop", daysBefore(today, TIMETABLE_CYCLE_DAYS)), today)
        .state
    ).toBe("current");
    expect(
      accessPointFreshness(point("transit-stop", daysBefore(today, TIMETABLE_CYCLE_DAYS + 1)), today)
        .state
    ).toBe("needs-recheck");
  });

  it("no shipped record is a transit stop, so that branch is decided in advance, not in use", () => {
    expect(getAllAccessPoints().filter((p) => p.role === "transit-stop")).toEqual([]);
  });
});

describe("Block 11 — `recheck-interval-unknown` is not a synonym of `no-periodic-recheck`", () => {
  it("the two states are distinct values with opposite wording", () => {
    const rule = reservationMechanismFreshness(reservation(STANDING_RULE, "2026-09-12"), "2026-09-18");
    const instance = reservationMechanismFreshness(reservation(DATED_SALE, "2026-09-12"), "2026-09-18");
    expect(rule.state).not.toBe(instance.state);
    expect(freshnessAccessibleText(rule.state)).not.toBe(freshnessAccessibleText(instance.state));
  });

  it("neither state ever says the claim is wrong, outdated or unreliable", () => {
    for (const state of ["recheck-interval-unknown", "no-periodic-recheck"] as const) {
      const text = freshnessAccessibleText(state);
      expect(text).not.toMatch(/incorrect|erróne|error|caducad|obsolet|no fiable|inválid/i);
    }
  });

  it("the unknown wording admits ignorance rather than asserting stability", () => {
    const text = freshnessAccessibleText("recheck-interval-unknown");
    expect(text).toMatch(/puede cambiar/i);
    expect(text).not.toMatch(/no necesita/i);
  });
});

describe("Block 11 — freshness is independent of every other dimension", () => {
  it("confidence does not move the verdict, in either direction", () => {
    const old = daysBefore("2026-09-18", 900);
    const recent = "2026-09-17";
    // Recent but only `official-derived`, and old but `official-explicit`: neither swaps class.
    const recentDerived = reservationMechanismFreshness(
      reservation(DATED_SALE, recent, "official-derived"),
      "2026-09-18"
    );
    const oldExplicit = reservationMechanismFreshness(
      reservation(DATED_SALE, old, "official-explicit"),
      "2026-09-18"
    );
    expect(recentDerived.state).toBe("no-periodic-recheck");
    expect(oldExplicit.state).toBe("no-periodic-recheck");
    expect(recentDerived.ageDays).toBe(1);
    expect(oldExplicit.ageDays).toBe(900);
  });

  it("two records differing only in confidence get byte-identical freshness", () => {
    for (const mechanism of [STANDING_RULE, DATED_SALE]) {
      const explicit = reservationMechanismFreshness(
        reservation(mechanism, "2026-05-01", "official-explicit"),
        "2026-09-18"
      );
      const derived = reservationMechanismFreshness(
        reservation(mechanism, "2026-05-01", "official-derived"),
        "2026-09-18"
      );
      expect(explicit).toEqual(derived);
    }
  });

  it("access-point confidence is likewise inert", () => {
    const explicit = point("visitor-entrance", "2026-09-05");
    const derived = {
      ...explicit,
      provenance: { ...explicit.provenance, confidence: "official-derived" as const },
    };
    expect(accessPointFreshness(explicit, "2026-09-18")).toEqual(
      accessPointFreshness(derived, "2026-09-18")
    );
  });

  it("neither module reads confidence, a tier, an editorial rating or a clock", () => {
    // Asserted on the shipped record shape too: a tier does not exist in either schema, so a
    // freshness that consulted one could not even be written.
    expect(getAllAccessPoints().every((p) => !("tier" in p.provenance))).toBe(true);
    expect(
      reservationMechanismEvidenceRecords.every((r) => !("tier" in r.provenance))
    ).toBe(true);
  });

  it("the claim-class module contains no clock, no storage and no confidence read", async () => {
    const code = withoutComments(
      await readFile(new URL("./provenance-claim-class.ts", import.meta.url), "utf8")
    );
    expect(code).not.toMatch(/localStorage|sessionStorage|setItem|nihon\./);
    expect(code).not.toMatch(/new Date\(|Date\.now\(/);
    expect(code).not.toMatch(/confidence/);
    expect(code).not.toMatch(/\btier\b/);
    expect(code).not.toMatch(/editorial/i);
  });

  it("is deterministic: the same pair always answers the same, and only `today` moves it", () => {
    const r = reservation(STANDING_RULE, "2026-01-01");
    const a = reservationMechanismFreshness(r, "2026-09-18");
    const b = reservationMechanismFreshness(r, "2026-09-18");
    expect(a).toEqual(b);
    expect(reservationMechanismFreshness(r, "2027-09-18").ageDays).not.toBe(a.ageDays);
  });
});

describe("Block 11 — a broken date still outranks every horizon", () => {
  it("a future check is `needs-recheck` even where no horizon applies", () => {
    for (const mechanism of [STANDING_RULE, DATED_SALE]) {
      const freshness = reservationMechanismFreshness(
        reservation(mechanism, "2026-09-19"),
        "2026-09-18"
      );
      expect(freshness.state).toBe("needs-recheck");
      expect(freshness.ageDays).toBeNull();
    }
    expect(accessPointFreshness(point("visitor-entrance", "2099-01-01"), "2026-09-18").state).toBe(
      "needs-recheck"
    );
  });

  it("an impossible or malformed date is `needs-recheck`, never `unknown` and never `none`", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "18-09-2026", "2026-9-18", ""]) {
      expect(reservationMechanismFreshness(reservation(STANDING_RULE, bad), "2026-09-18").state).toBe(
        "needs-recheck"
      );
      expect(accessPointFreshness(point("gate", bad), "2026-09-18").state).toBe("needs-recheck");
    }
  });

  it("an unusable `today` is `needs-recheck` too", () => {
    expect(
      reservationMechanismFreshness(reservation(STANDING_RULE, "2026-09-12"), "not-a-date").state
    ).toBe("needs-recheck");
  });
});

describe("Block 11 — the engine is shared, and Block 10 is untouched by sharing it", () => {
  it("the adapters are the engine, called with a horizon", () => {
    const r = reservation(STANDING_RULE, "2026-01-01");
    expect(reservationMechanismFreshness(r, "2026-09-18")).toEqual(
      freshnessForHorizon("2026-01-01", HORIZON_UNKNOWN, "2026-09-18")
    );
    const p = point("visitor-entrance", "2026-01-01");
    expect(accessPointFreshness(p, "2026-09-18")).toEqual(
      freshnessForHorizon("2026-01-01", HORIZON_NONE, "2026-09-18")
    );
  });

  it("no zone source can ever produce the new state", () => {
    for (const today of ["2026-09-18", "2030-01-01", "2045-06-15"]) {
      for (const zone of getZones()) {
        for (const source of zoneSources(zone)) {
          expect(freshnessFor(source, today).state).not.toBe("recheck-interval-unknown");
        }
      }
    }
  });

  it("zone freshness is exactly what the engine returns for its covers-derived horizon", () => {
    const zone = getZones()[0];
    const source = zoneSources(zone)[0];
    expect(freshnessFor(source, "2026-09-18")).toEqual(
      freshnessForHorizon(
        source.consultedAt,
        source.covers.includes("airportLinks") ? horizonOfDays(TIMETABLE_CYCLE_DAYS) : HORIZON_NONE,
        "2026-09-18"
      )
    );
  });
});

describe("Block 11 — no date was touched, and nothing looks freshly verified", () => {
  /** Exactly the dates Block 10 inventoried. A migration that "refreshed" one fails here. */
  const BLOCK_10_DATES: Readonly<Record<string, string>> = {
    "AP-JP-029-001": "2026-09-05",
    "AP-JP-029-002": "2026-09-05",
    "AP-JP-029-003": "2026-09-05",
    "AP-JP-181-001": "2026-09-05",
    "RM-JP-044-001": "2026-09-12",
    "RM-JP-203-001": "2026-09-12",
    "RM-JP-204-001": "2026-09-12",
    "RM-JP-077-001": "2026-09-12",
    "RM-JP-212-001": "2026-09-12",
    "RM-JP-097-001": "2026-09-13",
    "RM-JP-050-001": "2026-09-14",
    "RM-JP-050-002": "2026-09-15",
  };

  it("all twelve consultedAt dates are the ones Blocks 7–10 recorded", () => {
    const actual = Object.fromEntries([
      ...getAllAccessPoints().map((p) => [p.id, p.provenance.consultedAt]),
      ...reservationMechanismEvidenceRecords.map((r) => [r.id, r.provenance.consultedAt]),
    ]);
    expect(actual).toEqual(BLOCK_10_DATES);
  });

  it("neither schema grew a `covers` field — the record is the claim", () => {
    for (const p of getAllAccessPoints()) {
      expect(Object.keys(p.provenance).sort()).toEqual([
        "confidence",
        "consultedAt",
        "evidence",
        "sourceEntity",
        "sourceUrl",
      ]);
    }
    for (const r of reservationMechanismEvidenceRecords) {
      expect(Object.keys(r.provenance).sort()).toEqual([
        "confidence",
        "consultedAt",
        "evidence",
        "sourceEntity",
        "sourceUrl",
      ]);
    }
  });

  it("the class is derived, so it cannot disagree with the record it describes", () => {
    for (const r of reservationMechanismEvidenceRecords) {
      expect(reservationClaimClass(r)).toBe(RESERVATION_CLAIM_CLASS[r.mechanism.kind]);
    }
    for (const p of getAllAccessPoints()) {
      expect(accessPointClaimClass(p)).toBe(ACCESS_POINT_CLAIM_CLASS[p.role]);
    }
  });

  it("no record is derived from a class it does not carry: reservation horizons match kinds", () => {
    for (const r of reservationMechanismEvidenceRecords) {
      const expected =
        r.mechanism.kind === "fixed-sale-date" ? HORIZON_NONE : HORIZON_UNKNOWN;
      expect(reservationHorizon(r)).toEqual(expected);
    }
  });
});

describe("Block 11 — the engine handles all three horizon kinds directly", () => {
  it("`days` behaves exactly as Block 10 specified, boundary inclusive", () => {
    const today = "2027-06-15";
    expect(freshnessForHorizon(daysBefore(today, 9), horizonOfDays(10), today)).toEqual({
      state: "current",
      ageDays: 9,
      horizonDays: 10,
    });
    expect(freshnessForHorizon(daysBefore(today, 10), horizonOfDays(10), today)).toEqual({
      state: "current",
      ageDays: 10,
      horizonDays: 10,
    });
    expect(freshnessForHorizon(daysBefore(today, 11), horizonOfDays(10), today)).toEqual({
      state: "needs-recheck",
      ageDays: 11,
      horizonDays: 10,
    });
  });

  it("`none` and `unknown` both report a null horizon but never the same state", () => {
    const none = freshnessForHorizon("2020-01-01", HORIZON_NONE, "2026-09-18");
    const unknown = freshnessForHorizon("2020-01-01", HORIZON_UNKNOWN, "2026-09-18");
    expect(none.horizonDays).toBeNull();
    expect(unknown.horizonDays).toBeNull();
    expect(none.ageDays).toBe(unknown.ageDays);
    expect(none.state).toBe("no-periodic-recheck");
    expect(unknown.state).toBe("recheck-interval-unknown");
  });

  it("neither `none` nor `unknown` can ever produce `current` — nothing was certified fresh", () => {
    for (const horizon of [HORIZON_NONE, HORIZON_UNKNOWN]) {
      for (const age of [0, 1, 10_000]) {
        expect(freshnessForHorizon(daysBefore("2026-09-18", age), horizon, "2026-09-18").state).not.toBe(
          "current"
        );
      }
    }
  });

  it("crosses a leap day without drifting, under a real horizon", () => {
    // 2027-06-15 → 2028-06-15 spans 2028-02-29, so it is 366 days, one past the cycle.
    expect(freshnessForHorizon("2027-06-15", horizonOfDays(TIMETABLE_CYCLE_DAYS), "2028-06-15")).toEqual({
      state: "needs-recheck",
      ageDays: 366,
      horizonDays: TIMETABLE_CYCLE_DAYS,
    });
    // 2025-06-15 → 2026-06-15 spans no leap day, so it is exactly 365 and still current.
    expect(
      freshnessForHorizon("2025-06-15", horizonOfDays(TIMETABLE_CYCLE_DAYS), "2026-06-15").state
    ).toBe("current");
  });
});
