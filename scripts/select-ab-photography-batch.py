#!/usr/bin/env python3
"""Deterministic selector for Phase 4J A+B photography acquisition batch.

Pure/offline selection only. Implements the Phase 4I coverage-rebalancing
design contract exactly.
"""
import argparse
import json
from pathlib import Path

TRANCHE_SIZE = 32
ALLOWED_GRADES = {"A", "B"}
CARRIED_FAILED_CLOSED_IDS = {
    "JP-033", "JP-126", "JP-203", "JP-204",
    "JP-050", "JP-195",
    "JP-121", "JP-156", "JP-095", "JP-079", "JP-202",
}
TEMPORAL_CATEGORIES = {"🎆 Eventos", "🐋 Fauna y experiencias estacionales"}
TEMPORAL_NAME_TOKENS = ("festival", "tournament", "animejapan")
GRADE_PRIORITY = {"A": 0, "B": 1}
DEFAULT_OUT = Path("data/visual/a-b-photography-batch.json")


def utf16_key(value):
    """Stable ECMAScript-like code-unit ordering for deterministic tiebreaks."""
    return value.encode("utf-16-be")


def is_temporal_risk(place):
    name = place.get("name", "").casefold()
    return (
        place.get("category") in TEMPORAL_CATEGORIES
        or any(token in name for token in TEMPORAL_NAME_TOKENS)
    )


def eligible_places(places, photography_records):
    covered = {record["placeId"] for record in photography_records}
    return [
        place
        for place in places
        if place.get("grade") in ALLOWED_GRADES
        and place["id"] not in covered
        and place["id"] not in CARRIED_FAILED_CLOSED_IDS
    ]


def allocate_hub_quotas(eligible, tranche_size=TRANCHE_SIZE):
    hubs = sorted({p["hub"] for p in eligible}, key=utf16_key)
    if tranche_size < len(hubs):
        raise ValueError("tranche is too small to give one seat to every eligible hub")

    counts = {hub: sum(1 for p in eligible if p["hub"] == hub) for hub in hubs}
    quotas = {hub: 1 for hub in hubs}
    remaining = tranche_size - len(hubs)
    residual_total = sum(max(counts[hub] - 1, 0) for hub in hubs)
    if remaining and residual_total <= 0:
        raise ValueError("not enough residual candidates to fill tranche")

    remainders = []
    floor_assigned = 0
    for hub in hubs:
        residual = max(counts[hub] - 1, 0)
        raw = remaining * residual / residual_total if residual_total else 0
        floor = int(raw)
        quotas[hub] += floor
        floor_assigned += floor
        remainders.append((raw - floor, hub))

    remainders.sort(key=lambda item: (-item[0], utf16_key(item[1])))
    for _remainder, hub in remainders[: remaining - floor_assigned]:
        quotas[hub] += 1

    if sum(quotas.values()) != tranche_size:
        raise AssertionError("hub quotas do not sum to tranche size")
    if any(quotas[hub] > counts[hub] for hub in hubs):
        raise AssertionError("hub quota exceeds eligible candidates")
    return hubs, counts, quotas


def select_batch(places, photography_records, tranche_size=TRANCHE_SIZE):
    eligible = eligible_places(places, photography_records)
    if len(eligible) < tranche_size:
        raise ValueError("not enough eligible A+B uncovered places")

    photographed_ids = {record["placeId"] for record in photography_records}
    by_id = {place["id"]: place for place in places}

    photographed_by_category = {}
    for place_id in photographed_ids:
        place = by_id.get(place_id)
        if place:
            category = place["category"]
            photographed_by_category[category] = photographed_by_category.get(category, 0) + 1

    eligible_by_category = {}
    for place in eligible:
        category = place["category"]
        eligible_by_category[category] = eligible_by_category.get(category, 0) + 1

    hubs, counts, quotas = allocate_hub_quotas(eligible, tranche_size)
    pools = {hub: [p for p in eligible if p["hub"] == hub] for hub in hubs}
    selected_in_hub = {hub: 0 for hub in hubs}
    selected_by_category = {}
    selected = []

    while len(selected) < tranche_size:
        progressed = False
        for hub in hubs:
            if len(selected) >= tranche_size:
                break
            if selected_in_hub[hub] >= quotas[hub]:
                continue

            def priority(place):
                category = place["category"]
                return (
                    selected_by_category.get(category, 0),
                    photographed_by_category.get(category, 0),
                    GRADE_PRIORITY[place["grade"]],
                    1 if is_temporal_risk(place) else 0,
                    eligible_by_category.get(category, 0),
                    utf16_key(place["id"]),
                )

            pools[hub].sort(key=priority)
            if not pools[hub]:
                raise AssertionError(f"hub {hub!r} ran out of candidates")

            pick = pools[hub].pop(0)
            selected.append(pick)
            selected_in_hub[hub] += 1
            category = pick["category"]
            selected_by_category[category] = selected_by_category.get(category, 0) + 1
            progressed = True

        if not progressed:
            raise AssertionError("selector stalled before filling tranche")

    grade_counts = {}
    for place in selected:
        grade = place["grade"]
        grade_counts[grade] = grade_counts.get(grade, 0) + 1

    return {
        "version": 1,
        "trancheSize": tranche_size,
        "eligibleCount": len(eligible),
        "hubEligibleCounts": counts,
        "hubQuotas": quotas,
        "gradeCounts": grade_counts,
        "distinctCategoryCount": len({p["category"] for p in selected}),
        "places": [
            {
                "placeId": p["id"],
                "hub": p["hub"],
                "grade": p["grade"],
                "name": p["name"],
                "category": p["category"],
                "temporalRisk": is_temporal_risk(p),
                "intendedImageCount": 1,
            }
            for p in selected
        ],
    }


def load_json(path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--places", default="data/places.json")
    parser.add_argument("--photography", default="data/visual/photography-metadata.json")
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    places_doc = load_json(Path(args.places))
    places = places_doc if isinstance(places_doc, list) else places_doc["places"]
    photography = load_json(Path(args.photography))
    manifest = select_batch(places, photography["images"])

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        "OK: wrote "
        f"{manifest['trancheSize']} targets "
        f"({manifest['gradeCounts']}) to {out}"
    )


if __name__ == "__main__":
    main()
