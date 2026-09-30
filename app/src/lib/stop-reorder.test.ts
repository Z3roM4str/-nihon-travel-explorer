import { describe, expect, it } from "vitest";
import {
  clampSlot,
  describeSlot,
  insertionIndex,
  isSameSlot,
  maxIndexInDay,
  stepSlot,
  type StopSlot,
} from "./stop-reorder";

const day = (dayIndex: number, index: number): StopSlot => ({ kind: "day", dayIndex, index });
const UN: StopSlot = { kind: "unassigned" };

describe("B28 stop-reorder (pure)", () => {
  it("insertionIndex cuenta las paradas por encima del puntero", () => {
    expect(insertionIndex([], 10)).toBe(0);
    expect(insertionIndex([50, 150], 10)).toBe(0);
    expect(insertionIndex([50, 150], 100)).toBe(1);
    expect(insertionIndex([50, 150], 999)).toBe(2);
  });

  it("maxIndexInDay: n-1 en el día de origen, n en cualquier otro", () => {
    expect(maxIndexInDay([3, 2], day(0, 1), 0)).toBe(2);
    expect(maxIndexInDay([3, 2], day(0, 1), 1)).toBe(2);
    expect(maxIndexInDay([3, 0], day(0, 1), 1)).toBe(0);
    expect(maxIndexInDay([3, 2], UN, 0)).toBe(3);
  });

  it("clampSlot recorta y cae al origen si el día ya no existe", () => {
    expect(clampSlot([2, 2], day(0, 0), day(1, 99))).toEqual(day(1, 2));
    expect(clampSlot([2, 2], day(0, 0), day(0, 99))).toEqual(day(0, 1));
    expect(clampSlot([2], day(0, 1), day(5, 0))).toEqual(day(0, 1));
    expect(clampSlot([2], day(0, 1), UN)).toEqual(UN);
  });

  it("stepSlot: dentro del día, primero→último y último→primero", () => {
    const counts = [3];
    let slot: StopSlot = day(0, 0);
    slot = stepSlot(counts, day(0, 0), slot, 1);
    slot = stepSlot(counts, day(0, 0), slot, 1);
    expect(slot).toEqual(day(0, 2));
    expect(stepSlot(counts, day(0, 0), day(0, 2), -1)).toEqual(day(0, 1));
    expect(stepSlot(counts, day(0, 0), day(0, 0), -1)).toEqual(day(0, 0)); // sin día previo: no-op
  });

  it("stepSlot cruza días por el extremo cercano y salta días vacíos sin perderse", () => {
    const counts = [2, 0, 2];
    expect(stepSlot(counts, day(0, 0), day(0, 1), 1)).toEqual(day(1, 0));
    expect(stepSlot(counts, day(0, 0), day(1, 0), 1)).toEqual(day(2, 0));
    expect(stepSlot(counts, day(0, 0), day(2, 0), -1)).toEqual(day(1, 0));
    expect(stepSlot(counts, day(0, 0), day(1, 0), -1)).toEqual(day(0, 1));
  });

  it("stepSlot: hacia abajo desde el último día va a Sin asignar y vuelve con ↑", () => {
    const counts = [2];
    expect(stepSlot(counts, day(0, 0), day(0, 1), 1)).toEqual(UN);
    expect(stepSlot(counts, day(0, 0), UN, -1)).toEqual(day(0, 1));
    expect(stepSlot(counts, UN, day(0, 2), 1)).toEqual(day(0, 2)); // un sitio sin asignar no se «queda» ahí
    expect(stepSlot(counts, UN, UN, 1)).toEqual(UN);
  });

  it("isSameSlot / describeSlot", () => {
    expect(isSameSlot(day(0, 1), day(0, 1))).toBe(true);
    expect(isSameSlot(day(0, 1), day(1, 1))).toBe(false);
    expect(isSameSlot(UN, UN)).toBe(true);
    expect(isSameSlot(UN, day(0, 0))).toBe(false);
    expect(describeSlot([3, 2], day(0, 0), day(0, 2))).toBe("Día 1, posición 3 de 3");
    expect(describeSlot([3, 2], day(0, 0), day(1, 2))).toBe("Día 2, posición 3 de 3");
    expect(describeSlot([3, 2], day(0, 0), UN)).toBe("Sin asignar");
  });
});
