#!/usr/bin/env python3
"""Phase 3D-A — Temporal Data Audit.

Reads the canonical `data/places.json` (never `app/src/data/places.json` — see
docs/DATA_MODEL.md's source-to-application rule; this script only reads, and both copies are
required to be byte-identical) and reports, for every one of the 214 places, which pattern
family each of the following fields' current value falls into:

  - schedule.hours
  - schedule.closures
  - bestTime
  - reservation.required / reservation.raw / reservation.leadTime
  - febMar2027.status

It makes ZERO network requests, modifies NOTHING, and computes every count from the checked-out
dataset at run time — nothing here hardcodes "214" as a place count the way
`scripts/validate-dataset.py` does (that already-existing check is this script's precondition,
not something to duplicate). Two runs against the same `data/places.json` always print
byte-identical output.

Usage:
    python3 scripts/audit-temporal-data.py [data-dir]

Exits non-zero with a clear message if `data-dir/places.json` is missing, is not a JSON array,
or any place is missing one of the six audited fields — that is a malformed-input error, not
something this script silently tolerates or guesses around.
"""
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from temporal_data_lib import (  # noqa: E402
    BEST_TIME_TIER,
    CLOSURES_TIER,
    FEB_MAR_STATUS_TIER,
    HOURS_TIER,
    LEAD_TIME_TIER,
    RESERVATION_RAW_TIER,
    classify_best_time,
    classify_closures,
    classify_feb_mar_status,
    classify_hours,
    classify_lead_time,
    classify_reservation_raw,
)

TIERS = ("SAFE", "PARTIAL", "OPAQUE", "UNKNOWN")


def load_places(data_dir: Path):
    """Reads and shape-validates `places.json`. Raises `SystemExit` with a specific, human-
    readable reason on any structural problem — this script must fail loudly, never guess a
    default for a place that doesn't have the shape it expects."""
    path = data_dir / "places.json"
    if not path.exists():
        raise SystemExit(f"FAILED: {path} does not exist")
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise SystemExit(f"FAILED: could not read {path}: {exc}") from exc
    try:
        places = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"FAILED: {path} is not valid JSON: {exc}") from exc
    if not isinstance(places, list) or not places:
        raise SystemExit(f"FAILED: {path} must contain a non-empty JSON array, found {type(places).__name__}")

    required_shape = {
        "id": str,
        "schedule": dict,
        "bestTime": (str, type(None)),
        "reservation": dict,
        "febMar2027": dict,
    }
    for index, place in enumerate(places):
        if not isinstance(place, dict):
            raise SystemExit(f"FAILED: places[{index}] is not an object")
        for field, expected_type in required_shape.items():
            if field not in place:
                raise SystemExit(f"FAILED: places[{index}] (id={place.get('id')!r}) missing required field {field!r}")
            if not isinstance(place[field], expected_type):
                raise SystemExit(
                    f"FAILED: places[{index}] (id={place.get('id')!r}) field {field!r} has "
                    f"unexpected type {type(place[field]).__name__}"
                )
        schedule = place["schedule"]
        for field in ("hours", "closures"):
            if field not in schedule:
                raise SystemExit(f"FAILED: places[{index}] (id={place.get('id')!r}) missing schedule.{field}")
        reservation = place["reservation"]
        for field in ("required", "leadTime", "raw"):
            if field not in reservation:
                raise SystemExit(f"FAILED: places[{index}] (id={place.get('id')!r}) missing reservation.{field}")
        feb_mar = place["febMar2027"]
        for field in ("status", "warning", "action"):
            if field not in feb_mar:
                raise SystemExit(f"FAILED: places[{index}] (id={place.get('id')!r}) missing febMar2027.{field}")

    return places


def audit_field(places, extractor, classifier, tier_map, examples_per_category=3):
    """Classifies `extractor(place)` for every place, and returns:
      - `categories`: {category: {"count": int, "tier": str, "examples": [str, ...]}}
        sorted deterministically (category name, ascending) when iterated.
      - `tier_totals`: {tier: count} across all places for this field.
    Both are computed fresh from `places` every call — nothing here is cached or hardcoded.
    """
    categories = {}
    tier_totals = {tier: 0 for tier in TIERS}
    # Iterating places in their existing (id-ordered) sequence makes "first N distinct raw
    # values seen" a deterministic, reproducible choice of examples rather than dependent on
    # dict/set iteration order.
    for place in places:
        raw = extractor(place)
        category = classifier(raw)
        tier = tier_map.get(category, "UNKNOWN")
        tier_totals[tier] += 1
        bucket = categories.setdefault(category, {"count": 0, "tier": tier, "examples": []})
        bucket["count"] += 1
        text = "" if raw is None else str(raw)
        if text and text not in bucket["examples"] and len(bucket["examples"]) < examples_per_category:
            bucket["examples"].append(text)
    return categories, tier_totals


def print_field_report(title, categories, tier_totals, total_places):
    print(f"\n--- {title} ---")
    for category in sorted(categories):
        info = categories[category]
        examples = "; ".join(repr(e) for e in info["examples"])
        print(f"  {info['count']:>4} [{info['tier']:<7}] {category:<34} e.g. {examples}")
    print(
        "  Tier totals: "
        + ", ".join(f"{tier}={tier_totals[tier]}" for tier in TIERS)
        + f" (of {total_places})"
    )


def run_audit(data_dir: Path):
    places = load_places(data_dir)
    total = len(places)
    print(f"Phase 3D-A Temporal Data Audit — {total} places from {data_dir / 'places.json'}")
    print("Zero network requests. Read-only. Deterministic — reruns on unchanged data match byte-for-byte.")

    hours_categories, hours_tiers = audit_field(
        places, lambda p: p["schedule"]["hours"], classify_hours, HOURS_TIER
    )
    print_field_report("schedule.hours", hours_categories, hours_tiers, total)

    closures_categories, closures_tiers = audit_field(
        places, lambda p: p["schedule"]["closures"], classify_closures, CLOSURES_TIER
    )
    print_field_report("schedule.closures", closures_categories, closures_tiers, total)

    best_time_categories, best_time_tiers = audit_field(
        places, lambda p: p["bestTime"], classify_best_time, BEST_TIME_TIER
    )
    print_field_report("bestTime (editorial only — never an availability interval)", best_time_categories, best_time_tiers, total)

    reservation_categories, reservation_tiers = audit_field(
        places, lambda p: p["reservation"]["raw"], classify_reservation_raw, RESERVATION_RAW_TIER
    )
    print_field_report("reservation.raw", reservation_categories, reservation_tiers, total)

    lead_time_categories, lead_time_tiers = audit_field(
        places, lambda p: p["reservation"]["leadTime"], classify_lead_time, LEAD_TIME_TIER
    )
    print_field_report("reservation.leadTime", lead_time_categories, lead_time_tiers, total)

    feb_mar_categories, feb_mar_tiers = audit_field(
        places, lambda p: p["febMar2027"]["status"], classify_feb_mar_status, FEB_MAR_STATUS_TIER
    )
    print_field_report(
        "febMar2027.status (own axis — never a weekly-hours/closure fact)", feb_mar_categories, feb_mar_tiers, total
    )

    # ---- Real defects/boundary findings this audit surfaces, computed from the data itself
    # (never asserted as a fixed number — recomputed every run) -------------------------------
    non_binary_reservation_raw = sum(
        1
        for p in places
        if classify_reservation_raw(p["reservation"]["raw"])
        in ("recommended-not-required", "optional-not-required", "not-required-role-specific")
    )
    unique_warnings = len({p["febMar2027"]["warning"] for p in places})
    unique_actions = len({p["febMar2027"]["action"] for p in places})

    print("\n--- Findings ---")
    print(
        f"  {non_binary_reservation_raw}/{total} places have a reservation.raw value that is "
        "neither 'No' nor 'Sí' (e.g. 'Recomendable', 'Opcional', 'No para espectador'); "
        "reservation.required collapses every one of them to false, losing that nuance."
    )
    print(
        f"  febMar2027.warning has {unique_warnings} unique values and febMar2027.action has "
        f"{unique_actions} unique values across {total} places — heavily deduplicated editorial "
        "text, not per-place authored prose."
    )

    print("\n--- Overall coverage (safe to build on today) ---")
    for field_name, tiers in (
        ("schedule.hours", hours_tiers),
        ("schedule.closures", closures_tiers),
        ("bestTime", best_time_tiers),
        ("reservation.raw", reservation_tiers),
        ("reservation.leadTime", lead_time_tiers),
        ("febMar2027.status", feb_mar_tiers),
    ):
        print(
            f"  {field_name:<22} SAFE={tiers['SAFE']:>3}/{total}  PARTIAL={tiers['PARTIAL']:>3}/{total}  "
            f"OPAQUE={tiers['OPAQUE']:>3}/{total}  UNKNOWN={tiers['UNKNOWN']:>3}/{total}"
        )

    return {
        "total": total,
        "hours": (hours_categories, hours_tiers),
        "closures": (closures_categories, closures_tiers),
        "bestTime": (best_time_categories, best_time_tiers),
        "reservationRaw": (reservation_categories, reservation_tiers),
        "leadTime": (lead_time_categories, lead_time_tiers),
        "febMarStatus": (feb_mar_categories, feb_mar_tiers),
    }


def main():
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    run_audit(data_dir)


if __name__ == "__main__":
    main()
