/** Resolve a raw insertion slot to the zero-based position used by the drop mutation. */
export function resolveFinalPosition(
  sourceDayId: string | null,
  targetDayId: string,
  sourceIndex: number,
  rawTargetSlot: number,
): number {
  return sourceDayId !== null && sourceDayId === targetDayId && rawTargetSlot > sourceIndex
    ? rawTargetSlot - 1
    : rawTargetSlot;
}
