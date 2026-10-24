#!/usr/bin/env python3
"""Offline B6.7 editorial, registry, asset, coverage and budget gates."""
import argparse
import hashlib
import importlib.util
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "data/visual/block22-b6-7-baseline.json"
PLAN_PATH = ROOT / "data/visual/block22-b6-7-acquisition-plan.json"
PLACES_PATH = ROOT / "data/places.json"
METADATA_PATH = ROOT / "data/visual/photography-metadata.json"
APP_METADATA_PATH = ROOT / "app/src/data/photography-metadata.json"
PLACE_IMAGES_PATH = ROOT / "app/src/data/place-images.ts"
ASSET_ROOT = ROOT / "app/public"
ALLOWED_LICENSES = {
    "Public Domain", "PD-self", "CC0", "CC BY", "CC BY-SA",
    "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
}
ALLOWED_ROLES = {"experience", "detail", "context", "seasonal"}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical_record_sha(record):
    content = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha(content)


def import_script(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--through-batch", type=int, required=True)
    args = parser.parse_args()
    baseline = load(BASELINE_PATH)
    plan = load(PLAN_PATH)
    places = load(PLACES_PATH)
    metadata = load(METADATA_PATH)
    errors = []

    selector = import_script("b67_selector", ROOT / "scripts/select-block22-b6-7-targets.py")
    validator = import_script("photography_validator", ROOT / "scripts/validate-photography.py")
    baseline_records = [{"placeId": row["placeId"], "role": row["role"]} for row in baseline["recordSnapshot"]]
    derived = selector.derive(places, baseline_records)
    rows = derived["rows"]
    row_by_id = {row["id"]: row for row in rows}
    targets = derived["targets"]
    if len([place for place in places if place.get("grade") == "A"]) != 147:
        errors.append("Grade A total is not 147")
    if derived["counts"] != baseline["counts"] or rows != baseline["matrix"]:
        errors.append("dynamic initial predicate/matrix differs from the frozen B6.7 baseline")
    if any(row["isTourism"] != (row["tourismLevel"] in {"Extremo", "Alto"}) for row in rows):
        errors.append("tourism predicate must use only exact Extremo/Alto values")
    if any(row["isHiddenGemReal"] != (row["hiddenGemStatus"] == "Hidden Gem real") for row in rows):
        errors.append("hidden gem predicate must match the exact Hidden Gem real status")
    if len(derived["qualifiedIds"]) != len(set(derived["qualifiedIds"])):
        errors.append("editorial union contains duplicates")
    expected_exceptions = sorted({"JP-050", "JP-079", "JP-095", "JP-120", "JP-121", "JP-168", "JP-195", "JP-202"})
    if derived["previousExceptions"] != expected_exceptions:
        errors.append("the eight B6.2 Grade-A exceptions changed")
    if targets != baseline["targets"]:
        errors.append("B6.7 baseline targets differ from dynamically derived targets")
    if any(row_by_id[place_id]["photos"] != 1 or not row_by_id[place_id]["hasIdentity"] for place_id in targets):
        errors.append("every baseline target must have exactly one baseline identity/photo")
    if any(row_by_id[place_id]["photos"] != 0 for place_id in expected_exceptions if place_id in derived["qualifiedIds"]):
        errors.append("a prior no-identity exception was reopened")

    decisions = plan.get("entries", []) + plan.get("unresolved", [])
    target_index = {place_id: index for index, place_id in enumerate(targets)}
    decision_ids = [row.get("placeId") for row in decisions]
    if len(decision_ids) != len(set(decision_ids)):
        errors.append("B6.7 plan contains duplicate target decisions")
    unknown = [place_id for place_id in decision_ids if place_id not in target_index]
    if unknown:
        errors.append(f"B6.7 plan has non-target decisions: {unknown}")
    decisions.sort(key=lambda row: target_index.get(row.get("placeId"), 10**9))
    prefix_count = min(args.through_batch * 9, len(targets))
    expected_prefix = targets[:prefix_count]
    if [row.get("placeId") for row in decisions] != expected_prefix:
        errors.append("plan must partition each consecutive target prefix with one decision per target")
    for index, decision in enumerate(decisions):
        expected_batch = index // 9 + 1
        if decision.get("batch") != expected_batch:
            errors.append(f"{decision.get('placeId')}: wrong batch number, expected {expected_batch}")

    through_entries = [row for row in plan.get("entries", []) if row.get("batch", 0) <= args.through_batch]
    through_unresolved = [row for row in plan.get("unresolved", []) if row.get("batch", 0) <= args.through_batch]
    if args.through_batch == (len(targets) + 8) // 9 and len(decisions) != len(targets):
        errors.append("final B6.7 gate needs a decision for every derived target")
    for entry in through_entries:
        if entry.get("role") not in ALLOWED_ROLES:
            errors.append(f"{entry['placeId']}: acquisition role is not complementary")
        if entry.get("placeId") not in targets:
            errors.append(f"{entry['placeId']}: new record is not a target")
        if len(entry.get("candidatesRejected", [])) < 2:
            errors.append(f"{entry['placeId']}: fewer than two rejected candidates documented")
        if not entry.get("whyRole") or not entry.get("identityComparison") or not entry.get("visualReview"):
            errors.append(f"{entry['placeId']}: missing role/complementarity/visual documentation")
    unresolved_allowed = {
        "UNRESOLVED — LICENSE", "UNRESOLVED — COPYRIGHTED SUBJECT", "UNRESOLVED — RESOLUTION",
        "UNRESOLVED — NO COMPLEMENTARY IMAGE", "UNRESOLVED — LOCATION UNVERIFIABLE",
        "UNRESOLVED — NO MATERIAL FOUND",
    }
    for decision in through_unresolved:
        if decision.get("category") not in unresolved_allowed or not decision.get("reason"):
            errors.append(f"{decision.get('placeId')}: invalid unresolved category/reason")
        if len(decision.get("searchSources", [])) < 2 or len(decision.get("candidatesRejected", [])) < 2:
            errors.append(f"{decision.get('placeId')}: unresolved decision lacks sources/rejected candidates")

    if METADATA_PATH.read_bytes() != APP_METADATA_PATH.read_bytes():
        errors.append("canonical/app photography metadata are not byte-synchronized")
    if sha(PLACE_IMAGES_PATH.read_bytes()) != baseline["placeImagesTsSha256"]:
        errors.append("app/src/data/place-images.ts changed")
    record_by_path = {row.get("assetPath"): row for row in metadata["images"]}
    snapshot_by_path = {row["assetPath"]: row for row in baseline["recordSnapshot"]}
    for old in baseline["recordSnapshot"]:
        row = record_by_path.get(old["assetPath"])
        if row is None or canonical_record_sha(row) != old["recordSha256"]:
            errors.append(f"baseline metadata record changed: {old['placeId']} {old['assetPath']}")
        asset = ASSET_ROOT / old["assetPath"]
        if not asset.is_file() or sha(asset.read_bytes()) != old["assetSha256"]:
            errors.append(f"baseline original asset changed: {old['assetPath']}")

    baseline_titles = {row["originalTitle"] for row in baseline["recordSnapshot"]}
    baseline_paths = set(snapshot_by_path)
    by_place = defaultdict(list)
    for row in metadata["images"]:
        by_place[row["placeId"]].append(row)
    new_records = [row for row in metadata["images"] if row.get("assetPath") not in baseline_paths]
    planned_titles = {row["title"]: row for row in through_entries}
    if any(row.get("role") == "identity" for row in new_records):
        errors.append("B6.7 added a new identity")
    if any(row.get("originalTitle") not in planned_titles for row in new_records):
        errors.append("new metadata includes an unplanned acquisition")
    if len(new_records) != len(through_entries):
        errors.append(f"metadata contains {len(new_records)} new photos but the processed plan has {len(through_entries)} acquisitions")

    seen_asset_hashes = {}
    for old in baseline["recordSnapshot"]:
        old_path = ASSET_ROOT / old["assetPath"]
        if old_path.is_file():
            seen_asset_hashes[sha(old_path.read_bytes())] = old["placeId"]
    for row in new_records:
        place_id = row["placeId"]
        planned = planned_titles.get(row.get("originalTitle"))
        if planned is None or planned["placeId"] != place_id:
            errors.append(f"{place_id}: new image does not match the approved target/source plan")
        if row.get("role") not in ALLOWED_ROLES:
            errors.append(f"{place_id}: new record uses an unsupported complementary role")
        if row.get("license") not in ALLOWED_LICENSES:
            errors.append(f"{place_id}: unsupported/unapproved license {row.get('license')!r}")
        if row.get("originalTitle") in baseline_titles:
            errors.append(f"{place_id}: source title duplicates a baseline image")
        asset = ASSET_ROOT / row["assetPath"]
        if not asset.is_file():
            errors.append(f"{place_id}: original pipeline asset missing: {row['assetPath']}")
            continue
        digest = sha(asset.read_bytes())
        if digest in seen_asset_hashes:
            errors.append(f"{place_id}: duplicate-by-bytes image of {seen_asset_hashes[digest]}")
        seen_asset_hashes[digest] = place_id
        if not validator.valid_lqip(row.get("lqip")):
            errors.append(f"{place_id}: complementary image has no valid LQIP")
        for width in (400, 800):
            derivative = asset.with_name(asset.stem + f"-{width}w.webp")
            if not derivative.is_file() or derivative.stat().st_size == 0 or derivative.stat().st_size >= asset.stat().st_size:
                errors.append(f"{place_id}: missing/invalid {width}w derivative for {row['assetPath']}")

    entries_by_id = {row["placeId"]: row for row in through_entries}
    unresolved_ids = {row["placeId"] for row in through_unresolved}
    for place_id in targets:
        current = by_place.get(place_id, [])
        additions = [row for row in current if row.get("assetPath") not in baseline_paths]
        if len(additions) > 1:
            errors.append(f"{place_id}: more than one B6.7 acquisition")
        if len(current) > 2:
            errors.append(f"{place_id}: exceeds two total images after B6.7")
        if place_id in entries_by_id:
            expected_titles = {entries_by_id[place_id]["title"]}
            if len(additions) != 1 or additions[0].get("originalTitle") not in expected_titles:
                errors.append(f"{place_id}: approved acquisition missing or differs from plan")
            if len(current) != 2 or current[0].get("role") != "identity" or current[1].get("role") not in ALLOWED_ROLES:
                errors.append(f"{place_id}: detail gallery order must be identity then complement")
        elif place_id in unresolved_ids and len(additions) != 0:
            errors.append(f"{place_id}: unresolved target unexpectedly received a new image")
        elif place_id in expected_prefix and len(additions) != 0:
            errors.append(f"{place_id}: unplanned target acquisition")

    expected_image_count = baseline["imageCount"] + len(through_entries)
    if metadata.get("imageCount") != len(metadata.get("images", [])) or len(metadata["images"]) != expected_image_count:
        errors.append("image count differs from baseline plus approved acquisitions")
    current_covered = len(by_place)
    if current_covered != baseline["coveredPlaceCount"] or current_covered != 202:
        errors.append(f"covered place count changed from 202 to {current_covered}")

    grade_coverage = {}
    role_sets = defaultdict(lambda: defaultdict(set))
    place_hubs = {place["id"]: place["hub"] for place in places}
    identity_budget = defaultdict(int)
    for grade in ("S", "A", "B", "C", "D"):
        members = [place for place in places if place.get("grade") == grade]
        identity_ids = sorted(place["id"] for place in members if any(row.get("role") == "identity" for row in by_place.get(place["id"], [])))
        missing = sorted({place["id"] for place in members} - set(identity_ids))
        grade_coverage[grade] = {"total": len(members), "withIdentity": len(identity_ids), "withoutIdentity": missing}
        for place_id in identity_ids:
            for row in by_place[place_id]:
                role_sets[grade][row.get("role")].add(place_id)
    if grade_coverage != baseline["gradeCoverage"]:
        errors.append("S/A/B/C/D identity coverage regressed")
    s_baseline = baseline["gradeS"]
    s_current = {
        "total": sum(place.get("grade") == "S" for place in places),
        "identity": len(role_sets["S"]["identity"]),
        "experience": len(role_sets["S"]["experience"]),
        "complementary": len(set().union(*(role_sets["S"][role] for role in ("detail", "context", "seasonal")))),
    }
    if s_current != {key: s_baseline[key] for key in s_current}:
        errors.append(f"S role coverage changed: {s_current}")
    for record in metadata["images"]:
        if record.get("role") == "identity":
            asset = ASSET_ROOT / record["assetPath"]
            derivative = asset.with_name(asset.stem + "-800w.webp")
            if derivative.is_file():
                identity_budget[place_hubs[record["placeId"]]] += derivative.stat().st_size
    identity_budget = dict(sorted(identity_budget.items()))
    if identity_budget != baseline["hubIdentity800Bytes"]:
        errors.append("identity budget changed after adding complementary photos")
    if any(value > 3_500_000 for value in identity_budget.values()):
        errors.append("a hub exceeds the 3,500,000 B identity budget")

    print(f"B6.7 batch gate through batch {args.through_batch}")
    print(f"A=147 · Extremo={derived['counts']['aExtremo']} · Alto={derived['counts']['aAlto']} · Hidden Gem real={derived['counts']['aHiddenGemReal']} · unión={derived['counts']['tourismUnionHiddenGem']} · intersección={derived['counts']['tourismHiddenGemIntersection']}")
    print(f"Targets baseline={len(targets)} · decisions={len(decisions)} · new acquisitions={len(new_records)} · unresolved={len(through_unresolved)} · images={len(metadata['images'])} · places={current_covered}")
    print(f"S={s_current['identity']}/{s_current['total']} identity, experience={s_current['experience']}/{s_current['total']}, complementary={s_current['complementary']}/{s_current['total']}; Grade A={grade_coverage['A']['withIdentity']}/{grade_coverage['A']['total']}")
    print("Identity 800w budgets: " + ", ".join(f"{hub} {count:,} B" for hub, count in identity_budget.items()))
    if errors:
        print("FAIL")
        for error in errors:
            print(f"  - {error}")
        return 1
    print("PASS: editorial predicate, exceptions, targets, complementary roles, assets, sync, licenses, duplicates, coverage and identity budgets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
