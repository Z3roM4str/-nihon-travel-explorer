import type { MinuteRange } from "./duration";
import { resolveDuration } from "./duration";
import type { Place } from "../types";

/**
 * Planning blocks: a derived, deterministic reading of a place's editorial duration.
 *
 * The dataset's durations come in two irreconcilable families. Most are quantified ranges
 * ("2–4 h") that can be added up. The rest are day-scale editorial commitments ("Día
 * completo", "1–2 noches") that describe how much of a trip a place takes, not how long a
 * visitor stands in it. Converting the second family into minutes would produce a number
 * that looks precise and means nothing, so the two never mix: `blockKind` decides which
 * side a block falls on, and only "quantified" blocks are ever summed.
 *
 * Nothing here is persisted. Blocks are recomputed from `duration` on every read, so
 * refreshing the workbook is enough to change them.
 */
export type PlanningBlock =
  | "brief"
  | "short"
  | "medium"
  | "long"
  | "half-day"
  | "half-to-full-day"
  | "full-day"
  | "overnight-plus"
  | "unknown";

export type BlockKind = "quantified" | "day-scale" | "unknown";

/**
 * Upper bounds, in minutes, of the quantified blocks. A place is labelled by the block its
 * **maximum** falls in — "reserve up to this much" — because that is the reading a person
 * planning a day needs. The label is always shown next to the original range, never alone:
 * 81% of the dataset's ranges cross one of these boundaries, so the label orients and the
 * range remains the data.
 */
const BRIEF_MAX_MINUTES = 60;
const SHORT_MAX_MINUTES = 120;
const MEDIUM_MAX_MINUTES = 240;

/** Half-open (low, high] windows used for filter overlap. `long` is unbounded above. */
const BLOCK_WINDOWS: Partial<Record<PlanningBlock, { low: number; high: number }>> = {
  brief: { low: 0, high: BRIEF_MAX_MINUTES },
  short: { low: BRIEF_MAX_MINUTES, high: SHORT_MAX_MINUTES },
  medium: { low: SHORT_MAX_MINUTES, high: MEDIUM_MAX_MINUTES },
  long: { low: MEDIUM_MAX_MINUTES, high: Number.POSITIVE_INFINITY },
};

/** Order used everywhere blocks are listed, from shortest commitment to largest. */
export const PLANNING_BLOCKS: PlanningBlock[] = [
  "brief",
  "short",
  "medium",
  "long",
  "half-day",
  "half-to-full-day",
  "full-day",
  "overnight-plus",
  "unknown",
];

const BLOCK_LABELS: Record<PlanningBlock, string> = {
  brief: "Visita breve",
  short: "Bloque corto",
  medium: "Bloque medio",
  long: "Bloque largo",
  "half-day": "Media jornada",
  "half-to-full-day": "Media a jornada completa",
  "full-day": "Jornada completa",
  "overnight-plus": "Pernocta o más",
  unknown: "Sin estimación",
};

/** Shown beside the label in the filter so the mapping is learnable, not guessed. */
const BLOCK_HINTS: Partial<Record<PlanningBlock, string>> = {
  brief: "hasta 1 h",
  short: "1–2 h",
  medium: "2–4 h",
  long: "más de 4 h",
};

const NIGHTS = /noches?\b/i;
const DAYS = /d[ií]as?\b/i;
const HALF_DAY = /medio\s+d[ií]a/i;
const FULL_DAY = /d[ií]a\s+completo/i;

export function planningBlockLabel(block: PlanningBlock): string {
  return BLOCK_LABELS[block];
}

export function planningBlockHint(block: PlanningBlock): string | null {
  return BLOCK_HINTS[block] ?? null;
}

/**
 * Whether a block's places may be added to an hour total. Day-scale blocks never can —
 * they are counted and listed, not summed.
 */
export function blockKind(block: PlanningBlock): BlockKind {
  switch (block) {
    case "brief":
    case "short":
    case "medium":
    case "long":
      return "quantified";
    case "half-day":
    case "half-to-full-day":
    case "full-day":
    case "overnight-plus":
      return "day-scale";
    default:
      return "unknown";
  }
}

function quantifiedBlock(range: MinuteRange): PlanningBlock {
  if (range.maxMinutes <= BRIEF_MAX_MINUTES) return "brief";
  if (range.maxMinutes <= SHORT_MAX_MINUTES) return "short";
  if (range.maxMinutes <= MEDIUM_MAX_MINUTES) return "medium";
  return "long";
}

/**
 * Classifies the editorial day-scale texts. Order matters: anything mentioning nights or a
 * plural/ranged count of days is the largest commitment and wins, so "Día completo–2 noches"
 * is an overnight stay rather than a full day.
 */
function dayScaleBlock(raw: string): PlanningBlock {
  if (NIGHTS.test(raw)) return "overnight-plus";
  // "1–2 días" / "Día completo–2 días": plural days, more than "día completo" describes.
  if (/\bd[ií]as\b/i.test(raw)) return "overnight-plus";
  if (HALF_DAY.test(raw) && FULL_DAY.test(raw)) return "half-to-full-day";
  if (FULL_DAY.test(raw)) return "full-day";
  if (HALF_DAY.test(raw)) return "half-day";
  return "unknown";
}

/**
 * The single classification entry point. A duration that resolves to a numeric range is
 * labelled by its upper bound; anything expressed in days or nights keeps its editorial
 * meaning and is never converted to minutes.
 */
export function classifyPlanningBlock(duration: Place["duration"]): PlanningBlock {
  const range = resolveDuration(duration);
  if (range) return quantifiedBlock(range);

  const raw = (duration.raw ?? "").trim();
  if (!raw) return "unknown";
  if (!DAYS.test(raw) && !NIGHTS.test(raw)) return "unknown";
  return dayScaleBlock(raw);
}

/**
 * Filter matching, which is deliberately **not** "has this label".
 *
 * A quantified place matches a quantified block when its range overlaps the block's window,
 * so "1–2 h" is offered both to someone with an hour free and to someone with two. Matching
 * on the label alone would hide places whose lower bound fits the hole the user actually
 * has. Day-scale blocks carry no minutes, so they match by identity only, and the two
 * families never match across.
 */
export function matchesPlanningBlock(duration: Place["duration"], block: PlanningBlock): boolean {
  const window = BLOCK_WINDOWS[block];
  if (!window) return classifyPlanningBlock(duration) === block;

  const range = resolveDuration(duration);
  if (!range) return false;
  return range.minMinutes <= window.high && range.maxMinutes > window.low;
}

/** OR semantics across selected blocks, matching the other multi-value filters. */
export function matchesAnyPlanningBlock(
  duration: Place["duration"],
  blocks: PlanningBlock[]
): boolean {
  if (blocks.length === 0) return true;
  return blocks.some((block) => matchesPlanningBlock(duration, block));
}

/**
 * The blocks worth offering as filter options for a set of durations: those that would
 * actually return something.
 *
 * This must ask the same question the filter answers, so it uses `matchesPlanningBlock`
 * rather than the display classification. A place labelled "short" also overlaps "brief",
 * and offering only its label would hide a block that has results — the classification says
 * how much to reserve, the filter says what can fit.
 */
export function availablePlanningBlocks(
  durations: Array<Place["duration"]>
): PlanningBlock[] {
  return PLANNING_BLOCKS.filter((block) =>
    durations.some((duration) => matchesPlanningBlock(duration, block))
  );
}
