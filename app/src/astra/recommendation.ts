const LABELS: Record<string, string> = {
  S: "Imprescindible",
  A: "Muy recomendado",
  B: "Recomendado",
  C: "Vale la pena si encaja",
  D: "Interés específico",
};

export function recommendationLabel(grade: string): string {
  return LABELS[grade] ?? "Sin valoración editorial";
}

export const GRADE_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
