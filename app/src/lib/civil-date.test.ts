import { afterEach, describe, expect, it } from "vitest";
import { addCivilDays, formatCivilDateDisplay, isValidCivilDate } from "./civil-date";

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
