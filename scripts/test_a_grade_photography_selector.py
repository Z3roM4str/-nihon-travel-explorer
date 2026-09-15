#!/usr/bin/env python3
"""Offline tests for the Phase 4F deterministic A-grade photography selector."""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "select_a_grade_photography_batch",
    ROOT / "scripts" / "select-a-grade-photography-batch.py",
)
selector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(selector)

EXPECTED_IDS = [
    "JP-068", "JP-210", "JP-155", "JP-103", "JP-206", "JP-009",
    "JP-099", "JP-195", "JP-108", "JP-018", "JP-085", "JP-164",
    "JP-115", "JP-037", "JP-093", "JP-160", "JP-141", "JP-040",
    "JP-102", "JP-174", "JP-116", "JP-050", "JP-092", "JP-005",
]
EXPECTED_QUOTAS = {
    "Kioto": 6,
    "Nagoya": 1,
    "Okinawa": 5,
    "Osaka": 5,
    "Sapporo": 1,
    "Tokio": 6,
}


def load_real_inputs():
    places_doc = json.loads((ROOT / "data" / "places.json").read_text(encoding="utf-8"))
    places = places_doc if isinstance(places_doc, list) else places_doc["places"]
    photography = json.loads(
        (ROOT / "data" / "visual" / "photography-metadata.json").read_text(encoding="utf-8")
    )
    return places, photography["images"]


class RealSelectorFixtureTests(unittest.TestCase):
    def test_exact_phase4e_fixture_is_reproduced(self):
        places, photography = load_real_inputs()
        result = selector.select_batch(places, photography)
        self.assertEqual([p["placeId"] for p in result["places"]], EXPECTED_IDS)
        self.assertEqual(result["eligibleCount"], 139)
        self.assertEqual(result["hubQuotas"], EXPECTED_QUOTAS)
        self.assertEqual(result["distinctCategoryCount"], 24)

    def test_checked_in_manifest_is_exact_selector_output(self):
        places, photography = load_real_inputs()
        generated = selector.select_batch(places, photography)
        checked_in = json.loads(
            (ROOT / "data" / "visual" / "a-grade-photography-batch-i.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(checked_in, generated)

    def test_design_comparison_category_breadth_reproduces(self):
        places, photography = load_real_inputs()
        expected = {16: 16, 24: 24, 32: 26}
        for size, breadth in expected.items():
            with self.subTest(size=size):
                result = selector.select_batch(places, photography, tranche_size=size)
                self.assertEqual(result["distinctCategoryCount"], breadth)

    def test_all_targets_are_a_grade_uncovered_and_unique(self):
        places, photography = load_real_inputs()
        by_id = {p["id"]: p for p in places}
        covered = {r["placeId"] for r in photography}
        result = selector.select_batch(places, photography)
        ids = [p["placeId"] for p in result["places"]]
        self.assertEqual(len(ids), len(set(ids)))
        for place_id in ids:
            self.assertEqual(by_id[place_id]["grade"], "A")
            self.assertNotIn(place_id, covered)
            self.assertNotIn(place_id, selector.CARRIED_FAILED_CLOSED_IDS)

    def test_temporal_risk_is_delayed_but_not_excluded(self):
        places, photography = load_real_inputs()
        result = selector.select_batch(places, photography)
        by_id = {p["placeId"]: p for p in result["places"]}
        self.assertTrue(by_id["JP-206"]["temporalRisk"])
        self.assertFalse(by_id["JP-050"]["temporalRisk"])


class SelectorPureRuleTests(unittest.TestCase):
    def test_binary_tie_break_is_stable(self):
        places = [
            {"id": "JP-001", "hub": "A", "name": "One", "category": "Cat X", "grade": "A"},
            {"id": "JP-002", "hub": "A", "name": "Two", "category": "Cat X", "grade": "A"},
            {"id": "JP-003", "hub": "B", "name": "Three", "category": "Cat Y", "grade": "A"},
            {"id": "JP-004", "hub": "B", "name": "Four", "category": "Cat Y", "grade": "A"},
        ]
        result = selector.select_batch(places, [], tranche_size=2)
        self.assertEqual([p["placeId"] for p in result["places"]], ["JP-001", "JP-003"])

    def test_covered_place_is_ineligible(self):
        places = [
            {"id": "JP-001", "hub": "A", "name": "One", "category": "Cat X", "grade": "A"},
            {"id": "JP-002", "hub": "A", "name": "Two", "category": "Cat Y", "grade": "A"},
        ]
        result = selector.select_batch(places, [{"placeId": "JP-001"}], tranche_size=1)
        self.assertEqual([p["placeId"] for p in result["places"]], ["JP-002"])


if __name__ == "__main__":
    unittest.main()
