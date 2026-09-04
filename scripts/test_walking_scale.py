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

    def test_build_snap_place_entry_none_is_unknown_never_zero(self):
        place = fake_place("JP-001", 35.0, 139.0)
        entry = common.build_snap_place_entry(
            place, None, 350, "openrouteservice", "foot-walking", "2026-09-04T00:00:00Z", reason="Snap query failed: boom"
        )
        self.assertEqual(entry["status"], "unknown")
        self.assertIsNone(entry["snappedDistanceMeters"])
        self.assertNotEqual(entry["snappedDistanceMeters"], 0)
        self.assertEqual(entry["reason"], "Snap query failed: boom")

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

    def test_dry_run_reports_derived_counts_no_network(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place(f"JP-{i:03d}", 35.0 + i * 0.001, 139.0 + i * 0.001, hub="Tokio") for i in range(1, 5)]
            nearby = [nearby_row("JP-001", "JP-002", km=0.3), nearby_row("JP-002", "JP-003", km=0.7), nearby_row("JP-003", "JP-004", km=1.5)]
            data_dir = write_dataset(tmp_path, places, nearby)
            manifest_path = tmp_path / "scale-manifest.json"
            manifest_path.write_text(json.dumps(self._manifest([("JP-001", "JP-002"), ("JP-002", "JP-003"), ("JP-003", "JP-004")])), encoding="utf-8")

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=None)
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", tmp_path / "no-results.json"), \
                 mock.patch.object(vws, "SNAP_PLACES_PATH", tmp_path / "no-snap-store.json"):
                exit_code = vws.dry_run(args)
        self.assertEqual(exit_code, 0)


class ScaleBackfillSnapPlacesTests(unittest.TestCase):
    def test_backfill_makes_one_chunk_for_small_batches_and_writes_incrementally(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place(f"P{i}", 35.0 + i * 0.001, 139.0 + i * 0.001) for i in range(5)]
            nearby = [nearby_row("P0", "P1"), nearby_row("P2", "P3")]
            data_dir = write_dataset(tmp_path, places, nearby)
            manifest_path = tmp_path / "scale-manifest.json"
            manifest_path.write_text(json.dumps({"edges": [{"fromId": "P0", "toId": "P1"}, {"fromId": "P2", "toId": "P3"}]}), encoding="utf-8")
            snap_store_path = tmp_path / "snap-store.json"

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path), refresh_snap_places=False)
            with mock.patch.object(vws, "query_ors_snap", return_value=[1.0, 2.0, 3.0, 4.0]) as mock_snap, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.backfill_snap_places(args)

            self.assertEqual(exit_code, 0)
            mock_snap.assert_called_once()
            store = json.loads(snap_store_path.read_text())
            self.assertEqual(len(store["places"]), 4)
            self.assertEqual(store["places"]["P0"]["snappedDistanceMeters"], 1.0)

    def test_backfill_chunks_when_over_the_per_request_location_cap(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            n = 6
            places = [fake_place(f"P{i}", 35.0 + i * 0.001, 139.0 + i * 0.001) for i in range(n)]
            edges = [("P0", "P1"), ("P2", "P3"), ("P4", "P5")]
            nearby = [nearby_row(f, t) for f, t in edges]
            data_dir = write_dataset(tmp_path, places, nearby)
            manifest_path = tmp_path / "scale-manifest.json"
            manifest_path.write_text(json.dumps({"edges": [{"fromId": f, "toId": t} for f, t in edges]}), encoding="utf-8")
            snap_store_path = tmp_path / "snap-store.json"

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path), refresh_snap_places=False)
            with mock.patch.object(vws, "ORS_SNAP_MAX_LOCATIONS_PER_REQUEST", 2), \
                 mock.patch.object(vws, "query_ors_snap", side_effect=[[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]]) as mock_snap, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.backfill_snap_places(args)

            self.assertEqual(exit_code, 0)
            self.assertEqual(mock_snap.call_count, 3)  # 6 places / cap-of-2 = 3 chunks
            store = json.loads(snap_store_path.read_text())
            self.assertEqual(len(store["places"]), 6)

    def test_backfill_is_noop_when_all_places_already_current(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place("P0", 35.0, 139.0), fake_place("P1", 35.001, 139.001)]
            nearby = [nearby_row("P0", "P1")]
            data_dir = write_dataset(tmp_path, places, nearby)
            manifest_path = tmp_path / "scale-manifest.json"
            manifest_path.write_text(json.dumps({"edges": [{"fromId": "P0", "toId": "P1"}]}), encoding="utf-8")
            snap_store_path = tmp_path / "snap-store.json"
            snap_store_path.write_text(json.dumps({
                "places": {
                    "P0": common.build_snap_place_entry(places[0], 1.0, 350, "p", "prof", "t"),
                    "P1": common.build_snap_place_entry(places[1], 2.0, 350, "p", "prof", "t"),
                }
            }), encoding="utf-8")

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path), refresh_snap_places=False)
            with mock.patch.object(vws, "query_ors_snap") as mock_snap, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.backfill_snap_places(args)
            self.assertEqual(exit_code, 0)
            mock_snap.assert_not_called()

    def test_backfill_requires_api_key(self):
        args = argparse.Namespace(manifest="x.json", data_dir="data", snap_places=None, refresh_snap_places=False)
        with mock.patch.dict("os.environ", {}, clear=True):
            exit_code = vws.backfill_snap_places(args)
        self.assertEqual(exit_code, 1)

    def test_backfill_never_calls_directions(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place("P0", 35.0, 139.0), fake_place("P1", 35.001, 139.001)]
            nearby = [nearby_row("P0", "P1")]
            data_dir = write_dataset(tmp_path, places, nearby)
            manifest_path = tmp_path / "scale-manifest.json"
            manifest_path.write_text(json.dumps({"edges": [{"fromId": "P0", "toId": "P1"}]}), encoding="utf-8")
            snap_store_path = tmp_path / "snap-store.json"

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=str(snap_store_path), refresh_snap_places=False)
            with mock.patch.object(vws, "query_ors_snap", return_value=[1.0, 2.0]), \
                 mock.patch.object(vws, "query_ors_with_retry") as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.backfill_snap_places(args)
            mock_directions.assert_not_called()


class ScaleExecuteCacheResumeTests(unittest.TestCase):
    """--execute must be restart-safe: a cached validated edge is skipped (never
    re-queried) unless --refresh, exactly like the pilot's --execute."""

    def _setup(self, tmp_path):
        places = [fake_place("P0", 35.0, 139.0), fake_place("P1", 35.001, 139.001), fake_place("P2", 35.002, 139.002)]
        nearby = [nearby_row("P0", "P1"), nearby_row("P1", "P2")]
        data_dir = write_dataset(tmp_path, places, nearby)
        manifest_path = tmp_path / "scale-manifest.json"
        manifest_path.write_text(json.dumps({"edges": [{"fromId": "P0", "toId": "P1"}, {"fromId": "P1", "toId": "P2"}]}), encoding="utf-8")
        return data_dir, manifest_path

    def test_cached_validated_edge_is_skipped_and_directions_not_recalled(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path = self._setup(tmp_path)
            results_path = tmp_path / "results.json"
            app_results_path = tmp_path / "app-results.json"
            cached = [{
                "fromId": "P0", "toId": "P1", "status": "validated", "provider": "openrouteservice",
                "profile": "foot-walking", "distance": {"meters": 50.0}, "minutes": {"minMinutes": 1, "maxMinutes": 1},
                "confidence": "validated-static", "verifiedAt": "t0",
                "source": {"kind": "routing-provider", "provider": "openrouteservice", "profile": "foot-walking"},
                "query": {"fromCoordinates": [139.0, 35.0], "toCoordinates": [139.001, 35.001]},
            }]
            results_path.write_text(json.dumps(cached), encoding="utf-8")

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=None, refresh=False)
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_results_path), \
                 mock.patch.object(vws, "SNAP_PLACES_PATH", tmp_path / "no-store.json"), \
                 mock.patch.object(vws, "query_ors_with_retry") as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                mock_directions.return_value = ((80.0, 60.0), None)
                exit_code = vws.execute(args)

            self.assertEqual(exit_code, 0)
            mock_directions.assert_called_once()  # only P1->P2, not the cached P0->P1
            called_from_id = mock_directions.call_args.args[1]["id"]
            self.assertEqual(called_from_id, "P1")

    def test_refresh_forces_requery_of_cached_edge(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path = self._setup(tmp_path)
            results_path = tmp_path / "results.json"
            app_results_path = tmp_path / "app-results.json"
            cached = [{
                "fromId": "P0", "toId": "P1", "status": "validated", "provider": "openrouteservice",
                "profile": "foot-walking", "distance": {"meters": 50.0}, "minutes": {"minMinutes": 1, "maxMinutes": 1},
                "confidence": "validated-static", "verifiedAt": "t0",
                "source": {"kind": "routing-provider", "provider": "openrouteservice", "profile": "foot-walking"},
                "query": {"fromCoordinates": [139.0, 35.0], "toCoordinates": [139.001, 35.001]},
            }]
            results_path.write_text(json.dumps(cached), encoding="utf-8")

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=None, refresh=True)
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_results_path), \
                 mock.patch.object(vws, "SNAP_PLACES_PATH", tmp_path / "no-store.json"), \
                 mock.patch.object(vws, "query_ors_with_retry", return_value=((80.0, 60.0), None)) as mock_directions, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                exit_code = vws.execute(args)

            self.assertEqual(exit_code, 0)
            self.assertEqual(mock_directions.call_count, 2)  # both edges re-queried

    def test_execute_never_calls_snap_directly(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path = self._setup(tmp_path)
            results_path = tmp_path / "results.json"
            app_results_path = tmp_path / "app-results.json"

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=None, refresh=False)
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_results_path), \
                 mock.patch.object(vws, "SNAP_PLACES_PATH", tmp_path / "no-store.json"), \
                 mock.patch.object(vws, "query_ors_with_retry", return_value=((80.0, 60.0), None)), \
                 mock.patch.object(ors_client, "query_ors_snap") as mock_snap, \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.execute(args)
            mock_snap.assert_not_called()

    def test_execute_promotes_result_with_no_snap_data_as_unknown_not_zero(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            data_dir, manifest_path = self._setup(tmp_path)
            results_path = tmp_path / "results.json"
            app_results_path = tmp_path / "app-results.json"

            args = argparse.Namespace(manifest=str(manifest_path), data_dir=str(data_dir), snap_places=None, refresh=False)
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_results_path), \
                 mock.patch.object(vws, "SNAP_PLACES_PATH", tmp_path / "no-store.json"), \
                 mock.patch.object(vws, "query_ors_with_retry", return_value=((80.0, 60.0), None)), \
                 mock.patch.dict("os.environ", {"ORS_API_KEY": "test-key"}):
                vws.execute(args)

            written = json.loads(results_path.read_text())
            for result in written:
                self.assertEqual(result["endpointSnapping"]["assessment"], "unknown")
                self.assertEqual(result["confidence"], "validated-static")  # schema unchanged; getBestTransfer gates it


class RecombineSnappingTests(unittest.TestCase):
    def test_recombine_updates_endpoint_snapping_without_new_network_call(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            places = [fake_place("P0", 35.0, 139.0), fake_place("P1", 35.001, 139.001)]
            data_dir = write_dataset(tmp_path, places, [])
            results_path = tmp_path / "results.json"
            app_results_path = tmp_path / "app-results.json"
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

            args = argparse.Namespace(data_dir=str(data_dir), snap_places=str(snap_store_path))
            with mock.patch.object(vws, "SCALE_RESULTS_PATH", results_path), \
                 mock.patch.object(vws, "APP_SCALE_RESULTS_PATH", app_results_path):
                exit_code = vws.recombine_snapping(args)

            self.assertEqual(exit_code, 0)
            written = json.loads(results_path.read_text())
            self.assertEqual(written[0]["endpointSnapping"]["assessment"], "clean")

    def test_recombine_noop_when_no_results_yet(self):
        args = argparse.Namespace(data_dir="data", snap_places=None)
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
        errors = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertEqual(errors, [])

    def test_snap_store_resolved_with_null_distance_is_flagged(self):
        place = fake_place("A", 35.0, 139.0)
        store = {"places": {"A": {"coordinates": place["coordinates"], "snappedDistanceMeters": None, "radiusMeters": 350, "status": "resolved"}}}
        errors = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("'resolved' but snappedDistanceMeters is null" in e for e in errors))

    def test_snap_store_unknown_with_nonzero_distance_is_flagged(self):
        place = fake_place("A", 35.0, 139.0)
        store = {"places": {"A": {"coordinates": place["coordinates"], "snappedDistanceMeters": 5.0, "radiusMeters": 350, "status": "unknown"}}}
        errors = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("status is 'unknown' but snappedDistanceMeters" in e for e in errors))

    def test_snap_store_unresolvable_place_id_is_flagged(self):
        place = fake_place("A", 35.0, 139.0)
        store = {"places": {"Z": common.build_snap_place_entry(place, 5.0, 350, "p", "prof", "t")}}
        errors = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("not a place id" in e for e in errors))

    def test_snap_store_stale_coordinates_flagged(self):
        original = fake_place("A", 35.0, 139.0)
        entry = common.build_snap_place_entry(original, 5.0, 350, "p", "prof", "t")
        moved = fake_place("A", 40.0, 140.0)
        store = {"places": {"A": entry}}
        errors = validate_logistics.check_snap_places_store(store, {"A"}, {"A": moved})
        self.assertTrue(any("stale" in e for e in errors))

    def test_snap_store_secret_like_key_is_flagged(self):
        place = fake_place("A", 35.0, 139.0)
        entry = common.build_snap_place_entry(place, 5.0, 350, "p", "prof", "t")
        entry["apiKey"] = "should-never-be-here"
        store = {"places": {"A": entry}}
        errors = validate_logistics.check_snap_places_store(store, {"A"}, {"A": place})
        self.assertTrue(any("secret" in e for e in errors))


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
        errors = validate_logistics.check_snap_places_store(store, places_ids, by_id)
        self.assertEqual(errors, [])

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
