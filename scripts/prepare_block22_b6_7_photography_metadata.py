#!/usr/bin/env python3
"""Prepare licensed B6.7 complementary records and sync the canonical/app metadata."""
import argparse
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / "data/visual/block22-b6-7-acquisition-plan.json"
BASELINE = ROOT / "data/visual/block22-b6-7-baseline.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
APP_METADATA = ROOT / "app/src/data/photography-metadata.json"
ALLOWED_ROLES = {"experience", "detail", "context", "seasonal"}
UNRESOLVED = {
    "UNRESOLVED — LICENSE",
    "UNRESOLVED — COPYRIGHTED SUBJECT",
    "UNRESOLVED — RESOLUTION",
    "UNRESOLVED — NO COMPLEMENTARY IMAGE",
    "UNRESOLVED — LOCATION UNVERIFIABLE",
    "UNRESOLVED — NO MATERIAL FOUND",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--through-batch", type=int, required=True)
    parser.add_argument("--merge", action="store_true")
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    targets = baseline["targets"]
    decisions = plan.get("entries", []) + plan.get("unresolved", [])
    decisions = sorted(decisions, key=lambda row: (row["batch"], targets.index(row["placeId"])))
    ids = [row["placeId"] for row in decisions]
    expected_prefix = targets[: min(args.through_batch * 9, len(targets))]
    if ids != expected_prefix:
        raise SystemExit(
            "plan must contain every target through the requested batch in target order; "
            f"expected {expected_prefix}, got {ids}"
        )
    for index, row in enumerate(decisions):
        if row.get("batch") != index // 9 + 1:
            raise SystemExit(f"{row['placeId']}: expected batch {index // 9 + 1}")

    by_id = {row["id"]: row for row in baseline["matrix"]}
    if len(ids) != len(set(ids)):
        raise SystemExit("B6.7 plan has duplicate decisions")
    for row in plan.get("entries", []):
        if row.get("role") not in ALLOWED_ROLES:
            raise SystemExit(f"{row['placeId']}: role must be one of {sorted(ALLOWED_ROLES)}")
        if row.get("batch", 0) != args.through_batch:
            continue
        if row["placeId"] not in expected_prefix or not by_id[row["placeId"]]["targetB67"]:
            raise SystemExit(f"{row['placeId']}: not a derived B6.7 target")
        expected_source = "https://commons.wikimedia.org/wiki/" + row["title"].replace(" ", "_")
        if expected_source != row.get("sourcePage"):
            raise SystemExit(f"{row['placeId']}: sourcePage does not match the Commons original title")
        if not row.get("whyRole") or not row.get("identityComparison") or not row.get("visualReview"):
            raise SystemExit(f"{row['placeId']}: missing complementarity or visual review")
        if len(row.get("candidatesRejected", [])) < 2:
            raise SystemExit(f"{row['placeId']}: record at least two rejected candidates")
    for row in plan.get("unresolved", []):
        if row.get("batch", 0) > args.through_batch:
            continue
        if row.get("category") not in UNRESOLVED or not row.get("reason"):
            raise SystemExit(f"{row['placeId']}: incomplete unresolved decision")
        if len(row.get("searchSources", [])) < 2 or len(row.get("candidatesRejected", [])) < 2:
            raise SystemExit(f"{row['placeId']}: unresolved decision needs sources and candidate reasons")

    spec = importlib.util.spec_from_file_location(
        "block2_preparer", ROOT / "scripts/prepare-block2-photography-metadata.py"
    )
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    acquisition_date = plan["acquisitionDate"]
    records = []
    for entry in sorted(plan.get("entries", []), key=lambda row: targets.index(row["placeId"])):
        if entry["batch"] != args.through_batch:
            continue
        row = helper.build(entry, acquisition_date)
        row["role"] = entry["role"]
        records.append(row)
        print(f"prepared {entry['placeId']} as {entry['role']} from its verified Commons source", file=sys.stderr)
        time.sleep(1.0)

    output = ROOT / "data/visual/block22-b6-7-prepared-records.json"
    output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.merge:
        metadata = json.loads(METADATA.read_text(encoding="utf-8"))
        expected_by_id = {row["id"]: row for row in baseline["matrix"]}
        entry_by_id = {row["placeId"]: row for row in plan.get("entries", [])}
        for row in records:
            place_id = row["placeId"]
            if not expected_by_id[place_id]["targetB67"]:
                raise SystemExit(f"{place_id}: not a derived B6.7 target")
            if any(item.get("originalTitle") == row["originalTitle"] for item in metadata["images"]):
                matches = [item for item in metadata["images"] if item.get("originalTitle") == row["originalTitle"]]
                if len(matches) == 1 and matches[0].get("placeId") == place_id:
                    continue
                raise SystemExit(f"duplicate original title: {row['originalTitle']}")
            existing = [index for index, item in enumerate(metadata["images"]) if item["placeId"] == place_id]
            identity_indexes = [index for index in existing if metadata["images"][index].get("role") == "identity"]
            if len(existing) == 1 and len(identity_indexes) == 1:
                metadata["images"].insert(identity_indexes[0] + 1, row)
                continue
            if len(existing) == 2 and len(identity_indexes) == 1:
                complementary = next(index for index in existing if index != identity_indexes[0])
                previous_title = metadata["images"][complementary].get("originalTitle")
                entry = entry_by_id[place_id]
                rejected_titles = {candidate.get("title") for candidate in entry.get("candidatesRejected", [])}
                if entry.get("supersedes") != previous_title or previous_title not in rejected_titles:
                    raise SystemExit(f"{place_id}: refusing an unrecorded or unreviewed complement replacement")
                metadata["images"][complementary] = row
                continue
            raise SystemExit(f"{place_id}: B6.7 permits one complement after exactly one identity")
        metadata["imageCount"] = len(metadata["images"])
        temp = METADATA.with_suffix(METADATA.suffix + ".tmp")
        temp.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temp, METADATA)
        APP_METADATA.write_bytes(METADATA.read_bytes())
        print(f"Merged {len(records)} complementary records; app registry synchronized")
    print(f"Wrote {output.relative_to(ROOT)}")


if __name__ == "__main__":
    raise SystemExit(main())
