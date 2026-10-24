#!/usr/bin/env python3
"""Derive and pin the exact B6.2 target set: grade-A places without any photograph.

Usage:
    python3 scripts/select-block22-b6-2-targets.py [--check]

The target list is never typed by hand. It is computed from `data/places.json` and the
canonical `data/visual/photography-metadata.json`, and the run refuses to write anything
unless reality matches the B6.2 contract: 147 grade-A places, 35 of them uncovered.

`--check` re-derives the set from the *base* registry (every record whose placeId is not a
B6.2 target plus nothing else) and compares it with the pinned baseline, so later batches
can prove they never widened or narrowed the scope.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACES_PATH = ROOT / "data/places.json"
METADATA_PATH = ROOT / "data/visual/photography-metadata.json"
BASELINE_PATH = ROOT / "data/visual/block22-b6-2-baseline.json"
PLACE_IMAGES_TS = ROOT / "app/src/data/place-images.ts"
EXPECTED_GRADE_A_TOTAL = 147
EXPECTED_GRADE_A_MISSING = 35


def derive(places, images):
    covered = {record["placeId"] for record in images}
    grade_a = [place for place in places if place.get("grade") == "A"]
    missing = [place for place in grade_a if place["id"] not in covered]
    return grade_a, missing, covered


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    places = json.loads(PLACES_PATH.read_text(encoding="utf-8"))
    images = json.loads(METADATA_PATH.read_text(encoding="utf-8"))["images"]

    if args.check:
        baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
        targets = {row["placeId"] for row in baseline["gradeAMissing"]}
        base_images = [record for record in images if record["placeId"] not in targets]
        _, missing, _ = derive(places, base_images)
        if {place["id"] for place in missing} != targets:
            print("ERROR: re-derived B6.2 target set differs from the pinned baseline", file=sys.stderr)
            return 1
        print(f"OK: B6.2 target set re-derived ({len(targets)} places)")
        return 0

    grade_a, missing, covered = derive(places, images)
    print(f"grade A total: {len(grade_a)}; grade A without photography: {len(missing)}")
    if len(grade_a) != EXPECTED_GRADE_A_TOTAL or len(missing) != EXPECTED_GRADE_A_MISSING:
        print(
            f"STOP: B6.2 requires {EXPECTED_GRADE_A_TOTAL}/{EXPECTED_GRADE_A_MISSING}; "
            "document the discrepancy before acquiring anything.",
            file=sys.stderr,
        )
        return 1

    base_sha = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout.strip()
    baseline = {
        "version": 1,
        "baseSha": base_sha,
        "imageCount": len(images),
        "coveredPlaceCount": len(covered),
        "gradeATotal": len(grade_a),
        "gradeAMissingCount": len(missing),
        "gradeSCovered": sum(1 for p in places if p.get("grade") == "S" and p["id"] in covered),
        "gradeAMissing": [
            {"placeId": p["id"], "name": p["name"], "hub": p["hub"], "grade": p["grade"]}
            for p in missing
        ],
        "placeImagesTsSha256": hashlib.sha256(PLACE_IMAGES_TS.read_bytes()).hexdigest(),
    }
    BASELINE_PATH.write_text(json.dumps(baseline, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: pinned {len(missing)} B6.2 targets at {base_sha}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
