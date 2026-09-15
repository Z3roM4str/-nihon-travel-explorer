import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  addCivilDays,
  differenceInCivilDays,
  formatCivilDateDisplay,
  getCivilWeekday,
  isValidCivilDate,
} from "./civil-date";

describe("isValidCivilDate", () => {
  it("accepts a well-formed, real calendar date", () => {
    expect(isValidCivilDate("2027-02-19")).toBe(true);
  });

  it("rejects a malformed shape", () => {
    for (const bad of ["2027/02/19", "19-02-2027", "2027-2-19", "2027-02-9", "Feb 19 2027", "", "2027-02-19T00:00:00Z"]) {
      expect(isValidCivilDate(bad), bad).toBe(false);
    }
  });

  it("rejects an impossible day-of-month", () => {
    expect(isValidCivilDate("2027-02-30")).toBe(false); // February never has 30 days
    expect(isValidCivilDate("2027-04-31")).toBe(false); // April has 30 days
  });

  it("rejects an impossible month", () => {
    expect(isValidCivilDate("2027-13-01")).toBe(false);
    expect(isValidCivilDate("2027-00-15")).toBe(false);
  });

  it("accepts February 29 in a leap year", () => {
    expect(isValidCivilDate("2028-02-29")).toBe(true); // 2028 = divisible by 4, not by 100
  });

  it("rejects February 29 in a non-leap year", () => {
    expect(isValidCivilDate("2027-02-29")).toBe(false);
    expect(isValidCivilDate("1900-02-29")).toBe(false); // divisible by 100, not by 400
  });

  it("accepts February 29 in a century leap year", () => {
    expect(isValidCivilDate("2000-02-29")).toBe(true); // divisible by 400
  });
});

describe("addCivilDays", () => {
  it("offsets within the same month", () => {
    expect(addCivilDays("2027-02-19", 1)).toBe("2027-02-20");
    expect(addCivilDays("2027-02-19", -1)).toBe("2027-02-18");
  });

  it("rolls over a month boundary", () => {
    expect(addCivilDays("2027-02-27", 3)).toBe("2027-03-02"); // 2027 is not a leap year
  });

  it("rolls over a year boundary", () => {
    expect(addCivilDays("2027-12-31", 1)).toBe("2028-01-01");
  });

  it("rolls over the leap-day boundary correctly in a leap year", () => {
    expect(addCivilDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCivilDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("returns null for an invalid input date rather than guessing", () => {
    expect(addCivilDays("2027-02-30", 1)).toBeNull();
    expect(addCivilDays("not-a-date", 1)).toBeNull();
  });

  it("a zero offset returns the same date", () => {
    expect(addCivilDays("2027-02-19", 0)).toBe("2027-02-19");
  });
});

describe("formatCivilDateDisplay — no UTC/local-timezone off-by-one", () => {
  const ORIGINAL_TZ = process.env.TZ;

  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("renders the same civil date regardless of the process's local timezone", () => {
    const results = new Set<string>();
    for (const tz of ["UTC", "Etc/GMT+12", "Pacific/Kiritimati", "America/Los_Angeles"]) {
      process.env.TZ = tz;
      results.add(formatCivilDateDisplay("2027-02-19"));
    }
    // If timezone leaked into the calculation, at least one of these (a UTC-12 and a UTC+14
    // timezone are both represented) would have rendered Feb 18 or Feb 20 instead of Feb 19.
    expect(results.size).toBe(1);
    expect([...results][0]).toContain("19");
    expect([...results][0]).toContain("2027");
  });

  it("specifically would have shown the wrong day without the UTC fix (documents the bug this guards against)", () => {
    process.env.TZ = "Etc/GMT+12"; // UTC-12: the classic westward off-by-one timezone
    const naive = new Intl.DateTimeFormat("es", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      // deliberately omitting `timeZone: "UTC"` to reproduce the bug this module avoids
    }).format(new Date("2027-02-19"));
    expect(naive).toContain("18"); // proves the naive approach really does drift a day
    expect(formatCivilDateDisplay("2027-02-19")).toContain("19"); // our function does not
  });

  it("includes a weekday abbreviation sourced from Intl, not a hardcoded table", () => {
    // 2027-02-19 is a Friday.
    const label = formatCivilDateDisplay("2027-02-19");
    expect(label.toLowerCase()).toContain("vie");
  });

  it("falls back to returning the input unchanged for an invalid date", () => {
    expect(formatCivilDateDisplay("not-a-date")).toBe("not-a-date");
  });
});

describe("getCivilWeekday", () => {
  // Ground truth for every fixture below was independently confirmed via Node's own
  // `new Date(Date.UTC(y, m - 1, d)).getUTCDay()` before this function was written — not derived
  // from this module's own output, so these are real regression fixtures, not tautologies.

  it("identifies a known Monday", () => {
    expect(getCivilWeekday("2027-02-15")).toBe("monday");
  });

  it("identifies a known Sunday", () => {
    expect(getCivilWeekday("2027-02-14")).toBe("sunday");
  });

  it("identifies every other weekday across the same reference week", () => {
    // 2027-02-14 (Sun) .. 2027-02-19 (Fri, confirmed by the existing formatCivilDateDisplay test).
    expect(getCivilWeekday("2027-02-16")).toBe("tuesday");
    expect(getCivilWeekday("2027-02-17")).toBe("wednesday");
    expect(getCivilWeekday("2027-02-18")).toBe("thursday");
    expect(getCivilWeekday("2027-02-19")).toBe("friday");
    expect(getCivilWeekday("2027-02-20")).toBe("saturday");
  });

  it("handles a leap date correctly", () => {
    expect(getCivilWeekday("2028-02-29")).toBe("tuesday");
  });

  it("handles a century leap year correctly (divisible by 400)", () => {
    expect(getCivilWeekday("2000-02-29")).toBe("tuesday");
  });

  it("handles a month boundary (non-leap February 28 -> March 1)", () => {
    expect(getCivilWeekday("2027-02-28")).toBe("sunday");
    expect(getCivilWeekday("2027-03-01")).toBe("monday");
  });

  it("handles a year boundary (December 31 -> January 1)", () => {
    expect(getCivilWeekday("2027-12-31")).toBe("friday");
    expect(getCivilWeekday("2028-01-01")).toBe("saturday");
  });

  it("returns null for an invalid civil date rather than guessing a weekday", () => {
    expect(getCivilWeekday("2027-02-30")).toBeNull(); // impossible day-of-month
    expect(getCivilWeekday("2027-02-29")).toBeNull(); // non-leap-year Feb 29
    expect(getCivilWeekday("not-a-date")).toBeNull();
    expect(getCivilWeekday("")).toBeNull();
  });

  describe("timezone invariance", () => {
    const ORIGINAL_TZ = process.env.TZ;

    afterEach(() => {
      process.env.TZ = ORIGINAL_TZ;
    });

    it("returns the same weekday regardless of the process's local timezone", () => {
      const results = new Set<string | null>();
      for (const tz of ["UTC", "Etc/GMT+12", "Pacific/Kiritimati", "America/Los_Angeles"]) {
        process.env.TZ = tz;
        results.add(getCivilWeekday("2027-02-19"));
      }
      // A UTC-12 timezone and a UTC+14 timezone are both represented above; if local time had
      // leaked into the calculation, at least one run would have drifted to Thursday or Saturday.
      expect(results.size).toBe(1);
      expect([...results][0]).toBe("friday");
    });
  });
});

/**
 * Phase 3D-W — Trip Bounds Runtime. `differenceInCivilDays` is the one new primitive the trip's
 * inclusive calendar-day count is built on, so it is tested here as a civil-date helper in its own
 * right — signed, whole-day, null-on-invalid, and timezone-invariant — independently of anything
 * that consumes it.
 */
describe("differenceInCivilDays", () => {
  it("returns 0 for the same civil date", () => {
    expect(differenceInCivilDays("2027-02-19", "2027-02-19")).toBe(0);
  });

  it("returns a positive count when `to` is after `from`", () => {
    expect(differenceInCivilDays("2027-02-19", "2027-02-20")).toBe(1);
    expect(differenceInCivilDays("2027-02-19", "2027-03-05")).toBe(14);
  });

  it("returns a NEGATIVE count when `to` precedes `from` — the sign is not absorbed or clamped", () => {
    expect(differenceInCivilDays("2027-02-20", "2027-02-19")).toBe(-1);
    expect(differenceInCivilDays("2027-03-05", "2027-02-19")).toBe(-14);
  });

  it("counts correctly across a month boundary", () => {
    expect(differenceInCivilDays("2027-01-31", "2027-02-01")).toBe(1);
    expect(differenceInCivilDays("2027-04-30", "2027-05-01")).toBe(1);
    // Every day of a 31-day month.
    expect(differenceInCivilDays("2027-01-01", "2027-02-01")).toBe(31);
  });

  it("counts correctly across a year boundary", () => {
    expect(differenceInCivilDays("2027-12-31", "2028-01-01")).toBe(1);
    expect(differenceInCivilDays("2026-01-01", "2027-01-01")).toBe(365);
  });

  it("counts a leap year as 366 days and a leap-day crossing correctly", () => {
    // 2028 is a leap year: Jan 1 2028 → Jan 1 2029 spans Feb 29.
    expect(differenceInCivilDays("2028-01-01", "2029-01-01")).toBe(366);
    expect(differenceInCivilDays("2028-02-28", "2028-03-01")).toBe(2); // via Feb 29
    expect(differenceInCivilDays("2027-02-28", "2027-03-01")).toBe(1); // no Feb 29 in 2027
    expect(differenceInCivilDays("2028-02-29", "2028-03-01")).toBe(1);
  });

  it("handles a century non-leap year (1900 is not a leap year, 2000 is)", () => {
    expect(differenceInCivilDays("1900-02-28", "1900-03-01")).toBe(1);
    expect(differenceInCivilDays("2000-02-28", "2000-03-01")).toBe(2);
  });

  it("returns null — never 0 and never a guess — when either argument is not a valid civil date", () => {
    for (const bad of ["", "2027-02-30", "2027-13-01", "2027-2-19", "19-02-2027", "2027-02-19T00:00:00Z", "hoy"]) {
      expect(differenceInCivilDays(bad, "2027-02-19"), `from=${bad}`).toBeNull();
      expect(differenceInCivilDays("2027-02-19", bad), `to=${bad}`).toBeNull();
    }
    expect(differenceInCivilDays("2027-02-29", "2027-03-01")).toBeNull(); // 2027 is not a leap year
  });

  it("returns whole integers only — never a fractional day", () => {
    for (let offset = 0; offset < 400; offset += 1) {
      const to = addCivilDays("2027-01-01", offset)!;
      const difference = differenceInCivilDays("2027-01-01", to);
      expect(Number.isInteger(difference), `offset=${offset}`).toBe(true);
      expect(difference).toBe(offset);
    }
  });

  it("is the exact inverse of addCivilDays over a long span crossing months, years and a leap day", () => {
    for (let offset = -800; offset <= 800; offset += 37) {
      const to = addCivilDays("2028-02-29", offset)!;
      expect(differenceInCivilDays("2028-02-29", to), `offset=${offset}`).toBe(offset);
    }
  });

  describe("timezone invariance", () => {
    const ORIGINAL_TZ = process.env.TZ;

    afterEach(() => {
      process.env.TZ = ORIGINAL_TZ;
    });

    it("returns the same difference regardless of the process's local timezone", () => {
      const results: (number | null)[] = [];
      // A UTC-12 timezone and a UTC+14 timezone are both represented; if a local getter had leaked
      // into the arithmetic, at least one of these would be off by a day.
      for (const tz of ["UTC", "Etc/GMT+12", "Etc/GMT-14", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Kiritimati"]) {
        process.env.TZ = tz;
        results.push(differenceInCivilDays("2027-02-19", "2027-03-05"));
      }
      expect(new Set(results).size).toBe(1);
      expect(results[0]).toBe(14);
    });

    it("keeps a same-day difference at exactly 0 west of UTC, where a local-getter bug would show -1", () => {
      process.env.TZ = "Etc/GMT+12";
      expect(differenceInCivilDays("2027-02-19", "2027-02-19")).toBe(0);
      expect(differenceInCivilDays("2027-01-01", "2027-01-01")).toBe(0);
    });
  });
});

describe("civil-date module — no clock time, no instant, no timezone inference (source scan)", () => {
  it("differenceInCivilDays reads and writes calendar components through Date.UTC only", async () => {
    const source = await readFile(new URL("./civil-date.ts", import.meta.url), "utf8");
    const start = source.indexOf("export function differenceInCivilDays");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start);
    expect(body).toContain("Date.UTC(");
    // No local-timezone getters, no instant serialization, no clock reading.
    for (const forbidden of ["getFullYear()", "getMonth()", "getDate()", "getHours()", "toISOString", "Date.now"]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });
});
