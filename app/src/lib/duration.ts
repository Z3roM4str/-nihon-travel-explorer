import type { Place } from "../types";

export type MinuteRange = { minMinutes: number; maxMinutes: number };

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const DASH = String.raw`[–—-]`;
const HOUR_UNIT = /^h|hora/i;

/**
 * Durations expressed in days or nights ("Día completo", "1–2 días", "Medio día–1 noche")
 * describe how much of a trip a place takes, not how many minutes a visitor spends on site.
 * Summing them as visit minutes produces absurd totals, so they stay non-numeric and are
 * always shown as their original editorial text.
 */
const MULTI_DAY = /d[ií]as?\b|noches?\b/i;

function toNumber(value: string): number {
  return Number(value.replace(",", "."));
}

/**
 * Reads a minute range out of the editorial duration text. Returns null whenever the text
 * does not contain an unambiguous numeric range — no value is guessed.
 */
export function parseDurationRange(raw: string | undefined): MinuteRange | null {
  const text = (raw ?? "").trim();
  if (!text || MULTI_DAY.test(text)) return null;

  const range = new RegExp(`(${NUMBER})\\s*${DASH}\\s*(${NUMBER})\\s*(min|minutos?|h|horas?)`, "i").exec(text);
  if (range) {
    const factor = HOUR_UNIT.test(range[3]) ? 60 : 1;
    return {
      minMinutes: Math.round(toNumber(range[1]) * factor),
      maxMinutes: Math.round(toNumber(range[2]) * factor),
    };
  }

  const single = new RegExp(`^(${NUMBER})\\s*(min|minutos?|h|horas?)$`, "i").exec(text);
  if (single) {
    const factor = HOUR_UNIT.test(single[2]) ? 60 : 1;
    const value = Math.round(toNumber(single[1]) * factor);
    return { minMinutes: value, maxMinutes: value };
  }

  return null;
}

/**
 * Resolves the visit-time range for a place. Prefers the values normalized by the export
 * pipeline and falls back to re-reading `duration.raw`, which recovers ranges the exporter
 * misses (decimal hours such as "1.5–2.5 h").
 */
export function resolveDuration(duration: Place["duration"]): MinuteRange | null {
  if (MULTI_DAY.test(duration.raw ?? "")) return null;
  if (typeof duration.minMinutes === "number" && typeof duration.maxMinutes === "number") {
    return { minMinutes: duration.minMinutes, maxMinutes: duration.maxMinutes };
  }
  return parseDurationRange(duration.raw);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function formatRange(range: MinuteRange): string {
  if (range.minMinutes === range.maxMinutes) return formatMinutes(range.minMinutes);
  return `${formatMinutes(range.minMinutes)}–${formatMinutes(range.maxMinutes)}`;
}
