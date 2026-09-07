/**
 * Phase 3C-E — Manual Calendar Anchoring: pure civil-date (calendar date, no time-of-day, no
 * timezone) helpers for a `YYYY-MM-DD` string.
 *
 * This module is deliberately tiny and deliberately dumb: it converts between a stable,
 * locale-independent storage string and a display string, and offsets that string by a whole
 * number of calendar days. It does not know about places, schedules, opening hours, or trips —
 * see `planning-draft.ts` for where a date is actually attached to a plan.
 *
 * The one real hazard here is timezone: `new Date("2027-02-19")` parses as UTC midnight, so
 * reading it back with local getters (`.getDate()`, `.getMonth()`, ...) or formatting it without
 * an explicit `timeZone` reinterprets that instant in the *browser's* local timezone — in any
 * timezone west of UTC (e.g. UTC-12), that silently shows the *previous* civil day. Every
 * function below reads/writes calendar components with `Date.UTC(...)`/`getUTC*` exclusively
 * and passes `timeZone: "UTC"` to `Intl.DateTimeFormat`, so the civil date a user picked is the
 * civil date they see, regardless of which timezone the browser happens to be running in.
 */

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type CivilDateParts = { year: number; month: number; day: number };

function parseParts(iso: string): CivilDateParts | null {
  const match = CIVIL_DATE_PATTERN.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatParts(year: number, month: number, day: number): string {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Whether `iso` is both `YYYY-MM-DD`-shaped AND a real calendar date — rejects malformed shapes
 * (wrong separators, wrong field order, non-numeric) and impossible dates alike (`2027-02-30`,
 * `2027-13-01`), including leap-year correctness (`2028-02-29` valid, `2027-02-29` invalid).
 *
 * The check is a round-trip: build a UTC timestamp from the claimed components, then read the
 * components back. A generous month/day range collapses "day 30 of February" into "March 2" —
 * if that doesn't match what was claimed, the input named a date that does not exist.
 */
export function isValidCivilDate(iso: string): boolean {
  const parts = parseParts(iso);
  if (!parts) return false;
  const { year, month, day } = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const timestamp = Date.UTC(year, month - 1, day);
  const check = new Date(timestamp);
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

/**
 * `iso` shifted by `offsetDays` calendar days (may be negative), correctly rolling over month
 * and year boundaries. Returns `null` for an `iso` that is not itself a valid civil date —
 * callers are expected to validate (e.g. via `isValidCivilDate`, or by only ever calling this
 * with a date `withStartDate` already accepted) before relying on the offset.
 */
export function addCivilDays(iso: string, offsetDays: number): string | null {
  const parts = parseParts(iso);
  if (!parts || !isValidCivilDate(iso)) return null;
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offsetDays));
  return formatParts(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/**
 * A short, human-readable rendering of `iso` — e.g. "vie, 19 feb 2027" — for display only; never
 * round-tripped back into storage. Weekday/month names come from `Intl.DateTimeFormat` rather
 * than a hand-maintained Spanish weekday table, so this always agrees with the rest of the
 * platform's Spanish locale data. Returns `iso` unchanged if it is not a valid civil date, so a
 * caller never has to guard twice.
 */
export function formatCivilDateDisplay(iso: string, locale: string = "es"): string {
  const parts = parseParts(iso);
  if (!parts || !isValidCivilDate(iso)) return iso;
  const asUtcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(asUtcDate);
}

/**
 * Phase 3D-B — the closed weekday vocabulary this module (and anything built on it) uses. Named
 * in English/lowercase deliberately, so it stays a stable, locale-independent identifier — all
 * Spanish-language weekday text stays a *display* concern (`formatCivilDateDisplay`, or a
 * consumer's own label table), never this type.
 */
export type CivilWeekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

/** `Date.prototype.getUTCDay()`'s own index convention (0 = Sunday … 6 = Saturday) — not
 * reinvented here, just named. */
const WEEKDAY_BY_UTC_DAY_INDEX: readonly CivilWeekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * The civil weekday `iso` falls on, or `null` when `iso` is not itself a valid civil date —
 * never a guess. Reads the calendar component with `Date.UTC(...)`/`getUTCDay()` exclusively,
 * exactly like every other function in this module, so the result is timezone-invariant: the
 * weekday of the date the user picked never depends on the browser's local timezone.
 *
 * This module knows dates and weekdays only — it has no notion of a `Place`, a closure, or any
 * other business rule. See `app/src/lib/temporal-availability.ts` for where a weekday is first
 * combined with anything place-specific.
 */
export function getCivilWeekday(iso: string): CivilWeekday | null {
  const parts = parseParts(iso);
  if (!parts || !isValidCivilDate(iso)) return null;
  const asUtcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return WEEKDAY_BY_UTC_DAY_INDEX[asUtcDate.getUTCDay()];
}
