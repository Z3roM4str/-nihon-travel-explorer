"""Phase 3D-A — pure, deterministic classification of the dataset's existing temporal
editorial fields (`schedule.hours`, `schedule.closures`, `bestTime`, `reservation.required`/
`reservation.leadTime`/`reservation.raw`, `febMar2027.status`) into pattern families.

This module makes NO network requests, reads no files, and does not modify anything. It only
maps a raw editorial string (or boolean) to a category name via ordered regex rules — the same
raw string always classifies to the same category, and unrecognised text always falls through to
an explicit "opaque"/"unknown" catch-all category rather than being guessed into something more
specific. `scripts/audit-temporal-data.py` is the only thing that reads `data/places.json` and
calls these functions; `scripts/test_temporal_data_audit.py` imports this module directly for
unit tests.

Every category is additionally tagged with one of four normalization tiers — see
`docs/TEMPORAL_DATA_CONTRACT.md` for the full rationale:

  - "SAFE"    — deterministically parseable without guessing.
  - "PARTIAL" — part of the statement is safely extractable, part is not.
  - "OPAQUE"  — depends on something this static dataset cannot resolve (weather, an
                unnamed third party, a festival calendar, ...): must stay editorial text.
  - "UNKNOWN" — genuinely unclassifiable, missing, or an explicit "variable"/"pending" signal.
                Never coerced to open, closed, or any other tier.

Priority matters: each classifier below is a short-circuiting chain of checks, evaluated in a
fixed order, so a string matching more than one pattern always lands in the same category run to
run. `HOURS_RULES` / `CLOSURES_RULES` expose that order explicitly (as `(category, predicate)`
pairs) so a test can assert on priority directly rather than only on the final answer.
"""
import re
from typing import Callable, List, Tuple

Tier = str  # one of "SAFE" | "PARTIAL" | "OPAQUE" | "UNKNOWN"


def _norm(raw) -> str:
    """Every classifier below receives whatever `data/places.json` stored — a string, or
    occasionally `None`/missing. Never raises; a non-string/empty input always classifies as
    "missing", never as a guessed category."""
    if raw is None:
        return ""
    return str(raw).strip()


# ---------------------------------------------------------------------------------------
# schedule.hours
# ---------------------------------------------------------------------------------------

_H24_RE = re.compile(r"24\s*h\b", re.IGNORECASE)
_ENV_RE = re.compile(
    r"clima|tif[oó]n|mal tiempo|oleaje|meteorol[oó]gic|marea|viento|bandera del mar",
    re.IGNORECASE,
)
_THIRDPARTY_RE = re.compile(
    r"s[eé]g[uú]n\s+(el\s+|la\s+)?(comercio|tienda|local|templo|taller|productor|operador|usj|edificio|bar)\b",
    re.IGNORECASE,
)
_SEASONAL_RE = re.compile(
    r"temporada|estacional|por edici[oó]n|por sede|por exposici[oó]n", re.IGNORECASE
)
_SOLAR_RE = re.compile(r"amanecer|atardecer|puesta de sol|madrugada", re.IGNORECASE)
_DIURNAL_RE = re.compile(r"diurn", re.IGNORECASE)
_VARIABLE_RE = re.compile(r"variable", re.IGNORECASE)
_TIME_RANGE_RE = re.compile(r"\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}(:\d{2})?", re.IGNORECASE)
_SINGLE_TIME_RE = re.compile(r"\d{1,2}:\d{2}")


def classify_hours(raw) -> str:
    text = _norm(raw)
    if not text:
        return "missing"
    if _H24_RE.search(text):
        return "known-24h"
    if _ENV_RE.search(text):
        return "weather-or-tide-dependent"
    if _THIRDPARTY_RE.search(text):
        return "third-party-operator-dependent"
    if _SEASONAL_RE.search(text):
        return "seasonal-variable"
    if _SOLAR_RE.search(text) and not _TIME_RANGE_RE.search(text):
        return "solar-relative"
    if _DIURNAL_RE.search(text) and not _TIME_RANGE_RE.search(text):
        return "daytime-qualitative"
    if _TIME_RANGE_RE.search(text):
        first_clause = text.split(";")[0]
        if "/" in first_clause:
            return "ambiguous-alternative-interval"
        if ";" in text or "verificar" in text.lower() or _VARIABLE_RE.search(text):
            return "fixed-interval-with-caveat"
        return "fixed-interval-clean"
    if _SINGLE_TIME_RE.search(text):
        # Exactly one clock time with no closed range around it (e.g. "Muy temprano–14:00
        # aprox.", "Abre desde 06:00; cierre variable") — one bound is real, the other is not.
        return "partial-single-bound"
    if _VARIABLE_RE.search(text):
        return "explicit-unknown-variable"
    return "qualitative-uncategorized"


HOURS_RULES: List[Tuple[str, Callable[[str], bool]]] = [
    ("missing", lambda t: not t),
    ("known-24h", lambda t: bool(_H24_RE.search(t))),
    ("weather-or-tide-dependent", lambda t: bool(_ENV_RE.search(t))),
    ("third-party-operator-dependent", lambda t: bool(_THIRDPARTY_RE.search(t))),
    ("seasonal-variable", lambda t: bool(_SEASONAL_RE.search(t))),
    ("solar-relative", lambda t: bool(_SOLAR_RE.search(t) and not _TIME_RANGE_RE.search(t))),
    ("daytime-qualitative", lambda t: bool(_DIURNAL_RE.search(t) and not _TIME_RANGE_RE.search(t))),
    ("fixed-interval-family", lambda t: bool(_TIME_RANGE_RE.search(t))),
    ("partial-single-bound", lambda t: bool(_SINGLE_TIME_RE.search(t))),
    ("explicit-unknown-variable", lambda t: bool(_VARIABLE_RE.search(t))),
    ("qualitative-uncategorized", lambda t: True),
]

HOURS_TIER = {
    "missing": "UNKNOWN",
    "known-24h": "SAFE",
    "weather-or-tide-dependent": "OPAQUE",
    "third-party-operator-dependent": "OPAQUE",
    "seasonal-variable": "PARTIAL",
    "solar-relative": "PARTIAL",
    "daytime-qualitative": "PARTIAL",
    "partial-single-bound": "PARTIAL",
    "ambiguous-alternative-interval": "PARTIAL",
    "fixed-interval-with-caveat": "PARTIAL",
    "fixed-interval-clean": "SAFE",
    "explicit-unknown-variable": "UNKNOWN",
    "qualitative-uncategorized": "UNKNOWN",
}

# ---------------------------------------------------------------------------------------
# schedule.closures
# ---------------------------------------------------------------------------------------

_CLOSURE_ENV_RE = re.compile(
    r"clima|tif[oó]n|mal tiempo|oleaje|meteorol[oó]gic|marea|viento", re.IGNORECASE
)
_WEEKDAY_RE = re.compile(
    r"lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo", re.IGNORECASE
)
_TEMP_SPECIFIC_RE = re.compile(
    r"festival|montaje|fin de a[nñ]o|exposici[oó]n|\d{1,2}\s*[–—-]\s*\d{1,2}\s*dic",
    re.IGNORECASE,
)
_CLOSURE_THIRDPARTY_RE = re.compile(
    r"s[eé]g[uú]n\s+(el\s+|la\s+)?(comercio|local|tienda|taller|productor|edificio|bar)\b",
    re.IGNORECASE,
)
_IRREGULAR_QUALIFIER_RE = re.compile(r"muchos|variable", re.IGNORECASE)
_SCHEDULED_UNSPEC_RE = re.compile(r"program|puntual|mantenimiento", re.IGNORECASE)


def classify_closures(raw) -> str:
    text = _norm(raw)
    if not text:
        return "missing"
    low = text.lower()
    if low.startswith("sin cierre"):
        return "no-ordinary-closure-with-caveat" if ";" in text else "no-known-closure"
    if _CLOSURE_ENV_RE.search(text):
        return "weather-or-tide-dependent"
    if _WEEKDAY_RE.search(text):
        return "irregular-weekday-pattern" if _IRREGULAR_QUALIFIER_RE.search(text) else "recurring-weekday-named"
    if _TEMP_SPECIFIC_RE.search(text):
        return "temporary-specific-closure"
    if _CLOSURE_THIRDPARTY_RE.search(text):
        return "third-party-operator-dependent"
    if _SCHEDULED_UNSPEC_RE.search(text):
        return "scheduled-but-unspecified"
    if _IRREGULAR_QUALIFIER_RE.search(text):
        return "explicit-unknown-variable"
    return "qualitative-uncategorized"


CLOSURES_RULES: List[Tuple[str, Callable[[str], bool]]] = [
    ("missing", lambda t: not t),
    ("sin-cierre-family", lambda t: t.lower().startswith("sin cierre")),
    ("weather-or-tide-dependent", lambda t: bool(_CLOSURE_ENV_RE.search(t))),
    ("weekday-family", lambda t: bool(_WEEKDAY_RE.search(t))),
    ("temporary-specific-closure", lambda t: bool(_TEMP_SPECIFIC_RE.search(t))),
    ("third-party-operator-dependent", lambda t: bool(_CLOSURE_THIRDPARTY_RE.search(t))),
    ("scheduled-but-unspecified", lambda t: bool(_SCHEDULED_UNSPEC_RE.search(t))),
    ("explicit-unknown-variable", lambda t: bool(_IRREGULAR_QUALIFIER_RE.search(t))),
    ("qualitative-uncategorized", lambda t: True),
]

CLOSURES_TIER = {
    "missing": "UNKNOWN",
    "no-known-closure": "SAFE",
    "no-ordinary-closure-with-caveat": "PARTIAL",
    "weather-or-tide-dependent": "OPAQUE",
    "recurring-weekday-named": "PARTIAL",
    "irregular-weekday-pattern": "OPAQUE",
    "temporary-specific-closure": "OPAQUE",
    "third-party-operator-dependent": "OPAQUE",
    "scheduled-but-unspecified": "UNKNOWN",
    "explicit-unknown-variable": "UNKNOWN",
    "qualitative-uncategorized": "UNKNOWN",
}

# ---------------------------------------------------------------------------------------
# bestTime — editorial recommendation text, deliberately never parsed into an interval.
# See docs/TEMPORAL_DATA_CONTRACT.md, "bestTime boundary": this classifier looks at nothing
# but whether the field is present. It must never branch on the field's *content* the way
# classify_hours does, because bestTime is not opening-hours data.
# ---------------------------------------------------------------------------------------


def classify_best_time(raw) -> str:
    text = _norm(raw)
    if not text:
        return "missing"
    return "editorial-recommendation"


BEST_TIME_TIER = {
    "missing": "UNKNOWN",
    "editorial-recommendation": "OPAQUE",
}

# ---------------------------------------------------------------------------------------
# reservation.raw / reservation.required
# ---------------------------------------------------------------------------------------

_RESERVATION_RAW_MAP = {
    "no": "not-required",
    "sí": "required",
    "si": "required",
    "recomendable": "recommended-not-required",
    "opcional": "optional-not-required",
    "no para espectador": "not-required-role-specific",
}


def classify_reservation_raw(raw) -> str:
    text = _norm(raw)
    if not text:
        return "missing"
    return _RESERVATION_RAW_MAP.get(text.lower(), "unrecognized-value")


RESERVATION_RAW_TIER = {
    "missing": "UNKNOWN",
    "not-required": "SAFE",
    "required": "SAFE",
    "recommended-not-required": "PARTIAL",
    "optional-not-required": "PARTIAL",
    "not-required-role-specific": "PARTIAL",
    "unrecognized-value": "UNKNOWN",
}

# ---------------------------------------------------------------------------------------
# reservation.leadTime
# ---------------------------------------------------------------------------------------

_BARE_MAGNITUDE_RE = re.compile(
    r"^(\d+\s*[–—-]\s*\d+\s*)?(d[ií]as?(/semanas?)?|semanas?(/meses?)?|meses?)$",
    re.IGNORECASE,
)


def classify_lead_time(raw) -> str:
    text = _norm(raw)
    if not text or text == "—":
        return "not-applicable"
    if _BARE_MAGNITUDE_RE.match(text):
        return "bare-magnitude"
    return "opaque-entity-or-mechanism-specific"


LEAD_TIME_TIER = {
    "not-applicable": "SAFE",
    "bare-magnitude": "PARTIAL",
    "opaque-entity-or-mechanism-specific": "OPAQUE",
}

# ---------------------------------------------------------------------------------------
# febMar2027.status — audited as its OWN axis, never merged into the weekly-hours/closures
# domain above. A status here describes confidence about the Feb-Mar 2027 TRIP WINDOW as a
# whole; it is never equivalent to a specific weekday/hour closure rule. This classifier
# looks at `status` only — see docs/TEMPORAL_DATA_CONTRACT.md, "febMar2027 boundary": the
# free-text `warning`/`action` fields are audited separately (uniqueness only, never
# structurally parsed) and never feed this function.
# ---------------------------------------------------------------------------------------


def classify_feb_mar_status(raw) -> str:
    text = _norm(raw).upper()
    if not text:
        return "missing"
    if "VENTA FUTURA" in text or "SORTEO" in text or "CUPO LIMITADO" in text:
        return "sale-or-lottery-limited"
    if "RIESGO" in text or "VARIABLE POR MAR" in text:
        return "seasonal-risk"
    if "MANTENIMIENTO" in text or "OBRAS" in text:
        return "maintenance-or-works"
    if "CIERRE PARCIAL" in text:
        return "partial-closure-in-effect"
    if "PATR" in text and "HIST" in text:
        return "historical-pattern-inference"
    if "OPORTUNIDAD" in text:
        return "seasonal-opportunity"
    if "SAGRAD" in text:
        return "ritual-access-restriction-pending"
    has_pending = "PENDIENTE" in text
    has_confirmado = "CONFIRMADO" in text
    if has_confirmado and not has_pending:
        return "confirmed"
    if text.startswith("ABIERTO"):
        return "open-with-condition"
    if has_pending:
        return "pending-verification"
    return "uncategorized"


FEB_MAR_STATUS_TIER = {
    "missing": "UNKNOWN",
    "confirmed": "SAFE",
    "open-with-condition": "PARTIAL",
    "pending-verification": "UNKNOWN",
    "seasonal-risk": "OPAQUE",
    "seasonal-opportunity": "OPAQUE",
    "sale-or-lottery-limited": "OPAQUE",
    "maintenance-or-works": "OPAQUE",
    "partial-closure-in-effect": "PARTIAL",
    "historical-pattern-inference": "OPAQUE",
    "ritual-access-restriction-pending": "OPAQUE",
    "uncategorized": "UNKNOWN",
}
