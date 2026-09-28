#!/usr/bin/env python3
"""Append the four reviewed B6.1 Commons records from live source evidence.

The script reuses the existing Block 2 preparation contract for license, creator, dimensions,
source URL, acquisition URL and processing. It only supplies the reviewed subject choice, alt
text and the B6 ``identity`` role. It refuses any base other than checkpoint A's 163 records.
"""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN_PATH = ROOT / "data/visual/block22-b6-1-acquisition-plan.json"
CANONICAL = ROOT / "data/visual/photography-metadata.json"
APP_COPY = ROOT / "app/src/data/photography-metadata.json"
EXPECTED_TARGETS = {"JP-033", "JP-126", "JP-203", "JP-204"}
EXPECTED_BASE_COUNT = 163

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
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    metadata = json.loads(CANONICAL.read_text(encoding="utf-8"))
    images = metadata.get("images", [])
    entries = plan.get("entries", [])

    if metadata.get("imageCount") != EXPECTED_BASE_COUNT or len(images) != EXPECTED_BASE_COUNT:
        raise SystemExit(
            "B6.1 acquisition requires checkpoint A's exact 163-record registry; "
            f"found imageCount={metadata.get('imageCount')!r}, len={len(images)}"
        )
    if {entry.get("placeId") for entry in entries} != EXPECTED_TARGETS or len(entries) != 4:
        raise SystemExit("B6.1 acquisition plan must contain exactly the four pinned target IDs")
    if any(entry.get("role") != "identity" for entry in entries):
        raise SystemExit("B6.1 accepts only one identity image per target")

    existing_places = {record["placeId"] for record in images}
    existing_titles = {record["originalTitle"] for record in images}
    new_records = []
    for entry in entries:
        if entry["placeId"] in existing_places:
            raise SystemExit(f"{entry['placeId']}: target already has photography")
        if entry["title"] in existing_titles:
            raise SystemExit(f"{entry['placeId']}: Commons source is already registered")
        record = prepare.build(entry, plan["acquisitionDate"])
        record["role"] = "identity"
        new_records.append(record)
        print(
            f"OK {entry['placeId']} {record['license']} "
            f"{record['originalWidth']}x{record['originalHeight']} {record['originalTitle']}"
        )

    metadata["images"] = images + new_records
    metadata["imageCount"] = len(metadata["images"])
    if metadata["imageCount"] != 167:
        raise SystemExit(f"expected 167 total records, got {metadata['imageCount']}")
    payload = json.dumps(metadata, ensure_ascii=False, indent=2) + "\n"
    write_atomically(CANONICAL, payload)
    write_atomically(APP_COPY, payload)
    print("OK: appended four source-backed B6.1 metadata records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
