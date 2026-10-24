import { normalizeText } from "./place";
import type { Place } from "../types";

/**
 * Phase 3D-E — Recorded Hours Signals.
 *
 * Turns the already-audited `schedule.hours` free text into a conservative runtime planning
 * signal, given a place the user already selected. This module answers exactly one question —
 * "what kind of recorded-hours information can Nihon safely state from the existing static
 * `schedule.hours` field for this place?" — and nothing else. It is deliberately NOT an
 * opening-hours feasibility solver: it never answers "will this place be open when I arrive,"
 * "can I visit this on Day 2," "this closes before your visit ends," or "this day works." No
 * clock time, timezone, visit start time, date comparison, or open/closed judgment is produced
 * anywhere in this module.
 *
 * **Parity with Phase 3D-A is load-bearing, not incidental** — the same discipline
 * `temporal-availability.ts` (`schedule.closures`), `reservation.ts` (`reservation.raw`), and
 * `reservation-lead-time.ts` (`reservation.leadTime`) already established.
 * `classifyHoursCategory()` is a direct TypeScript port of `scripts/temporal_data_lib.py`'s
 * `classify_hours()`: the same 14 category names, the same SAFE/PARTIAL/OPAQUE/UNKNOWN tier per
 * category, and — critically — the same fixed PRIORITY ORDER of checks. Priority is not
 * incidental here: a "24 h" token followed by a weather/operator/seasonal caveat must classify as
 * `known-24h-with-caveat` (PARTIAL), never plain `known-24h` (SAFE), and a clock-looking substring
 * inside an opaque/conditional sentence must never be promoted into a SAFE structured interval.
 * `recorded-hours.test.ts` protects both the category/tier parity (via a source-scan of the actual
 * Python `HOURS_TIER` dict, the same subprocess-free technique `temporal-availability.test.ts`
 * established) and the priority order (via the exact adversarial examples the Phase 3D-A/3D-E
 * contracts name).
 *
 * Like `temporal-availability.ts`, this module classifies against `normalizeText(raw)` (NFD accent
 * stripping + lowercasing) rather than porting Python's accented character classes (`s[eé]g[uú]n`)
 * verbatim — the same established technique: "según"/"Según" and "segun" all normalize to "segun",
 * matching the Python regex's accepted set for every Spanish variant actually present in this
 * dataset, without hand-rolled character classes. Generic NFD stripping is technically a broader
 * accept set than an explicit `s[eé]g[uú]n`-style class (it also folds accented characters the
 * Python pattern never listed), so this is an equivalence over the canonical dataset and its
 * expected Spanish variants, not a formal proof the two regex engines accept identical languages —
 * the parity tests below assert on classification outcomes for real and representative strings,
 * not on the regex character classes themselves.
 *
 * **This module never reads `bestTime`, `schedule.closures`, or `febMar2027`.** Those are
 * different axes owned by different phases (`bestTime` is an editorial recommendation, never an
 * hours source per `docs/TEMPORAL_DATA_CONTRACT.md` §3; `schedule.closures` is Phase 3D-B's own
 * domain; `febMar2027` is a trip-window-confidence axis) — composing any of them with an hours fact
 * to produce a stronger claim ("open," "compatible," "this day works") would exceed the evidence
 * a single field can support. See `docs/ROADMAP.md`'s Phase 3D-E entry for the full product
 * boundary this module and its consumers must stay inside.
 */

export type HoursTier = "safe" | "partial" | "opaque" | "unknown";

/** The exact same 14 keys as `scripts/temporal_data_lib.py`'s `HOURS_TIER` — protected by a
 * source-scanning parity test in `recorded-hours.test.ts`. */
export type HoursCategory =
  | "missing"
  | "known-24h"
  | "known-24h-with-caveat"
  | "weather-or-tide-dependent"
  | "third-party-operator-dependent"
  | "seasonal-variable"
  | "solar-relative"
  | "daytime-qualitative"
  | "partial-single-bound"
  | "ambiguous-alternative-interval"
  | "fixed-interval-with-caveat"
  | "fixed-interval-clean"
  | "explicit-unknown-variable"
  | "qualitative-uncategorized";

/** Exact mirror of `scripts/temporal_data_lib.py`'s `HOURS_TIER`. */
const HOURS_CATEGORY_TIER: Record<HoursCategory, HoursTier> = {
  missing: "unknown",
  "known-24h": "safe",
  "known-24h-with-caveat": "partial",
  "weather-or-tide-dependent": "opaque",
  "third-party-operator-dependent": "opaque",
  "seasonal-variable": "partial",
  "solar-relative": "partial",
  "daytime-qualitative": "partial",
  "partial-single-bound": "partial",
  "ambiguous-alternative-interval": "partial",
  "fixed-interval-with-caveat": "partial",
  "fixed-interval-clean": "safe",
  "explicit-unknown-variable": "unknown",
  "qualitative-uncategorized": "unknown",
};

/**
 * The only five shapes a recorded-hours interpretation can take. `raw` is carried on every
 * variant — Phase 3D-A's contract rule 1 ("raw editorial data is authoritative and is preserved
 * exactly as-is") applies here too; nothing derived here ever replaces or hides the source text.
 *
 * `intervalRaw` exists on `"recorded-interval"` ONLY — the one category (`fixed-interval-clean`)
 * whose interval is safe to surface as a structured fact on its own, because no caveat, season
 * dependency, or third-party/weather dependency is present in the string. Every other kind that
 * might contain a clock-looking substring (`"conditional"`, `"external-dependency"`) never exposes
 * one — see `recorded-hours.test.ts`'s dedicated safe-interval-extraction tests. `intervalRaw` is
 * the matched token only (e.g. `"09:00–20:00"`) — never minutes-since-midnight, a `Date`, or any
 * other arithmetic-ready form; see this module's own doc above for why.
 */
export type RecordedHoursFact =
  | { kind: "recorded-24h"; category: "known-24h"; tier: "safe"; raw: string }
  | {
      kind: "recorded-interval";
      category: "fixed-interval-clean";
      tier: "safe";
      raw: string;
      intervalRaw: string;
    }
  | {
      kind: "conditional";
      category: Extract<
        HoursCategory,
        | "known-24h-with-caveat"
        | "seasonal-variable"
        | "solar-relative"
        | "daytime-qualitative"
        | "partial-single-bound"
        | "ambiguous-alternative-interval"
        | "fixed-interval-with-caveat"
      >;
      tier: "partial";
      raw: string;
    }
  | {
      kind: "external-dependency";
      category: Extract<HoursCategory, "weather-or-tide-dependent" | "third-party-operator-dependent">;
      tier: "opaque";
      raw: string;
    }
  | {
      kind: "unknown";
      category: Extract<HoursCategory, "missing" | "explicit-unknown-variable" | "qualitative-uncategorized">;
      tier: "unknown";
      raw: string;
    };

// Mirrors scripts/temporal_data_lib.py's hours regexes exactly (same word lists, same priority
// order in classifyHoursCategory below), matched against accent-stripped lowercase text — the
// same normalizeText equivalence temporal-availability.ts already established for
// schedule.closures.
const H24_RE = /24\s*h\b/;
const ENV_RE = /clima|tifon|mal tiempo|oleaje|meteorologic|marea|viento|bandera del mar/;
const THIRDPARTY_RE =
  /segun\s+(el\s+|la\s+)?(comercio|tienda|local|templo|taller|productor|operador|usj|edificio|bar)\b/;
const SEASONAL_RE = /temporada|estacional|por edicion|por sede|por exposicion/;
const SOLAR_RE = /amanecer|atardecer|puesta de sol|madrugada/;
const DIURNAL_RE = /diurn/;
const VARIABLE_RE = /variable/;
const TIME_RANGE_RE = /\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}(:\d{2})?/;
const SINGLE_TIME_RE = /\d{1,2}:\d{2}/;

/**
 * Classifies `raw` into exactly one `HoursCategory`, via the same ordered priority chain as
 * `scripts/temporal_data_lib.py`'s `classify_hours()`. Kept as its own function (rather than
 * inlined into `interpretHoursText`) so a parity/priority test can assert on the category name
 * alone, independent of how `RecordedHoursFact` chooses to shape the result.
 */
function classifyHoursCategory(raw: string): HoursCategory {
  const text = raw.trim();
  if (!text) return "missing";
  const normalized = normalizeText(text);

  if (H24_RE.test(normalized)) {
    // A "24 h" token alone is a clean SAFE fact. But "24 h" plus a weather/tide, third-party-
    // operator, seasonal, or other explicit variability caveat is NOT safe merely because the
    // string contains "24 h" — see this module's own doc and `docs/TEMPORAL_DATA_CONTRACT.md` §1
    // for the worked example ("Abierto 24 h; puede cerrar por viento").
    if (
      ENV_RE.test(normalized) ||
      THIRDPARTY_RE.test(normalized) ||
      SEASONAL_RE.test(normalized) ||
      VARIABLE_RE.test(normalized)
    ) {
      return "known-24h-with-caveat";
    }
    return "known-24h";
  }
  if (ENV_RE.test(normalized)) return "weather-or-tide-dependent";
  if (THIRDPARTY_RE.test(normalized)) return "third-party-operator-dependent";
  if (SEASONAL_RE.test(normalized)) return "seasonal-variable";
  if (SOLAR_RE.test(normalized) && !TIME_RANGE_RE.test(normalized)) return "solar-relative";
  if (DIURNAL_RE.test(normalized) && !TIME_RANGE_RE.test(normalized)) return "daytime-qualitative";
  if (TIME_RANGE_RE.test(normalized)) {
    const firstClause = normalized.split(";")[0];
    if (firstClause.includes("/")) return "ambiguous-alternative-interval";
    if (normalized.includes(";") || normalized.includes("verificar") || VARIABLE_RE.test(normalized)) {
      return "fixed-interval-with-caveat";
    }
    return "fixed-interval-clean";
  }
  if (SINGLE_TIME_RE.test(normalized)) {
    // Exactly one clock time with no closed range around it (e.g. "Muy temprano–14:00 aprox.") —
    // one bound is real, the other is not.
    return "partial-single-bound";
  }
  if (VARIABLE_RE.test(normalized)) return "explicit-unknown-variable";
  return "qualitative-uncategorized";
}

/**
 * Extracts the matched clock-interval token (e.g. `"09:00–20:00"`) from `raw` — called ONLY for
 * `fixed-interval-clean` text, which is guaranteed by `classifyHoursCategory` to contain a
 * `TIME_RANGE_RE` match. Digits, colons, and dashes are unaffected by accent normalization, so
 * this matches against the trimmed original text directly (never the normalized/lowercased
 * form) — the extracted token's casing/punctuation is exactly as recorded.
 */
function extractIntervalRaw(raw: string): string {
  const match = TIME_RANGE_RE.exec(raw.trim());
  if (!match) {
    throw new Error(
      `extractIntervalRaw: expected a fixed-interval-clean string to contain a time range, got: ${JSON.stringify(raw)}`
    );
  }
  return match[0];
}

/**
 * The single entry point this module offers for turning raw `place.schedule.hours` text into a
 * `RecordedHoursFact`. Never throws — an empty/missing value classifies as `"missing"`, tier
 * `"unknown"`, exactly like every Phase 3D-A Python classifier does for the same input.
 */
export function interpretHoursText(raw: string | null | undefined): RecordedHoursFact {
  const text = raw ?? "";
  const category = classifyHoursCategory(text);

  if (category === "known-24h") {
    return { kind: "recorded-24h", category, tier: HOURS_CATEGORY_TIER[category] as "safe", raw: text };
  }
  if (category === "fixed-interval-clean") {
    return {
      kind: "recorded-interval",
      category,
      tier: HOURS_CATEGORY_TIER[category] as "safe",
      raw: text,
      intervalRaw: extractIntervalRaw(text),
    };
  }
  if (category === "weather-or-tide-dependent" || category === "third-party-operator-dependent") {
    return { kind: "external-dependency", category, tier: HOURS_CATEGORY_TIER[category] as "opaque", raw: text };
  }
  if (
    category === "missing" ||
    category === "explicit-unknown-variable" ||
    category === "qualitative-uncategorized"
  ) {
    return { kind: "unknown", category, tier: HOURS_CATEGORY_TIER[category] as "unknown", raw: text };
  }
  // Only the seven PARTIAL "conditional" categories remain here: known-24h-with-caveat,
  // seasonal-variable, solar-relative, daytime-qualitative, partial-single-bound,
  // ambiguous-alternative-interval, fixed-interval-with-caveat.
  return { kind: "conditional", category, tier: HOURS_CATEGORY_TIER[category] as "partial", raw: text };
}

/** The usual entry point: classifies a real `Place`'s `schedule.hours` directly. */
export function interpretPlaceHours(place: Place): RecordedHoursFact {
  return interpretHoursText(place.schedule.hours);
}
