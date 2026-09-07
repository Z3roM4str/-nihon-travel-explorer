#!/usr/bin/env python3
"""Phase 3D-A — Temporal Data Audit.

Reads the canonical `data/places.json` (never `app/src/data/places.json` — see
docs/DATA_MODEL.md's source-to-application rule; this script only reads, and both copies are
required to be byte-identical) and reports, for every one of the 214 places, which pattern
family each of the following fields' current value falls into:

  - schedule.hours
  - schedule.closures
  - bestTime
  - reservation.required (audited independently, including a cross-check against
    reservation.raw) / reservation.raw / reservation.leadTime
  - febMar2027.status
  - febMar2027.warning / febMar2027.action (presence/uniqueness only — never structurally
    parsed; see `classify_editorial_prose` in `temporal_data_lib.py`)

Every quantitative claim this script makes (category counts, tier totals, distinct-raw-value
counts, raw-value frequencies) is computed fresh from the checked-out dataset at run time —
nothing here hardcodes "214" as a place count the way `scripts/validate-dataset.py` does (that
already-existing check is this script's precondition, not something to duplicate), and nothing
in `docs/TEMPORAL_DATA_CONTRACT.md` should cite a number this script does not itself emit. Two
runs against the same `data/places.json` always print byte-identical output.

It makes ZERO network requests and modifies NOTHING.

Usage:
    python3 scripts/audit-temporal-data.py [data-dir]

Exits non-zero with a clear message if `data-dir/places.json` is missing, is not a JSON array, or
any place is missing one of the audited fields OR has one with the wrong type for the canonical
dataset contract (`app/src/types.ts` / `docs/DATA_MODEL.md`) — e.g. `schedule.hours` as a number,
`reservation.required` as a string, `febMar2027.warning` as a list. That is a malformed-input
error, never something this script silently tolerates, stringifies, or classifies as ordinary
"unknown" text.
"""
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from temporal_data_lib import (  # noqa: E402
    BEST_TIME_TIER,
    CLOSURES_TIER,
    EDITORIAL_PROSE_TIER,
    FEB_MAR_STATUS_TIER,
    HOURS_TIER,
    LEAD_TIME_TIER,
    RESERVATION_RAW_TIER,
    classify_best_time,
    classify_closures,
    classify_editorial_prose,
    classify_feb_mar_status,
    classify_hours,
    classify_lead_time,
    classify_reservation_consistency,
    classify_reservation_raw,
)

TIERS = ("SAFE", "PARTIAL", "OPAQUE", "UNKNOWN")

# The canonical `Place` contract (app/src/types.ts, docs/DATA_MODEL.md): every one of these
# fields is declared as a plain, non-optional `string`, except `reservation.required`, which is
# a plain `boolean`. None of them is nullable in that contract, so `None` is rejected here too —
# a prior, looser version of this loader accepted `bestTime: None`, which does not match the
# type the rest of the application already assumes.
_NESTED_STRING_FIELDS = {
    "schedule": ("hours", "closures"),
    "reservation": ("leadTime", "raw"),
    "febMar2027": ("status", "warning", "action"),
}


def load_places(data_dir: Path):
    """Reads and shape-validates `places.json` against the canonical dataset contract. Raises
    `SystemExit` with a specific, human-readable reason on any structural problem — missing
    field, wrong container type, or wrong leaf type (e.g. a number where the contract requires a
    string, a string where it requires a boolean) — never silently coerces a malformed value
    into something that would classify as ordinary text."""
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

    top_level_shape = {
        "id": str,
        "schedule": dict,
        "bestTime": str,
        "reservation": dict,
        "febMar2027": dict,
    }
    for index, place in enumerate(places):
        if not isinstance(place, dict):
            raise SystemExit(f"FAILED: places[{index}] is not an object")
        for field, expected_type in top_level_shape.items():
            if field not in place:
                raise SystemExit(f"FAILED: places[{index}] (id={place.get('id')!r}) missing required field {field!r}")
            value = place[field]
            if not isinstance(value, expected_type):
                raise SystemExit(
                    f"FAILED: places[{index}] (id={place.get('id')!r}) field {field!r} must be "
                    f"{expected_type.__name__}, found {type(value).__name__} ({value!r})"
                )

        for parent, children in _NESTED_STRING_FIELDS.items():
            container = place[parent]
            for child in children:
                if child not in container:
                    raise SystemExit(f"FAILED: places[{index}] (id={place.get('id')!r}) missing {parent}.{child}")
                value = container[child]
                if not isinstance(value, str):
                    raise SystemExit(
                        f"FAILED: places[{index}] (id={place.get('id')!r}) field {parent}.{child} must be "
                        f"str, found {type(value).__name__} ({value!r})"
                    )

        reservation = place["reservation"]
        if "required" not in reservation:
            raise SystemExit(f"FAILED: places[{index}] (id={place.get('id')!r}) missing reservation.required")
        required_value = reservation["required"]
        # `bool` is a subclass of `int` in Python, but nothing here expects `int`, so a plain
        # `isinstance(..., bool)` check is exact: it accepts `True`/`False` and rejects every
        # other type, including a string like `"false"` or an int like `1`/`0`.
        if not isinstance(required_value, bool):
            raise SystemExit(
                f"FAILED: places[{index}] (id={place.get('id')!r}) field reservation.required must be "
                f"bool, found {type(required_value).__name__} ({required_value!r})"
            )

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


def raw_value_stats(places, extractor):
    """A generic, deterministic frequency table over one field's raw values across every place:
    total place count, distinct value count, and every `(value, count)` pair — sorted by count
    descending, then value ascending, so the order never depends on dict/set hashing and is
    identical run to run. Used so every distinct-count / frequency claim in
    `docs/TEMPORAL_DATA_CONTRACT.md` is something this script actually emits, rather than a
    number computed once by hand and then hardcoded into the document."""
    counts = {}
    for place in places:
        value = extractor(place)
        text = "" if value is None else str(value)
        counts[text] = counts.get(text, 0) + 1
    frequencies = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    return {"total": len(places), "distinct": len(counts), "frequencies": frequencies}


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


def print_raw_stats(title, stats, top_n=10):
    print(f"  raw-value inventory: {stats['distinct']} distinct value(s) across {stats['total']} places")
    shown = stats["frequencies"][:top_n]
    for value, count in shown:
        print(f"    {count:>4}  {value!r}")
    remaining = len(stats["frequencies"]) - len(shown)
    if remaining > 0:
        print(f"    ... and {remaining} more distinct value(s) not shown")


def run_audit(data_dir: Path):
    places = load_places(data_dir)
    total = len(places)
    print(f"Phase 3D-A Temporal Data Audit — {total} places from {data_dir / 'places.json'}")
    print("Zero network requests. Read-only. Deterministic — reruns on unchanged data match byte-for-byte.")

    hours_categories, hours_tiers = audit_field(
        places, lambda p: p["schedule"]["hours"], classify_hours, HOURS_TIER
    )
    print_field_report("schedule.hours", hours_categories, hours_tiers, total)
    hours_stats = raw_value_stats(places, lambda p: p["schedule"]["hours"])
    print_raw_stats("schedule.hours", hours_stats)

    closures_categories, closures_tiers = audit_field(
        places, lambda p: p["schedule"]["closures"], classify_closures, CLOSURES_TIER
    )
    print_field_report("schedule.closures", closures_categories, closures_tiers, total)
    closures_stats = raw_value_stats(places, lambda p: p["schedule"]["closures"])
    print_raw_stats("schedule.closures", closures_stats)

    best_time_categories, best_time_tiers = audit_field(
        places, lambda p: p["bestTime"], classify_best_time, BEST_TIME_TIER
    )
    print_field_report("bestTime (editorial only — never an availability interval)", best_time_categories, best_time_tiers, total)
    best_time_stats = raw_value_stats(places, lambda p: p["bestTime"])
    print_raw_stats("bestTime", best_time_stats)

    reservation_categories, reservation_tiers = audit_field(
        places, lambda p: p["reservation"]["raw"], classify_reservation_raw, RESERVATION_RAW_TIER
    )
    print_field_report("reservation.raw", reservation_categories, reservation_tiers, total)
    reservation_raw_stats = raw_value_stats(places, lambda p: p["reservation"]["raw"])
    print_raw_stats("reservation.raw", reservation_raw_stats)

    # ---- reservation.required — audited independently, never assumed to agree with raw -------
    required_true = sum(1 for p in places if p["reservation"]["required"] is True)
    required_false = total - required_true
    consistency_labels = [
        classify_reservation_consistency(p["reservation"]["raw"], p["reservation"]["required"])
        for p in places
    ]
    consistency_counts = {}
    for label in consistency_labels:
        consistency_counts[label] = consistency_counts.get(label, 0) + 1
    inconsistent_places = [
        (p["id"], p["reservation"]["raw"], p["reservation"]["required"], label)
        for p, label in zip(places, consistency_labels)
        if label.startswith("inconsistent-")
    ]

    print("\n--- reservation.required (boolean, cross-checked against reservation.raw) ---")
    print(f"  True={required_true}/{total}  False={required_false}/{total}")
    print("  Consistency vs. reservation.raw (per scripts/export-dataset.py's own"
          " `required = raw.lower() == \"sí\"` rule):")
    for label in sorted(consistency_counts):
        print(f"    {consistency_counts[label]:>4}  {label}")
    if inconsistent_places:
        print(f"  {len(inconsistent_places)} INCONSISTENT pair(s) found:")
        for place_id, raw_value, required_value, label in inconsistent_places:
            print(f"    {place_id}: raw={raw_value!r} required={required_value!r} ({label})")
    else:
        print("  0 inconsistent pairs found (mechanically verified across all places, not assumed).")

    lead_time_categories, lead_time_tiers = audit_field(
        places, lambda p: p["reservation"]["leadTime"], classify_lead_time, LEAD_TIME_TIER
    )
    print_field_report("reservation.leadTime", lead_time_categories, lead_time_tiers, total)
    lead_time_stats = raw_value_stats(places, lambda p: p["reservation"]["leadTime"])
    print_raw_stats("reservation.leadTime", lead_time_stats)

    feb_mar_categories, feb_mar_tiers = audit_field(
        places, lambda p: p["febMar2027"]["status"], classify_feb_mar_status, FEB_MAR_STATUS_TIER
    )
    print_field_report(
        "febMar2027.status (own axis — never a weekly-hours/closure fact)", feb_mar_categories, feb_mar_tiers, total
    )
    feb_mar_status_stats = raw_value_stats(places, lambda p: p["febMar2027"]["status"])
    print_raw_stats("febMar2027.status", feb_mar_status_stats)

    # ---- febMar2027.warning / .action — presence/uniqueness only, never structurally parsed --
    warning_categories, warning_tiers = audit_field(
        places, lambda p: p["febMar2027"]["warning"], classify_editorial_prose, EDITORIAL_PROSE_TIER
    )
    print_field_report(
        "febMar2027.warning (free editorial prose — presence/uniqueness only, never parsed)",
        warning_categories, warning_tiers, total,
    )
    warning_stats = raw_value_stats(places, lambda p: p["febMar2027"]["warning"])
    print_raw_stats("febMar2027.warning", warning_stats)

    action_categories, action_tiers = audit_field(
        places, lambda p: p["febMar2027"]["action"], classify_editorial_prose, EDITORIAL_PROSE_TIER
    )
    print_field_report(
        "febMar2027.action (free editorial prose — presence/uniqueness only, never parsed)",
        action_categories, action_tiers, total,
    )
    action_stats = raw_value_stats(places, lambda p: p["febMar2027"]["action"])
    print_raw_stats("febMar2027.action", action_stats)

    # ---- Real defects/boundary findings this audit surfaces, computed from the data itself
    # (never asserted as a fixed number — recomputed every run) -------------------------------
    non_binary_categories = ("recommended-not-required", "optional-not-required", "not-required-role-specific")
    non_binary_reservation_raw = sum(
        1 for p in places if classify_reservation_raw(p["reservation"]["raw"]) in non_binary_categories
    )
    # Mechanically re-derived from the per-place consistency check above, not assumed: any
    # non-binary place whose `required` unexpectedly came out `True` would show up here as an
    # "inconsistent-<category>-required-True" entry in `inconsistent_places`.
    non_binary_unexpectedly_true = sum(
        1
        for place_id, raw_value, required_value, label in inconsistent_places
        if classify_reservation_raw(raw_value) in non_binary_categories and required_value is True
    )
    print("\n--- Findings ---")
    print(
        f"  {non_binary_reservation_raw}/{total} places have a reservation.raw value that is "
        "neither 'No' nor 'Sí' (e.g. 'Recomendable', 'Opcional', 'No para espectador'); "
        "reservation.required collapses every one of them to false, losing that nuance — "
        f"mechanically confirmed above: {non_binary_unexpectedly_true} of them have required=True "
        "(the only way this finding could be wrong)."
    )
    print(
        f"  febMar2027.warning has {warning_stats['distinct']} unique value(s) and "
        f"febMar2027.action has {action_stats['distinct']} unique value(s) across {total} places "
        "— heavily deduplicated editorial text, not per-place authored prose."
    )

    print("\n--- Overall coverage (safe to build on today) ---")
    for field_name, tiers in (
        ("schedule.hours", hours_tiers),
        ("schedule.closures", closures_tiers),
        ("bestTime", best_time_tiers),
        ("reservation.raw", reservation_tiers),
        ("reservation.leadTime", lead_time_tiers),
        ("febMar2027.status", feb_mar_tiers),
        ("febMar2027.warning", warning_tiers),
        ("febMar2027.action", action_tiers),
    ):
        print(
            f"  {field_name:<22} SAFE={tiers['SAFE']:>3}/{total}  PARTIAL={tiers['PARTIAL']:>3}/{total}  "
            f"OPAQUE={tiers['OPAQUE']:>3}/{total}  UNKNOWN={tiers['UNKNOWN']:>3}/{total}"
        )
    print(
        f"  {'reservation.required':<22} True={required_true:>3}/{total}  False={required_false:>3}/{total}  "
        f"inconsistentWithRaw={len(inconsistent_places):>3}/{total}"
    )

    return {
        "total": total,
        "hours": (hours_categories, hours_tiers, hours_stats),
        "closures": (closures_categories, closures_tiers, closures_stats),
        "bestTime": (best_time_categories, best_time_tiers, best_time_stats),
        "reservationRaw": (reservation_categories, reservation_tiers, reservation_raw_stats),
        "reservationRequired": {
            "true": required_true,
            "false": required_false,
            "consistency": consistency_counts,
            "inconsistentPlaces": inconsistent_places,
        },
        "leadTime": (lead_time_categories, lead_time_tiers, lead_time_stats),
        "febMarStatus": (feb_mar_categories, feb_mar_tiers, feb_mar_status_stats),
        "febMarWarning": (warning_categories, warning_tiers, warning_stats),
        "febMarAction": (action_categories, action_tiers, action_stats),
    }


def main():
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    run_audit(data_dir)


if __name__ == "__main__":
    main()
