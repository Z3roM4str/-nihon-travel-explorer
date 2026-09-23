#!/usr/bin/env python3
"""B6.1 regression gate for the exact grade-S photography baseline and results."""
import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "data/visual/block22-b6-1-baseline.json"
PLACES_PATH = ROOT / "data/places.json"
METADATA_PATH = ROOT / "data/visual/photography-metadata.json"
APP_METADATA_PATH = ROOT / "app/src/data/photography-metadata.json"
ASSET_ROOT = ROOT / "app/public"
PLACE_IMAGES_TS = ROOT / "app/src/data/place-images.ts"
EXPECTED_TARGETS = {"JP-033", "JP-126", "JP-203", "JP-204"}

SPEC = importlib.util.spec_from_file_location(
    "validate_photography", ROOT / "scripts/validate-photography.py"
)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Block22PhotographyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = load(BASELINE_PATH)
        cls.places = load(PLACES_PATH)
        cls.metadata = load(METADATA_PATH)
        cls.images = cls.metadata["images"]
        cls.by_place = {}
        for record in cls.images:
            cls.by_place.setdefault(record["placeId"], []).append(record)

    def test_exact_b6_1_baseline_ids_are_pinned(self):
        self.assertEqual(
            {row["placeId"] for row in self.baseline["gradeSMissing"]},
            EXPECTED_TARGETS,
        )
        self.assertEqual(self.baseline["gradeSMissingCount"], 4)
        self.assertEqual(self.baseline["gradeSTotal"], 32)

    def test_current_s_grade_gap_is_only_unacquired_b6_1_targets(self):
        covered = set(self.by_place)
        missing = {place["id"] for place in self.places if place["grade"] == "S" and place["id"] not in covered}
        self.assertEqual(missing, EXPECTED_TARGETS - covered)

    def test_each_target_has_at_most_one_b6_1_image(self):
        for place_id in EXPECTED_TARGETS:
            self.assertLessEqual(len(self.by_place.get(place_id, [])), 1, place_id)

    def test_acquired_targets_are_complete_identity_records(self):
        for place_id in EXPECTED_TARGETS:
            records = self.by_place.get(place_id, [])
            if not records:
                continue
            record = records[0]
            self.assertEqual(record["role"], "identity", place_id)
            self.assertIn(record["license"], validator.SUPPORTED_LICENSES, place_id)
            for field in (
                "assetPath", "alt", "source", "sourceUrl", "credit", "license",
                "licenseUrl", "acquisitionUrl", "acquisitionDate", "originalTitle",
                "originalWidth", "originalHeight", "processing", "lqip",
            ):
                self.assertTrue(record.get(field), f"{place_id}: missing {field}")
            self.assertTrue(validator.valid_lqip(record["lqip"]), place_id)

    def test_acquired_target_assets_decode_with_both_derivatives(self):
        for place_id in EXPECTED_TARGETS:
            records = self.by_place.get(place_id, [])
            if not records:
                continue
            record = records[0]
            original = ASSET_ROOT / record["assetPath"]
            self.assertTrue(original.is_file(), place_id)
            with Image.open(original) as image:
                image.load()
                self.assertGreater(image.width, 0)
                self.assertGreater(image.height, 0)
                original_width = image.width
            for width in validator.DERIVATIVE_WIDTHS:
                derivative = ASSET_ROOT / validator.derivative_path_for(record["assetPath"], width)
                self.assertTrue(derivative.is_file(), f"{place_id}: missing {width}w")
                with Image.open(derivative) as image:
                    image.load()
                    self.assertEqual(image.width, min(width, original_width))

    def test_canonical_and_app_metadata_are_identical(self):
        self.assertEqual(METADATA_PATH.read_bytes(), APP_METADATA_PATH.read_bytes())

    def test_place_images_source_was_not_manually_edited(self):
        digest = hashlib.sha256(PLACE_IMAGES_TS.read_bytes()).hexdigest()
        self.assertEqual(digest, self.baseline["placeImagesTsSha256"])

    def test_city_list_payloads_stay_within_contract(self):
        first_by_place = {place_id: records[0] for place_id, records in self.by_place.items()}
        for hub in ("Tokio", "Osaka"):
            total = 0
            for place in self.places:
                if place["hub"] != hub or place["id"] not in first_by_place:
                    continue
                path = validator.derivative_path_for(first_by_place[place["id"]]["assetPath"], 800)
                total += (ASSET_ROOT / path).stat().st_size
            self.assertLessEqual(total, validator.CITY_IMAGE_BUDGET_BYTES, f"{hub}: {total}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
