import type { Place } from "../types";

/**
 * Phase 3D-D — Reservation Lead-Time Signals.
 *
 * Turns the already-audited `reservation.leadTime` free text into a conservative runtime
 * planning signal: a coarse days/weeks/months magnitude when the recorded text safely supports
 * one, and an honest "specific mechanism, needs review" flag when it does not. This module
 * answers exactly one question — "what kind of advance-reservation information is recorded for
 * this place?" — and nothing else. It never converts a magnitude or a raw mechanism string into
 * a booking deadline: no day-count arithmetic, no comparison against `startDate` or today's date,
 * no lottery/release-date interpretation, no availability claim.
 *
 * **Parity with Phase 3D-A is load-bearing, not incidental** — the same discipline
 * `temporal-availability.ts` (`schedule.closures`) and `reservation.ts` (`reservation.raw`)
 * already established. `classifyLeadTimeCategory()` is a direct TypeScript port of
 * `scripts/temporal_data_lib.py`'s `classify_lead_time()`: same 3 category names, same
 * SAFE/PARTIAL/OPAQUE tier per category, same whole-string `_BARE_MAGNITUDE_RE` semantics.
 * `reservation-lead-time.test.ts` includes the same subprocess-free source-check technique
 * `reservation.test.ts` uses for `RESERVATION_RAW_TIER`, applied here to `LEAD_TIME_TIER`.
 *
 * **The whole-string rule is the load-bearing part of this module.** A string classifies as
 * `bare-magnitude` only when the ENTIRE normalized string matches the canonical magnitude
 * pattern — never because a magnitude-shaped substring (e.g. "3 meses", "2–4 semanas") appears
 * somewhere inside a longer, mechanism-specific sentence. `"Lotería 3 meses antes; revisar
 * liberaciones"` contains "3 meses" but must stay `opaque-entity-or-mechanism-specific`, because
 * the rest of the sentence is exactly the operationally important part (a lottery mechanism) a
 * coarse magnitude would silently discard. This module's regex is anchored (`^...$`) for exactly
 * that reason, and never exceeds the Python audit's ceiling.
 */

export type LeadTimeTier = "safe" | "partial" | "opaque";

/** Exact mirror of `scripts/temporal_data_lib.py`'s `classify_lead_time()` category set — the
 * same 3 keys, protected by the source-check in `reservation-lead-time.test.ts`. */
export type LeadTimeCategory = "not-applicable" | "bare-magnitude" | "opaque-entity-or-mechanism-specific";

/** Exact mirror of `scripts/temporal_data_lib.py`'s `LEAD_TIME_TIER`. */
const LEAD_TIME_CATEGORY_TIER: Record<LeadTimeCategory, LeadTimeTier> = {
  "not-applicable": "safe",
  "bare-magnitude": "partial",
  "opaque-entity-or-mechanism-specific": "opaque",
};

/**
 * The coarse magnitude buckets a `bare-magnitude` string can resolve to. `days-to-weeks` and
 * `weeks-to-months` exist because the canonical pattern accepts "Días/semanas" and
 * "Semanas/meses" as single combined magnitudes — the current dataset only exercises the first
 * (`"Días/semanas"`, 10 places), but the classifier supports both since the audited pattern does.
 * Deliberately closed and deliberately coarse: no numeric range (`minDays`/`maxDays`) is ever
 * derived here — see this module's own doc and `docs/ROADMAP.md`'s Phase 3D-D entry for why.
 */
export type LeadTimeMagnitude = "days" | "weeks" | "months" | "days-to-weeks" | "weeks-to-months";

/**
 * The one structured fact this module produces. A closed, kind-tagged union rather than a flat
 * object with optional fields — a `"specific-mechanism"` fact structurally cannot carry a
 * `magnitude`, so a consumer can never accidentally read one off an opaque record. `raw` is
 * carried on every variant, verbatim, per the Phase 3D-A contract's rule 1: the source text is
 * authoritative and is never replaced, only classified alongside — never `"Semanas"` standing in
 * for `"1–2 semanas"`, and never dropped for an opaque record, which has no other safe detail to
 * show.
 */
export type ReservationLeadTimeFact =
  | { kind: "not-applicable"; category: "not-applicable"; tier: "safe"; raw: string }
  | {
      kind: "coarse-magnitude";
      category: "bare-magnitude";
      tier: "partial";
      magnitude: LeadTimeMagnitude;
      raw: string;
    }
  | {
      kind: "specific-mechanism";
      category: "opaque-entity-or-mechanism-specific";
      tier: "opaque";
      raw: string;
    };

/** Exact mirror of `scripts/temporal_data_lib.py`'s `_BARE_MAGNITUDE_RE`: an optional numeric
 * range prefix (e.g. "1–2 ", "2-4 ") followed by exactly one of a closed set of magnitude
 * phrases, anchored so the WHOLE string must match — never a substring. Capture group 1 isolates
 * the magnitude phrase itself (with the numeric prefix stripped) for `deriveMagnitude` below. */
const BARE_MAGNITUDE_RE = /^(?:\d+\s*[–—-]\s*\d+\s*)?(d[ií]as?(?:\/semanas?)?|semanas?(?:\/meses?)?|meses?)$/i;

const DAYS_TO_WEEKS_RE = /^d[ií]as?\/semanas?$/i;
const DAYS_RE = /^d[ií]as?$/i;
const WEEKS_TO_MONTHS_RE = /^semanas?\/meses?$/i;
const WEEKS_RE = /^semanas?$/i;

/** Classifies `raw` into exactly one `LeadTimeCategory`, via the same two-step check as
 * `scripts/temporal_data_lib.py`'s `classify_lead_time()`: an empty/placeholder string is
 * `not-applicable`; otherwise the whole (trimmed) string is tested against `BARE_MAGNITUDE_RE`
 * before falling through to the opaque catch-all. */
function classifyLeadTimeCategory(raw: string): LeadTimeCategory {
  const text = raw.trim();
  if (!text || text === "—") return "not-applicable";
  if (BARE_MAGNITUDE_RE.test(text)) return "bare-magnitude";
  return "opaque-entity-or-mechanism-specific";
}

/** Derives the coarse magnitude bucket from a string already confirmed to match
 * `BARE_MAGNITUDE_RE` in full — never called otherwise. The numeric prefix (if any) never
 * changes the bucket; only the magnitude phrase itself (capture group 1) does. */
function deriveMagnitude(text: string): LeadTimeMagnitude {
  const match = BARE_MAGNITUDE_RE.exec(text);
  const phrase = match?.[1] ?? text;
  if (DAYS_TO_WEEKS_RE.test(phrase)) return "days-to-weeks";
  if (DAYS_RE.test(phrase)) return "days";
  if (WEEKS_TO_MONTHS_RE.test(phrase)) return "weeks-to-months";
  if (WEEKS_RE.test(phrase)) return "weeks";
  return "months";
}

/** Classifies one raw `reservation.leadTime` string. Pure — no `Place` dependency, so it can be
 * tested (and reused) independently of the dataset shape. Never throws: an empty/missing value
 * classifies as `not-applicable`, exactly like `scripts/temporal_data_lib.py`'s `classify_lead_time`
 * does for `None`/empty input. */
export function interpretLeadTimeText(raw: string | null | undefined): ReservationLeadTimeFact {
  const text = raw ?? "";
  const trimmed = text.trim();
  const category = classifyLeadTimeCategory(trimmed);

  if (category === "not-applicable") {
    return { kind: "not-applicable", category, tier: LEAD_TIME_CATEGORY_TIER[category] as "safe", raw: text };
  }
  if (category === "bare-magnitude") {
    return {
      kind: "coarse-magnitude",
      category,
      tier: LEAD_TIME_CATEGORY_TIER[category] as "partial",
      magnitude: deriveMagnitude(trimmed),
      raw: text,
    };
  }
  return {
    kind: "specific-mechanism",
    category,
    tier: LEAD_TIME_CATEGORY_TIER[category] as "opaque",
    raw: text,
  };
}

/** The usual entry point: classifies a real `Place`'s `reservation.leadTime` directly. */
export function interpretPlaceLeadTime(place: Place): ReservationLeadTimeFact {
  return interpretLeadTimeText(place.reservation.leadTime);
}
