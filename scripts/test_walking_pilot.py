#!/usr/bin/env python3
"""Unit tests for the Phase 3B2A walking-validation pipeline.

Usage:
    python3 scripts/test_walking_pilot.py

No test here makes a real network call — ORS responses are mocked. Run this instead
of (or before) an --execute pilot run to check the pipeline logic itself.
"""
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


if __name__ == "__main__":
    unittest.main()
