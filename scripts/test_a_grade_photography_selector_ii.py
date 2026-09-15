#!/usr/bin/env python3
"""Offline tests for the Phase 4H deterministic A-grade photography selector."""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "select_a_grade_photography_batch_ii",
    ROOT / "scripts" / "select-a-grade-photography-batch-ii.py",
)
selector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(selector)

EXPECTED_IDS = [
    "JP-101", "JP-156", "JP-121", "JP-207", "JP-028", "JP-070", "JP-161", "JP-111",
    "JP-008", "JP-090", "JP-180", "JP-151", "JP-046", "JP-095", "JP-159", "JP-128",
    "JP-016", "JP-079", "JP-202", "JP-127", "JP-208", "JP-098", "JP-167", "JP-146",
    "JP-026", "JP-061", "JP-182", "JP-118", "JP-049", "JP-058", "JP-181", "JP-015",
]
EXPECTED_QUOTAS = {
    "Kioto": 8,
    "Okinawa": 8,
    "Osaka": 7,
    "Sapporo": 1,
    "Tokio": 8,
}
EXPECTED_FAILED = {"JP-033", "JP-126", "JP-203", "JP-204", "JP-050", "JP-195"}


def load_current_inputs():
    places_doc = json.loads((ROOT / "data" / "places.json").read_text(encoding="utf-8"))
    places = places_doc if isinstance(places_doc, list) else places_doc["places"]
    photography = json.loads(
        (ROOT / "data" / "visual" / "photography-metadata.json").read_text(encoding="utf-8")
    )
    return places, photography["images"]


def load_phase4g_base_inputs():
    """Reconstruct the authorized 58-record Phase 4G base after Phase 4H acquisition."""
    places, current = load_current_inputs()
    expected = set(EXPECTED_IDS)
    baseline = [record for record in current if record["placeId"] not in expected]
    if len(baseline) != 58:
        raise AssertionError(
            f"Phase 4G baseline reconstruction expected 58 records, found {len(baseline)}"
        )
    return places, baseline


class RealSelectorFixtureTests(unittest.TestCase):
    def test_exact_phase4g_fixture_is_reproduced(self):
        places, photography = load_phase4g_base_inputs()
        result = selector.select_batch(places, photography)
        self.assertEqual([p["placeId"] for p in result["places"]], EXPECTED_IDS)
        self.assertEqual(result["eligibleCount"], 115)
        self.assertEqual(result["hubQuotas"], EXPECTED_QUOTAS)
        self.assertEqual(result["distinctCategoryCount"], 19)

    def test_checked_in_manifest_is_exact_selector_output(self):
        places, photography = load_phase4g_base_inputs()
        generated = selector.select_batch(places, photography)
        checked_in = json.loads(
            (ROOT / "data" / "visual" / "a-grade-photography-batch-ii.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(checked_in, generated)

    def test_24_32_40_all_reach_19_eligible_categories(self):
        places, photography = load_phase4g_base_inputs()
        for size in (24, 32, 40):
            with self.subTest(size=size):
                result = selector.select_batch(places, photography, tranche_size=size)
                self.assertEqual(result["distinctCategoryCount"], 19)

    def test_all_targets_are_a_grade_uncovered_and_unique(self):
        places, photography = load_phase4g_base_inputs()
        by_id = {p["id"]: p for p in places}
        covered = {r["placeId"] for r in photography}
        result = selector.select_batch(places, photography)
        ids = [p["placeId"] for p in result["places"]]
        self.assertEqual(len(ids), len(set(ids)))
        for place_id in ids:
            self.assertEqual(by_id[place_id]["grade"], "A")
            self.assertNotIn(place_id, covered)
            self.assertNotIn(place_id, EXPECTED_FAILED)

    def test_carried_fail_closed_ids_never_reenter(self):
        places, photography = load_phase4g_base_inputs()
        eligible = {p["id"] for p in selector.eligible_places(places, photography)}
        self.assertTrue(EXPECTED_FAILED.isdisjoint(eligible))

    def test_temporal_risk_flags_are_exact(self):
        places, photography = load_phase4g_base_inputs()
        result = selector.select_batch(places, photography)
        temporal = {p["placeId"] for p in result["places"] if p["temporalRisk"]}
        self.assertEqual(temporal, {"JP-207", "JP-202", "JP-208"})


class SelectorPureRuleTests(unittest.TestCase):
    def test_category_representation_precedes_temporal_risk(self):
        places = [
            {"id": "JP-001", "hub": "A", "name": "Festival One", "category": "Rare", "grade": "A"},
            {"id": "JP-002", "hub": "A", "name": "Ordinary Two", "category": "Common", "grade": "A"},
            {"id": "JP-003", "hub": "B", "name": "Ordinary Three", "category": "Common", "grade": "A"},
        ]
        result = selector.select_batch(places, [], tranche_size=2)
        self.assertEqual([p["placeId"] for p in result["places"]], ["JP-001", "JP-003"])

    def test_binary_tie_break_is_stable(self):
        places = [
            {"id": "JP-001", "hub": "A", "name": "One", "category": "Cat X", "grade": "A"},
            {"id": "JP-002", "hub": "A", "name": "Two", "category": "Cat X", "grade": "A"},
            {"id": "JP-003", "hub": "B", "name": "Three", "category": "Cat Y", "grade": "A"},
            {"id": "JP-004", "hub": "B", "name": "Four", "category": "Cat Y", "grade": "A"},
        ]
        result = selector.select_batch(places, [], tranche_size=2)
        self.assertEqual([p["placeId"] for p in result["places"]], ["JP-001", "JP-003"])


if __name__ == "__main__":
    unittest.main()
