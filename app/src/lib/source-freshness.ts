import { differenceInCivilDays, isValidCivilDate } from "./civil-date";
import type { ZoneFactArea, ZoneProvenance } from "./accommodation-zone";

/**
 * Block 10 — what `consultedAt` means, and what it means for it to have aged.
 *
 * ## What `consultedAt` is
 *
 * **The civil date on which Nihon opened that source and confirmed it supported the claim beside
 * it.** Not the source's publication date, not the page's last-modified date (operators rarely
 * publish one, and inferring it would be inventing a fact), and not the date the row entered the
 * repository. Blocks 7 and 8 wrote every one of these dates on the day they actually read the page,
 * and each `evidence` string records what the page said — which is what makes this reading the only
 * one the history supports.
 *
 * ## Age is not falsehood
 *
 * An old check does not make a claim wrong. It makes it *unconfirmed since*. Those are different
 * things and this module never conflates them:
 *
 * | state | meaning |
 * |---|---|
 * | `current` | checked within the horizon its claims deserve |
 * | `needs-recheck` | still valid, and due for a look |
 * | `no-periodic-recheck` | nothing periodic governs these claims, so no clock applies |
 *
 * **`unsupported` is deliberately not one of them.** A source stops supporting a claim when
 * somebody reads it and finds it no longer does — that is evidence, not arithmetic, and no
 * function here can produce it. Nothing in this file may ever delete a fact, weaken a claim, or
 * downgrade a tier because a date got old.
 *
 * ## Why the horizon depends on what a source covers
 *
 * The three fact areas have genuinely different volatility, and the dataset shows it:
 *
 * * **`airportLinks`** track *services*: which train or coach runs between a zone and an airport,
 *   and where it stops. Japanese operators revise timetables on an annual cycle, and this dataset
 *   already carries the scar of one such change — Umeda's Haruka platforms, recorded as "desde
 *   2023". A check older than one full cycle has certainly not seen the most recent revision.
 * * **`railLines` and `shinkansen`** are *infrastructure*: which lines serve a station, whether the
 *   Shinkansen stops there. These change when a line opens or closes, which is an announced event
 *   years in the making, not a scheduled revision. Re-reading them on a timer would be theatre: a
 *   calendar cannot tell you a new line opened, and the calendar expiring tells you nothing.
 *
 * So the horizon is **derived from a real domain rhythm, not chosen for roundness**, and where no
 * rhythm exists there is deliberately no horizon at all.
 *
 * ## Determinism
 *
 * Every function takes `today` explicitly and is pure. There is no `new Date()` in this file.
 * Arithmetic goes through `civil-date.ts`, which is whole-day, leap-year-correct and
 * timezone-invariant by construction — a freshness that changed with the reader's timezone would
 * be a bug that only appeared west of UTC.
 */

export type SourceFreshnessState = "current" | "needs-recheck" | "no-periodic-recheck";

/**
 * One Japanese annual timetable-revision cycle, in days.
 *
 * This is the number the domain supplies, not a preference: operators publish revised timetables
 * once a year, so a check older than one cycle has provably not seen the current one. It is a
 * *floor on suspicion*, never a claim that anything changed.
 */
export const TIMETABLE_CYCLE_DAYS = 365;

/**
 * How long a check on each fact area stays current. `null` means no periodic re-check applies.
 *
 * Adding an area here without deciding its rhythm would silently give it the default of whichever
 * branch ran first, so the map is exhaustive by type.
 */
export const RECHECK_HORIZON_DAYS: Readonly<Record<ZoneFactArea, number | null>> = {
  airportLinks: TIMETABLE_CYCLE_DAYS,
  railLines: null,
  shinkansen: null,
};

/**
 * The horizon that governs a source covering several areas: the strictest one that applies.
 *
 * A source is due for a look as soon as *any* claim it carries is due. Returns `null` only when no
 * area it covers has a rhythm at all — which is a real case in this dataset, not a hypothetical:
 * after Block 8 moved Namba's airport link to Nankai's own page, Namba's station article backs
 * `railLines` and `shinkansen` alone.
 */
export function horizonForCovers(covers: readonly ZoneFactArea[]): number | null {
  let strictest: number | null = null;
  for (const area of covers) {
    const horizon = RECHECK_HORIZON_DAYS[area];
    if (horizon === null) continue;
    strictest = strictest === null ? horizon : Math.min(strictest, horizon);
  }
  return strictest;
}

export type SourceFreshness = {
  state: SourceFreshnessState;
  /** Whole calendar days since the check, or `null` when the date is unusable. */
  ageDays: number | null;
  /** The horizon that governed this verdict, or `null` when none applies. */
  horizonDays: number | null;
};

/**
 * The freshness of one source, as of `today`.
 *
 * A date that is malformed, impossible or in the future yields `needs-recheck` with a null age:
 * the validator refuses all three in the dataset, so reaching them here means something upstream
 * is wrong and the honest answer is "somebody should look", never "this is current".
 *
 * The boundary is inclusive of the horizon: a source checked exactly `horizonDays` ago is still
 * `current`, and becomes `needs-recheck` on the following day. One full cycle has elapsed only
 * once the cycle is over.
 */
export function freshnessFor(
  source: Pick<ZoneProvenance, "consultedAt" | "covers">,
  today: string
): SourceFreshness {
  const horizonDays = horizonForCovers(source.covers);

  if (!isValidCivilDate(source.consultedAt) || !isValidCivilDate(today)) {
    return { state: "needs-recheck", ageDays: null, horizonDays };
  }
  const ageDays = differenceInCivilDays(source.consultedAt, today);
  if (ageDays === null || ageDays < 0) {
    // A check dated in the future was never made. It is not fresh; it is wrong.
    return { state: "needs-recheck", ageDays: null, horizonDays };
  }
  if (horizonDays === null) {
    return { state: "no-periodic-recheck", ageDays, horizonDays };
  }
  return {
    state: ageDays > horizonDays ? "needs-recheck" : "current",
    ageDays,
    horizonDays,
  };
}

/** Whether this source is due for a look. Never means the claim is wrong. */
export function needsRecheck(
  source: Pick<ZoneProvenance, "consultedAt" | "covers">,
  today: string
): boolean {
  return freshnessFor(source, today).state === "needs-recheck";
}

/**
 * The sources of one zone that are due for a look, in declaration order.
 *
 * A derived queue, computed on read. Nothing is stored, nothing is scheduled, and nobody is
 * notified: this is the list a person would work through, not a system that works through it.
 */
export function sourcesNeedingRecheck<T extends Pick<ZoneProvenance, "consultedAt" | "covers">>(
  sources: readonly T[],
  today: string
): T[] {
  return sources.filter((source) => needsRecheck(source, today));
}
