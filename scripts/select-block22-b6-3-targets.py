#!/usr/bin/env python3
"""Pin or verify grade-B places without photography at the B6.3 base."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / 'data/visual/block22-b6-3-baseline.json'
PLACES = ROOT / 'data/places.json'
METADATA = ROOT / 'data/visual/photography-metadata.json'


def derive(places, images):
    covered = {image['placeId'] for image in images}
    grade_b = [place for place in places if place['grade'] == 'B']
    missing = [place for place in grade_b if place['id'] not in covered]
    return grade_b, missing, covered


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    places = json.loads(PLACES.read_text(encoding='utf-8'))
    images = json.loads(METADATA.read_text(encoding='utf-8'))['images']
    if args.check:
        baseline = json.loads(BASELINE.read_text(encoding='utf-8'))
        targets = {row['placeId'] for row in baseline['gradeBMissing']}
        base_images = [image for image in images if image['placeId'] not in targets]
        grade_b, missing, _ = derive(places, base_images)
        assert len(grade_b) == 25
        assert {place['id'] for place in missing} == targets
        print(f'OK: B6.3 target set re-derived ({len(targets)} places)')
        return
    grade_b, missing, covered = derive(places, images)
    print(f'grade B: {len(grade_b)}; covered: {len(grade_b)-len(missing)}; missing: {len(missing)}')
    if (len(grade_b), len(grade_b)-len(missing), len(missing)) != (25, 17, 8):
        raise SystemExit('STOP: B6.3 requires 25 / 17 / 8 before acquisition')
    baseline = {
        'version': 1,
        'baseSha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'imageCount': len(images),
        'coveredPlaceCount': len(covered),
        'gradeBTotal': len(grade_b),
        'gradeBCovered': len(grade_b)-len(missing),
        'gradeBMissingCount': len(missing),
        'gradeBMissing': [{'placeId': p['id'], 'name': p['name'], 'hub': p['hub'], 'grade': p['grade']} for p in missing],
        'placeImagesTsSha256': hashlib.sha256((ROOT / 'app/src/data/place-images.ts').read_bytes()).hexdigest(),
    }
    BASELINE.write_text(json.dumps(baseline, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('OK: pinned B6.3 targets')


if __name__ == '__main__':
    main()
