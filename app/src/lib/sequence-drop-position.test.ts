import { describe, expect, it } from "vitest";
import { resolveFinalPosition } from "./sequence-drop-position";

describe("B28 drop position normalization", () => {
  it("uses the exact final index for same-day, cross-day, and unassigned drops", () => {
    expect(resolveFinalPosition("day-a", "day-a", 0, 3)).toBe(2);
    expect(resolveFinalPosition("day-a", "day-a", 3, 0)).toBe(0);
    expect(resolveFinalPosition("day-a", "day-b", 1, 2)).toBe(2);
    expect(resolveFinalPosition(null, "day-b", -1, 1)).toBe(1);
  });
});
