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

    initial_count = baseline["imageCount"]
    images = metadata["images"]
    current_new = images[initial_count:]
    previous_targets = {pid for batch in batches[:args.batch - 1] for pid in batch}
    previous_entries = {
        item["placeId"]
        for row in plan["batches"] if row["batch"] < args.batch
        for item in row.get("entries", [])
    }
    if {row["placeId"] for row in current_new} != previous_entries:
        if current_new:
            raise SystemExit("registry additions do not match completed earlier batches; inspect before proceeding")

    accepted = {row["placeId"]: row for row in entries}
    already = {row["placeId"] for row in current_new}
    batch_existing = already & expected_places
    if batch_existing and batch_existing != set(accepted):
        raise SystemExit("partial batch records already exist; inspect the working tree before retrying")

    if batch_existing:
        records = [row for row in current_new if row["placeId"] in accepted]
        if any(row.get("role") != "experience" for row in records):
            raise SystemExit("existing batch record has a non-experience role")
        print(f"Using {len(records)} already-prepared experience record(s) for batch {args.batch}")
    else:
        preparer = import_preparer()
        records = []
        for entry in entries:
            record = preparer.build(entry, plan["acquisitionDate"])
            record["role"] = "experience"
            records.append(record)
            print(f"prepared {entry['placeId']} — {record['license']} — {record['originalWidth']}x{record['originalHeight']}", file=sys.stderr)
            time.sleep(1.0)
        titles = {row["originalTitle"] for row in images}
        if any(row["originalTitle"] in titles for row in records):
            raise SystemExit("a selected Commons originalTitle already exists in the registry")
        images.extend(records)
        metadata["imageCount"] = len(images)
        atomic_json(METADATA, metadata)

    manifest = ROOT / f"data/visual/.b6-4-batch-{args.batch}-acquisition.json"
    atomic_json(manifest, {"images": records})
    print(f"OK: batch {args.batch}: {len(records)} experience acquisition(s), {len(unresolved)} unresolved; manifest {manifest.name}")


if __name__ == "__main__":
    main()
