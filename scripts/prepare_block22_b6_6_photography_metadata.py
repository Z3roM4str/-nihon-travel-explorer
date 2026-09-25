#!/usr/bin/env python3
"""Build B6.6 identity records from the accepted Commons original pages/API metadata."""
import importlib.util
import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREPARER = ROOT / "scripts/prepare-block2-photography-metadata.py"
PLAN = ROOT / "data/visual/block22-b6-6-acquisition-plan.json"
BASELINE = ROOT / "data/visual/block22-b6-6-baseline.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
APP_METADATA = ROOT / "app/src/data/photography-metadata.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/visual/block22-b6-6-prepared-records.json")
    parser.add_argument("--merge", action="store_true", help="append the verified records and sync the app registry")
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("block2_preparer", PREPARER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    targets = {row["placeId"] for row in baseline["gradeRows"] if row["needsIdentity"]}
    decisions = [row["placeId"] for row in plan["entries"] + plan["unresolved"]]
    if len(decisions) != len(set(decisions)) or set(decisions) != targets:
        raise SystemExit(f"plan must partition data-derived targets exactly; missing={sorted(targets-set(decisions))}, extra={sorted(set(decisions)-targets)}")
    if any(row.get("role") != "identity" for row in plan["entries"]):
        raise SystemExit("B6.6 acquisition plan may contain identity records only")
    for row in plan["unresolved"]:
        allowed = {"UNRESOLVED — LICENSE", "UNRESOLVED — COPYRIGHTED SUBJECT", "UNRESOLVED — RESOLUTION",
                   "UNRESOLVED — NO REPRESENTATIVE IMAGE", "UNRESOLVED — LOCATION UNVERIFIABLE", "UNRESOLVED — NO MATERIAL FOUND"}
        if row.get("category") not in allowed or not row.get("reason"):
            raise SystemExit(f"incomplete unresolved decision for {row.get('placeId')}")
        if len(row.get("searchSources", [])) < 2 or len(row.get("candidatesRejected", [])) < 2:
            raise SystemExit(f"{row['placeId']} needs multiple searches and rejected candidates")
    records = []
    for entry in plan["entries"]:
        if entry["role"] != "identity":
            raise SystemExit(f"{entry['placeId']}: B6.6 only accepts identity")
        page = "https://commons.wikimedia.org/wiki/" + entry["title"].replace(":", ":", 1).replace(" ", "_")
        if page != entry["sourcePage"]:
            raise SystemExit(f"{entry['placeId']}: declared original page differs from the candidate title: {page}")
        record = helper.build(entry, plan["acquisitionDate"])
        record["role"] = "identity"
        records.append(record)
        print(f"prepared {entry['placeId']} from verified original page", file=sys.stderr)
        time.sleep(1.0)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.merge:
        metadata = json.loads(METADATA.read_text(encoding="utf-8"))
        for row in records:
            matches = [index for index, previous in enumerate(metadata["images"])
                       if previous.get("placeId") == row["placeId"]]
            if not matches:
                if any(previous.get("originalTitle") == row["originalTitle"] for previous in metadata["images"]):
                    raise SystemExit(f"duplicate original title: {row['originalTitle']}")
                metadata["images"].append(row)
                continue
            # A B6.6 candidate may be superseded before certification, but only for the same
            # baseline target whose provisional record was created by this block. The plan
            # carries the old original as a rejected candidate and its source page.
            if len(matches) != 1 or row["placeId"] not in targets:
                raise SystemExit(f"refusing to overwrite a non-B6.6 target: {row['placeId']}")
            previous = metadata["images"][matches[0]]
            previous_content = {key: value for key, value in previous.items() if key != "lqip"}
            row_content = {key: value for key, value in row.items() if key != "lqip"}
            if previous_content == row_content:
                continue
            entry = next(item for item in plan["entries"] if item["placeId"] == row["placeId"])
            rejected_titles = {candidate.get("title") for candidate in entry.get("candidatesRejected", [])}
            if previous.get("role") != "identity" or previous.get("originalTitle") not in rejected_titles:
                raise SystemExit(f"refusing an unrecorded or non-identity replacement: {row['placeId']}")
            if any(index != matches[0] and existing.get("originalTitle") == row["originalTitle"]
                   for index, existing in enumerate(metadata["images"])):
                raise SystemExit(f"duplicate original title: {row['originalTitle']}")
            metadata["images"][matches[0]] = row
        metadata["imageCount"] = len(metadata["images"])
        temp = METADATA.with_suffix(METADATA.suffix + ".tmp")
        temp.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temp, METADATA)
        APP_METADATA.write_bytes(METADATA.read_bytes())
        print(f"Merged {len(records)} identity records; app registry synchronized")
    print(f"Wrote {args.output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
