#!/usr/bin/env python3
"""Integrity checks for the geographic layer added in Phase 2C.

Usage:
    python3 scripts/validate-geography.py [repo-root]

Checks the derived prefecture polygons, the prefecture metadata, the navigation-region
taxonomy, and the join between the tourism dataset and the geography. Exits non-zero and
prints every failing check if anything is wrong.

Deliberately free of hard-coded tourism counts: it verifies that nothing is *lost* in the
join, not that a particular prefecture has a particular number of places, so refreshing the
workbook never invalidates this script.
"""
import json
import sys
import unicodedata
from pathlib import Path

EXPECTED_PREFECTURE_COUNT = 47

# Navigation taxonomy used by the Nihon interface (see docs/GEOGRAPHY.md). Product-level
# grouping for browsing, not an official administrative division.
NAVIGATION_REGIONS = [
    "Hokkaido",
    "Tohoku",
    "Kanto",
    "Chubu",
    "Kansai",
    "Chugoku",
    "Shikoku",
    "Kyushu",
    "Okinawa",
]

# Generous bounding box covering every Japanese prefecture, Okinawa and the northern
# islands included.
JAPAN_BBOX = {"lat_min": 20.0, "lat_max": 46.5, "lng_min": 122.0, "lng_max": 154.0}

REQUIRED_METADATA_FIELDS = ("code", "japaneseName", "displayName", "region")


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def normalize_key(value):
    """Mirrors normalizeKey() in app/src/data/geography.ts."""
    stripped = unicodedata.normalize("NFD", value)
    stripped = "".join(ch for ch in stripped if unicodedata.category(ch) != "Mn")
    return stripped.strip().lower()


def iter_positions(coordinates):
    if not coordinates:
        return
    if isinstance(coordinates[0], (int, float)):
        yield coordinates
        return
    for item in coordinates:
        yield from iter_positions(item)


def check(root):
    errors = []

    metadata_path = root / "app/src/data/prefectures.json"
    geojson_path = root / "app/public/geography/japan-prefectures.geojson"
    places_path = root / "data/places.json"

    for path in (metadata_path, geojson_path, places_path):
        if not path.exists():
            errors.append(f"missing required file: {path.relative_to(root)}")
    if errors:
        return errors, {}

    metadata = load(metadata_path)
    try:
        geojson = load(geojson_path)
    except json.JSONDecodeError as exc:
        return [f"{geojson_path.relative_to(root)} is not valid JSON: {exc}"], {}
    places = load(places_path)

    # ---- Prefecture metadata -------------------------------------------------
    if len(metadata) != EXPECTED_PREFECTURE_COUNT:
        errors.append(f"expected {EXPECTED_PREFECTURE_COUNT} prefectures in metadata, found {len(metadata)}")

    meta_codes = [entry.get("code") for entry in metadata]
    if len(set(meta_codes)) != len(meta_codes):
        dupes = sorted({c for c in meta_codes if meta_codes.count(c) > 1})
        errors.append(f"duplicate prefecture codes in metadata: {dupes}")

    for entry in metadata:
        code = entry.get("code")
        for field in REQUIRED_METADATA_FIELDS:
            if not entry.get(field):
                errors.append(f"prefecture {code}: missing metadata field '{field}'")
        if code and not (len(code) == 2 and code.isdigit()):
            errors.append(f"prefecture code {code!r} is not a 2-digit code")
        region = entry.get("region")
        if region and region not in NAVIGATION_REGIONS:
            errors.append(f"prefecture {code}: region {region!r} is not one of the navigation regions")

    # Exactly one navigation region per prefecture, and no prefecture listed twice.
    by_region = {region: [] for region in NAVIGATION_REGIONS}
    for entry in metadata:
        region = entry.get("region")
        if region in by_region:
            by_region[region].append(entry.get("code"))
    assigned = [code for codes in by_region.values() for code in codes]
    if len(assigned) != len(set(assigned)):
        dupes = sorted({c for c in assigned if assigned.count(c) > 1})
        errors.append(f"prefectures assigned to more than one navigation region: {dupes}")
    unassigned = sorted(set(meta_codes) - set(assigned))
    if unassigned:
        errors.append(f"prefectures without a navigation region: {unassigned}")
    empty_regions = [region for region, codes in by_region.items() if not codes]
    if empty_regions:
        errors.append(f"navigation regions with no prefecture: {empty_regions}")

    # ---- GeoJSON -------------------------------------------------------------
    if geojson.get("type") != "FeatureCollection":
        errors.append(f"geojson type should be FeatureCollection, got {geojson.get('type')!r}")
    features = geojson.get("features") or []
    if len(features) != EXPECTED_PREFECTURE_COUNT:
        errors.append(f"expected {EXPECTED_PREFECTURE_COUNT} geojson features, found {len(features)}")

    geo_codes = []
    for index, feature in enumerate(features):
        code = (feature.get("properties") or {}).get("code")
        geo_codes.append(code)
        geometry = feature.get("geometry")
        if not geometry or not geometry.get("coordinates"):
            errors.append(f"feature {index} ({code}): missing geometry")
            continue
        if geometry.get("type") not in ("Polygon", "MultiPolygon"):
            errors.append(f"feature {index} ({code}): unexpected geometry type {geometry.get('type')!r}")
        for lng, lat in iter_positions(geometry["coordinates"]):
            if not (JAPAN_BBOX["lat_min"] <= lat <= JAPAN_BBOX["lat_max"] and
                    JAPAN_BBOX["lng_min"] <= lng <= JAPAN_BBOX["lng_max"]):
                errors.append(f"feature {code}: coordinate outside Japan bounding box ({lat}, {lng})")
                break

    if len(set(geo_codes)) != len(geo_codes):
        dupes = sorted({c for c in geo_codes if geo_codes.count(c) > 1})
        errors.append(f"duplicate prefecture codes in geojson: {dupes}")

    missing_in_geo = sorted(set(meta_codes) - set(geo_codes))
    if missing_in_geo:
        errors.append(f"prefectures in metadata with no polygon: {missing_in_geo}")
    missing_in_meta = sorted(set(geo_codes) - set(meta_codes))
    if missing_in_meta:
        errors.append(f"polygons with no prefecture metadata: {missing_in_meta}")

    # ---- Tourism ↔ geography join -------------------------------------------
    code_by_name = {}
    for entry in metadata:
        names = [entry.get("displayName"), entry.get("japaneseName"), *(entry.get("aliases") or [])]
        for name in names:
            if name:
                code_by_name[normalize_key(name)] = entry.get("code")

    unresolved = sorted({p["prefecture"] for p in places if normalize_key(p["prefecture"]) not in code_by_name})
    if unresolved:
        errors.append(
            "place.prefecture values that do not resolve against the geographic metadata: "
            f"{unresolved} — do NOT patch the workbook silently; report this"
        )

    # Nothing may be lost in the integration: every place lands in exactly one prefecture,
    # and every hub in the dataset is still reachable through some covered prefecture.
    resolved_total = sum(1 for p in places if normalize_key(p["prefecture"]) in code_by_name)
    if resolved_total != len(places):
        errors.append(f"{len(places) - resolved_total} of {len(places)} places do not map to a prefecture")

    hubs_in_places = {p["hub"] for p in places}
    hubs_via_geography = {
        p["hub"] for p in places if normalize_key(p["prefecture"]) in code_by_name
    }
    lost_hubs = sorted(hubs_in_places - hubs_via_geography)
    if lost_hubs:
        errors.append(f"hubs unreachable through the geographic layer: {lost_hubs}")

    covered = {code_by_name[normalize_key(p["prefecture"])]
               for p in places if normalize_key(p["prefecture"]) in code_by_name}
    unknown_covered = sorted(covered - set(meta_codes))
    if unknown_covered:
        errors.append(f"coverage points at unknown prefecture codes: {unknown_covered}")

    stats = {
        "prefectures": len(metadata),
        "features": len(features),
        "regions": len(NAVIGATION_REGIONS),
        "places": len(places),
        "covered_prefectures": len(covered),
        "hubs": len(hubs_in_places),
    }
    return errors, stats


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent)
    errors, stats = check(root)
    if errors:
        print(f"FAIL: {len(errors)} problem(s)")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)
    print(
        "OK: {prefectures} prefectures, {features} polygons, {regions} navigation regions, "
        "{places} places resolved across {covered_prefectures} covered prefectures and "
        "{hubs} hubs".format(**stats)
    )


if __name__ == "__main__":
    main()
