#!/usr/bin/env python3
"""Offline unit tests for Block 3 A1 — the Commons rendition-width contract.

No network, no image decoding. These exercise the pure functions that decide *which*
rendition the acquisition pipeline asks Commons for, plus the retry/backoff arithmetic,
mirroring the style of scripts/test_photography.py.

The defect these cover, restated: Commons only renders a thumbnail when the requested width
is strictly smaller than the file's own width. Asking for the max dimension on a file that is
already at or below it therefore resolves to the **original** on upload.wikimedia.org, which
is rate-limited far more aggressively than cached /thumb/ renditions. Retrying that URL can
never succeed, so the fix has to be in width selection, not in the retry loop.
"""
import importlib.util
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SPEC = importlib.util.spec_from_file_location("acquire_photography", SCRIPT_DIR / "acquire-photography.py")
acquire = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(acquire)

VALIDATOR_SPEC = importlib.util.spec_from_file_location(
    "validate_photography", SCRIPT_DIR / "validate-photography.py"
)
validator = importlib.util.module_from_spec(VALIDATOR_SPEC)
VALIDATOR_SPEC.loader.exec_module(validator)

PREPARE_SPEC = importlib.util.spec_from_file_location(
    "prepare_block2", SCRIPT_DIR / "prepare-block2-photography-metadata.py"
)
prepare = importlib.util.module_from_spec(PREPARE_SPEC)
PREPARE_SPEC.loader.exec_module(prepare)

DERIVATIVE_SPEC = importlib.util.spec_from_file_location(
    "build_photography_derivatives", SCRIPT_DIR / "build-photography-derivatives.py"
)
derivatives = importlib.util.module_from_spec(DERIVATIVE_SPEC)
DERIVATIVE_SPEC.loader.exec_module(derivatives)

MAX = acquire.PHOTOGRAPHY_MAX_DIMENSION


class FakeHeaders:
    def __init__(self, value=None):
        self._value = value

    def get(self, key, default=None):
        return self._value if key == "Retry-After" else default


class FakeHTTPError(Exception):
    def __init__(self, code, retry_after=None):
        super().__init__(f"HTTP {code}")
        self.code = code
        self.headers = FakeHeaders(retry_after)


class RenditionWidthTests(unittest.TestCase):
    def test_exact_title_selection_acquires_only_one_complement_without_identity(self):
        rows = [
            {"placeId": "JP-001", "originalTitle": "File:identity.jpg", "role": "identity"},
            {"placeId": "JP-001", "originalTitle": "File:experience.jpg", "role": "experience"},
            {"placeId": "JP-002", "originalTitle": "File:other.jpg", "role": "identity"},
        ]
        self.assertEqual(acquire.select_records(rows, original_title="File:experience.jpg"), [rows[1]])
        self.assertEqual(acquire.select_records(rows, place_id="JP-001"), rows[:2])
        with self.assertRaises(ValueError):
            acquire.select_records(rows, place_id="JP-001", original_title="File:experience.jpg")

    def test_large_file_asks_for_the_max_dimension(self):
        for width in (1601, 2000, 4032, 6000):
            self.assertEqual(acquire.choose_render_width(width), MAX, width)

    def test_the_boundary_file_steps_below_its_own_width(self):
        # A file exactly at the max dimension is the case Block 2 tripped on: asking for 1600
        # would resolve to the original, so it must ask for something strictly smaller.
        self.assertEqual(acquire.choose_render_width(1600), 1280)

    def test_every_chosen_width_is_strictly_below_the_source(self):
        # The whole point: a width equal to or above the source resolves to the original.
        for width in range(321, 2200):
            chosen = acquire.choose_render_width(width)
            if chosen is None:
                continue
            self.assertLess(chosen, width, f"width {width} chose {chosen}")

    def test_no_chosen_width_ever_exceeds_the_max_dimension(self):
        for width in (321, 1000, 1600, 1601, 9000):
            chosen = acquire.choose_render_width(width)
            if chosen is not None:
                self.assertLessEqual(chosen, MAX, width)

    def test_chosen_width_is_always_a_standard_cached_width(self):
        for width in (400, 700, 900, 1100, 1500, 1600):
            chosen = acquire.choose_render_width(width)
            if chosen is not None:
                self.assertIn(chosen, acquire.STANDARD_THUMB_WIDTHS + (MAX,), width)

    def test_a_file_narrower_than_every_standard_width_has_no_rendition(self):
        # There is no thumbnail to ask for; the original is the only thing that exists.
        self.assertIsNone(acquire.choose_render_width(320))
        self.assertIsNone(acquire.choose_render_width(120))

    def test_the_rule_is_a_pure_function_of_width(self):
        # Called repeatedly it must not drift — acquisition determinism depends on this.
        self.assertEqual([acquire.choose_render_width(1600) for _ in range(5)], [1280] * 5)

    def test_rejects_a_nonsense_width(self):
        for bad in (0, -1, None, "1600", 1600.0):
            with self.assertRaises(ValueError, msg=repr(bad)):
                acquire.choose_render_width(bad)


class ProcessingConsistencyTests(unittest.TestCase):
    def test_a_large_file_is_always_recorded_as_resized(self):
        self.assertEqual(acquire.expected_processing_for(6000, 4000, 1600), "resized-and-webp-reencoded")

    def test_a_small_file_served_whole_is_not_resized(self):
        self.assertEqual(acquire.expected_processing_for(320, 240, 320), "webp-reencoded")

    def test_a_small_file_served_as_a_reduced_rendition_is_resized(self):
        self.assertEqual(acquire.expected_processing_for(1600, 1067, 1280), "resized-and-webp-reencoded")

    def test_planned_processing_matches_what_acquisition_will_actually_do(self):
        # A record must never be prepared declaring an intent the acquisition step refuses.
        for width, height in ((6000, 4000), (1601, 900), (1600, 1067), (1440, 810), (900, 600), (320, 240), (200, 150)):
            planned = acquire.planned_processing_for(width, height)
            chosen = acquire.choose_render_width(width)
            served = width if chosen is None else chosen
            self.assertEqual(planned, acquire.expected_processing_for(width, height, served), f"{width}x{height}")

    def test_prepare_script_agrees_with_the_pipeline(self):
        # Two files, one rule. If these ever diverge, records become unacquirable.
        for width, height in ((6000, 4000), (1600, 1067), (1440, 810), (320, 240)):
            self.assertEqual(
                prepare.planned_processing_for(width, height),
                acquire.planned_processing_for(width, height),
                f"{width}x{height}",
            )


class ValidatorProcessingTests(unittest.TestCase):
    """The validator was relaxed in exactly one direction; prove both halves."""

    def _errors(self, width, height, processing):
        record = {
            "placeId": "JP-001",
            "assetPath": "images/places/JP-001/x.webp",
            "alt": "a",
            "source": "Wikimedia Commons",
            "sourceUrl": "https://commons.wikimedia.org/wiki/File:X.jpg",
            "credit": "Someone",
            "license": "CC BY-SA 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
            "acquisitionUrl": "https://upload.wikimedia.org/x.jpg",
            "acquisitionDate": "2026-09-17",
            "originalTitle": "File:X.jpg",
            "originalWidth": width,
            "originalHeight": height,
            "processing": processing,
        }
        errors, _ = validator.validate_metadata({"images": [record]}, {"JP-001"}, Path("/nonexistent"))
        return [e for e in errors if "processing" in e]

    def test_a_large_file_may_not_claim_it_was_not_resized(self):
        self.assertTrue(self._errors(6000, 4000, "webp-reencoded"))

    def test_a_large_file_recorded_as_resized_is_accepted(self):
        self.assertEqual(self._errors(6000, 4000, "resized-and-webp-reencoded"), [])

    def test_a_small_file_may_be_recorded_either_way(self):
        self.assertEqual(self._errors(1600, 1067, "webp-reencoded"), [])
        self.assertEqual(self._errors(1600, 1067, "resized-and-webp-reencoded"), [])

    def test_an_unknown_processing_value_is_still_rejected(self):
        self.assertTrue(self._errors(1600, 1067, "cropped"))


class BackoffTests(unittest.TestCase):
    def test_retry_after_is_honoured_when_the_server_sends_one(self):
        self.assertEqual(acquire._retry_delay(FakeHTTPError(429, "30"), 0, 8), 30.0)

    def test_retry_after_is_capped_so_the_pipeline_cannot_park_forever(self):
        self.assertEqual(acquire._retry_delay(FakeHTTPError(429, "99999"), 0, 8), 120.0)

    def test_a_garbage_retry_after_falls_back_to_backoff(self):
        self.assertEqual(acquire._retry_delay(FakeHTTPError(429, "soon"), 0, 8), 8.0)

    def test_backoff_grows_with_attempts_but_stays_bounded(self):
        delays = [acquire._retry_delay(FakeHTTPError(429), attempt, 8) for attempt in range(8)]
        self.assertEqual(delays, sorted(delays))
        self.assertLessEqual(max(delays), 120.0)

    def test_throttle_enforces_a_minimum_interval(self):
        self.assertGreater(acquire.REQUEST_MIN_INTERVAL_SECONDS, 0)

    def test_download_retries_are_bounded(self):
        # Not an unbounded loop: the real failure mode is a refusal that retrying never fixes.
        import inspect

        signature = inspect.signature(acquire.download_bytes)
        self.assertLessEqual(signature.parameters["retries"].default, 6)


class RegistryConsistencyTests(unittest.TestCase):
    """The committed registry must stay acquirable under the new rule."""

    def test_every_record_declares_a_processing_the_pipeline_can_satisfy(self):
        import json

        registry = json.loads(
            (SCRIPT_DIR.parent / "data" / "visual" / "photography-metadata.json").read_text(encoding="utf-8")
        )
        for record in registry["images"]:
            width, height = record["originalWidth"], record["originalHeight"]
            declared = record["processing"]
            if width <= MAX and declared == "webp-reencoded":
                # Acquired as the original, before the rule existed; still reproducible only
                # if the host serves originals. Legal, and asserted so the count cannot grow
                # silently — see test_small_originals_are_a_closed_legacy_set.
                continue
            chosen = acquire.choose_render_width(width) if width <= MAX else MAX
            served = width if chosen is None else chosen
            self.assertEqual(
                declared,
                acquire.expected_processing_for(width, height, served),
                f"{record['placeId']} {width}x{height}",
            )

    def test_small_originals_are_a_closed_legacy_set(self):
        import json

        registry = json.loads(
            (SCRIPT_DIR.parent / "data" / "visual" / "photography-metadata.json").read_text(encoding="utf-8")
        )
        legacy = [
            r["placeId"]
            for r in registry["images"]
            if r["originalWidth"] <= MAX and r["processing"] == "webp-reencoded"
        ]
        # These predate Block 3 A1 and depend on the host serving originals. New records must
        # never join them: `planned_processing_for` records small files as reduced renditions.
        self.assertEqual(len(legacy), 7, legacy)


class Block22DerivativeContractTests(unittest.TestCase):
    def test_both_derivative_names_are_derived_from_the_original(self):
        asset = "images/places/JP-001/example.webp"
        self.assertEqual(
            derivatives.derivative_path_for(asset, 400),
            "images/places/JP-001/example-400w.webp",
        )
        self.assertEqual(
            derivatives.derivative_path_for(asset, 800),
            "images/places/JP-001/example-800w.webp",
        )

    def test_unknown_derivative_width_fails_closed(self):
        with self.assertRaises(ValueError):
            derivatives.derivative_path_for("images/places/JP-001/example.webp", 600)

    def test_lqip_is_generated_from_pixels_with_the_prescribed_shape(self):
        from io import BytesIO
        from PIL import Image

        source = BytesIO()
        Image.new("RGB", (160, 90), (64, 128, 192)).save(source, format="WEBP", quality=90)
        lqip = derivatives.encode_lqip(source.getvalue())
        self.assertTrue(lqip.startswith("data:image/webp;base64,"))
        self.assertLessEqual(len(lqip.encode("ascii")), derivatives.LQIP_MAX_DATA_URL_BYTES)


class IdentityHubBudgetTests(unittest.TestCase):
    @staticmethod
    def _source_bytes():
        from io import BytesIO
        from PIL import Image

        image = Image.new("RGB", (800, 600))
        image.putdata([(x * 255 // 799, y * 255 // 599, ((x // 20) * 17 + (y // 20) * 31) % 256)
                       for y in range(600) for x in range(800)])
        stream = BytesIO()
        image.save(stream, format="WEBP", quality=92, method=6)
        return stream.getvalue()

    def test_identity_800_renditions_are_deterministically_rebalanced_to_the_hub_cap(self):
        source = self._source_bytes()
        record = {"placeId": "JP-004", "assetPath": "images/places/JP-004/example.webp", "role": "identity"}
        initial_quality, initial = derivatives.choose_derivative_encoding(source, 800)
        self.assertGreater(initial_quality, derivatives.DERIVATIVE_MIN_QUALITY)
        next_quality = max(derivatives.DERIVATIVE_MIN_QUALITY, initial_quality - derivatives.DERIVATIVE_QUALITY_STEP)
        expected = derivatives.encode_derivative_at_quality(source, 800, next_quality)
        self.assertLess(len(expected), len(initial))
        budget = len(expected)
        first = derivatives.rebalance_identity_800([record], {record["assetPath"]: source}, {"JP-004": "Tokio"}, budget)
        second = derivatives.rebalance_identity_800([record], {record["assetPath"]: source}, {"JP-004": "Tokio"}, budget)
        self.assertEqual(first, second)
        renditions, qualities, totals = first
        self.assertEqual(renditions[record["assetPath"]], expected)
        self.assertEqual(qualities[record["assetPath"]], next_quality)
        self.assertEqual(totals, {"Tokio": budget})
        self.assertGreaterEqual(qualities[record["assetPath"]], derivatives.DERIVATIVE_MIN_QUALITY)

    def test_budget_rebalancing_ignores_non_identity_and_fails_at_quality_floor(self):
        source = self._source_bytes()
        identity = {"placeId": "JP-004", "assetPath": "images/places/JP-004/example.webp", "role": "identity"}
        detail = {"placeId": "JP-004", "assetPath": "images/places/JP-004/detail.webp", "role": "detail"}
        initial_quality, initial = derivatives.choose_derivative_encoding(source, 800)
        floor = derivatives.encode_derivative_at_quality(source, 800, derivatives.DERIVATIVE_MIN_QUALITY)
        self.assertLessEqual(derivatives.DERIVATIVE_MIN_QUALITY, initial_quality)
        self.assertEqual(derivatives.rebalance_identity_800([detail], {detail["assetPath"]: source}, {"JP-004": "Tokio"}, 0), ({}, {}, {}))
        with self.assertRaisesRegex(ValueError, "quality floor"):
            derivatives.rebalance_identity_800([identity], {identity["assetPath"]: source}, {"JP-004": "Tokio"}, len(floor) - 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
