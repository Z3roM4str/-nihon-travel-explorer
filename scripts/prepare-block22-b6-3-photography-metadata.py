#!/usr/bin/env python3
"""Append reviewed B6.3 identity records using the Block 2 Commons contract."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / 'data/visual/block22-b6-3-acquisition-plan.json'
BASELINE = ROOT / 'data/visual/block22-b6-3-baseline.json'
CANONICAL = ROOT / 'data/visual/photography-metadata.json'
APP_COPY = ROOT / 'app/src/data/photography-metadata.json'
spec = importlib.util.spec_from_file_location('prepare_block2', ROOT / 'scripts/prepare-block2-photography-metadata.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def main():
    plan = json.loads(PLAN.read_text(encoding='utf-8'))
    baseline = json.loads(BASELINE.read_text(encoding='utf-8'))
    metadata = json.loads(CANONICAL.read_text(encoding='utf-8'))
    targets = {row['placeId'] for row in baseline['gradeBMissing']}
    planned = [entry['placeId'] for entry in plan['entries']]
    unresolved = {row['placeId'] for row in plan['unresolved']}
    assert len(planned) == len(set(planned))
    assert set(planned) | unresolved == targets
    assert not set(planned) & unresolved
    existing_places = {record['placeId'] for record in metadata['images']}
    existing_titles = {record['originalTitle'] for record in metadata['images']}
    new_records = []
    for entry in plan['entries']:
        if entry['placeId'] in existing_places:
            print(f"SKIP {entry['placeId']}: already acquired")
            continue
        assert entry['role'] == 'identity'
        assert entry['title'] not in existing_titles
        record = prepare.build(entry, plan['acquisitionDate'])
        record['role'] = 'identity'
        new_records.append(record)
        existing_titles.add(entry['title'])
        print(f"OK {record['placeId']} {record['license']} {record['originalWidth']}x{record['originalHeight']}")
    if not new_records:
        return
    metadata['images'].extend(new_records)
    metadata['imageCount'] = len(metadata['images'])
    payload = json.dumps(metadata, ensure_ascii=False, indent=2) + '\n'
    for path in (CANONICAL, APP_COPY):
        temporary = path.with_suffix(path.suffix + '.tmp')
        temporary.write_text(payload, encoding='utf-8')
        temporary.replace(path)
    print(f"OK: appended {len(new_records)} B6.3 identities")


if __name__ == '__main__':
    main()
