const LABELS: Record<string, string> = {
  S: "Imprescindible",
  A: "Muy recomendable",
  B: "Recomendable",
  C: "Opcional",
  D: "Prescindible",
};

export function recommendationLabel(grade: string): string {
  return LABELS[grade] ?? "Sin clasificación";
}

export const RECOMMENDATION_ICONS: Record<string, "star" | "check" | "circle" | "compass" | "minus"> = {
  S: "star", A: "check", B: "circle", C: "compass", D: "minus",
};

export const GRADE_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
