import type { SequenceComparison } from "./sequence-comparison";

export type DayOrderComparisonText = {
  kind: "result" | "error";
  headline: string;
  detail: string | null;
};

/** Presentation for the local sheet: candidate A is the captured current order, B the proposal. */
export function dayOrderComparisonResultText(
  comparison: SequenceComparison
): DayOrderComparisonText {
  switch (comparison.outcome) {
    case "a-clearly-faster":
      return {
        kind: "result",
        headline: "Entre estos dos órdenes, el orden actual tiene menor tiempo de traslado.",
        detail: null,
      };
    case "b-clearly-faster":
      return {
        kind: "result",
        headline: "Entre estos dos órdenes, la propuesta tiene menor tiempo de traslado.",
        detail: null,
      };
    case "equivalent":
      return {
        kind: "result",
        headline: "Los traslados conocidos de ambos órdenes son iguales.",
        detail: null,
      };
    case "overlapping":
      return {
        kind: "result",
        headline: "No hay una diferencia clara con los datos disponibles.",
        detail: "Los rangos de traslado de ambos órdenes se superponen.",
      };
    case "incomplete":
      return {
        kind: "result",
        headline: "Comparación incompleta: faltan traslados registrados.",
        detail: "Con los traslados desconocidos no se declara un ganador.",
      };
    case "invalid":
      return {
        kind: "error",
        headline: "No se puede comparar esta propuesta.",
        detail: "El orden actual y la propuesta no contienen exactamente los mismos lugares.",
      };
  }
}

/** Move one item to a final, 0-based position. The caller owns the ephemeral proposal state. */
export function movePlaceToPosition<T>(
  values: readonly T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= values.length ||
    toIndex >= values.length
  ) return [...values];
  if (fromIndex === toIndex) return [...values];
  const next = [...values];
  const [placeId] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, placeId);
  return next;
}

export function hasSamePlaceOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((placeId, index) => placeId === b[index]);
}

/** Equality of sets is only valid for duplicate-free orders. */
export function isPlaceOrderPermutation(
  baselineIds: readonly string[],
  candidateIds: readonly string[]
): boolean {
  if (baselineIds.length !== candidateIds.length) return false;
  const baseline = new Set(baselineIds);
  const candidate = new Set(candidateIds);
  if (baseline.size !== baselineIds.length || candidate.size !== candidateIds.length) return false;
  return candidateIds.every((placeId) => baseline.has(placeId));
}
