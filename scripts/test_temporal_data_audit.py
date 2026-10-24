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


class ClassifyHoursCaveated24hTest(unittest.TestCase):
    """A "24 h" token must never be promoted to SAFE merely because it is present, when a
    material weather/tide, third-party/operator, seasonal, or other explicit variability
    caveat sits alongside it — see docs/TEMPORAL_DATA_CONTRACT.md's normalization contract,
    rule 5. These are synthetic invariant checks: the real dataset already has one weather-
    caveated example ("Abierto 24 h; puede cerrar por viento", covered in
    RealDatasetAuditTest below), but the invariant must hold even for shapes the current
    checkout happens not to contain."""

    def test_clean_24h_stays_safe(self):
        self.assertEqual(lib.classify_hours("Espacio público 24 h"), "known-24h")
        self.assertEqual(lib.HOURS_TIER["known-24h"], "SAFE")

    def test_24h_with_weather_caveat_is_never_safe(self):
        category = lib.classify_hours("24 h; clima")
        self.assertEqual(category, "known-24h-with-caveat")
        self.assertNotEqual(lib.HOURS_TIER[category], "SAFE")

    def test_24h_with_operator_caveat_is_never_safe(self):
        category = lib.classify_hours("24 h según operador")
        self.assertEqual(category, "known-24h-with-caveat")
        self.assertNotEqual(lib.HOURS_TIER[category], "SAFE")

    def test_24h_with_seasonal_caveat_is_never_safe(self):
        category = lib.classify_hours("24 h según temporada")
        self.assertEqual(category, "known-24h-with-caveat")
        self.assertNotEqual(lib.HOURS_TIER[category], "SAFE")

    def test_24h_with_generic_variable_caveat_is_never_safe(self):
        category = lib.classify_hours("24 h; acceso variable")
        self.assertEqual(category, "known-24h-with-caveat")
        self.assertNotEqual(lib.HOURS_TIER[category], "SAFE")

    def test_caveated_24h_is_partial_not_opaque(self):
        # The 24h baseline itself is still a real, safely-extractable fact; only the caveat
        # clause is uncertain — that is exactly PARTIAL's definition, not OPAQUE's.
        self.assertEqual(lib.HOURS_TIER["known-24h-with-caveat"], "PARTIAL")

    def test_real_dataset_weather_caveated_24h_example(self):
        # The exact real string this fix was written for (see docs/TEMPORAL_DATA_CONTRACT.md).
        self.assertEqual(
            lib.classify_hours("Abierto 24 h; puede cerrar por viento"), "known-24h-with-caveat"
        )


class NormTypeSafetyTest(unittest.TestCase):
    """`_norm()` (used by every classifier in this module) must never silently stringify a
    value of the wrong type into text that would then classify as ordinary opaque/unknown
    text — that would hide a real data-quality defect. It is exercised indirectly through the
    public classifiers, which are what every other caller actually uses."""

    def test_classify_hours_rejects_non_string_number(self):
        with self.assertRaises(TypeError):
            lib.classify_hours(123)

    def test_classify_closures_rejects_list(self):
        with self.assertRaises(TypeError):
            lib.classify_closures(["Lunes"])

    def test_classify_editorial_prose_rejects_list(self):
        with self.assertRaises(TypeError):
            lib.classify_editorial_prose([])

    def test_classify_best_time_rejects_dict(self):
        with self.assertRaises(TypeError):
            lib.classify_best_time({"value": "Mañana"})

    def test_none_is_still_accepted_as_missing(self):
        # None is the one non-str value every classifier treats as a real, absent value —
        # the type guard must not reject it.
        self.assertEqual(lib.classify_hours(None), "missing")


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


class ClassifyReservationConsistencyTest(unittest.TestCase):
    """`reservation.required` is not independently trustworthy just because it exists —
    `classify_reservation_consistency` mechanically checks it against `reservation.raw` and
    the export pipeline's own documented rule, rather than assuming they always agree."""

    def test_binary_consistent_cases(self):
        self.assertEqual(lib.classify_reservation_consistency("No", False), "consistent-not-required")
        self.assertEqual(lib.classify_reservation_consistency("Sí", True), "consistent-required")

    def test_non_binary_consistent_with_required_false(self):
        # This is the exact mapping the real dataset's export pipeline produces for all 39
        # non-binary places — "consistent" here means "matches that pipeline's own rule",
        # not an endorsement that the nuance isn't lost (see docs/TEMPORAL_DATA_CONTRACT.md).
        self.assertEqual(
            lib.classify_reservation_consistency("Recomendable", False), "consistent-recommended-not-required"
        )
        self.assertEqual(
            lib.classify_reservation_consistency("Opcional", False), "consistent-optional-not-required"
        )
        self.assertEqual(
            lib.classify_reservation_consistency("No para espectador", False),
            "consistent-not-required-role-specific",
        )

    def test_inconsistent_cases_are_named_not_hidden(self):
        self.assertEqual(
            lib.classify_reservation_consistency("Sí", False), "inconsistent-required-required-False"
        )
        self.assertEqual(
            lib.classify_reservation_consistency("No", True), "inconsistent-not-required-required-True"
        )
        self.assertEqual(
            lib.classify_reservation_consistency("Recomendable", True),
            "inconsistent-recommended-not-required-required-True",
        )

    def test_rejects_non_bool_required(self):
        with self.assertRaises(TypeError):
            lib.classify_reservation_consistency("No", "false")
        with self.assertRaises(TypeError):
            lib.classify_reservation_consistency("No", 0)

    def test_deterministic_repeated_classification(self):
        results = {lib.classify_reservation_consistency("Recomendable", False) for _ in range(5)}
        self.assertEqual(len(results), 1)


class ClassifyEditorialProseTest(unittest.TestCase):
    """febMar2027.warning/.action must remain free prose for a human — this classifier answers
    presence only, exactly like classify_best_time, and must never branch on content."""

    def test_present_text_is_editorial_prose_regardless_of_content(self):
        self.assertEqual(lib.classify_editorial_prose("Reconfirmar en la web oficial."), "editorial-prose")
        # Even text that looks like it could be parsed (a weekday name, a clock time) must not
        # be reclassified — this function has no branch that could even see that content.
        self.assertEqual(lib.classify_editorial_prose("Cerrado los lunes 09:00-17:00"), "editorial-prose")
        self.assertEqual(lib.EDITORIAL_PROSE_TIER["editorial-prose"], "OPAQUE")

    def test_missing_prose(self):
        self.assertEqual(lib.classify_editorial_prose(None), "missing")
        self.assertEqual(lib.classify_editorial_prose(""), "missing")
        self.assertEqual(lib.EDITORIAL_PROSE_TIER["missing"], "UNKNOWN")

    def test_rejects_non_string_content(self):
        with self.assertRaises(TypeError):
            lib.classify_editorial_prose([])
        with self.assertRaises(TypeError):
            lib.classify_editorial_prose({"text": "..."})


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


class RawValueStatsTest(unittest.TestCase):
    """Tests the generic `raw_value_stats` helper that backs every distinct-count/frequency
    claim in docs/TEMPORAL_DATA_CONTRACT.md — see item 3 of the corrective review: those numbers
    must be something this script actually emits, not a one-off hand computation."""

    def test_distinct_count_and_total(self):
        places = [{"v": "A"}, {"v": "B"}, {"v": "A"}, {"v": "C"}]
        stats = audit.raw_value_stats(places, lambda p: p["v"])
        self.assertEqual(stats["total"], 4)
        self.assertEqual(stats["distinct"], 3)

    def test_frequencies_sorted_by_count_desc_then_value_asc(self):
        places = [{"v": v} for v in ["B", "A", "B", "C", "A", "B"]]
        stats = audit.raw_value_stats(places, lambda p: p["v"])
        # B=3, A=2, C=1 — ties (none here) would break by value ascending, exercised below.
        self.assertEqual(stats["frequencies"], [("B", 3), ("A", 2), ("C", 1)])

    def test_tie_breaks_alphabetically_for_determinism(self):
        places = [{"v": v} for v in ["Zebra", "Apple", "Mango"]]
        stats = audit.raw_value_stats(places, lambda p: p["v"])
        self.assertEqual(stats["frequencies"], [("Apple", 1), ("Mango", 1), ("Zebra", 1)])

    def test_none_values_counted_as_empty_string(self):
        places = [{"v": None}, {"v": None}, {"v": "X"}]
        stats = audit.raw_value_stats(places, lambda p: p["v"])
        self.assertIn(("", 2), stats["frequencies"])
        self.assertEqual(stats["distinct"], 2)

    def test_deterministic_repeated_calls(self):
        places = [{"v": v} for v in ["A", "B", "A", "C", "B", "A"]]
        first = audit.raw_value_stats(places, lambda p: p["v"])
        second = audit.raw_value_stats(places, lambda p: p["v"])
        self.assertEqual(first, second)

    def test_sum_of_frequencies_equals_total(self):
        places = [{"v": v} for v in ["A", "B", "A", "C", "B", "A", "D"]]
        stats = audit.raw_value_stats(places, lambda p: p["v"])
        self.assertEqual(sum(count for _, count in stats["frequencies"]), stats["total"])


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

    def _valid_place(self, **overrides):
        """A structurally valid place per the canonical contract, with one field overridable
        per test — so each malformed-type test below changes exactly one thing."""
        place = {
            "id": "X-1",
            "schedule": {"hours": "09:00-17:00", "closures": "Sin cierre"},
            "bestTime": "Mañana",
            "reservation": {"required": False, "leadTime": "—", "raw": "No"},
            "febMar2027": {"status": "OK", "warning": "w", "action": "a"},
        }
        for path, value in overrides.items():
            parent, child = path.split(".")
            place[parent][child] = value
        return place

    def test_schedule_hours_as_number_fails_clearly_not_silently_stringified(self):
        # item 2 of the corrective review's exact example: schedule.hours = 123.
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = self._write(tmp, json.dumps([self._valid_place(**{"schedule.hours": 123})]))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            message = str(ctx.exception)
            self.assertIn("schedule.hours", message)
            self.assertIn("must be str", message)

    def test_reservation_required_as_string_fails_clearly(self):
        # item 2's exact example: reservation.required = "false" — a string, not the bool the
        # canonical contract (app/src/types.ts) declares. `isinstance("false", bool)` is False,
        # so this must be rejected even though the string reads like a boolean to a human.
        with tempfile.TemporaryDirectory() as tmp:
            place = self._valid_place()
            place["reservation"]["required"] = "false"
            data_dir = self._write(tmp, json.dumps([place]))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            message = str(ctx.exception)
            self.assertIn("reservation.required", message)
            self.assertIn("must be bool", message)

    def test_reservation_required_as_int_fails_clearly(self):
        # `bool` is a subclass of `int` in Python — this pins down that the check rejects an
        # int in the OTHER direction too (1/0 are not accepted as a stand-in for True/False).
        with tempfile.TemporaryDirectory() as tmp:
            place = self._valid_place()
            place["reservation"]["required"] = 1
            data_dir = self._write(tmp, json.dumps([place]))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            self.assertIn("reservation.required", str(ctx.exception))

    def test_feb_mar_warning_as_list_fails_clearly(self):
        # item 2's exact example: febMar2027.warning = [].
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = self._write(tmp, json.dumps([self._valid_place(**{"febMar2027.warning": []})]))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            message = str(ctx.exception)
            self.assertIn("febMar2027.warning", message)
            self.assertIn("must be str", message)

    def test_feb_mar_action_as_dict_fails_clearly(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = self._write(tmp, json.dumps([self._valid_place(**{"febMar2027.action": {"x": 1}})]))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            self.assertIn("febMar2027.action", str(ctx.exception))

    def test_reservation_lead_time_as_number_fails_clearly(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = self._write(tmp, json.dumps([self._valid_place(**{"reservation.leadTime": 14})]))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            self.assertIn("reservation.leadTime", str(ctx.exception))

    def test_best_time_as_none_fails_clearly(self):
        # The canonical contract declares `bestTime: string`, never nullable — a looser earlier
        # version of this loader accepted None here; it must not anymore.
        with tempfile.TemporaryDirectory() as tmp:
            place = self._valid_place()
            place["bestTime"] = None
            data_dir = self._write(tmp, json.dumps([place]))
            with self.assertRaises(SystemExit) as ctx:
                audit.load_places(data_dir)
            self.assertIn("bestTime", str(ctx.exception))



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
            (lambda p: p["febMar2027"]["warning"], lib.classify_editorial_prose, lib.EDITORIAL_PROSE_TIER),
            (lambda p: p["febMar2027"]["action"], lib.classify_editorial_prose, lib.EDITORIAL_PROSE_TIER),
        ):
            _, tier_totals = audit.audit_field(self.places, extractor, classifier, tier_map)
            self.assertEqual(sum(tier_totals.values()), total)

    def test_reservation_required_is_real_bool_for_every_place(self):
        # load_places() is supposed to enforce this at read time; re-check it holds for every
        # place in the actual checked-out dataset rather than trusting the loader blindly.
        for place in self.places:
            self.assertIsInstance(place["reservation"]["required"], bool)

    def test_reservation_required_consistency_has_zero_inconsistencies_today(self):
        # Mechanically proves (rather than assumes) the finding recorded in
        # docs/TEMPORAL_DATA_CONTRACT.md: every place's `reservation.required` currently agrees
        # with the export pipeline's own `raw.lower() == "sí"` rule, non-binary raw values
        # included. If a future workbook/export change ever broke this, this test — not just the
        # audit script's printed report — would catch it.
        inconsistent = [
            place["id"]
            for place in self.places
            if lib.classify_reservation_consistency(
                place["reservation"]["raw"], place["reservation"]["required"]
            ).startswith("inconsistent-")
        ]
        self.assertEqual(inconsistent, [])

    def test_caveated_24h_example_currently_exists(self):
        # The exact real-dataset counterexample this corrective review's Fix 4 was written for.
        categories = {lib.classify_hours(p["schedule"]["hours"]) for p in self.places}
        self.assertIn("known-24h-with-caveat", categories)
        self.assertNotEqual(lib.HOURS_TIER["known-24h-with-caveat"], "SAFE")

    def test_feb_mar_warning_and_action_distinct_counts_match_stats_helper(self):
        warning_stats = audit.raw_value_stats(self.places, lambda p: p["febMar2027"]["warning"])
        action_stats = audit.raw_value_stats(self.places, lambda p: p["febMar2027"]["action"])
        manual_warning_count = len({p["febMar2027"]["warning"] for p in self.places})
        manual_action_count = len({p["febMar2027"]["action"] for p in self.places})
        self.assertEqual(warning_stats["distinct"], manual_warning_count)
        self.assertEqual(action_stats["distinct"], manual_action_count)

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
