#!/usr/bin/env python3
"""Derive and pin the B6.4 Grade-S experience gate from the canonical base."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "data/visual/block22-b6-4-baseline.json"
PLACES = ROOT / "data/places.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
PLACE_IMAGES = ROOT / "app/src/data/place-images.ts"


def derive(places, images):
    by_place = {}
    for image in images:
        by_place.setdefault(image["placeId"], []).append(image)
    grade_s = [place for place in places if place["grade"] == "S"]
    rows = []
    for place in grade_s:
        photos = by_place.get(place["id"], [])
        rows.append({
            "placeId": place["id"],
            "name": place["name"],
            "hub": place["hub"],
            "photos": [
                {
                    "originalTitle": photo["originalTitle"],
                    "assetPath": photo["assetPath"],
                    "role": photo.get("role"),
                    "assetSha256": hashlib.sha256((ROOT / "app/public" / photo["assetPath"]).read_bytes()).hexdigest(),
                }
                for photo in photos
            ],
            "needsExperience": not any(photo.get("role") == "experience" for photo in photos),
        })
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    places = json.loads(PLACES.read_text(encoding="utf-8"))
    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    images = metadata["images"]
    rows = derive(places, images)
    covered = {image["placeId"] for image in images}
    targets = [row for row in rows if row["needsExperience"]]
    coverage = {}
    for grade in ("A", "B", "S"):
        grade_places = [place for place in places if place["grade"] == grade]
        uncovered = sorted(place["id"] for place in grade_places if place["id"] not in covered)
        coverage[grade] = {
            "total": len(grade_places),
            "covered": len(grade_places) - len(uncovered),
            "uncovered": uncovered,
        }

    if len(rows) != 32 or any(not row["photos"] for row in rows):
        raise SystemExit(f"STOP: expected 32/32 Grade-S identity coverage; got {len(rows)} Grade S")

    if args.check:
        baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
        initial_images = images[: baseline["imageCount"]]
        initial_rows = derive(places, initial_images)
        if baseline["gradeSRows"] != initial_rows:
            raise SystemExit("STOP: current Grade-S rows differ from the pinned initial gate")
        if len(initial_images) != baseline["imageCount"]:
            raise SystemExit("STOP: initial metadata snapshot is truncated")
        initial_covered = {image["placeId"] for image in initial_images}
        if len(rows) != 32 or sum(bool(row["photos"]) for row in initial_rows) != 32:
            raise SystemExit("STOP: Grade-S identity coverage changed")
        print(f"OK: B6.4 initial gate re-derived — {len(rows)} Grade S, {sum(bool(row['photos']) for row in initial_rows)}/32 identity, {baseline['gradeSWithExperience']} already had experience, {baseline['gradeSNeedsExperience']} targets; {len(initial_covered)} places covered at base")
        return

    baseline = {
        "version": 1,
        "baseSha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "imageCount": len(images),
        "coveredPlaceCount": len(covered),
        "gradeSTotal": len(rows),
        "gradeSCovered": sum(bool(row["photos"]) for row in rows),
        "gradeSWithExperience": len(rows) - len(targets),
        "gradeSNeedsExperience": len(targets),
        "gradeSRows": rows,
        "gradeCoverage": coverage,
        "placeImagesTsSha256": hashlib.sha256(PLACE_IMAGES.read_bytes()).hexdigest(),
    }
    BASELINE.write_text(json.dumps(baseline, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: {len(rows)} Grade S; {baseline['gradeSCovered']}/32 with identity; {baseline['gradeSWithExperience']} already have experience; {len(targets)} targets")
    print("ID\tPlace\tPhotos\tRoles\tNeeds experience")
    for row in rows:
        roles = ", ".join(photo["role"] or "MISSING" for photo in row["photos"])
        print(f"{row['placeId']}\t{row['name']}\t{len(row['photos'])}\t{roles}\t{'YES' if row['needsExperience'] else 'NO'}")


if __name__ == "__main__":
    main()
