#!/usr/bin/env python3
"""Prepare one data-derived B6.5 batch without hand-authoring Commons metadata."""
import argparse
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "data/visual/block22-b6-5-baseline.json"
PLAN = ROOT / "data/visual/block22-b6-5-acquisition-plan.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
APP_METADATA = ROOT / "app/src/data/photography-metadata.json"
ROLES = {"detail", "context", "seasonal"}


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


def target_batches(baseline, batch_size):
    targets = [row["placeId"] for row in baseline["gradeSRows"] if row["needsB65"]]
    return [targets[index:index + batch_size] for index in range(0, len(targets), batch_size)]


def role_order(role):
    return {"identity": 0, "experience": 1, "detail": 2, "context": 2, "seasonal": 3}.get(role, 9)


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
    batches = target_batches(baseline, plan["batchSize"])
    if args.batch < 1 or args.batch > len(batches):
        raise SystemExit(f"batch must be in 1..{len(batches)}")
    expected_places = set(batches[args.batch - 1])
    plan_batch = next((row for row in plan["batches"] if row["batch"] == args.batch), None)
    if not plan_batch:
        raise SystemExit(f"B6.5 acquisition plan has no batch {args.batch}")
    entries = plan_batch.get("entries", [])
    unresolved = plan_batch.get("unresolved", [])
    decisions = [row["placeId"] for row in entries + unresolved]
    if len(decisions) != len(set(decisions)) or set(decisions) != expected_places:
        missing = sorted(expected_places - set(decisions))
        extra = sorted(set(decisions) - expected_places)
        raise SystemExit(f"batch {args.batch} plan must partition data-derived targets; missing={missing}, extra={extra}")
    if any(row.get("role") not in ROLES for row in entries):
        raise SystemExit("every B6.5 acquisition must use detail, context or seasonal")
    for entry in entries:
        if not all(entry.get(field) for field in ("whyRole", "identityComparison", "sourcePage", "originalPage", "candidatesRejected")):
            raise SystemExit(f"incomplete B6.5 editorial evidence for {entry['placeId']}")
        if len(entry["candidatesRejected"]) < 2:
            raise SystemExit(f"{entry['placeId']} needs at least two rejected-candidate comparisons")
    for row in unresolved:
        if not row.get("category", "").startswith("UNRESOLVED — ") or not row.get("reason"):
            raise SystemExit(f"incomplete unresolved decision for {row.get('placeId')}")
        if len(row.get("searchSources", [])) < 2 or len(row.get("candidatesRejected", [])) < 2:
            raise SystemExit(f"{row['placeId']} needs multiple searches and rejected candidates")

    images = metadata["images"]
    for rejected in plan_batch.get("rejectedPreparedRecords", []):
        matches = [
            row for row in images
            if row.get("placeId") == rejected["placeId"]
            and row.get("originalTitle") == rejected["title"]
        ]
        if len(matches) > 1:
            raise SystemExit(f"rejected B6.5 candidate appears more than once: {rejected['title']}")
        if matches:
            if matches[0].get("role") not in ROLES:
                raise SystemExit(f"refusing to remove a non-complementary record: {rejected['title']}")
            images.remove(matches[0])

    accepted_titles = {entry["title"] for batch in plan["batches"] for entry in batch.get("entries", [])}
    prior_batch_titles = {entry["title"] for batch in plan["batches"] if batch["batch"] < args.batch for entry in batch.get("entries", [])}
    current_batch_titles = {entry["title"] for entry in entries}
    current_records = [row for row in images if row.get("originalTitle") in accepted_titles]
    unexpected = [row["originalTitle"] for row in current_records if row["originalTitle"] not in prior_batch_titles | current_batch_titles]
    if unexpected:
        raise SystemExit(f"unplanned B6.5 record(s) present in registry: {unexpected}")
    current_by_title = {row["originalTitle"]: row for row in current_records}
    if len(current_records) != len(current_by_title):
        raise SystemExit("duplicate accepted B6.5 originalTitle in registry")
    previous_entries = [entry for batch in sorted(plan["batches"], key=lambda item: item["batch"]) if batch["batch"] < args.batch for entry in batch.get("entries", [])]
    accepted_by_place = {entry["placeId"]: entry for entry in entries}
    records = []
    newly_prepared = []
    preparer = import_preparer()
    for entry in entries:
        existing = current_by_title.get(entry["title"])
        if existing:
            if existing.get("placeId") != entry["placeId"] or existing.get("role") != entry["role"]:
                raise SystemExit(f"existing batch record does not match plan: {entry['placeId']}")
            records.append(existing)
            continue
        if any(row.get("placeId") == entry["placeId"] and row.get("role") in ROLES for row in images):
            raise SystemExit(f"{entry['placeId']} already has complementary coverage; refusing a duplicate role record")
        record = preparer.build(entry, plan["acquisitionDate"])
        record["role"] = entry["role"]
        records.append(record)
        newly_prepared.append(record)
        print(f"prepared {entry['placeId']} · {record['license']} · {record['originalWidth']}x{record['originalHeight']} · {entry['role']}", file=sys.stderr)
        time.sleep(1.0)
    existing_titles = {row["originalTitle"] for row in images}
    if any(row["originalTitle"] in existing_titles for row in newly_prepared):
        raise SystemExit("a selected Commons originalTitle already exists in the registry")

    images.extend(newly_prepared)
    ordered_new = [current_by_title[entry["title"]] for entry in previous_entries]
    ordered_new.extend(records)
    new_titles = {row["originalTitle"] for row in ordered_new}
    images[:] = [row for row in images if row.get("originalTitle") not in new_titles]
    for record in ordered_new:
        same_place = [row for row in images if row.get("placeId") == record["placeId"]]
        if any(row.get("role") in ROLES for row in same_place):
            raise SystemExit(f"{record['placeId']} already has a complementary role in the registry")
        identity_index = next((index for index, row in enumerate(images) if row.get("placeId") == record["placeId"] and row.get("role") == "identity"), None)
        if identity_index is None:
            raise SystemExit(f"cannot order complementary photo without preserved identity: {record['placeId']}")
        gallery_end = identity_index + 1
        while gallery_end < len(images) and images[gallery_end].get("placeId") == record["placeId"]:
            gallery_end += 1
        insertion = identity_index + 1
        while insertion < gallery_end and role_order(images[insertion].get("role")) <= role_order(record["role"]):
            insertion += 1
        images.insert(insertion, record)

    metadata["imageCount"] = len(images)
    atomic_json(METADATA, metadata)
    manifest = ROOT / f"data/visual/.b6-5-batch-{args.batch}-acquisition.json"
    atomic_json(manifest, {"images": records})
    print(f"OK: batch {args.batch}: {len(records)} complementary acquisition(s), {len(unresolved)} unresolved; manifest {manifest.name}")


if __name__ == "__main__":
    main()
