#!/usr/bin/env python3
"""Append one data-derived batch of B6.4 experience records and make an acquire manifest.

The selected batch is validated against the initial Grade-S gate. The Commons preparation
module reads license, credit, source URL, dimensions and acquisition URL from the file page;
this script only adds the role already reviewed in the batch plan.
"""
import argparse
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "data/visual/block22-b6-4-baseline.json"
PLAN = ROOT / "data/visual/block22-b6-4-acquisition-plan.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
APP_METADATA = ROOT / "app/src/data/photography-metadata.json"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path, value):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)


def import_preparer():
    path = ROOT / "scripts/prepare-block2-photography-metadata.py"
    spec = importlib.util.spec_from_file_location("block2_preparer", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def target_batches(baseline):
    targets = [row["placeId"] for row in baseline["gradeSRows"] if row["needsExperience"]]
    return [targets[i:i + 8] for i in range(0, len(targets), 8)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", type=int)
    parser.add_argument("--sync-app", action="store_true", help="Copy canonical metadata byte-for-byte to the app registry")
    args = parser.parse_args()
    if args.sync_app:
        if args.batch is not None:
            parser.error("--sync-app and --batch are separate operations")
        APP_METADATA.write_bytes(METADATA.read_bytes())
        print("OK: app/src/data/photography-metadata.json synchronized")
        return
    if args.batch is None:
        parser.error("provide --batch N or --sync-app")

    baseline, plan, metadata = load(BASELINE), load(PLAN), load(METADATA)
    batches = target_batches(baseline)
    if args.batch < 1 or args.batch > len(batches):
        raise SystemExit(f"batch must be in 1..{len(batches)}")
    expected_places = set(batches[args.batch - 1])
    plan_batch = next((row for row in plan["batches"] if row["batch"] == args.batch), None)
    if not plan_batch:
        raise SystemExit(f"B6.4 acquisition plan has no batch {args.batch}")
    entries = plan_batch.get("entries", [])
    unresolved = plan_batch.get("unresolved", [])
    decisions = [row["placeId"] for row in entries + unresolved]
    if len(decisions) != len(set(decisions)) or set(decisions) != expected_places:
        missing = sorted(expected_places - set(decisions))
        extra = sorted(set(decisions) - expected_places)
        raise SystemExit(f"batch {args.batch} plan must partition data-derived targets; missing={missing}, extra={extra}")
    if any(row.get("role") != "experience" for row in entries):
        raise SystemExit("every B6.4 acquisition must have role: experience")
    if any(not row.get("candidatesRejected") or not row.get("reason") for row in unresolved):
        raise SystemExit("each unresolved row needs a reason and rejected candidate evidence")

    images = metadata["images"]
    for rejected in plan_batch.get("rejectedPreparedRecords", []):
        matches = [
            row for row in images
            if row.get("placeId") == rejected["placeId"]
            and row.get("originalTitle") == rejected["title"]
        ]
        if len(matches) > 1:
            raise SystemExit(f"rejected candidate appears more than once: {rejected['title']}")
        if matches:
            if matches[0].get("role") != "experience":
                raise SystemExit(f"refusing to remove non-experience record: {rejected['title']}")
            images.remove(matches[0])

    accepted_titles_by_place = {row["placeId"]: row["title"] for row in entries}
    rejected_titles_by_place = {
        row["placeId"]: row["title"] for row in plan_batch.get("rejectedPreparedRecords", [])
    }
    for row in images:
        if row.get("placeId") not in expected_places or row.get("role") != "experience":
            continue
        expected_title = accepted_titles_by_place.get(row["placeId"])
        rejected_title = rejected_titles_by_place.get(row["placeId"])
        if row.get("originalTitle") not in {expected_title, rejected_title}:
            raise SystemExit(
                f"unplanned experience record for {row['placeId']}: {row.get('originalTitle')}"
            )

    plan_entries = {
        item["placeId"]: item
        for row in plan["batches"] if row["batch"] <= args.batch
        for item in row.get("entries", [])
    }
    previous_entries = {
        item["placeId"]
        for row in plan["batches"] if row["batch"] < args.batch
        for item in row.get("entries", [])
    }
    previous_entries_ordered = [
        item["placeId"]
        for row in sorted(plan["batches"], key=lambda value: value["batch"]) if row["batch"] < args.batch
        for item in row.get("entries", [])
    ]
    current_records = [row for row in images if row.get("originalTitle") in {item["title"] for item in plan_entries.values()}]
    current_by_place = {row["placeId"]: row for row in current_records}
    if len(current_records) != len(current_by_place) or set(current_by_place) != previous_entries | (set(current_by_place) & expected_places):
        raise SystemExit("registry additions do not match completed earlier batches; inspect before proceeding")
    if set(current_by_place) - previous_entries - expected_places:
        raise SystemExit("registry contains an unplanned B6.4 record; inspect before proceeding")

    accepted = {row["placeId"]: row for row in entries}
    already = set(current_by_place)
    batch_existing = already & expected_places
    preparer = import_preparer()
    records = []
    newly_prepared = []
    for entry in entries:
        existing = current_by_place.get(entry["placeId"])
        if existing:
            if existing.get("originalTitle") != entry["title"] or existing.get("role") != "experience":
                raise SystemExit(f"existing batch record does not match plan: {entry['placeId']}")
            records.append(existing)
            continue
        record = preparer.build(entry, plan["acquisitionDate"])
        record["role"] = "experience"
        records.append(record)
        newly_prepared.append(record)
        print(f"prepared {entry['placeId']} — {record['license']} — {record['originalWidth']}x{record['originalHeight']}", file=sys.stderr)
        time.sleep(1.0)
    titles = {row["originalTitle"] for row in images}
    if any(row["originalTitle"] in titles for row in newly_prepared):
        raise SystemExit("a selected Commons originalTitle already exists in the registry")
    images.extend(newly_prepared)

    # Keep each gallery in the established identity → experience → detail/context → seasonal
    # order. Records are still validated as a stable batch sequence by place ID, rather than by
    # their position in the global metadata array.
    all_new = [current_by_place[pid] for pid in previous_entries_ordered]
    all_new.extend(records)
    new_titles = {row["originalTitle"] for row in all_new}
    images[:] = [row for row in images if row.get("originalTitle") not in new_titles]
    for record in all_new:
        identity_index = next(
            (index for index, row in enumerate(images)
             if row.get("placeId") == record["placeId"] and row.get("role") == "identity"),
            None,
        )
        if identity_index is None:
            raise SystemExit(f"cannot order experience without preserved identity: {record['placeId']}")
        images.insert(identity_index + 1, record)

    metadata["imageCount"] = len(images)
    atomic_json(METADATA, metadata)

    manifest = ROOT / f"data/visual/.b6-4-batch-{args.batch}-acquisition.json"
    atomic_json(manifest, {"images": records})
    print(f"OK: batch {args.batch}: {len(records)} experience acquisition(s), {len(unresolved)} unresolved; manifest {manifest.name}")


if __name__ == "__main__":
    main()
