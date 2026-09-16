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
# Phase 4E selected its 24 targets from a 36-record photography catalog.
PHASE_4E_BASELINE_SIZE = 36
POST_PHASE_4E_MANIFEST_GLOB = "a-grade-photography-batch-*.json"

EXPECTED_QUOTAS = {
    "Kioto": 6,
    "Nagoya": 1,
    "Okinawa": 5,
    "Osaka": 5,
    "Sapporo": 1,
    "Tokio": 6,
}


def load_current_inputs():
    places_doc = json.loads((ROOT / "data" / "places.json").read_text(encoding="utf-8"))
    places = places_doc if isinstance(places_doc, list) else places_doc["places"]
    photography = json.loads(
        (ROOT / "data" / "visual" / "photography-metadata.json").read_text(encoding="utf-8")
    )
    return places, photography["images"]


def post_phase4e_target_ids():
    """Every place ID claimed by an A-grade batch manifest selected after Phase 4E.

    Discovered from the checked-in manifests rather than hard-coded, so each later
    acquisition batch (Phase 4F batch I, Phase 4H batch II, and any successor that
    checks in a manifest under the same naming contract) is removed automatically.
    """
    manifests = sorted((ROOT / "data" / "visual").glob(POST_PHASE_4E_MANIFEST_GLOB))
    if not manifests:
        raise AssertionError(
            "no post-Phase-4E A-grade batch manifest found under "
            f"data/visual/{POST_PHASE_4E_MANIFEST_GLOB}"
        )
    target_ids = set()
    for manifest in manifests:
        doc = json.loads(manifest.read_text(encoding="utf-8"))
        target_ids.update(place["placeId"] for place in doc["places"])
    return target_ids


def load_phase4e_base_inputs():
    """Reconstruct the authorized 36-record Phase 4E photography baseline.

    Phase 4E selected its 24 targets from a 36-record catalog. Every later batch
    appends accepted records to that same live catalog, so replaying an
    "uncovered places" selector against the current catalog would legitimately
    produce a different tranche. The historical baseline must therefore be
    rebuilt before the fixture can be replayed.

    The baseline is derived twice, independently, and the two derivations must
    agree:

    1. *Semantically* -- drop every place ID claimed by a post-Phase-4E batch
       manifest (see ``post_phase4e_target_ids``). Failed-closed targets were
       never acquired, so only accepted records are actually removed.
    2. *Positionally* -- take the leading ``PHASE_4E_BASELINE_SIZE`` records.
       The canonical registry grows append-only, so the Phase 4E era is exactly
       the registry's prefix.

    Requiring both to match means a future batch cannot silently shift this
    fixture onto the wrong baseline: if it appends records without checking in a
    matching manifest, or breaks the append-only ordering, the two derivations
    diverge and this helper fails loudly instead of replaying a different
    catalog. Record *content* is always read live from the canonical registry,
    so source/attribution corrections to those 36 records flow through rather
    than rotting in a frozen copy.

    This is a test fixture boundary, not runtime selection behavior.
    """
    places, current = load_current_inputs()
    post_4e_ids = post_phase4e_target_ids()

    baseline = [record for record in current if record["placeId"] not in post_4e_ids]
    prefix = current[:PHASE_4E_BASELINE_SIZE]

    if len(baseline) != PHASE_4E_BASELINE_SIZE:
        raise AssertionError(
            f"Phase 4E baseline reconstruction expected {PHASE_4E_BASELINE_SIZE} "
            f"records, found {len(baseline)}"
        )
    if [r["placeId"] for r in baseline] != [r["placeId"] for r in prefix]:
        raise AssertionError(
            "Phase 4E baseline reconstruction disagrees with the append-only "
            "registry prefix; a later batch changed record ordering or is "
            "missing its checked-in manifest"
        )
    leaked = sorted(post_4e_ids.intersection(r["placeId"] for r in baseline))
    if leaked:
        raise AssertionError(
            f"post-Phase-4E targets leaked into the Phase 4E baseline: {leaked}"
        )
    return places, baseline


class RealSelectorFixtureTests(unittest.TestCase):
    def test_exact_phase4e_fixture_is_reproduced(self):
        places, photography = load_phase4e_base_inputs()
        result = selector.select_batch(places, photography)
        self.assertEqual([p["placeId"] for p in result["places"]], EXPECTED_IDS)
        self.assertEqual(result["eligibleCount"], 139)
        self.assertEqual(result["hubQuotas"], EXPECTED_QUOTAS)
        self.assertEqual(result["distinctCategoryCount"], 24)

    def test_checked_in_manifest_is_exact_selector_output(self):
        places, photography = load_phase4e_base_inputs()
        generated = selector.select_batch(places, photography)
        checked_in = json.loads(
            (ROOT / "data" / "visual" / "a-grade-photography-batch-i.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(checked_in, generated)

    def test_design_comparison_category_breadth_reproduces(self):
        places, photography = load_phase4e_base_inputs()
        expected = {16: 16, 24: 24, 32: 26}
        for size, breadth in expected.items():
            with self.subTest(size=size):
                result = selector.select_batch(places, photography, tranche_size=size)
                self.assertEqual(result["distinctCategoryCount"], breadth)

    def test_all_targets_are_a_grade_uncovered_and_unique(self):
        places, photography = load_phase4e_base_inputs()
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
        places, photography = load_phase4e_base_inputs()
        result = selector.select_batch(places, photography)
        by_id = {p["placeId"]: p for p in result["places"]}
        self.assertTrue(by_id["JP-206"]["temporalRisk"])
        self.assertFalse(by_id["JP-050"]["temporalRisk"])

    def test_current_phase4f_records_are_only_authorized_targets(self):
        _places, current = load_current_inputs()
        expected = set(EXPECTED_IDS)
        current_target_ids = {record["placeId"] for record in current if record["placeId"] in expected}
        self.assertTrue(current_target_ids.issubset(expected))
        self.assertNotIn("JP-195", current_target_ids)
        self.assertNotIn("JP-050", current_target_ids)


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
