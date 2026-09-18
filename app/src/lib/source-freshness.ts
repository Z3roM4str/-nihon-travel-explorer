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
 * | `recheck-interval-unknown` | these claims do change, and no rhythm supports an interval |
 *
 * **Block 11 added the fourth, and it is not a synonym of the third.** `no-periodic-recheck` says
 * *relax* — a Shinkansen station does not quietly stop being one. `recheck-interval-unknown` says
 * the opposite: a museum can revise its ticketing rule next Tuesday, so the claim genuinely wants
 * re-reading, and the only honest thing this module can say is that it does not know when. Folding
 * the two together would let an operator's sales policy inherit the reassurance owed to concrete
 * and steel. An interval nobody can derive is left unstated rather than invented — see
 * `provenance-claim-class.ts`, where the two are decided per domain.
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

export type SourceFreshnessState =
  | "current"
  | "needs-recheck"
  | "no-periodic-recheck"
  | "recheck-interval-unknown";

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

/**
 * Block 11 — what governs re-checking one class of claim, as a value rather than a number.
 *
 * Block 10 could express a horizon as `number | null`, because its two answers were "365 days" and
 * "no rhythm exists". Block 11 found a third answer that `null` cannot carry: *these claims change,
 * and nothing in the domain supplies an interval*. Reservation sales rules are exactly that — an
 * operator revises them when it decides to, publishing no cycle a number could be derived from.
 *
 * Collapsing that into `null` would have made a ticketing policy report `no-periodic-recheck`,
 * which tells the reader to relax about the most volatile claims in the dataset. So the absence of
 * a horizon is split into the two things it can mean, and the caller must say which.
 */
export type RecheckHorizon =
  /** A real interval, derived from a real rhythm in the domain. */
  | { kind: "days"; days: number }
  /** Nothing periodic governs these claims. Infrastructure, or a fact bounded by its own dates. */
  | { kind: "none" }
  /** These claims do change, and no evidence supports an interval. Deliberately unautomated. */
  | { kind: "unknown" };

export const HORIZON_NONE: RecheckHorizon = { kind: "none" };
export const HORIZON_UNKNOWN: RecheckHorizon = { kind: "unknown" };

/** A horizon of `days` days. Kept as a constructor so no call site writes the object shape twice. */
export function horizonOfDays(days: number): RecheckHorizon {
  return { kind: "days", days };
}

export type SourceFreshness = {
  state: SourceFreshnessState;
  /** Whole calendar days since the check, or `null` when the date is unusable. */
  ageDays: number | null;
  /** The horizon that governed this verdict, or `null` when none applies. */
  horizonDays: number | null;
};

/**
 * The freshness of one source under an explicit horizon, as of `today`.
 *
 * Block 11's core: the one place a `consultedAt` becomes a verdict, for every system. Domain
 * knowledge arrives as the `horizon` argument and nothing else, so this function never learns what
 * a zone, a gate or a ticket is.
 *
 * A date that is malformed, impossible or in the future yields `needs-recheck` with a null age:
 * the validator refuses all three in the dataset, so reaching them here means something upstream
 * is wrong and the honest answer is "somebody should look", never "this is current".
 *
 * The boundary is inclusive of the horizon: a source checked exactly `horizonDays` ago is still
 * `current`, and becomes `needs-recheck` on the following day. One full cycle has elapsed only
 * once the cycle is over.
 */
export function freshnessForHorizon(
  consultedAt: string,
  horizon: RecheckHorizon,
  today: string
): SourceFreshness {
  const horizonDays = horizon.kind === "days" ? horizon.days : null;

  if (!isValidCivilDate(consultedAt) || !isValidCivilDate(today)) {
    return { state: "needs-recheck", ageDays: null, horizonDays };
  }
  const ageDays = differenceInCivilDays(consultedAt, today);
  if (ageDays === null || ageDays < 0) {
    // A check dated in the future was never made. It is not fresh; it is wrong.
    // This outranks every horizon, `unknown` included: not knowing when to look again is no
    // reason to accept a date that cannot be a date.
    return { state: "needs-recheck", ageDays: null, horizonDays };
  }
  if (horizon.kind === "none") {
    return { state: "no-periodic-recheck", ageDays, horizonDays };
  }
  if (horizon.kind === "unknown") {
    // The age is still reported: it is a fact, and the honest one. What is withheld is the
    // verdict, because no evidence supports one.
    return { state: "recheck-interval-unknown", ageDays, horizonDays };
  }
  return {
    state: ageDays > horizon.days ? "needs-recheck" : "current",
    ageDays,
    horizonDays,
  };
}

/**
 * The freshness of one zone source. Block 10's entry point, unchanged in signature and behaviour.
 *
 * Block 11 reimplemented it on top of `freshnessForHorizon` rather than beside it, so the three
 * systems cannot drift into three readings of the same date. Zone facts reach only `days` and
 * `none`, so no zone source can produce `recheck-interval-unknown` — asserted in the tests.
 */
export function freshnessFor(
  source: Pick<ZoneProvenance, "consultedAt" | "covers">,
  today: string
): SourceFreshness {
  const days = horizonForCovers(source.covers);
  return freshnessForHorizon(
    source.consultedAt,
    days === null ? HORIZON_NONE : horizonOfDays(days),
    today
  );
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
