#!/usr/bin/env python3
"""Append reviewed B6.2 grade-A identity records from live Commons evidence.

Usage:
    python3 scripts/prepare-block22-b6-2-photography-metadata.py [--batch N]

Reuses the Block 2 preparation contract (`prepare-block2-photography-metadata.build`) for
license, creator, dimensions, source URL, acquisition URL and processing, exactly as B6.1
did. The plan only supplies the reviewed subject choice, slug, alt text and the B6
``identity`` role.

Guards:
* every plan entry must be a pinned B6.2 target (`block22-b6-2-baseline.json`);
* a target that already has photography is skipped, never given a second image;
* a Commons file already registered for any place is refused;
* entries listed as ``unresolved`` are never appended.

Idempotent: re-running after a batch appends nothing new.
"""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN_PATH = ROOT / "data/visual/block22-b6-2-acquisition-plan.json"
BASELINE_PATH = ROOT / "data/visual/block22-b6-2-baseline.json"
CANONICAL = ROOT / "data/visual/photography-metadata.json"
APP_COPY = ROOT / "app/src/data/photography-metadata.json"

SPEC = importlib.util.spec_from_file_location(
    "prepare_block2", ROOT / "scripts/prepare-block2-photography-metadata.py"
)
prepare = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(prepare)


def write_atomically(path: Path, payload: str) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(payload, encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", type=int, default=None, help="Only append entries of this batch.")
    args = parser.parse_args()

    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    metadata = json.loads(CANONICAL.read_text(encoding="utf-8"))
    images = metadata["images"]

    targets = {row["placeId"] for row in baseline["gradeAMissing"]}
    unresolved = {row["placeId"] for row in plan.get("unresolved", [])}
    entries = plan.get("entries", [])
    if args.batch is not None:
        entries = [entry for entry in entries if entry.get("batch") == args.batch]

    planned_ids = [entry["placeId"] for entry in plan.get("entries", [])]
    if len(planned_ids) != len(set(planned_ids)):
        raise SystemExit("B6.2 plan lists a target more than once; exactly one image per target")
    if unresolved & set(planned_ids):
        raise SystemExit("a B6.2 target cannot be both planned and unresolved")

    existing_places = {record["placeId"] for record in images}
    existing_titles = {record["originalTitle"] for record in images}
    new_records = []
    for entry in entries:
        place_id = entry["placeId"]
        if place_id not in targets:
            raise SystemExit(f"{place_id}: not a pinned B6.2 target")
        if entry.get("role") != "identity":
            raise SystemExit(f"{place_id}: B6.2 accepts only one identity image per target")
        if place_id in existing_places:
            print(f"SKIP {place_id}: already has photography")
            continue
        if entry["title"] in existing_titles:
            raise SystemExit(f"{place_id}: Commons source is already registered")
        record = prepare.build(entry, plan["acquisitionDate"])
        record["role"] = "identity"
        new_records.append(record)
        existing_titles.add(entry["title"])
        print(
            f"OK {place_id} {record['license']} "
            f"{record['originalWidth']}x{record['originalHeight']} {record['originalTitle']}"
        )

    if not new_records:
        print("OK: nothing to append")
        return 0
    metadata["images"] = images + new_records
    metadata["imageCount"] = len(metadata["images"])
    payload = json.dumps(metadata, ensure_ascii=False, indent=2) + "\n"
    write_atomically(CANONICAL, payload)
    write_atomically(APP_COPY, payload)
    print(f"OK: appended {len(new_records)} B6.2 record(s); registry now {metadata['imageCount']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
