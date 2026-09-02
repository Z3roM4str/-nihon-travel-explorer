#!/usr/bin/env python3
"""Integrity checks for the exported dataset in data/*.json.

Usage:
    python3 scripts/validate-dataset.py [data-dir]

Exits non-zero and prints every failing check if anything is wrong; otherwise prints a
one-line OK summary. Does not touch the workbook — this only checks the JSON output.
"""
import json
import sys
from pathlib import Path

EXPECTED_PLACE_COUNT = 214
EXPECTED_NEARBY_COUNT = 403
JAPAN_BBOX = {"lat_min": 20, "lat_max": 46, "lng_min": 122, "lng_max": 154}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check(dataset_dir):
    errors = []

    places = load(dataset_dir / "places.json")
    nearby = load(dataset_dir / "nearby.json")

    if len(places) != EXPECTED_PLACE_COUNT:
        errors.append(f"expected {EXPECTED_PLACE_COUNT} places, found {len(places)}")

    ids = [p["id"] for p in places]
    if len(ids) != len(set(ids)):
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        errors.append(f"duplicate place ids: {dupes}")

    for place in places:
        lat, lng = place["coordinates"]["lat"], place["coordinates"]["lng"]
        if lat is None or lng is None:
            errors.append(f"{place['id']}: missing coordinates")
        elif not (JAPAN_BBOX["lat_min"] <= lat <= JAPAN_BBOX["lat_max"] and
                   JAPAN_BBOX["lng_min"] <= lng <= JAPAN_BBOX["lng_max"]):
            errors.append(f"{place['id']}: coordinates out of Japan bounding box ({lat}, {lng})")

    if len(nearby) != EXPECTED_NEARBY_COUNT:
        errors.append(f"expected {EXPECTED_NEARBY_COUNT} nearby relations, found {len(nearby)}")

    ids_set = set(ids)
    broken = [
        (r["Desde ID"], r["Hacia ID"])
        for r in nearby
        if r["Desde ID"] not in ids_set or r["Hacia ID"] not in ids_set
    ]
    if broken:
        errors.append(f"nearby relations with an id not in places.json: {broken}")

    # The 3 Phase 2 editorial corrections must be present.
    by_id = {p["id"]: p for p in places}

    okinawa_region_count = sum(1 for p in places if p["hub"] == "Okinawa" and p["region"] == "Okinawa")
    if okinawa_region_count != 50:
        errors.append(f"expected 50 Okinawa-hub places with region 'Okinawa', found {okinawa_region_count}")
    if any(p["region"] == "Kyushu/Okinawa" for p in places):
        errors.append("stray 'Kyushu/Okinawa' region value still present")

    naoshima = by_id.get("JP-152")
    if not naoshima or naoshima["region"] != "Shikoku" or naoshima["prefecture"] != "Kagawa":
        errors.append(f"JP-152 Naoshima should be prefecture=Kagawa, region=Shikoku; got {naoshima}")

    if by_id.get("JP-203", {}).get("nearbyIds") != ["JP-204"]:
        errors.append(f"JP-203 nearbyIds should be ['JP-204']; got {by_id.get('JP-203', {}).get('nearbyIds')}")
    if by_id.get("JP-204", {}).get("nearbyIds") != ["JP-203"]:
        errors.append(f"JP-204 nearbyIds should be ['JP-203']; got {by_id.get('JP-204', {}).get('nearbyIds')}")

    return errors, len(places), len(nearby)


def main():
    dataset_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    errors, place_count, nearby_count = check(dataset_dir)
    if errors:
        print(f"FAILED ({len(errors)} issue(s)):")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    print(f"OK: {place_count} places, {nearby_count} nearby relations, 0 broken references, "
          f"3 editorial corrections present.")


if __name__ == "__main__":
    main()
