#!/usr/bin/env python3
"""Derive the B6.5 Grade-S role matrix and third-photo targets from live data."""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA = "3ebe7aee70d8046448f10749984d5829b7a4f2cc"
BASELINE = ROOT / "data/visual/block22-b6-5-baseline.json"
PLAN = ROOT / "data/visual/block22-b6-5-acquisition-plan.json"
PLACES = ROOT / "data/places.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
PLACE_IMAGES = ROOT / "app/src/data/place-images.ts"
ROLES = ("identity", "experience", "detail", "context", "seasonal")
COMPLEMENTARY = frozenset(("detail", "context", "seasonal"))
GRADES = ("S", "A", "B")


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def derive(places, images, with_hashes=True):
    by_place = {}
    for image in images:
        by_place.setdefault(image["placeId"], []).append(image)
    rows = []
    for place in sorted((p for p in places if p["grade"] == "S"), key=lambda p: p["id"]):
        photos = by_place.get(place["id"], [])
        photo_rows = []
        for photo in photos:
            item = {
                "originalTitle": photo["originalTitle"],
                "assetPath": photo["assetPath"],
                "role": photo.get("role"),
            }
            asset = ROOT / "app/public" / photo["assetPath"]
            if with_hashes and asset.is_file():
                item["assetSha256"] = hashlib.sha256(asset.read_bytes()).hexdigest()
            photo_rows.append(item)
        role_coverage = {role: any(photo.get("role") == role for photo in photos) for role in ROLES}
        rows.append({
            "placeId": place["id"],
            "name": place["name"],
            "hub": place["hub"],
            "photos": photo_rows,
            "photoCount": len(photos),
            **role_coverage,
            "needsB65": not any(role_coverage[role] for role in COMPLEMENTARY),
        })
    return rows


def coverage(places, images):
    covered = {image["placeId"] for image in images}
    out = {}
    for grade in GRADES:
        grade_places = [place for place in places if place["grade"] == grade]
        uncovered = sorted(place["id"] for place in grade_places if place["id"] not in covered)
        out[grade] = {
            "total": len(grade_places),
            "covered": len(grade_places) - len(uncovered),
            "uncovered": uncovered,
        }
    return out


def snapshot(places, images):
    rows = derive(places, images)
    covered = {image["placeId"] for image in images}
    s_rows = [row for row in rows if row["identity"]]
    return {
        "version": 1,
        "baseSha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "imageCount": len(images),
        "coveredPlaceCount": len(covered),
        "gradeSTotal": len(rows),
        "gradeSCovered": sum(bool(row["identity"]) for row in rows),
        "gradeSWithExperience": sum(bool(row["experience"]) for row in rows),
        "gradeSWithComplementary": sum(any(row[role] for role in COMPLEMENTARY) for row in rows),
        "gradeSNeedsB65": sum(bool(row["needsB65"]) for row in rows),
        "gradeSRows": rows,
        "gradeCoverage": coverage(places, images),
        "placeImagesTsSha256": hashlib.sha256(PLACE_IMAGES.read_bytes()).hexdigest(),
    }


def check_expected_gate(state):
    expected = {
        "imageCount": 215,
        "coveredPlaceCount": 194,
        "gradeSTotal": 32,
        "gradeSCovered": 32,
        "gradeSWithExperience": 17,
        "gradeSWithComplementary": 4,
        "gradeSNeedsB65": 28,
    }
    mismatches = {key: (state.get(key), value) for key, value in expected.items() if state.get(key) != value}
    if mismatches:
        raise SystemExit(f"STOP: B6.5 initial gate differs from required base values: {mismatches}")
    if state["gradeCoverage"]["A"] != {
        "total": 147,
        "covered": 139,
        "uncovered": ["JP-050", "JP-079", "JP-095", "JP-120", "JP-121", "JP-168", "JP-195", "JP-202"],
    }:
        raise SystemExit(f"STOP: Grade-A coverage differs from the required gate: {state['gradeCoverage']['A']}")
    if state["gradeCoverage"]["B"] != {
        "total": 25,
        "covered": 23,
        "uncovered": ["JP-041", "JP-171"],
    }:
        raise SystemExit(f"STOP: Grade-B coverage differs from the required gate: {state['gradeCoverage']['B']}")


def base_images_from_current(images):
    plan = load(PLAN)
    titles = {
        entry["title"]
        for batch in plan.get("batches", [])
        for entry in batch.get("entries", [])
    }
    return [image for image in images if image.get("originalTitle") not in titles]


def print_matrix(state):
    print("ID\tLugar\tfotos\tidentity\texperience\tdetail\tcontext\tseasonal\tnecesita B6.5")
    for row in state["gradeSRows"]:
        values = ["sí" if row[role] else "no" for role in ROLES]
        print(f"{row['placeId']}\t{row['name']}\t{row['photoCount']}\t" + "\t".join(values) + f"\t{'sí' if row['needsB65'] else 'no'}")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-baseline", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.write_baseline and args.check:
        parser.error("choose either --write-baseline or --check")
    places = load(PLACES)
    images = load(METADATA)["images"]
    if args.check:
        baseline = load(BASELINE)
        current_base = base_images_from_current(images)
        actual = snapshot(places, current_base)
        check_expected_gate(actual)
        if baseline != actual:
            raise SystemExit("STOP: B6.5 base matrix differs from the dynamically re-derived canonical snapshot")
        if baseline["baseSha"] != BASE_SHA:
            raise SystemExit(f"STOP: baseline SHA is {baseline['baseSha']}, expected {BASE_SHA}")
        print_matrix(actual)
        print(f"OK: S={actual['gradeSTotal']}; identity={actual['gradeSCovered']}/32; experience={actual['gradeSWithExperience']}/32; complementary={actual['gradeSWithComplementary']}/32; targets={actual['gradeSNeedsB65']}; registry={actual['imageCount']} images/{actual['coveredPlaceCount']} places; A=139/147 + 8 exceptions; B=23/25 + 2 exceptions")
        return

    state = snapshot(places, images)
    check_expected_gate(state)
    if args.write_baseline:
        if state["baseSha"] != BASE_SHA:
            raise SystemExit(f"STOP: can only pin the baseline at {BASE_SHA}; current HEAD is {state['baseSha']}")
        BASELINE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print_matrix(state)
    targets = [row["placeId"] for row in state["gradeSRows"] if row["needsB65"]]
    print(f"OK: S={state['gradeSTotal']}; identity={state['gradeSCovered']}/32; experience={state['gradeSWithExperience']}/32; complementary={state['gradeSWithComplementary']}/32; targets={len(targets)}; registry={state['imageCount']} images/{state['coveredPlaceCount']} places; A=139/147 + 8 exceptions; B=23/25 + 2 exceptions")
    print("B6.5 targets: " + ", ".join(targets))


if __name__ == "__main__":
    main()
