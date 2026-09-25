#!/usr/bin/env python3
"""B6.5 gate: data-derived Grade-S targets, third-photo roles and preserved contracts."""
import argparse
import hashlib
import importlib.util
import json
import sys
import unittest
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "data/visual/block22-b6-5-baseline.json"
PLAN = ROOT / "data/visual/block22-b6-5-acquisition-plan.json"
PLACES = ROOT / "data/places.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
APP_METADATA = ROOT / "app/src/data/photography-metadata.json"
ASSETS = ROOT / "app/public"
BASE_SHA = "3ebe7aee70d8046448f10749984d5829b7a4f2cc"
COMPLEMENTARY = {"detail", "context", "seasonal"}
EXPERIENCE_EXCEPTIONS = {
    "JP-021", "JP-033", "JP-044", "JP-077", "JP-089", "JP-097", "JP-126", "JP-134",
    "JP-152", "JP-179", "JP-188", "JP-192", "JP-197", "JP-203", "JP-204",
}

sys.path.insert(0, str(ROOT / "scripts"))
validator_spec = importlib.util.spec_from_file_location("photography_validator", ROOT / "scripts/validate-photography.py")
validator = importlib.util.module_from_spec(validator_spec)
validator_spec.loader.exec_module(validator)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def derived_batches(baseline, batch_size):
    targets = [row["placeId"] for row in baseline["gradeSRows"] if row["needsB65"]]
    return [targets[index:index + batch_size] for index in range(0, len(targets), batch_size)]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def role_order(role):
    return {"identity": 0, "experience": 1, "detail": 2, "context": 2, "seasonal": 3}.get(role, 9)


def make_suite(through_batch):
    baseline = load(BASELINE)
    plan = load(PLAN)
    places = load(PLACES)
    metadata = load(METADATA)
    images = metadata["images"]
    batches = derived_batches(baseline, plan["batchSize"])
    plan_batches = {row["batch"]: row for row in plan["batches"]}
    expected_targets = {pid for number in range(1, through_batch + 1) for pid in batches[number - 1]}
    decisions = {}
    for number in range(1, through_batch + 1):
        for entry in plan_batches[number].get("entries", []):
            decisions[entry["placeId"]] = ("acquired", entry)
        for row in plan_batches[number].get("unresolved", []):
            decisions[row["placeId"]] = ("unresolved", row)
    expected_entries = [entry for number in range(1, through_batch + 1) for entry in plan_batches[number].get("entries", [])]
    expected_titles = {entry["title"] for entry in expected_entries}
    new_images = [row for row in images if row.get("originalTitle") in expected_titles]
    base_images = [row for row in images if row.get("originalTitle") not in expected_titles]
    by_place = {}
    for row in images:
        by_place.setdefault(row["placeId"], []).append(row)
    return baseline, plan, places, metadata, images, batches, plan_batches, expected_targets, decisions, expected_entries, expected_titles, new_images, base_images, by_place


def build_tests(through_batch):
    state = make_suite(through_batch)
    (baseline, plan, places, metadata, images, batches, plan_batches, expected_targets,
     decisions, expected_entries, expected_titles, new_images, base_images, by_place) = state

    class B65PhotographyTests(unittest.TestCase):
        def test_initial_gate_matrix_and_required_baseline(self):
            self.assertEqual(baseline["baseSha"], BASE_SHA)
            self.assertEqual((baseline["imageCount"], baseline["coveredPlaceCount"]), (215, 194))
            self.assertEqual((baseline["gradeSTotal"], baseline["gradeSCovered"]), (32, 32))
            self.assertEqual(baseline["gradeSWithExperience"], 17)
            self.assertEqual(baseline["gradeSWithComplementary"], 4)
            self.assertEqual(baseline["gradeSNeedsB65"], 28)
            self.assertEqual(len(baseline["gradeSRows"]), 32)
            self.assertEqual(len({row["placeId"] for row in baseline["gradeSRows"]}), 32)
            self.assertEqual(baseline["gradeCoverage"]["A"]["covered"], 139)
            self.assertEqual(len(baseline["gradeCoverage"]["A"]["uncovered"]), 8)
            self.assertEqual(baseline["gradeCoverage"]["B"]["covered"], 23)
            self.assertEqual(len(baseline["gradeCoverage"]["B"]["uncovered"]), 2)
            self.assertEqual(sum(row["identity"] for row in baseline["gradeSRows"]), 32)
            self.assertEqual(sum(row["experience"] for row in baseline["gradeSRows"]), 17)
            self.assertEqual(sum(row["needsB65"] for row in baseline["gradeSRows"]), 28)
            source = (ROOT / "app/src/data/place-images.ts").read_bytes()
            digests = {hashlib.sha256(source).hexdigest(), hashlib.sha256(source.replace(b"\r\n", b"\n")).hexdigest(), hashlib.sha256(source.replace(b"\n", b"\r\n")).hexdigest()}
            self.assertIn(baseline["placeImagesTsSha256"], digests)

        def test_plan_partitions_targets_derived_from_initial_roles(self):
            self.assertEqual(plan["batchSize"], 8)
            self.assertEqual([len(batch) for batch in batches], [8, 8, 8, 4])
            self.assertEqual(sum(map(len, batches)), baseline["gradeSNeedsB65"])
            self.assertEqual(len(plan_batches), len(batches))
            for number in range(1, through_batch + 1):
                row = plan_batches[number]
                planned = row.get("entries", []) + row.get("unresolved", [])
                ids = [item["placeId"] for item in planned]
                self.assertEqual(set(ids), set(batches[number - 1]), f"batch {number}")
                self.assertEqual(len(ids), len(set(ids)), f"batch {number} duplicate place decisions")
                self.assertEqual(len(row.get("entries", [])) + len(row.get("unresolved", [])), len(batches[number - 1]))
                for entry in row.get("entries", []):
                    self.assertIn(entry["role"], COMPLEMENTARY)
                    self.assertTrue(entry.get("whyRole"))
                    self.assertTrue(entry.get("identityComparison"))
                    self.assertTrue(entry.get("sourcePage"))
                    self.assertTrue(entry.get("originalPage"))
                    self.assertGreaterEqual(len(entry.get("candidatesRejected", [])), 2)
                for item in row.get("unresolved", []):
                    self.assertIn(item.get("category"), {
                        "UNRESOLVED — LICENSE", "UNRESOLVED — COPYRIGHTED SUBJECT", "UNRESOLVED — RESOLUTION",
                        "UNRESOLVED — NO COMPLEMENTARY IMAGE", "UNRESOLVED — LOCATION UNVERIFIABLE",
                        "UNRESOLVED — NO MATERIAL FOUND",
                    })
                    self.assertTrue(item.get("reason"))
                    self.assertGreaterEqual(len(item.get("searchSources", [])), 2)
                    self.assertGreaterEqual(len(item.get("candidatesRejected", [])), 2)
            self.assertEqual({entry["role"] for entry in expected_entries} <= COMPLEMENTARY, True)

        def test_initial_identity_and_existing_roles_are_untouched(self):
            baseline_by_id = {row["placeId"]: row for row in baseline["gradeSRows"]}
            for place_id, row in baseline_by_id.items():
                base = [photo for photo in by_place[place_id] if photo in base_images]
                expected = row["photos"]
                self.assertEqual(len(base), len(expected), place_id)
                self.assertEqual([item.get("role") for item in base], [item["role"] for item in expected], place_id)
                for prior in expected:
                    actual = next(item for item in base if item["assetPath"] == prior["assetPath"])
                    self.assertEqual(actual["originalTitle"], prior["originalTitle"], place_id)
                    self.assertEqual(sha(ASSETS / actual["assetPath"]), prior["assetSha256"], place_id)
            self.assertEqual(sum(any(row.get("role") == "identity" for row in by_place[row["placeId"]]) for row in baseline["gradeSRows"]), 32)

        def test_new_records_are_only_planned_complements_and_preserve_exceptions(self):
            expected_by_title = {item["title"]: item for item in expected_entries}
            self.assertEqual({row.get("originalTitle") for row in new_images}, expected_titles)
            self.assertEqual(len(new_images), len(expected_titles))
            for place_id in expected_targets:
                prior = next(row for row in baseline["gradeSRows"] if row["placeId"] == place_id)
                self.assertTrue(prior["needsB65"], place_id)
                new_for_place = [row for row in new_images if row["placeId"] == place_id]
                state_entry = decisions[place_id]
                if state_entry[0] == "unresolved":
                    self.assertEqual(new_for_place, [], place_id)
                    continue
                self.assertEqual(len(new_for_place), 1, place_id)
                record = new_for_place[0]
                entry = state_entry[1]
                self.assertIn(record.get("role"), COMPLEMENTARY)
                self.assertEqual(record.get("role"), entry["role"], place_id)
                self.assertEqual(record.get("alt"), entry["alt"], place_id)
                self.assertEqual(urllib.parse.unquote(record.get("sourceUrl", "")), entry["sourcePage"], place_id)
                self.assertTrue(record.get("originalTitle"), place_id)
            for place_id in EXPERIENCE_EXCEPTIONS:
                records = by_place.get(place_id, [])
                self.assertFalse(any(row.get("role") == "experience" for row in records if row not in base_images), place_id)
                self.assertFalse(any(row.get("role") == "experience" for row in records), f"experience exception resolved in B6.5: {place_id}")
            self.assertFalse(any(row.get("role") == "identity" for row in new_images))
            self.assertFalse(any(row.get("role") == "experience" for row in new_images))

        def test_gallery_order_and_maximum_photo_count(self):
            for place_id, records in by_place.items():
                if place_id not in {row["placeId"] for row in baseline["gradeSRows"]}:
                    continue
                roles = [record.get("role") for record in records]
                self.assertLessEqual(len(records), 3, place_id)
                self.assertEqual(roles, sorted(roles, key=role_order), place_id)
                complementary = [role for role in roles if role in COMPLEMENTARY]
                if place_id in expected_targets and decisions[place_id][0] == "acquired":
                    self.assertLessEqual(len(complementary), 1, place_id)
                    self.assertEqual(complementary, [decisions[place_id][1]["role"]], place_id)
            self.assertFalse(set(expected_titles) & {row.get("originalTitle") for row in base_images})

        def test_asset_contract_licenses_renditions_and_lqip(self):
            self.assertEqual(metadata.get("imageCount"), len(images))
            self.assertEqual(METADATA.read_bytes(), APP_METADATA.read_bytes())
            self.assertEqual(validator.validate_unique_asset_bytes(metadata, ASSETS), [])
            titles = [row.get("originalTitle") for row in images]
            self.assertEqual(len(titles), len(set(titles)))
            asset_paths = [row.get("assetPath") for row in images]
            self.assertEqual(len(asset_paths), len(set(asset_paths)))
            for entry in expected_entries:
                matches = [row for row in new_images if row.get("originalTitle") == entry["title"]]
                self.assertEqual(len(matches), 1)
                record = matches[0]
                self.assertIn(record["license"], validator.SUPPORTED_LICENSES)
                if record["license"] == "Public Domain":
                    self.assertIn(record.get("licenseBasis"), {"PD-self", "PD-USGov"})
                    self.assertNotIn("licenseUrl", record)
                else:
                    self.assertTrue(record.get("licenseUrl"))
                for field in ("assetPath", "source", "sourceUrl", "acquisitionUrl", "acquisitionDate", "originalWidth", "originalHeight", "processing", "lqip"):
                    self.assertTrue(record.get(field), f"{record['placeId']}: {field}")
                self.assertTrue(record.get("credit") or record["license"] == "CC0", record["placeId"])
                self.assertTrue(validator.valid_lqip(record["lqip"]), record["placeId"])
                original = ASSETS / record["assetPath"]
                self.assertTrue(original.is_file(), record["placeId"])
                with Image.open(original) as image:
                    image.load()
                    width, height = image.size
                    self.assertLessEqual(max(width, height), 1600, record["placeId"])
                for derivative_width in (800, 400):
                    derivative = ASSETS / validator.derivative_path_for(record["assetPath"], derivative_width)
                    self.assertTrue(derivative.is_file(), f"{record['placeId']}: {derivative_width}w")
                    with Image.open(derivative) as image:
                        image.load()
                        self.assertEqual(image.width, min(derivative_width, width), record["placeId"])

        def test_global_counts_and_a_b_coverage_are_preserved(self):
            self.assertEqual(len(images), 215 + len(expected_entries))
            self.assertEqual(len({row["placeId"] for row in images}), 194)
            grade = {item["id"]: item["grade"] for item in places}
            by_grade = {value: {pid for pid, current in grade.items() if current == value} for value in ("S", "A", "B")}
            covered = {row["placeId"] for row in images}
            for value, expected_total, expected_covered in (("S", 32, 32), ("A", 147, 139), ("B", 25, 23)):
                self.assertEqual(len(by_grade[value]), expected_total)
                self.assertEqual(len(by_grade[value] & covered), expected_covered)
            self.assertEqual(len([row for row in images if row["placeId"] in by_grade["S"] and row.get("role") == "identity"]), 32)
            self.assertEqual(len([pid for pid in by_grade["S"] if any(row["placeId"] == pid and row.get("role") == "experience" for row in images)]), 17)

    return B65PhotographyTests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--through-batch", type=int, default=None, help="Run gate through this committed batch; default is all planned batches.")
    args = parser.parse_args()
    plan = load(PLAN)
    through_batch = args.through_batch or len(plan["batches"])
    if through_batch < 1 or through_batch > len(plan["batches"]):
        parser.error(f"--through-batch must be in 1..{len(plan['batches'])}")
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(build_tests(through_batch))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    baseline, plan, places, metadata, images, batches, plan_batches, expected_targets, decisions, entries, titles, new_images, base_images, by_place = make_suite(through_batch)
    complement_coverage = sum(any(photo.get("role") in COMPLEMENTARY for photo in photos) for photos in by_place.values() if photos[0]["placeId"] in {row["placeId"] for row in baseline["gradeSRows"]})
    print(f"OK: batch 1..{through_batch}; S=32; identity=32/32; experience=17/32; targets={len(expected_targets)}; acquired={len(entries)}; unresolved={len(expected_targets)-len(entries)}; complementary Grade-S coverage={complement_coverage}/32; registry={len(images)} images / {len({row['placeId'] for row in images})} places; A=139/147; B=23/25")


if __name__ == "__main__":
    main()
