#!/usr/bin/env python3
"""Offline unit tests for the Phase 3B2H access-point walking revalidation.

Nothing here touches the network: every provider answer is a fixture, and the two tests
that exercise the real CLI entry points assert that they REFUSE to run without an API
key rather than that they run.
"""
import copy
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
REPO = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

import logistics_common as common  # noqa: E402


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pipeline = _load("revalidate_walking_access_points", "revalidate-walking-access-points.py")
validator = _load("validate_walking_access_point_results", "validate-walking-access-point-results.py")

PLACES = common.load_places(REPO / "data")
ACCESS_POINTS = common.load_access_points(REPO / "data")
MANIFEST = common.load_json(REPO / common.REVALIDATION_MANIFEST_PATH)

JP029_GATES = ["AP-JP-029-001", "AP-JP-029-002", "AP-JP-029-003"]
JP181_POINT = "AP-JP-181-001"


class TargetSetTests(unittest.TestCase):
    """The target set is derived, not declared — these pin what the derivation must find
    against the committed historical artifacts."""

    @classmethod
    def setUpClass(cls):
        cls.edges = pipeline.derive_target_edges(data_dir=REPO / "data")

    def test_exactly_the_six_affected_directed_edges(self):
        self.assertEqual(
            [(e["fromId"], e["toId"]) for e in self.edges],
            [
                ("JP-028", "JP-029"),
                ("JP-029", "JP-028"),
                ("JP-029", "JP-030"),
                ("JP-030", "JP-029"),
                ("JP-181", "JP-182"),
                ("JP-182", "JP-181"),
            ],
        )

    def test_every_target_edge_comes_from_the_scale_artifact(self):
        self.assertEqual({e["historicalOrigin"] for e in self.edges}, {common.HISTORICAL_ORIGIN_SCALE})

    def test_direction_is_preserved_not_collapsed(self):
        keys = [(e["fromId"], e["toId"]) for e in self.edges]
        self.assertIn(("JP-028", "JP-029"), keys)
        self.assertIn(("JP-029", "JP-028"), keys)
        self.assertEqual(len(keys), len(set(keys)))

    def test_no_edge_without_a_target_place(self):
        for edge in self.edges:
            with self.subTest(edge=(edge["fromId"], edge["toId"])):
                self.assertTrue({edge["fromId"], edge["toId"]} & set(common.REVALIDATION_TARGET_PLACE_IDS))

    def test_lineage_copies_the_historical_answer_verbatim(self):
        scale = {(r["fromId"], r["toId"]): r for r in common.load_json(REPO / common.SCALE_RESULTS_PATH)}
        for edge in self.edges:
            historical = scale[(edge["fromId"], edge["toId"])]
            lineage = pipeline.historical_lineage(edge)
            with self.subTest(edge=(edge["fromId"], edge["toId"])):
                self.assertEqual(lineage["status"], historical["status"])
                self.assertEqual(lineage["distance"], historical["distance"])
                self.assertEqual(lineage["minutes"], historical["minutes"])
                self.assertEqual(lineage["verifiedAt"], historical["verifiedAt"])
                self.assertEqual(lineage["query"], historical["query"])

    def test_lineage_marks_historical_endpoints_as_place_coordinate(self):
        for edge in self.edges:
            lineage = pipeline.historical_lineage(edge)
            with self.subTest(edge=(edge["fromId"], edge["toId"])):
                self.assertEqual(lineage["fromEndpoint"]["kind"], common.ENDPOINT_KIND_PLACE_COORDINATE)
                self.assertEqual(lineage["toEndpoint"]["kind"], common.ENDPOINT_KIND_PLACE_COORDINATE)
                self.assertTrue(lineage["endpointIdentityInferred"])

    def test_missing_historical_result_is_an_error_not_a_silent_drop(self):
        with tempfile.TemporaryDirectory() as tmp:
            results = common.load_json(REPO / common.SCALE_RESULTS_PATH)
            trimmed = [r for r in results if (r["fromId"], r["toId"]) != ("JP-028", "JP-029")]
            path = Path(tmp) / "scale-results.json"
            common.write_json(path, trimmed)
            original = pipeline.HISTORICAL_SOURCES
            pipeline.HISTORICAL_SOURCES = (
                (common.HISTORICAL_ORIGIN_SCALE, REPO / common.SCALE_MANIFEST_PATH, path),
            )
            try:
                with self.assertRaises(ValueError):
                    pipeline.derive_target_edges(data_dir=REPO / "data")
            finally:
                pipeline.HISTORICAL_SOURCES = original


class CandidateExpansionTests(unittest.TestCase):
    """Section 4/5 semantics: every eligible gate is routed, none is pre-selected."""

    @classmethod
    def setUpClass(cls):
        cls.edges = pipeline.derive_target_edges(data_dir=REPO / "data")
        cls.candidates = pipeline.expand_candidates(cls.edges, ACCESS_POINTS)

    def test_fourteen_candidates(self):
        self.assertEqual(len(self.candidates), 14)

    def test_jp029_contributes_three_candidates_per_directed_edge(self):
        by_edge = {}
        for candidate in self.candidates:
            if "JP-029" in (candidate["fromId"], candidate["toId"]):
                by_edge.setdefault((candidate["fromId"], candidate["toId"]), []).append(candidate)
        self.assertEqual(len(by_edge), 4)
        for edge, items in by_edge.items():
            with self.subTest(edge=edge):
                self.assertEqual(len(items), 3)
                used = sorted(ap for c in items for ap in c["accessPointIds"])
                self.assertEqual(used, JP029_GATES)

    def test_jp181_uses_only_its_single_external_reception_point(self):
        items = [c for c in self.candidates if "JP-181" in (c["fromId"], c["toId"])]
        self.assertEqual(len(items), 2)
        self.assertEqual({ap for c in items for ap in c["accessPointIds"]}, {JP181_POINT})

    def test_jp181_never_uses_a_trailhead_or_internal_stage(self):
        for candidate in self.candidates:
            for endpoint in (candidate["fromEndpoint"], candidate["toEndpoint"]):
                if endpoint["kind"] != common.ENDPOINT_KIND_ACCESS_POINT:
                    continue
                point = next(p for p in ACCESS_POINTS if p["id"] == endpoint["accessPointId"])
                with self.subTest(ap=point["id"]):
                    self.assertIn(common.EXTERNAL_WALK_CONTEXT, point["applicableContexts"])
                    self.assertNotIn("internal-hike", point["applicableContexts"])
                    self.assertNotIn("internal-shuttle", point["applicableContexts"])
                    self.assertNotEqual(point["role"], "trailhead")

    def test_non_target_endpoint_stays_a_place_coordinate(self):
        targets = set(common.REVALIDATION_TARGET_PLACE_IDS)
        for candidate in self.candidates:
            for endpoint, place_id in (
                (candidate["fromEndpoint"], candidate["fromId"]),
                (candidate["toEndpoint"], candidate["toId"]),
            ):
                if place_id not in targets:
                    with self.subTest(key=candidate["candidateKey"]):
                        self.assertEqual(endpoint["kind"], common.ENDPOINT_KIND_PLACE_COORDINATE)

    def test_candidate_keys_are_unique_and_direction_bearing(self):
        keys = [c["candidateKey"] for c in self.candidates]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertIn("JP-028->JP-029@AP-JP-029-001", keys)
        self.assertIn("JP-029@AP-JP-029-001->JP-028", keys)

    def test_a_target_place_without_an_eligible_point_raises(self):
        catalog = [p for p in ACCESS_POINTS if p["placeId"] != "JP-181"]
        with self.assertRaises(ValueError):
            pipeline.expand_candidates(self.edges, catalog)

    def test_deprecated_point_is_never_expanded_into_a_candidate(self):
        catalog = copy.deepcopy(ACCESS_POINTS)
        for point in catalog:
            if point["id"] == "AP-JP-029-002":
                point["status"] = "deprecated"
        candidates = pipeline.expand_candidates(self.edges, catalog)
        self.assertNotIn("AP-JP-029-002", {ap for c in candidates for ap in c["accessPointIds"]})

    def test_eligible_access_points_returns_all_three_gates_in_catalog_order(self):
        """No implicit tie-break: the helper hands back every gate, and the catalog's
        ordinal carries no priority."""
        eligible = common.eligible_access_points(ACCESS_POINTS, "JP-029")
        self.assertEqual([p["id"] for p in eligible], JP029_GATES)

    def test_no_access_point_declares_a_default(self):
        for point in ACCESS_POINTS:
            with self.subTest(point=point["id"]):
                self.assertEqual(point["selection"].get("defaultForContexts", []), [])


class EndpointResolutionTests(unittest.TestCase):
    def setUp(self):
        self.by_id = common.places_by_id(PLACES)
        self.ap_by_id = common.access_points_by_id(ACCESS_POINTS)

    def test_access_point_endpoint_resolves_to_the_catalog_coordinate(self):
        endpoint = common.access_point_endpoint("JP-029", "AP-JP-029-001")
        self.assertEqual(
            common.endpoint_coordinates(endpoint, self.by_id, self.ap_by_id),
            {"lat": 35.68596, "lng": 139.760215},
        )

    def test_access_point_endpoint_does_not_resolve_to_the_place_display_coordinate(self):
        endpoint = common.access_point_endpoint("JP-029", "AP-JP-029-001")
        self.assertNotEqual(
            common.endpoint_coordinates(endpoint, self.by_id, self.ap_by_id),
            self.by_id["JP-029"]["coordinates"],
        )

    def test_ors_coordinates_stay_lng_lat(self):
        endpoint = common.access_point_endpoint("JP-181", JP181_POINT)
        place = common.endpoint_as_place(endpoint, self.by_id, self.ap_by_id)
        self.assertEqual(common.to_ors_coordinates(place), [128.2550917, 26.8619707])

    def test_placeid_mismatch_raises(self):
        endpoint = common.access_point_endpoint("JP-181", "AP-JP-029-001")
        with self.assertRaises(ValueError):
            common.endpoint_coordinates(endpoint, self.by_id, self.ap_by_id)

    def test_unknown_access_point_raises(self):
        endpoint = common.access_point_endpoint("JP-029", "AP-JP-029-999")
        with self.assertRaises(KeyError):
            common.endpoint_coordinates(endpoint, self.by_id, self.ap_by_id)


class ComparisonTests(unittest.TestCase):
    LINEAGE = {
        "origin": "scale",
        "artifact": "data/logistics/walking-scale-results.json",
        "manifest": "data/logistics/walking-scale-manifest.json",
        "status": "validated",
        "verifiedAt": "2026-09-04T15:00:00Z",
        "query": {"fromCoordinates": [139.0, 35.0], "toCoordinates": [139.1, 35.1]},
        "fromEndpoint": common.place_coordinate_endpoint("JP-028"),
        "toEndpoint": common.place_coordinate_endpoint("JP-029"),
        "endpointIdentityInferred": True,
        "distance": {"meters": 1000.0},
        "minutes": {"minMinutes": 20, "maxMinutes": 20},
        "durationSecondsRaw": 1200.0,
        "endpointSnapping": {"assessment": "clean", "fromSnapMeters": 2.0, "toSnapMeters": 3.0},
    }

    def record(self, **updates):
        record = {
            "status": "validated",
            "fromEndpoint": common.place_coordinate_endpoint("JP-028"),
            "toEndpoint": common.access_point_endpoint("JP-029", "AP-JP-029-001"),
            "distance": {"meters": 1250.0},
            "minutes": {"minMinutes": 25, "maxMinutes": 25},
            "durationSecondsRaw": 1500.0,
            "endpointSnapping": {"assessment": "clean", "fromSnapMeters": 2.0, "toSnapMeters": 1.0},
        }
        record.update(updates)
        return record

    def test_absolute_and_percent_deltas(self):
        comparison = pipeline.build_comparison(self.LINEAGE, self.record())
        self.assertTrue(comparison["comparable"])
        self.assertEqual(comparison["distanceDeltaMeters"], 250.0)
        self.assertEqual(comparison["distanceDeltaPercent"], 25.0)
        self.assertEqual(comparison["durationDeltaMinutes"], 5)
        self.assertEqual(comparison["durationDeltaPercent"], 25.0)
        self.assertEqual(comparison["durationDeltaSeconds"], 300.0)

    def test_both_endpoint_identities_are_recorded(self):
        comparison = pipeline.build_comparison(self.LINEAGE, self.record())
        self.assertEqual(comparison["historicalToEndpoint"]["kind"], "place-coordinate")
        self.assertEqual(comparison["newToEndpoint"]["accessPointId"], "AP-JP-029-001")

    def test_snap_displacement_is_carried_from_both_sides(self):
        comparison = pipeline.build_comparison(self.LINEAGE, self.record())
        self.assertEqual(comparison["historicalSnapping"]["toSnapMeters"], 3.0)
        self.assertEqual(comparison["newSnapping"]["toSnapMeters"], 1.0)

    def test_no_route_candidate_yields_no_fabricated_delta(self):
        record = {
            "status": "no-route",
            "fromEndpoint": common.place_coordinate_endpoint("JP-028"),
            "toEndpoint": common.access_point_endpoint("JP-029", "AP-JP-029-001"),
        }
        comparison = pipeline.build_comparison(self.LINEAGE, record)
        self.assertFalse(comparison["comparable"])
        self.assertNotIn("distanceDeltaMeters", comparison)
        self.assertIn("reason", comparison)

    def test_non_validated_history_is_not_comparable(self):
        lineage = dict(self.LINEAGE, status="no-route")
        lineage.pop("distance")
        comparison = pipeline.build_comparison(lineage, self.record())
        self.assertFalse(comparison["comparable"])
        self.assertNotIn("distanceDeltaMeters", comparison)

    def test_zero_historical_value_gives_no_percentage(self):
        lineage = dict(self.LINEAGE, distance={"meters": 0.0})
        comparison = pipeline.build_comparison(lineage, self.record())
        self.assertEqual(comparison["distanceDeltaMeters"], 1250.0)
        self.assertIsNone(comparison["distanceDeltaPercent"])


class SnapStoreTests(unittest.TestCase):
    POINT = {"id": "AP-JP-029-001", "placeId": "JP-029", "coordinates": {"lat": 35.68596, "lng": 139.760215}}

    def test_resolved_entry_requires_a_measurement(self):
        with self.assertRaises(ValueError):
            pipeline.build_access_point_snap_entry(self.POINT, None, 350, "2026-09-05T00:00:00Z", status="resolved")

    def test_failed_entry_must_not_carry_a_measurement(self):
        with self.assertRaises(ValueError):
            pipeline.build_access_point_snap_entry(self.POINT, 5.0, 350, "2026-09-05T00:00:00Z", status="request-error")

    def test_null_measurement_is_no_snap_never_zero(self):
        entry = pipeline.build_access_point_snap_entry(self.POINT, None, 350, "2026-09-05T00:00:00Z")
        self.assertEqual(entry["status"], "no-snap")
        self.assertIsNone(entry["snappedDistanceMeters"])

    def test_moved_catalog_coordinate_makes_the_entry_stale(self):
        entry = pipeline.build_access_point_snap_entry(self.POINT, 4.0, 350, "2026-09-05T00:00:00Z")
        store = {"snapVersion": 1, "accessPoints": {self.POINT["id"]: entry}}
        self.assertEqual(pipeline.classify_access_point_snap_coverage(self.POINT, store), "resolved")
        moved = dict(self.POINT, coordinates={"lat": 35.7, "lng": 139.76})
        self.assertEqual(pipeline.classify_access_point_snap_coverage(moved, store), "stale")

    def test_unmeasured_endpoint_never_yields_a_clean_assessment(self):
        candidate = {
            "fromEndpoint": common.place_coordinate_endpoint("JP-028"),
            "toEndpoint": common.access_point_endpoint("JP-029", "AP-JP-029-001"),
        }
        by_id = common.places_by_id(PLACES)
        ap_by_id = common.access_points_by_id(ACCESS_POINTS)
        place_store = common.load_snap_places_store(REPO / common.SNAP_PLACES_PATH)
        snapping = pipeline.combine_snapping_for_candidate(
            candidate, 1000.0, place_store, {"accessPoints": {}}, by_id, ap_by_id
        )
        self.assertEqual(snapping["assessment"], "unknown")
        self.assertIsNone(snapping["toSnapMeters"])
        self.assertIn("reason", snapping)

    def test_thresholds_are_untouched_by_this_phase(self):
        self.assertIsNone(common.SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS)
        self.assertEqual(common.SNAP_SIGNIFICANT_ABSOLUTE_METERS, 10.0)
        self.assertEqual(common.SNAP_SIGNIFICANT_ROUTED_DISTANCE_RATIO, 0.5)
        self.assertEqual(common.ORS_SNAP_MAX_RADIUS_METERS, 350)


def synthetic_results_document():
    """A fully-populated results document built from the real manifest and fixture
    provider answers — so the results validator is exercised even though this phase
    never executed a real batch."""
    manifest = copy.deepcopy(MANIFEST)
    by_id = common.places_by_id(PLACES)
    ap_by_id = common.access_points_by_id(ACCESS_POINTS)
    ap_store = {
        "snapVersion": 1,
        "accessPoints": {
            point["id"]: pipeline.build_access_point_snap_entry(
                point, 3.5, common.ORS_SNAP_MAX_RADIUS_METERS, "2026-09-05T00:00:00Z"
            )
            for point in ACCESS_POINTS
        },
    }
    place_store = common.load_snap_places_store(REPO / common.SNAP_PLACES_PATH)
    results = {}
    for candidate in manifest["candidates"]:
        from_place = common.endpoint_as_place(candidate["fromEndpoint"], by_id, ap_by_id)
        to_place = common.endpoint_as_place(candidate["toEndpoint"], by_id, ap_by_id)
        snapping = pipeline.combine_snapping_for_candidate(
            candidate, 1234.5, place_store, ap_store, by_id, ap_by_id
        )
        base = pipeline.build_success_result(
            candidate["fromId"], candidate["toId"], 1234.5, 900.0,
            from_place, to_place, "2026-09-05T01:00:00Z",
        )
        results[candidate["candidateKey"]] = pipeline.build_candidate_record(
            candidate, base, endpoint_snapping=snapping
        )
    return manifest, pipeline.build_results_document(manifest, results)


class ValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest, cls.document = synthetic_results_document()

    def manifest_errors(self, manifest):
        return validator.validate_manifest(manifest, PLACES, ACCESS_POINTS)

    def result_errors(self, document, manifest=None):
        return validator.validate_results(document, manifest or self.manifest, PLACES, ACCESS_POINTS)

    def assert_flags(self, errors, phrase):
        self.assertTrue(any(phrase in error for error in errors), errors)

    # --- clean baselines -------------------------------------------------------
    def test_committed_manifest_is_valid(self):
        self.assertEqual(self.manifest_errors(copy.deepcopy(MANIFEST)), [])

    def test_synthetic_results_are_valid(self):
        self.assertEqual(self.result_errors(copy.deepcopy(self.document)), [])

    def test_repository_state_validates_end_to_end(self):
        self.assertEqual(validator.validate(REPO / "data"), [])

    # --- section 10 failure modes ---------------------------------------------
    def test_detects_nonexistent_access_point(self):
        manifest = copy.deepcopy(MANIFEST)
        manifest["candidates"][0]["toEndpoint"]["accessPointId"] = "AP-JP-029-404"
        self.assert_flags(self.manifest_errors(manifest), "orphan accessPointId")

    def test_detects_endpoint_place_id_mismatch(self):
        manifest = copy.deepcopy(MANIFEST)
        manifest["candidates"][0]["toEndpoint"]["placeId"] = "JP-181"
        self.assert_flags(self.manifest_errors(manifest), "does not match")

    def test_detects_invalid_endpoint_context(self):
        catalog = copy.deepcopy(ACCESS_POINTS)
        for point in catalog:
            if point["id"] == "AP-JP-029-001":
                point["applicableContexts"] = ["internal-shuttle"]
        errors = validator.validate_manifest(copy.deepcopy(MANIFEST), PLACES, catalog)
        self.assert_flags(errors, "not applicable to 'external-walk'")

    def test_detects_internal_only_endpoint(self):
        catalog = copy.deepcopy(ACCESS_POINTS)
        for point in catalog:
            if point["id"] == JP181_POINT:
                point["applicableContexts"] = ["internal-hike"]
        errors = validator.validate_manifest(copy.deepcopy(MANIFEST), PLACES, catalog)
        self.assert_flags(errors, "internal stage")

    def test_detects_deprecated_endpoint(self):
        catalog = copy.deepcopy(ACCESS_POINTS)
        for point in catalog:
            if point["id"] == "AP-JP-029-003":
                point["status"] = "deprecated"
        errors = validator.validate_manifest(copy.deepcopy(MANIFEST), PLACES, catalog)
        self.assert_flags(errors, "not active")

    def test_detects_duplicate_directed_candidate_key(self):
        manifest = copy.deepcopy(MANIFEST)
        manifest["candidates"].append(copy.deepcopy(manifest["candidates"][0]))
        self.assert_flags(self.manifest_errors(manifest), "duplicate directed candidate key")

    def test_detects_missing_lineage(self):
        manifest = copy.deepcopy(MANIFEST)
        del manifest["candidates"][0]["lineage"]
        self.assert_flags(self.manifest_errors(manifest), "missing lineage")

    def test_detects_lineage_claiming_an_access_point_history(self):
        manifest = copy.deepcopy(MANIFEST)
        manifest["candidates"][0]["lineage"]["toEndpoint"] = common.access_point_endpoint(
            "JP-029", "AP-JP-029-001"
        )
        self.assert_flags(self.manifest_errors(manifest), "must be a place-coordinate endpoint")

    def test_detects_unknown_place(self):
        manifest = copy.deepcopy(MANIFEST)
        manifest["candidates"][0]["fromId"] = "JP-999"
        manifest["candidates"][0]["fromEndpoint"]["placeId"] = "JP-999"
        self.assert_flags(self.manifest_errors(manifest), "unknown place")

    def test_detects_an_edge_outside_the_target_set(self):
        manifest = copy.deepcopy(MANIFEST)
        candidate = copy.deepcopy(manifest["candidates"][0])
        candidate.update(
            {
                "fromId": "JP-001",
                "toId": "JP-002",
                "fromEndpoint": common.place_coordinate_endpoint("JP-001"),
                "toEndpoint": common.place_coordinate_endpoint("JP-002"),
                "accessPointIds": [],
                "candidateKey": "JP-001->JP-002",
            }
        )
        manifest["candidates"].append(candidate)
        self.assert_flags(self.manifest_errors(manifest), "outside the approved target set")

    def test_detects_a_jp029_candidate_outside_its_three_approved_gates(self):
        manifest = copy.deepcopy(MANIFEST)
        candidate = manifest["candidates"][0]
        candidate["toEndpoint"] = common.access_point_endpoint("JP-029", JP181_POINT)
        candidate["accessPointIds"] = [JP181_POINT]
        candidate["candidateKey"] = common.candidate_key(candidate["fromEndpoint"], candidate["toEndpoint"])
        self.assert_flags(self.manifest_errors(manifest), "not approved eligible points for JP-029")

    def test_detects_a_pre_selected_gate(self):
        """Dropping two of JP-028->JP-029's three candidates is exactly what "choose the
        first gate" would look like in the artifact."""
        manifest = copy.deepcopy(MANIFEST)
        manifest["candidates"] = [
            c for c in manifest["candidates"]
            if not ((c["fromId"], c["toId"]) == ("JP-028", "JP-029") and c["accessPointIds"] != ["AP-JP-029-001"])
        ]
        self.assert_flags(self.manifest_errors(manifest), "every eligible point must be routed")

    def test_detects_non_target_endpoint_promoted_to_an_access_point(self):
        manifest = copy.deepcopy(MANIFEST)
        candidate = manifest["candidates"][0]
        candidate["fromEndpoint"] = common.access_point_endpoint("JP-028", "AP-JP-029-001")
        self.assert_flags(self.manifest_errors(manifest), "must stay a place-coordinate endpoint")

    def test_detects_candidate_key_not_matching_its_endpoints(self):
        manifest = copy.deepcopy(MANIFEST)
        manifest["candidates"][0]["candidateKey"] = "JP-028->JP-029"
        self.assert_flags(self.manifest_errors(manifest), "does not match")

    # --- results-side failure modes -------------------------------------------
    def test_detects_malformed_coordinates(self):
        document = copy.deepcopy(self.document)
        document["candidates"][0]["query"]["fromCoordinates"] = [999.0, "x"]
        self.assert_flags(self.result_errors(document), "malformed query coordinates")

    def test_detects_coordinates_that_are_not_the_endpoints_own(self):
        document = copy.deepcopy(self.document)
        document["candidates"][0]["query"]["toCoordinates"] = [139.7528, 35.6852]
        self.assert_flags(self.result_errors(document), "are not toEndpoint's own")

    def test_detects_a_result_outside_the_manifest(self):
        document = copy.deepcopy(self.document)
        document["candidates"][0]["candidateKey"] = "JP-001->JP-002"
        self.assert_flags(self.result_errors(document), "not in the manifest")

    def test_detects_duplicate_result_key(self):
        document = copy.deepcopy(self.document)
        document["candidates"].append(copy.deepcopy(document["candidates"][0]))
        self.assert_flags(self.result_errors(document), "duplicate directed candidate key")

    def test_detects_tampered_lineage(self):
        document = copy.deepcopy(self.document)
        document["candidates"][0]["lineage"]["distance"] = {"meters": 1.0}
        self.assert_flags(self.result_errors(document), "lineage does not match")

    def test_detects_a_hand_edited_comparison(self):
        document = copy.deepcopy(self.document)
        document["candidates"][0]["comparison"]["distanceDeltaMeters"] = -1.0
        self.assert_flags(self.result_errors(document), "not the re-derivable function")

    def test_detects_a_failure_result_carrying_distance(self):
        document = copy.deepcopy(self.document)
        record = document["candidates"][0]
        record["status"] = "no-route"
        self.assert_flags(self.result_errors(document), "must not carry")

    def test_detects_a_changed_provider_or_profile(self):
        document = copy.deepcopy(self.document)
        document["candidates"][0]["profile"] = "driving-car"
        self.assert_flags(self.result_errors(document), "openrouteservice/foot-walking")

    def test_detects_a_validated_result_without_snapping(self):
        document = copy.deepcopy(self.document)
        del document["candidates"][0]["endpointSnapping"]
        self.assert_flags(self.result_errors(document), "needs an endpointSnapping block")

    # --- historical immutability ----------------------------------------------
    def test_historical_digest_guard_flags_a_changed_artifact(self):
        manifest = copy.deepcopy(MANIFEST)
        manifest["sourceContext"]["historicalResultsDigest"]["scale"] = "0" * 64
        errors = validator.validate_historical_immutability(manifest, REPO / "data")
        self.assert_flags(errors, "must never mutate a historical walking result")

    def test_historical_results_carry_no_access_point_annotation(self):
        self.assertEqual(validator.validate_historical_immutability(copy.deepcopy(MANIFEST), REPO / "data"), [])
        for path in (REPO / common.RESULTS_PATH, REPO / common.SCALE_RESULTS_PATH):
            payload = path.read_text(encoding="utf-8")
            with self.subTest(path=path.name):
                self.assertNotIn("accessPointId", payload)
                self.assertNotIn("fromEndpoint", payload)


class NoRuntimeIntegrationTests(unittest.TestCase):
    """Section 9: Phase 3B2H is generation + evidence + comparison only."""

    def test_transfer_ts_does_not_read_the_revalidation_artifact(self):
        source = (REPO / "app/src/lib/transfer.ts").read_text(encoding="utf-8")
        self.assertNotIn("walking-access-point", source)
        self.assertNotIn("access-points", source)
        self.assertNotIn("accessPoint", source)

    def test_no_app_copy_of_the_revalidation_artifacts(self):
        for path in (
            REPO / common.APP_REVALIDATION_RESULTS_PATH,
            REPO / "app/src/data/logistics/walking-access-point-manifest.json",
        ):
            with self.subTest(path=path.name):
                self.assertFalse(path.exists())

    def test_historical_artifacts_are_not_written_by_this_pipeline(self):
        source = (SCRIPTS / "revalidate-walking-access-points.py").read_text(encoding="utf-8")
        for forbidden in ("write_json(RESULTS_PATH", "write_json(SCALE_RESULTS_PATH",
                          "write_json(SNAP_PLACES_PATH", "write_json(APP_"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, source)


class CliGuardTests(unittest.TestCase):
    """Both network modes must refuse without a key — the Phase 3B2H stop condition."""

    def run_cli(self, *args):
        env = dict(os.environ)
        env.pop("ORS_API_KEY", None)
        return subprocess.run(
            [sys.executable, str(SCRIPTS / "revalidate-walking-access-points.py"), *args],
            cwd=REPO, env=env, capture_output=True, text=True,
        )

    def test_execute_refuses_without_a_key(self):
        completed = self.run_cli("--execute")
        self.assertEqual(completed.returncode, 1)
        self.assertIn("ORS_API_KEY required", completed.stdout)

    def test_backfill_snap_refuses_without_a_key(self):
        completed = self.run_cli("--backfill-snap")
        self.assertEqual(completed.returncode, 1)
        self.assertIn("ORS_API_KEY required", completed.stdout)

    def test_exactly_one_mode_is_required(self):
        self.assertEqual(self.run_cli().returncode, 2)
        self.assertEqual(self.run_cli("--dry-run", "--execute").returncode, 2)

    def test_dry_run_needs_no_key_and_reports_the_target_set(self):
        completed = self.run_cli("--dry-run")
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn("Target directed edges: 6", completed.stdout)
        self.assertIn("Candidates: 14", completed.stdout)
        self.assertIn("Planned Directions requests: 14", completed.stdout)

    def test_build_manifest_is_deterministic(self):
        before = (REPO / common.REVALIDATION_MANIFEST_PATH).read_text(encoding="utf-8")
        rebuilt = pipeline.build_manifest_document(REPO / "data")
        self.assertEqual(json.loads(before), rebuilt)


if __name__ == "__main__":
    unittest.main()
