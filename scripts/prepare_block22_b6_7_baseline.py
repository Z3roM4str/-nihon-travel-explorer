#!/usr/bin/env python3
"""Capture the immutable B6.7 base snapshot and its complete Grade-A matrix."""
import hashlib
import importlib.util
import json
import subprocess
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA = "0390708df514215778a835b4e2328a85854c759d"
MAIN_SHA = "8eb725eeb836ca121180f8dd8b0dc49c65efae25"
PLACES = ROOT / "data/places.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
APP_METADATA = ROOT / "app/src/data/photography-metadata.json"
ASSETS = ROOT / "app/public"
PLACE_IMAGES = ROOT / "app/src/data/place-images.ts"
OUTPUT = ROOT / "data/visual/block22-b6-7-baseline.json"
EXPECTED_BUDGETS = {
    "Tokio": 3_499_770, "Kioto": 3_499_450, "Osaka": 3_356_478,
    "Okinawa": 2_903_352, "Sapporo": 166_986, "Nagoya": 69_552, "Fukuoka": 69_284,
}
SELECTOR_PATH = ROOT / "scripts/select-block22-b6-7-targets.py"


def sha_bytes(value):
    return hashlib.sha256(value).hexdigest()


def record_sha(record):
    canonical = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha_bytes(canonical)


def main():
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    main_sha = subprocess.check_output(["git", "rev-parse", "origin/main"], cwd=ROOT, text=True).strip()
    if head != BASE_SHA:
        raise SystemExit(f"baseline must be captured on {BASE_SHA}; got {head}")
    if main_sha != MAIN_SHA:
        raise SystemExit(f"origin/main must remain {MAIN_SHA}; got {main_sha}")

    selector_spec = importlib.util.spec_from_file_location("b67_selector", SELECTOR_PATH)
    selector = importlib.util.module_from_spec(selector_spec)
    selector_spec.loader.exec_module(selector)
    places = json.loads(PLACES.read_text(encoding="utf-8"))
    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    if METADATA.read_bytes() != APP_METADATA.read_bytes():
        raise SystemExit("canonical and app photography metadata differ at the B6.7 base")
    records = metadata["images"]
    derivation = selector.derive(places, records)
    by_place = defaultdict(list)
    for record in records:
        by_place[record["placeId"]].append(record)

    record_snapshot = []
    for record in records:
        asset = ASSETS / record["assetPath"]
        if not asset.is_file():
            raise SystemExit(f"baseline source image is missing: {record['assetPath']}")
        record_snapshot.append({
            "placeId": record["placeId"],
            "assetPath": record["assetPath"],
            "originalTitle": record["originalTitle"],
            "role": record.get("role"),
            "recordSha256": record_sha(record),
            "assetSha256": sha_bytes(asset.read_bytes()),
        })

    hubs = {place["id"]: place["hub"] for place in places}
    budgets = defaultdict(int)
    for record in records:
        if record.get("role") == "identity":
            derivative = ASSETS / record["assetPath"].replace(".webp", "-800w.webp")
            budgets[hubs[record["placeId"]]] += derivative.stat().st_size
    budgets = dict(sorted(budgets.items()))
    if budgets != dict(sorted(EXPECTED_BUDGETS.items())):
        raise SystemExit(f"identity hub budgets differ from supplied baseline: {budgets}")

    grade_coverage = {}
    for grade in ("S", "A", "B", "C", "D"):
        members = [place for place in places if place.get("grade") == grade]
        with_identity = sorted(place["id"] for place in members if any(
            item.get("role") == "identity" for item in by_place.get(place["id"], [])
        ))
        grade_coverage[grade] = {
            "total": len(members),
            "withIdentity": len(with_identity),
            "withoutIdentity": sorted({place["id"] for place in members} - set(with_identity)),
        }
    s_ids = {place["id"] for place in places if place.get("grade") == "S"}
    s_role_ids = {
        role: sorted(pid for pid in s_ids if any(item.get("role") == role for item in by_place.get(pid, [])))
        for role in ("identity", "experience", "detail", "context", "seasonal")
    }
    s_complementary = sorted(set().union(*(set(s_role_ids[role]) for role in ("detail", "context", "seasonal"))))
    snapshot = {
        "baseSha": head,
        "mainSha": main_sha,
        "imageCount": len(records),
        "coveredPlaceCount": len(by_place),
        "placeImagesTsSha256": sha_bytes(PLACE_IMAGES.read_bytes()),
        "matrix": derivation["rows"],
        "counts": derivation["counts"],
        "previousAExceptions": derivation["previousExceptions"],
        "targets": derivation["targets"],
        "gradeCoverage": grade_coverage,
        "gradeS": {
            "total": len(s_ids),
            "identity": len(s_role_ids["identity"]),
            "experience": len(s_role_ids["experience"]),
            "complementary": len(s_complementary),
            "roles": s_role_ids,
        },
        "hubIdentity800Bytes": budgets,
        "recordSnapshot": record_snapshot,
    }

    expected = {
        "imageCount": 233, "coveredPlaceCount": 202, "aTotal": 147,
        "aWithIdentity": 139, "aWithoutIdentity": 8,
        "targets": 76, "qualifiedWithoutPhotoPriorException": 5,
    }
    actual = {**snapshot, **snapshot["counts"]}
    for key, value in expected.items():
        if actual.get(key) != value:
            raise SystemExit(f"B6.7 base gate differs for {key}: expected {value}, got {actual.get(key)}")
    if snapshot["gradeS"]["total"] != 32 or snapshot["gradeS"]["identity"] != 32:
        raise SystemExit("B6.7 base S identity coverage differs from 32/32")

    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(snapshot["counts"], ensure_ascii=False, indent=2))
    print(f"Baseline: {head}; origin/main: {main_sha}")
    print(f"Registry: {snapshot['imageCount']} images / {snapshot['coveredPlaceCount']} places")
    print(f"PlaceCard source hash: {snapshot['placeImagesTsSha256']}")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with all {len(snapshot['matrix'])} Grade-A rows")


if __name__ == "__main__":
    main()
