#!/usr/bin/env python3
"""B6.4 Grade-S experience certification, also usable after each batch."""
import argparse
import hashlib
import json
import sys
import unittest
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "data/visual/block22-b6-4-baseline.json"
PLAN = ROOT / "data/visual/block22-b6-4-acquisition-plan.json"
B65_PLAN = ROOT / "data/visual/block22-b6-5-acquisition-plan.json"
PLACES = ROOT / "data/places.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
APP_METADATA = ROOT / "app/src/data/photography-metadata.json"
ASSETS = ROOT / "app/public"
sys.path.insert(0, str(ROOT / "scripts"))
import importlib.util

validator_spec = importlib.util.spec_from_file_location("photography_validator", ROOT / "scripts/validate-photography.py")
validator = importlib.util.module_from_spec(validator_spec)
validator_spec.loader.exec_module(validator)


# `None` = every planned batch. Only the CLI entry point narrows it (`--through-batch N`, to
# certify the registry after an intermediate batch); under pytest the module is imported and
# the `__main__` block never runs, so the default must exist at module level.
BATCH_LIMIT = None


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def expected_batches(baseline, batch_size):
    targets = [row["placeId"] for row in baseline["gradeSRows"] if row["needsExperience"]]
    return [targets[index:index + batch_size] for index in range(0, len(targets), batch_size)]


class B64PhotographyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = load(BASELINE)
        cls.plan = load(PLAN)
        cls.places = load(PLACES)
        cls.metadata = load(METADATA)
        cls.images = cls.metadata["images"]
        cls.batch_size = cls.plan["batchSize"]
        cls.batches = expected_batches(cls.baseline, cls.batch_size)
        cls.through_batch = min(BATCH_LIMIT or len(cls.plan["batches"]), len(cls.batches))
        cls.plan_batches = {row["batch"]: row for row in cls.plan["batches"]}
        cls.processed_batches = range(1, cls.through_batch + 1)
        cls.decisions = {}
        for number in cls.processed_batches:
            row = cls.plan_batches[number]
            for entry in row.get("entries", []):
                cls.decisions[entry["placeId"]] = ("acquired", entry)
            for entry in row.get("unresolved", []):
                cls.decisions[entry["placeId"]] = ("unresolved", entry)
        cls.expected_targets = {pid for number in cls.processed_batches for pid in cls.batches[number - 1]}
        cls.expected_acquired = {
            pid for pid, (state, _) in cls.decisions.items() if state == "acquired"
        }
        cls.expected_acquisition_titles = {
            entry["title"]
            for number in cls.processed_batches
            for entry in cls.plan_batches[number].get("entries", [])
        }
        cls.new_images = [row for row in cls.images if row.get("originalTitle") in cls.expected_acquisition_titles]
        cls.new_titles = {row["originalTitle"] for row in cls.new_images}
        # B6.5 adds complementary records after this B6.4 baseline. Ignore those later additions
        # when reconstructing the B6.4-era photo rows, so this regression remains reusable.
        later_b65_titles = set()
        if B65_PLAN.is_file():
            b65_plan = load(B65_PLAN)
            later_b65_titles = {
                entry["title"]
                for batch in b65_plan.get("batches", [])
                for entry in batch.get("entries", [])
            }
        cls.base_images = [
            row for row in cls.images
            if row.get("originalTitle") not in cls.new_titles | later_b65_titles
        ]
        cls.expected_unresolved = {
            pid for pid, (state, _) in cls.decisions.items() if state == "unresolved"
        }
        cls.by_place = {}
        for image in cls.images:
            cls.by_place.setdefault(image["placeId"], []).append(image)

    def test_base_sha_initial_matrix_and_place_images_hash(self):
        self.assertEqual(self.baseline["baseSha"], "ad456be50e6b855bc79204bc50d26b154eb29441")
        self.assertEqual((self.baseline["imageCount"], self.baseline["coveredPlaceCount"]), (200, 194))
        self.assertEqual((self.baseline["gradeSTotal"], self.baseline["gradeSCovered"]), (32, 32))
        self.assertEqual(self.baseline["gradeSWithExperience"], 2)
        self.assertEqual(self.baseline["gradeSNeedsExperience"], 30)
        source = (ROOT / "app/src/data/place-images.ts").read_bytes().replace(b"\r\n", b"\n")
        digests = {
            hashlib.sha256(source).hexdigest(),
            hashlib.sha256(source.replace(b"\n", b"\r\n")).hexdigest(),
        }
        self.assertIn(self.baseline["placeImagesTsSha256"], digests)
        self.assertEqual(len(self.baseline["gradeSRows"]), 32)
        self.assertEqual(sum(row["needsExperience"] for row in self.baseline["gradeSRows"]), 30)

    def test_plan_uses_stable_data_derived_batches(self):
        self.assertEqual(len(self.batches), 4)
        self.assertEqual(sum(len(batch) for batch in self.batches), 30)
        for number in self.processed_batches:
            self.assertIn(number, self.plan_batches)
            row = self.plan_batches[number]
            decisions = row.get("entries", []) + row.get("unresolved", [])
            ids = [entry["placeId"] for entry in decisions]
            self.assertEqual(set(ids), set(self.batches[number - 1]), f"batch {number}")
            self.assertEqual(len(ids), len(set(ids)), f"batch {number} duplicate decisions")
            self.assertEqual(
                [entry["placeId"] for entry in row.get("entries", [])],
                [pid for pid in self.batches[number - 1] if pid in {entry["placeId"] for entry in row.get("entries", [])}],
                f"batch {number} acquisitions must follow stable data order",
            )
            for entry in row.get("entries", []):
                self.assertEqual(entry.get("role"), "experience")
                self.assertTrue(entry.get("whyExperience"))
                self.assertTrue(entry.get("identityComparison"))
                self.assertTrue(entry.get("sourcePage"))
                self.assertTrue(entry.get("originalPage"))
            for entry in row.get("unresolved", []):
                self.assertIn(entry.get("category"), {
                    "UNRESOLVED — LICENSE",
                    "UNRESOLVED — COPYRIGHTED SUBJECT",
                    "UNRESOLVED — RESOLUTION",
                    "UNRESOLVED — NO REPRESENTATIVE EXPERIENCE",
                    "UNRESOLVED — LOCATION UNVERIFIABLE",
                    "UNRESOLVED — NO MATERIAL FOUND",
                })
                self.assertTrue(entry.get("reason"))
                self.assertGreaterEqual(len(entry.get("searchSources", [])), 2)
                self.assertGreaterEqual(len(entry.get("candidatesRejected", [])), 2)

    def test_initial_grade_s_identity_and_roles_are_preserved(self):
        original = {row["placeId"]: row for row in self.baseline["gradeSRows"]}
        for place_id, row in original.items():
            expected = row["photos"]
            current = self.by_place[place_id]
            current_base = [item for item in current if item in self.base_images]
            self.assertEqual(len(current_base), len(expected), place_id)
            self.assertEqual([item.get("role") for item in current_base], [item["role"] for item in expected], place_id)
            for expected_photo in expected:
                match = next(item for item in current_base if item["assetPath"] == expected_photo["assetPath"])
                actual_hash = hashlib.sha256((ASSETS / match["assetPath"]).read_bytes()).hexdigest()
                self.assertEqual(actual_hash, expected_photo["assetSha256"], f"identity/base asset changed: {place_id}")
            self.assertTrue(any(item.get("role") == "identity" for item in current), place_id)
        self.assertEqual(sum(any(item.get("role") == "identity" for item in self.by_place.get(row["placeId"], [])) for row in self.baseline["gradeSRows"]), 32)

    def test_new_records_partition_and_experience_role(self):
        expected_order = [
            entry["placeId"]
            for number in self.processed_batches
            for entry in self.plan_batches[number].get("entries", [])
        ]
        self.assertEqual(set(row["placeId"] for row in self.new_images), set(expected_order))
        self.assertEqual(set(expected_order), self.expected_acquired)
        self.assertEqual(len(self.new_images), len(self.expected_acquired))
        self.assertTrue(self.expected_targets <= set(self.decisions))
        for place_id, (state, entry) in self.decisions.items():
            if state == "unresolved":
                self.assertFalse(any(row.get("role") == "experience" for row in self.by_place[place_id] if row.get("originalTitle") in self.new_titles), place_id)
                continue
            records = [row for row in self.new_images if row["placeId"] == place_id]
            self.assertEqual(len(records), 1, place_id)
            record = records[0]
            self.assertEqual(record.get("role"), "experience", place_id)
            self.assertEqual(record.get("originalTitle"), entry["title"], place_id)
            self.assertEqual(record.get("alt"), entry["alt"], place_id)
            self.assertEqual(urllib.parse.unquote(record.get("sourceUrl", "")), entry["sourcePage"], place_id)
            self.assertTrue(validator.valid_lqip(record.get("lqip", "")), place_id)
            for field in ("assetPath", "source", "sourceUrl", "credit", "license", "acquisitionUrl", "acquisitionDate", "originalWidth", "originalHeight", "processing"):
                self.assertTrue(record.get(field), f"{place_id}: {field}")
            self.assertIn(record["license"], validator.SUPPORTED_LICENSES, place_id)
            if record["license"] == "Public Domain":
                self.assertIn(record.get("licenseBasis"), {"PD-self", "PD-USGov"}, place_id)
                self.assertNotIn("licenseUrl", record, place_id)
            else:
                self.assertTrue(record.get("licenseUrl"), f"{place_id}: licenseUrl")
            original = ASSETS / record["assetPath"]
            self.assertTrue(original.is_file(), place_id)
            with Image.open(original) as image:
                image.load()
                width = image.width
                self.assertLessEqual(max(image.size), 1600, place_id)
            for rendition_width in (800, 400):
                rendition = ASSETS / validator.derivative_path_for(record["assetPath"], rendition_width)
                self.assertTrue(rendition.is_file(), f"{place_id}: {rendition_width}w")
                with Image.open(rendition) as image:
                    image.load()
                    self.assertEqual(image.width, min(rendition_width, width), place_id)

    def test_rejected_prepared_candidates_are_not_in_registry(self):
        for number in self.processed_batches:
            for rejected in self.plan_batches[number].get("rejectedPreparedRecords", []):
                self.assertFalse(any(
                    row.get("placeId") == rejected["placeId"]
                    and row.get("originalTitle") == rejected["title"]
                    for row in self.images
                ), rejected["title"])

    def test_registry_sync_duplicates_and_identity_ordering(self):
        self.assertEqual(self.metadata["imageCount"], len(self.images))
        self.assertEqual(METADATA.read_bytes(), APP_METADATA.read_bytes())
        self.assertEqual(validator.validate_unique_asset_bytes(self.metadata, ASSETS), [])
        titles = [row["originalTitle"] for row in self.images]
        self.assertEqual(len(titles), len(set(titles)))
        for place_id, (state, _) in self.decisions.items():
            if state == "acquired":
                roles = [row.get("role") for row in self.by_place[place_id]]
                self.assertEqual(roles[0], "identity", place_id)
                self.assertEqual(roles[1], "experience", place_id)
                self.assertNotIn("identity", roles[1:], place_id)

    def test_grade_s_experience_coverage_matches_decisions(self):
        s_ids = {row["placeId"] for row in self.baseline["gradeSRows"]}
        covered_experience = {row["placeId"] for row in self.images if row.get("role") == "experience" and row["placeId"] in s_ids}
        baseline_covered = {
            row["placeId"] for row in self.baseline["gradeSRows"]
            if any(photo["role"] == "experience" for photo in row["photos"])
        }
        self.assertEqual(baseline_covered, {row["placeId"] for row in self.baseline["gradeSRows"] if not row["needsExperience"]})
        self.assertEqual(covered_experience, baseline_covered | self.expected_acquired)

    def test_a_b_coverage_and_exceptions_are_unchanged(self):
        current_covered = {row["placeId"] for row in self.images}
        for grade in ("A", "B"):
            grade_places = [place for place in self.places if place["grade"] == grade]
            uncovered = sorted(place["id"] for place in grade_places if place["id"] not in current_covered)
            baseline_coverage = self.baseline["gradeCoverage"][grade]
            self.assertEqual((len(grade_places), len(grade_places) - len(uncovered)), (baseline_coverage["total"], baseline_coverage["covered"]))
            self.assertEqual(uncovered, baseline_coverage["uncovered"])
        self.assertEqual(self.baseline["gradeCoverage"]["A"], {
            "total": 147,
            "covered": 139,
            "uncovered": ["JP-050", "JP-079", "JP-095", "JP-120", "JP-121", "JP-168", "JP-195", "JP-202"],
        })
        self.assertEqual(self.baseline["gradeCoverage"]["B"], {
            "total": 25,
            "covered": 23,
            "uncovered": ["JP-041", "JP-171"],
        })
        added_ids = {row["placeId"] for row in self.new_images}
        self.assertTrue(all(next(place for place in self.places if place["id"] == pid)["grade"] == "S" for pid in added_ids))

    def test_list_identity_budgets_remain_under_contract(self):
        hubs = {place["id"]: place["hub"] for place in self.places}
        totals = {}
        for row in self.images:
            if row.get("role") != "identity":
                continue
            path = ASSETS / validator.derivative_path_for(row["assetPath"], 800)
            totals[hubs[row["placeId"]]] = totals.get(hubs[row["placeId"]], 0) + path.stat().st_size
        self.assertTrue(totals)
        for hub, total in totals.items():
            self.assertLessEqual(total, 3_500_000, f"{hub}: {total} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--through-batch", type=int)
    args, remaining = parser.parse_known_args()
    BATCH_LIMIT = args.through_batch
    sys.argv = [sys.argv[0], *remaining]
    unittest.main(verbosity=2)
