#!/usr/bin/env python3
"""Offline tests for the Phase 4K photography coverage-strategy analysis."""
import hashlib
import importlib.util
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "analyze_phase4k_coverage_strategy",
    ROOT / "scripts" / "analyze-phase4k-coverage-strategy.py",
)
analysis = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(analysis)

PHASE_4K_BASE = "caccf2518f7f9adbf2c6c40a1a7f9ae045764221"

# The exclusion set Phase 4J actually ran with, used to prove the selection policy is
# unchanged by replaying it against the historical baseline.
PHASE_4J_EXCLUDED = {
    "JP-033", "JP-126", "JP-203", "JP-204",
    "JP-050", "JP-195",
    "JP-121", "JP-156", "JP-095", "JP-079", "JP-202",
}
PHASE_4J_BASELINE_SIZE = 85


class LiveStateTests(unittest.TestCase):
    """The figures Issue #112 asserts must be reproducible from canonical data."""

    def setUp(self):
        self.places, self.images = analysis.load_inputs()
        self.state = analysis.coverage_state(self.places, self.images)

    def test_core_counts(self):
        self.assertEqual(self.state["totalPlaces"], 214)
        self.assertEqual(self.state["covered"], 113)
        self.assertEqual(self.state["uncovered"], 101)
        self.assertEqual(self.state["maxPhotosPerPlace"], 1)

    def test_grade_coverage(self):
        self.assertEqual(
            {g: (v["covered"], v["total"]) for g, v in self.state["byGrade"].items()},
            {"S": (28, 32), "A": (77, 147), "B": (8, 25), "C": (0, 6), "D": (0, 4)},
        )

    def test_hub_coverage(self):
        self.assertEqual(
            {h: (v["covered"], v["total"]) for h, v in self.state["byHub"].items()},
            {
                "Fukuoka": (1, 1), "Kioto": (27, 49), "Nagoya": (1, 1),
                "Okinawa": (26, 50), "Osaka": (27, 53), "Sapporo": (3, 3),
                "Tokio": (28, 57),
            },
        )

    def test_eligible_universes(self):
        self.assertEqual(
            self.state["eligibleUniverses"],
            {"A-only": 60, "A+B": 76, "A+B+C+D": 86},
        )

    def test_fifteen_fail_closed_ids_are_all_still_uncovered(self):
        self.assertEqual(self.state["failClosed"]["count"], 15)
        self.assertTrue(self.state["failClosed"]["allUncovered"])
        self.assertEqual(
            set(self.state["failClosed"]["ids"]),
            {
                "JP-033", "JP-126", "JP-203", "JP-204",
                "JP-050", "JP-195",
                "JP-121", "JP-156", "JP-095", "JP-079", "JP-202",
                "JP-120", "JP-211", "JP-041", "JP-168",
            },
        )

    def test_only_two_zero_photo_categories_and_both_are_fail_closed(self):
        zero = self.state["zeroPhotoCategories"]
        self.assertEqual(len(zero), 2)
        members = {
            p["id"] for p in self.places if p["category"] in zero
        }
        self.assertTrue(members.issubset(analysis.CARRIED_FAILED_CLOSED_IDS))


class AssetEvidenceTests(unittest.TestCase):
    def setUp(self):
        _places, images = analysis.load_inputs()
        self.evidence = analysis.asset_evidence(images)

    def test_measured_batch_bytes(self):
        batches = self.evidence["batches"]
        self.assertEqual(
            {k: (v["accepted"], v["bytes"]) for k, v in batches.items()
             if k in analysis.PROJECTION_BATCHES},
            {
                "Phase 4D": (12, 3607446),
                "Phase 4F": (22, 5457240),
                "Phase 4H": (27, 7438738),
                "Phase 4J": (28, 9672140),
            },
        )

    def test_combined_and_weighted_mean(self):
        self.assertEqual(self.evidence["combinedAccepted"], 89)
        self.assertEqual(self.evidence["combinedBytes"], 26175564)
        self.assertAlmostEqual(self.evidence["weightedMeanBytes"], 294107.46, places=2)

    def test_sensitivity_range_uses_observed_batch_means(self):
        self.assertLess(
            self.evidence["minBatchMeanBytes"], self.evidence["weightedMeanBytes"]
        )
        self.assertGreater(
            self.evidence["maxBatchMeanBytes"], self.evidence["weightedMeanBytes"]
        )


class SelectorPolicyTests(unittest.TestCase):
    """The Phase 4K selector keeps the Phase 4I policy; only the exclusion set grows."""

    def setUp(self):
        self.places, self.images = analysis.load_inputs()

    def test_replaying_phase4j_reproduces_its_pinned_fixture_exactly(self):
        baseline = self.images[:PHASE_4J_BASELINE_SIZE]
        generated = analysis.select_batch(
            self.places, baseline, ("A", "B"), 32, excluded=PHASE_4J_EXCLUDED
        )
        pinned = json.loads(
            (ROOT / "data" / "visual" / "a-b-photography-batch.json")
            .read_text(encoding="utf-8")
        )
        self.assertEqual(generated["eligibleCount"], pinned["eligibleCount"])
        self.assertEqual(generated["hubQuotas"], pinned["hubQuotas"])
        self.assertEqual(generated["gradeCounts"], pinned["gradeCounts"])
        self.assertEqual(
            generated["distinctCategoryCount"], pinned["distinctCategoryCount"]
        )
        self.assertEqual(
            [p["placeId"] for p in generated["places"]],
            [p["placeId"] for p in pinned["places"]],
        )

    def test_selection_is_deterministic(self):
        runs = {
            json.dumps(
                analysis.select_batch(self.places, self.images, ("A", "B"), 32),
                sort_keys=True, ensure_ascii=False,
            )
            for _ in range(5)
        }
        self.assertEqual(len(runs), 1)

    def test_hub_quotas_never_exceed_eligible_supply(self):
        covered = {r["placeId"] for r in self.images}
        for grades in analysis.SCOPES.values():
            eligible = analysis.eligible_places(self.places, covered, grades)
            for size in analysis.TRANCHE_SIZES:
                if size > len(eligible):
                    continue
                _hubs, counts, quotas = analysis.allocate_hub_quotas(eligible, size)
                self.assertEqual(sum(quotas.values()), size)
                for hub, quota in quotas.items():
                    self.assertLessEqual(quota, counts[hub])

    def test_covered_and_fail_closed_places_are_never_selected(self):
        covered = {r["placeId"] for r in self.images}
        for grades in analysis.SCOPES.values():
            for size in analysis.TRANCHE_SIZES:
                fixture = analysis.select_batch(self.places, self.images, grades, size)
                ids = {p["placeId"] for p in fixture["places"]}
                self.assertEqual(len(ids), size)
                self.assertFalse(ids & covered)
                self.assertFalse(ids & analysis.CARRIED_FAILED_CLOSED_IDS)


class SuccessorFixtureTests(unittest.TestCase):
    def setUp(self):
        self.places, self.images = analysis.load_inputs()
        self.fixture = json.loads(
            analysis.SUCCESSOR_FIXTURE_PATH.read_text(encoding="utf-8")
        )

    def test_checked_in_fixture_is_exact_selector_output(self):
        generated = analysis.select_batch(
            self.places, self.images,
            analysis.RECOMMENDED_SCOPE, analysis.RECOMMENDED_TRANCHE_SIZE,
        )
        self.assertEqual(self.fixture, generated)

    def test_pinned_fixture_properties(self):
        self.assertEqual(self.fixture["trancheSize"], 32)
        self.assertEqual(self.fixture["gradeScope"], ["A", "B"])
        self.assertEqual(self.fixture["eligibleCount"], 76)
        self.assertEqual(self.fixture["gradeCounts"], {"A": 25, "B": 7})
        self.assertEqual(self.fixture["distinctCategoryCount"], 13)
        self.assertEqual(
            self.fixture["hubQuotas"],
            {"Kioto": 7, "Okinawa": 8, "Osaka": 8, "Tokio": 9},
        )
        self.assertEqual(len(self.fixture["places"]), 32)
        self.assertTrue(
            all(p["intendedImageCount"] == 1 for p in self.fixture["places"])
        )

    def test_fixture_contains_no_c_or_d_grade(self):
        self.assertEqual(
            {p["grade"] for p in self.fixture["places"]}, {"A", "B"}
        )

    def test_fixture_name_does_not_collide_with_acquisition_manifest_glob(self):
        """The Phase 4J baseline guard fails loudly on unregistered *-batch*.json files.

        The Phase 4K design fixture is not an acquisition manifest, so its filename must
        stay outside that glob until a successor actually appends records.
        """
        spec = importlib.util.spec_from_file_location(
            "photography_baseline", ROOT / "scripts" / "photography_baseline.py"
        )
        baseline_support = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(baseline_support)
        discovered = {
            path.name
            for path in baseline_support.VISUAL_DIR.glob(
                baseline_support.BATCH_MANIFEST_GLOB
            )
        }
        self.assertNotIn(analysis.SUCCESSOR_FIXTURE_PATH.name, discovered)
        baseline_support.assert_batch_registry_is_complete()


class DesignOnlyScopeTests(unittest.TestCase):
    """Phase 4K must not change photography, assets, runtime or the dataset."""

    FROZEN = (
        "data/visual/photography-metadata.json",
        "app/src/data/photography-metadata.json",
        "data/places.json",
    )

    def _base_blob(self, path):
        return subprocess.check_output(["git", "show", f"{PHASE_4K_BASE}:{path}"])

    def test_frozen_files_are_byte_identical_to_the_phase_4k_base(self):
        for path in self.FROZEN:
            with self.subTest(path=path):
                current = (ROOT / path).read_bytes()
                self.assertEqual(
                    hashlib.sha256(self._base_blob(path)).hexdigest(),
                    hashlib.sha256(current).hexdigest(),
                )

    def test_canonical_and_app_photography_metadata_stay_in_parity(self):
        self.assertEqual(
            (ROOT / "data/visual/photography-metadata.json").read_bytes(),
            (ROOT / "app/src/data/photography-metadata.json").read_bytes(),
        )

    def test_no_image_asset_changed_since_the_base(self):
        base = subprocess.check_output(
            ["git", "ls-tree", "-r", PHASE_4K_BASE, "app/public/images/places/"]
        ).decode()
        head = subprocess.check_output(
            ["git", "ls-tree", "-r", "HEAD", "app/public/images/places/"]
        ).decode()
        self.assertEqual(base, head)


if __name__ == "__main__":
    unittest.main()
