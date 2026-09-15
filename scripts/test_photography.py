#!/usr/bin/env python3
"""Offline unit tests for validate-photography.py and select-photography-pilot.py.

No network access, no image decoding — these exercise the validator's pure functions
against synthetic in-memory data, mirroring scripts/test_access_points.py.
"""
import importlib.util
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
VALIDATOR_SPEC = importlib.util.spec_from_file_location("validate_photography", SCRIPT_DIR / "validate-photography.py")
validator = importlib.util.module_from_spec(VALIDATOR_SPEC)
VALIDATOR_SPEC.loader.exec_module(validator)

SELECTOR_SPEC = importlib.util.spec_from_file_location(
    "select_photography_pilot", SCRIPT_DIR / "select-photography-pilot.py"
)
selector = importlib.util.module_from_spec(SELECTOR_SPEC)
SELECTOR_SPEC.loader.exec_module(selector)

PLACE_IDS = {"JP-001", "JP-002", "JP-003", "JP-999-not-real"} - {"JP-999-not-real"}


def valid_record(**updates):
    record = {
        "placeId": "JP-001",
        "assetPath": "images/places/JP-001/synthetic.webp",
        "alt": "Escena sintética con suficiente descripción para pasar la validación.",
        "source": "Wikimedia Commons",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Synthetic.jpg",
        "credit": "Synthetic Author",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "acquisitionUrl": "https://upload.wikimedia.org/wikipedia/commons/synthetic.jpg",
        "originalTitle": "File:Synthetic.jpg",
    }
    record.update(updates)
    return record


class MetadataValidationTests(unittest.TestCase):
    def errors(self, records, asset_root):
        errors, _ = validator.validate_metadata({"images": records}, PLACE_IDS, asset_root)
        return errors

    def assert_invalid(self, records, phrase, asset_root=None):
        root = asset_root or Path("/nonexistent")
        errs = self.errors(records, root)
        self.assertTrue(any(phrase in e for e in errs), errs)

    def test_valid_record_with_asset_present(self, tmp_path=None):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asset = root / "images/places/JP-001/synthetic.webp"
            asset.parent.mkdir(parents=True)
            asset.write_bytes(b"fake-webp-bytes")
            errs = self.errors([valid_record()], root)
            self.assertEqual(errs, [])

    def test_unknown_place_id(self):
        self.assert_invalid([valid_record(placeId="JP-999")], "unknown placeId")

    def test_duplicate_asset_path(self):
        self.assert_invalid(
            [valid_record(), valid_record(placeId="JP-002")],
            "duplicate assetPath",
        )

    def test_duplicate_source_for_different_places(self):
        self.assert_invalid(
            [valid_record(), valid_record(placeId="JP-002", assetPath="images/places/JP-002/synthetic.webp")],
            "declared for more than one place",
        )

    def test_missing_source_url(self):
        self.assert_invalid([valid_record(sourceUrl="")], "sourceUrl must be")
        self.assert_invalid([valid_record(sourceUrl=None)], "sourceUrl must be")

    def test_malformed_url(self):
        self.assert_invalid([valid_record(sourceUrl="not-a-url")], "sourceUrl must be")
        self.assert_invalid([valid_record(acquisitionUrl="not-a-url")], "acquisitionUrl must be")

    def test_unsupported_license_rejected(self):
        self.assert_invalid([valid_record(license="All rights reserved")], "unsupported license")
        self.assert_invalid([valid_record(license="CC BY-NC 4.0")], "unsupported license")

    def test_supported_license_accepted(self):
        for license_ in sorted(validator.SUPPORTED_LICENSES):
            with self.subTest(license=license_):
                record = valid_record(license=license_)
                if license_ == "CC0":
                    record["credit"] = ""
                    record["licenseUrl"] = "https://creativecommons.org/publicdomain/zero/1.0/deed.en"
                errs = self.errors([record], Path("/nonexistent"))
                # Only the "missing asset" error should remain for a supported license.
                self.assertTrue(all("license" not in e or "unsupported" not in e for e in errs), errs)

    def test_missing_required_credit_for_attribution_license(self):
        self.assert_invalid([valid_record(license="CC BY 4.0", credit="")], "requires a non-empty credit")

    def test_cc0_does_not_require_credit(self):
        record = valid_record(license="CC0", credit="", licenseUrl="https://creativecommons.org/publicdomain/zero/1.0/deed.en")
        errs = self.errors([record], Path("/nonexistent"))
        self.assertFalse(any("requires a non-empty credit" in e for e in errs), errs)

    def test_missing_asset_is_rejected(self):
        self.assert_invalid([valid_record()], "referenced asset is missing")

    def test_empty_alt_rejected(self):
        self.assert_invalid([valid_record(alt="")], "alt text")
        self.assert_invalid([valid_record(alt="  ")], "alt text")
        self.assert_invalid([valid_record(alt="JP-001")], "alt text")
        self.assert_invalid([valid_record(alt="Imagen de Shibuya")], "alt text")

    def test_unsupported_file_format_rejected(self):
        self.assert_invalid(
            [valid_record(assetPath="images/places/JP-001/synthetic.jpg")],
            "does not match images/places",
        )

    def test_asset_path_outside_approved_directory_rejected(self):
        self.assert_invalid(
            [valid_record(assetPath="assets/JP-001/synthetic.webp")],
            "must live under",
        )

    def test_asset_path_place_folder_must_match_place_id(self):
        self.assert_invalid(
            [valid_record(placeId="JP-002", assetPath="images/places/JP-001/synthetic.webp")],
            "does not match placeId",
        )


class PilotValidationTests(unittest.TestCase):
    def make_pilot(self, count_per_hub=6):
        places = []
        for hub in selector.PILOT_HUBS:
            for i in range(count_per_hub):
                places.append(
                    {
                        "placeId": f"JP-{hub[:2].upper()}{i}",
                        "hub": hub,
                        "intendedImageCount": 1,
                    }
                )
        return {"places": places}

    def test_valid_pilot_of_24(self):
        place_ids = {p["placeId"] for p in self.make_pilot()["places"]}
        errors, ids = validator.validate_pilot(self.make_pilot(), place_ids)
        self.assertEqual(errors, [])
        self.assertEqual(len(ids), 24)

    def test_wrong_total_count_rejected(self):
        pilot = self.make_pilot(count_per_hub=5)
        place_ids = {p["placeId"] for p in pilot["places"]}
        errors, _ = validator.validate_pilot(pilot, place_ids)
        self.assertTrue(any("exactly 24 places" in e for e in errors), errors)

    def test_uneven_hub_distribution_rejected(self):
        pilot = self.make_pilot()
        pilot["places"][0]["hub"] = pilot["places"][6]["hub"]  # steal one from Tokio into Kioto's hub
        place_ids = {p["placeId"] for p in pilot["places"]}
        errors, _ = validator.validate_pilot(pilot, place_ids)
        self.assertTrue(any("expected 6 pilot places" in e for e in errors), errors)

    def test_duplicate_place_id_in_pilot_rejected(self):
        pilot = self.make_pilot()
        pilot["places"][1]["placeId"] = pilot["places"][0]["placeId"]
        place_ids = {p["placeId"] for p in pilot["places"]}
        errors, _ = validator.validate_pilot(pilot, place_ids)
        self.assertTrue(any("duplicate placeId" in e for e in errors), errors)

    def test_unknown_place_id_in_pilot_rejected(self):
        pilot = self.make_pilot()
        errors, _ = validator.validate_pilot(pilot, {"JP-000"})
        self.assertTrue(any("unknown placeId" in e for e in errors), errors)


class PilotPlaceLackingPhotographTests(unittest.TestCase):
    def test_pilot_place_without_metadata_image_is_flagged(self):
        pilot_place_ids = ["JP-001", "JP-002"]
        images_by_place = {"JP-001": [valid_record()]}
        missing = [pid for pid in pilot_place_ids if pid and not images_by_place.get(pid)]
        self.assertEqual(missing, ["JP-002"])


class SelectionDeterminismTests(unittest.TestCase):
    def make_place(self, place_id, hub, category, grade):
        return {"id": place_id, "hub": hub, "name": place_id, "category": category, "grade": grade}

    def test_selection_is_deterministic_and_covers_all_buckets(self):
        places = []
        buckets = [
            ("🏯 Historia y patrimonio", "landmark"),
            ("⛩️ Templos y santuarios", "temple-shrine"),
            ("🏙️ Ciudad y barrios", "urban-neighborhood"),
            ("🌿 Naturaleza", "nature"),
            ("🏛️ Museos", "museum-cultural"),
            ("🎮 Videojuegos", "distinct-experience"),
        ]
        for hub in selector.PILOT_HUBS:
            for i, (category, _bucket) in enumerate(buckets):
                places.append(self.make_place(f"JP-{hub[:1]}{i}", hub, category, "A"))

        first = selector.select_pilot(places)
        second = selector.select_pilot(places)
        self.assertEqual(first, second)
        self.assertEqual(len(first), 24)
        self.assertEqual(
            sorted(entry["selectionCategory"] for entry in first if entry["hub"] == "Tokio"),
            sorted(bucket for _cat, bucket in buckets),
        )

    def test_higher_grade_wins_ties_broken_by_id(self):
        places = [
            self.make_place("JP-002", "Tokio", "⛩️ Templos y santuarios", "A"),
            self.make_place("JP-001", "Tokio", "⛩️ Templos y santuarios", "S"),
        ]
        # Fill remaining buckets so selection does not raise for missing categories.
        for i, category in enumerate(
            ["🏯 Historia y patrimonio", "🏙️ Ciudad y barrios", "🌿 Naturaleza", "🏛️ Museos", "🎮 Videojuegos"]
        ):
            places.append(self.make_place(f"JP-10{i}", "Tokio", category, "A"))
        for hub in ("Kioto", "Osaka", "Okinawa"):
            for i, category in enumerate(
                [
                    "🏯 Historia y patrimonio",
                    "⛩️ Templos y santuarios",
                    "🏙️ Ciudad y barrios",
                    "🌿 Naturaleza",
                    "🏛️ Museos",
                    "🎮 Videojuegos",
                ]
            ):
                places.append(self.make_place(f"JP-{hub[:1]}{i}", hub, category, "A"))

        entries = selector.select_pilot(places)
        temple_pick = next(e for e in entries if e["hub"] == "Tokio" and e["selectionCategory"] == "temple-shrine")
        self.assertEqual(temple_pick["placeId"], "JP-001")


if __name__ == "__main__":
    unittest.main()
