#!/usr/bin/env python3
"""Derive the B6.6 C/D photo gate and immutable base snapshot from the canonical tree."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA = "f74281a75cefe5f45469e1db84e5d4350110dba5"
PLACES = ROOT / "data/places.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
OUTPUT = ROOT / "data/visual/block22-b6-6-baseline.json"
ASSETS = ROOT / "app/public"
PLACE_IMAGES = ROOT / "app/src/data/place-images.ts"
COMPLEMENTARY = {"detail", "context", "seasonal"}


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record_sha(record):
    payload = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def main():
    current = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if current != BASE_SHA:
        raise SystemExit(f"baseline must be captured on canonical base {BASE_SHA}, got {current}")
    places, metadata = read(PLACES), read(METADATA)
    records = metadata["images"]
    by_place = {}
    for record in records:
        by_place.setdefault(record["placeId"], []).append(record)

    rows = []
    for place in places:
        if place.get("grade") not in {"C", "D"}:
            continue
        photos = by_place.get(place["id"], [])
        rows.append({
            "placeId": place["id"], "name": place["name"], "grade": place["grade"], "hub": place["hub"],
            "photos": [{"assetPath": item["assetPath"], "originalTitle": item["originalTitle"], "role": item.get("role"),
                        "recordSha256": record_sha(item), "assetSha256": sha(ASSETS / item["assetPath"])} for item in photos],
            "needsIdentity": not photos,
        })

    def grade_coverage(grade):
        members = {place["id"] for place in places if place.get("grade") == grade}
        covered = members & set(by_place)
        return {"total": len(members), "covered": len(covered), "uncovered": sorted(members - covered)}

    s_places = {place["id"] for place in places if place.get("grade") == "S"}
    role_coverage = {role: sorted(pid for pid in s_places if any(item.get("role") == role for item in by_place.get(pid, [])))
                     for role in ("identity", "experience", *sorted(COMPLEMENTARY))}
    hubs = sorted({place["hub"] for place in places})
    budgets = {}
    for hub in hubs:
        identity_records = [item for item in records if item.get("role") == "identity" and
                            next((p["hub"] for p in places if p["id"] == item["placeId"]), None) == hub]
        budgets[hub] = sum((ASSETS / item["assetPath"].replace(".webp", "-800w.webp")).stat().st_size for item in identity_records)

    snapshot = {
        "baseSha": current,
        "imageCount": len(records),
        "coveredPlaceCount": len(by_place),
        "placeImagesTsSha256": sha(PLACE_IMAGES),
        "gradeRows": rows,
        "gradeCoverage": {grade: grade_coverage(grade) for grade in ("C", "D", "S", "A", "B")},
        "gradeS": {
            "total": len(s_places),
            "identity": len(role_coverage["identity"]),
            "experience": len(role_coverage["experience"]),
            "complementary": len(set().union(*(set(role_coverage[role]) for role in COMPLEMENTARY))),
            "roles": role_coverage,
        },
        "gradeABExceptions": {grade: grade_coverage(grade)["uncovered"] for grade in ("A", "B")},
        "hubIdentity800Bytes": budgets,
        "recordSnapshot": [{"placeId": item["placeId"], "assetPath": item["assetPath"],
                            "originalTitle": item["originalTitle"], "role": item.get("role"),
                            "recordSha256": record_sha(item), "assetSha256": sha(ASSETS / item["assetPath"])}
                           for item in records],
    }
    if (snapshot["imageCount"], snapshot["coveredPlaceCount"], snapshot["gradeS"]["identity"], snapshot["gradeS"]["experience"],
            snapshot["gradeS"]["complementary"], snapshot["gradeCoverage"]["A"]["covered"], len(snapshot["gradeABExceptions"]["A"]),
            snapshot["gradeCoverage"]["B"]["covered"], len(snapshot["gradeABExceptions"]["B"])) != (225, 194, 32, 17, 14, 139, 8, 23, 2):
        raise SystemExit("canonical photo/coverage gate differs from the supplied B6.6 baseline")

    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("ID\tLugar\tGrado\tHub\tfotos actuales\tnecesita identity")
    for row in rows:
        print(f"{row['placeId']}\t{row['name']}\t{row['grade']}\t{row['hub']}\t{len(row['photos'])}\t{'sí' if row['needsIdentity'] else 'no'}")
    for grade in ("C", "D"):
        coverage = snapshot["gradeCoverage"][grade]
        print(f"Grado {grade}: {coverage['total']} total; {coverage['covered']} con foto; {len(coverage['uncovered'])} sin foto")
    print(f"Registry={snapshot['imageCount']}; places={snapshot['coveredPlaceCount']}; targets={sum(row['needsIdentity'] for row in rows)}")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
