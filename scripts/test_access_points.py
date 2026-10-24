#!/usr/bin/env python3
"""Offline unit tests for validate-access-points.py."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("validate-access-points.py")
SPEC = importlib.util.spec_from_file_location("validate_access_points", SCRIPT)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


def valid_point(point_id="AP-JP-001-001", **updates):
    point = {
        "id": point_id,
        "placeId": "JP-001",
        "label": "Synthetic entrance",
        "role": "gate",
        "coordinates": {"lat": 10.25, "lng": 20.5},
        "applicableContexts": ["external-walk"],
        "provenance": {
            "sourceUrl": "https://example.test/official-access",
            "sourceEntity": "Synthetic public authority",
            "consultedAt": "2026-01-02",
            "evidence": "Synthetic evidence, not a real POI coordinate.",
            "confidence": "official-explicit",
        },
        "selection": {},
        "status": "active",
    }
    point.update(updates)
    return point


class CatalogValidationTests(unittest.TestCase):
    def errors(self, catalog):
        return validator.validate_catalog(catalog, {"JP-001", "JP-002"})

    def assert_invalid(self, catalog, phrase):
        self.assertTrue(any(phrase in error for error in self.errors(catalog)), self.errors(catalog))

    def test_empty_artifact_is_valid(self):
        self.assertEqual(self.errors([]), [])

    def test_valid_synthetic_access_point(self):
        self.assertEqual(self.errors([valid_point()]), [])

    def test_label_must_be_a_non_empty_string(self):
        for invalid_label in (None, "", "   ", 123):
            with self.subTest(label=invalid_label):
                self.assert_invalid([valid_point(label=invalid_label)], "label must be")

    def test_notes_must_be_a_string_when_present(self):
        self.assert_invalid([valid_point(notes=["not", "text"])], "notes must be")

    def test_unknown_place_id(self):
        self.assert_invalid([valid_point(placeId="JP-999", id="AP-JP-999-001")], "unknown placeId")

    def test_malformed_and_wrong_namespace_ids(self):
        self.assert_invalid([valid_point("entrance-1")], "id must match")
        self.assert_invalid([valid_point("AP-JP-002-001")], "namespace")

    def test_duplicate_id(self):
        self.assert_invalid([valid_point(), valid_point()], "duplicate global id")

    def test_invalid_latitude_and_longitude(self):
        self.assert_invalid([valid_point(coordinates={"lat": 91, "lng": 20})], "lat must")
        self.assert_invalid([valid_point(coordinates={"lat": 10, "lng": -181})], "lng must")

    def test_missing_and_invalid_provenance_fields(self):
        self.assert_invalid([valid_point(provenance=None)], "provenance is required")
        point = valid_point()
        point["provenance"]["sourceUrl"] = "not a URL"
        self.assert_invalid([point], "sourceUrl")
        point = valid_point()
        point["provenance"]["consultedAt"] = "2026-02-30"
        self.assert_invalid([point], "consultedAt")
        point = valid_point()
        point["provenance"]["confidence"] = "secondary-derived"
        self.assert_invalid([point], "unsupported provenance confidence")

    def test_closed_role_and_context_vocabularies(self):
        self.assert_invalid([valid_point(role="door")], "unknown role")
        self.assert_invalid([valid_point(applicableContexts=["teleport"])], "unknown context")
        self.assert_invalid([valid_point(applicableContexts=[])], "non-empty")
        self.assert_invalid(
            [valid_point(applicableContexts=["external-walk", "external-walk"])], "duplicate context"
        )

    def test_multiple_defaults_same_place_context(self):
        first = valid_point(selection={"defaultForContexts": ["external-walk"]})
        second = valid_point("AP-JP-001-002", coordinates={"lat": 11, "lng": 21}, selection={"defaultForContexts": ["external-walk"]})
        self.assert_invalid([first, second], "multiple active defaults")

    def test_selection_shape_and_default_context_integrity(self):
        missing = valid_point()
        del missing["selection"]
        self.assert_invalid([missing], "selection must be an object")
        self.assert_invalid([valid_point(selection="external-walk")], "selection must be an object")
        self.assert_invalid(
            [valid_point(selection={"defaultForContexts": "external-walk"})],
            "defaultForContexts must be an array",
        )
        self.assert_invalid(
            [valid_point(selection={"defaultForContexts": ["external-walk", "external-walk"]})],
            "defaultForContexts contains a duplicate",
        )
        self.assert_invalid(
            [valid_point(selection={"defaultForContexts": ["teleport"]})],
            "unknown default context",
        )
        self.assert_invalid(
            [valid_point(selection={"defaultForContexts": ["internal-hike"]})],
            "is not applicable",
        )

    def test_deprecated_default(self):
        self.assert_invalid(
            [valid_point(status="deprecated", selection={"defaultForContexts": ["external-walk"]})],
            "deprecated access point",
        )

    def test_duplicate_active_coordinates(self):
        self.assert_invalid([valid_point(), valid_point("AP-JP-001-002")], "duplicate active coordinates")

    def test_secret_like_values(self):
        point = valid_point()
        point["provenance"]["apiKey"] = "synthetic-secret-value"
        self.assert_invalid([point], "possible secret")

    def test_multiple_distinct_points_for_one_place_are_valid(self):
        second = valid_point("AP-JP-001-002", coordinates={"lat": 11, "lng": 21})
        self.assertEqual(self.errors([valid_point(), second]), [])

    def test_reception_and_trailhead_with_distinct_contexts_are_valid(self):
        reception = valid_point(role="reception", applicableContexts=["external-walk"])
        trailhead = valid_point(
            "AP-JP-001-002", role="trailhead", coordinates={"lat": 11, "lng": 21},
            applicableContexts=["internal-hike"],
        )
        self.assertEqual(self.errors([reception, trailhead]), [])


class ArtifactValidationTests(unittest.TestCase):
    def write_fixture(self, root, catalog, app_catalog=None, extra_logistics=None):
        data = root / "data"
        logistics = data / "logistics"
        logistics.mkdir(parents=True)
        (data / "places.json").write_text(json.dumps([{"id": "JP-001"}]), encoding="utf-8")
        (logistics / "access-points.json").write_text(json.dumps(catalog), encoding="utf-8")
        if extra_logistics is not None:
            (logistics / "future-results.json").write_text(json.dumps(extra_logistics), encoding="utf-8")
        app = root / "app-access-points.json"
        app.write_text(json.dumps(catalog if app_catalog is None else app_catalog), encoding="utf-8")
        return data, app

    def test_app_source_parity_mismatch(self):
        with tempfile.TemporaryDirectory() as temporary:
            data, app = self.write_fixture(Path(temporary), [], [valid_point()])
            self.assertTrue(any("parity mismatch" in error for error in validator.validate(data, app)))

    def test_orphan_access_point_reference(self):
        with tempfile.TemporaryDirectory() as temporary:
            endpoint = {"fromEndpoint": {"kind": "access-point", "accessPointId": "AP-JP-001-999"}}
            data, app = self.write_fixture(Path(temporary), [], extra_logistics=endpoint)
            self.assertTrue(any("orphan" in error for error in validator.validate(data, app)))

    def test_endpoint_place_must_match_referenced_access_point(self):
        with tempfile.TemporaryDirectory() as temporary:
            catalog = [valid_point()]
            endpoint = {
                "fromEndpoint": {
                    "kind": "access-point",
                    "placeId": "JP-002",
                    "accessPointId": "AP-JP-001-001",
                }
            }
            data, app = self.write_fixture(Path(temporary), catalog, extra_logistics=endpoint)
            errors = validator.validate(data, app)
            self.assertTrue(any("endpoint placeId" in error and "does not match" in error for error in errors))

    def test_matching_artifacts_are_valid(self):
        with tempfile.TemporaryDirectory() as temporary:
            catalog = [valid_point()]
            data, app = self.write_fixture(Path(temporary), catalog)
            self.assertEqual(validator.validate(data, app), [])



class RealCatalogTests(unittest.TestCase):
    """Guards the real, evidenced catalog — not the synthetic fixtures above."""

    ROOT = Path(__file__).resolve().parents[1]
    SOURCE = ROOT / "data/logistics/access-points.json"
    APP = ROOT / "app/src/data/logistics/access-points.json"

    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(cls.SOURCE.read_text(encoding="utf-8"))

    def test_real_catalog_passes_the_validator(self):
        self.assertEqual(validator.validate(self.ROOT / "data", self.APP), [])

    def test_root_and_app_copies_are_identical(self):
        self.assertEqual(
            self.catalog, json.loads(self.APP.read_text(encoding="utf-8"))
        )
        self.assertEqual(
            self.SOURCE.read_text(encoding="utf-8"), self.APP.read_text(encoding="utf-8")
        )

    def test_identifiers_are_unique(self):
        ids = [point["id"] for point in self.catalog]
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_active_point_carries_official_provenance(self):
        for point in self.catalog:
            with self.subTest(point=point["id"]):
                provenance = point["provenance"]
                self.assertIn(provenance["confidence"], validator.CONFIDENCES)
                self.assertTrue(provenance["sourceUrl"].startswith("https://"))
                for field in ("sourceEntity", "evidence", "consultedAt"):
                    self.assertTrue(provenance[field].strip())

    def test_no_access_point_claims_a_default(self):
        """Three official gates do not make one of them the answer; see
        docs/ACCESS_POINT_EVIDENCE.md. A default must be added evidence-first."""
        for point in self.catalog:
            with self.subTest(point=point["id"]):
                self.assertEqual(point["selection"].get("defaultForContexts", []), [])

    def test_internal_stages_are_never_externally_applicable(self):
        external = {"external-walk", "external-local-transit"}
        internal = {"internal-shuttle", "internal-hike"}
        for point in self.catalog:
            contexts = set(point["applicableContexts"])
            with self.subTest(point=point["id"]):
                self.assertFalse(contexts & internal and contexts & external)

    def test_no_access_point_reuses_its_place_display_coordinate(self):
        places = {
            place["id"]: place
            for place in json.loads((self.ROOT / "data/places.json").read_text(encoding="utf-8"))
        }
        for point in self.catalog:
            display = places[point["placeId"]]["coordinates"]
            with self.subTest(point=point["id"]):
                self.assertNotEqual(
                    (display["lat"], display["lng"]),
                    (point["coordinates"]["lat"], point["coordinates"]["lng"]),
                )

    def test_excluded_places_have_no_access_point(self):
        """JP-064/JP-069 lack sufficient evidence and JP-090's no-route results are
        provider behaviour, not physical provenance."""
        excluded = {"JP-064", "JP-069", "JP-090"}
        self.assertEqual(
            excluded & {point["placeId"] for point in self.catalog}, set()
        )


if __name__ == "__main__":
    unittest.main()
