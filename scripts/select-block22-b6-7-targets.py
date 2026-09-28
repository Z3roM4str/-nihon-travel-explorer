#!/usr/bin/env python3
"""Derive the complete B6.7 Grade-A editorial matrix from current data and metadata."""
import argparse
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACES = ROOT / "data/places.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
PREVIOUS_A_EXCEPTIONS = {
    "JP-050", "JP-079", "JP-095", "JP-120", "JP-121", "JP-168", "JP-195", "JP-202",
}


def derive(places, records):
    by_place = defaultdict(list)
    for record in records:
        by_place[record["placeId"]].append(record)

    rows = []
    for place in places:
        if place.get("grade") != "A":
            continue
        photos = by_place.get(place["id"], [])
        roles = sorted({record.get("role", "?") for record in photos})
        tourism_level = place.get("tourismLevel")
        is_tourism = tourism_level in {"Extremo", "Alto"}
        is_hidden_gem = place.get("hiddenGemStatus") == "Hidden Gem real"
        subset = [label for label, active in (
            ("Extremo", tourism_level == "Extremo"),
            ("Alto", tourism_level == "Alto"),
            ("Hidden Gem real", is_hidden_gem),
        ) if active]
        has_identity = any(record.get("role") == "identity" for record in photos)
        is_target = (
            (is_tourism or is_hidden_gem)
            and len(photos) == 1
            and has_identity
            and place["id"] not in PREVIOUS_A_EXCEPTIONS
        )
        rows.append({
            "id": place["id"],
            "name": place["name"],
            "hub": place["hub"],
            "tourismLevel": tourism_level,
            "hiddenGemStatus": place.get("hiddenGemStatus"),
            "photos": len(photos),
            "roles": roles,
            "subset": subset,
            "targetB67": is_target,
            "hasIdentity": has_identity,
            "isTourism": is_tourism,
            "isHiddenGemReal": is_hidden_gem,
        })

    a_places = [place for place in places if place.get("grade") == "A"]
    a_by_id = {place["id"]: place for place in a_places}
    a_rows = {row["id"]: row for row in rows}
    tourism_ids = {place["id"] for place in a_places if place.get("tourismLevel") in {"Extremo", "Alto"}}
    extreme_ids = {place["id"] for place in a_places if place.get("tourismLevel") == "Extremo"}
    high_ids = {place["id"] for place in a_places if place.get("tourismLevel") == "Alto"}
    hidden_gem_ids = {place["id"] for place in a_places if place.get("hiddenGemStatus") == "Hidden Gem real"}
    qualified_ids = tourism_ids | hidden_gem_ids
    counts = {
        "aTotal": len(a_places),
        "aWithIdentity": sum(row["hasIdentity"] for row in rows),
        "aWithoutIdentity": sum(not row["hasIdentity"] for row in rows),
        "aExtremo": len(extreme_ids),
        "aAlto": len(high_ids),
        "aHiddenGemReal": len(hidden_gem_ids),
        "tourismUnionHiddenGem": len(qualified_ids),
        "tourismHiddenGemIntersection": len(tourism_ids & hidden_gem_ids),
        "qualifiedWithOnePhoto": sum(a_rows[pid]["photos"] == 1 for pid in qualified_ids),
        "qualifiedWithTwoOrMore": sum(a_rows[pid]["photos"] >= 2 for pid in qualified_ids),
        "qualifiedWithoutPhoto": sum(a_rows[pid]["photos"] == 0 for pid in qualified_ids),
        "qualifiedWithoutPhotoPriorException": sum(
            a_rows[pid]["photos"] == 0 and pid in PREVIOUS_A_EXCEPTIONS for pid in qualified_ids
        ),
        "targets": sum(row["targetB67"] for row in rows),
    }
    return {
        "rows": rows,
        "counts": counts,
        "tourismIds": sorted(tourism_ids),
        "hiddenGemRealIds": sorted(hidden_gem_ids),
        "qualifiedIds": sorted(qualified_ids),
        "previousExceptions": sorted(PREVIOUS_A_EXCEPTIONS),
        "targets": [row["id"] for row in rows if row["targetB67"]],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Print the derived matrix and counts as JSON.")
    args = parser.parse_args()
    places = json.loads(PLACES.read_text(encoding="utf-8"))
    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    result = derive(places, metadata["images"])
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    print("COUNTS")
    print(json.dumps(result["counts"], ensure_ascii=False, indent=2))
    print("ID\tLugar\tHub\ttourismLevel\thiddenGemStatus\tfotos\troles\tsubset\ttarget B6.7")
    for row in result["rows"]:
        print("\t".join((
            row["id"], row["name"], row["hub"], str(row["tourismLevel"] or "—"),
            str(row["hiddenGemStatus"] or "—"), str(row["photos"]),
            ",".join(row["roles"]) or "—", ",".join(row["subset"]) or "—",
            "sí" if row["targetB67"] else "no",
        )))


if __name__ == "__main__":
    main()
