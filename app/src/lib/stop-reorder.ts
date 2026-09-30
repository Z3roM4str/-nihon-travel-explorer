/**
 * B28 (B9.2) — the pure geometry-free half of stop reordering.
 *
 * A stop is carried from an ORIGIN (a slot in a day, or «Sin asignar») to a TARGET slot. Indices
 * are FINAL coordinates (see `withPlaceMovedToPosition`): inside the origin day the target index
 * is where the stop ends (0…n-1); in any other day it is 0…n (`n` = the end). Pointer and keyboard
 * both produce these same slots, and both commit through the same draft mutations — there is no
 * second, drag-only structure.
 */

export type StopSlot = { kind: "day"; dayIndex: number; index: number } | { kind: "unassigned" };

/** Where the carried stop started. `unassigned` = it is a saved place that is in no day. */
export type StopOrigin = StopSlot;

export function isSameSlot(a: StopSlot, b: StopSlot): boolean {
  if (a.kind === "unassigned" || b.kind === "unassigned") return a.kind === b.kind;
  return a.dayIndex === b.dayIndex && a.index === b.index;
}

/** Highest legal final index in `dayIndex` for a stop that started at `origin`. */
export function maxIndexInDay(counts: readonly number[], origin: StopOrigin, dayIndex: number): number {
  const count = counts[dayIndex] ?? 0;
  return origin.kind === "day" && origin.dayIndex === dayIndex ? Math.max(0, count - 1) : count;
}

/** Clamps a slot into what the current days can accept; unknown days fall back to the origin. */
export function clampSlot(counts: readonly number[], origin: StopOrigin, slot: StopSlot): StopSlot {
  if (slot.kind === "unassigned") return slot;
  if (slot.dayIndex < 0 || slot.dayIndex >= counts.length) return origin;
  const max = maxIndexInDay(counts, origin, slot.dayIndex);
  return { kind: "day", dayIndex: slot.dayIndex, index: Math.min(Math.max(0, slot.index), max) };
}

/**
 * Pointer: the final index inside a day is how many OTHER stops sit above the pointer, judged by
 * each stop's vertical midpoint (the dragged stop's own midpoint is excluded by the caller).
 */
export function insertionIndex(midpoints: readonly number[], pointerY: number): number {
  let index = 0;
  for (const mid of midpoints) if (mid < pointerY) index += 1;
  return index;
}

/**
 * Keyboard: one step up (`-1`) or down (`1`) through the whole plan read as one list —
 * day 1 stops, day 2 stops … then «Sin asignar». Crossing a day edge enters the neighbouring day at
 * its near end; going down past the last day of a placed stop lands in «Sin asignar»; a stop that
 * came from «Sin asignar» can never be stepped back into it (it is not a slot it may «keep»),
 * except by going up from the first slot, which is a no-op.
 */
export function stepSlot(
  counts: readonly number[],
  origin: StopOrigin,
  slot: StopSlot,
  direction: -1 | 1
): StopSlot {
  if (counts.length === 0) return slot;
  if (slot.kind === "unassigned") {
    if (direction === 1) return slot;
    const last = counts.length - 1;
    return { kind: "day", dayIndex: last, index: maxIndexInDay(counts, origin, last) };
  }
  const max = maxIndexInDay(counts, origin, slot.dayIndex);
  const next = slot.index + direction;
  if (next >= 0 && next <= max) return { kind: "day", dayIndex: slot.dayIndex, index: next };
  if (direction === -1) {
    if (slot.dayIndex === 0) return slot;
    const dayIndex = slot.dayIndex - 1;
    return { kind: "day", dayIndex, index: maxIndexInDay(counts, origin, dayIndex) };
  }
  if (slot.dayIndex < counts.length - 1) return { kind: "day", dayIndex: slot.dayIndex + 1, index: 0 };
  return origin.kind === "day" ? { kind: "unassigned" } : slot;
}

/**
 * The ghost is drawn centred above the pointer, at most 16rem (256px) wide and never wider than the
 * viewport minus a 16px margin: keep its centre where the whole card stays on screen.
 */
export function clampGhostPoint(x: number, y: number, viewportWidth = window.innerWidth): { x: number; y: number } {
  const half = Math.min(256, viewportWidth - 16) / 2;
  return {
    x: Math.min(Math.max(x, half + 8), Math.max(half + 8, viewportWidth - half - 8)),
    y: Math.max(y, 72),
  };
}

/** «Día 2, posición 1 de 3» / «Sin asignar» — the words the live region uses for a slot. */
export function describeSlot(
  counts: readonly number[],
  origin: StopOrigin,
  slot: StopSlot,
  dayLabel: (dayIndex: number) => string = (dayIndex) => `Día ${dayIndex + 1}`
): string {
  if (slot.kind === "unassigned") return "Sin asignar";
  const total = (counts[slot.dayIndex] ?? 0) + (origin.kind === "day" && origin.dayIndex === slot.dayIndex ? 0 : 1);
  return `${dayLabel(slot.dayIndex)}, posición ${slot.index + 1} de ${total}`;
}
