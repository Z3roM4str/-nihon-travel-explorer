import type { CivilWeekday } from "./civil-date";
import { getCivilWeekday } from "./civil-date";
import { normalizeText } from "./place";

/**
 * Phase 3D-B — Weekday Closure Signals.
 *
 * The first RUNTIME consumer of Phase 3D-A's audit contract (`docs/TEMPORAL_DATA_CONTRACT.md`,
 * `scripts/temporal_data_lib.py`). This module answers exactly one narrow question:
 *
 *   "Does the weekday of a user-chosen civil date match a candidate recurring weekday closure
 *   recorded in `place.schedule.closures`?"
 *
 * It is deliberately NOT an opening-hours solver. It never reads `place.schedule.hours` or
 * `place.bestTime`, never merges `place.febMar2027` into a closure judgment, and never claims a
 * place is "open," "closed," "compatible," or that a day "works" — see `assessWeekdayClosure`'s
 * own doc for the exact closed vocabulary this module is allowed to produce.
 *
 * **Parity with Phase 3D-A is load-bearing, not incidental.** `interpretClosureText` below is a
 * direct TypeScript port of `scripts/temporal_data_lib.py`'s `classify_closures()` — same
 * category names, same priority order, same SAFE/PARTIAL/OPAQUE/UNKNOWN tier per category. This
 * is a deliberately partial port: only the `schedule.closures` taxonomy is reproduced here (not
 * `schedule.hours`, not `bestTime`, not `febMar2027` — those stay exactly as opaque/unparsed as
 * Phase 3D-A left them). The Python audit is the ceiling this module must never exceed: nothing
 * here may reinterpret an OPAQUE or UNKNOWN Python category as a stronger runtime fact just
 * because a weekday token happens to be extractable from the text with JavaScript's regex engine
 * too.
 */

export type TemporalTier = "safe" | "partial" | "opaque" | "unknown";

/**
 * The closed set of `schedule.closures` pattern families this module distinguishes — a strict
 * subset of `scripts/temporal_data_lib.py`'s `CLOSURES_TIER` keys, reproduced here only because
 * `ClosureFact.category` needs to name exactly which one produced a given fact (for tests that
 * assert parity, and so a future phase auditing this module can trace a runtime fact back to its
 * Python-audit family without re-deriving the mapping).
 */
export type ClosureCategory =
  | "missing"
  | "no-known-closure"
  | "no-known-closure-with-caveat"
  | "weather-or-tide-dependent"
  | "recurring-weekday-named"
  | "irregular-weekday-pattern"
  | "temporary-specific-closure"
  | "third-party-operator-dependent"
  | "scheduled-but-unspecified"
  | "explicit-unknown-variable"
  | "qualitative-uncategorized";

/** Exact mirror of `scripts/temporal_data_lib.py`'s `CLOSURES_TIER`. Covered by a parity test
 * against representative real-dataset examples — see `temporal-availability.test.ts`. */
const CLOSURE_CATEGORY_TIER: Record<ClosureCategory, TemporalTier> = {
  missing: "unknown",
  "no-known-closure": "safe",
  "no-known-closure-with-caveat": "partial",
  "weather-or-tide-dependent": "opaque",
  "recurring-weekday-named": "partial",
  "irregular-weekday-pattern": "opaque",
  "temporary-specific-closure": "opaque",
  "third-party-operator-dependent": "opaque",
  "scheduled-but-unspecified": "unknown",
  "explicit-unknown-variable": "unknown",
  "qualitative-uncategorized": "unknown",
};

/**
 * The only three shapes a closure interpretation can take. `raw` is carried on every variant —
 * Phase 3D-A's contract rule 1 ("raw editorial data is authoritative and is preserved exactly
 * as-is") applies here too; nothing derived here ever replaces or hides the source text.
 *
 * A `"no-known-closure"` fact is the only SAFE one. A `"candidate-weekday"` fact is always
 * PARTIAL — the weekday(s) are a safe, extractable part, but this dataset's own text (e.g.
 * "verificar") never asserts the closure with SAFE-tier confidence, exactly as
 * `docs/TEMPORAL_DATA_CONTRACT.md` §2 records. Everything else — including a "no ordinary
 * closure, but…" caveat, weather/tide/third-party dependence, an irregular weekday-flavored
 * pattern like "Muchos domingos", or genuinely unknown/missing text — collapses into
 * `"not-evaluable"`: for THIS phase's narrow purpose (a weekday match, nothing else), none of
 * those categories can ever produce a usable candidate weekday, so there is no behavioral reason
 * to keep them distinct at this layer. `category` is kept on the fact so a caller/test can still
 * see exactly which Python-audit family produced it.
 */
export type ClosureFact =
  | { kind: "no-known-closure"; tier: "safe"; category: "no-known-closure"; raw: string }
  | {
      kind: "candidate-weekday";
      tier: "partial";
      category: "recurring-weekday-named";
      /** One or more named weekdays extracted from `raw`, in a fixed Sunday→Saturday order —
       * never the text's own order, so output is deterministic regardless of phrasing. Almost
       * always length 1 in the current dataset; a raw string can legitimately name more than
       * one (e.g. "Lunes, viernes y actos; verificar"). */
      weekdays: readonly CivilWeekday[];
      raw: string;
    }
  | {
      kind: "not-evaluable";
      tier: Exclude<TemporalTier, "safe">;
      category: Exclude<ClosureCategory, "no-known-closure" | "recurring-weekday-named">;
      raw: string;
    };

const WEEKDAY_ORDER: readonly CivilWeekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Accent-insensitive weekday tokens, matched against `normalizeText(raw)` (NFD-stripped,
 * lowercased — the same normalization `matchesQuery`'s search already relies on), so
 * "miércoles"/"Miercoles" and "sábado"/"Sabado" are recognised identically without hand-rolled
 * character classes. Mirrors `scripts/temporal_data_lib.py`'s `_WEEKDAY_RE` token set exactly. */
const WEEKDAY_TOKENS: ReadonlyArray<{ token: RegExp; weekday: CivilWeekday }> = [
  { token: /lunes/, weekday: "monday" },
  { token: /martes/, weekday: "tuesday" },
  { token: /miercoles/, weekday: "wednesday" },
  { token: /jueves/, weekday: "thursday" },
  { token: /viernes/, weekday: "friday" },
  { token: /sabado/, weekday: "saturday" },
  { token: /domingo/, weekday: "sunday" },
];

function weekdaysIn(normalized: string): CivilWeekday[] {
  const found = new Set<CivilWeekday>();
  for (const { token, weekday } of WEEKDAY_TOKENS) {
    if (token.test(normalized)) found.add(weekday);
  }
  return WEEKDAY_ORDER.filter((weekday) => found.has(weekday));
}

// Mirrors scripts/temporal_data_lib.py's closure regexes exactly (same word lists, same
// priority order in classifyClosureCategory below), matched against accent-stripped lowercase
// text so no character-class juggling is needed for "clima"/"tifón", "según", etc.
const ENV_RE = /clima|tifon|mal tiempo|oleaje|meteorologic|marea|viento/;
const IRREGULAR_QUALIFIER_RE = /muchos|variable/;
const TEMP_SPECIFIC_RE = /festival|montaje|fin de ano|exposicion|\d{1,2}\s*[-–—]\s*\d{1,2}\s*dic/;
const THIRDPARTY_RE = /segun\s+(el\s+|la\s+)?(comercio|local|tienda|taller|productor|edificio|bar)\b/;
const SCHEDULED_UNSPEC_RE = /program|puntual|mantenimiento/;

/**
 * Classifies `raw` into exactly one `ClosureCategory`, via the same ordered priority chain as
 * `scripts/temporal_data_lib.py`'s `classify_closures()`. Kept as its own function (rather than
 * inlined into `interpretClosureText`) so a parity test can assert on the category name alone,
 * independent of how `ClosureFact` chooses to fold categories together.
 */
function classifyClosureCategory(raw: string): ClosureCategory {
  const text = raw.trim();
  if (!text) return "missing";
  const normalized = normalizeText(text);
  if (normalized.startsWith("sin cierre")) {
    return text.includes(";") ? "no-known-closure-with-caveat" : "no-known-closure";
  }
  if (ENV_RE.test(normalized)) return "weather-or-tide-dependent";
  if (weekdaysIn(normalized).length > 0) {
    return IRREGULAR_QUALIFIER_RE.test(normalized) ? "irregular-weekday-pattern" : "recurring-weekday-named";
  }
  if (TEMP_SPECIFIC_RE.test(normalized)) return "temporary-specific-closure";
  if (THIRDPARTY_RE.test(normalized)) return "third-party-operator-dependent";
  if (SCHEDULED_UNSPEC_RE.test(normalized)) return "scheduled-but-unspecified";
  if (IRREGULAR_QUALIFIER_RE.test(normalized)) return "explicit-unknown-variable";
  return "qualitative-uncategorized";
}

/**
 * The single entry point this module offers for turning raw `place.schedule.closures` text into
 * a `ClosureFact`. Never throws — an empty/missing value classifies as `"missing"`, tier
 * `"unknown"`, exactly like every Phase 3D-A Python classifier does for the same input.
 */
export function interpretClosureText(raw: string | null | undefined): ClosureFact {
  const text = raw ?? "";
  const category = classifyClosureCategory(text);
  if (category === "no-known-closure") {
    return { kind: "no-known-closure", tier: "safe", category, raw: text };
  }
  if (category === "recurring-weekday-named") {
    return {
      kind: "candidate-weekday",
      tier: "partial",
      category,
      weekdays: weekdaysIn(normalizeText(text)),
      raw: text,
    };
  }
  // Safe cast: `category` is guaranteed not to be "no-known-closure" here (handled above), and
  // that is the only key `CLOSURE_CATEGORY_TIER` maps to "safe" — TypeScript just can't narrow a
  // record's value type from a runtime-excluded key set.
  const tier = CLOSURE_CATEGORY_TIER[category] as Exclude<TemporalTier, "safe">;
  return { kind: "not-evaluable", tier, category, raw: text };
}

/**
 * The narrow, closed outcome vocabulary this phase is allowed to produce — see
 * `docs/ROADMAP.md`'s Phase 3D-B entry and the product boundary it documents. Every variant name
 * is deliberately scoped to "does the recorded weekday-closure candidate match this date," never
 * to "is the place open" or "does this day work":
 *
 *   - `"possible-weekday-closure-match"` — the civil date's weekday IS one of the candidate
 *     weekdays extracted from a `"candidate-weekday"` fact. A conservative planning signal only
 *     — never "this place is closed."
 *   - `"no-weekday-match"` — a `"candidate-weekday"` fact exists, but the civil date's weekday is
 *     not among its candidates. This does NOT mean open, feasible, compatible, or "no closure" —
 *     it means only that this one recorded candidate didn't match this one date.
 *   - `"no-known-closure"` — the place's `ClosureFact` is the SAFE "no ordinary closure recorded"
 *     kind. Still not a claim that the place is open on this date — only that no ordinary
 *     closure is recorded at all.
 *   - `"not-evaluable"` — the `ClosureFact` is `"not-evaluable"` (OPAQUE/UNKNOWN territory in
 *     Phase 3D-A's terms): this module has no safe candidate to compare against this date.
 *   - `"not-assessed"` — no valid civil date was available to assess against (no date chosen, or
 *     the date string was invalid) — assessed independently of the closure fact.
 */
export type WeekdayClosureAssessment =
  | { outcome: "possible-weekday-closure-match"; weekday: CivilWeekday; closure: ClosureFact }
  | { outcome: "no-weekday-match"; weekday: CivilWeekday; closure: ClosureFact }
  | { outcome: "no-known-closure"; weekday: CivilWeekday; closure: ClosureFact }
  | { outcome: "not-evaluable"; weekday: CivilWeekday; closure: ClosureFact }
  | { outcome: "not-assessed" };

/**
 * Combines one `ClosureFact` with one civil-date string (or `null`) into a `WeekdayClosureAssessment`.
 * Pure: no I/O, no randomness, no mutation. `dateIso` is resolved to a weekday via
 * `getCivilWeekday` internally, so a missing date and an invalid date string are handled
 * identically — both become `"not-assessed"`, never a guessed weekday.
 */
export function assessWeekdayClosure(closure: ClosureFact, dateIso: string | null): WeekdayClosureAssessment {
  const weekday = dateIso === null ? null : getCivilWeekday(dateIso);
  if (weekday === null) return { outcome: "not-assessed" };

  if (closure.kind === "no-known-closure") return { outcome: "no-known-closure", weekday, closure };
  if (closure.kind === "not-evaluable") return { outcome: "not-evaluable", weekday, closure };

  return closure.weekdays.includes(weekday)
    ? { outcome: "possible-weekday-closure-match", weekday, closure }
    : { outcome: "no-weekday-match", weekday, closure };
}
