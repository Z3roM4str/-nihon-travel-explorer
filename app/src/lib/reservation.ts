import type { Place } from "../types";

/**
 * Phase 3D-C — Reservation Semantics.
 *
 * Fixes a real correctness gap Phase 3D-A proved mechanically: `place.reservation.required` is a
 * lossy derived boolean. `scripts/export-dataset.py` computes it as
 * `required = raw.lower() == "sí"`, which means every one of 39/214 places whose
 * `reservation.raw` is `"Recomendable"`, `"Opcional"`, or `"No para espectador"` collapses to the
 * same `false` a plain `"No"` gets — a materially different source statement read as if it meant
 * the same thing. `reservation.raw` already preserves the real nuance; this module is what makes
 * runtime UI/filter logic actually respect it instead of the boolean alone.
 *
 * `reservation.required` itself is untouched and still exported on `Place` — it stays internally
 * consistent with the exporter, and removing it would be unnecessary schema churn this phase does
 * not need. What changes is that no UI/filter code should decide "requires reservation" from that
 * boolean alone anymore; `interpretPlaceReservation()` below is the one place that decision is
 * made from the richer `raw` source instead.
 *
 * **Parity with Phase 3D-A is load-bearing, not incidental** — the same discipline
 * `temporal-availability.ts` already established for `schedule.closures`.
 * `classifyReservationCategory()` is a direct TypeScript port of
 * `scripts/temporal_data_lib.py`'s `classify_reservation_raw()`: same category names, same
 * priority (a case-insensitive exact match against the same five known raw values, else
 * `"unrecognized-value"`), same SAFE/PARTIAL/UNKNOWN tier per category, same expected-boolean
 * mapping (`RESERVATION_RAW_EXPECTED_REQUIRED`). `reservation.test.ts` includes a subprocess-free
 * source-check against the actual Python file, mirroring the technique
 * `temporal-availability.test.ts` already uses for `schedule.closures` — chosen specifically
 * because Phase 3D-B's own corrective review found a real category-name drift that an
 * insufficiently strict parity test had missed.
 */

export type ReservationTier = "safe" | "partial" | "unknown";

/** Exact mirror of `scripts/temporal_data_lib.py`'s `classify_reservation_raw()` category set —
 * not a subset, the same 7 keys, protected by the source-check in `reservation.test.ts`. */
export type ReservationCategory =
  | "missing"
  | "not-required"
  | "required"
  | "recommended-not-required"
  | "optional-not-required"
  | "not-required-role-specific"
  | "unrecognized-value";

/** Exact mirror of `scripts/temporal_data_lib.py`'s `RESERVATION_RAW_TIER`. */
const RESERVATION_CATEGORY_TIER: Record<ReservationCategory, ReservationTier> = {
  missing: "unknown",
  "not-required": "safe",
  required: "safe",
  "recommended-not-required": "partial",
  "optional-not-required": "partial",
  "not-required-role-specific": "partial",
  "unrecognized-value": "unknown",
};

/** Exact mirror of `scripts/temporal_data_lib.py`'s `RESERVATION_RAW_EXPECTED_REQUIRED` — the
 * export pipeline's own rule (`required = raw.lower() == "sí"`) restated as a lookup, so
 * agreement/disagreement with the real `reservation.required` boolean is checkable rather than
 * assumed. */
const RESERVATION_EXPECTED_REQUIRED: Record<ReservationCategory, boolean> = {
  missing: false,
  "not-required": false,
  required: true,
  "recommended-not-required": false,
  "optional-not-required": false,
  "not-required-role-specific": false,
  "unrecognized-value": false,
};

/** Exact mirror of `scripts/temporal_data_lib.py`'s `_RESERVATION_RAW_MAP` — a case-insensitive
 * exact match against the five raw values the current dataset actually uses. */
const RESERVATION_RAW_MAP: Record<string, ReservationCategory> = {
  no: "not-required",
  sí: "required",
  si: "required",
  recomendable: "recommended-not-required",
  opcional: "optional-not-required",
  "no para espectador": "not-required-role-specific",
};

function classifyReservationCategory(raw: string): ReservationCategory {
  const text = raw.trim();
  if (!text) return "missing";
  return RESERVATION_RAW_MAP[text.toLowerCase()] ?? "unrecognized-value";
}

/**
 * The one structured fact this module produces for a place's reservation state. `raw` is always
 * carried verbatim — the source text is authoritative and is never replaced, only classified
 * alongside. `consistentWithDerivedBoolean` cross-checks `required` against what
 * `RESERVATION_RAW_EXPECTED_REQUIRED` says the export pipeline's own rule should have produced —
 * on the current dataset this is `true` for all 214 places (Phase 3D-A proved 0/214
 * inconsistencies), but it is computed, never assumed, so a future inconsistent record would be
 * exposed structurally rather than silently trusted or hidden.
 */
export type ReservationFact = {
  category: ReservationCategory;
  tier: ReservationTier;
  raw: string;
  required: boolean;
  consistentWithDerivedBoolean: boolean;
};

/** Classifies one `(raw, required)` pair. Pure — no `Place` dependency, so it can be tested (and
 * reused) independently of the dataset shape. */
export function interpretReservation(raw: string, required: boolean): ReservationFact {
  const category = classifyReservationCategory(raw);
  const expected = RESERVATION_EXPECTED_REQUIRED[category];
  return {
    category,
    tier: RESERVATION_CATEGORY_TIER[category],
    raw,
    required,
    consistentWithDerivedBoolean: required === expected,
  };
}

/** The usual entry point: classifies a real `Place`'s `reservation.raw`/`reservation.required`
 * pair directly. */
export function interpretPlaceReservation(place: Place): ReservationFact {
  return interpretReservation(place.reservation.raw, place.reservation.required);
}

// ---------------------------------------------------------------------------------------
// Filtering — replaces the lossy `place.reservation.required` boolean predicate that used to
// live inline in App.tsx's `matchesFilters`. A closed union, never a free-form string; "all"
// matches everything, and every other value matches exactly one `ReservationCategory` — an
// unrecognized/missing raw value never silently satisfies a specific filter just because its
// derived boolean happens to agree.
// ---------------------------------------------------------------------------------------

export type ReservationFilterValue =
  | "all"
  | "required"
  | "recommended"
  | "not-required"
  | "optional"
  | "role-specific";

const RESERVATION_FILTER_CATEGORY: Record<Exclude<ReservationFilterValue, "all">, ReservationCategory> = {
  required: "required",
  recommended: "recommended-not-required",
  "not-required": "not-required",
  optional: "optional-not-required",
  "role-specific": "not-required-role-specific",
};

/** The single predicate `App.tsx`'s filtering calls — so the same logic these tests exercise is
 * exactly what decides what the user sees, never a re-implementation living in the component. */
export function matchesReservationFilter(place: Place, filter: ReservationFilterValue): boolean {
  if (filter === "all") return true;
  return interpretPlaceReservation(place).category === RESERVATION_FILTER_CATEGORY[filter];
}

// ---------------------------------------------------------------------------------------
// Display — the one place `PlaceDetail.tsx` turns a `ReservationFact` into user-facing text.
// Deliberately narrow: a tag label plus a single practical-info row, both built only from the
// classified category and (for the SAFE/PARTIAL "you may want to think about this" categories)
// the raw `leadTime` text — never a computed deadline, never a comparison against today's date.
// See "Lead time display" in docs/TEMPORAL_DATA_CONTRACT.md-adjacent scope notes: leadTime is
// shown verbatim or not at all, never normalized into days/weeks/months arithmetic.
// ---------------------------------------------------------------------------------------

export type ReservationDisplay = {
  /** `null` when no tag should render — the plain "not required" and role-specific cases don't
   * get one, matching the existing convention that a tag exists to flag something worth a
   * second look, not to restate the default. */
  tag: { label: string; className: string } | null;
  /** The "Reserva" row's full text in the practical-information section. */
  practicalRow: string;
};

/** Omits a lead-time suffix entirely when the raw value is absent or the dataset's own "not
 * applicable" placeholder (`"—"`) — this is a presence check on raw text, not lead-time
 * intelligence: no parsing, no magnitude bucketing, no deadline math. */
function leadTimeSuffix(leadTime: string): string {
  const trimmed = leadTime.trim();
  return !trimmed || trimmed === "—" ? "" : ` · ${trimmed}`;
}

export function describeReservationForUi(fact: ReservationFact, leadTime: string): ReservationDisplay {
  switch (fact.category) {
    case "required":
      return {
        tag: { label: "Requiere reserva", className: "tag--alert" },
        practicalRow: `Necesaria${leadTimeSuffix(leadTime)}`,
      };
    case "recommended-not-required":
      return {
        tag: { label: "Reserva recomendable", className: "tag--reservation-recommended" },
        practicalRow: `Recomendable${leadTimeSuffix(leadTime)}`,
      };
    case "optional-not-required":
      return {
        tag: { label: "Reserva opcional", className: "tag--reservation-optional" },
        practicalRow: `Opcional${leadTimeSuffix(leadTime)}`,
      };
    case "not-required":
      return { tag: null, practicalRow: "No es necesaria" };
    case "not-required-role-specific":
      // Preserve the nuance verbatim rather than rewriting it as generic "No es necesaria" —
      // "No para espectador" means something a plain "No" does not (it's role-specific: not
      // required for a visitor, but the raw text itself is the only safe way to say why).
      return { tag: null, practicalRow: fact.raw.trim() || "No es necesaria" };
    case "missing":
      return { tag: null, practicalRow: "Estado de reserva por verificar" };
    case "unrecognized-value":
      // Never guessed into "required" or "not required" — the raw text is shown plus a
      // conservative note when present; the generic fallback only when there is truly nothing
      // to show.
      return {
        tag: null,
        practicalRow: fact.raw.trim() ? `${fact.raw.trim()} (verificar)` : "Estado de reserva por verificar",
      };
  }
}
