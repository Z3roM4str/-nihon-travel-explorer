#!/usr/bin/env python3
"""Offline tests for the Phase 4J deterministic A+B photography selector."""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "select_ab_photography_batch",
    ROOT / "scripts" / "select-ab-photography-batch.py",
)
selector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(selector)

PHASE4I_BASE_IMAGE_COUNT = 85

EXPECTED_IDS = [
    "JP-214", "JP-100", "JP-163", "JP-123", "JP-013", "JP-073", "JP-183", "JP-120",
    "JP-022", "JP-055", "JP-194", "JP-211", "JP-014", "JP-059", "JP-189", "JP-124",
    "JP-041", "JP-078", "JP-165", "JP-117", "JP-043", "JP-060", "JP-168", "JP-138",
    "JP-006", "JP-081", "JP-198", "JP-105", "JP-039", "JP-212", "JP-011", "JP-047",
]
EXPECTED_QUOTAS = {
    "Fukuoka": 1,
    "Kioto": 7,
    "Okinawa": 7,
    "Osaka": 8,
    "Tokio": 9,
}
EXPECTED_ELIGIBLE_COUNTS = {
    "Fukuoka": 1,
    "Kioto": 24,
    "Okinawa": 25,
    "Osaka": 27,
    "Tokio": 31,
}
EXPECTED_GRADE_COUNTS = {"A": 23, "B": 9}
EXPECTED_FAILED = {
    "JP-033", "JP-126", "JP-203", "JP-204",
    "JP-050", "JP-195",
    "JP-121", "JP-156", "JP-095", "JP-079", "JP-202",
}


BASELINE_SPEC = importlib.util.spec_from_file_location(
    "photography_baseline", ROOT / "scripts" / "photography_baseline.py"
)
photography_baseline = importlib.util.module_from_spec(BASELINE_SPEC)
BASELINE_SPEC.loader.exec_module(photography_baseline)


def load_current_inputs():
    places_doc = json.loads((ROOT / "data" / "places.json").read_text(encoding="utf-8"))
    places = places_doc if isinstance(places_doc, list) else places_doc["places"]
    photography = json.loads(
        (ROOT / "data" / "visual" / "photography-metadata.json").read_text(encoding="utf-8")
    )
    return places, photography["images"]


def load_phase4i_base_inputs():
    """Replay Phase 4I membership from the append-only 85-record registry prefix.

    Record content is intentionally read live rather than frozen, so later attribution
    corrections to pre-Phase-4J records flow through. Phase 4J and future acquisition
    batches may append records, but must not insert into or reorder this prefix.
    """
    places, current = load_current_inputs()
    # Block 22 inserts its records next to their place (B6.5 gallery order) instead of
    # appending them; set aside, the registry is append-only again. Same rule, same source of
    # truth as every other historical replay (`photography_baseline.py`).
    b22_titles = photography_baseline.b22_acquired_titles()
    current = [record for record in current if record["originalTitle"] not in b22_titles]
    if len(current) < PHASE4I_BASE_IMAGE_COUNT:
        raise AssertionError(
            "photography registry shrank below the Phase 4I 85-record baseline"
        )

    baseline = current[:PHASE4I_BASE_IMAGE_COUNT]
    baseline_ids = [record["placeId"] for record in baseline]
    if len(baseline_ids) != len(set(baseline_ids)):
        raise AssertionError("duplicate placeId inside Phase 4I baseline prefix")
    overlap = set(EXPECTED_IDS).intersection(baseline_ids)
    if overlap:
        raise AssertionError(
            "Phase 4J target inserted into Phase 4I baseline prefix: "
            + ", ".join(sorted(overlap))
        )
    return places, baseline


class RealSelectorFixtureTests(unittest.TestCase):
    def test_exact_phase4i_fixture_is_reproduced(self):
        places, photography = load_phase4i_base_inputs()
        result = selector.select_batch(places, photography)
        self.assertEqual([p["placeId"] for p in result["places"]], EXPECTED_IDS)
        self.assertEqual(result["eligibleCount"], 108)
        self.assertEqual(result["hubEligibleCounts"], EXPECTED_ELIGIBLE_COUNTS)
        self.assertEqual(result["hubQuotas"], EXPECTED_QUOTAS)
        self.assertEqual(result["gradeCounts"], EXPECTED_GRADE_COUNTS)
        self.assertEqual(result["distinctCategoryCount"], 19)

    def test_checked_in_manifest_is_exact_selector_output(self):
        places, photography = load_phase4i_base_inputs()
        generated = selector.select_batch(places, photography)
        checked_in = json.loads(
            (ROOT / "data" / "visual" / "a-b-photography-batch.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(checked_in, generated)

    def test_all_targets_are_ab_uncovered_unique_and_not_failed(self):
        places, photography = load_phase4i_base_inputs()
        by_id = {p["id"]: p for p in places}
        covered = {r["placeId"] for r in photography}
        result = selector.select_batch(places, photography)
        ids = [p["placeId"] for p in result["places"]]

        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(EXPECTED_FAILED.isdisjoint(ids))
        for place_id in ids:
            self.assertIn(by_id[place_id]["grade"], {"A", "B"})
            self.assertNotIn(place_id, covered)

    def test_carried_fail_closed_ids_never_reenter(self):
        places, photography = load_phase4i_base_inputs()
        eligible = {p["id"] for p in selector.eligible_places(places, photography)}
        self.assertTrue(EXPECTED_FAILED.isdisjoint(eligible))

    def test_temporal_risk_flags_are_exact(self):
        places, photography = load_phase4i_base_inputs()
        result = selector.select_batch(places, photography)
        temporal = {p["placeId"] for p in result["places"] if p["temporalRisk"]}
        self.assertEqual(temporal, {"JP-211", "JP-212"})

    def test_fixture_contains_fukuoka_and_architecture_b_targets(self):
        places, photography = load_phase4i_base_inputs()
        result = selector.select_batch(places, photography)
        selected = {p["placeId"]: p for p in result["places"]}
        self.assertEqual(selected["JP-214"]["hub"], "Fukuoka")
        self.assertEqual(selected["JP-214"]["grade"], "B")
        self.assertEqual(selected["JP-123"]["category"], "🏛️ Arquitectura")
        self.assertEqual(selected["JP-138"]["category"], "🏛️ Arquitectura")
        self.assertEqual(selected["JP-123"]["grade"], "B")
        self.assertEqual(selected["JP-138"]["grade"], "B")

    def test_baseline_prefix_survives_future_appends(self):
        places, photography = load_phase4i_base_inputs()
        synthetic_append = photography + [
            {
                "placeId": "SYNTHETIC-FUTURE",
                "credit": "test-only",
            }
        ]
        # Selector output depends on the Phase 4I baseline membership, not on data appended later.
        result = selector.select_batch(places, synthetic_append[:PHASE4I_BASE_IMAGE_COUNT])
        self.assertEqual([p["placeId"] for p in result["places"]], EXPECTED_IDS)


class SelectorPureRuleTests(unittest.TestCase):
    def test_category_tranche_representation_is_first_priority(self):
        places = [
            {"id": "JP-001", "hub": "A", "name": "One", "category": "Common", "grade": "A"},
            {"id": "JP-002", "hub": "A", "name": "Two", "category": "Rare", "grade": "B"},
            {"id": "JP-003", "hub": "B", "name": "Three", "category": "Common", "grade": "A"},
            {"id": "JP-004", "hub": "B", "name": "Four", "category": "Other", "grade": "A"},
        ]
        result = selector.select_batch(places, [], tranche_size=3)
        ids = [p["placeId"] for p in result["places"]]
        self.assertEqual(ids, ["JP-001", "JP-004", "JP-002"])

    def test_existing_category_coverage_precedes_grade(self):
        places = [
            {"id": "JP-001", "hub": "A", "name": "A covered cat", "category": "Covered", "grade": "A"},
            {"id": "JP-002", "hub": "A", "name": "B empty cat", "category": "Empty", "grade": "B"},
            {"id": "JP-003", "hub": "B", "name": "Anchor", "category": "Anchor", "grade": "A"},
            {"id": "JP-010", "hub": "Z", "name": "Covered photo", "category": "Covered", "grade": "A"},
        ]
        photography = [{"placeId": "JP-010"}]
        result = selector.select_batch(places, photography, tranche_size=2)
        self.assertEqual(result["places"][0]["placeId"], "JP-002")

    def test_grade_a_precedes_b_when_coverage_keys_tie(self):
        places = [
            {"id": "JP-001", "hub": "A", "name": "B", "category": "Same", "grade": "B"},
            {"id": "JP-002", "hub": "A", "name": "A", "category": "Same", "grade": "A"},
            {"id": "JP-003", "hub": "B", "name": "Anchor", "category": "Other", "grade": "A"},
        ]
        result = selector.select_batch(places, [], tranche_size=2)
        self.assertEqual(result["places"][0]["placeId"], "JP-002")

    def test_non_temporal_precedes_temporal_after_grade_tie(self):
        places = [
            {"id": "JP-001", "hub": "A", "name": "Festival One", "category": "Cat", "grade": "A"},
            {"id": "JP-002", "hub": "A", "name": "Ordinary", "category": "Cat", "grade": "A"},
            {"id": "JP-003", "hub": "B", "name": "Anchor", "category": "Other", "grade": "A"},
        ]
        result = selector.select_batch(places, [], tranche_size=2)
        self.assertEqual(result["places"][0]["placeId"], "JP-002")

    def test_rarer_eligible_category_precedes_common_after_prior_keys_tie(self):
        places = [
            {"id": "JP-001", "hub": "A", "name": "Rare", "category": "Rare", "grade": "A"},
            {"id": "JP-002", "hub": "A", "name": "Common A", "category": "Common", "grade": "A"},
            {"id": "JP-003", "hub": "B", "name": "Common B", "category": "Common", "grade": "A"},
            {"id": "JP-004", "hub": "B", "name": "Other", "category": "Other", "grade": "A"},
        ]
        result = selector.select_batch(places, [], tranche_size=2)
        self.assertEqual(result["places"][0]["placeId"], "JP-001")

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
