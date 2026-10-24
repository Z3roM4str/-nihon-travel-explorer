import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { ReservationDateWindow } from "./reservation-deadline";
import {
  captureDeviceLocalCivilDate,
  evaluateReservationWindowReference,
} from "./reservation-window-reference";

const WINDOW: Extract<ReservationDateWindow, { kind: "derived-window" }> = {
  kind: "derived-window",
  visitDate: "2027-03-15",
  farAdvanceDate: "2027-03-01",
  nearAdvanceDate: "2027-03-08",
  signal: {
    kind: "explicit-lead-window",
    minLeadDays: 7,
    maxLeadDays: 14,
    raw: "1–2 semanas",
  },
};

describe("evaluateReservationWindowReference", () => {
  it("returns not-assessed for an invalid reference date", () => {
    expect(evaluateReservationWindowReference(WINDOW, "2027-02-30")).toEqual({
      kind: "not-assessed",
      reason: "invalid-reference-date",
    });
  });

  it("returns not-assessed when Phase 3D-H has no visit date", () => {
    expect(evaluateReservationWindowReference({ kind: "no-visit-date" }, "2027-03-01")).toEqual({
      kind: "not-assessed",
      reason: "no-derived-window",
    });
  });

  it("returns not-assessed when Phase 3D-H has no numeric window", () => {
    const window: ReservationDateWindow = {
      kind: "no-window",
      signal: { kind: "not-computable", reason: "unit-without-quantity", raw: "Semanas" },
    };
    expect(evaluateReservationWindowReference(window, "2027-03-01")).toEqual({
      kind: "not-assessed",
      reason: "no-derived-window",
    });
  });

  it("classifies one day before the far edge as before", () => {
    expect(evaluateReservationWindowReference(WINDOW, "2027-02-28").kind).toBe(
      "before-recorded-window"
    );
  });

  it("treats the far edge as inclusive", () => {
    expect(evaluateReservationWindowReference(WINDOW, "2027-03-01").kind).toBe(
      "within-recorded-window"
    );
  });

  it("classifies a date strictly between both bounds as within", () => {
    expect(evaluateReservationWindowReference(WINDOW, "2027-03-04").kind).toBe(
      "within-recorded-window"
    );
  });

  it("treats the near edge as inclusive", () => {
    expect(evaluateReservationWindowReference(WINDOW, "2027-03-08").kind).toBe(
      "within-recorded-window"
    );
  });

  it("classifies one day after the near edge as after", () => {
    expect(evaluateReservationWindowReference(WINDOW, "2027-03-09").kind).toBe(
      "after-recorded-window"
    );
  });

  it("handles a month/year rollover without converting civil dates to instants", () => {
    const rolloverWindow: Extract<ReservationDateWindow, { kind: "derived-window" }> = {
      ...WINDOW,
      visitDate: "2027-01-05",
      farAdvanceDate: "2026-12-22",
      nearAdvanceDate: "2026-12-29",
    };
    expect(evaluateReservationWindowReference(rolloverWindow, "2026-12-21").kind).toBe(
      "before-recorded-window"
    );
    expect(evaluateReservationWindowReference(rolloverWindow, "2026-12-25").kind).toBe(
      "within-recorded-window"
    );
    expect(evaluateReservationWindowReference(rolloverWindow, "2027-01-01").kind).toBe(
      "after-recorded-window"
    );
  });

  it("handles leap day as an ordinary valid civil date", () => {
    const leapWindow: Extract<ReservationDateWindow, { kind: "derived-window" }> = {
      ...WINDOW,
      visitDate: "2028-03-07",
      farAdvanceDate: "2028-02-22",
      nearAdvanceDate: "2028-02-29",
    };
    expect(evaluateReservationWindowReference(leapWindow, "2028-02-29").kind).toBe(
      "within-recorded-window"
    );
  });

  it("keeps a same-day window well-defined and inclusive", () => {
    const sameDayWindow: Extract<ReservationDateWindow, { kind: "derived-window" }> = {
      ...WINDOW,
      farAdvanceDate: "2027-03-08",
      nearAdvanceDate: "2027-03-08",
    };
    expect(evaluateReservationWindowReference(sameDayWindow, "2027-03-07").kind).toBe(
      "before-recorded-window"
    );
    expect(evaluateReservationWindowReference(sameDayWindow, "2027-03-08").kind).toBe(
      "within-recorded-window"
    );
    expect(evaluateReservationWindowReference(sameDayWindow, "2027-03-09").kind).toBe(
      "after-recorded-window"
    );
  });

  it("does not mutate or reinterpret the upstream window", () => {
    const result = evaluateReservationWindowReference(WINDOW, "2027-03-04");
    expect(result.kind).toBe("within-recorded-window");
    if (result.kind !== "within-recorded-window") throw new Error("unexpected result");
    expect(result.window).toBe(WINDOW);
    expect(result.window.signal.raw).toBe("1–2 semanas");
  });
});

describe("captureDeviceLocalCivilDate", () => {
  it("reads injected local calendar components", () => {
    class DivergentDate extends Date {
      override getFullYear() {
        return 2026;
      }
      override getMonth() {
        return 8;
      }
      override getDate() {
        return 8;
      }
      override getUTCFullYear(): number {
        throw new Error("UTC getter must not be used");
      }
      override getUTCMonth(): number {
        throw new Error("UTC getter must not be used");
      }
      override getUTCDate(): number {
        throw new Error("UTC getter must not be used");
      }
      override toISOString(): string {
        throw new Error("ISO serialization must not be used");
      }
    }

    const injected = new DivergentDate("2026-09-09T04:30:00.000Z");
    expect(captureDeviceLocalCivilDate(injected)).toBe("2026-09-08");
  });

  it("returns null for an invalid injected Date", () => {
    expect(captureDeviceLocalCivilDate(new Date(Number.NaN))).toBeNull();
  });

  it("contains no UTC/ISO extraction or Japan timezone conversion", async () => {
    const source = await readFile(new URL("./reservation-window-reference.ts", import.meta.url), "utf8");
    for (const forbidden of [
      ".toISOString(",
      ".getUTCFullYear(",
      ".getUTCMonth(",
      ".getUTCDate(",
      "Asia/Tokyo",
      "Date.now(",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it("keeps ambient Date construction outside the pure evaluator", async () => {
    const source = await readFile(new URL("./reservation-window-reference.ts", import.meta.url), "utf8");
    const start = source.indexOf("export function evaluateReservationWindowReference");
    const end = source.indexOf("export function captureDeviceLocalCivilDate", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const evaluatorSource = source.slice(start, end);
    expect(evaluatorSource).not.toContain("new Date(");
  });
});
