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
        "purchaseResidenceContext": "not-recorded",
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

    def test_valid_monthly_application_window(self):
        record = valid_record(
            mechanism={
                "kind": "monthly-application-window",
                "monthsBeforeVisitMonth": 3,
                "openDay": {"kind": "fixed-day-of-month", "day": 1},
                "closeDay": {"kind": "last-day-of-month"},
                "openTimeLocal": None,
                "openSourceTimeZone": None,
                "closeTimeLocal": None,
                "closeSourceTimeZone": None,
            },
            allocation="drawing",
        )
        self.assertEqual(self.errors([record]), [])

    def test_monthly_application_window_rejects_inverted_fixed_days(self):
        record = valid_record(
            mechanism={
                "kind": "monthly-application-window",
                "monthsBeforeVisitMonth": 3,
                "openDay": {"kind": "fixed-day-of-month", "day": 20},
                "closeDay": {"kind": "fixed-day-of-month", "day": 12},
                "openTimeLocal": None,
                "openSourceTimeZone": None,
                "closeTimeLocal": None,
                "closeSourceTimeZone": None,
            }
        )
        self.assert_invalid([record], "openDay must not be after fixed closeDay")

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

    def test_purchase_residence_context_is_required_and_closed(self):
        missing = valid_record()
        del missing["purchaseResidenceContext"]
        self.assert_invalid([missing], "missing fields")
        self.assert_invalid(
            [valid_record(purchaseResidenceContext="worldwide")],
            "unsupported purchaseResidenceContext",
        )
        self.assert_invalid(
            [valid_record(purchaseResidenceContext={"kind": "resides-outside-japan"})],
            "unsupported purchaseResidenceContext",
        )
        self.assertEqual(
            self.errors([valid_record(purchaseResidenceContext="resides-in-japan")]),
            [],
        )
        self.assertEqual(
            self.errors([valid_record(purchaseResidenceContext="resides-outside-japan")]),
            [],
        )

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

    COLLISION_PHRASE = "active same-scope collision group"

    def second_same_scope(self, **updates):
        """A second active JP-001 general-admission record with a different mechanism."""
        return valid_record(
            "RM-JP-001-002",
            mechanism={
                "kind": "rolling-day-release",
                "daysBeforeVisit": 20,
                "releaseTimeLocal": None,
                "sourceTimeZone": None,
            },
            **updates,
        )

    def test_active_same_scope_collision_with_specific_contexts_is_accepted(self):
        self.assertEqual(
            self.errors(
                [
                    valid_record(purchaseResidenceContext="resides-outside-japan"),
                    self.second_same_scope(purchaseResidenceContext="resides-in-japan"),
                ]
            ),
            [],
        )

    def test_two_active_same_scope_records_may_share_one_specific_context(self):
        """Residence context is applicability evidence, not identity: sharing it is not a clash."""
        self.assertEqual(
            self.errors(
                [
                    valid_record(purchaseResidenceContext="resides-in-japan"),
                    self.second_same_scope(purchaseResidenceContext="resides-in-japan"),
                ]
            ),
            [],
        )

    def test_active_same_scope_collision_containing_one_not_recorded_is_rejected(self):
        self.assert_invalid(
            [
                valid_record(purchaseResidenceContext="resides-in-japan"),
                self.second_same_scope(purchaseResidenceContext="not-recorded"),
            ],
            self.COLLISION_PHRASE,
        )

    def test_not_recorded_is_rejected_even_when_it_is_read_first(self):
        """The group is judged after the whole catalog is read, not record-by-record."""
        self.assert_invalid(
            [
                valid_record(purchaseResidenceContext="not-recorded"),
                self.second_same_scope(purchaseResidenceContext="resides-in-japan"),
            ],
            self.COLLISION_PHRASE,
        )

    def test_active_same_scope_collision_of_only_not_recorded_is_rejected(self):
        errors = self.errors([valid_record(), self.second_same_scope()])
        offenders = [error for error in errors if self.COLLISION_PHRASE in error]
        self.assertEqual(len(offenders), 2, errors)

    def test_solitary_active_not_recorded_record_remains_valid(self):
        self.assertEqual(self.errors([valid_record()]), [])

    def test_superseded_same_scope_record_does_not_trigger_the_collision_guard(self):
        self.assertEqual(
            self.errors([valid_record(), self.second_same_scope(status="superseded")]),
            [],
        )

    def test_superseded_records_may_collide_freely_among_themselves(self):
        self.assertEqual(
            self.errors(
                [
                    valid_record(status="superseded"),
                    self.second_same_scope(status="superseded"),
                ]
            ),
            [],
        )

    def test_no_place_scope_context_uniqueness_rule_exists(self):
        """Three active same-scope records sharing one specific context stay structurally valid."""
        third = valid_record(
            "RM-JP-001-003",
            purchaseResidenceContext="resides-in-japan",
            mechanism={
                "kind": "rolling-day-release",
                "daysBeforeVisit": 30,
                "releaseTimeLocal": None,
                "sourceTimeZone": None,
            },
        )
        self.assertEqual(
            self.errors(
                [
                    valid_record(purchaseResidenceContext="resides-in-japan"),
                    self.second_same_scope(purchaseResidenceContext="resides-in-japan"),
                    third,
                ]
            ),
            [],
        )

    def test_collision_guard_does_not_weaken_global_id_uniqueness(self):
        self.assert_invalid(
            [
                valid_record(purchaseResidenceContext="resides-in-japan"),
                valid_record(purchaseResidenceContext="resides-outside-japan"),
            ],
            "duplicate global id",
        )

    def test_collision_guard_does_not_weaken_id_namespace_matching(self):
        self.assert_invalid(
            [
                valid_record(purchaseResidenceContext="resides-in-japan"),
                valid_record(
                    "RM-JP-002-001",
                    placeId="JP-001",
                    purchaseResidenceContext="resides-outside-japan",
                ),
            ],
            "id namespace does not match placeId",
        )

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

    def test_catalog_has_five_original_records_plus_nintendo_and_both_pokepark_routes(self):
        self.assertEqual(len(self.catalog), 8)
        self.assertEqual(
            {record["placeId"] for record in self.catalog},
            {"JP-044", "JP-050", "JP-077", "JP-097", "JP-203", "JP-204", "JP-212"},
        )

        nintendo = next(record for record in self.catalog if record["placeId"] == "JP-097")
        self.assertEqual(nintendo["id"], "RM-JP-097-001")
        self.assertEqual(nintendo["scope"], "general-admission")
        self.assertEqual(nintendo["allocation"], "drawing")
        self.assertEqual(nintendo["mechanism"]["kind"], "monthly-application-window")
        self.assertEqual(nintendo["provenance"]["consultedAt"], "2026-09-13")
        self.assertEqual(nintendo["provenance"]["confidence"], "official-derived")
        self.assertEqual(
            nintendo["provenance"]["sourceUrl"],
            "https://museum-tickets.nintendo.com/en",
        )
        self.assertIn(
            "https://museum-tickets.nintendo.com/en/calendar?lang=en",
            nintendo["provenance"]["evidence"],
        )

        pokepark = next(record for record in self.catalog if record["id"] == "RM-JP-050-001")
        self.assertEqual(pokepark["id"], "RM-JP-050-001")
        self.assertEqual(pokepark["scope"], "general-admission")
        self.assertEqual(pokepark["purchaseResidenceContext"], "resides-outside-japan")
        self.assertEqual(pokepark["allocation"], "drawing")
        self.assertEqual(pokepark["status"], "active")
        self.assertEqual(
            pokepark["mechanism"],
            {
                "kind": "monthly-application-window",
                "monthsBeforeVisitMonth": 3,
                "openDay": {"kind": "fixed-day-of-month", "day": 1},
                "closeDay": {"kind": "fixed-day-of-month", "day": 12},
                "openTimeLocal": "20:00",
                "openSourceTimeZone": "Asia/Tokyo",
                "closeTimeLocal": None,
                "closeSourceTimeZone": None,
            },
        )
        self.assertEqual(pokepark["provenance"]["consultedAt"], "2026-09-14")
        self.assertEqual(pokepark["provenance"]["confidence"], "official-explicit")
        self.assertEqual(
            pokepark["provenance"]["sourceUrl"],
            "https://ticket-en.pokepark-kanto.co.jp/?viewLang=en",
        )
        self.assertIn("outside Japan", pokepark["provenance"]["evidence"])
        self.assertIn("8:00 PM JST", pokepark["provenance"]["evidence"])
        self.assertIn("lottery redraws", pokepark["provenance"]["evidence"])
        self.assertIn(
            "https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US",
            pokepark["provenance"]["evidence"],
        )
        self.assertNotIn("first-come", json.dumps(pokepark["mechanism"]))

        self.assertEqual(
            [record["purchaseResidenceContext"] for record in self.catalog],
            [
                "not-recorded",
                "not-recorded",
                "not-recorded",
                "not-recorded",
                "not-recorded",
                "not-recorded",
                "resides-outside-japan",
                "resides-in-japan",
            ],
        )

    def test_pokepark_has_exactly_two_active_general_admission_records(self):
        pokepark = [record for record in self.catalog if record["placeId"] == "JP-050"]
        self.assertEqual([record["id"] for record in pokepark], ["RM-JP-050-001", "RM-JP-050-002"])
        active = [
            record
            for record in pokepark
            if record["status"] == "active" and record["scope"] == "general-admission"
        ]
        self.assertEqual([record["id"] for record in active], ["RM-JP-050-001", "RM-JP-050-002"])
        self.assertEqual(
            [record["purchaseResidenceContext"] for record in active],
            ["resides-outside-japan", "resides-in-japan"],
        )

    def test_pokepark_domestic_drawing_record_matches_the_official_evidence(self):
        record = next(item for item in self.catalog if item["id"] == "RM-JP-050-002")
        self.assertEqual(record["placeId"], "JP-050")
        self.assertEqual(record["scope"], "general-admission")
        self.assertEqual(record["purchaseResidenceContext"], "resides-in-japan")
        self.assertEqual(record["status"], "active")
        self.assertEqual(record["allocation"], "drawing")
        self.assertEqual(
            record["mechanism"],
            {
                "kind": "monthly-application-window",
                "monthsBeforeVisitMonth": 3,
                "openDay": {"kind": "fixed-day-of-month", "day": 1},
                "closeDay": {"kind": "fixed-day-of-month", "day": 12},
                "openTimeLocal": "20:00",
                "openSourceTimeZone": "Asia/Tokyo",
                "closeTimeLocal": None,
                "closeSourceTimeZone": None,
            },
        )
        self.assertEqual(record["provenance"]["consultedAt"], "2026-09-15")
        self.assertEqual(record["provenance"]["confidence"], "official-explicit")
        self.assertEqual(
            record["provenance"]["sourceUrl"],
            "https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index",
        )
        evidence = record["provenance"]["evidence"]
        # The Japan-resident assignment must rest on a published routing statement, never on the
        # page language, locale, domain or source entity.
        self.assertIn("residents of Japan", evidence)
        self.assertIn("residing outside Japan", evidence)
        self.assertIn("not inferred from page language, locale, domain or source entity", evidence)
        self.assertIn("1st through the 12th", evidence)
        self.assertIn("three calendar months ahead", evidence)
        self.assertIn(
            "https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index",
            evidence,
        )
        self.assertIn(
            "https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US",
            evidence,
        )
        # The deferred domestic first-come route must not leak into the encoded mechanism.
        self.assertNotIn("first-come", json.dumps(record["mechanism"]))
        self.assertNotIn("rolling-calendar-month-release", json.dumps(record["mechanism"]))

    def test_no_domestic_first_come_record_and_no_shifted_month_rule_exist(self):
        serialized = json.dumps([record["mechanism"] for record in self.catalog])
        self.assertNotIn("last-day-of-shifted-month", serialized)
        self.assertNotIn("first-come", serialized)
        disney = [
            record
            for record in self.catalog
            if record["placeId"] in {"JP-203", "JP-204"}
        ]
        self.assertEqual(len(disney), 2)
        for record in disney:
            self.assertEqual(
                record["mechanism"]["missingAlignedDayRule"], "first-day-of-next-month"
            )

        pilots = [
            record
            for record in self.catalog
            if record["placeId"] not in {"JP-050", "JP-097"}
        ]
        self.assertTrue(
            all(record["provenance"]["confidence"] == "official-explicit" for record in pilots)
        )
        self.assertTrue(
            all(record["provenance"]["consultedAt"] == "2026-09-12" for record in pilots)
        )

    def test_phase_3f_n_explicit_exclusions_remain_absent(self):
        present = {record["placeId"] for record in self.catalog}
        self.assertFalse({"JP-002", "JP-125", "JP-126", "JP-211"} & present)
        self.assertIn("JP-050", present)
        self.assertIn("JP-097", present)

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
            "userResidence",
            "eligibility",
            "country",
        }
        for record in self.catalog:
            with self.subTest(record=record["id"]):
                self.assertFalse(forbidden & set(record))


if __name__ == "__main__":
    unittest.main()
