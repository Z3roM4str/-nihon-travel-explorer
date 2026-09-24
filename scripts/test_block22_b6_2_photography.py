#!/usr/bin/env python3
"""B6.2 regression gate: grade-A identity photography for the pinned 35 uncovered places."""
import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "data/visual/block22-b6-2-baseline.json"
PLAN_PATH = ROOT / "data/visual/block22-b6-2-acquisition-plan.json"
PLACES_PATH = ROOT / "data/places.json"
METADATA_PATH = ROOT / "data/visual/photography-metadata.json"
APP_METADATA_PATH = ROOT / "app/src/data/photography-metadata.json"
ASSET_ROOT = ROOT / "app/public"
PLACE_IMAGES_TS = ROOT / "app/src/data/place-images.ts"

SPEC = importlib.util.spec_from_file_location(
    "validate_photography", ROOT / "scripts/validate-photography.py"
)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Block22B62PhotographyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = load(BASELINE_PATH)
        cls.plan = load(PLAN_PATH)
        cls.places = load(PLACES_PATH)
        cls.metadata = load(METADATA_PATH)
        cls.targets = {row["placeId"] for row in cls.baseline["gradeAMissing"]}
        cls.planned = {entry["placeId"]: entry for entry in cls.plan["entries"]}
        cls.unresolved = {row["placeId"] for row in cls.plan.get("unresolved", [])}
        cls.by_place = {}
        for record in cls.metadata["images"]:
            cls.by_place.setdefault(record["placeId"], []).append(record)

    def test_baseline_gate_is_147_and_35(self):
        self.assertEqual(self.baseline["gradeATotal"], 147)
        self.assertEqual(self.baseline["gradeAMissingCount"], 35)
        self.assertEqual(len(self.targets), 35)
        self.assertEqual(self.baseline["imageCount"], 167)
        self.assertEqual(self.baseline["coveredPlaceCount"], 161)

    def test_targets_rederive_from_base_registry(self):
        base = {r["placeId"] for r in self.metadata["images"] if r["placeId"] not in self.targets}
        derived = {p["id"] for p in self.places if p["grade"] == "A" and p["id"] not in base}
        self.assertEqual(derived, self.targets)

    def test_plan_only_touches_targets_once(self):
        self.assertLessEqual(set(self.planned), self.targets)
        self.assertLessEqual(self.unresolved, self.targets)
        self.assertFalse(set(self.planned) & self.unresolved)
        self.assertEqual(len(self.plan["entries"]), len(self.planned))

    def test_every_target_is_acquired_or_unresolved_and_nothing_else_changed(self):
        acquired = {pid for pid in self.targets if pid in self.by_place}
        self.assertEqual(acquired, set(self.planned) & acquired)
        for place_id in self.unresolved:
            self.assertNotIn(place_id, self.by_place, place_id)
        new_records = self.metadata["images"][self.baseline["imageCount"]:]
        self.assertEqual({r["placeId"] for r in new_records}, acquired)
        self.assertEqual(len(new_records), len(acquired))

    def test_acquired_targets_are_single_complete_identity_records(self):
        for place_id in self.targets:
            records = self.by_place.get(place_id, [])
            if not records:
                continue
            self.assertEqual(len(records), 1, place_id)
            record = records[0]
            entry = self.planned[place_id]
            self.assertEqual(record["role"], "identity", place_id)
            self.assertEqual(record["originalTitle"], entry["title"], place_id)
            self.assertEqual(record["alt"], entry["alt"], place_id)
            self.assertIn(record["license"], validator.SUPPORTED_LICENSES, place_id)
            for field in (
                "assetPath", "alt", "source", "sourceUrl", "credit", "license", "licenseUrl",
                "acquisitionUrl", "acquisitionDate", "originalTitle", "originalWidth",
                "originalHeight", "processing", "lqip",
            ):
                if field == "credit" and record["license"] == "CC0":
                    continue
                self.assertTrue(record.get(field), f"{place_id}: missing {field}")
            self.assertTrue(validator.valid_lqip(record["lqip"]), place_id)
            self.assertTrue(validator.is_usable_alt(record["alt"]), place_id)

    def test_acquired_assets_decode_with_all_renditions(self):
        for place_id in self.targets:
            for record in self.by_place.get(place_id, []):
                original = ASSET_ROOT / record["assetPath"]
                with Image.open(original) as image:
                    image.load()
                    self.assertEqual(max(image.size), 1600, place_id)
                    original_width = image.width
                for width in validator.DERIVATIVE_WIDTHS:
                    derivative = ASSET_ROOT / validator.derivative_path_for(record["assetPath"], width)
                    with Image.open(derivative) as image:
                        image.load()
                        self.assertEqual(image.width, min(width, original_width))

    def test_grade_s_coverage_is_preserved(self):
        s_places = [p for p in self.places if p["grade"] == "S"]
        self.assertEqual(sum(1 for p in s_places if p["id"] in self.by_place), len(s_places))

    def test_no_registered_file_shares_bytes(self):
        self.assertEqual(validator.validate_unique_asset_bytes(self.metadata, ASSET_ROOT), [])

    def test_canonical_and_app_metadata_are_identical(self):
        self.assertEqual(METADATA_PATH.read_bytes(), APP_METADATA_PATH.read_bytes())

    def test_place_images_source_is_unchanged_from_b6_2_base(self):
        digest = hashlib.sha256(PLACE_IMAGES_TS.read_bytes()).hexdigest()
        self.assertEqual(digest, self.baseline["placeImagesTsSha256"])

    def test_every_hub_list_payload_stays_within_contract(self):
        hub_of = {p["id"]: p["hub"] for p in self.places}
        totals = {}
        for place_id, records in self.by_place.items():
            path = ASSET_ROOT / validator.derivative_path_for(records[0]["assetPath"], 800)
            totals[hub_of[place_id]] = totals.get(hub_of[place_id], 0) + path.stat().st_size
        for hub, total in totals.items():
            self.assertLessEqual(total, validator.CITY_IMAGE_BUDGET_BYTES, f"{hub}: {total}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
