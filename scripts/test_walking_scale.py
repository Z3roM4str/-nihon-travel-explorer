#!/usr/bin/env python3
"""Unit tests for the Phase 3B2B-A walking scale-up preparation pipeline.

Usage:
    python3 scripts/test_walking_scale.py

No test here makes a real network call. Covers: scale-manifest derivation (pilot +
scale == every 'A pie' relation, no overlap, no duplicates, no non-walking edge), the
per-place Snap store schema and seeding, the dry-run/backfill/execute/recombine
pipeline logic (mocked network), and the classify_endpoint_snapping threshold-audit
seam (per-endpoint absolute cap, disabled by default).
"""
import argparse
import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))


def load_module(filename, name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


common = load_module("logistics_common.py", "logistics_common")
ors_client = load_module("ors_client.py", "ors_client")
select_scale = load_module("select-walking-scale.py", "select_walking_scale")
seed_snap = load_module("seed-walking-snap-store.py", "seed_walking_snap_store")
vws = load_module("validate-walking-scale.py", "validate_walking_scale")
validate_logistics = load_module("validate-logistics.py", "validate_logistics")


def fake_place(place_id, lat, lng, hub="Tokio", cluster="Test"):
    return {"id": place_id, "hub": hub, "cluster": cluster, "coordinates": {"lat": lat, "lng": lng}}


def nearby_row(from_id, to_id, km=0.5, minutes=7, modo="A pie", relacion="Cercano"):
    return {
        "Desde ID": from_id, "Hacia ID": to_id, "Desde": from_id, "Hacia": to_id,
        "Distancia km": km, "Min aprox.": minutes, "Modo": modo, "Relación": relacion,
        "Nota": "",
    }


def write_dataset(tmp_path, places, nearby):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "places.json").write_text(json.dumps(places), encoding="utf-8")
    (data_dir / "nearby.json").write_text(json.dumps(nearby), encoding="utf-8")
    return data_dir


def scale_args(**overrides):
    """Every CLI flag validate-walking-scale.py's modes read, with the defaults argparse
    would produce — so a test only states the flags it actually cares about."""
    defaults = {
        "manifest": "manifest.json",
        "data_dir": "data",
        "snap_places": None,
        "refresh": False,
        "refresh_snap_places": False,
        "retry_no_snap": False,
        "allow_unknown_snap": False,
        "directions_per_minute": common.ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED,
    }
    defaults.update(overrides)
    return argparse.Namespace(**defaults)


class FakeClock:
    """Monotonic clock + sleep pair for testing pacing with zero real waiting: sleep()
    simply advances the time the clock reports, so a limiter's own arithmetic is what
    gets exercised rather than the OS scheduler."""

    def __init__(self, start=0.0):
        self.now = start
        self.sleeps = []

    def time(self):
        return self.now

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds

    def advance(self, seconds):
        self.now += seconds


class ClassifyThresholdAuditSeamTests(unittest.TestCase):
    """The optional per-endpoint absolute cap added for the threshold audit (Phase
    3B2B-A): OFF by default, so it must never change any already-computed Phase 3B2A
    classification unless a caller explicitly opts in."""

    def test_default_is_disabled_and_matches_prior_behavior(self):
        self.assertIsNone(common.SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS)
        # The real JP-184->JP-185 case: one endpoint snapped 139.31 m, but stays
        # "clean" under the default (disabled) cap because the combined/ratio rule
        # doesn't fire on a long route.
        self.assertEqual(common.classify_endpoint_snapping(13.9, 139.31, 1314.1), "clean")

    def test_explicit_cap_can_flag_a_case_the_default_calls_clean(self):
        self.assertEqual(
            common.classify_endpoint_snapping(13.9, 139.31, 1314.1, per_endpoint_absolute_cap_meters=100.0),
            "significant",
        )

    def test_explicit_cap_never_overrides_unknown(self):
        # A None measurement is unknown regardless of any absolute cap.
        self.assertEqual(
            common.classify_endpoint_snapping(None, 139.31, 1314.1, per_endpoint_absolute_cap_meters=100.0),
            "unknown",
        )

    def test_explicit_cap_below_both_endpoints_still_clean(self):
        self.assertEqual(
            common.classify_endpoint_snapping(2.0, 3.0, 100.0, per_endpoint_absolute_cap_meters=100.0),
            "clean",
        )


class SnapPlaceStoreTests(unittest.TestCase):
    def test_build_snap_place_entry_resolved_shape(self):
        place = fake_place("JP-001", 35.0, 139.0)
        entry = common.build_snap_place_entry(place, 5.5, 350, "openrouteservice", "foot-walking", "2026-09-04T00:00:00Z")
        self.assertEqual(entry["status"], "resolved")
        self.assertEqual(entry["snappedDistanceMeters"], 5.5)
        self.assertEqual(entry["coordinates"], {"lat": 35.0, "lng": 139.0})
        self.assertNotIn("reason", entry)

    def test_build_snap_place_entry_none_defaults_to_no_snap_never_zero(self):
        place = fake_place("JP-001", 35.0, 139.0)
        entry = common.build_snap_place_entry(
            place, None, 350, "openrouteservice", "foot-walking", "2026-09-04T00:00:00Z",
            reason="no routable point within 350 m",
        )
        self.assertEqual(entry["status"], common.SNAP_PLACE_STATUS_NO_SNAP)
        self.assertIsNone(entry["snappedDistanceMeters"])
        self.assertNotEqual(entry["snappedDistanceMeters"], 0)

    def test_build_snap_place_entry_request_error_is_distinct_from_no_snap(self):
        place = fake_place("JP-001", 35.0, 139.0)
        entry = common.build_snap_place_entry(
            place, None, 350, "openrouteservice", "foot-walking", "2026-09-04T00:00:00Z",
            status=common.SNAP_PLACE_STATUS_REQUEST_ERROR, reason="Snap request failed: HTTP 503",
        )
        self.assertEqual(entry["status"], common.SNAP_PLACE_STATUS_REQUEST_ERROR)
        self.assertNotEqual(entry["status"], common.SNAP_PLACE_STATUS_NO_SNAP)
        self.assertIsNone(entry["snappedDistanceMeters"])

    def test_build_snap_place_entry_refuses_resolved_without_a_measurement(self):
        place = fake_place("JP-001", 35.0, 139.0)
        with self.assertRaises(ValueError):
            common.build_snap_place_entry(
                place, None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_RESOLVED
            )

    def test_build_snap_place_entry_refuses_a_measurement_on_a_failed_status(self):
        place = fake_place("JP-001", 35.0, 139.0)
        for status in (common.SNAP_PLACE_STATUS_NO_SNAP, common.SNAP_PLACE_STATUS_REQUEST_ERROR):
            with self.assertRaises(ValueError):
                common.build_snap_place_entry(place, 5.0, 350, "p", "prof", "t", status=status)

    def test_is_snap_entry_current_true_for_matching_coordinates(self):
        place = fake_place("JP-001", 35.0, 139.0)
        entry = common.build_snap_place_entry(place, 5.5, 350, "p", "profile", "t")
        self.assertTrue(common.is_snap_entry_current(entry, place))

    def test_is_snap_entry_current_false_when_place_moved(self):
        place = fake_place("JP-001", 35.0, 139.0)
        entry = common.build_snap_place_entry(place, 5.5, 350, "p", "profile", "t")
        moved_place = fake_place("JP-001", 35.001, 139.0)
        self.assertFalse(common.is_snap_entry_current(entry, moved_place))

    def test_load_snap_places_store_missing_file_is_empty_not_error(self):
        store = common.load_snap_places_store(Path("/nonexistent/does-not-exist.json"))
        self.assertEqual(store["places"], {})


class SnapCoverageClassificationTests(unittest.TestCase):
    """The five machine-readable coverage states, decided without ever reading a
    `reason` string. A "current" entry is not automatically a successful one."""

    def setUp(self):
        self.place = fake_place("A", 35.0, 139.0)
        self.by_id = {"A": self.place}

    def _store(self, entry):
        return {"places": {"A": entry}} if entry is not None else {"places": {}}

    def test_missing_entry_is_missing(self):
        self.assertEqual(common.classify_snap_coverage("A", self.place, self._store(None)), "missing")

    def test_resolved_entry_is_resolved(self):
        entry = common.build_snap_place_entry(self.place, 5.0, 350, "p", "prof", "t")
        self.assertEqual(common.classify_snap_coverage("A", self.place, self._store(entry)), "resolved")

    def test_no_snap_entry_is_not_counted_as_resolved_despite_current_coordinates(self):
        entry = common.build_snap_place_entry(
            self.place, None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_NO_SNAP
        )
        self.assertTrue(common.is_snap_entry_current(entry, self.place))  # coordinates ARE current
        self.assertEqual(common.classify_snap_coverage("A", self.place, self._store(entry)), "no-snap")

    def test_request_error_entry_is_not_counted_as_resolved_despite_current_coordinates(self):
        entry = common.build_snap_place_entry(
            self.place, None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_REQUEST_ERROR
        )
        self.assertTrue(common.is_snap_entry_current(entry, self.place))
        self.assertEqual(common.classify_snap_coverage("A", self.place, self._store(entry)), "request-error")

    def test_stale_outranks_status(self):
        measured_at = fake_place("A", 40.0, 140.0)
        entry = common.build_snap_place_entry(measured_at, 5.0, 350, "p", "prof", "t")
        self.assertEqual(common.classify_snap_coverage("A", self.place, self._store(entry)), "stale")

    def test_unrecognised_status_is_treated_as_missing_not_guessed(self):
        entry = {"coordinates": {"lat": 35.0, "lng": 139.0}, "status": "probably-fine", "snappedDistanceMeters": 5.0}
        self.assertEqual(common.classify_snap_coverage("A", self.place, self._store(entry)), "missing")

    def test_summary_reports_every_state_even_when_empty(self):
        entry = common.build_snap_place_entry(self.place, 5.0, 350, "p", "prof", "t")
        summary = common.snap_coverage_summary(["A"], self.by_id, self._store(entry))
        self.assertEqual(set(summary.keys()), set(common.SNAP_COVERAGE_STATES))
        self.assertEqual(summary["resolved"], ["A"])
        self.assertEqual(summary["no-snap"], [])


class DirectionsRateLimiterTests(unittest.TestCase):
    """Real pacing, verified with a fake clock so no test waits for anything. The
    limiter must gate every HTTP attempt including retries, and must not depend on
    HTTP 429 to stay under the ceiling."""

    def test_allows_up_to_the_limit_without_sleeping(self):
        clock = FakeClock()
        limiter = ors_client.RateLimiter(3, 60.0, clock=clock.time, sleep=clock.sleep)
        for _ in range(3):
            limiter.acquire()
        self.assertEqual(clock.sleeps, [])
        self.assertEqual(clock.now, 0.0)

    def test_sleeps_exactly_until_the_oldest_event_leaves_the_window(self):
        clock = FakeClock()
        limiter = ors_client.RateLimiter(2, 60.0, clock=clock.time, sleep=clock.sleep)
        limiter.acquire()          # t=0
        clock.advance(10.0)
        limiter.acquire()          # t=10
        limiter.acquire()          # window full: must wait until t=60 (the t=0 event ages out)
        self.assertEqual(clock.sleeps, [50.0])
        self.assertEqual(clock.now, 60.0)

    def test_never_exceeds_the_configured_rate_over_a_long_run(self):
        clock = FakeClock()
        limiter = ors_client.RateLimiter(40, 60.0, clock=clock.time, sleep=clock.sleep)
        stamps = []
        for _ in range(200):
            limiter.acquire()
            stamps.append(clock.now)
        # For every 60-second window anchored at an attempt, at most 40 attempts.
        for start in stamps:
            in_window = [t for t in stamps if start <= t < start + 60.0]
            self.assertLessEqual(len(in_window), 40, f"window starting {start} had {len(in_window)} attempts")

    def test_zero_or_negative_max_disables_pacing_explicitly(self):
        clock = FakeClock()
        for disabled in (0, -1):
            limiter = ors_client.RateLimiter(disabled, 60.0, clock=clock.time, sleep=clock.sleep)
            for _ in range(100):
                limiter.acquire()
        self.assertEqual(clock.sleeps, [])

    def test_retries_consume_rate_limiter_slots_too(self):
        """The bounded retry goes back through query_ors, so a retried edge costs two
        paced slots — a retry must never be an unpaced extra call."""
        clock = FakeClock()
        limiter = ors_client.RateLimiter(2, 60.0, clock=clock.time, sleep=clock.sleep)
        transient = ors_client.RoutingRequestError("boom", status="request-error", transient=True)
        calls = []

        def fake_query_ors(api_key, from_place, to_place, rate_limiter=None):
            if rate_limiter is not None:
                rate_limiter.acquire()
            calls.append(clock.now)
            raise transient

        with mock.patch.object(ors_client, "query_ors", fake_query_ors):
            outcome, error = ors_client.query_ors_with_retry(
                "key", fake_place("A", 35.0, 139.0), fake_place("B", 35.1, 139.1),
                rate_limiter=limiter, sleep=clock.sleep,
            )

        self.assertIsNone(outcome)
        self.assertIs(error, transient)
        self.assertEqual(len(calls), 2)  # first attempt + exactly one bounded retry
        # Both attempts were paced: the limiter recorded two events, so a third call in
        # the same window would have to wait.
        self.assertEqual(len(limiter._events), 2)

    def test_query_ors_acquires_the_limiter_before_the_http_call(self):
        clock = FakeClock()
        limiter = ors_client.RateLimiter(1, 60.0, clock=clock.time, sleep=clock.sleep)
        body = json.dumps({"routes": [{"summary": {"distance": 100.0, "duration": 60.0}}]}).encode("utf-8")
        response = mock.MagicMock()
        response.read.return_value = body
        response.__enter__.return_value = response
        response.__exit__.return_value = False

        acquisitions = []
        original_acquire = limiter.acquire

        def tracking_acquire():
            acquisitions.append("acquired")
            original_acquire()

        limiter.acquire = tracking_acquire

        def urlopen(*args, **kwargs):
            self.assertEqual(acquisitions, ["acquired"])  # paced BEFORE the request went out
            return response

        with mock.patch.object(ors_client.urllib.request, "urlopen", urlopen):
            ors_client.query_ors("key", fake_place("A", 35.0, 139.0), fake_place("B", 35.1, 139.1), rate_limiter=limiter)
        self.assertEqual(acquisitions, ["acquired"])

    def test_default_is_unpaced_so_the_pilot_pipeline_is_unchanged(self):
        # Phase 3B2A's pilot passes no limiter; query_ors must not invent one.
        body = json.dumps({"routes": [{"summary": {"distance": 100.0, "duration": 60.0}}]}).encode("utf-8")
        response = mock.MagicMock()
        response.read.return_value = body
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        with mock.patch.object(ors_client.urllib.request, "urlopen", return_value=response):
            distance, duration = ors_client.query_ors(
                "key", fake_place("A", 35.0, 139.0), fake_place("B", 35.1, 139.1)
            )
        self.assertEqual((distance, duration), (100.0, 60.0))


class SnapRetryTests(unittest.TestCase):
    def _http_error(self, code):
        import io as io_module
        import urllib.error

        return urllib.error.HTTPError(url="x", code=code, msg="err", hdrs=None, fp=io_module.BytesIO(b"{}"))

    def test_transient_snap_failure_is_retried_once_then_reported(self):
        clock = FakeClock()
        with mock.patch.object(
            ors_client.urllib.request, "urlopen", side_effect=[self._http_error(503), self._http_error(503)]
        ) as urlopen:
            distances, error = ors_client.query_ors_snap_with_retry("key", [[139.0, 35.0]], sleep=clock.sleep)
        self.assertIsNone(distances)
        self.assertEqual(error.status, "request-error")
        self.assertEqual(urlopen.call_count, 2)  # first attempt + one bounded retry

    def test_transient_snap_failure_that_recovers_returns_distances(self):
        clock = FakeClock()
        body = json.dumps({"locations": [{"snapped_distance": 4.2}]}).encode("utf-8")
        response = mock.MagicMock()
        response.read.return_value = body
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        with mock.patch.object(
            ors_client.urllib.request, "urlopen", side_effect=[self._http_error(429), response]
        ):
            distances, error = ors_client.query_ors_snap_with_retry("key", [[139.0, 35.0]], sleep=clock.sleep)
        self.assertIsNone(error)
        self.assertEqual(distances, [4.2])

    def test_non_transient_snap_failure_is_not_retried(self):
        clock = FakeClock()
        with mock.patch.object(
            ors_client.urllib.request, "urlopen", side_effect=self._http_error(401)
        ) as urlopen:
            distances, error = ors_client.query_ors_snap_with_retry("key", [[139.0, 35.0]], sleep=clock.sleep)
        self.assertIsNone(distances)
        self.assertEqual(urlopen.call_count, 1)
        self.assertEqual(error.status, "request-error")


class ScaleManifestDerivationTests(unittest.TestCase):
    """pilot ∪ scale == every current 'A pie' relation; 0 overlap; 0 duplicates;
    never a non-walking relation; never a hardcoded edge count."""

    def _fixture(self, tmp_path):
        places = [fake_place(f"JP-{i:03d}", 35.0 + i * 0.001, 139.0 + i * 0.001) for i in range(1, 7)]
        nearby = [
            nearby_row("JP-001", "JP-002"),
            nearby_row("JP-002", "JP-001"),
            nearby_row("JP-003", "JP-004"),
            nearby_row("JP-004", "JP-005"),
            nearby_row("JP-005", "JP-006"),
            nearby_row("JP-001", "JP-006", modo="Transporte local"),  # non-walking: excluded entirely
        ]
        data_dir = write_dataset(tmp_path, places, nearby)
        pilot_manifest = {
            "pilotVersion": 1,
            "edges": [{"fromId": "JP-001", "toId": "JP-002", "category": "test"}],
        }
        pilot_path = tmp_path / "pilot-manifest.json"
        pilot_path.write_text(json.dumps(pilot_manifest), encoding="utf-8")
        return data_dir, pilot_path

    def test_scale_manifest_is_every_walking_edge_minus_pilot(self, tmp_path=None):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, pilot_path = self._fixture(tmp_path)
            with mock.patch.object(select_scale, "PILOT_EDGE_COUNT", 1):
                manifest = select_scale.build_scale_manifest(data_dir, pilot_path)
            scale_keys = {(e["fromId"], e["toId"]) for e in manifest["edges"]}
            self.assertEqual(scale_keys, {("JP-002", "JP-001"), ("JP-003", "JP-004"), ("JP-004", "JP-005"), ("JP-005", "JP-006")})
            # Non-walking edge never appears on either side.
            self.assertNotIn(("JP-001", "JP-006"), scale_keys)

    def test_pilot_and_scale_together_equal_every_walking_edge_with_zero_overlap(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, pilot_path = self._fixture(tmp_path)
            nearby = json.loads((data_dir / "nearby.json").read_text())
            walking_keys = {(r["Desde ID"], r["Hacia ID"]) for r in nearby if r["Modo"] == "A pie"}
            pilot_keys = {("JP-001", "JP-002")}
            with mock.patch.object(select_scale, "PILOT_EDGE_COUNT", 1):
                manifest = select_scale.build_scale_manifest(data_dir, pilot_path)
            scale_keys = {(e["fromId"], e["toId"]) for e in manifest["edges"]}
            self.assertEqual(pilot_keys | scale_keys, walking_keys)
            self.assertEqual(pilot_keys & scale_keys, set())

    def test_no_duplicate_edges_in_scale_manifest(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, pilot_path = self._fixture(tmp_path)
            with mock.patch.object(select_scale, "PILOT_EDGE_COUNT", 1):
                manifest = select_scale.build_scale_manifest(data_dir, pilot_path)
            keys = [(e["fromId"], e["toId"]) for e in manifest["edges"]]
            self.assertEqual(len(keys), len(set(keys)))

    def test_edge_count_is_derived_never_hardcoded(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, pilot_path = self._fixture(tmp_path)
            with mock.patch.object(select_scale, "PILOT_EDGE_COUNT", 1):
                manifest = select_scale.build_scale_manifest(data_dir, pilot_path)
            ctx = manifest["sourceDatasetContext"]
            self.assertEqual(ctx["scaleEdgeCount"], ctx["walkingRelationCount"] - ctx["pilotEdgeCount"])
            self.assertEqual(ctx["scaleEdgeCount"], len(manifest["edges"]))

    def test_deterministic_across_runs(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, pilot_path = self._fixture(tmp_path)
            with mock.patch.object(select_scale, "PILOT_EDGE_COUNT", 1):
                first = select_scale.build_scale_manifest(data_dir, pilot_path)
                second = select_scale.build_scale_manifest(data_dir, pilot_path)
            self.assertEqual(first, second)

    def test_pilot_manifest_wrong_edge_count_is_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, pilot_path = self._fixture(tmp_path)
            # PILOT_EDGE_COUNT is the real constant (24) here — the fixture's 1-edge
            # pilot manifest must be rejected rather than silently accepted.
            with self.assertRaises(ValueError):
                select_scale.build_scale_manifest(data_dir, pilot_path)

    def test_pilot_manifest_referencing_a_non_walking_edge_is_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, pilot_path = self._fixture(tmp_path)
            bad_pilot = {"pilotVersion": 1, "edges": [{"fromId": "JP-001", "toId": "JP-006", "category": "test"}]}
            pilot_path.write_text(json.dumps(bad_pilot), encoding="utf-8")
            with mock.patch.object(select_scale, "PILOT_EDGE_COUNT", 1):
                with self.assertRaises(ValueError):
                    select_scale.build_scale_manifest(data_dir, pilot_path)


class SeedSnapStoreTests(unittest.TestCase):
    def test_seeds_per_place_measurements_from_pilot_results_no_network(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place("JP-001", 35.0, 139.0), fake_place("JP-008", 35.01, 139.01)]
            data_dir = write_dataset(tmp_path, places, [])
            results = [
                {
                    "fromId": "JP-001", "toId": "JP-008", "status": "validated",
                    "distance": {"meters": 500.0}, "verifiedAt": "2026-09-04T01:00:00Z",
                    "endpointSnapping": {"assessment": "clean", "fromSnapMeters": 1.0, "toSnapMeters": 2.0, "radiusMeters": 350},
                },
            ]
            results_path = tmp_path / "results.json"
            results_path.write_text(json.dumps(results), encoding="utf-8")

            store = seed_snap.build_snap_store(data_dir, results_path)
            self.assertEqual(store["places"]["JP-001"]["snappedDistanceMeters"], 1.0)
            self.assertEqual(store["places"]["JP-008"]["snappedDistanceMeters"], 2.0)
            self.assertEqual(store["places"]["JP-001"]["status"], "resolved")

    def test_inconsistent_measurement_for_same_place_is_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place("JP-001", 35.0, 139.0), fake_place("JP-008", 35.01, 139.01), fake_place("JP-009", 35.02, 139.02)]
            data_dir = write_dataset(tmp_path, places, [])
            results = [
                {
                    "fromId": "JP-001", "toId": "JP-008", "status": "validated",
                    "distance": {"meters": 500.0}, "verifiedAt": "t1",
                    "endpointSnapping": {"assessment": "clean", "fromSnapMeters": 1.0, "toSnapMeters": 2.0, "radiusMeters": 350},
                },
                {
                    # JP-001 measured differently in a second edge — must be rejected.
                    "fromId": "JP-001", "toId": "JP-009", "status": "validated",
                    "distance": {"meters": 500.0}, "verifiedAt": "t2",
                    "endpointSnapping": {"assessment": "clean", "fromSnapMeters": 99.0, "toSnapMeters": 2.0, "radiusMeters": 350},
                },
            ]
            results_path = tmp_path / "results.json"
            results_path.write_text(json.dumps(results), encoding="utf-8")
            with self.assertRaises(ValueError):
                seed_snap.build_snap_store(data_dir, results_path)

    def test_unbackfilled_result_without_assessment_is_skipped_not_errored(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place("JP-001", 35.0, 139.0), fake_place("JP-008", 35.01, 139.01)]
            data_dir = write_dataset(tmp_path, places, [])
            results = [
                {"fromId": "JP-001", "toId": "JP-008", "status": "validated", "distance": {"meters": 500.0}, "verifiedAt": "t1"},
            ]
            results_path = tmp_path / "results.json"
            results_path.write_text(json.dumps(results), encoding="utf-8")
            store = seed_snap.build_snap_store(data_dir, results_path)
            self.assertEqual(store["places"], {})


class ScaleDryRunAndCombineTests(unittest.TestCase):
    """dry-run reporting and the pure combine step (Snap store + routed distance ->
    assessment), all offline."""

    def _manifest(self, edges):
        return {"edges": [{"fromId": f, "toId": t} for f, t in edges]}

    def test_combine_snapping_uses_current_resolved_entries(self):
        by_id = {"A": fake_place("A", 35.0, 139.0), "B": fake_place("B", 35.01, 139.01)}
        snap_store = {
            "places": {
                "A": common.build_snap_place_entry(by_id["A"], 1.0, 350, "p", "prof", "t"),
                "B": common.build_snap_place_entry(by_id["B"], 2.0, 350, "p", "prof", "t"),
            }
        }
        snapping = vws.combine_snapping_for_edge("A", "B", 100.0, snap_store, by_id)
        self.assertEqual(snapping["assessment"], "clean")
        self.assertIsNone(snapping.get("reason"))

    def test_combine_snapping_missing_place_is_unknown_with_reason_never_zero(self):
        by_id = {"A": fake_place("A", 35.0, 139.0), "B": fake_place("B", 35.01, 139.01)}
        snap_store = {"places": {"A": common.build_snap_place_entry(by_id["A"], 1.0, 350, "p", "prof", "t")}}
        snapping = vws.combine_snapping_for_edge("A", "B", 100.0, snap_store, by_id)
        self.assertEqual(snapping["assessment"], "unknown")
        self.assertIsNone(snapping["toSnapMeters"])
        self.assertNotEqual(snapping["toSnapMeters"], 0)
        self.assertIn("B", snapping["reason"])

    def test_combine_snapping_stale_entry_treated_as_unresolved(self):
        by_id = {"A": fake_place("A", 35.0, 139.0), "B": fake_place("B", 35.01, 139.01)}
        stale_place = fake_place("A", 40.0, 140.0)  # different coordinates than by_id["A"]
        snap_store = {
            "places": {
                "A": common.build_snap_place_entry(stale_place, 1.0, 350, "p", "prof", "t"),
                "B": common.build_snap_place_entry(by_id["B"], 2.0, 350, "p", "prof", "t"),
            }
        }
        snapping = vws.combine_snapping_for_edge("A", "B", 100.0, snap_store, by_id)
        self.assertEqual(snapping["assessment"], "unknown")
        self.assertIn("stale", snapping["reason"])

    def test_combine_snapping_no_snap_place_never_becomes_clean(self):
        by_id = {"A": fake_place("A", 35.0, 139.0), "B": fake_place("B", 35.01, 139.01)}
        snap_store = {
            "places": {
                "A": common.build_snap_place_entry(by_id["A"], 1.0, 350, "p", "prof", "t"),
                "B": common.build_snap_place_entry(
                    by_id["B"], None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_NO_SNAP
                ),
            }
        }
        snapping = vws.combine_snapping_for_edge("A", "B", 100.0, snap_store, by_id)
        self.assertEqual(snapping["assessment"], "unknown")
        self.assertIsNone(snapping["toSnapMeters"])
        self.assertNotEqual(snapping["toSnapMeters"], 0)

    def test_combine_snapping_request_error_place_never_becomes_clean(self):
        by_id = {"A": fake_place("A", 35.0, 139.0), "B": fake_place("B", 35.01, 139.01)}
        snap_store = {
            "places": {
                "A": common.build_snap_place_entry(by_id["A"], 1.0, 350, "p", "prof", "t"),
                "B": common.build_snap_place_entry(
                    by_id["B"], None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_REQUEST_ERROR
                ),
            }
        }
        snapping = vws.combine_snapping_for_edge("A", "B", 100.0, snap_store, by_id)
        self.assertEqual(snapping["assessment"], "unknown")

    def test_places_needing_snap_derives_from_store_not_a_hardcoded_count(self):
        by_id = {"A": fake_place("A", 35.0, 139.0), "B": fake_place("B", 35.01, 139.01), "C": fake_place("C", 35.02, 139.02)}
        snap_store = {"places": {"A": common.build_snap_place_entry(by_id["A"], 1.0, 350, "p", "prof", "t")}}
        missing = vws.places_needing_snap(["A", "B", "C"], by_id, snap_store)
        self.assertEqual(missing, ["B", "C"])

    def test_places_needing_snap_refresh_forces_everything(self):
        by_id = {"A": fake_place("A", 35.0, 139.0)}
        snap_store = {"places": {"A": common.build_snap_place_entry(by_id["A"], 1.0, 350, "p", "prof", "t")}}
        missing = vws.places_needing_snap(["A"], by_id, snap_store, refresh=True)
        self.assertEqual(missing, ["A"])

    def test_request_error_place_is_a_requery_candidate_by_default(self):
        by_id = {"A": fake_place("A", 35.0, 139.0)}
        snap_store = {
            "places": {
                "A": common.build_snap_place_entry(
                    by_id["A"], None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_REQUEST_ERROR
                )
            }
        }
        self.assertEqual(vws.places_needing_snap(["A"], by_id, snap_store), ["A"])

    def test_resolved_place_is_reused_never_requeried(self):
        by_id = {"A": fake_place("A", 35.0, 139.0)}
        snap_store = {"places": {"A": common.build_snap_place_entry(by_id["A"], 1.0, 350, "p", "prof", "t")}}
        self.assertEqual(vws.places_needing_snap(["A"], by_id, snap_store), [])

    def test_stale_place_is_requeried(self):
        by_id = {"A": fake_place("A", 35.0, 139.0)}
        measured_elsewhere = fake_place("A", 40.0, 140.0)
        snap_store = {"places": {"A": common.build_snap_place_entry(measured_elsewhere, 1.0, 350, "p", "prof", "t")}}
        self.assertEqual(vws.places_needing_snap(["A"], by_id, snap_store), ["A"])

    def test_no_snap_place_is_not_requeried_by_default_but_can_be_opted_into(self):
        by_id = {"A": fake_place("A", 35.0, 139.0)}
        snap_store = {
            "places": {
                "A": common.build_snap_place_entry(
                    by_id["A"], None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_NO_SNAP
                )
            }
        }
        self.assertEqual(vws.places_needing_snap(["A"], by_id, snap_store), [])
        self.assertEqual(vws.places_needing_snap(["A"], by_id, snap_store, retry_no_snap=True), ["A"])

    def test_preflight_passes_only_when_everything_is_resolved(self):
        by_id = {"A": fake_place("A", 35.0, 139.0)}
        snap_store = {"places": {"A": common.build_snap_place_entry(by_id["A"], 1.0, 350, "p", "prof", "t")}}
        ok, blocking, _ = vws.snap_preflight(["A"], by_id, snap_store)
        self.assertTrue(ok)
        self.assertEqual(blocking, [])

    def test_preflight_blocks_on_missing_stale_and_request_error(self):
        by_id = {
            "A": fake_place("A", 35.0, 139.0),
            "B": fake_place("B", 35.01, 139.01),
            "C": fake_place("C", 35.02, 139.02),
        }
        snap_store = {
            "places": {
                "B": common.build_snap_place_entry(fake_place("B", 40.0, 140.0), 1.0, 350, "p", "prof", "t"),
                "C": common.build_snap_place_entry(
                    by_id["C"], None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_REQUEST_ERROR
                ),
            }
        }
        ok, blocking, _ = vws.snap_preflight(["A", "B", "C"], by_id, snap_store)
        self.assertFalse(ok)
        self.assertEqual(set(blocking), {"missing", "stale", "request-error"})

    def test_preflight_blocks_on_no_snap_unless_explicitly_allowed(self):
        by_id = {"A": fake_place("A", 35.0, 139.0)}
        snap_store = {
            "places": {
                "A": common.build_snap_place_entry(
                    by_id["A"], None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_NO_SNAP
                )
            }
        }
        ok, blocking, _ = vws.snap_preflight(["A"], by_id, snap_store)
        self.assertFalse(ok)
        self.assertEqual(blocking, ["no-snap"])
        ok_allowed, blocking_allowed, _ = vws.snap_preflight(["A"], by_id, snap_store, allow_unknown_snap=True)
        self.assertTrue(ok_allowed)
        self.assertEqual(blocking_allowed, [])

    def test_allow_unknown_snap_never_unblocks_a_fixable_state(self):
        by_id = {"A": fake_place("A", 35.0, 139.0)}
        ok, blocking, _ = vws.snap_preflight(["A"], by_id, {"places": {}}, allow_unknown_snap=True)
        self.assertFalse(ok)
        self.assertEqual(blocking, ["missing"])

    def test_dry_run_reports_derived_counts_no_network(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place(f"JP-{i:03d}", 35.0 + i * 0.001, 139.0 + i * 0.001, hub="Tokio") for i in range(1, 5)]
            nearby = [nearby_row("JP-001", "JP-002", km=0.3), nearby_row("JP-002", "JP-003", km=0.7), nearby_row("JP-003", "JP-004", km=1.5)]
            data_dir = write_dataset(tmp_path, places, nearby)
            manifest_path = tmp_path / "scale-manifest.json"
            manifest_path.write_text(json.dumps(self._manifest([("JP-001", "JP-002"), ("JP-002", "JP-003"), ("JP-003", "JP-004")])), encoding="utf-8")

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir))
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "no-results.json"), \
                 mock.patch.object(vws, "SNAP_PLACES_PATH", tmp_path / "no-snap-store.json"):
                exit_code = vws.dry_run(args)
        self.assertEqual(exit_code, 0)

class ScaleBackfillSnapPlacesTests(unittest.TestCase):
    def _fixture(self, tmp_path, place_ids, edges):
        places = [fake_place(pid, 35.0 + i * 0.001, 139.0 + i * 0.001) for i, pid in enumerate(place_ids)]
        nearby = [nearby_row(f, t) for f, t in edges]
        data_dir = write_dataset(tmp_path, places, nearby)
        manifest_path = tmp_path / "scale-manifest.json"
        manifest_path.write_text(
            json.dumps({"edges": [{"fromId": f, "toId": t} for f, t in edges]}), encoding="utf-8"
        )
        return data_dir, manifest_path, places

    def test_backfill_makes_one_chunk_for_small_batches_and_writes_incrementally(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, _ = self._fixture(
                tmp_path, ["P0", "P1", "P2", "P3", "P4"], [("P0", "P1"), ("P2", "P3")]
            )
            snap_store_path = tmp_path / "snap-store.json"

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(
                vws, "query_ors_snap_with_retry", return_value=([1.0, 2.0, 3.0, 4.0], None)
            ) as mock_snap, mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.backfill_snap_places(args)

            self.assertEqual(exit_code, 0)
            mock_snap.assert_called_once()
            store = json.loads(snap_store_path.read_text())
            self.assertEqual(len(store["places"]), 4)
            self.assertEqual(store["places"]["P0"]["snappedDistanceMeters"], 1.0)
            self.assertEqual(store["places"]["P0"]["status"], "resolved")

    def test_backfill_chunks_when_over_the_per_request_location_cap(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            edges = [("P0", "P1"), ("P2", "P3"), ("P4", "P5")]
            data_dir, manifest_path, _ = self._fixture(tmp_path, [f"P{i}" for i in range(6)], edges)
            snap_store_path = tmp_path / "snap-store.json"

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "ORS_SNAP_MAX_LOCATIONS_PER_REQUEST", 2), \
                 mock.patch.object(
                     vws, "query_ors_snap_with_retry",
                     side_effect=[([1.0, 2.0], None), ([3.0, 4.0], None), ([5.0, 6.0], None)],
                 ) as mock_snap, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.backfill_snap_places(args)

            self.assertEqual(exit_code, 0)
            self.assertEqual(mock_snap.call_count, 3)  # 6 places / cap-of-2 = 3 chunks
            store = json.loads(snap_store_path.read_text())
            self.assertEqual(len(store["places"]), 6)

    def test_backfill_records_no_snap_for_a_null_measurement_never_zero(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, _ = self._fixture(tmp_path, ["P0", "P1"], [("P0", "P1")])
            snap_store_path = tmp_path / "snap-store.json"

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "query_ors_snap_with_retry", return_value=([1.0, None], None)), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.backfill_snap_places(args)

            store = json.loads(snap_store_path.read_text())
            self.assertEqual(store["places"]["P1"]["status"], "no-snap")
            self.assertIsNone(store["places"]["P1"]["snappedDistanceMeters"])
            self.assertNotEqual(store["places"]["P1"]["snappedDistanceMeters"], 0)

    def test_backfill_records_request_error_distinctly_from_no_snap(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, _ = self._fixture(tmp_path, ["P0", "P1"], [("P0", "P1")])
            snap_store_path = tmp_path / "snap-store.json"
            failure = ors_client.RoutingRequestError("HTTP 503", status="request-error", transient=True)

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "query_ors_snap_with_retry", return_value=(None, failure)), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.backfill_snap_places(args)

            store = json.loads(snap_store_path.read_text())
            for place_id in ("P0", "P1"):
                self.assertEqual(store["places"][place_id]["status"], "request-error")
                self.assertIsNone(store["places"][place_id]["snappedDistanceMeters"])

    def test_request_error_place_is_retried_on_the_next_backfill_run(self):
        """A failed request says nothing about the coordinate, so the next run picks it
        up again — unlike a 'no-snap', which the provider already answered."""
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, _ = self._fixture(tmp_path, ["P0", "P1"], [("P0", "P1")])
            snap_store_path = tmp_path / "snap-store.json"
            failure = ors_client.RoutingRequestError("HTTP 503", status="request-error", transient=True)
            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))

            with mock.patch.object(vws, "query_ors_snap_with_retry", return_value=(None, failure)), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.backfill_snap_places(args)
            self.assertEqual(json.loads(snap_store_path.read_text())["places"]["P0"]["status"], "request-error")

            # Second run: both places are still candidates, and now they succeed.
            with mock.patch.object(
                vws, "query_ors_snap_with_retry", return_value=([7.0, 8.0], None)
            ) as mock_snap, mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.backfill_snap_places(args)
            self.assertEqual(len(mock_snap.call_args.args[1]), 2)  # both re-queried
            store = json.loads(snap_store_path.read_text())
            self.assertEqual(store["places"]["P0"]["status"], "resolved")
            self.assertEqual(store["places"]["P0"]["snappedDistanceMeters"], 7.0)

    def test_no_snap_place_is_not_requeried_on_the_next_run(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, _ = self._fixture(tmp_path, ["P0", "P1"], [("P0", "P1")])
            snap_store_path = tmp_path / "snap-store.json"
            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))

            with mock.patch.object(vws, "query_ors_snap_with_retry", return_value=([1.0, None], None)), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.backfill_snap_places(args)

            with mock.patch.object(vws, "query_ors_snap_with_retry") as mock_snap, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.backfill_snap_places(args)
            mock_snap.assert_not_called()

    def test_resolved_place_is_reused_across_runs(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, places = self._fixture(tmp_path, ["P0", "P1"], [("P0", "P1")])
            snap_store_path = tmp_path / "snap-store.json"
            snap_store_path.write_text(json.dumps({
                "places": {
                    "P0": common.build_snap_place_entry(places[0], 1.0, 350, "p", "prof", "t"),
                    "P1": common.build_snap_place_entry(places[1], 2.0, 350, "p", "prof", "t"),
                }
            }), encoding="utf-8")

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "query_ors_snap_with_retry") as mock_snap, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.backfill_snap_places(args)
            self.assertEqual(exit_code, 0)
            mock_snap.assert_not_called()

    def test_stale_place_is_requeried_across_runs(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, places = self._fixture(tmp_path, ["P0", "P1"], [("P0", "P1")])
            snap_store_path = tmp_path / "snap-store.json"
            moved = fake_place("P0", 40.0, 140.0)
            snap_store_path.write_text(json.dumps({
                "places": {
                    "P0": common.build_snap_place_entry(moved, 1.0, 350, "p", "prof", "t"),
                    "P1": common.build_snap_place_entry(places[1], 2.0, 350, "p", "prof", "t"),
                }
            }), encoding="utf-8")

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(
                vws, "query_ors_snap_with_retry", return_value=([9.0], None)
            ) as mock_snap, mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.backfill_snap_places(args)
            mock_snap.assert_called_once()
            self.assertEqual(len(mock_snap.call_args.args[1]), 1)  # only the stale place
            store = json.loads(snap_store_path.read_text())
            self.assertEqual(store["places"]["P0"]["snappedDistanceMeters"], 9.0)
            self.assertEqual(store["places"]["P0"]["coordinates"], {"lat": 35.0, "lng": 139.0})

    def test_backfill_requires_api_key(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            exit_code = vws.backfill_snap_places(scale_args())
        self.assertEqual(exit_code, 1)

    def test_backfill_never_calls_directions(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, _ = self._fixture(tmp_path, ["P0", "P1"], [("P0", "P1")])
            snap_store_path = tmp_path / "snap-store.json"

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "query_ors_snap_with_retry", return_value=([1.0, 2.0], None)), \
                 mock.patch.object(vws, "query_ors_with_retry") as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.backfill_snap_places(args)
            mock_directions.assert_not_called()


class ScaleExecutePreflightTests(unittest.TestCase):
    """--execute must refuse to burn a quota-bound bulk run against an incomplete
    Snap store, and must never silently proceed over unknowns."""

    def _fixture(self, tmp_path):
        places = [fake_place("P0", 35.0, 139.0), fake_place("P1", 35.001, 139.001)]
        nearby = [nearby_row("P0", "P1")]
        data_dir = write_dataset(tmp_path, places, nearby)
        manifest_path = tmp_path / "scale-manifest.json"
        manifest_path.write_text(json.dumps({"edges": [{"fromId": "P0", "toId": "P1"}]}), encoding="utf-8")
        return data_dir, manifest_path, places

    def test_execute_blocks_when_a_place_has_no_snap_entry(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, _ = self._fixture(tmp_path)
            args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(tmp_path / "absent.json")
            )
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "results.json"), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry") as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.execute(args)

            self.assertEqual(exit_code, 1)
            mock_directions.assert_not_called()
            self.assertFalse((tmp_path / "results.json").exists())

    def test_execute_blocks_when_a_place_is_in_request_error(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, places = self._fixture(tmp_path)
            snap_store_path = tmp_path / "snap-store.json"
            snap_store_path.write_text(json.dumps({
                "places": {
                    "P0": common.build_snap_place_entry(places[0], 1.0, 350, "p", "prof", "t"),
                    "P1": common.build_snap_place_entry(
                        places[1], None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_REQUEST_ERROR
                    ),
                }
            }), encoding="utf-8")

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "results.json"), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry") as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.execute(args)

            self.assertEqual(exit_code, 1)
            mock_directions.assert_not_called()

    def test_execute_blocks_when_a_place_is_stale(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, places = self._fixture(tmp_path)
            snap_store_path = tmp_path / "snap-store.json"
            snap_store_path.write_text(json.dumps({
                "places": {
                    "P0": common.build_snap_place_entry(fake_place("P0", 40.0, 140.0), 1.0, 350, "p", "prof", "t"),
                    "P1": common.build_snap_place_entry(places[1], 2.0, 350, "p", "prof", "t"),
                }
            }), encoding="utf-8")

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "results.json"), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry") as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.execute(args)

            self.assertEqual(exit_code, 1)
            mock_directions.assert_not_called()

    def test_execute_blocks_on_no_snap_until_explicitly_allowed(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, places = self._fixture(tmp_path)
            snap_store_path = tmp_path / "snap-store.json"
            snap_store_path.write_text(json.dumps({
                "places": {
                    "P0": common.build_snap_place_entry(places[0], 1.0, 350, "p", "prof", "t"),
                    "P1": common.build_snap_place_entry(
                        places[1], None, 350, "p", "prof", "t", status=common.SNAP_PLACE_STATUS_NO_SNAP
                    ),
                }
            }), encoding="utf-8")

            blocked_args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path)
            )
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "results.json"), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry") as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                self.assertEqual(vws.execute(blocked_args), 1)
                mock_directions.assert_not_called()

            allowed_args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir),
                snap_places=str(snap_store_path), allow_unknown_snap=True,
            )
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "results.json"), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry", return_value=((80.0, 60.0), None)) as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                self.assertEqual(vws.execute(allowed_args), 0)
                mock_directions.assert_called_once()

            written = json.loads((tmp_path / "results.json").read_text())
            # Allowed through, but the no-snap place still makes the edge "unknown".
            self.assertEqual(written[0]["endpointSnapping"]["assessment"], "unknown")

    def test_execute_proceeds_when_every_place_is_resolved(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, places = self._fixture(tmp_path)
            snap_store_path = tmp_path / "snap-store.json"
            snap_store_path.write_text(json.dumps({
                "places": {
                    "P0": common.build_snap_place_entry(places[0], 1.0, 350, "p", "prof", "t"),
                    "P1": common.build_snap_place_entry(places[1], 2.0, 350, "p", "prof", "t"),
                }
            }), encoding="utf-8")

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "results.json"), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry", return_value=((80.0, 60.0), None)), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.execute(args)

            self.assertEqual(exit_code, 0)
            written = json.loads((tmp_path / "results.json").read_text())
            self.assertEqual(written[0]["endpointSnapping"]["assessment"], "clean")


class ScaleExecuteCheckpointTests(unittest.TestCase):
    """--execute persists after every completed edge, and only publishes the
    app-facing copy once the batch covers the whole manifest."""

    EDGE_COUNT = 5

    def _fixture(self, tmp_path):
        place_ids = [f"P{i}" for i in range(self.EDGE_COUNT + 1)]
        places = [fake_place(pid, 35.0 + i * 0.001, 139.0 + i * 0.001) for i, pid in enumerate(place_ids)]
        edges = [(place_ids[i], place_ids[i + 1]) for i in range(self.EDGE_COUNT)]
        nearby = [nearby_row(f, t) for f, t in edges]
        data_dir = write_dataset(tmp_path, places, nearby)
        manifest_path = tmp_path / "scale-manifest.json"
        manifest_path.write_text(
            json.dumps({"edges": [{"fromId": f, "toId": t} for f, t in edges]}), encoding="utf-8"
        )
        snap_store_path = tmp_path / "snap-store.json"
        snap_store_path.write_text(json.dumps({
            "places": {
                pid: common.build_snap_place_entry(place, 1.0, 350, "p", "prof", "t")
                for pid, place in zip(place_ids, places)
            }
        }), encoding="utf-8")
        return data_dir, manifest_path, snap_store_path, edges

    def test_crash_midway_keeps_completed_edges_and_resume_does_not_requery_them(self):
        import tempfile

        class Boom(Exception):
            pass

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, snap_store_path, edges = self._fixture(tmp_path)
            results_path = tmp_path / "results.json"
            app_path = tmp_path / "app.json"
            args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path)
            )

            completed_before_crash = 3
            first_run_calls = []

            def flaky_directions(api_key, from_place, to_place, rate_limiter=None):
                if len(first_run_calls) >= completed_before_crash:
                    raise Boom("connection dropped mid-batch")
                first_run_calls.append((from_place["id"], to_place["id"]))
                return (100.0, 60.0), None

            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_path), \
                 mock.patch.object(vws, "query_ors_with_retry", flaky_directions), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                with self.assertRaises(Boom):
                    vws.execute(args)

            # The completed edges are PHYSICALLY on disk despite the crash.
            self.assertTrue(results_path.exists())
            checkpointed = json.loads(results_path.read_text())
            self.assertEqual(len(checkpointed), completed_before_crash)
            checkpointed_keys = {(r["fromId"], r["toId"]) for r in checkpointed}
            self.assertEqual(checkpointed_keys, set(edges[:completed_before_crash]))
            # A partial batch must NOT have been published to the app copy.
            self.assertFalse(app_path.exists())

            # Resume: only the edges that never completed are queried again.
            second_run_calls = []

            def recording_directions(api_key, from_place, to_place, rate_limiter=None):
                second_run_calls.append((from_place["id"], to_place["id"]))
                return (100.0, 60.0), None

            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_path), \
                 mock.patch.object(vws, "query_ors_with_retry", recording_directions), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.execute(args)

            self.assertEqual(exit_code, 0)
            self.assertEqual(set(second_run_calls), set(edges[completed_before_crash:]))
            for already_done in edges[:completed_before_crash]:
                self.assertNotIn(already_done, second_run_calls)
            # Now complete: every manifest edge answered, so the app copy is published.
            final = json.loads(results_path.read_text())
            self.assertEqual(len(final), self.EDGE_COUNT)
            self.assertTrue(app_path.exists())
            self.assertEqual(json.loads(app_path.read_text()), final)

    def test_results_file_grows_after_every_single_edge(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, snap_store_path, edges = self._fixture(tmp_path)
            results_path = tmp_path / "results.json"
            app_path = tmp_path / "app.json"
            args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path)
            )

            observed_counts = []

            def observing_directions(api_key, from_place, to_place, rate_limiter=None):
                # Count what is already durable at the moment this edge starts.
                if results_path.exists():
                    observed_counts.append(len(json.loads(results_path.read_text())))
                else:
                    observed_counts.append(0)
                return (100.0, 60.0), None

            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_path), \
                 mock.patch.object(vws, "query_ors_with_retry", observing_directions), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.execute(args)

            # Edge N starts with exactly N-1 results already durable: one write per edge,
            # not one write at the end.
            self.assertEqual(observed_counts, list(range(self.EDGE_COUNT)))

    def test_app_copy_is_not_written_while_the_batch_is_incomplete(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, snap_store_path, edges = self._fixture(tmp_path)
            results_path = tmp_path / "results.json"
            app_path = tmp_path / "app.json"
            # A manifest edge the run will never reach, because we only feed 1 answer.
            args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path)
            )

            calls = {"n": 0}

            def one_then_fail(api_key, from_place, to_place, rate_limiter=None):
                calls["n"] += 1
                if calls["n"] > 1:
                    raise KeyboardInterrupt()
                return (100.0, 60.0), None

            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_path), \
                 mock.patch.object(vws, "query_ors_with_retry", one_then_fail), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                with self.assertRaises(KeyboardInterrupt):
                    vws.execute(args)

            self.assertEqual(len(json.loads(results_path.read_text())), 1)
            self.assertFalse(app_path.exists())

    def test_execute_paces_directions_through_the_rate_limiter(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, snap_store_path, edges = self._fixture(tmp_path)
            args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir),
                snap_places=str(snap_store_path), directions_per_minute=2,
            )
            seen_limiters = []

            def capturing_directions(api_key, from_place, to_place, rate_limiter=None):
                seen_limiters.append(rate_limiter)
                return (100.0, 60.0), None

            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "results.json"), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry", capturing_directions), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.execute(args)

            self.assertEqual(len(seen_limiters), self.EDGE_COUNT)
            for limiter in seen_limiters:
                self.assertIsNotNone(limiter, "every Directions call must be handed the rate limiter")
                self.assertEqual(limiter.max_events, 2)
                self.assertEqual(limiter.per_seconds, 60.0)
            self.assertIs(seen_limiters[0], seen_limiters[-1], "one limiter for the whole batch")


class ScaleExecuteCacheResumeTests(unittest.TestCase):
    """--execute must be restart-safe: a cached validated edge is skipped (never
    re-queried) unless --refresh, exactly like the pilot's --execute."""

    def _setup(self, tmp_path, snap_resolved=True):
        places = [fake_place("P0", 35.0, 139.0), fake_place("P1", 35.001, 139.001), fake_place("P2", 35.002, 139.002)]
        nearby = [nearby_row("P0", "P1"), nearby_row("P1", "P2")]
        data_dir = write_dataset(tmp_path, places, nearby)
        manifest_path = tmp_path / "scale-manifest.json"
        manifest_path.write_text(json.dumps({"edges": [{"fromId": "P0", "toId": "P1"}, {"fromId": "P1", "toId": "P2"}]}), encoding="utf-8")
        snap_store_path = tmp_path / "snap-store.json"
        if snap_resolved:
            snap_store_path.write_text(json.dumps({
                "places": {
                    place["id"]: common.build_snap_place_entry(place, 1.0, 350, "p", "prof", "t")
                    for place in places
                }
            }), encoding="utf-8")
        return data_dir, manifest_path, snap_store_path

    def _cached_result(self):
        return [{
            "fromId": "P0", "toId": "P1", "status": "validated", "provider": "openrouteservice",
            "profile": "foot-walking", "distance": {"meters": 50.0}, "minutes": {"minMinutes": 1, "maxMinutes": 1},
            "confidence": "validated-static", "verifiedAt": "t0",
            "source": {"kind": "routing-provider", "provider": "openrouteservice", "profile": "foot-walking"},
            "query": {"fromCoordinates": [139.0, 35.0], "toCoordinates": [139.001, 35.001]},
        }]

    def test_cached_validated_edge_is_skipped_and_directions_not_recalled(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, snap_store_path = self._setup(tmp_path)
            results_path = tmp_path / "results.json"
            results_path.write_text(json.dumps(self._cached_result()), encoding="utf-8")

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry") as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                mock_directions.return_value = ((80.0, 60.0), None)
                exit_code = vws.execute(args)

            self.assertEqual(exit_code, 0)
            mock_directions.assert_called_once()  # only P1->P2, not the cached P0->P1
            self.assertEqual(mock_directions.call_args.args[1]["id"], "P1")

    def test_refresh_forces_requery_of_cached_edge(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, snap_store_path = self._setup(tmp_path)
            results_path = tmp_path / "results.json"
            results_path.write_text(json.dumps(self._cached_result()), encoding="utf-8")

            args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir),
                snap_places=str(snap_store_path), refresh=True,
            )
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry", return_value=((80.0, 60.0), None)) as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.execute(args)

            self.assertEqual(exit_code, 0)
            self.assertEqual(mock_directions.call_count, 2)  # both edges re-queried

    def test_execute_never_calls_snap_directly(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path, snap_store_path = self._setup(tmp_path)

            args = scale_args(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "results.json"), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", tmp_path / "app.json"), \
                 mock.patch.object(vws, "query_ors_with_retry", return_value=((80.0, 60.0), None)), \
                 mock.patch.object(ors_client, "query_ors_snap") as mock_snap, \
                 mock.patch.object(vws, "query_ors_snap_with_retry") as mock_snap_retry, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.execute(args)
            mock_snap.assert_not_called()
            mock_snap_retry.assert_not_called()


class RecombineSnappingTests(unittest.TestCase):
    def test_recombine_updates_endpoint_snapping_without_new_network_call(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place("P0", 35.0, 139.0), fake_place("P1", 35.001, 139.001)]
            data_dir = write_dataset(tmp_path, places, [])
            manifest_path = tmp_path / "scale-manifest.json"
            manifest_path.write_text(json.dumps({"edges": [{"fromId": "P0", "toId": "P1"}]}), encoding="utf-8")
            results_path = tmp_path / "results.json"
            app_path = tmp_path / "app.json"
            existing = [{
                "fromId": "P0", "toId": "P1", "status": "validated",
                "distance": {"meters": 50.0}, "verifiedAt": "t0",
                "endpointSnapping": {"assessment": "unknown", "fromSnapMeters": None, "toSnapMeters": None, "radiusMeters": 350, "reason": "not yet snapped"},
            }]
            results_path.write_text(json.dumps(existing), encoding="utf-8")
            snap_store_path = tmp_path / "snap-store.json"
            snap_store_path.write_text(json.dumps({
                "places": {
                    "P0": common.build_snap_place_entry(places[0], 1.0, 350, "p", "prof", "t"),
                    "P1": common.build_snap_place_entry(places[1], 2.0, 350, "p", "prof", "t"),
                }
            }), encoding="utf-8")

            args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path)
            )
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_path):
                exit_code = vws.recombine_snapping(args)

            self.assertEqual(exit_code, 0)
            written = json.loads(results_path.read_text())
            self.assertEqual(written[0]["endpointSnapping"]["assessment"], "clean")
            # Results now cover the whole manifest, so the app copy is published.
            self.assertTrue(app_path.exists())

    def test_recombine_does_not_publish_an_incomplete_batch_to_the_app(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place("P0", 35.0, 139.0), fake_place("P1", 35.001, 139.001), fake_place("P2", 35.002, 139.002)]
            data_dir = write_dataset(tmp_path, places, [])
            manifest_path = tmp_path / "scale-manifest.json"
            manifest_path.write_text(json.dumps({
                "edges": [{"fromId": "P0", "toId": "P1"}, {"fromId": "P1", "toId": "P2"}]
            }), encoding="utf-8")
            results_path = tmp_path / "results.json"
            app_path = tmp_path / "app.json"
            results_path.write_text(json.dumps([{
                "fromId": "P0", "toId": "P1", "status": "validated",
                "distance": {"meters": 50.0}, "verifiedAt": "t0",
            }]), encoding="utf-8")
            snap_store_path = tmp_path / "snap-store.json"
            snap_store_path.write_text(json.dumps({"places": {}}), encoding="utf-8")

            args = scale_args(
                manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path)
            )
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_path):
                exit_code = vws.recombine_snapping(args)

            self.assertEqual(exit_code, 0)
            self.assertFalse(app_path.exists())

    def test_recombine_noop_when_no_results_yet(self):
        args = scale_args()
        with mock.patch.object(vws, "SCALE_RESULTS_PATH", Path("/nonexistent/results.json")):
            exit_code = vws.recombine_snapping(args)
        self.assertEqual(exit_code, 0)

class ScaleValidatorTests(unittest.TestCase):
    """validate-logistics.py's scale-specific checks: pilot ∪ scale == every walking
    edge with 0 overlap, 0 duplicates, no non-walking relation ever admitted, the
    snap store keyed strictly by placeId with null never presented as a resolved 0 m
    measurement, and no secret-like value anywhere in either artifact."""

    def _nearby(self):
        return [
            nearby_row("A", "B"), nearby_row("B", "A"), nearby_row("C", "D"),
            nearby_row("D", "E"), nearby_row("A", "E", modo="Transporte local"),
        ]

    def _places_ids(self):
        return {"A", "B", "C", "D", "E"}

    def test_scale_manifest_duplicate_edge_is_flagged(self):
        nearby_by_directed = {(r["Desde ID"], r["Hacia ID"]): r for r in self._nearby()}
        scale_manifest = {"edges": [{"fromId": "C", "toId": "D"}, {"fromId": "C", "toId": "D"}]}
        errors = validate_logistics.check_scale_manifest(scale_manifest, self._places_ids(), nearby_by_directed)
        self.assertTrue(any("duplicate directed edge" in e for e in errors))

    def test_scale_manifest_non_walking_relation_is_flagged(self):
        nearby_by_directed = {(r["Desde ID"], r["Hacia ID"]): r for r in self._nearby()}
        scale_manifest = {"edges": [{"fromId": "A", "toId": "E"}]}  # Transporte local
        errors = validate_logistics.check_scale_manifest(scale_manifest, self._places_ids(), nearby_by_directed)
        self.assertTrue(any("expected 'A pie'" in e for e in errors))

    def test_scale_manifest_unknown_place_is_flagged(self):
        nearby_by_directed = {(r["Desde ID"], r["Hacia ID"]): r for r in self._nearby()}
        scale_manifest = {"edges": [{"fromId": "Z", "toId": "D"}]}
        errors = validate_logistics.check_scale_manifest(scale_manifest, self._places_ids(), nearby_by_directed)
        self.assertTrue(any("fromId not found" in e for e in errors))

    def test_partition_passes_when_pilot_and_scale_exactly_cover_walking_edges(self):
        nearby = self._nearby()
        pilot_manifest = {"edges": [{"fromId": "A", "toId": "B"}]}
        scale_manifest = {"edges": [{"fromId": "B", "toId": "A"}, {"fromId": "C", "toId": "D"}, {"fromId": "D", "toId": "E"}]}
        errors = validate_logistics.check_pilot_scale_partition(pilot_manifest, scale_manifest, nearby)
        self.assertEqual(errors, [])

    def test_partition_flags_overlap_between_pilot_and_scale(self):
        nearby = self._nearby()
        pilot_manifest = {"edges": [{"fromId": "A", "toId": "B"}]}
        scale_manifest = {"edges": [{"fromId": "A", "toId": "B"}, {"fromId": "B", "toId": "A"}, {"fromId": "C", "toId": "D"}, {"fromId": "D", "toId": "E"}]}
        errors = validate_logistics.check_pilot_scale_partition(pilot_manifest, scale_manifest, nearby)
        self.assertTrue(any("overlap" in e for e in errors))

    def test_partition_flags_a_walking_edge_covered_by_neither(self):
        nearby = self._nearby()
        pilot_manifest = {"edges": [{"fromId": "A", "toId": "B"}]}
        scale_manifest = {"edges": [{"fromId": "B", "toId": "A"}, {"fromId": "C", "toId": "D"}]}  # D->E missing entirely
        errors = validate_logistics.check_pilot_scale_partition(pilot_manifest, scale_manifest, nearby)
        self.assertTrue(any("neither" in e for e in errors))

    def test_partition_flags_a_non_walking_edge_smuggled_into_scale(self):
        nearby = self._nearby()
        pilot_manifest = {"edges": [{"fromId": "A", "toId": "B"}]}
        scale_manifest = {
            "edges": [
                {"fromId": "B", "toId": "A"}, {"fromId": "C", "toId": "D"}, {"fromId": "D", "toId": "E"},
                {"fromId": "A", "toId": "E"},  # Transporte local — not a walking edge at all
            ]
        }
        errors = validate_logistics.check_pilot_scale_partition(pilot_manifest, scale_manifest, nearby)
        self.assertTrue(any("not current 'A pie' relations" in e for e in errors))

    def test_snap_store_keyed_by_place_id_resolved_entry_passes(self):
        place = fake_place("A", 35.0, 139.0)
        store = {"places": {"A": common.build_snap_place_entry(place, 5.0, 350, "p", "prof", "t")}}
        errors, warnings = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_snap_store_resolved_with_null_distance_is_flagged(self):
        place = fake_place("A", 35.0, 139.0)
        store = {"places": {"A": {"coordinates": place["coordinates"], "snappedDistanceMeters": None, "radiusMeters": 350, "status": "resolved"}}}
        errors, _ = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("'resolved' but snappedDistanceMeters is null" in e for e in errors))

    def test_snap_store_no_snap_with_a_measurement_is_flagged(self):
        place = fake_place("A", 35.0, 139.0)
        store = {"places": {"A": {"coordinates": place["coordinates"], "snappedDistanceMeters": 5.0, "radiusMeters": 350, "status": "no-snap"}}}
        errors, _ = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("status is 'no-snap' but snappedDistanceMeters" in e for e in errors))

    def test_snap_store_request_error_with_a_measurement_is_flagged(self):
        place = fake_place("A", 35.0, 139.0)
        store = {"places": {"A": {"coordinates": place["coordinates"], "snappedDistanceMeters": 5.0, "radiusMeters": 350, "status": "request-error"}}}
        errors, _ = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("status is 'request-error' but snappedDistanceMeters" in e for e in errors))

    def test_snap_store_legacy_two_state_status_is_flagged(self):
        # The pre-correction store used a coarse "unknown"; it is no longer a valid
        # state, because it can't distinguish a provider answer from a failed request.
        place = fake_place("A", 35.0, 139.0)
        store = {"places": {"A": {"coordinates": place["coordinates"], "snappedDistanceMeters": None, "radiusMeters": 350, "status": "unknown"}}}
        errors, _ = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("expected one of" in e for e in errors))

    def test_snap_store_unresolvable_place_id_is_flagged(self):
        place = fake_place("A", 35.0, 139.0)
        store = {"places": {"Z": common.build_snap_place_entry(place, 5.0, 350, "p", "prof", "t")}}
        errors, _ = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("not a place id" in e for e in errors))

    def test_snap_store_stale_coordinates_warn_rather_than_fail(self):
        # Staleness is a legitimate "needs re-query" state that --backfill-snap-places
        # fixes; the Directions preflight is what actually blocks a run over one.
        original = fake_place("A", 35.0, 139.0)
        entry = common.build_snap_place_entry(original, 5.0, 350, "p", "prof", "t")
        moved = fake_place("A", 40.0, 140.0)
        store = {"places": {"A": entry}}
        errors, warnings = validate_logistics.check_snap_places_store(store, {"A"}, {"A": moved})
        self.assertEqual(errors, [])
        self.assertTrue(any("stale" in w for w in warnings))

    def test_snap_store_secret_like_key_is_flagged(self):
        place = fake_place("A", 35.0, 139.0)
        entry = common.build_snap_place_entry(place, 5.0, 350, "p", "prof", "t")
        entry["apiKey"] = "should-never-be-here"
        store = {"places": {"A": entry}}
        errors, _ = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("secret" in e for e in errors))

    def test_partial_scale_results_are_a_warning_not_an_error(self):
        manifest_keys = {("A", "B"), ("B", "C")}
        results = [{"fromId": "A", "toId": "B"}]
        errors, warnings = validate_logistics.check_scale_results_coverage(results, manifest_keys)
        self.assertEqual(errors, [])
        self.assertTrue(any("still pending" in w for w in warnings))

    def test_scale_results_outside_the_manifest_are_an_error(self):
        manifest_keys = {("A", "B")}
        results = [{"fromId": "A", "toId": "B"}, {"fromId": "X", "toId": "Y"}]
        errors, _ = validate_logistics.check_scale_results_coverage(results, manifest_keys)
        self.assertTrue(any("not in the scale manifest" in e for e in errors))


class RealCommittedArtifactsTests(unittest.TestCase):
    """Live regression against whatever this checkout's real scale manifest and Snap
    store actually contain — not a fixture. Locks in the exact invariants Phase 3B2B-A
    was asked to guarantee against the real 332-relation 'A pie' dataset."""

    REPO_ROOT = SCRIPTS_DIR.parent

    def test_pilot_and_scale_manifests_together_are_every_walking_edge_zero_overlap(self):
        pilot_manifest = common.load_json(self.REPO_ROOT / "data/logistics/walking-pilot-manifest.json")
        scale_manifest = common.load_json(self.REPO_ROOT / "data/logistics/walking-scale-manifest.json")
        nearby = common.load_nearby(self.REPO_ROOT / "data")
        errors = validate_logistics.check_pilot_scale_partition(pilot_manifest, scale_manifest, nearby)
        self.assertEqual(errors, [])

    def test_scale_manifest_edge_count_matches_derived_expectation(self):
        nearby = common.load_nearby(self.REPO_ROOT / "data")
        pilot_manifest = common.load_json(self.REPO_ROOT / "data/logistics/walking-pilot-manifest.json")
        scale_manifest = common.load_json(self.REPO_ROOT / "data/logistics/walking-scale-manifest.json")
        walking_count = sum(1 for r in nearby if r["Modo"] == "A pie")
        self.assertEqual(len(scale_manifest["edges"]), walking_count - len(pilot_manifest["edges"]))

    def test_scale_manifest_passes_structural_checks_against_real_dataset(self):
        places = common.load_places(self.REPO_ROOT / "data")
        nearby = common.load_nearby(self.REPO_ROOT / "data")
        places_ids = set(common.places_by_id(places).keys())
        nearby_by_directed = common.nearby_by_directed_key(nearby)
        scale_manifest = common.load_json(self.REPO_ROOT / "data/logistics/walking-scale-manifest.json")
        errors = validate_logistics.check_scale_manifest(scale_manifest, places_ids, nearby_by_directed)
        self.assertEqual(errors, [])

    def test_real_snap_store_is_internally_consistent(self):
        places = common.load_places(self.REPO_ROOT / "data")
        places_ids = set(common.places_by_id(places).keys())
        by_id = common.places_by_id(places)
        store = common.load_snap_places_store(self.REPO_ROOT / "data/logistics/walking-snap-places.json")
        errors, warnings = validate_logistics.check_snap_places_store(store, places_ids, by_id)
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_real_snap_store_covers_all_places_shared_between_pilot_and_scale(self):
        # The 34 places Phase 3B2A already measured that also appear in scale edges
        # must be present and resolved — the whole point of reuse-without-requerying.
        pilot_manifest = common.load_json(self.REPO_ROOT / "data/logistics/walking-pilot-manifest.json")
        scale_manifest = common.load_json(self.REPO_ROOT / "data/logistics/walking-scale-manifest.json")
        store = common.load_snap_places_store(self.REPO_ROOT / "data/logistics/walking-snap-places.json")
        pilot_places = {p for e in pilot_manifest["edges"] for p in (e["fromId"], e["toId"])}
        scale_places = {p for e in scale_manifest["edges"] for p in (e["fromId"], e["toId"])}
        shared = pilot_places & scale_places
        self.assertGreater(len(shared), 0)
        for place_id in shared:
            self.assertIn(place_id, store["places"])
            self.assertEqual(store["places"][place_id]["status"], "resolved")


if __name__ == "__main__":
    unittest.main()
