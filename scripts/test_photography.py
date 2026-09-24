#!/usr/bin/env python3
"""Offline unit tests for validate-photography.py and select-photography-pilot.py.

No network access, no image decoding — these exercise the validator's pure functions
against synthetic in-memory data, mirroring scripts/test_access_points.py.
"""
import base64
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

PREPARER_SPEC = importlib.util.spec_from_file_location(
    "prepare_block2_photography_metadata", SCRIPT_DIR / "prepare-block2-photography-metadata.py"
)
preparer = importlib.util.module_from_spec(PREPARER_SPEC)
PREPARER_SPEC.loader.exec_module(preparer)

PLACE_IDS = {"JP-001", "JP-002", "JP-003", "JP-999-not-real"} - {"JP-999-not-real"}
FIXTURE_LQIP = "data:image/webp;base64," + base64.b64encode(
    b"RIFF" + b"\x00" * 4 + b"WEBP" + b"x" * 260
).decode("ascii")


def valid_record(**updates):
    record = {
        "placeId": "JP-001",
        "assetPath": "images/places/JP-001/synthetic.webp",
        "alt": "Escena sintética con suficiente descripción para pasar la validación.",
        "role": "identity",
        "lqip": FIXTURE_LQIP,
        "source": "Wikimedia Commons",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Synthetic.jpg",
        "credit": "Synthetic Author",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "acquisitionUrl": "https://upload.wikimedia.org/wikipedia/commons/synthetic.jpg",
        "originalTitle": "File:Synthetic.jpg",
        "originalWidth": 2000,
        "originalHeight": 1000,
        "processing": "resized-and-webp-reencoded",
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
            asset.write_bytes(b"fake-webp-bytes-original")
            # Block 2 made the card derivative part of a valid record: every registered
            # photograph must ship one, and it must be lighter than its original.
            (asset.parent / "synthetic-400w.webp").write_bytes(b"fake-400")
            (asset.parent / "synthetic-800w.webp").write_bytes(b"fake-800")
            errs = self.errors([valid_record()], root)
            self.assertEqual(errs, [])

    def test_a_record_without_its_card_derivative_is_invalid(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asset = root / "images/places/JP-001/synthetic.webp"
            asset.parent.mkdir(parents=True)
            asset.write_bytes(b"fake-webp-bytes-original")
            errs = self.errors([valid_record()], root)
            self.assertTrue(any("400w derivative is missing" in e for e in errs), errs)
            self.assertTrue(any("800w derivative is missing" in e for e in errs), errs)

    def test_a_derivative_heavier_than_its_original_is_invalid(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asset = root / "images/places/JP-001/synthetic.webp"
            asset.parent.mkdir(parents=True)
            asset.write_bytes(b"small")
            (asset.parent / "synthetic-400w.webp").write_bytes(b"tiny")
            (asset.parent / "synthetic-800w.webp").write_bytes(b"much-larger-than-the-original")
            errs = self.errors([valid_record()], root)
            self.assertTrue(any("larger than its original" in e for e in errs), errs)

    def test_an_orphaned_file_in_the_asset_tree_is_invalid(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asset = root / "images/places/JP-001/synthetic.webp"
            asset.parent.mkdir(parents=True)
            asset.write_bytes(b"fake-webp-bytes-original")
            (asset.parent / "synthetic-400w.webp").write_bytes(b"fake-400")
            (asset.parent / "synthetic-800w.webp").write_bytes(b"fake-800")
            (asset.parent / "left-behind.webp").write_bytes(b"orphan")
            errs = self.errors([valid_record()], root)
            self.assertTrue(any("orphaned asset on disk" in e for e in errs), errs)

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
                elif license_ == "Public Domain":
                    record["licenseBasis"] = "PD-self"
                    record.pop("licenseUrl")
                errs = self.errors([record], Path("/nonexistent"))
                # Only the "missing asset" error should remain for a supported license.
                self.assertTrue(all("license" not in e or "unsupported" not in e for e in errs), errs)

    def test_missing_required_credit_for_attribution_license(self):
        self.assert_invalid([valid_record(license="CC BY 4.0", credit="")], "requires a non-empty credit")

    def test_cc0_does_not_require_credit(self):
        record = valid_record(license="CC0", credit="", licenseUrl="https://creativecommons.org/publicdomain/zero/1.0/deed.en")
        errs = self.errors([record], Path("/nonexistent"))
        self.assertFalse(any("requires a non-empty credit" in e for e in errs), errs)

    def test_every_supported_license_requires_a_license_url(self):
        self.assert_invalid([valid_record(licenseUrl="")], "licenseUrl must be")
        self.assert_invalid(
            [valid_record(license="CC0", credit="", licenseUrl="")],
            "licenseUrl must be",
        )

    def test_license_url_must_match_the_declared_license(self):
        """A well-formed URL is not enough — the UI links it as *the* license."""
        self.assert_invalid(
            [valid_record(license="CC BY 4.0", licenseUrl="https://creativecommons.org/licenses/by-sa/4.0")],
            "does not match declared license",
        )
        self.assert_invalid(
            [valid_record(license="CC BY-SA 4.0", licenseUrl="https://creativecommons.org/licenses/by-sa/2.0")],
            "does not match declared license",
        )
        self.assert_invalid(
            [valid_record(license="CC0", credit="", licenseUrl="https://creativecommons.org/licenses/by/4.0")],
            "does not match declared license",
        )
        self.assert_invalid(
            [valid_record(licenseUrl="https://example.org/licenses/by-sa/4.0")],
            "does not match declared license",
        )

    def test_license_url_accepts_the_canonical_forms_in_use(self):
        for license_, license_url in [
            ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0"),
            ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
            ("CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"),
            ("CC BY-SA 2.5", "https://creativecommons.org/licenses/by-sa/2.5"),
            ("CC0", "https://creativecommons.org/publicdomain/zero/1.0/deed.en"),
        ]:
            with self.subTest(license=license_, licenseUrl=license_url):
                credit = "" if license_ == "CC0" else "Photographer"
                errs = self.errors(
                    [valid_record(license=license_, credit=credit, licenseUrl=license_url)],
                    Path("/nonexistent"),
                )
                self.assertFalse(any("does not match declared license" in e for e in errs), errs)

    def test_every_supported_license_has_a_canonical_url_path(self):
        """Adding a license to SUPPORTED_LICENSES must not silently skip the agreement check."""
        for license_ in validator.SUPPORTED_LICENSES:
            if license_ == "Public Domain":
                continue
            with self.subTest(license=license_):
                self.assertIsNotNone(validator.expected_license_path(license_))

    def test_public_domain_requires_verified_basis_and_commons_provenance_without_license_url(self):
        for basis in ("PD-self", "PD-USGov"):
            with self.subTest(basis=basis):
                record = valid_record(license="Public Domain", licenseBasis=basis)
                record.pop("licenseUrl")
                errs = self.errors([record], Path("/nonexistent"))
                self.assertFalse(any("Public Domain" in e for e in errs), errs)

        self.assert_invalid(
            [valid_record(license="Public Domain", licenseBasis="PD-self", licenseUrl="https://example.org/license")],
            "must not carry an invented licenseUrl",
        )
        self.assert_invalid(
            [valid_record(license="Public Domain", licenseBasis="pd-self")],
            "requires the verified licenseBasis 'PD-self' or 'PD-USGov'",
        )
        self.assert_invalid(
            [valid_record(license="Public Domain", licenseBasis="PD-self", sourceUrl="https://example.org/photo")],
            "must point to its Wikimedia Commons file page",
        )

    def test_public_domain_normalizer_accepts_only_explicit_supported_basis(self):
        self.assertEqual(
            preparer.normalise_licence("Public domain", "Self-published work|PD-self|Shopping arcades in Naha"),
            "Public Domain",
        )
        self.assertEqual(
            preparer.normalise_licence("Public domain", "PD US Military|United States Marine Corps"),
            "Public Domain",
        )
        self.assertEqual(
            preparer.public_domain_basis("PD US Marines|United States Marine Corps"),
            "PD-USGov",
        )
        self.assertEqual(preparer.public_domain_basis("PD US Military"), "PD-USGov")
        for categories in ("", "PD-old", "Public domain|Photography"):
            with self.subTest(categories=categories):
                with self.assertRaises(SystemExit):
                    preparer.normalise_licence("Public domain", categories)

    def test_attribution_title_must_be_non_empty_when_present(self):
        self.assert_invalid([valid_record(attributionTitle="")], "attributionTitle must be")
        self.assert_invalid([valid_record(attributionTitle="   ")], "attributionTitle must be")

    def test_processing_vocabulary_is_fail_closed(self):
        self.assert_invalid([valid_record(processing="cropped")], "processing must be one of")

    def test_a_large_file_may_not_claim_it_was_not_resized(self):
        # Unchanged and still a hard error: a file above the max dimension must have been
        # resized, so "webp-reencoded" would be a false statement about the asset.
        self.assert_invalid(
            [valid_record(originalWidth=2400, originalHeight=1600, processing="webp-reencoded")],
            "contradicts original dimensions",
        )

    def test_a_small_file_may_be_recorded_as_a_reduced_rendition(self):
        # Relaxed by Block 3 A1. Commons only serves a cached thumbnail strictly narrower than
        # the source, so a file at or below the max dimension is legitimately acquired as a
        # reduced rendition — and must be free to say so. See choose_render_width() in
        # scripts/acquire-photography.py.
        errs = self.errors(
            [valid_record(originalWidth=1600, originalHeight=900, processing="resized-and-webp-reencoded")],
            Path("/nonexistent"),
        )
        self.assertEqual([e for e in errs if "processing" in e], [])

    def test_webp_only_processing_is_valid_at_or_below_1600(self):
        record = valid_record(
            originalWidth=1600,
            originalHeight=900,
            processing="webp-reencoded",
        )
        errs = self.errors([record], Path("/nonexistent"))
        self.assertFalse(any("processing" in e for e in errs), errs)

    def test_original_dimensions_must_be_positive_integers(self):
        self.assert_invalid([valid_record(originalWidth=0)], "originalWidth/originalHeight")
        self.assert_invalid([valid_record(originalHeight=-1)], "originalWidth/originalHeight")
        self.assert_invalid([valid_record(originalWidth=True)], "originalWidth/originalHeight")

    def test_missing_asset_is_rejected(self):
        self.assert_invalid([valid_record()], "referenced asset is missing")

    def test_empty_alt_rejected(self):
        self.assert_invalid([valid_record(alt="")], "alt text")
        self.assert_invalid([valid_record(alt="  ")], "alt text")
        self.assert_invalid([valid_record(alt="JP-001")], "alt text")
        self.assert_invalid([valid_record(alt="Imagen de Shibuya")], "alt text")

    def test_role_is_required_and_fail_closed(self):
        self.assert_invalid([valid_record(role=None)], "role must be one of")
        self.assert_invalid([valid_record(role="cover")], "role must be one of")

    def test_lqip_is_required_and_must_be_inline_webp(self):
        self.assert_invalid([valid_record(lqip=None)], "lqip must be")
        self.assert_invalid([valid_record(lqip="data:image/jpeg;base64,abcd")], "lqip must be")

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
