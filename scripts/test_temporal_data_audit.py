#!/usr/bin/env python3
"""Offline tests for Phase 3D-A's temporal data audit (`temporal_data_lib.py` and
`audit-temporal-data.py`). No network access, no dataset mutation.

Usage:
    python3 scripts/test_temporal_data_audit.py
"""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

import temporal_data_lib as lib  # noqa: E402


def load_module(filename, name):
    """Loads a hyphenated CLI script as an importable module — the same helper
    `test_walking_pilot.py` uses, since `audit-temporal-data.py` isn't a valid module name."""
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


audit = load_module("audit-temporal-data.py", "audit_temporal_data")


class ClassifyHoursTest(unittest.TestCase):
    def test_known_24h_public_space(self):
        self.assertEqual(lib.classify_hours("Espacio público 24 h"), "known-24h")
        self.assertEqual(lib.HOURS_TIER["known-24h"], "SAFE")

    def test_fixed_interval_clean_is_safe(self):
        self.assertEqual(lib.classify_hours("09:00–17:00"), "fixed-interval-clean")
        self.assertEqual(lib.HOURS_TIER["fixed-interval-clean"], "SAFE")

    def test_variable_by_date_is_unknown_not_guessed(self):
        self.assertEqual(lib.classify_hours("Variable por fecha"), "explicit-unknown-variable")
        self.assertEqual(lib.HOURS_TIER["explicit-unknown-variable"], "UNKNOWN")

    def test_weather_dependent_takes_priority_over_third_party(self):
        # "Según operador y clima" matches both a generic "según X" shape and an
        # environment-dependence keyword; weather/tide must win because knowing WHY it's opaque
        # (weather, not just "some third party") is the more informative fact.
        self.assertEqual(lib.classify_hours("Según operador y clima"), "weather-or-tide-dependent")
        self.assertEqual(lib.HOURS_TIER["weather-or-tide-dependent"], "OPAQUE")

    def test_missing_is_never_a_guessed_category(self):
        self.assertEqual(lib.classify_hours(None), "missing")
        self.assertEqual(lib.classify_hours(""), "missing")
        self.assertEqual(lib.classify_hours("   "), "missing")
        self.assertEqual(lib.HOURS_TIER["missing"], "UNKNOWN")

    def test_unrecognized_text_stays_unknown_never_promoted(self):
        category = lib.classify_hours("Zzyzx quantum flux schedule")
        self.assertEqual(category, "qualitative-uncategorized")
        self.assertEqual(lib.HOURS_TIER[category], "UNKNOWN")

    def test_solar_relative_without_clock_time(self):
        self.assertEqual(lib.classify_hours("Amanecer–atardecer; varía por mes"), "solar-relative")

    def test_ambiguous_alternative_interval(self):
        self.assertEqual(lib.classify_hours("09:00–16:00/16:30"), "ambiguous-alternative-interval")

    def test_deterministic_repeated_classification(self):
        text = "10:00–17:00 aprox.; verificar exposición"
        results = {lib.classify_hours(text) for _ in range(5)}
        self.assertEqual(len(results), 1)


class ClassifyClosuresTest(unittest.TestCase):
    def test_no_known_closure_is_safe(self):
        self.assertEqual(lib.classify_closures("Sin cierre ordinario"), "no-known-closure")
        self.assertEqual(lib.classify_closures("Sin cierre"), "no-known-closure")
        self.assertEqual(lib.CLOSURES_TIER["no-known-closure"], "SAFE")

    def test_weather_dependent_closure(self):
        self.assertEqual(lib.classify_closures("Clima/mantenimiento"), "weather-or-tide-dependent")
        self.assertEqual(lib.CLOSURES_TIER["weather-or-tide-dependent"], "OPAQUE")

    def test_explicit_weekday_closure_exists_in_real_dataset(self):
        # Per item 12 of the phase brief: only assert a weekday-closure example if the real
        # dataset actually has one — it does ("Lunes; verificar" and siblings).
        self.assertEqual(lib.classify_closures("Lunes; verificar"), "recurring-weekday-named")
        self.assertEqual(lib.CLOSURES_TIER["recurring-weekday-named"], "PARTIAL")

    def test_irregular_weekday_qualifier_is_never_a_safe_recurring_rule(self):
        # "Muchos domingos" reads like a weekday closure but the "muchos" qualifier means it
        # is NOT every Sunday — this must never collapse into the same bucket as a plain
        # single-weekday closure.
        self.assertEqual(lib.classify_closures("Muchos domingos"), "irregular-weekday-pattern")
        self.assertNotEqual(
            lib.classify_closures("Muchos domingos"), lib.classify_closures("Lunes; verificar")
        )
        self.assertEqual(lib.CLOSURES_TIER["irregular-weekday-pattern"], "OPAQUE")

    def test_missing_closure(self):
        self.assertEqual(lib.classify_closures(None), "missing")


class ClassifyBestTimeTest(unittest.TestCase):
    def test_never_infers_an_availability_interval(self):
        # bestTime is editorial recommendation text (docs/TEMPORAL_DATA_CONTRACT.md's "bestTime
        # boundary"). Even a string that LOOKS like an hours range must not be reclassified as
        # an hours-shaped category — this function only ever answers "present or not".
        self.assertEqual(lib.classify_best_time("Atardecer"), "editorial-recommendation")
        self.assertEqual(lib.classify_best_time("09:00-17:00"), "editorial-recommendation")
        self.assertEqual(lib.classify_best_time("Espacio público 24 h"), "editorial-recommendation")
        self.assertEqual(lib.BEST_TIME_TIER["editorial-recommendation"], "OPAQUE")

    def test_missing_best_time(self):
        self.assertEqual(lib.classify_best_time(None), "missing")


class ClassifyReservationTest(unittest.TestCase):
    def test_binary_values(self):
        self.assertEqual(lib.classify_reservation_raw("No"), "not-required")
        self.assertEqual(lib.classify_reservation_raw("Sí"), "required")
        self.assertEqual(lib.RESERVATION_RAW_TIER["not-required"], "SAFE")
        self.assertEqual(lib.RESERVATION_RAW_TIER["required"], "SAFE")

    def test_non_binary_values_are_never_silently_required_false(self):
        # These are the raw values the real dataset's `reservation.required` boolean collapses
        # into `false`, discarding a real nuance. The classifier must keep them distinguishable.
        self.assertEqual(lib.classify_reservation_raw("Recomendable"), "recommended-not-required")
        self.assertEqual(lib.classify_reservation_raw("Opcional"), "optional-not-required")
        self.assertEqual(lib.classify_reservation_raw("No para espectador"), "not-required-role-specific")
        for category in ("recommended-not-required", "optional-not-required", "not-required-role-specific"):
            self.assertEqual(lib.RESERVATION_RAW_TIER[category], "PARTIAL")

    def test_unrecognized_reservation_value_stays_unknown(self):
        category = lib.classify_reservation_raw("Quizás")
        self.assertEqual(category, "unrecognized-value")
        self.assertEqual(lib.RESERVATION_RAW_TIER[category], "UNKNOWN")


class ClassifyLeadTimeTest(unittest.TestCase):
    def test_not_applicable(self):
        self.assertEqual(lib.classify_lead_time("—"), "not-applicable")
        self.assertEqual(lib.classify_lead_time(None), "not-applicable")
        self.assertEqual(lib.LEAD_TIME_TIER["not-applicable"], "SAFE")

    def test_bare_magnitude(self):
        self.assertEqual(lib.classify_lead_time("Semanas"), "bare-magnitude")
        self.assertEqual(lib.classify_lead_time("1–2 semanas"), "bare-magnitude")
        self.assertEqual(lib.LEAD_TIME_TIER["bare-magnitude"], "PARTIAL")

    def test_opaque_mechanism_specific(self):
        category = lib.classify_lead_time("Lotería 3 meses antes; revisar liberaciones")
        self.assertEqual(category, "opaque-entity-or-mechanism-specific")
        self.assertEqual(lib.LEAD_TIME_TIER[category], "OPAQUE")


class ClassifyFebMarStatusTest(unittest.TestCase):
    def test_pending_is_unknown_not_open_or_closed(self):
        category = lib.classify_feb_mar_status("CALENDARIO / CONDICIÓN PENDIENTE")
        self.assertEqual(category, "pending-verification")
        self.assertEqual(lib.FEB_MAR_STATUS_TIER[category], "UNKNOWN")

    def test_confirmed_is_safe(self):
        self.assertEqual(lib.classify_feb_mar_status("ABIERTO CONFIRMADO"), "confirmed")
        self.assertEqual(lib.FEB_MAR_STATUS_TIER["confirmed"], "SAFE")

    def test_never_reads_warning_or_action_text(self):
        # classify_feb_mar_status takes only the status string. Passing a status that would
        # normally read as "confirmed" must classify identically regardless of what a
        # (hypothetical, not actually passed) warning field might say — there is no code path
        # here that could even see a warning, which this test pins down structurally: the
        # function signature takes exactly one argument.
        import inspect

        signature = inspect.signature(lib.classify_feb_mar_status)
        self.assertEqual(len(signature.parameters), 1)

    def test_status_categories_never_collide_with_hours_or_closure_categories(self):
        # febMar2027 is its own axis (docs/TEMPORAL_DATA_CONTRACT.md's "febMar2027 boundary").
        # Its category names must never be mistaken for an hours/closure fact by sharing a name
        # with one, aside from the shared generic "missing" sentinel every field uses.
        feb_mar_categories = set(lib.FEB_MAR_STATUS_TIER) - {"missing"}
        hours_categories = set(lib.HOURS_TIER) - {"missing"}
        closures_categories = set(lib.CLOSURES_TIER) - {"missing"}
        self.assertEqual(feb_mar_categories & hours_categories, set())
        self.assertEqual(feb_mar_categories & closures_categories, set())

    def test_unrecognized_status_stays_unknown(self):
        category = lib.classify_feb_mar_status("SOME NOVEL FUTURE STATUS")
        self.assertEqual(category, "uncategorized")
        self.assertEqual(lib.FEB_MAR_STATUS_TIER[category], "UNKNOWN")


class AuditFieldTest(unittest.TestCase):
    """Tests `audit_field`'s aggregation itself, with tiny synthetic fixtures — separate from
    any claim about the real dataset's coverage (see RealDatasetAuditTest below)."""

    def test_raw_editorial_text_preserved_verbatim_in_examples(self):
        places = [{"schedule": {"hours": "Espacio público 24 h"}}]
        categories, _ = audit.audit_field(
            places, lambda p: p["schedule"]["hours"], lib.classify_hours, lib.HOURS_TIER
        )
        self.assertIn("Espacio público 24 h", categories["known-24h"]["examples"])

    def test_tier_totals_sum_to_place_count(self):
        places = [
            {"schedule": {"hours": "Espacio público 24 h"}},
            {"schedule": {"hours": "Variable"}},
            {"schedule": {"hours": None}},
        ]
        _, tier_totals = audit.audit_field(
            places, lambda p: p["schedule"]["hours"], lib.classify_hours, lib.HOURS_TIER
        )
        self.assertEqual(sum(tier_totals.values()), len(places))

    def test_deterministic_repeated_aggregation(self):
        places = [{"schedule": {"hours": h}} for h in ["Variable", "Sin cierre", "09:00–17:00", None]]
        first = audit.audit_field(places, lambda p: p["schedule"]["hours"], lib.classify_hours, lib.HOURS_TIER)
        second = audit.audit_field(places, lambda p: p["schedule"]["hours"], lib.classify_hours, lib.HOURS_TIER)
        self.assertEqual(first, second)


class LoadPlacesMalformedInputTest(unittest.TestCase):
    def _write(self, tmp_dir, content):
        path = Path(tmp_dir) / "places.json"
        path.write_text(content, encoding="utf-8")
        return Path(tmp_dir)

    def test_missing_file_fails_clearly(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(Path(tmp))
            self.assertIn("does not exist", str(ctx.exception))

    def test_non_array_json_fails_clearly(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = self._write(tmp, json.dumps({"not": "a list"}))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            self.assertIn("non-empty JSON array", str(ctx.exception))

    def test_invalid_json_fails_clearly(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = self._write(tmp, "{not valid json")
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            self.assertIn("not valid JSON", str(ctx.exception))

    def test_missing_required_field_fails_clearly(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = self._write(tmp, json.dumps([{"id": "X-1"}]))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            self.assertIn("missing required field", str(ctx.exception))

    def test_missing_nested_schedule_field_fails_clearly(self):
        with tempfile.TemporaryDirectory() as tmp:
            place = {
                "id": "X-1",
                "schedule": {"hours": "09:00-17:00"},  # missing "closures"
                "bestTime": "Mañana",
                "reservation": {"required": False, "leadTime": "—", "raw": "No"},
                "febMar2027": {"status": "OK", "warning": "", "action": ""},
            }
            data_dir = self._write(tmp, json.dumps([place]))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            self.assertIn("schedule.closures", str(ctx.exception))


class RealDatasetAuditTest(unittest.TestCase):
    """Runs the audit against the real, checked-out `data/places.json` — read-only, zero
    network. These assert structural properties and coverage-existence claims (e.g. "at least
    one weekday-closure example currently exists"), never a fragile exact count that a future,
    legitimate workbook update would be expected to break — mirroring
    `scripts/validate-dataset.py`'s own convention of not hardcoding counts that change with the
    workbook."""

    @classmethod
    def setUpClass(cls):
        cls.places = audit.load_places(REPO_ROOT / "data")

    def test_place_count_matches_app_copy(self):
        app_places = audit.load_places(REPO_ROOT / "app" / "src" / "data")
        self.assertEqual(self.places, app_places)

    def test_every_field_tier_totals_cover_all_places(self):
        total = len(self.places)
        for extractor, classifier, tier_map in (
            (lambda p: p["schedule"]["hours"], lib.classify_hours, lib.HOURS_TIER),
            (lambda p: p["schedule"]["closures"], lib.classify_closures, lib.CLOSURES_TIER),
            (lambda p: p["bestTime"], lib.classify_best_time, lib.BEST_TIME_TIER),
            (lambda p: p["reservation"]["raw"], lib.classify_reservation_raw, lib.RESERVATION_RAW_TIER),
            (lambda p: p["reservation"]["leadTime"], lib.classify_lead_time, lib.LEAD_TIME_TIER),
            (lambda p: p["febMar2027"]["status"], lib.classify_feb_mar_status, lib.FEB_MAR_STATUS_TIER),
        ):
            _, tier_totals = audit.audit_field(self.places, extractor, classifier, tier_map)
            self.assertEqual(sum(tier_totals.values()), total)

    def test_weekday_closure_example_currently_exists(self):
        categories = {lib.classify_closures(p["schedule"]["closures"]) for p in self.places}
        self.assertIn("recurring-weekday-named", categories)

    def test_no_closure_example_currently_exists(self):
        categories = {lib.classify_closures(p["schedule"]["closures"]) for p in self.places}
        self.assertIn("no-known-closure", categories)

    def test_known_24h_example_currently_exists(self):
        categories = {lib.classify_hours(p["schedule"]["hours"]) for p in self.places}
        self.assertIn("known-24h", categories)

    def test_variable_by_date_example_currently_exists(self):
        raws = {p["schedule"]["hours"] for p in self.places}
        self.assertIn("Variable por fecha", raws)
        self.assertEqual(lib.classify_hours("Variable por fecha"), "explicit-unknown-variable")

    def test_weather_dependent_example_currently_exists(self):
        categories = {lib.classify_closures(p["schedule"]["closures"]) for p in self.places}
        self.assertIn("weather-or-tide-dependent", categories)

    def test_non_binary_reservation_raw_count_matches_manual_recount(self):
        non_binary = {"recommended-not-required", "optional-not-required", "not-required-role-specific"}
        count = sum(1 for p in self.places if lib.classify_reservation_raw(p["reservation"]["raw"]) in non_binary)
        manual_recount = sum(
            1 for p in self.places if p["reservation"]["raw"] not in ("No", "Sí") and p["reservation"]["raw"]
        )
        self.assertEqual(count, manual_recount)
        self.assertGreater(count, 0)


class CliDeterminismTest(unittest.TestCase):
    """Runs the actual CLI script as a subprocess against the real dataset, exactly as a user
    would, and checks stdout is byte-identical across two runs."""

    def test_two_runs_produce_identical_stdout(self):
        script = SCRIPTS_DIR / "audit-temporal-data.py"
        first = subprocess.run(
            [sys.executable, str(script), str(REPO_ROOT / "data")],
            capture_output=True, text=True, check=True,
        )
        second = subprocess.run(
            [sys.executable, str(script), str(REPO_ROOT / "data")],
            capture_output=True, text=True, check=True,
        )
        self.assertEqual(first.stdout, second.stdout)
        self.assertEqual(first.returncode, 0)

    def test_cli_makes_no_dataset_modification(self):
        path = REPO_ROOT / "data" / "places.json"
        before = path.read_bytes()
        subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "audit-temporal-data.py"), str(REPO_ROOT / "data")],
            capture_output=True, check=True,
        )
        after = path.read_bytes()
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
