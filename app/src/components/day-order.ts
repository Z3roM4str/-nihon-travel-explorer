/**
 * B29 (B9.3) — pure helpers of the «Probar otro orden» day tool.
 *
 * Nothing here reads the draft, a place or storage. The proposal the reader edits is a plain
 * `string[]` of the day's OWN place ids that lives in component state and is discarded on close.
 * The only thing that ever reaches the draft is the result of `planDayOrderMoves`, replayed through
 * the existing `movePlaceToPosition` (B28) when the reader presses «Usar este orden».
 */

export function moveItemUp<T>(items: readonly T[], index: number): T[] {
  if (index <= 0 || index >= items.length) return [...items];
  const next = [...items];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}

export function moveItemDown<T>(items: readonly T[], index: number): T[] {
  if (index < 0 || index >= items.length - 1) return [...items];
  const next = [...items];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}

export function isSameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** Same ids, no duplicates, only the order may differ. */
export function isPermutationOf(candidate: readonly string[], base: readonly string[]): boolean {
  if (candidate.length !== base.length) return false;
  if (new Set(candidate).size !== candidate.length) return false;
  const known = new Set(base);
  return known.size === base.length && candidate.every((id) => known.has(id));
}

export type DayOrderMove = { from: number; to: number };

/**
 * The single-place moves (final coordinates inside one day, the contract of
 * `withPlaceMovedToPosition`) that turn `current` into `target`. Selection order: position `i` is
 * filled left to right, so a move never disturbs an index already settled. Empty when the order is
 * already equal, and empty (never partial) when `target` is not a permutation of `current`.
 */
export function planDayOrderMoves(current: readonly string[], target: readonly string[]): DayOrderMove[] {
  if (!isPermutationOf(target, current)) return [];
  const working = [...current];
  const moves: DayOrderMove[] = [];
  for (let to = 0; to < target.length; to += 1) {
    const from = working.indexOf(target[to]);
    if (from === to) continue;
    working.splice(to, 0, working.splice(from, 1)[0]);
    moves.push({ from, to });
  }
  return moves;
}
