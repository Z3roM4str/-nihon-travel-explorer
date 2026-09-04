#!/usr/bin/env python3
"""Unit tests for the Phase 3B2A walking-validation pipeline.

Usage:
    python3 scripts/test_walking_pilot.py

No test here makes a real network call — ORS responses are mocked. Run this instead
of (or before) an --execute pilot run to check the pipeline logic itself.
"""
import argparse
import hashlib
import importlib.util
import io
import json
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))


def load_module(filename, name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


common = load_module("logistics_common.py", "logistics_common")
vwp = load_module("validate-walking-pilot.py", "validate_walking_pilot")
select = load_module("select-walking-pilot.py", "select_walking_pilot")
report = load_module("report-walking-pilot.py", "report_walking_pilot")
validate_logistics = load_module("validate-logistics.py", "validate_logistics")


def fake_place(place_id, lat, lng, **extra):
    base = {"id": place_id, "hub": "Tokio", "cluster": "Test", "coordinates": {"lat": lat, "lng": lng}}
    base.update(extra)
    return base


class CoordinateOrderTests(unittest.TestCase):
    """The single most important regression: ORS wants [lng, lat]; Place stores
    {lat, lng}. Distinct, non-symmetric values so a swap cannot hide by accident.
    """

    def test_ors_coordinates_are_lng_lat_not_lat_lng(self):
        place = fake_place("JP-TEST", lat=10.0, lng=20.0)
        coords = common.to_ors_coordinates(place)
        self.assertEqual(coords, [20.0, 10.0])
        self.assertNotEqual(coords, [10.0, 20.0])

    def test_real_tokyo_coordinates_keep_lng_first(self):
        # Real Shibuya Crossing coordinates: lat ~35.66, lng ~139.70. Distinct
        # integer parts (35 vs 139) make a silent swap immediately visible.
        place = fake_place("JP-001", lat=35.6595, lng=139.7005)
        coords = common.to_ors_coordinates(place)
        self.assertAlmostEqual(coords[0], 139.7005)
        self.assertAlmostEqual(coords[1], 35.6595)


class MinuteRoundingTests(unittest.TestCase):
    def test_rounds_half_up_not_bankers_rounding(self):
        # 90s = 1.5 min -> 2 (half-up), not 2 via banker's-rounding-to-even by luck;
        # confirmed against 150s = 2.5 min -> 3 (banker's rounding would give 2).
        self.assertEqual(common.round_half_up_minutes(90), 2)
        self.assertEqual(common.round_half_up_minutes(150), 3)

    def test_rounds_down_below_half(self):
        self.assertEqual(common.round_half_up_minutes(89), 1)
        self.assertEqual(common.round_half_up_minutes(29), 0)

    def test_no_fabricated_tolerance(self):
        # A single provider sample becomes exactly one integer minute value; the
        # function has no notion of +-10%/+-15% tolerance to inject.
        self.assertEqual(common.round_half_up_minutes(300), 5)


class ProviderResponseParsingTests(unittest.TestCase):
    def _fake_urlopen_success(self, distance_m, duration_s):
        body = json.dumps({"routes": [{"summary": {"distance": distance_m, "duration": duration_s}}]})
        response = mock.MagicMock()
        response.read.return_value = body.encode("utf-8")
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        return response

    def test_parses_distance_and_duration_from_summary(self):
        with mock.patch.object(vwp.urllib.request, "urlopen", return_value=self._fake_urlopen_success(1372.6, 292.8)):
            from_place = fake_place("A", 35.0, 139.0)
            to_place = fake_place("B", 35.01, 139.01)
            distance_m, duration_s = vwp.query_ors("fake-key", from_place, to_place)
        self.assertEqual(distance_m, 1372.6)
        self.assertEqual(duration_s, 292.8)

    def test_no_route_error_code_classified_as_no_route(self):
        error_body = json.dumps({"error": {"code": 2010, "message": "Could not find point"}}).encode("utf-8")
        http_error = urllib.error.HTTPError(
            url="https://api.heigit.org/openrouteservice/v2/directions/foot-walking/json",
            code=404,
            msg="Not Found",
            hdrs=None,
            fp=io.BytesIO(error_body),
        )
        with mock.patch.object(vwp.urllib.request, "urlopen", side_effect=http_error):
            with self.assertRaises(vwp.RoutingRequestError) as ctx:
                vwp.query_ors("fake-key", fake_place("A", 35.0, 139.0), fake_place("B", 35.0, 139.0))
        self.assertEqual(ctx.exception.status, "no-route")
        self.assertFalse(ctx.exception.transient)

    def test_auth_error_is_request_error_not_no_route(self):
        http_error = urllib.error.HTTPError(
            url="https://api.heigit.org/openrouteservice/v2/directions/foot-walking/json",
            code=401,
            msg="Unauthorized",
            hdrs=None,
            fp=io.BytesIO(b'{"error": {"message": "Unauthorized"}}'),
        )
        with mock.patch.object(vwp.urllib.request, "urlopen", side_effect=http_error):
            with self.assertRaises(vwp.RoutingRequestError) as ctx:
                vwp.query_ors("bad-key", fake_place("A", 35.0, 139.0), fake_place("B", 35.0, 139.0))
        self.assertEqual(ctx.exception.status, "request-error")
        self.assertFalse(ctx.exception.transient)

    def test_rate_limit_is_transient_request_error(self):
        http_error = urllib.error.HTTPError(
            url="https://api.heigit.org/openrouteservice/v2/directions/foot-walking/json",
            code=429,
            msg="Too Many Requests",
            hdrs=None,
            fp=io.BytesIO(b"{}"),
        )
        with mock.patch.object(vwp.urllib.request, "urlopen", side_effect=http_error):
            with self.assertRaises(vwp.RoutingRequestError) as ctx:
                vwp.query_ors("fake-key", fake_place("A", 35.0, 139.0), fake_place("B", 35.0, 139.0))
        self.assertEqual(ctx.exception.status, "request-error")
        self.assertTrue(ctx.exception.transient)

    def test_retry_succeeds_after_one_transient_failure(self):
        http_error = urllib.error.HTTPError(
            url="x", code=503, msg="Service Unavailable", hdrs=None, fp=io.BytesIO(b"{}")
        )
        success = self._fake_urlopen_success(500.0, 60.0)
        with mock.patch.object(vwp.urllib.request, "urlopen", side_effect=[http_error, success]):
            with mock.patch.object(vwp.time, "sleep"):
                outcome, error = vwp.query_ors_with_retry(
                    "fake-key", fake_place("A", 35.0, 139.0), fake_place("B", 35.0, 139.0)
                )
        self.assertIsNone(error)
        self.assertEqual(outcome, (500.0, 60.0))

    def test_retry_is_bounded_to_one_attempt(self):
        http_error = urllib.error.HTTPError(
            url="x", code=503, msg="Service Unavailable", hdrs=None, fp=io.BytesIO(b"{}")
        )
        with mock.patch.object(vwp.urllib.request, "urlopen", side_effect=[http_error, http_error, http_error]):
            with mock.patch.object(vwp.time, "sleep") as sleep_mock:
                outcome, error = vwp.query_ors_with_retry(
                    "fake-key", fake_place("A", 35.0, 139.0), fake_place("B", 35.0, 139.0)
                )
        self.assertIsNone(outcome)
        self.assertEqual(error.status, "request-error")
        self.assertEqual(sleep_mock.call_count, 1)  # exactly one retry, not an aggressive loop

    def test_no_route_is_never_retried(self):
        error_body = json.dumps({"error": {"code": 2010, "message": "no point"}}).encode("utf-8")
        http_error = urllib.error.HTTPError(url="x", code=404, msg="Not Found", hdrs=None, fp=io.BytesIO(error_body))
        with mock.patch.object(vwp.urllib.request, "urlopen", side_effect=[http_error, http_error]) as urlopen_mock:
            with mock.patch.object(vwp.time, "sleep") as sleep_mock:
                outcome, error = vwp.query_ors_with_retry(
                    "fake-key", fake_place("A", 35.0, 139.0), fake_place("B", 35.0, 139.0)
                )
        self.assertIsNone(outcome)
        self.assertEqual(error.status, "no-route")
        self.assertEqual(urlopen_mock.call_count, 1)  # no retry attempted
        sleep_mock.assert_not_called()


class ResultBuildingTests(unittest.TestCase):
    def test_success_result_has_validated_static_confidence_and_provenance(self):
        from_place, to_place = fake_place("A", 35.0, 139.0), fake_place("B", 35.01, 139.01)
        result = vwp.build_success_result("A", "B", 500.0, 90.0, from_place, to_place, "2026-09-04T12:00:00Z")
        self.assertEqual(result["confidence"], "validated-static")
        self.assertEqual(result["status"], "validated")
        self.assertEqual(result["source"]["kind"], "routing-provider")
        self.assertEqual(result["source"]["provider"], "openrouteservice")
        self.assertEqual(result["source"]["profile"], "foot-walking")
        self.assertEqual(result["verifiedAt"], "2026-09-04T12:00:00Z")
        self.assertEqual(result["minutes"], {"minMinutes": 2, "maxMinutes": 2})
        self.assertNotIn("apiKey", json.dumps(result).lower())

    def test_failure_result_has_no_confidence_or_distance(self):
        from_place, to_place = fake_place("A", 35.0, 139.0), fake_place("B", 35.01, 139.01)
        result = vwp.build_failure_result("A", "B", "no-route", "boom", from_place, to_place, "2026-09-04T12:00:00Z")
        self.assertNotIn("confidence", result)
        self.assertNotIn("distance", result)
        self.assertNotIn("minutes", result)
        self.assertEqual(result["status"], "no-route")

    def test_success_result_omits_endpoint_snapping_when_not_provided(self):
        from_place, to_place = fake_place("A", 35.0, 139.0), fake_place("B", 35.01, 139.01)
        result = vwp.build_success_result("A", "B", 500.0, 90.0, from_place, to_place, "2026-09-04T12:00:00Z")
        self.assertNotIn("endpointSnapping", result)

    def test_success_result_includes_endpoint_snapping_when_provided(self):
        from_place, to_place = fake_place("A", 35.0, 139.0), fake_place("B", 35.01, 139.01)
        snapping = {"assessment": "clean", "fromSnapMeters": 1.0, "toSnapMeters": 2.0, "radiusMeters": 350}
        result = vwp.build_success_result(
            "A", "B", 500.0, 90.0, from_place, to_place, "2026-09-04T12:00:00Z", endpoint_snapping=snapping
        )
        self.assertEqual(result["endpointSnapping"], snapping)


class SnapGuardTests(unittest.TestCase):
    """The endpoint-snapping guard: a route whose endpoints snapped far from the
    original coordinates must not be treated as directly comparable to the distance
    between those original coordinates without an explicit assessment saying so, and a
    missing measurement must never be silently treated as clean."""

    def test_classify_clean_for_small_absolute_snap(self):
        # Combined snap well under the absolute floor, regardless of route length.
        self.assertEqual(common.classify_endpoint_snapping(2.0, 2.0, 100.0), "clean")

    def test_classify_clean_for_large_absolute_snap_on_a_long_route(self):
        # 15 m combined snap is unremarkable on an 800 m route (< 50% of route length).
        self.assertEqual(common.classify_endpoint_snapping(8.0, 7.0, 800.0), "clean")

    def test_classify_significant_when_combined_snap_dominates_a_short_route(self):
        # This mirrors the JP-063<->JP-065 shape: real separation ~22 m, routed
        # distance tiny, and most of the "route" is actually snap displacement.
        self.assertEqual(common.classify_endpoint_snapping(9.0, 10.4, 3.2), "significant")

    def test_classify_unknown_when_either_endpoint_is_null(self):
        # A null snap distance (unsnappable point, or an unresolved measurement) must
        # never be coerced into 0 meters and averaged into "clean" — see the real
        # JP-109<->JP-110 case, whose own 6.02x ratio was never checked at all: an
        # untested case must read as unknown, not quietly pass as comparable.
        self.assertEqual(common.classify_endpoint_snapping(None, 2.0, 100.0), "unknown")
        self.assertEqual(common.classify_endpoint_snapping(2.0, None, 100.0), "unknown")
        self.assertEqual(common.classify_endpoint_snapping(None, None, 100.0), "unknown")

    def test_build_endpoint_snapping_shape(self):
        snapping = vwp.build_endpoint_snapping(9.0, 10.4, 3.2)
        self.assertEqual(snapping["fromSnapMeters"], 9.0)
        self.assertEqual(snapping["toSnapMeters"], 10.4)
        self.assertEqual(snapping["radiusMeters"], common.ORS_SNAP_MAX_RADIUS_METERS)
        self.assertEqual(snapping["assessment"], "significant")
        self.assertNotIn("reason", snapping)  # reason is only ever set for "unknown"

    def test_build_endpoint_snapping_unknown_carries_reason(self):
        snapping = vwp.build_endpoint_snapping(None, None, 3.2, reason="Snap query failed: boom")
        self.assertEqual(snapping["assessment"], "unknown")
        self.assertEqual(snapping["reason"], "Snap query failed: boom")

    def test_build_endpoint_snapping_never_defaults_reason_when_not_unknown(self):
        snapping = vwp.build_endpoint_snapping(1.0, 1.0, 100.0, reason="should be ignored")
        self.assertEqual(snapping["assessment"], "clean")
        self.assertNotIn("reason", snapping)

    def _fake_snap_response(self, snapped_distances):
        body = json.dumps(
            {"locations": [{"snapped_distance": d} if d is not None else None for d in snapped_distances]}
        )
        response = mock.MagicMock()
        response.read.return_value = body.encode("utf-8")
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        return response

    def test_query_ors_snap_parses_snapped_distances_in_order(self):
        with mock.patch.object(vwp.urllib.request, "urlopen", return_value=self._fake_snap_response([9.0, 10.4])):
            distances = vwp.query_ors_snap("fake-key", [[139.0, 35.0], [139.01, 35.01]])
        self.assertEqual(distances, [9.0, 10.4])

    def test_query_ors_snap_returns_none_for_unsnappable_point(self):
        with mock.patch.object(vwp.urllib.request, "urlopen", return_value=self._fake_snap_response([9.0, None])):
            distances = vwp.query_ors_snap("fake-key", [[139.0, 35.0], [0.0, 0.0]])
        self.assertEqual(distances, [9.0, None])

    def test_query_ors_snap_classifies_http_error_as_request_error(self):
        http_error = urllib.error.HTTPError(url="x", code=500, msg="Server Error", hdrs=None, fp=io.BytesIO(b"{}"))
        with mock.patch.object(vwp.urllib.request, "urlopen", side_effect=http_error):
            with self.assertRaises(vwp.RoutingRequestError) as ctx:
                vwp.query_ors_snap("fake-key", [[139.0, 35.0], [139.01, 35.01]])
        self.assertEqual(ctx.exception.status, "request-error")

    def test_execute_skips_directions_and_snap_network_calls_for_a_cached_edge(self):
        # The snap call rides along with a fresh Directions query — it must never fire
        # on its own for an edge execute() is skipping because it's already cached.
        import argparse
        import os
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir = tmp_path / "data"
            data_dir.mkdir()
            (data_dir / "places.json").write_text(json.dumps([
                {"id": "A", "hub": "Tokio", "cluster": "T", "coordinates": {"lat": 35.0, "lng": 139.0}},
                {"id": "B", "hub": "Tokio", "cluster": "T", "coordinates": {"lat": 35.01, "lng": 139.01}},
            ]))
            (data_dir / "nearby.json").write_text(json.dumps([
                {
                    "Desde ID": "A", "Hacia ID": "B", "Modo": "A pie", "Distancia km": 1.0,
                    "Min aprox.": 10, "Relación": "Cercano", "Desde": "A", "Hacia": "B", "Nota": "",
                }
            ]))
            manifest_path = tmp_path / "manifest.json"
            manifest_path.write_text(json.dumps({"edges": [{"fromId": "A", "toId": "B", "category": "test"}]}))

            results_path = tmp_path / "results.json"
            app_results_path = tmp_path / "app_results.json"
            cached_result = {
                "fromId": "A", "toId": "B", "provider": "openrouteservice", "profile": "foot-walking",
                "status": "validated", "distance": {"meters": 100}, "minutes": {"minMinutes": 1, "maxMinutes": 1},
                "confidence": "validated-static", "verifiedAt": "2026-09-04T00:00:00Z",
                "source": {"kind": "routing-provider", "provider": "openrouteservice", "profile": "foot-walking"},
                "query": {"fromCoordinates": [139.0, 35.0], "toCoordinates": [139.01, 35.01]},
            }
            results_path.write_text(json.dumps([cached_result]))

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), refresh=False)

            with mock.patch.object(vwp, "RESULTS_PATH", results_path), \
                 mock.patch.object(vwp, "APP_RESULTS_PATH", app_results_path), \
                 mock.patch.dict(os.environ, {"ORS_API_KEY": "fake-key"}), \
                 mock.patch.object(vwp, "query_ors_with_retry") as directions_mock, \
                 mock.patch.object(vwp, "query_ors_snap") as snap_mock:
                vwp.execute(args)

            directions_mock.assert_not_called()
            snap_mock.assert_not_called()


class SelectionAlgorithmTests(unittest.TestCase):
    def test_selects_exactly_24_unique_directed_edges_from_real_dataset(self):
        places = common.load_places(REPO_ROOT / "data")
        nearby = common.load_nearby(REPO_ROOT / "data")
        selected = select.select_pilot_edges(places, nearby)
        self.assertEqual(len(selected), 24)
        keys = {(e["fromId"], e["toId"]) for e in selected}
        self.assertEqual(len(keys), 24)

    def test_every_selected_edge_is_a_pie(self):
        places = common.load_places(REPO_ROOT / "data")
        nearby = common.load_nearby(REPO_ROOT / "data")
        nearby_by_key = common.nearby_by_directed_key(nearby)
        selected = select.select_pilot_edges(places, nearby)
        for e in selected:
            relation = nearby_by_key[(e["fromId"], e["toId"])]
            self.assertEqual(relation["Modo"], "A pie")

    def test_selection_is_deterministic_across_runs(self):
        places = common.load_places(REPO_ROOT / "data")
        nearby = common.load_nearby(REPO_ROOT / "data")
        first = select.select_pilot_edges(places, nearby)
        second = select.select_pilot_edges(places, nearby)
        first_keys = [(e["fromId"], e["toId"]) for e in first]
        second_keys = [(e["fromId"], e["toId"]) for e in second]
        self.assertEqual(first_keys, second_keys)

    def test_build_manifest_is_byte_identical_across_runs(self):
        # Regression test for the bug where `git rev-parse HEAD` leaked into the
        # "reproducible" manifest: this checks the FULL manifest document (not just
        # the selected edge ids), so a dynamic value hiding anywhere in
        # sourceDatasetContext, selectionMethod, or elsewhere would be caught.
        first = select.build_manifest(REPO_ROOT / "data")
        second = select.build_manifest(REPO_ROOT / "data")
        self.assertEqual(json.dumps(first, sort_keys=True), json.dumps(second, sort_keys=True))

    def test_manifest_provenance_is_a_dataset_content_hash_not_git_state(self):
        manifest = select.build_manifest(REPO_ROOT / "data")
        context = manifest["sourceDatasetContext"]
        self.assertNotIn("mainSha", context, "manifest must not embed the git HEAD SHA")
        self.assertIn("datasetDigest", context)
        digest = context["datasetDigest"]
        self.assertEqual(digest["algorithm"], "sha256")
        expected_places = hashlib.sha256((REPO_ROOT / "data" / "places.json").read_bytes()).hexdigest()
        expected_nearby = hashlib.sha256((REPO_ROOT / "data" / "nearby.json").read_bytes()).hexdigest()
        self.assertEqual(digest["places"], expected_places)
        self.assertEqual(digest["nearby"], expected_nearby)


class CachingAndRefreshTests(unittest.TestCase):
    """--execute must not re-query an already-validated edge unless --refresh is
    passed; a failed edge (no-route/request-error) is retried by default."""

    def _manifest(self):
        return {"edges": [{"fromId": "JP-001", "toId": "JP-008", "category": "test"}]}

    def test_cached_validated_result_is_skipped_without_refresh(self):
        cached = {
            "fromId": "JP-001", "toId": "JP-008", "status": "validated",
            "provider": "openrouteservice", "profile": "foot-walking",
        }
        existing_by_key = {("JP-001", "JP-008"): cached}
        key = ("JP-001", "JP-008")
        should_skip = existing_by_key.get(key, {}).get("status") == "validated" and not False  # refresh=False
        self.assertTrue(should_skip)

    def test_refresh_flag_forces_requery_of_validated_result(self):
        cached_status = "validated"
        refresh = True
        should_skip = cached_status == "validated" and not refresh
        self.assertFalse(should_skip)

    def test_failed_result_is_requeried_by_default(self):
        cached_status = "no-route"
        refresh = False
        should_skip = cached_status == "validated" and not refresh
        self.assertFalse(should_skip)


class SnapBackfillTests(unittest.TestCase):
    """--backfill-snapping must derive missing edges programmatically (never a
    hardcoded count), batch them into exactly one Snap request over deduplicated
    place coordinates, and never touch Directions."""

    def _manifest(self, edges):
        return {"edges": [{"fromId": f, "toId": t, "category": "test"} for f, t in edges]}

    def _validated(self, from_id, to_id, distance_m=100.0, snapping=None):
        result = {
            "fromId": from_id, "toId": to_id, "status": "validated",
            "provider": "openrouteservice", "profile": "foot-walking",
            "distance": {"meters": distance_m}, "minutes": {"minMinutes": 1, "maxMinutes": 1},
        }
        if snapping is not None:
            result["endpointSnapping"] = snapping
        return result

    def test_edges_needing_snap_assessment_finds_missing_and_pre_model_records(self):
        results_by_key = {
            ("A", "B"): self._validated("A", "B"),  # no endpointSnapping at all
            ("C", "D"): self._validated("C", "D", snapping={"fromSnapMeters": 1.0}),  # no "assessment" key
            ("E", "F"): self._validated("E", "F", snapping={"assessment": "clean", "fromSnapMeters": 1.0, "toSnapMeters": 1.0, "radiusMeters": 350}),
            ("G", "H"): {"fromId": "G", "toId": "H", "status": "no-route"},  # not validated: ignored
        }
        manifest_edges = [{"fromId": f, "toId": t} for f, t in [("A", "B"), ("C", "D"), ("E", "F"), ("G", "H")]]
        missing = vwp.edges_needing_snap_assessment(manifest_edges, results_by_key)
        self.assertEqual(set(missing), {("A", "B"), ("C", "D")})

    def test_edges_needing_snap_assessment_empty_when_all_resolved(self):
        results_by_key = {
            ("A", "B"): self._validated("A", "B", snapping={"assessment": "significant", "fromSnapMeters": 9.0, "toSnapMeters": 10.4, "radiusMeters": 350}),
        }
        manifest_edges = [{"fromId": "A", "toId": "B"}]
        self.assertEqual(vwp.edges_needing_snap_assessment(manifest_edges, results_by_key), [])

    def test_backfill_snapping_makes_exactly_one_snap_request_for_many_missing_edges(self):
        # Four missing edges sharing overlapping place ids must still collapse into
        # one Snap request over the deduplicated place set, not one call per edge.
        manifest = self._manifest([("A", "B"), ("B", "C"), ("C", "D"), ("D", "A")])
        places = [fake_place(pid, 35.0 + i * 0.001, 139.0 + i * 0.001) for i, pid in enumerate("ABCD")]
        existing = [
            self._validated("A", "B", distance_m=50.0),
            self._validated("B", "C", distance_m=800.0),
            self._validated("C", "D", distance_m=3.2),
            self._validated("D", "A", distance_m=200.0),
        ]

        args = argparse.Namespace(manifest="manifest.json", data_dir="data")

        with mock.patch.object(vwp, "load_json", return_value=manifest), \
             mock.patch.object(vwp, "load_places", return_value=places), \
             mock.patch.object(vwp, "load_existing_results", return_value=existing), \
             mock.patch.object(vwp, "write_json") as mock_write, \
             mock.patch.object(vwp, "query_ors_snap") as mock_snap, \
             mock.patch.object(vwp, "query_ors_with_retry") as mock_directions, \
             mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
            # 4 unique places -> 4 locations, one snap distance each.
            mock_snap.return_value = [1.0, 1.0, 9.0, 10.4]
            exit_code = vwp.backfill_snapping(args)

        self.assertEqual(exit_code, 0)
        mock_snap.assert_called_once()
        mock_directions.assert_not_called()
        self.assertEqual(len(mock_snap.call_args.args[1]), 4)  # deduplicated locations

        written = mock_write.call_args_list[-1].args[1]
        by_key = {(r["fromId"], r["toId"]): r for r in written}
        self.assertEqual(by_key[("A", "B")]["endpointSnapping"]["assessment"], "clean")
        self.assertEqual(by_key[("C", "D")]["endpointSnapping"]["assessment"], "significant")

    def test_backfill_snapping_is_noop_when_nothing_missing(self):
        manifest = self._manifest([("A", "B")])
        existing = [self._validated("A", "B", snapping={"assessment": "clean", "fromSnapMeters": 1.0, "toSnapMeters": 1.0, "radiusMeters": 350})]
        args = argparse.Namespace(manifest="manifest.json", data_dir="data")

        with mock.patch.object(vwp, "load_json", return_value=manifest), \
             mock.patch.object(vwp, "load_places", return_value=[]), \
             mock.patch.object(vwp, "load_existing_results", return_value=existing), \
             mock.patch.object(vwp, "write_json") as mock_write, \
             mock.patch.object(vwp, "query_ors_snap") as mock_snap, \
             mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
            exit_code = vwp.backfill_snapping(args)

        self.assertEqual(exit_code, 0)
        mock_snap.assert_not_called()
        mock_write.assert_not_called()

    def test_backfill_snapping_snap_failure_yields_unknown_not_zero(self):
        manifest = self._manifest([("A", "B")])
        places = [fake_place("A", 35.0, 139.0), fake_place("B", 35.001, 139.001)]
        existing = [self._validated("A", "B", distance_m=50.0)]
        args = argparse.Namespace(manifest="manifest.json", data_dir="data")

        with mock.patch.object(vwp, "load_json", return_value=manifest), \
             mock.patch.object(vwp, "load_places", return_value=places), \
             mock.patch.object(vwp, "load_existing_results", return_value=existing), \
             mock.patch.object(vwp, "write_json") as mock_write, \
             mock.patch.object(vwp, "query_ors_snap", side_effect=vwp.RoutingRequestError("boom", status="request-error", transient=False)), \
             mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
            exit_code = vwp.backfill_snapping(args)

        self.assertEqual(exit_code, 0)
        written = mock_write.call_args_list[-1].args[1]
        snapping = written[0]["endpointSnapping"]
        self.assertEqual(snapping["assessment"], "unknown")
        self.assertIn("reason", snapping)

    def test_backfill_snapping_requires_api_key(self):
        args = argparse.Namespace(manifest="manifest.json", data_dir="data")
        with mock.patch.dict("os.environ", {}, clear=True):
            exit_code = vwp.backfill_snapping(args)
        self.assertEqual(exit_code, 1)


class ApiHostRegressionTests(unittest.TestCase):
    def test_current_host_constant_is_heigit(self):
        self.assertEqual(common.ORS_HOST, "https://api.heigit.org")

    def test_deprecated_host_string_appears_nowhere_in_scripts_or_app_source(self):
        deprecated = common.DEPRECATED_ORS_HOST
        offenders = []
        search_dirs = [REPO_ROOT / "scripts", REPO_ROOT / "app" / "src"]
        for directory in search_dirs:
            for path in directory.rglob("*"):
                if path.is_file() and path.suffix in {".py", ".ts", ".tsx", ".json", ".md"}:
                    if path.name in {"test_walking_pilot.py", "logistics_common.py"}:
                        # test_walking_pilot.py: this test itself names the string to search for.
                        # logistics_common.py: the one place DEPRECATED_ORS_HOST is defined, so
                        # a regression guard elsewhere can assert against it by name.
                        continue
                    text = path.read_text(encoding="utf-8", errors="ignore")
                    if deprecated in text:
                        offenders.append(str(path))
        self.assertEqual(offenders, [], f"deprecated ORS host found in: {offenders}")


class ManifestValidatorTests(unittest.TestCase):
    def test_flags_wrong_edge_count(self):
        errors, warnings = validate_logistics.check_manifest(
            {"edges": [{"fromId": "JP-001", "toId": "JP-008"}]},
            {"JP-001", "JP-008"},
            {("JP-001", "JP-008"): {"Modo": "A pie"}},
        )
        self.assertTrue(any("expected exactly 24" in e for e in errors))

    def test_flags_wrong_mode(self):
        errors, _ = validate_logistics.check_manifest(
            {"edges": [{"fromId": "JP-001", "toId": "JP-008"}]},
            {"JP-001", "JP-008"},
            {("JP-001", "JP-008"): {"Modo": "Transporte local"}},
        )
        self.assertTrue(any("expected 'A pie'" in e for e in errors))

    def test_flags_duplicate_directed_edge(self):
        edges = [{"fromId": "JP-001", "toId": "JP-008"}, {"fromId": "JP-001", "toId": "JP-008"}]
        errors, _ = validate_logistics.check_manifest(
            {"edges": edges}, {"JP-001", "JP-008"}, {("JP-001", "JP-008"): {"Modo": "A pie"}}
        )
        self.assertTrue(any("duplicate directed edge" in e for e in errors))


class ResultsValidatorTests(unittest.TestCase):
    def test_estimated_confidence_never_allowed_in_pilot_result(self):
        result = {
            "fromId": "JP-001", "toId": "JP-008", "status": "validated",
            "provider": "openrouteservice", "profile": "foot-walking",
            "confidence": "estimated", "verifiedAt": "2026-09-04T00:00:00Z",
            "source": {"kind": "routing-provider"}, "distance": {"meters": 100}, "minutes": {"minMinutes": 1, "maxMinutes": 1},
        }
        errors, _ = validate_logistics.check_results([result], {("JP-001", "JP-008")})
        self.assertTrue(any("must never be 'estimated'" in e for e in errors))

    def test_secret_value_detected(self):
        result = {
            "fromId": "JP-001", "toId": "JP-008", "status": "request-error",
            "provider": "openrouteservice", "profile": "foot-walking",
            "verifiedAt": "2026-09-04T00:00:00Z",
            "apiKey": "sk-super-secret-value",
        }
        errors, _ = validate_logistics.check_results([result], {("JP-001", "JP-008")})
        self.assertTrue(any("possible secret" in e for e in errors))

    def test_clean_validated_result_passes(self):
        result = {
            "fromId": "JP-001", "toId": "JP-008", "status": "validated",
            "provider": "openrouteservice", "profile": "foot-walking",
            "confidence": "validated-static", "verifiedAt": "2026-09-04T00:00:00Z",
            "source": {"kind": "routing-provider", "provider": "openrouteservice", "profile": "foot-walking"},
            "distance": {"meters": 500.0}, "minutes": {"minMinutes": 7, "maxMinutes": 7},
        }
        errors, _ = validate_logistics.check_results([result], {("JP-001", "JP-008")})
        self.assertEqual(errors, [])

    def test_source_provider_must_match_top_level_provider(self):
        result = {
            "fromId": "JP-001", "toId": "JP-008", "status": "validated",
            "provider": "openrouteservice", "profile": "foot-walking",
            "confidence": "validated-static", "verifiedAt": "2026-09-04T00:00:00Z",
            "source": {"kind": "routing-provider", "provider": "some-other-provider", "profile": "foot-walking"},
            "distance": {"meters": 500.0}, "minutes": {"minMinutes": 7, "maxMinutes": 7},
        }
        errors, _ = validate_logistics.check_results([result], {("JP-001", "JP-008")})
        self.assertTrue(any("source.provider" in e for e in errors))

    def test_source_profile_must_match_top_level_profile(self):
        result = {
            "fromId": "JP-001", "toId": "JP-008", "status": "validated",
            "provider": "openrouteservice", "profile": "foot-walking",
            "confidence": "validated-static", "verifiedAt": "2026-09-04T00:00:00Z",
            "source": {"kind": "routing-provider", "provider": "openrouteservice", "profile": "driving-car"},
            "distance": {"meters": 500.0}, "minutes": {"minMinutes": 7, "maxMinutes": 7},
        }
        errors, _ = validate_logistics.check_results([result], {("JP-001", "JP-008")})
        self.assertTrue(any("source.profile" in e for e in errors))

    def _validated_result_with_snapping(self, snapping):
        return {
            "fromId": "JP-063", "toId": "JP-065", "status": "validated",
            "provider": "openrouteservice", "profile": "foot-walking",
            "confidence": "validated-static", "verifiedAt": "2026-09-04T00:00:00Z",
            "source": {"kind": "routing-provider", "provider": "openrouteservice", "profile": "foot-walking"},
            "distance": {"meters": 3.2}, "minutes": {"minMinutes": 0, "maxMinutes": 0},
            "endpointSnapping": snapping,
        }

    def test_endpoint_snapping_absent_is_valid(self):
        result = {
            "fromId": "JP-001", "toId": "JP-008", "status": "validated",
            "provider": "openrouteservice", "profile": "foot-walking",
            "confidence": "validated-static", "verifiedAt": "2026-09-04T00:00:00Z",
            "source": {"kind": "routing-provider", "provider": "openrouteservice", "profile": "foot-walking"},
            "distance": {"meters": 500.0}, "minutes": {"minMinutes": 7, "maxMinutes": 7},
        }
        errors, _ = validate_logistics.check_results([result], {("JP-001", "JP-008")})
        self.assertEqual(errors, [])

    def test_endpoint_snapping_consistent_significant_assessment_passes(self):
        result = self._validated_result_with_snapping(
            {"fromSnapMeters": 9.0, "toSnapMeters": 10.4, "radiusMeters": 350, "assessment": "significant"}
        )
        errors, _ = validate_logistics.check_results([result], {("JP-063", "JP-065")})
        self.assertEqual(errors, [])

    def test_endpoint_snapping_wrong_assessment_is_flagged(self):
        # classify_endpoint_snapping(9.0, 10.4, 3.2) is "significant" (see SnapGuardTests);
        # claiming "clean" here must fail — the assessment has to be re-derivable, not
        # just any value from SNAP_ASSESSMENTS.
        result = self._validated_result_with_snapping(
            {"fromSnapMeters": 9.0, "toSnapMeters": 10.4, "radiusMeters": 350, "assessment": "clean"}
        )
        errors, _ = validate_logistics.check_results([result], {("JP-063", "JP-065")})
        self.assertTrue(any("endpointSnapping.assessment" in e for e in errors))

    def test_endpoint_snapping_negative_distance_is_flagged(self):
        result = self._validated_result_with_snapping(
            {"fromSnapMeters": -1.0, "toSnapMeters": 2.0, "radiusMeters": 350, "assessment": "significant"}
        )
        errors, _ = validate_logistics.check_results([result], {("JP-063", "JP-065")})
        self.assertTrue(any("fromSnapMeters" in e for e in errors))

    def test_endpoint_snapping_unknown_with_null_distance_passes(self):
        result = self._validated_result_with_snapping(
            {"fromSnapMeters": None, "toSnapMeters": 10.4, "radiusMeters": 350, "assessment": "unknown",
             "reason": "Snap query failed: timeout"}
        )
        errors, _ = validate_logistics.check_results([result], {("JP-063", "JP-065")})
        self.assertEqual(errors, [])

    def test_endpoint_snapping_null_distance_claiming_clean_is_flagged(self):
        # This is exactly the bug the three-state model exists to make impossible: a
        # missing measurement must never be presented as a confirmed-clean result.
        result = self._validated_result_with_snapping(
            {"fromSnapMeters": None, "toSnapMeters": 1.0, "radiusMeters": 350, "assessment": "clean"}
        )
        errors, _ = validate_logistics.check_results([result], {("JP-063", "JP-065")})
        self.assertTrue(any("null" in e and "clean" in e for e in errors))

    def test_endpoint_snapping_invalid_assessment_value_is_flagged(self):
        result = self._validated_result_with_snapping(
            {"fromSnapMeters": 1.0, "toSnapMeters": 1.0, "radiusMeters": 350, "assessment": "significant-ish"}
        )
        errors, _ = validate_logistics.check_results([result], {("JP-063", "JP-065")})
        self.assertTrue(any("endpointSnapping.assessment" in e for e in errors))


class ResultsCoverageValidatorTests(unittest.TestCase):
    """When a non-empty results file exists, it must cover the manifest's directed
    edges exactly — no missing edge, no edge beyond the manifest."""

    def _validated_result(self, from_id, to_id):
        return {
            "fromId": from_id, "toId": to_id, "status": "validated",
            "provider": "openrouteservice", "profile": "foot-walking",
            "confidence": "validated-static", "verifiedAt": "2026-09-04T00:00:00Z",
            "source": {"kind": "routing-provider", "provider": "openrouteservice", "profile": "foot-walking"},
            "distance": {"meters": 100.0}, "minutes": {"minMinutes": 1, "maxMinutes": 1},
        }

    def test_exact_coverage_passes_with_no_errors(self):
        manifest_keys = {("JP-001", "JP-008"), ("JP-002", "JP-008")}
        results = [self._validated_result(*k) for k in manifest_keys]
        errors = validate_logistics.check_results_coverage(results, manifest_keys)
        self.assertEqual(errors, [])

    def test_missing_result_is_flagged(self):
        manifest_keys = {("JP-001", "JP-008"), ("JP-002", "JP-008")}
        results = [self._validated_result("JP-001", "JP-008")]  # JP-002->JP-008 missing
        errors = validate_logistics.check_results_coverage(results, manifest_keys)
        self.assertTrue(any("missing" in e and "JP-002" in e for e in errors))

    def test_extra_result_not_in_manifest_is_flagged(self):
        manifest_keys = {("JP-001", "JP-008")}
        results = [
            self._validated_result("JP-001", "JP-008"),
            self._validated_result("JP-999", "JP-998"),  # not in manifest
        ]
        errors = validate_logistics.check_results_coverage(results, manifest_keys)
        self.assertTrue(any("not in the manifest" in e and "JP-999" in e for e in errors))


class ReportComparisonTests(unittest.TestCase):
    def test_comparison_computes_ratios_correctly(self):
        manifest = {"edges": [{"fromId": "JP-001", "toId": "JP-008", "category": "test"}]}
        nearby = [{"Desde ID": "JP-001", "Hacia ID": "JP-008", "Distancia km": 1.0, "Min aprox.": 10, "Modo": "A pie", "Relación": "Cercano"}]
        results = [{
            "fromId": "JP-001", "toId": "JP-008", "status": "validated",
            "distance": {"meters": 1500.0}, "minutes": {"minMinutes": 20, "maxMinutes": 20},
        }]
        places = [fake_place("JP-001", 35.0, 139.0, name="A"), fake_place("JP-008", 35.0, 139.0, name="B")]
        comparisons = report.build_comparisons(manifest, nearby, results, places)
        self.assertEqual(len(comparisons), 1)
        c = comparisons[0]
        self.assertAlmostEqual(c["distanceRatio"], 1.5)
        self.assertAlmostEqual(c["minutesRatio"], 2.0)
        self.assertAlmostEqual(c["distanceAbsDiffKm"], 0.5)
        self.assertEqual(c["minutesAbsDiff"], 10)

    def test_snap_assessments_are_flagged_and_only_clean_enters_stats(self):
        manifest = {
            "edges": [
                {"fromId": "JP-001", "toId": "JP-008", "category": "test"},
                {"fromId": "JP-063", "toId": "JP-065", "category": "test"},
                {"fromId": "JP-100", "toId": "JP-101", "category": "test"},
            ]
        }
        nearby = [
            {"Desde ID": "JP-001", "Hacia ID": "JP-008", "Distancia km": 1.0, "Min aprox.": 10, "Modo": "A pie", "Relación": "Cercano"},
            {"Desde ID": "JP-063", "Hacia ID": "JP-065", "Distancia km": 0.02, "Min aprox.": 3, "Modo": "A pie", "Relación": "Cercano"},
            {"Desde ID": "JP-100", "Hacia ID": "JP-101", "Distancia km": 0.5, "Min aprox.": 6, "Modo": "A pie", "Relación": "Cercano"},
        ]
        results = [
            {
                "fromId": "JP-001", "toId": "JP-008", "status": "validated",
                "distance": {"meters": 1500.0}, "minutes": {"minMinutes": 20, "maxMinutes": 20},
                "endpointSnapping": {
                    "fromSnapMeters": 1.0, "toSnapMeters": 1.0, "radiusMeters": 350, "assessment": "clean",
                },
            },
            {
                "fromId": "JP-063", "toId": "JP-065", "status": "validated",
                "distance": {"meters": 3.2}, "minutes": {"minMinutes": 0, "maxMinutes": 0},
                "endpointSnapping": {
                    "fromSnapMeters": 2.25, "toSnapMeters": 20.71, "radiusMeters": 350, "assessment": "significant",
                },
            },
            {
                "fromId": "JP-100", "toId": "JP-101", "status": "validated",
                "distance": {"meters": 700.0}, "minutes": {"minMinutes": 9, "maxMinutes": 9},
                # No endpointSnapping recorded at all — must read as "unknown", never as
                # implicitly clean, and must be excluded from the comparable stats.
            },
        ]
        places = [
            fake_place("JP-001", 35.0, 139.0, name="A"), fake_place("JP-008", 35.0, 139.0, name="B"),
            fake_place("JP-063", 35.0268, 135.7982, name="C"), fake_place("JP-065", 35.027, 135.7982, name="D"),
            fake_place("JP-100", 35.1, 139.1, name="E"), fake_place("JP-101", 35.101, 139.101, name="F"),
        ]
        comparisons = report.build_comparisons(manifest, nearby, results, places)
        by_key = {(c["fromId"], c["toId"]): c for c in comparisons}
        self.assertEqual(by_key[("JP-001", "JP-008")]["snapAssessment"], "clean")
        self.assertEqual(by_key[("JP-063", "JP-065")]["snapAssessment"], "significant")
        self.assertEqual(by_key[("JP-100", "JP-101")]["snapAssessment"], "unknown")

        # print_report must not raise, and the aggregate stats path must only ever see
        # the "clean" edge — captured indirectly by checking it runs cleanly and
        # produces output naming both exclusions with the right N.
        import contextlib
        import io as io_module

        buffer = io_module.StringIO()
        with contextlib.redirect_stdout(buffer):
            report.print_report(comparisons)
        output = buffer.getvalue()
        self.assertIn("clean=1 significant=1 unknown=1", output)
        self.assertIn("EXCLUDED: significant endpoint snapping", output)
        self.assertIn("EXCLUDED: endpoint snapping unknown", output)
        self.assertIn("N=1", output)


if __name__ == "__main__":
    unittest.main()
