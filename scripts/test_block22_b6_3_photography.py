#!/usr/bin/env python3
"""B6.3 certification: pinned dataset targets, acquisition, assets and coverage."""
import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / 'data/visual/block22-b6-3-baseline.json'
PLAN = ROOT / 'data/visual/block22-b6-3-acquisition-plan.json'
LATER_PLANS = [ROOT / f'data/visual/block22-b6-{number}-acquisition-plan.json' for number in (4, 5, 6)]
PLACES = ROOT / 'data/places.json'
METADATA = ROOT / 'data/visual/photography-metadata.json'
APP_METADATA = ROOT / 'app/src/data/photography-metadata.json'
ASSETS = ROOT / 'app/public'
spec = importlib.util.spec_from_file_location('validator', ROOT / 'scripts/validate-photography.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


class B63PhotographyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = load(BASELINE)
        cls.plan = load(PLAN)
        cls.places = load(PLACES)
        cls.metadata = load(METADATA)
        cls.images = cls.metadata['images']
        cls.targets = {row['placeId'] for row in cls.baseline['gradeBMissing']}
        cls.entries = {entry['placeId']: entry for entry in cls.plan['entries']}
        cls.unresolved = {row['placeId']: row for row in cls.plan['unresolved']}
        cls.by_place = {}
        for image in cls.images:
            cls.by_place.setdefault(image['placeId'], []).append(image)

    def test_base_and_real_targets(self):
        b = self.baseline
        self.assertEqual(b['baseSha'], '80f638ae68e88ad62d8c706d75c3aa107b27f4f2')
        self.assertEqual((b['gradeBTotal'], b['gradeBCovered'], b['gradeBMissingCount']), (25, 17, 8))
        self.assertEqual((b['imageCount'], b['coveredPlaceCount']), (194, 188))
        base_covered = {r['placeId'] for r in self.images[:b['imageCount']]}
        grade_b = [p for p in self.places if p['grade'] == 'B']
        self.assertEqual(len(grade_b), 25)
        self.assertEqual({p['id'] for p in grade_b if p['id'] not in base_covered}, self.targets)

    def test_plan_partitions_exact_targets(self):
        self.assertEqual(set(self.entries) | set(self.unresolved), self.targets)
        self.assertFalse(set(self.entries) & set(self.unresolved))
        self.assertEqual(len(self.entries), len(self.plan['entries']))
        allowed = {
            'UNRESOLVED — LICENSE', 'UNRESOLVED — COPYRIGHTED SUBJECT',
            'UNRESOLVED — RESOLUTION', 'UNRESOLVED — NO REPRESENTATIVE IMAGE',
            'UNRESOLVED — LOCATION UNVERIFIABLE', 'UNRESOLVED — NO MATERIAL FOUND',
        }
        for row in self.unresolved.values():
            self.assertIn(row['category'], allowed)
            self.assertTrue(row['reason'])
            self.assertTrue(row['candidatesRejected'])

    def test_acquired_count_and_unchanged_base(self):
        # Later photography blocks append to the shared registry too. Isolate
        # this block's additions by its pinned plan instead of treating every
        # post-baseline image as a B6.3 acquisition.
        new = [image for image in self.images if image['placeId'] in self.entries]
        self.assertEqual(len(new), len(self.entries))
        self.assertEqual({r['placeId'] for r in new}, set(self.entries))
        for pid in self.unresolved:
            self.assertNotIn(pid, self.by_place)
        self.assertEqual(self.metadata['imageCount'], len(self.images))
        base_covered = {row['placeId'] for row in self.images[:self.baseline['imageCount']]}
        later_ids = set()
        for path in LATER_PLANS:
            plan = load(path)
            entries = plan.get('entries', [])
            entries += [entry for batch in plan.get('batches', []) for entry in batch.get('entries', [])]
            later_ids.update(entry['placeId'] for entry in entries)
        expected_new_places = (set(self.entries) | later_ids) - base_covered
        self.assertEqual(len(self.by_place), self.baseline['coveredPlaceCount'] + len(expected_new_places))

    def test_new_identity_metadata_lqip_and_assets(self):
        for pid, entry in self.entries.items():
            records = self.by_place[pid]
            self.assertEqual(len(records), 1, pid)
            record = records[0]
            self.assertEqual(record['role'], 'identity', pid)
            self.assertEqual(record['originalTitle'], entry['title'], pid)
            self.assertEqual(record['alt'], entry['alt'], pid)
            self.assertIn(record['license'], validator.SUPPORTED_LICENSES, pid)
            self.assertTrue(validator.valid_lqip(record['lqip']), pid)
            for field in ('assetPath', 'source', 'sourceUrl', 'credit', 'acquisitionUrl',
                          'acquisitionDate', 'originalWidth', 'originalHeight', 'processing'):
                self.assertTrue(record.get(field), f'{pid}: {field}')
            if record['license'] == 'Public Domain':
                self.assertEqual(record.get('licenseBasis'), 'PD-self')
                self.assertNotIn('licenseUrl', record)
            else:
                self.assertTrue(record.get('licenseUrl'))
            original = ASSETS / record['assetPath']
            with Image.open(original) as image:
                image.load()
                self.assertLessEqual(max(image.size), 1600)
                width = image.width
            for rendition_width in (800, 400):
                derivative = ASSETS / validator.derivative_path_for(record['assetPath'], rendition_width)
                with Image.open(derivative) as image:
                    image.load()
                    self.assertEqual(image.width, min(rendition_width, width))

    def test_metadata_sync_and_place_images_source(self):
        self.assertEqual(METADATA.read_bytes(), APP_METADATA.read_bytes())
        source = (ROOT / 'app/src/data/place-images.ts').read_bytes().replace(b'\r\n', b'\n')
        digests = {hashlib.sha256(source).hexdigest(), hashlib.sha256(source.replace(b'\n', b'\r\n')).hexdigest()}
        self.assertIn(self.baseline['placeImagesTsSha256'], digests)

    def test_final_coverage_and_regressions(self):
        covered = set(self.by_place)
        counts = {grade: (sum(p['grade'] == grade and p['id'] in covered for p in self.places),
                          sum(p['grade'] == grade for p in self.places)) for grade in ('B', 'A', 'S')}
        self.assertEqual(counts['B'], (17 + len(self.entries), 25))
        self.assertEqual(counts['A'], (139, 147))
        self.assertEqual(counts['S'], (32, 32))
        self.assertEqual({p['id'] for p in self.places if p['grade'] == 'A' and p['id'] not in covered},
                         {'JP-050', 'JP-079', 'JP-095', 'JP-120', 'JP-121', 'JP-168', 'JP-195', 'JP-202'})

    def test_zero_duplicate_assets_and_sources(self):
        self.assertEqual(validator.validate_unique_asset_bytes(self.metadata, ASSETS), [])
        titles = [r['originalTitle'] for r in self.images]
        self.assertEqual(len(titles), len(set(titles)))

    def test_every_hub_under_budget(self):
        hubs = {p['id']: p['hub'] for p in self.places}
        totals = {}
        for pid, records in self.by_place.items():
            derivative = ASSETS / validator.derivative_path_for(records[0]['assetPath'], 800)
            totals[hubs[pid]] = totals.get(hubs[pid], 0) + derivative.stat().st_size
        for hub, total in totals.items():
            self.assertLessEqual(total, 3_500_000, f'{hub}: {total}')


if __name__ == '__main__':
    unittest.main(verbosity=2)
