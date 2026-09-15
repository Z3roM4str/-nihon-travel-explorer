import type { Place } from "../types";

/**
 * Phase 3D-F — Feb–Mar 2027 Status Signals.
 *
 * Turns the already-audited `febMar2027.status` free text into a conservative runtime
 * confidence/review signal, for a place the user is already looking at. This module answers
 * exactly one question — "given the editorial Feb–Mar 2027 status already recorded for this
 * place, what confidence/review signal may Nihon safely show?" — and nothing else. It is
 * deliberately NOT an availability solver: it never answers "will this place be open," "does this
 * day work," or any question about a specific date. `open-with-condition` is an audited Python
 * category NAME, not a runtime claim that the place will actually be open on any particular date.
 *
 * **Parity with Phase 3D-A is load-bearing, not incidental** — the same discipline every prior
 * Phase 3D runtime module established. `classifyFebMarStatusCategory()` is a direct TypeScript
 * port of `scripts/temporal_data_lib.py`'s `classify_feb_mar_status()`: the same 12 category
 * names, the same `FEB_MAR_STATUS_TIER` tier-per-category mapping, and the same fixed priority
 * order of checks. Unlike the accent-stripping technique `temporal-availability.ts`/
 * `recorded-hours.ts` use for Spanish word matching, this classifier's Python source already
 * upper-cases and does plain substring checks with no accented character classes at all
 * (`"RIESGO"`, `"CONFIRMADO"`, `"PENDIENTE"`, ...) — so this port matches it exactly with the same
 * `.trim().toUpperCase()` + `.includes()` checks, no `normalizeText` needed.
 *
 * **This module never reads `febMar2027.warning` or `febMar2027.action`.** Both are free editorial
 * prose meant for a human — see `docs/TEMPORAL_DATA_CONTRACT.md`'s "febMar2027 boundary" — and
 * `classify_feb_mar_status()` itself takes exactly one argument (`status`), never `warning`/
 * `action`. This module reads no other field either: no `schedule.hours`, no `schedule.closures`,
 * no `bestTime`, no `reservation.*`, no `startDate`, no derived day date, no current date/time. No
 * network requests, no `Date` arithmetic, no timezone logic.
 *
 * **This module never exposes an `open`/`closed`/`available`/`feasible` boolean, or anything
 * equivalent.** The result is a closed `category`/`tier` pair plus a presentation `tone` derived
 * only from `tier` — there is no boolean field anywhere in `FebMarStatusFact` or
 * `FebMarStatusDisplay`, and none should ever be added.
 */

export type FebMarStatusTier = "safe" | "partial" | "opaque" | "unknown";

/** The exact same 12 keys as `scripts/temporal_data_lib.py`'s `FEB_MAR_STATUS_TIER` — protected by
 * a source-scanning parity test in `feb-mar-status.test.ts`. */
export type FebMarStatusCategory =
  | "missing"
  | "confirmed"
  | "open-with-condition"
  | "pending-verification"
  | "seasonal-risk"
  | "seasonal-opportunity"
  | "sale-or-lottery-limited"
  | "maintenance-or-works"
  | "partial-closure-in-effect"
  | "historical-pattern-inference"
  | "ritual-access-restriction-pending"
  | "uncategorized";

/** Exact mirror of `scripts/temporal_data_lib.py`'s `FEB_MAR_STATUS_TIER`. */
const FEB_MAR_STATUS_CATEGORY_TIER: Record<FebMarStatusCategory, FebMarStatusTier> = {
  missing: "unknown",
  confirmed: "safe",
  "open-with-condition": "partial",
  "pending-verification": "unknown",
  "seasonal-risk": "opaque",
  "seasonal-opportunity": "opaque",
  "sale-or-lottery-limited": "opaque",
  "maintenance-or-works": "opaque",
  "partial-closure-in-effect": "partial",
  "historical-pattern-inference": "opaque",
  "ritual-access-restriction-pending": "opaque",
  uncategorized: "unknown",
};

/** The one structured fact this module produces. `raw` is carried verbatim — Phase 3D-A's
 * contract rule 1 applies here too; nothing derived here ever replaces or hides the source text.
 * No `open`/`closed`/`available` field exists here, by design. */
export type FebMarStatusFact = {
  category: FebMarStatusCategory;
  tier: FebMarStatusTier;
  raw: string;
};

/**
 * Classifies `raw` into exactly one `FebMarStatusCategory`, via the same ordered priority chain as
 * `scripts/temporal_data_lib.py`'s `classify_feb_mar_status()`. Kept as its own function (rather
 * than inlined into `interpretFebMarStatusText`) so a parity/priority test can assert on the
 * category name alone.
 */
function classifyFebMarStatusCategory(raw: string): FebMarStatusCategory {
  const text = raw.trim().toUpperCase();
  if (!text) return "missing";
  if (text.includes("VENTA FUTURA") || text.includes("SORTEO") || text.includes("CUPO LIMITADO")) {
    return "sale-or-lottery-limited";
  }
  if (text.includes("RIESGO") || text.includes("VARIABLE POR MAR")) return "seasonal-risk";
  if (text.includes("MANTENIMIENTO") || text.includes("OBRAS")) return "maintenance-or-works";
  if (text.includes("CIERRE PARCIAL")) return "partial-closure-in-effect";
  if (text.includes("PATR") && text.includes("HIST")) return "historical-pattern-inference";
  if (text.includes("OPORTUNIDAD")) return "seasonal-opportunity";
  if (text.includes("SAGRAD")) return "ritual-access-restriction-pending";
  const hasPending = text.includes("PENDIENTE");
  const hasConfirmado = text.includes("CONFIRMADO");
  if (hasConfirmado && !hasPending) return "confirmed";
  if (text.startsWith("ABIERTO")) return "open-with-condition";
  if (hasPending) return "pending-verification";
  return "uncategorized";
}

/**
 * The single entry point this module offers for turning raw `place.febMar2027.status` text into a
 * `FebMarStatusFact`. Never throws — an empty/missing value classifies as `"missing"`, tier
 * `"unknown"`, exactly like `scripts/temporal_data_lib.py`'s classifier does for the same input.
 * Takes `status` text only — never `warning`/`action` — matching `classify_feb_mar_status()`'s own
 * single-argument signature.
 */
export function interpretFebMarStatusText(raw: string | null | undefined): FebMarStatusFact {
  const text = raw ?? "";
  const category = classifyFebMarStatusCategory(text);
  return { category, tier: FEB_MAR_STATUS_CATEGORY_TIER[category], raw: text };
}

/** The usual entry point: classifies a real `Place`'s `febMar2027.status` directly. */
export function interpretPlaceFebMarStatus(place: Place): FebMarStatusFact {
  return interpretFebMarStatusText(place.febMar2027.status);
}

/**
 * A conservative, three-value presentation signal derived only from `tier` — never from
 * `category` directly, so no single category can accidentally acquire special-cased wording that
 * drifts from its tier's meaning. `"confirmed"` is SAFE only; `"attention"` covers both PARTIAL
 * and OPAQUE (a status carrying either a real caveat or a genuine external dependency both warrant
 * a closer look, without claiming to know which); `"pending"` is UNKNOWN (nothing safely
 * extractable yet).
 */
export type FebMarStatusTone = "confirmed" | "attention" | "pending";

const TIER_TONE: Record<FebMarStatusTier, FebMarStatusTone> = {
  safe: "confirmed",
  partial: "attention",
  opaque: "attention",
  unknown: "pending",
};

/**
 * What `PlaceDetail.tsx`'s existing Feb–Mar 2027 card needs to render: a tone, the CSS modifier
 * that reuses the card's existing `.alert--<modifier>` classes (an adapter over the pre-existing
 * three-color palette rather than new CSS), an icon, and a label. The label is deliberately
 * generic per tone — never per category — so a category like `seasonal-opportunity` (OPAQUE, tone
 * `"attention"`) is never described as "riesgo"/"risk": the label reads "Requiere atención"
 * ("needs a closer look"), the same neutral phrasing this card has always shown for its more
 * cautious tone, never a word implying danger. This is a label about confidence in the recorded
 * status, never a claim that the place is open, closed, or available on any date.
 */
export type FebMarStatusDisplay = {
  tone: FebMarStatusTone;
  cssModifier: "confirmed" | "risk" | "pending";
  icon: string;
  label: string;
};

const TONE_DISPLAY: Record<FebMarStatusTone, Omit<FebMarStatusDisplay, "tone">> = {
  confirmed: { cssModifier: "confirmed", icon: "✓", label: "Confirmado" },
  attention: { cssModifier: "risk", icon: "⚠", label: "Requiere atención" },
  pending: { cssModifier: "pending", icon: "ⓘ", label: "Por confirmar" },
};

/** Derives the display adapter for one `FebMarStatusFact`. Pure — no I/O, no `Place` dependency,
 * so it can be tested independently of the dataset shape. */
export function describeFebMarStatusForUi(fact: FebMarStatusFact): FebMarStatusDisplay {
  const tone = TIER_TONE[fact.tier];
  return { tone, ...TONE_DISPLAY[tone] };
}
