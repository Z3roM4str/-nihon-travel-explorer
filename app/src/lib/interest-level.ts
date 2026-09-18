import type { Place } from "../types";

/**
 * Plain-language interest ladder.
 *
 * The dataset records editorial quality as a single-letter `grade` (S/A/B/C/D). That letter is
 * precise for research and meaningless to a first-time reader: "Grado B" says nothing about
 * whether a place is worth an afternoon. This module is the one place that translates the
 * letter into the language a traveller actually thinks in, and it is deliberately a pure
 * mapping — the grade stays the source of truth, nothing is re-ranked, and no place changes
 * meaning.
 *
 * Accessibility: every descriptor carries a `label`, a `shortLabel` and a `glyph` as well as a
 * CSS class. Colour is never the only carrier of the level — the label is always rendered, and
 * the glyphs differ in shape (filled → hollow → dash), not merely in hue, so the ladder survives
 * greyscale, colour-blindness and high-contrast modes.
 */
export type InterestLevel =
  | "imprescindible"
  | "muy-recomendable"
  | "recomendable"
  | "opcional"
  | "prescindible";

export type InterestLevelDescriptor = {
  /** Stable machine key, safe for CSS modifiers and test assertions. */
  level: InterestLevel;
  /** The dataset grade this level translates. */
  grade: string;
  /** Full label, e.g. "Muy recomendable". */
  label: string;
  /** Compact label for dense surfaces (cards, chips). */
  shortLabel: string;
  /** Non-colour shape signal. Decorative: always paired with the label in the UI. */
  glyph: string;
  /** 1 = highest interest. Sorting and comparison use this, never the letter. */
  rank: number;
  /** One sentence a first-time reader can act on. */
  description: string;
};

/**
 * Ordered highest interest first. The five levels are exactly the five grades the catalogue
 * uses; `App.tsx` builds its filter vocabulary from the same letters, and `App.test.ts` fails
 * if a catalogue grade ever escapes that vocabulary.
 */
export const INTEREST_LEVELS: readonly InterestLevelDescriptor[] = [
  {
    level: "imprescindible",
    grade: "S",
    label: "Imprescindible",
    shortLabel: "Imprescindible",
    glyph: "★",
    rank: 1,
    description: "De lo mejor del viaje. Si cabe una sola cosa en el día, que sea esta.",
  },
  {
    level: "muy-recomendable",
    grade: "A",
    label: "Muy recomendable",
    shortLabel: "Muy recomend.",
    glyph: "◆",
    rank: 2,
    description: "Vale mucho la pena. La mayoría de los días deberían llevar una de estas.",
  },
  {
    level: "recomendable",
    grade: "B",
    label: "Recomendable",
    shortLabel: "Recomendable",
    glyph: "●",
    rank: 3,
    description: "Buena parada si queda de paso o si el tema os interesa.",
  },
  {
    level: "opcional",
    grade: "C",
    label: "Opcional",
    shortLabel: "Opcional",
    glyph: "○",
    rank: 4,
    description: "Solo si sobra tiempo o si es justo vuestro tipo de plan.",
  },
  {
    level: "prescindible",
    grade: "D",
    label: "Prescindible",
    shortLabel: "Prescindible",
    glyph: "–",
    rank: 5,
    description: "Se puede saltar sin perderse nada importante.",
  },
] as const;

const BY_GRADE: Record<string, InterestLevelDescriptor> = Object.fromEntries(
  INTEREST_LEVELS.map((descriptor) => [descriptor.grade, descriptor])
);

/**
 * Fallback for a grade the ladder does not know. It deliberately keeps the unknown letter
 * visible instead of silently promoting or demoting the place: an unmapped grade is a data
 * event the reader should be able to see, not one the UI should paper over.
 */
function unknownLevel(grade: string): InterestLevelDescriptor {
  return {
    level: "recomendable",
    grade,
    label: `Grado ${grade}`,
    shortLabel: `Grado ${grade}`,
    glyph: "●",
    rank: 3,
    description: "Nivel de interés sin traducción editorial todavía.",
  };
}

export function interestLevelForGrade(grade: string): InterestLevelDescriptor {
  return BY_GRADE[grade] ?? unknownLevel(grade);
}

export function interestLevelForPlace(place: Pick<Place, "grade">): InterestLevelDescriptor {
  return interestLevelForGrade(place.grade);
}

/** Highest interest first; ties keep their incoming order. */
export function compareByInterest(a: Pick<Place, "grade">, b: Pick<Place, "grade">): number {
  return interestLevelForPlace(a).rank - interestLevelForPlace(b).rank;
}

/**
 * Tourism saturation is a *separate* axis from interest, and conflating them would misreport
 * the dataset: a place can be both imprescindible and extremely crowded. It is surfaced as its
 * own caution chip so "excesivamente turístico" reads as a warning about the visit, never as a
 * downgrade of the place's quality.
 */
export type TourismCaution = { label: string; level: "extremo" | "alto" };

export function tourismCaution(place: Pick<Place, "tourismLevel">): TourismCaution | null {
  if (place.tourismLevel === "Extremo") return { label: "Muy turístico", level: "extremo" };
  if (place.tourismLevel === "Alto") return { label: "Turístico", level: "alto" };
  return null;
}
