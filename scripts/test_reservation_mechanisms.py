#!/usr/bin/env python3
"""Offline unit tests for validate-reservation-mechanisms.py."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("validate-reservation-mechanisms.py")
SPEC = importlib.util.spec_from_file_location("validate_reservation_mechanisms", SCRIPT)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


def provenance(**updates):
    value = {
        "sourceUrl": "https://example.test/official",
        "sourceEntity": "Synthetic official operator",
        "consultedAt": "2026-09-12",
        "evidence": "Synthetic official-evidence fixture.",
        "confidence": "official-explicit",
    }
    value.update(updates)
    return value


def valid_record(record_id="RM-JP-001-001", **updates):
    value = {
        "id": record_id,
        "placeId": "JP-001",
        "scope": "general-admission",
        "mechanism": {
            "kind": "monthly-fixed-release",
            "releaseDayOfMonth": 10,
            "releaseTimeLocal": "10:00",
            "sourceTimeZone": "Asia/Tokyo",
            "target": "subsequent-calendar-month",
        },
        "allocation": "not-stated",
        "status": "active",
        "provenance": provenance(),
    }
    value.update(updates)
    return value


class CatalogValidationTests(unittest.TestCase):
    PLACE_IDS = {"JP-001", "JP-002"}

    def errors(self, catalog):
        return validator.validate_catalog(catalog, self.PLACE_IDS)

    def assert_invalid(self, catalog, phrase):
        errors = self.errors(catalog)
        self.assertTrue(any(phrase in error for error in errors), errors)

    def test_empty_catalog_is_valid(self):
        self.assertEqual(self.errors([]), [])

    def test_valid_monthly_fixed_release(self):
        self.assertEqual(self.errors([valid_record()]), [])

    def test_valid_rolling_calendar_month_release(self):
        record = valid_record(
            mechanism={
                "kind": "rolling-calendar-month-release",
                "monthsBeforeVisit": 2,
                "alignment": "same-calendar-day",
                "missingAlignedDayRule": "first-day-of-next-month",
                "releaseTimeLocal": "14:00",
                "sourceTimeZone": "Asia/Tokyo",
            }
        )
        self.assertEqual(self.errors([record]), [])

    def test_valid_rolling_day_release(self):
        record = valid_record(
            mechanism={
                "kind": "rolling-day-release",
                "daysBeforeVisit": 30,
                "releaseTimeLocal": None,
                "sourceTimeZone": None,
            }
        )
        self.assertEqual(self.errors([record]), [])

    def test_valid_relative_application_window(self):
        record = valid_record(
            mechanism={
                "kind": "relative-application-window",
                "openRule": {
                    "kind": "month-offset-first-day",
                    "monthsBeforeVisitMonth": 3,
                    "timeLocal": "05:00",
                    "sourceTimeZone": None,
                },
                "closeRule": {
                    "kind": "days-before-visit",
                    "daysBeforeVisit": 3,
                    "timeLocal": "23:59",
                    "sourceTimeZone": None,
                },
            },
            allocation="lottery-if-oversubscribed",
        )
        self.assertEqual(self.errors([record]), [])

    def test_valid_fixed_sale_date(self):
        record = valid_record(
            mechanism={
                "kind": "fixed-sale-date",
                "saleDate": "2027-02-06",
                "releaseTimeLocal": None,
                "sourceTimeZone": None,
                "appliesToStartDate": "2027-03-14",
                "appliesToEndDate": "2027-03-28",
            }
        )
        self.assertEqual(self.errors([record]), [])

    def test_unknown_place_id_rejected(self):
        self.assert_invalid(
            [valid_record("RM-JP-999-001", placeId="JP-999")],
            "unknown placeId",
        )

    def test_malformed_and_wrong_namespace_ids_rejected(self):
        self.assert_invalid([valid_record("reservation-1")], "id must match")
        self.assert_invalid([valid_record("RM-JP-002-001")], "namespace")

    def test_duplicate_global_id_rejected(self):
        self.assert_invalid([valid_record(), valid_record()], "duplicate global id")

    def test_duplicate_active_place_scope_rejected(self):
        second = valid_record(
            "RM-JP-001-002",
            mechanism={
                "kind": "rolling-day-release",
                "daysBeforeVisit": 20,
                "releaseTimeLocal": None,
                "sourceTimeZone": None,
            },
        )
        self.assert_invalid([valid_record(), second], "duplicate active placeId + scope")

    def test_distinct_scopes_for_same_place_are_allowed(self):
        second = valid_record(
            "RM-JP-001-002",
            scope="workshop",
            mechanism={
                "kind": "rolling-day-release",
                "daysBeforeVisit": 20,
                "releaseTimeLocal": None,
                "sourceTimeZone": None,
            },
        )
        self.assertEqual(self.errors([valid_record(), second]), [])

    def test_closed_vocabularies_enforced(self):
        self.assert_invalid([valid_record(scope="restaurant")], "unsupported scope")
        self.assert_invalid([valid_record(allocation="probably-first-come")], "unsupported allocation")
        self.assert_invalid([valid_record(status="current")], "unsupported status")
        self.assert_invalid([valid_record(mechanism={"kind": "magic"})], "unsupported mechanism kind")

    def test_monthly_release_bounds_and_time_validated(self):
        record = valid_record()
        record["mechanism"]["releaseDayOfMonth"] = 32
        self.assert_invalid([record], "releaseDayOfMonth")
        record = valid_record()
        record["mechanism"]["releaseTimeLocal"] = "25:00"
        self.assert_invalid([record], "releaseTimeLocal")

    def test_rolling_month_requires_exact_alignment_contract(self):
        record = valid_record(
            mechanism={
                "kind": "rolling-calendar-month-release",
                "monthsBeforeVisit": 2,
                "alignment": "approximately-same-day",
                "missingAlignedDayRule": "first-day-of-next-month",
                "releaseTimeLocal": "14:00",
                "sourceTimeZone": "Asia/Tokyo",
            }
        )
        self.assert_invalid([record], "alignment must")

    def test_relative_window_rules_are_structurally_closed(self):
        record = valid_record(
            mechanism={
                "kind": "relative-application-window",
                "openRule": {
                    "kind": "month-offset-first-day",
                    "monthsBeforeVisitMonth": 0,
                    "timeLocal": "05:00",
                    "sourceTimeZone": None,
                },
                "closeRule": {
                    "kind": "days-before-visit",
                    "daysBeforeVisit": 3,
                    "timeLocal": "24:00",
                    "sourceTimeZone": None,
                },
            }
        )
        self.assert_invalid([record], "monthsBeforeVisitMonth")
        self.assert_invalid([record], "closeRule: timeLocal")

    def test_fixed_sale_date_rejects_invalid_or_inverted_scope_dates(self):
        record = valid_record(
            mechanism={
                "kind": "fixed-sale-date",
                "saleDate": "2027-02-30",
                "releaseTimeLocal": None,
                "sourceTimeZone": None,
                "appliesToStartDate": "2027-03-28",
                "appliesToEndDate": "2027-03-14",
            }
        )
        self.assert_invalid([record], "saleDate")
        self.assert_invalid([record], "must not be after")

    def test_only_supported_timezone_is_allowed(self):
        record = valid_record()
        record["mechanism"]["sourceTimeZone"] = "America/Mexico_City"
        self.assert_invalid([record], "sourceTimeZone")

    def test_provenance_is_mandatory_and_closed(self):
        self.assert_invalid([valid_record(provenance=None)], "provenance is required")
        self.assert_invalid([valid_record(provenance=provenance(sourceUrl="http://example.test"))], "https URL")
        self.assert_invalid([valid_record(provenance=provenance(consultedAt="2026-02-30"))], "consultedAt")
        self.assert_invalid(
            [valid_record(provenance=provenance(confidence="secondary-derived"))],
            "unsupported provenance confidence",
        )

    def test_unknown_fields_are_rejected(self):
        record = valid_record()
        record["urgency"] = "book-now"
        self.assert_invalid([record], "unsupported fields")
        record = valid_record()
        record["mechanism"]["availability"] = "open"
        self.assert_invalid([record], "unsupported fields")

    def test_secret_like_values_are_rejected(self):
        record = valid_record()
        record["provenance"]["apiKey"] = "synthetic-secret"
        errors = self.errors([record])
        self.assertTrue(any("possible secret" in error for error in errors), errors)


class ArtifactValidationTests(unittest.TestCase):
    def write_fixture(self, root, catalog, app_catalog=None):
        data = root / "data"
        app_dir = root / "app"
        data.mkdir()
        app_dir.mkdir()
        (data / "places.json").write_text(json.dumps([{"id": "JP-001"}]), encoding="utf-8")
        source = data / "reservation-mechanisms.json"
        source.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
        app = app_dir / "reservation-mechanisms.json"
        app.write_text(
            json.dumps(catalog if app_catalog is None else app_catalog, indent=2) + "\n",
            encoding="utf-8",
        )
        return source, app, data / "places.json"

    def test_source_app_byte_parity_mismatch_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, app, places = self.write_fixture(root, [], [valid_record()])
            errors = validator.validate(source, app, places)
            self.assertTrue(any("byte parity mismatch" in error for error in errors), errors)

    def test_matching_artifacts_are_valid(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, app, places = self.write_fixture(root, [valid_record()])
            self.assertEqual(validator.validate(source, app, places), [])


class RealCatalogTests(unittest.TestCase):
    ROOT = Path(__file__).resolve().parents[1]
    SOURCE = ROOT / "data/reservation-mechanisms.json"
    APP = ROOT / "app/src/data/reservation-mechanisms.json"
    PLACES = ROOT / "data/places.json"

    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(cls.SOURCE.read_text(encoding="utf-8"))

    def test_real_catalog_passes_validator(self):
        self.assertEqual(validator.validate(self.SOURCE, self.APP, self.PLACES), [])

    def test_source_and_app_are_byte_identical(self):
        self.assertEqual(
            self.SOURCE.read_text(encoding="utf-8"),
            self.APP.read_text(encoding="utf-8"),
        )

    def test_pilot_has_exactly_five_high_confidence_records(self):
        self.assertEqual(len(self.catalog), 5)
        self.assertEqual(
            {record["placeId"] for record in self.catalog},
            {"JP-044", "JP-077", "JP-203", "JP-204", "JP-212"},
        )
        self.assertTrue(
            all(record["provenance"]["confidence"] == "official-explicit" for record in self.catalog)
        )

    def test_every_record_uses_consultation_date_2026_09_12(self):
        self.assertTrue(
            all(record["provenance"]["consultedAt"] == "2026-09-12" for record in self.catalog)
        )

    def test_usj_nintendo_and_animejapan_are_intentionally_absent(self):
        present = {record["placeId"] for record in self.catalog}
        self.assertFalse({"JP-125", "JP-097", "JP-211"} & present)

    def test_no_runtime_action_fields_exist(self):
        forbidden = {
            "availability",
            "bookNow",
            "isOpen",
            "isLate",
            "urgency",
            "reminder",
            "notification",
            "inventory",
        }
        for record in self.catalog:
            with self.subTest(record=record["id"]):
                self.assertFalse(forbidden & set(record))


if __name__ == "__main__":
    unittest.main()
