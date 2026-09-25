#!/usr/bin/env python3
"""B6.6 certification gate for data-derived C/D identity coverage."""
import hashlib
import importlib.util
import json
import sys
import unittest
from pathlib import Path
from urllib.parse import unquote

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "data/visual/block22-b6-6-baseline.json"
PLAN = ROOT / "data/visual/block22-b6-6-acquisition-plan.json"
PLACES = ROOT / "data/places.json"
METADATA = ROOT / "data/visual/photography-metadata.json"
APP_METADATA = ROOT / "app/src/data/photography-metadata.json"
ASSETS = ROOT / "app/public"
PLACE_IMAGES = ROOT / "app/src/data/place-images.ts"
BASE_SHA = "f74281a75cefe5f45469e1db84e5d4350110dba5"
UNRESOLVED = {
    "UNRESOLVED — LICENSE", "UNRESOLVED — COPYRIGHTED SUBJECT", "UNRESOLVED — RESOLUTION",
    "UNRESOLVED — NO REPRESENTATIVE IMAGE", "UNRESOLVED — LOCATION UNVERIFIABLE", "UNRESOLVED — NO MATERIAL FOUND",
}
ROLES = {"identity", "experience", "detail", "context", "seasonal"}
EXPERIENCE_ROLES = {"experience"}
COMPLEMENTARY = {"detail", "context", "seasonal"}
ROLE_ORDER = {"identity": 0, "experience": 1, "detail": 2, "context": 2, "seasonal": 3}

validator_spec = importlib.util.spec_from_file_location("photography_validator", ROOT / "scripts/validate-photography.py")
validator = importlib.util.module_from_spec(validator_spec)
validator_spec.loader.exec_module(validator)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha_bytes(payload):
    return hashlib.sha256(payload).hexdigest()


def sha_file(path):
    return sha_bytes(path.read_bytes())


def record_sha(record):
    payload = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha_bytes(payload)


def snapshot():
    baseline, plan, places, metadata = load(BASELINE), load(PLAN), load(PLACES), load(METADATA)
    rows = baseline["gradeRows"]
    targets = {row["placeId"] for row in rows if row["needsIdentity"]}
    entries = {row["placeId"]: row for row in plan["entries"]}
    unresolved = {row["placeId"]: row for row in plan["unresolved"]}
    by_place = {}
    for record in metadata["images"]:
        by_place.setdefault(record["placeId"], []).append(record)
    accepted_titles = {row["title"] for row in plan["entries"]}
    initial_paths = {row["assetPath"] for row in baseline["recordSnapshot"]}
    new_records = [row for row in metadata["images"] if row["assetPath"] not in initial_paths]
    return baseline, plan, places, metadata, rows, targets, entries, unresolved, by_place, accepted_titles, new_records


def build_tests():
    state = snapshot()
    (baseline, plan, places, metadata, rows, targets, entries, unresolved, by_place,
     accepted_titles, new_records) = state

    class B66PhotographyTests(unittest.TestCase):
        def test_base_gate_and_dynamic_cd_matrix(self):
            self.assertEqual(baseline["baseSha"], BASE_SHA)
            self.assertEqual((baseline["imageCount"], baseline["coveredPlaceCount"]), (225, 194))
            self.assertEqual((baseline["gradeS"]["total"], baseline["gradeS"]["identity"], baseline["gradeS"]["experience"], baseline["gradeS"]["complementary"]), (32, 32, 17, 14))
            self.assertEqual((baseline["gradeCoverage"]["A"]["covered"], len(baseline["gradeABExceptions"]["A"])), (139, 8))
            self.assertEqual((baseline["gradeCoverage"]["B"]["covered"], len(baseline["gradeABExceptions"]["B"])), (23, 2))
            current_cd = {place["id"]: place for place in places if place.get("grade") in {"C", "D"}}
            self.assertEqual({row["placeId"] for row in rows}, set(current_cd))
            for row in rows:
                place = current_cd[row["placeId"]]
                self.assertEqual((row["name"], row["grade"], row["hub"]), (place["name"], place["grade"], place["hub"]))
                self.assertEqual(row["needsIdentity"], not row["photos"])
            for grade in ("C", "D"):
                coverage = baseline["gradeCoverage"][grade]
                self.assertEqual(coverage["total"], sum(row["grade"] == grade for row in rows))
                self.assertEqual(coverage["covered"], sum(row["grade"] == grade and bool(row["photos"]) for row in rows))
                self.assertEqual(set(coverage["uncovered"]), {row["placeId"] for row in rows if row["grade"] == grade and row["needsIdentity"]})

        def test_targets_are_derived_and_partitioned_exactly(self):
            decisions = list(entries) + list(unresolved)
            self.assertEqual(len(decisions), len(set(decisions)))
            self.assertEqual(set(decisions), targets)
            self.assertEqual(set(entries) & set(unresolved), set())
            for place_id, entry in entries.items():
                self.assertEqual(entry.get("role"), "identity", place_id)
                self.assertTrue(entry.get("whyIdentity"), place_id)
                self.assertTrue(entry.get("visualReview"), place_id)
                self.assertTrue(entry.get("subjectRightsReview"), place_id)
                self.assertTrue(entry.get("sourcePage"), place_id)
                self.assertGreaterEqual(len(entry.get("candidatesRejected", [])), 1, place_id)
            for place_id, item in unresolved.items():
                self.assertIn(item.get("category"), UNRESOLVED, place_id)
                self.assertTrue(item.get("reason"), place_id)
                self.assertGreaterEqual(len(item.get("searchSources", [])), 2, place_id)
                self.assertGreaterEqual(len(item.get("candidatesRejected", [])), 2, place_id)

        def test_only_planned_identity_records_were_added(self):
            expected_titles = {row["title"] for row in entries.values()}
            self.assertEqual({row.get("originalTitle") for row in new_records}, expected_titles)
            self.assertEqual(len(new_records), len(expected_titles))
            for place_id, entry in entries.items():
                self.assertIn(place_id, targets)
                matches = [row for row in by_place.get(place_id, []) if row.get("originalTitle") == entry["title"]]
                self.assertEqual(len(matches), 1, place_id)
                record = matches[0]
                self.assertEqual(record.get("role"), "identity", place_id)
                self.assertEqual(record.get("alt"), entry["alt"], place_id)
                self.assertEqual(unquote(record.get("sourceUrl", "")), entry["sourcePage"], place_id)
                self.assertTrue(record.get("sourceUrl", "").startswith("https://commons.wikimedia.org/wiki/"), place_id)
                self.assertEqual(len([item for item in by_place[place_id]]), 1, place_id)
            for place_id in unresolved:
                self.assertFalse(any(row in new_records for row in by_place.get(place_id, [])), place_id)
            self.assertFalse(any(row.get("role") != "identity" for row in new_records))
            self.assertFalse(any(row.get("role") in EXPERIENCE_ROLES | COMPLEMENTARY for row in new_records))

        def test_prior_records_and_roles_are_unchanged(self):
            current_by_path = {row["assetPath"]: row for row in metadata["images"]}
            for prior in baseline["recordSnapshot"]:
                record = current_by_path.get(prior["assetPath"])
                self.assertIsNotNone(record, prior["assetPath"])
                self.assertEqual((record["placeId"], record["originalTitle"], record.get("role")),
                                 (prior["placeId"], prior["originalTitle"], prior.get("role")), prior["assetPath"])
                self.assertEqual(record_sha(record), prior["recordSha256"], prior["assetPath"])
                self.assertEqual(sha_file(ASSETS / prior["assetPath"]), prior["assetSha256"], prior["assetPath"])

        def test_asset_license_dimensions_lqip_and_derivatives(self):
            self.assertEqual(metadata.get("imageCount"), len(metadata["images"]))
            self.assertEqual(METADATA.read_bytes(), APP_METADATA.read_bytes())
            self.assertEqual(validator.validate_unique_asset_bytes(metadata, ASSETS), [])
            titles = [row.get("originalTitle") for row in metadata["images"]]
            self.assertEqual(len(titles), len(set(titles)))
            source_urls = [row.get("acquisitionUrl") for row in metadata["images"]]
            self.assertEqual(len(source_urls), len(set(source_urls)))
            place_sources = [(row.get("placeId"), row.get("originalTitle")) for row in metadata["images"]]
            self.assertEqual(len(place_sources), len(set(place_sources)))
            for entry in entries.values():
                record = next(row for row in new_records if row["originalTitle"] == entry["title"])
                self.assertIn(record.get("role"), ROLES)
                self.assertIn(record.get("license"), validator.SUPPORTED_LICENSES)
                self.assertTrue(record.get("credit") or record["license"] == "CC0")
                self.assertTrue(record.get("licenseUrl"))
                for field in ("assetPath", "source", "sourceUrl", "acquisitionUrl", "acquisitionDate", "originalWidth", "originalHeight", "processing", "lqip"):
                    self.assertTrue(record.get(field), f"{record['placeId']}: {field}")
                self.assertTrue(validator.valid_lqip(record["lqip"]), record["placeId"])
                original = ASSETS / record["assetPath"]
                self.assertTrue(original.is_file(), record["placeId"])
                with Image.open(original) as image:
                    image.load()
                    width, height = image.size
                    self.assertLessEqual(max(width, height), 1600, record["placeId"])
                    self.assertLessEqual(width, record["originalWidth"], record["placeId"])
                    self.assertLessEqual(height, record["originalHeight"], record["placeId"])
                for rendition_width in (400, 800):
                    rendition = ASSETS / validator.derivative_path_for(record["assetPath"], rendition_width)
                    self.assertTrue(rendition.is_file(), f"{record['placeId']}: {rendition_width}w")
                    with Image.open(rendition) as image:
                        image.load()
                        self.assertEqual(image.width, min(rendition_width, width), record["placeId"])

        def test_coverage_and_grade_invariants(self):
            self.assertEqual(len(metadata["images"]), baseline["imageCount"] + len(entries))
            self.assertEqual(len({row["placeId"] for row in metadata["images"]}), baseline["coveredPlaceCount"] + len(entries))
            current_covered = {row["placeId"] for row in metadata["images"]}
            grade_ids = {grade: {place["id"] for place in places if place.get("grade") == grade} for grade in ("S", "A", "B", "C", "D")}
            for grade in ("S", "A", "B", "C", "D"):
                initial = baseline["gradeCoverage"][grade]
                self.assertEqual(len(grade_ids[grade]), initial["total"], grade)
                expected = initial["covered"] + sum(entries[pid] is not None for pid in entries if pid in grade_ids[grade])
                self.assertEqual(len(grade_ids[grade] & current_covered), expected, grade)
            new_s_roles = {role: set() for role in ("identity", "experience", *COMPLEMENTARY)}
            for record in metadata["images"]:
                if record["placeId"] in grade_ids["S"]:
                    new_s_roles.setdefault(record.get("role"), set()).add(record["placeId"])
            for role, members in baseline["gradeS"]["roles"].items():
                self.assertEqual(sorted(new_s_roles.get(role, set())), members, role)
            self.assertEqual((len(new_s_roles["identity"]), len(new_s_roles["experience"]), len(set().union(*(new_s_roles[r] for r in COMPLEMENTARY)))),
                             (baseline["gradeS"]["identity"], baseline["gradeS"]["experience"], baseline["gradeS"]["complementary"]))
            for grade in ("A", "B"):
                self.assertEqual(sorted(grade_ids[grade] - current_covered), baseline["gradeABExceptions"][grade], grade)

        def test_hub_budgets_and_place_images_map(self):
            self.assertEqual(sha_file(PLACE_IMAGES), baseline["placeImagesTsSha256"])
            covered_hubs = {}
            place_hub = {place["id"]: place["hub"] for place in places}
            for record in metadata["images"]:
                if record.get("role") != "identity":
                    continue
                hub = place_hub[record["placeId"]]
                path = ASSETS / validator.derivative_path_for(record["assetPath"], 800)
                covered_hubs[hub] = covered_hubs.get(hub, 0) + path.stat().st_size
            self.assertEqual(set(covered_hubs), set(baseline["hubIdentity800Bytes"]))
            for hub, byte_count in covered_hubs.items():
                self.assertLessEqual(byte_count, 3_500_000, f"{hub}: {byte_count} B")

    return B66PhotographyTests


def main():
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(build_tests())
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    baseline, plan, places, metadata, rows, targets, entries, unresolved, *_ = snapshot()
    current_ids = {row["placeId"] for row in metadata["images"]}
    by_grade = {grade: (sum(row["grade"] == grade for row in rows), sum(row["grade"] == grade and row["needsIdentity"] for row in rows)) for grade in ("C", "D")}
    covered_after = {grade: sum(row["grade"] == grade and row["placeId"] in current_ids for row in rows) for grade in ("C", "D")}
    print(f"OK: C={by_grade['C'][0]} total; coverage {by_grade['C'][0]-by_grade['C'][1]} a {covered_after['C']}; D={by_grade['D'][0]} total; coverage {by_grade['D'][0]-by_grade['D'][1]} a {covered_after['D']}; targets={len(targets)}; acquired={len(entries)}; unresolved={len(unresolved)}; registry={len(metadata['images'])} images/{len(current_ids)} places; S identity={baseline['gradeS']['identity']}/32; experience={baseline['gradeS']['experience']}/32; complementary={baseline['gradeS']['complementary']}/32; A=139/147; B=23/25")


if __name__ == "__main__":
    main()
